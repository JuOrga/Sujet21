import { describe, expect, it, vi } from 'vitest'
import { CONTREPARTIES, INSTRUMENTS } from './instruments'
import {
  ICONES_CEREMONIE,
  ICONES_INSTRUMENTS_COLONNES,
  ICONES_INSTRUMENTS_RANGEES,
  ORDRE_INSTRUMENTS,
  caseInstrument,
  dessineIconeInstrument,
  iconeCeremonieHTML,
  iconeInstrumentHTML,
} from './iconesStation'

describe('iconesStation', () => {
  it('donne une case à chaque instrument et à chaque contrepartie, une seule fois', () => {
    const ids = [...INSTRUMENTS, ...CONTREPARTIES].map((d) => d.id)
    expect(new Set(ORDRE_INSTRUMENTS).size).toBe(ORDRE_INSTRUMENTS.length)
    for (const id of ids) expect(caseInstrument(id), id).not.toBeNull()
    expect(ORDRE_INSTRUMENTS.length).toBeLessThanOrEqual(ICONES_INSTRUMENTS_COLONNES * ICONES_INSTRUMENTS_RANGEES)
  })
  it('garde l’ordre du catalogue au 13/11 : INSTRUMENTS puis CONTREPARTIES', () => {
    expect([...ORDRE_INSTRUMENTS]).toEqual([...INSTRUMENTS, ...CONTREPARTIES].map((d) => d.id))
  })
  it('rend l’émoji d’un instrument sans case — jamais un carré vide', () => {
    const html = iconeInstrumentHTML({ id: 'perso-x', icone: '🦑', nom: 'Seiche' })
    expect(html).toContain('🦑')
    expect(html).not.toContain('ico-instrument')
  })
  it('rend le nom quand l’instrument sans case n’a pas d’émoji non plus', () => {
    expect(iconeInstrumentHTML({ id: 'perso-y', icone: '', nom: 'Seiche' })).toContain('Seiche')
  })
  it('échappe le texte tapé par le concepteur', () => {
    const html = iconeInstrumentHTML({ id: 'perso-z', icone: '<b>', nom: 'a"b' })
    expect(html).not.toContain('<b>')
    expect(html).toContain('&quot;')
  })
  it('rend la case d’un instrument connu, placée par --ic-x / --ic-y, sans émoji', () => {
    const d = INSTRUMENTS[9]
    const html = iconeInstrumentHTML(d)
    expect(html).toContain('ico-instrument')
    expect(html).toContain(`--ic-x:${9 % 8}`)
    expect(html).toContain(`--ic-y:${Math.floor(9 / 8)}`)
    expect(html).not.toContain(d.icone)
    expect(html).toContain('aria-hidden')
    expect(html).toContain(`title="${d.nom}"`)
  })
  it('tient les 26 icônes de cérémonie dans la planche 7 × 4', () => {
    expect(ICONES_CEREMONIE.length).toBe(26)
    expect(iconeCeremonieHTML('cibles')).toContain('--ic-x:2') // case 23 : colonne 2, rangée 3
    expect(iconeCeremonieHTML('cibles')).toContain('--ic-y:3')
    expect(iconeCeremonieHTML('orbe', 'Orbe')).toContain('title="Orbe"')
  })
  it('contient les sept clés de gain de recolte.ts', () => {
    for (const c of ['livre', 'condensat', 'memoire', 'maitrise', 'instruments', 'tirage', 'orbe'])
      expect(ICONES_CEREMONIE as readonly string[], c).toContain(c)
  })
  it('ne dessine rien au canvas tant que la planche n’est pas prête', () => {
    const ctx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D
    expect(dessineIconeInstrument(ctx, null, INSTRUMENTS[0].id, 0, 0, 32)).toBe(false)
    expect(ctx.drawImage).not.toHaveBeenCalled()
  })
  it('ne dessine rien pour un instrument sans case, même planche prête', () => {
    const ctx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D
    const img = { complete: true, naturalWidth: 2048, naturalHeight: 1024 } as HTMLImageElement
    expect(dessineIconeInstrument(ctx, img, 'perso-x', 0, 0, 32)).toBe(false)
    expect(dessineIconeInstrument(ctx, img, INSTRUMENTS[9].id, 5, 6, 32)).toBe(true)
    expect(ctx.drawImage).toHaveBeenCalledWith(img, 256, 256, 256, 256, 5, 6, 32, 32)
  })
})
