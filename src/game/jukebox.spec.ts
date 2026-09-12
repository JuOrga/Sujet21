// Le contrat du lecteur : un ordre tiré une fois puis fixe, une piste
// chargée dès la création (la musique de l'accueil), suivant et précédent
// qui rebouclent, l'arrêt qui tait sans décharger, et une liste de pistes
// qui ne cite que des fichiers dont le nom est sûr.
import { describe, expect, it } from 'vitest'
import { Jukebox, PISTES_ECOUTE, type PisteEcoute } from './jukebox'

function pistes(n: number): PisteEcoute[] {
  return Array.from({ length: n }, (_, i) => ({
    fichier: `p${i}`,
    titre: `Piste ${i}`,
    famille: 'lit' as const,
    enJeu: i === 0,
  }))
}

/** Un générateur déterministe (LCG) : la même graine, le même ordre. */
function alea(graine: number): () => number {
  let s = graine >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

describe('L’écoute — le mini-lecteur des musiques', () => {
  it('l’ordre est une permutation de toutes les pistes, et il dépend du tirage', () => {
    const a = new Jukebox(pistes(11), alea(1))
    const b = new Jukebox(pistes(11), alea(2))
    expect([...a.sequence].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect([...b.sequence].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(a.sequence).not.toEqual(b.sequence)
    // la même graine redonne le même ordre : le tirage ne dépend que d'`alea`
    expect(new Jukebox(pistes(11), alea(1)).sequence).toEqual(a.sequence)
  })

  it('à la création, la première de l’ordre est chargée et joue ; « suivant » fait le tour sans répétition puis reboucle', () => {
    const j = new Jukebox(pistes(5), alea(7))
    expect(j.enCours()!.fichier).toBe(`p${j.sequence[0]}`)
    expect(j.enLecture).toBe(true)
    expect(j.rang()).toBe(1)
    const vus = [j.enCours()!.fichier]
    for (let i = 1; i < 5; i++) vus.push(j.suivant()!.fichier)
    expect(new Set(vus).size).toBe(5)
    expect(j.rang()).toBe(5)
    // après la dernière, on reboucle sur la première
    expect(j.suivant()!.fichier).toBe(vus[0])
    expect(j.rang()).toBe(1)
  })

  it('« précédent » rend la piste qu’on vient d’entendre, et en tête, la dernière de l’ordre', () => {
    const j = new Jukebox(pistes(4), alea(3))
    expect(j.precedent()!.fichier).toBe(`p${j.sequence[3]}`)
    expect(j.rang()).toBe(4)
    j.suivant() // retour en tête
    const a = j.enCours()!
    const b = j.suivant()!
    expect(b).not.toBe(a)
    expect(j.precedent()).toBe(a)
  })

  it('l’arrêt tait la piste sans la décharger : on peut encore la noter, et lecture la fait repartir', () => {
    const j = new Jukebox(pistes(3), alea(5))
    const p = j.suivant()!
    j.stop()
    expect(j.enLecture).toBe(false)
    expect(j.enCours()).toBe(p)
    expect(j.rang()).toBe(2)
    expect(j.joue()).toBe(p)
    expect(j.enLecture).toBe(true)
    // suivant et précédent relancent la lecture d'eux-mêmes
    j.stop()
    j.suivant()
    expect(j.enLecture).toBe(true)
    j.stop()
    j.precedent()
    expect(j.enLecture).toBe(true)
    expect(j.total).toBe(3)
  })

  it('une liste vide ne casse rien : rien de chargé, rien ne joue', () => {
    const j = new Jukebox([], alea(1))
    expect(j.enCours()).toBeNull()
    expect(j.enLecture).toBe(false)
    expect(j.rang()).toBe(0)
    expect(j.suivant()).toBeNull()
    expect(j.precedent()).toBeNull()
    expect(j.joue()).toBeNull()
  })

  it('les pistes du projet : des noms de fichier sûrs, uniques, et les six lits qui jouent en tête', () => {
    const noms = PISTES_ECOUTE.map((p) => p.fichier)
    expect(new Set(noms).size).toBe(noms.length)
    for (const n of noms) expect(n).toMatch(/^[a-z0-9-]+$/)
    expect(PISTES_ECOUTE.filter((p) => p.enJeu).map((p) => p.fichier)).toEqual([
      'accueil',
      'cuve-tiede',
      'cuve-glaciale',
      'zone-hublot',
      'zone-conduite',
      'zone-chambre',
    ])
    for (const p of PISTES_ECOUTE) expect(p.titre.length).toBeGreaterThan(3)
  })
})
