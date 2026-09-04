import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { LevelDef } from './level'
import { clampPlanVoie, type PlanVoie } from './voie'
import { clampPoidsPioche, ecartAuCahier, POIDS_PIOCHE_DEFAUTS } from './poule'
import { apercuDescente, bilanDescentes, tireDescente } from './descente'

/** Un tableau minimal, réduit à ce que la pioche regarde : son code. */
const tab = (code: string, nom = code): LevelDef => ({
  name: nom,
  code,
  journal:
    'Une entrée de journal suffisamment longue pour passer le seuil des quarante signes.',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  boxes: [],
  sponges: [],
  labels: [],
})

/** Une bibliothèque CODÉE « 21XX-MMD » couvrant les trois moments, les
 * quatre mécaniques et trois difficultés. Les deux lettres sont l'ORDRE :
 * chaque tableau a le sien, sinon deux entrées porteraient le même code. */
const bibliotheque = (): LevelDef[] => {
  const out: LevelDef[] = []
  const A = 'A'.charCodeAt(0)
  let i = 0
  for (const moment of [1, 2, 3])
    for (const meca of [0, 1, 2, 3])
      for (const diff of [0, 2, 4]) {
        const ordre =
          String.fromCharCode(A + Math.floor(i / 26)) +
          String.fromCharCode(A + (i % 26))
        i++
        out.push(tab(`21${ordre}-${moment}${meca}${diff}`, `${ordre} essai`))
      }
  return out
}

const plan = (p: Partial<PlanVoie> = {}): PlanVoie =>
  clampPlanVoie({ longueur: 12, diffMax: 4, ...p })

describe('descente — le plan déroulé sans jouer', () => {
  it('donne une ligne par rang, et rien de plus', () => {
    const a = apercuDescente(plan({ longueur: 9 }))
    expect(a).toHaveLength(9)
    expect(a.map((r) => r.rang)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('recopie la rampe et la posture du plan, sans les recalculer autrement', () => {
    // l'aperçu ne doit RIEN inventer : c'est le même moment, la même
    // difficulté, la même posture que ce que la descente posera. Un aperçu
    // qui diverge du jeu est pire que pas d'aperçu du tout.
    const p = plan({ longueur: 12, diffMax: 6 })
    const a = apercuDescente(p)
    expect(a.map((r) => r.moment)).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3])
    expect(a[0].dangers).toBe(1)
    expect(a[1].dangers).toBe(1)
    expect(a[2].dangers).toBe(0)
    expect(a[0].purete).toBe(true)
    expect(a[8].purete).toBe(false)
    // l'ampleur s'ouvre par tiers : intime, vaste, immense
    expect(a[0].ampleur).toBe(1)
    expect(a[4].ampleur).toBe(2)
    expect(a[8].ampleur).toBe(3)
  })

  it('la part de figures suit le réglage, moment par moment', () => {
    const a = apercuDescente(plan({ figuresDebut: 0, figuresSuite: 3 }))
    expect(a[0].figures).toBe(0)
    expect(a[5].figures).toBe(3)
  })
})

describe('descente — le tirage à blanc', () => {
  it('rejoue EXACTEMENT la même descente à graine égale', () => {
    // c'est la condition pour comparer deux réglages : sans elle, tout
    // écart observé pourrait n'être que du hasard.
    const lib = bibliotheque()
    const p = plan()
    const a = tireDescente(lib, p, 'graine-1')
    const b = tireDescente(lib, p, 'graine-1')
    expect(a).toEqual(b)
    const c = tireDescente(lib, p, 'graine-2')
    expect(JSON.stringify(c)).not.toBe(JSON.stringify(a))
  })

  it('ne repropose jamais deux fois le même tableau dans une descente', () => {
    const codes = tireDescente(bibliotheque(), plan(), 'g')
      .map((r) => r.ecrite?.code)
      .filter((c): c is string => !!c)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('respecte la rampe : le moment du tableau pioché suit celui du rang', () => {
    // c'est TOUT le contrat de la pioche — un tableau de fin n'ouvre pas
    // une descente. La bibliothèque d'essai couvre les trois moments : la
    // pioche n'a donc aucune excuse.
    for (const r of tireDescente(bibliotheque(), plan(), 'g'))
      expect(r.ecrite?.cahier?.moment).toBe(r.moment)
  })

  it('tableaux écrits coupés : la descente est tout procédurale', () => {
    const t = tireDescente(bibliotheque(), plan({ ecrites: false }), 'g')
    expect(t.every((r) => r.ecrite === null)).toBe(true)
    // et les trois mécaniques sont tout de même tirées : le choix tient
    expect(t.every((r) => r.mecaniques.length === 3)).toBe(true)
  })

  it('sans mémoire tissée, aucune carte n’exige glace ni vapeur', () => {
    const t = tireDescente(bibliotheque(), plan(), 'g', {
      solidification: false,
      vaporisation: false,
    })
    for (const r of t) for (const m of r.mecaniques) expect(m).toBe(0)
  })

  it('bibliothèque vide : la descente se déroule quand même, procédurale', () => {
    const t = tireDescente([], plan({ longueur: 5 }), 'g')
    expect(t).toHaveLength(5)
    expect(t.every((r) => r.ecrite === null)).toBe(true)
  })
})

describe('descente — le bilan de N descentes', () => {
  it('dénonce les tableaux qu’aucune descente ne propose', () => {
    // LA QUESTION QUI JUSTIFIE L'OUTIL. Un tableau de difficulté 9 dans un
    // plan qui plafonne à 2 ne sortira jamais : il est mort, et rien ne le
    // disait. Ici on le voit du premier coup d'œil.
    const lib = [...bibliotheque(), tab('21ZZ-319', 'Le mur du fond')]
    const b = bilanDescentes(lib, plan({ diffMax: 2 }), 30, 'g')
    expect(b.oublies.map((o) => o.code)).toContain('21ZZ-319')
  })

  it('compte autant de cartes générées que de rangs × 3', () => {
    const b = bilanDescentes(bibliotheque(), plan({ longueur: 10 }), 12, 'g')
    const total = b.parMecanique.reduce((s, n) => s + n, 0)
    expect(total).toBe(12 * 10 * 3)
    expect(b.descentes).toBe(12)
  })

  it('se rejoue à l’identique, graine égale', () => {
    const lib = bibliotheque()
    const p = plan()
    expect(bilanDescentes(lib, p, 8, 'z')).toEqual(bilanDescentes(lib, p, 8, 'z'))
  })

  it('un poids de moment à zéro fait sortir des tableaux hors du moment', () => {
    // la démonstration que les poids commandent VRAIMENT la pioche : à
    // poids ordinaires, le moment est respecté partout (test plus haut) ;
    // à poids nul, il ne l'est plus.
    const p = plan({ poids: { ...POIDS_PIOCHE_DEFAUTS, moment: 0 } })
    const horsMoment = tireDescente(bibliotheque(), p, 'g').filter(
      (r) => r.ecrite?.cahier && r.ecrite.cahier.moment !== r.moment,
    )
    expect(horsMoment.length).toBeGreaterThan(0)
  })
})

describe('poule — les poids de la pioche', () => {
  it('sans poids donnés, l’écart est celui d’avant les réglages', () => {
    const a = { moment: 1, mecanique: 0, difficulte: 0 } as const
    const vise = { moment: 3, mecanique: 0, difficulte: 5 } as const
    expect(ecartAuCahier(a, vise)).toBe(2 * 100 + 5 * 10)
  })

  it('le coût d’un tableau muet reste au-dessus du pire écart réel', () => {
    // sinon un tableau SANS cahier passerait devant un tableau codé, et la
    // nomenclature ne servirait plus à rien : le clamp l'interdit.
    const p = clampPoidsPioche({ moment: 100, difficulte: 10, sansCahier: 5 })
    expect(p.sansCahier).toBeGreaterThan(2 * 100 + 9 * 10)
  })

  it('des poids absents retrouvent les valeurs d’origine', () => {
    expect(clampPoidsPioche(null)).toEqual(POIDS_PIOCHE_DEFAUTS)
  })
})

// L'ÉCRAN NE SE MONTE PAS TOUT SEUL : sa coque est dans index.html, son
// code dans main.ts, et rien ne relie les deux qu'une poignée d'identifiants
// en toutes lettres. Renommer la coque, ou l'oublier en recopiant l'écran
// ailleurs, donne un bouton qui n'ouvre rien — sans erreur, sans test rouge.
describe('l’écran LA DESCENTE — la coque et sa porte', () => {
  const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')
  const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')

  it('porte tous les identifiants que main.ts va chercher', () => {
    for (const id of [
      'home-regie', // la seule porte des outils : la régie
      'descente',
      'descente-corps',
      'descente-etat',
      'descente-fermer',
    ])
      expect(HTML, `id="${id}" manque à index.html`).toContain(`id="${id}"`)
  })

  it('reste un OUTIL DE CONCEPTEUR : sa porte est la régie, que l’accueil public ne montre pas', () => {
    // l'ancien bouton home-descente est parti : la régie est la seule porte
    expect(HTML).not.toContain('id="home-descente"')
    const bouton = /<button id="home-regie"[^>]*>/.exec(HTML)?.[0] ?? ''
    expect(bouton).toContain('data-dev')
    expect(MAIN).toContain("id: 'descente'")
  })

  it('ne laisse qu’UNE porte : le cahier des règles ne règle plus le plan', () => {
    // deux panneaux qui écrivent le même plan finissent par se contredire à
    // l'écran — celui du cahier a été remplacé par un bouton vers l'écran.
    expect(MAIN).not.toContain("id = 'regles-cycle'")
    expect(MAIN).toContain('ouvreDescente()')
  })
})
