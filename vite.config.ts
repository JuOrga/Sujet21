import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: './',
  server: {
    watch: {
      // LE SUIVI D'ENTRAÎNEMENT (?agent=…&suivre=N) écrit un fichier de
      // politique dans public/agents/ à chaque itération, soit environ une
      // fois par seconde. Sans cette exception, vite verrait le fichier
      // changer et RECHARGERAIT la page à chaque fois : on ne verrait jamais
      // l'agent jouer plus d'une seconde. Le jeu le relit tout seul.
      ignored: ['**/public/agents/**'],
    },
  },
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
})
