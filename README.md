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
- **Un tableau fermé** avec deux routes : la barrière d'éponge, ou une fente
  étroite qui demande de se déformer/scinder. À la sortie, le surplus est
  « mis en bonbonne ».
- **Caméra à zoom automatique**, time warp, trame de repère, rendu métaballes.
- **Banc de réglage** (outil prioritaire du §13) : tous les paramètres de
  ressenti en sliders, export JSON.

## Tests

Un test de fumée automatisé (Playwright) vérifie : absence d'erreur JS,
stabilité du corps au repos, coût et efficacité de la poussée, dérive inertielle.
