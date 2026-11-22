// LA LIAISON PAR LE RELAIS — le côté navigateur de relais/index.js.
//
// Trois essais de liaison DIRECTE entre deux maisons ont échoué (relais/
// index.js raconte lesquels). La partie passe donc par un serveur, dans le
// projet Vercel du jeu : chaque joueur y ouvre une connexion avec le code
// de la partie, et tout ce que l'un envoie est remis à l'autre. Un réseau
// qui affiche une page web laisse passer cette connexion — plus de box qui
// refuse, plus d'annuaire tiers, plus de délai à tenir.
//
// Ce que cela coûte : la partie fait un détour (une cinquantaine de
// millisecondes, à mesurer), et elle voyage sur une connexion FIABLE — une
// image perdue est renvoyée au lieu d'être remplacée par la suivante. D'où
// l'engorgement surveillé des deux côtés : quand la ligne ne suit pas, on
// saute des images plutôt que de les empiler.
//
// LA CONNEXION SE COUPE, ET C'EST PRÉVU. Une fonction Vercel a une durée
// maximale ; à son terme la connexion tombe. On la rouvre aussitôt, on
// reprend sa place dans le salon, et la partie continue — l'hôte n'a pas
// cessé de simuler. Ce n'est une fin que si l'on ne parvient pas à revenir.

import { tireCode } from './code'

/** L'adresse du relais en ligne : un ALIAS fixe. Le relais vit dans le
 *  projet Vercel du jeu comme un aperçu à part, et un aperçu reçoit une
 *  adresse neuve à chaque déploiement — le jeu devait la recopier ici à
 *  chaque fois. Depuis que le multi est ouvert à tous (22/11), le workflow
 *  du relais pose ce nom sur chaque nouveau déploiement
 *  (.github/workflows/relais.yml) : redéployer le relais ne change plus
 *  rien ici. */
const RELAIS_PUBLIC = 'wss://sujet21-relais.vercel.app/ws'
/** Le temps laissé au relais pour nous installer. */
const DELAI_INSTALLATION_MS = 10_000
/** Au-delà de ce silence, la partie est perdue : on a essayé de revenir, ou
 *  on a attendu l'autre, sans succès. */
const DELAI_ABANDON_MS = 20_000
/** L'ENGORGEMENT. Dès que la file d'envoi dépasse deux images, l'hôte SAUTE
 *  la suivante : la cadence baisse d'elle-même jusqu'à ce que la ligne
 *  tienne, et ce qui arrive reste frais. */
const FILE_ENGORGEE_OCTETS = 24 * 1024
/** Le garde-fou dur : au-delà, plus rien ne part, quoi qu'on demande. */
const FILE_MAX_OCTETS = 512 * 1024

/** L'adresse du relais. Un essai local peut en désigner un autre par
 *  `?relais=ws://localhost:…` — et SEULEMENT local : un lien piégé ne doit
 *  pas pouvoir faire passer la partie par le serveur d'un tiers. */
export function adresseRelais(recherche: string): string {
  const voulu = new URLSearchParams(recherche).get('relais')
  if (voulu && /^ws:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(voulu)) return voulu
  return RELAIS_PUBLIC
}

export type EtatLiaison = 'attente' | 'ouverte' | 'coupee' | 'echec'
export type Role = 'hote' | 'invite'

export type Ordre =
  | { t: 'salut'; version: number }
  | { t: 'recommence' }
  /** Qui je suis : mon nom et ma couleur (profil.ts). Ce qui arrive est
   *  remis au propre par celui qui le reçoit. */
  | { t: 'profil'; pseudo: string; couleur: number }
  | { t: 'pouls'; id: number }
  | { t: 'echo'; id: number }
  | { t: 'adieu' }

export interface Liaison {
  /** attente : pas encore deux dans le salon · ouverte : la partie peut
   *  jouer (et le reste à travers les reconnexions) · coupee : elle jouait,
   *  on n'a pas pu revenir · echec : elle n'a jamais pu jouer. */
  readonly etat: EtatLiaison
  /** Pourquoi elle a fini, en clair (vide tant qu'elle vit). */
  readonly raison: string
  /** Octets reçus et envoyés en images et commandes depuis l'ouverture. */
  readonly recus: number
  readonly envoyes: number
  /** La file d'envoi déborde : l'image suivante est à sauter. */
  readonly engorgee: boolean
  surEtat: ((etat: EtatLiaison) => void) | null
  surFlux: ((octets: Uint8Array) => void) | null
  surOrdre: ((ordre: Ordre) => void) | null
  /** Envoie une trame. Rend false si elle a été sautée. */
  envoieFlux(octets: Uint8Array): boolean
  envoieOrdre(ordre: Ordre): void
  ferme(): void
  /** Ce que la liaison sait d'elle-même, en une ligne, pour le dépannage. */
  diagnostic(): string
}

class LiaisonRelais implements Liaison {
  etat: EtatLiaison = 'attente'
  raison = ''
  recus = 0
  envoyes = 0
  surEtat: ((etat: EtatLiaison) => void) | null = null
  surFlux: ((octets: Uint8Array) => void) | null = null
  surOrdre: ((ordre: Ordre) => void) | null = null
  /** Le relais nous a installés (au moins une fois). */
  surInstalle: ((seul: boolean) => void) | null = null
  /** L'autre joueur est là / n'est plus là, vu du relais. */
  surPaire: ((ensemble: boolean) => void) | null = null
  private ws: WebSocket | null = null
  private voulueFermee = false
  private retour = 0
  private abandon = 0
  private delaiRetour = 300
  // LE CARNET DE BORD : le relais est en ligne, l'environnement d'analyse ne
  // le joint pas. Ce que CE navigateur a vu est la seule trace d'une panne.
  private readonly ne = performance.now()
  private connexions = 0
  private readonly instances: string[] = []
  private coupures = 0
  private derniereCoupure = ''
  private ensemble = false

  constructor(
    private readonly adresse: string,
    readonly code: string,
    readonly role: Role,
  ) {
    this.connecte()
  }

  private connecte(): void {
    if (this.voulueFermee) return
    let ws: WebSocket
    try {
      ws = new WebSocket(`${this.adresse}?code=${this.code}&role=${this.role}`)
    } catch {
      this.finit('echec', 'Le relais est injoignable depuis ce navigateur.')
      return
    }
    this.ws = ws
    this.connexions++
    ws.binaryType = 'arraybuffer'
    ws.onmessage = (ev) => {
      if (ws !== this.ws) return
      if (ev.data instanceof ArrayBuffer) {
        this.recus += ev.data.byteLength
        this.surFlux?.(new Uint8Array(ev.data))
        return
      }
      if (typeof ev.data !== 'string') return
      let m: { r?: unknown; t?: unknown; instance?: unknown; seul?: unknown }
      try {
        m = JSON.parse(ev.data) as typeof m
      } catch {
        return
      }
      if (typeof m.r === 'string') this.duRelais(m.r, m)
      else if (typeof m.t === 'string') this.surOrdre?.(m as unknown as Ordre)
    }
    ws.onclose = (ev) => {
      if (ws !== this.ws) return
      this.ws = null
      if (this.voulueFermee) return
      this.coupures++
      this.derniereCoupure = `code ${ev.code}${ev.wasClean ? '' : ' (coupure sèche)'}${ev.reason ? ' « ' + ev.reason.slice(0, 60) + ' »' : ''} à ${Math.round(performance.now() - this.ne)} ms`
      // des refus motivés : revenir ne changerait rien
      if (ev.code === 4409) return this.finit(this.etat === 'ouverte' ? 'coupee' : 'echec', 'Quelqu’un d’autre a pris cette place dans la partie.')
      if (ev.code === 4400) return this.finit('echec', 'Le relais a refusé ce code.')
      if (ev.code === 4503) return this.finit('echec', 'Le relais est plein. Réessayez dans un instant.')
      // tout le reste — durée maximale de la fonction, réseau qui hoquette —
      // se soigne en revenant
      this.ensemble = false
      this.armeAbandon('Le relais ne répond plus : la connexion est tombée et n’a pas pu être rouverte.')
      this.retour = window.setTimeout(() => this.connecte(), this.delaiRetour)
      this.delaiRetour = Math.min(this.delaiRetour * 2, 3000)
    }
    // une erreur est toujours suivie d'une fermeture : c'est elle qui décide
    ws.onerror = () => {}
  }

  private duRelais(genre: string, m: { instance?: unknown; seul?: unknown }): void {
    if (genre === 'salut') {
      this.delaiRetour = 300
      if (typeof m.instance === 'string' && !this.instances.includes(m.instance)) this.instances.push(m.instance)
      const seul = m.seul === true
      this.surInstalle?.(seul)
      // seul dans le salon alors que la partie jouait : l'autre est peut-être
      // en train de revenir lui aussi — on lui laisse le temps
      if (seul && this.etat === 'ouverte') this.armeAbandon('L’autre joueur n’est pas revenu dans la partie.')
      else if (!seul || this.etat !== 'ouverte') this.desarmeAbandon()
    } else if (genre === 'pair') {
      this.ensemble = true
      this.desarmeAbandon()
      this.surPaire?.(true)
      this.passe('ouverte')
    } else if (genre === 'seul') {
      this.ensemble = false
      this.surPaire?.(false)
      if (this.etat === 'ouverte') this.armeAbandon('L’autre joueur a quitté la partie, ou sa connexion est tombée.')
    }
  }

  private armeAbandon(raison: string): void {
    if (this.abandon) return
    this.abandon = window.setTimeout(() => {
      this.abandon = 0
      this.finit(this.etat === 'ouverte' ? 'coupee' : 'echec', raison)
    }, DELAI_ABANDON_MS)
  }

  private desarmeAbandon(): void {
    window.clearTimeout(this.abandon)
    this.abandon = 0
  }

  private passe(etat: EtatLiaison): void {
    if (etat === this.etat) return
    this.etat = etat
    this.surEtat?.(etat)
  }

  /** La liaison est finie : on le dit une fois, et on ne revient plus. */
  private finit(etat: 'coupee' | 'echec', raison: string): void {
    if (this.etat === 'coupee' || this.etat === 'echec') return
    this.raison = raison
    this.voulueFermee = true
    window.clearTimeout(this.retour)
    this.desarmeAbandon()
    try {
      this.ws?.close()
    } catch {
      // déjà fermée
    }
    this.ws = null
    this.passe(etat)
  }

  /** L'échec décidé du dehors (le relais ne nous a jamais installés). */
  echoue(raison: string): void {
    this.finit('echec', raison)
  }

  get engorgee(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN && this.ws.bufferedAmount > FILE_ENGORGEE_OCTETS
  }

  envoieFlux(octets: Uint8Array): boolean {
    const ws = this.ws
    if (!ws || ws.readyState !== WebSocket.OPEN || !this.ensemble) return false
    if (ws.bufferedAmount > FILE_MAX_OCTETS) return false
    try {
      // une copie à soi : send() refuse la vue d'un tampon partagé
      const propre = new Uint8Array(octets.byteLength)
      propre.set(octets)
      ws.send(propre.buffer)
      this.envoyes += octets.byteLength
      return true
    } catch {
      return false
    }
  }

  envoieOrdre(ordre: Ordre): void {
    const ws = this.ws
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    try {
      ws.send(JSON.stringify(ordre))
    } catch {
      // la connexion vient de tomber : la fermeture le dira
    }
  }

  ferme(): void {
    if (this.voulueFermee) return
    this.envoieOrdre({ t: 'adieu' })
    this.voulueFermee = true
    window.clearTimeout(this.retour)
    this.desarmeAbandon()
    try {
      this.ws?.close()
    } catch {
      // déjà fermée
    }
    this.ws = null
    // une liaison qu'on ferme soi-même ne « tombe » pas : rien à annoncer
    if (this.etat === 'ouverte') this.etat = 'coupee'
  }

  diagnostic(): string {
    let hote = this.adresse
    try {
      hote = new URL(this.adresse).host
    } catch {
      // adresse illisible : on la montre telle quelle
    }
    const morceaux = [`relais ${hote}`, `rôle ${this.role}`, `connexions ${this.connexions}`]
    morceaux.push(this.instances.length ? `instance(s) vue(s) : ${this.instances.join(', ')}` : 'jamais installé par le relais')
    if (this.coupures) morceaux.push(`coupures ${this.coupures} (dernière : ${this.derniereCoupure})`)
    return morceaux.join(' · ')
  }
}

/** Ce navigateur sait-il ouvrir la connexion ? */
export function liaisonPossible(): boolean {
  return typeof WebSocket === 'function'
}

/** Une partie CRÉÉE, qui attend son invité. La liaison est déjà là : elle
 *  s'ouvre d'elle-même quand l'ami arrive. */
export interface Accueil {
  readonly code: string
  readonly liaison: Liaison
}

export type Creation = { ok: true; accueil: Accueil } | { ok: false; raison: string; detail: string }

/** CRÉER : prend place au relais sous un code neuf, et attend. Rien ne
 *  presse — l'ami rejoint quand il veut. (Deux hôtes qui tireraient le même
 *  code se chasseraient l'un l'autre : une chance sur trente-trois millions
 *  par partie en cours, admise pour un prototype.) */
export function creePartie(adresse: string): Promise<Creation> {
  const code = tireCode()
  const l = new LiaisonRelais(adresse, code, 'hote')
  return new Promise((rend) => {
    let fini = false
    const minuteur = window.setTimeout(() => {
      if (fini) return
      l.echoue('Le relais ne répond pas. Vérifiez la connexion, puis réessayez dans un instant.')
    }, DELAI_INSTALLATION_MS)
    l.surInstalle = () => {
      if (fini) return
      fini = true
      window.clearTimeout(minuteur)
      l.surEtat = null
      rend({ ok: true, accueil: { code, liaison: l } })
    }
    l.surEtat = (etat) => {
      if (fini || (etat !== 'echec' && etat !== 'coupee')) return
      fini = true
      window.clearTimeout(minuteur)
      rend({ ok: false, raison: l.raison || 'Le relais est injoignable.', detail: l.diagnostic() })
    }
  })
}

export type Jonction = { ok: true; liaison: Liaison } | { ok: false; raison: string; detail: string }

/** Le temps laissé à l'hôte pour paraître dans le salon avant de chercher
 *  ailleurs : il est peut-être en train de revenir d'une coupure. */
const ATTENTE_HOTE_MS = 2000
/** Combien de fois on frappe au relais avant de conclure que le code est
 *  faux. Si le relais tournait sur plusieurs instances, l'hôte pourrait être
 *  sur une autre que celle qui nous a reçus : chaque essai est une
 *  connexion neuve, et le détail dit sur quelles instances on est tombé. */
const ESSAIS_JONCTION = 3

/** REJOINDRE : prend place dans le salon de ce code et attend que le relais
 *  nous dise que l'hôte y est. */
export async function rejointPartie(adresse: string, code: string): Promise<Jonction> {
  const details: string[] = []
  for (let essai = 1; essai <= ESSAIS_JONCTION; essai++) {
    const l = new LiaisonRelais(adresse, code, 'invite')
    const issue = await new Promise<'ensemble' | 'personne' | 'panne'>((rend) => {
      let fini = false
      let attente = 0
      const conclut = (i: 'ensemble' | 'personne' | 'panne'): void => {
        if (fini) return
        fini = true
        window.clearTimeout(minuteur)
        window.clearTimeout(attente)
        rend(i)
      }
      const minuteur = window.setTimeout(() => conclut('panne'), DELAI_INSTALLATION_MS)
      l.surInstalle = (seul) => {
        if (seul && !attente) attente = window.setTimeout(() => conclut('personne'), ATTENTE_HOTE_MS)
      }
      l.surPaire = (ensemble) => {
        if (ensemble) conclut('ensemble')
      }
      l.surEtat = (etat) => {
        if (etat === 'ouverte') conclut('ensemble')
        else if (etat === 'echec' || etat === 'coupee') conclut('panne')
      }
    })
    if (issue === 'ensemble') {
      l.surInstalle = null
      l.surPaire = null
      l.surEtat = null
      return { ok: true, liaison: l }
    }
    details.push(`essai ${essai} : ${issue === 'personne' ? 'salon vide' : 'relais muet'} · ${l.diagnostic()}`)
    const raison = l.raison
    l.ferme()
    if (issue === 'panne') {
      return { ok: false, raison: raison || 'Le relais ne répond pas. Vérifiez la connexion, puis réessayez dans un instant.', detail: details.join(' | ') }
    }
  }
  return {
    ok: false,
    raison: 'Aucune partie n’attend sous ce code. Vérifiez-le auprès de votre ami : sa page « Créer une partie » doit rester ouverte.',
    detail: details.join(' | '),
  }
}
