import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { apresActivation, type DocumentPreRendu } from './activation'

// LE PRÉ-RENDU DE CHROME (panne du 05/11/2026, voir activation.ts) : taper
// « su » dans la barre d'adresse faisait démarrer le jeu entier dans une
// page invisible — navigateur figé plusieurs minutes, écran bleu chez un
// ami. Ces tests gardent les deux moitiés du correctif : l'attente
// elle-même, et le câblage qui fait passer le jeu par elle.

function document_(prerendering: boolean | undefined) {
  const ecouteurs: Array<() => void> = []
  const doc: DocumentPreRendu & { prerendering?: boolean } = {
    prerendering,
    addEventListener: (type, f) => {
      if (type === 'prerenderingchange') ecouteurs.push(f)
    },
  }
  return {
    doc,
    active: () => {
      doc.prerendering = false
      for (const f of ecouteurs) f()
    },
  }
}

/** Laisse passer les microtâches : une promesse résolue a eu le temps de le dire. */
const microtaches = () => new Promise((r) => setTimeout(r, 0))

describe('apresActivation', () => {
  it('page affichée : on démarre tout de suite', async () => {
    let parti = false
    void apresActivation(document_(false).doc).then(() => (parti = true))
    await microtaches()
    expect(parti).toBe(true)
  })

  it('navigateur sans pré-rendu (prerendering absent) : on démarre tout de suite', async () => {
    let parti = false
    void apresActivation(document_(undefined).doc).then(() => (parti = true))
    await microtaches()
    expect(parti).toBe(true)
  })

  it('page pré-rendue : rien ne part avant qu’elle soit affichée', async () => {
    const d = document_(true)
    let parti = false
    void apresActivation(d.doc).then(() => (parti = true))
    await microtaches()
    expect(parti).toBe(false)
    d.active()
    await microtaches()
    expect(parti).toBe(true)
  })
})

describe('le câblage de l’entrée', () => {
  const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf-8')
  const AMORCE = readFileSync(new URL('./amorce.ts', import.meta.url), 'utf-8')

  it('la page entre par amorce.ts, pas par main.ts', () => {
    // main.ts en entrée démarrerait le jeu à l'évaluation, pré-rendu ou non
    expect(HTML).toContain('<script type="module" src="/src/amorce.ts"></script>')
    expect(HTML).not.toMatch(/<script[^>]*src="\/src\/main\.ts"/)
  })

  it('amorce.ts ne charge main.ts qu’après l’activation, jamais par un import statique', () => {
    expect(AMORCE).not.toMatch(/^import[^\n]*['"]\.\/main['"]/m)
    expect(AMORCE).toMatch(/apresActivation\(document\)\.then\(\(\) => import\('\.\/main'\)\)/)
  })
})
