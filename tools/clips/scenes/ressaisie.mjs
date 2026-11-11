// LA RESSAISIE — « Le rebond » (21-02). La paroi hydrophobe étire le corps en
// un long arc (voir repulsion.mjs). Cette fois le doigt se pose sur lui : les
// deux bouts de l'arc reviennent d'un coup vers le centre.
import { pilote } from './outils.mjs'

export default {
  tableau: 2,
  dureeSon: 60,
  masque: 'jauge',
  sansEcrit: true,
  async tourne(jeu, fichier) {
    await jeu.pas(170)
    let e = await jeu.etat()
    const geste = pilote()
    const z = jeu.largeur / 760
    let debut = -1
    for (let i = 0; i < 1300; i++) {
      if (debut < 0 && e.x > -520) {
        debut = i
        await jeu.filme(fichier)
      }
      const t = debut < 0 ? -1 : i - debut
      if (debut < 0) {
        const g = geste(e, { x: -180, y: -140 }, 150)
        if (g.pousse) await jeu.vise(g.vise.x, g.vise.y)
        else await jeu.lache()
      } else if (t >= 215 && t < 215 + 170) {
        await jeu.toucheCorps() // l'arc est long : on le rappelle
      } else await jeu.lache()
      e = await jeu.image({ cam: debut < 0 ? { libre: true } : { x: -310, y: -205, z } })
      if (i % 30 === 0) jeu.dit(i, debut < 0 ? 'hors champ' : (t / 60).toFixed(1) + ' s', 'pos', e.x.toFixed(0), e.y.toFixed(0), 'v', Math.hypot(e.vx, e.vy).toFixed(0), 'r', e.r.toFixed(0), 'n', e.n, e.rassemble ? 'RASSEMBLE' : '')
      if (t > 525) break
    }
    await jeu.lache()
  },
  publication: {
    legende: 'Rappelée.',
    mots: ['#jeuindé', '#indiegame', '#physique', '#satisfaisant', '#gamedev', '#simulation'],
  },
}
