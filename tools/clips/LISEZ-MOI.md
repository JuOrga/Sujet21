# `tools/clips/` — filmer le jeu pour les réseaux

Des clips verticaux (1080×1920, 60 i/s, son du jeu) tournés **par le jeu
lui-même**, sans écran ni carte graphique, et rejouables à l'identique.
Comme `ops/`, ce dossier vit hors de `tsconfig.json` et hors de Vitest :
rien ici n'entre dans le paquet, ne casse le build ni ne fait tomber un test.

```bash
pnpm build                              # le film se tourne sur dist/
node tools/clips/tourne.mjs ronde --apercu   # régler : ~1 min, une planche d'images
node tools/clips/tourne.mjs ronde            # tourner : 1080×1920, 5 à 10 min
node tools/clips/montage.mjs ronde           # monter : marque, son, encodage
```

Tout sort dans `clips-sortie/` (ignoré par git ; `CLIPS_SORTIE` le déplace) :
`brut/` le film sans texte et la piste son, `final/` les fichiers à publier.

Il faut `ffmpeg`, `Xvfb`, Mesa (llvmpipe) et le module `playwright` avec son
Chromium — présents dans l'environnement d'analyse ; aucune dépendance n'est
ajoutée au `package.json`.

## Pourquoi ce n'est pas un enregistrement d'écran

Sans carte graphique, une image du jeu en 1080×1920 coûte ~0,3 s de calcul
(mesuré le 10/11/2026 : Mesa llvmpipe, 4 cœurs ; SwiftShader, le rendu logiciel
par défaut de Chromium, en demandait 3,3 s pour une image quatre fois plus
petite). Un enregistrement en temps réel donnerait trois images par seconde.

`horloge.js` retourne le problème : injecté avant le jeu, il remplace
l'horloge de la page par la nôtre. Chaque `__pas(16,67)` fait croire au jeu
qu'un soixantième de seconde est passé ; on photographie, on recommence. La
vidéo est à 60 i/s exactes quel que soit le temps de calcul. Quatre horloges
passent sous contrôle : la boucle d'images, les minuteries, les animations
CSS et **le son** — le jeu reçoit un `OfflineAudioContext` déguisé qui avance
d'une image à la fois, si bien que la piste livrée est le vrai mixage du jeu,
calé sur l'image à 3 ms près. Le hasard est semé : même scène, même partie.

Le jeu s'y prête parce que son pas physique est fixe : ce qu'on filme est la
simulation du joueur, pas une imitation.

## Les fichiers

| Fichier | Rôle |
| --- | --- |
| `horloge.js` | l'horloge pilotée, le hasard semé, le son hors ligne |
| `pilote.mjs` | le navigateur (fenêtre sous Xvfb, ANGLE sur l'OpenGL de Mesa), l'entrée en salle, les gestes, le tuyau vers ffmpeg |
| `tourne.mjs` | tourne une scène, en aperçu ou en grand |
| `montage.mjs` | pose la ligne de marque (et des textes, si la scène en a), normalise le son (−15 LUFS), encode |
| `scenes/outils.mjs` | le pilote automatique et la caméra qui suit |
| `scenes/*.mjs` | une scène par clip : la salle, le cadre, les gestes, la légende |

## Écrire une scène

Une scène exporte `tableau` (la salle, `?tableau=N`), `tourne(jeu, fichier)`,
et au besoin `sansEcrit`, `montage` et `publication`.

- `jeu.image({ cam })` avance d'une image, la filme, et rend l'état du monde
  (position, vitesse, particules, part gelée, part en vapeur). `cam` tient
  le cadre : `{ x, y, z }` en unités du monde et pixels CSS par unité ;
  `{ libre: true }` rend la caméra au jeu.
- `jeu.vise(x, y)` / `jeu.lache()` : le seul geste du jeu, en coordonnées du
  MONDE. Il passe par un vrai pointeur, donc par l'écran : **un corps hors
  champ ne se pilote pas** (le point visé est ramené au bord du cadre et la
  poussée s'inverse — vécu le 11/11, le corps du gel repartait en arrière).
  Une scène à plan fixe prend son élan caméra libre, puis filme.
- `jeu.toucheCorps()` pose le pointeur SUR le corps et le tient : il se
  rassemble (`rassemble`, `src/sim/solver.ts`). Un anneau discret marque le
  toucher à l'image — le seul élément du film qui ne vient pas du jeu ;
  `doigt: false` dans la scène le retire.
- `jeu.dans(() => window.__ronde())` appelle les sondes que `main.ts`
  expose déjà (`__ronde`, `__orbites`, `__cibles`, `__palet`, `__zones`…).
- `sansEcrit: true` rend muets les écriteaux que le jeu dessine dans son
  calque 2D ; l'interface HTML (boutons, panneaux de verdict et de fin de
  run) est masquée d'office : un clip montre un moment de physique, pas son
  score. `masque: 'jauge'` garde la jauge de volume, recentrée sous la ligne
  de marque ; `tourne.mjs <scène> --jauge` l'ajoute à une scène qui ne l'a
  pas (fichier `<scène>-jauge`, monté par `montage.mjs <scène> jauge`).
- `montage.textes` (facultatif) incruste des textes aux polices du jeu, dans
  un bandeau en haut ; sans textes, seule reste la ligne de marque
  (`montage.marqueY` la déplace). Un fichier `.json`
  `{ garde: [[début, fin], …] }` posé à côté du film demande une coupe franche.

## Les huit scènes livrées

Le concepteur (10/11) : « je ne souhaite pas expliquer le jeu, mais que tu
clipes des moments du jeu avec la physique très intéressante. Sans l'écran
des scores. » Puis (11/11) : « un peu de HUD peut être intéressant tout de
même », et le regroupement — toucher le corps étiré, « ça lui fait faire
complètement autre chose ». Aucune scène n'a de texte ni de verdict ; les
deux dernières gardent la jauge.

| Scène | Le moment | Durée |
| --- | --- | --- |
| `ronde` | le bloc de glace en huit autour de trois puits — boucle parfaite (un tour = 807 images) | 13,45 s |
| `goutte` | la ronde sans sa zone de glace : le bloc fond en vol, le puits du haut capture la goutte, qui s'étire en comète | 10,83 s |
| `repulsion` | « Le rebond » : l'eau ne touche jamais la paroi hydrophobe et s'aplatit en arc devant elle | 6,70 s |
| `gel` | « Le premier gel » : l'eau s'écrase sur la plaque froide et se fige en pleine éclaboussure | 7,03 s |
| `vapeur` | « Le premier souffle » : le corps bout sur la chaudière et part en nuage doré | 8,70 s |
| `eponge` | « La buveuse » : le corps s'étale sur le mur d'éponge, qui le boit | 6,17 s |
| `ecrasement` | « Le berceau » : le corps enlace l'îlot neutre en anneau ; touché, l'anneau se contracte en boule et repart en arrière | 6,42 s |
| `ressaisie` | « Le rebond » : l'arc étiré devant la paroi hydrophobe, rappelé d'un toucher — les deux bouts reviennent d'un coup | 8,78 s |

## Ce qui ne marche pas (encore)

- **Geler ou vaporiser d'une touche.** Refusé tant que les mémoires ne sont
  pas tissées (essayé le 10/11 dans « Le premier gel » : `F` ne gèle rien).
  Le gel et la vapeur des scènes passent par le décor (plaque froide,
  chaudière) ; seul le retour à l'eau se demande (`#state-eau`, voir
  `goutte.mjs`).
- **Les cibles.** Pas encore de scène, et rien d'essayé : le commentaire
  d'`arcMire` (`src/game/minijeux.ts`) dit que les éclats n'entrent sous
  les arcs que de biais ou par le sol qui renvoie — un pilote devra
  chercher ses angles.
- **Le contenu publié.** Le film tourne en `?horsligne` : il montre les
  salles LIVRÉES dans le code, pas celles de la bibliothèque partagée.
