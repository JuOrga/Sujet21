import { describe, it, expect } from 'vitest'
import {
  COUCHE_LOINTAIN,
  COUCHE_MODULE,
  COUCHE_VOISINS,
  ECHELLE_LOINTAIN,
  EMBASE_PROF,
  MAX_PIECES_COQUE,
  PIECE_AILE,
  PIECE_AMARRAGE,
  PIECE_EMBASE,
  PIECE_FEU,
  PIECE_MODULE,
  PIECE_PARABOLE,
  PIECE_RADIATEUR,
  PIECE_TREILLIS,
  cleComposition,
  composeCoque,
  empaquettePieces,
  type PieceCoque,
} from './compositionCoque'
import { ATLAS_COQUE } from './coqueAtlas'
import { COQUE_EPAISSEUR, COQUE_FRANGE } from './coque'

// La cuve standard : 2400 × 1500.
const cuve = { minX: -1200, minY: -750, maxX: 1200, maxY: 750 }
const T = COQUE_EPAISSEUR

const de = (ps: PieceCoque[], type: number, couche = COUCHE_MODULE) =>
  ps.filter((p) => p.type === type && p.couche === couche)
// le côté où une pièce du module est posée : l'angle de son repère (son +y
// regarde le dehors)
function cote(p: PieceCoque): 'haut' | 'bas' | 'gauche' | 'droite' {
  if (Math.abs(p.angle) < 0.01) return 'haut'
  if (Math.abs(p.angle - Math.PI) < 0.01) return 'bas'
  return p.angle > 0 ? 'gauche' : 'droite'
}
// la boîte englobante d'une pièce
function etendue(p: PieceCoque) {
  const c = Math.abs(Math.cos(p.angle))
  const s = Math.abs(Math.sin(p.angle))
  const ex = p.hx * c + p.hy * s
  const ey = p.hx * s + p.hy * c
  return { minX: p.cx - ex, maxX: p.cx + ex, minY: p.cy - ey, maxY: p.cy + ey }
}

describe('Le module : son propre matériel, rien de plus', () => {
  const ps = composeCoque(cuve)
  const module_ = ps.filter((p) => p.couche === COUCHE_MODULE)

  it('le défaut signalé : le module ne porte plus l’attirail d’un vaisseau entier', () => {
    // retour du 25/09 : ailes, radiateurs et parabole sur la salle en
    // faisaient un satellite complet — ils pendent désormais à la poutre
    expect(de(ps, PIECE_AILE)).toHaveLength(0)
    expect(de(ps, PIECE_RADIATEUR)).toHaveLength(0)
    expect(de(ps, PIECE_PARABOLE)).toHaveLength(1) // l'antenne de liaison, petite
  })

  it('un port d’amarrage à chaque bout : la salle est un maillon', () => {
    expect(de(ps, PIECE_AMARRAGE).map(cote).sort()).toEqual(['droite', 'gauche'])
  })

  it('les feux de navigation : rouge à bâbord, vert à tribord', () => {
    expect(de(ps, PIECE_FEU).map(cote).sort()).toEqual(['droite', 'gauche'])
  })

  it('la liaison : chaque groupe du module tient sur une embase qui MORD dans la coque', () => {
    const groupes = new Set(module_.map((p) => p.groupe))
    for (const g of groupes) {
      const emb = module_.filter((p) => p.groupe === g && p.type === PIECE_EMBASE)
      expect(emb, `groupe ${g}`).toHaveLength(1)
      // posée AVANT les pièces du module de son groupe : dessous à l'écran
      expect(module_.findIndex((p) => p.groupe === g)).toBe(module_.indexOf(emb[0]))
      const e = etendue(emb[0])
      const c = cote(emb[0])
      const enfonce =
        c === 'haut' ? cuve.maxY + T - e.minY
        : c === 'bas' ? e.maxY - (cuve.minY - T)
        : c === 'gauche' ? e.maxX - (cuve.minX - T)
        : cuve.maxX + T - e.minX
      expect(enfonce, `groupe ${g}`).toBeCloseTo(EMBASE_PROF, 3)
    }
  })

  it('tout le matériel du module tient dans la frange, dehors', () => {
    const H = T + COQUE_FRANGE
    for (const p of module_.filter((q) => q.type !== PIECE_EMBASE)) {
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
})

describe('La station autour : les voisins et le lointain', () => {
  const ps = composeCoque(cuve)

  it('derrière chaque port, le module voisin file hors de l’écran, dans le plan de la salle', () => {
    const voisins = de(ps, PIECE_MODULE, COUCHE_VOISINS)
    expect(voisins).toHaveLength(2)
    for (const v of voisins) {
      const port = ps.find((p) => p.groupe === v.groupe && p.type === PIECE_AMARRAGE)!
      // même axe que son port, et bien plus long qu'un écran
      expect(Math.abs(v.cy - port.cy)).toBeLessThan(1)
      expect(2 * v.hy).toBeGreaterThan(4000)
      // il commence sous le port (qui s'y fond), pas au-delà : pas de jour
      const eV = etendue(v)
      const eP = etendue(port)
      const recouvre = cote(port) === 'gauche' ? eV.maxX - eP.minX : eP.maxX - eV.minX
      expect(recouvre).toBeGreaterThan(0)
    }
  })

  it('la poutre maîtresse passe au large, derrière, et file des deux côtés', () => {
    const poutre = de(ps, PIECE_TREILLIS, COUCHE_LOINTAIN)
    expect(poutre).toHaveLength(1)
    // elle PARAÎT (distance × échelle) au-delà de la coque, jamais dessus
    const paraitA = Math.abs(poutre[0].cy) * ECHELLE_LOINTAIN
    expect(paraitA - poutre[0].hx * ECHELLE_LOINTAIN).toBeGreaterThan(cuve.maxY + T)
    expect(2 * poutre[0].hy * ECHELLE_LOINTAIN).toBeGreaterThan(10000)
  })

  it('les grandes ailes et les radiateurs pendent à la poutre, bien plus grands que le module', () => {
    const ailes = de(ps, PIECE_AILE, COUCHE_LOINTAIN)
    expect(ailes).toHaveLength(2)
    expect(de(ps, PIECE_RADIATEUR, COUCHE_LOINTAIN)).toHaveLength(2)
    // une aile paraît plus large que la salle n'est haute
    expect(2 * ailes[0].hx * ECHELLE_LOINTAIN).toBeGreaterThan(cuve.maxY - cuve.minY)
  })

  it('le lointain est posé AVANT tout le reste : dessous', () => {
    const premier = ps.findIndex((p) => p.couche !== COUCHE_LOINTAIN)
    expect(ps.slice(premier).some((p) => p.couche === COUCHE_LOINTAIN)).toBe(false)
  })

  it('aucune pièce peinte n’est déformée : ses proportions sont celles de l’image', () => {
    for (const p of ps) {
      const r = ATLAS_COQUE[p.type]?.rapport
      if (!r || p.type === PIECE_TREILLIS || p.type === PIECE_MODULE) continue
      const part = p.type === PIECE_AMARRAGE ? p.param : 1
      expect(p.hx / (p.hy / part), `pièce ${p.type}`).toBeCloseTo(r, 3)
    }
  })

  it('stable, et tournée avec la salle : une salle haute a sa poutre sur un côté vertical', () => {
    expect(composeCoque({ ...cuve })).toEqual(ps)
    const haute = composeCoque({ minX: -600, minY: -1400, maxX: 600, maxY: 1400 })
    const poutre = de(haute, PIECE_TREILLIS, COUCHE_LOINTAIN)[0]
    expect(Math.abs(poutre.cx)).toBeGreaterThan(600)
    expect(Math.abs(poutre.cy)).toBeLessThan(1)
  })

  it('arraché par le vide : un port percé emporte le module voisin qui s’y tenait', () => {
    const port = de(ps, PIECE_AMARRAGE)[0]
    const trou = { minX: port.cx - 400, maxX: port.cx + 400, minY: -200, maxY: 200 }
    const percee = composeCoque(cuve, [trou])
    expect(percee.some((p) => p.groupe === port.groupe)).toBe(false)
    expect(de(percee, PIECE_MODULE, COUCHE_VOISINS)).toHaveLength(1)
  })

  it('l’empaquetage : la couche voyage avec le type, et le plafond du shader tient', () => {
    expect(ps.length).toBeLessThanOrEqual(MAX_PIECES_COQUE)
    const geo = new Float32Array(MAX_PIECES_COQUE * 4)
    const aux = new Float32Array(MAX_PIECES_COQUE * 4)
    const n = empaquettePieces(ps, geo, aux)
    expect(n).toBe(ps.length)
    for (let i = 0; i < n; i++) expect(aux[i * 4]).toBe(ps[i].type + 16 * ps[i].couche)
  })
})

describe('La clé de la composition : recomposer dès que ce qui la décide change', () => {
  // un coin de vide posé à cheval sur la paroi
  const vide = { minX: -1300, minY: -100, maxX: -1100, maxY: 100, forme: 3, p0: 0 }
  const cle = (v: object) => cleComposition(cuve, [v as typeof vide])

  it('les paramètres de forme comptent : tourner un coin, régler un arc', () => {
    // la review du 25/09 : p0..p2 manquaient — tourner le coin laissait un
    // port dessiné sur le trou, ou absent d'une coque intacte
    expect(cle({ ...vide, p0: 1 })).not.toBe(cle(vide))
    expect(cle({ ...vide, p1: 40 })).not.toBe(cle(vide))
    expect(cle({ ...vide, p2: 2 })).not.toBe(cle(vide))
  })

  it('la coupe compte aussi', () => {
    expect(cle({ ...vide, coupe: { x: 0, y: 0, nx: 1, ny: 0 } })).not.toBe(cle(vide))
  })

  it('et ce qui ne change rien à la composition ne la recalcule pas', () => {
    expect(cle({ ...vide })).toBe(cle(vide))
  })
})
