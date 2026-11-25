// MES SALLES (sallesAtelier.ts) : retrouver ses salles dans l'atelier — le
// concepteur, 24/11 : « il faut pouvoir retrouver ces tableaux dans
// l'éditeur ». Et le câblage qui fait qu'une publication n'est plus jamais
// perdue en silence (main.ts, lu dans la source).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  SALLES_MAX,
  SALLES_OCTETS_MAX,
  empreinteSalle,
  etatDeSalle,
  lisSalles,
  memeVersion,
  messageRetraits,
  nouvelleCleSalle,
  poidsSalles,
  rangeSalle,
  retireSalle,
  retraitsPrevus,
  salleDeLaCreation,
  type SalleAtelier,
} from './sallesAtelier'

/** Ranger, sans regarder ce qui sort. */
const range = (l: readonly SalleAtelier[], x: SalleAtelier): SalleAtelier[] => rangeSalle(l, x).liste

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
    let l = range([], s('a', '2026-11-20'))
    l = range(l, s('b', '2026-11-22'))
    l = range(l, s('a', '2026-11-24', { nom: 'A retouchée' }))
    expect(l.map((x) => x.cle)).toEqual(['a', 'b'])
    expect(l[0].nom).toBe('A retouchée')
  })

  it(`au-delà de ${SALLES_MAX}, un BROUILLON part d'abord — et on dit lequel`, () => {
    let l: SalleAtelier[] = []
    // la plus ancienne est publiée : elle doit rester
    l = range(l, s('publiee', '2026-01-01', { creationId: 'abcdefgh' }))
    l = range(l, s('vieux-brouillon', '2026-01-02'))
    for (let i = 0; i < SALLES_MAX - 2; i++) l = range(l, s(`b${i}`, `2026-02-${String(i % 28 + 1).padStart(2, '0')}T${String(i).padStart(4, '0')}`))
    expect(l).toHaveLength(SALLES_MAX)
    // prévenu AVANT : la nouvelle ferait sortir le vieux brouillon
    expect(retraitsPrevus(l, s('neuve', '2026-12-01')).map((x) => x.cle)).toEqual(['vieux-brouillon'])
    const r = rangeSalle(l, s('neuve', '2026-12-01'))
    expect(r.liste).toHaveLength(SALLES_MAX)
    expect(r.liste.some((x) => x.cle === 'publiee')).toBe(true)
    expect(r.retirees.map((x) => x.cle)).toEqual(['vieux-brouillon'])
    expect(r.liste[0].cle).toBe('neuve')
  })

  it('toutes publiées, la liste ne grandit plus sans fin : la plus ancienne publiée sort', () => {
    // le trou d'avant : « toutes publiées : on garde tout », sans limite
    let l: SalleAtelier[] = []
    for (let i = 0; i < SALLES_MAX + 5; i++) {
      l = range(l, s(`p${String(i).padStart(3, '0')}`, `2026-03-01T${String(i).padStart(4, '0')}`, { creationId: `c${i}` }))
    }
    expect(l).toHaveLength(SALLES_MAX)
    expect(l.some((x) => x.cle === 'p000')).toBe(false)
    expect(messageRetraits([s('p000', '1', { creationId: 'c0' })])).toContain('CRÉATIONS')
  })

  it(`le POIDS est borné (${SALLES_OCTETS_MAX} signes) : de grosses salles ne remplissent pas le coffre`, () => {
    // des salles au plafond de publication (24 Ko), publiées ou non
    const grosse = (cle: string, majLe: string, publiee: boolean): SalleAtelier =>
      s(cle, majLe, { salle: `{"name":"${cle}","pad":"${'x'.repeat(24 * 1024)}"}`, creationId: publiee ? `c-${cle}` : '' })
    let l: SalleAtelier[] = []
    const sorties: string[] = []
    for (let i = 0; i < SALLES_MAX; i++) {
      const r = rangeSalle(l, grosse(`g${String(i).padStart(2, '0')}`, `2026-04-01T${String(i).padStart(4, '0')}`, i % 3 === 0))
      l = r.liste
      sorties.push(...r.retirees.map((x) => x.cle))
      expect(poidsSalles(l)).toBeLessThanOrEqual(SALLES_OCTETS_MAX)
    }
    expect(l.length).toBeLessThan(SALLES_MAX)
    expect(sorties.length).toBeGreaterThan(0)
    // les brouillons d'abord : il reste des publiées plus anciennes que
    // le plus vieux brouillon resté
    const plusVieuxBrouillon = l.filter((x) => !x.creationId).at(-1)!.majLe
    expect(l.some((x) => x.creationId && x.majLe < plusVieuxBrouillon)).toBe(true)
    // dans le coffre, la liste est échappée une seconde fois : elle tient
    // encore loin des quelques Mo d'un navigateur
    expect(JSON.stringify(JSON.stringify(l)).length).toBeLessThan(1.5 * 1024 * 1024)
  })

  it('jamais la salle qu’on range, même seule au-delà du budget', () => {
    const seule = s('enorme', '2026-05-01', { salle: 'x'.repeat(SALLES_OCTETS_MAX + 10) })
    const r = rangeSalle([], seule)
    expect(r.liste.map((x) => x.cle)).toEqual(['enorme'])
    expect(r.retirees).toEqual([])
  })

  it('la version en ligne se garde en EMPREINTE, plus en seconde copie', () => {
    const v = '{"name":"a","boxes":[]}'
    expect(empreinteSalle(v)).toMatch(/^e:[0-9a-z]+$/)
    expect(empreinteSalle(v)).toBe(empreinteSalle(v))
    expect(empreinteSalle(v)).not.toBe(empreinteSalle('{"name":"b","boxes":[]}'))
    expect(memeVersion(empreinteSalle(v), v)).toBe(true)
    expect(memeVersion(v, v)).toBe(true) // une méta d'avant
    expect(memeVersion('', v)).toBe(false)
    const r = rangeSalle([], s('a', '1', { creationId: 'c', salle: v, base: v }))
    expect(r.liste[0].base).toBe(empreinteSalle(v))
  })

  it('une liste d’avant (la salle en ligne copiée entière) s’allège à la lecture', () => {
    const v = '{"name":"a"}'
    const [lue] = lisSalles(JSON.stringify([s('a', '1', { creationId: 'c', salle: v, base: v })]))
    expect(lue.base).toBe(empreinteSalle(v))
    expect(etatDeSalle(lue)).toBe('publiee')
  })

  it('le message, avant et après', () => {
    expect(messageRetraits([])).toBe('')
    expect(messageRetraits([s('a', '1')], true)).toContain('« a » en sortirait')
    expect(messageRetraits([s('a', '1'), s('b', '1')])).toContain('en sont sorties')
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
    expect(bloc).toMatch(/if \(this\.joueur\) \{\s*this\.persist\(\)/)
    // une liste pleine : on PRÉVIENT avant de faire sortir une salle
    const prevenir = bloc.indexOf('this.accepteRetraits(')
    expect(prevenir).toBeGreaterThan(0)
    expect(bloc.indexOf('this.cleSalle = cle')).toBeGreaterThan(prevenir)
    // la question « sera perdue » ne se pose plus qu'au concepteur
    expect(bloc).not.toContain('Celle en cours sera perdue')
  })

  it('la version publiée se note en empreinte, et ce qui sort se dit dans l’encart', () => {
    const note = ED.slice(ED.indexOf('noteCreation(id: string'), ED.indexOf('noteCreation(id: string') + 600)
    expect(note).toContain('this.base = empreinteSalle(serializeLevel(publiee))')
    expect(ED).toContain('this.avisRangement = messageRetraits(retirees)')
  })
})
