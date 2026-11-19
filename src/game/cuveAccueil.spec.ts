import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS } from '../sim/params'
import { FluidSim, KIND_PLAYER } from '../sim/solver'
import { zonesDuHub } from './hub'
import {
  ANNEAU_EPAISSEUR,
  ANNEAU_RAYON,
  CODE_ACCUEIL,
  PUITS_ACCUEIL,
  SATELLITES_BILLES,
  SATELLITES_BOULES,
  SATELLITES_RAYON_MAX,
  SATELLITES_RAYON_MIN,
  VITRE_RAYON,
  cadreAccueil,
  satellitesAccueil,
  tableauAccueil,
} from './cuveAccueil'
import { FORME_DISQUE } from './formes'
import { MAT_BAIE, estUnFond, sansPhysique } from './level'
import { sansSas } from './ronde'

// LA GARDE DE LA CUVE DE L'ACCUEIL : ce qui est éjecté REVIENT. Le vrai
// corps (900 particules), le vrai solveur, le vrai puits : on éjecte dans
// six directions, puis on attend 4 s, et le corps doit avoir repris presque
// tout, recentré, sans qu'une goutte ait passé l'anneau.
//
// « Presque » : une goutte qui frôle la paroi peut y gagner un moment
// cinétique, et elle tourne alors autour du centre sans repasser par le
// corps. Mesuré le 19/11 sur six directions, après 0,5 s et 1,5 s
// d'éjection : à la force d'origine (3 600), il en restait au pire 15
// dehors (885/900) ; à 3 000 (« réduis un peu la gravité », le concepteur
// le 19/11), au pire 9 (891/900) ; à 2 800, 18 (882) — le retour traîne.
// D'où le seuil : 15 gouttes au plus. La goutte la plus lointaine touche
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
    it(`après ${jet} s d’éjection, dans six directions, le corps a repris presque tout en 4 s, recentré, l’anneau intact`, () => {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * 2 * Math.PI
        const { s, dt, pas } = cuve()
        const n0 = s.playerCount
        expect(n0).toBe(900)
        let rMax = 0
        let nMin = n0
        for (let t = 0; t < jet + 4; t += dt) {
          if (t < jet) {
            s.updatePlayerStats()
            s.eject(s.stats.centroidX + 500 * Math.cos(a), s.stats.centroidY + 500 * Math.sin(a), dt)
          }
          pas()
          for (let i = 0; i < s.count; i++) rMax = Math.max(rMax, Math.hypot(s.posX[i], s.posY[i]))
          nMin = Math.min(nMin, s.playerCount)
        }
        s.updatePlayerStats()
        const dir = `direction ${k}/6`
        expect(nMin, dir).toBeLessThan(n0 - 20) // l'éjection a bien pris de la matière
        expect(s.playerCount, dir).toBeGreaterThanOrEqual(n0 - 15) // et elle est revenue
        expect(Math.hypot(s.stats.centroidX, s.stats.centroidY), dir).toBeLessThan(30)
        expect(rMax, dir).toBeLessThan(ANNEAU_RAYON - ANNEAU_EPAISSEUR + 10) // rien n'a passé la paroi
      }
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

  it('est la vitre de la vitrine (habillage 1), et le rendu la lit comme telle', () => {
    const v = lv.boxes.find((b) => b.material === MAT_BAIE)!
    expect(v.skin).toBe(1)
    const RENDU = readFileSync(new URL('../render/renderer.ts', import.meta.url), 'utf-8')
    // l'habillage d'une baie part au shader (aux.z) : sans lui, la vitre
    // reprendrait le balayage répété des baies du jeu
    const i = RENDU.indexOf('bx.material === MAT_BAIE')
    expect(i).toBeGreaterThan(-1)
    expect(RENDU.slice(i, i + 300)).toContain('(bx.skin ?? 0)')
    // deux reflets fixés au verre, et le corps renvoyé dessous
    expect(RENDU).toContain('vitreVitrine = max(vitreVitrine, verre)')
    expect(RENDU).toContain('vec2 rc = refletCorps(world)')
  })

  it('montre un ciel étoilé derrière la vitre — ni la Terre, ni la Voie lactée — quel que soit le ciel de la partie', () => {
    const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')
    expect(MAIN).toContain("const cielVu: CielChoix = level.code === CODE_ACCUEIL ? 'procedural' : cielChoix")
    expect(MAIN).toContain('renderer.setCiel(CIEL_MODE[cielVu])')
    expect(MAIN).toContain("if (cielVu === 'terre') {")
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

// LES SATELLITES : des boules du corps en orbite dès l'ouverture, tirées au
// sort à chaque fois. Une suite pseudo-aléatoire FIXÉE rend le tirage
// reproductible ici ; le jeu passe Math.random.
function suite(graine: number): () => number {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('la cuve de l’accueil — des satellites en orbite dès l’ouverture', () => {
  const ESP = DEFAULT_PARAMS.particleSpacing

  it('tire 3 à 6 boules de 2 à 5 billes, et un autre tirage à chaque ouverture', () => {
    const vus = new Set<string>()
    for (let g = 1; g <= 40; g++) {
      const billes = satellitesAccueil(suite(g), ESP)
      expect(billes.length).toBeGreaterThanOrEqual(SATELLITES_BOULES[0] * SATELLITES_BILLES[0])
      expect(billes.length).toBeLessThanOrEqual(SATELLITES_BOULES[1] * SATELLITES_BILLES[1])
      for (const b of billes) {
        const r = Math.hypot(b.x - PUITS_ACCUEIL.x, b.y - PUITS_ACCUEIL.y)
        expect(r).toBeGreaterThan(SATELLITES_RAYON_MIN - ESP)
        expect(r).toBeLessThan(SATELLITES_RAYON_MAX + ESP)
      }
      vus.add(billes.map((b) => b.x.toFixed(1)).join(','))
    }
    expect(vus.size).toBe(40) // jamais deux ouvertures pareilles
    // et Math.random par défaut : deux appels, deux ciels
    expect(satellitesAccueil(Math.random, ESP)[0].x).not.toBe(satellitesAccueil(Math.random, ESP)[0].x)
  })

  // Mesuré le 19/11, graines 1 à 4, 20 s (plus de cinq tours) : aucune bille
  // reprise ni perdue, toutes entre 0,9 × le rayon minimal et la paroi. On
  // compte les billes libres DANS LA BANDE, seconde par seconde : le corps
  // lui-même lâche par instants une particule de son bord, que le relabel
  // marque libre (une à 106 u, graine 3, à 12,7 s) et reprend au pas suivant —
  // ce n'est pas un satellite qui tombe.
  for (const g of [1, 2, 3, 4]) {
    it(`graine ${g} : les boules tournent 20 s sans retomber sur le corps ni toucher la paroi`, () => {
      const lv = tableauAccueil()
      const s = new FluidSim({ ...DEFAULT_PARAMS }, lv.bounds, 4096)
      s.setLevel(lv.boxes, lv.sponges)
      const billes = satellitesAccueil(suite(g), s.params.particleSpacing)
      // comme peupleCuve (main.ts) : prises au corps, le total reste 900
      s.spawnDisc(lv.spawn.x, lv.spawn.y, lv.spawn.n - billes.length, KIND_PLAYER)
      for (const b of billes) s.poseEgaree(b.x, b.y, b.vx, b.vy)
      expect(s.count).toBe(lv.spawn.n)
      expect(s.baseVolume).toBe(lv.spawn.n)
      const dt = s.params.dt
      const rBas = SATELLITES_RAYON_MIN * 0.9
      const rHaut = ANNEAU_RAYON - ANNEAU_EPAISSEUR
      let pas = 0
      for (let t = 0; t < 20; t += dt, pas++) {
        s.applyPuits(lv.puits!, dt)
        s.step(dt)
        if (pas % Math.round(1 / dt) !== 0) continue
        let enOrbite = 0
        for (let i = 0; i < s.count; i++) {
          if (s.kind[i] === KIND_PLAYER) continue
          const r = Math.hypot(s.posX[i], s.posY[i])
          if (r > rBas && r < rHaut) enOrbite++
        }
        expect(enOrbite, `à ${t.toFixed(1)} s`).toBe(billes.length)
      }
      s.updatePlayerStats()
      // aucune reprise : le corps a toujours ce qu'il avait
      expect(s.playerCount).toBe(lv.spawn.n - billes.length)
      expect(Math.hypot(s.stats.centroidX, s.stats.centroidY)).toBeLessThan(30)
    }, 120000)
  }

  it('la cuve naît peuplée au chargement comme à chaque pause', () => {
    const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')
    const corps = (nom: string): string => {
      const i = MAIN.indexOf(`function ${nom}(`)
      return MAIN.slice(i, MAIN.indexOf('\n}\n', i))
    }
    expect(corps('peupleCuve')).toContain('satellitesAccueil(Math.random')
    expect(corps('createSim')).toContain('if (level.code === CODE_ACCUEIL) peupleCuve(sim, volumeDepart(level))')
    expect(corps('montreCuvePause')).toContain('peupleCuve(s, level.spawn.n)')
  })
})
