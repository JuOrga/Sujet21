import { describe, expect, it } from 'vitest'
import {
  TABLEAU_HUB,
  TABLEAU_HUB_COMPACT,
  ZONES_HUB_GRAND,
  ZONES_HUB_COMPACT,
  zonesDuHub,
} from './hub'
import { REPARATIONS, appliqueReparations, reparationDef } from './reparations'

const TOUTES = REPARATIONS.map((r) => r.id)

// LA PROSE N'EST PLUS UNE CLÉ.
// Les pancartes du hub se désignaient par leur LIBELLÉ EXACT : réécrire
// « LE MUR DES RECORDS|BANC OPTIQUE DES CALIBRATIONS » suffisait à ce que
// la station en panne garde la pancarte de la station réparée — sans
// erreur, sans test rouge. Puisque tous ces textes vont être réécrits,
// c'est le premier verrou à poser.
describe('l’identité d’un panneau ne tient pas à sa prose', () => {
  it('les pancartes manipulées par le code portent toutes une clé', () => {
    const attendues = new Set<string>(['hub.secteur-scelle', 'hub.acces-condamne'])
    for (const r of REPARATIONS) for (const c of r.labelsCaches) attendues.add(c)
    // le GRAND module les porte toutes
    for (const c of attendues)
      expect(
        TABLEAU_HUB.labels.some((l) => l.cle === c),
        `${c} absente du grand module`,
      ).toBe(true)
    // Le module COMPACT — celui qu'on joue — n'a JAMAIS eu de pancarte
    // « L'AILE DES ENDORMIS », alors que sa station existe : le masquage y
    // était déjà sans effet, bien avant les clés. On l'inscrit ici plutôt
    // que de l'arrondir : le jour où la pancarte sera posée, ce test le
    // dira, et c'est au concepteur de trancher, pas au test de couvrir.
    const manquantes = [...attendues].filter(
      (c) => !TABLEAU_HUB_COMPACT.labels.some((l) => l.cle === c),
    )
    expect(manquantes).toEqual(['hub.aile-endormis'])
    // et aucune clé n'est portée par deux panneaux du même tableau
    for (const base of [TABLEAU_HUB, TABLEAU_HUB_COMPACT]) {
      const vues = base.labels.map((l) => l.cle).filter(Boolean)
      expect(new Set(vues).size).toBe(vues.length)
    }
  })

  it('RÉÉCRIRE un panneau ne casse plus la panne', () => {
    // on refait la prose de fond en comble, comme le fera la passe de
    // réécriture : seule la clé demeure
    const base = {
      ...TABLEAU_HUB_COMPACT,
      labels: TABLEAU_HUB_COMPACT.labels.map((l) =>
        l.cle ? { ...l, text: 'PROSE ENTIÈREMENT NEUVE|ON A TOUT RÉÉCRIT' } : l,
      ),
    }
    // station réparée : sa pancarte reste ; en panne : elle disparaît
    const reparee = appliqueReparations(base, ['mur-records'])
    const enPanne = appliqueReparations(base, [])
    const compte = (lv: typeof base, cle: string): number =>
      lv.labels.filter((l) => l.cle === cle).length
    expect(compte(reparee, 'hub.mur-records')).toBe(1)
    expect(compte(enPanne, 'hub.mur-records')).toBe(0)
    // et la plaque de PANNE a bien pris sa place
    expect(enPanne.labels.some((l) => l.text.includes('EN PANNE'))).toBe(true)
  })

  it('le sceau du secteur 4 se lève à la clé, pas au libellé', () => {
    const base = {
      ...TABLEAU_HUB_COMPACT,
      labels: TABLEAU_HUB_COMPACT.labels.map((l) =>
        l.cle ? { ...l, text: 'AUTRE CHOSE|TOUT AUTRE CHOSE' } : l,
      ),
    }
    const ferme = appliqueReparations(base, TOUTES, { finOuverte: false })
    const ouvert = appliqueReparations(base, TOUTES, { finOuverte: true })
    expect(ferme.labels.some((l) => l.cle === 'hub.secteur-scelle')).toBe(true)
    expect(ouvert.labels.some((l) => l.cle === 'hub.secteur-scelle')).toBe(false)
    expect(ouvert.labels.some((l) => l.cle === 'hub.acces-condamne')).toBe(false)
  })
})

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
      // portes : le sceau + TOUTES les bouches des ailes condamnées
      const zones = zonesDuHub(base)!
      const bouches = Object.values(zones.portesDegat).reduce(
        (n, rects) => n + rects.length,
        0,
      )
      expect(lv.portes?.length).toBe((base.portes?.length ?? 0) + bouches + 1)
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

  it('la cuve close (acte 0) : la porte de la cuve est la PREMIÈRE (brèche 0)', () => {
    for (const [base, zones] of [
      [TABLEAU_HUB, ZONES_HUB_GRAND],
      [TABLEAU_HUB_COMPACT, ZONES_HUB_COMPACT],
    ] as const) {
      const lv = appliqueReparations(base, [], { cuveClose: true })
      const p0 = lv.portes?.[0]
      expect(p0?.minX).toBe(zones.porteCuve.minX)
      expect(p0?.canal).toBeLessThan(0)
      // sans cuve close : la première porte n'est PAS celle de la cuve
      const lv2 = appliqueReparations(base, [], {})
      expect(lv2.portes?.[0]?.minX).not.toBe(zones.porteCuve.minX)
    }
  })

  it('la fin ouverte : le sceau tombe, la signalétique bascule', () => {
    for (const base of [TABLEAU_HUB, TABLEAU_HUB_COMPACT]) {
      const avant = appliqueReparations(base, TOUTES, {})
      const apres = appliqueReparations(base, TOUTES, { finOuverte: true })
      // une porte de moins : le sceau n'est plus posé
      expect(apres.portes?.length).toBe((avant.portes?.length ?? 0) - 1)
      const textes = apres.labels.map((l) => l.text).join(' · ')
      expect(textes).not.toContain('LE SECTEUR SCELLÉ|CE QUI DOIT PARTIR')
      expect(textes).toContain('LE SECTEUR 4|LA ROUTE DU TÉLESCOPE')
      expect(textes).toContain('LE SAS S’OUVRE|LE CHOIX VOUS APPARTIENT')
    }
  })

  it('un vieil instantané sans zones méta traverse tel quel', () => {
    const { ancres: _, ...sansAncres } = TABLEAU_HUB_COMPACT
    const vieux = { ...sansAncres, bounds: { minX: -1750, minY: -800, maxX: 1750, maxY: 800 } }
    expect(appliqueReparations(vieux, [])).toBe(vieux)
  })

  it('un module rebâti sans ancres de sceau ni de cuve : aucune porte fantôme', () => {
    const nu = {
      ...TABLEAU_HUB_COMPACT,
      ancres: [
        {
          minX: 0,
          minY: 0,
          maxX: 100,
          maxY: 100,
          role: 'station' as const,
          id: 'eclairage',
        },
      ],
    }
    const lv = appliqueReparations(nu, [], { cuveClose: true })
    // seule la station posée parle ; ni sceau, ni porte de cuve, ni ailes
    expect(lv.portes?.length).toBe(nu.portes?.length ?? 0)
    const textes = lv.labels.map((l) => l.text).join(' · ')
    expect(textes).toContain('RÉSEAU D’ÉCLAIRAGE — EN PANNE')
    expect(textes).not.toContain('PASSERELLE DU SECTEUR 4 — EN PANNE')
  })

  it('reparationDef retrouve chaque fiche', () => {
    expect(reparationDef('distillateur')?.prix).toBe(40)
    expect(reparationDef('inconnue')).toBe(null)
  })
})

describe('une station en panne éteint sa console', () => {
  const ecransDe = (faites: string[]): string[] =>
    (appliqueReparations(TABLEAU_HUB, faites).pupitres ?? []).map((q) => q.ecran)

  it('le MUR DES RECORDS en panne retire son pupitre — réparé, il revient', () => {
    // Un mur mort qui ouvrirait quand même le palmarès dirait le
    // contraire de sa pancarte « EN PANNE ». Le pupitre disparaît avec
    // l'écran (même bande d'extinction), et revient à la réparation.
    expect(ecransDe([])).not.toContain('records')
    expect(ecransDe(['mur-records'])).toContain('records')
    expect(ecransDe(TOUTES)).toContain('records')
  })

  it('le tableau des avaries et le plan, eux, tiennent debout module éteint', () => {
    // c'est justement quand tout est en panne qu'on vient les lire
    const rien = ecransDe([])
    expect(rien).toContain('reparations')
    expect(rien).toContain('station')
  })

  it('la base n’est jamais mutée : le tableau CIBLE garde ses trois consoles', () => {
    appliqueReparations(TABLEAU_HUB, [])
    expect((TABLEAU_HUB.pupitres ?? []).length).toBe(3)
  })
})
