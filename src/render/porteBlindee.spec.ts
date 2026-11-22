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

  it('un mur collé devant toute la face : elle est cachée — le dessus du mur passe devant (capture du concepteur, 22/11)', () => {
    const mur = (x: number): boolean => x < 860 && x > 700
    expect(tranchesVisibles(a, b, 20, mur)).toEqual([])
  })

  it('un mur collé sur la moitié haute : seule la moitié basse se peint, au morceau près', () => {
    const mur = (x: number, y: number): boolean => x < 860 && y > 0
    const t = tranchesVisibles(a, b, 20, mur)
    expect(t.length).toBeGreaterThan(0)
    for (const [q0, q1] of t) expect(Math.max(q0.y, q1.y)).toBeLessThanOrEqual(0 + 20)
    expect(Math.min(...t.map(([, q1]) => q1.y))).toBe(-170)
  })

  it('un mur DERRIÈRE la porte (du côté de son dos) ne cache pas la face', () => {
    const mur = (x: number): boolean => x > 860
    expect(tranchesVisibles(a, b, 20, mur)).toHaveLength(17)
  })

  it('le jeu donne la sonde des solides à la porte', () => {
    const main = readFileSync(join(process.cwd(), 'src/main.ts'), 'utf8')
    expect(main).toMatch(/solide: \(x, y\) => hauteurEn\(x, y\) >= 0,/)
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
    expect(tranchesVisibles(apres[0].a, apres[0].b, 20, murs).length).toBeGreaterThan(0)
  })

  it('sans sonde (l’éditeur), ou des murs de tous côtés, le plus long côté décide', () => {
    expect(sensPorte(P)).toBe(false)
    expect(sensPorte(D1, () => true)).toBe(true)
    expect(sensPorte(D1, () => false)).toBe(true)
  })
})
