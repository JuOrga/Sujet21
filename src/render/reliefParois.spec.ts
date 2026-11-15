import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { HAUTEUR_BLOCS } from './hauteurs'
import { HAUTEUR_DE_RANG, RANG_DE_MATIERE } from './volume'
import { MAT_GRILLE, MAT_MEMBRANE, MAT_RIDEAU } from '../game/level'
import {
  MATIERES_PERMEABLES,
  RELIEF_PAROIS_GLSL,
  facteurRelief,
  fonduRelief,
  fractionSommet,
  pointDuSommet,
  solCache,
} from './reliefParois'
import { blocApres, occurrencesDans } from './blocsSource'

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
const flanc = entre('// ——— LE FLANC', 'if (mat < 2.5) {', debutCompo)
const matiereFlanc = entre('vec3 matiereFlanc(', '\n}\n', debutCompo)
const drawVie = entre('private drawVie(', '\n  }\n')
const drawDecals = entre('private drawDecals(', '\n  }\n')
const decalFs = entre('const DECAL_FS = `', '}`')
const rendu = entre('// Passe B — composition', '// Passe C — cellules')
const decorNet = entre('private drawDecorNet(', '\n  }\n')
const sousDecal = entre('private hauteurSousDecal(', '\n  }\n')
const passeSous = entre('private passeSousSommets(', '\n  }\n')
const ecrit = entre('private ecritProfondeur(', '\n  }\n')

// les matières SOLIDES, d'après la table des hauteurs (volume.ts) : tout ce
// qui a un rang a un corps
const SOLIDES = Object.keys(RANG_DE_MATIERE).map(Number)
// un relief allumé (RELIEF_K.fort, main.ts) pour les règles pures
const R = 0.07

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

  it('le relief se fond au zoom de carte, comme le shader', () => {
    expect(fonduRelief(1)).toBe(1)
    expect(fonduRelief(0.5)).toBeCloseTo(0.6, 6)
    expect(fonduRelief(0)).toBe(0)
    expect(fractionSommet(0.07, 1, HAUTEUR_BLOCS)).toBeCloseTo(0.07, 6)
    expect(fractionSommet(0.07, 0.5, 90)).toBeCloseTo(0.07 * 0.6 * (90 / 140), 6)
    expect(fractionSommet(0, 1, HAUTEUR_BLOCS)).toBe(0)
  })

  it('pointDuSommet est la réciproque de la règle du shader : un décalque tombe sur le sommet', () => {
    // le shader montre, au point w de l'écran, le sommet du point c + (w − c)(1 − f)
    const c: [number, number] = [120, -40]
    for (const f of [0, 0.02, 0.07]) {
      for (const q of [[0, 0], [500, 300], [-800, 120]] as const) {
        const [wx, wy] = pointDuSommet(q[0], q[1], c[0], c[1], f)
        expect(c[0] + (wx - c[0]) * (1 - f)).toBeCloseTo(q[0], 6)
        expect(c[1] + (wy - c[1]) * (1 - f)).toBeCloseTo(q[1], 6)
      }
    }
    // f = 0 : le décalque ne bouge pas
    expect(pointDuSommet(310, 20, 0, 0, 0)).toEqual([310, 20])
  })

  it('relief éteint, la règle vaut 0 partout : le rendu d’avant reste, par construction', () => {
    // relief éteint, le shader appelle la règle avec dV = d (le sommet ne
    // bouge pas) et flanc = 0 — or, sur la base, 1 − smoothstep(−w, 0, d)
    // vaut 1 : sans le facteur de relief, une ligne sortie de sa garde
    // uRelief cachait le fluide dans tout solide (membrane, rideau, évent),
    // par défaut. La règle prend le relief et vaut 0 sans lui, quoi qu'on
    // lui passe d'autre.
    for (let d = -60; d <= 60; d += 0.5) {
      for (const dV of [d, d - 20, d + 20, -35, 12]) {
        for (const flanc of [0, 0.5, 1]) {
          for (const op of [0.4, 1]) {
            expect(solCache(0, d, dV, flanc, 2.5, op), `d ${d} dV ${dV} flanc ${flanc}`).toBe(0)
          }
        }
      }
    }
    // relief allumé, hors du dessus et hors de la tranche, rien n'est caché
    for (const d of [0.5, 4, 60]) expect(solCache(R, d, d, 0, 2.5)).toBe(0)
    // le jumeau GLSL porte la même porte d'entrée
    expect(RELIEF_PAROIS_GLSL).toMatch(/float solCache\(float relief, [^)]*\) \{\s*if \(relief <= 0\.0\) return 0\.0;/)
  })

  it('relief éteint, le shader ne calcule pas la règle : chaque appel est DANS une garde uRelief', () => {
    // appariement d'accolades (blocsSource.ts) : une regex « A[\s\S]*B » ne
    // vérifiait qu'un ordre, et la ligne sortie du bloc la satisfaisait encore
    const garde = blocApres(boucle, 'if (uRelief > 0.0 && solide) {')
    expect(garde).toContain('solPropre = solCache(uRelief, d, dV, flanc, edgeW, opaciteDessus, matPermeable(mat) ? 1.0 : 0.0);')
    expect(garde).toContain('solSousSommets = max(solSousSommets, solPropre);')
    // le masque du fluide ne grandit que sous une garde uRelief — les solides
    // comme les trois branches à pièces (surchauffeur, chaudière, conduite)
    const versements = occurrencesDans(composeFs, 'solSousSommets = max(')
    expect(versements.length).toBe(4)
    for (const v of versements) {
      expect(v.entetes.some((e) => e.includes('uRelief > 0.0')), composeFs.slice(v.position, v.position + 90)).toBe(true)
    }
    // et chaque appel de la règle lui passe le relief
    const appels = occurrencesDans(composeFs, 'solCache(')
    expect(appels.length).toBe(4)
    for (const a of appels) expect(composeFs.startsWith('solCache(uRelief, ', a.position)).toBe(true)
  })

  it('un dessus opaque cache ce qui est dessous, partout où il couvre', () => {
    // sous le dessus, base comprise : le fluide qui traverse un solide
    // perméable (membrane, évent, rideau) entre sous le dessus et ressort
    // au-delà du débord
    expect(solCache(R, -3, -35, 0, 2.5)).toBe(1)
    expect(solCache(R, -20, -5, 0, 2.5)).toBe(1)
    expect(solCache(R, -12, -12, 0, 2.5)).toBe(1)
  })

  it('un solide mince, du fluide dans sa base : aucune transition sous le dessus', () => {
    // une membrane de 40 u, relief fort à 480 u du centre : son sommet glisse
    // de 21,6 u. Coupe en x : d la base, dV le sommet, la tranche côté centre.
    const T = 40
    const delta = 21.6
    const w = 2.5
    const coupe = (x: number, permeable: number): number => {
      const d = Math.abs(x) - T / 2
      const dV = Math.abs(x - delta) - T / 2
      const flanc = d <= 0 && dV > 0 ? 1 : 0
      return solCache(R, d, dV, flanc, w, 1, permeable)
    }
    const valeurs: number[] = []
    for (let x = -T / 2 + delta + w; x <= T / 2 + delta - w; x += 0.5) valeurs.push(coupe(x, 1))
    expect(valeurs.length).toBeGreaterThan(20)
    // une seule valeur sous tout le dessus : pas de couture au milieu
    for (const v of valeurs) expect(v).toBe(1)
    // DEVANT LA TRANCHE, côté centre : la face est opaque, le fluide que la
    // base contient ne s'y peint pas (il se lisait devant le mur — relecture
    // finale, mineur 1)… sauf une bande de pied d'environ un fondu, où il
    // touche le bas du flanc
    for (let x = -T / 2 + 1.5 * w; x < -T / 2 + delta; x += 0.5) expect(coupe(x, 1), `x ${x}`).toBe(1)
    for (let x = -T / 2 + 0.05; x <= -T / 2 + 0.5 * w; x += 0.25) expect(coupe(x, 1), `x ${x}`).toBe(0)
  })

  it('un solide étanche : devant sa tranche, sur la base, rien n’est caché — le pied y est la lisière', () => {
    // un étanche ne contient rien dans sa base que la lisière du fluide qui
    // touche son pied : la tranche ne la cache pas
    for (const d of [-0.5, -2, -10, -30]) expect(solCache(R, d, 12, 1, 2.5)).toBe(0)
    expect(solCache(R, -10, 12, 1, 2.5, 1, 0)).toBe(0)
    // un perméable, au-delà de la bande de pied : caché ; dans la bande : non
    expect(solCache(R, -10, 12, 1, 2.5, 1, 1)).toBe(1)
    expect(solCache(R, -0.5, 12, 1, 2.5, 1, 1)).toBe(0)
    // relief éteint, rien, perméable ou pas
    expect(solCache(0, -10, 12, 1, 2.5, 1, 1)).toBe(0)
  })

  it('les perméables sont les solides que le fluide traverse : évent, membrane, rideau', () => {
    // la vapeur passe l'évent, l'eau la membrane, la glace le rideau (level.ts)
    expect([...MATIERES_PERMEABLES].sort()).toEqual([MAT_GRILLE, MAT_MEMBRANE, MAT_RIDEAU].sort())
    // le jumeau GLSL, généré de la même liste
    for (const m of MATIERES_PERMEABLES) expect(RELIEF_PAROIS_GLSL).toContain(`abs(mat - ${m}.0) < 0.5`)
    expect(RELIEF_PAROIS_GLSL).toContain('bool matPermeable(float mat)')
    // et le shader le passe à la règle, boîte par boîte
    expect(boucle).toContain('solPropre = solCache(uRelief, d, dV, flanc, edgeW, opaciteDessus, matPermeable(mat) ? 1.0 : 0.0);')
  })

  it('le dessus translucide de la vitre ne cache le sol qu’à son opacité', () => {
    expect(solCache(R, 5, -20, 0, 2.5, 0.4)).toBeCloseTo(0.4, 6)
    expect(solCache(R, -5, -20, 0, 2.5, 1)).toBe(1)
    // sa tranche (le dormant) reste opaque
    expect(solCache(R, 6, 9, 1, 2.5, 0.4)).toBe(1)
  })

  it('le sol que le sommet recouvre au-delà du pied est caché ; le pied vu reste visible', () => {
    // au-delà du pied (d > 0), sous le sommet (dV ≤ 0) : caché — le fluide
    // qui touche le pied de ce côté passe dessous
    expect(solCache(R, 3, -25, 0, 2.5)).toBe(1)
    expect(solCache(R, 20, -6, 0, 2.5)).toBe(1)
    // la lisière du fluide sous le pied, de ce même côté : cachée aussi
    expect(solCache(R, -3, -35, 0, 2.5)).toBe(1)
    // le sol libre : visible
    expect(solCache(R, 10, 15, 0, 2.5)).toBe(0)
    // côté où le pied se voit : la tranche sur la base — le fluide y touche
    // le bas du flanc, rien n'est caché
    expect(solCache(R, -4, 12, 1, 2.5)).toBe(0)
    expect(solCache(R, -1, 30, 1, 2.5)).toBe(0)
    // une face latérale vue de biais, hors de la base : elle cache le sol
    expect(solCache(R, 6, 9, 1, 2.5)).toBe(1)
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
    expect(boucle).toMatch(/solPropre = solCache\(uRelief, d, dV, flanc, edgeW, opaciteDessus, matPermeable\(mat\) \? 1\.0 : 0\.0\)/)
  })

  it('le dessus de la vitre ne cache le sol qu’à son opacité, celle de son remplissage', () => {
    // une seule recette pour les deux : le remplissage et le relief
    expect(boucle).toMatch(/opaciteDessus = opaciteVitre\(vitreReflDur\(uBoxes\[bi\], wbV\)\)/)
    expect(composeFs).toMatch(/fillA = opaciteVitre\(rdV\);/)
    expect(RELIEF_PAROIS_GLSL).toContain('float solCache(float relief, float d, float dV, float flanc, float w, float opacite, float permeable)')
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

describe('le shader : le fluide passe sous les sommets', () => {
  it('chaque solide verse le sol que son sommet cache dans le masque de l’image', () => {
    expect(boucle).toMatch(/solSousSommets = max\(solSousSommets, solPropre\)/)
  })

  it('la conduite, la chaudière et le surchauffeur à pièces cachent le sol sous leur image déplacée', () => {
    // leur dessus est l'image (alpha) posée sur la silhouette des pièces : le
    // sol caché se mesure sur ELLE, pas sur la boîte
    const n = [...boucle.matchAll(/solSousSommets = max\(solSousSommets, solCache\(uRelief, dG, dGV, 0\.0, edgeW\) \* fill \* \w+\.a\)/g)]
    expect(n.length).toBe(3)
  })

  it('le fluide (et ses ondes, reflets, éclaboussures : tout passe par body) est masqué avant d’être peint', () => {
    const masque = composeFs.indexOf('body *= 1.0 - solSousSommets;')
    expect(masque).toBeGreaterThan(0)
    // avant la sortie de la couche d'eau seule, et avant le mélange de l'eau
    expect(masque).toBeLessThan(composeFs.indexOf('if (uPasse > 1.5 && uPasse < 2.5 && body <= 0.001)'))
    expect(masque).toBeLessThan(composeFs.indexOf('col = mix(col, water, body);'))
    // l'ombre du corps ne s'exempte plus là où il est caché : sa silhouette
    // se découpait en clair sur le dessus du mur
    expect(composeFs).toContain('dansEau *= 1.0 - solSousSommets;')
    // les ondes d'éjection gonflent le champ AVANT que body ne se calcule :
    // elles passent par le masque
    expect(composeFs.indexOf('waveGlow')).toBeLessThan(masque)
  })

  it('la passe de vie (motes, lueur des gouttes perdues) lit le masque dans la profondeur', () => {
    // la composition écrit sa profondeur : 0 sous un sommet, 1 ailleurs
    expect(composeFs).toMatch(/void main\(\) \{(\s*\/\/[^\n]*)*\s*gl_FragDepth = 1\.0;/)
    expect(composeFs).toContain('gl_FragDepth = solSousSommets > 0.5 ? 0.0 : 1.0;')
    // relief allumé : la composition écrit, la vie teste
    expect(rendu).toMatch(/if \(sommetsCachent && !decorNet\) this\.ecritProfondeur\(true\)/)
    expect(decorNet).toContain('this.ecritProfondeur(sommetsCachent)')
    expect(drawVie).toContain('if (sommetsCachent) this.passeSousSommets(true)')
    expect(drawVie).toContain('if (sommetsCachent) this.passeSousSommets(false)')
    // passer sous : le point (profondeur 0,5) ne se peint que là où le masque vaut 1
    expect(passeSous).toContain('gl.depthFunc(gl.LESS)')
    expect(passeSous).toContain('gl.depthMask(false)')
    expect(passeSous).toContain('gl.disable(gl.DEPTH_TEST)')
    // écrire : chaque pixel de la composition pose sa profondeur
    expect(ecrit).toContain('gl.depthFunc(gl.ALWAYS)')
  })
})

describe('le shader : chaque flanc porte sa matière', () => {
  it('chaque matière solide hors pièces a sa branche de flanc', () => {
    expect(SOLIDES.length).toBeGreaterThanOrEqual(10)
    for (const m of SOLIDES) expect(matiereFlanc, `mat ${m}`).toMatch(new RegExp(`\\bmi == ${m}\\b`))
    // le sas, le vide et la baie n'ont pas de corps
    for (const m of [3, 11, 12]) expect(matiereFlanc).not.toMatch(new RegExp(`\\bmi == ${m}\\b`))
  })

  it('la tranche lit la texture de la matière, projetée sur l’arête et la hauteur', () => {
    expect(flanc).toContain('matiereFlanc(')
    // les teintes calculées d'avant (bas et haut de tranche par matière) sont parties
    expect(flanc).not.toContain('basC')
    expect(flanc).not.toContain('hautC')
    for (const tex of ['uTexWall', 'uTexWallA', 'uTexPhile', 'uTexPhobe', 'uTexParoi']) {
      expect(matiereFlanc).toMatch(new RegExp(`textureGrad\\(${tex},`))
    }
    // l'abscisse le long de l'arête, l'ordonnée la hauteur depuis le pied
    expect(flanc).toMatch(/vec2 ft = vec2\(/)
    expect(flanc).toContain('float hB = hauteurBoite(bi);')
    expect(flanc).toContain('htFlanc * hB')
  })

  it('chaque branche dit de quel dessus elle recopie la recette : un réglage du dessus ne se perd pas', () => {
    const branches = matiereFlanc.split(/if \(mi == /).slice(1)
    expect(branches.length).toBeGreaterThanOrEqual(10)
    for (const b of branches) expect(b, b.slice(0, 40)).toContain('à garder en phase avec')
  })

  it('assombrie au pied, éclairée par la lumière (la direction par défaut lumière éteinte)', () => {
    expect(flanc).toMatch(/dot\(nrm, lampeDir\)/)
    // la tranche regarde la lampe même lumière éteinte : lampeDir y vaut la
    // direction par défaut — plus de garde uLumiere autour
    expect(flanc).not.toContain('if (uLumiere > 0.5)')
    expect(flanc).toMatch(/mix\([0-9.]+, 1\.0, sqrt\(htFlanc\)\)/)
  })
})

describe('les décalques plaqués sur un mur suivent son sommet', () => {
  it('drawDecals cherche le solide sous le décalque et pose ses sommets sur le dessus déplacé', () => {
    expect(drawDecals).toContain('this.hauteurSousDecal(')
    expect(sousDecal).toContain('dansForme(')
    // seuls les solides portent un dessus (le sas, le vide, la baie : non)
    expect(sousDecal).toContain('RANG_DE_MATIERE[bx.material] === undefined')
    expect(drawDecals).toContain('fractionSommet(')
    expect(drawDecals).toContain('pointDuSommet(')
    // l'eau qui l'efface se lit au pied (le décalque est sur le dessus)
    expect(decalFs).toContain('uniform float uSommet;')
    expect(decalFs).toMatch(/\(gl_FragCoord\.xy - 0\.5 \* uCanvasSize\) \* \(1\.0 - uSommet\)/)
  })

  it('un décalque posé au sol passe sous les sommets, comme le fluide', () => {
    expect(drawDecals).toContain('this.passeSousSommets(')
  })

  it('relief éteint, ni recherche, ni appel GL, ni tableau de plus par décalque', () => {
    // tout le travail du relief, par décalque, sous une seule garde
    expect(drawDecals).toMatch(/if \(this\.reliefK > 0\) \{\s*const hSupport = this\.hauteurSousDecal\([^}]*this\.passeSousSommets\(hSupport < 0\)\s*gl\.uniform1f\(du\['uSommet'\], f\)\s*\}/)
    // aucun tableau par coin quand le décalque ne bouge pas
    expect(drawDecals).not.toMatch(/: \[x, y\]/)
    expect(drawDecals).toMatch(/if \(f > 0\) \{\s*const p = pointDuSommet\(/)
    // l'état rendu en fin de passe, relief allumé seulement
    expect(drawDecals).toMatch(/if \(this\.reliefK > 0\) \{\s*this\.passeSousSommets\(false\)/)
  })

  it('uSommet revient à 0 en fin de passe : les lampes, qui reprennent ce programme, n’en héritent pas', () => {
    expect(drawDecals).toMatch(/this\.passeSousSommets\(false\)\s*\/\/[^\n]*\n(\s*\/\/[^\n]*\n)*\s*gl\.uniform1f\(du\['uSommet'\], 0\)/)
    // et drawLampes passe bien après les décalques
    expect(rendu.indexOf('this.drawDecals(')).toBeLessThan(rendu.indexOf('this.drawLampes('))
  })
})

describe('le relief reste éteint par défaut', () => {
  it('sans réglage posé, sujet21-relief vaut off, et off ne déplace rien', () => {
    expect(main).toContain("localStorage.getItem('sujet21-relief') ?? 'off'")
    expect(main).toMatch(/const RELIEF_K = \{ off: 0, /)
  })
})
