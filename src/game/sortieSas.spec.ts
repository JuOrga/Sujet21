import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../sim/params'
import { FluidSim, KIND_FREE, KIND_PLAYER, type Bounds } from '../sim/solver'
import { corpsBuParLeSas } from './sortieSas'

// LA DERNIÈRE IMPULSION QUI FINIT DANS LE SAS est une victoire (25/11) :
// voir sortieSas.ts pour la panne et sa cause.

const OPEN: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

describe('le corps bu par le sas sous la dernière impulsion', () => {
  it('un corps à sec, gelé, entièrement bu, alors que des gouttes traînent ailleurs', () => {
    const p = DEFAULT_PARAMS
    const sim = new FluidSim({ ...p }, OPEN, 4096)
    // le départ : un corps ordinaire, dont les impulsions ont semé la salle
    sim.spawnDisc(2400, 2400, 400, KIND_FREE) // les gouttes éjectées, loin du sas
    // ce qui reste du corps : sous le seuil critique (0,3 L), figé en glace
    const critique = Math.floor(p.criticalVolumeLiters / p.litersPerParticle)
    sim.spawnDisc(60, 0, critique - 10, KIND_PLAYER)
    for (let i = 0; i < sim.count; i++) if (sim.kind[i] === KIND_PLAYER) sim.frozen[i] = 1
    sim.relabel()
    sim.baseVolume = 600 // le volume de départ de la salle
    const reste = sim.playerCount
    expect(reste).toBeLessThan(critique)

    let emprise = false
    for (let s = 0; s < 600 && sim.playerCount > 0; s++) {
      sim.applyExitSuction(0, 0, p.dt)
      sim.step(p.dt)
      emprise = sim.dansEmprise
    }
    expect(sim.playerCount).toBeLessThan(2)
    expect(sim.dispersed).toBe(false)

    // les deux conclusions d'avant restaient fermées : la panne
    const seuilBu = Math.max(6, sim.baseVolume * 0.02)
    expect(sim.count).toBeGreaterThan(seuilBu) // « tout bu » : jamais
    expect(sim.swallowed).toBeLessThan(Math.max(20, sim.baseVolume * 0.1)) // CONTINUER : jamais

    // la nouvelle : le corps a disparu dans la bouche, c'est une sortie
    expect(
      corpsBuParLeSas({
        swallowed: sim.swallowed,
        playerCount: sim.playerCount,
        empriseRecente: emprise,
        videPris: false,
      }),
    ).toBe(true)
  })

  it('un corps perdu LOIN du sas reste une défaite', () => {
    expect(
      corpsBuParLeSas({ swallowed: 30, playerCount: 0, empriseRecente: false, videPris: false }),
    ).toBe(false)
  })

  it('le vide qui avale le corps ne vaut pas le sas', () => {
    expect(
      corpsBuParLeSas({ swallowed: 30, playerCount: 0, empriseRecente: true, videPris: true }),
    ).toBe(false)
  })

  it('un corps encore là, ou rien de bu : rien ne conclut', () => {
    expect(
      corpsBuParLeSas({ swallowed: 30, playerCount: 12, empriseRecente: true, videPris: false }),
    ).toBe(false)
    expect(
      corpsBuParLeSas({ swallowed: 0, playerCount: 0, empriseRecente: true, videPris: false }),
    ).toBe(false)
  })

  it('la boucle de jeu en fait une sortie rattrapée (victoire, ni sursis ni défaite)', () => {
    // main.ts ne s'importe pas en test : on lit sa source (main-continuer.spec.ts)
    const SRC = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')
    const decl = SRC.match(/const sortieRattrapee =([\s\S]*?)\n\s*if \(sortieRattrapee\)/)?.[1] ?? ''
    expect(decl).toContain('corpsBu')
    expect(SRC).toMatch(/const corpsBu = corpsBuParLeSas\(\{/)
  })
})
