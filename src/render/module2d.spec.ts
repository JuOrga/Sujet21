// LE MODULE EN 2D : la salle tombe à sa place dans la grille, la mini-carte
// se lit dans les cellules et les tubes, la silhouette est fermée et habillée.

import { describe, expect, it } from 'vitest'
import {
  CELLULE_L,
  DUREE_TRANSITION,
  TOILE_MAX,
  TRANSITION,
  centreCellule,
  etatTransition,
  etats,
  miseEnPage,
  vueGenerique,
  type VueModule2d,
} from './module2d'

const salle = { minX: -534, minY: -364, maxX: 534, maxY: 364 }
// six rangs, trois voies ; on joue la voie 0 au rang 1, venu de la voie 1
const suiv: Record<string, number[]> = {
  '0:0': [0], '0:1': [0, 1], '0:2': [2],
  '1:0': [0, 1], '1:1': [1], '1:2': [2],
  '2:0': [0], '2:1': [1, 2], '2:2': [2],
  '3:0': [0], '3:1': [1], '3:2': [2],
  '4:0': [0], '4:1': [1], '4:2': [2],
}
const vue: VueModule2d = { rangs: 6, voies: 3, rang: 1, voie: 0, joues: [1], suivants: (r, v) => suiv[`${r}:${v}`] ?? [] }

describe('module 2D — la mini-carte en états', () => {
  const e = etats(vue)

  it('la salle jouée est « ici » ; le chemin d’où l’on vient est joué', () => {
    expect(e.cellule(1, 0)).toBe('ici')
    expect(e.cellule(0, 1)).toBe('joue')
    expect(e.tube(0, 1, 0)).toBe('joue')
  })

  it('ambre au rang suivant pour ce qu’on peut joindre, bleu plus loin, fermé sinon', () => {
    expect(e.cellule(2, 0)).toBe('ambre')
    expect(e.cellule(2, 1)).toBe('ambre')
    expect(e.cellule(2, 2)).toBe('ferme')
    expect(e.cellule(3, 2)).toBe('bleu') // par 2:1 → 3:2
    expect(e.cellule(0, 0)).toBe('ferme') // pas jouée, derrière soi
  })

  it('les tubes : ambre au départ de la salle, bleu sur la suite, éteints ailleurs', () => {
    expect(e.tube(1, 0, 1)).toBe('ambre')
    expect(e.tube(2, 1, 2)).toBe('bleu')
    expect(e.tube(1, 2, 2)).toBe('eteint')
  })
})

describe('module 2D — la mise en page', () => {
  const mp = miseEnPage(salle, vue)
  const R = salle.maxX - salle.minX

  it('le trou de la toile tombe EXACTEMENT sur la salle dans le monde', () => {
    const versMondeX = (x: number) => mp.monde.minX + (x / mp.largeur) * (mp.monde.maxX - mp.monde.minX)
    const versMondeY = (y: number) => mp.monde.maxY - (y / mp.hauteur) * (mp.monde.maxY - mp.monde.minY)
    expect(versMondeX(mp.salle.minX)).toBeCloseTo(salle.minX, 6)
    expect(versMondeX(mp.salle.maxX)).toBeCloseTo(salle.maxX, 6)
    expect(versMondeY(mp.salle.minY)).toBeCloseTo(salle.maxY, 6)
    expect(versMondeY(mp.salle.maxY)).toBeCloseTo(salle.minY, 6)
  })

  it('une cellule par salle de la mini-carte, sauf la salle jouée, au quart environ de sa largeur', () => {
    expect(mp.cellules).toHaveLength(6 * 3 - 1)
    for (const c of mp.cellules) expect(c.l / mp.densite).toBeCloseTo(CELLULE_L, 9)
  })

  it('les rangs vont vers la DROITE, la voie 0 en HAUT', () => {
    const ambres = mp.cellules.filter((c) => c.etat === 'ambre')
    expect(ambres.every((c) => c.x > mp.salle.maxX)).toBe(true)
    const [a0, a1] = ambres.sort((p, q) => p.y - q.y)
    expect(a0.y).toBeLessThan(a1.y) // 2:0 au-dessus de 2:1
  })

  it('les tubes sont horizontaux ou verticaux, et aucun ne traverse la salle jouée', () => {
    for (const t of mp.tubes) {
      expect(t.ax === t.bx || t.ay === t.by).toBe(true)
      const dedans = (x: number, y: number) => x > mp.salle.minX + 1 && x < mp.salle.maxX - 1 && y > mp.salle.minY + 1 && y < mp.salle.maxY - 1
      expect(dedans((t.ax + t.bx) / 2, (t.ay + t.by) / 2)).toBe(false)
    }
  })

  it('la silhouette est fermée, à angles droits, et contient toute la grille', () => {
    const s = mp.silhouette
    for (let i = 0; i < s.length; i++) {
      const a = s[i]
      const b = s[(i + 1) % s.length]
      expect(a.x === b.x || a.y === b.y).toBe(true)
    }
    const xs = s.map((p) => p.x)
    const ys = s.map((p) => p.y)
    for (const c of mp.cellules) {
      expect(c.x).toBeGreaterThan(Math.min(...xs))
      expect(c.x).toBeLessThan(Math.max(...xs))
      expect(c.y).toBeGreaterThan(Math.min(...ys))
      expect(c.y).toBeLessThan(Math.max(...ys))
    }
  })

  it('pas un rectangle : un pont surélevé et une salle des machines (deux marches)', () => {
    expect(new Set(mp.silhouette.map((p) => p.y)).size).toBe(4)
    expect(mp.silhouette.filter((p) => p.piece.startsWith('rentrant'))).toHaveLength(4)
  })

  it('chaque angle reçoit la pièce de son sens (saillant ou rentrant)', () => {
    const s = mp.silhouette
    const dir = (a: { x: number; y: number }, b: { x: number; y: number }) => (b.x > a.x ? 'E' : b.x < a.x ? 'O' : b.y > a.y ? 'S' : 'N')
    const droite = new Set(['NE', 'ES', 'SO', 'ON'])
    for (let i = 0; i < s.length; i++) {
      const tour = dir(s[(i + s.length - 1) % s.length], s[i]) + dir(s[i], s[(i + 1) % s.length])
      expect(s[i].piece.startsWith('coin')).toBe(droite.has(tour))
    }
  })

  it('la toile tient dans une texture, même pour une grande salle', () => {
    const grand = miseEnPage({ minX: 0, minY: 0, maxX: 6000, maxY: 3600 }, vue)
    expect(grand.largeur).toBeLessThanOrEqual(TOILE_MAX + 1)
    expect(grand.hauteur).toBeLessThanOrEqual(TOILE_MAX + 1)
    expect(mp.densite).toBeGreaterThan(0)
    expect((mp.monde.maxX - mp.monde.minX) / R).toBeCloseTo(mp.largeur / mp.densite, 6)
  })

  it('hors d’une run, une mini-carte d’attente', () => {
    const g = miseEnPage(salle, vueGenerique())
    expect(g.cellules).toHaveLength(17)
  })
})

describe('module 2D — la transition entre deux salles', () => {
  const mp = miseEnPage(salle, vue)
  const de = centreCellule(salle, vue, 0, 1) // la salle quittée : rang 0, voie 1
  const p = { de, salle, zoomSalle: 0.6 }

  it('le centre d’une cellule dans le monde est bien celui que la toile dessine', () => {
    const c = mp.cellules.find((k) => k.etat === 'joue')!
    const versMondeX = (x: number) => mp.monde.minX + (x / mp.largeur) * (mp.monde.maxX - mp.monde.minX)
    const versMondeY = (y: number) => mp.monde.maxY - (y / mp.hauteur) * (mp.monde.maxY - mp.monde.minY)
    expect(versMondeX(c.x)).toBeCloseTo(de.x, 6)
    expect(versMondeY(c.y)).toBeCloseTo(de.y, 6)
  })

  it('elle part sur la salle quittée, qui remplit l’écran comme une salle', () => {
    const e = etatTransition(0, p)
    expect(e.camera.x).toBeCloseTo(de.x, 9)
    expect(e.camera.y).toBeCloseTo(de.y, 9)
    expect(e.camera.zoom).toBeCloseTo(p.zoomSalle / CELLULE_L, 9)
  })

  it('elle finit sur la nouvelle salle, au plan large, la cellule à sa taille et effacée', () => {
    const e = etatTransition(DUREE_TRANSITION, p)
    expect(e.camera.x).toBeCloseTo(0, 9)
    expect(e.camera.y).toBeCloseTo(0, 9)
    expect(e.camera.zoom).toBeCloseTo(p.zoomSalle, 9)
    expect(e.couvre).toEqual(salle)
    expect(e.opacite).toBeCloseTo(0, 9)
  })

  it('rétrécir, puis glisser vers la DROITE, puis grossir : sans saut entre les temps', () => {
    let av = etatTransition(0, p)
    for (let t = 0.01; t <= DUREE_TRANSITION; t += 0.01) {
      const e = etatTransition(t, p)
      expect(Math.abs(Math.log(e.camera.zoom / av.camera.zoom))).toBeLessThan(0.08)
      expect(Math.abs(e.camera.x - av.camera.x)).toBeLessThan(0.03 * (salle.maxX - salle.minX))
      expect(e.camera.x).toBeGreaterThanOrEqual(av.camera.x - 1e-9) // toujours vers la droite
      av = e
    }
    const g = TRANSITION.retrecit + TRANSITION.glisse
    const l = (r: { minX: number; maxX: number }) => r.maxX - r.minX
    expect(l(etatTransition(g, p).couvre)).toBeCloseTo(CELLULE_L * (salle.maxX - salle.minX), 6)
    expect(l(etatTransition(g + TRANSITION.grossit / 2, p).couvre)).toBeGreaterThan(l(etatTransition(g, p).couvre))
  })

  it('la salle reste cachée tant que la cellule grossit', () => {
    for (let t = 0; t < TRANSITION.retrecit + TRANSITION.glisse + TRANSITION.grossit; t += 0.05)
      expect(etatTransition(t, p).opacite).toBe(1)
  })
})
