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
  TABLEAU_10,
  TABLEAU_1BIS,
  TABLEAU_8,
  TABLEAU_9,
  TABLEAUX,
  pointInBox,
  zoneForceAt,
  zoneName,
  type LevelDef,
  type ObstacleBox,
  type ZoneForce,
} from './game/level'
import { LevelEditor } from './editor/editor'
import { traceLaser, type TraceResultat } from './game/laser'
import { BOUTON, Manette } from './game/manette'
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
  if (btnMute) btnMute.textContent = audio.enabled ? '🔊 SON' : '🔇 MUET'
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

// Un essai hors expédition : un tableau à part (prototype, salle laser,
// tableau d'éditeur), sans toucher aux registres. La FILE enchaîne les
// tableaux d'essai au sas — la trilogie laser se joue ainsi.
let testLevel: LevelDef | null = null
let testQueue: LevelDef[] = []
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
// ---- Onboarding tactile : trois gestes, montrés une fois, au premier
// lancement sur écran tactile. Le voile intercepte les touchers (il couvre
// le canvas) et fige l'essai le temps de la lecture.
const onboardEl = document.getElementById('onboard') as HTMLDivElement
let obEtape = 0
function majOnboard(): void {
  const etapes = Array.from(onboardEl.querySelectorAll<HTMLElement>('.ob-etape'))
  etapes.forEach((e, i) => {
    e.hidden = i !== obEtape
  })
  const points = Array.from(onboardEl.querySelectorAll<HTMLElement>('.ob-points i'))
  points.forEach((p, i) => p.classList.toggle('on', i === obEtape))
  const suite = onboardEl.querySelector<HTMLElement>('.ob-suite')
  if (suite) suite.textContent = obEtape >= 3 ? 'TOUCHER POUR PLONGER' : 'TOUCHER POUR CONTINUER'
}
function montrerOnboard(): void {
  if (!window.matchMedia('(pointer: coarse)').matches) return
  if (localStorage.getItem('projet21.onboard.v1')) return
  obEtape = 0
  majOnboard()
  onboardEl.hidden = false
  input.paused = true
}
onboardEl.addEventListener('pointerdown', (e) => {
  e.stopPropagation()
  e.preventDefault()
  obEtape++
  if (obEtape > 3) {
    onboardEl.hidden = true
    try {
      localStorage.setItem('projet21.onboard.v1', '1')
    } catch {
      // stockage refusé : l'onboarding se remontrera, sans gravité
    }
    input.paused = false
  } else {
    majOnboard()
  }
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
document.getElementById('home-recs')?.addEventListener('click', ouvrirRecs)
recsEl.addEventListener('pointerdown', (e) => {
  if (e.target === recsEl) fermerRecs()
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

const homeRestartBtn = document.getElementById('home-restart') as HTMLButtonElement
function closeHome(): void {
  if (requireName()) return // pas de plongée sans opérateur identifié
  document.body.classList.add('playing')
  input.paused = false // la fiche figeait l'essai : il repart
  startBtn.textContent = "REPRENDRE L'ESSAI"
  homeRestartBtn.hidden = false
  if (!hasPlayed) {
    // Premier lancement : zoom d'ouverture (les redémarrages ont le leur),
    // et la prise en main tactile pour qui joue au doigt
    hasPlayed = true
    camera.startIntro(sim.bounds, window.innerWidth, window.innerHeight)
    showTableauCard()
    montrerOnboard()
  }
}
function openHome(): void {
  document.body.classList.remove('playing')
  appelOeil()
  // La fiche fige l'essai : revenir au menu, c'est faire une pause — la
  // cuve n'avance plus dans le dos du joueur.
  if (hasPlayed) input.paused = true
  homeRestartBtn.hidden = !hasPlayed
}
startBtn.addEventListener('click', closeHome)
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
function startTest(niveaux: LevelDef[]): void {
  if (requireName()) {
    openHome() // le champ du nom vit sur la fiche : on la montre pour le remplir
    return
  }
  testLevel = niveaux[0]
  testQueue = niveaux.slice(1)
  fromEditor = false
  run.bonbonneLiters = 0
  run.runTime = 0
  hasPlayed = true
  // « playing » d'abord : restart() se charge alors lui-même du plan large et
  // du carton de journal — sinon les deux se jouaient en double, en décalé.
  document.body.classList.add('playing')
  input.paused = false
  startBtn.textContent = "REPRENDRE L'ESSAI"
  homeRestartBtn.hidden = false
  restart()
  montrerOnboard() // premier contact tactile : la prise en main d'abord
}
function startBisTest(): void {
  startTest([TABLEAU_1BIS])
}
// Le bouton de la fiche mène aux salles laser : la trilogie 21-H → 21-J
// (miroir, prisme, plasma), enchaînée sas après sas.
startBisBtn.addEventListener('click', () => startTest([TABLEAU_8, TABLEAU_9, TABLEAU_10]))

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
// ---- Le panneau COMMANDES : trois onglets (PC, manette, tactile) ----
// Les commandes ont quitté la fiche : un bouton, un panneau, trois écrans.
const cmdsEl = document.getElementById('cmds') as HTMLDivElement
function ongletCmds(nom: string): void {
  for (const b of Array.from(cmdsEl.querySelectorAll<HTMLButtonElement>('[data-onglet]'))) {
    b.classList.toggle('on', b.dataset.onglet === nom)
  }
  for (const p of Array.from(cmdsEl.querySelectorAll<HTMLElement>('[data-page]'))) {
    p.hidden = p.dataset.page !== nom
  }
}
document.getElementById('home-cmds')?.addEventListener('click', () => {
  // l'onglet d'accueil suit la façon de jouer : tactile au doigt, sinon PC
  ongletCmds(window.matchMedia('(pointer: coarse)').matches ? 'tactile' : 'pc')
  cmdsEl.hidden = false
})
for (const b of Array.from(cmdsEl.querySelectorAll<HTMLButtonElement>('[data-onglet]'))) {
  b.addEventListener('click', () => ongletCmds(b.dataset.onglet!))
}
document.getElementById('cmds-fermer')?.addEventListener('click', () => {
  cmdsEl.hidden = true
})
cmdsEl.addEventListener('pointerdown', (e) => {
  if (e.target === cmdsEl) cmdsEl.hidden = true // toucher le voile referme
})

// ---- Plein écran : PC comme mobile — masqué là où l'API manque (iOS) ----
const pleinBtn = document.getElementById('home-plein') as HTMLButtonElement | null
if (pleinBtn) {
  if (!document.documentElement.requestFullscreen) {
    pleinBtn.hidden = true
  } else {
    pleinBtn.addEventListener('click', () => {
      if (document.fullscreenElement) void document.exitFullscreen()
      else void document.documentElement.requestFullscreen().catch(() => {})
    })
    document.addEventListener('fullscreenchange', () => {
      pleinBtn.textContent = document.fullscreenElement ? '⛶ QUITTER LE PLEIN ÉCRAN' : '⛶ PLEIN ÉCRAN'
    })
  }
}
window.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
  if (e.key === 'Escape') {
    if (!recsEl.hidden) fermerRecs() // les voiles d'abord
    else if (!cmdsEl.hidden) cmdsEl.hidden = true
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
;(window as unknown as { __zones: (z: NonNullable<LevelDef['zones']>) => void }).__zones = (z) => {
  level.zones = z
  buildWorldLabels()
}

camera.snapTo(sim.stats.centroidX, sim.stats.centroidY, 1)
const renderer = new Renderer(canvas, CAPACITY)
const loop = new FixedLoop()
const input = new Input()

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
  return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.pointerEvents !== 'none'
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

// ---- Navigation de la FICHE à la manette ----
// Croix (ou stick) haut/bas : passer d'un bouton à l'autre — A : valider.
// Le bouton visé porte un liseré (classe pad-focus).
// dans l'ORDRE VISUEL de la fiche : la croix descend comme l'œil lit
const FICHE_BOUTONS = [
  'start',
  'home-restart',
  'start-bis',
  'start-editor',
  'home-cmds',
  'home-recs',
  'home-mute',
  'home-plein',
]
let ficheFocus = 0
let ficheNavPrete = true // anti-répétition du stick
function ficheNavigue(): void {
  // ☰ (Start) depuis la fiche : reprendre l'essai directement
  if (manette.edge(BOUTON.START)) {
    document.getElementById('start')?.click()
    return
  }
  const visibles = FICHE_BOUTONS.map((id) => document.getElementById(id)).filter(boutonVisible)
  if (visibles.length === 0) return
  // le stick fait aussi la navigation : un coup franc vers le haut/bas
  let delta = 0
  if (manette.edge(BOUTON.HAUT)) delta = -1
  else if (manette.edge(BOUTON.BAS)) delta = 1
  else if (manette.force > 0.55 && Math.abs(manette.dirY) > 0.6) {
    if (ficheNavPrete) {
      delta = manette.dirY > 0 ? 1 : -1
      ficheNavPrete = false
    }
  }
  if (manette.force < 0.3) ficheNavPrete = true
  ficheFocus = Math.max(0, Math.min(visibles.length - 1, ficheFocus + delta))
  for (let i = 0; i < visibles.length; i++) {
    visibles[i].classList.toggle('pad-focus', manette.active && i === ficheFocus)
  }
  if (manette.edge(BOUTON.A)) visibles[ficheFocus].click()
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

// ---- Mécanismes laser (palier 1) ----
// Le faisceau se trace une fois par IMAGE (pas par pas physique) : la glace
// bouge à l'échelle de l'image, pas du sous-pas. Une cible reste « allumée »
// un court instant après le dernier photon (persistance) : la porte ne
// clignote pas quand le miroir tremble.
const fxCanvas = document.getElementById('fx-canvas') as HTMLCanvasElement
const fxCtx = fxCanvas.getContext('2d')!
const laserEtat = {
  vues: [] as TraceResultat[],
  allumees: [] as boolean[], // cibles À VERROU : un passage du faisceau suffit
  portesOuvertes: [] as boolean[],
  doorsKey: '', // signature des portes fermées envoyées au solveur
}
// La superposition des mécanismes : faisceaux, émetteurs, cibles, portes —
// dessinée en 2D par-dessus la cuve, avec la même caméra que le rendu WebGL.
function drawMecanismes(vw: number, vh: number, dpr: number): void {
  const lasers = level.lasers ?? []
  const cibles = level.cibles ?? []
  const portes = level.portes ?? []
  const rails = level.rails ?? []
  const actif = lasers.length + cibles.length + portes.length + rails.length > 0
  const dprC = Math.min(dpr, 2)
  if (fxCanvas.width !== Math.round(vw * dprC) || fxCanvas.height !== Math.round(vh * dprC)) {
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
  for (const rail of rails) {
    const pts = rail.points
    if (pts.length < 2) continue
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
    // la ligne elle-même
    g.strokeStyle = 'rgba(150,120,255,0.45)'
    g.lineWidth = Math.max(1, 2 * z)
    g.setLineDash([2 * z, 9 * z])
    chemin()
    g.stroke()
    g.setLineDash([])
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
        g.moveTo(p.sx - (ex + ey * 0.6) * taille, p.sy - (ey - ex * 0.6) * taille)
        g.lineTo(p.sx, p.sy)
        g.lineTo(p.sx - (ex - ey * 0.6) * taille, p.sy - (ey + ex * 0.6) * taille)
        g.stroke()
      }
    }
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
      [10 * z, `rgba(255,60,50,${(0.10 * scint).toFixed(3)})`],
      [4.5 * z, `rgba(255,90,70,${(0.30 * scint).toFixed(3)})`],
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
    let k = 0
    while (k + 1 < chemins.length) {
      const mode = modeDe(t.points[k])
      let e = k + 1
      while (e + 1 < chemins.length && modeDe(t.points[e]) === mode) e++
      for (const [larg, coul] of palettes[mode]) {
        g.strokeStyle = coul
        g.lineWidth = Math.max(0.8, larg)
        g.lineJoin = 'round'
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(chemins[k].sx, chemins[k].sy)
        for (let m = k + 1; m <= e; m++) g.lineTo(chemins[m].sx, chemins[m].sy)
        g.stroke()
      }
      k = e
    }
  }
  g.globalCompositeOperation = 'source-over'

  // émetteurs : un fût court orienté, une bouche lumineuse
  for (const em of lasers) {
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

  // cibles : pastille éteinte / embrasée
  for (let c = 0; c < cibles.length; c++) {
    const t = cibles[c]
    const p = S(t.x, t.y)
    const lit = laserEtat.allumees[c] === true
    const r = Math.max(4, t.r * z)
    g.beginPath()
    g.arc(p.sx, p.sy, r, 0, Math.PI * 2)
    g.fillStyle = lit ? 'rgba(120,255,190,0.30)' : 'rgba(40,56,66,0.6)'
    g.fill()
    g.lineWidth = 2
    g.strokeStyle = lit ? '#6dffb8' : '#5c7285'
    g.stroke()
    g.beginPath()
    g.arc(p.sx, p.sy, r * 0.45, 0, Math.PI * 2)
    g.fillStyle = lit ? '#a9ffd6' : '#33424e'
    g.fill()
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
    manette.connectee && manette.lastActivity > input.lastPointerAt && input.touchCount === 0
  const veut = aMain && enJeu && manette.force > 0.03 && !dash.aiming && !input.paused
  // naissance et extinction en douceur
  fleche.alpha += ((veut ? 1 : 0) - fleche.alpha) * Math.min(1, dtReal * 9)
  if (fleche.alpha < 0.02) return
  // cap : on tourne par le plus court chemin, sans à-coup
  const cible = Math.atan2(manette.dirY, manette.dirX)
  let d = cible - fleche.ang
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  fleche.ang += d * Math.min(1, dtReal * 14)
  const lenCible = (36 + 90 * manette.force) * Math.max(0.5, Math.min(1.6, camera.zoom))
  fleche.len += (lenCible - fleche.len) * Math.min(1, dtReal * 10)

  const dprC = Math.min(dpr, 2)
  const g = fxCtx
  g.setTransform(dprC, 0, 0, dprC, 0, 0)
  const bx = window.innerWidth * 0.5 + (sim.stats.centroidX - camera.x) * camera.zoom
  const by = window.innerHeight * 0.5 - (sim.stats.centroidY - camera.y) * camera.zoom
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
function resetLasers(): void {
  laserEtat.vues = []
  laserEtat.allumees = (level.cibles ?? []).map(() => false)
  laserEtat.portesOuvertes = (level.portes ?? []).map(() => false)
  laserEtat.doorsKey = ''
  lastRailTime = 0
  railsEngages.clear()
}
const dashAimEl = el('dash-aim')
const dashCostEl = el('dash-cost')

function restart(): void {
  run.exitTimer = 0
  run.tableauTime = 0
  run.ended = false
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
  applyLevel()
  sim = createSim(level)
  exposeSim()
  resetLasers()
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
      // la file d'essai continue : le sas mène à la salle suivante
      if (testQueue.length > 0) {
        testLevel = testQueue.shift()!
        run.runTime = 0
        restart()
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
touchButton('‹', 'ralentir le temps (,)', () => input.stepWarp(-1), 'tb-warp')
touchButton('›', 'accélérer le temps (.)', () => input.stepWarp(1), 'tb-warp')
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
touchButton('⌖', 'recadrer sur le corps (zoom et caméra auto)', () => camera.resetAutoZoom())
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
  pane.refresh()
}

const overlayBtn = document.getElementById('overlay-btn') as HTMLButtonElement
// Relance discrète : elle n'apparaît qu'une fois la dernière impulsion donnée,
// et ne recouvre rien — on peut la laisser là et regarder la dérive finir.
// Pastilles du HUD : un toucher montre le nom de la donnée, brièvement
for (const chip of Array.from(document.querySelectorAll<HTMLButtonElement>('.hud-chip'))) {
  chip.addEventListener('click', () => {
    chip.classList.add('ouvert')
    window.setTimeout(() => chip.classList.remove('ouvert'), 2400)
  })
}

const btnRelance = document.getElementById('relance') as HTMLButtonElement
// Continuer : le corps principal est bu, le joueur conclut quand il veut
const btnContinuer = document.getElementById('continuer') as HTMLButtonElement
let continuerVoulu = false
btnContinuer.addEventListener('click', () => {
  continuerVoulu = true
  btnContinuer.classList.remove('visible')
})
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

  // ---- Manette : elle écrit dans le même pointeur que le doigt ----
  manette.poll(performance.now() / 1000)
  if (manette.connectee) {
    const enJeu = document.body.classList.contains('playing')
    if (!enJeu) {
      // la FICHE : croix/stick pour choisir, A pour valider
      ficheNavigue()
    } else if (manette.edge(BOUTON.A) && clicMenuManette()) {
      // écrans de jeu (relance, fin de tableau) : le clic a consommé le A
    } else if (enJeu) {
      // ☰ (Start) : pause ET menu — la fiche fige l'essai en s'ouvrant
      if (manette.edge(BOUTON.START)) openHome()
      if (manette.edge(BOUTON.SELECT)) input.onReset?.()
      if (manette.edge(BOUTON.LB)) input.toggleFreeze()
      if (manette.edge(BOUTON.RB)) input.toggleGas()
      if (manette.edge(BOUTON.X)) {
        // retour à l'eau, quel que soit l'état
        if (input.freezeIntent) input.toggleFreeze()
        else if (input.gasIntent) input.toggleGas()
      }
      if (manette.edge(BOUTON.GAUCHE)) input.stepWarp(-1)
      if (manette.edge(BOUTON.DROITE)) input.stepWarp(1)
      if (manette.zoomAvant) camera.zoomBy(Math.pow(1.9, dtReal), params)
      if (manette.zoomArriere) camera.zoomBy(Math.pow(1.9, -dtReal), params)
      // les grosses gâchettes zooment, la pression dose la vitesse
      if (manette.rtVal > 0.02) camera.zoomBy(Math.pow(2.2, manette.rtVal * dtReal), params)
      if (manette.ltVal > 0.02) camera.zoomBy(Math.pow(2.2, -manette.ltVal * dtReal), params)
      if (manette.panX !== 0 || manette.panY !== 0) {
        // pousser à droite REGARDE à droite (le pan de drag est inversé)
        camera.panBy(-manette.panX * 900 * dtReal, -manette.panY * 900 * dtReal)
      }
      // viser et agir — seulement si la manette a parlé plus récemment que
      // la souris, et qu'aucun doigt n'est posé. Le STICK dit où l'on veut
      // ALLER : en eau, l'éjection part automatiquement à l'opposé (c'est
      // elle qui pousse) ; en vapeur, le dash part dans la direction du stick.
      if (input.touchCount === 0 && manette.lastActivity > input.lastPointerAt) {
        const scx = vw * 0.5 + (sim.stats.centroidX - camera.x) * camera.zoom
        const scy = vh * 0.5 - (sim.stats.centroidY - camera.y) * camera.zoom
        // pleine inclinaison = pleine puissance de dash ; un plancher garde
        // la direction lisible même stick à peine poussé
        const rPx = (0.15 + 0.85 * manette.force) * params.gasDashRange * camera.zoom
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
  // Le ralenti s'entend : tout le mixage plonge sous un passe-bas (et
  // baisse de moitié), un cœur au ralenti bat, la texture du temps suspendu
  // s'ouvre — seule à rester nette —, et l'air revient au dash.
  audio.setSlowMo(dashAiming)
  bande.setSuspendu(dashAiming)
  if (dash.aiming && !dashAiming) {
    // Relâcher déclenche ; changer d'état ou perdre la main en pleine visée
    // annule sans frais — la visée n'engage à rien tant qu'on n'a pas lâché.
    if (vif && input.gasIntent && !input.aimActive) {
      const spent = sim.gasDash(aim.x, aim.y)
      if (spent > 0) manette.rumble(0.6, 90) // le dash se voit, il ne souffle plus
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

  // ---- Lasers : traçage, cibles, portes ----
  const lasers = level.lasers ?? []
  if (lasers.length > 0) {
    const cibles = level.cibles ?? []
    const portes = level.portes ?? []
    if (laserEtat.allumees.length !== cibles.length) resetLasers()
    // portes fermées AVANT ce traçage : un faisceau ne traverse pas une porte
    // encore close — elle s'ouvrira pour l'image suivante
    const fermees = portes.filter((_, i) => !laserEtat.portesOuvertes[i])
    const rIce = params.particleSpacing * 1.3
    laserEtat.vues = lasers.map((em) =>
      traceLaser(em, {
        bounds: sim.bounds,
        boxes: level.boxes,
        portesFermees: fermees,
        cibles,
        // contact précis, normale MOYENNÉE large : le miroir est une facette
        // plane, pas une râpe — le reflet ne tremble plus à chaque bosse
        iceNormal: (x, y) => sim.iceNormalAt(x, y, rIce, params.laserMirrorSmooth),
        // palier 2 : le corps liquide est un prisme — le rayon se plie à
        // chaque dioptre, et se piège sous la surface au-delà de ~49°.
        // Le milieu est LISSÉ au même rayon que la normale : la surface
        // effective est l'isoligne de densité, pas le grain des particules.
        eau: {
          dedans: (x, y) => sim.liquidAt(x, y, params.laserMirrorSmooth * 0.6),
          normale: (x, y) => sim.liquidNormalAt(x, y, params.laserMirrorSmooth),
        },
        indice: params.laserRefractIndex,
        // palier 3 : la vapeur ionise le faisceau en arc de plasma, que
        // les rails magnétiques capturent et guident
        vapeur: (x, y) => sim.gasAt(x, y, rIce),
        rails: level.rails ?? [],
        railRadius: params.plasmaRailRadius,
      }),
    )
    // cibles À VERROU : un seul passage du faisceau allume pour de bon —
    // pas besoin de tenir le rayon, l'activation est acquise (jusqu'au
    // Recommencer). Les portes asservies restent donc ouvertes.
    for (const t of laserEtat.vues) {
      for (const c of t.touchees) laserEtat.allumees[c] = true
    }
    laserEtat.portesOuvertes = portes.map((p) => laserEtat.allumees[p.cible] === true)
    // le solveur ne reçoit que les portes closes — recomposé au changement
    const closes = portes.filter((_, i) => !laserEtat.portesOuvertes[i])
    const cle = closes.map((p) => `${p.minX},${p.minY},${p.maxX},${p.maxY}`).join(';')
    if (cle !== laserEtat.doorsKey) {
      laserEtat.doorsKey = cle
      sim.setDoors(closes)
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
      for (const t of laserEtat.vues) for (const ri of t.railsSuivis) actifs.add(ri)
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
  const drunk = (sim.swallowed > 0 && sim.count <= seuilBu) || (aspireAssez && continuerVoulu)
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
  drawMecanismes(vw, vh, dpr)
  drawFleche(dtReal, dpr)
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
    const aiming = input.aimActive && !input.paused
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
    alive && !endgame.spent && !endgame.enCollecte && sim.liters() <= params.lastCallLiters
  // une fois le CONTINUER offert, plus aucune bannière funeste : le bouton
  // est l'interface de fin, l'alarme n'a plus rien à dire
  const inDanger = alive && !aspireAssez && (endgame.spent || endgame.lastCall || nearLast)
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
    (inDanger && endgame.lastCall) || (endgame.spent && !aspireAssez) || sim.dispersed,
  )
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
  // L'éjection d'eau est une goutte qui tombe dans l'eau — et elle GOUTTE :
  // une première au contact, puis une toutes les ~0,17 s tant qu'on maintient,
  // à cadence légèrement irrégulière (l'eau n'est pas un métronome). Trois
  // prises de hauteurs différentes tirées au sort, plus un écart de ±7 % :
  // deux fois le même « bloop » à la même note et l'oreille entend une
  // machine. En vapeur, la visée est silencieuse — le souffle part au dash.
  // pas de « ploc » en glace : un palet n'éjecte rien, il n'a pas à goutter
  const vise = audible && input.aimActive && !input.gasIntent && !input.freezeIntent
  if (vise) {
    sfx.dropTimer -= dtReal
    if (!sfx.aiming || sfx.dropTimer <= 0) {
      const prise = 1 + Math.floor(Math.random() * 3)
      bande.bruitage(`ejection-${prise}` as Bruitage, 0.65, 0.93 + Math.random() * 0.14)
      sfx.dropTimer = 0.12 + Math.random() * 0.1
    }
  }
  sfx.aiming = vise
  // L'éponge boit en silence : son bruit de succion agaçait plus qu'il
  // n'informait — la jauge et le feutre qui se remplit suffisent à le dire.
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
