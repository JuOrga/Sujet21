# Projet 21 — assets images à générer par IA

Prompts complets, prêts à copier-coller (en anglais : les générateurs y répondent mieux).

**Avant tout prompt, lire [`charte-visuelle.md`](charte-visuelle.md)** : le monde, la
lumière, la palette et le préambule commun s'y tiennent une fois pour toutes — chaque
prompt ci-dessous **commence par ce préambule**, puis ne dit que ce qui est propre à la
pièce. La référence de style de la famille (§6 de la charte) se passe au générateur avec.

Une fois générées, déposez les sources dans `masters/images/` (même nom, même chemin
que dans `public/assets/`) et lancez `python3 tools/images/prepare.py` : il livre
`public/assets/` à la bonne taille et **mesure** l'image (raccord, luminance, palette,
bord, poids). Une image hors mesure n'est pas livrée. J'assure l'intégration WebGL
(raccords, étirement, animation de l'iris du sas…).

**Par où commencer** : [`assets-chantier.md`](assets-chantier.md) tient l'état des
lieux mesuré et la commande dans l'ordre — quoi refaire, quoi générer, quoi filmer.

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

## 3. Coin de coque — SANS EMPLOI, ne pas générer
**512×512 · PNG transparent**

Aucune ligne du moteur ne charge une pièce de coin (10/09/2026) : la coque se
dessine en bande (§2) et le raccord entre deux modules revient au sas de
raccord (§16). Le prompt reste pour mémoire.

```
Corner junction piece of a spaceship hull frame, 90 degree L-shape, flat orthographic
view, dark steel-blue metal panels with rivets and a reinforced corner plate, subtle
cyan glowing trim on the inner edge, retro-futuristic orbital laboratory style, muted
cold palette, isolated on transparent background, flat 2D game sprite, no perspective,
no text
```
Négatif : `background, floor, shadow on ground, perspective, text`

## 4. Bouche du sas (iris mécanique) ✗ À REFAIRE
**1024×1024 · PNG transparent · parfaitement centré**

L'iris livré est **opaque sur un fond brun** (33 % de pixels chauds, la
famille ne le tolère qu'à moitié) et son anneau est **vert** — la charte
réserve le vert à la serre et fait de l'iris l'accent **cyan** (§3 de la
charte) ; ses veilleuses, elles, sont **ambre**, comme celles du sas de
raccord (§16), dont il doit se lire comme le frère. À refaire **après** le
sas de raccord, avec celui-ci en référence de style.

```
[PRÉAMBULE — charte §5]
Circular mechanical airlock iris seen perfectly from the front, centered in
frame, shutter blades arranged radially like a camera aperture, deep black
centre hole, one thin glowing cyan ring (#63b7e6) around the opening, dark
riveted steel outer frame with bolts and weld seams, four small square amber
indicator lamps (#e8951f) evenly spaced on the frame, worn paint, symmetrical,
orthographic, isolated on transparent background, flat 2D game sprite
```
Négatif : négatif commun + `green, emerald, brown background, perspective,
tilt, off-center, motion blur`

## 5. Texture mur neutre — `wall.webp` ✗ À REFAIRE
**1024×1024 · PNG · tileable sur les deux axes**

Le mur par défaut montre sa couture : raccord vertical **4,7** (seuil 3,0),
mesuré le 10/09. La seconde paroi (`wall-a.webp`, 1,0 / 1,7) tient, elle :
c'est **la référence de style** de cette famille, à passer au générateur.

```
[PRÉAMBULE — charte §5]
Seamless tileable texture of a dark brushed steel wall panel seen flat, steel
blue-grey (#10151c), fine directional brushing, subtle plate seams and small
screws, matte finish, low contrast, the seams and brushing continuing exactly
across all four edges so the texture repeats on both axes with no visible
join, in the exact style of the attached reference (wall-a.webp)
```
Négatif : négatif commun + `rust, strong highlights, panel border, frame`

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

## 10. Écusson de mission — livré OPAQUE, à détourer
**1024×1024 · PNG transparent · sans texte (je pose « PROJET 21 » en typo par-dessus)**

L'écusson livré (`badge.webp`, l'accueil) est **opaque sur un fond brun**
(21 % de pixels chauds) alors que le prompt le voulait détouré. Priorité
basse : une version transparente, ou le même master rendu sur fond noir,
et je détoure.

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
| `approche-1.webp` | la planète à anneau, seule | L'OUVERTURE (en tête, §26) |
| `approche-2.webp` | le limbe, un point brillant | L'OUVERTURE |
| `approche-3.webp` | la station entière | L'OUVERTURE — la référence de la station |
| `approche-4.webp` | l'arc et le hub au premier plan | L'OUVERTURE |
| `approche-5.webp` | le module Méduse, son hublot | L'OUVERTURE |
| `approche-6.webp` | le hublot, la cuve derrière la vitre | L'OUVERTURE |

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

## 13. Le plafond du reflet — `plafond.webp`

**1024×1024 (ou 2048²) · WebP · sombre · vu du DESSOUS**

Le plafond de la station n'est jamais visible vu du dessus — il n'existe
QUE dans le reflet de la surface miroitante du fluide. Un plafond de
substitution (généré, sommaire) est en place : déposez votre image sous
`public/assets/plafond.webp` et elle le remplace, sans autre geste.

**Un plafond PAR SALLE** : déposez des variantes sous `plafond-<nom>.webp`
(ex. `plafond-planete.webp`), puis dans l'éditeur, champ « Plafond du
reflet » du tableau : tapez le nom (`planete`). Vide = le plafond par
défaut ; variante absente = repli sur le défaut, sans trou.

Variantes livrées (suggérées par le champ) : `planete` (hublot sur une
planète gazeuse), `givre` (cryo, néons et stalactites), `observatoire`
(dôme vitré plein ciel), `breche` (coque déchirée sur les étoiles, néon
d'alerte rouge), `chaufferie` (grilles ambrées `#f2c98e`, lecture VAPEUR),
`helice` (ventilateur géant à contre-jour).

Ce qui fait l'effet : des VERRIÈRES et hublots ÉCLAIRÉS (blanc froid) sur
une machinerie sombre — ce sont eux qui brillent dans le corps, comme des
néons sur une flaque. La répétition se fait en miroir à l'affichage :
pas besoin d'un raccord parfait.

```
Looking straight UP at the ceiling of a retro-futuristic 1970s orbital
laboratory, orthographic view from below: dark steel structure with
crossing support beams, thick pipes with flanges, cable trays, catwalk
grating — and several GLOWING SKYLIGHTS and round portholes (cold white
light #d6e8f5, glass with thin mullions) cut into the dark structure,
muted cold palette (steel blue-grey #10151c to #2a3542), the lit windows
clearly brighter than everything else, flat 2D game texture, no
perspective distortion, no text
```
Négatif : `floor, furniture, people, warm colors, lens flare, perspective, text, watermark`

---

## 14. LA SERRE — cultures hydroponiques

Pour le niveau SERRE. Quatre pièces qui se composent : la gouttière nue et sa
barre horticole servent de support, les trois cultures se posent dessus.

**Règles communes à ces quatre prompts** (elles sont déjà dans le texte, ne les
retirez pas) : vue de FACE strictement orthographique (le jeu n'a pas de
perspective), pièce DÉTOURÉE sur fond transparent, aucune ombre portée au sol
(le moteur pose les siennes), lumière froide venue du haut, palette de la
station — et des verts FROIDS et lumineux, seuls capables de ressortir sur le
noir de la cuve (`#030710`). Pas de terre : l'hydroponie se lit aux cubes de
laine de roche, aux billes d'argile et à l'eau dans la gouttière.

Déposez les fichiers dans `public/assets/` sous ces noms exacts — ils
apparaîtront aussitôt dans la bibliothèque d'images, rubrique « Serre &
cultures » : `serre-roquette.webp`, `serre-ble-nain.webp`,
`serre-tomates.webp`, `serre-rampe.webp`.

### 14a. Bac de roquette (jeunes pousses) — `serre-roquette.webp`
**1254×627 · PNG transparent · pièce large et basse**

```
Hydroponic tray of young rocket arugula seedlings, flat orthographic FRONT
elevation view, dense low rosettes of small lobed leaves rising from a row of
pale rockwool cubes set in a shallow steel-blue NFT gutter (#0a1420) with rivets,
a thin glowing cyan trim line (#63b7e6) and a narrow slit showing faint glowing
cyan nutrient water, cool desaturated greens from deep #1f4a35 to bright #7fe3a8,
crisp readable leaf silhouettes, soft cold light from above, subtle cyan rim
light on the leaf edges, retro-futuristic 1970s orbital laboratory greenhouse,
muted cold palette, dark scene, isolated on transparent background, flat 2D game
sprite, no perspective, no ground shadow, no text
```
Négatif : `soil, dirt, terracotta pot, garden bed, sunlight, warm yellow light, perspective, depth of field, ground shadow, background, sky, hands, people, text, watermark`

### 14b. Blé nain — `serre-ble-nain.webp` ✅ LIVRÉ (27/08)
**1024×1024 · PNG transparent · touffe dressée**

```
Tuft of dwarf wheat growing hydroponically, flat orthographic FRONT elevation
view, short stiff upright stalks with slender blades and small bearded ears at
the top, roots hidden in a bed of pale clay pebbles inside a shallow steel-blue
tray (#0a1420) with rivets and a thin glowing cyan trim (#63b7e6), stalks in cool
desaturated green (#2b6b4a) with pale silvery-green ears (#cfe8d2), fine dry
detail on the awns, soft cold light from above, subtle cyan rim light, retro-
futuristic 1970s orbital laboratory greenhouse, muted cold palette, dark scene,
isolated on transparent background, flat 2D game sprite, no perspective, no
ground shadow, no text
```
Négatif : `field, farm, soil, sunset, golden warm light, wind blur, perspective, ground shadow, background, sky, people, text, watermark`

### 14c. Colonne de tomates — `serre-tomates.webp`
**1024×1536 · PNG transparent · pièce haute**

```
Hydroponic tomato plant trained on a vertical string, flat orthographic FRONT
elevation view, tall central stem with compound serrated leaves and two trusses
of ripe round tomatoes, roots in a white rockwool slab inside a steel-blue basin
(#0a1420) with rivets, a thin glowing cyan trim (#63b7e6) and a drip line, dark
cool green foliage (#1f4a35 to #6ed3a0), the tomatoes deep muted red-orange
(#c8524a) reading as the only warm accent, soft cold light from above, subtle
cyan rim light on leaf edges, retro-futuristic 1970s orbital laboratory
greenhouse, muted cold palette, dark scene, isolated on transparent background,
flat 2D game sprite, no perspective, no ground shadow, no text
```
Négatif : `garden, soil, wooden stake, sunlight, warm ambient light, bokeh, perspective, ground shadow, background, sky, hands, text, watermark`

### 14d. Gouttière nue + barre horticole — `serre-rampe.webp` ✅ LIVRÉ (27/08, deux versions : `serre-rampe.webp` et `serre-rampe-a.webp`)
**1024×256 · PNG transparent · se répète horizontalement**

```
Empty hydroponic NFT gutter with a horticultural LED bar above it, flat
orthographic FRONT elevation view, long shallow steel-blue channel (#0a1420)
with rivets, end caps and a thin glowing cyan trim (#63b7e6), faint glowing cyan
nutrient water inside, a slim LED grow bar mounted above on two brackets casting
a discreet low-saturation rose glow (#b06a8f) downward into the channel, empty
rockwool cube slots, retro-futuristic 1970s orbital laboratory greenhouse, muted
cold palette, dark scene, matching left and right edges so several can be placed
end to end, isolated on transparent background, flat 2D game sprite, no
perspective, no ground shadow, no text
```
Négatif : `plants, leaves, vegetables, bright magenta, purple haze, lens flare, perspective, ground shadow, background, text, watermark`

**Si la lueur rose vous gêne** (elle sort de la charte froide du jeu) : remplacez
`a discreet low-saturation rose glow (#b06a8f)` par `a cold white glow (#d6e8f5)`
dans le prompt 14d — la serre reste alors strictement dans la palette station.

**Où en est la serre** (27/08) : le BLÉ NAIN et les DEUX GOUTTIÈRES sont
intégrés — nettoyés (halo de détourage, taches, voile gris), recompressés aux
réglages maison (WebP, côté ≤ 1600, qualité .85) et POSABLES : l'éditeur a
désormais un groupe d'outils « Décor (sans physique) » avec Blé nain,
Gouttière, Gouttière (2) et Machinerie. On trace un rectangle, la pièce s'y
loge ; la sorte se rechange ensuite dans le panneau.

Restent à générer : la ROQUETTE (14a) et les TOMATES (14c). Mêmes règles, même
traitement à l'arrivée — envoyez les images, je les intègre. **Toujours
manquantes au 10/09/2026** (`docs/assets-chantier.md`).

**Un mot sur le détourage** : les fonds transparents arrivent souvent avec un
liséré vert (fond incrusté) et des poussières de pixels. Je les nettoie à
l'intégration, mais si votre générateur propose « transparent background » ET
un rendu sur fond NOIR, prenez le noir : le détourage y est plus franc.

---

---

## 15. LE MÉTA — commerce, banc, marchand, éclats

Pour tout ce que le méta pose dans les salles : les alcôves d'achat, le pupitre
du banc des mémoires, le Sujet 12 derrière ses barreaux, l'éclat de mémoire, et
la planche d'icônes qui remplacera les emoji.

**Règles communes** (elles sont dans les textes, ne les retirez pas) : vue de
FACE strictement orthographique (le jeu n'a pas de perspective), pièce DÉTOURÉE
sur fond transparent, aucune ombre portée au sol (le moteur pose les siennes),
lumière froide venue du haut, palette de la station.

**À savoir sur l'intégration** — le moteur *refroidit* et *atténue* les
décalques (ils se fondent dans la cuve, et l'eau passe devant) : générez les
pièces un peu plus contrastées et un peu plus claires que le rendu voulu, elles
seront calmées à l'affichage. Les pièces marquées « 2D » ne subissent pas ce
traitement : elles se dessinent PAR-DESSUS le fluide, telles quelles.

**Les décalques s'ÉTIRENT sur le rectangle tracé dans l'éditeur** (l'alcôve sur
le plot, le pupitre sur le banc) : respectez les proportions données — carré
pour l'alcôve, deux fois plus large que haut pour le banc — sinon la pièce se
déforme quand le rectangle n'a pas la même forme. Le marchand, lui, est un
POINT : sa pièce se pose carrée, à taille fixe.

**Vérifier qu'un fichier est bien arrivé** : dans la console du jeu,
`__sprites()` liste les images 2D chargées, et `__decor()` le décor envoyé au
rendu, décalques du méta compris.

Déposez les fichiers dans `public/assets/` sous ces noms exacts — ils
apparaîtront aussitôt dans la bibliothèque d'images, rubrique « Méta &
commerce ». **Tant qu'un fichier manque, le dessin actuel (vectoriel) tient la
place** : rien ne casse, vous pouvez les livrer un par un.

### ⬛ CE QUI EST LIVRÉ (août 2026)

Les cinq pièces sont en place. Une pièce REMPLACÉE doit garder le rapport de
celle qu'elle remplace, sinon le décalque se pose plus petit (il ne se déforme
jamais : il se centre dans le rectangle, à son rapport) — et les rapports sont
inscrits dans `src/game/metaAssets.ts`, à corriger en même temps que l'image.

| Pièce | Rapport livré | Où il est inscrit |
|---|---|---|
| alcôve | 1,337 | `RAPPORT_ALCOVE` |
| pupitre du banc | 2,188 | `RAPPORT_BANC` |
| Sujet 12 | 0,426 | `RAPPORT_MARCHAND` (et la colonne de l'Économat) |
| éclat | libre | lu sur l'image |
| planche d'icônes | 4×2 imposé | recomposée à l'intégration |

Le traitement d'intégration (recadrage, planche remise en cases égales, alpha
prémultiplié, éclaircissement ×1,30 des décalques) est refait à chaque
livraison — inutile de le préparer soi-même, un rendu propre sur fond
transparent suffit.

### 15a. LE SUJET 12 — le marchand — `meta-marchand.webp`
**1024×1024 · PNG/WebP transparent · décalque**

Un SEMBLABLE : la même matière que le joueur, mais captive et lasse. Pas un
marchand humanoïde — une masse de fluide dans sa capsule, qui pousse des choses
à travers les barreaux.

```
Flat orthographic 2D game sprite of a captive liquid creature held in a containment
capsule, front view: a heavy viscous mass of pale blue-green fluid (#7fc9c2) sagging
under its own weight inside a dull metal capsule with reinforced rings top and bottom,
faint internal sediment and small clinging bubbles, one single dim luminous core deep
inside the mass (#a9ffd6) reading as quiet attention, slack tired silhouette, thin cold
rim light from above, retro-futuristic 1970s orbital laboratory, muted cold palette,
low brightness, evenly lit, isolated on transparent background, flat 2D game asset,
no perspective, no text
```
Négatif : `face, eyes, mouth, humanoid, character design, mascot, cute, anthropomorphic, arms, bright colors, warm colors, neon, perspective, ground shadow, background, text, watermark`

### 15b. LE BANC DES MÉMOIRES — `meta-banc.webp`
**1024×512 · PNG/WebP transparent · décalque**

Le pupitre qu'on touche pour ouvrir le cycle des états. Du mobilier de
laboratoire, pas une borne d'arcade.

```
Flat orthographic front view of a low laboratory console lectern, wide and shallow,
dark steel-blue metal body with visible seams and rivets, a slanted dark glass reading
panel inset in the top surface, a row of small unlit indicator studs along the front
edge, faint mint-green glow (#6dffb8) leaking from under the panel and from a thin
engraved line across the body, worn edges, retro-futuristic 1970s orbital laboratory,
muted cold palette, evenly lit, isolated on transparent background, flat 2D game asset,
no perspective, no text
```
Négatif : `screen content, user interface, letters, numbers, symbols, keyboard, chair, floor, perspective, ground shadow, background, bright glow, neon, text, watermark`

### 15c. L'ALCÔVE D'ÉTAL — `meta-alcove.webp`
**512×512 · PNG/WebP transparent · décalque**

La niche où le corps se glisse pour acheter. Une seule pièce, répétée à chaque
plot posé — donc NEUTRE : ni article dedans, ni prix (le jeu les dessine).

```
Flat orthographic front view of an empty recessed wall alcove for a shop stall, square
three-sided metal niche, dark steel-blue panels with visible seams, a plain shelf ledge
across the lower third, a small empty label holder plate under the shelf, dim cold light
washing the inner back wall, worn metal edges, retro-futuristic 1970s orbital laboratory,
muted cold palette, low brightness, isolated on transparent background, flat 2D game
asset, no perspective, no text
```
Négatif : `products, goods, items, bottles, price tag, letters, numbers, shopkeeper, perspective, ground shadow, background, warm light, text, watermark`

### 15d. L'ÉCLAT DE MÉMOIRE — `meta-eclat.webp`
**256×256 · PNG/WebP transparent · 2D (dessiné par-dessus le fluide)**

L'information cristallisée, ramassée au contact. Petite, franche, lisible même
noyée dans l'eau.

```
Flat orthographic 2D game sprite of a small floating memory crystal shard, sharp
elongated diamond shape seen face on, translucent mint green (#8effcd) with pale white
inner facets, a bright concentrated highlight near the upper facet, clean crisp edges,
faint cold glow around the silhouette, retro-futuristic sci-fi game icon, isolated on
transparent background, flat 2D game asset, no perspective, no text
```
Négatif : `hand, holder, base, pedestal, background, ground shadow, warm colors, rainbow, lens flare, text, watermark`

*Option luxe* — si vous voulez une vraie rotation plutôt qu'un pivot à plat :
une bande `2048×256` de **8 vues** du même cristal tournant sur son axe
vertical, régulièrement espacées, même cadrage et même échelle d'une case à
l'autre. Nommez-la pareil : le moteur détecte la bande à ses proportions.

### 15e. LA PLANCHE D'ICÔNES DU MÉTA — `meta-icones.webp`
**1024×512 · PNG/WebP transparent · grille 4×2 de cases 256 · 2D**

Les articles du commerce et les monnaies. Aujourd'hui ce sont des EMOJI, qui
changent de dessin d'une machine à l'autre (Windows, Steam Deck, Mac) et
cassent l'unité graphique ; cette planche les remplace partout.

L'ordre des cases est IMPOSÉ — de gauche à droite, ligne du haut puis ligne du
bas :

| | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| **haut** | fiole de gouttes | recharge de dashs | clef de cachette | échantillon de secours |
| **bas** | sac surprise | éclat de mémoire | goutte de condensat | vie (échantillon de secours du corps) |

```
Sheet of 8 video game inventory icons arranged in a strict 4 by 2 grid on a fully
transparent background, each icon centred in its own equal square cell with generous
even margins, identical style and identical visual weight across all eight: a small
sealed vial of pale blue liquid, a stylised burst of three cold vapour jets, an angular
maintenance key, a rounded containment sample cell, a plain closed cloth pouch, a
faceted mint green crystal shard, a single fat cyan water droplet, a soft rounded
blue-white droplet with a pale core. Flat orthographic 2D icons, thin crisp outlines,
cold muted retro-futuristic space station palette, low saturation, subtle inner shading,
no cell borders, no grid lines, no labels, no text, no drop shadows
```
Négatif : `text, letters, numbers, labels, captions, grid lines, cell borders, frames, drop shadow, background, gradient background, photorealism, 3d render, perspective, warm colors, gold, bright neon, watermark`

**Si la grille sort mal** (c'est le prompt le plus difficile de la fiche : les
générateurs alignent mal et changent de style d'une case à l'autre) : générez
les **huit icônes séparément** en 512×512, nommez-les `meta-icone-1.webp` à
`meta-icone-8.webp` dans l'ordre du tableau ci-dessus, et **j'assemble la
planche** — c'est deux minutes de traitement à l'intégration, et le résultat
est bien plus régulier.

## Ce que je peux faire sans générateur d'images

Vecteurs SVG (logo, cadres, icônes, écusson au trait) et textures procédurales en
shader (le décor actuel : étoiles, nébulosité, caustiques, métal brossé…). Les
prompts ci-dessus visent Midjourney, DALL·E, Flux, Stable Diffusion, etc.

## 16. LE SAS DE RACCORD — `sas-raccord.webp` et `sas-raccord-v.webp` — PRIORITÉ 1

**Toujours manquant au 10/09/2026.** Le moteur pose déjà la pièce à chaque
jonction (quatorze sur le module Méduse) et n'attend que le fichier : c'est
l'image qui change le plus le jeu pour un seul prompt.

**Référence fournie par le concepteur : `docs/reference/sas-raccord-reference.png`.**
C'est elle qui fait foi — les lignes ci-dessous ne font que la traduire en
contraintes de fabrication. Elle corrige au passage la règle commune de
palette : sur cette pièce les veilleuses sont **ambre**, pas cyan.

**1024 × 1280 · PNG/WebP TRANSPARENT · décalque** (et son quart de tour,
1280 × 1024 pour `sas-raccord-v.webp` — envoyez la pièce une seule fois si
vous préférez, je produis la rotation).

La pièce qui JOINT deux modules de la station. Le jeu la pose tout seul, à
chaque bout de couloir raccordé : elle se plante SUR la couture entre deux
coques, à cheval sur le mur traversé et sur le col du couloir. Son rôle est
double — cacher le joint entre deux parois qui ne se tuilent pas pareil, et
dire à l'œil que le passage est un vrai sas, pas un trou dans un mur.

### La géométrie est imposée — c'est le seul point non négociable

Le moteur ne recadre pas la planche : il la pose entière, à son rapport, et
il compte que **l'ouverture dessinée tombe pile sur la porte percée**. Donc,
sur une planche de 1024 × 1280 :

| élément | position |
|---|---|
| ouverture vide (transparente) | **centrée**, **800 px de haut** (les 5/8 de la hauteur), ~200 px de large |
| bride gauche | de x ≈ 300 à x ≈ 410 |
| bride droite | de x ≈ 615 à x ≈ 725 |
| moignon de coque | les ~250 px de chaque bord, **fondus au transparent sur le bord extrême** |
| col (au-dessus / au-dessous de l'ouverture) | 240 px en haut, 240 px en bas |

Les 800 px d'ouverture doivent être **franchement transparents** : c'est par
là qu'on entre, le fluide et le corps passent devant. Un décalque opaque au
milieu boucherait visuellement le passage.

Ne dessinez pas les longs fûts de modules de la référence : le moteur peint
déjà les coques, avec leur propre matière. Ce qu'il manque, c'est le collier
central — **cadrez sur les deux brides**, et laissez juste un moignon de
coque de chaque côté qui s'éteint en transparence au bord de la planche.
C'est ce moignon qui recouvre la couture.

### Le dessin

Un COL D'AMARRAGE vu de profil, comme le reste du jeu, exactement dans
l'esprit de la référence : deux brides de métal épaisses boulonnées face à
face, l'ouverture en pastille arrondie entre elles, un vérin hydraulique
vertical avec sa biellette de part et d'autre, quatre petites veilleuses
carrées ambre, tôle rivée, lignes de soudure, peinture usée.

```
side view of a spacecraft docking collar, two thick bolted metal flanges facing each other, tall rounded-rectangle passage opening between them, vertical hydraulic ram with linkage arms on each side, four small square amber indicator lamps, riveted panelled steel, weld seams, worn paint, scuffs and grime in the recesses, retro-futuristic orbital station, cold grey-blue palette with warm amber accents, evenly lit, flat 2D game asset, orthographic side elevation, no perspective, no text
```

Négatif : `perspective, vanishing point, text, watermark, background, ground shadow, closed door, hatch cover, sealed, people, logo, long cylinder body`

### Palette relevée sur la référence

`#14181c` fond / creux · `#22262b` ombres de tôle · `#3f454c`–`#5a6068`
métal principal · `#7d838a` arêtes vives · `#9aa3ab` chrome des vérins ·
`#e8951f` cœur des veilleuses, `#c96f14` leur cerne.

Le moteur refroidit et atténue les décalques (opacité 0,75) : générez plus
contrasté et un cran plus clair que le rendu voulu.

### Ce que ça donne en jeu

Sur le module Méduse, quatorze jonctions ; chaque sas est posé à 384 × 480
unités monde, l'ouverture couvrant exactement les 300 unités de la porte, le
col montant 90 unités au-dessus et au-dessous. Aucun sas n'en chevauche un
autre — le couloir le plus court du hub mesure 428 unités.

Déposez les fichiers dans `public/assets/` sous ces noms exacts — ils
apparaîtront aussitôt dans la bibliothèque d'images, rubrique « Coque &
fonds ». **Tant que les fichiers manquent, les jonctions restent telles
qu'elles sont** : rien ne casse, la pièce s'ajoute quand elle arrive.
Vérification en jeu : `__decor()` dans la console liste les décalques
envoyés au rendu — les sas y apparaissent sous `sas-raccord`.

---

## 17. LES DÉCALQUES ANIMÉS — `<fichier>-anime.webp`

**Une bande horizontale de vues côte à côte · WebP TRANSPARENT · ≤ 4096 px de large**

Une planche de vues posée à côté de l'image fixe (`decal-vanne-anime.webp`
à côté de `decal-vanne.webp`) et la pièce s'anime dans le jeu — absente, la
pièce reste fixe. Le nombre de vues n'est écrit nulle part : il se déduit du
rapport entre la bande et l'image fixe, donc **chaque vue a exactement le
rapport de l'image fixe**. Le moteur joue 12 vues par seconde ; 8 vues font
une boucle de deux tiers de seconde (une vanne qui tourne, une vapeur qui
sort), 12 un mouvement plus long. Détail : `docs/charte-visuelle.md` §8,
`src/render/planche.ts`.

**Comment on la fabrique.** Pas d'image par vue au générateur d'images : deux
tirages du même prompt ne se ressemblent pas. On part de l'image fixe LIVRÉE
et on demande une vidéo à un générateur image-vers-vidéo (Kling, Runway,
Luma, Veo…) :

```
Animate this exact image as a seamless loop: static camera, no zoom, no pan,
nothing enters or leaves the frame, the background stays perfectly still and
transparent; only the <valve wheel> moves — <one slow full rotation>. 2 seconds,
loop the first and last frames identically. Keep the exact colors and lighting.
```

Puis, sur votre poste :

```bash
python3 tools/images/planche.py decal-vanne vanne.webm          # ou un dossier de PNG
python3 tools/images/prepare.py decal-vanne-anime               # livre public/assets/
```

`planche.py` vérifie le rapport de chaque vue, exige la transparence (un
WebM VP9 la porte ; un MP4 ne le peut pas : `--sans-alpha`, et il faudra
détourer les vues avant), réduit les vues pour que la bande tienne dans
4096 px, et écrit le master dans `masters/images/`. `prepare.py` le livre
comme le reste.

**Ce qui vaut la peine d'être animé** (dans cet ordre) : la vanne (elle
tourne), l'écran allumé (il scintille), la gouttière de la serre (l'eau y
coule), le blé nain (il ondule). Pas le sas de raccord ni les fioles : rien
n'y bouge par nature. **Aucune bande n'est livrée au 10/09/2026.**

**La phrase du mouvement, pièce par pièce** (à substituer dans le gabarit
ci-dessus ; la vanne a la sienne en §19, après sa reprise) :

| bande | seulement ceci bouge | durée · vues |
| --- | --- | --- |
| `decal-ecran-on-anime.webp` | `the glowing screen content: faint scanlines drift downward, the pale diagram on the screen redraws itself slowly, one small indicator lamp blinks twice; the housing, cables and knobs do not move` | 2 s · 12 vues |
| `serre-rampe-anime.webp` (et `-a`) | `the faint cyan nutrient water inside the gutter: it flows steadily from left to right with small ripples; the LED bar, brackets and gutter body do not move` | 2 s · 12 vues |
| `serre-ble-nain-anime.webp` | `the wheat stalks and ears: they sway very gently as in a slow draft, a few millimetres, returning to rest; the tray and pebbles do not move` | 2 s · 12 vues |

Une bande est **transparente** : demandez la vidéo sur fond uni noir ou
vert si le générateur ne sort pas d'alpha, `planche.py` détoure ensuite les
vues (`--sans-alpha`), et vérifiez la première et la dernière vue côte à
côte — si elles diffèrent, la boucle saute.

---

## 18. LES SURFACES À REFAIRE — `grille.webp`, `tank-bg.webp` (et `wall.webp`, §5)

Trois textures répétées montrent leur couture : `prepare.py --audit` du
10/09 mesure la grille à **4,6 / 4,7**, le vieux mur à **1,9 / 4,7**, le
fond de cuve à **3,2 / 1,9** — le seuil est 3,0. On les voit se répéter
dans toute cuve un peu large. Les trois sont des tuiles de 1024², sans
transparence, `--tile` chez Midjourney, *seamless* ailleurs. Avant d'envoyer,
`python3 tools/images/prepare.py --verifie <nom>` dit le raccord ; si le
générateur ne tient pas la couture de la grille, envoyez quand même : un
panneau perforé se recadre à un nombre entier de trous, je le fais.

### 18a. L'évent — `grille.webp` ✗ À REFAIRE
**1024×1024 · tileable · pas de transparence · luminance ≤ 0,32**

```
[PRÉAMBULE — charte §5]
Seamless tileable texture of a dark perforated steel vent panel seen flat
from directly above: a strictly regular square grid of small round holes
punched through dull blue-grey sheet metal (#10151c to #2a3542), each hole
a pure black void with a faint countersunk rim, the hole pattern continuing
EXACTLY across all four edges so the texture repeats with no visible seam,
matte finish, low contrast, uniform grain
```
Négatif : négatif commun + `rust, hexagonal mesh, warped grid, uneven holes,
large holes, bright reflections, panel border`

### 18b. Le fond de cuve — `tank-bg.webp` ✗ À REFAIRE
**1024×1024 · tileable · pas de transparence · luminance visée 0,10 à 0,15**

Le fond est ce qu'on voit sous l'eau : il doit rester **plus sombre que les
parois** (0,17). Le liséré cyan tourne aujourd'hui en boucle sans retomber
sur lui-même au bord ; c'est lui qui trahit la couture.

```
[PRÉAMBULE — charte §5]
Seamless tileable texture of the floor of a laboratory containment tank
seen flat from directly above: large dark riveted steel plates (#0a1420)
with thin recessed seams, a few flush conduit covers and small square drain
grilles, two thin straight cyan trim lines (#63b7e6) crossing the whole
tile and meeting their own ends exactly at the edges, very low brightness,
uniform grain, perfect tiling on both axes
```
Négatif : négatif commun + `water, puddles, reflections, rust, diagonal
lines, bright lines, panel border`

---

## 19. LA VANNE, REPRISE — `decal-vanne.webp` ✗ À REFAIRE, puis `decal-vanne-anime.webp`

**1024×1536 (rapport 2:3, imposé) · PNG/WebP TRANSPARENT · décalque**

La vanne livrée est **coupée par son cadre sur 11 % du bord** : son tuyau
file hors de l'image en haut et en bas, et la pièce se lit comme une
vignette collée dès qu'on la pose seule. Le rapport 2:3 ne se discute pas :
les tableaux la posent en 190×285 et 150×225, une autre forme se
centrerait plus petite. C'est aussi la **première pièce à animer** (§17) —
refaire la fixe d'abord, la bande ensuite, depuis la fixe livrée.

```
[PRÉAMBULE — charte §5]
Flat orthographic FRONT elevation of a large industrial valve on a short
vertical pipe section: a heavy cast-iron handwheel with six spokes seen
exactly face on, mounted on a bonnet with a packing nut, the pipe ending
ABOVE and BELOW in bolted flanges that sit fully INSIDE the frame with a
clear transparent margin all around, one thin cyan trim ring (#63b7e6) on
the bonnet, riveted wall brackets, worn paint, isolated on transparent
background, flat 2D game sprite, no ground shadow
```
Négatif : négatif commun + `pipe leaving the frame, cropped, cut off,
background, ground shadow, tilt, three-quarter view`

**La bande animée**, depuis la fixe livrée (image-vers-vidéo) :

```
Animate this exact image as a seamless loop: static camera, no zoom, no pan,
nothing enters or leaves the frame, the background stays perfectly still and
transparent; only the HANDWHEEL turns — one slow full clockwise rotation,
constant speed, the pipe and brackets do not move. 2 seconds, loop the first
and last frames identically. Keep the exact colors and lighting.
```
Puis `planche.py decal-vanne <vidéo>` et `prepare.py decal-vanne-anime` :
huit vues suffisent à une roue à six rayons (le mouvement se referme).

---

## 20. LES STATIONS DU HUB — cinq décalques pour le module Méduse

Le hub est le tableau le plus joué, et ses **stations** (celles du tableau
des avaries) n'y sont que des plots nus : un rectangle au sol que le corps
touche pour payer la réparation. Leur illustration existe pour l'écran
(`public/assets/avaries/`), pas pour la cuve. Cinq pièces de machinerie,
dans la famille de l'écran de contrôle et de la vanne (**vue de FACE
orthographique**, détourée, sans ombre au sol), posées sur le plot de
chaque station. Les rapports sont **ceux des plots** (`src/game/hub.ts`) :
un décalque se centre à son rapport, une autre forme se poserait plus
petite.

L'aile des endormis a déjà ses fioles ; la passerelle est un passage : pas
de pièce pour ces deux-là. **Une seule image par station**, en état de
marche — comme pour l'écran des avaries, c'est le moteur qui assombrit le
module en panne.

Déposez sous ces noms exacts ; j'ajoute les sortes à l'éditeur (groupe
« Décor (sans physique) ») et je les pose sur les plots à la livraison.

### 20a. Le réseau d'éclairage — `hub-eclairage.webp`
**1024×1024 (1:1) · transparent**

```
[PRÉAMBULE — charte §5]
Flat orthographic front view of a wall-mounted electrical distribution
cabinet with its door open: rows of large lever switches and ceramic fuse
cartridges on a dark steel backplate, bundled cables leaving through the
top in a tray, one small unlit indicator lamp per row, engraved blank
plates (no letters), worn paint and grime in the recesses, isolated on
transparent background, flat 2D game sprite, no ground shadow
```
Négatif : négatif commun + `text, numbers, glowing, sparks, background,
ground shadow, three-quarter view`

### 20b. La table de départ — `hub-table-depart.webp`
**1536×512 (3:1) · transparent**

```
[PRÉAMBULE — charte §5]
Flat orthographic front view of a long low launch console bench: a dark
steel body with a slanted top carrying a row of round pressure gauges with
blank dials, a brass hand rail along the front edge, a chart table surface
with faint grid lines on the right, a few rotary knobs and toggle switches,
one thin cyan trim line (#63b7e6) along the base, rivets and worn edges,
isolated on transparent background, flat 2D game sprite, no ground shadow
```
Négatif : négatif commun + `text, numbers, screen content, chair, glowing,
background, ground shadow`

### 20c. Le mur des records — `hub-mur-records.webp`
**1536×439 (3,5:1) · transparent**

```
[PRÉAMBULE — charte §5]
Flat orthographic front view of a long wall panel of mechanical record
counters: rows of split-flap display windows all BLANK (no digits, no
letters), small engraved nameplates left empty, a few round dial gauges
with plain needles, a brass frame around the whole panel, dark riveted
steel, one thin cyan trim line (#63b7e6) along the top edge, worn paint,
isolated on transparent background, flat 2D game sprite, no ground shadow
```
Négatif : négatif commun + `text, numbers, letters, digits, screen,
glowing, background, ground shadow`

### 20d. Le bac d'essai — `hub-bac-sable.webp`
**1024×1024 (1:1) · transparent**

```
[PRÉAMBULE — charte §5]
Flat orthographic front view of a square laboratory test basin: a shallow
open steel tray on a riveted stand, a grid of calibration marks etched on
the inner back wall (plain ticks, no digits), four small adjustable
nozzles on the rim, a drain valve underneath, a faint film of cyan-tinted
water (#63b7e6) at the bottom of the tray, dark blue-grey metal, worn
edges, isolated on transparent background, flat 2D game sprite, no ground
shadow
```
Négatif : négatif commun + `text, numbers, sand, soil, glowing,
background, ground shadow`

### 20e. Le distillateur de primes — `hub-distillateur.webp`
**1024×1024 (1:1) · transparent**

```
[PRÉAMBULE — charte §5]
Flat orthographic front view of a laboratory distillation column: a squat
boiler at the base, a tall riveted steel column with three glass bulbs
holding pale blue liquid (#a7ddf5), a condenser coil of dull copper on the
side, small valves and a round pressure gauge with a blank dial, one small
amber pilot lamp (#e8951f) near the base, weld seams and worn paint,
isolated on transparent background, flat 2D game sprite, no ground shadow
```
Négatif : négatif commun + `text, numbers, purple neon, glowing liquid,
bright colors, background, ground shadow`

---

## 21. DEUX PLAFONDS DE PLUS — `plafond-serre.webp`, `plafond-hub.webp`

Six variantes sont livrées (§13) et **aucun tableau n'en demande une** au
10/09 — je les attribue de mon côté (givre → chambre froide et dépôt de
givre, chaufferie → cuve thermique, hélice → conduit et évent, brèche →
galerie noyée, planète → dérive, observatoire → miroirs et prisme). Manquent
les deux salles qui ont le plus de caractère : la serre, et le hub.

Même famille que §13 : 1024² vu du DESSOUS, sombre (luminance ≤ 0,24), les
verrières et barres plus claires que tout le reste, répété en miroir (pas
de raccord à tenir).

### 21a. `plafond-serre.webp`

```
[PRÉAMBULE — charte §5]
Looking straight UP at the ceiling of a hydroponic greenhouse bay in a
1970s orbital laboratory, orthographic view from below: dark crossing
beams and cable trays, several long horticultural light bars glowing cold
white (#d6e8f5) with a faint green cast (#3fd69b) at their ends, hanging
drip lines and misting nozzles, condensation beads on the dark metal, a
few round portholes showing black space, the lit bars clearly brighter
than everything else, flat 2D game texture
```
Négatif : négatif commun + `plants hanging into view, leaves, sunlight,
warm light, pink, magenta, floor, people`

### 21b. `plafond-hub.webp` — le module Méduse

```
[PRÉAMBULE — charte §5]
Looking straight UP at the ceiling of the central hub module of a 1970s
orbital laboratory, orthographic view from below: one large round skylight
in the middle with radial mullions like the ribs of a jellyfish bell, glass
glowing cold white (#d6e8f5) over black space with sparse stars, a ring of
small round portholes around it, dark riveted structure with cable trays
and thick pipes between them, the glass clearly brighter than everything
else, flat 2D game texture
```
Négatif : négatif commun + `floor, furniture, people, warm colors, planet,
sun, moon, lens flare`

---

## 22. LES PLANCHES DE LA RÉVÉLATION ET DU MIROIR — six planches de cinématique

Deux cinématiques jouent aujourd'hui sur des planches **recyclées** de
l'ouverture (`src/game/cinematique.ts`) : LA RÉVÉLATION (le sceau tombe,
trois battements) et LE MIROIR (la fin de l'arc, quatre battements). Six
planches, trois par cinématique, même famille que §11 : **1600×900**, marge
sur les bords, aucun texte, luminance ≤ 0,50, ≤ 260 Ko. Elles ne se
chargent qu'à la lecture de leur cinématique.

Les répliques posées par le lecteur (rappel, pour l'image, pas pour le
prompt) :

| fichier | battement | réplique |
| --- | --- | --- |
| `revelation-1.webp` | tout est consigné, tout est lu | « Il ne reste rien à cacher. » |
| `revelation-2.webp` | la porte scellée | « Quelqu'un avait scellé cette porte en sachant ce qu'il faisait. » |
| `revelation-3.webp` | le secteur 4 s'ouvre | « Le sceau n'a plus de raison de tenir. » |
| `miroir-1.webp` | le convoyeur | « La route du plasma mène au convoyeur. Le convoyeur mène là-haut. » |
| `miroir-2.webp` | le télescope sans son miroir | « Un télescope achevé à un miroir près attend son œil. » |
| `miroir-3.webp` | le choix (deux battements) | « Devenir l'œil qui regarde l'univers… » |

### 22a. `revelation-1.webp`
```
[PRÉAMBULE — charte §5]
Wide cinematic frame, 16:9: the archive room of the laboratory, walls of
reel-to-reel tape decks and rows of bulbous cathode screens all lit with
pale cyan static, stacks of bound logbooks and pinned charts with no
readable writing, a single reading lamp off, dust in the still air, quiet
and exposed, cold palette
```
Négatif : négatif commun + `readable text, letters, numbers, people,
modern computers, flat screens`

### 22b. `revelation-2.webp`
```
[PRÉAMBULE — charte §5]
Wide cinematic frame, 16:9: a heavy bulkhead door seen from the front,
welded shut with a thick steel seal plate and crossed bars, a single
hand-painted diagonal stripe of dull red (#c8524a) across the seal, chains
and a padlock, frost at the joints, the corridor around it dark and still,
cold palette
```
Négatif : négatif commun + `text, symbols, people, open door, bright
light`

### 22c. `revelation-3.webp`
```
[PRÉAMBULE — charte §5]
Wide cinematic frame, 16:9: the same bulkhead now OPEN, its seal plate
fallen on the grating, cold pale light pouring through onto a long catwalk
beyond, and far at the end a round porthole framing a distant space
telescope against the stars, the sample as a faint glossy pool of water
at the threshold, cold palette
```
Négatif : négatif commun + `text, people, warm light, lens flare`

### 22d. `miroir-1.webp`
```
[PRÉAMBULE — charte §5]
Wide cinematic frame, 16:9: a long inclined conveyor tube rising through
the station, two field rails glowing dim violet (#9e6bc7) along its floor,
thin plasma arcs jumping between them, riveted ribs receding upward, a
hatch of cold light at the very top, cold palette with the single violet
accent
```
Négatif : négatif commun + `text, people, bright neon, pink, warm colors`

### 22e. `miroir-2.webp`
```
[PRÉAMBULE — charte §5]
Wide cinematic frame, 16:9: inside the observatory dome of a 1970s orbital
laboratory, a huge telescope tube seen from behind, its primary mirror cell
EMPTY — a bare circular cradle of steel spokes where the mirror should be —
stars and a faint nebula through the glass dome above, cables and a
maintenance gantry, cold blue-violet palette (#c99aff accents)
```
Négatif : négatif commun + `text, people, a mirror in place, bright
light, sun, planet`

### 22f. `miroir-3.webp`
```
[PRÉAMBULE — charte §5]
Wide cinematic frame, 16:9: the empty mirror cradle of the great telescope
now holding a perfect wobbling disc of water, its glossy surface reflecting
the whole starfield and the nebula like a liquid mirror, one small mint
green core (#a9ffd6) glowing quietly inside the water, the dome and the
stars beyond, calm and immense, cold palette
```
Négatif : négatif commun + `text, people, face, eye, warm colors, lens
flare`

---

## 23. LES PLANCHES D'ICÔNES DU CYCLE ET DES TROPHÉES — `cycle-icones.webp`, `trophees-icones.webp`

Même raison que la planche du méta (§15e) : les états du cycle, les
transformations et les trophées sont des **emoji**, qui changent de dessin
d'une machine à l'autre. Ces glyphes sont partout — le cycle des mémoires,
les cadenas de la carte de la station (❄ GLACE, ♨ VAPEUR), les trophées.
Même famille que `meta-icones.webp` : la passer en référence de style
(`--sref`), pour que les trois planches se lisent comme une seule série.

**Si la grille sort mal** (c'est toujours le prompt le plus dur) : les
icônes une par une en 512², nommées `cycle-icone-1.webp`… et
`trophee-icone-1.webp`… dans l'ordre des tableaux, j'assemble.

### 23a. Le cycle — `cycle-icones.webp`
**1024×768 · transparent · grille 4×3 de cases 256 · 2D**

| | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| **haut** — les états | SOLIDE (cristal) | LIQUIDE (goutte) | GAZ (nuée) | PLASMA (arc) |
| **milieu** | FUSION (cristal → goutte) | LIQUÉFACTION (nuée → goutte) | SOLIDIFICATION (goutte → cristal) | VAPORISATION (goutte → nuée) |
| **bas** | SUBLIMATION (cristal → nuée) | CONDENSATION (nuée → cristal) | IONISATION (nuée → arc) | DÉIONISATION (arc → nuée) |

```
[PRÉAMBULE — charte §5]
Sheet of 12 video game icons arranged in a strict 4 by 3 grid on a fully
transparent background, each icon centred in its own equal square cell
with generous even margins, identical style and identical visual weight
across all twelve. Top row, the four states: a faceted ice crystal
(#a7ddf5), a single fat water droplet (#63b7e6), a soft rounded puff of
vapour (#f2c98e), a small forked plasma arc (#c99aff). Middle and bottom
rows, eight transformations, each drawn as a SMALL source symbol on the
left turning into a SMALL target symbol on the right with a thin curved
arrow between them: crystal→droplet, puff→droplet, droplet→crystal,
droplet→puff, crystal→puff, puff→crystal, puff→arc, arc→puff. Flat
orthographic 2D icons, thin crisp outlines, low saturation, subtle inner
shading, no cell borders, no grid lines, no labels
```
Négatif : négatif commun + `text, letters, numbers, labels, grid lines,
cell borders, frames, photorealism, 3d render, gold, bright neon, rainbow`

### 23b. Les trophées — `trophees-icones.webp`
**1024×512 · transparent · grille 4×2 de cases 256 · 2D**

| | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| **haut** | SANS UNE GOUTTE (une goutte entière dans un anneau) | PALET PARFAIT (un palet de glace) | TROIS ÉTATS (cristal, goutte et nuée en triangle) | LA LIGNE DE CRÊTE (une ligne de crête, un fanion au sommet) |
| **bas** | MIROIR VIVANT (un rayon brisé sur un cristal) | RECONDENSÉ (cinq perles sur une plaque) | L'INTÉGRALE (une orbite bouclée autour d'une station) | OPÉRATEUR DE NUIT (un croissant de lune sur un pupitre) |

```
[PRÉAMBULE — charte §5]
Sheet of 8 video game achievement icons arranged in a strict 4 by 2 grid
on a fully transparent background, each icon centred in its own equal
square cell with generous even margins, identical style and identical
visual weight across all eight: a whole water droplet inside a thin ring,
a flat round ice puck, a crystal, a droplet and a puff of vapour arranged
in a small triangle, a mountain ridge line with a tiny flag on the peak, a
thin beam of light bending off a crystal, five small dew beads on a flat
plate, a closed orbit ring around a tiny space station, a crescent moon
over a small console. Flat orthographic 2D icons, thin crisp outlines,
cold muted palette with cyan (#63b7e6) and ice (#a7ddf5) accents, subtle
inner shading, no cell borders, no grid lines, no labels
```
Négatif : négatif commun + `text, letters, numbers, labels, grid lines,
cell borders, frames, photorealism, 3d render, gold, trophy cup, medal,
bright neon`

---

## 24. L'ATLAS DES PAROIS N° 2 — les biomes (phase 2)

L'atlas livré (`paroi-atlas.webp`, huit habillages : caissons, conduites,
poutrelle, blindage, aération, hublot, écrans, câbles) est **neutre** : la
même paroi de la chambre froide à la cuve thermique. La carte de la station
va de −25 °C à 72 °C, et un module se reconnaît d'abord à ses murs. Huit
habillages de plus, trois par climat et deux pour l'observatoire.

**Huit textures séparées**, `paroi-b-1.webp` à `paroi-b-8.webp`, 1024²,
**chacune tileable sur les deux axes** (`--tile`), sans transparence,
luminance ≤ 0,32 ; j'assemble l'atlas et j'ouvre les habillages 9 à 16 dans
le moteur (c'est un chantier shader de mon côté : ne les générez pas avant
que je l'aie ouvert — d'où la phase 2).

| n° | climat | la pièce |
| --- | --- | --- |
| 1 | givre | panneaux de tôle sous une pellicule de givre, cristaux aux joints |
| 2 | givre | conduites calorifugées prises dans la glace, stalactites courtes |
| 3 | givre | hublot rond gelé de l'intérieur, fougères de givre sur le verre |
| 4 | chaufferie | tôle brûlée, peinture cloquée, traces de suie |
| 5 | chaufferie | rangée de manomètres à cadran vide, une veilleuse ambre `#e8951f` |
| 6 | chaufferie | calorifuge matelassé, sangles et brides |
| 7 | observatoire | nervures d'un dôme, verre sombre entre elles, étoiles rares |
| 8 | observatoire | baie vitrée à meneaux fins sur le noir, un liséré violet `#9e6bc7` |

Gabarit de prompt (remplacer la ligne de la pièce) :

```
[PRÉAMBULE — charte §5]
Seamless tileable texture of <la pièce>, flat orthographic view, dark
riveted steel base (#0a1420 to #2a3542), matching edges so the texture
repeats on both axes with no visible seam, low brightness, flat 2D game
texture
```
Négatif : négatif commun + `panel border, frame, warm colors` (sauf la
veilleuse de la pièce 5, qui est ambre).

---

## 25. LES CARTONS DE JOURNAL — une illustration par tableau (phase 3)

Chaque tableau porte une ligne de journal du Dr Véga ; un seul (la galerie
noyée) a son carton (`card-galerie.webp`, 1672×941, l'écran LIVRAISONS le
montre au-dessus des notes). Seize tableaux n'en ont pas. C'est du
**volume** (seize images, ~60 Ko chacune) pour un écran de concepteur : à
faire en dernier, et dans la famille des illustrations d'avaries
(`public/assets/avaries/`), qui a déjà son style — celui-là, pas celui de la
cuve.

**1672×941 · 16:9 · WebP · luminance ≤ 0,55 · ≤ 160 Ko**, nommé
`card-<code>.webp` (le code du tableau : `card-21-s1.webp`…). Gabarit :

```
[PRÉAMBULE — charte §5]
Wide illustration, 16:9, in the exact style of the attached reference
(avaries/table-depart.webp): a laboratory observation card of <le tableau>,
seen from the observation gallery through thick glass, the containment
tank below with <ce que le journal raconte>, instruments and a clipboard
with no readable writing, cold palette
```

| code | tableau | ce que le journal raconte |
| --- | --- | --- |
| 21-S1 | L'école des parois | trois parois côte à côte : mate, cireuse, mouillée |
| 21-S2 | L'école des climats | une plaque givrée, une chaudière, un évent, une éponge |
| 21-S3 | L'école des zones | un hublot fendu, une conduite rompue |
| 21-A | Le sas | l'iris du collecteur, sept trajectoires identiques tracées à la craie |
| 21-B | La chambre froide | des plaques cryogéniques fraîchement boulonnées |
| 21-C | Le conduit | un évent, un panache qui le traverse |
| 21-E | La serre | des gouttières hydroponiques, le corps accroché à une paroi mouillée |
| 21-F | Le dépôt de givre | des perles de givre sur une plaque, revenues dans l'eau |
| 21-D | La cuve thermique | une chaudière et une cryobaie dans la même cuve |
| 21-H | La salle des miroirs | un émetteur laser, un récepteur, un corps gelé qui renvoie le faisceau |
| 21-I | Le prisme | un faisceau plié à travers une masse d'eau |
| 21-J | La voie de plasma | des rails de champ, un arc violet qui les suit |
| 21-K | Les deux verrous | deux récepteurs, un faisceau renvoyé, un faisceau plié |
| 21-L | À travers l'évent | un évent, une nuée qui le traverse sur un rail |
| 21-M | La traversée des états | trois portes, trois verrous en enfilade |
| 21-G | La dérive | une cuve sans cloisons, deux ricochets tracés |

---

## 26. L'APPROCHE — six planches avant l'ouverture : de la planète au module Méduse ✅ LIVRÉ (15/09)

**Livré le 15/09/2026**, les six planches en tête de `CINEMATIQUE_ESSAI`.
Mesuré par `prepare.py` à la livraison : luminance de 0,03 (la planète
seule) à 0,18 (l'arc et le hub), 0 % de pixels chauds, de 20 à 234 Ko.
La planche 3 est devenue `docs/reference/station-reference.png` : c'est
elle qui fait foi sur la station vue du dehors. Deux fournées ont été
nécessaires — la première avait une Terre, un soleil et une lune dans le
cadre, du texte peint sur la coque, un écran plat derrière le hublot ;
d'où les négatifs durcis ci-dessous, à garder tels quels.

L'OUVERTURE commence aujourd'hui **dans** la cuve (`ouverture-1.webp`,
« Module Méduse. Une cuve, une substance. »). Le concepteur veut qu'elle
commence **dehors** : la planète vue de l'espace, puis la station, de plus
en plus près, jusqu'au hublot du module Méduse — et la coupe sur la cuve.
Six planches, même famille que §11 (**1600×900**, marge de 5 % sur les
bords, aucun texte, luminance ≤ 0,50, ≤ 260 Ko), nommées
`cine/approche-1..6.webp`. Elles s'insèrent **en tête** de l'OUVERTURE
(`CINEMATIQUE_ESSAI` dans `src/game/cinematique.ts`) ; LE DÉPART, qui se
rejoue à chaque run, ne les reprend pas — on ne refait pas l'approche à
chaque lancement.

### Deux points que le canon ne tranchait pas, tranchés ici

- **La planète.** Rien dans le scénario ne nomme la Terre, et deux images
  livrées se contredisaient à moitié : `plafond-planete.webp` montre une
  **planète gazeuse** bleu-gris à bandes, le prompt de l'observatoire
  (`docs/carte-station/assets-prompts.md`) dit **« ringed planet »**. Les
  deux se réconcilient : une **géante gazeuse froide, à bandes, ceinte d'un
  anneau fin**. Pas la Terre — ni continents, ni océans, ni lumières de
  villes : la palette reste froide, et la station orbite là où un télescope
  a quelque chose à regarder.
- **La station.** Sa silhouette **est celle de la carte**
  (`src/game/carteStation.json`) — c'est la règle du scénario : « on doit
  reconnaître la station comme on reconnaît l'ISS sur une infographie ».
  De gauche à droite : l'arc de coque en croissant portant le module
  Méduse (le hub, haut et étroit), trois coursives vers trois modules
  octogonaux empilés, un nœud rond, trois petits modules dont deux se
  prolongent en capsules isolées, le grand observatoire octogonal à dôme
  vitré avec le télescope amarré, puis le mât incliné aux quatre panneaux
  solaires et à l'antenne parabolique. L'orientation ne change **jamais** :
  l'arc à gauche, le mât à droite, dans les six planches.

### Ce qui tient la station d'une planche à l'autre

Un préambule ne suffit pas (charte §6) : six générations de la même
description donnent six stations. Trois gestes, dans cet ordre :

1. **Le SOCLE ci-dessous ouvre chaque prompt, tel quel.** Il remplace le
   préambule de la charte §5 pour cette famille : une planche de
   cinématique est un cadre, pas une pièce posée à plat dans la cuve (§22
   fait déjà l'entorse avec « wide cinematic frame »). Il porte la fiche
   d'identité de la planète, de la station et de la lumière, et chaque
   planche ne dit ensuite que son cadrage.
2. **Générer la planche 3 en premier** — la station entière, le plan
   d'ensemble. Tant qu'elle n'est pas juste (les onze modules, l'arc, le
   mât, le télescope, dans le bon ordre), rien d'autre ne se génère. Quand
   elle est bonne, elle **devient la référence de la famille** :
   `docs/reference/station-reference.png` (charte §6), et les planches 4,
   5 et 6 se génèrent **avec elle en référence d'image** : Midjourney
   `--sref <planche 3>` et le même `--seed` (ou `--oref` sur la planche 3
   en v7, qui tient l'objet et pas seulement le style) ; Stable Diffusion /
   Flux : IP-Adapter sur la planche 3 (poids 0,7) et ControlNet *depth* sur
   son recadrage quand la disposition dérive ; DALL·E / GPT : joindre la
   planche 3 et demander « the same station as in the attached image, seen
   closer ».
3. **Les planches 1 et 2 en dernier.** La station y est un point ou
   absente : la cohérence ne s'y joue pas, la planète y suffit — et la
   planète se tient par le socle seul (bandes horizontales, croissant en
   haut à gauche, nuit à droite, anneau presque de profil).

Ce qui ne bouge pas non plus : **la lumière**. Une seule clé, en haut à
gauche, d'une étoile hors cadre ; un rebond bleu froid de la planète par
en dessous ; jamais de soleil dans le cadre, jamais de flare. Une planche
éclairée d'ailleurs saute à l'œil dans l'enchaînement, plus qu'un rivet de
travers.

**Les étoiles restent minuscules** (`ciel.md`, le test d'acceptation) : le
lecteur zoome dans la planche, une étoile de quarante pixels devient une
tache. **La planète reste sombre** : c'est elle qui ferait sortir la
planche du plafond de luminance de la famille — un croissant éclairé, le
reste dans la nuit.

### Le socle — à coller en tête des six prompts, tel quel

```
Retro-futuristic 1970s orbital laboratory, wide cinematic frame, 16:9,
concept-art matte painting with crisp hard-surface detail. Muted cold
palette: near-black space #030710, steel blue-grey hulls #0a1420 to
#2a3542, one thin cyan painted line #63b7e6 along every hull, amber only
on tiny indicator lamps #f2c98e. Low brightness, no text, no watermark.

THE PLANET, identical in every frame: a cold gas giant, pale blue-grey
cloud bands running horizontally with faint darker storm streaks, a thin
flat ring seen almost edge-on and tilted slightly down to the right; the
planet mostly in shadow, a soft crescent lit from the upper left, its
night side to the right. Not Earth: no continents, no oceans, no city
lights.

THE STATION, identical in every frame, the same layout as the game's map:
a Skylab-era modular laboratory of dark riveted steel plates with weld
seams and worn paint. From left to right: a large crescent-shaped hull
arc with an elongated vertical module docked on its inner side (the
Méduse hub, the tallest module, one round lit porthole); three straight
corridors leaving the hub to the right toward three stacked octagonal
modules; the three corridors converging into a small round junction
node; from the node, three short corridors to three small octagonal
modules, the upper and lower ones each extending to one more isolated
dead-end pod; the middle one leading to a LARGE octagonal observatory
module topped with a glass dome; a Hubble-like space telescope tube
docked to the observatory by a short bent tube; and at the far right a
long tilted truss boom carrying four gridded solar panels and a
parabolic dish. Tiny amber lamps at the docking rings, a few cold white
portholes, no other light on the station.

THE LIGHT, identical in every frame: one key light from the upper left,
from a star outside the frame; a faint cool blue bounce from the planet
below; stars very small and sparse; no sun in frame, no lens flare, no
bloom.
```

Négatif commun de la famille (remplace le négatif commun de la charte) :

```
Earth, continents, oceans, city lights, sun in frame, lens flare, bloom,
bokeh, depth of field, blur, film grain, vignette, warm colors, bright
lighting, people, astronaut, rocket, text, logo, flag, watermark, border,
frame, sleek white sci-fi, holograms, neon
```

Chez Midjourney : `--ar 16:9 --style raw`, et le même `--seed` sur les six.
Générer au moins en 1600 de large ; `prepare.py` livre à 1600×900 et mesure.

### 26a. `approche-1.webp` — la planète, seule
```
[SOCLE §26]
Deep space. The planet is small, about one fifth of the frame width,
placed on the left third of the frame, a thin lit crescent on its
upper-left edge, the ring a fine line across it. Around it only the
near-black void and sparse pinpoint stars. Nothing else: no station
visible at this distance. Vast, silent, cold.
```
Négatif : négatif §26 + `station, spaceship, large stars, nebula`

### 26b. `approche-2.webp` — le limbe, et un point
```
[SOCLE §26]
Closer: the planet now fills the left two thirds of the frame, its
horizontal cloud bands readable, the ring cutting the frame as a thin
bright line. Just above the lit limb, against the black void, ONE tiny
bright speck with a barely visible cyan glint: the station, at orbital
distance, too far to have a shape. The right third of the frame is the
void and a few faint stars.
```
Négatif : négatif §26 + `recognizable station shape, large stars, nebula`

### 26c. `approche-3.webp` — la station entière — LA RÉFÉRENCE, à générer en premier
```
[SOCLE §26]
Establishing shot of the whole station in orbit, centered, spanning
about half of the frame width, seen from a slightly high three-quarter
angle so that every module and corridor of the layout is readable at
once, like an infographic silhouette: the crescent arc and the tall
Méduse hub on the left, the three stacked modules, the round node, the
small pods, the domed observatory with the telescope docked, the tilted
solar boom and the dish on the right. Behind it the planet's cloud bands
fill the lower two thirds of the frame, the black void and the ring line
above. The station is lit from the upper left, its shadowed side faintly
blue from the planet. Nothing else in frame.
```
Négatif : négatif §26 + `second station, extra modules, symmetrical
station, ISS, large stars`

Vérifier avant d'aller plus loin : onze modules, l'arc à gauche, le mât à
droite, le dôme et le télescope à l'avant-dernier rang, un seul hub haut.
Un module de trop ou un mât à gauche se reproduira sur les trois planches
suivantes.

### 26d. `approche-4.webp` — plus près, les modules
```
[SOCLE §26]
Closer, in the exact layout of the attached reference: the station
overflows the frame. In the foreground on the left, the crescent hull
arc and the tall Méduse hub fill the height of the frame, riveted
plates, weld seams, worn paint, cable trays, the round porthole lit cold
white; the three corridors run into the depth of the frame toward the
stacked modules and the round node; further back the domed observatory
and the telescope tube; the solar boom and the dish small at the far
right edge. The planet's cloud bands fill the whole background, the ring
crossing the top of the frame. Same light, same station.
```
Négatif : négatif §26 + `extra modules, large stars, planet visible as a
whole disc`

### 26e. `approche-5.webp` — le module Méduse
```
[SOCLE §26]
Close on the Méduse hub alone, the same module as in the attached
reference, filling the frame: the elongated octagonal module docked on
the inner side of the crescent arc, its hull a wall of dark riveted
steel plates with weld seams, chipped paint, flanged pipes and cable
trays running along it, the single thin cyan painted line, a docking
ring with a row of tiny amber lamps, and at the center of the frame ONE
round porthole with thin cross mullions lit cold white #d6e8f5 from
inside. The arc's ribs recede on the left, one corridor leaves on the
right. Only a sliver of the planet's cloud bands at the bottom of the
frame, the void above.
```
Négatif : négatif §26 + `whole station, planet as a disc, large stars,
many windows`

### 26f. `approche-6.webp` — le hublot, et la coupe sur la cuve
```
[SOCLE §26]
The porthole of the Méduse hub fills the frame: a heavy round steel
frame with bolts, thin cross mullions, glass frosted at the rim and
beaded with condensation. Through the glass, deep inside a dark
laboratory, the pale cyan glow #63b7e6 of a tall glass containment
cylinder, and in it a small translucent shape floating in liquid — a
hint, not a scene, the rest of the room lost in shadow. The dark hull
plates around the frame, one tiny amber lamp beside it.
```
Négatif : négatif §26 + `people, faces, hands, readable screens, bright
interior`

Le hublot reprend celui de `plafond-planete.webp` (cadre rond, croisillon
fin) et la cuve est celle d'`ouverture-1.webp` : le cylindre de verre et la
lueur cyan. C'est le raccord — la planche suivante est l'intérieur de ce
qu'on vient de voir par la vitre.

### Le montage, pour la table (une proposition, pas un prompt)

Toutes **muettes** : la première réplique de l'ouverture, « Module Méduse.
Une cuve, une substance. », tombe sur la cuve, juste après le hublot, et
c'est là qu'elle porte. Le lecteur zoome dans chaque planche : six
zooms enchaînés font un seul travelling.

| planche | effet | durée | fondu |
| --- | --- | --- | --- |
| `approche-1` | zoom-avant | 6 s | noir |
| `approche-2` | zoom-avant | 5 s | aucun |
| `approche-3` | pan-droite | 6 s | aucun |
| `approche-4` | zoom-avant | 5 s | aucun |
| `approche-5` | zoom-avant | 4,5 s | aucun |
| `approche-6` | zoom-avant | 4 s | aucun |

`ouverture-1` garde son fondu au noir : la coupe du hublot à la cuve passe
par le noir. La piste (silence, ou `cuve-tiede` avancée de six planches)
se règle à la table de montage. Comme les autres planches, celles-ci ne se
chargent qu'à la lecture de la cinématique.

---

## 27. LA CONDUITE D'AMMONIAC — l'atlas de la plaque froide ✅ LIVRÉ (24/09)
**`conduite-atlas.webp` · 1024² · RGBA · assemblé par `tools/images/conduite_atlas.py`**

La plaque froide est une conduite d'ammoniac à −40 °C : un tuyau d'acier
sombre poli, givré sur ses deux bords, des brides boulonnées aux bouts et
aux joints. Quatre images générées, réunies en **un seul atlas** (le shader
de composition n'a plus d'unité de texture libre) : il remplace
`froid.webp`. La référence de style est `docs/reference/conduite-reference.webp`
(la « version 2 » de la planche d'exploration) — joignez-la à chaque
génération (`--sref` sur Midjourney, image jointe sur ChatGPT / DALL·E).

**Les sources** vont dans `masters/images/sources/` (non versionné) :
`conduite-troncon.png`, `conduite-traversee.png`, `conduite-raccords.png`,
`conduite-givre.png`. Puis :

```bash
python3 tools/images/conduite_atlas.py        # → masters/images/conduite-atlas.png
python3 tools/images/prepare.py conduite-atlas
```

**Une nouvelle image impose de REMESURER.** Les recadrages du script et les
proportions de `CONDUITE` (`src/game/formes.ts` : la bride fait toute la
largeur du bloc, le tuyau un peu plus de la moitié, etc.) sont mesurés sur
CES images ; la physique et le shader les lisent tels quels.

Chaque prompt tient en un bloc (préambule de la charte compris). Sur
Midjourney, remplacez « Avoid: » par `--no` et ajoutez les paramètres
indiqués.

### 27.1 Le tronçon (le corps, répété en miroir) · 2048×512

```
Retro-futuristic 1970s orbital laboratory, flat orthographic 2D game asset. Muted cold palette: near-black #030710, steel blue-grey #0a1420 to #2a3542, single cyan accent #63b7e6. Evenly lit from above, low brightness, no visible light source. Seamless horizontally tileable texture strip of a single frozen ammonia pipe seen from directly above, lying horizontally and filling the full height of the image edge to edge, left and right edges match perfectly. Dark polished gunmetal steel (#141c26 to #2a3542), glossy, with one long crisp cold specular highlight along the upper third and a faint cyan reflection on the lower third. Thick white hoarfrost (#d6e8f5) clings only along both long edges of the pipe: an irregular crystalline fringe with needle crystals, and small icicles hanging from the lower edge. The centre of the pipe stays bare, clean and shiny. Subtle weld seam, a few ice sparkles. In the exact style of the attached reference. No flanges, no bolts, no joints, no background above or below the pipe. Avoid: perspective, 3/4 view, isometric, side view, depth of field, blur, film grain, lens flare, vignette, bright lighting, warm colors, text, logo, watermark, border, frame, drop shadow, pipe fully covered in snow, white pipe, translucent ice sleeve, insulation cladding, aluminium foil.
```
*Midjourney : `--ar 4:1 --tile --style raw --sref <référence>`*

### 27.2 La traversée de sol — le bout libre (détourée) · 2:1

Le tuyau passe une bride, puis plonge par un coude dans une plaque boulonnée au
plancher : il a une ARRIVÉE (un bout contre un mur, lui, plonge dans le mur, sans
pièce — `conduite.ts`). **La plaque doit être centrée sur l'axe du tuyau** : une
première génération, plaque décalée vers le bas, ne se posait pas sur un bloc
dont le tuyau suit l'axe. Mesures de l'image livrée : plaque 677 px (= la largeur
du bloc), bride ≈ 0,70 de cette largeur, tuyau 0,41 — la bride cache le passage
au tronçon, plus gros, comme un réducteur.

```
Retro-futuristic 1970s orbital laboratory, flat orthographic 2D game asset. Muted cold palette: near-black #030710, steel blue-grey #0a1420 to #2a3542, single cyan accent #63b7e6. Evenly lit from above, low brightness, no visible light source. Single sprite on a transparent background, STRICT TOP-DOWN orthographic view looking straight down at the floor, in the exact style of the attached reference: a dark polished gunmetal steel pipe lying on the floor, coming from the left edge of the image, with a bolted flange joint on the pipe just before the plate, and on the right it bends 90 degrees DOWNWARD and disappears into the floor through a square riveted steel floor plate. The plate and its hole are CENTRED ON THE PIPE AXIS: the pipe goes straight ahead into the hole without curving sideways, the hole's centre is exactly on the pipe's centre line, and the plate extends equally above and below the pipe. Seen from directly above, the bend is a rounded pipe end whose top surface darkens as it curves down, sinking into a round black hole in the plate; a thin bolted collar ring lies FLAT on the plate around the hole, seen as a perfect circle, not an ellipse. The square plate is only about 1.8 times the pipe diameter, bolted at its four corners, lying flat. White hoarfrost (#d6e8f5) crusts the collar and the rim of the hole, a little frost on the plate edges, small icicles along the pipe's lower edge; the rest is bare glossy steel with a cold specular highlight. Pipe centred vertically in the image, the whole plate inside the image, clean edges, isolated on transparent background. Avoid: perspective, 3/4 view, isometric, side view, wall, elliptical ring, pipe entering horizontally, pipe curving sideways, off-centre plate, depth of field, blur, film grain, lens flare, vignette, bright lighting, warm colors, text, logo, watermark, border, frame, drop shadow, pipe fully covered in snow, white pipe.
```
*Midjourney : `--ar 2:1 --style raw --sref <référence>`, puis détourage. Source :
`masters/images/sources/conduite-traversee.png`.*

### 27.3 Les raccords (planche détourée : le joint sert aux joints et aux plots) · 2048×1024

```
Retro-futuristic 1970s orbital laboratory, flat orthographic 2D game asset. Muted cold palette: near-black #030710, steel blue-grey #0a1420 to #2a3542, single cyan accent #63b7e6. Evenly lit from above, low brightness, no visible light source. Sprite sheet on a transparent background, top-down orthographic view, same pipe diameter and exact style as the attached reference: dark polished gunmetal steel with a long cold specular highlight, white hoarfrost fringe (#d6e8f5) and small icicles along the edges. Pieces: (1) a bolted flange joint in the middle of a pipe, two flanges face to face with hex nuts, (2) a 90-degree elbow, (3) a T-junction, (4) a pipe clamp saddle with two bolts and a small base plate, (5) a gate valve with a round pale steel handwheel. Rime on bolts, rims and outer curves, the rest bare glossy steel. Pieces evenly spaced, not touching, clean edges, isolated on transparent background. Avoid: perspective, 3/4 view, isometric, side view, depth of field, blur, film grain, lens flare, vignette, bright lighting, warm colors, text, logo, watermark, border, frame, drop shadow, background, floor, pipe fully covered in snow, white pipe.
```
*Midjourney : `--ar 2:1 --style raw --sref <référence>`, puis détourage. Seule la pièce (1) est
utilisée à ce jour ; le coude, le T, le collier et la vanne attendent dans la source.*

### 27.4 Le givre du sol (l'aire d'effet) · 1024×1024

```
Retro-futuristic 1970s orbital laboratory, flat orthographic 2D game asset. Muted cold palette: near-black #030710, steel blue-grey #0a1420 to #2a3542, single cyan accent #63b7e6. Evenly lit from above, low brightness, no visible light source. Seamless tileable transparent overlay of light frost on a flat floor, seen from directly above, matching the floor frost of the attached reference: sparse powdery rime patches (#d6e8f5), thin cold mist stains, a few small needle crystals with faint cyan glints, mostly transparent and delicate, overlay only, no floor visible, no background. Avoid: perspective, depth of field, blur, film grain, lens flare, vignette, bright lighting, warm colors, text, logo, watermark, border, frame, solid background, snow drifts, thick ice.
```
*Midjourney : `--ar 1:1 --tile --style raw --sref <référence>`. L'image livrée garde des
franges violettes : le shader n'en lit que la clarté, teintée en blanc bleuté.*

## 28. LE MATÉRIEL DE COQUE, VU DE DESSUS — une image par pièce

Le décor posé AU-DEHORS de la cuve, **vu de dessus** comme la salle. Une image par pièce,
chacune avec son prompt complet : une planche de huit (25/09) donnait des pièces trop
petites et trop vite faites. La composition (qui va où, à quelle taille) est écrite par le
moteur (`compositionCoque.ts`) : chaque image ne fournit qu'UNE pièce.

**Convention commune** : fond transparent ; la COQUE est toujours au bord BAS de l'image —
la pièce part de là vers le haut (le dehors). Soleil en haut à gauche pour toutes : c'est
ce qui les fera tenir ensemble. Conseil : générez l'aile en premier, puis passez-la en
référence de style au générateur pour les suivantes.

Dépôt : `masters/images/coque/<nom>.png`, puis `python3 tools/images/materiel.py`.

### 28.1 aile solaire — `coque/aile.png` · 16:9 (paysage)

Cadrage : l'aile couchée sur toute la largeur ; son pied (le cardan) au milieu du bord BAS.

```
Retro-futuristic 1970s orbital laboratory hardware, NASA/ISS-inspired, realistic worn industrial detail: riveted steel, weld seams, scuffed paint, bolts, small stencilled hazard markings. Muted cold palette: steel blue-grey #0a1420 to #2a3542, off-white quilted thermal blankets, a single cyan accent #63b7e6, amber only on tiny indicator lamps. STRICT TOP-DOWN ORTHOGRAPHIC VIEW, seen from directly above like a floor plan or a satellite photo, no perspective, no 3/4 angle, no side faces visible. Hard sunlight from the upper left: lit edges catch a thin bright rim, the lower right sides fall into deep shadow. Isolated single object on a fully TRANSPARENT background, filling the frame with a small empty margin, crisp clean silhouette, high detail, 2D game asset. Subject: one solar array wing of a space station seen from directly above, lying flat, stretched across the whole width of a 16:9 landscape image. A long thin rectangle about five times wider than tall. It is made of two photovoltaic blankets, left and right, separated by a narrow central lattice mast running vertically through the middle. Each blanket: a dense grid of dark navy-blue solar cells with a faint violet sheen, fine silver interconnect lines, thin gold-anodized frame, tensioning cables at the outer ends, a few slightly misaligned cells. At the bottom centre, where it attaches, a compact rotating gimbal joint with a small amber status lamp. Avoid: side view, profile view, perspective, isometric, 3/4 view, ground, floor, cast shadow on a surface, background scenery, stars, planet, text, labels, logos, watermark, frame, border.
```

### 28.2 radiateur — `coque/radiateur.png` · 9:16 (portrait)

Cadrage : le panneau debout ; son attache au milieu du bord BAS.

```
Retro-futuristic 1970s orbital laboratory hardware, NASA/ISS-inspired, realistic worn industrial detail: riveted steel, weld seams, scuffed paint, bolts, small stencilled hazard markings. Muted cold palette: steel blue-grey #0a1420 to #2a3542, off-white quilted thermal blankets, a single cyan accent #63b7e6, amber only on tiny indicator lamps. STRICT TOP-DOWN ORTHOGRAPHIC VIEW, seen from directly above like a floor plan or a satellite photo, no perspective, no 3/4 angle, no side faces visible. Hard sunlight from the upper left: lit edges catch a thin bright rim, the lower right sides fall into deep shadow. Isolated single object on a fully TRANSPARENT background, filling the frame with a small empty margin, crisp clean silhouette, high detail, 2D game asset. Subject: one thermal radiator panel of a space station seen from directly above, lying flat, standing tall in a 9:16 portrait image: a long rectangle about three times taller than wide. Pale off-white and light grey surface divided into many thin horizontal fins, a coolant pipe running up its centre with small flanged joints, darker structural frame on the edges, faint scorch and discoloration near the base, a hinge bracket and flexible hoses at the bottom centre where it attaches to the hull. Avoid: side view, profile view, perspective, isometric, 3/4 view, ground, floor, cast shadow on a surface, background scenery, stars, planet, text, labels, logos, watermark, frame, border.
```

### 28.3 parabole — `coque/parabole.png` · 1:1 (carré)

Cadrage : le disque centré.

```
Retro-futuristic 1970s orbital laboratory hardware, NASA/ISS-inspired, realistic worn industrial detail: riveted steel, weld seams, scuffed paint, bolts, small stencilled hazard markings. Muted cold palette: steel blue-grey #0a1420 to #2a3542, off-white quilted thermal blankets, a single cyan accent #63b7e6, amber only on tiny indicator lamps. STRICT TOP-DOWN ORTHOGRAPHIC VIEW, seen from directly above like a floor plan or a satellite photo, no perspective, no 3/4 angle, no side faces visible. Hard sunlight from the upper left: lit edges catch a thin bright rim, the lower right sides fall into deep shadow. Isolated single object on a fully TRANSPARENT background, filling the frame with a small empty margin, crisp clean silhouette, high detail, 2D game asset. Subject: one parabolic communication dish of a space station seen from directly above, in a square 1:1 image. A perfect circle: the concave dish surface in matte light grey with subtle radial panel seams and eight structural ribs, the sunlight making the upper-left inner rim dark and the lower-right inner curve bright (it is a hollow bowl), a small cylindrical feed horn at the exact centre held by three thin struts, a cable running from the hub to the rim. Avoid: side view, profile view, perspective, isometric, 3/4 view, ground, floor, cast shadow on a surface, background scenery, stars, planet, text, labels, logos, watermark, frame, border.
```

### 28.4 port d'amarrage — `coque/amarrage.png` · 3:4 (portrait)

Cadrage : la collerette sur le bord BAS, le module qui monte vers le haut et s'efface.

```
Retro-futuristic 1970s orbital laboratory hardware, NASA/ISS-inspired, realistic worn industrial detail: riveted steel, weld seams, scuffed paint, bolts, small stencilled hazard markings. Muted cold palette: steel blue-grey #0a1420 to #2a3542, off-white quilted thermal blankets, a single cyan accent #63b7e6, amber only on tiny indicator lamps. STRICT TOP-DOWN ORTHOGRAPHIC VIEW, seen from directly above like a floor plan or a satellite photo, no perspective, no 3/4 angle, no side faces visible. Hard sunlight from the upper left: lit edges catch a thin bright rim, the lower right sides fall into deep shadow. Isolated single object on a fully TRANSPARENT background, filling the frame with a small empty margin, crisp clean silhouette, high detail, 2D game asset. Subject: one docking port of a space station and the first section of the neighbouring module, seen from directly above, in a 3:4 portrait image. At the bottom, a heavy square bolted docking collar with guide petals and four small green approach lights. From it, a short cylindrical pressurised module rises towards the top of the image, covered in quilted off-white thermal blankets with stitched seams, handrails in faded yellow, circumferential reinforcing rings every so often, the cylinder clearly round (lit on its upper-left side, shadowed on the right). The module simply continues out of the top edge, cut cleanly by the frame. Avoid: side view, profile view, perspective, isometric, 3/4 view, ground, floor, cast shadow on a surface, background scenery, stars, planet, text, labels, logos, watermark, frame, border.
```

### 28.5 poutre en treillis — `coque/treillis.png` · 9:16 (portrait)

Cadrage : le segment vertical, raccordable en haut et en bas.

```
Retro-futuristic 1970s orbital laboratory hardware, NASA/ISS-inspired, realistic worn industrial detail: riveted steel, weld seams, scuffed paint, bolts, small stencilled hazard markings. Muted cold palette: steel blue-grey #0a1420 to #2a3542, off-white quilted thermal blankets, a single cyan accent #63b7e6, amber only on tiny indicator lamps. STRICT TOP-DOWN ORTHOGRAPHIC VIEW, seen from directly above like a floor plan or a satellite photo, no perspective, no 3/4 angle, no side faces visible. Hard sunlight from the upper left: lit edges catch a thin bright rim, the lower right sides fall into deep shadow. Isolated single object on a fully TRANSPARENT background, filling the frame with a small empty margin, crisp clean silhouette, high detail, 2D game asset. Subject: one straight segment of a space station lattice truss seen from directly above, running vertically through a 9:16 portrait image from the bottom edge to the top edge. Two parallel square steel rails on the left and right, triangular diagonal bracing between them, bolted gusset plates at each node, a bundle of cables and a thin coolant line running along the middle, a small yellow handrail on one side. Both ends are cut straight and identical so the segment tiles seamlessly end to end. Avoid: side view, profile view, perspective, isometric, 3/4 view, ground, floor, cast shadow on a surface, background scenery, stars, planet, text, labels, logos, watermark, frame, border.
```

### 28.6 bloc de propulseurs — ✗ ABANDONNÉ (25/09)

Retiré de la composition : ni le tracé ni l'image générée (des tuyères
vues de face, comme des haut-parleurs) ne tenaient à côté des pièces
peintes.

### 28.7 feu de navigation — ✗ PAS D'IMAGE (25/09)

Gardé TRACÉ par le moteur : à 28 u, quelques pixels au dézoom, aucun
détail peint ne se verrait — c'est son halo coloré qui se lit. Une
image générée (une lanterne grillagée de quai) a été écartée.

### 28.8 embase — `coque/embase.png` · 2:1 (paysage)

Cadrage : la platine sur toute la largeur ; la douille (où entre le bras) au milieu, vers le HAUT ; le bord bas touche la coque.

*Aujourd'hui tracée par le moteur : l'image la remplacera si elle tient mieux à côté des pièces peintes.*

```
Retro-futuristic 1970s orbital laboratory hardware, NASA/ISS-inspired, realistic worn industrial detail: riveted steel, weld seams, scuffed paint, bolts, small stencilled hazard markings. Muted cold palette: steel blue-grey #0a1420 to #2a3542, off-white quilted thermal blankets, a single cyan accent #63b7e6, amber only on tiny indicator lamps. STRICT TOP-DOWN ORTHOGRAPHIC VIEW, seen from directly above like a floor plan or a satellite photo, no perspective, no 3/4 angle, no side faces visible. Hard sunlight from the upper left: lit edges catch a thin bright rim, the lower right sides fall into deep shadow. Isolated single object on a fully TRANSPARENT background, filling the frame with a small empty margin, crisp clean silhouette, high detail, 2D game asset. Subject: one heavy bolted mounting base that fixes an external structure onto the hull of a space station, seen from directly above, in a 2:1 landscape image. A wide rectangular steel plate with chamfered corners and two rows of large hex bolts, a raised square flange socket in the middle where a lattice arm plugs in, two diagonal bracing struts rising from the plate corners towards the socket, a bundle of cables leaving the socket and disappearing into a small hatch on the plate, a thin yellow-black hazard stripe along the bottom edge. The bottom edge of the image is where the plate meets the hull. Avoid: side view, profile view, perspective, isometric, 3/4 view, ground, floor, cast shadow on a surface, background scenery, stars, planet, text, labels, logos, watermark, frame, border.
```

## 29. LA BANDE DE COQUE — `hull.webp` (refonte, 25/09)

La paroi de la cuve, vue de dessus : c'est elle qu'on voit le plus, et la
bande livrée (un aplat métallique répété) restait la partie la plus pauvre
de l'image. **Une seule image, qui se répète** le long des quatre côtés.

**Sens à respecter** : le bord **BAS** de l'image est le côté SALLE (le
trait lumineux cyan), le bord **HAUT** est le DEHORS (la peau du module).
Le moteur lit la longueur d'une répétition dans le rapport de l'image :
elle n'est jamais étirée.

Livraison : `masters/images/hull.png`, puis `python3 tools/images/prepare.py hull`
(raccord gauche-droite mesuré, luminance ≤ 0,25, ≤ 120 Ko).

```
Retro-futuristic 1970s orbital laboratory hardware, NASA/ISS-inspired, realistic worn industrial detail: riveted steel, weld seams, scuffed paint, bolts, small stencilled hazard markings. Muted cold palette: steel blue-grey #0a1420 to #2a3542, off-white quilted thermal blankets, a single cyan accent #63b7e6, amber only on tiny indicator lamps. STRICT TOP-DOWN ORTHOGRAPHIC VIEW, seen from directly above like a floor plan, no perspective, no side faces visible. Hard sunlight from the upper left. Subject: a long horizontal strip, 3:1 landscape, SEAMLESSLY TILEABLE LEFT-RIGHT (the left and right edges must match perfectly), showing the thick hull wall of a space station module seen from above, like the top of a wall on an architectural plan. From bottom to top: along the BOTTOM edge, the inner face of the wall with one thin continuous glowing cyan light strip (#63b7e6); then the body of the wall, heavy structural steel: bolted armour plates of varied lengths, a recessed channel carrying two or three pipes and cable bundles with clamps, reinforcing ribs crossing the wall every so often, a small maintenance hatch, faded stencilled markings; along the TOP edge, the outer skin of the module: a narrow band of off-white quilted thermal blanket held by a thin riveted metal rim. Overall dark and low-contrast (average brightness around 20 %), so that the lit room inside stays the brightest thing. Fills the whole image, no margin, no transparency. Avoid: perspective, 3/4 view, side view, vanishing point, seams at the left and right edges, bright colours, text, labels, logos, watermark, frame, border.
```

## 30. LA CHAUDIÈRE — l'atlas de la rampe de résistances ✅ LIVRÉ (26/09)
**`chaudiere-atlas.webp` · 1024² · RGBA · assemblé par `tools/images/chaudiere_atlas.py`**

Le même travail que la conduite d'ammoniac (§27), pour la chaudière : le
rectangle à rayures devient une **rampe de résistances à ailettes** dont les
barreaux rougeoient, fermée d'un capot, alimentée par un boîtier dont le câble
plonge dans le sol. Le dessin suit la place (`CHAUDIERE`, `game/formes.ts`) :

| rapport L / T | dessin |
| --- | --- |
| moins de 1,6 | la **compacte** ronde à hublot (le **brûleur** carré sous 80 u) |
| jusqu'à 3,26 | la **rampe courte**, fermée de deux capots |
| au-delà | la **rampe longue** : UNE arrivée de courant (boîtier, câble, plaque) au bout positif, un capot à l'autre — un bout contre un mur y plonge, le courant vient du mur |

La collision suit le dessin, comme pour la conduite : l'union des pièces, et
la compacte est un disque. Dans l'aire de chaleur, le sol roussit par
**tampons** (les îlots de la source, posés tels quels). Les barreaux de
l'image respirent : une onde lente parcourt la rampe.

**La référence de style** est `docs/reference/chaudiere-reference.webp` (la
traversée livrée) ; joignez aussi `conduite-reference.webp` pour l'acier.
**L'ambre y est permis sur ce qui chauffe, et là seulement** : barreaux,
hublot, voyant (charte §3 — la famille admet 25 % de pixels chauds ; l'atlas
en mesure 24 %).

**Les sources** vont dans `masters/images/sources/` (non versionné) :
`chaudiere-troncon.png`, `chaudiere-traversee.png`, `chaudiere-raccords.png`,
`chaudiere-compacte.png`, `chaudiere-sol.png`. Puis :

```bash
python3 tools/images/chaudiere_atlas.py        # → masters/images/chaudiere-atlas.png
python3 tools/images/prepare.py chaudiere-atlas
```

**Une nouvelle image impose de REMESURER** les recadrages du script et les
proportions de `CHAUDIERE` — la physique et le shader les lisent tels quels.

### 30.1 Le tronçon (le carter, répété) · 3:1

Livré : 2172×724, raccord gauche-droite invisible (écart 14 aux bords, 13
entre colonnes voisines) — il se répète SANS miroir. Le script coupe la
bande de fond ajoutée au-dessus et au-dessous des rails.

```
Retro-futuristic 1970s orbital laboratory, flat orthographic 2D game asset. Muted cold palette: near-black #030710, steel blue-grey #0a1420 to #2a3542, single cyan accent #63b7e6; amber heat glow (#f2c98e, #e8951f, #c96f14) allowed ONLY on the heating elements themselves. Evenly lit from above, low brightness, no visible light source. Seamless horizontally tileable texture strip of an industrial electric heater bank seen from directly above, lying horizontally and filling the full height of the image edge to edge, left and right edges match perfectly. A long dark gunmetal steel housing (#141c26 to #2a3542) with two thick rails along its long edges, and between them a dense row of parallel cooling fins running across the strip, evenly spaced like a radiator. Deep in the gaps between the fins, heating rods glow a smouldering amber-orange, brightest at the centre line and fading to dark toward both rails, as if seen through the fins. The fin tips stay dark steel with a thin cold specular highlight; the rails have small rivets and a faint heat-tint discoloration (straw and bluish oxidation) near the glow. Subtle soot. In the exact steel style of the attached reference. No flanges, no bolts at the ends, no joints, no background above or below the housing. Avoid: perspective, 3/4 view, isometric, side view, depth of field, blur, film grain, lens flare, vignette, bright lighting, open flames, fire, lava, orange steel, red everywhere, glowing housing, text, logo, watermark, border, frame, drop shadow.
```
*Midjourney : `--ar 4:1 --tile --style raw --sref <référence>`*

### 30.2 La traversée — l'arrivée de courant (détourée) · 3:1

**Tout sur l'axe** : la première génération posait la plaque SOUS le boîtier,
le câble filant vers le bas de l'image — en vue de dessus, sur le côté au lieu
de plonger. Mesures de l'image livrée : rampe centrée à y 401, boîtier 397,
plaque 399 ; carter 613 px = 81 % du bloc.

```
Retro-futuristic 1970s orbital laboratory, flat orthographic 2D game asset. Muted cold palette: near-black #030710, steel blue-grey #0a1420 to #2a3542, single cyan accent #63b7e6; amber (#e8951f) allowed ONLY on one small indicator lamp and a faint glow between the last fins. Evenly lit from above, low brightness, no visible light source. Single sprite on a transparent background, STRICT TOP-DOWN orthographic view looking straight down at the floor, in the exact style of the attached reference. Everything lies on ONE HORIZONTAL LINE through the vertical centre of the image, left to right: (1) the end of a finned electric heater bank entering from the left edge, closed by a bolted steel end cap; (2) directly to its right, touching it, a squat square electrical junction box with four corner screws, one small round amber indicator lamp and a thin cyan trim line; (3) directly to the right of the box, a square riveted steel floor plate with a round black hole in its centre, where a short ribbed armoured cable coming out of the box's right side plunges straight DOWN INTO THE FLOOR — seen from above as a ribbed ring sinking into the dark hole, surrounded by a flat bolted collar that is a perfect circle. The cable does NOT run sideways, up or down the image: it goes from the box straight into the hole, all on the horizontal centre line. The box and the plate are both centred on that line and extend equally above and below it; the plate is about as tall as the heater housing. Whole piece inside the image, clean edges, isolated on transparent background. Avoid: perspective, 3/4 view, isometric, side view, cable running down the image, plate below the box, off-centre plate, elliptical ring, wall, glow halo, grey background, flames, fire, glowing box, text, letters, logo, watermark, border, frame, drop shadow.
```
*Midjourney : `--ar 3:1 --style raw --sref <référence>` ; joindre le tronçon livré, pour la hauteur du carter.*

### 30.3 La compacte à hublot (détourée) · 1:1

Livrée avec un boîtier et une bride qui dépassent du cercle : le script la
détoure à son cercle d'ailettes (centre 625, 582 ; rayon 575) et passe en
ambre le secteur rouge d'un manomètre (le rouge est réservé à l'alerte).

```
Retro-futuristic 1970s orbital laboratory, flat orthographic 2D game asset. Muted cold palette: near-black #030710, steel blue-grey #0a1420 to #2a3542, single cyan accent #63b7e6; amber heat glow (#f2c98e, #e8951f, #c96f14) allowed ONLY inside the porthole and in the fin gaps. Evenly lit from above, low brightness, no visible light source. Single sprite on a transparent background, STRICT TOP-DOWN orthographic view, in the exact steel style of the attached reference: a compact cylindrical boiler seen from directly above, a perfect circle of dark riveted gunmetal steel filling most of the image, ringed by short radial cooling fins all around its edge. In its centre a thick round porthole with a heavy bolted bezel, and behind the scratched heat-resistant glass a deep smouldering amber-orange glow, brighter at the centre, with faint dark shapes of heating coils inside. A thin cyan trim ring (#63b7e6) around the bezel, two small pressure-gauge dials and a pipe stub on the rim, heat-tint discoloration (straw to bluish) on the steel nearest the porthole, light soot. Everything except the porthole and fin gaps stays cold dark steel. Centred, whole piece inside the image with a clear transparent margin, clean edges, isolated on transparent background. Avoid: perspective, 3/4 view, isometric, side view, cylinder seen from the side, elliptical porthole, open flames, fire coming out, lava, orange steel, glowing body, depth of field, blur, film grain, lens flare, vignette, bright lighting, text, letters, logo, watermark, border, frame, drop shadow, background, floor.
```
*Midjourney : `--ar 1:1 --style raw --sref <référence>`, puis détourage.*

### 30.4 Les raccords (planche détourée) · 3:1

Le joint (les longues rampes, tous les 320 u), le brûleur (les compactes sous
80 u) ; le collier attend dans la source.

```
Retro-futuristic 1970s orbital laboratory, flat orthographic 2D game asset. Muted cold palette: near-black #030710, steel blue-grey #0a1420 to #2a3542, single cyan accent #63b7e6; amber heat glow (#e8951f, #c96f14) allowed ONLY between fins and inside burners. Evenly lit from above, low brightness, no visible light source. Sprite sheet on a transparent background, STRICT TOP-DOWN orthographic view, same width as a finned heater bank and exact steel style of the attached reference: dark gunmetal steel, thin cold specular highlights, light soot and straw-to-blue heat tint near hot parts. Pieces: (1) a bolted joint between two heater bank sections, two thick flanges face to face with hex nuts across the full width, fins stopping on each side, a faint amber glow just leaking from the gaps; (2) a small square electric burner seen from above, a round perforated grille over a glowing amber coil, four corner bolts; (3) a mounting clamp saddle with two bolts and a small base plate. Pieces evenly spaced, not touching, clean edges, isolated on transparent background. Avoid: perspective, 3/4 view, isometric, side view, open flames, fire, lava, orange steel, glowing metal body, depth of field, blur, film grain, lens flare, vignette, bright lighting, text, letters, logo, watermark, border, frame, drop shadow, background, floor.
```
*Midjourney : `--ar 2:1 --style raw --sref <référence>`, puis détourage.*

### 30.5 Le sol chauffé — des tampons (détourés) · 2:1

Demandé tuilable, livré en îlots séparés : ils servent de **tampons**, posés
en miroir tous les 520 × 260 u dans l'aire de chaleur, à faible force (à
pleine force, ils se lisaient en taches de boue). Leurs franges rouges et
jaunes sous l'alpha nul (16 331 pixels) sont effacées par le saignement du
script.

```
Retro-futuristic 1970s orbital laboratory, flat orthographic 2D game asset. Muted cold palette: near-black #030710, steel blue-grey #0a1420 to #2a3542, single cyan accent #63b7e6. Evenly lit from above, low brightness, no visible light source. Seamless tileable transparent overlay of heat damage on a flat steel floor, seen from directly above: soft soot smudges, irregular heat-tint oxidation stains on metal in straw, bronze and bluish-purple rings like tempered steel, a few fine dry cracks and flaked paint specks, sparse and uneven, mostly transparent and subtle, overlay only, no floor visible, no background. Avoid: perspective, depth of field, blur, film grain, lens flare, vignette, bright lighting, glowing embers, flames, fire, lava, red glow, text, logo, watermark, border, frame, solid background, burnt holes.
```
*Midjourney : `--ar 1:1 --tile --style raw --sref <référence>`.*
