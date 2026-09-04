import { describe, expect, it } from 'vitest'
import {
  DOMAINE_NOMS,
  catalogueMarkdown,
  catalogueTextes,
  comptesParDomaine,
  enCle,
} from './catalogue'
import { CODEX_EXPERIENCES } from '../game/codex'
import { TABLEAUX } from '../game/level'
import { INSTRUMENTS } from '../game/instruments'
import { TROPHEES } from '../game/trophees'
import { FIOLES } from '../game/fioles'
import { LEVIERS } from '../game/leviers'
import { REPARATIONS } from '../game/reparations'
import { CINEMATIQUES_LIVREES } from '../game/cinematique'
import { TABLEAU_HUB, TABLEAU_HUB_COMPACT } from '../game/hub'

// LE CATALOGUE DOIT ÊTRE COMPLET, SINON IL NE SERT À RIEN.
// Un texte qui n'y paraît pas est un texte qu'on ne saura ni relire ni
// traduire — et personne ne s'en apercevra avant de le lire en jeu, dans
// la mauvaise langue. Ces tests sont donc des tests de COUVERTURE : ils
// comparent le catalogue aux modules eux-mêmes, pas à une liste figée.

const CAT = catalogueTextes()

describe('Le catalogue des textes', () => {
  it('n’a aucune clé en double — c’est ce qui le rend traduisible', () => {
    const cles = CAT.map((e) => e.cle)
    const vues = new Map<string, number>()
    for (const c of cles) vues.set(c, (vues.get(c) ?? 0) + 1)
    const doublons = [...vues].filter(([, n]) => n > 1).map(([c]) => c)
    expect(doublons).toEqual([])
    expect(new Set(cles).size).toBe(cles.length)
  })

  it('ne contient jamais de texte vide, ni de clé vide', () => {
    for (const e of CAT) {
      expect(e.cle.length, e.cle).toBeGreaterThan(0)
      expect(e.texte.trim().length, e.cle).toBeGreaterThan(0)
      expect(e.ou.length, e.cle).toBeGreaterThan(0)
      expect(DOMAINE_NOMS[e.domaine], e.cle).toBeTruthy()
    }
  })

  it('les clés se lisent : domaine, sujet, champ — jamais un indice opaque seul', () => {
    for (const e of CAT) {
      expect(e.cle.startsWith(`${e.domaine}.`), e.cle).toBe(true)
      expect(e.cle.split('.').length, e.cle).toBeGreaterThanOrEqual(3)
      // pas d'espace ni de majuscule : une clé se tape, elle ne se traduit pas
      expect(e.cle, e.cle).toMatch(/^[a-z0-9.\-_]+$/)
    }
  })

  it('enCle met tous les identifiants du jeu au même régime', () => {
    expect(enCle('seuilDispersion')).toBe('seuil-dispersion') // camelCase
    expect(enCle('ESSAI')).toBe('essai') // capitales
    expect(enCle('21-A')).toBe('21-a') // code de tableau
    expect(enCle('hub.table-depart')).toBe('hub-table-depart')
    expect(enCle('écope à condensat')).toBe('ecope-a-condensat') // accents
    expect(enCle('--x--')).toBe('x')
  })

  // ---- COUVERTURE : le catalogue suit les modules, il ne les devine pas ----

  it('couvre TOUTES les fiches du codex, titre et corps', () => {
    for (const f of CODEX_EXPERIENCES) {
      const k = enCle(f.id)
      expect(CAT.find((e) => e.cle === `codex.${k}.titre`)?.texte).toBe(f.titre)
      expect(CAT.find((e) => e.cle === `codex.${k}.texte`)?.texte).toBe(
        f.texte.trim(),
      )
    }
    expect(CAT.filter((e) => e.domaine === 'codex').length).toBe(CODEX_EXPERIENCES.length * 2)
  })

  it('couvre TOUS les tableaux : nom, journal et chaque pancarte', () => {
    for (const lv of TABLEAUX) {
      const k = enCle(lv.code)
      expect(CAT.find((e) => e.cle === `tableau.${k}.nom`)?.texte).toBe(lv.name)
      const panneaux = CAT.filter(
        (e) => e.domaine === 'tableau' && e.sujet === lv.code && e.champ.startsWith('panneau'),
      )
      // autant d'entrées que d'étiquettes PORTEUSES DE TEXTE (une étiquette
      // peut n'être qu'un pictogramme : elle n'a rien à traduire)
      const avecTexte = lv.labels.filter((l) => l.text.trim().length > 0)
      expect(panneaux.length, lv.code).toBe(avecTexte.length)
    }
  })

  it('couvre les deux modules du hub, l’Économat, et ce qui s’y achète', () => {
    for (const [sujet, lv] of [
      ['grand', TABLEAU_HUB],
      ['compact', TABLEAU_HUB_COMPACT],
    ] as const) {
      expect(CAT.find((e) => e.cle === `hub.${sujet}.nom`)?.texte).toBe(lv.name)
      const panneaux = CAT.filter(
        (e) => e.sujet === sujet && e.champ.startsWith('panneau'),
      )
      expect(panneaux.length, sujet).toBe(
        lv.labels.filter((l) => l.text.trim().length > 0).length,
      )
    }
    expect(CAT.some((e) => e.cle === 'economat.salle.journal')).toBe(true)
    expect(CAT.some((e) => e.cle.startsWith('economat.etal.'))).toBe(true)
    expect(CAT.some((e) => e.cle.startsWith('hub.comptoir.'))).toBe(true)
  })

  it('couvre cartes, fioles, trophées, réparations et cinématiques', () => {
    for (const d of INSTRUMENTS)
      expect(CAT.find((e) => e.cle === `carte.${enCle(d.id)}.nom`)?.texte).toBe(d.nom)
    for (const f of FIOLES)
      expect(CAT.find((e) => e.cle === `fiole.${enCle(f.id)}.nom`)?.texte).toBe(f.nom)
    for (const t of TROPHEES)
      expect(CAT.find((e) => e.cle === `trophee.${enCle(t.id)}.desc`)?.texte).toBe(
        t.desc,
      )
    for (const r of REPARATIONS)
      expect(CAT.find((e) => e.cle === `reparation.${enCle(r.id)}.nom`)?.texte).toBe(
        r.nom,
      )
    for (const c of CINEMATIQUES_LIVREES) {
      const code = enCle(c.code)
      expect(CAT.some((e) => e.cle === `cinematique.${code}.titre`)).toBe(true)
      const dites = c.planches.filter((p) => p.texte.trim().length > 0).length
      expect(
        CAT.filter((e) => e.sujet === c.code && e.champ.startsWith('planche')).length,
        c.code,
      ).toBe(dites)
    }
  })

  it('marque les phrases ENGENDRÉES : ce ne sont pas des chaînes à réécrire', () => {
    const engendrees = CAT.filter((e) => e.engendre)
    // une par levier — ce sont elles qui coûteront le plus à traduire
    expect(engendrees.length).toBe(LEVIERS.length)
    for (const e of engendrees) expect(e.cle).toMatch(/^levier\..+\.phrase$/)
    // et elles ne sont jamais vides : chaque levier sait se dire
    for (const e of engendrees) expect(e.texte.length).toBeGreaterThan(8)
  })

  it('pèse ce que l’inventaire annonçait : quelques centaines d’entrées', () => {
    // garde-fou d'ordre de grandeur : si le catalogue tombe à cent entrées,
    // c'est qu'une source a cessé d'être parcourue sans que rien ne crie
    // (le journal — récit et fins, 22 entrées — s'écrit dans son atelier,
    // hors catalogue : le seuil en tient compte)
    expect(CAT.length).toBeGreaterThan(450)
    const car = CAT.reduce((s, e) => s + e.texte.length, 0)
    expect(car).toBeGreaterThan(20_000)
  })

  it('se range par domaine, du plus lourd au plus léger', () => {
    const c = comptesParDomaine(CAT)
    expect(c.length).toBeGreaterThan(5)
    for (let i = 1; i < c.length; i++)
      expect(c[i - 1].caracteres).toBeGreaterThanOrEqual(c[i].caracteres)
    expect(c.reduce((s, x) => s + x.entrees, 0)).toBe(CAT.length)
    // le codex est le plus gros gisement de lore — c'est le fait qui a
    // orienté l'ordre des travaux
    expect(c[0].domaine === 'codex' || c[0].domaine === 'tableau').toBe(true)
  })

  it('s’exporte en Markdown, clés comprises', () => {
    const md = catalogueMarkdown(CAT)
    expect(md).toContain('# Sujet 21 — catalogue des textes')
    for (const e of [CAT[0], CAT[CAT.length - 1]]) {
      expect(md).toContain(`\`${e.cle}\``)
      expect(md).toContain(e.texte.split('\n')[0])
    }
  })
})
