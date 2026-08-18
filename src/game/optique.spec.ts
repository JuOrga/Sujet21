// Contrôle PHYSIQUE de la réfraction : on compare le faisceau tracé aux
// valeurs exactes de Snell-Descartes, sur des géométries calculables à la
// main. C'est le garde-fou du « palier 2 » : le corps liquide est un
// prisme, il doit plier la lumière comme un vrai.
import { describe, expect, it } from 'vitest'
import { traceLaser, LASER_INDICE_EAU, type TraceMonde } from './laser'
import { FluidSim, KIND_PLAYER, type Bounds } from '../sim/solver'
import { DEFAULT_PARAMS } from '../sim/params'

const BOUNDS: Bounds = { minX: -3000, minY: -2000, maxX: 3000, maxY: 2000 }
const n = LASER_INDICE_EAU

function monde(eau: TraceMonde['eau']): TraceMonde {
  return {
    bounds: BOUNDS,
    boxes: [],
    portesFermees: [],
    cibles: [],
    iceNormal: null,
    eau,
    vapeur: null,
    rails: [],
  }
}

/** La direction du DERNIER segment du faisceau, en degrés. */
function sortie(res: { points: { x: number; y: number }[] }): number {
  const p = res.points
  const a = p[p.length - 2]
  const b = p[p.length - 1]
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
}

describe('réfraction — la LAME à faces parallèles', () => {
  // Loi bien connue : en traversant une lame à faces parallèles, le rayon
  // ressort PARALLÈLE à lui-même (simplement décalé). C'est le test le plus
  // sévère de l'angle de sortie : toute erreur de signe ou d'indice à la
  // seconde interface se voit immédiatement.
  const lame = (minX: number, maxX: number): NonNullable<TraceMonde['eau']> => ({
    dedans: (x) => x >= minX && x <= maxX,
    normale: (x) => (x < (minX + maxX) / 2 ? { nx: -1, ny: 0 } : { nx: 1, ny: 0 }),
  })

  for (const angle of [10, 20, 30, 40]) {
    it(`à ${angle}°, le rayon ressort parallèle à son entrée`, () => {
      const res = traceLaser({ x: -800, y: 0, angle }, monde(lame(-200, 200)))
      expect(sortie(res)).toBeCloseTo(angle, 0)
    })
  }
})

describe('réfraction — la GOUTTE ronde', () => {
  // Pour une sphère (ici un disque), la déviation totale vaut exactement
  // D = 2 (θ1 − θ2), avec sin θ1 = b/R (b : paramètre d'impact) et
  // sin θ2 = sin θ1 / n. Le faisceau doit se plier VERS l'axe.
  const R = 500
  const goutte: NonNullable<TraceMonde['eau']> = {
    dedans: (x, y) => Math.hypot(x, y) <= R,
    normale: (x, y) => {
      const d = Math.max(1e-6, Math.hypot(x, y))
      return { nx: x / d, ny: y / d }
    },
  }

  for (const b of [100, 200, 300]) {
    it(`paramètre d'impact ${b} : la déviation suit 2(θ1 − θ2)`, () => {
      const res = traceLaser({ x: -2000, y: b, angle: 0 }, monde(goutte))
      const th1 = Math.asin(b / R)
      const th2 = Math.asin(Math.sin(th1) / n)
      const attendu = (-2 * (th1 - th2) * 180) / Math.PI // vers l'axe : y décroît
      expect(sortie(res)).toBeCloseTo(attendu, 0)
    })
  }
})

describe('le dioptre du CORPS : la normale doit être celle de la surface traversée', () => {
  // Garde-fou de cohérence : la surface (liquidAt) et la normale
  // (liquidNormalAt) se calculaient sur deux champs de rayons différents —
  // la normale n'était donc pas perpendiculaire au dioptre franchi, et
  // l'angle de sortie s'en trouvait faux. Les deux doivent partager le
  // même rayon ; ce test le prouve en mesurant l'écart angulaire.
  it('l’écart à la vraie normale reste sous 2,5° (il valait 4,7°, jusqu’à 14,6°)', () => {
    const sim = new FluidSim({ ...DEFAULT_PARAMS }, { minX: -1000, minY: -600, maxX: 1000, maxY: 600 }, 4096)
    sim.spawnDisc(0, 0, 700, KIND_PLAYER)
    sim.relabel()
    sim.step(sim.params.dt)
    const r = sim.params.laserMirrorSmooth * 0.6 // le rayon du dioptre, celui de main.ts
    // champ continu de CETTE surface (même noyau que liquidAt)
    const champ = (x: number, y: number): number => {
      let s = 0
      for (let j = 0; j < sim.count; j++) {
        if (sim.frozen[j] === 1 || sim.gaseous[j] === 1) continue
        const d = Math.hypot(x - sim.posX[j], y - sim.posY[j])
        if (d < r) s += (1 - d / r) ** 2
      }
      return s
    }
    let somme = 0
    let pire = 0
    let n = 0
    for (let a = 0; a < 360; a += 10) {
      const ux = Math.cos((a * Math.PI) / 180)
      const uy = Math.sin((a * Math.PI) / 180)
      let bord = 0
      for (let t = 0; t < 400; t += 2) {
        if (sim.liquidAt(ux * t, uy * t, r)) bord = t
        else if (bord > 0) break
      }
      if (bord <= 0) continue
      const x = ux * (bord + 1)
      const y = uy * (bord + 1)
      const e = 1.5
      const gx = champ(x + e, y) - champ(x - e, y)
      const gy = champ(x, y + e) - champ(x, y - e)
      const l = Math.hypot(gx, gy) || 1
      const vraie = { nx: -gx / l, ny: -gy / l } // sortante : le champ décroît vers l'extérieur
      const rendue = sim.liquidNormalAt(x, y, r)
      const ecart =
        (Math.acos(Math.max(-1, Math.min(1, vraie.nx * rendue.nx + vraie.ny * rendue.ny))) * 180) / Math.PI
      somme += ecart
      pire = Math.max(pire, ecart)
      n++
    }
    expect(n).toBeGreaterThan(20)
    expect(somme / n).toBeLessThan(2.5)
    expect(pire).toBeLessThan(8)
  })
})
