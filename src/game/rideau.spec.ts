import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { FILTRES_ATLAS, RIDEAU, RIDEAU_DESSUS, RIDEAU_PAS, dispositionRideau } from './formes'

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

  it('un rideau carré — le plus court possible, L est le grand côté — garde une lanière', () => {
    const d = dispositionRideau(60, 60)
    expect(d.n).toBe(1)
    expect(2 * d.montant + d.pas).toBeCloseTo(60, 6)
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
    expect(cadre('R_DESSUS')).toEqual(FILTRES_ATLAS.dessus)
    expect(cadre('R_CHAPEAU')).toEqual(FILTRES_ATLAS.chapeau)
    expect(Number(py.match(/^MARGE_DESSUS = (\d+)/m)![1])).toBe(FILTRES_ATLAS.margeDessus)
    expect(Number(py.match(/^MARGE_GRILLE = (\d+)/m)![1])).toBe(FILTRES_ATLAS.margeGrille)
    expect(Number(py.match(/^TAILLE = (\d+)/m)![1])).toBe(FILTRES_ATLAS.taille)
    expect(Number(py.match(/^HAUTEUR = (\d+)/m)![1])).toBe(FILTRES_ATLAS.hauteur)
  })
})

describe('rideau lamellaire — le dessus, vu d’en haut', () => {
  const blender = readFileSync(new URL('../../tools/images/blender/rideau_dessus.py', import.meta.url), 'utf8')
  const nombre = (nom: string) => Number(blender.match(new RegExp(`^${nom} = ([\\d.]+)`, 'm'))![1])
  const paire = (nom: string) =>
    blender.match(new RegExp(`^${nom} = \\(([\\d.]+), ([\\d.]+)\\)`, 'm'))!.slice(1).map(Number)

  it('la scène Blender dessine le pas et le montant du jeu', () => {
    // les expressions du script, évaluées : ce sont celles de formes.ts
    const expr = (nom: string) => blender.match(new RegExp(`^${nom} = (.+)$`, 'm'))![1]
    expect(new Function(`return ${expr('PAS_SUR_T')}`)()).toBeCloseTo(RIDEAU_PAS, 9)
    expect(new Function(`return ${expr('MONTANT_SUR_T')}`)()).toBeCloseTo(RIDEAU.montant, 9)
    expect(nombre('LANIERES')).toBe(RIDEAU.lanieres)
  })

  it('ses fentes sont où le shader peint la lanière poussée', () => {
    expect(nombre('LONGERON')).toBe(RIDEAU_DESSUS.longeron)
    expect(paire('FENTE')).toEqual(RIDEAU_DESSUS.fente)
    expect(paire('RAIL')).toEqual(RIDEAU_DESSUS.rail)
    // longeron, fente, rail : dans cet ordre depuis la face, sans se chevaucher
    expect(RIDEAU_DESSUS.longeron).toBeLessThanOrEqual(RIDEAU_DESSUS.fente[0])
    expect(RIDEAU_DESSUS.fente[0]).toBeLessThan(RIDEAU_DESSUS.fente[1])
    expect(RIDEAU_DESSUS.fente[1]).toBeLessThanOrEqual(RIDEAU_DESSUS.rail[0])
    expect(RIDEAU_DESSUS.rail[0] + RIDEAU_DESSUS.rail[1]).toBeCloseTo(1, 9)
  })

  it('son cadre est à l’échelle : huit lanières au pas du tronçon, toute l’épaisseur', () => {
    const [x, y, w, h] = FILTRES_ATLAS.dessus
    expect(w).toBe(FILTRES_ATLAS.corps[2])
    // w px pour 8 pas, h px pour T : le même nombre de px par unité, à 1 px près
    expect(Math.abs(h - w / (RIDEAU.lanieres * RIDEAU_PAS))).toBeLessThan(1)
    const [cx, cy, cw, ch] = FILTRES_ATLAS.chapeau
    expect(ch).toBe(h)
    expect(Math.abs(cw - RIDEAU.montant * h)).toBeLessThan(1)
    // ni l'un ni l'autre ne mord sur le montant de face ni ne sort de l'atlas
    const m = FILTRES_ATLAS.margeDessus
    expect(x - m).toBeGreaterThan(FILTRES_ATLAS.montant[0] + FILTRES_ATLAS.montant[2])
    expect(y).toBeGreaterThan(FILTRES_ATLAS.corps[1] + FILTRES_ATLAS.corps[3])
    expect(x + w + m).toBeLessThanOrEqual(FILTRES_ATLAS.taille)
    expect(cy).toBeGreaterThan(y + h)
    expect(cy + ch).toBeLessThanOrEqual(FILTRES_ATLAS.hauteur)
    expect(cx).toBeGreaterThan(FILTRES_ATLAS.montant[0] + FILTRES_ATLAS.montant[2])
  })

  it('le shader interpole ses cadres et ses fentes', () => {
    expect(renderer).toMatch(/const vec4 FI_DESSUS = \$\{v4\(A\.dessus\)\};/)
    expect(renderer).toMatch(/const vec4 FI_CHAPEAU = \$\{v4\(A\.chapeau\)\};/)
    expect(renderer).toMatch(/const vec2 RD_FENTE = vec2\(\$\{f\(D\.fente\[0\]\)\}, \$\{f\(D\.fente\[1\]\)\}\);/)
    expect(renderer).toMatch(/const vec2 RD_FUT = vec2\(\$\{f\(R\.fut\[0\]\)\}, \$\{f\(R\.fut\[1\]\)\}\);/)
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

  it('relief allumé, la porte à lanières est sur la TRANCHE, pas sur le dessus', () => {
    // le défaut (le concepteur, 27/11) : la porte vue de face, animation
    // comprise, restait couchée sur le dessus du bloc ; la tranche — la
    // paroi verticale — ne portait que des rayures tracées.
    // Le dessus : la vue d'en haut relief allumé, la porte couchée sinon
    expect(branche).toMatch(/uRelief > 0\.0\s*\? rideauDessus\(locR,[^;]*\)\s*: rideauRendu\(locR,[^;]*\);/)
    expect(branche.indexOf('rideauDessus(')).toBeGreaterThan(branche.lastIndexOf('uHasGrille > 0.5', branche.indexOf('rideauDessus(')))
    // la tranche : la porte, pour le rideau rectangulaire dont l'atlas est là
    // — les autres gardent matiereFlanc (les lamelles tracées)
    const flanc = renderer.slice(renderer.indexOf('// ——— LE FLANC : la tranche du solide'), renderer.indexOf('// le dessus, de même : sous une surface plus haute'))
    expect(flanc).toMatch(/bool porteR = mat > 7\.5 && mat < 8\.5 && dec\.y < 0\.5 && uHasGrille > 0\.5;/)
    expect(flanc).toMatch(/if \(porteR\) \{[^}]*fc = rideauTranche\(/)
    expect(flanc).toMatch(/\} else \{\s*fc = matiereFlanc\(/)
    // la face y tombe du sommet (le rail, t = 0) au pied (le seuil, t = 1),
    // et la MÊME face sert le relief éteint : un seul dessin de lanières
    const tr = renderer.slice(renderer.indexOf('vec3 rideauTranche('), renderer.indexOf('vec4 rideauDessus('))
    expect(tr).toMatch(/rideauFace\(clamp\(horiz \? pf\.x : pf\.y, 0\.0, L\), 1\.0 - ht,/)
    const couche = renderer.slice(renderer.indexOf('vec4 rideauRendu('), renderer.indexOf('vec3 rideauTranche('))
    expect(couche).toMatch(/return rideauFace\(/)
    expect((renderer.match(/vec4 rideauFace\(/g) ?? []).length).toBe(1)
  })

  it('le champ du fluide se lit à niveau de détail fixé : branche non uniforme', () => {
    const f = renderer.slice(renderer.indexOf('vec2 rdFluide('), renderer.indexOf('vec2 rdMonde('))
    expect(f).toMatch(/textureLod\(uField/)
    expect(f).not.toMatch(/texture\(uField/)
  })

  it('la grille de l’évent vient de l’atlas, répétée à la main', () => {
    // dans la branche de l'évent seulement, au gradient explicite : pas une
    // lecture par pixel de l'écran (revue, 29/09). Lue au point du SOMMET
    // (wS, qui vaut world relief éteint) : relief allumé, le motif suit le
    // dessus déplacé (volume des parois, R4)
    expect(renderer).toMatch(/if \(uHasGrille > 0\.5\) \{\s*vec3 texGrilleC = grilleEvent\(wS, pxMonde\);/)
    const g = renderer.slice(renderer.indexOf('vec3 grilleEvent('), renderer.indexOf('vec2 rdFluide('))
    expect(g).not.toMatch(/dFd[xy]/)
    expect(renderer).not.toMatch(/texture\(uTexGrille, world/)
    expect(renderer).toMatch(/'\/assets\/filtres-atlas\.webp'/)
    expect(renderer).not.toMatch(/grille\.webp/)
  })
})
