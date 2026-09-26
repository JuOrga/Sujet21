import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// CE QUE LE SHADER DE LA CONDUITE DOIT GARDER — des défauts de la revue de
// la livraison #461, qu'aucun test d'exécution n'atteint (le shader ne
// tourne pas sous vitest) : on lit la SOURCE, comme budgets.spec.ts.
const source = readFileSync(fileURLToPath(new URL('./renderer.ts', import.meta.url)), 'utf8')

// la branche plaque froide de la composition, jusqu'à la branche suivante
const debut = source.indexOf('// Plaque froide (tableau 2) : une CONDUITE')
const branche = source.slice(debut, source.indexOf('} else {', source.indexOf('brumeNH3(wb', debut)))

describe('la conduite dans la composition', () => {
  it('sans atlas, elle ne lit pas l’atlas : sinon, des rectangles NOIRS', () => {
    // l'unité liée à null se lit (0, 0, 0, 1) : conduiteNH3 doit être gardé
    expect(debut).toBeGreaterThan(0)
    const appel = branche.indexOf('conduiteNH3(')
    const garde = branche.lastIndexOf('uHasFroid > 0.5', appel)
    expect(appel).toBeGreaterThan(0)
    expect(garde).toBeGreaterThan(0)
  })

  it('le givre de secours suit la SILHOUETTE du tuyau, pas la boîte', () => {
    const secours = branche.slice(branche.indexOf('} else {', branche.indexOf('conduiteNH3(')))
    expect(secours).toMatch(/conduiteSdf\(wbV/)
  })

  it('une plaque à forme gèle depuis SA forme, et garde ombre et tranche', () => {
    expect(branche).toMatch(/bool tuyau = dec\.y < 0\.5;/)
    expect(branche).toMatch(/float dG = tuyau \? conduiteSdf\([^)]*\) : dV;/)
    // l'ombre portée et la tranche n'exemptent que la conduite (et la
    // chaudière) SANS forme : aPieces, gardé par dec.y < 0.5, sert aux deux
    expect(source).toMatch(
      /bool aPieces = \(\(mat > 3\.5 && mat < 4\.5\) \|\| \(mat > 5\.5 && mat < 6\.5\)\) && dec\.y < 0\.5;/,
    )
    expect((source.match(/!aPieces\)/g) ?? []).length).toBeGreaterThanOrEqual(2)
  })
})

// la branche chaudière de la composition, jusqu'à la branche suivante
const debutCh = source.indexOf('// Chaudière : une RAMPE DE RÉSISTANCES')
const brancheCh = source.slice(debutCh, source.indexOf('} else if (mat > 4.5)', debutCh))

describe('la chaudière dans la composition', () => {
  it('sans atlas, elle ne lit pas l’atlas : sinon, des rectangles NOIRS', () => {
    expect(debutCh).toBeGreaterThan(0)
    const appel = brancheCh.indexOf('chaudiereRendu(')
    expect(appel).toBeGreaterThan(0)
    expect(brancheCh.lastIndexOf('uHasChaud > 0.5', appel)).toBeGreaterThan(0)
    // le sol chauffé lit l'atlas lui aussi : gardé de même
    const sol = brancheCh.indexOf('solChauffe(')
    expect(brancheCh.lastIndexOf('uHasChaud > 0.5', sol)).toBeGreaterThan(0)
  })

  it('les rayures de secours suivent la SILHOUETTE des pièces, pas la boîte', () => {
    const secours = brancheCh.slice(brancheCh.indexOf('} else {', brancheCh.indexOf('chaudiereRendu(')))
    expect(secours).toMatch(/chaudiereSdf\(wbV/)
  })

  it('une chaudière à forme chauffe depuis SA forme', () => {
    expect(brancheCh).toMatch(/bool rampe = dec\.y < 0\.5;/)
    expect(brancheCh).toMatch(/float dG = rampe \? chaudiereSdf\([^)]*\) : dV;/)
  })
})

describe('le relief de la conduite suit son dessin, pas sa boîte', () => {
  it('le biseau générique des solides exempte la conduite (il peignait le rectangle du bloc)', () => {
    const i = source.indexOf("// Relief d'éclairage : un biseau directionnel")
    expect(i).toBeGreaterThan(0)
    const garde = source.slice(i, source.indexOf('gradSdfBoite(', i))
    expect(garde).toMatch(/!\(mat > 3\.5 && mat < 4\.5 && dec\.y < 0\.5\)/)
  })

  it('les plaques ont leur arête et le tuyau son pied, dans la branche de la conduite', () => {
    expect(branche).toMatch(/conduitePlaquesSdf\(wbV/)
    expect(branche).toMatch(/conduitePiedSdf\(wb,/)
  })
})
