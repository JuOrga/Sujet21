// LES TRAMES DU MULTI — ce qui voyage entre l'hôte et l'invité.
//
// L'HÔTE SIMULE, L'INVITÉ AFFICHE. Ce n'est pas un choix de confort :
// game/fantome.ts le note, rejouer les mêmes gestes sur une autre machine
// donne un autre film au bout de quelques secondes (le dernier bit des
// puissances et des sinus varie d'un navigateur à l'autre, et les contacts
// amplifient tout). Deux machines qui simuleraient chacune de leur côté
// ne verraient donc pas la même partie. Une seule simule ; elle envoie ce
// qu'elle voit, l'autre n'envoie que sa commande.
//
// DEUX TRAMES, toutes deux binaires, petit-boutistes :
//  - L'ÉTAT (hôte → invité, ~30 fois par seconde) : les particules, six
//    octets chacune, et l'état de chaque corps ;
//  - LA COMMANDE (invité → hôte, ~60 fois par seconde) : où il vise, s'il
//    pousse.
//
// Elles partent sur un canal SANS REPRISE : une trame perdue n'est pas
// renvoyée, la suivante la remplace. Renvoyer une image vieille de 100 ms
// ne sert à rien, et la reprise bloquerait les images fraîches derrière
// elle. D'où le numéro de séquence dans chaque trame : on jette ce qui
// arrive en retard.
//
// Ce module est PUR : ni réseau, ni DOM, ni solveur — tout se teste.

export const TRAME_ETAT = 1
export const TRAME_COMMANDE = 2
/** La version du format : l'invité refuse une trame d'une autre version
 *  plutôt que de dessiner n'importe quoi. */
export const VERSION_TRAME = 2

/** Les particules par morceau d'état. Un canal de données porte au moins
 *  16 Ko par message sur tous les navigateurs ; 1 024 particules à six
 *  octets en font 6 Ko : on reste loin sous la limite, et une image de
 *  1 800 particules part en deux morceaux. */
export const PARTICULES_PAR_MORCEAU = 1024
export const OCTETS_PAR_PARTICULE = 6
/** L'échelle des vitesses : un octet signé couvre ±VITESSE_MAX. Elles ne
 *  servent qu'à prolonger le mouvement entre deux images (≈ 33 ms) : à
 *  24 u/s de résolution, l'erreur ne dépasse pas une unité. */
export const VITESSE_MAX = 3000

// ---- les attributs d'une particule, sur un octet --------------------------
/** bits 0-1 : le propriétaire (0 à 3) */
export const ATTR_PROPRIO = 0b0000_0011
/** bit 2 : du CORPS (sinon goutte libre) */
export const ATTR_CORPS = 0b0000_0100
/** bit 3 : à PERSONNE (le propriétaire ne veut alors rien dire) */
export const ATTR_ORPHELINE = 0b0000_1000
/** bits 4-5 : la marque d'égarement (0 · 1 perdue · 2 encore dans le halo) */
export const ATTR_MARQUE = 0b0011_0000
export const DECALAGE_MARQUE = 4

export function attributs(proprio: number, corps: boolean, marque: number): number {
  const orpheline = proprio > 3
  return (
    (orpheline ? ATTR_ORPHELINE : proprio & ATTR_PROPRIO) |
    (corps ? ATTR_CORPS : 0) |
    ((marque & 3) << DECALAGE_MARQUE)
  )
}

/** Les bornes de la salle : la position d'une particule voyage en douze
 *  bits par axe, rapportée à elles. */
export interface Bornes {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** L'état d'un corps tel qu'il voyage : de quoi dessiner sa jauge. */
export interface CorpsTrame {
  /** particules du corps */
  compte: number
  /** gouttes à lui encore dans son halo (elles comptent dans sa vie) */
  prets: number
  /** son volume de départ, en particules */
  base: number
  x: number
  y: number
  disperse: boolean
  /** il pousse en ce moment (l'autre le voit viser) */
  pousse: boolean
  /** il est OUVERT : il accepte la matière des autres (fusion, don) */
  ouvert: boolean
  viseeX: number
  viseeY: number
}

/** Une vue sur des particules, telle que le rendu la lit — celle de l'hôte
 *  vient du solveur, celle de l'invité des trames. */
export interface Particules {
  n: number
  x: Float32Array
  y: Float32Array
  vx: Float32Array
  vy: Float32Array
  attr: Uint8Array
}

export function particulesVides(capacite: number): Particules {
  return {
    n: 0,
    x: new Float32Array(capacite),
    y: new Float32Array(capacite),
    vx: new Float32Array(capacite),
    vy: new Float32Array(capacite),
    attr: new Uint8Array(capacite),
  }
}

const OCTETS_CORPS = 18
const ENTETE_FIXE = 16

function borne(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

/** Encode UNE image en morceaux. Chaque morceau se suffit : il porte le
 *  numéro de l'image, le total de particules, sa tranche, et l'état de tous
 *  les corps (répété : c'est 18 octets par corps, et un morceau perdu ne
 *  prive pas l'invité des jauges). */
export function encodeEtat(
  seq: number,
  tSim: number,
  bornes: Bornes,
  corps: readonly CorpsTrame[],
  p: Particules,
): Uint8Array[] {
  const morceaux: Uint8Array[] = []
  const largeur = bornes.maxX - bornes.minX
  const hauteur = bornes.maxY - bornes.minY
  const entete = ENTETE_FIXE + corps.length * OCTETS_CORPS
  const nbMorceaux = Math.max(1, Math.ceil(p.n / PARTICULES_PAR_MORCEAU))
  for (let m = 0; m < nbMorceaux; m++) {
    const debut = m * PARTICULES_PAR_MORCEAU
    const nombre = Math.min(PARTICULES_PAR_MORCEAU, p.n - debut)
    const octets = new Uint8Array(entete + nombre * OCTETS_PAR_PARTICULE)
    const v = new DataView(octets.buffer)
    v.setUint8(0, TRAME_ETAT)
    v.setUint8(1, VERSION_TRAME)
    v.setUint8(2, corps.length)
    v.setUint8(3, 0)
    v.setUint32(4, seq, true)
    v.setFloat32(8, tSim, true)
    v.setUint16(12, p.n, true)
    v.setUint16(14, debut, true)
    let o = ENTETE_FIXE
    for (const c of corps) {
      v.setUint16(o, c.compte, true)
      v.setUint16(o + 2, c.prets, true)
      v.setUint16(o + 4, c.base, true)
      v.setFloat32(o + 6, c.x, true)
      v.setFloat32(o + 10, c.y, true)
      v.setUint8(o + 14, (c.disperse ? 1 : 0) | (c.pousse ? 2 : 0) | (c.ouvert ? 4 : 0))
      // la visée voyage en 12 bits par axe, comme une particule
      const qx = Math.round(borne((c.viseeX - bornes.minX) / largeur, 0, 1) * 4095)
      const qy = Math.round(borne((c.viseeY - bornes.minY) / hauteur, 0, 1) * 4095)
      v.setUint8(o + 15, qx & 0xff)
      v.setUint8(o + 16, ((qx >> 8) & 0x0f) | ((qy & 0x0f) << 4))
      v.setUint8(o + 17, (qy >> 4) & 0xff)
      o += OCTETS_CORPS
    }
    for (let k = 0; k < nombre; k++) {
      const i = debut + k
      const qx = Math.round(borne((p.x[i] - bornes.minX) / largeur, 0, 1) * 4095)
      const qy = Math.round(borne((p.y[i] - bornes.minY) / hauteur, 0, 1) * 4095)
      octets[o] = qx & 0xff
      octets[o + 1] = ((qx >> 8) & 0x0f) | ((qy & 0x0f) << 4)
      octets[o + 2] = (qy >> 4) & 0xff
      v.setInt8(o + 3, Math.round(borne(p.vx[i] / VITESSE_MAX, -1, 1) * 127))
      v.setInt8(o + 4, Math.round(borne(p.vy[i] / VITESSE_MAX, -1, 1) * 127))
      octets[o + 5] = p.attr[i]
      o += OCTETS_PAR_PARTICULE
    }
    morceaux.push(octets)
  }
  return morceaux
}

/** Ce qu'on lit d'un morceau avant de décider quoi en faire. */
export interface EnteteEtat {
  seq: number
  tSim: number
  total: number
  debut: number
  nombre: number
  corps: CorpsTrame[]
}

/** Lit l'en-tête d'un morceau d'état, ou null si ce n'en est pas un (autre
 *  type, autre version, trame tronquée). Ne jette jamais : ce qui arrive du
 *  réseau n'a pas à faire tomber la boucle d'image. */
export function litEnteteEtat(octets: Uint8Array, bornes: Bornes): EnteteEtat | null {
  if (octets.length < ENTETE_FIXE) return null
  const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength)
  if (v.getUint8(0) !== TRAME_ETAT || v.getUint8(1) !== VERSION_TRAME) return null
  const nbCorps = v.getUint8(2)
  const entete = ENTETE_FIXE + nbCorps * OCTETS_CORPS
  if (octets.length < entete) return null
  const reste = octets.length - entete
  if (reste % OCTETS_PAR_PARTICULE !== 0) return null
  const total = v.getUint16(12, true)
  const debut = v.getUint16(14, true)
  const nombre = reste / OCTETS_PAR_PARTICULE
  if (debut + nombre > total) return null
  const largeur = bornes.maxX - bornes.minX
  const hauteur = bornes.maxY - bornes.minY
  const corps: CorpsTrame[] = []
  let o = ENTETE_FIXE
  for (let j = 0; j < nbCorps; j++) {
    const drapeaux = v.getUint8(o + 14)
    const b0 = v.getUint8(o + 15)
    const b1 = v.getUint8(o + 16)
    const b2 = v.getUint8(o + 17)
    corps.push({
      compte: v.getUint16(o, true),
      prets: v.getUint16(o + 2, true),
      base: v.getUint16(o + 4, true),
      x: v.getFloat32(o + 6, true),
      y: v.getFloat32(o + 10, true),
      disperse: (drapeaux & 1) !== 0,
      pousse: (drapeaux & 2) !== 0,
      ouvert: (drapeaux & 4) !== 0,
      viseeX: bornes.minX + ((b0 | ((b1 & 0x0f) << 8)) / 4095) * largeur,
      viseeY: bornes.minY + (((b1 >> 4) | (b2 << 4)) / 4095) * hauteur,
    })
    o += OCTETS_CORPS
  }
  return { seq: v.getUint32(4, true), tSim: v.getFloat32(8, true), total, debut, nombre, corps }
}

/** Pose les particules d'un morceau dans `vers`, à leur tranche. L'en-tête
 *  doit venir de litEnteteEtat sur CES octets. */
export function decodeParticules(octets: Uint8Array, e: EnteteEtat, bornes: Bornes, vers: Particules): void {
  const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength)
  const largeur = bornes.maxX - bornes.minX
  const hauteur = bornes.maxY - bornes.minY
  let o = octets.length - e.nombre * OCTETS_PAR_PARTICULE
  const fin = Math.min(e.debut + e.nombre, vers.x.length)
  for (let i = e.debut; i < fin; i++) {
    const b0 = octets[o]
    const b1 = octets[o + 1]
    const b2 = octets[o + 2]
    vers.x[i] = bornes.minX + ((b0 | ((b1 & 0x0f) << 8)) / 4095) * largeur
    vers.y[i] = bornes.minY + (((b1 >> 4) | (b2 << 4)) / 4095) * hauteur
    vers.vx[i] = (v.getInt8(o + 3) / 127) * VITESSE_MAX
    vers.vy[i] = (v.getInt8(o + 4) / 127) * VITESSE_MAX
    vers.attr[i] = octets[o + 5]
    o += OCTETS_PAR_PARTICULE
  }
}

// ---- la commande ----------------------------------------------------------

export interface Commande {
  /** le joueur maintient la poussée */
  pousse: boolean
  /** le joueur se tient OUVERT (il accepte la matière des autres) */
  ouvert: boolean
  /** le point visé, en unités monde */
  x: number
  y: number
}

export const COMMANDE_NEUTRE: Commande = { pousse: false, ouvert: false, x: 0, y: 0 }

export function encodeCommande(seq: number, c: Commande): Uint8Array {
  const octets = new Uint8Array(15)
  const v = new DataView(octets.buffer)
  v.setUint8(0, TRAME_COMMANDE)
  v.setUint8(1, VERSION_TRAME)
  v.setUint32(2, seq, true)
  v.setUint8(6, (c.pousse ? 1 : 0) | (c.ouvert ? 2 : 0))
  v.setFloat32(7, c.x, true)
  v.setFloat32(11, c.y, true)
  return octets
}

export function decodeCommande(octets: Uint8Array): { seq: number; commande: Commande } | null {
  if (octets.length !== 15) return null
  const v = new DataView(octets.buffer, octets.byteOffset, octets.byteLength)
  if (v.getUint8(0) !== TRAME_COMMANDE || v.getUint8(1) !== VERSION_TRAME) return null
  const x = v.getFloat32(7, true)
  const y = v.getFloat32(11, true)
  // un nombre qui n'en est pas un ne doit pas entrer dans le solveur
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  const drapeaux = v.getUint8(6)
  return { seq: v.getUint32(2, true), commande: { pousse: (drapeaux & 1) !== 0, ouvert: (drapeaux & 2) !== 0, x, y } }
}
