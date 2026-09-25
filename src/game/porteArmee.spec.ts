import { describe, expect, it } from 'vitest'
import { ARMEE, armeAuToucher, TEXTE_ARMEE, TEXTE_ENTRER, type PorteArmable } from './porteArmee'

// une porte factice : ses classes, son bouton « ENTRER », les événements
// qu'elle reçoit, et le toucher qu'on lui fait
const porteFactice = (freres: PorteArmable[] = []) => {
  const classes = new Set<string>()
  const entrer = { textContent: TEXTE_ENTRER as string | null }
  const recus: string[] = []
  let appui: ((e: { pointerType: string }) => void) | null = null
  const p: PorteArmable & { recus: string[]; entrer: typeof entrer; appuie: (t: string) => void } = {
    classList: { contains: (c) => classes.has(c), add: (c) => void classes.add(c), remove: (c) => void classes.delete(c) },
    addEventListener: (_t, f) => void (appui = f),
    dispatchEvent: (e) => (recus.push(e.type), true),
    querySelector: () => entrer,
    parentElement: { querySelectorAll: () => freres.filter((f) => f.classList.contains(ARMEE)) },
    recus,
    entrer,
    appuie: (t) => appui?.({ pointerType: t }),
  }
  return p
}

describe('armeAuToucher — au doigt, une porte se vise puis s’ouvre', () => {
  it('au doigt : le premier toucher arme (aperçu, « TOUCHEZ ENCORE »), le second ouvre', () => {
    const p = porteFactice()
    const clic = armeAuToucher(p, true)
    p.appuie('touch')
    expect(clic()).toBe(false)
    expect(p.classList.contains(ARMEE)).toBe(true)
    expect(p.entrer.textContent).toBe(TEXTE_ARMEE)
    expect(p.recus).toEqual(['pad-vise'])
    p.appuie('touch')
    expect(clic()).toBe(true)
  })

  it('souris, clavier, manette : chaque clic ouvre', () => {
    const p = porteFactice()
    const clic = armeAuToucher(p, true)
    p.appuie('mouse')
    expect(clic()).toBe(true)
    expect(clic()).toBe(true) // clavier ou manette : aucun pointerdown
  })

  it('le doigt ne vaut que pour son clic : une validation au clavier qui suit un toucher ouvre', () => {
    const q = porteFactice()
    const clicQ = armeAuToucher(q, true)
    q.appuie('touch')
    clicQ() // arme q au doigt…
    q.classList.remove(ARMEE) // …puis q est désarmée (une autre porte touchée)
    expect(clicQ()).toBe(true) // Entrée au clavier : pas de pointerdown, elle ouvre
  })

  it('armer une porte désarme sa voisine, qui retrouve « ENTRER » et éteint son aperçu', () => {
    const a = porteFactice()
    const freres: PorteArmable[] = [a]
    const b = porteFactice(freres)
    freres.push(b)
    const clicA = armeAuToucher(a, true)
    const clicB = armeAuToucher(b, true)
    a.appuie('touch')
    clicA()
    b.appuie('touch')
    expect(clicB()).toBe(false)
    expect(a.classList.contains(ARMEE)).toBe(false)
    expect(a.entrer.textContent).toBe(TEXTE_ENTRER)
    expect(a.recus).toEqual(['pad-vise', 'pad-quitte'])
    expect(b.classList.contains(ARMEE)).toBe(true)
  })

  it('sans mini-carte à voies : le doigt ouvre du premier coup, comme avant', () => {
    const p = porteFactice()
    const clic = armeAuToucher(p, false)
    p.appuie('touch')
    expect(clic()).toBe(true)
  })
})
