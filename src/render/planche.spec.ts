// Les planches de vues : le nombre de vues déduit des rapports, la vue du
// moment, le décalage entre pièces — et la liste livrée, lue du glob.

import { describe, expect, it } from 'vitest'
import { IPS_PLANCHE, decalageDe, planchesLivrees, vueCourante, vuesPlanche } from './planche'

describe('vuesPlanche', () => {
  it('déduit les vues du rapport entre la bande et l’image fixe', () => {
    expect(vuesPlanche(4096, 512, 1024, 1024)).toBe(8)
    expect(vuesPlanche(4096, 341, 1024, 1024)).toBe(12)
    // une pièce haute (la vanne : 1024×1536) — 8 vues de 341×512
    expect(vuesPlanche(2728, 512, 1024, 1536)).toBe(8)
    // planche.py, 10 vues réduites à 409×614 pour la vanne : 9,99 vues
    expect(vuesPlanche(4090, 614, 1024, 1536)).toBe(10)
  })

  it('refuse une bande qui ne tombe pas sur un entier, ou sans vues', () => {
    expect(vuesPlanche(3000, 512, 1024, 1024)).toBe(1) // 5,9 vues
    expect(vuesPlanche(1024, 1024, 1024, 1024)).toBe(1) // la fixe elle-même
    expect(vuesPlanche(0, 0, 1024, 1024)).toBe(1)
    expect(vuesPlanche(4096, 512, 0, 1024)).toBe(1)
  })
})

describe('vueCourante', () => {
  it('avance à la cadence et boucle', () => {
    expect(vueCourante(0, 8)).toBe(0)
    expect(vueCourante(1 / IPS_PLANCHE, 8)).toBe(1)
    expect(vueCourante(8 / IPS_PLANCHE, 8)).toBe(0)
    expect(vueCourante(9.5 / IPS_PLANCHE, 8)).toBe(1)
  })

  it('reste sur la vue 0 pour une image fixe, et tient un temps négatif', () => {
    expect(vueCourante(12.3, 1)).toBe(0)
    expect(vueCourante(-1 / IPS_PLANCHE, 8)).toBe(7)
  })

  it('décale deux pièces identiques', () => {
    const a = decalageDe(100, 200)
    const b = decalageDe(400, 200)
    expect(a).not.toBe(b)
    expect(decalageDe(100, 200)).toBe(a) // stable
    expect(vueCourante(0, 8, a)).toBe(a % 8)
  })
})

describe('planchesLivrees', () => {
  it('lit le glob sans se tromper de nom', () => {
    // aucune planche n'est livrée à ce jour — le glob est vide, et la
    // fonction le dit sans jeter ; le jour où l'une arrive, elle y sera
    const livrees = planchesLivrees()
    for (const nom of livrees) expect(nom.endsWith('-anime')).toBe(false)
  })
})
