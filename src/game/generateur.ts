// Le GÉNÉRATEUR DE SALLES : une graine → un tableau complet, PROUVÉ
// traversable avant d'être remis au joueur. La recette qui évite la soupe
// aléatoire : on tire d'abord la CHAÎNE D'INTENTIONS (la suite des
// franchissements — évent, rideau, membrane, énigmes au laser), puis on
// habille chaque maillon en géométrie, et l'on REFUSE tout tirage dont la
// traversée ne se démontre pas :
//   · accessibilité spawn → sas par parcours en largeur, avec la marge du
//     corps (aucun goulet infranchissable) — les surfaces à état (évent,
//     rideau, membrane) comptent passantes, puisqu'un état du corps les
//     traverse et que l'état se choisit librement ;
//   · chaque porte asservie est prouvée OUVRABLE par le VRAI traceur de
//     faisceau (laser.ts), corps synthétique posé à l'endroit prévu pour le
//     joueur — glace-miroir, nuage ionisant ou traversée en vapeur selon
//     l'énigme — et l'énigme doit EXISTER : sans le corps, rien ne s'ouvre
//     (sauf la barrière NOR, allumée d'office par contrat).
// Même graine, même salle — le générateur est déterministe : une salle se
// partage par son code (G-…), se rejoue, se retouche à l'éditeur.
//
// LA GRAMMAIRE DES MAILLONS (un par cloison) :
//   · libre     — un passage nu ;
//   · grille    — l'évent : seul le corps en VAPEUR le traverse ;
//   · rideau    — seule la GLACE l'écarte ;
//   · membrane  — seule l'EAU la traverse ;
//   · porte     — l'énigme du MIROIR : un fil à plomb de lumière, le corps
//     gelé dessous ; son flanc renvoie le faisceau sur la pastille ;
//   · et        — DEUX miroirs, deux pastilles du même canal, règle ET :
//     la porte exige les deux (le TOR retient — l'une après l'autre) ;
//   · rail      — le PLASMA : se tenir en vapeur au point marqué ionise le
//     faisceau, le rail magnétique capture l'arc et le guide à la pastille ;
//   · nor       — la BARRIÈRE TENUE : un faisceau vertical barre le chemin,
//     sa pastille NOR tient la porte ouverte TANT QU'IL la touche. L'eau le
//     plie, la glace le renvoie — couper le faisceau scelle la porte.
//     Traverser la lumière EN VAPEUR : le faisceau s'ionise mais file droit.

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
  type RailDef,
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
export type Maillon =
  | 'libre'
  | 'grille'
  | 'rideau'
  | 'membrane'
  | 'porte'
  | 'et'
  | 'rail'
  | 'nor'

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
  // la chaîne : au moins UN maillon contraint — sinon c'est un couloir.
  // Les énigmes au laser sont plafonnées (deux miroirs simples, un ET, un
  // rail, une barrière NOR, trois lasers en tout) : la salle reste lisible.
  const types: Maillon[] = [
    'libre',
    'grille',
    'rideau',
    'membrane',
    'porte',
    'et',
    'rail',
    'nor',
  ]
  let maillons: Maillon[] = []
  do {
    maillons = []
    let miroirs = 0
    let ets = 0
    let rails = 0
    let nors = 0
    let lasers = 0
    for (let i = 0; i + 1 < nbSalles; i++) {
      let m = parmi(rng, types)
      // le double miroir exige une salle large ; à défaut, un miroir simple
      if (m === 'et' && largeurs[i] < 820) m = 'porte'
      if (m === 'porte' && miroirs >= 2) m = 'grille'
      if (m === 'et' && ets >= 1) m = 'porte'
      if (m === 'rail' && rails >= 1) m = 'rideau'
      if (m === 'nor' && nors >= 1) m = 'membrane'
      if ((m === 'porte' || m === 'et' || m === 'rail' || m === 'nor') && lasers >= 3)
        m = 'grille'
      if (m === 'porte') miroirs++
      if (m === 'et') ets++
      if (m === 'rail') rails++
      if (m === 'nor') nors++
      if (m === 'porte' || m === 'et' || m === 'rail' || m === 'nor') lasers++
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

// ---- Les PREUVES à mener sur la salle finie ------------------------------
export interface PreuveDef {
  kind: 'miroir' | 'rail' | 'nor'
  canal: number
  emetteur: LaserDef
  /** miroir : où geler le corps · rail : où se tenir en vapeur ·
   * nor : où le chemin croise le faisceau (la traversée à démontrer). */
  spot: { x: number; y: number }
  cibleIndex: number
}

type LevelGen = LevelDef & { __preuves?: PreuveDef[] }

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
  const rails: RailDef[] = []
  const lumieres: LumiereDef[] = []
  const caches: CacheDef[] = []
  const decals: DecalDef[] = []
  // les couloirs à garder LIBRES : le chemin, les faisceaux, le spawn, le sas
  const reserves: Rect[] = []
  const preuves: PreuveDef[] = []

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

  // L'ÉNIGME DU MIROIR, posée dans une salle : un émetteur au plafond tire
  // un fil à plomb de lumière ; le joueur gèle son corps sur le fil — le
  // flanc du bloc renvoie le faisceau vers la pastille. La pastille est
  // posée par CALIBRAGE : sur le trajet du reflet, avec du jeu.
  const poseMiroir = (ex: number, sx1: number, canal: number): void => {
    const my = Math.round(entre(rng, -demiH * 0.35, demiH * 0.35) / 10) * 10
    const emetteur: LaserDef = { x: ex, y: demiH - 24, angle: -90 }
    const porteeCible = entre(rng, 150, Math.min(260, sx1 - 70 - ex))
    const cible: CibleDef = { x: ex + porteeCible, y: my + 52, r: 30, canal }
    cibles.push(cible)
    lasers.push(emetteur)
    preuves.push({
      kind: 'miroir',
      canal,
      emetteur,
      spot: { x: ex, y: my },
      cibleIndex: cibles.length - 1,
    })
    labels.push({ x: ex, y: my - 66, text: 'MIROIR DE GLACE', tone: 'froid', rang: 'detail' })
    // le fil du faisceau et le trajet du reflet restent dégagés
    reserves.push({ minX: ex - 70, minY: my - 120, maxX: ex + 70, maxY: demiH })
    reserves.push({ minX: ex - 70, minY: my - 90, maxX: ex + porteeCible + 90, maxY: my + 130 })
  }

  // ---- les cloisons et leurs maillons ----
  const gaps: { x: number; y: number }[] = [] // le centre de chaque passage
  let canalSuivant = 1

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

    const [sx0, sx1] = salleX[i]
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
      const ex = Math.round(entre(rng, sx0 + 150, sx1 - 220) / 10) * 10
      poseMiroir(ex, sx1, canal)
    } else if (maillon === 'et') {
      // DEUX miroirs, un seul canal, règle ET : la porte veut les deux.
      // Les deux fils à plomb sont écartés, et leurs pastilles à des
      // hauteurs disjointes — un seul miroir ne peut pas servir deux fois.
      const canal = canalSuivant++
      portes.push({ minX: wx, minY: gapMin, maxX: wx + EP_CLOISON, maxY: gapMax, canal, regle: 'et' })
      const ex1 = Math.round(entre(rng, sx0 + 140, sx0 + 240) / 10) * 10
      const ex2 = Math.round(entre(rng, ex1 + 280, sx1 - 220) / 10) * 10
      poseMiroir(ex1, ex2 - 90, canal)
      poseMiroir(ex2, sx1, canal)
      labels.push({
        x: wx + EP_CLOISON / 2,
        y: gapMax + 60,
        text: 'DEUX PASTILLES — LES DEUX',
        tone: 'grille',
        rang: 'detail',
      })
    } else if (maillon === 'rail') {
      // LE PLASMA : se tenir en VAPEUR au point marqué ionise le faisceau ;
      // le rail magnétique, amorcé dans le nuage, capture l'arc et le guide
      // jusqu'à la pastille posée dans l'axe de sa sortie.
      const canal = canalSuivant++
      portes.push({ minX: wx, minY: gapMin, maxX: wx + EP_CLOISON, maxY: gapMax, canal })
      const Lr = Math.round(entre(rng, 140, 200) / 10) * 10
      const ex = Math.round(entre(rng, sx0 + 150, sx1 - (Lr + 160)) / 10) * 10
      const ny = Math.round(entre(rng, -demiH * 0.3, demiH * 0.3) / 10) * 10
      const emetteur: LaserDef = { x: ex, y: demiH - 24, angle: -90 }
      lasers.push(emetteur)
      rails.push({ points: [{ x: ex, y: ny - 30 }, { x: ex + Lr, y: ny - 30 }] })
      const cible: CibleDef = { x: ex + Lr + 100, y: ny - 30, r: 26, canal }
      cibles.push(cible)
      preuves.push({
        kind: 'rail',
        canal,
        emetteur,
        spot: { x: ex, y: ny },
        cibleIndex: cibles.length - 1,
      })
      labels.push({ x: ex, y: ny + 74, text: 'IONISER ICI', tone: 'grille', rang: 'detail' })
      reserves.push({ minX: ex - 70, minY: ny - 120, maxX: ex + 70, maxY: demiH })
      reserves.push({ minX: ex - 70, minY: ny - 110, maxX: ex + Lr + 150, maxY: ny + 40 })
    } else if (maillon === 'nor') {
      // LA BARRIÈRE TENUE : un faisceau vertical barre le chemin devant la
      // porte ; sa pastille NOR (au sol) tient la porte ouverte tant que la
      // lumière la touche. L'eau plie le faisceau, la glace le renvoie —
      // la coupure scelle. On traverse la lumière en VAPEUR : ionisée,
      // elle file droit.
      const canal = canalSuivant++
      portes.push({ minX: wx, minY: gapMin, maxX: wx + EP_CLOISON, maxY: gapMax, canal })
      const bx = Math.round(
        entre(rng, Math.max(sx0 + 130, wx - 320), wx - 150) / 10,
      ) * 10
      const emetteur: LaserDef = { x: bx, y: demiH - 24, angle: -90 }
      lasers.push(emetteur)
      const cible: CibleDef = { x: bx, y: -demiH + 52, r: 22, mode: 'nor', canal }
      cibles.push(cible)
      preuves.push({
        kind: 'nor',
        canal,
        emetteur,
        spot: { x: bx, y: gy },
        cibleIndex: cibles.length - 1,
      })
      labels.push({ x: bx, y: gy + 120, text: 'TRAVERSER EN VAPEUR', tone: 'grille', rang: 'detail' })
      // la colonne du faisceau reste dégagée du plafond au sol : le décor
      // ne doit jamais couper la barrière à la place du joueur
      reserves.push({ minX: bx - 60, minY: -demiH, maxX: bx + 60, maxY: demiH })
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

  const nbEnigmes = preuves.length
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
    ...(rails.length ? { rails } : {}),
    ...(caches.length ? { caches } : {}),
    lumieres,
    par: 2 + 3 * plan.maillons.length + 2 * nbEnigmes,
  }
  // la preuve se joue sur le niveau FINI (tout le décor posé)
  ;(level as LevelGen).__preuves = preuves
  return level
}

// ---- LES CORPS SYNTHÉTIQUES : le vrai traceur, un corps posé pour lui ----
// La preuve rejoue l'idée du joueur : un disque de GLACE au flanc à 45°
// (le corps gelé sous le fil du faisceau), un NUAGE de vapeur ionisant, ou
// une flaque d'EAU-lentille (la traversée qui plie le faisceau). Le traceur
// est celui du jeu — la preuve et la partie parlent la même optique.
const N45 = Math.SQRT1_2

interface CorpsSynthetiques {
  glace?: { x: number; y: number }
  vapeur?: { x: number; y: number }
  eau?: { x: number; y: number }
}

function traceSynthetique(
  level: LevelDef,
  em: LaserDef,
  corps: CorpsSynthetiques,
): number[] {
  const monde: TraceMonde = {
    bounds: level.bounds,
    boxes: level.boxes,
    // TOUTES les portes fermées : la preuve se joue avant toute ouverture
    portesFermees: level.portes ?? [],
    cibles: (level.cibles ?? []).map((c) => ({ x: c.x, y: c.y, r: c.r })),
    iceNormal: corps.glace
      ? (x, y) => {
          const dx = x - corps.glace!.x
          const dy = y - corps.glace!.y
          return dx * dx + dy * dy <= 44 * 44 ? { nx: N45, ny: N45 } : null
        }
      : null,
    eau: corps.eau
      ? {
          dedans: (x, y) => {
            const dx = x - corps.eau!.x
            const dy = y - corps.eau!.y
            return dx * dx + dy * dy <= 40 * 40
          },
          normale: (x, y) => {
            const dx = x - corps.eau!.x
            const dy = y - corps.eau!.y
            const d = Math.hypot(dx, dy) || 1
            return { nx: dx / d, ny: dy / d }
          },
        }
      : null,
    vapeur: corps.vapeur
      ? (x, y) => {
          const dx = x - corps.vapeur!.x
          const dy = y - corps.vapeur!.y
          return dx * dx + dy * dy <= 44 * 44
        }
      : null,
    rails: level.rails ?? [],
  }
  return traceLaser(em, monde).touchees
}

/** L'énigme du MIROIR : sans glace la pastille du canal reste éteinte,
 * avec un corps gelé au point prévu elle s'allume. */
export function prouveMiroir(
  level: LevelDef,
  emetteur: LaserDef,
  miroir: { x: number; y: number },
  canal: number,
): { sansGlace: boolean; avecGlace: boolean } {
  const duCanal = (touchees: number[]): boolean =>
    touchees.some((c) => ((level.cibles ?? [])[c]?.canal ?? c + 1) === canal)
  return {
    sansGlace: duCanal(traceSynthetique(level, emetteur, {})),
    avecGlace: duCanal(traceSynthetique(level, emetteur, { glace: miroir })),
  }
}

/** L'énigme du PLASMA : sans nuage le rail est muet, avec un corps en
 * vapeur au point marqué l'arc suit le rail et allume la pastille. */
export function prouvePlasma(
  level: LevelDef,
  emetteur: LaserDef,
  nuage: { x: number; y: number },
  canal: number,
): { sansVapeur: boolean; avecVapeur: boolean } {
  const duCanal = (touchees: number[]): boolean =>
    touchees.some((c) => ((level.cibles ?? [])[c]?.canal ?? c + 1) === canal)
  return {
    sansVapeur: duCanal(traceSynthetique(level, emetteur, {})),
    avecVapeur: duCanal(traceSynthetique(level, emetteur, { vapeur: nuage })),
  }
}

/** La BARRIÈRE TENUE : le faisceau tient sa pastille d'office ; la
 * traversée en VAPEUR ne le coupe pas ; la traversée en EAU le plie et le
 * coupe — c'est toute l'énigme. */
export function prouveBarriere(
  level: LevelDef,
  emetteur: LaserDef,
  croisement: { x: number; y: number },
  canal: number,
): { directe: boolean; enVapeur: boolean; enEau: boolean } {
  const duCanal = (touchees: number[]): boolean =>
    touchees.some((c) => ((level.cibles ?? [])[c]?.canal ?? c + 1) === canal)
  return {
    directe: duCanal(traceSynthetique(level, emetteur, {})),
    enVapeur: duCanal(traceSynthetique(level, emetteur, { vapeur: croisement })),
    enEau: duCanal(
      traceSynthetique(level, emetteur, {
        eau: { x: croisement.x + 24, y: croisement.y },
      }),
    ),
  }
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

  // L'ÉTAT DE BASE : chaque émetteur tracé sans corps. Seules les pastilles
  // des barrières NOR ont le droit d'être allumées d'office — toute autre
  // pastille allumée sans le joueur est une énigme morte (allumage croisé).
  const norIndex = new Set(preuves.filter((p) => p.kind === 'nor').map((p) => p.cibleIndex))
  const baseParEmetteur = new Map<LaserDef, Set<number>>()
  for (const em of level.lasers ?? []) {
    const touchees = new Set(traceSynthetique(level, em, {}))
    baseParEmetteur.set(em, touchees)
    for (const t of touchees) {
      if (!norIndex.has(t))
        raisons.push(
          `pastille ${t + 1} allumée sans le joueur (allumage croisé) — l'énigme est morte`,
        )
    }
  }

  // chaque preuve, dans les termes de son énigme
  const canauxProuves = new Map<number, number>() // canal → preuves réussies
  const attendus = new Map<number, number>() // canal → preuves exigées
  for (const p of preuves) attendus.set(p.canal, (attendus.get(p.canal) ?? 0) + 1)
  for (const p of preuves) {
    const base = baseParEmetteur.get(p.emetteur) ?? new Set()
    let ok = false
    if (p.kind === 'miroir') {
      const avec = traceSynthetique(level, p.emetteur, { glace: p.spot })
      if (base.has(p.cibleIndex)) raisons.push(`canal ${p.canal} : la pastille s'allume sans miroir`)
      else if (!avec.includes(p.cibleIndex))
        raisons.push(`canal ${p.canal} : le reflet du miroir n'allume pas la pastille`)
      else {
        // le miroir ne doit servir QUE sa pastille : allumer la jumelle
        // d'un canal ET depuis le même point trivialiserait l'énigme
        const autres = preuves.filter((q) => q !== p && q.canal === p.canal)
        ok = autres.every((q) => !avec.includes(q.cibleIndex))
        if (!ok) raisons.push(`canal ${p.canal} : un seul miroir allume les deux pastilles`)
      }
    } else if (p.kind === 'rail') {
      const avec = traceSynthetique(level, p.emetteur, { vapeur: p.spot })
      if (base.has(p.cibleIndex)) raisons.push(`canal ${p.canal} : la pastille s'allume sans nuage`)
      else if (!avec.includes(p.cibleIndex))
        raisons.push(`canal ${p.canal} : l'arc guidé n'atteint pas la pastille`)
      else ok = true
    } else {
      // nor : allumée d'office, la vapeur ne coupe pas, l'eau coupe
      const enVapeur = traceSynthetique(level, p.emetteur, { vapeur: p.spot })
      const enEau = traceSynthetique(level, p.emetteur, {
        eau: { x: p.spot.x + 24, y: p.spot.y },
      })
      if (!base.has(p.cibleIndex))
        raisons.push(`canal ${p.canal} : la barrière n'atteint pas sa pastille`)
      else if (!enVapeur.includes(p.cibleIndex))
        raisons.push(`canal ${p.canal} : la traversée en vapeur coupe la barrière`)
      else if (enEau.includes(p.cibleIndex))
        raisons.push(`canal ${p.canal} : l'eau ne plie pas le faisceau — la barrière ne punit rien`)
      else ok = true
    }
    if (ok) canauxProuves.set(p.canal, (canauxProuves.get(p.canal) ?? 0) + 1)
  }
  const ouvrables = new Set<number>()
  for (const [canal, n] of attendus)
    if ((canauxProuves.get(canal) ?? 0) === n) ouvrables.add(canal)
  // une porte sans preuve n'est jamais ouvrable : elle doit ne pas exister
  for (const porte of level.portes ?? []) {
    if (!attendus.has(porte.canal))
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
