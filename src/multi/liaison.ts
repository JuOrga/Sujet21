// LA LIAISON — le tuyau direct entre deux navigateurs (WebRTC).
//
// Pas de serveur de jeu : les deux navigateurs se parlent en direct, d'une
// maison à l'autre. Deux tiers servent à la MISE EN RELATION, et à elle
// seule — aucune donnée de jeu ne passe par eux :
//  - un serveur STUN public, qui dit à chaque navigateur sous quelle
//    adresse sa box le montre au monde (sans elle, l'autre ne saurait pas
//    où frapper) ;
//  - l'annuaire (annuaire.ts), par qui les deux navigateurs s'échangent
//    leurs descriptions et leurs adresses, au fil de l'eau.
//
// CE QUI PEUT ÉCHOUER, et qu'on ne peut pas savoir d'avance : certaines box
// (et beaucoup de réseaux mobiles ou d'entreprise) n'acceptent pas qu'on
// frappe à leur porte, même invitées. La liaison directe est alors
// impossible et il faudrait un RELAIS (un serveur TURN, payant au débit) —
// il n'y en a pas ici. L'écran le dit en clair plutôt que d'attendre sans
// fin.
//
// DEUX CANAUX sur la même liaison :
//  - `flux` : sans reprise ni ordre, pour les images et les commandes — une
//    trame perdue est remplacée par la suivante (voir trame.ts) ;
//  - `ordres` : fiable et ordonné, en JSON, pour ce qui ne doit pas se
//    perdre (la poignée de main, « recommence », le pouls).

import { Annuaire, nomDePartie, tireCode } from './annuaire'

/** Les serveurs STUN publics interrogés au départ. Deux, chez deux
 *  hébergeurs : si l'un est muet, l'autre répond. */
const SERVEURS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
]
/** L'ENGORGEMENT. Quand la ligne de l'hôte ne suit pas (une image pèse
 *  ~11 Ko, trente par seconde), le navigateur met ce qui ne part pas en
 *  file. Empiler, c'est envoyer des images de plus en plus VIEILLES : la
 *  partie prend du retard et ne le rend jamais. Dès que la file dépasse
 *  deux images, l'hôte SAUTE la suivante (voir `engorgee`) : la cadence
 *  baisse d'elle-même jusqu'à ce que la ligne tienne, et ce qui arrive
 *  reste frais. */
const FILE_ENGORGEE_OCTETS = 24 * 1024
/** Le garde-fou dur : au-delà, plus rien ne part, quoi qu'on demande. */
const FILE_MAX_OCTETS = 256 * 1024

export type EtatLiaison = 'attente' | 'ouverte' | 'coupee' | 'echec'

export type Ordre =
  | { t: 'salut'; version: number }
  | { t: 'recommence' }
  | { t: 'pouls'; id: number }
  | { t: 'echo'; id: number }
  | { t: 'adieu' }

export interface Liaison {
  readonly etat: EtatLiaison
  /** Octets reçus et envoyés sur le flux depuis l'ouverture. */
  readonly recus: number
  readonly envoyes: number
  /** Ce que le recensement a trouvé : sert au diagnostic d'un échec. */
  readonly adresses: { locales: number; publiques: number }
  /** La file d'envoi déborde : l'image suivante est à sauter. */
  readonly engorgee: boolean
  surEtat: ((etat: EtatLiaison) => void) | null
  surFlux: ((octets: Uint8Array) => void) | null
  surOrdre: ((ordre: Ordre) => void) | null
  /** Envoie une trame. Rend false si elle a été sautée (tuyau fermé ou
   *  engorgé). */
  envoieFlux(octets: Uint8Array): boolean
  envoieOrdre(ordre: Ordre): void
  ferme(): void
}

class LiaisonRTC implements Liaison {
  etat: EtatLiaison = 'attente'
  recus = 0
  envoyes = 0
  adresses = { locales: 0, publiques: 0 }
  surEtat: ((etat: EtatLiaison) => void) | null = null
  surFlux: ((octets: Uint8Array) => void) | null = null
  surOrdre: ((ordre: Ordre) => void) | null = null
  readonly pc: RTCPeerConnection
  /** Chaque adresse que ce navigateur se découvre part aussitôt chez
   *  l'autre, par l'annuaire : la liaison n'attend pas la fin du
   *  recensement. */
  surCandidat: ((c: RTCIceCandidateInit) => void) | null = null
  private distantePosee = false
  private readonly candidatsEnAttente: RTCIceCandidateInit[] = []
  private readonly flux: RTCDataChannel
  private readonly ordres: RTCDataChannel

  constructor() {
    this.pc = new RTCPeerConnection({ iceServers: SERVEURS })
    // Canaux NÉGOCIÉS d'avance (mêmes numéros des deux côtés) : chacun crée
    // les siens, personne n'attend l'annonce de l'autre.
    this.flux = this.pc.createDataChannel('flux', { negotiated: true, id: 0, ordered: false, maxRetransmits: 0 })
    this.ordres = this.pc.createDataChannel('ordres', { negotiated: true, id: 1 })
    this.flux.binaryType = 'arraybuffer'
    this.flux.onmessage = (ev) => {
      if (!(ev.data instanceof ArrayBuffer)) return
      this.recus += ev.data.byteLength
      this.surFlux?.(new Uint8Array(ev.data))
    }
    this.ordres.onmessage = (ev) => {
      if (typeof ev.data !== 'string') return
      try {
        const o = JSON.parse(ev.data) as Ordre
        if (o && typeof o.t === 'string') this.surOrdre?.(o)
      } catch {
        // un ordre illisible n'est pas un ordre
      }
    }
    const juge = (): void => {
      if (this.etat === 'coupee' || this.etat === 'echec') return
      const deuxOuverts = this.flux.readyState === 'open' && this.ordres.readyState === 'open'
      if (deuxOuverts) this.passe('ouverte')
    }
    this.flux.onopen = juge
    this.ordres.onopen = juge
    this.flux.onclose = () => this.passe(this.etat === 'ouverte' ? 'coupee' : this.etat)
    this.pc.onicecandidate = (ev) => {
      const c = ev.candidate
      if (!c) return
      if (c.type === 'srflx') this.adresses.publiques++
      else if (c.type === 'host') this.adresses.locales++
      this.surCandidat?.(c.toJSON())
    }
    this.pc.onconnectionstatechange = () => {
      const s = this.pc.connectionState
      if (s === 'failed') this.passe(this.etat === 'ouverte' ? 'coupee' : 'echec')
      else if (s === 'closed') this.passe(this.etat === 'ouverte' ? 'coupee' : this.etat)
      // « disconnected » n'est pas une fin : le navigateur réessaie seul,
      // et une liaison qui hoquette revient souvent en une seconde
    }
  }

  get engorgee(): boolean {
    return this.flux.readyState === 'open' && this.flux.bufferedAmount > FILE_ENGORGEE_OCTETS
  }

  private passe(etat: EtatLiaison): void {
    if (etat === this.etat) return
    this.etat = etat
    this.surEtat?.(etat)
  }

  /** La préparation a échoué avant même de frapper chez l'autre. */
  echoue(): void {
    this.passe(this.etat === 'attente' ? 'echec' : this.etat)
  }

  envoieFlux(octets: Uint8Array): boolean {
    if (this.flux.readyState !== 'open') return false
    if (this.flux.bufferedAmount > FILE_MAX_OCTETS) return false
    try {
      // une copie à soi : send() refuse la vue d'un tampon partagé
      const propre = new Uint8Array(octets.byteLength)
      propre.set(octets)
      this.flux.send(propre.buffer)
      this.envoyes += octets.byteLength
      return true
    } catch {
      return false
    }
  }

  envoieOrdre(ordre: Ordre): void {
    if (this.ordres.readyState !== 'open') return
    try {
      this.ordres.send(JSON.stringify(ordre))
    } catch {
      // le canal vient de se fermer : l'état le dira
    }
  }

  ferme(): void {
    this.envoieOrdre({ t: 'adieu' })
    this.passe(this.etat === 'ouverte' ? 'coupee' : this.etat)
    try {
      this.pc.close()
    } catch {
      // déjà fermée
    }
  }

  /** Pose la description de l'autre navigateur, puis les adresses qu'il
   *  avait déjà envoyées (elles peuvent arriver avant elle). */
  async poseDistante(d: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(d)
    this.distantePosee = true
    for (const c of this.candidatsEnAttente.splice(0)) this.ajouteCandidat(c)
  }

  /** Une adresse de l'autre navigateur, arrivée par l'annuaire. */
  ajouteCandidat(c: RTCIceCandidateInit): void {
    if (!this.distantePosee) {
      this.candidatsEnAttente.push(c)
      return
    }
    // une adresse inutilisable (famille réseau absente ici) n'est pas une
    // panne : les autres suffisent
    this.pc.addIceCandidate(c).catch(() => {})
  }
}

/** Ce navigateur sait-il ouvrir une liaison ? (Les très vieux, et certains
 *  navigateurs embarqués, non.) */
export function liaisonPossible(): boolean {
  return typeof RTCPeerConnection === 'function' && typeof WebSocket === 'function'
}

/** Ce qui voyage par l'annuaire : une description, ou une adresse. */
function estDescription(x: unknown): x is { sdp: string } {
  return typeof x === 'object' && x !== null && typeof (x as { sdp?: unknown }).sdp === 'string'
}
function estCandidat(x: unknown): x is RTCIceCandidateInit {
  return typeof x === 'object' && x !== null && typeof (x as { candidate?: unknown }).candidate === 'string'
}

/** Une partie CRÉÉE, qui attend son invité. */
export interface Accueil {
  /** Le code à donner à l'ami. */
  readonly code: string
  /** Un invité s'est présenté : voici la liaison qui s'établit avec lui. */
  surLiaison: ((l: Liaison) => void) | null
  /** L'annuaire est tombé avant qu'un invité n'arrive. */
  surPerdu: (() => void) | null
  ferme(): void
}

export type Creation = { ok: true; accueil: Accueil } | { ok: false; raison: string }

/** CRÉER : inscrit la partie à l'annuaire sous un code court, et attend.
 *  Rien ne presse : l'hôte peut laisser la page ouverte dix minutes, l'ami
 *  rejoint quand il veut. */
export async function creePartie(adresse: string): Promise<Creation> {
  // un code déjà pris (une chance sur trente millions) : on en tire un autre
  for (let essai = 0; essai < 5; essai++) {
    const code = tireCode()
    const r = await Annuaire.inscrit(adresse, nomDePartie(code))
    if (!r.ok) {
      if (r.pris) continue
      return { ok: false, raison: r.raison }
    }
    const annuaire = r.annuaire
    let enCours: LiaisonRTC | null = null
    let invite = ''
    const accueil: Accueil = {
      code,
      surLiaison: null,
      surPerdu: null,
      ferme: () => annuaire.ferme(),
    }
    annuaire.surFerme = () => {
      // l'annuaire tombé APRÈS l'ouverture de la liaison ne change rien
      if (!enCours || enCours.etat === 'attente') accueil.surPerdu?.()
    }
    annuaire.surMessage = (de, genre, charge) => {
      if (genre === 'OFFER' && estDescription(charge)) {
        // un invité à la fois : on n'en écoute un second que si la liaison
        // avec le premier a échoué (il peut alors réessayer sans que l'hôte
        // ait à recréer la partie)
        if (enCours && enCours.etat !== 'echec') return
        const l = new LiaisonRTC()
        enCours = l
        invite = de
        l.surCandidat = (c) => annuaire.envoie(de, 'CANDIDATE', c)
        // la liaison directe ouverte, l'annuaire ne sert plus : on raccroche
        l.pc.addEventListener('connectionstatechange', () => {
          if (l.pc.connectionState === 'connected') annuaire.ferme()
        })
        accueil.surLiaison?.(l)
        void (async () => {
          try {
            await l.poseDistante({ type: 'offer', sdp: charge.sdp })
            await l.pc.setLocalDescription(await l.pc.createAnswer())
            annuaire.envoie(de, 'ANSWER', { sdp: l.pc.localDescription?.sdp ?? '' })
          } catch {
            l.echoue()
          }
        })()
      } else if (genre === 'CANDIDATE' && de === invite && estCandidat(charge)) {
        enCours?.ajouteCandidat(charge)
      }
    }
    return { ok: true, accueil }
  }
  return { ok: false, raison: 'Aucun code libre n’a pu être tiré. Réessayez.' }
}

export type Jonction = { ok: true; liaison: Liaison } | { ok: false; raison: string }

/** Le temps laissé à l'hôte pour répondre par l'annuaire. L'annuaire rend
 *  lui-même le message au bout de cinq secondes si personne ne porte ce
 *  code ; ce délai-ci couvre le cas où il ne dirait rien. */
const DELAI_REPONSE_MS = 12_000

/** REJOINDRE : cherche la partie sous ce code et ouvre la liaison. */
export async function rejointPartie(adresse: string, code: string): Promise<Jonction> {
  const hote = nomDePartie(code)
  const r = await Annuaire.inscrit(adresse, 'sujet21-invite-' + Math.random().toString(36).slice(2, 12))
  if (!r.ok) return { ok: false, raison: r.raison }
  const annuaire = r.annuaire
  const l = new LiaisonRTC()
  l.surCandidat = (c) => annuaire.envoie(hote, 'CANDIDATE', c)
  l.pc.addEventListener('connectionstatechange', () => {
    const s = l.pc.connectionState
    if (s === 'connected' || s === 'failed' || s === 'closed') annuaire.ferme()
  })
  return new Promise<Jonction>((rend) => {
    let fini = false
    const conclut = (j: Jonction): void => {
      if (fini) return
      fini = true
      window.clearTimeout(minuteur)
      if (!j.ok) {
        annuaire.ferme()
        l.ferme()
      }
      rend(j)
    }
    const minuteur = window.setTimeout(
      () => conclut({ ok: false, raison: 'La partie ne répond pas. Vérifiez le code, et que votre ami a toujours la page « Créer une partie » ouverte.' }),
      DELAI_REPONSE_MS,
    )
    annuaire.surAbsent = (nom) => {
      if (nom === hote) conclut({ ok: false, raison: 'Aucune partie n’attend sous ce code. Vérifiez-le auprès de votre ami : sa page « Créer une partie » doit rester ouverte.' })
    }
    annuaire.surFerme = () => conclut({ ok: false, raison: 'L’annuaire a coupé la connexion. Réessayez dans un instant.' })
    annuaire.surMessage = (de, genre, charge) => {
      if (de !== hote) return
      if (genre === 'ANSWER' && estDescription(charge)) {
        l.poseDistante({ type: 'answer', sdp: charge.sdp }).then(
          () => conclut({ ok: true, liaison: l }),
          () => conclut({ ok: false, raison: 'La réponse de la partie n’est pas lisible par ce navigateur.' }),
        )
      } else if (genre === 'CANDIDATE' && estCandidat(charge)) {
        l.ajouteCandidat(charge)
      }
    }
    void (async () => {
      try {
        await l.pc.setLocalDescription(await l.pc.createOffer())
        annuaire.envoie(hote, 'OFFER', { sdp: l.pc.localDescription?.sdp ?? '' })
      } catch {
        conclut({ ok: false, raison: 'Ce navigateur n’a pas pu préparer la liaison.' })
      }
    })()
  })
}

/** Pourquoi la liaison n'a pas pu s'établir, en clair — ce que le
 *  recensement a vu oriente le diagnostic. */
export function expliqueEchec(l: Liaison): string {
  if (l.adresses.publiques === 0) {
    return (
      'Ce navigateur n’a pas pu connaître son adresse publique : un pare-feu ou le réseau bloque la découverte. ' +
      'Essayez un autre réseau, ou désactivez un VPN.'
    )
  }
  return (
    'Les deux box n’ont pas accepté la liaison directe. Cela arrive avec certains fournisseurs et sur les réseaux mobiles. ' +
    'Il faudrait un relais, que ce prototype n’a pas : dites-le, c’est une information utile.'
  )
}
