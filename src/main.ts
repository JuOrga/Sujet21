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
const hud = document.getElementById('hud') as HTMLDivElement
const help = document.getElementById('help') as HTMLDivElement
const overlay = document.getElementById('overlay') as HTMLDivElement
const overlayTitle = document.getElementById('overlay-title') as HTMLDivElement
const overlaySub = document.getElementById('overlay-sub') as HTMLDivElement

const touchDevice = window.matchMedia('(pointer: coarse)').matches
help.textContent = (touchDevice
  ? [
      'TENSION DE SURFACE — tableau 1 (jalon 2)',
      'maintenir le doigt : éjecter vers ce point (le corps part à l’opposé)',
      'rejoindre le sas vert — le surplus est mis en bonbonne',
      'pincer à 2 doigts : zoom    🌀 puis toucher : vortex de regroupement',
    ]
  : [
      'TENSION DE SURFACE — tableau 1 (jalon 2)',
      'maintenir le pointeur : éjecter vers ce point (le corps part à l’opposé)',
      'rejoindre le sas vert — le surplus est mis en bonbonne',
      'clic droit : vortex de regroupement (rappelle les gouttes autour du point cliqué)',
      'molette : zoom manuel (bouton « Zoom auto » du banc pour reprendre le suivi)',
      ', / . : time warp    espace : pause    R : recommencer',
    ]
).join('\n')

let sim = createSim(level)
const camera = new Camera()
camera.snapTo(sim.stats.centroidX, sim.stats.centroidY, 1)
const renderer = new Renderer(canvas, CAPACITY)
const loop = new FixedLoop()
const input = new Input()
input.attach(canvas)

const monitor: BenchMonitor = { fps: 0, particles: 0, volume: 0, speed: 0, overview: false }

// Vortex de regroupement : déclenché au clic droit, actif vortexDuration s
const vortex = { x: 0, y: 0, timer: 0 }

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
input.onTimeWarpChange = (warp) => {
  params.timeWarp = warp
  pane.refresh()
}

function showOverlay(title: string, sub: string): void {
  overlayTitle.textContent = title
  overlaySub.textContent = sub
  overlay.classList.add('visible')
}

let lastTime = performance.now()
let elapsed = 0
let fpsSmoothed = 60

function frame(now: number): void {
  const dtReal = Math.min((now - lastTime) / 1000, 0.1)
  lastTime = now
  elapsed += dtReal
  if (dtReal > 0) fpsSmoothed += (1 / dtReal - fpsSmoothed) * 0.05

  const vw = window.innerWidth
  const vh = window.innerHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)

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
    )
  }
  if (run.exitTimer > 0) {
    run.exitTimer -= dtReal
    if (run.exitTimer <= 0) {
      overlay.classList.remove('visible')
      restart()
    }
  }

  // Caméra : suivi du corps, ou vue d'ensemble du tableau depuis le banc
  if (monitor.overview) {
    const b = sim.bounds
    const fitZoom = Math.min(vw / (b.maxX - b.minX), vh / (b.maxY - b.minY)) * 0.94
    camera.snapTo((b.minX + b.maxX) * 0.5, (b.minY + b.maxY) * 0.5, fitZoom)
  } else {
    camera.update(dtReal, sim.stats.centroidX, sim.stats.centroidY, sim.stats.rmsRadius, vw, vh, params)
  }
  renderer.render(sim, camera, params, vw, vh, dpr, renderBoxes, elapsed)

  const speed = Math.hypot(sim.stats.velX, sim.stats.velY)
  monitor.fps = fpsSmoothed
  monitor.particles = sim.count
  monitor.volume = sim.liters()
  monitor.speed = speed

  btnPause.textContent = input.paused ? '▶' : '⏸'
  btnPause.classList.toggle('active', input.paused)
  btnVortex.classList.toggle('active', input.vortexArmed)

  hud.textContent = [
    `tableau  n°${run.tableau}   bonbonnes ${run.bonbonneLiters.toFixed(2)} L`,
    `volume   ${sim.liters().toFixed(2)} L  (${sim.playerCount} particules)`,
    `vitesse  ${speed.toFixed(0)} u/s`,
    `état     ${sim.dispersed ? 'DISPERSÉ' : 'liquide'}${vortex.timer > 0 ? '  ·  vortex' : ''}${input.paused ? '  ·  pause' : ''}`,
    `warp     ×${params.timeWarp}`,
  ].join('\n')

  if (sim.dispersed && !tableauDone) {
    showOverlay('DISPERSION', 'La cohésion ne tient plus. Appuyez sur R pour recommencer.')
  } else if (!tableauDone) {
    overlay.classList.remove('visible')
  }

  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
