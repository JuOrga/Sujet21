// L'ANNUAIRE — ce qui met deux navigateurs en relation, par un code court.
//
// LA PANNE QUI A FAIT CE FICHIER (le concepteur et son ami, 19/11, premier
// essai entre deux maisons). La première version n'avait pas d'annuaire :
// l'hôte copiait un code de 550 caractères, l'ami le collait et renvoyait
// un code de réponse, l'hôte allait le chercher dans sa messagerie et le
// collait. L'essai a échoué là : « ça coupe sur mon PC quand je fais
// alt-tab pour aller choper le code qu'il m'a envoyé en retour », et le
// téléphone de l'ami affichait « la liaison n'a pas pu s'établir ». Le
// navigateur qui REJOINT commence à frapper chez l'hôte dès qu'il a fait sa
// réponse, et il renonce au bout d'une quinzaine de secondes sans écho — or
// l'hôte ne peut lui répondre qu'une fois la réponse collée. Un humain qui
// relaie deux codes par messagerie, dont un depuis un téléphone, ne tient
// pas ce délai. Vu d'ici, la panne ne se reproduisait pas : sur une seule
// machine l'hôte répond tout de suite, et l'invité attend 45 s sans broncher.
//
// D'où l'annuaire : un tiers par qui les deux navigateurs s'échangent leurs
// descriptions EUX-MÊMES, en une seconde, sans personne pour relayer.
// L'hôte s'y inscrit sous un code de cinq lettres ; l'ami tape le code.
//
// QUEL ANNUAIRE. Le dépôt ne peut pas en héberger un : les douze fonctions
// du plan Hobby sont prises (api/reglages.ts), une fonction ne tient pas de
// connexion ouverte, et passer par le magasin Blob coûterait des opérations
// sur un forfait de 2 000 par mois qui a déjà bloqué le magasin un mois
// entier (api/_magasin.ts). On emploie donc le service PUBLIC et gratuit de
// PeerJS (0.peerjs.com), fait pour cela, sans compte. Ce qu'il voit : les
// descriptions des deux navigateurs (leurs adresses réseau), le temps de la
// mise en relation. Ce qu'il ne voit pas : la partie — dès que la liaison
// directe est ouverte, on raccroche. S'il est en panne, on ne peut pas
// créer de partie ; l'écran le dit.
//
// On parle son protocole directement (quelques messages JSON sur une
// WebSocket) plutôt que d'embarquer sa bibliothèque : nos canaux restent
// les nôtres (liaison.ts), et le paquet ne grossit pas.

/** L'adresse de l'annuaire public. */
const ANNUAIRE_PUBLIC = 'wss://0.peerjs.com/peerjs'
/** La clé du service public (elle est publique : c'est celle de tout le
 *  monde). */
const CLE = 'peerjs'
/** Le pouls : sans lui, l'annuaire nous croit partis. */
const POULS_MS = 5000
/** Le temps laissé à l'annuaire pour nous inscrire. */
const DELAI_INSCRIPTION_MS = 10_000

/** L'alphabet des codes : ni I ni O ni 0 ni 1 — rien qui se confonde quand
 *  on dicte le code au téléphone ou qu'on le lit sur un écran. */
export const ALPHABET_CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const LONGUEUR_CODE = 5

/** Tire un code de partie. `hasard` rend un nombre dans [0, 1[. */
export function tireCode(hasard: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < LONGUEUR_CODE; i++) code += ALPHABET_CODE[Math.floor(hasard() * ALPHABET_CODE.length) % ALPHABET_CODE.length]
  return code
}

/** Ce qu'on a compris d'un code tapé : le code remis au propre, ou la
 *  raison du refus, en clair. Tolère les minuscules, les espaces, les
 *  tirets, et les confusions qu'on fait en recopiant (0 pour O, 1 pour I —
 *  ces lettres n'existent pas dans un code : on sait ce qui était voulu… et
 *  on sait aussi que le code est faux). */
export function litCodePartie(tape: string): { ok: true; code: string } | { ok: false; raison: string } {
  const propre = tape.toUpperCase().replace(/[\s\-_.]/g, '')
  if (propre === '') return { ok: false, raison: 'Tapez le code que votre ami vous a donné.' }
  if (propre.length !== LONGUEUR_CODE) return { ok: false, raison: `Le code fait ${LONGUEUR_CODE} caractères : celui-ci en a ${propre.length}.` }
  for (const c of propre) {
    if (!ALPHABET_CODE.includes(c)) {
      return { ok: false, raison: `« ${c} » n’existe dans aucun code (ni I, ni O, ni 0, ni 1) : vérifiez-le auprès de votre ami.` }
    }
  }
  return { ok: true, code: propre }
}

/** Le nom sous lequel une partie est inscrite à l'annuaire. Le préfixe nous
 *  met à l'écart des autres usagers du service public. */
export function nomDePartie(code: string): string {
  return 'sujet21-multi-' + code.toLowerCase()
}

/** L'adresse de l'annuaire. Un essai local peut en désigner un autre par
 *  `?annuaire=ws://localhost:…` — et SEULEMENT local : un lien piégé ne doit
 *  pas pouvoir faire passer la mise en relation par le serveur d'un tiers. */
export function adresseAnnuaire(recherche: string): string {
  const voulu = new URLSearchParams(recherche).get('annuaire')
  if (voulu && /^ws:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(voulu)) return voulu
  return ANNUAIRE_PUBLIC
}

/** Ce que l'annuaire relaie entre deux inscrits. */
export type GenreMessage = 'OFFER' | 'ANSWER' | 'CANDIDATE' | 'LEAVE'

export type Inscription =
  | { ok: true; annuaire: Annuaire }
  /** `pris` : ce nom est déjà inscrit (tirer un autre code). `detail` : ce
   *  que le carnet de bord en dit, pour qui doit comprendre la panne. */
  | { ok: false; pris: boolean; raison: string; detail: string }

export class Annuaire {
  /** Un message d'un autre inscrit. */
  surMessage: ((de: string, genre: GenreMessage, charge: unknown) => void) | null = null
  /** L'annuaire n'a trouvé personne sous ce nom (il rend le message au bout
   *  de cinq secondes). */
  surAbsent: ((nom: string) => void) | null = null
  /** La connexion à l'annuaire est tombée. */
  surFerme: (() => void) | null = null
  private pouls = 0
  private ferme_ = false
  // LE CARNET DE BORD. L'annuaire est un service tiers qu'on ne peut pas
  // interroger depuis l'environnement d'analyse : quand il raccroche chez un
  // joueur, la seule trace est ce que SON navigateur a vu. On la note donc,
  // et l'écran l'écrit sous le message d'erreur — une capture d'écran
  // suffit alors à dire si c'est le réseau (1006), le service (1000, 1008,
  // 1013…) ou un refus motivé.
  private readonly ne = performance.now()
  private ouvertA = -1
  private fermeA = -1
  private codeFermeture = 0
  private raisonFermeture = ''
  private fermeturePropre = false
  private erreurService = ''
  private recus = 0
  private envoyes = 0
  private dernierRecu = ''
  private dernierEnvoye = ''

  private constructor(
    private readonly ws: WebSocket,
    readonly nom: string,
  ) {}

  /** Le carnet de bord, en une ligne. */
  diagnostic(): string {
    const ms = (t: number): string => `${Math.round(t - this.ne)} ms`
    const morceaux = [this.ouvertA < 0 ? 'jamais inscrit' : `inscrit en ${ms(this.ouvertA)}`]
    morceaux.push(`envoyé ${this.envoyes}${this.dernierEnvoye ? ' (dernier : ' + this.dernierEnvoye + ')' : ''}`)
    morceaux.push(`reçu ${this.recus}${this.dernierRecu ? ' (dernier : ' + this.dernierRecu + ')' : ''}`)
    if (this.erreurService) morceaux.push(`le service dit : « ${this.erreurService.slice(0, 120)} »`)
    if (this.fermeA >= 0) {
      morceaux.push(
        `coupé à ${ms(this.fermeA)}, code ${this.codeFermeture}${this.fermeturePropre ? '' : ' (coupure sèche)'}${this.raisonFermeture ? ' « ' + this.raisonFermeture.slice(0, 80) + ' »' : ''}`,
      )
    }
    return morceaux.join(' · ')
  }

  /** S'inscrit à l'annuaire sous `nom`. */
  static inscrit(adresse: string, nom: string): Promise<Inscription> {
    return new Promise((rend) => {
      let fini = false
      const conclut = (r: Inscription): void => {
        if (fini) return
        fini = true
        window.clearTimeout(minuteur)
        rend(r)
      }
      const echec = (pris: boolean, raison: string): void => conclut({ ok: false, pris, raison, detail: a ? a.diagnostic() : '' })
      const jeton = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
      let a: Annuaire | null = null
      let ws: WebSocket
      try {
        ws = new WebSocket(`${adresse}?key=${CLE}&id=${encodeURIComponent(nom)}&token=${jeton}&version=1.5.4`)
      } catch {
        echec(false, 'L’annuaire est injoignable depuis ce navigateur.')
        return
      }
      const moi = new Annuaire(ws, nom)
      a = moi
      const minuteur = window.setTimeout(() => {
        echec(false, 'L’annuaire ne répond pas. Vérifiez la connexion, puis réessayez dans un instant.')
        moi.ferme()
      }, DELAI_INSCRIPTION_MS)
      ws.onmessage = (ev) => {
        let m: { type?: string; src?: string; payload?: unknown }
        try {
          m = JSON.parse(String(ev.data)) as typeof m
        } catch {
          return
        }
        moi.recus++
        moi.dernierRecu = String(m.type ?? '?')
        // un refus motivé, à quelque moment qu'il arrive : on garde le motif
        if (m.type === 'ERROR' || m.type === 'INVALID-KEY' || m.type === 'ID-TAKEN') {
          const motif = (m.payload as { msg?: unknown } | undefined)?.msg
          moi.erreurService = typeof motif === 'string' ? motif : String(m.type)
        }
        if (!fini) {
          if (m.type === 'OPEN') {
            moi.ouvertA = performance.now()
            moi.pouls = window.setInterval(() => moi.envoieBrut({ type: 'HEARTBEAT' }), POULS_MS)
            conclut({ ok: true, annuaire: moi })
          } else if (m.type === 'ID-TAKEN') {
            echec(true, 'Ce code est déjà pris.')
            moi.ferme()
          } else if (m.type === 'ERROR' || m.type === 'INVALID-KEY') {
            echec(false, 'L’annuaire a refusé l’inscription. Réessayez dans un instant.')
            moi.ferme()
          }
          return
        }
        if (m.type === 'EXPIRE' && typeof m.src === 'string') moi.surAbsent?.(m.src)
        else if ((m.type === 'OFFER' || m.type === 'ANSWER' || m.type === 'CANDIDATE' || m.type === 'LEAVE') && typeof m.src === 'string') {
          moi.surMessage?.(m.src, m.type, m.payload)
        }
      }
      ws.onerror = () => {
        echec(false, 'L’annuaire est injoignable. Vérifiez la connexion, puis réessayez dans un instant.')
      }
      ws.onclose = (ev) => {
        window.clearInterval(moi.pouls)
        if (!moi.ferme_) {
          moi.fermeA = performance.now()
          moi.codeFermeture = ev.code
          moi.raisonFermeture = ev.reason
          moi.fermeturePropre = ev.wasClean
        }
        echec(false, 'L’annuaire a coupé la connexion. Réessayez dans un instant.')
        if (!moi.ferme_) moi.surFerme?.()
      }
    })
  }

  private envoieBrut(message: unknown): void {
    if (this.ws.readyState !== WebSocket.OPEN) return
    try {
      this.ws.send(JSON.stringify(message))
      const genre = (message as { type?: unknown }).type
      if (genre !== 'HEARTBEAT') {
        this.envoyes++
        this.dernierEnvoye = String(genre)
      }
    } catch {
      // la connexion vient de tomber : surFerme le dira
    }
  }

  /** Fait porter un message à un autre inscrit. */
  envoie(a: string, genre: GenreMessage, charge: unknown): void {
    this.envoieBrut({ type: genre, dst: a, payload: charge })
  }

  /** Raccroche. */
  ferme(): void {
    this.ferme_ = true
    window.clearInterval(this.pouls)
    try {
      this.ws.close()
    } catch {
      // déjà fermée
    }
  }
}
