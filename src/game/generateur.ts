// Le GÉNÉRATEUR DE SALLES : une graine → un tableau complet, PROUVÉ
// traversable avant d'être remis au joueur. La recette qui évite la soupe
// aléatoire : on tire d'abord la CHAÎNE D'INTENTIONS (la suite des
// franchissements — évent, rideau, membrane, porte au laser), puis on
// habille chaque maillon en géométrie, et l'on REFUSE tout tirage dont la
// traversée ne se démontre pas :
//   · accessibilité spawn → sas par parcours en largeur, avec la marge du
//     corps (aucun goulet infranchissable) — les surfaces à état (évent,
//     rideau, membrane) comptent passantes, puisqu'un état du corps les
//     traverse et que l'état se choisit librement ;
//   · chaque porte asservie est prouvée OUVRABLE par le VRAI traceur de
//     faisceau (laser.ts) : on y pose un miroir de glace synthétique à
//     l'endroit prévu pour le joueur — si le reflet n'allume pas la
//     pastille, le tirage est rejeté. Et sans miroir, le faisceau ne doit
//     PAS l'allumer : la salle ne s'ouvre pas toute seule.
// Même graine, même salle — le générateur est déterministe : une salle se
// partage par son code (G-…), se rejoue, se retouche à l'éditeur.

import {
  MAT_WALL,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_FROID,
  MAT_GRILLE,
  MAT_CHAUD,
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
  type DecalDef,
} from './level'
import { traceLaser, type TraceMonde } from './laser'
import { checkLevel } from './levelIO'

// ---- Le hasard APPRIVOISÉ : mulberry32, la graine fait tout -------------
export function creeRng(graine: number): () => number {
  let a = graine >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rng = () => number
const entre = (rng: Rng, a: number, b: number): number => a + rng() * (b - a)
const parmi = <T>(rng: Rng, xs: readonly T[]): T =>
  xs[Math.floor(rng() * xs.length)]

// ---- La CHAÎNE : ce que chaque cloison exige pour être franchie ---------
export type Maillon = 'libre' | 'grille' | 'rideau' | 'membrane' | 'porte'

// La marge du corps pour le parcours de validation : un couloir plus étroit
// que ça n'est pas un passage, c'est un piège à goutte.
const MARGE_CORPS = 40
const PAS_GRILLE_VALID = 20 // résolution du parcours en largeur (u)

interface Plan {
  H: number // hauteur de la cuve
  largeurs: number[] // largeur intérieure de chaque salle
  maillons: Maillon[] // un par cloison (salles − 1)
  cloisonX: number[] // bord gauche de chaque cloison
  x0: number // bord gauche intérieur de la cuve
  x1: number // bord droit intérieur
}

const EP_CLOISON = 60

/** Un tirage de plan : la chaîne d'abord, la géométrie ensuite. */
function tirePlan(rng: Rng): Plan {
  const nbSalles = 3 + Math.floor(rng() * 3) // 3, 4 ou 5
  const H = Math.round(entre(rng, 1150, 1450) / 10) * 10
  const largeurs: number[] = []
  for (let i = 0; i < nbSalles; i++)
    largeurs.push(Math.round(entre(rng, 640, 880) / 10) * 10)
  // la chaîne : au moins UN maillon à état ou à porte — sinon c'est un couloir
  const types: Maillon[] = ['libre', 'grille', 'rideau', 'membrane', 'porte']
  let maillons: Maillon[] = []
  let portes = 0
  do {
    maillons = []
    portes = 0
    for (let i = 0; i + 1 < nbSalles; i++) {
      let m = parmi(rng, types)
      if (m === 'porte' && portes >= 2) m = 'grille' // deux énigmes laser au plus
      if (m === 'porte') portes++
      maillons.push(m)
    }
  } while (maillons.every((m) => m === 'libre'))
  const total =
    largeurs.reduce((s, l) => s + l, 0) + (nbSalles - 1) * EP_CLOISON
  const x0 = -Math.round(total / 2)
  const cloisonX: number[] = []
  let x = x0
  for (let i = 0; i + 1 < nbSalles; i++) {
    x += largeurs[i]
    cloisonX.push(x)
    x += EP_CLOISON
  }
  return { H, largeurs, maillons, cloisonX, x0, x1: x0 + total }
}

interface Rect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const gonfle = (r: Rect, m: number): Rect => ({
  minX: r.minX - m,
  minY: r.minY - m,
  maxX: r.maxX + m,
  maxY: r.maxY + m,
})
const chevauche = (a: Rect, b: Rect): boolean =>
  a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY

/** La boîte englobante VRAIE d'une pièce pivotée : ses coins débordent de
 * min/max (définis avant rotation) — la validation doit voir large. */
function aabbVraie(b: Rect & { angle?: number }): Rect {
  if (!b.angle) return b
  const hx = (b.maxX - b.minX) / 2
  const hy = (b.maxY - b.minY) / 2
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  const rad = (b.angle * Math.PI) / 180
  const c = Math.abs(Math.cos(rad))
  const s = Math.abs(Math.sin(rad))
  const ex = hx * c + hy * s
  const ey = hx * s + hy * c
  return { minX: cx - ex, minY: cy - ey, maxX: cx + ex, maxY: cy + ey }
}

/** Un essai de salle complet — géométrie, mécanismes, habillage. */
function essaieNiveau(graine: number, rng: Rng): LevelDef {
  const plan = tirePlan(rng)
  const { H } = plan
  const demiH = H / 2
  const bounds = { minX: plan.x0 - 40, minY: -demiH, maxX: plan.x1 + 40, maxY: demiH }

  const boxes: ObstacleBox[] = []
  const labels: WorldLabel[] = []
  const cibles: CibleDef[] = []
  const portes: PorteDef[] = []
  const lasers: LaserDef[] = []
  const lumieres: LumiereDef[] = []
  const caches: CacheDef[] = []
  const decals: DecalDef[] = []
  // les couloirs à garder LIBRES : le chemin, les faisceaux, le spawn, le sas
  const reserves: Rect[] = []

  // bornes intérieures de chaque salle
  const salleX: [number, number][] = []
  {
    let x = plan.x0
    for (let i = 0; i < plan.largeurs.length; i++) {
      salleX.push([x, x + plan.largeurs[i]])
      x += plan.largeurs[i] + EP_CLOISON
    }
  }

  const spawn = {
    x: plan.x0 + 230,
    y: 0,
    n: 700,
  }
  reserves.push({ minX: spawn.x - 230, minY: -230, maxX: spawn.x + 230, maxY: 230 })

  const fin = salleX[salleX.length - 1][1]
  const exit = {
    minX: fin - 130,
    minY: -110,
    maxX: fin - 10,
    maxY: 110,
  }
  labels.push({ x: (exit.minX + exit.maxX) / 2, y: exit.maxY + 60, text: 'SAS', tone: 'sas' })
  reserves.push(gonfle(exit, 140))

  // ---- les cloisons et leurs maillons ----
  const gaps: { x: number; y: number }[] = [] // le centre de chaque passage
  let canalSuivant = 1
  // les preuves à mener : pour chaque porte, l'énigme du miroir
  const preuves: {
    canal: number
    emetteur: LaserDef
    miroir: { x: number; y: number }
    cible: CibleDef
  }[] = []

  for (let i = 0; i < plan.cloisonX.length; i++) {
    const wx = plan.cloisonX[i]
    const maillon = plan.maillons[i]
    const gapH = Math.round(entre(rng, 220, 290) / 10) * 10
    const gy = Math.round(entre(rng, -demiH + 260, demiH - 260) / 10) * 10
    const gapMin = gy - gapH / 2
    const gapMax = gy + gapH / 2
    // les deux pans de la cloison, au-dessus et au-dessous du passage
    boxes.push({ minX: wx, minY: gapMax, maxX: wx + EP_CLOISON, maxY: demiH, material: MAT_WALL, skin: 1 + Math.floor(rng() * 4) })
    boxes.push({ minX: wx, minY: -demiH, maxX: wx + EP_CLOISON, maxY: gapMin, material: MAT_WALL, skin: 1 + Math.floor(rng() * 4) })
    gaps.push({ x: wx + EP_CLOISON / 2, y: gy })
    // le couloir du passage reste dégagé de part et d'autre
    reserves.push({ minX: wx - 190, minY: gapMin - 40, maxX: wx + EP_CLOISON + 190, maxY: gapMax + 40 })

    if (maillon === 'grille' || maillon === 'rideau' || maillon === 'membrane') {
      const mat =
        maillon === 'grille' ? MAT_GRILLE : maillon === 'rideau' ? MAT_RIDEAU : MAT_MEMBRANE
      boxes.push({ minX: wx, minY: gapMin, maxX: wx + EP_CLOISON, maxY: gapMax, material: mat })
      const tone = maillon === 'grille' ? 'grille' : maillon === 'rideau' ? 'froid' : 'phile'
      const nom =
        maillon === 'grille' ? 'ÉVENT' : maillon === 'rideau' ? 'RIDEAU' : 'MEMBRANE'
      labels.push({ x: wx + EP_CLOISON / 2, y: gapMax + 60, text: nom, tone, rang: 'detail' })
    } else if (maillon === 'porte') {
      const canal = canalSuivant++
      portes.push({ minX: wx, minY: gapMin, maxX: wx + EP_CLOISON, maxY: gapMax, canal })
      // L'ÉNIGME DU MIROIR, dans la salle à GAUCHE de la porte : un émetteur
      // au plafond tire un fil à plomb de lumière ; le joueur gèle son corps
      // sur le fil — le flanc du bloc renvoie le faisceau vers la pastille.
      const [sx0, sx1] = salleX[i]
      const ex = Math.round(entre(rng, sx0 + 150, sx1 - 220) / 10) * 10
      const my = Math.round(entre(rng, -demiH * 0.35, demiH * 0.35) / 10) * 10
      const emetteur: LaserDef = { x: ex, y: demiH - 24, angle: -90 }
      const miroir = { x: ex, y: my }
      // la pastille, posée par CALIBRAGE : on trace le reflet du miroir
      // synthétique et on la met sur son trajet (plus loin, avec du jeu)
      const porteeCible = entre(rng, 150, Math.min(260, sx1 - 70 - ex))
      const cible: CibleDef = { x: ex + porteeCible, y: my + 52, r: 30, canal }
      cibles.push(cible)
      lasers.push(emetteur)
      preuves.push({ canal, emetteur, miroir, cible })
      labels.push({ x: ex, y: my - 66, text: 'MIROIR DE GLACE', tone: 'froid', rang: 'detail' })
      // le fil du faisceau et le trajet du reflet restent dégagés
      reserves.push({ minX: ex - 70, minY: my - 120, maxX: ex + 70, maxY: demiH })
      reserves.push({ minX: ex - 70, minY: my - 90, maxX: ex + porteeCible + 90, maxY: my + 130 })
    }
  }

  // ---- le chemin nominal (spawn → passages → sas) reste dégagé ----
  const chemin: { x: number; y: number }[] = [
    { x: spawn.x, y: spawn.y },
    ...gaps,
    { x: (exit.minX + exit.maxX) / 2, y: (exit.minY + exit.maxY) / 2 },
  ]
  for (let s = 0; s + 1 < chemin.length; s++) {
    const a = chemin[s]
    const b = chemin[s + 1]
    reserves.push(
      gonfle(
        {
          minX: Math.min(a.x, b.x),
          minY: Math.min(a.y, b.y),
          maxX: Math.max(a.x, b.x),
          maxY: Math.max(a.y, b.y),
        },
        130,
      ),
    )
  }

  // ---- le décor et les dangers, par rejet : jamais sur une réserve ----
  const posePossible = (r: Rect): boolean => {
    if (r.minX < plan.x0 + 30 || r.maxX > plan.x1 - 30) return false
    if (r.minY < -demiH + 30 || r.maxY > demiH - 30) return false
    for (const res of reserves) if (chevauche(gonfle(r, 40), res)) return false
    for (const b of boxes) if (chevauche(gonfle(r, 60), aabbVraie(b))) return false
    return true
  }

  for (let i = 0; i < salleX.length; i++) {
    const [sx0, sx1] = salleX[i]
    // 1 à 2 pièces de décor par salle
    const nDecor = 1 + Math.floor(rng() * 2)
    for (let d = 0; d < nDecor; d++) {
      for (let essai = 0; essai < 24; essai++) {
        const w = entre(rng, 110, 260)
        const h = entre(rng, 110, 260)
        const cx = entre(rng, sx0 + 80, sx1 - 80)
        const cy = entre(rng, -demiH + 120, demiH - 120)
        const r: Rect = { minX: cx - w / 2, minY: cy - h / 2, maxX: cx + w / 2, maxY: cy + h / 2 }
        if (!posePossible(r)) continue
        const mat = parmi(rng, [MAT_WALL, MAT_WALL, MAT_HYDROPHILE, MAT_HYDROPHOBE])
        const forme = parmi(rng, [0, 0, 1, 2, 3])
        boxes.push({
          ...r,
          material: mat,
          ...(forme ? { forme } : {}),
          ...(forme === 3 ? { p0: Math.floor(rng() * 4) } : {}),
          ...(mat === MAT_WALL && !forme ? { skin: Math.floor(rng() * 5) } : {}),
          ...(rng() < 0.4 && !forme ? { angle: Math.round(entre(rng, -30, 30)) } : {}),
        })
        if (mat === MAT_HYDROPHILE && rng() < 0.5)
          labels.push({ x: cx, y: cy, text: 'HYDROPHILE', tone: 'phile', rang: 'detail' })
        if (mat === MAT_HYDROPHOBE && rng() < 0.5)
          labels.push({ x: cx, y: cy, text: 'HYDROPHOBE', tone: 'phobe', rang: 'detail' })
        break
      }
    }
    // un DANGER une fois sur trois : plaque froide ou chaudière, contre un bord
    if (rng() < 0.34) {
      for (let essai = 0; essai < 18; essai++) {
        const chaud = rng() < 0.5
        const w = entre(rng, 140, 240)
        const h = entre(rng, 50, 70)
        const enHaut = rng() < 0.5
        const cx = entre(rng, sx0 + 120, sx1 - 120)
        const cy = enHaut ? demiH - h / 2 - 4 : -demiH + h / 2 + 4
        const r: Rect = { minX: cx - w / 2, minY: cy - h / 2, maxX: cx + w / 2, maxY: cy + h / 2 }
        if (!posePossible(r)) continue
        boxes.push({ ...r, material: chaud ? MAT_CHAUD : MAT_FROID, ...(chaud ? { aura: 0.8 } : {}) })
        labels.push({
          x: cx,
          y: cy + (enHaut ? -h - 40 : h + 40),
          text: chaud ? 'CHAUDIÈRE' : 'HUBLOT FENDU',
          tone: chaud ? 'chaud' : 'froid',
          rang: 'detail',
        })
        break
      }
    }
    // la lampe de la salle (4 allumées au plus)
    if (lumieres.length < 4) {
      lumieres.push({
        x: (sx0 + sx1) / 2,
        y: Math.round(entre(rng, -demiH * 0.3, demiH * 0.3)),
        intensite: Number(entre(rng, 0.85, 1.15).toFixed(2)),
      })
    }
  }

  // ---- la CACHETTE, une salle sur deux environ : une alcôve voilée ----
  if (rng() < 0.55) {
    for (let essai = 0; essai < 20; essai++) {
      const i = Math.floor(rng() * salleX.length)
      const [sx0, sx1] = salleX[i]
      const w = entre(rng, 200, 280)
      const h = entre(rng, 200, 280)
      const enHaut = rng() < 0.5
      const cx = entre(rng, sx0 + w / 2 + 40, sx1 - w / 2 - 40)
      const cy = enHaut ? demiH - h / 2 - 30 : -demiH + h / 2 + 30
      const r: Rect = { minX: cx - w / 2, minY: cy - h / 2, maxX: cx + w / 2, maxY: cy + h / 2 }
      // la cachette peut recouvrir du décor (c'est même son charme), mais ni
      // le chemin nominal, ni les mécanismes
      let libre = true
      for (const res of reserves) if (chevauche(r, res)) libre = false
      if (!libre) continue
      caches.push({ ...r, ...(rng() < 0.5 ? { style: 'paroi' as const } : {}) })
      decals.push({ x: cx, y: cy, w: 90, h: 70, kind: rng() < 0.5 ? 'fiole-pleine' : 'ecran-off', fade: 0.7 })
      break
    }
  }

  const nbPortes = portes.length
  const code = 'G-' + (graine >>> 0).toString(36).toUpperCase()
  const noms = [
    'La dérivation',
    'Le collecteur',
    'La travée',
    'Le carrefour',
    'La conduite',
    'Le compartiment',
    'La soute',
    'Le déversoir',
  ]
  const level: LevelDef = {
    name: `${parmi(rng, noms)} ${(graine >>> 0).toString(36).toUpperCase()}`,
    code,
    journal:
      `Plan tiré par le protocole génératif (graine ${(graine >>> 0).toString(36).toUpperCase()}). ` +
      `La traversée a été démontrée par le traceur avant consignation : ` +
      `${plan.largeurs.length} compartiments, ${plan.maillons.filter((m) => m !== 'libre').length} franchissements contraints. — Unité GÉN.`,
    bounds,
    spawn,
    exit,
    boxes,
    sponges: [],
    labels,
    ...(decals.length ? { decals } : {}),
    ...(lasers.length ? { lasers } : {}),
    ...(cibles.length ? { cibles } : {}),
    ...(portes.length ? { portes } : {}),
    ...(caches.length ? { caches } : {}),
    lumieres,
    par: 2 + 3 * plan.maillons.length + 2 * nbPortes,
  }
  // la preuve du miroir se joue sur le niveau FINI (tout le décor posé)
  ;(level as LevelGen).__preuves = preuves
  return level
}

type LevelGen = LevelDef & {
  __preuves?: {
    canal: number
    emetteur: LaserDef
    miroir: { x: number; y: number }
    cible: CibleDef
  }[]
}

// ---- LA PREUVE DU MIROIR : le vrai traceur, un bloc de glace synthétique --
// Le disque de glace posé au point prévu porte la normale à 45° (le flanc
// haut-droit d'un corps gelé sous le fil du faisceau) : le reflet doit
// allumer la pastille. Et SANS glace, il ne doit pas — sinon la porte
// s'ouvre toute seule et l'énigme n'existe pas.
const N45 = Math.SQRT1_2

export function prouveMiroir(
  level: LevelDef,
  emetteur: LaserDef,
  miroir: { x: number; y: number },
  canal: number,
): { sansGlace: boolean; avecGlace: boolean } {
  const monde = (glace: boolean): TraceMonde => ({
    bounds: level.bounds,
    boxes: level.boxes,
    // TOUTES les portes fermées : la preuve se joue avant toute ouverture
    portesFermees: level.portes ?? [],
    cibles: (level.cibles ?? []).map((c) => ({ x: c.x, y: c.y, r: c.r })),
    iceNormal: glace
      ? (x, y) => {
          const dx = x - miroir.x
          const dy = y - miroir.y
          return dx * dx + dy * dy <= 44 * 44 ? { nx: N45, ny: N45 } : null
        }
      : null,
    eau: null,
    vapeur: null,
    rails: [],
  })
  const indexCanal = (touchees: number[]): boolean =>
    touchees.some((c) => ((level.cibles ?? [])[c]?.canal ?? c + 1) === canal)
  const sans = traceLaser(emetteur, monde(false))
  const avec = traceLaser(emetteur, monde(true))
  return { sansGlace: indexCanal(sans.touchees), avecGlace: indexCanal(avec.touchees) }
}

// ---- L'ACCESSIBILITÉ : parcours en largeur avec la marge du corps --------
// Les surfaces à état (évent, rideau, membrane) comptent passantes : un état
// du corps les traverse, et l'état se choisit librement. Les portes PROUVÉES
// ouvrables comptent ouvertes ; les autres, murées.
export function accessible(level: LevelDef, portesOuvrables: Set<number>): boolean {
  const b = level.bounds
  const pas = PAS_GRILLE_VALID
  const cols = Math.floor((b.maxX - b.minX) / pas)
  const rows = Math.floor((b.maxY - b.minY) / pas)
  if (cols < 2 || rows < 2) return false
  const solides: Rect[] = []
  for (const box of level.boxes) {
    if (
      box.material === MAT_GRILLE ||
      box.material === MAT_MEMBRANE ||
      box.material === MAT_RIDEAU
    )
      continue
    // une forme tient DANS sa boîte englobante, et une pièce PIVOTÉE
    // déborde de la sienne : la validation voit la boîte vraie — prudente,
    // jamais laxiste, pour la traversée
    solides.push(aabbVraie(box))
  }
  for (const p of level.portes ?? []) {
    if (!portesOuvrables.has(p.canal)) solides.push(p)
  }
  const gonfles = solides.map((r) => gonfle(r, MARGE_CORPS))
  const bloque = (x: number, y: number): boolean => {
    if (
      x < b.minX + MARGE_CORPS ||
      x > b.maxX - MARGE_CORPS ||
      y < b.minY + MARGE_CORPS ||
      y > b.maxY - MARGE_CORPS
    )
      return true
    for (const r of gonfles)
      if (x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY) return true
    return false
  }
  const idx = (c: number, l: number): number => l * cols + c
  const vu = new Uint8Array(cols * rows)
  const cellDe = (x: number, y: number): [number, number] => [
    Math.max(0, Math.min(cols - 1, Math.floor((x - b.minX) / pas))),
    Math.max(0, Math.min(rows - 1, Math.floor((y - b.minY) / pas))),
  ]
  const [sc, sl] = cellDe(level.spawn.x, level.spawn.y)
  const file: number[] = []
  if (bloque(b.minX + (sc + 0.5) * pas, b.minY + (sl + 0.5) * pas)) return false
  vu[idx(sc, sl)] = 1
  file.push(idx(sc, sl))
  const ex = level.exit
  while (file.length > 0) {
    const cur = file.pop()!
    const c = cur % cols
    const l = Math.floor(cur / cols)
    const x = b.minX + (c + 0.5) * pas
    const y = b.minY + (l + 0.5) * pas
    if (x >= ex.minX - pas && x <= ex.maxX + pas && y >= ex.minY - pas && y <= ex.maxY + pas)
      return true
    const voisins: [number, number][] = [
      [c - 1, l],
      [c + 1, l],
      [c, l - 1],
      [c, l + 1],
    ]
    for (const [nc, nl] of voisins) {
      if (nc < 0 || nc >= cols || nl < 0 || nl >= rows) continue
      const ni = idx(nc, nl)
      if (vu[ni]) continue
      const nx = b.minX + (nc + 0.5) * pas
      const ny = b.minY + (nl + 0.5) * pas
      if (bloque(nx, ny)) continue
      vu[ni] = 1
      file.push(ni)
    }
  }
  return false
}

// ---- LE VERDICT : un niveau généré est bon, ou il n'existe pas -----------
export interface VerdictGen {
  valide: boolean
  raisons: string[]
}

export function valideNiveau(level: LevelDef): VerdictGen {
  const raisons: string[] = []
  const erreurs = checkLevel(level).filter((v) => v.niveau === 'erreur')
  for (const e of erreurs) raisons.push(`éditeur : ${e.message}`)
  const preuves = (level as LevelGen).__preuves ?? []
  const ouvrables = new Set<number>()
  for (const p of preuves) {
    const { sansGlace, avecGlace } = prouveMiroir(level, p.emetteur, p.miroir, p.canal)
    if (sansGlace) raisons.push(`canal ${p.canal} : la porte s'ouvre sans miroir — l'énigme n'existe pas`)
    else if (!avecGlace) raisons.push(`canal ${p.canal} : le reflet du miroir n'allume pas la pastille`)
    else ouvrables.add(p.canal)
  }
  // une porte sans preuve n'est jamais ouvrable : elle doit ne pas exister
  for (const porte of level.portes ?? []) {
    if (!preuves.some((p) => p.canal === porte.canal))
      raisons.push(`canal ${porte.canal} : porte sans énigme prouvée`)
  }
  if (raisons.length === 0 && !accessible(level, ouvrables))
    raisons.push('le sas est inaccessible avec la marge du corps')
  return { valide: raisons.length === 0, raisons }
}

// ---- L'ENTRÉE : graine → salle prouvée ----------------------------------
// Un tirage raté n'est pas une erreur, c'est un tirage : on re-tire (avec
// une sous-graine dérivée, pour rester déterministe) jusqu'à la preuve —
// et l'on abandonne au-delà de 60 essais, ce qui ne s'observe pas en
// pratique (les tests le tiennent à l'œil).
export function genereNiveau(graine: number): LevelDef {
  for (let essai = 0; essai < 60; essai++) {
    const rng = creeRng((graine >>> 0) + essai * 0x9e3779b9)
    const niveau = essaieNiveau(graine, rng)
    if (valideNiveau(niveau).valide) {
      delete (niveau as LevelGen).__preuves
      return niveau
    }
  }
  throw new Error(`générateur : aucune salle prouvée pour la graine ${graine}`)
}

/** Une graine de partage lisible (base 36) → nombre, et retour. */
export function graineDepuisTexte(txt: string): number | null {
  const nu = txt.trim().toUpperCase()
  if (!/^[0-9A-Z]{1,7}$/.test(nu)) return null
  const n = parseInt(nu, 36)
  return Number.isFinite(n) ? n >>> 0 : null
}
