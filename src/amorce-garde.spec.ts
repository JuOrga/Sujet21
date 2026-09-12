import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// LA GARDE D'AMORÇAGE (index.html) — jouée hors navigateur.
//
// La panne vécue : la veille de douze secondes partait à l'analyse du
// document et ne connaissait rien du démarrage. Sur une carte ordinaire, la
// compilation du rendu gelait le fil principal plus longtemps que ça : la
// veille sonnait dès le dégel, PUIS la première image arrivait — et le
// panneau « met trop longtemps à s'ouvrir » restait affiché par-dessus un
// jeu qui tournait. Deux règles en découlent, et ces tests les gardent :
// une étape franchie réarme la veille, et la première image retire un
// panneau que seule la veille avait posé.
//
// Le script est classique et ne touche que window, document, performance
// et les minuteries : on le lit tel quel dans index.html et on le fait
// tourner sur un document de carton.

const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf-8')

function scriptDeLaGarde(): string {
  const i = HTML.indexOf("<!-- LA GARDE D'AMORÇAGE.")
  expect(i).toBeGreaterThan(0)
  const debut = HTML.indexOf('<script>', i) + '<script>'.length
  const fin = HTML.indexOf('</script>', debut)
  return HTML.slice(debut, fin)
}

interface Element {
  classList: { add(c: string): void; remove(c: string): void; contains(c: string): boolean }
  textContent: string
  innerHTML: string
  hidden: boolean
}

type Ecouteur = (e: unknown) => void

function monde(options: { webgl2?: boolean; moduleArrive?: boolean } = {}) {
  const elements = new Map<string, Element>()
  const el = (id: string): Element => {
    let e = elements.get(id)
    if (!e) {
      const classes = new Set<string>()
      e = {
        classList: {
          add: (c) => void classes.add(c),
          remove: (c) => void classes.delete(c),
          contains: (c) => classes.has(c),
        },
        textContent: '',
        innerHTML: '',
        hidden: false,
      }
      elements.set(id, e)
    }
    return e
  }
  const ecouteurs = new Map<string, Ecouteur[]>()
  const w: Record<string, unknown> = {
    addEventListener: (nom: string, f: Ecouteur) => {
      ecouteurs.set(nom, [...(ecouteurs.get(nom) ?? []), f])
    },
  }
  const document = {
    getElementById: el,
    createElement: () => ({ getContext: () => (options.webgl2 ?? true ? {} : null) }),
    querySelector: () => ({ src: 'http://jeu/assets/index.js' }),
    body: { innerHTML: '' },
  }
  const performance = {
    getEntriesByName: () => (options.moduleArrive ?? true ? [{}] : []),
  }
  // les minuteries se lisent au moment de l'appel : ce sont celles, factices,
  // que vitest a posées sur globalThis
  const setTimeout = (f: () => void, d: number) => globalThis.setTimeout(f, d)
  const clearTimeout = (id: number) => globalThis.clearTimeout(id)
  new Function('window', 'document', 'performance', 'setTimeout', 'clearTimeout', scriptDeLaGarde())(
    w,
    document,
    performance,
    setTimeout,
    clearTimeout,
  )
  return {
    panne: el('panne'),
    titre: el('panne-titre'),
    corps: el('panne-corps'),
    etape: el('amorce-etape'),
    amorce: el('amorce'),
    demarre: () => (w.__sujet21Demarre as () => void)(),
    franchit: (nom: string) => (w.__sujet21Etape as (n: string) => void)(nom),
    erreur: (message: string) => {
      for (const f of ecouteurs.get('error') ?? []) f({ message })
    },
  }
}

describe('La garde d’amorçage', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('sonne au bout de douze secondes sans signe de vie', () => {
    const m = monde()
    vi.advanceTimersByTime(11_900)
    expect(m.panne.classList.contains('visible')).toBe(false)
    vi.advanceTimersByTime(200)
    expect(m.panne.classList.contains('visible')).toBe(true)
    expect(m.titre.textContent).toMatch(/TROP LONGTEMPS/)
    expect(m.corps.innerHTML).toMatch(/le fichier arrive/)
  })

  it('une étape franchie réarme la veille et fait avancer le mot', () => {
    const m = monde()
    vi.advanceTimersByTime(10_000)
    m.franchit('ouverture')
    expect(m.etape.textContent).toMatch(/module s’ouvre/)
    vi.advanceTimersByTime(10_000) // 20 s depuis le début, 10 depuis l'étape
    expect(m.panne.classList.contains('visible')).toBe(false)
    m.franchit('rendu')
    expect(m.etape.textContent).toMatch(/rendu se compile/)
    vi.advanceTimersByTime(11_000)
    expect(m.panne.classList.contains('visible')).toBe(false)
    vi.advanceTimersByTime(1_100)
    expect(m.panne.classList.contains('visible')).toBe(true)
    expect(m.corps.innerHTML).toMatch(/le rendu se compile/)
  })

  it('la première image retire le mot du chargement et un panneau posé par la veille', () => {
    const m = monde()
    vi.advanceTimersByTime(12_100)
    expect(m.panne.classList.contains('visible')).toBe(true)
    m.demarre()
    expect(m.panne.classList.contains('visible')).toBe(false)
    expect(m.amorce.hidden).toBe(true)
    // et plus rien ne sonne ensuite
    vi.advanceTimersByTime(60_000)
    expect(m.panne.classList.contains('visible')).toBe(false)
  })

  it('une vraie erreur, elle, reste affichée quand le jeu prétend démarrer', () => {
    const m = monde()
    m.erreur('Cannot access before initialization')
    expect(m.panne.classList.contains('visible')).toBe(true)
    m.demarre()
    expect(m.panne.classList.contains('visible')).toBe(true)
    expect(m.titre.textContent).toMatch(/N’A PAS PU/)
  })

  it('un fichier qui met du temps à arriver n’est pas une panne : on patiente', () => {
    const m = monde({ moduleArrive: false })
    vi.advanceTimersByTime(12_100)
    expect(m.panne.classList.contains('visible')).toBe(false)
    expect(m.etape.textContent).toMatch(/connexion est lente/)
    vi.advanceTimersByTime(60_000) // 72 s : toujours pas de fichier, on patiente encore
    expect(m.panne.classList.contains('visible')).toBe(false)
    vi.advanceTimersByTime(24_000) // 96 s : la patience a une fin
    expect(m.panne.classList.contains('visible')).toBe(true)
  })

  it('sans WebGL2, le panneau est là tout de suite et la veille ne s’arme pas', () => {
    const m = monde({ webgl2: false })
    expect(m.panne.classList.contains('visible')).toBe(true)
    expect(m.titre.textContent).toMatch(/NE SAIT PAS AFFICHER/)
    expect(vi.getTimerCount()).toBe(0)
  })
})
