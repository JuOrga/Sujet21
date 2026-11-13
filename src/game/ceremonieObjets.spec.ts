import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ANNEAU_URL, ANNEAUX_MAITRISE, OBJETS, ORDRE_SCEAUX, SCEAUX_COLONNES, SCEAUX_URL, cuveHTML, sceauHTML } from './ceremonieObjets'
import {
  ICONES_CEREMONIE,
  ICONES_CEREMONIE_COLONNES,
  ICONES_CEREMONIE_RANGEES,
  ICONES_CEREMONIE_URL,
  ICONES_INSTRUMENTS_COLONNES,
  ICONES_INSTRUMENTS_RANGEES,
  ICONES_INSTRUMENTS_URL,
  ORDRE_INSTRUMENTS,
} from './iconesStation'

/** Les images que l'atelier Blender (tools/images/blender/ceremonie.py) a
 *  LIVRÉES dans public/ : chaque planche s'y ajoute le jour où elle arrive.
 *  Le CSS les charge par leur nom sans jamais se plaindre d'une absence —
 *  l'alvéole tient la place — : c'est ce test qui voit qu'une image manque. */
const LIVREES: string[] = [
  ICONES_CEREMONIE_URL,
  SCEAUX_URL,
  ...Object.values(OBJETS).flatMap((o) => [o.dos, o.verre]),
  ANNEAU_URL,
  ICONES_INSTRUMENTS_URL,
]

/** Une liste de l'atelier Python (`NOM = ['a', 'b', …]`), lue en texte : les
 *  planches y sont rendues dans cet ordre, le jeu les découpe dans l'ordre
 *  du TS — deux copies d'un même contrat, que rien d'autre ne compare. */
function listeAtelier(nom: string): string[] {
  const py = readFileSync('tools/images/blender/ceremonie.py', 'utf-8')
  const m = new RegExp(`^${nom} = \\[([^\\]]*)\\]`, 'm').exec(py)
  expect(m, `${nom} absent de ceremonie.py`).not.toBeNull()
  return [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1])
}

/** La taille d'un WebP, lue dans son en-tête : une planche transparente porte
 *  un bloc VP8X (largeur − 1 et hauteur − 1 sur 24 bits, petit-boutiste). */
function tailleWebp(chemin: string): [number, number] {
  const b = readFileSync(chemin)
  expect(b.toString('ascii', 0, 4) + b.toString('ascii', 8, 12)).toBe('RIFFWEBP')
  expect(b.toString('ascii', 12, 16)).toBe('VP8X')
  return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1]
}

describe('les images livrées par l’atelier', () => {
  it.each(LIVREES)('livre %s', (u) => expect(existsSync('public' + u)).toBe(true))
  it('découpe la planche de cérémonie en cases de 512², à la grille du contrat', () => {
    expect(tailleWebp('public' + ICONES_CEREMONIE_URL)).toEqual([ICONES_CEREMONIE_COLONNES * 512, ICONES_CEREMONIE_RANGEES * 512])
  })
  it('découpe la planche des sceaux en cases de 512², à la grille du contrat', () => {
    const rangees = Math.ceil(ORDRE_SCEAUX.length / SCEAUX_COLONNES)
    expect(tailleWebp('public' + SCEAUX_URL)).toEqual([SCEAUX_COLONNES * 512, rangees * 512])
  })
  it('donne à chaque cuve la taille de ses images (le rapport du cadre en dépend)', () => {
    for (const [nom, o] of Object.entries(OBJETS)) {
      expect(tailleWebp('public' + o.dos), nom).toEqual([o.largeur, o.hauteur])
      expect(tailleWebp('public' + o.verre), nom).toEqual([o.largeur, o.hauteur])
    }
  })
  it('découpe la planche des instruments en cases de 256², à la grille du contrat', () => {
    expect(tailleWebp('public' + ICONES_INSTRUMENTS_URL)).toEqual([ICONES_INSTRUMENTS_COLONNES * 256, ICONES_INSTRUMENTS_RANGEES * 256])
  })
  it('livre l’anneau en deux cases de 512² : intact, brisé', () => {
    expect(tailleWebp('public' + ANNEAU_URL)).toEqual([1024, 512])
  })
  it('pose l’anneau sur chacun des trois sièges de la colonne : une case carrée, dans l’image', () => {
    const { largeur, hauteur } = OBJETS.maitrise
    expect(ANNEAUX_MAITRISE).toHaveLength(3)
    let precedent = 1
    for (const f of ANNEAUX_MAITRISE) {
      // carrée EN PIXELS : la case de l'anneau ne se déforme pas
      expect(f.l * largeur).toBeCloseTo(f.h * hauteur, 0)
      expect(f.x).toBeGreaterThanOrEqual(0)
      expect(f.y).toBeGreaterThanOrEqual(0)
      expect(f.x + f.l).toBeLessThanOrEqual(1)
      expect(f.y + f.h).toBeLessThanOrEqual(1)
      // du bas vers le haut : le premier palier est le siège le plus bas
      expect(f.y).toBeLessThan(precedent)
      precedent = f.y
    }
  })
  it('rend les cases dans l’ordre où le jeu les découpe', () => {
    expect(listeAtelier('ICONES')).toEqual([...ICONES_CEREMONIE])
    expect(listeAtelier('SCEAUX')).toEqual([...ORDRE_SCEAUX])
    expect(listeAtelier('INSTRUMENTS')).toEqual([...ORDRE_INSTRUMENTS])
  })
})

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
