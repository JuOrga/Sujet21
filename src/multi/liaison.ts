// LA LIAISON — le tuyau direct entre deux navigateurs (WebRTC).
//
// Pas de serveur de jeu : les deux navigateurs se parlent en direct, d'une
// maison à l'autre. Le seul tiers est un serveur STUN public, interrogé une
// fois au départ : il dit à chaque navigateur sous quelle adresse sa box le
// montre au monde. Sans cette adresse, l'autre ne saurait pas où frapper.
// Aucune donnée de jeu ne passe par lui.
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

import { faitCode, litCode } from './invitation'

/** Les serveurs STUN publics interrogés au départ. Deux, chez deux
 *  hébergeurs : si l'un est muet, l'autre répond. */
const SERVEURS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
]
/** Le temps laissé au navigateur pour recenser ses adresses avant de faire
 *  le code. Passé ce délai on prend ce qu'on a : un STUN muet ne doit pas
 *  bloquer la création de la partie. */
const DELAI_RECENSEMENT_MS = 4000
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

  /** Attend que le navigateur ait recensé ses adresses, puis rend sa
   *  description complète — adresses comprises : le code se suffit. */
  async descriptionComplete(): Promise<string> {
    if (this.pc.iceGatheringState !== 'complete') {
      await new Promise<void>((fini) => {
        const minuteur = window.setTimeout(fini, DELAI_RECENSEMENT_MS)
        this.pc.addEventListener('icegatheringstatechange', () => {
          if (this.pc.iceGatheringState === 'complete') {
            window.clearTimeout(minuteur)
            fini()
          }
        })
      })
    }
    return this.pc.localDescription?.sdp ?? ''
  }
}

/** Ce navigateur sait-il ouvrir une liaison ? (Les très vieux, et certains
 *  navigateurs embarqués, non.) */
export function liaisonPossible(): boolean {
  return typeof RTCPeerConnection === 'function' && typeof CompressionStream === 'function'
}

export type Resultat = { ok: true } | { ok: false; raison: string }

export interface Invitation {
  /** Le code à envoyer à l'ami. */
  code: string
  liaison: Liaison
  /** Donne à la liaison la réponse de l'ami. */
  repond(codeReponse: string): Promise<Resultat>
}

/** CRÉER : prépare la liaison et rend le code d'invitation. */
export async function creeInvitation(): Promise<Invitation> {
  const l = new LiaisonRTC()
  await l.pc.setLocalDescription(await l.pc.createOffer())
  const code = await faitCode('invitation', await l.descriptionComplete())
  let repondu = false
  return {
    code,
    liaison: l,
    async repond(codeReponse: string): Promise<Resultat> {
      if (repondu) return { ok: false, raison: 'La réponse a déjà été donnée : la liaison s’établit.' }
      const lu = await litCode('reponse', codeReponse)
      if (!lu.ok) return lu
      try {
        await l.pc.setRemoteDescription({ type: 'answer', sdp: lu.description })
      } catch {
        return { ok: false, raison: 'Ce code de réponse ne correspond pas à cette invitation. Votre ami doit rejoindre avec le code affiché ici.' }
      }
      repondu = true
      return { ok: true }
    },
  }
}

export type Jonction = { ok: true; code: string; liaison: Liaison } | { ok: false; raison: string }

/** REJOINDRE : lit l'invitation, prépare la liaison et rend le code de
 *  réponse à renvoyer. */
export async function rejoint(codeInvitation: string): Promise<Jonction> {
  const lu = await litCode('invitation', codeInvitation)
  if (!lu.ok) return lu
  const l = new LiaisonRTC()
  try {
    await l.pc.setRemoteDescription({ type: 'offer', sdp: lu.description })
    await l.pc.setLocalDescription(await l.pc.createAnswer())
  } catch {
    l.ferme()
    return { ok: false, raison: 'Ce code d’invitation n’est pas lisible par ce navigateur. Demandez-en un nouveau.' }
  }
  const code = await faitCode('reponse', await l.descriptionComplete())
  return { ok: true, code, liaison: l }
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
