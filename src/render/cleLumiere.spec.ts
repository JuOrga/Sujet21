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
})
