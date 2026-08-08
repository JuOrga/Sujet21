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
| **R** | recommencer |
| **T** | banc de réglage (sliders en direct + export JSON) |

## Ce que contient le jalon M1 — la chaleur

- **Carte thermique** (§5) : le tableau se lit en gradients — cryobaie,
  radiateurs, conduites chaudes. Température par particule, conduction
  interne, échange surtout en surface : l'inertie thermique d'un gros corps
  (lent à geler, lent à chauffer) émerge du modèle au lieu d'être scriptée.
- **Glace** (§4) : sous le seuil, le corps gèle d'un bloc et devient un
  solide balistique — on ne pilote plus, on glisse, on rebondit ; l'éponge
  n'a plus prise. Geler, c'est parier sur une trajectoire. La chaleur fait fondre.
- **Vapeur** (§4) : au contact d'un radiateur, le flanc exposé bout ; chaque
  bouffée part avec conservation exacte de la quantité de mouvement —
  poussée explosive, et volume perdu définitivement (recondensation : M2).
- **Trois routes dans le même tableau** (critère de sortie M1) :
  couloir central en liquide (éponge à payer, ou fente étroite), couloir
  haut en glace (le tunnel absorbant est trop long pour être payé — seule
  la glace le traverse), couloir bas à la catapulte à vapeur.

## Ce que contient la slice M0

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
- **Un tableau fermé** avec deux routes : la barrière d'éponge, ou une fente
  étroite qui demande de se déformer/scinder. À la sortie, le surplus est
  « mis en bonbonne ».
- **Caméra à zoom automatique**, time warp, trame de repère, rendu métaballes.
- **Banc de réglage** (outil prioritaire du §13) : tous les paramètres de
  ressenti en sliders, export JSON.

## Tests

Deux tests automatisés (Playwright — `npm i playwright`, puis
`node test/smoke.js` et `node test/thermal.js`) vérifient : absence d'erreur
JS, stabilité du corps au repos, coût et efficacité de la poussée, dérive
inertielle, gel en cryobaie, fonte au radiateur, ébullition avec perte de
volume et poussée thermique.
