# La plaque de ciel — remplacer le fond du vide

Le fond du vide, derrière la station, a quatre formes (PARAMÈTRES › **LE CIEL DU
DEHORS**) :

| mode | ce que c'est | ce que ça coûte |
|---|---|---|
| **TERRE** (défaut) | `public/assets/terre.webp` (4096 × 2048 : le jour en RVB, les villes dans l'alpha), la planète à l'heure du joueur, vue de l'ISS ou d'un point de Lagrange | ~1 Mo au téléchargement, ~45 Mo de mémoire graphique (rendus quand on la coupe) ; par pixel de ciel, un rayon contre une sphère et une lecture de texture |
| **PLAQUE** | `public/assets/ciel.webp` (2400², une vraie photographie), peinte dans la toile, et deux couches d'étoiles procédurales | ~1,3 Mo au téléchargement, ~30 Mo de mémoire graphique (rendus quand on la coupe) ; une lecture de texture par pixel de ciel |
| **TUILE** | l'ancien fond : deux petites textures répétées | ~0,1 Mo |
| **PROCÉDURAL** | rien à charger, le vide est entièrement calculé | zéro |

La plaque **ne se télécharge qu'à son premier affichage**. Qui la coupe ne la
paie jamais.

**LE CIEL EST PEINT DANS LA TOILE** (`uCielMode` 2, `uPlaque`, dans
`src/render/renderer.ts`), comme tous les fonds. Il a vécu un temps en
**calque HTML derrière une toile transparente**, pour rester à la définition
native de l'écran quel que soit le réglage de résolution. Le compositeur le
payait à chaque image, en natif : **sur le Steam Deck, le joueur mesurait
20 im/s avec ce ciel, près de 60 en le coupant**. Retiré. **Ne pas y revenir sans mesurer sur le Deck** : une
toile transparente et des couches plein écran derrière elle ne sont pas
gratuites, même sans aucun calcul par pixel. La contrepartie assumée : aux
résolutions réduites, le ciel suit la résolution, comme le décor.

- **UNE image, UNE Voie lactée**, jamais répétée — en reculant, l'ancienne
  plaque répétée montrait deux ou trois bandes parallèles ;
- **jamais agrandie au-delà du net** : un pixel d'image ne couvre jamais plus
  de 1,15 pixel de la toile à sa densité la plus fine, plafonnée à 2
  (`grossMax`, `cadrePlaque` dans `src/render/parallaxe.ts`), quels que soient
  le zoom et l'écran — les tests le garantissent. Aux résolutions réduites,
  la toile elle-même est moins dense : le ciel y suit la résolution, comme
  tout le décor. **Une image de 1254 px tient donc dans un tiers d'écran
  d'iPad : pour une grande galaxie nette, il faut une grande image** (plus
  bas) ;
- sa **taille** voulue : 1,3 fois la grande dimension de l'écran au zoom de
  jeu (la bande déborde), un peu moins au recul — la netteté a le dernier
  mot ;
- ses **bords sont fondus** dans l'image elle-même (`--fondu`, plus bas) ;
- son centre **dérive** avec la caméra mais ne quitte jamais l'écran ;
- les **étoiles** sont les deux couches procédurales de l'ancienne plaque
  (`specks`) : elles donnent le mouvement. Pas les huit couches d'`etoiles`
  du mode procédural — elles se paient sur chaque pixel de vide ;
- le **recul** s'arrête quand la salle entière occupe le quart de l'écran
  (`plancher`, `src/render/camera.ts`).

Les trois modes sont peints dans la toile ; aucun ne passe par le compositeur.

---

## La Terre vue de l'ISS

`src/render/terre.ts` (la règle, testée) et `terre()` dans
`src/render/renderer.ts` (le shader, `uCielMode` 3, `uTerre`).

**Simulée, réglée sur l'horloge** — pas une transmission. Ce qui est VRAI :
le Soleil de l'instant (la ligne du jour et de la nuit, les saisons), la
rotation de la Terre, l'orbite de l'ISS (420 km, 51,64°, un tour en
~92,8 min, le plan qui recule de ~5° par jour). Ce qui est ARBITRAIRE : la
**phase** de l'orbite (`noeudDeg`, `latitudeArgDeg` à `epoqueMs`) — sans
éléments orbitaux frais, on ne prétend pas dire au-dessus de quel pays la
vraie station passe. Pour la caler sur la vraie, il suffirait de reporter
dans `TERRE_DEFAUTS` le nœud et l'argument de latitude d'un TLE récent (le
réseau de l'environnement de travail ne joint pas CelesTrak).

- **quatre points de vue** (PARAMÈTRES › LA TERRE, VUE DE…, `vue`) :
  - **AU-DESSUS DE CHEZ VOUS** (défaut) — un satellite fixe à l'altitude
    géostationnaire au-dessus de la région du joueur, devinée par son fuseau
    horaire (`render/lieu.ts`, sans géolocalisation) : la Terre à l'heure
    LOCALE du joueur, nuit chez lui, nuit à l'écran — et la station sous
    la même lumière ;
  - **ISS** — le regard **penché de 52°** depuis le nadir, vers l'avant : le
    sol défile vers le bas de l'écran, l'horizon courbe barre le haut ;
  - **L1 Terre–Lune** — à ~323 000 km, entre la Terre et la Lune
    (position de la Lune : l'algorithme bref de l'Astronomical Almanac,
    ~0,3°). La Terre entière, nord en haut, avec ses **phases** : pleine à
    la nouvelle Lune, nocturne à la pleine Lune ;
  - **L1 Soleil–Terre** — à 1,5 million de km, la vue du satellite DSCOVR
    (caméra EPIC) : la Terre toujours pleine, qui tourne en 24 h.
  Depuis un point de Lagrange, la Terre ferait 2° ou un demi-degré à l'œil
  nu : elle est cadrée comme au téléobjectif (`disque`, `centreX`,
  `centreY`). Le disque tient alors toute la texture à sa définition : là,
  le sol est **net** ;
- **tout ce qui ne dépend pas du pixel est cuit à l'image** (`cadreTerre`,
  une mat4) : le shader n'a qu'un rayon, un `atan`, un `asin` et une lecture ;
- **les nuages sont cuits dans l'image**, pas calculés à l'image ;
- **la couture de ±180°** est traitée par `textureGrad` (sinon : un trait
  flou d'un pôle à l'autre) ;
- les villes sont dans l'alpha **inversé** (`255 − 127 · lumière`), pour
  qu'un décodage en alpha prémultiplié n'éteigne jamais l'océan ;
- **les étoiles sont posées sur l'ÉCRAN**, pas sur le plan de jeu : plus
  loin que la Terre, elles bougent moins qu'elle — pas du tout — quand la
  caméra se déplace ou zoome ; la Terre, elle, glisse un peu (`derive`).
  Collées au jeu, elles défilaient devant une Terre immobile : la profondeur
  à l'envers. Ce sont les étoiles nettes (`etoilesCouche`), quatre couches,
  cachées par le disque — jour comme nuit ;
- **la station sous la même lumière** (`lumiereStation`, `LUMIERE_SCENE_GLSL`) :
  le Soleil qui éclaire la Terre éclaire aussi la coque — sa face plus
  claire au Soleil de face, sombre à contre-jour, l'arête dorée du côté
  d'où il vient — et la Terre la bleuit du sien, selon sa phase. Coques des
  tableaux à cuve (passe de coque) et des tableaux en modules
  (composition). Hors du ciel TERRE : inactive, le rendu d'avant au pixel
  près. Les pièces PEINTES du dehors gardent la lumière de leur image ;
- sonde : `__terre` dans la console — `__terre.decalageMin = 46` passe du
  jour à la nuit, `__terre.force` dose la luminosité.

**NETTETÉ (vue ISS).** À 420 km, un texel de 4096 px (~10 km à l'équateur) couvre plus
d'un degré sous la station : le sol proche est doux, et aucune carte
globale n'y changerait grand-chose (même la Blue Marble à 21 600 px resterait
à ~5 pixels d'écran par texel). L'horizon, lui, est net.

Refaire la texture : `tools/ciel/prepare-terre.py` (les sources et la
commande sont dans son en-tête). Images NASA Earth Observatory, Blue Marble
et Black Marble, domaine public.

---

## Déposer une vraie plaque de télescope

**C'est LA voie vers une image vraiment nette.** La netteté est bornée par
la taille de l'image : à 1254 px, la galaxie reste petite ; à 4096 px, elle
peut couvrir un écran d'iPad entier sans flou. Une vraie photographie du
centre galactique en haute définition, c'est ce que l'humanité a de plus
beau en la matière, et c'est libre (crédits ci-dessous).

**Pour me la transmettre** (l'environnement de travail ne joint ni l'ESO ni
la NASA, et une image jointe à la conversation arrive réduite) : sur GitHub,
*Releases → Draft a new release*, joindre le fichier original, publier (ou
garder en brouillon) et donner le lien. Une pièce jointe de release n'entre
PAS dans l'historique du dépôt.

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
ponctuelles (`--retouche x,y,rayon`), la désaturation (`--saturation`), le
fondu des bords (`--fondu`, 0,18 par défaut) et garde la taille de la
source, plafonnée à 4096. **Ne jamais agrandir** : le
jeu lit la largeur de l'image pour décider jusqu'où il peut l'afficher sans
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

`public/assets/ciel.webp` est une **vraie photographie** : le centre de la Voie
lactée, découpé dans **« The Milky Way Panorama »** du projet GigaGalaxy Zoom de
l'ESO — le ciel entier sur 360°, assemblé à partir de près de 1 200 clichés pris
à La Silla, Paranal et La Palma.

> **Crédit, obligatoire (CC BY 4.0) : ESO/S. Brunier.** Il est affiché dans
> PARAMÈTRES › LE CIEL DU DEHORS.

La source est le poster d'impression de l'ESO (`print_poster_0040.tif`, 11 811 ×
5 905, 87 Mo), déposé en pièce jointe de la release GitHub `ciel-source` —
hors de l'historique. Le carré de 2 400 px autour du cœur galactique :

```bash
curl -L -o assets-src/print_poster_0040.tif \
  https://github.com/JuOrga/Sujet21/releases/download/ciel-source/print_poster_0040.tif
python3 tools/ciel/prepare-plaque.py assets-src/print_poster_0040.tif --cadre 5935,2745,2400
```

Le cadre évite le titre, la légende et le logo du poster. Aucune désaturation :
ce sont les couleurs du ciel. 1,28 Mo.

**L'image générée, avant elle** (`assets-src/voie-lactee.png`, 1254 px, hors
dépôt) : belle, mais trop petite pour être à la fois grande et nette, et trop
colorée — `--retouche 620,495,3 --saturation 0.45`.

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
