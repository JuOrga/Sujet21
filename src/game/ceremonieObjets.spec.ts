import { describe, expect, it } from 'vitest'
import { OBJETS, ORDRE_SCEAUX, cuveHTML, sceauHTML } from './ceremonieObjets'

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
