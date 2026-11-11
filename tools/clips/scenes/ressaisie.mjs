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
      } else if (t >= 215 && t < 215 + 110) {
        // l'arc est long : UN toucher, tenu 1,8 s — le temps que les deux
        // bouts reviennent ET que leur élan s'amortisse. Tenu 2,8 s (premier
        // montage) il ne rappelait plus rien sur la fin ; lâché au bout
        // d'une seconde (essai du 11/11) les deux bouts se percutaient et le
        // corps éclatait : 3,54 L puis 0,69 L
        await jeu.toucheCorps()
      } else await jeu.lache()
      e = await jeu.image({ cam: debut < 0 ? { libre: true } : { x: -310, y: -205, z } })
      if (i % 30 === 0) jeu.dit(i, debut < 0 ? 'hors champ' : (t / 60).toFixed(1) + ' s', 'pos', e.x.toFixed(0), e.y.toFixed(0), 'v', Math.hypot(e.vx, e.vy).toFixed(0), 'r', e.r.toFixed(0), 'n', e.n, e.rassemble ? 'RASSEMBLE' : '')
      if (t > 525) break
    }
    await jeu.lache()
  },
  // le plan commence une demi-seconde avant l'événement (montage « B »)
  montage: { debut: 1.3 },
  publication: {
    legende: 'Rappelée.',
    mots: ['#jeuindé', '#indiegame', '#physique', '#satisfaisant', '#gamedev', '#simulation'],
  },
}
