import { describe, expect, it } from 'vitest'
import { evenementsPlasma, type VuePlasma } from './plasmaFx'

// LES DEUX INSTANTS DU PLASMA. Ce que l'énigme demande — se vaporiser DANS
// la lumière, puis amener l'arc au pied du tube — doit se VOIR quand on le
// réussit. Encore faut-il que ce soient des ÉVÉNEMENTS : un rayon qui reste
// dans la vapeur, ou un rail que le champ tient déjà, ne sont pas des
// nouvelles. Ces tests gravent la différence entre l'état et l'instant.

const RAIL = { points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 300 }] }

const vue = (
  points: { x: number; y: number; plasma?: boolean }[],
  railsSuivis: number[] = [],
): VuePlasma => ({ points, railsSuivis })

const DANS_LA_VAPEUR = vue([
  { x: -100, y: 0 },
  { x: -40, y: 0, plasma: true },
  { x: 60, y: 0, plasma: true },
  { x: 140, y: 0 },
])

describe('L’ionisation est un INSTANT, pas un état', () => {
  it('s’allume à l’entrée du rayon dans la vapeur', () => {
    const fx = evenementsPlasma([DANS_LA_VAPEUR], [], new Set(), [], 10)
    expect(fx.ionisations).toHaveLength(1)
    expect(fx.ionisations[0].entree).toEqual({ x: -40, y: 0 })
    expect(fx.ionisations[0].t0).toBe(10)
    expect(fx.ionise).toEqual([true])
  })

  it('ne se rallume pas tant que le rayon y reste', () => {
    // sans ça, l'effet repartirait soixante fois par seconde et l'écran
    // resterait blanc tant que le joueur tient sa vapeur dans le rayon
    const fx = evenementsPlasma([DANS_LA_VAPEUR], [], new Set(), [true], 11)
    expect(fx.ionisations).toEqual([])
    expect(fx.ionise).toEqual([true])
  })

  it('se réarme quand le rayon ressort du nuage', () => {
    const sec = vue([{ x: -100, y: 0 }, { x: 140, y: 0 }])
    const sorti = evenementsPlasma([sec], [], new Set(), [true], 12)
    expect(sorti.ionise).toEqual([false])
    // et la fois d'après, l'entrée compte de nouveau
    const rentre = evenementsPlasma([DANS_LA_VAPEUR], [], new Set(), sorti.ionise, 13)
    expect(rentre.ionisations).toHaveLength(1)
  })

  it('fige la portion IONISÉE, et jamais un segment d’un seul point', () => {
    // le rayon vivant sera reparti ailleurs bien avant la fin du flash :
    // c'est la géométrie GELÉE qu'on rejoue
    const fx = evenementsPlasma([DANS_LA_VAPEUR], [], new Set(), [], 0)
    expect(fx.ionisations[0].points.length).toBeGreaterThanOrEqual(2)
    expect(fx.ionisations[0].points[0]).toEqual({ x: -40, y: 0 })
    // un basculement sur le TOUT DERNIER point rendrait un segment vide
    const auBout = vue([{ x: 0, y: 0 }, { x: 50, y: 0, plasma: true }])
    const f2 = evenementsPlasma([auBout], [], new Set(), [], 0)
    expect(f2.ionisations[0].points.length).toBeGreaterThanOrEqual(2)
  })

  it('compte les émetteurs un par un', () => {
    const sec = vue([{ x: 0, y: 0 }, { x: 9, y: 9 }])
    const fx = evenementsPlasma([sec, DANS_LA_VAPEUR], [], new Set(), [], 0)
    expect(fx.ionise).toEqual([false, true])
    expect(fx.ionisations).toHaveLength(1)
  })
})

describe('La capture est un INSTANT, pas un état', () => {
  it('s’allume quand un rail que le champ ne tenait pas est happé', () => {
    const t = vue([{ x: 190, y: 40, plasma: true }], [0])
    const fx = evenementsPlasma([t], [RAIL], new Set(), [true], 5)
    expect(fx.captures).toHaveLength(1)
    expect(fx.captures[0].ligne).toHaveLength(3)
  })

  it('ne se rallume pas sur un rail déjà engagé', () => {
    // le traceur re-signale le rail à CHAQUE image tant que l'arc court
    // dessus : sans ce filtre, l'onde repartirait sans fin
    const t = vue([{ x: 190, y: 40, plasma: true }], [0])
    expect(
      evenementsPlasma([t], [RAIL], new Set([0]), [true], 5).captures,
    ).toEqual([])
  })

  it('prend le point de la LIGNE le plus proche du rayon', () => {
    // la capture se fait N'IMPORTE OÙ le long du rail, pas à son bout :
    // l'anneau doit s'ouvrir là où l'arc a sauté
    const t = vue([{ x: 205, y: 290, plasma: true }], [0])
    const fx = evenementsPlasma([t], [RAIL], new Set(), [true], 0)
    expect(fx.captures[0].prise).toEqual({ x: 200, y: 300 })
  })

  it('ignore un rail sans géométrie', () => {
    const t = vue([{ x: 0, y: 0, plasma: true }], [0])
    expect(
      evenementsPlasma([t], [{ points: [{ x: 1, y: 1 }] }], new Set(), [true], 0)
        .captures,
    ).toEqual([])
  })
})

describe('Le CUMUL remplace les deux, il ne s’y ajoute pas', () => {
  it('marque la capture et efface l’ionisation quand tout tombe ensemble', () => {
    // le joueur s'est vaporisé PILE au pied du tube : l'énigme se résout
    // d'un seul geste. Deux flashs l'un sur l'autre ne feraient qu'une
    // bouillie blanche — un seul temps fort, plus large, dit la chose.
    const t = vue(
      [
        { x: -100, y: 0 },
        { x: -40, y: 0, plasma: true },
        { x: 190, y: 20, plasma: true },
      ],
      [0],
    )
    const fx = evenementsPlasma([t], [RAIL], new Set(), [false], 7)
    expect(fx.captures).toHaveLength(1)
    expect(fx.captures[0].cumul).toBe(true)
    expect(fx.ionisations).toEqual([])
  })

  it('sans ionisation neuve, la capture reste une capture ordinaire', () => {
    const t = vue([{ x: 190, y: 40, plasma: true }], [0])
    const fx = evenementsPlasma([t], [RAIL], new Set(), [true], 7)
    expect(fx.captures[0].cumul).toBe(false)
  })

  it('et une ionisation seule ne devient pas un cumul', () => {
    const fx = evenementsPlasma([DANS_LA_VAPEUR], [RAIL], new Set(), [], 7)
    expect(fx.ionisations).toHaveLength(1)
    expect(fx.captures).toEqual([])
  })
})
