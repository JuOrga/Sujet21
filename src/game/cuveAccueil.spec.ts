import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../sim/params'
import { FluidSim, KIND_PLAYER } from '../sim/solver'
import { zonesDuHub } from './hub'
import { ANNEAU_EPAISSEUR, ANNEAU_RAYON, CODE_ACCUEIL, PUITS_ACCUEIL, VITRE_RAYON, cadreAccueil, tableauAccueil } from './cuveAccueil'
import { FORME_DISQUE } from './formes'
import { MAT_BAIE, estUnFond, sansPhysique } from './level'
import { sansSas } from './ronde'

// LA GARDE DE LA CUVE DE L'ACCUEIL : ce qui est éjecté REVIENT. Le vrai
// corps (900 particules), le vrai solveur, le vrai puits : on éjecte, puis
// on attend, et le corps doit avoir tout repris, recentré, sans qu'une
// goutte ait passé l'anneau. Mesuré le 18/11 : après 0,5 s d'éjection le
// corps tombe à 868 et revient à 900 en moins de 2 s ; après 1,5 s, il
// tombe à 805 et revient à 900 en 4 s ; la goutte la plus lointaine touche
// la paroi (647 u pour un anneau intérieur à 650). Si ce test tombe, on
// remesure — on ne retouche pas un nombre à la main.

function cuve(): { s: FluidSim; dt: number; pas: () => void } {
  const lv = tableauAccueil()
  const s = new FluidSim({ ...DEFAULT_PARAMS }, lv.bounds, 4096)
  s.setLevel(lv.boxes, lv.sponges)
  s.spawnDisc(lv.spawn.x, lv.spawn.y, lv.spawn.n, KIND_PLAYER)
  const dt = s.params.dt
  const pas = (): void => {
    s.applyPuits(lv.puits!, dt)
    s.step(dt)
  }
  for (let t = 0; t < 1; t += dt) pas() // le corps se pose
  return { s, dt, pas }
}

describe('la cuve de l’accueil — ce qui est éjecté revient', () => {
  for (const jet of [0.5, 1.5]) {
    it(`après ${jet} s d’éjection, le corps a tout repris en 4 s, recentré, l’anneau intact`, () => {
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
      expect(rMax).toBeLessThan(ANNEAU_RAYON - ANNEAU_EPAISSEUR + 10) // rien n'a passé la paroi
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

  it('a une vitre sous l’échantillon : un disque de baie, sans physique, sous la paroi', () => {
    const vitres = lv.boxes.filter((b) => b.material === MAT_BAIE)
    expect(vitres).toHaveLength(1)
    const v = vitres[0]
    expect(v.forme).toBe(FORME_DISQUE)
    expect(v.maxX).toBe(VITRE_RAYON)
    expect(v.minX).toBe(-VITRE_RAYON)
    // centrée sous le corps, et sa bordure passe SOUS la paroi de l'anneau :
    // aucun jour entre la monture et la coque
    expect((v.minX + v.maxX) / 2).toBe(lv.spawn.x)
    expect((v.minY + v.maxY) / 2).toBe(lv.spawn.y)
    expect(VITRE_RAYON).toBeGreaterThan(ANNEAU_RAYON - ANNEAU_EPAISSEUR)
    expect(VITRE_RAYON).toBeLessThan(ANNEAU_RAYON)
    // du décor : le solveur ne la voit pas, et elle se peint sous tout
    expect(sansPhysique(v.material)).toBe(true)
    expect(estUnFond(v.material)).toBe(true)
  })

  it('a un cœur de puits plus large que l’anneau : pas de halo, qui étire', () => {
    expect(PUITS_ACCUEIL.rayon!).toBeGreaterThan(ANNEAU_RAYON)
  })

  it('se cadre entière au milieu de la place libre, à droite du rail comme au téléphone', () => {
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
      // et l'anneau y tient
      const d = 2 * ANNEAU_RAYON * c.zoom
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
