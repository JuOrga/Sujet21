import { describe, expect, it } from 'vitest'
import { ANNEAU_URL, ANNEAUX_MAITRISE } from './ceremonieObjets'
import { anneauxHTML, colonneMaitrise, NIVEAUX_SIEGES, niveauColonne } from './colonneMaitrise'
import { PALIERS_XP } from './instruments'

// LA COLONNE DE MAÎTRISE (versement, palier) : un tube rendu dans Blender à
// trois sièges d'anneau. Chaque siège porte un PALIER ; le liquide qui
// passe un siège, c'est un palier franchi. Il faut donc que le niveau du
// liquide tombe EXACTEMENT sur le siège quand l'XP vaut le palier — sinon
// l'anneau se briserait sous un liquide qui ne l'a pas encore atteint.
describe('la colonne de maîtrise', () => {
  it('tient ses sièges là où l’atelier a posé les anneaux, du bas vers le haut', () => {
    expect(NIVEAUX_SIEGES).toHaveLength(ANNEAUX_MAITRISE.length)
    for (let k = 0; k < NIVEAUX_SIEGES.length; k++) {
      expect(NIVEAUX_SIEGES[k]).toBeGreaterThan(0)
      expect(NIVEAUX_SIEGES[k]).toBeLessThan(1)
      if (k > 0) expect(NIVEAUX_SIEGES[k]).toBeGreaterThan(NIVEAUX_SIEGES[k - 1])
    }
  })

  it('montre les trois paliers à venir, depuis le dernier atteint', () => {
    expect(colonneMaitrise(0)).toEqual({ base: 0, premier: 1, paliers: [3, 6, 10] })
    expect(colonneMaitrise(4.6)).toEqual({ base: 3, premier: 2, paliers: [6, 10, 15] })
    // un palier atteint pile n'est plus « à venir »
    expect(colonneMaitrise(6)).toEqual({ base: 6, premier: 3, paliers: [10, 15, 21] })
  })

  it('garde trois sièges occupés au bout de la table : les derniers paliers, franchis ou non', () => {
    expect(colonneMaitrise(25)).toEqual({ base: 15, premier: 5, paliers: [21, 28, 36] })
    expect(colonneMaitrise(400)).toEqual({ base: 15, premier: 5, paliers: [21, 28, 36] })
  })

  it('pose le liquide exactement sur le siège quand l’XP vaut le palier', () => {
    const c = colonneMaitrise(4.6)
    expect(niveauColonne(c, c.base)).toBe(0)
    c.paliers.forEach((p, k) => expect(niveauColonne(c, p)).toBeCloseTo(NIVEAUX_SIEGES[k], 9))
    // entre deux sièges, le liquide monte en droite ligne
    const milieu = niveauColonne(c, 8)
    expect(milieu).toBeCloseTo((NIVEAUX_SIEGES[0] + NIVEAUX_SIEGES[1]) / 2, 9)
  })

  it('ne redescend jamais quand l’XP monte, et ne déborde pas du tube', () => {
    const c = colonneMaitrise(4.6)
    let avant = -1
    for (let xp = 0; xp <= 60; xp += 0.25) {
      const n = niveauColonne(c, xp)
      expect(n).toBeGreaterThanOrEqual(avant)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThanOrEqual(1)
      avant = n
    }
    expect(niveauColonne(c, 60)).toBe(1)
  })

  it('se remplit quand la table n’a plus aucun palier', () => {
    expect(niveauColonne({ base: 0, premier: 1, paliers: [] }, 5)).toBe(1)
    expect(colonneMaitrise(2, [])).toEqual({ base: 0, premier: 1, paliers: [] })
  })

  it('pose un anneau par palier, intact s’il reste à franchir, brisé sinon', () => {
    const html = anneauxHTML(colonneMaitrise(25), 25)
    const anneaux = html.match(/<i class="mb-anneau[^"]*"/g) ?? []
    expect(anneaux).toHaveLength(3)
    expect(anneaux[0]).toContain('mb-anneau-brise') // 21 L : franchi
    expect(anneaux[1]).not.toContain('mb-anneau-brise') // 28 L
    expect(anneaux[2]).not.toContain('mb-anneau-brise') // 36 L
    // l'image vient du contrat (une seule source), posée dans la boîte mesurée
    expect(html).toContain(`url(${ANNEAU_URL})`)
    const b = ANNEAUX_MAITRISE[0]
    expect(html).toContain(`left:${+(b.x * 100).toFixed(3)}%;top:${+(b.y * 100).toFixed(3)}%`)
    expect(html).toContain('aria-hidden="true"')
  })

  it('désigne l’anneau qu’un versement franchirait', () => {
    const c = colonneMaitrise(4.6)
    const html = anneauxHTML(c, 4.6, 4.6 + 4.18) // 8,78 L : franchit 6, pas 10
    const anneaux = html.match(/<i class="mb-anneau[^"]*"/g) ?? []
    expect(anneaux[0]).toContain('mb-anneau-franchit')
    expect(anneaux[1]).not.toContain('mb-anneau-franchit')
    expect(anneauxHTML(c, 4.6)).not.toContain('mb-anneau-franchit')
  })

  it('suit la table du jeu par défaut', () => {
    expect(colonneMaitrise(0).paliers).toEqual(PALIERS_XP.slice(0, 3))
  })
})
