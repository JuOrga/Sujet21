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
import { MAX_LUMIERES } from '../render/renderer'
import { niveauExpanse } from './structures'
import { accessible } from './generateur'

type Rect = { minX: number; minY: number; maxX: number; maxY: number }
const dedans = (r: Rect, b: Rect): boolean =>
  r.minX >= b.minX && r.maxX <= b.maxX && r.minY >= b.minY && r.maxY <= b.maxY
const chevauche = (a: Rect, b: Rect): boolean =>
  a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY

describe('hub v9 — la rotonde : le méta a pris ses quartiers', () => {
  // Une zone posée dans une paroi ne s'activerait jamais : le corps ne
  // peut pas entrer dans un mur. Le module est bâti au KIT : les murs sont
  // ceux que les structures fabriquent — c'est sur EUX qu'on juge, au
  // champ de la forme (une coque enveloppe TOUTE sa salle).
  const murs = niveauExpanse(TABLEAU_HUB).boxes
  const dansLeVide = (zone: Rect, nom: string): void => {
    expect(dedans(zone, TABLEAU_HUB.bounds), nom).toBe(true)
    for (const [px, py] of [
      [zone.minX, zone.minY],
      [zone.maxX, zone.minY],
      [zone.minX, zone.maxY],
      [zone.maxX, zone.maxY],
      [(zone.minX + zone.maxX) / 2, (zone.minY + zone.maxY) / 2],
    ])
      for (const box of murs)
        expect(dansBoite(box, px, py), `${nom} ${JSON.stringify(zone)}`).toBe(false)
  }

  it('le tableau reste valide et le sas principal se rejoint', () => {
    const erreurs = checkLevel(TABLEAU_HUB).filter((v) => v.niveau === 'erreur')
    expect(erreurs.map((e) => e.message)).toEqual([])
    // spawn → sas, à la marge du corps (les filtres comptent passants)
    expect(accessible(TABLEAU_HUB, new Set())).toBe(true)
  })

  it('les trois sas, le scellé, l’étal et les stations tiennent dans le VIDE', () => {
    dansLeVide(TABLEAU_HUB.exit, 'exit')
    dansLeVide(ZONES_HUB_GRAND.sasGivre, 'sasGivre')
    dansLeVide(ZONES_HUB_GRAND.sasVapeur, 'sasVapeur')
    dansLeVide(ZONES_HUB_GRAND.sasScelle, 'sasScelle')
    for (const a of ZONES_HUB_GRAND.etal) dansLeVide(a.plot, a.id)
    for (const [id, plot] of Object.entries(ZONES_HUB_GRAND.stations)) {
      // la table de départ ENVELOPPE son plan de travail (comme le banc) :
      // on la juge sur les coques seules, pas sur le meuble
      if (id === 'table-depart') {
        for (const coque of murs.slice(0, STRUCTURES_HUB.length))
          expect(dansBoite(coque, (plot.minX + plot.maxX) / 2, (plot.minY + plot.maxY) / 2)).toBe(false)
        continue
      }
      dansLeVide(plot, id)
    }
    // la zone du banc, elle, ENVELOPPE le banc : le corps qui s'y frotte
    // ouvre l'écran des mémoires
    expect(dedans(ZONES_HUB_GRAND.banc, TABLEAU_HUB.bounds)).toBe(true)
    const banc = TABLEAU_HUB.boxes.find((bx) => bx.minX === -620 && bx.minY === 700)
    expect(banc && dedans(banc, ZONES_HUB_GRAND.banc)).toBe(true)
  })

  // LA LIGNE DE VOL : la promesse du plan. Une seule chose est obligatoire
  // au hub — aller de la cuve au sas — et ce trajet ne doit ni débiter la
  // mémoire, ni ouvrir un écran, ni vendre quoi que ce soit à l'insu du
  // joueur. Toutes les portes obligées sont centrées sur y = 0 ; rien de
  // ce qui réagit au contact ne mord sur la bande que le corps balaie.
  it('la ligne de vol est droite, et rien ne réagit au contact dessus', () => {
    expect(TABLEAU_HUB.spawn.y).toBe(0)
    expect((TABLEAU_HUB.exit.minY + TABLEAU_HUB.exit.maxY) / 2).toBe(0)
    const demi = (TABLEAU_HUB.exit.maxY - TABLEAU_HUB.exit.minY) / 2
    const ligne: Rect = {
      minX: TABLEAU_HUB.spawn.x,
      minY: -demi,
      maxX: TABLEAU_HUB.exit.minX,
      maxY: demi,
    }
    // les couloirs de la ligne (cuve → rotonde → sas) sont sur y = 0
    for (const i of [1, 3]) {
      const c = STRUCTURES_HUB[i]
      expect((c.minY + c.maxY) / 2, `couloir ${i}`).toBe(0)
    }
    for (const [id, plot] of Object.entries(ZONES_HUB_GRAND.stations))
      expect(chevauche(plot, ligne), `station ${id} sur la ligne`).toBe(false)
    for (const a of ZONES_HUB_GRAND.etal)
      expect(chevauche(a.plot, ligne), `alcôve ${a.id} sur la ligne`).toBe(false)
    for (const q of TABLEAU_HUB.pupitres ?? [])
      expect(chevauche(q, ligne), `pupitre ${q.ecran} sur la ligne`).toBe(false)
    expect(chevauche(ZONES_HUB_GRAND.banc, ligne)).toBe(false)
    for (const rects of Object.values(ZONES_HUB_GRAND.portesDegat))
      for (const r of rects) expect(chevauche(r, ligne)).toBe(false)
    expect(chevauche(ZONES_HUB_GRAND.sceau, ligne)).toBe(false)
    // seule exception voulue : la LECTURE de la table de départ, un toast
    // qu'on longe avant de partir — rien à payer, rien à fermer
    expect(chevauche(ZONES_HUB_GRAND.tableDepart, ligne)).toBe(true)
    // et le mobilier laisse passer le corps : aucun meuble sur la bande
    for (const bx of TABLEAU_HUB.boxes)
      expect(chevauche(bx, ligne), JSON.stringify(bx)).toBe(false)
  })

  it('un détour est perpendiculaire : chaque aile se paie à sa porte, depuis la rotonde', () => {
    const rotonde = STRUCTURES_HUB[2]
    for (const id of ['aile-endormis', 'bac-sable']) {
      // le plot de la station est DANS la rotonde, dans l'axe de sa porte
      const plot = ZONES_HUB_GRAND.stations[id]
      expect(dedans(plot, rotonde), id).toBe(true)
      expect((plot.minX + plot.maxX) / 2, id).toBe(0)
      // et sa porte de dégât barre le couloir, HORS de la rotonde
      for (const r of ZONES_HUB_GRAND.portesDegat[id]) {
        expect(chevauche(r, rotonde), id).toBe(false)
        expect(r.minX).toBe(-210)
        expect(r.maxX).toBe(210)
      }
    }
    // l'aile des endormis au nord, le bac au sud
    expect(ZONES_HUB_GRAND.stations['aile-endormis'].minY).toBeGreaterThan(0)
    expect(ZONES_HUB_GRAND.stations['bac-sable'].maxY).toBeLessThan(0)
  })

  it('les consoles sont posées dans le VIDE, sans se recouvrir ni recouvrir un plot', () => {
    const consoles = TABLEAU_HUB.pupitres ?? []
    expect(consoles.map((q) => q.ecran)).toEqual([
      'records',
      'reparations',
      'station',
      'codex',
      'fioles',
      'marchand',
    ])
    for (const q of consoles) dansLeVide(q, q.ecran)
    // deux consoles ne se recouvrent pas : un seul pas, un seul écran
    for (let i = 0; i < consoles.length; i++)
      for (let k = i + 1; k < consoles.length; k++)
        expect(chevauche(consoles[i], consoles[k])).toBe(false)
    // ni un plot d'achat : un pas ne doit pas payer ET ouvrir un écran
    for (const q of consoles)
      for (const a of ZONES_HUB_GRAND.etal)
        expect(chevauche(q, a.plot), q.ecran).toBe(false)
    // LE MUR DES RECORDS : la console est DANS le plot de sa station —
    // elle s'éteint donc avec elle — mais jamais sur tout le plot : la
    // réparation se paie en entrant, la consultation vient après
    const plot = ZONES_HUB_GRAND.stations['mur-records']
    const rec = consoles.find((q) => q.ecran === 'records')!
    expect(dedans(rec, plot)).toBe(true)
    const aire = (r: Rect): number => (r.maxX - r.minX) * (r.maxY - r.minY)
    expect(aire(rec) / aire(plot)).toBeLessThan(0.75)
    // le tableau des avaries, lui, ne dépend d'AUCUNE station : c'est
    // quand tout est en panne qu'on vient le lire
    const av = consoles.find((q) => q.ecran === 'reparations')!
    for (const [id, r] of Object.entries(ZONES_HUB_GRAND.stations))
      expect(chevauche(av, r), `avaries sur ${id}`).toBe(false)
    // LE SEMBLABLE est un pupitre : c'est lui qui ouvre le marchand, pas la
    // boîte englobante des alcôves (élargie de 140, elle mordait la ligne)
    expect(consoles.some((q) => q.ecran === 'marchand')).toBe(true)
  })

  it('le module est bâti AU KIT : quinze coques, et rien n’est posé à la main', () => {
    // la promesse du chantier : le terrain de jeu vient des structures —
    // les boîtes posées ne sont plus que du mobilier
    expect(STRUCTURES_HUB.length).toBe(15)
    expect(TABLEAU_HUB.structures).toBe(STRUCTURES_HUB)
    expect(TABLEAU_HUB.coque).toBe('structures')
    // UNE boîte par coque (plus les deux portes de matière) : le terrain
    // de jeu entier tient dans un quart du budget du moteur
    expect(niveauExpanse(TABLEAU_HUB).boxes.length).toBeLessThanOrEqual(45)
    // le trajet obligé : trois chambres — la cuve, la rotonde, le sas
    const [cuve, , rotonde, , sas] = STRUCTURES_HUB
    expect(dansBoite(cuve, TABLEAU_HUB.spawn.x, TABLEAU_HUB.spawn.y)).toBe(true)
    expect(dansBoite(sas, TABLEAU_HUB.exit.minX, 0)).toBe(true)
    expect(rotonde.maxX - rotonde.minX).toBe(rotonde.maxY - rotonde.minY)
  })

  it('les deux routes gardées sont bouchées par LEUR matière, côte à côte au seuil', () => {
    const tubes = STRUCTURES_HUB.filter((s) => s.bouchon !== undefined)
    expect(tubes.length).toBe(2)
    expect(tubes.map((s) => s.bouchon).sort()).toEqual(
      [MAT_GRILLE, MAT_RIDEAU].sort(),
    )
    // le gaz au nord (la grille), la glace au sud (le rideau), sur le même
    // axe que le sas : les trois bouches se lisent d'un regard
    const gaz = tubes.find((s) => s.bouchon === MAT_GRILLE)!
    const glace = tubes.find((s) => s.bouchon === MAT_RIDEAU)!
    expect(gaz.minY).toBeGreaterThan(0)
    expect(glace.maxY).toBeLessThan(0)
    const sas = STRUCTURES_HUB[4]
    for (const t of [gaz, glace])
      expect((t.minX + t.maxX) / 2).toBe((sas.minX + sas.maxX) / 2)
    // et la sortie gardée se tient DERRIÈRE sa matière : la lame est posée
    // au milieu du couloir (structures.ts), c'est elle qu'on dépasse
    expect(ZONES_HUB_GRAND.sasVapeur.minY).toBeGreaterThan((gaz.minY + gaz.maxY) / 2)
    expect(ZONES_HUB_GRAND.sasGivre.maxY).toBeLessThan((glace.minY + glace.maxY) / 2)
    // les bouchons se retrouvent bien dans les parois fabriquées
    const mats = niveauExpanse(TABLEAU_HUB).boxes.map((b) => b.material)
    expect(mats).toContain(MAT_GRILLE)
    expect(mats).toContain(MAT_RIDEAU)
    // la route du télescope part du pod de vapeur : le corps qui y va ne
    // doit pas LANCER une descente en traversant — la sortie est à l'ouest,
    // la passerelle à l'est
    const plot = ZONES_HUB_GRAND.stations['passerelle-4']
    expect(ZONES_HUB_GRAND.sasVapeur.maxX).toBeLessThan(plot.minX)
    expect(chevauche(ZONES_HUB_GRAND.sasVapeur, plot)).toBe(false)
  })

  it('la signalétique annonce les routes, le banc et les quartiers', () => {
    const textes = TABLEAU_HUB.labels.map((l) => l.text).join(' · ')
    expect(textes).toContain('SORTIE DE GIVRE|LA VOIE SEMI-PROCÉDURALE')
    expect(textes).toContain('SORTIE DE VAPEUR|LA DESCENTE DU JOUR')
    expect(textes).toContain('LE BANC DES MÉMOIRES|TISSER LES LIENS')
    expect(textes).toContain('LE COMPTOIR|TOUT SE PAIE EN MÉMOIRE')
    expect(textes).toContain('LA ROTONDE|LE POSTE DE GESTION')
    expect(textes).toContain('CUVES 1 À 21|VINGT SONT VIDES')
    // l'écran de contrôle est SOUS TENSION : le méta est branché
    expect(TABLEAU_HUB.decals?.some((d) => d.kind === 'ecran-on')).toBe(true)
    // les sept pictogrammes d'état du poste de gestion (bible v3.1)
    expect(TABLEAU_HUB.labels.filter((l) => l.picto).length).toBe(7)
    // les vingt alvéoles de la cuve, plus les six endormis et la vitrine
    expect(
      TABLEAU_HUB.decals?.filter((d) => d.kind.startsWith('fiole-')).length,
    ).toBe(20 + 6 + 3)
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

// LE PLAN DE LAMPES. Le moteur n'allume que les MAX_LUMIERES premières :
// tant que le hub en posait six, l'étal et le sas restaient ÉTEINTS et
// l'est du module ne vivait que de la lumière qui fuyait par-dessus les
// murs de l'ouest. Depuis que les coques montent au plafond, cette fuite
// n'existe plus — le plan doit donc tenir en quatre lampes, et ces quatre
// doivent atteindre les ailes et les pods.
describe('hub — les lampes posées sont les lampes allumées', () => {
  const lampes = TABLEAU_HUB.lumieres ?? []

  it('n’en pose pas plus que le moteur n’en allume', () => {
    expect(lampes.length).toBeLessThanOrEqual(MAX_LUMIERES)
    expect(
      checkLevel(TABLEAU_HUB).filter((v) => v.message.includes('Trop de lampes')),
    ).toEqual([])
  })

  // Un bandeau éclaire depuis le point de son segment le plus proche : ses
  // DEUX BOUTS doivent tomber dans les coques qu'il dessert, sinon il n'en
  // couvre qu'une et la salle du bout retombe au rebond.
  const bouts = (l: (typeof lampes)[number]) => {
    const a = (((l.angle ?? 0) % 360) * Math.PI) / 180
    const demi = Math.max(40, Math.min(800, (l.longueur ?? 260) / 2))
    return [
      { x: l.x - Math.cos(a) * demi, y: l.y - Math.sin(a) * demi },
      { x: l.x + Math.cos(a) * demi, y: l.y + Math.sin(a) * demi },
    ]
  }
  const coque = (i: number) => STRUCTURES_HUB[i]

  it('les deux bandeaux verticaux descendent la rotonde et le sas jusqu’à leurs branches', () => {
    const bandeaux = lampes.filter((l) => l.forme === 'bandeau')
    expect(bandeaux).toHaveLength(2)
    // 2 : la rotonde, ses bouts au bord des couloirs des ailes (5 et 7) ;
    // 4 : le sas, ses bouts dans les montées du gaz (9) et de la glace (11)
    const [rotonde, sas] = bandeaux
    const [rSud, rNord] = bouts(rotonde)
    expect(dansBoite(coque(2), rSud.x, rSud.y)).toBe(true)
    expect(dansBoite(coque(2), rNord.x, rNord.y)).toBe(true)
    expect(dansBoite(coque(5), rNord.x, rNord.y + 60)).toBe(true)
    expect(dansBoite(coque(7), rSud.x, rSud.y - 60)).toBe(true)
    const [sSud, sNord] = bouts(sas)
    expect(dansBoite(coque(9), sNord.x, sNord.y)).toBe(true)
    expect(dansBoite(coque(11), sSud.x, sSud.y)).toBe(true)
  })

  // Un bandeau traverse les cloisons : dessiné, son luminaire se coucherait
  // en travers des murs. Il éclaire, il ne se montre pas.
  it('les bandeaux n’ont pas de corps — le segment traverse les murs', () => {
    for (const l of lampes.filter((x) => x.forme === 'bandeau'))
      expect(l.taille).toBe(0)
  })

  it('la cuve garde sa lampe froide, le comptoir sa lampe chaude', () => {
    const rondes = lampes.filter((l) => l.forme !== 'bandeau')
    expect(rondes).toHaveLength(2)
    const [cuve, comptoir] = rondes
    expect(dansBoite(coque(0), cuve.x, cuve.y)).toBe(true)
    // le comptoir : dans le quartier sud-ouest de la rotonde
    expect(dansBoite(coque(2), comptoir.x, comptoir.y)).toBe(true)
    expect(comptoir.x).toBeLessThan(0)
    expect(comptoir.y).toBeLessThan(0)
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
      // le budget du moteur (160 boîtes rendues, sas et parois comprises) — le
      // hub reste loin dessous : il doit tourner partout, pas seulement là où
      // le budget passe
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
