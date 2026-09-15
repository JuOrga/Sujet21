import { describe, expect, it } from 'vitest'
import {
  alphaReste,
  alphaSobre,
  alphaVoile,
  avanceFront,
  dessineDissolutionParoi,
  dessineDissolutionParoiSobre,
  dessineVoile,
  dessineVoileSobre,
  ESTAMPILLE,
  estampilleVisible,
  instantNappes,
  mesures,
  nappes,
  NAPPES_PAS,
  pochoir,
  signatureVoile,
  TRAITS_FONDU,
  VOILE_DUREE,
  VOILE_SOBRE_DUREE,
  type EtatVoile,
  type VueVoile,
} from './voileCache'
import { FORME_ARC } from '../game/formes'

/** Un contexte 2D factice : il note chaque appel (et les textes écrits),
 *  note les changements de mode de composition, accepte toute autre
 *  affectation, et rend un dégradé muet quand on en crée. */
function contexteFactice(largeurTexte = 100): {
  g: CanvasRenderingContext2D
  appels: string[]
  textes: string[]
} {
  const appels: string[] = []
  const textes: string[] = []
  const gradient = { addColorStop: (): void => {} }
  const g = new Proxy({} as Record<string, unknown>, {
    get: (_cible, prop) => {
      if (typeof prop !== 'string') return undefined
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient')
        return (): typeof gradient => {
          appels.push(prop)
          return gradient
        }
      if (prop === 'measureText')
        return (): { width: number } => {
          appels.push('measureText')
          return { width: largeurTexte }
        }
      if (prop === 'fillText')
        return (t: string): void => {
          appels.push('fillText')
          textes.push(t)
        }
      if (prop === 'clip')
        return (regle?: string): void => {
          appels.push(regle ? `clip:${regle}` : 'clip')
        }
      return (): void => {
        appels.push(prop)
      }
    },
    set: (_cible, prop, valeur) => {
      if (prop === 'globalCompositeOperation') appels.push(`gco:${String(valeur)}`)
      return true
    },
  })
  return { g: g as unknown as CanvasRenderingContext2D, appels, textes }
}

type Factice = ReturnType<typeof contexteFactice>

/** La scène d'un test : le canevas des effets (g), le calque de la levée
 *  (c), le mémo (m) — neuf, sauf si l'on dit qu'il est à jour — et la vue
 *  qui les fournit. */
function scene(
  zoom = 0.5,
  largeurTexte = 100,
  memoAJour = false,
): { g: Factice; c: Factice; m: Factice; vue: VueVoile } {
  const g = contexteFactice()
  const c = contexteFactice()
  const m = contexteFactice(largeurTexte)
  const vw = 1600
  const vh = 900
  const vue: VueVoile = {
    vw,
    vh,
    zoom,
    dpr: 1,
    versEcran: (x, y) => ({ sx: vw / 2 + x * zoom, sy: vh / 2 - y * zoom }),
    calque: () => c.g,
    memo: () => ({ c: m.g, neuf: !memoAJour }),
  }
  return { g, c, m, vue }
}

// la cachette du démineur : un carré de 400 au milieu d'une chambre de 800
const CACHE = { minX: 200, minY: 200, maxX: 600, maxY: 600 }
const voile: EtatVoile = { levee: Infinity, entreeX: 0, entreeY: 0 }
const leve = (depuis: number): EtatVoile => ({
  levee: 10 - depuis,
  entreeX: 210,
  entreeY: 400,
})
const compte = (appels: string[], nom: string): number =>
  appels.filter((a) => a === nom).length

describe('la levée du voile — les courbes', () => {
  it('le voile fermé est plein, la levée finie ne laisse rien', () => {
    expect(alphaVoile(Infinity, 999)).toBe(1)
    expect(alphaVoile(3, 3)).toBe(1)
    expect(alphaVoile(3, 3 + VOILE_DUREE)).toBeCloseTo(0, 9)
    expect(alphaVoile(3, 3 + VOILE_DUREE * 4)).toBe(0)
  })

  it('le front sort vite du corps et ralentit en s’éloignant', () => {
    expect(avanceFront(Infinity, 5)).toBe(0)
    expect(avanceFront(0, 0)).toBe(0)
    expect(avanceFront(0, VOILE_DUREE)).toBe(1)
    // à mi-course il a déjà fait plus de la moitié du chemin
    expect(avanceFront(0, VOILE_DUREE / 2)).toBeGreaterThan(0.5)
    // et il ne recule jamais
    let prev = 0
    for (let k = 1; k <= 20; k++) {
      const v = avanceFront(0, (VOILE_DUREE * k) / 20)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('la lisière et le liseré tiennent jusqu’aux deux tiers, puis s’effacent', () => {
    expect(alphaReste(Infinity, 5)).toBe(1)
    expect(alphaReste(0, VOILE_DUREE * 0.5)).toBe(1)
    expect(alphaReste(0, VOILE_DUREE * 0.8)).toBeLessThan(1)
    expect(alphaReste(0, VOILE_DUREE * 0.8)).toBeGreaterThan(0)
    expect(alphaReste(0, VOILE_DUREE)).toBe(0)
  })
})

describe('les nappes, l’estampille, les mesures', () => {
  it('les nappes dérivent DANS le pan, et la même cachette redonne les mêmes', () => {
    for (const t of [0, 3.7, 120]) {
      for (const n of nappes(2, t)) {
        expect(n.u).toBeGreaterThan(0.1)
        expect(n.u).toBeLessThan(0.9)
        expect(n.v).toBeGreaterThan(0.1)
        expect(n.v).toBeLessThan(0.9)
        expect(n.r).toBeGreaterThan(0.2)
      }
    }
    expect(nappes(2, 3.7)).toEqual(nappes(2, 3.7))
    expect(nappes(2, 3.7)).not.toEqual(nappes(3, 3.7))
  })

  it('l’estampille ne se pose que sur un pan assez large à l’écran', () => {
    expect(estampilleVisible(200, 200)).toBe(true)
    expect(estampilleVisible(119, 200)).toBe(false)
    expect(estampilleVisible(200, 35)).toBe(false)
    expect(pochoir('NON')).toBe('N O N')
  })

  it('la hachure et la lisière suivent le zoom sans sortir de leur fourchette', () => {
    expect(mesures(0.01)).toEqual({ hachure: 7, lisiere: 12 })
    expect(mesures(0.5)).toEqual({ hachure: 15, lisiere: 45 })
    expect(mesures(10)).toEqual({ hachure: 16, lisiere: 72 })
  })
})

describe('la signature du mémo', () => {
  const trace = (dx = 0, dy = 0, zoom = 0.5) => ({
    minX: 100 + dx,
    minY: 50 + dy,
    maxX: 300 + dx,
    maxY: 250 + dy,
    pts: [{ sx: 145 + dx, sy: 95 + dy }],
    zoom,
  })
  it('ne dépend pas de la place à l’écran : le bitmap se pose où l’on veut', () => {
    const a = signatureVoile(CACHE, trace(), { zoom: 0.5, dpr: 1 }, 5)
    const b = signatureVoile(CACHE, trace(37.25, -12.5), { zoom: 0.5, dpr: 1 }, 5)
    expect(a).toBe(b)
  })
  it('change avec le zoom, la forme et le pas des nappes', () => {
    const a = signatureVoile(CACHE, trace(), { zoom: 0.5, dpr: 1 }, 5)
    expect(signatureVoile(CACHE, trace(), { zoom: 0.51, dpr: 1 }, 5)).not.toBe(a)
    expect(signatureVoile(CACHE, trace(), { zoom: 0.5, dpr: 2 }, 5)).not.toBe(a)
    expect(signatureVoile({ ...CACHE, angle: 10 }, trace(), { zoom: 0.5, dpr: 1 }, 5)).not.toBe(a)
    // dans le même pas : la même ; au pas suivant : une autre
    expect(signatureVoile(CACHE, trace(), { zoom: 0.5, dpr: 1 }, 5 + NAPPES_PAS * 0.9)).toBe(a)
    expect(signatureVoile(CACHE, trace(), { zoom: 0.5, dpr: 1 }, 5 + NAPPES_PAS)).not.toBe(a)
  })
  it('les pas des nappes sont décalés d’une cachette à l’autre : pas de pic commun', () => {
    // à l’instant 5, la cachette 0 change de pas ; la 1 et la 2, non
    expect(instantNappes(0, 5)).not.toBe(instantNappes(0, 5 - 1e-6))
    expect(instantNappes(1, 5)).toBe(instantNappes(1, 5 - 1e-6))
    expect(instantNappes(2, 5)).toBe(instantNappes(2, 5 - 1e-6))
    // chacune change une fois par pas, et l’instant reste dans le pas
    for (const i of [0, 1, 2, 3]) {
      const t = instantNappes(i, 7.3)
      expect(t).toBeLessThanOrEqual(7.3)
      expect(t).toBeGreaterThan(7.3 - NAPPES_PAS)
      expect(instantNappes(i, 7.3 + NAPPES_PAS)).toBeCloseTo(t + NAPPES_PAS, 9)
    }
  })
})

describe('le dessin du brouillard', () => {
  it('voilé : le mémo se peint (forme, hachure, nappes, estampille) et se pose en un drawImage', () => {
    const { g, c, m, vue } = scene()
    expect(dessineVoile(g.g, CACHE, voile, 5, vue, 0)).toBe(true)
    expect(m.appels).toContain('clip')
    expect(m.appels).toContain('fillRect')
    expect(compte(m.appels, 'createRadialGradient')).toBe(4)
    expect(m.textes).toEqual([pochoir(ESTAMPILLE)])
    // le canevas des effets ne reçoit que le mémo, une fois ; le calque
    // de la levée ne sert pas
    expect(compte(g.appels, 'drawImage')).toBe(1)
    expect(g.appels).not.toContain('fillRect')
    expect(c.appels).toEqual([])
  })

  it('voilé, mémo à jour : rien ne se repeint, le mémo se pose tel quel', () => {
    const { g, c, m, vue } = scene(0.5, 100, true)
    expect(dessineVoile(g.g, CACHE, voile, 5, vue, 0)).toBe(true)
    expect(m.appels).toEqual([])
    expect(c.appels).toEqual([])
    expect(compte(g.appels, 'drawImage')).toBe(1)
  })

  it('le bord se fond des deux côtés : un masque effacé dedans, prolongé dehors, les textures dedans, aucun liseré', () => {
    const { g, m, vue } = scene()
    dessineVoile(g.g, CACHE, voile, 5, vue, 0)
    // dedans : la forme, et l’effacement ; dehors : l’emprise moins la
    // forme, en pair-impair
    expect(compte(m.appels, 'clip')).toBe(1)
    expect(compte(m.appels, 'clip:evenodd')).toBe(1)
    expect(compte(m.appels, 'gco:destination-out')).toBe(1)
    // N traits de chaque côté, puis la hachure — et rien d’autre : plus de
    // liseré pointillé sur le contour
    expect(compte(m.appels, 'stroke')).toBe(1 + 2 * TRAITS_FONDU)
    expect(m.appels).not.toContain('setLineDash')
    // les textures prennent l’opacité du brouillard — sans source-in, qui
    // recompose tout le canevas
    expect(m.appels).toContain('gco:source-atop')
    expect(m.appels).not.toContain('gco:source-in')
    expect(m.appels.indexOf('gco:destination-out')).toBeLessThan(m.appels.indexOf('gco:source-atop'))
  })

  it('en cours de levée : le mémo passe par le calque, où le front se creuse en dégradé', () => {
    const { g, c, vue } = scene(0.5, 100, true)
    expect(dessineVoile(g.g, CACHE, leve(VOILE_DUREE * 0.4), 10, vue, 0)).toBe(true)
    expect(compte(c.appels, 'drawImage')).toBe(1)
    expect(compte(c.appels, 'gco:destination-out')).toBe(1)
    expect(compte(c.appels, 'createRadialGradient')).toBe(1)
    expect(compte(g.appels, 'drawImage')).toBe(1)
  })

  it('levé : plus rien ne se dessine, nulle part', () => {
    const { g, c, m, vue } = scene()
    expect(dessineVoile(g.g, CACHE, leve(VOILE_DUREE + 0.01), 10, vue, 0)).toBe(false)
    expect(g.appels).toEqual([])
    expect(c.appels).toEqual([])
    expect(m.appels).toEqual([])
  })

  it('hors champ : rien, pas même un chemin', () => {
    const { g, c, m, vue } = scene()
    const loin = { minX: 9000, minY: 9000, maxX: 9400, maxY: 9400 }
    expect(dessineVoile(g.g, loin, voile, 5, vue, 0)).toBe(false)
    expect(g.appels).toEqual([])
    expect(c.appels).toEqual([])
    expect(m.appels).toEqual([])
  })

  it('un pan trop petit à l’écran garde le brouillard mais tait l’estampille', () => {
    const { g, m, vue } = scene(0.2)
    expect(dessineVoile(g.g, CACHE, voile, 5, vue, 0)).toBe(true)
    expect(m.appels).toContain('fillRect')
    expect(m.textes).toEqual([])
  })

  it('une estampille plus large que son pan ne se pose pas', () => {
    // le pan fait 200 px à l’écran ; le texte en ferait 190 : il déborderait
    const { g, m, vue } = scene(0.5, 190)
    expect(dessineVoile(g.g, CACHE, voile, 5, vue, 0)).toBe(true)
    expect(m.appels).toContain('measureText')
    expect(m.textes).toEqual([])
  })

  it('un arc a son centre dehors : pas d’estampille dans le vide', () => {
    const { g, m, vue } = scene()
    const arc = { ...CACHE, forme: FORME_ARC, p0: 0.3, p1: 120 }
    expect(dessineVoile(g.g, arc, voile, 5, vue, 0)).toBe(true)
    expect(m.textes).toEqual([])
  })

  it('la paroi factice ne dessine que sa dissolution, sur le calque, jamais voilée', () => {
    const fermee = scene()
    expect(dessineDissolutionParoi(fermee.g.g, CACHE, voile, 5, fermee.vue)).toBe(false)
    expect(fermee.g.appels).toEqual([])
    expect(fermee.c.appels).toEqual([])
    const ouverte = scene()
    expect(
      dessineDissolutionParoi(ouverte.g.g, CACHE, leve(VOILE_DUREE * 0.3), 10, ouverte.vue),
    ).toBe(true)
    expect(ouverte.c.appels).toContain('fillRect')
    expect(ouverte.c.appels).toContain('gco:destination-out')
    expect(ouverte.m.appels).toEqual([])
    expect(compte(ouverte.g.appels, 'drawImage')).toBe(1)
    const finie = scene()
    expect(
      dessineDissolutionParoi(finie.g.g, CACHE, leve(VOILE_DUREE + 1), 10, finie.vue),
    ).toBe(false)
  })
})

describe('le mode SOBRE : l’ancien voile, tel quel', () => {
  it('fond d’un bloc en 0,9 s', () => {
    expect(alphaSobre(Infinity, 99)).toBe(1)
    expect(alphaSobre(3, 3)).toBe(1)
    expect(alphaSobre(3, 3 + VOILE_SOBRE_DUREE / 2)).toBeCloseTo(0.5, 9)
    expect(alphaSobre(3, 3 + VOILE_SOBRE_DUREE)).toBeCloseTo(0, 9)
  })

  it('se dessine directement sur le canevas des effets : ni mémo, ni calque', () => {
    const { g, c, m, vue } = scene()
    expect(dessineVoileSobre(g.g, CACHE, voile, 5, vue, 0)).toBe(true)
    expect(c.appels).toEqual([])
    expect(m.appels).toEqual([])
    // le rectangle plein dans la forme, quatre nappes, le liseré d’un pixel
    expect(compte(g.appels, 'clip')).toBe(1)
    expect(compte(g.appels, 'createRadialGradient')).toBe(4)
    expect(compte(g.appels, 'stroke')).toBe(1)
    expect(g.appels).not.toContain('drawImage')
    expect(g.textes).toEqual([])
  })

  it('levé ou hors champ : rien', () => {
    const { g, vue } = scene()
    expect(dessineVoileSobre(g.g, CACHE, leve(VOILE_SOBRE_DUREE + 0.01), 10, vue, 0)).toBe(false)
    const loin = { minX: 9000, minY: 9000, maxX: 9400, maxY: 9400 }
    expect(dessineVoileSobre(g.g, loin, voile, 5, vue, 0)).toBe(false)
    expect(g.appels).toEqual([])
  })

  it('la paroi factice fond d’un bloc, jamais tant qu’elle est voilée', () => {
    const fermee = scene()
    expect(dessineDissolutionParoiSobre(fermee.g.g, CACHE, voile, 5, fermee.vue)).toBe(false)
    expect(fermee.g.appels).toEqual([])
    const ouverte = scene()
    expect(
      dessineDissolutionParoiSobre(ouverte.g.g, CACHE, leve(0.3), 10, ouverte.vue),
    ).toBe(true)
    expect(compte(ouverte.g.appels, 'fillRect')).toBe(2)
    expect(ouverte.g.appels).not.toContain('arc')
    expect(ouverte.c.appels).toEqual([])
  })
})
