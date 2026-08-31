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

export default defineConfig({
  base: './',
  define: {
    __NB_LIVRAISONS__: JSON.stringify(DELIVERIES.length),
    __DERNIERE_LIVRAISON__: JSON.stringify({
      date: DELIVERIES[0]?.date ?? '',
      title: DELIVERIES[0]?.title ?? '',
    }),
  },
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
})
