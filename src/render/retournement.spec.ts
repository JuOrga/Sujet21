import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// LES TEXTURES À L'ENDROIT. Le shader lit toutes ses images « V depuis le
// BAS » (le tube de la coque, les rangées de l'atlas des parois, les
// décalques) : il suppose un téléversement retourné. Or la spécification
// WebGL ignore UNPACK_FLIP_Y_WEBGL quand la source est un ImageBitmap — du
// 12/09 au 25/09/2026, le décodage hors du fil principal livrait donc tout
// à l'envers, sans qu'aucune erreur ne le dise. Ce test lit la source : le
// retournement doit être demandé AU BITMAP, et WebGL ne doit pas le refaire.
const source = readFileSync(fileURLToPath(new URL('./renderer.ts', import.meta.url)), 'utf8')

describe('Le téléversement des textures — à l’endroit sur tous les chemins', () => {
  it('le bitmap sort déjà retourné (imageOrientation)', () => {
    expect(source).toMatch(/createImageBitmap\(img, \{[^}]*imageOrientation: 'flipY'[^}]*\}\)/)
  })

  it('le bitmap n’est pas re-retourné par WebGL, l’<img> de secours l’est', () => {
    expect(source).toMatch(/envoie\(bitmap, false\)/)
    expect(source).not.toMatch(/envoie\(bitmap, true\)/)
    expect(source).toMatch(/envoie\(img, true\)/)
  })
})
