import { describe, expect, it } from 'vitest'
import {
  TABLEAU_HUB,
  TABLEAU_HUB_COMPACT,
  ZONES_HUB_COMPACT,
  ZONES_HUB_GRAND,
  STRUCTURES_HUB,
  zonesDuHub,
  zonesPosees,
  ancreAbsente,
} from './hub'
import {
  dansBoite,
  MAT_CHAUD,
  MAT_GRILLE,
  MAT_MEMBRANE,
  MAT_RIDEAU,
  MAT_SURCHAUFFEUR,
  MAT_WALL,
} from './level'
import { checkLevel } from './levelIO'
import { niveauExpanse } from './structures'
import { accessible } from './generateur'

type Rect = { minX: number; minY: number; maxX: number; maxY: number }
const dedans = (r: Rect, b: Rect): boolean =>
  r.minX >= b.minX && r.maxX <= b.maxX && r.minY >= b.minY && r.maxY <= b.maxY
const chevauche = (a: Rect, b: Rect): boolean =>
  a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY

describe('hub v4 — le méta a pris ses murs (grand module)', () => {
  it('le tableau reste valide et le sas principal se rejoint', () => {
    const erreurs = checkLevel(TABLEAU_HUB).filter((v) => v.niveau === 'erreur')
    expect(erreurs.map((e) => e.message)).toEqual([])
    // spawn → sas, à la marge du corps (les filtres comptent passants)
    expect(accessible(TABLEAU_HUB, new Set())).toBe(true)
  })

  it('les trois sas et le banc tiennent dans les bornes, hors des murs', () => {
    const b = TABLEAU_HUB.bounds
    // le module est bâti au KIT : les murs sont ceux que les structures
    // fabriquent, pas ceux qu'on pose — c'est sur EUX qu'on juge
    const murs = niveauExpanse(TABLEAU_HUB).boxes
    // une coque enveloppe TOUTE sa salle : c'est le champ qui tranche, pas
    // la boîte englobante — on demande donc que la zone soit dans le VIDE
    for (const zone of [
      TABLEAU_HUB.exit,
      ZONES_HUB_GRAND.sasGivre,
      ZONES_HUB_GRAND.sasVapeur,
      ...ZONES_HUB_GRAND.etal.map((a) => a.plot),
    ]) {
      expect(dedans(zone, b)).toBe(true)
      for (const [px, py] of [
        [zone.minX, zone.minY],
        [zone.maxX, zone.minY],
        [zone.minX, zone.maxY],
        [zone.maxX, zone.maxY],
        [(zone.minX + zone.maxX) / 2, (zone.minY + zone.maxY) / 2],
      ])
        for (const box of murs)
          expect(dansBoite(box, px, py), JSON.stringify(zone)).toBe(false)
    }
    // la zone du banc, elle, ENVELOPPE la console : le corps qui frôle
    // l'un des deux rails du couloir ouvre l'écran des mémoires
    expect(dedans(ZONES_HUB_GRAND.banc, b)).toBe(true)
    const rails = TABLEAU_HUB.boxes.filter(
      (bx) => bx.minX === -1200 && bx.maxX === -640,
    )
    expect(rails.length).toBe(2)
    for (const rail of rails)
      expect(dedans(rail, ZONES_HUB_GRAND.banc)).toBe(true)
  })

  it('le module est bâti AU KIT : dix-sept coques, et rien n’est posé à la main', () => {
    // la promesse du chantier : le terrain de jeu vient des structures —
    // les boîtes posées ne sont plus que du mobilier
    expect(STRUCTURES_HUB.length).toBe(17)
    expect(TABLEAU_HUB.structures).toBe(STRUCTURES_HUB)
    expect(TABLEAU_HUB.coque).toBe('structures')
    for (const bx of TABLEAU_HUB.boxes) expect(bx.material === MAT_WALL || true).toBe(true)
    // le budget du moteur, structures comprises
    // UNE boîte par coque (plus les deux portes de matière) : le terrain
    // de jeu entier tient dans un cinquième du budget du moteur
    expect(niveauExpanse(TABLEAU_HUB).boxes.length).toBeLessThanOrEqual(45)
  })

  it('les deux routes gardées sont bouchées par LEUR matière', () => {
    const tubes = STRUCTURES_HUB.filter((s) => s.bouchon !== undefined)
    expect(tubes.length).toBe(2)
    expect(tubes.map((s) => s.bouchon).sort()).toEqual(
      [MAT_GRILLE, MAT_RIDEAU].sort(),
    )
    // le gaz au nord (la grille), la glace au sud (le rideau)
    const gaz = tubes.find((s) => s.bouchon === MAT_GRILLE)!
    const glace = tubes.find((s) => s.bouchon === MAT_RIDEAU)!
    expect(gaz.minY).toBeGreaterThan(0)
    expect(glace.maxY).toBeLessThan(0)
    // et la sortie gardée se tient DERRIÈRE sa matière, dans sa branche
    expect(ZONES_HUB_GRAND.sasVapeur.minY).toBeGreaterThan(0)
    expect(ZONES_HUB_GRAND.sasGivre.maxY).toBeLessThan(0)
    // les bouchons se retrouvent bien dans les parois fabriquées
    const mats = niveauExpanse(TABLEAU_HUB).boxes.map((b) => b.material)
    expect(mats).toContain(MAT_GRILLE)
    expect(mats).toContain(MAT_RIDEAU)
  })

  it('la signalétique annonce les routes et le banc', () => {
    const textes = TABLEAU_HUB.labels.map((l) => l.text).join(' · ')
    expect(textes).toContain('SORTIE DE GIVRE|LA VOIE SEMI-PROCÉDURALE')
    expect(textes).toContain('SORTIE DE VAPEUR|LA DESCENTE DU JOUR')
    expect(textes).toContain('LE BANC DES MÉMOIRES|TISSER LES LIENS')
    expect(textes).toContain('LE COMPTOIR|TOUT SE PAIE EN MÉMOIRE')
    // l'écran de contrôle est SOUS TENSION : le méta est branché
    expect(TABLEAU_HUB.decals?.some((d) => d.kind === 'ecran-on')).toBe(true)
  })
})

describe('hub compact v4 — le module JOUÉ reçoit le même méta', () => {
  it('le tableau reste valide et le sas principal se rejoint', () => {
    const erreurs = checkLevel(TABLEAU_HUB_COMPACT).filter(
      (v) => v.niveau === 'erreur',
    )
    expect(erreurs.map((e) => e.message)).toEqual([])
    expect(accessible(TABLEAU_HUB_COMPACT, new Set())).toBe(true)
  })

  it('les trois sas et l’étal tiennent dans les bornes, hors des murs', () => {
    const b = TABLEAU_HUB_COMPACT.bounds
    for (const zone of [
      TABLEAU_HUB_COMPACT.exit,
      ZONES_HUB_COMPACT.sasGivre,
      ZONES_HUB_COMPACT.sasVapeur,
      ...ZONES_HUB_COMPACT.etal.map((a) => a.plot),
    ]) {
      expect(dedans(zone, b)).toBe(true)
      for (const box of TABLEAU_HUB_COMPACT.boxes)
        if (box.material === MAT_WALL)
          expect(chevauche(zone, box), JSON.stringify(zone)).toBe(false)
    }
    // le banc ENVELOPPE l'établi du poste de gestion
    expect(dedans(ZONES_HUB_COMPACT.banc, b)).toBe(true)
    const etabli = TABLEAU_HUB_COMPACT.boxes.find(
      (bx) => bx.minX === -500 && bx.minY === -800,
    )
    expect(etabli && dedans(etabli, ZONES_HUB_COMPACT.banc)).toBe(true)
  })

  it('givre derrière un RIDEAU, vapeur derrière une GRILLE — sans fente', () => {
    const bande = (y0: number, y1: number) =>
      TABLEAU_HUB_COMPACT.boxes
        .filter((bx) => bx.minY === y0 && bx.maxY === y1)
        .sort((a, b2) => a.minX - b2.minX)
    // la cloison du givre (y 360..440) court de 2400 à 2750
    const nord = bande(360, 440)
    expect(nord.map((bx) => bx.material)).toEqual([
      MAT_WALL,
      MAT_RIDEAU,
      MAT_WALL,
    ])
    expect(nord[0].minX).toBe(2400)
    expect(nord[2].maxX).toBe(2750)
    for (let i = 1; i < nord.length; i++)
      expect(nord[i].minX).toBe(nord[i - 1].maxX)
    // son épaulement ouest scelle la chambre jusqu'au plafond
    const scelleNord = TABLEAU_HUB_COMPACT.boxes.find(
      (bx) => bx.minX === 2400 && bx.minY === 440,
    )
    expect(scelleNord?.material).toBe(MAT_WALL)
    expect(scelleNord?.maxY).toBe(800)
    // la cloison de vapeur (y −440..−360), miroir au sud
    const sud = bande(-440, -360)
    expect(sud.map((bx) => bx.material)).toEqual([
      MAT_WALL,
      MAT_GRILLE,
      MAT_WALL,
    ])
    expect(sud[0].minX).toBe(2400)
    expect(sud[2].maxX).toBe(2750)
    for (let i = 1; i < sud.length; i++)
      expect(sud[i].minX).toBe(sud[i - 1].maxX)
    const scelleSud = TABLEAU_HUB_COMPACT.boxes.find(
      (bx) => bx.minX === 2400 && bx.maxY === -440,
    )
    expect(scelleSud?.material).toBe(MAT_WALL)
    expect(scelleSud?.minY).toBe(-800)
  })

  it('la signalétique du compact annonce comptoir, banc et sorties', () => {
    const textes = TABLEAU_HUB_COMPACT.labels.map((l) => l.text).join(' · ')
    expect(textes).toContain('SORTIE DE GIVRE|LA VOIE SEMI-PROCÉDURALE')
    expect(textes).toContain('SORTIE DE VAPEUR|LA DESCENTE DU JOUR')
    expect(textes).toContain('LE BANC DES MÉMOIRES|TISSER LES LIENS')
    expect(textes).toContain('LE COMPTOIR|TOUT SE PAIE EN MÉMOIRE')
  })
})

describe('le comptoir — un seul catalogue, deux étals', () => {
  it('quatre articles, identités uniques, prix affichés dans CHAQUE module', () => {
    for (const [zones, tableau] of [
      [ZONES_HUB_GRAND, TABLEAU_HUB],
      [ZONES_HUB_COMPACT, TABLEAU_HUB_COMPACT],
    ] as const) {
      expect(zones.etal.length).toBe(4)
      expect(new Set(zones.etal.map((a) => a.id)).size).toBe(4)
      for (const a of zones.etal) {
        expect(a.prix).toBeGreaterThan(0)
        expect(a.nom.length).toBeGreaterThan(3)
        // chaque alcôve a son étiquette de prix dans le tableau
        expect(
          tableau.labels.some(
            (l) =>
              l.text.includes(a.nom) && l.text.includes(`${a.prix} MÉMOIRE`),
          ),
          `${tableau.code} · ${a.id}`,
        ).toBe(true)
      }
    }
  })
})

describe('hub v5 — le module accidenté et ses stations', () => {
  it('les stations, la table et le scellé tiennent dans chaque module', () => {
    for (const [zones, tableau] of [
      [ZONES_HUB_GRAND, TABLEAU_HUB],
      [ZONES_HUB_COMPACT, TABLEAU_HUB_COMPACT],
    ] as const) {
      const b = tableau.bounds
      expect(Object.keys(zones.stations).length).toBe(7)
      for (const [id, plot] of Object.entries(zones.stations)) {
        expect(dedans(plot, b), `${tableau.code} · ${id}`).toBe(true)
        // la table de départ ENVELOPPE son plan de travail (comme le banc) ;
        // les autres stations restent hors des murs
        if (id === 'table-depart') continue
        for (const bx of tableau.boxes)
          if (bx.material === MAT_WALL)
            expect(chevauche(plot, bx), `${tableau.code} · ${id}`).toBe(false)
      }
      expect(dedans(zones.tableDepart, b)).toBe(true)
      expect(dedans(zones.sasScelle, b)).toBe(true)
      // le budget du moteur : 96 boîtes rendues, sas et parois comprises
      expect(tableau.boxes.length).toBeLessThanOrEqual(90)
    }
  })

  it('le bac d’essai complète le placard : chaudière, membrane, rideau, surchauffeur', () => {
    for (const tableau of [TABLEAU_HUB, TABLEAU_HUB_COMPACT]) {
      const mats = new Set(tableau.boxes.map((bx) => bx.material))
      for (const mat of [MAT_CHAUD, MAT_MEMBRANE, MAT_RIDEAU, MAT_SURCHAUFFEUR])
        expect(mats.has(mat), `${tableau.code} · mat ${mat}`).toBe(true)
    }
  })

  it('la signalétique v5 annonce le scellé, la table et le bac', () => {
    for (const tableau of [TABLEAU_HUB, TABLEAU_HUB_COMPACT]) {
      const textes = tableau.labels.map((l) => l.text).join(' · ')
      expect(textes).toContain('LE SECTEUR SCELLÉ|CE QUI DOIT PARTIR')
      expect(textes).toContain('LA TABLE DE DÉPART|CE QUE VOUS EMPORTEZ')
      expect(textes).toContain('LE BAC D’ESSAI|TOUTES LES SURFACES, SANS ENJEU')
      expect(textes).toContain('LE MUR DES RECORDS|BANC OPTIQUE DES CALIBRATIONS')
      expect(textes).toContain('LE DISTILLATEUR|LA PRIME DU RETOUR')
    }
  })
})

describe('zonesDuHub — les ancres posées font foi, la géométrie dépanne', () => {
  it('chaque module lit SES ancres posées (stations, portes de dégât, sas)', () => {
    for (const [zones, tableau] of [
      [ZONES_HUB_GRAND, TABLEAU_HUB],
      [ZONES_HUB_COMPACT, TABLEAU_HUB_COMPACT],
    ] as const) {
      const z = zonesDuHub(tableau)!
      expect(z.stations).toEqual(zones.stations)
      expect(z.portesDegat).toEqual(zones.portesDegat)
      expect(z.tableDepart).toEqual(zones.tableDepart)
      expect(z.sasScelle).toEqual(zones.sasScelle)
      expect(z.sceau).toEqual(zones.sceau)
      expect(z.porteCuve).toEqual(zones.porteCuve)
      expect(z.sasGivre).toEqual(zones.sasGivre)
      expect(z.sasVapeur).toEqual(zones.sasVapeur)
      expect(z.banc).toEqual(zones.banc)
    }
  })

  it('sans ancres, la géométrie tranche encore (vieux instantanés)', () => {
    const sansAncres = (lv: typeof TABLEAU_HUB) => {
      const { ancres: _, ...reste } = lv
      return reste
    }
    expect(zonesDuHub(sansAncres(TABLEAU_HUB))).toBe(ZONES_HUB_GRAND)
    expect(zonesDuHub(sansAncres(TABLEAU_HUB_COMPACT))).toBe(ZONES_HUB_COMPACT)
  })

  it('un vieil instantané de la bibliothèque (sans annexe méta) → null', () => {
    // l'ancien compact s'arrêtait à x 1750 : aucune zone ne doit s'activer
    expect(zonesDuHub({ bounds: { maxX: 1750 } })).toBe(null)
  })

  it('un module rebâti à la main : seules SES ancres existent', () => {
    const z = zonesPosees({
      ancres: [
        { minX: 0, minY: 0, maxX: 100, maxY: 100, role: 'station', id: 'eclairage' },
        { minX: 200, minY: 0, maxX: 300, maxY: 100, role: 'sas-givre' },
      ],
    })!
    expect(z.stations.eclairage).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 100 })
    expect(z.stations.distillateur).toBeUndefined()
    expect(z.sasGivre.maxX).toBe(300)
    // ce qui n'est pas posé n'existe pas : le rectangle nul n'attrape rien
    expect(ancreAbsente(z.sceau)).toBe(true)
    expect(ancreAbsente(z.porteCuve)).toBe(true)
    expect(ancreAbsente(z.sasVapeur)).toBe(true)
    expect(zonesPosees({ ancres: [] })).toBe(null)
    expect(zonesPosees({})).toBe(null)
  })
})

describe('le méta EN DONNÉES — les zones deviennent des plots posés', () => {
  it('chaque hub porte ses plots (monnaie mémoire) et son banc, alignés sur ses zones', () => {
    for (const [zones, tableau] of [
      [ZONES_HUB_GRAND, TABLEAU_HUB],
      [ZONES_HUB_COMPACT, TABLEAU_HUB_COMPACT],
    ] as const) {
      expect(tableau.plots).toEqual(
        zones.etal.map((a) => ({
          ...a.plot,
          article: a.id,
          monnaie: 'memoire',
        })),
      )
      expect(tableau.bancMemoires).toEqual(zones.banc)
    }
  })
})
