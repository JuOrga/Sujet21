import { DEFAULT_PARAMS, type SimParams } from './sim/params'
import { FluidSim, KIND_FREE, KIND_PLAYER, type Bounds } from './sim/solver'
import { Camera } from './render/camera'
import { Renderer } from './render/renderer'
import { FixedLoop } from './game/loop'
import { Input } from './game/input'
import { createBench, type BenchMonitor } from './bench/bench'

const ROOM: Bounds = { minX: -1200, minY: -750, maxX: 1200, maxY: 750 }
const PLAYER_SPAWN = { x: -650, y: 0, n: 900 }
const CAPACITY = 4096

const params: SimParams = { ...DEFAULT_PARAMS }

function createSim(): FluidSim {
  const sim = new FluidSim(params, ROOM, CAPACITY)
  sim.spawnDisc(PLAYER_SPAWN.x, PLAYER_SPAWN.y, PLAYER_SPAWN.n, KIND_PLAYER)
  // Salle-bac à sable : deux masses d'eau libres pour éprouver la fusion (§3.1)
  sim.spawnDisc(350, 250, 140, KIND_FREE)
  sim.spawnDisc(750, -300, 220, KIND_FREE)
  sim.relabel()
  return sim
}

const canvas = document.getElementById('glcanvas') as HTMLCanvasElement
const hud = document.getElementById('hud') as HTMLDivElement
const help = document.getElementById('help') as HTMLDivElement
const overlay = document.getElementById('overlay') as HTMLDivElement

help.textContent = [
  'TENSION DE SURFACE — banc de prototype (jalon 1)',
  'maintenir le pointeur : éjecter vers ce point (le corps part à l’opposé)',
  ', / . : time warp    espace : pause    R : recommencer',
].join('\n')

let sim = createSim()
const camera = new Camera()
camera.snapTo(sim.stats.centroidX, sim.stats.centroidY, 1)
const renderer = new Renderer(canvas, CAPACITY)
const loop = new FixedLoop()
const input = new Input()
input.attach(canvas)

const monitor: BenchMonitor = { fps: 0, particles: 0, volume: 0, speed: 0 }
const pane = createBench(params, monitor, {
  reset: () => {
    sim = createSim()
    loop.reset()
    camera.snapTo(sim.stats.centroidX, sim.stats.centroidY, camera.zoom)
  },
})
input.onReset = () => {
  sim = createSim()
  loop.reset()
  camera.snapTo(sim.stats.centroidX, sim.stats.centroidY, camera.zoom)
}
input.onTimeWarpChange = (warp) => {
  params.timeWarp = warp
  pane.refresh()
}

let lastTime = performance.now()
let fpsSmoothed = 60

function frame(now: number): void {
  const dtReal = Math.min((now - lastTime) / 1000, 0.1)
  lastTime = now
  if (dtReal > 0) fpsSmoothed += (1 / dtReal - fpsSmoothed) * 0.05

  const vw = window.innerWidth
  const vh = window.innerHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)

  const aim = camera.screenToWorld(input.aimClientX, input.aimClientY, vw, vh)

  if (!input.paused) {
    loop.advance(dtReal, params.timeWarp, params.dt, () => {
      if (input.aimActive && !sim.dispersed) {
        sim.eject(aim.x, aim.y, params.dt)
      }
      sim.step(params.dt)
    })
  }

  camera.update(dtReal, sim.stats.centroidX, sim.stats.centroidY, sim.stats.rmsRadius, vw, vh, params)
  renderer.render(sim, camera, params, vw, vh, dpr)

  const speed = Math.hypot(sim.stats.velX, sim.stats.velY)
  monitor.fps = fpsSmoothed
  monitor.particles = sim.count
  monitor.volume = sim.liters()
  monitor.speed = speed

  hud.textContent = [
    `volume   ${sim.liters().toFixed(2)} L  (${sim.playerCount} particules)`,
    `vitesse  ${speed.toFixed(0)} u/s`,
    `état     ${sim.dispersed ? 'DISPERSÉ' : 'liquide'}${input.paused ? '  ·  pause' : ''}`,
    `warp     ×${params.timeWarp}`,
  ].join('\n')
  overlay.classList.toggle('visible', sim.dispersed)

  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
