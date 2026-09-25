import { describe, expect, it } from 'vitest'
import { Renderer } from './renderer'

// LA TOILE EST OPAQUE. Transparente, elle laissait voir un calque de ciel
// HTML derrière elle, et le compositeur fondait les deux, en natif, à chaque
// image : sur le Steam Deck, 20 im/s au lieu de près de 60. Le ciel se peint
// dans la toile (uCielMode 2, la plaque).
describe('la toile WebGL', () => {
  it('est demandée opaque', () => {
    let options: WebGLContextAttributes | undefined
    const toile = {
      getContext: (_type: string, o: WebGLContextAttributes) => {
        options = o
        return null // « WebGL2 indisponible » : le constructeur s'arrête là
      },
      addEventListener: () => {},
    } as unknown as HTMLCanvasElement
    expect(() => new Renderer(toile, 16)).toThrow()
    expect(options?.alpha).toBe(false)
  })
})
