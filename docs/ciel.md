# La plaque de ciel — remplacer le fond du vide

Le fond du vide, derrière la station, a trois formes (PARAMÈTRES › **LE CIEL DU
DEHORS**) :

| mode | ce que c'est | ce que ça coûte |
|---|---|---|
| **PLAQUE** (défaut) | une image de 4096 × 4096 — `public/assets/ciel.webp` | ~1 Mo au téléchargement, ~90 Mo de mémoire graphique |
| **TUILE** | l'ancien fond : deux petites textures répétées | ~0,1 Mo |
| **PROCÉDURAL** | rien à charger, le vide est entièrement calculé | zéro |

La plaque **ne se télécharge qu'à son premier affichage**. Qui la coupe ne la
paie jamais.

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
c = min(im.size)                        # carré centré : le jeu répète la plaque
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

**Pourquoi 4096 et pas 16 384.** Une texture coûte en mémoire graphique
`côté² × 4` octets, plus un tiers pour ses niveaux de détail : 4096 → ~90 Mo,
8192 → ~360 Mo, 16 384 → ~1,4 Go. Sur tablette, la troisième ligne ne se charge
pas. Et le jeu montre environ **un texel par pixel d'écran** au cadrage du hub :
au-delà de 4096, la finesse supplémentaire ne s'affiche jamais.

**Pourquoi un carré.** La plaque se répète (`REPEAT`) : c'est ce qui permet au
monde de s'élargir sans qu'on tombe sur un bord. Une image carrée se répète
proprement dans les deux sens.

**Si la couture se voit.** Une photographie n'est pas raccordable : ses bords ne
coïncident pas. Deux réponses, au choix — pousser l'**étendue** au banc pour que
la répétition tombe hors du tableau (le hub fait 4500 unités ; à 12 000, on n'en
traverse jamais un tiers), ou raccorder l'image dans un logiciel d'image avant
de la convertir.

### 5. Régler

BANC › **Ciel du dehors**, en jeu, à vue :

- **force** — le dosage. Le défaut est 0,45, et ce n'est pas timide : à 1, le
  vide écrase la station, les modules deviennent des découpes plates et la
  hiérarchie lumineuse s'inverse. Montez par petits pas, en regardant la cuve.
- **étendue (u)** — combien d'unités-monde la plaque couvre. Plus petite : le
  ciel est plus net et défile plus vite. Plus grande : plus doux, presque
  immobile. Un tableau fait 2400 unités, le hub 4500.

---

## La plaque livrée avec le jeu

`public/assets/ciel.webp` n'est **pas une photographie** : elle est fabriquée
par `tools/ciel/genere-ciel.py`, qui imite un champ profond — fond noir bleuté,
filaments de poussière chauds, semis d'étoiles colorées selon leur température,
et **six aigrettes** sur les plus vives (la diffraction d'un miroir hexagonal,
la signature de Webb). Elle est **périodique par construction** : ses bords se
raccordent, donc elle se répète sans couture.

```bash
python3 tools/ciel/genere-ciel.py --taille 4096 --sortie public/assets/ciel.webp
# --densite 1.4   plus d'étoiles      --nebuleuse 0.6  moins de nébulosité
# --graine 7      un autre ciel       --taille 2048    moitié moins de mémoire
```

Un outil plutôt qu'une image posée là, parce qu'une plaque se règle : sa
luminance moyenne doit rester **basse** — le script l'affiche à chaque tirage —
sans quoi le vide cesse d'être un fond.


---

## Faire générer une plaque, à défaut d'en photographier une

Un générateur d'images sait faire un ciel crédible, à condition qu'on lutte
contre ses trois réflexes : composer autour d'un sujet, éclaircir, et grossir
les étoiles. En anglais — c'est la langue où ces outils travaillent le mieux.

```
A James Webb Space Telescope deep field photograph, square format.

At least three quarters of the frame is near-black empty void — deep
indigo-black, almost no light. Scattered evenly across it, thousands of
very small pinpoint stars, one to three pixels wide, of widely varying
brightness and colour: cold white, pale blue-white, faint amber, dim
orange. Only a few dozen stars are bright, and those show sharp thin
six-pointed diffraction spikes.

Thin semi-transparent wisps and filaments of interstellar dust drift
through part of the frame — desaturated teal and muted warm ochre, low
contrast, never bright, never saturated. Dark absorbing dust lanes cut
through them. A scattering of tiny distant galaxies, only a few pixels
across, some edge-on slivers, some faint smudges.

Flat, even, documentary astrophotography. No focal point, no
composition, no centre of interest, no horizon, no up or down — the
field looks statistically the same everywhere. Scientific, calibrated,
raw sensor look, no artistic glow, no post-processing bloom.
```

Prompt négatif :

```
planet, moon, sun, spaceship, station, silhouette, horizon, ground,
star cluster, centered galaxy, spiral galaxy, bright nebula, cosmic
explosion, lens flare, bokeh, large glowing orbs, halos, vignette,
dramatic lighting, aurora, milky way band, neon pink purple,
oversaturated, painterly, illustration, digital art, concept art,
depth of field, blur, text, watermark, signature, border
```

Format **1:1**, résolution maximale. Chez Midjourney, `--ar 1:1 --style raw
--s 50` : la stylisation basse est ce qui empêche le modèle de COMPOSER une
belle image au lieu de photographier un champ.

**Variante plus colorée** — remplacer le paragraphe des poussières par :

```
A large soft nebula occupies the lower third of the frame — deep teal
and dim rust, semi-transparent, with dark absorbing lanes. It fades
completely into black before reaching any edge of the image.
```

Le « fades completely into black before reaching any edge » n'est pas
décoratif : une nébuleuse coupée par le bord fabrique une couture nette à la
répétition. Avec cette variante, descendre la **force** vers 0,3.

## Le test d'acceptation — trente secondes, un aller-retour évité

Vaut pour une photographie comme pour une image engendrée.

1. **Plisser les yeux.** Si le regard va à un endroit précis, il y a un sujet :
   derrière la station, il se lira comme une affiche accrochée au mur.
2. **Réduire à 200 pixels.** L'image doit paraître PRESQUE NOIRE, texture à
   peine perceptible. Si elle ressemble encore à un poster coloré, elle est
   trop claire et le vide cessera d'être un fond.
3. **Tourner à 180°.** Elle doit rester crédible à l'envers. S'il y a un haut
   et un bas, la répétition se verra.

Le défaut le plus probable est **des étoiles trop grosses** : le jeu montre
environ un texel par pixel d'écran, donc une étoile de quarante pixels dans
l'image fait une tache de quarante pixels en jeu.
