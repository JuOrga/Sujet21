# Projet 21 — assets images à générer par IA

Prompts complets, prêts à copier-coller (en anglais : les générateurs y répondent mieux).
Une fois générées, déposez les images dans `public/assets/` (ou envoyez-les moi) —
j'assure l'intégration WebGL (raccords, étirement, animation de l'iris du sas…).

## Conseils selon le générateur

- **Midjourney** : ajoutez `--tile` aux textures répétées, `--ar 1:1` par défaut,
  `--ar 8:1` pour la bande de coque, `--ar 4:5` pour l'illustration d'accueil.
- **Stable Diffusion / Flux** : activez l'option *tiling/seamless* pour les textures ;
  collez la ligne « Négatif » dans le champ *negative prompt*.
- **DALL·E** : pas d'option tile — demandez « seamless » dans le prompt et vérifiez le
  raccord (je peux corriger les bords à l'intégration si besoin).
- La taille exacte importe peu à la génération : générez en carré haute résolution,
  je recadre/redimensionne. La transparence, elle, doit être demandée explicitement.

---

## 1. Fond « nuit orbitale » — PRIORITAIRE
**2048×2048 · JPG/WebP · tileable · pas de transparence**

```
Seamless tileable deep space background texture for a video game. Near-black night
sky (#030710) with sparse tiny dim stars, very faint cold nebula wisps in desaturated
blue-violet, extremely dark and subtle, evenly distributed, no planet, no moon, no
bright light source, uniform edges for perfect tiling, flat 2D texture, high resolution,
no text, no watermark
```
Négatif : `planet, sun, moon, bright stars, lens flare, vignette, borders, text, watermark`

## 2. Coque du vaisseau (bande de paroi) — PRIORITAIRE
**2048×256 · PNG · tileable horizontalement**

```
Long horizontal strip of spaceship hull wall, flat orthographic side view, dark
steel-blue metal panels (#0a1420) with visible seams, small rivets, thin pipes and
conduits running along the strip, one subtle glowing cyan trim line (#63b7e6) along
the lower edge, retro-futuristic 1970s orbital laboratory style, muted cold palette,
low brightness, evenly lit, seamless horizontal tiling with matching left and right
edges, flat 2D game texture, no perspective, no text
```
Négatif : `perspective, depth of field, bright lighting, warm colors, logo, text, watermark`

## 3. Coin de coque
**512×512 · PNG transparent**

```
Corner junction piece of a spaceship hull frame, 90 degree L-shape, flat orthographic
view, dark steel-blue metal panels with rivets and a reinforced corner plate, subtle
cyan glowing trim on the inner edge, retro-futuristic orbital laboratory style, muted
cold palette, isolated on transparent background, flat 2D game sprite, no perspective,
no text
```
Négatif : `background, floor, shadow on ground, perspective, text`

## 4. Bouche du sas (iris mécanique) — PRIORITAIRE
**1024×1024 · PNG transparent · parfaitement centré**

```
Circular sci-fi airlock iris seen perfectly from the front, centered in frame,
mechanical shutter blades arranged radially like a camera aperture, deep black center
hole, glowing emerald green ring (#3fd69b) around the opening, dark brushed steel
outer frame with bolts, retro-futuristic 1970s laboratory style, muted cold palette,
subtle rim light, symmetrical, orthographic, isolated on transparent background,
flat 2D game sprite, no text
```
Négatif : `perspective, tilt, off-center, motion blur, bright colors, text`

## 5. Texture mur neutre
**512×512 · PNG · tileable**

```
Seamless tileable texture of a dark brushed metal wall panel, steel blue-grey
(#10151c), fine directional brushing, subtle plate seams and small screws, matte
finish, low contrast, evenly lit, flat 2D game texture, perfect tiling, no text
```
Négatif : `rust, warm tones, strong highlights, perspective, text`

## 6. Texture paroi hydrophobe
**512×512 · PNG · tileable**

```
Seamless tileable texture of a dark waxy hydrophobic surface, deep muted purple
(#2a1c33) with soft highlights (#9e6bc7), small water droplets beading on top,
pearled bumpy micro-relief, soft waxy sheen, low brightness, flat 2D game texture,
perfect tiling, no text
```
Négatif : `wet film, puddles, bright purple, glitter, text`

## 7. Texture paroi hydrophile
**512×512 · PNG · tileable**

```
Seamless tileable texture of a wet glossy surface, dark teal (#0d2a30) with soft
cyan specular streaks (#63b7e6), thin uniform water film, gentle moisture ripples,
glistening but dark, flat 2D game texture, perfect tiling, no text
```
Négatif : `droplets beading, dry areas, warm reflections, text`

## 8a. Éponge sèche
**512×512 · PNG · tileable**

```
Seamless tileable texture of dry porous sponge foam, ochre brown (#4d4226), deep
irregular holes and cavities, matte dusty surface, low brightness, flat 2D game
texture, perfect tiling, no text
```
Négatif : `wet, shiny, kitchen sponge with flat sides, yellow, text`

## 8b. Éponge gorgée d'eau
**512×512 · PNG · tileable · même structure que 8a**

```
Seamless tileable texture of a water-saturated sponge, dark wet ochre brown,
glistening pores filled with water, subtle cold cyan reflections, darker and
glossier than dry foam, flat 2D game texture, perfect tiling, no text
```
Négatif : `dry areas, bright colors, bubbles floating above surface, text`

## 9. Illustration d'accueil (optionnel)
**1600×2000 portrait · JPG/WebP**

```
Retro scientific illustration in portrait orientation: a large wobbling sphere of
water floating in zero gravity inside an orbital laboratory test chamber, surrounded
by measurement instruments, calibration marks and thin annotation lines without any
letters, blueprint technical style mixed with soft airbrush shading, dark cold
palette: near-black background (#030710), steel blue panels, cyan water (#63b7e6)
with pale highlights (#a7ddf5), one small emerald green indicator light (#3fd69b),
1970s space program aesthetic, calm and precise mood, no text, no letters, no numbers
```
Négatif : `text, letters, numbers, labels, astronaut, faces, warm colors`

## 10. Écusson de mission (optionnel)
**1024×1024 · PNG transparent · sans texte (je pose « PROJET 21 » en typo par-dessus)**

```
Circular embroidered space mission patch, a stylized water droplet floating in zero
gravity at the center, orbital ring motif around it, dark navy and steel blue fabric,
cyan and pale blue thread details, one emerald green accent ring (#3fd69b), 1970s
NASA patch style, clean symmetrical composition, isolated on transparent background,
no text, no letters
```
Négatif : `text, letters, numbers, flag, rocket, bright red, white background`

---

## 11. Planches de cinématique — format imposé

**1600×900 · 16:9 PAYSAGE · WebP** (`--ar 16:9` chez Midjourney). Le jeu force le
mode paysage sur mobile : une planche portrait serait rognée de moitié. Le lecteur
étire la planche en `cover` et lui applique un lent mouvement (zoom, panoramique) —
prévoyez donc **un peu de marge sur les bords**, rien d'essentiel dans les 5 % du
cadre. Les images sont recompressées à l'intégration (qualité 84, ~160-250 Ko).

Aucun texte dans l'image : les répliques sont posées par le lecteur, réglables à la
table de montage. Une même planche sert souvent DEUX battements (autre cadrage,
autre réplique) : c'est du montage, pas du gaspillage.

L'OUVERTURE porte l'acte 0 d'une traite : ses onze battements passent par les
sept planches. LE DÉPART en reprend les quatre derniers — c'est la version
courte, celle qui se rejoue à chaque run.

Planches livrées, dans `public/assets/cine/` :

| Fichier | Plan | Cinématique |
| --- | --- | --- |
| `ouverture-1.webp` | la cuve, le sujet dans le liquide | L'OUVERTURE |
| `ouverture-2.webp` | les Créateurs derrière la vitre | L'OUVERTURE |
| `ouverture-3.webp` | l'alerte, le module en rouge | L'OUVERTURE |
| `ouverture-4.webp` | la brèche, le confinement qui cède | L'OUVERTURE |
| `depart-1.webp` | le module vide, la cuve crevée | L'OUVERTURE + LE DÉPART |
| `depart-2.webp` | le couloir vert vers le sas | L'OUVERTURE + LE DÉPART |
| `depart-3.webp` | le seuil du sas, l'aspiration cyan | L'OUVERTURE + LE DÉPART |

---

## 12. Luminaires (vus du dessus) — remplacent le dessin procédural

Déposez les fichiers dans `public/assets/` sous CES noms exacts : dès qu'ils
existent, le jeu les dessine à la place du luminaire procédural, à la position
de chaque lampe posée (taille et rotation automatiques). Tant qu'ils n'existent
pas, le dessin procédural reste en place — aucun risque.

### 12a. `lampe-plafonnier.webp`
**512×512 · WebP/PNG TRANSPARENT · parfaitement centré · vu du DESSUS**

On voit le DOS de la lampe (du métal), jamais sa vitre — la lumière du jeu,
elle, est ajoutée par le moteur autour de l'objet.

```
Top-down view of a circular industrial ceiling light fixture seen from directly
above, we see the METAL BACK of the housing: dark brushed steel dome, concentric
panel lines, a central bolt, four small mounting brackets extending outward at
the rim, thin darker seams, 1970s space station engineering style, muted cold
palette (steel blue-grey #10151c to #2a3542), perfectly centered, orthographic,
no perspective, no visible light glow, no lens, isolated on transparent
background, flat 2D game sprite, no text
```
Négatif : `glowing, light rays, lens flare, emissive, perspective, tilt, shadow on ground, background, text`

### 12b. `lampe-bande.webp`
**1024×256 · WebP/PNG TRANSPARENT · barre HORIZONTALE centrée · vu du DESSUS**

Le jeu l'étire à la longueur réglée et la pivote : dessinez-la horizontale.
Prévoir ~40 px de marge transparente à chaque extrémité (embouts compris).

```
Top-down view of a long horizontal industrial light strip housing seen from
directly above, we see the METAL BACK: a narrow brushed steel rail with panel
seams, small mounting tabs every fifth of its length, rounded end caps with
bolts, 1970s space station engineering style, muted cold palette (steel
blue-grey #10151c to #2a3542), perfectly centered horizontal bar, orthographic,
no perspective, no visible light glow, isolated on transparent background,
flat 2D game sprite, no text
```
Négatif : `glowing, light rays, emissive, perspective, tilt, vertical, shadow, background, text`

---

## Ce que je peux faire sans générateur d'images

Vecteurs SVG (logo, cadres, icônes, écusson au trait) et textures procédurales en
shader (le décor actuel : étoiles, nébulosité, caustiques, métal brossé…). Les
prompts ci-dessus visent Midjourney, DALL·E, Flux, Stable Diffusion, etc.
