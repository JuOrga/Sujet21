import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  MAT_BAIE,
  MAT_CHAUD,
  MAT_EXIT,
  MAT_FROID,
  MAT_GRILLE,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_MEMBRANE,
  MAT_MIROIR,
  MAT_RIDEAU,
  MAT_SURCHAUFFEUR,
  MAT_VIDE,
  MAT_WALL,
} from '../game/level'
import { FORME_COIN, FORME_COQUE, FORME_RECT } from '../game/formes'
import {
  PORTEE_ECLAT,
  PORTEE_POLI,
  PORTEE_SOLIDE,
  SANS_REJET,
  boitesDansLaVue,
  boitesVueVides,
  debordRelief,
  estSolide,
  lisere,
  porteePeinture,
  rayonPortee,
  type BoitePortee,
  type CadrePortee,
} from './portee'

// LA PORTÉE NE CHANGE PAS L'IMAGE. Le shader saute une boîte dès que le pixel
// sort de son rectangle de portée ; le tri ne l'envoie même pas si ce
// rectangle ne touche pas la vue. Ces tests tiennent la promesse là où elle
// peut se tenir sans GPU : chaque rayon est une BORNE de ce que le shader
// garde — vérifié sur les jumelles TypeScript de ses distances —, et la
// source du shader porte bien le test, aux trois boucles.
// (La preuve à l'écran : le banc logiciel du 16/11/2026, le shader d'avant et
// celui-ci dessinés dans la même image — 0 pixel différent sur 20 cadrages du
// hub, trois zooms, relief éteint et fort.)

const source = readFileSync(fileURLToPath(new URL('./renderer.ts', import.meta.url)), 'utf8')
const compose = source.slice(source.indexOf('const COMPOSE_FS = `'), source.indexOf('const LIGHT_FS = `'))
const cuiseur = source.slice(source.indexOf('const LIGHT_FS = `'), source.indexOf('const SPONGE_VS = `'))

// un tirage reproductible
function tirage(graine: number): () => number {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const cadre = (zoom: number, relief: number, cx = 0, cy = 0): CadrePortee => ({
  zoom,
  relief,
  vueW: 1366,
  vueH: 886,
  cx,
  cy,
  hydro: 80,
  chaud: 130,
  froid: 85,
  sas: 240,
})
const CADRES = [cadre(0.15, 0), cadre(0.405, 0), cadre(1, 0), cadre(2.2, 0), cadre(0.15, 0.07), cadre(0.405, 0.07), cadre(1, 0.035), cadre(2.2, 0.07)]

// la distance au rectangle de la boîte, dans SON repère — boxSdf(wb, uBoxes[bi])
function distanceBoite(b: BoitePortee, x: number, y: number): number {
  const bx = (b.minX + b.maxX) / 2
  const by = (b.minY + b.maxY) / 2
  const ca = Math.cos(b.angle)
  const sa = Math.sin(b.angle)
  const rx = x - bx
  const ry = y - by
  const lx = ca * rx + sa * ry
  const ly = -sa * rx + ca * ry
  const qx = Math.abs(lx) - (b.maxX - b.minX) / 2
  const qy = Math.abs(ly) - (b.maxY - b.minY) / 2
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0)
}
// horsPortee du shader, à l'identique
const hors = (b: BoitePortee, rayon: number, x: number, y: number): boolean =>
  x < b.minX - rayon || y < b.minY - rayon || x > b.maxX + rayon || y > b.maxY + rayon
// length(relDisp) du shader, en ce point
const glissement = (c: CadrePortee, x: number, y: number): number =>
  c.relief > 0 ? Math.hypot(x - c.cx, y - c.cy) * c.relief * Math.min(1, Math.max(0, c.zoom * 1.2)) : 0

function boiteAuHasard(alea: () => number, c: CadrePortee, material: number, forme = FORME_RECT): BoitePortee {
  const demiW = c.vueW / 2 / c.zoom
  const demiH = c.vueH / 2 / c.zoom
  const x = c.cx + (alea() * 2 - 1) * demiW * 1.4
  const y = c.cy + (alea() * 2 - 1) * demiH * 1.4
  const hx = 8 + alea() * 420
  const hy = 8 + alea() * 160
  // en simple précision, comme les tableaux que render() remplit : le module
  // lit ce que le shader lira
  const f = Math.fround
  return {
    minX: f(x - hx),
    minY: f(y - hy),
    maxX: f(x + hx),
    maxY: f(y + hy),
    material,
    forme,
    // une boîte sur trois est oblique
    angle: f(alea() < 0.33 ? (alea() * 2 - 1) * Math.PI : 0),
    auxW: f(material === MAT_CHAUD ? 0.4 + alea() * 1.6 : material === MAT_SURCHAUFFEUR ? (alea() < 0.5 ? 0 : alea()) : 1),
  }
}
// les pixels de la vue, en unités monde
function* pixels(c: CadrePortee, pas = 23): Generator<[number, number]> {
  for (let i = 0; i <= pas; i++)
    for (let j = 0; j <= pas; j++)
      yield [c.cx + (i / pas - 0.5) * (c.vueW / c.zoom), c.cy + (j / pas - 0.5) * (c.vueH / c.zoom)]
}

const SOLIDES = [MAT_WALL, MAT_HYDROPHILE, MAT_HYDROPHOBE, MAT_FROID, MAT_GRILLE, MAT_CHAUD, MAT_MEMBRANE, MAT_RIDEAU, MAT_SURCHAUFFEUR, MAT_MIROIR]

describe('La portée de la peinture — le jumeau du rejet du shader', () => {
  it('recopie reachMax, branche pour branche', () => {
    const c = cadre(1, 0)
    expect(PORTEE_SOLIDE).toBe(68)
    expect(porteePeinture(MAT_WALL, 1, c)).toBe(68)
    expect(porteePeinture(MAT_HYDROPHILE, 1, c)).toBe(80)
    expect(porteePeinture(MAT_HYDROPHOBE, 1, c)).toBe(80)
    expect(porteePeinture(MAT_FROID, 1, c)).toBe(85)
    expect(porteePeinture(MAT_CHAUD, 1.5, c)).toBe(195)
    // une chaudière sans aura garde la portée d'un solide (son ombre courte)
    expect(porteePeinture(MAT_CHAUD, 0, c)).toBe(68)
    expect(porteePeinture(MAT_SURCHAUFFEUR, 0, c)).toBe(68)
    expect(porteePeinture(MAT_SURCHAUFFEUR, 0.5, c)).toBe(PORTEE_ECLAT)
    expect(porteePeinture(MAT_MIROIR, 1, c)).toBe(68)
    for (const m of [MAT_GRILLE, MAT_MEMBRANE, MAT_RIDEAU]) expect(porteePeinture(m, 1, c)).toBe(68)
    // un matériau que ce module ne connaît pas n'est jamais rejeté
    expect(porteePeinture(13, 1, c)).toBe(SANS_REJET)
    expect(rayonPortee({ minX: 0, minY: 0, maxX: 10, maxY: 10, material: 13, forme: 0, angle: 0, auxW: 1 }, c)).toBe(SANS_REJET)
  })

  it('et le shader dit bien ces règles-là — les lignes que le jumeau recopie', () => {
    // une ligne qui change ici sans que portee.ts suive : le rayon ne borne
    // plus le rejet, et la boîte disparaît d'un coup au bord de son rectangle
    for (const ligne of [
      'bool solide = (mat < 2.5 || mat > 3.5) && mat < 10.5;',
      'float reachMax = max(56.0, OMBRE_COURTE + OMBRE_COURTE_FLOU);',
      'if (mat > 0.5 && mat < 2.5) reachMax = max(reachMax, uHydroBand);',
      'else if (mat > 5.5 && mat < 6.5) reachMax = max(reachMax, uHeatBand * uBoxAux[bi].w);',
      'else if (mat > 3.5 && mat < 4.5) reachMax = max(reachMax, uColdBand);',
      `else if (mat > 8.5 && mat < 9.5) reachMax = max(reachMax, uBoxAux[bi].w > 0.001 ? ${PORTEE_ECLAT}.0 : ${PORTEE_POLI}.0);`,
      `else if (mat > 8.5) reachMax = max(reachMax, ${PORTEE_POLI}.0);`,
      'if (d > reachMax + edgeW + (uRelief > 0.0 ? length(relDisp) : 0.0)) continue;',
      'float edgeW = 2.5 / uZoom;',
      'vec2 relDisp = (world - uCenter) * (uRelief * clamp(uZoom * 1.2, 0.0, 1.0));',
    ])
      expect(compose, ligne).toContain(ligne)
    expect(estSolide(MAT_EXIT)).toBe(false)
    expect(estSolide(MAT_VIDE)).toBe(false)
    expect(estSolide(MAT_BAIE)).toBe(false)
    for (const m of SOLIDES) expect(estSolide(m)).toBe(true)
  })

  it('hors du rectangle de portée, le shader rejetait déjà la boîte — solides droits et obliques', () => {
    const alea = tirage(21)
    let hors_ = 0
    let dedans = 0
    const ecarts: string[] = []
    for (const c of CADRES) {
      for (let t = 0; t < 60; t++) {
        const b = boiteAuHasard(alea, c, SOLIDES[t % SOLIDES.length])
        const rayon = rayonPortee(b, c)
        const reach = porteePeinture(b.material, b.auxW, c)
        for (const [x, y] of pixels(c)) {
          if (!hors(b, rayon, x, y)) {
            dedans++
            continue
          }
          hors_++
          // le rejet du shader : d > reachMax + edgeW + length(relDisp)
          if (!(distanceBoite(b, x, y) > reach + lisere(c) + glissement(c, x, y)))
            ecarts.push(`matériau ${b.material}, angle ${b.angle.toFixed(2)}, zoom ${c.zoom}, relief ${c.relief} : (${x.toFixed(0)}, ${y.toFixed(0)})`)
        }
      }
    }
    expect(ecarts.slice(0, 5)).toEqual([])
    // le test a bien vu les deux côtés
    expect(hors_).toBeGreaterThan(10000)
    expect(dedans).toBeGreaterThan(10000)
  })

  it('le sas : hors du rectangle, on est au-delà du halo et à plus de deux rayons de bouche', () => {
    const alea = tirage(3)
    const ecarts: string[] = []
    let vus = 0
    for (const c of CADRES) {
      for (let t = 0; t < 30; t++) {
        const b = boiteAuHasard(alea, c, MAT_EXIT)
        b.angle = 0
        const rayon = rayonPortee(b, c)
        const rad = Math.min(b.maxX - b.minX, b.maxY - b.minY) / 2
        for (const [x, y] of pixels(c)) {
          if (!hors(b, rayon, x, y)) continue
          const dh = Math.hypot(x - (b.minX + b.maxX) / 2, y - (b.minY + b.maxY) / 2)
          vus++
          // reach = 1 − smoothstep(rad·0,6, max(uExitRadius, rad), dh) : 0 au-delà ;
          // l'iris (cadre à 1,35 rad, assise jusqu'à 1,485 rad) et l'anneau
          if (!(dh > Math.max(c.sas, rad) && dh > 2 * rad)) ecarts.push(`rad ${rad.toFixed(0)}, zoom ${c.zoom} : dh ${dh.toFixed(1)}`)
        }
      }
    }
    expect(ecarts.slice(0, 5)).toEqual([])
    expect(vus).toBeGreaterThan(10000)
  })

  it('le vide et la baie : hors du rectangle, on est au-delà de leur liseré', () => {
    const alea = tirage(8)
    const ecarts: string[] = []
    let vus = 0
    for (const c of CADRES) {
      for (let t = 0; t < 30; t++) {
        const b = boiteAuHasard(alea, c, t % 2 ? MAT_VIDE : MAT_BAIE)
        const rayon = rayonPortee(b, c)
        for (const [x, y] of pixels(c)) {
          if (!hors(b, rayon, x, y)) continue
          vus++
          // fill = 0 dès d ≥ 0, edge = 0 dès |d| ≥ edgeW
          if (!(distanceBoite(b, x, y) > lisere(c))) ecarts.push(`matériau ${b.material}, angle ${b.angle.toFixed(2)}, zoom ${c.zoom} : (${x.toFixed(0)}, ${y.toFixed(0)})`)
        }
      }
    }
    expect(ecarts.slice(0, 5)).toEqual([])
    expect(vus).toBeGreaterThan(10000)
  })
})

describe('La portée de la salle — une coque cesse de compter quand tout a saturé', () => {
  it('hors du rectangle, la distance à la coque dépasse le fondu du bord, la bande de coque et le liseré', () => {
    const alea = tirage(55)
    const ecarts: string[] = []
    let vus = 0
    for (const c of [...CADRES, cadre(0.04, 0), cadre(0.04, 0.07)]) {
      for (let t = 0; t < 40; t++) {
        const b = boiteAuHasard(alea, c, MAT_WALL, FORME_COQUE)
        const rayon = rayonPortee(b, c)
        for (const [x, y] of pixels(c)) {
          if (!hors(b, rayon, x, y)) continue
          // la salle d'une coque est DANS sa boîte : sa distance est au moins
          // celle de la boîte. Ce qui la lit : inRoom (6/zoom), la bande de
          // coque (34 u), wallLine (3/zoom), le bord éclairé (5,5/zoom)
          const d = distanceBoite(b, x, y)
          vus++
          if (!(d > 34 && d > 6 / c.zoom)) ecarts.push(`angle ${b.angle.toFixed(2)}, zoom ${c.zoom} : d ${d.toFixed(1)}`)
        }
      }
    }
    expect(ecarts.slice(0, 5)).toEqual([])
    expect(vus).toBeGreaterThan(10000)
  })

  it('au zoom de carte, le fondu du bord porte plus loin que la bande de coque : le rayon suit', () => {
    // inRoom fond sur 6/zoom : à 0,04 cela fait 150 u, plus que les 68 u d'un
    // solide et son liseré. Un point juste en deçà du fondu, sur l'axe de la
    // coque, doit rester dans son rectangle — à tous les zooms.
    const coque: BoitePortee = { minX: -300, minY: -200, maxX: 300, maxY: 200, material: MAT_WALL, forme: FORME_COQUE, angle: 0, auxW: 1 }
    for (const zoom of [0.02, 0.04, 0.05, 0.1, 0.405, 1, 3]) {
      const c = cadre(zoom, 0)
      const rayon = rayonPortee(coque, c)
      const seuil = Math.max(34, 6 / zoom)
      expect(hors(coque, rayon, 300 + seuil - 0.01, 0), `zoom ${zoom}`).toBe(false)
      expect(hors(coque, rayon, 0, -200 - seuil + 0.01), `zoom ${zoom}`).toBe(false)
    }
  })
})

describe('La portée de la couverture — le solide le plus proche de celle qui peint', () => {
  it('toute boîte à moins de la plus grande portée du tableau reste dans la couverture', () => {
    // LE CAS QUI L'EXIGE : un pixel dans l'aura d'une chaudière B (le sol
    // chauffé y lit eclMat), à 100 u d'elle et à 80 u d'un mur X. La lumière
    // se règle sur la hauteur du plus proche — X. Avec le seul rayon de X
    // (68 u), X sortait de la couverture et B prenait sa place : la teinte
    // du sol chauffé changeait. Le plus proche est au plus à la portée de
    // celle qui peint (son liseré et les glissements du relief en plus).
    const alea = tirage(89)
    let gardees = 0
    const ecarts: string[] = []
    for (const c of CADRES) {
      for (let t = 0; t < 25; t++) {
        const tableau = Array.from({ length: 12 }, (_, i) => boiteAuHasard(alea, c, SOLIDES[(i + t) % SOLIDES.length]))
        const out = boitesVueVides(16)
        const [boxes, aux, hauteurs] = enTableaux(tableau)
        boitesDansLaVue(tableau.length, boxes, aux, hauteurs, c, out)
        const porteeMax = Math.max(...tableau.map((b) => porteePeinture(b.material, b.auxW, c)))
        expect(out.couverture).toBeGreaterThanOrEqual(porteeMax + 2 * debordRelief(c))
        for (const x of tableau) {
          const rayon = rayonPortee(x, c)
          for (const [px, py] of pixels(c, 15)) {
            // X peut être « le plus proche » d'une boîte qui peint ici :
            // au plus à la portée de celle-ci, son liseré, et trois glissements
            if (distanceBoite(x, px, py) > porteeMax + lisere(c) + 3 * debordRelief(c)) continue
            gardees++
            if (hors(x, rayon + out.couverture, px, py)) ecarts.push(`matériau ${x.material}, zoom ${c.zoom}, relief ${c.relief} : (${px.toFixed(0)}, ${py.toFixed(0)})`)
          }
        }
      }
    }
    expect(ecarts.slice(0, 5)).toEqual([])
    expect(gardees).toBeGreaterThan(10000)
  })

  it("un vide ou une baie au tableau : la couverture ne rejette plus rien, et rien n'est trié", () => {
    // leur tranche, leur monture et leur liseré lisent la lumière du solide le
    // plus proche À N'IMPORTE QUELLE DISTANCE : aucune borne ne tient
    for (const m of [MAT_VIDE, MAT_BAIE]) {
      const c = cadre(1, 0)
      const tableau: BoitePortee[] = [
        { minX: -100, minY: -40, maxX: 100, maxY: 40, material: m, forme: 0, angle: 0, auxW: 1 },
        // un mur à des milliers d'unités de la vue
        { minX: 9000, minY: 9000, maxX: 9100, maxY: 9040, material: MAT_WALL, forme: 0, angle: 0, auxW: 1 },
      ]
      const out = boitesVueVides(4)
      const [boxes, aux, hauteurs] = enTableaux(tableau)
      boitesDansLaVue(2, boxes, aux, hauteurs, c, out)
      expect(out.couverture).toBe(SANS_REJET)
      expect(out.n).toBe(2)
    }
  })
})

// les boîtes telles que render() les range : quatre bornes, aux (x : matériau
// + forme · 16, y : angle en radians, w), une hauteur par boîte
function enTableaux(tableau: BoitePortee[]): [Float32Array, Float32Array, Float32Array] {
  const boxes = new Float32Array(tableau.length * 4)
  const aux = new Float32Array(tableau.length * 4)
  const hauteurs = new Float32Array(tableau.length)
  tableau.forEach((b, k) => {
    boxes.set([b.minX, b.minY, b.maxX, b.maxY], k * 4)
    // (q0 et q1, au-dessus de la forme, ne doivent pas fausser le décodage)
    aux.set([b.material + b.forme * 16 + 3 * 128 + 2 * 16384, b.angle, 7, b.auxW], k * 4)
    hauteurs[k] = 10 + k
  })
  return [boxes, aux, hauteurs]
}

describe('Le tri — seules les boîtes dont la portée touche la vue partent au shader', () => {
  const c = cadre(1, 0) // la vue : ±683 × ±443 autour de l'origine
  const mur = (x: number, y: number, extra: Partial<BoitePortee> = {}): BoitePortee => ({
    minX: x - 50,
    minY: y - 20,
    maxX: x + 50,
    maxY: y + 20,
    material: MAT_WALL,
    forme: FORME_RECT,
    angle: 0,
    auxW: 1,
    ...extra,
  })

  it("garde l'ordre de peinture, et tout ce qui accompagne chaque boîte", () => {
    const tableau = [mur(0, 0), mur(5000, 0), mur(300, 200, { material: MAT_FROID }), mur(0, -4000), mur(-600, 0, { forme: FORME_COIN })]
    const [boxes, aux, hauteurs] = enTableaux(tableau)
    const avant = [Array.from(boxes), Array.from(aux), Array.from(hauteurs)]
    const out = boitesVueVides(8)
    boitesDansLaVue(tableau.length, boxes, aux, hauteurs, c, out)
    expect(out.n).toBe(3)
    // les boîtes 0, 2 et 4, dans cet ordre : la dernière peinte reste dessus
    const gardees = [0, 2, 4]
    gardees.forEach((k, j) => {
      expect(Array.from(out.boxes.subarray(j * 4, j * 4 + 4))).toEqual(avant[0].slice(k * 4, k * 4 + 4))
      expect(Array.from(out.aux.subarray(j * 4, j * 4 + 4))).toEqual(avant[1].slice(k * 4, k * 4 + 4))
      expect(out.hauteurs[j]).toBe(avant[2][k])
      expect(out.portees[j]).toBeCloseTo(rayonPortee(tableau[k], c), 3)
    })
    // les tableaux d'entrée sont intacts : le cuiseur de lumière et la coque
    // les lisent en entier, après le tri
    expect([Array.from(boxes), Array.from(aux), Array.from(hauteurs)]).toEqual(avant)
  })

  it('une boîte triée était hors de portée de TOUS les pixels de la vue, couverture comprise', () => {
    const alea = tirage(144)
    let triees = 0
    const ecarts: string[] = []
    for (const cc of CADRES) {
      for (let t = 0; t < 40; t++) {
        const tableau = Array.from({ length: 20 }, (_, i) => {
          const b = boiteAuHasard(alea, cc, [...SOLIDES, MAT_EXIT][(i + t) % 11])
          // la moitié des boîtes loin de la vue
          if (i % 2) {
            const dx = (alea() < 0.5 ? -1 : 1) * (2 + alea() * 6) * (cc.vueW / cc.zoom)
            b.minX += dx
            b.maxX += dx
          }
          return b
        })
        const [boxes, aux, hauteurs] = enTableaux(tableau)
        const out = boitesVueVides(32)
        boitesDansLaVue(tableau.length, boxes, aux, hauteurs, cc, out)
        const gardees = new Set<number>()
        for (let j = 0; j < out.n; j++) gardees.add(out.boxes[j * 4] + 7 * out.boxes[j * 4 + 1])
        for (const b of tableau) {
          if (gardees.has(Math.fround(b.minX) + 7 * Math.fround(b.minY))) continue
          triees++
          const rayon = rayonPortee(b, cc) + out.couverture
          for (const [x, y] of pixels(cc, 11))
            if (!hors(b, rayon, x, y)) ecarts.push(`matériau ${b.material}, zoom ${cc.zoom}, relief ${cc.relief} : (${x.toFixed(0)}, ${y.toFixed(0)})`)
        }
      }
    }
    expect(ecarts.slice(0, 5)).toEqual([])
    expect(triees).toBeGreaterThan(1000)
  })

  it('le surchauffeur qui vient de recharger porte plus loin : il revient dans la vue', () => {
    // son onde de choc part à ~290 u — au repos il était trié, pas pendant l'éclat
    const loin = mur(683 + 50 + 200, 0, { material: MAT_SURCHAUFFEUR, auxW: 0 })
    const out = boitesVueVides(4)
    let [boxes, aux, hauteurs] = enTableaux([loin])
    boitesDansLaVue(1, boxes, aux, hauteurs, c, out)
    expect(out.n).toBe(0)
    ;[boxes, aux, hauteurs] = enTableaux([{ ...loin, auxW: 0.6 }])
    boitesDansLaVue(1, boxes, aux, hauteurs, c, out)
    expect(out.n).toBe(1)
  })

  it('relief allumé, les rayons grandissent du glissement des sommets', () => {
    const b = mur(0, 0)
    expect(debordRelief(cadre(1, 0))).toBe(0)
    const fort = cadre(0.405, 0.07)
    // le coin de l'écran : la demi-diagonale × le relief × clamp(zoom · 1,2)
    expect(debordRelief(fort)).toBeCloseTo(((0.5 * Math.hypot(1366, 886)) / 0.405) * 0.07 * 0.405 * 1.2, 6)
    expect(rayonPortee(b, fort) - rayonPortee(b, cadre(0.405, 0))).toBeCloseTo(debordRelief(fort), 6)
  })
})

describe('La source du shader porte le test, aux trois boucles de la composition', () => {
  const TETE = 'for (int bi = 0; bi < min(uBoxCount, MAX_BOXES); bi++) {'
  // la première instruction de chaque boucle sur les boîtes
  const premieres = (glsl: string): string[] =>
    glsl
      .split(TETE)
      .slice(1)
      .map(
        (corps) =>
          corps
            .split('\n')
            .map((l) => l.replace(/\/\/.*$/, '').trim())
            .find((l) => l.length > 0) ?? '',
      )

  it('la salle, la couverture et la peinture commencent par horsPortee', () => {
    // SANS LUI : chaque pixel paie, pour chaque boîte du tableau, une distance
    // signée, un décodage et le classement de son matériau — 13 357 des
    // 17 040 unités de travail par pixel au hub (mesuré le 16/11/2026)
    expect(premieres(compose)).toEqual([
      'if (horsPortee(bi, world, 0.0)) continue;',
      'if (horsPortee(bi, world, uPorteeCouv)) continue;',
      'if (horsPortee(bi, world, 0.0)) continue;',
    ])
  })

  it('le rayon voyage à quatre par case, et render() envoie les boîtes de la vue', () => {
    expect(compose).toContain('uniform vec4 uBoxPortee[MAX_BOXES / 4];')
    expect(compose).toContain('uniform float uPorteeCouv;')
    expect(compose).toMatch(/return w\.x < b\.x - r \|\| w\.y < b\.y - r \|\| w\.x > b\.z \+ r \|\| w\.y > b\.w \+ r;/)
    for (const envoi of [
      "gl.uniform1i(cu['uBoxCount'], this.vue.n)",
      "gl.uniform4fv(cu['uBoxes[0]'], this.vue.boxes)",
      "gl.uniform4fv(cu['uBoxAux[0]'], this.vue.aux)",
      "gl.uniform4fv(cu['uBoxH[0]'], this.vue.hauteurs)",
      "gl.uniform4fv(cu['uBoxPortee[0]'], this.vue.portees)",
      "gl.uniform1f(cu['uPorteeCouv'], this.vue.couverture)",
    ])
      expect(source, envoi).toContain(envoi)
  })

  it('le cuiseur de la carte de lumière garde toutes les boîtes : il cuit le tableau, pas la vue', () => {
    expect(cuiseur).not.toContain('horsPortee')
    expect(source).toContain("gl.uniform4fv(lu['uBoxes[0]'], this.boxScratch)")
    expect(source).toContain("gl.uniform1i(lu['uBoxCount'], boxCount)")
  })
})
