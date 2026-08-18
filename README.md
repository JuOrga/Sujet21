# Tension de surface

Prototype jouable du jeu décrit dans
[`docs/tension-de-surface-doc-fonctionnel-v0.1.md`](docs/tension-de-surface-doc-fonctionnel-v0.1.md) :
vous êtes un volume d'eau en apesanteur, et **se déplacer, c'est rétrécir**.

Voir [`PROPOSITION.md`](PROPOSITION.md) pour la démarche de développement proposée,
la feuille de route et les recommandations sur les décisions ouvertes.

## Lancer le jeu

Aucune installation, aucun outillage : ouvrir `index.html` dans un navigateur
(Chrome ou Firefox). En cas de doute, servir le dossier :

```
npx serve .        # ou : python3 -m http.server
```

## Commandes

| Entrée | Effet |
|---|---|
| **Clic maintenu** | éjecte de la matière **vers** le curseur ; le corps part à l'opposé |
| **1 – 5** | dilatation du temps (×0,25 à ×4) — le pas physique ne change jamais |
| **Espace / Entrée** | tableau suivant (une fois le sas franchi) |
| **R** | nouvelle run |
| **T** | banc de réglage (sliders en direct + export JSON) |
| **L** ou bouton « Légende » | légende : chaque surface, son effet, état par état — le bouton sert aussi au tactile |

## Ce que contient cette slice verticale

- **Solveur PBF 2D** sans gravité : la cohésion du corps (tension de surface)
  est un comportement du modèle, pas une règle. Fusion automatique des masses
  d'eau, scission par la physique (se faufiler, se faire couper en deux).
- **Le verbe unique** : propulsion par éjection, quantité de mouvement
  exactement conservée (vérifié en test : Δv mesuré = Δv de l'équation de la fusée).
- **Volume = corps = carburant = vie.** Pas de barre de vie ; dispersion
  sous le volume critique.
- **L'éponge** (mécanique de référence du doc) : engluement, absorption après
  0,3 s de contact, saturation cellule par cellule — on peut payer un passage
  en volume, ou éjecter des gouttes dedans pour la saturer à distance.
- **La chaleur (jalon M1, §4–§5)** : chaque particule a une température ;
  le tableau se lit comme une carte thermique (radiateur, cryobaie).
  - **Glace** : sous le seuil de gel, le corps se fige en bloc rigide —
    on ne pilote plus, on glisse, on rebondit, l'éponge n'a plus prise.
    Geler, c'est parier sur une trajectoire.
  - **Vapeur** : au-dessus du seuil d'ébullition, l'éjection devient une
    bouffée explosive (poussée multipliée) qui part **définitivement**.
    Rester trop longtemps sur un radiateur évapore le corps — la chaleur
    latente donne une fenêtre d'usage avant la perte.
- **Lisibilité systématique** : chaque surface a une identité visuelle
  univoque (rayures chaudes animées, givre, cellules d'éponge, sas pulsé),
  son nom peint dans le décor, et une **légende** (L) qui donne l'effet de
  chaque surface **état par état**. Le corps lui-même change de couleur avec
  sa température ; le HUD affiche l'état courant et une jauge à seuils.
- **Un tableau fermé, trois routes selon l'état** : se faufiler par la fente
  (liquide), payer la barrière d'éponge en volume — ou la traverser vite en
  vapeur —, ou geler dans la cryobaie et glisser par le couloir bas tapissé
  d'éponge. À la sortie, le surplus est « mis en bonbonne ».
- **Caméra à zoom automatique**, time warp, trame de repère, rendu métaballes.
- **Banc de réglage** (outil prioritaire du §13) : tous les paramètres de
  ressenti en sliders, export JSON.
- **Registres du labo** (§10) : chaque tentative achevée est consignée
  (dispersion ou sas franchi, durée, volume restant), avec persistance locale.

## Boucle roguelike : la réserve de tableaux (jalon M2)

Fidèle au §7 du doc — « chaque tableau est un problème fermé » — une tentative
n'enchaîne plus un tableau unique, mais tire ses tableaux dans une **réserve
(pool)** dont la difficulté monte avec la profondeur :

- Les **premiers tableaux** sont tirés **au hasard** uniquement parmi les plus
  faciles **et sans transfo** (résolubles en pur liquide) — `ANTICHAMBRE`,
  `CHICANE`.
- Plus la run s'enfonce, plus le **plafond de difficulté** monte : les paliers 2
  (`LE DÉTROIT`, `LA DIGUE`, `LA BANQUISE`) puis 3 (`CHAMBRE THERMIQUE`,
  `LE DOUBLE SAS`) entrent dans la réserve, et les tableaux qui exigent la glace
  ou la vapeur apparaissent. Les plus faciles finissent par en sortir.
- Le tableau précédent n'est jamais retiré deux fois de suite tant qu'une
  alternative existe.

Chaque **sas franchi** remet le corps à la capacité de base et met le surplus en
bonbonne (le total de la run s'affiche au HUD) ; **Espace** enchaîne le tableau
suivant. Une **dispersion** termine la run ; **R** en relance une, réserve
remise à la phase d'amorce.

Chaque tableau est étiqueté `difficulty` (◆ à ◆◆◆) et `transforms` (états
attendus) dans `js/level.js` ; la composition de la réserve et le tirage vivent
dans `js/run.js`.

## Registres du labo et record

Fidèle au §10 du doc — « la progression se lit dans les registres » — chaque
fin de tentative est consignée dans le navigateur (`localStorage`) :

- **Record du protocole** : le sas franchi le plus vite ; à temps égal, le
  volume restant le plus grand départage. Rappelé dans le HUD et sur l'écran
  de fin (« Nouveau record du protocole » le cas échéant).
- **Registre** : les dernières tentatives (n° d'échantillon, issue, durée,
  volume) s'affichent en fin de tentative — on y lit l'expérience qui dérape.
- Le HUD numérote l'échantillon courant ; un reset en cours de route (touche R)
  n'est pas consigné : seule une fin de tentative compte.
- Le banc de réglage (T) propose « Effacer les registres du labo ».

## Tests

Un test de fumée automatisé (Playwright, `npm test`) vérifie : absence
d'erreur JS, stabilité du corps au repos, coût et efficacité de la poussée,
dérive inertielle, gel et dégel du corps, éjection vapeur (perte définitive),
les registres du labo (consignation, choix du record, départage), et la
**réserve de tableaux** (amorce facile sans transfo, plafond de difficulté qui
monte, tirage sans répétition immédiate).
