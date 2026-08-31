import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vitest/config'

// LES POLITIQUES SERVIES À CHAUD. Deux pièges de vite se combinent ici, et
// il faut les traiter ensemble :
//
//  1. Le SUIVI d'entraînement (?agent=…&suivre=N) réécrit un fichier de
//     politique dans public/agents/ à chaque itération, soit environ une
//     fois par seconde. Si vite surveille ce dossier, il RECHARGE la page à
//     chaque écriture : on ne verrait jamais l'agent jouer plus d'une
//     seconde. D'où l'exception de `server.watch.ignored`.
//  2. Mais vite 5 dresse au démarrage la LISTE des fichiers de public/ et
//     refuse de servir ce qui n'y figure pas ; cette liste est tenue à jour
//     par le watcher. Un fichier créé après coup dans un dossier ignoré
//     n'est donc jamais servi : vite retombe sur index.html et le jeu reçoit
//     du HTML au lieu d'une politique.
//
// Ce plugin lit le fichier sur le disque à chaque requête, avant que vite
// n'ait son mot à dire. L'ordre de lancement (entraînement ou serveur
// d'abord) n'a plus d'importance.
function politiquesEnDirect(): Plugin {
  return {
    name: 'politiques-en-direct',
    configureServer(serveur) {
      serveur.middlewares.use((req, res, suite) => {
        const chemin = (req.url ?? '').split('?')[0]
        if (!/^\/agents\/[\w.-]+\.json$/.test(chemin)) return suite()
        const fichier = path.join(process.cwd(), 'public', chemin)
        readFile(fichier)
          .then((contenu) => {
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'no-store')
            res.end(contenu)
          })
          .catch(() => suite())
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [politiquesEnDirect()],
  server: {
    // PARTAGER LA PARTIE EN COURS. `cloudflared tunnel --url
    // http://localhost:5173` donne une adresse publique en *.trycloudflare.com
    // ; sans cette autorisation vite refuse la requête (« Blocked request »).
    // Volontairement limité à ce domaine : le serveur de développement n'est
    // pas ouvert à n'importe quel hôte.
    allowedHosts: ['.trycloudflare.com'],
    watch: {
      // Voir le commentaire ci-dessus : sans cette exception, chaque
      // itération d'entraînement rechargerait la page.
      ignored: ['**/public/agents/**'],
    },
  },
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
})
