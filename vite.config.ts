import { defineConfig } from 'vitest/config'

// LE JOURNAL, LU À LA CONFIGURATION — pas dans le paquet.
//
// Cet import s'exécute quand Vite lit sa configuration, dans Node, AVANT
// et HORS de la compilation du jeu : rien de ce fichier n'entre dans le
// paquet par ce chemin. Il ne sert qu'à calculer deux littéraux que le jeu
// a besoin de connaître SANS attendre — la version (écrite sur la fiche dès
// l'accueil) et la dernière livraison (citée par le rapport de performance,
// qui est synchrone).
//
// C'est ce qui permet à src/bench/livraisons.ts de n'être plus chargé qu'à
// la demande, tout en gardant la règle d'origine : « N avance TOUT SEUL à
// chaque livraison » — aucun numéro à tenir à jour à la main.
import { DELIVERIES } from './src/bench/livraisons'
import { execSync } from 'node:child_process'

// LA PROVENANCE DU PAQUET (voir src/game/provenance.ts pour le pourquoi).
// Le numéro de livraison ne distingue pas deux branches ; le commit, si.
// Ordre des sources : ce que le workflow passe (--build-env), ce que
// Vercel ou GitHub posent d'eux-mêmes, puis git — le seul qui réponde en
// local, où il n'y a ni workflow ni Vercel.
function gitDit(commande: string): string {
  try {
    return execSync(commande, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return '' // pas de dépôt git (construction sur Vercel) : on passe
  }
}
const COMMIT = (
  process.env.VITE_COMMIT ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  gitDit('git rev-parse HEAD')
).slice(0, 7)
const BRANCHE =
  process.env.VITE_BRANCHE ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.GITHUB_REF_NAME ||
  gitDit('git rev-parse --abbrev-ref HEAD')

export default defineConfig({
  base: './',
  define: {
    __NB_LIVRAISONS__: JSON.stringify(DELIVERIES.length),
    __DERNIERE_LIVRAISON__: JSON.stringify({
      date: DELIVERIES[0]?.date ?? '',
      title: DELIVERIES[0]?.title ?? '',
    }),
    __PROVENANCE__: JSON.stringify({
      commit: COMMIT || 'inconnu',
      branche: BRANCHE || 'inconnue',
    }),
  },
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
})
