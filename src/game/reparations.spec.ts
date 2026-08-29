import { describe, expect, it } from 'vitest'
import {
  TABLEAU_HUB,
  TABLEAU_HUB_COMPACT,
  ZONES_HUB_GRAND,
  ZONES_HUB_COMPACT,
} from './hub'
import { REPARATIONS, appliqueReparations, reparationDef } from './reparations'

const TOUTES = REPARATIONS.map((r) => r.id)

describe('les réparations — le hub accidenté', () => {
  it('sept stations, ids uniques, prix croissants, total 225', () => {
    expect(REPARATIONS.length).toBe(7)
    expect(new Set(TOUTES).size).toBe(7)
    for (let i = 1; i < REPARATIONS.length; i++)
      expect(REPARATIONS[i].prix).toBeGreaterThan(REPARATIONS[i - 1].prix)
    expect(REPARATIONS.reduce((s, r) => s + r.prix, 0)).toBe(225)
    // chaque station a son plot ET (si porte) sa porte, dans CHAQUE module
    for (const zones of [ZONES_HUB_GRAND, ZONES_HUB_COMPACT])
      for (const r of REPARATIONS) {
        expect(zones.stations[r.id], r.id).toBeTruthy()
        if (r.porte) expect(zones.portesDegat[r.id], r.id).toBeTruthy()
      }
  })

  it('appliqueReparations ne mute JAMAIS la base (elle peut venir de la bibliothèque)', () => {
    for (const base of [TABLEAU_HUB, TABLEAU_HUB_COMPACT]) {
      const avant = JSON.stringify(base)
      appliqueReparations(base, [])
      appliqueReparations(base, TOUTES)
      expect(JSON.stringify(base)).toBe(avant)
    }
  })

  it('rien de réparé : plaques de panne, portes closes, pénombre', () => {
    for (const base of [TABLEAU_HUB, TABLEAU_HUB_COMPACT]) {
      const lv = appliqueReparations(base, [])
      // les bornes ne bougent jamais (zonesDuHub trie dessus)
      expect(lv.bounds).toEqual(base.bounds)
      expect(lv.boxes).toBe(base.boxes) // la physique des murs est intacte
      const textes = lv.labels.map((l) => l.text).join(' · ')
      expect(textes).toContain('RÉSEAU D’ÉCLAIRAGE — EN PANNE|RÉPARER · 10 MÉMOIRE')
      expect(textes).toContain('PASSERELLE DU SECTEUR 4 — EN PANNE|RÉPARER · 60 MÉMOIRE')
      // la signalétique de l'état réparé s'est tue
      expect(textes).not.toContain('LA TABLE DE DÉPART|CE QUE VOUS EMPORTEZ')
      // portes : le sceau + les trois ailes condamnées
      expect(lv.portes?.length).toBe((base.portes?.length ?? 0) + 4)
      for (const p of lv.portes ?? []) expect(p.canal).toBeLessThan(0)
      // la pénombre de panne
      expect(lv.ambiante ?? 0.52).toBeLessThan(base.ambiante ?? 0.52)
      expect(lv.brume ?? 0).toBeGreaterThan(base.brume ?? 0)
      // plus un seul écran allumé près des stations éteintes
      const on = (lv.decals ?? []).filter((d) => d.kind === 'ecran-on')
      const onBase = (base.decals ?? []).filter((d) => d.kind === 'ecran-on')
      expect(on.length).toBeLessThan(onBase.length + 1)
    }
  })

  it('tout réparé : le hub cible, plus AUCUNE panne — seul le sceau reste', () => {
    for (const base of [TABLEAU_HUB, TABLEAU_HUB_COMPACT]) {
      const lv = appliqueReparations(base, TOUTES)
      const textes = lv.labels.map((l) => l.text).join(' · ')
      expect(textes).not.toContain('EN PANNE')
      expect(textes).toContain('LA TABLE DE DÉPART|CE QUE VOUS EMPORTEZ')
      expect(lv.portes?.length).toBe((base.portes?.length ?? 0) + 1) // le sceau
      expect(lv.ambiante).toBe(base.ambiante)
      expect(lv.decals).toEqual(base.decals)
    }
  })

  it('un vieil instantané sans zones méta traverse tel quel', () => {
    const vieux = { ...TABLEAU_HUB_COMPACT, bounds: { minX: -1750, minY: -800, maxX: 1750, maxY: 800 } }
    expect(appliqueReparations(vieux, [])).toBe(vieux)
  })

  it('reparationDef retrouve chaque fiche', () => {
    expect(reparationDef('distillateur')?.prix).toBe(40)
    expect(reparationDef('inconnue')).toBe(null)
  })
})
