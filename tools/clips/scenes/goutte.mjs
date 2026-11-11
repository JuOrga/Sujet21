// LA GOUTTE EN ORBITE — la salle de la ronde, mais on lui retire sa zone de
// glace et on demande l'eau en plein vol : le bloc fond au sommet de son
// lobe, et le puits du haut CAPTURE la goutte. Elle tourne autour du noyau
// en s'étirant comme une comète (« l'eau orbite, et reste un corps » —
// docs/puits.md §1).
//
// Plan fixe serré sur le puits du haut.
const PUITS = { x: 0, y: 800 } // ronde.ts : trois puits sur x = 0, écart 800

export default {
  dureeSon: 60,
  masque: 'tout',
  sansEcrit: true,
  async tourne(jeu, fichier) {
    await jeu.dans(() => window.__ronde())
    await jeu.pas(1)
    // sans la zone, plus rien n'impose la glace (ni son décor de hublot givré)
    await jeu.dans(() => window.__zones([]))
    await jeu.pas(1)
    // le puits un peu au-dessus du centre : le mur du haut de la salle
    // (à 450 u du puits) reste dans la bande que les onglets de TikTok couvrent
    const z = jeu.largeur / 760
    const cam = { x: PUITS.x, y: PUITS.y - 110, z }
    for (let i = 0; i < 760; i++) {
      if (i === 110) await jeu.filme(fichier)
      // le bloc est au sommet du lobe : on demande l'eau (le seul état que
      // les mémoires de départ permettent — le bouton est masqué, pas inerte)
      if (i === 200) await jeu.dans(() => document.getElementById('state-eau').click())
      const e = await jeu.image({ cam: { ...cam, lance: i === 0 } })
      if (i % 60 === 0) jeu.dit(i, 'pos', e.x.toFixed(0), e.y.toFixed(0), 'n', e.n, '/', e.tout, 'gel', e.gel.toFixed(2))
    }
  },
  // la ligne de marque descend sous le mur du haut, qui passe dans le cadre
  // le plan est coupé à 6 s (le concepteur, 11/11) : le bloc fond, la goutte
  // fait son premier tour en comète, et on part
  montage: { marqueY: 196, plan: 6 },
  publication: {
    legende: 'Elle ne retombera pas.',
    mots: ['#jeuindé', '#indiegame', '#physique', '#gravité', '#gamedev', '#simulation'],
  },
}
