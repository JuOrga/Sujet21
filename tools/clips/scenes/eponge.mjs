// L'ÉPONGE — « La buveuse » (21-06). Le mur d'éponge boit ce qui le touche.
// Le frôler coûte quelques gouttes ; s'y écraser vide le corps
// (docs/doc-fonctionnel.md §6). Ici on s'y écrase : 3,25 L au contact, 0,37 L
// 1,8 s plus tard (mesuré sur le tournage du 10/11/2026), puis le jeu
// prononce la fin de la run.
//
// POURQUOI CE CLIP. Un échec net, rapide, lisible sans connaître le jeu :
// la jauge passe du bleu au rouge sous les yeux du spectateur. Les échecs
// se partagent mieux que les réussites, et celui-ci montre l'enjeu du jeu
// (le volume EST la vie) mieux qu'une explication.
import fs from 'node:fs'
import { pilote, suiveur, adouci } from './outils.mjs'

const AVANT = 190 // l'élan se prend hors champ : le film s'ouvre corps lancé

export default {
  tableau: 6,
  dureeSon: 90,
  masque: 'jauge',
  css: `#hud .ath-vital{left:50%!important;top:186px!important;transform:translateX(-50%) scale(1.7);transform-origin:top center;opacity:1!important}
#hud .ath-vital .bonbonne,#continuer,#relance{display:none!important}`,
  async tourne(jeu, fichier) {
    await jeu.pas(170)
    let e = await jeu.etat()
    // le pilote vise l'AUTRE côté du mur, comme un joueur qui n'a pas vu
    // l'éponge : il s'y écrase à pleine allure et continue de pousser
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
    let panneau = -1
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
      if (i % 30 === 0) jeu.dit(i - AVANT, 'pos', e.x.toFixed(0), e.y.toFixed(0), 'v', Math.hypot(e.vx, e.vy).toFixed(0), 'n', e.n, e.litres, e.disperse ? 'DISPERSÉ' : '')
      if (panneau < 0 && (await jeu.dans(() => [...document.querySelectorAll('button')].some((b) => /RETOUR AU LABO/.test(b.innerText) && b.offsetParent)))) {
        panneau = i
        jeu.dit('fin de la run à', ((i - AVANT) / 60).toFixed(2), 's ; bu à', ((bu - AVANT) / 60).toFixed(2), 's')
      }
      if (panneau >= 0 && i - panneau > 130) break
    }
    await jeu.lache()
    // la coupe : le corps bu et sa jauge au rouge, puis le panneau du jeu —
    // sans les huit secondes où les dernières gouttes glissent le long du mur
    const t = (i) => (i - AVANT) / 60
    fs.writeFileSync(fichier.replace('.mkv', '.json'), JSON.stringify({ garde: [[0, t(bu) + 2.5], [t(panneau) - 0.4, t(panneau) + 2.1]] }))
  },
  publication: {
    legende: 'Règle n°1 : ne jamais foncer dans l’éponge. Je l’ai apprise comme ça. 🧽💀',
    mots: ['#jeuindé', '#indiegame', '#fail', '#roguelike', '#gamedev', '#jeuvidéo'],
  },
  montage: {
    textes: [
      { de: 0, a: 2.7, titre: 'Règle n°1 : ne fonce\npas dans **l’éponge**' },
      { de: 3.5, a: 5.9, titre: 'Elle te **boit**\nen 2 secondes' },
    ],
  },
}
