// Le MODE FIGURE du générateur : la leçon des tableaux faits main.
//
// Rétrospective du « crop circle » (l'ami du concepteur) et de ses deux
// descendants (le tournesol, le cortège des lunes) — ce qui les rend
// beaux tient en six principes, et ce module les grave :
//
//   1. UNE SEULE IDÉE LISIBLE — le tableau EST une figure, un glyphe qu'on
//      lit d'un regard au plan large. Pas un assemblage de salles : un
//      dessin posé dans le champ.
//   2. L'IMMENSITÉ ET LE VIDE — la cuve est vaste, la figure n'en occupe
//      qu'une part ; traverser du vide fait partie du voyage.
//   3. LA SOBRIÉTÉ — peu de pièces (≤ 22), parois d'anneaux minces,
//      aucun fouillis. Ce qu'on retire compte plus que ce qu'on ajoute.
//   4. L'ÉCLAIRAGE DE BASE — pas une lampe : la lumière par défaut couche
//      de grandes ombres radiales, et c'est elle qui sculpte la figure.
//   5. LES COUTURES GARDÉES — les passages de la figure sont d'étroites
//      coutures (~300 u), chacune gardée par une plaque-filtre d'état
//      (membrane, rideau, évent) posée tangente — ou par une porte
//      asservie quand la figure s'offre un mécanisme.
//   6. LA SYMÉTRIE TORDUE — jamais parfaite : coutures qui tournent,
//      moitiés glissées, satellites posés au large pour la beauté seule.
//
// Six FAMILLES élargissent le vocabulaire au-delà des cercles :
//   anneaux · spirale · cortège (lunes ET enceintes carrées) · rosace
//   (couronne de capsules) · nef (l'orthogonale à colonnades) ·
//   constellation — et les mécanismes du jeu (porte asservie au miroir de
//   glace, barrière NOR) se greffent sur la couture finale, prouvés par le
//   même traceur que le reste du générateur.
//
// Le module compose en ORIENTATION CANONIQUE : la promenade file vers +x.
// Les retournements du générateur (transposition, miroir) ne savent pas
// encore emporter les formes en arc — le mode figure n'y passe pas, la
// variété vient des familles, des inclinaisons et des graines. La salle
// passe les MÊMES preuves que les salles à compartiments : accessibilité
// à la marge du corps, énigmes jouées par corps synthétiques.

import {
  MAT_WALL,
  MAT_GRILLE,
  MAT_MEMBRANE,
  MAT_RIDEAU,
  type LevelDef,
  type ObstacleBox,
  type WorldLabel,
  type CibleDef,
  type PorteDef,
  type LaserDef,
  type LumiereDef,
  type CacheDef,
} from './level'
import { FORME_ARC, FORME_DISQUE, FORME_CAPSULE } from './formes'
import type { CodeAtelier } from './levelIO'
import type { PreuveDef } from './generateur'

export const FIGURE_FAMILLES = [
  'anneaux',
  'spirale',
  'cortege',
  'rosace',
  'nef',
  'constellation',
  'conduits',
] as const
export type FigureFamille = (typeof FIGURE_FAMILLES)[number]

export const FIGURE_NOMS: Record<FigureFamille, string> = {
  anneaux: 'Anneaux',
  spirale: 'Spirale',
  cortege: 'Cortège',
  rosace: 'Rosace',
  nef: 'Nef',
  constellation: 'Constellation',
  conduits: 'Conduits',
}

type Rng = () => number
const entre = (rng: Rng, a: number, b: number): number => a + rng() * (b - a)
const parmi = <T>(rng: Rng, xs: readonly T[]): T =>
  xs[Math.floor(rng() * xs.length)]

interface Pt {
  x: number
  y: number
}

/** Ce que le tirage d'une famille rend au tronc commun : la géométrie, le
 * départ, la sortie — et la COUTURE FINALE (verticale, franchie vers +x)
 * sur laquelle un mécanisme peut se greffer, avec sa poche dégagée. */
interface Squelette {
  boxes: ObstacleBox[]
  labels: WorldLabel[]
  spawn: Pt
  exit: { minX: number; minY: number; maxX: number; maxY: number }
  /** La couture finale : la plaque d'indice `plaque` dans boxes la garde ;
   * un mécanisme la remplace par une porte asservie. Null : ce tirage ne
   * se prête pas au mécanisme (on n'en pose pas). */
  coutureFinale: {
    x: number
    y: number
    demiHauteur: number
    plaque: number
  } | null
  /** La poche DÉGAGÉE devant la couture finale (l'établi des énigmes) :
   * une bande garantie vide de parois, du plafond au sol de l'établi. */
  poche: { minX: number; maxX: number; y: number } | null
  /** Les bornes verticales des faisceaux d'établi (le fil à plomb court
   * du plafond au sol) : la cuve entière, sauf pour la nef (son enceinte). */
  plafond: number
  sol: number
  nbPortesEtat: number
  /** Une famille peut imposer sa CUVE (les conduits vivent dans une bande
   * serrée, pas dans le champ immense) — absente : l'ampleur commune. */
  bounds?: { minX: number; minY: number; maxX: number; maxY: number }
  /** Ses lampes (les conduits posent leur phare unique) et ses cachettes. */
  lumieres?: LumiereDef[]
  caches?: CacheDef[]
  /** Ses MÉCANISMES déjà montés (les conduits câblent leur canal-réseau
   * eux-mêmes) : quand présents, l'établi commun ne pose rien d'autre. */
  greffes?: Greffe[]
  /** La phrase d'éclairage du journal — absente : « Aucune lampe… ». */
  journalNote?: string
  /** Un vivier de noms propre à la famille — absent : le vivier commun. */
  noms?: string[]
}

// ---- Le vocabulaire géométrique (celui des tableaux faits main) ---------

const EPAISSEUR_ARC = 0.1
const COUTURE = 300 // la largeur d'une couture (l'ouverture gardée)
const GLISSEMENT = 150 // le décalage des demi-anneaux (ouvre les coutures)
const EP_PLAQUE = 100
const LONG_PLAQUE = 370
const EP_MUR = 60

/** Deux demi-anneaux de même centre, glissés le long de l'axe `tilt` :
 * le cercle brisé du crop circle — deux coutures s'ouvrent à tilt ± 90°. */
function demiAnneaux(
  A: Pt,
  r: number,
  tilt: number,
  glisse = GLISSEMENT,
): ObstacleBox[] {
  const d = r / 2 + glisse
  const th = (tilt * Math.PI) / 180
  const out: ObstacleBox[] = []
  for (const [signe, ang] of [
    [1, tilt],
    [-1, tilt - 180],
  ] as const) {
    const cx = A.x + signe * d * Math.cos(th)
    const cy = A.y + signe * d * Math.sin(th)
    out.push({
      minX: Math.round(cx - r / 2),
      minY: Math.round(cy - r),
      maxX: Math.round(cx + r / 2),
      maxY: Math.round(cy + r),
      angle: ang,
      forme: FORME_ARC,
      p0: EPAISSEUR_ARC,
      material: MAT_WALL,
    })
  }
  return out
}

/** Un anneau presque plein : UNE seule ouverture (~`gap` u) vers `dir`° —
 * pas de porte dérobée, la cellule ne se contourne pas. */
function anneauPerce(
  A: Pt,
  r: number,
  dir: number,
  gap = COUTURE,
): ObstacleBox {
  const demiGap = (gap / 2 / r) * (180 / Math.PI)
  const p1 = Math.round(180 - demiGap)
  let ang = dir - 180
  if (ang < -180) ang += 360
  const xmin = Math.cos((p1 * Math.PI) / 180)
  const off = ((1 + xmin) / 2) * r
  const th = (ang * Math.PI) / 180
  const bcx = A.x + off * Math.cos(th)
  const bcy = A.y + off * Math.sin(th)
  const hw = ((1 - xmin) / 2) * r
  return {
    minX: Math.round(bcx - hw),
    minY: Math.round(bcy - r),
    maxX: Math.round(bcx + hw),
    maxY: Math.round(bcy + r),
    angle: ang,
    forme: FORME_ARC,
    p0: EPAISSEUR_ARC,
    p1,
    material: MAT_WALL,
  }
}

/** L'enceinte carrée percée : quatre murs minces, une couture (largeur
 * `gap`) au milieu de chaque côté listé dans `coutures` (0/90/180/270). */
function carrePerce(
  A: Pt,
  demi: number,
  coutures: number[],
  gap = COUTURE,
): ObstacleBox[] {
  const out: ObstacleBox[] = []
  const mur = (
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): void => {
    out.push({
      minX: Math.round(minX),
      minY: Math.round(minY),
      maxX: Math.round(maxX),
      maxY: Math.round(maxY),
      material: MAT_WALL,
    })
  }
  for (const dir of [0, 90, 180, 270]) {
    const perce = coutures.includes(dir)
    if (dir === 0 || dir === 180) {
      const x0 = dir === 0 ? A.x + demi - EP_MUR : A.x - demi
      const x1 = dir === 0 ? A.x + demi : A.x - demi + EP_MUR
      if (!perce) mur(x0, A.y - demi, x1, A.y + demi)
      else {
        mur(x0, A.y + gap / 2, x1, A.y + demi)
        mur(x0, A.y - demi, x1, A.y - gap / 2)
      }
    } else {
      const y0 = dir === 90 ? A.y + demi - EP_MUR : A.y - demi
      const y1 = dir === 90 ? A.y + demi : A.y - demi + EP_MUR
      if (!perce) mur(A.x - demi + EP_MUR, y0, A.x + demi - EP_MUR, y1)
      else {
        mur(A.x - demi + EP_MUR, y0, A.x - gap / 2, y1)
        mur(A.x + gap / 2, y0, A.x + demi - EP_MUR, y1)
      }
    }
  }
  return out
}

/** Une CAPSULE-mur : le segment a → b en pilule (bouts ronds), demi-
 * épaisseur `demiEp`. Le vocabulaire des couronnes et des avenues. */
function capsuleMur(a: Pt, b: Pt, demiEp = 35): ObstacleBox {
  const cx = (a.x + b.x) / 2
  const cy = (a.y + b.y) / 2
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
  return {
    minX: Math.round(cx - len / 2),
    minY: Math.round(cy - demiEp),
    maxX: Math.round(cx + len / 2),
    maxY: Math.round(cy + demiEp),
    angle: Math.round(ang * 10) / 10,
    forme: FORME_CAPSULE,
    material: MAT_WALL,
  }
}

/** La plaque-filtre tangente, posée dans la couture à `dir`° du centre —
 * `frac` place son rayon (0,94 dans la bande d'un anneau, 1 sur un
 * cercle de corde). */
function plaqueFiltre(
  A: Pt,
  r: number,
  dir: number,
  mat: number,
  frac = 0.94,
): ObstacleBox {
  const ph = (dir * Math.PI) / 180
  const px = A.x + frac * r * Math.cos(ph)
  const py = A.y + frac * r * Math.sin(ph)
  let ang = dir - 90
  if (ang < -180) ang += 360
  if (ang > 180) ang -= 360
  return {
    minX: Math.round(px - LONG_PLAQUE / 2),
    minY: Math.round(py - EP_PLAQUE / 2),
    maxX: Math.round(px + LONG_PLAQUE / 2),
    maxY: Math.round(py + EP_PLAQUE / 2),
    angle: Math.round(ang),
    material: mat,
  }
}

/** Une plaque-filtre VERTICALE (couture franchie vers +x), sans rotation. */
function plaqueVerticale(
  x: number,
  y: number,
  mat: number,
  demiHauteur = LONG_PLAQUE / 2,
): ObstacleBox {
  return {
    minX: Math.round(x - EP_PLAQUE / 2),
    minY: Math.round(y - demiHauteur),
    maxX: Math.round(x + EP_PLAQUE / 2),
    maxY: Math.round(y + demiHauteur),
    material: mat,
  }
}

/** Une lune pleine (ornement) : un anneau scellé posé au large. */
function ornementLune(A: Pt, r: number): ObstacleBox[] {
  return demiAnneaux(A, r, 0, 0)
}

/** Un point (ornement) : un petit disque plein. */
function ornementPoint(A: Pt, r: number): ObstacleBox {
  return {
    minX: Math.round(A.x - r),
    minY: Math.round(A.y - r),
    maxX: Math.round(A.x + r),
    maxY: Math.round(A.y + r),
    forme: FORME_DISQUE,
    material: MAT_WALL,
  }
}

// ---- La suite des ÉTATS : quelles plaques garderont les coutures --------
// La première porte se franchit en EAU (on arrive liquide), puis la suite
// alterne — glace et vapeur dosées par la mécanique du cahier, et
// seulement dans les familles que les options autorisent.

const MATS_FILTRES = [MAT_MEMBRANE, MAT_RIDEAU, MAT_GRILLE] as const

function suiteEtats(
  rng: Rng,
  n: number,
  cahier: CodeAtelier | null,
  famillesMasque: number,
): number[] {
  // les bits de familles du générateur : grille=0, rideau=1, membrane=2
  const permis = MATS_FILTRES.filter((m) => {
    const bit = m === MAT_GRILLE ? 0 : m === MAT_RIDEAU ? 1 : 2
    return (famillesMasque & (1 << bit)) !== 0
  })
  const pool: number[] = permis.length ? [...permis] : [...MATS_FILTRES]
  const meca = cahier?.mecanique ?? 3
  const prefere: number[] =
    meca === 1
      ? [MAT_RIDEAU, MAT_MEMBRANE]
      : meca === 2
        ? [MAT_GRILLE, MAT_MEMBRANE]
        : meca === 0
          ? [MAT_MEMBRANE]
          : [MAT_MEMBRANE, MAT_RIDEAU, MAT_GRILLE]
  const jouables = prefere.filter((m) => pool.includes(m))
  const basePool = jouables.length ? jouables : pool
  const out: number[] = []
  let prec = -1
  for (let i = 0; i < n; i++) {
    if (i === 0 && basePool.includes(MAT_MEMBRANE)) {
      out.push(MAT_MEMBRANE)
      prec = MAT_MEMBRANE
      continue
    }
    // jamais deux fois le même filtre de suite quand on peut varier
    const choix = basePool.filter((m) => m !== prec)
    const m = parmi(rng, choix.length ? choix : basePool)
    out.push(m)
    prec = m
  }
  return out
}

// ---- Les familles ---------------------------------------------------------

interface ContexteFamille {
  rng: Rng
  W: number // demi-largeur de la cuve
  H: number // demi-hauteur
  nbCercles: number // le dosage de la difficulté
  etats: number[] // la suite des filtres à poser
  veutMeca: boolean // la couture finale doit-elle rester cardinale ?
  nbMecas: number // le compte exact (les conduits câblent eux-mêmes)
  ampleurScale: number // le facteur d'ampleur, pour les familles à cuve propre
}

/** anneaux / spirale : les cercles brisés concentriques. En anneaux,
 * toutes les coutures partagent le même axe incliné (le crop circle) ; en
 * spirale, les coutures TOURNENT d'un cercle à l'autre et convergent sur
 * la porte du sas. */
function figAnneaux(cx: ContexteFamille, spirale: boolean): Squelette {
  const { rng, W, H, nbCercles, veutMeca } = cx
  const A: Pt = { x: -Math.round(W * 0.14), y: 0 }
  const rMax = Math.min(W * 0.62, H * 0.72)
  const boxes: ObstacleBox[] = []
  const pas = Math.round(entre(rng, 38, 55))
  const rayons: number[] = []
  for (let k = 0; k < nbCercles; k++)
    rayons.push(Math.round((rMax * (k + 1.6)) / (nbCercles + 0.6)))
  // spirale : le DERNIER cercle garde ses coutures est/ouest et la vrille
  // remonte en arrière. anneaux : un seul axe pour tous — incliné comme le
  // crop circle, sauf si un mécanisme réclame la couture Est cardinale.
  const tiltBase = veutMeca ? 90 : parmi(rng, [90, 75, 105, 60, 120])
  const tilts = rayons.map((_, k) =>
    spirale ? 90 - (nbCercles - 1 - k) * pas : tiltBase,
  )
  let plaqueFinaleIdx = -1
  const plaques: ObstacleBox[] = []
  for (let k = 0; k < nbCercles; k++) {
    boxes.push(...demiAnneaux(A, rayons[k], tilts[k]))
    // les deux coutures du cercle k : tilt ± 90
    for (const cote of [1, -1]) {
      const dir = tilts[k] + cote * 90
      const mat = cx.etats[(k * 2 + (cote === -1 ? 1 : 0)) % cx.etats.length]
      plaques.push(plaqueFiltre(A, rayons[k], dir, mat))
      if (k === nbCercles - 1 && (((dir % 360) + 360) % 360 === 0 || dir === 0))
        plaqueFinaleIdx = plaques.length - 1
    }
  }
  const debut = boxes.length
  boxes.push(...plaques)
  const rExt = rayons[nbCercles - 1]
  const exitX = Math.min(
    W - 200,
    A.x + rExt + Math.round(entre(rng, 700, 1100)),
  )
  return {
    boxes,
    labels: [{ x: exitX + 100, y: 185, text: 'SAS', tone: 'sas' }],
    spawn: { x: A.x, y: A.y },
    exit: { minX: exitX, minY: -105, maxX: exitX + 200, maxY: 105 },
    coutureFinale:
      plaqueFinaleIdx >= 0
        ? {
            x: A.x + 0.94 * rExt,
            y: A.y,
            demiHauteur: LONG_PLAQUE / 2,
            plaque: debut + plaqueFinaleIdx,
          }
        : null,
    poche: { minX: A.x + rExt + 240, maxX: exitX - 60, y: A.y },
    plafond: H,
    sol: -H,
    nbPortesEtat: nbCercles * 2,
  }
}

/** cortège : la chaîne de cellules vers l'est — lunes et enceintes carrées
 * alternées, une seule avenue, le sas au cœur de la dernière. */
function figCortege(cx: ContexteFamille): Squelette {
  const { rng, W, H, nbCercles } = cx
  const n = Math.max(2, Math.min(4, nbCercles + 1))
  const boxes: ObstacleBox[] = []
  const labels: WorldLabel[] = []
  const rayons: number[] = []
  for (let k = 0; k < n; k++)
    rayons.push(Math.round(Math.min(H * 0.58, (W * 0.34 * (k + 1.5)) / n)))
  let inter = Math.round(entre(rng, 340, 470)) // le vide entre cellules
  // tout doit tenir entre −W et W, marges comprises
  const largeur = (): number =>
    rayons.reduce((s, r) => s + 2 * r, 0) + inter * (n - 1)
  if (largeur() > 2 * (W - 320)) {
    const f = (2 * (W - 320)) / largeur()
    for (let k = 0; k < n; k++) rayons[k] = Math.round(rayons[k] * f)
    inter = Math.round(inter * f)
  }
  let xBord = -Math.round(largeur() / 2)
  const centres: Pt[] = []
  for (let k = 0; k < n; k++) {
    centres.push({ x: xBord + rayons[k], y: 0 })
    xBord += 2 * rayons[k] + inter
  }
  let plaqueFinaleIdx = -1
  const plaques: ObstacleBox[] = []
  let iEtat = 0
  for (let k = 0; k < n; k++) {
    const A = centres[k]
    const r = rayons[k]
    const carre = k % 2 === 1 && rng() < 0.75 // l'élargissement : pas que des cercles
    if (k === 0) {
      // le berceau : une seule porte, à l'est
      if (carre) boxes.push(...carrePerce(A, r, [0]))
      else boxes.push(anneauPerce(A, r, 0))
      plaques.push(
        plaqueVerticale(
          A.x + (carre ? r - EP_MUR / 2 : 0.94 * r),
          A.y,
          cx.etats[iEtat++],
        ),
      )
    } else if (k === n - 1) {
      // la dernière : une seule porte, à l'ouest — le sas au cœur
      if (carre) boxes.push(...carrePerce(A, r, [180]))
      else boxes.push(anneauPerce(A, r, 180))
      const px = A.x - (carre ? r - EP_MUR / 2 : 0.94 * r)
      plaques.push(plaqueVerticale(px, A.y, cx.etats[iEtat++]))
      plaqueFinaleIdx = plaques.length - 1
    } else {
      // les cellules du milieu : traversées de part en part
      if (carre) boxes.push(...carrePerce(A, r, [0, 180]))
      else boxes.push(...demiAnneaux(A, r, 90))
      const dx = carre ? r - EP_MUR / 2 : 0.94 * r
      plaques.push(plaqueVerticale(A.x - dx, A.y, cx.etats[iEtat++]))
      plaques.push(plaqueVerticale(A.x + dx, A.y, cx.etats[iEtat++]))
    }
  }
  const debut = boxes.length
  boxes.push(...plaques)
  // deux lunes pleines au large — à l'OUEST du champ, loin de l'établi
  const oy = Math.round(H * 0.68)
  boxes.push(...ornementLune({ x: centres[0].x + 350, y: oy }, 210))
  boxes.push(...ornementLune({ x: centres[0].x - 250, y: -oy }, 160))
  const dernier = centres[n - 1]
  labels.push({ x: dernier.x, y: dernier.y + 180, text: 'SAS', tone: 'sas' })
  const avantDernier = centres[n - 2]
  return {
    boxes,
    labels,
    spawn: { x: centres[0].x, y: 0 },
    exit: {
      minX: dernier.x - 100,
      minY: dernier.y - 100,
      maxX: dernier.x + 100,
      maxY: dernier.y + 100,
    },
    coutureFinale: {
      x: plaques[plaqueFinaleIdx].minX + EP_PLAQUE / 2,
      y: 0,
      demiHauteur: LONG_PLAQUE / 2,
      plaque: debut + plaqueFinaleIdx,
    },
    poche: {
      minX: avantDernier.x + rayons[n - 2] + 160,
      maxX: dernier.x - rayons[n - 1] - 160,
      y: 0,
    },
    plafond: H,
    sol: -H,
    nbPortesEtat: iEtat,
  }
}

/** rosace : la chambre du cœur (une seule porte à l'est) cernée d'une
 * COURONNE DE CAPSULES — un polygone brisé de pilules, une couture gardée
 * entre chaque paire. La couture Est reste cardinale. */
function figRosace(cx: ContexteFamille): Squelette {
  const { rng, W, H, nbCercles } = cx
  const A: Pt = { x: -Math.round(W * 0.12), y: 0 }
  const nPetales = 4 + Math.min(3, nbCercles)
  const r1 = Math.round(Math.min(H * 0.28, W * 0.2))
  const r2 = Math.round(Math.min(H * 0.68, W * 0.48))
  const boxes: ObstacleBox[] = [anneauPerce(A, r1, 0)]
  const plaques: ObstacleBox[] = [
    plaqueVerticale(A.x + 0.94 * r1, A.y, cx.etats[0]),
  ]
  const gapDeg = ((COUTURE / r2) * 180) / Math.PI
  const surCercle = (deg: number): Pt => ({
    x: A.x + r2 * Math.cos((deg * Math.PI) / 180),
    y: A.y + r2 * Math.sin((deg * Math.PI) / 180),
  })
  // chaque pétale est une CORDE en capsule entre deux coutures — la corde
  // est cassée en deux segments à mi-course, léger creux vers le centre :
  // la couronne a du relief, pas un polygone plat
  let plaqueFinaleIdx = -1
  for (let k = 0; k < nPetales; k++) {
    const a0 = k * (360 / nPetales) + gapDeg / 2
    const a1 = (k + 1) * (360 / nPetales) - gapDeg / 2
    const mid = (a0 + a1) / 2
    const p0 = surCercle(a0)
    const p1 = surCercle(a1)
    const creux = 0.9
    const pm: Pt = {
      x: A.x + r2 * creux * Math.cos((mid * Math.PI) / 180),
      y: A.y + r2 * creux * Math.sin((mid * Math.PI) / 180),
    }
    boxes.push(capsuleMur(p0, pm))
    boxes.push(capsuleMur(pm, p1))
  }
  for (let k = 0; k < nPetales; k++) {
    const dirCouture = k * (360 / nPetales)
    const mat = cx.etats[(1 + k) % cx.etats.length]
    plaques.push(plaqueFiltre(A, r2, dirCouture, mat, 1))
    if (dirCouture === 0) plaqueFinaleIdx = plaques.length - 1
  }
  const debut = boxes.length
  boxes.push(...plaques)
  // un point au large, au nord-ouest — jamais dans l'établi (à l'est)
  boxes.push(
    ornementPoint(
      { x: A.x - Math.round(r2 * 1.25), y: Math.round(H * 0.55) },
      90,
    ),
  )
  const exitX = Math.min(W - 200, A.x + r2 + Math.round(entre(rng, 650, 1000)))
  return {
    boxes,
    labels: [{ x: exitX + 100, y: 185, text: 'SAS', tone: 'sas' }],
    spawn: { x: A.x, y: A.y },
    exit: { minX: exitX, minY: -105, maxX: exitX + 200, maxY: 105 },
    coutureFinale:
      plaqueFinaleIdx >= 0
        ? {
            x: A.x + r2,
            y: A.y,
            demiHauteur: LONG_PLAQUE / 2,
            plaque: debut + plaqueFinaleIdx,
          }
        : null,
    poche: { minX: A.x + r2 + 240, maxX: exitX - 60, y: A.y },
    plafond: H,
    sol: -H,
    nbPortesEtat: 1 + nPetales,
  }
}

/** nef : l'orthogonale — une grande enceinte rectangulaire, des cloisons
 * percées d'une couture centrale, des paires de colonnes entre elles. */
function figNef(cx: ContexteFamille): Squelette {
  const { rng, W, H, nbCercles } = cx
  const demiL = Math.round(W * 0.68)
  const demiH = Math.round(Math.min(H * 0.5, demiL * 0.42))
  const boxes: ObstacleBox[] = []
  // l'enceinte : quatre murs pleins
  boxes.push({
    minX: -demiL,
    minY: demiH - EP_MUR,
    maxX: demiL,
    maxY: demiH,
    material: MAT_WALL,
  })
  boxes.push({
    minX: -demiL,
    minY: -demiH,
    maxX: demiL,
    maxY: -demiH + EP_MUR,
    material: MAT_WALL,
  })
  boxes.push({
    minX: -demiL,
    minY: -demiH,
    maxX: -demiL + EP_MUR,
    maxY: demiH,
    material: MAT_WALL,
  })
  boxes.push({
    minX: demiL - EP_MUR,
    minY: -demiH,
    maxX: demiL,
    maxY: demiH,
    material: MAT_WALL,
  })
  const nCloisons = Math.max(2, Math.min(3, nbCercles))
  const plaques: ObstacleBox[] = []
  const utile = 2 * demiL - 2 * EP_MUR
  const baie = utile / (nCloisons + 1)
  const xs: number[] = []
  for (let k = 1; k <= nCloisons; k++) {
    const x = Math.round(-demiL + EP_MUR + baie * k)
    xs.push(x)
    boxes.push({
      minX: x - EP_MUR / 2,
      minY: COUTURE / 2,
      maxX: x + EP_MUR / 2,
      maxY: demiH - EP_MUR,
      material: MAT_WALL,
    })
    boxes.push({
      minX: x - EP_MUR / 2,
      minY: -demiH + EP_MUR,
      maxX: x + EP_MUR / 2,
      maxY: -COUTURE / 2,
      material: MAT_WALL,
    })
    plaques.push(plaqueVerticale(x, 0, cx.etats[k - 1], COUTURE / 2))
  }
  const plaqueFinaleIdx = plaques.length - 1
  const debut = boxes.length
  boxes.push(...plaques)
  // les colonnes : une paire par baie — sauf la baie de l'établi (celle
  // qui précède la dernière cloison), gardée dégagée pour les faisceaux
  const rCol = 70
  const yCol = Math.round(demiH * 0.5)
  for (let k = 0; k <= nCloisons; k++) {
    if (k === nCloisons - 1) continue
    const cxB = Math.round(-demiL + EP_MUR + baie * (k + 0.5))
    if (rng() < 0.85) {
      boxes.push(ornementPoint({ x: cxB, y: yCol }, rCol))
      boxes.push(ornementPoint({ x: cxB, y: -yCol }, rCol))
    }
  }
  const exitX = demiL - EP_MUR - 170
  return {
    boxes,
    labels: [{ x: exitX + 30, y: 185, text: 'SAS', tone: 'sas' }],
    spawn: { x: -demiL + EP_MUR + Math.round(baie * 0.5), y: 0 },
    exit: { minX: exitX - 100, minY: -100, maxX: exitX + 100, maxY: 100 },
    coutureFinale: {
      x: xs[nCloisons - 1],
      y: 0,
      demiHauteur: COUTURE / 2,
      plaque: debut + plaqueFinaleIdx,
    },
    poche: {
      minX: Math.round(xs[nCloisons - 1] - baie + 140),
      maxX: xs[nCloisons - 1] - 90,
      y: 0,
    },
    plafond: demiH - EP_MUR,
    sol: -demiH + EP_MUR,
    nbPortesEtat: nCloisons,
  }
}

/** constellation : des cellules posées en diagonale douce, reliées par le
 * vide — chaque cellule n'a qu'une porte, tournée vers la voisine. La
 * cellule finale revient sur l'axe, sa porte regarde l'ouest. */
function figConstellation(cx: ContexteFamille): Squelette {
  const { rng, W, H, nbCercles } = cx
  const n = Math.max(3, Math.min(4, nbCercles + 1))
  const boxes: ObstacleBox[] = []
  const labels: WorldLabel[] = []
  const rayons: number[] = []
  for (let k = 0; k < n; k++) rayons.push(Math.round(entre(rng, 300, 430)))
  const centres: Pt[] = []
  const pasX = Math.round(
    (2 * W - 900 - 2 * rayons[0] - 2 * rayons[n - 1]) / Math.max(1, n - 1),
  )
  let x = -W + 450 + rayons[0]
  let signe = rng() < 0.5 ? 1 : -1
  for (let k = 0; k < n; k++) {
    const y =
      k === 0 || k === n - 1
        ? 0
        : signe * Math.round(entre(rng, H * 0.2, H * 0.45))
    centres.push({ x, y })
    signe = -signe
    x += pasX
  }
  const plaques: ObstacleBox[] = []
  let plaqueFinaleIdx = -1
  let iEtat = 0
  for (let k = 0; k < n; k++) {
    const A = centres[k]
    const r = rayons[k]
    const mat = cx.etats[iEtat++]
    if (k === n - 1) {
      // la couture finale : cardinale, elle regarde l'ouest
      boxes.push(anneauPerce(A, r, 180))
      plaques.push(plaqueVerticale(A.x - 0.94 * r, A.y, mat))
      plaqueFinaleIdx = plaques.length - 1
    } else {
      const vers = centres[k + 1]
      const dir = (Math.atan2(vers.y - A.y, vers.x - A.x) * 180) / Math.PI
      boxes.push(anneauPerce(A, r, dir))
      plaques.push(plaqueFiltre(A, r, dir, mat))
    }
  }
  const debut = boxes.length
  boxes.push(...plaques)
  const avantDernier = centres[n - 2]
  const dernier = centres[n - 1]
  const pocheMinX = avantDernier.x + rayons[n - 2] + 160
  // la poussière du ciel : trois points au large — jamais dans l'établi
  for (let k = 0; k < 3; k++) {
    const px = Math.round(
      entre(rng, -W * 0.7, Math.min(W * 0.7, pocheMinX - 160)),
    )
    const py = (k % 2 ? 1 : -1) * Math.round(entre(rng, H * 0.6, H * 0.8))
    boxes.push(ornementPoint({ x: px, y: py }, Math.round(entre(rng, 50, 80))))
  }
  labels.push({ x: dernier.x, y: dernier.y + 180, text: 'SAS', tone: 'sas' })
  return {
    boxes,
    labels,
    spawn: { x: centres[0].x, y: centres[0].y },
    exit: {
      minX: dernier.x - 100,
      minY: dernier.y - 100,
      maxX: dernier.x + 100,
      maxY: dernier.y + 100,
    },
    coutureFinale: {
      x: dernier.x - 0.94 * rayons[n - 1],
      y: dernier.y,
      demiHauteur: LONG_PLAQUE / 2,
      plaque: debut + plaqueFinaleIdx,
    },
    poche: {
      minX: pocheMinX,
      maxX: dernier.x - rayons[n - 1] - 160,
      y: dernier.y,
    },
    plafond: H,
    sol: -H,
    nbPortesEtat: iEtat,
  }
}

/** conduits : la leçon des « conduits de ventilation » (BOIZ) — la
 * philosophie INVERSE du crop circle, et c'est voulu :
 *   · des GAINES, pas des salles : murs minces (22 u), couloirs étroits,
 *     une cuve compacte en bande — on est de la fumée dans des conduits ;
 *   · un SERPENTIN d'étages horizontaux tissés par de courts puits
 *     décalés, et une BAIE DES MACHINES pleine hauteur à l'est ;
 *   · un CANAL-RÉSEAU : une pastille-maître ouvre PLUSIEURS portes à la
 *     fois, réparties dans les puits — toucher une cible déverrouille
 *     l'étage entier ;
 *   · le SAS AU CŒUR : tout près du départ à vol d'oiseau, mais muré —
 *     le réseau force le grand tour par la baie ;
 *   · UNE SEULE LAMPE, posée sur le sas — le phare dans la pénombre —
 *     et une CACHETTE dans un cul-de-sac de gaine. */
function figConduits(cx: ContexteFamille): Squelette {
  const { nbCercles, nbMecas, ampleurScale } = cx
  const T = 22 // l'épaisseur des parois de gaine (celle de BOIZ)
  const DUCT = 130 // la hauteur intérieure d'une gaine
  const GAP = 150 // la largeur d'un puits entre deux étages
  const R = nbCercles + 2 // 4..6 étages
  const s = ampleurScale
  const halfW = Math.round(1150 * s)
  const bayW = Math.round(620 * Math.min(s, 1.1))
  const xBay = halfW - bayW
  const innerH = R * DUCT + (R - 1) * T
  const yBas = -Math.round(innerH / 2)
  const rowBottom = (i: number): number => yBas + i * (DUCT + T)
  const rowTop = (i: number): number => rowBottom(i) + DUCT
  const rowMid = (i: number): number => rowBottom(i) + DUCT / 2

  const boxes: ObstacleBox[] = []
  const labels: WorldLabel[] = []
  const portes: PorteDef[] = []
  const greffes: Greffe[] = []
  const mur = (
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): void => {
    boxes.push({
      minX: Math.round(minX),
      minY: Math.round(minY),
      maxX: Math.round(maxX),
      maxY: Math.round(maxY),
      material: MAT_WALL,
    })
  }
  const plaquette = (
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    mat: number,
  ): void => {
    boxes.push({
      minX: Math.round(minX),
      minY: Math.round(minY),
      maxX: Math.round(maxX),
      maxY: Math.round(maxY),
      material: mat,
    })
  }

  // LE VESTIBULE : le coin de naissance, haut de deux gaines à l'ouest —
  // le corps naît au large (120 u de dégagement exigés) avant de se
  // glisser dans le réseau ; sa bouche est une membrane (on entre en eau).
  const xVest = -halfW + 400
  plaquette(xVest, rowBottom(0), xVest + T, rowTop(1), MAT_MEMBRANE)
  let nbFiltres = 1

  // les étages : un mur entre chaque paire, percé d'UN puits alterné
  // ouest/est — le serpentin. Deux ou trois puits reçoivent une PORTE du
  // canal-réseau ; les autres, une plaque-filtre d'état.
  let iEtat = 1
  const puitsPorte = new Set<number>()
  if (nbMecas > 0) {
    // les portes du réseau : un puits sur deux, au moins deux
    for (let j = 1; j < R; j += 2) puitsPorte.add(j)
    if (puitsPorte.size < 2 && R > 2) puitsPorte.add(2)
  }
  for (let j = 1; j < R; j++) {
    const wy = rowTop(j - 1)
    const xDebut = j === 1 ? xVest + T : -halfW
    const gx = j % 2 === 1 ? xVest + T + 260 : xBay - 190
    mur(xDebut, wy, gx - GAP / 2, wy + T)
    mur(gx + GAP / 2, wy, xBay, wy + T)
    if (puitsPorte.has(j)) {
      portes.push({
        minX: Math.round(gx - GAP / 2),
        minY: wy,
        maxX: Math.round(gx + GAP / 2),
        maxY: wy + T,
        canal: 2,
      })
    } else {
      plaquette(gx - GAP / 2, wy, gx + GAP / 2, wy + T, cx.etats[iEtat++])
      nbFiltres++
    }
  }
  // la paroi de la baie : pleine hauteur, ouverte seulement à l'étage du
  // bas (l'aller) et à l'étage du haut (le retour)
  mur(xBay, rowTop(0), xBay + T, rowBottom(R - 1))

  // LE SAS AU CŒUR : une chambre murée au milieu du serpentin — son
  // entrée est une porte (canal 1) ou, sans mécanisme, un filtre.
  const m = Math.floor(R / 2)
  const cxCh = Math.round(-halfW * 0.25)
  const demiCh = 190
  mur(cxCh - demiCh - T, rowBottom(m), cxCh - demiCh, rowTop(m))
  if (nbMecas >= 2) {
    portes.push({
      minX: cxCh + demiCh,
      minY: rowBottom(m),
      maxX: cxCh + demiCh + T,
      maxY: rowTop(m),
      canal: 1,
    })
  } else {
    plaquette(
      cxCh + demiCh,
      rowBottom(m),
      cxCh + demiCh + T,
      rowTop(m),
      cx.etats[iEtat++],
    )
    nbFiltres++
  }
  const exit = {
    minX: cxCh - 80,
    minY: Math.round(rowMid(m)) - 55,
    maxX: cxCh + 80,
    maxY: Math.round(rowMid(m)) + 55,
  }
  labels.push({ x: cxCh, y: rowTop(m) + 46, text: 'SAS', tone: 'sas' })

  // une COUTURE D'ÉTAT en travers du retour : la gaine du haut exige un
  // autre état que l'eau du vestibule
  plaquette(
    Math.round((xBay - halfW) / 2),
    rowBottom(R - 1),
    Math.round((xBay - halfW) / 2) + T,
    rowTop(R - 1),
    cx.etats[1 + (iEtat % 2)],
  )
  nbFiltres++

  // LA BAIE DES MACHINES : les fils à plomb du canal-réseau (canal 2,
  // les portes des puits) et du sas (canal 1) — deux miroirs de glace,
  // aux hauteurs et aux renvois séparés pour que rien ne s'allume seul.
  if (nbMecas > 0) {
    const plafond = -yBas
    const mx1 = xBay + T + 140
    const ys1 = Math.round(innerH * 0.1)
    const em1: LaserDef = { x: mx1, y: plafond - 24, angle: -90 }
    const n1 = { nx: Math.SQRT1_2, ny: Math.SQRT1_2 } // renvoi vers l'est
    const L1 = 250
    greffes.push({
      lasers: [em1],
      cibles: [
        { x: mx1 + n1.nx * 8 + L1, y: ys1 + 44 + n1.ny * 8, r: 26, canal: 2 },
      ],
      portes: [],
      labels: [
        {
          x: mx1,
          y: ys1 - 74,
          text: 'MIROIR DE GLACE',
          tone: 'froid',
          rang: 'detail',
        },
        {
          x: mx1 + 130,
          y: ys1 + 150,
          text: 'OUVRE LE RÉSEAU',
          tone: 'grille',
          rang: 'detail',
        },
      ],
      preuves: [
        {
          kind: 'miroir',
          canal: 2,
          emetteur: em1,
          spot: { x: mx1, y: ys1 },
          normale: n1,
          cibleIndex: -1,
        },
      ],
    })
    if (nbMecas >= 2) {
      const mx2 = xBay + T + 480
      const ys2 = -Math.round(innerH * 0.22)
      const em2: LaserDef = { x: mx2, y: plafond - 24, angle: -90 }
      const n2 = { nx: -Math.SQRT1_2, ny: Math.SQRT1_2 } // renvoi vers l'ouest
      const L2 = 200
      greffes.push({
        lasers: [em2],
        cibles: [
          { x: mx2 + n2.nx * 8 - L2, y: ys2 + 44 + n2.ny * 8, r: 26, canal: 1 },
        ],
        portes: [],
        labels: [
          {
            x: mx2,
            y: ys2 - 74,
            text: 'MIROIR DE GLACE',
            tone: 'froid',
            rang: 'detail',
          },
          {
            x: mx2 - 130,
            y: ys2 + 150,
            text: 'OUVRE LE SAS',
            tone: 'sas',
            rang: 'detail',
          },
        ],
        preuves: [
          {
            kind: 'miroir',
            canal: 1,
            emetteur: em2,
            spot: { x: mx2, y: ys2 },
            normale: n2,
            cibleIndex: -1,
          },
        ],
      })
    }
    // les portes du réseau voyagent avec la première greffe (canal 2),
    // celle du sas avec la seconde (canal 1)
    greffes[0].portes = portes.filter((p) => p.canal === 2)
    if (greffes.length > 1)
      greffes[1].portes = portes.filter((p) => p.canal === 1)
    else if (portes.some((p) => p.canal === 1)) greffes[0].portes = portes
  }

  // LA CACHETTE : le bout mort d'une gaine, sous cache — le coin que le
  // serpentin n'exige pas
  const iCache = Math.min(R - 2, m + 1)
  const caches: CacheDef[] = [
    {
      minX: -halfW,
      minY: rowBottom(iCache),
      maxX: -halfW + 150,
      maxY: rowTop(iCache),
    },
  ]

  return {
    boxes,
    labels,
    spawn: { x: -halfW + 190, y: Math.round((rowBottom(0) + rowTop(1)) / 2) },
    exit,
    coutureFinale: null, // les conduits câblent leurs mécanismes eux-mêmes
    poche: null,
    plafond: -yBas,
    sol: yBas,
    nbPortesEtat: nbFiltres,
    bounds: {
      minX: -halfW,
      minY: yBas,
      maxX: halfW,
      maxY: -yBas,
    },
    lumieres: [{ x: cxCh, y: Math.round(rowMid(m)) }],
    caches,
    greffes,
    journalNote:
      'Une seule lampe, posée sur le sas — le reste du réseau vit dans la pénombre. ',
    noms: [
      'Les conduits',
      'La gaine',
      'Le plénum',
      'La reprise d’air',
      'Le soufflage',
      'L’extracteur',
    ],
  }
}

// ---- Les MÉCANISMES greffés sur la couture finale ------------------------

interface Greffe {
  lasers: LaserDef[]
  cibles: CibleDef[]
  portes: PorteDef[]
  labels: WorldLabel[]
  preuves: PreuveDef[]
}

function porteDeCouture(
  couture: NonNullable<Squelette['coutureFinale']>,
  canal: number,
): PorteDef {
  return {
    minX: Math.round(couture.x - 35),
    minY: Math.round(couture.y - couture.demiHauteur),
    maxX: Math.round(couture.x + 35),
    maxY: Math.round(couture.y + couture.demiHauteur),
    canal,
  }
}

/** Le MIROIR DE GLACE à l'établi : dans la poche dégagée, un fil à plomb
 * tombe du plafond ; le corps gelé au point marqué le renvoie vers l'est
 * sur la pastille — la porte de la couture finale s'ouvre. */
function greffeMiroir(
  rng: Rng,
  plafond: number,
  couture: NonNullable<Squelette['coutureFinale']>,
  poche: NonNullable<Squelette['poche']>,
  canal: number,
): Greffe {
  const mx =
    Math.round(
      entre(
        rng,
        poche.minX + 80,
        Math.max(poche.minX + 120, poche.maxX - 340),
      ) / 10,
    ) * 10
  const decalY = Math.min(320, Math.max(180, plafond - poche.y - 220))
  const ys = Math.round((poche.y + decalY) / 10) * 10
  const em: LaserDef = { x: mx, y: plafond - 24, angle: -90 }
  const d = { x: 0, y: -1 }
  const r = { x: 1, y: 0 }
  const nl = Math.hypot(r.x - d.x, r.y - d.y)
  const normale = { nx: (r.x - d.x) / nl, ny: (r.y - d.y) / nl }
  const L = Math.round(entre(rng, 170, 300))
  const cible: CibleDef = {
    x: mx - d.x * 44 + normale.nx * 8 + r.x * L,
    y: ys - d.y * 44 + normale.ny * 8 + r.y * L,
    r: 30,
    canal,
  }
  return {
    lasers: [em],
    cibles: [cible],
    portes: [porteDeCouture(couture, canal)],
    labels: [
      {
        x: mx,
        y: ys - 74,
        text: 'MIROIR DE GLACE',
        tone: 'froid',
        rang: 'detail',
      },
    ],
    preuves: [
      {
        kind: 'miroir',
        canal,
        emetteur: em,
        spot: { x: mx, y: ys },
        normale,
        cibleIndex: -1, // recalé par l'appelant (indices globaux)
      },
    ],
  }
}

/** La BARRIÈRE TENUE en travers de l'avenue : le faisceau tombe du plafond
 * jusqu'à sa pastille NOR au sol — l'eau le plie et scelle, la vapeur
 * passe. La porte de la couture finale est tenue par la pastille. */
function greffeBarriere(
  rng: Rng,
  plafond: number,
  sol: number,
  couture: NonNullable<Squelette['coutureFinale']>,
  poche: NonNullable<Squelette['poche']>,
  canal: number,
): Greffe {
  const bx =
    Math.round(
      entre(rng, poche.minX + 60, Math.max(poche.minX + 100, poche.maxX - 60)) /
        10,
    ) * 10
  const em: LaserDef = { x: bx, y: plafond - 24, angle: -90 }
  const cible: CibleDef = { x: bx, y: sol + 52, r: 22, mode: 'nor', canal }
  return {
    lasers: [em],
    cibles: [cible],
    portes: [porteDeCouture(couture, canal)],
    labels: [
      {
        x: bx,
        y: poche.y + 120,
        text: 'TRAVERSER EN VAPEUR',
        tone: 'grille',
        rang: 'detail',
      },
    ],
    preuves: [
      {
        kind: 'nor',
        canal,
        emetteur: em,
        spot: { x: bx, y: poche.y },
        normale: { nx: 0, ny: 0 },
        cibleIndex: -1,
      },
    ],
  }
}

// ---- L'entrée du module ---------------------------------------------------

export interface ReglagesFigure {
  /** 1 : famille tirée de la graine · 2.. : famille forcée (index dans
   * FIGURE_FAMILLES + 2). */
  figure: number
  ampleur: 0 | 1 | 2 | 3
  mecanismes: 0 | 1 | 2 | 3
  famillesMasque: number
}

export function essaieFigure(
  rng: Rng,
  reglages: ReglagesFigure,
  cahier: CodeAtelier | null,
  ident: string,
): LevelDef & { __preuves?: PreuveDef[] } {
  // l'AMPLEUR : la taille du champ
  const amp =
    reglages.ampleur === 0
      ? cahier && cahier.difficulte >= 5
        ? 3
        : 2
      : reglages.ampleur
  const [W, H] =
    amp === 1 ? [2300, 1800] : amp === 2 ? [3000, 2500] : [3700, 3000]
  // la FAMILLE
  const famille: FigureFamille =
    reglages.figure >= 2 && reglages.figure - 2 < FIGURE_FAMILLES.length
      ? FIGURE_FAMILLES[reglages.figure - 2]
      : parmi(rng, FIGURE_FAMILLES)
  // le DOSAGE : la difficulté (cahier ou graine) fait le nombre de cercles
  const D = cahier ? cahier.difficulte : Math.floor(entre(rng, 1, 7))
  const nbCercles = D <= 2 ? 2 : D <= 5 ? 3 : 4
  // les MÉCANISMES : décidés avant la géométrie (la couture finale d'une
  // figure à mécanisme doit rester cardinale)
  const nbMecas =
    reglages.mecanismes === 1
      ? 0
      : reglages.mecanismes === 2
        ? 1
        : reglages.mecanismes === 3
          ? 2
          : cahier
            ? cahier.difficulte >= 4
              ? 1
              : 0
            : rng() < 0.35
              ? 1
              : 0
  const etats = suiteEtats(
    rng,
    nbCercles * 2 + 8,
    cahier,
    reglages.famillesMasque,
  )
  const cx: ContexteFamille = {
    rng,
    W,
    H,
    nbCercles,
    etats,
    veutMeca: nbMecas > 0,
    nbMecas,
    ampleurScale: amp === 1 ? 0.85 : amp === 2 ? 1 : 1.2,
  }
  const sq =
    famille === 'anneaux'
      ? figAnneaux(cx, false)
      : famille === 'spirale'
        ? figAnneaux(cx, true)
        : famille === 'cortege'
          ? figCortege(cx)
          : famille === 'rosace'
            ? figRosace(cx)
            : famille === 'nef'
              ? figNef(cx)
              : famille === 'constellation'
                ? figConstellation(cx)
                : figConduits(cx)

  const lasers: LaserDef[] = []
  const cibles: CibleDef[] = []
  const portes: PorteDef[] = []
  const preuves: PreuveDef[] = []
  const labels = [...sq.labels]
  const boxes = [...sq.boxes]

  // les greffes : celles que la famille a montées elle-même (conduits),
  // sinon l'établi commun sur la couture finale
  let greffes: Greffe[] = sq.greffes ?? []
  if (
    greffes.length === 0 &&
    nbMecas > 0 &&
    sq.coutureFinale &&
    sq.poche &&
    sq.poche.maxX - sq.poche.minX > 260
  ) {
    greffes = []
    const parMiroir = rng() < 0.5
    greffes.push(
      parMiroir
        ? greffeMiroir(rng, sq.plafond, sq.coutureFinale, sq.poche, 1)
        : greffeBarriere(
            rng,
            sq.plafond,
            sq.sol,
            sq.coutureFinale,
            sq.poche,
            1,
          ),
    )
    if (nbMecas > 1) {
      // la seconde énigme partage la poche, garde son canal : deux
      // verrous s'empilent sur la même couture
      greffes.push(
        parMiroir
          ? greffeBarriere(
              rng,
              sq.plafond,
              sq.sol,
              sq.coutureFinale,
              sq.poche,
              2,
            )
          : greffeMiroir(rng, sq.plafond, sq.coutureFinale, sq.poche, 2),
      )
    }
    // la plaque-filtre de la couture finale cède sa place aux portes
    if (sq.coutureFinale) boxes.splice(sq.coutureFinale.plaque, 1)
  }
  for (const g of greffes) {
    for (const em of g.lasers) lasers.push(em)
    for (const p of g.portes) portes.push(p)
    for (const l of g.labels) labels.push(l)
    for (let i = 0; i < g.cibles.length; i++) {
      cibles.push(g.cibles[i])
      g.preuves[i].cibleIndex = cibles.length - 1
    }
    for (const p of g.preuves) preuves.push(p)
  }

  const noms = sq.noms ?? [
    'Le glyphe',
    'La figure',
    'Le sceau',
    'L’empreinte',
    'La couronne',
    'Le motif',
    'L’orbe',
    'La gravure',
  ]
  const journal =
    `Relevé du champ (graine ${ident}). La figure est apparue d'un bloc — ` +
    `${FIGURE_NOMS[famille].toLowerCase()}, ${sq.nbPortesEtat} coutures gardées` +
    (preuves.length
      ? `, ${preuves.length} mécanisme${preuves.length > 1 ? 's' : ''}`
      : '') +
    `. ` +
    (sq.journalNote ?? 'Aucune lampe : la lumière de base sculpte seule. ') +
    `Traversée démontrée par le traceur avant consignation. — Unité GÉN.`
  const level: LevelDef & { __preuves?: PreuveDef[] } = {
    name: `${parmi(rng, noms)} ${ident}`,
    code: `G-${ident}`,
    journal,
    bounds: sq.bounds ?? { minX: -W, minY: -H, maxX: W, maxY: H },
    spawn: { x: Math.round(sq.spawn.x), y: Math.round(sq.spawn.y), n: 900 },
    exit: sq.exit,
    boxes,
    sponges: [],
    labels,
    ...(lasers.length ? { lasers } : {}),
    ...(cibles.length ? { cibles } : {}),
    ...(portes.length ? { portes } : {}),
    ...(sq.lumieres?.length ? { lumieres: sq.lumieres } : {}),
    ...(sq.caches?.length ? { caches: sq.caches } : {}),
    par: 3 + Math.round(sq.nbPortesEtat / 2) + 2 * preuves.length,
  }
  level.__preuves = preuves
  return level
}
