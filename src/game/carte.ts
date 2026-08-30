// La MINI-CARTE d'un tableau : l'aperçu dessiné depuis sa géométrie —
// parois, surfaces, zones, départ et sas — pour les propositions de fin de
// salle (et partout où un tableau doit se montrer d'un coup d'œil).
// Un schéma fidèle plutôt qu'une capture : toujours disponible, lisible en
// vignette, et les couleurs reprennent le langage du jeu.

import {
  MAT_PLATEAU,
  MAT_CHAUD,
  MAT_FROID,
  MAT_GRILLE,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_MEMBRANE,
  MAT_RIDEAU,
  MAT_SURCHAUFFEUR,
  MAT_WALL,
  type LevelDef,
} from './level'

const COULEURS: Record<number, string> = {
  [MAT_WALL]: '#3a4a5c',
  [MAT_HYDROPHILE]: '#1d7d84',
  [MAT_HYDROPHOBE]: '#7a4fa0',
  [MAT_FROID]: '#6fb7d8',
  [MAT_GRILLE]: '#5c6b78',
  [MAT_CHAUD]: '#c06a32',
  [MAT_MEMBRANE]: '#2e8f6a',
  [MAT_RIDEAU]: '#7f9dc0',
  [MAT_SURCHAUFFEUR]: '#e0a95a',
  // l'étage : un sol, pas un mur — sable clair, pour qu'il se lise praticable
  [MAT_PLATEAU]: '#8a7f57',
}
const ZONES: Record<string, string> = {
  glace: 'rgba(111, 183, 216, 0.20)',
  vapeur: 'rgba(242, 201, 142, 0.20)',
  libre: 'rgba(120, 140, 160, 0.10)',
}

/** Dessine l'aperçu du tableau dans le canvas (toute sa surface). */
export function dessineMiniCarte(
  canvas: HTMLCanvasElement,
  lv: LevelDef,
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const W = canvas.width
  const H = canvas.height
  const b = lv.bounds
  const marge = 4
  const k = Math.min(
    (W - marge * 2) / (b.maxX - b.minX),
    (H - marge * 2) / (b.maxY - b.minY),
  )
  // le monde a l'axe Y vers le haut : l'écran l'a vers le bas
  const X = (x: number): number =>
    (W - (b.maxX - b.minX) * k) / 2 + (x - b.minX) * k
  const Y = (y: number): number =>
    (H - (b.maxY - b.minY) * k) / 2 + (b.maxY - y) * k

  ctx.clearRect(0, 0, W, H)
  // le fond de cuve, et son cadre
  ctx.fillStyle = '#0c141d'
  ctx.fillRect(
    X(b.minX),
    Y(b.maxY),
    (b.maxX - b.minX) * k,
    (b.maxY - b.minY) * k,
  )
  ctx.strokeStyle = '#2a3947'
  ctx.lineWidth = 1
  ctx.strokeRect(
    X(b.minX),
    Y(b.maxY),
    (b.maxX - b.minX) * k,
    (b.maxY - b.minY) * k,
  )

  // les zones d'état, sous les solides
  for (const z of lv.zones ?? []) {
    ctx.fillStyle = ZONES[z.force] ?? ZONES.libre
    ctx.fillRect(
      X(z.minX),
      Y(z.maxY),
      (z.maxX - z.minX) * k,
      (z.maxY - z.minY) * k,
    )
  }

  // les solides, couleur par matériau — rond et rotation respectés
  for (const box of lv.boxes) {
    ctx.fillStyle = COULEURS[box.material] ?? COULEURS[MAT_WALL]
    const w = (box.maxX - box.minX) * k
    const h = (box.maxY - box.minY) * k
    const cx = X((box.minX + box.maxX) / 2)
    const cy = Y((box.minY + box.maxY) / 2)
    ctx.save()
    ctx.translate(cx, cy)
    if (box.angle) ctx.rotate((-box.angle * Math.PI) / 180)
    if (box.forme === 1) {
      ctx.beginPath()
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillRect(-w / 2, -h / 2, w, h)
    }
    ctx.restore()
  }

  // l'éponge : un feutre pointillé
  ctx.fillStyle = 'rgba(190, 170, 90, 0.55)'
  for (const sp of lv.sponges ?? []) {
    const maxX = sp.minX + sp.cols * sp.cellSize
    const maxY = sp.minY + sp.rows * sp.cellSize
    ctx.fillRect(
      X(sp.minX),
      Y(maxY),
      (maxX - sp.minX) * k,
      (maxY - sp.minY) * k,
    )
  }

  // le SAS (anneau vert) et le DÉPART (goutte cyan)
  const e = lv.exit
  ctx.strokeStyle = '#3fd69b'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.ellipse(
    X((e.minX + e.maxX) / 2),
    Y((e.minY + e.maxY) / 2),
    Math.max(3, ((e.maxX - e.minX) / 2) * k),
    Math.max(3, ((e.maxY - e.minY) / 2) * k),
    0,
    0,
    Math.PI * 2,
  )
  ctx.stroke()
  ctx.fillStyle = '#63b7e6'
  ctx.beginPath()
  ctx.arc(X(lv.spawn.x), Y(lv.spawn.y), Math.max(2.5, 60 * k), 0, Math.PI * 2)
  ctx.fill()
}
