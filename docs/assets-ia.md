# Projet 21 — assets images à générer par IA

Liste des images dont le jeu a besoin pour remplacer/enrichir le décor procédural.
Chaque entrée donne : taille, format, contraintes, et un prompt de départ (en anglais,
les générateurs y répondent mieux). Une fois générées, déposez-les dans `public/assets/`
(ou envoyez-les moi) — j'assure l'intégration WebGL.

## Direction artistique commune (à ajouter à chaque prompt)

- Ambiance : laboratoire orbital rétro-futuriste, instrumentation années 70 revisitée, calme, sombre.
- Palette : fond quasi noir `#030710`, bleu acier `#0a1420`, encre `#d9ecf7`,
  bleu spécimen `#63b7e6`, halo `#a7ddf5`, vert sas `#3fd69b`, violet hydrophobe `#9e6bc7`, ocre éponge `#4d4226`.
- Luminosité générale faible (le jeu est sombre) — pas de blanc pur, pas de couleurs saturées criardes.
- **Aucun texte ni logo dans les images.**
- Suffixe de prompt utile : `dark sci-fi laboratory style, muted cold palette, game texture, high detail, no text`

## Les assets

### 1. Fond « nuit orbitale » (prioritaire)
- **2048×2048**, JPG ou WebP (pas de transparence), **seamless / tileable** (répété à l'infini).
- Champ d'étoiles faible + nébulosité bleu-violet très discrète. Aucun objet saillant (il se répète).
- Prompt : `seamless tileable dark space starfield texture, tiny dim stars, faint cold blue-violet nebula wisps, near-black background #030710, no planet, no bright object, subtle, game skybox texture`

### 2. Coque du vaisseau — bande de paroi (prioritaire)
- **2048×256**, PNG, **tileable horizontalement** (elle court le long des 4 parois de la cuve).
- Métal bleu-acier sombre : panneaux, rivets, conduites fines, un liseré lumineux cyan discret côté intérieur.
- Prompt : `horizontal seamless spaceship hull wall strip, dark steel blue panels with rivets and thin pipes, subtle cyan glowing trim line, side view, flat orthographic game texture`

### 3. Coin de coque
- **512×512**, PNG **transparent**, raccord propre avec la bande n°2 (angle 90°).
- Prompt : `corner junction piece of dark spaceship hull, steel blue panels with rivets, 90 degree angle, orthographic, transparent background, game sprite`

### 4. Bouche du sas (prioritaire)
- **1024×1024**, PNG **transparent**, vue de face, parfaitement circulaire et centrée.
- Iris mécanique / bouche d'aspiration : anneau lumineux vert `#3fd69b`, lamelles métalliques, centre noir profond. Je l'anime (rotation, pulsation) par-dessus — pas besoin d'effet de mouvement dans l'image.
- Prompt : `circular sci-fi airlock iris seen from front, mechanical shutter blades, glowing green ring #3fd69b, deep black center hole, dark steel frame, perfectly centered, orthographic, transparent background, game sprite`

### 5. Texture mur neutre
- **512×512**, PNG, **tileable**.
- Métal brossé sombre, quelques vis/plaques, mat.
- Prompt : `seamless tileable dark brushed metal panel texture, subtle screws and plate seams, matte, steel blue-grey, game texture`

### 6. Texture paroi hydrophobe
- **512×512**, PNG, **tileable**.
- Surface cireuse violet sombre, gouttes qui perlent (l'eau ne l'accroche pas).
- Prompt : `seamless tileable dark waxy purple surface texture, beading water droplets, hydrophobic coating, subtle sheen, game texture`

### 7. Texture paroi hydrophile
- **512×512**, PNG, **tileable**.
- Surface mouillée luisante bleu-vert, film d'eau, reflets doux.
- Prompt : `seamless tileable wet glossy teal surface texture, thin water film, soft specular streaks, dark background, game texture`

### 8. Éponge (2 fichiers)
- **512×512** chacun, PNG, **tileable** : `eponge-seche` (mousse poreuse ocre) et `eponge-gorgee` (même structure, gorgée d'eau, plus sombre et luisante).
- Prompt (sèche) : `seamless tileable dry porous sponge foam texture, ochre brown, deep irregular holes, matte, game texture`
- Prompt (gorgée) : `seamless tileable water-saturated sponge texture, dark wet ochre, glistening pores, game texture`

### 9. Illustration d'accueil (optionnel)
- **1600×2000** (portrait), JPG/WebP.
- Illustration scientifique rétro d'une masse d'eau sphérique flottant en apesanteur dans une cuve d'essai, instruments autour — pour habiller la fiche d'essai.
- Prompt : `retro scientific illustration of a wobbling water sphere floating in zero gravity inside an orbital laboratory test chamber, measurement instruments, blueprint style, dark cold palette, cyan and steel blue`

### 10. Écusson de mission (optionnel)
- **1024×1024**, PNG **transparent**, badge circulaire de mission spatiale (sans texte — j'ajoute « PROJET 21 » en typo par-dessus).
- Prompt : `circular space mission patch badge, water droplet in zero gravity motif, embroidered style, dark navy and cyan, green accent ring, no text, transparent background`

## Ce que je peux faire sans générateur d'images

Je ne génère pas d'images bitmap « peintes », mais je peux produire moi-même :
vecteurs SVG (logo, cadres, icônes, écusson au trait), et textures procédurales
en shader (c'est le décor actuel : étoiles, nébulosité, caustiques, métal brossé…).
Les prompts ci-dessus servent pour Midjourney, DALL·E, Flux, Stable Diffusion, etc.
