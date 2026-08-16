// Définition des tableaux (§7.1) : un problème fermé — on entre avec le
// volume plein, il n'y a pas d'eau à ramasser, on sort par un sas.
// Les obstacles sont de la chimie, pas de la géométrie (§6).

import type { Bounds } from '../sim/solver'
import { dansForme } from './formes'

export const MAT_WALL = 0
export const MAT_HYDROPHILE = 1
export const MAT_HYDROPHOBE = 2
export const MAT_EXIT = 3 // rendu seulement, pas de physique
export const MAT_FROID = 4 // plaque froide : gèle l'eau qui s'attarde dans son aura
export const MAT_GRILLE = 5 // évent : arrête le liquide et la glace, laisse passer la vapeur
export const MAT_CHAUD = 6 // chaudière : transforme en gaz à 95 % de présence dans son aura, dégèle — jamais désactivée
export const MAT_MEMBRANE = 7 // membrane gorgée d'eau : seule l'EAU la traverse (glace et vapeur butent)
export const MAT_RIDEAU = 8 // rideau lamellaire : seule la GLACE l'écarte (eau et vapeur butent)
export const MAT_SURCHAUFFEUR = 9 // surchauffeur : mur pour eau et glace ; frôlé en VAPEUR, il rend UN dash — une seule fois

export interface ObstacleBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
  material: number
  // Rotation en DEGRÉS autour du centre de la boîte (sens trigonométrique).
  // Absente ou nulle : boîte droite — le chemin rapide partout.
  angle?: number
  // CHAUDIÈRE seulement : multiplicateur de la portée de son aura de chauffe
  // (1 = réglage du banc). Permet un gros bloc à petite aura, et l'inverse.
  aura?: number
  // Habillage d'une PAROI neutre (décor pur, physique inchangée) :
  // 0/absent standard, 1 caissons, 2 conduites, 3 poutrelle, 4 blindage
  skin?: number
  // FORME de la pièce (formes.ts) : absent/0 rectangle — le chemin rapide.
  // 1 disque (ellipse inscrite), 2 capsule, 3 coin (triangle), 4 arc.
  // La boîte min/max reste la boîte englobante : budget, picking et
  // sérialisation ne changent pas.
  forme?: number
  p0?: number // COIN : orientation 0..3 · ARC : épaisseur relative 0..1
  p1?: number // ARC : demi-ouverture en degrés
}

/** Le point (x, y) ramené dans le repère LOCAL d'une boîte oblique. */
export function versLocalBoite(
  b: { minX: number; minY: number; maxX: number; maxY: number; angle?: number },
  x: number,
  y: number,
): { x: number; y: number } {
  if (!b.angle) return { x, y }
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  const rad = (b.angle * Math.PI) / 180
  const ca = Math.cos(rad)
  const sa = Math.sin(rad)
  const rx = x - cx
  const ry = y - cy
  return { x: cx + rx * ca + ry * sa, y: cy - rx * sa + ry * ca }
}

/** Le point (x, y) est-il dans la pièce, rotation et FORME comprises ? */
export function dansBoite(
  b: { minX: number; minY: number; maxX: number; maxY: number; angle?: number; forme?: number; p0?: number; p1?: number },
  x: number,
  y: number,
): boolean {
  return dansForme(b, x, y)
}

// Ronge une paroi : retire le rectangle `r` de la boîte `b`. Le reste est
// découpé en 4 morceaux au plus (gauche, droite, dessus, dessous), les
// éclats de moins d'une unité sont balayés. Outil d'éditeur : quand des
// blocs se chevauchent mal, on découpe l'excédent au lieu de tout reposer.
export function subtractBox(
  b: ObstacleBox,
  r: { minX: number; minY: number; maxX: number; maxY: number },
): ObstacleBox[] {
  // une forme non rectangulaire ne se découpe pas au couteau axial
  if (b.forme) return [b]
  // pas de recouvrement : la boîte reste entière
  if (r.minX >= b.maxX || r.maxX <= b.minX || r.minY >= b.maxY || r.maxY <= b.minY) return [b]
  const out: ObstacleBox[] = []
  const garde = (minX: number, minY: number, maxX: number, maxY: number): void => {
    if (maxX - minX >= 1 && maxY - minY >= 1) out.push({ minX, minY, maxX, maxY, material: b.material })
  }
  garde(b.minX, b.minY, Math.min(r.minX, b.maxX), b.maxY) // à gauche de la découpe
  garde(Math.max(r.maxX, b.minX), b.minY, b.maxX, b.maxY) // à droite
  const cx0 = Math.max(b.minX, r.minX)
  const cx1 = Math.min(b.maxX, r.maxX)
  garde(cx0, b.minY, cx1, Math.min(r.minY, b.maxY)) // dessous
  garde(cx0, Math.max(r.maxY, b.minY), cx1, b.maxY) // dessus
  return out
}

// Ronge une paroi OBLIQUE : la soustraction exacte entre rectangles n'existe
// qu'à ANGLES ÉGAUX — on passe dans le repère de la perdante (où elle est
// droite), la gagnante y est droite aussi, on découpe au couteau axial, puis
// chaque morceau repart dans le monde avec l'angle d'origine (la rotation
// d'une boîte étant définie autour de SON centre, les morceaux se posent
// exactement sur la paroi d'origine). Angles différents : null — les
// morceaux ne seraient plus des rectangles.
export function subtractBoxOblique(perdante: ObstacleBox, gagnante: ObstacleBox): ObstacleBox[] | null {
  // la soustraction exacte n'existe qu'entre rectangles : une FORME dans le
  // duel, et l'on refuse — comme pour des angles différents
  if (perdante.forme || gagnante.forme) return null
  const a = perdante.angle ?? 0
  const b = gagnante.angle ?? 0
  const delta = Math.abs((((a - b) % 360) + 540) % 360 - 180) // écart à 180 ↔ 0/360
  if (Math.abs(delta - 180) > 0.5 && delta > 0.5) return null
  if (!a) return subtractBox(perdante, gagnante)
  const pcx = (perdante.minX + perdante.maxX) / 2
  const pcy = (perdante.minY + perdante.maxY) / 2
  const gcx = (gagnante.minX + gagnante.maxX) / 2
  const gcy = (gagnante.minY + gagnante.maxY) / 2
  // le centre de la gagnante, dépivoté autour du centre de la perdante
  const rad = (-a * Math.PI) / 180
  const c = Math.cos(rad)
  const s = Math.sin(rad)
  const dx = gcx - pcx
  const dy = gcy - pcy
  const lx = pcx + c * dx - s * dy
  const ly = pcy + s * dx + c * dy
  const ghx = (gagnante.maxX - gagnante.minX) / 2
  const ghy = (gagnante.maxY - gagnante.minY) / 2
  // à 180° d'écart, les demi-côtés de la gagnante sont simplement inversés —
  // même empreinte : rien à échanger
  const morceaux = subtractBox(
    { ...perdante, angle: undefined },
    { minX: lx - ghx, minY: ly - ghy, maxX: lx + ghx, maxY: ly + ghy },
  )
  // chaque morceau re-pivote : son centre orbite autour du centre d'origine
  const rad2 = (a * Math.PI) / 180
  const c2 = Math.cos(rad2)
  const s2 = Math.sin(rad2)
  return morceaux.map((m) => {
    const mcx = (m.minX + m.maxX) / 2
    const mcy = (m.minY + m.maxY) / 2
    const ox = mcx - pcx
    const oy = mcy - pcy
    const wx = pcx + c2 * ox - s2 * oy
    const wy = pcy + s2 * ox + c2 * oy
    const hx = (m.maxX - m.minX) / 2
    const hy = (m.maxY - m.minY) / 2
    return { minX: wx - hx, minY: wy - hy, maxX: wx + hx, maxY: wy + hy, material: m.material, angle: a }
  })
}

export interface SpongeDef {
  minX: number
  minY: number
  cols: number
  rows: number
  cellSize: number
  capacityPerCell: number // particules absorbées avant qu'une cellule se solidifie
}

// Étiquette peinte dans le décor : chaque élément distinctif porte son nom,
// dans la couleur de la légende — la surface s'identifie d'un coup d'œil.
export interface WorldLabel {
  x: number
  y: number
  text: string
  tone: 'mur' | 'phile' | 'phobe' | 'eponge' | 'froid' | 'grille' | 'sas' | 'chaud'
  // PORTÉE de la pancarte, quand la place manque à l'écran : « secteur »
  // nomme un LIEU (elle survit au dézoom — c'est la légende du plan),
  // « detail » commente un objet (elle s'efface dès qu'elle gênerait).
  // Deux pancartes ne se chevauchent JAMAIS : celle de moindre portée cède.
  rang?: 'secteur' | 'detail'
}

// Zone d'état (refonte 2026) : une région du tableau qui IMPOSE un état et
// interdit d'en changer, ou qui laisse le choix. Le corps qui y entre est
// converti ; tant qu'il y est, le sélecteur d'état est verrouillé.
export type ZoneForce = 'libre' | 'eau' | 'glace' | 'vapeur'

export interface ZoneDef {
  minX: number
  minY: number
  maxX: number
  maxY: number
  force: ZoneForce
  label?: string
}

// Décalque de décor : machinerie plaquée sur la paroi (tuyaux, vanne).
// Aucune physique, aucune règle — seulement la preuve que quelqu'un a
// construit cet endroit avant de l'abandonner.
export interface DecalDef {
  x: number
  y: number
  w: number
  h: number
  kind: 'tuyaux' | 'vanne'
  flip?: boolean // miroir horizontal : la même pièce ne se répète pas telle quelle
  fade?: number // 0..1, opacité (défaut 0,55)
}

// ---- Lampes (éclairage de la pièce, 2026) --------------------------------
// Une lampe éclaire la cuve et couche les ombres portées du décor. La
// HAUTEUR est la troisième dimension du réglage : un rayon qui grimpe vers
// une lampe HAUTE passe au-dessus des blocs — ombres courtes et douces ;
// une lampe BASSE rase le sol — ombres longues et dramatiques. Sans lampe
// déclarée, le tableau garde sa lampe par défaut (centre, un peu haut).
export interface LumiereDef {
  x: number
  y: number
  h?: number // hauteur au-dessus du plan (unités monde) ; absente : 420
  portee?: number // rayon de retombée ; absente : proportionnelle à la cuve
  intensite?: number // 0,2..2 ; absente : 1
}

export const LAMPE_HAUTEUR_DEFAUT = 420
export const LAMPE_HAUTEUR_MIN = 80
export const LAMPE_HAUTEUR_MAX = 2000

// ---- Mécanismes laser (paliers 1-3, 2026) --------------------------------
// Le faisceau est absorbé par les parois, passe les évents, se REFLÈTE sur
// la glace (le corps gelé est un miroir — c'est sa fonction cachée), se
// RÉFRACTE dans l'eau (le corps liquide est un prisme), s'IONISE dans la
// vapeur (l'arc plasma suit les rails magnétiques), et allume des cibles.
// Une cible allumée ouvre les portes qui lui sont asservies.
export interface LaserDef {
  x: number
  y: number
  angle: number // degrés, 0 = vers +x, sens trigonométrique
}

// Deux familles de récepteurs, chacune à transition UNIQUE (pas de va-et-vient) :
//   · TOR (défaut) : un seul passage du faisceau l'allume POUR DE BON — la
//     porte asservie s'ouvre et reste ouverte, pas besoin de tenir le rayon ;
//   · NOR : la porte n'est ouverte que TANT QUE le faisceau tient la cible —
//     et à la PREMIÈRE coupure, la pastille grille : la porte se referme et
//     se scelle définitivement. Traverser se joue faisceau maintenu.
export type CibleMode = 'tor' | 'nor'

export interface CibleDef {
  x: number
  y: number
  r: number // rayon de la pastille réceptrice
  mode?: CibleMode // absent : 'tor'
}

// Une porte est une paroi asservie : FERMÉE tant que sa cible est éteinte,
// ouverte (et traversante) tant qu'elle est allumée.
export interface PorteDef {
  minX: number
  minY: number
  maxX: number
  maxY: number
  cible: number // indice dans `cibles`
}

// Un RAIL MAGNÉTIQUE (palier 3) : une ligne de champ posée dans le décor.
// Le faisceau ordinaire l'ignore ; un faisceau IONISÉ (qui traverse la
// vapeur du joueur) est capturé s'il passe près d'une extrémité, suit la
// polyligne jusqu'à l'autre bout, puis repart tout droit. Le plasma se
// PROVOQUE : être vapeur dans la lumière, au bon endroit.
export interface RailDef {
  points: { x: number; y: number }[] // ≥ 2 points, dans l'ordre du tracé
}

export interface LevelDef {
  name: string
  code: string // code d'essai du protocole (21-A, 21-B…)
  journal: string // entrée du journal de bord, affichée à l'ouverture du tableau
  figure?: string // illustration du carton de journal (public/assets)
  bounds: Bounds
  spawn: { x: number; y: number; n: number }
  exit: { minX: number; minY: number; maxX: number; maxY: number }
  boxes: ObstacleBox[]
  sponges: SpongeDef[]
  labels: WorldLabel[]
  decals?: DecalDef[]
  zones?: ZoneDef[]
  lasers?: LaserDef[]
  cibles?: CibleDef[]
  portes?: PorteDef[]
  rails?: RailDef[]
  // Lampes posées à l'éditeur (au plus MAX_LUMIERES allumées). Absentes :
  // la lampe par défaut de la cuve fait l'éclairage.
  lumieres?: LumiereDef[]
  par?: number // budget d'impulsions visé : franchissable en `par`, record en dessous
  // Dashs rendus à CHAQUE transformation en vapeur (règle d'or : 3 par
  // bascule, quel que soit le volume). Absent : le réglage du banc
  // (gasDashBudget).
  dashBudget?: number
  // Lit musical imposé par le tableau. Sans valeur, la cuve suit le
  // refroidissement de la coque (tiède → glaciale) : c'est le cas général,
  // les tableaux n'ont pas à choisir une musique pour exister.
  ambiance?: string
  // RACCOURCI (roguelike) : si présent, le sas de CE tableau envoie
  // directement à la salle portant ce code — en sautant les intermédiaires
  // (vers l'avant uniquement ; un code inconnu retombe sur salle+1). Permet
  // des salles-raccourcis secrètes qui accélèrent les runs déjà maîtrisées.
  raccourciVers?: string
}

// Nom lisible de chaque matériau — l'éditeur et la légende parlent la même
// langue que le code.
export const MATERIAL_NAMES: Record<number, string> = {
  [MAT_WALL]: 'Paroi',
  [MAT_HYDROPHILE]: 'Hydrophile',
  [MAT_HYDROPHOBE]: 'Hydrophobe',
  [MAT_EXIT]: 'Sas',
  [MAT_FROID]: 'Hublot (froid)',
  [MAT_GRILLE]: 'Évent',
  [MAT_CHAUD]: 'Chaudière',
  [MAT_MEMBRANE]: 'Membrane (liquide)',
  [MAT_RIDEAU]: 'Rideau (glace)',
  [MAT_SURCHAUFFEUR]: 'Surchauffeur',
}

// La CAUSE de chaque zone : une zone n'impose pas un état par convention, elle
// l'impose parce qu'il s'est passé quelque chose ici. Le nom sert d'étiquette
// par défaut, et le décor de la zone illustre la même cause.
export const ZONE_CAUSES: Record<ZoneForce, string> = {
  glace: 'HUBLOT FENDU',
  vapeur: 'CONDUITE ROMPUE',
  eau: 'CHAMBRE PRESSURISÉE',
  libre: 'ZONE LIBRE',
}

/** Le nom affiché d'une zone : le sien, ou la cause de son régime. */
export function zoneName(z: ZoneDef): string {
  return z.label && z.label.trim() ? z.label.trim().toUpperCase() : ZONE_CAUSES[z.force]
}

/** L'état imposé au point (x, y), ou 'libre' si aucune zone ne l'impose. */
// ---- Forme du rayon d'action d'une zone (refonte 2026) ------------------
// Le régime couvre TOUT le rectangle déclaré à l'éditeur : passer devant
// l'accident dessiné (hublot, brèche, rampe) ou à côté, c'est pareil, tant
// qu'on est dans la zone. Sa limite est une superellipse qui épouse le
// rectangle (coins adoucis), ondulée par trois harmoniques — irrégulière,
// et différente pour chaque zone (les phases dépendent de son centre).
// La MÊME formule sert la mécanique (ici) et le rendu (les phases sont
// calculées ici puis passées au shader) : ce qu'on voit est ce qu'on subit.

/** Les trois phases d'ondulation d'une zone — déterministes, par centre. */
export function zonePhases(z: ZoneDef): [number, number, number] {
  const cx = (z.minX + z.maxX) * 0.5
  const cy = (z.minY + z.maxY) * 0.5
  const ph = (k: number): number => {
    const t = Math.sin(cx * 0.12898 + cy * 0.78233 + k * 17.17) * 43758.5453
    return (t - Math.floor(t)) * Math.PI * 2
  }
  return [ph(1), ph(2), ph(3)]
}

/** Distance de forme : < 1 dedans, 1 sur la lisière, > 1 dehors. */
export function zoneShape(z: ZoneDef, x: number, y: number): number {
  const hx = Math.max(1e-6, (z.maxX - z.minX) * 0.5)
  const hy = Math.max(1e-6, (z.maxY - z.minY) * 0.5)
  const nx = (x - (z.minX + z.maxX) * 0.5) / hx
  const ny = (y - (z.minY + z.maxY) * 0.5) / hy
  // norme d'ordre 8 : un rectangle aux coins adoucis, pas une ellipse — une
  // zone étroite et haute reste pleine sur toute sa hauteur
  const d = Math.pow(nx ** 8 + ny ** 8, 0.125)
  const th = Math.atan2(ny, nx)
  const [p1, p2, p3] = zonePhases(z)
  // lisière à 0,955 de la demi-taille, ondulée de ±0,04 — le tout reste
  // inscrit dans le rectangle déclaré à l'éditeur
  const w =
    0.955 + 0.02 * Math.sin(3 * th + p1) + 0.012 * Math.sin(5 * th + p2) + 0.008 * Math.sin(8 * th + p3)
  return d / w
}

/** Le contour de la lisière, pour l'éditeur (polygone en coordonnées monde). */
export function zoneOutline(z: ZoneDef, steps = 64): { x: number; y: number }[] {
  const cx = (z.minX + z.maxX) * 0.5
  const cy = (z.minY + z.maxY) * 0.5
  const hx = (z.maxX - z.minX) * 0.5
  const hy = (z.maxY - z.minY) * 0.5
  const [p1, p2, p3] = zonePhases(z)
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < steps; i++) {
    const th = (i / steps) * Math.PI * 2
    const w =
      0.955 + 0.02 * Math.sin(3 * th + p1) + 0.012 * Math.sin(5 * th + p2) + 0.008 * Math.sin(8 * th + p3)
    // rayon où la norme d'ordre 8 vaut w dans la direction th : le contour
    // suit la même superellipse que la mécanique
    const c = Math.cos(th)
    const s = Math.sin(th)
    const r = w / Math.pow(c ** 8 + s ** 8, 0.125)
    pts.push({ x: cx + c * hx * r, y: cy + s * hy * r })
  }
  return pts
}

export function zoneForceAt(level: LevelDef, x: number, y: number): ZoneForce {
  const zones = level.zones
  if (!zones) return 'libre'
  // la dernière zone déclarée gagne : on peut superposer une exception.
  // La MÉCANIQUE couvre tout le rectangle déclaré à l'éditeur : la lisière
  // ondulée (zoneShape) est le DESSIN de la frontière, légèrement inscrite —
  // comptée mécaniquement, sa bande morte rendait le seuil des 95 %
  // inatteignable quand le corps s'écrasait contre une paroi posée au bord
  // de la zone. Rien de visuellement « dedans » n'est jamais exclu.
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i]
    if (x >= z.minX && x <= z.maxX && y >= z.minY && y <= z.maxY) return z.force
  }
  return 'libre'
}

function box(minX: number, minY: number, maxX: number, maxY: number, material: number): ObstacleBox {
  return { minX, minY, maxX, maxY, material }
}

// Tableau 1 — lecture de gauche à droite :
// 1. une cloison hydrophobe percée de deux ouvertures (se scinder ou se
//    faufiler, les bords déviant les trajectoires) ;
// 2. un îlot hydrophile au centre : on s'y colle, on y rampe, il faut payer
//    une impulsion pour s'en arracher ;
// 3. un mur d'éponge qui barre la moitié basse : passer par le couloir haut,
//    ou payer le passage en volume et ouvrir une brèche permanente (§6) ;
// 4. le sas, en bas à droite — derrière l'éponge : le couloir haut oblige à
//    redescendre le long de la paroi.
export const TABLEAU_1: LevelDef = {
  name: 'Le sas',
  code: '21-A',
  journal:
    'Cohésion nominale. L’échantillon dérive vers le collecteur avec une constance… inhabituelle. Sept essais, sept trajectoires identiques. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -420, maxX: 1180, maxY: -180 },
  boxes: [
    // 1. cloison hydrophobe : trois segments, deux ouvertures
    box(-420, -750, -360, -380, MAT_HYDROPHOBE),
    box(-420, -180, -360, 180, MAT_HYDROPHOBE),
    box(-420, 380, -360, 750, MAT_HYDROPHOBE),
    // 2. îlot hydrophile
    box(-80, -160, 240, -40, MAT_HYDROPHILE),
    // muret neutre au-dessus du couloir de l'éponge
    box(560, 240, 640, 750, MAT_WALL),
  ],
  sponges: [
    // 3. mur d'éponge : bloque de bas en haut jusqu'au couloir (y = 40..240)
    {
      minX: 560,
      minY: -750,
      cols: 2,
      rows: 33,
      cellSize: 24,
      capacityPerCell: 5,
    },
  ],
  labels: [
    { x: -390, y: 0, text: 'HYDROPHOBE', tone: 'phobe' },
    { x: 80, y: -100, text: 'HYDROPHILE', tone: 'phile' },
    { x: 584, y: -60, text: 'ÉPONGE', tone: 'eponge' },
    { x: 1110, y: -300, text: 'SAS', tone: 'sas' },
  ],
}

// Tableau 2 — la chambre froide (une mécanique : l'état). Lecture :
// 1. deux plaques froides encadrent l'entrée : passer au centre, ou raser et
//    payer en givre — le froid se lit à son aura avant de mordre ;
// 2. une chicane hydrophobe au milieu : les rebonds font perdre le contrôle,
//    et le petit plot froid est un mouillage volontaire — geler un flanc pour
//    s'arrêter net, puis payer le dégel en temps ;
// 3. une barrière froide devant le sas, percée d'un passage étroit : viser
//    juste, ou traverser en acceptant un gel partiel.
export const TABLEAU_2: LevelDef = {
  name: 'La chambre froide',
  code: '21-B',
  journal:
    'Installation de plaques cryogéniques sur demande. Si l’échantillon « choisit » ses trajectoires, le froid les lui fera payer. Note : il a appris à s’en servir. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  boxes: [
    // 1. porte froide d'entrée
    box(-500, -750, -440, -150, MAT_FROID),
    box(-500, 150, -440, 750, MAT_FROID),
    // 2. chicane hydrophobe + plot d'ancrage
    box(-100, -420, -20, -240, MAT_HYDROPHOBE),
    box(60, 240, 140, 420, MAT_HYDROPHOBE),
    box(180, -50, 260, 50, MAT_FROID),
    // 3. barrière froide devant le sas, passage en y = -80..180
    box(700, -750, 760, -80, MAT_FROID),
    box(700, 180, 760, 750, MAT_FROID),
  ],
  sponges: [],
  labels: [
    { x: -470, y: 430, text: 'PLAQUE FROIDE', tone: 'froid' },
    { x: -60, y: -330, text: 'HYDROPHOBE', tone: 'phobe' },
    { x: 220, y: 110, text: 'PLOT FROID', tone: 'froid' },
    { x: 730, y: 440, text: 'PLAQUE FROIDE', tone: 'froid' },
    { x: 1110, y: 0, text: 'SAS', tone: 'sas' },
  ],
}

// Tableau 3 — le conduit (une mécanique : le gaz). Lecture :
// 1. une grille barre tout le passage : le liquide s'y écrase, la vapeur la
//    traverse — se changer en gaz (G) est le seul chemin ;
// 2. un goulet neutre au centre : en vapeur on le franchit sans se mouiller
//    aux parois, mais le nuage s'évapore pendant qu'on le pilote ;
// 3. une seconde grille, puis deux portes froides : le froid condense la
//    vapeur — on redevient liquide avant le sas, qu'on le veuille ou non.
export const TABLEAU_3: LevelDef = {
  name: 'Le conduit',
  code: '21-C',
  journal:
    'Les évents retiennent l’eau et la glace. Ce matin, l’échantillon a traversé le premier à l’état de vapeur. Je demande le passage en confinement de niveau 3. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  boxes: [
    // 1. première grille, pleine hauteur
    box(-500, -750, -460, 750, MAT_GRILLE),
    // 2. goulet neutre
    box(-80, -750, 0, -100, MAT_WALL),
    box(-80, 100, 0, 750, MAT_WALL),
    // 3. seconde grille puis portes condensantes
    box(400, -750, 440, 750, MAT_GRILLE),
    box(520, -750, 580, -180, MAT_FROID),
    box(520, 180, 580, 750, MAT_FROID),
  ],
  sponges: [],
  labels: [
    { x: -480, y: 320, text: 'ÉVENT', tone: 'grille' },
    { x: 420, y: 320, text: 'ÉVENT', tone: 'grille' },
    { x: 550, y: 440, text: 'PLAQUE FROIDE', tone: 'froid' },
    { x: 1110, y: 0, text: 'SAS', tone: 'sas' },
  ],
}

// Tableau 4 — la cuve thermique (le jalon « chaleur » : les trois routes).
// Le tableau se lit comme une carte de température. Lecture :
// 1. une cloison neutre percée au centre ;
// 2. un radiateur en haut, une cryobaie en bas : deux préparations d'état ;
// 3. une barrière qui combine les trois réponses — fente étroite en haut
//    (liquide : se faufiler), mur d'éponge au centre (payer en volume, ou
//    traverser en vapeur gagnée au radiateur), couloir bas tapissé d'éponge
//    (la glace y glisse : l'éponge n'a pas prise sur elle).
export const TABLEAU_4: LevelDef = {
  name: 'La cuve thermique',
  code: '21-D',
  journal:
    'Une chaudière et une cryobaie dans la même cuve : trois chemins, trois états. L’échantillon a pris les trois en trois essais. Ce n’est plus une fuite, c’est une démonstration. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  boxes: [
    // 1. cloison neutre, large passage central
    box(-420, -750, -360, -160, MAT_WALL),
    box(-420, 160, -360, 750, MAT_WALL),
    // 2. la carte thermique : radiateur en haut, cryobaie en bas
    box(-80, 520, 320, 640, MAT_CHAUD),
    box(-80, -640, 320, -520, MAT_FROID),
    // 3. barrière : mur au-dessus de la fente (la fente : y = 360..440,
    //    entre ce segment et le haut du mur d'éponge)
    box(560, 440, 620, 750, MAT_WALL),
  ],
  sponges: [
    // mur d'éponge central : de la fente au couloir bas (y = -360..360)
    { minX: 560, minY: -360, cols: 2, rows: 30, cellSize: 24, capacityPerCell: 5 },
    // couloir bas tapissé : deux lèvres d'éponge, la glace passe entre elles
    { minX: 660, minY: -420, cols: 10, rows: 2, cellSize: 24, capacityPerCell: 4 },
    { minX: 660, minY: -750, cols: 10, rows: 2, cellSize: 24, capacityPerCell: 4 },
  ],
  labels: [
    { x: 120, y: 580, text: 'CHAUDIÈRE', tone: 'chaud' },
    { x: 120, y: -580, text: 'CRYOBAIE', tone: 'froid' },
    { x: 584, y: 0, text: 'ÉPONGE', tone: 'eponge' },
    { x: 780, y: -580, text: 'ÉPONGE', tone: 'eponge' },
    { x: 1110, y: 0, text: 'SAS', tone: 'sas' },
  ],
}

// Tableau 5 — la serre (combinaison : hydrophile + chaleur + éponge).
// Lecture : des étagères hydrophiles jalonnent la traversée — s'y coller,
// c'est s'arrêter net pour viser, mais s'en arracher se paie ; le radiateur
// du haut offre l'autre monnaie (la vapeur passe l'éponge) ; le mur d'éponge
// ferme la moitié basse.
export const TABLEAU_5: LevelDef = {
  name: 'La serre',
  code: '21-E',
  journal:
    'Les parois mouillantes devaient l’immobiliser. Il s’en sert comme de prises d’escalade : il se colle, il vise, il s’arrache. Le protocole lui a appris la patience. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -320, maxX: 1180, maxY: -80 },
  boxes: [
    // les étagères : des mouillages successifs pour casser l'inertie
    box(-560, 80, -240, 200, MAT_HYDROPHILE),
    box(-80, -420, 240, -300, MAT_HYDROPHILE),
    // le radiateur du haut : la monnaie vapeur
    box(120, 520, 520, 640, MAT_CHAUD),
    // muret neutre au-dessus du couloir de l'éponge
    box(560, 300, 640, 750, MAT_WALL),
  ],
  sponges: [
    // mur d'éponge : bloque du bas jusqu'au couloir (y = 100..300)
    { minX: 560, minY: -750, cols: 2, rows: 35, cellSize: 24, capacityPerCell: 5 },
  ],
  labels: [
    { x: -400, y: 140, text: 'HYDROPHILE', tone: 'phile' },
    { x: 80, y: -360, text: 'HYDROPHILE', tone: 'phile' },
    { x: 320, y: 580, text: 'CHAUDIÈRE', tone: 'chaud' },
    { x: 584, y: -200, text: 'ÉPONGE', tone: 'eponge' },
    { x: 1110, y: -360, text: 'SAS', tone: 'sas' },
  ],
}

// Tableau 6 — le dépôt de givre (combinaison : évents + froid +
// recondensation). Lecture : deux évents imposent la vapeur, leurs péages
// essorent le nuage — mais les plaques froides du dépôt recondensent les
// pertes en rosée : passer, puis revenir cueillir son propre corps.
export const TABLEAU_6: LevelDef = {
  name: 'Le dépôt de givre',
  code: '21-F',
  journal:
    'Le givre des plaques n’est pas du givre. C’est LUI — ce que les évents lui arrachent perle sur les parois froides, et il revient le boire. Rien ne se perd. Ça m’inquiète. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  boxes: [
    // première grille, pleine hauteur : la vapeur est obligatoire
    box(-460, -750, -420, 750, MAT_GRILLE),
    // le dépôt : deux plaques froides qui recondensent les pertes
    box(-220, -750, -160, -280, MAT_FROID),
    box(-220, 280, -160, 750, MAT_FROID),
    // chicane hydrophobe au centre
    box(180, -480, 260, -120, MAT_HYDROPHOBE),
    box(330, 140, 410, 500, MAT_HYDROPHOBE),
    // seconde grille, puis une dernière plaque à l'écart du sas
    box(680, -750, 720, 750, MAT_GRILLE),
    box(850, -750, 910, -380, MAT_FROID),
  ],
  sponges: [],
  labels: [
    { x: -440, y: 320, text: 'ÉVENT', tone: 'grille' },
    { x: -190, y: 520, text: 'DÉPÔT DE GIVRE', tone: 'froid' },
    { x: 220, y: -300, text: 'HYDROPHOBE', tone: 'phobe' },
    { x: 700, y: 320, text: 'ÉVENT', tone: 'grille' },
    { x: 880, y: -560, text: 'DÉPÔT', tone: 'froid' },
    { x: 1110, y: 0, text: 'SAS', tone: 'sas' },
  ],
}

// Tableau 7 — la dérive (le final : presque pas de murs). Lecture : un
// grand vide où chaque impulsion se paie ; des plots hydrophobes en guise de
// bandes de billard, deux mouillages froids pour geler-glisser sans dépenser
// une goutte. La maîtrise pure de l'inertie et du volume.
export const TABLEAU_7: LevelDef = {
  name: 'La dérive',
  code: '21-G',
  journal:
    'Nous avons retiré les cloisons du secteur : sans appui, il devra se dépenser. Il a gelé, ricoché deux fois, et traversé sans perdre une goutte. Le protocole est terminé. Lui non. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -980, y: 0, n: 900 },
  exit: { minX: 1040, minY: 380, maxX: 1180, maxY: 620 },
  boxes: [
    // les bandes du billard
    box(-520, -260, -400, -140, MAT_HYDROPHOBE),
    box(-160, 260, -40, 380, MAT_HYDROPHOBE),
    box(240, -380, 360, -260, MAT_HYDROPHOBE),
    box(560, 60, 680, 180, MAT_HYDROPHOBE),
    // deux mouillages froids : geler pour glisser, se souder pour viser
    box(-360, 420, -240, 520, MAT_FROID),
    box(300, -700, 420, -600, MAT_FROID),
    // un unique radiateur, loin de la route directe
    box(-1060, -640, -860, -560, MAT_CHAUD),
  ],
  sponges: [],
  labels: [
    { x: -460, y: -100, text: 'HYDROPHOBE', tone: 'phobe' },
    { x: -300, y: 560, text: 'MOUILLAGE FROID', tone: 'froid' },
    { x: 360, y: -560, text: 'MOUILLAGE FROID', tone: 'froid' },
    { x: -960, y: -520, text: 'CHAUDIÈRE', tone: 'chaud' },
    { x: 1110, y: 340, text: 'SAS', tone: 'sas' },
  ],
}

// Tableau 1 bis — la galerie noyée (PROTOTYPE de réfection du secteur A,
// accessible depuis la fiche d'essai ; il remplacera 21-A s'il convainc).
// Un tableau « eau seule » : aucun changement d'état requis — on apprend
// l'éjection, l'inertie et le volume. La géométrie n'est plus une boîte nue :
// une porte massive, des contreforts, une cascade de dalles en quinconce,
// une étagère hydrophile pour se poser et viser, une lèvre hydrophobe qui
// défend la goulotte du sas.
export const TABLEAU_1BIS: LevelDef = {
  name: 'La galerie noyée',
  code: '21-A bis',
  journal:
    'Réfection du secteur A : cloisons redessinées, contreforts, une galerie au lieu d’un couloir. L’échantillon n’a besoin d’aucun artifice ici — seulement de fluide, et de retenue. — Dr N. Véga',
  figure: '/assets/card-galerie.webp',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -300, maxX: 1180, maxY: -60 },
  boxes: [
    // la porte d'entrée : deux piliers massifs, ouverture décentrée
    box(-700, 200, -560, 750, MAT_WALL),
    box(-700, -750, -560, -260, MAT_WALL),
    // contreforts : la paroi respire au lieu d'être une boîte nue
    box(-350, 660, -150, 750, MAT_WALL),
    box(80, -750, 280, -660, MAT_WALL),
    box(500, 600, 700, 750, MAT_WALL),
    box(820, -750, 980, -640, MAT_WALL),
    // la cascade : trois dalles en quinconce, le courant se faufile
    box(-380, -80, -40, 20, MAT_WALL),
    box(-200, -380, 160, -300, MAT_WALL),
    box(-40, 220, 300, 300, MAT_WALL),
    // l'étagère hydrophile : se coller, se poser, viser
    box(340, -140, 620, -40, MAT_HYDROPHILE),
    // la lèvre hydrophobe qui défend la goulotte du sas
    box(680, 120, 1020, 220, MAT_HYDROPHOBE),
    // le pilier bas de la goulotte
    box(680, -750, 760, -420, MAT_WALL),
  ],
  sponges: [],
  labels: [
    { x: -630, y: -60, text: 'LA PORTE', tone: 'mur' },
    { x: -110, y: -30, text: 'LA CASCADE', tone: 'mur' },
    { x: 480, y: -90, text: 'HYDROPHILE', tone: 'phile' },
    { x: 850, y: 170, text: 'HYDROPHOBE', tone: 'phobe' },
    { x: 1110, y: -180, text: 'SAS', tone: 'sas' },
  ],
  // La machinerie de la galerie : plaquée aux parois, à l'écart des routes —
  // le lieu a été construit, entretenu, puis laissé.
  decals: [
    { x: -1105, y: 230, w: 160, h: 160, kind: 'tuyaux' },
    { x: -1105, y: -180, w: 150, h: 150, kind: 'tuyaux', flip: true, fade: 0.45 },
    { x: -520, y: 590, w: 190, h: 285, kind: 'vanne', fade: 0.5 },
    { x: 300, y: -640, w: 150, h: 225, kind: 'vanne', fade: 0.42 },
    { x: 1120, y: 520, w: 165, h: 165, kind: 'tuyaux', fade: 0.5 },
    { x: 60, y: 700, w: 150, h: 150, kind: 'tuyaux', flip: true, fade: 0.4 },
  ],
}

// Tableau 8 — la salle des miroirs (laser, palier 1 : GLACE = MIROIR).
// Le pivot du scénario : l'échantillon découvre sa fonction. Lecture :
// 1. un émetteur balaie la salle à hauteur du berceau ; le faisceau meurt
//    sur un pilier — il n'atteint rien tout seul ;
// 2. le BERCEAU FROID sous la ligne de tir : s'y poser, c'est gélifier en
//    travers du faisceau — le corps devient le miroir, le reflet monte vers
//    la cible. Glisser le long du berceau règle l'angle ;
// 3. la cible est À VERROU : un reflet suffit, la porte reste ouverte —
//    on dégèle et on descend au sas par la porte d'énergie éteinte.
export const TABLEAU_8: LevelDef = {
  name: 'La salle des miroirs',
  code: '21-H',
  journal:
    'Nous avons monté un émetteur pour cartographier la cuve. L’échantillon s’est figé dans le faisceau — et l’a renvoyé sur le récepteur. Il a recommencé sept fois. Ce n’est pas un réflexe. C’est un miroir. Il l’a toujours été. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  boxes: [
    // le pilier qui absorbe le faisceau à droite du berceau
    box(520, -300, 580, 100, MAT_WALL),
    // le berceau froid : se poser dessus, c'est se figer dans le faisceau
    box(-160, -280, 200, -220, MAT_FROID),
    // la barrière de la porte : seul le sas d'énergie laisse passer
    box(860, -750, 900, -170, MAT_WALL),
    box(860, 170, 900, 750, MAT_WALL),
    // un contrefort pour la lecture de la salle
    box(-350, 640, -130, 750, MAT_WALL),
  ],
  sponges: [],
  labels: [
    { x: -700, y: -160, text: 'ÉMETTEUR', tone: 'chaud' },
    { x: 20, y: -330, text: 'BERCEAU FROID', tone: 'froid' },
    { x: -440, y: 350, text: 'RÉCEPTEUR', tone: 'sas' },
    { x: 880, y: -80, text: 'PORTE', tone: 'chaud' },
    { x: 1110, y: 160, text: 'SAS', tone: 'sas' },
  ],
  lasers: [{ x: -700, y: -80, angle: 0 }],
  cibles: [{ x: -440, y: 260, r: 46 }],
  portes: [{ minX: 860, minY: -170, maxX: 900, maxY: 170, cible: 0 }],
}

// Tableau 9 — le prisme (laser, palier 2 : EAU = RÉFRACTION). Lecture :
// 1. le faisceau file au-dessus de l'étagère hydrophile et meurt sur un
//    pilier ; le récepteur est en dessous, hors de toute ligne droite ;
// 2. se coller à l'étagère, c'est placer son corps LIQUIDE dans le rayon :
//    la lumière se plie en le traversant — s'étaler ou se regrouper règle
//    la déviation, le corps est la lentille ;
// 3. cible à verrou, porte ouverte, sas. Le miroir renvoyait ; le prisme
//    dirige.
export const TABLEAU_9: LevelDef = {
  name: 'Le prisme',
  code: '21-I',
  journal:
    'À l’état liquide, il ne renvoie pas la lumière : il la PLIE. Le faisceau ressort de son corps dévié exactement où il le faut. L’optique appellerait ça un prisme vivant. Je ne sais plus lequel de nous deux conçoit les essais. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: -200, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  boxes: [
    // l'étagère hydrophile : le mouillage qui place le corps dans le rayon
    box(40, 60, 400, 130, MAT_HYDROPHILE),
    // le pilier qui absorbe la ligne droite
    box(760, 140, 820, 340, MAT_WALL),
    // la barrière de la porte
    box(900, -750, 940, -160, MAT_WALL),
    box(900, 160, 940, 750, MAT_WALL),
    // contreforts
    box(-500, -750, -320, -660, MAT_WALL),
    box(300, 660, 520, 750, MAT_WALL),
  ],
  sponges: [],
  labels: [
    { x: -900, y: 380, text: 'ÉMETTEUR', tone: 'chaud' },
    { x: 220, y: 20, text: 'HYDROPHILE', tone: 'phile' },
    { x: 660, y: 0, text: 'RÉCEPTEUR', tone: 'sas' },
    { x: 920, y: -60, text: 'PORTE', tone: 'chaud' },
    { x: 1110, y: 160, text: 'SAS', tone: 'sas' },
  ],
  lasers: [{ x: -900, y: 300, angle: 0 }],
  cibles: [{ x: 660, y: 80, r: 52 }],
  portes: [{ minX: 900, minY: -160, maxX: 940, maxY: 160, cible: 0 }],
}

// Tableau 10 — la voie de plasma (laser, palier 3 : VAPEUR + RAIL). Lecture :
// 1. un mur coupe la cuve ; le seul passage est tout en haut, hors de portée
//    de l'eau — et le rail magnétique le franchit ;
// 2. se vaporiser DANS le faisceau au pied du rail : l'arc s'ionise, le
//    champ le capture, il grimpe, franchit le passage, redescend — et le
//    CHAMP CONVOIE LA VAPEUR avec lui : le nuage voyage sur la ligne ;
// 3. l'arc allume le récepteur au bout du rail (verrou), la porte s'ouvre ;
//    le dépôt froid recondense le nuage — on finit le voyage en eau.
export const TABLEAU_10: LevelDef = {
  name: 'La voie de plasma',
  code: '21-J',
  journal:
    'Dans la vapeur, le faisceau devient un arc — et l’arc suit nos rails de champ comme un courant docile. Il s’est ionisé lui-même, et il a voyagé SUR la ligne, par-dessus le mur. Nous ne le testons plus. Nous l’équipons. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  boxes: [
    // le mur : la cuve est coupée, seul le haut est ouvert (y 520..750)
    box(160, -750, 240, 520, MAT_WALL),
    // le dépôt froid : recondenser après le voyage, cueillir la rosée
    box(700, -480, 820, -420, MAT_FROID),
    // la barrière de la porte
    box(900, -750, 940, -160, MAT_WALL),
    box(900, 160, 940, 750, MAT_WALL),
  ],
  sponges: [],
  labels: [
    { x: -700, y: 60, text: 'ÉMETTEUR', tone: 'chaud' },
    { x: -240, y: -60, text: 'PIED DU RAIL', tone: 'phobe' },
    { x: 200, y: 700, text: 'PASSAGE', tone: 'mur' },
    { x: 620, y: -60, text: 'RÉCEPTEUR', tone: 'sas' },
    { x: 760, y: -540, text: 'DÉPÔT FROID', tone: 'froid' },
    { x: 920, y: -60, text: 'PORTE', tone: 'chaud' },
    { x: 1110, y: 160, text: 'SAS', tone: 'sas' },
  ],
  lasers: [{ x: -700, y: 140, angle: 0 }],
  cibles: [{ x: 620, y: 20, r: 46 }],
  portes: [{ minX: 900, minY: -160, maxX: 940, maxY: 160, cible: 0 }],
  rails: [
    {
      points: [
        { x: -240, y: 140 },
        { x: -240, y: 560 },
        { x: 200, y: 640 },
        { x: 620, y: 560 },
        { x: 620, y: 60 },
      ],
    },
  ],
}

// Tableau 11 — les deux verrous (composition : MIROIR puis PRISME). La
// trilogie 21-H/I/J enseignait chaque optique seule ; ici les cibles à
// VERROU prennent tout leur sens : deux récepteurs, deux portes en série,
// et un seul corps qui change d'état entre les deux. Lecture :
// 1. verrou I : le faisceau bas meurt sur l'absorbeur ; gelé sur le berceau,
//    le corps le renvoie au récepteur I — la porte I se souvient ;
// 2. verrou II : le faisceau haut file au-dessus de l'étagère ; liquide et
//    collé à l'étagère, le corps le plie vers le récepteur II ;
// 3. les deux verrous tenus (dans l'ordre qu'on veut), le couloir s'ouvre.
export const TABLEAU_11: LevelDef = {
  name: 'Les deux verrous',
  code: '21-K',
  journal:
    'Deux verrous, deux états. Il s’est figé pour renvoyer le premier faisceau, puis répandu pour plier le second — sans une hésitation entre les deux. Nous pensions tester sa mémoire. C’est lui qui teste notre imagination. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  boxes: [
    // l'absorbeur du faisceau bas : la ligne droite ne mène nulle part
    box(520, -300, 580, 100, MAT_WALL),
    // le berceau froid du verrou I
    box(-160, -280, 200, -220, MAT_FROID),
    // l'étagère hydrophile du verrou II
    box(40, 260, 400, 330, MAT_HYDROPHILE),
    // barrière de la porte I
    box(860, -750, 900, -170, MAT_WALL),
    box(860, 170, 900, 750, MAT_WALL),
    // barrière de la porte II — le double sas d'énergie
    box(950, -750, 990, -160, MAT_WALL),
    box(950, 160, 990, 750, MAT_WALL),
    // contrefort de lecture
    box(-600, 660, -380, 750, MAT_WALL),
  ],
  sponges: [],
  labels: [
    { x: -700, y: -160, text: 'ÉMETTEUR I', tone: 'chaud' },
    { x: -900, y: 420, text: 'ÉMETTEUR II', tone: 'chaud' },
    { x: 20, y: -330, text: 'BERCEAU FROID', tone: 'froid' },
    { x: 220, y: 210, text: 'HYDROPHILE', tone: 'phile' },
    { x: -440, y: 350, text: 'RÉCEPTEUR I', tone: 'sas' },
    { x: 660, y: 380, text: 'RÉCEPTEUR II', tone: 'sas' },
    { x: 880, y: -80, text: 'PORTE I', tone: 'chaud' },
    { x: 970, y: 220, text: 'PORTE II', tone: 'chaud' },
    { x: 1110, y: 160, text: 'SAS', tone: 'sas' },
  ],
  lasers: [
    { x: -700, y: -80, angle: 0 },
    { x: -900, y: 500, angle: 0 },
  ],
  cibles: [
    { x: -440, y: 260, r: 46 },
    { x: 660, y: 280, r: 52 },
  ],
  portes: [
    { minX: 860, minY: -170, maxX: 900, maxY: 170, cible: 0 },
    { minX: 950, minY: -160, maxX: 990, maxY: 160, cible: 1 },
  ],
}

// Tableau 12 — à travers l'évent (composition : ÉVENT + VAPEUR + RAIL).
// La grille coupe la cuve sur toute sa hauteur : le liquide et la glace
// s'y arrêtent net — seule la VAPEUR passe. Lecture :
// 1. se vaporiser dans le faisceau au pied du rail (la colonne chaude aide) ;
// 2. l'arc s'ionise, le champ le capture — et le rail ENGAGÉ porte le nuage
//    entier de l'autre côté de la grille, même quand le faisceau ne touche
//    plus la vapeur : le champ se souvient de lui jusqu'au terminus ;
// 3. l'arc allume le récepteur au bout de la descente (verrou), la porte
//    s'ouvre ; le dépôt froid recondense le nuage — on finit en eau.
export const TABLEAU_12: LevelDef = {
  name: 'À travers l’évent',
  code: '21-L',
  journal:
    'L’évent l’arrête net à l’état liquide. Mais en vapeur il le traverse comme une rumeur passe une porte close — et le rail a porté son nuage jusqu’au bout de la ligne, même après que le faisceau l’a perdu. Le champ se souvient de lui. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  boxes: [
    // l'évent : toute la hauteur — l'eau s'arrête, la vapeur passe
    box(300, -750, 340, 750, MAT_GRILLE),
    // la colonne chaude : se vaporiser sans puiser dans les bonbonnes
    box(-320, -140, -160, -80, MAT_CHAUD),
    // le dépôt froid : recondenser après le voyage
    box(560, -360, 720, -300, MAT_FROID),
    // la barrière de la porte
    box(900, -750, 940, -160, MAT_WALL),
    box(900, 160, 940, 750, MAT_WALL),
    // contrefort de lecture
    box(-700, 620, -480, 750, MAT_WALL),
  ],
  sponges: [],
  labels: [
    { x: -700, y: 40, text: 'ÉMETTEUR', tone: 'chaud' },
    { x: -240, y: -200, text: 'COLONNE CHAUDE', tone: 'chaud' },
    { x: -260, y: 40, text: 'PIED DU RAIL', tone: 'phobe' },
    { x: 320, y: -420, text: 'ÉVENT', tone: 'grille' },
    { x: 620, y: 200, text: 'RÉCEPTEUR', tone: 'sas' },
    { x: 640, y: -420, text: 'DÉPÔT FROID', tone: 'froid' },
    { x: 920, y: -60, text: 'PORTE', tone: 'chaud' },
    { x: 1110, y: 160, text: 'SAS', tone: 'sas' },
  ],
  lasers: [{ x: -700, y: 100, angle: 0 }],
  cibles: [{ x: 700, y: 280, r: 46 }],
  portes: [{ minX: 900, minY: -160, maxX: 940, maxY: 160, cible: 0 }],
  rails: [
    {
      points: [
        { x: -200, y: 100 },
        { x: -200, y: 500 },
        { x: 700, y: 500 },
        { x: 700, y: 340 },
      ],
    },
  ],
}

// Tableau 13 — la traversée des états (finale : MIROIR, PRISME, ARC en
// enfilade). Trois chambres, trois verrous, un état par porte — le gant
// de l'échantillon. Lecture :
// 1. chambre du miroir : gelé sur le berceau, renvoyer le faisceau au
//    récepteur I — la porte I s'ouvre ;
// 2. chambre du prisme : liquide sur l'étagère, plier le faisceau vers le
//    récepteur II scellé à la paroi — la porte II s'ouvre ;
// 3. chambre de l'arc : vapeur dans le faisceau au pied du rail, l'arc
//    grimpe, franchit, redescend sur le récepteur III ; le dépôt froid
//    recondense — et le sas attend au bout.
export const TABLEAU_13: LevelDef = {
  name: 'La traversée des états',
  code: '21-M',
  journal:
    'Miroir, prisme, arc : trois salles, trois verrous, un seul échantillon. Il a changé d’état à chaque porte, dans l’ordre exact, comme s’il relisait nos plans par-dessus mon épaule. Je signe le rapport : ce n’est plus un échantillon. C’est un équipier. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  boxes: [
    // chambre I — le berceau froid du miroir
    box(-720, -280, -440, -220, MAT_FROID),
    // cloison I
    box(-400, -750, -360, -170, MAT_WALL),
    box(-400, 170, -360, 750, MAT_WALL),
    // chambre II — l'étagère hydrophile du prisme
    box(-160, 60, 120, 130, MAT_HYDROPHILE),
    // cloison II
    box(300, -750, 340, -170, MAT_WALL),
    box(300, 170, 340, 750, MAT_WALL),
    // chambre III — la colonne chaude au pied du rail, le dépôt froid après
    box(500, -60, 660, 0, MAT_CHAUD),
    box(700, -420, 860, -360, MAT_FROID),
    // cloison III — la dernière porte avant le sas
    box(980, -750, 1020, -160, MAT_WALL),
    box(980, 160, 1020, 750, MAT_WALL),
  ],
  sponges: [],
  labels: [
    { x: -1100, y: -160, text: 'ÉMETTEUR I', tone: 'chaud' },
    { x: -580, y: -330, text: 'BERCEAU FROID', tone: 'froid' },
    { x: -380, y: 220, text: 'PORTE I', tone: 'chaud' },
    { x: -330, y: 240, text: 'ÉMETTEUR II', tone: 'chaud' },
    { x: -20, y: 10, text: 'HYDROPHILE', tone: 'phile' },
    { x: 320, y: 220, text: 'PORTE II', tone: 'chaud' },
    { x: 380, y: 80, text: 'ÉMETTEUR III', tone: 'chaud' },
    { x: 580, y: -110, text: 'COLONNE CHAUDE', tone: 'chaud' },
    { x: 780, y: -480, text: 'DÉPÔT FROID', tone: 'froid' },
    { x: 1000, y: 220, text: 'PORTE III', tone: 'chaud' },
    { x: 1110, y: 160, text: 'SAS', tone: 'sas' },
  ],
  lasers: [
    { x: -1100, y: -80, angle: 0 },
    { x: -330, y: 300, angle: 0 },
    { x: 380, y: 140, angle: 0 },
  ],
  cibles: [
    { x: -960, y: 260, r: 46 },
    // scellé en façade de la porte II : le faisceau plié vient mourir dessus
    { x: 285, y: 160, r: 46 },
    { x: 900, y: 260, r: 46 },
  ],
  portes: [
    { minX: -400, minY: -170, maxX: -360, maxY: 170, cible: 0 },
    { minX: 300, minY: -170, maxX: 340, maxY: 170, cible: 1 },
    { minX: 980, minY: -160, maxX: 1020, maxY: 160, cible: 2 },
  ],
  rails: [
    {
      points: [
        { x: 600, y: 140 },
        { x: 600, y: 540 },
        { x: 900, y: 540 },
        { x: 900, y: 320 },
      ],
    },
  ],
}

// ---- L'école des surfaces : trois leçons hors expédition -----------------
// Trois tableaux didactiques, joués en tête de la file d'essai : chacun ne
// montre QUE des surfaces et des régimes, sans énigme — on traverse, on
// comprend, on sort. Les étiquettes font la leçon, le journal la raconte.

// École I — les trois caractères de paroi : absorber, repousser, retenir.
export const TABLEAU_S1: LevelDef = {
  name: 'L’école des parois',
  code: '21-S1',
  journal:
    'Première leçon. La PAROI absorbe tout — même la lumière. L’HYDROPHOBE le repousse : il rebondit sans mouiller. L’HYDROPHILE le retient : il s’y colle, y rampe, et paie une impulsion pour s’en arracher. Trois surfaces, trois caractères. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  boxes: [
    // la cloison d'entrée : paroi en bas, hydrophobe en haut, passage entre
    box(-560, -750, -500, -140, MAT_WALL),
    box(-560, 140, -500, 750, MAT_HYDROPHOBE),
    // l'îlot hydrophile au centre : le mouillage se sent avant de se lire
    box(-80, -160, 240, -40, MAT_HYDROPHILE),
    // un plot hydrophobe isolé : le rebond se teste sans conséquence
    box(480, 240, 620, 380, MAT_HYDROPHOBE),
  ],
  sponges: [],
  labels: [
    { x: -640, y: -400, text: 'PAROI — ABSORBE', tone: 'mur' },
    { x: -640, y: 400, text: 'HYDROPHOBE — REPOUSSE', tone: 'phobe' },
    { x: 80, y: -230, text: 'HYDROPHILE — RETIENT', tone: 'phile' },
    { x: 550, y: 440, text: 'HYDROPHOBE', tone: 'phobe' },
    { x: 1110, y: 160, text: 'SAS', tone: 'sas' },
  ],
}

// École II — les climats : le froid fige, le chaud disperse, la grille
// trie les états, l'éponge boit ce qu'on lui abandonne.
export const TABLEAU_S2: LevelDef = {
  name: 'L’école des climats',
  code: '21-S2',
  journal:
    'Deuxième leçon, les climats : le FROID le fige, le CHAUD le disperse, l’ÉVENT n’arrête que ses formes denses — et l’ÉPONGE boit ce qu’on lui abandonne. Il a passé l’évent en vapeur et s’est recomposé sur le dépôt froid, comme s’il lisait les étiquettes. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  boxes: [
    // la plaque froide au sol : s'y attarder, c'est geler — et le voir venir
    box(-240, -520, 40, -460, MAT_FROID),
    // le mur aux trois portes : membrane en bas (l'eau suinte), passage au
    // centre, rideau en haut (la glace l'écarte) — chaque état a sa porte
    box(140, -750, 180, -160, MAT_MEMBRANE),
    box(140, 160, 180, 750, MAT_RIDEAU),
    // le radiateur : la vaporisation gratuite, à hauteur de route
    box(220, -80, 380, -20, MAT_CHAUD),
    // l'évent pleine hauteur : l'eau s'arrête, la vapeur passe
    box(640, -750, 680, 750, MAT_GRILLE),
    // le dépôt froid de l'autre côté : se recomposer avant le sas
    box(780, -320, 920, -260, MAT_FROID),
  ],
  sponges: [
    // l'éponge d'angle : la perte se constate sur un coin, pas sur la route
    { minX: -620, minY: -750, cols: 2, rows: 20, cellSize: 24, capacityPerCell: 5 },
  ],
  labels: [
    { x: -570, y: -200, text: 'ÉPONGE — BOIT', tone: 'eponge' },
    { x: -100, y: -580, text: 'PLAQUE FROIDE — FIGE', tone: 'froid' },
    { x: 160, y: -420, text: 'MEMBRANE — SEUL LE LIQUIDE PASSE', tone: 'phile' },
    { x: 160, y: 420, text: 'RIDEAU — SEULE LA GLACE PASSE', tone: 'froid' },
    { x: 300, y: 40, text: 'CHAUDIÈRE — DISPERSE', tone: 'chaud' },
    { x: 660, y: -420, text: 'ÉVENT — SEULE LA VAPEUR PASSE', tone: 'grille' },
    { x: 850, y: -380, text: 'DÉPÔT FROID', tone: 'froid' },
    { x: 1110, y: 160, text: 'SAS', tone: 'sas' },
  ],
}

// École III — les zones : certaines régions IMPOSENT leur état, d'autres
// rendent le choix. On entre glace, on sort vapeur, on revient eau.
export const TABLEAU_S3: LevelDef = {
  name: 'L’école des zones',
  code: '21-S3',
  journal:
    'Troisième leçon : certaines régions IMPOSENT leur état — un hublot fendu glace tout ce qui passe, une conduite rompue vaporise. Entre les deux, la zone libre lui rend le choix. Il est entré glace, sorti vapeur, revenu liquide. Les états ne sont pas des formes : ce sont des langues, et il les parle toutes. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  boxes: [
    // le dépôt froid avant le sas : finir le voyage en eau
    box(800, -300, 940, -240, MAT_FROID),
  ],
  sponges: [],
  zones: [
    { minX: -560, minY: -750, maxX: -280, maxY: 750, force: 'glace' },
    { minX: -40, minY: -750, maxX: 200, maxY: 750, force: 'libre', label: 'ZONE LIBRE' },
    { minX: 420, minY: -750, maxX: 680, maxY: 750, force: 'vapeur' },
  ],
  labels: [
    { x: -420, y: -420, text: 'HUBLOT FENDU — GLACE', tone: 'froid' },
    { x: 80, y: -420, text: 'ZONE LIBRE — AU CHOIX', tone: 'phile' },
    { x: 550, y: -420, text: 'CONDUITE ROMPUE — VAPEUR', tone: 'chaud' },
    { x: 870, y: -360, text: 'DÉPÔT FROID', tone: 'froid' },
    { x: 1110, y: 160, text: 'SAS', tone: 'sas' },
  ],
}

// Les trois leçons, dans l'ordre : parois, climats, zones. En tête de la
// file d'essai des salles, et proposées à l'éditeur comme tout le reste.
export const TABLEAUX_ECOLE: LevelDef[] = [TABLEAU_S1, TABLEAU_S2, TABLEAU_S3]

// L'ordre de la partie : chaque tableau enseigne une chose, les derniers
// les combinent — la trilogie laser révèle la fonction de l'échantillon
// (miroir, prisme, plasma), la seconde trilogie compose ces fonctions
// (double verrou, grille, traversée) — et la dérive conclut sur la
// maîtrise pure.
export const TABLEAUX: LevelDef[] = [
  TABLEAU_1,
  TABLEAU_2,
  TABLEAU_3,
  TABLEAU_5,
  TABLEAU_6,
  TABLEAU_4,
  TABLEAU_8,
  TABLEAU_9,
  TABLEAU_10,
  TABLEAU_11,
  TABLEAU_12,
  TABLEAU_13,
  TABLEAU_7,
]

export function pointInBox(
  x: number,
  y: number,
  b: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY
}
