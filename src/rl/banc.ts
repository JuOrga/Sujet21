// ---------------------------------------------------------------------------
// LE BANC DE L'ENTRAÎNEMENT — combien de jeu par seconde de machine ?
//
//   pnpm rl:banc                    # JS et WASM, 900/450/200 particules
//
// C'est LE chiffre qui décide de tout en apprentissage par renforcement : le
// budget d'essais tient dans le temps de calcul d'un pas. Les mesures citées
// dans docs/apprentissage-par-renforcement.md sortent d'ici — refaites-les
// sur votre machine avant de dimensionner un entraînement.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs'
import process from 'node:process'
import { DEFAULT_PARAMS } from '../sim/params'
import { FluidSim, KIND_PLAYER } from '../sim/solver'
import { NoyauxWasm } from '../sim/wasm'
import { EnvSujet21 } from './env'

const argv = process.argv.slice(2)
const get = (nom: string, def: string): string => {
  const i = argv.indexOf(`--${nom}`)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def
}

const code = get('tableau', '21-A')
const pas = Number(get('pas', '900'))
const tailles = get('particules', '900,450,200').split(',').map(Number)

const wasmBuf = readFileSync(new URL('../../public/noyaux.wasm', import.meta.url))
const noyaux = await NoyauxWasm.charge(
  new Uint8Array(wasmBuf).buffer as ArrayBuffer,
)

function mesure(n: number, avecWasm: boolean): void {
  // On emprunte le niveau à l'environnement : même géométrie, même sas.
  const env = new EnvSujet21({ code, particules: n })
  const lv = env.level
  const sim = new FluidSim({ ...DEFAULT_PARAMS }, lv.bounds, 4096)
  if (avecWasm) {
    sim.noyauxWasm = noyaux
    sim.moteurWasm = true
  }
  sim.setLevel(lv.boxes, lv.sponges)
  sim.spawnDisc(lv.spawn.x, lv.spawn.y, n, KIND_PLAYER)
  const dt = sim.params.dt
  for (let i = 0; i < 120; i++) {
    sim.applyExitSuction(env.sortie.x, env.sortie.y, dt)
    sim.step(dt)
  }
  const t0 = performance.now()
  for (let i = 0; i < pas; i++) {
    if (i % 4 === 0) sim.eject(env.sortie.x, env.sortie.y, dt)
    sim.applyExitSuction(env.sortie.x, env.sortie.y, dt)
    sim.step(dt)
  }
  const ms = performance.now() - t0
  console.log(
    `${String(n).padStart(4)} particules · ${(avecWasm ? 'WASM' : 'JS').padEnd(4)} : ` +
      `${(ms / pas).toFixed(3)} ms/pas · ${(pas / (ms / 1000)).toFixed(0)} pas/s · ` +
      `×${((pas * dt) / (ms / 1000)).toFixed(1)} temps réel`,
  )
}

console.log(`Banc — tableau ${code}, ${pas} pas physiques mesurés par essai\n`)
for (const n of tailles) {
  mesure(n, false)
  mesure(n, true)
}
