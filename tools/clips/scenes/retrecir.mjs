// SE DÉPLACER, C'EST RÉTRÉCIR — la règle du jeu, montrée dans sa première
// salle (« Le berceau », 21-01) : le corps éjecte, part, la jauge descend.
//
// POURQUOI CE CLIP. C'est l'accroche qui explique le jeu à quelqu'un qui ne
// l'a jamais vu, en trois phrases et sans tutoriel. La jauge du jeu reste à
// l'écran (remontée sous le texte, agrandie) : c'est elle la preuve.
import { pilote, suiveur, adouci } from './outils.mjs'

export default {
  tableau: 1,
  dureeSon: 90,
  masque: 'jauge',
  // la jauge du HUD vit dans le coin haut-gauche, sous les onglets de
  // TikTok : on la recentre sous le bandeau de texte, à 1,7×
  css: `#hud .ath-vital{left:50%!important;top:186px!important;transform:translateX(-50%) scale(1.7);transform-origin:top center;opacity:1!important}
#hud .ath-vital .bonbonne,#continuer{display:none!important}`,
  async tourne(jeu, fichier) {
    // le plan d'ouverture du jeu passe hors champ
    await jeu.pas(170)
    let e = await jeu.etat()
    const balises = [
      { x: -120, y: 400, allure: 265 }, // au-dessus de l'îlot rond
      { x: 560, y: 300, allure: 265 },
      { x: 1110, y: 0, allure: 265 }, // le sas
    ]
    let b = 0
    const geste = pilote()
    const suit = suiveur(e)
    const z0 = jeu.largeur / 640 // gros plan : le corps tient un tiers de l'écran
    const z1 = jeu.largeur / 1350
    let fin = -1
    await jeu.filme(fichier)
    for (let i = 0; i < 1100; i++) {
      if (fin >= 0 && i - fin > 330) break // la cérémonie a fini de compter
      const z = adouci(z0, z1, (i - 70) / 200)
      const c = suit(e, { x: 0, y: (-0.03 * jeu.hauteur) / z })
      if (fin < 0 && e.n < 300 && e.x > 900) fin = i // le sas a pris le corps
      if (i >= 40 && !e.disperse) {
        const g = geste(e, balises[b], balises[b].allure)
        if (g.d < 190 && b < balises.length - 1) b++
        if (g.pousse) await jeu.vise(g.vise.x, g.vise.y)
        else await jeu.lache()
      }
      e = await jeu.image({ cam: { ...c, z } })
      if (i % 30 === 0) jeu.dit(i, 'pos', e.x.toFixed(0), e.y.toFixed(0), 'v', Math.hypot(e.vx, e.vy).toFixed(0), 'n', e.n, e.litres, 'balise', b)
      if (jeu.apercu && i % 150 === 149) await jeu.capture(fichier.replace('.mkv', `-${i + 1}.png`))
    }
    await jeu.lache()
  },
  publication: {
    legende: 'Dans ce jeu tu es 4,5 litres d’eau en apesanteur. Pour avancer, tu éjectes une part de toi : se déplacer, c’est rétrécir. Tu serais sorti avec combien ? 💧',
    mots: ['#jeuindé', '#indiegame', '#roguelike', '#gamedev', '#jeuvidéo', '#physique'],
  },
  montage: {
    textes: [
      { de: 0, a: 2.6, titre: 'Tu es **4,5 litres** d’eau' },
      { de: 2.9, a: 6.6, titre: 'Avancer = éjecter\nune part de **toi**' },
      { de: 6.9, a: 10.8, titre: 'Chaque geste\nte fait **rétrécir**' },
    ],
  },
}
