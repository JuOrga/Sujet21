// LA VAPEUR — « Le premier souffle » (21-05). Le corps se pose sur la
// chaudière : il bout, crache ses gouttes, puis se défait en un nuage doré
// qui s'étire dans la salle.
//
// Plan fixe sur la chaudière. Le pilote LÂCHE au contact : tenir le pointeur
// pendant que le corps passe en vapeur arme la visée du dash, qui ralentit
// le temps — l'ébullition se filmerait au ralenti sans qu'on l'ait voulu.
import { pilote } from './outils.mjs'

const CHAUDIERE = { x: -540, y: -440 }

export default {
  tableau: 5,
  dureeSon: 60,
  masque: 'jauge',
  sansEcrit: true,
  async tourne(jeu, fichier) {
    await jeu.pas(170)
    let e = await jeu.etat()
    const geste = pilote()
    const z = jeu.largeur / 820
    let debut = -1
    let contact = -1
    for (let i = 0; i < 1500; i++) {
      if (debut < 0 && e.y < -200) {
        debut = i
        await jeu.filme(fichier)
      }
      if (contact < 0 && (e.y < -372 || e.n < 680)) contact = i
      if (contact < 0) {
        const g = geste(e, { x: CHAUDIERE.x, y: CHAUDIERE.y + 40 }, 200)
        if (g.pousse) await jeu.vise(g.vise.x, g.vise.y)
        else await jeu.lache()
      } else await jeu.lache()
      // caméra libre tant qu'on ne filme pas : le pointeur a besoin du corps à l'écran
      e = await jeu.image({ cam: debut < 0 ? { libre: true } : { x: CHAUDIERE.x + 130, y: CHAUDIERE.y + 150, z } })
      if (i % 30 === 0) jeu.dit(i, debut < 0 ? 'hors champ' : ((i - debut) / 60).toFixed(1) + ' s', 'pos', e.x.toFixed(0), e.y.toFixed(0), 'n', e.n, '/', e.tout, 'gaz', e.gaz.toFixed(2))
      if (debut >= 0 && i - debut > 520) break
    }
  },
  // le plan commence une demi-seconde avant l'événement (montage « B »)
  montage: { debut: 0.9 },
  publication: {
    legende: 'Il ne fallait pas se poser là.',
    mots: ['#jeuindé', '#indiegame', '#physique', '#satisfaisant', '#gamedev', '#simulation'],
  },
}
