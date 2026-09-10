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
