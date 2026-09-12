import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MAX_BOXES, MAX_ZONES } from './renderer'
import { checkLevel, parseLevel } from '../game/levelIO'

// Le budget de boîtes est écrit TROIS FOIS dans renderer.ts : la constante
// TypeScript (qui dimensionne les scratchs et fait avertir l'éditeur) et un
// #define dans chacun des deux shaders qui en font une boucle (la
// composition et le cuiseur de carte de lumière). S'ils divergent, l'éditeur
// accepte un tableau que le décor tronque en silence — les « murs
// invisibles » que la jauge existe précisément pour empêcher. Même contrat
// que lumiere.spec.ts pour les hauteurs.
const source = readFileSync(
  fileURLToPath(new URL('./renderer.ts', import.meta.url)),
  'utf8',
)

const defines = (nom: string): number[] =>
  [...source.matchAll(new RegExp(`#define\\s+${nom}\\s+([0-9]+)`, 'g'))].map(
    (m) => Number(m[1]),
  )

describe('Budgets de rendu — TypeScript et shaders disent la même chose', () => {
  it('MAX_BOXES est défini dans les deux shaders, à la valeur exportée', () => {
    const valeurs = defines('MAX_BOXES')
    expect(valeurs).toHaveLength(2)
    for (const v of valeurs) expect(v).toBe(MAX_BOXES)
  })

  it('MAX_ZONES est défini dans le shader de composition, à la valeur exportée', () => {
    const valeurs = defines('MAX_ZONES')
    expect(valeurs).toHaveLength(1)
    expect(valeurs[0]).toBe(MAX_ZONES)
  })

  it('le plafond couvre un tableau standard dense : 112 blocs posés passent', () => {
    // le tableau du 12/09/2026 qui a motivé le relèvement — 112 blocs sur
    // 2400 × 1500, refusé à 95 ; le sas garde sa place dans le budget
    expect(MAX_BOXES - 1).toBeGreaterThanOrEqual(112)
  })
})

describe('checkLevel — le refus suit le budget, il ne le devine pas', () => {
  const tableau = (n: number) => ({
    name: 'budget',
    bounds: { minX: -1000, minY: -600, maxX: 1000, maxY: 600 },
    spawn: { x: -800, y: 0, n: 60 },
    exit: { minX: 900, minY: -60, maxX: 980, maxY: 60 },
    boxes: Array.from({ length: n }, (_, i) => ({
      minX: -900 + (i % 40) * 40,
      minY: -500 + Math.floor(i / 40) * 40,
      maxX: -900 + (i % 40) * 40 + 20,
      maxY: -500 + Math.floor(i / 40) * 40 + 20,
      material: 0,
    })),
  })
  const trop = (n: number) =>
    checkLevel(parseLevel(tableau(n)).level!).filter((v) =>
      v.message.includes('Trop de blocs'),
    )

  it('accepte exactement MAX_BOXES − 1 blocs et refuse le suivant', () => {
    expect(trop(MAX_BOXES - 1)).toHaveLength(0)
    expect(trop(MAX_BOXES)).toHaveLength(1)
    expect(trop(MAX_BOXES)[0].message).toContain(`${MAX_BOXES - 1} dessinés au plus`)
  })
})
