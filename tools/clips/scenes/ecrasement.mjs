// L'ÉCRASEMENT — « Le berceau » (21-01). Le corps fonce sur l'îlot rond du
// centre, une paroi neutre : il s'y écrase et l'enlace presque en anneau.
// Puis le doigt se pose SUR le corps : il se rassemble — l'anneau se
// contracte en boule, et l'élan de ce retour le renvoie d'où il vient, plus
// vite qu'il n'était arrivé (172 u/s à l'aller, 210 au retour, mesuré sur
// l'aperçu du 11/11).
//
// Le concepteur (11/11) : « il vient s'écraser contre une surface neutre […]
// on clique dessus, ça le regroupe, mais les éléments qui étaient à l'opposé
// reviennent vite, donc ça lui fait faire complètement autre chose. »
import { pilote } from './outils.mjs'

const ILOT = { x: 100, y: 0, r: 140 } // level.ts : l'îlot rond, de −40 à 240

export default {
  tableau: 1,
  dureeSon: 60,
  masque: 'jauge',
  sansEcrit: true,
  async tourne(jeu, fichier) {
    await jeu.pas(170)
    let e = await jeu.etat()
    const geste = pilote()
    const z = jeu.largeur / 820
    let debut = -1
    let choc = -1
    for (let i = 0; i < 1500; i++) {
      if (debut < 0 && e.x > -380) {
        debut = i
        await jeu.filme(fichier)
      }
      // « enlacé » : le corps s'est étalé autour de l'îlot. On le lit à son
      // ÉTENDUE (rayon quadratique, 67 u en boule) et non à sa vitesse : il
      // ralentit dès le premier contact, bien avant de s'être enroulé — un
      // toucher déclenché là le gardait en boule, et il n'y avait rien à voir
      if (choc < 0 && debut >= 0 && e.r > 132) choc = i
      if (debut < 0) {
        // l'élan, caméra libre : droit sur l'îlot
        const g = geste(e, ILOT, 225)
        if (g.pousse) await jeu.vise(g.vise.x, g.vise.y)
        else await jeu.lache()
      } else if (choc >= 0 && i - choc >= 6 && i - choc < 6 + 130) {
        // enroulé autour de l'îlot : le doigt se pose sur le BOUT le plus
        // étiré de l'anneau (« pas au centre », le concepteur, 11/11) et
        // l'accompagne pendant qu'il revient
        await jeu.toucheCorps({ ou: 'bout' })
      } else await jeu.lache()
      e = await jeu.image({ cam: debut < 0 ? { libre: true } : { x: ILOT.x - 250, y: ILOT.y + 30, z } })
      if (i % 30 === 0) jeu.dit(i, debut < 0 ? 'hors champ' : ((i - debut) / 60).toFixed(1) + ' s', 'pos', e.x.toFixed(0), e.y.toFixed(0), 'v', Math.hypot(e.vx, e.vy).toFixed(0), 'r', e.r.toFixed(0), 'n', e.n, e.rassemble ? 'RASSEMBLE' : '')
      if (choc >= 0 && i - choc > 225) break // le corps a quitté le cadre
    }
    await jeu.lache()
  },
  // le plan commence une demi-seconde avant l'événement (montage « B »)
  montage: { debut: 0.8 },
  publication: {
    legende: 'Il se ramasse.',
    mots: ['#jeuindé', '#indiegame', '#physique', '#satisfaisant', '#gamedev', '#simulation'],
  },
}
