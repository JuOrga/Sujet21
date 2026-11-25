import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { absorbe } from './game/laser'
import { MAT_EXIT, MAT_GRILLE, MAT_HYDROPHILE, MAT_WALL, type ObstacleBox } from './game/level'
import { HAUTEUR_BLOCS } from './render/hauteurs'
import { dansPolygone, volumeProjete, type Projette } from './render/porteBlindee'
import { fractionSommet, pointDuSommet } from './render/reliefParois'

// LES FAISCEAUX PASSENT SOUS LE DESSUS DES MURS.
//
// Relief allumé, le rayon laser se peignait dans la toile 2D PAR-DESSUS le
// rendu WebGL : là où le sommet d'un mur, fuyant le centre de l'écran,
// recouvre le sol au-delà de son pied, le rayon restait visible et semblait
// traverser la paroi (le concepteur, 25/11). Le remède est celui des portes :
// le volume projeté des solides voisins est effacé du calque du faisceau.
//
// main.ts ne s'importe pas en test : on lit sa source, comme
// main-cadran.spec.ts.

const SRC = readFileSync(new URL('./main.ts', import.meta.url), 'utf-8')

const corps = (nom: string): string =>
  SRC.match(new RegExp(`function ${nom}\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? ''

const boite = (material: number): ObstacleBox =>
  ({ minX: 0, minY: 0, maxX: 10, maxY: 10, material }) as ObstacleBox

describe('les faisceaux et le relief des parois', () => {
  it('le dessus déplacé d’un mur haut couvre le sol où passe le rayon du capture', () => {
    // la scène du signalement, réduite : une cloison haute dont le bord
    // supérieur est à y = 100, la caméra plus bas (y = 0), le rayon qui la
    // longe juste au-delà, à y = 104. Monde = écran (zoom 1, y vers le haut :
    // l'homothétie autour du centre est la même).
    const f = fractionSommet(0.07, 1, HAUTEUR_BLOCS) // relief FORT, mur haut
    expect(f).toBeGreaterThan(0)
    const projette: Projette = (x, y, h) => {
      if (!(h > 0)) return { sx: x, sy: y }
      const [sx, sy] = pointDuSommet(x, y, 0, 0, fractionSommet(0.07, 1, h))
      return { sx, sy }
    }
    const mur = [
      { x: -200, y: 60 },
      { x: 200, y: 60 },
      { x: 200, y: 100 },
      { x: -200, y: 100 },
    ]
    const volume = volumeProjete(mur, HAUTEUR_BLOCS, projette)
    const cache = (x: number, y: number): boolean => volume.some((p) => dansPolygone(p.map((q) => ({ x: q.sx, y: q.sy })), x, y))
    // le rayon au-delà du pied, côté opposé à l'œil : sous le dessus
    expect(cache(0, 104)).toBe(true)
    // assez loin, le dessus ne l'atteint plus
    expect(cache(0, 200)).toBe(false)
    // du côté de l'œil, le sol devant le pied reste visible
    expect(cache(0, 50)).toBe(false)
  })

  it('seul ce qui arrête la lumière cache le rayon : il passe la grille et le sas', () => {
    expect(absorbe(boite(MAT_WALL))).toBe(true)
    expect(absorbe(boite(MAT_HYDROPHILE))).toBe(true)
    expect(absorbe(boite(MAT_GRILLE))).toBe(false)
    expect(absorbe(boite(MAT_EXIT))).toBe(false)
  })

  it('drawMecanismes peint les faisceaux sur un calque dont les murs sont effacés', () => {
    const d = corps('drawMecanismes')
    const ouvre = d.indexOf('ouvreCalque(fxG, rect)')
    const rayons = d.indexOf('for (const t of laserEtat.vues) {\n    if (t.points.length < 2) continue')
    const sursaut = d.indexOf('LE SURSAUT DE VICTOIRE')
    const ferme = d.indexOf('fermeCalque(g, c, rect, (m) => effaceVolumes(m, occ, projetteRelief))')
    expect(ouvre).toBeGreaterThan(0)
    expect(rayons).toBeGreaterThan(ouvre)
    expect(sursaut).toBeGreaterThan(rayons)
    expect(ferme).toBeGreaterThan(sursaut)
    // les occultants : ceux qui absorbent la lumière, pas la grille
    expect(d).toContain('occultantsPres(rMonde, absorbeLumiere)')
    // relief éteint, rien ne change
    expect(d).toMatch(/if \(fMurHaut > 0\) \{\s*let minX = Infinity/)
  })
})
