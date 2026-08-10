import '@fontsource/michroma'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
import { DEFAULT_PARAMS, type SimParams } from './sim/params'
import { FluidSim, KIND_PLAYER } from './sim/solver'
import { Camera } from './render/camera'
import { Renderer } from './render/renderer'
import { FixedLoop } from './game/loop'
import { Input } from './game/input'
import {
  MAT_EXIT,
  MAT_FROID,
  TABLEAU_1BIS,
  TABLEAUX,
  pointInBox,
  zoneForceAt,
  zoneName,
  type LevelDef,
  type ObstacleBox,
  type ZoneForce,
} from './game/level'
import { LevelEditor } from './editor/editor'
import { fetchLibrary } from './game/netLevels'
import { AudioFx, loadAudioPrefs } from './game/audio'
import { Soundtrack, type Bruitage, type Piste } from './game/soundtrack'
import { Records } from './game/records'
import {
  fetchSharedBoard,
  pushExpeditionRecord,
  pushTableauRecord,
  type SharedBoard,
} from './game/netRecords'
import { createBench, type BenchMonitor } from './bench/bench'

const CAPACITY = 4096
const EXIT_LINGER = 2.6 // secondes d'affichage du bilan avant le tableau suivant

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
}

function chillNow(): number {
  return Math.min(1, run.runTime / Math.max(30, params.chillDuration))
}

// Effets sonores : le contexte audio naît au premier geste (clic, toucher)
const audio = new AudioFx(loadAudioPrefs())
// Bande-son : mêmes réglages, même bus — elle ne s'éveille qu'au premier geste
// et ne télécharge rien tant que le son est coupé.
const bande = new Soundtrack(audio)
let audioEveille = false
function eveilAudio(): void {
  audio.resume()
  if (audio.enabled) {
    bande.eveiller()
    audioEveille = true
  }
  majInviteSon()
}
window.addEventListener('pointerdown', eveilAudio)
window.addEventListener('keydown', eveilAudio)
// Le navigateur n'autorise le son qu'après un geste : sans invitation, le
// premier geste de la partie est le clic sur COMMENCER, et le thème d'accueil
// n'aurait jamais l'occasion de se faire entendre. La fiche le propose donc.
const btnSonAccueil = document.getElementById('home-son') as HTMLButtonElement | null
function majInviteSon(): void {
  if (btnSonAccueil) btnSonAccueil.hidden = audioEveille || !audio.enabled
}
btnSonAccueil?.addEventListener('click', () => {
  if (!audio.enabled) audio.setEnabled(true)
  eveilAudio()
})
majInviteSon()
// Mémoire pour les transitions sonores (fronts d'état)
const sfx = {
  allFrozen: false,
  allGas: false,
  dispersed: false,
  swallowed: 0,
  spongeBites: 0,
  aiming: false,
  lastCall: false,
  spent: false,
}

// Registres du labo (§10) : records par tableau et historique des essais.
const records = new Records()

function fmtTime(s: number): string {
  return `${s.toFixed(1).replace('.', ',')} s`
}

function createSim(level: LevelDef): FluidSim {
  const sim = new FluidSim(params, level.bounds, CAPACITY)
  sim.setLevel(level.boxes, level.sponges)
  sim.spawnDisc(level.spawn.x, level.spawn.y, level.spawn.n, KIND_PLAYER)
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
// La bibliothèque partagée, quand elle contient des tableaux, devient la
// séquence jouable : le tableau 1 mène au 2, et ainsi de suite dans l'ordre
// fixé par l'éditeur. Vide ou injoignable, on joue l'expédition livrée.
let libraryLevels: LevelDef[] = []
function playedLevels(): LevelDef[] {
  return libraryLevels.length > 0 ? libraryLevels : TABLEAUX
}

// Le prototype 21-A bis se joue hors expédition : un essai à part, depuis la
// fiche — s'il convainc, il remplacera 21-A dans la séquence.
let testLevel: LevelDef | null = null
let level: LevelDef = TABLEAUX[levelIndex]
// Les boîtes rendues incluent le sas (rendu seulement, pas de physique solide),
// et la bouche d'aspiration est le centre du sas du tableau courant.
let renderBoxes: ObstacleBox[] = []
let levelHasCold = false // le HUD n'annonce la rosée que si des plaques la rendent
const exitMouth = { x: 0, y: 0 }
function applyLevel(): void {
  level = testLevel ?? playedLevels()[levelIndex] ?? playedLevels()[0]
  levelHasCold = level.boxes.some((b) => b.material === MAT_FROID)
  renderBoxes = [...level.boxes, { ...level.exit, material: MAT_EXIT }]
  exitMouth.x = (level.exit.minX + level.exit.maxX) * 0.5
  exitMouth.y = (level.exit.minY + level.exit.maxY) * 0.5
  bande.setAmbiance((level.ambiance as Piste | undefined) ?? null)
  buildWorldLabels()
}

// Étiquettes de monde : le nom de chaque surface, projeté par la caméra —
// la lisibilité de la légende, mais dans le décor lui-même.
const worldLabelsHost = document.getElementById('world-labels') as HTMLDivElement
let labelEls: { span: HTMLSpanElement; x: number; y: number }[] = []
const ZONE_LABEL_COLORS: Record<string, string> = {
  eau: '#63b7e6',
  glace: '#8fc8ee',
  vapeur: '#c9a6f2',
  libre: '#7b93a8',
}
function buildWorldLabels(): void {
  worldLabelsHost.innerHTML = ''
  labelEls = level.labels.map((l) => {
    const span = document.createElement('span')
    span.className = `world-label wl-${l.tone}`
    span.textContent = l.text
    worldLabelsHost.appendChild(span)
    return { span, x: l.x, y: l.y }
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
    labelEls.push({ span, x: (z.minX + z.maxX) / 2, y: z.maxY - 40 })
  }
}

function updateWorldLabels(vw: number, vh: number): void {
  const scale = Math.max(0.6, Math.min(1.2, Math.sqrt(camera.zoom)))
  for (const l of labelEls) {
    const sx = vw * 0.5 + (l.x - camera.x) * camera.zoom
    const sy = vh * 0.5 - (l.y - camera.y) * camera.zoom
    const visible = sx > -160 && sx < vw + 160 && sy > -40 && sy < vh + 40
    l.span.style.display = visible ? '' : 'none'
    if (visible) {
      l.span.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`
    }
  }
}
applyLevel()

const canvas = document.getElementById('glcanvas') as HTMLCanvasElement
const overlay = document.getElementById('overlay') as HTMLDivElement
const overlayTitle = document.getElementById('overlay-title') as HTMLDivElement
const overlaySub = document.getElementById('overlay-sub') as HTMLDivElement

const el = (id: string) => document.getElementById(id) as HTMLElement
const hudTableau = el('hud-tableau')
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

// Écran record de la fiche : le meilleur du protocole (partagé entre tous les
// opérateurs) prime sur le registre local — même règle de départage partout.
function renderRegistres(): void {
  recEssai.textContent = `ÉCHANTILLON Nº ${records.essaiNumber()}`
  const rows: string[] = playedLevels().map((t) => {
    const local = records.tableauRecord(t.code)
    const shared = sharedBoard?.tableaux[t.code] ?? null
    const best =
      shared &&
      (!local ||
        shared.liters > local.liters ||
        (shared.liters === local.liters && shared.time < local.time))
        ? shared
        : local
    const holder = best?.name ? ` · ${best.name}` : ''
    const val = best
      ? `<b>${best.liters.toFixed(2)} L</b> · ${fmtTime(best.time)}${holder}`
      : '<span class="rec-none">aucune collecte</span>'
    return `<div class="rec-row"><span class="rec-code">${t.code}</span><span class="rec-name">${t.name}</span><span class="rec-val">${val}</span></div>`
  })
  const localExp = records.expedition()
  const sharedExp = sharedBoard?.expedition ?? null
  const exp =
    sharedExp &&
    (!localExp ||
      sharedExp.tableaux > localExp.tableaux ||
      (sharedExp.tableaux === localExp.tableaux &&
        (sharedExp.liters > localExp.liters ||
          (sharedExp.liters === localExp.liters && sharedExp.time < localExp.time))))
      ? sharedExp
      : localExp
  if (exp) {
    const holder = exp.name ? ` · ${exp.name}` : ''
    rows.unshift(
      `<div class="rec-row rec-exp"><span class="rec-code">EXPÉDITION</span><span class="rec-name"></span>` +
        `<span class="rec-val"><b>${exp.tableaux}/${playedLevels().length}</b> · ${exp.liters.toFixed(2)} L · ${fmtTime(exp.time)}${holder}</span></div>`,
    )
  }
  const hist = records.lastEntries(4)
  if (hist.length > 0) {
    const line = hist
      .map((e) => `nº ${e.no} ${e.code} ${e.won ? `✓ ${e.liters.toFixed(2)} L` : '✕ dispersé'}`)
      .join(' &nbsp;·&nbsp; ')
    rows.push(`<div class="rec-hist">${line}</div>`)
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

// La plongée exige un nom : on interpelle le champ au lieu d'ouvrir la cuve.
function requireName(): boolean {
  // le champ peut être rempli sans avoir encore perdu le focus (pas de change)
  if (recName.value.trim()) records.setOperator(recName.value)
  if (records.operator()) return false
  recNeed.hidden = false
  recName.classList.remove('need')
  void recName.offsetWidth // relance l'animation de secousse
  recName.classList.add('need')
  recName.scrollIntoView({ block: 'center', behavior: 'smooth' })
  recName.focus({ preventScroll: true })
  return true
}
const tableauCard = el('tableau-card')
const cardCode = el('card-code')
const cardLog = el('card-log')
const cardFig = el('card-fig') as HTMLImageElement

// Carton d'ouverture : l'entrée du journal de bord du tableau, affichée
// pendant le plan large puis effacée quand la caméra a plongé.
let cardTimer: number | undefined
function showTableauCard(): void {
  cardCode.textContent = `ESSAI ${level.code} — ${level.name.toUpperCase()}`
  // La planche du dossier, quand le tableau en a une
  if (level.figure) {
    cardFig.src = level.figure
    cardFig.hidden = false
  } else {
    cardFig.hidden = true
    cardFig.removeAttribute('src')
  }
  cardLog.textContent = level.journal
  tableauCard.classList.add('visible')
  window.clearTimeout(cardTimer)
  cardTimer = window.setTimeout(() => tableauCard.classList.remove('visible'), 6500)
}

// Fiche d'essai : visible au chargement ; « échap » ou ≡ pour y revenir.
// L'essai continue de dériver derrière la fiche — elle observe, elle ne fige pas.
const startBtn = document.getElementById('start') as HTMLButtonElement
const startBisBtn = document.getElementById('start-bis') as HTMLButtonElement
let hasPlayed = false
function closeHome(): void {
  if (requireName()) return // pas de plongée sans opérateur identifié
  document.body.classList.add('playing')
  startBtn.textContent = "REPRENDRE L'ESSAI"
  if (!hasPlayed) {
    // Premier lancement : zoom d'ouverture (les redémarrages ont le leur)
    hasPlayed = true
    camera.startIntro(sim.bounds, window.innerWidth, window.innerHeight)
    showTableauCard()
  }
}
function openHome(): void {
  document.body.classList.remove('playing')
}
startBtn.addEventListener('click', closeHome)
// Le prototype 21-A bis : un essai à part, hors expédition et hors registres.
// Lancé depuis la fiche (bouton dédié) ou depuis le banc (dossier Tableaux).
function startBisTest(): void {
  if (requireName()) {
    openHome() // le champ du nom vit sur la fiche : on la montre pour le remplir
    return
  }
  testLevel = TABLEAU_1BIS
  fromEditor = false
  run.bonbonneLiters = 0
  run.runTime = 0
  hasPlayed = true
  // « playing » d'abord : restart() se charge alors lui-même du plan large et
  // du carton de journal — sinon les deux se jouaient en double, en décalé.
  document.body.classList.add('playing')
  startBtn.textContent = "REPRENDRE L'ESSAI"
  restart()
}
startBisBtn.addEventListener('click', startBisTest)

// ---- Éditeur de tableaux ----
// Il se superpose au jeu ; « Essayer » repasse par le même chemin que le
// prototype (testLevel), donc un tableau édité se joue avec toutes les
// mécaniques, sans toucher à l'expédition ni aux registres.
// « Essayer » vient-il de l'éditeur ? Si oui, on doit pouvoir y retourner
// d'un geste, à tout instant — y compris depuis l'écran de fin d'essai.
let fromEditor = false
const editor = new LevelEditor(el('editor'), {
  play: (lvl) => {
    testLevel = lvl
    fromEditor = true
    run.bonbonneLiters = 0
    run.runTime = 0
    hasPlayed = true
    editor.close()
    document.body.classList.add('playing')
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
  libraryChanged: (levels) => {
    libraryLevels = levels.map((s) => s.level)
    renderRegistres()
    updateLibraryButton()
  },
})
// La fiche annonce quelle séquence sera jouée : celle du labo si la
// bibliothèque partagée en contient une, sinon l'expédition livrée.
const homeSeq = el('home-seq')
function updateLibraryButton(): void {
  homeSeq.textContent =
    libraryLevels.length > 0
      ? `Séquence du labo : ${libraryLevels.length} tableau(x) de la bibliothèque partagée.`
      : `Expédition livrée : ${TABLEAUX.length} tableaux. La bibliothèque partagée est vide.`
}
updateLibraryButton()

// Au démarrage : si la bibliothèque contient une séquence, elle remplace
// l'expédition livrée — mais jamais au milieu d'une partie en cours.
fetchLibrary().then((lib) => {
  if (!lib || lib.length === 0) return
  libraryLevels = lib.map((s) => s.level)
  updateLibraryButton()
  renderRegistres()
  if (!hasPlayed) {
    levelIndex = 0
    restart()
  }
})

// Sonde de débogage/test : le tableau en cours d'édition
;(window as unknown as { __editorLevel: () => LevelDef }).__editorLevel = () => editor.currentLevel()
// L'éditeur possède son document : on le rouvre tel qu'on l'a laissé, sans
// écraser le travail en cours par le tableau qu'on vient d'essayer.
function openEditor(): void {
  overlay.classList.remove('visible')
  document.body.classList.remove('playing')
  editor.open()
}
document.getElementById('start-editor')!.addEventListener('click', () => openEditor())
if (new URLSearchParams(location.search).has('editeur')) {
  hasPlayed = true
  openEditor()
}
// Au doigt, la fiche va à l'essentiel : les commandes démarrent repliées
if (window.matchMedia('(max-width: 700px)').matches) {
  document.getElementById('cmd-details')!.removeAttribute('open')
}
window.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
  if (e.key === 'Escape') {
    if (document.body.classList.contains('playing')) openHome()
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

camera.snapTo(sim.stats.centroidX, sim.stats.centroidY, 1)
const renderer = new Renderer(canvas, CAPACITY)
const loop = new FixedLoop()
const input = new Input()
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
}
// Dash de vapeur : viser fige le temps, relâcher lance le nuage (« air
// dash »). On ne retient qu'une chose entre deux images : était-on en visée.
const dash = { aiming: false }
const dashAimEl = el('dash-aim')
const dashCostEl = el('dash-cost')

function restart(): void {
  run.exitTimer = 0
  run.tableauTime = 0
  run.ended = false
  endgame.lastCall = false
  endgame.spent = false
  endgame.wasAiming = false
  vortex.timer = 0
  lossPrevLiters = -1
  lossRate = 0
  input.freezeIntent = false
  input.gasIntent = false
  applyLevel()
  sim = createSim(level)
  exposeSim()
  loop.reset()
  overlay.classList.remove('visible')
  if (document.body.classList.contains('playing')) {
    camera.startIntro(sim.bounds, window.innerWidth, window.innerHeight)
    showTableauCard()
  } else {
    camera.snapTo(sim.stats.centroidX, sim.stats.centroidY, camera.zoom)
  }
}

// Nouvelle expédition : retour au premier tableau, réserve vidée, vaisseau
// retiédi. Le protocole recommence avec l'échantillon suivant (§10).
function newExpedition(): void {
  levelIndex = 0
  run.bonbonneLiters = 0
  run.runTime = 0
  restart()
}

// Recommencer un tableau relance l'essai ; une expédition conclue (bilan
// affiché) ou un échantillon dispersé repart pour une expédition neuve.
// En mode prototype (21-A bis) : l'essai conclu ramène au protocole, la
// dispersion remet l'échantillon en cuve pour un nouvel essai du bis.
function resetAction(): void {
  if (testLevel) {
    if (run.ended) {
      if (fromEditor) {
        openEditor() // l'essai vient de l'éditeur : on y retourne
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
  if (run.ended || sim.dispersed) newExpedition()
  else restart()
}

document.getElementById('overlay-btn')!.addEventListener('click', resetAction)

const pane = createBench(params, monitor, {
  reset: resetAction,
  autoZoom: () => camera.resetAutoZoom(),
  tableaux: TABLEAUX.map((t) => t.name),
  gotoTableau: (index) => {
    testLevel = null // le banc navigue dans l'expédition, pas dans le prototype
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
        audioEveille = true
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
input.onZoom = (factor) => camera.zoomBy(factor, params)
input.onPan = (dx, dy) => camera.panBy(dx, dy)
input.onVortex = (clientX, clientY) => {
  if (params.vortexEnabled < 0.5) return // outil de test, coupé dans le protocole
  const w = camera.screenToWorld(clientX, clientY, window.innerWidth, window.innerHeight)
  vortex.x = w.x
  vortex.y = w.y
  vortex.timer = params.vortexDuration
  audio.vortex()
  bande.bruitage('vortex-sas', 0.55)
}

// Barre tactile : les commandes clavier/souris accessibles au doigt
const touchbar = document.getElementById('touchbar') as HTMLDivElement
function touchButton(label: string, title: string, onTap: () => void, cls = ''): HTMLButtonElement {
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

const chipLegend = touchButton('LÉGENDE', 'légende des surfaces (L)', toggleLegend, 'tb-chip')
const chipStates = touchButton('ÉTATS', 'les trois états : qui bloque quoi (E)', toggleStates, 'tb-chip')
const chipBench = touchButton('BANC', 'banc de réglage : la physique en direct', toggleBench, 'tb-chip')
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
touchButton('‹', 'ralentir le temps (,)', () => input.stepWarp(-1))
touchButton('›', 'accélérer le temps (.)', () => input.stepWarp(1))
const btnVortex = touchButton('🌀', 'vortex : armer puis toucher l’écran (clic droit)', () => {
  input.vortexArmed = !input.vortexArmed
})

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
touchButton('⌖', 'recadrer sur le corps (zoom et caméra auto)', () => camera.resetAutoZoom())
const btnSound = touchButton(
  '🔊',
  'son : couper / activer',
  () => {
    audio.resume()
    audio.setEnabled(!audio.enabled)
    if (audio.enabled) {
      bande.eveiller()
      audioEveille = true
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
  pane.refresh()
}

const overlayBtn = document.getElementById('overlay-btn') as HTMLButtonElement
// Relance discrète : elle n'apparaît qu'une fois la dernière impulsion donnée,
// et ne recouvre rien — on peut la laisser là et regarder la dérive finir.
const btnRelance = document.getElementById('relance') as HTMLButtonElement
// Le tableau seul reprend : la réserve déjà en bonbonne et le refroidissement
// du vaisseau, eux, ne se rembobinent pas — sinon la pression n'existerait plus.
btnRelance.addEventListener('click', () => restart())
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
      if (sim.stats.centroidX > 60 && sim.stats.centroidX < 560) text = TUTOR_TEXTS[3]
    } else if (tutorStep === 4) {
      const d = Math.hypot(sim.stats.centroidX - exitMouth.x, sim.stats.centroidY - exitMouth.y)
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

function showOverlay(title: string, sub: string, tone: 'success' | 'danger', btn?: string): void {
  overlayTitle.textContent = title
  overlaySub.textContent = sub
  overlay.classList.remove('success', 'danger', 'end')
  overlay.classList.add('visible', tone)
  if (btn) {
    overlay.classList.add('end')
    overlayBtn.textContent = btn
  }
}

// Bilan d'expédition : la phrase que le tampon raconte au protocole
function expeditionSummary(tableauxDone: number): string {
  return `${tableauxDone}/${playedLevels().length} tableaux · réserve ${run.bonbonneLiters.toFixed(2)} L · ${fmtTime(run.runTime)}`
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
let qualityTimer = 0

function updateQuality(dtReal: number): void {
  qualityTimer += dtReal
  if (qualityTimer < 1.5) return
  qualityTimer = 0
  if (fpsSmoothed < 42 && qualityLevel < QUALITY_LEVELS.length - 1) qualityLevel++
  else if (fpsSmoothed > 56 && qualityLevel > 0) qualityLevel--
}

function frame(now: number): void {
  const dtReal = Math.min((now - lastTime) / 1000, 0.1)
  lastTime = now
  elapsed += dtReal
  if (dtReal > 0) fpsSmoothed += (1 / dtReal - fpsSmoothed) * 0.05

  updateQuality(dtReal)
  const quality = QUALITY_LEVELS[qualityLevel]
  const vw = window.innerWidth
  const vh = window.innerHeight
  const dpr = Math.min(window.devicePixelRatio || 1, quality.dprCap)

  const aim = camera.screenToWorld(input.aimClientX, input.aimClientY, vw, vh)
  const tableauDone = run.exitTimer > 0 || run.ended

  // Zones d'état (refonte 2026) : une zone impose un état et verrouille le
  // sélecteur tant qu'on y est. L'intention du joueur est écrasée, pas effacée
  // — en ressortant, il retrouve l'état qu'il avait choisi.
  const zone: ZoneForce = zoneForceAt(level, sim.stats.centroidX, sim.stats.centroidY)
  if (zone !== 'libre') {
    input.freezeIntent = zone === 'glace'
    input.gasIntent = zone === 'vapeur'
  }
  sim.freezeIntent = input.freezeIntent
  sim.gasIntent = input.gasIntent
  sim.chill = chillNow() // le vaisseau refroidit : la physique suit
  if (input.aimActive) camera.cancelIntro() // le joueur agit : la caméra suit

  // ---- Dash de vapeur (« air dash ») : viser RALENTIT fortement le temps
  // (physique, refroidissement, chrono — tout suit, rien ne se fige),
  // relâcher lance le nuage vers le point visé. Une impulsion unique — pas
  // de recul, pas d'éjection ; la DISTANCE du doigt règle la puissance.
  const vif = !input.paused && !tableauDone && !sim.dispersed && !endgame.spent
  const dashAiming = vif && input.gasIntent && input.aimActive
  // Le ralenti s'entend : tout le mixage plonge sous un passe-bas, un
  // battement grave habite le temps suspendu, et l'air revient au dash.
  audio.setSlowMo(dashAiming)
  if (dash.aiming && !dashAiming) {
    // Relâcher déclenche ; changer d'état ou perdre la main en pleine visée
    // annule sans frais — la visée n'engage à rien tant qu'on n'a pas lâché.
    if (vif && input.gasIntent && !input.aimActive) {
      const spent = sim.gasDash(aim.x, aim.y)
      if (spent > 0) bande.bruitage('souffle-vapeur', 0.75)
    }
  }
  dash.aiming = dashAiming

  if (!input.paused && !tableauDone) {
    // Budget CPU des pas physiques : ~60 % du temps d'image, borné à 5-12 ms.
    // Sans cette borne, une image en retard impose plus de pas, coûte plus
    // cher, prend plus de retard — et la machine s'installe à 15-20 fps.
    const stepBudget = Math.min(12, Math.max(5, dtReal * 1000 * 0.6))
    const physT0 = performance.now()
    loop.advance(
      dtReal,
      dashAiming ? params.timeWarp * params.gasAimSlow : params.timeWarp,
      params.dt,
      () => {
        if (input.aimActive && !input.gasIntent && !sim.dispersed && !endgame.spent) {
          // En eau, maintenir éjecte ; en vapeur, la visée fige le temps —
          // le dash part au relâchement (voir plus haut), rien ne se pilote.
          sim.eject(aim.x, aim.y, params.dt)
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
      },
      stepBudget,
    )
    monitor.physMs += (performance.now() - physT0 - monitor.physMs) * 0.08
  }

  // Sortie (§7.1-7.2). Sas aspirant : la victoire n'arrive que lorsque le sas
  // a quasi tout bu (≤ 2 % du volume de base) — l'animation d'engloutissement
  // se joue en entier, le tampon ne coupe plus la spirale. Sas désactivé au
  // banc (rayon ou courant à 0) : règle historique, le centre du corps
  // franchit la boîte. L'eau avalée est mise en bonbonne dans les deux cas.
  const drainActive = params.exitRadius > 0 && params.exitPull > 0
  const drunk = sim.swallowed > 0 && sim.playerCount <= Math.max(6, sim.baseVolume * 0.02)
  const reached =
    !drainActive && pointInBox(sim.stats.centroidX, sim.stats.centroidY, level.exit)
  if (!tableauDone && !sim.dispersed && (drunk || reached) && testLevel) {
    // Prototype 21-A bis : l'essai conclut sans toucher aux registres ni à
    // l'expédition — on félicite, on ramène au protocole.
    const surplus = sim.liters() + sim.swallowed * params.litersPerParticle
    audio.collect()
    bande.ponctuation('sting-collecte', 0.85)
    run.ended = true
    showOverlay(
      fromEditor ? 'TABLEAU FRANCHI' : 'ESSAI 21-A BIS CONCLU',
      fromEditor
        ? `${surplus.toFixed(2)} L collectés en ${fmtTime(run.tableauTime)} — le tableau se termine. Retour à l’éditeur pour l’ajuster.`
        : `${surplus.toFixed(2)} L collectés en ${fmtTime(run.tableauTime)} — prototype de réfection du secteur A : vos impressions décideront de son sort.`,
      'success',
      fromEditor ? 'RETOUR À L’ÉDITEUR' : 'RETOUR AU PROTOCOLE',
    )
  } else if (!tableauDone && !sim.dispersed && (drunk || reached)) {
    // Prime de glace : ce que le sas a avalé SOLIDE vaut plus cher que ce
    // qu'il a bu goutte à goutte.
    const prime = sim.swallowedIce * params.litersPerParticle * params.iceCollectBonus
    const surplus = sim.liters() + sim.swallowed * params.litersPerParticle + prime
    run.bonbonneLiters += surplus
    const { newRecord } = records.noteCollection(level.code, surplus, run.tableauTime)
    // Publication au tableau d'honneur partagé : le serveur ne garde que le
    // meilleur — la réponse remet les registres affichés à jour.
    pushTableauRecord(level.code, surplus, run.tableauTime, records.operator()).then((b) => {
      if (b) {
        sharedBoard = b
        renderRegistres()
      }
    })
    const primeLine =
      prime >= 0.01 ? ` · prime de glace +${prime.toFixed(2)} L` : ''
    const recLine = newRecord
      ? ` · NOUVEAU RECORD DU TABLEAU (${surplus.toFixed(2)} L en ${fmtTime(run.tableauTime)})`
      : ` · record du tableau : ${records.tableauRecord(level.code)!.liters.toFixed(2)} L`
    audio.collect()
    // Le record a sa propre fanfare : la collecte ordinaire ne doit pas
    // sonner comme un exploit, sinon plus rien ne sonne comme un exploit.
    bande.ponctuation(newRecord ? 'sting-record' : 'sting-collecte', 0.85)
    if (levelIndex + 1 >= playedLevels().length) {
      // Dernier sas : l'expédition est achevée — bilan, et registres à jour
      run.ended = true
      const exp = records.noteExpedition(playedLevels().length, run.bonbonneLiters, run.runTime)
      pushExpeditionRecord(playedLevels().length, run.bonbonneLiters, run.runTime, records.operator()).then(
        (b) => {
          if (b) {
            sharedBoard = b
            renderRegistres()
          }
        },
      )
      renderRegistres()
      showOverlay(
        'EXPÉDITION ACHEVÉE',
        `${expeditionSummary(playedLevels().length)}${exp.newRecord ? ' · MEILLEURE EXPÉDITION DU PROTOCOLE' : ''} — le laboratoire n'a plus d'échantillon. Quelque part dans les conduites, de l'eau se souvient.`,
        'success',
        'NOUVELLE EXPÉDITION',
      )
    } else {
      run.exitTimer = EXIT_LINGER
      renderRegistres()
      showOverlay(
        'ÉCHANTILLON COLLECTÉ',
        `${surplus.toFixed(2)} L transférés en bonbonne${primeLine} — réserve : ${run.bonbonneLiters.toFixed(2)} L${recLine} · tableau suivant…`,
        'success',
      )
    }
  }
  if (run.exitTimer > 0) {
    run.exitTimer -= dtReal
    if (run.exitTimer <= 0) {
      overlay.classList.remove('visible')
      levelIndex = levelIndex + 1
      restart()
    }
  }

  // Ondes d'éjection : naissance côté visée, sur le bord du corps (pas en vapeur)
  if (input.aimActive && !input.gasIntent && !sim.dispersed && !input.paused && !tableauDone) {
    waveCarry += dtReal
    if (waveCarry >= WAVE_EVERY) {
      waveCarry = 0
      const dx = aim.x - sim.stats.centroidX
      const dy = aim.y - sim.stats.centroidY
      const len = Math.hypot(dx, dy) || 1
      const r = sim.stats.rmsRadius * 1.1
      waves.push({
        x: sim.stats.centroidX + (dx / len) * r,
        y: sim.stats.centroidY + (dy / len) * r,
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
    const fitZoom = Math.min(vw / (b.maxX - b.minX), vh / (b.maxY - b.minY)) * 0.94
    camera.snapTo((b.minX + b.maxX) * 0.5, (b.minY + b.maxY) * 0.5, fitZoom)
  } else {
    camera.update(dtReal, sim.stats.centroidX, sim.stats.centroidY, sim.stats.rmsRadius, vw, vh, params)
  }
  updateTutor(dtReal)
  updateWorldLabels(vw, vh)
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
  )
  monitor.renderMs += (performance.now() - renderT0 - monitor.renderMs) * 0.08

  const speed = Math.hypot(sim.stats.velX, sim.stats.velY)
  monitor.fps = fpsSmoothed
  monitor.particles = sim.count
  monitor.volume = sim.liters()
  monitor.speed = speed
  monitor.quality = qualityLevel

  btnPause.textContent = input.paused ? '▶' : '⏸'
  btnPause.classList.toggle('active', input.paused)
  chipLegend.classList.toggle('active', legend.classList.contains('visible'))
  chipStates.classList.toggle('active', statesPanel.classList.contains('visible'))
  chipBench.classList.toggle('active', benchHost !== null && benchHost.style.display !== 'none')
  chipEditor.style.display = fromEditor ? '' : 'none'
  btnVortex.classList.toggle('active', input.vortexArmed)
  btnVortex.style.display = params.vortexEnabled >= 0.5 ? '' : 'none'
  stateEau.classList.toggle('active', !input.freezeIntent && !input.gasIntent)
  stateGlace.classList.toggle('active', input.freezeIntent)
  stateVapeur.classList.toggle('active', input.gasIntent)
  // dans une zone imposée, le sélecteur se grise : le choix n'est plus offert
  const locked = zone !== 'libre'
  stateEau.disabled = locked
  stateGlace.disabled = locked
  stateVapeur.disabled = locked
  document.body.classList.toggle('state-locked', locked)
  btnSound.textContent = audio.enabled ? '🔊' : '🔇'

  // Instruments de bord
  const fraction = sim.baseVolume > 0 ? sim.playerCount / sim.baseVolume : 0
  hudTableau.textContent = testLevel ? 'BIS' : `nº ${levelIndex + 1}/${playedLevels().length}`
  // La coque refroidit : +21° au départ, −60° à froid complet — la pression
  // temporelle se lit ici (chiffre ET barre), jamais sur un chronomètre
  const coque = Math.round(21 - 81 * chillNow())
  hudCoque.textContent = `${coque > 0 ? '+' : ''}${coque}°`
  hudCoque.classList.toggle('warn', chillNow() > 0.75)
  coqueBar.style.width = `${(chillNow() * 100).toFixed(1)}%`
  hudBonbonne.textContent = `${run.bonbonneLiters.toFixed(2)} L`
  hudVolume.innerHTML = `${sim.liters().toFixed(2)} <small>L · ${sim.playerCount} part.</small>`
  gaugeFill.style.width = `${Math.min(100, fraction * 100).toFixed(1)}%`
  // Le seuil est un volume ABSOLU : sa position sur la jauge (graduée en % du
  // volume de départ) dépend donc du volume de base de ce tableau.
  const baseLiters = sim.baseVolume * params.litersPerParticle
  const seuilPct = baseLiters > 0 ? (params.criticalVolumeLiters / baseLiters) * 100 : 0
  gaugeThreshold.style.left = `${Math.min(100, seuilPct).toFixed(1)}%`
  hudSeuil.textContent = `${params.criticalVolumeLiters.toFixed(2)} L`
  hudVitesse.textContent = `${speed.toFixed(0)} u/s`

  // Débit de perte lissé : combien coûte l'action en cours, et à quoi
  const nowLiters = sim.liters()
  const simT = run.tableauTime
  if (lossPrevLiters >= 0 && simT > lossPrevT) {
    const inst = (lossPrevLiters - nowLiters) / (simT - lossPrevT)
    lossRate += (Math.max(0, inst) - lossRate) * Math.min(1, (simT - lossPrevT) * 4)
  } else if (simT < lossPrevT) {
    lossRate = 0
  }
  lossPrevLiters = nowLiters
  lossPrevT = simT
  if (lossRate > 0.02 && !sim.dispersed && !tableauDone) {
    const cause = input.gasIntent ? 'coût vapeur' : input.aimActive ? 'éjection' : 'surfaces'
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
  const alive = !sim.dispersed && !tableauDone && !run.ended
  if (alive && !endgame.spent) {
    endgame.lastCall = sim.liters() <= params.criticalVolumeLiters
    const aiming = input.aimActive && !input.paused
    // le relâchement du pointeur conclut l'impulsion en cours
    if (endgame.lastCall && endgame.wasAiming && !aiming) endgame.spent = true
    // plus rien à éjecter : le gel s'impose sans attendre le relâchement
    if (sim.playerCount <= 8) endgame.spent = true
    endgame.wasAiming = aiming
    if (endgame.spent) {
      input.freezeIntent = true // le froid saisit ce qu'il reste, l'élan est gardé
      input.gasIntent = false
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
  btnRelance.classList.toggle(
    'visible',
    (endgame.spent || sim.dispersed) &&
      document.body.classList.contains('playing') &&
      !tableauDone &&
      !run.ended,
  )

  const nearLast = alive && !endgame.spent && sim.liters() <= params.lastCallLiters
  const inDanger = alive && (endgame.spent || endgame.lastCall || nearLast)
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
  gaugeFill.classList.toggle('danger', (inDanger && endgame.lastCall) || endgame.spent || sim.dispersed)
  gaugeFill.classList.toggle('warn', nearLast && !endgame.lastCall && !sim.dispersed)

  // L'objectif : quand le sas sort de l'écran, une flèche le pointe depuis le
  // bord du cadre, avec la distance restante — on sait toujours où aller.
  const exitSx = vw * 0.5 + (exitMouth.x - camera.x) * camera.zoom
  const exitSy = vh * 0.5 - (exitMouth.y - camera.y) * camera.zoom
  const exitOnScreen = exitSx > 30 && exitSx < vw - 30 && exitSy > 92 && exitSy < vh - 140
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
    const dWorld = Math.hypot(exitMouth.x - sim.stats.centroidX, exitMouth.y - sim.stats.centroidY)
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
    const dMonde = Math.hypot(aim.x - sim.stats.centroidX, aim.y - sim.stats.centroidY)
    const puissance = Math.min(1, dMonde / Math.max(1, params.gasDashRange))
    dashCostEl.textContent = `DASH ${Math.round(puissance * 100)} % · −${(sim.liters() * params.gasDashCost).toFixed(2)} L`
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

  // ---- Sons : boucles continues et fronts d'état ----
  const audible = !input.paused && !tableauDone && !sim.dispersed
  // Le souffle continu d'éjection est retiré : l'eau se signale par la goutte
  // qui « ploc » à chaque impulsion (bande.bruitage), pas par un sifflement.
  audio.setEjectLevel(0)
  audio.setGasLevel(audible && gasCount > 0 ? (input.aimActive && input.gasIntent ? 1 : 0.35) : 0)

  // ---- Bande-son : décor sonore et ponctuations ----
  const enJeu = document.body.classList.contains('playing')
  bande.setScene(enJeu ? 'cuve' : 'accueil')
  bande.setChill(chillNow())
  bande.setZone(zone)
  // Le geste d'impulsion : une bouffée à l'amorce, pas un souffle continu —
  // la boucle procédurale tient déjà la durée.
  // L'éjection d'eau est une goutte qui tombe dans l'eau. Trois prises de
  // hauteurs différentes tirées au sort, plus un écart de hauteur de ±7 % :
  // le geste revient plusieurs fois par seconde, deux fois le même « bloop »
  // à la même note et l'oreille entend une machine, pas de l'eau.
  // En vapeur, la visée est silencieuse (le temps est figé) : le souffle
  // part au dash, dans le bloc de relâchement plus haut.
  const vise = audible && input.aimActive && !input.gasIntent
  if (vise && !sfx.aiming) {
    const prise = 1 + Math.floor(Math.random() * 3)
    bande.bruitage(`ejection-${prise}` as Bruitage, 0.7, 0.93 + Math.random() * 0.14)
  }
  sfx.aiming = vise
  // Une éponge qui boit : on sonne par gorgée, pas par goutte. Le compteur
  // est recopié à chaque image — au changement de tableau il repart à zéro
  // avec la simulation, sans laisser le son muet pour le reste de la partie.
  if (sim.spongeBites < sfx.spongeBites) sfx.spongeBites = sim.spongeBites // nouveau tableau
  if (sim.spongeBites - sfx.spongeBites >= 3) {
    bande.bruitage('eponge', 0.45)
    sfx.spongeBites = sim.spongeBites
  }
  if (endgame.lastCall && !sfx.lastCall) bande.ponctuation('sting-derniere-impulsion', 0.8)
  sfx.lastCall = endgame.lastCall
  if (endgame.spent && !sfx.spent) bande.ponctuation('fin-de-course', 0.85)
  sfx.spent = endgame.spent
  const drainOn = params.exitRadius > 0 && params.exitPull > 0
  const mouthDist = Math.hypot(sim.stats.centroidX - exitMouth.x, sim.stats.centroidY - exitMouth.y)
  audio.setDrainLevel(
    audible && drainOn ? Math.max(0, 1 - mouthDist / Math.max(1, params.exitRadius)) : 0,
  )
  if (sim.swallowed > sfx.swallowed) audio.pulseSwallow(sim.swallowed - sfx.swallowed)
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
      records.noteExpedition(levelIndex, run.bonbonneLiters, run.runTime)
      if (levelIndex > 0 || run.bonbonneLiters >= 0.01) {
        pushExpeditionRecord(levelIndex, run.bonbonneLiters, run.runTime, records.operator()).then(
          (b) => {
            if (b) {
              sharedBoard = b
              renderRegistres()
            }
          },
        )
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
      ? `${zone.toUpperCase()} — IMPOSÉE`
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

  // Relevé vivant de la fiche d'essai
  if (!document.body.classList.contains('playing')) {
    homeVolume.textContent = `${sim.liters().toFixed(2)} L`
    homeParticles.textContent = `${sim.playerCount}`
    homeState.textContent = sim.dispersed ? 'dispersé' : 'en dérive'
  }

  // Plus d'écran de fin : ni dispersion, ni fin de course. Ce qui reste de
  // l'échantillon dérive à l'écran, et le bouton de relance attend en bas
  // sans rien recouvrir. Seuls la victoire et le bilan d'expédition ouvrent
  // encore un tampon. (Recalculé, pas tableauDone : si la victoire tombe dans
  // cette image, le tampon SAS ATTEINT ne doit pas être effacé aussitôt.)
  if (run.exitTimer <= 0 && !run.ended) overlay.classList.remove('visible')

  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
