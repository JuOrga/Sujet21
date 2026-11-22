// LA PORTE BLINDÉE — le dessin des portes (level.portes) dans une toile 2D,
// le même en jeu (main.ts, drawMecanismes) et à l'éditeur.
//
// POURQUOI. La porte était une « barrière d'énergie » tracée au trait, en
// ROUGE : un aplat translucide barré de lignes. Le rouge est réservé à
// l'alerte des cinématiques (docs/charte-visuelle.md §3), aucun objet de la
// station n'est un hologramme (§1), et c'était le seul du tableau qui ne
// sortait pas de l'atelier. Le concepteur la voulait « comme le protocole
// porte de grange » (le verrouillage d'Avengers: Endgame : de lourds volets
// blindés qui scellent la salle) — et qu'elle SORTE DU SOL : « on voit
// vraiment la porte s'enfoncer dans le sol et ça libère le passage » (22/11).
// C'est désormais une DALLE D'ACIER ESCAMOTABLE, rendue dans Blender
// (tools/images/blender/porte_blindee.py) :
//   · close, elle est debout : son dessus au sommet des murs qu'elle relie,
//     et relief allumé, sa grande face tournée vers l'œil descend jusqu'au
//     sol (la bande de chevrons en haut, les panneaux dessous) ;
//   · elle s'ouvre en s'ENFONÇANT : le dessus redescend vers le sol, la face
//     rentre — accrochée par le haut, on en voit de moins en moins ;
//   · ouverte, il ne reste que les deux lèvres de la fente, au ras du sol, et
//     rien entre elles : le fluide qui passe dessus se voit.
//
// CE QUE LE SOLVEUR OPPOSE AU CORPS RESTE CE QU'ON VOIT, en plan : une porte
// qui se matérialise (rideau, éventail) lève exactement la part de
// portePolygone, le reste est encore dans le sol — elle se DÉPLIE depuis le
// sol le long de son front. Une porte d'un coup, elle, est pleine ou
// absente pour le solveur ; sa levée (`leve`) n'est qu'une image, brève
// (DUREE_LEVEE) : montante, elle arrête le corps dès qu'elle affleure, comme
// une paroi qui sort du sol arrête une flaque.
//
// Rien ici ne dépend du fichier : tant que l'atlas manque (pas encore
// chargé, réseau coupé), la porte se dessine au vecteur, dans les mêmes
// teintes.

import type { PorteDef } from '../game/level'
import { portePolygone, type Point } from '../game/porte'
import { facesTranche } from './reliefParois'

export const PORTE_BLINDEE_URL = '/assets/porte-blindee.webp'

/** Les pièces de l'atlas, en px — UN CONTRAT avec atlas_rects() de
 *  tools/images/blender/porte_blindee.py (vérifié par porteBlindee.spec.ts).
 *  La longueur est à l'horizontale ; dessus, bout et fente sont vus d'en
 *  haut (160 px = l'épaisseur), le flanc en élévation (280 px = un mur). */
export const PORTE_ATLAS = {
  dessus: { x: 4, y: 4, w: 320, h: 160 },
  bout: { x: 328, y: 4, w: 96, h: 160 },
  flanc: { x: 428, y: 4, w: 320, h: 280 },
  fente: { x: 752, y: 4, w: 320, h: 160 },
} as const
export const PORTE_ATLAS_TAILLE = { w: 1076, h: 288 } as const
// la lentille de la veilleuse, dans la pièce `bout` (px) — VEILLEUSE_X du script
const VEILLEUSE_X = 30

/** LA DURÉE D'UNE LEVÉE (s) d'une porte d'un coup, du sol au sommet : assez
 *  pour qu'on la voie sortir ou s'enfoncer, assez court pour que la porte
 *  qui s'ouvre (libre pour le solveur dès l'image où son canal tombe) ne
 *  laisse pas le corps la traverser longtemps à l'œil. */
export const DUREE_LEVEE = 0.4

/** La levée à l'image suivante : elle court vers `cible` (1 debout, 0 au ras
 *  du sol) à vitesse constante. */
export function leveeSuivante(leve: number, cible: number, dt: number): number {
  const pas = Math.max(0, dt) / DUREE_LEVEE
  return leve < cible ? Math.min(cible, leve + pas) : Math.max(cible, leve - pas)
}

/** La HAUTEUR montrée pour une levée : lente au départ, lente à l'arrivée —
 *  une dalle lourde démarre et se pose, elle ne claque pas. */
export function hauteurDeLevee(leve: number): number {
  const t = Math.min(1, Math.max(0, leve))
  return t * t * (3 - 2 * t)
}

/** LE REPÈRE DE LA DALLE : `o` + s·`es` + t·`et`, s le long de la porte
 *  (0..longueur), t en travers (0..epaisseur), orienté comme l'image — t
 *  croît vers le BAS de l'atlas. Couchée, le haut de l'image regarde le haut
 *  de l'écran (la lumière de l'atelier tombe d'en haut, comme sur le sas) ;
 *  debout, l'image tourne d'un quart de tour, sa tête à gauche. */
export function cadrePorte(p: PorteDef): {
  o: Point
  es: Point
  et: Point
  longueur: number
  epaisseur: number
  couchee: boolean
} {
  const lx = p.maxX - p.minX
  const ly = p.maxY - p.minY
  const couchee = lx >= ly
  return couchee
    ? { o: { x: p.minX, y: p.maxY }, es: { x: 1, y: 0 }, et: { x: 0, y: -1 }, longueur: lx, epaisseur: ly, couchee }
    : { o: { x: p.minX, y: p.minY }, es: { x: 0, y: 1 }, et: { x: 1, y: 0 }, longueur: ly, epaisseur: lx, couchee }
}

/** LE DÉCOUPAGE le long de la dalle : un sabot `bout` à chaque extrémité
 *  (0,6 épaisseur, comme dans l'atlas ; jamais plus du quart d'une porte
 *  courte), et entre eux `n` carreaux entiers de longueur `carreau` — près
 *  de deux épaisseurs, comme dans l'atlas, étirés juste ce qu'il faut pour
 *  que la dernière plaque finisse au sabot. */
export function decoupePorte(longueur: number, epaisseur: number): { bout: number; n: number; carreau: number } {
  const bout = Math.max(0, Math.min((epaisseur * PORTE_ATLAS.bout.w) / PORTE_ATLAS.bout.h, longueur / 4))
  const reste = Math.max(0, longueur - 2 * bout)
  const n = Math.max(1, Math.round(reste / (epaisseur * (PORTE_ATLAS.dessus.w / PORTE_ATLAS.dessus.h))))
  return { bout, n, carreau: reste > 0 ? reste / n : epaisseur * 2 }
}

/** CE QUI EST DEBOUT, et à quelle hauteur : le polygone levé (monde) et sa
 *  hauteur montrée, 0..1. Rideau et éventail lèvent la part matérialisée,
 *  pleine hauteur ; une porte d'un coup lève tout son rectangle, à la
 *  hauteur de sa levée. `close` : plus rien n'est dans le sol. */
export function partLevee(
  p: PorteDef,
  avance: number,
  leve: number,
): { contour: Point[]; front: Point[]; hauteur: number; close: boolean } {
  if (p.materialisation) {
    const { contour, front } = portePolygone(p, avance)
    return { contour, front, hauteur: contour.length >= 3 ? 1 : 0, close: avance >= 1 }
  }
  const hauteur = hauteurDeLevee(leve)
  return { contour: hauteur > 0 ? coins(p) : [], front: [], hauteur, close: leve >= 1 }
}

export type VersEcran = (x: number, y: number) => { sx: number; sy: number }

export interface VuePorte {
  /** le sommet des murs à l'écran : le dessus d'une porte levée */
  sommet: VersEcran
  /** le sol à l'écran : la fente, et le pied de la face */
  pied: VersEcran
  /** relief allumé : le point du monde sous l'œil (la caméra) — la face se
   *  peint, tournée vers lui (facesTranche) ; null : à plat */
  oeil: Point | null
  /** l'horloge (s), pour les veilleuses */
  temps: number
}

type Pieces = { dessus: HTMLCanvasElement; bout: HTMLCanvasElement; flanc: HTMLCanvasElement; fente: HTMLCanvasElement }
const piecesParImage = new WeakMap<HTMLImageElement, Pieces>()

/** Chaque pièce dans sa toile, recopiée à l'échelle 1 : un motif répété se
 *  prend sur une image entière (pas sur un morceau d'atlas), et rien ne bave
 *  d'une pièce voisine au filtrage. */
function pieces(img: HTMLImageElement): Pieces | null {
  const connu = piecesParImage.get(img)
  if (connu) return connu
  if (typeof document === 'undefined') return null
  const k = img.naturalWidth / PORTE_ATLAS_TAILLE.w
  const coupe = (r: { x: number; y: number; w: number; h: number }): HTMLCanvasElement => {
    const c = document.createElement('canvas')
    c.width = r.w
    c.height = r.h
    c.getContext('2d')?.drawImage(img, r.x * k, r.y * k, r.w * k, r.h * k, 0, 0, r.w, r.h)
    return c
  }
  const p = {
    dessus: coupe(PORTE_ATLAS.dessus),
    bout: coupe(PORTE_ATLAS.bout),
    flanc: coupe(PORTE_ATLAS.flanc),
    fente: coupe(PORTE_ATLAS.fente),
  }
  piecesParImage.set(img, p)
  return p
}

// un motif appartient à SA toile : un par contexte et par pièce
const motifs = new WeakMap<CanvasRenderingContext2D, Map<HTMLCanvasElement, CanvasPattern | null>>()
function motif(g: CanvasRenderingContext2D, c: HTMLCanvasElement): CanvasPattern | null {
  let m = motifs.get(g)
  if (!m) {
    m = new Map()
    motifs.set(g, m)
  }
  if (!m.has(c)) m.set(c, g.createPattern(c, 'repeat'))
  return m.get(c) ?? null
}

/** Le repère de la dalle posé dans la toile : après lui, on dessine en
 *  unités (s, t) — la projection à l'écran est affine (la caméra, et
 *  l'homothétie du relief autour du centre), trois points la fixent. */
function poseRepere(g: CanvasRenderingContext2D, vers: VersEcran, o: Point, es: Point, et: Point, ls: number, lt: number): void {
  const p0 = vers(o.x, o.y)
  const ps = vers(o.x + es.x * ls, o.y + es.y * ls)
  const pt = vers(o.x + et.x * lt, o.y + et.y * lt)
  g.transform((ps.sx - p0.sx) / ls, (ps.sy - p0.sy) / ls, (pt.sx - p0.sx) / lt, (pt.sy - p0.sy) / lt, p0.sx, p0.sy)
}

function cheminEcran(g: CanvasRenderingContext2D, pts: readonly Point[], vers: VersEcran): void {
  g.beginPath()
  for (let k = 0; k < pts.length; k++) {
    const q = vers(pts[k].x, pts[k].y)
    if (k === 0) g.moveTo(q.sx, q.sy)
    else g.lineTo(q.sx, q.sy)
  }
  g.closePath()
}

/** Dessine UNE porte. `avance` : sa matérialisation (0 ouverte, 1 close,
 *  porte.ts) ; `leve` : la levée d'une porte d'un coup (0 au ras du sol, 1
 *  debout — main.ts la fait courir, leveeSuivante) ; `img` : l'atlas s'il
 *  est chargé, null sinon (le tracé de secours). */
export function dessinePorte(
  g: CanvasRenderingContext2D,
  p: PorteDef,
  avance: number,
  leve: number,
  vue: VuePorte,
  img: HTMLImageElement | null,
): void {
  const cadre = cadrePorte(p)
  const { o, es, et, longueur: L, epaisseur: E } = cadre
  if (!(L > 0) || !(E > 0)) return
  const dec = decoupePorte(L, E)
  const pc = img ? pieces(img) : null
  const { contour, front, hauteur: h, close } = partLevee(p, avance, leve)

  // 1. LA FENTE, au ras du sol : tout ce qu'on voit d'une porte ouverte, et
  // ce qui reste du passage tant qu'elle n'est pas toute sortie
  if (!close) {
    g.save()
    const m = pc && motif(g, pc.fente)
    if (m) {
      poseRepere(g, vue.pied, o, es, et, L, E)
      m.setTransform({ a: dec.carreau / PORTE_ATLAS.fente.w, b: 0, c: 0, d: E / PORTE_ATLAS.fente.h, e: dec.bout, f: 0 })
      g.globalAlpha = 0.9
      g.fillStyle = m
      g.fillRect(0, 0, L, E)
    } else {
      cheminEcran(g, coins(p), vue.pied)
      g.strokeStyle = 'rgba(154,163,171,0.55)'
      g.setLineDash([5, 7])
      g.lineWidth = 1.5
      g.stroke()
    }
    g.restore()
  }
  if (contour.length < 3 || !(h > 0)) return

  // le haut de ce qui est levé : entre le sol et le sommet des murs, à la
  // hauteur montrée (le relief est une homothétie autour du centre de
  // l'écran : à mi-hauteur, mi-chemin — à 2 % près au relief fort)
  const haut: VersEcran = (x, y) => {
    const a = vue.pied(x, y)
    if (h >= 1) return vue.sommet(x, y)
    const b = vue.sommet(x, y)
    return { sx: a.sx + (b.sx - a.sx) * h, sy: a.sy + (b.sy - a.sy) * h }
  }

  // 2. LA FACE, relief allumé : les côtés libres tournés vers l'œil
  // descendent du haut au sol (facesTranche : ni les bouts collés aux murs,
  // ni les faces de dos) — le front d'une porte qui se déplie en est un
  if (vue.oeil) {
    for (const { a, b } of facesTranche(contour, p, vue.oeil.x, vue.oeil.y)) dessineFace(g, a, b, vue.pied, haut, h, cadre, dec, pc)
  }

  // 3. LE DESSUS, rogné à la part levée
  g.save()
  cheminEcran(g, contour, haut)
  if (!pc) {
    g.fillStyle = '#2b343e'
    g.fill()
    g.strokeStyle = 'rgba(154,163,171,0.85)'
    g.lineWidth = 1.5
    g.stroke()
  }
  g.clip()
  poseRepere(g, haut, o, es, et, L, E)
  const m = pc && motif(g, pc.dessus)
  if (pc && m) {
    m.setTransform({ a: dec.carreau / PORTE_ATLAS.dessus.w, b: 0, c: 0, d: E / PORTE_ATLAS.dessus.h, e: dec.bout, f: 0 })
    g.fillStyle = m
    // la dalle entière d'abord, les sabots par-dessus : pas de fente entre eux
    g.fillRect(0, 0, L, E)
    g.drawImage(pc.bout, 0, 0, dec.bout, E)
    g.save()
    g.translate(L, 0)
    g.scale(-1, 1)
    g.drawImage(pc.bout, 0, 0, dec.bout, E)
    g.restore()
  }
  // plus elle est basse, plus elle est dans l'ombre de sa fente — à plat
  // (relief éteint, l'éditeur), c'est ce qui dit qu'elle monte
  if (h < 1) {
    g.fillStyle = `rgba(3,7,16,${(0.6 * (1 - h)).toFixed(3)})`
    g.fillRect(0, 0, L, E)
  }
  // LES VEILLEUSES : ambre (la seule couleur chaude que la charte admet sur
  // un mécanisme) — elles battent pendant la course, veillent porte close
  const xl = (dec.bout * VEILLEUSE_X) / PORTE_ATLAS.bout.w
  const enCourse = !close
  const force = enCourse ? (Math.sin(vue.temps * 14) > 0 ? 0.75 : 0.2) : 0.32 + 0.08 * Math.sin(vue.temps * 2.2)
  for (const s of [xl, L - xl]) {
    if (!pc) {
      g.fillStyle = '#e8951f'
      g.fillRect(s - E * 0.04, E * 0.4, E * 0.08, E * 0.2)
    }
    const r = E * 0.5
    const halo = g.createRadialGradient(s, E / 2, 0, s, E / 2, r)
    halo.addColorStop(0, `rgba(242,201,142,${force.toFixed(3)})`)
    halo.addColorStop(0.35, `rgba(232,149,31,${(force * 0.45).toFixed(3)})`)
    halo.addColorStop(1, 'rgba(232,149,31,0)')
    g.fillStyle = halo
    g.fillRect(s - r, E / 2 - r, 2 * r, 2 * r)
  }
  g.restore()

  // 4. LE FRONT d'une porte qui se déplie : le joint qui pousse, d'un blanc
  // froid (#d6e8f5) — c'est lui que le corps rencontre
  if (front.length === 2) {
    const f0 = haut(front[0].x, front[0].y)
    const f1 = haut(front[1].x, front[1].y)
    g.save()
    g.strokeStyle = 'rgba(214,232,245,0.85)'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(f0.sx, f0.sy)
    g.lineTo(f1.sx, f1.sy)
    g.stroke()
    g.restore()
  }
}

function coins(p: PorteDef): Point[] {
  return [
    { x: p.minX, y: p.minY },
    { x: p.maxX, y: p.minY },
    { x: p.maxX, y: p.maxY },
    { x: p.minX, y: p.maxY },
  ]
}

/** Une face, en tranches courtes : son haut a glissé plus loin du centre de
 *  l'écran que son pied (le relief est une homothétie autour de ce centre),
 *  la face est donc un TRAPÈZE — un seul repère affine y tordrait les
 *  panneaux au bout d'une longue porte. Chaque tranche a le sien, fixé sur
 *  trois coins ; elles mordent d'un pixel l'une sur l'autre, pour qu'aucune
 *  fente ne s'ouvre au filtrage. L'image est ACCROCHÉE PAR LE HAUT : à la
 *  hauteur h, on voit son haut sur h de sa hauteur — le reste est encore
 *  dans le sol. */
function dessineFace(
  g: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  pied: VersEcran,
  haut: VersEcran,
  h: number,
  cadre: ReturnType<typeof cadrePorte>,
  dec: ReturnType<typeof decoupePorte>,
  pc: Pieces | null,
): void {
  const long = Math.hypot(b.x - a.x, b.y - a.y)
  if (!(long > 1e-6)) return
  const { o, es, et, epaisseur: E } = cadre
  // la coordonnée de texture le long de la face : celle de la dalle (le
  // carreau du flanc couvre deux carreaux du dessus, ses joints tombent
  // sous les leurs)
  const dx = (b.x - a.x) / long
  const dy = (b.y - a.y) / long
  const leLong = Math.abs(dx * es.x + dy * es.y) >= 0.5
  const k = PORTE_ATLAS.flanc.w / (2 * dec.carreau)
  const u = (q: Point): number =>
    leLong
      ? ((q.x - o.x) * es.x + (q.y - o.y) * es.y - dec.bout) * k
      : ((q.x - o.x) * et.x + (q.y - o.y) * et.y) * k
  const m = pc && motif(g, pc.flanc)
  const hv = PORTE_ATLAS.flanc.h * h // la part visible de l'image, depuis son haut
  const n = Math.max(1, Math.ceil(long / E))
  g.save()
  for (let i = 0; i < n; i++) {
    const q0 = { x: a.x + (b.x - a.x) * (i / n), y: a.y + (b.y - a.y) * (i / n) }
    const q1 = { x: a.x + (b.x - a.x) * ((i + 1) / n), y: a.y + (b.y - a.y) * ((i + 1) / n) }
    const f0 = pied(q0.x, q0.y)
    const f1 = pied(q1.x, q1.y)
    const h0 = haut(q0.x, q0.y)
    const h1 = haut(q1.x, q1.y)
    if (Math.hypot(h0.sx - f0.sx, h0.sy - f0.sy) < 0.5) continue
    // la morsure : un pixel de plus le long de la face, de chaque côté
    const lx = f1.sx - f0.sx
    const ly = f1.sy - f0.sy
    const ll = Math.hypot(lx, ly) || 1
    const mx = (lx / ll) * 0.6
    const my = (ly / ll) * 0.6
    g.beginPath()
    g.moveTo(f0.sx - mx, f0.sy - my)
    g.lineTo(f1.sx + mx, f1.sy + my)
    g.lineTo(h1.sx + mx, h1.sy + my)
    g.lineTo(h0.sx - mx, h0.sy - my)
    g.closePath()
    const u0 = u(q0)
    const u1 = u(q1)
    if (m && Math.abs(u1 - u0) > 1e-6 && hv > 0) {
      // (u0, 0) → h0, (u1, 0) → h1, (u0, hv) → f0 : la tête de l'image en
      // haut, ce qui en est sorti jusqu'au sol
      const ma = (h1.sx - h0.sx) / (u1 - u0)
      const mb = (h1.sy - h0.sy) / (u1 - u0)
      const mc = (f0.sx - h0.sx) / hv
      const md = (f0.sy - h0.sy) / hv
      m.setTransform({ a: ma, b: mb, c: mc, d: md, e: h0.sx - ma * u0, f: h0.sy - mb * u0 })
      g.fillStyle = m
    } else {
      g.fillStyle = '#222a33'
    }
    g.fill()
  }
  // l'ombre du pied, et sa ligne : la dalle sort du sol
  const fa = pied(a.x, a.y)
  const fb = pied(b.x, b.y)
  const ha = haut(a.x, a.y)
  const hb = haut(b.x, b.y)
  const ombre = g.createLinearGradient((fa.sx + fb.sx) / 2, (fa.sy + fb.sy) / 2, (ha.sx + hb.sx) / 2, (ha.sy + hb.sy) / 2)
  ombre.addColorStop(0, 'rgba(3,7,16,0.55)')
  ombre.addColorStop(0.6, 'rgba(3,7,16,0)')
  g.beginPath()
  g.moveTo(fa.sx, fa.sy)
  g.lineTo(fb.sx, fb.sy)
  g.lineTo(hb.sx, hb.sy)
  g.lineTo(ha.sx, ha.sy)
  g.closePath()
  g.fillStyle = ombre
  g.fill()
  g.strokeStyle = 'rgba(3,7,16,0.7)'
  g.lineWidth = 1
  g.beginPath()
  g.moveTo(fa.sx, fa.sy)
  g.lineTo(fb.sx, fb.sy)
  g.stroke()
  g.restore()
}
