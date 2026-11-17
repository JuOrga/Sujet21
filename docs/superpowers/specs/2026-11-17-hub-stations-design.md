# Les stations du hub — cinq pièces de machinerie, posées par l'admin

*Conception courte, 17/11/2026 — branche `claude/hub-stations`.*

## Pourquoi

Le hub est le tableau le plus joué, et ses stations (celles du tableau des
avaries) n'y sont que des plots nus. La commande d'images (§20 de
`assets-ia.md`) prévoyait cinq décalques posés sur les plots. Le concepteur
précise (17/11) : **le hub va changer** — les pièces doivent donc être
**modifiables par l'admin**, pas gravées dans le code.

## Ce qu'on fait

- **Cinq décalques rendus dans Blender** (`tools/images/blender/hub_stations.py`),
  vue de face orthographique, détourés, sans ombre au sol, l'acier de
  l'atelier : `hub-eclairage` (1024²), `hub-table-depart` (1536×512),
  `hub-mur-records` (1536×439), `hub-bac-sable` (1024²), `hub-distillateur`
  (1024²). Les descriptions de §20 font foi (aucun texte, aucun chiffre ;
  sarcelle `#63b7e6`, ambre `#e8951f` en veilleuse seulement).
- **Cinq sortes de décor dans l'éditeur** (groupe « Décor (sans physique) ») :
  l'admin les pose, les dimensionne, en met plusieurs, dans n'importe quel
  tableau. Une sorte = une ligne dans `DecalDef`, `levelIO`, l'éditeur
  (`DECAL_NOMS` et la liste), `FICHIER_DECAL`, `assetsLivres`.
- **La panne se lit sur la pièce** : une pièce `hub-*` posée près du plot
  d'une station en panne s'assombrit (même zone que les écrans qui
  s'éteignent : le plot, plus 400 de marge). Réparée, elle revient.
- **`plafond-hub`** (§21b) : un plafond de plus, que le champ « Plafond du
  reflet » du tableau propose.

## Approches considérées

| | A. Décors libres dans l'éditeur — **retenue** | B. L'image suit l'ancre de la station |
| --- | --- | --- |
| pose | l'admin place et dimensionne | automatique, centrée sur le plot |
| liberté | plusieurs exemplaires, hors du plot, ailleurs | aucune ; un plot couvre parfois un couloir entier, l'image s'y étire mal |

Choisie par le concepteur le 17/11 : le hub va changer, la mise en scène lui
revient ; le moteur n'a qu'à reconnaître la panne.

## Ce qu'on ne fait pas

- **Pas de pose dans le code ni dans `ops/hub-compact.json`.** Le hub joué est
  l'entrée de la bibliothèque ; la régénérer (`maj-hub-go`) écraserait le
  hub de l'admin. C'est lui qui pose les pièces.
- Pas de pièce pour l'aile des endormis (elle a ses fioles) ni pour la
  passerelle (un passage).
- Une seule image par station, en état de marche : l'assombrissement est le
  travail du moteur.
- Aucune unité de texture de la composition : les décalques passent par le
  shader des décalques.

## Laissé au constructeur (mes choix, à corriger)

- L'assombrissement : un champ optionnel posé par `appliqueReparations` sur
  le décalque (jamais écrit dans un fichier), lu au rendu (luminance ~45 %,
  un peu désaturée).
- La marge de 400 reprise des écrans, pour que la règle soit unique.
