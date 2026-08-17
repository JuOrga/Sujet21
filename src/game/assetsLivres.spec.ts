// Le catalogue doit être EXHAUSTIF : une image déposée dans public/assets
// apparaît dans la bibliothèque sans qu'on ait à l'inscrire à la main.
import { describe, expect, it } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { assetsLivres, RUBRIQUES } from './assetsLivres'

function fichiersDisque(dir: string, base = ''): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...fichiersDisque(p, `${base}${e}/`))
    else if (/\.(webp|png|jpe?g|avif|svg|gif)$/i.test(e)) out.push(`${base}${e}`)
  }
  return out
}

describe('catalogue des images livrées', () => {
  const cat = assetsLivres()

  it('n’oublie AUCUNE image de public/assets', () => {
    const surDisque = fichiersDisque('public/assets').sort()
    const auCatalogue = cat.map((a) => a.url.replace('/assets/', '')).sort()
    expect(auCatalogue).toEqual(surDisque)
    expect(cat.length).toBeGreaterThan(20) // le jeu en a déjà une trentaine
  })

  it('donne à chacune une rubrique connue et un nom lisible', () => {
    for (const a of cat) {
      expect(RUBRIQUES, `${a.url} : rubrique inconnue`).toContain(a.rubrique)
      expect(a.nom.length, `${a.url} : nom vide`).toBeGreaterThan(0)
      expect(a.url.startsWith('/assets/'), `${a.url} : URL non publique`).toBe(true)
    }
  })

  it('range « Autres » en dernier et ne laisse rien s’y perdre par accident', () => {
    // les fichiers connus du jeu sont tous classés : « Autres » reste vide
    expect(cat.filter((a) => a.rubrique === 'Autres')).toEqual([])
    expect(RUBRIQUES[RUBRIQUES.length - 1]).toBe('Autres')
  })

  it('classe par rubrique puis par nom — l’ordre est celui de l’écran', () => {
    const rangs = cat.map((a) => RUBRIQUES.indexOf(a.rubrique as (typeof RUBRIQUES)[number]))
    expect(rangs).toEqual([...rangs].sort((x, y) => x - y))
    for (let i = 1; i < cat.length; i++) {
      if (cat[i].rubrique !== cat[i - 1].rubrique) continue
      expect(cat[i - 1].nom.localeCompare(cat[i].nom, 'fr')).toBeLessThanOrEqual(0)
    }
  })
})
