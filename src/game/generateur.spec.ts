import { describe, expect, it } from 'vitest'
import {
  accessible,
  analyseSaisie,
  creeRng,
  decodeOptions,
  encodeOptions,
  genereNiveau,
  genereNiveauAtelier,
  genereNiveauDetaille,
  graineAtelier,
  graineDepuisTexte,
  OPTIONS_DEFAUT,
  prouveBarriere,
  prouveMiroir,
  prouvePlasma,
  valideNiveau,
} from './generateur'
import { checkLevel } from './levelIO'
import { MAT_GRILLE, MAT_RIDEAU } from './level'

describe('generateur — une graine, une salle PROUVÉE', () => {
  it('est déterministe : même graine, même salle — au caractère près', () => {
    const a = JSON.stringify(genereNiveau(42))
    const b = JSON.stringify(genereNiveau(42))
    expect(a).toBe(b)
    expect(JSON.stringify(genereNiveau(43))).not.toBe(a)
  })

  it('le RNG est stable (mulberry32) : la suite ne bougera jamais', () => {
    const rng = creeRng(7)
    const suite = [rng(), rng(), rng()]
    const rng2 = creeRng(7)
    expect([rng2(), rng2(), rng2()]).toEqual(suite)
    // valeurs figées : un changement d'algorithme casserait TOUTES les graines
    expect(suite[0]).toBeCloseTo(0.011704753153026104, 12)
  })

  it("cinquante graines : toutes valides, sans erreur d'éditeur, sas accessible", () => {
    for (let g = 1; g <= 50; g++) {
      const niveau = genereNiveau(g)
      const erreurs = checkLevel(niveau).filter((v) => v.niveau === 'erreur')
      expect(erreurs, `graine ${g} : ${erreurs.map((e) => e.message).join(' · ')}`).toEqual([])
      // toutes les portes livrées sont ouvrables : la validation les a prouvées
      const ouvrables = new Set((niveau.portes ?? []).map((p) => p.canal))
      expect(accessible(niveau, ouvrables), `graine ${g} : sas inaccessible`).toBe(true)
    }
  })

  it('chaque porte livrée porte son énigme : émetteur + pastille du même canal', () => {
    for (let g = 1; g <= 50; g++) {
      const niveau = genereNiveau(g)
      for (const porte of niveau.portes ?? []) {
        const pastilles = (niveau.cibles ?? []).filter(
          (c, i) => (c.canal ?? i + 1) === porte.canal,
        )
        expect(pastilles.length, `graine ${g}, canal ${porte.canal}`).toBeGreaterThan(0)
      }
      if ((niveau.portes?.length ?? 0) > 0) {
        expect(niveau.lasers?.length ?? 0).toBeGreaterThan(0)
        // l'énigme est signalée au joueur : l'étiquette de SON espèce existe
        const marques = ['MIROIR DE GLACE', 'IONISER ICI', 'TRAVERSER EN VAPEUR']
        expect(niveau.labels.some((l) => marques.includes(l.text))).toBe(true)
      }
    }
  })

  it("la preuve du miroir discrimine : sans glace la porte reste close, avec elle s'ouvre", () => {
    // on cherche une graine à miroir, puis on rejoue la preuve sur la salle
    // finie — position ET normale viennent de la preuve (le montage varie)
    for (let g = 1; g <= 80; g++) {
      const { niveau, preuves } = genereNiveauDetaille(g)
      const p = preuves.find((q) => q.kind === 'miroir')
      if (!p) continue
      const { sansGlace, avecGlace } = prouveMiroir(niveau, p.emetteur, p.spot, p.canal, p.normale)
      expect(sansGlace).toBe(false)
      expect(avecGlace).toBe(true)
      return
    }
    throw new Error('aucune graine à miroir parmi 1..80 — invraisemblable')
  })

  it('un niveau saboté est refusé : le sas muré ne passe pas la validation', () => {
    // une salle SANS porte : la validation rejouée ne bute que sur le mur.
    // Le sas est EMMURÉ d'un anneau — l'orientation du niveau (qui varie
    // désormais) n'y change rien.
    let niveau = genereNiveau(1)
    for (let g = 1; (niveau.portes?.length ?? 0) > 0; g++) niveau = genereNiveau(g)
    const e = niveau.exit
    const cx = (e.minX + e.maxX) / 2
    const cy = (e.minY + e.maxY) / 2
    const R = 260
    const anneau = [
      { minX: cx - R, minY: cy - R, maxX: cx + R, maxY: cy - R + 60, material: 0 },
      { minX: cx - R, minY: cy + R - 60, maxX: cx + R, maxY: cy + R, material: 0 },
      { minX: cx - R, minY: cy - R, maxX: cx - R + 60, maxY: cy + R, material: 0 },
      { minX: cx + R - 60, minY: cy - R, maxX: cx + R, maxY: cy + R, material: 0 },
    ]
    const sabote = { ...niveau, boxes: [...niveau.boxes, ...anneau] }
    const verdict = valideNiveau(sabote)
    expect(verdict.valide).toBe(false)
    expect(verdict.raisons.join(' ')).toContain('inaccessible')
  })

  it('le CODE ATELIER se lit : « 101 », « 101-K7 », « G-101-K7 » — et la graine libre reste', () => {
    expect(analyseSaisie('101')).toEqual({
      type: 'atelier',
      cahier: { moment: 1, mecanique: 0, difficulte: 1 },
      variante: null,
      options: null,
    })
    expect(analyseSaisie('g-231 - K7')).toEqual({
      type: 'atelier',
      cahier: { moment: 2, mecanique: 3, difficulte: 1 },
      variante: 'K7',
      options: null,
    })
    expect(analyseSaisie('401')).toEqual({
      type: 'libre',
      graine: parseInt('401', 36),
      options: null,
    })
    expect(analyseSaisie('ZZ')).toEqual({ type: 'libre', graine: 1295, options: null })
    expect(analyseSaisie('hé hé')).toBeNull()
  })

  it('les OPTIONS voyagent dans le code : suffixe ~, aller-retour, identité', () => {
    // le défaut ne s'encode pas — le code reste court
    expect(encodeOptions(OPTIONS_DEFAUT)).toBe('')
    // un réglage s'encode, se décode, et se relit depuis une saisie
    const o = { ...OPTIONS_DEFAUT, salles: 5 as const, dangers: 1 as const }
    const suf = encodeOptions(o)
    expect(suf).not.toBe('')
    expect(decodeOptions(suf)).toEqual(o)
    const lue = analyseSaisie(`212-K7~${suf}`)
    expect(lue && lue.type === 'atelier' && lue.options).toEqual(o)
    // la salle paramétrée porte le suffixe, et le code complet la redonne
    const a = genereNiveauAtelier({ moment: 2, mecanique: 1, difficulte: 2 }, 'K7', o)
    expect(a.code).toBe(`G-212-K7~${suf}`)
    expect(a.lumieres!.length).toBe(4) // 5 salles forcées (4 lampes au plus)
    const relue = analyseSaisie(a.code)!
    expect(relue.type).toBe('atelier')
    if (relue.type === 'atelier') {
      const b = genereNiveauAtelier(relue.cahier, relue.variante!, relue.options!)
      expect(JSON.stringify(b)).toBe(JSON.stringify(a))
    }
  })

  it("le LABYRINTHE se dose : « aucun » est tout droit, « dédale » serpente", () => {
    // une traverse est un mur de 50 d'épaisseur, long — horizontal ou
    // vertical (l'orientation du niveau peut tout retourner)
    const nbTraverses = (n: ReturnType<typeof genereNiveau>): number =>
      n.boxes.filter(
        (b) =>
          b.material === 0 &&
          ((b.maxY - b.minY === 50 && b.maxX - b.minX >= 200) ||
            (b.maxX - b.minX === 50 && b.maxY - b.minY >= 200)),
      ).length
    let cumulAucun = 0
    let cumulDedale = 0
    for (const g of [3, 4, 5, 6]) {
      const droit = genereNiveau(g, null, { ...OPTIONS_DEFAUT, laby: 1 })
      const dedale = genereNiveau(g, null, { ...OPTIONS_DEFAUT, laby: 3 })
      cumulAucun += nbTraverses(droit)
      cumulDedale += nbTraverses(dedale)
      // les deux restent PROUVÉES traversables (générées, donc validées)
      expect(checkLevel(dedale).filter((v) => v.niveau === 'erreur')).toEqual([])
    }
    expect(cumulAucun).toBe(0)
    expect(cumulDedale).toBeGreaterThan(3)
  })

  it("le mode CONTRASTÉ sculpte la lumière : ambiante éteinte, lampes basses, bandeaux", () => {
    const o = { ...OPTIONS_DEFAUT, contraste: 1 as const }
    let bandeaux = 0
    for (const g of [11, 12, 13, 14]) {
      const n = genereNiveau(g, null, o)
      expect(n.ambiante!, `graine ${g}`).toBeLessThanOrEqual(0.2)
      expect(n.lumieres!.length).toBeGreaterThan(0)
      for (const l of n.lumieres!) {
        expect(l.h!, `graine ${g} : lampe haute`).toBeLessThanOrEqual(180)
        expect(l.intensite!, `graine ${g}`).toBeGreaterThanOrEqual(1.1)
      }
      bandeaux += n.lumieres!.filter((l) => l.forme === 'bandeau').length
      // le code porte le réglage — la salle se repartage à l'identique
      expect(n.code).toContain('~')
    }
    expect(bandeaux, 'aucun bandeau sur quatre graines').toBeGreaterThan(0)
    // et le défaut n'a pas bougé : lampes sans hauteur (plafonnier standard)
    const nu = genereNiveau(11)
    expect(nu.lumieres!.every((l) => l.h === undefined)).toBe(true)
  })

  it('les options COMMANDENT : sans lasers ni dangers, la salle obéit', () => {
    // familles : évent + rideau + membrane seulement (bits 0, 1, 2)
    const o = { ...OPTIONS_DEFAUT, familles: 0b0000111, dangers: 1 as const }
    for (const g of [7, 8, 9]) {
      const n = genereNiveau(g, null, o)
      expect(n.lasers ?? []).toEqual([])
      expect(n.portes ?? []).toEqual([])
      expect(n.rails ?? []).toEqual([])
      expect(n.boxes.some((b) => b.material === 4 || b.material === 6)).toBe(false) // ni froid ni chaud
    }
  })

  it("le cahier des charges COMMANDE : mécanique glace → jamais d'exigence vapeur, et l'inverse", () => {
    // détection STRUCTURELLE par les preuves (les étiquettes sont dosées)
    const compte = (
      cahier: { moment: 1 | 2 | 3; mecanique: 0 | 1 | 2 | 3; difficulte: number },
      v: string,
    ) => {
      const { niveau, preuves } = genereNiveauDetaille(
        graineAtelier(cahier, v),
        { cahier, variante: v },
      )
      return {
        niveau,
        glaceux:
          niveau.boxes.filter((b) => b.material === MAT_RIDEAU).length +
          preuves.filter((p) => p.kind === 'miroir').length,
        vaporeux:
          niveau.boxes.filter((b) => b.material === MAT_GRILLE).length +
          preuves.filter((p) => p.kind === 'rail' || p.kind === 'nor').length,
      }
    }
    for (const variante of ['A', 'B', 'C', 'D', 'E']) {
      const glace = compte({ moment: 2, mecanique: 1, difficulte: 4 }, variante)
      expect(glace.glaceux, `glace ${variante}`).toBeGreaterThan(0)
      expect(glace.vaporeux, `glace ${variante}`).toBe(0)
      const vapeur = compte({ moment: 2, mecanique: 2, difficulte: 4 }, variante)
      expect(vapeur.vaporeux, `vapeur ${variante}`).toBeGreaterThan(0)
      expect(vapeur.glaceux, `vapeur ${variante}`).toBe(0)
      const toutes = compte({ moment: 3, mecanique: 3, difficulte: 6 }, variante)
      expect(toutes.glaceux, `toutes ${variante}`).toBeGreaterThan(0)
      expect(toutes.vaporeux, `toutes ${variante}`).toBeGreaterThan(0)
      const aucune = compte({ moment: 1, mecanique: 0, difficulte: 1 }, variante)
      expect(aucune.glaceux + aucune.vaporeux, `aucune ${variante}`).toBe(0)
      expect(aucune.niveau.lasers ?? []).toEqual([])
    }
  })

  it('le code atelier fait identité : « G-212-K7 » se retape et redonne la même salle', () => {
    const cahier = { moment: 2, mecanique: 1, difficulte: 2 } as const
    const a = genereNiveauAtelier(cahier, 'K7')
    expect(a.code).toBe('G-212-K7')
    expect(JSON.stringify(genereNiveauAtelier(cahier, 'k7'))).toBe(JSON.stringify(a))
    expect(JSON.stringify(genereNiveauAtelier(cahier, 'K8'))).not.toBe(JSON.stringify(a))
    // toutes valides, comme les libres
    const erreurs = checkLevel(a).filter((v) => v.niveau === 'erreur')
    expect(erreurs).toEqual([])
  })

  it('la difficulté du cahier dose la salle : 0 est plus court et plus doux que 9', () => {
    const doux = genereNiveauAtelier({ moment: 1, mecanique: 1, difficulte: 0 }, 'A')
    const rude = genereNiveauAtelier({ moment: 1, mecanique: 1, difficulte: 9 }, 'A')
    expect(doux.lumieres!.length).toBeLessThan(rude.lumieres!.length) // 3 salles contre 5 (max 4 lampes)
    expect(doux.par!).toBeLessThan(rude.par!)
  })


  it("le LORE place le froid : tout hublot fendu est sur la COQUE — jamais en plein vaisseau", () => {
    for (let g = 1; g <= 60; g++) {
      const n = genereNiveau(g)
      const b = n.bounds
      for (const box of n.boxes) {
        if (box.material !== 4) continue // MAT_FROID
        const surCoque =
          Math.abs(box.maxY - (b.maxY - 40)) < 6 ||
          Math.abs(box.minY - (b.minY + 40)) < 6 ||
          Math.abs(box.minX - (b.minX + 40)) < 6 ||
          Math.abs(box.maxX - (b.maxX - 40)) < 6
        expect(surCoque, `graine ${g} : hublot froid en plein vaisseau`).toBe(true)
      }
    }
  })

  it("le TRAJET RELAYÉ éloigne la cible du laser : miroir fixe en losange, preuve tenue", () => {
    let vus = 0
    for (let g = 1; g <= 120 && vus < 3; g++) {
      const { niveau, preuves } = genereNiveauDetaille(g)
      const relais = niveau.boxes.filter((b) => b.material === 10) // MAT_MIROIR
      if (relais.length === 0) continue
      vus++
      // la preuve du miroir discrimine TOUJOURS, relais compris — et le
      // spot du joueur (donc la pastille) est LOIN du fil de l'émetteur.
      // Le relais se reconnaît à son ENGAGEMENT de portée (380 u).
      const p = preuves.find(
        (q) => q.kind === 'miroir' && (q.porteeMin ?? 0) >= 380,
      )!
      expect(p, `graine ${g} : relais posé sans sa preuve`).toBeTruthy()
      expect(Math.abs(p.spot.x - p.emetteur.x), `graine ${g} : relais trop court`).toBeGreaterThan(150)
      const { sansGlace, avecGlace } = prouveMiroir(niveau, p.emetteur, p.spot, p.canal, p.normale)
      expect(sansGlace, `graine ${g}`).toBe(false)
      expect(avecGlace, `graine ${g}`).toBe(true)
    }
    expect(vus, 'aucun trajet relayé en 120 graines libres').toBeGreaterThan(0)
    // et en atelier difficulté 3+, le relais est SYSTÉMATIQUE quand la place
    // le permet : on doit en voir sur quelques variantes
    let atelier = 0
    for (const v of ['A', 'B', 'C', 'D', 'E', 'F']) {
      const n = genereNiveauAtelier({ moment: 3, mecanique: 3, difficulte: 3 }, v)
      if (n.boxes.some((b) => b.material === 10)) atelier++
    }
    expect(atelier, 'aucun relais en 333').toBeGreaterThan(0)
  })

  it('les graines de partage : le texte base 36 fait l’aller-retour', () => {
    expect(graineDepuisTexte('ZZ')).toBe(1295)
    expect(graineDepuisTexte('zz')).toBe(1295)
    expect(graineDepuisTexte('')).toBeNull()
    expect(graineDepuisTexte('héhé')).toBeNull()
    const g = 48151623
    expect(graineDepuisTexte(g.toString(36))).toBe(g)
  })

  it('le code et le nom portent la graine : la salle se partage et se rejoue', () => {
    const niveau = genereNiveau(1295)
    expect(niveau.code).toBe('G-ZZ')
    expect(niveau.name).toContain('ZZ')
    expect(niveau.journal.length).toBeGreaterThanOrEqual(40)
  })

  it('la grammaire enrichie SORT vraiment : rail plasma, barrière NOR et double ET apparaissent', () => {
    let rail = 0
    let nor = 0
    let et = 0
    for (let g = 1; g <= 120; g++) {
      const n = genereNiveau(g)
      if ((n.rails?.length ?? 0) > 0) rail++
      if ((n.cibles ?? []).some((c) => c.mode === 'nor')) nor++
      if ((n.portes ?? []).some((p) => p.regle === 'et')) et++
      if (rail && nor && et) break
    }
    expect(rail, 'aucun rail plasma en 120 graines').toBeGreaterThan(0)
    expect(nor, 'aucune barrière NOR en 120 graines').toBeGreaterThan(0)
    expect(et, 'aucun double ET en 120 graines').toBeGreaterThan(0)
  })

  it("le RAIL PLASMA discrimine : sans nuage la pastille dort, en vapeur l'arc guidé l'allume", () => {
    for (let g = 1; g <= 200; g++) {
      const { niveau, preuves } = genereNiveauDetaille(g)
      const p = preuves.find((q) => q.kind === 'rail')
      if (!p) continue
      const { sansVapeur, avecVapeur } = prouvePlasma(niveau, p.emetteur, p.spot, p.canal)
      expect(sansVapeur).toBe(false)
      expect(avecVapeur).toBe(true)
      return
    }
    throw new Error('aucune graine à rail parmi 1..200')
  })

  it("la BARRIÈRE NOR discrimine : allumée d'office, la vapeur passe, l'eau coupe", () => {
    for (let g = 1; g <= 200; g++) {
      const { niveau, preuves } = genereNiveauDetaille(g)
      const p = preuves.find((q) => q.kind === 'nor')
      if (!p) continue
      const { directe, enVapeur, enEau } = prouveBarriere(niveau, p.emetteur, p.spot, p.canal)
      expect(directe).toBe(true)
      expect(enVapeur).toBe(true)
      expect(enEau).toBe(false)
      return
    }
    throw new Error('aucune graine à barrière NOR parmi 1..200')
  })

  it('le DOUBLE ET : une porte, deux pastilles du même canal, chacune son miroir', () => {
    for (let g = 1; g <= 200; g++) {
      const { niveau, preuves } = genereNiveauDetaille(g)
      const porteEt = (niveau.portes ?? []).find((p) => p.regle === 'et')
      if (!porteEt) continue
      const pastilles = (niveau.cibles ?? []).filter(
        (c, i) => (c.canal ?? i + 1) === porteEt.canal,
      )
      expect(pastilles.length).toBe(2)
      // deux énigmes de miroir distinctes sur ce canal
      const miroirs = preuves.filter((p) => p.kind === 'miroir' && p.canal === porteEt.canal)
      expect(miroirs.length).toBe(2)
      expect(miroirs[0].spot).not.toEqual(miroirs[1].spot)
      return
    }
    throw new Error('aucune graine à double ET parmi 1..200')
  })

  it("l'ORIENTATION varie : le sas ne sort pas toujours du même côté, les faisceaux non plus", () => {
    const cotes = new Set<string>()
    const angles = new Set<number>()
    for (let g = 1; g <= 30; g++) {
      const n = genereNiveau(g)
      const b = n.bounds
      const ex = (n.exit.minX + n.exit.maxX) / 2 - (b.minX + b.maxX) / 2
      const ey = (n.exit.minY + n.exit.maxY) / 2 - (b.minY + b.maxY) / 2
      cotes.add(Math.abs(ex) > Math.abs(ey) ? (ex > 0 ? 'E' : 'O') : ey > 0 ? 'N' : 'S')
      for (const l of n.lasers ?? []) angles.add(((l.angle % 360) + 360) % 360)
    }
    expect(cotes.size, `côtés vus : ${[...cotes].join(',')}`).toBeGreaterThanOrEqual(3)
    expect(angles.size, `angles vus : ${[...angles].join(',')}`).toBeGreaterThanOrEqual(3)
  })

  it("les INDICES sont dosés : une étiquette par espèce d'énigme, aucune au-delà de la difficulté 2", () => {
    // difficulté haute : plus de MIROIR DE GLACE ni d'IONISER ICI
    for (const v of ['A', 'B', 'C']) {
      const dur = genereNiveauAtelier({ moment: 3, mecanique: 3, difficulte: 7 }, v)
      expect(dur.labels.filter((l) => l.text === 'MIROIR DE GLACE').length).toBe(0)
      expect(dur.labels.filter((l) => l.text === 'IONISER ICI').length).toBe(0)
    }
    // et jamais deux fois la même : au plus UNE par salle, quelle que soit la graine
    for (let g = 1; g <= 40; g++) {
      const n = genereNiveau(g)
      for (const texte of ['MIROIR DE GLACE', 'IONISER ICI', 'TRAVERSER EN VAPEUR']) {
        expect(
          n.labels.filter((l) => l.text === texte).length,
          `graine ${g} : ${texte}`,
        ).toBeLessThanOrEqual(1)
      }
    }
  })

  it("le TRAJET S'ÉTIRE : jamais de pastille nichée contre son émetteur", () => {
    const verifie = (
      niveau: ReturnType<typeof genereNiveau>,
      preuves: { porteeMin?: number; cibleIndex: number; canal: number; emetteur: { x: number; y: number } }[],
      etiquette: string,
    ): void => {
      for (const p of preuves) {
        if (!p.porteeMin) continue
        const c = (niveau.cibles ?? [])[p.cibleIndex]
        const d = Math.hypot(c.x - p.emetteur.x, c.y - p.emetteur.y)
        expect(d, `${etiquette}, canal ${p.canal}`).toBeGreaterThanOrEqual(p.porteeMin)
      }
    }
    for (let g = 1; g <= 100; g++) {
      const { niveau, preuves } = genereNiveauDetaille(g)
      verifie(niveau, preuves, `graine ${g}`)
    }
    // et en atelier : toutes les mécaniques à laser, jusqu'aux hautes difficultés
    for (const mecanique of [1, 2, 3] as const)
      for (const difficulte of [2, 5, 8])
        for (const v of ['A', 'B']) {
          const cahier = { moment: 2 as const, mecanique, difficulte }
          const { niveau, preuves } = genereNiveauDetaille(
            graineAtelier(cahier, v),
            { cahier, variante: v },
          )
          verifie(niveau, preuves, `${mecanique}${difficulte}-${v}`)
        }
  })

  it('une pastille DÉPLACÉE contre son émetteur est refusée par la validation', () => {
    for (let g = 1; g <= 80; g++) {
      const { niveau, preuves } = genereNiveauDetaille(g)
      const p = preuves.find((q) => (q.porteeMin ?? 0) > 0)
      if (!p) continue
      const cibles = (niveau.cibles ?? []).map((c, i) =>
        i === p.cibleIndex
          ? { ...c, x: p.emetteur.x + 40, y: p.emetteur.y + 40 }
          : c,
      )
      const sabote = { ...niveau, cibles } as typeof niveau & {
        __preuves?: typeof preuves
      }
      sabote.__preuves = preuves
      const verdict = valideNiveau(sabote)
      expect(verdict.valide).toBe(false)
      expect(verdict.raisons.join(' ')).toContain("s'étirer")
      return
    }
    throw new Error('aucune preuve à portée minimale parmi 1..80')
  })

  it("le SANCTUAIRE d'entrée : aucun danger à moins de 300 u du spawn", () => {
    for (let g = 1; g <= 80; g++) {
      const n = genereNiveau(g)
      for (const b of n.boxes) {
        if (b.material !== 4 && b.material !== 6) continue // froid, chaud
        const dx = Math.max(b.minX - n.spawn.x, 0, n.spawn.x - b.maxX)
        const dy = Math.max(b.minY - n.spawn.y, 0, n.spawn.y - b.maxY)
        expect(Math.hypot(dx, dy), `graine ${g}`).toBeGreaterThanOrEqual(300)
      }
    }
  })
})

describe('le réglage MÉCANISMES vaut aussi en salles à compartiments', () => {
  // Avant ce lot, « Énigmes au laser » ne pilotait que le mode figure :
  // l'auteur qui voulait un faisceau dans un tableau à compartiments
  // n'avait qu'à retirer des graines. Le réglage porte maintenant sur les
  // deux modes, sans trahir la mécanique du cahier — les maillons promus
  // restent dans la famille de celui qu'ils remplacent.
  const graines = [3, 77, 1234, 55555, 987654]

  it('« deux énigmes » en pose au moins deux, « une » au moins une', () => {
    for (const graine of graines)
      for (const [reglage, mini] of [
        [2, 1],
        [3, 2],
      ] as const) {
        const lv = genereNiveau(
          graine,
          { cahier: { moment: 2, mecanique: 3, difficulte: 3 }, variante: 'A' },
          { ...OPTIONS_DEFAUT, mecanismes: reglage },
        )
        expect(
          lv.lasers?.length ?? 0,
          `graine ${graine} réglage ${reglage}`,
        ).toBeGreaterThanOrEqual(mini)
      }
  })

  it('« aucune » rend un tableau qui se joue à l’état seul', () => {
    for (const graine of graines)
      for (const mec of [1, 2, 3] as const) {
        const lv = genereNiveau(
          graine,
          { cahier: { moment: 3, mecanique: mec, difficulte: 6 }, variante: 'A' },
          { ...OPTIONS_DEFAUT, mecanismes: 1 },
        )
        expect(lv.lasers?.length ?? 0, `graine ${graine} méca ${mec}`).toBe(0)
        expect(lv.cibles?.length ?? 0, `graine ${graine} méca ${mec}`).toBe(0)
      }
  })

  it('la promotion reste PROUVÉE et dans la famille du cahier', () => {
    for (const graine of graines) {
      // mécanique GLACE : jamais un rail ni une barrière (pastilles NOR)
      const { niveau, preuves } = genereNiveauDetaille(
        graine,
        { cahier: { moment: 2, mecanique: 1, difficulte: 2 }, variante: 'A' },
        { ...OPTIONS_DEFAUT, mecanismes: 3 },
      )
      ;(niveau as { __preuves?: unknown }).__preuves = preuves
      expect(valideNiveau(niveau).raisons, `graine ${graine}`).toEqual([])
      for (const p of preuves) expect(p.kind, `graine ${graine}`).toBe('miroir')
    }
  })
})

// LE DÉPART NE NAÎT PAS DANS UNE PAROI. Depuis qu'un rail a un corps — il
// barre l'eau, la glace et la vapeur ordinaire, seul le plasma le franchit —
// un tracé qui passe sur le point de départ y ferait naître le corps DANS le
// mur. La preuve de traversée ne peut pas le voir : elle ignore les portes
// d'état. C'est checkLevel qui le dit, et valideNiveau le relit, donc le
// générateur retire la graine et en essaie une autre.
//
// Mesuré AVANT le garde-fou, sur les mille cinq cents premières graines :
// 463 posaient un rail, 8 y faisaient naître le corps — la pire à 0,0 unité
// de l'axe. Après : 0, et quatre graines seulement ont dû changer d'agencement.
describe('Le générateur ne fait jamais naître le corps dans un rail', () => {
  const RAYON = 30 // le corps d'un rail, cf. plasmaRailRadius

  const distance = (
    pts: { x: number; y: number }[],
    x: number,
    y: number,
  ): number => {
    let d = Infinity
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k]
      const b = pts[k + 1]
      const abx = b.x - a.x
      const aby = b.y - a.y
      const l2 = abx * abx + aby * aby
      const t =
        l2 < 1e-9
          ? 0
          : Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / l2))
      d = Math.min(d, Math.hypot(x - (a.x + abx * t), y - (a.y + aby * t)))
    }
    return d
  }

  it('sur trois cents graines, aucun départ dans le corps d’un rail', () => {
    let avecRail = 0
    for (let graine = 1; graine <= 300; graine++) {
      let niveau
      try {
        niveau = genereNiveau(graine)
      } catch {
        continue
      }
      const rails = niveau.rails ?? []
      if (rails.length === 0) continue
      avecRail++
      for (const r of rails)
        expect(
          distance(r.points, niveau.spawn.x, niveau.spawn.y),
          `graine ${graine}`,
        ).toBeGreaterThanOrEqual(RAYON)
    }
    // et le garde-fou n'a pas tué les rails au passage
    expect(avecRail).toBeGreaterThan(50)
  })
})
