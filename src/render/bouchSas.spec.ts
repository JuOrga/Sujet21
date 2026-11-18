import { describe, expect, it } from 'vitest'
import { COMPOSE_FS } from './renderer'

// LA BOUCHE DU SAS est l'accent SARCELLE de la cuve (docs/charte-visuelle.md
// §3, docs/assets-ia.md §4) : son anneau et ses stries étaient VERTS, la
// couleur que la charte réserve à la serre. Ce test lit les teintes posées
// autour de l'iris : aucune ne doit tirer sur le vert (vert > bleu).
describe('la bouche du sas, en sarcelle', () => {
  it('ses stries et ses anneaux ont plus de bleu que de vert', () => {
    const debut = COMPOSE_FS.indexOf('halo de courant')
    const fin = COMPOSE_FS.indexOf('Relief d', debut)
    expect(debut).toBeGreaterThan(0)
    const bloc = COMPOSE_FS.slice(debut, fin)
    const teintes = [...bloc.matchAll(/col \+= vec3\(([\d.]+), ([\d.]+), ([\d.]+)\) \* (?:ring|streaks)/g)].map((m) => m.slice(1).map(Number))
    expect(teintes.length).toBe(3)
    for (const [, g, b] of teintes) expect(b).toBeGreaterThan(g)
  })
})

// L'IRIS EST DANS LE FOND, PAS POSÉ DESSUS (le concepteur, aperçu du 18/11 :
// « le sas fait très posé sur l'image »). Deux choses le détachaient : il
// gardait sa pleine lumière là où le fond, sous la même lampe, tombait au
// noir (21-02 : ambiante nulle) ; et un anneau sombre de 0,9 à 1,1 rayon de
// cadre, peint HORS de l'image, le cernait comme une ombre portée.
describe('l’iris du sas prend la lumière du fond', () => {
  const debut = COMPOSE_FS.indexOf('Iris mécanique')
  const bloc = COMPOSE_FS.slice(debut, COMPOSE_FS.indexOf('} else {', debut))

  it('le fond et l’iris passent par le même éclairage', () => {
    // déclarée HORS du test de lumière : lumière éteinte, l'iris la lit aussi
    expect(COMPOSE_FS).toMatch(/vec3 eclFond = vec3\(1\.0\);\s+(\/\/[^\n]*\n\s*)*if \(uLumiere > 0\.5\)/)
    expect(COMPOSE_FS).toMatch(/eclFond = vec3\(uAmbiante\) \+ 0\.95 \* lm;/)
    expect(COMPOSE_FS).toMatch(/tank \*= eclFond;/)
    expect(bloc).toMatch(/irisCol \*= eclFond;/)
  })

  it('aucune ombre ne déborde du cadre sur le fond', () => {
    expect(debut).toBeGreaterThan(0)
    expect(bloc).not.toMatch(/frameR \* 1\.1/)
  })

  // Le cadre de iris.webp s'arrête à 0,429 de sa largeur (alpha 254 à 0,428,
  // 0 à 0,432) ; au-delà, du noir transparent. Détouré à 0,435 → 0,465 —
  // le réglage de l'image d'avant, opaque jusqu'au bord —, ce noir se
  // peignait en anneau épais autour du cadre. Re-rendre l'iris avec un autre
  // cadre, c'est revenir ici.
  it('le détourage tombe au bord du cadre de l’image, pas au-delà', () => {
    expect(bloc).toMatch(/float rCadre = 0\.429 \* 2\.0 \* frameR;/)
    expect(bloc).toMatch(/aMask = 1\.0 - smoothstep\(rCadre - pxMonde, rCadre, dh\);/)
    expect(bloc).not.toMatch(/0\.465/)
  })
})
