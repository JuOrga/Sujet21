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
  MAT_MEMBRANE,
  MAT_RIDEAU,
  MAT_SURCHAUFFEUR,
  dansBoite,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_WALL,
  TABLEAU_1BIS,
  TABLEAUX,
  TABLEAUX_ECOLE,
  ZONE_CAUSES,
  subtractBoxOblique,
  zoneName,
  zoneOutline,
  type LevelDef,
  type ObstacleBox,
  type SpongeDef,
  type WorldLabel,
  type ZoneForce,
} from '../game/level'
import { checkLevel, parseLevel, serializeLevel } from '../game/levelIO'
import { traceLaser } from '../game/laser'
import { DEFAULT_PARAMS, type SimParams } from '../sim/params'
import { PISTES, PISTE_NOMS, type Piste } from '../game/soundtrack'
import {
  deleteLevel,
  fetchLibrary,
  reorderLibrary,
  saveLevel,
  type StoredLevel,
} from '../game/netLevels'

const STORE_KEY = 'projet21.editeur.v1'
// À côté du brouillon : le LIEN avec la bibliothèque — quelle entrée est
// ouverte (openId) et le contenu qu'elle avait à la dernière synchro (base).
// C'est ce qui permet, à l'ouverture, de détecter qu'un autre appareil a
// enregistré une version plus récente du même tableau.
const META_KEY = 'projet21.editeur.meta.v1'

// Couleurs des matériaux : celles de la légende du jeu, pour qu'on reconnaisse
// une surface d'un écran à l'autre.
const MAT_COLORS: Record<number, string> = {
  [MAT_WALL]: '#4a6b80',
  [MAT_HYDROPHILE]: '#2ec6c9',
  [MAT_HYDROPHOBE]: '#a878e8',
  [MAT_FROID]: '#8fc8ee',
  [MAT_GRILLE]: '#8fb0c6',
  [MAT_CHAUD]: '#ff8a3c',
  [MAT_MEMBRANE]: '#35c9a0',
  [MAT_RIDEAU]: '#9fb9d8',
  [MAT_SURCHAUFFEUR]: '#29d8ff',
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
  | { kind: 'rail' }
  | { kind: 'cut' }

type Sel =
  | { kind: 'box'; index: number }
  | { kind: 'sponge'; index: number }
  | { kind: 'zone'; index: number }
  | { kind: 'label'; index: number }
  | { kind: 'laser'; index: number }
  | { kind: 'cible'; index: number }
  | { kind: 'porte'; index: number }
  | { kind: 'rail'; index: number }
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
  /** Les paramètres VIFS du banc de réglage — pas les défauts figés. Les
   * portées dessinées (aspiration du sas, auras, rails) suivent ainsi la
   * valeur renseignée, en direct. Absent : les défauts font l'affaire. */
  params?(): SimParams
}

/** Distance d'un point au segment [a, b] — pour attraper un rail au clic. */
function distSeg(
  x: number,
  y: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby
  const t = len2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / len2))
  return Math.hypot(x - (a.x + abx * t), y - (a.y + aby * t))
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
    | { mode: 'move'; ox: number; oy: number; start: Rect; pts?: { x: number; y: number }[] }
    | { mode: 'multimove'; ox: number; oy: number; prevDx: number; prevDy: number }
    | { mode: 'aim'; index: number }
    | { mode: 'railpt'; index: number; point: number }
    // pivot : le coin OPPOSÉ d'une boîte oblique — il reste cloué au monde,
    // le redimensionnement se calcule dans le repère local de la boîte
    | { mode: 'resize'; edge: string; start: Rect; pivot?: { x: number; y: number; angle: number } }
    | { mode: 'rotate'; index: number } = null

  // Sélection MULTIPLE (Maj + clic) : déplacée d'un bloc, supprimée d'un
  // coup, ou passée aux outils d'alignement du panneau.
  private multi: Sel[] = []

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
  // le contenu de l'entrée ouverte à la DERNIÈRE synchro (ouverture depuis
  // la séquence, ou enregistrement) : si le brouillon lui est identique,
  // c'est qu'aucun travail local n'attend — la bibliothèque peut rattraper
  private base = ''
  private busy = false

  constructor(host: HTMLElement, hooks: EditorHooks) {
    this.host = host
    this.hooks = hooks
    this.canvas = host.querySelector('#ed-canvas') as HTMLCanvasElement
    this.ctx = this.canvas.getContext('2d')!
    this.bindUi()
    this.bindCanvas()
    this.restore()
    this.lastSnap = serializeLevel(this.level)
    this.majBoutonsHistoire()
    void this.refreshLibrary()
  }

  // ——— Annuler / Rétablir (Ctrl+Z / Ctrl+Y) ————————————————
  // L'historique retient des instantanés JSON du tableau : chaque commit qui
  // CHANGE le tableau en pousse un (les messages sans changement ne comptent
  // pas). Annuler remonte, rétablir redescend — toute action nouvelle coupe
  // la branche du futur, comme partout ailleurs.
  private past: string[] = []
  private future: string[] = []
  private lastSnap = ''

  private histoire(): void {
    const snap = serializeLevel(this.level)
    if (snap === this.lastSnap) return
    this.past.push(this.lastSnap)
    if (this.past.length > 100) this.past.shift()
    this.future.length = 0
    this.lastSnap = snap
    this.majBoutonsHistoire()
  }

  private undo(): void {
    const snap = this.past.pop()
    if (snap === undefined) {
      this.status('Rien à annuler.')
      return
    }
    this.future.push(this.lastSnap)
    this.appliqueSnap(snap, 'Annulé.')
  }

  private redo(): void {
    const snap = this.future.pop()
    if (snap === undefined) {
      this.status('Rien à rétablir.')
      return
    }
    this.past.push(this.lastSnap)
    this.appliqueSnap(snap, 'Rétabli.')
  }

  private appliqueSnap(snap: string, msg: string): void {
    const { level } = parseLevel(JSON.parse(snap))
    if (!level) return // un instantané vient de serializeLevel : toujours lisible
    this.level = level
    this.lastSnap = snap
    this.sel = null
    this.multi = []
    this.cutWinner = null
    this.persist()
    this.syncForm()
    this.majBoutonsHistoire()
    this.hint = msg
    this.draw()
  }

  private majBoutonsHistoire(): void {
    const u = this.host.querySelector('#ed-undo') as HTMLButtonElement | null
    const r = this.host.querySelector('#ed-redo') as HTMLButtonElement | null
    if (u) u.disabled = this.past.length === 0
    if (r) r.disabled = this.future.length === 0
  }

  // ——— Ouverture / fermeture ———————————————————————————————
  open(level?: LevelDef): void {
    if (level) {
      this.level = structuredClone(level)
      this.histoire() // l'ouverture remplace le brouillon : elle s'annule aussi
    }
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
      localStorage.setItem(META_KEY, JSON.stringify({ openId: this.openId, base: this.base }))
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
      const meta = JSON.parse(localStorage.getItem(META_KEY) ?? '{}') as {
        openId?: string
        base?: string
      }
      this.openId = typeof meta.openId === 'string' ? meta.openId : ''
      this.base = typeof meta.base === 'string' ? meta.base : ''
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

  // ——— Sélection multiple : géométrie générique par élément ————————
  private sameSel(a: Sel, b: Sel): boolean {
    if (!a || !b || a.kind !== b.kind) return false
    const ia = 'index' in a ? a.index : -1
    const ib = 'index' in b ? b.index : -1
    return ia === ib
  }

  /** Boîte englobante (monde) de n'importe quel élément sélectionnable. */
  private boundsOf(s: Sel): Rect | null {
    if (!s) return null
    if (s.kind === 'spawn') {
      const p = this.level.spawn
      return { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y }
    }
    if (s.kind === 'laser') {
      const l = (this.level.lasers ?? [])[s.index]
      return l ? { minX: l.x, minY: l.y, maxX: l.x, maxY: l.y } : null
    }
    if (s.kind === 'cible') {
      const t = (this.level.cibles ?? [])[s.index]
      return t ? { minX: t.x - t.r, minY: t.y - t.r, maxX: t.x + t.r, maxY: t.y + t.r } : null
    }
    if (s.kind === 'label') {
      const l = this.level.labels[s.index]
      return l ? { minX: l.x, minY: l.y, maxX: l.x, maxY: l.y } : null
    }
    if (s.kind === 'rail') {
      const r = (this.level.rails ?? [])[s.index]
      if (!r) return null
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const p of r.points) {
        minX = Math.min(minX, p.x)
        minY = Math.min(minY, p.y)
        maxX = Math.max(maxX, p.x)
        maxY = Math.max(maxY, p.y)
      }
      return { minX, minY, maxX, maxY }
    }
    const garde = this.sel
    this.sel = s
    const r = this.selRect()
    this.sel = garde
    return r
  }

  /** Translate n'importe quel élément de (dx, dy) — la brique des outils
   * de groupe : déplacement multiple et alignement. */
  private moveSelBy(s: Sel, dx: number, dy: number): void {
    if (!s || (dx === 0 && dy === 0)) return
    if (s.kind === 'spawn') {
      this.level.spawn.x += dx
      this.level.spawn.y += dy
    } else if (s.kind === 'laser') {
      const l = (this.level.lasers ?? [])[s.index]
      if (l) {
        l.x += dx
        l.y += dy
      }
    } else if (s.kind === 'cible') {
      const t = (this.level.cibles ?? [])[s.index]
      if (t) {
        t.x += dx
        t.y += dy
      }
    } else if (s.kind === 'label') {
      const l = this.level.labels[s.index]
      if (l) {
        l.x += dx
        l.y += dy
      }
    } else if (s.kind === 'rail') {
      const r = (this.level.rails ?? [])[s.index]
      for (const p of r?.points ?? []) {
        p.x += dx
        p.y += dy
      }
    } else if (s.kind === 'sponge') {
      const sp = this.level.sponges[s.index]
      if (sp) {
        sp.minX += dx
        sp.minY += dy
      }
    } else {
      const garde = this.sel
      this.sel = s
      const r = this.selRect()
      if (r) this.applyRect({ minX: r.minX + dx, minY: r.minY + dy, maxX: r.maxX + dx, maxY: r.maxY + dy })
      this.sel = garde
    }
  }

  /** Aligne les éléments de la sélection multiple sur un même bord. */
  // Même largeur / hauteur : la PREMIÈRE boîte sélectionnée donne la
  // mesure, les autres l'adoptent autour de leur centre (façon Canva).
  private memeDimension(quoi: 'largeur' | 'hauteur'): void {
    const boites = this.multi.filter((m) => m?.kind === 'box') as { kind: 'box'; index: number }[]
    if (boites.length < 2) {
      this.status('Même dimension : sélectionnez au moins deux parois (Maj + clic).')
      return
    }
    const ref = this.level.boxes[boites[0].index]
    const mesure = quoi === 'largeur' ? ref.maxX - ref.minX : ref.maxY - ref.minY
    for (const m of boites.slice(1)) {
      const b = this.level.boxes[m.index]
      if (quoi === 'largeur') {
        const c = (b.minX + b.maxX) / 2
        b.minX = c - mesure / 2
        b.maxX = c + mesure / 2
      } else {
        const c = (b.minY + b.maxY) / 2
        b.minY = c - mesure / 2
        b.maxY = c + mesure / 2
      }
    }
    this.commit(
      `${boites.length - 1} paroi${boites.length > 2 ? 's' : ''} à la même ${quoi} que la première (${Math.round(mesure)} u).`,
    )
  }

  private alignMulti(op: 'gauche' | 'droite' | 'haut' | 'bas' | 'centreH' | 'centreV'): void {
    const items = this.multi
      .map((m) => ({ m, b: this.boundsOf(m) }))
      .filter((x): x is { m: Sel; b: Rect } => x.b !== null)
    if (items.length < 2) return
    const minX = Math.min(...items.map((x) => x.b.minX))
    const maxX = Math.max(...items.map((x) => x.b.maxX))
    const minY = Math.min(...items.map((x) => x.b.minY))
    const maxY = Math.max(...items.map((x) => x.b.maxY))
    for (const { m, b } of items) {
      if (op === 'gauche') this.moveSelBy(m, minX - b.minX, 0)
      else if (op === 'droite') this.moveSelBy(m, maxX - b.maxX, 0)
      else if (op === 'bas') this.moveSelBy(m, 0, minY - b.minY)
      else if (op === 'haut') this.moveSelBy(m, 0, maxY - b.maxY)
      else if (op === 'centreH') this.moveSelBy(m, (minX + maxX) / 2 - (b.minX + b.maxX) / 2, 0)
      else this.moveSelBy(m, 0, (minY + maxY) / 2 - (b.minY + b.maxY) / 2)
    }
    this.commit('Alignés.')
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
    const rails = this.level.rails ?? []
    const tol = Math.max(10, 12 / this.zoom)
    for (let i = rails.length - 1; i >= 0; i--) {
      const pts = rails[i].points
      for (let k = 0; k + 1 < pts.length; k++) {
        if (distSeg(x, y, pts[k], pts[k + 1]) < tol) return { kind: 'rail', index: i }
      }
    }
    const sr = 70
    if (Math.hypot(this.level.spawn.x - x, this.level.spawn.y - y) < sr) return { kind: 'spawn' }
    if (inside(this.level.exit)) return { kind: 'exit' }
    for (let i = this.level.boxes.length - 1; i >= 0; i--) {
      if (dansBoite(this.level.boxes[i], x, y)) return { kind: 'box', index: i }
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
  // Découpe par chevauchement : la paroi cliquée en premier PREND LE DESSUS
  private cutWinner: number | null = null
  // Guides magnétiques pendant un déplacement (façon Canva)
  private guides: { axe: 'v' | 'h'; pos: number }[] = []

  // Aimante un rectangle en mouvement sur les bords et centres des autres
  // éléments (parois, sas) — et retourne les repères à dessiner. Façon
  // Canva : qu'ils se touchent ou non, les alignements se proposent.
  private aimant(r: Rect): { rect: Rect; guides: { axe: 'v' | 'h'; pos: number }[] } {
    const TH = 8 / this.zoom
    const cibles: Rect[] = []
    this.level.boxes.forEach((b, i) => {
      if (this.sel?.kind === 'box' && this.sel.index === i) return
      if (this.multi.some((m) => m?.kind === 'box' && m.index === i)) return
      if (b.angle) return // les obliques ne proposent pas leurs bords droits
      cibles.push(b)
    })
    cibles.push(this.level.exit)
    const cand = (t: Rect, axe: 'v' | 'h'): number[] =>
      axe === 'v' ? [t.minX, t.maxX, (t.minX + t.maxX) / 2] : [t.minY, t.maxY, (t.minY + t.maxY) / 2]
    const propre = { v: [r.minX, r.maxX, (r.minX + r.maxX) / 2], h: [r.minY, r.maxY, (r.minY + r.maxY) / 2] }
    let dx = 0
    let dy = 0
    let bestX = TH
    let bestY = TH
    const guides: { axe: 'v' | 'h'; pos: number }[] = []
    let gX: number | null = null
    let gY: number | null = null
    for (const t of cibles) {
      for (const c of cand(t, 'v')) {
        for (const p of propre.v) {
          const d = Math.abs(c - p)
          if (d < bestX) {
            bestX = d
            dx = c - p
            gX = c
          }
        }
      }
      for (const c of cand(t, 'h')) {
        for (const p of propre.h) {
          const d = Math.abs(c - p)
          if (d < bestY) {
            bestY = d
            dy = c - p
            gY = c
          }
        }
      }
    }
    if (gX !== null) guides.push({ axe: 'v', pos: gX })
    if (gY !== null) guides.push({ axe: 'h', pos: gY })
    return {
      rect: { minX: r.minX + dx, minY: r.minY + dy, maxX: r.maxX + dx, maxY: r.maxY + dy },
      guides,
    }
  }

  // La poignée de ROTATION d'une boîte sélectionnée : au bout d'un bras qui
  // part du milieu du bord haut, DANS LE REPÈRE DE LA BOÎTE — elle tourne
  // avec elle, on sait toujours où la reprendre.
  private rotateHandlePos(): { sx: number; sy: number } | null {
    if (this.sel?.kind !== 'box') return null
    const b = this.level.boxes[this.sel.index]
    if (!b) return null
    const cx = (b.minX + b.maxX) / 2
    const cy = (b.minY + b.maxY) / 2
    const rad = ((b.angle ?? 0) * Math.PI) / 180
    const bras = (b.maxY - b.minY) / 2 + 30 / this.zoom
    return this.toScreen(cx - Math.sin(rad) * bras, cy + Math.cos(rad) * bras)
  }

  private hitRotateHandle(sx: number, sy: number): boolean {
    const h = this.rotateHandlePos()
    if (!h) return false
    return Math.hypot(sx - h.sx, sy - h.sy) <= HANDLE_PX + 2
  }

  /** Le coin (ox, oy) d'une boîte oblique, en coordonnées MONDE — offsets
   * dans le repère local (±demi-largeur, ±demi-hauteur). */
  private coinOblique(b: ObstacleBox, ox: number, oy: number): { x: number; y: number } {
    const rad = ((b.angle ?? 0) * Math.PI) / 180
    const co = Math.cos(rad)
    const si = Math.sin(rad)
    const cx = (b.minX + b.maxX) / 2
    const cy = (b.minY + b.maxY) / 2
    return { x: cx + co * ox - si * oy, y: cy + si * ox + co * oy }
  }

  // Les 4 coins d'une boîte oblique, code + offsets locaux : N = +y, E = +x
  private static readonly COINS: [string, number, number][] = [
    ['NW', -1, 1],
    ['NE', 1, 1],
    ['SW', -1, -1],
    ['SE', 1, -1],
  ]

  private hitHandle(sx: number, sy: number): string | null {
    const r = this.selRect()
    if (!r) return null
    // une boîte OBLIQUE se redimensionne par ses 4 coins PIVOTÉS : le coin
    // opposé reste cloué, tout se joue dans le repère de la boîte
    if (this.sel?.kind === 'box' && this.level.boxes[this.sel.index]?.angle) {
      const b = this.level.boxes[this.sel.index]
      const hx = (b.maxX - b.minX) / 2
      const hy = (b.maxY - b.minY) / 2
      for (const [code, ux, uy] of LevelEditor.COINS) {
        const c = this.coinOblique(b, ux * hx, uy * hy)
        const p = this.toScreen(c.x, c.y)
        if (Math.hypot(sx - p.sx, sy - p.sy) <= HANDLE_PX) return code
      }
      return null
    }
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
        // Maj + clic : la sélection MULTIPLE — on ajoute ou retire l'élément
        if (e.shiftKey) {
          const hit = this.pick(w.x, w.y)
          if (hit) {
            if (this.multi.length === 0 && this.sel && !this.sameSel(this.sel, hit)) {
              this.multi = [this.sel]
            }
            const deja = this.multi.findIndex((m) => this.sameSel(m, hit))
            if (deja >= 0) this.multi.splice(deja, 1)
            else this.multi.push(hit)
            this.sel = this.multi[this.multi.length - 1] ?? null
            this.syncProps()
            this.draw()
          }
          return
        }
        // clic sur un élément déjà dans la sélection multiple : tout se déplace
        if (this.multi.length > 1) {
          const hit = this.pick(w.x, w.y)
          if (hit && this.multi.some((m) => this.sameSel(m, hit))) {
            this.drag = { mode: 'multimove', ox: w.x, oy: w.y, prevDx: 0, prevDy: 0 }
            return
          }
          this.multi = []
        }
        // la poignée de rotation prime : elle vit hors du rectangle, aucun
        // conflit avec les poignées d'angle
        if (this.sel?.kind === 'box' && this.hitRotateHandle(sx, sy)) {
          this.drag = { mode: 'rotate', index: this.sel.index }
          return
        }
        const edge = this.hitHandle(sx, sy)
        if (edge) {
          const r = this.selRect()
          if (r) {
            // boîte oblique : on cloue le coin OPPOSÉ à celui qu'on saisit
            let pivot: { x: number; y: number; angle: number } | undefined
            if (this.sel?.kind === 'box') {
              const b = this.level.boxes[this.sel.index]
              if (b?.angle) {
                const coin = LevelEditor.COINS.find(([code]) => code === edge)
                if (coin) {
                  const hx = (b.maxX - b.minX) / 2
                  const hy = (b.maxY - b.minY) / 2
                  const p = this.coinOblique(b, -coin[1] * hx, -coin[2] * hy)
                  pivot = { x: p.x, y: p.y, angle: b.angle }
                }
              }
            }
            this.drag = { mode: 'resize', edge, start: { ...r }, pivot }
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
          } else if (hit.kind === 'rail') {
            const r = (this.level.rails ?? [])[hit.index]
            this.drag = {
              mode: 'move',
              ox: w.x,
              oy: w.y,
              start: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
              pts: r.points.map((p) => ({ ...p })),
            }
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

      // DÉCOUPE par chevauchement : cliquer la paroi qui PREND LE DESSUS,
      // puis celle qui s'efface — seule la zone où elles se chevauchent est
      // rongée du perdant. Échap annule.
      if (this.tool.kind === 'cut') {
        const hit = ((): number => {
          for (let i = this.level.boxes.length - 1; i >= 0; i--) {
            if (dansBoite(this.level.boxes[i], w.x, w.y)) return i
          }
          return -1
        })()
        if (hit < 0) {
          this.status('Découpe : cliquez une paroi (celle qui prend le dessus).')
          return
        }
        if (this.cutWinner === null) {
          this.cutWinner = hit
          this.status(
            `${MATERIAL_NAMES[this.level.boxes[hit].material]} prend le dessus — cliquez maintenant la paroi à ronger.`,
          )
          this.draw()
          return
        }
        if (hit === this.cutWinner) {
          this.cutWinner = null
          this.status('Découpe : vainqueur désélectionné.')
          this.draw()
          return
        }
        const gagnante = this.level.boxes[this.cutWinner]
        const perdante = this.level.boxes[hit]
        // La découpe exacte n'existe qu'à ANGLES ÉGAUX (les morceaux restent
        // des rectangles) : tout se passe dans le repère de la perdante.
        const morceaux = subtractBoxOblique(perdante, gagnante)
        if (!morceaux) {
          this.status(
            `Découpe : angles différents (${gagnante.angle ?? 0}° / ${perdante.angle ?? 0}°) — alignez les angles, la découpe exacte n’existe qu’entre parois de même angle.`,
          )
          return
        }
        const intacte =
          morceaux.length === 1 &&
          Math.abs(morceaux[0].minX - perdante.minX) < 0.01 &&
          Math.abs(morceaux[0].minY - perdante.minY) < 0.01 &&
          Math.abs(morceaux[0].maxX - perdante.maxX) < 0.01 &&
          Math.abs(morceaux[0].maxY - perdante.maxY) < 0.01
        if (intacte) {
          this.status('Ces deux parois ne se chevauchent pas — choisissez-en une autre à ronger.')
          return
        }
        this.level.boxes.splice(hit, 1, ...morceaux)
        this.cutWinner = null
        this.sel = null
        this.setTool({ kind: 'select' })
        this.commit(
          `Chevauchement rongé : ${MATERIAL_NAMES[gagnante.material]} garde la zone commune, ${MATERIAL_NAMES[perdante.material]} s'efface dessous (${morceaux.length} morceau${morceaux.length > 1 ? 'x' : ''}).`,
        )
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
      if (this.tool.kind === 'rail') {
        // presser près d'une extrémité PROLONGE ce rail — par la fin (aval)
        // ou par le début (amont), SANS changer le sens de circulation ;
        // ailleurs, un nouveau rail commence. Le point posé suit le doigt.
        if (!this.level.rails) this.level.rails = []
        const rails = this.level.rails
        const tol = Math.max(14, 16 / this.zoom)
        let index = -1
        let point = -1
        for (let i = rails.length - 1; i >= 0; i--) {
          const pts = rails[i].points
          if (Math.hypot(pts[pts.length - 1].x - w.x, pts[pts.length - 1].y - w.y) < tol) {
            pts.push({ x: this.snapped(w.x), y: this.snapped(w.y) })
            index = i
            point = pts.length - 1
            break
          }
          if (Math.hypot(pts[0].x - w.x, pts[0].y - w.y) < tol) {
            pts.unshift({ x: this.snapped(w.x), y: this.snapped(w.y) })
            index = i
            point = 0
            break
          }
        }
        if (index < 0) {
          rails.push({
            points: [
              { x: this.snapped(w.x), y: this.snapped(w.y) },
              { x: this.snapped(w.x), y: this.snapped(w.y) },
            ],
          })
          index = rails.length - 1
          point = 1
        }
        this.sel = { kind: 'rail', index }
        this.drag = { mode: 'railpt', index, point }
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
          this.tool.kind === 'select'
            ? this.sel?.kind === 'box' && this.hitRotateHandle(sx, sy)
              ? 'grab'
              : this.hitHandle(sx, sy)
                ? 'nwse-resize'
                : 'default'
            : 'crosshair'
        return
      }
      const d = this.drag
      if (d.mode === 'rotate') {
        const b = this.level.boxes[d.index]
        if (b) {
          const cx = (b.minX + b.maxX) / 2
          const cy = (b.minY + b.maxY) / 2
          // le bras de la poignée pointe vers +90° quand l'angle est nul
          let a = (Math.atan2(w.y - cy, w.x - cx) * 180) / Math.PI - 90
          a = ((a + 540) % 360) - 180 // ramené dans (-180, 180]
          // aimanté aux 15° — Alt pour l'angle libre (au degré près)
          const cran = e.altKey ? 1 : 15
          const ang = Math.round(a / cran) * cran
          if (ang) b.angle = ang
          else delete b.angle
        }
        this.draw()
        return
      }
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
      } else if (d.mode === 'railpt') {
        const r = (this.level.rails ?? [])[d.index]
        const p = r?.points[d.point]
        if (p) {
          p.x = this.snapped(w.x)
          p.y = this.snapped(w.y)
        }
      } else if (d.mode === 'multimove') {
        // délta aimanté à la grille, appliqué en incrément : pas de dérive
        const ddx = this.snapped(w.x - d.ox)
        const ddy = this.snapped(w.y - d.oy)
        for (const m of this.multi) this.moveSelBy(m, ddx - d.prevDx, ddy - d.prevDy)
        d.prevDx = ddx
        d.prevDy = ddy
        // repères visuels sur les bords du groupe (sans magnétisme : le
        // groupe suit la grille, les pointillés montrent les alignements)
        let bb: Rect | null = null
        for (const m of this.multi) {
          const r = this.boundsOf(m)
          if (!r) continue
          bb = bb
            ? {
                minX: Math.min(bb.minX, r.minX),
                minY: Math.min(bb.minY, r.minY),
                maxX: Math.max(bb.maxX, r.maxX),
                maxY: Math.max(bb.maxY, r.maxY),
              }
            : { ...r }
        }
        if (bb) this.guides = this.aimant(bb).guides
      } else if (d.mode === 'move') {
        if (this.sel?.kind === 'rail' && d.pts) {
          const r = (this.level.rails ?? [])[this.sel.index]
          const dxw = w.x - d.ox
          const dyw = w.y - d.oy
          if (r) {
            for (let k = 0; k < r.points.length; k++) {
              r.points[k].x = this.snapped(d.pts[k].x + dxw)
              r.points[k].y = this.snapped(d.pts[k].y + dyw)
            }
          }
        } else if (this.sel?.kind === 'laser') {
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
          const libre = {
            minX: nx,
            minY: ny,
            maxX: nx + (d.start.maxX - d.start.minX),
            maxY: ny + (d.start.maxY - d.start.minY),
          }
          // les guides magnétiques priment sur la grille : l'alignement
          // exact avec un autre élément se propose en pointillé
          const colle = this.aimant(libre)
          this.guides = colle.guides
          this.applyRect(colle.rect)
        }
      } else if (d.mode === 'resize') {
        if (d.pivot && this.sel?.kind === 'box') {
          // Boîte OBLIQUE : le pointeur et le pivot se projettent sur les
          // axes locaux — le coin opposé reste cloué au monde, la boîte
          // s'étire dans son propre repère (pas d'aimantation à la grille :
          // elle est droite, la boîte ne l'est pas).
          const b = this.level.boxes[this.sel.index]
          if (b) {
            const rad = (d.pivot.angle * Math.PI) / 180
            const uxX = Math.cos(rad)
            const uxY = Math.sin(rad)
            const dx = w.x - d.pivot.x
            const dy = w.y - d.pivot.y
            let du = dx * uxX + dy * uxY // le long de l'axe local x
            let dv = -dx * uxY + dy * uxX // le long de l'axe local y
            const minS = Math.max(4, this.grid)
            if (Math.abs(du) < minS) du = (du < 0 ? -1 : 1) * minS
            if (Math.abs(dv) < minS) dv = (dv < 0 ? -1 : 1) * minS
            const cx = d.pivot.x + (uxX * du - uxY * dv) / 2
            const cy = d.pivot.y + (uxY * du + uxX * dv) / 2
            const hx = Math.abs(du) / 2
            const hy = Math.abs(dv) / 2
            b.minX = cx - hx
            b.maxX = cx + hx
            b.minY = cy - hy
            b.maxY = cy + hy
          }
        } else {
          const r = { ...d.start }
          if (d.edge.includes('W')) r.minX = this.snapped(w.x)
          if (d.edge.includes('E')) r.maxX = this.snapped(w.x)
          if (d.edge.includes('N')) r.maxY = this.snapped(w.y)
          if (d.edge.includes('S')) r.minY = this.snapped(w.y)
          this.applyRect(r)
        }
      }
      this.draw()
    })

    c.addEventListener('pointerup', () => {
      const d = this.drag
      this.drag = null
      this.guides = []
      if (!d) return
      if (d.mode === 'aim') {
        this.setTool({ kind: 'select' })
        this.commit('Émetteur posé — glissez depuis lui pour réorienter, ou réglez l’angle à droite.')
        return
      }
      if (d.mode === 'rotate') {
        const b = this.level.boxes[d.index]
        this.commit(
          b?.angle
            ? `Boîte tournée à ${b.angle}° — aimantée aux 15° (Alt : au degré près).`
            : 'Boîte remise droite (0°).',
        )
        return
      }
      if (d.mode === 'railpt') {
        const r = (this.level.rails ?? [])[d.index]
        if (r) {
          const p = r.points[d.point]
          const voisin = r.points[d.point - 1] ?? r.points[d.point + 1]
          // un tronçon quasi nul ne compte pas : on retire le point posé
          if (voisin && Math.hypot(p.x - voisin.x, p.y - voisin.y) < this.grid) {
            r.points.splice(d.point, 1)
            if (r.points.length < 2) {
              this.level.rails!.splice(d.index, 1)
              this.sel = null
              this.commit('Trop court : glissez pour tracer le tronçon de rail.')
              return
            }
          }
        }
        // l'outil reste actif : reposez sur une extrémité pour prolonger
        this.commit(
          'Rail tracé — les chevrons donnent le SENS de l’arc. Reposez sur une extrémité pour prolonger, Échap pour finir.',
        )
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
      // dans un champ, le Ctrl+Z natif du champ garde la main
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        if (e.shiftKey) this.redo()
        else this.undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        this.redo()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        this.deleteSel()
      } else if (e.key === 'Escape') {
        if (this.cutWinner !== null) {
          this.cutWinner = null
          this.status('Découpe annulée.')
        }
        this.sel = null
        this.multi = []
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
    // sélection multiple : tout part d'un coup, indices décroissants pour
    // que les suppressions ne se décalent pas entre elles
    if (this.multi.length > 1) {
      const parKind = new Map<string, number[]>()
      for (const m of this.multi) {
        if (!m || !('index' in m)) continue
        const liste = parKind.get(m.kind) ?? []
        liste.push(m.index)
        parKind.set(m.kind, liste)
      }
      for (const [kind, indices] of parKind) {
        indices.sort((a, b) => b - a)
        for (const i of indices) {
          this.sel = { kind: kind as 'box', index: i } as Sel
          this.multi = []
          this.deleteSel()
        }
      }
      this.sel = null
      this.multi = []
      this.commit('Sélection supprimée.')
      return
    }
    const s = this.sel
    if (!s) return
    if (s.kind === 'box') this.level.boxes.splice(s.index, 1)
    else if (s.kind === 'sponge') this.level.sponges.splice(s.index, 1)
    else if (s.kind === 'zone') (this.level.zones ?? []).splice(s.index, 1)
    else if (s.kind === 'laser') (this.level.lasers ?? []).splice(s.index, 1)
    else if (s.kind === 'porte') (this.level.portes ?? []).splice(s.index, 1)
    else if (s.kind === 'rail') (this.level.rails ?? []).splice(s.index, 1)
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
    } else if (s.kind === 'rail') {
      const r = (this.level.rails ?? [])[s.index]
      this.level.rails!.push({ points: r.points.map((p) => ({ x: p.x + off, y: p.y })) })
      this.sel = { kind: 'rail', index: this.level.rails!.length - 1 }
    } else return
    this.commit('Dupliqué (D).')
  }

  // Un message de guidage SANS commit : l'historique ne bouge pas
  private status(hint: string): void {
    this.hint = hint
    this.draw()
  }

  private commit(hint: string): void {
    this.histoire() // un instantané si (et seulement si) le tableau a changé
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
        else if (key === 'rail') this.setTool({ kind: 'rail' })
        else if (key === 'cut') this.setTool({ kind: 'cut' })
        else this.setTool({ kind: 'select' })
      })
    }

    // Tableaux LIVRÉS : une copie s'ouvre comme brouillon — pour étudier la
    // construction des salles (miroirs, prisme, plasma…) ou en repartir.
    const selLivres = this.el<HTMLSelectElement>('ed-livres')
    const livres = [...TABLEAUX_ECOLE, ...TABLEAUX, TABLEAU_1BIS]
    selLivres.innerHTML = livres
      .map((t, i) => `<option value="${i}">${t.code} — ${t.name}</option>`)
      .join('')
    this.el('ed-livre-charger').addEventListener('click', () => {
      const lv = livres[Number(selLivres.value) || 0]
      if (!lv) return
      if (!confirm(`Ouvrir une copie de « ${lv.code} — ${lv.name} » ? Le brouillon en cours sera remplacé.`)) {
        return
      }
      this.level = structuredClone(lv)
      this.openId = ''
      this.base = ''
      this.sel = null
      this.multi = []
      this.fitView()
      this.syncForm()
      this.renderLibrary()
      this.commit(`Copie de ${lv.code} ouverte — « Enregistrer comme… » pour la publier à votre nom.`)
    })

    this.el('ed-undo').addEventListener('click', () => this.undo())
    this.el('ed-redo').addEventListener('click', () => this.redo())

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

    this.el('ed-dashs').addEventListener('input', () => {
      const raw = (this.el('ed-dashs') as HTMLInputElement).value.trim()
      // vide : le tableau suit le réglage du banc ; sinon un budget propre
      this.level.dashBudget = raw === '' ? undefined : Math.max(0, Math.round(Number(raw) || 0))
      this.persist()
      this.validate()
    })
    // la frappe ne pousse pas d'instantané à chaque touche : c'est la sortie
    // du champ (change) qui grave l'étape dans l'historique
    this.el('ed-dashs').addEventListener('change', () => this.histoire())
    for (const id of ['ed-name', 'ed-code', 'ed-par', 'ed-journal'] as const) {
      this.el(id).addEventListener('input', () => {
        this.level.name = (this.el('ed-name') as HTMLInputElement).value || 'Sans titre'
        this.level.code = (this.el('ed-code') as HTMLInputElement).value || '21-?'
        this.level.par = Math.max(1, Number((this.el('ed-par') as HTMLInputElement).value) || 3)
        this.level.journal = (this.el('ed-journal') as HTMLTextAreaElement).value
        this.persist()
        this.validate()
      })
      this.el(id).addEventListener('change', () => this.histoire())
    }

    this.el('ed-fit').addEventListener('click', () => {
      this.fitView()
      this.draw()
    })
    // Zoom aux boutons, centré sur la vue — pour quand la roulette fait
    // défaut (pavé tactile, mobile, roulette capricieuse). Mêmes bornes que
    // la roulette ; le centre de la vue ne bouge pas.
    const zoomPar = (facteur: number): void => {
      this.zoom = Math.max(0.05, Math.min(3, this.zoom * facteur))
      this.draw()
    }
    this.el('ed-zin').addEventListener('click', () => zoomPar(1.3))
    this.el('ed-zout').addEventListener('click', () => zoomPar(1 / 1.3))
    this.el('ed-new').addEventListener('click', () => {
      if (!confirm('Repartir d’un tableau vierge ? Le brouillon en cours sera perdu.')) return
      this.level = blankLevel()
      this.openId = ''
      this.base = ''
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
    // le brouillon restauré peut dater d'une autre session : on le confronte
    // à la bibliothèque fraîchement chargée
    if (lib) this.rattrapeBibliotheque()
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
    this.base = serializeLevel(entry.level)
    this.sel = null
    this.fitView()
    this.syncForm()
    this.renderLibrary()
    this.commit(`« ${entry.level.name} » ouvert.`)
  }

  // La bibliothèque a-t-elle avancé pendant qu'on avait le dos tourné (un
  // autre appareil, une autre session) ? Trois cas, à chaque ouverture :
  // — le brouillon est identique à l'entrée : rien à faire ;
  // — le brouillon n'a AUCUN travail local depuis la dernière synchro :
  //   l'entrée est simplement plus récente → on la recharge, silencieusement
  //   (c'était le bug du « vieux triptyque » à l'ouverture de l'éditeur) ;
  // — le brouillon diverge : on n'écrase rien — on PRÉVIENT, et le clic
  //   dans la séquence reste le geste qui charge la dernière version.
  private rattrapeBibliotheque(): void {
    const entry = this.openId
      ? this.library.find((l) => l.id === this.openId)
      : // vieux brouillons d'avant le lien persistant : on retrouve l'entrée
        // par le CODE du tableau — au pire, l'avertissement sera de trop
        this.library.find((l) => l.level.code === this.level.code)
    if (!entry) return
    const enLib = serializeLevel(entry.level)
    const ici = serializeLevel(this.level)
    if (enLib === ici) {
      // à jour : on (re)noue simplement le lien
      this.openId = entry.id
      this.base = enLib
      this.persist()
      return
    }
    if (this.base === ici) {
      this.level = structuredClone(entry.level)
      this.openId = entry.id
      this.base = enLib
      this.sel = null
      this.multi = []
      this.fitView()
      this.syncForm()
      this.renderLibrary()
      this.commit(`« ${entry.level.name} » mis à jour : la bibliothèque avait une version plus récente.`)
      return
    }
    this.commit(
      `⚠ La bibliothèque a une autre version de « ${entry.level.code} » — votre brouillon local en diffère. ` +
        `Cliquez le tableau dans la séquence pour charger la dernière version (le brouillon sera remplacé), ` +
        `ou ENREGISTRER pour publier la vôtre.`,
    )
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
      if (this.openId === id) {
        this.openId = ''
        this.base = ''
      }
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
    this.library = saved.levels
    // l'identifiant retenu vient du SERVEUR (unique, jamais un homonyme
    // écrasé) — plus de devinette par le nom
    if (saved.id) id = saved.id
    this.openId = id
    this.base = serializeLevel(this.level) // le brouillon EST la version publiée
    this.hooks.libraryChanged(saved.levels)
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
    ;(this.el('ed-dashs') as HTMLInputElement).value =
      this.level.dashBudget === undefined ? '' : String(this.level.dashBudget)
    ;(this.el('ed-journal') as HTMLTextAreaElement).value = this.level.journal
    ;(this.el('ed-ambiance') as HTMLSelectElement).value = this.level.ambiance ?? ''
    this.syncProps()
    this.validate()
  }

  /** Panneau de propriétés de l'objet sélectionné. */
  private syncProps(): void {
    const host = this.el('ed-props')
    // sélection multiple : le panneau devient l'atelier d'ALIGNEMENT
    if (this.multi.length > 1) {
      host.innerHTML =
        `<div class="ed-props-head">${this.multi.length} éléments sélectionnés</div>` +
        `<p class="ed-empty">Maj + clic pour ajouter ou retirer. Glissez l’un d’eux : tout se déplace ensemble.</p>` +
        `<div class="ed-fields">` +
        `<button type="button" class="ed-btn" id="p-al-g">Aligner à gauche</button>` +
        `<button type="button" class="ed-btn" id="p-al-d">Aligner à droite</button>` +
        `<button type="button" class="ed-btn" id="p-al-h">Aligner en haut</button>` +
        `<button type="button" class="ed-btn" id="p-al-b">Aligner en bas</button>` +
        `<button type="button" class="ed-btn" id="p-al-ch">Centrer (vertical)</button>` +
        `<button type="button" class="ed-btn" id="p-al-cv">Centrer (horizontal)</button>` +
        `<button type="button" class="ed-btn" id="p-dim-l">Même largeur (1ʳᵉ sélection)</button>` +
        `<button type="button" class="ed-btn" id="p-dim-h">Même hauteur (1ʳᵉ sélection)</button>` +
        `</div>` +
        `<button type="button" class="ed-danger" id="p-del">Tout supprimer</button>`
      host.querySelector('#p-al-g')?.addEventListener('click', () => this.alignMulti('gauche'))
      host.querySelector('#p-al-d')?.addEventListener('click', () => this.alignMulti('droite'))
      host.querySelector('#p-al-h')?.addEventListener('click', () => this.alignMulti('haut'))
      host.querySelector('#p-al-b')?.addEventListener('click', () => this.alignMulti('bas'))
      host.querySelector('#p-al-ch')?.addEventListener('click', () => this.alignMulti('centreH'))
      host.querySelector('#p-al-cv')?.addEventListener('click', () => this.alignMulti('centreV'))
      host.querySelector('#p-dim-l')?.addEventListener('click', () => this.memeDimension('largeur'))
      host.querySelector('#p-dim-h')?.addEventListener('click', () => this.memeDimension('hauteur'))
      host.querySelector('#p-del')?.addEventListener('click', () => this.deleteSel())
      return
    }
    const s = this.sel
    if (!s) {
      host.innerHTML = '<p class="ed-empty">Rien de sélectionné. Cliquez un élément (Maj + clic : sélection multiple), ou choisissez un outil et glissez pour en tracer un.</p>'
      return
    }
    const rows: string[] = []
    const numField = (label: string, id: string, value: number, step = 10): string =>
      `<label class="ed-f"><span>${label}</span><input type="number" step="${step}" id="${id}" value="${Math.round(value)}" /></label>`

    if (s.kind === 'box') {
      const b = this.level.boxes[s.index]
      rows.push(
        `<label class="ed-f"><span>Matériau</span><select id="p-mat">` +
          [MAT_WALL, MAT_HYDROPHILE, MAT_HYDROPHOBE, MAT_FROID, MAT_GRILLE, MAT_CHAUD, MAT_MEMBRANE, MAT_RIDEAU, MAT_SURCHAUFFEUR]
            .map((m) => `<option value="${m}"${m === b.material ? ' selected' : ''}>${MATERIAL_NAMES[m]}</option>`)
            .join('') +
          `</select></label>`,
      )
      rows.push(numField('X min', 'p-minX', b.minX), numField('X max', 'p-maxX', b.maxX))
      rows.push(numField('Y min', 'p-minY', b.minY), numField('Y max', 'p-maxY', b.maxY))
      rows.push(numField('Angle (°)', 'p-ang', b.angle ?? 0))
      if (b.material === MAT_CHAUD) {
        // chaque chaudière règle sa portée d'aura : gros bloc à petite aura…
        rows.push(numField('Aura (× portée)', 'p-aura', b.aura ?? 1, 0.25))
      }
      if (b.material === MAT_WALL) {
        // habillage : pur décor, la physique reste celle d'une paroi neutre
        const skins = ['Standard', 'Caissons', 'Conduites', 'Poutrelle', 'Blindage', 'Aération', 'Hublots', 'Écrans', 'Câbles']
        rows.push(
          `<label class="ed-f"><span>Habillage (décor)</span><select id="p-skin">` +
            skins
              .map((n, i) => `<option value="${i}"${i === (b.skin ?? 0) ? ' selected' : ''}>${n}</option>`)
              .join('') +
            `</select></label>`,
        )
      }
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
      rows.push(
        `<label class="ed-f"><span>Récepteur</span><select id="p-cmode">` +
          `<option value="tor"${t.mode !== 'nor' ? ' selected' : ''}>TOR — un passage verrouille OUVERT</option>` +
          `<option value="nor"${t.mode === 'nor' ? ' selected' : ''}>NOR — maintien : la coupure SCELLE</option>` +
          `</select></label>`,
      )
      rows.push(
        t.mode === 'nor'
          ? `<p class="ed-empty">Cible nº ${s.index + 1} — la porte n’est ouverte que FAISCEAU TENU ; à la première coupure, la pastille grille et la porte se scelle pour de bon.</p>`
          : `<p class="ed-empty">Cible nº ${s.index + 1} — un seul passage du faisceau l’allume pour de bon ; les portes s’y asservissent par ce numéro.</p>`,
      )
    } else if (s.kind === 'porte') {
      const q = (this.level.portes ?? [])[s.index]
      rows.push(numField('Cible asservie (nº)', 'p-pc', q.cible + 1, 1))
      rows.push(numField('X min', 'p-minX', q.minX), numField('X max', 'p-maxX', q.maxX))
      rows.push(numField('Y min', 'p-minY', q.minY), numField('Y max', 'p-maxY', q.maxY))
    } else if (s.kind === 'rail') {
      const r = (this.level.rails ?? [])[s.index]
      rows.push(
        `<p class="ed-empty">Ligne de champ en ${r.points.length} points. Un faisceau IONISÉ (passé dans la vapeur) qui frôle la ligne — n’importe où — s’y accroche et la suit DANS LE SENS DES CHEVRONS. Glissez pour déplacer le rail entier ; outil « Rail » sur une extrémité pour le prolonger.</p>`,
      )
      rows.push(`<button type="button" class="ed-btn" id="p-railrev">Inverser le sens</button>`)
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
                      : s.kind === 'rail'
                        ? 'Rail magnétique'
                        : 'Étiquette'

    host.innerHTML =
      `<div class="ed-props-head">${kindName}</div><div class="ed-fields">${rows.join('')}</div>` +
      (s.kind === 'exit' || s.kind === 'spawn'
        ? ''
        : `<button type="button" class="ed-danger" id="p-del">Supprimer</button>`)

    host.querySelector('#p-del')?.addEventListener('click', () => this.deleteSel())
    host.querySelector('#p-railrev')?.addEventListener('click', () => {
      if (this.sel?.kind === 'rail') {
        ;(this.level.rails ?? [])[this.sel.index]?.points.reverse()
        this.commit('Sens du rail inversé — les chevrons montrent la circulation de l’arc.')
      }
    })
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
      // l'oblique : un angle en degrés autour du centre — 0 efface la clé
      const ang = Math.max(-180, Math.min(180, val('p-ang')))
      if (ang) b.angle = ang
      else delete b.angle
      // portée d'aura propre (chaudière) : 1 (ou vide) efface la clé
      if (b.material === MAT_CHAUD) {
        const aura = Math.max(0.25, Math.min(4, val('p-aura') || 1))
        if (aura !== 1) b.aura = aura
        else delete b.aura
      } else {
        delete b.aura
      }
      // habillage d'une paroi neutre : 0 (standard) efface la clé
      if (b.material === MAT_WALL) {
        const skin = Math.max(0, Math.min(8, Math.round(val('p-skin'))))
        if (skin > 0) b.skin = skin
        else delete b.skin
      } else {
        delete b.skin
      }
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
      // TOR reste implicite (clé absente) : les fichiers existants ne changent pas
      if (text('p-cmode') === 'nor') t.mode = 'nor'
      else delete t.mode
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
    const P = this.hooks.params?.() ?? DEFAULT_PARAMS
    for (const box of this.level.boxes) {
      let band = 0
      let colA = ''
      if (box.material === MAT_FROID) {
        band = P.coldBand
        colA = '#8fc8ee'
      } else if (box.material === MAT_CHAUD) {
        // chaque chaudière porte sa propre portée d'aura (champ Aura)
        band = P.heatBand * (box.aura ?? 1)
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

    // surfaces (les obliques pivotent autour de leur centre)
    this.level.boxes.forEach((box, bi) => {
      const p = this.toScreen(box.minX, box.maxY)
      const q = this.toScreen(box.maxX, box.minY)
      const col = MAT_COLORS[box.material] ?? '#888'
      const gagnant = this.cutWinner === bi
      g.save()
      if (box.angle) {
        const cx = (p.sx + q.sx) / 2
        const cy = (p.sy + q.sy) / 2
        g.translate(cx, cy)
        g.rotate((-box.angle * Math.PI) / 180)
        g.translate(-cx, -cy)
      }
      g.fillStyle = col + '55'
      g.fillRect(p.sx, p.sy, q.sx - p.sx, q.sy - p.sy)
      g.strokeStyle = gagnant ? '#ffd24a' : col
      g.lineWidth = gagnant ? 3 : 1.5
      g.strokeRect(p.sx, p.sy, q.sx - p.sx, q.sy - p.sy)
      g.restore()
    })

    // guides magnétiques : les repères pointillés d'un déplacement en cours
    if (this.guides.length > 0) {
      g.save()
      g.strokeStyle = '#ff5cf0'
      g.lineWidth = 1
      g.setLineDash([6, 5])
      for (const gd of this.guides) {
        g.beginPath()
        if (gd.axe === 'v') {
          const s = this.toScreen(gd.pos, 0)
          g.moveTo(s.sx, 0)
          g.lineTo(s.sx, this.canvas.height)
        } else {
          const s = this.toScreen(0, gd.pos)
          g.moveTo(0, s.sy)
          g.lineTo(this.canvas.width, s.sy)
        }
        g.stroke()
      }
      g.restore()
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
      g.arc(m.sx, m.sy, P.exitRadius * this.zoom, 0, Math.PI * 2)
      g.stroke()
      g.setLineDash([])
      g.fillStyle = 'rgba(53,224,164,0.55)'
      g.font = '600 9px ui-monospace, monospace'
      g.fillText('ASPIRATION', m.sx - 28, m.sy - P.exitRadius * this.zoom - 4)
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
    // rails magnétiques : la bande de capture (l'arc s'accroche n'importe où
    // le long de la ligne), la ligne, ses nœuds, et les CHEVRONS du sens de
    // circulation — l'ordre du tracé est le sens de l'arc.
    const rails = this.level.rails ?? []
    for (let i = 0; i < rails.length; i++) {
      const pts = rails[i].points
      if (pts.length < 2) continue
      const selRail = this.sel?.kind === 'rail' && this.sel.index === i
      const chemin = (): void => {
        g.beginPath()
        const p0 = this.toScreen(pts[0].x, pts[0].y)
        g.moveTo(p0.sx, p0.sy)
        for (let k = 1; k < pts.length; k++) {
          const pk = this.toScreen(pts[k].x, pts[k].y)
          g.lineTo(pk.sx, pk.sy)
        }
      }
      g.strokeStyle = 'rgba(150,120,255,0.09)'
      g.lineWidth = Math.max(2, P.plasmaRailRadius * 2 * this.zoom)
      g.lineJoin = 'round'
      g.lineCap = 'round'
      chemin()
      g.stroke()
      g.strokeStyle = selRail ? '#cdb4ff' : 'rgba(150,120,255,0.55)'
      g.lineWidth = selRail ? 2.5 : 1.8
      g.setLineDash([3, 8])
      chemin()
      g.stroke()
      g.setLineDash([])
      for (let k = 0; k < pts.length; k++) {
        const p = this.toScreen(pts[k].x, pts[k].y)
        g.fillStyle = selRail ? '#e6dcff' : '#b8a0f5'
        g.beginPath()
        g.arc(p.sx, p.sy, k === 0 || k === pts.length - 1 ? 4 : 2.5, 0, Math.PI * 2)
        g.fill()
      }
      g.strokeStyle = selRail ? '#e6dcff' : 'rgba(190,160,255,0.8)'
      g.lineWidth = 1.6
      for (let k = 0; k + 1 < pts.length; k++) {
        const a = pts[k]
        const b = pts[k + 1]
        const len = Math.hypot(b.x - a.x, b.y - a.y)
        if (len < 1) continue
        const ux = (b.x - a.x) / len
        const uy = (b.y - a.y) / len
        const n = Math.max(1, Math.floor((len * this.zoom) / 34))
        const taille = 6
        for (let m = 1; m <= n; m++) {
          const t = m / (n + 1)
          const p = this.toScreen(a.x + ux * len * t, a.y + uy * len * t)
          const ex = ux
          const ey = -uy // écran : y vers le bas
          g.beginPath()
          g.moveTo(p.sx - (ex + ey * 0.6) * taille, p.sy - (ey - ex * 0.6) * taille)
          g.lineTo(p.sx, p.sy)
          g.lineTo(p.sx - (ex - ey * 0.6) * taille, p.sy - (ey + ex * 0.6) * taille)
          g.stroke()
        }
      }
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
        eau: null, // pas de corps dans l'aperçu : ni miroir, ni prisme…
        vapeur: null, // …ni nuage : les rails restent muets, le trajet est à vide
        rails: this.level.rails ?? [],
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
      g.strokeStyle = touchees.has(i) ? '#6dffb8' : t.mode === 'nor' ? '#c99a4e' : '#7b93a8'
      g.lineWidth = 2
      g.stroke()
      if (t.mode === 'nor') {
        // l'anneau pointillé ambré du récepteur À MAINTIEN (même langage
        // visuel qu'en jeu) : la porte veut le faisceau TENU
        g.beginPath()
        g.setLineDash([3, 5])
        g.arc(p.sx, p.sy, rr * 0.72, 0, Math.PI * 2)
        g.strokeStyle = '#a67c3f'
        g.lineWidth = 1.5
        g.stroke()
        g.setLineDash([])
      }
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

    // sélection multiple : chaque élément retenu porte son liseré
    if (this.multi.length > 1) {
      g.strokeStyle = '#ffd76a'
      g.lineWidth = 1.5
      g.setLineDash([5, 4])
      for (const m of this.multi) {
        const b = this.boundsOf(m)
        if (!b) continue
        const p = this.toScreen(b.minX - 6, b.maxY + 6)
        const q = this.toScreen(b.maxX + 6, b.minY - 6)
        g.strokeRect(p.sx, p.sy, q.sx - p.sx, q.sy - p.sy)
      }
      g.setLineDash([])
    }

    // sélection et poignées
    const r = this.selRect()
    const boxSel = this.sel?.kind === 'box' ? this.level.boxes[this.sel.index] : null
    if (r && boxSel?.angle) {
      // boîte OBLIQUE : contour et poignées aux VRAIS coins, pivotés — les
      // poignées droites mentiraient
      const hx = (boxSel.maxX - boxSel.minX) / 2
      const hy = (boxSel.maxY - boxSel.minY) / 2
      const coins = LevelEditor.COINS.map(([, ux, uy]) => {
        const c = this.coinOblique(boxSel, ux * hx, uy * hy)
        return this.toScreen(c.x, c.y)
      })
      g.strokeStyle = '#ffffff'
      g.lineWidth = 1.5
      g.setLineDash([4, 3])
      g.beginPath()
      // COINS est rangé NW, NE, SW, SE : le tracé passe NW → NE → SE → SW
      g.moveTo(coins[0].sx, coins[0].sy)
      g.lineTo(coins[1].sx, coins[1].sy)
      g.lineTo(coins[3].sx, coins[3].sy)
      g.lineTo(coins[2].sx, coins[2].sy)
      g.closePath()
      g.stroke()
      g.setLineDash([])
      g.fillStyle = '#ffffff'
      for (const c of coins) g.fillRect(c.sx - 4, c.sy - 4, 8, 8)
      g.fillStyle = '#a9c0d2'
      g.font = '11px ui-monospace, monospace'
      const bas = coins.reduce((a, c) => (c.sy > a.sy ? c : a))
      g.fillText(`${Math.round(hx * 2)} × ${Math.round(hy * 2)}`, bas.sx + 8, bas.sy + 15)
    } else if (r) {
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

    // poignée de ROTATION (boîtes, droites comme obliques) : un bras qui
    // part du bord haut — dans le repère de la boîte — et un anneau à
    // saisir. Aimantée aux 15°.
    const hRot = this.rotateHandlePos()
    if (hRot && this.sel?.kind === 'box') {
      const b = this.level.boxes[this.sel.index]
      const cx = (b.minX + b.maxX) / 2
      const cy = (b.minY + b.maxY) / 2
      const rad = ((b.angle ?? 0) * Math.PI) / 180
      const demiH = (b.maxY - b.minY) / 2
      const bord = this.toScreen(cx - Math.sin(rad) * demiH, cy + Math.cos(rad) * demiH)
      g.strokeStyle = '#ffffff'
      g.lineWidth = 1.2
      g.beginPath()
      g.moveTo(bord.sx, bord.sy)
      g.lineTo(hRot.sx, hRot.sy)
      g.stroke()
      g.beginPath()
      g.arc(hRot.sx, hRot.sy, 6.5, 0, Math.PI * 2)
      g.fillStyle = '#12202c'
      g.fill()
      g.strokeStyle = '#ffffff'
      g.stroke()
      g.beginPath()
      g.arc(hRot.sx, hRot.sy, 2.2, 0, Math.PI * 2)
      g.fillStyle = '#ffffff'
      g.fill()
      if (b.angle) {
        g.fillStyle = '#a9c0d2'
        g.font = '11px ui-monospace, monospace'
        g.fillText(`${b.angle}°`, hRot.sx + 10, hRot.sy + 4)
      }
    }

    this.el('ed-hint').textContent = this.hint
  }
}
