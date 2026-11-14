// LES SURFACES QUE LES LAMPES SCULPTENT (chantier « volume des parois », 14/11) :
// le mur, la seconde paroi, les deux matières et l'atlas des habillages sont
// rendus sous une lumière NEUTRE, et leur relief voyage dans la couche alpha
// de l'image (docs/assets-ia.md §37) — aucune unité de texture n'était libre.
// Une surface relivrée opaque perdrait son relief SANS erreur : le shader
// retombe alors sur un dessus plat, et rien ne dirait que la lumière peinte
// a disparu avec lui. Cette garde lit l'en-tête de chaque fichier livré.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** l'en-tête WebP : la taille, et si une couche alpha est déclarée (VP8X,
 *  bit 0x10 des drapeaux ; un VP8 simple ou un VP8L sans ce bit n'en a pas) */
function enteteWebp(fichier: string): { l: number; h: number; alpha: boolean } {
  const o = readFileSync(join(process.cwd(), 'public/assets', fichier))
  expect(o.toString('latin1', 0, 4), fichier).toBe('RIFF')
  expect(o.toString('latin1', 8, 12), fichier).toBe('WEBP')
  const sorte = o.toString('latin1', 12, 16)
  if (sorte === 'VP8X') {
    return { l: 1 + o.readUIntLE(24, 3), h: 1 + o.readUIntLE(27, 3), alpha: (o[20] & 0x10) !== 0 }
  }
  if (sorte === 'VP8 ') return { l: o.readUInt16LE(26) & 0x3fff, h: o.readUInt16LE(28) & 0x3fff, alpha: false }
  throw new Error(`${fichier} : en-tête WebP inattendu (${sorte})`)
}

// les tailles d'avant (13/11) : le shader répète chaque surface à son échelle
// (230, 520, 170, 210 unités) et lit l'atlas par cases de 1024
const SURFACES: Record<string, [number, number]> = {
  'wall.webp': [1024, 1024],
  'wall-a.webp': [1024, 1024],
  'phile.webp': [1024, 1024],
  'phobe.webp': [1024, 1024],
}

describe('surfaces en relief — le relief dans l’alpha', () => {
  for (const [fichier, [l, h]] of Object.entries(SURFACES)) {
    it(`${fichier} porte une couche alpha (VP8X avec alpha), en ${l}×${h}`, () => {
      expect(enteteWebp(fichier)).toEqual({ l, h, alpha: true })
    })
  }
})
