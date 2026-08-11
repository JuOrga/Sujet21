import { describe, expect, it } from 'vitest'
import { traceLaser, type TraceMonde } from './laser'
import { MAT_GRILLE, MAT_WALL } from './level'
import { DEFAULT_PARAMS } from '../sim/params'
import { FluidSim, KIND_FREE, KIND_PLAYER, type Bounds } from '../sim/solver'

const BOUNDS: Bounds = { minX: -1000, minY: -600, maxX: 1000, maxY: 600 }

function monde(sur: Partial<TraceMonde> = {}): TraceMonde {
  return {
    bounds: BOUNDS,
    boxes: [],
    portesFermees: [],
    cibles: [],
    iceNormal: null,
    eau: null,
    vapeur: null,
    rails: [],
    ...sur,
  }
}

/** Une dalle d'eau synthétique entre deux x : dioptres verticaux. */
function dalleEau(minX: number, maxX: number): NonNullable<TraceMonde['eau']> {
  const mid = (minX + maxX) / 2
  return {
    dedans: (x) => x >= minX && x <= maxX,
    normale: (x) => (x < mid ? { nx: -1, ny: 0 } : { nx: 1, ny: 0 }),
  }
}

describe('traceLaser — les règles optiques du palier 1', () => {
  it('file droit et s’arrête sur une paroi pleine', () => {
    const t = traceLaser(
      { x: -900, y: 0, angle: 0 },
      monde({ boxes: [{ minX: 200, minY: -200, maxX: 260, maxY: 200, material: MAT_WALL }] }),
    )
    expect(t.points.length).toBe(2)
    const fin = t.points[t.points.length - 1]
    expect(fin.x).toBeGreaterThan(195)
    expect(fin.x).toBeLessThan(270)
    expect(t.touchees).toEqual([])
  })

  it('passe la grille (de la lumière entre des mailles) et allume la cible derrière', () => {
    const t = traceLaser(
      { x: -900, y: 0, angle: 0 },
      monde({
        boxes: [{ minX: 0, minY: -200, maxX: 60, maxY: 200, material: MAT_GRILLE }],
        cibles: [{ x: 700, y: 0, r: 26 }],
      }),
    )
    expect(t.touchees).toEqual([0])
  })

  it('une porte fermée absorbe ; retirée (ouverte), le faisceau passe', () => {
    const porte = { minX: 100, minY: -150, maxX: 140, maxY: 150 }
    const fermee = traceLaser(
      { x: -900, y: 0, angle: 0 },
      monde({ portesFermees: [porte], cibles: [{ x: 700, y: 0, r: 26 }] }),
    )
    expect(fermee.touchees).toEqual([])
    const ouverte = traceLaser(
      { x: -900, y: 0, angle: 0 },
      monde({ portesFermees: [], cibles: [{ x: 700, y: 0, r: 26 }] }),
    )
    expect(ouverte.touchees).toEqual([0])
  })

  it('la glace RÉFLÉCHIT : un miroir plat à 45° renvoie le faisceau vers le haut', () => {
    // miroir synthétique : une bande de « glace » dont la normale est (−1, 1)/√2
    const n = Math.SQRT1_2
    const t = traceLaser(
      { x: -900, y: 0, angle: 0 },
      monde({
        iceNormal: (x, y) => (x > 0 && Math.abs(y - (x - 20)) < 24 ? { nx: -n, ny: n } : null),
        cibles: [{ x: 30, y: 400, r: 40 }], // au-dessus du point d'impact
      }),
    )
    expect(t.touchees).toEqual([0]) // réfléchi vers le haut, la cible s'allume
    expect(t.points.length).toBeGreaterThan(2) // il y a bien eu un rebond
  })

  it('le corps GELÉ de la simulation réfléchit réellement le faisceau', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, BOUNDS, 2048)
    // un pavé de glace incliné n'est pas nécessaire : un mur vertical de glace
    // renvoie un faisceau horizontal sur ses pas
    for (let k = -8; k <= 8; k++) {
      for (let c = 0; c < 3; c++) {
        const i = sim.addParticle(300 + c * 6, k * 6, KIND_FREE)
        sim.frost[i] = 1
        sim.frozen[i] = 1
      }
    }
    sim.step(sim.params.dt) // construit la grille de voisinage
    const rIce = sim.params.particleSpacing * 1.3
    const t = traceLaser(
      { x: -400, y: 0, angle: 0 },
      monde({ iceNormal: (x, y) => sim.iceNormalAt(x, y, rIce, sim.params.laserMirrorSmooth) }),
    )
    expect(t.points.length).toBeGreaterThan(2) // rebond constaté
    const fin = t.points[t.points.length - 1]
    expect(fin.x).toBeLessThan(300) // renvoyé du côté d'où il venait
  })

  it('l’eau RÉFRACTE (palier 2) : une dalle décale le rayon sans changer son cap', () => {
    // un rayon oblique traversant une dalle à faces parallèles ressort
    // PARALLÈLE à lui-même, décalé latéralement — la signature du prisme
    const t = traceLaser(
      { x: -300, y: 0, angle: 25 },
      monde({ eau: dalleEau(0, 120) }),
    )
    expect(t.points.length).toBeGreaterThanOrEqual(4) // deux dioptres au moins
    const fin = t.points[t.points.length - 1]
    const avant = t.points[t.points.length - 2]
    const l = Math.hypot(fin.x - avant.x, fin.y - avant.y)
    const dirX = (fin.x - avant.x) / l
    const dirY = (fin.y - avant.y) / l
    const a = (25 * Math.PI) / 180
    // cap de sortie = cap d'entrée (faces parallèles)
    expect(dirX * Math.cos(a) + dirY * Math.sin(a)).toBeGreaterThan(0.999)
    // mais décalé : dans la dalle, le rayon a couru plus près de l'axe x
    // que la ligne droite ne l'aurait fait
    const yDroit = (fin.x - -300) * Math.tan(a)
    expect(fin.y).toBeLessThan(yDroit - 5)
  })

  it('la RÉFLEXION TOTALE INTERNE piège le rayon trop rasant sous la surface', () => {
    // eau : tout le demi-plan y < 0. Normale de surface : vers le haut.
    const nappe: NonNullable<TraceMonde['eau']> = {
      dedans: (_x, y) => y < 0,
      normale: () => ({ nx: 0, ny: 1 }),
    }
    // depuis l'eau, à 20° au-dessus de l'horizontale : incidence 70° > 49°
    // critique → le rayon ricoche sous la surface, il ne sort JAMAIS
    const piege = traceLaser({ x: -600, y: -120, angle: 20 }, monde({ eau: nappe }))
    expect(piege.points.length).toBeGreaterThan(2) // il y a bien eu ricochet
    for (const p of piege.points.slice(1)) expect(p.y).toBeLessThan(1)
    // à 60° au-dessus de l'horizontale : incidence 30° < critique → il sort
    const sorti = traceLaser({ x: -600, y: -120, angle: 60 }, monde({ eau: nappe }))
    const fin = sorti.points[sorti.points.length - 1]
    expect(fin.y).toBeGreaterThan(0)
  })

  it('le corps SIMULÉ plie réellement le faisceau qui le traverse hors d’axe', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, BOUNDS, 4096)
    // ~700 particules ≈ un disque de rayon 85 u — assez épais pour une lentille
    sim.spawnDisc(0, 0, 700, KIND_PLAYER)
    sim.relabel()
    sim.step(sim.params.dt)
    const t = traceLaser(
      { x: -600, y: -45, angle: 0 },
      monde({
        eau: {
          dedans: (x, y) => sim.liquidAt(x, y, sim.params.laserMirrorSmooth * 0.6),
          normale: (x, y) => sim.liquidNormalAt(x, y, sim.params.laserMirrorSmooth),
        },
      }),
    )
    expect(t.points.length).toBeGreaterThan(2) // des dioptres ont été franchis
    const fin = t.points[t.points.length - 1]
    // en ligne droite il finirait à y = −45 : la lentille l'a dévié
    expect(Math.abs(fin.y - -45)).toBeGreaterThan(8)
  })

  it('la capture se fait N’IMPORTE OÙ le long du rail, et l’arc suit le SENS du tracé', () => {
    // un rail vertical qui MONTE (sens du tracé : bas → haut), croisé en son
    // milieu par le faisceau ; le nuage de vapeur est posé sur le croisement
    const rail = { points: [{ x: 100, y: -300 }, { x: 100, y: 300 }] }
    const nuage = (x: number, y: number): boolean => Math.hypot(x - 100, y) < 60
    const monte = traceLaser(
      { x: -500, y: 0, angle: 0 },
      monde({
        vapeur: nuage,
        rails: [rail],
        cibles: [{ x: 100, y: 300, r: 26 }, { x: 100, y: -300, r: 26 }],
      }),
    )
    expect(monte.touchees).toEqual([0]) // l'arc est monté — le sens du tracé
    // le MÊME rail inversé : le même croisement descend
    const descend = traceLaser(
      { x: -500, y: 0, angle: 0 },
      monde({
        vapeur: nuage,
        rails: [{ points: [...rail.points].reverse() }],
        cibles: [{ x: 100, y: 300, r: 26 }, { x: 100, y: -300, r: 26 }],
      }),
    )
    expect(descend.touchees).toEqual([1])
  })

  it('le PLASMA (palier 3) : ionisé dans la vapeur, l’arc suit le rail en équerre', () => {
    // un nuage de vapeur autour de l'origine, un rail en L qui monte : le
    // faisceau horizontal, ionisé dans le nuage, est capturé à (0,0), longe
    // le rail, tourne à 90°, et allume une cible que rien n'atteint droit
    const rail = { points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 300 }] }
    const nuage = (x: number, y: number): boolean => Math.hypot(x, y) < 60
    const avec = traceLaser(
      { x: -500, y: 0, angle: 0 },
      monde({ vapeur: nuage, rails: [rail], cibles: [{ x: 200, y: 300, r: 26 }] }),
    )
    expect(avec.touchees).toEqual([0])
    expect(avec.points.some((p) => p.plasma === true)).toBe(true)
    // sans nuage : pas d'ionisation, le rail est ignoré, la cible reste éteinte
    const sans = traceLaser(
      { x: -500, y: 0, angle: 0 },
      monde({ vapeur: () => false, rails: [rail], cibles: [{ x: 200, y: 300, r: 26 }] }),
    )
    expect(sans.touchees).toEqual([])
  })

  it('l’arc guidé reste de la lumière : une porte fermée sur le rail l’absorbe', () => {
    const rail = { points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 300 }] }
    const t = traceLaser(
      { x: -500, y: 0, angle: 0 },
      monde({
        vapeur: (x, y) => Math.hypot(x, y) < 60,
        rails: [rail],
        portesFermees: [{ minX: 160, minY: 100, maxX: 240, maxY: 140 }], // en travers du rail
        cibles: [{ x: 200, y: 300, r: 26 }],
      }),
    )
    expect(t.touchees).toEqual([]) // l'arc s'est éteint sur la porte
    const fin = t.points[t.points.length - 1]
    expect(fin.y).toBeGreaterThan(90)
    expect(fin.y).toBeLessThan(150)
  })

  it('la VAPEUR simulée ionise réellement le faisceau', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, BOUNDS, 2048)
    // un petit nuage de particules gazeuses posé sur le trajet, près de
    // l'entrée du rail
    for (let k = 0; k < 40; k++) {
      const i = sim.addParticle(-20 + (k % 8) * 7, -14 + Math.floor(k / 8) * 7, KIND_FREE)
      sim.vapor[i] = 1 // progression de vaporisation pleine : le pas la garde gazeuse
      sim.gaseous[i] = 1
    }
    sim.step(sim.params.dt)
    const rIce = sim.params.particleSpacing * 1.3
    const t = traceLaser(
      { x: -500, y: 0, angle: 0 },
      monde({
        vapeur: (x, y) => sim.gasAt(x, y, rIce),
        rails: [{ points: [{ x: 30, y: 0 }, { x: 30, y: 300 }] }],
        railRadius: 30,
        cibles: [{ x: 30, y: 300, r: 26 }],
      }),
    )
    expect(t.touchees).toEqual([0]) // capturé dans le vrai nuage, guidé, cible allumée
  })

  it('le champ actif CONVOIE la vapeur le long du rail — l’eau ne sent rien', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, BOUNDS, 2048)
    const gaz = sim.addParticle(105, 0, KIND_FREE)
    sim.vapor[gaz] = 1
    sim.gaseous[gaz] = 1
    const eau = sim.addParticle(112, 10, KIND_FREE) // liquide, dans la bande
    const loin = sim.addParticle(400, 0, KIND_FREE)
    sim.vapor[loin] = 1
    sim.gaseous[loin] = 1 // gazeuse, hors bande : une retardataire du nuage
    // rail vertical montant, la particule gazeuse posée dessus
    const rail = [{ x: 100, y: -300 }, { x: 100, y: 300 }]
    for (let s = 0; s < 30; s++) sim.railConvoy(rail, 75, 950, 1 / 120)
    expect(sim.velY[gaz]).toBeGreaterThan(50) // entraînée vers le haut (sens du tracé)
    expect(Math.abs(sim.velY[eau])).toBeLessThan(1) // le liquide ignore le champ
    // la retardataire n'est pas abandonnée : rappelée vers le cœur convoyé
    // (vers −x, où le champ emporte le nuage) — le nuage fait corps
    expect(sim.velX[loin]).toBeLessThan(-30)
  })

  it('au terminus, le convoyage FREINE : le nuage arrive en gare, pas en boulet', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, BOUNDS, 2048)
    const rail = [{ x: 100, y: -300 }, { x: 100, y: 300 }]
    // un point du nuage arrive au bout de la ligne, lancé à pleine vitesse
    const gaz = sim.addParticle(100, 280, KIND_FREE)
    sim.vapor[gaz] = 1
    sim.gaseous[gaz] = 1
    sim.velY[gaz] = 500
    for (let s = 0; s < 30; s++) sim.railConvoy(rail, 75, 950, 1 / 120)
    // freiné, pas relancé : la vitesse retombe nettement sous l'arrivée
    expect(Math.abs(sim.velY[gaz])).toBeLessThan(250)
    // et loin du terminus, la poussée reste entière
    const sim2 = new FluidSim({ ...DEFAULT_PARAMS }, BOUNDS, 2048)
    const g2 = sim2.addParticle(100, 0, KIND_FREE)
    sim2.vapor[g2] = 1
    sim2.gaseous[g2] = 1
    for (let s = 0; s < 30; s++) sim2.railConvoy(rail, 75, 950, 1 / 120)
    expect(sim2.velY[g2]).toBeGreaterThan(50)
  })

  it('condenser au terminus n’explose pas : la poche gare le nuage à densité naturelle', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, BOUNDS, 2048)
    sim.spawnDisc(100, 200, 80, KIND_PLAYER)
    sim.relabel()
    for (let i = 0; i < sim.count; i++) {
      sim.vapor[i] = 1
      sim.gaseous[i] = 1
    }
    const rail = [{ x: 100, y: -300 }, { x: 100, y: 300 }]
    const dt = sim.params.dt
    // le champ porte le nuage jusqu'en gare et l'y retient
    for (let s = 0; s < 240; s++) {
      sim.railConvoy(rail, 75, 950, dt)
      sim.step(dt)
    }
    // condensation : retour à l'eau, le champ lâche prise
    for (let i = 0; i < sim.count; i++) {
      sim.vapor[i] = 0
      sim.gaseous[i] = 0
    }
    for (let s = 0; s < 120; s++) sim.step(dt)
    expect(sim.dispersed).toBe(false)
    let vMax = 0
    for (let i = 0; i < sim.count; i++) {
      vMax = Math.max(vMax, Math.hypot(sim.velX[i], sim.velY[i]))
    }
    expect(vMax).toBeLessThan(500) // pas de giclée : la livraison est douce
  })

  it('le convoyage dit qui reste dans la bande : le champ tient jusqu’à l’arrivée', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, BOUNDS, 2048)
    const gaz = sim.addParticle(105, 0, KIND_FREE)
    sim.vapor[gaz] = 1
    sim.gaseous[gaz] = 1
    const rail = [{ x: 100, y: -300 }, { x: 100, y: 300 }]
    // nuage dans la bande : le compte est non nul — l'appelant maintient le
    // champ engagé même si le rayon ne traverse plus la vapeur
    expect(sim.railConvoy(rail, 75, 950, 1 / 120)).toBe(1)
    // nuage arrivé au bout et sorti de la bande : le champ peut se relâcher
    sim.posX[gaz] = 100
    sim.posY[gaz] = 500 // au-delà du dernier point, hors bande
    expect(sim.railConvoy(rail, 75, 950, 1 / 120)).toBe(0)
  })

  it('une goutte isolée ne réfracte plus : le milieu est une isoligne de densité', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, BOUNDS, 256)
    sim.addParticle(0, 0, KIND_FREE) // une gouttelette égarée sur le trajet
    sim.step(sim.params.dt)
    const t = traceLaser(
      { x: -400, y: 3, angle: 0 },
      monde({
        eau: {
          dedans: (x, y) => sim.liquidAt(x, y, sim.params.laserMirrorSmooth * 0.6),
          normale: (x, y) => sim.liquidNormalAt(x, y, sim.params.laserMirrorSmooth),
        },
      }),
    )
    expect(t.points.length).toBe(2) // aucun dioptre : le rayon file droit
    expect(Math.abs(t.points[1].y - 3)).toBeLessThan(0.5)
  })

  it('la normale du miroir est LISSE le long d’une face plane, malgré le grain des particules', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, BOUNDS, 2048)
    // un mur de glace vertical, en réseau : sa face gauche est plane
    for (let k = -12; k <= 12; k++) {
      for (let c = 0; c < 4; c++) {
        const i = sim.addParticle(300 + c * 6, k * 6, KIND_FREE)
        sim.frost[i] = 1
        sim.frozen[i] = 1
      }
    }
    sim.step(sim.params.dt)
    const rHit = sim.params.particleSpacing * 1.3
    // échantillonnée en plusieurs points de la face : la normale moyenne doit
    // pointer franchement vers −x, sans partir dans tous les sens
    for (const y of [-40, -20, 0, 20, 40]) {
      const n = sim.iceNormalAt(295, y, rHit, sim.params.laserMirrorSmooth)
      expect(n).not.toBeNull()
      expect(n!.nx).toBeLessThan(-0.9)
      expect(Math.abs(n!.ny)).toBeLessThan(0.45)
    }
  })
})
