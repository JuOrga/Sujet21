import { describe, expect, it } from 'vitest'
import {
  AMORTI,
  AMORTI_QUITTE,
  ECART_MAX,
  GOUTTE_PX,
  PAS_RIVE,
  Ressort,
  Rive,
  SEUIL_CALME,
  SOUS_PAS,
  contourCarte,
  houle,
  longueurContour,
} from './onde'

// LE CONTOUR D'EAU D'UNE CARTE DU TIRAGE (onde.ts, ondeVue.ts). L'effet
// d'avant sautait d'un événement à l'autre et se remettait à plat d'un
// coup : « ça fait buggé, pas fluide, pas beau » ; puis l'eau est passée du
// cœur de la carte à son bord : « plutôt sur les bordures, les quatre
// traits qui délimitent une carte » (le concepteur, 22/11). Ces gardes
// tiennent ce qui le rend fluide (une onde stable, qui fait le tour de la
// carte et se calme d'elle-même) et tenable à 60 i/s.

// la plus grande carte du tirage au banc (1280 × 800) : 361 × 389 px, le
// coin haut droit coupé de 14 px, un nœud tous les PAS_RIVE px
const L = 361
const H = 389
const C = 14
const contour = contourCarte(L, H, C)
const N = contour.length
/** les pas d'onde pour `s` secondes à 60 images par seconde */
const pasPour = (s: number): number => Math.round(s * 60 * SOUS_PAS)
/** le nœud au milieu du bord haut, là où tombe la goutte du clavier */
const HAUT = Math.round((L - C) / 2 / PAS_RIVE)
/** la goutte d'entrée, en nœuds */
const R = GOUTTE_PX / PAS_RIVE

describe('le contour — les quatre traits et le coin coupé', () => {
  it('fait le tour de la carte, coin coupé compris', () => {
    const attendu = 2 * L + 2 * H - 2 * C + Math.hypot(C, C)
    expect(longueurContour(contour)).toBeCloseTo(attendu, 3)
    // un nœud tous les PAS_RIVE px environ
    expect(N).toBeGreaterThan(attendu / (PAS_RIVE * 1.1))
    expect(N).toBeLessThan(attendu / (PAS_RIVE * 0.9))
  })

  it('porte en chaque nœud une normale unitaire, tournée vers le dehors', () => {
    for (const q of contour) {
      expect(Math.hypot(q.nx, q.ny)).toBeCloseTo(1, 6)
      // vers le dehors : elle s'éloigne du centre de la carte
      expect((q.x - L / 2) * q.nx + (q.y - H / 2) * q.ny).toBeGreaterThan(0)
    }
    // le bord haut regarde en haut, le bord gauche à gauche
    expect(contour[HAUT].ny).toBeCloseTo(-1, 6)
    const gauche = contour.find((q) => q.x === 0 && q.y > H / 2 && q.y < H - 1)!
    expect(gauche.nx).toBeCloseTo(-1, 6)
  })

  it('tourne ses angles : la normale d’un coin est la moyenne de ses deux côtés', () => {
    const coin = contour[0] // le coin haut gauche
    expect(coin.nx).toBeCloseTo(-Math.SQRT1_2, 6)
    expect(coin.ny).toBeCloseTo(-Math.SQRT1_2, 6)
  })
})

describe('la rive — une onde qui fait le tour et se calme', () => {
  it('une goutte posée au milieu du bord haut fait le tour, et ses deux fronts se croisent en bas', () => {
    const r = new Rive(N)
    r.goutte(HAUT, R, -3.2)
    // le nœud opposé, au milieu du bord bas
    const bas = contour.reduce((m, q, i) => (q.y === H && Math.abs(q.x - L / 2) < Math.abs(contour[m].x - L / 2) ? i : m), 0)
    let max = 0
    for (let i = 0; i < pasPour(1.2); i++) {
      r.pas()
      max = Math.max(max, Math.abs(r.ecart(bas)))
    }
    expect(max).toBeGreaterThan(0.3) // la vague y est arrivée
  })

  it('une goutte franche tremble encore à une demi-seconde, ne se voit plus à deux, se tait avant trois', () => {
    const r = new Rive(N)
    r.goutte(HAUT, R, -3.2)
    let crete = 1
    let i = 0
    let mi = 0
    let visible = 0
    for (; i < pasPour(6) && crete >= SEUIL_CALME; i++) {
      crete = r.pas()
      if (i === pasPour(0.5)) mi = crete
      // sous 0,2 px, le ruban ne change plus d'épaisseur à l'œil
      if (crete >= 0.2) visible = i
    }
    expect(mi).toBeGreaterThan(0.4) // on la voit onduler
    expect(visible / (60 * SOUS_PAS)).toBeLessThan(2)
    expect(i / (60 * SOUS_PAS)).toBeLessThan(3) // la boucle d'images, elle, s'arrête
  })

  it('une carte quittée se tait au moins deux fois plus vite que la carte visée', () => {
    const silence = (amorti: number): number => {
      const r = new Rive(N)
      r.goutte(HAUT, R, -3.2)
      let i = 0
      while (i < pasPour(6) && r.pas(amorti) >= SEUIL_CALME) i++
      return i / (60 * SOUS_PAS)
    }
    expect(silence(AMORTI_QUITTE)).toBeLessThan(silence(AMORTI) / 2)
    expect(silence(AMORTI_QUITTE)).toBeGreaterThan(0.2) // elle se calme, elle ne s'éteint pas d'un coup
  })

  it('ne déborde jamais de ECART_MAX, même sous un geste rageur', () => {
    const r = new Rive(N)
    let max = 0
    for (let t = 0; t < 600; t++) {
      r.goutte((t * 7) % N, 8, t % 2 ? 1.2 : -1.2)
      max = Math.max(max, r.pas())
    }
    expect(Number.isFinite(max)).toBe(true)
    expect(max).toBeLessThanOrEqual(ECART_MAX)
  })

  it('éteint les vaguelettes serrées bien avant les longues vagues (la viscosité)', () => {
    // un damier d'un nœud — le « trait tremblé » vu au banc — contre une
    // vague de 40 nœuds, de même hauteur
    const serree = new Rive(N)
    const longue = new Rive(N)
    for (let i = 0; i < N; i++) {
      serree.goutte(i, 1, i % 2 ? 0.5 : -0.5)
      longue.goutte(i, 1, 0.5 * Math.sin((2 * Math.PI * i) / 40))
    }
    let s = 0
    let l = 0
    for (let i = 0; i < 30; i++) {
      s = serree.pas()
      l = longue.pas()
    }
    expect(s).toBeLessThan(l / 5)
  })

  it('aplanit() rend la rive à plat, d’un coup', () => {
    const r = new Rive(N)
    r.goutte(HAUT, R, -3.2)
    r.pas()
    r.aplanit()
    expect(r.pas()).toBe(0)
  })
})

describe('la houle — un contour au repos reste de l’eau', () => {
  const longueur = longueurContour(contour)
  it('ne casse pas là où la boucle se referme', () => {
    for (const t of [0, 0.7, 3.1]) expect(houle(0, longueur, t)).toBeCloseTo(houle(longueur, longueur, t), 6)
  })
  it('reste douce : sous le pixel et demi, et lente', () => {
    let max = 0
    let pente = 0
    let saut = 0
    for (let s = 0; s < longueur; s += 1) {
      const v = houle(s, longueur, 1.3)
      max = Math.max(max, Math.abs(v))
      // le long du contour, pas de pli : une pente douce, en px par px
      // (comptée au pixel, elle ne dépend pas de la maille de la rive)
      pente = Math.max(pente, Math.abs(houle(s + 1, longueur, 1.3) - v))
      // d'une image à la suivante, pas de saccade
      saut = Math.max(saut, Math.abs(houle(s, longueur, 1.3 + 1 / 60) - v))
    }
    expect(max).toBeLessThan(1.5)
    expect(max).toBeGreaterThan(0.4) // elle se voit
    expect(pente).toBeLessThan(0.05)
    expect(saut).toBeLessThan(0.05)
  })
})

describe('le coût d’une image', () => {
  it('les pas d’onde et la houle de tout le contour tiennent bien sous 0,2 ms', () => {
    // le budget d'une image à 60 i/s est de 16,7 ms ; le Steam Deck et un
    // téléphone vont trois à cinq fois moins vite que la machine des tests
    const r = new Rive(N)
    const longueur = longueurContour(contour)
    r.goutte(HAUT, R, -3.2)
    let puits = 0
    const image = (t: number): void => {
      for (let k = 0; k < SOUS_PAS; k++) r.pas()
      for (const q of contour) puits += houle(q.s, longueur, t)
    }
    for (let i = 0; i < 50; i++) image(i / 60)
    const t0 = performance.now()
    const M = 400
    for (let i = 0; i < M; i++) image(i / 60)
    const ms = (performance.now() - t0) / M
    expect(Number.isFinite(puits)).toBe(true)
    expect(ms).toBeLessThan(0.2)
  })
})

describe('le ressort — rejoindre sa cible sans sauter', () => {
  it('ne saute pas : d’une image à l’autre, la valeur avance par petits pas', () => {
    const r = new Ressort(0, 150, 13)
    r.cible = 5 // l'inclinaison au bord de la carte
    let avant = 0
    let ecart = 0
    for (let i = 0; i < 120; i++) {
      r.pas(1 / 60)
      ecart = Math.max(ecart, Math.abs(r.valeur - avant))
      avant = r.valeur
    }
    expect(ecart).toBeLessThan(5 * 0.25) // jamais plus d'un quart du chemin par image
    expect(r.pose()).toBe(true)
  })

  it('flotte : il dépasse un peu sa cible avant de se poser, sans osciller sans fin', () => {
    const r = new Ressort(0, 210, 16)
    r.cible = -6 // la flottaison de la carte visée
    let min = 0
    let i = 0
    for (; i < 240 && !r.pose(0.05); i++) {
      r.pas(1 / 60)
      min = Math.min(min, r.valeur)
    }
    expect(min).toBeLessThan(-6.05) // le léger dépassement
    expect(min).toBeGreaterThan(-7.5) // … léger
    expect(i / 60).toBeLessThan(1.2) // posé en moins d'une seconde et quart
  })

  it('reste stable à 30 images par seconde', () => {
    const r = new Ressort(0, 420, 11)
    r.vitesse = 0.32
    for (let i = 0; i < 120; i++) r.pas(1 / 30)
    expect(Math.abs(r.valeur)).toBeLessThan(0.001)
  })
})
