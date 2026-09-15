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
// LE COÛT, MESURÉ (banc 2D, quatre cachettes du démineur, canevas logiciel
// de Chromium sans tête) : dessiner ce brouillard image par image coûtait
// quatre fois l'ancien voile — douze traits larges pour le fondu, une
// recomposition source-in de tout le calque, la hachure, quatre dégradés —
// et sur le canevas accéléré émulé, soixante fois. Le voile FERMÉ ne change
// pourtant pas d'une image à l'autre, hors la dérive lente des nappes : il
// se rend donc UNE FOIS dans un BITMAP MÉMOÏSÉ par cachette (fourni par la
// vue), rebâti quand sa signature change (zoom, forme, emprise) et au plus
// quatre fois par seconde pour les nappes — et se pose en UN drawImage par
// image. Le masque se peint directement dans la teinte du brouillard : pas
// de source-in, qui recompose tout le canevas. Seule la LEVÉE, une seconde
// par cachette, passe par un CALQUE : le front s'y creuse en effacement
// (destination-out) — sur le calque commun, cela aurait emporté les portes
// et pastilles déjà dessinées sous le voile.
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
const BROUILLARD_RGB = '12,20,32'
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
  /** Le calque de la levée : un contexte 2D vierge d'au moins w × h
   *  pixels PHYSIQUES, transformation identité. Réutilisé d'un voile à
   *  l'autre — l'appelant le garde et le vide. */
  calque: (w: number, h: number) => CanvasRenderingContext2D
  /** Le bitmap mémoïsé de la cachette `indice` : s'il porte déjà cette
   *  signature, le même contexte, intact (neuf : false) ; sinon un
   *  contexte vierge de w × h pixels physiques, transformation identité,
   *  à repeindre (neuf : true). L'appelant le garde par indice. */
  memo: (
    indice: number,
    signature: string,
    w: number,
    h: number,
  ) => { c: CanvasRenderingContext2D; neuf: boolean }
}

/** Le pas de la dérive des nappes dans le bitmap mémoïsé (s) : rebâti au
 *  plus quatre fois par seconde. À la vitesse des nappes (0,07 rad/s sur
 *  0,38 de la largeur), un quart de seconde déplace une nappe de 300 px de
 *  2 px — invisible sur un dégradé de cent pixels de rayon. */
export const NAPPES_PAS = 0.25

/** L'instant quantifié des nappes d'une cachette : le début de son pas
 *  courant. Les pas sont DÉCALÉS d'une cachette à l'autre — sinon les
 *  quatre mémos du démineur se repeignaient sur la même image, un pic
 *  toutes les 250 ms au lieu de quatre petits. */
export function instantNappes(indice: number, elapsed: number): number {
  const decal = ((indice * 0.37) % 1) * NAPPES_PAS
  return Math.floor((elapsed + decal) / NAPPES_PAS) * NAPPES_PAS - decal
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
  // l'emprise à l'écran : la boîte du contour élargie de la lisière et
  // rognée au champ — FLOTTANTE, pour que le contour garde la même place
  // dans l'emprise d'une image à l'autre quand la caméra glisse (arrondie,
  // elle changeait à chaque image et le bitmap mémoïsé se rebâtissait)
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
  minX = Math.max(-marge, minX - marge)
  minY = Math.max(-marge, minY - marge)
  maxX = Math.min(vue.vw + marge, maxX + marge)
  maxY = Math.min(vue.vh + marge, maxY + marge)
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

/** La signature du bitmap mémoïsé : tout ce qui change son contenu — la
 *  place du contour dans l'emprise (le zoom, la forme, le rognage au champ)
 *  et le pas de dérive des nappes. La position à l'écran n'en fait pas
 *  partie : le bitmap se pose où l'on veut. */
export function signatureVoile(
  cache: FormeBox,
  t: { minX: number; minY: number; maxX: number; maxY: number; pts: { sx: number; sy: number }[] },
  vue: { zoom: number; dpr: number },
  elapsed: number,
  indice = 0,
): string {
  return [
    (t.maxX - t.minX).toFixed(2),
    (t.maxY - t.minY).toFixed(2),
    (t.pts[0].sx - t.minX).toFixed(2),
    (t.pts[0].sy - t.minY).toFixed(2),
    vue.zoom.toFixed(4),
    vue.dpr,
    cache.angle ?? 0,
    cache.forme ?? 0,
    cache.p0 ?? '',
    cache.p1 ?? '',
    cache.p2 ?? '',
    instantNappes(indice, elapsed).toFixed(3),
  ].join('|')
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

/** Le repère de l'emprise sur un contexte : les coordonnées du contour
 *  (écran) s'y emploient telles quelles, en pixels physiques. */
function repere(c: CanvasRenderingContext2D, t: Trace, vue: VueVoile): void {
  c.setTransform(vue.dpr, 0, 0, vue.dpr, -t.minX * vue.dpr, -t.minY * vue.dpr)
}

/** Pose un bitmap (le mémo ou le calque) sur un contexte, à l'emprise, à
 *  l'opacité donnée — un seul drawImage. */
function poser(
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

/** LE MASQUE du voile, peint dans la teinte du brouillard : plein au cœur
 *  du pan, il se fond des deux côtés du contour. Dedans, des traits
 *  emboîtés en EFFACEMENT, de plus en plus larges et aussi ténus,
 *  amincissent le pan vers son bord ; dehors, les mêmes traits en ajout le
 *  prolongent en s'éparpillant. Au contour même, les deux côtés se
 *  rejoignent à mi-opacité : aucune marche, aucune ligne. Les textures se
 *  dessinent ENSUITE, dans cette opacité (source-atop) : la hachure et les
 *  nappes s'estompent avec elle au lieu de s'arrêter net au contour —
 *  c'est ce qui redessinait le carré. */
function masque(c: CanvasRenderingContext2D, t: Trace, lisiere: number): void {
  const w = t.maxX - t.minX
  const h = t.maxY - t.minY
  // la même opacité par trait des deux côtés : au bord, dedans, il reste
  // (1 - a)^N du pan ; dehors, il s'ajoute 1 - (1 - a)^N — égaux à 0,5
  const a = 1 - Math.pow(0.5, 1 / TRAITS_FONDU)
  c.save()
  t.chemin(c)
  c.clip()
  c.fillStyle = BROUILLARD
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
  c.strokeStyle = `rgba(${BROUILLARD_RGB},${a.toFixed(4)})`
  for (let k = TRAITS_FONDU; k >= 1; k--) {
    c.lineWidth = (lisiere * 2 * k) / TRAITS_FONDU
    t.chemin(c)
    c.stroke()
  }
  c.restore()
}

/** Le voile FERMÉ, complet, dans le bitmap mémoïsé : le masque, la
 *  hachure, les nappes, l'estampille. */
function peindreVoile(
  c: CanvasRenderingContext2D,
  cache: FormeBox,
  t: Trace,
  vue: VueVoile,
  elapsed: number,
  indice: number,
  hachure: number,
  lisiere: number,
): void {
  const w = t.maxX - t.minX
  const h = t.maxY - t.minY
  repere(c, t, vue)
  masque(c, t, lisiere)

  // LES TEXTURES, sur le brouillard et à son opacité : la hachure oblique
  // des zones non relevées, à 45°, et les nappes qui dérivent — le voile
  // se lit comme du brouillard, pas comme un rectangle mort. Les nappes se
  // prennent à l'instant quantifié du mémo : la même image tant qu'il vit.
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
  for (const n of nappes(indice, instantNappes(indice, elapsed))) {
    const nx = t.minX + w * n.u
    const ny = t.minY + h * n.v
    const r = Math.max(8, Math.max(w, h) * n.r)
    const grad = c.createRadialGradient(nx, ny, 0, nx, ny, r)
    grad.addColorStop(0, `rgba(${NAPPE_RGB},0.30)`)
    grad.addColorStop(1, `rgba(${NAPPE_RGB},0)`)
    c.fillStyle = grad
    c.fillRect(t.minX, t.minY, w, h)
  }

  // L'ESTAMPILLE, au centre — seulement si elle tient, et seulement si le
  // centre est bien DANS la forme (un arc ou un coin ont leur centre
  // dehors : l'estampille flotterait dans le vide). Mesurée avant d'être
  // posée : à l'échelle d'une salle entière, un pan de 200 px ne la
  // contient pas, et une estampille qui déborde de son pan trahit plus
  // qu'elle n'explique.
  const cxM = (cache.minX + cache.maxX) / 2
  const cyM = (cache.minY + cache.maxY) / 2
  const wPan = w - 2 * lisiere
  if (estampilleVisible(wPan, h - 2 * lisiere) && dansForme(cache, cxM, cyM)) {
    const p = vue.versEcran(cxM, cyM)
    const taille = Math.max(9, Math.min(13, wPan / 22))
    c.font = `600 ${taille}px ui-monospace, monospace`
    const texte = pochoir(ESTAMPILLE)
    if (c.measureText(texte).width <= wPan * 0.85) {
      c.globalAlpha = 0.7
      c.fillStyle = `rgba(${GRIS_RGB},0.5)`
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText(texte, p.sx, p.sy)
    }
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
  const wP = Math.ceil((t.maxX - t.minX) * vue.dpr)
  const hP = Math.ceil((t.maxY - t.minY) * vue.dpr)

  // 1. LE MÉMO : le voile fermé, repeint seulement si sa signature a changé
  const m = vue.memo(indice, signatureVoile(cache, t, vue, elapsed, indice), wP, hP)
  if (m.neuf) peindreVoile(m.c, cache, t, vue, elapsed, indice, hachure, lisiere)

  // 2. FERMÉ : le mémo se pose tel quel, un drawImage
  if (etat.levee === Infinity) {
    poser(g, m.c, t, vue, 1)
    return true
  }

  // 3. EN LEVÉE : le mémo passe par le calque, où le front se creuse
  const c = vue.calque(wP, hP)
  c.setTransform(1, 0, 0, 1, 0, 0)
  c.drawImage(m.c.canvas, 0, 0, wP, hP, 0, 0, wP, hP)
  repere(c, t, vue)
  creuserFront(c, t, front(t, etat, elapsed, vue, lisiere))
  poser(g, c, t, vue, alphaReste(etat.levee, elapsed))
  return true
}

/** La PAROI FACTICE : voilée, c'est le moteur qui la rend (vraie paroi,
 *  vraies ombres) — ici on ne dessine que sa DISSOLUTION une fois révélée :
 *  la teinte de paroi s'évapore du contour exact, par le même front que le
 *  brouillard. Une seconde par cachette : le calque suffit, sans mémo.
 *  Rend false si rien n'a été dessiné. */
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
  const c = vue.calque(Math.ceil(w * vue.dpr), Math.ceil(h * vue.dpr))
  repere(c, t, vue)
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
  creuserFront(c, t, front(t, etat, elapsed, vue, 0))
  poser(g, c, t, vue, 1)
  return true
}

// ---- LE MODE SOBRE : l'ancien voile, tel quel ----------------------------
//
// Le réglage PARAMÈTRES « voile des cachettes » permet de revenir au voile
// d'avant (a7c88ad) : le rectangle plein dans la forme, quatre nappes à
// peine visibles, un liseré d'un pixel, et une levée qui fond d'un bloc en
// 0,9 s. Ni mémo ni calque : il se dessine directement sur le canevas des
// effets, comme il l'a toujours fait. Gardé à l'identique, à dessein — le
// joueur qui le choisit veut retrouver ce qu'il connaît.

/** La durée de la levée de l'ancien voile (s). */
export const VOILE_SOBRE_DUREE = 0.9

/** L'opacité de l'ancien voile : 1 fermé, fondu linéaire à la levée. */
export function alphaSobre(levee: number, elapsed: number): number {
  if (levee === Infinity) return 1
  return Math.max(0, Math.min(1, 1 - (elapsed - levee) / VOILE_SOBRE_DUREE))
}

/** Le chemin de l'ancien voile : la boîte à l'écran (sans rotation, comme
 *  avant) et le contour exact. Null si la boîte est hors champ. */
function tracerSobre(
  g: CanvasRenderingContext2D,
  cache: FormeBox,
  vue: VueVoile,
): { a: { sx: number; sy: number }; w: number; h: number; chemin: () => void } | null {
  const a = vue.versEcran(cache.minX, cache.maxY)
  const b = vue.versEcran(cache.maxX, cache.minY)
  const w = b.sx - a.sx
  const h = b.sy - a.sy
  if (b.sx < 0 || a.sx > vue.vw || b.sy < 0 || a.sy > vue.vh) return null
  const chemin = (): void => {
    const pts = formeOutline(cache, 56)
    g.beginPath()
    for (let k = 0; k < pts.length; k++) {
      const sp = vue.versEcran(pts[k].x, pts[k].y)
      if (k === 0) g.moveTo(sp.sx, sp.sy)
      else g.lineTo(sp.sx, sp.sy)
    }
    g.closePath()
  }
  return { a, w, h, chemin }
}

/** L'ancien brouillard d'une cachette (style par défaut). Rend false si
 *  rien n'a été dessiné. */
export function dessineVoileSobre(
  g: CanvasRenderingContext2D,
  cache: FormeBox,
  etat: EtatVoile,
  elapsed: number,
  vue: VueVoile,
  indice: number,
): boolean {
  const alpha = alphaSobre(etat.levee, elapsed)
  if (alpha <= 0) return false
  const t = tracerSobre(g, cache, vue)
  if (!t) return false
  const { a, w, h, chemin } = t
  g.save()
  chemin()
  g.clip()
  g.globalAlpha = alpha
  g.fillStyle = '#0d1320'
  g.fillRect(a.sx, a.sy, w, h)
  for (let k = 0; k < 4; k++) {
    const ph = indice * 7.3 + k * 2.1
    const nx = a.sx + w * (0.5 + 0.42 * Math.sin(elapsed * 0.11 + ph * 1.7))
    const ny = a.sy + h * (0.5 + 0.42 * Math.cos(elapsed * 0.089 + ph))
    const r = Math.max(w, h) * (0.3 + 0.1 * Math.sin(ph * 3.7))
    const grad = g.createRadialGradient(nx, ny, 0, nx, ny, Math.max(8, r))
    grad.addColorStop(0, 'rgba(52,68,92,0.24)')
    grad.addColorStop(1, 'rgba(52,68,92,0)')
    g.fillStyle = grad
    g.fillRect(a.sx, a.sy, w, h)
  }
  g.restore()
  // le liseré, à peine plus clair : le pan se devine sans se trahir
  g.save()
  g.globalAlpha = alpha * 0.45
  g.strokeStyle = 'rgba(74,94,120,0.55)'
  g.lineWidth = 1
  chemin()
  g.stroke()
  g.restore()
  return true
}

/** L'ancienne dissolution de la paroi factice : la teinte de paroi fond
 *  d'un bloc dans le contour exact. Rend false si rien n'a été dessiné. */
export function dessineDissolutionParoiSobre(
  g: CanvasRenderingContext2D,
  cache: FormeBox,
  etat: EtatVoile,
  elapsed: number,
  vue: VueVoile,
): boolean {
  if (etat.levee === Infinity) return false
  const alpha = alphaSobre(etat.levee, elapsed)
  if (alpha <= 0) return false
  const t = tracerSobre(g, cache, vue)
  if (!t) return false
  const { a, w, h, chemin } = t
  g.save()
  chemin()
  g.clip()
  g.globalAlpha = alpha * 0.92
  g.fillStyle = PAROI
  g.fillRect(a.sx, a.sy, w, h)
  g.globalAlpha = alpha * 0.5
  g.fillStyle = PAROI_HAUT
  g.fillRect(a.sx, a.sy, w, h * 0.5)
  g.restore()
  return true
}
