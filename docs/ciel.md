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

### 1. Choisir la plaque

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

### 2. Les crédits, qui ne sont pas facultatifs

- **NASA / STScI** (webbtelescope.org, hubblesite.org) : libres d'emploi, y
  compris commercial, **avec mention de la source**.
- **ESA/Hubble et ESA/Webb** (esahubble.org, esawebb.org) : **CC BY 4.0** —
  emploi libre, **mention obligatoire**, dans la forme que la page de l'image
  donne (par exemple « ESA/Webb, NASA & CSA, A. Pagan »).

Recopiez la mention exacte de la page de l'image dans les notes de version en
livrant la plaque. Une image libre mal créditée n'est plus une image libre.

### 3. Convertir

```bash
# depuis un TIFF/PNG d'origine, quelle que soit sa taille
python3 - <<'PY'
from PIL import Image
Image.MAX_IMAGE_PIXELS = None          # les plaques de Webb dépassent la garde
im = Image.open('smacs0723.tif').convert('RGB')
im = im.resize((4096, 4096), Image.LANCZOS)   # carré : le jeu répète la plaque
im.save('public/assets/ciel.webp', 'WEBP', quality=88, method=6)
PY
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

### 4. Régler

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
