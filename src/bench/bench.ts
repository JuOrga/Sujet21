// Banc de réglage (§13) : tous les paramètres de ressenti en sliders
// modifiables en direct, export/import des valeurs en JSON. C'est l'interface
// de travail entre le game design et le code.
//
// Chaque réglage porte une explication : elle s'affiche dans le panneau fixé
// sous le banc au survol (et en infobulle native via l'attribut title).

import { Pane } from 'tweakpane'
import type { SimParams } from '../sim/params'
import { DELIVERIES } from './changelog'
import './bench.css'
import {
  copyParams,
  deleteSharedPreset,
  fetchSharedPresets,
  loadStoredPresets,
  mergePresets,
  parsePresetFile,
  pushSharedPreset,
  removePreset,
  serializePreset,
  storePresets,
  upsertPreset,
  type Preset,
} from './presets'

// Vue minimale du blade « liste » de tweakpane (le type n'est pas exporté)
interface ListApi {
  value: string
  element: HTMLElement
  on(event: 'change', cb: (ev: { value: string }) => void): void
  dispose(): void
}

export interface BenchActions {
  reset(): void
  autoZoom(): void
}

export interface BenchMonitor {
  fps: number
  particles: number
  volume: number
  speed: number
  quality: number
  overview: boolean
}

const HINT_DEFAULT = 'Survolez un réglage pour voir à quoi il sert.'

export function createBench(params: SimParams, monitor: BenchMonitor, actions: BenchActions): Pane {
  // Sur mobile, le banc démarre replié : l'écran appartient au jeu
  const compact = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 700
  const pane = new Pane({ title: 'Banc de réglage', expanded: !compact })

  const hint = document.createElement('div')
  hint.className = 'bench-hint'
  hint.textContent = HINT_DEFAULT
  pane.element.appendChild(hint)

  // Affiche l'explication au survol ; l'attribut title sert d'infobulle de
  // secours (lecteurs d'écran, souris immobile).
  function describe<T extends { element: HTMLElement }>(api: T, text: string): T {
    api.element.title = text
    api.element.addEventListener('pointerenter', () => {
      hint.textContent = text
    })
    api.element.addEventListener('pointerleave', () => {
      hint.textContent = HINT_DEFAULT
    })
    return api
  }

  // ---- Présets : enregistrer / modifier / charger des jeux de réglages ----
  let presets = loadStoredPresets()
  const presetState = { title: '', description: '' }
  const fPresets = pane.addFolder({ title: 'Présets', expanded: true })

  describe(
    fPresets.addBinding(presetState, 'title', { label: 'titre' }),
    'Nom du préset. Enregistrer sous un titre existant le remplace ; sous un nouveau titre, le crée.',
  )
  describe(
    fPresets.addBinding(presetState, 'description', { label: 'description' }),
    'Note libre : l’intention du réglage, ce qui a été observé… Elle accompagne le préset (y compris dans le fichier exporté).',
  )

  let list: ListApi | null = null
  const rebuildList = (selected?: string) => {
    const options =
      presets.length > 0
        ? presets.map((p) => ({ text: p.title, value: p.title }))
        : [{ text: '— aucun préset —', value: '' }]
    const value =
      selected !== undefined && presets.some((p) => p.title === selected)
        ? selected
        : options[0].value
    list?.dispose()
    list = fPresets.addBlade({
      view: 'list',
      label: 'préset',
      options,
      value,
      index: 2,
    }) as unknown as ListApi
    describe(list, 'La bibliothèque partagée entre testeurs, plus vos présets locaux. Sélectionnez puis « Charger ».')
    list.on('change', (ev) => {
      const p = presets.find((q) => q.title === ev.value)
      if (p) hint.textContent = p.description || '(pas de description)'
    })
  }
  rebuildList()

  // La bibliothèque partagée se charge en arrière-plan ; sans backend
  // (dev local), le banc reste en mode localStorage sans bruit.
  void fetchSharedPresets()
    .then((shared) => {
      presets = mergePresets(presets, shared)
      storePresets(presets)
      rebuildList(list?.value)
      if (shared.length > 0) {
        hint.textContent = `Bibliothèque partagée synchronisée : ${shared.length} préset(s).`
      }
    })
    .catch(() => {
      hint.textContent = 'Bibliothèque partagée indisponible — présets locaux seulement.'
    })

  describe(
    fPresets.addButton({ title: 'Enregistrer / créer' }),
    'Enregistre les réglages actuels sous ce titre (remplace si le titre existe) et les publie dans la bibliothèque partagée entre testeurs.',
  ).on('click', () => {
    const title = presetState.title.trim()
    if (!title) {
      hint.textContent = '⚠ Donnez d’abord un titre au préset (champ « titre »).'
      return
    }
    const preset: Preset = {
      title,
      description: presetState.description,
      savedAt: new Date().toISOString(),
      params: { ...params },
    }
    presets = upsertPreset(presets, preset)
    storePresets(presets)
    rebuildList(title)
    hint.textContent = `Préset « ${title} » enregistré…`
    void pushSharedPreset(preset)
      .then(() => {
        hint.textContent = `Préset « ${title} » enregistré et partagé avec les autres testeurs.`
      })
      .catch(() => {
        hint.textContent = `Préset « ${title} » enregistré localement (bibliothèque partagée indisponible).`
      })
  })

  describe(
    fPresets.addButton({ title: 'Charger' }),
    'Applique le préset sélectionné : tous les curseurs prennent ses valeurs.',
  ).on('click', () => {
    const p = presets.find((q) => q.title === list?.value)
    if (!p) {
      hint.textContent = '⚠ Aucun préset sélectionné.'
      return
    }
    copyParams(p.params, params)
    presetState.title = p.title
    presetState.description = p.description
    pane.refresh()
    hint.textContent = `Préset « ${p.title} » chargé.`
  })

  describe(
    fPresets.addButton({ title: 'Supprimer' }),
    'Supprime le préset sélectionné, localement et dans la bibliothèque partagée (les curseurs actuels ne bougent pas).',
  ).on('click', () => {
    const title = list?.value
    if (!title || !presets.some((q) => q.title === title)) {
      hint.textContent = '⚠ Aucun préset sélectionné.'
      return
    }
    presets = removePreset(presets, title)
    storePresets(presets)
    rebuildList()
    hint.textContent = `Préset « ${title} » supprimé.`
    void deleteSharedPreset(title).catch(() => {})
  })

  const fSolver = pane.addFolder({ title: 'Solveur', expanded: false })
  describe(
    fSolver.addBinding(params, 'solverIterations', { min: 1, max: 8, step: 1, label: 'itérations' }),
    'Passes du solveur par pas de temps. Plus haut : eau plus incompressible et stable, mais plus coûteux en calcul.',
  )
  describe(
    fSolver.addBinding(params, 'kernelRadius', { min: 8, max: 20, step: 0.5, label: 'rayon h' }),
    'Rayon d’influence entre particules. C’est l’échelle de base de la simulation — presque tout en dépend.',
  )
  describe(
    fSolver.addBinding(params, 'epsilonLambda', { min: 1e-6, max: 1e-2, label: 'epsilon' }),
    'Régularisation numérique du solveur. Évite les instabilités ; à ne toucher qu’en cas d’explosion visible.',
  )
  describe(
    fSolver.addBinding(params, 'xsphC', { min: 0, max: 0.5, label: 'viscosité' }),
    'Lissage des vitesses entre voisines. Haut : eau sirupeuse et calme. Bas : éclaboussures vives, corps qui s’agite.',
  )
  describe(
    fSolver.addBinding(params, 'maxDeltaPFactor', { min: 0.02, max: 0.5, label: 'plafond Δp' }),
    'Déplacement maximal d’une particule par itération. Garde-fou contre les projections violentes lors des chocs.',
  )
  describe(
    fSolver.addBinding(params, 'maxSpeed', { min: 500, max: 8000, step: 50, label: 'vitesse max' }),
    'Vitesse individuelle maximale d’une particule. Garde-fou de stabilité, rarement atteint en jeu normal.',
  )

  const fCohesion = pane.addFolder({ title: 'Cohésion (décision n°1)', expanded: true })
  describe(
    fCohesion.addBinding(params, 'sCorrK', { min: 0, max: 0.5, label: 'intensité' }),
    'LE curseur du ressenti : force de la tension de surface. Haut : goutte compacte qui résiste. Bas : flaque qui se déforme et se déchire.',
  )
  describe(
    fCohesion.addBinding(params, 'sCorrN', { min: 1, max: 6, step: 1, label: 'exposant' }),
    'Concentration de la cohésion sur les courtes distances. Haut : effet plus local, surface plus « tendue ».',
  )
  describe(
    fCohesion.addBinding(params, 'sCorrDq', { min: 0.05, max: 0.5, label: 'dq (× h)' }),
    'Distance de référence de la cohésion (fraction de h). Joue sur l’épaisseur de la « peau » du corps.',
  )

  const fProp = pane.addFolder({ title: 'Propulsion', expanded: true })
  describe(
    fProp.addBinding(params, 'ejectRate', { min: 4, max: 120, step: 1, label: 'débit /s' }),
    'Particules éjectées par seconde quand on maintient le pointeur. Plus : poussée forte, mais on fond à vue d’œil.',
  )
  describe(
    fProp.addBinding(params, 'ejectSpeed', { min: 200, max: 4000, step: 10, label: 'vitesse' }),
    'Vitesse des particules éjectées. La poussée reçue est proportionnelle (conservation de la quantité de mouvement).',
  )
  describe(
    fProp.addBinding(params, 'ejectEntrain', { min: 0, max: 0.5, label: 'entraînement' }),
    'Le liquide voisin converge vers le point d’émission (entonnoir qui alimente le jet) : le corps se creuse, sans poussée dans le sens du jet qui masquerait le recul. À 0 : désactivé.',
  )
  describe(
    fProp.addBinding(params, 'recoilLocality', { min: 0, max: 1, label: 'recul localisé' }),
    'Où s’applique le recul : 0 = uniforme, le corps part d’un bloc comme un solide ; 1 = concentré au point d’éjection, l’impulsion se propage par pression et le corps se déforme en accélérant.',
  )
  describe(
    fProp.addBinding(params, 'reabsorbCooldown', { min: 0, max: 5, label: 'réabsorption' }),
    'Temps pendant lequel une goutte éjectée ne peut pas être réabsorbée — sinon elle recollerait aussitôt au corps.',
  )

  const fVortex = pane.addFolder({ title: 'Vortex (clic droit)', expanded: false })
  describe(
    fVortex.addBinding(params, 'vortexRadius', { min: 40, max: 600, step: 5, label: 'rayon' }),
    'Rayon autour du clic droit dans lequel l’eau est aspirée. Au-delà, aucune influence.',
  )
  describe(
    fVortex.addBinding(params, 'vortexPull', { min: 0, max: 1200, step: 10, label: 'courant (u/s)' }),
    'Vitesse du courant du vortex. Haut : les gouttes reviennent vite et fort.',
  )
  describe(
    fVortex.addBinding(params, 'vortexSwirl', { min: 0, max: 4, label: 'rotation' }),
    'Part giratoire du courant. Haut : les gouttes spiralent longtemps avant de se regrouper. 0 : retour en ligne droite.',
  )
  describe(
    fVortex.addBinding(params, 'vortexDrag', { min: 0.5, max: 12, label: 'entraînement' }),
    'Vitesse à laquelle l’eau est happée par le courant. Bas : l’eau garde son élan et suit mollement le vortex.',
  )
  describe(
    fVortex.addBinding(params, 'vortexDuration', { min: 0.2, max: 5, label: 'durée (s)' }),
    'Durée du vortex après un clic droit. Un nouveau clic le relance ailleurs.',
  )
  describe(
    fVortex.addBinding(params, 'vortexWindDown', { min: 0, max: 0.8, label: 'retombée' }),
    'Fraction finale de la durée où le vortex s’essouffle : il freine l’eau et la dépose au lieu de la lâcher en rotation. À 0, la force centrifuge fait éclater le corps à la fin.',
  )

  const fExit = pane.addFolder({ title: 'Sas (bouche d’aspiration)', expanded: false })
  describe(
    fExit.addBinding(params, 'exitRadius', { min: 0, max: 600, step: 5, label: 'rayon' }),
    'Portée de l’aspiration autour de la bouche du sas. À 0 : le sas n’aspire plus, il faut y entrer par ses propres moyens.',
  )
  describe(
    fExit.addBinding(params, 'exitPull', { min: 0, max: 1000, step: 10, label: 'courant (u/s)' }),
    'Vitesse du courant qui s’engouffre dans la bouche. Il se renforce à l’approche du trou, comme une vidange.',
  )
  describe(
    fExit.addBinding(params, 'exitSwirl', { min: 0, max: 4, label: 'rotation' }),
    'Part giratoire du courant : l’eau spirale en entonnoir au lieu de tomber tout droit dans la bouche. 0 : aspiration en ligne droite.',
  )

  const fBody = pane.addFolder({ title: 'Corps', expanded: false })
  describe(
    fBody.addBinding(params, 'criticalVolumeFraction', { min: 0.05, max: 0.9, label: 'seuil dispersion' }),
    'Fraction du volume initial sous laquelle le corps se disperse (défaite). Haut : partie plus punitive.',
  )
  describe(
    fBody.addBinding(params, 'linkRadiusFactor', { min: 0.6, max: 2, label: 'rayon amas (× h)' }),
    'Distance à laquelle deux particules comptent comme un même corps. Joue sur la facilité de fusion et de déchirure.',
  )
  describe(
    fBody.addBinding(params, 'litersPerParticle', { min: 0.001, max: 0.05, label: 'L / particule' }),
    'Volume d’eau que représente une particule. Purement cosmétique : change l’affichage, pas la physique.',
  )

  const fMat = pane.addFolder({ title: 'Matériaux (§6)', expanded: false })
  describe(
    fMat.addBinding(params, 'hydroBand', { min: 4, max: 60, label: 'portée bande' }),
    'Épaisseur de la zone d’influence autour des parois. L’eau y est attirée ou repoussée sans contact.',
  )
  describe(
    fMat.addBinding(params, 'hydrophilePull', { min: 0, max: 4000, step: 10, label: 'adhésion' }),
    'Attraction des parois hydrophiles : l’eau s’y colle et s’y étale. Décoller a un coût.',
  )
  describe(
    fMat.addBinding(params, 'hydrophileFriction', { min: 0, max: 20, label: 'friction' }),
    'Freinage au contact des parois hydrophiles : l’eau y rampe au lieu de glisser.',
  )
  describe(
    fMat.addBinding(params, 'hydrophobeRepel', { min: 0, max: 6000, step: 10, label: 'répulsion' }),
    'Poussée des parois hydrophobes : l’eau glisse dessus sans les mouiller.',
  )
  describe(
    fMat.addBinding(params, 'hydrophobeRestitution', { min: 0, max: 1, label: 'rebond' }),
    'Restitution des chocs sur parois hydrophobes. 1 : rebond parfait. 0 : l’eau s’écrase sans rebondir.',
  )
  describe(
    fMat.addBinding(params, 'wallSplashDamp', { min: 0, max: 1, label: 'amorti impact' }),
    'Amortit le rebond de l’eau sur les murs neutres : haut, l’impact s’étale et épouse la paroi ; à 0, l’eau éclate en jaillissant.',
  )
  describe(
    fMat.addBinding(params, 'spongeDrag', { min: 0, max: 30, label: 'traînée éponge' }),
    'Freinage de l’eau qui traverse une éponge : elle s’y englue avant d’être absorbée.',
  )
  describe(
    fMat.addBinding(params, 'spongeAbsorbTime', { min: 0.05, max: 2, label: 'absorption (s)' }),
    'Temps de contact continu avant qu’une éponge n’absorbe une particule. Chaque cellule se sature puis devient solide.',
  )

  const fCam = pane.addFolder({ title: 'Caméra & temps', expanded: false })
  describe(
    fCam.addBinding(params, 'cameraFraction', { min: 0.1, max: 0.6, label: 'cadrage' }),
    'Taille apparente du corps à l’écran. Le zoom auto vise cette fraction du petit côté — grossir se ressent par un dézoom.',
  )
  describe(
    fCam.addBinding(params, 'cameraSmoothing', { min: 0.5, max: 10, label: 'lissage' }),
    'Réactivité de la caméra. Haut : suivi nerveux. Bas : caméra flottante qui prend son temps.',
  )
  describe(
    fCam.addBinding(params, 'timeWarp', { min: 0.1, max: 6, label: 'time warp' }),
    'Accélère ou ralentit le temps de jeu (touches , et .). Ne modifie jamais le pas physique (§11).',
  )
  describe(
    fCam.addBinding(monitor, 'overview', { label: 'vue d’ensemble' }),
    'Cadre tout le tableau au lieu de suivre le corps. Pratique pour le level design.',
  )
  describe(
    fCam.addButton({ title: 'Zoom auto' }),
    'Rend la main au zoom automatique après un zoom manuel à la molette.',
  ).on('click', () => actions.autoZoom())

  const fRender = pane.addFolder({ title: 'Rendu', expanded: false })
  describe(
    fRender.addBinding(params, 'fieldThreshold', { min: 0.1, max: 2, label: 'seuil champ' }),
    'Niveau du champ de densité où passe la surface de l’eau. Haut : corps plus maigre. Bas : surface plus enveloppante.',
  )
  describe(
    fRender.addBinding(params, 'fieldSoftness', { min: 0.02, max: 1, label: 'douceur' }),
    'Douceur du bord de la surface. Haut : contour vaporeux. Bas : bord net et graphique.',
  )
  describe(
    fRender.addBinding(params, 'particleRenderRadius', { min: 4, max: 20, label: 'rayon splat' }),
    'Taille du disque de densité dessiné par particule. Joue sur l’aspect « blob » de l’eau, pas sur la physique.',
  )
  describe(
    fRender.addBinding(params, 'speedColorScale', { min: 50, max: 800, label: 'échelle teinte' }),
    'Vitesse à laquelle la teinte de l’eau atteint sa couleur « rapide ». Bas : tout scintille. Haut : teinte plus sobre.',
  )

  const fMon = pane.addFolder({ title: 'Mesures', expanded: true })
  describe(
    fMon.addBinding(monitor, 'fps', { readonly: true, format: (v: number) => v.toFixed(0) }),
    'Images par seconde réellement affichées (lissées).',
  )
  describe(
    fMon.addBinding(monitor, 'particles', { readonly: true, label: 'particules', format: (v: number) => v.toFixed(0) }),
    'Nombre total de particules simulées (corps + gouttes libres).',
  )
  describe(
    fMon.addBinding(monitor, 'volume', { readonly: true, label: 'volume (L)', format: (v: number) => v.toFixed(2) }),
    'Volume du corps du joueur. Se déplacer, c’est rétrécir (§1).',
  )
  describe(
    fMon.addBinding(monitor, 'speed', { readonly: true, label: 'vitesse (u/s)', format: (v: number) => v.toFixed(0) }),
    'Vitesse du centre du corps, en unités monde par seconde.',
  )
  describe(
    fMon.addBinding(monitor, 'quality', {
      readonly: true,
      label: 'qualité rendu',
      format: (v: number) => ['maximale', 'haute', 'moyenne', 'basse', 'minimale'][Math.round(v)] ?? '?',
    }),
    'Qualité de rendu choisie automatiquement selon les FPS de la machine. La physique, elle, n’est jamais dégradée.',
  )

  // ---- Livraisons : le journal de ce qui a été livré, date et heure ----
  const fLog = pane.addFolder({ title: 'Livraisons', expanded: false })
  const log = document.createElement('div')
  log.className = 'bench-log'
  for (const d of DELIVERIES) {
    const entry = document.createElement('div')
    const head = document.createElement('div')
    head.className = 'bench-log-head'
    head.textContent = `${d.date} — ${d.title}`
    entry.appendChild(head)
    const ul = document.createElement('ul')
    for (const note of d.notes) {
      const li = document.createElement('li')
      li.textContent = note
      ul.appendChild(li)
    }
    entry.appendChild(ul)
    log.appendChild(entry)
  }
  // Dans le conteneur repliable du dossier, pour suivre son état ouvert/fermé.
  // La classe bench-log-folder neutralise la hauteur calculée par tweakpane
  // (qui ignore ce div étranger et le clipperait).
  fLog.element.classList.add('bench-log-folder')
  ;(fLog.element.querySelector('.tp-fldv_c') ?? fLog.element).appendChild(log)

  describe(pane.addButton({ title: 'Recommencer (R)' }), 'Relance le tableau depuis le début.').on(
    'click',
    () => actions.reset(),
  )

  describe(
    pane.addButton({ title: 'Exporter JSON' }),
    'Télécharge les réglages courants en JSON, avec le titre et la description — pratique pour s’échanger des présets entre testeurs (aussi copiés dans le presse-papier).',
  ).on('click', () => {
    const json = serializePreset({
      title: presetState.title,
      description: presetState.description,
      savedAt: new Date().toISOString(),
      params: { ...params },
    })
    void navigator.clipboard?.writeText(json).catch(() => {})
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    const slug = presetState.title.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-') || 'params'
    a.href = URL.createObjectURL(blob)
    a.download = `tension-de-surface-${slug}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  })

  describe(
    pane.addButton({ title: 'Importer JSON' }),
    'Recharge des réglages depuis un fichier exporté. S’il a un titre, le préset est aussi ajouté à votre liste.',
  ).on('click', () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const preset = parsePresetFile(await file.text())
        copyParams(preset.params, params)
        presetState.title = preset.title
        presetState.description = preset.description
        if (preset.title) {
          const stamped = { ...preset, savedAt: new Date().toISOString() }
          presets = upsertPreset(presets, stamped)
          storePresets(presets)
          rebuildList(preset.title)
          hint.textContent = `Préset « ${preset.title} » importé et ajouté à la liste.`
          void pushSharedPreset(stamped).catch(() => {})
        } else {
          hint.textContent = 'Réglages importés (fichier sans titre).'
        }
        pane.refresh()
      } catch {
        hint.textContent = '⚠ Fichier illisible : ce n’est pas un export de réglages.'
      }
    }
    input.click()
  })

  return pane
}
