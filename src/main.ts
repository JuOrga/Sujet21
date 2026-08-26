import '@fontsource/michroma'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
import { DEFAULT_PARAMS, type SimParams } from './sim/params'
import { FluidSim, KIND_PLAYER } from './sim/solver'
import { NoyauxWasm } from './sim/wasm'
import { TROPHEES, Trophees } from './game/trophees'
import { CODEX, Codex, type CodexGroupe } from './game/codex'
import { TABLEAU_HUB } from './game/hub'
import {
  MECANIQUE_NOMS,
  codeCanon,
  decodeCode21,
  decodeCodeAtelier,
  estCodeHub,
  type CodeAtelier,
} from './game/levelIO'
import { dessineMiniCarte } from './game/carte'
import { propositionsSalles } from './game/poule'
import { CIRCUITS } from './game/circuits'
import {
  BONBONNE_CAP,
  PALIERS_XP,
  instrumentDef,
  paliersAtteints,
  prochainPalier,
  tirageInstruments,
} from './game/instruments'
import { dansForme, formeOutline } from './game/formes'
import { DELIVERIES, VERSION, versionDe } from './bench/changelog'
import { Camera } from './render/camera'
import { MAX_BOXES, Renderer } from './render/renderer'
import { FixedLoop } from './game/loop'
import { Input } from './game/input'
import {
  MAT_EXIT,
  MAT_FROID,
  TABLEAU_10,
  TABLEAU_11,
  TABLEAU_12,
  TABLEAU_13,
  TABLEAU_1BIS,
  TABLEAU_8,
  TABLEAU_9,
  TABLEAUX,
  TABLEAUX_ECOLE,
  MAT_CHAUD,
  MAT_WALL,
  pointInBox,
  zoneForceAt,
  zoneName,
  zoneShape,
  type LevelDef,
  type LumiereDef,
  type ObstacleBox,
  type ZoneForce,
  AMBIANTE_DEFAUT,
} from './game/level'
import { LevelEditor } from './editor/editor'
import {
  traceLaser,
  creerEtatRecepteurs,
  avancerRecepteurs,
  cibleActive,
  canalActif,
  type TraceResultat,
} from './game/laser'
import { BOUTON, Manette } from './game/manette'
import { PerfCollector } from './game/perf'
import {
  fetchLibrary,
  reorderLibrary,
  saveLevel,
  type StoredLevel,
} from './game/netLevels'
import { AudioFx, loadAudioPrefs } from './game/audio'
import {
  Soundtrack,
  type Bruitage,
  type Piste,
  type Ponctuation,
} from './game/soundtrack'
import {
  CINEMATIQUES_LIVREES,
  chargeCinematiques,
  type CinematiqueDef,
} from './game/cinematique'
import { LecteurCinematique } from './game/cinelecteur'
import { TableMontage } from './game/montage'
import { Imagerie } from './game/imagerie'
import { fetchBibliotheque } from './game/netCines'
import {
  SEQUENCE_ALERTE,
  Sequenceur,
  chargeSequences,
  type SequenceDef,
} from './game/sequence'
import {
  type EtatScenario,
  type MomentScenario,
  type ScenarioDef,
  chargeScenario,
  chargeVues,
  choisitRegle,
  noteVue,
  sauveScenario,
} from './game/scenario'
import { Records } from './game/records'
import {
  fetchSharedBoard,
  pushExpeditionRecord,
  pushTableauRecord,
  type SharedBoard,
} from './game/netRecords'
import { createBench, type BenchMonitor } from './bench/bench'

const CAPACITY = 4096
// (l'ancien délai d'affichage du bilan a cédé la place à la MISE EN
// BONBONNE : c'est le choix d'instrument qui mène au tableau suivant)

const params: SimParams = { ...DEFAULT_PARAMS }

// L'expédition (§7) : les tableaux en séquence, UNE fois. Le surplus de
// chaque sas part en bonbonne ; seul le dernier sas conclut l'expédition.
// Pendant ce temps, le vaisseau refroidit (§5) : pas de chronomètre affiché,
// le monde devient moins jouable — c'est la pression temporelle.
const run = {
  bonbonneLiters: 0,
  exitTimer: 0, // > 0 : bilan de sortie affiché, tableau suivant imminent
  tableauTime: 0, // secondes simulées depuis l'entrée du tableau (pour les records)
  runTime: 0, // secondes simulées depuis le début de l'expédition (refroidissement)
  ended: false, // expédition conclue : bilan affiché, en attente de la suivante
  // Les VIES du roguelike : des ÉCHANTILLONS DE SECOURS. On part avec UN
  // seul — toujours. Une dispersion en consomme un et renvoie à la première
  // goutte du tableau ; le dernier perdu, c'est la fin de la run — retour
  // au labo. Les échantillons SUPPLÉMENTAIRES ne se gagnent pas en route :
  // ils se FARMENT (façon Hadès) — futur banc d'étalonnage (permanent,
  // payé en condensat) et instruments embarqués (par run).
  vies: 1,
  conclues: 0, // salles conclues cette run (statistique, et futur farm)
  // Les INSTRUMENTS EMBARQUÉS : les cartes emportées aux mises en bonbonne
  // de cette run — des avantages latéraux, perdus à la fin de la run.
  instruments: [] as string[],
  // L'XP D'ÉTALONNAGE : les litres versés côté instruments — chaque palier
  // franchi (PALIERS_XP) ouvre un tirage de cartes.
  xp: 0,
  // Le TOTAL LIVRÉ de la run (records d'expédition) : la bonbonne, elle,
  // est une réserve qui se VIDE quand on la verse dans le corps.
  livreTotal: 0,
}
const VIES_MAX = 3 // plafond, étalonnage et instruments compris
// Sonde de test : l'état de la run depuis la console (comme __sim, __cam)
;(window as unknown as { __run: typeof run }).__run = run

// ---- LE CONDENSAT : la monnaie méta du roguelike. Chaque centilitre livré
// au sas est CONSERVÉ par le labo, toutes runs confondues — c'est lui qui
// paiera le banc d'étalonnage (améliorations permanentes, dont les
// échantillons de secours supplémentaires). Farmer, sacrifier des runs :
// rien de ce qu'on livre n'est perdu.
const CLE_CONDENSAT = 'sujet21-condensat-v1'
let condensat = (() => {
  try {
    const v = Math.floor(Number(localStorage.getItem(CLE_CONDENSAT)))
    return Number.isFinite(v) && v > 0 ? v : 0
  } catch {
    return 0
  }
})()
function gagneCondensat(cl: number): void {
  if (cl <= 0) return
  condensat += Math.round(cl)
  try {
    localStorage.setItem(CLE_CONDENSAT, String(condensat))
  } catch {
    // stockage indisponible : le condensat vivra le temps de la session
  }
  majCondensatUI()
}
/** Débite la réserve si elle suffit — la première dépense du condensat
 * (cartes payantes de la mise en bonbonne). */
function depenseCondensat(cl: number): boolean {
  if (cl <= 0) return true
  if (condensat < cl) return false
  condensat -= cl
  try {
    localStorage.setItem(CLE_CONDENSAT, String(condensat))
  } catch {
    // stockage indisponible : la dépense vivra le temps de la session
  }
  majCondensatUI()
  return true
}
function majCondensatUI(): void {
  const dd = document.getElementById('home-condensat')
  if (dd) dd.textContent = `${condensat} cL`
}
majCondensatUI()

function chillNow(): number {
  // la gaine isolante (instrument embarqué) ralentit le refroidissement
  const gaine = run.instruments.includes('gaine-isolante') ? 1.5 : 1
  return Math.min(1, run.runTime / (Math.max(30, params.chillDuration) * gaine))
}

// Effets sonores : le contexte audio naît au premier geste (clic, toucher)
const audio = new AudioFx(loadAudioPrefs())
// Bande-son : mêmes réglages, même bus — elle ne s'éveille qu'au premier geste
// et ne télécharge rien tant que le son est coupé.
const bande = new Soundtrack(audio)
function eveilAudio(): void {
  audio.resume()
  if (audio.enabled) {
    bande.eveiller()
  }
  majInviteSon()
}
window.addEventListener('pointerdown', eveilAudio)
window.addEventListener('keydown', eveilAudio)
// Le navigateur n'autorise le son qu'après un geste : sans invitation, le
// premier geste de la partie est le clic sur COMMENCER, et le thème d'accueil
// n'aurait jamais l'occasion de se faire entendre. La fiche le propose donc.
// Le son s'éveille au premier geste (toucher, clic, touche) — plus de
// bouton d'activation. La fiche garde un simple MUTE, comme la barre du jeu.
const btnMute = document.getElementById('home-mute') as HTMLButtonElement | null
function majInviteSon(): void {
  if (btnMute)
    btnMute.innerHTML = audio.enabled
      ? '<i>♪</i><span>SON</span>'
      : '<i>⊘</i><span>MUET</span>'
}
btnMute?.addEventListener('click', () => {
  audio.setEnabled(!audio.enabled)
  if (audio.enabled) eveilAudio()
  majInviteSon()
})
majInviteSon()
// Mémoire pour les transitions sonores (fronts d'état)
const sfx = {
  allFrozen: false,
  allGas: false,
  dispersed: false,
  swallowed: 0,
  aiming: false,
  dropTimer: 0,
  lastCall: false,
  spent: false,
}

// Registres du labo (§10) : records par tableau et historique des essais.
const records = new Records()

function fmtTime(s: number): string {
  return `${s.toFixed(1).replace('.', ',')} s`
}

// Les litres à la française : la virgule, pas le point
function fmtL(l: number): string {
  return `${l.toFixed(2).replace('.', ',')} L`
}

// Les durées d'expédition se lisent en minutes : « 13:32 » plutôt que 812 s
function fmtDuree(s: number): string {
  if (s < 120) return fmtTime(s)
  const mn = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${mn}:${String(sec).padStart(2, '0')}`
}

// ---- Moteur physique : les noyaux WASM (public/noyaux.wasm), chargés en
// arrière-plan. Choix mémorisé (sujet21-moteur) : WASM par défaut quand le
// module charge, JAVASCRIPT sinon ou sur demande — le retour arrière est
// instantané, même en pleine partie (le solveur bascule au pas suivant).
let noyauxWasm: NoyauxWasm | null = null
// Défaut : JAVASCRIPT — verdict des rapports du Pixel (A/B propre du
// 15/08) : le JIT mobile bat les noyaux WASM de ~40 % sur ces boucles.
// Le WASM reste en option : c'est un instrument de mesure, pas un dogme.
let moteurChoisi = localStorage.getItem('sujet21-moteur') ?? 'js'
function appliqueMoteur(s: FluidSim): void {
  s.noyauxWasm = noyauxWasm
  s.moteurWasm = noyauxWasm !== null && moteurChoisi === 'wasm'
}

function createSim(level: LevelDef): FluidSim {
  const sim = new FluidSim(params, level.bounds, CAPACITY)
  appliqueMoteur(sim)
  // les dashs sont la RÉSERVE DU TABLEAU : N par écran (le tableau peut
  // fixer son propre nombre, sinon celui du banc), pleins dès le chargement.
  // Changer d'état n'y touche jamais — la chaudière transforme, elle ne
  // recharge pas — et seul un surchauffeur frôlé en rend un, plafonné au max.
  sim.dashBudgetMax = level.dashBudget ?? params.gasDashBudget
  // Instruments embarqués : la buse calibrée agrandit la réserve d'un dash,
  // l'aimant à rosée bonifie la recondensation
  if (run.instruments.includes('buse-calibree')) sim.dashBudgetMax += 1
  if (run.instruments.includes('aimant-rosee')) sim.recondBonus = 0.35
  const naitVapeur =
    zoneForceAt(level, level.spawn.x, level.spawn.y) === 'vapeur'
  sim.dashBudget = sim.dashBudgetMax
  sim.setLevel(level.boxes, level.sponges)
  sim.spawnDisc(level.spawn.x, level.spawn.y, level.spawn.n, KIND_PLAYER)
  // né dans une zone qui impose la vapeur : le corps EST un nuage dès la
  // première image — sinon le compteur annonce des dashs qui ne partent pas,
  // le temps que la vaporisation progressive s'achève
  if (naitVapeur) sim.naitEnVapeur()
  sim.relabel()
  return sim
}

// Enchaînement des tableaux : chaque sas mène au suivant, puis on boucle.
let levelIndex = 0
// Aide au level design : ?tableau=N démarre où l'on veut, ?spawn=x,y place le corps
{
  const q = new URLSearchParams(location.search)
  const t = Number(q.get('tableau'))
  if (Number.isFinite(t) && t >= 1 && t <= TABLEAUX.length) levelIndex = t - 1
  const spawnParam = q.get('spawn')
  if (spawnParam) {
    const [sx, sy] = spawnParam.split(',').map(Number)
    if (Number.isFinite(sx) && Number.isFinite(sy)) {
      const lv = TABLEAUX[levelIndex]
      lv.spawn = { ...lv.spawn, x: sx, y: sy }
    }
  }
}
// La séquence jouable : les tableaux de la bibliothèque partagée d'abord
// (dans l'ordre fixé par l'éditeur), puis TOUS les tableaux livrés, dans
// l'ordre choisi de l'expédition. La bibliothèque ne REMPLACE plus
// l'expédition — elle s'y enchaîne (avant : un seul tableau d'éditeur
// amputait les 13 livrés). Un tableau de bibliothèque qui porte le CODE
// d'un livré (une variante de 21-A) prend sa place : pas de doublon, la
// version de l'éditeur prime. Memoïsé : le HUD interroge chaque image.
let libraryLevels: LevelDef[] = []
let sequenceCache: { source: LevelDef[]; seq: LevelDef[] } | null = null
function playedLevels(): LevelDef[] {
  if (sequenceCache?.source !== libraryLevels) {
    // le HUB (code « HUB ») vit dans la bibliothèque comme salle spéciale :
    // éditable comme les autres, mais jamais dans la séquence de l'expédition.
    // TOUTE la famille est écartée (HUB2, les chantiers…) : une copie du hub
    // publiée deviendrait la « salle 1 » et le sas semblerait y renvoyer.
    const jouables = libraryLevels.filter((l) => !estCodeHub(l.code))
    const codes = new Set(jouables.map((l) => l.code))
    sequenceCache = {
      source: libraryLevels,
      seq:
        jouables.length === 0
          ? TABLEAUX
          : [...jouables, ...TABLEAUX.filter((t) => !codes.has(t.code))],
    }
  }
  return sequenceCache.seq
}

// Le hub joué : la version publiée dans la bibliothèque (code « HUB ») prime
// sur celle du code — le laboratoire se remodèle depuis l'éditeur.
function hubLevel(): LevelDef {
  return libraryLevels.find((l) => l.code === 'HUB') ?? TABLEAU_HUB
}

// Un essai hors expédition : un tableau à part (prototype, salle laser,
// tableau d'éditeur), sans toucher aux registres. La FILE enchaîne les
// tableaux d'essai au sas — la trilogie laser se joue ainsi.
let testLevel: LevelDef | null = null
// La file d'essai est mixte : tableaux et cinématiques s'y enchaînent.
let testQueue: (LevelDef | CinematiqueDef)[] = []
let level: LevelDef = TABLEAUX[levelIndex]
// Les boîtes rendues incluent le sas (rendu seulement, pas de physique solide),
// et la bouche d'aspiration est le centre du sas du tableau courant.
let renderBoxes: ObstacleBox[] = []
let levelHasCold = false // le HUD n'annonce la rosée que si des plaques la rendent
const exitMouth = { x: 0, y: 0 }
// LE HUB : le module d'accueil (src/game/hub.ts) — la zone de départ du
// roguelike. Prioritaire derrière les essais (testLevel) : l'éditeur et les
// parcours d'essai passent toujours devant. C'est aussi le décor du
// CHARGEMENT : derrière la fiche, l'échantillon dérive déjà dans la cuve
// d'entraînement (sauf navigation directe ?tableau=N, outil de conception).
let auHub = !new URLSearchParams(location.search).has('tableau')
// Le tableau COMMENCE-t-il en vapeur (départ posé dans une zone qui
// l'impose) ? Alors la vapeur est l'ÉTAT INITIAL, pas une bascule : elle ne
// se paie pas. Le drapeau se consomme au premier basculement de l'image.
let departEnVapeur = false

function applyLevel(): void {
  level =
    testLevel ??
    (auHub ? hubLevel() : (playedLevels()[levelIndex] ?? playedLevels()[0]))
  levelHasCold = level.boxes.some((b) => b.material === MAT_FROID)
  rebuildRenderBoxes()
  exitMouth.x = (level.exit.minX + level.exit.maxX) * 0.5
  exitMouth.y = (level.exit.minY + level.exit.maxY) * 0.5
  bande.setAmbiance((level.ambiance as Piste | undefined) ?? null)
  departEnVapeur = zoneForceAt(level, level.spawn.x, level.spawn.y) === 'vapeur'
  buildWorldLabels()
}

// Étiquettes de monde : le nom de chaque surface, projeté par la caméra —
// la lisibilité de la légende, mais dans le décor lui-même.
const worldLabelsHost = document.getElementById(
  'world-labels',
) as HTMLDivElement
// Chaque pancarte connaît sa taille (mesurée UNE fois, à la construction :
// le zoom ne fait que la mettre à l'échelle) et sa portée — de quoi décider,
// à chaque image, qui a le droit d'occuper la place.
let labelEls: {
  span: HTMLSpanElement
  x: number
  y: number
  w: number
  h: number
  secteur: boolean
  place: boolean // avait sa place à l'image précédente (mémoire anti-papillotement)
}[] = []
const ZONE_LABEL_COLORS: Record<string, string> = {
  eau: '#63b7e6',
  glace: '#8fc8ee',
  vapeur: '#f2c98e',
  libre: '#7b93a8',
}
// Une étiquette peut se composer sur PLUSIEURS LIGNES : le saut de ligne
// saisi dans l'éditeur en devient un à l'écran (jamais de HTML injecté —
// on assemble des nœuds de texte et des <br>).
function poseLignes(hote: HTMLElement, texte: string): void {
  const lignes = texte.trim().split('\n')
  lignes.forEach((ligne, i) => {
    if (i > 0) hote.appendChild(document.createElement('br'))
    hote.appendChild(document.createTextNode(ligne.trim()))
  })
}

function buildWorldLabels(): void {
  worldLabelsHost.innerHTML = ''
  labelEls = level.labels.map((l) => {
    const span = document.createElement('span')
    span.className = `world-label wl-${l.tone}`
    // PICTOGRAMME D'ÉTAT (bible v3.1) : un rectangle à la couleur du
    // matériau, trois rangées de points EAU/GLACE/VAPEUR notées 0..3.
    // Aucun texte : une indication pour les HUMAINS, énigmatique pour le
    // joueur — la grille de lecture se gagne.
    if (l.picto) {
      span.classList.add('wl-picto')
      const swatch = document.createElement('i')
      swatch.className = 'picto-swatch'
      swatch.style.background = l.picto.couleur
      span.appendChild(swatch)
      const ETATS: ['eau' | 'glace' | 'vapeur', string][] = [
        ['eau', '#63b7e6'],
        ['glace', '#8fc8ee'],
        ['vapeur', '#f2c98e'],
      ]
      for (const [etat, couleur] of ETATS) {
        const rangee = document.createElement('u')
        rangee.className = 'picto-rangee'
        const note = l.picto[etat]
        for (let d = 0; d < 3; d++) {
          const point = document.createElement('b')
          point.className = d < note ? 'plein' : 'vide'
          point.style.color = couleur
          rangee.appendChild(point)
        }
        span.appendChild(rangee)
      }
      worldLabelsHost.appendChild(span)
      return { span, x: l.x, y: l.y, w: 0, h: 0, secteur: false, place: false }
    }
    // « SUR-TITRE|TITRE » : l'étiquette devient une PLAQUE de signalétique
    // sur deux lignes (petit sur-titre mono, titre en capitales), avec fond
    // et liseré teinté — la lisibilité d'un panneau, plus un texte qui flotte
    if (l.text.includes('|')) {
      const [sur, titre] = l.text.split('|')
      span.classList.add('plaque')
      const i = document.createElement('i')
      poseLignes(i, sur)
      const b = document.createElement('b')
      poseLignes(b, titre)
      span.append(i, b)
    } else {
      poseLignes(span, l.text)
    }
    worldLabelsHost.appendChild(span)
    return {
      span,
      x: l.x,
      y: l.y,
      w: 0,
      h: 0,
      secteur: l.rang === 'secteur',
      place: false,
    }
  })
  // Chaque zone d'état porte son nom en haut de son emprise : la règle du
  // lieu s'annonce, elle ne se découvre pas en la subissant.
  for (const z of level.zones ?? []) {
    if (z.force === 'libre') continue
    const span = document.createElement('span')
    span.className = 'world-label wl-zone'
    // le nom dit la CAUSE (« hublot fendu »), le suffixe dit la règle
    span.textContent = `${zoneName(z)} · ${z.force.toUpperCase()}`
    span.style.color = ZONE_LABEL_COLORS[z.force] ?? '#7b93a8'
    span.style.borderColor = ZONE_LABEL_COLORS[z.force] ?? '#7b93a8'
    worldLabelsHost.appendChild(span)
    labelEls.push({
      span,
      x: (z.minX + z.maxX) / 2,
      y: z.maxY - 40,
      w: 0,
      h: 0,
      secteur: false,
      place: false,
    })
  }
  // Mesure unique : la taille d'une pancarte ne dépend que de son texte —
  // le zoom ne fait que l'échelonner. Une seule lecture de mise en page par
  // tableau chargé, jamais par image.
  for (const l of labelEls) {
    l.w = l.span.offsetWidth
    l.h = l.span.offsetHeight
  }
}

// Marge de respiration entre deux pancartes, en pixels d'écran : elles ne
// doivent pas seulement NE PAS se toucher, elles doivent se laisser lire.
const MARGE_PANCARTE = 10
// Bandes réservées à l'interface : le relevé en haut, le sélecteur d'état
// et la barre tactile en bas. Une pancarte qui s'y glisserait passerait
// DERRIÈRE les boutons — elle s'efface plutôt.
const BANDE_HAUTE = 46
let bandeBasse = 150 // recalculée sur la vraie hauteur des barres
let bandeMesuree = 0

// Hauteur d'écran interdite en bas : le sélecteur d'état et la barre
// tactile. Relue quatre fois par seconde — les barres apparaissent avec la
// partie, changent de hauteur en tournant l'écran, et une lecture de mise
// en page par image ne se justifie pas pour ça.
function majBandeBasse(t: number): void {
  if (t - bandeMesuree < 250) return
  bandeMesuree = t
  let haut = window.innerHeight
  for (const el of [
    document.getElementById('statebar'),
    document.getElementById('touchbar'),
  ]) {
    const r = el?.getBoundingClientRect()
    if (!r || r.height <= 0) continue
    // Seule une vraie barre POSÉE EN BAS définit la bande interdite : LARGE
    // (pas une colonne) et dans la moitié basse. En paysage mobile, ces
    // barres deviennent des COLONNES latérales dont le sommet est presque
    // en haut de l'écran : les prendre pour des barres basses interdisait
    // TOUT l'écran aux pancartes — plus une seule visible sur téléphone
    // ou tablette en paysage.
    if (r.width < r.height || r.width < window.innerWidth * 0.35) continue
    if (r.top < window.innerHeight * 0.55) continue
    if (r.top < haut) haut = r.top
  }
  bandeBasse = Math.max(0, window.innerHeight - haut) + 10
}

// Les pancartes gardent une taille de LECTURE quel que soit le zoom (comme
// les noms sur un plan) — d'où le risque de les voir s'empiler quand la
// carte se resserre. La place est donc ATTRIBUÉE, à chaque image : les
// plaques de secteur (les lieux) servies d'abord, puis les détails du plus
// proche du regard au plus lointain ; ce qui ne rentre plus s'efface en
// fondu. Résultat : jamais deux textes l'un sur l'autre, à aucun zoom, et
// le plan large se lit comme une carte — les lieux, sans le bavardage.
function updateWorldLabels(vw: number, vh: number): void {
  majBandeBasse(performance.now())
  // Au plan large, les pancartes RÉTRÉCISSENT avec la carte (plancher 0,45)
  // au lieu de garder leur taille de lecture : deux plaques géantes
  // masquaient la carte entière et effaçaient toutes les autres — la
  // signalétique redevient une carte annotée, et grossit en zoomant.
  const scale = Math.max(0.45, Math.min(1.3, Math.sqrt(camera.zoom)))
  const cx = vw * 0.5
  const cy = vh * 0.5
  const candidats: {
    l: (typeof labelEls)[number]
    sx: number
    sy: number
    hw: number
    hh: number
    cle: number
  }[] = []
  for (const l of labelEls) {
    // sous un voile de cachette encore fermé : la pancarte flotterait
    // AU-DESSUS du brouillard et vendrait le secret — elle se tait
    if (dansCacheVoilee(l.x, l.y)) {
      l.span.style.display = 'none'
      l.place = false
      continue
    }
    const sx = cx + (l.x - camera.x) * camera.zoom
    const sy = cy - (l.y - camera.y) * camera.zoom
    const hw = (l.w * scale) / 2 + MARGE_PANCARTE
    const hh = (l.h * scale) / 2 + MARGE_PANCARTE
    // hors champ : rien à dessiner, et surtout aucune place à réserver
    if (sx + hw < 0 || sx - hw > vw || sy + hh < 0 || sy - hh > vh) {
      l.span.style.display = 'none'
      l.place = false
      continue
    }
    // sous les barres d'interface : la pancarte serait masquée à moitié —
    // qu'elle s'efface franchement plutôt que de dépasser d'un bouton
    if (sy - hh < BANDE_HAUTE || sy + hh > vh - bandeBasse) {
      l.span.style.display = ''
      l.span.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`
      l.span.classList.add('efface')
      l.place = false
      continue
    }
    l.span.style.display = ''
    l.span.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`
    // clé de service : les secteurs d'abord (rang 0), puis — À RANG ÉGAL —
    // les TITULAIRES avant les prétendants (mémoire d'image en image : une
    // pancarte affichée garde sa place tant qu'elle tient, au lieu de la
    // perdre parce qu'une voisine s'est approchée du centre du regard),
    // enfin du plus proche du centre de l'écran au plus lointain
    const d = Math.hypot(sx - cx, sy - cy)
    candidats.push({
      l,
      sx,
      sy,
      hw,
      hh,
      cle: (l.secteur ? 0 : 1e7) + (l.place ? 0 : 5e6) + d,
    })
  }
  candidats.sort((a, b) => a.cle - b.cle)
  const places: typeof candidats = []
  for (const c of candidats) {
    // Hystérésis : un titulaire tolère un léger chevauchement (le zoom
    // respire sans faire clignoter la plaque) ; un prétendant doit entrer
    // avec la marge pleine. L'apparition reste progressive, sans va-et-vient.
    const marge = c.l.place ? -8 : 0
    const gene = places.some(
      (p) =>
        Math.abs(p.sx - c.sx) < p.hw + c.hw + marge &&
        Math.abs(p.sy - c.sy) < p.hh + c.hh + marge,
    )
    c.l.span.classList.toggle('efface', gene)
    c.l.place = !gene
    if (!gene) places.push(c)
  }
}
applyLevel()

const canvas = document.getElementById('glcanvas') as HTMLCanvasElement
const overlay = document.getElementById('overlay') as HTMLDivElement
const overlayTitle = document.getElementById('overlay-title') as HTMLDivElement
const overlaySub = document.getElementById('overlay-sub') as HTMLDivElement

const el = (id: string) => document.getElementById(id) as HTMLElement
const hudTableau = el('hud-tableau')
const hudVies = el('hud-vies')
const hudViesChip = el('hud-vies-chip') as HTMLButtonElement
const hudBonbonneChip = el('hud-bonbonne-chip') as HTMLButtonElement
const hudBonbonne = el('hud-bonbonne')
const hudCoque = el('hud-coque')
const hudVolume = el('hud-volume')
const hudSeuil = el('hud-seuil')
const hudVitesse = el('hud-vitesse')
const hudState = el('hud-state')
const hudWarp = el('hud-warp')
const gaugeFill = el('gauge-fill')
const gaugeThreshold = el('gauge-threshold')
const hudPerte = el('hud-perte')
const hudRosee = el('hud-rosee')
const hudDanger = el('hud-danger')
const coqueBar = el('coque-bar').firstElementChild as HTMLElement
const objArrow = el('obj-arrow')
const objArrowGlyph = objArrow.firstElementChild as HTMLElement
const objDist = el('obj-dist')
const homeVolume = el('home-volume')
const homeParticles = el('home-particles')
const homeState = el('home-state')
const recEssai = el('rec-essai')
const recRows = el('rec-rows')

// Le tableau d'honneur partagé (/api/records) : chargé au démarrage, mis à
// jour à chaque record publié. Hors ligne, les registres locaux suffisent.
let sharedBoard: SharedBoard | null = null
fetchSharedBoard().then((b) => {
  if (b) {
    sharedBoard = b
    renderRegistres()
  }
})

// Écran record de la fiche : DEUX colonnes par salle — 💧 VOLUME (le
// meilleur du protocole partagé prime sur le local) et ⏱ CHRONO (vos
// meilleurs temps, tenus en local). Le détenteur signe chaque record.
function renderRegistres(): void {
  recEssai.textContent = `ÉCHANTILLON Nº ${records.essaiNumber()}`
  const moi = records.operator()
  const signe = (name: string): string =>
    name
      ? `<i class="rec-qui${name === moi ? ' rec-moi' : ''}">${htmlSafe(name)}</i>`
      : ''
  // Le panneau est le CONDENSÉ de l'écran RECORDS : le palmarès partagé
  // (note, volume, chrono — rang 1 de chaque podium), seules les salles
  // qui ONT un palmarès s'affichent, bornées pour tenir SANS défilement.
  // Le détail (top 5, trophées) vit derrière le bouton RECORDS.
  const rows: string[] = []
  const tops = sharedBoard?.tops ?? {}
  let affichees = 0
  let cachees = 0
  for (const t of playedLevels()) {
    const top = tops[t.code]
    if (!top || top.note.length === 0) continue
    if (affichees >= 9) {
      cachees++
      continue
    }
    affichees++
    const n0 = top.note[0]
    const v0 = top.volume[0]
    const c0 = top.chrono[0]
    rows.push(
      `<div class="rec-row"><span class="rec-code">${t.code}</span><span class="rec-name">${t.name}</span>` +
        `<span class="rec-val rec-note"><b>${n0.note} pts</b> ${signe(n0.name)}</span>` +
        `<span class="rec-val rec-vol"><b>${fmtL(v0?.liters ?? 0)}</b> ${signe(v0?.name ?? '')}</span>` +
        `<span class="rec-val rec-chr"><b>${fmtTime(c0?.time ?? 0)}</b> ${signe(c0?.name ?? '')}</span></div>`,
    )
  }
  if (rows.length > 0) {
    rows.unshift(
      `<div class="rec-row rec-titres"><span class="rec-code"></span><span class="rec-name">SALLE</span>` +
        `<span class="rec-val rec-note">★ NOTE</span>` +
        `<span class="rec-val rec-vol">💧 VOLUME</span><span class="rec-val rec-chr">⏱ CHRONO</span></div>`,
    )
  } else {
    rows.push(
      '<div class="rec-hist">Le palmarès est à prendre : chaque collecte y inscrit sa note, son volume et son chrono.</div>',
    )
  }
  if (cachees > 0) {
    rows.push(
      `<div class="rec-hist">+ ${cachees} autre(s) salle(s) au palmarès — bouton RECORDS.</div>`,
    )
  }
  const localExp = records.expedition()
  const sharedExp = sharedBoard?.expedition ?? null
  const exp =
    sharedExp &&
    (!localExp ||
      sharedExp.tableaux > localExp.tableaux ||
      (sharedExp.tableaux === localExp.tableaux &&
        (sharedExp.liters > localExp.liters ||
          (sharedExp.liters === localExp.liters &&
            sharedExp.time < localExp.time))))
      ? sharedExp
      : localExp
  if (exp) {
    rows.unshift(
      `<div class="rec-row rec-exp"><span class="rec-code">EXPÉDITION</span><span class="rec-name"></span>` +
        `<span class="rec-val" style="grid-column: span 2"><b>${exp.tableaux}/${playedLevels().length} salles</b> · 💧 ${fmtL(exp.liters)} · ⏱ ${fmtDuree(exp.time)} ${
          exp.name
            ? `<i class="rec-qui${exp.name === moi ? ' rec-moi' : ''}">${htmlSafe(exp.name)}</i>`
            : ''
        }</span></div>`,
    )
  }
  recRows.innerHTML = rows.join('')
}
renderRegistres()

// Le nom estampillé sur les records, façon borne d'arcade — et obligatoire :
// le protocole n'admet pas d'opérateur anonyme dans la cuve.
const recName = document.getElementById('rec-name') as HTMLInputElement
const recNeed = document.getElementById('rec-need') as HTMLDivElement
recName.value = records.operator()
recName.addEventListener('input', () => {
  if (recName.value.trim()) {
    recName.classList.remove('need')
    recNeed.hidden = true
  }
})
recName.addEventListener('change', () => {
  records.setOperator(recName.value)
  recName.value = records.operator()
  renderRegistres()
})

// La fiche s'ouvre EN HAUT, toujours : le navigateur restaure sinon le
// défilement de la visite précédente une demi-seconde après l'affichage —
// le titre devenait inaccessible sans remonter à la main (constaté).
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
window.scrollTo(0, 0)
requestAnimationFrame(() => {
  window.scrollTo(0, 0)
  const homeEl = document.getElementById('home')
  if (homeEl) homeEl.scrollTop = 0
})

// ---- Voile de SIGNATURE (premier lancement) : le nom, et le geste qui
// éveille l'audio. Il couvre tout : aucun clic inopiné ne part vers la
// fiche ou la cuve tant qu'on n'a pas signé. La clé versionnée le montre
// UNE fois par version — y compris aux joueurs d'avant le voile.
{
  const sigEl = document.getElementById('signature') as HTMLDivElement
  const sigNom = document.getElementById('sig-nom') as HTMLInputElement
  const signer = (): void => {
    const nom = sigNom.value.trim()
    if (!nom) {
      sigNom.classList.remove('need')
      void sigNom.offsetWidth
      sigNom.classList.add('need')
      sigNom.focus()
      return
    }
    records.setOperator(nom)
    recName.value = records.operator()
    // le clic de signature EST le geste utilisateur : l'audio s'éveille là
    audio.resume()
    bande.eveiller()
    majInviteSon()
    renderRegistres()
    try {
      localStorage.setItem('sujet21-signature-v1', '1')
    } catch {
      // sans gravité : le voile se remontrerait, simple re-clic
    }
    sigEl.hidden = true
  }
  document.getElementById('sig-valider')?.addEventListener('click', signer)
  sigNom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') signer()
  })
  // les clics sur le voile ne traversent jamais (pas de fermeture au fond :
  // signer est le seul chemin — c'est un portail, pas un popup)
  sigEl.addEventListener('pointerdown', (e) => e.stopPropagation())
  // Le voile se montre au premier lancement — ET une fois aux joueurs qui
  // ont un nom d'AVANT le voile : ils re-signent (champ PRÉ-REMPLI, un
  // clic suffit) et le son s'éveille par la même occasion. La clé versionnée
  // garantit « une fois » ; la re-signature n'efface aucun record.
  const CLE_SIGNATURE = 'sujet21-signature-v1'
  if (!records.operator() || !localStorage.getItem(CLE_SIGNATURE)) {
    sigNom.value = records.operator()
    sigEl.hidden = false
    // le focus attend une image : le champ existe et la fiche est posée —
    // pas de défilement parasite ni de clavier mobile ouvert sur du vide
    requestAnimationFrame(() => sigNom.focus({ preventScroll: true }))
  }
}

// La plongée exige un nom : on interpelle le champ au lieu d'ouvrir la cuve.
function requireName(): boolean {
  // le champ peut être rempli sans avoir encore perdu le focus (pas de change)
  if (recName.value.trim()) records.setOperator(recName.value)
  if (records.operator()) return false
  // sur mobile, les registres (et leur champ de nom) vivent derrière le
  // bouton RECORDS : on ouvre le voile pour montrer où signer
  if (recName.offsetParent === null) ouvrirRecs()
  recNeed.hidden = false
  recName.classList.remove('need')
  void recName.offsetWidth // relance l'animation de secousse
  recName.classList.add('need')
  recName.scrollIntoView({ block: 'center', behavior: 'smooth' })
  recName.focus({ preventScroll: true })
  return true
}
const tableauCard = el('tableau-card')

// Carton d'ouverture : l'entrée du journal de bord du tableau. Il RESTE
// affiché tant qu'on ne l'a pas fermé à la croix — lire ne se chronomètre
// pas (l'effacement automatique partait trop vite).
// Le carton de journal (signé Dr N. Véga) ne s'affiche PLUS : retour
// joueur — un popup à fermer à chaque tableau n'est pas ergonomique. Le
// texte reste dans les tableaux (éditeur, champ journal) si on veut le
// réutiliser autrement un jour.
function showTableauCard(): void {
  // volontairement vide — aucun carton ne s'affiche
}
document.getElementById('card-fermer')?.addEventListener('click', () => {
  tableauCard.classList.remove('visible')
})

// Fiche d'essai : visible au chargement ; « échap » ou ≡ pour y revenir.
// L'essai continue de dériver derrière la fiche — elle observe, elle ne fige pas.
const startBtn = document.getElementById('start') as HTMLButtonElement
const startBisBtn = document.getElementById('start-bis') as HTMLButtonElement
let hasPlayed = false
// ---- Onboarding tactile : trois gestes, montrés une fois, au premier
// lancement sur écran tactile. Le voile intercepte les touchers (il couvre
// le canvas) et fige l'essai le temps de la lecture.
const onboardEl = document.getElementById('onboard') as HTMLDivElement
let obEtape = 0
// La prise en main se montre PARTOUT : cartes tactiles au doigt, cartes
// souris/clavier ailleurs — chaque mode a sa propre mémoire (on peut
// découvrir le jeu au bureau puis sur téléphone, chaque main a sa leçon).
const obTactile = (): boolean => window.matchMedia('(pointer: coarse)').matches
const obCle = (): string =>
  obTactile() ? 'projet21.onboard.v1' : 'projet21.onboard.pc.v1'
// L'ÉVEIL (la prise en main scénarisée) a sa propre clé — versionnée : en
// changer la version rejoue l'éveil à tout le monde. Déclarée ici car
// le chargement (plus bas) doit savoir s'il faut geler l'échantillon.
// v2 : l'éveil finalisé (bouton CONTINUER, dizaine d'impulsions, ralenti
// + fondus) se rejoue une fois pour tous — même les premiers testeurs.
const CLE_EVEIL = 'sujet21-eveil-v2'
// Cartes gestuelles MISES DE CÔTÉ : l'ÉVEIL les remplace au premier
// lancement. Le code et les cartes restent entiers au cas où — remettre
// ce drapeau à true les rendrait au premier plan.
const CARTES_GESTES: boolean = false
function majOnboard(): void {
  const etapes = Array.from(
    onboardEl.querySelectorAll<HTMLElement>('.ob-etape'),
  )
  etapes.forEach((e, i) => {
    e.hidden = i !== obEtape
  })
  const points = Array.from(
    onboardEl.querySelectorAll<HTMLElement>('.ob-points i'),
  )
  points.forEach((p, i) => p.classList.toggle('on', i === obEtape))
  const suite = onboardEl.querySelector<HTMLElement>('.ob-suite')
  if (suite) {
    const geste = obTactile() ? 'TOUCHER' : 'CLIQUER'
    suite.textContent =
      obEtape >= 4 ? `${geste} POUR PLONGER` : `${geste} POUR CONTINUER`
  }
}
function montrerOnboard(): void {
  if (!CARTES_GESTES) return
  if (localStorage.getItem(obCle())) return
  onboardEl.dataset.mode = obTactile() ? 'tactile' : 'pc'
  obEtape = 0
  majOnboard()
  onboardEl.hidden = false
  input.paused = true
  input.gelees = true // AUCUNE commande de jeu pendant la prise en main
}
function avanceOnboard(): void {
  obEtape++
  if (obEtape > 4) {
    onboardEl.hidden = true
    try {
      localStorage.setItem(obCle(), '1')
    } catch {
      // stockage refusé : l'onboarding se remontrera, sans gravité
    }
    input.paused = false
    input.gelees = false
  } else {
    majOnboard()
  }
}
onboardEl.addEventListener('pointerdown', (e) => {
  e.stopPropagation()
  e.preventDefault()
  avanceOnboard()
})

// Le verrou de rotation existe : « continuer en portrait » retire le voile
document.getElementById('tourner-quand-meme')?.addEventListener('click', () => {
  document.body.classList.add('portrait-ok')
})

// ---- Le voile RECORDS (mobile) : les registres se déplacent dedans ----
const recsEl = document.getElementById('recs') as HTMLDivElement
const recsBoite = recsEl.querySelector('.recs-boite') as HTMLDivElement
const recsBloc = document.querySelector('.home-records') as HTMLDivElement
const recsParent = recsBloc.parentElement as HTMLElement
function ouvrirRecs(): void {
  recsBoite.appendChild(recsBloc) // le bloc déménage dans le voile
  recsEl.hidden = false
}
function fermerRecs(): void {
  recsEl.hidden = true
  recsParent.appendChild(recsBloc) // et revient à sa place sur la fiche
}
recsEl.addEventListener('pointerdown', (e) => {
  if (e.target === recsEl) fermerRecs()
})

// ---- Le voile SALLES : charger n'importe quel tableau, à l'essai ----
// La liste se RECONSTRUIT à chaque changement de bibliothèque : les salles
// de l'éditeur (dans l'ordre fixé là-bas) s'affichent en tête quand la
// bibliothèque partagée en contient, au-dessus de l'expédition livrée.
const sallesEl = document.getElementById('salles') as HTMLDivElement
// Tri du voile : l'ordre de l'éditeur (défaut), ou l'un des trois chiffres
// du CODE ATELIER (« 111 » : phase · mécanique requise · difficulté). Les
// codes hors convention se rangent après, dans l'ordre de l'éditeur.
let sallesTri: 'editeur' | 'moment' | 'meca' | 'diff' = 'editeur'
// le MOMENT en un mot, pour les pastilles et la carte de couverture
const MOMENT_COURT: Record<CodeAtelier['moment'], string> = {
  1: 'DÉBUT',
  2: 'MILIEU',
  3: 'FIN',
}
// Filtres par les chiffres du code : null = tout montrer. Quand un filtre
// est actif, seuls les codes atelier peuvent répondre — les autres (livrés
// 21-A, HUB…) sont masqués, et la section le dit.
let sallesFiltreMeca: CodeAtelier['mecanique'] | null = null
let sallesFiltreDiff: number | null = null
let sallesCouvVisible = false
function renderSalles(): void {
  const liste = document.getElementById('salles-liste') as HTMLDivElement
  liste.innerHTML = ''
  const esc = (t: string): string =>
    t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const section = (titre: string): void => {
    const h = document.createElement('div')
    h.className = 'salles-sec'
    h.textContent = titre
    liste.appendChild(h)
  }
  const salle = (lv: LevelDef): void => {
    const b = document.createElement('button')
    b.type = 'button'
    const d = decodeCodeAtelier(lv.code)
    const chips = d
      ? `<span class="salle-chips"><i>${MOMENT_COURT[d.moment]}</i>` +
        `<i class="sc-m${d.mecanique}">${MECANIQUE_NOMS[d.mecanique].toUpperCase()}</i>` +
        `<i>DIFF ${d.difficulte}</i></span>`
      : ''
    b.innerHTML = `<b>${esc(lv.code)}</b><span class="salle-nom">${esc(lv.name)}</span>${chips}`
    b.addEventListener('click', () => {
      sallesEl.hidden = true
      startTest([lv])
    })
    liste.appendChild(b)
  }
  let enSequence = libraryLevels.filter((l) => !estCodeHub(l.code))
  const decodes = enSequence
    .map((lv) => decodeCodeAtelier(lv.code))
    .filter((d): d is CodeAtelier => d !== null)

  // ---- les FILTRES : mécanique et difficulté, bâtis sur ce qui existe ----
  const filtres = document.getElementById('salles-filtres') as HTMLDivElement
  if (decodes.length === 0) {
    filtres.innerHTML = ''
    sallesFiltreMeca = null
    sallesFiltreDiff = null
  } else {
    const mecas = [...new Set(decodes.map((d) => d.mecanique))].sort()
    const diffs = [...new Set(decodes.map((d) => d.difficulte))].sort(
      (a, b) => a - b,
    )
    const chip = (
      groupe: 'fm' | 'fd',
      valeur: number | null,
      texte: string,
      actif: boolean,
    ): string =>
      `<button type="button" data-${groupe}="${valeur ?? ''}"${actif ? ' class="actif"' : ''}>${texte}</button>`
    filtres.innerHTML =
      `<span>MÉCANIQUE</span>` +
      chip('fm', null, 'TOUT', sallesFiltreMeca === null) +
      mecas
        .map((m) =>
          chip(
            'fm',
            m,
            MECANIQUE_NOMS[m].toUpperCase(),
            sallesFiltreMeca === m,
          ),
        )
        .join('') +
      `<span style="margin-left:8px">DIFFICULTÉ</span>` +
      chip('fd', null, 'TOUT', sallesFiltreDiff === null) +
      diffs
        .map((d) => chip('fd', d, String(d), sallesFiltreDiff === d))
        .join('')
    for (const b of Array.from(filtres.querySelectorAll('button'))) {
      b.addEventListener('click', () => {
        if (b.dataset.fm !== undefined) {
          sallesFiltreMeca =
            b.dataset.fm === ''
              ? null
              : (Number(b.dataset.fm) as CodeAtelier['mecanique'])
        } else {
          sallesFiltreDiff = b.dataset.fd === '' ? null : Number(b.dataset.fd)
        }
        renderSalles()
      })
    }
  }

  // ---- la CARTE DE COUVERTURE : salles par case phase × difficulté ----
  const couv = document.getElementById('salles-couv') as HTMLDivElement
  couv.hidden = !sallesCouvVisible
  document
    .getElementById('salles-couv-btn')
    ?.classList.toggle('actif', sallesCouvVisible)
  if (sallesCouvVisible) {
    if (decodes.length === 0) {
      couv.innerHTML =
        '<p class="couv-note">Aucune salle au code atelier (« 111 ») dans la bibliothèque : rien à cartographier.</p>'
    } else {
      const pMin = Math.min(...decodes.map((d) => d.moment))
      const pMax = Math.max(...decodes.map((d) => d.moment))
      const dMin = Math.min(...decodes.map((d) => d.difficulte))
      const dMax = Math.max(...decodes.map((d) => d.difficulte))
      let html = '<table><tr><th></th>'
      for (let df = dMin; df <= dMax; df++) html += `<th>DIFF ${df}</th>`
      html += '</tr>'
      for (let p = pMin; p <= pMax; p++) {
        html += `<tr><th>${MOMENT_COURT[p as CodeAtelier['moment']]}</th>`
        for (let df = dMin; df <= dMax; df++) {
          const dedans = enSequence
            .map((lv) => ({ lv, d: decodeCodeAtelier(lv.code) }))
            .filter(
              (x): x is { lv: LevelDef; d: CodeAtelier } =>
                x.d !== null && x.d.moment === p && x.d.difficulte === df,
            )
          if (dedans.length === 0) {
            html += '<td class="vide">—</td>'
            continue
          }
          const noms = dedans.map(
            (x) =>
              `${x.lv.code} ${x.lv.name} (${MECANIQUE_NOMS[x.d.mecanique]})`,
          )
          // un point par MÉCANIQUE présente dans la case, couleur des chips
          const mecas = [...new Set(dedans.map((x) => x.d.mecanique))].sort()
          const points = mecas
            .map((m) => `<i class="cm-${m}" title="${MECANIQUE_NOMS[m]}"></i>`)
            .join('')
          html += `<td class="plein" title="${esc(noms.join('\n'))}">${dedans.length}<span class="couv-mecas">${points}</span></td>`
        }
        html += '</tr>'
      }
      html +=
        '</table><p class="couv-note">Chaque case compte les salles de la bibliothèque — les « — » sont les trous à combler. Les points donnent les mécaniques présentes (gris aucune · bleu glace · ambre vapeur · violet toutes) ; survolez une case pour lire les noms.</p>'
      couv.innerHTML = html
    }
  }

  // ---- le TRI, puis le FILTRE, puis la liste ----
  if (sallesTri !== 'editeur') {
    const rang = (d: CodeAtelier): number =>
      sallesTri === 'moment'
        ? d.moment
        : sallesTri === 'meca'
          ? d.mecanique
          : d.difficulte
    // tri STABLE : à égalité, l'ordre de l'éditeur tient ; le chiffre choisi
    // prime, les deux autres départagent (phase, puis mécanique, puis diff)
    enSequence = [...enSequence].sort((a, b) => {
      const da = decodeCodeAtelier(a.code)
      const db = decodeCodeAtelier(b.code)
      if (!da && !db) return 0
      if (!da) return 1
      if (!db) return -1
      return (
        rang(da) - rang(db) ||
        da.moment - db.moment ||
        da.mecanique - db.mecanique ||
        da.difficulte - db.difficulte
      )
    })
  }
  const filtreActif = sallesFiltreMeca !== null || sallesFiltreDiff !== null
  if (filtreActif) {
    enSequence = enSequence.filter((lv) => {
      const d = decodeCodeAtelier(lv.code)
      if (!d) return false
      if (sallesFiltreMeca !== null && d.mecanique !== sallesFiltreMeca)
        return false
      if (sallesFiltreDiff !== null && d.difficulte !== sallesFiltreDiff)
        return false
      return true
    })
    section(
      enSequence.length > 0
        ? 'BIBLIOTHÈQUE DU LABO — filtrée par le code atelier (les codes hors convention sont masqués)'
        : 'Aucune salle ne répond à ce filtre — TOUT le retire.',
    )
    for (const lv of enSequence) salle(lv)
    return
  }
  if (enSequence.length > 0) {
    section(
      sallesTri === 'editeur'
        ? 'BIBLIOTHÈQUE DU LABO — en tête de séquence, dans l’ordre de l’éditeur'
        : 'BIBLIOTHÈQUE DU LABO — triée par le code atelier',
    )
    for (const lv of enSequence) salle(lv)
    section('EXPÉDITION LIVRÉE — elle s’enchaîne à la suite')
  }
  for (const lv of [...TABLEAUX_ECOLE, ...TABLEAUX, TABLEAU_1BIS]) salle(lv)
  // LE CABINET LOGIQUE : les mécanismes détournés en algèbre booléenne —
  // des démonstrations à l'essai, volontairement hors expédition et hors
  // accueil (l'écran SALLES est déjà l'antichambre du concepteur)
  section(
    'LE CABINET LOGIQUE — pastilles et portes en algèbre booléenne (démonstration)',
  )
  for (const lv of CIRCUITS) salle(lv)
}
renderSalles()
{
  const boutons = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      '#salles-outils button[data-tri]',
    ),
  )
  for (const btn of boutons) {
    btn.addEventListener('click', () => {
      sallesTri = (btn.dataset.tri as typeof sallesTri) ?? 'editeur'
      for (const b of boutons) b.classList.toggle('actif', b === btn)
      renderSalles()
    })
  }
  document.getElementById('salles-couv-btn')?.addEventListener('click', () => {
    sallesCouvVisible = !sallesCouvVisible
    renderSalles()
  })
}
document.getElementById('home-salles')?.addEventListener('click', () => {
  sallesEl.hidden = false
})
// ---- Le voile NOTES DE VERSION : le journal du chantier, sorti du banc ----
// Chaque entrée peut porter une illustration (champ figure) et affiche la
// version qu'elle a inaugurée ; le bouton TÉLÉCHARGER exporte tout le
// journal en Markdown, hors ligne compris.
const livraisonsEl = document.getElementById('livraisons') as HTMLDivElement
{
  // la version, affichée partout depuis la même source : sous le titre de
  // la fiche (en petit) et dans l'en-tête du voile
  const versionJeu = document.getElementById('version-jeu')
  if (versionJeu) versionJeu.textContent = `v${VERSION} — prototype`

  // ---- MODE CONCEPTEUR : deux accueils dans le même jeu ----
  // L'accueil PUBLIC ne montre que l'essentiel (jouer, records, codex,
  // commandes, paramètres) ; le mode concepteur rallume les outils
  // (éditeur, montage, salles, pupitre…). Il se gagne par ?dev dans l'URL,
  // ou par 7 TOUCHERS sur le numéro de version — Steam Deck et mobile
  // n'ont pas de barre d'adresse sous la main. ?dev=0 le rend.
  const CLE_CONCEPTEUR = 'projet21.concepteur.v1'
  const concepteurActif = (): boolean => {
    try {
      return localStorage.getItem(CLE_CONCEPTEUR) === '1'
    } catch {
      return false
    }
  }
  const poseConcepteur = (on: boolean): void => {
    try {
      if (on) localStorage.setItem(CLE_CONCEPTEUR, '1')
      else localStorage.removeItem(CLE_CONCEPTEUR)
    } catch {
      // stockage refusé : le mode ne tiendra que la session — sans gravité
    }
    document.body.classList.toggle('concepteur', on)
  }
  {
    const q = new URLSearchParams(location.search)
    if (q.get('dev') === '0') poseConcepteur(false)
    else if (q.has('dev')) poseConcepteur(true)
    else document.body.classList.toggle('concepteur', concepteurActif())
  }
  let tapsVersion = 0
  let dernierTapVersion = 0
  versionJeu?.addEventListener('pointerdown', () => {
    const t = performance.now()
    if (t - dernierTapVersion > 1600) tapsVersion = 0
    dernierTapVersion = t
    tapsVersion++
    if (tapsVersion < 7) return
    tapsVersion = 0
    const on = !concepteurActif()
    poseConcepteur(on)
    const avant = versionJeu.textContent
    versionJeu.textContent = on
      ? 'MODE CONCEPTEUR ACTIVÉ'
      : 'ACCUEIL PUBLIC RÉTABLI'
    window.setTimeout(() => {
      versionJeu.textContent = avant
    }, 2200)
  })
  const livVersion = document.getElementById('liv-version')
  if (livVersion) livVersion.textContent = `le jeu est en v${VERSION}`
  const corps = document.getElementById('livraisons-corps') as HTMLDivElement
  let rendu = false
  const renderLivraisons = (): void => {
    if (rendu) return
    rendu = true
    const esc = (t: string): string => t.replace(/</g, '&lt;')
    // L'ESSENTIEL — le récap éclair des dernières 24 h : une ligne par
    // livraison (heure + titre), pour embrasser la journée avant le détail
    const litDate = (d: string): number => {
      const m = /^(\d\d)\/(\d\d)\/(\d{4}) (\d\d):(\d\d)$/.exec(d.trim())
      if (!m) return NaN
      return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).getTime()
    }
    const aujourdhui = new Date()
    const jourDe = (t: number): string =>
      new Date(t).getDate() === aujourdhui.getDate() ? '' : 'hier '
    const fraiches = DELIVERIES.map((d) => ({ d, t: litDate(d.date) })).filter(
      (x) => Number.isFinite(x.t) && Date.now() - x.t < 24 * 3600_000,
    )
    const recap =
      fraiches.length >= 2
        ? `<div class="liv-recap"><h3>L’ESSENTIEL — DERNIÈRES 24 H (${fraiches.length} livraisons)</h3>` +
          fraiches
            .map(
              (x) =>
                `<div class="liv-r"><time>${jourDe(x.t)}${x.d.date.slice(11)}</time><span>${esc(x.d.title)}</span></div>`,
            )
            .join('') +
          `</div>`
        : ''
    corps.innerHTML =
      recap +
      DELIVERIES.map(
        (d, i) =>
          `<div class="liv-e"><h3>${esc(d.title)}</h3>` +
          `<time>v${versionDe(i)} · ${esc(d.date)}</time>` +
          (d.figure ? `<img src="${d.figure}" alt="" loading="lazy" />` : '') +
          `<ul>${d.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`,
      ).join('')
  }
  document.getElementById('home-livraisons')?.addEventListener('click', () => {
    renderLivraisons()
    livraisonsEl.hidden = false
  })
  document
    .getElementById('livraisons-fermer')
    ?.addEventListener('click', () => {
      livraisonsEl.hidden = true
    })
  livraisonsEl.addEventListener('pointerdown', (e) => {
    if (e.target === livraisonsEl) livraisonsEl.hidden = true
  })
  document.getElementById('livraisons-dl')?.addEventListener('click', () => {
    const md =
      `# Sujet 21 — notes de version (v${VERSION})\n\n` +
      DELIVERIES.map(
        (d, i) =>
          `## v${versionDe(i)} — ${d.date} — ${d.title}\n\n${d.notes.map((n) => `- ${n}`).join('\n')}\n`,
      ).join('\n')
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'sujet21-notes-de-version.md'
    a.click()
    URL.revokeObjectURL(url)
  })
}

// ---- Compteur de FPS permanent (réglage du voile PARAMÈTRES) ----
const fpsCoin = document.getElementById('fps-coin') as HTMLDivElement
let fpsAffiche = localStorage.getItem('sujet21-fps-aff') === '1'
fpsCoin.hidden = !fpsAffiche
let fpsCoinTimer = 0
function majFpsCoin(dtReal: number): void {
  if (!fpsAffiche) return
  fpsCoinTimer += dtReal
  if (fpsCoinTimer < 0.25) return
  fpsCoinTimer = 0
  fpsCoin.textContent = `${Math.round(fpsSmoothed)} im/s`
}

// ---- Trophées du protocole : succès internes, prêts pour Steam ----
// Les déblocages passent par un toast (la petite fanfare) ; la page vit
// dans le voile RECORDS. Détection par échantillonnage léger (4 Hz).
const trophees = new Trophees()
const tropheeToast = document.getElementById('trophee-toast') as HTMLDivElement
const toastFile: {
  nom: string
  icone: string
  sur?: string
  fiche?: string
}[] = []
let toastTimer = 0
trophees.onDebloque = (t) => {
  toastFile.push({ nom: t.nom, icone: t.icone })
  audio.collect()
}
// Le CODEX partage la fanfare des trophées : même toast, autre étiquette —
// et sa page (fiche d'essai, bouton CODEX) se remplit au fil des découvertes
const codex = new Codex()
codex.onDecouverte = (d) => {
  toastFile.push({
    nom: d.titre,
    icone: d.icone,
    sur: 'CODEX — NOUVELLE FICHE',
    fiche: d.id,
  })
  audio.collect()
  renderCodexVoile()
}
function majToast(dtReal: number): void {
  if (toastTimer > 0) {
    toastTimer -= dtReal
    if (toastTimer <= 0) tropheeToast.classList.remove('visible')
    return
  }
  const t = toastFile.shift()
  if (!t) return
  // une fiche codex se VISITE : le toast devient un bouton — clic, toucher,
  // ou SELECT à la manette — et le codex s'ouvre, défilé sur la fiche neuve
  const voir = t.fiche
    ? `<em class="tt-voir">${manette.connectee ? 'SELECT · VOIR LA FICHE' : 'VOIR LA FICHE'}</em>`
    : ''
  tropheeToast.innerHTML = `<i>${t.icone}</i><div><b>${t.sur ?? 'TROPHÉE DÉBLOQUÉ'}</b>${t.nom}${voir}</div>`
  if (t.fiche) tropheeToast.dataset.fiche = t.fiche
  else delete tropheeToast.dataset.fiche
  tropheeToast.classList.toggle('cliquable', Boolean(t.fiche))
  tropheeToast.classList.add('visible')
  toastTimer = t.fiche ? 5.2 : 3.8
}
tropheeToast.addEventListener('click', () => {
  const fiche = tropheeToast.dataset.fiche
  if (!fiche || !tropheeToast.classList.contains('visible')) return
  tropheeToast.classList.remove('visible')
  toastTimer = 0
  ouvreCodexSur(fiche)
})
// état de détection par salle — remis à zéro quand la salle change
let tropheeNiveauRef: unknown = null
let gelContinu = 0
let vuEau = -1
let vuGel = -1
let vuVapeur = -1
let tropheeEchant = 0
function updateTrophees(dtReal: number): void {
  majToast(dtReal)
  if (tropheeNiveauRef !== level) {
    tropheeNiveauRef = level
    gelContinu = 0
    vuEau = -1
    vuGel = -1
    vuVapeur = -1
  }
  if (input.paused || run.ended || sim.dispersed) return
  tropheeEchant += dtReal
  if (tropheeEchant < 0.25) return
  const pas = tropheeEchant
  tropheeEchant = 0
  const n = sim.count
  if (n === 0) return
  let gels = 0
  let gaz = 0
  for (let i = 0; i < n; i++) {
    if (sim.frozen[i] === 1) gels++
    else if (sim.gaseous[i] === 1) gaz++
  }
  // « Palet parfait » : gelé en continu (≥ 80 % du corps) pendant 30 s
  if (gels / n >= 0.8) {
    gelContinu += pas
    if (gelContinu >= 30) trophees.debloque('palet-parfait')
  } else {
    gelContinu = 0
  }
  // « Trois états » : les trois régimes vus dans une fenêtre de 15 s
  if (gels / n >= 0.5) vuGel = elapsed
  else if (gaz / n >= 0.5) vuVapeur = elapsed
  else vuEau = elapsed
  if (vuEau >= 0 && vuGel >= 0 && vuVapeur >= 0) {
    if (elapsed - Math.min(vuEau, vuGel, vuVapeur) < 15)
      trophees.debloque('trois-etats')
  }
  // « Miroir vivant » : un faisceau réfléchi par le corps gelé
  if (!trophees.gagne('miroir-vivant')) {
    for (const vue of laserEtat.vues) {
      if ((vue.rebondsGlace ?? 0) > 0) {
        trophees.debloque('miroir-vivant')
        break
      }
    }
  }
  // « Recondensé » : cinq gouttes de rosée perlées sur cette salle
  if (sim.roseePerlee >= 5) trophees.debloque('recondense')

  // ---- CODEX : les découvertes de la salle, au même échantillonnage ----
  // Les combinaisons état × matériau viennent du solveur (contacts et
  // passages consignés au vol) ; les phénomènes se lisent ici.
  codex.litContacts(sim.codexContacts)
  if (sim.roseePerlee > 0) codex.marque('rosee')
  if (!codex.connu('laser-glace')) {
    for (const vue of laserEtat.vues) {
      if ((vue.rebondsGlace ?? 0) > 0) {
        codex.marque('laser-glace')
        break
      }
    }
  }
  if (!codex.connu('eponge')) {
    for (const sp of sim.sponges) {
      let bu = false
      for (let c = 0; c < sp.saturation.length; c++)
        if (sp.saturation[c] > 0) {
          bu = true
          break
        }
      if (bu) {
        codex.marque('eponge')
        break
      }
    }
  }
  const forceIci = zoneForceAt(level, sim.stats.centroidX, sim.stats.centroidY)
  if (forceIci === 'glace' && gels / n >= 0.5) codex.marque('zone-glace')
  if (forceIci === 'vapeur' && gaz / n >= 0.5) codex.marque('zone-vapeur')
}

// ---- Le voile RECORDS : le palmarès partagé, trois podiums par salle ----
// La NOTE (cL × 60 / (60 + s)) est calculée serveur ET client — même
// formule des deux côtés, l'affichage recalcule pour les vieux rapports.
const recordsEl = document.getElementById('records') as HTMLDivElement
const recordsCorps = document.getElementById('records-corps') as HTMLDivElement
function renderRecordsVoile(): void {
  recordsCorps.innerHTML = '<div class="rec-vide">Chargement du palmarès…</div>'
  void fetchSharedBoard().then((board) => {
    if (!board) {
      recordsCorps.innerHTML =
        '<div class="rec-vide">Palmarès injoignable (hors ligne ou serveur local).</div>'
      return
    }
    const moi = records.operator()
    const esc = (t: string): string => t.replace(/</g, '&lt;')
    const podium = (
      titre: string,
      liste: { name: string; note: number; liters: number; time: number }[],
      fmt: (e: { note: number; liters: number; time: number }) => string,
      brut: (e: { note: number; liters: number; time: number }) => number,
      desc: boolean,
    ): string => {
      const meilleurs = liste.slice(0, 5)
      const medailles = ['①', '②', '③', '4.', '5.']
      let h = `<div class="rec-pod"><h4>${titre}</h4>`
      for (let i = 0; i < meilleurs.length; i++) {
        const e = meilleurs[i]
        h += `<div class="rec-ligne${e.name === moi ? ' moi' : ''}"><span class="rg">${medailles[i]}</span><span class="nm">${esc(e.name)}</span><span class="vl">${fmt(e)}</span></div>`
      }
      // l'aiguillon : l'écart de MA ligne au rang au-dessus
      const r = meilleurs.findIndex((e) => e.name === moi)
      if (r > 0) {
        const d = Math.abs(brut(meilleurs[r - 1]) - brut(meilleurs[r]))
        const unite =
          titre === 'CHRONO' ? 's' : titre === 'VOLUME' ? 'cL' : 'pts'
        const v =
          titre === 'VOLUME'
            ? Math.max(1, Math.round(d * 100))
            : Math.ceil(d * 10) / 10
        h += `<div class="rec-ecart">à ${v} ${unite} du rang ${r}${desc ? '' : ''}</div>`
      }
      return h + '</div>'
    }
    let html =
      '<div class="rec-salle">TROPHÉES DU PROTOCOLE</div><div class="tro-grille">'
    for (const t of TROPHEES) {
      const ok = trophees.gagne(t.id)
      const date = ok
        ? new Date(trophees.quand(t.id)).toLocaleDateString('fr-FR')
        : ''
      html += `<div class="tro-carte${ok ? '' : ' verrou'}"><i>${t.icone}</i><div><b>${t.nom}</b><span>${t.desc}</span>${ok ? `<em>débloqué le ${date}</em>` : ''}</div></div>`
    }
    html += '</div>'
    const tops = board.tops ?? {}
    for (const lv of playedLevels()) {
      const t = tops[lv.code]
      html += `<div class="rec-salle">${esc(lv.code)} — ${esc(lv.name)}</div>`
      if (!t || t.note.length === 0) {
        html +=
          '<div class="rec-vide">Aucune collecte enregistrée — le palmarès est à prendre.</div>'
        continue
      }
      html += '<div class="rec-grille">'
      html += podium(
        'NOTE',
        t.note,
        (e) => `${e.note} pts`,
        (e) => e.note,
        true,
      )
      html += podium(
        'VOLUME',
        t.volume,
        (e) => fmtL(e.liters),
        (e) => e.liters,
        true,
      )
      html += podium(
        'CHRONO',
        t.chrono,
        (e) => fmtDuree(e.time),
        (e) => e.time,
        false,
      )
      html += '</div>'
    }
    recordsCorps.innerHTML = html || '<div class="rec-vide">Aucune salle.</div>'
  })
}
document.getElementById('home-records')?.addEventListener('click', () => {
  recordsEl.hidden = false
  renderRecordsVoile()
})
document.getElementById('records-fermer')?.addEventListener('click', () => {
  recordsEl.hidden = true
})
recordsEl.addEventListener('pointerdown', (e) => {
  if (e.target === recordsEl) recordsEl.hidden = true
})

// ---- Le voile CODEX : le manuel écrit par la partie elle-même ----------
// Chaque fiche se débloque en VIVANT l'interaction (toucher une surface
// hydrophile en liquide, écarter un rideau en glace…). Verrouillée, une
// fiche n'affiche qu'un « ? » : la question donne envie d'aller essayer.
const codexEl = document.getElementById('codex') as HTMLDivElement
const codexCorps = document.getElementById('codex-corps') as HTMLDivElement
const codexCompte = document.getElementById('codex-compte') as HTMLSpanElement
function renderCodexVoile(): void {
  if (!codexCorps) return
  const groupes: { cle: CodexGroupe; nom: string; icone: string }[] = [
    { cle: 'eau', nom: 'LIQUIDE', icone: '💧' },
    { cle: 'glace', nom: 'GLACE', icone: '❄' },
    { cle: 'vapeur', nom: 'VAPEUR', icone: '💨' },
    { cle: 'phenomenes', nom: 'PHÉNOMÈNES', icone: '✦' },
  ]
  let html = ''
  for (const g of groupes) {
    const fiches = CODEX.filter((d) => d.groupe === g.cle)
    const connues = fiches.filter((d) => codex.connu(d.id)).length
    html += `<div class="cdx-groupe"><span>${g.icone} ${g.nom}</span><i>${connues}/${fiches.length}</i></div>`
    html += '<div class="cdx-grille">'
    for (const d of fiches) {
      if (codex.connu(d.id)) {
        html += `<div class="cdx-carte" data-fiche="${d.id}"><i>${d.icone}</i><div><b>${d.titre}</b><span>${d.texte}</span></div></div>`
      } else {
        html += `<div class="cdx-carte cdx-verrou"><i>?</i><div><b>FICHE À DÉCOUVRIR</b><span>Une interaction du protocole reste à vivre…</span></div></div>`
      }
    }
    html += '</div>'
  }
  codexCorps.innerHTML = html
  if (codexCompte)
    codexCompte.textContent = `${codex.compte()}/${CODEX.length} fiches consignées`
}
document.getElementById('home-codex')?.addEventListener('click', () => {
  codexEl.hidden = false
  renderCodexVoile()
})
// Ouvert DEPUIS LE TOAST en pleine partie, le codex fige l'essai (lecture au
// calme) et le rend en se fermant — ouvert depuis la fiche, rien à figer.
let codexAPause = false
function fermeCodex(): void {
  codexEl.hidden = true
  if (codexAPause) {
    codexAPause = false
    input.paused = false
  }
}
/** Ouvre le codex DÉFILÉ sur une fiche : le chemin du toast (clic, toucher,
 * SELECT à la manette) — la fiche neuve s'illumine le temps d'un regard. */
function ouvreCodexSur(fiche: string): void {
  if (document.body.classList.contains('playing') && !input.paused) {
    input.paused = true
    codexAPause = true
  }
  codexEl.hidden = false
  renderCodexVoile()
  const carte = codexCorps.querySelector<HTMLElement>(`[data-fiche="${fiche}"]`)
  if (carte) {
    carte.scrollIntoView({ block: 'center' })
    carte.classList.add('cdx-neuve')
    window.setTimeout(() => carte.classList.remove('cdx-neuve'), 3200)
  }
}
document.getElementById('codex-fermer')?.addEventListener('click', fermeCodex)
codexEl.addEventListener('pointerdown', (e) => {
  if (e.target === codexEl) fermeCodex()
})

document.getElementById('salles-fermer')?.addEventListener('click', () => {
  sallesEl.hidden = true
})
sallesEl.addEventListener('pointerdown', (e) => {
  if (e.target === sallesEl) sallesEl.hidden = true
})

// ---- Le voile PARAMÈTRES : les réglages du joueur (le banc règle la physique) ----
// Premier réglage : le VERROU DE FRÉQUENCE, anti yo-yo. Le joueur choisit
// une cadence plafond ; la boucle saute les images d'avance. Sur un écran
// rapide (90/120 Hz), verrouiller à 60 échange le « parfois 90, parfois
// 55 » contre un 60 régulier — c'est la stabilité qui se sent, pas la
// pointe. La qualité adaptative vise la cadence choisie (bornée à 60).
// 45 : le Steam Deck cadencé à 45 Hz (réglage SteamOS) — le verrou épouse
// alors exactement la grille de l'écran. Sur un téléphone à 60 Hz, 45 ne
// divise pas 60 : la cadence alterne 17/25 ms (tressautement mécanique) —
// sur écran 60 Hz, préférer 60 ou 30.
const FPS_CHOIX = [30, 45, 50, 60, 90, 120, 240]
let fpsCap = ((): number => {
  const v = Number(localStorage.getItem('sujet21-fps-cap'))
  return FPS_CHOIX.includes(v) ? v : 60
})()
let fpsCapPrecedent = 0 // horloge du limiteur (dernière image RENDUE)
// Résolution dynamique : DÉSACTIVÉE par défaut — le rendu reste en
// résolution native constante, aucune surprise visuelle. Sur une machine
// borderline, la qualité qui descendait « pour tenir 60 » se voyait plus
// que les images perdues. Qui veut l'adaptatif (mobile) l'active au voile.
// Résolution de rendu : FIXE au choix (élevée = native, moyenne ×0,75,
// faible ×0,5) ou DYNAMIQUE (l'adaptatif historique). Constat qui l'a
// motivée : à réglages égaux, le Pixel pousse ~4,2 Mpx quand le Steam Deck
// en pousse ~1 — le shader de composition coûte PAR PIXEL, le téléphone
// paie 4×. Moyenne = 56 % des pixels, faible = 25 % : un allègement GPU
// massif et CONSTANT (pas de yo-yo), l'interface HTML restant nette.
type ResChoix = 'elevee' | 'moyenne' | 'faible' | 'dyn'
const RES_ECHELLES: Record<ResChoix, number> = {
  elevee: 1,
  moyenne: 0.75,
  faible: 0.5,
  dyn: 1,
}
let resChoix: ResChoix = ((): ResChoix => {
  const v = localStorage.getItem('sujet21-res')
  if (v === 'elevee' || v === 'moyenne' || v === 'faible' || v === 'dyn')
    return v
  // migration : l'ancien interrupteur résolution dynamique
  return localStorage.getItem('sujet21-res-dyn') === '1' ? 'dyn' : 'elevee'
})()
const resDynamique = (): boolean => resChoix === 'dyn'
// rendu de la section MOTEUR PHYSIQUE — paresseux : `sim` n'existe pas
// encore quand le voile se câble, il se dessine à l'ouverture
let majMoteurUI: () => void = () => {}
// Rattrapage après un accroc : TEMPS RÉEL (historique — la simulation
// rattrape le temps perdu, quitte à allonger l'image suivante) ou
// FLUIDITÉ (anti-domino : jamais plus de pas que le régime de croisière,
// le retard est abandonné). Les rapports montrent que 80-90 % des images
// lentes du téléphone sont des rafales de rattrapage — mais le ressenti
// appartient au joueur : c'est un réglage.
let rattrapageFluide = localStorage.getItem('sujet21-rattrapage') === 'fluide'
// Cadence de SIMULATION (expérimental) : 120 Hz (précision, défaut) ou
// 60 Hz (économie — un pas par image à 60 im/s : CPU et CHAUFFE divisés
// par deux). Verdict des rapports Pixel : le coût d'un pas TRIPLE au fil
// d'une session (throttling thermique) — le seul remède est de calculer
// moins par seconde. Le comportement physique diffère légèrement à 60 Hz
// (pas deux fois plus grands) : c'est un réglage assumé, pas un défaut.
let simHz: 60 | 120 = localStorage.getItem('sujet21-simhz') === '60' ? 60 : 120
function appliqueSimHz(): void {
  params.dt = 1 / simHz
}
appliqueSimHz()
// Graphismes du décor : RICHE par défaut (bruit procédural complet), SOBRE
// pour débrancher le décoratif dans le shader de composition — mêmes formes,
// mêmes auras, moins de calcul par pixel. C'est l'instrument du test A/B :
// deux rapports de performance, mêmes conditions, seul ce réglage change —
// l'écart chiffre le coût réel des graphismes sur la machine du joueur.
let decorRiche = localStorage.getItem('sujet21-decor') !== 'sobre'
// Graphismes du LIQUIDE, séparés du décor : SOBRE débranche l'éclairage de
// l'eau (relief, spéculaire, miroir, scintillement) dans le shader — la
// silhouette, les couleurs de vitesse et les états restent. C'est le second
// bras du test A/B : si c'est le rendu du liquide qui pèse, c'est CE
// réglage qui fera bouger les chiffres, pas celui du décor.
let eauRiche = localStorage.getItem('sujet21-eau') !== 'sobre'
// Surface du fluide, TROIS rendus au choix : MIROITANT MERCURE (défaut —
// le reflet s'enroule d'un seul tenant autour du corps, comme une bille de
// mercure : le cœur mire le plafond, le bord balaie la salle, les lampes
// s'y mirent), MIROITANTE (reflet des alentours par la houle de chaque
// goutte) ou CLASSIQUE (l'ancien rendu, au pixel près). Valeur passée
// telle quelle au shader : 0 classique, 1 miroitante, 2 mercure.
// La FLÈCHE DE CAP à la manette : retirée par défaut (le regard du Sujet
// suit déjà le stick) — réactivable dans PARAMÈTRES pour qui la préfère.
let flecheVisible = localStorage.getItem('sujet21-fleche') === 'visible'
// LE FAISCEAU laser, trois crans : FOUDROYANT par défaut (aura pulsante
// + mini-arcs électriques qui crépitent le long du rayon, sursaut
// amplifié), SOMPTUEUX (flux + lueurs, sursaut sobre), CLASSIQUE
// (l'ancien rendu au pixel près).
let faisceauChoix = ((): number => {
  const v = localStorage.getItem('sujet21-faisceau')
  return v === 'classique' ? 0 : v === 'somptueux' ? 1 : 2
})()
let eauMiroir =
  localStorage.getItem('sujet21-miroir') === 'classique'
    ? 0
    : localStorage.getItem('sujet21-miroir') === 'miroir'
      ? 1
      : 2
// Éclairage de la PIÈCE : une lampe par cuve, des ombres portées cuites dans
// une carte de lumière (recalculée seulement au changement de décor) et un
// biseau directionnel sur les arêtes — du relief pour presque rien. ACTIF
// par défaut, débranchable ici même ; l'éclairage du volume viendra après.
let lumiereActive = localStorage.getItem('sujet21-lumiere') !== 'off'
// Éclairage du VOLUME : le corps (eau, glace, vapeur) baigne dans la même
// lumière que la pièce — ombres portées comprises, reflet vers la lampe.
// Débranchable séparément ; sans éclairage de pièce, il n'a rien à recevoir.
let lumiereEauActive = localStorage.getItem('sujet21-lumiere-eau') !== 'off'
// RELIEF 2.5D des parois : leur sommet fuit le centre de la caméra, la face
// latérale se révèle du côté qui regarde le centre — en se déplaçant, on
// aperçoit les flancs des éléments qu'on aborde. EXPÉRIMENTAL : OFF par
// défaut le temps de la validation à la manette ; LÉGER puis FORT à l'essai.
let reliefChoix = (localStorage.getItem('sujet21-relief') ?? 'off') as
  | 'off'
  | 'leger'
  | 'fort'
const RELIEF_K = { off: 0, leger: 0.035, fort: 0.07 } as const
const paramsEl = document.getElementById('params') as HTMLDivElement
{
  const choix = document.getElementById('params-fps') as HTMLDivElement
  const renderFps = (): void => {
    choix.innerHTML = ''
    for (const hz of FPS_CHOIX) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = `${hz}`
      b.className = hz === fpsCap ? 'actif' : ''
      b.addEventListener('click', () => {
        fpsCap = hz
        localStorage.setItem('sujet21-fps-cap', String(hz))
        fpsCapPrecedent = 0 // la prochaine image passe tout de suite
        perf.reset() // la fenêtre de mesure repart : un rapport = une config
        renderFps()
      })
      choix.appendChild(b)
    }
  }
  renderFps()

  const choixRes = document.getElementById('params-resdyn') as HTMLDivElement
  const renderRes = (): void => {
    choixRes.innerHTML = ''
    for (const [mode, label] of [
      ['elevee', 'ÉLEVÉE'],
      ['moyenne', 'MOYENNE'],
      ['faible', 'FAIBLE'],
      ['dyn', 'DYNAMIQUE'],
    ] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.className = resChoix === mode ? 'actif' : ''
      b.addEventListener('click', () => {
        resChoix = mode
        localStorage.setItem('sujet21-res', mode)
        if (mode !== 'dyn') qualityLevel = 0 // les paliers adaptatifs se rangent
        perf.reset()
        renderRes()
      })
      choixRes.appendChild(b)
    }
  }
  renderRes()

  const choixDecor = document.getElementById('params-decor') as HTMLDivElement
  const renderDecor = (): void => {
    choixDecor.innerHTML = ''
    for (const [riche, label] of [
      [true, 'RICHES'],
      [false, 'SOBRES'],
    ] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.className = decorRiche === riche ? 'actif' : ''
      b.addEventListener('click', () => {
        decorRiche = riche
        localStorage.setItem('sujet21-decor', riche ? 'riche' : 'sobre')
        perf.reset()
        renderDecor()
      })
      choixDecor.appendChild(b)
    }
  }
  renderDecor()

  const choixRelief = document.getElementById('params-relief') as HTMLDivElement
  const renderRelief = (): void => {
    choixRelief.innerHTML = ''
    for (const [mode, label] of [
      ['off', 'OFF'],
      ['leger', 'LÉGER'],
      ['fort', 'FORT'],
    ] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.className = reliefChoix === mode ? 'actif' : ''
      b.addEventListener('click', () => {
        reliefChoix = mode
        localStorage.setItem('sujet21-relief', mode)
        perf.reset()
        renderRelief()
      })
      choixRelief.appendChild(b)
    }
  }
  renderRelief()

  const choixFpsAff = document.getElementById('params-fpsaff') as HTMLDivElement
  const renderFpsAff = (): void => {
    choixFpsAff.innerHTML = ''
    for (const [on, label] of [
      [false, 'MASQUÉ'],
      [true, 'AFFICHÉ'],
    ] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.className = fpsAffiche === on ? 'actif' : ''
      b.addEventListener('click', () => {
        fpsAffiche = on
        localStorage.setItem('sujet21-fps-aff', on ? '1' : '0')
        fpsCoin.hidden = !on
        renderFpsAff()
      })
      choixFpsAff.appendChild(b)
    }
  }
  renderFpsAff()

  const choixSim = document.getElementById('params-simhz') as HTMLDivElement
  const renderSimHz = (): void => {
    choixSim.innerHTML = ''
    for (const hz of [120, 60] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = hz === 120 ? '120 — PRÉCISION' : '60 — ÉCONOMIE'
      b.className = simHz === hz ? 'actif' : ''
      b.addEventListener('click', () => {
        simHz = hz
        localStorage.setItem('sujet21-simhz', String(hz))
        appliqueSimHz()
        perf.reset()
        renderSimHz()
      })
      choixSim.appendChild(b)
    }
  }
  renderSimHz()

  const choixRatt = document.getElementById(
    'params-rattrapage',
  ) as HTMLDivElement
  const renderRatt = (): void => {
    choixRatt.innerHTML = ''
    for (const [fluide, label] of [
      [false, 'TEMPS RÉEL'],
      [true, 'FLUIDITÉ'],
    ] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.className = rattrapageFluide === fluide ? 'actif' : ''
      b.addEventListener('click', () => {
        rattrapageFluide = fluide
        localStorage.setItem('sujet21-rattrapage', fluide ? 'fluide' : 'reel')
        perf.reset()
        renderRatt()
      })
      choixRatt.appendChild(b)
    }
  }
  renderRatt()

  const choixMoteur = document.getElementById('params-moteur') as HTMLDivElement
  const etatMoteur = document.getElementById(
    'params-moteur-etat',
  ) as HTMLDivElement
  const renderMoteur = (): void => {
    choixMoteur.innerHTML = ''
    for (const [mode, label] of [
      ['wasm', 'WASM'],
      ['js', 'JAVASCRIPT'],
    ] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      const actif = mode === 'wasm' ? sim.moteurWasm : !sim.moteurWasm
      b.className = actif ? 'actif' : ''
      if (mode === 'wasm' && noyauxWasm === null) b.disabled = true
      b.addEventListener('click', () => {
        moteurChoisi = mode
        localStorage.setItem('sujet21-moteur', mode)
        appliqueMoteur(sim)
        perf.reset() // A/B propre : le rapport ne mélange jamais deux moteurs
        renderMoteur()
      })
      choixMoteur.appendChild(b)
    }
    etatMoteur.textContent =
      noyauxWasm === null
        ? 'Module WASM en cours de chargement — JavaScript en attendant.'
        : sim.moteurWasm
          ? 'Noyaux compilés actifs (grille, voisins, densité, viscosité).'
          : 'Moteur JavaScript historique actif.'
  }
  majMoteurUI = renderMoteur

  const choixEau = document.getElementById('params-eau') as HTMLDivElement
  const renderEau = (): void => {
    choixEau.innerHTML = ''
    for (const [riche, label] of [
      [true, 'RICHE'],
      [false, 'SOBRE'],
    ] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.className = eauRiche === riche ? 'actif' : ''
      b.addEventListener('click', () => {
        eauRiche = riche
        localStorage.setItem('sujet21-eau', riche ? 'riche' : 'sobre')
        perf.reset()
        renderEau()
      })
      choixEau.appendChild(b)
    }
  }
  renderEau()

  const choixMiroir = document.getElementById(
    'params-miroir',
  ) as HTMLDivElement | null
  if (choixMiroir) {
    const renderMiroir = (): void => {
      choixMiroir.innerHTML = ''
      for (const [miroir, cle, label] of [
        [2, 'mercure', 'MIROITANT MERCURE'],
        [1, 'miroir', 'MIROITANTE'],
        [0, 'classique', 'CLASSIQUE'],
      ] as const) {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = label
        b.className = eauMiroir === miroir ? 'actif' : ''
        b.addEventListener('click', () => {
          eauMiroir = miroir
          localStorage.setItem('sujet21-miroir', cle)
          perf.reset()
          renderMiroir()
        })
        choixMiroir.appendChild(b)
      }
    }
    renderMiroir()
  }

  const choixFaisceau = document.getElementById(
    'params-faisceau',
  ) as HTMLDivElement | null
  if (choixFaisceau) {
    const renderFaisceau = (): void => {
      choixFaisceau.innerHTML = ''
      for (const [val, cle, label] of [
        [2, 'foudroyant', 'FOUDROYANT'],
        [1, 'somptueux', 'SOMPTUEUX'],
        [0, 'classique', 'CLASSIQUE'],
      ] as const) {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = label
        b.className = faisceauChoix === val ? 'actif' : ''
        b.addEventListener('click', () => {
          faisceauChoix = val
          localStorage.setItem('sujet21-faisceau', cle)
          renderFaisceau()
        })
        choixFaisceau.appendChild(b)
      }
    }
    renderFaisceau()
  }

  const choixFleche = document.getElementById(
    'params-fleche',
  ) as HTMLDivElement | null
  if (choixFleche) {
    const renderFleche = (): void => {
      choixFleche.innerHTML = ''
      for (const [visible, cle, label] of [
        [false, 'masquee', 'MASQUÉE'],
        [true, 'visible', 'VISIBLE'],
      ] as const) {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = label
        b.className = flecheVisible === visible ? 'actif' : ''
        b.addEventListener('click', () => {
          flecheVisible = visible
          localStorage.setItem('sujet21-fleche', cle)
          renderFleche()
        })
        choixFleche.appendChild(b)
      }
    }
    renderFleche()
  }

  const choixLumiere = document.getElementById(
    'params-lumiere',
  ) as HTMLDivElement | null
  if (choixLumiere) {
    const renderLumiere = (): void => {
      choixLumiere.innerHTML = ''
      for (const [on, label] of [
        [true, 'ACTIF'],
        [false, 'COUPÉ'],
      ] as const) {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = label
        b.className = lumiereActive === on ? 'actif' : ''
        b.addEventListener('click', () => {
          lumiereActive = on
          localStorage.setItem('sujet21-lumiere', on ? 'on' : 'off')
          perf.reset()
          renderLumiere()
        })
        choixLumiere.appendChild(b)
      }
    }
    renderLumiere()
  }

  const choixLumEau = document.getElementById(
    'params-lumeau',
  ) as HTMLDivElement | null
  if (choixLumEau) {
    const renderLumEau = (): void => {
      choixLumEau.innerHTML = ''
      for (const [on, label] of [
        [true, 'ACTIF'],
        [false, 'COUPÉ'],
      ] as const) {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = label
        b.className = lumiereEauActive === on ? 'actif' : ''
        b.addEventListener('click', () => {
          lumiereEauActive = on
          localStorage.setItem('sujet21-lumiere-eau', on ? 'on' : 'off')
          perf.reset()
          renderLumEau()
        })
        choixLumEau.appendChild(b)
      }
    }
    renderLumEau()
  }
}

// ---- Rapport de performance : mesurer la VRAIE machine, analyser à distance ----
const perf = new PerfCollector()
const perfVif = document.getElementById('perf-vif') as HTMLDivElement
const perfEtat = document.getElementById('perf-etat') as HTMLDivElement
let perfVifCompte = 0
function majPerfVifForce(): void {
  const r = perf.resume()
  perfVif.textContent =
    r.images < 30
      ? 'Mesure en cours — jouez quelques secondes, le voile ouvert ou fermé.'
      : `En direct : ${r.p50.toFixed(0)} im/s en médiane · plancher (p5) ${r.p95.toFixed(0)} im/s · fenêtre de ${r.images} images.`
}
function majPerfVif(): void {
  if (paramsEl.hidden) return
  if (++perfVifCompte % 30 !== 0) return // rafraîchi ~2 fois par seconde
  majPerfVifForce()
}
function rapportPerf(): Record<string, unknown> {
  return perf.rapport({
    config: {
      fpsCap,
      resolution: resChoix,
      resolutionDynamique: resDynamique(),
      graphismes: decorRiche ? 'riches' : 'sobres',
      liquide: eauRiche ? 'riche' : 'sobre',
      eclairage: lumiereActive ? 'actif' : 'coupe',
      eclairageVolume: lumiereActive && lumiereEauActive ? 'actif' : 'coupe',
      moteur: sim.moteurWasm
        ? 'wasm'
        : noyauxWasm
          ? 'javascript'
          : 'javascript (wasm non chargé)',
      rattrapage: rattrapageFluide ? 'fluidite' : 'temps-reel',
      simHz,
      palierQualite: qualityLevel,
      timeWarp: params.timeWarp,
      downsampleChamp: params.renderDownsample,
    },
    session: {
      tableau: `${level.code} — ${level.name}`,
      particules: sim.count,
      volumeL: Math.round(sim.liters() * 100) / 100,
      // la composition dit ce que le tableau coûte : boîtes (rendu par
      // pixel + collisions), lasers (traçage par image), zones, éponges
      composition: {
        boites: level.boxes.length,
        lasers: (level.lasers ?? []).length,
        cibles: (level.cibles ?? []).length,
        zones: (level.zones ?? []).length,
        rails: (level.rails ?? []).length,
        lumieres: (level.lumieres ?? []).length,
        cellulesEponge: (level.sponges ?? []).reduce(
          (a, s) => a + s.cols * s.rows,
          0,
        ),
        etiquettes: level.labels.length,
      },
      enPause: input.paused,
    },
  })
}
document.getElementById('perf-copier')?.addEventListener('click', () => {
  const texte = JSON.stringify(rapportPerf(), null, 2)
  navigator.clipboard
    ?.writeText(texte)
    .then(() => {
      perfEtat.textContent =
        'Rapport copié — collez-le dans la conversation d’analyse.'
    })
    .catch(() => {
      perfEtat.textContent =
        'Presse-papier refusé — le rapport est dans la console (F12).'
      console.log(texte)
    })
})
document.getElementById('perf-envoyer')?.addEventListener('click', () => {
  perfEtat.textContent = 'Envoi…'
  fetch('/api/perf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      auteur: records.operator() || 'anonyme',
      rapport: rapportPerf(),
    }),
  })
    .then((r) =>
      r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
    )
    .then(() => {
      perfEtat.textContent =
        'Envoyé au labo ✓ — signalez-le, l’analyse peut commencer.'
    })
    .catch(() => {
      perfEtat.textContent =
        'Envoi impossible (hors ligne ou serveur local) — utilisez COPIER.'
    })
})

document.getElementById('home-params')?.addEventListener('click', () => {
  paramsEl.hidden = false
  majPerfVifForce() // l'aperçu s'affiche tout de suite, pas 30 images plus tard
  majMoteurUI() // la section moteur reflète l'état réel (module chargé ou non)
})
document.getElementById('params-fermer')?.addEventListener('click', () => {
  paramsEl.hidden = true
})
// ---- PROTOCOLE : rejouer l'éveil, réinitialiser l'opérateur ----
document.getElementById('proto-rejouer')?.addEventListener('click', () => {
  try {
    localStorage.removeItem(CLE_EVEIL)
  } catch {
    // sans gravité : lanceEveil rejouera quand même cette session
  }
  paramsEl.hidden = true
  if (requireName()) return
  // l'éveil se rejoue SUR le tableau en cours : plan large, cryostase, cartes
  document.body.classList.add('playing')
  input.paused = false
  hasPlayed = true
  startBtn.textContent = "REPRENDRE L'ESSAI"
  homeRestartBtn.hidden = false
  restart()
  lanceEveil()
})
// Réinitialiser l'opérateur : destructif, donc DEUX clics — le premier arme
// le bouton (libellé rouge explicite), le second efface nom + registres
// locaux et recharge : le voile de signature revient, vierge. Les trophées
// et les réglages restent (seuls les RECORDS sont annoncés perdus).
const protoReset = document.getElementById(
  'proto-reset-nom',
) as HTMLButtonElement | null
let protoResetArme = 0
protoReset?.addEventListener('click', () => {
  const now = performance.now()
  if (now - protoResetArme > 6000) {
    protoResetArme = now
    protoReset.classList.add('danger')
    protoReset.textContent = 'EFFACER NOM + RECORDS — CONFIRMER'
    window.setTimeout(() => {
      // non confirmé à temps : le bouton se désarme, rien n'est perdu
      if (performance.now() - protoResetArme >= 5900) {
        protoReset.classList.remove('danger')
        protoReset.textContent = 'RÉINITIALISER L’OPÉRATEUR'
      }
    }, 6000)
    return
  }
  try {
    localStorage.removeItem('projet21.registres.v1')
    localStorage.removeItem('sujet21-signature-v1')
  } catch {
    // stockage indisponible : rien à effacer non plus
  }
  location.reload()
})
paramsEl.addEventListener('pointerdown', (e) => {
  if (e.target === paramsEl) paramsEl.hidden = true
})

// ---- L'appel de l'œil : à l'arrivée sur la fiche, le son et le plein
// écran battent trois fois — on sait où toucher d'abord.
function appelOeil(): void {
  for (const id of ['home-mute', 'home-plein']) {
    const b = document.getElementById(id) as HTMLButtonElement | null
    if (!b || b.hidden) continue
    b.classList.remove('appel')
    void b.offsetWidth // relance l'animation
    b.classList.add('appel')
  }
}
window.setTimeout(appelOeil, 600)

const homeRestartBtn = document.getElementById(
  'home-restart',
) as HTMLButtonElement
function closeHome(): void {
  if (requireName()) return // pas de plongée sans opérateur identifié
  // Une expédition SAUVÉE attend et rien n'a encore été joué : le bouton
  // principal EST la reprise (au début de sa salle) — aucune fausse
  // manœuvre ne peut repartir de la salle 1 par réflexe.
  const save = runSauvee()
  if (!hasPlayed && save) {
    reprendreRun(save)
    return
  }
  if (!hasPlayed) {
    // Premier plongeon : le jeu COMMENCE AU HUB — la cuve d'entraînement
    // du module Méduse, sous l'œil des Créateurs. L'éveil s'y joue.
    entrerHub()
    return
  }
  document.body.classList.add('playing')
  input.paused = false // la fiche figeait l'essai : il repart
  startBtn.textContent = "REPRENDRE L'ESSAI"
  homeRestartBtn.hidden = false
}

// Entrer au hub : le module d'accueil, joué SANS enjeu (pas de records,
// pas d'échantillon consommé). Son sas lance la run.
function entrerHub(): void {
  auHub = true
  testLevel = null
  fromEditor = false
  hasPlayed = true
  document.body.classList.add('playing')
  input.paused = false
  startBtn.textContent = "REPRENDRE L'ESSAI"
  homeRestartBtn.hidden = false
  restart()
  montrerOnboard()
  lanceEveil() // la cryostase s'éveille dans la cuve d'entraînement
  // LE SCÉNARIO : l'ouverture froide (une seule fois dans la vie du
  // joueur) puis l'arrivée au hub — elles s'enchaînent si les deux
  // s'appliquent. C'est ici que vit le fil narratif du roguelike.
  void joueMoment('premier-lancement').then(() => joueMoment('avant-hub'))
}
function openHome(): void {
  document.body.classList.remove('playing')
  appelOeil()
  // La fiche fige l'essai : revenir au menu, c'est faire une pause — la
  // cuve n'avance plus dans le dos du joueur.
  if (hasPlayed) input.paused = true
  homeRestartBtn.hidden = !hasPlayed
  majBoutonsRun()
}
startBtn.addEventListener('click', closeHome)

// ---- L'EXPÉDITION SE SOUVIENT : la progression (salle atteinte, réserve,
// chrono) s'écrit au DÉBUT de chaque salle du parcours PRINCIPAL. On peut
// retourner au menu, fermer le jeu, revenir — et reprendre au début de la
// salle où on était. La RUN SECONDAIRE joue le même parcours (records
// comptés) sans JAMAIS toucher à cette sauvegarde : l'expédition
// principale reste à l'abri.
const CLE_RUN = 'sujet21-run-v1'
interface RunSauvee {
  index: number
  liters: number
  time: number
  vies: number
  conclues: number
  instruments: string[]
  xp: number
  livreTotal: number
}
function runSauvee(): RunSauvee | null {
  try {
    const d = JSON.parse(
      localStorage.getItem(CLE_RUN) ?? 'null',
    ) as RunSauvee | null
    if (!d || typeof d.index !== 'number' || d.index < 1) return null
    return {
      index: Math.floor(d.index),
      liters: Number(d.liters) || 0,
      time: Number(d.time) || 0,
      // sauvegardes d'avant les vies : on reprend avec l'échantillon unique
      vies: Math.max(1, Math.min(VIES_MAX, Math.floor(Number(d.vies) || 1))),
      conclues: Math.max(0, Math.floor(Number(d.conclues) || 0)),
      instruments: Array.isArray(d.instruments)
        ? d.instruments.filter((x): x is string => typeof x === 'string')
        : [],
      xp: Math.max(0, Number(d.xp) || 0),
      livreTotal: Math.max(0, Number(d.livreTotal) || 0),
    }
  } catch {
    return null
  }
}
function sauveRun(): void {
  // seule l'expédition PRINCIPALE s'écrit — et seulement passée la salle 1
  // (une partie à peine commencée n'a rien à sauver ; y revenir efface).
  // Le hub, hors run, ne touche jamais à la sauvegarde.
  if (testLevel || auHub) return
  try {
    if (levelIndex < 1) localStorage.removeItem(CLE_RUN)
    else
      localStorage.setItem(
        CLE_RUN,
        JSON.stringify({
          index: levelIndex,
          liters: run.bonbonneLiters,
          time: run.runTime,
          vies: run.vies,
          conclues: run.conclues,
          instruments: run.instruments,
          xp: run.xp,
          livreTotal: run.livreTotal,
        }),
      )
  } catch {
    // stockage indisponible : la reprise attendra
  }
  majBoutonsRun()
}
function effaceRun(): void {
  try {
    localStorage.removeItem(CLE_RUN)
  } catch {
    // sans gravité
  }
  majBoutonsRun()
}
function reprendreRun(save: RunSauvee): void {
  auHub = false
  testLevel = null
  fromEditor = false
  levelIndex = Math.min(save.index, playedLevels().length - 1)
  run.bonbonneLiters = save.liters
  run.runTime = save.time
  run.vies = save.vies
  run.conclues = save.conclues
  run.instruments = save.instruments.slice()
  run.xp = save.xp
  run.livreTotal = save.livreTotal
  hasPlayed = true
  document.body.classList.add('playing')
  input.paused = false
  startBtn.textContent = "REPRENDRE L'ESSAI"
  homeRestartBtn.hidden = false
  restart()
  lanceEveil()
  majBoutonsRun()
}
function majBoutonsRun(): void {
  const save = runSauvee()
  const total = playedLevels().length
  const btnAband = document.getElementById(
    'start-abandon',
  ) as HTMLButtonElement | null
  if (btnAband) {
    // seulement quand une run est EN COURS : au labo il n'y a rien à quitter,
    // et un essai d'éditeur se referme par son propre chemin
    btnAband.hidden = auHub || !!testLevel || !hasPlayed
    if (btnAband.hidden) {
      btnAband.classList.remove('arme')
      btnAband.textContent = 'ABANDONNER LA RUN — RETOUR AU LABO'
    }
  }
  if (!hasPlayed && save) {
    startBtn.textContent = `REPRENDRE L'EXPÉDITION — SALLE ${save.index + 1}/${total}`
  }
}
// Abandonner : en DEUX temps (l'expédition en cours se perd — un clic de
// travers ne doit pas l'emporter). Le second clic renvoie au labo.
document.getElementById('start-abandon')?.addEventListener('click', (e) => {
  const b = e.currentTarget as HTMLButtonElement
  if (!b.classList.contains('arme')) {
    b.classList.add('arme')
    b.textContent = 'CONFIRMER — LA RUN EN COURS SERA PERDUE'
    return
  }
  b.classList.remove('arme')
  b.textContent = 'ABANDONNER LA RUN — RETOUR AU LABO'
  // entrerHub() rend la main au jeu et réveille dans la cuve : la fiche
  // se referme d'elle-même, comme à l'arrivée dans le jeu
  document.body.classList.remove('playing')
  abandonneRun()
})
// au chargement, la fiche est déjà à l'écran : les boutons disent tout de
// suite s'il y a une expédition à reprendre
majBoutonsRun()
// Recommencer depuis la fiche : on referme, on relance le tableau courant
homeRestartBtn.addEventListener('click', () => {
  if (requireName()) return
  document.body.classList.add('playing')
  input.paused = false
  startBtn.textContent = "REPRENDRE L'ESSAI"
  resetAction()
})
// Un essai HORS EXPÉDITION : un tableau (ou une file de tableaux) joué à
// part, sans toucher aux registres. Sert au prototype 21-A bis (depuis le
// banc) et aux salles laser (bouton de la fiche) — la file enchaîne les
// tableaux au sas, comme une mini-expédition d'essai.
// ---- Les cinématiques : le lecteur plein écran, branché sur la bande-son.
// La file d'essai est MIXTE : une étape est un tableau OU une cinématique —
// l'ouverture jouable enchaînera exactement ainsi (planches, puis la cuve).
const lecteurCine = new LecteurCinematique(el('cine'), {
  bruitage: (n) => bande.bruitage(n as Bruitage),
  ponctuation: (n) => bande.ponctuation(n as Ponctuation),
  // null : la cinématique rend la main — le lit du tableau courant reprend
  piste: (n) =>
    bande.setAmbiance(
      n === null
        ? ((level.ambiance as Piste | undefined) ?? null)
        : (n as Piste),
    ),
})
function lireCine(cine: CinematiqueDef): Promise<void> {
  const pause = input.paused
  input.paused = true // aucun geste de jeu ne traverse l'écran de cinématique
  return lecteurCine.joue(cine).then(() => {
    input.paused = pause
  })
}
// Les cinématiques ANCRÉES aux tableaux (cineAvant/cineApres, zones
// déclencheuses) référencent un CODE : cherché parmi les livrées, puis les
// cinématiques du poste (montage), puis la bibliothèque PARTAGÉE — un code
// inconnu est ignoré sans bruit.
let cinesPartagees: CinematiqueDef[] = []
// LE SCÉNARIO : le fil narratif hors tableaux (avant le hub, au lancement
// d'une run, à la défaite…). Le poste garde le dernier connu ; la version
// PARTAGÉE fait foi dès qu'elle arrive.
let scenario: ScenarioDef = chargeScenario()
fetchBibliotheque().then((biblio) => {
  if (!biblio) return
  cinesPartagees = biblio.cines.map((s) => s.cine)
  if (biblio.scenario) {
    scenario = biblio.scenario
    sauveScenario(scenario) // hors ligne la prochaine fois, il est là
  }
})
function lireCineParCode(code: string): Promise<void> {
  const cible = code.trim().toLowerCase()
  const cine = [
    ...CINEMATIQUES_LIVREES,
    ...chargeCinematiques(),
    ...cinesPartagees,
  ].find((c) => c.code.trim().toLowerCase() === cible)
  return cine ? lireCine(cine) : Promise.resolve()
}
// L'état du jeu que les conditions du scénario interrogent — tout existe
// déjà ailleurs, on ne fait que le présenter.
function etatScenario(): EtatScenario {
  return {
    runs: Math.max(0, records.essaiNumber() - 1),
    salleMax: records.expedition()?.tableaux ?? 0,
    condensat,
    trophee: (id) => trophees.gagne(id),
  }
}
/**
 * Joue la cinématique que le scénario retient pour ce moment, s'il y en a
 * une. Premier match gagne ; une règle « une seule fois » est mémorisée
 * DÈS le déclenchement (sauter la cinématique ne la fait pas revenir).
 */
function joueMoment(moment: MomentScenario): Promise<void> {
  const regle = choisitRegle(scenario, moment, etatScenario(), chargeVues())
  if (!regle) return Promise.resolve()
  if (regle.uneFois) noteVue(regle.id)
  return lireCineParCode(regle.cine)
}

// ---- LES SÉQUENCES IN-MAP : la mise en scène DANS le tableau. Le
// séquenceur dit ce qui doit être vrai (teinte des lampes, secousse,
// carte, brèches ouvertes) ; le jeu applique, ici et à chaque image.
const sequenceur = new Sequenceur({
  bruitage: (n) => bande.bruitage(n as Bruitage),
  ponctuation: (n) => bande.ponctuation(n as Ponctuation),
  piste: (n) => bande.setAmbiance(n as Piste),
  cinematique: (code) => lireCineParCode(code),
})
;(window as unknown as { __seq: Sequenceur }).__seq = sequenceur
/** Une séquence par son code : livrée, puis celles du poste. */
function trouveSequence(code: string): SequenceDef | null {
  const cible = code.trim().toLowerCase()
  return (
    [SEQUENCE_ALERTE, ...chargeSequences()].find(
      (s) => s.code.trim().toLowerCase() === cible,
    ) ?? null
  )
}
function demarreSequence(code: string): void {
  const seq = trouveSequence(code)
  if (seq) sequenceur.demarre(seq)
}
// La carte de séquence : un bandeau discret, dans le monde du jeu
const carteSeqEl = el('carte-seq')
let carteSeqTexte = ''
/** Applique à l'écran ce que le séquenceur tient pour vrai. */
function appliqueSequence(): void {
  if (sequenceur.etat.carte !== carteSeqTexte) {
    carteSeqTexte = sequenceur.etat.carte
    carteSeqEl.textContent = carteSeqTexte
    carteSeqEl.classList.toggle('visible', !!carteSeqTexte)
  }
  document.body.classList.toggle('secousse', sequenceur.etat.secousse)
}
/** Les lampes du tableau, teintées par la séquence s'il y a lieu. On ne
 *  touche JAMAIS aux données du tableau : c'est une copie de rendu. */
function lumieresVives(): LumiereDef[] {
  const base = level.lumieres ?? []
  const { teinte, gain } = sequenceur.etat
  if (!teinte && gain === 1) return base
  return base.map((l) => ({
    ...l,
    couleur: teinte ?? l.couleur,
    intensite: (l.intensite ?? 1) * gain,
  }))
}

// Déclencheurs déjà joués dans l'essai en cours (réarmés par restart)
const cinesVues = new Set<string>()
// Le tableau dont la cinématique d'entrée a été jouée : un R sur place ne
// doit pas la rejouer, seule l'ARRIVÉE dans un autre tableau la relance.
let cineNiveauVu: LevelDef | null = null
function estCine(e: LevelDef | CinematiqueDef): e is CinematiqueDef {
  return 'planches' in e
}
// Joue les cinématiques en tête de file (il peut y en avoir plusieurs à la
// suite), puis rend la main au tableau qui suit.
function joueCinesEnTete(puis: () => void): void {
  const tete = testQueue[0]
  if (tete && estCine(tete)) {
    testQueue.shift()
    void lireCine(tete).then(() => joueCinesEnTete(puis))
    return
  }
  puis()
}
function startTest(etapes: (LevelDef | CinematiqueDef)[]): void {
  if (requireName()) {
    openHome() // le champ du nom vit sur la fiche : on la montre pour le remplir
    return
  }
  testQueue = etapes.slice()
  fromEditor = false
  // tout nouveau départ désarme le retour-planche : seule la carte ⏵ le
  // ré-arme, juste après cet appel
  fromPlanche = false
  document.getElementById('planche-retour')?.setAttribute('hidden', '')
  run.bonbonneLiters = 0
  run.runTime = 0
  hasPlayed = true
  // « playing » d'abord : restart() se charge alors lui-même du plan large et
  // du carton de journal — sinon les deux se jouaient en double, en décalé.
  document.body.classList.add('playing')
  input.paused = false
  startBtn.textContent = "REPRENDRE L'ESSAI"
  homeRestartBtn.hidden = false
  joueCinesEnTete(() => {
    const lv = testQueue.shift()
    if (!lv || estCine(lv)) {
      // la file ne contenait que des cinématiques : retour à la fiche
      testLevel = null
      openHome()
      return
    }
    testLevel = lv
    restart()
    montrerOnboard() // premier contact tactile : la prise en main d'abord
    lanceEveil() // premier contact tout court : l'éveil d'abord
  })
}
function startBisTest(): void {
  startTest([TABLEAU_1BIS])
}
// La bibliothèque d'images : import (recompressé WebP), catalogue partagé,
// sélecteur pour les planches — accessible de l'éditeur et du montage
const imagerie = new Imagerie(el('imagerie'), {
  auteur: () => records.operator(),
})
document
  .getElementById('ed-images')
  ?.addEventListener('click', () => imagerie.open())
// La table de montage des cinématiques : l'écran où le concepteur a la
// main — planches, effets, sons, lecture immédiate, export/import, partage.
const montage = new TableMontage(el('montage'), {
  livrees: CINEMATIQUES_LIVREES,
  lire: (c) => lireCine(c),
  auteur: () => records.operator(),
  choisirImage: (rend) => imagerie.open(rend),
  surPartagees: (liste) => {
    cinesPartagees = liste
  },
  surScenario: (s) => {
    scenario = s
  },
  trophees: TROPHEES.map((t) => ({ id: t.id, nom: t.nom })),
})
document
  .getElementById('open-montage')
  ?.addEventListener('click', () => montage.open())
// …et depuis l'éditeur aussi : la table s'ouvre PAR-DESSUS lui (z-index),
// on compose la cinématique puis on branche son code dans le tableau
document
  .getElementById('ed-montage')
  ?.addEventListener('click', () => montage.open())
// Sondes de conception/test : jouer une cinématique arbitraire, lire l'état
;(
  window as unknown as { __lireCine: (c: unknown) => Promise<void> }
).__lireCine = (c) => lireCine(c as CinematiqueDef)
;(window as unknown as { __cineActif: () => boolean }).__cineActif = () =>
  lecteurCine.actif
// Le bouton de la fiche mène aux salles laser : la trilogie 21-H → 21-J
// (miroir, prisme, plasma), enchaînée sas après sas.
startBisBtn.addEventListener('click', () =>
  // l'école d'abord (surfaces, climats, zones), puis les deux trilogies laser
  startTest([
    ...TABLEAUX_ECOLE,
    TABLEAU_8,
    TABLEAU_9,
    TABLEAU_10,
    TABLEAU_11,
    TABLEAU_12,
    TABLEAU_13,
  ]),
)

// ---- Éditeur de tableaux ----
// Il se superpose au jeu ; « Essayer » repasse par le même chemin que le
// prototype (testLevel), donc un tableau édité se joue avec toutes les
// mécaniques, sans toucher à l'expédition ni aux registres.
// « Essayer » vient-il de l'éditeur ? Si oui, on doit pouvoir y retourner
// d'un geste, à tout instant — y compris depuis l'écran de fin d'essai.
let fromEditor = false
const editor = new LevelEditor(el('editor'), {
  // les portées dessinées (aspiration du sas, auras, rails) suivent le banc
  params: () => params,
  play: (lvl) => {
    testLevel = lvl
    fromEditor = true
    run.bonbonneLiters = 0
    run.runTime = 0
    hasPlayed = true
    editor.close()
    document.body.classList.add('playing')
    input.paused = false
    restart()
  },
  quit: () => {
    editor.close()
    fromEditor = false
    testLevel = null
    openHome()
    restart()
  },
  operator: () => records.operator(),
  // les menus déroulants de l'éditeur : les VRAIES cinématiques et séquences
  // connues du poste — livrées, composées ici, et partagées en ligne
  cines: () =>
    [...CINEMATIQUES_LIVREES, ...chargeCinematiques(), ...cinesPartagees]
      .filter((c, i, t) => t.findIndex((o) => o.code === c.code) === i)
      .map((c) => ({ code: c.code, titre: c.titre })),
  sequences: () =>
    [SEQUENCE_ALERTE, ...chargeSequences()]
      .filter((s, i, t) => t.findIndex((o) => o.code === s.code) === i)
      .map((s) => ({ code: s.code, titre: s.titre })),
  libraryChanged: (levels) => {
    libraryLevels = levels.map((s) => s.level)
    renderRegistres()
    updateLibraryButton()
    renderSalles()
  },
  // l'éditeur n'ordonne plus lui-même : son bouton renvoie à LA PLANCHE
  planche: () => void ouvrePlanche(),
  // L2 tenu = Maj : la multi-sélection au Steam Deck (trackpad droit en
  // souris, aucune touche Maj sous la main)
  modMulti: () => manette.ltVal > 0.5,
})

// ---- Les panneaux de l'éditeur se TIRENT au doigt --------------------------
// Steam Deck, trackpad gauche en souris : presser n'importe où dans le
// panneau et GLISSER — le contenu suit le geste, convention tactile (on tire
// le contenu, pas l'ascenseur : glisser vers le haut fait monter le bas de
// la liste). Un clic sans glissement reste un clic ; passé 6 px, le geste
// devient défilement et le clic qui suivrait est avalé.
function glisseAuDoigt(zone: HTMLElement): void {
  let suivi: {
    id: number
    x0: number
    y0: number
    cible: HTMLElement
    top0: number
    left0: number
    engage: boolean
  } | null = null
  let avaleClic = false
  // la zone à défiler : le défilable le plus proche du point pressé (la
  // liste des tableaux a son propre ascenseur, imbriqué dans le panneau)
  const defilable = (depart: HTMLElement): HTMLElement => {
    let n: HTMLElement | null = depart
    while (n) {
      if (n.scrollHeight > n.clientHeight + 1) {
        const s = getComputedStyle(n)
        if (/(auto|scroll)/.test(s.overflowY)) return n
      }
      if (n === zone) break
      n = n.parentElement
    }
    return zone
  }
  zone.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    avaleClic = false
    const t = e.target as HTMLElement
    if (t.closest('input, select, textarea')) return // les champs d'abord
    suivi = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      cible: defilable(t),
      top0: 0,
      left0: 0,
      engage: false,
    }
    suivi.top0 = suivi.cible.scrollTop
    suivi.left0 = suivi.cible.scrollLeft
  })
  zone.addEventListener('pointermove', (e) => {
    if (!suivi || e.pointerId !== suivi.id) return
    const dx = e.clientX - suivi.x0
    const dy = e.clientY - suivi.y0
    if (!suivi.engage) {
      if (Math.hypot(dx, dy) < 6) return
      suivi.engage = true
      try {
        zone.setPointerCapture(e.pointerId)
      } catch {
        // pointeur déjà relâché ou simulé : le glissement marche sans capture
      }
    }
    suivi.cible.scrollTop = suivi.top0 - dy
    suivi.cible.scrollLeft = suivi.left0 - dx
    e.preventDefault()
  })
  const finit = (e: PointerEvent): void => {
    if (!suivi || e.pointerId !== suivi.id) return
    avaleClic = suivi.engage // le glissement ne doit pas cliquer en se posant
    suivi = null
  }
  zone.addEventListener('pointerup', finit)
  zone.addEventListener('pointercancel', finit)
  zone.addEventListener(
    'click',
    (e) => {
      if (avaleClic) {
        avaleClic = false
        e.preventDefault()
        e.stopPropagation()
      }
    },
    true,
  )
}
for (const p of Array.from(
  document.querySelectorAll<HTMLElement>('#editor .ed-side'),
))
  glisseAuDoigt(p)

// ---- L'ÉDITEUR au STICK GAUCHE : ses panneaux défilent comme la planche —
// même mécanique que le stick droit des menus, même vitesse. Le trackpad
// gauche du Deck configuré en joystick parle sur les mêmes axes. Le
// défilement vise le défilable SOUS LE CURSEUR (panneau gauche, panneau
// droit, liste des tableaux…) — à défaut, le panneau de droite.
const editeurHote = document.getElementById('editor') as HTMLElement
let editeurDefilable: HTMLElement | null = null
function defilableSous(depart: HTMLElement | null): HTMLElement | null {
  let n: HTMLElement | null = depart
  while (n && n !== editeurHote) {
    if (
      n.scrollHeight > n.clientHeight + 4 ||
      n.scrollWidth > n.clientWidth + 4
    ) {
      const s = getComputedStyle(n)
      if (/(auto|scroll)/.test(s.overflowY + s.overflowX)) return n
    }
    n = n.parentElement
  }
  return null
}
editeurHote.addEventListener('pointermove', (e) => {
  editeurDefilable = defilableSous(e.target as HTMLElement)
})
function defileEditeur(dt: number): void {
  const vx = manette.dirX * manette.force
  const vy = manette.dirY * manette.force
  if (Math.abs(vx) < 0.02 && Math.abs(vy) < 0.02) return
  const sc =
    editeurDefilable && document.contains(editeurDefilable)
      ? editeurDefilable
      : document.querySelector<HTMLElement>('#editor .ed-side--right')
  if (!sc) return
  sc.scrollTop += vy * 1100 * dt
  sc.scrollLeft += vx * 1100 * dt
}

// ---- LA PLANCHE : l'ordonnancement de l'expédition, en cartes visuelles --
// Toutes les salles de la bibliothèque en mini-cartes : glisser (ou ◀ ▶)
// réordonne LA séquence — la même que l'éditeur (reorderLibrary), qui se
// resynchronise aussitôt. Le champ code enregistre la nomenclature via
// saveLevel. Le hub et ses chantiers ne s'affichent pas (hors séquence)
// mais GARDENT leur place dans l'ordre envoyé au serveur.
const plancheEl = document.getElementById('planche') as HTMLDivElement
let plancheTous: StoredLevel[] = []
let plancheBusy = false
// L'ESSAI DEPUIS LA PLANCHE : le ⏵ d'une carte lance le tableau, et l'on
// REVIENT là où on en était — bouton « revenir à la planche » en jeu, et
// retour automatique à la conclusion de l'essai (le miroir de fromEditor).
let fromPlanche = false
let plancheScroll = 0
function retournePlanche(): void {
  fromPlanche = false
  document.getElementById('planche-retour')?.setAttribute('hidden', '')
  openHome() // fige l'essai, comme le retour au menu
  plancheEl.hidden = false
  const corps = document.getElementById('planche-corps')
  if (corps) corps.scrollTop = plancheScroll
}
document
  .getElementById('planche-retour')
  ?.addEventListener('click', retournePlanche)
function plancheDit(msg: string): void {
  const e = document.getElementById('planche-etat')
  if (e) e.textContent = msg
}
/** Répercute une réponse serveur partout : planche, fiche, salles, éditeur.
 * L'éditeur ADOPTE la réponse telle quelle : re-télécharger tomberait sur le
 * cache du magasin (pointeur servi 60 s) et faisait revenir l'ancien ordre. */
function plancheSync(saved: StoredLevel[]): void {
  plancheTous = saved
  libraryLevels = saved.map((s) => s.level)
  renderRegistres()
  updateLibraryButton()
  renderSalles()
  editor.adopteBibliotheque(saved)
  renderPlanche()
}
async function ouvrePlanche(): Promise<void> {
  plancheEl.hidden = false
  const corps = document.getElementById('planche-corps')
  if (corps) corps.innerHTML = ''
  plancheDit('Chargement de la bibliothèque…')
  const lib = await fetchLibrary()
  if (!lib) {
    plancheDit(
      'Bibliothèque injoignable (hors ligne ou serveur local) : la planche ordonne la bibliothèque partagée, elle a besoin du serveur.',
    )
    return
  }
  plancheTous = lib
  renderPlanche()
  plancheDit(
    plancheTous.some((s) => !estCodeHub(s.level.code))
      ? ''
      : 'Bibliothèque vide : enregistrez des tableaux depuis l’éditeur, ils apparaîtront ici.',
  )
}
/** L'ordre COMPLET à envoyer : les cartes visibles réarrangées, le hub et
 * ses chantiers inchangés à leurs positions d'origine. */
async function plancheOrdonne(visibles: StoredLevel[]): Promise<void> {
  if (plancheBusy) return
  plancheBusy = true
  let k = 0
  const ordre = plancheTous.map((s) =>
    estCodeHub(s.level.code) ? s.id : visibles[k++].id,
  )
  // rendu optimiste : la carte bouge tout de suite, le serveur confirme
  const avant = plancheTous
  plancheTous = ordre.map((id) => plancheTous.find((s) => s.id === id)!)
  renderPlanche()
  plancheDit('Enregistrement de l’ordre…')
  const saved = await reorderLibrary(ordre)
  plancheBusy = false
  if (saved) {
    plancheSync(saved)
    plancheDit('Ordre enregistré — la séquence de l’éditeur suit.')
  } else {
    plancheTous = avant
    renderPlanche()
    plancheDit('Réordonnancement refusé : bibliothèque injoignable.')
  }
}
async function plancheCode(id: string, brut: string): Promise<void> {
  if (plancheBusy) return
  const entry = plancheTous.find((s) => s.id === id)
  if (!entry) return
  const code = codeCanon(brut.trim()).slice(0, 16)
  if (!code || code === entry.level.code) {
    renderPlanche() // restaure l'affichage si le champ a été vidé
    return
  }
  plancheBusy = true
  entry.level.code = code
  plancheDit(`Enregistrement du code « ${code} »…`)
  const saved = await saveLevel(
    entry.level,
    id,
    records.operator() || 'anonyme',
  )
  plancheBusy = false
  if (saved) {
    plancheSync(saved.levels)
    const d = decodeCodeAtelier(code)
    plancheDit(
      d
        ? `Code « ${code} » enregistré — ${MOMENT_COURT[d.moment].toLowerCase()} · ${MECANIQUE_NOMS[d.mecanique]} · difficulté ${d.difficulte}.`
        : `Code « ${code} » enregistré (hors nomenclature : il se joue pareil, sans tri par code).`,
    )
  } else {
    plancheDit('Enregistrement refusé : bibliothèque injoignable.')
    void ouvrePlanche() // repart de l'état serveur
  }
}
// ---- Les MOLETTES du code : chaque chiffre se règle sur place ----------
// Un cran ▴ au-dessus, la valeur au centre (une liste déroulante : le
// picker natif sur iPad), un cran ▾ en dessous — sobre, au doigt comme à
// la souris. L'enregistrement part un instant après le dernier cran.
const CHOIX_MOMENT = ['1', '2', '3']
const CHOIX_MECA = ['0', '1', '2', '3']
const CHOIX_DIFF = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
const CHOIX_LETTRE = Array.from({ length: 26 }, (_, i) =>
  String.fromCharCode(65 + i),
)
function roueHtml(
  cur: string,
  choix: string[],
  titre: string,
  cap: string,
): string {
  const i = choix.indexOf(cur)
  const opts = choix
    .map(
      (v) =>
        `<option value="${v}"${v === cur ? ' selected' : ''}>${v}</option>`,
    )
    .join('')
  return (
    `<span class="pr-col">` +
    `<button type="button" class="pr-cran" data-dir="1" title="${titre} — cran au-dessus"${i >= choix.length - 1 ? ' disabled' : ''}>▴</button>` +
    `<select class="pr-sel" title="${titre}">${opts}</select>` +
    `<button type="button" class="pr-cran" data-dir="-1" title="${titre} — cran en dessous"${i <= 0 ? ' disabled' : ''}>▾</button>` +
    `<small class="pr-cap">${cap}</small>` +
    `</span>`
  )
}
function chipsHtml(code: string): string {
  const d = decodeCodeAtelier(code)
  return d
    ? `<i>${MOMENT_COURT[d.moment]}</i>` +
        `<i class="sc-m${d.mecanique}">${MECANIQUE_NOMS[d.mecanique].toUpperCase()}</i>` +
        `<i>DIFF ${d.difficulte}</i>`
    : ''
}
const plancheTimers = new Map<string, number>()
/** On peut monter plusieurs crans d'affilée : un seul enregistrement part,
 * un instant après le dernier geste. */
function plancheCodePlusTard(id: string, code: string): void {
  const t = plancheTimers.get(id)
  if (t !== undefined) window.clearTimeout(t)
  plancheTimers.set(
    id,
    window.setTimeout(() => {
      plancheTimers.delete(id)
      if (plancheBusy) {
        plancheCodePlusTard(id, code) // le serveur est occupé : on repasse
        return
      }
      void plancheCode(id, code)
    }, 600),
  )
}
function renderPlanche(): void {
  const corps = document.getElementById('planche-corps')
  if (!corps) return
  const visibles = plancheTous.filter((s) => !estCodeHub(s.level.code))
  corps.innerHTML = ''
  visibles.forEach((s, i) => {
    const carte = document.createElement('div')
    carte.className = 'pl-carte'
    carte.draggable = true
    carte.dataset.id = s.id
    const d = decodeCodeAtelier(s.level.code)
    const esc = (t: string): string =>
      t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    // le code, molette par molette : « 123 » nu, ou la codification
    // complète « 21AB-123 » (le « 21 » et le tiret restent gravés)
    const m21 = /^21\s*([A-Z])([A-Z])\s*-\s*(\d)(\d)(\d)$/i.exec(s.level.code)
    const m3 = /^(\d)(\d)(\d)$/.exec(s.level.code.trim())
    const roues = d !== null && (m21 !== null || m3 !== null)
    const chiffres = m21
      ? [m21[3], m21[4], m21[5]]
      : m3
        ? [m3[1], m3[2], m3[3]]
        : []
    const rouesHtml = !roues
      ? ''
      : `<div class="pl-roues">` +
        (m21
          ? `<span class="pr-fixe">21</span>` +
            roueHtml(
              m21[1].toUpperCase(),
              CHOIX_LETTRE,
              'ORDRE de la codification (AA, AB, …) — 1ʳᵉ lettre',
              'ORDRE',
            ) +
            roueHtml(
              m21[2].toUpperCase(),
              CHOIX_LETTRE,
              'ORDRE de la codification (AA, AB, …) — 2ᵉ lettre',
              '',
            ) +
            `<span class="pr-fixe">-</span>`
          : '') +
        roueHtml(
          chiffres[0],
          CHOIX_MOMENT,
          'MOMENT de la run — 1 début · 2 milieu · 3 fin',
          'MOMENT',
        ) +
        roueHtml(
          chiffres[1],
          CHOIX_MECA,
          'MÉCANIQUE requise — 0 aucune · 1 glace · 2 vapeur · 3 toutes',
          'MÉCA',
        ) +
        roueHtml(
          chiffres[2],
          CHOIX_DIFF,
          'DIFFICULTÉ — de 0 à 9, à moment et mécanique égaux',
          'DIFF',
        ) +
        `</div>`
    carte.innerHTML =
      `<canvas width="220" height="126"></canvas>` +
      `<span class="pl-rang">${i + 1}</span>` +
      `<button type="button" class="pl-jouer" title="Essayer ce tableau — le bouton « revenir à la planche » vous ramènera ici">⏵</button>` +
      `<button type="button" class="pl-editer" title="Ouvrir ce tableau dans l'ÉDITEUR — la planche est le sélecteur grand format">✎</button>` +
      rouesHtml +
      `<div class="pl-bas">` +
      (roues
        ? ''
        : `<input class="pl-code" maxlength="16" value="${esc(s.level.code)}" title="Le code nomenclature (« 111 ») — Entrée ou sortir du champ enregistre" />`) +
      `<span class="pl-nom" title="${esc(s.level.name)}">${esc(s.level.name)}</span>` +
      `<span class="pl-ord">` +
      `<button type="button" data-tot="-1" title="Jouer plus tôt"${i === 0 ? ' disabled' : ''}>◀</button>` +
      `<button type="button" data-tot="1" title="Jouer plus tard"${i === visibles.length - 1 ? ' disabled' : ''}>▶</button>` +
      `</span></div>` +
      (d ? `<span class="salle-chips">${chipsHtml(s.level.code)}</span>` : '')
    dessineMiniCarte(
      carte.querySelector('canvas') as HTMLCanvasElement,
      s.level,
    )
    // ◀ ▶ : l'échange avec la voisine
    for (const b of Array.from(
      carte.querySelectorAll<HTMLButtonElement>('[data-tot]'),
    )) {
      b.addEventListener('click', () => {
        const j = i + Number(b.dataset.tot)
        if (j < 0 || j >= visibles.length) return
        const next = [...visibles]
        ;[next[i], next[j]] = [next[j], next[i]]
        void plancheOrdonne(next)
      })
    }
    if (roues) {
      // les MOLETTES : chaque cran ajuste un caractère, l'ensemble
      // recompose le code et l'enregistre après le dernier geste
      const sels = Array.from(
        carte.querySelectorAll<HTMLSelectElement>('.pr-sel'),
      )
      const chips = carte.querySelector('.salle-chips')
      const lire = (): string =>
        m21
          ? `21${sels[0].value}${sels[1].value}-${sels[2].value}${sels[3].value}${sels[4].value}`
          : sels.map((x) => x.value).join('')
      const applique = (): void => {
        for (const col of Array.from(carte.querySelectorAll('.pr-col'))) {
          const sel = col.querySelector('select') as HTMLSelectElement
          for (const b of Array.from(
            col.querySelectorAll<HTMLButtonElement>('.pr-cran'),
          ))
            b.disabled =
              b.dataset.dir === '1'
                ? sel.selectedIndex >= sel.options.length - 1
                : sel.selectedIndex <= 0
        }
        const code = lire()
        if (chips) chips.innerHTML = chipsHtml(code) // le sens suit le cran
        plancheCodePlusTard(s.id, code)
      }
      for (const sel of sels) {
        sel.addEventListener('change', applique)
        sel.addEventListener('pointerdown', (e) => e.stopPropagation())
      }
      for (const b of Array.from(
        carte.querySelectorAll<HTMLButtonElement>('.pr-cran'),
      )) {
        b.addEventListener('click', () => {
          const sel = b.parentElement?.querySelector('select')
          if (!sel) return
          const j = sel.selectedIndex + Number(b.dataset.dir)
          if (j < 0 || j >= sel.options.length) return
          sel.selectedIndex = j
          applique()
        })
        b.addEventListener('pointerdown', (e) => e.stopPropagation())
      }
    } else {
      // code hors nomenclature : le champ libre reste — Entrée ou la
      // sortie du champ enregistre (taper « 123 » fait naître les molettes)
      const codeInp = carte.querySelector('.pl-code') as HTMLInputElement
      codeInp.addEventListener(
        'change',
        () => void plancheCode(s.id, codeInp.value),
      )
      codeInp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          codeInp.blur()
        }
        e.stopPropagation()
      })
      codeInp.addEventListener('pointerdown', (e) => e.stopPropagation())
    }
    // le ✎ : la carte s'ouvre dans l'ÉDITEUR — le sélecteur grand format,
    // bien plus commode au doigt que la liste du panneau (Steam Deck)
    carte.querySelector('.pl-editer')?.addEventListener('click', (e) => {
      e.stopPropagation()
      plancheEl.hidden = true
      sallesEl.hidden = true
      openEditor()
      editor.ouvreTableau(s.id)
    })
    // l'ESSAI : la carte se joue, et on saura revenir ici même
    carte.querySelector('.pl-jouer')?.addEventListener('click', (e) => {
      e.stopPropagation()
      plancheScroll = corps.scrollTop
      plancheEl.hidden = true
      sallesEl.hidden = true
      editor.close() // la planche peut être posée sur l'éditeur : on le replie
      startTest([s.level])
      // startTest peut rendre la main à la fiche (nom d'opérateur manquant) :
      // le retour ne s'arme que si l'essai a vraiment démarré
      if (document.body.classList.contains('playing')) {
        fromPlanche = true
        document.getElementById('planche-retour')?.removeAttribute('hidden')
      }
    })
    // le glisser-déposer : attraper une carte, la lâcher sur une autre —
    // la carte prend cette place (le geste de l'éditeur, en grand)
    carte.addEventListener('dragstart', (e) => {
      if (
        (e.target as HTMLElement).closest(
          'input, select, .pl-roues, .pl-ord, .pl-jouer, .pl-editer',
        )
      ) {
        e.preventDefault()
        return
      }
      e.dataTransfer?.setData('text/plain', s.id)
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
      carte.classList.add('dragging')
    })
    carte.addEventListener('dragend', () => {
      carte.classList.remove('dragging')
      for (const c of Array.from(corps.querySelectorAll('.drag-over')))
        c.classList.remove('drag-over')
    })
    carte.addEventListener('dragover', (e) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
      carte.classList.add('drag-over')
    })
    carte.addEventListener('dragleave', () =>
      carte.classList.remove('drag-over'),
    )
    carte.addEventListener('drop', (e) => {
      e.preventDefault()
      carte.classList.remove('drag-over')
      const id = e.dataTransfer?.getData('text/plain') ?? ''
      const from = visibles.findIndex((x) => x.id === id)
      if (id === '' || from < 0 || from === i) return
      const next = [...visibles]
      const [prise] = next.splice(from, 1)
      next.splice(i, 0, prise)
      void plancheOrdonne(next)
    })
    corps.appendChild(carte)
  })
}
document
  .getElementById('salles-planche-btn')
  ?.addEventListener('click', () => void ouvrePlanche())
// la planche s'ouvre aussi depuis l'ACCUEIL (mode concepteur) et depuis
// l'ÉDITEUR : le voile se pose par-dessus, le fermer rend l'écran d'avant
document
  .getElementById('home-planche')
  ?.addEventListener('click', () => void ouvrePlanche())
document
  .getElementById('ed-planche')
  ?.addEventListener('click', () => void ouvrePlanche())
document.getElementById('planche-fermer')?.addEventListener('click', () => {
  plancheEl.hidden = true
})
plancheEl?.addEventListener('pointerdown', (e) => {
  if (e.target === plancheEl) plancheEl.hidden = true
})

// La fiche annonce la séquence jouée : bibliothèque partagée en tête
// (si elle en contient), puis l'expédition livrée à la suite.
const homeSeq = el('home-seq')
function updateLibraryButton(): void {
  const nb = libraryLevels.filter((l) => !estCodeHub(l.code)).length
  homeSeq.textContent =
    nb > 0
      ? `Séquence : ${nb} tableau(x) de la bibliothèque, puis l'expédition livrée — ${playedLevels().length} salles en tout.`
      : `Expédition livrée : ${TABLEAUX.length} tableaux. La bibliothèque partagée est vide.`
}
updateLibraryButton()

// Au démarrage : si la bibliothèque contient une séquence, elle passe en
// tête de l'expédition — mais jamais au milieu d'une partie en cours.
fetchLibrary().then((lib) => {
  if (!lib || lib.length === 0) return
  libraryLevels = lib.map((s) => s.level)
  updateLibraryButton()
  renderRegistres()
  renderSalles()
  if (!hasPlayed) {
    levelIndex = 0
    restart()
  }
})

// Sonde de débogage/test : le tableau en cours d'édition
;(window as unknown as { __editorLevel: () => LevelDef }).__editorLevel = () =>
  editor.currentLevel()
// L'éditeur possède son document : on le rouvre tel qu'on l'a laissé, sans
// écraser le travail en cours par le tableau qu'on vient d'essayer.
function openEditor(): void {
  overlay.classList.remove('visible')
  document.body.classList.remove('playing')
  // l'éditeur a la main : le jeu se met en PAUSE derrière lui — la physique
  // ne tourne plus dans son dos (« Essayer » relance, quitter rend la fiche)
  input.paused = true
  editor.open()
}
document
  .getElementById('start-editor')!
  .addEventListener('click', () => openEditor())
// ---- Le panneau COMMANDES : trois onglets (PC, manette, tactile) ----
// Les commandes ont quitté la fiche : un bouton, un panneau, trois écrans.
const cmdsEl = document.getElementById('cmds') as HTMLDivElement
function ongletCmds(nom: string): void {
  for (const b of Array.from(
    cmdsEl.querySelectorAll<HTMLButtonElement>('[data-onglet]'),
  )) {
    b.classList.toggle('on', b.dataset.onglet === nom)
  }
  for (const p of Array.from(
    cmdsEl.querySelectorAll<HTMLElement>('[data-page]'),
  )) {
    p.hidden = p.dataset.page !== nom
  }
}
document.getElementById('home-cmds')?.addEventListener('click', () => {
  // l'onglet d'accueil suit la façon de jouer : tactile au doigt, sinon PC
  ongletCmds(window.matchMedia('(pointer: coarse)').matches ? 'tactile' : 'pc')
  cmdsEl.hidden = false
})
for (const b of Array.from(
  cmdsEl.querySelectorAll<HTMLButtonElement>('[data-onglet]'),
)) {
  b.addEventListener('click', () => ongletCmds(b.dataset.onglet!))
}
document.getElementById('cmds-fermer')?.addEventListener('click', () => {
  cmdsEl.hidden = true
})
cmdsEl.addEventListener('pointerdown', (e) => {
  if (e.target === cmdsEl) cmdsEl.hidden = true // toucher le voile referme
})

// ---- Plein écran : PC comme mobile — masqué là où l'API manque (iOS) ----
const pleinBtn = document.getElementById(
  'home-plein',
) as HTMLButtonElement | null
if (pleinBtn) {
  if (!document.documentElement.requestFullscreen) {
    pleinBtn.hidden = true
  } else {
    pleinBtn.addEventListener('click', () => {
      if (document.fullscreenElement) void document.exitFullscreen()
      else void document.documentElement.requestFullscreen().catch(() => {})
    })
    document.addEventListener('fullscreenchange', () => {
      pleinBtn.innerHTML = document.fullscreenElement
        ? '<i>⛶</i><span>QUITTER</span>'
        : '<i>⛶</i><span>PLEIN ÉCRAN</span>'
    })
  }
}
window.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
  if (e.key === 'Escape') {
    if (lecteurCine.actif) return // le lecteur gère lui-même son Échap (sauter)
    if (!recsEl.hidden)
      fermerRecs() // les voiles d'abord
    else if (!cmdsEl.hidden) cmdsEl.hidden = true
    else if (!sallesEl.hidden) sallesEl.hidden = true
    else if (imagerie.visible) imagerie.close()
    else if (el('montage').classList.contains('visible')) montage.close()
    else if (document.body.classList.contains('playing')) openHome()
    else closeHome()
  } else if (e.key === 'l' || e.key === 'L') {
    toggleLegend()
  } else if (e.key === 'e' || e.key === 'E') {
    toggleStates()
  }
})

let sim = createSim(level)
// Sonde de débogage : accès à la simulation depuis la console du navigateur
const exposeSim = (): void => {
  ;(window as unknown as { __sim: FluidSim }).__sim = sim
}
exposeSim()
const camera = new Camera()
;(window as unknown as { __cam: Camera }).__cam = camera
;(window as unknown as { __params: SimParams }).__params = params
;(window as unknown as { __audio: AudioFx }).__audio = audio
// Sonde de test : injecter des zones dans le tableau courant sans l'éditeur
;(
  window as unknown as { __zones: (z: NonNullable<LevelDef['zones']>) => void }
).__zones = (z) => {
  level.zones = z
  buildWorldLabels()
}
// Sonde de test : régler la lumière générale du tableau courant en direct
;(window as unknown as { __ambiante: (v: number) => void }).__ambiante = (
  v,
) => {
  level.ambiante = Math.max(0, Math.min(1, v))
}

camera.snapTo(sim.stats.centroidX, sim.stats.centroidY, 1)

// Chargement des noyaux WASM, en arrière-plan : le jeu démarre sur le
// moteur JS et bascule dès que le module est prêt (sauf choix contraire au
// voile PARAMÈTRES). Échec de chargement = on reste en JS, sans bruit.
fetch('/noyaux.wasm')
  .then((r) =>
    r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status))),
  )
  .then((buf) => NoyauxWasm.charge(buf))
  .then((n) => {
    noyauxWasm = n
    appliqueMoteur(sim)
    majMoteurUI()
  })
  .catch(() => {
    noyauxWasm = null
    majMoteurUI()
  })

const renderer = new Renderer(canvas, CAPACITY)
const loop = new FixedLoop()
const input = new Input()
// Ouverture directe par ?editeur — APRÈS la naissance d'input : openEditor
// met le jeu en pause via input, l'appeler plus haut plantait tout le
// module au premier lancement (TDZ) et laissait une page à moitié câblée.
if (new URLSearchParams(location.search).has('editeur')) {
  hasPlayed = true
  openEditor()
}
// CRYOSTASE : tant que l'éveil n'a pas été joué, l'échantillon attend GELÉ
// dès le premier pixel — même en dérive derrière la fiche. Le premier
// contact visuel avec le sujet 21, c'est un bloc de glace.
if (!localStorage.getItem(CLE_EVEIL)) input.freezeIntent = true

// ---- Manette (Steam Deck, Xbox, DualSense) ----
// Elle pilote le même pointeur que le doigt : un curseur en orbite autour du
// corps, la gâchette pour agir. Le tactile garde toujours la priorité.
const manette = new Manette()
const manetteCurseur = { x: 0, y: 0 }
let manetteTenait = false // le « doigt » manette était posé à l'image d'avant

function boutonVisible(el: HTMLElement | null): el is HTMLElement {
  if (!el || (el as HTMLButtonElement).hidden) return false
  const r = el.getBoundingClientRect()
  const st = getComputedStyle(el)
  return (
    r.width > 0 &&
    r.height > 0 &&
    st.visibility !== 'hidden' &&
    st.pointerEvents !== 'none'
  )
}

/** A dans les écrans de JEU (relance, fin de tableau) : valide le bouton. */
function clicMenuManette(): boolean {
  for (const id of ['continuer', 'relance', 'overlay-btn']) {
    const el = document.getElementById(id)
    if (boutonVisible(el)) {
      el.click()
      return true
    }
  }
  return false
}

// ---- LA NAVIGATION MANETTE DES MENUS : générique, le même geste partout --
// Fini la liste de boutons codée en dur : l'écran ACTIF est le premier
// visible de la pile ci-dessous, et ses éléments actionnables (boutons,
// sélecteurs, cases) se parcourent à la croix ou au stick dans l'ORDRE
// VISUEL — la navigation est en 2D : on va au plus proche dans la
// direction pressée. A active, B REVIENT (chaque écran déclare sa porte
// de sortie), gauche/droite ajustent un sélecteur, et le focus — liseré
// bleu — reste toujours en vue (défilement suiveur).
interface CoucheMenu {
  id: string
  /** ce que B déclenche : l'id du bouton de fermeture de l'écran */
  retour?: string
  /** couche LÉGÈRE (légende, états, panneau d'instruments, ouverts en
   * pleine partie) : seul B est capté — le jeu garde tous ses boutons */
  legere?: boolean
  /** condition d'activation supplémentaire (défaut : le conteneur est visible) */
  actif?: () => boolean
}
const COUCHES_MENU: CoucheMenu[] = [
  { id: 'mb-veil' }, // la cérémonie : pas de porte de sortie — on choisit
  { id: 'codex', retour: 'codex-fermer' },
  { id: 'cmds', retour: 'cmds-fermer' },
  { id: 'planche', retour: 'planche-fermer' },
  { id: 'salles', retour: 'salles-fermer' },
  { id: 'records', retour: 'records-fermer' },
  { id: 'livraisons', retour: 'livraisons-fermer' },
  { id: 'params', retour: 'params-fermer' },
  { id: 'legend', retour: 'legend-close', legere: true },
  { id: 'states', retour: 'states-close', legere: true },
  { id: 'instr-panel', retour: 'hud-instr-chip', legere: true },
  {
    id: 'home',
    retour: 'start', // B depuis la fiche : reprendre l'essai (s'il y en a un)
    actif: () => !document.body.classList.contains('playing'),
  },
]

function elementVisible(el: HTMLElement | null): el is HTMLElement {
  if (!el || el.hidden) return false
  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return false
  const st = getComputedStyle(el)
  return st.visibility !== 'hidden' && st.display !== 'none'
}

/** L'écran actuellement au-dessus, s'il y en a un. */
function coucheMenuActive(): CoucheMenu | null {
  for (const c of COUCHES_MENU) {
    const el = document.getElementById(c.id)
    if (!elementVisible(el)) continue
    if (c.actif && !c.actif()) continue
    return c
  }
  return null
}

/** Les éléments actionnables de l'écran, visibles et vivants. */
function actionnables(couche: HTMLElement): HTMLElement[] {
  const els = couche.querySelectorAll<HTMLElement>(
    'button, select, input[type="checkbox"], input[type="range"], [role="button"]',
  )
  return [...els].filter(
    (el) =>
      elementVisible(el) &&
      !(el as HTMLButtonElement).disabled &&
      getComputedStyle(el).pointerEvents !== 'none',
  )
}

// le focus par écran : l'élément visé survit à l'aller-retour d'un
// sous-menu ; s'il disparaît (liste reconstruite), on reprend au début
const focusParCouche = new Map<string, HTMLElement>()
let padNavPret = true // anti-répétition du stick
let padNavDepuis = 0 // début du maintien, pour la répétition auto

/** Un pas de navigation 2D : le plus proche dans la direction pressée. */
function plusProcheVers(
  depuis: HTMLElement,
  parmi: HTMLElement[],
  dx: number,
  dy: number,
): HTMLElement | null {
  const a = depuis.getBoundingClientRect()
  const ax = (a.left + a.right) / 2
  const ay = (a.top + a.bottom) / 2
  let mieux: HTMLElement | null = null
  let mieuxScore = Infinity
  for (const el of parmi) {
    if (el === depuis) continue
    const b = el.getBoundingClientRect()
    const bx = (b.left + b.right) / 2
    const by = (b.top + b.bottom) / 2
    const le = (bx - ax) * dx + (by - ay) * dy // l'avancée dans la direction
    if (le < 4) continue
    const travers = Math.abs((bx - ax) * dy) + Math.abs((by - ay) * dx)
    const score = le + travers * 2.2
    if (score < mieuxScore) {
      mieuxScore = score
      mieux = el
    }
  }
  return mieux
}

// ---- Le DÉFILEMENT au stick droit : le geste « pavé » du Steam Deck ----
// Dans n'importe quel écran de menu, le stick droit (ou le pavé configuré
// en joystick) fait défiler — comme la molette en mode bureau. On défile
// le conteneur du focus s'il en a un, sinon le plus grand défilable de
// l'écran (mémorisé tant qu'il reste valable).
const defilables = new Map<string, HTMLElement>()

function conteneurDefilant(
  couche: HTMLElement,
  depuis: HTMLElement | null,
): HTMLElement | null {
  const defile = (el: HTMLElement): boolean => {
    if (
      el.scrollHeight <= el.clientHeight + 4 &&
      el.scrollWidth <= el.clientWidth + 4
    )
      return false
    const st = getComputedStyle(el)
    return /(auto|scroll)/.test(st.overflowY + st.overflowX)
  }
  let el: HTMLElement | null = depuis
  while (el && el !== couche.parentElement) {
    if (defile(el)) return el
    el = el.parentElement
  }
  const connu = defilables.get(couche.id)
  if (connu && couche.contains(connu) && defile(connu)) return connu
  if (defile(couche)) {
    defilables.set(couche.id, couche)
    return couche
  }
  let mieux: HTMLElement | null = null
  let aire = 0
  for (const cand of couche.querySelectorAll<HTMLElement>(
    'div, section, aside',
  )) {
    if (!defile(cand)) continue
    const r = cand.getBoundingClientRect()
    if (r.width * r.height > aire) {
      aire = r.width * r.height
      mieux = cand
    }
  }
  if (mieux) defilables.set(couche.id, mieux)
  return mieux
}

function defileCouche(couche: CoucheMenu, dt: number): void {
  if (Math.abs(manette.panX) < 0.02 && Math.abs(manette.panY) < 0.02) return
  const host = document.getElementById(couche.id)
  if (!host) return
  const vise = focusParCouche.get(couche.id) ?? null
  const sc = conteneurDefilant(host, vise && host.contains(vise) ? vise : null)
  if (!sc) return
  sc.scrollTop += manette.panY * 1100 * dt
  sc.scrollLeft += manette.panX * 1100 * dt
}

/** La navigation d'un écran de menu, une image. */
function navigueMenu(couche: CoucheMenu, dt: number): void {
  const host = document.getElementById(couche.id)!
  // le stick droit défile — dans tous les écrans, légers compris
  defileCouche(couche, dt)
  // B : la porte de sortie de l'écran
  if (manette.edge(BOUTON.B) && couche.retour) {
    const porte = document.getElementById(couche.retour)
    if (boutonVisible(porte)) {
      porte.click()
      return
    }
  }
  if (couche.legere) return // légende & co : B seulement, le jeu garde la main
  // ☰ (Start) depuis la fiche : reprendre l'essai directement
  if (couche.id === 'home' && manette.edge(BOUTON.START)) {
    document.getElementById('start')?.click()
    return
  }
  // le codex garde ses fermetures historiques (START et SELECT)
  if (
    couche.id === 'codex' &&
    (manette.edge(BOUTON.START) || manette.edge(BOUTON.SELECT))
  ) {
    document.getElementById('codex-fermer')?.click()
    return
  }
  const els = actionnables(host)
  // la cérémonie en phase contemplative (bilan) : aucun bouton — A avance
  if (els.length === 0) {
    if (manette.edge(BOUTON.A))
      host.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    return
  }
  let vise = focusParCouche.get(couche.id) ?? null
  if (!vise || !els.includes(vise)) vise = els[0]
  // la direction pressée : croix, ou stick avec un cran anti-répétition
  // (puis répétition douce au maintien — les longues listes se parcourent)
  let dx = 0
  let dy = 0
  if (manette.edge(BOUTON.HAUT)) dy = -1
  else if (manette.edge(BOUTON.BAS)) dy = 1
  else if (manette.edge(BOUTON.GAUCHE)) dx = -1
  else if (manette.edge(BOUTON.DROITE)) dx = 1
  else if (manette.force > 0.55) {
    const now = performance.now() / 1000
    if (padNavPret || now - padNavDepuis > 0.34) {
      if (Math.abs(manette.dirY) > Math.abs(manette.dirX))
        dy = manette.dirY > 0 ? 1 : -1
      else dx = manette.dirX > 0 ? 1 : -1
      if (padNavPret) padNavDepuis = now
      else padNavDepuis = now - 0.22 // la répétition suivante vient plus vite
      padNavPret = false
    }
  }
  if (manette.force < 0.3) padNavPret = true
  // un SÉLECTEUR visé : gauche/droite changent sa valeur, pas le focus
  if (dx !== 0 && vise instanceof HTMLSelectElement) {
    const n = vise.options.length
    if (n > 0) {
      vise.selectedIndex = Math.max(0, Math.min(n - 1, vise.selectedIndex + dx))
      vise.dispatchEvent(new Event('change', { bubbles: true }))
    }
    dx = 0
  }
  if (dx !== 0 || dy !== 0) {
    const prochain = plusProcheVers(vise, els, dx, dy)
    if (prochain) vise = prochain
  }
  focusParCouche.set(couche.id, vise)
  // le liseré s'affiche si la MANETTE a la main (a parlé plus récemment
  // que le pointeur) — pas de fenêtre de temps : sur un menu au rendu
  // plafonné, une horloge expirerait entre deux images. UN SEUL liseré à
  // l'écran : celui de la couche active — l'écran de dessous rend le sien
  // (il le retrouvera par la mémoire de focus en revenant).
  const padALaMain = manette.lastActivity > input.lastPointerAt
  for (const el of document.querySelectorAll<HTMLElement>('.pad-focus'))
    if (el !== vise) el.classList.remove('pad-focus')
  vise.classList.toggle('pad-focus', padALaMain)
  if (dx !== 0 || dy !== 0)
    vise.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  if (manette.edge(BOUTON.A)) vise.click()
}
// sonde du banc d'essai : l'état de la navigation manette, lisible du dehors
let manettePolls = 0
let manettePollNow = 0
;(window as unknown as { __menu: unknown }).__menu = {
  couche: () => coucheMenuActive()?.id ?? null,
  pad: () => ({
    connectee: manette.connectee,
    active: manette.active,
    polls: manettePolls,
    now: manettePollNow,
    vie: manette.lastActivity,
  }),
  actionnables: (id: string) => {
    const el = document.getElementById(id)
    return el ? actionnables(el).length : -1
  },
}
input.attach(canvas)

const monitor: BenchMonitor = {
  fps: 0,
  particles: 0,
  volume: 0,
  speed: 0,
  quality: 0,
  physMs: 0,
  renderMs: 0,
  overview: false,
}

// Vortex de regroupement : déclenché au clic droit, actif vortexDuration s
const vortex = { x: 0, y: 0, timer: 0 }

// Le pointeur est-il posé SUR le corps ? (à un rayon de noyau et des
// poussières près : la surface visible dépasse un peu les centres de
// particules). Sert à retourner l'impulsion : sur soi, on se rassemble.
function corpsSousLePointeur(x: number, y: number): boolean {
  const r = params.kernelRadius * 1.6
  const r2 = r * r
  for (let i = 0; i < sim.count; i++) {
    if (sim.kind[i] !== KIND_PLAYER || sim.gaseous[i] === 1) continue
    const dx = sim.posX[i] - x
    const dy = sim.posY[i] - y
    if (dx * dx + dy * dy < r2) return true
  }
  return false
}

// Ondes d'éjection (rendu seulement) : une onde traverse le corps à chaque
// salve d'éjection, depuis le point de sortie de la matière
const MAX_WAVES = 8
const WAVE_EVERY = 0.16 // s d'éjection continue entre deux ondes
const waves: { x: number; y: number; t: number }[] = []
const waveScratch = new Float32Array(MAX_WAVES * 4)
let waveCarry = WAVE_EVERY // première salve : onde immédiate

// Fin de course (refonte 2026) : il n'y a plus de minimum à ramener, ni de
// mort. Sous le seuil, le corps a droit à UNE dernière impulsion ; elle
// relâchée, il se fige en glace avec l'élan qu'il lui reste et dérive — rien
// ne le freine. Un rebond peut encore le mener au sas ; sinon le joueur
// relance quand il le décide, avec un bouton qui ne masque pas la dérive.
const endgame = {
  lastCall: false, // la prochaine impulsion est la dernière
  spent: false, // elle a été donnée : le corps se fige et dérive
  wasAiming: false, // front de relâchement du pointeur
  sasVu: 0, // particules avalées déjà constatées (détection « le sas boit »)
  sasBoitJusqua: -1, // temps simulé jusqu'auquel la fin de course se tait
  enCollecte: false, // le sas boit en ce moment : alarmes et seuils se taisent
}
// Dash de vapeur : viser fige le temps, relâcher lance le nuage (« air
// dash »). On ne retient qu'une chose entre deux images : était-on en visée.
const dash = { aiming: false }
// Front montant de l'intention vapeur : la TRANSFORMATION (péage + dashs)
// se paie au basculement, quelle qu'en soit la cause.
let gasIntentAvant = false

// ---- Mécanismes laser (palier 1) ----
// Le faisceau se trace une fois par IMAGE (pas par pas physique) : la glace
// bouge à l'échelle de l'image, pas du sous-pas. Une cible reste « allumée »
// un court instant après le dernier photon (persistance) : la porte ne
// clignote pas quand le miroir tremble.
const fxCanvas = document.getElementById('fx-canvas') as HTMLCanvasElement
const fxCtx = fxCanvas.getContext('2d')!
const laserEtat = {
  vues: [] as TraceResultat[],
  // La mémoire des récepteurs (TOR : verrou ouvrant · NOR : maintien, la
  // première coupure scelle) — machine à états pure, voir laser.ts
  recepteurs: creerEtatRecepteurs(0),
  portesOuvertes: [] as boolean[],
  doorsKey: '', // signature des portes fermées envoyées au solveur
  // LE SURSAUT DE VICTOIRE : à l'allumage d'une pastille, la trajectoire
  // du rayon vainqueur est GELÉE un court instant et rejouée en flash —
  // même si la physique l'a déjà emporté ailleurs. Un balayage éclair sur
  // la cible ne passe plus inaperçu.
  impacts: [] as {
    t0: number
    cible: number
    points: { x: number; y: number; eau?: boolean; plasma?: boolean }[]
  }[],
  litPrec: [] as boolean[],
}
// Sonde de test : l'état des portes/récepteurs depuis la console (comme __sim)
;(window as unknown as { __laserEtat: typeof laserEtat }).__laserEtat =
  laserEtat
// La superposition des mécanismes : faisceaux, émetteurs, cibles, portes —
// dessinée en 2D par-dessus la cuve, avec la même caméra que le rendu WebGL.
function drawMecanismes(vw: number, vh: number, dpr: number): void {
  const lasers = level.lasers ?? []
  const cibles = level.cibles ?? []
  const portes = level.portes ?? []
  const rails = level.rails ?? []
  const caches = level.caches ?? []
  const actif =
    lasers.length +
      cibles.length +
      portes.length +
      rails.length +
      caches.length >
    0
  const dprC = Math.min(dpr, 2)
  if (
    fxCanvas.width !== Math.round(vw * dprC) ||
    fxCanvas.height !== Math.round(vh * dprC)
  ) {
    fxCanvas.width = Math.round(vw * dprC)
    fxCanvas.height = Math.round(vh * dprC)
  }
  const g = fxCtx
  g.setTransform(dprC, 0, 0, dprC, 0, 0)
  g.clearRect(0, 0, vw, vh)
  if (!actif || !document.body.classList.contains('playing')) return
  const S = (x: number, y: number): { sx: number; sy: number } => ({
    sx: vw * 0.5 + (x - camera.x) * camera.zoom,
    sy: vh * 0.5 - (y - camera.y) * camera.zoom,
  })
  const z = camera.zoom

  // portes : barrières d'énergie — pleines quand closes, un cadre quand ouvertes
  for (let i = 0; i < portes.length; i++) {
    const p = portes[i]
    // sous un voile de cachette : la porte se tait (elle flotterait
    // au-dessus d'une paroi factice et vendrait le secret)
    if (dansCacheVoilee((p.minX + p.maxX) / 2, (p.minY + p.maxY) / 2)) continue
    const a = S(p.minX, p.maxY)
    const b = S(p.maxX, p.minY)
    const ouverte = laserEtat.portesOuvertes[i]
    if (ouverte) {
      g.strokeStyle = 'rgba(90,220,170,0.45)'
      g.setLineDash([5, 7])
      g.lineWidth = 1.5
      g.strokeRect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy)
      g.setLineDash([])
    } else {
      const puls = 0.75 + 0.25 * Math.sin(elapsed * 3.1 + i)
      g.fillStyle = `rgba(255,72,72,${(0.16 * puls).toFixed(3)})`
      g.fillRect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy)
      g.strokeStyle = `rgba(255,96,96,${(0.85 * puls).toFixed(3)})`
      g.lineWidth = 2
      g.strokeRect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy)
      // barreaux d'énergie
      g.strokeStyle = `rgba(255,110,110,${(0.35 * puls).toFixed(3)})`
      g.lineWidth = 1
      g.beginPath()
      const pas = Math.max(10, 16 * z)
      if (b.sx - a.sx > b.sy - a.sy) {
        for (let x = a.sx + pas; x < b.sx; x += pas) {
          g.moveTo(x, a.sy)
          g.lineTo(x, b.sy)
        }
      } else {
        for (let y = a.sy + pas; y < b.sy; y += pas) {
          g.moveTo(a.sx, y)
          g.lineTo(b.sx, y)
        }
      }
      g.stroke()
    }
  }

  // rails magnétiques : des lignes de champ posées dans le décor — bande de
  // capture translucide (l'arc s'accroche N'IMPORTE OÙ le long), pointillé
  // violet, et des CHEVRONS qui donnent le sens de circulation de l'arc.
  // Le faisceau ordinaire les ignore ; seul le plasma s'y accroche.
  rails.forEach((rail, railIdx) => {
    const pts = rail.points
    if (pts.length < 2) return
    // un rail entièrement sous voile se tait ; un rail qui en sort reste
    // dessiné (le voile brume le couvre, et couper une polyligne la fausse)
    if (pts.every((p) => dansCacheVoilee(p.x, p.y))) return
    const engage = railsEngages.has(railIdx)
    const chemin = (): void => {
      g.beginPath()
      const p0 = S(pts[0].x, pts[0].y)
      g.moveTo(p0.sx, p0.sy)
      for (let k = 1; k < pts.length; k++) {
        const pk = S(pts[k].x, pts[k].y)
        g.lineTo(pk.sx, pk.sy)
      }
    }
    // la bande de capture : la portée du champ, tout du long
    g.strokeStyle = 'rgba(150,120,255,0.07)'
    g.lineWidth = Math.max(2, params.plasmaRailRadius * 2 * z)
    g.lineJoin = 'round'
    g.lineCap = 'round'
    chemin()
    g.stroke()
    // la ligne elle-même — et quand le champ est ENGAGÉ (il porte un nuage,
    // même rayon éteint), le rail s'embrase : halo + tirets qui défilent
    // dans le sens du convoyage. Il s'éteint quand l'attirance se relâche.
    if (engage) {
      g.strokeStyle = 'rgba(190,160,255,0.30)'
      g.lineWidth = Math.max(3, 10 * z)
      chemin()
      g.stroke()
    }
    g.strokeStyle = engage ? 'rgba(215,190,255,0.95)' : 'rgba(150,120,255,0.45)'
    g.lineWidth = Math.max(1, (engage ? 3 : 2) * z)
    g.setLineDash([2 * z, 9 * z])
    if (engage) g.lineDashOffset = -((performance.now() * 0.05) % 11) * z
    chemin()
    g.stroke()
    g.setLineDash([])
    g.lineDashOffset = 0
    // chevrons de sens, à intervalle régulier le long de chaque tronçon
    g.strokeStyle = 'rgba(190,160,255,0.7)'
    g.lineWidth = Math.max(1, 1.6 * z)
    const taille = Math.max(3, 7 * z)
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k]
      const b = pts[k + 1]
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      if (len < 1) continue
      const ux = (b.x - a.x) / len
      const uy = (b.y - a.y) / len
      const n = Math.max(1, Math.floor(len / 70))
      for (let m = 1; m <= n; m++) {
        const t = m / (n + 1)
        const p = S(a.x + ux * len * t, a.y + uy * len * t)
        // direction en coordonnées écran (y inversé)
        const ex = ux
        const ey = -uy
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
  })

  // MINI-ARCS ÉLECTRIQUES (mode foudroyant) : un éclair en zigzag qui
  // serpente le long d'un segment — ancré aux deux bouts, offsets
  // perpendiculaires pseudo-aléatoires re-tirés plusieurs fois par
  // seconde (le crépitement), amplitude en ventre au milieu du chemin.
  // Partagé entre le rayon vivant et le sursaut de victoire.
  const bruitArc = (graine: number, i: number): number => {
    const v = Math.sin(graine * 127.1 + i * 311.7) * 43758.5453
    return (v - Math.floor(v)) * 2 - 1
  }
  const traceArcFx = (
    a: { sx: number; sy: number },
    b: { sx: number; sy: number },
    graine: number,
    amp: number,
    coul: string,
    larg: number,
  ): void => {
    const dx = b.sx - a.sx
    const dy = b.sy - a.sy
    const L = Math.hypot(dx, dy)
    if (L < 14) return
    const n = Math.min(26, Math.max(4, Math.round(L / (22 * Math.max(0.4, z)))))
    const px = -dy / L
    const py = dx / L
    g.strokeStyle = coul
    g.lineWidth = larg
    g.lineJoin = 'round'
    g.beginPath()
    g.moveTo(a.sx, a.sy)
    for (let i = 1; i < n; i++) {
      const tI = i / n
      const ventre = Math.sin(Math.PI * tI)
      const off = bruitArc(graine, i) * amp * ventre
      g.lineTo(a.sx + dx * tI + px * off, a.sy + dy * tI + py * off)
    }
    g.lineTo(b.sx, b.sy)
    g.stroke()
  }

  // faisceaux : halo large + cœur fin, en fusion additive
  g.globalCompositeOperation = 'lighter'
  for (const t of laserEtat.vues) {
    if (t.points.length < 2) continue
    const chemins = t.points.map((pt) => S(pt.x, pt.y))
    const scint = 0.85 + 0.15 * Math.sin(elapsed * 21)
    // dans l'air : trait rouge net. Sous l'eau : le halo s'élargit et
    // rosit — la lumière diffuse dans le corps qu'elle traverse. Ionisé
    // (vapeur, rail) : un ARC blanc-violet, éblouissant.
    const AIR: [number, string][] = [
      [10 * z, `rgba(255,60,50,${(0.1 * scint).toFixed(3)})`],
      [4.5 * z, `rgba(255,90,70,${(0.3 * scint).toFixed(3)})`],
      [1.8 * z, `rgba(255,220,200,${(0.95 * scint).toFixed(3)})`],
    ]
    const EAU: [number, string][] = [
      [15 * z, `rgba(255,70,110,${(0.13 * scint).toFixed(3)})`],
      [6.5 * z, `rgba(255,120,150,${(0.32 * scint).toFixed(3)})`],
      [1.8 * z, `rgba(255,235,225,${(0.88 * scint).toFixed(3)})`],
    ]
    const scintP = 0.7 + 0.3 * Math.sin(elapsed * 37) // l'arc crépite plus vite
    const PLASMA: [number, string][] = [
      [18 * z, `rgba(150,90,255,${(0.16 * scintP).toFixed(3)})`],
      [7.5 * z, `rgba(190,150,255,${(0.42 * scintP).toFixed(3)})`],
      [2.4 * z, `rgba(250,245,255,${(0.98 * scintP).toFixed(3)})`],
    ]
    const palettes = [AIR, EAU, PLASMA]
    const modeDe = (pt: (typeof t.points)[number]): number =>
      pt.plasma === true ? 2 : pt.eau === true ? 1 : 0
    // tronçons homogènes (air / eau / plasma) tracés d'un trait chacun
    // Mode SOMPTUEUX : un FLUX de paquets lumineux remonte chaque tronçon
    // (tirets animés le long du chemin) — l'énergie VOYAGE au lieu de
    // poser un simple trait. Le classique garde ses trois passes, au
    // pixel près.
    const FLUX: string[] = [
      'rgba(255,240,230,0.55)',
      'rgba(255,245,240,0.5)',
      'rgba(255,255,255,0.6)',
    ]
    let k = 0
    while (k + 1 < chemins.length) {
      const mode = modeDe(t.points[k])
      let e = k + 1
      while (e + 1 < chemins.length && modeDe(t.points[e]) === mode) e++
      // en FOUDROYANT, l'aura respire : une seconde nappe encore plus
      // large dont l'intensité pulse lentement — le rayon irradie
      const pulseAura = 0.75 + 0.25 * Math.sin(elapsed * 3.1)
      const passes: [number, string][] =
        faisceauChoix >= 1
          ? [
              ...(faisceauChoix === 2
                ? ([
                    [
                      40 * z,
                      mode === 2
                        ? `rgba(150,90,255,${(0.05 * pulseAura).toFixed(3)})`
                        : `rgba(255,60,45,${(0.055 * pulseAura).toFixed(3)})`,
                    ],
                  ] as [number, string][])
                : []),
              // l'AMBIANCE : une nappe très large et très douce — le rayon
              // baigne la salle au lieu de la rayer
              [
                26 * z,
                mode === 2
                  ? `rgba(140,80,255,${(0.06 * scintP).toFixed(3)})`
                  : `rgba(255,50,40,${(0.07 * scint).toFixed(3)})`,
              ],
              ...palettes[mode].map(
                ([l, c]) =>
                  [l * (faisceauChoix === 2 ? 1.5 : 1.35), c] as [
                    number,
                    string,
                  ],
              ),
            ]
          : palettes[mode]
      for (const [larg, coul] of passes) {
        g.strokeStyle = coul
        g.lineWidth = Math.max(0.8, larg)
        g.lineJoin = 'round'
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(chemins[k].sx, chemins[k].sy)
        for (let m = k + 1; m <= e; m++) g.lineTo(chemins[m].sx, chemins[m].sy)
        g.stroke()
      }
      if (faisceauChoix >= 1) {
        const pas = 46 * z
        g.strokeStyle = FLUX[mode]
        g.lineWidth = Math.max(1.1, 3.2 * z)
        g.setLineDash([12 * z, pas - 12 * z])
        g.lineDashOffset = -((elapsed * 300 * z) % pas)
        g.beginPath()
        g.moveTo(chemins[k].sx, chemins[k].sy)
        for (let m = k + 1; m <= e; m++) g.lineTo(chemins[m].sx, chemins[m].sy)
        g.stroke()
        g.setLineDash([])
        g.lineDashOffset = 0
      }
      if (faisceauChoix === 2) {
        // deux éclairs par SEGMENT (un rayon plié garde ses coudes),
        // re-tirés ~24 fois par seconde : le CRÉPITEMENT
        const grainT = Math.floor(elapsed * 24)
        for (let m = k; m < e; m++) {
          traceArcFx(
            chemins[m],
            chemins[m + 1],
            grainT * 7.31 + m * 13.7,
            8 * z,
            mode === 2 ? 'rgba(210,180,255,0.6)' : 'rgba(150,215,255,0.55)',
            Math.max(0.8, 1.3 * z),
          )
          traceArcFx(
            chemins[m],
            chemins[m + 1],
            grainT * 11.73 + m * 5.1 + 99,
            4.5 * z,
            'rgba(255,255,255,0.4)',
            Math.max(0.7, 1.0 * z),
          )
        }
      }
      k = e
    }
    if (faisceauChoix >= 1) {
      // les EXTRÉMITÉS luisent : la bouche de l'émetteur, et le point
      // d'arrivée du rayon — l'absorption se VOIT, elle crépite doucement
      const bouts = [chemins[0], chemins[chemins.length - 1]]
      for (let b = 0; b < 2; b++) {
        const pt = bouts[b]
        const r =
          (b === 0 ? 10 : 16) * z * (0.85 + 0.15 * Math.sin(elapsed * 23 + b))
        const gr = g.createRadialGradient(
          pt.sx,
          pt.sy,
          0,
          pt.sx,
          pt.sy,
          Math.max(2, r),
        )
        gr.addColorStop(0, 'rgba(255,235,225,0.85)')
        gr.addColorStop(0.4, 'rgba(255,120,90,0.4)')
        gr.addColorStop(1, 'rgba(255,80,60,0)')
        g.fillStyle = gr
        g.beginPath()
        g.arc(pt.sx, pt.sy, Math.max(2, r), 0, Math.PI * 2)
        g.fill()
      }
    }
  }

  // LE SURSAUT DE VICTOIRE : les trajectoires gelées à l'allumage d'une
  // pastille rejouent en flash blanc-vert pendant ~un demi-souffle — le
  // rayon SURSAUTE, la cible irradie, des étincelles jaillissent. Même si
  // le rayon vivant est déjà parti ailleurs : la victoire reste lisible.
  if (faisceauChoix >= 1 && laserEtat.impacts.length > 0) {
    const nowFx = performance.now() / 1000
    // en FOUDROYANT, le sursaut dure un souffle de plus et frappe plus fort
    const DUR = faisceauChoix === 2 ? 0.7 : 0.55
    const boost = faisceauChoix === 2 ? 1.6 : 1
    laserEtat.impacts = laserEtat.impacts.filter((im) => nowFx - im.t0 < DUR)
    for (const im of laserEtat.impacts) {
      const age = nowFx - im.t0
      const kAge = age / DUR
      const flash = Math.exp(-age / 0.12) // le sursaut : violent puis calmé
      const alpha = 1 - kAge
      const chemins = im.points.map((pt) => S(pt.x, pt.y))
      const PASSES: [number, string][] = [
        [
          16 * z * (1 + 1.6 * flash * boost),
          `rgba(120,255,190,${(0.16 * alpha).toFixed(3)})`,
        ],
        [
          6 * z * (1 + 2.2 * flash * boost),
          `rgba(180,255,220,${(0.4 * alpha).toFixed(3)})`,
        ],
        [
          2.2 * z * (1 + 2.6 * flash * boost),
          `rgba(255,255,250,${(0.95 * alpha).toFixed(3)})`,
        ],
      ]
      for (const [larg, coul] of PASSES) {
        g.strokeStyle = coul
        g.lineWidth = Math.max(0.8, larg)
        g.lineJoin = 'round'
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(chemins[0].sx, chemins[0].sy)
        for (let m = 1; m < chemins.length; m++)
          g.lineTo(chemins[m].sx, chemins[m].sy)
        g.stroke()
      }
      if (faisceauChoix === 2) {
        // la FOUDRE de la victoire : des éclairs verts serpentent le long
        // de la trajectoire gelée tant que le flash vit
        const grainV = Math.floor(nowFx * 30)
        for (let m = 0; m + 1 < chemins.length; m++) {
          traceArcFx(
            chemins[m],
            chemins[m + 1],
            grainV * 9.17 + m * 3.3,
            12 * z * (0.4 + 0.6 * flash),
            `rgba(190,255,225,${(0.7 * alpha).toFixed(3)})`,
            Math.max(0.9, 1.5 * z),
          )
          traceArcFx(
            chemins[m],
            chemins[m + 1],
            grainV * 5.53 + m * 17.9 + 41,
            7 * z * (0.4 + 0.6 * flash),
            `rgba(255,255,255,${(0.5 * alpha).toFixed(3)})`,
            Math.max(0.8, 1.1 * z),
          )
        }
      }
      // la cible irradie : anneau qui s'évase depuis la pastille touchée
      const cib = cibles[im.cible]
      if (cib) {
        const pc = S(cib.x, cib.y)
        const rBase = Math.max(4, cib.r * z)
        g.strokeStyle = `rgba(150,255,200,${(0.8 * alpha).toFixed(3)})`
        g.lineWidth = Math.max(1, 3 * z * (1 - kAge * 0.6))
        g.beginPath()
        g.arc(pc.sx, pc.sy, rBase * (1 + (2.6 + boost) * kAge), 0, Math.PI * 2)
        g.stroke()
        if (faisceauChoix === 2 && kAge > 0.18) {
          // le second anneau part avec un temps de retard — l'onde double
          const k2 = (kAge - 0.18) / (1 - 0.18)
          g.strokeStyle = `rgba(210,255,235,${(0.55 * (1 - k2)).toFixed(3)})`
          g.lineWidth = Math.max(1, 2 * z * (1 - k2 * 0.5))
          g.beginPath()
          g.arc(pc.sx, pc.sy, rBase * (1 + 3.4 * k2), 0, Math.PI * 2)
          g.stroke()
        }
        // les étincelles : huit éclats déterministes qui fusent de l'impact
        const fin = chemins[chemins.length - 1]
        const nEtin = faisceauChoix === 2 ? 12 : 8
        for (let s2 = 0; s2 < nEtin; s2++) {
          const a2 = (s2 / nEtin) * Math.PI * 2 + im.t0 * 3.7
          const d0 = rBase * 0.5 + (10 + 34 * kAge) * z
          const d1 = d0 + (6 + 10 * flash) * z
          g.strokeStyle = `rgba(220,255,235,${(0.75 * alpha).toFixed(3)})`
          g.lineWidth = Math.max(0.8, 1.6 * z)
          g.beginPath()
          g.moveTo(fin.sx + Math.cos(a2) * d0, fin.sy + Math.sin(a2) * d0)
          g.lineTo(fin.sx + Math.cos(a2) * d1, fin.sy + Math.sin(a2) * d1)
          g.stroke()
        }
      }
    }
  }
  g.globalCompositeOperation = 'source-over'

  // émetteurs : un fût court orienté, une bouche lumineuse
  for (const em of lasers) {
    if (dansCacheVoilee(em.x, em.y)) continue
    const p = S(em.x, em.y)
    const a = (-em.angle * Math.PI) / 180 // écran : y vers le bas
    g.save()
    g.translate(p.sx, p.sy)
    g.rotate(a)
    const L = Math.max(8, 16 * z)
    g.fillStyle = '#2a3742'
    g.strokeStyle = '#5c7285'
    g.lineWidth = 1.5
    g.beginPath()
    g.roundRect(-L, -L * 0.45, L * 1.7, L * 0.9, L * 0.2)
    g.fill()
    g.stroke()
    g.fillStyle = '#ff6a5a'
    g.beginPath()
    g.arc(L * 0.7, 0, Math.max(2, L * 0.22), 0, Math.PI * 2)
    g.fill()
    g.restore()
  }

  // cibles : pastille éteinte / embrasée — et pour le NOR, l'anneau ambré
  // dit « à maintien », la pastille GRILLÉE dit que la coupure est passée
  const nowCibles = performance.now() / 1000
  for (let c = 0; c < cibles.length; c++) {
    const t = cibles[c]
    if (dansCacheVoilee(t.x, t.y)) continue
    const p = S(t.x, t.y)
    const nor = t.mode === 'nor'
    const scellee = nor && laserEtat.recepteurs.scellees[c] === true
    const lit = !scellee && cibleActive(t, laserEtat.recepteurs, c, nowCibles)
    const r = Math.max(4, t.r * z)
    g.beginPath()
    g.arc(p.sx, p.sy, r, 0, Math.PI * 2)
    g.fillStyle = scellee
      ? 'rgba(48,32,30,0.75)'
      : lit
        ? 'rgba(120,255,190,0.30)'
        : 'rgba(40,56,66,0.6)'
    g.fill()
    g.lineWidth = 2
    g.strokeStyle = scellee
      ? '#6b4a42'
      : lit
        ? '#6dffb8'
        : nor
          ? '#c99a4e'
          : '#5c7285'
    g.stroke()
    if (nor && !scellee) {
      // l'anneau pointillé ambré : ce récepteur veut le faisceau MAINTENU
      g.beginPath()
      g.setLineDash([3, 5])
      g.arc(p.sx, p.sy, r * 0.72, 0, Math.PI * 2)
      g.strokeStyle = lit ? '#ffd98a' : '#a67c3f'
      g.lineWidth = 1.5
      g.stroke()
      g.setLineDash([])
    }
    g.beginPath()
    g.arc(p.sx, p.sy, r * 0.45, 0, Math.PI * 2)
    g.fillStyle = scellee ? '#241b19' : lit ? '#a9ffd6' : '#33424e'
    g.fill()
    if (scellee) {
      // la fêlure : la pastille a brûlé, plus rien n'y passera
      g.beginPath()
      g.moveTo(p.sx - r * 0.5, p.sy + r * 0.42)
      g.lineTo(p.sx - r * 0.1, p.sy - r * 0.05)
      g.lineTo(p.sx + r * 0.18, p.sy + r * 0.2)
      g.lineTo(p.sx + r * 0.52, p.sy - r * 0.4)
      g.strokeStyle = '#8a5a50'
      g.lineWidth = 1.5
      g.stroke()
    }
  }

  // LES CACHETTES, EN DERNIER : le brouillard « non cartographié » couvre
  // TOUT — parois, fluide, mécanismes, décor. Le centre du corps qui entre
  // lève le voile en fondu ; il reste levé pour l'essai (Recommencer
  // re-voile, la découverte se rejoue). Des nappes de brume dérivent
  // lentement dans le voile pour qu'il se lise comme du brouillard, pas
  // comme un rectangle mort.
  if (cachesLevee.length !== caches.length) {
    cachesLevee = caches.map(() => Infinity)
  }
  for (let i = 0; i < caches.length; i++) {
    const c = caches[i]
    if (
      cachesLevee[i] === Infinity &&
      !sim.dispersed &&
      dansForme(c, sim.stats.centroidX, sim.stats.centroidY)
    ) {
      cachesLevee[i] = elapsed
      // la PAROI FACTICE sort du décor à l'instant de la révélation — la
      // dissolution 2D ci-dessous couvre la transition
      if (c.style === 'paroi') rebuildRenderBoxes()
    }
    const alpha =
      cachesLevee[i] === Infinity
        ? 1
        : Math.max(0, 1 - (elapsed - cachesLevee[i]) / 0.9)
    if (alpha <= 0) continue
    const a = S(c.minX, c.maxY)
    const b = S(c.maxX, c.minY)
    const w = b.sx - a.sx
    const h = b.sy - a.sy
    if (b.sx < 0 || a.sx > vw || b.sy < 0 || a.sy > vh) continue
    // le chemin ÉPOUSE la forme de la cachette (disque, capsule, coin,
    // arc, rotation…) — le rectangle n'est qu'un cas particulier
    const chemin = (): void => {
      const pts = formeOutline(c, 56)
      g.beginPath()
      for (let k = 0; k < pts.length; k++) {
        const sp = S(pts[k].x, pts[k].y)
        if (k === 0) g.moveTo(sp.sx, sp.sy)
        else g.lineTo(sp.sx, sp.sy)
      }
      g.closePath()
    }
    if (c.style === 'paroi') {
      // PAROI FACTICE : voilée, c'est le MOTEUR qui la rend (vraie paroi,
      // vraies ombres) — ici on ne dessine que sa DISSOLUTION une fois
      // révélée : la teinte de paroi s'évapore du contour exact
      if (cachesLevee[i] === Infinity) continue
      g.save()
      chemin()
      g.clip()
      g.globalAlpha = alpha * 0.92
      g.fillStyle = '#3a4450'
      g.fillRect(a.sx, a.sy, w, h)
      g.globalAlpha = alpha * 0.5
      g.fillStyle = '#232b36'
      g.fillRect(a.sx, a.sy, w, h * 0.5)
      g.restore()
      g.globalAlpha = 1
      continue
    }
    g.save()
    chemin()
    g.clip()
    g.globalAlpha = alpha
    g.fillStyle = '#0d1320'
    g.fillRect(a.sx, a.sy, w, h)
    for (let k = 0; k < 4; k++) {
      const ph = i * 7.3 + k * 2.1
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
    g.globalAlpha = alpha * 0.45
    g.strokeStyle = 'rgba(74,94,120,0.55)'
    g.lineWidth = 1
    chemin()
    g.stroke()
    g.globalAlpha = 1
  }
}

// Flèche de cap manette : elle apparaît dès qu'on touche le stick et montre
// où l'on veut ALLER — l'éjection, elle, part à l'opposé sans qu'on y pense.
// Tout est lissé (naissance, cap, longueur) : la flèche glisse, elle ne
// saute pas. En visée de dash, la ligne du dash prend le relais.
const fleche = { alpha: 0, ang: 0, len: 60 }
function drawFleche(dtReal: number, dpr: number): void {
  const enJeu = document.body.classList.contains('playing')
  const aMain =
    manette.connectee &&
    manette.lastActivity > input.lastPointerAt &&
    input.touchCount === 0
  const veut =
    flecheVisible &&
    aMain &&
    enJeu &&
    manette.force > 0.03 &&
    !dash.aiming &&
    !input.paused
  // naissance et extinction en douceur
  fleche.alpha += ((veut ? 1 : 0) - fleche.alpha) * Math.min(1, dtReal * 9)
  if (fleche.alpha < 0.02) return
  // cap : on tourne par le plus court chemin, sans à-coup
  const cible = Math.atan2(manette.dirY, manette.dirX)
  let d = cible - fleche.ang
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  fleche.ang += d * Math.min(1, dtReal * 14)
  const lenCible =
    (36 + 90 * manette.force) * Math.max(0.5, Math.min(1.6, camera.zoom))
  fleche.len += (lenCible - fleche.len) * Math.min(1, dtReal * 10)

  const dprC = Math.min(dpr, 2)
  const g = fxCtx
  g.setTransform(dprC, 0, 0, dprC, 0, 0)
  const bx =
    window.innerWidth * 0.5 + (sim.stats.centroidX - camera.x) * camera.zoom
  const by =
    window.innerHeight * 0.5 - (sim.stats.centroidY - camera.y) * camera.zoom
  const r0 = sim.stats.rmsRadius * camera.zoom + 12 // on part du bord du corps
  const L = fleche.len
  const puls = 1 + 0.04 * Math.sin(elapsed * 4.2)
  g.save()
  g.translate(bx, by)
  g.rotate(fleche.ang)
  g.scale(puls, puls)
  const bout = r0 + L
  const grad = g.createLinearGradient(r0, 0, bout, 0)
  grad.addColorStop(0, `rgba(140,210,255,0)`)
  grad.addColorStop(1, `rgba(215,240,255,${(0.9 * fleche.alpha).toFixed(3)})`)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  // halo doux, puis fût net
  g.strokeStyle = `rgba(120,190,240,${(0.16 * fleche.alpha).toFixed(3)})`
  g.lineWidth = 9
  g.beginPath()
  g.moveTo(r0, 0)
  g.lineTo(bout - 6, 0)
  g.stroke()
  g.strokeStyle = grad
  g.lineWidth = 3.2
  g.beginPath()
  g.moveTo(r0, 0)
  g.lineTo(bout - 6, 0)
  g.stroke()
  // la pointe : un chevron galbé
  g.strokeStyle = `rgba(230,246,255,${(0.92 * fleche.alpha).toFixed(3)})`
  g.lineWidth = 3.2
  g.beginPath()
  g.moveTo(bout - 13, -8)
  g.quadraticCurveTo(bout - 3, 0, bout - 13, 8)
  g.stroke()
  g.restore()
}

let lastRailTime = 0
// rails dont le champ est engagé : allumés par un arc, ils ne se relâchent
// qu'une fois leur bande vidée (le nuage porté jusqu'à l'arrivée)
const railsEngages = new Set<number>()
// LES CACHETTES : l'instant où le voile de chaque pan s'est levé
// (Infinity : encore voilé). Le corps qui entre lève le voile — et
// Recommencer re-voile tout : la découverte se rejoue à chaque essai.
let cachesLevee: number[] = []
/** Ce point est-il sous un voile encore fermé ? (masque étiquettes et
 * mécanismes — la cachette a la forme qu'on lui a donnée). */
function dansCacheVoilee(x: number, y: number): boolean {
  const caches = level.caches ?? []
  for (let i = 0; i < caches.length; i++) {
    if ((cachesLevee[i] ?? Infinity) === Infinity && dansForme(caches[i], x, y))
      return true
  }
  return false
}
// Le décor rendu : les parois du tableau, PLUS les PAROIS FACTICES des
// cachettes voilées (style « paroi ») — le moteur les rend comme de vraies
// parois, ombres portées comprises. À la révélation, la factice sort du
// décor (et la carte de lumière se recuit une fois, sans elle).
function rebuildRenderBoxes(): void {
  const factices: ObstacleBox[] = (level.caches ?? [])
    .filter(
      (c, i) =>
        c.style === 'paroi' && (cachesLevee[i] ?? Infinity) === Infinity,
    )
    .map(({ style: _style, ...reste }) => ({ ...reste, material: MAT_WALL }))
  renderBoxes = [
    ...level.boxes.slice(0, Math.max(1, MAX_BOXES - 1 - factices.length)),
    ...factices,
    { ...level.exit, material: MAT_EXIT },
  ]
}
// ---- LE PACK PRÉSENCE : le Sujet est vivant ----
// Trois signes de vie, purement visuels, calculés ici et rendus au shader :
// · le REGARD — un noyau interne glisse vers ce que le corps regarde (la
//   visée, un mécanisme proche, le sas) ;
// · la RESPIRATION — le contour pulse : lent au calme, court en alerte
//   (réserve à sec), suspendu pendant la visée ;
// · le FRISSON — un tremblement bref quand le froid saisit le corps.
const presence = {
  x: 0,
  y: 0,
  int: 0,
  amp: 0,
  vit: 1.7,
  frisson: 0,
  t0Frisson: -9,
  armeFrisson: true,
  ondule: 0, // 0..1 : l'ondulation du contour, quand on le laisse tranquille
}
;(window as unknown as { __presence: typeof presence }).__presence = presence

// ---- LES CURSEURS DE L'ŒIL : la présence se règle (banc → L'œil) ----
// Sept curseurs, mémorisés par appareil. Les DÉFAUTS ci-dessous sont
// l'étalonnage du concepteur (26/08) : un noyau plus lumineux dans une
// pénombre discrète, un œil un rien plus petit et plus plat, un regard
// plus vif qui erre peu — et un Sujet nettement plus occupé. La valeur
// 1 sur un curseur reste « le rendu du moteur, non dosé ».
const OEIL_DEFAUTS = {
  lueur: 1.6, // luminosité du noyau (0 : éteint · 2,5 : phare)
  ombre: 0.3, // profondeur de la pénombre (0 : aucune silhouette)
  taille: 0.9, // échelle de l'œil entier (noyau, ombre, dôme)
  relief: 0.85, // hauteur du dôme : courbure du miroir et modelé
  vivacite: 1.25, // vitesse de glissement du regard
  errance: 0.8, // le regard vagabonde quand rien ne l'appelle
  curiosite: 1.85, // fréquence des vignettes d'idle (toilette, tentacule…)
}
type OeilRegl = typeof OEIL_DEFAUTS
const CLE_OEIL = 'sujet21-oeil-v1'
const oeilRegl: OeilRegl = (() => {
  try {
    const d = JSON.parse(
      localStorage.getItem(CLE_OEIL) ?? 'null',
    ) as Partial<OeilRegl> | null
    const lit = (v: unknown, def: number): number =>
      typeof v === 'number' && Number.isFinite(v)
        ? Math.max(0, Math.min(3, v))
        : def
    return {
      lueur: lit(d?.lueur, OEIL_DEFAUTS.lueur),
      ombre: lit(d?.ombre, OEIL_DEFAUTS.ombre),
      taille: Math.max(0.4, lit(d?.taille, OEIL_DEFAUTS.taille)),
      relief: lit(d?.relief, OEIL_DEFAUTS.relief),
      vivacite: Math.max(0.2, lit(d?.vivacite, OEIL_DEFAUTS.vivacite)),
      errance: lit(d?.errance, OEIL_DEFAUTS.errance),
      curiosite: Math.max(0.25, lit(d?.curiosite, OEIL_DEFAUTS.curiosite)),
    }
  } catch {
    return { ...OEIL_DEFAUTS }
  }
})()
function sauveOeil(): void {
  try {
    localStorage.setItem(CLE_OEIL, JSON.stringify(oeilRegl))
  } catch {
    // stockage refusé : les curseurs ne tiendront que la session
  }
}
// Les curseurs vivent dans LE BANC (dossier « L'œil du Sujet ») : le banc
// flotte sur le jeu qui tourne — réglage à vue, image par image. Voir le
// branchement dans createBench (actions.oeil), plus bas.

// ---- L'IDLE : la vie quand on ne joue pas ----
// Sans geste pendant quelques secondes, le Sujet EXISTE tout seul — de
// petites vignettes, jamais utiles, jamais à sa place : il fait sa
// toilette (se resserre soigneusement), pense au sas (le regard y
// glisse), s'étire (une grande respiration lente), tapote la paroi la
// plus proche (deux petits coups, comme on éprouve un mur), ou étend un
// TENTACULE — un doigt de liquide qui va toucher la paroi, puis rentre.
// Le moindre geste du joueur remet tout à zéro.
const idle = {
  t: 0, // secondes sans geste
  prochaine: 6, // seuil (en secondes d'idle) de la prochaine vignette
  type: '' as '' | 'toilette' | 'sas' | 'etire' | 'tapote' | 'tentacule',
  t0: 0, // début de la vignette (elapsed)
  murX: 0,
  murY: 0,
  ancX: 0, // l'ancre du centroïde au départ de la vignette : rien à gagner
  ancY: 0,
}
;(window as unknown as { __idle: typeof idle }).__idle = idle
// L'ÉVEIL DU TABLEAU : pendant le zoom automatique d'entrée, le Sujet se
// RÉVEILLE — un petit scénario aléatoire à chaque salle : grande
// inspiration, regard qui balaie un coin de la pièce avant de glisser au
// sas, parfois un frisson, parfois une vignette physique (toilette,
// étirement). Jamais deux fois le même réveil : la salle paraît vivante
// dès le plan large.
const reveil = {
  actif: false,
  t0: 0,
  frissonT: -1, // instant du frisson de réveil dans l'intro (-1 : aucun)
  frissonFait: false,
  balayageX: 0, // le point que le regard visite avant le sas
  balayageY: 0,
  bascule: 1, // seconde où le regard quitte ce point pour le sas
}
;(window as unknown as { __reveil: typeof reveil }).__reveil = reveil
// Le STICK parle-t-il ? incliné, et la manette plus récente que le pointeur :
// le regard le suit, et l'idle sait que le joueur est là
function stickVise(): boolean {
  return (
    manette.connectee &&
    input.touchCount === 0 &&
    manette.lastActivity > input.lastPointerAt &&
    manette.force > 0.03
  )
}
function majIdle(dtReal: number): void {
  // une souris qui BOUGE compte comme un geste (fenêtre courte : posée,
  // elle laisse l'idle venir même si le regard la fixe encore)
  const geste =
    input.aimActive ||
    input.freezeIntent ||
    input.gasIntent ||
    stickVise() ||
    performance.now() / 1000 - input.sourisAt < 0.4
  const enVie =
    document.body.classList.contains('playing') &&
    !input.paused &&
    !sim.dispersed &&
    !run.ended &&
    !miseEnBonbonne &&
    !lecteurCine.actif
  if (geste || !enVie) {
    idle.t = 0
    idle.type = ''
    // la CURIOSITÉ (curseur) rapproche ou éloigne la prochaine vignette
    idle.prochaine = (6 + Math.random() * 3) / oeilRegl.curiosite
    return
  }
  idle.t += dtReal
  if (idle.type) {
    const age = elapsed - idle.t0
    const duree =
      idle.type === 'tentacule'
        ? 3.9
        : idle.type === 'sas'
          ? 2.6
          : idle.type === 'etire'
            ? 1.9
            : idle.type === 'tapote'
              ? 1.1
              : 1.0
    if (age > duree) {
      idle.type = ''
      idle.prochaine = idle.t + (4 + Math.random() * 5) / oeilRegl.curiosite
    }
  } else if (idle.t >= idle.prochaine) {
    // choisir la vignette — tapoter seulement si une paroi est à portée
    const cx = sim.stats.centroidX
    const cy = sim.stats.centroidY
    let murX = 0
    let murY = 0
    let best = Infinity
    for (const b of level.boxes) {
      const px = Math.max(b.minX, Math.min(cx, b.maxX))
      const py = Math.max(b.minY, Math.min(cy, b.maxY))
      const d = Math.hypot(px - cx, py - cy)
      if (d < best) {
        best = d
        murX = px
        murY = py
      }
    }
    const choix: Array<'toilette' | 'sas' | 'etire' | 'tapote' | 'tentacule'> =
      ['toilette', 'sas', 'etire']
    if (best < sim.stats.rmsRadius + 130) choix.push('tapote')
    // le TENTACULE porte plus loin que le toc-toc — et c'est la vignette
    // vedette : deux billets dans le chapeau
    if (best > 30 && best < sim.stats.rmsRadius + 300)
      choix.push('tentacule', 'tentacule')
    idle.type = choix[Math.floor(Math.random() * choix.length)]
    idle.t0 = elapsed
    idle.murX = murX
    idle.murY = murY
    idle.ancX = cx
    idle.ancY = cy
  }
  // les vignettes PHYSIQUES — infimes, sans aucun gain de déplacement
  if (idle.type === 'toilette') {
    // la toilette : le corps se resserre soigneusement sur lui-même
    const cx = sim.stats.centroidX
    const cy = sim.stats.centroidY
    const k = Math.min(1, 2.2 * dtReal)
    for (let i = 0; i < sim.count; i++) {
      if (
        sim.kind[i] !== KIND_PLAYER ||
        sim.frozen[i] === 1 ||
        sim.gaseous[i] === 1
      )
        continue
      const dx = cx - sim.posX[i]
      const dy = cy - sim.posY[i]
      const d = Math.hypot(dx, dy)
      if (d < 1e-3) continue
      const ux = dx / d
      const uy = dy / d
      const vTarget = Math.min(38, d * 1.1)
      const vRadial = sim.velX[i] * ux + sim.velY[i] * uy
      sim.velX[i] += (vTarget - vRadial) * ux * k * 0.5
      sim.velY[i] += (vTarget - vRadial) * uy * k * 0.5
    }
  } else if (idle.type === 'tapote') {
    // deux petits coups vers la paroi, puis plus rien — un toc-toc
    const age = elapsed - idle.t0
    const coup = age < 0.14 || (age > 0.45 && age < 0.59)
    if (coup) {
      const cx = sim.stats.centroidX
      const cy = sim.stats.centroidY
      const d = Math.hypot(idle.murX - cx, idle.murY - cy) || 1
      const ax = ((idle.murX - cx) / d) * 240 * dtReal
      const ay = ((idle.murY - cy) / d) * 240 * dtReal
      for (let i = 0; i < sim.count; i++) {
        if (
          sim.kind[i] !== KIND_PLAYER ||
          sim.frozen[i] === 1 ||
          sim.gaseous[i] === 1
        )
          continue
        sim.velX[i] += ax
        sim.velY[i] += ay
      }
    }
    if (age >= 0.14 && age < 0.14 + dtReal) audio.iceImpact(0.16)
    if (age >= 0.59 && age < 0.59 + dtReal) audio.iceImpact(0.12)
  } else if (idle.type === 'tentacule') {
    // le PSEUDOPODE : un aimant au bout du doigt tire les gouttes en
    // chaîne — il sort du flanc, s'étire jusqu'à la paroi, l'effleure,
    // puis rentre en se rembobinant
    const age = elapsed - idle.t0
    const cx = sim.stats.centroidX
    const cy = sim.stats.centroidY
    const dxM = idle.murX - cx
    const dyM = idle.murY - cy
    const dMur = Math.hypot(dxM, dyM) || 1
    const ux = dxM / dMur
    const uy = dyM / dMur
    const depart = Math.min(dMur, sim.stats.rmsRadius * 0.85)
    // l'avancée du bout : sortie (→1,2 s), toucher (→1,9 s), retour
    // (→3,15 s), rassemblement (→3,9 s). Le bout vise LÉGÈREMENT DANS la
    // paroi : la collision fait le contact — les gouttes traînent toujours
    // un peu derrière l'aimant, sans ça le doigt s'arrêtait à vingt unités
    const lisse = (t: number): number => t * t * (3 - 2 * t)
    const av =
      lisse(Math.min(1, age / 1.2)) *
      (1 - lisse(age < 2.1 ? 0 : Math.min(1, (age - 2.1) / 1.05)))
    const tipD = depart + (dMur + 18 - depart) * av
    const tipX = cx + ux * tipD
    const tipY = cy + uy * tipD
    const k = Math.min(1, 5 * dtReal)
    const retire = age >= 2.1 ? 1.35 : 1 // le rembobinage tire plus fort
    let mvx = 0
    let mvy = 0
    let nLiq = 0
    for (let i = 0; i < sim.count; i++) {
      if (
        sim.kind[i] !== KIND_PLAYER ||
        sim.frozen[i] === 1 ||
        sim.gaseous[i] === 1
      )
        continue
      nLiq++
      const px = tipX - sim.posX[i]
      const py = tipY - sim.posY[i]
      const d = Math.hypot(px, py)
      if (age < 3.15) {
        // aimant du bout, puis rassemblement
        if (d > 52 || d < 1e-3) {
          // rien : hors de portée de l'aimant
        } else {
          const vCible = Math.min(130, 26 + d * 2.0) * retire
          sim.velX[i] += ((px / d) * vCible - sim.velX[i]) * k
          sim.velY[i] += ((py / d) * vCible - sim.velY[i]) * k
        }
      } else {
        // le RASSEMBLEMENT : ce qui dépasse encore rentre au bercail
        const gx = cx - sim.posX[i]
        const gy = cy - sim.posY[i]
        const g = Math.hypot(gx, gy)
        if (g >= sim.stats.rmsRadius * 1.05) {
          const vCible = Math.min(60, g * 1.2)
          const vRad = (sim.velX[i] * gx + sim.velY[i] * gy) / g
          sim.velX[i] += ((vCible - vRad) * gx * k * 0.6) / g
          sim.velY[i] += ((vCible - vRad) * gy * k * 0.6) / g
        }
      }
      mvx += sim.velX[i]
      mvy += sim.velY[i]
    }
    // l'ANCRE : le pseudopode ne doit RIEN faire gagner. La neutralité
    // d'élan ne suffit pas — le contact de la paroi POUSSE le corps ; un
    // ressort doux (uniforme : il ne déforme pas le doigt) ramène le
    // centroïde à sa position de départ et amortit la vitesse d'ensemble
    if (nLiq > 0) {
      mvx /= nLiq
      mvy /= nLiq
      const rx = ((idle.ancX - cx) * 6 - mvx * 2.5) * dtReal
      const ry = ((idle.ancY - cy) * 6 - mvy * 2.5) * dtReal
      for (let i = 0; i < sim.count; i++) {
        if (
          sim.kind[i] !== KIND_PLAYER ||
          sim.frozen[i] === 1 ||
          sim.gaseous[i] === 1
        )
          continue
        sim.velX[i] += rx
        sim.velY[i] += ry
      }
    }
    if (age >= 1.25 && age < 1.25 + dtReal) audio.iceImpact(0.09)
  }
}
function majPresence(dtReal: number, aimX: number, aimY: number): void {
  const cx = sim.stats.centroidX
  const cy = sim.stats.centroidY
  // le réveil ne vit que le temps de l'intro caméra
  if (reveil.actif && (!camera.introEnCours || sim.dispersed))
    reveil.actif = false
  const tReveil = performance.now() / 1000 - reveil.t0
  // 1. l'ATTENTION : la visée d'abord ; sinon le mécanisme notable le plus
  // proche — chaudière, cible laser, cachette encore voilée — puis le sas
  let tx = 0
  let ty = 0
  let vise = false
  if (reveil.actif) {
    // le RÉVEIL : le regard visite un coin de la salle, puis glisse au sas
    if (tReveil < reveil.bascule) {
      tx = reveil.balayageX
      ty = reveil.balayageY
    } else {
      tx = exitMouth.x
      ty = exitMouth.y
    }
    vise = true
  } else if (stickVise()) {
    // à la manette, le point de visée est le point d'ÉJECTION — derrière le
    // corps en eau : le regard, lui, suit le STICK — là où l'on veut aller
    // (axe Y du stick vers le bas, monde vers le haut)
    tx = cx + manette.dirX * 400
    ty = cy - manette.dirY * 400
    vise = true
  } else if (
    input.aimActive ||
    // la souris retient le regard SANS clic : tant qu'elle a la main et
    // qu'elle a bougé il y a peu — immobile trop longtemps, la curiosité
    // reprend (mécanismes, sas, vignettes d'idle)
    (performance.now() / 1000 - input.sourisAt < 6 &&
      input.lastPointerAt >= manette.lastActivity)
  ) {
    tx = aimX
    ty = aimY
    vise = true
  } else if (idle.type === 'sas') {
    // la vignette d'idle : il pense au sas — le regard y glisse
    tx = exitMouth.x
    ty = exitMouth.y
    vise = true
  } else if (idle.type === 'tentacule' || idle.type === 'tapote') {
    // il regarde ce qu'il touche : le point de paroi de son propre geste
    tx = idle.murX
    ty = idle.murY
    vise = true
  } else if (!sim.dispersed) {
    let best = Infinity
    const regarde = (x: number, y: number, portee: number): void => {
      const d = Math.hypot(x - cx, y - cy)
      if (d < portee && d < best) {
        best = d
        tx = x
        ty = y
        vise = true
      }
    }
    for (const b of level.boxes) {
      if (b.material === MAT_CHAUD)
        regarde((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, 420)
    }
    for (const t of level.cibles ?? []) regarde(t.x, t.y, 500)
    const caches = level.caches ?? []
    for (let i = 0; i < caches.length; i++) {
      if ((cachesLevee[i] ?? Infinity) === Infinity) {
        const c = caches[i]
        regarde((c.minX + c.maxX) / 2, (c.minY + c.maxY) / 2, 420)
      }
    }
    regarde(exitMouth.x, exitMouth.y, 1100)
  }
  // le noyau vit DANS le corps : à mi-chemin du bord, du côté regardé —
  // la VIVACITÉ (curseur) règle la vitesse du glissement
  const k = 1 - Math.exp(-4.5 * oeilRegl.vivacite * dtReal)
  if (vise) {
    const d = Math.hypot(tx - cx, ty - cy) || 1
    const portee = Math.min(d, sim.stats.rmsRadius * 0.55)
    presence.x += (cx + ((tx - cx) / d) * portee - presence.x) * k
    presence.y += (cy + ((ty - cy) / d) * portee - presence.y) * k
  } else {
    // l'ERRANCE (curseur) : rien ne l'appelle — au lieu de rentrer se
    // poser au centre, le regard vagabonde lentement dans le corps
    const port = sim.stats.rmsRadius * 0.3 * Math.min(1.6, oeilRegl.errance)
    const tw = elapsed * 0.33
    const wx = Math.sin(tw + 1.7) * 0.7 + Math.sin(tw * 2.3) * 0.3
    const wy = Math.cos(tw * 0.83) * 0.7 + Math.sin(tw * 1.9 + 4.2) * 0.3
    presence.x += (cx + wx * port - presence.x) * k
    presence.y += (cy + wy * port - presence.y) * k
  }
  // sans cible, l'œil ne s'éteint plus tout à fait : l'errance se VOIT
  // (elle garde une demi-présence — 0 sur le curseur la rend invisible)
  const intCible = sim.dispersed
    ? 0
    : vise
      ? 1
      : Math.min(0.65, 0.65 * oeilRegl.errance)
  presence.int += (intCible - presence.int) * k
  // 2. la RESPIRATION : le rythme raconte l'état intérieur
  const peril = endgame.lastCall || endgame.spent
  // l'idle approfondit le souffle ; l'ÉTIREMENT est une grande inspiration
  const ampCible = reveil.actif
    ? 0.03 // la grande inspiration du réveil
    : input.aimActive
      ? 0.004
      : peril
        ? 0.022
        : idle.type === 'etire'
          ? 0.034
          : idle.t > 4
            ? 0.017
            : 0.013
  const vitCible = reveil.actif
    ? 1.0
    : peril
      ? 4.8
      : idle.type === 'etire'
        ? 0.9
        : idle.t > 4
          ? 1.35
          : 1.7
  presence.amp += (ampCible - presence.amp) * k
  presence.vit += (vitCible - presence.vit) * k
  // l'ONDULATION de l'abandon : un court répit et le contour se met à
  // onduler franchement (le shader la dessine) — un geste, et elle s'efface
  const ondCible = idle.t > 1.5 ? 1 : 0
  presence.ondule +=
    (ondCible - presence.ondule) * (1 - Math.exp(-2.0 * dtReal))
  // 3. le FRISSON : armé hors du froid, déclenché quand il saisit
  if (sim.froidFrac < 0.05) presence.armeFrisson = true
  if (presence.armeFrisson && sim.froidFrac >= 0.18) {
    presence.armeFrisson = false
    presence.t0Frisson = elapsed
  }
  // le frisson de RÉVEIL, à son instant tiré au sort
  if (
    reveil.actif &&
    !reveil.frissonFait &&
    reveil.frissonT >= 0 &&
    tReveil >= reveil.frissonT
  ) {
    reveil.frissonFait = true
    presence.t0Frisson = elapsed
  }
  const dtF = elapsed - presence.t0Frisson
  presence.frisson = dtF >= 0 && dtF < 1 ? Math.exp(-dtF * 3.4) : 0
}

// ---- HUD : les instruments emportés, et la bonbonne qui se VERSE ----
const hudInstrChip = document.getElementById(
  'hud-instr-chip',
) as HTMLButtonElement
const hudInstr = document.getElementById('hud-instr') as HTMLElement
const instrPanel = document.getElementById('instr-panel') as HTMLDivElement
/** La pastille montre les icônes emportées ; le panneau donne le détail. */
function majInstrumentsUI(): void {
  if (!hudInstrChip) return
  const defs = run.instruments
    .map((id) => instrumentDef(id))
    .filter((d): d is NonNullable<typeof d> => d !== null)
  hudInstr.textContent =
    defs.length > 0 ? defs.map((d) => d.icone).join('') : '—'
  if (instrPanel) {
    instrPanel.innerHTML =
      `<h4>INSTRUMENTS EMBARQUÉS</h4>` +
      (defs.length === 0
        ? `<p class="ip-vide">Aucun pour l'instant — les paliers d'étalonnage (XP) ouvrent les tirages.</p>`
        : defs
            .map(
              (d) =>
                `<div class="ip-row"><span class="ip-ico">${d.icone}</span><div><b>${d.nom}</b><small>${d.desc}</small></div></div>`,
            )
            .join('')) +
      `<p class="ip-note">valables jusqu'à la fin de la run</p>`
  }
}
hudInstrChip?.addEventListener('click', () => {
  if (instrPanel) instrPanel.hidden = !instrPanel.hidden
})
instrPanel?.addEventListener('click', () => {
  instrPanel.hidden = true
})

/** VERSER LA BONBONNE : la réserve se reverse dans le corps, en jeu — même
 * non pleine. Le corps se regonfle jusqu'à son volume de départ ; l'état
 * liquide est requis (la glace n'absorbe pas, le nuage disperserait). */
function verserBonbonne(): string {
  if (auHub || testLevel || miseEnBonbonne || sim.dispersed) return 'contexte'
  if (input.paused || run.ended || run.exitTimer > 0) return 'pause'
  if (input.freezeIntent || input.gasIntent) return 'etat'
  const manque = Math.max(0, level.spawn.n - sim.playerCount)
  const nParts = Math.min(
    manque,
    Math.floor(run.bonbonneLiters / params.litersPerParticle),
  )
  if (nParts < 1) return 'rien'
  // le versement s'installe dans les CREUX autour du corps (jamais sur les
  // particules en place) : poser au centroïde faisait exploser la densité —
  // la bonbonne ne se débite que de ce qui a réellement trouvé sa place
  const poses = sim.verserAuCorps(
    sim.stats.centroidX,
    sim.stats.centroidY,
    nParts,
    KIND_PLAYER,
  )
  if (poses < 1) return 'rien'
  run.bonbonneLiters = Math.max(
    0,
    run.bonbonneLiters - poses * params.litersPerParticle,
  )
  sim.relabel()
  bande.ponctuation('sting-collecte', 0.5)
  hudBonbonneChip.classList.add('ouvert')
  window.setTimeout(() => hudBonbonneChip.classList.remove('ouvert'), 1200)
  return 'ok'
}
hudBonbonneChip?.addEventListener('click', verserBonbonne)
// Sonde de test : verser depuis la console (comme __sim, __run)
;(window as unknown as { __verser: () => string }).__verser = verserBonbonne
/** La cérémonie avec un surplus factice — la sonde __bonbonne et le
 * PUPITRE D'ESSAIS passent tous deux par ici. */
function simuleBonbonne(surplus = 2): void {
  montreMiseEnBonbonne({
    surplus,
    prime: 0,
    pct: Math.min(1, surplus / 4),
    temps: 61.2,
    newVolume: false,
    newChrono: false,
    recVol: '',
    recChr: '',
    note: 0,
    gainCl: Math.round(surplus * 10),
    totalCl: condensat,
  })
}
// Sonde de test : la cérémonie depuis la console — __bonbonne(2.5) ouvre la
// mise en bonbonne avec un surplus factice, pour regarder la jauge couler
;(window as unknown as { __bonbonne: (surplus?: number) => void }).__bonbonne =
  simuleBonbonne

// ---- LE PUPITRE D'ESSAIS : les événements du jeu, simulés au doigt ----
// La console navigateur n'existe ni sur Steam Deck ni sur mobile : le
// pupitre est un écran du menu (mode concepteur) qui rejoue les mêmes
// événements en gros boutons — cérémonie, bonbonne, paliers, sons.
const pupitreEl = document.getElementById('pupitre') as HTMLDivElement
function pupDit(msg: string): void {
  const e = document.getElementById('pup-etat')
  if (e) e.textContent = msg
}
document.getElementById('home-pupitre')?.addEventListener('click', () => {
  pupitreEl.hidden = false
  pupDit('')
})
document.getElementById('pupitre-fermer')?.addEventListener('click', () => {
  pupitreEl.hidden = true
})
pupitreEl?.addEventListener('pointerdown', (e) => {
  if (e.target === pupitreEl) pupitreEl.hidden = true
})
for (const b of Array.from(
  pupitreEl?.querySelectorAll<HTMLButtonElement>('[data-pup]') ?? [],
)) {
  b.addEventListener('click', () => {
    const quoi = b.dataset.pup ?? ''
    if (quoi.startsWith('ceremonie-')) {
      pupitreEl.hidden = true
      simuleBonbonne(Number(quoi.split('-')[1]))
      return
    }
    switch (quoi) {
      case 'bonbonne-plus':
        run.bonbonneLiters = Math.min(BONBONNE_CAP, run.bonbonneLiters + 2)
        pupDit(
          `Bonbonne : ${run.bonbonneLiters.toFixed(1)} / ${BONBONNE_CAP} L.`,
        )
        break
      case 'bonbonne-vider':
        run.bonbonneLiters = 0
        pupDit('Bonbonne vidée.')
        break
      case 'verser': {
        const r = verserBonbonne()
        pupDit(
          r === 'ok'
            ? 'Versé au corps.'
            : r === 'rien'
              ? 'Rien à verser : bonbonne vide, ou corps déjà au volume de départ.'
              : r === 'etat'
                ? 'Impossible en glace ou en vapeur — redevenez liquide.'
                : r === 'pause'
                  ? 'Impossible : jeu en pause ou essai conclu.'
                  : 'Impossible ici (hub, essai de tableau ou cérémonie en cours).',
        )
        break
      }
      case 'xp-bord': {
        const p = prochainPalier(run.xp)
        if (p === null) {
          pupDit('Table des paliers épuisée : plus rien à franchir.')
        } else {
          run.xp = Math.max(run.xp, p - 0.5)
          pupDit(
            `XP amenée à ${run.xp.toFixed(1)} L (palier à ${p} L) — la prochaine cérémonie le franchira.`,
          )
        }
        break
      }
      case 'xp-sec':
        run.xp += 2
        pupDit(
          `XP : ${run.xp.toFixed(1)} L — à sec, sans cérémonie (les tirages ne s'ouvrent qu'en cérémonie).`,
        )
        break
      case 'condensat':
        gagneCondensat(150)
        pupDit('Condensat +150 cL.')
        break
      case 'vie':
        run.vies = Math.min(VIES_MAX, run.vies + 1)
        majBoutonsRun()
        pupDit(`Vies : ${run.vies} / ${VIES_MAX}.`)
        break
      case 'son-collecte':
        bande.ponctuation('sting-collecte', 0.8)
        pupDit('♪ sting-collecte')
        break
      case 'son-record':
        bande.ponctuation('sting-record', 0.8)
        pupDit('♪ sting-record')
        break
      case 'son-fin':
        bande.ponctuation('fin-de-course', 0.8)
        pupDit('♪ fin-de-course')
        break
    }
  })
}

function resetLasers(): void {
  laserEtat.vues = []
  laserEtat.impacts = []
  laserEtat.litPrec = []
  laserEtat.recepteurs = creerEtatRecepteurs((level.cibles ?? []).length)
  laserEtat.portesOuvertes = (level.portes ?? []).map(() => false)
  laserEtat.doorsKey = ''
  lastRailTime = 0
  railsEngages.clear()
  cachesLevee = (level.caches ?? []).map(() => Infinity)
  rebuildRenderBoxes() // les parois factices reprennent leur poste
}

// ---- LA MISE EN BONBONNE : l'écran de récompense de fin de salle ----
// Quatre temps : la compression (le surplus coule dans la bonbonne), la
// lecture du protocole (les lignes tombent, les records se tamponnent), le
// condensat (les centilitres s'égrènent vers la réserve méta), et LE CHOIX
// (trois cartes d'instruments, on en emporte une — certaines payantes en
// condensat). Un toucher saute aux cartes ; le choix, lui, ne se saute pas.
let miseEnBonbonne = false
const mbVeil = document.getElementById('mb-veil') as HTMLDivElement
const mbTimers: number[] = []
// Le fil de la cérémonie : bilan (temps 1-3, sautables) → versement (le
// surplus choisit sa destination) → draft (un tirage par palier franchi)
// → fin (jauge et CONTINUER). Le versement et la suite ne se sautent pas.
let mbEtape: 'bilan' | 'versement' | 'etalonnage' | 'draft' | 'salles' | 'fin' =
  'bilan'
let mbDraftsRestants = 0
let mbBilanCourant: BilanSalle | null = null

/** Le sas mène à la salle suivante (raccourci éventuel compris). */
function avanceSalle(): void {
  overlay.classList.remove('visible')
  // RACCOURCI (mécanique roguelike, préparée) : un tableau peut déclarer
  // `raccourciVers` — son sas envoie alors directement à la salle codée,
  // en SAUTANT les intermédiaires. Vers l'avant uniquement (pas de boucle).
  const cible = level.raccourciVers
    ? playedLevels().findIndex((t) => t.code === level.raccourciVers)
    : -1
  // le CHOIX du pool prime : la salle élue à la cérémonie devient la suivante
  const choix = salleChoisie
    ? playedLevels().findIndex((t) => t === salleChoisie)
    : -1
  salleChoisie = null
  levelIndex =
    choix > levelIndex ? choix : cible > levelIndex ? cible : levelIndex + 1
  restart()
}

interface BilanSalle {
  surplus: number
  prime: number
  pct: number // part du volume de départ livrée (0..1+)
  temps: number
  newVolume: boolean
  newChrono: boolean
  recVol: string
  recChr: string
  note: number
  gainCl: number
  totalCl: number // réserve APRÈS le gain
}

function mbEl(id: string): HTMLElement {
  return mbVeil.querySelector('#' + id) as HTMLElement
}

function fermeMiseEnBonbonne(): void {
  for (const t of mbTimers) clearTimeout(t)
  mbTimers.length = 0
  mbVeil.hidden = true
  miseEnBonbonne = false
  mbBilanCourant = null
}

/** Fige les temps 1-3 à leur état final (saut ou passage naturel). */
function mbFigeBilan(): void {
  for (const t of mbTimers) clearTimeout(t)
  mbTimers.length = 0
  const b = mbBilanCourant
  if (b) {
    mbEl('mb-eau').style.height = `${Math.min(100, b.pct * 100).toFixed(0)}%`
    mbEl('mb-l').textContent = `${b.surplus.toFixed(2)} L`
    if (b.prime >= 0.01) {
      const pr = mbEl('mb-prime')
      pr.hidden = false
      pr.textContent = `+${b.prime.toFixed(2)} L — PRIME DE GLACE`
      mbEl('mb-glace').hidden = false
    }
    for (const l of Array.from(mbVeil.querySelectorAll('.mb-ligne'))) {
      l.classList.add('mb-on')
    }
    const cond = mbEl('mb-cond')
    cond.hidden = false
    cond.classList.add('mb-on')
    mbEl('mb-cond-n').textContent = String(b.totalCl)
  }
  mbEl('mb-passer').hidden = true
}

/** LE VERSEMENT : le surplus choisit sa destination — la RÉSERVE (bonbonne,
 * reversable dans le corps en route) ou l'ÉTALONNAGE (l'XP des
 * instruments). Bonbonne pleine : l'XP est le seul chemin. */
function mbMontreVersement(): void {
  if (mbEtape !== 'bilan') return
  mbEtape = 'versement'
  mbFigeBilan()
  const b = mbBilanCourant
  if (!b) return
  const bloc = mbEl('mb-choix')
  bloc.hidden = false
  mbEl('mb-choix-titre').textContent = 'OÙ VERSER LE SURPLUS ?'
  const host = mbEl('mb-cartes')
  host.innerHTML = ''
  const espace = Math.max(0, BONBONNE_CAP - run.bonbonneLiters)
  const verse = Math.min(b.surplus, espace)
  const spill = b.surplus - verse
  const pleine = espace < 0.01

  const cb = document.createElement('button')
  cb.type = 'button'
  cb.className = 'mb-carte mb-dest' + (pleine ? ' mb-pauvre' : '')
  cb.disabled = pleine
  cb.innerHTML =
    `<span class="mb-ico">🫙</span><b>RÉSERVE</b>` +
    `<small>${
      pleine
        ? 'bonbonne PLEINE — tout va à l’étalonnage'
        : `+${verse.toFixed(2)} L en bonbonne (${run.bonbonneLiters.toFixed(1)} / ${BONBONNE_CAP} L)` +
          (spill > 0.01 ? ` · excédent +${spill.toFixed(2)} L → XP` : '')
    }</small>` +
    `<em class="mb-prix mb-offert">se reverse dans le corps, en jeu</em>`
  cb.addEventListener('click', () => {
    run.bonbonneLiters = Math.min(BONBONNE_CAP, run.bonbonneLiters + verse)
    bande.ponctuation('sting-collecte', 0.55)
    mbVerseXp(spill)
  })
  host.appendChild(cb)

  const prochain = prochainPalier(run.xp)
  const cx = document.createElement('button')
  cx.type = 'button'
  cx.className = 'mb-carte mb-dest'
  cx.innerHTML =
    `<span class="mb-ico">🧰</span><b>ÉTALONNAGE</b>` +
    `<small>+${b.surplus.toFixed(2)} L d’XP (jauge : ${run.xp.toFixed(1)} L${
      prochain !== null ? ` · palier à ${prochain} L` : ''
    })</small>` +
    `<em class="mb-prix mb-offert">chaque palier ouvre un tirage</em>`
  cx.addEventListener('click', () => {
    bande.ponctuation('sting-collecte', 0.55)
    mbVerseXp(b.surplus)
  })
  host.appendChild(cx)
}

// ---- LA JAUGE D'ÉTALONNAGE : l'XP se VOIT couler, palier par palier ----
// La barre couvre le segment « palier atteint → palier suivant » (façon
// barre de niveau) : un franchissement l'emplit, l'embrase, fait sauter le
// compteur de paliers, tamponne « PALIER n — TIRAGE OUVERT » — puis elle
// repart de zéro sur le segment suivant. Table épuisée : elle reste pleine.

/** Le segment courant de la jauge : dernier palier atteint → prochain. */
function mbSegmentXp(xp: number): { base: number; cible: number | null } {
  let base = 0
  for (const p of PALIERS_XP) {
    if (xp >= p) base = p
    else return { base, cible: p }
  }
  return { base, cible: null }
}

/** Peint la jauge pour une valeur d'XP donnée (remplissage, bornes, litres). */
function mbPeintEtal(xp: number): void {
  const seg = mbSegmentXp(xp)
  const part =
    seg.cible === null
      ? 1
      : Math.max(0, Math.min(1, (xp - seg.base) / (seg.cible - seg.base)))
  const pct = `${(part * 100).toFixed(2)}%`
  mbEl('mb-etal-fluide').style.width = pct
  mbEl('mb-etal-lueur').style.left = pct
  mbEl('mb-etal-l').textContent = xp.toFixed(1)
  mbEl('mb-etal-pg').querySelector('b')!.textContent = String(
    paliersAtteints(xp),
  )
  const pd = mbEl('mb-etal-pd')
  pd.querySelector('b')!.textContent =
    seg.cible === null ? '★' : `${seg.cible} L`
  pd.querySelector('small')!.textContent =
    seg.cible === null ? 'complet' : 'prochain'
}

/** Fait COULER la jauge de `depart` à `arrivee` : le fluide monte, chaque
 * palier franchi s'embrase et se tamponne, puis `onDone` enchaîne. */
function mbAnimeEtalonnage(
  depart: number,
  arrivee: number,
  onDone: () => void,
): void {
  const etal = mbEl('mb-etal')
  etal.hidden = false
  mbEl('mb-etal-tampon').hidden = true
  const gainEl = mbEl('mb-etal-gain')
  const gain = arrivee - depart
  if (gain > 0.005) {
    gainEl.hidden = false
    gainEl.textContent = `+${gain.toFixed(2)} L`
  } else {
    gainEl.hidden = true
  }
  mbPeintEtal(depart)
  if (gain <= 0.005) {
    onDone()
    return
  }
  etal.classList.add('coule')
  // le fluide coule segment par segment — la durée suit la part du gain,
  // bornée pour que ni un filet ni un torrent ne cassent le rythme
  const etape = (xp: number): void => {
    const seg = mbSegmentXp(xp)
    const cible = seg.cible !== null ? Math.min(arrivee, seg.cible) : arrivee
    const duree = Math.max(
      450,
      Math.min(1400, ((cible - xp) / Math.max(0.001, gain)) * 1800),
    )
    const t0 = performance.now()
    const anime = (): void => {
      if (!miseEnBonbonne || mbEtape !== 'etalonnage') return // cérémonie fermée
      const t = Math.min(1, (performance.now() - t0) / duree)
      const e = t * t * (3 - 2 * t) // douce au départ ET à l'arrivée
      mbPeintEtal(xp + (cible - xp) * e)
      if (t < 1) {
        requestAnimationFrame(anime)
        return
      }
      const franchit = seg.cible !== null && cible >= seg.cible - 1e-9
      if (franchit) {
        // PALIER FRANCHI : l'embrasement du tube, le pop du compteur, le
        // tampon doré, la ponctuation des records
        const no = paliersAtteints(cible)
        const tube = mbEl('mb-etal-tube')
        tube.classList.remove('eclair')
        void tube.offsetWidth // relance l'animation CSS
        tube.classList.add('eclair')
        const pg = mbEl('mb-etal-pg')
        pg.classList.remove('saute')
        void pg.offsetWidth
        pg.classList.add('saute')
        const tampon = mbEl('mb-etal-tampon')
        tampon.hidden = false
        tampon.textContent = `PALIER ${no} — TIRAGE OUVERT`
        bande.ponctuation('sting-record', 0.75)
        mbPeintEtal(cible) // la jauge repart de zéro sur le segment suivant
        mbTimers.push(
          window.setTimeout(
            () => {
              if (cible < arrivee - 1e-9) etape(cible)
              else {
                etal.classList.remove('coule')
                onDone()
              }
            },
            cible < arrivee - 1e-9 ? 850 : 1000,
          ),
        )
        return
      }
      etal.classList.remove('coule')
      mbTimers.push(window.setTimeout(onDone, 450))
    }
    requestAnimationFrame(anime)
  }
  etape(depart)
}

/** Crédite l'XP et fait COULER la jauge — puis un tirage par palier
 * franchi, sinon la suite de la cérémonie. */
function mbVerseXp(litres: number): void {
  const avantXp = run.xp
  const avant = paliersAtteints(run.xp)
  run.xp += litres
  mbDraftsRestants = paliersAtteints(run.xp) - avant
  mbEtape = 'etalonnage'
  // les cartes du versement s'effacent : la jauge prend la scène
  mbEl('mb-choix-titre').textContent =
    litres > 0.005 ? 'L’ÉTALONNAGE SE CHARGE' : 'ÉTALONNAGE'
  mbEl('mb-cartes').innerHTML = ''
  mbAnimeEtalonnage(avantXp, run.xp, () => {
    if (mbDraftsRestants > 0) mbMontreDraft()
    else mbApresRecompense()
  })
}

/** Un TIRAGE d'instruments (palier franchi) : trois cartes, on en emporte
 * une — certaines payantes en condensat, jamais toutes. */
function mbMontreDraft(): void {
  mbEtape = 'draft'
  const palierNo = paliersAtteints(run.xp) - mbDraftsRestants + 1
  mbEl('mb-choix-titre').textContent =
    `PALIER D'ÉTALONNAGE ${palierNo} — EMPORTEZ UN INSTRUMENT`
  const host = mbEl('mb-cartes')
  host.innerHTML = ''
  const cartes = tirageInstruments(
    Math.random,
    run.instruments,
    run.vies,
    VIES_MAX,
  )
  const suite = (): void => {
    mbDraftsRestants -= 1
    if (mbDraftsRestants > 0) mbMontreDraft()
    else mbApresRecompense()
  }
  if (cartes.length === 0) {
    // plus rien au bassin (tout emporté, réserve pleine) : palier honoré
    mbDraftsRestants = 0
    mbApresRecompense()
    return
  }
  for (const carte of cartes) {
    const def = instrumentDef(carte.id)
    if (!def) continue
    const payable = carte.prix === 0 || condensat >= carte.prix
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'mb-carte' + (payable ? '' : ' mb-pauvre')
    btn.disabled = !payable
    btn.innerHTML =
      `<span class="mb-ico">${def.icone}</span>` +
      `<b>${def.nom}</b><small>${def.desc}</small>` +
      (carte.prix > 0
        ? `<em class="mb-prix">${carte.prix} cL</em>`
        : `<em class="mb-prix mb-offert">offert</em>`)
    btn.addEventListener('click', () => {
      if (!depenseCondensat(carte.prix)) return
      if (carte.id === 'echantillon-secours') {
        run.vies = Math.min(VIES_MAX, run.vies + 1)
        majBoutonsRun()
      } else {
        run.instruments.push(carte.id)
      }
      majInstrumentsUI()
      bande.ponctuation('sting-collecte', 0.7)
      suite()
    })
    host.appendChild(btn)
  }
}

// ---- Le POOL de salles : le choix de la prochaine, après la récompense --
// Les codes « 21XX-MMD » peuvent porter PLUSIEURS tableaux au même rang :
// quand le rang suivant en offre au moins deux, la cérémonie propose un
// CHOIX — mini-carte, code, nom, chips — au lieu de l'enchaînement muet.
let salleChoisie: LevelDef | null = null

/** Après la récompense : le choix de salle si le pool du rang suivant en
 * offre deux — sinon la fin ordinaire. */
function mbApresRecompense(): void {
  const seq = playedLevels()
  const props = propositionsSalles(seq, levelIndex + 2, seq.length)
  if (props.length === 2) mbMontreSalles(props)
  else mbMontreFin()
}

function mbMontreSalles(props: LevelDef[]): void {
  mbEtape = 'salles'
  mbEl('mb-choix-titre').textContent =
    'PAROI DU SAS OUVERTE — CHOISISSEZ LA PROCHAINE SALLE'
  const host = mbEl('mb-cartes')
  host.innerHTML = ''
  for (const lv of props) {
    const c21 = decodeCode21(lv.code)
    const a = c21?.atelier
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'mb-carte mb-salle'
    const esc = (t: string): string =>
      t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    btn.innerHTML =
      `<canvas width="220" height="126"></canvas>` +
      `<b>${esc(lv.code)}</b><small>${esc(lv.name)}</small>` +
      (a
        ? `<span class="salle-chips"><i>${MOMENT_COURT[a.moment]}</i>` +
          `<i class="sc-m${a.mecanique}">${MECANIQUE_NOMS[a.mecanique].toUpperCase()}</i>` +
          `<i>DIFF ${a.difficulte}</i></span>`
        : '')
    dessineMiniCarte(btn.querySelector('canvas') as HTMLCanvasElement, lv)
    btn.addEventListener('click', () => {
      salleChoisie = lv
      bande.ponctuation('sting-collecte', 0.7)
      fermeMiseEnBonbonne()
      avanceSalle()
    })
    host.appendChild(btn)
  }
}

/** La FIN : l'état des jauges, et CONTINUER mène à la salle suivante. */
function mbMontreFin(): void {
  mbEtape = 'fin'
  mbEl('mb-choix-titre').textContent = 'PAROI DU SAS OUVERTE'
  // la jauge d'étalonnage reste en scène (l'XP se lit dessus, en grand)
  mbEl('mb-etal').hidden = false
  mbPeintEtal(run.xp)
  const host = mbEl('mb-cartes')
  host.innerHTML = ''
  const info = document.createElement('div')
  info.className = 'mb-jauges'
  info.innerHTML = `<span>🫙 réserve <b>${run.bonbonneLiters.toFixed(2)} / ${BONBONNE_CAP} L</b></span><span>se reverse dans le corps, en jeu</span>`
  host.appendChild(info)
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'mb-continuer'
  btn.textContent = 'SALLE SUIVANTE'
  btn.addEventListener('click', () => {
    fermeMiseEnBonbonne()
    avanceSalle()
  })
  host.appendChild(btn)
}

function montreMiseEnBonbonne(b: BilanSalle): void {
  miseEnBonbonne = true
  mbEtape = 'bilan'
  mbDraftsRestants = 0
  mbBilanCourant = b
  mbVeil.hidden = false
  // état de départ
  mbEl('mb-eau').style.height = '0%'
  mbEl('mb-l').textContent = '0,00 L'
  mbEl('mb-prime').hidden = true
  mbEl('mb-glace').hidden = true
  mbEl('mb-choix').hidden = true
  mbEl('mb-cond').hidden = true
  mbEl('mb-cond').classList.remove('mb-on')
  mbEl('mb-etal').hidden = true
  mbEl('mb-etal').classList.remove('coule')
  mbEl('mb-etal-tampon').hidden = true
  mbEl('mb-etal-gain').hidden = true
  mbEl('mb-passer').hidden = false
  const apres = (ms: number, fn: () => void): void => {
    mbTimers.push(window.setTimeout(fn, ms))
  }
  // Temps 1 — la COMPRESSION : le niveau monte, le compteur égrène
  apres(150, () => {
    mbEl('mb-eau').style.height = `${Math.min(100, b.pct * 100).toFixed(0)}%`
  })
  const t0 = performance.now() + 150
  const litres = (): void => {
    const t = Math.min(1, (performance.now() - t0) / 1300)
    const e = 1 - (1 - t) * (1 - t) // sortie douce
    mbEl('mb-l').textContent = `${(b.surplus * e).toFixed(2)} L`
    if (t < 1 && mbEtape === 'bilan') requestAnimationFrame(litres)
  }
  requestAnimationFrame(litres)
  if (b.prime >= 0.01) {
    apres(1550, () => {
      const pr = mbEl('mb-prime')
      pr.hidden = false
      pr.textContent = `+${b.prime.toFixed(2)} L — PRIME DE GLACE`
      mbEl('mb-glace').hidden = false
      audio.iceImpact(1)
    })
  }
  // Temps 2 — la LECTURE DU PROTOCOLE : les lignes tombent une à une
  const tampon = (neuf: boolean): string =>
    neuf ? `<em class="mb-record">RECORD DU PROTOCOLE</em>` : ''
  const lignes = [
    `<span>💧 <b>${b.surplus.toFixed(2)} L</b> · ${Math.round(b.pct * 100)} % du volume de départ</span>${tampon(b.newVolume)}${b.newVolume ? '' : `<small>record : ${b.recVol}</small>`}`,
    `<span>⏱ <b>${fmtTime(b.temps)}</b></span>${tampon(b.newChrono)}${b.newChrono ? '' : `<small>record : ${b.recChr}</small>`}`,
    `<span>◈ NOTE <b>${b.note}</b></span>`,
  ]
  const hostLignes = mbEl('mb-lignes')
  hostLignes.innerHTML = lignes
    .map((l) => `<div class="mb-ligne">${l}</div>`)
    .join('')
  Array.from(hostLignes.children).forEach((el2, i) => {
    apres(2000 + i * 260, () => el2.classList.add('mb-on'))
  })
  // Temps 3 — le CONDENSAT : les centilitres s'égrènent vers la réserve
  apres(2950, () => {
    const cond = mbEl('mb-cond')
    cond.hidden = false
    cond.classList.add('mb-on')
    mbEl('mb-cond-gain').textContent = `+${b.gainCl} cL`
    const c0 = performance.now()
    const roule = (): void => {
      const t = Math.min(1, (performance.now() - c0) / 1100)
      const e = 1 - (1 - t) * (1 - t)
      mbEl('mb-cond-n').textContent = String(
        Math.round(b.totalCl - b.gainCl * (1 - e)),
      )
      if (t < 1 && mbEtape === 'bilan') requestAnimationFrame(roule)
    }
    requestAnimationFrame(roule)
  })
  // Temps 4 — LE VERSEMENT
  apres(4300, mbMontreVersement)
}
// un toucher pendant les temps 1-3 saute au versement ; jamais l'inverse
mbVeil?.addEventListener('pointerdown', (e) => {
  if (
    mbEtape === 'bilan' &&
    (e.target as HTMLElement).closest('.mb-carte') === null
  ) {
    mbMontreVersement()
  }
})
const dashAimEl = el('dash-aim')
const dashCostEl = el('dash-cost')

function restart(): void {
  run.exitTimer = 0
  run.tableauTime = 0
  run.ended = false
  ecranDispersion = 'aucun'
  dispersionDelai = 0
  perduAvant = false
  endgame.lastCall = false
  endgame.sasVu = 0
  endgame.sasBoitJusqua = -1
  continuerVoulu = false
  btnContinuer.classList.remove('visible')
  endgame.spent = false
  endgame.wasAiming = false
  vortex.timer = 0
  lossPrevLiters = -1
  lossRate = 0
  input.freezeIntent = false
  input.gasIntent = false
  // un éveil en cours reprend du début : la cryostase ressaisit l'échantillon
  if (eveil.etape !== 'off') lanceEveil()
  // chaque début de salle grave la progression de l'expédition principale
  sauveRun()
  applyLevel()
  sim = createSim(level)
  exposeSim()
  resetLasers()
  loop.reset()
  overlay.classList.remove('visible')
  // les déclencheurs (cinématiques, séquences) se réarment à chaque essai
  cinesVues.clear()
  // la mise en scène repart de zéro : lampes rendues, brèches refermées
  sequenceur.reinitialise()
  appliqueSequence()
  if (document.body.classList.contains('playing')) {
    camera.startIntro(sim.bounds, window.innerWidth, window.innerHeight)
    // le RÉVEIL : tirage du petit scénario joué pendant l'intro caméra —
    // chronométré en temps RÉEL, comme le zoom qu'il accompagne
    reveil.actif = true
    reveil.t0 = performance.now() / 1000
    reveil.frissonT = Math.random() < 0.7 ? 0.4 + Math.random() * 1.2 : -1
    reveil.frissonFait = false
    const bv = level.bounds
    reveil.balayageX =
      bv.minX + (0.2 + 0.6 * Math.random()) * (bv.maxX - bv.minX)
    reveil.balayageY =
      bv.minY + (0.2 + 0.6 * Math.random()) * (bv.maxY - bv.minY)
    reveil.bascule = 0.8 + Math.random() * 0.9
    // une vignette physique au réveil, une fois sur deux — le corps se
    // rassemble ou s'étire en sortant de sa torpeur
    if (Math.random() < 0.55) {
      idle.type = Math.random() < 0.5 ? 'toilette' : 'etire'
      idle.t0 = elapsed
    }
    showTableauCard()
    // la cinématique d'ENTRÉE du tableau : à l'arrivée seulement — un R sur
    // place ne la rejoue pas (et MAINTENIR la saute de toute façon)
    if (level !== cineNiveauVu) {
      cineNiveauVu = level
      if (level.cineAvant) void lireCineParCode(level.cineAvant)
    }
    // la SÉQUENCE du tableau démarre à chaque essai : elle fait partie du
    // tableau, pas de l'arrivée — la rejouer après un R est le bon geste
    if (level.sequence) demarreSequence(level.sequence)
  } else {
    camera.snapTo(sim.stats.centroidX, sim.stats.centroidY, camera.zoom)
  }
  majInstrumentsUI()
}

// Nouvelle expédition : retour au premier tableau, réserve vidée, vaisseau
// retiédi. Le protocole recommence avec l'échantillon suivant (§10).
function newExpedition(): void {
  levelIndex = 0
  run.bonbonneLiters = 0
  run.runTime = 0
  run.vies = 1
  run.conclues = 0
  run.instruments = []
  run.xp = 0
  run.livreTotal = 0
  restart()
}

// Fin de run (dernier échantillon dispersé, ou expédition conclue) : le
// laboratoire rappelle — on se réveille AU HUB, prêt à relancer par le sas.
function retourAuLabo(): void {
  levelIndex = 0
  run.bonbonneLiters = 0
  run.runTime = 0
  run.vies = 1
  run.conclues = 0
  run.instruments = []
  run.xp = 0
  run.livreTotal = 0
  run.ended = false
  entrerHub()
  majBoutonsRun()
}
// L'ÉCRAN DE DISPERSION paraît TOUT SEUL, une seconde après la perte du
// corps — le temps de voir le nuage se défaire. Avant, il fallait deviner
// qu'il fallait presser R : la run semblait sans fin, le game over
// « ne fonctionnait pas ». Deux visages selon la réserve d'échantillons :
// « RELANCE » (il en reste) ou « FIN » (c'était le dernier).
let ecranDispersion: 'aucun' | 'relance' | 'fin' = 'aucun'
let dispersionDelai = 0
let perduAvant = false
// Battement avant l'écran, selon CE QUI a été perdu :
// — le corps s'est défait (dispersed) : une seconde, on l'a vu partir ;
// — la RÉSERVE est à sec (endgame.spent) : le corps gelé dérive encore et
//   une paroi peut le renvoyer au sas. On lui laisse ce sursis, puis le
//   protocole conclut. Sans lui, la run ne se terminait JAMAIS : le palet
//   dérivait sans fin et « ÉCHANTILLON PERDU » n'arrivait pas — c'était le
//   game over qui « ne fonctionnait pas ».
const DELAI_DISPERSION = 1.1
const SURSIS_EPUISE = 6

// Sonde de test : l'état de la fin de run depuis la console (comme __run)
const sondeFin = {
  get ecran() {
    return ecranDispersion
  },
  get delai() {
    return dispersionDelai
  },
  get hub() {
    return auHub
  },
  get spent() {
    return endgame.spent
  },
  get lastCall() {
    return endgame.lastCall
  },
  get vise() {
    return input.aimActive
  },
  get collecte() {
    return endgame.enCollecte
  },
  get sortie() {
    return run.exitTimer
  },
  get finie() {
    return run.ended
  },
}
;(window as unknown as { __fin: typeof sondeFin }).__fin = sondeFin

function afficheDispersion(): void {
  if (ecranDispersion !== 'aucun') return
  dispersionDelai = 0
  if (run.vies > 1) {
    ecranDispersion = 'relance'
    showOverlay(
      'ÉCHANTILLON DISPERSÉ',
      `Le laboratoire engage un échantillon de secours — il en restera ${run.vies - 1}. Reprise à la première goutte de la salle.`,
      'danger',
      `REPRENDRE — SALLE ${levelIndex + 1}`,
    )
    return
  }
  // dernier échantillon : GAME OVER — la sauvegarde de la principale
  // s'efface (la run est perdue), la secondaire n'y touche pas
  ecranDispersion = 'fin'
  effaceRun()
  // LE SCÉNARIO : la cinématique de défaite, par-dessus l'écran de fin
  void joueMoment('run-perdue')
  showOverlay(
    'ÉCHANTILLON PERDU — FIN DE LA RUN',
    `La dispersion a eu raison du dernier échantillon. Le laboratoire vous rappelle.`,
    'danger',
    'RETOUR AU LABO',
  )
}

// Abandonner : la run s'arrête là où elle en est et l'on se réveille au
// labo, comme à l'arrivée dans le jeu. L'expédition en cours est perdue
// (c'est un abandon, pas une pause : la fiche sait mettre en pause).
function abandonneRun(): void {
  effaceRun()
  ecranDispersion = 'aucun'
  overlay.classList.remove('visible')
  retourAuLabo()
}

// Recommencer un tableau relance l'essai ; une expédition conclue (bilan
// affiché) ou un échantillon dispersé repart pour une expédition neuve.
// En mode prototype (21-A bis) : l'essai conclu ramène au protocole, la
// dispersion remet l'échantillon en cuve pour un nouvel essai du bis.
function resetAction(): void {
  if (miseEnBonbonne) return // la mise en bonbonne se conclut par une carte
  if (testLevel) {
    if (run.ended) {
      if (fromEditor) {
        openEditor() // l'essai vient de l'éditeur : on y retourne
        return
      }
      if (fromPlanche) {
        retournePlanche() // l'essai vient de la planche : on y retourne
        return
      }
      // la file d'essai continue : le sas mène à la salle suivante —
      // en jouant d'abord les cinématiques qui la précèdent
      if (testQueue.length > 0) {
        joueCinesEnTete(() => {
          const lv = testQueue.shift()
          if (!lv || estCine(lv)) {
            // il ne restait que des cinématiques : la file est finie
            testLevel = null
            newExpedition()
            openHome()
            return
          }
          testLevel = lv
          run.runTime = 0
          restart()
        })
        return
      }
      testLevel = null
      newExpedition()
      openHome()
      return
    }
    run.runTime = 0
    restart()
    return
  }
  if (ecranDispersion !== 'aucun') {
    // l'écran de dispersion est à l'écran : le bouton fait ce qu'il annonce
    const quoi = ecranDispersion
    ecranDispersion = 'aucun'
    overlay.classList.remove('visible')
    if (quoi === 'fin') {
      retourAuLabo()
      return
    }
    // un échantillon de secours prend le relais : retour à la première
    // goutte du tableau — la run continue
    run.vies -= 1
    restart()
    return
  }
  if (auHub) {
    // au hub, rien ne se paie : la dispersion recompose, R recommence
    restart()
    return
  }
  if (run.ended) {
    // expédition conclue : le bilan ramène au labo — le sas relancera
    retourAuLabo()
    return
  }
  if (sim.dispersed) {
    // R pressé avant la fin du battement : l'écran paraît tout de suite
    afficheDispersion()
    return
  }
  restart()
}

document.getElementById('overlay-btn')!.addEventListener('click', resetAction)

const pane = createBench(params, monitor, {
  reset: resetAction,
  autoZoom: () => camera.resetAutoZoom(),
  oeil: { regl: oeilRegl, defauts: OEIL_DEFAUTS, sauve: sauveOeil },
  tableaux: TABLEAUX.map((t) => t.name),
  gotoTableau: (index) => {
    testLevel = null // le banc navigue dans l'expédition, pas dans le prototype
    auHub = false
    fromEditor = false
    levelIndex = index
    restart()
  },
  gotoBis: () => startBisTest(),
  sound: {
    get actif() {
      return audio.enabled
    },
    set actif(v: boolean) {
      audio.resume()
      audio.setEnabled(v)
      if (v) {
        bande.eveiller()
      }
      majInviteSon()
    },
    get volume() {
      return audio.volume
    },
    set volume(v: number) {
      audio.setVolume(v)
    },
  },
})
input.onReset = resetAction
input.onZoom = (factor, cx, cy) =>
  camera.zoomAt(factor, cx, cy, window.innerWidth, window.innerHeight, params)
input.onPan = (dx, dy) => camera.panBy(dx, dy)
input.onPanEnd = (vx, vy) => camera.flingBy(vx, vy)
input.onVortex = (clientX, clientY) => {
  if (params.vortexEnabled < 0.5) return // outil de test, coupé dans le protocole
  const w = camera.screenToWorld(
    clientX,
    clientY,
    window.innerWidth,
    window.innerHeight,
  )
  vortex.x = w.x
  vortex.y = w.y
  vortex.timer = params.vortexDuration
  audio.vortex()
  bande.bruitage('vortex-sas', 0.55)
}

// Barre tactile : les commandes clavier/souris accessibles au doigt
const touchbar = document.getElementById('touchbar') as HTMLDivElement
function touchButton(
  label: string,
  title: string,
  onTap: () => void,
  cls = '',
): HTMLButtonElement {
  const b = document.createElement('button')
  b.textContent = label
  b.title = title
  if (cls) b.className = cls
  b.addEventListener('click', onTap)
  touchbar.appendChild(b)
  return b
}

// Panneaux de lecture : la légende des surfaces et les trois états (qui
// bloque quoi). Chips étiquetées en tête de barre — mises en évidence, sans
// rivaliser avec le sélecteur d'état. Un seul panneau ouvert à la fois.
const legend = document.getElementById('legend') as HTMLDivElement
const statesPanel = document.getElementById('states') as HTMLDivElement
function togglePanel(el: HTMLDivElement, other: HTMLDivElement): void {
  const show = !el.classList.contains('visible')
  other.classList.remove('visible')
  el.classList.toggle('visible', show)
}
const toggleLegend = (): void => togglePanel(legend, statesPanel)
const toggleStates = (): void => togglePanel(statesPanel, legend)
document.getElementById('legend-close')!.addEventListener('click', toggleLegend)
document.getElementById('states-close')!.addEventListener('click', toggleStates)

// Banc de réglage : plus de panneau flottant permanent en haut — le bouton
// BANC de la barre le montre et le masque.
const benchHost = pane.element.closest('.tp-dfwv') as HTMLElement | null
if (benchHost) benchHost.style.display = 'none'
function toggleBench(): void {
  if (!benchHost) return
  benchHost.style.display = benchHost.style.display === 'none' ? '' : 'none'
}

const chipLegend = touchButton(
  'LÉGENDE',
  'légende des surfaces (L)',
  toggleLegend,
  'tb-chip',
)
const chipStates = touchButton(
  'ÉTATS',
  'les trois états : qui bloque quoi (E)',
  toggleStates,
  'tb-chip',
)
const chipBench = touchButton(
  'BANC',
  'banc de réglage : la physique en direct',
  toggleBench,
  'tb-chip',
)
// Retour à l'éditeur : n'apparaît que pendant l'essai d'un tableau édité
const chipEditor = touchButton(
  '↩ ÉDITEUR',
  'revenir à l’éditeur (le tableau est retrouvé tel qu’il était)',
  () => openEditor(),
  'tb-chip tb-editor',
)
chipEditor.style.display = 'none'

// La barre du bas passe sur deux lignes quand elle se remplit (le bouton de
// retour à l'éditeur, par exemple). On publie sa hauteur réelle en variable
// CSS : le sélecteur d'état se recale dessus au lieu de la chevaucher.
function publishTouchbarHeight(): void {
  const h = Math.round(touchbar.getBoundingClientRect().height)
  if (h > 0) document.documentElement.style.setProperty('--tb-h', `${h}px`)
}
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(publishTouchbarHeight).observe(touchbar)
} else {
  window.addEventListener('resize', publishTouchbarHeight)
}
publishTouchbarHeight()
{
  // au doigt, les chips ont leur rangée, les glyphes la leur
  const brk = document.createElement('i')
  brk.className = 'tb-break'
  touchbar.appendChild(brk)
}
const btnPause = touchButton('⏸', 'pause (espace)', () => input.togglePause())
// Le TEMPS en un seul bloc : ralentir · la vitesse courante · accélérer.
// La vitesse est une INFO permanente (elle s'allume dès qu'on quitte ×1),
// et le groupe reste au doigt — savoir à quelle vitesse on joue n'est pas
// un réglage de banc.
const tbTime = document.createElement('div')
tbTime.id = 'tb-time'
touchbar.appendChild(tbTime)
const timeButton = (
  label: string,
  title: string,
  onTap: () => void,
): HTMLButtonElement => {
  const b = document.createElement('button')
  b.textContent = label
  b.title = title
  b.addEventListener('click', onTap)
  tbTime.appendChild(b)
  return b
}
timeButton('‹', 'ralentir le temps (,)', () => input.stepWarp(-1))
const tbSpeed = document.createElement('span')
tbSpeed.id = 'tb-speed'
tbSpeed.textContent = '×1'
tbSpeed.title = 'vitesse du temps simulé'
tbTime.appendChild(tbSpeed)
timeButton('›', 'accélérer le temps (.)', () => input.stepWarp(1))
const btnVortex = touchButton(
  '🌀',
  'vortex : armer puis toucher l’écran (clic droit)',
  () => {
    input.vortexArmed = !input.vortexArmed
  },
  'tb-vortex',
)

// Sélecteur d'état (EAU / GLACE / VAPEUR) : la commande centrale du jeu
const stateEau = document.getElementById('state-eau') as HTMLButtonElement
const stateGlace = document.getElementById('state-glace') as HTMLButtonElement
const stateVapeur = document.getElementById('state-vapeur') as HTMLButtonElement
stateEau.addEventListener('click', () => {
  input.freezeIntent = false
  input.gasIntent = false
})
stateGlace.addEventListener('click', () => input.toggleFreeze())
stateVapeur.addEventListener('click', () => input.toggleGas())

// ---- L'ÉVEIL : la prise en main scénarisée ------------------------------
// Trois temps, diégétiques. (1) Sortie de cryostase : le corps est GLACE
// depuis le chargement, le plan large se joue, puis une carte pose l'état —
// pas de direction, l'élan se conserve, et un mystère qui donne envie.
// (2) L'invite plane au-dessus du corps : redevenir liquide (💧 / F), le
// bouton d'interface pulse — le DÉGEL est la réponse, pas un clic de plus.
// (3) Une dizaine d'impulsions données (appui puis relâcher), une carte scelle la
// leçon du VOLUME. La clé CLE_EVEIL mémorise le passage ; PARAMÈTRES →
// REFAIRE LA PRISE EN MAIN la rejoue sur le tableau en cours.
const eveil1El = document.getElementById('eveil1') as HTMLDivElement
const eveil2El = document.getElementById('eveil2') as HTMLDivElement
const eveilInviteEl = document.getElementById('eveil-invite') as HTMLDivElement
type EveilEtape =
  | 'off'
  | 'zoom'
  | 'annonce1' // le monde décélère : la carte de cryostase s'annonce
  | 'glace'
  | 'invite'
  | 'gestes'
  | 'annonce2' // idem avant la carte du volume — jamais d'apparition sèche
  | 'volume'
// ralenti : le facteur de temps de l'éveil (1 = temps normal). Quand une
// carte s'annonce, la CIBLE descend vers ~0 et le monde décélère en douceur
// (même levier que le slow-mo de visée vapeur) ; la carte ne paraît qu'une
// fois le monde presque figé, en fondu. À la fermeture, la cible remonte :
// le monde se réveille progressivement au lieu de repartir d'un coup.
const eveil = {
  etape: 'off' as EveilEtape,
  gestes: 0,
  visePrec: false,
  ralenti: 1,
  cible: 1,
}
// Sonde de test : suivre l'éveil depuis la console (comme __sim, __cam)
;(window as unknown as { __eveil: typeof eveil }).__eveil = eveil
function lanceEveil(): void {
  if (localStorage.getItem(CLE_EVEIL)) return
  // relance propre (restart en plein éveil) : tout voile retombe d'abord
  for (const carte of [eveil1El, eveil2El]) {
    carte.hidden = true
    carte.classList.remove('montre')
  }
  eveilInviteEl.hidden = true
  stateEau.classList.remove('eveil-appel')
  input.gelees = false
  eveil.etape = 'zoom'
  eveil.gestes = 0
  eveil.ralenti = 1
  eveil.cible = 1
  // la cryostase tient l'échantillon : GLACE, quel que soit l'état d'avant
  input.freezeIntent = true
  input.gasIntent = false
}
function carteEveil(carte: HTMLDivElement, montrer: boolean): void {
  if (montrer) {
    carte.dataset.mode = obTactile() ? 'tactile' : 'pc'
    // fondu d'entrée : le voile paraît transparent, la classe « montre »
    // (posée à l'image suivante) lance la transition — jamais d'apparition sèche
    carte.hidden = false
    requestAnimationFrame(() => carte.classList.add('montre'))
  } else {
    // fondu de sortie : la classe s'en va, le voile s'efface, puis se cache
    carte.classList.remove('montre')
    window.setTimeout(() => {
      carte.hidden = true
    }, 600)
  }
  // les cartes figent tout, comme la prise en main : lecture au calme
  input.paused = montrer
  input.gelees = montrer
}
function avanceEveil(): void {
  if (eveil.etape === 'glace') {
    carteEveil(eveil1El, false)
    eveil.cible = 1 // le monde se réveille en douceur derrière le fondu
    eveil.etape = 'invite'
    eveilInviteEl.dataset.mode = obTactile() ? 'tactile' : 'pc'
    eveilInviteEl.hidden = false
    stateEau.classList.add('eveil-appel')
  } else if (eveil.etape === 'volume') {
    carteEveil(eveil2El, false)
    eveil.cible = 1
    eveil.etape = 'off'
    try {
      localStorage.setItem(CLE_EVEIL, '1')
    } catch {
      // stockage refusé : l'éveil se rejouera, sans gravité
    }
  }
}
for (const carte of [eveil1El, eveil2El]) {
  // le voile ÉCRANTE (rien ne traverse vers le jeu) mais n'avance pas :
  // seul le bouton CONTINUER / PLONGER tourne la page — pas de carte
  // sautée par un clic malheureux (à la manette, A reste le bouton)
  carte.addEventListener('pointerdown', (e) => e.stopPropagation())
  carte.querySelector('.ev-continuer')?.addEventListener('click', avanceEveil)
}
// Appelé chaque image (après la caméra) : fait avancer l'éveil au rythme
// de ce que fait réellement le joueur — pas de minuteries arbitraires.
function majEveil(dtReal: number): void {
  // le facteur de temps poursuit sa cible même hors éveil (le réveil du
  // monde après la dernière carte doit finir sa rampe) — descente vive
  // (~0,5 s), remontée plus paresseuse (~1 s) : on se réveille, on ne sursaute pas
  if (eveil.ralenti !== eveil.cible) {
    const k = 1 - Math.exp(-dtReal * (eveil.cible < eveil.ralenti ? 5 : 2.5))
    eveil.ralenti += (eveil.cible - eveil.ralenti) * k
    if (Math.abs(eveil.ralenti - eveil.cible) < 0.005)
      eveil.ralenti = eveil.cible
  }
  if (eveil.etape === 'off' || !document.body.classList.contains('playing'))
    return
  if (eveil.etape === 'zoom') {
    // le plan large d'abord — la salle se lit — puis le monde décélère
    if (!camera.introEnCours) {
      eveil.etape = 'annonce1'
      eveil.cible = 0.04
    }
  } else if (eveil.etape === 'annonce1') {
    // la carte ne paraît qu'une fois le monde presque figé : le ralenti
    // EST l'annonce — l'œil comprend qu'il se passe quelque chose
    if (eveil.ralenti < 0.09) {
      eveil.etape = 'glace'
      carteEveil(eveil1El, true)
    }
  } else if (eveil.etape === 'invite') {
    // l'invite plane au-dessus du corps et suit sa dérive
    const vw = window.innerWidth
    const vh = window.innerHeight
    const sx = vw * 0.5 + (sim.stats.centroidX - camera.x) * camera.zoom
    const sy =
      vh * 0.5 -
      (sim.stats.centroidY - camera.y) * camera.zoom -
      sim.stats.rmsRadius * camera.zoom -
      14
    const ax = Math.min(vw - 30, Math.max(30, sx))
    const ay = Math.min(vh - 120, Math.max(96, sy))
    eveilInviteEl.style.transform = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px) translate(-50%, -100%)`
    if (!input.freezeIntent) {
      // le dégel EST la réponse : l'invite s'efface, place aux impulsions
      eveilInviteEl.hidden = true
      stateEau.classList.remove('eveil-appel')
      eveil.etape = 'gestes'
      eveil.gestes = 0
      eveil.visePrec = input.aimActive
    }
  } else if (eveil.etape === 'gestes') {
    // une DIZAINE d'impulsions complètes (appui puis relâcher) : on laisse
    // vraiment jouer — sentir le volume qui part, essayer, se tromper —
    // puis la carte vient nommer ce qu'on vient de vivre
    if (eveil.visePrec && !input.aimActive) {
      eveil.gestes++
      if (eveil.gestes >= 10) {
        eveil.etape = 'annonce2'
        eveil.cible = 0.04
      }
    }
    eveil.visePrec = input.aimActive
  } else if (eveil.etape === 'annonce2') {
    if (eveil.ralenti < 0.09) {
      eveil.etape = 'volume'
      carteEveil(eveil2El, true)
    }
  }
}
touchButton('⌖', 'recadrer sur le corps (zoom et caméra auto)', () =>
  camera.resetAutoZoom(),
)
const btnSound = touchButton(
  '🔊',
  'son : couper / activer',
  () => {
    audio.resume()
    audio.setEnabled(!audio.enabled)
    if (audio.enabled) {
      bande.eveiller()
    }
    majInviteSon()
    pane.refresh()
  },
  'tb-snd', // masqué au doigt : la bascule du son reste au banc (dossier Son)
)
touchButton('↺', 'recommencer (R)', resetAction)
touchButton('≡', 'fiche d’essai (échap)', openHome)
input.onTimeWarpChange = (warp) => {
  params.timeWarp = warp
  majVitesse()
  pane.refresh()
}
// La vitesse affichée (barre + HUD) : mise à jour au changement ET à chaque
// image (le banc peut aussi changer timeWarp par ses curseurs)
function majVitesse(): void {
  const w = params.timeWarp
  const txt = `×${w}`
  if (tbSpeed.textContent !== txt) tbSpeed.textContent = txt
  tbSpeed.classList.toggle('actif', w !== 1)
}

const overlayBtn = document.getElementById('overlay-btn') as HTMLButtonElement
// Relance discrète : elle n'apparaît qu'une fois la dernière impulsion donnée,
// et ne recouvre rien — on peut la laisser là et regarder la dérive finir.
// Pastilles du HUD : un toucher montre le nom de la donnée, brièvement
for (const chip of Array.from(
  document.querySelectorAll<HTMLButtonElement>('.hud-chip'),
)) {
  chip.addEventListener('click', () => {
    chip.classList.add('ouvert')
    window.setTimeout(() => chip.classList.remove('ouvert'), 2400)
  })
}

const btnRelance = document.getElementById('relance') as HTMLButtonElement
// Continuer : le corps principal est bu, le joueur conclut quand il veut
const btnContinuer = document.getElementById('continuer') as HTMLButtonElement
let continuerVoulu = false
// le passage auto à l'état gazeux (chaudière) : armé tant que le corps
// n'a pas déjà déclenché — réarmé quand il ressort de l'aura
let autoGazArme = true
// la zone forcée actuellement TENUE par le corps (déclenchée à 95 %,
// relâchée sous 85 %) — l'état, lui, persiste à la sortie
let zoneTenue: number | null = null
btnContinuer.addEventListener('click', () => {
  continuerVoulu = true
  btnContinuer.classList.remove('visible')
})
// Le tableau seul reprend : la réserve déjà en bonbonne et le refroidissement
// du vaisseau, eux, ne se rembobinent pas — sinon la pression n'existerait plus.
// « J'en reste là » : en RUN, ce bouton ne rejoue pas la salle gratuitement
// (les échantillons de secours n'auraient plus de sens) — il conclut, et
// l'écran de fin décide : un secours engagé, ou la fin de la run. Au labo,
// dans un essai ou un tableau d'éditeur, il relance simplement.
btnRelance.addEventListener('click', () => {
  if (!testLevel && !auHub && !run.ended) {
    afficheDispersion()
    return
  }
  restart()
})
// ---- Tutoriel diégétique (tableau 1, première partie seulement) ----
// Les consignes du protocole apparaissent au bon moment, se valident par le
// geste qu'elles enseignent, et ne reviennent plus (localStorage). Les deux
// dernières sont contextuelles : l'éponge à l'approche, le sas à l'arrivée.
const TUTOR_KEY = 'projet21.tutoriel.v1'
const tutorEl = el('tutor')
let tutorActive = true
try {
  tutorActive = localStorage.getItem(TUTOR_KEY) !== 'ok'
} catch {
  // stockage indisponible : le tutoriel s'affiche à chaque visite, sans gravité
}
let tutorStep = 0
let tutorTimer = 0
let tutorEjectHeld = 0
let tutorShown = ''

const TUTOR_TEXTS = [
  'Maintenez le doigt (ou le pointeur) : la matière est éjectée <em>vers</em> lui — le corps part à l’opposé. Il n’y a pas de frein.',
  'Chaque goutte éjectée est perdue. La jauge en haut est votre corps : sous le trait rouge, il ne reste qu’une impulsion. <strong>Se déplacer, c’est rétrécir.</strong>',
  '<kbd>❄ / F</kbd> se changer en glace : l’élan se garde, re-presser dégèle. <kbd>💨 / G</kbd> vapeur : visez (le temps ralentit), relâchez — le nuage fuse, plus loin le doigt, plus fort le dash. Un tiers du volume à chaque fois. Essayez l’un des deux.',
  'L’éponge boit ce qui s’attarde à son contact. Passez vite, payez le passage en volume — ou cherchez la vapeur.',
  'Le sas aspire l’échantillon : laissez-vous boire. Le surplus part en bonbonne — la récompense, c’est ce qu’il vous reste.',
]

// Sonde de débogage/test : l'état du tutoriel depuis la console
;(window as unknown as { __tutor: () => object }).__tutor = () => ({
  active: tutorActive,
  step: tutorStep,
  held: tutorEjectHeld,
  timer: tutorTimer,
  aim: input.aimActive,
})

function tutorPersist(): void {
  try {
    localStorage.setItem(TUTOR_KEY, 'ok')
  } catch {
    // sans gravité
  }
}

function updateTutor(dtReal: number): void {
  // Bandeaux CONSIGNE DU PROTOCOLE désactivés (même retour joueur que le
  // carton) : l'onboarding gestuel du premier lancement suffit.
  if (tutorShown !== '') {
    tutorShown = ''
    tutorEl.classList.remove('visible')
  }
  if (true) return
  if (
    !tutorActive ||
    testLevel !== null ||
    levelIndex !== 0 ||
    sim.dispersed ||
    run.ended ||
    tutorStep >= TUTOR_TEXTS.length
  ) {
    if (tutorShown !== '') {
      tutorShown = ''
      tutorEl.classList.remove('visible')
    }
    return
  }
  const playing = document.body.classList.contains('playing') && !input.paused
  const cardVisible = tableauCard.classList.contains('visible')
  if (playing && input.aimActive) tutorEjectHeld += dtReal

  // conditions de validation de l'étape courante
  if (tutorStep === 0 && tutorEjectHeld > 1.2) {
    tutorStep = 1
    tutorTimer = 0
  } else if (tutorStep === 2 && (input.freezeIntent || input.gasIntent)) {
    tutorStep = 3
    tutorTimer = 0
    tutorPersist() // le cœur est acquis : plus de tutoriel aux prochaines visites
  }

  // texte à montrer (les étapes 3 et 4 sont contextuelles)
  let text = ''
  if (playing && !cardVisible) {
    if (tutorStep <= 2) {
      text = TUTOR_TEXTS[tutorStep]
    } else if (tutorStep === 3) {
      // à l'approche du mur d'éponge du tableau 1 (x = 560)
      if (sim.stats.centroidX > 60 && sim.stats.centroidX < 560)
        text = TUTOR_TEXTS[3]
    } else if (tutorStep === 4) {
      const d = Math.hypot(
        sim.stats.centroidX - exitMouth.x,
        sim.stats.centroidY - exitMouth.y,
      )
      if (d < Math.max(320, params.exitRadius * 1.6)) text = TUTOR_TEXTS[4]
    }
  }

  // écoulement du temps sur les étapes à durée
  if (text !== '') {
    tutorTimer += dtReal
    if (tutorStep === 1 && tutorTimer > 6) {
      tutorStep = 2
      tutorTimer = 0
    } else if (tutorStep === 2 && tutorTimer > 22) {
      tutorStep = 3 // on n'insiste pas : la consigne a été lue
      tutorTimer = 0
      tutorPersist()
    } else if (tutorStep === 3 && tutorTimer > 7) {
      tutorStep = 4
      tutorTimer = 0
    } else if (tutorStep === 4 && tutorTimer > 7) {
      tutorStep = 5
    }
  }

  if (text !== tutorShown) {
    tutorShown = text
    if (text !== '') {
      tutorEl.innerHTML = `<span class="consigne">CONSIGNE DU PROTOCOLE</span>${text}`
      tutorEl.classList.add('visible')
    } else {
      tutorEl.classList.remove('visible')
    }
  }
}

function htmlSafe(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function showOverlay(
  title: string,
  sub: string,
  tone: 'success' | 'danger',
  btn?: string,
): void {
  overlayTitle.textContent = title
  overlaySub.innerHTML = sub
  overlay.classList.remove('success', 'danger', 'end')
  overlay.classList.add('visible', tone)
  if (btn) {
    overlay.classList.add('end')
    overlayBtn.textContent = btn
  }
}

// Bilan d'expédition : la phrase que le tampon raconte au protocole
function expeditionSummary(tableauxDone: number): string {
  return `${tableauxDone}/${playedLevels().length} salles · 💧 ${fmtL(run.livreTotal)} · ⏱ ${fmtDuree(run.runTime)}`
}

let lastTime = performance.now()
let elapsed = 0
let fpsSmoothed = 60
// Débit de perte lissé (litres par seconde simulée) : ce que l'action en
// cours coûte au corps — éjection, coût d'état vapeur, éponge, radiateur.
let lossPrevLiters = -1
let lossPrevT = 0
let lossRate = 0

// Qualité adaptative : si la machine ne suit pas, on baisse la résolution de
// rendu (densité de pixels, puis champ métaballes plus grossier). La physique
// n'est jamais dégradée — sous forte charge, le jeu ralentit doucement
// (plafond de pas par image) au lieu de saccader.
const QUALITY_LEVELS = [
  { dprCap: 2, down: 2 },
  { dprCap: 1.5, down: 2 },
  { dprCap: 1.25, down: 3 },
  { dprCap: 1, down: 3 },
  { dprCap: 0.8, down: 4 },
  { dprCap: 0.65, down: 4 }, // palier de secours : écrans très denses (iPad) qui chauffent
]
let qualityLevel = window.matchMedia('(pointer: coarse)').matches ? 1 : 0
// L'objectif est 60 CONSTANT, pas « au-dessus de 42 » : sous 55 fps, la
// qualité descend vite (1,2 s de confirmation) ; elle ne remonte qu'après
// 5 s bien au-dessus de l'objectif — l'asymétrie évite le clignotement
// qualité haute ↔ basse autour du seuil.
let qualitySous = 0 // s passées sous l'objectif
let qualitySur = 0 // s passées avec de la marge
function updateQuality(dtReal: number): void {
  // Résolution FIXE choisie (voile PARAMÈTRES) : l'échelle est constante,
  // aucun palier adaptatif ne s'applique — pas de yo-yo visuel.
  if (!resDynamique()) {
    qualityLevel = 0
    return
  }
  // La qualité vise la cadence VERROUILLÉE (bornée à 60 : le rendu est
  // taillé pour 60 — au-delà, l'écran rapide profite du surplus sans que
  // la qualité ne se sacrifie pour courir après 120).
  const cible = Math.min(fpsCap, 60)
  if (fpsSmoothed < cible * (55 / 60)) {
    qualitySous += dtReal
    qualitySur = 0
  } else if (fpsSmoothed > cible * (58.5 / 60)) {
    qualitySur += dtReal
    qualitySous = 0
  } else {
    qualitySous = 0
    qualitySur = 0
  }
  if (qualitySous > 1.2 && qualityLevel < QUALITY_LEVELS.length - 1) {
    qualityLevel++
    qualitySous = 0
  } else if (qualitySur > 5 && qualityLevel > 0) {
    qualityLevel--
    qualitySur = 0
  }
}

let tickPrecedent = 0
function frame(now: number): void {
  // chaque rappel rAF, rendu OU sauté, date l'horloge de l'écran : le
  // collecteur en tire le Hz réel du panneau (adaptatif sur mobile)
  if (tickPrecedent > 0) perf.tick(now - tickPrecedent)
  tickPrecedent = now
  // Verrou de fréquence : l'image d'avance est SAUTÉE (rien n'est simulé ni
  // rendu — dtReal la rattrapera). Cadencement à DETTE CONSERVÉE : l'horloge
  // avance d'une période exacte, pas jusqu'à `now` — sinon le verrou cale
  // sur un sous-multiple de l'écran (60 demandés sur un 144 Hz donnaient
  // 48 im/s : chaque image « en avance » repoussait toute la grille).
  const periode = 1000 / fpsCap
  if (now - fpsCapPrecedent < periode - 1) {
    requestAnimationFrame(frame)
    return
  }
  fpsCapPrecedent += periode
  // jamais plus d'une période de dette : une pause (onglet caché) ne
  // déclenche pas une rafale de rattrapage
  if (now - fpsCapPrecedent > periode) fpsCapPrecedent = now
  const dtBrutMs = now - lastTime // non plafonné : la VRAIE durée, pour le rapport
  const frameT0 = performance.now() // départ du CPU de cette frame (collecteur)
  const dtReal = Math.min((now - lastTime) / 1000, 0.1)
  lastTime = now
  elapsed += dtReal
  if (dtReal > 0) fpsSmoothed += (1 / dtReal - fpsSmoothed) * 0.05

  updateQuality(dtReal)
  const quality = QUALITY_LEVELS[qualityLevel]
  const vw = window.innerWidth
  const vh = window.innerHeight
  // l'échelle fixe choisie s'applique ici : seul le canvas est mis à
  // l'échelle, l'interface HTML reste à la netteté native
  const dpr =
    Math.min(window.devicePixelRatio || 1, quality.dprCap) *
    RES_ECHELLES[resChoix]
  // mesures brutes de CETTE image, pour le collecteur de performance
  let physRaw = 0
  let stepsFaits = 0

  // ---- Manette : elle écrit dans le même pointeur que le doigt ----
  manettePolls++
  manettePollNow = performance.now() / 1000
  manette.poll(manettePollNow)
  if (manette.connectee) {
    const enJeu = document.body.classList.contains('playing')
    // l'écran de menu au-dessus, s'il y en a un — codex, sous-menus de la
    // fiche, cérémonie, fiche elle-même… B y est TOUJOURS le retour
    const couche = coucheMenuActive()
    // une couche LÉGÈRE (légende, états, instruments — ouvertes en pleine
    // partie) : B la referme et se consume, le jeu garde tout le reste
    let bConsomme = false
    if (couche?.legere) {
      // le stick droit défile le panneau (la caméra lui cède le geste)
      defileCouche(couche, dtReal)
      if (manette.edge(BOUTON.B)) {
        navigueMenu(couche, dtReal)
        bConsomme = true
      }
    }
    if (!onboardEl.hidden) {
      // prise en main à l'écran : A avance les cartes, rien d'autre ne passe
      if (manette.edge(BOUTON.A)) avanceOnboard()
    } else if (!eveil1El.hidden || !eveil2El.hidden) {
      // cartes de l'éveil : A tourne la page, rien d'autre ne passe
      if (manette.edge(BOUTON.A)) avanceEveil()
    } else if (
      editeurHote.classList.contains('visible') &&
      (!couche || couche.id === 'home')
    ) {
      // l'ÉDITEUR : le stick gauche (ou le pavé gauche en joystick) défile
      // ses panneaux. La fiche SOUS l'éditeur ne prend pas la main — mais
      // une couche posée SUR lui (la planche, le montage…) la garde.
      defileEditeur(dtReal)
    } else if (couche && !couche.legere) {
      // un MENU au premier plan : croix/stick naviguent, A active, B revient
      navigueMenu(couche, dtReal)
    } else if (manette.edge(BOUTON.A) && clicMenuManette()) {
      // écrans de jeu (relance, fin de tableau) : le clic a consommé le A
    } else if (enJeu) {
      // ☰ (Start) : pause ET menu — la fiche fige l'essai en s'ouvrant
      if (manette.edge(BOUTON.START)) openHome()
      // SELECT : recommencer — sauf pendant le toast d'une fiche codex, où
      // il VISITE la fiche (l'invite du toast l'annonce)
      if (manette.edge(BOUTON.SELECT)) {
        const fiche = tropheeToast.classList.contains('visible')
          ? tropheeToast.dataset.fiche
          : undefined
        if (fiche) {
          tropheeToast.classList.remove('visible')
          ouvreCodexSur(fiche)
        } else {
          input.onReset?.()
        }
      }
      // le temps aux épaules : LB ralentit, RB accélère (la croix ↔ aussi)
      if (manette.edge(BOUTON.LB)) input.stepWarp(-1)
      if (manette.edge(BOUTON.RB)) input.stepWarp(1)
      // les trois états sur les trois boutons restants : X glace, Y vapeur,
      // B retour à l'eau — A reste la main qui agit
      if (manette.edge(BOUTON.X)) {
        if (input.gasIntent) input.toggleGas()
        input.toggleFreeze()
      }
      if (manette.edge(BOUTON.Y)) {
        if (input.freezeIntent) input.toggleFreeze()
        input.toggleGas()
      }
      if (!bConsomme && manette.edge(BOUTON.B)) {
        // retour à l'eau, quel que soit l'état — sauf si B vient de
        // refermer un panneau léger (légende, états, instruments)
        if (input.freezeIntent) input.toggleFreeze()
        else if (input.gasIntent) input.toggleGas()
      }
      if (manette.edge(BOUTON.GAUCHE)) input.stepWarp(-1)
      if (manette.edge(BOUTON.DROITE)) input.stepWarp(1)
      // enfoncer un stick recadre : la caméra revient au suivi automatique
      if (manette.edge(BOUTON.L3) || manette.edge(BOUTON.R3))
        camera.resetAutoZoom()
      if (manette.zoomAvant) camera.zoomBy(Math.pow(1.9, dtReal), params)
      if (manette.zoomArriere) camera.zoomBy(Math.pow(1.9, -dtReal), params)
      // les grosses gâchettes zooment, la pression dose la vitesse
      if (manette.rtVal > 0.02)
        camera.zoomBy(Math.pow(2.2, manette.rtVal * dtReal), params)
      if (manette.ltVal > 0.02)
        camera.zoomBy(Math.pow(2.2, -manette.ltVal * dtReal), params)
      if (!couche && (manette.panX !== 0 || manette.panY !== 0)) {
        // pousser à droite REGARDE à droite (le pan de drag est inversé) —
        // sauf panneau ouvert : le stick droit y DÉFILE, la caméra cède
        camera.panBy(-manette.panX * 900 * dtReal, -manette.panY * 900 * dtReal)
      }
      // viser et agir — seulement si la manette a parlé plus récemment que
      // la souris, et qu'aucun doigt n'est posé. Le STICK dit où l'on veut
      // ALLER : en eau, l'éjection part automatiquement à l'opposé (c'est
      // elle qui pousse) ; en vapeur, le dash part dans la direction du stick.
      if (
        input.touchCount === 0 &&
        manette.lastActivity > input.lastPointerAt
      ) {
        const scx = vw * 0.5 + (sim.stats.centroidX - camera.x) * camera.zoom
        const scy = vh * 0.5 - (sim.stats.centroidY - camera.y) * camera.zoom
        // pleine inclinaison = pleine puissance de dash ; un plancher garde
        // la direction lisible même stick à peine poussé
        const rPx =
          (0.15 + 0.85 * manette.force) * params.gasDashRange * camera.zoom
        const sens = input.gasIntent ? 1 : -1 // eau : le point d'éjection est derrière
        manetteCurseur.x = scx + manette.dirX * rPx * sens
        manetteCurseur.y = scy + manette.dirY * rPx * sens
        if (manette.agit) {
          input.aimActive = true
          input.aimClientX = manetteCurseur.x
          input.aimClientY = manetteCurseur.y
          manetteTenait = true
        } else if (manetteTenait) {
          manetteTenait = false
          input.aimActive = false
        } else if (manette.active) {
          // le curseur suit même sans presser : la visée se prépare
          input.aimClientX = manetteCurseur.x
          input.aimClientY = manetteCurseur.y
        }
      } else if (manetteTenait) {
        // la souris a repris la main en pleine action manette : on relâche
        manetteTenait = false
        input.aimActive = false
      }
    }
  }

  const aim = camera.screenToWorld(input.aimClientX, input.aimClientY, vw, vh)
  const tableauDone = run.exitTimer > 0 || run.ended || miseEnBonbonne

  // Zones d'état (refonte 2026) : une zone impose un état et verrouille le
  // sélecteur tant qu'on y est. L'intention du joueur est écrasée, pas effacée
  // — en ressortant, il retrouve l'état qu'il avait choisi.
  // Règle du 12/08 : une zone n'impose son état que lorsque 95 % du CORPS
  // ACTIF (les particules joueur — les gouttes éjectées ne comptent pas)
  // est dedans ; elle le tient ensuite jusqu'à retomber sous 85 %.
  const zonesForcees = (level.zones ?? [])
    .map((z, i) => ({ z, i }))
    .filter((e) => e.z.force !== 'libre')
  let zoneActive: ZoneForce = 'libre'
  if (zonesForcees.length > 0 && sim.playerCount > 0) {
    let bestFrac = 0
    let bestI = -1
    for (const e of zonesForcees) {
      let dedans = 0
      for (let i = 0; i < sim.count; i++) {
        if (sim.kind[i] !== KIND_PLAYER) continue
        // TOUT le rectangle déclaré compte : la lisière ondulée n'est que le
        // dessin (inscrite, sa bande morte au ras des parois posées en bord
        // de zone rendait les 95 % inatteignables — l'eau plaquée contre le
        // mur était « dehors » sans que rien ne le montre)
        const x = sim.posX[i]
        const y = sim.posY[i]
        if (x >= e.z.minX && x <= e.z.maxX && y >= e.z.minY && y <= e.z.maxY)
          dedans++
      }
      const f = dedans / sim.playerCount
      if (f > bestFrac) {
        bestFrac = f
        bestI = e.i
      }
    }
    const seuil = zoneTenue === bestI ? 0.85 : 0.95
    if (bestI >= 0 && bestFrac >= seuil) {
      zoneTenue = bestI
      zoneActive = (level.zones ?? [])[bestI].force
    } else {
      zoneTenue = null
    }
  } else {
    zoneTenue = null
  }
  if (zoneActive !== 'libre') {
    input.freezeIntent = zoneActive === 'glace'
    input.gasIntent = zoneActive === 'vapeur'
  }
  sim.freezeIntent = input.freezeIntent
  sim.gasIntent = input.gasIntent
  // La BASCULE en vapeur — G, chaudière à 95 %, zone forcée : toute cause —
  // se règle à l'instant du basculement : péage de 20 % du volume actif
  // (gerbe de gouttes récupérables). Le compteur de dashs, lui, ne bouge
  // PAS : la réserve appartient au TABLEAU (pleine au chargement) — bascule
  // décidée, chaudière ou zone, aucune transformation n'en rend ni n'en
  // prend. Seul le surchauffeur recharge, dans la limite de la réserve.
  // Et un tableau qui COMMENCE en vapeur ne bascule pas : c'est son état de
  // départ. Ni péage, ni événement — le corps naît nuage, avec sa réserve
  // (createSim l'a remplie), sans qu'on lui prenne un cinquième de lui-même.
  if (input.gasIntent && !gasIntentAvant && !tableauDone && !input.paused) {
    // l'état de départ, c'est la PREMIÈRE prise de la zone, au tout début du
    // tableau : une bascule décidée plus tard (touche G) se paie et rend ses
    // dashs normalement, même dans un tableau né en vapeur
    const etatDeDepart =
      departEnVapeur && zoneActive === 'vapeur' && run.tableauTime < 3
    departEnVapeur = false
    if (!etatDeDepart) sim.transfoVapeur()
  }
  gasIntentAvant = input.gasIntent

  sim.chill = chillNow() // le vaisseau refroidit : la physique suit
  if (input.aimActive) camera.cancelIntro() // le joueur agit : la caméra suit

  // ---- Dash de vapeur (« air dash ») : viser RALENTIT fortement le temps
  // (physique, refroidissement, chrono — tout suit, rien ne se fige),
  // relâcher lance le nuage vers le point visé. Une impulsion unique — pas
  // de recul, pas d'éjection ; la DISTANCE du doigt règle la puissance.
  const vif = !input.paused && !tableauDone && !sim.dispersed && !endgame.spent
  const dashAiming = vif && input.gasIntent && input.aimActive
  // Le ralenti s'entend : tout le mixage plonge sous un passe-bas (et
  // baisse de moitié), un cœur au ralenti bat, la texture du temps suspendu
  // s'ouvre — seule à rester nette —, et l'air revient au dash.
  // (le ralenti d'annonce de l'éveil s'entend aussi : même texture suspendue)
  audio.setSlowMo(dashAiming || eveil.ralenti < 0.7)
  bande.setSuspendu(dashAiming || eveil.ralenti < 0.7)
  if (dash.aiming && !dashAiming) {
    // Relâcher déclenche ; changer d'état ou perdre la main en pleine visée
    // annule sans frais — la visée n'engage à rien tant qu'on n'a pas lâché.
    // Un second doigt posé (pincement pour zoomer) ANNULE la visée : elle ne
    // conclut pas. Sans ça, dézoomer en vapeur lâchait le dash.
    if (vif && input.gasIntent && !input.aimActive && !input.aimAnnulee) {
      const spent = sim.gasDash(aim.x, aim.y)
      if (spent > 0) manette.rumble(0.6, 90) // le dash se voit, il ne souffle plus
    }
  }
  dash.aiming = dashAiming

  // ---- Impulsion SANS direction : le geste se retourne vers soi ----
  // Stick au neutre (manette), ou doigt/pointeur posé SUR le corps : au lieu
  // d'éjecter au petit bonheur, le corps se RASSEMBLE autour de son centre —
  // l'anti-dispersion, gratuite (rien ne part, rien ne se paie).
  const rassembler =
    input.aimActive &&
    !input.gasIntent &&
    !sim.dispersed &&
    ((manetteTenait && manette.force < 0.02) ||
      corpsSousLePointeur(aim.x, aim.y))
  ;(window as unknown as { __rass: boolean }).__rass = rassembler // sonde de test

  if (!input.paused && !tableauDone) {
    // Budget CPU des pas physiques : ~60 % du temps d'image, borné à 5-12 ms.
    // Sans cette borne, une image en retard impose plus de pas, coûte plus
    // cher, prend plus de retard — et la machine s'installe à 15-20 fps.
    // ACCÉLÉRER étend le budget d'autant : le joueur qui met ×4 achète des
    // pas de simulation contre des images par seconde — sans cela, sur une
    // machine au taquet, le HUD affichait ×4 et la cuve restait à ×1.
    // le ralenti d'annonce de l'éveil multiplie le temps comme le slow-mo
    // de visée : physique, chrono, refroidissement — tout décélère ensemble
    const warpNow =
      (dashAiming ? params.timeWarp * params.gasAimSlow : params.timeWarp) *
      eveil.ralenti
    const boost = Math.max(1, warpNow)
    // Troisième borne (retour joueur : « en accélérant, chutes drastiques ») :
    // la physique ne dépasse JAMAIS ~70 % de la période du verrou, même
    // accélérée. Machine rapide : ×4 tient en 6-8 ms, plein régime inchangé.
    // Machine juste : l'accélération plafonne d'elle-même — le temps avance
    // aussi vite que la machine le permet SANS casser la cadence, au lieu
    // d'afficher ×4 à 25 im/s. Le plancher 5 ms garantit le pas minimal.
    const bornePeriode = Math.max(5, (1000 / fpsCap) * 0.7)
    const stepBudget = Math.min(
      12 * boost,
      Math.max(5, dtReal * 1000 * 0.6 * boost),
      bornePeriode,
    )
    // FLUIDITÉ : plafond de pas au régime de croisière (cadence lissée,
    // bornée par le verrou) — l'accroc ne se paie qu'une fois. TEMPS RÉEL :
    // pas de plafond (le budget CPU reste seul juge), comportement historique.
    const periodeCroisiere = Math.min(
      50,
      Math.max(1000 / fpsCap, fpsSmoothed > 1 ? 1000 / fpsSmoothed : 1000 / 60),
    )
    const plafondPas = rattrapageFluide
      ? Math.max(
          1,
          Math.ceil(((periodeCroisiere / 1000) * warpNow) / params.dt - 0.05),
        )
      : Number.POSITIVE_INFINITY
    // L'anti-domino (plafond de pas au régime de croisière) a été ESSAYÉ
    // puis débranché : au ressenti sur machine réelle, l'abandon du temps
    // simulé après chaque accroc se voyait plus que la deuxième image lente
    // qu'il évitait. Le rattrapage historique reprend (budget CPU seul en
    // garde-fou) ; la capacité reste dans FixedLoop, testée, si on y revient.
    const physT0 = performance.now()
    stepsFaits = loop.advance(
      dtReal,
      warpNow,
      params.dt,
      () => {
        if (
          input.aimActive &&
          !input.gasIntent &&
          !sim.dispersed &&
          !endgame.spent
        ) {
          // En eau, maintenir éjecte ; en vapeur, la visée fige le temps —
          // le dash part au relâchement (voir plus haut), rien ne se pilote.
          // Sans direction (stick neutre, doigt sur le corps) : on se reforme.
          if (rassembler) sim.rassemble(params.dt)
          else sim.eject(aim.x, aim.y, params.dt)
        }
        if (vortex.timer > 0) {
          const life = Math.min(1, vortex.timer / params.vortexDuration)
          sim.applyVortex(vortex.x, vortex.y, params.dt, life)
          vortex.timer -= params.dt
        }
        sim.applyExitSuction(exitMouth.x, exitMouth.y, params.dt)
        // Rien ne freine le corps figé : dans le vide, une dérive reste une
        // trajectoire. Elle peut encore rencontrer une paroi, rebondir, et
        // finir dans le sas — c'est au joueur de décider quand y renoncer.
        sim.step(params.dt)
        run.tableauTime += params.dt // temps simulé : le time warp ne fausse pas les records
        run.runTime += params.dt // le vaisseau refroidit au fil de l'expédition
        // la mise en scène avance au TEMPS DE JEU : une pause la suspend,
        // une cinématique aussi (la boucle physique ne tourne plus)
        sequenceur.avance(params.dt)
      },
      stepBudget,
      plafondPas,
    )
    physRaw = performance.now() - physT0
    monitor.physMs += (physRaw - monitor.physMs) * 0.08
  }

  // ---- LES PORTES vers le solveur. HORS du bloc des lasers : un tableau
  // peut n'avoir que des portes SCÉNARISÉES (la brèche de l'ouverture),
  // sans le moindre émetteur — leur paroi doit tout de même être solide
  // jusqu'à l'instant où le récit la crève.
  {
    const portes = level.portes ?? []
    if (portes.length > 0) {
      if (laserEtat.portesOuvertes.length !== portes.length) {
        laserEtat.portesOuvertes = portes.map(() => false)
      }
      for (let i = 0; i < portes.length; i++) {
        if (sequenceur.etat.brechesOuvertes.has(i))
          laserEtat.portesOuvertes[i] = true
      }
      // le solveur ne reçoit que les portes closes — recomposé au changement
      const closes = portes.filter((_, i) => !laserEtat.portesOuvertes[i])
      const cle = closes
        .map((p) => `${p.minX},${p.minY},${p.maxX},${p.maxY}`)
        .join(';')
      if (cle !== laserEtat.doorsKey) {
        laserEtat.doorsKey = cle
        sim.setDoors(closes)
      }
    }
  }

  // ---- Lasers : traçage, cibles, portes ----
  const lasers = level.lasers ?? []
  if (lasers.length > 0) {
    const cibles = level.cibles ?? []
    const portes = level.portes ?? []
    if (laserEtat.recepteurs.vues.length !== cibles.length) resetLasers()
    // portes fermées AVANT ce traçage : un faisceau ne traverse pas une porte
    // encore close — elle s'ouvrira pour l'image suivante
    const fermees = portes.filter((_, i) => !laserEtat.portesOuvertes[i])
    const rIce = params.particleSpacing * 1.3
    // le rayon du champ qui DÉFINIT la surface du liquide (dioptres)
    const rEau = params.laserMirrorSmooth * 0.6
    laserEtat.vues = lasers.map((em) =>
      traceLaser(em, {
        bounds: sim.bounds,
        boxes: level.boxes,
        portesFermees: fermees,
        cibles,
        // contact précis, normale MOYENNÉE large : le miroir est une facette
        // plane, pas une râpe — le reflet ne tremble plus à chaque bosse
        iceNormal: (x, y) =>
          sim.iceNormalAt(x, y, rIce, params.laserMirrorSmooth),
        // palier 2 : le corps liquide est un prisme — le rayon se plie à
        // chaque dioptre, et se piège sous la surface au-delà de ~49°.
        // Le milieu est LISSÉ au même rayon que la normale : la surface
        // effective est l'isoligne de densité, pas le grain des particules.
        // Le dioptre : la surface traversée et la normale qui plie le rayon
        // doivent décrire LA MÊME surface. Elles se calculaient sur deux
        // champs de rayons différents (0,6× pour l'appartenance, 1× pour la
        // normale) : la normale n'était pas perpendiculaire au dioptre
        // franchi — 4,7° d'écart en moyenne, jusqu'à 14,6°, doublés par les
        // deux interfaces. L'angle de sortie était faux.
        eau: {
          dedans: (x, y) => sim.liquidAt(x, y, rEau),
          normale: (x, y) => sim.liquidNormalAt(x, y, rEau),
        },
        indice: params.laserRefractIndex,
        // palier 3 : la vapeur ionise le faisceau en arc de plasma, que
        // les rails magnétiques capturent et guident
        vapeur: (x, y) => sim.gasAt(x, y, rIce),
        rails: level.rails ?? [],
        railRadius: params.plasmaRailRadius,
      }),
    )
    // Récepteurs : TOR à verrou (un passage allume pour de bon), NOR à
    // maintien (ouvert sous le faisceau ; la première coupure scelle la
    // porte fermée, définitivement) — machine à états dans laser.ts.
    const nowRecepteurs = performance.now() / 1000
    const toucheesImage: number[] = []
    for (const t of laserEtat.vues)
      for (const c of t.touchees) toucheesImage.push(c)
    avancerRecepteurs(
      cibles,
      toucheesImage,
      laserEtat.recepteurs,
      nowRecepteurs,
    )
    // une porte s'ouvre par son laser… ou par une SÉQUENCE (la brèche).
    // Elle vise un CANAL (le n° des pastilles) avec sa règle : OU (défaut,
    // une pastille active suffit) ou ET (toutes en même temps) — une porte
    // sans canal valide est une paroi que seul le récit ouvre.
    laserEtat.portesOuvertes = portes.map(
      (p, i) =>
        sequenceur.etat.brechesOuvertes.has(i) ||
        canalActif(
          cibles,
          p.canal,
          p.regle,
          laserEtat.recepteurs,
          nowRecepteurs,
        ),
    )
    // le FRONT MONTANT d'une pastille : l'instant de la victoire — on gèle
    // la trajectoire du rayon qui l'a allumée pour le sursaut (mode
    // somptueux ; le classique reste au pixel près)
    {
      const litNow = cibles.map((t, c) =>
        cibleActive(t, laserEtat.recepteurs, c, nowRecepteurs),
      )
      if (faisceauChoix >= 1) {
        for (let c = 0; c < litNow.length; c++) {
          if (!litNow[c] || laserEtat.litPrec[c] === true) continue
          const trace = laserEtat.vues.find((t) => t.touchees.includes(c))
          if (trace && trace.points.length >= 2) {
            laserEtat.impacts.push({
              t0: nowRecepteurs,
              cible: c,
              points: trace.points.map((p) => ({ ...p })),
            })
            if (laserEtat.impacts.length > 6) laserEtat.impacts.shift()
          }
        }
      }
      laserEtat.litPrec = litNow
    }
    // convoyage : quand un arc circule sur un rail, le champ s'y ENGAGE —
    // et il reste engagé tant qu'un nuage voyage dans la bande, même si le
    // rayon ne traverse plus la vapeur : ce qui est pris est porté jusqu'à
    // l'ARRIVÉE du rail. Le champ ne se relâche que la bande vide (nuage
    // arrivé, dispersé ou recondensé). Au rythme du temps simulé réellement
    // avancé (le ralenti de visée compte).
    const dtRail = Math.max(0, run.tableauTime - lastRailTime)
    if (dtRail > 0 && !input.paused && !tableauDone && !sim.dispersed) {
      const railsDuNiveau = level.rails ?? []
      const actifs = new Set<number>()
      for (const t of laserEtat.vues)
        for (const ri of t.railsSuivis) actifs.add(ri)
      for (const ri of actifs) railsEngages.add(ri)
      for (const ri of [...railsEngages]) {
        const rail = railsDuNiveau[ri]
        if (!rail) {
          railsEngages.delete(ri)
          continue
        }
        // bande de convoyage plus large que la capture : le nuage ENTIER
        // embarque, pas seulement son cœur posé sur la ligne
        const nBande = sim.railConvoy(
          rail.points,
          params.plasmaRailRadius * 2.5,
          params.plasmaConvoy,
          dtRail,
        )
        if (nBande === 0 && !actifs.has(ri)) railsEngages.delete(ri)
      }
    }
  }
  lastRailTime = run.tableauTime

  // Sortie (§7.1-7.2). Sas aspirant : la victoire n'arrive que lorsque le sas
  // a quasi tout bu (≤ 2 % du volume de base) — l'animation d'engloutissement
  // se joue en entier, le tampon ne coupe plus la spirale. Sas désactivé au
  // banc (rayon ou courant à 0) : règle historique, le centre du corps
  // franchit la boîte. L'eau avalée est mise en bonbonne dans les deux cas.
  const drainActive = params.exitRadius > 0 && params.exitPull > 0
  // La victoire : quand TOUT est bu, elle est automatique. Mais des gouttes
  // égarées traînent presque toujours quelque part — alors dès que le CORPS
  // PRINCIPAL est avalé, un bouton CONTINUER s'offre : c'est le joueur qui
  // décide de conclure, ou d'aller cueillir les dernières gouttes.
  const seuilBu = Math.max(6, sim.baseVolume * 0.02)
  // « un peu d'aspiration » : un dixième du volume de départ en bonbonne
  // suffit — la route coûte de l'eau (chaque impulsion éjecte), exiger la
  // moitié du volume INITIAL rendait le bouton inatteignable en vraie partie
  const aspireAssez = sim.swallowed >= Math.max(20, sim.baseVolume * 0.1)
  const drunk =
    (sim.swallowed > 0 && sim.count <= seuilBu) ||
    (aspireAssez && continuerVoulu)
  btnContinuer.classList.toggle(
    'visible',
    aspireAssez &&
      !drunk &&
      !tableauDone &&
      !sim.dispersed &&
      !input.paused &&
      document.body.classList.contains('playing'),
  )
  const reached =
    !drainActive &&
    pointInBox(sim.stats.centroidX, sim.stats.centroidY, level.exit)
  // au HUB, pas d'engloutissement à attendre : dès que le CORPS est dans la
  // bouche du sas, la run part — le sas de lancement est une porte, pas un
  // collecteur
  // Zones déclencheuses de cinématique : le corps (son centre) entre dans
  // la zone → la cinématique codée se joue, UNE fois par essai. La lecture
  // met la simulation en pause ; au retour, rien n'a bougé.
  if (!lecteurCine.actif && !run.ended && !sim.dispersed) {
    const zs = level.zones ?? []
    for (let i = 0; i < zs.length; i++) {
      const dedans = (): boolean =>
        zoneShape(zs[i], sim.stats.centroidX, sim.stats.centroidY) <= 1
      const code = zs[i].cine
      if (code && !cinesVues.has(`${i}:${code}`) && dedans()) {
        cinesVues.add(`${i}:${code}`)
        void lireCineParCode(code)
      }
      // …et la SÉQUENCE in-map, même règle : une fois par essai
      const seq = zs[i].sequence
      if (seq && !cinesVues.has(`s${i}:${seq}`) && dedans()) {
        cinesVues.add(`s${i}:${seq}`)
        demarreSequence(seq)
      }
    }
  }
  const rejointSasHub =
    auHub && pointInBox(sim.stats.centroidX, sim.stats.centroidY, level.exit)
  if (
    !tableauDone &&
    !sim.dispersed &&
    (drunk || reached || rejointSasHub) &&
    auHub
  ) {
    // LE SAS DE LANCEMENT : au hub, le sas ne collecte rien — il LANCE la
    // run. Reprise de l'expédition sauvée s'il y en a une, salle 1 sinon.
    auHub = false
    audio.collect()
    bande.ponctuation('sting-collecte', 0.85)
    // LE SCÉNARIO : la cinématique du départ, s'il y en a une — la run
    // attend qu'elle finisse (la simulation est en pause pendant ce temps)
    void joueMoment('lancement-run').then(() => {
      const save = runSauvee()
      if (save) {
        reprendreRun(save)
      } else {
        newExpedition()
      }
    })
  } else if (
    !tableauDone &&
    !sim.dispersed &&
    (drunk || reached) &&
    testLevel
  ) {
    // Prototype 21-A bis : l'essai conclut sans toucher aux registres ni à
    // l'expédition — on félicite, on ramène au protocole.
    const surplus = sim.liters() + sim.swallowed * params.litersPerParticle
    audio.collect()
    bande.ponctuation('sting-collecte', 0.85)
    run.ended = true
    const bestsLibre = records.tableauRecord(level.code)
    const refRecords = bestsLibre
      ? ` Records de la salle : 💧 ${fmtL(bestsLibre.volume.liters)} · ⏱ ${fmtTime(bestsLibre.chrono.time)}.`
      : ''
    showOverlay(
      fromEditor ? 'TABLEAU FRANCHI' : `ESSAI ${level.code} CONCLU`,
      fromEditor
        ? `${surplus.toFixed(2)} L collectés en ${fmtTime(run.tableauTime)} — le tableau se termine. Retour à l’éditeur pour l’ajuster.`
        : `${surplus.toFixed(2)} L collectés en ${fmtTime(run.tableauTime)} — essai hors expédition : les registres ne bougent pas.${refRecords}`,
      'success',
      fromEditor
        ? 'RETOUR À L’ÉDITEUR'
        : testQueue.length > 0
          ? 'SALLE SUIVANTE'
          : 'RETOUR AU PROTOCOLE',
    )
    // la cinématique de CONCLUSION : par-dessus le bilan, qui l'attend derrière
    if (level.cineApres) void lireCineParCode(level.cineApres)
  } else if (!tableauDone && !sim.dispersed && (drunk || reached)) {
    // Prime de glace : ce que le sas a avalé SOLIDE vaut plus cher que ce
    // qu'il a bu goutte à goutte.
    const prime =
      sim.swallowedIce * params.litersPerParticle * params.iceCollectBonus
    const surplus =
      sim.liters() + sim.swallowed * params.litersPerParticle + prime
    run.livreTotal += surplus
    // chaque centilitre livré nourrit le CONDENSAT (méta) — y compris sur la
    // dernière salle : rien de ce qui atteint le sas n'est jamais perdu
    gagneCondensat(surplus * 100)
    // Trophées de collecte : « Sans une goutte » (≥ 95 % du volume de
    // départ livré) et « Opérateur de nuit » (21 collectes cumulées)
    if (surplus >= 0.95 * level.spawn.n * params.litersPerParticle)
      trophees.debloque('sans-une-goutte')
    if (trophees.compte('collectes') >= 21)
      trophees.debloque('operateur-de-nuit')
    codex.marque('sas') // le codex consigne la première mise en bonbonne
    const { newVolume, newChrono } = records.noteCollection(
      level.code,
      surplus,
      run.tableauTime,
    )
    // Publication au tableau d'honneur partagé : le serveur ne garde que le
    // meilleur — la réponse remet les registres affichés à jour.
    pushTableauRecord(
      level.code,
      surplus,
      run.tableauTime,
      records.operator(),
    ).then((b) => {
      if (b) {
        sharedBoard = b
        renderRegistres()
        // « La ligne de crête » : le rang 1 en NOTE vient de tomber ?
        const top = b.tops?.[level.code]?.note?.[0]
        if (top && top.name === records.operator())
          trophees.debloque('ligne-de-crete')
      }
    })
    const bests = records.tableauRecord(level.code)!
    audio.collect()
    // Le record a sa propre fanfare : la collecte ordinaire ne doit pas
    // sonner comme un exploit, sinon plus rien ne sonne comme un exploit.
    bande.ponctuation(
      newVolume || newChrono ? 'sting-record' : 'sting-collecte',
      0.85,
    )
    if (levelIndex + 1 >= playedLevels().length) {
      // Dernier sas : l'expédition est achevée — bilan, et registres à jour
      run.ended = true
      trophees.debloque('integrale')
      const exp = records.noteExpedition(
        playedLevels().length,
        run.livreTotal,
        run.runTime,
      )
      pushExpeditionRecord(
        playedLevels().length,
        run.livreTotal,
        run.runTime,
        records.operator(),
      ).then((b) => {
        if (b) {
          sharedBoard = b
          renderRegistres()
        }
      })
      renderRegistres()
      // l'expédition principale conclue n'a plus rien à reprendre
      if (!testLevel) effaceRun()
      // LE SCÉNARIO : la cinématique de fin d'expédition, sur le bilan
      void joueMoment('expedition-achevee')
      showOverlay(
        'EXPÉDITION ACHEVÉE',
        `<span class="bilan"><span class="bilan-l">${expeditionSummary(playedLevels().length)}${
          exp.newRecord
            ? ' — <em class="bilan-neuf">MEILLEURE EXPÉDITION ✦</em>'
            : ''
        }</span></span>Le laboratoire n'a plus d'échantillon. Quelque part dans les conduites, le fluide se souvient.`,
        'success',
        'RETOUR AU LABO',
      )
    } else {
      renderRegistres()
      run.conclues += 1
      // LA MISE EN BONBONNE : la cérémonie remplace le bandeau — elle tient
      // l'essai en suspens jusqu'au choix d'instrument, qui mène à la suite
      montreMiseEnBonbonne({
        surplus,
        prime,
        pct: surplus / Math.max(0.01, level.spawn.n * params.litersPerParticle),
        temps: run.tableauTime,
        newVolume,
        newChrono,
        recVol: `${fmtL(bests.volume.liters)}${bests.volume.name ? ' · ' + htmlSafe(bests.volume.name) : ''}`,
        recChr: `${fmtTime(bests.chrono.time)}${bests.chrono.name ? ' · ' + htmlSafe(bests.chrono.name) : ''}`,
        note: Math.round((surplus * 100 * 60) / (60 + run.tableauTime)),
        gainCl: Math.round(surplus * 100),
        totalCl: condensat,
      })
    }
    // la cinématique de CONCLUSION du tableau : par-dessus le bilan — la
    // pause de lecture retient aussi le passage automatique à la suite
    if (level.cineApres) void lireCineParCode(level.cineApres)
  }
  if (run.exitTimer > 0) {
    run.exitTimer -= dtReal
    if (run.exitTimer <= 0) avanceSalle()
  }

  // Ondes d'éjection : naissance côté visée, sur le bord du corps (pas en vapeur)
  if (
    input.aimActive &&
    !input.gasIntent &&
    !sim.dispersed &&
    !input.paused &&
    !tableauDone
  ) {
    waveCarry += dtReal
    if (waveCarry >= WAVE_EVERY) {
      waveCarry = 0
      const dx = aim.x - sim.stats.centroidX
      const dy = aim.y - sim.stats.centroidY
      const len = Math.hypot(dx, dy) || 1
      const r = sim.stats.rmsRadius * 1.1
      // en rassemblement, l'onde part du CENTRE : le battement d'un cœur qui
      // se reforme, pas une salve qui sort
      waves.push({
        x: rassembler
          ? sim.stats.centroidX
          : sim.stats.centroidX + (dx / len) * r,
        y: rassembler
          ? sim.stats.centroidY
          : sim.stats.centroidY + (dy / len) * r,
        t: elapsed,
      })
      if (waves.length > MAX_WAVES) waves.shift()
    }
  } else {
    waveCarry = WAVE_EVERY
  }
  while (waves.length > 0 && elapsed - waves[0].t > 1) waves.shift()
  for (let i = 0; i < waves.length; i++) {
    waveScratch[i * 4] = waves[i].x
    waveScratch[i * 4 + 1] = waves[i].y
    waveScratch[i * 4 + 2] = waves[i].t
    waveScratch[i * 4 + 3] = 1
  }

  // Caméra : suivi du corps, ou vue d'ensemble du tableau depuis le banc
  if (monitor.overview) {
    const b = sim.bounds
    const fitZoom =
      Math.min(vw / (b.maxX - b.minX), vh / (b.maxY - b.minY)) * 0.94
    camera.snapTo((b.minX + b.maxX) * 0.5, (b.minY + b.maxY) * 0.5, fitZoom)
  } else {
    camera.update(
      dtReal,
      sim.stats.centroidX,
      sim.stats.centroidY,
      sim.stats.rmsRadius,
      vw,
      vh,
      params,
    )
    majEveil(dtReal) // l'éveil suit la caméra : ses repères (invite) sont à jour
  }
  updateTutor(dtReal)
  updateTrophees(dtReal)
  majFpsCoin(dtReal)
  updateWorldLabels(vw, vh)
  appliqueSequence() // carte et secousse de la mise en scène
  drawMecanismes(vw, vh, dpr)
  drawFleche(dtReal, dpr)
  majIdle(dtReal)
  majPresence(dtReal, aim.x, aim.y)
  const renderT0 = performance.now()
  renderer.render(
    sim,
    camera,
    params,
    vw,
    vh,
    dpr,
    renderBoxes,
    elapsed,
    waveScratch,
    waves.length,
    Math.max(params.renderDownsample, quality.down),
    chillNow(),
    level.decals ?? [],
    level.zones ?? [],
    decorRiche ? 1 : 0,
    eauRiche ? 1 : 0,
    lumiereActive ? 1 : 0,
    lumieresVives(),
    lumiereEauActive ? 1 : 0,
    level.ambiante ?? AMBIANTE_DEFAUT,
    RELIEF_K[reliefChoix],
    level.brume ?? 0,
    eauMiroir,
    level.plafond ?? '',
    {
      regardX: presence.x,
      regardY: presence.y,
      regardInt: presence.int,
      respAmp: presence.amp,
      respVit: presence.vit,
      frisson: presence.frisson,
      ondule: presence.ondule,
      oeilLueur: oeilRegl.lueur,
      oeilOmbre: oeilRegl.ombre,
      oeilTaille: oeilRegl.taille,
      oeilRelief: oeilRegl.relief,
    },
  )
  const rendRaw = performance.now() - renderT0
  monitor.renderMs += (rendRaw - monitor.renderMs) * 0.08
  // le collecteur note CHAQUE image rendue — c'est la matière du rapport.
  // Le CPU total inclut tout le rappel jusqu'ici : laser, étiquettes,
  // panneau 2D, HUD — ce que « autreJsMs » isole dans le rapport.
  perf.note(
    dtBrutMs,
    performance.now() - frameT0,
    physRaw,
    rendRaw,
    stepsFaits,
    sim.count,
    qualityLevel,
  )
  majPerfVif()

  const speed = Math.hypot(sim.stats.velX, sim.stats.velY)
  monitor.fps = fpsSmoothed
  monitor.particles = sim.count
  monitor.volume = sim.liters()
  monitor.speed = speed
  monitor.quality = qualityLevel

  btnPause.textContent = input.paused ? '▶' : '⏸'
  btnPause.classList.toggle('active', input.paused)
  chipLegend.classList.toggle('active', legend.classList.contains('visible'))
  chipStates.classList.toggle(
    'active',
    statesPanel.classList.contains('visible'),
  )
  chipBench.classList.toggle(
    'active',
    benchHost !== null && benchHost.style.display !== 'none',
  )
  chipEditor.style.display = fromEditor ? '' : 'none'
  btnVortex.classList.toggle('active', input.vortexArmed)
  btnVortex.style.display = params.vortexEnabled >= 0.5 ? '' : 'none'
  stateEau.classList.toggle('active', !input.freezeIntent && !input.gasIntent)
  stateGlace.classList.toggle('active', input.freezeIntent)
  stateVapeur.classList.toggle('active', input.gasIntent)
  // dans une zone imposée, le sélecteur se grise : le choix n'est plus offert
  const locked = zoneActive !== 'libre'
  stateEau.disabled = locked
  stateGlace.disabled = locked
  stateVapeur.disabled = locked
  document.body.classList.toggle('state-locked', locked)
  btnSound.textContent = audio.enabled ? '🔊' : '🔇'

  // Instruments de bord
  const fraction = sim.baseVolume > 0 ? sim.playerCount / sim.baseVolume : 0
  hudTableau.textContent = testLevel
    ? 'BIS'
    : auHub
      ? 'LABO'
      : `SALLE ${levelIndex + 1}/${playedLevels().length}`
  // les échantillons de secours (vies) et la bonbonne : en run seulement —
  // au labo comme aux essais, rien ne se paie et rien ne se collecte
  hudViesChip.hidden = !!testLevel || auHub
  hudBonbonneChip.hidden = !!testLevel || auHub
  hudVies.textContent = `×${run.vies}`
  // La coque refroidit : +21° au départ, −60° à froid complet — la pression
  // temporelle se lit ici (chiffre ET barre), jamais sur un chronomètre
  const coque = Math.round(21 - 81 * chillNow())
  hudCoque.textContent = `${coque > 0 ? '+' : ''}${coque}°`
  hudCoque.classList.toggle('warn', chillNow() > 0.75)
  coqueBar.style.width = `${(chillNow() * 100).toFixed(1)}%`
  hudBonbonne.textContent = `${run.bonbonneLiters.toFixed(2)} / ${BONBONNE_CAP} L`
  // le versement est possible : la pastille s'allume pour inviter au geste
  hudBonbonneChip.classList.toggle(
    'verse-ok',
    run.bonbonneLiters >= params.litersPerParticle &&
      sim.playerCount < level.spawn.n &&
      !input.freezeIntent &&
      !input.gasIntent,
  )
  if (hudInstrChip) {
    hudInstrChip.hidden = !!testLevel || auHub || run.instruments.length === 0
    if (hudInstrChip.hidden && instrPanel) instrPanel.hidden = true
  }
  // La vie compte la matière VIVANTE : le corps plus les gouttes marquées
  // encore dans son halo (la règle : n'est perdu que ce qui en SORT — et
  // tout ce qui reste dans le halo revient, le rappel s'en charge).
  hudVolume.innerHTML = `${sim.liters().toFixed(2)} <small>L · ${sim.aliveCount()} part.</small>`
  gaugeFill.style.width = `${Math.min(100, fraction * 100).toFixed(1)}%`
  // Le seuil est un volume ABSOLU : sa position sur la jauge (graduée en % du
  // volume de départ) dépend donc du volume de base de ce tableau.
  const baseLiters = sim.baseVolume * params.litersPerParticle
  const seuilPct =
    baseLiters > 0 ? (params.criticalVolumeLiters / baseLiters) * 100 : 0
  gaugeThreshold.style.left = `${Math.min(100, seuilPct).toFixed(1)}%`
  hudSeuil.textContent = `${params.criticalVolumeLiters.toFixed(2)} L`
  hudVitesse.textContent = `${speed.toFixed(0)} u/s`

  // Débit de perte lissé : combien coûte l'action en cours, et à quoi
  const nowLiters = sim.liters()
  const simT = run.tableauTime
  if (lossPrevLiters >= 0 && simT > lossPrevT) {
    const inst = (lossPrevLiters - nowLiters) / (simT - lossPrevT)
    lossRate +=
      (Math.max(0, inst) - lossRate) * Math.min(1, (simT - lossPrevT) * 4)
  } else if (simT < lossPrevT) {
    lossRate = 0
  }
  lossPrevLiters = nowLiters
  lossPrevT = simT
  if (lossRate > 0.02 && !sim.dispersed && !tableauDone) {
    const cause = input.gasIntent
      ? 'coût vapeur'
      : input.aimActive
        ? 'éjection'
        : 'surfaces'
    hudPerte.textContent = `−${lossRate.toFixed(2)} L/s · ${cause}`
  } else {
    hudPerte.textContent = ''
  }
  // La rosée : ce que la vapeur a perdu et que les plaques froides rendront
  const roseeL = sim.vaporBank * params.litersPerParticle
  hudRosee.textContent =
    levelHasCold && roseeL >= 0.05
      ? `rosée récupérable aux plaques froides : ${roseeL.toFixed(2)} L`
      : ''

  // ---- Fin de course : dernière impulsion, gel, arrêt ----
  // Aucun minimum à ramener : on peut finir un tableau sur un souffle. Sous le
  // seuil, la prochaine impulsion est la dernière ; une fois donnée, le corps
  // se fige avec son élan et l'essai s'achève à l'arrêt.
  // MAIS : quand le SAS BOIT, le volume fond parce qu'il est COLLECTÉ — la
  // fin de course n'a rien à y redire. Tant que l'aspiration avale (et une
  // bonne seconde après), alerte, dernière impulsion et gel se taisent.
  if (sim.swallowed > endgame.sasVu) {
    endgame.sasVu = sim.swallowed
    endgame.sasBoitJusqua = run.tableauTime + 1.2
  }
  const sasBoit = run.tableauTime <= endgame.sasBoitJusqua
  // Dès qu'un peu d'aspiration a eu lieu, le bouton CONTINUER prend le
  // relais : la fin de course funeste (alerte, dernière impulsion, gel)
  // n'a plus voix — un corps qui fond parce qu'il se fait BOIRE n'agonise
  // pas. Sans cela, 1,2 s après la fin de l'aspiration, « playerCount ≤ 8 »
  // déclarait « l'échantillon dérive » sur un corps... collecté.
  endgame.enCollecte = sasBoit || aspireAssez
  if (endgame.enCollecte) endgame.lastCall = false // le sas boit : l'alarme se tait
  const alive = !sim.dispersed && !tableauDone && !run.ended
  if (alive && !endgame.spent && !endgame.enCollecte) {
    endgame.lastCall = sim.liters() <= params.criticalVolumeLiters
    // se rassembler ne dépense rien : ce maintien-là n'est pas une impulsion,
    // il ne consomme pas la dernière
    const aiming = input.aimActive && !input.paused && !rassembler
    // le relâchement du pointeur conclut l'impulsion en cours
    if (endgame.lastCall && endgame.wasAiming && !aiming) endgame.spent = true
    // plus rien à éjecter : le gel s'impose sans attendre le relâchement
    if (sim.playerCount <= 8) endgame.spent = true
    endgame.wasAiming = aiming
    if (endgame.spent) {
      input.freezeIntent = true // le froid saisit ce qu'il reste, l'élan est gardé
      input.gasIntent = false
      manette.rumble(1, 260) // la dernière impulsion se sent dans les mains
    }
  }
  if (endgame.spent && alive) {
    // Le corps reste figé et dérive. Aucun arrêt ne conclut : le vide ne
    // freine rien, et une paroi peut encore renvoyer le palet vers le sas.
    // C'est le joueur qui décide d'en rester là — le bouton de relance
    // apparaît, sans rien masquer de la trajectoire.
    input.freezeIntent = true
    input.gasIntent = false
  }

  // La relance s'offre dès la dernière impulsion donnée, et ne coupe rien.
  // Son LIBELLÉ dit la vérité du moment : en run, elle conclut (le sursis
  // court, le sas peut encore boire) ; ailleurs, elle rejoue la salle.
  btnRelance.textContent =
    !testLevel && !auHub && !run.ended
      ? 'EN RESTER LÀ — CONCLURE LA SALLE'
      : 'RECOMMENCER LE TABLEAU'
  btnRelance.classList.toggle(
    'visible',
    (endgame.spent || sim.dispersed) &&
      // le CONTINUER offert prime : une seule invite à l'écran
      !(aspireAssez && !sim.dispersed) &&
      document.body.classList.contains('playing') &&
      !tableauDone &&
      !run.ended,
  )

  const nearLast =
    alive &&
    !endgame.spent &&
    !endgame.enCollecte &&
    sim.liters() <= params.lastCallLiters
  // une fois le CONTINUER offert, plus aucune bannière funeste : le bouton
  // est l'interface de fin, l'alarme n'a plus rien à dire
  const inDanger =
    alive && !aspireAssez && (endgame.spent || endgame.lastCall || nearLast)
  if (inDanger) {
    hudDanger.textContent = endgame.spent
      ? '❄ DERNIÈRE IMPULSION DONNÉE — L’ÉCHANTILLON DÉRIVE'
      : endgame.lastCall
        ? '⚠ RÉSERVE À SEC — LA PROCHAINE IMPULSION EST LA DERNIÈRE'
        : '⚠ RÉSERVE BASSE — LA DERNIÈRE IMPULSION APPROCHE'
  }
  hudDanger.classList.toggle(
    'visible',
    inDanger && document.body.classList.contains('playing') && !input.paused,
  )
  hudDanger.classList.toggle('spent', endgame.spent)
  gaugeFill.classList.toggle(
    'danger',
    (inDanger && endgame.lastCall) ||
      (endgame.spent && !aspireAssez) ||
      sim.dispersed,
  )
  gaugeFill.classList.toggle(
    'warn',
    nearLast && !endgame.lastCall && !sim.dispersed,
  )

  // L'objectif : quand le sas sort de l'écran, une flèche le pointe depuis le
  // bord du cadre, avec la distance restante — on sait toujours où aller.
  const exitSx = vw * 0.5 + (exitMouth.x - camera.x) * camera.zoom
  const exitSy = vh * 0.5 - (exitMouth.y - camera.y) * camera.zoom
  const exitOnScreen =
    exitSx > 30 && exitSx < vw - 30 && exitSy > 92 && exitSy < vh - 140
  const showArrow =
    document.body.classList.contains('playing') &&
    !tableauDone &&
    !sim.dispersed &&
    !monitor.overview &&
    !exitOnScreen
  if (showArrow) {
    const ang = Math.atan2(exitSy - vh * 0.5, exitSx - vw * 0.5)
    const ax = Math.min(vw - 48, Math.max(48, exitSx))
    const ay = Math.min(vh - 152, Math.max(106, exitSy))
    objArrow.style.transform = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px) translate(-50%, -50%)`
    objArrowGlyph.style.transform = `rotate(${((ang * 180) / Math.PI).toFixed(1)}deg)`
    const dWorld = Math.hypot(
      exitMouth.x - sim.stats.centroidX,
      exitMouth.y - sim.stats.centroidY,
    )
    objDist.textContent = `SAS · ${Math.round(dWorld)} u`
  }
  objArrow.classList.toggle('visible', showArrow)

  // Ligne de visée du dash : du corps au pointeur, avec le coût annoncé —
  // on choisit sa trajectoire en connaissance de cause, le temps attendra.
  if (dash.aiming) {
    const sx = vw * 0.5 + (sim.stats.centroidX - camera.x) * camera.zoom
    const sy = vh * 0.5 - (sim.stats.centroidY - camera.y) * camera.zoom
    const ex = input.aimClientX
    const ey = input.aimClientY
    const len = Math.hypot(ex - sx, ey - sy)
    const ang = Math.atan2(ey - sy, ex - sx)
    dashAimEl.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) rotate(${((ang * 180) / Math.PI).toFixed(2)}deg)`
    dashAimEl.style.width = `${Math.max(0, len - 14).toFixed(1)}px`
    dashCostEl.style.transform = `translate(${(ex + 18).toFixed(1)}px, ${(ey - 30).toFixed(1)}px)`
    // La puissance suit la distance du doigt AU CORPS (en unités monde) :
    // l'étiquette annonce les deux termes du marché — la poussée et le prix.
    const dMonde = Math.hypot(
      aim.x - sim.stats.centroidX,
      aim.y - sim.stats.centroidY,
    )
    const puissance = Math.min(1, dMonde / Math.max(1, params.gasDashRange))
    // À sec DANS une zone qui impose la vapeur : le sélecteur est verrouillé
    // et la zone ne recharge pas — l'étiquette dit où trouver un dash.
    dashCostEl.textContent =
      sim.dashBudget > 0
        ? `DASH ${Math.round(puissance * 100)} % · ${sim.dashBudget} dash${sim.dashBudget > 1 ? 's' : ''}`
        : zoneActive === 'vapeur'
          ? `À SEC — la zone impose la vapeur, elle ne recharge pas : un surchauffeur`
          : `À SEC — retransformez-vous, ou frôlez un surchauffeur`
  }
  dashAimEl.classList.toggle('visible', dash.aiming)
  dashCostEl.classList.toggle('visible', dash.aiming)
  let frozenCount = 0
  let gasCount = 0
  for (let i = 0; i < sim.count; i++) {
    if (sim.kind[i] !== KIND_PLAYER) continue
    if (sim.frozen[i] === 1) frozenCount++
    else if (sim.gaseous[i] === 1) gasCount++
  }
  const allFrozen = sim.playerCount > 0 && frozenCount >= sim.playerCount
  const allGas = sim.playerCount > 0 && gasCount >= sim.playerCount
  // Chaudière (règle du 12/08) : l'échauffement n'est qu'un effet visuel —
  // la TRANSFORMATION se déclenche quand 95 % du corps actif baigne dans
  // l'aura. Réarmement quand le corps en ressort (présence sous 50 %) :
  // revenir à l'eau dans l'aura ne déclenche pas de lutte.
  if (sim.chauffeFrac < 0.5) autoGazArme = true
  if (
    autoGazArme &&
    sim.chauffeFrac >= 0.95 &&
    !input.gasIntent &&
    !tableauDone &&
    !sim.dispersed &&
    !input.paused
  ) {
    autoGazArme = false
    if (input.freezeIntent) input.toggleFreeze()
    input.toggleGas() // le même chemin que la touche G : sons et UI suivent
  }

  // ---- Sons : boucles continues et fronts d'état ----
  const audible = !input.paused && !tableauDone && !sim.dispersed
  // Le souffle continu d'éjection est retiré (la voix elle-même n'existe
  // plus) : l'eau se signale par la goutte qui « ploc » à chaque impulsion.
  audio.setGasLevel(
    audible && gasCount > 0
      ? input.aimActive && input.gasIntent
        ? 1
        : 0.35
      : 0,
  )

  // ---- Bande-son : décor sonore et ponctuations ----
  const enJeu = document.body.classList.contains('playing')
  bande.setScene(enJeu ? 'cuve' : 'accueil')
  bande.setChill(chillNow())
  bande.setZone(zoneActive)
  // Le geste d'impulsion : une bouffée à l'amorce, pas un souffle continu —
  // la boucle procédurale tient déjà la durée.
  // L'éjection d'eau est une goutte qui tombe dans l'eau — et elle GOUTTE :
  // une première au contact, puis une toutes les ~0,17 s tant qu'on maintient,
  // à cadence légèrement irrégulière (l'eau n'est pas un métronome). Trois
  // prises de hauteurs différentes tirées au sort, plus un écart de ±7 % :
  // deux fois le même « bloop » à la même note et l'oreille entend une
  // machine. En vapeur, la visée est silencieuse — le souffle part au dash.
  // pas de « ploc » en glace : un palet n'éjecte rien, il n'a pas à goutter —
  // ni en rassemblement : rien ne sort, rien ne goutte
  const vise =
    audible &&
    input.aimActive &&
    !input.gasIntent &&
    !input.freezeIntent &&
    !rassembler
  if (vise) {
    sfx.dropTimer -= dtReal
    if (!sfx.aiming || sfx.dropTimer <= 0) {
      const prise = 1 + Math.floor(Math.random() * 3)
      bande.bruitage(
        `ejection-${prise}` as Bruitage,
        0.65,
        0.93 + Math.random() * 0.14,
      )
      sfx.dropTimer = 0.12 + Math.random() * 0.1
    }
  }
  sfx.aiming = vise
  // L'éponge boit en silence : son bruit de succion agaçait plus qu'il
  // n'informait — la jauge et le feutre qui se remplit suffisent à le dire.
  if (endgame.lastCall && !sfx.lastCall)
    bande.ponctuation('sting-derniere-impulsion', 0.8)
  sfx.lastCall = endgame.lastCall
  if (endgame.spent && !sfx.spent) bande.ponctuation('fin-de-course', 0.85)
  sfx.spent = endgame.spent
  const drainOn = params.exitRadius > 0 && params.exitPull > 0
  const mouthDist = Math.hypot(
    sim.stats.centroidX - exitMouth.x,
    sim.stats.centroidY - exitMouth.y,
  )
  audio.setDrainLevel(
    audible && drainOn
      ? Math.max(0, 1 - mouthDist / Math.max(1, params.exitRadius))
      : 0,
  )
  if (sim.swallowed > sfx.swallowed)
    audio.pulseSwallow(sim.swallowed - sfx.swallowed)
  sfx.swallowed = sim.swallowed
  if (allFrozen && !sfx.allFrozen) {
    audio.freezeOn()
    bande.bruitage('gel', 0.7)
  } else if (!allFrozen && sfx.allFrozen) {
    audio.freezeOff()
    bande.bruitage('goutte-rosee', 0.6) // le dégel retombe en gouttes
  }
  sfx.allFrozen = allFrozen
  if (allGas && !sfx.allGas) {
    audio.vaporizeOn()
    bande.bruitage('vaporisation', 0.7)
  } else if (!allGas && sfx.allGas) {
    audio.vaporizeOff()
    bande.bruitage('condensation', 0.7)
  }
  sfx.allGas = allGas
  if (sim.dispersed && !sfx.dispersed) {
    audio.disperse()
    if (!testLevel) {
      // fin de l'échantillon ET de l'expédition : les registres consignent tout
      records.noteDispersion(level.code, run.tableauTime)
      records.noteExpedition(levelIndex, run.livreTotal, run.runTime)
      if (levelIndex > 0 || run.livreTotal >= 0.01) {
        pushExpeditionRecord(
          levelIndex,
          run.livreTotal,
          run.runTime,
          records.operator(),
        ).then((b) => {
          if (b) {
            sharedBoard = b
            renderRegistres()
          }
        })
      }
      renderRegistres()
    }
  }
  sfx.dispersed = sim.dispersed
  if (sim.iceImpact > 60) {
    audio.iceImpact(sim.iceImpact)
    // le choc porte : plus il est franc, plus l'échantillon sonne fort et sec
    const force = Math.min(1, sim.iceImpact / 700)
    bande.bruitage('impact-glace', 0.25 + 0.55 * force, 0.9 + 0.25 * force)
  }
  sim.iceImpact = 0

  const stateText = sim.dispersed
    ? 'DISPERSÉ'
    : locked
      ? `${zoneActive.toUpperCase()} — IMPOSÉE`
      : allFrozen
        ? 'GLACE'
        : allGas
          ? 'VAPEUR'
          : 'liquide'
  const gel = !allFrozen && frozenCount > 0 ? ' · gel partiel' : ''
  const vape = !allGas && gasCount > 0 ? ' · vapeur partielle' : ''
  const suffix = `${gel}${vape}${vortex.timer > 0 ? ' · vortex' : ''}${input.paused ? ' · pause' : ''}`
  hudState.textContent = stateText + suffix
  hudState.classList.toggle('warn', sim.dispersed)
  document.body.classList.toggle('dispersed', sim.dispersed)
  hudWarp.textContent = `×${params.timeWarp}`
  hudWarp.classList.toggle('warn', params.timeWarp !== 1)
  majVitesse()

  // Relevé vivant de la fiche d'essai
  if (!document.body.classList.contains('playing')) {
    homeVolume.textContent = `${sim.liters().toFixed(2)} L`
    homeParticles.textContent = `${sim.playerCount}`
    homeState.textContent = sim.dispersed ? 'dispersé' : 'en dérive'
  }

  // ---- LA RUN SE CONCLUT D'ELLE-MÊME ------------------------------------
  // Deux façons de perdre le corps : il se DÉFAIT (dispersed), ou sa RÉSERVE
  // est à SEC (endgame.spent — la dernière impulsion a été donnée, il se
  // fige et dérive). Le second cas était sans issue : rien ne concluait, le
  // palet dérivait indéfiniment. Il conclut maintenant, après un sursis
  // pendant lequel le sas peut encore le boire.
  {
    const horsRun = !!testLevel || auHub || run.ended || tableauDone
    const perdu = !horsRun && (sim.dispersed || endgame.spent)
    // Le sas qui AVALE suspend le sursis (la salle peut encore se conclure)
    // — mais la simple PROXIMITÉ du sas ne suffit pas : un palet gelé qui
    // stationne dans le rayon d'aspiration sans jamais être bu gelait la run
    // pour de bon (enCollecte restait vrai à jamais). Seule une gorgée
    // récente compte, et si elle s'arrête, le compte repart ENTIER.
    const sasAvale = run.tableauTime <= endgame.sasBoitJusqua
    const enSursis = perdu && !sasAvale
    if (enSursis && !perduAvant) {
      dispersionDelai = sim.dispersed ? DELAI_DISPERSION : SURSIS_EPUISE
    }
    perduAvant = enSursis
    if (!enSursis) dispersionDelai = 0
    else if (!input.paused) {
      dispersionDelai -= dtReal
      if (dispersionDelai <= 0) afficheDispersion()
    }
  }

  // Plus d'écran de fin : ni dispersion, ni fin de course. Ce qui reste de
  // l'échantillon dérive à l'écran, et le bouton de relance attend en bas
  // sans rien recouvrir. Seuls la victoire et le bilan d'expédition ouvrent
  // encore un tampon. (Recalculé, pas tableauDone : si la victoire tombe dans
  // cette image, le tampon SAS ATTEINT ne doit pas être effacé aussitôt.)
  if (run.exitTimer <= 0 && !run.ended && ecranDispersion === 'aucun') {
    overlay.classList.remove('visible')
  }

  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
