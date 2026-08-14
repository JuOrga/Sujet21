// Parité moteur JS ↔ moteur WASM : deux simulations identiques, l'une sur
// les noyaux compilés, l'autre sur le JavaScript historique — mêmes
// trajectoires. Le portage suit le même ordre d'opérations en f64 sur des
// tableaux f32 : l'écart attendu est nul ou de l'ordre de l'ulp ; la
// tolérance absorbe seulement l'amplification chaotique des contacts.

import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, type SimParams } from './params'
import { FluidSim, KIND_PLAYER, type Bounds } from './solver'
import { NoyauxWasm } from './wasm'

const OPEN_SPACE: Bounds = { minX: -3000, minY: -3000, maxX: 3000, maxY: 3000 }

let noyaux: NoyauxWasm

beforeAll(async () => {
  const wasm = readFileSync(new URL('../../public/noyaux.wasm', import.meta.url))
  noyaux = await NoyauxWasm.charge(new Uint8Array(wasm).buffer as ArrayBuffer)
})

function paire(): { js: FluidSim; ws: FluidSim } {
  const params: SimParams = { ...DEFAULT_PARAMS }
  const js = new FluidSim(params, { ...OPEN_SPACE }, 2048)
  const ws = new FluidSim({ ...DEFAULT_PARAMS }, { ...OPEN_SPACE }, 2048)
  ws.noyauxWasm = noyaux
  ws.moteurWasm = true
  for (const s of [js, ws]) {
    s.spawnDisc(0, 0, 300, KIND_PLAYER)
    // un peu de vie : le corps se brasse contre sa propre inertie
    for (let i = 0; i < s.count; i++) {
      s.velX[i] = 40 * Math.sin(i * 0.7)
      s.velY[i] = 30 * Math.cos(i * 1.3)
    }
  }
  return { js, ws }
}

function ecartMax(a: FluidSim, b: FluidSim): number {
  let m = 0
  for (let i = 0; i < a.count; i++) {
    m = Math.max(m, Math.abs(a.posX[i] - b.posX[i]), Math.abs(a.posY[i] - b.posY[i]))
  }
  return m
}

describe('Moteur WASM — parité avec le moteur JS', () => {
  it('120 pas de liquide vivant : mêmes trajectoires', () => {
    const { js, ws } = paire()
    expect(ws.count).toBe(js.count)
    const dt = 1 / 120
    for (let s = 0; s < 120; s++) {
      js.step(dt)
      ws.step(dt)
    }
    // parité serrée : même ordre d'opérations, l'écart reste à l'échelle
    // du bruit f32 même après 120 pas de dynamique complète
    expect(ecartMax(js, ws)).toBeLessThan(1e-2)
  })

  it('le retour arrière est instantané : moteurWasm=false rend le pas au JS', () => {
    const { ws } = paire()
    ws.moteurWasm = false // même simulation, moteur débranché à chaud
    const dt = 1 / 120
    for (let s = 0; s < 10; s++) ws.step(dt)
    // le contrat du retour arrière : pas de crash, pas de NaN
    for (let i = 0; i < ws.count; i++) {
      expect(Number.isFinite(ws.posX[i])).toBe(true)
      expect(Number.isFinite(ws.posY[i])).toBe(true)
    }
  })

  it('gel puis dégel sous WASM : les états traversent le moteur sans casse', () => {
    const { js, ws } = paire()
    const dt = 1 / 120
    for (const s of [js, ws]) {
      s.freezeIntent = true
      for (let k = 0; k < 90; k++) s.step(dt)
      s.freezeIntent = false
      for (let k = 0; k < 90; k++) s.step(dt)
    }
    expect(ecartMax(js, ws)).toBeLessThan(1)
    let gelJs = 0
    let gelWs = 0
    for (let i = 0; i < js.count; i++) {
      gelJs += js.frozen[i]
      gelWs += ws.frozen[i]
    }
    expect(gelWs).toBe(gelJs)
  })
})
