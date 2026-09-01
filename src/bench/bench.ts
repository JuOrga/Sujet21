// Banc de réglage (§13) : tous les paramètres de ressenti en sliders
// modifiables en direct, export/import des valeurs en JSON. C'est l'interface
// de travail entre le game design et le code.
//
// Chaque réglage porte une explication : elle s'affiche dans le panneau fixé
// sous le banc au survol (et en infobulle native via l'attribut title).

import { Pane } from 'tweakpane'
import type { SimParams } from '../sim/params'
import './bench.css'
import {
  builtinPresets,
  copyParams,
  deleteSharedPreset,
  fetchSharedPresets,
  hideBuiltin,
  loadStoredDefault,
  loadStoredPresets,
  mergePresets,
  parsePresetFile,
  pushSharedPreset,
  removePreset,
  serializePreset,
  setSharedDefault,
  storePresets,
  storeStoredDefault,
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
  // Saut de tableau : tester un niveau sans rejouer les précédents
  tableaux: string[]
  gotoTableau(index: number): void
  // Le prototype hors expédition (21-A bis), aussi accessible depuis la fiche
  gotoBis(): void
  // Effets sonores (préférences hors présets : chacun règle son volume)
  sound: { actif: boolean; volume: number }
  // LE PUPITRE D'ESSAIS, aussi au banc : les mêmes manœuvres que l'écran du
  // menu (cérémonie, bonbonne, ressources, sons). Le catalogue vient du
  // panneau lui-même — une seule liste, deux poignées.
  pupitre?: {
    sections: { titre: string; boutons: { cle: string; titre: string; aide: string }[] }[]
    lance(cle: string): string
  }
  // LE RAPPORT DE PERFORMANCE, au banc. Il existait déjà dans le voile
  // PARAMÈTRES, mais celui-ci s'ouvre depuis la fiche — qui met l'essai en
  // PAUSE : on n'y mesurait jamais qu'un menu au-dessus d'une scène figée.
  // Le banc, lui, flotte sur le jeu qui tourne : le rapport pris ici mesure
  // une vraie partie, et il tombe sous la main juste après le réglage qu'on
  // vient de changer (le collecteur repart à zéro à chaque changement).
  perf?: {
    copier(): Promise<string>
    envoyer(): Promise<string>
  }
  // LE CIEL DU DEHORS : le choix du fond est dans PARAMÈTRES, mais son
  // DOSAGE se règle ici, à vue — c'est en regardant le vide qu'on trouve
  // la bonne force, pas dans un menu qui met la partie en pause.
  ciel?: { force: number; etendue: number }
  // LA PROFONDEUR DES COUCHES DE FOND : deux nombres par couche, entre 0 et
  // 1 — le suivi (déplacement de la caméra) et le zoom (grossissement).
  parallaxe?: {
    cielSuivi: number
    cielZoom: number
    semisSuivi: number
    semisZoom: number
    cuveSuivi: number
    cuveZoom: number
    ref: number
  }
  // L'ŒIL DU SUJET (pack présence) : les curseurs vivent ici, à VUE — le
  // banc flotte sur le jeu qui tourne. Hors présets : mémorisé par
  // appareil (localStorage) ; les défauts sont l'étalonnage du concepteur.
  oeil?: {
    regl: Record<string, number>
    defauts: Record<string, number>
    sauve(): void
  }
}

export interface BenchMonitor {
  fps: number
  particles: number
  volume: number
  speed: number
  quality: number
  physMs: number // coût CPU des pas physiques de l'image (ms, lissé)
  renderMs: number // coût CPU de la soumission du rendu (ms, lissé)
  overview: boolean
}

const HINT_DEFAULT = 'Survolez un réglage pour voir à quoi il sert.'

export function createBench(params: SimParams, monitor: BenchMonitor, actions: BenchActions): Pane {
  // Le banc n'apparaît qu'à la demande (bouton BANC de la barre, main.ts) :
  // quand on l'ouvre, il est déplié — l'écran appartient au jeu le reste du temps
  const pane = new Pane({ title: 'Banc de réglage', expanded: true })

  const hint = document.createElement('div')
  hint.className = 'bench-hint'
  hint.textContent = HINT_DEFAULT
  pane.element.appendChild(hint)

  // Affiche l'explication au survol ; l'attribut title sert d'infobulle de
  // secours (lecteurs d'écran, souris immobile).
  // Le mot laissé par une manœuvre doit SURVIVRE au survol suivant : sans
  // cela, « Envoyé au labo ✓ » disparaissait dès que la souris quittait le
  // bouton — et une réponse qui arrive après coup (envoi réseau) n'était
  // jamais lue. Le repos n'est plus une constante, c'est le dernier mot dit.
  let hintRepos = HINT_DEFAULT
  function dis(mot: string): void {
    hintRepos = mot
    hint.textContent = mot
  }
  function describe<T extends { element: HTMLElement }>(api: T, text: string): T {
    api.element.title = text
    api.element.addEventListener('pointerenter', () => {
      hint.textContent = text
    })
    api.element.addEventListener('pointerleave', () => {
      hint.textContent = hintRepos
    })
    return api
  }

  // ---- Présets : enregistrer / modifier / charger des jeux de réglages ----
  // Les présets LIVRÉS d'abord : un préset enregistré sous le même titre les
  // remplace (savedAt vide = le livré perd la fusion), un livré supprimé
  // reste masqué sur l'appareil (voir hideBuiltin).
  let presets = mergePresets(builtinPresets(), loadStoredPresets())
  // Préset appliqué automatiquement au lancement (commun aux testeurs) :
  // le cache local répond tout de suite, la bibliothèque partagée corrige.
  let defaultTitle = loadStoredDefault()
  const presetState = { title: '', description: '' }
  const fPresets = pane.addFolder({ title: 'Présets', expanded: true })

  const applyPreset = (p: Preset): void => {
    copyParams(p.params, params)
    presetState.title = p.title
    presetState.description = p.description
    pane.refresh()
  }

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
        ? presets.map((p) => ({ text: p.title === defaultTitle ? `★ ${p.title}` : p.title, value: p.title }))
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

  // Migration ponctuelle (09/08/2026) : l'équilibrage thermique a élargi les
  // auras — le préset « boizessai1 » d'avant est copié en « boizessai2 »,
  // ajusté (chaleur 130, froid 85, ébullition 1,2 s), le reste inchangé.
  // Idempotente : la copie n'est créée que si elle manque à la partagée ;
  // si boizessai1 était le préset de lancement, la copie le remplace.
  const migrateBoizessai = (lib: { presets: Preset[]; defaultTitle: string | null }): void => {
    const src = lib.presets.find((p) => p.title === 'boizessai1')
    if (!src || lib.presets.some((p) => p.title === 'boizessai2')) return
    const copy: Preset = {
      title: 'boizessai2',
      description:
        'Copie de boizessai1 ajustée aux nouvelles auras thermiques (chaleur 130, froid 85, ébullition 1,2 s).' +
        (src.description ? ` — ${src.description}` : ''),
      savedAt: new Date().toISOString(),
      params: { ...src.params, coldBand: 85, heatBand: 130, boilTime: 1.2 },
    }
    presets = upsertPreset(presets, copy)
    storePresets(presets)
    void pushSharedPreset(copy).catch(() => {})
    if (lib.defaultTitle === 'boizessai1') {
      defaultTitle = 'boizessai2'
      storeStoredDefault(defaultTitle)
      void setSharedDefault('boizessai2').catch(() => {})
      applyPreset(copy)
    }
    rebuildList('boizessai2')
    hint.textContent = 'Préset « boizessai2 » créé : boizessai1 ajusté aux nouvelles auras.'
  }

  // La bibliothèque partagée se charge en arrière-plan ; sans backend
  // (dev local), le banc reste en mode localStorage sans bruit.
  void fetchSharedPresets()
    .then((lib) => {
      presets = mergePresets(presets, lib.presets)
      storePresets(presets)
      // Le défaut partagé fait foi : il corrige (ou efface) le cache local
      const changed = lib.defaultTitle !== defaultTitle
      defaultTitle = lib.defaultTitle
      storeStoredDefault(defaultTitle)
      rebuildList(list?.value)
      const def = changed ? presets.find((q) => q.title === defaultTitle) : undefined
      if (def) {
        applyPreset(def)
        hint.textContent = `Bibliothèque synchronisée — préset par défaut « ${def.title} » appliqué.`
      } else if (lib.presets.length > 0) {
        hint.textContent = `Bibliothèque partagée synchronisée : ${lib.presets.length} préset(s).`
      }
      migrateBoizessai(lib)
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
    applyPreset(p)
    hint.textContent = `Préset « ${p.title} » chargé.`
  })

  describe(
    fPresets.addButton({ title: 'Par défaut au lancement ★' }),
    'Le préset sélectionné sera appliqué automatiquement à l’ouverture du jeu, pour tous les testeurs (marqué ★ dans la liste). Cliquer à nouveau sur le préset déjà par défaut retire ce statut : retour aux réglages d’usine au lancement.',
  ).on('click', () => {
    const title = list?.value
    if (!title || !presets.some((q) => q.title === title)) {
      hint.textContent = '⚠ Aucun préset sélectionné.'
      return
    }
    const clearing = defaultTitle === title
    defaultTitle = clearing ? null : title
    storeStoredDefault(defaultTitle)
    rebuildList(title)
    hint.textContent = clearing
      ? 'Retrait du préset par défaut…'
      : `« ${title} » défini par défaut…`
    void setSharedDefault(defaultTitle)
      .then(() => {
        hint.textContent = clearing
          ? 'Plus de préset par défaut : réglages d’usine au lancement (pour tous les testeurs).'
          : `« ${title} » sera appliqué au lancement pour tous les testeurs.`
      })
      .catch(() => {
        hint.textContent = clearing
          ? 'Préset par défaut retiré sur cet appareil (bibliothèque partagée indisponible).'
          : `« ${title} » par défaut sur cet appareil seulement (bibliothèque partagée indisponible).`
      })
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
    hideBuiltin(title) // un préset livré supprimé ne renaît pas au prochain lancement
    if (defaultTitle === title) {
      // le défaut suit le préset supprimé (le serveur fait de même)
      defaultTitle = null
      storeStoredDefault(null)
    }
    rebuildList()
    hint.textContent = `Préset « ${title} » supprimé.`
    void deleteSharedPreset(title).catch(() => {})
  })

  // ---- Tableaux : sauter directement au niveau à tester ----
  const fTableaux = pane.addFolder({ title: 'Tableaux', expanded: false })
  actions.tableaux.forEach((name, index) => {
    describe(
      fTableaux.addButton({ title: `nº ${index + 1} — ${name}` }),
      `Relance la partie directement au tableau ${index + 1} (« ${name} »), sans rejouer les précédents. Équivaut à ?tableau=${index + 1} dans l’adresse.`,
    ).on('click', () => {
      actions.gotoTableau(index)
      hint.textContent = `Tableau ${index + 1} — ${name}.`
    })
  })
  describe(
    fTableaux.addButton({ title: '21-A BIS — LA GALERIE NOYÉE (PROTO)' }),
    'Lance le prototype de réfection du secteur A : un tableau « eau seule », hors expédition et hors registres. Aussi accessible depuis la fiche d’essai (bouton sous « Commencer l’essai »).',
  ).on('click', () => {
    actions.gotoBis()
    hint.textContent = 'Prototype 21-A bis — la galerie noyée.'
  })

  // ---- LE RAPPORT DE PERFORMANCE, au banc -------------------------------
  // Deux boutons, au plus près des réglages : on change une chose, on
  // mesure, on envoie — sans repasser par la fiche (qui met en pause et
  // fausserait la mesure).
  if (actions.ciel) {
    const fCiel = pane.addFolder({ title: 'Ciel du dehors', expanded: false })
    describe(
      fCiel.addBinding(actions.ciel, 'force', { min: 0, max: 1.5, label: 'force' }),
      'Dose la plaque de ciel. Le vide DOIT rester plus sombre que la cuve éclairée : au-delà, la hiérarchie lumineuse s’inverse et la scène se noie. Sans effet sur les fonds tuilé et procédural.',
    )
    describe(
      fCiel.addBinding(actions.ciel, 'etendue', {
        min: 2000,
        max: 20000,
        step: 100,
        label: 'étendue (u)',
      }),
      'Combien d’unités-monde la plaque couvre. Plus petite : le ciel est plus net et défile plus vite. Plus grande : plus doux, presque immobile. Un tableau fait 2400 unités, le hub 4500 — en dessous, le motif finit par se reconnaître.',
    )
  }

  // ---- LA PROFONDEUR DU FOND : deux nombres par couche ------------------
  // Une seule convention, pour les six curseurs : 1 = la couche se comporte
  // comme le plan de jeu, 0 = elle est infiniment loin. On règle à l'œil, en
  // dézoomant : c'est au moment où l'on prend du recul que ça se joue.
  if (actions.parallaxe) {
    const par = actions.parallaxe
    const fPar = pane.addFolder({ title: 'Profondeur du fond', expanded: false })
    const REGLE =
      'La même convention pour les six : 1 = la couche se comporte comme le plan de jeu (collée au monde, elle grandit comme lui), 0 = elle est infiniment loin (immobile, ou d’une taille qui ne change jamais). Entre les deux, c’est de la distance.'
    const couche = (
      cle: 'cielSuivi' | 'semisSuivi' | 'cuveSuivi',
      cleZ: 'cielZoom' | 'semisZoom' | 'cuveZoom',
      nom: string,
      quoi: string,
    ): void => {
      describe(
        fPar.addBinding(par, cle, { min: 0, max: 1, step: 0.01, label: nom + ' — suivi' }),
        quoi + ' Ce curseur-ci répond au DÉPLACEMENT de la caméra : à 1 la couche est collée au monde et défile comme lui, à 0 elle est collée à l’écran et ne bouge jamais. ' + REGLE,
      )
      describe(
        fPar.addBinding(par, cleZ, { min: 0, max: 1, step: 0.01, label: nom + ' — zoom' }),
        quoi + ' Ce curseur-ci répond au ZOOM, et c’est celui qui manquait : jusqu’ici toutes les couches grandissaient à l’identique, si bien que le dehors restait un défilement au lieu d’une profondeur. À 1 la couche grandit comme le monde ; à 0 sa taille apparente ne change jamais — elle est si loin que s’en approcher ne la grossit plus. C’est en DÉZOOMANT qu’on juge. ' + REGLE,
      )
    }
    couche('cielSuivi', 'cielZoom', 'station', 'La couche la plus lointaine : la plaque de ciel, ou la tuile d’intérim — la station à la dérive.')
    couche('semisSuivi', 'semisZoom', 'semis', 'Le semis d’étoiles proches, celui qui donne le mouvement du vide.')
    couche('cuveSuivi', 'cuveZoom', 'paroi', 'La paroi de cuve, DERRIÈRE l’eau — et son reflet, qui suit la même couche : deux profondeurs qui se contredisent se voient tout de suite.')
    describe(
      fPar.addBinding(par, 'ref', { min: 0.15, max: 1.5, step: 0.01, label: 'zoom d’étalonnage' }),
      'Le grossissement auquel toutes les couches s’accordent avec le monde — là, l’image est exactement celle d’avant ce réglage. À caler sur le zoom de JEU ordinaire : la profondeur ne doit alors se manifester qu’aux moments où l’on prend du recul (viser un dash, recadrer, regarder). Le trop régler bas ou haut fait « respirer » le fond en pleine action.',
    )
  }

  if (actions.perf) {
    const fPerf = pane.addFolder({ title: 'Rapport de performance', expanded: false })
    describe(
      fPerf.addButton({ title: 'COPIER' }),
      'Copie le rapport (JSON) dans le presse-papier : à coller dans la conversation d’analyse. Le rapport porte les réglages en cours, la scène, et la fenêtre de mesure — le collecteur repart à zéro à chaque changement de réglage, donc un rapport = une configuration.',
    ).on('click', () => {
      void actions.perf?.copier().then(dis)
    })
    describe(
      fPerf.addButton({ title: 'ENVOYER AU LABO' }),
      'Envoie le rapport au dépôt partagé (api/perf), signé de votre nom d’opérateur. Les vingt derniers sont conservés. Mesurez EN JEU — le banc flotte sur la partie qui tourne, contrairement au voile PARAMÈTRES qui la met en pause.',
    ).on('click', () => {
      dis('Envoi…')
      void actions.perf?.envoyer().then(dis)
    })
  }

  // ---- LE PUPITRE D'ESSAIS, au banc ------------------------------------
  // Les mêmes manœuvres que l'écran du menu — simuler une cérémonie, remplir
  // la bonbonne, verser, semer une ressource, entendre une ponctuation. Ici
  // elles tombent sous la main du réglage : on modifie un paramètre et on
  // rejoue l'événement dans la foulée, sans quitter le banc. Le catalogue
  // vient du panneau (main.ts) : jamais deux listes à tenir.
  if (actions.pupitre) {
    const fPup = pane.addFolder({ title: 'Pupitre d’essais', expanded: false })
    for (const sec of actions.pupitre.sections) {
      const fSec = fPup.addFolder({ title: sec.titre, expanded: false })
      for (const bt of sec.boutons) {
        describe(
          fSec.addButton({ title: bt.titre }),
          bt.aide || `Manœuvre du pupitre : ${bt.titre}.`,
        ).on('click', () => {
          const mot = actions.pupitre?.lance(bt.cle) ?? ''
          // le banc n'a pas la ligne d'état du pupitre : il redit le mot ici
          dis(mot || `${bt.titre} — fait.`)
        })
      }
    }
  }

  const fSound = pane.addFolder({ title: 'Son', expanded: false })
  describe(
    fSound.addBinding(actions.sound, 'actif'),
    'Effets sonores (synthèse procédurale, aucun fichier téléchargé). Le navigateur n’autorise le son qu’après un premier clic ou toucher. Réglage local, hors présets.',
  )
  describe(
    fSound.addBinding(actions.sound, 'volume', { min: 0, max: 1 }),
    'Volume général des effets et du bourdon de la station.',
  )

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
  describe(
    fProp.addBinding(params, 'regroupAccel', { min: 0, max: 2400, step: 10, label: 'rappel (rassembler)' }),
    'Impulsion sans direction (stick au neutre, pointeur sur le corps) : rappel de chaque particule vers le centre, en unités/s². Gratuit — rien ne part.',
  )
  describe(
    fProp.addBinding(params, 'regroupDamp', { min: 0, max: 20, label: 'amorti (rassembler)' }),
    'Pendant le rassemblement, la vitesse qui FUIT le centre est amortie (par seconde) : l’étalement cesse, l’élan d’ensemble du corps est conservé.',
  )

  const fVortex = pane.addFolder({ title: 'Vortex (outil de test)', expanded: false })
  const vortexToggle = {
    get actif() {
      return params.vortexEnabled >= 0.5
    },
    set actif(v: boolean) {
      params.vortexEnabled = v ? 1 : 0
    },
  }
  describe(
    fVortex.addBinding(vortexToggle, 'actif'),
    'Regroupement au clic droit (🌀 sur mobile). Coupé par défaut : il annule le coût de la perte d’eau, qui est le cœur du jeu — à réserver aux tests et au sandbox.',
  )
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

  const fCold = pane.addFolder({ title: 'Glace & froid', expanded: false })
  describe(
    fCold.addBinding(params, 'freezeSelfTime', { min: 0.1, max: 3, label: 'gel volontaire (s)' }),
    'Temps de prise quand on se change en glace (F / ❄). Le bloc garde son élan : un palet rigide qui ignore la chimie des parois et rebondit au lieu d’éclabousser.',
  )
  describe(
    fCold.addBinding(params, 'thawTime', { min: 0.5, max: 10, label: 'dégel (s)' }),
    'Temps de dégel (intention levée, ou à l’écart du froid). L’eau revient au corps dans le mouvement où la glace se trouvait.',
  )
  describe(
    fCold.addBinding(params, 'iceRestitution', { min: 0, max: 1, label: 'rebond glace' }),
    'Restitution des blocs de glace sur les parois. 1 : rebond parfait. 0 : la glace s’arrête au premier impact.',
  )
  describe(
    fCold.addBinding(params, 'coldBand', { min: 10, max: 250, step: 1, label: 'aura (u)' }),
    'Portée de l’aura de gel autour des plaques froides (tableau 2). L’eau y givre d’autant plus vite qu’elle est près de la plaque.',
  )
  describe(
    fCold.addBinding(params, 'freezeTime', { min: 0.2, max: 5, label: 'gel plaques (s)' }),
    'Temps d’exposition en pleine aura avant le gel complet. La glace prise au contact d’une plaque s’y soude : c’est l’ancrage.',
  )
  describe(
    fCold.addBinding(params, 'frostSluggish', { min: 0, max: 10, step: 0.5, label: 'engourdissement' }),
    'Le froid se sent AVANT le gel : l’eau qui givre devient pâteuse — traînée proportionnelle au givre. À 0, l’eau reste vive jusqu’à l’instant du gel.',
  )

  const fChill = pane.addFolder({ title: 'Refroidissement (expédition)', expanded: false })
  describe(
    fChill.addBinding(params, 'chillDuration', { min: 60, max: 1200, step: 10, label: 'durée (s)' }),
    'Temps de jeu simulé pour que le vaisseau devienne glacial. Pas de chronomètre à l’écran : la pression se lit dans la physique (auras qui s’étendent, chaudières qui faiblissent) et sur la température de coque du HUD.',
  )
  describe(
    fChill.addBinding(params, 'chillColdGrowth', { min: 0, max: 1.5, step: 0.05, label: 'poussée du froid' }),
    'À froid complet : extension des auras froides (× coldBand), gel plus prompt, dégel plus lent. Le gel subi devient la menace du dernier tiers.',
  )
  describe(
    fChill.addBinding(params, 'chillHeatFade', { min: 0, max: 0.9, step: 0.05, label: 'déclin des chaudières' }),
    'À froid complet : rétraction de l’aura des chaudières et vaporisation plus lente. La vapeur devient rare — pas impossible.',
  )

  const fHeat = pane.addFolder({ title: 'Chaleur (tableau 4)', expanded: false })
  describe(
    fHeat.addBinding(params, 'heatBand', { min: 10, max: 300, step: 1, label: 'aura (u)' }),
    'Portée de l’aura de chaleur autour des chaudières (chaque chaudière peut la multiplier dans l’éditeur). L’eau s’y vaporise d’autant plus vite qu’elle est près de la plaque — danger ou ressource, selon ce qu’on vient y chercher.',
  )
  describe(
    fHeat.addBinding(params, 'boilTime', { min: 0.3, max: 5, label: 'vaporisation (s)' }),
    'Temps d’exposition en pleine aura avant que l’eau ne se change en vapeur, qu’on le veuille ou non. La vapeur gagnée traverse les évents.',
  )
  describe(
    fHeat.addBinding(params, 'heatThawTime', { min: 0.1, max: 3, label: 'dégel forcé (s)' }),
    'Temps de dégel en pleine aura : la chaudière libère une glace soudée bien plus vite que l’air libre.',
  )
  describe(
    fHeat.addBinding(params, 'heatLossRate', { min: 0, max: 30, step: 0.5, label: 'évaporation /s' }),
    'Particules de vapeur perdues par seconde d’exposition dans l’aura : s’attarder sur la chaudière brûle du volume, définitivement. C’est la fenêtre d’usage de la chaleur.',
  )
  describe(
    fHeat.addBinding(params, 'heatAgitation', { min: 0, max: 800, step: 20, label: 'frémissement' }),
    'La chaleur se sent AVANT la vapeur : l’eau qui chauffe frémit — un bouillonnement doux, d’autant plus vif qu’elle approche de l’ébullition. À 0, l’eau reste calme jusqu’au changement d’état.',
  )

  const fGas = pane.addFolder({ title: 'Gaz (tableau 3)', expanded: false })
  describe(
    fGas.addBinding(params, 'vaporizeTime', { min: 0.1, max: 3, label: 'vaporisation (s)' }),
    'Temps de changement d’état vers la vapeur (G / 💨). En vapeur : le pointeur pilote le nuage, les évents se traversent, la chimie des parois ne mord plus.',
  )
  describe(
    fGas.addBinding(params, 'condenseTime', { min: 0.2, max: 5, label: 'condensation (s)' }),
    'Temps de retour à l’état liquide quand l’intention est levée. Le froid condense beaucoup plus vite, qu’on le veuille ou non.',
  )
  describe(
    fGas.addBinding(params, 'condenseRegroup', { min: 0, max: 1200, step: 20, label: 'regroupement' }),
    'Rappel des gouttelettes qui condensent vers le corps (u/s²) : redevenir eau ne disperse pas l’échantillon — le nuage retombe en pluie sur lui-même.',
  )
  describe(
    fGas.addBinding(params, 'gasLinkDecay', { min: 0.2, max: 6, step: 0.1, label: 'mémoire de lien (s)' }),
    'Après la condensation, le nuage compte encore comme UN corps pendant ce temps (le lien élargi s’éteint doucement) — le temps de se regrouper.',
  )
  describe(
    fGas.addBinding(params, 'gasDashSpeed', { min: 200, max: 1400, step: 20, label: 'vitesse de dash (u/s)' }),
    'Vitesse du dash À PLEINE PUISSANCE : viser ralentit le temps, relâcher lance tout le nuage — une impulsion, pas un pilotage. La distance du doigt règle la puissance.',
  )
  describe(
    fGas.addBinding(params, 'gasDashRange', { min: 60, max: 900, step: 10, label: 'portée de pleine puissance (u)' }),
    'Distance du pointeur au corps où le dash atteint sa pleine puissance. En deçà, la poussée décroît proportionnellement — viser près donne un petit bond précis, pas besoin de viser à deux kilomètres pour le maximum.',
  )
  describe(
    fGas.addBinding(params, 'gasAimSlow', { min: 0.01, max: 0.5, step: 0.01, label: 'ralenti de visée' }),
    'Facteur de temps pendant la visée du dash : 0,06 = seize fois plus lent. Le monde continue d’avancer — rien n’est figé, on vise dans un monde au ralenti.',
  )
  describe(
    fGas.addBinding(params, 'gasDashBudget', { min: 0, max: 9, step: 1, label: 'dashs / transformation' }),
    'Dashs rendus à CHAQUE transformation en vapeur (règle d’or) : se retransformer les rend à nouveau — mais repaie le péage de vaporisation. Chaque tableau peut fixer le sien dans l’éditeur ; un surchauffeur frôlé en rend un.',
  )
  describe(
    fGas.addBinding(params, 'vaporTollFrac', { min: 0, max: 0.5, step: 0.01, label: 'péage de vaporisation' }),
    'Fraction du volume actif éjectée en gouttes à CHAQUE bascule en vapeur — touche, chaudière ou zone forcée, toute cause confondue. La gerbe part en étoile à grande vitesse : récupérable, comme la matière de propulsion.',
  )
  describe(
    fGas.addBinding(params, 'gasIdleLossRate', { min: 0, max: 10, step: 0.5, label: 'coût d’état /s' }),
    'Particules perdues par seconde TANT QU’ON EST vapeur, même immobile : l’état gazeux est un compte à rebours, pas un mode de croisière. C’est le frein principal au tout-vapeur.',
  )
  describe(
    fGas.addBinding(params, 'grilleGasLoss', { min: 0, max: 2, step: 0.05, label: 'péage d’évent' }),
    'Perte par seconde et par particule prise dans la maille d’un évent : traverser essore le nuage. L’évent reste franchissable en vapeur — mais plus jamais gratuit.',
  )
  describe(
    fGas.addBinding(params, 'recondRate', { min: 0, max: 20, step: 0.5, label: 'recondensation /s' }),
    'La vapeur perdue se recondense en rosée près des plaques froides (§7.3), à ce débit — récupérable au prix d’un détour. À 0 : les pertes de vapeur sont définitives.',
  )
  describe(
    fGas.addBinding(params, 'recondFraction', { min: 0, max: 0.85, step: 0.05, label: 'rendement' }),
    'Part de la vapeur perdue qui perle effectivement (le reste est perdu). +0,25 à vaisseau glacial : le rattrapage devient plus généreux quand le jeu devient plus dur.',
  )
  describe(
    fGas.addBinding(params, 'gasExpand', { min: 0, max: 1000, step: 10, label: 'expansion' }),
    'Répulsion interne du nuage : haut, la vapeur s’étale largement (plus fragile) ; bas, elle reste compacte.',
  )
  describe(
    fGas.addBinding(params, 'gasTurb', { min: 0, max: 500, step: 5, label: 'turbulence' }),
    'Tourbillons internes du nuage : la fumée se tord en volutes. 0 : nuage inerte. Haut : fumée furieuse (et plus dure à piloter finement).',
  )
  describe(
    fGas.addBinding(params, 'gasDrag', { min: 0, max: 5, label: 'flottement' }),
    'Freinage propre du gaz. Haut : le nuage s’arrête vite quand on relâche. Bas : il dérive longtemps.',
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
  describe(
    fExit.addBinding(params, 'exitIceGrip', { min: 0, max: 1, step: 0.05, label: 'prise sur la glace' }),
    'Prise du courant sur un corps GELÉ : le sas attire le bloc entier (sans rotation), pas seulement l’eau libre. 0 : la glace n’est happée qu’au contact.',
  )

  const fLaser = pane.addFolder({ title: 'Laser', expanded: false })
  describe(
    fLaser.addBinding(params, 'laserMirrorSmooth', { min: 6, max: 90, step: 2, label: 'lissage du miroir (u)' }),
    'Rayon de moyennage de la normale quand le faisceau frappe la glace : le contact reste précis, mais la facette est lissée sur cette zone — le reflet ne tremble plus à chaque bosse de la surface. Bas : miroir granuleux, reflets chaotiques. Le dioptre de l’eau (réfraction) partage ce lissage.',
  )
  describe(
    fLaser.addBinding(params, 'laserRefractIndex', { min: 1, max: 2.4, step: 0.01, label: 'indice de réfraction' }),
    'Le corps LIQUIDE est un prisme : le rayon se plie à chaque traversée de surface (Snell-Descartes), et se réfléchit SOUS la surface au-delà de l’angle critique (≈ 49° à 1,33 — l’eau réelle). Plus haut : le prisme plie davantage et piège plus facilement. À 1 : l’eau redevient transparente (palier 1).',
  )
  describe(
    fLaser.addBinding(params, 'plasmaRailRadius', { min: 10, max: 90, step: 2, label: 'capture de rail (u)' }),
    'La VAPEUR ionise le faisceau en arc de plasma ; l’arc qui passe à moins de ce rayon de la LIGNE d’un rail magnétique — n’importe où le long — est capturé et la suit DANS LE SENS DU TRACÉ (les flèches) jusqu’au bout. Grand : capture indulgente. Le faisceau NON ionisé ignore les rails.',
  )
  describe(
    fLaser.addBinding(params, 'plasmaConvoy', { min: 0, max: 3000, step: 50, label: 'convoyage (u/s²)' }),
    'Tant que l’arc circule sur un rail, le champ est actif : la VAPEUR prise dans la bande est ENTRAÎNÉE le long de la ligne, dans le sens des chevrons — le nuage voyage sur la ligne de champ. À 0 : seul l’arc est guidé, le nuage reste sur place.',
  )
  describe(
    fLaser.addBinding(params, 'plasmaSortie', { min: 40, max: 1200, step: 20, label: 'sortie du tube (u/s)' }),
    'La paroi d’un conduit POUSSE dehors ce qui s’y condense, à cette vitesse au plus. Sans borne, une particule enfoncée de tout le rayon du tube en ressortait à rayon/pas de temps — mesuré 2861 u/s, le corps projeté à 680 u de son point d’arrivée. Grand : le tube recrache sec ; petit : le corps s’extrait mollement.',
  )
  describe(
    fLaser.addBinding(params, 'plasmaConfin', { min: 0, max: 30, step: 1, label: 'confinement (1/s)' }),
    'Le champ CONFINE : la vitesse EN TRAVERS de la ligne s’amortit à cette cadence pour ce qui voyage dans la bande — c’est lui qui fait prendre les virages (le rappel seul ne courbe pas un nuage lancé à 500 u/s ; mesuré : le coude à 90° éjectait TOUT le nuage). À 0 : la tenue de rail d’avant, qui s’éparpille au premier coude.',
  )

  const fBody = pane.addFolder({ title: 'Corps', expanded: false })
  describe(
    fBody.addBinding(params, 'dispersalGrace', { min: 0, max: 6, step: 0.1, label: 'grâce dispersion (s)' }),
    'La dispersion se constate, elle ne se décrète pas : il faut rester sous le seuil critique aussi longtemps d’affilée. Le temps pour un corps qui condense ou dégèle de se regrouper.',
  )
  describe(
    fBody.addBinding(params, 'criticalVolumeLiters', { min: 0.05, max: 2, step: 0.05, label: 'seuil dernière impulsion (L)' }),
    'Volume ABSOLU (litres) sous lequel la PROCHAINE impulsion est la dernière. Le seuil ne tue plus et ne conclut rien : après elle, le corps se fige et dérive. En litres pour ne pas dépendre du volume de départ du tableau.',
  )
  describe(
    fBody.addBinding(params, 'lastCallLiters', { min: 0.1, max: 3, step: 0.05, label: 'seuil d’alerte (L)' }),
    'Volume (litres) sous lequel le HUD prévient que la dernière impulsion approche. À garder au-dessus du seuil précédent.',
  )
  describe(
    fBody.addBinding(params, 'iceCollectBonus', { min: 0, max: 1, step: 0.05, label: 'prime de glace' }),
    'Prime sur la part que le sas avale à l’état de GLACE : entrer solide rapporte plus que se faire boire goutte à goutte.',
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
    fMat.addBinding(params, 'surfaceBite', { min: 0.5, max: 3, step: 0.05, label: 'mordant global' }),
    'LE curseur de dureté : multiplie l’effet de toutes les surfaces — adhésion et arrachage hydrophiles, répulsion hydrophobe, engluement et absorption de l’éponge, gel d’aura, évaporation à la chaudière. S’applique par-dessus les réglages individuels (et les présets).',
  )
  describe(
    fMat.addBinding(params, 'hydroBand', { min: 4, max: 150, step: 1, label: 'portée bande' }),
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
    fMat.addBinding(params, 'hydrophobeIceRestitution', { min: 0, max: 2, step: 0.05, label: 'bumper glace' }),
    'Restitution du PALET de glace sur l’hydrophobe. Au-delà de 1, le bumper rend plus qu’il ne reçoit — l’effet flipper du tableau des règles.',
  )
  describe(
    fMat.addBinding(params, 'hydrophobeIceKick', { min: 0, max: 800, step: 10, label: 'pichenette glace' }),
    'Vitesse d’éjection minimale d’un palet qui touche l’hydrophobe : même en dérive lente, il repart d’un coup sec.',
  )
  describe(
    fMat.addBinding(params, 'hydrophileIceDrag', { min: 0, max: 8, step: 0.1, label: 'freinage glace' }),
    'Le mouillage retient le palet qui glisse sur l’hydrophile : translation et rotation s’essoufflent (« ralentis » du tableau des règles).',
  )
  describe(
    fMat.addBinding(params, 'hydroGasWeight', { min: 0, max: 1, step: 0.05, label: 'poids vapeur' }),
    'Force des bandes chimiques sur la VAPEUR, en fraction de l’effet plein : l’hydrophile attire le nuage, l’hydrophobe le repousse — légèrement, comme une gravité.',
  )
  describe(
    fMat.addBinding(params, 'hydroGasReach', { min: 1, max: 5, step: 0.1, label: 'portée vapeur' }),
    'Portée des bandes pour la vapeur, en multiple de la portée de bande : le nuage s’infléchit bien avant la paroi.',
  )
  describe(
    fMat.addBinding(params, 'wallSplashDamp', { min: 0, max: 1, label: 'amorti impact' }),
    'Amortit le rebond de l’eau sur les murs neutres : haut, l’impact s’étale et épouse la paroi ; à 0, l’eau éclate en jaillissant.',
  )
  describe(
    fMat.addBinding(params, 'wallSplashBand', { min: 4, max: 60, label: 'portée amorti' }),
    'Distance à laquelle l’amorti d’impact agit autour d’un mur neutre. À garder au ras de la paroi (~2 espacements) : large, les murs semblent RETENIR le corps à distance.',
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

  // ---- L'ŒIL DU SUJET : la présence se règle à VUE ----
  // Le banc flotte sur le jeu : chaque glissière s'applique à l'image
  // suivante. Hors présets — mémorisé par appareil, pas par préset.
  if (actions.oeil) {
    const { regl, defauts, sauve } = actions.oeil
    const fOeil = pane.addFolder({ title: 'L’œil du Sujet', expanded: false })
    const ROWS: [string, string, number, number, string][] = [
      [
        'lueur',
        'lueur du noyau',
        0,
        2.5,
        'Luminosité du noyau clair qui vit dans le corps. 0 : éteint. 2,5 : un phare sous la surface.',
      ],
      [
        'ombre',
        'pénombre',
        0,
        2,
        'Profondeur de la silhouette sombre tapie autour du noyau. 0 : aucune ombre — la chose ne se devine plus.',
      ],
      [
        'taille',
        'taille de l’œil',
        0.5,
        2,
        'Échelle de l’œil entier : noyau, pénombre et dôme grandissent ensemble.',
      ],
      [
        'relief',
        'relief (le dôme)',
        0,
        2.5,
        'Hauteur du dôme que le regard soulève : la courbure du miroir et le modelé sans miroir. 0 : surface plate.',
      ],
      [
        'vivacite',
        'vivacité du regard',
        0.3,
        3,
        'Vitesse à laquelle l’œil glisse vers ce qu’il regarde. Bas : contemplatif. Haut : nerveux.',
      ],
      [
        'errance',
        'errance au repos',
        0,
        2,
        'Quand rien ne l’appelle, le regard vagabonde lentement dans le corps en gardant une demi-présence. 0 : il rentre se poser au centre et s’éteint (l’ancien comportement).',
      ],
      [
        'curiosite',
        'curiosité (idle)',
        0.3,
        3,
        'Fréquence des occupations quand on le laisse tranquille : toilette, tentacule, toc-toc, penser au sas.',
      ],
    ]
    for (const [cle, label, min, max, texte] of ROWS) {
      const b = fOeil.addBinding(regl, cle, { min, max, step: 0.05, label })
      b.on('change', sauve)
      describe(b, texte)
    }
    describe(
      fOeil.addButton({ title: 'Revenir aux défauts' }),
      'Remet les sept curseurs aux valeurs LIVRÉES — l’étalonnage retenu par le concepteur.',
    ).on('click', () => {
      Object.assign(regl, defauts)
      sauve()
      pane.refresh()
    })
  }

  // Le PLAN DE LA VOIE ne se règle plus ici : ses paramètres vivent dans
  // l'écran LE CAHIER DES RÈGLES (bouton PARAMÈTRES DU CYCLE) — le banc
  // règle la simulation, pas le cycle de vie d'une partie.

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
      label: 'échelle rendu',
      // le nombre BRUT, pas un mot : c'est lui qui explique la cadence, et
      // on veut le voir s'installer pendant qu'on joue. 1,00 = natif.
      format: (v: number) => `×${v.toFixed(2)}`,
    }),
    'L’ÉCHELLE DE RENDU appliquée au canvas (1,00 = natif ; l’interface HTML reste nette quoi qu’il arrive). Le coût d’une image est proportionnel au NOMBRE DE PIXELS — mesuré sur iPad : ×1,50 → 18 im/s, ×1,00 → 45. En résolution DYNAMIQUE, ce nombre se calcule pour atteindre la cadence visée et ne descend jamais sous « faible ». La physique, elle, n’est jamais dégradée.',
  )
  describe(
    fMon.addBinding(monitor, 'physMs', {
      readonly: true,
      label: 'physique (ms)',
      format: (v: number) => v.toFixed(1),
    }),
    'Coût CPU des pas de physique par image, lissé. Au-delà de ~10 ms, le jeu passe en léger ralenti plutôt que de saccader.',
  )
  describe(
    fMon.addBinding(monitor, 'renderMs', {
      readonly: true,
      label: 'rendu (ms)',
      format: (v: number) => v.toFixed(1),
    }),
    'Coût CPU de la préparation du rendu par image, lissé (le travail GPU s’ajoute par-dessus).',
  )

  // Le journal des livraisons a quitté le banc : il vit dans son propre
  // écran (bouton LIVRAISONS de la fiche), téléchargeable — et le banc
  // porte un DOM d'autant plus léger.

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
    a.download = `projet-21-${slug}.json`
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

  // Préset par défaut : appliqué dès l'ouverture depuis le cache local — la
  // bibliothèque partagée, quand elle répond, confirme ou corrige ce choix.
  {
    const def = presets.find((q) => q.title === defaultTitle)
    if (def) {
      applyPreset(def)
      hint.textContent = `Préset par défaut « ${def.title} » appliqué.`
    }
  }

  return pane
}
