import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { OBJETS, ORDRE_SCEAUX, cuveHTML, sceauHTML } from './ceremonieObjets'
import { ICONES_CEREMONIE_COLONNES, ICONES_CEREMONIE_RANGEES, ICONES_CEREMONIE_URL } from './iconesStation'

/** Les images que l'atelier Blender (tools/images/blender/ceremonie.py) a
 *  LIVRÉES dans public/ : chaque planche s'y ajoute le jour où elle arrive.
 *  Le CSS les charge par leur nom sans jamais se plaindre d'une absence —
 *  l'alvéole tient la place — : c'est ce test qui voit qu'une image manque. */
const LIVREES: string[] = [ICONES_CEREMONIE_URL]

/** La taille d'un WebP, lue dans son en-tête : une planche transparente porte
 *  un bloc VP8X (largeur − 1 et hauteur − 1 sur 24 bits, petit-boutiste). */
function tailleWebp(chemin: string): [number, number] {
  const b = readFileSync(chemin)
  expect(b.toString('ascii', 0, 4) + b.toString('ascii', 8, 12)).toBe('RIFFWEBP')
  expect(b.toString('ascii', 12, 16)).toBe('VP8X')
  return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1]
}

describe('les images livrées par l’atelier', () => {
  it.each(LIVREES)('livre %s', (u) => expect(existsSync('public' + u)).toBe(true))
  it('découpe la planche de cérémonie en cases de 512², à la grille du contrat', () => {
    expect(tailleWebp('public' + ICONES_CEREMONIE_URL)).toEqual([ICONES_CEREMONIE_COLONNES * 512, ICONES_CEREMONIE_RANGEES * 512])
  })
})

describe('ceremonieObjets', () => {
  it('range les sceaux dans l’ordre des rangs, le module en dernier', () => {
    expect(ORDRE_SCEAUX).toEqual(['S', 'A', 'B', 'C', 'D', 'module'])
    expect(sceauHTML('module')).toContain('--ic-x:2')
    expect(sceauHTML('module')).toContain('--ic-y:1')
  })
  it('garde chaque fenêtre de liquide dans son image', () => {
    for (const [nom, o] of Object.entries(OBJETS)) {
      const f = o.liquide
      expect(f.x, nom).toBeGreaterThanOrEqual(0)
      expect(f.y, nom).toBeGreaterThanOrEqual(0)
      expect(f.x + f.l, nom).toBeLessThanOrEqual(1)
      expect(f.y + f.h, nom).toBeLessThanOrEqual(1)
    }
  })
  it('pose le liquide ENTRE le dos et le verre', () => {
    const html = cuveHTML('bonbonne', 'mb-eau')
    const iDos = html.indexOf(OBJETS.bonbonne.dos), iEau = html.indexOf('id="mb-eau"'), iVerre = html.indexOf(OBJETS.bonbonne.verre)
    expect(iDos).toBeGreaterThan(-1)
    expect(iDos).toBeLessThan(iEau)
    expect(iEau).toBeLessThan(iVerre)
  })
})
