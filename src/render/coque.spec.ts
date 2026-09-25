import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  COQUE_EPAISSEUR,
  COQUE_FLOTTANTS,
  COQUE_FRANGE,
  COQUE_SOMMETS,
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

  it('quatre bandes, deux triangles chacune', () => {
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

  it('les verticales s’arrêtent à la cuve : les franges ne se chevauchent pas dans les angles', () => {
    const verticales = sommets.filter((v) => v.cote === COTE_GAUCHE || v.cote === COTE_DROITE)
    expect(Math.min(...verticales.map((v) => v.y))).toBe(cuve.minY)
    expect(Math.max(...verticales.map((v) => v.y))).toBe(cuve.maxY)
    for (const v of verticales) expect(v.long).toBe(cuve.maxY - cuve.minY)
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
