import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { FILTRES_ATLAS, RIDEAU, RIDEAU_PAS, dispositionRideau } from './formes'

// LE RIDEAU LAMELLAIRE : un montant à chaque bout, un nombre ENTIER de
// lanières entre eux. Le shader ne tourne pas sous vitest : on vérifie la
// disposition (son jumeau GLSL la recopie) et, dans la source, les contrats
// qu'aucun test d'exécution n'atteint.
const renderer = readFileSync(new URL('../render/renderer.ts', import.meta.url), 'utf8')

describe('rideau lamellaire — la disposition', () => {
  it.each([
    [600, 50],
    [300, 40],
    [131, 60],
    [2000, 80],
  ])('L %i, T %i : montants + lanières entières remplissent le bloc', (L, T) => {
    const d = dispositionRideau(L, T)
    expect(Number.isInteger(d.n)).toBe(true)
    expect(d.n).toBeGreaterThanOrEqual(1)
    expect(2 * d.montant + d.n * d.pas).toBeCloseTo(L, 6)
    // le pas mesuré n'est qu'à peine étiré ou serré : une demi-lanière au
    // plus, répartie sur toutes
    if (d.n > 1) expect(Math.abs(d.pas / (RIDEAU_PAS * T) - 1)).toBeLessThan(0.5 / d.n + 1e-9)
  })

  it('un rideau très court garde une lanière : ses montants s’amincissent', () => {
    const d = dispositionRideau(40, 60)
    expect(d.n).toBe(1)
    expect(d.montant).toBeCloseTo(0.3 * 40, 6)
    expect(d.pas).toBeGreaterThan(0)
  })

  it('le tronçon et le montant tiennent dans l’épaisseur, rails raccordés', () => {
    expect(RIDEAU.haut).toBeGreaterThan(0)
    expect(RIDEAU.bas).toBeLessThanOrEqual(1)
    // 8 lanières de 110 px dans un tronçon de 880
    expect(FILTRES_ATLAS.corps[2] / RIDEAU.lanieres).toBe(110)
    expect(RIDEAU.pince).toBeLessThan(RIDEAU.finLaniere)
  })
})

describe('rideau lamellaire — les jumeaux', () => {
  it('le shader interpole RIDEAU et FILTRES_ATLAS, sans copie à la main', () => {
    expect(renderer).toMatch(/const float RD_MONTANT = \$\{f\(R\.montant\)\};/)
    expect(renderer).toMatch(/const float RD_PAS = \$\{f\(RIDEAU_PAS\)\};/)
    expect(renderer).toMatch(/const vec4 FI_CORPS = \$\{v4\(A\.corps\)\};/)
    expect(renderer).toMatch(/const vec4 FI_MONTANT = \$\{v4\(A\.montant\)\};/)
    // la composition seule : le cuiseur de lumière lit le rideau en bloc
    expect((renderer.match(/\$\{RIDEAU_GLSL\}/g) ?? []).length).toBe(1)
  })

  it('les cadres de l’atlas sont ceux du script qui le fabrique', () => {
    const py = readFileSync(new URL('../../tools/images/filtres_atlas.py', import.meta.url), 'utf8')
    const cadre = (nom: string) =>
      py.match(new RegExp(`CADRE_${nom} = \\((\\d+), (\\d+), (\\d+), (\\d+)\\)`))!.slice(1).map(Number)
    expect(cadre('GRILLE')).toEqual(FILTRES_ATLAS.grille)
    expect(cadre('R_CORPS')).toEqual(FILTRES_ATLAS.corps)
    expect(cadre('R_MONTANT')).toEqual(FILTRES_ATLAS.montant)
    expect(Number(py.match(/^MARGE_GRILLE = (\d+)/m)![1])).toBe(FILTRES_ATLAS.margeGrille)
    expect(Number(py.match(/^TAILLE = (\d+)/m)![1])).toBe(FILTRES_ATLAS.taille)
    expect(Number(py.match(/^HAUTEUR = (\d+)/m)![1])).toBe(FILTRES_ATLAS.hauteur)
  })
})

describe('rideau lamellaire — dans la composition', () => {
  const debut = renderer.indexOf('// RIDEAU LAMELLAIRE : une porte de chambre froide')
  const branche = renderer.slice(debut, renderer.indexOf('} else if (mat > 6.5)', debut))

  it('sans atlas, il ne lit pas l’atlas : sinon, des rectangles NOIRS', () => {
    // l'unité liée à null se lit (0, 0, 0, 1) : rideauRendu doit être gardé
    expect(debut).toBeGreaterThan(0)
    const appel = branche.indexOf('rideauRendu(')
    expect(appel).toBeGreaterThan(0)
    expect(branche.lastIndexOf('uHasGrille > 0.5', appel)).toBeGreaterThan(0)
  })

  it('un rideau À FORME garde les lamelles tracées : l’image est un rectangle', () => {
    expect(branche).toMatch(/uHasGrille > 0\.5 && dec\.y < 0\.5/)
  })

  it('le champ du fluide se lit à niveau de détail fixé : branche non uniforme', () => {
    const f = renderer.slice(renderer.indexOf('vec2 rdFluide('), renderer.indexOf('vec2 rdMonde('))
    expect(f).toMatch(/textureLod\(uField/)
    expect(f).not.toMatch(/texture\(uField/)
  })

  it('la grille de l’évent vient de l’atlas, répétée à la main', () => {
    expect(renderer).toMatch(/vec3 texGrilleC = grilleEvent\(world\);/)
    expect(renderer).not.toMatch(/texture\(uTexGrille, world/)
    expect(renderer).toMatch(/'\/assets\/filtres-atlas\.webp'/)
    expect(renderer).not.toMatch(/grille\.webp/)
  })
})
