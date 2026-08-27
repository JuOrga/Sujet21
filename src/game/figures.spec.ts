// Le MODE FIGURE du générateur : chaque famille produit, sur plusieurs
// graines, un tableau PROUVÉ — et le tableau respecte la grammaire des
// compositions faites main (sobriété, éclairage de base, immensité).
import { describe, expect, it } from 'vitest'
import {
  OPTIONS_DEFAUT,
  analyseSaisie,
  decodeOptions,
  encodeOptions,
  genereNiveau,
  genereNiveauDetaille,
  valideNiveau,
  type OptionsGen,
} from './generateur'
import { FIGURE_FAMILLES } from './figures'
import {
  MAT_GRILLE,
  MAT_MEMBRANE,
  MAT_RIDEAU,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_FROID,
  MAT_CHAUD,
  MAT_SURCHAUFFEUR,
} from './level'

const opts = (sur: Partial<OptionsGen>): OptionsGen => ({
  ...OPTIONS_DEFAUT,
  ...sur,
})

const GRAINES = [7, 1234, 987654, 42424242]

describe('générateur en mode figure', () => {
  it('chaque famille produit une salle prouvée, sur plusieurs graines', () => {
    for (let f = 0; f < FIGURE_FAMILLES.length; f++) {
      for (const graine of GRAINES) {
        // la validation interne fait foi — on la rejoue en rattachant les
        // preuves que genereNiveauDetaille rend à part
        const { niveau, preuves } = genereNiveauDetaille(
          graine,
          null,
          opts({ figure: f + 2 }),
        )
        ;(niveau as { __preuves?: unknown }).__preuves = preuves
        const verdict = valideNiveau(niveau)
        expect(
          verdict.raisons,
          `${FIGURE_FAMILLES[f]} graine ${graine}`,
        ).toEqual([])
      }
    }
  })

  it('la grammaire des compositions : sobre, vaste, sans lampe', () => {
    for (const graine of GRAINES) {
      const lv = genereNiveau(graine, null, opts({ figure: 1 }))
      // la SOBRIÉTÉ : un glyphe, pas une soupe
      expect(lv.boxes.length).toBeLessThanOrEqual(26)
      // l'ÉCLAIRAGE DE BASE : aucune lampe posée
      expect(lv.lumieres ?? []).toEqual([])
      expect(lv.ambiante).toBeUndefined()
      // l'IMMENSITÉ : le champ est plus grand que toute salle à compartiments
      const largeur = lv.bounds.maxX - lv.bounds.minX
      const hauteur = lv.bounds.maxY - lv.bounds.minY
      expect(largeur).toBeGreaterThanOrEqual(4600)
      expect(hauteur).toBeGreaterThanOrEqual(3600)
      // le corps naît plein : 900 particules comme les tableaux faits main
      expect(lv.spawn.n).toBe(900)
      // les COUTURES GARDÉES : des filtres d'état existent
      const filtres = lv.boxes.filter((b) =>
        [MAT_MEMBRANE, MAT_RIDEAU, MAT_GRILLE].includes(b.material),
      )
      expect(filtres.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('même graine, même figure — le déterminisme tient', () => {
    const a = genereNiveau(4242, null, opts({ figure: 1 }))
    const b = genereNiveau(4242, null, opts({ figure: 1 }))
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('mécanismes : « aucun » n’en pose pas, « deux verrous » pose porte, lasers et pastilles', () => {
    const sans = genereNiveau(99, null, opts({ figure: 2, mecanismes: 1 }))
    expect(sans.portes ?? []).toEqual([])
    expect(sans.lasers ?? []).toEqual([])
    let trouve = false
    for (const graine of GRAINES) {
      const avec = genereNiveau(
        graine,
        null,
        opts({ figure: 2, mecanismes: 3 }),
      )
      if ((avec.portes ?? []).length > 0) {
        trouve = true
        expect((avec.lasers ?? []).length).toBeGreaterThanOrEqual(1)
        expect((avec.cibles ?? []).length).toBeGreaterThanOrEqual(1)
        // chaque porte a son canal pastillé
        for (const p of avec.portes ?? []) {
          expect(
            (avec.cibles ?? []).some((c) => (c.canal ?? 0) === p.canal),
          ).toBe(true)
        }
      }
    }
    expect(trouve, 'au moins une graine pose ses deux verrous').toBe(true)
  })

  it('l’ampleur est paramétrable : intime < vaste < immense', () => {
    const li = genereNiveau(5, null, opts({ figure: 2, ampleur: 1 }))
    const lv = genereNiveau(5, null, opts({ figure: 2, ampleur: 2 }))
    const lg = genereNiveau(5, null, opts({ figure: 2, ampleur: 3 }))
    const larg = (l: typeof li): number => l.bounds.maxX - l.bounds.minX
    expect(larg(li)).toBeLessThan(larg(lv))
    expect(larg(lv)).toBeLessThan(larg(lg))
  })

  it('les réglages figure voyagent dans le suffixe — et les anciens codes se décodent inchangés', () => {
    const o = opts({ figure: 4, ampleur: 3, mecanismes: 2 })
    const suffixe = encodeOptions(o)
    expect(suffixe).not.toBe('')
    expect(decodeOptions(suffixe)).toEqual(o)
    // un ancien suffixe (18 bits : contraste seul) garde son sens, figure à zéro
    const ancien = (1 << 17) | (127 << 2)
    const lu = decodeOptions(ancien.toString(36))
    expect(lu?.contraste).toBe(1)
    expect(lu?.figure).toBe(0)
    expect(lu?.ampleur).toBe(0)
    expect(lu?.mecanismes).toBe(0)
  })

  it('conduits : la leçon de BOIZ — gaines minces, bande compacte, canal-réseau', () => {
    const lv = genereNiveau(1234, null, opts({ figure: 8, mecanismes: 3 }))
    // la CUVE EN BANDE : large et basse, l'inverse du champ immense
    const w = lv.bounds.maxX - lv.bounds.minX
    const h = lv.bounds.maxY - lv.bounds.minY
    expect(w / h).toBeGreaterThan(1.8)
    expect(h).toBeLessThan(1400)
    // des GAINES : une majorité de murs minces (22 u)
    const minces = lv.boxes.filter(
      (b) => Math.min(b.maxX - b.minX, b.maxY - b.minY) <= 24,
    )
    expect(minces.length).toBeGreaterThanOrEqual(6)
    // le CANAL-RÉSEAU : plusieurs portes sur le même canal
    const parCanal = new Map<number, number>()
    for (const p of lv.portes ?? [])
      parCanal.set(p.canal, (parCanal.get(p.canal) ?? 0) + 1)
    expect(Math.max(...parCanal.values())).toBeGreaterThanOrEqual(2)
    // le PHARE unique et la CACHETTE
    expect((lv.lumieres ?? []).length).toBe(1)
    expect((lv.caches ?? []).length).toBe(1)
    // le sas au cœur : l'exit est DANS la cuve, pas à son bord est
    expect(lv.exit.maxX).toBeLessThan(lv.bounds.maxX - 400)
  })

  it('fusion : la leçon de la voie de la fusion — le puzzle de matière', () => {
    const lv = genereNiveau(555, null, opts({ figure: 9 }))
    // ZÉRO mécanisme, ZÉRO lampe : la matière fait tout
    expect(lv.lasers ?? []).toEqual([])
    expect(lv.portes ?? []).toEqual([])
    expect(lv.lumieres ?? []).toEqual([])
    // les ZONES FORCE-GLACE existent
    expect((lv.zones ?? []).length).toBeGreaterThanOrEqual(1)
    for (const z of lv.zones ?? []) expect(z.force).toBe('glace')
    // la MOSAÏQUE : des surfaces à caractère en nombre
    const caracteres = lv.boxes.filter((b) =>
      [
        MAT_HYDROPHILE,
        MAT_HYDROPHOBE,
        MAT_FROID,
        MAT_MEMBRANE,
        MAT_RIDEAU,
      ].includes(b.material),
    )
    expect(caracteres.length).toBeGreaterThanOrEqual(5)
    // l'ÉPONGE et le grenier voilé
    expect((lv.sponges ?? []).length).toBe(1)
    expect((lv.caches ?? []).length).toBe(1)
    // les MEMBRANES ne trempent jamais dans une zone gelée (la fonte
    // doit rester possible)
    for (const b of lv.boxes) {
      if (b.material !== MAT_MEMBRANE) continue
      for (const z of lv.zones ?? []) {
        const recouvre =
          b.minX < z.maxX &&
          b.maxX > z.minX &&
          b.minY < z.maxY &&
          b.maxY > z.minY
        expect(recouvre, 'membrane dans une zone force-glace').toBe(false)
      }
    }
  })

  it('échangeur : la leçon d’echangette — le circuit thermique', () => {
    const lv = genereNiveau(555, null, opts({ figure: 10 }))
    // le VOCABULAIRE THERMIQUE au complet : chaudière, froid, surchauffeur
    const mats = new Set(lv.boxes.map((b) => b.material))
    expect(mats.has(MAT_CHAUD)).toBe(true)
    expect(mats.has(MAT_FROID)).toBe(true)
    expect(mats.has(MAT_SURCHAUFFEUR)).toBe(true)
    expect(mats.has(MAT_MEMBRANE)).toBe(true)
    // le CYCLE imposé : une zone gèle, une zone recondense
    const forces = (lv.zones ?? []).map((z) => z.force).sort()
    expect(forces).toEqual(['eau', 'glace'])
    // la MASSE : de grands blocs pleins (pas des gaines)
    const massifs = lv.boxes.filter(
      (b) => (b.maxX - b.minX) * (b.maxY - b.minY) > 150000,
    )
    expect(massifs.length).toBeGreaterThanOrEqual(4)
    // l'éponge-plancher, la chambre voilée, la lampe bandeau
    expect((lv.sponges ?? []).length).toBe(1)
    expect((lv.caches ?? []).length).toBe(1)
    expect(lv.lumieres?.[0]?.forme).toBe('bandeau')
    // zéro laser : les machines thermiques sont les mécanismes
    expect(lv.lasers ?? []).toEqual([])
  })

  it('voies : la leçon des 3 voies — la tresse des trois routes', () => {
    const lv = genereNiveau(555, null, opts({ figure: 11, mecanismes: 3 }))
    // les TROIS PORTES D'ÉTAT de la chambre natale : rideau, membrane,
    // grille — on choisit sa voie en choisissant son état
    const mats = new Set(lv.boxes.map((b) => b.material))
    expect(mats.has(MAT_RIDEAU)).toBe(true)
    expect(mats.has(MAT_MEMBRANE)).toBe(true)
    expect(mats.has(MAT_GRILLE)).toBe(true)
    expect(mats.has(MAT_FROID)).toBe(true)
    expect(mats.has(MAT_SURCHAUFFEUR)).toBe(true)
    // les PILIERS SUSPENDUS : des hydrophiles pendus à la ligne basse
    const piliers = lv.boxes.filter(
      (b) => b.material === MAT_HYDROPHILE && b.maxY - b.minY > 200,
    )
    expect(piliers.length).toBeGreaterThanOrEqual(2)
    // les DEUX voiles : le grenier et le couloir secret de l'est
    expect((lv.caches ?? []).length).toBe(2)
    // les éponges en nombre (la colonne-buveuse et les angles)
    expect((lv.sponges ?? []).length).toBeGreaterThanOrEqual(3)
    // AUCUNE lampe : la lumière de base départage les routes (BOIZ)
    expect(lv.lumieres ?? []).toEqual([])
    // les deux canaux : le couloir secret (2 portes) et la trappe
    const parCanal = new Map<number, number>()
    for (const p of lv.portes ?? [])
      parCanal.set(p.canal, (parCanal.get(p.canal) ?? 0) + 1)
    expect(parCanal.get(2)).toBe(2)
    expect(parCanal.get(1)).toBe(1)
    expect((lv.lasers ?? []).length).toBe(2)
    // le SAS flotte au bout du couloir médian, pas au bord est
    expect(lv.exit.maxX).toBeLessThan(lv.bounds.maxX - 400)
    // sans mécanisme : des plaques d'état remplacent les portes
    const sans = genereNiveau(555, null, opts({ figure: 11, mecanismes: 1 }))
    expect(sans.portes ?? []).toEqual([])
    expect(sans.lasers ?? []).toEqual([])
    expect(sans.boxes.length).toBeGreaterThan(lv.boxes.length)
  })

  it('le grand bit de figure (familles ≥ 8) voyage et revient', () => {
    const o = opts({ figure: 8, ampleur: 1, mecanismes: 2 })
    const suffixe = encodeOptions(o)
    expect(decodeOptions(suffixe)).toEqual(o)
    const lv = genereNiveau(4242, null, o)
    const lue = analyseSaisie(lv.code)
    expect(lue?.options).toEqual(o)
  })

  it('le code de la salle redonne la même salle, réglages compris', () => {
    const o = opts({ figure: 3, mecanismes: 2 })
    const lv = genereNiveau(777, null, o)
    expect(lv.code).toContain('~')
    // le suffixe du code décode les mêmes options
    const suffixe = lv.code.split('~')[1]
    expect(decodeOptions(suffixe)).toEqual(o)
    // et RETAPER le code complet (suffixe long compris) se relit : la
    // saisie redonne graine et options — le contrat du générateur
    const lue = analyseSaisie(lv.code)
    expect(lue).not.toBeNull()
    expect(lue?.options).toEqual(o)
    if (lue && lue.type === 'libre') {
      const rejoue = genereNiveau(lue.graine, null, lue.options ?? o)
      expect(JSON.stringify(rejoue)).toBe(JSON.stringify(lv))
    }
  })
})
