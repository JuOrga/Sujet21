# `tools/clips/` — filmer le jeu pour les réseaux

Des clips verticaux (1080×1920, 60 i/s, son du jeu) tournés **par le jeu
lui-même**, sans écran ni carte graphique, et rejouables à l'identique.
Comme `ops/`, ce dossier vit hors de `tsconfig.json` et hors de Vitest :
rien ici n'entre dans le paquet, ne casse le build ni ne fait tomber un test.

```bash
pnpm build                              # le film se tourne sur dist/
node tools/clips/tourne.mjs ronde --apercu   # régler : ~1 min, une planche d'images
node tools/clips/tourne.mjs ronde            # tourner : 1080×1920, 5 à 10 min
node tools/clips/montage.mjs ronde           # monter : textes, son, encodage
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
| `montage.mjs` | incruste les textes, normalise le son (−15 LUFS), encode |
| `scenes/outils.mjs` | le pilote automatique et la caméra qui suit |
| `scenes/*.mjs` | une scène par clip : la salle, le cadre, les gestes, les textes, la légende |

## Écrire une scène

Une scène exporte `tableau` (la salle, `?tableau=N`), `masque` (`tout` ou
`jauge` : ce que le HUD garde), `tourne(jeu, fichier)` et `montage.textes`.

- `jeu.image({ cam })` avance d'une image, la filme, et rend l'état du monde
  (position, vitesse, particules, jauge). `cam` tient le cadre :
  `{ x, y, z }` en unités du monde et pixels CSS par unité.
- `jeu.vise(x, y)` / `jeu.lache()` : le seul geste du jeu, en coordonnées du
  MONDE — c'est ce qui rend l'aperçu fidèle au tournage.
- `jeu.dans(() => window.__orbites())` appelle les sondes que `main.ts`
  expose déjà (`__ronde`, `__orbites`, `__cibles`, `__palet`…).
- Un fichier `.json` `{ garde: [[début, fin], …] }` posé à côté du film
  demande une coupe franche au montage (voir `scenes/eponge.mjs`).

Les textes tiennent dans un bandeau en haut (140 à 345 px) : TikTok recouvre
le haut, le bas et la droite de l'image. Les scènes cadrent la salle dessous.

## Les quatre scènes livrées

| Scène | Ce qu'elle montre | Durée |
| --- | --- | --- |
| `ronde` | le bloc de glace en huit autour de trois puits — boucle parfaite (un tour = 807 images) | 13,45 s |
| `orbites` | un lancer, trois anneaux, le croissant, le verdict du jeu — sans un geste | 11,15 s |
| `retrecir` | « Le berceau » traversé par le pilote automatique, la jauge qui descend, la mise en bonbonne | 16,57 s |
| `eponge` | « La buveuse » : le corps s'écrase sur le péage et se fait boire, coupe franche jusqu'au panneau de fin | 8,10 s |

## Ce qui ne marche pas (encore)

- **Les états à la main.** Geler ou vaporiser d'une touche est refusé tant
  que les mémoires ne sont pas tissées (essayé le 10/11 dans « Le premier
  gel » : `F` ne gèle rien). Une scène de gel doit passer par le décor
  (plaques, zones) ou préparer une sauvegarde.
- **Les cibles.** Pas encore de scène, et rien d'essayé : le commentaire
  d'`arcMire` (`src/game/minijeux.ts`) dit que les éclats n'entrent sous
  les arcs que de biais ou par le sol qui renvoie — un pilote devra
  chercher ses angles.
- **Le contenu publié.** Le film tourne en `?horsligne` : il montre les
  salles LIVRÉES dans le code, pas celles de la bibliothèque partagée.
