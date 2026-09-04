# Les vidéos du codex

Une vidéo par fiche, **nommée par l'id de la fiche** (`src/game/codex.ts`) :

- `<id>.webm` — la vidéo, muette, en boucle, 3 à 6 secondes, 4:3 ou 16:9,
  ≤ 1 Mo (VP9, `ffmpeg -i source.mp4 -an -c:v libvpx-vp9 -b:v 600k -vf scale=640:-2 <id>.webm`) ;
- `<id>.webp` — l'image d'attente (facultative), la première image de la vidéo.

Exemples : `eau-hydrophile.webm`, `glace-rideau.webm`, `vapeur-grille.webm`.

L'écran du codex (`src/game/ecranCodex.ts`) la lit en tête du panneau de
droite quand la fiche est connue. **Absente, rien ne casse** : le glyphe de
la fiche s'affiche avec « aperçu à venir ». Une fiche verrouillée ne montre
jamais sa vidéo.

Ce dossier est servi tel quel par Vite (`public/`) ; aucun manifeste à
tenir : déposer le fichier suffit.
