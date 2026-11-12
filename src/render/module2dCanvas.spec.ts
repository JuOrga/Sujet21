// LE PEINTRE DU MODULE EN 2D : ce qui s'en vérifie sans toile — les thèmes
// des biomes, la reteinte des pièces, et les fichiers qu'il réclame.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import carte from '../game/carteStation.json'
import { PIECES_MODULE2D, THEMES, teintePixels, themeDuBiome } from './module2dCanvas'

describe('module 2D — une teinte par biome', () => {
  it('chaque biome de la carte a son thème : aucun module ne retombe sur l’acier neutre', () => {
    for (const biome of Object.keys(carte.biomes)) expect(THEMES[biome], biome).toBeDefined()
    for (const m of carte.modules) if (m.biome) expect(themeDuBiome(m.biome).nom).toBe(m.biome)
  })

  it('un module sans biome (un outil, la mini-carte d’attente) prend l’acier et le cyan de la charte', () => {
    expect(themeDuBiome('').nom).toBe('neutre')
    expect(themeDuBiome('inconnu').lueur).toBe('99,183,230')
  })

  it('la serre garde ses pièces telles quelles : le vert n’appartient qu’à elle', () => {
    const px = [40, 120, 50, 255, 30, 34, 40, 255]
    const avant = [...px]
    teintePixels(px, THEMES.tempere)
    expect(px).toEqual(avant)
  })

  it('ailleurs, le vert d’un vitrage prend la couleur du biome, et son éclat reste', () => {
    for (const [biome, dominant] of [['chaud', 0], ['cryo', 2], ['observatoire', 2]] as const) {
      const px = [40, 150, 50, 255]
      teintePixels(px, THEMES[biome])
      const [r, g, b] = px
      // le canal du biome domine désormais, et le vert ne domine plus
      expect(Math.max(r, g, b), biome).toBe(px[dominant])
      expect(g, biome).toBeLessThan(px[dominant])
      // le vitrage ne s'éteint pas en changeant de couleur
      expect(px[dominant], biome).toBeGreaterThanOrEqual(150)
      expect(px[3]).toBe(255)
    }
  })

  it('la tôle grise garde son gris, à la dominante du biome près ; rien ne déborde', () => {
    for (const biome of Object.keys(THEMES)) {
      const px = [30, 34, 40, 200, 250, 250, 250, 255]
      teintePixels(px, THEMES[biome])
      const [tr, tg, tb] = THEMES[biome].tole
      expect(px[0]).toBeCloseTo(30 * tr, 6)
      expect(px[1]).toBeCloseTo(34 * tg, 6)
      expect(px[2]).toBeCloseTo(40 * tb, 6)
      expect(px[3]).toBe(200) // l'alpha n'est jamais touché
      for (const v of px.slice(4, 7)) expect(v).toBeLessThanOrEqual(255)
    }
    // la chaufferie tire au roux, le cryo au bleu
    expect(THEMES.chaud.tole[0]).toBeGreaterThan(THEMES.chaud.tole[2])
    expect(THEMES.cryo.tole[2]).toBeGreaterThan(THEMES.cryo.tole[0])
  })

  it('le fondu : un vert à peine dominant (une coulure de mousse) ne bascule qu’en partie', () => {
    const mousse = [40, 50, 40, 255]
    const feuille = [40, 150, 40, 255]
    teintePixels(mousse, THEMES.chaud)
    teintePixels(feuille, THEMES.chaud)
    // la feuille est franchement rousse, la mousse à mi-chemin
    expect(feuille[0] / feuille[1]).toBeGreaterThan(mousse[0] / mousse[1])
    expect(mousse[0]).toBeGreaterThan(40)
  })
})

describe('module 2D — les pièces livrées', () => {
  it('chaque pièce que le peintre réclame existe dans public/assets : une seule manquante laissait le module invisible', () => {
    for (const nom of PIECES_MODULE2D) expect(existsSync(join(process.cwd(), 'public/assets', `coque2d-${nom}.webp`)), nom).toBe(true)
  })

  it('aucune pièce réclamée deux fois', () => {
    expect(new Set(PIECES_MODULE2D).size).toBe(PIECES_MODULE2D.length)
  })
})
