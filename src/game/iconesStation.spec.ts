import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { CONTREPARTIES, INSTRUMENTS } from './instruments'
import {
  ICONES_CEREMONIE,
  ICONES_INSTRUMENTS_COLONNES,
  ICONES_INSTRUMENTS_RANGEES,
  INSTRUMENTS_SANS_CASE,
  ORDRE_INSTRUMENTS,
  caseInstrument,
  dessineIconeCeremonie,
  dessineIconeInstrument,
  iconeCeremonieHTML,
  iconeInstrumentHTML,
} from './iconesStation'

describe('iconesStation', () => {
  it('donne une case à chaque instrument et à chaque contrepartie, une seule fois', () => {
    const ids = [...INSTRUMENTS, ...CONTREPARTIES].map((d) => d.id).filter((id) => !INSTRUMENTS_SANS_CASE.includes(id))
    expect(new Set(ORDRE_INSTRUMENTS).size).toBe(ORDRE_INSTRUMENTS.length)
    for (const id of ids) expect(caseInstrument(id), id).not.toBeNull()
    expect(ORDRE_INSTRUMENTS.length).toBeLessThanOrEqual(ICONES_INSTRUMENTS_COLONNES * ICONES_INSTRUMENTS_RANGEES)
  })
  // La planche est un fichier : ses 31 premières cases ont été dessinées le
  // 13/11 dans l'ordre du catalogue d'alors ; ce qui vient après s'ajoute À
  // LA SUITE, même quand la carte s'insère au MILIEU du catalogue (la Tuyère
  // et le Surpresseur, cases 32 et 33, y sont entre le plastron et le
  // détendeur). Dériver l'ordre du catalogue décalerait tous les dessins.
  const CASES_DU_13_11 = 31
  const catalogue = [...INSTRUMENTS, ...CONTREPARTIES].map((d) => d.id)
  it('les 31 premières cases sont le catalogue du 13/11, dans son ordre', () => {
    const venuesApres = ORDRE_INSTRUMENTS.slice(CASES_DU_13_11)
    expect([...ORDRE_INSTRUMENTS.slice(0, CASES_DU_13_11)]).toEqual(
      catalogue.filter((id) => !venuesApres.includes(id) && !INSTRUMENTS_SANS_CASE.includes(id)),
    )
  })
  it('les cartes venues après s’ajoutent à la suite, sans déplacer un dessin', () => {
    const anciennes = ORDRE_INSTRUMENTS.slice(0, CASES_DU_13_11)
    for (const id of ORDRE_INSTRUMENTS.slice(CASES_DU_13_11)) {
      // une carte du catalogue, posée après la dernière case du 13/11
      expect(catalogue, id).toContain(id)
      expect(caseInstrument(id), id).toBeGreaterThanOrEqual(CASES_DU_13_11)
    }
    // insérée au milieu du catalogue, elle n'a pas poussé les suivantes :
    // le détendeur garde la case où il a été dessiné
    expect(catalogue.indexOf('tuyere')).toBeLessThan(catalogue.indexOf('detendeur'))
    expect(caseInstrument('tuyere')).toBe(CASES_DU_13_11)
    expect(caseInstrument('surpresseur')).toBe(CASES_DU_13_11 + 1)
    expect(caseInstrument('detendeur')).toBe(anciennes.indexOf('detendeur'))
    expect(caseInstrument('detendeur')).toBe(8)
  })
  it('une carte en attente de dessin existe, n’a pas de case, et retombe sur son emoji', () => {
    for (const id of INSTRUMENTS_SANS_CASE) {
      const d = [...INSTRUMENTS, ...CONTREPARTIES].find((x) => x.id === id)
      expect(d, id).toBeDefined()
      expect(caseInstrument(id), id).toBeNull()
      expect(iconeInstrumentHTML(d!)).toContain(d!.icone)
    }
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
    // la case 9 de la PLANCHE, pas la dixième carte du catalogue : une carte
    // insérée au milieu du catalogue ne déplace aucun dessin
    const d = INSTRUMENTS.find((x) => x.id === ORDRE_INSTRUMENTS[9])!
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
    const img = { complete: true, naturalWidth: 2048, naturalHeight: 1280 } as HTMLImageElement
    expect(dessineIconeInstrument(ctx, img, 'perso-x', 0, 0, 32)).toBe(false)
    expect(dessineIconeInstrument(ctx, img, ORDRE_INSTRUMENTS[9], 5, 6, 32)).toBe(true)
    expect(ctx.drawImage).toHaveBeenCalledWith(img, 256, 256, 256, 256, 5, 6, 32, 32)
  })
  // le canvas de l'Économat dessine l'échantillon de secours (la vie) par la
  // planche de la cérémonie : une monnaie, un seul dessin, au canvas aussi
  it('dessine une icône de cérémonie au canvas quand la planche est prête, et seulement alors', () => {
    const ctx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D
    expect(dessineIconeCeremonie(ctx, null, 'secours', 0, 0, 26)).toBe(false)
    const enRoute = { complete: false, naturalWidth: 0, naturalHeight: 0 } as HTMLImageElement
    expect(dessineIconeCeremonie(ctx, enRoute, 'secours', 0, 0, 26)).toBe(false)
    expect(ctx.drawImage).not.toHaveBeenCalled()
    const img = { complete: true, naturalWidth: 3584, naturalHeight: 2048 } as HTMLImageElement
    // « secours » : case 10, colonne 3, rangée 1 — des cases de 512²
    expect(dessineIconeCeremonie(ctx, img, 'secours', 4, 7, 26)).toBe(true)
    expect(ctx.drawImage).toHaveBeenCalledWith(img, 1536, 512, 512, 512, 4, 7, 26, 26)
  })
})

describe('les planches de la station dans index.html', () => {
  const css = readFileSync(resolve(__dirname, '../../index.html'), 'utf8')
  const regle = (sel: string): string => {
    // la règle PROPRE à la classe : le sélecteur seul en tête de ligne. Ni la
    // fin du groupe « .ico-ceremonie, .ico-instrument, .ico-sceau { », ni une
    // règle contextuelle posée plus bas (« .hud-chip .ico-ceremonie { »), ni
    // un commentaire qui cite la classe ne doivent passer pour elle
    const echappe = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const trouvees = [...css.matchAll(new RegExp(`^[ \\t]*${echappe} \\{`, 'gm'))]
    expect(trouvees.length, sel).toBeGreaterThan(0)
    const i = trouvees[trouvees.length - 1].index!
    return css.slice(i, css.indexOf('}', i))
  }
  it('peint la planche AU-DESSUS de l’alvéole, jamais l’inverse', () => {
    for (const sel of ['.ico-ceremonie', '.ico-instrument', '.ico-sceau']) {
      const bg = /background-image:\s*([^;]*);/.exec(regle(sel))?.[1] ?? ''
      // la première couche d'un background est la plus haute
      expect(bg.startsWith("url('/assets/"), sel).toBe(true)
      expect(bg.indexOf('data:image/svg'), sel).toBeGreaterThan(bg.indexOf('.webp'))
      // une alvéole en pseudo-élément à z-index négatif voilerait l'image
      expect(css, sel).not.toContain(`${sel}::before`)
    }
  })
})
