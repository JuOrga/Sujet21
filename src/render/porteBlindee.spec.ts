import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { PorteDef } from '../game/level'
import { portePolygone } from '../game/porte'
import { facesTranche } from './reliefParois'
import {
  DUREE_LEVEE,
  PORTE_ATLAS,
  PORTE_ATLAS_TAILLE,
  cadrePorte,
  decoupePorte,
  etatVeilleuses,
  hauteurDeLevee,
  sensPorte,
  leveeSuivante,
  partLevee,
  coupeDemiPlan,
  dansPolygone,
  tranchesFace,
  volumeProjete,
} from './porteBlindee'

// le gabarit courant du dépôt : 40 × 340, debout entre deux murs
const P: PorteDef = { minX: 860, minY: -170, maxX: 900, maxY: 170, canal: 1 }

/** les constantes de l'atelier, lues dans le script Blender lui-même : le
 *  moteur découpe l'atlas aux rectangles de PORTE_ATLAS, une pièce décalée
 *  d'un pixel y peindrait la gouttière (une ligne transparente au joint) */
function atelier(): Record<string, number> {
  const src = readFileSync(join(process.cwd(), 'tools/images/blender/porte_blindee.py'), 'utf8')
  const out: Record<string, number> = {}
  for (const nom of ['W', 'HF', 'LT', 'LB', 'GOUTTIERE']) {
    const m = new RegExp(`^${nom} = (\\d+)`, 'm').exec(src)
    if (!m) throw new Error(`${nom} absent de porte_blindee.py`)
    out[nom] = Number(m[1])
  }
  return out
}

function tailleWebp(nom: string): { l: number; h: number } {
  const o = readFileSync(join(process.cwd(), 'public/assets', `${nom}.webp`))
  const sorte = o.toString('latin1', 12, 16)
  if (sorte === 'VP8X') return { l: 1 + o.readUIntLE(24, 3), h: 1 + o.readUIntLE(27, 3) }
  if (sorte === 'VP8 ') return { l: o.readUInt16LE(26) & 0x3fff, h: o.readUInt16LE(28) & 0x3fff }
  throw new Error(`${nom} : en-tête WebP inattendu (${sorte})`)
}

describe('la porte blindée — l’atlas', () => {
  it('les rectangles du moteur sont ceux de l’atelier (atlas_rects de porte_blindee.py)', () => {
    const { W, HF, LT, LB, GOUTTIERE } = atelier()
    let x = GOUTTIERE
    const attendu: Record<string, { x: number; y: number; w: number; h: number }> = {}
    for (const [nom, w, h] of [['dessus', LT, W], ['bout', LB, W], ['flanc', LT, HF], ['fente', LT, W]] as const) {
      attendu[nom] = { x, y: GOUTTIERE, w, h }
      x += w + GOUTTIERE
    }
    expect(PORTE_ATLAS).toEqual(attendu)
    expect(PORTE_ATLAS_TAILLE).toEqual({ w: x, h: Math.max(W, HF) + 2 * GOUTTIERE })
  })

  it('le flanc est à l’échelle du monde : un mur haut (140 unités) sur deux carreaux de dalle, comme les flancs des pièces', () => {
    // 2 px par unité dans les deux sens : 280 px de haut pour 140 unités, et
    // le carreau du flanc (320 px) couvre deux carreaux du dessus — 160
    // unités sur une porte de 40 d'épaisseur
    const { HF } = atelier()
    expect(HF / 140).toBe(2)
    expect(PORTE_ATLAS.flanc.w / (2 * 2 * 40)).toBe(2)
  })

  it('l’image livrée a la taille de l’atlas : prepare.py ne l’a pas redimensionnée', () => {
    expect(tailleWebp('porte-blindee')).toEqual({ l: PORTE_ATLAS_TAILLE.w, h: PORTE_ATLAS_TAILLE.h })
  })
})

describe('la porte blindée — la dalle', () => {
  it('debout, la dalle court le long de y ; couchée, le long de x, la tête de l’image en haut de l’écran', () => {
    expect(cadrePorte(P)).toMatchObject({ longueur: 340, epaisseur: 40, couchee: false, es: { x: 0, y: 1 } })
    const couchee = cadrePorte({ minX: -170, minY: 0, maxX: 170, maxY: 40, canal: 1 })
    expect(couchee).toMatchObject({ longueur: 340, epaisseur: 40, couchee: true, o: { x: -170, y: 40 }, et: { x: 0, y: -1 } })
  })

  it('deux sabots et des carreaux entiers remplissent exactement la porte', () => {
    const d = decoupePorte(340, 40)
    expect(d).toEqual({ bout: 24, n: 4, carreau: 73 })
    for (const [L, E] of [[340, 40], [320, 40], [700, 60], [90, 40], [41, 40]]) {
      const { bout, n, carreau } = decoupePorte(L, E)
      expect(2 * bout + n * carreau).toBeCloseTo(L, 9)
      expect(n).toBeGreaterThanOrEqual(1)
    }
  })

  it('une porte courte garde ses deux sabots dans le quart de sa longueur', () => {
    expect(decoupePorte(60, 40).bout).toBe(15)
  })
})

describe('la porte blindée — elle sort du sol', () => {
  it('ouverte, rien n’est debout : seule la fente reste au sol, le passage est libre', () => {
    for (const p of [P, { ...P, materialisation: 'rideau' as const }, { ...P, materialisation: 'eventail' as const }]) {
      const l = partLevee(p, 0, 0)
      expect(l.contour).toEqual([])
      expect(l.close).toBe(false)
    }
  })

  it('une porte d’un coup qui monte occupe déjà tout son rectangle — celui que le solveur lui donne —, seule sa hauteur grandit', () => {
    const l = partLevee(P, 1, 0.5)
    expect(l.contour).toHaveLength(4)
    expect(l.hauteur).toBeCloseTo(0.5, 9)
    expect(l.close).toBe(false)
    expect(partLevee(P, 1, 1)).toMatchObject({ hauteur: 1, close: true })
  })

  it('une porte qui se matérialise se DÉPLIE du sol : debout exactement sur la part du solveur, le reste encore dans la fente', () => {
    for (const materialisation of ['rideau', 'eventail'] as const) {
      const p: PorteDef = { ...P, materialisation }
      for (const s of [0.2, 0.5, 0.9]) {
        const l = partLevee(p, s, 0)
        expect(l.contour).toEqual(portePolygone(p, s).contour)
        expect(l.hauteur).toBe(1)
        expect(l.close).toBe(false)
      }
      expect(partLevee(p, 1, 0).close).toBe(true)
    }
  })

  it('la levée va du sol au sommet en DUREE_LEVEE, pas avant, et s’y arrête', () => {
    let l = 0
    const pas = 1 / 60
    let t = 0
    while (l < 1) {
      l = leveeSuivante(l, 1, pas)
      t += pas
    }
    expect(t).toBeGreaterThanOrEqual(DUREE_LEVEE - 1e-9)
    expect(t).toBeLessThan(DUREE_LEVEE + 2 * pas)
    expect(leveeSuivante(1, 1, pas)).toBe(1)
    expect(leveeSuivante(0.1, 0, 10)).toBe(0)
  })

  it('la hauteur montrée part et arrive en douceur, sans jamais reculer', () => {
    expect(hauteurDeLevee(0)).toBe(0)
    expect(hauteurDeLevee(1)).toBe(1)
    expect(hauteurDeLevee(0.5)).toBeCloseTo(0.5, 9)
    expect(hauteurDeLevee(0.05)).toBeLessThan(0.05)
    let avant = 0
    for (let k = 1; k <= 20; k++) {
      const h = hauteurDeLevee(k / 20)
      expect(h).toBeGreaterThanOrEqual(avant)
      avant = h
    }
  })
})

describe('la porte blindée — le code couleur des lasers', () => {
  it('ouverte, ses veilleuses sont vertes ; en course, rouges qui battent ; close, rouges', () => {
    expect(etatVeilleuses(false, false)).toBe('ouverte')
    expect(etatVeilleuses(false, true)).toBe('course')
    expect(etatVeilleuses(true, true)).toBe('close')
  })
})

describe('la porte blindée — elle va d’un mur à l’autre', () => {
  // D1 de la capture du 22/11 : une porte presque carrée, un peu plus LARGE
  // que haute, qui ferme un couloir horizontal étroit — les murs sont
  // au-dessus et au-dessous d'elle, le couloir à gauche et à droite
  const D1: PorteDef = { minX: 600, minY: 300, maxX: 644, maxY: 340, canal: 1 }
  const murs = (_x: number, y: number): boolean => y > 340 || y < 300

  it('par sa seule longueur elle se couchait en travers du couloir ; ses murs la remettent debout', () => {
    expect(sensPorte(D1)).toBe(true)
    expect(sensPorte(D1, murs)).toBe(false)
  })

  it('debout, ses faces libres sont celles qui donnent sur le couloir', () => {
    const c = [
      { x: 600, y: 300 },
      { x: 644, y: 300 },
      { x: 644, y: 340 },
      { x: 600, y: 340 },
    ]
    // l'œil à gauche, à hauteur du couloir
    const avant = facesTranche(c, D1, 200, 320)
    const apres = facesTranche(c, D1, 200, 320, sensPorte(D1, murs))
    expect(avant).toEqual([]) // la face gauche passait pour un bout contre un mur
    expect(apres).toEqual([{ a: { x: 600, y: 340 }, b: { x: 600, y: 300 } }])
  })

  it('l’œil en dessous : avec les occultants, le bout posé sur la bande est une face à peindre (le masque dira ce qui dépasse)', () => {
    const c = [
      { x: 600, y: 300 },
      { x: 644, y: 300 },
      { x: 644, y: 340 },
      { x: 600, y: 340 },
    ]
    const sens = sensPorte(D1, murs)
    // sans les bouts (l'ancien choix), la face qui regarde l'œil n'existait pas
    expect(facesTranche(c, D1, 620, -400, sens)).toEqual([])
    const faces = facesTranche(c, D1, 620, -400, sens, true)
    expect(faces).toEqual([{ a: { x: 600, y: 300 }, b: { x: 644, y: 300 } }])
  })

  it('sans sonde (l’éditeur), ou des murs de tous côtés, le plus long côté décide', () => {
    expect(sensPorte(P)).toBe(false)
    expect(sensPorte(D1, () => true)).toBe(true)
    expect(sensPorte(D1, () => false)).toBe(true)
  })
})


describe('la porte blindée — ce que les murs cachent, au pixel', () => {
  // la scène de D1 (22/11) : un couloir horizontal (y 300..340) que ferme
  // la porte, le mur extérieur haut au-dessus (140), la bande de triangles
  // plus basse dessous (90), l'œil en dessous. La projection du relief : une
  // homothétie autour du point sous l'œil, f(h) = 0,08 · h / 140 — celle du
  // shader, à l'échelle près.
  const oeil = { x: 620, y: -400 }
  const f = (h: number): number => (0.08 * Math.min(h, 140)) / 140
  const projette = (x: number, y: number, h: number) => ({
    sx: oeil.x + (x - oeil.x) / (1 - f(h)),
    sy: oeil.y + (y - oeil.y) / (1 - f(h)),
  })
  const rect = (x0: number, y0: number, x1: number, y1: number) => [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
  const bande = { contours: [rect(400, 240, 900, 300)], hauteur: 90 }
  const exterieur = { contours: [rect(400, 340, 900, 420)], hauteur: 140 }
  const couvre = (polys: { sx: number; sy: number }[][], q: { sx: number; sy: number }): boolean =>
    polys.some((p) => dansPolygone(p.map((v) => ({ x: v.sx, y: v.sy })), q.sx, q.sy))
  const volume = (o: { contours: { x: number; y: number }[][]; hauteur: number }, demiPlan?: { a: { x: number; y: number }; n: { x: number; y: number } }) =>
    o.contours.flatMap((c) => volumeProjete(demiPlan ? coupeDemiPlan(c, demiPlan.a, demiPlan.n) : c, o.hauteur, projette))

  it('au sol, porte ouverte : le ruban vert collé à la bande passe sous son dessus, plus loin il se voit — sans marche ni retard', () => {
    const v = volume(bande)
    // le dessus de la bande glisse jusqu'à y ≈ 337,9 : un point du sol à
    // 302 est dessous, un à 339 ne l'est plus
    expect(couvre(v, projette(622, 302, 0))).toBe(true)
    expect(couvre(v, projette(622, 337, 0))).toBe(true)
    expect(couvre(v, projette(622, 339, 0))).toBe(false)
  })

  it('la face qui regarde l’œil, sur la bande plus basse : cachée jusqu’à 90, elle dépasse au-dessus (D1, 22/11)', () => {
    const v = volume(bande, { a: { x: 600, y: 300 }, n: { x: 0, y: -1 } })
    expect(couvre(v, projette(622, 300, 60))).toBe(true)
    expect(couvre(v, projette(622, 300, 85))).toBe(true)
    expect(couvre(v, projette(622, 300, 100))).toBe(false)
    expect(couvre(v, projette(622, 300, 140))).toBe(false)
  })

  it('un solide DERRIÈRE le plan de la face ne la cache pas : le mur extérieur est rogné tout entier', () => {
    expect(coupeDemiPlan(exterieur.contours[0], { x: 600, y: 300 }, { x: 0, y: -1 })).toEqual([])
    expect(coupeDemiPlan(bande.contours[0], { x: 600, y: 300 }, { x: 0, y: -1 })).toHaveLength(4)
  })

  it('une face latérale qui longe le couloir passe derrière la bande à son bout, pas au fond du couloir', () => {
    // la face est (x = 644), l'œil en bas à droite ; seule la part de la
    // bande devant son plan (x ≥ 644) compte
    const oeil2 = { x: 900, y: -400 }
    const p2 = (x: number, y: number, h: number) => ({
      sx: oeil2.x + (x - oeil2.x) / (1 - f(h)),
      sy: oeil2.y + (y - oeil2.y) / (1 - f(h)),
    })
    const v = bande.contours.flatMap((c) => volumeProjete(coupeDemiPlan(c, { x: 644, y: 300 }, { x: 1, y: 0 }), 90, p2))
    expect(couvre(v, p2(644, 305, 40))).toBe(true)
    expect(couvre(v, p2(644, 338, 40))).toBe(false)
  })

  it('le volume d’un contour : son pied, son dessus, et un quadrilatère par arête', () => {
    const v = volumeProjete(rect(0, 0, 10, 10), 90, projette)
    expect(v).toHaveLength(6)
    expect(volumeProjete([{ x: 0, y: 0 }, { x: 1, y: 1 }], 90, projette)).toEqual([])
  })

  it('les tranches d’une face la couvrent bout à bout', () => {
    const t = tranchesFace({ x: 0, y: 0 }, { x: 0, y: 100 }, 30)
    expect(t).toHaveLength(4)
    expect(t[0][0]).toEqual({ x: 0, y: 0 })
    expect(t[3][1]).toEqual({ x: 0, y: 100 })
  })

  it('le jeu donne à la porte les solides voisins et la projection du relief', () => {
    const main = readFileSync(join(process.cwd(), 'src/main.ts'), 'utf8')
    expect(main).toMatch(/occultants: fPortes > 0 \? occultantsPres\(p\) : undefined,/)
    expect(main).toMatch(/projette: projetteRelief,/)
    // une coque est creuse : ses morceaux de paroi, pas sa silhouette
    expect(main).toMatch(/FORME_COQUE \? coquePieces\(box\)/)
  })
})
