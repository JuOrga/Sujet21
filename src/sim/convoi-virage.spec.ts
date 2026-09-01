import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_PLAYER, type Bounds } from './solver'

// LA TENUE DE RAIL — le nuage convoyé doit prendre les virages.
//
// Le défaut vécu (« ça s'éparpille rapidement en cas de virage ») tenait à
// DEUX causes, mesurées au banc avant correction, sur un coude à 90° :
//
//  1. Le tronçon le plus proche pousse dans SON axe — donc TOUT DROIT au
//     coude. Le nuage dépassait le virage et se stabilisait ~94 u derrière
//     lui, là où la poussée du tronçon et le rappel vers le coin
//     s'annulent : HORS bande (75), champ vidé, rail lâché pour de bon.
//  2. Même en tournant la poussée, l'élan accumulé sur la ligne droite
//     (~500 u/s) pointe hors du tracé au coude, et le rappel (0,8 × accel
//     au bord de bande) ne courbe pas une trajectoire à cette vitesse.
//
// Les remèdes se lisent dans railConvoy : la poussée TOURNE vers le tronçon
// suivant à moins d'une bande de la fin du tronçon (une ligne de champ se
// courbe, elle n'a pas d'angle), et le champ CONFINE — la composante de
// vitesse en travers de la ligne s'amortit (plasmaConfin, 1/s). Mesuré
// après : 100 % du nuage dans la bande sur tout le trajet, coude compris.

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }
const BAND = DEFAULT_PARAMS.plasmaRailRadius * 2.5

/** Un coude à 90° : 500 u vers la droite, puis 500 u vers le bas. */
const COUDE = [
  { x: -500, y: 0 },
  { x: 0, y: 0 },
  { x: 0, y: -500 },
]
/** Deux virages opposés — le cas qui punit un remède trop raide. */
const ZIGZAG = [
  { x: -500, y: 0 },
  { x: -100, y: 0 },
  { x: -100, y: -300 },
  { x: 300, y: -300 },
]
const DROIT = [
  { x: -500, y: 0 },
  { x: 500, y: 0 },
]

function distAuRail(px: number, py: number, pts: { x: number; y: number }[]): number {
  let best = Infinity
  for (let s = 0; s + 1 < pts.length; s++) {
    const a = pts[s]
    const b = pts[s + 1]
    const abx = b.x - a.x
    const aby = b.y - a.y
    const len2 = abx * abx + aby * aby
    const t = Math.max(0, Math.min(1, ((px - a.x) * abx + (py - a.y) * aby) / len2))
    const dx = px - (a.x + abx * t)
    const dy = py - (a.y + aby * t)
    best = Math.min(best, dx * dx + dy * dy)
  }
  return Math.sqrt(best)
}

interface Voyage {
  /** la pire part du nuage restée dans la bande, sur tout le trajet */
  pireBande: number
  /** l'instant où > 80 % du nuage est au terminus (−1 : jamais) */
  tArrive: number
}

/** Fait voyager un nuage de 60 particules du départ du rail au terminus,
 *  en convoyant comme le fait le jeu, et relève la tenue de bande. */
function voyage(pts: { x: number; y: number }[], overrides: Partial<SimParams> = {}): Voyage {
  const sim = new FluidSim({ ...DEFAULT_PARAMS, ...overrides }, OPEN, 2048)
  sim.setLevel([], [])
  sim.spawnDisc(-450, 0, 60, KIND_PLAYER)
  sim.gasIntent = true // le joueur TIENT l'état vapeur, comme en jeu
  sim.naitEnVapeur()
  const dt = sim.params.dt
  const fin = pts[pts.length - 1]
  let pireBande = 1
  let tArrive = -1
  for (let s = 0; s < Math.round(8 / dt); s++) {
    sim.railConvoy(pts, BAND, DEFAULT_PARAMS.plasmaConvoy, dt)
    sim.step(dt)
    const t = (s + 1) * dt
    let n = 0
    let dedans = 0
    let arrives = 0
    for (let i = 0; i < sim.count; i++) {
      if (sim.gaseous[i] !== 1) continue
      n++
      if (distAuRail(sim.posX[i], sim.posY[i], pts) <= BAND) dedans++
      if (Math.hypot(sim.posX[i] - fin.x, sim.posY[i] - fin.y) < BAND * 1.5) arrives++
    }
    // 0,3 s de grâce : le nuage naît autour du rail, pas dessus
    if (n > 0 && t > 0.3) pireBande = Math.min(pireBande, dedans / n)
    if (n > 0 && arrives / n > 0.8 && tArrive < 0) {
      tArrive = t
      break
    }
  }
  return { pireBande, tArrive }
}

describe('La tenue de rail — le virage ne disperse plus le nuage', () => {
  it('un coude à 90° se prend sans quitter la bande, et on arrive', () => {
    const v = voyage(COUDE)
    // Mesuré avant correction : 0 % en bande après le coude, jamais arrivé.
    expect(v.pireBande).toBeGreaterThan(0.9)
    expect(v.tArrive).toBeGreaterThan(0)
    expect(v.tArrive).toBeLessThan(4)
  })

  it('deux virages opposés aussi — le remède n’est pas raide', () => {
    const v = voyage(ZIGZAG)
    expect(v.pireBande).toBeGreaterThan(0.9)
    expect(v.tArrive).toBeGreaterThan(0)
    expect(v.tArrive).toBeLessThan(4)
  })

  it('la ligne droite arrive aussi vite qu’avant', () => {
    // Le confinement ne touche pas la composante LE LONG de la ligne :
    // avant correction, la droite s'avalait en ~1,9 s — c'est toujours vrai.
    const v = voyage(DROIT)
    expect(v.pireBande).toBeGreaterThan(0.9)
    expect(v.tArrive).toBeGreaterThan(0)
    expect(v.tArrive).toBeLessThan(2.5)
  })

  it('SANS confinement, le coude éjecte le nuage — le paramètre n’est pas décoratif', () => {
    // La mémoire du défaut : l'élan ne se courbe pas tout seul. Si ce test
    // se met à passer, c'est qu'un autre mécanisme confine — et que
    // plasmaConfin peut partir.
    const v = voyage(COUDE, { plasmaConfin: 0 })
    expect(v.pireBande).toBeLessThan(0.5)
  })
})
