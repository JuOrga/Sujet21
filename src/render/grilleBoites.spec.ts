import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  GRILLE_CASES,
  GRILLE_K,
  PORTEE_FIXE,
  PORTEE_PAR_ZOOM,
  caseDe,
  construitGrille,
  englobant,
  litCase,
  margeInfluence,
  type BoiteGrille,
} from './grilleBoites'
import { TABLEAUX, MAT_EXIT, MAT_VIDE, MAT_BAIE, MAT_WALL, MAT_MIROIR } from '../game/level'

// LA GRILLE DE REPÉRAGE (grilleBoites.ts) — ce qui la rend EXACTE.
//
// Le rapport du 14/09/2026 (iPad Pro M1, salle démineur) : 56 ms par image
// hors processeur, parce que chaque pixel parcourait les 112 boîtes du
// tableau. La grille ne laisse à chaque pixel que les boîtes de sa case.
// Elle n'a le droit de se tromper dans AUCUN sens : une boîte qui manque
// dans une case coupe une ombre net à la frontière. Ces tests le gardent
// par la force brute — des boîtes et des points au hasard, et pour chaque
// point, chaque boîte à portée doit être dans la liste de sa case.

const sortie = new Int32Array(GRILLE_CASES * 4)

function alea(graine: number): () => number {
  let x = graine >>> 0 || 1
  return () => {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    return ((x >>> 0) % 100000) / 100000
  }
}

/** La distance d'un point au rectangle englobant (0 dedans). */
function distRect(e: [number, number, number, number], x: number, y: number): number {
  const dx = Math.max(e[0] - x, 0, x - e[2])
  const dy = Math.max(e[1] - y, 0, y - e[3])
  return Math.hypot(dx, dy)
}

function boitesAuHasard(r: () => number, n: number, etendue: number): BoiteGrille[] {
  const out: BoiteGrille[] = []
  for (let i = 0; i < n; i++) {
    const x = r() * etendue
    const y = r() * etendue
    const w = 20 + r() * 300
    const h = 20 + r() * 300
    out.push({
      minX: x,
      minY: y,
      maxX: x + w,
      maxY: y + h,
      angle: r() < 0.3 ? r() * 360 - 180 : 0,
      partout: r() < 0.04,
    })
  }
  return out
}

describe('La grille de repérage des boîtes', () => {
  it('toute boîte à portée d’un point est dans la liste de sa case (force brute)', () => {
    for (let graine = 1; graine <= 12; graine++) {
      const r = alea(graine * 7919)
      const boites = boitesAuHasard(r, 40 + Math.floor(r() * 100), 2000 + r() * 2000)
      const marge = 40 + r() * 120
      const g = construitGrille(boites, boites.length, marge, sortie)
      const rects = boites.map(englobant)
      for (let k = 0; k < 1500; k++) {
        // des points partout, y compris hors de l'emprise
        const x = -500 + r() * 5000
        const y = -500 + r() * 5000
        const liste = litCase(sortie, caseDe(g, x, y))
        if (liste === null) continue // la case a débordé : « toutes »
        for (let i = 0; i < boites.length; i++) {
          const aPortee = boites[i].partout || distRect(rects[i], x, y) <= marge
          if (aPortee) {
            expect(liste, `graine ${graine}, point (${x | 0}, ${y | 0}), boîte ${i}`).toContain(i)
          }
        }
      }
    }
  })

  it('les listes gardent l’ordre du tableau, et tiennent dans GRILLE_K', () => {
    const r = alea(42)
    const boites = boitesAuHasard(r, 90, 3000)
    const g = construitGrille(boites, boites.length, 60, sortie)
    for (let cel = 0; cel < g.nx * g.ny; cel++) {
      const l = litCase(sortie, cel)
      if (l === null) continue
      expect(l.length).toBeLessThanOrEqual(GRILLE_K)
      for (let k = 1; k < l.length; k++) expect(l[k]).toBeGreaterThan(l[k - 1])
    }
  })

  it('une case qui déborde dit « toutes » au lieu d’oublier une boîte', () => {
    // vingt boîtes empilées au même endroit : plus que GRILLE_K
    const boites: BoiteGrille[] = []
    for (let i = 0; i < 20; i++) boites.push({ minX: 100 + i, minY: 100, maxX: 200 + i, maxY: 200 })
    const g = construitGrille(boites, boites.length, 60, sortie)
    expect(g.debordements).toBeGreaterThan(0)
    expect(litCase(sortie, caseDe(g, 150, 150))).toBeNull()
  })

  it('les boîtes « partout » (sas, vide, baie) sont dans chaque case', () => {
    const r = alea(7)
    const boites = boitesAuHasard(r, 60, 3000).map((b) => ({ ...b, partout: false }))
    boites[5].partout = true
    boites[41].partout = true
    const g = construitGrille(boites, boites.length, 60, sortie)
    for (let cel = 0; cel < g.nx * g.ny; cel++) {
      const l = litCase(sortie, cel)
      if (l === null) continue
      expect(l).toContain(5)
      expect(l).toContain(41)
    }
  })

  it('sans boîte, une seule case qui dit « toutes »', () => {
    const g = construitGrille([], 0, 60, sortie)
    expect(g.nx * g.ny).toBe(1)
    expect(litCase(sortie, 0)).toBeNull()
  })

  it('le rectangle englobant d’une boîte pivotée contient ses quatre coins', () => {
    const b: BoiteGrille = { minX: 100, minY: 100, maxX: 300, maxY: 150, angle: 30 }
    const e = englobant(b)
    const cx = 200
    const cy = 125
    const r = (30 * Math.PI) / 180
    for (const [px, py] of [
      [100, 100],
      [300, 100],
      [300, 150],
      [100, 150],
    ]) {
      const x = cx + (px - cx) * Math.cos(r) - (py - cy) * Math.sin(r)
      const y = cy + (px - cx) * Math.sin(r) + (py - cy) * Math.cos(r)
      expect(x).toBeGreaterThanOrEqual(e[0] - 1e-9)
      expect(x).toBeLessThanOrEqual(e[2] + 1e-9)
      expect(y).toBeGreaterThanOrEqual(e[1] - 1e-9)
      expect(y).toBeLessThanOrEqual(e[3] + 1e-9)
    }
  })

  // LE GAIN, sur ce qui a fait mal : un damier de 112 boîtes sur 2 800 u,
  // comme la salle démineur. Chaque case doit voir une poignée de boîtes,
  // pas le tableau entier — et aucune ne doit déborder.
  it('sur un damier de 112 boîtes, aucune case ne déborde et chacune en voit une poignée', () => {
    const boites: BoiteGrille[] = []
    for (let i = 0; i < 112; i++) {
      const x = 100 + (i % 14) * 200
      const y = 100 + Math.floor(i / 14) * 240
      boites.push({ minX: x, minY: y, maxX: x + 60, maxY: y + 60 })
    }
    const g = construitGrille(boites, boites.length, 70, sortie)
    expect(g.debordements).toBe(0)
    let total = 0
    for (let cel = 0; cel < g.nx * g.ny; cel++) total += litCase(sortie, cel)!.length
    const moyenne = total / (g.nx * g.ny)
    expect(moyenne).toBeLessThan(10)
    expect(g.maxEntrees).toBeLessThanOrEqual(GRILLE_K)
  })

  it('aucun tableau du dépôt ne fait déborder une case (marge large de 130 u)', () => {
    for (const lv of TABLEAUX) {
      const boites: BoiteGrille[] = lv.boxes.map((b) => ({
        minX: b.minX,
        minY: b.minY,
        maxX: b.maxX,
        maxY: b.maxY,
        angle: b.angle,
        partout: b.material === MAT_EXIT || b.material === MAT_VIDE || b.material === MAT_BAIE,
      }))
      const g = construitGrille(boites, boites.length, 130, sortie)
      expect(g.debordements, `${lv.code} — ${lv.name}`).toBe(0)
    }
  })

  it('la marge d’influence couvre le court-circuit du shader et ses fondus au zoom', () => {
    // les valeurs du banc : hydro 90, froid 140, chaud 170 × aura 1
    const m = margeInfluence({
      hydroBand: 90,
      coldBand: 140,
      heatBand: 170,
      auraMax: 1,
      zoom: 0.5,
      relief: 0,
      viewportW: 1000,
      viewportH: 600,
    })
    expect(m).toBeCloseTo(170 + PORTEE_PAR_ZOOM / 0.5, 6)
    // le relief déplace le sommet jusqu'à la demi-diagonale × relief
    const mr = margeInfluence({
      hydroBand: 0,
      coldBand: 0,
      heatBand: 0,
      auraMax: 1,
      zoom: 1,
      relief: 0.035,
      viewportW: 800,
      viewportH: 600,
    })
    expect(mr).toBeCloseTo(PORTEE_FIXE + PORTEE_PAR_ZOOM + 0.035 * 500, 6)
    // une aura de chaudière plus grande que le banc compte
    const ma = margeInfluence({
      hydroBand: 0,
      coldBand: 0,
      heatBand: 170,
      auraMax: 2.5,
      zoom: 1,
      relief: 0,
      viewportW: 800,
      viewportH: 600,
    })
    expect(ma).toBeCloseTo(425 + PORTEE_PAR_ZOOM, 6)
  })

  // LE CONTRAT AVEC LE SHADER : toute portée FIXE écrite dans le corps des
  // boucles sur les boîtes (l'ombre 56, le rideau 60, la bande de coque
  // 34…) doit rester sous PORTEE_FIXE, et tout « N / uZoom » sous
  // PORTEE_PAR_ZOOM. Sinon, la grille laisserait une boîte hors d'une case
  // qu'elle teinte encore : une ombre coupée net sur une frontière.
  it('aucune portée fixe du shader ne dépasse ce que la grille prévoit', () => {
    const src = readFileSync(fileURLToPath(new URL('./renderer.ts', import.meta.url)), 'utf8')
    const debut = src.indexOf('const COMPOSE_FS')
    const fin = src.indexOf('const LIGHT_FS')
    const compose = src.slice(debut, fin)
    const lignes = compose.split('\n').map((l) => l.replace(/\/\/.*$/, ''))
    // les termes du court-circuit de distance, tels qu'écrits
    expect(compose).toMatch(/float reachMax = 56\.0;/)
    for (const m of compose.matchAll(/max\(reachMax, (\d+(?:\.\d+)?)\)/g)) {
      expect(Number(m[1])).toBeLessThanOrEqual(PORTEE_FIXE)
    }
    // l'ombre portée
    const ombre = compose.match(/smoothstep\(0\.0, (\d+(?:\.\d+)?), max\(d, 0\.0\)\)/)
    expect(ombre).not.toBeNull()
    expect(Number(ombre![1])).toBeLessThanOrEqual(PORTEE_FIXE)
    // la bande de coque, dessinée hors de la salle
    const coque = compose.match(/smoothstep\((\d+(?:\.\d+)?), (\d+(?:\.\d+)?), roomD\)/)
    expect(coque).not.toBeNull()
    expect(Number(coque![2])).toBeLessThanOrEqual(PORTEE_FIXE)
    // tout ce qui s'écrit « N / uZoom »
    for (const l of lignes) {
      for (const m of l.matchAll(/(\d+(?:\.\d+)?) \/ uZoom/g)) {
        expect(Number(m[1]), l.trim()).toBeLessThanOrEqual(PORTEE_PAR_ZOOM)
      }
    }
  })

  it('les matériaux « partout » sont bien le sas et les ouvertures, pas les solides', () => {
    expect(MAT_EXIT).toBe(3)
    expect(MAT_VIDE).toBe(11)
    expect(MAT_BAIE).toBe(12)
    expect(MAT_WALL).toBe(0)
    expect(MAT_MIROIR).toBe(10)
  })
})
