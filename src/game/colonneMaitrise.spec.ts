import { describe, expect, it } from 'vitest'
import { ANNEAU_URL, ANNEAUX_MAITRISE } from './ceremonieObjets'
import { anneauxHTML, colonneMaitrise, couleeColonne, NIVEAUX_SIEGES, niveauColonne } from './colonneMaitrise'
import { paliersAtteints, PALIERS_XP } from './instruments'

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
    expect(colonneMaitrise(0)).toEqual({ base: 0, paliers: [3, 6, 10] })
    expect(colonneMaitrise(4.6)).toEqual({ base: 3, paliers: [6, 10, 15] })
    // un palier atteint pile n'est plus « à venir »
    expect(colonneMaitrise(6)).toEqual({ base: 6, paliers: [10, 15, 21] })
  })

  it('garde trois sièges occupés au bout de la table : les derniers paliers, franchis ou non', () => {
    expect(colonneMaitrise(25)).toEqual({ base: 15, paliers: [21, 28, 36] })
    expect(colonneMaitrise(400)).toEqual({ base: 15, paliers: [21, 28, 36] })
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
    expect(niveauColonne({ base: 0, paliers: [] }, 5)).toBe(1)
    expect(colonneMaitrise(2, [])).toEqual({ base: 0, paliers: [] })
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

// LA COULÉE DU PALIER (étape 3) : le liquide monte dans la colonne en grand,
// et chaque anneau que l'XP franchit se brise au passage. La relecture de F3
// laissait deux décisions : (a) la fenêtre de paliers est FIGÉE au départ de
// la coulée — recalculée à chaque image, elle glissait d'un cran au premier
// palier franchi, et l'anneau qu'on venait de briser quittait son siège
// sous le liquide ; (b) un surplus qui franchit plus de trois paliers : le
// liquide plafonnait à 1 et les paliers au-delà du troisième siège ne se
// montraient pas. La colonne se RÉARME : le troisième anneau brisé, la
// fenêtre avance et le liquide repart du fond, comme l'ancienne jauge
// « repartait de zéro ».
describe('la coulée de la colonne', () => {
  it('ne coule rien quand rien ne s’ajoute', () => {
    expect(couleeColonne(4.6, 4.6)).toEqual([])
    expect(couleeColonne(4.6, 4)).toEqual([])
  })

  it('fige la fenêtre du départ : l’anneau brisé reste sur son siège', () => {
    const t = couleeColonne(4.6, 8.78)
    expect(t).toHaveLength(2)
    for (const x of t) expect(x.colonne).toEqual(colonneMaitrise(4.6)) // [6, 10, 15], pas [10, 15, 21]
    expect(t[0]).toMatchObject({ de: 4.6, a: 6, palier: 6, siege: 0, rearme: false })
    expect(t[1]).toMatchObject({ de: 6, a: 8.78, palier: null, siege: null, rearme: false })
  })

  it('se réarme après le troisième anneau brisé : la fenêtre avance, le liquide repart du fond', () => {
    const t = couleeColonne(0, 16)
    expect(t.map((x) => x.palier)).toEqual([3, 6, 10, 15, null])
    expect(t.map((x) => x.siege)).toEqual([0, 1, 2, 0, null])
    expect(t.map((x) => x.rearme)).toEqual([false, false, false, true, false])
    expect(t[3].colonne).toEqual({ base: 10, paliers: [15, 21, 28] })
    expect(niveauColonne(t[3].colonne, t[3].de)).toBe(0) // vidée
  })

  it('plafonne au bout de la table, sans se réarmer sur des anneaux déjà brisés', () => {
    const t = couleeColonne(30, 50)
    expect(t.map((x) => x.palier)).toEqual([36, null])
    expect(t.every((x) => !x.rearme)).toBe(true)
    expect(niveauColonne(t[1].colonne, 50)).toBe(1)
  })

  it('brise un anneau par palier franchi, au siège où le liquide le rencontre', () => {
    const departs = [0, 2.5, 3, 4.6, 9.99, 14, 21, 27.5, 35, 40]
    for (const de of departs)
      for (const gain of [0.4, 1.4, 4.18, 9, 17, 40]) {
        const a = de + gain
        const t = couleeColonne(de, a)
        const cas = `${de} → ${a}`
        // une suite sans trou, du départ à l'arrivée
        expect(t[0].de, cas).toBe(de)
        expect(t[t.length - 1].a, cas).toBe(a)
        for (let k = 1; k < t.length; k++) expect(t[k].de, cas).toBe(t[k - 1].a)
        // autant d'anneaux brisés que de paliers atteints (la règle du jeu)
        expect(t.filter((x) => x.palier !== null), cas).toHaveLength(paliersAtteints(a) - paliersAtteints(de))
        for (const x of t) {
          if (x.palier === null) continue
          expect(x.a, cas).toBe(x.palier)
          expect(x.colonne.paliers[x.siege!], cas).toBe(x.palier)
          expect(niveauColonne(x.colonne, x.a), cas).toBeCloseTo(NIVEAUX_SIEGES[x.siege!], 9)
        }
        // le liquide ne redescend que d'un réarmement
        for (const x of t) expect(niveauColonne(x.colonne, x.a), cas).toBeGreaterThanOrEqual(niveauColonne(x.colonne, x.de))
      }
  })
})
