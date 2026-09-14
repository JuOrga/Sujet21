// LE VOILE DES CACHETTES — le brouillard « non cartographié » qui couvre un
// pan du tableau tant que le corps n'y est pas entré, et sa levée.
//
// Le premier voile (a7c88ad) était un rectangle plein, quatre nappes à
// peine visibles et un liseré d'un pixel. Dans la salle démineur — quatre
// chambres, une cachette carrée au milieu de chacune — cela se lisait comme
// quatre trous noirs découpés au cutter : une carte pas finie. Le voile est
// maintenant une ZONE NON RELEVÉE de plan : la hachure oblique des relevés,
// des nappes qui dérivent, une estampille quand la place le permet — et
// AUCUN BORD : le brouillard est plein au cœur du pan et se fond des deux
// côtés du contour, dedans comme dehors, sans liseré ni coupe (la première
// version en gardait un liseré pointillé et une coupe nette au contour :
// « la délimitation est beaucoup trop marquée »). Et la levée ne fond plus
// d'un bloc : le brouillard se DISSIPE depuis le point où le corps est
// entré, en un front circulaire à bord doux — on voit d'où l'on vient.
//
// Chaque voile se compose sur un CALQUE à part (fourni par la vue) puis se
// pose d'un coup sur le canevas des effets : le masque au bord fondu et le
// front creusé demandent d'EFFACER (destination-out) et de dessiner DANS
// une opacité existante (source-in, source-atop) — sur le calque commun,
// cela aurait emporté les portes et pastilles déjà dessinées sous le voile.
//
// Ce module ne lit pas le DOM : il reçoit un contexte 2D, la forme, l'état
// du voile et la vue (dont le calque), et dessine. Il se teste avec des
// contextes factices qui notent les appels.

import { dansForme, formeOutline, type FormeBox } from '../game/formes'

/** La durée de la levée (s). 0,9 avant : un peu court pour un front qui
 *  traverse le pan — à 1,1 le regard suit la dissipation jusqu'au bord. */
export const VOILE_DUREE = 1.1
export const ESTAMPILLE = 'NON CARTOGRAPHIÉ'

// la palette de la charte : l'acier des coques pour le brouillard, le cyan
// d'accent pour la hachure et le liseré, le gris des pièces pour l'estampille
const BROUILLARD = '#0c1420'
const NAPPE_RGB = '70,92,120'
const CYAN_RGB = '99,183,230'
const GRIS_RGB = '154,163,171'
const PAROI = '#3a4450'
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
  dpr: number // pixels physiques par pixel CSS du canevas des effets
  versEcran: (x: number, y: number) => { sx: number; sy: number }
  /** Le calque de composition : un contexte 2D vierge d'au moins w × h
   *  pixels PHYSIQUES, transformation identité. Réutilisé d'un voile à
   *  l'autre — l'appelant le garde et le vide. */
  calque: (w: number, h: number) => CanvasRenderingContext2D
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

/** Ce que le front ne creuse pas lui-même (la lisière qui déborde du pan,
 *  l'estampille) s'efface dans le dernier tiers de la levée. Sans cela, la
 *  couronne de brouillard restait posée autour du pan jusqu'à la dernière
 *  image et disparaissait d'un coup. */
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

/** Le pas de la hachure et la largeur de la LISIÈRE, en pixels : ils
 *  suivent le zoom mais restent dans une fourchette lisible. La lisière
 *  est la bande de fondu de chaque côté du contour — le brouillard va de
 *  plein (à une lisière en dedans) à rien (à une lisière en dehors). */
export function mesures(zoom: number): { hachure: number; lisiere: number } {
  return {
    hachure: Math.max(7, Math.min(16, 30 * zoom)),
    lisiere: Math.max(12, Math.min(72, 90 * zoom)),
  }
}

/** Le nombre de traits emboîtés qui font le fondu d'un côté du contour. */
export const TRAITS_FONDU = 6

interface Trace {
  pts: { sx: number; sy: number }[]
  // la boîte du contour à l'écran, élargie de la lisière et rognée au
  // champ : c'est l'emprise du calque
  minX: number
  minY: number
  maxX: number
  maxY: number
  chemin: (g: CanvasRenderingContext2D) => void
}

/** Le contour à l'écran et son emprise — null si le pan est hors champ.
 *  Les formes tournées débordent de leur boîte de définition : la boîte se
 *  prend sur les points du contour, pas sur minX/maxX. */
function tracer(cache: FormeBox, vue: VueVoile, marge: number): Trace | null {
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
  minX = Math.floor(Math.max(-marge, minX - marge))
  minY = Math.floor(Math.max(-marge, minY - marge))
  maxX = Math.ceil(Math.min(vue.vw + marge, maxX + marge))
  maxY = Math.ceil(Math.min(vue.vh + marge, maxY + marge))
  if (maxX <= minX || maxY <= minY) return null
  const chemin = (g: CanvasRenderingContext2D): void => {
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
 *  de sa bande douce. Rayon 0 : le voile est fermé. Sa portée couvre le
 *  contour ET la lisière qui déborde : à la fin, il ne reste rien. */
function front(
  t: Trace,
  etat: EtatVoile,
  elapsed: number,
  vue: VueVoile,
  lisiere: number,
): { ex: number; ey: number; rayon: number; bande: number } {
  const e = vue.versEcran(etat.entreeX, etat.entreeY)
  let portee = 0
  for (const p of t.pts)
    portee = Math.max(portee, Math.hypot(p.sx - e.sx, p.sy - e.sy))
  portee += lisiere
  const bande = Math.max(24, Math.min(160, 0.35 * portee))
  return {
    ex: e.sx,
    ey: e.sy,
    rayon: avanceFront(etat.levee, elapsed) * (portee + bande),
    bande,
  }
}

/** Ouvre le calque pour ce voile : de la taille de l'emprise, en pixels
 *  physiques, avec le repère de l'écran (les coordonnées du contour s'y
 *  emploient telles quelles). */
function ouvrirCalque(t: Trace, vue: VueVoile): CanvasRenderingContext2D {
  const w = Math.ceil((t.maxX - t.minX) * vue.dpr)
  const h = Math.ceil((t.maxY - t.minY) * vue.dpr)
  const c = vue.calque(w, h)
  c.setTransform(vue.dpr, 0, 0, vue.dpr, -t.minX * vue.dpr, -t.minY * vue.dpr)
  return c
}

/** Pose le calque sur le canevas des effets, à l'emprise, à l'opacité
 *  donnée — un seul drawImage par voile. */
function poserCalque(
  g: CanvasRenderingContext2D,
  c: CanvasRenderingContext2D,
  t: Trace,
  vue: VueVoile,
  alpha: number,
): void {
  const w = t.maxX - t.minX
  const h = t.maxY - t.minY
  g.save()
  g.globalAlpha = alpha
  g.drawImage(
    c.canvas,
    0,
    0,
    Math.ceil(w * vue.dpr),
    Math.ceil(h * vue.dpr),
    t.minX,
    t.minY,
    w,
    h,
  )
  g.restore()
}

/** LE MASQUE du voile : plein au cœur du pan, il se fond des deux côtés
 *  du contour. Dedans, des traits emboîtés en EFFACEMENT, de plus en plus
 *  larges et aussi ténus, amincissent le pan vers son bord ; dehors, les
 *  mêmes traits en ajout le prolongent en s'éparpillant. Au contour même,
 *  les deux côtés se rejoignent à mi-opacité : aucune marche, aucune ligne.
 *  Le brouillard et ses textures se dessinent ENSUITE, dans ce masque
 *  (source-in, source-atop) : la hachure et les nappes s'estompent avec
 *  lui au lieu de s'arrêter net au contour — c'est ce qui redessinait le
 *  carré. */
function masque(c: CanvasRenderingContext2D, t: Trace, lisiere: number): void {
  const w = t.maxX - t.minX
  const h = t.maxY - t.minY
  // la même opacité par trait des deux côtés : au bord, dedans, il reste
  // (1 - a)^N du pan ; dehors, il s'ajoute 1 - (1 - a)^N — égaux à 0,5
  const a = 1 - Math.pow(0.5, 1 / TRAITS_FONDU)
  c.save()
  t.chemin(c)
  c.clip()
  c.fillStyle = '#000'
  c.fillRect(t.minX, t.minY, w, h)
  c.globalCompositeOperation = 'destination-out'
  c.lineJoin = 'round'
  c.strokeStyle = `rgba(0,0,0,${a.toFixed(4)})`
  for (let k = TRAITS_FONDU; k >= 1; k--) {
    c.lineWidth = (lisiere * 2 * k) / TRAITS_FONDU
    t.chemin(c)
    c.stroke()
  }
  c.restore()
  c.save()
  c.beginPath()
  c.rect(t.minX, t.minY, w, h)
  for (let k = 0; k < t.pts.length; k++) {
    if (k === 0) c.moveTo(t.pts[k].sx, t.pts[k].sy)
    else c.lineTo(t.pts[k].sx, t.pts[k].sy)
  }
  c.closePath()
  c.clip('evenodd')
  c.lineJoin = 'round'
  c.strokeStyle = `rgba(0,0,0,${a.toFixed(4)})`
  for (let k = TRAITS_FONDU; k >= 1; k--) {
    c.lineWidth = (lisiere * 2 * k) / TRAITS_FONDU
    t.chemin(c)
    c.stroke()
  }
  c.restore()
}

/** LE FRONT : creuse le disque de dissipation dans le calque — plein au
 *  cœur, en dégradé sur la bande. Rien tant que le voile est fermé. */
function creuserFront(
  c: CanvasRenderingContext2D,
  t: Trace,
  f: { ex: number; ey: number; rayon: number; bande: number },
): void {
  if (f.rayon <= 0) return
  c.save()
  c.globalCompositeOperation = 'destination-out'
  const grad = c.createRadialGradient(
    f.ex,
    f.ey,
    Math.max(0, f.rayon - f.bande),
    f.ex,
    f.ey,
    f.rayon,
  )
  grad.addColorStop(0, 'rgba(0,0,0,1)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = grad
  c.fillRect(t.minX, t.minY, t.maxX - t.minX, t.maxY - t.minY)
  c.restore()
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
  const t = tracer(cache, vue, lisiere)
  if (!t) return false
  const w = t.maxX - t.minX
  const h = t.maxY - t.minY
  const f = front(t, etat, elapsed, vue, lisiere)
  const c = ouvrirCalque(t, vue)

  // 1. LE MASQUE, puis le brouillard DANS le masque
  masque(c, t, lisiere)
  c.save()
  c.globalCompositeOperation = 'source-in'
  c.fillStyle = BROUILLARD
  c.fillRect(t.minX, t.minY, w, h)
  c.restore()

  // 2. LES TEXTURES, sur le brouillard et à son opacité : la hachure
  // oblique des zones non relevées, à 45°, et les nappes qui dérivent —
  // le voile se lit comme du brouillard, pas comme un rectangle mort
  c.save()
  c.globalCompositeOperation = 'source-atop'
  c.strokeStyle = `rgba(${CYAN_RGB},0.09)`
  c.lineWidth = 1
  c.beginPath()
  for (let d = -h; d < w; d += hachure) {
    c.moveTo(t.minX + d, t.minY)
    c.lineTo(t.minX + d + h, t.minY + h)
  }
  c.stroke()
  for (const n of nappes(indice, elapsed)) {
    const nx = t.minX + w * n.u
    const ny = t.minY + h * n.v
    const r = Math.max(8, Math.max(w, h) * n.r)
    const grad = c.createRadialGradient(nx, ny, 0, nx, ny, r)
    grad.addColorStop(0, `rgba(${NAPPE_RGB},0.30)`)
    grad.addColorStop(1, `rgba(${NAPPE_RGB},0)`)
    c.fillStyle = grad
    c.fillRect(t.minX, t.minY, w, h)
  }
  c.restore()

  // 3. L'ESTAMPILLE, au centre — seulement si elle tient, et seulement si
  // le centre est bien DANS la forme (un arc ou un coin ont leur centre
  // dehors : l'estampille flotterait dans le vide). Mesurée avant d'être
  // posée : à l'échelle d'une salle entière, un pan de 200 px ne la
  // contient pas, et une estampille qui déborde de son pan trahit plus
  // qu'elle n'explique. Elle s'efface avec le front : dès que le
  // brouillard se dissipe, elle n'a plus rien à nommer.
  const cxM = (cache.minX + cache.maxX) / 2
  const cyM = (cache.minY + cache.maxY) / 2
  const wPan = w - 2 * lisiere
  if (estampilleVisible(wPan, h - 2 * lisiere) && dansForme(cache, cxM, cyM)) {
    const p = vue.versEcran(cxM, cyM)
    const taille = Math.max(9, Math.min(13, wPan / 22))
    c.font = `600 ${taille}px ui-monospace, monospace`
    const texte = pochoir(ESTAMPILLE)
    if (c.measureText(texte).width <= wPan * 0.85) {
      c.save()
      c.globalCompositeOperation = 'source-atop'
      c.globalAlpha = (1 - avanceFront(etat.levee, elapsed)) * 0.7
      c.fillStyle = `rgba(${GRIS_RGB},0.5)`
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(texte, p.sx, p.sy)
      c.restore()
    }
  }

  // 4. LE FRONT, puis le calque se pose d'un coup
  creuserFront(c, t, f)
  poserCalque(g, c, t, vue, alphaReste(etat.levee, elapsed))
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
  if (alphaVoile(etat.levee, elapsed) <= 0) return false
  const t = tracer(cache, vue, 0)
  if (!t) return false
  const w = t.maxX - t.minX
  const h = t.maxY - t.minY
  const f = front(t, etat, elapsed, vue, 0)
  const c = ouvrirCalque(t, vue)
  c.save()
  t.chemin(c)
  c.clip()
  c.globalAlpha = 0.92
  c.fillStyle = PAROI
  c.fillRect(t.minX, t.minY, w, h)
  c.globalAlpha = 0.5
  c.fillStyle = PAROI_HAUT
  c.fillRect(t.minX, t.minY, w, h * 0.5)
  c.restore()
  creuserFront(c, t, f)
  poserCalque(g, c, t, vue, 1)
  return true
}
