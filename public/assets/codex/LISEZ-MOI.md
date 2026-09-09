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

**Le chemin le plus court : la filmer dans le jeu.** En mode concepteur, le
HUD porte un bouton ⏺ CAPTURER : quatre secondes de la scène, cadrées au
4:3 sur le centre, en WebM VP9 à 600 kbit/s (MP4 sur Safari, qui
n'enregistre pas de WebM). Le panneau qui suit montre la boucle, son poids,
et l'envoie à la fiche choisie — ou la télécharge sous le nom que ce
dossier attend (`<id>.webm`), pour la déposer ici. La vraie simulation
vaut mieux qu'une vidéo fabriquée ailleurs : c'est l'effet lui-même, pas
son imitation.

**Mieux : la mémoire de capture.** On n'a jamais le doigt sur le bouton au
moment où l'effet se produit. Dans PARAMÈTRES (mode concepteur, PC et
Steam Deck seulement), la MÉMOIRE DE CAPTURE à 30 ou 60 images par
seconde encode la scène en continu et ne garde que les huit dernières
secondes ; le bouton ⏺ du HUD affiche ce qu'il tient et, au clic, le fige
au lieu de filmer. Le fichier est assemblé dans le jeu (`src/game/webm.ts`),
sans bibliothèque. L'encodage tourne hors du fil du jeu ; ce qui reste sur
le fil du rendu, c'est la composition d'une petite image à chaque rappel,
à mesurer au compteur de PARAMÈTRES, mémoire armée puis éteinte. Si
l'encodeur ne suit pas, le bouton passe en pointillés et le panneau dit
combien d'images ont été sautées : baisser à 30.

**L'autre chemin, sans passer par le dépôt** : en mode concepteur, chaque
fiche du codex a un volet ATELIER sous son texte — la mémoire gravée à la
découverte, la rareté, et l'envoi d'une vidéo (webm ou mp4, 3 Mo au plus).
La vidéo envoyée est rangée dans le magasin partagé (`/api/codex`, Vercel
Blob) et **prime sur celle du dossier** ; « retirer la vidéo » rend la main
au dossier.
