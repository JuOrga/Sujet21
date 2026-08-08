import '@fontsource/michroma'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
import { DEFAULT_PARAMS, type SimParams } from './sim/params'
import { FluidSim, KIND_PLAYER } from './sim/solver'
import { Camera } from './render/camera'
import { Renderer } from './render/renderer'
import { FixedLoop } from './game/loop'
import { Input } from './game/input'
import { MAT_EXIT, TABLEAU_1, pointInBox, type LevelDef, type ObstacleBox } from './game/level'
import { createBench, type BenchMonitor } from './bench/bench'

const CAPACITY = 4096
const EXIT_LINGER = 2.6 // secondes d'affichage du bilan avant le tableau suivant

const params: SimParams = { ...DEFAULT_PARAMS }

// État de la partie (§7.2) : le surplus de chaque tableau est mis en bonbonne.
const run = {
  tableau: 1,
  bonbonneLiters: 0,
  exitTimer: 0, // > 0 : bilan de sortie affiché, redémarrage imminent
}

function createSim(level: LevelDef): FluidSim {
  const sim = new FluidSim(params, level.bounds, CAPACITY)
  sim.setLevel(level.boxes, level.sponges)
  sim.spawnDisc(level.spawn.x, level.spawn.y, level.spawn.n, KIND_PLAYER)
  sim.relabel()
  return sim
}

const level = TABLEAU_1
// Aide au level design : ?spawn=x,y place le corps où l'on veut
{
  const spawnParam = new URLSearchParams(location.search).get('spawn')
  if (spawnParam) {
    const [sx, sy] = spawnParam.split(',').map(Number)
    if (Number.isFinite(sx) && Number.isFinite(sy)) {
      level.spawn = { ...level.spawn, x: sx, y: sy }
    }
  }
}
// Les boîtes rendues incluent le sas (rendu seulement, pas de physique)
const renderBoxes: ObstacleBox[] = [...level.boxes, { ...level.exit, material: MAT_EXIT }]

const canvas = document.getElementById('glcanvas') as HTMLCanvasElement
const overlay = document.getElementById('overlay') as HTMLDivElement
const overlayTitle = document.getElementById('overlay-title') as HTMLDivElement
const overlaySub = document.getElementById('overlay-sub') as HTMLDivElement

const el = (id: string) => document.getElementById(id) as HTMLElement
const hudTableau = el('hud-tableau')
const hudBonbonne = el('hud-bonbonne')
const hudVolume = el('hud-volume')
const hudSeuil = el('hud-seuil')
const hudVitesse = el('hud-vitesse')
const hudState = el('hud-state')
const hudWarp = el('hud-warp')
const gaugeFill = el('gauge-fill')
const gaugeThreshold = el('gauge-threshold')
const homeVolume = el('home-volume')
const homeParticles = el('home-particles')
const homeState = el('home-state')

// Fiche d'essai : visible au chargement ; « échap » ou ≡ pour y revenir.
// L'essai continue de dériver derrière la fiche — elle observe, elle ne fige pas.
const startBtn = document.getElementById('start') as HTMLButtonElement
function closeHome(): void {
  document.body.classList.add('playing')
  startBtn.textContent = "REPRENDRE L'ESSAI"
}
function openHome(): void {
  document.body.classList.remove('playing')
}
startBtn.addEventListener('click', closeHome)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (document.body.classList.contains('playing')) openHome()
    else closeHome()
  }
})

let sim = createSim(level)
const camera = new Camera()
camera.snapTo(sim.stats.centroidX, sim.stats.centroidY, 1)
const renderer = new Renderer(canvas, CAPACITY)
const loop = new FixedLoop()
const input = new Input()
input.attach(canvas)

const monitor: BenchMonitor = { fps: 0, particles: 0, volume: 0, speed: 0, quality: 0, overview: false }

// Vortex de regroupement : déclenché au clic droit, actif vortexDuration s
const vortex = { x: 0, y: 0, timer: 0 }

// Ondes d'éjection (rendu seulement) : une onde traverse le corps à chaque
// salve d'éjection, depuis le point de sortie de la matière
const MAX_WAVES = 8
const WAVE_EVERY = 0.16 // s d'éjection continue entre deux ondes
const waves: { x: number; y: number; t: number }[] = []
const waveScratch = new Float32Array(MAX_WAVES * 4)
let waveCarry = WAVE_EVERY // première salve : onde immédiate

function restart(): void {
  run.exitTimer = 0
  vortex.timer = 0
  sim = createSim(level)
  loop.reset()
  camera.snapTo(sim.stats.centroidX, sim.stats.centroidY, camera.zoom)
}

const pane = createBench(params, monitor, {
  reset: restart,
  autoZoom: () => camera.resetAutoZoom(),
})
input.onReset = restart
input.onZoom = (factor) => camera.zoomBy(factor, params)
input.onVortex = (clientX, clientY) => {
  const w = camera.screenToWorld(clientX, clientY, window.innerWidth, window.innerHeight)
  vortex.x = w.x
  vortex.y = w.y
  vortex.timer = params.vortexDuration
}

// Barre tactile : les commandes clavier/souris accessibles au doigt
const touchbar = document.getElementById('touchbar') as HTMLDivElement
function touchButton(label: string, title: string, onTap: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.textContent = label
  b.title = title
  b.addEventListener('click', onTap)
  touchbar.appendChild(b)
  return b
}
const btnPause = touchButton('⏸', 'pause (espace)', () => input.togglePause())
touchButton('‹', 'ralentir le temps (,)', () => input.stepWarp(-1))
touchButton('›', 'accélérer le temps (.)', () => input.stepWarp(1))
const btnVortex = touchButton('🌀', 'vortex : armer puis toucher l’écran (clic droit)', () => {
  input.vortexArmed = !input.vortexArmed
})
touchButton('⌖', 'zoom auto (après un zoom molette/pincement)', () => camera.resetAutoZoom())
touchButton('↺', 'recommencer (R)', restart)
touchButton('≡', 'fiche d’essai (échap)', openHome)
input.onTimeWarpChange = (warp) => {
  params.timeWarp = warp
  pane.refresh()
}

function showOverlay(title: string, sub: string, tone: 'success' | 'danger'): void {
  overlayTitle.textContent = title
  overlaySub.textContent = sub
  overlay.classList.remove('success', 'danger')
  overlay.classList.add('visible', tone)
}

let lastTime = performance.now()
let elapsed = 0
let fpsSmoothed = 60

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
  const tableauDone = run.exitTimer > 0

  if (!input.paused && !tableauDone) {
    loop.advance(dtReal, params.timeWarp, params.dt, () => {
      if (input.aimActive && !sim.dispersed) {
        sim.eject(aim.x, aim.y, params.dt)
      }
      if (vortex.timer > 0) {
        const life = Math.min(1, vortex.timer / params.vortexDuration)
        sim.applyVortex(vortex.x, vortex.y, params.dt, life)
        vortex.timer -= params.dt
      }
      sim.step(params.dt)
    })
  }

  // Sortie (§7.1-7.2) : le centre du corps franchit le sas
  if (!tableauDone && !sim.dispersed && pointInBox(sim.stats.centroidX, sim.stats.centroidY, level.exit)) {
    const surplus = sim.liters()
    run.bonbonneLiters += surplus
    run.tableau++
    run.exitTimer = EXIT_LINGER
    showOverlay(
      'SAS ATTEINT',
      `Surplus mis en bonbonne : ${surplus.toFixed(2)} L — réserve totale ${run.bonbonneLiters.toFixed(2)} L`,
      'success',
    )
  }
  if (run.exitTimer > 0) {
    run.exitTimer -= dtReal
    if (run.exitTimer <= 0) {
      overlay.classList.remove('visible')
      restart()
    }
  }

  // Ondes d'éjection : naissance côté visée, sur le bord du corps
  if (input.aimActive && !sim.dispersed && !input.paused && !tableauDone) {
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
  )

  const speed = Math.hypot(sim.stats.velX, sim.stats.velY)
  monitor.fps = fpsSmoothed
  monitor.particles = sim.count
  monitor.volume = sim.liters()
  monitor.speed = speed
  monitor.quality = qualityLevel

  btnPause.textContent = input.paused ? '▶' : '⏸'
  btnPause.classList.toggle('active', input.paused)
  btnVortex.classList.toggle('active', input.vortexArmed)

  // Instruments de bord
  const fraction = sim.baseVolume > 0 ? sim.playerCount / sim.baseVolume : 0
  hudTableau.textContent = `nº ${run.tableau}`
  hudBonbonne.textContent = `${run.bonbonneLiters.toFixed(2)} L`
  hudVolume.innerHTML = `${sim.liters().toFixed(2)} <small>L · ${sim.playerCount} part.</small>`
  gaugeFill.style.width = `${Math.min(100, fraction * 100).toFixed(1)}%`
  gaugeThreshold.style.left = `${(params.criticalVolumeFraction * 100).toFixed(1)}%`
  hudSeuil.textContent = `${(params.criticalVolumeFraction * sim.baseVolume * params.litersPerParticle).toFixed(2)} L`
  hudVitesse.textContent = `${speed.toFixed(0)} u/s`
  const stateText = sim.dispersed ? 'DISPERSÉ' : 'liquide'
  const suffix = `${vortex.timer > 0 ? ' · vortex' : ''}${input.paused ? ' · pause' : ''}`
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

  if (sim.dispersed && !tableauDone) {
    showOverlay('DISPERSION', 'La cohésion ne tient plus. Appuyez sur R pour recommencer.', 'danger')
  } else if (!tableauDone) {
    overlay.classList.remove('visible')
  }

  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
