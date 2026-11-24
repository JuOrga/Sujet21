// MES SALLES (sallesAtelier.ts) : retrouver ses salles dans l'atelier — le
// concepteur, 24/11 : « il faut pouvoir retrouver ces tableaux dans
// l'éditeur ». Et le câblage qui fait qu'une publication n'est plus jamais
// perdue en silence (main.ts, lu dans la source).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  SALLES_MAX,
  etatDeSalle,
  lisSalles,
  nouvelleCleSalle,
  rangeSalle,
  retireSalle,
  salleDeLaCreation,
  type SalleAtelier,
} from './sallesAtelier'

const s = (cle: string, majLe: string, extra: Partial<SalleAtelier> = {}): SalleAtelier => ({
  cle, nom: cle, salle: `{"name":"${cle}"}`, creationId: '', base: '', majLe, ...extra,
})

describe('la liste des salles', () => {
  it('se relit sans jamais lever : illisible, elle est vide', () => {
    expect(lisSalles(null)).toEqual([])
    expect(lisSalles('pas du json')).toEqual([])
    expect(lisSalles('{"a":1}')).toEqual([])
    expect(lisSalles(JSON.stringify([s('a', '2026-11-24'), { cle: 'b' }]))).toEqual([s('a', '2026-11-24')])
  })

  it('ranger remplace la salle de même clé et met la plus récente en tête', () => {
    let l = rangeSalle([], s('a', '2026-11-20'))
    l = rangeSalle(l, s('b', '2026-11-22'))
    l = rangeSalle(l, s('a', '2026-11-24', { nom: 'A retouchée' }))
    expect(l.map((x) => x.cle)).toEqual(['a', 'b'])
    expect(l[0].nom).toBe('A retouchée')
  })

  it(`au-delà de ${SALLES_MAX}, la plus ancienne NON publiée part — jamais une publiée, jamais celle qu'on range`, () => {
    let l: SalleAtelier[] = []
    // la plus ancienne est publiée : elle doit rester
    l = rangeSalle(l, s('publiee', '2026-01-01', { creationId: 'abcdefgh' }))
    l = rangeSalle(l, s('vieux-brouillon', '2026-01-02'))
    for (let i = 0; i < SALLES_MAX - 2; i++) l = rangeSalle(l, s(`b${i}`, `2026-02-${String(i % 28 + 1).padStart(2, '0')}T${String(i).padStart(4, '0')}`))
    expect(l).toHaveLength(SALLES_MAX)
    l = rangeSalle(l, s('neuve', '2026-12-01'))
    expect(l).toHaveLength(SALLES_MAX)
    expect(l.some((x) => x.cle === 'publiee')).toBe(true)
    expect(l.some((x) => x.cle === 'vieux-brouillon')).toBe(false)
    expect(l[0].cle).toBe('neuve')
  })

  it('retirer, retrouver par sa création, dire son état', () => {
    const l = [s('a', '1', { creationId: 'abcdefgh', base: '{"name":"a"}' }), s('b', '2')]
    expect(retireSalle(l, 'a').map((x) => x.cle)).toEqual(['b'])
    expect(salleDeLaCreation(l, 'abcdefgh')?.cle).toBe('a')
    expect(salleDeLaCreation(l, 'zzzzzzzz')).toBeNull()
    expect(etatDeSalle(l[0])).toBe('publiee')
    expect(etatDeSalle({ ...l[0], salle: '{"name":"a2"}' })).toBe('retouchee')
    expect(etatDeSalle(l[1])).toBe('brouillon')
  })

  it('des clés neuves, toutes différentes', () => {
    const cles = new Set(Array.from({ length: 200 }, () => nouvelleCleSalle()))
    expect(cles.size).toBe(200)
    expect(nouvelleCleSalle(() => 0, 0)).toBe('s00000')
  })
})

describe('le câblage', () => {
  const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')
  const ED = readFileSync(new URL('./editor.ts', import.meta.url), 'utf-8')

  it('le résultat d’une publication est noté AVANT le garde de l’écran de fin', () => {
    // le défaut du 24/11 : un retour à l'atelier avant la réponse, et la
    // salle publiée n'était pas notée, l'échec pas dit
    const fn = MAIN.slice(MAIN.indexOf('async function partageDepuisAtelier'))
    const corps = fn.slice(0, fn.indexOf('\n}\n'))
    const note = corps.indexOf('ed.noteCreation(p.id')
    const echec = corps.indexOf('ed.notePublication(false')
    const garde = corps.indexOf("if (!overlay.classList.contains('visible')) return")
    expect(note).toBeGreaterThan(0)
    expect(echec).toBeGreaterThan(0)
    expect(garde).toBeGreaterThan(note)
    expect(garde).toBeGreaterThan(echec)
  })

  it('la salle publiée est celle que l’atelier a envoyée, figée au lancement', () => {
    expect(MAIN).toContain('salleAtelier = structuredClone(lvl)')
    expect(MAIN).toMatch(/partageDepuisAtelier\(editor, salleAtelier/)
  })

  it('« Nouvelle salle » range la précédente au lieu de la perdre', () => {
    const h = ED.slice(ED.indexOf("this.el('ed-new').addEventListener"))
    const bloc = h.slice(0, h.indexOf('    })\n'))
    expect(bloc).toMatch(/if \(this\.joueur\) \{\s*this\.persist\(\)\s*this\.cleSalle = nouvelleCleSalle\(\)/)
    // la question « sera perdue » ne se pose plus qu'au concepteur
    expect(bloc).not.toContain('Celle en cours sera perdue')
  })
})
