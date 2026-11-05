import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'

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

// LE JEU, ANNONCÉ D'AVANCE. L'entrée de la page est src/amorce.ts, qui
// n'importe main.ts qu'une fois la page affichée (le pré-rendu de Chrome
// le faisait tourner en cachette — voir src/activation.ts). Laissé seul,
// ce chargement à la demande coûterait un aller-retour de plus : l'entrée
// arrive, s'exécute, PUIS réclame le gros du jeu. On l'annonce donc dans
// index.html en modulepreload — lui et les modules qu'il importe
// statiquement : le navigateur le télécharge en même temps que l'entrée,
// et pendant un pré-rendu, il le télécharge sans l'exécuter.
function annonceLeJeu(): Plugin {
  let base = '/'
  return {
    name: 'annonce-le-jeu',
    apply: 'build',
    configResolved(c) {
      base = c.base
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const bundle = ctx.bundle
        if (!bundle) return
        // par son contenu, pas par sa façade : main.ts n'exporte rien, et
        // Rollup laisse alors facadeModuleId à null
        const jeu = Object.values(bundle).find(
          (c) => c.type === 'chunk' && c.moduleIds.some((id) => id.endsWith('/src/main.ts')),
        )
        // une erreur franche plutôt qu'une page qui charge en deux temps
        // sans que personne ne le voie
        if (!jeu || jeu.type !== 'chunk') throw new Error('annonce-le-jeu : module du jeu introuvable')
        const fichiers = new Set<string>()
        const suit = (nom: string): void => {
          const c = bundle[nom]
          // l'entrée est déjà là, en <script> : main.ts lui emprunte l'aide
          // de préchargement de Vite, inutile de l'annoncer deux fois
          if (fichiers.has(nom) || c?.type !== 'chunk' || c.isEntry) return
          fichiers.add(nom)
          c.imports.forEach(suit)
        }
        suit(jeu.fileName)
        return [...fichiers].map((f) => ({
          tag: 'link',
          attrs: { rel: 'modulepreload', crossorigin: true, href: base + f },
          injectTo: 'head' as const,
        }))
      },
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [annonceLeJeu()],
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
