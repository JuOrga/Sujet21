// Solveur de fluide 2D « Position Based Fluids » (Macklin & Müller 2013).
//
// Choix structurants, dictés par le doc fonctionnel :
// - contrainte de densité en égalité (pas seulement anti-compression) : en
//   apesanteur, le déficit de densité en surface attire les particules vers
//   l'intérieur — c'est la tension de surface qui tient le corps (§2.3) ;
// - sCorr (correction tensile) empêche l'agglutination que cette égalité
//   provoquerait, et son intensité est le curseur de cohésion (décision n°1) ;
// - toutes les interactions internes sont antisymétriques par paires : la
//   quantité de mouvement est conservée exactement, l'éjection comprise (§3.3).

import type { SimParams } from './params'
import type { NoyauxWasm } from './wasm'
import { SpatialGrid } from './grid'
import { makeKernels, computeRestDensity, type Kernels } from './kernels'
import { labelComponents } from './components'
import { boxContact, Sponge, type ClosestPoint } from './obstacles'
import {
  MAT_CHAUD,
  MAT_FROID,
  MAT_GRILLE,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_MEMBRANE,
  MAT_RIDEAU,
  MAT_SURCHAUFFEUR,
  dansBoite,
  MAT_WALL,
  type ObstacleBox,
  type SpongeDef,
} from '../game/level'

export const KIND_FREE = 0
export const KIND_PLAYER = 1

// Voisins retenus par particule et par pas (au-delà : ignorés — les zones
// aussi denses sont déjà sur-contraintes)
const MAX_NEIGHBORS = 48

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface PlayerStats {
  count: number
  centroidX: number
  centroidY: number
  velX: number
  velY: number
  rmsRadius: number
}

// Rejet rapide d'une boîte : hors de portée « marge » ? Pour une boîte
// OBLIQUE ou une FORME (toujours inscrite dans sa boîte englobante), on
// rejette sur le cercle englobant — conservateur mais sûr.
function horsBoite(
  b: {
    minX: number
    minY: number
    maxX: number
    maxY: number
    angle?: number
    forme?: number
  },
  x: number,
  y: number,
  marge: number,
): boolean {
  if (b.angle) {
    const r = Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2 + marge
    const cx = (b.minX + b.maxX) / 2
    const cy = (b.minY + b.maxY) / 2
    return Math.abs(x - cx) > r || Math.abs(y - cy) > r
  }
  return (
    x < b.minX - marge ||
    x > b.maxX + marge ||
    y < b.minY - marge ||
    y > b.maxY + marge
  )
}

/** L'ÉTAT d'une particule tel que le RENDU l'encode, en un seul nombre :
 *  givre en positif (0..1), vapeur en négatif (0..−1) — et le PLASMA pousse
 *  la vapeur AU-DELÀ de −1, jusqu'à −2. Les décodages en bout de chaîne :
 *  `gas = clamp(-état, 0, 1)` (saturé, donc inchangé par le plasma) et
 *  `plasma = clamp(-état - 1, 0, 1)`. Une seule formule, partagée entre le
 *  paquetage des sprites et les tests — pour que l'encodage ne puisse pas
 *  dériver en silence de ce que les shaders décodent. */
export function etatRendu(frost: number, vapor: number, ionise: number): number {
  return frost - vapor * (1 + ionise)
}

// L'ALLURE DE LIVRAISON (u/s) : la vitesse à laquelle le champ pousse le
// nuage hors de la bouche du tube, une fois arrivé au terminus. Le voyage se
// fait à ~500 u/s ; on sort bien plus lentement — assez vite pour être
// dehors avant que le joueur n'ait fini de relâcher la touche, assez
// doucement pour que ce ne soit pas une éjection.
const LIVRAISON_VITESSE = 150

// LE CŒUR D'UNE LIGNE DE CHAMP, en part du rayon de capture. C'est
// l'épaisseur sur laquelle la vapeur ORDINAIRE bute. Elle est JUSTE en
// dessous du rayon où le faisceau s'ionise (plasmaRailRadius), et pas
// davantage : repoussée jusqu'au rayon de capture, la vapeur ne pourrait
// plus jamais allumer ce qu'elle veut franchir — c'est le verrou de #304,
// qui avait rendu le conduit inatteignable en jeu. À 0,9, il reste 3 unités
// de marge, et la paroi garde presque toute l'épaisseur qu'on lui dessine.
// Exporté : le DESSIN de la paroi doit peindre l'épaisseur qui arrête pour
// de bon, sans quoi le tube ment de nouveau sur sa taille — dans l'autre
// sens cette fois (peint à 75, il n'arrêtait la vapeur qu'à 27).
export const COEUR_PART = 0.9

export class FluidSim {
  readonly params: SimParams
  readonly bounds: Bounds
  readonly capacity: number
  count = 0

  posX: Float32Array
  posY: Float32Array
  prdX: Float32Array
  prdY: Float32Array
  velX: Float32Array
  velY: Float32Array
  lambda: Float32Array
  dpX: Float32Array
  dpY: Float32Array
  dvX: Float32Array
  dvY: Float32Array
  density: Float32Array
  kind: Uint8Array
  cooldown: Float32Array
  labels: Int32Array
  // Glace (§6) : givre 0 → 1, puis gel. Un amas gelé est un bloc RIGIDE et
  // BALISTIQUE : il garde son élan (vitesse commune à l'amas), pousse le
  // liquide (masse infinie), rebondit sur les parois au lieu d'éclabousser,
  // et ignore la chimie des surfaces. La glace prise au contact d'une plaque
  // froide s'y soude (vitesse nulle) : c'est l'ancrage. Le dégel rend l'eau
  // au corps, dans le mouvement où la glace se trouvait.
  frost: Float32Array
  frozen: Uint8Array
  // Vapeur (§6, tableau 3) : hors du solveur de densité (elle ne presse pas
  // et n'est pas pressée), elle s'étale par répulsion douce, flotte, passe
  // les grilles, et se PILOTE en continu vers le pointeur — au prix d'une
  // évaporation. Le froid la condense avant de gérer quoi que ce soit d'autre.
  vapor: Float32Array
  // Ionisation VISIBLE (0..1) : à quel point cette particule de vapeur est
  // du PLASMA. Monte quand elle voyage dans la bande d'un rail au champ
  // engagé, retombe en ~0,5 s hors du champ, s'éteint à la condensation.
  // Ne pèse sur AUCUNE physique : c'est un état de RENDU (le nuage
  // blanc-violet qui crépite), tenu ici parce que seul le solveur sait qui
  // voyage dans la bande.
  ionise: Float32Array
  gaseous: Uint8Array
  // Mémoire de lien du gaz : à 1 tant que la particule est gazeuse, décroît
  // lentement après (gasLinkDecay). Le rayon d'adjacence des amas et le
  // rappel de condensation la suivent : un nuage qui redevient eau reste UN
  // corps le temps de se regrouper — changer d'état ne disperse pas.
  gasLink: Float32Array
  // Gel volontaire (touche F) / vapeur volontaire (touche G)
  freezeIntent = false
  gasIntent = false
  // Refroidissement du vaisseau (§5), fixé par le jeu : 0 = tiède, 1 = glacial.
  // Étend les auras froides, durcit gel et dégel, affaiblit les radiateurs.
  chill = 0
  // Vitesse normale du dernier choc de bloc de glace (consommé par l'audio)
  iceImpact = 0
  // Gouttes bues par les éponges depuis le début (consommé par l'audio)
  spongeBites = 0
  // LIVRÉ PAR LE CHAMP : cette particule est sortie par la bouche d'un rail,
  // et le champ ne la reprend plus à cette bouche. Sans ce cran d'arrêt, le
  // nuage se garait sur le SEUIL de livraison : poussé dehors, relâché,
  // repoussé dedans par sa propre expansion, repris — mesuré, il oscillait
  // indéfiniment à 376 u (le seuil est à 375) et le champ ne se relâchait
  // JAMAIS. Le drapeau tombe dès que la particule retrouve le corps du rail
  // ailleurs qu'au terminus : un second voyage reste possible.
  private readonly livreParChamp: Uint8Array
  private readonly welded: Uint8Array // gelée au contact d'une plaque : soudée
  // LE SOUFFLE EN VOL : vapeur chassée par un dash, qui ne vous appartient
  // plus. Elle reste GAZ le temps du voyage (sinon elle se condense en l'air
  // et le rappel de condensation la ramène au corps — « tout est récupéré
  // immédiatement ») et perle sur la première paroi touchée. Un compte à
  // rebours l'empêche de flotter indéfiniment : à bout de course, elle perle
  // sur place.
  private readonly souffle: Float32Array // > 0 : secondes de vol restantes
  // MATIÈRE DU CORPS égarée : goutte éjectée, gerbe de péage, ou fragment
  // que le remous d'un tir a détaché. Elle reste À VOUS : une fois son délai
  // purgé, si elle traîne à portée du corps, elle est rappelée d'elle-même —
  // la vie ne baisse pas pour une goutte qui n'est jamais vraiment partie.
  // (Les gouttes SEMÉES par le tableau n'ont pas la marque : les
  // collectables s'attrapent au contact, pas à l'aimant.)
  // Valeurs : 0 = sans marque · 1 = du corps, SORTIE du halo (perdue, mais
  // reprise si on repasse à portée) · 2 = du corps, DANS le halo (vivante).
  private readonly duCorps: Uint8Array
  private readonly iceVxSum: Float32Array
  private readonly iceVySum: Float32Array
  private readonly iceCnt: Int32Array
  private readonly iceNxSum: Float32Array
  private readonly iceNySum: Float32Array
  private readonly iceWeld: Uint8Array
  // Rotation des blocs : centre de masse, point de contact moyen, moment
  // d'inertie et vitesse angulaire — un palet qui heurte de biais doit PIVOTER.
  private readonly iceCxSum: Float32Array
  private readonly iceCySum: Float32Array
  private readonly icePxSum: Float32Array
  private readonly icePySum: Float32Array
  private readonly icePCnt: Int32Array
  private readonly iceInertia: Float32Array
  private readonly iceOmega: Float32Array
  // Chimie du contact par bloc : nombre de particules touchant l'hydrophobe
  // et l'hydrophile — le tableau des règles se joue à l'échelle du PALET.
  private readonly icePhobe: Int32Array
  private readonly icePhile: Int32Array
  // Étiquettes des amas de GLACE, en CACHE : la structure d'un bloc rigide
  // ne change que sur un événement (gel, dégel, retrait) ou une fusion de
  // blocs — refaire le parcours en profondeur à chaque pas était LE poste
  // dominant de la phase palet. Tableau dédié : relabel() écrase `labels`
  // pour la détection du corps, il ne doit pas corrompre ce cache.
  private readonly iceLabels: Int32Array
  private iceComps = 0 // composantes du dernier étiquetage
  private iceLabelTtl = 0 // pas restants avant rafraîchissement de sécurité
  private iceDirty = true // un gel/dégel/retrait vient d'avoir lieu
  private readonly compScratch: Int32Array // compteur par composante (relabel)
  private readonly relabelScratch: Int32Array // candidats voisins (relabel/icePass), collectés sans rappel
  private readonly reorderPerm: Int32Array // permutation du re-tri spatial
  private readonly reorderScratch: Float32Array // tampon de permutation (sert à tous les types)

  boxes: ObstacleBox[] = []
  sponges: Sponge[] = []
  contactTime: Float32Array // temps de contact continu avec l'éponge
  // LES CONDUITS (rails marqués `conduit`) : des tubes qui ne se comportent
  // pas pareil selon l'état. Rangés à part des boîtes parce qu'un tube est
  // une CAPSULE (distance à une polyligne), pas un rectangle — le convertir
  // en boîtes obliques aurait demandé de toucher au format des tableaux, au
  // générateur et à l'éditeur pour une géométrie qu'on sait déjà mesurer.
  // LES TUBES. Un par rail : tout rail a un corps, l'eau et la glace y
  // butent. `raccourci` distingue le CONDUIT — celui qui, arc engagé, laisse
  // en plus la vapeur ignorer le décor et franchir une paroi.
  private conduits: {
    pts: { x: number; y: number }[]
    rayon: number
    raccourci: boolean
    rail: number
    actif: boolean
  }[] = []
  // 1 = la particule est DANS un tube, à cet instant. Recalculé une fois par
  // pas, avant la résolution des solides, et lu deux fois : la vapeur y
  // ignore tout le décor (c'est le raccourci), l'eau et la glace s'en font
  // expulser (c'est la paroi).
  private readonly dansConduit: Uint8Array
  // 1 = ce tube-là est OUVERT (arc engagé) : seul cas où la vapeur passe
  private readonly conduitOuvert: Uint8Array
  // 1 = le tube le plus proche porte un ARC. C'est lui qui décide du GAZ :
  // seul le plasma — de la vapeur sur une ligne de champ allumée — franchit
  // un rail. La vapeur ordinaire bute comme l'eau, sur un cœur plus mince.
  private readonly conduitArc: Uint8Array
  // l'axe du tube au point le plus proche : sert à repousser ce qui n'est
  // pas gazeux, sans refaire la projection
  private readonly conduitNX: Float32Array
  private readonly conduitNY: Float32Array
  private readonly conduitDist: Float32Array // distance à l'axe du tube
  private readonly conduitRayon: Float32Array // rayon du tube retenu
  private readonly conduitQX: Float32Array // le point de l'axe le plus proche
  private readonly conduitQY: Float32Array
  private contactMat: Int8Array // -1 aucun, sinon matériau du contact solide
  private contactNX: Float32Array
  private contactNY: Float32Array
  private contactVn: Float32Array // vitesse normale entrante avant résolution
  // CODEX : combinaisons matériau × état vues par le CORPS depuis le début
  // du tableau (indice = matériau × 3 + état ; état 0 eau, 1 glace,
  // 2 vapeur). Les « passages » (vapeur/évent, eau/membrane, glace/rideau)
  // s'y consignent aussi — même indice, jamais de contact pour eux.
  readonly codexContacts = new Uint8Array(30)

  baseVolume = 0
  playerCount = 0
  dispersed = false
  // Eau avalée par le sas : retirée de la simulation, mise en bonbonne à la
  // sortie. Le sas boit — cette eau n'est pas perdue.
  swallowed = 0
  // Part avalée à l'état de glace : ouvre droit à la prime de collecte
  swallowedIce = 0
  // Fraction du corps ACTIF (particules joueur) baignant dans une aura de
  // chauffe — le déclencheur de la transformation à 95 % (main.ts). Mise à
  // jour à chaque pas par processCold.
  chauffeFrac = 0
  // Fraction du corps actif dans une AURA FROIDE — le pack présence y lit
  // le FRISSON (le tremblement bref du corps que le froid saisit)
  froidFrac = 0

  // Impulsions vapeur restantes. La RÉSERVE (dashBudgetMax) est celle du
  // tableau : pleine au chargement. Se vaporiser DE SON PROPRE CHEF refait
  // le plein — mais une transformation SUBIE (chaudière, zone qui impose la
  // vapeur) ne rend rien, sinon la salle serait une ferme à dashs. Le
  // SURCHAUFFEUR frôlé en gaz en rend UNE, une seule fois par appareil,
  // sans jamais dépasser la réserve.
  dashBudget = 0
  dashBudgetMax = 3
  // Bonus de rendement de recondensation (instrument « aimant à rosée ») —
  // posé par le jeu au début de la run, remis à zéro avec la simulation
  recondBonus = 0
  // LES INSTRUMENTS EMBARQUÉS, côté simulation. Chacun est un facteur posé
  // par le jeu au chargement du tableau et remis à neuf avec la simulation :
  // un instrument ne touche JAMAIS au réglage du banc — il multiplie ici,
  // pour cette run seulement, et le banc reste la référence.
  exitRadiusFactor = 1 // « gueule ouverte » : portée d'aspiration du sas
  reabsorbFactor = 1 // « peau tendue » : délai avant de récupérer une goutte
  vaporTollFactor = 1 // « détendeur » : péage de la vaporisation
  iceBounceFactor = 1 // « patins de givre » : restitution du palet
  spongeGripFactor = 1 // « plastron » : prise de l'éponge
  criticalFactor = 1 // « vanne de secours » : seuil de dispersion
  basculeFactor = 1 // vitesse des bascules d'état volontaires
  perteGazFactor = 1 // évaporation du nuage au repos
  perteGrilleFactor = 1 // vapeur perdue dans les mailles d'un évent
  priseSasGlaceFactor = 1 // prise du courant du sas sur un palet
  glisseGlaceFactor = 1 // prise de l'hydrophile sur la glace
  // Surchauffeurs déjà déchargés (indices de boîtes) — remis à neuf au
  // chargement du tableau. Le rendu lit ce même état pour le manomètre.
  readonly surchauffesVides = new Set<number>()
  private mouthX = 0
  private mouthY = 0
  private drainOn = false
  stats: PlayerStats = {
    count: 0,
    centroidX: 0,
    centroidY: 0,
    velX: 0,
    velY: 0,
    rmsRadius: 1,
  }

  private grid: SpatialGrid
  private kernels: Kernels
  private restDensity: number
  private lastKernelRadius: number
  private lastSpacing: number
  private ejectCarry = 0
  private stepIndex = 0
  private readonly stack: Int32Array
  // Voisinages en listes plates, construits une fois par pas et réutilisés
  // par toutes les itérations (et la viscosité) : les corrections par
  // itération sont bornées à une fraction de h, le voisinage ne bouge pas
  // significativement au sein d'un pas.
  private readonly nbStart: Int32Array
  private readonly nbList: Int32Array
  // Données de paires calculées par la passe lambda et réutilisées telles
  // quelles par la passe de déplacement (les positions ne bougent qu'après) :
  // évite de refaire distances et noyaux deux fois par itération.
  private readonly pairDx: Float32Array
  private readonly pairDy: Float32Array
  private readonly pairW: Float32Array
  private readonly pairC: Float32Array
  // Moteur WASM : les noyaux chauds compilés (grille interne, voisins,
  // densité, XSPH) — branchés par main.ts quand public/noyaux.wasm charge.
  // moteurWasm bascule à chaud (voile PARAMÈTRES) : à false, ou sans module,
  // le pas s'exécute sur le moteur JavaScript historique, inchangé.
  noyauxWasm: NoyauxWasm | null = null
  moteurWasm = false

  constructor(params: SimParams, bounds: Bounds, capacity = 4096) {
    this.params = params
    this.bounds = bounds
    this.capacity = capacity

    this.posX = new Float32Array(capacity)
    this.posY = new Float32Array(capacity)
    this.prdX = new Float32Array(capacity)
    this.prdY = new Float32Array(capacity)
    this.velX = new Float32Array(capacity)
    this.velY = new Float32Array(capacity)
    this.lambda = new Float32Array(capacity)
    this.dpX = new Float32Array(capacity)
    this.dpY = new Float32Array(capacity)
    this.dvX = new Float32Array(capacity)
    this.dvY = new Float32Array(capacity)
    this.density = new Float32Array(capacity)
    this.kind = new Uint8Array(capacity)
    this.cooldown = new Float32Array(capacity)
    this.labels = new Int32Array(capacity)
    this.frost = new Float32Array(capacity)
    this.frozen = new Uint8Array(capacity)
    this.vapor = new Float32Array(capacity)
    this.ionise = new Float32Array(capacity)
    this.gasLink = new Float32Array(capacity)
    this.gaseous = new Uint8Array(capacity)
    this.livreParChamp = new Uint8Array(capacity)
    this.welded = new Uint8Array(capacity)
    this.souffle = new Float32Array(capacity)
    this.duCorps = new Uint8Array(capacity)
    this.iceVxSum = new Float32Array(capacity)
    this.iceVySum = new Float32Array(capacity)
    this.iceCnt = new Int32Array(capacity)
    this.iceNxSum = new Float32Array(capacity)
    this.iceNySum = new Float32Array(capacity)
    this.iceWeld = new Uint8Array(capacity)
    this.iceCxSum = new Float32Array(capacity)
    this.iceCySum = new Float32Array(capacity)
    this.icePxSum = new Float32Array(capacity)
    this.icePySum = new Float32Array(capacity)
    this.icePCnt = new Int32Array(capacity)
    this.iceInertia = new Float32Array(capacity)
    this.iceOmega = new Float32Array(capacity)
    this.icePhobe = new Int32Array(capacity)
    this.icePhile = new Int32Array(capacity)
    this.iceLabels = new Int32Array(capacity)
    this.compScratch = new Int32Array(capacity)
    this.relabelScratch = new Int32Array(2048)
    this.reorderPerm = new Int32Array(capacity)
    this.reorderScratch = new Float32Array(capacity)
    this.stack = new Int32Array(capacity)
    this.nbStart = new Int32Array(capacity + 1)
    this.nbList = new Int32Array(capacity * MAX_NEIGHBORS)
    this.pairDx = new Float32Array(capacity * MAX_NEIGHBORS)
    this.pairDy = new Float32Array(capacity * MAX_NEIGHBORS)
    this.pairW = new Float32Array(capacity * MAX_NEIGHBORS)
    this.pairC = new Float32Array(capacity * MAX_NEIGHBORS)
    this.contactTime = new Float32Array(capacity)
    this.dansConduit = new Uint8Array(capacity)
    this.conduitOuvert = new Uint8Array(capacity)
    this.conduitArc = new Uint8Array(capacity)
    this.conduitNX = new Float32Array(capacity)
    this.conduitNY = new Float32Array(capacity)
    this.conduitDist = new Float32Array(capacity)
    this.conduitRayon = new Float32Array(capacity)
    this.conduitQX = new Float32Array(capacity)
    this.conduitQY = new Float32Array(capacity)
    this.contactMat = new Int8Array(capacity)
    this.contactNX = new Float32Array(capacity)
    this.contactNY = new Float32Array(capacity)
    this.contactVn = new Float32Array(capacity)

    this.lastKernelRadius = params.kernelRadius
    this.lastSpacing = params.particleSpacing
    this.kernels = makeKernels(params.kernelRadius)
    this.restDensity = computeRestDensity(
      params.kernelRadius,
      params.particleSpacing,
    )
    this.grid = this.makeGrid()
  }

  private makeGrid(): SpatialGrid {
    const h = this.params.kernelRadius
    const margin = h * 4
    return new SpatialGrid(
      this.bounds.minX - margin,
      this.bounds.minY - margin,
      this.bounds.maxX + margin,
      this.bounds.maxY + margin,
      h,
      this.capacity,
    )
  }

  private refreshDerived(): void {
    const p = this.params
    if (
      p.kernelRadius !== this.lastKernelRadius ||
      p.particleSpacing !== this.lastSpacing
    ) {
      this.lastKernelRadius = p.kernelRadius
      this.lastSpacing = p.particleSpacing
      this.kernels = makeKernels(p.kernelRadius)
      this.restDensity = computeRestDensity(p.kernelRadius, p.particleSpacing)
      this.grid = this.makeGrid()
    }
  }

  private hasCold = false
  private hasHeat = false
  private hasGrille = false
  private hasSurchauffeur = false
  private coldBoxes: ObstacleBox[] = []
  private heatBoxes: ObstacleBox[] = []
  private grilleBoxes: ObstacleBox[] = []
  private chemBoxes: ObstacleBox[] = [] // parois neutres + hydrophile/phobe (bandes et amortis)
  private surchIdx: number[] = [] // indices des surchauffeurs dans boxes
  private heatCarry = 0
  private gasIdleCarry = 0
  private baseBoxes: ObstacleBox[] = []
  private grilleCarry = 0
  // Recondensation (§7.3) : chaque particule de vapeur perdue alimente une
  // réserve ; les plaques froides la rendent en rosée, avec perte.
  vaporBank = 0
  roseePerlee = 0 // gouttes de rosée effectivement perlées (trophée)
  // Le REPÈRE DU GEL (pour le rendu) : centre et angle intégré de la plus
  // grosse composante gelée — les facettes cristallines (et tout motif
  // « collé au palet ») translatent ET tournent avec le bloc, au lieu de
  // nager dans le volume. Remis à zéro au dégel complet.
  gelCentreX = 0
  gelCentreY = 0
  gelAngle = 0
  private recondCarry = 0
  private recondYield = 0
  private recondSeed = 1
  // Règle de transformation : la dispersion se constate, elle ne se décrète
  // pas — il faut rester sous le seuil critique dispersalGrace secondes
  // d'affilée, le temps qu'un corps qui condense ou dégèle se regroupe.
  // Publics : le HUD lit le danger pour afficher le compte à rebours.
  belowCritical = false
  // GOUTTES EN PRÊT : tirées (délai de réabsorption en cours) mais encore
  // DANS le volume du corps — même composante connexe. La règle de la vie :
  // n'est perdu que ce qui SORT du volume. Tant que la goutte n'a pas
  // traversé la surface, elle compte : la jauge ne bouge pas pour un tir
  // qu'un mur renvoie, elle baisse à l'instant précis où la goutte sort.
  enPretCount = 0
  criticalTimer = 0

  setLevel(boxes: ObstacleBox[], sponges: SpongeDef[]): void {
    this.baseBoxes = boxes
    this.boxes = boxes
    this.sponges = sponges.map((d) => new Sponge(d))
    this.refreshBoxCaches()
    this.surchauffesVides.clear()
    this.codexContacts.fill(0)
  }

  // Listes de boîtes par famille, recalculées quand le niveau change (jamais
  // par pas) : les passes d'aura et de chimie balayaient TOUTES les boîtes
  // pour CHAQUE particule à CHAQUE pas — sur un tableau chargé, l'essentiel
  // du parcours ne concernait pas le matériau cherché.
  private refreshBoxCaches(): void {
    const boxes = this.boxes
    this.hasCold = boxes.some((b) => b.material === MAT_FROID)
    this.hasHeat = boxes.some((b) => b.material === MAT_CHAUD)
    this.hasGrille = boxes.some((b) => b.material === MAT_GRILLE)
    this.hasSurchauffeur = boxes.some((b) => b.material === MAT_SURCHAUFFEUR)
    this.coldBoxes = boxes.filter((b) => b.material === MAT_FROID)
    this.heatBoxes = boxes.filter((b) => b.material === MAT_CHAUD)
    this.grilleBoxes = boxes.filter((b) => b.material === MAT_GRILLE)
    this.chemBoxes = boxes.filter(
      (b) =>
        b.material === MAT_WALL ||
        b.material === MAT_HYDROPHILE ||
        b.material === MAT_HYDROPHOBE,
    )
    this.surchIdx = []
    for (let bi = 0; bi < boxes.length; bi++) {
      if (boxes[bi].material === MAT_SURCHAUFFEUR) this.surchIdx.push(bi)
    }
  }

  // Portes asservies aux cibles laser : des parois qui vont et viennent.
  // Recomposé sans toucher aux éponges (setLevel les reconstruirait et
  // effacerait leur saturation en pleine partie).
  //
  // CES BOÎTES NE SORTENT PAS DU SOLVEUR. Le rendu ne reçoit pas sim.boxes
  // mais renderBoxes (main.ts), bâti sur level.boxes : une porte n'entre
  // jamais dans la carte de lumière, à aucune hauteur. Et c'est juste — une
  // porte close se dessine en BARRIÈRE D'ÉNERGIE translucide, pas en
  // bulkhead : un champ qu'on voit au travers n'a pas à coucher d'ombre.
  // Essayé une fois (marquer la porte « pleine hauteur » pour qu'elle ombre
  // comme un mur) : le drapeau n'atteignait rien, et il n'aurait pas dû.
  setDoors(
    portes: { minX: number; minY: number; maxX: number; maxY: number }[],
  ): void {
    this.boxes = [
      ...this.baseBoxes,
      ...portes.map((p) => ({ ...p, material: MAT_WALL })),
    ]
    this.refreshBoxCaches()
  }

  // Normale de la surface de glace en (x, y), pour le miroir laser. Deux
  // rayons distincts : rHit décide s'il y a CONTACT (précis, à l'échelle
  // d'une particule), rSmooth estime la NORMALE en moyennant sur une zone
  // bien plus large — sans ce lissage, la normale épouse chaque bosse du
  // bloc et le faisceau part dans tous les sens à chaque frémissement.
  // Noyau doux (1 − d/r)², somme des directions (point − particule gelée) :
  // c'est le gradient du champ, la facette moyenne de la surface.
  iceNormalAt(
    x: number,
    y: number,
    rHit: number,
    rSmooth: number,
  ): { nx: number; ny: number } | null {
    let hit = false
    const rHit2 = rHit * rHit
    this.grid.forEachNeighbor(x, y, rHit, (j) => {
      if (this.frozen[j] !== 1) return
      const dx = x - this.posX[j]
      const dy = y - this.posY[j]
      if (dx * dx + dy * dy < rHit2) hit = true
    })
    if (!hit) return null
    let sx = 0
    let sy = 0
    const rs = Math.max(rSmooth, rHit)
    const rs2 = rs * rs
    this.grid.forEachNeighbor(x, y, rs, (j) => {
      if (this.frozen[j] !== 1) return
      const dx = x - this.posX[j]
      const dy = y - this.posY[j]
      const d2 = dx * dx + dy * dy
      if (d2 >= rs2) return
      const t = 1 - Math.sqrt(d2) / rs
      const w = t * t
      sx += dx * w
      sy += dy * w
    })
    const l = Math.hypot(sx, sy)
    if (l < 1e-6) return { nx: 0, ny: 1 } // au cœur du bloc : normale arbitraire
    return { nx: sx / l, ny: sy / l }
  }

  // Le point (x, y) baigne-t-il dans l'eau LIQUIDE ? Test de milieu du
  // traceur laser (palier 2), appelé à chaque pas de marche. LISSÉ comme le
  // miroir : au lieu d'un contact binaire au grain près (qui faisait
  // clignoter le dioptre sur le clapot et dévier le rayon sur la moindre
  // gouttelette), on somme un noyau (1 − d/r)² et on compare à la moitié du
  // poids d'un intérieur plein — la surface effective est l'isoligne de
  // densité, plane là où le corps est plan. Une goutte isolée ne pèse pas
  // assez : elle ne réfracte plus. Glace et vapeur ne comptent pas.
  liquidAt(x: number, y: number, r: number): boolean {
    let somme = 0
    const r2 = r * r
    this.grid.forEachNeighbor(x, y, r, (j) => {
      if (this.frozen[j] === 1 || this.gaseous[j] === 1) return
      const dx = x - this.posX[j]
      const dy = y - this.posY[j]
      const d2 = dx * dx + dy * dy
      if (d2 >= r2) return
      const t = 1 - Math.sqrt(d2) / r
      somme += t * t
    })
    // poids d'un intérieur plein (empilement hexagonal de pas h) : n·πr²/6
    const h = this.params.particleSpacing
    const plein = (Math.PI * r * r) / (3 * Math.sqrt(3) * h * h)
    return somme > plein * 0.5
  }

  // Le point (x, y) baigne-t-il dans la VAPEUR du joueur ? Test d'ionisation
  // du traceur laser (palier 3) : un faisceau qui traverse le nuage devient
  // un arc de plasma, capturable par les rails magnétiques.
  gasAt(x: number, y: number, r: number): boolean {
    let hit = false
    const r2 = r * r
    this.grid.forEachNeighbor(x, y, r, (j) => {
      if (this.gaseous[j] !== 1) return
      const dx = x - this.posX[j]
      const dy = y - this.posY[j]
      if (dx * dx + dy * dy < r2) hit = true
    })
    return hit
  }

  // Convoyage magnétique (palier 3) : tant qu'un arc de plasma circule sur
  // un rail, le champ y est actif — la VAPEUR prise dans la bande du rail
  // est entraînée le long de la ligne, dans le sens du tracé, avec un
  // recentrage doux pour prendre les virages. Le nuage voyage sur la ligne
  // de champ ; l'eau et la glace, non ionisables, ne sentent rien.
  // Renvoie le nombre de particules gazeuses encore DANS la bande : tant
  // qu'il est non nul, un nuage voyage sur le rail — l'appelant s'en sert
  // pour maintenir le champ jusqu'à l'arrivée, même rayon éteint.
  railConvoy(
    pts: { x: number; y: number }[],
    band: number,
    accel: number,
    dt: number,
  ): number {
    if (accel <= 0 || band <= 0 || pts.length < 2) return 0
    // Premier passage : qui est dans la bande, et où est le cœur convoyé —
    // les retardataires hors bande seront RAPPELÉS vers lui, pour que le
    // nuage reste UN nuage dans les virages (et quand seul un morceau est
    // pris par le champ, il emmène le reste au lieu de s'en détacher).
    let nBande = 0
    let nTerminus = 0
    let cxB = 0
    let cyB = 0
    const dansBande: boolean[] = []
    const auTerminus: boolean[] = []
    // LIVRÉ : sorti du tube par la bouche. Ni porté, ni rappelé — le champ
    // n'a plus rien à lui dire. Sans cette troisième case, un nuage livré
    // retombait dans la branche « retardataire » et se faisait tirer en
    // arrière vers le cœur encore convoyé : mesuré, il repartait à 1524 u/s.
    const livre: boolean[] = []
    const uxA: number[] = []
    const uyA: number[] = []
    const qxA: number[] = []
    const qyA: number[] = []
    const fin = pts[pts.length - 1]
    // L'AXE DE SORTIE : la direction du dernier tronçon. C'est par là que le
    // convoyage pousse le nuage DEHORS, au lieu de le garer sur le terminus.
    const avantFin = pts[pts.length - 2]
    const lFin = Math.max(1e-6, Math.hypot(fin.x - avantFin.x, fin.y - avantFin.y))
    const sx = (fin.x - avantFin.x) / lFin
    const sy = (fin.y - avantFin.y) / lFin
    for (let i = 0; i < this.count; i++) {
      dansBande[i] = false
      livre[i] = false
      if (this.gaseous[i] !== 1) continue
      const px = this.posX[i]
      const py = this.posY[i]
      // tronçon de la polyligne le plus proche
      let best = Infinity
      let ux = 0
      let uy = 0
      let qx = 0
      let qy = 0
      let sBest = -1
      let qFinDist = 0
      for (let s = 0; s + 1 < pts.length; s++) {
        const a = pts[s]
        const b = pts[s + 1]
        const abx = b.x - a.x
        const aby = b.y - a.y
        const len2 = abx * abx + aby * aby
        if (len2 < 1e-9) continue
        const t = Math.max(
          0,
          Math.min(1, ((px - a.x) * abx + (py - a.y) * aby) / len2),
        )
        const cx = a.x + abx * t
        const cy = a.y + aby * t
        const d2 = (px - cx) * (px - cx) + (py - cy) * (py - cy)
        if (d2 < best) {
          best = d2
          const inv = 1 / Math.sqrt(len2)
          ux = abx * inv
          uy = aby * inv
          qx = cx
          qy = cy
          sBest = s
          qFinDist = Math.hypot(b.x - cx, b.y - cy)
        }
      }
      if (best > band * band) continue
      // LE VIRAGE S'ANTICIPE. Au coude, le tronçon le plus proche pousse
      // dans SON axe — donc TOUT DROIT, au-delà du virage : mesuré au banc,
      // le nuage dépassait le coude et se stabilisait à ~94 u derrière lui
      // (là où la poussée du tronçon et le rappel vers le coin s'annulent),
      // hors bande — et le champ, vidé, lâchait. À moins d'une bande de la
      // fin du tronçon, la poussée TOURNE donc progressivement vers l'axe
      // du tronçon suivant : le nuage entame le virage avant le coin, comme
      // une ligne de champ qui se courbe — elle n'a pas d'angle.
      if (sBest >= 0 && sBest + 2 < pts.length && qFinDist < band) {
        const a2 = pts[sBest + 1]
        const b2 = pts[sBest + 2]
        const l2 = Math.hypot(b2.x - a2.x, b2.y - a2.y)
        if (l2 > 1e-6) {
          const f = 1 - qFinDist / band
          const mx = ux * (1 - f) + ((b2.x - a2.x) / l2) * f
          const my = uy * (1 - f) + ((b2.y - a2.y) / l2) * f
          const ml = Math.hypot(mx, my)
          // deux tronçons à 180° s'annulent : on garde alors l'axe courant
          if (ml > 1e-6) {
            ux = mx / ml
            uy = my / ml
          }
        }
      }
      dansBande[i] = true
      // zone de terminus : le point porté est arrivé en bout de ligne — on
      // n'y pousse plus, on y FREINE (sinon le nuage arrive comme un boulet
      // et la condensation « explose »)
      auTerminus[i] = Math.hypot(qx - fin.x, qy - fin.y) < band * 1.2
      // LIVRÉ : SORTI DU TUBE, ET LÂCHÉ. Le champ tenait le nuage contre le
      // terminus, DANS le tube : le joueur ne pouvait pas l'emmener
      // ailleurs, et reprendre la main voulait dire l'y laisser se
      // condenser — ce que la paroi punissait d'une expulsion (mesuré :
      // 2861 u/s, le corps projeté à 680 u de son point de garage). Le
      // convoyage ne gare donc plus : il LIVRE. Passé la bouche d'une
      // longueur de bande — le rayon du tube, donc dehors pour de bon — le
      // nuage sort du compte de la bande : le champ se relâche de lui-même,
      // l'arc se désionise, et c'est une vapeur ordinaire, dirigeable, qui
      // se condensera où le joueur voudra.
      // revenue sur le corps du rail, loin de la bouche : le champ a de
      // nouveau le droit de la prendre — un second voyage reste possible
      if (!auTerminus[i]) this.livreParChamp[i] = 0
      if (this.livreParChamp[i] === 1) {
        dansBande[i] = false
        livre[i] = true
        continue
      }
      uxA[i] = ux
      uyA[i] = uy
      qxA[i] = qx
      qyA[i] = qy
      nBande++
      if (auTerminus[i]) nTerminus++
      cxB += px
      cyB += py
    }
    if (nBande === 0) return 0
    cxB /= nBande
    cyB /= nBande
    // LA LIVRAISON SE DÉCIDE POUR LE NUAGE, PAS PARTICULE PAR PARTICULE.
    // Lâcher chaque particule dès qu'elle franchissait un seuil ne marchait
    // pas : la tête relâchée faisait barrage, la queue s'entassait derrière,
    // et le nuage se garait SUR le seuil — mesuré, il oscillait à 376 u
    // pour un seuil à 375, et le champ ne se relâchait jamais. Quand le
    // CŒUR du nuage a franchi la bouche, le champ lâche donc TOUT d'un
    // coup : la vapeur, désionisée, s'en va sur son élan de livraison.
    if (
      nTerminus > nBande * 0.6 &&
      (cxB - fin.x) * sx + (cyB - fin.y) * sy > band * 0.3
    ) {
      for (let i = 0; i < this.count; i++)
        if (dansBande[i]) this.livreParChamp[i] = 1
      return 0
    }
    for (let i = 0; i < this.count; i++) {
      if (this.gaseous[i] !== 1) continue
      // LIVRÉ : le champ ne le touche plus, en rien — et l'ionisation ne
      // monte donc plus non plus. C'est voulu, et c'est ce qui se voit :
      // sorti du tube, le nuage se DÉSIONISE (fadeIonise, ~0,5 s) et quitte
      // le blanc-violet de l'arc pour redevenir une vapeur ordinaire, que le
      // joueur dirige. L'arc l'a porté, il l'a rendu.
      if (livre[i]) continue
      const px = this.posX[i]
      const py = this.posY[i]
      if (dansBande[i]) {
        // ce qui voyage dans la bande d'un champ engagé DEVIENT du plasma,
        // en ~0,2 s : l'identité visuelle suit l'état physique, pas le
        // pinceau. La retombée (fadeIonise) fait le chemin inverse.
        this.ionise[i] = Math.min(1, this.ionise[i] + 6 * dt)
      }
      if (dansBande[i] && auTerminus[i]) {
        // L'ARRIVÉE EST UNE LIVRAISON, PAS UN GARAGE. L'ancien terminus
        // freinait et RAMENAIT le nuage sur le dernier point : il y restait
        // collé, dans le tube, et la seule façon de reprendre la main était
        // de le laisser s'y condenser — ce que la paroi punissait d'une
        // expulsion. On règle donc la vitesse AXIALE sur une allure de
        // livraison, et l'on amortit tout le reste : le nuage sort par la
        // bouche, calmement, et se fait lâcher dès qu'il est dehors.
        const vAxe = this.velX[i] * sx + this.velY[i] * sy
        const k = Math.min(1, 6 * dt)
        this.velX[i] += sx * (LIVRAISON_VITESSE - vAxe) * k
        this.velY[i] += sy * (LIVRAISON_VITESSE - vAxe) * k
        // le travers s'éteint : on sort droit, pas en crabe
        const vx = this.velX[i] - (this.velX[i] * sx + this.velY[i] * sy) * sx
        const vy = this.velY[i] - (this.velX[i] * sx + this.velY[i] * sy) * sy
        const frein = 1 - Math.exp(-6 * dt)
        this.velX[i] -= vx * frein
        this.velY[i] -= vy * frein
        // recentrage doux sur l'axe : on sort par la bouche, pas de biais
        this.velX[i] += ((qxA[i] - px) / band) * accel * 0.3 * dt
        this.velY[i] += ((qyA[i] - py) / band) * accel * 0.3 * dt
      } else if (dansBande[i]) {
        // LE CHAMP CONFINE, et c'est lui qui fait prendre les virages. Le
        // rappel seul (0,8 × accel au bord de bande) ne courbe pas une
        // trajectoire lancée : au premier coude, tout l'élan gagné sur la
        // ligne droite pointe HORS du tracé — mesuré au banc (virage à 90°,
        // bande 75) : le nuage ENTIER finissait à 380 u du rail, et le
        // champ, vidé, lâchait pour de bon. On amortit donc la composante
        // de vitesse EN TRAVERS de la ligne (le long, on n'y touche pas :
        // c'est la vitesse du voyage) — une particule chargée s'enroule
        // autour de sa ligne de champ, elle ne la quitte pas.
        const ux = uxA[i]
        const uy = uyA[i]
        const va = this.velX[i] * ux + this.velY[i] * uy
        const g = Math.exp(-this.params.plasmaConfin * dt)
        this.velX[i] = va * ux + (this.velX[i] - va * ux) * g
        this.velY[i] = va * uy + (this.velY[i] - va * uy) * g
        // poussée le long du rail + rappel vers la ligne
        this.velX[i] += (ux + ((qxA[i] - px) / band) * 0.8) * accel * dt
        this.velY[i] += (uy + ((qyA[i] - py) / band) * 0.8) * accel * dt
      } else {
        // retardataire : rappelé vers le cœur convoyé — le nuage fait corps
        const dx = cxB - px
        const dy = cyB - py
        const d = Math.hypot(dx, dy)
        if (d > 1e-6 && d < band * 6) {
          this.velX[i] += (dx / d) * accel * 0.7 * dt
          this.velY[i] += (dy / d) * accel * 0.7 * dt
        }
      }
    }
    return nBande
  }

  // Normale de la surface d'EAU en (x, y), pour le dioptre du laser — la
  // même recette que le miroir de glace : moyenne large au noyau (1 − d/r)²,
  // parce qu'une surface de particules est encore plus agitée liquide que
  // gelée. Appelée seulement au franchissement d'un dioptre.
  liquidNormalAt(
    x: number,
    y: number,
    rSmooth: number,
  ): { nx: number; ny: number } {
    let sx = 0
    let sy = 0
    const rs2 = rSmooth * rSmooth
    this.grid.forEachNeighbor(x, y, rSmooth, (j) => {
      if (this.frozen[j] === 1 || this.gaseous[j] === 1) return
      const dx = x - this.posX[j]
      const dy = y - this.posY[j]
      const d2 = dx * dx + dy * dy
      if (d2 >= rs2) return
      const t = 1 - Math.sqrt(d2) / rSmooth
      const w = t * t
      sx += dx * w
      sy += dy * w
    })
    const l = Math.hypot(sx, sy)
    if (l < 1e-6) return { nx: 0, ny: 1 } // au cœur du corps : normale arbitraire
    return { nx: sx / l, ny: sy / l }
  }

  // Exposition à la chaleur en (x, y) : 1 au contact d'une chaudière, 0 au
  // bord de l'aura. Même géométrie que l'aura de gel des plaques froides.
  private heatExposureAt(x: number, y: number): number {
    if (!this.hasHeat) return 0
    // le vaisseau refroidit : l'aura des chaudières se rétracte
    const band =
      this.params.heatBand * (1 - this.params.chillHeatFade * this.chill)
    if (band <= 1) return 0
    const rp = this.params.particleSpacing * 0.5
    const cp = this.scratchCP
    let heat = 0
    for (const b of this.heatBoxes) {
      // chaque chaudière règle la portée de sa propre aura (éditeur) :
      // un gros bloc à petite aura, un petit bloc qui chauffe loin
      const bandB = band * (b.aura ?? 1)
      if (bandB <= 1) continue
      if (horsBoite(b, x, y, bandB + rp)) continue
      boxContact(x, y, b, cp)
      const f = 1 - Math.max(0, cp.dist - rp) / bandB
      if (f > heat) heat = Math.min(1, f)
    }
    return heat
  }

  // Le SURCHAUFFEUR le plus proche que ce point frôle ou touche (index de
  // boîte), ou -1. « Frôler » : à moins de deux espacements de particule de
  // la paroi — pas besoin de s'écraser dessus.
  private surchauffeurFrole(x: number, y: number): number {
    const reach = this.params.particleSpacing * 2
    const cp = this.scratchCP
    for (const bi of this.surchIdx) {
      const b = this.boxes[bi]
      if (horsBoite(b, x, y, reach)) continue
      boxContact(x, y, b, cp)
      if (cp.dist <= reach) return bi
    }
    return -1
  }

  // Retrait par échange avec la dernière particule (absorption éponge).
  removeParticle(i: number): void {
    if (this.kind[i] === KIND_PLAYER) this.playerCount--
    // une goutte en prêt avalée (éponge, balayage) quitte la vie sur-le-champ :
    // sans ce décrément, liters() reste gonflé jusqu'au prochain relabel
    if (this.duCorps[i] === 2)
      this.enPretCount = Math.max(0, this.enPretCount - 1)
    this.iceDirty = true // l'échange d'indices invalide le cache d'amas
    const last = this.count - 1
    if (i !== last) {
      this.posX[i] = this.posX[last]
      this.posY[i] = this.posY[last]
      this.prdX[i] = this.prdX[last]
      this.prdY[i] = this.prdY[last]
      this.velX[i] = this.velX[last]
      this.velY[i] = this.velY[last]
      this.kind[i] = this.kind[last]
      this.cooldown[i] = this.cooldown[last]
      this.contactTime[i] = this.contactTime[last]
      this.frost[i] = this.frost[last]
      this.frozen[i] = this.frozen[last]
      this.vapor[i] = this.vapor[last]
      this.ionise[i] = this.ionise[last]
      this.gaseous[i] = this.gaseous[last]
      this.gasLink[i] = this.gasLink[last]
      this.welded[i] = this.welded[last]
      this.souffle[i] = this.souffle[last]
      this.duCorps[i] = this.duCorps[last]
    }
    this.count = last
  }

  addParticle(x: number, y: number, kind: number): number {
    if (this.count >= this.capacity) return -1
    const i = this.count++
    this.posX[i] = x
    this.posY[i] = y
    this.velX[i] = 0
    this.velY[i] = 0
    this.kind[i] = kind
    this.cooldown[i] = 0
    this.contactTime[i] = 0
    this.frost[i] = 0
    this.frozen[i] = 0
    this.vapor[i] = 0
    this.ionise[i] = 0
    this.gaseous[i] = 0
    this.gasLink[i] = 0
    this.welded[i] = 0
    this.souffle[i] = 0
    this.duCorps[i] = 0
    if (kind === KIND_PLAYER) this.playerCount++
    return i
  }

  // Disque de n particules sur réseau hexagonal, centré en (cx, cy).
  spawnDisc(cx: number, cy: number, n: number, kind: number): void {
    const s = this.params.particleSpacing
    const rowH = s * Math.sqrt(3) * 0.5
    const extent = Math.ceil(Math.sqrt(n)) + 2
    const pts: { x: number; y: number; d2: number }[] = []
    for (let row = -extent; row <= extent; row++) {
      const y = row * rowH
      const xOffset = (row & 1) !== 0 ? s * 0.5 : 0
      for (let col = -extent; col <= extent; col++) {
        const x = col * s + xOffset
        pts.push({ x, y, d2: x * x + y * y })
      }
    }
    pts.sort((a, b) => a.d2 - b.d2)
    for (let i = 0; i < n && i < pts.length; i++) {
      this.addParticle(cx + pts[i].x, cy + pts[i].y, kind)
    }
    if (kind === KIND_PLAYER) this.baseVolume += n
    this.updatePlayerStats()
  }

  /** VERSER n particules AU CORPS : le même réseau hexagonal que spawnDisc,
   * centré en (cx, cy), mais chaque position déjà PRISE est sautée — une
   * particule existante à moins d'un pas, une paroi, une cellule d'éponge
   * gorgée, le bord de la cuve. Sans ce tri, verser la bonbonne posait la
   * matière EN PLEIN CŒUR du corps : la contrainte de densité expulsait
   * tout d'un coup et le versement EXPLOSAIT le volume au lieu de le
   * regonfler. La matière s'installe donc en couronne, dans les creux
   * autour du corps, et part à sa vitesse moyenne (le versement suit le
   * mouvement, il ne le freine pas). Renvoie le nombre réellement posé. */
  verserAuCorps(cx: number, cy: number, n: number, kind: number): number {
    const s = this.params.particleSpacing
    const rowH = s * Math.sqrt(3) * 0.5
    const seuil2 = (0.9 * s) ** 2
    const rp = s * 0.5
    const cp = this.scratchCP
    this.updatePlayerStats()
    const mvx = this.stats.velX
    const mvy = this.stats.velY
    const libre = (px: number, py: number): boolean => {
      if (
        px < this.bounds.minX + rp ||
        px > this.bounds.maxX - rp ||
        py < this.bounds.minY + rp ||
        py > this.bounds.maxY - rp
      ) {
        return false
      }
      for (let i = 0; i < this.count; i++) {
        const dx = this.posX[i] - px
        if (dx * dx > seuil2) continue
        const dy = this.posY[i] - py
        if (dx * dx + dy * dy < seuil2) return false
      }
      for (const b of this.boxes) {
        boxContact(px, py, b, cp)
        if (cp.dist < rp) return false
      }
      for (const sp of this.sponges) {
        if (!sp.contains(px, py)) continue
        const cell = sp.cellIndexAt(px, py)
        if (cell >= 0 && sp.isSolid(cell)) return false
      }
      return true
    }
    let poses = 0
    // l'étendue GRANDIT tant qu'il reste à poser : le cœur du réseau est
    // occupé par le corps lui-même, les places libres sont plus loin
    let extent = Math.ceil(Math.sqrt(n)) + 2
    for (let essai = 0; essai < 6 && poses < n; essai++) {
      const pts: { x: number; y: number; d2: number }[] = []
      for (let row = -extent; row <= extent; row++) {
        const y = row * rowH
        const xOffset = (row & 1) !== 0 ? s * 0.5 : 0
        for (let col = -extent; col <= extent; col++) {
          const x = col * s + xOffset
          pts.push({ x, y, d2: x * x + y * y })
        }
      }
      pts.sort((a, b) => a.d2 - b.d2)
      for (const pt of pts) {
        if (poses >= n) break
        const px = cx + pt.x
        const py = cy + pt.y
        if (!libre(px, py)) continue
        const idx = this.addParticle(px, py, kind)
        if (idx < 0) break // capacité atteinte : on s'arrête là
        this.velX[idx] = mvx
        this.velY[idx] = mvy
        poses++
      }
      extent = Math.ceil(extent * 1.4) + 1
    }
    // LE VOLUME DE DÉPART NE GRANDIT PAS QUAND ON LE REJOINT. Cette ligne
    // faisait `baseVolume += poses`, et c'était un défaut à soi seul : la
    // jauge de vie affiche `playerCount / baseVolume`, donc verser gonflait
    // le NUMÉRATEUR et le DÉNOMINATEUR ensemble — le corps revenait à son
    // plein pendant que la barre, elle, montrait de moins en moins. MESURÉ
    // au hub, quatre versements d'affilée : base 900 → 967 → 1035 → 1104 →
    // 1176, soit une jauge tombée à 76 % pour un corps pourtant PLEIN. Le
    // seuil critique dessiné sur la jauge dérivait avec elle. Le volume de
    // départ est celui du DÉPART : seul spawnDisc le pose.
    this.updatePlayerStats()
    return poses
  }

  // Le verbe unique (§3.3) : la matière part vers le point visé, le corps part
  // à l'opposé. Conservation exacte : la réaction est répartie uniformément
  // sur les particules restantes du corps.
  eject(aimX: number, aimY: number, dt: number): void {
    if (this.dispersed) return
    const p = this.params
    this.ejectCarry += p.ejectRate * dt
    while (this.ejectCarry >= 1) {
      this.ejectCarry -= 1
      if (this.playerCount <= 1) {
        this.dispersed = true
        return
      }
      // L'ÉLECTION HISTORIQUE, restaurée à la demande du concepteur : la
      // particule LA PLUS PROCHE DU DOIGT part vers le doigt. Un tir posé
      // sur la flaque élit une particule au cœur de la masse et la propulse
      // à travers elle : le volume est LABOURÉ, malaxé — c'est brutal, et
      // c'est exactement le caractère voulu (« je préfère avec les
      // déformations »). Une élection « propre depuis la surface » a été
      // essayée puis retirée : elle assagissait le tir rapproché. Ce qui
      // rendait l'ancienne règle infernale n'était pas sa physique mais son
      // INVISIBILITÉ — depuis, les gouttes libres se dessinent (traînées),
      // la vie compte le halo, et le rappel ramène les éclats restés à
      // portée : le labour se voit et se paie au juste prix, rien de plus.
      let best = -1
      let bestD2 = Infinity
      for (let i = 0; i < this.count; i++) {
        if (
          this.kind[i] !== KIND_PLAYER ||
          this.frozen[i] === 1 ||
          this.gaseous[i] === 1
        )
          continue
        const dx = this.posX[i] - aimX
        const dy = this.posY[i] - aimY
        const d2 = dx * dx + dy * dy
        if (d2 < bestD2) {
          bestD2 = d2
          best = i
        }
      }
      if (best < 0) return // tout le corps est gelé : temps mort, rien à éjecter

      let dirX = aimX - this.posX[best]
      let dirY = aimY - this.posY[best]
      let len = Math.hypot(dirX, dirY)
      if (len < 1e-6) {
        dirX = aimX - this.stats.centroidX
        dirY = aimY - this.stats.centroidY
        len = Math.hypot(dirX, dirY)
        if (len < 1e-6) {
          dirX = 1
          dirY = 0
          len = 1
        }
      }
      dirX /= len
      dirY /= len

      const departX = this.posX[best]
      const departY = this.posY[best]
      const newVx = this.stats.velX + dirX * p.ejectSpeed
      const newVy = this.stats.velY + dirY * p.ejectSpeed
      const dvx = newVx - this.velX[best]
      const dvy = newVy - this.velY[best]
      this.velX[best] = newVx
      this.velY[best] = newVy
      // La gouttelette décolle hors de la couche de surface : sans ce
      // décalage, elle traverse ses voisines à pleine vitesse au pas suivant
      // et la projection PBF injecte de l'énergie dans le corps.
      this.posX[best] += dirX * p.kernelRadius * 0.8
      this.posY[best] += dirY * p.kernelRadius * 0.8
      this.kind[best] = KIND_FREE
      this.cooldown[best] = p.reabsorbCooldown * this.reabsorbFactor
      // créditée VIVANTE à l'instant même du tir : elle part de la surface,
      // donc du halo — la jauge ne cille pas d'une image, elle ne baissera
      // qu'à la SORTIE réelle (constatée au relabel suivant)
      this.duCorps[best] = 2
      this.enPretCount++
      this.playerCount--

      // Entraînement du voisinage : le liquide voisin CONVERGE vers le point
      // d'émission (radialement, comme l'entonnoir qui alimente une buse) —
      // le corps se creuse sans recevoir de poussée dans le sens du jet.
      // Pousser les voisines dans la direction de l'éjection annulerait
      // localement le recul : la déformation de propulsion disparaîtrait.
      let entrainX = 0
      let entrainY = 0
      if (p.ejectEntrain > 0 && this.playerCount > 0) {
        const R = p.kernelRadius * 1.8
        const R2 = R * R
        for (let i = 0; i < this.count; i++) {
          if (
            this.kind[i] !== KIND_PLAYER ||
            this.frozen[i] === 1 ||
            this.gaseous[i] === 1
          )
            continue
          const dx = departX - this.posX[i]
          const dy = departY - this.posY[i]
          const d2 = dx * dx + dy * dy
          if (d2 >= R2 || d2 < 1e-6) continue
          const d = Math.sqrt(d2)
          const w = 1 - d / R
          const a = (p.ejectSpeed * p.ejectEntrain * w) / d
          const ax = dx * a
          const ay = dy * a
          this.velX[i] += ax
          this.velY[i] += ay
          entrainX += ax
          entrainY += ay
        }
      }

      // Réaction : conservation exacte, entraînement compris. Le recul est
      // pondéré vers le point d'éjection (recoilLocality) — à 0 il est
      // uniforme et le corps part d'un bloc comme un solide ; à 1 il est
      // concentré à l'émission et se propage par pression : le côté éjection
      // s'écrase d'abord, le corps se déforme en accélérant.
      const locality = Math.min(1, Math.max(0, p.recoilLocality))
      const localR = p.kernelRadius * 3
      let wSum = 0
      let liquid = 0
      for (let i = 0; i < this.count; i++) {
        if (
          this.kind[i] !== KIND_PLAYER ||
          this.frozen[i] === 1 ||
          this.gaseous[i] === 1
        )
          continue
        liquid++
        let w = 1 - locality
        const dx = this.posX[i] - departX
        const dy = this.posY[i] - departY
        const d = Math.hypot(dx, dy)
        if (d < localR) w += locality * (1 - d / localR)
        this.dvX[i] = w // scratch : poids de recul (dvX est libre hors step)
        wSum += w
      }
      if (wSum < 1e-6) {
        if (liquid === 0) continue // le reste du corps est gelé : la glace encaisse le recul
        // corps entier hors du rayon local (improbable) : repli uniforme
        wSum = liquid
        for (let i = 0; i < this.count; i++) {
          if (
            this.kind[i] === KIND_PLAYER &&
            this.frozen[i] === 0 &&
            this.gaseous[i] === 0
          ) {
            this.dvX[i] = 1
          }
        }
      }
      const rx = -(dvx + entrainX) / wSum
      const ry = -(dvy + entrainY) / wSum
      for (let i = 0; i < this.count; i++) {
        if (
          this.kind[i] === KIND_PLAYER &&
          this.frozen[i] === 0 &&
          this.gaseous[i] === 0
        ) {
          this.velX[i] += rx * this.dvX[i]
          this.velY[i] += ry * this.dvX[i]
        }
      }
    }
  }

  // L'impulsion SANS direction (stick au neutre, doigt posé sur le corps)
  // se retourne vers l'intérieur : le corps se RASSEMBLE autour de son
  // centre au lieu d'éjecter. Rien ne part, rien ne se paie — chaque
  // particule du corps est rappelée vers le centre, sa fuite radiale est
  // amortie, et les gouttes LIBRES du voisinage immédiat (hors délai de
  // réabsorption) sont ramenées avec lui : le volume se REFORME, fragments
  // compris. Le rappel est interne : la quantité de mouvement d'ensemble est
  // préservée exactement (la dérive du corps reste une trajectoire).
  rassemble(dt: number): void {
    if (this.dispersed) return
    const p = this.params
    const cx = this.stats.centroidX
    const cy = this.stats.centroidY
    const rappel = p.regroupAccel * dt
    const keep = Math.exp(-p.regroupDamp * dt)
    // Rayon de capture des gouttes LIBRES : le voisinage immédiat du corps.
    // Un fragment que la contraction vient de détacher est ramené au bercail ;
    // une goutte d'éjection encore sous délai de réabsorption reste perdue —
    // l'économie de la propulsion ne change pas.
    const capture = Math.max(this.stats.rmsRadius * 2.5, p.kernelRadius * 6)
    const capture2 = capture * capture
    let sumX = 0
    let sumY = 0
    let n = 0
    for (let i = 0; i < this.count; i++) {
      this.dvX[i] = 0 // scratch : 1 = rappelée ce pas-ci (dvX est libre hors step)
      if (this.frozen[i] === 1 || this.gaseous[i] === 1) continue
      if (this.kind[i] !== KIND_PLAYER) {
        if (this.kind[i] !== KIND_FREE || this.cooldown[i] > 0) continue
        const fx = cx - this.posX[i]
        const fy = cy - this.posY[i]
        if (fx * fx + fy * fy > capture2) continue
      }
      this.dvX[i] = 1
      n++
      const dx = cx - this.posX[i]
      const dy = cy - this.posY[i]
      const d = Math.hypot(dx, dy)
      if (d < 1e-6) continue
      const ux = dx / d
      const uy = dy / d
      // rappel proportionné à l'éloignement : doux au cœur (le corps ne
      // s'écrase pas sur lui-même), plein au-delà de trois rayons de noyau
      const g = Math.min(1, d / (p.kernelRadius * 3))
      let ivx = ux * rappel * g
      let ivy = uy * rappel * g
      // la composante de vitesse qui FUIT le centre est amortie : c'est elle
      // qui étale le corps — la composante rentrante et l'élan commun restent
      const vr = this.velX[i] * ux + this.velY[i] * uy // < 0 : s'éloigne
      if (vr < 0) {
        const cut = -vr * (1 - keep)
        ivx += ux * cut
        ivy += uy * cut
      }
      this.velX[i] += ivx
      this.velY[i] += ivy
      sumX += ivx
      sumY += ivy
    }
    if (n === 0) return
    const mx = sumX / n
    const my = sumY / n
    for (let i = 0; i < this.count; i++) {
      if (this.dvX[i] !== 1) continue
      this.velX[i] -= mx
      this.velY[i] -= my
    }
  }

  // Le dash de vapeur (« air dash » à la Ori) : UNE impulsion qui envoie
  // tout le nuage vers le point visé — pas de recul, pas d'éjection, pas de
  // pilotage continu. Les impulsions sont COMPTÉES : la réserve est pleine
  // au chargement du tableau, une vaporisation DÉCIDÉE refait le plein, et
  // un surchauffeur frôlé en rend une. Renvoie 1 si le dash part, 0 sinon.
  // La TRANSFORMATION en vapeur — touche, chaudière à 95 %, zone forcée :
  // toute cause confondue — se paie à l'instant du basculement : une
  // fraction du volume actif (vaporTollFrac, 20 %) part en gouttes éjectées
  // à grande vitesse dans TOUTES les directions. C'est la même matière que
  // la propulsion : récupérable, elle perlera aussi en rosée au froid. La
  // quantité de mouvement d'ensemble est conservée exactement.
  // `rendDashs` : une bascule DÉCIDÉE (touche G, bouton VAPEUR) refait le
  // plein de la réserve — elle se paie en volume, c'est son prix. Une
  // transformation SUBIE — chaudière, zone qui impose la vapeur — ne rend
  // RIEN : sinon la salle vaudrait ferme à dashs (aller-retour devant la
  // chaudière = réserve infinie, sans rien décider).
  /** Le corps NAÎT nuage. Un tableau qui commence en vapeur n'a pas à
   *  attendre la vaporisation progressive : sans cela, le compteur annonce
   *  ses dashs pendant que le corps est encore liquide — et aucun ne part
   *  (le dash exige de la vapeur). L'état est la condition de départ. */
  naitEnVapeur(): void {
    for (let i = 0; i < this.count; i++) {
      if (this.kind[i] !== KIND_PLAYER) continue
      this.vapor[i] = 1
      this.gaseous[i] = 1
      this.gasLink[i] = 1
      this.frost[i] = 0
      this.frozen[i] = 0
    }
  }

  transfoVapeur(rendDashs = true): void {
    if (this.dispersed) return
    const p = this.params
    if (rendDashs) this.dashBudget = this.dashBudgetMax
    this.updatePlayerStats()
    const toll = Math.floor(
      this.playerCount * p.vaporTollFrac * this.vaporTollFactor,
    )
    if (toll <= 0) return
    const cx = this.stats.centroidX
    const cy = this.stats.centroidY
    // la ponction se répartit dans tout le corps (une particule sur k) :
    // la gerbe part en étoile, pas d'un seul flanc
    const stride = Math.max(1, Math.floor(this.playerCount / toll))
    const v = p.ejectSpeed * 0.85
    let dvxSum = 0
    let dvySum = 0
    let pris = 0
    let vus = 0
    for (let i = 0; i < this.count && pris < toll; i++) {
      if (this.kind[i] !== KIND_PLAYER || this.frozen[i] === 1) continue
      vus++
      if (vus % stride !== 0) continue
      let ux = this.posX[i] - cx
      let uy = this.posY[i] - cy
      const d = Math.hypot(ux, uy)
      if (d < 1e-6) {
        const a = (i * 2.399963) % (Math.PI * 2) // angle d'or : gerbe régulière
        ux = Math.cos(a)
        uy = Math.sin(a)
      } else {
        ux /= d
        uy /= d
      }
      const dvx = this.stats.velX + ux * v - this.velX[i]
      const dvy = this.stats.velY + uy * v - this.velY[i]
      this.velX[i] += dvx
      this.velY[i] += dvy
      // décoller hors de la couche de surface, comme l'éjection (§3.3)
      this.posX[i] += ux * p.kernelRadius * 0.8
      this.posY[i] += uy * p.kernelRadius * 0.8
      this.kind[i] = KIND_FREE
      this.cooldown[i] = p.reabsorbCooldown * this.reabsorbFactor
      this.duCorps[i] = 2 // gerbe de péage : part du halo, vivante jusqu'à la sortie
      this.enPretCount++
      this.playerCount--
      dvxSum += dvx
      dvySum += dvy
      pris++
    }
    // réaction répartie sur le corps restant : la gerbe est quasi symétrique,
    // le solde est faible — on le rend quand même (conservation exacte)
    if (pris > 0 && this.playerCount > 0) {
      let libres = 0
      for (let i = 0; i < this.count; i++) {
        if (this.kind[i] === KIND_PLAYER && this.frozen[i] === 0) libres++
      }
      if (libres > 0) {
        const rx = -dvxSum / libres
        const ry = -dvySum / libres
        for (let i = 0; i < this.count; i++) {
          if (this.kind[i] === KIND_PLAYER && this.frozen[i] === 0) {
            this.velX[i] += rx
            this.velY[i] += ry
          }
        }
      }
    }
  }

  gasDash(aimX: number, aimY: number): number {
    if (this.dispersed) return 0
    const p = this.params
    this.updatePlayerStats()
    let dx = aimX - this.stats.centroidX
    let dy = aimY - this.stats.centroidY
    const d = Math.hypot(dx, dy)
    if (d < 1e-3) return 0
    dx /= d
    dy /= d
    // La distance du pointeur règle la puissance : pleine à gasDashRange,
    // dégressive en deçà — viser près du corps donne un petit bond, viser
    // loin donne le dash entier, et au-delà rien de plus.
    const power = Math.min(1, d / Math.max(1, p.gasDashRange))
    let gasCount = 0
    for (let i = 0; i < this.count; i++) {
      if (this.kind[i] === KIND_PLAYER && this.gaseous[i] === 1) gasCount++
    }
    if (gasCount < 3) return 0
    // le dash se COMPTE, il ne se paie pas en volume : le prix a été payé à
    // la transformation (péage de vaporisation)
    if (this.dashBudget <= 0) {
      return 0 // à sec : condenser et se retransformer, ou un surchauffeur
    }
    this.dashBudget--

    // ——— LE SOUFFLE : on avance parce qu'on REJETTE ————————————————
    // La queue du nuage (le plus loin DERRIÈRE, dans l'axe du dash) est
    // chassée vers l'arrière et cesse de vous appartenir. Elle se disperse,
    // et la vapeur qui n'est plus à vous perle sur la première paroi
    // touchée : des gouttes à aller rechercher — ou à laisser derrière soi.
    const part = Math.max(0, Math.min(0.5, p.gasDashExhaust))
    // jamais au point de dissoudre le corps : un plancher de nuage reste
    const chassables = Math.max(0, gasCount - 12)
    const souffle = Math.min(chassables, Math.round(gasCount * part))
    if (souffle > 0) {
      // les candidats, triés par projection sur l'ARRIÈRE du dash
      const queue: { i: number; d: number }[] = []
      for (let i = 0; i < this.count; i++) {
        if (this.kind[i] !== KIND_PLAYER || this.gaseous[i] !== 1) continue
        const rx = this.posX[i] - this.stats.centroidX
        const ry = this.posY[i] - this.stats.centroidY
        queue.push({ i, d: -(rx * dx + ry * dy) }) // grand = bien en arrière
      }
      queue.sort((a, b) => b.d - a.d)
      const vSouffle =
        p.gasDashSpeed * power * Math.max(0, p.gasDashExhaustSpeed)
      for (let k = 0; k < souffle && k < queue.length; k++) {
        const i = queue[k].i
        // évantail : le souffle s'ouvre au lieu de partir en trait
        this.recondSeed = (this.recondSeed * 48271) % 2147483647
        const ecart = (this.recondSeed / 2147483647 - 0.5) * 0.7
        const co = Math.cos(ecart)
        const si = Math.sin(ecart)
        const ex = -dx * co - -dy * si
        const ey = -dx * si + -dy * co
        this.velX[i] = ex * vSouffle
        this.velY[i] = ey * vSouffle
        this.kind[i] = KIND_FREE
        this.cooldown[i] = p.reabsorbCooldown * this.reabsorbFactor
        this.duCorps[i] = 0 // chassé : ce souffle ne vous appartient plus
        this.souffle[i] = 4 // 4 s de vol : le temps de traverser une salle
        this.playerCount--
      }
      this.updatePlayerStats()
    }

    for (let i = 0; i < this.count; i++) {
      if (this.kind[i] !== KIND_PLAYER || this.gaseous[i] !== 1) continue
      this.velX[i] = dx * p.gasDashSpeed * power
      this.velY[i] = dy * p.gasDashSpeed * power
    }
    return 1
  }

  // Vortex de regroupement (clic droit) : l'eau est entraînée vers un champ
  // de courant en spirale rentrante. Un champ de vitesses cible (plutôt que
  // des forces) garantit la convergence : une force tourbillonnaire pure
  // ferait orbiter les gouttes jusqu'à les éjecter du rayon d'action.
  // La rotation rallonge la spirale : plus de tourbillon = retour plus lent.
  //
  // `life` est la vie restante du vortex (1 → 0). Sur la fraction finale
  // (vortexWindDown), le courant s'essouffle : le champ tend vers zéro mais
  // l'entraînement reste — le vortex freine l'eau et la dépose immobile.
  // Sans cette retombée, l'eau regroupée est lâchée en pleine giration et la
  // force centrifuge fait éclater le corps dès que le champ disparaît.
  applyVortex(cx: number, cy: number, dt: number, life = 1): void {
    const p = this.params
    const R = p.vortexRadius
    const R2 = R * R
    const fade = p.vortexWindDown > 0 ? Math.min(1, life / p.vortexWindDown) : 1
    // La vitesse du courant se répartit entre rentrant et giratoire
    const inv = 1 / Math.sqrt(1 + p.vortexSwirl * p.vortexSwirl)
    const vIn = p.vortexPull * inv * fade
    const vTan = p.vortexPull * p.vortexSwirl * inv * fade
    // L'entraînement se renforce à mesure que le courant faiblit : l'eau suit
    // le champ mourant sans retard et se fige au lieu de garder son élan.
    const drag = p.vortexDrag / Math.max(0.15, fade)
    const blend = 1 - Math.exp(-drag * dt)
    for (let i = 0; i < this.count; i++) {
      // Le sas aspire les trois états. La glace a plus d'inertie : le courant
      // a moins de prise sur elle, mais il finit par l'emporter.
      const grip = this.frozen[i] === 1 ? 0.45 : 1
      const dx = cx - this.posX[i]
      const dy = cy - this.posY[i]
      const d2 = dx * dx + dy * dy
      if (d2 >= R2 || d2 < 1e-6) continue
      const d = Math.sqrt(d2)
      const ux = dx / d
      const uy = dy / d
      const rim = Math.min(1, (1 - d / R) * 2) // fondu au bord du rayon d'action
      const settle = Math.min(1, d / (R * 0.08)) // l'eau se pose au centre au lieu d'osciller
      // Cœur en rotation « corps solide » (vortex de Rankine) : sans lui,
      // l'eau trouve une orbite d'équilibre (r ≈ vTan²/(drag·vIn)) et tourne
      // sans jamais entrer. Le cœur doit englober ce rayon d'équilibre.
      const tanScale = Math.min(1, d / (R * 0.5))
      const tx = (ux * vIn * settle - uy * vTan * tanScale) * rim
      const ty = (uy * vIn * settle + ux * vTan * tanScale) * rim
      this.velX[i] += (tx - this.velX[i]) * blend * grip
      this.velY[i] += (ty - this.velY[i]) * blend * grip
    }
  }

  // Le sas est une bouche d'aspiration : dans son rayon d'action, un courant
  // permanent entraîne l'eau vers le trou, en spirale rentrante (entonnoir).
  // Même modèle en champ de vitesses que le vortex — une force pure ferait
  // orbiter l'eau autour de la bouche sans jamais y entrer. Contrairement au
  // vortex, le courant se renforce à l'approche du trou, comme une vidange,
  // et il n'y a pas de retombée : le trou avale, il ne dépose pas.
  applyExitSuction(cx: number, cy: number, dt: number): void {
    const p = this.params
    const R = p.exitRadius * this.exitRadiusFactor
    this.mouthX = cx
    this.mouthY = cy
    this.drainOn = R > 0 && p.exitPull > 0
    if (!this.drainOn) return
    const R2 = R * R
    const inv = 1 / Math.sqrt(1 + p.exitSwirl * p.exitSwirl)
    // Entraînement fixe : le courant du sas est permanent, l'eau le suit
    // franchement sans qu'un curseur de plus soit nécessaire.
    const blend = 1 - Math.exp(-4 * dt)
    for (let i = 0; i < this.count; i++) {
      const dx = cx - this.posX[i]
      const dy = cy - this.posY[i]
      const d2 = dx * dx + dy * dy
      if (d2 >= R2 || d2 < 1e-6) continue
      const d = Math.sqrt(d2)
      const ux = dx / d
      const uy = dy / d
      const rim = Math.min(1, (1 - d / R) * 2) // fondu au bord du rayon d'action
      if (this.frozen[i] === 1) {
        // Le courant a prise sur la glace aussi — moins que sur l'eau (un
        // bloc a de l'inertie : exitIceGrip), et sans giration : un palet
        // n'orbite pas, il est hâlé vers la bouche. icePass moyenne ces
        // tractions par particule en une poussée de bloc — le bloc entier
        // dérive vers le sas au lieu d'attendre qu'on l'y jette.
        const boost = 1 + 1.5 * (1 - d / R)
        const vIn = p.exitPull * inv * boost * rim
        const grip = 1 - Math.exp(-4 * p.exitIceGrip * this.priseSasGlaceFactor * dt)
        this.velX[i] += (ux * vIn - this.velX[i]) * grip
        this.velY[i] += (uy * vIn - this.velY[i]) * grip
        continue
      }
      // La vidange accélère vers le trou — sur le courant rentrant seulement :
      // amplifier aussi la giration élargirait l'orbite d'équilibre au-delà
      // du cœur de Rankine et l'eau tournerait sans jamais entrer.
      // Le second terme est la gorgée finale : tout près de la bouche, le
      // courant plonge franchement — les dernières gouttes, même plaquées
      // contre la paroi voisine, sont bues au lieu de tourner en rond.
      const boost =
        1 + 1.5 * (1 - d / R) + 1.5 * (1 - Math.min(1, d / (R * 0.3)))
      const vIn = p.exitPull * inv * boost
      const vTan = p.exitPull * p.exitSwirl * inv
      // Cœur en rotation « corps solide » (Rankine), durci au carré : la
      // giration s'efface à l'approche de la bouche, l'eau y tombe droit.
      const t0 = Math.min(1, d / (R * 0.5))
      const tanScale = t0 * t0
      const tx = (ux * vIn - uy * vTan * tanScale) * rim
      const ty = (uy * vIn + ux * vTan * tanScale) * rim
      this.velX[i] += (tx - this.velX[i]) * blend
      this.velY[i] += (ty - this.velY[i]) * blend
    }

    // Le trou avale : toute particule qui atteint l'œil est retirée de la
    // simulation et comptée — elle sera mise en bonbonne à la sortie.
    const swallowR = p.kernelRadius * 2.8
    const swallowR2 = swallowR * swallowR
    let i = 0
    while (i < this.count) {
      const dx = cx - this.posX[i]
      const dy = cy - this.posY[i]
      if (dx * dx + dy * dy < swallowR2) {
        // Avalée gelée : le protocole paie une prime — récupérer un
        // échantillon SOLIDE vaut mieux que le boire goutte à goutte.
        if (this.frozen[i] === 1) this.swallowedIce++
        this.removeParticle(i)
        this.swallowed++
        continue // l'indice i contient maintenant une autre particule
      }
      i++
    }
  }

  // Re-tri spatial périodique : après une séparation (gerbe, éclaboussure),
  // des particules voisines dans l'ESPACE se retrouvent éparpillées dans les
  // TABLEAUX — chaque accès de paire devient un défaut de cache et TOUTES
  // les passes ralentissent d'un coup (mesuré : jusqu'à ×9 sur un pas, les
  // fameux à-coups en retombée). Re-ranger les particules dans l'ordre des
  // cellules restaure la localité. La physique est inchangée : seule la
  // numérotation interne bouge, et aucun indice de particule ne vit d'une
  // frame à l'autre hors de ces tableaux.
  private reorderByCell(): void {
    const n = this.count
    const perm = this.reorderPerm
    this.grid.build(this.posX, this.posY, n)
    this.grid.copyOrder(perm)
    const f = this.reorderScratch
    const permuteF = (a: Float32Array): void => {
      for (let i = 0; i < n; i++) f[i] = a[perm[i]]
      a.set(f.subarray(0, n))
    }
    // le tampon flottant transporte aussi les entiers (valeurs petites :
    // matériaux, drapeaux, étiquettes — toutes exactes en float32)
    const permuteI = (a: Uint8Array | Int8Array | Int32Array): void => {
      for (let i = 0; i < n; i++) f[i] = a[perm[i]]
      for (let i = 0; i < n; i++) a[i] = f[i]
    }
    permuteF(this.posX)
    permuteF(this.posY)
    permuteF(this.prdX)
    permuteF(this.prdY)
    permuteF(this.velX)
    permuteF(this.velY)
    permuteF(this.cooldown)
    permuteF(this.frost)
    permuteF(this.vapor)
    permuteF(this.ionise)
    permuteF(this.gasLink)
    permuteF(this.contactTime)
    permuteF(this.contactNX)
    permuteF(this.contactNY)
    permuteF(this.contactVn)
    permuteI(this.kind)
    permuteI(this.frozen)
    permuteI(this.gaseous)
    permuteI(this.welded)
    permuteF(this.souffle)
    permuteI(this.duCorps)
    permuteI(this.labels)
    permuteI(this.iceLabels)
    permuteI(this.contactMat)
    this.iceDirty = true // par prudence : les indices viennent de bouger
    // lambda, dp, dv, density, nb*, pair* : réécrits de zéro à chaque pas,
    // avant toute lecture — inutile de les transporter
  }

  step(dt: number): void {
    this.refreshDerived()
    const p = this.params
    const n = this.count
    if (n === 0) return
    // Le re-tri ne concerne que les vraies scènes (les rigs de test suivent
    // des particules par indice) ; cadence 0,25 s — coût ~0,05 ms.
    if (n >= 128 && this.stepIndex % 30 === 0) this.reorderByCell()

    const {
      posX,
      posY,
      prdX,
      prdY,
      velX,
      velY,
      lambda,
      dpX,
      dpY,
      dvX,
      dvY,
      density,
    } = this
    const k = this.kernels
    const h = k.h
    const h2 = k.h2
    const rho0 = this.restDensity
    const invRho0 = 1 / rho0
    const grid = this.grid

    // 1. Prédiction (apesanteur : pas de force externe). La glace avance
    // aussi : sa vitesse est celle de son bloc (assignée par icePass).
    const frozen = this.frozen
    for (let i = 0; i < n; i++) {
      prdX[i] = posX[i] + velX[i] * dt
      prdY[i] = posY[i] + velY[i] * dt
    }

    // Recensement des états : un corps SANS liquide n'a ni pression ni
    // viscosité — les 3 itérations de densité, la collecte de voisins du
    // solveur et le XSPH seraient du travail pour rien. C'est la PHASE
    // PALET (fréquente dans les tableaux de glace) : la sauter divise le
    // pas par ~3, à trajectoires STRICTEMENT identiques (les corrections ne
    // s'appliquaient déjà jamais au gel, et lambda/densité du gel ne sont
    // lus par personne) — et un téléphone qui calcule moins chauffe moins.
    let liquides = 0
    let gazeux = 0
    for (let i = 0; i < n; i++) {
      if (this.gaseous[i] === 1) gazeux++
      else if (frozen[i] === 0) liquides++
    }
    const phasePalet = liquides === 0

    // sCorr de référence : W(dq · h)
    const dq = p.sCorrDq * h
    const wDq = k.w(dq * dq)
    const invWDq = wDq > 0 ? 1 / wDq : 0

    // 1bis. Voisinages : UNE construction de grille par pas, listes plates
    // réutilisées par toutes les itérations et la viscosité — c'est le gros
    // du coût CPU du solveur sur petites machines.
    grid.build(prdX, prdY, n)
    const nbStart = this.nbStart
    const nbList = this.nbList
    const pairDx = this.pairDx
    const pairDy = this.pairDy
    const pairW = this.pairW
    const pairC = this.pairC
    // Sans liquide NI gaz, personne ne lira les listes de voisins (la glace
    // passe par la grille directement dans icePass) : la collecte se saute.
    const besoinVoisins = !phasePalet || gazeux > 0
    const reach = h * 1.15 // marge : les itérations déplacent un peu les particules
    // Moteur WASM : grille interne, voisins, densité et XSPH partent dans
    // les noyaux compilés (asm/noyaux.ts) — mêmes formules, même ordre
    // d'opérations, vérifié par le test de parité. Le reste du pas (glace,
    // gaz, matériaux, obstacles) continue en JS sur les mêmes tableaux.
    const wasm = this.moteurWasm && besoinVoisins ? this.noyauxWasm : null
    if (wasm) {
      wasm.assure(this.capacity, grid.nx * grid.ny)
      wasm.prdX.set(prdX.subarray(0, n))
      wasm.prdY.set(prdY.subarray(0, n))
      wasm.gas.set(this.gaseous.subarray(0, n))
      wasm.fro.set(frozen.subarray(0, n))
      wasm.buildGrid(n, grid.minX, grid.minY, grid.cellSize, grid.nx, grid.ny)
      wasm.collectAll(
        n,
        reach,
        grid.minX,
        grid.minY,
        grid.cellSize,
        grid.nx,
        grid.ny,
      )
    } else if (besoinVoisins) {
      let cursor = 0
      for (let i = 0; i < n; i++) {
        nbStart[i] = cursor
        cursor = grid.collect(
          prdX,
          prdY,
          prdX[i],
          prdY[i],
          reach,
          i,
          nbList,
          cursor,
          MAX_NEIGHBORS,
        )
      }
      nbStart[n] = cursor
    }
    const selfRho = k.poly6Coeff * h2 * h2 * h2
    // Exposant de cohésion : puissance entière déroulée quand c'est possible
    // (Math.pow dans la boucle de paires coûte cher sur petites machines)
    const sCorrNInt =
      Math.abs(p.sCorrN - Math.round(p.sCorrN)) < 1e-9
        ? Math.round(p.sCorrN)
        : 0

    // 2. Itérations de contrainte de densité. La vapeur est hors du solveur :
    // elle ne compte pas dans la densité du liquide et n'est pas corrigée —
    // un nuage n'appuie pas, et rien ne l'appuie.
    const gaseous = this.gaseous
    if (wasm && !phasePalet) {
      wasm.densityIterations(
        n,
        p.solverIterations,
        h,
        h2,
        k.poly6Coeff,
        k.spikyGradCoeff,
        selfRho,
        invRho0,
        p.epsilonLambda,
        p.sCorrK,
        p.sCorrN,
        sCorrNInt,
        invWDq,
        p.maxDeltaPFactor * h,
      )
      prdX.set(wasm.prdX.subarray(0, n))
      prdY.set(wasm.prdY.subarray(0, n))
      density.set(wasm.density.subarray(0, n))
    }
    for (
      let iter = 0;
      iter < (phasePalet || wasm ? 0 : p.solverIterations);
      iter++
    ) {
      for (let i = 0; i < n; i++) {
        if (gaseous[i] === 1) {
          density[i] = selfRho
          lambda[i] = 0
          continue
        }
        const xi = prdX[i]
        const yi = prdY[i]
        let rho = selfRho
        let sumGradX = 0
        let sumGradY = 0
        let sumGrad2 = 0
        const end = nbStart[i + 1]
        for (let e = nbStart[i]; e < end; e++) {
          const j = nbList[e]
          if (gaseous[j] === 1) {
            pairW[e] = 0
            pairC[e] = 0
            continue
          }
          const dx = xi - prdX[j]
          const dy = yi - prdY[j]
          const r2 = dx * dx + dy * dy
          if (r2 >= h2) {
            pairW[e] = 0
            pairC[e] = 0
            continue
          }
          const t = h2 - r2
          const w = k.poly6Coeff * t * t * t
          rho += w
          const r = Math.sqrt(r2)
          if (r < 1e-6) {
            pairW[e] = 0
            pairC[e] = 0
            continue
          }
          const tg = h - r
          const c = (k.spikyGradCoeff * tg * tg) / r
          // mémorisé pour la passe de déplacement de cette itération
          pairDx[e] = dx
          pairDy[e] = dy
          pairW[e] = w
          pairC[e] = c
          const gx = c * dx * invRho0
          const gy = c * dy * invRho0
          sumGradX += gx
          sumGradY += gy
          sumGrad2 += gx * gx + gy * gy
        }
        density[i] = rho
        const C = rho * invRho0 - 1
        const denom =
          sumGrad2 + sumGradX * sumGradX + sumGradY * sumGradY + p.epsilonLambda
        lambda[i] = -C / denom
      }

      // Plafond de correction PAR PAIRE : le terme est exactement opposé pour
      // i et j, le plafonner préserve la conservation de la quantité de
      // mouvement tout en bornant les projections catastrophiques quand une
      // particule rapide frôle une voisine (r → 0 ⇒ correction → ∞).
      const maxPairDp = p.maxDeltaPFactor * h
      const maxPairDp2 = maxPairDp * maxPairDp
      for (let i = 0; i < n; i++) {
        if (gaseous[i] === 1) {
          dpX[i] = 0
          dpY[i] = 0
          continue
        }
        const li = lambda[i]
        let dx0 = 0
        let dy0 = 0
        const end = nbStart[i + 1]
        for (let e = nbStart[i]; e < end; e++) {
          const c = pairC[e]
          if (c === 0) continue
          const ratio = pairW[e] * invWDq
          let powed: number
          if (sCorrNInt > 0) {
            powed = ratio
            for (let q = 1; q < sCorrNInt; q++) powed *= ratio
          } else {
            powed = Math.pow(ratio, p.sCorrN)
          }
          const sCorr = -p.sCorrK * powed
          const scale = (li + lambda[nbList[e]] + sCorr) * invRho0
          let px = scale * c * pairDx[e]
          let py = scale * c * pairDy[e]
          const m2 = px * px + py * py
          if (m2 > maxPairDp2) {
            const s = maxPairDp / Math.sqrt(m2)
            px *= s
            py *= s
          }
          dx0 += px
          dy0 += py
        }
        dpX[i] = dx0
        dpY[i] = dy0
      }

      for (let i = 0; i < n; i++) {
        if (frozen[i] === 1) continue // masse infinie : la correction ne s'applique qu'au liquide
        prdX[i] += dpX[i]
        prdY[i] += dpY[i]
      }
    }

    // 3. Obstacles solides (parois, cellules d'éponge saturées)
    this.resolveObstacles(dt)

    // 3bis. Bords du monde (contact enregistré pour la glace : elle rebondit)
    const b = this.bounds
    const inset = p.particleSpacing * 0.5
    for (let i = 0; i < n; i++) {
      let nx = 0
      let ny = 0
      if (prdX[i] < b.minX + inset) {
        prdX[i] = b.minX + inset
        nx = 1
      } else if (prdX[i] > b.maxX - inset) {
        prdX[i] = b.maxX - inset
        nx = -1
      }
      if (prdY[i] < b.minY + inset) {
        prdY[i] = b.minY + inset
        ny = 1
      } else if (prdY[i] > b.maxY - inset) {
        prdY[i] = b.maxY - inset
        ny = -1
      }
      if ((nx !== 0 || ny !== 0) && frozen[i] === 1) {
        const inv = 1 / Math.hypot(nx, ny)
        this.contactMat[i] = MAT_WALL
        this.contactNX[i] = nx * inv
        this.contactNY[i] = ny * inv
      }
    }

    // 4. Vitesses puis viscosité XSPH (antisymétrique : conserve la quantité
    //    de mouvement). La glace garde sa vitesse de bloc : la recalculer des
    //    positions y injecterait les à-coups de résolution de contact.
    const invDt = 1 / dt
    const maxV = p.maxSpeed
    const maxV2 = maxV * maxV
    for (let i = 0; i < n; i++) {
      if (frozen[i] === 1) continue
      let vx = (prdX[i] - posX[i]) * invDt
      let vy = (prdY[i] - posY[i]) * invDt
      const v2 = vx * vx + vy * vy
      if (v2 > maxV2) {
        const s = maxV / Math.sqrt(v2)
        vx *= s
        vy *= s
      }
      velX[i] = vx
      velY[i] = vy
    }

    // 4bis. Réponses matériaux : rebond hydrophobe, adhérence hydrophile,
    // bandes d'influence (§6)
    this.applyMaterialVelocities(dt)

    if (p.xsphC > 0 && !phasePalet && wasm) {
      // les obstacles et les bords ont bougé prd, les matériaux ont changé
      // vel : on recopie l'état courant avant le noyau (comme le JS qui lit
      // les tableaux à jour), et on relit les vitesses lissées
      wasm.prdX.set(prdX.subarray(0, n))
      wasm.prdY.set(prdY.subarray(0, n))
      wasm.velX.set(velX.subarray(0, n))
      wasm.velY.set(velY.subarray(0, n))
      wasm.xsph(n, h2, k.poly6Coeff, p.xsphC, invRho0)
      velX.set(wasm.velX.subarray(0, n))
      velY.set(wasm.velY.subarray(0, n))
    } else if (p.xsphC > 0 && !phasePalet) {
      for (let i = 0; i < n; i++) {
        if (frozen[i] === 1 || gaseous[i] === 1) {
          dvX[i] = 0
          dvY[i] = 0
          continue
        }
        const xi = prdX[i]
        const yi = prdY[i]
        const vxi = velX[i]
        const vyi = velY[i]
        let ax = 0
        let ay = 0
        const end = nbStart[i + 1]
        for (let e = nbStart[i]; e < end; e++) {
          const j = nbList[e]
          if (gaseous[j] === 1) continue
          const dx = xi - prdX[j]
          const dy = yi - prdY[j]
          const r2 = dx * dx + dy * dy
          if (r2 >= h2) continue
          const t = h2 - r2
          const w = k.poly6Coeff * t * t * t
          ax += (velX[j] - vxi) * w
          ay += (velY[j] - vyi) * w
        }
        dvX[i] = ax * p.xsphC * invRho0
        dvY[i] = ay * p.xsphC * invRho0
      }
      for (let i = 0; i < n; i++) {
        velX[i] += dvX[i]
        velY[i] += dvY[i]
      }
    }

    // 4ter. Blocs de glace : vitesse commune par amas, rebonds, soudures
    this.icePass(dt)

    // 4quater. Vapeur : expansion douce et flottement
    this.applyGasDynamics(dt)
    this.fadeIonise(dt)

    // 5. Validation des positions, cooldowns, identité du corps
    for (let i = 0; i < n; i++) {
      posX[i] = prdX[i]
      posY[i] = prdY[i]
      if (this.cooldown[i] > 0) this.cooldown[i] -= dt
    }

    // 5bis. Froid : givre, gel volontaire (F), dégel
    this.processCold(dt)

    // 5bis-b. Règle de transformation : la condensation regroupe — les
    // gouttelettes qui redeviennent eau sont rappelées vers le corps
    this.applyCondenseRegroup(dt)

    // 5bis-b2. Le retour des égarées : la matière du corps encore à portée
    // revient d'elle-même une fois son délai purgé
    this.applyStrayRecall(dt)

    // 5bis-c. La vapeur n'est pas un état de croisière : être gaz s'évapore
    // en continu, et les mailles d'une grille essorent le nuage au passage
    this.processGasCosts(dt)

    // 5bis-d. Recondensation (§7.3) : la vapeur perdue perle en rosée près
    // des plaques froides — son propre corps, à aller rechercher
    this.processRecondensation(dt)

    // 5ter. Éponge : traînée, temps de contact, absorption (§6)
    if (this.sponges.length > 0) this.processSponges(dt)

    this.stepIndex++
    if (this.stepIndex % Math.max(1, Math.round(p.componentEvery)) === 0) {
      this.relabel()
    }
    // Le seuil de volume ne tue plus (refonte 2026) : il annonce la dernière
    // impulsion, et c'est le jeu qui conclut, à l'arrêt du corps. Seule la
    // perte de cohésion (moins de deux particules) reste une dispersion.
    if (this.belowCritical && !this.dispersed) {
      this.criticalTimer += dt
    } else if (!this.belowCritical) {
      this.criticalTimer = 0
    }
  }

  // La vapeur se paie (§4 : chaque bouffée part définitivement) : tant que
  // le corps est en gaz, sa traîne s'évapore — même immobile — et chaque
  // particule prise dans la maille d'une grille risque d'y rester. La vapeur
  // reste le passe-muraille du jeu, mais chaque passage a un prix.
  private processGasCosts(dt: number): void {
    const p = this.params
    let anyPlayerGas = false
    let inMesh = 0
    for (let i = 0; i < this.count; i++) {
      if (this.gaseous[i] !== 1) continue
      if (this.kind[i] === KIND_PLAYER) {
        anyPlayerGas = true
        // SURCHAUFFEUR : seul le gaz interagit avec lui — le frôler ou le
        // toucher rend UN dash, une seule fois par appareil (le manomètre
        // tombe à zéro), JAMAIS au-delà de la réserve du tableau : réserve
        // pleine, le serpentin reste chargé — il attend qu'un dash manque.
        // La chaudière, elle, ne recharge rien : elle transforme.
        if (this.hasSurchauffeur && this.dashBudget < this.dashBudgetMax) {
          const bi = this.surchauffeurFrole(this.posX[i], this.posY[i])
          if (bi >= 0 && !this.surchauffesVides.has(bi)) {
            this.surchauffesVides.add(bi)
            this.dashBudget++
          }
        }
      }
      if (this.hasGrille && this.grilleAt(this.posX[i], this.posY[i])) inMesh++
    }
    // péage de grille : proportionnel à la présence dans la maille
    if (inMesh > 0)
      this.grilleCarry += inMesh * p.grilleGasLoss * this.perteGrilleFactor * dt
    else this.grilleCarry = 0
    while (this.grilleCarry >= 1) {
      this.grilleCarry -= 1
      let pick = -1
      for (let i = 0; i < this.count; i++) {
        if (this.gaseous[i] !== 1) continue
        if (this.grilleAt(this.posX[i], this.posY[i])) {
          pick = i
          break
        }
      }
      if (
        pick < 0 ||
        (this.kind[pick] === KIND_PLAYER && this.playerCount <= 2)
      )
        break
      this.removeParticle(pick)
      this.vaporBank++
    }
    // évaporation d'état : la traîne du nuage (la plus loin du corps) se perd
    if (anyPlayerGas)
      this.gasIdleCarry += p.gasIdleLossRate * this.perteGazFactor * dt
    else this.gasIdleCarry = 0
    while (this.gasIdleCarry >= 1 && this.playerCount > 2) {
      this.gasIdleCarry -= 1
      let worst = -1
      let worstD2 = -1
      for (let i = 0; i < this.count; i++) {
        if (this.kind[i] !== KIND_PLAYER || this.gaseous[i] !== 1) continue
        const dx = this.posX[i] - this.stats.centroidX
        const dy = this.posY[i] - this.stats.centroidY
        const d2 = dx * dx + dy * dy
        if (d2 > worstD2) {
          worstD2 = d2
          worst = i
        }
      }
      if (worst < 0) break
      this.removeParticle(worst)
      this.vaporBank++
    }
  }

  // La soupape du roguelike (§7.3) : sans eau à ramasser dans les niveaux,
  // une erreur serait irrattrapable. La physique fournit le rattrapage — la
  // vapeur perdue se recondense sur les parois froides, avec une perte
  // importante, et d'autant mieux que le vaisseau refroidit. Ce n'est pas du
  // butin : c'est son propre corps qu'on va rechercher, au prix d'un détour.
  private processRecondensation(dt: number): void {
    const p = this.params
    if (this.coldBoxes.length === 0 || this.vaporBank < 1 || p.recondRate <= 0)
      return
    this.recondCarry += p.recondRate * dt
    while (
      this.recondCarry >= 1 &&
      this.vaporBank >= 1 &&
      this.count < this.capacity
    ) {
      this.recondCarry -= 1
      this.vaporBank -= 1
      // rendement : part récupérable, meilleure à vaisseau froid — et
      // l'AIMANT À ROSÉE (instrument embarqué) le bonifie pour la run
      this.recondYield += Math.min(
        0.92,
        p.recondFraction + 0.25 * this.chill + this.recondBonus,
      )
      if (this.recondYield < 1) continue
      this.recondYield -= 1
      // la rosée perle juste au-delà de l'aura de gel, répartie le long de la
      // plaque — pseudo-aléa déterministe (LCG), la simulation reste rejouable
      this.recondSeed = (this.recondSeed * 48271) % 2147483647
      const r1 = this.recondSeed / 2147483647
      this.recondSeed = (this.recondSeed * 48271) % 2147483647
      const r2 = this.recondSeed / 2147483647
      const b =
        this.coldBoxes[
          Math.floor(r1 * this.coldBoxes.length) % this.coldBoxes.length
        ]
      const dist =
        p.coldBand * (1 + p.chillColdGrowth * this.chill) * 1.12 +
        p.particleSpacing
      let x: number
      let y: number
      if (b.angle || b.forme) {
        // plaque oblique ou FORME : la rosée perle sur l'iso-distance du
        // champ — on part du cercle englobant dans une direction tirée au
        // sort, puis on marche le long du gradient (Newton sur le SDF)
        const cx = (b.minX + b.maxX) / 2
        const cy = (b.minY + b.maxY) / 2
        const th = r2 * Math.PI * 2
        const rayon = Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2 + dist
        x = cx + rayon * Math.cos(th)
        y = cy + rayon * Math.sin(th)
        const cp = this.scratchCP
        for (let k = 0; k < 3; k++) {
          boxContact(x, y, b, cp)
          x += cp.nx * (dist - cp.dist)
          y += cp.ny * (dist - cp.dist)
        }
      } else if (b.maxX - b.minX > b.maxY - b.minY) {
        // plaque horizontale : rosée au-dessus ou en dessous
        x = b.minX + r2 * (b.maxX - b.minX)
        y = r1 > 0.5 ? b.maxY + dist : b.minY - dist
      } else {
        x = r1 > 0.5 ? b.maxX + dist : b.minX - dist
        y = b.minY + r2 * (b.maxY - b.minY)
      }
      this.addParticle(x, y, KIND_FREE)
      this.roseePerlee++
    }
  }

  private grilleAt(x: number, y: number): boolean {
    for (const b of this.grilleBoxes) {
      if (dansBoite(b, x, y)) return true
    }
    return false
  }

  // Tant qu'une particule garde de la vapeur résiduelle (le corps est en
  // train de redevenir liquide) et qu'on ne pilote pas le nuage, elle est
  // rappelée vers le corps : redevenir eau ne disperse pas l'échantillon.
  // Physiquement : la condensation nuclée — les gouttelettes retombent.
  private applyCondenseRegroup(dt: number): void {
    const p = this.params
    if (p.condenseRegroup <= 0 || this.playerCount === 0) return // pas de corps : rien vers quoi retomber
    const cx = this.stats.centroidX
    const cy = this.stats.centroidY
    for (let i = 0; i < this.count; i++) {
      const v = Math.max(this.vapor[i], this.gasLink[i])
      if (v <= 0.02 || this.frozen[i] === 1) continue
      if (this.gasIntent && this.kind[i] === KIND_PLAYER) continue // le pilotage garde la main
      // le souffle d'un dash n'est plus à vous : ni en vol, ni fraîchement
      // perlé — sinon la propulsion en vapeur ne coûterait rien
      if (
        this.kind[i] !== KIND_PLAYER &&
        (this.souffle[i] > 0 || this.cooldown[i] > 0)
      )
        continue
      // dans l'aura d'une chaudière, une particule ne CONDENSE pas : elle
      // BOUT. Sans cette garde, le bord du corps qui chauffait (vapeur
      // montante) était happé vers le centre en continu — la chaudière
      // semblait REPOUSSER le corps liquide, impossible de l'approcher
      // pour se faire vaporiser.
      if (
        this.hasHeat &&
        this.gaseous[i] === 0 &&
        this.heatExposureAt(this.posX[i], this.posY[i]) > 0
      )
        continue
      const dx = cx - this.posX[i]
      const dy = cy - this.posY[i]
      const d = Math.hypot(dx, dy)
      if (d < 1e-3) continue
      // Asservissement en vitesse (comme le vortex) : la vitesse d'approche
      // cible décroît avec la distance — la pluie converge et se pose, sans
      // jamais s'effondrer sur le corps (une force constante exploserait un
      // nuage compact). Pente 1 : la goutte ralentit dès un rayon d'écran,
      // au lieu de foncer plein plafond jusqu'au contact (« la charge »).
      const ux = dx / d
      const uy = dy / d
      const vTarget = Math.min(p.condenseRegroup, d)
      const vRadial = this.velX[i] * ux + this.velY[i] * uy
      const k = Math.min(1, 6 * v * dt)
      this.velX[i] += (vTarget - vRadial) * ux * k
      this.velY[i] += (vTarget - vRadial) * uy * k
    }
  }

  // Rayon de capture du corps : le voisinage où la matière égarée compte
  // encore comme « à portée » — le même pour le rappel et pour le HUD (⟳),
  // pour que la promesse d'affichage soit exactement la portée du retour.
  private captureRadius(): number {
    const p = this.params
    return Math.max(this.stats.rmsRadius * 2.5, p.kernelRadius * 6)
  }

  // LE RETOUR DES ÉGARÉES. Une goutte d'éjection qui n'est jamais vraiment
  // partie, une gerbe de péage retombée sur place, un fragment détaché par
  // le remous d'un tir : cette matière est marquée DU CORPS. Son délai
  // purgé, si elle traîne dans le rayon de capture, elle est rappelée
  // d'elle-même — la réabsorption par simple connexité laissait des gouttes
  // gésir à deux doigts du corps, jamais reprises, et la vie baissait pour
  // une matière encore là. Les gouttes SEMÉES par le tableau n'ont pas la
  // marque : les collectables s'attrapent au contact, comme avant. Pendant
  // que le sas boit, le rappel s'efface devant lui.
  private applyStrayRecall(dt: number): void {
    const p = this.params
    if (this.playerCount === 0 || this.drainOn) return
    const cx = this.stats.centroidX
    const cy = this.stats.centroidY
    const capture = this.captureRadius()
    const c2 = capture * capture
    let impX = 0
    let impY = 0
    for (let i = 0; i < this.count; i++) {
      if (this.duCorps[i] === 0 || this.kind[i] === KIND_PLAYER) continue
      if (this.cooldown[i] > 0 || this.frozen[i] === 1 || this.gaseous[i] === 1)
        continue
      const dx = cx - this.posX[i]
      const dy = cy - this.posY[i]
      const d2 = dx * dx + dy * dy
      if (d2 > c2) continue // trop loin : perdue là où elle gît — allez la chercher
      const d = Math.sqrt(d2)
      if (d < 1e-3) continue
      // même asservissement en vitesse que le rappel de condensation : la
      // goutte converge et se pose, sans être catapultée (même pente douce)
      const ux = dx / d
      const uy = dy / d
      const vTarget = Math.min(p.condenseRegroup, d)
      const vRadial = this.velX[i] * ux + this.velY[i] * uy
      const k = Math.min(1, 5 * dt)
      const ivx = (vTarget - vRadial) * ux * k
      const ivy = (vTarget - vRadial) * uy * k
      this.velX[i] += ivx
      this.velY[i] += ivy
      impX += ivx
      impY += ivy
    }
    // Antisymétrie (§3.3) : le corps encaisse l'opposé de ce qu'il donne aux
    // égarées — la quantité de mouvement d'ensemble est conservée exactement,
    // le rappel n'est pas une propulsion gratuite.
    if (impX !== 0 || impY !== 0) {
      let libres = 0
      for (let i = 0; i < this.count; i++) {
        if (this.kind[i] === KIND_PLAYER && this.frozen[i] === 0) libres++
      }
      if (libres > 0) {
        const rx = -impX / libres
        const ry = -impY / libres
        for (let i = 0; i < this.count; i++) {
          if (this.kind[i] !== KIND_PLAYER || this.frozen[i] === 1) continue
          this.velX[i] += rx
          this.velY[i] += ry
        }
      }
    }
  }

  /** Les tubes du tableau. Appelé au chargement, comme setLevel.
   *
   *  TOUT RAIL Y ENTRE désormais : depuis qu'un rail a un corps, la passe
   *  travaille dès qu'un rail est posé, et non plus seulement pour un
   *  conduit. Un tableau SANS rail ne paie toujours rien — la passe sort au
   *  premier test. */
  setConduits(
    rails: { points: { x: number; y: number }[]; conduit?: boolean }[],
    rayonRaccourci: number,
    rayonRail: number,
  ): void {
    this.conduits = []
    for (let i = 0; i < rails.length; i++) {
      const r = rails[i]
      if (r.points.length < 2) continue
      // TOUT RAIL A UN CORPS. Une ligne de champ magnétique n'est pas un
      // décalque : de la matière CONDENSÉE ne la traverse pas — l'eau et la
      // glace butent dessus comme sur une paroi. Seul le gaz passe, parce
      // que seul le gaz s'ionise ; c'est ce qui fait du rail une mécanique
      // et non un dessin. Avant, un rail ordinaire n'avait AUCUNE physique
      // et le corps le traversait sans rien sentir.
      //
      // Ce qui distingue le RACCOURCI (`conduit`), c'est autre chose : lui
      // seul, une fois son arc engagé, laisse la vapeur ignorer le DÉCOR et
      // franchir une paroi. Un rail ordinaire ne fait jamais traverser quoi
      // que ce soit — il barre, voilà tout.
      const raccourci = r.conduit === true
      this.conduits.push({
        pts: r.points,
        // le corps d'un rail est SA BANDE DE CAPTURE, celle qu'on dessine :
        // la portée du champ est son épaisseur. Le tube d'un raccourci, lui,
        // épouse la bande de convoyage (railConvoy y travaille) — ce qui est
        // porté est exactement ce qui est dedans.
        rayon: raccourci ? rayonRaccourci : rayonRail,
        raccourci,
        rail: i,
        actif: false,
      })
    }
  }

  /** QUELS TUBES SONT OUVERTS, à cet instant. Un conduit ne s'ouvre qu'au
   *  PLASMA : il faut qu'un arc ionisé circule sur ce rail — donc que le
   *  corps se soit vaporisé DANS le faisceau. La vapeur seule ne suffit
   *  pas, et c'est ce qui fait du raccourci la récompense de l'énigme
   *  plutôt que son contournement. Appelé une fois par image. */
  setConduitsActifs(engages: ReadonlySet<number>): void {
    for (const tube of this.conduits) tube.actif = engages.has(tube.rail)
  }

  /** Qui est dans un tube, et à quelle profondeur. Une passe par pas, avant
   *  la résolution des solides — les deux usages (laisser filer la vapeur,
   *  expulser le reste) lisent le même relevé. */
  private majConduits(): void {
    const n = this.count
    if (this.conduits.length === 0) {
      if (n > 0) this.dansConduit.fill(0, 0, n)
      return
    }
    for (let i = 0; i < n; i++) {
      this.dansConduit[i] = 0
      const px = this.prdX[i]
      const py = this.prdY[i]
      // LE PLUS PERMISSIF PRIME. Deux tubes peuvent se croiser : prendre
      // bêtement le plus proche ferait qu'un voisin moins permissif expulse
      // un corps en pleine traversée. Le classement est établi plus bas, à
      // trois crans (`rang`) ; la distance ne départage qu'à rang égal.
      let best = Infinity
      let bnx = 0
      let bny = 0
      let brayon = 0
      let bouvert = 0
      let barc = 0
      let bRang = -1
      let bqx = 0
      let bqy = 0
      for (const tube of this.conduits) {
        const pts = tube.pts
        // DEUX QUALITÉS, ET ELLES NE SE CONFONDENT PAS.
        // · ARC : ce tube porte un arc ionisé. C'est lui qui laisse passer le
        //   GAZ — le plasma traverse la ligne de champ, la vapeur ordinaire
        //   non. Vrai pour tout rail, raccourci ou pas.
        // · OUVERT : ce tube me laisse ignorer le DÉCOR et franchir une
        //   paroi. Seul un RACCOURCI le fait, et seulement arc engagé. Un
        //   rail ordinaire guide le faisceau, il n'ouvre aucun mur.
        const arc = tube.actif ? 1 : 0
        const ouvert = tube.actif && tube.raccourci ? 1 : 0
        // LE PLUS PERMISSIF PRIME, ET DANS CET ORDRE. Deux tubes peuvent se
        // croiser : prendre bêtement le plus proche ferait qu'un voisin
        // moins permissif expulse un corps en pleine traversée. On classe
        // donc — un RACCOURCI ouvert (2) devant un rail à l'arc (1) devant
        // un tube éteint (0) — et l'on ne départage à la distance qu'à
        // égalité de rang. Départager sur le seul `arc` perdait le rang du
        // raccourci : un rail ORDINAIRE engagé, passant plus près, gagnait
        // et effaçait le laissez-passer du décor. Mesuré sur un conduit
        // doublé d'un rail ordinaire à 10 u : 34 traversées tombaient à 20.
        const rang = ouvert * 2 + arc
        if (rang < bRang) continue
        for (let k = 0; k + 1 < pts.length; k++) {
          const a = pts[k]
          const b = pts[k + 1]
          const abx = b.x - a.x
          const aby = b.y - a.y
          const len2 = abx * abx + aby * aby
          if (len2 < 1e-9) continue
          const t = Math.max(0, Math.min(1, ((px - a.x) * abx + (py - a.y) * aby) / len2))
          const cx = a.x + abx * t
          const cy = a.y + aby * t
          const dx = px - cx
          const dy = py - cy
          const d2 = dx * dx + dy * dy
          if (d2 > tube.rayon * tube.rayon) continue // hors de CE tube
          // à rang égal, le plus proche l'emporte ; un rang supérieur
          // détrône quelle que soit la distance
          if (rang === bRang && d2 >= best) continue
          best = d2
          bRang = rang
          barc = arc
          bouvert = ouvert
          bqx = cx
          bqy = cy
          const d = Math.sqrt(d2)
          // sur l'axe même, la normale est indéfinie : on prend la
          // perpendiculaire au tronçon, pour que l'expulsion ait un sens
          if (d > 1e-6) {
            bnx = dx / d
            bny = dy / d
          } else {
            const inv = 1 / Math.sqrt(len2)
            bnx = -aby * inv
            bny = abx * inv
          }
          brayon = tube.rayon
        }
      }
      if (brayon > 0) {
        this.dansConduit[i] = 1
        this.conduitOuvert[i] = bouvert
        this.conduitArc[i] = barc
        this.conduitNX[i] = bnx
        this.conduitNY[i] = bny
        this.conduitDist[i] = Math.sqrt(best)
        this.conduitRayon[i] = brayon
        this.conduitQX[i] = bqx
        this.conduitQY[i] = bqy
      }
    }
  }

  /** LA PAROI DU TUBE — et ce qui la franchit : LE PLASMA, rien d'autre.
   *
   *  LE VERROU QU'IL A FALLU OUVRIR. Expulser aussi la VAPEUR rendait le
   *  conduit inutilisable : pour lever le champ il faut ioniser le faisceau
   *  DANS le tube (la capture se fait à `plasmaRailRadius`, 30 u de l'axe),
   *  or un tube fermé qui repousse la vapeur la met hors d'atteinte — mesuré,
   *  elle finissait à plus de deux mille unités. On ne pouvait donc JAMAIS
   *  ouvrir un conduit en jouant ; seuls les tests, qui lèvent le champ à la
   *  main, voyaient la mécanique fonctionner.
   *
   *  D'OÙ DEUX ÉPAISSEURS, ET C'EST TOUT L'ÉQUILIBRE. La vapeur ordinaire ne
   *  traverse pas non plus une ligne de champ — seul le PLASMA le fait, et le
   *  plasma c'est de la vapeur sur un rail dont l'arc est engagé. Mais si on
   *  la repoussait au rayon de CAPTURE, elle ne pourrait plus jamais allumer
   *  ce qu'elle veut franchir : le verrou de #304, à l'identique. Le gaz bute
   *  donc sur un CŒUR plus mince que le rayon de capture (COEUR_PART), assez
   *  pour barrer, assez peu pour qu'il reste toujours de la vapeur dans les
   *  30 unités où le faisceau s'ionise.
   *
   *  L'eau et la glace, elles, butent sur toute l'épaisseur du tube : on ne
   *  se faufile pas dans une ligne de champ en étant de la matière condensée. */
  private expulseDesConduits(): void {
    if (this.conduits.length === 0) return
    for (let i = 0; i < this.count; i++) {
      if (this.dansConduit[i] !== 1) continue
      // LE PLASMA PASSE, ET LUI SEUL. Du gaz sur un tube dont l'arc est
      // engagé est du plasma : la ligne de champ le porte, elle ne le
      // repousse pas. Sans arc, c'est de la vapeur ordinaire — elle bute,
      // mais sur le CŒUR seulement, pour qu'il lui reste de quoi venir
      // allumer le rail depuis le rayon de capture (cf. l'en-tête).
      let rayon = this.conduitRayon[i]
      if (this.gaseous[i] === 1) {
        if (this.conduitArc[i] === 1) continue
        rayon = Math.min(rayon, this.params.plasmaRailRadius * COEUR_PART)
      }
      let prof = rayon - this.conduitDist[i]
      if (prof <= 0) continue
      const nx = this.conduitNX[i]
      const ny = this.conduitNY[i]
      // LE TUBE POUSSE, IL NE CATAPULTE PAS. Une particule qui se condense
      // AU MILIEU du tube y est enfoncée de tout le rayon : replacée d'un
      // coup sur la paroi, elle sortait du pas de temps avec rayon/dt en
      // vitesse — mesuré 2861 u/s à l'arrivée d'un convoyage, et le corps
      // projeté à 680 u de son point de garage. Ce n'est pas une paroi qui
      // repousse, c'est une catapulte. Le déplacement est donc borné à ce
      // que `plasmaSortie` autorise par seconde : le corps SORT du tube,
      // en quelques images, à une vitesse qui reste celle d'un déplacement.
      const maxPas = this.params.plasmaSortie * this.params.dt
      if (prof > maxPas) prof = maxPas
      this.prdX[i] += nx * prof
      this.prdY[i] += ny * prof
      // LE GAZ EST ARRÊTÉ, PAS CHASSÉ. La vitesse se lit (prd − pos)/dt :
      // repousser la seule position prédite AJOUTE de la vitesse vers
      // l'extérieur, et le répéter à chaque pas la pompe — mesuré, la vapeur
      // pressée contre une ligne de champ finissait à 37,8 u de l'axe, hors
      // des 30 où le faisceau s'ionise. Elle ne pouvait plus allumer ce
      // qu'elle voulait franchir : le verrou de #304, revenu par une autre
      // porte. On aligne donc la position d'ORIGINE sur la même hauteur
      // normale : la composante rentrante tombe à zéro, la tangentielle est
      // gardée intacte — le nuage longe la ligne, il ne la franchit ni n'en
      // est soufflé. C'est ce que fait une paroi.
      //
      // La matière condensée, elle, garde sa poussée bornée : un rail ne se
      // contente pas de l'arrêter, il la remet dehors.
      if (this.gaseous[i] === 1) {
        const qx = this.conduitQX[i]
        const qy = this.conduitQY[i]
        const dPos = (this.posX[i] - qx) * nx + (this.posY[i] - qy) * ny
        const dPrd = (this.prdX[i] - qx) * nx + (this.prdY[i] - qy) * ny
        const corr = dPrd - dPos
        this.posX[i] += nx * corr
        this.posY[i] += ny * corr
      }
      // LE CONTACT EST DÉCLARÉ, comme pour n'importe quel solide : sans lui
      // la passe de glace ne reçoit aucune impulsion et un palet se DÉFORME
      // dans le tube au lieu d'y rebondir.
      const vn =
        ((this.prdX[i] - this.posX[i]) * nx + (this.prdY[i] - this.posY[i]) * ny) /
        Math.max(1e-6, this.params.dt)
      this.contactMat[i] = MAT_WALL
      this.contactNX[i] = nx
      this.contactNY[i] = ny
      this.contactVn[i] = Math.min(0, vn)
      // expulsée, elle n'est plus dedans
      this.dansConduit[i] = 0
    }
  }

  private readonly scratchCP: ClosestPoint = { dist: 0, nx: 0, ny: 0 }

  // Pousse les particules hors des solides et enregistre le contact (normale,
  // vitesse normale entrante, matériau) pour la réponse en vitesse.
  private resolveObstacles(dt: number): void {
    const n = this.count
    const p = this.params
    const rp = p.particleSpacing * 0.5
    const invDt = 1 / dt
    const cp = this.scratchCP
    this.contactMat.fill(-1, 0, n)
    // LES TUBES D'ABORD : le relevé sert aux deux règles qui suivent, et
    // l'expulsion doit avoir lieu AVANT que le décor ne se prononce (une
    // particule d'eau chassée du tube doit pouvoir buter sur la paroi
    // derrière, dans le même pas).
    this.majConduits()
    this.expulseDesConduits()
    if (this.boxes.length === 0 && this.sponges.length === 0) return

    for (let i = 0; i < n; i++) {
      let x = this.prdX[i]
      let y = this.prdY[i]

      // LE RACCOURCI. Dans un conduit, la vapeur ne touche plus RIEN du
      // décor : c'est ce qui lui fait traverser la paroi au lieu de la
      // longer. Hors du tube, ou dans un autre état, le décor reprend tous
      // ses droits — la particule vient d'ailleurs d'en être expulsée.
      if (
        this.dansConduit[i] === 1 &&
        this.conduitOuvert[i] === 1 &&
        this.gaseous[i] === 1
      )
        continue

      for (const b of this.boxes) {
        // Chaque état a sa porte : la grille laisse passer la VAPEUR, la
        // membrane gorgée d'eau laisse suinter l'EAU, le rideau lamellaire
        // s'écarte devant la GLACE — tout le reste bute.
        if (b.material === MAT_GRILLE && this.gaseous[i] === 1) {
          // CODEX : le passage EST l'interaction — consigné quand une
          // particule du corps est réellement DANS la boîte (l'AABB suffit)
          if (
            this.codexContacts[MAT_GRILLE * 3 + 2] === 0 &&
            this.kind[i] === KIND_PLAYER &&
            x > b.minX &&
            x < b.maxX &&
            y > b.minY &&
            y < b.maxY
          )
            this.codexContacts[MAT_GRILLE * 3 + 2] = 1
          continue
        }
        if (
          b.material === MAT_MEMBRANE &&
          this.gaseous[i] !== 1 &&
          this.frozen[i] !== 1
        ) {
          if (
            this.codexContacts[MAT_MEMBRANE * 3] === 0 &&
            this.kind[i] === KIND_PLAYER &&
            x > b.minX &&
            x < b.maxX &&
            y > b.minY &&
            y < b.maxY
          )
            this.codexContacts[MAT_MEMBRANE * 3] = 1
          continue
        }
        if (b.material === MAT_RIDEAU && this.frozen[i] === 1) {
          if (
            this.codexContacts[MAT_RIDEAU * 3 + 1] === 0 &&
            this.kind[i] === KIND_PLAYER &&
            x > b.minX &&
            x < b.maxX &&
            y > b.minY &&
            y < b.maxY
          )
            this.codexContacts[MAT_RIDEAU * 3 + 1] = 1
          continue
        }
        if (horsBoite(b, x, y, rp)) continue
        boxContact(x, y, b, cp)
        const sep = cp.dist - rp
        if (sep < 0) {
          const vn =
            ((x - this.posX[i]) * cp.nx + (y - this.posY[i]) * cp.ny) * invDt
          x -= cp.nx * sep
          y -= cp.ny * sep
          this.contactMat[i] = b.material
          this.contactNX[i] = cp.nx
          this.contactNY[i] = cp.ny
          this.contactVn[i] = vn
        }
      }

      // Éponge : un feutre continu. La GLACE et la VAPEUR butent sur toutes
      // ses cellules (le palet ne défonce pas le feutre, le nuage ne passe
      // pas ses fibres) ; le LIQUIDE s'infiltre dans les cellules vivantes
      // (qui l'absorbent) et ne bute que sur les cellules SATURÉES, devenues
      // solides. La particule peut chevaucher jusqu'à 4 cellules.
      const etatLiquide = this.frozen[i] !== 1 && this.gaseous[i] !== 1
      for (const sp of this.sponges) {
        const d = sp.def
        if (
          x < d.minX - rp ||
          x >= sp.maxX + rp ||
          y < d.minY - rp ||
          y >= sp.maxY + rp
        )
          continue
        const cx0 = Math.max(0, Math.floor((x - rp - d.minX) / d.cellSize))
        const cy0 = Math.max(0, Math.floor((y - rp - d.minY) / d.cellSize))
        const cx1 = Math.min(
          d.cols - 1,
          Math.floor((x + rp - d.minX) / d.cellSize),
        )
        const cy1 = Math.min(
          d.rows - 1,
          Math.floor((y + rp - d.minY) / d.cellSize),
        )
        for (let cy = cy0; cy <= cy1; cy++) {
          for (let cx = cx0; cx <= cx1; cx++) {
            const cell = cy * d.cols + cx
            if (etatLiquide && !sp.isSolid(cell)) continue
            const cb = sp.cellBounds(cell)
            boxContact(x, y, cb, cp)
            const sep = cp.dist - rp
            if (sep < 0) {
              x -= cp.nx * sep
              y -= cp.ny * sep
              this.contactMat[i] = 0 // comportement mur neutre
              this.contactNX[i] = cp.nx
              this.contactNY[i] = cp.ny
              this.contactVn[i] = 0
            }
          }
        }
      }

      this.prdX[i] = x
      this.prdY[i] = y
    }
  }

  // Rebond hydrophobe, adhérence hydrophile, et bandes d'influence sans
  // contact : la répulsion dévie les trajectoires, l'adhésion aspire vers la
  // surface (§6).
  private applyMaterialVelocities(dt: number): void {
    if (this.boxes.length === 0) return
    const n = this.count
    const p = this.params
    const rp = p.particleSpacing * 0.5
    const cp = this.scratchCP
    const band = p.hydroBand
    const wallBand = p.wallSplashBand
    const bite = p.surfaceBite // mordant global : les surfaces pèsent plus
    const philDamp = Math.exp(-p.hydrophileFriction * bite * dt)

    for (let i = 0; i < n; i++) {
      const gel = this.frozen[i] === 1
      const gaz = this.gaseous[i] === 1
      // La GLACE sent la chimie AU CONTACT (tableau des règles) : bumper
      // hydrophobe, freinage hydrophile — mais c'est le PALET entier qui
      // répond, pas la particule : la réponse vit dans icePass, où le bloc
      // rigide encaisse ses chocs. (Une réponse par particule serait diluée
      // par la moyenne de l'amas puis écrasée par l'impulsion rigide.)
      if (gel) continue
      const mat = this.contactMat[i]
      // CODEX : chaque contact du corps consigne sa combinaison état × matériau
      if (mat >= 0 && this.kind[i] === KIND_PLAYER)
        this.codexContacts[mat * 3 + (gaz ? 2 : 0)] = 1
      // LA VAPEUR QUI N'EST PLUS À VOUS PERLE OÙ ELLE TOUCHE. Le souffle du
      // dash (et toute vapeur détachée du corps) se condense à la première
      // paroi : elle redevient goutte, s'y pose, et attend qu'on vienne la
      // chercher. La vapeur DU CORPS traverse comme avant — le passe-muraille
      // reste intact, c'est seulement l'échappement qui se dépose.
      // (pas sur une MEMBRANE : elle est faite pour ARRÊTER la vapeur — y
      // perler la ferait franchir sous forme de goutte, l'outil de
      // conception perdrait son sens. Le souffle rebondit et perlera ailleurs.)
      if (
        gaz &&
        mat >= 0 &&
        mat !== MAT_MEMBRANE &&
        this.kind[i] !== KIND_PLAYER
      ) {
        this.gaseous[i] = 0
        this.souffle[i] = 0
        this.duCorps[i] = 0 // la rosée du souffle s'attrape au contact, pas à l'aimant
        this.vapor[i] = 0
        // la trace « était vapeur » est effacée : sans cela le rappel de
        // condensation (condenseRegroup) ramènerait la goutte vers le corps
        // — c'est précisément ce qu'on veut empêcher, elle reste au mur
        this.gasLink[i] = 0
        // elle se pose : l'élan retombe, la goutte reste au mur
        this.velX[i] *= 0.12
        this.velY[i] *= 0.12
        this.roseePerlee++
        continue
      }
      if (gaz) {
        // la vapeur ne colle ni ne rebondit — mais les bandes la travaillent
        // légèrement (voir plus bas)
      } else if (mat === MAT_HYDROPHOBE) {
        const vnIn = this.contactVn[i]
        if (vnIn < 0) {
          const nx = this.contactNX[i]
          const ny = this.contactNY[i]
          const vn = this.velX[i] * nx + this.velY[i] * ny
          const target = -vnIn * p.hydrophobeRestitution
          this.velX[i] += (target - vn) * nx
          this.velY[i] += (target - vn) * ny
        }
      } else if (mat === MAT_HYDROPHILE) {
        const nx = this.contactNX[i]
        const ny = this.contactNY[i]
        let vn = this.velX[i] * nx + this.velY[i] * ny
        let vtx = this.velX[i] - vn * nx
        let vty = this.velY[i] - vn * ny
        vtx *= philDamp
        vty *= philDamp
        if (vn > 0) vn *= 0.25 // décoller se paie
        this.velX[i] = vtx + vn * nx
        this.velY[i] = vty + vn * ny
      }

      const x = this.prdX[i]
      const y = this.prdY[i]
      // la vapeur sent les bandes en sourdine mais de LOIN : force réduite,
      // portée étendue — le nuage s'infléchit bien avant la paroi, sans
      // jamais être happé ni claqué
      const poidsBande = gaz ? p.hydroGasWeight : 1
      const porteeGaz = gaz ? p.hydroGasReach : 1
      for (const b of this.chemBoxes) {
        // Le mur neutre n'agit qu'au ras de la paroi ; la chimie porte loin,
        // et encore plus loin pour la vapeur (en sourdine).
        const reach = b.material === MAT_WALL ? wallBand : band * porteeGaz
        if (horsBoite(b, x, y, reach + rp)) continue
        boxContact(x, y, b, cp)
        const sep = cp.dist - rp
        if (sep > 0 && sep < reach) {
          const f = 1 - sep / reach
          if (b.material === MAT_WALL) {
            if (gaz) continue // l'éclat d'impact est une affaire de liquide
            // Mur neutre : l'éclat d'impact vient du rebond de pression qui
            // projette les particules loin de la paroi. On amortit la vitesse
            // sortante AU CONTACT — l'eau s'étale et épouse la forme au lieu
            // de jaillir ; le glissement tangentiel reste libre.
            // Amorti normalisé par le pas : appliqué tel quel, il se cumulait
            // à chaque sous-pas (120 fois par seconde) et la paroi retenait
            // le corps comme un aimant.
            const vn = this.velX[i] * cp.nx + this.velY[i] * cp.ny
            if (vn > 0) {
              const damp = 1 - Math.exp(-p.wallSplashDamp * 60 * f * dt)
              this.velX[i] -= cp.nx * vn * damp
              this.velY[i] -= cp.ny * vn * damp
            }
            continue
          }
          const a =
            (b.material === MAT_HYDROPHILE
              ? -p.hydrophilePull
              : p.hydrophobeRepel) *
            f *
            dt *
            bite *
            poidsBande
          this.velX[i] += cp.nx * a
          this.velY[i] += cp.ny * a
        }
      }
    }
  }

  // Le contact éponge n'est pas mortel : il englue et absorbe après un temps
  // de contact continu. Chaque cellule se sature ; gorgée, elle devient
  // solide — on peut payer un passage en volume (§6). La GLACE et la VAPEUR
  // ne traversent plus (le feutre les bloque, voir la collision) : seul le
  // liquide s'y risque.
  private processSponges(dt: number): void {
    const p = this.params
    const mordant = p.surfaceBite * this.spongeGripFactor
    const drag = Math.exp(-p.spongeDrag * mordant * dt)
    const absorbTime = p.spongeAbsorbTime / Math.max(0.1, mordant)
    let i = 0
    while (i < this.count) {
      if (this.frozen[i] === 1) {
        i++
        continue // la glace n'est pas engluée : un bloc glisse sur l'éponge
      }
      if (this.gaseous[i] === 1) {
        i++
        continue // la vapeur bute sur le feutre : rien à essorer
      }
      let touching = false
      let removed = false
      const x = this.posX[i]
      const y = this.posY[i]
      for (const sp of this.sponges) {
        if (!sp.contains(x, y)) continue
        const cell = sp.cellIndexAt(x, y)
        if (cell < 0 || sp.isSolid(cell)) continue
        touching = true
        this.velX[i] *= drag
        this.velY[i] *= drag
        this.contactTime[i] += dt
        if (this.contactTime[i] >= absorbTime) {
          sp.absorb(cell)
          this.spongeBites++
          this.removeParticle(i)
          removed = true
        }
        break
      }
      if (removed) continue // l'indice i contient maintenant une autre particule
      if (!touching) this.contactTime[i] = 0
      i++
    }
  }

  /** Le plasma RETOMBE. Hors de la bande d'un champ engagé, l'ionisation
   *  s'éteint en ~0,5 s (le nuage redevient vapeur ordinaire, sans à-coup) ;
   *  une particule qui n'est plus gazeuse la perd immédiatement — sans cette
   *  purge, une goutte condensée garderait son ionisation en silence et
   *  renaîtrait violette à sa prochaine vaporisation, des tableaux plus
   *  tard. Inconditionnelle et à part d'applyGasDynamics : celle-ci sort
   *  au premier pas sans gaz, précisément le moment où il faut purger. */
  private fadeIonise(dt: number): void {
    const fade = Math.exp(-2.2 * dt)
    const ionise = this.ionise
    for (let i = 0; i < this.count; i++) {
      if (ionise[i] === 0) continue
      if (this.gaseous[i] !== 1 || ionise[i] < 1e-3) ionise[i] = 0
      else ionise[i] *= fade
    }
  }

  // La vapeur s'étale (répulsion douce entre particules de gaz, réutilise
  // les voisinages du pas) et flotte (freinage propre). L'expansion s'arrête
  // d'elle-même : au-delà de h, plus de répulsion — le nuage trouve son
  // étendue sans jamais se déchirer (le rayon d'amas du gaz est plus grand).
  private applyGasDynamics(dt: number): void {
    const n = this.count
    const gaseous = this.gaseous
    let any = false
    for (let i = 0; i < n; i++) {
      if (gaseous[i] === 1) {
        any = true
        break
      }
    }
    if (!any) return
    const p = this.params
    const k = this.kernels
    const h = k.h
    const h2 = k.h2
    const drag = Math.exp(-p.gasDrag * dt)
    const { prdX, prdY, velX, velY } = this
    const nbStart = this.nbStart
    const nbList = this.nbList
    // Turbulence : deux octaves de tourbillons (rotationnel d'un potentiel,
    // donc sans divergence — le nuage se tord en volutes sans se déchirer).
    // Déterministe : fonction de la position et du temps de simulation.
    const time = this.stepIndex * dt
    const k1 = 0.011
    const k2 = 0.023
    const turb = p.gasTurb * dt
    for (let i = 0; i < n; i++) {
      if (gaseous[i] !== 1) continue
      velX[i] *= drag
      velY[i] *= drag
      const xi = prdX[i]
      const yi = prdY[i]
      if (turb > 0) {
        const c1x =
          -Math.sin(xi * k1 + time * 0.8) * Math.sin(yi * k1 - time * 0.6)
        const c1y =
          -Math.cos(xi * k1 + time * 0.8) * Math.cos(yi * k1 - time * 0.6)
        const c2x =
          -Math.sin(xi * k2 - time * 1.3) * Math.sin(yi * k2 + time * 1.1)
        const c2y =
          -Math.cos(xi * k2 - time * 1.3) * Math.cos(yi * k2 + time * 1.1)
        velX[i] += (c1x * 0.65 + c2x * 0.35) * turb
        velY[i] += (c1y * 0.65 + c2y * 0.35) * turb
      }
      let ax = 0
      let ay = 0
      const end = nbStart[i + 1]
      for (let e = nbStart[i]; e < end; e++) {
        const j = nbList[e]
        if (gaseous[j] !== 1) continue
        const dx = xi - prdX[j]
        const dy = yi - prdY[j]
        const r2 = dx * dx + dy * dy
        if (r2 >= h2 || r2 < 1e-6) continue
        const r = Math.sqrt(r2)
        const a = (p.gasExpand * (1 - r / h)) / r
        ax += dx * a
        ay += dy * a
      }
      velX[i] += ax * dt
      velY[i] += ay * dt
    }
  }

  // Le froid et la glace (§6). Deux chemins vers le gel : l'aura des plaques
  // froides (givre ∝ proximité), et l'intention volontaire (touche F — le
  // corps entier prend, vite). À 1, la particule gèle EN GARDANT sa vitesse :
  // la glace est balistique. Gelée au contact d'une plaque, elle s'y soude
  // (icePass annule la vitesse du bloc). Le dégel — intention levée ET à
  // l'écart du froid — descend sous 0,55 avant de libérer : l'hystérésis
  // évite le clignotement en bord d'aura.
  private processCold(dt: number): void {
    const p = this.params
    // Refroidissement du vaisseau (§5) : les auras froides s'étendent, le gel
    // prend plus vite, le dégel traîne, la vapeur volontaire se fait chère et
    // la condensation ambiante s'accélère — le monde devient moins jouable.
    const chill = this.chill
    const band = p.coldBand * (1 + p.chillColdGrowth * chill)
    const rp = p.particleSpacing * 0.5
    const freeze =
      (dt * p.surfaceBite) / Math.max(0.05, p.freezeTime * (1 - 0.5 * chill))
    const freezeSelf = dt / Math.max(0.05, p.freezeSelfTime * this.basculeFactor)
    const thaw = dt / Math.max(0.1, p.thawTime * (1 + chill))
    const boilTime = p.boilTime * (1 + 2 * p.chillHeatFade * chill)
    const vaporizeTime = p.vaporizeTime * this.basculeFactor * (1 + 1.5 * chill)
    const condenseTime = p.condenseTime * (1 - 0.4 * chill)
    const cp = this.scratchCP
    const intent = this.freezeIntent
    // Ressenti thermique du liquide : l'eau qui givre s'engourdit, l'eau qui
    // chauffe frémit — la température se sent avant le changement d'état
    const time = this.stepIndex * dt
    const agit = p.heatAgitation * dt
    const kAgit = 0.06
    let joueursEnChauffe = 0
    let joueursAuFroid = 0
    for (let i = 0; i < this.count; i++) {
      const x = this.posX[i]
      const y = this.posY[i]
      let exposure = 0
      let minSep = Infinity
      if (this.hasCold) {
        for (const b of this.coldBoxes) {
          if (horsBoite(b, x, y, band + rp)) continue
          boxContact(x, y, b, cp)
          const sep = cp.dist - rp
          if (sep < minSep) minSep = sep
          const f = 1 - Math.max(0, sep) / band
          if (f > exposure) exposure = Math.min(1, f)
        }
      }
      this.welded[i] = this.frozen[i] === 1 && minSep <= 1 ? 1 : 0

      // Radiateur (tableau 4) : l'aura de chaleur, symétrique de l'aura de gel
      const heat = this.heatExposureAt(x, y)
      if (heat > 0 && this.kind[i] === KIND_PLAYER) joueursEnChauffe++
      if (exposure > 0.05 && this.kind[i] === KIND_PLAYER) joueursAuFroid++

      // Vapeur : le froid condense en priorité (vite), puis la chaleur
      // vaporise qu'on le veuille ou non, sinon l'intention (G) vaporise et
      // son absence condense. Hystérésis comme pour la glace.
      // LE SOUFFLE EN VOL reste GAZ jusqu'à ce qu'il touche : sans cela il se
      // condense en plein vol, et le rappel de condensation le ramène au
      // corps — la propulsion redeviendrait gratuite. Son compte à rebours
      // s'épuise : à bout de course, il perle sur place.
      if (this.souffle[i] > 0) {
        this.souffle[i] = Math.max(0, this.souffle[i] - dt)
        if (this.souffle[i] > 0) {
          this.vapor[i] = 1
          this.gaseous[i] = 1
          this.gasLink[i] = 1
          continue
        }
      }
      const wantGas =
        this.gasIntent && this.kind[i] === KIND_PLAYER && this.frozen[i] === 0
      let dv: number
      if (exposure > 0) dv = -exposure * (dt / 0.25)
      else if (heat > 0 && this.frozen[i] === 0)
        dv = heat * (dt / Math.max(0.05, boilTime))
      else if (wantGas) dv = dt / Math.max(0.05, vaporizeTime)
      else dv = -dt / Math.max(0.05, condenseTime)
      let vap = Math.min(1, Math.max(0, this.vapor[i] + dv))
      // L'échauffement du CORPS par un bloc est un effet VISUEL : sans
      // intention, une particule du joueur chauffe (frémit, fume) mais ne
      // bascule plus seule — la transformation se décide au niveau du corps
      // (95 % de la surface active dans la zone d'effet, voir main.ts).
      if (
        heat > 0 &&
        !this.gasIntent &&
        this.kind[i] === KIND_PLAYER &&
        this.gaseous[i] === 0
      ) {
        vap = Math.min(vap, 0.98)
      }
      this.vapor[i] = vap
      if (vap >= 1) this.gaseous[i] = 1
      else if (this.gaseous[i] === 1 && vap <= 0.55) this.gaseous[i] = 0

      // Mémoire de lien : pleine tant que gazeuse, s'éteint doucement après —
      // le temps que le nuage condensé retombe sur le corps
      if (this.gaseous[i] === 1) this.gasLink[i] = 1
      else if (this.gasLink[i] > 0)
        this.gasLink[i] = Math.max(
          0,
          this.gasLink[i] - dt / Math.max(0.2, p.gasLinkDecay),
        )

      // Givre : jamais sur la vapeur — le froid doit d'abord la condenser.
      // La chaleur empêche la prise, et dégèle bien plus vite qu'à l'air libre.
      const wanted =
        intent && this.kind[i] === KIND_PLAYER && this.gaseous[i] === 0
      const canFrost = this.gaseous[i] === 0 && vap < 0.5 && heat <= 0
      const rate = canFrost
        ? Math.max(exposure * freeze, wanted ? freezeSelf : 0)
        : 0
      if (rate > 0) {
        this.frost[i] = Math.min(1, this.frost[i] + rate)
        if (this.frost[i] >= 1 && this.frozen[i] === 0) {
          this.frozen[i] = 1 // la vitesse est conservée
          this.iceDirty = true // la structure des amas vient de changer
        }
      } else {
        const melt =
          heat > 0
            ? Math.max(thaw, (heat * dt) / Math.max(0.05, p.heatThawTime))
            : thaw
        this.frost[i] = Math.max(0, this.frost[i] - melt)
        if (this.frozen[i] === 1 && this.frost[i] <= 0.55) {
          this.frozen[i] = 0
          this.iceDirty = true // un bloc vient de perdre une particule
        }
      }

      // La température se sent dans le liquide lui-même :
      if (this.frozen[i] === 0 && this.gaseous[i] === 0) {
        const fr = this.frost[i]
        // l'eau qui givre s'engourdit — pâteuse, dure à propulser. Le gel
        // VOLONTAIRE (F) y échappe : « geler, c'est parier sur une
        // trajectoire » — l'élan choisi est conservé
        if (
          fr > 0 &&
          p.frostSluggish > 0 &&
          !(wanted && this.kind[i] === KIND_PLAYER)
        ) {
          const damp = Math.exp(-p.frostSluggish * fr * dt)
          this.velX[i] *= damp
          this.velY[i] *= damp
        }
        const warmth = Math.max(this.vapor[i], heat)
        if (warmth > 0.05 && agit > 0) {
          // l'eau qui chauffe frémit : un bouillonnement doux, déterministe.
          // Le SIGNE ALTERNE d'une particule à l'autre : un bruit dont
          // l'amplitude suit la chaleur dérive sinon vers le froid — le
          // radiateur semblait REPOUSSER le corps. Alterné, la dérive
          // collective s'annule, le bouillonnement reste.
          const xi = this.posX[i]
          const yi = this.posY[i]
          const sg = (i & 1) === 0 ? 1 : -1
          const jx =
            -Math.sin(xi * kAgit + time * 5.1) *
            Math.sin(yi * kAgit - time * 4.3)
          const jy =
            -Math.cos(xi * kAgit + time * 5.1) *
            Math.cos(yi * kAgit - time * 4.3)
          this.velX[i] += jx * agit * warmth * sg
          this.velY[i] += jy * agit * warmth * sg
        }
      }
    }

    this.chauffeFrac =
      this.playerCount > 0 ? joueursEnChauffe / this.playerCount : 0
    this.froidFrac =
      this.playerCount > 0 ? joueursAuFroid / this.playerCount : 0

    // La vapeur qui s'attarde dans l'aura d'un radiateur s'évapore : perdue,
    // pas mise en bonbonne. La plus exposée part en premier.
    if (this.hasHeat) {
      let anyHotGas = false
      for (let i = 0; i < this.count; i++) {
        if (
          this.gaseous[i] === 1 &&
          this.heatExposureAt(this.posX[i], this.posY[i]) > 0
        ) {
          anyHotGas = true
          break
        }
      }
      if (anyHotGas) {
        this.heatCarry += p.heatLossRate * p.surfaceBite * dt
        while (this.heatCarry >= 1) {
          this.heatCarry -= 1
          let best = -1
          let bestHeat = 0
          for (let i = 0; i < this.count; i++) {
            if (this.gaseous[i] !== 1) continue
            const h = this.heatExposureAt(this.posX[i], this.posY[i])
            if (h > bestHeat) {
              bestHeat = h
              best = i
            }
          }
          if (
            best < 0 ||
            (this.kind[best] === KIND_PLAYER && this.playerCount <= 2)
          )
            break
          this.removeParticle(best)
          this.vaporBank++
        }
      } else {
        this.heatCarry = 0
      }
    }
  }

  // Les blocs de glace : chaque amas connexe de particules gelées est un
  // corps rigide en translation — une seule vitesse pour tout l'amas (la
  // moyenne), un rebond commun quand l'un de ses points touche une paroi,
  // l'arrêt complet si l'un d'eux est soudé à une plaque froide.
  private icePass(dt: number): void {
    const n = this.count
    const frozen = this.frozen
    let any = false
    for (let i = 0; i < n; i++) {
      if (frozen[i] === 1) {
        any = true
        break
      }
    }
    if (!any) {
      this.gelAngle = 0 // plus de glace : le repère du gel repart de zéro
      return
    }
    const p = this.params
    const linkR = p.linkRadiusFactor * p.kernelRadius
    const linkR2 = linkR * linkR
    const { prdX, prdY, velX, velY } = this
    const labels = this.iceLabels
    const grid = this.grid
    const scratch = this.relabelScratch
    // L'étiquetage des amas est en CACHE : il ne se refait que sur un
    // événement de structure (gel, dégel, retrait — voir iceDirty) ou au
    // plus tard toutes les 6 pas (50 ms), le temps de latence accepté pour
    // qu'une FUSION de deux blocs qui se touchent soit constatée. Le bloc
    // étant rigide, sa connexité ne change jamais entre deux événements —
    // c'était LE poste dominant de la phase palet (~1,6 ms/pas à 900).
    let comps: number
    if (this.iceDirty || --this.iceLabelTtl <= 0) {
      const forEachIce = (i: number, cb: (j: number) => void) => {
        if (frozen[i] === 0) return // le liquide : singletons, hors des blocs
        const xi = prdX[i]
        const yi = prdY[i]
        const end = grid.collect(
          prdX,
          prdY,
          xi,
          yi,
          linkR,
          i,
          scratch,
          0,
          scratch.length,
        )
        for (let e = 0; e < end; e++) {
          const j = scratch[e]
          if (frozen[j] === 0) continue
          const dx = xi - prdX[j]
          const dy = yi - prdY[j]
          if (dx * dx + dy * dy <= linkR2) cb(j)
        }
      }
      comps = labelComponents(n, labels, forEachIce, this.stack)
      this.iceComps = comps
      this.iceDirty = false
      this.iceLabelTtl = 6
    } else {
      comps = this.iceComps
    }
    this.iceVxSum.fill(0, 0, comps)
    this.iceVySum.fill(0, 0, comps)
    this.iceCnt.fill(0, 0, comps)
    this.iceNxSum.fill(0, 0, comps)
    this.iceNySum.fill(0, 0, comps)
    this.iceWeld.fill(0, 0, comps)
    this.iceCxSum.fill(0, 0, comps)
    this.iceCySum.fill(0, 0, comps)
    this.icePxSum.fill(0, 0, comps)
    this.icePySum.fill(0, 0, comps)
    this.icePCnt.fill(0, 0, comps)
    this.iceInertia.fill(0, 0, comps)
    this.iceOmega.fill(0, 0, comps)
    this.icePhobe.fill(0, 0, comps)
    this.icePhile.fill(0, 0, comps)

    // 1. masse, centre de masse, vitesse moyenne, et point de contact moyen
    for (let i = 0; i < n; i++) {
      if (frozen[i] === 0) continue
      const c = labels[i]
      this.iceVxSum[c] += velX[i]
      this.iceVySum[c] += velY[i]
      this.iceCxSum[c] += prdX[i]
      this.iceCySum[c] += prdY[i]
      this.iceCnt[c]++
      if (this.contactMat[i] >= 0) {
        // CODEX : la glace consigne aussi ses contacts (matériau × état 1)
        this.codexContacts[this.contactMat[i] * 3 + 1] = 1
        if (this.contactMat[i] === MAT_HYDROPHOBE) this.icePhobe[c]++
        else if (this.contactMat[i] === MAT_HYDROPHILE) this.icePhile[c]++
        this.iceNxSum[c] += this.contactNX[i]
        this.iceNySum[c] += this.contactNY[i]
        // le point d'application compte autant que la direction : c'est son
        // excentrement par rapport au centre qui fait tourner le palet
        this.icePxSum[c] += prdX[i]
        this.icePySum[c] += prdY[i]
        this.icePCnt[c]++
      }
      if (this.welded[i] === 1) this.iceWeld[c] = 1
    }

    // 2. moment cinétique et moment d'inertie, autour du centre de masse
    //    (masses unitaires : la masse d'un bloc est son nombre de particules)
    for (let i = 0; i < n; i++) {
      if (frozen[i] === 0) continue
      const c = labels[i]
      const cnt = this.iceCnt[c]
      if (cnt === 0) continue
      const rx = prdX[i] - this.iceCxSum[c] / cnt
      const ry = prdY[i] - this.iceCySum[c] / cnt
      const dvx = velX[i] - this.iceVxSum[c] / cnt
      const dvy = velY[i] - this.iceVySum[c] / cnt
      this.iceOmega[c] += rx * dvy - ry * dvx // moment cinétique, provisoirement
      this.iceInertia[c] += rx * rx + ry * ry
    }

    const rest = Math.min(
      1,
      Math.max(0, p.iceRestitution * this.iceBounceFactor),
    )
    const MAX_SPIN = 14 // rad/s : au-delà, un palet devient illisible
    for (let c = 0; c < comps; c++) {
      const cnt = this.iceCnt[c]
      if (cnt === 0) continue
      let vx = this.iceVxSum[c] / cnt
      let vy = this.iceVySum[c] / cnt
      const cx = this.iceCxSum[c] / cnt
      const cy = this.iceCySum[c] / cnt
      const I = this.iceInertia[c]
      let omega = I > 1e-6 ? this.iceOmega[c] / I : 0

      if (this.iceWeld[c] === 1) {
        vx = 0
        vy = 0
        omega = 0 // soudé à la plaque : plus de translation ni de rotation
      } else if (this.icePCnt[c] > 0) {
        // La chimie se lit à l'échelle du palet : la surface qui touche le
        // plus de particules dicte la réponse du bloc (tableau des règles —
        // bumper hydrophobe, mouillage hydrophile).
        const surPhobe =
          this.icePhobe[c] > 0 && this.icePhobe[c] >= this.icePhile[c]
        const surPhile = !surPhobe && this.icePhile[c] > 0
        const nl = Math.hypot(this.iceNxSum[c], this.iceNySum[c])
        if (nl > 1e-6) {
          const nx = this.iceNxSum[c] / nl
          const ny = this.iceNySum[c] / nl
          // bras de levier : du centre de masse au point de contact
          const rx = this.icePxSum[c] / this.icePCnt[c] - cx
          const ry = this.icePySum[c] / this.icePCnt[c] - cy
          // vitesse du POINT DE CONTACT, rotation comprise
          const vpx = vx - omega * ry
          const vpy = vy + omega * rx
          const vn = vpx * nx + vpy * ny
          if (vn < 0) {
            // impulsion de choc d'un corps rigide : le dénominateur mélange
            // masse et inertie — un choc excentré transfère une part de
            // l'élan en ROTATION au lieu de tout renvoyer en translation.
            // Le bumper hydrophobe REND PLUS qu'il ne reçoit (restitution
            // propre + plancher d'éjection) ; l'hydrophile absorbe le choc.
            const rn = rx * ny - ry * nx
            const denom = 1 / cnt + (I > 1e-6 ? (rn * rn) / I : 0)
            let vnOut =
              -vn *
              (surPhobe ? p.hydrophobeIceRestitution : surPhile ? 0 : rest)
            if (surPhobe && vnOut < p.hydrophobeIceKick)
              vnOut = p.hydrophobeIceKick
            const j = (vnOut - vn) / denom
            vx += (j * nx) / cnt
            vy += (j * ny) / cnt
            if (I > 1e-6) omega += (j * rn) / I
            if (-vn > this.iceImpact) this.iceImpact = -vn
          }
        }
        if (surPhile) {
          // le mouillage retient : le palet qui glisse sur l'hydrophile
          // s'essouffle, translation et rotation comprises
          const damp = Math.exp(
            -p.hydrophileIceDrag * p.surfaceBite * this.glisseGlaceFactor * dt,
          )
          vx *= damp
          vy *= damp
          omega *= damp
        }
      }
      if (omega > MAX_SPIN) omega = MAX_SPIN
      else if (omega < -MAX_SPIN) omega = -MAX_SPIN

      this.iceVxSum[c] = vx // réutilisés : mouvement final du bloc
      this.iceVySum[c] = vy
      this.iceCxSum[c] = cx
      this.iceCySum[c] = cy
      this.iceOmega[c] = omega
    }

    // Le repère du gel suit la PLUS GROSSE composante : translation par son
    // centre, rotation intégrée pas à pas. Un bloc soudé (omega nul) fige
    // aussi son repère — les facettes ne bougent plus d'un poil.
    let cBest = -1
    for (let c = 0; c < comps; c++)
      if (
        this.iceCnt[c] > 0 &&
        (cBest < 0 || this.iceCnt[c] > this.iceCnt[cBest])
      )
        cBest = c
    if (cBest >= 0) {
      this.gelAngle += this.iceOmega[cBest] * dt
      this.gelCentreX = this.iceCxSum[cBest]
      this.gelCentreY = this.iceCySum[cBest]
    } else {
      this.gelAngle = 0
    }

    // 3. projection sur un mouvement de corps rigide : translation + rotation
    for (let i = 0; i < n; i++) {
      if (frozen[i] === 0) continue
      const c = labels[i]
      const w = this.iceOmega[c]
      velX[i] = this.iceVxSum[c] - w * (prdY[i] - this.iceCySum[c])
      velY[i] = this.iceVySum[c] + w * (prdX[i] - this.iceCxSum[c])
    }
  }

  // Le corps du joueur est la composante connexe qui recouvre le mieux le
  // corps précédent. Deux masses d'eau qui se touchent fusionnent — ce n'est
  // pas une règle, c'est la connexité (§3.1). Une gouttelette détachée est
  // perdue. Les particules fraîchement éjectées (cooldown > 0) ne sont pas
  // réabsorbées immédiatement.
  relabel(): void {
    const n = this.count
    if (n === 0) return
    const p = this.params
    const linkR = p.linkRadiusFactor * p.kernelRadius
    const linkR2 = linkR * linkR
    // Le nuage de vapeur est distendu : son rayon d'adjacence est élargi,
    // sinon l'expansion du gaz compterait comme une dispersion. Le rayon
    // suit la vapeur RÉSIDUELLE (continue), pas l'étiquette gazeuse : en
    // condensant, le lien se resserre au rythme où le corps se regroupe,
    // au lieu de tomber d'un coup — redevenir eau ne scinde pas l'amas.
    const gasSpan = Math.max(1, p.gasLinkFactor) - 1
    const { posX, posY, labels, gasLink } = this
    // Rayon de recherche asservi à la vapeur RÉELLEMENT présente : le rayon
    // par paire vaut linkR·(1 + span·max(gi, gj)) ≤ linkR·(1 + span·gmax) —
    // chercher à gmax couvre donc exactement les mêmes liens. Sans vapeur
    // (gmax = 0, le régime courant), on balaie 9 cellules par particule au
    // lieu de ~60 : relabel était le pic CPU périodique de la frame.
    let gmax = 0
    for (let i = 0; i < n; i++) if (gasLink[i] > gmax) gmax = gasLink[i]
    const gasLinkR = linkR * (1 + gasSpan * gmax)
    const grid = this.grid
    grid.build(posX, posY, n)

    // Chemin sans rappel par voisin : les candidats sont collectés d'un bloc
    // dans un tampon (grid.collect, zéro allocation), puis filtrés en place —
    // le parcours en profondeur ne paie plus deux couches de fermetures par
    // particule visitée (relabel était le pic CPU périodique de la frame).
    const scratch = this.relabelScratch
    const forEachNeighbor = (i: number, cb: (j: number) => void) => {
      const xi = posX[i]
      const yi = posY[i]
      const gi = gasLink[i]
      const end = grid.collect(
        posX,
        posY,
        xi,
        yi,
        gasLinkR,
        i,
        scratch,
        0,
        scratch.length,
      )
      for (let e = 0; e < end; e++) {
        const j = scratch[e]
        const v = gi > gasLink[j] ? gi : gasLink[j]
        if (v > 0) {
          const dx = xi - posX[j]
          const dy = yi - posY[j]
          const lr = linkR * (1 + gasSpan * v)
          if (dx * dx + dy * dy <= lr * lr) cb(j)
        } else {
          const dx = xi - posX[j]
          const dy = yi - posY[j]
          if (dx * dx + dy * dy <= linkR2) cb(j)
        }
      }
    }
    const componentCount = labelComponents(
      n,
      labels,
      forEachNeighbor,
      this.stack,
    )

    // Composante contenant le plus de particules de l'ancien corps
    // (tampon réutilisé : relabel tourne à chaque frame, une allocation ici
    // devient une rafale de passages du ramasse-miettes)
    const playerPerLabel = this.compScratch
    playerPerLabel.fill(0, 0, componentCount)
    for (let i = 0; i < n; i++) {
      if (this.kind[i] === KIND_PLAYER) playerPerLabel[labels[i]]++
    }
    let playerLabel = -1
    let bestCount = 0
    for (let c = 0; c < componentCount; c++) {
      if (playerPerLabel[c] > bestCount) {
        bestCount = playerPerLabel[c]
        playerLabel = c
      }
    }
    // Dans l'emprise du sas, la perte de cohésion n'est pas une dispersion :
    // c'est le trou qui boit le corps — le jeu conclut en victoire, pas en
    // défaite, même si le volume restant passe sous le seuil critique.
    // Marge ×1,3 : une éclaboussure qui déborde brièvement du rayon pendant
    // que le sas boit ne doit pas requalifier la fin en dispersion.
    const inDrainGrip =
      this.drainOn &&
      Math.hypot(
        this.stats.centroidX - this.mouthX,
        this.stats.centroidY - this.mouthY,
      ) <
        this.params.exitRadius * this.exitRadiusFactor * 1.3

    if (playerLabel < 0) {
      this.playerCount = 0
      this.enPretCount = 0
      if (!inDrainGrip) this.dispersed = true
      return
    }

    let count = 0
    for (let i = 0; i < n; i++) {
      if (labels[i] === playerLabel && this.cooldown[i] <= 0) {
        this.kind[i] = KIND_PLAYER
        this.duCorps[i] = 0 // reprise : la marque d'égarement s'efface
        count++
      } else {
        // un fragment que le remous vient de DÉTACHER reste du corps : sans
        // la marque, la vie baisse pour une matière qui gît à deux doigts
        if (this.kind[i] === KIND_PLAYER) this.duCorps[i] = 1
        this.kind[i] = KIND_FREE
      }
    }
    this.playerCount = count

    // EN PRÊT : marquée du corps et encore dans le HALO du corps (le rayon
    // de capture, celui du rappel). Tout ce qui reste dans le halo REVIENDRA
    // (le rappel des égarées s'en charge) : le compter vivant est donc la
    // stricte vérité — et la jauge ne cille plus au rythme des tirs. La
    // sortie du halo se juge avec hystérésis (15 % plus loin que l'entrée) :
    // une goutte qui danse à la frontière ne fait pas clignoter la vie.
    this.updatePlayerStats()
    const capture = this.captureRadius()
    const cIn2 = capture * capture
    const cOut = capture * 1.15
    const cOut2 = cOut * cOut
    const cx2 = this.stats.centroidX
    const cy2 = this.stats.centroidY
    // Pendant que le SAS BOIT, le halo s'éteint : le corps aspiré ne peut
    // plus aller rechercher quoi que ce soit, et compter ses miettes
    // vivantes empêchait la fin de run de conclure (la vie ne tombait
    // jamais à zéro — le sursis se réarmait en boucle).
    const haloActif = !this.drainOn
    let prets = 0
    for (let i = 0; i < n; i++) {
      if (this.duCorps[i] === 0 || this.kind[i] !== KIND_FREE) continue
      if (this.frozen[i] === 1 || this.gaseous[i] === 1) {
        this.duCorps[i] = 1 // gelée ou gazeuse : plus pilotable, plus vivante
        continue
      }
      const dx = posX[i] - cx2
      const dy = posY[i] - cy2
      const d2 = dx * dx + dy * dy
      const dedans =
        haloActif && (this.duCorps[i] === 2 ? d2 <= cOut2 : d2 <= cIn2)
      this.duCorps[i] = dedans ? 2 : 1
      if (dedans) prets++
    }
    this.enPretCount = prets
    // (les stats sont déjà à jour : recalculées juste avant la passe du halo)

    if (inDrainGrip) {
      this.belowCritical = false
      return
    }
    // Sous le seuil critique : constaté ici, tranché par le délai de grâce
    // (dispersalGrace, dans step) — un corps en pleine transformation a le
    // temps de se regrouper avant que le protocole ne conclue à la perte.
    this.belowCritical =
      (count + prets) * p.litersPerParticle <
      p.criticalVolumeLiters * this.criticalFactor
    if (count < 2) this.dispersed = true
  }

  updatePlayerStats(): void {
    const n = this.count
    let cx = 0
    let cy = 0
    let vx = 0
    let vy = 0
    let m = 0
    for (let i = 0; i < n; i++) {
      if (this.kind[i] !== KIND_PLAYER) continue
      cx += this.posX[i]
      cy += this.posY[i]
      vx += this.velX[i]
      vy += this.velY[i]
      m++
    }
    if (m === 0) return
    cx /= m
    cy /= m
    vx /= m
    vy /= m
    let r2sum = 0
    for (let i = 0; i < n; i++) {
      if (this.kind[i] !== KIND_PLAYER) continue
      const dx = this.posX[i] - cx
      const dy = this.posY[i] - cy
      r2sum += dx * dx + dy * dy
    }
    this.stats.count = m
    this.stats.centroidX = cx
    this.stats.centroidY = cy
    this.stats.velX = vx
    this.stats.velY = vy
    this.stats.rmsRadius = Math.sqrt(r2sum / m)
  }

  totalMomentum(): { px: number; py: number } {
    let px = 0
    let py = 0
    for (let i = 0; i < this.count; i++) {
      px += this.velX[i]
      py += this.velY[i]
    }
    return { px, py }
  }

  // La matière VIVANTE : le corps, plus les gouttes en prêt encore dans le
  // volume. La règle : n'est perdu que ce qui SORT.
  aliveCount(): number {
    return this.playerCount + this.enPretCount
  }

  liters(): number {
    return this.aliveCount() * this.params.litersPerParticle
  }
}
