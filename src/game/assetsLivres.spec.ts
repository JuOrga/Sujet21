// Le catalogue doit être EXHAUSTIF : une image déposée dans public/assets
// apparaît dans la bibliothèque sans qu'on ait à l'inscrire à la main.
import { describe, expect, it } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { assetsLivres, nomDe, reliefDansAlpha, rubriqueDe, RUBRIQUES } from './assetsLivres'

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

describe('catalogue — les images des écrans se rangent par leur dossier', () => {
  it('une illustration du tableau des avaries a sa rubrique et le nom de sa station', () => {
    // nommée par l’id de la station : aucun préfixe ne la distingue, le dossier si
    expect(rubriqueDe('/assets/avaries/eclairage.webp')).toBe('Avaries — stations')
    expect(nomDe('/assets/avaries/eclairage.webp')).toBe('Avarie — réseau d’éclairage')
    expect(rubriqueDe('/assets/avaries/passerelle-4.webp')).toBe('Avaries — stations')
  })

  it('un aperçu du codex (l’image d’attente de la vidéo) ne tombe pas dans « Autres »', () => {
    expect(rubriqueDe('/assets/codex/eau-hydrophile.webp')).toBe('Codex — aperçus')
    expect(nomDe('/assets/codex/eau-hydrophile.webp')).toBe('Eau hydrophile')
  })
})

describe('catalogue — LA SERRE accueille ses cultures avant même les fichiers', () => {
  it('range toute image « serre- » dans sa rubrique, et la nomme', () => {
    // les quatre pièces annoncées aux concepteurs (docs/assets-ia.md)
    const attendus: [string, string][] = [
      ['serre-roquette.webp', 'Serre — bac de roquette'],
      ['serre-ble-nain.webp', 'Serre — blé nain'],
      ['serre-tomates.webp', 'Serre — colonne de tomates'],
      ['serre-rampe.webp', 'Serre — gouttière et barre horticole'],
    ]
    for (const [f, nom] of attendus) {
      expect(rubriqueDe(`/assets/${f}`), f).toBe('Serre & cultures')
      expect(nomDe(`/assets/${f}`), f).toBe(nom)
    }
  })

  it('une culture NON prévue tombe quand même dans la serre, jamais dans « Autres »', () => {
    expect(rubriqueDe('/assets/serre-basilic-2.webp')).toBe('Serre & cultures')
    expect(nomDe('/assets/serre-basilic-2.webp')).toBe('Serre basilic 2')
  })

  it('la rubrique existe dans l’ordre d’écran, avant les objets', () => {
    expect(RUBRIQUES).toContain('Serre & cultures')
    expect(RUBRIQUES.indexOf('Serre & cultures')).toBeGreaterThan(
      RUBRIQUES.indexOf('Machinerie & décalques'),
    )
    expect(RUBRIQUES.indexOf('Serre & cultures')).toBeLessThan(
      RUBRIQUES.indexOf('Autres'),
    )
  })
})

describe('catalogue — les surfaces dont l’alpha est un RELIEF (assets-ia §37)', () => {
  it('le mur, la seconde paroi, les deux matières et l’atlas des habillages, et rien d’autre', () => {
    for (const f of ['wall.webp', 'wall-a.webp', 'paroi-atlas.webp']) {
      expect(reliefDansAlpha(`/assets/${f}`), f).toBe(true)
    }
    // la légende a sa planche opaque ; le fond de cuve et l'atlas des
    // conduites ont un alpha de détourage, ou pas d'alpha
    // les deux matières sont revenues aux images en ligne, opaques (15/11)
    for (const f of ['legende-surfaces.webp', 'tank-bg.webp', 'conduite-atlas.webp', 'wall-b.webp', 'phile.webp', 'phobe.webp']) {
      expect(reliefDansAlpha(`/assets/${f}`), f).toBe(false)
    }
  })

  it('le catalogue le dit de chaque image : la galerie les montre SANS leur alpha', () => {
    const cat = assetsLivres()
    const enRelief = cat.filter((a) => a.relief).map((a) => a.url).sort()
    expect(enRelief).toEqual(
      ['/assets/paroi-atlas.webp', '/assets/wall-a.webp', '/assets/wall.webp'],
    )
  })
})

describe('catalogue — LES STATIONS DU HUB, rangées avant même leur livraison', () => {
  it('chaque pièce du hub et son plafond tombent dans la machinerie, bien nommés', () => {
    // sans règle, une image « hub-* » tombait dans « Autres » le jour de sa
    // livraison — et le test qui garde « Autres » vide virait au rouge
    const attendus: [string, string][] = [
      ['hub-eclairage.webp', 'Hub — réseau d’éclairage'],
      ['hub-table-depart.webp', 'Hub — table de départ'],
      ['hub-mur-records.webp', 'Hub — mur des records'],
      ['hub-bac-sable.webp', 'Hub — bac d’essai'],
      ['hub-distillateur.webp', 'Hub — distillateur de primes'],
      ['plafond-hub.webp', 'Plafond du reflet — le hub'],
    ]
    for (const [f, nom] of attendus) {
      expect(rubriqueDe(`/assets/${f}`), f).toBe('Machinerie & décalques')
      expect(nomDe(`/assets/${f}`), f).toBe(nom)
    }
  })
})

describe('catalogue — LA CÉRÉMONIE STATION range ses planches rendues', () => {
  it('range les planches et objets de la cérémonie, et les scènes de fin, sous leur rubrique', () => {
    // les noms fixés par le contrat (iconesStation.ts, ceremonieObjets.ts,
    // prepare.py) : chaque planche du lot Blender doit y tomber dès sa livraison
    for (const f of ['ceremonie-icones', 'ceremonie-sceaux', 'ceremonie-bonbonne-dos', 'ceremonie-anneau',
      'instruments-icones', 'fin-capsule', 'fin-fiole-brisee'])
      expect(rubriqueDe(`/assets/${f}.webp`), f).toBe('Cérémonie station')
    expect(nomDe('/assets/ceremonie-icones.webp')).toBe('Cérémonie — planche d’icônes (7×4)')
  })
})
