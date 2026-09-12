import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { creeGardeImage, decritErreur } from './gardeBoucle'

describe('la garde de la boucle d’images', () => {
  it('laisse passer une image saine sans rien signaler', () => {
    const signaux: string[] = []
    const image = creeGardeImage(
      () => {},
      (p) => signaux.push(p.message),
    )
    image(16)
    image(32)
    expect(signaux).toEqual([])
  })

  it('attrape l’exception et rend la main : la boucle peut se réarmer', () => {
    const signaux: string[] = []
    const image = creeGardeImage(
      () => {
        throw new TypeError('Cannot read properties of undefined')
      },
      (p) => signaux.push(p.message),
    )
    expect(() => image(16)).not.toThrow()
    expect(signaux).toEqual(['TypeError: Cannot read properties of undefined'])
  })

  it('ne signale qu’une fois la même panne qui se répète à chaque image, et la compte', () => {
    const pannes: { message: string; occurrences: number }[] = []
    const image = creeGardeImage(
      () => {
        throw new Error('la même')
      },
      (p) => pannes.push(p),
    )
    for (let i = 0; i < 60; i++) image(i * 16)
    expect(pannes).toHaveLength(1)
    expect(pannes[0].occurrences).toBe(60)
  })

  it('signale de nouveau une panne différente, et une panne revenue après une image saine', () => {
    let quoi: string | null = 'A'
    const signaux: string[] = []
    const image = creeGardeImage(
      () => {
        if (quoi) throw new Error(quoi)
      },
      (p) => signaux.push(p.message),
    )
    image(0)
    quoi = 'B'
    image(16)
    quoi = null // une image saine
    image(32)
    quoi = 'B' // la même qu'avant, mais après une accalmie : incident neuf
    image(48)
    expect(signaux).toEqual(['Error: A', 'Error: B', 'Error: B'])
  })

  it('une image SAUTÉE (le plafond de cadence) ne referme pas l’épisode', () => {
    // à 120 Hz plafonné à 60, une image sur deux ne fait rien : sans cette
    // règle, la panne suivante passait pour neuve et se resignalait sans fin
    let n = 0
    const signaux: string[] = []
    const image = creeGardeImage(
      () => {
        n++
        if (n % 2 === 0) return false // sautée
        throw new Error('à chaque image rendue')
      },
      (p) => signaux.push(p.message),
    )
    for (let i = 0; i < 10; i++) image(i * 8)
    expect(signaux).toEqual(['Error: à chaque image rendue'])
  })

  it('garde la pile d’appels et décrit aussi ce qui n’est pas une Error', () => {
    const pannes: { pile: string }[] = []
    const image = creeGardeImage(
      () => {
        throw new RangeError('hors bornes')
      },
      (p) => pannes.push(p),
    )
    image(0)
    expect(pannes[0].pile).toContain('RangeError')
    expect(decritErreur('texte nu')).toBe('texte nu')
    expect(decritErreur(42)).toBe('42')
  })

  it('survit à une signalisation qui plante elle-même', () => {
    const image = creeGardeImage(
      () => {
        throw new Error('panne')
      },
      () => {
        throw new Error('la bannière manque')
      },
    )
    expect(() => image(0)).not.toThrow()
  })
})

// LE BRANCHEMENT : la garde ne sert que si la boucle de main.ts passe par
// elle et que la bannière existe dans la coque. Rien ne relie les deux qu'un
// nom en toutes lettres — un renommage donnerait une boucle sans filet, sans
// erreur et sans test rouge. Sans ce test, la garde retirée ne se verrait pas.
describe('la boucle de main.ts passe par la garde', () => {
  const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')
  const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')

  it('enveloppe le corps de l’image et réarme depuis l’enveloppe', () => {
    expect(MAIN).toContain('creeGardeImage(')
    // deux réarmements et pas un de plus : celui de l'enveloppe (après
    // chaque image, réussie ou non) et le coup d'envoi — un réarmement
    // DANS le corps serait sauté par une exception, et la chaîne casserait
    expect(MAIN.match(/requestAnimationFrame\(frame\)/g)?.length).toBe(2)
  })

  it('a sa bannière dans index.html', () => {
    expect(HTML).toContain('id="panne-boucle"')
  })
})
