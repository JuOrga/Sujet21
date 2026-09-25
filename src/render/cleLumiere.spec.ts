import { describe, expect, it } from 'vitest'
import { MAT_FROID, type ObstacleBox } from '../game/level'
import { cleBoitesLumiere } from './renderer'

describe('la clé de cuisson de la lumière', () => {
  // L'ombre d'une conduite suit son tuyau, couché selon le SENS choisi à
  // l'éditeur : sans le sens dans la clé, basculer « Auto » → « Horizontal »
  // dessinait le tuyau couché sous une ombre restée debout.
  it('change quand seul le sens du tuyau change', () => {
    const plaque: ObstacleBox = { minX: 0, minY: 0, maxX: 200, maxY: 200, material: MAT_FROID }
    const auto = cleBoitesLumiere([plaque], 1)
    const horiz = cleBoitesLumiere([{ ...plaque, sens: 1 }], 1)
    const vert = cleBoitesLumiere([{ ...plaque, sens: 2 }], 1)
    expect(horiz).not.toBe(auto)
    expect(vert).not.toBe(horiz)
  })

  // La clé est aussi celle des bouts des conduites : les bouts d'un ARC
  // (p2) et la COUPE changent sa surface — donc ce que touche le bout d'une
  // conduite voisine — sans rien changer d'autre.
  it('change quand seuls les bouts d’un arc ou sa coupe changent', () => {
    const arc: ObstacleBox = { minX: 0, minY: 0, maxX: 200, maxY: 200, material: 0, forme: 5 }
    const rond = cleBoitesLumiere([arc], 1)
    expect(cleBoitesLumiere([{ ...arc, p2: 2 }], 1)).not.toBe(rond)
    const coupee = { ...arc, coupe: { x: 100, y: 100, nx: 1, ny: 0 } } as ObstacleBox
    expect(cleBoitesLumiere([coupee], 1)).not.toBe(rond)
  })
})
