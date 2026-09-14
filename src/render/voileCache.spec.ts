import { describe, expect, it } from 'vitest'
import {
  alphaReste,
  alphaVoile,
  avanceFront,
  dessineDissolutionParoi,
  dessineVoile,
  ESTAMPILLE,
  estampilleVisible,
  mesures,
  nappes,
  pochoir,
  TRAITS_FONDU,
  VOILE_DUREE,
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

/** La vue, et le calque qu'elle fournit : un second contexte factice. */
const vue = (
  calque: CanvasRenderingContext2D,
  zoom = 0.5,
  vw = 1600,
  vh = 900,
): VueVoile => ({
  vw,
  vh,
  zoom,
  dpr: 1,
  versEcran: (x, y) => ({ sx: vw / 2 + x * zoom, sy: vh / 2 - y * zoom }),
  calque: () => calque,
})

/** La scène d'un test : le canevas des effets (g), le calque (c), la vue. */
function scene(zoom = 0.5, largeurTexte = 100): {
  g: ReturnType<typeof contexteFactice>
  c: ReturnType<typeof contexteFactice>
  vue: VueVoile
} {
  const g = contexteFactice()
  const c = contexteFactice(largeurTexte)
  return { g, c, vue: vue(c.g, zoom) }
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

describe('le dessin du brouillard', () => {
  it('voilé : le pan se remplit dans sa forme, hachuré, estampillé, et se pose d’un coup', () => {
    const { g, c, vue } = scene()
    expect(dessineVoile(g.g, CACHE, voile, 5, vue, 0)).toBe(true)
    expect(c.appels).toContain('clip')
    expect(c.appels).toContain('fillRect')
    // quatre nappes, et pas de front : aucun cinquième dégradé
    expect(compte(c.appels, 'createRadialGradient')).toBe(4)
    expect(c.textes).toEqual([pochoir(ESTAMPILLE)])
    // le canevas des effets ne reçoit que le calque, une fois
    expect(compte(g.appels, 'drawImage')).toBe(1)
    expect(g.appels).not.toContain('fillRect')
  })

  it('le bord se fond des deux côtés : un masque effacé dedans, prolongé dehors, et le brouillard dessiné dedans', () => {
    const { g, c, vue } = scene()
    dessineVoile(g.g, CACHE, voile, 5, vue, 0)
    // dedans : la forme, et l’effacement ; dehors : l’emprise moins la
    // forme, en pair-impair
    expect(compte(c.appels, 'clip')).toBe(1)
    expect(compte(c.appels, 'clip:evenodd')).toBe(1)
    expect(compte(c.appels, 'gco:destination-out')).toBe(1)
    // N traits de chaque côté, puis la hachure — et rien d’autre : plus de
    // liseré pointillé sur le contour
    expect(compte(c.appels, 'stroke')).toBe(1 + 2 * TRAITS_FONDU)
    expect(c.appels).not.toContain('setLineDash')
    // le brouillard prend l’opacité du masque, les textures celle du brouillard
    expect(c.appels).toContain('gco:source-in')
    expect(c.appels).toContain('gco:source-atop')
    // l’ordre : le masque avant le brouillard, le brouillard avant les textures
    expect(c.appels.indexOf('gco:destination-out')).toBeLessThan(c.appels.indexOf('gco:source-in'))
    expect(c.appels.indexOf('gco:source-in')).toBeLessThan(c.appels.indexOf('gco:source-atop'))
  })

  it('en cours de levée : le front se creuse en dégradé depuis le point d’entrée', () => {
    const { g, c, vue } = scene()
    expect(dessineVoile(g.g, CACHE, leve(VOILE_DUREE * 0.4), 10, vue, 0)).toBe(true)
    // les quatre nappes, plus le dégradé du front
    expect(compte(c.appels, 'createRadialGradient')).toBe(5)
    expect(compte(c.appels, 'gco:destination-out')).toBe(2)
    expect(compte(g.appels, 'drawImage')).toBe(1)
  })

  it('levé : plus rien ne se dessine, ni sur le calque ni sur le canevas', () => {
    const { g, c, vue } = scene()
    expect(dessineVoile(g.g, CACHE, leve(VOILE_DUREE + 0.01), 10, vue, 0)).toBe(false)
    expect(g.appels).toEqual([])
    expect(c.appels).toEqual([])
  })

  it('hors champ : rien, pas même un chemin', () => {
    const { g, c, vue } = scene()
    const loin = { minX: 9000, minY: 9000, maxX: 9400, maxY: 9400 }
    expect(dessineVoile(g.g, loin, voile, 5, vue, 0)).toBe(false)
    expect(g.appels).toEqual([])
    expect(c.appels).toEqual([])
  })

  it('un pan trop petit à l’écran garde le brouillard mais tait l’estampille', () => {
    const { g, c, vue } = scene(0.2)
    expect(dessineVoile(g.g, CACHE, voile, 5, vue, 0)).toBe(true)
    expect(c.appels).toContain('fillRect')
    expect(c.textes).toEqual([])
  })

  it('une estampille plus large que son pan ne se pose pas', () => {
    // le pan fait 200 px à l’écran ; le texte en ferait 190 : il déborderait
    const { g, c, vue } = scene(0.5, 190)
    expect(dessineVoile(g.g, CACHE, voile, 5, vue, 0)).toBe(true)
    expect(c.appels).toContain('measureText')
    expect(c.textes).toEqual([])
  })

  it('un arc a son centre dehors : pas d’estampille dans le vide', () => {
    const { g, c, vue } = scene()
    const arc = { ...CACHE, forme: FORME_ARC, p0: 0.3, p1: 120 }
    expect(dessineVoile(g.g, arc, voile, 5, vue, 0)).toBe(true)
    expect(c.textes).toEqual([])
  })

  it('la paroi factice ne dessine que sa dissolution, jamais tant qu’elle est voilée', () => {
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
    expect(compte(ouverte.g.appels, 'drawImage')).toBe(1)
    const finie = scene()
    expect(
      dessineDissolutionParoi(finie.g.g, CACHE, leve(VOILE_DUREE + 1), 10, finie.vue),
    ).toBe(false)
  })
})
