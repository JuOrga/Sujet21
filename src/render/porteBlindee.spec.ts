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
  tranchesVisibles,
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

describe('la porte blindée — la face et le mur qui la touche', () => {
  // la face ouest d'une porte debout (x = 860, de y = 170 à −170 : le
  // contour en sens trigonométrique la parcourt vers le bas), sa normale
  // sortante vers −x
  const a = { x: 860, y: 170 }
  const b = { x: 860, y: -170 }

  it('rien devant elle : toute la face se voit', () => {
    const t = tranchesVisibles(a, b, 20)
    expect(t).toHaveLength(17)
    expect(t[0][0]).toEqual(a)
    expect(t[t.length - 1][1]).toEqual(b)
  })

  it('un mur collé devant, AUSSI HAUT que la porte : la face est cachée — son dessus passe devant (capture du concepteur, 22/11)', () => {
    const mur = (x: number): number => (x < 860 && x > 700 ? 140 : -1)
    expect(tranchesVisibles(a, b, 20, mur, 140)).toEqual([])
  })

  it('un mur collé devant, PLUS BAS que la porte : la face dépasse au-dessus de lui, et ce qui dépasse se peint (D1, 22/11)', () => {
    // la bande de triangles sous D1 est plus basse que le mur extérieur qui
    // donne sa hauteur à la porte : cachée tout entière, la face laissait un
    // couvercle flotter sur du vide
    const bande = (x: number): number => (x < 860 && x > 700 ? 90 : -1)
    const t = tranchesVisibles(a, b, 20, bande, 140)
    expect(t).toHaveLength(17)
    for (const [, , z] of t) expect(z).toBe(90)
    // la même porte à mi-levée (70 de haut) : encore sous le dessus du mur
    expect(tranchesVisibles(a, b, 20, bande, 70)).toEqual([])
  })

  it('un mur collé sur la moitié haute : la moitié basse se voit jusqu’au sol', () => {
    const mur = (x: number, y: number): number => (x < 860 && y > 0 ? 140 : -1)
    const t = tranchesVisibles(a, b, 20, mur, 140)
    expect(t.length).toBeGreaterThan(0)
    for (const [q0, q1, z] of t) {
      expect(Math.max(q0.y, q1.y)).toBeLessThanOrEqual(20)
      expect(z).toBe(0)
    }
    expect(Math.min(...t.map(([, q1]) => q1.y))).toBe(-170)
  })

  it('un mur DERRIÈRE la porte (du côté de son dos) ne cache pas la face', () => {
    const mur = (x: number): number => (x > 860 ? 140 : -1)
    expect(tranchesVisibles(a, b, 20, mur, 140)).toHaveLength(17)
  })

  it('le jeu donne à la porte la hauteur des solides, et la sienne', () => {
    const main = readFileSync(join(process.cwd(), 'src/main.ts'), 'utf8')
    expect(main).toMatch(/hauteurSolide: hauteurEn,/)
    expect(main).toMatch(/hauteurPorte: hauteurPorte\(p\),/)
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
  // la bande sous D1 (90) plus basse que le mur extérieur au-dessus (140)
  const hauteurs = (_x: number, y: number): number => (y > 340 ? 140 : y < 300 ? 90 : -1)

  it('par sa seule longueur elle se couchait en travers du couloir ; ses murs la remettent debout', () => {
    expect(sensPorte(D1)).toBe(true)
    expect(sensPorte(D1, murs)).toBe(false)
  })

  it('debout, ses faces libres sont celles qui donnent sur le couloir : celle que regarde l’œil se peint', () => {
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
    // et rien ne la cache : le couloir est libre devant elle
    expect(tranchesVisibles(apres[0].a, apres[0].b, 20, hauteurs, 140).length).toBeGreaterThan(0)
  })

  it('l’œil en dessous : le bout posé sur la bande plus basse dépasse, il se peint au-dessus d’elle', () => {
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
    const t = tranchesVisibles(faces[0].a, faces[0].b, 20, hauteurs, 140)
    expect(t.length).toBeGreaterThan(0)
    for (const [, , z] of t) expect(z).toBe(90)
  })

  it('sans sonde (l’éditeur), ou des murs de tous côtés, le plus long côté décide', () => {
    expect(sensPorte(P)).toBe(false)
    expect(sensPorte(D1, () => true)).toBe(true)
    expect(sensPorte(D1, () => false)).toBe(true)
  })
})

describe('la porte blindée — la ligne de visée', () => {
  // la scène de D1 : un couloir horizontal (y 300..344), le mur extérieur
  // haut au-dessus (140), la bande plus basse dessous (90) ; la porte ferme
  // le couloir, l'œil est en dessous. Relief : f(h) = 0,08 · h / 140.
  const hauteurs = (_x: number, y: number): number => (y > 344 ? 140 : y < 300 && y > 240 ? 90 : -1)
  const visee = (oeil: { x: number; y: number }) => ({ oeil, fraction: (h: number) => (0.08 * Math.min(h, 140)) / 140 })

  it('la face qui regarde l’œil, posée sur la bande : cachée jusqu’à 90, la porte dépasse au-dessus', () => {
    const t = tranchesVisibles({ x: 600, y: 300 }, { x: 644, y: 300 }, 11, hauteurs, 140, 3, visee({ x: 620, y: -400 }))
    expect(t).toHaveLength(4)
    for (const [, , z] of t) expect(z).toBe(90)
  })

  it('une face latérale qui longe le couloir passe derrière la bande à son bout, pas plus loin', () => {
    // la face est, de y = 300 à 344 (sens trigonométrique), l'œil en bas à droite
    const t = tranchesVisibles({ x: 644, y: 300 }, { x: 644, y: 344 }, 11, hauteurs, 140, 3, visee({ x: 900, y: -400 }))
    expect(t).toHaveLength(4)
    expect(t[0][2]).toBe(90) // contre la bande : son dessus passe devant
    expect(t[t.length - 1][2]).toBe(0) // au fond du couloir, rien devant
    // sondée droit devant elle (vers l'est, le couloir), la face semblait libre partout
    for (const [, , z] of tranchesVisibles({ x: 644, y: 300 }, { x: 644, y: 344 }, 11, hauteurs, 140)) expect(z).toBe(0)
  })

  it('un mur au loin, au-delà de r · f(H), ne cache rien', () => {
    const loin = (_x: number, y: number): number => (y < 100 && y > 60 ? 140 : -1)
    // r ≈ 700, f(140) = 0,08 : au-delà de 56 unités, plus rien ne couvre
    for (const [, , z] of tranchesVisibles({ x: 600, y: 300 }, { x: 644, y: 300 }, 11, loin, 140, 3, visee({ x: 620, y: -400 }))) expect(z).toBe(0)
  })
})
