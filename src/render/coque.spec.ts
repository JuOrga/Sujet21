import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  COQUE_EPAISSEUR,
  COQUE_FLOTTANTS,
  COQUE_FRANGE,
  COQUE_SOMMETS,
  COTE_BAS,
  COTE_DROITE,
  COTE_GAUCHE,
  COTE_HAUT,
  MAX_VIDES_COQUE,
  remplitBandesCoque,
  videsPercantLaCoque,
} from './coque'
import { MAT_BAIE, MAT_VIDE, MAT_WALL } from '../game/level'

// La cuve standard : 2400 × 1500.
const cuve = { minX: -1200, minY: -750, maxX: 1200, maxY: 750 }

// Les boîtes telles que la composition les empaquette : (minX, minY, maxX,
// maxY) et (code = matériau + 16·forme…, angle, …) par pas de 4.
function empaquette(
  boites: { minX: number; minY: number; maxX: number; maxY: number; code: number; angle?: number }[],
) {
  const b = new Float32Array(boites.length * 4)
  const a = new Float32Array(boites.length * 4)
  boites.forEach((x, i) => {
    b.set([x.minX, x.minY, x.maxX, x.maxY], i * 4)
    a.set([x.code, x.angle ?? 0, 0, 1], i * 4)
  })
  return { b, a, n: boites.length }
}

function retenus(boites: Parameters<typeof empaquette>[0]) {
  const { b, a, n } = empaquette(boites)
  const ob = new Float32Array(MAX_VIDES_COQUE * 4)
  const oa = new Float32Array(MAX_VIDES_COQUE * 2)
  const k = videsPercantLaCoque(b, a, n, cuve, ob, oa)
  return { k, ob, oa }
}

describe('Le vide perce la coque de la cuve', () => {
  it('le cas signalé : un vide à cheval sur la paroi du haut est transmis à la coque', () => {
    // la capture du 25/09/2026 : X −1420..320, Y 570..930 — le trou
    // s'arrêtait net au bord de la cuve, la coque repassait par-dessus
    const { k, ob, oa } = retenus([
      { minX: -1420, minY: 570, maxX: 320, maxY: 930, code: MAT_VIDE },
    ])
    expect(k).toBe(1)
    expect([...ob.slice(0, 4)]).toEqual([-1420, 570, 320, 930])
    expect(oa[0]).toBe(MAT_VIDE)
  })

  it('la forme et l’angle voyagent avec le vide (un hublot rond perce en rond)', () => {
    const code = MAT_VIDE + 16 * 1 // disque
    const { k, oa } = retenus([
      { minX: 1100, minY: -100, maxX: 1300, maxY: 100, code, angle: 0.5 },
    ])
    expect(k).toBe(1)
    expect([...oa.slice(0, 2)]).toEqual([code, 0.5])
  })

  it('un vide tout entier dans la cuve ne touche pas la paroi : pas de case', () => {
    expect(retenus([{ minX: -300, minY: -200, maxX: 300, maxY: 200, code: MAT_VIDE }]).k).toBe(0)
  })

  it('un vide oblique qui ne touche la paroi que par ses coins pivotés est gardé', () => {
    // droit, il tient dans la cuve ; tourné de 45°, ses coins en sortent —
    // le cercle circonscrit le voit
    const { k } = retenus([
      { minX: 900, minY: -100, maxX: 1180, maxY: 100, code: MAT_VIDE, angle: Math.PI / 4 },
    ])
    expect(k).toBe(1)
  })

  it('ni les parois, ni la baie vitrée (un fond, sous tout) ne percent la coque', () => {
    const { k } = retenus([
      { minX: -1420, minY: 570, maxX: 320, maxY: 930, code: MAT_WALL },
      { minX: -1420, minY: 570, maxX: 320, maxY: 930, code: MAT_BAIE },
    ])
    expect(k).toBe(0)
  })

  it('un vide au-delà de la frange ne coûte rien', () => {
    const loin = cuve.maxX + COQUE_EPAISSEUR + COQUE_FRANGE + 50
    expect(retenus([{ minX: loin, minY: 0, maxX: loin + 100, maxY: 100, code: MAT_VIDE }]).k).toBe(0)
  })

  it('au-delà du budget, les vides suivants sont laissés — jamais un débordement', () => {
    const beaucoup = Array.from({ length: MAX_VIDES_COQUE + 5 }, (_, i) => ({
      minX: -1250 + i * 60,
      minY: 700,
      maxX: -1210 + i * 60,
      maxY: 800,
      code: MAT_VIDE,
    }))
    expect(retenus(beaucoup).k).toBe(MAX_VIDES_COQUE)
  })
})

describe('Les bandes de coque et leur frange de matériel', () => {
  const out = new Float32Array(COQUE_SOMMETS * COQUE_FLOTTANTS)
  const n = remplitBandesCoque(cuve, out)
  const sommets = Array.from({ length: n }, (_, i) => {
    const o = i * COQUE_FLOTTANTS
    return { x: out[o], y: out[o + 1], s: out[o + 2], a: out[o + 3], cote: out[o + 4], long: out[o + 5] }
  })

  it('quatre bandes, deux morceaux chacune (la coque, la frange), deux triangles par morceau', () => {
    expect(n).toBe(COQUE_SOMMETS)
  })

  it('chaque bande part du bord intérieur et s’étend d’épaisseur + frange au-dehors', () => {
    const H = COQUE_EPAISSEUR + COQUE_FRANGE
    const haut = sommets.filter((v) => v.cote === COTE_HAUT)
    expect(Math.min(...haut.map((v) => v.y))).toBe(cuve.maxY)
    expect(Math.max(...haut.map((v) => v.y))).toBe(cuve.maxY + H)
    const gauche = sommets.filter((v) => v.cote === COTE_GAUCHE)
    expect(Math.max(...gauche.map((v) => v.x))).toBe(cuve.minX)
    expect(Math.min(...gauche.map((v) => v.x))).toBe(cuve.minX - H)
  })

  it('« en travers » se lit depuis le bord intérieur : la texture garde son tube côté cuve', () => {
    for (const v of sommets) {
      const attendu =
        v.cote === COTE_HAUT
          ? v.y - cuve.maxY
          : v.cote === COTE_GAUCHE
            ? cuve.minX - v.x
            : v.cote === COTE_DROITE
              ? v.x - cuve.maxX
              : cuve.minY - v.y
      expect(v.a).toBe(attendu)
    }
  })

  // les triangles, trois sommets par trois ; ceux de la COQUE (a ≤ épaisseur)
  // à part de ceux de la frange
  const triangles = Array.from({ length: n / 3 }, (_, i) => sommets.slice(i * 3, i * 3 + 3))
  const T = COQUE_EPAISSEUR
  const coque = triangles.filter((t) => t.every((v) => v.a <= T))
  const frange = triangles.filter((t) => t.every((v) => v.a >= T))

  it('chaque triangle est tout coque ou tout frange', () => {
    expect(coque.length + frange.length).toBe(triangles.length)
    expect(coque.length).toBe(8)
  })

  it('les franges verticales s’arrêtent à la cuve : elles ne chevauchent pas les horizontales', () => {
    const verticales = frange.flat().filter((v) => v.cote === COTE_GAUCHE || v.cote === COTE_DROITE)
    expect(Math.min(...verticales.map((v) => v.y))).toBe(cuve.minY)
    expect(Math.max(...verticales.map((v) => v.y))).toBe(cuve.maxY)
    for (const v of verticales) expect(v.long).toBe(cuve.maxY - cuve.minY)
  })

  // Le point (x, y) est-il DANS le triangle (strictement, à 1e-6 près) ? Si
  // oui, ses (s, a) interpolés.
  function dans(t: (typeof sommets)[number][], x: number, y: number) {
    const [p, q, r] = t
    const det = (q.x - p.x) * (r.y - p.y) - (r.x - p.x) * (q.y - p.y)
    const l1 = ((x - p.x) * (r.y - p.y) - (r.x - p.x) * (y - p.y)) / det
    const l2 = ((q.x - p.x) * (y - p.y) - (x - p.x) * (q.y - p.y)) / det
    const l0 = 1 - l1 - l2
    if (Math.min(l0, l1, l2) < -1e-6) return null
    return { cote: p.cote, s: l0 * p.s + l1 * q.s + l2 * r.s, a: l0 * p.a + l1 * q.a + l2 * r.a }
  }

  it('LES ANGLES SONT COUPÉS D’ONGLET : chaque point du carré d’angle revient à la paroi la plus proche', () => {
    // le retour du 17/11 : en haut à gauche, la bande du haut couvrait tout
    // le carré d'angle et le montant s'y arrêtait net — une couture droite
    // au lieu d'un angle. Sur la diagonale, les deux bandes se partagent le
    // carré : la tôle tourne l'angle.
    const angles = [
      { x: cuve.minX, y: cuve.maxY, sx: -1, sy: 1, horiz: COTE_HAUT, vert: COTE_GAUCHE },
      { x: cuve.maxX, y: cuve.maxY, sx: 1, sy: 1, horiz: COTE_HAUT, vert: COTE_DROITE },
      { x: cuve.minX, y: cuve.minY, sx: -1, sy: -1, horiz: COTE_BAS, vert: COTE_GAUCHE },
      { x: cuve.maxX, y: cuve.minY, sx: 1, sy: -1, horiz: COTE_BAS, vert: COTE_DROITE },
    ]
    for (const c of angles) {
      for (const u of [5, 30, 52, 80]) {
        for (const v of [3, 29, 61, 85]) {
          // u : la profondeur dans le montant (en x), v : dans la bande (en y)
          const x = c.x + c.sx * u
          const y = c.y + c.sy * v
          const touches = coque.map((t) => dans(t, x, y)).filter((h) => h !== null)
          expect(touches.length).toBe(1)
          const h = touches[0]!
          // le biais : du côté du montant, la verticale ; sinon l'horizontale
          expect(h.cote).toBe(u > v ? c.vert : c.horiz)
          // et « en travers » reste la distance au bord INTÉRIEUR de SA
          // paroi : le tube lumineux et le chanfrein tournent l'angle
          expect(h.a).toBeCloseTo(u > v ? u : v, 6)
        }
      }
    }
  })

  it('le long des parois, la coque n’a ni trou ni doublon', () => {
    for (const s of [0.5, 0.25, 0.75]) {
      for (const a of [1, 45, 89]) {
        const pts = [
          [cuve.minX + s * (cuve.maxX - cuve.minX), cuve.maxY + a],
          [cuve.minX + s * (cuve.maxX - cuve.minX), cuve.minY - a],
          [cuve.minX - a, cuve.minY + s * (cuve.maxY - cuve.minY)],
          [cuve.maxX + a, cuve.minY + s * (cuve.maxY - cuve.minY)],
        ]
        for (const [x, y] of pts) {
          // un point intérieur à un quad est couvert par ses DEUX triangles
          // seulement s'il tombe sur leur diagonale : on n'en tolère qu'un
          const touches = coque.filter((t) => dans(t, x, y) !== null)
          expect(touches.length).toBeGreaterThanOrEqual(1)
          expect(new Set(touches.map((t) => t[0].cote)).size).toBe(1)
        }
      }
    }
  })

  it('les biais partagés tombent au même flottant : pas de fente entre deux bandes', () => {
    const cle = (v: { x: number; y: number }) => `${Math.fround(v.x)},${Math.fround(v.y)}`
    const coins = [
      [cuve.minX - T, cuve.maxY + T],
      [cuve.maxX + T, cuve.maxY + T],
      [cuve.minX - T, cuve.minY - T],
      [cuve.maxX + T, cuve.minY - T],
    ].map(([x, y]) => cle({ x, y }))
    const extremes = new Map<string, Set<number>>()
    for (const v of coque.flat()) {
      const k = cle(v)
      if (!extremes.has(k)) extremes.set(k, new Set())
      extremes.get(k)!.add(v.cote)
    }
    // chaque coin extérieur est un sommet de DEUX bandes, à l'identique
    for (const k of coins) expect(extremes.get(k)?.size).toBe(2)
  })
})

describe('Le shader de coque tient sa promesse', () => {
  const source = readFileSync(fileURLToPath(new URL('./renderer.ts', import.meta.url)), 'utf8')
  const fs = source.slice(source.indexOf('const HULL_FS'), source.indexOf('// Décalques de décor'))

  it('il s’efface dans le vide : discard sous la distance au vide', () => {
    expect(fs).toMatch(/float dv = videSdf\(vWorld\)/)
    expect(fs).toMatch(/if \(garde <= 0\.0\) discard;/)
  })

  it('le dehors masqué ne laisse QUE la coque : le fond de coque se tait avec lui', () => {
    // la review du 25/09 : conduites et boîtiers restaient dessinés, réglage
    // « LE DEHORS DU MODULE » sur MASQUÉ
    const appel = fs.split('\n').find((l) => l.includes('fondDeCoque(acc, s, y, cote, px)'))
    const avant = fs.slice(0, fs.indexOf('fondDeCoque(acc, s, y, cote, px)'))
    const condition = avant.slice(avant.lastIndexOf('if ('))
    expect(appel).toBeTruthy()
    expect(condition).toMatch(/uExterieur > 0\.5/)
  })

  it('et drawHull lui passe bien les vides retenus', () => {
    expect(source).toMatch(/videsPercantLaCoque\(/)
    expect(source).toMatch(/uniform4fv\(hu\['uVides\[0\]'\]/)
  })
})
