// Banc de réglage (§13) : tous les paramètres de ressenti en sliders
// modifiables en direct, export/import des valeurs en JSON. C'est l'interface
// de travail entre le game design et le code.

import { Pane } from 'tweakpane'
import type { SimParams } from '../sim/params'
import { exportParams, importParams } from '../sim/params'

export interface BenchActions {
  reset(): void
}

export interface BenchMonitor {
  fps: number
  particles: number
  volume: number
  speed: number
  overview: boolean
}

export function createBench(params: SimParams, monitor: BenchMonitor, actions: BenchActions): Pane {
  const pane = new Pane({ title: 'Banc de réglage' })

  const fSolver = pane.addFolder({ title: 'Solveur', expanded: false })
  fSolver.addBinding(params, 'solverIterations', { min: 1, max: 8, step: 1, label: 'itérations' })
  fSolver.addBinding(params, 'kernelRadius', { min: 8, max: 20, step: 0.5, label: 'rayon h' })
  fSolver.addBinding(params, 'epsilonLambda', { min: 1e-6, max: 1e-2, label: 'epsilon' })
  fSolver.addBinding(params, 'xsphC', { min: 0, max: 0.5, label: 'viscosité' })
  fSolver.addBinding(params, 'maxDeltaPFactor', { min: 0.02, max: 0.5, label: 'plafond Δp (× h)' })
  fSolver.addBinding(params, 'maxSpeed', { min: 500, max: 8000, step: 50, label: 'vitesse max' })

  const fCohesion = pane.addFolder({ title: 'Cohésion (décision n°1)', expanded: true })
  fCohesion.addBinding(params, 'sCorrK', { min: 0, max: 0.5, label: 'intensité' })
  fCohesion.addBinding(params, 'sCorrN', { min: 1, max: 6, step: 1, label: 'exposant' })
  fCohesion.addBinding(params, 'sCorrDq', { min: 0.05, max: 0.5, label: 'dq (× h)' })

  const fProp = pane.addFolder({ title: 'Propulsion', expanded: true })
  fProp.addBinding(params, 'ejectRate', { min: 4, max: 120, step: 1, label: 'débit (part/s)' })
  fProp.addBinding(params, 'ejectSpeed', { min: 200, max: 4000, step: 10, label: 'vitesse éject.' })
  fProp.addBinding(params, 'reabsorbCooldown', { min: 0, max: 5, label: 'délai réabsorb. (s)' })

  const fBody = pane.addFolder({ title: 'Corps', expanded: false })
  fBody.addBinding(params, 'criticalVolumeFraction', { min: 0.05, max: 0.9, label: 'seuil dispersion' })
  fBody.addBinding(params, 'linkRadiusFactor', { min: 0.6, max: 2, label: 'rayon amas (× h)' })
  fBody.addBinding(params, 'litersPerParticle', { min: 0.001, max: 0.05, label: 'L / particule' })

  const fMat = pane.addFolder({ title: 'Matériaux (§6)', expanded: false })
  fMat.addBinding(params, 'hydroBand', { min: 4, max: 60, label: 'portée bande' })
  fMat.addBinding(params, 'hydrophilePull', { min: 0, max: 4000, step: 10, label: 'adhésion' })
  fMat.addBinding(params, 'hydrophileFriction', { min: 0, max: 20, label: 'friction' })
  fMat.addBinding(params, 'hydrophobeRepel', { min: 0, max: 6000, step: 10, label: 'répulsion' })
  fMat.addBinding(params, 'hydrophobeRestitution', { min: 0, max: 1, label: 'rebond' })
  fMat.addBinding(params, 'spongeDrag', { min: 0, max: 30, label: 'traînée éponge' })
  fMat.addBinding(params, 'spongeAbsorbTime', { min: 0.05, max: 2, label: 'délai absorption' })

  const fCam = pane.addFolder({ title: 'Caméra & temps', expanded: false })
  fCam.addBinding(params, 'cameraFraction', { min: 0.1, max: 0.6, label: 'cadrage' })
  fCam.addBinding(params, 'cameraSmoothing', { min: 0.5, max: 10, label: 'lissage' })
  fCam.addBinding(params, 'timeWarp', { min: 0.1, max: 6, label: 'time warp' })
  fCam.addBinding(monitor, 'overview', { label: 'vue d’ensemble' })

  const fRender = pane.addFolder({ title: 'Rendu', expanded: false })
  fRender.addBinding(params, 'fieldThreshold', { min: 0.1, max: 2, label: 'seuil champ' })
  fRender.addBinding(params, 'fieldSoftness', { min: 0.02, max: 1, label: 'douceur' })
  fRender.addBinding(params, 'particleRenderRadius', { min: 4, max: 20, label: 'rayon splat' })
  fRender.addBinding(params, 'speedColorScale', { min: 50, max: 800, label: 'échelle vitesse' })

  const fMon = pane.addFolder({ title: 'Mesures', expanded: true })
  fMon.addBinding(monitor, 'fps', { readonly: true, format: (v: number) => v.toFixed(0) })
  fMon.addBinding(monitor, 'particles', { readonly: true, format: (v: number) => v.toFixed(0) })
  fMon.addBinding(monitor, 'volume', { readonly: true, label: 'volume (L)', format: (v: number) => v.toFixed(2) })
  fMon.addBinding(monitor, 'speed', { readonly: true, label: 'vitesse (u/s)', format: (v: number) => v.toFixed(0) })

  pane.addButton({ title: 'Recommencer (R)' }).on('click', () => actions.reset())

  pane.addButton({ title: 'Exporter JSON' }).on('click', () => {
    const json = exportParams(params)
    void navigator.clipboard?.writeText(json).catch(() => {})
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'tension-de-surface-params.json'
    a.click()
    URL.revokeObjectURL(a.href)
  })

  pane.addButton({ title: 'Importer JSON' }).on('click', () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      importParams(await file.text(), params)
      pane.refresh()
    }
    input.click()
  })

  return pane
}
