// L'AMORCE DES PRÉSETS — ce que le banc faisait pour TOUT LE MONDE.
//
// Le banc de réglage (bench.ts, Tweakpane) ne se charge plus qu'à la
// demande : un joueur qui n'ouvre jamais BANC ne le télécharge pas. Mais le
// banc faisait deux choses au démarrage qui ne concernent pas que le
// concepteur : appliquer le préset PAR DÉFAUT (le réglage commun aux
// testeurs, cache local d'abord), puis laisser la bibliothèque partagée le
// confirmer ou le corriger. Sans cette amorce, différer le banc aurait
// changé la physique de chaque partie — en silence.
//
// Elle vit donc ici, sans Tweakpane, et s'exécute au chargement. Les
// entrées-sorties (stockage local, appel réseau) s'injectent : le test
// vérifie l'enchaînement sans navigateur ni serveur.

import type { SimParams } from '../sim/params'
import {
  builtinPresets,
  copyParams,
  fetchSharedPresets,
  loadStoredDefault,
  loadStoredPresets,
  mergePresets,
  storePresets,
  storeStoredDefault,
  type Preset,
  type SharedLibrary,
} from './presets'

export interface EntreesSortiesPresets {
  presetsLocaux: () => Preset[]
  defautLocal: () => string | null
  chargePartage: () => Promise<SharedLibrary>
  rangePresets: (liste: Preset[]) => void
  rangeDefaut: (titre: string | null) => void
}

const IO_NAVIGATEUR: EntreesSortiesPresets = {
  presetsLocaux: loadStoredPresets,
  defautLocal: loadStoredDefault,
  chargePartage: fetchSharedPresets,
  rangePresets: storePresets,
  rangeDefaut: storeStoredDefault,
}

export interface AmorcePresets {
  /** Le préset appliqué tout de suite depuis le cache local (null : aucun). */
  local: Preset | null
  /** La bibliothèque partagée, une fois répondue : le préset qu'elle a fait
   *  appliquer en plus (null : rien à corriger, ou réseau absent). */
  partage: Promise<Preset | null>
}

/** Applique le préset par défaut au lancement, puis laisse la bibliothèque
 *  partagée corriger ce choix — exactement ce que le banc faisait à sa
 *  création, sans le banc. */
export function amorcePresets(
  params: SimParams,
  io: EntreesSortiesPresets = IO_NAVIGATEUR,
): AmorcePresets {
  let presets = mergePresets(builtinPresets(), io.presetsLocaux())
  let defaut = io.defautLocal()
  const local = presets.find((p) => p.title === defaut) ?? null
  if (local) copyParams(local.params, params)

  const partage = io
    .chargePartage()
    .then((lib) => {
      presets = mergePresets(presets, lib.presets)
      io.rangePresets(presets)
      // Le défaut partagé fait foi : il corrige (ou efface) le cache local
      const change = lib.defaultTitle !== defaut
      defaut = lib.defaultTitle
      io.rangeDefaut(defaut)
      const def = change ? presets.find((p) => p.title === defaut) : undefined
      if (!def) return null
      copyParams(def.params, params)
      return def
    })
    // sans backend (dev local), on garde le cache local sans bruit
    .catch(() => null)

  return { local, partage }
}
