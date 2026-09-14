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
  VOILE_DUREE,
  type EtatVoile,
  type VueVoile,
} from './voileCache'
import { FORME_ARC } from '../game/formes'

/** Un contexte 2D factice : il note chaque appel (et les textes écrits),
 *  accepte toute affectation, et rend un dégradé muet quand on en crée. */
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
    set: () => true,
  })
  return { g: g as unknown as CanvasRenderingContext2D, appels, textes }
}

const vue = (zoom = 0.5, vw = 1600, vh = 900): VueVoile => ({
  vw,
  vh,
  zoom,
  versEcran: (x, y) => ({ sx: vw / 2 + x * zoom, sy: vh / 2 - y * zoom }),
})

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
    expect(mesures(0.01)).toEqual({ hachure: 7, lisiere: 8 })
    expect(mesures(0.5)).toEqual({ hachure: 15, lisiere: 28 })
    expect(mesures(10)).toEqual({ hachure: 16, lisiere: 44 })
  })
})

describe('le dessin du brouillard', () => {
  it('voilé : le pan se remplit dans sa forme, hachuré, estampillé — sans front', () => {
    const { g, appels, textes } = contexteFactice()
    expect(dessineVoile(g, CACHE, voile, 5, vue(), 0)).toBe(true)
    // la lisière (dehors, pair-impair) puis le pan (dans la forme)
    expect(compte(appels, 'clip:evenodd')).toBe(1)
    expect(compte(appels, 'clip')).toBe(1)
    expect(appels).toContain('fillRect')
    expect(appels).toContain('setLineDash')
    expect(appels).not.toContain('arc')
    expect(textes).toEqual([pochoir(ESTAMPILLE)])
  })

  it('en cours de levée : le front est un disque, le pan se dessine hors de lui', () => {
    const { g, appels } = contexteFactice()
    expect(dessineVoile(g, CACHE, leve(VOILE_DUREE * 0.4), 10, vue(), 0)).toBe(true)
    // la lisière, puis « forme ou disque » pour le pan
    expect(compte(appels, 'clip:evenodd')).toBe(2)
    // la bande douce : au moins deux disques tracés (le clip du pan, le clip de la bande)
    expect(compte(appels, 'arc')).toBeGreaterThanOrEqual(2)
    expect(appels).toContain('createRadialGradient')
  })

  it('levé : plus rien ne se dessine', () => {
    const { g, appels } = contexteFactice()
    expect(dessineVoile(g, CACHE, leve(VOILE_DUREE + 0.01), 10, vue(), 0)).toBe(false)
    expect(appels).toEqual([])
  })

  it('hors champ : rien, pas même un chemin', () => {
    const { g, appels } = contexteFactice()
    const loin = { minX: 9000, minY: 9000, maxX: 9400, maxY: 9400 }
    expect(dessineVoile(g, loin, voile, 5, vue(), 0)).toBe(false)
    expect(appels).toEqual([])
  })

  it('un pan trop petit à l’écran garde le brouillard mais tait l’estampille', () => {
    const { g, appels, textes } = contexteFactice()
    expect(dessineVoile(g, CACHE, voile, 5, vue(0.2), 0)).toBe(true)
    expect(appels).toContain('fillRect')
    expect(textes).toEqual([])
  })

  it('une estampille plus large que son pan ne se pose pas', () => {
    // le pan fait 200 px à l’écran ; le texte en ferait 190 : il déborderait
    const { g, appels, textes } = contexteFactice(190)
    expect(dessineVoile(g, CACHE, voile, 5, vue(), 0)).toBe(true)
    expect(appels).toContain('measureText')
    expect(textes).toEqual([])
  })

  it('un arc a son centre dehors : pas d’estampille dans le vide', () => {
    const { g, textes } = contexteFactice()
    const arc = { ...CACHE, forme: FORME_ARC, p0: 0.3, p1: 120 }
    expect(dessineVoile(g, arc, voile, 5, vue(), 0)).toBe(true)
    expect(textes).toEqual([])
  })

  it('la paroi factice ne dessine que sa dissolution, jamais tant qu’elle est voilée', () => {
    const fermee = contexteFactice()
    expect(dessineDissolutionParoi(fermee.g, CACHE, voile, 5, vue())).toBe(false)
    expect(fermee.appels).toEqual([])
    const ouverte = contexteFactice()
    expect(
      dessineDissolutionParoi(ouverte.g, CACHE, leve(VOILE_DUREE * 0.3), 10, vue()),
    ).toBe(true)
    expect(ouverte.appels).toContain('arc')
    expect(ouverte.appels).toContain('fillRect')
    const finie = contexteFactice()
    expect(
      dessineDissolutionParoi(finie.g, CACHE, leve(VOILE_DUREE + 1), 10, vue()),
    ).toBe(false)
  })
})
