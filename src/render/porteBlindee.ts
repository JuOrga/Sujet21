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

import type { PorteDef } from '../game/level'
import { portePolygone, type Point } from '../game/porte'
import { HAUTEUR_BLOCS } from './hauteurs'
import { facesTranche } from './reliefParois'

// la hauteur d'un mur haut, celle du sommet quand la porte n'en dit pas plus
const HAUTEUR_MUR = HAUTEUR_BLOCS

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

/** Les tranches d'une face (a → b, le contour en sens trigonométrique), et
 *  pour chacune la HAUTEUR jusqu'où elle est cachée : coupée en morceaux
 *  d'au plus `pas`, on sonde le sol juste devant chaque morceau (`devant`
 *  unités le long de la normale sortante, en son milieu). Un mur collé là
 *  cache la face jusqu'à SA hauteur — son dessus passe devant —, pas
 *  au-delà : une porte plus haute que lui dépasse, et ce qui dépasse se voit
 *  (D1 du 22/11 : la bande de triangles sous elle est plus basse que le mur
 *  extérieur qui lui donne sa hauteur ; cachée tout entière, sa face laissait
 *  un couvercle flotter sur du vide). Un morceau caché jusqu'en haut
 *  (`hMax`, la hauteur montrée de la porte) ne se peint pas. Sans sonde,
 *  rien ne cache rien.
 *
 *  LA LIGNE DE VISÉE (`visee`) : le relief est une homothétie autour du
 *  point sous l'œil — le haut d'un solide de hauteur H glisse loin de lui de
 *  la fraction f(H), proportionnelle à H. Le dessus d'un solide qui se
 *  dresse ENTRE la face et l'œil, à moins de r·f(H) d'elle (r : la distance
 *  de la face à l'œil), recouvre donc la face jusqu'à H. On sonde le long
 *  de cette ligne, pas seulement droit devant : une face latérale qui longe
 *  un couloir passe derrière la bande en angle à son bout (le banc du 22/11 :
 *  sondée droit devant, elle se peignait par-dessus). */
export function tranchesVisibles(
  a: Point,
  b: Point,
  pas: number,
  hauteurDevant?: (x: number, y: number) => number,
  hMax = Infinity,
  devant = 3,
  visee?: { oeil: Point; fraction: (h: number) => number },
): [Point, Point, number][] {
  const long = Math.hypot(b.x - a.x, b.y - a.y)
  if (!(long > 1e-6)) return []
  const n = Math.max(1, Math.ceil(long / Math.max(pas, 1e-6)))
  // la normale sortante d'une arête parcourue dans le sens trigonométrique
  const nx = (b.y - a.y) / long
  const ny = (a.x - b.x) / long
  const out: [Point, Point, number][] = []
  for (let i = 0; i < n; i++) {
    const q0 = { x: a.x + (b.x - a.x) * (i / n), y: a.y + (b.y - a.y) * (i / n) }
    const q1 = { x: a.x + (b.x - a.x) * ((i + 1) / n), y: a.y + (b.y - a.y) * ((i + 1) / n) }
    const mx = (q0.x + q1.x) / 2
    const my = (q0.y + q1.y) / 2
    let z = 0
    if (hauteurDevant && visee) {
      const r = Math.hypot(visee.oeil.x - mx, visee.oeil.y - my)
      if (r > 1e-6) {
        const ux = (visee.oeil.x - mx) / r
        const uy = (visee.oeil.y - my) / r
        // au-delà de r·f(mur le plus haut), plus rien ne peut couvrir la face
        const dMax = Math.min(r, r * visee.fraction(HAUTEUR_BLOCS))
        for (let d = devant; d <= dMax; d += PAS_VISEE) {
          const hd = hauteurDevant(mx + ux * d, my + uy * d)
          if (hd > z && d <= r * visee.fraction(hd)) z = hd
        }
      }
    } else if (hauteurDevant) {
      z = Math.max(0, hauteurDevant(mx + nx * devant, my + ny * devant))
    }
    if (z >= hMax) continue
    out.push([q0, q1, z])
  }
  return out
}

// le pas de la sonde le long de la ligne de visée (unités) : un mur fait
// au moins 20 unités d'épaisseur, il ne passe pas entre deux sondes
const PAS_VISEE = 6

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
  /** relief allumé : la hauteur du solide en (x, y), −1 au sol. Elle dit
   *  de quel côté sont les murs (sensPorte), et jusqu'où un mur collé à une
   *  face la cache (tranchesVisibles). Absente : rien ne cache rien */
  hauteurSolide?: (x: number, y: number) => number
  /** la hauteur (unités de jeu) que `sommet` représente — celle des murs
   *  que la porte relie ; absente : un mur haut */
  hauteurPorte?: number
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
  const hs = vue.oeil ? vue.hauteurSolide : undefined
  const couchee = sensPorte(p, hs && ((x, y) => hs(x, y) >= 0))
  const cadre = cadrePorte(p, couchee)
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
  const xl = (dec.bout * VEILLEUSE_X) / PORTE_ATLAS.bout.w
  const etat = etatVeilleuses(close, contour.length >= 3 && h > 0)
  if (etat === 'ouverte') {
    // la dalle est dans le sol : ses veilleuses affleurent, VERTES, aux deux
    // bouts de la fente — le passage est libre
    g.save()
    poseRepere(g, vue.pied, o, es, et, L, E)
    // et ses deux liserés restent, VERTS, au ras du sol (« quand elles sont
    // ouvertes les deux lignes doivent rester et passer en vert », 22/11)
    for (const t of [LISERE_T * E, (1 - LISERE_T) * E]) liseres(g, t, L, E, VERT_OUVERT, 1)
    for (const s of [xl, L - xl]) veilleuse(g, s, E, VERT_OUVERT, 0.55 + 0.1 * Math.sin(vue.temps * 2.2), true)
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
    // avec la sonde des murs, les bouts aussi : contre un mur aussi haut
    // qu'elle, un bout est caché tout entier ; contre un plus bas, il dépasse
    const hp = vue.hauteurPorte ?? HAUTEUR_MUR
    // la fraction du sommet de la porte, lue sur la vue elle-même : sous
    // l'œil, le sommet d'un point s'écarte de 1 / (1 − f) — et f est
    // proportionnelle à la hauteur, jusqu'à celle d'un mur haut
    const c0 = vue.pied(vue.oeil.x, vue.oeil.y)
    const q = contour[0]
    const dp = Math.hypot(vue.pied(q.x, q.y).sx - c0.sx, vue.pied(q.x, q.y).sy - c0.sy)
    const ds = Math.hypot(vue.sommet(q.x, q.y).sx - c0.sx, vue.sommet(q.x, q.y).sy - c0.sy)
    const fS = ds > 1e-6 ? Math.max(0, 1 - dp / ds) : 0
    const hRef = Math.min(Math.max(hp, 1e-6), HAUTEUR_BLOCS)
    const visee = { oeil: vue.oeil, fraction: (hh: number) => (fS * Math.min(Math.max(hh, 0), HAUTEUR_BLOCS)) / hRef }
    for (const { a, b } of facesTranche(contour, p, vue.oeil.x, vue.oeil.y, couchee, !!hs))
      dessineFace(g, a, b, vue.pied, haut, h, cadre, dec, pc, hs, hp, visee)
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

/** Un liseré tracé (au sol, porte ouverte) : un halo et un cœur clair,
 *  comme un faisceau couché, le long de toute la dalle. */
function liseres(
  g: CanvasRenderingContext2D,
  t: number,
  L: number,
  E: number,
  c: { coeur: string; halo: string },
  force: number,
): void {
  g.fillStyle = `rgba(${c.halo},${(0.28 * force).toFixed(3)})`
  g.fillRect(0, t - E * 0.06, L, E * 0.12)
  g.fillStyle = `rgba(${c.halo},${(0.85 * force).toFixed(3)})`
  g.fillRect(0, t - E * 0.018, L, E * 0.036)
  g.fillStyle = `rgba(${c.coeur},${(0.7 * force).toFixed(3)})`
  g.fillRect(0, t - E * 0.007, L, E * 0.014)
}

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
  hauteurDevant?: (x: number, y: number) => number,
  hauteurPorte = HAUTEUR_MUR,
  visee?: { oeil: Point; fraction: (h: number) => number },
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
  // (en morceaux d'au plus une demi-épaisseur : le mur qui touche la face
  // la cache au morceau près, jusqu'à sa propre hauteur)
  const hMontree = h * hauteurPorte
  const tranches = tranchesVisibles(a, b, E / 4, hauteurDevant, hMontree, 3, visee)
  if (tranches.length === 0) return
  // le bas VISIBLE d'un morceau : le sol, ou le dessus du mur collé devant
  const bas = (q: Point, z: number): { sx: number; sy: number } => {
    const f = pied(q.x, q.y)
    if (!(z > 0)) return f
    const t = Math.min(1, z / hMontree)
    const c = haut(q.x, q.y)
    return { sx: f.sx + (c.sx - f.sx) * t, sy: f.sy + (c.sy - f.sy) * t }
  }
  g.save()
  for (const [q0, q1, z] of tranches) {
    // f0 : le pied, où l'image s'arrête ; b0, b1 : là où la face cesse de
    // se voir (le sol, ou le dessus du mur devant)
    const f0 = pied(q0.x, q0.y)
    const b0 = bas(q0, z)
    const b1 = bas(q1, z)
    const h0 = haut(q0.x, q0.y)
    const h1 = haut(q1.x, q1.y)
    if (Math.hypot(h0.sx - b0.sx, h0.sy - b0.sy) < 0.5) continue
    // la morsure : un pixel de plus le long de la face, de chaque côté
    const lx = b1.sx - b0.sx
    const ly = b1.sy - b0.sy
    const ll = Math.hypot(lx, ly) || 1
    const mx = (lx / ll) * 0.6
    const my = (ly / ll) * 0.6
    g.beginPath()
    g.moveTo(b0.sx - mx, b0.sy - my)
    g.lineTo(b1.sx + mx, b1.sy + my)
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
  // l'ombre du pied, et sa ligne : la dalle sort du sol — sur les seules
  // tranches qui se voient jusqu'au sol (derrière un mur, le pied est caché :
  // seule la ligne où son dessus coupe la face, plus légère)
  for (const [q0, q1, z] of tranches) {
    if (z > 0) {
      const ca = bas(q0, z)
      const cb = bas(q1, z)
      g.strokeStyle = 'rgba(3,7,16,0.45)'
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(ca.sx, ca.sy)
      g.lineTo(cb.sx, cb.sy)
      g.stroke()
      continue
    }
    const fa = pied(q0.x, q0.y)
    const fb = pied(q1.x, q1.y)
    const ha = haut(q0.x, q0.y)
    const hb = haut(q1.x, q1.y)
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
  }
  g.restore()
}
