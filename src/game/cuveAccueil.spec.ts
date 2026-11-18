import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../sim/params'
import { FluidSim, KIND_PLAYER } from '../sim/solver'
import { zonesDuHub } from './hub'
import { CADRE_RAYON, CODE_ACCUEIL, PUITS_ACCUEIL, cadreAccueil, freineVitrine, tableauAccueil } from './cuveAccueil'
import { sansSas } from './ronde'

// LA GARDE DE LA CUVE DE L'ACCUEIL : ce qui est éjecté REVIENT. Le vrai
// corps (900 particules), le vrai solveur, le vrai puits, le frein de la
// vitrine : on éjecte, puis on attend, et le corps doit avoir tout repris,
// recentré, sans qu'une goutte ait atteint les bornes ni quitté le cœur du
// puits. Mesuré le 18/11, sans anneau, force 2 700, frein 0,6/s : après
// 0,5 s d'éjection le corps tombe à 872 et revient à 900 en 1,6 s ; après
// 1,5 s, il tombe à 810 et revient à 900 en 1,9 s ; la goutte la plus
// lointaine monte à 695 u. Sans le frein, 894 sur 900 six secondes après le
// jet de 1,5 s : des gouttes orbitent sans fin. Si ce test tombe, on
// remesure — on ne retouche pas un nombre à la main.

function cuve(): { s: FluidSim; dt: number; pas: () => void } {
  const lv = tableauAccueil()
  const s = new FluidSim({ ...DEFAULT_PARAMS }, lv.bounds, 4096)
  s.setLevel(lv.boxes, lv.sponges)
  s.spawnDisc(lv.spawn.x, lv.spawn.y, lv.spawn.n, KIND_PLAYER)
  const dt = s.params.dt
  const pas = (): void => {
    s.applyPuits(lv.puits!, dt)
    freineVitrine(s, dt)
    s.step(dt)
  }
  for (let t = 0; t < 1; t += dt) pas() // le corps se pose
  return { s, dt, pas }
}

describe('la cuve de l’accueil — ce qui est éjecté revient', () => {
  for (const jet of [0.5, 1.5, 3]) {
    it(`après ${jet} s d’éjection, le corps a tout repris en 4 s, recentré, rien aux bornes`, () => {
      const { s, dt, pas } = cuve()
      const n0 = s.playerCount
      expect(n0).toBe(900)
      let rMax = 0
      let nMin = n0
      for (let t = 0; t < jet + 4; t += dt) {
        if (t < jet) {
          s.updatePlayerStats()
          s.eject(s.stats.centroidX + 500, s.stats.centroidY + 100, dt)
        }
        pas()
        for (let i = 0; i < s.count; i++) rMax = Math.max(rMax, Math.hypot(s.posX[i], s.posY[i]))
        nMin = Math.min(nMin, s.playerCount)
      }
      s.updatePlayerStats()
      expect(nMin).toBeLessThan(n0 - 20) // l'éjection a bien pris de la matière
      expect(s.playerCount).toBe(n0) // et toute la matière est revenue
      expect(Math.hypot(s.stats.centroidX, s.stats.centroidY)).toBeLessThan(30)
      // rien n'a touché les bornes du solveur (des murs invisibles), ni quitté
      // le cœur harmonique du puits
      expect(rMax).toBeLessThan(Math.min(tableauAccueil().bounds.maxX, PUITS_ACCUEIL.rayon!) - 50)
    }, 120000)
  }
})

describe('la cuve de l’accueil — une vitrine, pas une salle', () => {
  const lv = tableauAccueil()

  it('n’a pas de sas : rien ne s’y conclut', () => {
    expect(sansSas(lv)).toBe(true)
    expect(lv.code).toBe(CODE_ACCUEIL)
  })

  it('reste sous 2 600 u : le hub ne lui prête ni sas ni comptoir codés en dur', () => {
    expect(zonesDuHub(lv)).toBeNull()
  })

  it('n’a ni paroi ni structure : l’échantillon flotte devant les étoiles', () => {
    expect(lv.boxes).toEqual([])
    expect(lv.structures ?? []).toEqual([])
    expect(lv.coque).toBe('structures') // pas de fond de cuve : le dehors partout
  })

  it('montre la Voie lactée, sans la Terre, quel que soit le ciel de la partie', () => {
    const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')
    expect(MAIN).toContain("const cielVu: CielChoix = level.code === CODE_ACCUEIL ? 'plaque' : cielChoix")
    expect(MAIN).toContain('renderer.setCiel(CIEL_MODE[cielVu])')
    expect(MAIN).toContain("if (cielVu === 'terre') {")
  })

  it('freine ses gouttes dans le jeu comme dans le test : à l’accueil et en pause', () => {
    const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')
    expect(MAIN).toContain('if (level.code === CODE_ACCUEIL) freineVitrine(sim, params.dt)')
    expect(MAIN.match(/freineVitrine\(sim, params\.dt\)/g)?.length).toBe(2)
  })

  it('se cadre au milieu de la place libre, à droite du rail comme au téléphone', () => {
    for (const [vueL, vueH, libre] of [
      [1280, 800, { left: 374, top: 0, right: 1280, bottom: 800 }],
      [390, 844, { left: 0, top: 90, right: 390, bottom: 560 }],
    ] as const) {
      const c = cadreAccueil(vueL, vueH, libre)
      // le centre du monde tombe au centre de la place libre
      const sx = vueL / 2 + (0 - c.x) * c.zoom
      const sy = vueH / 2 - (0 - c.y) * c.zoom
      expect(sx).toBeCloseTo((libre.left + libre.right) / 2, 6)
      expect(sy).toBeCloseTo((libre.top + libre.bottom) / 2, 6)
      // et le disque montré y tient
      const d = 2 * CADRE_RAYON * c.zoom
      expect(d).toBeLessThanOrEqual(Math.min(libre.right - libre.left, libre.bottom - libre.top))
    }
  })

  it('se charge derrière la fiche tant qu’aucune partie n’a commencé', () => {
    const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')
    expect(MAIN).toMatch(/auHub && !hasPlayed\s*\?\s*CUVE_ACCUEIL/)
    // hasPlayed se déclare AVANT le premier applyLevel du chargement
    expect(MAIN.indexOf('let hasPlayed = false')).toBeLessThan(MAIN.indexOf('\napplyLevel()'))
  })
})

// LA PAUSE MONTRE LA CUVE : main.ts met la partie de côté à l'ouverture de
// la fiche et la rend avant tout ce qui fait jouer. Rien ne relie ces gestes
// qu'un nom en toutes lettres : la garde les lit dans la source.
describe('la pause montre la cuve, la partie attend de côté', () => {
  const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')
  const corps = (nom: string): string => {
    const i = MAIN.indexOf(`function ${nom}(`)
    expect(i, `function ${nom} manque à main.ts`).toBeGreaterThan(-1)
    return MAIN.slice(i, MAIN.indexOf('\n}\n', i))
  }

  it('la fiche ouverte sur une partie montre la cuve', () => {
    expect(corps('openHome')).toContain('montreCuvePause()')
  })

  it('la cuve a son solveur à elle : createSim recouvrirait les réglages de la partie', () => {
    const montre = corps('montreCuvePause')
    expect(montre).not.toContain('createSim(')
    expect(montre).toContain('new FluidSim(')
    expect(montre).toContain('CUVE_ACCUEIL')
  })

  it('la partie revient avant tout ce qui fait jouer : reprendre, recharger une salle', () => {
    expect(corps('restart').split('\n').slice(0, 5).join('\n')).toContain('rendPartie()')
    const ferme = corps('closeHome')
    expect(ferme.indexOf('rendPartie()')).toBeGreaterThan(-1)
    expect(ferme.indexOf('rendPartie()')).toBeLessThan(ferme.lastIndexOf("classList.add('playing')"))
  })

  it('jamais la cuve en pleine partie : la boucle rend la partie si le jeu reprend', () => {
    expect(MAIN).toContain("if (vitrinePause && document.body.classList.contains('playing')) rendPartie()")
  })

  it('pendant la pause, seule la cuve avance : la boucle a sa branche à elle', () => {
    expect(MAIN).toMatch(/\} else if \(vitrinePause\) \{\s*\/\/ LA CUVE DE LA PAUSE/)
  })

  it('une salle recalculée pendant la pause attend avec la partie', () => {
    expect(corps('applyLevel')).toContain('vitrinePause.level = lv')
  })
})
