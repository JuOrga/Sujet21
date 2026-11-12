// LE PEINTRE DU MODULE EN 2D : ce qui s'en vérifie sans toile — les thèmes
// des biomes, la reteinte des pièces, et les fichiers qu'il réclame.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import carte from '../game/carteStation.json'
import { PIECES_MODULE2D, THEMES, jeuDuBiome, teintePixels, themeDuBiome } from './module2dCanvas'

describe('module 2D — une teinte par biome', () => {
  it('chaque biome de la carte a son thème : aucun module ne retombe sur l’acier neutre', () => {
    for (const biome of Object.keys(carte.biomes)) expect(THEMES[biome], biome).toBeDefined()
    for (const m of carte.modules) if (m.biome) expect(themeDuBiome(m.biome).nom).toBe(m.biome)
  })

  it('un module sans biome (un outil, la mini-carte d’attente) prend l’acier et le cyan de la charte', () => {
    expect(themeDuBiome('').nom).toBe('neutre')
    expect(themeDuBiome('inconnu').lueur).toBe('99,183,230')
  })

  it('la serre garde ses pièces telles quelles : le vert n’appartient qu’à elle', () => {
    const px = [40, 120, 50, 255, 30, 34, 40, 255]
    const avant = [...px]
    teintePixels(px, THEMES.tempere)
    expect(px).toEqual(avant)
  })

  it('ailleurs, le vert d’un vitrage prend la couleur du biome, et son éclat reste', () => {
    for (const [biome, dominant] of [['chaud', 0], ['cryo', 2], ['observatoire', 2]] as const) {
      const px = [40, 150, 50, 255]
      teintePixels(px, THEMES[biome])
      const [r, g, b] = px
      // le canal du biome domine désormais, et le vert ne domine plus
      expect(Math.max(r, g, b), biome).toBe(px[dominant])
      expect(g, biome).toBeLessThan(px[dominant])
      // le vitrage ne s'éteint pas en changeant de couleur
      expect(px[dominant], biome).toBeGreaterThanOrEqual(150)
      expect(px[3]).toBe(255)
    }
  })

  it('la tôle grise garde son gris, à la dominante du biome près ; rien ne déborde', () => {
    for (const biome of Object.keys(THEMES)) {
      const px = [30, 34, 40, 200, 250, 250, 250, 255]
      teintePixels(px, THEMES[biome])
      const [tr, tg, tb] = THEMES[biome].tole
      expect(px[0]).toBeCloseTo(30 * tr, 6)
      expect(px[1]).toBeCloseTo(34 * tg, 6)
      expect(px[2]).toBeCloseTo(40 * tb, 6)
      expect(px[3]).toBe(200) // l'alpha n'est jamais touché
      for (const v of px.slice(4, 7)) expect(v).toBeLessThanOrEqual(255)
    }
    // la chaufferie tire au roux, le cryo au bleu
    expect(THEMES.chaud.tole[0]).toBeGreaterThan(THEMES.chaud.tole[2])
    expect(THEMES.cryo.tole[2]).toBeGreaterThan(THEMES.cryo.tole[0])
  })

  it('le fondu : un vert à peine dominant (une coulure de mousse) ne bascule qu’en partie', () => {
    const mousse = [40, 50, 40, 255]
    const feuille = [40, 150, 40, 255]
    teintePixels(mousse, THEMES.chaud)
    teintePixels(feuille, THEMES.chaud)
    // la feuille est franchement rousse, la mousse à mi-chemin
    expect(feuille[0] / feuille[1]).toBeGreaterThan(mousse[0] / mousse[1])
    expect(mousse[0]).toBeGreaterThan(40)
  })
})

describe('module 2D — les pièces livrées', () => {
  it('chaque pièce que le peintre réclame existe dans public/assets : une seule manquante laissait le module invisible', () => {
    for (const nom of PIECES_MODULE2D) expect(existsSync(join(process.cwd(), 'public/assets', `coque2d-${nom}.webp`)), nom).toBe(true)
  })

  it('aucune pièce réclamée deux fois', () => {
    expect(new Set(PIECES_MODULE2D).size).toBe(PIECES_MODULE2D.length)
  })
})

/** la taille d'une image WebP, lue dans son en-tête (avec couche alpha : VP8X ;
 *  sans : VP8) — le peintre découpe les bandes et les colliers en pixels du
 *  fichier, une ancre hors de l'image ne lève aucune erreur : elle peint du vide */
function tailleWebp(nom: string): { l: number; h: number } {
  const o = readFileSync(join(process.cwd(), 'public/assets', `coque2d-${nom}.webp`))
  const sorte = o.toString('latin1', 12, 16)
  if (sorte === 'VP8X') return { l: 1 + o.readUIntLE(24, 3), h: 1 + o.readUIntLE(27, 3) }
  if (sorte === 'VP8 ') return { l: o.readUInt16LE(26) & 0x3fff, h: o.readUInt16LE(28) & 0x3fff }
  throw new Error(`${nom} : en-tête WebP inattendu (${sorte})`)
}

describe('module 2D — un jeu de pièces par biome', () => {
  const PIECES_DE_COQUE = ['tole', 'tole-2', 'tole-machines', 'bord-haut', 'bord-bas', 'bout-gauche', 'bout-droit', 'baie', 'baie-2', 'colonne', 'trappe', 'machinerie']
  const biomes = [...Object.keys(carte.biomes), 'sans-biome']

  it('la chaufferie a ses pièces, et elles ne passent pas par la teinte : déjà à leurs couleurs, la dominante les réchaufferait deux fois', () => {
    expect(jeuDuBiome('chaud')).toMatchObject({ prefixe: 'chaud', teinte: false })
  })

  it('un biome sans pièces propres emprunte celles de la serre tempérée, reteintées', () => {
    for (const b of ['tempere', 'cryo', 'antichambre', 'observatoire', 'sans-biome']) expect(jeuDuBiome(b), b).toMatchObject({ prefixe: 'tempere', teinte: true })
  })

  it('chaque jeu est complet : le peintre réclame les douze pièces de coque sous le préfixe du biome', () => {
    for (const b of biomes) for (const n of PIECES_DE_COQUE) expect(PIECES_MODULE2D, `${b} : ${n}`).toContain(`${jeuDuBiome(b).prefixe}-${n}`)
  })

  it('les ancres d’un jeu tiennent dans ses images : la bande et le collier se découpent en pixels du fichier', () => {
    for (const b of biomes) {
      const j = jeuDuBiome(b)
      const haut = tailleWebp(`${j.prefixe}-bord-haut`)
      const bas = tailleWebp(`${j.prefixe}-bord-bas`)
      // le bord haut : le dehors au-dessus de la ligne de coque, le dedans dessous
      expect(j.bande.haut.ligne - j.bande.haut.dehors, `${b} : haut`).toBeGreaterThanOrEqual(0)
      expect(j.bande.haut.ligne + j.bande.haut.dedans, `${b} : haut`).toBeLessThanOrEqual(haut.h)
      // la quille : le dedans au-dessus, les tuyères dessous
      expect(j.bande.bas.ligne - j.bande.bas.dedans, `${b} : bas`).toBeGreaterThanOrEqual(0)
      expect(j.bande.bas.ligne + j.bande.bas.dehors, `${b} : bas`).toBeLessThanOrEqual(bas.h)
      const g = tailleWebp(`${j.prefixe}-bout-gauche`)
      const d = tailleWebp(`${j.prefixe}-bout-droit`)
      expect(j.collier.gauche + j.collier.morsure, `${b} : collier gauche`).toBeLessThanOrEqual(g.l)
      expect(j.collier.droite - j.collier.morsure, `${b} : collier droit`).toBeGreaterThanOrEqual(0)
      expect(j.collier.droite, `${b} : collier droit`).toBeLessThan(d.l)
      expect(j.collier.bas, `${b} : collier`).toBeLessThanOrEqual(Math.min(g.h, d.h))
    }
  })
})
