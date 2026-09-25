# La plaque de ciel — remplacer le fond du vide

Le fond du vide, derrière la station, a trois formes (PARAMÈTRES › **LE CIEL DU
DEHORS**) :

| mode | ce que c'est | ce que ça coûte |
|---|---|---|
| **PLAQUE** (défaut) | une image carrée — `public/assets/ciel.webp`, 1254² | ~0,4 Mo au téléchargement, ~8 Mo de mémoire graphique |
| **TUILE** | l'ancien fond : deux petites textures répétées | ~0,1 Mo |
| **PROCÉDURAL** | rien à charger, le vide est entièrement calculé | zéro |

La plaque **ne se télécharge qu'à son premier affichage**. Qui la coupe ne la
paie jamais.

**UNE image, UNE Voie lactée, jamais répétée.** La plaque était collée au
monde et répétée à l'infini : en reculant, on voyait deux ou trois bandes
parallèles. Elle est désormais cadrée par rapport à l'**écran**
(`cadrePlaque`, `src/render/parallaxe.ts`) :

- **jamais floue** : un pixel d'image ne couvre jamais plus de 1,15 pixel
  physique de l'écran (`grossMax`), quels que soient le zoom et l'écran — les
  tests le garantissent. Une image de 1254 px tient donc dans une partie
  d'un écran d'iPad, et c'est voulu : le premier réglage la montrait deux
  fois agrandie, « trop zoomée, pas nette du tout » ;
- sa **taille** voulue est 0,8 de la grande dimension de l'écran au zoom de
  jeu, un peu moins en reculant — la netteté a le dernier mot ;
- ses **bords se fondent** dans le noir, et autour ce sont les étoiles
  profondes du shader, à l'infini ;
- son centre **dérive** avec la caméra, pour que la profondeur se sente, mais
  sature avant de sortir de l'écran : on ne la perd jamais de vue ;
- au départ, la caméra regarde le **centre** de l'image : c'est là que doit
  se tenir le plus beau ;
- le recul s'arrête quand la salle entière occupe la moitié de l'écran
  (`plancher`, `src/render/camera.ts`).

**Les étoiles nettes ne sont pas dans la plaque.** Le jeu montre environ deux
texels par pixel : une étoile d'un texel y est moyennée, donc pâlie et floue.
En modes PLAQUE et PROCÉDURAL, le shader dessine par-dessus huit couches
d'étoiles au pixel près (`etoiles` dans `src/render/renderer.ts`), nettes à
tout zoom et sur tout écran, plus nombreuses là où la plaque est riche — la
bande lactée. La plaque ne porte que le fond : la lueur, le grain, les
poussières. Une plaque de télescope déposée à la place en profite aussi.

---

## Déposer une vraie plaque de télescope

**Le jeu prend l'image qu'il trouve : il n'y a pas une ligne de code à
changer.** Écrasez `public/assets/ciel.webp` et c'est fait.

### 1. Où chercher

Les quatre sites de l'ESA (Webb, Hubble, ESO, NOIRLab) tournent sur le même
outil : chaque page d'image porte un lien **« Fullsize Original »** et **la
ligne de crédit exacte, juste en dessous**. C'est un vrai avantage pratique —
on repart avec l'image ET sa mention, sans avoir à la reconstituer.

| site | ce qu'on y trouve |
|---|---|
| [esawebb.org/images](https://esawebb.org/images/) · [le Top 100](https://esawebb.org/images/archive/top100/) | Webb, côté ESA. Original en pleine taille, crédit CC BY 4.0 sur la page |
| [webbtelescope.org/images](https://webbtelescope.org/images) | Webb, côté NASA/STScI. « Download Options » → Full Res (TIFF, souvent 100–500 Mo) |
| [esahubble.org/images](https://esahubble.org/images/) · [le Top 100](https://esahubble.org/images/archive/top100/) | Hubble. Trente-cinq ans de champs profonds |
| [eso.org/public/images](https://www.eso.org/public/images/archive/top100/) | ESO, au sol. Les GRANDES panoramiques de Voie lactée |
| [noirlab.edu/public/images](https://noirlab.edu/public/images/) | NOIRLab, au sol. Champs très larges, CC BY 4.0 |
| [images.nasa.gov](https://images.nasa.gov/) | tout le fonds NASA, cherchable, domaine public |

**Les images au sol sont sous-estimées pour cet emploi.** Un champ profond de
Webb est fait de galaxies ; une panoramique de l'ESO est faite d'ÉTOILES, par
centaines de milliers, sur un fond noir, sans sujet et sans orientation — soit
exactement le cahier des charges d'un fond de jeu. Cherchez **« GigaGalaxy
Zoom »** chez l'ESO : la mosaïque de Voie lactée y dépasse le milliard de
pixels.

Mots à taper dans les moteurs de recherche de ces sites : `SMACS 0723`,
`Webb First Deep Field`, `JADES`, `Rho Ophiuchi`, `eXtreme Deep Field`,
`Ultra Deep Field`, `GOODS`, `CEERS`, `GigaGalaxy Zoom`.

### 2. Choisir la plaque

Les grandes images de Webb et de Hubble sont libres. Quelques champs qui se
prêtent bien à un fond de jeu — larges, profonds, sans sujet unique qui
capterait le regard :

| image | où | pourquoi elle marche |
|---|---|---|
| **Webb — Champ profond de SMACS 0723** | webbtelescope.org | des milliers de galaxies, presque pas de zone vide |
| **Webb — Les Piliers de la Création** | webbtelescope.org | colonnes de poussière, semis d'étoiles très dense |
| **Webb — Nébuleuse de la Tarentule (30 Doradus)** | webbtelescope.org | filaments et cavités, l'échelle est énorme |
| **Hubble — eXtreme Deep Field (XDF)** | esahubble.org | le champ le plus profond jamais fait, presque noir |
| **Hubble — Nébuleuse du Voile** | esahubble.org | des rubans fins, magnifiques en fond sombre |

Cherchez la **taille d'origine** (« Full resolution », « Original ») : ces
plaques font souvent 10 000 à 20 000 pixels de côté.

### 3. Les crédits, qui ne sont pas facultatifs

- **NASA / STScI** (webbtelescope.org, hubblesite.org) : libres d'emploi, y
  compris commercial, **avec mention de la source**.
- **ESA/Hubble et ESA/Webb** (esahubble.org, esawebb.org) : **CC BY 4.0** —
  emploi libre, **mention obligatoire**, dans la forme que la page de l'image
  donne (par exemple « ESA/Webb, NASA & CSA, A. Pagan »).

Recopiez la mention exacte de la page de l'image dans les notes de version en
livrant la plaque. Une image libre mal créditée n'est plus une image libre.

### 4. Convertir

**L'ORIGINAL N'ENTRE JAMAIS DANS LE DÉPÔT.** Les plaques de Webb en pleine
taille pèsent de cent à cinq cents mégaoctets ; le dépôt entier en fait
quatre-vingt-dix, historique compris. Un binaire commité y reste POUR TOUJOURS,
et chaque personne qui clone le paie. Le dossier `assets-src/` existe
précisément pour ça — il est ignoré par git, comme le dit `.gitignore` :
« seuls les WebP optimisés de public/assets sont versionnés ». Déposez-y
l'original, ne versionnez que le WebP.

**Le plus souvent, l'original ne sert à rien.** La cible fait 4096 px : si vous
prenez l'image ENTIÈRE, le « Large JPEG » de 4000 px proposé sur la page suffit,
et vous vous épargnez un demi-gigaoctet. L'original ne devient utile que pour
DÉCOUPER un carré dans une grande panoramique.

```bash
# fichier déjà proche de la cible (quelques dizaines de Mo)
python3 - <<'PY'
from PIL import Image
Image.MAX_IMAGE_PIXELS = None          # les plaques de Webb dépassent la garde
im = Image.open('assets-src/smacs0723.tif').convert('RGB')
c = min(im.size)                        # carré centré : le jeu attend un carré
im = im.crop(((im.width - c) // 2, (im.height - c) // 2,
              (im.width + c) // 2, (im.height + c) // 2))
im = im.resize((4096, 4096), Image.LANCZOS)
im.save('public/assets/ciel.webp', 'WEBP', quality=88, method=6)
PY
```

**Au-delà de cent mégaoctets, ne passez pas par Pillow** : il décompresse tout
en mémoire d'un bloc. Un TIFF de 14 000 × 14 000 fait 588 Mo une fois décodé, et
le redimensionnement en réclame autant — deux gigaoctets de pointe pour une
image, et un plantage sec sur une machine chargée. **libvips** est fait pour ça :
il travaille par bandes et ne monte jamais au-delà de quelques centaines de
mégaoctets, quelle que soit la taille de l'entrée.

```bash
# libvips (brew install vips · apt install libvips-tools) — le bon outil
vips thumbnail assets-src/original.tif 'public/assets/ciel.webp[Q=88]' 4096 \
     --height 4096 --crop centre

# ImageMagick, à défaut
magick assets-src/original.tif -gravity center -crop 1:1 +repage \
       -resize 4096x4096 -quality 88 public/assets/ciel.webp
```

**Mieux : `tools/ciel/prepare-plaque.py`** fait le carré, les retouches
ponctuelles (`--retouche x,y,rayon`), la désaturation (`--saturation`) et
garde la taille de la source, plafonnée à 4096. **Ne jamais agrandir** : le
jeu lit la largeur de la texture pour décider jusqu'où il peut l'afficher sans
flou — une image de 1254 px portée à 2048 lui ferait croire à un détail qui
n'existe pas, et la galaxie serait affichée 1,6 fois trop grande.

**Pourquoi 4096 et pas 16 384.** Une texture coûte en mémoire graphique
`côté² × 4` octets, plus un tiers pour ses niveaux de détail : 4096 → ~90 Mo,
8192 → ~360 Mo, 16 384 → ~1,4 Go. Sur tablette, la troisième ligne ne se charge
pas. Et le jeu montre environ **un texel par pixel d'écran** au cadrage du hub :
au-delà de 4096, la finesse supplémentaire ne s'affiche jamais.

**Pourquoi un carré.** Le cadrage compte en fraction d'image, la même dans
les deux sens : une image non carrée serait étirée. Recadrez au carré.

**Plus de couture à craindre.** La plaque n'est plus répétée : ses bords n'ont
pas à se raccorder, une photographie convient telle quelle. Ils ne se voient
qu'au recul maximal, et encore — l'écran s'arrête à un pour cent du bord.

### 5. Régler

BANC › **Ciel du dehors**, en jeu, à vue :

- **force** — le dosage. Le défaut est 0,75 pour la Voie lactée livrée : à
  0,55 son cœur et ses nébuleuses restaient ternes. Trop haut, le vide écrase
  la station et la hiérarchie lumineuse s'inverse : baissez en regardant la
  cuve.
- **taille** — la largeur de la galaxie, en fraction de l'écran, au zoom de
  jeu. Plafonnée par la netteté : sur un écran très fin, elle reste plus
  petite que demandé.

---

## La plaque livrée avec le jeu

`public/assets/ciel.webp` est une **image générée** sur le prompt ci-dessous :
le centre galactique en biais, son bulbe doré près du centre, des lanes de
poussière filamenteuses, des nébuleuses roses, une région bleue au-dessus du
cœur. Source de 1254 px, préparée ainsi (l'original est hors dépôt) :

```bash
python3 tools/ciel/prepare-plaque.py assets-src/voie-lactee.png \
    --retouche 620,495,3 --saturation 0.45
```

La saturation à 0,45 répond à « trop de couleurs » : le générateur sature.

La retouche efface un point noir que le générateur avait laissé en plein cœur
— le premier endroit où l'œil va.

**La plaque procédurale, en secours.** `tools/ciel/genere-ciel.py` fabrique une
plaque sans image source. Elle imite le centre galactique vu de l'espace
— une bande en biais, son **bulbe doré** près du centre de l'image, des lanes
de poussière étirées dans le sens de la bande, des poches d'hydrogène roses,
une région bleue et orangée au-dessus du cœur, et un étirement « asinh »
d'astrophotographe. Elle a été jugée « pas terrible » face à l'image générée :
ses poussières restent des nuages plus que des filaments.

```bash
python3 tools/ciel/genere-ciel.py --taille 4096 --sortie public/assets/ciel.webp
# --densite 1.4   plus d'étoiles      --nebuleuse 0.6  une bande plus pâle
# --graine 7      un autre ciel       --taille 2048    moitié moins de mémoire
# --etirement 10  un ciel plus clair (arc sinus hyperbolique ; défaut 6)
```


---

## Faire générer une plaque, à défaut d'en photographier une

La plaque a désormais un **sujet** : la Voie lactée, son cœur près du centre.
Le générateur doit donc composer — mais il a trois réflexes à combattre :
poser un paysage au premier plan (presque toutes les photos de Voie lactée en
ont un), grossir les étoiles, et tout saturer. En anglais, la langue où ces
outils travaillent le mieux.

```
Deep-space astrophotograph of the Milky Way galactic core, seen from orbit
with no atmosphere, square 1:1 format.

The luminous band of the Milky Way crosses the entire frame diagonally, from
the lower left corner to the upper right corner, and fills about 40 % of the
frame. The galactic bulge, a warm golden glow, sits near the centre of the
image. The band is made of countless tiny stars and dense glittering star
clouds, cut by intricate dark dust lanes that run along the band, with fine
filamentary detail and rust-brown edges. A few small pink-magenta hydrogen
nebulae along the band near the core. Above the band, one small region of
blue reflection nebula beside a golden-orange star.

Outside the band: deep black space, with a sprinkle of pinpoint stars.
All stars are pinpoint sharp, one or two pixels wide, in pale natural
colours. Natural colour balance, deep true blacks, high dynamic range,
crisp, extremely detailed.
```

Prompt négatif :

```
horizon, landscape, mountains, trees, ground, silhouette, person, planet,
moon, sun, spaceship, satellite, lens flare, bokeh, halos, big glowing
stars, diffraction spikes, light pollution, airglow, gradient sky,
spiral galaxy seen from outside, cartoon, painting, illustration, neon,
oversaturated, blur, text, watermark, signature, border, frame, vignette
```

Format **1:1**, la plus grande résolution possible. Chez Midjourney,
`--ar 1:1 --style raw`.

## Le test d'acceptation — trente secondes, un aller-retour évité

1. **Aucun premier plan.** Ni sol, ni arbre, ni horizon : c'est le premier
   défaut des générateurs, et derrière une station en orbite il n'a pas de
   sens.
2. **Le cœur au centre.** La caméra regarde le centre au départ : c'est là
   que doit se tenir le plus beau.
3. **Les étoiles fines.** Le jeu montre à peu près un texel par pixel : une
   étoile de quarante pixels dans l'image fait une tache de quarante pixels
   en jeu. Les étoiles nettes, le shader les ajoute.
4. **Du noir franc hors de la bande.** Un ciel gris ou dégradé noie la
   station ; la **force** du banc dose le reste.
