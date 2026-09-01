// Éditeur de tableaux — vue schématique en 2D, pensée pour la précision
// plutôt que pour la beauté : on y dessine des rectangles, on les déplace, on
// les redimensionne, et on essaie le tableau sans quitter la page.
//
// Le rendu WebGL du jeu n'est pas réutilisé ici : une vue à plat, avec les
// matériaux en aplats de couleur et les cotes lisibles, se lit mieux pour
// construire un niveau — l'aperçu réel, c'est le bouton ESSAYER.

import {
  LAMPE_COULEUR_DEFAUT,
  LAMPE_HAUTEUR_DEFAUT,
  LAMPE_HAUTEUR_MAX,
  LAMPE_HAUTEUR_MIN,
  MATERIAL_NAMES,
  MAT_CHAUD,
  MAT_FROID,
  MAT_GRILLE,
  MAT_MEMBRANE,
  MAT_RIDEAU,
  MAT_SURCHAUFFEUR,
  MAT_MIROIR,
  PLAFONDS_CONNUS,
  dansBoite,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_WALL,
  TABLEAU_1BIS,
  TABLEAUX,
  TABLEAUX_ECOLE,
  ZONE_CAUSES,
  subtractBox,
  subtractBoxOblique,
  subtractSponge,
  zoneName,
  zoneOutline,
  type LevelDef,
  type ObstacleBox,
  type DecalDef,
  type SpongeDef,
  type StructureDef,
  type WorldLabel,
  type ZoneForce,
  type MonnaiePlot,
  type PlotMeta,
  type RoleAncre,
} from '../game/level'
import {
  ARTICLES_COMPTOIR,
  ROLES_ANCRE,
  TABLEAU_HUB,
  TABLEAU_HUB_COMPACT,
} from '../game/hub'
import { REPARATIONS } from '../game/reparations'
import {
  COQUE_COTES,
  COQUE_COTE_NOMS,
  FORME_COQUE,
  coquePieces,
} from '../game/formes'
import { deplaceDans, ditLeDeplacement, type SensOrdre } from '../game/ordre'
import {
  CHANFREIN_MAX,
  EP_MAX,
  EP_MIN,
  STRUCT_CHAMBRE,
  STRUCT_COULOIR,
  boxesDesStructures,
  cotesOuverts,
  coutStructures,
  dansCoque,
  epaisseurDe,
  gommeStructure,
  structureNeuve,
  structureViable,
} from '../game/structures'
import { ETAL_ECONOMAT, TABLEAU_ECONOMAT } from '../game/economat'
import {
  cleFiche,
  ficheElement,
  ficheStatique,
  type Fiche,
  type FicheSurcharge,
  type Surcharges,
} from './fiches'
import {
  ARC_EPAISSEUR_DEFAUT,
  ARC_OUVERTURE_DEFAUT,
  FORME_ARC,
  ARC_BOUT_NOMS,
  FORME_CAPSULE,
  FORME_COIN,
  FORME_DISQUE,
  FORME_NAMES,
  FORME_RECT,
  formeOutline,
} from '../game/formes'
import {
  CODE_HUB,
  MECANIQUE_NOMS,
  MOMENT_NOMS,
  checkLevel,
  codeCanon,
  decodeCodeAtelier,
  estCodeHub,
  numeroTableau,
  parseLevel,
  serializeLevel,
} from '../game/levelIO'
import {
  analyseSaisie,
  genereNiveau,
  genereNiveauAtelier,
  type OptionsGen,
} from '../game/generateur'
import { MAX_LUMIERES,
  MAX_BOXES,
} from '../render/renderer'
import { canalDeCible, traceLaser } from '../game/laser'
import { DEFAULT_PARAMS, type SimParams } from '../sim/params'
import { PISTES, PISTE_NOMS, type Piste } from '../game/soundtrack'
import {
  deleteLevel,
  fetchLibrary,
  raisonDuRefus,
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
// les aides au placement (aimant de grille, alignement auto) : un réglage
// de la MAIN, pas du tableau — il suit le concepteur d'une séance à l'autre
const AIDES_KEY = 'projet21.editeur.aides.v1'

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
  [MAT_MIROIR]: '#b8c8dc',
}
const ZONE_COLORS: Record<ZoneForce, string> = {
  libre: '#7b93a8',
  eau: '#63b7e6',
  glace: '#8fc8ee',
  vapeur: '#f2c98e',
}

// LES DÉCALQUES : le décor sans physique. Une seule liste, lue par l'outil,
// par le panneau de propriétés et par les tests — le moteur lit la même
// (game/level.ts) et la lecture d'un tableau écarte tout ce qui n'y est pas.
const DECAL_SORTES: DecalDef['kind'][] = [
  'tuyaux',
  'vanne',
  'ecran-off',
  'ecran-on',
  'fiole-pleine',
  'fiole-vide',
  'serre-ble-nain',
  'serre-rampe',
  'serre-rampe-a',
]
const DECAL_NOMS: Record<DecalDef['kind'], string> = {
  tuyaux: 'Tuyaux',
  vanne: 'Vanne',
  'ecran-off': 'Écran éteint',
  'ecran-on': 'Écran allumé',
  'fiole-pleine': 'Fiole pleine',
  'fiole-vide': 'Fiole vide',
  'serre-ble-nain': 'Serre — blé nain',
  'serre-rampe': 'Serre — gouttière',
  'serre-rampe-a': 'Serre — gouttière (seconde)',
  // le méta : jamais dans la palette (ces pièces sont SYNTHÉTISÉES par le
  // moteur à partir des plots, du banc et du marchand posés) — mais le
  // dictionnaire les nomme quand même, la table doit être complète
  'meta-alcove': 'Méta — alcôve d’étal',
  'meta-banc': 'Méta — pupitre du banc',
  'meta-marchand': 'Méta — le Sujet 12',
  'sas-raccord': 'Sas de raccord',
  'sas-raccord-v': 'Sas de raccord (quart de tour)',
}

// LES ANCRES MÉTA : les rendez-vous du module. Jusqu'ici la géométrie du
// hub les devinait — donc un module rebâti à la main n'en avait aucun.
// Elles se POSENT maintenant comme le reste : un rectangle, un rôle.
const ANCRE_NOMS: Record<RoleAncre, string> = {
  station: 'Station de réparation',
  degat: 'Barrière d’aile condamnée',
  'table-depart': 'Table de départ',
  'sas-scelle': 'Alcôve du secteur 4',
  sceau: 'Sceau du secteur 4',
  'porte-cuve': 'Porte de la cuve (acte 0)',
  'sas-givre': 'Sortie gardée — givre',
  'sas-vapeur': 'Sortie gardée — vapeur',
}
const ANCRE_NOTES: Record<RoleAncre, string> = {
  station:
    'LA STATION : le corps qui entre dans ce rectangle PAIE la remise en état (le prix vit au catalogue des réparations). Tant qu’elle est en panne, sa plaque « EN PANNE — RÉPARER · N MÉMOIRE » s’affiche ici même.',
  degat:
    'LA BARRIÈRE : elle condamne l’aile de sa station tant que celle-ci n’est pas réparée — une porte d’énergie qu’aucun faisceau n’ouvre. Payer la station la lève à chaud, sans respawn.',
  'table-depart':
    'LA TABLE DE DÉPART : au contact, le récapitulatif de ce qu’on emporte (vies, bonbonne, fioles, provisions) — une fois la station « table de départ » réparée.',
  'sas-scelle':
    'L’ALCÔVE DU SECTEUR 4 : la 4e sortie. Quand tout le récit est raconté ET la passerelle réparée, y entrer joue la FIN.',
  sceau:
    'LE SCEAU : la barrière qui tient le secteur 4 même passerelle réparée — seule la fin de l’arc du récit la lève.',
  'porte-cuve':
    'LA PORTE DE LA CUVE : close tant que l’acte 0 n’est pas joué — le sujet naît enfermé, la séquence ALERTE la crève.',
  'sas-givre':
    'LA SORTIE GARDÉE PAR LE RIDEAU (la glace l’écarte) : y entrer lance une descente NEUVE.',
  'sas-vapeur':
    'LA SORTIE GARDÉE PAR LA GRILLE (la vapeur passe) : y entrer lance une descente NEUVE (descente du jour).',
}

/** La fiche catalogue d'un plot posé — la monnaie choisit le catalogue. */
function ficheArticle(
  p: PlotMeta,
): { id: string; nom: string; icone: string; prix: number } | null {
  return p.monnaie === 'memoire'
    ? (ARTICLES_COMPTOIR.find((a) => a.id === p.article) ?? null)
    : (ETAL_ECONOMAT.find((a) => a.id === p.article) ?? null)
}

// LES MATIÈRES D'UNE PORTE DE COULOIR : celles qui trient le passage.
// Le rideau n'écarte que la glace, la grille ne laisse que le souffle, la
// membrane ne laisse que l'eau — et la paroi ferme tout net.
const MATIERES_PORTE = [
  MAT_RIDEAU,
  MAT_GRILLE,
  MAT_MEMBRANE,
  MAT_WALL,
  MAT_FROID,
  MAT_CHAUD,
]

type Tool =
  | { kind: 'select' }
  | { kind: 'box'; material: number; forme?: number }
  | { kind: 'sponge' }
  | { kind: 'zone'; force: ZoneForce }
  | { kind: 'cache' }
  // Le DÉCOR : un décalque posé à la main (jusqu'ici, seuls les tableaux
  // écrits ou générés en portaient — la serre demandait de pouvoir en poser)
  | { kind: 'decal'; sorte: DecalDef['kind'] }
  | { kind: 'spawn' }
  | { kind: 'exit' }
  | { kind: 'label' }
  | { kind: 'laser' }
  | { kind: 'cible' }
  | { kind: 'porte' }
  // Le MÉTA : la pastille de condensat (la monnaie de run, bue au contact)
  // et l'emplacement de FIOLE (un seul par tableau)
  | { kind: 'condensat' }
  | { kind: 'fiole' }
  // Le MÉTA POSÉ : le plot d'article (rectangle d'achat, monnaie choisie à
  // l'outil), le banc des mémoires (un seul), le marchand (un seul), et
  // l'éclat de mémoire (+N gravés au contact, une fois par run)
  | { kind: 'plot'; monnaie: MonnaiePlot }
  | { kind: 'banc' }
  | { kind: 'marchand' }
  | { kind: 'eclat' }
  // L'ANCRE MÉTA : station de réparation, barrière d'aile, table de départ,
  // secteur scellé, porte de cuve, sorties gardées — le rôle se choisit
  // ensuite dans le panneau
  | { kind: 'ancre' }
  // LE KIT DE COQUE : des structures VIDES qui dessinent le terrain de jeu.
  // On les RECOUVRE l'une l'autre : là où le vide de l'une traverse la
  // paroi de l'autre, la porte se perce toute seule.
  | { kind: 'structure'; type: number }
  | { kind: 'rail' }
  | { kind: 'lumiere' }
  | { kind: 'bande' }
  | { kind: 'cut' }
  | { kind: 'gomme' }

type Sel =
  | { kind: 'box'; index: number }
  | { kind: 'sponge'; index: number }
  | { kind: 'zone'; index: number }
  | { kind: 'cache'; index: number }
  | { kind: 'label'; index: number }
  | { kind: 'laser'; index: number }
  | { kind: 'cible'; index: number }
  | { kind: 'porte'; index: number }
  | { kind: 'condensat'; index: number }
  | { kind: 'fiole' }
  | { kind: 'plot'; index: number }
  | { kind: 'banc' }
  | { kind: 'marchand' }
  | { kind: 'eclat'; index: number }
  | { kind: 'ancre'; index: number }
  | { kind: 'structure'; index: number }
  | { kind: 'rail'; index: number }
  | { kind: 'lumiere'; index: number }
  | { kind: 'decal'; index: number }
  | { kind: 'exit' }
  | { kind: 'spawn' }
  | null

/** Ce que l'outil Superposition peut désigner : une paroi ou une éponge —
 *  l'une comme l'autre est de la matière qui peut prendre le dessus. */
type CutCible = { kind: 'box' | 'sponge'; index: number }

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
  /** Ouvrir LA PLANCHE (l'écran d'ordonnancement en cartes visuelles) —
   * l'éditeur n'ordonne plus lui-même, il y renvoie. */
  planche?(): void
  /** Le modificateur de MULTI-SÉLECTION est-il tenu ? (L2 sur Steam Deck :
   * pas de touche Maj au trackpad — L2 + clic vaut Maj + clic.) */
  modMulti?(): boolean
  /** Les paramètres VIFS du banc de réglage — pas les défauts figés. Les
   * portées dessinées (aspiration du sas, auras, rails) suivent ainsi la
   * valeur renseignée, en direct. Absent : les défauts font l'affaire. */
  params?(): SimParams
  /** Les cinématiques connues (livrées, poste, partagées) — l'éditeur en
   * fait des menus déroulants : on choisit un TITRE, jamais un code de
   * mémoire. Absent : les champs restent des saisies libres. */
  cines?(): { code: string; titre: string }[]
  /** Les séquences in-map connues, même usage. */
  sequences?(): { code: string; titre: string }[]
}

/**
 * Un menu déroulant de codes (cinématiques, séquences). Le code COURANT est
 * conservé même s'il ne figure pas dans la liste — une cinématique pas
 * encore composée, ou une partagée pas encore arrivée, ne doit jamais
 * effacer le réglage d'un tableau.
 */
function optionsCodes(
  liste: { code: string; titre: string }[],
  courant: string,
): string {
  const orphelin = courant && !liste.some((c) => c.code === courant)
  return (
    `<option value="">— aucune —</option>` +
    liste
      .map(
        (c) =>
          `<option value="${c.code}"${c.code === courant ? ' selected' : ''}>${c.titre} [${c.code}]</option>`,
      )
      .join('') +
    (orphelin
      ? `<option value="${courant}" selected>${courant} (introuvable)</option>`
      : '')
  )
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
  const t =
    len2 < 1e-9
      ? 0
      : Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / len2))
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
  /** La police des étiquettes — une seule définition : le TRACÉ et la ZONE
   * CLIQUABLE doivent se mesurer dans la même, sinon elles divergent en
   * silence et l'on reclique à côté de ce qu'on voit. */
  private static readonly POLICE_LABEL = '600 11px ui-monospace, monospace'

  private readonly host: HTMLElement
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly hooks: EditorHooks

  private level: LevelDef = blankLevel()
  private tool: Tool = { kind: 'select' }
  private sel: Sel = null
  private grid = 20
  private snap = true
  // L'ALIGNEMENT AUTOMATIQUE (magnétisme aux voisins : bords, centres,
  // écarts égaux) est distinct de l'aimant de GRILLE. Il rend service la
  // plupart du temps, mais il tire parfois une pièce là où on ne veut pas
  // (signalé sur des arcs qu'on veut raccorder au pixel) : il se coupe à la
  // case ALIGNEMENT, ou momentanément en tenant Alt pendant le geste.
  private alignAuto = true

  // caméra de l'éditeur : monde → écran
  private camX = 0
  private camY = 0
  private zoom = 0.3

  // Doigts posés sur la carte : à DEUX, on pince — l'écart zoome la CARTE
  // (pas la page : sur iPad, le pincement du navigateur emportait tout
  // l'écran, interface comprise) et le centre déplace la vue.
  private readonly doigts = new Map<number, { x: number; y: number }>()
  private pinceEcart: number | null = null
  private pinceCentre: { x: number; y: number } | null = null
  // Le dernier pointeur qui a parlé : une poignée de 9 px se vise à la
  // souris, jamais au doigt ni au stylet — sa ZONE SENSIBLE s'élargit donc
  // (le dessin, lui, ne bouge pas : viser large sans alourdir l'écran).
  private pointeur: 'mouse' | 'tactile' = 'mouse'

  // geste en cours
  private drag:
    | null
    | { mode: 'pan'; sx: number; sy: number; camX: number; camY: number }
    | { mode: 'create'; x0: number; y0: number; x1: number; y1: number }
    | {
        mode: 'move'
        ox: number
        oy: number
        start: Rect
        pts?: { x: number; y: number }[]
      }
    | {
        mode: 'multimove'
        ox: number
        oy: number
        prevDx: number
        prevDy: number
      }
    | { mode: 'aim'; index: number }
    | { mode: 'railpt'; index: number; point: number }
    // pivot : le coin OPPOSÉ d'une boîte oblique — il reste cloué au monde,
    // le redimensionnement se calcule dans le repère local de la boîte
    | {
        mode: 'resize'
        edge: string
        start: Rect
        pivot?: { x: number; y: number; angle: number }
      }
    | { mode: 'rotate'; index: number } = null

  // Sélection MULTIPLE (Maj + clic) : déplacée d'un bloc, supprimée d'un
  // coup, ou passée aux outils d'alignement du panneau.
  private multi: Sel[] = []
  // l'APPUI LONG tactile en cours : il vaudra Maj + clic s'il tient 480 ms
  private appuiLong: { timer: number; sx: number; sy: number } | null = null

  private hint = ''

  // La bulle savante du survol : l'élément div, son minuteur d'apparition
  // (650 ms de souris posée), et la clé de l'élément qu'elle décrit.
  private bulle!: HTMLDivElement
  private bulleTimer: number | null = null
  private bulleCle = ''
  // Les fiches RÉÉCRITES par les concepteurs (magasin partagé /api/fiches) :
  // chargées à l'ouverture, elles remplacent le texte statique de la bulle.
  private surcharges: Surcharges = {}
  private ficheVoile: HTMLDivElement | null = null

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
    // LA BULLE SAVANTE : au survol posé d'un élément, sa fiche (effet par
    // état, paramètres vifs) apparaît après un court délai — jamais pendant
    // un geste, jamais sous une souris qui bouge.
    this.bulle = document.createElement('div')
    this.bulle.className = 'ed-bulle'
    this.bulle.hidden = true
    document.body.appendChild(this.bulle)
    this.bulle.addEventListener('mouseleave', () => this.cacheBulle())
    this.bulle.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('.ed-bulle-mod')
      if (b instanceof HTMLElement && b.dataset.cle) {
        this.ouvreEditionFiche(b.dataset.cle)
        this.cacheBulle()
      }
    })
    this.bindBullesOutils()
    document
      .getElementById('ed-fiches')
      ?.addEventListener('click', () => this.ouvreRelectureFiches())
    this.bindUi()
    this.bindCanvas()
    this.restore()
    this.lastSnap = serializeLevel(this.level)
    this.majBoutonsHistoire()
    void this.refreshLibrary()
    // Sonde de test : l'éditeur depuis la console (comme __sim, __run, __fin)
    ;(window as unknown as { __editeur: LevelEditor }).__editeur = this
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
    void this.chargeSurcharges()
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
      localStorage.setItem(
        META_KEY,
        JSON.stringify({ openId: this.openId, base: this.base }),
      )
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

  /** Écart entre les deux premiers doigts posés (null en dessous de deux). */
  private ecartDoigts(): number | null {
    if (this.doigts.size < 2) return null
    const [a, b] = [...this.doigts.values()]
    return Math.hypot(b.x - a.x, b.y - a.y)
  }

  /** Milieu du pincement — le point du monde qui doit rester sous les doigts. */
  private centreDoigts(): { x: number; y: number } | null {
    if (this.doigts.size < 2) return null
    const [a, b] = [...this.doigts.values()]
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }

  private toWorld(sx: number, sy: number): { x: number; y: number } {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    return {
      x: this.camX + (sx - w * 0.5) / this.zoom,
      y: this.camY - (sy - h * 0.5) / this.zoom,
    }
  }

  /** Les aides au placement retenues d'une séance à l'autre (réglage de la
   *  main, pas du tableau) — tout défaut manquant vaut « activé ». */
  private litAides(): { snap: boolean; align: boolean } {
    try {
      const o = JSON.parse(localStorage.getItem(AIDES_KEY) ?? '{}') as {
        snap?: unknown
        align?: unknown
      }
      return { snap: o.snap !== false, align: o.align !== false }
    } catch {
      return { snap: true, align: true }
    }
  }

  private ecritAides(): void {
    try {
      localStorage.setItem(
        AIDES_KEY,
        JSON.stringify({ snap: this.snap, align: this.alignAuto }),
      )
    } catch {
      // stockage refusé : le réglage ne tiendra que la séance — sans gravité
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
    if (s.kind === 'cache') return (this.level.caches ?? [])[s.index] ?? null
    if (s.kind === 'porte') return (this.level.portes ?? [])[s.index] ?? null
    if (s.kind === 'plot') return (this.level.plots ?? [])[s.index] ?? null
    if (s.kind === 'banc') return this.level.bancMemoires ?? null
    if (s.kind === 'ancre') return (this.level.ancres ?? [])[s.index] ?? null
    if (s.kind === 'structure')
      return (this.level.structures ?? [])[s.index] ?? null
    if (s.kind === 'exit') return this.level.exit
    if (s.kind === 'decal') {
      const d = (this.level.decals ?? [])[s.index]
      if (!d) return null
      return {
        minX: d.x - d.w / 2,
        minY: d.y - d.h / 2,
        maxX: d.x + d.w / 2,
        maxY: d.y + d.h / 2,
      }
    }
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
    else if (s.kind === 'zone')
      Object.assign((this.level.zones ?? [])[s.index], norm)
    else if (s.kind === 'cache')
      Object.assign((this.level.caches ?? [])[s.index], norm)
    else if (s.kind === 'porte')
      Object.assign((this.level.portes ?? [])[s.index], norm)
    else if (s.kind === 'plot')
      Object.assign((this.level.plots ?? [])[s.index], norm)
    else if (s.kind === 'ancre')
      Object.assign((this.level.ancres ?? [])[s.index], norm)
    else if (s.kind === 'structure') {
      // une coque doit garder son intérieur : sous deux parois plus le
      // passage minimal, on refuse la nouvelle taille
      const st = (this.level.structures ?? [])[s.index]
      if (st && structureViable({ ...st, ...norm })) Object.assign(st, norm)
    }
    else if (s.kind === 'banc' && this.level.bancMemoires)
      Object.assign(this.level.bancMemoires, norm)
    else if (s.kind === 'exit') Object.assign(this.level.exit, norm)
    else if (s.kind === 'decal') {
      const d = (this.level.decals ?? [])[s.index]
      if (d) {
        d.x = (norm.minX + norm.maxX) / 2
        d.y = (norm.minY + norm.maxY) / 2
        d.w = Math.max(8, norm.maxX - norm.minX)
        d.h = Math.max(8, norm.maxY - norm.minY)
      }
    } else if (s.kind === 'sponge') {
      const sp = this.level.sponges[s.index]
      sp.minX = norm.minX
      sp.minY = norm.minY
      sp.cols = Math.max(1, Math.round((norm.maxX - norm.minX) / sp.cellSize))
      sp.rows = Math.max(1, Math.round((norm.maxY - norm.minY) / sp.cellSize))
    }
  }

  /** Maj + clic, L2 + clic (manette) ou appui long (tactile) : la sélection
   * MULTIPLE — l'élément sous le point s'ajoute ou se retire. */
  private basculeMulti(wx: number, wy: number): void {
    const hit = this.pick(wx, wy)
    if (!hit) return
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

  private annuleAppuiLong(): void {
    if (this.appuiLong) {
      window.clearTimeout(this.appuiLong.timer)
      this.appuiLong = null
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
    if (s.kind === 'lumiere') {
      const l = (this.level.lumieres ?? [])[s.index]
      return l ? { minX: l.x, minY: l.y, maxX: l.x, maxY: l.y } : null
    }
    if (s.kind === 'cible') {
      const t = (this.level.cibles ?? [])[s.index]
      return t
        ? { minX: t.x - t.r, minY: t.y - t.r, maxX: t.x + t.r, maxY: t.y + t.r }
        : null
    }
    if (s.kind === 'condensat') {
      const c = (this.level.condensats ?? [])[s.index]
      return c
        ? { minX: c.x - 26, minY: c.y - 26, maxX: c.x + 26, maxY: c.y + 26 }
        : null
    }
    if (s.kind === 'fiole') {
      const f = this.level.fiole
      return f
        ? { minX: f.x - 30, minY: f.y - 30, maxX: f.x + 30, maxY: f.y + 30 }
        : null
    }
    if (s.kind === 'marchand') {
      const m = this.level.marchand
      return m
        ? { minX: m.x - 40, minY: m.y - 40, maxX: m.x + 40, maxY: m.y + 40 }
        : null
    }
    if (s.kind === 'eclat') {
      const e = (this.level.eclats ?? [])[s.index]
      return e
        ? { minX: e.x - 26, minY: e.y - 26, maxX: e.x + 26, maxY: e.y + 26 }
        : null
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
    } else if (s.kind === 'lumiere') {
      const l = (this.level.lumieres ?? [])[s.index]
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
    } else if (s.kind === 'condensat') {
      const c = (this.level.condensats ?? [])[s.index]
      if (c) {
        c.x += dx
        c.y += dy
      }
    } else if (s.kind === 'fiole') {
      if (this.level.fiole) {
        this.level.fiole.x += dx
        this.level.fiole.y += dy
      }
    } else if (s.kind === 'marchand') {
      if (this.level.marchand) {
        this.level.marchand.x += dx
        this.level.marchand.y += dy
      }
    } else if (s.kind === 'eclat') {
      const e = (this.level.eclats ?? [])[s.index]
      if (e) {
        e.x += dx
        e.y += dy
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
      if (r)
        this.applyRect({
          minX: r.minX + dx,
          minY: r.minY + dy,
          maxX: r.maxX + dx,
          maxY: r.maxY + dy,
        })
      this.sel = garde
    }
  }

  /** Aligne les éléments de la sélection multiple sur un même bord. */
  // Même largeur / hauteur : la PREMIÈRE boîte sélectionnée donne la
  // mesure, les autres l'adoptent autour de leur centre (façon Canva).
  private memeDimension(quoi: 'largeur' | 'hauteur'): void {
    const boites = this.multi.filter((m) => m?.kind === 'box') as {
      kind: 'box'
      index: number
    }[]
    if (boites.length < 2) {
      this.status(
        'Même dimension : sélectionnez au moins deux parois (Maj + clic).',
      )
      return
    }
    const ref = this.level.boxes[boites[0].index]
    const mesure =
      quoi === 'largeur' ? ref.maxX - ref.minX : ref.maxY - ref.minY
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

  private alignMulti(
    op: 'gauche' | 'droite' | 'haut' | 'bas' | 'centreH' | 'centreV',
  ): void {
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
      else if (op === 'centreH')
        this.moveSelBy(m, (minX + maxX) / 2 - (b.minX + b.maxX) / 2, 0)
      else this.moveSelBy(m, 0, (minY + maxY) / 2 - (b.minY + b.maxY) / 2)
    }
    this.commit('Alignés.')
  }

  /** Répartit la sélection multiple ÉQUITABLEMENT dans la salle : mêmes
   * écarts entre les murs et chaque élément — deux parois dans la largeur
   * d'une pièce se posent d'un clic, sans calcul mental. */
  private repartir(axe: 'x' | 'y'): void {
    const items = this.multi
      .map((m) => ({ m, b: this.boundsOf(m) }))
      .filter((x): x is { m: Sel; b: Rect } => x.b !== null)
    if (items.length < 2) return
    const s = this.level.bounds
    const debut = axe === 'x' ? s.minX : s.minY
    const fin = axe === 'x' ? s.maxX : s.maxY
    items.sort((p, q) =>
      axe === 'x'
        ? p.b.minX + p.b.maxX - (q.b.minX + q.b.maxX)
        : p.b.minY + p.b.maxY - (q.b.minY + q.b.maxY),
    )
    const total = items.reduce(
      (t, x) => t + (axe === 'x' ? x.b.maxX - x.b.minX : x.b.maxY - x.b.minY),
      0,
    )
    const ecart = (fin - debut - total) / (items.length + 1)
    let pos = debut + ecart
    for (const { m, b } of items) {
      const taille = axe === 'x' ? b.maxX - b.minX : b.maxY - b.minY
      if (axe === 'x') this.moveSelBy(m, pos - b.minX, 0)
      else this.moveSelBy(m, 0, pos - b.minY)
      pos += taille + ecart
    }
    this.commit(
      `Répartis dans la ${axe === 'x' ? 'largeur' : 'hauteur'} de la salle — écarts égaux de ${Math.round(ecart)} u, murs compris.`,
    )
  }

  /** Le nom d'une pièce désignée par la Superposition. */
  private nomCible(c: CutCible): string {
    return c.kind === 'sponge'
      ? 'Éponge'
      : MATERIAL_NAMES[this.level.boxes[c.index].material]
  }

  /** L'empreinte RECTANGULAIRE d'une pièce — ce qu'elle retire au perdant.
   *  Une paroi oblique ou en forme n'en a pas : on refuse plutôt que de
   *  ronger à côté (la Gomme, elle, efface librement). */
  private empreinteCible(c: CutCible): Rect | null {
    if (c.kind === 'sponge') {
      const sp = this.level.sponges[c.index]
      return {
        minX: sp.minX,
        minY: sp.minY,
        maxX: sp.minX + sp.cols * sp.cellSize,
        maxY: sp.minY + sp.rows * sp.cellSize,
      }
    }
    const b = this.level.boxes[c.index]
    if (b.angle || b.forme) return null
    return { minX: b.minX, minY: b.minY, maxX: b.maxX, maxY: b.maxY }
  }

  /** Ce qui se trouve sous le point monde, du plus « au-dessus » au plus bas. */
  /** L'EMPRISE D'UNE ÉTIQUETTE, en unités du monde — celle du TEXTE qu'on
   * voit, marge comprise. Elle valait « 60 / zoom » en demi-hauteur et
   * « 96 / zoom » en demi-largeur : 192 × 60 pixels d'écran autour du point,
   * quelle que soit la longueur du mot. Une étiquette de trois lettres
   * couvrait donc une zone cinq à dix fois plus grande que ce qu'elle
   * montrait — et comme les étiquettes passent EN PREMIER au clic, elles
   * volaient la sélection de toute paroi qui passait dessous. On mesure
   * maintenant le texte lui-même, dans la police qui le dessine. */
  private empriseLabel(l: WorldLabel): { dx: number; dy: number } {
    const g = this.ctx
    g.save()
    g.font = LevelEditor.POLICE_LABEL
    const w = g.measureText(l.text).width
    g.restore()
    // 6 px de marge autour du texte, 11 px de corps : de quoi viser au doigt
    // sans déborder sur les surfaces voisines
    return { dx: (w / 2 + 6) / this.zoom, dy: (11 / 2 + 5) / this.zoom }
  }

  private pick(x: number, y: number): Sel {
    const inside = (r: Rect): boolean =>
      x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY
    const labels = this.level.labels
    for (let i = labels.length - 1; i >= 0; i--) {
      const l = labels[i]
      const e = this.empriseLabel(l)
      if (Math.abs(l.x - x) < e.dx && Math.abs(l.y - y) < e.dy) {
        return { kind: 'label', index: i }
      }
    }
    const lumieres = this.level.lumieres ?? []
    for (let i = lumieres.length - 1; i >= 0; i--) {
      if (
        Math.hypot(lumieres[i].x - x, lumieres[i].y - y) <
        Math.max(26, 28 / this.zoom)
      ) {
        return { kind: 'lumiere', index: i }
      }
    }
    const lasers = this.level.lasers ?? []
    for (let i = lasers.length - 1; i >= 0; i--) {
      if (
        Math.hypot(lasers[i].x - x, lasers[i].y - y) <
        Math.max(24, 26 / this.zoom)
      ) {
        return { kind: 'laser', index: i }
      }
    }
    const cibles = this.level.cibles ?? []
    for (let i = cibles.length - 1; i >= 0; i--) {
      if (Math.hypot(cibles[i].x - x, cibles[i].y - y) < cibles[i].r + 8) {
        return { kind: 'cible', index: i }
      }
    }
    const condensats = this.level.condensats ?? []
    for (let i = condensats.length - 1; i >= 0; i--) {
      if (
        Math.hypot(condensats[i].x - x, condensats[i].y - y) <
        Math.max(26, 28 / this.zoom)
      ) {
        return { kind: 'condensat', index: i }
      }
    }
    if (
      this.level.fiole &&
      Math.hypot(this.level.fiole.x - x, this.level.fiole.y - y) <
        Math.max(28, 30 / this.zoom)
    ) {
      return { kind: 'fiole' }
    }
    const eclats = this.level.eclats ?? []
    for (let i = eclats.length - 1; i >= 0; i--) {
      if (
        Math.hypot(eclats[i].x - x, eclats[i].y - y) <
        Math.max(26, 28 / this.zoom)
      ) {
        return { kind: 'eclat', index: i }
      }
    }
    if (
      this.level.marchand &&
      Math.hypot(this.level.marchand.x - x, this.level.marchand.y - y) <
        Math.max(34, 36 / this.zoom)
    ) {
      return { kind: 'marchand' }
    }
    const portes = this.level.portes ?? []
    for (let i = portes.length - 1; i >= 0; i--) {
      if (inside(portes[i])) return { kind: 'porte', index: i }
    }
    const plots = this.level.plots ?? []
    for (let i = plots.length - 1; i >= 0; i--) {
      if (inside(plots[i])) return { kind: 'plot', index: i }
    }
    if (this.level.bancMemoires && inside(this.level.bancMemoires)) {
      return { kind: 'banc' }
    }
    const ancres = this.level.ancres ?? []
    for (let i = ancres.length - 1; i >= 0; i--) {
      if (inside(ancres[i])) return { kind: 'ancre', index: i }
    }
    const rails = this.level.rails ?? []
    const tol = Math.max(10, 12 / this.zoom)
    for (let i = rails.length - 1; i >= 0; i--) {
      const pts = rails[i].points
      for (let k = 0; k + 1 < pts.length; k++) {
        if (distSeg(x, y, pts[k], pts[k + 1]) < tol)
          return { kind: 'rail', index: i }
      }
    }
    const sr = 70
    if (Math.hypot(this.level.spawn.x - x, this.level.spawn.y - y) < sr)
      return { kind: 'spawn' }
    if (inside(this.level.exit)) return { kind: 'exit' }
    // les décals sont dessinés PAR-DESSUS les parois : au clic, ils passent
    // avant elles — mais après tout ce qui se joue (lampes, cibles, portes…)
    const decals = this.level.decals ?? []
    for (let i = decals.length - 1; i >= 0; i--) {
      const d = decals[i]
      if (
        inside({
          minX: d.x - d.w / 2,
          minY: d.y - d.h / 2,
          maxX: d.x + d.w / 2,
          maxY: d.y + d.h / 2,
        })
      ) {
        return { kind: 'decal', index: i }
      }
    }
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
    // LES STRUCTURES s'attrapent PAR LEURS MURS : leur intérieur reste
    // transparent au clic, on y pose le mobilier normalement
    const structures = this.level.structures ?? []
    for (let i = structures.length - 1; i >= 0; i--) {
      if (dansCoque(structures[i], structures, x, y))
        return { kind: 'structure', index: i }
    }
    const caches = this.level.caches ?? []
    for (let i = caches.length - 1; i >= 0; i--) {
      // une cachette a une FORME et un ANGLE, comme une paroi : le clic se
      // juge sur sa vraie silhouette — l'AABB brute laissait la « hitbox »
      // à l'angle d'avant après une rotation (signalé)
      if (dansBoite(caches[i], x, y)) return { kind: 'cache', index: i }
    }
    const zones = this.level.zones ?? []
    for (let i = zones.length - 1; i >= 0; i--) {
      if (inside(zones[i])) return { kind: 'zone', index: i }
    }
    return null
  }

  /** Poignée de redimensionnement sous le curseur, s'il y en a une. */
  // Superposition : la paroi cliquée en premier PREND LE DESSUS, la seconde
  // cède la zone commune (la GOMME, elle, efface librement une zone tracée)
  // La matière du prochain tracé : choisie dans « Surfaces », elle habille
  // aussi les outils de FORME (un disque de glace, un arc de chaudière…).
  private matiereCourante = MAT_WALL
  private cutWinner: CutCible | null = null
  // Guides magnétiques pendant un déplacement (façon Canva)
  private guides: { axe: 'v' | 'h'; pos: number }[] = []
  // Écarts ÉGAUX : les mesures roses dessinées quand l'aimant propose une
  // équirépartition — même espace de part et d'autre, ou rythme répété.
  // axe 'x' : un écart horizontal tracé à la latitude lat (y monde) ;
  // axe 'y' : un écart vertical tracé à la longitude lat (x monde).
  private ecarts: { axe: 'x' | 'y'; lat: number; a: number; b: number }[] = []

  // ——— La bulle savante ————————————————————————————————————————————
  /** Peint la fiche dans la bulle et la montre près du curseur. */
  private montreBulle(
    fiche: Fiche,
    cx: number,
    cy: number,
    cleF: string | null = null,
  ): void {
    const cleClasse = (c: string): string =>
      c === 'EAU'
        ? ' ed-cle-eau'
        : c === 'GLACE'
          ? ' ed-cle-glace'
          : c === 'VAPEUR'
            ? ' ed-cle-vapeur'
            : c === 'LASER'
              ? ' ed-cle-laser'
              : ''
    const esc = (t: string): string =>
      t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    const sur = cleF ? this.surcharges[cleF] : undefined
    this.bulle.innerHTML =
      `<div class="ed-bulle-titre">${esc(fiche.titre)}</div>` +
      (cleF
        ? `<button type="button" class="ed-bulle-mod" data-cle="${esc(cleF)}" title="Modifier cette fiche — pour tout le monde">✎</button>`
        : '') +
      `<div class="ed-bulle-resume">${esc(fiche.resume)}</div>` +
      fiche.lignes
        .map(
          (l) =>
            `<div class="ed-bulle-l"><span class="ed-bulle-cle${cleClasse(l.cle)}">${esc(l.cle)}</span><span>${esc(l.txt)}</span></div>`,
        )
        .join('') +
      (sur
        ? `<div class="ed-bulle-sur">réécrite par ${esc(sur.auteur || '?')} · ${esc(sur.date.slice(0, 10))}${sur.notes ? ' · une note attend en relecture' : ''}</div>`
        : '')
    this.bulle.hidden = false
    this.positionneBulle(cx, cy)
  }

  /** Place la bulle près du point (page), sans jamais sortir de l'écran. */
  private positionneBulle(cx: number, cy: number): void {
    const b = this.bulle
    b.style.left = '0px'
    b.style.top = '0px'
    const r = b.getBoundingClientRect()
    let x = cx + 16
    let y = cy + 18
    if (x + r.width > window.innerWidth - 8) x = Math.max(8, cx - r.width - 16)
    if (y + r.height > window.innerHeight - 8)
      y = Math.max(8, cy - r.height - 14)
    b.style.left = `${Math.round(x)}px`
    b.style.top = `${Math.round(y)}px`
  }

  private cacheBulle(): void {
    if (this.bulleTimer !== null) {
      clearTimeout(this.bulleTimer)
      this.bulleTimer = null
    }
    if (!this.bulle.hidden) this.bulle.hidden = true
    this.bulleCle = ''
  }

  /** Au survol du canevas : repousse l'apparition tant que la souris
   * bouge. Une bulle OUVERTE reste ancrée tant que le curseur demeure à
   * son voisinage (le couloir qui mène au ✎) — elle ne se ferme qu'en
   * s'éloignant vraiment, ou en changeant d'élément loin d'elle. */
  private majBulle(cx: number, cy: number, wx: number, wy: number): void {
    if (!this.bulle.hidden) {
      // le COULOIR : à moins de 28 px de la bulle, elle tient bon et ne
      // bouge plus — une cible mouvante ne se clique pas
      const r = this.bulle.getBoundingClientRect()
      if (
        cx >= r.left - 28 &&
        cx <= r.right + 28 &&
        cy >= r.top - 28 &&
        cy <= r.bottom + 28
      )
        return
    }
    const hit = this.pick(wx, wy)
    const cle = hit
      ? `${hit.kind}:${'index' in hit && hit.index !== undefined ? hit.index : ''}`
      : ''
    if (!cle) {
      this.cacheBulle()
      return
    }
    if (!this.bulle.hidden && cle === this.bulleCle) {
      this.positionneBulle(cx, cy)
      return
    }
    if (!this.bulle.hidden) this.bulle.hidden = true
    if (this.bulleTimer !== null) clearTimeout(this.bulleTimer)
    this.bulleTimer = window.setTimeout(() => {
      this.bulleTimer = null
      if (this.drag) return // jamais pendant un geste
      const fiche = ficheElement(hit, this.level, this.surcharges)
      if (!fiche) return
      this.bulleCle = cle
      this.montreBulle(fiche, cx, cy, cleFiche(hit, this.level))
    }, 650)
  }

  /** Charge les fiches réécrites depuis le magasin partagé. Sans réseau :
   * la bulle garde son texte d'origine, rien ne casse. */
  private async chargeSurcharges(): Promise<void> {
    try {
      const r = await fetch('/api/fiches')
      if (!r.ok) return
      const data = (await r.json()) as { surcharges?: FicheSurcharge[] }
      const map: Surcharges = {}
      for (const s of data.surcharges ?? []) if (s && s.cle) map[s.cle] = s
      this.surcharges = map
      this.majBoutonFiches()
    } catch {
      // hors-ligne : les fiches d'origine suffisent
    }
  }

  /** Le compteur du bouton « Fiches » de la barre : n réécritures. */
  private majBoutonFiches(): void {
    const b = document.getElementById('ed-fiches')
    if (!b) return
    const n = Object.keys(this.surcharges).length
    b.textContent = n > 0 ? `🗒 Fiches · ${n}` : '🗒 Fiches'
    b.classList.toggle('ed-fiches-marque', n > 0)
  }

  /** L'ÉDITION d'une fiche : titre, résumé et lignes se réécrivent, la
   * sauvegarde vaut pour tout le monde (magasin partagé). Les valeurs
   * vives (dimensions, canal, angle…) ne sont pas là : elles se
   * recalculent toutes seules et survivent à toute réécriture. */
  private ouvreEditionFiche(cleF: string): void {
    const statique = ficheStatique(cleF)
    if (!statique) return
    const actuel = this.surcharges[cleF] ?? statique
    const voile = document.createElement('div')
    voile.className = 'ed-fiches-voile'
    const esc = (t: string): string =>
      t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
    voile.innerHTML =
      `<div class="ed-fiches-carte">` +
      `<div class="ed-fiches-tete">MODIFIER LA FICHE <span>· ${esc(cleF)} · pour tout le monde</span></div>` +
      `<label class="ed-f"><span>Titre</span><input id="fm-titre" maxlength="80" value="${esc(actuel.titre)}"></label>` +
      `<label class="ed-f"><span>Résumé</span><input id="fm-resume" maxlength="400" value="${esc(actuel.resume)}"></label>` +
      `<label class="ed-f"><span>Lignes — une par ligne, « CLÉ | texte » (clés : EAU, GLACE, VAPEUR, LASER, ·)</span>` +
      `<textarea id="fm-lignes" rows="8">${esc(actuel.lignes.map((l) => `${l.cle} | ${l.txt}`).join('\n'))}</textarea></label>` +
      `<p class="ed-fiches-note">Les valeurs vives (dimensions, canal, angle, capacité…) s'ajoutent toutes seules sous la fiche : inutile de les écrire ici.</p>` +
      `<label class="ed-f"><span>Notes — remonter un problème (valeur vive fausse, manque…) : lisibles dans la relecture, jamais en jeu</span>` +
      `<textarea id="fm-notes" rows="3" placeholder="Ex. : le canal affiché ne suit pas quand on renumérote les pastilles…">${esc(this.surcharges[cleF]?.notes ?? '')}</textarea></label>` +
      `<div class="ed-fiches-actions">` +
      `<button type="button" class="ed-btn" id="fm-annuler">Annuler</button>` +
      (this.surcharges[cleF]
        ? `<button type="button" class="ed-btn" id="fm-retablir">Rétablir l'original</button>`
        : '') +
      `<button type="button" class="ed-btn ed-btn-vert" id="fm-enregistrer">Enregistrer pour tous</button>` +
      `</div></div>`
    document.body.appendChild(voile)
    const ferme = (): void => voile.remove()
    voile.addEventListener('click', (e) => {
      if (e.target === voile) ferme()
    })
    voile.querySelector('#fm-annuler')?.addEventListener('click', ferme)
    voile.querySelector('#fm-retablir')?.addEventListener('click', () => {
      void (async () => {
        try {
          const r = await fetch(`/api/fiches?cle=${encodeURIComponent(cleF)}`, {
            method: 'DELETE',
          })
          if (!r.ok) throw new Error(String(r.status))
          delete this.surcharges[cleF]
          this.majBoutonFiches()
          this.status('Fiche rétablie à l’original — pour tout le monde.')
          ferme()
        } catch {
          this.status('Rétablissement impossible (réseau ?) — réessayez.')
        }
      })()
    })
    voile.querySelector('#fm-enregistrer')?.addEventListener('click', () => {
      const titre = (
        voile.querySelector('#fm-titre') as HTMLInputElement
      ).value.trim()
      const resume = (
        voile.querySelector('#fm-resume') as HTMLInputElement
      ).value.trim()
      const notes = (
        voile.querySelector('#fm-notes') as HTMLTextAreaElement
      ).value.trim()
      const brut = (voile.querySelector('#fm-lignes') as HTMLTextAreaElement)
        .value
      const lignes = brut
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const i = l.indexOf('|')
          return i >= 0
            ? { cle: l.slice(0, i).trim() || '·', txt: l.slice(i + 1).trim() }
            : { cle: '·', txt: l }
        })
        .filter((l) => l.txt)
      if (!titre || lignes.length === 0) {
        this.status('Il faut au moins un titre et une ligne.')
        return
      }
      let auteur = ''
      try {
        const reg = JSON.parse(
          localStorage.getItem('projet21.registres.v1') ?? '{}',
        ) as { operator?: string }
        auteur = reg.operator ?? ''
      } catch {
        // sans signature : la fiche part anonyme
      }
      void (async () => {
        try {
          const r = await fetch('/api/fiches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cle: cleF,
              titre,
              resume,
              lignes,
              auteur,
              notes,
            }),
          })
          if (!r.ok) throw new Error(String(r.status))
          const rep = (await r.json()) as { surcharge?: FicheSurcharge }
          if (rep.surcharge) this.surcharges[cleF] = rep.surcharge
          this.majBoutonFiches()
          this.status(
            'Fiche enregistrée — tout le monde la lit désormais ainsi.',
          )
          ferme()
        } catch {
          this.status('Enregistrement impossible (réseau ?) — réessayez.')
        }
      })()
    })
  }

  /** La RELECTURE : ce qui a été réécrit, fiche par fiche, avec l'écart
   * face au texte d'origine — pour corriger ensuite le système. */
  private ouvreRelectureFiches(): void {
    if (this.ficheVoile) this.ficheVoile.remove()
    const voile = document.createElement('div')
    voile.className = 'ed-fiches-voile'
    this.ficheVoile = voile
    const esc = (t: string): string =>
      t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    const cles = Object.keys(this.surcharges).sort()
    const diffChamp = (nom: string, avant: string, apres: string): string =>
      avant === apres
        ? ''
        : `<div class="ed-diff-champ"><b>${nom}</b>` +
          `<div class="ed-diff-avant">${esc(avant)}</div>` +
          `<div class="ed-diff-apres">${esc(apres)}</div></div>`
    const diffLignes = (avant: Fiche, apres: FicheSurcharge): string => {
      const cleTxt = (l: { cle: string; txt: string }): string =>
        `${l.cle} | ${l.txt}`
      const a = avant.lignes.map(cleTxt)
      const b = apres.lignes.map(cleTxt)
      if (a.join('\n') === b.join('\n')) return ''
      const enleve = a.filter((l) => !b.includes(l))
      const ajoute = b.filter((l) => !a.includes(l))
      return (
        `<div class="ed-diff-champ"><b>Lignes</b>` +
        enleve
          .map((l) => `<div class="ed-diff-avant">${esc(l)}</div>`)
          .join('') +
        ajoute
          .map((l) => `<div class="ed-diff-apres">${esc(l)}</div>`)
          .join('') +
        `</div>`
      )
    }
    voile.innerHTML =
      `<div class="ed-fiches-carte ed-fiches-large">` +
      `<div class="ed-fiches-tete">FICHES RÉÉCRITES <span>· l'écart face au texte d'origine — pour corriger le système ensuite</span>` +
      `<button type="button" class="ed-btn" id="fr-fermer">✕</button></div>` +
      (cles.length === 0
        ? `<p class="ed-fiches-note">Aucune fiche réécrite : toutes les bulles lisent le texte d'origine.</p>`
        : cles
            .map((cleF) => {
              const s = this.surcharges[cleF]
              const base = ficheStatique(cleF)
              const note = s.notes
                ? `<div class="ed-diff-champ"><b>Note du concepteur</b><div class="ed-diff-note">${esc(s.notes)}</div></div>`
                : ''
              const corps =
                (base
                  ? diffChamp('Titre', base.titre, s.titre) +
                    diffChamp('Résumé', base.resume, s.resume) +
                    diffLignes(base, s)
                  : `<p class="ed-fiches-note">Clé inconnue du code — fiche orpheline.</p>`) +
                note
              return (
                `<div class="ed-fiches-item">` +
                `<div class="ed-fiches-item-tete"><b>${esc(s.titre)}</b> <span>· ${esc(cleF)} · par ${esc(s.auteur || '?')} · ${esc(s.date.slice(0, 10))}</span>` +
                `<button type="button" class="ed-btn" data-mod="${esc(cleF)}">Modifier</button>` +
                `<button type="button" class="ed-btn" data-ret="${esc(cleF)}">Rétablir l'original</button></div>` +
                (corps ||
                  `<p class="ed-fiches-note">Identique à l'original (réécriture sans écart).</p>`) +
                `</div>`
              )
            })
            .join('')) +
      `</div>`
    document.body.appendChild(voile)
    const ferme = (): void => {
      voile.remove()
      this.ficheVoile = null
    }
    voile.addEventListener('click', (e) => {
      if (e.target === voile) ferme()
      const t = e.target as HTMLElement
      const mod = t.closest('[data-mod]') as HTMLElement | null
      if (mod?.dataset.mod) {
        ferme()
        this.ouvreEditionFiche(mod.dataset.mod)
      }
      const ret = t.closest('[data-ret]') as HTMLElement | null
      if (ret?.dataset.ret) {
        const cleF = ret.dataset.ret
        void (async () => {
          try {
            const r = await fetch(
              `/api/fiches?cle=${encodeURIComponent(cleF)}`,
              { method: 'DELETE' },
            )
            if (!r.ok) throw new Error(String(r.status))
            delete this.surcharges[cleF]
            this.majBoutonFiches()
            this.status('Fiche rétablie à l’original — pour tout le monde.')
            ferme()
            this.ouvreRelectureFiches()
          } catch {
            this.status('Rétablissement impossible (réseau ?) — réessayez.')
          }
        })()
      }
    })
    voile.querySelector('#fr-fermer')?.addEventListener('click', ferme)
  }

  /** Les mêmes fiches sur la PALETTE d'outils : survol posé d'un bouton
   * de surface (ou de l'éponge), la fiche du matériau s'ouvre à côté. */
  private bindBullesOutils(): void {
    const boutons = this.host.querySelectorAll<HTMLButtonElement>('.ed-tool')
    boutons.forEach((b) => {
      const outil = b.dataset.tool ?? ''
      const cleF = outil.startsWith('box:')
        ? `mat:${Number(outil.slice(4))}`
        : outil === 'sponge'
          ? 'genre:eponge'
          : null
      if (!cleF || !ficheStatique(cleF)) return
      let timer: number | null = null
      b.addEventListener('mouseenter', () => {
        timer = window.setTimeout(() => {
          const fiche = this.surcharges[cleF] ?? ficheStatique(cleF)
          if (!fiche) return
          const r = b.getBoundingClientRect()
          this.montreBulle(fiche, r.right + 4, r.top - 8, cleF)
        }, 650)
      })
      b.addEventListener('mouseleave', (e) => {
        if (timer !== null) clearTimeout(timer)
        timer = null
        // la souris part VERS la bulle : on la laisse ouverte (le ✎ est là)
        if (
          e.relatedTarget instanceof Node &&
          this.bulle.contains(e.relatedTarget)
        )
          return
        this.cacheBulle()
      })
    })
  }

  /** Les rectangles sur lesquels on s'aimante : parois droites, sas,
   * éponges — sans l'élément tenu (le sas qu'on déplace ne doit pas
   * s'aimanter sur lui-même). La salle s'ajoute à part (murs + centre). */
  private ciblesAimant(): Rect[] {
    const cibles: Rect[] = []
    this.level.boxes.forEach((b, i) => {
      if (this.sel?.kind === 'box' && this.sel.index === i) return
      if (this.multi.some((m) => m?.kind === 'box' && m.index === i)) return
      if (b.angle) return // les obliques ne proposent pas leurs bords droits
      cibles.push(b)
    })
    if (this.sel?.kind !== 'exit') cibles.push(this.level.exit)
    this.level.sponges.forEach((sp, i) => {
      if (this.sel?.kind === 'sponge' && this.sel.index === i) return
      cibles.push({
        minX: sp.minX,
        minY: sp.minY,
        maxX: sp.minX + sp.cols * sp.cellSize,
        maxY: sp.minY + sp.rows * sp.cellSize,
      })
    })
    return cibles
  }

  // Aimante un rectangle en mouvement sur les bords et centres des autres
  // éléments (parois, sas, éponges) ET de la salle — puis propose
  // l'ÉQUIRÉPARTITION : même écart de part et d'autre (murs compris) ou
  // rythme répété (l'écart des deux voisins se reproduit). Façon Canva :
  // qu'ils se touchent ou non, les alignements se proposent.
  private aimant(r: Rect): {
    rect: Rect
    guides: { axe: 'v' | 'h'; pos: number }[]
  } {
    const TH = 8 / this.zoom
    const cibles = this.ciblesAimant()
    // la salle propose ses murs et son centre, comme n'importe quel bord
    const ciblesBords: Rect[] = [...cibles, { ...this.level.bounds }]
    const cand = (t: Rect, axe: 'v' | 'h'): number[] =>
      axe === 'v'
        ? [t.minX, t.maxX, (t.minX + t.maxX) / 2]
        : [t.minY, t.maxY, (t.minY + t.maxY) / 2]
    const propre = {
      v: [r.minX, r.maxX, (r.minX + r.maxX) / 2],
      h: [r.minY, r.maxY, (r.minY + r.maxY) / 2],
    }
    let dx = 0
    let dy = 0
    let bestX = TH
    let bestY = TH
    const guides: { axe: 'v' | 'h'; pos: number }[] = []
    let gX: number | null = null
    let gY: number | null = null
    for (const t of ciblesBords) {
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
    // ——— ÉQUIRÉPARTITION ———————————————————————————————————————————
    // Sur chaque axe : les voisins les plus proches de part et d'autre
    // (dans la bande du rectangle, murs de la salle compris). Deux
    // propositions, la plus proche l'emporte sur l'aimant de bord :
    //  · CENTRAGE — même écart à gauche et à droite ;
    //  · RYTHME — l'écart entre les deux voisins d'un côté se répète.
    this.ecarts = []
    const salle = this.level.bounds
    type Prop = { d: number; delta: number; ecarts: [number, number][] }
    const propositions = (axeX: boolean): Prop[] => {
      const lo = axeX ? r.minX : r.minY
      const hi = axeX ? r.maxX : r.maxY
      const mur0 = axeX ? salle.minX : salle.minY
      const mur1 = axeX ? salle.maxX : salle.maxY
      const enBande = (t: Rect): boolean =>
        axeX
          ? t.maxY > r.minY && t.minY < r.maxY
          : t.maxX > r.minX && t.minX < r.maxX
      // voisin immédiat de chaque côté (bord tourné vers nous) + suivant
      let g1 = mur0
      let d1 = mur1
      let g1lo: number | null = null // l'autre bord du voisin gauche
      let d1hi: number | null = null
      for (const t of cibles) {
        if (!enBande(t)) continue
        const tLo = axeX ? t.minX : t.minY
        const tHi = axeX ? t.maxX : t.maxY
        if (tHi <= lo + 1e-6 && tHi > g1) {
          g1 = tHi
          g1lo = tLo
        }
        if (tLo >= hi - 1e-6 && tLo < d1) {
          d1 = tLo
          d1hi = tHi
        }
      }
      const props: Prop[] = []
      const taille = hi - lo
      // CENTRAGE entre les deux voisins (ou les murs)
      if (d1 - g1 > taille + 2) {
        const cible = (g1 + d1) / 2
        const delta = cible - (lo + hi) / 2
        props.push({
          d: Math.abs(delta),
          delta,
          ecarts: [
            [g1, lo + delta],
            [hi + delta, d1],
          ],
        })
      }
      // RYTHME côté gauche/bas : l'écart d'avant se répète
      if (g1lo !== null) {
        let g2 = mur0
        for (const t of cibles) {
          if (!enBande(t)) continue
          const tHi = axeX ? t.maxX : t.maxY
          if (tHi <= g1lo + 1e-6 && tHi > g2) g2 = tHi
        }
        const pas = g1lo - g2
        if (pas > 2) {
          const delta = g1 + pas - lo
          props.push({
            d: Math.abs(delta),
            delta,
            ecarts: [
              [g2, g1lo],
              [g1, lo + delta],
            ],
          })
        }
      }
      // RYTHME côté droit/haut
      if (d1hi !== null) {
        let d2 = mur1
        for (const t of cibles) {
          if (!enBande(t)) continue
          const tLo = axeX ? t.minX : t.minY
          if (tLo >= d1hi - 1e-6 && tLo < d2) d2 = tLo
        }
        const pas = d2 - d1hi
        if (pas > 2) {
          const delta = d1 - pas - hi
          props.push({
            d: Math.abs(delta),
            delta,
            ecarts: [
              [hi + delta, d1],
              [d1hi, d2],
            ],
          })
        }
      }
      return props
    }
    const latX = (r.minY + r.maxY) / 2
    const latY = (r.minX + r.maxX) / 2
    for (const p of propositions(true)) {
      if (p.d < TH && p.d < bestX) {
        bestX = p.d
        dx = p.delta
        gX = null // les mesures remplacent le trait
        this.ecarts = this.ecarts.filter((ec) => ec.axe !== 'x')
        for (const [a, b] of p.ecarts)
          this.ecarts.push({ axe: 'x', lat: latX, a, b })
      }
    }
    for (const p of propositions(false)) {
      if (p.d < TH && p.d < bestY) {
        bestY = p.d
        dy = p.delta
        gY = null
        this.ecarts = this.ecarts.filter((ec) => ec.axe !== 'y')
        for (const [a, b] of p.ecarts)
          this.ecarts.push({ axe: 'y', lat: latY, a, b })
      }
    }
    if (gX !== null) guides.push({ axe: 'v', pos: gX })
    if (gY !== null) guides.push({ axe: 'h', pos: gY })
    return {
      rect: {
        minX: r.minX + dx,
        minY: r.minY + dy,
        maxX: r.maxX + dx,
        maxY: r.maxY + dy,
      },
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
    return Math.hypot(sx - h.sx, sy - h.sy) <= this.prise + 2
  }

  /** Le coin (ox, oy) d'une boîte oblique, en coordonnées MONDE — offsets
   * dans le repère local (±demi-largeur, ±demi-hauteur). */
  private coinOblique(
    b: ObstacleBox,
    ox: number,
    oy: number,
  ): { x: number; y: number } {
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

  /** Rayon sensible d'une poignée : large au doigt et au stylet. */
  private get prise(): number {
    return this.pointeur === 'mouse' ? HANDLE_PX : HANDLE_PX * 2.4
  }

  private hitHandle(sx: number, sy: number): string | null {
    const r = this.selRect()
    if (!r) return null
    const p = this.prise
    // une boîte OBLIQUE se redimensionne par ses 4 coins PIVOTÉS : le coin
    // opposé reste cloué, tout se joue dans le repère de la boîte
    if (this.sel?.kind === 'box' && this.level.boxes[this.sel.index]?.angle) {
      const b = this.level.boxes[this.sel.index]
      const hx = (b.maxX - b.minX) / 2
      const hy = (b.maxY - b.minY) / 2
      for (const [code, ux, uy] of LevelEditor.COINS) {
        const c = this.coinOblique(b, ux * hx, uy * hy)
        const ecran = this.toScreen(c.x, c.y)
        if (Math.hypot(sx - ecran.sx, sy - ecran.sy) <= p) return code
      }
      return null
    }
    const a = this.toScreen(r.minX, r.maxY)
    const b = this.toScreen(r.maxX, r.minY)
    const near = (v: number, t: number): boolean => Math.abs(v - t) <= p
    const withinX = sx >= a.sx - p && sx <= b.sx + p
    const withinY = sy >= a.sy - p && sy <= b.sy + p
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
      this.cacheBulle() // un geste commence : la bulle s'efface
      try {
        c.setPointerCapture(e.pointerId)
      } catch {
        // pointeur déjà disparu (le second doigt d'un pincement qui se
        // relève, un événement synthétique) : sans gravité — mais la
        // capture ne doit JAMAIS emporter le reste du geste avec elle
      }
      this.pointeur = e.pointerType === 'mouse' ? 'mouse' : 'tactile'
      const rect = c.getBoundingClientRect()
      const sx = e.clientX - rect.left
      const sy = e.clientY - rect.top
      const w = this.toWorld(sx, sy)

      this.doigts.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (this.doigts.size >= 2) {
        // deuxième doigt : on passe au pincement — le geste en cours est
        // abandonné (on ne veut pas déplacer une paroi en zoomant)
        this.annuleAppuiLong()
        this.drag = null
        this.guides = []
        this.pinceEcart = this.ecartDoigts()
        this.pinceCentre = this.centreDoigts()
        this.draw()
        return
      }

      // clic droit ou milieu : déplacer la vue
      if (e.button === 2 || e.button === 1) {
        this.drag = { mode: 'pan', sx, sy, camX: this.camX, camY: this.camY }
        return
      }

      if (this.tool.kind === 'select') {
        // TACTILE : l'appui long vaut Maj + clic — la multi-sélection au
        // doigt (annulé au moindre déplacement, au relâcher, au 2ᵉ doigt)
        if (e.pointerType === 'touch') {
          this.annuleAppuiLong()
          this.appuiLong = {
            sx,
            sy,
            timer: window.setTimeout(() => {
              this.appuiLong = null
              this.drag = null
              this.guides = []
              this.basculeMulti(w.x, w.y)
            }, 480),
          }
        }
        // Maj + clic (ou L2 + clic à la manette) : la sélection MULTIPLE
        if (e.shiftKey || (this.hooks.modMulti?.() ?? false)) {
          this.basculeMulti(w.x, w.y)
          return
        }
        // clic sur un élément déjà dans la sélection multiple : tout se déplace
        if (this.multi.length > 1) {
          const hit = this.pick(w.x, w.y)
          if (hit && this.multi.some((m) => this.sameSel(m, hit))) {
            this.drag = {
              mode: 'multimove',
              ox: w.x,
              oy: w.y,
              prevDx: 0,
              prevDy: 0,
            }
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
        // AU DOIGT ET AU STYLET, on sélectionne d'abord, on déplace ensuite :
        // le premier appui ne fait que désigner l'élément. Sans cela, la
        // moindre dérive de la pointe (inévitable sur iPad) déplaçait ce
        // qu'on voulait seulement choisir. À la souris, rien ne change :
        // le pointeur est précis, le glisser direct reste le geste juste.
        const auDoigt = e.pointerType !== 'mouse'
        const dejaVise =
          hit !== null && this.sel !== null && this.sameSel(this.sel, hit)
        this.sel = hit
        this.syncProps()
        if (auDoigt && hit && !dejaVise) {
          this.status(
            'Élément sélectionné — reposez le doigt dessus pour le déplacer (les poignées redimensionnent).',
          )
          this.draw()
          return
        }
        if (hit) {
          if (hit.kind === 'spawn') {
            this.drag = {
              mode: 'move',
              ox: w.x - this.level.spawn.x,
              oy: w.y - this.level.spawn.y,
              start: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
            }
          } else if (hit.kind === 'laser') {
            const l = (this.level.lasers ?? [])[hit.index]
            this.drag = {
              mode: 'move',
              ox: w.x - l.x,
              oy: w.y - l.y,
              start: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
            }
          } else if (hit.kind === 'cible') {
            const t = (this.level.cibles ?? [])[hit.index]
            this.drag = {
              mode: 'move',
              ox: w.x - t.x,
              oy: w.y - t.y,
              start: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
            }
          } else if (hit.kind === 'condensat') {
            const c = (this.level.condensats ?? [])[hit.index]
            this.drag = {
              mode: 'move',
              ox: w.x - c.x,
              oy: w.y - c.y,
              start: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
            }
          } else if (hit.kind === 'fiole') {
            const f = this.level.fiole!
            this.drag = {
              mode: 'move',
              ox: w.x - f.x,
              oy: w.y - f.y,
              start: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
            }
          } else if (hit.kind === 'marchand') {
            const m = this.level.marchand!
            this.drag = {
              mode: 'move',
              ox: w.x - m.x,
              oy: w.y - m.y,
              start: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
            }
          } else if (hit.kind === 'eclat') {
            const e = (this.level.eclats ?? [])[hit.index]
            this.drag = {
              mode: 'move',
              ox: w.x - e.x,
              oy: w.y - e.y,
              start: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
            }
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
            this.drag = {
              mode: 'move',
              ox: w.x - l.x,
              oy: w.y - l.y,
              start: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
            }
          } else if (hit.kind === 'lumiere') {
            // la lampe est un POINT (x, y), pas un rectangle : le chemin
            // générique par selRect() la faisait planter — elle était le
            // seul élément impossible à déplacer à la souris
            const l = (this.level.lumieres ?? [])[hit.index]
            this.drag = {
              mode: 'move',
              ox: w.x - l.x,
              oy: w.y - l.y,
              start: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
            }
          } else {
            const r = this.selRect()
            if (r) {
              this.drag = {
                mode: 'move',
                ox: w.x - r.minX,
                oy: w.y - r.minY,
                start: { ...r },
              }
            }
          }
        }
        this.draw()
        return
      }

      // DÉCOUPE par chevauchement : cliquer la paroi qui PREND LE DESSUS,
      // puis celle qui s'efface — seule la zone où elles se chevauchent est
      // rongée du perdant. Échap annule.
      if (this.tool.kind === 'cut') {
        // Une ÉPONGE est de la matière comme une paroi : elle peut prendre le
        // dessus, et elle peut se faire ronger (sa grille perd les cellules
        // couvertes). Sans ça, l'outil ne « voyait » pas les éponges du tout.
        const cible = ((): CutCible | null => {
          // Une fois le dessus choisi, on cherche d'abord une AUTRE pièce
          // sous le curseur : cliquer deux fois dans la zone commune est le
          // geste naturel (« enlève-moi ce chevauchement ») — il doit ronger,
          // pas re-désigner la même pièce et tout annuler.
          let leGagnant: CutCible | null = null
          const memeQueGagnant = (c: CutCible): boolean =>
            this.cutWinner !== null &&
            this.cutWinner.kind === c.kind &&
            this.cutWinner.index === c.index
          for (let i = this.level.boxes.length - 1; i >= 0; i--) {
            if (!dansBoite(this.level.boxes[i], w.x, w.y)) continue
            const c: CutCible = { kind: 'box', index: i }
            if (memeQueGagnant(c)) leGagnant = c
            else return c
          }
          for (let i = this.level.sponges.length - 1; i >= 0; i--) {
            const sp = this.level.sponges[i]
            const mx = sp.minX + sp.cols * sp.cellSize
            const my = sp.minY + sp.rows * sp.cellSize
            if (w.x < sp.minX || w.x > mx || w.y < sp.minY || w.y > my) continue
            const c: CutCible = { kind: 'sponge', index: i }
            if (memeQueGagnant(c)) leGagnant = c
            else return c
          }
          return leGagnant
        })()
        if (!cible) {
          this.status(
            this.cutWinner === null
              ? 'Superposition : cliquez la paroi qui prend le dessus (celle qui garde la matière).'
              : 'Superposition : cliquez l’autre paroi — celle qui doit s’effacer sous la première.',
          )
          return
        }
        if (this.cutWinner === null) {
          this.cutWinner = cible
          this.status(
            `${this.nomCible(cible)} prend le dessus (liseré doré) — cliquez maintenant l’autre pièce, ou le chevauchement lui-même.`,
          )
          this.draw()
          return
        }
        if (
          cible.kind === this.cutWinner.kind &&
          cible.index === this.cutWinner.index
        ) {
          this.cutWinner = null
          this.status(
            'Superposition : le dessus est désélectionné — cliquez une pièce pour recommencer.',
          )
          this.draw()
          return
        }
        const gagnant = this.cutWinner
        const nomG = this.nomCible(gagnant)
        const nomP = this.nomCible(cible)
        // Quand le rognage exact n'existe pas (forme, oblique, angles
        // différents), la Superposition fait ce qu'elle promet AUTREMENT :
        // le gagnant passe au PREMIER PLAN — dessiné par-dessus le perdant,
        // matière des deux intacte. C'est le rendu qu'on cherchait en
        // rognant, sans mutiler la géométrie.
        const premierPlan = (): void => {
          if (gagnant.kind !== 'box' || cible.kind !== 'box') return
          const gi = gagnant.index
          const ci = cible.index
          if (gi < ci) {
            const [g] = this.level.boxes.splice(gi, 1)
            this.level.boxes.splice(ci, 0, g) // ci a reculé d'un cran : g atterrit APRÈS le perdant
            this.sel = { kind: 'box', index: ci }
          } else {
            this.sel = { kind: 'box', index: gi }
          }
          this.cutWinner = null
          this.setTool({ kind: 'select' })
          this.commit(
            `Rognage exact impossible entre ces pièces — ${nomG} passe au PREMIER PLAN (dessinée par-dessus ${nomP}), la matière des deux reste intacte.`,
          )
        }
        // L'empreinte du GAGNANT : le rectangle qu'il retire au perdant. Une
        // paroi oblique ou en forme n'a pas d'empreinte rectangulaire — on
        // refuse plutôt que de ronger à côté.
        const empreinte = this.empreinteCible(gagnant)
        if (!empreinte) {
          if (gagnant.kind === 'box' && cible.kind === 'box') {
            premierPlan()
            return
          }
          this.status(
            'Superposition : la pièce du dessus est oblique ou en forme, et une éponge ne peut pas passer dessous. Utilisez la GOMME pour effacer librement.',
          )
          return
        }

        if (cible.kind === 'sponge') {
          // ÉPONGE rongée : sa grille perd les cellules couvertes
          const sp = this.level.sponges[cible.index]
          const morceaux = subtractSponge(sp, empreinte)
          if (morceaux.length === 1 && morceaux[0] === sp) {
            this.status(
              `${nomG} et ${nomP} ne se chevauchent pas : il n’y a rien à ronger.`,
            )
            return
          }
          this.level.sponges.splice(cible.index, 1, ...morceaux)
          this.cutWinner = null
          this.sel =
            morceaux.length > 0 ? { kind: 'sponge', index: cible.index } : null
          this.setTool({ kind: 'select' })
          this.commit(
            morceaux.length === 0
              ? `${nomP} était entièrement sous ${nomG} : elle a disparu.`
              : `Chevauchement rongé : ${nomG} garde la zone commune, ${nomP} y perd ses cellules (${morceaux.length} morceau${morceaux.length > 1 ? 'x' : ''}).`,
          )
          return
        }

        // PAROI rongée : la découpe exacte n'existe qu'à ANGLES ÉGAUX (les
        // morceaux restent des rectangles) — tout se passe dans son repère.
        const perdante = this.level.boxes[cible.index]
        const morceaux =
          gagnant.kind === 'box'
            ? subtractBoxOblique(perdante, this.level.boxes[gagnant.index])
            : perdante.angle || perdante.forme
              ? null
              : subtractBox(perdante, empreinte)
        if (!morceaux) {
          premierPlan()
          return
        }
        const intacte =
          morceaux.length === 1 &&
          Math.abs(morceaux[0].minX - perdante.minX) < 0.01 &&
          Math.abs(morceaux[0].minY - perdante.minY) < 0.01 &&
          Math.abs(morceaux[0].maxX - perdante.maxX) < 0.01 &&
          Math.abs(morceaux[0].maxY - perdante.maxY) < 0.01
        if (intacte) {
          this.status(
            `${nomG} et ${nomP} ne se chevauchent pas : il n’y a rien à ronger.`,
          )
          return
        }
        this.level.boxes.splice(cible.index, 1, ...morceaux)
        this.cutWinner = null
        // la pièce rognée reste SÉLECTIONNÉE : le rognage se joue sous
        // l'autre pièce, il ne se verrait pas autrement
        this.sel =
          morceaux.length > 0 ? { kind: 'box', index: cible.index } : null
        this.setTool({ kind: 'select' })
        this.commit(
          morceaux.length === 0
            ? `${nomP} était entièrement sous ${nomG} : elle a disparu.`
            : `Chevauchement rongé : ${nomG} garde la zone commune, ${nomP} s'efface dessous (${morceaux.length} morceau${morceaux.length > 1 ? 'x' : ''}, sélectionné${morceaux.length > 1 ? 's' : ''}).`,
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
        this.level.cibles.push({
          x: this.snapped(w.x),
          y: this.snapped(w.y),
          r: 26,
        })
        this.sel = { kind: 'cible', index: this.level.cibles.length - 1 }
        this.setTool({ kind: 'select' })
        this.commit('Cible posée — un faisceau qui la touche l’allume.')
        return
      }
      if (this.tool.kind === 'condensat') {
        if (!this.level.condensats) this.level.condensats = []
        this.level.condensats.push({
          x: this.snapped(w.x),
          y: this.snapped(w.y),
          cl: 8,
        })
        this.sel = {
          kind: 'condensat',
          index: this.level.condensats.length - 1,
        }
        this.setTool({ kind: 'select' })
        this.commit(
          'Pastille de condensat posée — sa valeur (cL) se règle à droite. Dès la PREMIÈRE pastille posée main, le semis automatique du tableau se coupe : c’est vous qui décidez.',
        )
        return
      }
      if (this.tool.kind === 'fiole') {
        this.level.fiole = { x: this.snapped(w.x), y: this.snapped(w.y) }
        this.sel = { kind: 'fiole' }
        this.setTool({ kind: 'select' })
        this.commit(
          'Emplacement de FIOLE posé (un seul par tableau — reposer le déplace). En jeu, la fiole n’apparaît que si la collection du joueur est incomplète.',
        )
        return
      }
      if (this.tool.kind === 'marchand') {
        this.level.marchand = { x: this.snapped(w.x), y: this.snapped(w.y) }
        this.sel = { kind: 'marchand' }
        this.setTool({ kind: 'select' })
        this.commit(
          'MARCHAND posé (un seul par tableau — reposer le déplace). Une présence : l’anneau pulse en jeu, les plots font le commerce.',
        )
        return
      }
      if (this.tool.kind === 'eclat') {
        if (!this.level.eclats) this.level.eclats = []
        this.level.eclats.push({
          x: this.snapped(w.x),
          y: this.snapped(w.y),
          memoire: 2,
        })
        this.sel = { kind: 'eclat', index: this.level.eclats.length - 1 }
        this.setTool({ kind: 'select' })
        this.commit(
          'ÉCLAT DE MÉMOIRE posé — sa valeur se règle à droite. Gravé au contact, UNE FOIS PAR RUN (Recommencer ne re-farme pas) ; rien ne se grave aux essais.',
        )
        return
      }
      if (this.tool.kind === 'lumiere' || this.tool.kind === 'bande') {
        if (!this.level.lumieres) this.level.lumieres = []
        if (this.level.lumieres.length >= MAX_LUMIERES) {
          this.status(
            `Déjà ${MAX_LUMIERES} lampes : c'est le plafond — supprimez-en une d'abord.`,
          )
          this.setTool({ kind: 'select' })
          return
        }
        this.level.lumieres.push(
          this.tool.kind === 'bande'
            ? { x: this.snapped(w.x), y: this.snapped(w.y), forme: 'bandeau' }
            : { x: this.snapped(w.x), y: this.snapped(w.y) },
        )
        this.sel = { kind: 'lumiere', index: this.level.lumieres.length - 1 }
        this.setTool({ kind: 'select' })
        this.commit(
          this.level.lumieres.at(-1)?.forme === 'bandeau'
            ? 'Bande lumineuse posée — longueur, angle et taille à droite. Elle éclaire sur toute sa longueur.'
            : 'Lampe posée — hauteur, portée et intensité à droite. Haute : ombres courtes et douces ; basse : ombres longues.',
        )
        return
      }
      if (this.tool.kind === 'laser') {
        if (!this.level.lasers) this.level.lasers = []
        this.level.lasers.push({
          x: this.snapped(w.x),
          y: this.snapped(w.y),
          angle: 0,
        })
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
          if (
            Math.hypot(
              pts[pts.length - 1].x - w.x,
              pts[pts.length - 1].y - w.y,
            ) < tol
          ) {
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
        const text = prompt(
          'Texte de l’étiquette (elle sera peinte dans le décor) :',
          'PAROI',
        )
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
      // le doigt bouge : ce n'est plus un appui long
      if (
        this.appuiLong &&
        Math.hypot(sx - this.appuiLong.sx, sy - this.appuiLong.sy) > 8
      )
        this.annuleAppuiLong()

      const doigt = this.doigts.get(e.pointerId)
      if (doigt) {
        doigt.x = e.clientX
        doigt.y = e.clientY
      }
      if (this.pinceEcart !== null) {
        // Deux doigts : l'écart zoome (ancré au centre du pincement — la
        // carte reste collée aux doigts), le centre déplace la vue.
        const d = this.ecartDoigts()
        const ctr = this.centreDoigts()
        if (d !== null && ctr !== null && this.pinceEcart > 1e-3) {
          const avant = this.toWorld(ctr.x - rect.left, ctr.y - rect.top)
          this.zoom = Math.max(
            0.05,
            Math.min(3, this.zoom * (d / this.pinceEcart)),
          )
          const apres = this.toWorld(ctr.x - rect.left, ctr.y - rect.top)
          this.camX += avant.x - apres.x
          this.camY += avant.y - apres.y
          this.pinceEcart = d
        }
        if (ctr !== null && this.pinceCentre !== null) {
          this.camX -= (ctr.x - this.pinceCentre.x) / this.zoom
          this.camY += (ctr.y - this.pinceCentre.y) / this.zoom
        }
        this.pinceCentre = ctr
        this.draw()
        return
      }

      if (!this.drag) {
        c.style.cursor =
          this.tool.kind === 'select'
            ? this.sel?.kind === 'box' && this.hitRotateHandle(sx, sy)
              ? 'grab'
              : this.hitHandle(sx, sy)
                ? 'nwse-resize'
                : 'default'
            : 'crosshair'
        // la bulle savante n'existe qu'en mode Sélection, souris posée
        if (this.tool.kind === 'select' && this.pointeur === 'mouse')
          this.majBulle(e.clientX, e.clientY, w.x, w.y)
        else this.cacheBulle()
        return
      }
      this.cacheBulle()
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
          let ang = Math.round(a / cran) * cran
          // l'aimant d'ANGLE : à moins de 4° de l'angle d'une autre paroi
          // oblique, on adopte le sien — deux obliques de concert
          if (!e.altKey) {
            let bestA = 4
            this.level.boxes.forEach((autre, i) => {
              if (i === d.index) return
              const aa = autre.angle ?? 0
              if (!aa) return
              const dA = Math.abs(a - aa)
              if (dA < bestA) {
                bestA = dA
                ang = aa
              }
            })
          }
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
        for (const m of this.multi)
          this.moveSelBy(m, ddx - d.prevDx, ddy - d.prevDy)
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
        if (bb) {
          this.guides =
            this.alignAuto && !e.altKey ? this.aimant(bb).guides : []
          this.ecarts = [] // le groupe montre les traits, pas les mesures
        }
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
        } else if (this.sel?.kind === 'lumiere') {
          const l = (this.level.lumieres ?? [])[this.sel.index]
          l.x = this.snapped(w.x - d.ox)
          l.y = this.snapped(w.y - d.oy)
        } else if (this.sel?.kind === 'cible') {
          const t = (this.level.cibles ?? [])[this.sel.index]
          t.x = this.snapped(w.x - d.ox)
          t.y = this.snapped(w.y - d.oy)
        } else if (this.sel?.kind === 'condensat') {
          const c = (this.level.condensats ?? [])[this.sel.index]
          c.x = this.snapped(w.x - d.ox)
          c.y = this.snapped(w.y - d.oy)
        } else if (this.sel?.kind === 'fiole') {
          const f = this.level.fiole!
          f.x = this.snapped(w.x - d.ox)
          f.y = this.snapped(w.y - d.oy)
        } else if (this.sel?.kind === 'marchand') {
          const m = this.level.marchand!
          m.x = this.snapped(w.x - d.ox)
          m.y = this.snapped(w.y - d.oy)
        } else if (this.sel?.kind === 'eclat') {
          const e = (this.level.eclats ?? [])[this.sel.index]
          e.x = this.snapped(w.x - d.ox)
          e.y = this.snapped(w.y - d.oy)
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
          // exact avec un autre élément se propose en pointillé — sauf si
          // l'aide est coupée (case ALIGNEMENT) ou mise en pause (Alt) :
          // la pièce se pose alors exactement où on la lâche
          if (this.alignAuto && !e.altKey) {
            const colle = this.aimant(libre)
            this.guides = colle.guides
            this.applyRect(colle.rect)
          } else {
            this.guides = []
            this.ecarts = []
            this.applyRect(libre)
          }
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
          // le bord tiré s'aimante lui aussi (bords, centres, salle) —
          // même langage qu'au déplacement, la grille en repli
          const r = { ...d.start }
          this.guides = []
          this.ecarts = []
          const colle = (v: number, axe: 'v' | 'h'): number => {
            const TH = 8 / this.zoom
            let best = TH
            let pos = this.snapped(v)
            let gd: number | null = null
            for (const t of [
              ...this.ciblesAimant(),
              { ...this.level.bounds },
            ]) {
              const cs =
                axe === 'v'
                  ? [t.minX, t.maxX, (t.minX + t.maxX) / 2]
                  : [t.minY, t.maxY, (t.minY + t.maxY) / 2]
              for (const c of cs) {
                const dd = Math.abs(c - v)
                if (dd < best) {
                  best = dd
                  pos = c
                  gd = c
                }
              }
            }
            if (gd !== null) this.guides.push({ axe, pos: gd })
            return pos
          }
          if (d.edge.includes('W')) r.minX = colle(w.x, 'v')
          if (d.edge.includes('E')) r.maxX = colle(w.x, 'v')
          if (d.edge.includes('N')) r.maxY = colle(w.y, 'h')
          if (d.edge.includes('S')) r.minY = colle(w.y, 'h')
          this.applyRect(r)
        }
      }
      this.draw()
    })

    const doigtParti = (e: PointerEvent): void => {
      this.annuleAppuiLong() // relâché avant 480 ms : simple clic
      this.doigts.delete(e.pointerId)
      if (this.doigts.size < 2) {
        this.pinceEcart = null
        this.pinceCentre = null
      }
    }
    c.addEventListener('pointercancel', doigtParti)
    c.addEventListener('pointerleave', (e) => {
      if (
        e.relatedTarget instanceof Node &&
        this.bulle.contains(e.relatedTarget)
      )
        return // la souris va cliquer le ✎ : la bulle reste
      this.cacheBulle()
    })
    c.addEventListener('pointerup', (e) => {
      const pincait = this.pinceEcart !== null
      doigtParti(e)
      if (pincait) return // le pincement ne pose ni ne déplace rien
      const d = this.drag
      this.drag = null
      this.guides = []
      this.ecarts = []
      if (!d) return
      if (d.mode === 'aim') {
        this.setTool({ kind: 'select' })
        this.commit(
          'Émetteur posé — glissez depuis lui pour réorienter, ou réglez l’angle à droite.',
        )
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
          if (
            voisin &&
            Math.hypot(p.x - voisin.x, p.y - voisin.y) < this.grid
          ) {
            r.points.splice(d.point, 1)
            if (r.points.length < 2) {
              this.level.rails!.splice(d.index, 1)
              this.sel = null
              this.commit(
                'Trop court : glissez pour tracer le tronçon de rail.',
              )
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

    // iPad : Safari IGNORE « user-scalable=no » depuis iOS 10 — le
    // pincement zoomait la PAGE (interface comprise) au lieu de la carte.
    // Ses événements de geste propriétaires sont donc étouffés sur la
    // scène : le pincement appartient à la carte, et à elle seule.
    const scene = c.parentElement
    for (const nom of ['gesturestart', 'gesturechange', 'gestureend']) {
      c.addEventListener(nom, (e) => e.preventDefault())
      scene?.addEventListener(nom, (e) => e.preventDefault())
    }

    c.addEventListener(
      'wheel',
      (e) => {
        this.cacheBulle()
        e.preventDefault()
        const rect = c.getBoundingClientRect()
        const before = this.toWorld(e.clientX - rect.left, e.clientY - rect.top)
        // Molette NORMALISÉE : pixels (mode 0), lignes (1, Firefox), pages
        // (2) — puis bornée. Un cran standard (±100 px) = un pas de ×1.12 ;
        // les molettes haute résolution (rafales de petits deltas) et les
        // molettes libres (gros deltas) convergent vers la même vitesse —
        // avant, chaque événement valait UN cran plein, quel que soit son
        // delta : certaines souris zoomaient d'un extrême à l'autre.
        const brut =
          e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1)
        if (brut === 0) return
        const pas = Math.max(-3, Math.min(3, brut / 100))
        this.zoom = Math.max(
          0.05,
          Math.min(3, this.zoom * Math.pow(1.12, -pas)),
        )
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
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT')
      )
        return
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
          this.status('Superposition annulée.')
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

  // ——— La GOMME : effacer la matière dans le rectangle tracé —————————
  // Le geste est celui d'un gommage : on trace une zone, tout ce qui s'y
  // trouve disparaît. Une paroi droite entièrement dedans s'efface ; à
  // cheval, elle est ROGNÉE (le reste survit en morceaux) ; une pièce
  // oblique ou une forme (disque, arc…) ne se découpe pas au couteau
  // axial — elle s'efface entière si son centre est dans la zone, sinon
  // elle est épargnée et on le dit.
  private gomme(r: Rect): void {
    if (r.maxX - r.minX < 2 || r.maxY - r.minY < 2) {
      this.status(
        "Gomme : tracez une zone (glissez) — tout ce qu'elle couvre est effacé.",
      )
      return
    }
    const dansZone = (x: number, y: number): boolean =>
      x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY
    const restantes: ObstacleBox[] = []
    let effacees = 0
    let rognees = 0
    for (const b of this.level.boxes) {
      const chevauche = !(
        r.minX >= b.maxX ||
        r.maxX <= b.minX ||
        r.minY >= b.maxY ||
        r.maxY <= b.minY
      )
      if (!chevauche) {
        restantes.push(b)
        continue
      }
      const entiere =
        r.minX <= b.minX &&
        r.maxX >= b.maxX &&
        r.minY <= b.minY &&
        r.maxY >= b.maxY
      if (entiere) {
        effacees++
        continue
      }
      if (b.forme || b.angle) {
        // pas de découpe exacte : c'est tout ou rien, selon le centre
        if (dansZone((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2)) effacees++
        else restantes.push(b)
        continue
      }
      const morceaux = subtractBox(b, r)
      if (morceaux.length === 1 && morceaux[0] === b) restantes.push(b)
      else {
        rognees++
        // les morceaux gardent tout l'habillage de la paroi d'origine
        for (const m of morceaux) restantes.push({ ...b, ...m })
      }
    }
    // les ÉPONGES sont de la matière comme le reste : la gomme leur retire
    // les cellules couvertes (la grille se redit en morceaux calés sur la
    // même trame), et celles qui ne gardent plus rien disparaissent. Rien
    // n'est écrit avant le verdict : sans quoi un gommage « sans effet »
    // laissait quand même les éponges entamées, hors historique.
    let epEffacees = 0
    let epRognees = 0
    const spRestantes: SpongeDef[] = []
    for (const sp of this.level.sponges) {
      const morceaux = subtractSponge(sp, r)
      if (morceaux.length === 1 && morceaux[0] === sp) {
        spRestantes.push(sp)
        continue
      }
      if (morceaux.length === 0) epEffacees++
      else epRognees++
      spRestantes.push(...morceaux)
    }
    // LES COQUES (chambres et couloirs) sont de la matière, elles aussi.
    // Une coque ne se ROGNE pas — un anneau de parois coupé en deux n'est
    // plus une coque — alors la gomme la prend entière dès que le geste est
    // franc : mordre ses murs ET atteindre son cœur, c'est-à-dire traverser
    // la pièce et ressortir. Une zone tracée DANS le vide d'une chambre ne
    // la concerne pas (c'est là qu'on gomme le mobilier) ; arrêtée avant le
    // cœur, la coque survit et on le dit (gommeStructure tranche).
    const structures = this.level.structures ?? []
    const stRestantes: StructureDef[] = []
    let stChambres = 0
    let stCouloirs = 0
    let stEpargnees = 0
    for (const st of structures) {
      const verdict = gommeStructure(st, structures, r)
      if (verdict === 'effacee') {
        if (st.type === STRUCT_COULOIR) stCouloirs++
        else stChambres++
        continue
      }
      if (verdict === 'epargnee') stEpargnees++
      stRestantes.push(st)
    }
    const stEffacees = stChambres + stCouloirs
    if (
      effacees === 0 &&
      rognees === 0 &&
      epEffacees === 0 &&
      epRognees === 0 &&
      stEffacees === 0
    ) {
      this.status(
        stEpargnees > 0
          ? `Gomme : ${stEpargnees} coque${stEpargnees > 1 ? 's' : ''} mordue${stEpargnees > 1 ? 's' : ''} sur un bord — une coque part d'un bloc ou pas du tout. Poussez la zone jusqu'à son cœur, ou sélectionnez-la et Suppr.`
          : 'Gomme : rien à effacer dans cette zone.',
      )
      return
    }
    if (stEffacees > 0) this.level.structures = stRestantes
    this.level.sponges = spRestantes
    this.level.boxes = restantes
    this.sel = null
    this.multi = []
    this.setTool({ kind: 'gomme' }) // la gomme RESTE en main : on gomme en série
    const bouts: string[] = []
    if (effacees > 0)
      bouts.push(
        `${effacees} surface${effacees > 1 ? 's' : ''} effacée${effacees > 1 ? 's' : ''}`,
      )
    if (rognees > 0) bouts.push(`${rognees} rognée${rognees > 1 ? 's' : ''}`)
    if (epEffacees > 0)
      bouts.push(
        `${epEffacees} éponge${epEffacees > 1 ? 's' : ''} effacée${epEffacees > 1 ? 's' : ''}`,
      )
    if (epRognees > 0)
      bouts.push(
        `${epRognees} éponge${epRognees > 1 ? 's' : ''} entamée${epRognees > 1 ? 's' : ''}`,
      )
    if (stChambres > 0)
      bouts.push(
        `${stChambres} chambre${stChambres > 1 ? 's' : ''} effacée${stChambres > 1 ? 's' : ''}`,
      )
    if (stCouloirs > 0)
      bouts.push(
        `${stCouloirs} couloir${stCouloirs > 1 ? 's' : ''} effacé${stCouloirs > 1 ? 's' : ''}`,
      )
    if (stEpargnees > 0)
      bouts.push(
        `${stEpargnees} coque${stEpargnees > 1 ? 's' : ''} épargnée${stEpargnees > 1 ? 's' : ''} (mordue sur un bord : une coque part d'un bloc)`,
      )
    this.commit(`Gomme : ${bouts.join(', ')}.`)
  }

  private createAt(raw: Rect): void {
    const r = this.clampToBounds(raw)
    const t = this.tool
    if (t.kind === 'gomme') {
      this.gomme(r)
      return
    }
    if (t.kind === 'box') {
      // une FORME éventuelle (disque, capsule, coin, arc) naît avec ses
      // défauts — orientation et paramètres se règlent dans le panneau
      this.level.boxes.push({
        ...r,
        material: t.material,
        ...(t.forme ? { forme: t.forme } : {}),
      })
      this.sel = { kind: 'box', index: this.level.boxes.length - 1 }
      const nom = t.forme
        ? `${FORME_NAMES[t.forme]} (${MATERIAL_NAMES[t.material]})`
        : MATERIAL_NAMES[t.material]
      this.commit(`${nom} posé(e). Le matériau se change dans le panneau.`)
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
    } else if (t.kind === 'cache') {
      if (!this.level.caches) this.level.caches = []
      this.level.caches.push({ ...r })
      this.sel = { kind: 'cache', index: this.level.caches.length - 1 }
      this.commit(
        'Cachette posée — voilée en jeu, révélée quand le corps y entre.',
      )
    } else if (t.kind === 'plot') {
      if (!this.level.plots) this.level.plots = []
      // l'article naît sur le premier du catalogue de sa monnaie — il se
      // change dans le panneau, le prix du barème s'applique par défaut
      const article =
        t.monnaie === 'memoire' ? ARTICLES_COMPTOIR[0].id : ETAL_ECONOMAT[0].id
      this.level.plots.push({ ...r, article, monnaie: t.monnaie })
      this.sel = { kind: 'plot', index: this.level.plots.length - 1 }
      this.commit(
        t.monnaie === 'memoire'
          ? 'Plot d’article (MÉMOIRE) posé — l’achat au contact provisionne la PROCHAINE descente. Article et prix à droite.'
          : 'Plot d’article (CONDENSAT) posé — l’achat au contact, effet immédiat. Article et prix à droite.',
      )
    } else if (t.kind === 'structure') {
      if (!this.level.structures) this.level.structures = []
      const st = structureNeuve(t.type, r)
      if (!structureViable(st)) {
        this.commit(
          'Trop petit pour une coque : il faut deux parois plus un passage.',
        )
        return
      }
      // le budget du moteur : on refuse de poser ce qui ne se dessinerait pas
      const apres =
        this.level.boxes.length +
        coutStructures([...this.level.structures, st])
      if (apres > MAX_BOXES - 1) {
        this.commit(
          `Budget dépassé : cette structure porterait le tableau à ${apres} blocs (${MAX_BOXES - 1} au plus).`,
        )
        return
      }
      this.level.structures.push(st)
      this.sel = { kind: 'structure', index: this.level.structures.length - 1 }
      this.commit(
        t.type === STRUCT_COULOIR
          ? 'COULOIR posé — un tube ouvert aux deux bouts. RECOUVREZ une autre structure d’au moins son épaisseur : la porte se perce toute seule.'
          : 'CHAMBRE posée — une coque vide. Le chanfrein (panneau de droite) la fait passer du rectangle à l’octogone, jusqu’au chanfrein maximal.',
      )
    } else if (t.kind === 'ancre') {
      if (!this.level.ancres) this.level.ancres = []
      // toute ancre naît STATION (le rôle le plus fréquent) sur la première
      // réparation du catalogue — le rôle se change dans le panneau
      this.level.ancres.push({
        ...r,
        role: 'station',
        id: REPARATIONS[0].id,
      })
      this.sel = { kind: 'ancre', index: this.level.ancres.length - 1 }
      this.commit(
        'ANCRE MÉTA posée — station de réparation par défaut. Le rôle (barrière d’aile, table de départ, secteur scellé, porte de cuve, sortie gardée) se choisit à droite.',
      )
    } else if (t.kind === 'banc') {
      // un seul banc par tableau : retracer le déplace
      this.level.bancMemoires = { ...r }
      this.sel = { kind: 'banc' }
      this.commit(
        'BANC DES MÉMOIRES posé (un seul par tableau — retracer le déplace). En jeu, le contact du corps ouvre l’écran du cycle.',
      )
    } else if (t.kind === 'decal') {
      if (!this.level.decals) this.level.decals = []
      // le décalque se donne en CENTRE + taille : le rectangle tracé le dit
      this.level.decals.push({
        x: (r.minX + r.maxX) / 2,
        y: (r.minY + r.maxY) / 2,
        w: r.maxX - r.minX,
        h: r.maxY - r.minY,
        kind: t.sorte,
      })
      this.sel = { kind: 'decal', index: this.level.decals.length - 1 }
      this.commit(
        `Décor « ${DECAL_NOMS[t.sorte] ?? t.sorte} » posé — pur décalque : aucune physique, l'eau passe devant.`,
      )
    } else if (t.kind === 'porte') {
      if (!this.level.portes) this.level.portes = []
      // asservie au canal de la cible la plus proche — modifiable au panneau
      const cx = (r.minX + r.maxX) / 2
      const cy = (r.minY + r.maxY) / 2
      let canal = 1
      let best = Infinity
      for (let i = 0; i < (this.level.cibles ?? []).length; i++) {
        const t2 = this.level.cibles![i]
        const d2 = Math.hypot(t2.x - cx, t2.y - cy)
        if (d2 < best) {
          best = d2
          canal = canalDeCible(this.level.cibles!, i)
        }
      }
      this.level.portes.push({ ...r, canal })
      this.sel = { kind: 'porte', index: this.level.portes.length - 1 }
      this.commit(
        (this.level.cibles ?? []).length > 0
          ? `Porte posée, asservie au canal nº ${canal}.`
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
    else if (s.kind === 'cache') (this.level.caches ?? []).splice(s.index, 1)
    else if (s.kind === 'laser') (this.level.lasers ?? []).splice(s.index, 1)
    else if (s.kind === 'lumiere')
      (this.level.lumieres ?? []).splice(s.index, 1)
    else if (s.kind === 'porte') (this.level.portes ?? []).splice(s.index, 1)
    else if (s.kind === 'rail') (this.level.rails ?? []).splice(s.index, 1)
    else if (s.kind === 'condensat')
      (this.level.condensats ?? []).splice(s.index, 1)
    else if (s.kind === 'fiole') delete this.level.fiole
    else if (s.kind === 'plot') (this.level.plots ?? []).splice(s.index, 1)
    else if (s.kind === 'ancre') (this.level.ancres ?? []).splice(s.index, 1)
    else if (s.kind === 'structure')
      (this.level.structures ?? []).splice(s.index, 1)
    else if (s.kind === 'banc') delete this.level.bancMemoires
    else if (s.kind === 'marchand') delete this.level.marchand
    else if (s.kind === 'eclat') (this.level.eclats ?? []).splice(s.index, 1)
    else if (s.kind === 'cible') {
      // les numéros sont LOGIQUES : avant de retirer la pastille, chaque
      // survivante fige le sien — rien ne se renumérote, les portes tiennent
      const cs = this.level.cibles ?? []
      cs.forEach((c, i) => {
        if (c.canal === undefined) c.canal = i + 1
      })
      cs.splice(s.index, 1)
    } else if (s.kind === 'label') this.level.labels.splice(s.index, 1)
    else if (s.kind === 'decal') (this.level.decals ?? []).splice(s.index, 1)
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
    } else if (s.kind === 'cache') {
      const c = (this.level.caches ?? [])[s.index]
      this.level.caches!.push({ ...c, minX: c.minX + off, maxX: c.maxX + off })
      this.sel = { kind: 'cache', index: this.level.caches!.length - 1 }
    } else if (s.kind === 'label') {
      const l = this.level.labels[s.index]
      this.level.labels.push({ ...l, x: l.x + off })
      this.sel = { kind: 'label', index: this.level.labels.length - 1 }
    } else if (s.kind === 'laser') {
      const l = (this.level.lasers ?? [])[s.index]
      this.level.lasers!.push({ ...l, x: l.x + off })
      this.sel = { kind: 'laser', index: this.level.lasers!.length - 1 }
    } else if (s.kind === 'lumiere') {
      if ((this.level.lumieres ?? []).length >= MAX_LUMIERES) {
        this.status(`Déjà ${MAX_LUMIERES} lampes : c'est le plafond.`)
        return
      }
      const l = (this.level.lumieres ?? [])[s.index]
      this.level.lumieres!.push({ ...l, x: l.x + off })
      this.sel = { kind: 'lumiere', index: this.level.lumieres!.length - 1 }
    } else if (s.kind === 'cible') {
      const t = (this.level.cibles ?? [])[s.index]
      // la copie garde le NUMÉRO de l'originale : dupliquer une « cible 1 »
      // fait une seconde cible 1 — elles partagent le canal
      this.level.cibles!.push({
        ...t,
        canal: canalDeCible(this.level.cibles!, s.index),
        x: t.x + off,
      })
      this.sel = { kind: 'cible', index: this.level.cibles!.length - 1 }
    } else if (s.kind === 'condensat') {
      const c = (this.level.condensats ?? [])[s.index]
      this.level.condensats!.push({ ...c, x: c.x + off })
      this.sel = {
        kind: 'condensat',
        index: this.level.condensats!.length - 1,
      }
    } else if (s.kind === 'plot') {
      const p = (this.level.plots ?? [])[s.index]
      this.level.plots!.push({
        ...p,
        minX: p.minX + off,
        maxX: p.maxX + off,
      })
      this.sel = { kind: 'plot', index: this.level.plots!.length - 1 }
    } else if (s.kind === 'eclat') {
      const e = (this.level.eclats ?? [])[s.index]
      this.level.eclats!.push({ ...e, x: e.x + off })
      this.sel = { kind: 'eclat', index: this.level.eclats!.length - 1 }
    } else if (s.kind === 'structure') {
      const st = (this.level.structures ?? [])[s.index]
      this.level.structures!.push({
        ...st,
        minX: st.minX + off,
        maxX: st.maxX + off,
      })
      this.sel = { kind: 'structure', index: this.level.structures!.length - 1 }
    } else if (s.kind === 'ancre') {
      const a = (this.level.ancres ?? [])[s.index]
      this.level.ancres!.push({ ...a, minX: a.minX + off, maxX: a.maxX + off })
      this.sel = { kind: 'ancre', index: this.level.ancres!.length - 1 }
    } else if (s.kind === 'banc') {
      this.status('Un seul banc des mémoires par tableau.')
      return
    } else if (s.kind === 'marchand') {
      this.status('Un seul marchand par tableau.')
      return
    } else if (s.kind === 'fiole') {
      this.status('Un seul emplacement de fiole par tableau.')
      return
    } else if (s.kind === 'porte') {
      const q = (this.level.portes ?? [])[s.index]
      this.level.portes!.push({ ...q, minX: q.minX + off, maxX: q.maxX + off })
      this.sel = { kind: 'porte', index: this.level.portes!.length - 1 }
    } else if (s.kind === 'rail') {
      const r = (this.level.rails ?? [])[s.index]
      this.level.rails!.push({
        points: r.points.map((p) => ({ x: p.x + off, y: p.y })),
      })
      this.sel = { kind: 'rail', index: this.level.rails!.length - 1 }
    } else if (s.kind === 'decal') {
      const d = (this.level.decals ?? [])[s.index]
      this.level.decals!.push({ ...d, x: d.x + off })
      this.sel = { kind: 'decal', index: this.level.decals!.length - 1 }
    } else return
    this.commit('Dupliqué (D).')
  }

  // Un message de guidage SANS commit : l'historique ne bouge pas
  private status(hint: string): void {
    this.hint = hint
    this.draw()
  }

  /** L'ORDRE DE PEINTURE de l'élément sélectionné. La sélection SUIT
   *  l'élément déplacé : sans cela, le panneau se rabattrait sur le voisin
   *  qui vient de prendre sa place, et le second clic bougerait le mauvais.
   *  La sélection multiple n'y a pas droit — déplacer l'un décalerait les
   *  indices des autres, et le panneau d'alignement mentirait. */
  private deplaceOrdre(sens: SensOrdre): void {
    const s = this.sel
    if (!s || this.multi.length > 1) return
    if (s.kind !== 'box' && s.kind !== 'structure') return
    const liste: unknown[] | undefined =
      s.kind === 'box' ? this.level.boxes : this.level.structures
    if (!liste || liste.length < 2) return
    const avant = s.index
    const apres = deplaceDans(liste, avant, sens)
    if (apres !== avant) this.sel = { kind: s.kind, index: apres }
    this.commit(ditLeDeplacement(sens, avant, apres, liste.length))
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
      b.classList.toggle(
        'active',
        (b as HTMLElement).dataset.tool === this.toolKey(t),
      )
    }
    this.canvas.style.cursor = t.kind === 'select' ? 'default' : 'crosshair'
  }

  private toolKey(t: Tool): string {
    // les outils de FORME sont indépendants de la matière : leur clé ne
    // porte que la forme (la matière vient du dernier outil de surface)
    if (t.kind === 'box')
      return t.forme ? `forme:${t.forme}` : `box:${t.material}`
    if (t.kind === 'zone') return `zone:${t.force}`
    return t.kind
  }

  /** Peint les pastilles des outils de forme à la couleur de la matière
   *  courante : « disque » n'est pas une matière, c'est un moule. */
  private majPastillesFormes(): void {
    const col = MAT_COLORS[this.matiereCourante] ?? '#4a6b80'
    for (const b of Array.from(
      this.host.querySelectorAll('.ed-tool[data-tool^="forme:"] i'),
    )) {
      ;(b as HTMLElement).style.background =
        (b as HTMLElement).dataset.creux === '1' ? 'transparent' : col
      ;(b as HTMLElement).style.borderColor = col
    }
    const nom = this.el('ed-forme-matiere')
    if (nom) nom.textContent = MATERIAL_NAMES[this.matiereCourante] ?? ''
  }

  private bindUi(): void {
    for (const b of Array.from(this.host.querySelectorAll('.ed-tool'))) {
      b.addEventListener('click', () => {
        const key = (b as HTMLElement).dataset.tool ?? 'select'
        if (key.startsWith('box:')) {
          // choisir une SURFACE fixe la matière courante — les moules
          // (disque, capsule…) s'y couleront ensuite
          const mat = Number(key.slice(4)) || 0
          this.matiereCourante = mat
          this.majPastillesFormes()
          this.setTool({ kind: 'box', material: mat })
        } else if (key.startsWith('forme:')) {
          // une FORME se pose dans la matière courante : glace, chaudière,
          // hydrophobe… tout matériau prend n'importe quel moule
          this.setTool({
            kind: 'box',
            material: this.matiereCourante,
            forme: Number(key.slice(6)) || 0,
          })
        } else if (key.startsWith('decal:')) {
          const sorte = key.slice(6) as DecalDef['kind']
          this.setTool({
            kind: 'decal',
            sorte: DECAL_SORTES.includes(sorte) ? sorte : 'tuyaux',
          })
        } else if (key.startsWith('zone:'))
          this.setTool({ kind: 'zone', force: key.slice(5) as ZoneForce })
        else if (key === 'sponge') this.setTool({ kind: 'sponge' })
        else if (key === 'spawn') this.setTool({ kind: 'spawn' })
        else if (key === 'exit') this.setTool({ kind: 'exit' })
        else if (key === 'label') this.setTool({ kind: 'label' })
        else if (key === 'laser') this.setTool({ kind: 'laser' })
        else if (key === 'cible') this.setTool({ kind: 'cible' })
        else if (key === 'condensat') this.setTool({ kind: 'condensat' })
        else if (key === 'fiole') this.setTool({ kind: 'fiole' })
        else if (key.startsWith('plot:'))
          this.setTool({
            kind: 'plot',
            monnaie: key.slice(5) === 'memoire' ? 'memoire' : 'condensat',
          })
        else if (key === 'banc') this.setTool({ kind: 'banc' })
        else if (key === 'ancre') this.setTool({ kind: 'ancre' })
        else if (key.startsWith('struct:'))
          this.setTool({
            kind: 'structure',
            type: Number(key.slice(7)) === STRUCT_COULOIR ? STRUCT_COULOIR : STRUCT_CHAMBRE,
          })
        else if (key === 'marchand') this.setTool({ kind: 'marchand' })
        else if (key === 'eclat') this.setTool({ kind: 'eclat' })
        else if (key === 'porte') this.setTool({ kind: 'porte' })
        else if (key === 'cache') this.setTool({ kind: 'cache' })
        else if (key === 'rail') this.setTool({ kind: 'rail' })
        else if (key === 'lumiere') this.setTool({ kind: 'lumiere' })
        else if (key === 'bande') this.setTool({ kind: 'bande' })
        else if (key === 'cut') this.setTool({ kind: 'cut' })
        else if (key === 'gomme') this.setTool({ kind: 'gomme' })
        else this.setTool({ kind: 'select' })
      })
    }
    this.majPastillesFormes() // les moules portent la couleur de la matière

    // Tableaux LIVRÉS : une copie s'ouvre comme brouillon — pour étudier la
    // construction des salles (miroirs, prisme, plasma…) ou en repartir.
    const selLivres = this.el<HTMLSelectElement>('ed-livres')
    // le HUB en tête (code « HUB », le module Méduse en RUBAN) : publié
    // dans la bibliothèque, il REMPLACE le laboratoire joué — sans jamais
    // entrer dans la séquence. Il porte TOUT son méta en données (plots,
    // banc, marchand, ancres de réparation et de sas) : la copie s'ouvre
    // ici pièce par pièce. Le hub COMPACT (chantier, code HUB2) s'étudie
    // et se copie aussi ; pour qu'il devienne LE laboratoire, renommer sa
    // copie en HUB.
    // L'ÉCONOMAT suit la même règle que le HUB : publié sous le code « ECO »,
    // sa copie remplace la salle-boutique jouée — plots, marchand compris.
    const livres = [
      TABLEAU_HUB,
      TABLEAU_HUB_COMPACT,
      TABLEAU_ECONOMAT,
      ...TABLEAUX_ECOLE,
      ...TABLEAUX,
      TABLEAU_1BIS,
    ]
    selLivres.innerHTML = livres
      .map((t, i) => `<option value="${i}">${t.code} — ${t.name}</option>`)
      .join('')
    this.el('ed-livre-charger').addEventListener('click', () => {
      const lv = livres[Number(selLivres.value) || 0]
      if (!lv) return
      if (
        !confirm(
          `Ouvrir une copie de « ${lv.code} — ${lv.name} » ? Le brouillon en cours sera remplacé.`,
        )
      ) {
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
      this.commit(
        `Copie de ${lv.code} ouverte — « Enregistrer comme… » pour la publier à votre nom.`,
      )
    })

    this.el('ed-undo').addEventListener('click', () => this.undo())
    this.el('ed-redo').addEventListener('click', () => this.redo())

    // Les deux aides au placement : l'AIMANT de grille (arrondir au pas) et
    // l'ALIGNEMENT automatique sur les voisins. Chacune se coupe seule, et
    // le choix se retient d'une séance à l'autre.
    const aides = this.litAides()
    const caseSnap = this.el('ed-snap') as HTMLInputElement
    const caseAlign = this.el('ed-align') as HTMLInputElement | null
    this.snap = aides.snap
    this.alignAuto = aides.align
    caseSnap.checked = this.snap
    if (caseAlign) caseAlign.checked = this.alignAuto
    caseSnap.addEventListener('change', (e) => {
      this.snap = (e.target as HTMLInputElement).checked
      this.ecritAides()
    })
    caseAlign?.addEventListener('change', (e) => {
      this.alignAuto = (e.target as HTMLInputElement).checked
      if (!this.alignAuto) {
        this.guides = []
        this.ecarts = []
      }
      this.hint = this.alignAuto
        ? 'Alignement automatique rétabli — les pièces se collent aux bords et centres voisins.'
        : 'Alignement automatique coupé — les pièces se posent exactement où on les lâche (Alt fait la même pause au coup par coup).'
      this.draw()
      this.ecritAides()
    })
    this.el('ed-grid').addEventListener('change', (e) => {
      this.grid = Math.max(
        1,
        Number((e.target as HTMLInputElement).value) || 20,
      )
      this.draw()
    })

    // Choix du lit musical : « suivre la cuve » reste le cas normal — la
    // musique suit alors le refroidissement de la coque, comme partout.
    const selAmb = this.el('ed-ambiance') as HTMLSelectElement
    selAmb.innerHTML =
      '<option value="">Suivre la cuve (refroidissement)</option>' +
      PISTES.map((p) => `<option value="${p}">${PISTE_NOMS[p]}</option>`).join(
        '',
      )
    selAmb.addEventListener('change', () => {
      this.level.ambiance = selAmb.value || undefined
      this.persist()
      this.commit(
        selAmb.value
          ? `Musique : ${PISTE_NOMS[selAmb.value as Piste]}.`
          : 'Musique : celle de la cuve.',
      )
    })

    this.el('ed-dashs').addEventListener('input', () => {
      const raw = (this.el('ed-dashs') as HTMLInputElement).value.trim()
      // vide : le tableau suit le réglage du banc ; sinon un budget propre
      this.level.dashBudget =
        raw === '' ? undefined : Math.max(0, Math.round(Number(raw) || 0))
      this.persist()
      this.validate()
    })
    // la frappe ne pousse pas d'instantané à chaque touche : c'est la sortie
    // du champ (change) qui grave l'étape dans l'historique
    this.el('ed-dashs').addEventListener('change', () => this.histoire())
    // LE CYCLE en descente : ce tableau suit-il les mémoires tissées, ou
    // laisse-t-il les trois états au bouton (leçons, tableaux d'atelier) ?
    this.el('ed-etats').addEventListener('change', () => {
      const v = (this.el('ed-etats') as HTMLSelectElement).value
      this.level.etats = v === 'libres' ? 'libres' : undefined
      this.persist()
      this.commit(
        v === 'libres'
          ? 'États : libres — les trois boutons, sans mémoires.'
          : 'États : suivant les mémoires (le cycle).',
      )
    })
    // Les EXIGENCES du tableau : la voie n'offre pas sa suite écrite tant
    // que le lien manuel correspondant n'est pas tissé aux mémoires.
    const litExige = (): void => {
      const ex: ('glace' | 'vapeur')[] = []
      if ((this.el('ed-exige-glace') as HTMLInputElement).checked)
        ex.push('glace')
      if ((this.el('ed-exige-vapeur') as HTMLInputElement).checked)
        ex.push('vapeur')
      this.level.exige = ex.length > 0 ? ex : undefined
      this.persist()
      this.commit(
        ex.length > 0
          ? `Le tableau exige au bouton : ${ex.join(' + ')}.`
          : 'Le tableau n’exige aucun état au bouton.',
      )
    }
    this.el('ed-exige-glace').addEventListener('change', litExige)
    this.el('ed-exige-vapeur').addEventListener('change', litExige)
    // Lumière générale : champ optionnel — vide, le tableau garde le niveau
    // historique (52 %). La frappe applique tout de suite (le banc d'essai
    // montre la pénombre en direct), la sortie du champ grave l'historique.
    this.el('ed-lum-generale').addEventListener('input', () => {
      const brut = (this.el('ed-lum-generale') as HTMLInputElement).value.trim()
      if (brut === '') delete this.level.ambiante
      else {
        const v = Number(brut)
        if (Number.isFinite(v))
          this.level.ambiante = Math.max(0, Math.min(1, v / 100))
      }
      this.persist()
    })
    this.el('ed-lum-generale').addEventListener('change', () => this.histoire())
    this.el('ed-brume').addEventListener('input', () => {
      const brut = (this.el('ed-brume') as HTMLInputElement).value.trim()
      if (brut === '') delete this.level.brume
      else {
        const v = Number(brut)
        if (Number.isFinite(v))
          this.level.brume = Math.max(0, Math.min(1, v / 100))
      }
    })
    this.el('ed-brume').addEventListener('change', () => this.histoire())
    // le plafond du reflet : une variante par salle, champ libre + suggestions
    const dlPlafonds = this.el('ed-plafonds')
    if (dlPlafonds)
      dlPlafonds.innerHTML = PLAFONDS_CONNUS.map(
        (n) => `<option value="${n}"></option>`,
      ).join('')
    this.el('ed-plafond').addEventListener('input', () => {
      const v = (this.el('ed-plafond') as HTMLInputElement).value
        .trim()
        .slice(0, 24)
      if (v === '') delete this.level.plafond
      else this.level.plafond = v
    })
    this.el('ed-plafond').addEventListener('change', () => this.histoire())
    // LE SOL DES MODULES : le fond de cuve ne se peint qu'à l'intérieur des
    // coques, et la bordure de la toile se tait — le dehors devient le vide
    this.el('ed-sol-modules').addEventListener('change', () => {
      const on = (this.el('ed-sol-modules') as HTMLInputElement).checked
      if (on) this.level.coque = 'structures'
      else delete this.level.coque
      this.commit(
        on
          ? 'Sol dans les modules : le fond ne se peint qu’à l’intérieur des coques, le dehors est le vide.'
          : 'Sol sur toute la toile : la cuve retrouve son fond et sa bordure de coque.',
      )
    })
    // Cinématiques ancrées : le code (table de montage) joué à l'entrée du
    // tableau, et celui joué à sa conclusion — vide = aucune
    for (const [id, champ] of [
      ['ed-cine-avant', 'cineAvant'],
      ['ed-cine-apres', 'cineApres'],
      ['ed-sequence', 'sequence'],
    ] as const) {
      this.el(id).addEventListener('input', () => {
        const brut = (this.el(id) as HTMLInputElement).value.trim().slice(0, 24)
        if (brut) this.level[champ] = brut
        else delete this.level[champ]
        this.persist()
      })
      this.el(id).addEventListener('change', () => this.histoire())
    }
    for (const id of ['ed-name', 'ed-code', 'ed-par', 'ed-journal'] as const) {
      this.el(id).addEventListener('input', () => {
        this.level.name =
          (this.el('ed-name') as HTMLInputElement).value || 'Sans titre'
        // « hub » en minuscules désigne le hub tout autant : on canonise ici,
        // sinon le tableau partait dans l'expédition sans que rien ne le dise
        this.level.code =
          codeCanon((this.el('ed-code') as HTMLInputElement).value) || '21-?'
        this.level.par = Math.max(
          1,
          Number((this.el('ed-par') as HTMLInputElement).value) || 3,
        )
        this.level.journal = (
          this.el('ed-journal') as HTMLTextAreaElement
        ).value
        this.persist()
        this.validate()
        this.majLectureCode()
      })
      this.el(id).addEventListener('change', () => this.histoire())
    }

    // Dimensions de la cuve : LE réglage des grandes cartes — élargir X fait
    // un diptyque (~4800) ou un triptyque (~7200). La frappe applique tout de
    // suite (avec un écart minimal de 400 pour ne jamais créer une cuve
    // dégénérée) ; la sortie du champ renormalise l'affichage et grave
    // l'étape dans l'historique.
    const majBounds = (): void => {
      const lit = (id: string, def: number): number => {
        const v = Number((this.el(id) as HTMLInputElement).value)
        return Number.isFinite(v) ? Math.max(-20000, Math.min(20000, v)) : def
      }
      const b = this.level.bounds
      b.minX = lit('ed-bxmin', b.minX)
      b.maxX = Math.max(b.minX + 400, lit('ed-bxmax', b.maxX))
      b.minY = lit('ed-bymin', b.minY)
      b.maxY = Math.max(b.minY + 400, lit('ed-bymax', b.maxY))
      this.persist()
      this.validate()
      this.draw()
    }
    for (const id of ['ed-bxmin', 'ed-bxmax', 'ed-bymin', 'ed-bymax']) {
      this.el(id).addEventListener('input', majBounds)
      this.el(id).addEventListener('change', () => {
        this.syncForm()
        this.histoire()
      })
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
      if (
        !confirm(
          'Repartir d’un tableau vierge ? Le brouillon en cours sera perdu.',
        )
      )
        return
      this.level = blankLevel()
      this.openId = ''
      this.base = ''
      this.sel = null
      this.fitView()
      this.syncForm()
      this.renderLibrary()
      this.commit('Tableau vierge.')
    })
    // ---- Le panneau du GÉNÉRATEUR : les réglages voyagent dans le code ----
    this.el('ed-gen').addEventListener('click', () => {
      this.el('edg-voile').hidden = false
      ;(this.el('edg-code') as HTMLInputElement).focus()
    })
    this.el('edg-fermer').addEventListener('click', () => {
      this.el('edg-voile').hidden = true
    })
    this.el('edg-voile').addEventListener('click', (e) => {
      if (e.target === this.el('edg-voile')) this.el('edg-voile').hidden = true
    })
    const litOptionsPanneau = (): OptionsGen => {
      let familles = 0
      this.host
        .querySelectorAll<HTMLInputElement>('#edg-familles input')
        .forEach((c) => {
          if (c.checked) familles |= 1 << Number(c.dataset.fam)
        })
      return {
        salles: Number(
          (this.el('edg-salles') as HTMLSelectElement).value,
        ) as OptionsGen['salles'],
        familles: familles || 127, // tout décocher n'a pas de sens : tout
        dangers: Number(
          (this.el('edg-dangers') as HTMLSelectElement).value,
        ) as OptionsGen['dangers'],
        cachette: Number(
          (this.el('edg-cachette') as HTMLSelectElement).value,
        ) as OptionsGen['cachette'],
        decor: Number(
          (this.el('edg-decor') as HTMLSelectElement).value,
        ) as OptionsGen['decor'],
        laby: Number(
          (this.el('edg-laby') as HTMLSelectElement).value,
        ) as OptionsGen['laby'],
        contraste: Number(
          (this.el('edg-contraste') as HTMLSelectElement).value,
        ) as OptionsGen['contraste'],
        figure: Number((this.el('edg-figure') as HTMLSelectElement).value),
        ampleur: Number(
          (this.el('edg-ampleur') as HTMLSelectElement).value,
        ) as OptionsGen['ampleur'],
        mecanismes: Number(
          (this.el('edg-mecanismes') as HTMLSelectElement).value,
        ) as OptionsGen['mecanismes'],
      }
    }
    const genere = (): void => {
      const saisie = (this.el('edg-code') as HTMLInputElement).value
      const panneau = litOptionsPanneau()
      let niveau: LevelDef | null = null
      if (saisie.trim() === '') {
        niveau = genereNiveau(
          Math.floor(Math.random() * 36 ** 4),
          null,
          panneau,
        )
      } else {
        const lue = analyseSaisie(saisie)
        if (!lue) {
          this.commit(
            'Saisie illisible — un code atelier (« 101 », « 101-K7 ») ou une graine libre (base 36).',
          )
          return
        }
        // le suffixe « ~ » d'un code retapé EST l'identité de la salle :
        // ses réglages priment sur le panneau
        const options = lue.options ?? panneau
        niveau =
          lue.type === 'atelier'
            ? genereNiveauAtelier(
                lue.cahier,
                lue.variante ??
                  Math.floor(Math.random() * 36 ** 3)
                    .toString(36)
                    .toUpperCase(),
                options,
              )
            : genereNiveau(lue.graine, null, options)
      }
      this.el('edg-voile').hidden = true
      this.level = niveau
      this.openId = ''
      this.base = ''
      this.sel = null
      this.fitView()
      this.syncForm()
      this.renderLibrary()
      this.commit(
        `Salle générée — code ${this.level.code} (retapez-le pour la retrouver, réglages compris). Traversée prouvée par le traceur ; retouchez, puis Essayer.`,
      )
    }
    this.el('edg-generer').addEventListener('click', genere)
    ;(this.el('edg-code') as HTMLInputElement).addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Enter') genere()
      },
    )
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
      ;(this.el('ed-json') as HTMLTextAreaElement).value = serializeLevel(
        this.level,
      )
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
  /** Recharge la bibliothèque depuis le serveur : LA PLANCHE (l'écran
   * d'ordonnancement visuel, main.ts) vient de réordonner ou de renommer —
   * l'éditeur se met au diapason sans attendre sa prochaine ouverture. */
  rechargeBibliotheque(): void {
    void this.refreshLibrary()
  }

  /** Adopte une bibliothèque DÉJÀ à jour (la réponse du serveur à un geste
   * de LA PLANCHE) : re-télécharger tomberait sur le cache du magasin (le
   * pointeur reste servi 60 s) et faisait revenir l'ANCIEN ordre — signalé
   * par le concepteur après un réordonnancement resté invisible ici. */
  adopteBibliotheque(levels: StoredLevel[]): void {
    this.library = levels
    this.renderLibrary()
    // LE BROUILLON OUVERT SE CONFRONTE À LA NOUVELLE BIBLIOTHÈQUE. Sans
    // cela, renommer un code dans la planche laissait l'éditeur avec
    // l'ancien : ENREGISTRER depuis l'éditeur républiait le code d'avant et
    // annulait le renommage. Le rattrapage sait déjà trancher les trois
    // cas — identique (on renoue), sans travail local (on recharge),
    // divergent (on prévient sans rien écraser).
    this.rattrapeBibliotheque()
  }

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

  /** Les tableaux LIVRÉS absents de la bibliothèque : tant qu'ils n'y sont
   *  pas, ils se jouent en FIN de séquence et ne se réordonnent pas. */
  private livresManquants(): LevelDef[] {
    const codes = new Set(this.library.map((s) => s.level.code))
    return TABLEAUX.filter((t) => !codes.has(t.code))
  }

  /** Les copies semées DÉPASSÉES par une livraison plus récente : la copie
   *  du semis fige le tableau au moment du clic, et la bibliothèque PRIME
   *  sur les livrés — sans remise à jour, une refonte livrée (éclairage,
   *  géométrie…) reste invisible pour ce poste. Seules les copies JAMAIS
   *  modifiées (auteur « expédition livrée ») sont concernées : une copie
   *  retravaillée par le joueur n'est jamais touchée. */
  /** La forme CANONIQUE d'un livré : le même aller-retour de parseur que
   *  subit toute entrée de bibliothèque — sans quoi un simple ordre de clés
   *  différent entre l'objet du code et sa copie re-parsée ferait croire à
   *  une divergence éternelle. */
  private canonLivre(t: LevelDef): string {
    const { level } = parseLevel(structuredClone(t) as unknown)
    return level ? serializeLevel(level) : serializeLevel(t)
  }

  /** Cette entrée est-elle une SEMENCE (copie livrée jamais retravaillée) ?
   *  Le serveur normalise l'auteur — majuscules, tronqué à 12 caractères :
   *  « expédition livrée » y devient « EXPÉDITION L ». Un test d'égalité
   *  stricte ne trouvait donc jamais rien (bouton invisible, signalé) —
   *  on reconnaît le préfixe, insensible à la casse. */
  private estSemence(auteur: string): boolean {
    return /^exp[eé]dition/i.test(auteur.trim())
  }

  private livresDepasses(): { entry: StoredLevel; livre: LevelDef }[] {
    const parCode = new Map(TABLEAUX.map((t) => [t.code, t]))
    const out: { entry: StoredLevel; livre: LevelDef }[] = []
    for (const s of this.library) {
      const livre = parCode.get(s.level.code)
      if (!livre) continue
      if (!this.estSemence(s.auteur)) continue
      if (serializeLevel(s.level) === this.canonLivre(livre)) continue
      out.push({ entry: s, livre })
    }
    return out
  }

  /** Les copies MODIFIÉES par le joueur dont le livré a avancé depuis : on
   *  ne les touche pas, mais on prévient — leur silhouette diverge. */
  private modifiesDivergents(): number {
    const parCode = new Map(TABLEAUX.map((t) => [t.code, t]))
    let n = 0
    for (const s of this.library) {
      const livre = parCode.get(s.level.code)
      if (!livre || this.estSemence(s.auteur)) continue
      if (serializeLevel(s.level) !== this.canonLivre(livre)) n++
    }
    return n
  }

  /** Remet chaque copie semée non modifiée au niveau du tableau livré du
   *  moment — même entrée, même place dans la séquence, contenu rafraîchi. */
  private async majLivres(): Promise<void> {
    if (this.busy) return
    const depasses = this.livresDepasses()
    if (depasses.length === 0) return
    this.busy = true
    this.commit(`Mise à jour de ${depasses.length} tableau(x) livré(s)…`)
    try {
      for (const { entry, livre } of depasses) {
        const r = await saveLevel(
          structuredClone(livre),
          entry.id,
          'expédition livrée',
        )
        if (!r) {
          this.commit(
            `Mise à jour interrompue à « ${livre.code} » : bibliothèque injoignable. Les tableaux déjà à jour le restent.`,
          )
          void this.refreshLibrary()
          return
        }
        this.library = r.levels
      }
      this.hooks.libraryChanged(this.library)
      this.commit(
        `${depasses.length} tableau(x) livré(s) remis à jour — l'ordre n'a pas bougé, vos copies modifiées non plus.`,
      )
      this.renderLibrary()
    } finally {
      this.busy = false
    }
  }

  private renderLibrary(offline = false): void {
    const host = this.el('ed-lib')
    if (offline) {
      host.innerHTML =
        '<p class="ed-empty">Bibliothèque injoignable (hors ligne ou serveur local). Le brouillon reste conservé sur cet appareil.</p>'
      return
    }
    // Les livrés absents : un bouton les sème à leur place voulue — sans
    // lui, ils se jouent quand même, mais en fin de séquence, invisibles ici.
    const manquants = this.livresManquants()
    const semeur =
      manquants.length > 0 && this.library.length > 0
        ? `<button type="button" id="ed-lib-semer" title="Chaque tableau livré absent de la liste est ajouté À SA PLACE prévue dans la séquence (copie modifiable, votre ordre existant est conservé)">SEMER LES ${manquants.length} LIVRÉS MANQUANTS</button>` +
          `<p class="ed-astuce">Sans semis, les livrés absents se jouent quand même — mais EN FIN de séquence et sans réglage d'ordre possible ici.</p>`
        : ''
    // Les copies semées dépassées par une livraison : LA BIBLIOTHÈQUE PRIME
    // sur les livrés — sans ce bouton, une refonte livrée après le semis
    // (éclairage, géométrie…) resterait invisible sur ce poste.
    const depasses = this.livresDepasses()
    const divergents = this.modifiesDivergents()
    const majeur =
      depasses.length > 0
        ? `<button type="button" id="ed-lib-maj" title="Chaque copie semée JAMAIS modifiée (auteur « expédition livrée ») est remise au niveau du tableau livré actuel — même place dans la séquence. Vos copies retravaillées ne sont pas touchées.">METTRE À JOUR ${depasses.length} LIVRÉ(S) DÉPASSÉ(S)</button>` +
          `<p class="ed-astuce">Vos copies priment sur les livrés : sans mise à jour, les refontes livrées après votre semis (éclairage, tableaux revus…) ne se voient pas ici.${
            divergents > 0
              ? ` ${divergents} copie(s) modifiée(s) par vous divergent aussi du livré — elles ne sont jamais touchées.`
              : ''
          }</p>`
        : ''
    if (this.library.length === 0) {
      host.innerHTML =
        '<p class="ed-empty">Aucun tableau enregistré : l’expédition livrée se joue telle quelle, dans son ordre conçu. « Enregistrer » publie le brouillon ; le semis ci-dessous copie tous les livrés ici pour les réordonner.</p>' +
        (manquants.length > 0
          ? `<button type="button" id="ed-lib-semer">SEMER LES ${manquants.length} TABLEAUX LIVRÉS</button>`
          : '')
      this.el('ed-lib-semer')?.addEventListener(
        'click',
        () => void this.semerManquants(),
      )
      return
    }
    // L'ORDRE se règle dans LA PLANCHE (l'écran de cartes visuelles) : ici,
    // la liste sert à CHANGER de tableau d'un clic — le rang rappelle la
    // séquence, sans se laisser modifier (une seule maison pour l'ordre).
    const planchier = this.hooks.planche
      ? `<button type="button" id="ed-lib-planche" title="La planche d'ordonnancement : toutes les salles en cartes visuelles — glisser pour réordonner LA séquence (celle de cette liste)">▧ ORDONNER DANS LA PLANCHE</button>`
      : ''
    let rang = 0
    host.innerHTML =
      majeur +
      semeur +
      planchier +
      this.library
        .map((s) => {
          const errs = checkLevel(s.level).filter(
            (v) => v.niveau === 'erreur',
          ).length
          const hub = estCodeHub(s.level.code)
          if (!hub) rang++
          return (
            `<div class="ed-lib-row${s.id === this.openId ? ' open' : ''}" data-id="${s.id}">` +
            `<span class="ed-lib-rang" title="${hub ? 'Hors séquence' : 'Rang dans la séquence — se règle dans LA PLANCHE'}">${hub ? '·' : rang}</span>` +
            `<button type="button" class="ed-lib-open" data-id="${s.id}" title="${
              s.level.code === CODE_HUB
                ? 'Le LABORATOIRE : ce tableau remplace le hub et ne compte pas dans la séquence'
                : hub
                  ? 'Un chantier de hub : hors séquence — publiez-le sous le code HUB pour qu’il devienne le laboratoire joué'
                  : 'Ouvrir ce tableau'
            }">` +
            `<b>${s.level.code}</b> ${s.level.name}` +
            (s.level.code === CODE_HUB
              ? `<em class="ed-lib-hub">LABORATOIRE</em>`
              : hub
                ? `<em class="ed-lib-hub">HORS SÉQUENCE</em>`
                : '') +
            `<small>${s.auteur ? s.auteur + ' · ' : ''}par ${s.level.par ?? '?'}${errs ? ' · ' + errs + ' erreur(s)' : ''}</small>` +
            `</button>` +
            `<span class="ed-lib-ord">` +
            `<button type="button" data-del="${s.id}" title="Supprimer de la bibliothèque">✕</button>` +
            `</span></div>`
          )
        })
        .join('')

    this.el('ed-lib-semer')?.addEventListener(
      'click',
      () => void this.semerManquants(),
    )
    this.el('ed-lib-maj')?.addEventListener(
      'click',
      () => void this.majLivres(),
    )
    this.el('ed-lib-planche')?.addEventListener('click', () =>
      this.hooks.planche?.(),
    )
    for (const b of Array.from(host.querySelectorAll('.ed-lib-open'))) {
      b.addEventListener('click', () =>
        this.openFromLibrary((b as HTMLElement).dataset.id ?? ''),
      )
    }
    for (const b of Array.from(host.querySelectorAll('[data-del]'))) {
      b.addEventListener(
        'click',
        () => void this.removeFromLibrary((b as HTMLElement).dataset.del ?? ''),
      )
    }
  }

  /** Sème les tableaux livrés absents : chaque copie s'insère À SA PLACE
   *  prévue dans la séquence (l'ordre existant du joueur est conservé — les
   *  leçons se glissent devant le tableau livré qui les suit). */
  private async semerManquants(): Promise<void> {
    if (this.busy) return
    const manquants = this.livresManquants()
    if (manquants.length === 0) return
    this.busy = true
    this.commit(`Semis de ${manquants.length} tableau(x) livré(s)…`)
    try {
      const neufs = new Set<string>()
      for (const t of manquants) {
        const r = await saveLevel(structuredClone(t), '', 'expédition livrée')
        if (!r) {
          this.commit(
            `Semis interrompu à « ${t.code} » : bibliothèque injoignable. Les tableaux déjà semés restent.`,
          )
          void this.refreshLibrary()
          return
        }
        this.library = r.levels
        neufs.add(r.id)
      }
      // l'ordre : les entrées EXISTANTES gardent leur ordre ; chaque semé
      // s'insère devant la première entrée livrée qui le SUIT dans l'ordre
      // de conception (TABLEAUX) — la leçon précède son exigence
      const posD = new Map(TABLEAUX.map((t, i) => [t.code, i]))
      const attente = this.library
        .filter((s) => neufs.has(s.id))
        .sort(
          (a, b) =>
            (posD.get(a.level.code) ?? 999) - (posD.get(b.level.code) ?? 999),
        )
      const ordre: string[] = []
      for (const s of this.library) {
        if (neufs.has(s.id)) continue
        const p = posD.get(s.level.code)
        if (p !== undefined) {
          while (
            attente.length > 0 &&
            (posD.get(attente[0].level.code) ?? 999) < p
          ) {
            ordre.push(attente.shift()!.id)
          }
        }
        ordre.push(s.id)
      }
      for (const s of attente) ordre.push(s.id)
      const saved = await reorderLibrary(ordre)
      if (saved) {
        this.library = saved
        this.hooks.libraryChanged(saved)
        this.commit(
          `${manquants.length} tableau(x) semé(s) à leur place dans la séquence — réordonnez-les librement.`,
        )
      } else {
        this.commit(
          'Tableaux semés, mais réordonnancement refusé : ils sont en fin de liste — replacez-les à la main.',
        )
        void this.refreshLibrary()
      }
      this.renderLibrary()
    } finally {
      this.busy = false
    }
  }

  /** Ouvre un tableau de la bibliothèque depuis l'EXTÉRIEUR (le ✎ d'une
   * carte de LA PLANCHE) : même geste que le clic dans la liste. */
  ouvreTableau(id: string): void {
    this.openFromLibrary(id)
  }

  private openFromLibrary(id: string): void {
    const entry = this.library.find((l) => l.id === id)
    // L'ÉCHEC NE DOIT PLUS ÊTRE MUET. Sans entrée, l'éditeur gardait le
    // tableau précédent sans rien dire : on croyait éditer la salle
    // demandée, et ENREGISTRER publiait l'autre. Mieux vaut le dire.
    if (!entry) {
      this.commit(
        'Ce tableau n’est pas dans la bibliothèque de l’éditeur — rechargez la page si le décalage persiste.',
      )
      return
    }
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
      this.commit(
        `« ${entry.level.name} » mis à jour : la bibliothèque avait une version plus récente.`,
      )
      return
    }
    this.commit(
      `⚠ La bibliothèque a une autre version de « ${entry.level.code} » — votre brouillon local en diffère. ` +
        `Cliquez le tableau dans la séquence pour charger la dernière version (le brouillon sera remplacé), ` +
        `ou ENREGISTRER pour publier la vôtre.`,
    )
  }

  private async removeFromLibrary(id: string): Promise<void> {
    const entry = this.library.find((l) => l.id === id)
    if (!entry) return
    if (
      !confirm(
        `Supprimer « ${entry.level.name} » de la bibliothèque ? C’est définitif.`,
      )
    )
      return
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
    // Le CODE se partage (il décrit la salle, il ne l'identifie pas) — c'est
    // le NUMÉRO en tête du nom qui doit rester unique dans la séquence.
    const num = numeroTableau(this.level.name)
    const memeNumero = num
      ? this.library.find((s) => {
          if (s.id === id || estCodeHub(s.level.code)) return false
          const n = numeroTableau(s.level.name)
          return (
            n !== null && n.numero === num.numero && n.lettre === num.lettre
          )
        })
      : null
    const suivante = num
      ? num.numero +
        (num.lettre ? String.fromCharCode(num.lettre.charCodeAt(0) + 1) : 'a')
      : ''
    if (
      memeNumero &&
      !confirm(
        `Le numéro « ${num!.numero}${num!.lettre} » est déjà porté par « ${memeNumero.level.name} ».\n` +
          `Deux tableaux au même numéro se disputent la même place dans la séquence — ` +
          `une lettre en plus les départage (« ${suivante} … »).\n\n` +
          `Enregistrer quand même ?`,
      )
    ) {
      this.commit(
        'Enregistrement annulé — départagez le numéro (une lettre en plus) avant de valider.',
      )
      return
    }
    this.busy = true
    this.commit('Enregistrement…')
    const saved = await saveLevel(this.level, id, this.hooks.operator())
    this.busy = false
    if (!saved) {
      // le serveur dit POURQUOI quand il refuse (plafond de poids) ; sans
      // raison, c'est le réseau, et « injoignable » est le mot juste
      this.commit(
        `Enregistrement refusé : ${raisonDuRefus() || 'bibliothèque injoignable'}.`,
      )
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
    this.commit(
      rejets.length
        ? `Chargé, ${rejets.length} pièce(s) écartée(s).`
        : 'Tableau chargé.',
    )
  }

  private syncForm(): void {
    ;(this.el('ed-name') as HTMLInputElement).value = this.level.name
    ;(this.el('ed-code') as HTMLInputElement).value = this.level.code
    ;(this.el('ed-par') as HTMLInputElement).value = String(this.level.par ?? 3)
    ;(this.el('ed-bxmin') as HTMLInputElement).value = String(
      this.level.bounds.minX,
    )
    ;(this.el('ed-bxmax') as HTMLInputElement).value = String(
      this.level.bounds.maxX,
    )
    ;(this.el('ed-bymin') as HTMLInputElement).value = String(
      this.level.bounds.minY,
    )
    ;(this.el('ed-bymax') as HTMLInputElement).value = String(
      this.level.bounds.maxY,
    )
    ;(this.el('ed-dashs') as HTMLInputElement).value =
      this.level.dashBudget === undefined ? '' : String(this.level.dashBudget)
    ;(this.el('ed-etats') as HTMLSelectElement).value =
      this.level.etats === 'libres' ? 'libres' : 'cycle'
    ;(this.el('ed-exige-glace') as HTMLInputElement).checked =
      this.level.exige?.includes('glace') ?? false
    ;(this.el('ed-exige-vapeur') as HTMLInputElement).checked =
      this.level.exige?.includes('vapeur') ?? false
    ;(this.el('ed-plafond') as HTMLInputElement).value =
      this.level.plafond ?? ''
    ;(this.el('ed-sol-modules') as HTMLInputElement).checked =
      this.level.coque === 'structures'
    ;(this.el('ed-brume') as HTMLInputElement).value =
      this.level.brume === undefined || this.level.brume === 0
        ? ''
        : String(Math.round(this.level.brume * 100))
    ;(this.el('ed-lum-generale') as HTMLInputElement).value =
      this.level.ambiante === undefined
        ? ''
        : String(Math.round(this.level.ambiante * 100))
    // les menus se REMPLISSENT à chaque synchro : une cinématique composée
    // au montage pendant qu'on édite apparaît dès le retour au tableau
    const cines = this.hooks.cines?.() ?? []
    const seqs = this.hooks.sequences?.() ?? []
    this.el('ed-cine-avant').innerHTML = optionsCodes(
      cines,
      this.level.cineAvant ?? '',
    )
    this.el('ed-cine-apres').innerHTML = optionsCodes(
      cines,
      this.level.cineApres ?? '',
    )
    this.el('ed-sequence').innerHTML = optionsCodes(
      seqs,
      this.level.sequence ?? '',
    )
    ;(this.el('ed-journal') as HTMLTextAreaElement).value = this.level.journal
    ;(this.el('ed-ambiance') as HTMLSelectElement).value =
      this.level.ambiance ?? ''
    this.syncProps()
    this.validate()
    this.majLectureCode()
  }

  /** La LECTURE du code, sous le champ : la convention atelier décodée en
   * clair (« début de run · glace · difficulté 2 »), un signalement quand
   * le code sort de la convention, et le NUMÉRO d'ordre lu en tête du nom.
   * Un même code sur plusieurs salles est normal — le code décrit, c'est le
   * numéro qui range (son doublon s'alerte à l'ENREGISTREMENT). */
  private majLectureCode(): void {
    const el = this.host.querySelector('#ed-code-lecture') as HTMLElement | null
    if (!el) return
    const code = this.level.code.trim()
    if (estCodeHub(code)) {
      el.className = 'ed-code-lecture ok'
      el.textContent =
        code.toUpperCase() === CODE_HUB
          ? 'Code réservé : ce tableau devient le LABORATOIRE (hors séquence).'
          : 'Chantier de hub : hors séquence tant qu’il ne s’appelle pas HUB.'
      return
    }
    const num = numeroTableau(this.level.name)
    const ordre = num
      ? ` Ordre : numéro ${num.numero}${num.lettre}, lu en tête du nom.`
      : ' Le nom ne commence pas par un numéro : la salle se range à la main.'
    const d = decodeCodeAtelier(code)
    if (d) {
      el.className = 'ed-code-lecture ok'
      el.textContent =
        `Code atelier — ${MOMENT_NOMS[d.moment]} · ` +
        `mécanique : ${MECANIQUE_NOMS[d.mecanique]} · difficulté ${d.difficulte}.` +
        ordre
      return
    }
    el.className = 'ed-code-lecture hors'
    el.textContent =
      `Hors convention atelier (« 111 » : moment 1-3 · mécanique 0-3 · difficulté). ` +
      `La salle se joue normalement, mais échappe aux tris et filtres par code.` +
      ordre
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
        `<button type="button" class="ed-btn" id="p-rep-x">Répartir dans la largeur (salle)</button>` +
        `<button type="button" class="ed-btn" id="p-rep-y">Répartir dans la hauteur (salle)</button>` +
        `</div>` +
        `<button type="button" class="ed-danger" id="p-del">Tout supprimer</button>`
      host
        .querySelector('#p-al-g')
        ?.addEventListener('click', () => this.alignMulti('gauche'))
      host
        .querySelector('#p-al-d')
        ?.addEventListener('click', () => this.alignMulti('droite'))
      host
        .querySelector('#p-al-h')
        ?.addEventListener('click', () => this.alignMulti('haut'))
      host
        .querySelector('#p-al-b')
        ?.addEventListener('click', () => this.alignMulti('bas'))
      host
        .querySelector('#p-al-ch')
        ?.addEventListener('click', () => this.alignMulti('centreH'))
      host
        .querySelector('#p-al-cv')
        ?.addEventListener('click', () => this.alignMulti('centreV'))
      host
        .querySelector('#p-dim-l')
        ?.addEventListener('click', () => this.memeDimension('largeur'))
      host
        .querySelector('#p-dim-h')
        ?.addEventListener('click', () => this.memeDimension('hauteur'))
      host
        .querySelector('#p-rep-x')
        ?.addEventListener('click', () => this.repartir('x'))
      host
        .querySelector('#p-rep-y')
        ?.addEventListener('click', () => this.repartir('y'))
      host
        .querySelector('#p-del')
        ?.addEventListener('click', () => this.deleteSel())
      return
    }
    const s = this.sel
    if (!s) {
      host.innerHTML =
        '<p class="ed-empty">Rien de sélectionné. Cliquez un élément (Maj + clic : sélection multiple), ou choisissez un outil et glissez pour en tracer un.</p>'
      return
    }
    const rows: string[] = []
    // L'arrondi d'affichage respecte les DÉCIMALES : arrondi à l'entier, il
    // écrasait toute valeur fine (intensité 0,5 → 1) au premier
    // rafraîchissement du panneau.
    const numField = (
      label: string,
      id: string,
      value: number,
      step = 10,
    ): string =>
      `<label class="ed-f"><span>${label}</span><input type="number" step="${step}" id="${id}" value="${+value.toFixed(3)}" /></label>`

    // Champ à CURSEUR, pour le tactile : la glissière (le doigt) et le nombre
    // (la précision) pilotent la même valeur — glisser applique en direct,
    // relâcher committe (un seul cran d'historique).
    const rangeField = (
      label: string,
      id: string,
      value: number,
      min: number,
      max: number,
      step: number,
    ): string => {
      const v = +Math.max(min, Math.min(max, value)).toFixed(3)
      return (
        `<label class="ed-f ed-fr"><span>${label}</span>` +
        `<input type="number" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}" />` +
        `<input type="range" id="${id}-r" min="${min}" max="${max}" step="${step}" value="${v}" />` +
        `</label>`
      )
    }

    if (s.kind === 'box') {
      const b = this.level.boxes[s.index]
      rows.push(
        `<label class="ed-f"><span>Matériau</span><select id="p-mat">` +
          [
            MAT_WALL,
            MAT_HYDROPHILE,
            MAT_HYDROPHOBE,
            MAT_FROID,
            MAT_GRILLE,
            MAT_CHAUD,
            MAT_MEMBRANE,
            MAT_RIDEAU,
            MAT_SURCHAUFFEUR,
            MAT_MIROIR,
          ]
            .map(
              (m) =>
                `<option value="${m}"${m === b.material ? ' selected' : ''}>${MATERIAL_NAMES[m]}</option>`,
            )
            .join('') +
          `</select></label>`,
      )
      // la FORME de la pièce : tout matériau se coule dans tout moule —
      // la boîte min/max reste la boîte englobante de la forme
      rows.push(
        `<label class="ed-f"><span>Forme</span><select id="p-forme">` +
          [FORME_RECT, FORME_DISQUE, FORME_CAPSULE, FORME_COIN, FORME_ARC]
            .map(
              (f) =>
                `<option value="${f}"${f === (b.forme ?? 0) ? ' selected' : ''}>${FORME_NAMES[f]}</option>`,
            )
            .join('') +
          `</select></label>`,
      )
      rows.push(
        numField('X min', 'p-minX', b.minX),
        numField('X max', 'p-maxX', b.maxX),
      )
      rows.push(
        numField('Y min', 'p-minY', b.minY),
        numField('Y max', 'p-maxY', b.maxY),
      )
      rows.push(rangeField('Angle (°)', 'p-ang', b.angle ?? 0, -180, 180, 1))
      if ((b.forme ?? 0) === FORME_COIN) {
        // le coin qui porte l'angle droit : l'hypoténuse regarde à l'opposé
        const coins = ['Bas-gauche', 'Bas-droit', 'Haut-droit', 'Haut-gauche']
        rows.push(
          `<label class="ed-f"><span>Angle droit au coin</span><select id="p-fq0">` +
            coins
              .map(
                (n, i) =>
                  `<option value="${i}"${i === ((Math.round(b.p0 ?? 0) % 4) + 4) % 4 ? ' selected' : ''}>${n}</option>`,
              )
              .join('') +
            `</select></label>`,
        )
      }
      if ((b.forme ?? 0) === FORME_ARC) {
        rows.push(
          rangeField(
            'Épaisseur (%)',
            'p-fep',
            Math.round((b.p0 ?? ARC_EPAISSEUR_DEFAUT) * 100),
            8,
            100,
            1,
          ),
        )
        rows.push(
          rangeField(
            'Demi-ouverture (°)',
            'p-fouv',
            b.p1 ?? ARC_OUVERTURE_DEFAUT,
            15,
            180,
            5,
          ),
        )
        rows.push(
          `<label class="ed-f"><span>Bouts</span><select id="p-fbout">` +
            ARC_BOUT_NOMS.map(
              (n, i) =>
                `<option value="${i}"${i === Math.round(b.p2 ?? 0) ? ' selected' : ''}>${n}</option>`,
            ).join('') +
            `</select></label>`,
        )
      }
      if (b.material === MAT_CHAUD) {
        // chaque chaudière règle sa portée d'aura : gros bloc à petite aura…
        rows.push(
          rangeField('Aura (× portée)', 'p-aura', b.aura ?? 1, 0.25, 4, 0.05),
        )
      }
      if (b.material === MAT_WALL && !(b.forme ?? 0)) {
        // habillage : pur décor, la physique reste celle d'une paroi neutre
        // (motifs calés sur la boîte : réservé aux rectangles)
        const skins = [
          'Standard',
          'Caissons',
          'Conduites',
          'Poutrelle',
          'Blindage',
          'Aération',
          'Hublots',
          'Écrans',
          'Câbles',
          'Vitre',
        ]
        rows.push(
          `<label class="ed-f"><span>Habillage (décor)</span><select id="p-skin">` +
            skins
              .map(
                (n, i) =>
                  `<option value="${i}"${i === (b.skin ?? 0) ? ' selected' : ''}>${n}</option>`,
              )
              .join('') +
            `</select></label>`,
        )
      }
    } else if (s.kind === 'zone') {
      const z = (this.level.zones ?? [])[s.index]
      rows.push(
        `<label class="ed-f"><span>État imposé</span><select id="p-force">` +
          (['libre', 'eau', 'glace', 'vapeur'] as ZoneForce[])
            .map(
              (f) =>
                `<option value="${f}"${f === z.force ? ' selected' : ''}>${f === 'eau' ? 'liquide' : f}</option>`,
            )
            .join('') +
          `</select></label>`,
      )
      rows.push(
        `<label class="ed-f"><span>Cause (le nom du lieu)</span>` +
          `<input id="p-zlabel" placeholder="${ZONE_CAUSES[z.force]}" value="${(z.label ?? '').replace(/"/g, '&quot;')}" /></label>`,
      )
      rows.push(
        `<label class="ed-f" title="La cinématique (table de montage) jouée quand le corps entre dans la zone, une fois par essai. Une zone « libre » qui en porte une est un pur déclencheur, sans effet d'état."><span>Cinématique</span>` +
          `<select id="p-zcine">${optionsCodes(this.hooks.cines?.() ?? [], z.cine ?? '')}</select></label>`,
      )
      rows.push(
        `<label class="ed-f" title="La SÉQUENCE in-map qui démarre quand le corps entre dans la zone, une fois par essai. C'est ainsi qu'on déclenche l'alerte au bon endroit."><span>Séquence</span>` +
          `<select id="p-zseq">${optionsCodes(this.hooks.sequences?.() ?? [], z.sequence ?? '')}</select></label>`,
      )
      rows.push(
        numField('X min', 'p-minX', z.minX),
        numField('X max', 'p-maxX', z.maxX),
      )
      rows.push(
        numField('Y min', 'p-minY', z.minY),
        numField('Y max', 'p-maxY', z.maxY),
      )
    } else if (s.kind === 'cache') {
      const c = (this.level.caches ?? [])[s.index]
      rows.push(
        `<p class="ed-empty">En jeu, ce pan est VOILÉ jusqu’à ce que le corps y ENTRE — le voile se lève alors pour l’essai (Recommencer re-voile). La physique ne change pas : ce qui est caché fonctionne.</p>`,
      )
      rows.push(
        `<label class="ed-f" title="BROUILLARD : un voile « non cartographié », assumé. PAROI FACTICE : le pan se rend comme une VRAIE paroi (ombres portées comprises) et se dissout à l'entrée — le passage secret classique."><span>Style</span><select id="p-kstyle">` +
          `<option value="brume"${c.style !== 'paroi' ? ' selected' : ''}>Brouillard</option>` +
          `<option value="paroi"${c.style === 'paroi' ? ' selected' : ''}>Paroi factice</option>` +
          `</select></label>`,
      )
      rows.push(
        `<label class="ed-f"><span>Forme</span><select id="p-kforme">` +
          [FORME_RECT, FORME_DISQUE, FORME_CAPSULE, FORME_COIN, FORME_ARC]
            .map(
              (f) =>
                `<option value="${f}"${f === (c.forme ?? 0) ? ' selected' : ''}>${FORME_NAMES[f]}</option>`,
            )
            .join('') +
          `</select></label>`,
      )
      rows.push(
        numField('X min', 'p-minX', c.minX),
        numField('X max', 'p-maxX', c.maxX),
      )
      rows.push(
        numField('Y min', 'p-minY', c.minY),
        numField('Y max', 'p-maxY', c.maxY),
      )
      rows.push(rangeField('Angle (°)', 'p-kang', c.angle ?? 0, -180, 180, 1))
      if ((c.forme ?? 0) === FORME_COIN) {
        const coins = ['Bas-gauche', 'Bas-droit', 'Haut-droit', 'Haut-gauche']
        rows.push(
          `<label class="ed-f"><span>Angle droit au coin</span><select id="p-kq0">` +
            coins
              .map(
                (n, i) =>
                  `<option value="${i}"${i === ((Math.round(c.p0 ?? 0) % 4) + 4) % 4 ? ' selected' : ''}>${n}</option>`,
              )
              .join('') +
            `</select></label>`,
        )
      }
      if ((c.forme ?? 0) === FORME_ARC) {
        rows.push(
          rangeField(
            'Épaisseur (%)',
            'p-kep',
            Math.round((c.p0 ?? ARC_EPAISSEUR_DEFAUT) * 100),
            8,
            100,
            1,
          ),
        )
        rows.push(
          rangeField(
            'Demi-ouverture (°)',
            'p-kouv',
            c.p1 ?? ARC_OUVERTURE_DEFAUT,
            15,
            180,
            1,
          ),
        )
        rows.push(
          `<label class="ed-f"><span>Bouts</span><select id="p-kbout">` +
            ARC_BOUT_NOMS.map(
              (n, i) =>
                `<option value="${i}"${i === Math.round(c.p2 ?? 0) ? ' selected' : ''}>${n}</option>`,
            ).join('') +
            `</select></label>`,
        )
      }
    } else if (s.kind === 'sponge') {
      const sp = this.level.sponges[s.index]
      rows.push(
        numField('X min', 'p-minX', sp.minX),
        numField('Y min', 'p-minY', sp.minY),
      )
      rows.push(
        numField('Colonnes', 'p-cols', sp.cols, 1),
        numField('Rangées', 'p-rows', sp.rows, 1),
      )
      rows.push(numField('Taille de cellule', 'p-cell', sp.cellSize, 2))
      rows.push(
        numField('Capacité par cellule', 'p-cap', sp.capacityPerCell, 1),
      )
    } else if (s.kind === 'exit') {
      const e = this.level.exit
      rows.push(
        numField('X min', 'p-minX', e.minX),
        numField('X max', 'p-maxX', e.maxX),
      )
      rows.push(
        numField('Y min', 'p-minY', e.minY),
        numField('Y max', 'p-maxY', e.maxY),
      )
    } else if (s.kind === 'spawn') {
      rows.push(
        numField('X', 'p-sx', this.level.spawn.x),
        numField('Y', 'p-sy', this.level.spawn.y),
      )
      rows.push(numField('Particules', 'p-sn', this.level.spawn.n, 50))
    } else if (s.kind === 'laser') {
      const l = (this.level.lasers ?? [])[s.index]
      rows.push(numField('X', 'p-lax', l.x), numField('Y', 'p-lay', l.y))
      rows.push(numField('Angle (°)', 'p-laa', l.angle, 5))
    } else if (s.kind === 'lumiere') {
      const l = (this.level.lumieres ?? [])[s.index]
      rows.push(numField('X', 'p-lmx', l.x), numField('Y', 'p-lmy', l.y))
      rows.push(
        rangeField(
          'Hauteur',
          'p-lmh',
          l.h ?? LAMPE_HAUTEUR_DEFAUT,
          LAMPE_HAUTEUR_MIN,
          LAMPE_HAUTEUR_MAX,
          10,
        ),
      )
      rows.push(
        rangeField('Portée (0 = auto)', 'p-lmp', l.portee ?? 0, 0, 4000, 50),
      )
      rows.push(
        rangeField(
          'Intensité (0 = éteinte)',
          'p-lmi',
          l.intensite ?? 1,
          0,
          2,
          0.05,
        ),
      )
      rows.push(
        `<label class="ed-f"><span>Couleur</span>` +
          `<input type="color" id="p-lmc" value="${l.couleur ?? LAMPE_COULEUR_DEFAUT}" /></label>`,
      )
      rows.push(
        `<label class="ed-f"><span>Luminaire</span><select id="p-lmf">` +
          `<option value=""${l.forme !== 'bandeau' ? ' selected' : ''}>Plafonnier (éclipse)</option>` +
          `<option value="bandeau"${l.forme === 'bandeau' ? ' selected' : ''}>Bandeau lumineux</option>` +
          `</select></label>`,
      )
      rows.push(
        rangeField('Taille (0 = invisible)', 'p-lmt', l.taille ?? 1, 0, 3, 0.1),
      )
      if (l.forme === 'bandeau') {
        rows.push(
          rangeField('Longueur', 'p-lml', l.longueur ?? 260, 80, 1600, 20),
        )
        rows.push(rangeField('Angle (°)', 'p-lmg', l.angle ?? 0, 0, 345, 15))
      }
      rows.push(
        `<p class="ed-empty">Le LUMINAIRE est l'objet visible à la position de la lampe — il n'éclaire rien de plus, l'éclairage vient des réglages du dessus. Taille 0 : la lampe éclaire sans qu'on la voie.</p>`,
      )
      rows.push(
        `<p class="ed-empty">La HAUTEUR sculpte l'ombre : haute (≥ ${LAMPE_HAUTEUR_DEFAUT}), la lampe enjambe les blocs — ombres courtes et douces ; basse (~${LAMPE_HAUTEUR_MIN}-200), elle rase le sol — ombres longues et dramatiques. Portée 0 : proportionnelle à la cuve. Au plus ${MAX_LUMIERES} lampes par tableau ; sans lampe posée, la cuve garde sa lampe par défaut. Aperçu réel : ESSAYER.</p>`,
      )
    } else if (s.kind === 'cible') {
      const t = (this.level.cibles ?? [])[s.index]
      const canal = canalDeCible(this.level.cibles ?? [], s.index)
      rows.push(numField('N° (canal)', 'p-ccanal', canal, 1))
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
          ? `<p class="ed-empty">Cible nº ${canal} — la porte n’est ouverte que FAISCEAU TENU ; à la première coupure, la pastille grille et la porte se scelle pour de bon.</p>`
          : `<p class="ed-empty">Cible nº ${canal} — un seul passage du faisceau l’allume pour de bon ; les portes s’y asservissent par ce numéro.</p>`,
      )
      rows.push(
        `<p class="ed-empty">Le N° se choisit librement : plusieurs pastilles peuvent porter le même — la porte décide alors si UNE suffit (OU) ou s’il les faut TOUTES (ET).</p>`,
      )
    } else if (s.kind === 'condensat') {
      const c = (this.level.condensats ?? [])[s.index]
      rows.push(numField('X', 'p-cdx', c.x), numField('Y', 'p-cdy', c.y))
      rows.push(numField('Valeur (cL)', 'p-cdcl', c.cl, 1))
      rows.push(
        `<p class="ed-empty">Une PASTILLE DE CONDENSAT : bue au contact du corps, elle nourrit la bourse de la run (purgée à la fin). Dès qu’un tableau porte SES pastilles posées main, le semis automatique se coupe.</p>`,
      )
    } else if (s.kind === 'fiole') {
      const f = this.level.fiole!
      rows.push(numField('X', 'p-fx', f.x), numField('Y', 'p-fy', f.y))
      rows.push(
        `<p class="ed-empty">L’emplacement de la FIOLE du tableau (un seul). En jeu, elle n’apparaît que si la collection du joueur est incomplète — la fiole offerte est tirée parmi les manquantes. Sans emplacement posé, le semis automatique décide (la cachette la plus profonde, une chance sur deux).</p>`,
      )
    } else if (s.kind === 'plot') {
      const p = (this.level.plots ?? [])[s.index]
      const catalogue =
        p.monnaie === 'memoire' ? ARTICLES_COMPTOIR : ETAL_ECONOMAT
      rows.push(
        `<label class="ed-f"><span>Article</span><select id="p-plart">` +
          catalogue
            .map(
              (a) =>
                `<option value="${a.id}"${a.id === p.article ? ' selected' : ''}>${a.icone} ${a.nom} — ${a.prix} ${p.monnaie === 'memoire' ? 'mém.' : 'cL'}</option>`,
            )
            .join('') +
          `</select></label>`,
      )
      rows.push(numField('Prix (0 = barème)', 'p-plprix', p.prix ?? 0, 0))
      rows.push(
        p.monnaie === 'memoire'
          ? `<p class="ed-empty">Plot payé en MÉMOIRE (la monnaie générale) : l’achat au contact PROVISIONNE LA PROCHAINE DESCENTE, comme au comptoir du hub — où que le plot soit posé. Un prix à 0 suit le barème du catalogue.</p>`
          : `<p class="ed-empty">Plot payé en CONDENSAT (la bourse de la run) : l’achat au contact agit IMMÉDIATEMENT, comme à l’étal de l’Économat. Un prix à 0 suit le barème du catalogue. Deux plots du même article ne servent qu’une fois par salle.</p>`,
      )
    } else if (s.kind === 'structure') {
      const st = (this.level.structures ?? [])[s.index]
      rows.push(
        `<label class="ed-f"><span>Sorte</span><select id="p-stype">` +
          `<option value="0"${st.type === STRUCT_CHAMBRE ? ' selected' : ''}>Chambre (coque fermée)</option>` +
          `<option value="1"${st.type === STRUCT_COULOIR ? ' selected' : ''}>Couloir (tube ouvert)</option>` +
          `</select></label>`,
      )
      rows.push(
        numField('X min', 'p-minX', st.minX),
        numField('Y min', 'p-minY', st.minY),
        numField('X max', 'p-maxX', st.maxX),
        numField('Y max', 'p-maxY', st.maxY),
      )
      rows.push(
        rangeField('Épaisseur de coque', 'p-stEp', epaisseurDe(st), EP_MIN, EP_MAX, 2),
      )
      if (st.type === STRUCT_CHAMBRE) {
        rows.push(
          rangeField(
            'Chanfrein (%)',
            'p-stCh',
            Math.round((st.chanfrein ?? 0.25) * 100),
            0,
            Math.round(CHANFREIN_MAX * 100),
            1,
          ),
        )
        rows.push(
          `<button type="button" class="ed-btn" id="p-stRect">Rectangle</button>` +
            `<button type="button" class="ed-btn" id="p-stOcto">Octogone</button>` +
            `<button type="button" class="ed-btn" id="p-stHexa">Chanfrein maxi</button>`,
        )
      } else {
        rows.push(
          `<label class="ed-f"><span>Axe</span><select id="p-stAxe">` +
            `<option value="0"${(st.axe ?? 0) === 0 ? ' selected' : ''}>Horizontal</option>` +
            `<option value="1"${st.axe === 1 ? ' selected' : ''}>Vertical</option>` +
            `</select></label>`,
        )
        rows.push(
          `<div class="ed-f"><span>Raccord</span><span><label class="ed-chk"><input type="checkbox" id="p-stRac"${st.raccord === false ? '' : ' checked'} /> S’arrêter au mur voisin</label></span></div>`,
        )
        rows.push(
          `<label class="ed-f"><span>Porte de matière</span><select id="p-stBou">` +
            `<option value="-1"${st.bouchon === undefined ? ' selected' : ''}>Aucune — libre</option>` +
            MATIERES_PORTE.map(
              (m) =>
                `<option value="${m}"${st.bouchon === m ? ' selected' : ''}>${MATERIAL_NAMES[m] ?? m}</option>`,
            ).join('') +
            `</select></label>`,
        )
      }
      rows.push(rangeField('Angle (°)', 'p-stAng', st.angle ?? 0, -180, 180, 1))
      // LES CÔTÉS OUVERTS : devinés par défaut (un voisin qui vient au
      // milieu d'une face y ouvre la porte), forçables à la main
      const auto = st.ouvertures === undefined
      const vus = cotesOuverts(st, this.level.structures ?? []).cotes
      rows.push(
        `<label class="ed-f"><span>Ouvertures</span><select id="p-stAuto">` +
          `<option value="1"${auto ? ' selected' : ''}>Devinées (les voisins)</option>` +
          `<option value="0"${auto ? '' : ' selected'}>Choisies à la main</option>` +
          `</select></label>`,
      )
      rows.push(
        `<div class="ed-f"><span>Côtés</span><span>` +
          COQUE_COTES.map(
            (bit, i) =>
              `<label class="ed-chk"><input type="checkbox" id="p-stC${i}"${vus & bit ? ' checked' : ''}${auto ? ' disabled' : ''} /> ${COQUE_COTE_NOMS[i]}</label>`,
          ).join(' ') +
          `</span></div>`,
      )
      const cout = coutStructures([st])
      rows.push(
        `<p class="ed-empty">Une COQUE VIDE, d’un seul tenant : le terrain de jeu. Le mobilier se pose dedans, à travers elle. LA RÈGLE DU KIT : deux modules se rejoignent CENTRE DE FACE contre CENTRE DE FACE — amenez un couloir au milieu d’une face, faites-le MORDRE dans la coque d’en face, et la porte s’ouvre toute seule. Le couloir s’arrête alors de lui-même à la face intérieure du module : la jonction se lit comme une seule pièce, sans marche ni double paroi (décochez « Raccord » pour garder l’emprise tracée). Une coque assez épaisse pour se refermer devient un octogone PLEIN (un pilier, une masse). Cette structure coûte <b>${cout} bloc${cout > 1 ? 's' : ''}</b>.</p>`,
      )
    } else if (s.kind === 'ancre') {
      const a = (this.level.ancres ?? [])[s.index]
      rows.push(
        `<label class="ed-f"><span>Rôle</span><select id="p-anrole">` +
          ROLES_ANCRE.map(
            (r) =>
              `<option value="${r}"${r === a.role ? ' selected' : ''}>${ANCRE_NOMS[r]}</option>`,
          ).join('') +
          `</select></label>`,
      )
      if (a.role === 'station' || a.role === 'degat') {
        rows.push(
          `<label class="ed-f"><span>Station</span><select id="p-anid">` +
            REPARATIONS.map(
              (r) =>
                `<option value="${r.id}"${r.id === a.id ? ' selected' : ''}>${r.icone} ${r.nom} — ${r.prix} mém.</option>`,
            ).join('') +
            `</select></label>`,
        )
      }
      rows.push(`<p class="ed-empty">${ANCRE_NOTES[a.role]}</p>`)
    } else if (s.kind === 'banc') {
      rows.push(
        `<p class="ed-empty">LE BANC DES MÉMOIRES (un seul par tableau) : en jeu, le corps qui glisse dans ce rectangle ouvre l’écran du cycle des états — on y tisse les transformations contre de la mémoire. Les poignées le redimensionnent.</p>`,
      )
    } else if (s.kind === 'marchand') {
      const m = this.level.marchand!
      rows.push(numField('X', 'p-mx', m.x), numField('Y', 'p-my', m.y))
      rows.push(
        `<p class="ed-empty">LE MARCHAND (un seul par tableau) : une présence — l’anneau rose pulse à cet endroit. Le commerce, lui, passe par les plots d’article.</p>`,
      )
    } else if (s.kind === 'eclat') {
      const e = (this.level.eclats ?? [])[s.index]
      rows.push(numField('X', 'p-ex', e.x), numField('Y', 'p-ey', e.y))
      rows.push(numField('Mémoire gravée (+N)', 'p-emem', e.memoire, 1))
      rows.push(
        `<p class="ed-empty">Un ÉCLAT DE MÉMOIRE : l’information cristallisée. Le contact grave +N mémoire aux registres, UNE FOIS PAR RUN — Recommencer la salle ne le fait pas repousser, la run suivante si. Aux essais d’éditeur, il se prend mais rien ne se grave.</p>`,
      )
    } else if (s.kind === 'porte') {
      const q = (this.level.portes ?? [])[s.index]
      // LE CANAL COMPTE PAR UN. Sans le pas explicite, le champ retombait
      // sur le défaut de numField — 10, celui des COORDONNÉES, qui se
      // règlent bien par dizaines d'unités monde. Un « input type=number »
      // à pas 10 ne se contente pas de sauter de dix : il n'accepte QUE la
      // grille du pas. Relevé dans le navigateur, en partant de 1 : la
      // flèche du haut donne 11, puis 21, puis 31 — et saisir 3 à la main
      // est refusé. D'où des numéros de canal qui semblaient tirés au sort.
      // Le canal de la CIBLE (« p-ccanal ») passait bien 1 ; celui de la
      // PORTE l'avait perdu. Pas de « min » : le canal −1 est la porte
      // SCÉNARISÉE, qu'aucun faisceau n'ouvre — et le pas 1 l'accepte.
      rows.push(numField('Canal visé (nº de cible)', 'p-pc', q.canal, 1))
      rows.push(
        `<label class="ed-f"><span>Règle</span><select id="p-pregle">` +
          `<option value="ou"${q.regle !== 'et' ? ' selected' : ''}>OU — une cible du canal suffit</option>` +
          `<option value="et"${q.regle === 'et' ? ' selected' : ''}>ET — toutes les cibles du canal</option>` +
          `</select></label>`,
      )
      rows.push(
        numField('X min', 'p-minX', q.minX),
        numField('X max', 'p-maxX', q.maxX),
      )
      rows.push(
        numField('Y min', 'p-minY', q.minY),
        numField('Y max', 'p-maxY', q.maxY),
      )
      rows.push(
        `<p class="ed-empty">La porte s’ouvre par le canal : le N° affiché sur les pastilles. La règle ne joue que si plusieurs pastilles portent ce numéro. Canal −1 : porte SCÉNARISÉE, qu’aucun faisceau n’ouvre.</p>`,
      )
    } else if (s.kind === 'rail') {
      const r = (this.level.rails ?? [])[s.index]
      rows.push(
        `<p class="ed-empty">Ligne de champ en ${r.points.length} points. Un faisceau IONISÉ (passé dans la vapeur) qui frôle la ligne — n’importe où — s’y accroche et la suit DANS LE SENS DES CHEVRONS. Glissez pour déplacer le rail entier ; outil « Rail » sur une extrémité pour le prolonger.</p>`,
      )
      rows.push(
        `<button type="button" class="ed-btn" id="p-railrev">Inverser le sens</button>`,
      )
      // LE CONDUIT : le même tracé, mais en RACCOURCI au lieu d'énigme.
      rows.push(
        `<label class="ed-row"><input type="checkbox" id="p-railconduit"${
          r.conduit ? ' checked' : ''
        } /> <span>CONDUIT — raccourci traversable</span></label>`,
      )
      rows.push(
        `<p class="ed-empty">Coché, le rail prend un corps : PAROI en eau et en glace (on bute dessus), PASSAGE au PLASMA — il faut qu’un arc ionisé circule dessus, donc s’être vaporisé DANS le faisceau. Le nuage file alors à travers les cloisons jusqu’à l’autre bout. Un conduit RÉCLAME donc un émetteur laser dont le faisceau passe près du tube — sans lui, c’est une paroi que rien n’ouvrira. Décoché, c’est le rail de guidage d’arc habituel.</p>`,
      )
    } else if (s.kind === 'label') {
      const l = this.level.labels[s.index]
      // zone de texte (et non ligne unique) : ENTRÉE fait un vrai saut de
      // ligne, et « | » ouvre toujours la plaque (sur-titre puis titre)
      rows.push(
        `<label class="ed-f ed-f-txt"><span>Texte</span><textarea id="p-text" rows="3" spellcheck="false">${l.text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')}</textarea></label>`,
        `<p class="ed-empty">ENTRÉE saute une ligne. « SUR-TITRE|TITRE » dessine une plaque de signalétique.</p>`,
      )
      rows.push(
        `<label class="ed-f"><span>Couleur</span><select id="p-tone">` +
          (
            [
              'mur',
              'phile',
              'phobe',
              'eponge',
              'froid',
              'grille',
              'sas',
              'chaud',
            ] as WorldLabel['tone'][]
          )
            .map(
              (t) =>
                `<option value="${t}"${t === l.tone ? ' selected' : ''}>${t}</option>`,
            )
            .join('') +
          `</select></label>`,
      )
      rows.push(numField('X', 'p-lx', l.x), numField('Y', 'p-ly', l.y))
    } else if (s.kind === 'decal') {
      const d = (this.level.decals ?? [])[s.index]
      rows.push(
        `<label class="ed-f"><span>Sorte</span><select id="p-dk">` +
          DECAL_SORTES.map(
            (k) =>
              `<option value="${k}"${k === d.kind ? ' selected' : ''}>${DECAL_NOMS[k]}</option>`,
          ).join('') +
          `</select></label>`,
      )
      rows.push(
        numField('X (centre)', 'p-dx', d.x),
        numField('Y (centre)', 'p-dy', d.y),
      )
      rows.push(
        numField('Largeur', 'p-dw', d.w),
        numField('Hauteur', 'p-dh', d.h),
      )
      rows.push(
        `<label class="ed-f"><span>Miroir</span><select id="p-df">` +
          `<option value="non"${!d.flip ? ' selected' : ''}>Non</option>` +
          `<option value="oui"${d.flip ? ' selected' : ''}>Oui — retourné horizontalement</option>` +
          `</select></label>`,
      )
      rows.push(rangeField('Opacité', 'p-do', d.fade ?? 0.55, 0.05, 1, 0.05))
      rows.push(
        `<p class="ed-empty">Machinerie de décor : aucune physique, aucune règle — glissez-la, les poignées la redimensionnent.</p>`,
      )
    }

    const kindName =
      s.kind === 'box'
        ? MATERIAL_NAMES[this.level.boxes[s.index].material] +
          ((this.level.boxes[s.index].forme ?? 0) > 0
            ? ` — ${FORME_NAMES[this.level.boxes[s.index].forme!]}`
            : '')
        : s.kind === 'zone'
          ? 'Zone d’état'
          : s.kind === 'cache'
            ? 'Cachette (pan voilé)'
            : s.kind === 'sponge'
              ? 'Éponge'
              : s.kind === 'exit'
                ? 'Sas'
                : s.kind === 'spawn'
                  ? 'Point de départ'
                  : s.kind === 'laser'
                    ? 'Émetteur laser'
                    : s.kind === 'lumiere'
                      ? `Lampe nº ${s.index + 1}`
                      : s.kind === 'cible'
                        ? `Cible nº ${canalDeCible(this.level.cibles ?? [], s.index)}`
                        : s.kind === 'condensat'
                          ? 'Pastille de condensat'
                          : s.kind === 'fiole'
                            ? 'Emplacement de fiole'
                            : s.kind === 'porte'
                              ? 'Porte asservie'
                              : s.kind === 'rail'
                                ? 'Rail magnétique'
                                : s.kind === 'decal'
                                  ? 'Décal (machinerie de décor)'
                                  : s.kind === 'plot'
                                    ? `Plot d’article (${(this.level.plots ?? [])[s.index]?.monnaie === 'memoire' ? 'mémoire' : 'condensat'})`
                                    : s.kind === 'structure'
                                      ? `Structure — ${(this.level.structures ?? [])[s.index]?.type === STRUCT_COULOIR ? 'couloir' : 'chambre'}`
                                      : s.kind === 'ancre'
                                      ? `Ancre — ${ANCRE_NOMS[(this.level.ancres ?? [])[s.index]?.role ?? 'station']}`
                                      : s.kind === 'banc'
                                        ? 'Banc des mémoires'
                                      : s.kind === 'marchand'
                                        ? 'Marchand'
                                        : s.kind === 'eclat'
                                          ? 'Éclat de mémoire'
                                          : 'Étiquette'

    // L'ORDRE DE PEINTURE — seulement là où il veut dire quelque chose : les
    // coques entre elles, le mobilier entre lui. Le reste (sas, départ,
    // lampes…) ne se recouvre pas, un bouton d'ordre n'y dirait rien.
    const ordreInfo =
      s.kind === 'box'
        ? { n: this.level.boxes.length, rang: s.index, meuble: true }
        : s.kind === 'structure'
          ? { n: (this.level.structures ?? []).length, rang: s.index, meuble: false }
          : null
    const blocOrdre =
      ordreInfo && ordreInfo.n > 1
        ? `<div class="ed-props-head">Ordre de peinture — rang ${ordreInfo.rang + 1} / ${ordreInfo.n}</div>` +
          `<p class="ed-astuce">Le DERNIER se peint dessus. Depuis que les silhouettes fusionnent, c’est la seule chose qui décide, en cas de chevauchement, quelle matière se voit${ordreInfo.meuble ? ' — et le mobilier passe toujours après les coques' : ''}.</p>` +
          `<div class="ed-fields">` +
          `<button type="button" class="ed-btn" id="p-ord-fond" title="Tout au fond : tout le reste se peindra par-dessus">⤓ Tout au fond</button>` +
          `<button type="button" class="ed-btn" id="p-ord-derriere" title="Reculer d’un rang : le voisin passe devant">◂ Derrière</button>` +
          `<button type="button" class="ed-btn" id="p-ord-devant" title="Avancer d’un rang : il passe devant son voisin">Devant ▸</button>` +
          `<button type="button" class="ed-btn" id="p-ord-dessus" title="Tout devant : il couvrira tout le reste">⤒ Tout devant</button>` +
          `</div>`
        : ''

    host.innerHTML =
      `<div class="ed-props-head">${kindName}</div><div class="ed-fields">${rows.join('')}</div>` +
      blocOrdre +
      (s.kind === 'exit' || s.kind === 'spawn'
        ? ''
        : `<button type="button" class="ed-danger" id="p-del">Supprimer</button>`)

    for (const [id, part] of [
      ['p-stRect', 0],
      ['p-stOcto', 0.25],
      ['p-stHexa', CHANFREIN_MAX],
    ] as const) {
      host.querySelector(`#${id}`)?.addEventListener('click', () => {
        const sel = this.sel
        if (sel?.kind !== 'structure') return
        const st = (this.level.structures ?? [])[sel.index]
        if (!st) return
        st.chanfrein = part
        this.commit(
          part === 0
            ? 'Chambre rectangulaire.'
            : part === 0.25
              ? 'Chambre octogonale.'
              : 'Chambre à chanfrein maximal — les pans droits se réduisent à l’épaisseur.',
        )
      })
    }
    host
      .querySelector('#p-del')
      ?.addEventListener('click', () => this.deleteSel())
    for (const [id, sens] of [
      ['p-ord-fond', 'fond'],
      ['p-ord-derriere', 'derriere'],
      ['p-ord-devant', 'devant'],
      ['p-ord-dessus', 'dessus'],
    ] as const) {
      host
        .querySelector('#' + id)
        ?.addEventListener('click', () => this.deplaceOrdre(sens))
    }
    host.querySelector('#p-railrev')?.addEventListener('click', () => {
      if (this.sel?.kind === 'rail') {
        ;(this.level.rails ?? [])[this.sel.index]?.points.reverse()
        this.commit(
          'Sens du rail inversé — les chevrons montrent la circulation de l’arc.',
        )
      }
    })
    for (const input of Array.from(
      host.querySelectorAll('input, select, textarea'),
    )) {
      input.addEventListener('change', () => this.readProps())
    }
    // Curseurs : la glissière applique EN DIRECT (le tableau suit le doigt),
    // le relâcher passe par le change générique — un seul cran d'historique.
    // Le nombre jumeau se synchronise dans les deux sens.
    for (const r of Array.from(
      host.querySelectorAll<HTMLInputElement>('input[type="range"]'),
    )) {
      const num = host.querySelector<HTMLInputElement>(
        '#' + r.id.replace(/-r$/, ''),
      )
      r.addEventListener('input', () => {
        if (num) num.value = r.value
        this.appliqueProps()
        this.draw()
      })
      num?.addEventListener('input', () => {
        r.value = num.value
      })
    }
  }

  /** Relit le panneau, applique, et committe un cran d'historique. */
  private readProps(): void {
    this.appliqueProps()
    this.commit('')
  }

  /** Relit le panneau et applique les valeurs saisies (sans commit). */
  private appliqueProps(): void {
    const s = this.sel
    if (!s) return
    const val = (id: string): number => {
      const e = this.host.querySelector('#' + id) as HTMLInputElement | null
      return e ? Number(e.value) || 0 : 0
    }
    const text = (id: string): string => {
      const e = this.host.querySelector('#' + id) as
        | HTMLInputElement
        | HTMLSelectElement
        | null
      return e ? e.value : ''
    }

    if (s.kind === 'rail') {
      const r = (this.level.rails ?? [])[s.index]
      if (r) {
        const c = this.host.querySelector('#p-railconduit') as HTMLInputElement | null
        // le drapeau ne s'ÉCRIT que s'il est vrai : un rail ordinaire garde
        // exactement la forme qu'il avait, et les tableaux d'avant ne
        // gagnent pas un champ dont ils n'ont que faire
        if (c?.checked) r.conduit = true
        else delete r.conduit
      }
      return
    }

    if (s.kind === 'box') {
      const b = this.level.boxes[s.index]
      b.material = Number(text('p-mat'))
      Object.assign(
        b,
        this.normalized(
          val('p-minX'),
          val('p-minY'),
          val('p-maxX'),
          val('p-maxY'),
        ),
      )
      // l'oblique : un angle en degrés autour du centre — 0 efface la clé
      const ang = Math.max(-180, Math.min(180, val('p-ang')))
      if (ang) b.angle = ang
      else delete b.angle
      // la forme : rectangle (0) efface la clé, comme angle/aura/skin ; les
      // paramètres ne survivent que pour la forme qu'ils décrivent
      const forme = Math.max(0, Math.min(FORME_ARC, Math.round(val('p-forme'))))
      const ancienne = b.forme ?? 0
      if (forme) b.forme = forme
      else delete b.forme
      delete b.p0
      delete b.p1
      delete b.p2
      if (forme === FORME_COIN) {
        const q0 =
          ((Math.round(forme === ancienne ? val('p-fq0') : 0) % 4) + 4) % 4
        if (q0) b.p0 = q0
      } else if (forme === FORME_ARC && forme === ancienne) {
        const ep = Math.max(
          0.08,
          Math.min(1, (val('p-fep') || ARC_EPAISSEUR_DEFAUT * 100) / 100),
        )
        const ouv = Math.max(
          15,
          Math.min(180, val('p-fouv') || ARC_OUVERTURE_DEFAUT),
        )
        if (ep !== ARC_EPAISSEUR_DEFAUT) b.p0 = ep
        if (ouv !== ARC_OUVERTURE_DEFAUT) b.p1 = ouv
        const bout = Math.max(0, Math.min(2, Math.round(val('p-fbout'))))
        if (bout) b.p2 = bout
      }
      // portée d'aura propre (chaudière) : 1 (ou vide) efface la clé
      if (b.material === MAT_CHAUD) {
        const aura = Math.max(0.25, Math.min(4, val('p-aura') || 1))
        if (aura !== 1) b.aura = aura
        else delete b.aura
      } else {
        delete b.aura
      }
      // habillage d'une paroi neutre : 0 (standard) efface la clé — et les
      // motifs étant calés sur la boîte, une forme n'en porte pas
      if (b.material === MAT_WALL && !(b.forme ?? 0)) {
        const skin = Math.max(0, Math.min(9, Math.round(val('p-skin'))))
        if (skin > 0) b.skin = skin
        else delete b.skin
      } else {
        delete b.skin
      }
    } else if (s.kind === 'zone') {
      const z = (this.level.zones ?? [])[s.index]
      z.force = text('p-force') as ZoneForce
      z.label = text('p-zlabel').trim() || undefined
      const zcine = text('p-zcine').trim().slice(0, 24)
      if (zcine) z.cine = zcine
      else delete z.cine
      const zseq = text('p-zseq').trim().slice(0, 24)
      if (zseq) z.sequence = zseq
      else delete z.sequence
      Object.assign(
        z,
        this.normalized(
          val('p-minX'),
          val('p-minY'),
          val('p-maxX'),
          val('p-maxY'),
        ),
      )
    } else if (s.kind === 'cache') {
      const c = (this.level.caches ?? [])[s.index]
      Object.assign(
        c,
        this.normalized(
          val('p-minX'),
          val('p-minY'),
          val('p-maxX'),
          val('p-maxY'),
        ),
      )
      if (text('p-kstyle') === 'paroi') c.style = 'paroi'
      else delete c.style
      const kforme = Math.max(
        0,
        Math.min(FORME_ARC, Math.round(val('p-kforme'))),
      )
      if (kforme > 0) c.forme = kforme
      else delete c.forme
      const kang = Math.max(-180, Math.min(180, val('p-kang')))
      if (kang) c.angle = kang
      else delete c.angle
      if (kforme === FORME_COIN) {
        const q0 = ((Math.round(val('p-kq0')) % 4) + 4) % 4
        if (q0) c.p0 = q0
        else delete c.p0
        delete c.p1
        delete c.p2
      } else if (kforme === FORME_ARC) {
        const ep = Math.max(0.08, Math.min(1, val('p-kep') / 100))
        if (ep !== ARC_EPAISSEUR_DEFAUT) c.p0 = ep
        else delete c.p0
        const ouv = Math.max(15, Math.min(180, val('p-kouv')))
        if (ouv !== ARC_OUVERTURE_DEFAUT) c.p1 = ouv
        else delete c.p1
        const bout = Math.max(0, Math.min(2, Math.round(val('p-kbout'))))
        if (bout) c.p2 = bout
        else delete c.p2
      } else {
        delete c.p0
        delete c.p1
        delete c.p2
      }
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
        this.normalized(
          val('p-minX'),
          val('p-minY'),
          val('p-maxX'),
          val('p-maxY'),
        ),
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
    } else if (s.kind === 'lumiere') {
      const l = (this.level.lumieres ?? [])[s.index]
      l.x = val('p-lmx')
      l.y = val('p-lmy')
      // les défauts effacent la clé : le fichier reste minimal
      const h = Math.max(
        LAMPE_HAUTEUR_MIN,
        Math.min(LAMPE_HAUTEUR_MAX, val('p-lmh') || LAMPE_HAUTEUR_DEFAUT),
      )
      if (h !== LAMPE_HAUTEUR_DEFAUT) l.h = h
      else delete l.h
      const portee = val('p-lmp')
      if (portee > 0) l.portee = Math.max(200, Math.min(8000, portee))
      else delete l.portee
      const brutInt =
        (this.host.querySelector('#p-lmi') as HTMLInputElement | null)?.value ??
        '1'
      const intensite = Math.max(0, Math.min(2, Number(brutInt) || 0))
      if (intensite !== 1) l.intensite = intensite
      else delete l.intensite
      const couleur = text('p-lmc').toLowerCase()
      if (/^#[0-9a-f]{6}$/.test(couleur) && couleur !== LAMPE_COULEUR_DEFAUT)
        l.couleur = couleur
      else delete l.couleur
      // le luminaire : mêmes règles d'effacement au défaut
      const taille = Math.max(0, Math.min(3, val('p-lmt')))
      if (taille !== 1) l.taille = taille
      else delete l.taille
      if (text('p-lmf') === 'bandeau') {
        l.forme = 'bandeau'
        const longueur = Math.max(80, Math.min(1600, val('p-lml') || 260))
        if (longueur !== 260) l.longueur = longueur
        else delete l.longueur
        const angle = ((Math.round(val('p-lmg')) % 360) + 360) % 360
        if (angle !== 0) l.angle = angle
        else delete l.angle
      } else {
        delete l.forme
        delete l.longueur
        delete l.angle
      }
    } else if (s.kind === 'cible') {
      const t = (this.level.cibles ?? [])[s.index]
      // le n° est LOGIQUE : il se pose sur la pastille et les portes le
      // visent — deux pastilles peuvent porter le même (un canal)
      t.canal = Math.max(1, Math.round(val('p-ccanal') || s.index + 1))
      t.x = val('p-cx')
      t.y = val('p-cy')
      t.r = Math.max(8, val('p-cr'))
      // TOR reste implicite (clé absente) : les fichiers existants ne changent pas
      if (text('p-cmode') === 'nor') t.mode = 'nor'
      else delete t.mode
    } else if (s.kind === 'condensat') {
      const c = (this.level.condensats ?? [])[s.index]
      c.x = val('p-cdx')
      c.y = val('p-cdy')
      c.cl = Math.max(1, Math.min(200, Math.round(val('p-cdcl') || 8)))
    } else if (s.kind === 'fiole') {
      const f = this.level.fiole
      if (f) {
        f.x = val('p-fx')
        f.y = val('p-fy')
      }
    } else if (s.kind === 'plot') {
      const p = (this.level.plots ?? [])[s.index]
      const id = text('p-plart')
      const catalogue =
        p.monnaie === 'memoire' ? ARTICLES_COMPTOIR : ETAL_ECONOMAT
      if (catalogue.some((a) => a.id === id))
        p.article = id as PlotMeta['article']
      const prix = Math.round(val('p-plprix'))
      if (prix >= 1) p.prix = Math.min(999, prix)
      else delete p.prix
    } else if (s.kind === 'structure') {
      const st = (this.level.structures ?? [])[s.index]
      if (st) {
        const type = Number(text('p-stype'))
        st.type = type === STRUCT_COULOIR ? STRUCT_COULOIR : STRUCT_CHAMBRE
        const norm = this.normalized(
          val('p-minX'),
          val('p-minY'),
          val('p-maxX'),
          val('p-maxY'),
        )
        if (structureViable({ ...st, ...norm })) Object.assign(st, norm)
        const ep = Math.round(val('p-stEp'))
        if (ep >= EP_MIN && structureViable({ ...st, ep })) st.ep = ep
        const ang = Math.round(val('p-stAng'))
        if (ang) st.angle = Math.max(-180, Math.min(180, ang))
        else delete st.angle
        if (text('p-stAuto') === '1') delete st.ouvertures
        else {
          let m = 0
          COQUE_COTES.forEach((bit, i) => {
            const el = document.getElementById(`p-stC${i}`) as HTMLInputElement | null
            if (el?.checked) m |= bit
          })
          st.ouvertures = m
        }
        if (st.type === STRUCT_CHAMBRE) {
          const ch = val('p-stCh') / 100
          st.chanfrein = Math.max(0, Math.min(CHANFREIN_MAX, ch))
          delete st.axe
          delete st.bouchon
        } else {
          st.axe = Number(text('p-stAxe')) === 1 ? 1 : 0
          const rac = document.getElementById('p-stRac') as HTMLInputElement | null
          if (rac && !rac.checked) st.raccord = false
          else delete st.raccord
          const bou = Number(text('p-stBou'))
          if (MATIERES_PORTE.includes(bou)) st.bouchon = bou
          else delete st.bouchon
          delete st.chanfrein
        }
      }
    } else if (s.kind === 'ancre') {
      const a = (this.level.ancres ?? [])[s.index]
      const role = text('p-anrole') as RoleAncre
      if (ROLES_ANCRE.includes(role)) a.role = role
      if (a.role === 'station' || a.role === 'degat') {
        const id = text('p-anid')
        // le rôle vient peut-être de changer : sans liste au panneau, la
        // station reste celle d'avant, ou la première du catalogue
        if (REPARATIONS.some((r) => r.id === id)) a.id = id
        else if (!a.id) a.id = REPARATIONS[0].id
      } else delete a.id
    } else if (s.kind === 'marchand') {
      const m = this.level.marchand
      if (m) {
        m.x = val('p-mx')
        m.y = val('p-my')
      }
    } else if (s.kind === 'eclat') {
      const e = (this.level.eclats ?? [])[s.index]
      if (e) {
        e.x = val('p-ex')
        e.y = val('p-ey')
        e.memoire = Math.max(1, Math.min(99, Math.round(val('p-emem') || 2)))
      }
    } else if (s.kind === 'porte') {
      const q = (this.level.portes ?? [])[s.index]
      const canal = Math.round(val('p-pc'))
      q.canal = canal >= 1 ? canal : -1
      if (text('p-pregle') === 'et') q.regle = 'et'
      else delete q.regle
      Object.assign(
        q,
        this.normalized(
          val('p-minX'),
          val('p-minY'),
          val('p-maxX'),
          val('p-maxY'),
        ),
      )
    } else if (s.kind === 'label') {
      const l = this.level.labels[s.index]
      // les sauts de ligne SURVIVENT (ils sont le geste demandé) ; le reste
      // est normalisé, et la limite s'élargit puisqu'un texte tient sur
      // plusieurs lignes désormais
      l.text =
        text('p-text')
          .toUpperCase()
          .replace(/\r\n?/g, '\n')
          .replace(/[ \t]+/g, ' ')
          .replace(/\n{3,}/g, '\n\n')
          .slice(0, 120)
          .trim() || l.text
      l.tone = text('p-tone') as WorldLabel['tone']
      l.x = val('p-lx')
      l.y = val('p-ly')
    } else if (s.kind === 'decal') {
      const d = (this.level.decals ?? [])[s.index]
      const k = DECAL_SORTES.find((x) => x === text('p-dk'))
      if (k) d.kind = k
      d.x = val('p-dx')
      d.y = val('p-dy')
      d.w = Math.max(8, val('p-dw'))
      d.h = Math.max(8, val('p-dh'))
      if (text('p-df') === 'oui') d.flip = true
      else delete d.flip
      // 0,55 est le défaut : on efface la clé pour garder le fichier minimal
      const fade = Math.max(0.05, Math.min(1, val('p-do')))
      if (fade !== 0.55) d.fade = fade
      else delete d.fade
    }
  }

  private normalized(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ): Rect {
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
    this.majJauge()
    if (v.length === 0) {
      host.innerHTML =
        '<div class="ed-ok">Tableau valide — prêt à essayer.</div>'
      return
    }
    host.innerHTML = v
      .map(
        (x) =>
          `<div class="ed-v ${x.niveau === 'erreur' ? 'err' : 'warn'}">${x.niveau === 'erreur' ? '✕' : '!'} ${x.message}</div>`,
      )
      .join('')
  }

  /** LA JAUGE DU BUDGET : le moteur ne dessine que MAX_BOXES−1 blocs par
   * tableau, structures expansées comprises. Le concepteur doit le voir
   * AVANT de dépasser, pas au moment du refus. */
  private majJauge(): void {
    const host = document.getElementById('ed-budget')
    if (!host) return
    const poses = this.level.boxes.length
    const coques = coutStructures(this.level.structures)
    const total = poses + coques
    const max = MAX_BOXES - 1
    host.className =
      total > max ? 'ed-v err' : total > max * 0.88 ? 'ed-v warn' : 'ed-jauge'
    host.textContent = coques
      ? `${total} / ${max} blocs — ${poses} posés, ${coques} de structure`
      : `${total} / ${max} blocs`
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
      const ta =
        z.force === 'eau'
          ? 1.5
          : z.force === 'glace'
            ? 0.667
            : z.force === 'vapeur'
              ? 1.0
              : 0
      if (ta > 0) {
        const name =
          z.force === 'eau'
            ? 'zone-buses'
            : z.force === 'glace'
              ? 'zone-hublot'
              : 'zone-conduite'
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
      g.font = LevelEditor.POLICE_LABEL
      g.fillText(
        `${zoneName(z)} · ${z.force.toUpperCase()}`,
        p.sx + 6,
        p.sy + 15,
      )
    }

    // cachettes : hachures sombres + étiquette — bien visibles À L'ÉDITEUR
    // (le concepteur doit les voir), voilées seulement en jeu. Le chemin
    // épouse la FORME (disque, capsule, coin, arc, rotation…).
    for (let ci = 0; ci < (this.level.caches ?? []).length; ci++) {
      const c = this.level.caches![ci]
      const p = this.toScreen(c.minX, c.maxY)
      const q = this.toScreen(c.maxX, c.minY)
      const w = q.sx - p.sx
      const h = q.sy - p.sy
      const chemin = (): void => {
        const pts = formeOutline(c, 56)
        g.beginPath()
        for (let k = 0; k < pts.length; k++) {
          const sp = this.toScreen(pts[k].x, pts[k].y)
          if (k === 0) g.moveTo(sp.sx, sp.sy)
          else g.lineTo(sp.sx, sp.sy)
        }
        g.closePath()
      }
      g.save()
      chemin()
      g.clip()
      g.fillStyle =
        c.style === 'paroi' ? 'rgba(58,68,80,0.50)' : 'rgba(20,28,40,0.45)'
      g.fillRect(p.sx, p.sy, w, h)
      g.strokeStyle = 'rgba(120,140,170,0.30)'
      g.lineWidth = 1
      g.beginPath()
      const pas = 14
      for (let x = -h; x < w; x += pas) {
        g.moveTo(p.sx + x, p.sy + h)
        g.lineTo(p.sx + x + h, p.sy)
      }
      g.stroke()
      g.restore()
      g.strokeStyle = '#8ea2bd'
      g.setLineDash([6, 5])
      g.lineWidth = 1.5
      chemin()
      g.stroke()
      g.setLineDash([])
      g.fillStyle = '#aebfd8'
      g.font = LevelEditor.POLICE_LABEL
      g.fillText(
        c.style === 'paroi'
          ? 'CACHETTE — paroi factice'
          : 'CACHETTE — voilée en jeu',
        p.sx + 6,
        p.sy + 15,
      )
    }

    // éponges
    this.level.sponges.forEach((sp, si) => {
      const p = this.toScreen(sp.minX, sp.minY + sp.rows * sp.cellSize)
      const q = this.toScreen(sp.minX + sp.cols * sp.cellSize, sp.minY)
      // une éponge peut prendre le dessus dans la Superposition : elle porte
      // alors le même liseré doré que les parois
      const gagnante =
        this.cutWinner?.kind === 'sponge' && this.cutWinner.index === si
      g.fillStyle = 'rgba(215,173,85,0.30)'
      g.fillRect(p.sx, p.sy, q.sx - p.sx, q.sy - p.sy)
      g.strokeStyle = gagnante ? '#ffd24a' : '#d7ad55'
      g.lineWidth = gagnante ? 3 : 1
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
    })

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
      // L'aura PIVOTE avec sa pièce : la portée est une iso-distance de la
      // surface — une pièce oblique porte donc une aura oblique. Avant,
      // l'aura restait dessinée sur la boîte NON tournée : pivoter une
      // chaudière laissait sa zone d'effet à l'angle d'avant (signalé).
      const aura = (
        portee: number,
        alphaFill: string,
        alphaLine: string,
        dash: number[],
      ): void => {
        const w = (box.maxX - box.minX + 2 * portee) * this.zoom
        const h = (box.maxY - box.minY + 2 * portee) * this.zoom
        const r = Math.min(portee * this.zoom, w / 2, h / 2)
        const c = this.toScreen(
          (box.minX + box.maxX) / 2,
          (box.minY + box.maxY) / 2,
        )
        g.save()
        g.translate(c.sx, c.sy)
        // même convention que le tracé des pièces : l'écran a l'axe y
        // inversé, l'angle trigonométrique s'y dessine en négatif
        if (box.angle) g.rotate((-box.angle * Math.PI) / 180)
        g.beginPath()
        g.roundRect(-w / 2, -h / 2, w, h, Math.max(0, r))
        if (alphaFill) {
          g.fillStyle = colA + alphaFill
          g.fill()
        }
        g.strokeStyle = colA + alphaLine
        g.setLineDash(dash)
        g.lineWidth = 1
        g.stroke()
        g.setLineDash([])
        g.restore()
      }
      aura(band, '10', '55', [5, 4])
      if (box.material === MAT_FROID)
        aura(band * (1 + P.chillColdGrowth), '', '2e', [2, 7])
      if (box.material === MAT_CHAUD)
        aura(band * (1 - P.chillHeatFade), '', '2e', [2, 7])
    }

    // LES STRUCTURES DE COQUE, sous le mobilier : on dessine les PAROIS
    // RÉELLEMENT FABRIQUÉES (portes percées comprises), pas un schéma —
    // le concepteur voit ce que le moteur verra
    const structs = this.level.structures ?? []
    if (structs.length > 0) {
      for (const paroi of boxesDesStructures(structs)) {
        const col = MAT_COLORS[paroi.material] ?? '#5c7183'
        if (paroi.forme === FORME_COQUE) {
          // une COQUE se trace morceau par morceau : ce qu'on voit est la
          // matière, et le creux reste creux — portes comprises
          for (const piece of coquePieces(paroi)) {
            g.beginPath()
            piece.forEach((pt, i) => {
              const sp = this.toScreen(pt.x, pt.y)
              if (i === 0) g.moveTo(sp.sx, sp.sy)
              else g.lineTo(sp.sx, sp.sy)
            })
            g.closePath()
            g.fillStyle = '#33465699'
            g.fill()
            g.strokeStyle = '#7f9bb3'
            g.lineWidth = 1
            g.stroke()
          }
          continue
        }
        const p = this.toScreen(paroi.minX, paroi.maxY)
        const q = this.toScreen(paroi.maxX, paroi.minY)
        g.save()
        if (paroi.angle) {
          const cx = (p.sx + q.sx) / 2
          const cy = (p.sy + q.sy) / 2
          g.translate(cx, cy)
          g.rotate((-paroi.angle * Math.PI) / 180)
          g.translate(-cx, -cy)
        }
        g.fillStyle = paroi.material === MAT_WALL ? '#33465699' : col + '99'
        g.fillRect(p.sx, p.sy, q.sx - p.sx, q.sy - p.sy)
        g.strokeStyle = paroi.material === MAT_WALL ? '#7f9bb3' : col
        g.lineWidth = 1
        g.strokeRect(p.sx, p.sy, q.sx - p.sx, q.sy - p.sy)
        g.restore()
      }
      // l'emprise de chaque structure, en pointillé : c'est elle que les
      // poignées tiennent
      structs.forEach((st, si) => {
        const p = this.toScreen(st.minX, st.maxY)
        const q = this.toScreen(st.maxX, st.minY)
        const vise = this.sel?.kind === 'structure' && this.sel.index === si
        g.save()
        if (st.angle) {
          const cx = (p.sx + q.sx) / 2
          const cy = (p.sy + q.sy) / 2
          g.translate(cx, cy)
          g.rotate((-st.angle * Math.PI) / 180)
          g.translate(-cx, -cy)
        }
        g.setLineDash(vise ? [8, 5] : [3, 6])
        g.strokeStyle = vise ? '#8ee0ff' : '#5fd0ff66'
        g.lineWidth = vise ? 2 : 1
        g.strokeRect(p.sx, p.sy, q.sx - p.sx, q.sy - p.sy)
        g.setLineDash([])
        g.restore()
        if (vise || this.zoom > 0.16) {
          g.fillStyle = vise ? '#8ee0ff' : '#5fd0ff99'
          g.font = '600 10px ui-monospace, monospace'
          g.textAlign = 'left'
          g.fillText(
            `${st.type === STRUCT_COULOIR ? 'COULOIR' : 'CHAMBRE'} · ${coutStructures([st])} blocs`,
            p.sx + 4,
            p.sy - 5,
          )
        }
      })
    }

    // surfaces (les obliques pivotent autour de leur centre) — une FORME se
    // trace par son contour partagé (formeOutline) : ce que l'éditeur montre
    // est la silhouette que le shader et la physique évaluent en SDF
    this.level.boxes.forEach((box, bi) => {
      const col = MAT_COLORS[box.material] ?? '#888'
      const gagnant =
        this.cutWinner?.kind === 'box' && this.cutWinner.index === bi
      g.save()
      if (box.forme === FORME_COQUE) {
        for (const piece of coquePieces(box)) {
          g.beginPath()
          piece.forEach((pt, i) => {
            const sp = this.toScreen(pt.x, pt.y)
            if (i === 0) g.moveTo(sp.sx, sp.sy)
            else g.lineTo(sp.sx, sp.sy)
          })
          g.closePath()
          g.fillStyle = col + '55'
          g.fill()
          g.strokeStyle = gagnant ? '#ffd24a' : col
          g.lineWidth = gagnant ? 3 : 1.5
          g.stroke()
        }
        g.restore()
        return
      }
      if (box.forme) {
        const pts = formeOutline(box, 64)
        g.beginPath()
        for (let i = 0; i < pts.length; i++) {
          const s = this.toScreen(pts[i].x, pts[i].y)
          if (i === 0) g.moveTo(s.sx, s.sy)
          else g.lineTo(s.sx, s.sy)
        }
        g.closePath()
        g.fillStyle = col + '55'
        g.fill()
        g.strokeStyle = gagnant ? '#ffd24a' : col
        g.lineWidth = gagnant ? 3 : 1.5
        g.stroke()
        // la boîte englobante en filigrane quand la pièce est sélectionnée :
        // c'est elle que tiennent les poignées
        const sel = this.sel
        if (sel?.kind === 'box' && sel.index === bi) {
          const p = this.toScreen(box.minX, box.maxY)
          const q = this.toScreen(box.maxX, box.minY)
          g.strokeStyle = col + '44'
          g.lineWidth = 1
          g.setLineDash([4, 4])
          if (box.angle) {
            const cx = (p.sx + q.sx) / 2
            const cy = (p.sy + q.sy) / 2
            g.translate(cx, cy)
            g.rotate((-box.angle * Math.PI) / 180)
            g.translate(-cx, -cy)
          }
          g.strokeRect(p.sx, p.sy, q.sx - p.sx, q.sy - p.sy)
          g.setLineDash([])
        }
        g.restore()
        return
      }
      const p = this.toScreen(box.minX, box.maxY)
      const q = this.toScreen(box.maxX, box.minY)
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

    // écarts ÉGAUX : les mesures roses de l'équirépartition — deux
    // segments à butées, chacun porte sa longueur ; quand les nombres
    // sont les mêmes, c'est équitablement réparti.
    if (this.ecarts.length > 0) {
      g.save()
      g.strokeStyle = '#ff5cf0'
      g.lineWidth = 1
      g.setLineDash([])
      g.font = '11px ui-monospace, monospace'
      for (const ec of this.ecarts) {
        const p =
          ec.axe === 'x'
            ? this.toScreen(ec.a, ec.lat)
            : this.toScreen(ec.lat, ec.a)
        const q =
          ec.axe === 'x'
            ? this.toScreen(ec.b, ec.lat)
            : this.toScreen(ec.lat, ec.b)
        g.beginPath()
        g.moveTo(p.sx, p.sy)
        g.lineTo(q.sx, q.sy)
        if (ec.axe === 'x') {
          g.moveTo(p.sx, p.sy - 5)
          g.lineTo(p.sx, p.sy + 5)
          g.moveTo(q.sx, q.sy - 5)
          g.lineTo(q.sx, q.sy + 5)
        } else {
          g.moveTo(p.sx - 5, p.sy)
          g.lineTo(p.sx + 5, p.sy)
          g.moveTo(q.sx - 5, q.sy)
          g.lineTo(q.sx + 5, q.sy)
        }
        g.stroke()
        const txt = `${Math.round(Math.abs(ec.b - ec.a))}`
        const mx = (p.sx + q.sx) / 2
        const my = (p.sy + q.sy) / 2
        const wT = g.measureText(txt).width
        g.fillStyle = 'rgba(20,26,34,0.92)'
        g.fillRect(mx - wT / 2 - 4, my - 8, wT + 8, 15)
        g.fillStyle = '#ffd9fb'
        g.fillText(txt, mx - wT / 2, my + 3)
      }
      g.restore()
    }

    // ROTATION en cours : l'angle s'affiche en vif près de la poignée —
    // « (accordée) » quand il épouse celui d'une autre paroi oblique
    if (this.drag?.mode === 'rotate' && this.sel?.kind === 'box') {
      const b = this.level.boxes[this.sel.index]
      const h = this.rotateHandlePos()
      if (b && h) {
        const angle = b.angle ?? 0
        const idx = this.sel.index
        const accord =
          angle !== 0 &&
          this.level.boxes.some((o, i) => i !== idx && (o.angle ?? 0) === angle)
        const txt = accord ? `${angle}° (accordée)` : `${angle}°`
        g.save()
        g.font = '12px ui-monospace, monospace'
        const wT = g.measureText(txt).width
        const bx = h.sx + 14
        const by = h.sy - 18
        g.fillStyle = 'rgba(20,26,34,0.92)'
        g.strokeStyle = '#ff5cf0'
        g.lineWidth = 1
        g.fillRect(bx - 6, by - 13, wT + 12, 20)
        g.strokeRect(bx - 6, by - 13, wT + 12, 20)
        g.fillStyle = '#ffd9fb'
        g.fillText(txt, bx, by + 2)
        g.restore()
      }
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
      g.font = LevelEditor.POLICE_LABEL
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
      const dp = this.toScreen(dcl.x - dcl.w / 2, dcl.y + dcl.h / 2)
      const dw = dcl.w * this.zoom
      const dh = dcl.h * this.zoom
      if (!im) {
        // image pas (encore) là : un gabarit tient sa place — le décal
        // reste visible, donc saisissable et déplaçable comme le reste
        g.save()
        g.strokeStyle = 'rgba(169,192,210,0.5)'
        g.lineWidth = 1
        g.setLineDash([3, 3])
        g.strokeRect(dp.sx, dp.sy, dw, dh)
        g.setLineDash([])
        g.fillStyle = 'rgba(169,192,210,0.6)'
        g.font = '10px ui-monospace, monospace'
        g.fillText(dcl.kind, dp.sx + 3, dp.sy + 12)
        g.restore()
        continue
      }
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

    // ---- Lampes : la monture (soleil à rayons), la hauteur en toutes
    // lettres, et — sur la lampe sélectionnée — sa portée réelle en
    // pointillé. L'ombre elle-même se juge au bouton ESSAYER.
    const lumieres = this.level.lumieres ?? []
    const diagCuve = Math.hypot(
      this.level.bounds.maxX - this.level.bounds.minX,
      this.level.bounds.maxY - this.level.bounds.minY,
    )
    // Sans lampe posée, la cuve garde sa LAMPE PAR DÉFAUT — invisible en
    // jeu, mais elle éclaire : c'est elle qui explique qu'un tableau reste
    // lumineux à éclairage général 0. On la montre ici en fantôme, sinon le
    // modèle est incompréhensible (« d'où vient cette lumière ? »).
    if (lumieres.length === 0) {
      const b = this.level.bounds
      const s0 = this.toScreen(
        (b.minX + b.maxX) / 2,
        b.minY + (b.maxY - b.minY) * 0.7,
      )
      g.save()
      g.setLineDash([4, 4])
      g.strokeStyle = '#ffd97788'
      g.lineWidth = 1.5
      g.beginPath()
      g.arc(s0.sx, s0.sy, 10, 0, Math.PI * 2)
      g.stroke()
      g.beginPath()
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2
        g.moveTo(s0.sx + Math.cos(a) * 13, s0.sy + Math.sin(a) * 13)
        g.lineTo(s0.sx + Math.cos(a) * 18, s0.sy + Math.sin(a) * 18)
      }
      g.stroke()
      g.setLineDash([])
      g.fillStyle = '#ffd977aa'
      g.font = '600 9px ui-monospace, monospace'
      g.fillText('LAMPE PAR DÉFAUT — invisible en jeu', s0.sx + 22, s0.sy - 6)
      g.fillText('posez une lampe pour la remplacer', s0.sx + 22, s0.sy + 6)
      g.restore()
    }
    for (let i = 0; i < lumieres.length; i++) {
      const l = lumieres[i]
      const s = this.toScreen(l.x, l.y)
      const selLampe = this.sel?.kind === 'lumiere' && this.sel.index === i
      const eteinte = i >= MAX_LUMIERES // au-delà du plafond : elle n'éclaire pas
      // le pictogramme prend la couleur de la lampe (le blanc neutre garde
      // le jaune d'interface : un soleil blanc disparaîtrait sur la cuve)
      const col = eteinte
        ? '#7b93a8'
        : l.couleur && l.couleur !== '#ffffff'
          ? l.couleur
          : '#ffd977'
      g.save()
      // le bandeau se dessine en SEGMENT à sa vraie longueur : on voit d'un
      // coup d'œil ce qu'il couvre, et l'angle se lit sans ouvrir la fiche
      if (l.forme === 'bandeau') {
        const demi = ((l.longueur ?? 260) / 2) * this.zoom
        const a = (((l.angle ?? 0) % 360) * Math.PI) / 180
        const dx = Math.cos(a) * demi
        const dy = -Math.sin(a) * demi // écran : y vers le bas
        g.strokeStyle = col + (selLampe ? 'ff' : 'aa')
        g.lineWidth = selLampe ? 5 : 4
        g.beginPath()
        g.moveTo(s.sx - dx, s.sy - dy)
        g.lineTo(s.sx + dx, s.sy + dy)
        g.stroke()
      }
      // rayons
      g.strokeStyle = col + (selLampe ? 'ff' : 'aa')
      g.lineWidth = selLampe ? 2 : 1.5
      g.beginPath()
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2
        g.moveTo(s.sx + Math.cos(a) * 9, s.sy + Math.sin(a) * 9)
        g.lineTo(s.sx + Math.cos(a) * 15, s.sy + Math.sin(a) * 15)
      }
      g.stroke()
      // la monture
      g.fillStyle = col
      g.beginPath()
      g.arc(s.sx, s.sy, 6, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = '#0a1420'
      g.lineWidth = 1
      g.stroke()
      // hauteur en toutes lettres : c'est le réglage qui sculpte l'ombre
      g.fillStyle = col + 'cc'
      g.font = '600 9px ui-monospace, monospace'
      g.fillText(
        eteinte
          ? `LAMPE ${i + 1} — ÉTEINTE (plafond)`
          : `${l.forme === 'bandeau' ? 'BANDE' : 'LAMPE'} ${i + 1} · h ${l.h ?? LAMPE_HAUTEUR_DEFAUT}`,
        s.sx + 18,
        s.sy - 6,
      )
      if (selLampe) {
        const portee = l.portee && l.portee > 0 ? l.portee : diagCuve * 0.62
        g.strokeStyle = col + '55'
        g.setLineDash([6, 5])
        g.lineWidth = 1
        g.beginPath()
        g.arc(s.sx, s.sy, portee * this.zoom, 0, Math.PI * 2)
        g.stroke()
        g.setLineDash([])
        g.fillStyle = col + '88'
        g.fillText(
          'PORTÉE',
          s.sx + portee * this.zoom * 0.707 + 4,
          s.sy - portee * this.zoom * 0.707 - 4,
        )
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
      g.fillText(
        q.canal < 0
          ? 'PORTE SCÉNARISÉE'
          : `PORTE → CANAL ${q.canal}${q.regle === 'et' ? ' (ET)' : ''}`,
        p.sx + 4,
        p.sy - 4,
      )
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
        g.arc(
          p.sx,
          p.sy,
          k === 0 || k === pts.length - 1 ? 4 : 2.5,
          0,
          Math.PI * 2,
        )
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
          g.moveTo(
            p.sx - (ex + ey * 0.6) * taille,
            p.sy - (ey - ex * 0.6) * taille,
          )
          g.lineTo(p.sx, p.sy)
          g.lineTo(
            p.sx - (ex - ey * 0.6) * taille,
            p.sy - (ey + ex * 0.6) * taille,
          )
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
      g.fillStyle = touchees.has(i)
        ? 'rgba(110,255,185,0.30)'
        : 'rgba(48,64,76,0.7)'
      g.fill()
      g.strokeStyle = touchees.has(i)
        ? '#6dffb8'
        : t.mode === 'nor'
          ? '#c99a4e'
          : '#7b93a8'
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
      const num = String(canalDeCible(cibles, i))
      g.fillText(num, p.sx - 3 * num.length, p.sy + 3.5)
    }
    // LE MÉTA POSÉ : plots d'article (pointillés teintés par la monnaie,
    // icône + prix), banc des mémoires, marchand, éclats — le langage du jeu
    for (const p of this.level.plots ?? []) {
      const a = this.toScreen(p.minX, p.maxY)
      const b = this.toScreen(p.maxX, p.minY)
      const teinte = p.monnaie === 'memoire' ? '109,255,184' : '140,215,255'
      g.fillStyle = `rgba(${teinte},0.08)`
      g.fillRect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy)
      g.setLineDash([7, 6])
      g.strokeStyle = `rgba(${teinte},0.8)`
      g.lineWidth = 1.5
      g.strokeRect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy)
      g.setLineDash([])
      const fiche = ficheArticle(p)
      const cx = (a.sx + b.sx) / 2
      const cy = (a.sy + b.sy) / 2
      const t = Math.max(9, Math.min(22, 80 * this.zoom))
      g.textAlign = 'center'
      g.font = `${t}px system-ui`
      g.fillText(fiche?.icone ?? '?', cx, cy - t * 0.15)
      g.fillStyle = `rgba(${teinte},0.95)`
      g.font = `600 ${Math.max(8, Math.round(t * 0.55))}px ui-monospace, monospace`
      g.fillText(
        `${p.prix ?? fiche?.prix ?? '?'} ${p.monnaie === 'memoire' ? 'mém.' : 'cL'}`,
        cx,
        cy + t * 0.75,
      )
      g.textAlign = 'left'
    }
    // LES ANCRES MÉTA : les rendez-vous du module, en trait ambré — on les
    // veut LISIBLES sans être confondues avec les plots d'article
    for (const a of this.level.ancres ?? []) {
      const p0 = this.toScreen(a.minX, a.maxY)
      const p1 = this.toScreen(a.maxX, a.minY)
      const barre = a.role === 'degat' || a.role === 'sceau' || a.role === 'porte-cuve'
      const teinte = barre ? '255,120,110' : '236,178,90'
      g.fillStyle = `rgba(${teinte},0.10)`
      g.fillRect(p0.sx, p0.sy, p1.sx - p0.sx, p1.sy - p0.sy)
      g.setLineDash(barre ? [3, 4] : [9, 5])
      g.strokeStyle = `rgba(${teinte},0.9)`
      g.lineWidth = 1.5
      g.strokeRect(p0.sx, p0.sy, p1.sx - p0.sx, p1.sy - p0.sy)
      g.setLineDash([])
      const cx = (p0.sx + p1.sx) / 2
      const cy = (p0.sy + p1.sy) / 2
      const fiche =
        a.role === 'station' || a.role === 'degat'
          ? REPARATIONS.find((r) => r.id === a.id)
          : null
      g.textAlign = 'center'
      if (fiche) {
        const t = Math.max(9, Math.min(20, 70 * this.zoom))
        g.font = `${t}px system-ui`
        g.fillStyle = `rgba(${teinte},0.95)`
        g.fillText(fiche.icone, cx, cy + t * 0.35)
      }
      g.fillStyle = `rgba(${teinte},0.95)`
      g.font = '600 9px ui-monospace, monospace'
      g.fillText(
        fiche ? `${ANCRE_NOMS[a.role].toUpperCase()} · ${fiche.nom}` : ANCRE_NOMS[a.role].toUpperCase(),
        cx,
        p0.sy - 5,
      )
      g.textAlign = 'left'
    }
    if (this.level.bancMemoires) {
      const bz = this.level.bancMemoires
      const a = this.toScreen(bz.minX, bz.maxY)
      const b = this.toScreen(bz.maxX, bz.minY)
      g.fillStyle = 'rgba(109,255,184,0.10)'
      g.fillRect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy)
      g.setLineDash([4, 7])
      g.strokeStyle = 'rgba(109,255,184,0.8)'
      g.lineWidth = 1.5
      g.strokeRect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy)
      g.setLineDash([])
      g.textAlign = 'center'
      g.font = `${Math.max(10, Math.min(24, 80 * this.zoom))}px system-ui`
      g.fillText('⚛', (a.sx + b.sx) / 2, (a.sy + b.sy) / 2 + 4)
      g.fillStyle = '#8effcd'
      g.font = '600 9px ui-monospace, monospace'
      g.fillText('BANC DES MÉMOIRES', (a.sx + b.sx) / 2, a.sy - 5)
      g.textAlign = 'left'
    }
    if (this.level.marchand) {
      const p = this.toScreen(this.level.marchand.x, this.level.marchand.y)
      const rr = Math.max(8, 30 * this.zoom)
      g.beginPath()
      g.arc(p.sx, p.sy, rr, 0, Math.PI * 2)
      g.fillStyle = 'rgba(255,170,210,0.18)'
      g.fill()
      g.setLineDash([2, 5])
      g.strokeStyle = '#ffbedd'
      g.lineWidth = 1.6
      g.stroke()
      g.setLineDash([])
      g.fillStyle = '#ffbedd'
      g.font = '600 9px ui-monospace, monospace'
      g.fillText('MARCHAND', p.sx - 26, p.sy - rr - 4)
    }
    for (const e of this.level.eclats ?? []) {
      const p = this.toScreen(e.x, e.y)
      const rr = Math.max(6, 16 * this.zoom)
      g.beginPath()
      g.moveTo(p.sx, p.sy - rr * 1.15)
      g.lineTo(p.sx + rr * 0.72, p.sy)
      g.lineTo(p.sx, p.sy + rr * 1.15)
      g.lineTo(p.sx - rr * 0.72, p.sy)
      g.closePath()
      g.fillStyle = 'rgba(140,255,205,0.45)'
      g.fill()
      g.strokeStyle = '#8effcd'
      g.lineWidth = 1.5
      g.stroke()
      g.fillStyle = '#eafff5'
      g.font = '700 9px ui-monospace, monospace'
      const t = `+${e.memoire}`
      g.fillText(t, p.sx - 2.7 * t.length, p.sy + 3)
    }
    // les pastilles de CONDENSAT posées main (leur valeur en cL au centre)
    // et l'emplacement de FIOLE — le langage visuel du jeu
    for (let i = 0; i < (this.level.condensats ?? []).length; i++) {
      const c = this.level.condensats![i]
      const p = this.toScreen(c.x, c.y)
      const rr = Math.max(5, 15 * this.zoom)
      g.beginPath()
      g.arc(p.sx, p.sy, rr, 0, Math.PI * 2)
      g.fillStyle = 'rgba(140,215,255,0.45)'
      g.fill()
      g.strokeStyle = '#9fdcff'
      g.lineWidth = 1.5
      g.stroke()
      g.fillStyle = '#eaf7ff'
      g.font = '700 9px ui-monospace, monospace'
      const t = String(c.cl)
      g.fillText(t, p.sx - 2.7 * t.length, p.sy + 3)
    }
    if (this.level.fiole) {
      const p = this.toScreen(this.level.fiole.x, this.level.fiole.y)
      const rr = Math.max(6, 18 * this.zoom)
      g.beginPath()
      g.arc(p.sx, p.sy, rr, 0, Math.PI * 2)
      g.fillStyle = 'rgba(190,130,255,0.30)'
      g.fill()
      g.strokeStyle = '#c99aff'
      g.lineWidth = 2
      g.stroke()
      g.beginPath()
      g.arc(p.sx, p.sy, rr * 0.55, 0, Math.PI * 2)
      g.strokeStyle = '#e8d2ff'
      g.lineWidth = 1.2
      g.stroke()
      g.fillStyle = '#e8d2ff'
      g.font = '600 9px ui-monospace, monospace'
      g.fillText('FIOLE', p.sx - 13, p.sy - rr - 4)
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
      g.font = LevelEditor.POLICE_LABEL
      g.fillText('DÉPART', s.sx + r + 4, s.sy + 4)
    }

    // étiquettes
    g.font = LevelEditor.POLICE_LABEL
    for (const l of this.level.labels) {
      const p = this.toScreen(l.x, l.y)
      g.fillStyle = '#a9c0d2'
      g.fillText(l.text, p.sx - g.measureText(l.text).width / 2, p.sy + 4)
    }

    // rectangle en cours de tracé — la GOMME se peint en jaune barré : on
    // voit qu'on efface, pas qu'on pose
    if (this.drag?.mode === 'create') {
      const p = this.toScreen(
        Math.min(this.drag.x0, this.drag.x1),
        Math.max(this.drag.y0, this.drag.y1),
      )
      const q = this.toScreen(
        Math.max(this.drag.x0, this.drag.x1),
        Math.min(this.drag.y0, this.drag.y1),
      )
      const efface = this.tool.kind === 'gomme'
      if (efface) {
        g.fillStyle = 'rgba(255,210,74,0.12)'
        g.fillRect(p.sx, p.sy, q.sx - p.sx, q.sy - p.sy)
      }
      g.setLineDash([5, 4])
      g.strokeStyle = efface ? '#ffd24a' : '#ffffff'
      g.lineWidth = efface ? 1.5 : 1
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
    const boxSel =
      this.sel?.kind === 'box' ? this.level.boxes[this.sel.index] : null
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
      g.fillText(
        `${Math.round(hx * 2)} × ${Math.round(hy * 2)}`,
        bas.sx + 8,
        bas.sy + 15,
      )
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
      g.fillText(
        `${Math.round(r.maxX - r.minX)} × ${Math.round(r.maxY - r.minY)}`,
        p.sx,
        q.sy + 15,
      )
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
      const bord = this.toScreen(
        cx - Math.sin(rad) * demiH,
        cy + Math.cos(rad) * demiH,
      )
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
