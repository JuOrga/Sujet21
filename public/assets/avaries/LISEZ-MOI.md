# Les illustrations du tableau des avaries

Une image par station, **nommée par l'id de la station** (`src/game/reparations.ts`) :

- `<id>.webp` — l'illustration de la station, 16:9, 640 × 360 environ,
  ≤ 120 Ko (`cwebp -q 82 source.png -o <id>.webp`).

Les sept ids : `eclairage`, `table-depart`, `mur-records`, `bac-sable`,
`distillateur`, `aile-endormis`, `passerelle-4`.

L'écran du tableau des avaries (`src/game/ecranAvaries.ts`) la lit en tête
du panneau de droite. **C'est la même image dans les deux états** : tant
que la station est en panne, l'écran l'éteint lui-même (grise, sombre, le
tampon EN PANNE) ; rétablie, elle s'allume. Une seule image à peindre par
station, celle de la station **en état de marche**.

**Absente, rien ne casse** : le glyphe de la station s'affiche à sa place.

Ce dossier est servi tel quel par Vite (`public/`) ; aucun manifeste à
tenir : déposer le fichier suffit.
