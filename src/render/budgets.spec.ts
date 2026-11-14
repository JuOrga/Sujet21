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

// LES CASES D'UNIFORMES, COMPTÉES SUR LA SOURCE. Un vec4 par scalaire ou
// vecteur, autant que d'éléments pour un tableau, N par matN ; les
// échantillonneurs n'en prennent pas. Les morceaux interpolés (\${X}) sont
// dépliés depuis leur `const X = \``. C'est la règle de rangement que les
// pilotes appliquent au pire (sans tassement) : WebGL2 n'en garantit que 224,
// les GPU courants en annoncent 1024. Le plafond est la moitié de ces 1024 :
// la marge des pilotes qui rangent moins bien, et un fil tendu — un tableau
// de plus par boîte (160 cases) le ferait tomber.
const PLAFOND_CASES = 512
const corpsShader = (nom: string): string => {
  const a = source.indexOf(`const ${nom} = \``)
  if (a < 0) return ''
  const b = source.indexOf('`', a + nom.length + 10)
  return source.slice(a, b)
}
const casesUniformes = (nom: string): number => {
  const fs = corpsShader(nom).replace(/\$\{(\w+)\}/g, (_, x: string) => corpsShader(x))
  const defs: Record<string, number> = {}
  for (const m of fs.matchAll(/#define\s+(\w+)\s+([0-9.]+)/g)) defs[m[1]] = Number(m[2])
  let total = 0
  for (const m of fs.matchAll(/^\s*uniform\s+(\w+)\s+\w+\s*(?:\[([^\]]+)\])?\s*;/gm)) {
    if (/sampler/.test(m[1])) continue
    const colonnes = /^mat(\d)/.exec(m[1])
    const taille = m[2]
      ? Number(Function(`return (${m[2].replace(/\w+/g, (w) => (w in defs ? String(defs[w]) : w))})`)())
      : 1
    total += (colonnes ? Number(colonnes[1]) : 1) * taille
  }
  return total
}

describe("Budget d'uniformes — les cases comptées sur la source", () => {
  it('la composition et le cuiseur tiennent sous le plafond', () => {
    const compo = casesUniformes('COMPOSE_FS')
    const cuiseur = casesUniformes('LIGHT_FS')
    // le compte lui-même : les deux tableaux de boîtes y sont (2 × 160)
    expect(compo).toBeGreaterThan(2 * MAX_BOXES)
    expect(cuiseur).toBeGreaterThan(2 * MAX_BOXES)
    expect(compo).toBeLessThanOrEqual(PLAFOND_CASES)
    expect(cuiseur).toBeLessThanOrEqual(PLAFOND_CASES)
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
