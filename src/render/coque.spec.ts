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
  COTE_FLANC,
  COTE_HAUT,
  FLANC_COQUE_GLSL,
  FLANC_SOMMETS,
  MAX_VIDES_COQUE,
  OMBRE_PIED_COQUE_GLSL,
  OMBRE_PIED_FORCE,
  OMBRE_PIED_PORTEE,
  ombrePiedCoque,
  piedFlancCoque,
  remplitBandesCoque,
  remplitFlancsCoque,
  videsPercantLaCoque,
} from './coque'
import { fractionSommet, pointDuSommet } from './reliefParois'
import { HAUTEUR_BLOCS, HAUTEUR_COQUE } from './hauteurs'
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

// « Il n'y a pas d'effet 2,5D sur les parois d'enceinte des tableaux » (le
// concepteur, 17/11) : relief allumé, la coque restait couchée au sol.
describe('La coque a une hauteur : relief allumé, elle se dresse', () => {
  const source = readFileSync(fileURLToPath(new URL('./renderer.ts', import.meta.url)), 'utf8')
  const vs = source.slice(source.indexOf('const HULL_VS'), source.indexOf('const HULL_FS'))
  const fs = source.slice(source.indexOf('const HULL_FS'), source.indexOf('// Décalques de décor'))
  const draw = source.slice(source.indexOf('  private drawHull('), source.indexOf('  // Décalques : un quad par pièce'))
  // le centre de l'écran dans la cuve, la part d'un mur haut au relief fort
  const c = { x: 300, y: -100 }
  const f = fractionSommet(0.07, 1.3, HAUTEUR_COQUE)

  it('la coque glisse de la part d’un mur haut, ni plus ni moins', () => {
    // sa hauteur (2400) est bornée à celle du mur haut, comme toute coque
    expect(f).toBe(fractionSommet(0.07, 1.3, HAUTEUR_BLOCS))
    expect(f).toBeGreaterThan(0)
  })

  it('le dessus de la coque (bande et frange) est la base agrandie autour du centre', () => {
    // la règle des décalques posés sur un mur (pointDuSommet), sur les sommets
    expect(vs).toContain('if (aCote.x < 3.5) ecran = uCenter + (aPos - uCenter) / (1.0 - uSommet);')
    // la station autour (côté 4) reste au sol : elle n'est pas la coque
    expect(vs).not.toMatch(/aCote\.x < 4\.5\) ecran/)
    // le fragment lit la BASE : vides, pièces et texture ne glissent pas
    expect(vs).toContain('vWorld = aCote.x > 4.5 ? ecran : aPos;')
    expect(draw).toContain("gl.uniform1f(hu['uSommet'], sommetCoque)")
    expect(draw).toContain('fractionSommet(this.reliefK, this.zoomRelief, HAUTEUR_COQUE)')
  })

  it('quatre faces intérieures, du pied (le bord de la cuve) au sommet', () => {
    const out = new Float32Array(FLANC_SOMMETS * COQUE_FLOTTANTS)
    expect(remplitFlancsCoque(cuve, out, 0)).toBe(FLANC_SOMMETS)
    const sommets = Array.from({ length: FLANC_SOMMETS }, (_, i) => {
      const o = i * COQUE_FLOTTANTS
      return { x: out[o], y: out[o + 1], s: out[o + 2], a: out[o + 3], cote: out[o + 4] - COTE_FLANC }
    })
    for (let face = 0; face < 4; face++) {
      const vs6 = sommets.slice(face * 6, face * 6 + 6)
      for (const v of vs6) {
        expect(v.cote).toBe(face)
        expect([0, 1]).toContain(v.a)
        // chaque sommet est sur SA paroi : au pied comme en haut (le shader
        // pousse le haut, la géométrie ne porte que le pied)
        if (face === COTE_HAUT) expect(v.y).toBe(cuve.maxY)
        if (face === COTE_BAS) expect(v.y).toBe(cuve.minY)
        if (face === COTE_GAUCHE) expect(v.x).toBe(cuve.minX)
        if (face === COTE_DROITE) expect(v.x).toBe(cuve.maxX)
      }
      // deux triangles non dégénérés une fois le haut poussé
      expect(vs6.filter((v) => v.a === 1)).toHaveLength(3)
    }
    expect(vs).toContain('else if (aCote.x > 4.5) ecran = uCenter + (aPos - uCenter) / (1.0 - uSommet * aUv.y);')
  })

  it('le pied d’un point de la face : t = 0 au bord de la cuve, t = 1 au bord du dessus', () => {
    // au pied, sur la paroi du haut
    const pied = piedFlancCoque(-200, cuve.maxY + 1e-6, c.x, c.y, f, cuve, COTE_HAUT)
    expect(pied).not.toBeNull()
    expect(pied![0]).toBeCloseTo(0, 5)
    expect(pied![1]).toBeCloseTo(-200 - cuve.minX, 4)
    // au sommet : le point de la paroi que le dessus a déplacé
    const [hx, hy] = pointDuSommet(-200, cuve.maxY, c.x, c.y, f)
    const haut = piedFlancCoque(hx, hy - 1e-6, c.x, c.y, f, cuve, COTE_HAUT)
    expect(haut).not.toBeNull()
    expect(haut![0]).toBeCloseTo(1, 4)
    expect(haut![1]).toBeCloseTo(-200 - cuve.minX, 3)
    // à mi-chemin à l'écran : la hauteur vue est entre les deux
    const mi = piedFlancCoque((-200 + hx) / 2, (cuve.maxY + hy) / 2, c.x, c.y, f, cuve, COTE_HAUT)!
    expect(mi[0]).toBeGreaterThan(0.3)
    expect(mi[0]).toBeLessThan(0.7)
    // dans la cuve, ou au-delà du dessus : pas sur la face
    expect(piedFlancCoque(-200, cuve.maxY - 5, c.x, c.y, f, cuve, COTE_HAUT)).toBeNull()
    expect(piedFlancCoque(hx, hy + 5, c.x, c.y, f, cuve, COTE_HAUT)).toBeNull()
    // relief éteint : il n'y a pas de face
    expect(piedFlancCoque(-200, cuve.maxY + 1, c.x, c.y, 0, cuve, COTE_HAUT)).toBeNull()
  })

  it('les quatre faces pavent l’anneau entre la cuve et le dessus, sans jour ni recouvrement', () => {
    // un balayage de l'écran : tout point entre le bord de la cuve et le bord
    // déplacé du dessus est sur UNE face, et sur une seule ; aucun ailleurs
    const s = 1 / (1 - f)
    let dansAnneau = 0
    for (let ix = -40; ix <= 40; ix++) {
      for (let iy = -40; iy <= 40; iy++) {
        const x = c.x + ix * 41.3
        const y = c.y + iy * 27.7
        const dansCuve = x > cuve.minX && x < cuve.maxX && y > cuve.minY && y < cuve.maxY
        const dansDessus =
          x > c.x + (cuve.minX - c.x) * s && x < c.x + (cuve.maxX - c.x) * s &&
          y > c.y + (cuve.minY - c.y) * s && y < c.y + (cuve.maxY - c.y) * s
        const faces = [COTE_HAUT, COTE_BAS, COTE_GAUCHE, COTE_DROITE].filter(
          (k) => piedFlancCoque(x, y, c.x, c.y, f, cuve, k) !== null,
        )
        if (!dansCuve && dansDessus) {
          dansAnneau++
          expect(faces).toHaveLength(1)
        } else {
          expect(faces).toHaveLength(0)
        }
      }
    }
    expect(dansAnneau).toBeGreaterThan(20)
  })

  it('l’œil au-delà d’une paroi : sa face intérieure lui tourne le dos', () => {
    const loin = { x: 0, y: cuve.maxY + 400 }
    for (let y = cuve.maxY - 300; y < cuve.maxY + 600; y += 7) {
      expect(piedFlancCoque(0, y, loin.x, loin.y, f, cuve, COTE_HAUT)).toBeNull()
    }
  })

  it('le jumeau GLSL dit la même chose, et le shader de coque s’en sert', () => {
    expect(FLANC_COQUE_GLSL).toContain('vec3 piedFlancCoque(vec2 w, vec2 c, float f, vec4 cuve, float cote)')
    expect(FLANC_COQUE_GLSL).toContain('if (den <= 0.0 || num <= 0.0) return vec3(0.0);')
    expect(FLANC_COQUE_GLSL).toContain('float t = (1.0 - k) / f;')
    expect(FLANC_COQUE_GLSL).toContain('if (t < 0.0 || t > 1.0) return vec3(0.0);')
    expect(FLANC_COQUE_GLSL).toContain('if (s < 0.0 || s > (cote > 1.5 ? cuve.w - cuve.y : cuve.z - cuve.x)) return vec3(0.0);')
    expect(fs).toContain('${FLANC_COQUE_GLSL}')
    expect(fs).toContain('vec3 fl = piedFlancCoque(vWorld, uCenter, uSommet, uCuve, cote);')
  })

  it('la face passe SOUS ce qu’un solide de la cuve dresse devant elle', () => {
    // un mur collé à la paroi : son dessus déborde sur la face, il est plus
    // haut qu'elle en ce pixel — la profondeur de la composition le dit
    const i = draw.indexOf('gl.drawArrays(gl.TRIANGLES, debutFlancs, FLANC_SOMMETS)')
    expect(i).toBeGreaterThan(0)
    expect(draw.slice(0, i)).toMatch(/this\.passeSousSommets\(true\)\s*$/)
    expect(draw.slice(i)).toMatch(/^gl\.drawArrays\(gl\.TRIANGLES, debutFlancs, FLANC_SOMMETS\)\s*this\.passeSousSommets\(false\)/)
    // relief éteint : ni écrite ni dessinée
    expect(draw).toContain('if (sommetCoque > 0) remplitFlancsCoque(b, this.hullScratch, debutFlancs)')
  })
})

// « La délimitation entre le sol et la paroi manque de quelque chose, peut-
// être une ombre » (le concepteur, 17/11) : la face dressée tombait sur le
// fond sans rien qui l'y pose.
describe('La coque ombre le fond à son pied', () => {
  const source = readFileSync(fileURLToPath(new URL('./renderer.ts', import.meta.url)), 'utf8')
  // la lumière vient du haut de l'écran (la direction par défaut)
  const ombre = (x: number, y: number, l: [number, number] = [0, 1]) =>
    ombrePiedCoque(x, y, cuve, l[0], l[1], OMBRE_PIED_PORTEE, 56, 12)

  it('l’occlusion, sur les quatre parois : pleine au pied, fondue en s’éloignant', () => {
    for (const [x, y] of [
      [0, cuve.maxY],
      [0, cuve.minY],
      [cuve.minX, 0],
      [cuve.maxX, 0],
    ]) {
      expect(ombre(x, y)[0]).toBeCloseTo(OMBRE_PIED_FORCE, 5)
    }
    expect(ombre(cuve.maxX - OMBRE_PIED_PORTEE, 0)[0]).toBeLessThan(OMBRE_PIED_FORCE * 0.4)
    expect(ombre(0, 0)[0]).toBeLessThan(1e-6)
    // hors de la cuve, la coque ne s'ombre pas elle-même
    expect(ombre(cuve.maxX + 5, 0)).toEqual([0, 0])
  })

  it('l’ombre courte tombe à l’opposé de la lumière, de la longueur d’un mur haut', () => {
    // lumière en haut : la paroi du haut ombre le fond sous elle…
    expect(ombre(0, cuve.maxY - 10)[1]).toBeGreaterThan(0.5)
    expect(ombre(0, cuve.maxY - 40)[1]).toBeGreaterThan(0.3)
    // … jusqu'à 56 u et son fondu, pas au-delà
    expect(ombre(0, cuve.maxY - 80)[1]).toBe(0)
    // la paroi du bas, éclairée de face, n'en jette pas sur le fond
    expect(ombre(0, cuve.minY + 10)[1]).toBe(0)
    // la lumière de biais : la paroi qu'on croise en remontant vers elle
    const biais: [number, number] = [Math.SQRT1_2, Math.SQRT1_2]
    expect(ombre(cuve.maxX - 20, 0, biais)[1]).toBeGreaterThan(0.3)
    expect(ombre(cuve.minX + 20, 0, biais)[1]).toBe(0)
  })

  it('le jumeau GLSL dit la même chose, et la composition s’en sert sur le fond de la cuve', () => {
    expect(OMBRE_PIED_COQUE_GLSL).toContain('vec2 ombrePiedCoque(vec2 p, vec2 bMin, vec2 bMax, vec2 l, float portee, float lng, float flou)')
    expect(OMBRE_PIED_COQUE_GLSL).toContain(`float ao = ${OMBRE_PIED_FORCE.toFixed(4)} * exp(-d / portee);`)
    expect(OMBRE_PIED_COQUE_GLSL).toContain('float o = (1.0 - smoothstep(lng, lng + flou, t)) * (1.0 - 0.5 * smoothstep(0.0, lng + flou, t));')
    expect(source).toContain('${OMBRE_PIED_COQUE_GLSL}')
    const appel = source.indexOf('vec2 omb = ombrePiedCoque(world, uRoomCenter - uRoomHalf, uRoomCenter + uRoomHalf, lampeDir,')
    expect(appel).toBeGreaterThan(0)
    // après la direction de la lumière, avant la vie du vaisseau (les
    // veilleuses sont des lumières, rien ne les ombre)
    expect(source.lastIndexOf('if (an > 1e-5) lampeDir = acc / an;', appel)).toBeGreaterThan(0)
    expect(source.indexOf('tank += shipLife(world, uZoom, uTime);', appel)).toBeGreaterThan(appel)
    const bloc = source.slice(appel, source.indexOf('tank += shipLife(world, uZoom, uTime);', appel))
    expect(bloc).toContain('tank *= 1.0 - omb.x;')
    expect(bloc).toContain('omb.y * 0.65 * mix(0.75, 1.0, solEclaire)')
  })
})
