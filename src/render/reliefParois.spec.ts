import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { HAUTEUR_BLOCS } from './hauteurs'
import { HAUTEUR_DE_RANG } from './volume'
import {
  facteurRelief,
  solCache,
} from './reliefParois'

// LE RELIEF 2.5D RÉPARÉ (volume des parois, volet 1). Les règles pures sont
// testées ici ; le shader ne tourne pas sous vitest : on lit sa SOURCE, comme
// epaisseur.spec.ts et hauteursBoites.spec.ts.
const lire = (chemin: string): string =>
  readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8')
const source = lire('./renderer.ts')
const main = lire('../main.ts')

// un morceau de la source, de `debut` à `fin` — vide s'il manque : chaque
// test échoue alors sur ce qu'il attend, pas le fichier entier au chargement
const entre = (debut: string, fin: string, depuis = 0): string => {
  const a = source.indexOf(debut, depuis)
  if (a < 0) return ''
  const b = source.indexOf(fin, a + debut.length)
  return b < 0 ? '' : source.slice(a, b)
}
const composeFs = entre('const COMPOSE_FS = `', '\n}`')
const debutCompo = source.indexOf('const COMPOSE_FS = `')
const couverture = entre('// ——— LA COUVERTURE', '// LA LUMIÈRE SUR LE DESSUS', debutCompo)
const lumiereToit = entre('// LA LUMIÈRE SUR LE DESSUS', '// ——— RELIEF 2.5D', debutCompo)
const boucle = entre('// ——— RELIEF 2.5D', "// L'OMBRE COURTE SUR LES TOITS", debutCompo)
const epaisseur = entre("// ——— L'ÉPAISSEUR", '// ——— LE FLANC', debutCompo)

describe('les règles pures du relief', () => {
  it('le sommet s’écarte selon la hauteur : un mur haut garde son flanc, une plaque basse en a un court', () => {
    expect(facteurRelief(HAUTEUR_DE_RANG.haut)).toBe(1)
    expect(facteurRelief(HAUTEUR_DE_RANG.moyen)).toBeCloseTo(90 / 140, 6)
    expect(facteurRelief(HAUTEUR_DE_RANG.bas)).toBeCloseTo(40 / 140, 6)
    // bornée au mur haut, comme la coque pour l'image
    expect(facteurRelief(2400)).toBe(1)
    expect(facteurRelief(0)).toBe(0)
    expect(facteurRelief(-5)).toBe(0)
    expect(HAUTEUR_DE_RANG.haut).toBe(HAUTEUR_BLOCS)
  })

  it('relief éteint, aucun sol n’est caché : le rendu d’avant reste', () => {
    for (const d of [-40, -3, 0, 0.5, 4, 60]) expect(solCache(d, d, 0, 2.5)).toBe(0)
  })

  it('le sol que le sommet recouvre au-delà du pied est caché ; le pied vu reste visible', () => {
    // au-delà du pied (d > 0), sous le sommet (dV ≤ 0) : caché — le fluide
    // qui touche le pied de ce côté passe dessous
    expect(solCache(3, -25, 0, 2.5)).toBe(1)
    expect(solCache(20, -6, 0, 2.5)).toBe(1)
    // la lisière du fluide sous le pied, de ce même côté : cachée aussi
    expect(solCache(-3, -35, 0, 2.5)).toBe(1)
    // le sol libre : visible
    expect(solCache(10, 15, 0, 2.5)).toBe(0)
    // côté où le pied se voit : la tranche sur la base — le fluide y touche
    // le bas du flanc, rien n'est caché
    expect(solCache(-4, 12, 1, 2.5)).toBe(0)
    expect(solCache(-1, 30, 1, 2.5)).toBe(0)
    // une face latérale vue de biais, hors de la base : elle cache le sol
    expect(solCache(6, 9, 1, 2.5)).toBe(1)
  })
})

describe('le shader : la longueur du flanc suit la hauteur', () => {
  it('la règle GLSL est dans la composition', () => {
    expect(composeFs).toContain('${RELIEF_PAROIS_GLSL}')
  })

  it('le sommet de chaque boîte s’écarte de SA part du déplacement', () => {
    expect(boucle).toMatch(/relB = relDisp \* facteurRelief\(hauteurBoite\(bi\)\)/)
    expect(boucle).toContain('vec2 wT = world - relB;')
    expect(boucle).toMatch(/world - relB \* \(float\(fs\) \/ 4\.0\)/)
    // plus rien ne prend le déplacement entier
    expect(boucle).not.toContain('world - relDisp;')
    expect(boucle).not.toMatch(/world - relDisp \* \(float/)
    // la couverture (qui recouvre qui) voit les mêmes sommets
    expect(couverture).toMatch(/if \(uRelief > 0\.0\) pV -= relDisp \* facteurRelief\(hauteurBoite\(bi\)\);\s*float dc = sdfVisible\(bi, pV\);/)
  })

  it('la lumière du toit (et l’ombre des voisins plus hauts) se lit sous le sommet, pas au sol', () => {
    expect(lumiereToit).toMatch(/pToit = world - relDisp \* facteurRelief\(hauteurBoite\(iCouv\)\)/)
    expect(lumiereToit).toMatch(/toitVis = textureLod\(uLightMap, [^;]*pToit/)
    expect(lumiereToit).toMatch(/pointLampe\(li, pToit\) - pToit/)
  })
})

describe('le shader : le dessus suit son sommet', () => {
  it('les motifs et les textures du dessus se lisent au sommet (wS), pas au sol', () => {
    expect(boucle).toMatch(/textureGrad\(uTexWall, wS \//)
    expect(boucle).toMatch(/textureGrad\(uTexPhile, wS \//)
    expect(boucle).toMatch(/textureGrad\(uTexPhobe, wS \//)
    // le relief des surfaces (R3) se lit au même sommet
    expect(boucle).toMatch(/\(wS \+ vec2\(pW, 0\.0\)\) \/ cW/)
    expect(boucle).not.toMatch(/\(world \+ vec2\(p[WAHB], 0\.0\)\)/)
  })
})

describe('le shader : les flancs absents (hydro, miroir)', () => {
  it('chaque solide mesure le sol que son sommet cache, à la règle solCache', () => {
    expect(boucle).toMatch(/solPropre = solCache\(d, dV, flanc, edgeW\)/)
  })

  it('l’aura des hydro, l’ombre de contact et l’ombre courte ne se peignent plus sur le sommet de leur propre boîte', () => {
    expect(epaisseur).toMatch(/float sol = step\(0\.0, d\) \* libre \* \(1\.0 - solPropre\);/)
    expect(boucle).toMatch(/aura \*= 1\.0 - solPropre;/)
  })

  it('le dessus du miroir suit le sommet : il ne recouvre plus sa propre tranche', () => {
    // il se peignait sur d (la base), le seul solide à le faire
    const miroir = entre('// MIROIR FIXE', '} else if (mat > 8.5) {', debutCompo)
    expect(miroir).toContain('smoothstep(-edgeW, 0.0, dV)')
    expect(miroir).not.toMatch(/smoothstep\(-edgeW, 0\.0, d\)/)
    expect(miroir).not.toMatch(/abs\(d\)\)/)
  })
})

describe('le relief reste éteint par défaut', () => {
  it('sans réglage posé, sujet21-relief vaut off, et off ne déplace rien', () => {
    expect(main).toContain("localStorage.getItem('sujet21-relief') ?? 'off'")
    expect(main).toMatch(/const RELIEF_K = \{ off: 0, /)
  })
})
