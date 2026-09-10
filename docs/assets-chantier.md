# Le chantier des images — l'état des lieux du 10/09/2026 et la commande

Le concepteur a du temps pour générer ; ce fichier dit **quoi, dans quel
ordre, et pourquoi**. Les prompts, eux, vivent dans
[`assets-ia.md`](assets-ia.md) (un seul endroit, la charte l'a voulu) :
chaque ligne ci-dessous renvoie à sa section. Le processus ne change pas :

1. le prompt **commence par le préambule** de [`charte-visuelle.md`](charte-visuelle.md) §5,
   avec la référence de style de sa famille (§6) ;
2. le master va dans `masters/images/` sous le nom que le jeu attend ;
3. `python3 tools/images/prepare.py <nom>` livre `public/assets/` et **mesure** ;
   ce qui sort des seuils n'est pas livré, on refait ;
4. les bandes animées passent d'abord par `tools/images/planche.py` (§17).

---

## 1. Ce que l'audit dit

`prepare.py --audit` du 10/09 : **59 images, 4 hors mesure** — et l'œil en
ajoute quatre que la mesure ne voit pas.

| image | ce qui cloche | mesuré |
| --- | --- | --- |
| `grille.webp` | la couture se voit sur les deux axes | raccord 4,6 / 4,7 (seuil 3,0) |
| `wall.webp` | la couture se voit à la verticale ; `wall-a` tient, elle | raccord 1,9 / 4,7 |
| `tank-bg.webp` | le liséré cyan ne retombe pas sur lui-même | raccord 3,2 / 1,9 |
| `decal-vanne.webp` | le tuyau file hors du cadre | bord plein 11 % |
| `iris.webp` | opaque sur fond brun, anneau vert hors charte | 33 % de pixels chauds |
| `badge.webp` | opaque sur fond brun, voulu détouré | 21 % de pixels chauds |
| `serre-rampe.webp`, `-a` | la lueur rose des barres, hors palette froide | 5 % · 2 % |
| `avaries/*` (7) | **sans famille** dans la chaîne : rien ne les mesurait | — |

Ce que l'audit **ne dit pas** et que la lecture du code ajoute :

- **le sas de raccord** (§16) est posé par le moteur à chaque jonction et
  n'a toujours pas de fichier — quatorze jonctions vides sur le hub ;
- **aucune bande animée** n'est livrée (§17) : la chaîne existe, rien n'y
  est passé ;
- **aucune vidéo du codex** n'est livrée (`public/assets/codex/`) : 32
  fiches, 32 « aperçu à venir » ;
- **six variantes de plafond** sont livrées et **aucun tableau n'en
  demande** — 1,1 Mo d'images que personne ne voit (correction de mon
  côté, pas une image à faire) ;
- **deux cinématiques** sur quatre (la révélation, le miroir) jouent sur des
  planches recyclées de l'ouverture ;
- **les stations du hub** ne sont que des plots nus dans la cuve ;
- **les emoji** tiennent encore le cycle, les cadenas de la carte et les
  trophées, alors que le méta en est sorti ;
- le **coin de coque** (§3) n'a aucun emploi dans le code : à ne pas faire.

Les sept illustrations d'avaries sont récentes et cohérentes entre elles ;
elles ont maintenant leur famille dans `prepare.py` (640×360, ≤ 120 Ko).
Elles ne suivent pas la charte de la cuve (perspective, hologrammes) et
c'est assumé : ce sont des images **d'écran**, pas des pièces de la cuve —
c'est la famille dans laquelle iront les futurs cartons (§25).

---

## 2. La commande, dans l'ordre

Une ligne = une image (ou une planche). L'ordre est celui de l'effet en jeu
par prompt ; les blocs se prennent dans l'ordre, les lignes d'un bloc dans
l'ordre qu'on veut.

### Bloc A — ce qui change le plus pour un seul prompt

| # | image | section | pourquoi d'abord |
| --- | --- | --- | --- |
| A1 | `sas-raccord.webp` | §16 | posé par le moteur à 14 jonctions, référence fournie, rien à intégrer |
| A2 | `decal-vanne.webp` (reprise) | §19 | coupée par le cadre, et c'est la première pièce à animer |
| A3 | `decal-vanne-anime.webp` | §19 | la première bande de la chaîne — depuis A2 |
| A4 | `wall.webp` (reprise) | §5 | le mur par défaut de toute cuve montre sa couture |
| A5 | `grille.webp` (reprise) | §18a | l'évent est dans les écoles et le conduit |
| A6 | `tank-bg.webp` (reprise) | §18b | sous l'eau de tous les tableaux |

### Bloc B — les manques déjà spécifiés

| # | image | section | note |
| --- | --- | --- | --- |
| B1 | `iris.webp` (reprise) | §4 | après A1, avec le sas en référence |
| B2 | `serre-roquette.webp` | §14a | j'ajoute la sorte à l'éditeur à la livraison |
| B3 | `serre-tomates.webp` | §14c | idem |
| B4 | `decal-ecran-on-anime.webp` | §17 | depuis l'écran livré |
| B5 | `serre-rampe-anime.webp` | §17 | l'occasion de passer la barre en blanc froid (§14d) |
| B6 | `serre-ble-nain-anime.webp` | §17 | |
| B7 | `badge.webp` (détourage) | §10 | priorité basse |

### Bloc C — les nouveaux assets

| # | image | section | ce que ça apporte |
| --- | --- | --- | --- |
| C1 | `hub-table-depart.webp` | §20b | le hub cesse d'être des plots nus |
| C2 | `hub-mur-records.webp` | §20c | |
| C3 | `hub-distillateur.webp` | §20e | |
| C4 | `hub-bac-sable.webp` | §20d | |
| C5 | `hub-eclairage.webp` | §20a | |
| C6 | `plafond-serre.webp` | §21a | la serre a enfin un reflet à elle |
| C7 | `plafond-hub.webp` | §21b | le tableau le plus joué |
| C8 | `cine/revelation-1..3.webp` | §22a-c | la révélation sur ses propres planches |
| C9 | `cine/miroir-1..3.webp` | §22d-f | la fin de l'arc sur les siennes |
| C10 | `cycle-icones.webp` | §23a | les états et les transformations sans emoji |
| C11 | `trophees-icones.webp` | §23b | |

### Bloc D — sans générateur : les vidéos du codex

Trente-deux fiches, zéro vidéo. Elles ne se génèrent pas : elles se
**filment dans le jeu** (mode concepteur, MÉMOIRE DE CAPTURE de PARAMÈTRES,
puis le bouton ⏺ ; `public/assets/codex/LISEZ-MOI.md`). Le tableau où
chaque effet se voit :

| fiches | où filmer |
| --- | --- |
| `eau-mur`, `eau-hydrophile`, `eau-hydrophobe`, `glace-mur`, `glace-hydrophile`, `glace-hydrophobe`, `vapeur-mur`, `vapeur-hydrophile`, `vapeur-hydrophobe` | L'école des parois (21-S1) |
| `eau-froid`, `eau-grille`, `eau-chaud`, `glace-froid`, `glace-grille`, `glace-chaud`, `vapeur-froid`, `vapeur-grille`, `vapeur-chaud`, `eponge` | L'école des climats (21-S2) |
| `zone-glace`, `zone-vapeur` | L'école des zones (21-S3) |
| `eau-membrane`, `glace-membrane`, `vapeur-membrane` | La membrane |
| `eau-rideau`, `glace-rideau`, `vapeur-rideau` | Le rideau |
| `eau-surchauffeur`, `glace-surchauffeur`, `vapeur-surchauffeur` | Les régimes |
| `rosee` | Le dépôt de givre (21-F) |
| `laser-glace` | La salle des miroirs (21-H) |
| `sas` | Le sas (21-A) |

Quatre secondes suffisent ; l'effet au centre du cadre (la capture est en
4:3 sur le centre) ; l'image d'attente (`<id>.webp`) est facultative.

### Phases suivantes (ne pas commencer avant que je les aie ouvertes)

| phase | quoi | section | ce qui doit exister avant |
| --- | --- | --- | --- |
| 2 | l'atlas des parois n° 2 — huit habillages de biome | §24 | les habillages 9 à 16 dans le moteur |
| 3 | seize cartons de journal, un par tableau | §25 | rien, mais c'est du volume pour un écran de concepteur |

---

## 3. Ce que je fais à la livraison, de mon côté

- **sas de raccord** : rien, le moteur l'attend ; vérifier `__decor()` ;
- **roquette, tomates, stations du hub** : les sortes dans `level.ts`,
  `FICHIER_DECAL` (renderer), `DECAL_NOMS` (éditeur), et la pose sur les
  plots du hub ;
- **plafonds** : attribuer les six variantes existantes aux tableaux (le
  champ « Plafond du reflet » de chaque tableau), plus serre et hub ;
- **planches de cinématique** : les six chemins dans `cinematique.ts`, en
  place des planches recyclées ;
- **planches d'icônes** : le cycle, les cadenas de la carte et les trophées
  lisent la planche au lieu de l'emoji (comme `metaAssets.ICONES_URL`) ;
- **références de style** : dès qu'une image d'un bloc sort bien, la copier
  dans `docs/reference/<famille>-reference.png` et la citer dans la charte
  §6 — aujourd'hui seule la famille du sas en a une. Mes candidates, sur ce
  qui est livré : `wall-a` pour les surfaces, `plafond` pour les plafonds,
  `decal-ecran-on` pour la machinerie, `meta-icones` pour les icônes,
  `serre-ble-nain` pour la serre, `avaries/table-depart` pour les
  illustrations d'écran.

---

## 4. Ce que ce chantier ne demande pas

- **L'audio** : les quinze effets d'`assets-audio.md` sont livrés, masters
  compris ; rien à refaire.
- **Le ciel** : la plaque de 4096² (`docs/ciel.md`) mesure 0,14 et tient ses
  raccords.
- **Les cinématiques en vidéo** : le lecteur anime les planches, sept boucles
  pèseraient 7 Mo (charte §8).
- **Les vignettes de la carte de la station**
  (`docs/carte-station/assets-prompts.md`) : la carte se dessine en SVG,
  ses prompts isométriques contredisent la charte et ne servent qu'en cas
  de retour au bitmap — pas prévu.
