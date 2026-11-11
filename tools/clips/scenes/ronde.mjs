// LA RONDE — un bloc de glace, trois puits de gravité, un huit à trois lobes
// qui se referme sur lui-même. Rien ne se pilote (docs/puits.md §7).
//
// Ni texte ni interface : le concepteur (10/11) l'a préférée nue —
// « mystérieux et très intriguant ».
//
// POURQUOI CE CLIP. C'est une BOUCLE PARFAITE : le tour dure 13,45 s, soit
// 807 images à 60 i/s, et le bloc repasse au même point à chaque tour. Une
// vidéo qui se rejoue sans couture garde le spectateur plusieurs tours — le
// temps de visionnage monte tout seul.
const TOUR = 807 // 13,45 s × 60 i/s (mesuré par src/sim/ronde.spec.ts)

export default {
  dureeSon: 60,
  masque: 'tout',
  async tourne(jeu, fichier) {
    await jeu.dans(() => window.__ronde())
    await jeu.pas(2)
    const salle = await jeu.dans(() => window.__clipSalle())
    jeu.dit('salle', JSON.stringify(salle))
    // PLAN FIXE : la salle est plus haute que large, comme l'écran. Elle
    // tient sur 66 % de la largeur : avec l'épaisseur de ses murs (40 px,
    // hors des bornes que la caméra connaît), elle se loge entre la ligne de
    // marque du montage, en haut, et la légende de TikTok (1 560 px).
    const z = (jeu.largeur * 0.66) / salle.l
    const cam = { x: salle.x, y: salle.y, z, lance: true }
    // le plan fixe coupe le plan d'ouverture : le bloc est lancé aussitôt.
    // Un tiers de tour avant de filmer : la boucle commence sur le bloc qui
    // plonge vers le puits du centre, en plein mouvement.
    for (let i = 0; i < (jeu.apercu ? 60 : 270); i++) await jeu.image({ cam })
    await jeu.filme(fichier)
    for (let i = 0; i < (jeu.apercu ? 400 : TOUR); i++) await jeu.image({ cam })
  },
  publication: {
    legende: 'Personne ne touche à rien.',
    mots: ['#jeuindé', '#indiegame', '#physique', '#satisfaisant', '#gamedev', '#simulation'],
  },
}
