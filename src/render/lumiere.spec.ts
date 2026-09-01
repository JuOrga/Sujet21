import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { LAMPE_HAUTEUR_MAX } from '../game/level'
import { HAUTEUR_BLOCS, HAUTEUR_COQUE } from './renderer'

// La hauteur des blocs est écrite DEUX FOIS dans renderer.ts : une fois dans
// le shader principal (qui éclaire le DESSUS des solides) et une fois dans le
// cuiseur de carte de lumière (qui borne la longueur des ombres portées). Les
// deux doivent dire la même chose, sinon les ombres se couchent pour une
// hauteur et les sommets s'éclairent pour une autre — l'incohérence serait
// invisible en test unitaire et coûteuse à débusquer à l'œil.
const source = readFileSync(
  fileURLToPath(new URL('./renderer.ts', import.meta.url)),
  'utf8',
)

describe('Éclairage des volumes — la hauteur des blocs', () => {
  it('vaut la même chose dans le shader principal et dans le cuiseur', () => {
    const valeurs = [...source.matchAll(/#define\s+HAUTEUR_BLOCS\s+([0-9.]+)/g)].map(
      (m) => m[1],
    )
    expect(valeurs).toHaveLength(2)
    expect(valeurs[0]).toBe(valeurs[1])
  })

  it('laisse un plancher de lisibilité aux solides : jamais tout à fait noirs', () => {
    const m = source.match(/#define\s+PLANCHER_SOLIDE\s+([0-9.]+)/)
    expect(m).not.toBeNull()
    const plancher = Number(m![1])
    expect(plancher).toBeGreaterThan(0.1) // un obstacle reste visible
    expect(plancher).toBeLessThan(1) // mais la lumière a bien un effet
  })
})

// LES COQUES MONTENT AU PLAFOND. Une chambre et un couloir sont des
// cloisons, pas du mobilier : la lampe d'une salle ne doit pas éclairer la
// salle voisine par-dessus le mur. Tant que tout mesurait HAUTEUR_BLOCS,
// c'est exactement ce qui se passait — l'ombre du mur mitoyen s'arrêtait à
// 196 u derrière lui (deux chambres de 1200 u, mur de 40, lampe à 600) et le
// reste de la pièce d'à côté baignait en plein jour.
describe('Éclairage des volumes — la hauteur des coques', () => {
  const hauteurCoque = () => {
    const m = source.match(/#define\s+HAUTEUR_COQUE\s+([0-9.]+)/)
    expect(m).not.toBeNull()
    return Number(m![1])
  }

  it('dépasse la lampe la plus haute : aucune ne regarde par-dessus un mur', () => {
    expect(hauteurCoque()).toBeGreaterThanOrEqual(LAMPE_HAUTEUR_MAX)
  })

  it('dépasse la hauteur des blocs — sinon la coque ne serait qu’un meuble', () => {
    const blocs = Number(source.match(/#define\s+HAUTEUR_BLOCS\s+([0-9.]+)/)![1])
    expect(hauteurCoque()).toBeGreaterThan(blocs)
  })

  it('sert de borne à la marche du cuiseur, et la coque (forme 5) y échappe au rejet', () => {
    // la marche va jusqu'à tLim, calculé sur le plus haut obstacle POSÉ —
    // pas sur HAUTEUR_COQUE en dur : un tableau sans coque doit s'arrêter
    // à la hauteur des blocs, comme avant, et ne rien payer de plus
    expect(source).toMatch(
      /float\s+tLim\s*=\s*min\(distL,\s*distL\s*\*\s*uHautMax\s*\/\s*max\(hL,\s*uHautMax\s*\+\s*1\.0\)\);/,
    )
    expect(source).toMatch(/hautMax\s*=\s*HAUTEUR_COQUE/)
    expect(source).toContain("gl.uniform1f(lu['uHautMax'], hautMax)")
    // et chaque boîte est écartée à SA hauteur, pas à celle de la scène
    expect(source).toMatch(
      /if\s*\(alt\s*>\s*\(dec\.y\s*>\s*4\.5\s*\?\s*HAUTEUR_COQUE\s*:\s*HAUTEUR_BLOCS\)\)\s*continue;/,
    )
    // l'altitude passée au SDF : t·hLampe/distL, la montée réelle du rayon
    expect(source).toMatch(/sceneSdf\(p\s*\+\s*dir\s*\*\s*t,\s*t\s*\*\s*hL\s*\/\s*distL\)/)
  })

  it('a la même valeur des deux côtés — TypeScript et shader', () => {
    expect(HAUTEUR_COQUE).toBe(hauteurCoque())
    expect(HAUTEUR_BLOCS).toBe(
      Number(source.match(/#define\s+HAUTEUR_BLOCS\s+([0-9.]+)/)![1]),
    )
  })

  it('ne déborde PAS sur les tamis : évent, éponge et vitre restent du mobilier', () => {
    // un évent tamisé sur tout le trajet coucherait ses barreaux dans toute
    // la salle — les trois tamis se bornent à la hauteur des BLOCS
    for (const tamis of ['grilleTrans', 'epongeTrans', 'vitreTrans'])
      expect(source).toContain(`${tamis}(p, dir, min(distL, tBloc))`)
    expect(source).toMatch(
      /float\s+tBloc\s*=\s*min\(distL,\s*distL\s*\*\s*HAUTEUR_BLOCS\s*\/\s*max\(hL,\s*HAUTEUR_BLOCS\s*\+\s*1\.0\)\);/,
    )
  })
})

// LA CLÉ DE CUISSON décide de tout : la carte ne recuit QUE si elle change.
// Ce qui n'y entre pas ne se voit jamais bouger à l'écran.
describe('Éclairage des volumes — la clé de cuisson', () => {
  it('porte la forme du luminaire, sa longueur et son angle', () => {
    // pointLampe éclaire depuis le point du SEGMENT le plus proche : sans
    // ces trois-là, basculer une lampe en bandeau sans la déplacer laissait
    // la carte d'avant à l'écran
    expect(source).toContain('${l.bandeau ? 1 : 0},${l.demiLong},${l.angleRad}')
  })

  it('porte la hauteur du plus haut obstacle posé', () => {
    expect(source).toContain('H${hautMax}')
  })
})
