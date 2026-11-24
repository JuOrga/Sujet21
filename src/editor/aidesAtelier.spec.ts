// Le banc des AIDES de l'atelier : chaque outil de la barre a la sienne,
// courte, et elle annonce les réglages que l'élément offre vraiment.
// Le câblage de la bulle (editor.ts) se lit dans la source : l'éditeur ne
// s'importe pas sans DOM.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { AIDES_ATELIER, AIDE_POINTS_MAX, AIDE_POINT_SIGNES_MAX, aideDe } from './aidesAtelier'
import { FAMILLES_JOUEUR, OUTILS_TRANSVERSES, REGLAGES_JOUEUR, outilPermis } from './profilJoueur'

const OUTILS = [...OUTILS_TRANSVERSES, ...FAMILLES_JOUEUR.flatMap((f) => f.outils.map((o) => o.outil))]
const ED = readFileSync(new URL('./editor.ts', import.meta.url), 'utf-8')
const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')

describe('une aide pour chaque élément de la barre', () => {
  it('aucun outil sans aide, aucune aide sans outil', () => {
    for (const o of OUTILS) expect(aideDe(o), o).not.toBeNull()
    for (const cle of Object.keys(AIDES_ATELIER)) expect(outilPermis(cle), cle).toBe(true)
  })

  it('courte : un geste, trois points au plus, chacun lisible d’un coup d’œil', () => {
    for (const [outil, aide] of Object.entries(AIDES_ATELIER)) {
      expect(aide.geste.length, outil).toBeGreaterThan(10)
      expect(aide.aSavoir.length, outil).toBeGreaterThan(0)
      expect(aide.aSavoir.length, outil).toBeLessThanOrEqual(AIDE_POINTS_MAX)
      for (const p of aide.aSavoir) expect(p.length, `${outil} : ${p}`).toBeLessThanOrEqual(AIDE_POINT_SIGNES_MAX)
    }
  })

  it('un élément qui se règle le dit dans son aide', () => {
    for (const f of FAMILLES_JOUEUR) {
      for (const o of f.outils) {
        // les parois ont toutes la forme pour réglage : la paroi simple le dit
        if (o.collection === 'boxes' || !REGLAGES_JOUEUR[o.collection]?.length) continue
        const texte = aideDe(o.outil)!.aSavoir.join(' ')
        expect(texte, o.outil).toMatch(/Réglages? :/)
      }
    }
  })
})

describe('la bulle s’ouvre après un temps d’arrêt', () => {
  it('entre une et deux secondes (le concepteur, 24/11)', () => {
    const delai = Number(/export const DELAI_AIDE_MS = (\d+)/.exec(ED)?.[1])
    expect(delai).toBeGreaterThanOrEqual(1000)
    expect(delai).toBeLessThanOrEqual(2000)
  })

  it('la barre porte la bulle, et ses outils n’ont plus de title (pas de double bulle)', () => {
    expect(ED).toContain('id="ed-dock-aide" role="tooltip" hidden')
    const outils = /class="ed-dock-outil" data-dock-outil="\$\{o\.outil\}"[^>]*>/.exec(ED)?.[0] ?? ''
    expect(outils).not.toBe('')
    expect(outils).not.toContain('title=')
    // au doigt, pas de survol : la bulle ne s'arme qu'à la souris et au clavier
    expect(ED).toContain("if (e.pointerType !== 'touch') arme(b)")
    expect(HTML).toMatch(/#editor \.ed-dock-aide \{[^}]*position: absolute/)
  })
})
