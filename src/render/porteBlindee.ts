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
//   · ouverte, il ne reste que son dessus à fleur du sol — la TRAPPE, ses
//     rien entre elles : le fluide qui passe dessus se voit ;
//   · elle porte le code couleur des LASERS qui la commandent : liserés et
//     veilleuses rouges, veilleuses vertes une fois ouverte ;
//   · relief allumé, sa face ne se peint pas là où un mur la touche : le
//     dessus de ce mur passe devant (« la face peinte par-dessus le mur
//     collé à elle », capture du concepteur, 22/11).
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

import type { DecalDef, PorteDef } from '../game/level'
import { portePolygone, type Point } from '../game/porte'
import { facesTranche } from './reliefParois'

export const PORTE_BLINDEE_URL = '/assets/porte-blindee.webp'

/** Les pièces de l'atlas, en px — UN CONTRAT avec atlas_rects() de
 *  tools/images/blender/porte_blindee.py (vérifié par porteBlindee.spec.ts).
 *  La longueur est à l'horizontale ; dessus, bout et trappe sont vus d'en
 *  haut (160 px = l'épaisseur), le flanc en élévation (280 px = un mur). */
export const PORTE_ATLAS = {
  dessus: { x: 4, y: 4, w: 320, h: 160 },
  bout: { x: 328, y: 4, w: 96, h: 160 },
  flanc: { x: 428, y: 4, w: 320, h: 280 },
  trappe: { x: 752, y: 4, w: 320, h: 160 },
  trappeBout: { x: 1076, y: 4, w: 96, h: 160 },
} as const
export const PORTE_ATLAS_TAILLE = { w: 1176, h: 288 } as const
// la lentille de la veilleuse, dans la pièce `bout` (px) — VEILLEUSE_X du script
const VEILLEUSE_X = 30

/** LA DURÉE D'UNE LEVÉE (s) d'une porte d'un coup, du sol au sommet : assez
 *  pour qu'on la voie sortir ou s'enfoncer, assez court pour que la porte
 *  qui s'ouvre (libre pour le solveur dès l'image où son canal tombe) ne
 *  laisse pas le corps la traverser longtemps à l'œil. */
export const DUREE_LEVEE = 0.4

// LE CODE COULEUR DES LASERS (« que le code couleur rappelle les lasers »,
// le concepteur, 22/11) : les liserés du dessus et les veilleuses prennent le
// rouge du halo des faisceaux (main.ts) ; porte ouverte, les veilleuses
// passent au VERT. Le cœur est plus clair que le halo, comme celui du
// faisceau.
export const ROUGE_LASER = { coeur: '255,190,175', halo: '255,72,58' } as const
export const VERT_OUVERT = { coeur: '205,255,220', halo: '70,225,130' } as const

/** L'état que disent les veilleuses : vert ouverte (rien n'est levé), rouge
 *  qui bat pendant la course, rouge qui veille porte close. */
export function etatVeilleuses(close: boolean, levee: boolean): 'ouverte' | 'course' | 'close' {
  if (close) return 'close'
  return levee ? 'course' : 'ouverte'
}

/** Les tranches d'une face (a → b) : des morceaux d'au plus `pas`. Le haut
 *  d'une face a glissé plus loin du centre de l'écran que son pied, la face
 *  est un trapèze : chaque morceau aura son propre repère affine. */
export function tranchesFace(a: Point, b: Point, pas: number): [Point, Point][] {
  const long = Math.hypot(b.x - a.x, b.y - a.y)
  if (!(long > 1e-6)) return []
  const n = Math.max(1, Math.ceil(long / Math.max(pas, 1e-6)))
  const out: [Point, Point][] = []
  for (let i = 0; i < n; i++) {
    out.push([
      { x: a.x + (b.x - a.x) * (i / n), y: a.y + (b.y - a.y) * (i / n) },
      { x: a.x + (b.x - a.x) * ((i + 1) / n), y: a.y + (b.y - a.y) * ((i + 1) / n) },
    ])
  }
  return out
}

// ---- CE QUE LES MURS CACHENT ------------------------------------------------
// La porte se dessine dans la toile 2D, PAR-DESSUS le rendu WebGL : sans
// rien de plus, elle passerait devant tout. Relief allumé, un mur devant elle
// doit la cacher — sa face, son dessus. Deux essais par sondes (des points du
// décor tâtés le long de la ligne de visée) cachaient par marches, en
// retard sur la caméra : « je la vois par-dessus la paroi une seconde puis
// elle disparaît […] cela me fait penser à une rustine » (le concepteur,
// 22/11). Le masque est maintenant EXACT à l'écran : le volume de chaque
// solide voisin, projeté par la même homothétie que le moteur — son pied,
// son dessus à sa hauteur, les quadrilatères que balaie chaque arête —, est
// effacé du calque où la porte vient d'être peinte.

/** Un solide qui peut cacher la porte : ses contours au sol (monde) et sa
 *  hauteur. */
export interface Occultant {
  contours: Point[][]
  hauteur: number
}

/** Le point (x, y) du monde, à la hauteur h, à l'écran — l'homothétie du
 *  relief autour du point sous l'œil (h = 0 : le sol). */
export type Projette = (x: number, y: number, h: number) => { sx: number; sy: number }

/** Le polygone rogné au demi-plan (q − a)·n ≥ 0 (Sutherland–Hodgman) : la
 *  part d'un solide qui est DEVANT une face — derrière son plan, il ne peut
 *  pas la cacher. */
export function coupeDemiPlan(pts: readonly Point[], a: Point, n: Point): Point[] {
  const d = pts.map((q) => (q.x - a.x) * n.x + (q.y - a.y) * n.y)
  const out: Point[] = []
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    if (d[i] >= 0) out.push(pts[i])
    if (d[i] >= 0 !== d[j] >= 0) {
      const t = d[i] / (d[i] - d[j])
      out.push({ x: pts[i].x + (pts[j].x - pts[i].x) * t, y: pts[i].y + (pts[j].y - pts[i].y) * t })
    }
  }
  return out.length >= 3 ? out : []
}

/** LE VOLUME D'UN SOLIDE À L'ÉCRAN : les polygones dont la réunion couvre ce
 *  que ce solide cache — son pied, son dessus (à sa hauteur), et pour chaque
 *  arête le quadrilatère qu'elle balaie du pied au dessus (ses flancs). Exact
 *  pour tout contour, convexe ou non. */
export function volumeProjete(
  contour: readonly Point[],
  hauteur: number,
  projette: Projette,
): { sx: number; sy: number }[][] {
  if (contour.length < 3) return []
  const pied = contour.map((q) => projette(q.x, q.y, 0))
  const haut = contour.map((q) => projette(q.x, q.y, hauteur))
  const out = [pied, haut]
  for (let i = 0; i < contour.length; i++) {
    const j = (i + 1) % contour.length
    out.push([pied[i], pied[j], haut[j], haut[i]])
  }
  return out
}

/** Le point est-il dans le polygone (pair–impair) ? */
export function dansPolygone(pts: readonly Point[], x: number, y: number): boolean {
  let dedans = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]
    const b = pts[j]
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) dedans = !dedans
  }
  return dedans
}

// le calque où la porte (ou un faisceau) se peint avant que les murs n'y
// soient effacés
let calque: HTMLCanvasElement | null = null

/** Le rectangle écran (unités de `g`) en pixels de la toile, borné à elle. */
function rectPixels(
  g: CanvasRenderingContext2D,
  rect: { x0: number; y0: number; x1: number; y1: number },
): { bx0: number; by0: number; bx1: number; by1: number } {
  const m = g.getTransform()
  // (la toile des effets n'a qu'une échelle et une translation)
  return {
    bx0: Math.max(0, Math.floor(m.a * rect.x0 + m.e) - 2),
    by0: Math.max(0, Math.floor(m.d * rect.y0 + m.f) - 2),
    bx1: Math.min(g.canvas.width, Math.ceil(m.a * rect.x1 + m.e) + 2),
    by1: Math.min(g.canvas.height, Math.ceil(m.d * rect.y1 + m.f) + 2),
  }
}

/** OUVRE le calque : vidé dans le rectangle, à la transformation de `g`.
 *  Ce qu'on y peint ensuite n'atteint `g` qu'à `fermeCalque`. Rend null s'il
 *  n'y a rien à peindre (hors écran, ou pas de document). Les deux moitiés
 *  de `surCalque` sont séparées pour le faisceau laser (main.ts) : son dessin
 *  est long et passe par des aides qui peignent sur la toile du moment. */
export function ouvreCalque(
  g: CanvasRenderingContext2D,
  rect: { x0: number; y0: number; x1: number; y1: number },
): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null
  const W = g.canvas.width
  const H = g.canvas.height
  if (!calque) calque = document.createElement('canvas')
  if (calque.width !== W || calque.height !== H) {
    calque.width = W
    calque.height = H
  }
  const c = calque.getContext('2d')
  if (!c) return null
  const { bx0, by0, bx1, by1 } = rectPixels(g, rect)
  if (bx1 <= bx0 || by1 <= by0) return null
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.clearRect(bx0, by0, bx1 - bx0, by1 - by0)
  c.setTransform(g.getTransform())
  c.globalCompositeOperation = 'source-over'
  return c
}

/** FERME le calque : en efface ce que `masque` couvre, et pose le résultat
 *  sur `g` (avec le mode de composition de `g` : le faisceau reste additif). */
export function fermeCalque(
  g: CanvasRenderingContext2D,
  c: CanvasRenderingContext2D,
  rect: { x0: number; y0: number; x1: number; y1: number },
  masque: (c: CanvasRenderingContext2D) => void,
): void {
  const { bx0, by0, bx1, by1 } = rectPixels(g, rect)
  if (bx1 <= bx0 || by1 <= by0) return
  c.save()
  c.globalCompositeOperation = 'destination-out'
  masque(c)
  c.restore()
  g.save()
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.drawImage(c.canvas, bx0, by0, bx1 - bx0, by1 - by0, bx0, by0, bx1 - bx0, by1 - by0)
  g.restore()
}

/** Peint `dessine` sur un calque, en efface ce que `masque` couvre, et pose
 *  le résultat sur `g` — dans le rectangle écran (unités de `g`) donné. */
function surCalque(
  g: CanvasRenderingContext2D,
  rect: { x0: number; y0: number; x1: number; y1: number },
  dessine: (c: CanvasRenderingContext2D) => void,
  masque: (c: CanvasRenderingContext2D) => void,
): void {
  const c = ouvreCalque(g, rect)
  if (!c) return
  c.save()
  dessine(c)
  c.restore()
  fermeCalque(g, c, rect, masque)
}

/** Efface le volume des occultants (rognés au demi-plan, s'il y en a un). */
export function effaceVolumes(
  c: CanvasRenderingContext2D,
  occ: readonly Occultant[],
  projette: Projette,
  demiPlan?: { a: Point; n: Point },
): void {
  c.fillStyle = '#000'
  c.strokeStyle = '#000'
  // un trait d'un pixel le long de chaque polygone : pas de fente entre deux
  // quadrilatères voisins au filtrage
  c.lineWidth = 1
  for (const o of occ) {
    for (const brut of o.contours) {
      const contour = demiPlan ? coupeDemiPlan(brut, demiPlan.a, demiPlan.n) : brut
      for (const poly of volumeProjete(contour, o.hauteur, projette)) {
        c.beginPath()
        for (let k = 0; k < poly.length; k++) {
          if (k === 0) c.moveTo(poly[k].sx, poly[k].sy)
          else c.lineTo(poly[k].sx, poly[k].sy)
        }
        c.closePath()
        c.fill()
        c.stroke()
      }
    }
  }
}

function rectEcran(pts: readonly { sx: number; sy: number }[], marge: number): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const q of pts) {
    x0 = Math.min(x0, q.sx)
    y0 = Math.min(y0, q.sy)
    x1 = Math.max(x1, q.sx)
    y1 = Math.max(y1, q.sy)
  }
  return { x0: x0 - marge, y0: y0 - marge, x1: x1 + marge, y1: y1 + marge }
}

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
 *  debout, l'image tourne d'un quart de tour, sa tête à gauche. `couchee`
 *  impose le sens (sensPorte) ; par défaut, le plus long côté. */
export function cadrePorte(
  p: PorteDef,
  couchee: boolean = p.maxX - p.minX >= p.maxY - p.minY,
): {
  o: Point
  es: Point
  et: Point
  longueur: number
  epaisseur: number
  couchee: boolean
} {
  const lx = p.maxX - p.minX
  const ly = p.maxY - p.minY
  return couchee
    ? { o: { x: p.minX, y: p.maxY }, es: { x: 1, y: 0 }, et: { x: 0, y: -1 }, longueur: lx, epaisseur: ly, couchee }
    : { o: { x: p.minX, y: p.minY }, es: { x: 0, y: 1 }, et: { x: 1, y: 0 }, longueur: ly, epaisseur: lx, couchee }
}

/** LE SENS DE LA DALLE : elle va d'un mur à l'autre. Les sabots se posent
 *  contre les deux murs qu'elle relie, les grandes faces regardent le
 *  passage. Deviné par la seule longueur, une porte presque carrée qui ferme
 *  un couloir étroit se couchait en travers : ses « bouts » donnaient sur le
 *  couloir et sa face, collée au mur, était cachée — D1 et D2 n'avaient plus
 *  de face en relief (capture du concepteur, 22/11). Avec la sonde des
 *  solides, on regarde de quel côté sont les murs ; sans elle (l'éditeur),
 *  ou quand les deux côtés ou aucun n'en ont, le plus long côté. `true` :
 *  couchée, ses bouts à gauche et à droite. */
export function sensPorte(p: PorteDef, solide?: (x: number, y: number) => boolean, devant = 3): boolean {
  const parLongueur = p.maxX - p.minX >= p.maxY - p.minY
  if (!solide) return parLongueur
  const cx = (p.minX + p.maxX) / 2
  const cy = (p.minY + p.maxY) / 2
  const gaucheDroite = solide(p.minX - devant, cy) && solide(p.maxX + devant, cy)
  const hautBas = solide(cx, p.maxY + devant) && solide(cx, p.minY - devant)
  if (gaucheDroite !== hautBas) return gaucheDroite
  return parLongueur
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

// ---- LA TRAPPE EN DÉCALQUES DE SOL ------------------------------------------
// Porte ouverte, il ne reste que le dessus de la dalle enfoncée, à fleur du
// sol, liserés et veilleuses verts. Le premier essai le peignait dans la
// toile 2D — deux lèvres de chevrons, le milieu vide pour que le fluide s'y
// voie : « quand c'est ouvert ce n'est pas très beau » (le concepteur,
// 22/11). Une trappe pleine, peinte PAR-DESSUS le fluide, l'aurait caché ; en
// décalque de sol, le moteur la peint SOUS lui — l'eau qui franchit la porte
// passe dessus — et sous le dessus des murs en relief, comme tout le décor.
// Toujours posée : porte close, la dalle debout la recouvre.

// l'opacité de la trappe (DecalDef.fade : 0,55 par défaut, un décor discret)
const FONDU_TRAPPE = 0.95
// un rien de recouvrement entre deux carreaux voisins : pas de fente au
// filtrage (unités)
const RECOUVREMENT_TRAPPE = 0.6

/** Les décalques de la trappe de chaque porte : des carreaux posés bout à
 *  bout le long de la dalle, un sabot à chaque bout — exactement comme le
 *  dessus (decoupePorte). Un décalque n'est jamais tourné : une porte debout
 *  prend les pièces déjà tournées (`-v`), et son sabot du haut la pièce
 *  retournée (`-v-haut`) — le miroir d'un décalque n'est qu'horizontal.
 *  `solide` : de quel côté sont les murs (sensPorte). */
export function decalsDesPortes(
  portes: readonly PorteDef[],
  solide?: (x: number, y: number) => boolean,
): DecalDef[] {
  const out: DecalDef[] = []
  for (const p of portes) {
    const couchee = sensPorte(p, solide)
    const { o, es, et, longueur: L, epaisseur: E } = cadrePorte(p, couchee)
    if (!(L > 0) || !(E > 0)) continue
    const dec = decoupePorte(L, E)
    const pose = (s0: number, s1: number, kind: DecalDef['kind'], flip?: boolean): void => {
      const sm = (s0 + s1) / 2
      const long = s1 - s0 + RECOUVREMENT_TRAPPE
      out.push({
        x: o.x + es.x * sm + et.x * (E / 2),
        y: o.y + es.y * sm + et.y * (E / 2),
        w: couchee ? long : E,
        h: couchee ? E : long,
        kind,
        ...(flip ? { flip } : {}),
        fade: FONDU_TRAPPE,
      })
    }
    for (let k = 0; k < dec.n; k++) {
      pose(dec.bout + k * dec.carreau, dec.bout + (k + 1) * dec.carreau, couchee ? 'porte-trappe' : 'porte-trappe-v')
    }
    if (couchee) {
      pose(0, dec.bout, 'porte-trappe-bout')
      pose(L - dec.bout, L, 'porte-trappe-bout', true)
    } else {
      pose(0, dec.bout, 'porte-trappe-bout-v')
      pose(L - dec.bout, L, 'porte-trappe-bout-v-haut')
    }
  }
  return out
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
  /** le sol à l'écran : la trappe, et le pied de la face */
  pied: VersEcran
  /** relief allumé : le point du monde sous l'œil (la caméra) — la face se
   *  peint, tournée vers lui (facesTranche) ; null : à plat */
  oeil: Point | null
  /** l'horloge (s), pour les veilleuses */
  temps: number
  /** relief allumé : les solides voisins qui peuvent cacher la porte. Ils
   *  disent aussi de quel côté sont les murs (sensPorte). Absents : rien ne
   *  cache rien */
  occultants?: readonly Occultant[]
  /** relief allumé : un point du monde, à une hauteur, à l'écran — la
   *  projection des occultants */
  projette?: Projette
  /** en jeu : la TRAPPE est au décor (decalsDesPortes) — sous le fluide et
   *  sous les murs, rendue par le moteur ; la toile 2D ne peint plus le sol.
   *  Absent (l'éditeur) : la toile la peint */
  solAuDecor?: boolean
}

type Pieces = {
  dessus: HTMLCanvasElement
  bout: HTMLCanvasElement
  flanc: HTMLCanvasElement
  trappe: HTMLCanvasElement
  trappeBout: HTMLCanvasElement
}
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
    trappe: coupe(PORTE_ATLAS.trappe),
    trappeBout: coupe(PORTE_ATLAS.trappeBout),
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
  const occ = vue.oeil && vue.projette ? vue.occultants : undefined
  const projette = vue.projette
  const masquer = !!(occ && projette && occ.length > 0)
  const couchee = sensPorte(
    p,
    occ && ((x, y) => occ.some((o) => o.contours.some((c) => dansPolygone(c, x, y)))),
  )
  const cadre = cadrePorte(p, couchee)
  const { o, es, et, longueur: L, epaisseur: E } = cadre
  if (!(L > 0) || !(E > 0)) return
  const dec = decoupePorte(L, E)
  const pc = img ? pieces(img) : null
  const { contour, front, hauteur: h, close } = partLevee(p, avance, leve)

  // 1. LA TRAPPE, au ras du sol : la dalle enfoncée, à fleur, ses liserés et
  // ses veilleuses VERTS — tout ce qu'on voit d'une porte ouverte, et ce qui
  // reste du passage tant qu'elle n'est pas toute sortie. En jeu, c'est un
  // décalque de sol (decalsDesPortes) : le moteur la peint sous le fluide et
  // sous le dessus des murs. Ici, pour l'éditeur (et sans atlas, un pointillé)
  const xl = (dec.bout * VEILLEUSE_X) / PORTE_ATLAS.bout.w
  const etat = etatVeilleuses(close, contour.length >= 3 && h > 0)
  if (!close && !vue.solAuDecor) {
    g.save()
    if (pc) {
      dessineDalle(g, vue.pied, cadre, dec, pc.trappe, pc.trappeBout, PORTE_ATLAS.trappe)
    } else {
      cheminEcran(g, coins(p), vue.pied)
      g.strokeStyle = 'rgba(70,225,130,0.55)'
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

  // 2. LA FACE, relief allumé : les côtés tournés vers l'œil descendent du
  // haut au sol — le front d'une porte qui se déplie en est un. Avec les
  // occultants, les bouts aussi (facesTranche, garderBouts) : chaque face est
  // peinte entière, puis le volume des solides DEVANT son plan en est effacé
  // — contre un mur aussi haut qu'elle, un bout disparaît ; contre un plus
  // bas, il dépasse (D1 du 22/11 : la bande de triangles sous elle est plus
  // basse que le mur extérieur qui lui donne sa hauteur)
  if (vue.oeil) {
    for (const { a, b } of facesTranche(contour, p, vue.oeil.x, vue.oeil.y, couchee, masquer)) {
      const face = (c: CanvasRenderingContext2D): void => dessineFace(c, a, b, vue.pied, haut, h, cadre, dec, pc)
      if (masquer && occ && projette) {
        const long = Math.hypot(b.x - a.x, b.y - a.y) || 1
        // la normale sortante (contour en sens trigonométrique)
        const n = { x: (b.y - a.y) / long, y: (a.x - b.x) / long }
        const pts = [vue.pied(a.x, a.y), vue.pied(b.x, b.y), haut(a.x, a.y), haut(b.x, b.y)]
        surCalque(g, rectEcran(pts, 2), face, (c) => effaceVolumes(c, occ, projette, { a, n }))
      } else face(g)
    }
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
  if (pc) dessineDalle(g, haut, cadre, dec, pc.dessus, pc.bout, PORTE_ATLAS.dessus)
  poseRepere(g, haut, o, es, et, L, E)
  // plus elle est basse, plus elle est dans l'ombre de sa trappe — à plat
  // (relief éteint, l'éditeur), c'est ce qui dit qu'elle monte
  if (h < 1) {
    g.fillStyle = `rgba(3,7,16,${(0.6 * (1 - h)).toFixed(3)})`
    g.fillRect(0, 0, L, E)
  }
  // LES LISERÉS : rouges dans l'atlas ; un halo du même rouge les tient
  // lisibles quand la porte ne fait que quelques pixels d'épaisseur
  for (const t of [LISERE_T * E, (1 - LISERE_T) * E]) {
    g.fillStyle = `rgba(${ROUGE_LASER.halo},${(0.22 * h).toFixed(3)})`
    g.fillRect(0, t - E * 0.05, L, E * 0.1)
  }
  // LES VEILLEUSES : rouges — elles battent pendant la course, veillent
  // porte close
  const force = etat === 'course' ? (Math.sin(vue.temps * 14) > 0 ? 1 : 0.25) : 0.75 + 0.15 * Math.sin(vue.temps * 2.2)
  for (const s of [xl, L - xl]) veilleuse(g, s, E, ROUGE_LASER, force, !pc)
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

// le milieu du liseré, en fraction de l'épaisseur — PEAU + JOINT / 2 du script
const LISERE_T = (12 + 6 / 2) / 160

/** Une veilleuse allumée, dans le repère de la dalle (s le long, t en
 *  travers) : la lentille et son halo, à la couleur de l'état. `boitier` :
 *  son boîtier se dessine aussi (au sol, ou sans l'atlas). */
function veilleuse(
  g: CanvasRenderingContext2D,
  s: number,
  E: number,
  c: { coeur: string; halo: string },
  force: number,
  boitier: boolean,
): void {
  if (boitier) {
    g.fillStyle = 'rgba(20,24,30,0.92)'
    g.fillRect(s - E * 0.07, E * 0.34, E * 0.14, E * 0.32)
  }
  const r = E * 0.55
  const halo = g.createRadialGradient(s, E / 2, 0, s, E / 2, r)
  halo.addColorStop(0, `rgba(${c.halo},${(0.55 * force).toFixed(3)})`)
  halo.addColorStop(0.4, `rgba(${c.halo},${(0.18 * force).toFixed(3)})`)
  halo.addColorStop(1, `rgba(${c.halo},0)`)
  g.fillStyle = halo
  g.fillRect(s - r, E / 2 - r, 2 * r, 2 * r)
  // la lentille : 8 × 24 px sur 160 dans l'atlas
  g.fillStyle = `rgba(${c.coeur},${Math.min(1, 0.35 + 0.65 * force).toFixed(3)})`
  g.fillRect(s - E * 0.025, E * 0.425, E * 0.05, E * 0.15)
}

/** Une dalle vue d'en haut — le dessus, ou la trappe : le carreau répété le
 *  long de la porte, un sabot à chaque bout (le second en miroir). */
function dessineDalle(
  g: CanvasRenderingContext2D,
  vers: VersEcran,
  cadre: ReturnType<typeof cadrePorte>,
  dec: ReturnType<typeof decoupePorte>,
  carreau: HTMLCanvasElement,
  sabot: HTMLCanvasElement,
  piece: { w: number; h: number },
): void {
  const { o, es, et, longueur: L, epaisseur: E } = cadre
  const m = motif(g, carreau)
  if (!m) return
  g.save()
  poseRepere(g, vers, o, es, et, L, E)
  m.setTransform({ a: dec.carreau / piece.w, b: 0, c: 0, d: E / piece.h, e: dec.bout, f: 0 })
  g.fillStyle = m
  // la dalle entière d'abord, les sabots par-dessus : pas de fente entre eux
  g.fillRect(0, 0, L, E)
  g.drawImage(sabot, 0, 0, dec.bout, E)
  g.translate(L, 0)
  g.scale(-1, 1)
  g.drawImage(sabot, 0, 0, dec.bout, E)
  g.restore()
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
  const tranches = tranchesFace(a, b, E / 2)
  g.save()
  for (const [q0, q1] of tranches) {
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
