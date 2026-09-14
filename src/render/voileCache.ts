// LE VOILE DES CACHETTES — le brouillard « non cartographié » qui couvre un
// pan du tableau tant que le corps n'y est pas entré, et sa levée.
//
// Le premier voile (a7c88ad) était un rectangle plein, quatre nappes à
// peine visibles et un liseré d'un pixel. Dans la salle démineur — quatre
// chambres, une cachette carrée au milieu de chacune — cela se lisait comme
// quatre trous noirs découpés au cutter : une carte pas finie. Le voile est
// maintenant une ZONE NON RELEVÉE de plan : la hachure oblique des relevés,
// une LISIÈRE qui s'effiloche au-delà du contour (le brouillard déborde, il
// ne coupe pas), des nappes qui dérivent, un liseré pointillé et une
// estampille quand la place le permet. Et la levée ne fond plus d'un bloc :
// le brouillard se DISSIPE depuis le point où le corps est entré, en un
// front circulaire à bord doux — on voit d'où l'on vient.
//
// Ce module est PUR : il reçoit un contexte 2D, la forme, l'état du voile
// et la vue, et dessine. Rien n'y lit le DOM — il se teste avec un contexte
// factice qui note les appels.

import { dansForme, formeOutline, type FormeBox } from '../game/formes'

/** La durée de la levée (s). 0,9 avant : un peu court pour un front qui
 *  traverse le pan — à 1,1 le regard suit la dissipation jusqu'au bord. */
export const VOILE_DUREE = 1.1
export const ESTAMPILLE = 'NON CARTOGRAPHIÉ'

// la palette de la charte : l'acier des coques pour le brouillard, le cyan
// d'accent pour la hachure et le liseré, le gris des pièces pour l'estampille
const BROUILLARD = '#0c1420'
const BROUILLARD_RGB = '12,20,32'
const NAPPE_RGB = '70,92,120'
const CYAN_RGB = '99,183,230'
const GRIS_RGB = '154,163,171'
const PAROI = '#3a4450'
const PAROI_RGB = '58,68,80'
const PAROI_HAUT = '#232b36'

export interface EtatVoile {
  levee: number // l'instant (s) où le voile s'est levé — Infinity : voilé
  entreeX: number // le point du MONDE d'où le brouillard se dissipe
  entreeY: number
}

export interface VueVoile {
  vw: number
  vh: number
  zoom: number // pixels par unité du monde
  versEcran: (x: number, y: number) => { sx: number; sy: number }
}

/** L'opacité globale de ce qui reste du voile : 1 tant qu'il est fermé,
 *  0 une fois la levée finie. */
export function alphaVoile(levee: number, elapsed: number): number {
  if (levee === Infinity) return 1
  return Math.max(0, Math.min(1, 1 - (elapsed - levee) / VOILE_DUREE))
}

/** L'avancée du front de dissipation, 0..1 : il sort vite du corps et
 *  ralentit en s'éloignant — une bouffée, pas un rideau. */
export function avanceFront(levee: number, elapsed: number): number {
  if (levee === Infinity) return 0
  const t = Math.max(0, Math.min(1, (elapsed - levee) / VOILE_DUREE))
  return 1 - (1 - t) * (1 - t)
}

/** Ce qui vit HORS du front (la lisière, le liseré, l'estampille) s'efface
 *  dans le dernier tiers de la levée. Sans cela, la couronne de brouillard
 *  restait posée autour du pan jusqu'à la dernière image et disparaissait
 *  d'un coup. */
export function alphaReste(levee: number, elapsed: number): number {
  if (levee === Infinity) return 1
  const t = (elapsed - levee) / VOILE_DUREE
  return Math.max(0, Math.min(1, (1 - t) / 0.35))
}

/** Les nappes de brume, en coordonnées relatives au pan (0..1) — quatre
 *  par pan, chacune sur sa propre dérive lente. Déterministe : la même
 *  cachette au même instant donne les mêmes nappes. */
export function nappes(
  indice: number,
  elapsed: number,
): { u: number; v: number; r: number }[] {
  const out: { u: number; v: number; r: number }[] = []
  for (let k = 0; k < 4; k++) {
    const ph = indice * 7.3 + k * 2.1
    out.push({
      u: 0.5 + 0.38 * Math.sin(elapsed * 0.07 + ph * 1.7),
      v: 0.5 + 0.38 * Math.cos(elapsed * 0.055 + ph),
      r: 0.36 + 0.12 * Math.sin(ph * 3.7),
    })
  }
  return out
}

/** L'estampille ne se pose que si le pan est assez large à l'écran pour
 *  qu'elle tienne dedans sans le déborder ni devenir illisible. */
export function estampilleVisible(w: number, h: number): boolean {
  return w >= 120 && h >= 36
}

/** « N O N  C A R T O G R A P H I É » — l'interlettrage des pochoirs, sans
 *  dépendre de letterSpacing (absent de certains navigateurs). */
export function pochoir(texte: string): string {
  return texte.split('').join(' ')
}

/** Le pas de la hachure et la largeur de la lisière, en pixels : ils
 *  suivent le zoom mais restent dans une fourchette lisible. */
export function mesures(zoom: number): { hachure: number; lisiere: number } {
  return {
    hachure: Math.max(7, Math.min(16, 30 * zoom)),
    lisiere: Math.max(8, Math.min(44, 56 * zoom)),
  }
}

interface Trace {
  pts: { sx: number; sy: number }[]
  minX: number
  minY: number
  maxX: number
  maxY: number
  chemin: () => void
}

/** Le contour à l'écran et sa boîte — null si le pan est hors champ. Les
 *  formes tournées débordent de leur boîte de définition : la boîte se
 *  prend sur les points du contour, pas sur minX/maxX. */
function tracer(
  g: CanvasRenderingContext2D,
  cache: FormeBox,
  vue: VueVoile,
  marge: number,
): Trace | null {
  const pts = formeOutline(cache, 56).map((p) => vue.versEcran(p.x, p.y))
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    if (p.sx < minX) minX = p.sx
    if (p.sy < minY) minY = p.sy
    if (p.sx > maxX) maxX = p.sx
    if (p.sy > maxY) maxY = p.sy
  }
  if (
    maxX + marge < 0 ||
    minX - marge > vue.vw ||
    maxY + marge < 0 ||
    minY - marge > vue.vh
  )
    return null
  const chemin = (): void => {
    g.beginPath()
    for (let k = 0; k < pts.length; k++) {
      if (k === 0) g.moveTo(pts[k].sx, pts[k].sy)
      else g.lineTo(pts[k].sx, pts[k].sy)
    }
    g.closePath()
  }
  return { pts, minX, minY, maxX, maxY, chemin }
}

/** Le front de dissipation à l'écran : son centre, son rayon et la largeur
 *  de sa bande douce. Rayon 0 : le voile est fermé. */
function front(
  t: Trace,
  etat: EtatVoile,
  elapsed: number,
  vue: VueVoile,
): { ex: number; ey: number; rayon: number; bande: number } {
  const e = vue.versEcran(etat.entreeX, etat.entreeY)
  let portee = 0
  for (const p of t.pts)
    portee = Math.max(portee, Math.hypot(p.sx - e.sx, p.sy - e.sy))
  const bande = Math.max(24, Math.min(160, 0.35 * portee))
  return {
    ex: e.sx,
    ey: e.sy,
    rayon: avanceFront(etat.levee, elapsed) * (portee + bande),
    bande,
  }
}

/** Restreint le dessin à la forme MOINS le disque du front (la partie
 *  encore voilée). Deux clips emboîtés : la forme, puis « forme ou disque »
 *  en pair-impair — l'intersection des deux est la forme privée du disque,
 *  et rien de ce que le disque déborde hors du pan n'entre. */
function clipPan(
  g: CanvasRenderingContext2D,
  t: Trace,
  f: { ex: number; ey: number; rayon: number },
): void {
  t.chemin()
  g.clip()
  if (f.rayon <= 0) return
  t.chemin()
  g.moveTo(f.ex + f.rayon, f.ey)
  g.arc(f.ex, f.ey, f.rayon, 0, Math.PI * 2)
  g.clip('evenodd')
}

/** La bande douce du front, DANS le disque : transparente au cœur, pleine
 *  au bord — dessinée par-dessus ce qui se révèle, jamais en effaçant (un
 *  destination-out aurait emporté les portes et pastilles déjà dessinées
 *  sous le voile sur le même calque). */
function bandeFront(
  g: CanvasRenderingContext2D,
  t: Trace,
  f: { ex: number; ey: number; rayon: number; bande: number },
  rgb: string,
  alpha: number,
): void {
  if (f.rayon <= 0) return
  g.save()
  t.chemin()
  g.clip()
  g.beginPath()
  g.moveTo(f.ex + f.rayon, f.ey)
  g.arc(f.ex, f.ey, f.rayon, 0, Math.PI * 2)
  g.clip()
  const grad = g.createRadialGradient(
    f.ex,
    f.ey,
    Math.max(0, f.rayon - f.bande),
    f.ex,
    f.ey,
    f.rayon,
  )
  grad.addColorStop(0, `rgba(${rgb},0)`)
  grad.addColorStop(1, `rgba(${rgb},${alpha.toFixed(3)})`)
  g.fillStyle = grad
  g.fillRect(t.minX, t.minY, t.maxX - t.minX, t.maxY - t.minY)
  g.restore()
}

/** Dessine le brouillard d'une cachette (style par défaut). Rend false si
 *  rien n'a été dessiné : voile entièrement levé, ou pan hors champ. */
export function dessineVoile(
  g: CanvasRenderingContext2D,
  cache: FormeBox,
  etat: EtatVoile,
  elapsed: number,
  vue: VueVoile,
  indice: number,
): boolean {
  if (alphaVoile(etat.levee, elapsed) <= 0) return false
  const { hachure, lisiere } = mesures(vue.zoom)
  const t = tracer(g, cache, vue, lisiere)
  if (!t) return false
  const w = t.maxX - t.minX
  const h = t.maxY - t.minY
  const f = front(t, etat, elapsed, vue)
  const reste = alphaReste(etat.levee, elapsed)

  g.save()
  // 1. LA LISIÈRE : le brouillard déborde du contour et s'effiloche —
  // cinq traits emboîtés, de plus en plus larges et aussi ténus ; ils se
  // cumulent près du bord et s'éparpillent au loin. Restreinte au DEHORS
  // du pan (la boîte moins la forme, en pair-impair) : dedans, le pan est
  // plein de toute façon, et pendant la levée rien ne doit y traîner.
  g.globalAlpha = reste
  g.beginPath()
  g.rect(t.minX - lisiere * 2, t.minY - lisiere * 2, w + lisiere * 4, h + lisiere * 4)
  for (let k = 0; k < t.pts.length; k++) {
    if (k === 0) g.moveTo(t.pts[k].sx, t.pts[k].sy)
    else g.lineTo(t.pts[k].sx, t.pts[k].sy)
  }
  g.closePath()
  g.save()
  g.clip('evenodd')
  g.lineJoin = 'round'
  for (let k = 5; k >= 1; k--) {
    g.lineWidth = (lisiere * 2 * k) / 5
    g.strokeStyle = `rgba(${BROUILLARD_RGB},0.24)`
    t.chemin()
    g.stroke()
  }
  g.restore()

  // 2. LE PAN : plein, hachuré, brumeux — hors du disque du front
  g.save()
  g.globalAlpha = 1
  clipPan(g, t, f)
  g.fillStyle = BROUILLARD
  g.fillRect(t.minX, t.minY, w, h)
  // la hachure oblique des zones non relevées, à 45°
  g.strokeStyle = `rgba(${CYAN_RGB},0.09)`
  g.lineWidth = 1
  g.beginPath()
  for (let d = -h; d < w; d += hachure) {
    g.moveTo(t.minX + d, t.minY)
    g.lineTo(t.minX + d + h, t.minY + h)
  }
  g.stroke()
  // les nappes qui dérivent : le voile se lit comme du brouillard, pas
  // comme un rectangle mort
  for (const n of nappes(indice, elapsed)) {
    const nx = t.minX + w * n.u
    const ny = t.minY + h * n.v
    const r = Math.max(8, Math.max(w, h) * n.r)
    const grad = g.createRadialGradient(nx, ny, 0, nx, ny, r)
    grad.addColorStop(0, `rgba(${NAPPE_RGB},0.30)`)
    grad.addColorStop(1, `rgba(${NAPPE_RGB},0)`)
    g.fillStyle = grad
    g.fillRect(t.minX, t.minY, w, h)
  }
  g.restore()

  // 3. LE FRONT : la bande douce de la dissipation
  bandeFront(g, t, f, BROUILLARD_RGB, 1)

  // 4. LE LISERÉ pointillé du relevé : le pan se devine sans se trahir
  g.globalAlpha = reste * 0.55
  g.strokeStyle = `rgba(${CYAN_RGB},0.5)`
  g.lineWidth = 1
  g.setLineDash([hachure * 0.6, hachure * 0.5])
  t.chemin()
  g.stroke()
  g.setLineDash([])

  // 5. L'ESTAMPILLE, au centre — seulement si elle tient, et seulement si
  // le centre est bien DANS la forme (un arc ou un coin ont leur centre
  // dehors : l'estampille flotterait dans le vide). Mesurée avant d'être
  // posée : à l'échelle d'une salle entière, un pan de 200 px ne la
  // contient pas, et une estampille qui déborde de son pan trahit plus
  // qu'elle n'explique. Elle s'efface avec le front : dès que le
  // brouillard se dissipe, elle n'a plus rien à nommer.
  const cxM = (cache.minX + cache.maxX) / 2
  const cyM = (cache.minY + cache.maxY) / 2
  if (estampilleVisible(w, h) && dansForme(cache, cxM, cyM)) {
    const c = vue.versEcran(cxM, cyM)
    const taille = Math.max(9, Math.min(13, w / 22))
    g.font = `600 ${taille}px ui-monospace, monospace`
    const texte = pochoir(ESTAMPILLE)
    if (g.measureText(texte).width <= w * 0.85) {
      g.globalAlpha = reste * (1 - avanceFront(etat.levee, elapsed)) * 0.7
      g.fillStyle = `rgba(${GRIS_RGB},0.5)`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(texte, c.sx, c.sy)
    }
  }
  g.restore()
  return true
}

/** La PAROI FACTICE : voilée, c'est le moteur qui la rend (vraie paroi,
 *  vraies ombres) — ici on ne dessine que sa DISSOLUTION une fois révélée :
 *  la teinte de paroi s'évapore du contour exact, par le même front que le
 *  brouillard. Rend false si rien n'a été dessiné. */
export function dessineDissolutionParoi(
  g: CanvasRenderingContext2D,
  cache: FormeBox,
  etat: EtatVoile,
  elapsed: number,
  vue: VueVoile,
): boolean {
  if (etat.levee === Infinity) return false
  const alpha = alphaVoile(etat.levee, elapsed)
  if (alpha <= 0) return false
  const t = tracer(g, cache, vue, 0)
  if (!t) return false
  const w = t.maxX - t.minX
  const h = t.maxY - t.minY
  const f = front(t, etat, elapsed, vue)
  g.save()
  clipPan(g, t, f)
  g.globalAlpha = 0.92
  g.fillStyle = PAROI
  g.fillRect(t.minX, t.minY, w, h)
  g.globalAlpha = 0.5
  g.fillStyle = PAROI_HAUT
  g.fillRect(t.minX, t.minY, w, h * 0.5)
  g.restore()
  bandeFront(g, t, f, PAROI_RGB, 0.92)
  return true
}
