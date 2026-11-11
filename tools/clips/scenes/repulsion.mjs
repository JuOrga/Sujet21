// LA RÉPULSION — « Le rebond » (21-02). Le corps dérive vers une paroi
// hydrophobe et ne la touche jamais : repoussé à distance, il s'aplatit en
// un long arc qui flotte devant le mur.
//
// Plan fixe devant la paroi ; l'élan se prend hors champ, caméra libre.
import { pilote } from './outils.mjs'

export default {
  tableau: 2,
  dureeSon: 60,
  masque: 'tout',
  sansEcrit: true,
  async tourne(jeu, fichier) {
    await jeu.pas(170)
    let e = await jeu.etat()
    const geste = pilote()
    const z = jeu.largeur / 760
    let debut = -1
    for (let i = 0; i < 1200; i++) {
      if (debut < 0 && e.x > -520) {
        debut = i
        await jeu.filme(fichier)
      }
      if (debut < 0) {
        const g = geste(e, { x: -180, y: -140 }, 150)
        if (g.pousse) await jeu.vise(g.vise.x, g.vise.y)
        else await jeu.lache()
      } else await jeu.lache()
      e = await jeu.image({ cam: debut < 0 ? { libre: true } : { x: -310, y: -205, z } })
      if (i % 30 === 0) jeu.dit(i, debut < 0 ? 'hors champ' : ((i - debut) / 60).toFixed(1) + ' s', 'pos', e.x.toFixed(0), e.y.toFixed(0), 'v', Math.hypot(e.vx, e.vy).toFixed(0), 'n', e.n, '/', e.tout)
      if (debut >= 0 && i - debut > 400) break
    }
  },
  publication: {
    legende: 'Elle refuse de toucher le mur.',
    mots: ['#jeuindé', '#indiegame', '#physique', '#satisfaisant', '#gamedev', '#simulation'],
  },
}
