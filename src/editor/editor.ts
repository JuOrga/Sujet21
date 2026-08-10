// Éditeur de tableaux — vue schématique en 2D, pensée pour la précision
// plutôt que pour la beauté : on y dessine des rectangles, on les déplace, on
// les redimensionne, et on essaie le tableau sans quitter la page.
//
// Le rendu WebGL du jeu n'est pas réutilisé ici : une vue à plat, avec les
// matériaux en aplats de couleur et les cotes lisibles, se lit mieux pour
// construire un niveau — l'aperçu réel, c'est le bouton ESSAYER.

import {
  MATERIAL_NAMES,
  MAT_CHAUD,
  MAT_FROID,
  MAT_GRILLE,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_WALL,
  ZONE_CAUSES,
  zoneName,
  zoneOutline,
  type LevelDef,
  type SpongeDef,
  type WorldLabel,
  type ZoneForce,
} from '../game/level'
import { checkLevel, parseLevel, serializeLevel } from '../game/levelIO'
import { traceLaser } from '../game/laser'
import { DEFAULT_PARAMS } from '../sim/params'
import { PISTES, PISTE_NOMS, type Piste } from '../game/soundtrack'
import {
  deleteLevel,
  fetchLibrary,
  reorderLibrary,
  saveLevel,
  type StoredLevel,
} from '../game/netLevels'

const STORE_KEY = 'projet21.editeur.v1'

// Couleurs des matériaux : celles de la légende du jeu, pour qu'on reconnaisse
// une surface d'un écran à l'autre.
const MAT_COLORS: Record<number, string> = {
  [MAT_WALL]: '#4a6b80',
  [MAT_HYDROPHILE]: '#2ec6c9',
  [MAT_HYDROPHOBE]: '#a878e8',
  [MAT_FROID]: '#8fc8ee',
  [MAT_GRILLE]: '#8fb0c6',
  [MAT_CHAUD]: '#ff8a3c',
}
const ZONE_COLORS: Record<ZoneForce, string> = {
  libre: '#7b93a8',
  eau: '#63b7e6',
  glace: '#8fc8ee',
  vapeur: '#c9a6f2',
}

type Tool =
  | { kind: 'select' }
  | { kind: 'box'; material: number }
  | { kind: 'sponge' }
  | { kind: 'zone'; force: ZoneForce }
  | { kind: 'spawn' }
  | { kind: 'exit' }
  | { kind: 'label' }
  | { kind: 'laser' }
  | { kind: 'cible' }
  | { kind: 'porte' }

type Sel =
  | { kind: 'box'; index: number }
  | { kind: 'sponge'; index: number }
  | { kind: 'zone'; index: number }
  | { kind: 'label'; index: number }
  | { kind: 'laser'; index: number }
  | { kind: 'cible'; index: number }
  | { kind: 'porte'; index: number }
  | { kind: 'exit' }
  | { kind: 'spawn' }
  | null

interface Rect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const HANDLE_PX = 9 // demi-côté d'une poignée, en pixels écran

export interface EditorHooks {
  /** Essayer le tableau dans le jeu ; l'éditeur se masque. */
  play(level: LevelDef): void
  /** Quitter l'éditeur et revenir à la fiche d'essai. */
  quit(): void
  /** Nom de l'opérateur, estampillé sur les tableaux enregistrés. */
  operator(): string
  /** La bibliothèque a changé : le jeu recharge sa séquence. */
  libraryChanged(levels: StoredLevel[]): void
}

function blankLevel(): LevelDef {
  return {
    name: 'Nouveau tableau',
    code: '21-?',
    journal:
      'Entrée de journal du protocole : ce que le laboratoire a observé dans cette cuve.',
    bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
    spawn: { x: -950, y: 0, n: 900 },
    exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
    boxes: [],
    sponges: [],
    labels: [{ x: 1110, y: 0, text: 'SAS', tone: 'sas' }],
    zones: [],
    par: 3,
  }
}

export class LevelEditor {
  private readonly host: HTMLElement
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly hooks: EditorHooks

  private level: LevelDef = blankLevel()
  private tool: Tool = { kind: 'select' }
  private sel: Sel = null
  private grid = 20
  private snap = true

  // caméra de l'éditeur : monde → écran
  private camX = 0
  private camY = 0
  private zoom = 0.3

  // geste en cours
  private drag:
    | null
    | { mode: 'pan'; sx: number; sy: number; camX: number; camY: number }
    | { mode: 'create'; x0: number; y0: number; x1: number; y1: number }
    | { mode: 'move'; ox: number; oy: number; start: Rect }
    | { mode: 'aim'; index: number }
    | { mode: 'resize'; edge: string; start: Rect } = null

  private hint = ''

  // Images du jeu (illustrations de zones, décals) : chargées à la demande,
  // le dessin se rafraîchit quand elles arrivent — l'éditeur montre la même
  // chose que la cuve.
  private readonly imgs = new Map<string, HTMLImageElement>()

  private img(name: string): HTMLImageElement | null {
    let im = this.imgs.get(name)
    if (!im) {
      im = new Image()
      im.src = `/assets/${name}.webp`
      im.onload = () => this.draw()
      this.imgs.set(name, im)
    }
    return im.complete && im.naturalWidth > 0 ? im : null
  }

  // Bibliothèque partagée : la liste, et l'entrée actuellement ouverte
  private library: StoredLevel[] = []
  private openId = ''
  private busy = false

  constructor(host: HTMLElement, hooks: EditorHooks) {
    this.host = host
    this.hooks = hooks
    this.canvas = host.querySelector('#ed-canvas') as HTMLCanvasElement
    this.ctx = this.canvas.getContext('2d')!
    this.bindUi()
    this.bindCanvas()
    this.restore()
    void this.refreshLibrary()
  }

  // ——— Ouverture / fermeture ———————————————————————————————
  open(level?: LevelDef): void {
    if (level) this.level = structuredClone(level)
    this.host.classList.add('visible')
    this.fitView()
    this.syncForm()
    this.draw()
    void this.refreshLibrary()
  }

  close(): void {
    this.host.classList.remove('visible')
  }

  currentLevel(): LevelDef {
    return this.level
  }

  // ——— Persistance locale ————————————————————————————————
  private persist(): void {
    try {
      localStorage.setItem(STORE_KEY, serializeLevel(this.level))
    } catch {
      // stockage indisponible : l'édition continue, sans reprise après coup
    }
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      if (!raw) return
      const { level } = parseLevel(JSON.parse(raw))
      if (level) this.level = level
    } catch {
      // brouillon illisible : on repart d'un tableau vierge
    }
  }

  // ——— Repères ————————————————————————————————————————
  private toScreen(x: number, y: number): { sx: number; sy: number } {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    return {
      sx: w * 0.5 + (x - this.camX) * this.zoom,
      sy: h * 0.5 - (y - this.camY) * this.zoom,
    }
  }

  private toWorld(sx: number, sy: number): { x: number; y: number } {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    return {
      x: this.camX + (sx - w * 0.5) / this.zoom,
      y: this.camY - (sy - h * 0.5) / this.zoom,
    }
  }

  private snapped(v: number): number {
    return this.snap ? Math.round(v / this.grid) * this.grid : Math.round(v)
  }

  private fitView(): void {
    const b = this.level.bounds
    this.camX = (b.minX + b.maxX) / 2
    this.camY = (b.minY + b.maxY) / 2
    const w = Math.max(1, this.canvas.clientWidth)
    const h = Math.max(1, this.canvas.clientHeight)
    this.zoom = Math.min(w / (b.maxX - b.minX), h / (b.maxY - b.minY)) * 0.88
  }

  // ——— Sélection ————————————————————————————————————————
  private selRect(): Rect | null {
    const s = this.sel
    if (!s) return null
    if (s.kind === 'box') return this.level.boxes[s.index] ?? null
    if (s.kind === 'zone') return (this.level.zones ?? [])[s.index] ?? null
    if (s.kind === 'porte') return (this.level.portes ?? [])[s.index] ?? null
    if (s.kind === 'exit') return this.level.exit
    if (s.kind === 'sponge') {
      const sp = this.level.sponges[s.index]
      if (!sp) return null
      return {
        minX: sp.minX,
        minY: sp.minY,
        maxX: sp.minX + sp.cols * sp.cellSize,
        maxY: sp.minY + sp.rows * sp.cellSize,
      }
    }
    return null
  }

  private applyRect(r: Rect): void {
    const s = this.sel
    if (!s) return
    const norm = {
      minX: Math.min(r.minX, r.maxX),
      minY: Math.min(r.minY, r.maxY),
      maxX: Math.max(r.minX, r.maxX),
      maxY: Math.max(r.minY, r.maxY),
    }
    if (s.kind === 'box') Object.assign(this.level.boxes[s.index], norm)
    else if (s.kind === 'zone') Object.assign((this.level.zones ?? [])[s.index], norm)
    else if (s.kind === 'porte') Object.assign((this.level.portes ?? [])[s.index], norm)
    else if (s.kind === 'exit') Object.assign(this.level.exit, norm)
    else if (s.kind === 'sponge') {
      const sp = this.level.sponges[s.index]
      sp.minX = norm.minX
      sp.minY = norm.minY
      sp.cols = Math.max(1, Math.round((norm.maxX - norm.minX) / sp.cellSize))
      sp.rows = Math.max(1, Math.round((norm.maxY - norm.minY) / sp.cellSize))
    }
  }

  /** Ce qui se trouve sous le point monde, du plus « au-dessus » au plus bas. */
  private pick(x: number, y: number): Sel {
    const inside = (r: Rect): boolean => x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY
    const labels = this.level.labels
    for (let i = labels.length - 1; i >= 0; i--) {
      const l = labels[i]
      const r = 60 / this.zoom
      if (Math.abs(l.x - x) < r * 1.6 && Math.abs(l.y - y) < r * 0.5) {
        return { kind: 'label', index: i }
      }
    }
    const lasers = this.level.lasers ?? []
    for (let i = lasers.length - 1; i >= 0; i--) {
      if (Math.hypot(lasers[i].x - x, lasers[i].y - y) < Math.max(24, 26 / this.zoom)) {
        return { kind: 'laser', index: i }
      }
    }
    const cibles = this.level.cibles ?? []
    for (let i = cibles.length - 1; i >= 0; i--) {
      if (Math.hypot(cibles[i].x - x, cibles[i].y - y) < cibles[i].r + 8) {
        return { kind: 'cible', index: i }
      }
    }
    const portes = this.level.portes ?? []
    for (let i = portes.length - 1; i >= 0; i--) {
      if (inside(portes[i])) return { kind: 'porte', index: i }
    }
    const sr = 70
    if (Math.hypot(this.level.spawn.x - x, this.level.spawn.y - y) < sr) return { kind: 'spawn' }
    if (inside(this.level.exit)) return { kind: 'exit' }
    for (let i = this.level.boxes.length - 1; i >= 0; i--) {
      if (inside(this.level.boxes[i])) return { kind: 'box', index: i }
    }
    for (let i = this.level.sponges.length - 1; i >= 0; i--) {
      const sp = this.level.sponges[i]
      if (
        inside({
          minX: sp.minX,
          minY: sp.minY,
          maxX: sp.minX + sp.cols * sp.cellSize,
          maxY: sp.minY + sp.rows * sp.cellSize,
        })
      ) {
        return { kind: 'sponge', index: i }
      }
    }
    const zones = this.level.zones ?? []
    for (let i = zones.length - 1; i >= 0; i--) {
      if (inside(zones[i])) return { kind: 'zone', index: i }
    }
    return null
  }

  /** Poignée de redimensionnement sous le curseur, s'il y en a une. */
  private hitHandle(sx: number, sy: number): string | null {
    const r = this.selRect()
    if (!r) return null
    const a = this.toScreen(r.minX, r.maxY)
    const b = this.toScreen(r.maxX, r.minY)
    const near = (v: number, t: number): boolean => Math.abs(v - t) <= HANDLE_PX
    const withinX = sx >= a.sx - HANDLE_PX && sx <= b.sx + HANDLE_PX
    const withinY = sy >= a.sy - HANDLE_PX && sy <= b.sy + HANDLE_PX
    if (!withinX || !withinY) return null
    let edge = ''
    if (near(sy, a.sy)) edge += 'N'
    else if (near(sy, b.sy)) edge += 'S'
    if (near(sx, a.sx)) edge += 'W'
    else if (near(sx, b.sx)) edge += 'E'
    return edge || null
  }

  // ——— Souris ————————————————————————————————————————
  private bindCanvas(): void {
    const c = this.canvas

    c.addEventListener('contextmenu', (e) => e.preventDefault())

    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId)
      const rect = c.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const w = this.toWorld(sx, sy)

      // clic droit ou milieu : déplacer la vue
      if (e.button === 2 || e.button === 1) {
        this.drag = { mode: 'pan', sx, sy, camX: this.camX, camY: this.camY }
        return
      }

      if (this.tool.kind === 'select') {
        const edge = this.hitHandle(sx, sy)
        if (edge) {
          const r = this.selRect()
          if (r) {
            this.drag = { mode: 'resize', edge, start: { ...r } }
            return
          }
        }
        const hit = this.pick(w.x, w.y)
        this.sel = hit
        this.syncProps()
        if (hit) {
          if (hit.kind === 'spawn') {
            this.drag = { mode: 'move', ox: w.x - this.level.spawn.x, oy: w.y - this.level.spawn.y, start: { minX: 0, minY: 0, maxX: 0, maxY: 0 } }
          } else if (hit.kind === 'laser') {
            const l = (this.level.lasers ?? [])[hit.index]
            this.drag = { mode: 'move', ox: w.x - l.x, oy: w.y - l.y, start: { minX: 0, minY: 0, maxX: 0, maxY: 0 } }
          } else if (hit.kind === 'cible') {
            const t = (this.level.cibles ?? [])[hit.index]
            this.drag = { mode: 'move', ox: w.x - t.x, oy: w.y - t.y, start: { minX: 0, minY: 0, maxX: 0, maxY: 0 } }
          } else if (hit.kind === 'label') {
            const l = this.level.labels[hit.index]
            this.drag = { mode: 'move', ox: w.x - l.x, oy: w.y - l.y, start: { minX: 0, minY: 0, maxX: 0, maxY: 0 } }
          } else {
            const r = this.selRect()!
            this.drag = { mode: 'move', ox: w.x - r.minX, oy: w.y - r.minY, start: { ...r } }
          }
        }
        this.draw()
        return
      }

      // outils de création
      if (this.tool.kind === 'spawn') {
        this.level.spawn.x = this.snapped(w.x)
        this.level.spawn.y = this.snapped(w.y)
        this.setTool({ kind: 'select' })
        this.commit('Point de départ déplacé.')
        return
      }
      if (this.tool.kind === 'cible') {
        if (!this.level.cibles) this.level.cibles = []
        this.level.cibles.push({ x: this.snapped(w.x), y: this.snapped(w.y), r: 26 })
        this.sel = { kind: 'cible', index: this.level.cibles.length - 1 }
        this.setTool({ kind: 'select' })
        this.commit('Cible posée — un faisceau qui la touche l’allume.')
        return
      }
      if (this.tool.kind === 'laser') {
        if (!this.level.lasers) this.level.lasers = []
        this.level.lasers.push({ x: this.snapped(w.x), y: this.snapped(w.y), angle: 0 })
        const index = this.level.lasers.length - 1
        this.sel = { kind: 'laser', index }
        this.drag = { mode: 'aim', index } // glisser pour orienter le fût
        this.draw()
        return
      }
      if (this.tool.kind === 'label') {
        const text = prompt('Texte de l’étiquette (elle sera peinte dans le décor) :', 'PAROI')
        if (text && text.trim()) {
          this.level.labels.push({
            x: this.snapped(w.x),
            y: this.snapped(w.y),
            text: text.trim().toUpperCase().slice(0, 40),
            tone: 'mur',
          })
          this.sel = { kind: 'label', index: this.level.labels.length - 1 }
        }
        this.setTool({ kind: 'select' })
        this.commit('Étiquette posée.')
        return
      }
      const x = this.snapped(w.x)
      const y = this.snapped(w.y)
      this.drag = { mode: 'create', x0: x, y0: y, x1: x, y1: y }
    })

    c.addEventListener('pointermove', (e) => {
      const rect = c.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const w = this.toWorld(sx, sy)
      this.showCoords(w.x, w.y)

      if (!this.drag) {
        c.style.cursor =
          this.tool.kind === 'select' ? (this.hitHandle(sx, sy) ? 'nwse-resize' : 'default') : 'crosshair'
        return
      }
      const d = this.drag
      if (d.mode === 'pan') {
        this.camX = d.camX - (sx - d.sx) / this.zoom
        this.camY = d.camY + (sy - d.sy) / this.zoom
      } else if (d.mode === 'create') {
        d.x1 = this.snapped(w.x)
        d.y1 = this.snapped(w.y)
      } else if (d.mode === 'aim') {
        const l = (this.level.lasers ?? [])[d.index]
        if (l) {
          const a = (Math.atan2(w.y - l.y, w.x - l.x) * 180) / Math.PI
          l.angle = Math.round(((a % 360) + 360) % 360)
        }
      } else if (d.mode === 'move') {
        if (this.sel?.kind === 'laser') {
          const l = (this.level.lasers ?? [])[this.sel.index]
          l.x = this.snapped(w.x - d.ox)
          l.y = this.snapped(w.y - d.oy)
        } else if (this.sel?.kind === 'cible') {
          const t = (this.level.cibles ?? [])[this.sel.index]
          t.x = this.snapped(w.x - d.ox)
          t.y = this.snapped(w.y - d.oy)
        } else if (this.sel?.kind === 'spawn') {
          this.level.spawn.x = this.snapped(w.x - d.ox)
          this.level.spawn.y = this.snapped(w.y - d.oy)
        } else if (this.sel?.kind === 'label') {
          const l = this.level.labels[this.sel.index]
          l.x = this.snapped(w.x - d.ox)
          l.y = this.snapped(w.y - d.oy)
        } else {
          const nx = this.snapped(w.x - d.ox)
          const ny = this.snapped(w.y - d.oy)
          this.applyRect({
            minX: nx,
            minY: ny,
            maxX: nx + (d.start.maxX - d.start.minX),
            maxY: ny + (d.start.maxY - d.start.minY),
          })
        }
      } else if (d.mode === 'resize') {
        const r = { ...d.start }
        if (d.edge.includes('W')) r.minX = this.snapped(w.x)
        if (d.edge.includes('E')) r.maxX = this.snapped(w.x)
        if (d.edge.includes('N')) r.maxY = this.snapped(w.y)
        if (d.edge.includes('S')) r.minY = this.snapped(w.y)
        this.applyRect(r)
      }
      this.draw()
    })

    c.addEventListener('pointerup', () => {
      const d = this.drag
      this.drag = null
      if (!d) return
      if (d.mode === 'aim') {
        this.setTool({ kind: 'select' })
        this.commit('Émetteur posé — glissez depuis lui pour réorienter, ou réglez l’angle à droite.')
        return
      }
      if (d.mode === 'create') {
        const minX = Math.min(d.x0, d.x1)
        const maxX = Math.max(d.x0, d.x1)
        const minY = Math.min(d.y0, d.y1)
        const maxY = Math.max(d.y0, d.y1)
        if (maxX - minX < this.grid || maxY - minY < this.grid) {
          this.commit('Trop petit : glissez pour tracer un rectangle.')
          return
        }
        this.createAt({ minX, minY, maxX, maxY })
        return
      }
      this.commit('')
    })

    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault()
        const rect = c.getBoundingClientRect()
        const before = this.toWorld(e.clientX - rect.left, e.clientY - rect.top)
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
        this.zoom = Math.max(0.05, Math.min(3, this.zoom * factor))
        const after = this.toWorld(e.clientX - rect.left, e.clientY - rect.top)
        this.camX += before.x - after.x
        this.camY += before.y - after.y
        this.draw()
      },
      { passive: false },
    )

    window.addEventListener('keydown', (e) => {
      if (!this.host.classList.contains('visible')) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        this.deleteSel()
      } else if (e.key === 'Escape') {
        this.sel = null
        this.setTool({ kind: 'select' })
        this.draw()
      } else if (e.key === 'd' || e.key === 'D') {
        this.duplicateSel()
      }
    })

    window.addEventListener('resize', () => {
      if (this.host.classList.contains('visible')) this.draw()
    })
  }

  /** Ramène un rectangle dans la cuve : on ne construit pas dans le vide. */
  private clampToBounds(r: Rect): Rect {
    const b = this.level.bounds
    return {
      minX: Math.max(b.minX, Math.min(r.minX, b.maxX)),
      minY: Math.max(b.minY, Math.min(r.minY, b.maxY)),
      maxX: Math.max(b.minX, Math.min(r.maxX, b.maxX)),
      maxY: Math.max(b.minY, Math.min(r.maxY, b.maxY)),
    }
  }

  private createAt(raw: Rect): void {
    const r = this.clampToBounds(raw)
    const t = this.tool
    if (t.kind === 'box') {
      this.level.boxes.push({ ...r, material: t.material })
      this.sel = { kind: 'box', index: this.level.boxes.length - 1 }
      this.commit(`${MATERIAL_NAMES[t.material]} posée.`)
    } else if (t.kind === 'sponge') {
      const cell = 24
      const sp: SpongeDef = {
        minX: r.minX,
        minY: r.minY,
        cols: Math.max(1, Math.round((r.maxX - r.minX) / cell)),
        rows: Math.max(1, Math.round((r.maxY - r.minY) / cell)),
        cellSize: cell,
        capacityPerCell: 5,
      }
      this.level.sponges.push(sp)
      this.sel = { kind: 'sponge', index: this.level.sponges.length - 1 }
      this.commit('Éponge posée.')
    } else if (t.kind === 'zone') {
      if (!this.level.zones) this.level.zones = []
      this.level.zones.push({ ...r, force: t.force })
      this.sel = { kind: 'zone', index: this.level.zones.length - 1 }
      this.commit(`Zone « ${t.force} » posée.`)
    } else if (t.kind === 'porte') {
      if (!this.level.portes) this.level.portes = []
      // asservie à la cible la plus proche — modifiable dans le panneau
      const cx = (r.minX + r.maxX) / 2
      const cy = (r.minY + r.maxY) / 2
      let cible = 0
      let best = Infinity
      for (let i = 0; i < (this.level.cibles ?? []).length; i++) {
        const t2 = this.level.cibles![i]
        const d2 = Math.hypot(t2.x - cx, t2.y - cy)
        if (d2 < best) {
          best = d2
          cible = i
        }
      }
      this.level.portes.push({ ...r, cible })
      this.sel = { kind: 'porte', index: this.level.portes.length - 1 }
      this.commit(
        (this.level.cibles ?? []).length > 0
          ? `Porte posée, asservie à la cible nº ${cible + 1}.`
          : 'Porte posée — posez une cible et asservissez-la dans le panneau.',
      )
    } else if (t.kind === 'exit') {
      Object.assign(this.level.exit, r)
      this.sel = { kind: 'exit' }
      this.commit('Sas déplacé.')
    }
    this.setTool({ kind: 'select' })
  }

  private deleteSel(): void {
    const s = this.sel
    if (!s) return
    if (s.kind === 'box') this.level.boxes.splice(s.index, 1)
    else if (s.kind === 'sponge') this.level.sponges.splice(s.index, 1)
    else if (s.kind === 'zone') (this.level.zones ?? []).splice(s.index, 1)
    else if (s.kind === 'laser') (this.level.lasers ?? []).splice(s.index, 1)
    else if (s.kind === 'porte') (this.level.portes ?? []).splice(s.index, 1)
    else if (s.kind === 'cible') {
      ;(this.level.cibles ?? []).splice(s.index, 1)
      // les portes asservies aux cibles suivantes se décalent d'un cran ;
      // celles de la cible supprimée restent (le contrôle les signalera)
      for (const p of this.level.portes ?? []) {
        if (p.cible > s.index) p.cible--
      }
    }
    else if (s.kind === 'label') this.level.labels.splice(s.index, 1)
    else {
      this.commit('Le sas et le point de départ ne se suppriment pas.')
      return
    }
    this.sel = null
    this.commit('Supprimé.')
  }

  private duplicateSel(): void {
    const s = this.sel
    if (!s) return
    const off = this.grid * 4
    if (s.kind === 'box') {
      const b = this.level.boxes[s.index]
      this.level.boxes.push({ ...b, minX: b.minX + off, maxX: b.maxX + off })
      this.sel = { kind: 'box', index: this.level.boxes.length - 1 }
    } else if (s.kind === 'sponge') {
      const sp = this.level.sponges[s.index]
      this.level.sponges.push({ ...sp, minX: sp.minX + off })
      this.sel = { kind: 'sponge', index: this.level.sponges.length - 1 }
    } else if (s.kind === 'zone') {
      const z = (this.level.zones ?? [])[s.index]
      this.level.zones!.push({ ...z, minX: z.minX + off, maxX: z.maxX + off })
      this.sel = { kind: 'zone', index: this.level.zones!.length - 1 }
    } else if (s.kind === 'label') {
      const l = this.level.labels[s.index]
      this.level.labels.push({ ...l, x: l.x + off })
      this.sel = { kind: 'label', index: this.level.labels.length - 1 }
    } else if (s.kind === 'laser') {
      const l = (this.level.lasers ?? [])[s.index]
      this.level.lasers!.push({ ...l, x: l.x + off })
      this.sel = { kind: 'laser', index: this.level.lasers!.length - 1 }
    } else if (s.kind === 'cible') {
      const t = (this.level.cibles ?? [])[s.index]
      this.level.cibles!.push({ ...t, x: t.x + off })
      this.sel = { kind: 'cible', index: this.level.cibles!.length - 1 }
    } else if (s.kind === 'porte') {
      const q = (this.level.portes ?? [])[s.index]
      this.level.portes!.push({ ...q, minX: q.minX + off, maxX: q.maxX + off })
      this.sel = { kind: 'porte', index: this.level.portes!.length - 1 }
    } else return
    this.commit('Dupliqué (D).')
  }

  private commit(hint: string): void {
    this.hint = hint
    this.persist()
    this.syncProps()
    this.validate()
    this.draw()
  }

  // ——— Interface ————————————————————————————————————————
  private el<T extends HTMLElement>(id: string): T {
    return this.host.querySelector('#' + id) as T
  }

  private setTool(t: Tool): void {
    this.tool = t
    for (const b of Array.from(this.host.querySelectorAll('.ed-tool'))) {
      b.classList.toggle('active', (b as HTMLElement).dataset.tool === this.toolKey(t))
    }
    this.canvas.style.cursor = t.kind === 'select' ? 'default' : 'crosshair'
  }

  private toolKey(t: Tool): string {
    if (t.kind === 'box') return `box:${t.material}`
    if (t.kind === 'zone') return `zone:${t.force}`
    return t.kind
  }

  private bindUi(): void {
    for (const b of Array.from(this.host.querySelectorAll('.ed-tool'))) {
      b.addEventListener('click', () => {
        const key = (b as HTMLElement).dataset.tool ?? 'select'
        if (key.startsWith('box:')) this.setTool({ kind: 'box', material: Number(key.slice(4)) })
        else if (key.startsWith('zone:')) this.setTool({ kind: 'zone', force: key.slice(5) as ZoneForce })
        else if (key === 'sponge') this.setTool({ kind: 'sponge' })
        else if (key === 'spawn') this.setTool({ kind: 'spawn' })
        else if (key === 'exit') this.setTool({ kind: 'exit' })
        else if (key === 'label') this.setTool({ kind: 'label' })
        else if (key === 'laser') this.setTool({ kind: 'laser' })
        else if (key === 'cible') this.setTool({ kind: 'cible' })
        else if (key === 'porte') this.setTool({ kind: 'porte' })
        else this.setTool({ kind: 'select' })
      })
    }

    this.el('ed-snap').addEventListener('change', (e) => {
      this.snap = (e.target as HTMLInputElement).checked
    })
    this.el('ed-grid').addEventListener('change', (e) => {
      this.grid = Math.max(1, Number((e.target as HTMLInputElement).value) || 20)
      this.draw()
    })

    // Choix du lit musical : « suivre la cuve » reste le cas normal — la
    // musique suit alors le refroidissement de la coque, comme partout.
    const selAmb = this.el('ed-ambiance') as HTMLSelectElement
    selAmb.innerHTML =
      '<option value="">Suivre la cuve (refroidissement)</option>' +
      PISTES.map((p) => `<option value="${p}">${PISTE_NOMS[p]}</option>`).join('')
    selAmb.addEventListener('change', () => {
      this.level.ambiance = selAmb.value || undefined
      this.persist()
      this.commit(selAmb.value ? `Musique : ${PISTE_NOMS[selAmb.value as Piste]}.` : 'Musique : celle de la cuve.')
    })

    for (const id of ['ed-name', 'ed-code', 'ed-par', 'ed-journal'] as const) {
      this.el(id).addEventListener('input', () => {
        this.level.name = (this.el('ed-name') as HTMLInputElement).value || 'Sans titre'
        this.level.code = (this.el('ed-code') as HTMLInputElement).value || '21-?'
        this.level.par = Math.max(1, Number((this.el('ed-par') as HTMLInputElement).value) || 3)
        this.level.journal = (this.el('ed-journal') as HTMLTextAreaElement).value
        this.persist()
        this.validate()
      })
    }

    this.el('ed-fit').addEventListener('click', () => {
      this.fitView()
      this.draw()
    })
    this.el('ed-new').addEventListener('click', () => {
      if (!confirm('Repartir d’un tableau vierge ? Le brouillon en cours sera perdu.')) return
      this.level = blankLevel()
      this.openId = ''
      this.sel = null
      this.fitView()
      this.syncForm()
      this.renderLibrary()
      this.commit('Tableau vierge.')
    })
    this.el('ed-save').addEventListener('click', () => void this.store(false))
    this.el('ed-save-as').addEventListener('click', () => void this.store(true))
    this.el('ed-play').addEventListener('click', () => {
      const errs = checkLevel(this.level).filter((v) => v.niveau === 'erreur')
      if (errs.length > 0) {
        this.commit('Corrigez les erreurs avant d’essayer.')
        return
      }
      this.persist()
      this.hooks.play(structuredClone(this.level))
    })
    this.el('ed-quit').addEventListener('click', () => this.hooks.quit())

    this.el('ed-export').addEventListener('click', () => {
      const json = serializeLevel(this.level)
      const blob = new Blob([json], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${this.level.code.replace(/[^\w-]+/g, '_')}-${this.level.name.replace(/[^\w-]+/g, '_')}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      this.commit('Fichier exporté.')
    })
    this.el('ed-copy').addEventListener('click', () => {
      const json = serializeLevel(this.level)
      void navigator.clipboard?.writeText(json).then(
        () => this.commit('JSON copié dans le presse-papier.'),
        () => {
          ;(this.el('ed-json') as HTMLTextAreaElement).value = json
          this.el('ed-io').classList.add('open')
          this.commit('Presse-papier refusé : le JSON est affiché ci-dessous.')
        },
      )
    })
    this.el('ed-import').addEventListener('click', () => {
      this.el('ed-io').classList.toggle('open')
      ;(this.el('ed-json') as HTMLTextAreaElement).value = serializeLevel(this.level)
    })
    this.el('ed-file').addEventListener('change', (e) => {
      const f = (e.target as HTMLInputElement).files?.[0]
      if (!f) return
      void f.text().then((txt) => this.loadJson(txt))
    })
    this.el('ed-load-json').addEventListener('click', () => {
      this.loadJson((this.el('ed-json') as HTMLTextAreaElement).value)
    })
  }

  // ——— Bibliothèque partagée ————————————————————————————
  private async refreshLibrary(): Promise<void> {
    const lib = await fetchLibrary()
    if (lib) {
      this.library = lib
      this.hooks.libraryChanged(lib)
    }
    this.renderLibrary(lib === null)
  }

  private renderLibrary(offline = false): void {
    const host = this.el('ed-lib')
    if (offline) {
      host.innerHTML =
        '<p class="ed-empty">Bibliothèque injoignable (hors ligne ou serveur local). Le brouillon reste conservé sur cet appareil.</p>'
      return
    }
    if (this.library.length === 0) {
      host.innerHTML =
        '<p class="ed-empty">Aucun tableau enregistré. « Enregistrer » publie celui-ci pour tout le monde.</p>'
      return
    }
    host.innerHTML = this.library
      .map((s, i) => {
        const errs = checkLevel(s.level).filter((v) => v.niveau === 'erreur').length
        return (
          `<div class="ed-lib-row${s.id === this.openId ? ' open' : ''}" data-id="${s.id}">` +
          `<span class="ed-lib-no">${i + 1}</span>` +
          `<button type="button" class="ed-lib-open" data-id="${s.id}" title="Ouvrir ce tableau">` +
          `<b>${s.level.code}</b> ${s.level.name}` +
          `<small>${s.auteur ? s.auteur + ' · ' : ''}par ${s.level.par ?? '?'}${errs ? ' · ' + errs + ' erreur(s)' : ''}</small>` +
          `</button>` +
          `<span class="ed-lib-ord">` +
          `<button type="button" data-up="${s.id}" title="Jouer plus tôt"${i === 0 ? ' disabled' : ''}>↑</button>` +
          `<button type="button" data-down="${s.id}" title="Jouer plus tard"${i === this.library.length - 1 ? ' disabled' : ''}>↓</button>` +
          `<button type="button" data-del="${s.id}" title="Supprimer de la bibliothèque">✕</button>` +
          `</span></div>`
        )
      })
      .join('')

    for (const b of Array.from(host.querySelectorAll('.ed-lib-open'))) {
      b.addEventListener('click', () => this.openFromLibrary((b as HTMLElement).dataset.id ?? ''))
    }
    for (const b of Array.from(host.querySelectorAll('[data-up]'))) {
      b.addEventListener('click', () => this.move((b as HTMLElement).dataset.up ?? '', -1))
    }
    for (const b of Array.from(host.querySelectorAll('[data-down]'))) {
      b.addEventListener('click', () => this.move((b as HTMLElement).dataset.down ?? '', 1))
    }
    for (const b of Array.from(host.querySelectorAll('[data-del]'))) {
      b.addEventListener('click', () => void this.removeFromLibrary((b as HTMLElement).dataset.del ?? ''))
    }
  }

  private openFromLibrary(id: string): void {
    const entry = this.library.find((l) => l.id === id)
    if (!entry) return
    this.level = structuredClone(entry.level)
    this.openId = id
    this.sel = null
    this.fitView()
    this.syncForm()
    this.renderLibrary()
    this.commit(`« ${entry.level.name} » ouvert.`)
  }

  private async move(id: string, delta: number): Promise<void> {
    const i = this.library.findIndex((l) => l.id === id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= this.library.length) return
    const next = [...this.library]
    ;[next[i], next[j]] = [next[j], next[i]]
    this.library = next
    this.renderLibrary()
    const saved = await reorderLibrary(next.map((l) => l.id))
    if (saved) {
      this.library = saved
      this.hooks.libraryChanged(saved)
      this.renderLibrary()
      this.commit('Séquence mise à jour.')
    } else {
      this.commit('Réordonnancement refusé : bibliothèque injoignable.')
      void this.refreshLibrary()
    }
  }

  private async removeFromLibrary(id: string): Promise<void> {
    const entry = this.library.find((l) => l.id === id)
    if (!entry) return
    if (!confirm(`Supprimer « ${entry.level.name} » de la bibliothèque ? C’est définitif.`)) return
    const saved = await deleteLevel(id)
    if (saved) {
      this.library = saved
      if (this.openId === id) this.openId = ''
      this.hooks.libraryChanged(saved)
      this.renderLibrary()
      this.commit('Tableau supprimé.')
    } else {
      this.commit('Suppression refusée : bibliothèque injoignable.')
    }
  }

  /** Enregistre dans la bibliothèque ; `asNew` crée une entrée à part. */
  private async store(asNew: boolean): Promise<void> {
    if (this.busy) return
    const errs = checkLevel(this.level).filter((v) => v.niveau === 'erreur')
    if (errs.length > 0) {
      this.commit('Corrigez les erreurs avant d’enregistrer.')
      return
    }
    let id = asNew ? '' : this.openId
    if (asNew) {
      const proposed = prompt(
        'Nom du nouveau tableau dans la bibliothèque :',
        this.level.name,
      )
      if (proposed === null) return
      this.level.name = proposed.trim().slice(0, 60) || this.level.name
      ;(this.el('ed-name') as HTMLInputElement).value = this.level.name
    }
    this.busy = true
    this.commit('Enregistrement…')
    const saved = await saveLevel(this.level, id, this.hooks.operator())
    this.busy = false
    if (!saved) {
      this.commit('Enregistrement refusé : bibliothèque injoignable.')
      return
    }
    this.library = saved
    if (!id) {
      // le serveur a forgé l'identifiant depuis le nom : on retrouve l'entrée
      const match = saved.find((l) => l.level.name === this.level.name)
      id = match?.id ?? ''
    }
    this.openId = id
    this.hooks.libraryChanged(saved)
    this.renderLibrary()
    this.commit('Enregistré dans la bibliothèque.')
  }

  private loadJson(txt: string): void {
    let parsed: unknown
    try {
      parsed = JSON.parse(txt)
    } catch {
      this.commit('JSON illisible : vérifiez les accolades et les virgules.')
      return
    }
    const { level, rejets } = parseLevel(parsed)
    if (!level) {
      this.commit(`Chargement refusé : ${rejets[0] ?? 'document invalide'}`)
      return
    }
    this.level = level
    this.sel = null
    this.fitView()
    this.syncForm()
    this.commit(rejets.length ? `Chargé, ${rejets.length} pièce(s) écartée(s).` : 'Tableau chargé.')
  }

  private syncForm(): void {
    ;(this.el('ed-name') as HTMLInputElement).value = this.level.name
    ;(this.el('ed-code') as HTMLInputElement).value = this.level.code
    ;(this.el('ed-par') as HTMLInputElement).value = String(this.level.par ?? 3)
    ;(this.el('ed-journal') as HTMLTextAreaElement).value = this.level.journal
    ;(this.el('ed-ambiance') as HTMLSelectElement).value = this.level.ambiance ?? ''
    this.syncProps()
    this.validate()
  }

  /** Panneau de propriétés de l'objet sélectionné. */
  private syncProps(): void {
    const host = this.el('ed-props')
    const s = this.sel
    if (!s) {
      host.innerHTML = '<p class="ed-empty">Rien de sélectionné. Cliquez un élément, ou choisissez un outil et glissez pour en tracer un.</p>'
      return
    }
    const rows: string[] = []
    const numField = (label: string, id: string, value: number, step = 10): string =>
      `<label class="ed-f"><span>${label}</span><input type="number" step="${step}" id="${id}" value="${Math.round(value)}" /></label>`

    if (s.kind === 'box') {
      const b = this.level.boxes[s.index]
      rows.push(
        `<label class="ed-f"><span>Matériau</span><select id="p-mat">` +
          [MAT_WALL, MAT_HYDROPHILE, MAT_HYDROPHOBE, MAT_FROID, MAT_GRILLE, MAT_CHAUD]
            .map((m) => `<option value="${m}"${m === b.material ? ' selected' : ''}>${MATERIAL_NAMES[m]}</option>`)
            .join('') +
          `</select></label>`,
      )
      rows.push(numField('X min', 'p-minX', b.minX), numField('X max', 'p-maxX', b.maxX))
      rows.push(numField('Y min', 'p-minY', b.minY), numField('Y max', 'p-maxY', b.maxY))
    } else if (s.kind === 'zone') {
      const z = (this.level.zones ?? [])[s.index]
      rows.push(
        `<label class="ed-f"><span>État imposé</span><select id="p-force">` +
          (['libre', 'eau', 'glace', 'vapeur'] as ZoneForce[])
            .map((f) => `<option value="${f}"${f === z.force ? ' selected' : ''}>${f}</option>`)
            .join('') +
          `</select></label>`,
      )
      rows.push(
        `<label class="ed-f"><span>Cause (le nom du lieu)</span>` +
          `<input id="p-zlabel" placeholder="${ZONE_CAUSES[z.force]}" value="${(z.label ?? '').replace(/"/g, '&quot;')}" /></label>`,
      )
      rows.push(numField('X min', 'p-minX', z.minX), numField('X max', 'p-maxX', z.maxX))
      rows.push(numField('Y min', 'p-minY', z.minY), numField('Y max', 'p-maxY', z.maxY))
    } else if (s.kind === 'sponge') {
      const sp = this.level.sponges[s.index]
      rows.push(numField('X min', 'p-minX', sp.minX), numField('Y min', 'p-minY', sp.minY))
      rows.push(numField('Colonnes', 'p-cols', sp.cols, 1), numField('Rangées', 'p-rows', sp.rows, 1))
      rows.push(numField('Taille de cellule', 'p-cell', sp.cellSize, 2))
      rows.push(numField('Capacité par cellule', 'p-cap', sp.capacityPerCell, 1))
    } else if (s.kind === 'exit') {
      const e = this.level.exit
      rows.push(numField('X min', 'p-minX', e.minX), numField('X max', 'p-maxX', e.maxX))
      rows.push(numField('Y min', 'p-minY', e.minY), numField('Y max', 'p-maxY', e.maxY))
    } else if (s.kind === 'spawn') {
      rows.push(numField('X', 'p-sx', this.level.spawn.x), numField('Y', 'p-sy', this.level.spawn.y))
      rows.push(numField('Particules', 'p-sn', this.level.spawn.n, 50))
    } else if (s.kind === 'laser') {
      const l = (this.level.lasers ?? [])[s.index]
      rows.push(numField('X', 'p-lax', l.x), numField('Y', 'p-lay', l.y))
      rows.push(numField('Angle (°)', 'p-laa', l.angle, 5))
    } else if (s.kind === 'cible') {
      const t = (this.level.cibles ?? [])[s.index]
      rows.push(numField('X', 'p-cx', t.x), numField('Y', 'p-cy', t.y))
      rows.push(numField('Rayon', 'p-cr', t.r, 2))
      rows.push(`<p class="ed-empty">Cible nº ${s.index + 1} — les portes s’y asservissent par ce numéro.</p>`)
    } else if (s.kind === 'porte') {
      const q = (this.level.portes ?? [])[s.index]
      rows.push(numField('Cible asservie (nº)', 'p-pc', q.cible + 1, 1))
      rows.push(numField('X min', 'p-minX', q.minX), numField('X max', 'p-maxX', q.maxX))
      rows.push(numField('Y min', 'p-minY', q.minY), numField('Y max', 'p-maxY', q.maxY))
    } else if (s.kind === 'label') {
      const l = this.level.labels[s.index]
      rows.push(`<label class="ed-f"><span>Texte</span><input id="p-text" value="${l.text.replace(/"/g, '&quot;')}" /></label>`)
      rows.push(
        `<label class="ed-f"><span>Couleur</span><select id="p-tone">` +
          (['mur', 'phile', 'phobe', 'eponge', 'froid', 'grille', 'sas', 'chaud'] as WorldLabel['tone'][])
            .map((t) => `<option value="${t}"${t === l.tone ? ' selected' : ''}>${t}</option>`)
            .join('') +
          `</select></label>`,
      )
      rows.push(numField('X', 'p-lx', l.x), numField('Y', 'p-ly', l.y))
    }

    const kindName =
      s.kind === 'box'
        ? MATERIAL_NAMES[this.level.boxes[s.index].material]
        : s.kind === 'zone'
          ? 'Zone d’état'
          : s.kind === 'sponge'
            ? 'Éponge'
            : s.kind === 'exit'
              ? 'Sas'
              : s.kind === 'spawn'
                ? 'Point de départ'
                : s.kind === 'laser'
                  ? 'Émetteur laser'
                  : s.kind === 'cible'
                    ? `Cible nº ${s.index + 1}`
                    : s.kind === 'porte'
                      ? 'Porte asservie'
                      : 'Étiquette'

    host.innerHTML =
      `<div class="ed-props-head">${kindName}</div><div class="ed-fields">${rows.join('')}</div>` +
      (s.kind === 'exit' || s.kind === 'spawn'
        ? ''
        : `<button type="button" class="ed-danger" id="p-del">Supprimer</button>`)

    host.querySelector('#p-del')?.addEventListener('click', () => this.deleteSel())
    for (const input of Array.from(host.querySelectorAll('input, select'))) {
      input.addEventListener('change', () => this.readProps())
    }
  }

  /** Relit le panneau et applique les valeurs saisies. */
  private readProps(): void {
    const s = this.sel
    if (!s) return
    const val = (id: string): number => {
      const e = this.host.querySelector('#' + id) as HTMLInputElement | null
      return e ? Number(e.value) || 0 : 0
    }
    const text = (id: string): string => {
      const e = this.host.querySelector('#' + id) as HTMLInputElement | HTMLSelectElement | null
      return e ? e.value : ''
    }

    if (s.kind === 'box') {
      const b = this.level.boxes[s.index]
      b.material = Number(text('p-mat'))
      Object.assign(b, this.normalized(val('p-minX'), val('p-minY'), val('p-maxX'), val('p-maxY')))
    } else if (s.kind === 'zone') {
      const z = (this.level.zones ?? [])[s.index]
      z.force = text('p-force') as ZoneForce
      z.label = text('p-zlabel').trim() || undefined
      Object.assign(z, this.normalized(val('p-minX'), val('p-minY'), val('p-maxX'), val('p-maxY')))
    } else if (s.kind === 'sponge') {
      const sp = this.level.sponges[s.index]
      sp.minX = val('p-minX')
      sp.minY = val('p-minY')
      sp.cols = Math.max(1, Math.round(val('p-cols')))
      sp.rows = Math.max(1, Math.round(val('p-rows')))
      sp.cellSize = Math.max(4, val('p-cell'))
      sp.capacityPerCell = Math.max(1, Math.round(val('p-cap')))
    } else if (s.kind === 'exit') {
      Object.assign(
        this.level.exit,
        this.normalized(val('p-minX'), val('p-minY'), val('p-maxX'), val('p-maxY')),
      )
    } else if (s.kind === 'spawn') {
      this.level.spawn.x = val('p-sx')
      this.level.spawn.y = val('p-sy')
      this.level.spawn.n = Math.max(50, Math.min(3000, Math.round(val('p-sn'))))
    } else if (s.kind === 'laser') {
      const l = (this.level.lasers ?? [])[s.index]
      l.x = val('p-lax')
      l.y = val('p-lay')
      l.angle = ((val('p-laa') % 360) + 360) % 360
    } else if (s.kind === 'cible') {
      const t = (this.level.cibles ?? [])[s.index]
      t.x = val('p-cx')
      t.y = val('p-cy')
      t.r = Math.max(8, val('p-cr'))
    } else if (s.kind === 'porte') {
      const q = (this.level.portes ?? [])[s.index]
      q.cible = Math.max(0, Math.round(val('p-pc')) - 1)
      Object.assign(q, this.normalized(val('p-minX'), val('p-minY'), val('p-maxX'), val('p-maxY')))
    } else if (s.kind === 'label') {
      const l = this.level.labels[s.index]
      l.text = text('p-text').toUpperCase().slice(0, 40) || l.text
      l.tone = text('p-tone') as WorldLabel['tone']
      l.x = val('p-lx')
      l.y = val('p-ly')
    }
    this.commit('')
  }

  private normalized(minX: number, minY: number, maxX: number, maxY: number): Rect {
    return {
      minX: Math.min(minX, maxX),
      minY: Math.min(minY, maxY),
      maxX: Math.max(minX, maxX),
      maxY: Math.max(minY, maxY),
    }
  }

  private validate(): void {
    const host = this.el('ed-check')
    const v = checkLevel(this.level)
    if (v.length === 0) {
      host.innerHTML = '<div class="ed-ok">Tableau valide — prêt à essayer.</div>'
      return
    }
    host.innerHTML = v
      .map(
        (x) =>
          `<div class="ed-v ${x.niveau === 'erreur' ? 'err' : 'warn'}">${x.niveau === 'erreur' ? '✕' : '!'} ${x.message}</div>`,
      )
      .join('')
  }

  private showCoords(x: number, y: number): void {
    this.el('ed-coords').textContent = `x ${Math.round(x)} · y ${Math.round(y)}`
  }

  // ——— Dessin ————————————————————————————————————————
  private draw(): void {
    const c = this.canvas
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = c.clientWidth
    const h = c.clientHeight
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr)
      c.height = Math.round(h * dpr)
    }
    const g = this.ctx
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    g.clearRect(0, 0, w, h)
    g.fillStyle = '#060d16'
    g.fillRect(0, 0, w, h)

    const b = this.level.bounds
    const a = this.toScreen(b.minX, b.maxY)
    const d = this.toScreen(b.maxX, b.minY)

    // grille du monde
    if (this.grid * this.zoom > 5) {
      g.strokeStyle = 'rgba(99,183,230,0.07)'
      g.lineWidth = 1
      g.beginPath()
      const step = this.grid * (this.grid * this.zoom < 12 ? 5 : 1)
      for (let x = Math.ceil(b.minX / step) * step; x <= b.maxX; x += step) {
        const p = this.toScreen(x, 0)
        g.moveTo(p.sx, a.sy)
        g.lineTo(p.sx, d.sy)
      }
      for (let y = Math.ceil(b.minY / step) * step; y <= b.maxY; y += step) {
        const p = this.toScreen(0, y)
        g.moveTo(a.sx, p.sy)
        g.lineTo(d.sx, p.sy)
      }
      g.stroke()
    }

    // cuve
    g.strokeStyle = '#2c4560'
    g.lineWidth = 2
    g.strokeRect(a.sx, a.sy, d.sx - a.sx, d.sy - a.sy)

    // zones d'état, sous tout le reste. Le rectangle est l'outil de TRAVAIL
    // (poignées, redimensionnement) ; le rayon d'action RÉEL est la lisière
    // ondulée, dessinée pleine — la même formule que le jeu (zoneOutline).
    for (const z of this.level.zones ?? []) {
      const p = this.toScreen(z.minX, z.maxY)
      const q = this.toScreen(z.maxX, z.minY)
      const col = ZONE_COLORS[z.force]
      // le cadre de travail, discret
      g.strokeStyle = col + '44'
      g.setLineDash([4, 6])
      g.lineWidth = 1
      g.strokeRect(p.sx, p.sy, q.sx - p.sx, q.sy - p.sy)
      g.setLineDash([])
      // l'illustration de la cause, ajustée comme dans le jeu (contain,
      // centrée, marge 6 %) — on voit dans l'éditeur ce que verra le joueur
      const ta = z.force === 'eau' ? 1.5 : z.force === 'glace' ? 0.667 : z.force === 'vapeur' ? 1.0 : 0
      if (ta > 0) {
        const name =
          z.force === 'eau' ? 'zone-buses' : z.force === 'glace' ? 'zone-hublot' : 'zone-conduite'
        const im = this.img(name)
        if (im) {
          const zw = (z.maxX - z.minX) * 0.94
          const zhh = (z.maxY - z.minY) * 0.94
          const sc = Math.min(zw / ta, zhh)
          const fw = ta * sc
          const fh = sc
          const cx = (z.minX + z.maxX) / 2
          const cy = (z.minY + z.maxY) / 2
          const ip = this.toScreen(cx - fw / 2, cy + fh / 2)
          g.globalAlpha = 0.8
          g.drawImage(im, ip.sx, ip.sy, fw * this.zoom, fh * this.zoom)
          g.globalAlpha = 1
        }
      }
      // la lisière réelle
      const pts = zoneOutline(z, 64)
      g.beginPath()
      for (let i = 0; i < pts.length; i++) {
        const sp = this.toScreen(pts[i].x, pts[i].y)
        if (i === 0) g.moveTo(sp.sx, sp.sy)
        else g.lineTo(sp.sx, sp.sy)
      }
      g.closePath()
      g.fillStyle = col + '26'
      g.fill()
      g.strokeStyle = col + 'bb'
      g.lineWidth = 1.5
      g.stroke()
      g.fillStyle = col
      g.font = '600 11px ui-monospace, monospace'
      g.fillText(`${zoneName(z)} · ${z.force.toUpperCase()}`, p.sx + 6, p.sy + 15)
    }

    // éponges
    for (const sp of this.level.sponges) {
      const p = this.toScreen(sp.minX, sp.minY + sp.rows * sp.cellSize)
      const q = this.toScreen(sp.minX + sp.cols * sp.cellSize, sp.minY)
      g.fillStyle = 'rgba(215,173,85,0.30)'
      g.fillRect(p.sx, p.sy, q.sx - p.sx, q.sy - p.sy)
      g.strokeStyle = '#d7ad55'
      g.lineWidth = 1
      g.strokeRect(p.sx, p.sy, q.sx - p.sx, q.sy - p.sy)
      if (sp.cellSize * this.zoom > 6) {
        g.strokeStyle = 'rgba(215,173,85,0.35)'
        g.beginPath()
        for (let i = 1; i < sp.cols; i++) {
          const x = this.toScreen(sp.minX + i * sp.cellSize, 0).sx
          g.moveTo(x, p.sy)
          g.lineTo(x, q.sy)
        }
        for (let j = 1; j < sp.rows; j++) {
          const y = this.toScreen(0, sp.minY + j * sp.cellSize).sy
          g.moveTo(p.sx, y)
          g.lineTo(q.sx, y)
        }
        g.stroke()
      }
    }

    // Zones d'effet des surfaces : la portée RÉELLE des auras, aux réglages
    // par défaut du banc. Le contour iso-distance d'un rectangle est un
    // rectangle arrondi de rayon = portée — c'est exactement ce qu'on trace.
    // La plaque froide montre AUSSI sa portée à froid complet (pointillé
    // long) : le refroidissement du vaisseau étend son emprise en cours de
    // partie. Le radiateur, lui, rétrécit à froid (pointillé court).
    const P = DEFAULT_PARAMS
    for (const box of this.level.boxes) {
      let band = 0
      let colA = ''
      if (box.material === MAT_FROID) {
        band = P.coldBand
        colA = '#8fc8ee'
      } else if (box.material === MAT_CHAUD) {
        band = P.heatBand
        colA = '#ff8a3c'
      } else if (box.material === MAT_HYDROPHILE) {
        band = P.hydroBand
        colA = '#2ec6c9'
      } else if (box.material === MAT_HYDROPHOBE) {
        band = P.hydroBand
        colA = '#a878e8'
      }
      if (band <= 0) continue
      const aura = (portee: number, alphaFill: string, alphaLine: string, dash: number[]): void => {
        const p = this.toScreen(box.minX - portee, box.maxY + portee)
        const q = this.toScreen(box.maxX + portee, box.minY - portee)
        const r = Math.min(portee * this.zoom, (q.sx - p.sx) / 2, (q.sy - p.sy) / 2)
        g.beginPath()
        g.roundRect(p.sx, p.sy, q.sx - p.sx, q.sy - p.sy, Math.max(0, r))
        if (alphaFill) {
          g.fillStyle = colA + alphaFill
          g.fill()
        }
        g.strokeStyle = colA + alphaLine
        g.setLineDash(dash)
        g.lineWidth = 1
        g.stroke()
        g.setLineDash([])
      }
      aura(band, '10', '55', [5, 4])
      if (box.material === MAT_FROID) aura(band * (1 + P.chillColdGrowth), '', '2e', [2, 7])
      if (box.material === MAT_CHAUD) aura(band * (1 - P.chillHeatFade), '', '2e', [2, 7])
    }

    // surfaces
    for (const box of this.level.boxes) {
      const p = this.toScreen(box.minX, box.maxY)
      const q = this.toScreen(box.maxX, box.minY)
      const col = MAT_COLORS[box.material] ?? '#888'
      g.fillStyle = col + '55'
      g.fillRect(p.sx, p.sy, q.sx - p.sx, q.sy - p.sy)
      g.strokeStyle = col
      g.lineWidth = 1.5
      g.strokeRect(p.sx, p.sy, q.sx - p.sx, q.sy - p.sy)
    }

    // sas
    {
      const e = this.level.exit
      const p = this.toScreen(e.minX, e.maxY)
      const q = this.toScreen(e.maxX, e.minY)
      g.fillStyle = 'rgba(53,224,164,0.22)'
      g.fillRect(p.sx, p.sy, q.sx - p.sx, q.sy - p.sy)
      g.strokeStyle = '#35e0a4'
      g.lineWidth = 2
      g.strokeRect(p.sx, p.sy, q.sx - p.sx, q.sy - p.sy)
      g.fillStyle = '#35e0a4'
      g.font = '600 11px ui-monospace, monospace'
      g.fillText('SAS', p.sx + 5, p.sy + 14)
      // le rayon d'aspiration : la vraie portée du courant qui hale l'eau
      // (et la glace) vers la bouche — réglage par défaut du banc
      const mx = (e.minX + e.maxX) / 2
      const my = (e.minY + e.maxY) / 2
      const m = this.toScreen(mx, my)
      g.strokeStyle = 'rgba(53,224,164,0.35)'
      g.setLineDash([6, 5])
      g.lineWidth = 1
      g.beginPath()
      g.arc(m.sx, m.sy, DEFAULT_PARAMS.exitRadius * this.zoom, 0, Math.PI * 2)
      g.stroke()
      g.setLineDash([])
      g.fillStyle = 'rgba(53,224,164,0.55)'
      g.font = '600 9px ui-monospace, monospace'
      g.fillText('ASPIRATION', m.sx - 28, m.sy - DEFAULT_PARAMS.exitRadius * this.zoom - 4)
    }

    // décals (tuyaux, vannes) : du décor pur, dessiné comme dans la cuve —
    // un tableau chargé avec ses décals se relit fidèlement ici
    for (const dcl of this.level.decals ?? []) {
      const im = this.img(`decal-${dcl.kind}`)
      if (!im) continue
      const dp = this.toScreen(dcl.x - dcl.w / 2, dcl.y + dcl.h / 2)
      const dw = dcl.w * this.zoom
      const dh = dcl.h * this.zoom
      g.save()
      g.globalAlpha = dcl.fade ?? 0.55
      if (dcl.flip) {
        g.translate(dp.sx + dw, dp.sy)
        g.scale(-1, 1)
        g.drawImage(im, 0, 0, dw, dh)
      } else {
        g.drawImage(im, dp.sx, dp.sy, dw, dh)
      }
      g.restore()
    }

    // ---- Mécanismes laser : portes, cibles, émetteurs, et l'APERÇU du
    // faisceau — le même traceur que le jeu (sans miroir de glace : il n'y a
    // pas de corps ici, le rayon file droit et montre le trajet à vide).
    const portes = this.level.portes ?? []
    const cibles = this.level.cibles ?? []
    const lasers = this.level.lasers ?? []
    for (let i = 0; i < portes.length; i++) {
      const q = portes[i]
      const p = this.toScreen(q.minX, q.maxY)
      const r = this.toScreen(q.maxX, q.minY)
      g.fillStyle = 'rgba(255,90,90,0.16)'
      g.fillRect(p.sx, p.sy, r.sx - p.sx, r.sy - p.sy)
      g.strokeStyle = '#ff5a5a'
      g.lineWidth = 1.5
      g.strokeRect(p.sx, p.sy, r.sx - p.sx, r.sy - p.sy)
      g.fillStyle = '#ff9a8a'
      g.font = '600 10px ui-monospace, monospace'
      g.fillText(`PORTE → CIBLE ${q.cible + 1}`, p.sx + 4, p.sy - 4)
    }
    // l'aperçu des faisceaux d'abord : les pastilles se dessinent par-dessus
    const touchees = new Set<number>()
    for (const em of lasers) {
      const t = traceLaser(em, {
        bounds: this.level.bounds,
        boxes: this.level.boxes,
        portesFermees: portes,
        cibles,
        iceNormal: null,
      })
      for (const c of t.touchees) touchees.add(c)
      g.strokeStyle = 'rgba(255,90,70,0.8)'
      g.lineWidth = 1.5
      g.setLineDash([8, 6])
      g.beginPath()
      const p0 = this.toScreen(t.points[0].x, t.points[0].y)
      g.moveTo(p0.sx, p0.sy)
      for (let k = 1; k < t.points.length; k++) {
        const pk = this.toScreen(t.points[k].x, t.points[k].y)
        g.lineTo(pk.sx, pk.sy)
      }
      g.stroke()
      g.setLineDash([])
    }
    for (let i = 0; i < cibles.length; i++) {
      const t = cibles[i]
      const p = this.toScreen(t.x, t.y)
      const rr = Math.max(5, t.r * this.zoom)
      g.beginPath()
      g.arc(p.sx, p.sy, rr, 0, Math.PI * 2)
      g.fillStyle = touchees.has(i) ? 'rgba(110,255,185,0.30)' : 'rgba(48,64,76,0.7)'
      g.fill()
      g.strokeStyle = touchees.has(i) ? '#6dffb8' : '#7b93a8'
      g.lineWidth = 2
      g.stroke()
      g.fillStyle = touchees.has(i) ? '#0c1a14' : '#cfe2ef'
      g.font = '700 10px ui-monospace, monospace'
      g.fillText(String(i + 1), p.sx - 3, p.sy + 3.5)
    }
    for (const em of lasers) {
      const p = this.toScreen(em.x, em.y)
      const a = (-em.angle * Math.PI) / 180
      g.save()
      g.translate(p.sx, p.sy)
      g.rotate(a)
      const L = Math.max(9, 15 * this.zoom)
      g.fillStyle = '#2a3742'
      g.strokeStyle = '#ff8a70'
      g.lineWidth = 1.5
      g.beginPath()
      g.roundRect(-L, -L * 0.45, L * 1.7, L * 0.9, L * 0.2)
      g.fill()
      g.stroke()
      g.fillStyle = '#ff6a5a'
      g.beginPath()
      g.arc(L * 0.7, 0, Math.max(2.5, L * 0.22), 0, Math.PI * 2)
      g.fill()
      g.restore()
    }

    // départ
    {
      const s = this.toScreen(this.level.spawn.x, this.level.spawn.y)
      const r = Math.max(6, 40 * this.zoom)
      g.strokeStyle = '#63b7e6'
      g.lineWidth = 2
      g.beginPath()
      g.arc(s.sx, s.sy, r, 0, Math.PI * 2)
      g.stroke()
      g.fillStyle = 'rgba(99,183,230,0.25)'
      g.fill()
      g.fillStyle = '#63b7e6'
      g.font = '600 11px ui-monospace, monospace'
      g.fillText('DÉPART', s.sx + r + 4, s.sy + 4)
    }

    // étiquettes
    g.font = '600 11px ui-monospace, monospace'
    for (const l of this.level.labels) {
      const p = this.toScreen(l.x, l.y)
      g.fillStyle = '#a9c0d2'
      g.fillText(l.text, p.sx - g.measureText(l.text).width / 2, p.sy + 4)
    }

    // rectangle en cours de tracé
    if (this.drag?.mode === 'create') {
      const p = this.toScreen(Math.min(this.drag.x0, this.drag.x1), Math.max(this.drag.y0, this.drag.y1))
      const q = this.toScreen(Math.max(this.drag.x0, this.drag.x1), Math.min(this.drag.y0, this.drag.y1))
      g.setLineDash([5, 4])
      g.strokeStyle = '#ffffff'
      g.lineWidth = 1
      g.strokeRect(p.sx, p.sy, q.sx - p.sx, q.sy - p.sy)
      g.setLineDash([])
    }

    // sélection et poignées
    const r = this.selRect()
    if (r) {
      const p = this.toScreen(r.minX, r.maxY)
      const q = this.toScreen(r.maxX, r.minY)
      g.strokeStyle = '#ffffff'
      g.lineWidth = 1.5
      g.setLineDash([4, 3])
      g.strokeRect(p.sx, p.sy, q.sx - p.sx, q.sy - p.sy)
      g.setLineDash([])
      g.fillStyle = '#ffffff'
      for (const [hx, hy] of [
        [p.sx, p.sy],
        [q.sx, p.sy],
        [p.sx, q.sy],
        [q.sx, q.sy],
      ]) {
        g.fillRect(hx - 4, hy - 4, 8, 8)
      }
      g.fillStyle = '#a9c0d2'
      g.font = '11px ui-monospace, monospace'
      g.fillText(`${Math.round(r.maxX - r.minX)} × ${Math.round(r.maxY - r.minY)}`, p.sx, q.sy + 15)
    } else if (this.sel?.kind === 'label' || this.sel?.kind === 'spawn') {
      const pt =
        this.sel.kind === 'label'
          ? this.level.labels[this.sel.index]
          : { x: this.level.spawn.x, y: this.level.spawn.y }
      const s = this.toScreen(pt.x, pt.y)
      g.strokeStyle = '#ffffff'
      g.setLineDash([4, 3])
      g.strokeRect(s.sx - 26, s.sy - 12, 52, 24)
      g.setLineDash([])
    }

    this.el('ed-hint').textContent = this.hint
  }
}
