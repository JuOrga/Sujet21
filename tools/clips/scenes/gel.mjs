// LE GEL — « Le premier gel » (21-04). Le corps fonce sur une plaque
// cryogénique : l'eau s'écrase, s'étale, et se fige EN PLEINE ÉCLABOUSSURE,
// soudée à la plaque. Rien n'est scripté : c'est le solveur qui gèle ce qui
// touche le froid, particule par particule.
//
// Plan fixe sur la plaque : le corps entre par la gauche, lancé. Ni texte ni
// interface — le moment se suffit.
import { pilote, adouci } from './outils.mjs'

const PLAQUE = { x: 610, y: 0 }

export default {
  tableau: 4,
  dureeSon: 60,
  masque: 'jauge',
  sansEcrit: true,
  async tourne(jeu, fichier) {
    await jeu.pas(170)
    let e = await jeu.etat()
    const geste = pilote()
    const large = jeu.largeur / 800
    const serre = jeu.largeur / 600
    let debut = -1
    let pris = -1
    for (let i = 0; i < 1400; i++) {
      // l'élan se prend hors champ ; on filme quand le corps arrive au bord du cadre
      if (debut < 0 && e.x > 60) {
        debut = i
        await jeu.filme(fichier)
      }
      if (pris < 0 && e.gel > 0.2) pris = i
      // le cadre se resserre lentement pendant que la glace prend
      const z = pris < 0 ? large : adouci(large, serre, (i - pris) / 240)
      // L'élan se prend CAMÉRA LIBRE (celle du jeu, qui suit le corps) : le
      // pointeur a besoin que le corps soit à l'écran. Une fois dans le plan
      // fixe, plus un geste — le corps arrive sur son erre.
      if (debut < 0) {
        const g = geste(e, PLAQUE, 260)
        if (g.pousse) await jeu.vise(g.vise.x, g.vise.y)
        else await jeu.lache()
      } else await jeu.lache()
      e = await jeu.image({ cam: debut < 0 ? { libre: true } : { x: PLAQUE.x - 95, y: PLAQUE.y - (0.02 * jeu.hauteur) / z, z } })
      if (i % 30 === 0) jeu.dit(i, debut < 0 ? 'hors champ' : ((i - debut) / 60).toFixed(1) + ' s', 'x', e.x.toFixed(0), 'v', Math.hypot(e.vx, e.vy).toFixed(0), 'gel', e.gel.toFixed(2))
      if (pris >= 0 && i - pris > 215) break
    }
  },
  // le plan commence une demi-seconde avant l'événement (montage « B »)
  montage: { debut: 1.0 },
  publication: {
    legende: 'Trop vite. Trop froid.',
    mots: ['#jeuindé', '#indiegame', '#physique', '#satisfaisant', '#gamedev', '#simulation'],
  },
}
