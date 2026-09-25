import { describe, it, expect } from 'vitest'
import {
  MAX_PIECES_COQUE,
  PIECE_AILE,
  PIECE_AMARRAGE,
  PIECE_EMBASE,
  EMBASE_PROF,
  PIECE_FEU,
  PIECE_PARABOLE,
  PIECE_PROPULSEURS,
  PIECE_RADIATEUR,
  PIECE_TREILLIS,
  composeCoque,
  empaquettePieces,
  type PieceCoque,
} from './compositionCoque'
import { ATLAS_COQUE } from './coqueAtlas'
import { COQUE_EPAISSEUR, COQUE_FRANGE } from './coque'

// La cuve standard : 2400 × 1500, et le tableau de la capture du 25/09.
const cuve = { minX: -1200, minY: -750, maxX: 1200, maxY: 750 }
const T = COQUE_EPAISSEUR

const de = (ps: PieceCoque[], type: number) => ps.filter((p) => p.type === type)
// le côté où une pièce est posée
function cote(p: PieceCoque): 'haut' | 'bas' | 'gauche' | 'droite' {
  // l'angle du repère dit le côté : son +y regarde le dehors
  if (Math.abs(p.angle) < 0.01) return 'haut'
  if (Math.abs(p.angle - Math.PI) < 0.01) return 'bas'
  return p.angle > 0 ? 'gauche' : 'droite'
}
// la boîte englobante d'une pièce dans le monde
function etendue(p: PieceCoque) {
  const c = Math.abs(Math.cos(p.angle))
  const s = Math.abs(Math.sin(p.angle))
  const ex = p.hx * c + p.hy * s
  const ey = p.hx * s + p.hy * c
  return { minX: p.cx - ex, maxX: p.cx + ex, minY: p.cy - ey, maxY: p.cy + ey }
}

describe('La composition du matériel de coque', () => {
  const ps = composeCoque(cuve)

  it('le défaut signalé : plus de rangée de piquets — peu de pièces, et pas cinq fois la même', () => {
    // l'aperçu du 25/09 : ~25 petites pièces tirées au sort, cinq paraboles
    // sur un seul côté
    expect(ps.filter((p) => p.type !== PIECE_EMBASE).length).toBeLessThanOrEqual(18)
    expect(de(ps, PIECE_PARABOLE)).toHaveLength(1)
  })

  it('un grand côté porte l’énergie : une aile au bout d’un bras en treillis', () => {
    const ailes = de(ps, PIECE_AILE)
    expect(ailes.length).toBeGreaterThanOrEqual(1)
    for (const a of ailes) {
      expect(['haut', 'bas']).toContain(cote(a))
      // l'aile est couchée LE LONG de la paroi, et JAMAIS déformée : ses
      // proportions sont celles de son image quand elle est livrée
      expect(a.hx).toBeGreaterThan(a.hy)
      const rapport = ATLAS_COQUE[PIECE_AILE]?.rapport
      if (rapport) expect(a.hx / a.hy).toBeCloseTo(rapport, 3)
      // et son bras la relie à la coque : même groupe, entre elle et la paroi
      const bras = ps.find((p) => p.groupe === a.groupe && p.type === PIECE_TREILLIS)!
      expect(bras).toBeTruthy()
      expect(Math.abs(bras.cx - a.cx)).toBeLessThan(1)
    }
  })

  it('l’autre grand côté porte le froid et la liaison — pas le même que l’énergie', () => {
    const rad = de(ps, PIECE_RADIATEUR)
    expect(rad.length).toBeGreaterThanOrEqual(1)
    const coteEnergie = cote(de(ps, PIECE_AILE)[0])
    for (const r of rad) expect(cote(r)).not.toBe(coteEnergie)
    expect(cote(de(ps, PIECE_PARABOLE)[0])).not.toBe(coteEnergie)
  })

  it('un petit côté reçoit le port d’amarrage, les coins leurs propulseurs', () => {
    const port = de(ps, PIECE_AMARRAGE)
    expect(port).toHaveLength(1)
    expect(['gauche', 'droite']).toContain(cote(port[0]))
    expect(de(ps, PIECE_PROPULSEURS)).toHaveLength(4)
  })

  it('les feux de navigation : rouge à bâbord, vert à tribord — un de chaque côté', () => {
    const feux = de(ps, PIECE_FEU)
    expect(feux.map(cote).sort()).toEqual(['droite', 'gauche'])
  })

  it('la liaison : chaque groupe tient sur une embase qui MORD dans la coque', () => {
    const groupes = new Set(ps.map((p) => p.groupe))
    for (const g of groupes) {
      const emb = ps.filter((p) => p.groupe === g && p.type === PIECE_EMBASE)
      expect(emb, `groupe ${g}`).toHaveLength(1)
      // posée AVANT les pièces de son groupe : dessous à l'écran
      expect(ps.findIndex((p) => p.groupe === g)).toBe(ps.indexOf(emb[0]))
      // elle entre dans la coque d'EMBASE_PROF, jamais jusqu'à la cuve
      const e = etendue(emb[0])
      const cote_ = cote(emb[0])
      const enfonce =
        cote_ === 'haut' ? cuve.maxY + T - e.minY
        : cote_ === 'bas' ? e.maxY - (cuve.minY - T)
        : cote_ === 'gauche' ? e.maxX - (cuve.minX - T)
        : cuve.maxX + T - e.minX
      expect(enfonce, `groupe ${g}`).toBeCloseTo(EMBASE_PROF, 3)
    }
    // les bras ont leurs jambes de force, pas les petites pièces
    const avecJambes = ps.filter((p) => p.type === PIECE_EMBASE && p.param > 0)
    expect(avecJambes.length).toBe(de(ps, PIECE_TREILLIS).length - 1) // la parabole : un pylône sans jambes
  })

  it('tout le reste tient dans la frange, dehors : rien ne mord la cuve ni la coque', () => {
    const H = T + COQUE_FRANGE
    for (const p of ps.filter((q) => q.type !== PIECE_EMBASE)) {
      const e = etendue(p)
      const dansCuve =
        e.maxX > cuve.minX - T + 1 && e.minX < cuve.maxX + T - 1 &&
        e.maxY > cuve.minY - T + 1 && e.minY < cuve.maxY + T - 1
      expect(dansCuve, `pièce ${p.type} en ${p.cx},${p.cy}`).toBe(false)
      expect(e.minX).toBeGreaterThanOrEqual(cuve.minX - H - 1)
      expect(e.maxX).toBeLessThanOrEqual(cuve.maxX + H + 1)
      expect(e.minY).toBeGreaterThanOrEqual(cuve.minY - H - 1)
      expect(e.maxY).toBeLessThanOrEqual(cuve.maxY + H + 1)
    }
  })

  it('stable : la même salle reçoit la même composition', () => {
    expect(composeCoque({ ...cuve })).toEqual(ps)
  })

  it('un long côté porte une paire d’ailes, comme l’ISS ; un court, une seule', () => {
    expect(de(ps, PIECE_AILE)).toHaveLength(2)
    const courte = composeCoque({ minX: -900, minY: -600, maxX: 900, maxY: 600 })
    expect(de(courte, PIECE_AILE)).toHaveLength(1)
  })

  it('aucune pièce livrée en image n’est déformée : ses proportions sont celles de l’image', () => {
    for (const p of ps) {
      const r = ATLAS_COQUE[p.type]?.rapport
      if (!r || p.type === PIECE_TREILLIS) continue // le treillis se répète le long du bras
      const part = p.type === PIECE_AMARRAGE ? p.param : 1
      expect(p.hx / (p.hy / part), `pièce ${p.type}`).toBeCloseTo(r, 3)
    }
  })

  it('le treillis se répète sans s’étirer : une tuile garde le rapport de son image', () => {
    const r = ATLAS_COQUE[PIECE_TREILLIS]?.rapport
    for (const t of de(ps, PIECE_TREILLIS)) if (r) expect((2 * t.hx) / t.param).toBeCloseTo(r, 3)
  })

  it('une salle en hauteur tourne sa composition : l’énergie sur un côté vertical', () => {
    const haute = composeCoque({ minX: -600, minY: -1400, maxX: 600, maxY: 1400 })
    const aile = de(haute, PIECE_AILE)[0]
    expect(Math.abs(aile.cy)).toBeLessThan(1400)
    expect(Math.abs(aile.cx)).toBeGreaterThan(600)
  })

  it('arraché par le vide : un bras dont l’attache tombe dans un trou part avec son aile', () => {
    const aile = de(ps, PIECE_AILE)[0]
    const bras = ps.find((p) => p.groupe === aile.groupe && p.type === PIECE_TREILLIS)!
    const trou = { minX: bras.cx - 40, maxX: bras.cx + 40, minY: -2000, maxY: 2000 }
    // un vide vertical à travers la cuve : il coupe les deux grands côtés
    const percee = composeCoque(cuve, [trou])
    expect(percee.some((p) => p.groupe === aile.groupe)).toBe(false)
    // le reste de la composition tient
    expect(de(percee, PIECE_AMARRAGE)).toHaveLength(1)
  })

  it('l’empaquetage suit le plafond du shader', () => {
    const geo = new Float32Array(MAX_PIECES_COQUE * 4)
    const aux = new Float32Array(MAX_PIECES_COQUE * 4)
    const n = empaquettePieces(ps, geo, aux)
    expect(n).toBe(ps.length)
    expect([...geo.slice(0, 4)]).toEqual([ps[0].cx, ps[0].cy, ps[0].hx, ps[0].hy].map(Math.fround))
    expect(aux[0]).toBe(ps[0].type)
  })
})
