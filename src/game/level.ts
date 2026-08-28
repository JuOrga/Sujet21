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
export const MAT_MIROIR = 10 // miroir fixe : mur poli qui RÉFLÉCHIT le faisceau laser — le corps y bute comme sur une paroi

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
  // 0/absent standard, 1 caissons, 2 conduites, 3 poutrelle, 4 blindage,
  // 5 aération, 6 hublots, 7 écrans, 8 câbles, 9 VITRE. La vitre est le seul
  // habillage qui change ce qu'on VOIT : le corps y bute comme sur n'importe
  // quelle paroi, mais la salle se lit au travers et la lumière la traverse
  // (son ombre portée n'est qu'un voile — cf. vitreTrans dans le rendu).
  skin?: number
  // FORME de la pièce (formes.ts) : absent/0 rectangle — le chemin rapide.
  // 1 disque (ellipse inscrite), 2 capsule, 3 coin (triangle), 4 arc.
  // La boîte min/max reste la boîte englobante : budget, picking et
  // sérialisation ne changent pas.
  forme?: number
  p0?: number // COIN : orientation 0..3 · ARC : épaisseur relative 0..1
  p1?: number // ARC : demi-ouverture en degrés
  p2?: number // ARC : bouts (0 arrondis, 1 droits à 90°, 2 en pointe)
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
  b: {
    minX: number
    minY: number
    maxX: number
    maxY: number
    angle?: number
    forme?: number
    p0?: number
    p1?: number
  },
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
  if (
    r.minX >= b.maxX ||
    r.maxX <= b.minX ||
    r.minY >= b.maxY ||
    r.maxY <= b.minY
  )
    return [b]
  const out: ObstacleBox[] = []
  const garde = (
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): void => {
    if (maxX - minX >= 1 && maxY - minY >= 1)
      out.push({ minX, minY, maxX, maxY, material: b.material })
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
export function subtractBoxOblique(
  perdante: ObstacleBox,
  gagnante: ObstacleBox,
): ObstacleBox[] | null {
  // la soustraction exacte n'existe qu'entre rectangles : une FORME dans le
  // duel, et l'on refuse — comme pour des angles différents
  if (perdante.forme || gagnante.forme) return null
  const a = perdante.angle ?? 0
  const b = gagnante.angle ?? 0
  const delta = Math.abs(((((a - b) % 360) + 540) % 360) - 180) // écart à 180 ↔ 0/360
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
    return {
      minX: wx - hx,
      minY: wy - hy,
      maxX: wx + hx,
      maxY: wy + hy,
      material: m.material,
      angle: a,
    }
  })
}

// Ronge une ÉPONGE : retire le rectangle `r` de sa grille. Une éponge est
// une GRILLE de cellules — on ne peut pas la découper n'importe où : on
// retire les cellules dont le CENTRE tombe dans le rectangle, et ce qui
// reste se redit en 4 éponges au plus (gauche, droite, dessous, dessus),
// toutes calées sur la même trame. Le pendant de subtractBox, en cellules.
export function subtractSponge(
  sp: SpongeDef,
  r: { minX: number; minY: number; maxX: number; maxY: number },
): SpongeDef[] {
  const cs = sp.cellSize
  const maxX = sp.minX + sp.cols * cs
  const maxY = sp.minY + sp.rows * cs
  // pas de recouvrement : l'éponge reste entière
  if (
    r.minX >= maxX ||
    r.maxX <= sp.minX ||
    r.minY >= maxY ||
    r.maxY <= sp.minY
  )
    return [sp]
  // les colonnes et rangées dont le centre est pris dans le rectangle
  const c0 = Math.max(0, Math.ceil((r.minX - sp.minX) / cs - 0.5))
  const c1 = Math.min(sp.cols - 1, Math.floor((r.maxX - sp.minX) / cs - 0.5))
  const l0 = Math.max(0, Math.ceil((r.minY - sp.minY) / cs - 0.5))
  const l1 = Math.min(sp.rows - 1, Math.floor((r.maxY - sp.minY) / cs - 0.5))
  if (c0 > c1 || l0 > l1) return [sp] // le rectangle passe entre les centres
  const out: SpongeDef[] = []
  const garde = (cA: number, lA: number, nc: number, nl: number): void => {
    if (nc < 1 || nl < 1) return
    out.push({
      minX: sp.minX + cA * cs,
      minY: sp.minY + lA * cs,
      cols: nc,
      rows: nl,
      cellSize: cs,
      capacityPerCell: sp.capacityPerCell,
    })
  }
  garde(0, 0, c0, sp.rows) // à gauche de la découpe
  garde(c1 + 1, 0, sp.cols - 1 - c1, sp.rows) // à droite
  garde(c0, 0, c1 - c0 + 1, l0) // dessous
  garde(c0, l1 + 1, c1 - c0 + 1, sp.rows - 1 - l1) // dessus
  return out
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
  tone:
    | 'mur'
    | 'phile'
    | 'phobe'
    | 'eponge'
    | 'froid'
    | 'grille'
    | 'sas'
    | 'chaud'
  // PORTÉE de la pancarte, quand la place manque à l'écran : « secteur »
  // nomme un LIEU (elle survit au dézoom — c'est la légende du plan),
  // « detail » commente un objet (elle s'efface dès qu'elle gênerait).
  // Deux pancartes ne se chevauchent JAMAIS : celle de moindre portée cède.
  rang?: 'secteur' | 'detail'
  // PICTOGRAMME D'ÉTAT (bible v3.1, hub compact) : une indication pour les
  // HUMAINS — aucun impact joueur. Un rectangle à la couleur du matériau,
  // et trois rangées de points (EAU, GLACE, VAPEUR) notées 0..3 :
  // 0 totalement inefficace · 1 ça confine · 2 c'est efficace · 3 l'outil
  // idéal pour gérer l'état. Sans texte — volontairement énigmatique.
  picto?: { couleur: string; eau: number; glace: number; vapeur: number }
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
  // Déclencheur de cinématique : le code d'une cinématique (montage) jouée
  // quand le corps ENTRE dans la zone — une fois par essai. Une zone
  // « libre » avec un code est un pur déclencheur, sans effet d'état.
  cine?: string
  // Déclencheur de SÉQUENCE in-map (lampes, sirène, brèche…) : même règle,
  // une fois par essai, à l'entrée du corps dans la zone.
  sequence?: string
}

// Décalque de décor : machinerie plaquée sur la paroi (tuyaux, vanne).
// Aucune physique, aucune règle — seulement la preuve que quelqu'un a
// construit cet endroit avant de l'abandonner.
export interface DecalDef {
  x: number
  y: number
  w: number
  h: number
  kind:
    | 'tuyaux'
    | 'vanne'
    | 'ecran-off'
    | 'ecran-on'
    | 'fiole-pleine'
    | 'fiole-vide'
    // LA SERRE (cultures hydroponiques) — décor du niveau serre
    | 'serre-ble-nain'
    | 'serre-rampe'
    | 'serre-rampe-a'
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
  intensite?: number // 0..2 ; absente : 1 — 0 : lampe éteinte (le corps reste)
  couleur?: string // '#rrggbb' ; absente : blanc neutre
  // Le LUMINAIRE (l'objet visible, qui n'éclaire rien de plus) :
  taille?: number // échelle 0..3 ; absente : 1 — 0 : aucun luminaire dessiné
  forme?: 'bandeau' // absente : plafonnier rond (l'éclipse)
  longueur?: number // bandeau seulement : longueur totale (u monde) ; absente : 260
  angle?: number // bandeau seulement : degrés ; absente : 0 (horizontal)
}

// LUMIÈRE GÉNÉRALE du tableau : le plancher d'ambiance — la part de
// lumière que la pièce garde LÀ OÙ AUCUNE LAMPE ne porte. 0,52 est le
// niveau historique (les tableaux existants ne bougent pas) ; 0 éteint
// tout hors des lampes — le noir total existe enfin, et les lampes
// deviennent une mécanique de conception à part entière.
export const AMBIANTE_DEFAUT = 0.52

// Les variantes de plafond LIVRÉES (suggestions de l'éditeur) : le champ
// reste libre — toute variante nommée « x » cherche plafond-x.webp.
export const PLAFONDS_CONNUS: string[] = [
  'planete',
  'givre',
  'observatoire',
  'breche',
  'chaufferie',
  'helice',
]

export const LAMPE_HAUTEUR_DEFAUT = 420
export const LAMPE_HAUTEUR_MIN = 80
export const LAMPE_HAUTEUR_MAX = 2000
export const LAMPE_COULEUR_DEFAUT = '#ffffff'

/** '#rrggbb' → [r, g, b] dans 0..1 — null si la chaîne n'est pas une couleur. */
export function lampeCouleurRVB(
  c: string | undefined,
): [number, number, number] | null {
  if (!c || !/^#[0-9a-fA-F]{6}$/.test(c)) return null
  return [
    parseInt(c.slice(1, 3), 16) / 255,
    parseInt(c.slice(3, 5), 16) / 255,
    parseInt(c.slice(5, 7), 16) / 255,
  ]
}

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
  // N° LOGIQUE du récepteur — celui que les portes visent. Absent : sa
  // position dans la liste (indice + 1). Plusieurs pastilles peuvent porter
  // le même numéro : elles forment un CANAL, et chaque porte choisit sa
  // règle (une seule suffit, ou toutes à la fois).
  canal?: number
}

// Une porte est une paroi asservie : FERMÉE tant que sa cible est éteinte,
// ouverte (et traversante) tant qu'elle est allumée.
export interface PorteDef {
  minX: number
  minY: number
  maxX: number
  maxY: number
  // N° de CANAL — le numéro affiché sur les pastilles qui commandent cette
  // porte (CibleDef.canal). NÉGATIF : porte SCÉNARISÉE, qu'aucun faisceau
  // n'ouvre. Elle reste une paroi pleine jusqu'à ce qu'une séquence in-map
  // la crève (la brèche).
  canal: number
  // Quand PLUSIEURS pastilles portent ce numéro : 'et' exige qu'elles
  // soient TOUTES actives en même temps ; absente ('ou'), une seule suffit.
  regle?: 'et'
}

// Une CACHETTE : un pan de la carte voilé tant que l'échantillon n'y est
// pas entré — le voile se dissipe à l'entrée du corps et reste levé pour
// l'essai (Recommencer re-voile). Purement visuel : la physique du tableau
// ne change pas, ce qui est caché existe et fonctionne — on ne le VOIT
// simplement pas. Deux styles de voile : le BROUILLARD « non cartographié »
// (défaut) et la PAROI FACTICE — rendue comme une vraie paroi par le
// moteur, ombres portées comprises, qui se dissout à l'entrée. La cachette
// prend toutes les FORMES des obstacles (disque, capsule, coin, arc) et
// leur rotation : c'est une FormeBox, comme les parois.
export interface CacheDef {
  minX: number
  minY: number
  maxX: number
  maxY: number
  angle?: number // degrés, rotation autour du centre
  forme?: number // formes.ts — absent : rectangle
  p0?: number // COIN : orientation 0..3 · ARC : épaisseur relative
  p1?: number // ARC : demi-ouverture en degrés
  p2?: number // ARC : bouts (0 arrondis, 1 droits à 90°, 2 en pointe)
  style?: 'paroi' // absent : brouillard
}

// Une PASTILLE DE CONDENSAT : de la matière pure posée dans le tableau,
// bue au contact du corps — la monnaie de RUN (purgée en fin de run).
// La plupart des tableaux n'en déclarent pas : le semis automatique
// (condensat.ts) en pose dans les cachettes et au large, déterministe par
// code. En déclarer ici REMPLACE le semis (contrôle d'auteur).
export interface CondensatPose {
  x: number
  y: number
  cl: number // la valeur en centilitres
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
  caches?: CacheDef[] // cachettes voilées (brouillard levé à l'entrée du corps)
  condensats?: CondensatPose[] // pastilles posées main (sinon : semis auto)
  // L'EMPLACEMENT DE FIOLE posé main (un seul par tableau) — absent : le
  // semis automatique décide (la cachette la plus profonde, une chance
  // sur deux). En jeu, la fiole n'apparaît que si la collection du
  // joueur est incomplète.
  fiole?: { x: number; y: number }
  // Lampes posées à l'éditeur (au plus MAX_LUMIERES allumées). Absentes :
  // la lampe par défaut de la cuve fait l'éclairage.
  lumieres?: LumiereDef[]
  ambiante?: number // lumière générale 0..1 ; absente : AMBIANTE_DEFAUT
  brume?: number // brume d'ambiance 0..1 ; absente : 0 — des nappes qui dérivent
  // PLAFOND DU REFLET : la variante que la surface MIROITANTE renvoie.
  // Absente : plafond.webp (les verrières). « planete » charge
  // plafond-planete.webp — déposer le fichier, nommer la variante ici.
  plafond?: string

  par?: number // budget d'impulsions visé : franchissable en `par`, record en dessous
  // Dashs rendus à CHAQUE transformation en vapeur (règle d'or : 3 par
  // bascule, quel que soit le volume). Absent : le réglage du banc
  // (gasDashBudget).
  dashBudget?: number
  // LE CYCLE DES ÉTATS en descente : absent (ou 'cycle'), les
  // transformations MANUELLES obéissent aux mémoires tissées — 'libres',
  // les trois états restent au bouton quoi qu'il en soit (tableaux
  // d'atelier, leçons qui exigent un état avant son tissage). Les zones
  // forcées et la chaudière transforment toujours, dans les deux cas.
  etats?: 'cycle' | 'libres'
  // Les états que ce tableau EXIGE au bouton pour être bouclé (déclaré
  // dans l'éditeur) : la voie ne propose pas sa « suite écrite » tant que
  // le lien manuel correspondant n'est pas tissé à l'écran des mémoires.
  exige?: ('glace' | 'vapeur')[]
  // Lit musical imposé par le tableau. Sans valeur, la cuve suit le
  // refroidissement de la coque (tiède → glaciale) : c'est le cas général,
  // les tableaux n'ont pas à choisir une musique pour exister.
  ambiance?: string
  // RACCOURCI (roguelike) : si présent, le sas de CE tableau envoie
  // directement à la salle portant ce code — en sautant les intermédiaires
  // (vers l'avant uniquement ; un code inconnu retombe sur salle+1). Permet
  // des salles-raccourcis secrètes qui accélèrent les runs déjà maîtrisées.
  raccourciVers?: string
  // CINÉMATIQUES ancrées au tableau (codes du montage) : `cineAvant` se joue
  // à l'ENTRÉE dans le tableau (pas au simple R), `cineApres` à sa
  // CONCLUSION (le sas bu), par-dessus le bilan. Le déclencheur EN COURS de
  // tableau est une zone portant un code (ZoneDef.cine). Un code inconnu
  // sur le poste est simplement ignoré.
  cineAvant?: string
  cineApres?: string
  // SÉQUENCE in-map jouée dès l'entrée dans le tableau : la mise en scène
  // qui agit sur le monde (lampes, sons, brèche, secousse, cartes).
  sequence?: string
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
  [MAT_MIROIR]: 'Miroir',
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
  return z.label && z.label.trim()
    ? z.label.trim().toUpperCase()
    : ZONE_CAUSES[z.force]
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
    0.955 +
    0.02 * Math.sin(3 * th + p1) +
    0.012 * Math.sin(5 * th + p2) +
    0.008 * Math.sin(8 * th + p3)
  return d / w
}

/** Le contour de la lisière, pour l'éditeur (polygone en coordonnées monde). */
export function zoneOutline(
  z: ZoneDef,
  steps = 64,
): { x: number; y: number }[] {
  const cx = (z.minX + z.maxX) * 0.5
  const cy = (z.minY + z.maxY) * 0.5
  const hx = (z.maxX - z.minX) * 0.5
  const hy = (z.maxY - z.minY) * 0.5
  const [p1, p2, p3] = zonePhases(z)
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < steps; i++) {
    const th = (i / steps) * Math.PI * 2
    const w =
      0.955 +
      0.02 * Math.sin(3 * th + p1) +
      0.012 * Math.sin(5 * th + p2) +
      0.008 * Math.sin(8 * th + p3)
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

function box(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  material: number,
): ObstacleBox {
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
    {
      minX: 560,
      minY: -360,
      cols: 2,
      rows: 30,
      cellSize: 24,
      capacityPerCell: 5,
    },
    // couloir bas tapissé : deux lèvres d'éponge, la glace passe entre elles
    {
      minX: 660,
      minY: -420,
      cols: 10,
      rows: 2,
      cellSize: 24,
      capacityPerCell: 4,
    },
    {
      minX: 660,
      minY: -750,
      cols: 10,
      rows: 2,
      cellSize: 24,
      capacityPerCell: 4,
    },
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
    {
      minX: 560,
      minY: -750,
      cols: 2,
      rows: 35,
      cellSize: 24,
      capacityPerCell: 5,
    },
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
    {
      x: -1105,
      y: -180,
      w: 150,
      h: 150,
      kind: 'tuyaux',
      flip: true,
      fade: 0.45,
    },
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
  portes: [{ minX: 860, minY: -170, maxX: 900, maxY: 170, canal: 1 }],
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
  portes: [{ minX: 900, minY: -160, maxX: 940, maxY: 160, canal: 1 }],
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
  portes: [{ minX: 900, minY: -160, maxX: 940, maxY: 160, canal: 1 }],
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
    { minX: 860, minY: -170, maxX: 900, maxY: 170, canal: 1 },
    { minX: 950, minY: -160, maxX: 990, maxY: 160, canal: 2 },
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
  portes: [{ minX: 900, minY: -160, maxX: 940, maxY: 160, canal: 1 }],
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
    { minX: -400, minY: -170, maxX: -360, maxY: 170, canal: 1 },
    { minX: 300, minY: -170, maxX: 340, maxY: 170, canal: 2 },
    { minX: 980, minY: -160, maxX: 1020, maxY: 160, canal: 3 },
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
    {
      minX: -620,
      minY: -750,
      cols: 2,
      rows: 20,
      cellSize: 24,
      capacityPerCell: 5,
    },
  ],
  labels: [
    { x: -570, y: -200, text: 'ÉPONGE — BOIT', tone: 'eponge' },
    { x: -100, y: -580, text: 'PLAQUE FROIDE — FIGE', tone: 'froid' },
    {
      x: 160,
      y: -420,
      text: 'MEMBRANE — SEUL LE LIQUIDE PASSE',
      tone: 'phile',
    },
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
    {
      minX: -40,
      minY: -750,
      maxX: 200,
      maxY: 750,
      force: 'libre',
      label: 'ZONE LIBRE',
    },
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

// ---- LA GAMME : les cellules d'étalonnage, en sortie du hub --------------
// Cinq tableaux courts joués EN TÊTE de l'expédition. La règle d'or de la
// courbe de difficulté : UNE nouveauté par salle, jamais deux — et chaque
// nouveauté s'apprend en trois temps dans la même salle (kata) :
//   1. SANS DANGER : la surface se touche hors de la route, pour voir ;
//   2. SUR LA ROUTE : il faut composer avec ;
//   3. RETOURNÉE : la surface devient l'outil qui fait gagner.
// La lecture reste honnête (pancartes + pictogrammes à la première
// rencontre, jamais deux auras qui se chevauchent) ; le plafond de maîtrise
// vient du `par` et des records, pas de la lecture. La lumière fait partie
// de la leçon : chaque surface nouvelle est éclairée à sa couleur, le sas
// porte toujours sa balise verte — l'œil apprend le langage avant la tête.

// Gamme 1 — le corps seul : l'inertie, le coût des impulsions, le sas.
export const TABLEAU_G1: LevelDef = {
  name: 'Le berceau',
  code: '21-01',
  journal:
    'Étalonnage, cellule 1. Première dérive libre : chaque impulsion éjecte une part de lui-même — il l’a compris au deuxième essai, et depuis il économise ses gouttes comme un vieux pilote son carburant. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  par: 5,
  boxes: [
    // la porte du berceau : deux piliers, ouverture impossible à manquer
    box(-560, -750, -480, -320, MAT_WALL),
    box(-560, 320, -480, 750, MAT_WALL),
    // l'îlot rond au centre : contourner, c'est piloter
    {
      minX: -40,
      minY: -140,
      maxX: 240,
      maxY: 140,
      material: MAT_WALL,
      forme: 1,
    },
    // l'entonnoir du sas : la sortie se présente toute seule
    box(760, -750, 840, -340, MAT_WALL),
    box(760, 340, 840, 750, MAT_WALL),
  ],
  sponges: [],
  labels: [
    {
      x: -520,
      y: 260,
      text: 'PAROI — ABSORBE',
      tone: 'mur',
      picto: { couleur: '#5b7ba6', eau: 1, glace: 0, vapeur: 1 },
    },
    {
      x: 100,
      y: 240,
      text: 'CHAQUE IMPULSION COÛTE UNE GOUTTE',
      tone: 'mur',
      rang: 'secteur',
    },
    { x: 1110, y: 180, text: 'SAS — LE COLLECTEUR', tone: 'sas' },
  ],
  decals: [
    { x: -1080, y: 420, w: 160, h: 160, kind: 'tuyaux', fade: 0.45 },
    { x: 460, y: -640, w: 150, h: 225, kind: 'vanne', fade: 0.4 },
  ],
  // Lumière (refonte contraste) : AMBIANTE NULLE — toute la lumière vient
  // des lampes. Des BANDES posées BAS le long des parois neutres (h 140-190) :
  // les ombres s'allongent, nettes, et sculptent la salle. La balise verte
  // du sas reste le repère commun.
  lumieres: [
    {
      x: -450,
      y: 0,
      forme: 'bandeau',
      longueur: 620,
      angle: 90,
      h: 170,
      portee: 850,
      intensite: 1.15,
      taille: 1,
    },
    {
      x: 700,
      y: 0,
      forme: 'bandeau',
      longueur: 520,
      angle: 90,
      h: 150,
      portee: 700,
      intensite: 1.0,
      couleur: '#dfe8f2',
      taille: 1,
    },
    {
      x: 1110,
      y: 0,
      h: 300,
      portee: 520,
      intensite: 1.0,
      couleur: '#3fd69b',
      taille: 1,
    },
  ],
  ambiante: 0,
}

// Gamme 2 — le rebond : l'hydrophobe repousse sans prendre une goutte.
export const TABLEAU_G2: LevelDef = {
  name: 'Le rebond',
  code: '21-02',
  journal:
    'Cellule 2, revêtement répulsif. Il a touché la paroi une fois, par curiosité — repoussé sans une goutte perdue. Au troisième passage il jouait au billard avec nos cloisons. Le rebond ne lui coûte rien : c’est nous qu’il use. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: 260, maxX: 1180, maxY: 500 },
  par: 6,
  boxes: [
    // 1. le plot d'essai, hors de la route : toucher pour voir
    box(-700, -420, -560, -280, MAT_HYDROPHOBE),
    // 2. la chicane : deux pans décalés, la ligne droite est fermée mais
    //    les ouvertures sont larges — on slalome, ou on rebondit
    box(-180, -750, -100, 120, MAT_HYDROPHOBE),
    box(220, -120, 300, 750, MAT_HYDROPHOBE),
    // 3. la bande de billard : un rebond dessus dépose au sas — la route
    //    à une impulsion, pour ceux qui ont compris
    box(640, 420, 860, 540, MAT_HYDROPHOBE),
    // la lèvre neutre sous le sas : on grimpe, on ne rase pas le sol
    box(880, -750, 960, 60, MAT_WALL),
  ],
  sponges: [],
  labels: [
    {
      x: -630,
      y: -200,
      text: 'HYDROPHOBE — REPOUSSE',
      tone: 'phobe',
      picto: { couleur: '#9e6bc7', eau: 2, glace: 1, vapeur: 1 },
    },
    { x: 60, y: 400, text: 'LA CHICANE', tone: 'phobe', rang: 'secteur' },
    { x: 750, y: 600, text: 'BANDE DE BILLARD', tone: 'phobe' },
    { x: 1110, y: 560, text: 'SAS', tone: 'sas' },
  ],
  decals: [{ x: -1080, y: -500, w: 150, h: 150, kind: 'tuyaux', fade: 0.4 }],
  // Lumière (refonte contraste) : AMBIANTE NULLE — toute la lumière vient
  // des lampes. Des BANDES posées BAS le long des parois neutres (h 140-190) :
  // les ombres s'allongent, nettes, et sculptent la salle. La balise verte
  // du sas reste le repère commun.
  lumieres: [
    {
      x: -100,
      y: -680,
      forme: 'bandeau',
      longueur: 1200,
      angle: 0,
      h: 180,
      portee: 820,
      intensite: 1.15,
      taille: 1,
    },
    {
      x: -740,
      y: -350,
      forme: 'bandeau',
      longueur: 380,
      angle: 90,
      h: 140,
      portee: 520,
      intensite: 0.95,
      couleur: '#9e6bc7',
      taille: 1,
    },
    {
      x: 750,
      y: 600,
      h: 240,
      portee: 460,
      intensite: 0.95,
      couleur: '#cfd8e6',
      taille: 1,
    },
    {
      x: 1110,
      y: 380,
      h: 300,
      portee: 500,
      intensite: 1.0,
      couleur: '#3fd69b',
      taille: 1,
    },
  ],
  ambiante: 0,
}

// Gamme 3 — l'ancrage : l'hydrophile retient ; s'arracher coûte, viser paie.
export const TABLEAU_G3: LevelDef = {
  name: 'L’ancrage',
  code: '21-03',
  journal:
    'Cellule 3, revêtement mouillant. La surface le retient — il s’y colle, y rampe, s’y repose. S’en arracher lui coûte une impulsion : il ne s’arrache donc que lorsqu’il a fini de viser. Nous lui avons offert des ancres ; il en a fait des affûts. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  par: 6,
  boxes: [
    // 1. le tapis d'accueil, posé SUR la dérive naturelle : la leçon vous
    //    arrive dessus — la surface attrape, et il faut payer pour partir
    box(-660, -80, -460, 40, MAT_HYDROPHILE),
    // 2. le virage : un pilier force à passer par-dessus, et son sommet
    //    porte une étagère mouillante — l'ancre qui casse l'élan au virage
    box(-160, -750, -80, 240, MAT_WALL),
    box(-180, 240, -60, 320, MAT_HYDROPHILE),
    // 3. l'affût : la fenêtre est étroite, mais le perchoir est en face —
    //    s'ancrer, viser, une seule impulsion la traverse
    box(480, -60, 660, 40, MAT_HYDROPHILE),
    box(760, -750, 840, -80, MAT_WALL),
    box(760, 160, 840, 750, MAT_WALL),
  ],
  sponges: [],
  labels: [
    {
      x: -560,
      y: -160,
      text: 'HYDROPHILE — RETIENT',
      tone: 'phile',
      picto: { couleur: '#3fae9c', eau: 0, glace: 1, vapeur: 1 },
    },
    {
      x: -120,
      y: 400,
      text: 'S’ARRACHER COÛTE UNE IMPULSION',
      tone: 'phile',
      rang: 'secteur',
    },
    { x: 570, y: 120, text: 'L’AFFÛT', tone: 'phile' },
    { x: 800, y: 240, text: 'LA FENÊTRE', tone: 'mur' },
    { x: 1110, y: 180, text: 'SAS', tone: 'sas' },
  ],
  decals: [{ x: 1080, y: 560, w: 165, h: 165, kind: 'tuyaux', fade: 0.45 }],
  // Lumière (refonte contraste) : AMBIANTE NULLE — toute la lumière vient
  // des lampes. Des BANDES posées BAS le long des parois neutres (h 140-190) :
  // les ombres s'allongent, nettes, et sculptent la salle. La balise verte
  // du sas reste le repère commun.
  lumieres: [
    {
      x: -220,
      y: -160,
      forme: 'bandeau',
      longueur: 760,
      angle: 90,
      h: 160,
      portee: 850,
      intensite: 1.15,
      couleur: '#63b7e6',
      taille: 1,
    },
    {
      x: 730,
      y: 30,
      forme: 'bandeau',
      longueur: 520,
      angle: 90,
      h: 150,
      portee: 640,
      intensite: 1.0,
      taille: 1,
    },
    {
      x: 1110,
      y: 0,
      h: 300,
      portee: 500,
      intensite: 1.0,
      couleur: '#3fd69b',
      taille: 1,
    },
  ],
  ambiante: 0,
}

// Gamme 4 — le premier gel : le froid fige, et le gel AMARRE. La physique
// est franche : un corps gelé sur une plaque y est soudé — il ne glisse
// pas EN PARTANT d'elle, il s'y arrête. Le retournement enseigné est donc
// l'AMARRE : la plaque devient un frein de précision — s'y écraser à
// pleine vitesse coûte zéro goutte, on vise depuis l'amarre, on dégèle,
// une impulsion. (La glisse gratuite du palet existe, mais elle demande
// une ZONE qui impose la glace en plein vol — elle s'apprend en 21-09.)
export const TABLEAU_G4: LevelDef = {
  name: 'Le premier gel',
  code: '21-04',
  journal:
    'Cellule 4, plaques cryogéniques. Le froid devait être une punition : tout ce qui s’attarde se fige, et tout ce qui se fige s’amarre. Il a foncé sur la plaque à pleine vitesse — arrêt net, pas une goutte perdue — a visé la fenêtre depuis son amarre, s’est dégelé, et l’a passée d’une seule impulsion. Le châtiment est devenu son frein de précision. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  par: 6,
  boxes: [
    // 1. le plot d'essai, hors de la route : l'aura se voit avant de mordre
    box(-620, -360, -520, -260, MAT_FROID),
    // 2. la porte de givre : passer au centre, ou raser et payer en gel —
    //    inoffensif, le dégel vient tout seul
    box(-140, -750, -60, -220, MAT_FROID),
    box(-140, 220, -60, 750, MAT_FROID),
    // 3. LE FREIN : la plaque posée SUR la ligne d'élan, face à la fenêtre —
    //    s'y écraser gèle et amarre (arrêt net gratuit), viser, dégeler,
    //    une impulsion traverse
    box(540, -70, 680, 70, MAT_FROID),
    box(780, -750, 860, -100, MAT_WALL),
    box(780, 100, 860, 750, MAT_WALL),
  ],
  sponges: [],
  labels: [
    {
      x: -570,
      y: -440,
      text: 'PLAQUE FROIDE — FIGE',
      tone: 'froid',
      picto: { couleur: '#8fc8ee', eau: 3, glace: 1, vapeur: 2 },
    },
    { x: -100, y: 60, text: 'PORTE DE GIVRE', tone: 'froid', rang: 'secteur' },
    {
      x: 610,
      y: 160,
      text: 'LE FREIN — S’ÉCRASER, C’EST S’AMARRER',
      tone: 'froid',
    },
    { x: 820, y: 200, text: 'LA FENÊTRE', tone: 'mur' },
    { x: 1110, y: 180, text: 'SAS', tone: 'sas' },
  ],
  decals: [{ x: -1080, y: 560, w: 190, h: 285, kind: 'vanne', fade: 0.42 }],
  // Lumière (refonte contraste) : AMBIANTE NULLE — toute la lumière vient
  // des lampes. Des BANDES posées BAS le long des parois neutres (h 140-190) :
  // les ombres s'allongent, nettes, et sculptent la salle. La balise verte
  // du sas reste le repère commun.
  lumieres: [
    {
      x: -190,
      y: 0,
      forme: 'bandeau',
      longueur: 820,
      angle: 90,
      h: 150,
      portee: 880,
      intensite: 1.15,
      couleur: '#bfe0ff',
      taille: 1,
    },
    {
      x: 740,
      y: 0,
      forme: 'bandeau',
      longueur: 560,
      angle: 90,
      h: 150,
      portee: 620,
      intensite: 0.95,
      couleur: '#8fc8ee',
      taille: 1,
    },
    {
      x: 1110,
      y: 0,
      h: 300,
      portee: 500,
      intensite: 1.0,
      couleur: '#3fd69b',
      taille: 1,
    },
  ],
  ambiante: 0,
}

// Gamme 5 — le premier souffle : la vapeur, gagnée à la chaudière, passe
// l'évent — et ce qu'elle perd se reboit au dépôt froid. C'est ICI que le
// gameplay vapeur s'introduit : juste avant 21-A, pour que « Le conduit »
// (21-C) ne soit plus jamais une première fois.
export const TABLEAU_G5: LevelDef = {
  name: 'Le premier souffle',
  code: '21-05',
  journal:
    'Cellule 5, conduite d’air. Il a léché la chaudière, s’est défait en vapeur, et l’évent l’a laissé passer comme une rumeur. Ce que le souffle a semé en route a perlé sur le dépôt froid — et il est revenu le boire. Rien ne se perd. Nous devrions graver cette phrase. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  par: 7,
  boxes: [
    // 1. la chaudière, hors de la route : s'en approcher, c'est goûter la
    //    vapeur — et repartir avec ses dashs
    box(-660, -520, -420, -440, MAT_CHAUD),
    // 2. le choix : un évent aux trois quarts — la vapeur passe tout droit,
    //    le liquide fait le tour par le haut ; les deux routes sont vraies
    box(60, -750, 100, 220, MAT_GRILLE),
    // 3. l'obligé : l'évent plein — seule la vapeur traverse ; le dépôt
    //    froid recompose le nuage de l'autre côté, la rosée se reboit
    box(620, -750, 660, 750, MAT_GRILLE),
    box(760, -360, 900, -300, MAT_FROID),
  ],
  sponges: [],
  labels: [
    {
      x: -540,
      y: -600,
      text: 'CHAUDIÈRE — DISPERSE',
      tone: 'chaud',
      picto: { couleur: '#e8843c', eau: 2, glace: 3, vapeur: 0 },
    },
    {
      x: 80,
      y: -420,
      text: 'ÉVENT — SEULE LA VAPEUR PASSE',
      tone: 'grille',
      picto: { couleur: '#7fae9e', eau: 1, glace: 1, vapeur: 0 },
    },
    { x: 640, y: 420, text: 'ÉVENT', tone: 'grille' },
    {
      x: 830,
      y: -440,
      text: 'DÉPÔT FROID — LA ROSÉE SE REBOIT',
      tone: 'froid',
    },
    { x: 1110, y: 180, text: 'SAS', tone: 'sas' },
  ],
  decals: [
    { x: -1080, y: -560, w: 150, h: 225, kind: 'vanne', fade: 0.42 },
    { x: 400, y: 640, w: 160, h: 160, kind: 'tuyaux', fade: 0.4 },
  ],
  // Lumière (refonte contraste) : AMBIANTE NULLE — toute la lumière vient
  // des lampes. Des BANDES posées BAS le long des parois neutres (h 140-190) :
  // les ombres s'allongent, nettes, et sculptent la salle. La balise verte
  // du sas reste le repère commun.
  lumieres: [
    {
      x: -540,
      y: -570,
      forme: 'bandeau',
      longueur: 520,
      angle: 0,
      h: 160,
      portee: 820,
      intensite: 1.1,
      couleur: '#e8a05a',
      taille: 1,
    },
    {
      x: 20,
      y: -80,
      forme: 'bandeau',
      longueur: 900,
      angle: 90,
      h: 170,
      portee: 760,
      intensite: 1.05,
      taille: 1,
    },
    {
      x: 830,
      y: -240,
      forme: 'bandeau',
      longueur: 300,
      angle: 0,
      h: 150,
      portee: 520,
      intensite: 0.9,
      couleur: '#8fc8ee',
      taille: 1,
    },
    {
      x: 1110,
      y: 0,
      h: 300,
      portee: 480,
      intensite: 1.0,
      couleur: '#3fd69b',
      taille: 1,
    },
  ],
  ambiante: 0,
  brume: 0.14,
}

// La gamme, dans l'ordre d'apprentissage : le corps, le rebond, l'ancrage,
// le gel, le souffle. Jouée en tête de l'expédition — en sortie du hub.
export const TABLEAUX_GAMME: LevelDef[] = [
  TABLEAU_G1,
  TABLEAU_G2,
  TABLEAU_G3,
  TABLEAU_G4,
  TABLEAU_G5,
]

// ---- LES PALIERS : le deuxième étage de la courbe -----------------------
// Six salles TISSÉES dans l'expédition (la dent de scie : chaque leçon se
// place juste avant le tableau livré qui l'exige, chaque pic est suivi
// d'une respiration). Même kata que la gamme — sans danger, sur la route,
// retournée en outil — et même contrat de lisibilité. Elles comblent les
// trous du vocabulaire : l'éponge n'était jamais enseignée avant que
// « Le sas » l'exige ; la membrane, le rideau, les zones imposées et le
// surchauffeur n'étaient enseignés nulle part dans la run.

// Palier 1 — l'éponge : elle boit ce qu'on lui abandonne… et un mur mince
// se SATURE — la brèche permanente s'achète une seule fois.
export const TABLEAU_G6: LevelDef = {
  name: 'La buveuse',
  code: '21-06',
  journal:
    'Cellule 6, mousse absorbante. Il a nourri l’éponge du bout d’une goutte, a regardé les pores se gorger et durcir, puis a choisi le plus mince des murs et l’a saturé d’un coup : une brèche permanente, payée une seule fois. Il ne subit pas le péage. Il l’achète. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  par: 6,
  boxes: [
    // le muret au-dessus du couloir du grand mur d'éponge
    box(-20, 240, 28, 750, MAT_WALL),
    // le canal de la fine éponge : au-dessus et en dessous, du plein
    box(680, -750, 750, -180, MAT_WALL),
    box(680, 156, 750, 750, MAT_WALL),
  ],
  sponges: [
    // 1. le bloc d'essai, hors de la route : nourrir, regarder durcir
    {
      minX: -660,
      minY: 320,
      cols: 3,
      rows: 3,
      cellSize: 24,
      capacityPerCell: 4,
    },
    // 2. le grand mur : payer le passage en volume, ou grimper au couloir
    {
      minX: -20,
      minY: -750,
      cols: 2,
      rows: 33,
      cellSize: 24,
      capacityPerCell: 5,
    },
    // 3. la FINE : une colonne, capacité minuscule — la saturer coûte trois
    //    gorgées et ouvre la brèche pour toujours
    {
      minX: 700,
      minY: -180,
      cols: 1,
      rows: 14,
      cellSize: 24,
      capacityPerCell: 2,
    },
  ],
  labels: [
    {
      x: -600,
      y: 240,
      text: 'ÉPONGE — BOIT',
      tone: 'eponge',
      picto: { couleur: '#d9a441', eau: 3, glace: 1, vapeur: 1 },
    },
    { x: 4, y: -60, text: 'LE PÉAGE', tone: 'eponge', rang: 'secteur' },
    { x: 715, y: 240, text: 'LA FINE — SATURER, PASSER', tone: 'eponge' },
    { x: 1110, y: 180, text: 'SAS', tone: 'sas' },
  ],
  decals: [{ x: -1080, y: -520, w: 160, h: 160, kind: 'tuyaux', fade: 0.42 }],
  // Lumière (refonte contraste) : AMBIANTE NULLE — toute la lumière vient
  // des lampes. Des BANDES posées BAS le long des parois neutres (h 140-190) :
  // les ombres s'allongent, nettes, et sculptent la salle. La balise verte
  // du sas reste le repère commun.
  lumieres: [
    {
      x: -120,
      y: 140,
      forme: 'bandeau',
      longueur: 700,
      angle: 90,
      h: 170,
      portee: 900,
      intensite: 1.15,
      taille: 1,
    },
    {
      x: -624,
      y: 470,
      forme: 'bandeau',
      longueur: 300,
      angle: 0,
      h: 200,
      portee: 420,
      intensite: 0.7,
      couleur: '#e6c08a',
      taille: 1,
    },
    {
      x: 660,
      y: -12,
      forme: 'bandeau',
      longueur: 420,
      angle: 90,
      h: 150,
      portee: 560,
      intensite: 1.0,
      taille: 1,
    },
    {
      x: 1110,
      y: 0,
      h: 300,
      portee: 480,
      intensite: 1.0,
      couleur: '#3fd69b',
      taille: 1,
    },
  ],
  ambiante: 0,
}

// Palier 2 — la membrane : la première paroi qui donne un ordre. Seul le
// LIQUIDE passe ; gelé, on frappe une porte close.
export const TABLEAU_G7: LevelDef = {
  name: 'La membrane',
  code: '21-07',
  journal:
    'Cellule 7, cloison osmotique. Gelé, il a heurté la membrane comme un poing frappe une porte. Redevenu liquide, il l’a traversée comme si elle n’existait pas. La cloison choisit son état à sa place — c’est la première paroi qui lui donne un ordre, et il a obéi en trois secondes. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  par: 6,
  boxes: [
    // 1. le carreau d'essai, hors de la route — et le plot froid à côté :
    //    se geler, frapper, comprendre ; dégeler, traverser
    box(-620, 280, -580, 520, MAT_MEMBRANE),
    box(-700, -400, -600, -300, MAT_FROID),
    // 2. sur la route : la grande membrane, pleine hauteur — on y arrive
    //    comme on veut, on la passe LIQUIDE
    box(-40, -750, 0, 750, MAT_MEMBRANE),
    // 3. l'unique passage de la barrière est une membrane : l'eau se
    //    faufile là où aucun autre état n'a de porte
    box(560, -750, 640, 180, MAT_WALL),
    box(560, 180, 640, 420, MAT_MEMBRANE),
    box(560, 420, 640, 750, MAT_WALL),
  ],
  sponges: [],
  labels: [
    {
      x: -600,
      y: 600,
      text: 'MEMBRANE — SEUL LE LIQUIDE PASSE',
      tone: 'phile',
      picto: { couleur: '#4fae8e', eau: 3, glace: 0, vapeur: 0 },
    },
    { x: -650, y: -480, text: 'PLAQUE FROIDE', tone: 'froid' },
    { x: 600, y: 500, text: 'LA PORTE D’EAU', tone: 'phile', rang: 'secteur' },
    { x: 1110, y: 180, text: 'SAS', tone: 'sas' },
  ],
  decals: [{ x: 1090, y: -560, w: 150, h: 225, kind: 'vanne', fade: 0.42 }],
  // Lumière (refonte contraste) : AMBIANTE NULLE — toute la lumière vient
  // des lampes. Des BANDES posées BAS le long des parois neutres (h 140-190) :
  // les ombres s'allongent, nettes, et sculptent la salle. La balise verte
  // du sas reste le repère commun.
  lumieres: [
    {
      x: -100,
      y: 0,
      forme: 'bandeau',
      longueur: 940,
      angle: 90,
      h: 160,
      portee: 880,
      intensite: 1.1,
      couleur: '#4fae8e',
      taille: 1,
    },
    {
      x: 520,
      y: 300,
      forme: 'bandeau',
      longueur: 480,
      angle: 90,
      h: 150,
      portee: 620,
      intensite: 1.0,
      taille: 1,
    },
    {
      x: 1110,
      y: 0,
      h: 300,
      portee: 500,
      intensite: 1.0,
      couleur: '#3fd69b',
      taille: 1,
    },
  ],
  ambiante: 0,
}

// Palier 3 — le rideau : le miroir de la membrane. Seule la GLACE l'écarte,
// et un palet lancé le traverse comme une épaule ouvre une porte battante.
export const TABLEAU_G8: LevelDef = {
  name: 'Le rideau',
  code: '21-08',
  journal:
    'Cellule 8, rideau lamellaire. L’eau s’y écrase, la vapeur s’y émiette — mais un bloc lancé l’écarte comme une épaule ouvre une porte battante. Il s’est gelé, s’est jeté, et le rideau a claqué derrière lui. Nous avons entendu le claquement depuis la salle d’observation. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  par: 6,
  boxes: [
    // 1. le carreau d'essai, hors de la route — le mouillage froid juste là
    box(-620, -520, -580, -280, MAT_RIDEAU),
    box(-720, -160, -620, -60, MAT_FROID),
    // 2. sur la route : le grand rideau, pleine hauteur — se geler au
    //    mouillage, garder l'élan, l'épauler
    box(0, -750, 40, 750, MAT_RIDEAU),
    // 3. LA CHARGE : un second mouillage aligné sur un rideau étroit — se
    //    figer, se lancer, claquer la porte battante jusqu'au bassin du sas
    box(360, -120, 520, -40, MAT_FROID),
    box(700, -750, 740, -200, MAT_WALL),
    box(700, -200, 740, 240, MAT_RIDEAU),
    box(700, 240, 740, 750, MAT_WALL),
  ],
  sponges: [],
  labels: [
    {
      x: -600,
      y: -600,
      text: 'RIDEAU — SEULE LA GLACE PASSE',
      tone: 'froid',
      picto: { couleur: '#8fb4d8', eau: 0, glace: 3, vapeur: 0 },
    },
    { x: -670, y: -240, text: 'MOUILLAGE FROID', tone: 'froid' },
    { x: 440, y: 40, text: 'LA CHARGE', tone: 'froid', rang: 'secteur' },
    { x: 1110, y: 180, text: 'SAS', tone: 'sas' },
  ],
  decals: [{ x: -1080, y: 520, w: 190, h: 285, kind: 'vanne', fade: 0.4 }],
  // Lumière (refonte contraste) : AMBIANTE NULLE — toute la lumière vient
  // des lampes. Des BANDES posées BAS le long des parois neutres (h 140-190) :
  // les ombres s'allongent, nettes, et sculptent la salle. La balise verte
  // du sas reste le repère commun.
  lumieres: [
    {
      x: -70,
      y: 0,
      forme: 'bandeau',
      longueur: 940,
      angle: 90,
      h: 160,
      portee: 900,
      intensite: 1.1,
      couleur: '#8fb4d8',
      taille: 1,
    },
    {
      x: 560,
      y: 200,
      forme: 'bandeau',
      longueur: 520,
      angle: 0,
      h: 140,
      portee: 620,
      intensite: 1.0,
      taille: 1,
    },
    {
      x: 1110,
      y: 0,
      h: 300,
      portee: 500,
      intensite: 1.0,
      couleur: '#3fd69b',
      taille: 1,
    },
  ],
  ambiante: 0,
}

// Palier 4 — les régimes : certaines régions IMPOSENT leur état. On ne
// lutte pas contre un régime — on s'en sert : armure de glace gratuite ici,
// souffle gratuit là.
export const TABLEAU_G9: LevelDef = {
  name: 'Les régimes',
  code: '21-09',
  journal:
    'Cellule 9, régimes imposés. Un hublot fendu glace tout ce qui passe devant ; une conduite rompue vaporise. Il n’a pas lutté contre les régimes : il les a utilisés — armure de glace gratuite ici, souffle gratuit là. Les accidents de la station sont devenus ses outils de travail. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  par: 7,
  boxes: [
    // l'évent AU CŒUR de la conduite rompue : le régime vapeur donne
    // exactement l'état qu'il faut pour le passer
    box(100, -750, 140, 750, MAT_GRILLE),
    // la glissière du retour : le régime glace offre le palet, les parois
    // font le couloir — la glisse est gratuite
    box(740, 140, 980, 200, MAT_WALL),
    box(740, -200, 980, -140, MAT_WALL),
  ],
  sponges: [],
  zones: [
    // 1. le hublot fendu, hors de la route : entrer, se sentir geler,
    //    ressortir — le régime se comprend sur la peau
    { minX: -700, minY: 300, maxX: -380, maxY: 700, force: 'glace' },
    // 2. la conduite rompue barre la route : le régime impose la vapeur —
    //    et l'évent qu'elle contient devient traversable
    { minX: -80, minY: -750, maxX: 320, maxY: 750, force: 'vapeur' },
    // 3. le second hublot : l'armure gratuite, alignée sur la glissière
    { minX: 440, minY: -160, maxX: 720, maxY: 160, force: 'glace' },
  ],
  labels: [
    { x: -540, y: 220, text: 'HUBLOT FENDU — IMPOSE LA GLACE', tone: 'froid' },
    {
      x: 120,
      y: -420,
      text: 'CONDUITE ROMPUE — IMPOSE LA VAPEUR',
      tone: 'chaud',
    },
    { x: 120, y: 320, text: 'ÉVENT', tone: 'grille' },
    { x: 580, y: 240, text: 'L’ARMURE GRATUITE', tone: 'froid' },
    { x: 1110, y: 180, text: 'SAS', tone: 'sas' },
  ],
  decals: [{ x: -1080, y: -540, w: 160, h: 160, kind: 'tuyaux', fade: 0.4 }],
  // Lumière (refonte contraste) : AMBIANTE NULLE — toute la lumière vient
  // des lampes. Des BANDES posées BAS le long des parois neutres (h 140-190) :
  // les ombres s'allongent, nettes, et sculptent la salle. La balise verte
  // du sas reste le repère commun.
  lumieres: [
    {
      x: -700,
      y: 60,
      forme: 'bandeau',
      longueur: 680,
      angle: 90,
      h: 170,
      portee: 720,
      intensite: 1.05,
      taille: 1,
    },
    {
      x: 200,
      y: 0,
      forme: 'bandeau',
      longueur: 1000,
      angle: 90,
      h: 190,
      portee: 720,
      intensite: 1.05,
      couleur: '#e8a05a',
      taille: 1,
    },
    {
      x: 580,
      y: 220,
      forme: 'bandeau',
      longueur: 300,
      angle: 0,
      h: 160,
      portee: 480,
      intensite: 0.9,
      couleur: '#8fc8ee',
      taille: 1,
    },
    {
      x: 1110,
      y: 0,
      h: 300,
      portee: 480,
      intensite: 1.0,
      couleur: '#3fd69b',
      taille: 1,
    },
  ],
  ambiante: 0,
}

// Palier 5 — la halte : les bornes de surchauffe. Frôlée en VAPEUR, une
// borne rend UNE impulsion de nuage — une seule. La route se lit de borne
// en borne, comme un pilote lit ses balises.
export const TABLEAU_G10: LevelDef = {
  name: 'La halte',
  code: '21-10',
  journal:
    'Cellule 10, bornes de surchauffe. Chaque borne frôlée en vapeur rend UNE impulsion de nuage — une seule, puis elle s’éteint. Il a tracé sa route de borne en borne comme un pilote lit ses balises, et il est arrivé au dépôt avec de la réserve. Nous appelions ça une halte. Lui, un ravitaillement. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  par: 8,
  boxes: [
    // 1. la chaudière d'essai (la vapeur gratuite) et la première borne,
    //    hors de la route : frôler, sentir le dash rendu
    box(-700, -500, -500, -420, MAT_CHAUD),
    box(-660, 120, -600, 320, MAT_SURCHAUFFEUR),
    // 2. la ligne de ravitaillement : deux bornes en quinconce sur la
    //    grande traversée
    box(-80, -260, -20, -60, MAT_SURCHAUFFEUR),
    box(320, 60, 380, 260, MAT_SURCHAUFFEUR),
    // 3. la route haute : le barrage force à grimper — la troisième borne
    //    paie la montée, le dépôt froid recompose avant le sas
    box(640, -750, 700, 420, MAT_WALL),
    box(560, 480, 620, 680, MAT_SURCHAUFFEUR),
    box(760, -200, 900, -140, MAT_FROID),
  ],
  sponges: [],
  labels: [
    {
      x: -630,
      y: 400,
      text: 'BORNE — UN DASH, UNE FOIS',
      tone: 'chaud',
      picto: { couleur: '#f2c98e', eau: 0, glace: 0, vapeur: 3 },
    },
    { x: -600, y: -580, text: 'CHAUDIÈRE', tone: 'chaud' },
    { x: 150, y: -360, text: 'LA LIGNE DE RAVITAILLEMENT', tone: 'chaud' },
    { x: 830, y: -280, text: 'DÉPÔT FROID', tone: 'froid' },
    { x: 1110, y: 180, text: 'SAS', tone: 'sas' },
  ],
  decals: [{ x: 1090, y: 560, w: 165, h: 165, kind: 'tuyaux', fade: 0.42 }],
  // Lumière (refonte contraste) : AMBIANTE NULLE — toute la lumière vient
  // des lampes. Des BANDES posées BAS le long des parois neutres (h 140-190) :
  // les ombres s'allongent, nettes, et sculptent la salle. La balise verte
  // du sas reste le repère commun.
  lumieres: [
    {
      x: -600,
      y: -560,
      forme: 'bandeau',
      longueur: 420,
      angle: 0,
      h: 160,
      portee: 780,
      intensite: 1.05,
      couleur: '#e8a05a',
      taille: 1,
    },
    {
      x: 150,
      y: 0,
      forme: 'bandeau',
      longueur: 920,
      angle: 90,
      h: 190,
      portee: 820,
      intensite: 1.1,
      taille: 1,
    },
    {
      x: 830,
      y: -240,
      forme: 'bandeau',
      longueur: 280,
      angle: 0,
      h: 150,
      portee: 480,
      intensite: 0.9,
      couleur: '#8fc8ee',
      taille: 1,
    },
    {
      x: 1110,
      y: 0,
      h: 300,
      portee: 480,
      intensite: 1.0,
      couleur: '#3fd69b',
      taille: 1,
    },
  ],
  ambiante: 0,
  brume: 0.1,
}

// Palier 6 — la voie lumineuse : la respiration avant les salles laser, et
// la leçon d'atmosphère. La salle est éteinte ; quatre flaques de lumière
// tracent le chemin comme des pierres de gué — la lumière EST la carte.
export const TABLEAU_G11: LevelDef = {
  name: 'La voie lumineuse',
  code: '21-11',
  journal:
    'Cellule 11, éclairage réduit. Nous avons éteint la salle pour mesurer sa dépendance au visuel. Il a suivi les flaques de lumière comme des pierres de gué, s’est posé dans chacune, et n’a jamais dévié dans le noir. La lumière n’est pas un décor. C’est une carte, et il la lit. — Dr N. Véga',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  par: 6,
  boxes: [
    // des contreforts posés juste HORS des flaques : le noir n'est pas
    // vide, il faut suivre le gué
    box(-400, -300, -280, -120, MAT_WALL),
    box(-100, 200, 60, 340, MAT_WALL),
    box(400, -350, 520, -200, MAT_WALL),
    box(660, 300, 780, 460, MAT_WALL),
    // les deux perchoirs : s'ancrer DANS la lumière, viser la suivante
    box(-160, -120, 0, -60, MAT_HYDROPHILE),
    box(340, 80, 500, 160, MAT_HYDROPHILE),
  ],
  sponges: [],
  labels: [
    {
      x: -800,
      y: 200,
      text: 'SUIVRE LA LUMIÈRE',
      tone: 'mur',
      rang: 'secteur',
    },
    {
      x: -80,
      y: -200,
      text: 'HYDROPHILE — SE POSER DANS LA LUMIÈRE',
      tone: 'phile',
    },
    { x: 1110, y: 180, text: 'SAS', tone: 'sas' },
  ],
  // Lumière (refonte contraste) : AMBIANTE NULLE — toute la lumière vient
  // des lampes. Des BANDES posées BAS le long des parois neutres (h 140-190) :
  // les ombres s'allongent, nettes, et sculptent la salle. La balise verte
  // du sas reste le repère commun.
  lumieres: [
    {
      x: -840,
      y: 0,
      forme: 'bandeau',
      longueur: 480,
      angle: 90,
      h: 180,
      portee: 620,
      intensite: 1.1,
      taille: 1,
    },
    {
      x: -80,
      y: -40,
      h: 240,
      portee: 480,
      intensite: 1.05,
      couleur: '#63b7e6',
      taille: 1,
    },
    {
      x: 420,
      y: 160,
      h: 240,
      portee: 480,
      intensite: 1.05,
      couleur: '#63b7e6',
      taille: 1,
    },
    {
      x: 1110,
      y: 0,
      h: 320,
      portee: 620,
      intensite: 1.15,
      couleur: '#3fd69b',
      taille: 1,
    },
  ],
  ambiante: 0,
  brume: 0.1,
}

// Les six paliers, pour l'éditeur et les tests.
export const TABLEAUX_PALIERS: LevelDef[] = [
  TABLEAU_G6,
  TABLEAU_G7,
  TABLEAU_G8,
  TABLEAU_G9,
  TABLEAU_G10,
  TABLEAU_G11,
]

// L'ordre de la partie — LA DENT DE SCIE. La gamme d'abord (cinq cellules,
// une nouveauté chacune — en sortie du hub), puis chaque leçon des paliers
// se place JUSTE AVANT le tableau livré qui l'exige : l'éponge avant
// « Le sas », la membrane après la chambre froide (le contraste), le rideau
// après le conduit, les régimes avant la serre, la halte avant le dépôt de
// givre, et la voie lumineuse en respiration avant les salles laser. Les
// trilogies laser révèlent puis composent la fonction de l'échantillon, et
// la dérive conclut sur la maîtrise pure.
export const TABLEAUX: LevelDef[] = [
  ...TABLEAUX_GAMME,
  TABLEAU_G6,
  TABLEAU_1,
  TABLEAU_2,
  TABLEAU_G7,
  TABLEAU_3,
  TABLEAU_G8,
  TABLEAU_G9,
  TABLEAU_5,
  TABLEAU_G10,
  TABLEAU_6,
  TABLEAU_4,
  TABLEAU_G11,
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
