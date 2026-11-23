import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { COUPELLE_DEBIT } from '../game/coupelle'
import { instrumentDef, levier } from '../game/instruments'
import { levierDef } from '../game/leviers'
import { DEFAULT_PARAMS } from './params'
import { FluidSim, KIND_PLAYER, type Bounds } from './solver'

// LES CARTES DU JET — la Tuyère (vitesse) et le Surpresseur (débit).
// Le verbe unique n'avait aucun levier ; ces tests disent ce que les deux
// cartes font au VRAI solveur, mesures à l'appui, et ce qu'elles ne
// cassent pas : la quantité de mouvement reste conservée, la prévision
// exacte pousse comme le corps, une coupelle ne déborde toujours pas.

// assez large pour qu'aucune goutte du jet n'atteigne une paroi pendant la
// mesure : une paroi absorberait de l'élan et fausserait la conservation
const VIDE: Bounds = { minX: -6000, minY: -3000, maxX: 6000, maxY: 3000 }
const dt = DEFAULT_PARAMS.dt

function corps(vitesse: number, debit: number): FluidSim {
  const sim = new FluidSim({ ...DEFAULT_PARAMS }, VIDE, 2048)
  sim.setLevel([], [])
  sim.spawnDisc(0, 0, 900, KIND_PLAYER)
  sim.relabel()
  sim.jetVitesseFactor = vitesse
  sim.jetDebitFactor = debit
  for (let s = 0; s < 240; s++) sim.step(dt) // le corps se pose
  return sim
}

/** L'élan d'ensemble sur x, gouttes du jet comprises. */
function elan(sim: FluidSim): number {
  let p = 0
  for (let i = 0; i < sim.count; i++) p += sim.velX[i]
  return p
}

/** Pousse vers +x jusqu'à `cible` u/s, puis laisse rentrer ce qui rentre
 *  (3 s) : ce que la vitesse a coûté, en pas tenus et en volume. */
function atteint(vitesse: number, debit: number, cible: number) {
  const sim = corps(vitesse, debit)
  const n0 = sim.playerCount
  const p0 = elan(sim)
  let pas = 0
  while (sim.stats.velX < cible && pas < 2000) {
    sim.eject(-50000, 0, dt)
    sim.step(dt)
    pas++
  }
  const dp = elan(sim) - p0
  for (let s = 0; s < 360; s++) sim.step(dt)
  return { pas, perdu: n0 - sim.playerCount, dp }
}

/** Le nombre de gouttes réellement tirées en `secondes` de poussée : ce
 *  sont les seules à porter un délai de réabsorption (1,2 s, plus long que
 *  la mesure) — les éclats arrachés par le remous n'en ont pas. */
function tirees(debit: number, secondes: number): number {
  const sim = corps(1, debit)
  const pas = Math.round(secondes / dt)
  for (let s = 0; s < pas; s++) {
    sim.eject(-50000, 0, dt)
    sim.step(dt)
  }
  let n = 0
  for (let i = 0; i < sim.count; i++) if (sim.cooldown[i] > 0) n++
  return n
}

describe('les cartes du jet', () => {
  // mesuré (corps de 900, poussée jusqu'à 120 u/s, puis 3 s de retour) :
  //   sans carte      270 pas (2,25 s), 138 particules perdues
  //   Tuyère ×1,2     215 pas (1,8 s),  119 perdues  (−14 %)
  //   Surpresseur ×1,4 195 pas (1,6 s), 124 perdues  (−10 %)
  // La moitié de ce que coûte une poussée n'est PAS le jet lui-même : ce
  // sont les éclats que le remous arrache au corps, et une poussée plus
  // courte en arrache moins — d'où le gain, plus modeste, du Surpresseur.
  const base = atteint(1, 1, 120)

  it('la Tuyère : la même vitesse coûte moins de volume, et vient plus tôt', () => {
    const t = atteint(1.2, 1, 120)
    expect(t.perdu).toBeLessThan(base.perdu * 0.92)
    expect(t.pas).toBeLessThan(base.pas * 0.85)
  })

  it('le Surpresseur : 40 % de gouttes en plus par seconde, et l’on arrive bien plus vite', () => {
    // 32 gouttes/s sans carte, 44,8 à ×1,4 : le reliquat arrondit à 44 ou 45
    expect(tirees(1, 1)).toBe(32)
    const s = tirees(1.4, 1)
    expect(s).toBeGreaterThanOrEqual(44)
    expect(s).toBeLessThanOrEqual(45)
    const v = atteint(1, 1.4, 120)
    expect(v.pas).toBeLessThan(base.pas * 0.8)
    // il ne rend pas la poussée plus CHÈRE : chaque goutte pousse pareil
    expect(v.perdu).toBeLessThanOrEqual(base.perdu)
  })

  it('aucune carte ne crée d’élan : le recul reste exactement l’opposé du jet', () => {
    // mesuré : |Δp| ≤ 1,1 quelle que soit la carte, sur une poussée qui met
    // ~108 000 en jeu (900 particules à 120 u/s) — le bruit du flottant. Les
    // deux plafonds ensemble : le cas où une fuite se verrait le plus.
    expect(Math.abs(atteint(1.4, 1.6, 120).dp)).toBeLessThan(3)
  })

  it('la prévision exacte pousse comme le corps : la copie emporte les deux facteurs', () => {
    const sim = corps(1.3, 1.5)
    const c = sim.copiePourPrevision()
    expect(c.jetVitesseFactor).toBe(1.3)
    expect(c.jetDebitFactor).toBe(1.5)
  })

  it('même au plafond du Surpresseur, tirer dans une coupelle ne la fait pas déborder', () => {
    const max = levierDef('debitJet')!.max
    expect(DEFAULT_PARAMS.ejectRate * max).toBeLessThan(COUPELLE_DEBIT)
  })

  it('les deux cartes tirent leur levier, et rien d’autre', () => {
    expect(instrumentDef('tuyere')!.effets).toEqual([{ levier: 'vitesseJet', valeur: 1.2 }])
    expect(instrumentDef('surpresseur')!.effets).toEqual([{ levier: 'debitJet', valeur: 1.4 }])
    expect(levier(['tuyere', 'surpresseur'], 'vitesseJet')).toBe(1.2)
    expect(levier(['tuyere', 'surpresseur'], 'debitJet')).toBe(1.4)
    expect(levier([], 'vitesseJet')).toBe(1)
    expect(levier([], 'debitJet')).toBe(1)
  })

  it('le jeu pose les deux facteurs au chargement de la salle, comme les autres cartes', () => {
    // main.ts ne s'importe pas en test (il bâtit la page) : on lit sa source,
    // comme multi/branchement.spec.ts — sans ces deux lignes, les cartes se
    // tireraient, s'afficheraient, et ne feraient rien
    const main = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')
    const creation = main.slice(main.indexOf('function createSim('), main.indexOf('const sim = new FluidSim(params', main.indexOf('function createSim(')) + 2000)
    expect(creation).toMatch(/sim\.jetVitesseFactor = lev\('vitesseJet'\)/)
    expect(creation).toMatch(/sim\.jetDebitFactor = lev\('debitJet'\)/)
  })
})
