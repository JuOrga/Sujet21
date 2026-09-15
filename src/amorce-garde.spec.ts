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
    pouls: (fait: number, total: number, reste = '') =>
      (w.__sujet21Compile as (f: number, t: number, r: string) => void)(fait, total, reste),
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

  it('la première image retire l’écran de chargement (en fondu) et un panneau posé par la veille', () => {
    const m = monde()
    vi.advanceTimersByTime(12_100)
    expect(m.panne.classList.contains('visible')).toBe(true)
    m.demarre()
    expect(m.panne.classList.contains('visible')).toBe(false)
    expect(m.amorce.classList.contains('fini')).toBe(true) // le fondu part
    expect(m.amorce.hidden).toBe(false)
    vi.advanceTimersByTime(600)
    expect(m.amorce.hidden).toBe(true) // et l'écran sort du flux
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

  // LA PANNE VÉCUE (Chrome, 14/09/2026) : la compilation du rendu dépassait
  // douze secondes, en coulisse, pendant que la boucle tournait et
  // l'interrogeait à chaque image. La veille ne savait rien de ce pouls :
  // elle sonnait « trop longtemps » par-dessus un chargement qui avançait,
  // et conseillait de RECHARGER — ce qui relançait la compilation de zéro,
  // panneau à nouveau douze secondes plus tard, et un navigateur figé le
  // temps que le pilote lâche l'ancien contexte.
  it('tant que la compilation du rendu bat le pouls, la veille patiente et montre l’avancement', () => {
    const m = monde()
    m.franchit('ouverture')
    m.franchit('rendu')
    // une image toutes les 16 ms, comme la boucle : le pilote lie ses
    // programmes un à un
    for (let t = 0; t < 40_000; t += 16) {
      m.pouls(t < 20_000 ? 2 : 5, 7)
      vi.advanceTimersByTime(16)
      if (t === 10_000) expect(m.etape.textContent).toBe('le rendu se compile… 2/7')
    }
    expect(m.panne.classList.contains('visible')).toBe(false)
    expect(m.etape.textContent).toMatch(/5\/7 — 40 s\./)
    expect(m.etape.textContent).toMatch(/ne rechargez pas/)
    // le mot ne met plus la lenteur sur le dos de la carte graphique : c'est
    // faux (le compilateur de shaders tourne sur le processeur), et un joueur
    // avec une RTX 4060 Ti ne pouvait qu'en douter (15/09/2026)
    expect(m.etape.textContent).not.toMatch(/carte graphique est lente/)
    expect(m.etape.textContent).toMatch(/compilateur de shaders/)
  })

  // LE COMPTE FIGÉ (Chrome, RTX 4060 Ti, 15/09/2026) : « 6/7 » pendant
  // plusieurs minutes — le dernier programme est le plus gros — et rien ne
  // bougeait à l'écran. Le mot doit VIVRE : le temps écoulé avance à la
  // seconde, et ce qui reste à lier est nommé.
  it('sur le dernier programme, le mot dit le temps écoulé, à la seconde, et ce qui reste', () => {
    const m = monde()
    m.franchit('rendu')
    const reste = 'la composition (le plus gros des sept)'
    for (let t = 0; t < 11_000; t += 16) {
      m.pouls(6, 7, reste)
      vi.advanceTimersByTime(16)
    }
    expect(m.etape.textContent).toBe('le rendu se compile… 6/7') // encore court : rien à dire
    for (let t = 11_000; t < 65_000; t += 16) {
      m.pouls(6, 7, reste)
      vi.advanceTimersByTime(16)
      if (t === 12_000 + 16) expect(m.etape.textContent).toMatch(/6\/7 — 12 s — reste la composition/)
      if (t === 30_000 + 16) expect(m.etape.textContent).toMatch(/— 30 s —/)
    }
    expect(m.etape.textContent).toMatch(/6\/7 — 1 min 05 s — reste la composition \(le plus gros des sept\)\./)
    expect(m.etape.textContent).toMatch(/sur le processeur/)
    expect(m.etape.textContent).toMatch(/ne rechargez pas/)
    expect(m.panne.classList.contains('visible')).toBe(false)
  })

  it('un pouls qui s’arrête, c’est un fil figé : la veille sonne douze secondes après', () => {
    const m = monde()
    m.franchit('rendu')
    for (let t = 0; t < 30_000; t += 16) {
      m.pouls(1, 7)
      vi.advanceTimersByTime(16)
    }
    expect(m.panne.classList.contains('visible')).toBe(false)
    vi.advanceTimersByTime(11_000) // silence
    expect(m.panne.classList.contains('visible')).toBe(false)
    vi.advanceTimersByTime(1_100)
    expect(m.panne.classList.contains('visible')).toBe(true)
    expect(m.titre.textContent).toMatch(/RENDU MET TROP LONGTEMPS À SE COMPILER/)
    expect(m.corps.innerHTML).toMatch(/1 programmes liés sur 7/)
  })

  // Cinq minutes, et non plus deux : un chargement de « plusieurs minutes »
  // (Chrome, RTX 4060 Ti, 15/09/2026) ne doit pas se voir coiffé d'un
  // panneau d'alarme alors que le pouls bat et que le mot dit le temps.
  it('cinq minutes de pouls sans image : la patience a une fin, et la première image retire le panneau', () => {
    const m = monde()
    m.franchit('rendu')
    for (let t = 0; t < 299_000; t += 16) {
      m.pouls(6, 7)
      vi.advanceTimersByTime(16)
    }
    expect(m.panne.classList.contains('visible')).toBe(false)
    expect(m.etape.textContent).toMatch(/4 min 59 s/)
    for (let t = 0; t < 13_000; t += 16) {
      m.pouls(6, 7)
      vi.advanceTimersByTime(16)
    }
    expect(m.panne.classList.contains('visible')).toBe(true)
    expect(m.titre.textContent).toMatch(/SE COMPILER/)
    expect(m.corps.innerHTML).toMatch(/depuis 5 min 00 s/)
    expect(m.corps.innerHTML).toMatch(/pas sur la carte graphique/)
    expect(m.corps.innerHTML).toMatch(/Recharger la relancerait de zéro/)
    // le pilote finit enfin : le jeu tourne, le panneau part
    m.demarre()
    expect(m.panne.classList.contains('visible')).toBe(false)
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
