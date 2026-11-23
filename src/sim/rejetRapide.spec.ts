// LE REJET RAPIDE DES OBSTACLES — ce qu'il évite, et qu'il ne change rien.
//
// Le hub tournait au RALENTI là où les salles tenaient la cadence : ses
// parois sont des COQUES (des pièces entières), dont la boîte englobante
// ne rejette rien de ce qui s'y trouve. Chaque goutte payait le champ
// complet de la coque, deux fois par pas — et la boucle fixe abandonne le
// temps qu'elle n'a pas pu simuler dans son budget. Le versement
// automatique du hub, lui, comparait chaque place candidate à TOUTES les
// particules : une image sautée à chaque dose.
//
// Ces tests tiennent les deux bouts : le calcul évité (le premier tombe
// sans creuxDeCoque) et l'exactitude (le rejet ne dit jamais « loin » d'un
// point que le champ aurait touché ; le casier du versement ne pose jamais
// une goutte sur une autre).

import { describe, expect, it, vi } from 'vitest'
import * as formes from '../game/formes'
import {
  COQUE_EST,
  COQUE_NORD,
  COQUE_OUEST,
  COQUE_SUD,
  FORME_COQUE,
  coquePack,
  creuxDeCoque,
  formeContact,
  type FormeBox,
} from '../game/formes'
import { TABLEAU_HUB_ROTONDE } from '../game/hubRotonde'
import { niveauExpanse } from '../game/structures'
import { DEFAULT_PARAMS } from './params'
import { FluidSim, KIND_PLAYER } from './solver'

// L'espion compte les évaluations du champ PAR LE SOLVEUR (obstacles.ts
// l'importe) ; les appels internes à formes.ts ne passent pas par lui.
vi.mock('../game/formes', async (original) => {
  const vrai = await original<typeof import('../game/formes')>()
  return { ...vrai, formeContact: vi.fn(vrai.formeContact) }
})

/** Un tirage reproductible : le test doit tomber de la même façon à
 *  chaque exécution, ou pas du tout. */
function hasard(graine: number): () => number {
  let s = graine >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

describe('creuxDeCoque — le rejet ne ment jamais', () => {
  it('au fond du creux, le champ complet est bien au-delà de la marge', () => {
    const alea = hasard(21)
    let creux = 0
    for (let k = 0; k < 300; k++) {
      const hx = 120 + alea() * 900
      const hy = 120 + alea() * 900
      const cx = (alea() - 0.5) * 2000
      const cy = (alea() - 0.5) * 2000
      const b: FormeBox = {
        minX: cx - hx,
        minY: cy - hy,
        maxX: cx + hx,
        maxY: cy + hy,
        forme: FORME_COQUE,
        // des tournées aussi : le repère local doit être celui du champ
        angle: k % 3 === 0 ? (alea() - 0.5) * 180 : undefined,
        ...coquePack({
          cotes: [0, COQUE_NORD, COQUE_EST | COQUE_OUEST, COQUE_NORD | COQUE_SUD | COQUE_EST][k % 4],
          chanfrein: alea() * 0.5,
          ep: 8 + alea() * 200,
          porte: alea() * 600,
        }),
      }
      for (let j = 0; j < 200; j++) {
        const x = cx + (alea() - 0.5) * 2.4 * hx
        const y = cy + (alea() - 0.5) * 2.4 * hy
        const marge = alea() * 120
        if (!creuxDeCoque(b, x, y, marge)) continue
        creux++
        const out = { dist: 0, nx: 0, ny: 0 }
        formeContact(x, y, b, out)
        expect(out.dist).toBeGreaterThan(marge)
      }
    }
    // le test n'a de valeur que si le rejet a beaucoup servi
    expect(creux).toBeGreaterThan(10000)
  })

  it('ne se prononce que sur les coques', () => {
    const rect: FormeBox = { minX: -500, minY: -500, maxX: 500, maxY: 500 }
    expect(creuxDeCoque(rect, 0, 0, 1)).toBe(false)
  })
})

describe('le solveur, au repos dans la rotonde', () => {
  it("n'évalue plus le champ de la coque pour les gouttes au fond de la pièce", () => {
    const lv = niveauExpanse(TABLEAU_HUB_ROTONDE)
    const s = new FluidSim({ ...DEFAULT_PARAMS }, lv.bounds, 4096)
    s.setLevel(lv.boxes, lv.sponges)
    s.spawnDisc(lv.spawn.x, lv.spawn.y, 900, KIND_PLAYER)
    for (let i = 0; i < 60; i++) s.step(s.params.dt)
    const espion = vi.mocked(formes.formeContact)
    espion.mockClear()
    const PAS = 30
    for (let i = 0; i < PAS; i++) s.step(s.params.dt)
    const surCoques = espion.mock.calls.filter(([, , b]) => b.forme === FORME_COQUE).length
    // MESURÉ : sans le rejet du creux, ~1 800 évaluations par pas (900
    // gouttes, deux boucles) ; avec, aucune — le corps est au milieu de
    // la pièce, loin de ses parois.
    expect(surCoques / PAS).toBeLessThan(20)
  })
})

describe('verserAuCorps — le casier ne pose jamais une goutte sur une autre', () => {
  it('toute goutte versée garde ses distances, y compris avec les autres versées', () => {
    const lv = niveauExpanse(TABLEAU_HUB_ROTONDE)
    const s = new FluidSim({ ...DEFAULT_PARAMS }, lv.bounds, 4096)
    s.setLevel(lv.boxes, lv.sponges)
    // un corps PLEIN et la dose du versement automatique (8 %) : l'étendue
    // de départ se cale sur la DOSE, pas sur le corps — elle tombe tout
    // entière dans le cœur occupé, et la couronne ne se trouve qu'après
    // plusieurs élargissements, chacun reproposant les places déjà prises
    s.spawnDisc(lv.spawn.x, lv.spawn.y, 900, KIND_PLAYER)
    for (let i = 0; i < 60; i++) s.step(s.params.dt)
    const avant = s.count
    const poses = s.verserAuCorps(s.stats.centroidX, s.stats.centroidY, 72, KIND_PLAYER)
    expect(poses).toBe(72)
    expect(s.count).toBe(avant + 72)
    const seuil = 0.9 * s.params.particleSpacing
    let pire = Infinity
    for (let i = avant; i < s.count; i++) {
      for (let j = 0; j < s.count; j++) {
        if (j === i) continue
        pire = Math.min(pire, Math.hypot(s.posX[i] - s.posX[j], s.posY[i] - s.posY[j]))
      }
    }
    // Float32 : la position stockée peut perdre un cheveu sur le seuil
    expect(pire).toBeGreaterThanOrEqual(seuil - 1e-3)
  })
})
