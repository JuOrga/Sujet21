import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DECAL_NOMS, DECAL_SORTES } from './editor'
import { parseLevel } from '../game/levelIO'

// LA PALETTE DES DÉCORS et LA LECTURE D'UN TABLEAU tiennent chacune leur
// liste. Une sorte proposée par l'éditeur mais inconnue de la lecture se
// pose, s'enregistre… et s'efface au rechargement, sans un mot ; l'inverse
// laisse une pièce lisible que personne ne peut poser.
describe('les décalques que l’éditeur propose', () => {
  it('les cinq pièces du hub sont dans la palette, nommées', () => {
    expect(DECAL_SORTES).toEqual(
      expect.arrayContaining([
        'hub-eclairage',
        'hub-table-depart',
        'hub-mur-records',
        'hub-bac-sable',
        'hub-distillateur',
      ]),
    )
    expect(DECAL_NOMS['hub-eclairage']).toBe('Hub — réseau d’éclairage')
    expect(DECAL_NOMS['hub-table-depart']).toBe('Hub — table de départ')
    expect(DECAL_NOMS['hub-mur-records']).toBe('Hub — mur des records')
    expect(DECAL_NOMS['hub-bac-sable']).toBe('Hub — bac d’essai')
    expect(DECAL_NOMS['hub-distillateur']).toBe('Hub — distillateur')
  })

  it('les boutons du groupe Décor ne nomment que des sortes connues — dont le hub', () => {
    // un bouton dont la sorte est inconnue pose… des tuyaux (repli de
    // l'outil), sans un mot : la pièce attendue ne vient jamais
    const html = readFileSync('index.html', 'utf8')
    const boutons = [...html.matchAll(/data-tool="decal:([^"]+)"/g)].map((m) => m[1])
    for (const b of boutons) expect(DECAL_SORTES, b).toContain(b)
    expect(boutons.some((b) => b.startsWith('hub-'))).toBe(true)
  })

  it('toute sorte de la palette survit à la relecture d’un tableau', () => {
    const { level, rejets } = parseLevel({
      name: 'Palette',
      bounds: { minX: -1000, minY: -600, maxX: 1000, maxY: 600 },
      spawn: { x: -800, y: 0, n: 60 },
      exit: { minX: 900, minY: -60, maxX: 980, maxY: 60 },
      boxes: [{ minX: 0, minY: -600, maxX: 60, maxY: -400, material: 0 }],
      decals: DECAL_SORTES.map((kind, i) => ({ x: i * 10, y: 0, w: 100, h: 100, kind })),
    })
    expect(rejets).toEqual([])
    expect(level!.decals!.map((d) => d.kind)).toEqual(DECAL_SORTES)
  })
})
