import { describe, expect, it } from 'vitest'
import { genereNiveauAtelier, OPTIONS_DEFAUT, type OptionsGen } from './generateur'
import { FIGURE_FAMILLES } from './figures'
import type { CodeAtelier } from './levelIO'
import {
  clampPlanVoie,
  diffAuRang,
  litPalmaresVoie,
  masqueMecanique,
  masquePermis,
  mecaniquesDuChoix,
  mecaniquesPermises,
  momentAuRang,
  reglageAuRang,
  ampleurAuRang,
  famillesEligibles,
  figuresDuChoix,
  figureDeLaCarte,
  varianteDuJour,
  PLAN_VOIE_DEFAUTS,
} from './voie'

describe('voie — le plan de descente', () => {
  const plan = { longueur: 12, diffMax: 3, graineDuJour: false, generees: true }

  it('le moment se répartit par tiers : début, milieu, fin', () => {
    const moments = Array.from({ length: 12 }, (_, i) =>
      momentAuRang(i + 1, plan),
    )
    expect(moments).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3])
  })

  it('la difficulté monte en dents de scie : sommet à l’avant-dernier rang, victoire au dernier', () => {
    const diffs = Array.from({ length: 12 }, (_, i) => diffAuRang(i + 1, plan))
    expect(diffs).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 1, 3, 3, 2])
    // le départ accueille, le SOMMET est à l'avant-dernier rang…
    expect(diffs[0]).toBe(0)
    expect(diffs[10]).toBe(3)
    // …le dernier rang redescend (la victoire à prendre), et les
    // RESPIRATIONS creusent sous l'enveloppe (rangs 6 et 9 ici)
    expect(diffs[11]).toBeLessThan(diffs[10])
    expect(diffs[8]).toBeLessThan(diffs[7])
  })

  it('au-delà de la longueur, la difficulté reste celle du dernier rang', () => {
    expect(diffAuRang(99, plan)).toBe(diffAuRang(12, plan))
    expect(momentAuRang(99, plan)).toBe(3)
  })

  it('le réglage du rang : enseigner (pur, sans danger), éprouver (laby), tordre (contraste)', () => {
    // le DÉBUT : leçon pure, deux premiers rangs sans danger
    expect(reglageAuRang(1, plan)).toEqual({
      dangers: 1,
      laby: 0,
      contraste: 0,
      purete: true,
    })
    expect(reglageAuRang(3, plan).dangers).toBe(0)
    expect(reglageAuRang(3, plan).purete).toBe(true)
    // le MILIEU : l'esprit labyrinthe un rang sur deux, jamais pur
    const milieu = [5, 6, 7, 8].map((r) => reglageAuRang(r, plan))
    expect(milieu.every((x) => !x.purete)).toBe(true)
    expect(milieu.some((x) => x.laby === 2)).toBe(true)
    expect(milieu.some((x) => x.laby === 0)).toBe(true)
    expect(milieu.every((x) => x.contraste === 0)).toBe(true)
    // la FIN : le contraste un rang sur deux — mais jamais au dernier rang
    const fin = [9, 10, 11, 12].map((r) => reglageAuRang(r, plan))
    expect(fin.some((x) => x.contraste === 1)).toBe(true)
    expect(reglageAuRang(12, plan).contraste).toBe(0)
  })

  it('le masque d’une mécanique resserre les familles — la leçon pure', () => {
    // mécanique 1 (glace) : rideau, porte, et — bits 1, 3, 4
    expect(masqueMecanique(1)).toBe((1 << 1) | (1 << 3) | (1 << 4))
    // mécanique 2 (vapeur) : grille, rail, nor — bits 0, 5, 6
    expect(masqueMecanique(2)).toBe(1 | (1 << 5) | (1 << 6))
    // mécanique 0 : membrane seule ; mécanique 3 : tout reste ouvert
    expect(masqueMecanique(0)).toBe(1 << 2)
    expect(masqueMecanique(3)).toBe(127)
  })

  it('le cycle tient la voie : mécaniques et maillons permis par les mémoires', () => {
    // rien de tissé : mécanique 0 seule, maillons membrane seuls
    expect(mecaniquesPermises(false, false)).toEqual([0])
    expect(masquePermis(false, false)).toBe(1 << 2)
    // la solidification ouvre la glace ; la vaporisation, la vapeur
    expect(mecaniquesPermises(true, false)).toEqual([0, 1])
    expect(masquePermis(true, false)).toBe(
      (1 << 1) | (1 << 2) | (1 << 3) | (1 << 4),
    )
    expect(mecaniquesPermises(false, true)).toEqual([0, 2])
    // les deux : tout revient, « toutes » (3) comprise
    expect(mecaniquesPermises(true, true)).toEqual([0, 1, 2, 3])
    expect(masquePermis(true, true)).toBe(127)
    // le choix restreint RÉPÈTE plutôt que d'exiger un lien non tissé
    for (let tir = 0; tir < 20; tir++) {
      const alea = (): number => ((tir * 7919 + 13) % 97) / 97
      const [a, b, c] = mecaniquesDuChoix(1, alea, null, [0])
      expect([a, b, c]).toEqual([0, 0, 0])
      const [x, y, z] = mecaniquesDuChoix(null, alea, null, [0, 2])
      for (const m of [x, y, z]) expect([0, 2]).toContain(m)
    }
  })

  it('le clamp ramène tout plan dans les bornes — et les défauts comblent', () => {
    expect(clampPlanVoie(null)).toEqual({
      longueur: 12,
      diffMax: 3,
      graineDuJour: false,
      generees: true,
    })
    expect(clampPlanVoie({ longueur: 999, diffMax: -4 })).toEqual({
      longueur: 40,
      diffMax: 0,
      graineDuJour: false,
      generees: true,
    })
    expect(clampPlanVoie({ longueur: 1 }).longueur).toBe(3)
  })

  it('la graine du jour est stable, et change par jour comme par rang', () => {
    expect(varianteDuJour('2026-08-27', 3)).toBe(
      varianteDuJour('2026-08-27', 3),
    )
    expect(varianteDuJour('2026-08-27', 3)).not.toBe(
      varianteDuJour('2026-08-28', 3),
    )
    expect(varianteDuJour('2026-08-27', 3)).not.toBe(
      varianteDuJour('2026-08-27', 4),
    )
    expect(varianteDuJour('2026-08-27', 3)).toMatch(/^[0-9A-Z]{4}$/)
  })

  it('les trois mécaniques du choix sont distinctes, la première évite l’écrite', () => {
    for (let tir = 0; tir < 50; tir++) {
      const alea = (): number => ((tir * 7919 + 13) % 97) / 97
      const [a, b, c] = mecaniquesDuChoix(1, alea)
      expect(a).not.toBe(1)
      expect(new Set([a, b, c]).size).toBe(3)
    }
    const [a] = mecaniquesDuChoix(null, () => 0.99)
    expect([0, 1, 2, 3]).toContain(a)
    // la mécanique qu'on vient de jouer s'ÉVITE aussi — la foulée varie
    for (let tir = 0; tir < 30; tir++) {
      const alea = (): number => ((tir * 6271 + 7) % 89) / 89
      const [x] = mecaniquesDuChoix(1, alea, 2)
      expect(x).not.toBe(1)
      expect(x).not.toBe(2)
    }
  })

  it('une descente entière se génère : chaque rang, avec sa posture, donne une salle prouvée', () => {
    const grand = { longueur: 12, diffMax: 6, graineDuJour: false, generees: true }
    for (let rang = 1; rang <= grand.longueur; rang++) {
      const mecanique = ([1, 2, 3] as const)[rang % 3]
      const cahier = {
        moment: momentAuRang(rang, grand),
        mecanique,
        difficulte: diffAuRang(rang, grand),
      }
      const regl = reglageAuRang(rang, grand)
      const salle = genereNiveauAtelier(cahier, `R${rang}`, {
        ...OPTIONS_DEFAUT,
        dangers: regl.dangers,
        laby: regl.laby,
        contraste: regl.contraste,
        familles: regl.purete ? masqueMecanique(mecanique) : 127,
      })
      expect(salle.code, `rang ${rang}`).toContain(
        `${cahier.moment}${cahier.mecanique}${cahier.difficulte}`,
      )
      // les deux premiers rangs sont SANS danger — une nouveauté à la fois
      if (rang <= 2)
        expect(
          salle.boxes.some((b) => b.material === 4 || b.material === 6),
          `rang ${rang} : danger dans la leçon`,
        ).toBe(false)
    }
  })

  it('le palmarès se relit blindé — le stockage abîmé rend le vierge', () => {
    expect(litPalmaresVoie(null)).toEqual({
      descentes: 0,
      bouclees: 0,
      profondeurRecord: 0,
      meilleurLivre: 0,
    })
    expect(litPalmaresVoie('{pas du json')).toEqual(litPalmaresVoie(null))
    expect(
      litPalmaresVoie(
        JSON.stringify({
          descentes: 4,
          bouclees: 2,
          profondeurRecord: 17,
          meilleurLivre: 12.5,
        }),
      ),
    ).toEqual({
      descentes: 4,
      bouclees: 2,
      profondeurRecord: 17,
      meilleurLivre: 12.5,
    })
    expect(litPalmaresVoie(JSON.stringify({ descentes: -3 })).descentes).toBe(0)
  })
})

describe('les FAMILLES DE FIGURE dans la descente', () => {
  it('les mémoires non tissées écartent les familles qui les exigent', () => {
    // rien de tissé : seuls les glyphes géométriques, qui n'exigent rien
    const nues = famillesEligibles(3, 3, false, false)
    expect(nues).toEqual([
      'anneaux',
      'spirale',
      'cortege',
      'rosace',
      'nef',
      'constellation',
    ])
    // la glace seule ouvre le réseau et la matière, pas le cycle thermique
    const glace = famillesEligibles(3, 1, true, false)
    expect(glace).toContain('conduits')
    expect(glace).toContain('fusion')
    expect(glace).not.toContain('echangeur')
    expect(glace).not.toContain('voies')
    // les deux liens tissés, mécanique « toutes » : tout le vocabulaire
    expect(famillesEligibles(3, 3, true, true).length).toBe(10)
  })

  it('le MOMENT retient les familles : un réseau ne s’ouvre pas au premier rang', () => {
    const debut = famillesEligibles(1, 3, true, true)
    expect(debut).toEqual(['anneaux', 'spirale', 'cortege'])
    expect(famillesEligibles(2, 3, true, true)).toContain('conduits')
    expect(famillesEligibles(2, 3, true, true)).not.toContain('voies')
  })

  it('une carte « glace » ne porte pas une famille qui réclame la vapeur', () => {
    const glaceSeule = famillesEligibles(3, 1, true, true)
    expect(glaceSeule).not.toContain('echangeur')
    expect(glaceSeule).not.toContain('voies')
    expect(glaceSeule).toContain('conduits')
  })

  it('le choix du rang MÊLE les deux générateurs — jamais trois figures', () => {
    const alea = (): number => 0.5
    for (const m of [1, 2, 3] as const) {
      const modes = figuresDuChoix(m, alea)
      expect(modes.length).toBe(3)
      const n = modes.filter(Boolean).length
      expect(n).toBe(m === 1 ? 1 : 2)
      expect(n).toBeLessThan(3) // une salle à compartiments reste toujours
    }
  })

  it('une carte non-figure reste en compartiments, une figure sans vivier aussi', () => {
    const alea = (): number => 0
    expect(figureDeLaCarte(false, 3, 3, true, true, alea)).toBe(0)
    // moment 1, mécanique « eau » (0), rien de tissé : le vivier existe
    // (les glyphes n'exigent rien) — c'est « anneaux », le premier
    expect(figureDeLaCarte(true, 1, 0, false, false, alea)).toBe(2)
  })

  it('l’AMPLEUR s’ouvre avec la descente', () => {
    const plan = { ...PLAN_VOIE_DEFAUTS, longueur: 12 }
    expect(ampleurAuRang(1, plan)).toBe(1)
    expect(ampleurAuRang(6, plan)).toBe(2)
    expect(ampleurAuRang(12, plan)).toBe(3)
  })
})

describe('UNE DESCENTE ENTIÈRE : les deux générateurs, et des faisceaux', () => {
  // Le contrat que ce lot pose : à chaque rang, le choix montre à la fois
  // des salles à compartiments et des FIGURES (dont les familles de BOIZ),
  // et la descente n'est plus muette côté énigmes.
  const plan = { ...PLAN_VOIE_DEFAUTS, longueur: 12, diffMax: 3 }

  const descente = (
    graine: number,
  ): {
    figures: number
    compartiments: number
    lasers: number
    total: number
    familles: Set<string>
  } => {
    let h = graine >>> 0
    const alea = (): number => {
      h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0
      return h / 2 ** 32
    }
    const masqueCycle = masquePermis(true, true)
    const bilan = {
      figures: 0,
      compartiments: 0,
      lasers: 0,
      total: 0,
      familles: new Set<string>(),
    }
    for (let rang = 1; rang <= plan.longueur; rang++) {
      const moment = momentAuRang(rang, plan)
      const difficulte = diffAuRang(rang, plan)
      const regl = reglageAuRang(rang, plan)
      const modes = figuresDuChoix(moment, alea)
      for (let c = 0; c < 3; c++) {
        const mec = ([1, 2, 3] as const)[c]
        const figure = figureDeLaCarte(modes[c], moment, mec, true, true, alea)
        const o: OptionsGen = {
          ...OPTIONS_DEFAUT,
          dangers: regl.dangers,
          laby: regl.laby,
          contraste: regl.contraste,
          familles: (regl.purete ? masqueMecanique(mec) : 127) & masqueCycle,
          figure,
          ampleur: ampleurAuRang(rang, plan),
        }
        const cahier: CodeAtelier = { moment, mecanique: mec, difficulte }
        const lv = genereNiveauAtelier(cahier, `R${rang}${c}`, o)
        bilan.total++
        if (figure) {
          bilan.figures++
          bilan.familles.add(FIGURE_FAMILLES[figure - 2])
        } else bilan.compartiments++
        if ((lv.lasers?.length ?? 0) > 0) bilan.lasers++
      }
    }
    return bilan
  }

  it('chaque rang mêle figures et compartiments, sur plusieurs graines', () => {
    for (const graine of [1, 12345, 987654]) {
      const b = descente(graine)
      expect(b.total, `graine ${graine}`).toBe(36)
      expect(b.figures, `graine ${graine}`).toBeGreaterThanOrEqual(12)
      expect(b.compartiments, `graine ${graine}`).toBeGreaterThanOrEqual(12)
      // les familles de BOIZ atteignent bien la descente
      expect(
        [...b.familles].some((f) =>
          ['conduits', 'fusion', 'echangeur', 'voies'].includes(f),
        ),
        `graine ${graine} — familles vues : ${[...b.familles].join(', ')}`,
      ).toBe(true)
      // et la descente n'est plus muette : la moitié au moins porte un faisceau
      expect(b.lasers, `graine ${graine}`).toBeGreaterThanOrEqual(18)
    }
  })
})
