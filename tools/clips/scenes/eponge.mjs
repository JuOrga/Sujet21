// L'ÉPONGE — « La buveuse » (21-06). Le corps s'écrase à pleine allure sur
// le mur d'éponge : il s'y étale, et le mur le boit — 3,25 L au contact,
// 0,37 L 1,8 s plus tard (mesuré sur le tournage du 10/11/2026).
//
// Ni jauge ni panneau de fin : on ne montre que la matière qui disparaît
// dans le mur. Le film s'arrête quand il ne reste que des gouttes.
import { pilote, suiveur, adouci } from './outils.mjs'

const AVANT = 190 // l'élan se prend hors champ : le film s'ouvre corps lancé

export default {
  tableau: 6,
  dureeSon: 60,
  masque: 'tout',
  sansEcrit: true,
  async tourne(jeu, fichier) {
    await jeu.pas(170)
    let e = await jeu.etat()
    // le pilote vise l'AUTRE côté du mur, comme un joueur qui n'a pas vu
    // l'éponge : il s'y écrase et continue de pousser
    const balises = [
      { x: -160, y: -220, allure: 240 },
      { x: 420, y: -200, allure: 200 },
    ]
    let b = 0
    const geste = pilote()
    const suit = suiveur(e, { raideur: 0.09 })
    const large = jeu.largeur / 1100
    const serre = jeu.largeur / 720
    let bu = -1 // l'image où le corps est bu
    let fige = null
    for (let i = 0; i < 1000; i++) {
      if (i === AVANT) await jeu.filme(fichier)
      // le cadre se resserre à l'approche du mur : c'est là que tout se joue
      const z = fige ? serre : adouci(large, serre, (e.x + 520) / 420)
      if (bu < 0 && e.n < 320 && e.x > -200) {
        bu = i
        // le corps n'existe plus : son centre saute de goutte en goutte. La
        // caméra reste sur le mur, là où il a été bu.
        fige = { x: -70, y: e.y, vx: 0, vy: 0 }
      }
      const c = fige ? suit(fige) : suit(e, { x: 60, y: 0 })
      if (i >= 20 && !e.disperse && e.n > 3) {
        const g = geste(e, balises[b], balises[b].allure)
        if (g.d < 170 && b < balises.length - 1) b++
        if (g.pousse) await jeu.vise(g.vise.x, g.vise.y)
        else await jeu.lache()
      } else await jeu.lache()
      e = await jeu.image({ cam: { x: c.x, y: c.y - (0.03 * jeu.hauteur) / z, z } })
      if (i % 30 === 0) jeu.dit(((i - AVANT) / 60).toFixed(1), 's pos', e.x.toFixed(0), e.y.toFixed(0), 'n', e.n, '/', e.tout)
      if (bu >= 0 && i - bu > 170) break
    }
    await jeu.lache()
  },
  publication: {
    legende: 'Le mur avait soif.',
    mots: ['#jeuindé', '#indiegame', '#physique', '#satisfaisant', '#gamedev', '#simulation'],
  },
}
