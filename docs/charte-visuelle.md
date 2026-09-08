# La charte visuelle — ce que toute image du jeu partage

Les prompts de [`assets-ia.md`](assets-ia.md) répétaient chacun sa palette,
son époque et sa lumière, avec des écarts d'un prompt à l'autre : chaque
génération repartait de zéro et le style dérivait d'une image à la
suivante. Ce fichier tient **une fois** ce qui est commun. Un prompt ne le
recopie plus : il **commence par le préambule** ci-dessous, puis ne dit que
ce qui est propre à la pièce.

Ce qui se mesure est mesuré par `tools/images/prepare.py` — la chaîne des
images, qui refuse ce qui sort des seuils (voir plus bas). Ce fichier dit
le POURQUOI des seuils ; le script en est la vérité chiffrée.

---

## 1. Le monde

**Un laboratoire orbital de 1970**, vu comme une machine et pas comme un
décor de film : tôle rivée, joints de soudure, peinture usée, conduites à
brides, chemins de câbles, caillebotis. Rien de lisse, rien de « tech »
brillant, aucun hologramme, aucun écran plat : les écrans sont des tubes
bombés, les voyants des ampoules sous verre.

**La cuve est vue du DESSUS, à plat** (orthographique, sans perspective ni
fuite). Ce qui se pose dans la cuve — surfaces, décalques, luminaires —
est vu du dessus ; le plafond du reflet est vu du DESSOUS ; les
cinématiques et le sas de raccord sont des ÉLÉVATIONS de profil. Un asset
qui mélange deux points de vue ne se pose nulle part.

## 2. La lumière

**Froide, égale, venue du haut.** Pas de source visible dans l'image, pas
de projecteur, pas de halo, pas de lens flare, pas de vignettage : le
shader ajoute les lumières du tableau, une image déjà éclairée s'y
additionne et crie.

**La hiérarchie lumineuse est une règle du jeu**, pas un goût : le vide
est plus sombre que la cuve, la cuve plus sombre que le corps, et les
verrières du plafond brillent plus que tout le reste parce que ce sont
elles qui se reflètent dans l'eau. Une image trop claire pour sa place
inverse la hiérarchie et noie la scène. D'où les plafonds de luminance
moyenne, par famille, mesurés dans `prepare.py`.

## 3. La palette

Froide, désaturée, avec **une seule couleur d'accent : le cyan**. L'ambre
n'apparaît que sur les **veilleuses et voyants** (les petites lampes du
sas de raccord, la chaufferie), le vert que dans la serre, le violet que
dans le méta. Le rouge est réservé à l'alerte des cinématiques.

| rôle | teinte | où |
| --- | --- | --- |
| la nuit du dehors | `#030710` | plaque de ciel, fonds étoilés |
| l'acier des coques | `#0a1420` · `#10151c` · `#2a3542` | parois, coque, machinerie |
| le gris des pièces | `#9aa3ab` | rivets, tôle claire, caillebotis |
| l'accent cyan | `#63b7e6` | lisérés, l'iris, le trait de coque |
| le blanc froid | `#d6e8f5` | verrières et hublots du plafond |
| l'ambre des veilleuses | `#f2c98e` · `#e8951f` · `#c96f14` | voyants, chaufferie |
| le vert de la serre | `#3fd69b` · `#7fe3a8` · `#1f4a35` | cultures, gouttières |
| le violet du méta | `#b06a8f` · `#9e6bc7` | le marchand, l'alcôve, l'éclat |
| le rouge de l'alerte | `#c8524a` | cinématiques seulement |

**La règle mesurée** : la part de pixels chauds (rouge dominant, saturé)
d'une image froide reste sous 15 %. Mesuré le 08/09/2026 sur les images
livrées : les planches froides 0 %, la serre 2 à 5 %, le plafond de la
chaufferie 17 % (ambre voulu, la famille l'admet), l'éponge 52 à 75 %
(ocre par nature, exemptée). L'éponge et la planche de l'alerte sont les
exceptions écrites dans le script — pas des tolérances tacites.

## 4. Ce qui est interdit dans toute image

Perspective, profondeur de champ, flou, grain de film, texte, logo,
filigrane, personnage (hors le marchand du méta), source lumineuse
visible, ombre portée au sol pour une pièce détourée, bordure ou cadre.
Ces mots vont dans le **négatif** de tout prompt.

## 5. Le préambule des prompts — à coller en tête, tel quel

En anglais, parce que les générateurs y répondent mieux :

```
Retro-futuristic 1970s orbital laboratory, flat orthographic 2D game asset,
riveted steel panels with weld seams and worn paint, thick pipes with flanges,
cable trays, catwalk grating. Muted cold palette: near-black night #030710,
steel blue-grey #0a1420 to #2a3542, single cyan accent #63b7e6, amber only on
small indicator lamps. Evenly lit from above, low brightness, no visible light
source, no perspective, no depth of field, no text, no watermark.
```

Négatif commun :

```
perspective, depth of field, blur, film grain, lens flare, vignette, bright
lighting, warm colors, people, text, logo, watermark, border, frame, drop shadow
```

Puis la pièce : sa vue (dessus, dessous, profil), sa taille, sa
transparence, ce qu'elle représente — c'est la part propre de chaque
section d'`assets-ia.md`.

## 6. Tenir le style d'une image à l'autre

Le préambule ne suffit pas : deux générations du même prompt diffèrent.
Ce qui tient une famille ensemble, c'est **une référence de style commune**
passée au générateur, la même pour toute la famille :

- **Midjourney** : `--sref <url de la planche de référence>` et le même
  `--seed` pour toute la famille ; `--sw 200` si le style ne prend pas.
- **Stable Diffusion / Flux** : IP-Adapter avec la planche de référence
  (poids 0,6 à 0,8) ; ControlNet *canny* ou *depth* sur un croquis à plat
  quand la vue orthographique ne tient pas.
- **DALL·E / GPT** : joindre la planche de référence à la demande, et
  demander « in the exact style of the attached reference ».

La planche de référence d'une famille est une image de `docs/reference/`
(à ce jour : `sas-raccord-reference.png`, la pièce fournie par le
concepteur, qui fait foi sur le sas). Quand une image livrée sort bien,
elle **devient la référence** de sa famille : on la dépose dans
`docs/reference/` sous `<famille>-reference.png` et on la cite ici.

| famille | référence |
| --- | --- |
| sas de raccord, veilleuses ambre | `docs/reference/sas-raccord-reference.png` |
| les autres | à désigner à la prochaine image réussie |

## 7. Les familles et leurs mesures

La chaîne (`python3 tools/images/prepare.py`) prend les masters dans
`masters/images/` et livre `public/assets/` à la taille et à la qualité de
la famille. Elle **mesure** chaque image et refuse ce qui sort :

| famille | taille livrée | ce qui se mesure |
| --- | --- | --- |
| plaque de ciel | 4096² | raccord x et y, luminance ≤ 0,16 |
| fond étoilé | 1024² | raccord x et y, luminance ≤ 0,08 |
| coque | bande, côté ≤ 2048 | raccord x |
| surface répétée (parois, plaques, grille, fond de cuve) | 1024² | raccord x et y, luminance ≤ 0,32, pixels chauds ≤ 15 % |
| éponge | 1024² | raccord ; l'ocre est admis |
| iris du sas | 1024² | luminance ; l'ambre est admis à moitié |
| plafond du reflet | 1024² | luminance ≤ 0,24 (répété en miroir : pas de raccord) |
| planche de cinématique | 1600×900 | luminance ≤ 0,50, poids ≤ 260 Ko |
| décalque (pièces détourées) | côté ≤ 1600 | couche alpha exigée, bord transparent, poids ≤ 350 Ko |
| planche de vues (animation) | libre | couche alpha, poids ≤ 600 Ko |

Le sens de chaque mesure est dans l'en-tête du script. Les seuils sont
ceux que les images **réussies** respectent, relevés le jour où le script
est entré : une texture dont le raccord se voit mesure 4,6, celles qu'on
ne voit pas se répéter tiennent entre 1,0 et 2,5.

`python3 tools/images/prepare.py --audit` mesure ce qui est déjà livré :
au 08/09/2026, 52 images, 4 hors mesure (la grille et le vieux mur, dont
la couture se voit ; le fond de cuve, à la limite ; la vanne, coupée par
son cadre sur 11 % du bord).

## 8. Le mouvement

Le jeu est un fluide où tout bouge sauf le décor ; un décalque fixe posé
sur une eau vivante se lit comme un autocollant. Trois voies, de la moins
chère à la plus chère, et rien d'autre :

1. **Le shader.** Ce qui peut se calculer (caustiques, brume, pulsation,
   scintillement) se calcule : zéro téléchargement.
2. **La planche de vues.** Une seule image, les vues côte à côte dans une
   bande horizontale ; le moteur y puise la vue du moment. C'est déjà la
   forme de l'éclat de mémoire (`meta-eclat.webp`) et celle des décalques
   animés : `<sorte>-anime.webp` à côté de `<sorte>.webp`, le nombre de
   vues se déduit du rapport entre la bande et l'image fixe. Se fabrique
   par `tools/images/planche.py` depuis des vues extraites d'une vidéo
   (image-vers-vidéo depuis l'image fixe, puis `ffmpeg` pour les vues).
3. **La vidéo.** Réservée au codex : une boucle de 3 à 6 s par fiche,
   **capturée dans le jeu** (mode concepteur, bouton CAPTURER), jamais
   générée — la vraie simulation vaut mieux qu'une imitation.

Les cinématiques ne s'animent pas en vidéo : le lecteur leur donne déjà
un mouvement, et sept boucles ajouteraient environ 7 Mo au téléchargement.
