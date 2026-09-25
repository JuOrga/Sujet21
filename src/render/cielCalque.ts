// LE CIEL EN CALQUE — la Voie lactée et les étoiles, hors de la toile WebGL.
//
// Le ciel était peint par le shader de composition, donc à la définition de
// la TOILE — et la toile est rétrécie par le réglage de résolution (moyenne
// ×0,75, faible ×0,5, l'adaptatif des tablettes, où il est le défaut) puis
// agrandie par le navigateur. La plus belle image y devenait floue : « pas
// net du tout ». Le ciel vit donc DERRIÈRE la toile, en HTML : le navigateur
// le compose toujours à la définition native de l'écran, quel que soit le
// réglage, et le déplacer ne coûte qu'une transformation — le compositeur
// s'en charge, le shader n'a plus rien à calculer dans le vide (il y rend la
// toile transparente, voir uCielCalque).
//
//   - la GALAXIE : une image, cadrée par cadrePlaque (render/parallaxe.ts) —
//     jamais agrandie au-delà de ce qu'elle peut rendre net ;
//   - les ÉTOILES : trois tuiles d'image (tools/ciel/genere-etoiles.py)
//     affichées à UN texel par pixel physique, sur trois profondeurs de
//     parallaxe. Des étoiles lointaines ne changent pas de taille avec le
//     zoom : les tuiles non plus.

import { cadrePlaque, type CadrePlaque, type ReglagesPlaque } from './parallaxe'

/** Une couche d'étoiles : sa tuile (en pixels d'image) et la part du
 *  mouvement du monde qu'elle suit à l'écran — petite : elle est loin. */
export interface CoucheEtoiles {
  url: string
  tuile: number
  vitesse: number
}

export const COUCHES_ETOILES: readonly CoucheEtoiles[] = [
  { url: '/assets/etoiles-fond.webp', tuile: 887, vitesse: 0.03 },
  { url: '/assets/etoiles-milieu.webp', tuile: 1024, vitesse: 0.06 },
  { url: '/assets/etoiles-proche.webp', tuile: 1181, vitesse: 0.11 },
]

/** Le décalage d'une couche d'étoiles, en px CSS, ramené dans une période
 *  de tuile : ]−tuile, 0]. La couche mesure l'écran PLUS une tuile, donc ce
 *  décalage suffit à la faire défiler sans fin — et le nombre reste petit,
 *  là où la position de la caméra, elle, peut croître sans borne. */
export function decalageTuile(monde: number, zoom: number, vitesse: number, tuileCss: number): number {
  const t = Math.max(tuileCss, 1e-6)
  const d = (((monde * zoom * vitesse) % t) + t) % t
  return d === 0 ? 0 : -d
}

/** Un décalage ramené au PIXEL PHYSIQUE le plus proche. Une tuile d'un
 *  texel par pixel, décalée d'une fraction de pixel, est rééchantillonnée
 *  par le compositeur : chaque étoile s'étale sur quatre pixels et
 *  scintille en défilant — exactement ce que les tuiles devaient éviter. */
export function auPixel(v: number, dpr: number): number {
  const d = Math.max(dpr, 1e-4)
  return Math.round(v * d) / d
}

/** LE FROID DU VAISSEAU sur le ciel. Dans la toile, le shader teinte et
 *  assombrit tout ce qu'il peint (uChill) ; le ciel n'y est plus, il reçoit
 *  donc la même chose en filtre CSS — la part d'assombrissement (12 %) et
 *  un glissement vers le bleu. Vide sous un froid négligeable : pas de
 *  filtre, pas de coût. */
export function filtreFroid(froid: number): string {
  const f = Math.min(1, Math.max(0, froid))
  if (f < 0.01) return 'none'
  return `brightness(${(1 - 0.12 * f).toFixed(3)}) hue-rotate(${(8 * f).toFixed(1)}deg) saturate(${(1 - 0.25 * f).toFixed(3)})`
}

/** Où poser l'image de la galaxie à l'écran (px CSS, coin haut-gauche et
 *  largeur), d'après le cadre : le point (cx, cy) de l'image — y vers le
 *  HAUT, comme dans le shader — tombe au centre de l'écran. */
export function rectGalaxie(
  cadre: CadrePlaque,
  largeurCss: number,
  hauteurCss: number,
): { x: number; y: number; largeur: number } {
  const largeur = 1 / cadre.parPx
  return {
    x: largeurCss / 2 - cadre.cx * largeur,
    y: hauteurCss / 2 - (1 - cadre.cy) * largeur,
    largeur,
  }
}

export interface EtatCiel {
  actif: boolean
  camX: number
  camY: number
  zoom: number
  largeurCss: number
  hauteurCss: number
  /** la densité NATIVE de l'écran — pas l'échelle de rendu de la toile */
  dpr: number
  force: number
  /** le refroidissement du vaisseau, 0..1 (le uChill du shader) */
  froid: number
  reglages: ReglagesPlaque
}

export class CielCalque {
  private readonly racine: HTMLDivElement
  private readonly galaxie: HTMLImageElement
  private readonly couches: HTMLDivElement[] = []
  private galaxiePrete = false
  // les tuiles en objets Image, pour se repeindre dans une toile 2D (la
  // capture vidéo du codex) — le navigateur les a déjà en cache
  private readonly tuiles: HTMLImageElement[] = []
  private dernier: EtatCiel | null = null
  // RIEN ne se télécharge avant le premier affichage : qui garde un autre
  // fond ne paie jamais la photographie (1,3 Mo) ni les tuiles
  private readonly urlGalaxie: string
  private charge = false
  // le dernier style écrit, par élément ET par propriété : on n'écrit que
  // ce qui change. (Premier jet : une seule entrée par élément — la galaxie,
  // qui écrit trois propriétés, s'écrasait elle-même et réécrivait tout à
  // chaque image.)
  private readonly ecrit = new Map<HTMLElement, Map<string, string>>()
  // les motifs des tuiles, par toile de capture : créés une fois, seule
  // leur matrice change d'une image à l'autre
  private readonly motifs = new Map<CanvasRenderingContext2D, (CanvasPattern | null)[]>()
  private readonly matrice = typeof DOMMatrix === 'undefined' ? null : new DOMMatrix()
  private dprTuiles = 0

  constructor(parent: HTMLElement, devant: HTMLElement, urlGalaxie: string) {
    const r = document.createElement('div')
    r.id = 'ciel-calque'
    r.setAttribute('aria-hidden', 'true')
    // isolation : les modes de fusion des étoiles restent DANS le calque
    r.style.cssText =
      'position:absolute;inset:0;overflow:hidden;background:#000;isolation:isolate;pointer-events:none;display:none'
    const g = document.createElement('img')
    g.alt = ''
    g.decoding = 'async'
    g.style.cssText =
      'position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform;max-width:none'
    g.addEventListener('load', () => {
      this.galaxiePrete = true
    })
    this.urlGalaxie = urlGalaxie
    r.appendChild(g)
    this.galaxie = g
    for (let i = 0; i < COUCHES_ETOILES.length; i++) {
      this.tuiles.push(new Image())
      const d = document.createElement('div')
      // SCREEN : une étoile éclaire ce qu'elle recouvre, sans l'éteindre —
      // les lanes sombres de la galaxie en sont piquées, comme dans le vrai
      d.style.cssText = 'position:absolute;left:0;top:0;background-repeat:repeat;mix-blend-mode:screen;will-change:transform'
      r.appendChild(d)
      this.couches.push(d)
    }
    parent.insertBefore(r, devant)
    this.racine = r
  }

  private pose(el: HTMLElement, cle: string, valeur: string): void {
    let m = this.ecrit.get(el)
    if (!m) {
      m = new Map()
      this.ecrit.set(el, m)
    }
    if (m.get(cle) === valeur) return
    m.set(cle, valeur)
    ;(el.style as unknown as Record<string, string>)[cle] = valeur
  }

  maj(e: EtatCiel): void {
    this.dernier = e
    this.racine.style.display = e.actif ? 'block' : 'none'
    if (!e.actif) return
    if (!this.charge) {
      this.charge = true
      this.galaxie.src = this.urlGalaxie
      COUCHES_ETOILES.forEach((c, i) => {
        this.tuiles[i].src = c.url
        this.couches[i].style.backgroundImage = `url(${c.url})`
      })
    }
    const dpr = Math.max(e.dpr, 1e-4)
    // LES TUILES, à un texel par pixel physique : leur taille CSS ne dépend
    // que de la densité de l'écran — on ne la réécrit que si elle change
    if (dpr !== this.dprTuiles) {
      this.dprTuiles = dpr
      COUCHES_ETOILES.forEach((c, i) => {
        const t = c.tuile / dpr
        const d = this.couches[i]
        d.style.backgroundSize = `${t}px ${t}px`
        d.style.width = `calc(100% + ${Math.ceil(t) + 2}px)`
        d.style.height = `calc(100% + ${Math.ceil(t) + 2}px)`
      })
    }
    COUCHES_ETOILES.forEach((c, i) => {
      const t = c.tuile / dpr
      // l'écran descend quand le monde monte : le y change de signe
      const ox = auPixel(decalageTuile(e.camX, e.zoom, c.vitesse, t), dpr)
      const oy = auPixel(decalageTuile(-e.camY, e.zoom, c.vitesse, t), dpr)
      this.pose(this.couches[i], 'transform', `translate3d(${ox}px,${oy}px,0)`)
    })
    this.pose(this.racine, 'filter', filtreFroid(e.froid))
    if (!this.galaxiePrete) return
    const n = this.galaxie.naturalWidth || 1
    const cadre = cadrePlaque(e.camX, e.camY, e.zoom, e.largeurCss, e.hauteurCss, dpr, n, e.reglages)
    const r = rectGalaxie(cadre, e.largeurCss, e.hauteurCss)
    this.pose(this.galaxie, 'width', `${n}px`)
    this.pose(
      this.galaxie,
      'transform',
      `translate3d(${r.x.toFixed(2)}px,${r.y.toFixed(2)}px,0) scale(${(r.largeur / n).toFixed(5)})`,
    )
    // la FORCE : sur fond noir, l'opacité est un simple dosage
    this.pose(this.galaxie, 'opacity', String(Math.min(1, Math.max(0, e.force))))
  }

  /** Se REPEINT dans une toile 2D, comme à l'écran : pour la capture vidéo,
   *  qui ne voit que des toiles. La découpe (x, y, l, h) est en fractions de
   *  l'écran ; la cible fait largeur × hauteur pixels. Hors du mode calque,
   *  un fond noir. */
  dessineDans(
    g: CanvasRenderingContext2D,
    x: number, y: number, l: number, h: number,
    largeur: number, hauteur: number,
  ): void {
    g.save()
    g.fillStyle = '#000'
    g.fillRect(0, 0, largeur, hauteur)
    const e = this.dernier
    if (e && e.actif) {
      g.filter = filtreFroid(e.froid)
      const k = largeur / Math.max(l * e.largeurCss, 1e-6)
      g.setTransform(k, 0, 0, hauteur / Math.max(h * e.hauteurCss, 1e-6), -x * e.largeurCss * k, -y * e.hauteurCss * (hauteur / Math.max(h * e.hauteurCss, 1e-6)))
      if (this.galaxiePrete) {
        const n = this.galaxie.naturalWidth || 1
        const c = cadrePlaque(e.camX, e.camY, e.zoom, e.largeurCss, e.hauteurCss, e.dpr, n, e.reglages)
        const r = rectGalaxie(c, e.largeurCss, e.hauteurCss)
        g.globalAlpha = Math.min(1, Math.max(0, e.force))
        g.drawImage(this.galaxie, r.x, r.y, r.largeur, r.largeur)
        g.globalAlpha = 1
      }
      g.globalCompositeOperation = 'screen'
      let motifs = this.motifs.get(g)
      if (!motifs) {
        motifs = COUCHES_ETOILES.map(() => null)
        this.motifs.set(g, motifs)
      }
      COUCHES_ETOILES.forEach((c, i) => {
        const im = this.tuiles[i]
        if (!im.complete || !im.naturalWidth || !this.matrice) return
        const motif = motifs[i] ?? (motifs[i] = g.createPattern(im, 'repeat'))
        if (!motif) return
        const dpr = Math.max(e.dpr, 1e-4)
        const t = c.tuile / dpr
        const m = this.matrice
        m.a = 1 / dpr
        m.b = 0
        m.c = 0
        m.d = 1 / dpr
        m.e = auPixel(decalageTuile(e.camX, e.zoom, c.vitesse, t), dpr)
        m.f = auPixel(decalageTuile(-e.camY, e.zoom, c.vitesse, t), dpr)
        motif.setTransform(m)
        g.fillStyle = motif
        g.fillRect(0, 0, e.largeurCss, e.hauteurCss)
      })
    }
    g.restore()
  }
}
