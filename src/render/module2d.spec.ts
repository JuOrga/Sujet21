// LE MODULE EN 2D : la salle tombe à sa place dans la grille, la mini-carte
// se lit dans les cellules et les tubes, la silhouette est fermée et habillée.

import { describe, expect, it } from 'vitest'
import {
  CELLULE_L,
  CYL_BERCEAU,
  CYL_DOME,
  DETAIL_L,
  RATIO_COLONNE,
  DUREE_ENTREE,
  DUREE_TRANSITION,
  DENSITE_PROCHE,
  ENTREE,
  TOILE_MAX,
  TRANSITION,
  centreCellule,
  dureeTransition,
  etatEntree,
  etatTransition,
  etats,
  fenetreProche,
  fenetreVue,
  formeDuBiome,
  genreTransition,
  miseEnPage,
  vueCouverte,
  suisCamera,
  VUE_POSEE_MS,
  vueGenerique,
  zoomEnsemble,
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

  it('sous la salle jouée, chaque tube se prolonge jusqu’à son centre : la transition la montre en cellule', () => {
    // la salle (1, 0) : deux tubes y arrivent (de 0:0, éteint, et de 0:1,
    // joué), deux en partent — un raccord par côté, le plus vif l'emporte
    expect(mp.raccords).toHaveLength(2)
    const cx = (mp.salle.minX + mp.salle.maxX) / 2
    const cy = (mp.salle.minY + mp.salle.maxY) / 2
    for (const t of mp.raccords) {
      expect(t.ay).toBeCloseTo(cy, 6)
      expect(t.by).toBeCloseTo(cy, 6)
      // du centre de la salle à l'un de ses bords, là où le tube visible s'arrête
      expect(Math.min(Math.abs(t.ax - cx), Math.abs(t.bx - cx))).toBeCloseTo(0, 6)
      const bord = Math.max(Math.abs(t.ax - cx), Math.abs(t.bx - cx))
      expect(bord).toBeCloseTo((mp.salle.maxX - mp.salle.minX) / 2, 6)
      expect(mp.tubes.some((u) => u.ay === t.ay && (Math.abs(u.ax - cx) === bord || Math.abs(u.bx - cx) === bord))).toBe(true)
    }
    expect(mp.raccords.map((t) => t.etat)).toEqual(['joue', 'ambre'])
  })

  it('chaque cellule porte l’icône et la prime de son nœud ; sans nœuds, aucune', () => {
    const noeud = (r: number, v: number) => ({ icone: r === 2 && v === 1 ? 'rencontre' : 'eau', prime: r === 3 && v === 2 })
    const m = miseEnPage(salle, { ...vue, noeud })
    expect(m.cellules.find((c) => c.rang === 2 && c.voie === 1)!.icone).toBe('rencontre')
    expect(m.cellules.find((c) => c.rang === 2 && c.voie === 0)!.icone).toBe('eau')
    expect(m.cellules.filter((c) => c.prime).map((c) => [c.rang, c.voie])).toEqual([[3, 2]])
    expect(m.ici).toEqual({ icone: 'eau', prime: false })
    expect(mp.cellules.every((c) => c.icone === '' && !c.prime)).toBe(true)
    expect(mp.ici.icone).toBe('')
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

  it('elle part sur la salle quittée, à sa taille et au zoom de la salle : le décor ne saute pas', () => {
    const e = etatTransition(0, p)
    expect(e.camera.x).toBeCloseTo(de.x, 9)
    expect(e.camera.y).toBeCloseTo(de.y, 9)
    expect(e.camera.zoom).toBeCloseTo(p.zoomSalle, 9)
    expect(e.depart.maxX - e.depart.minX).toBeCloseTo(salle.maxX - salle.minX, 6)
    expect(e.depart.maxY - e.depart.minY).toBeCloseTo(salle.maxY - salle.minY, 6)
    expect((e.depart.minX + e.depart.maxX) / 2).toBeCloseTo(de.x, 6)
  })

  it('rétrécir et grossir vont au MÊME rythme : la seconde moitié rejoue la première à l’envers', () => {
    const g = TRANSITION.retrecit + TRANSITION.glisse
    const ecran = (r: { minX: number; maxX: number }, zoom: number) => (r.maxX - r.minX) * zoom
    for (let f = 0; f <= 1.0001; f += 0.1) {
      const a = etatTransition(f * TRANSITION.retrecit, p)
      const b = etatTransition(g + (1 - f) * TRANSITION.grossit, p)
      expect(ecran(a.depart, a.camera.zoom)).toBeCloseTo(ecran(b.couvre, b.camera.zoom), 3)
      expect(a.camera.zoom).toBeCloseTo(b.camera.zoom, 6)
    }
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

describe('module 2D — la transition après une rencontre ou une halte', () => {
  // trois rangs joués : la salle 0:1, une rencontre en 1:1 (aucune salle),
  // puis la salle 2:2 où l'on arrive
  const v2: VueModule2d = { ...vue, rang: 2, voie: 2, joues: [1, 1] }
  const de = centreCellule(salle, v2, 0, 1)
  const etape = centreCellule(salle, v2, 1, 1)
  const p = { de, par: [etape], salle, zoomSalle: 0.6 }
  const t1 = TRANSITION.retrecit

  it('elle dure plus longtemps qu’un seul saut, et un seul saut garde sa durée', () => {
    expect(dureeTransition({ de, salle, zoomSalle: 0.6 })).toBeCloseTo(DUREE_TRANSITION, 9)
    expect(dureeTransition(p)).toBeGreaterThan(DUREE_TRANSITION)
  })

  it('la glissade PASSE par la case traversée, puis finit sur la nouvelle salle', () => {
    const glisse = dureeTransition(p) - TRANSITION.retrecit - TRANSITION.grossit - TRANSITION.revele
    const milieu = etatTransition(t1 + glisse / 2, p).camera
    expect(milieu.x).toBeCloseTo(etape.x, 6)
    expect(milieu.y).toBeCloseTo(etape.y, 6)
    const fin = etatTransition(dureeTransition(p), p)
    expect(fin.camera.x).toBeCloseTo(0, 9)
    expect(fin.camera.y).toBeCloseTo(0, 9)
    expect(fin.opacite).toBeCloseTo(0, 9)
  })

  it('toujours vers la droite, sans saut ; elle quitte et aborde chaque case à l’horizontale, comme le tube', () => {
    let av = etatTransition(0, p)
    for (let t = 0.01; t <= dureeTransition(p); t += 0.01) {
      const e = etatTransition(t, p)
      expect(e.camera.x).toBeGreaterThanOrEqual(av.camera.x - 1e-9)
      expect(Math.abs(e.camera.x - av.camera.x)).toBeLessThan(0.04 * (salle.maxX - salle.minX))
      expect(Math.abs(e.camera.y - av.camera.y)).toBeLessThan(0.04 * (salle.maxX - salle.minX))
      av = e
    }
    // le second saut change de voie (de 1:1 à 2:2) : à un dixième du saut en
    // x, la vue n'a pas fait trois centièmes du chemin en y — et de même à
    // l'arrivée
    const glisse = dureeTransition(p) - TRANSITION.retrecit - TRANSITION.grossit - TRANSITION.revele
    const part = (c: { x: number; y: number }) => [(c.x - etape.x) / (0 - etape.x), (c.y - etape.y) / (0 - etape.y)]
    let vu = 0
    for (let t = t1 + glisse / 2; t < t1 + glisse; t += 0.002) {
      const [px, py] = part(etatTransition(t, p).camera)
      if (px > 0.02 && px < 0.1) {
        expect(py).toBeLessThan(0.03)
        vu++
      }
      if (px > 0.9 && px < 0.98) {
        expect(py).toBeGreaterThan(0.97)
        vu++
      }
    }
    expect(vu).toBeGreaterThan(2)
  })
})

describe('module 2D — l’ombre de la salle pendant la transition', () => {
  const p = { de: centreCellule(salle, vue, 0, 1), salle, zoomSalle: 0.6 }

  it('aucune tant que la salle n’est qu’une cellule ; elle revient avec la salle', () => {
    const cache = TRANSITION.retrecit + TRANSITION.glisse + TRANSITION.grossit
    for (let t = 0; t < cache; t += 0.05) expect(etatTransition(t, p).ombre).toBe(0)
    const mi = etatTransition(cache + TRANSITION.revele / 2, p)
    expect(mi.ombre).toBeCloseTo(1 - mi.opacite, 9)
    expect(mi.ombre).toBeGreaterThan(0)
    expect(etatTransition(DUREE_TRANSITION, p).ombre).toBeCloseTo(1, 9)
  })
})

describe('module 2D — l’entrée dans un module : le plan d’ensemble', () => {
  const v0: VueModule2d = { ...vue, rang: 0, voie: 1, joues: [] }
  const mp = miseEnPage(salle, v0)
  const ecran = { l: 1280, h: 800 }
  const zoomSalle = Math.min(ecran.l / (salle.maxX - salle.minX), ecran.h / (salle.maxY - salle.minY)) * 0.92
  const p = { module: mp.monde, zoomModule: zoomEnsemble(mp.monde, ecran.l, ecran.h, zoomSalle), salle, zoomSalle }

  it('le module entier tient dans l’écran, puis la vue finit sur la salle au plan large', () => {
    const e0 = etatEntree(0, p)
    const demiL = ecran.l / 2 / e0.camera.zoom
    const demiH = ecran.h / 2 / e0.camera.zoom
    expect(e0.camera.x - demiL).toBeLessThanOrEqual(mp.monde.minX)
    expect(e0.camera.x + demiL).toBeGreaterThanOrEqual(mp.monde.maxX)
    expect(e0.camera.y - demiH).toBeLessThanOrEqual(mp.monde.minY)
    expect(e0.camera.y + demiH).toBeGreaterThanOrEqual(mp.monde.maxY)
    const fin = etatEntree(DUREE_ENTREE, p)
    expect(fin.camera.x).toBeCloseTo(0, 9)
    expect(fin.camera.y).toBeCloseTo(0, 9)
    expect(fin.camera.zoom).toBeCloseTo(zoomSalle, 9)
    expect(fin.couvre).toEqual(salle)
    expect(fin.opacite).toBeCloseTo(0, 9)
    expect(fin.ombre).toBeCloseTo(1, 9)
  })

  it('on ne quitte aucune salle ; la salle reste couverte, sans ombre, jusqu’à la fin de la plongée', () => {
    for (let t = 0; t < ENTREE.tenue + ENTREE.plonge; t += 0.05) {
      const e = etatEntree(t, p)
      expect(e.depart).toBeNull()
      expect(e.opacite).toBe(1)
      expect(e.ombre).toBe(0)
    }
  })

  it('pendant la plongée, la salle visée ne s’éloigne jamais du centre de l’écran, et rien ne saute', () => {
    const ecart = (t: number) => {
      const c = etatEntree(t, p).camera
      return Math.hypot((0 - c.x) * c.zoom, (0 - c.y) * c.zoom)
    }
    let av = ecart(ENTREE.tenue)
    let cam = etatEntree(0, p).camera
    for (let t = 0.01; t <= DUREE_ENTREE; t += 0.01) {
      const c = etatEntree(t, p).camera
      expect(Math.abs(Math.log(c.zoom / cam.zoom))).toBeLessThan(0.08)
      cam = c
      if (t <= ENTREE.tenue) continue
      const e = ecart(t)
      expect(e).toBeLessThanOrEqual(av + 1e-6)
      av = e
    }
    expect(av).toBeCloseTo(0, 6)
  })

  it('un module si court qu’il tient presque au plan de la salle garde une plongée', () => {
    const petit = { minX: -600, maxX: 600, minY: -400, maxY: 400 }
    expect(zoomEnsemble(petit, ecran.l, ecran.h, zoomSalle)).toBeLessThanOrEqual(zoomSalle / 2)
  })
})

describe('module 2D — quelle transition joue', () => {
  it('vers une salle d’après dans le même module : la transition entre salles', () => {
    expect(genreTransition({ module: 'C1', niveau: 1 }, { module: 'C1', niveau: 2 })).toBe('salle')
  })

  it('APRÈS UNE RENCONTRE OU UNE HALTE aussi : elles franchissent un rang sans salle', () => {
    // le défaut signalé le 10/11 : après un « ? », la salle suivante surgissait
    // sans transition — deux rangs d'un coup la coupaient
    expect(genreTransition({ module: 'C1', niveau: 1 }, { module: 'C1', niveau: 3 })).toBe('salle')
  })

  it('un nouvel essai de la même salle : aucune', () => {
    expect(genreTransition({ module: 'C1', niveau: 2 }, { module: 'C1', niveau: 2 })).toBe('aucune')
  })

  it('un autre module, ou la première salle chargée : l’entrée, le plan d’ensemble', () => {
    expect(genreTransition({ module: 'C1', niveau: 3 }, { module: 'P2', niveau: 0 })).toBe('entree')
    expect(genreTransition(null, { module: 'C1', niveau: 1 })).toBe('entree')
  })

  it('les positions sont celles AU CHARGEMENT : relevée pendant la cérémonie, la salle quittée a déjà avancé', () => {
    // le scénario de l'aperçu du 02/10 : salle chargée au rang 1 ; au sas,
    // la run compte la salle franchie (rang 2) AVANT la cérémonie ; la
    // salle suivante se charge au rang 2
    const auChargement = { module: 'C1', niveau: 1 }
    const pendantLaCeremonie = { module: 'C1', niveau: 2 }
    const suivante = { module: 'C1', niveau: 2 }
    expect(genreTransition(pendantLaCeremonie, suivante)).toBe('aucune') // le défaut
    expect(genreTransition(auChargement, suivante)).toBe('salle') // le correctif
  })
})

describe('module 2D — une forme FIXE par type de module', () => {
  // la silhouette, ramenée en largeurs de salle et à l'origine de la grille
  // (la cellule du rang 0, voie 0) : ce qui doit rester identique
  const forme = (sal: typeof salle, v: VueModule2d, f?: 'etagee' | 'fuseau' | 'dorsale') => {
    const m = miseEnPage(sal, v, f)
    const k = m.densite
    const o = { x: (m.salle.minX + m.salle.maxX) / 2 - v.rang * 1.35 * k, y: (m.salle.minY + m.salle.maxY) / 2 }
    return m.silhouette.map((q) => [+((q.x - o.x) / k).toFixed(4), +((q.y - o.y) / k).toFixed(4), q.piece])
  }

  it('la même d’une salle à l’autre du module, quelle que soit la taille ou la forme de la salle', () => {
    const a = forme({ minX: 0, minY: 0, maxX: 1200, maxY: 800 }, { ...vue, rang: 1, voie: 1, joues: [1] })
    const b = forme({ minX: 0, minY: 0, maxX: 2000, maxY: 1000 }, { ...vue, rang: 3, voie: 1, joues: [1, 1, 1] })
    expect(b).toEqual(a)
  })

  it('le profil horizontal ne bouge pas non plus avec la voie jouée', () => {
    const a = forme(salle, { ...vue, rang: 2, voie: 0, joues: [1, 0] })
    const b = forme(salle, { ...vue, rang: 2, voie: 2, joues: [1, 2] })
    expect(b.map((q) => q[0])).toEqual(a.map((q) => q[0])) // la hauteur suit la voie, pas le profil
  })

  it('une forme par biome : la serre en cylindre, la chaufferie en fuseau, le cryo dorsal', () => {
    expect(formeDuBiome('tempere')).toBe('cylindre')
    expect(formeDuBiome('chaud')).toBe('fuseau')
    expect(formeDuBiome('cryo')).toBe('dorsale')
    expect(formeDuBiome('antichambre')).toBe('etagee')
  })

  for (const f of ['etagee', 'fuseau', 'dorsale', 'cylindre'] as const)
    it(`${f} : fermée, à angles droits, habillée selon le sens de chaque angle, et contenant la grille`, () => {
      const m = miseEnPage(salle, vue, f)
      const s = m.silhouette
      const dir = (a: { x: number; y: number }, b: { x: number; y: number }) => (b.x > a.x ? 'E' : b.x < a.x ? 'O' : b.y > a.y ? 'S' : 'N')
      const droite = new Set(['NE', 'ES', 'SO', 'ON'])
      for (let i = 0; i < s.length; i++) {
        const a = s[(i + s.length - 1) % s.length]
        const b = s[(i + 1) % s.length]
        expect(s[i].x === b.x || s[i].y === b.y).toBe(true)
        expect(s[i].piece.startsWith('coin')).toBe(droite.has(dir(a, s[i]) + dir(s[i], b)))
      }
      // dedans : pair-impair sur une demi-droite horizontale
      const dedans = (x: number, y: number) => {
        let n = 0
        for (let i = 0; i < s.length; i++) {
          const a = s[i]
          const b = s[(i + 1) % s.length]
          if (a.x === b.x && x < a.x && y > Math.min(a.y, b.y) && y < Math.max(a.y, b.y)) n++
        }
        return n % 2 === 1
      }
      for (const c of m.cellules) expect(dedans(c.x, c.y)).toBe(true)
      expect(dedans((m.salle.minX + m.salle.maxX) / 2, m.salle.minY + 1)).toBe(true)
      expect(m.largeur).toBeLessThanOrEqual(TOILE_MAX + 1)
    })

  it('un module trop court pour ses marches garde une coque simple', () => {
    const court = miseEnPage(salle, { ...vue, rangs: 2, rang: 0, joues: [] }, 'dorsale')
    expect(court.silhouette).toHaveLength(4)
  })
})

describe('module 2D — rien ne se pose contre la salle jouée', () => {
  for (const hr of [0.66, 1.0])
    it(`aucun élément sur la salle ni contre elle (salle ${hr === 1 ? 'carrée' : '3:2'})`, () => {
      const s = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 * hr }
      for (const voie of [0, 1, 2]) {
        const m = miseEnPage(s, { ...vue, voie, joues: [voie] })
        const marge = 0.25 * m.densite
        for (const e of m.elements) {
          const dedans = e.x > m.salle.minX - marge && e.x < m.salle.maxX + marge && e.y > m.salle.minY - marge && e.y < m.salle.maxY + marge
          expect(dedans).toBe(false)
        }
      }
    })
})

describe('module 2D — les pièces de la serre', () => {
  it('chaque forme a sa salle des machines, dans la coque ; un module court n’en a pas', () => {
    for (const forme of ['etagee', 'fuseau', 'dorsale'] as const) {
      const m = miseEnPage(salle, vue, forme)
      expect(m.machines.length).toBeGreaterThan(0)
      const xs = m.silhouette.map((s) => s.x)
      const ys = m.silhouette.map((s) => s.y)
      for (const z of m.machines) {
        expect(z.maxX - z.minX).toBeGreaterThan(0.2 * m.densite)
        expect(z.maxY - z.minY).toBeGreaterThan(0.2 * m.densite)
        expect(z.minX).toBeGreaterThanOrEqual(Math.min(...xs))
        expect(z.maxX).toBeLessThanOrEqual(Math.max(...xs))
        expect(z.minY).toBeGreaterThanOrEqual(Math.min(...ys))
        expect(z.maxY).toBeLessThanOrEqual(Math.max(...ys))
      }
    }
    expect(miseEnPage(salle, { ...vue, rangs: 2, rang: 0, joues: [] }).machines).toEqual([])
  })

  for (const hr of [0.66, 1.0])
    it(`la colonne de culture tient entre deux voies sans toucher une cellule (salle ${hr === 1 ? 'carrée' : '3:2'})`, () => {
      const m = miseEnPage({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 * hr }, vue)
      const colonnes = m.elements.filter((e) => e.nom === 'colonne')
      expect(colonnes.length).toBeGreaterThan(0)
      for (const e of colonnes) {
        const h = e.l * RATIO_COLONNE
        for (const k of m.cellules) {
          const touche = Math.abs(e.x - k.x) < (e.l + k.l) / 2 && Math.abs(e.y - k.y) < (h + k.h) / 2
          expect(touche).toBe(false)
        }
      }
    })

  it('deux baies différentes en alternance, plus de trois copies de la même', () => {
    const noms = miseEnPage(salle, vue).elements.map((e) => e.nom)
    expect(noms).toContain('baie')
    expect(noms).toContain('baie-2')
  })

  it('des petits détails semés dans la coque, jamais sur la salle', () => {
    expect(miseEnPage(salle, vue).details.length).toBeGreaterThan(5)
    for (const hr of [0.66, 1.0])
      for (const voie of [0, 1, 2]) {
        const m = miseEnPage({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 * hr }, { ...vue, voie, joues: [voie] })
        const xs = m.silhouette.map((s) => s.x)
        const ys = m.silhouette.map((s) => s.y)
        const d = (DETAIL_L / 2) * m.densite
        for (const e of m.details) {
          expect(e.x - d).toBeGreaterThan(Math.min(...xs))
          expect(e.x + d).toBeLessThan(Math.max(...xs))
          expect(e.y - d).toBeGreaterThan(Math.min(...ys))
          expect(e.y + d).toBeLessThan(Math.max(...ys))
          const surSalle = e.x + d > m.salle.minX && e.x - d < m.salle.maxX && e.y + d > m.salle.minY && e.y - d < m.salle.maxY
          expect(surSalle).toBe(false)
        }
      }
  })

  it('le cylindre : la toile porte ses deux dômes et son berceau ; aucune pièce de tôle sur le vitrage', () => {
    for (const hr of [0.66, 1.0]) {
      const m = miseEnPage({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 * hr }, vue, 'cylindre')
      const H = m.corps.maxY - m.corps.minY
      expect(m.corps.minX).toBeGreaterThanOrEqual(CYL_DOME * H)
      expect(m.largeur - m.corps.maxX).toBeGreaterThanOrEqual(CYL_DOME * H)
      expect(m.hauteur - m.corps.maxY).toBeGreaterThanOrEqual(CYL_BERCEAU * H)
      expect(m.elements).toEqual([])
      expect(m.details).toEqual([])
      expect(m.machines).toEqual([])
      expect(m.largeur).toBeLessThanOrEqual(TOILE_MAX + 1)
    }
  })
})

// LA TOILE FINE SUIT LA VUE (capture du 13/11) : nette près du tableau, floue
// au dôme et aux étagères du bas dès qu'on dézoomait ou déplaçait la vue — la
// toile fine ne couvrait que la salle ± 0,6, au-delà la toile grossière
// (360 px par salle) s'agrandissait près de deux fois.
describe('module 2D — la toile fine suit la vue', () => {
  const mp = miseEnPage(salle, vue, 'cylindre', 'serre')
  const R = salle.maxX - salle.minX
  /** la vue d'un écran de l × h pixels, centrée en (x, y), à px pixels par unité */
  const vueEcran = (x: number, y: number, px: number, l = 1920, h = 1080) => ({
    minX: x - l / 2 / px,
    maxX: x + l / 2 / px,
    minY: y - h / 2 / px,
    maxY: y + h / 2 / px,
  })
  /** pixels de toile par unité monde dans une fenêtre */
  const finesse = (f: { k: number }) => (f.k * mp.largeur) / (mp.monde.maxX - mp.monde.minX)
  const contient = (a: { minX: number; minY: number; maxX: number; maxY: number }, b: typeof a) =>
    a.minX <= b.minX + 1e-6 && a.minY <= b.minY + 1e-6 && a.maxX >= b.maxX - 1e-6 && a.maxY >= b.maxY - 1e-6

  it('le module entier à l’écran : la fenêtre le couvre, à la finesse de l’écran', () => {
    // la salle à ~650 px d'écran : la toile grossière y était agrandie ×1,8
    const px = 650 / R
    const v = vueEcran(0, 0, px)
    const f = fenetreVue(mp, v, px)!
    expect(f).not.toBeNull()
    const vu = { minX: Math.max(v.minX, mp.monde.minX), maxX: Math.min(v.maxX, mp.monde.maxX), minY: Math.max(v.minY, mp.monde.minY), maxY: Math.min(v.maxY, mp.monde.maxY) }
    expect(contient(f.monde, vu)).toBe(true)
    // au moins la finesse de l'écran, à peine plus (le grain se perd au-delà)
    expect(finesse(f)).toBeGreaterThanOrEqual(px)
    expect(finesse(f)).toBeLessThan(px * 1.2)
    expect(f.l * f.k).toBeLessThanOrEqual(TOILE_MAX + 1e-6)
    expect(f.h * f.k).toBeLessThanOrEqual(TOILE_MAX + 1e-6)
  })

  it('jamais plus fine que les pièces, jamais plus de TOILE_MAX de côté', () => {
    // tout près : l'écran demande plus que les sources n'ont
    const f = fenetreVue(mp, vueEcran(0, 0, 3000 / R), 3000 / R)!
    expect(f.k).toBeCloseTo(DENSITE_PROCHE / mp.densite, 6)
    // un écran 4K, le module entier : bornée par TOILE_MAX
    const g = fenetreVue(mp, vueEcran(0, 0, 1300 / R, 3840, 2160), 1300 / R)!
    expect(Math.max(g.l * g.k, g.h * g.k)).toBeLessThanOrEqual(TOILE_MAX + 1e-6)
  })

  it('hors de la toile, ou quand la toile entière suffit : pas de fenêtre', () => {
    expect(fenetreVue(mp, vueEcran(mp.monde.maxX + 50 * R, 0, 1), 1)).toBeNull()
    // la salle à 200 px d'écran : la toile de base (360 px par salle) suffit
    expect(fenetreVue(mp, vueEcran(0, 0, 200 / R), 200 / R)).toBeNull()
  })

  it('la toile proche couvre le tableau en plein écran ; pas le module dézoomé', () => {
    const fp = fenetreProche(mp)
    const pres = 1900 / R
    expect(vueCouverte(fp, mp, vueEcran(0, 0, pres), pres)).toBe(true)
    const loin = 650 / R
    expect(vueCouverte(fp, mp, vueEcran(0, 0, loin), loin)).toBe(false)
    // ni une vue décentrée vers le dôme, même de près
    expect(vueCouverte(fp, mp, vueEcran(mp.monde.minX + 0.3 * R, 0, pres), pres)).toBe(false)
  })

  it('une fois repeinte, la vue est couverte — pas de repeinte en boucle', () => {
    for (const [x, px] of [
      [0, 650 / R],
      [mp.monde.minX + 0.3 * R, 1900 / R],
      [mp.monde.maxX, 900 / R],
      [0, 1300 / R],
    ]) {
      const v = vueEcran(x, 0, px)
      const f = fenetreVue(mp, v, px)
      expect(f).not.toBeNull()
      expect(vueCouverte(f, mp, v, px)).toBe(true)
      // un léger glissement (5 % de l'écran) ne repeint pas
      const dx = (0.05 * 1920) / px
      expect(vueCouverte(f, mp, { ...v, minX: v.minX + dx, maxX: v.maxX + dx }, px)).toBe(true)
    }
  })

  it('dézoomée puis rezoomée : la fenêtre trop grossière se repeint', () => {
    const loin = 650 / R
    const f = fenetreVue(mp, vueEcran(0, 0, loin), loin)
    const pres = 1900 / R
    expect(vueCouverte(f, mp, vueEcran(0, 0, pres), pres)).toBe(false)
  })

  it('sans fenêtre fine, une vue qui en demande une n’est pas couverte', () => {
    expect(vueCouverte(null, mp, vueEcran(0, 0, 650 / R), 650 / R)).toBe(false)
    expect(vueCouverte(null, mp, vueEcran(0, 0, 200 / R), 200 / R)).toBe(true)
  })
})

describe('module 2D — la vue posée', () => {
  it('une caméra qui frémit avec le corps est posée au bout de VUE_POSEE_MS', () => {
    // le corps est un fluide : la caméra qui le suit bouge d'un rien à chaque image
    let s = suisCamera(null, { x: 0, y: 0, zoom: 1 }, 960, 540, 0).suivi
    let posee = false
    for (let t = 16, i = 0; t <= VUE_POSEE_MS + 50; t += 16, i++) {
      const r = suisCamera(s, { x: (i % 2) * 0.5, y: (i % 3) * 0.3, zoom: 1 + (i % 2) * 1e-4 }, 960, 540, t)
      s = r.suivi
      posee ||= r.posee
    }
    expect(posee).toBe(true)
  })
  it('un glissement ou une molette remet le compte à zéro', () => {
    const s = suisCamera(null, { x: 0, y: 0, zoom: 1 }, 960, 540, 0).suivi
    expect(suisCamera(s, { x: 30, y: 0, zoom: 1 }, 960, 540, 1000).posee).toBe(false)
    expect(suisCamera(s, { x: 0, y: 0, zoom: 1.05 }, 960, 540, 1000).posee).toBe(false)
    expect(suisCamera(s, { x: 0, y: 0, zoom: 1 }, 960, 540, VUE_POSEE_MS - 1).posee).toBe(false)
    expect(suisCamera(s, { x: 0, y: 0, zoom: 1 }, 960, 540, VUE_POSEE_MS).posee).toBe(true)
  })
})
