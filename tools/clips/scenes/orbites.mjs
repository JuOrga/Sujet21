// LES ORBITES — un seul lancer, trois puits, trois anneaux, et le corps se
// colle dans le croissant. Le meilleur verdict s'obtient sans un geste
// (docs/puits.md §5) : c'est le « trick shot » du jeu, et il est vrai.
//
// POURQUOI CE CLIP. La promesse tient en une ligne (« un lancer, zéro
// correction ») et la chute est une preuve affichée par le jeu lui-même :
// son panneau de verdict.
export default {
  dureeSon: 60,
  masque: 'tout',
  async tourne(jeu, fichier) {
    await jeu.dans(() => window.__orbites())
    await jeu.pas(2)
    const salle = await jeu.dans(() => window.__clipSalle())
    // LE CADRE. La salle est plus large que haute, l'écran l'inverse : en
    // la montrant entière, le corps ferait 87 px de large sur 1 080. On
    // montre donc 1 700 u de large (le corps passe à 127 px), toute la
    // hauteur de la salle, et la caméra GLISSE à l'horizontale avec le corps
    // — une tangente hyperbolique pour qu'elle ralentisse en approchant du
    // mur au lieu de buter dessus.
    const vue = 1700
    const z = jeu.largeur / vue
    const marge = salle.l / 2 - vue / 2
    // (la salle descend de 6,5 % : le texte du montage tient au-dessus d'elle)
    const cadre = (e) => ({ x: salle.x + marge * Math.tanh(((e.x - salle.x) * 0.9) / marge), y: salle.y + (jeu.hauteur * 0.065) / z, z })
    let e = await jeu.etat()
    await jeu.image({ cam: cadre(e) }) // le cadre est posé avant la première image filmée
    await jeu.filme(fichier)
    let fin = -1
    for (let i = 0; i < 900; i++) {
      // le lancer part à la première image : du mouvement tout de suite,
      // et l'écriteau d'attente du jeu (« le lancer attend la fin du plan
      // large ») n'a pas le temps de s'afficher
      e = await jeu.image({ cam: { ...cadre(e), lance: i === 0 } })
      const verdict = await jeu.dans(() => [...document.querySelectorAll('button')].some((b) => /RETOUR AU PROTOCOLE/.test(b.innerText) && b.offsetParent))
      if (verdict && fin < 0) {
        fin = i
        jeu.dit('verdict à l’image', i)
        if (jeu.apercu) await jeu.capture(fichier.replace('.mkv', '-verdict.png'))
      }
      if (fin >= 0 && i - fin > 140) break
    }
  },
  publication: {
    legende: 'Un seul lancer, trois puits de gravité, zéro correction. Le verdict du jeu : 3 anneaux sur 3, 100 % du volume gardé. 🪐',
    mots: ['#jeuindé', '#indiegame', '#trickshot', '#gravité', '#physique', '#gamedev'],
  },
  montage: {
    textes: [
      { de: 0, a: 3.4, titre: 'Un seul **lancer**' },
      { de: 3.7, a: 8.6, titre: '3 puits de gravité\n**0** correction' },
    ],
  },
}
