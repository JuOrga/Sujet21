import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ETATS_CYCLE, TRANSFOS_CYCLE, type EtatCycle } from './cycle'
import {
  CLASSE_PLANCHE_CYCLE,
  CLASSE_PLANCHE_TROPHEES,
  ICONES_CYCLE,
  ICONES_CYCLE_COLONNES,
  ICONES_CYCLE_RANGEES,
  ICONES_CYCLE_URL,
  ICONES_TROPHEES_COLONNES,
  ICONES_TROPHEES_RANGEES,
  ICONES_TROPHEES_URL,
  ORDRE_TROPHEES,
  caseCycle,
  caseTrophee,
  dessineIconeCycle,
  dessineIconeTrophee,
  estIconeCycle,
  etatsEnIcones,
  glypheEtat,
  guettePlanche,
  iconeCycleHTML,
  iconeCycleSVG,
  iconeEtatHTML,
  iconeTropheeHTML,
} from './iconesPeintes'
import { TROPHEES } from './trophees'

const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')

describe('la planche du cycle — le contrat avec l’atelier', () => {
  it('range ses douze cases dans l’ordre de docs/assets-ia.md §23a', () => {
    expect([...ICONES_CYCLE]).toEqual([
      'solide', 'liquide', 'gaz', 'plasma',
      'fusion', 'liquefaction', 'solidification', 'vaporisation',
      'sublimation', 'condensation', 'ionisation', 'deionisation',
    ])
    expect(ICONES_CYCLE.length).toBe(ICONES_CYCLE_COLONNES * ICONES_CYCLE_RANGEES)
    expect(ICONES_CYCLE_URL).toBe('/assets/cycle-icones.webp')
  })

  it('donne une case à chaque état et à chaque transformation du jeu', () => {
    for (const e of Object.keys(ETATS_CYCLE)) expect(caseCycle(e), e).not.toBeNull()
    for (const t of TRANSFOS_CYCLE) expect(caseCycle(t.id), t.id).not.toBeNull()
    expect(caseCycle('vaporisation')).toBe(7)
    expect(caseCycle('deionisation')).toBe(11)
  })

  it('reconnaît un id de transformation venu des données', () => {
    expect(estIconeCycle('sublimation')).toBe(true)
    expect(estIconeCycle('teleportation')).toBe(false)
  })

  it('ne répond pas pour un nom hérité d’Object', () => {
    expect(caseCycle('toString')).toBeNull()
    expect(caseTrophee('constructor')).toBeNull()
  })
})

describe('la planche des trophées — le contrat avec l’atelier', () => {
  it('suit l’ordre de trophees.ts, une case par trophée', () => {
    expect([...ORDRE_TROPHEES]).toEqual(TROPHEES.map((t) => t.id))
    expect(ORDRE_TROPHEES.length).toBe(ICONES_TROPHEES_COLONNES * ICONES_TROPHEES_RANGEES)
    expect(ICONES_TROPHEES_URL).toBe('/assets/trophees-icones.webp')
    expect(caseTrophee('integrale')).toBe(6)
  })
})

describe('en HTML : la case, et l’emoji tant que la planche manque', () => {
  it('place la case par --ic-x / --ic-y et garde l’emoji en repli', () => {
    expect(iconeCycleHTML('gaz', '💨')).toBe(
      '<i class="ico-cycle" style="--ic-x:2;--ic-y:0" aria-hidden="true"><span class="ico-repli">💨</span></i>',
    )
    expect(iconeCycleHTML('deionisation', '')).toBe(
      '<i class="ico-cycle" style="--ic-x:3;--ic-y:2" aria-hidden="true"></i>',
    )
  })

  it('un état prend son emoji de ETATS_CYCLE', () => {
    for (const e of Object.keys(ETATS_CYCLE) as EtatCycle[])
      expect(iconeEtatHTML(e), e).toBe(iconeCycleHTML(e, ETATS_CYCLE[e].icone))
  })

  it('un trophée a sa case ; un trophée inconnu retombe sur son emoji', () => {
    expect(iconeTropheeHTML('integrale', '🛰')).toBe(
      '<i class="ico-trophee" style="--ic-x:2;--ic-y:1" aria-hidden="true"><span class="ico-repli">🛰</span></i>',
    )
    expect(iconeTropheeHTML('inconnu', '<b>')).toBe('<i>&lt;b&gt;</i>')
  })

  it('échappe le repli', () => {
    expect(iconeCycleHTML('solide', '<x>')).toContain('<span class="ico-repli">&lt;x&gt;</span>')
  })
})

describe('les glyphes d’état dans un texte de données', () => {
  it('reconnaît le glyphe de tête d’un badge, avec ou sans sélecteur de variante', () => {
    expect(glypheEtat('❄ GLACE')).toEqual({ etat: 'solide', glyphe: '❄', reste: 'GLACE' })
    expect(glypheEtat('❄️ GLACE')).toEqual({ etat: 'solide', glyphe: '❄️', reste: 'GLACE' })
    expect(glypheEtat('💨 GAZ')).toEqual({ etat: 'gaz', glyphe: '💨', reste: 'GAZ' })
    expect(glypheEtat('💧 EAU')?.etat).toBe('liquide')
    expect(glypheEtat('voie principale')).toBeNull()
  })

  it('remplace chaque glyphe d’état d’un HTML déjà échappé par son icône', () => {
    expect(etatsEnIcones('❄ glace — ouverte')).toBe(`${iconeEtatHTML('solide')} glace — ouverte`)
    expect(etatsEnIcones('a 💨 b 💧')).toBe(`a ${iconeEtatHTML('gaz')} b ${iconeEtatHTML('liquide')}`)
    expect(etatsEnIcones('rien &lt;ici&gt;')).toBe('rien &lt;ici&gt;')
  })
})

describe('en SVG : une fenêtre sur la case, l’emoji en repli', () => {
  it('découpe la case par un viewBox et pose le repli à la même place', () => {
    const s = iconeCycleSVG('gaz', 10, -8, 16, '💨')
    expect(s).toContain('<svg class="ico-cycle-svg" x="10" y="-8" width="16" height="16" viewBox="512 0 256 256"')
    expect(s).toContain('<image href="/assets/cycle-icones.webp" width="1024" height="768"')
    expect(s).toMatch(/<text class="ico-cycle-repli"[^>]*>💨<\/text>/)
  })
})

/** Un contexte 2D qui ne fait que noter ses drawImage. */
function faux(): { ctx: CanvasRenderingContext2D; appels: unknown[][] } {
  const appels: unknown[][] = []
  const ctx = { drawImage: (...a: unknown[]) => appels.push(a) } as unknown as CanvasRenderingContext2D
  return { ctx, appels }
}
const planche = (w: number, h: number): HTMLImageElement =>
  ({ complete: true, naturalWidth: w, naturalHeight: h }) as HTMLImageElement

describe('au canvas', () => {
  it('dessine la case quand la planche est prête', () => {
    const { ctx, appels } = faux()
    expect(dessineIconeCycle(ctx, planche(1024, 768), 'vaporisation', 5, 6, 32)).toBe(true)
    expect(appels[0].slice(1)).toEqual([768, 256, 256, 256, 5, 6, 32, 32])
    expect(dessineIconeTrophee(ctx, planche(1024, 512), 'operateur-de-nuit', 0, 0, 20)).toBe(true)
    expect(appels[1].slice(1, 5)).toEqual([768, 256, 256, 256])
  })

  it('rend false — l’appelant garde son dessin — sans planche ou sans case', () => {
    const { ctx, appels } = faux()
    expect(dessineIconeCycle(ctx, null, 'solide', 0, 0, 10)).toBe(false)
    expect(dessineIconeCycle(ctx, planche(0, 0), 'solide', 0, 0, 10)).toBe(false)
    expect(dessineIconeTrophee(ctx, planche(1024, 512), 'inconnu', 0, 0, 10)).toBe(false)
    expect(appels).toEqual([])
  })
})

describe('le guet des planches : la classe ne se pose qu’à une image réelle', () => {
  type FausseImage = { onload: (() => void) | null; onerror: (() => void) | null; src: string; naturalWidth: number; naturalHeight: number }
  const guette = (issue: 'charge' | 'vide' | 'echec'): { classes: Set<string>; img: FausseImage } => {
    const classes = new Set<string>()
    const img: FausseImage = { onload: null, onerror: null, src: '', naturalWidth: 0, naturalHeight: 0 }
    guettePlanche(ICONES_CYCLE_URL, CLASSE_PLANCHE_CYCLE, { classList: { add: (c: string) => classes.add(c) } }, () => img)
    if (issue === 'echec') img.onerror?.()
    else {
      if (issue === 'charge') Object.assign(img, { naturalWidth: 1024, naturalHeight: 768 })
      img.onload?.()
    }
    return { classes, img }
  }

  it('demande la planche et pose la classe quand elle arrive', () => {
    const { classes, img } = guette('charge')
    expect(img.src).toBe(ICONES_CYCLE_URL)
    expect([...classes]).toEqual([CLASSE_PLANCHE_CYCLE])
  })

  it('ne pose rien pour un fichier absent ou de taille nulle', () => {
    expect(guette('echec').classes.size).toBe(0)
    expect(guette('vide').classes.size).toBe(0)
  })
})

describe('les états écrits en dur dans index.html', () => {
  // l'écran du cycle, l'accueil, l'éveil, la légende et le panneau des états
  // portent leurs icônes dans le gabarit : une case décalée y montrerait la
  // goutte à la place du cristal, sans que rien d'autre ne tombe
  const poses = [...HTML.matchAll(/<i class="ico-cycle" style="--ic-x:(\d+);--ic-y:(\d+)" aria-hidden="true">(?:<span class="ico-repli">([^<]*)<\/span>)?<\/i>/g)]

  it('ont toutes la forme que iconeCycleHTML écrit', () => {
    expect(poses.length).toBe((HTML.match(/<i class="ico-cycle"/g) ?? []).length)
    expect(poses.length).toBeGreaterThanOrEqual(18)
  })

  it('posent chacune la case de l’état que dit son emoji de repli', () => {
    for (const [, x, y, repli] of poses) {
      // sans repli : un logement de l'ATH, que ath.spec vérifie
      if (repli === undefined) continue
      const id = ICONES_CYCLE[Number(x) + Number(y) * ICONES_CYCLE_COLONNES]
      const emoji = repli.replace('&#xFE0E;', '')
      expect(ETATS_CYCLE[id as EtatCycle]?.icone, `${repli} posé sur la case ${id}`).toBe(emoji)
    }
  })
})

describe('la feuille découpe les planches à leur grille', () => {
  const regle = (sel: string): string => {
    const i = HTML.indexOf(`${sel} {`)
    return i < 0 ? '' : HTML.slice(i, HTML.indexOf('}', i))
  }

  it('la planche du cycle : 4 × 3, seulement quand elle est arrivée', () => {
    const r = regle(`html.${CLASSE_PLANCHE_CYCLE} .ico-cycle`)
    expect(r).toContain(`url('${ICONES_CYCLE_URL}')`)
    expect(r).toContain('background-size: 400% 300%')
    expect(r).toContain('calc(var(--ic-x) * 33.3333%) calc(var(--ic-y) * 50%)')
  })

  it('la planche des trophées : 4 × 2', () => {
    const r = regle(`html.${CLASSE_PLANCHE_TROPHEES} .ico-trophee`)
    expect(r).toContain(`url('${ICONES_TROPHEES_URL}')`)
    expect(r).toContain('background-size: 400% 200%')
    expect(r).toContain('calc(var(--ic-x) * 33.3333%) calc(var(--ic-y) * 100%)')
  })

  it('cache l’emoji de repli dès que la planche est là', () => {
    expect(HTML).toMatch(new RegExp(`html\\.${CLASSE_PLANCHE_CYCLE} \\.ico-cycle > \\.ico-repli`))
    expect(HTML).toMatch(new RegExp(`html\\.${CLASSE_PLANCHE_TROPHEES} \\.ico-trophee > \\.ico-repli`))
  })
})

describe('les trophées passent par leur planche', () => {
  const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')

  it('la carte du dossier des trophées', () => {
    expect(MAIN).toContain('<div class="tro-carte${ok ? \'\' : \' verrou\'}">${iconeTropheeHTML(t.id, t.icone)}')
  })

  it('le toast d’un déblocage : le trophée voyage avec son id jusqu’à la pastille', () => {
    expect(MAIN).toContain('icone: t.icone, trophee: t.id })')
    expect(MAIN).toContain('iconeTropheeHTML(t.trophee, t.icone)')
  })
})
