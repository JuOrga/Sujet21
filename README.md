# Tension de surface

Roguelike ambiant et inertiel : vous êtes un volume d'eau qui s'échappe d'un
laboratoire orbital. En gravité nulle, la seule façon d'avancer est d'éjecter
une partie de soi-même — **se déplacer, c'est rétrécir**.

Le document de référence est [`docs/doc-fonctionnel.md`](docs/doc-fonctionnel.md).

## État — version 0.21.404, une run jouable de bout en bout

Le jeu tourne dans le navigateur, sur ordinateur, tablette et téléphone.
**404 livraisons consignées entre le 08/08/2026 et le 01/09/2026** — le journal
complet se lit dans l'écran NOTES DE VERSION, les données sont dans
[`src/bench/livraisons.ts`](src/bench/livraisons.ts).

Les jalons 1 et 2 du document fonctionnel sont derrière, et les jalons 3
(chaleur et états) et 4 (boucle roguelike) sont faits pour l'essentiel.

**Le corps et le geste.** Solveur de fluide PBF 2D (typed arrays, grille
spatiale, pas de temps fixe, noyaux compilés en WebAssembly) ; cohésion par
contrainte de densité ; propulsion par éjection à quantité de mouvement
exactement conservée ; fusion des masses, identification du corps par amas
connexe, dispersion sous le volume critique ; vortex de regroupement ; caméra
à zoom automatique et time warp qui ne touche jamais au pas physique.

**La matière.** Les quatre états — liquide, glace, vapeur et le plasma — avec
la carte thermique, la recondensation de la vapeur perdue, et le CYCLE des
mémoires : chaque transformation manuelle est un lien à tisser, on commence
avec juste de quoi redevenir liquide.

**Le vaisseau.** Des obstacles de chimie, pas de géométrie : parois
hydrophobes et hydrophiles, éponge à saturation, membranes, rideaux, grilles,
plaques chaudes et froides, surchauffeurs, évents. Des faisceaux laser, des
pastilles mémoire et des portes qui forment une algèbre complète — le cabinet
logique en fait cinq salles de démonstration sans ajouter un seul mécanisme.
Des rails à champ qui convoient la vapeur et l'ionisent en plasma.

**La boucle.** Le hub du laboratoire Méduse, le sas de lancement, la descente
semi-procédurale (longueur et rampe de difficulté réglables, graine du jour
commune à tous les postes), le choix de la salle suivante en vignettes,
l'économat à mi-descente qui troque contre du condensat, la mise en bonbonne
du surplus au sas, la purge de fin de run. Le codex se remplit de ce que le
sujet découvre en jouant, les trophées de ce qu'il réussit.

**Les écrans.** Cinématiques en planches illustrées (le montage compose, il ne
code pas), accueil, notes de version, palmarès partagé, codex, cycle.

**La fabrication.** L'écran LA DESCENTE, où le déroulement d'une run se
règle, se déroule à blanc et se met en statistiques ; un éditeur de tableaux
complet (~7 000 lignes) ; la
PLANCHE — toutes les salles de la bibliothèque partagée en vignettes dessinées
depuis leur géométrie, l'ordre y est la séquence de l'expédition —, et un
générateur qui refuse tout tirage dont la traversée ne se démontre pas.
Bibliothèque, palmarès, présets, cinématiques et images sont partagés entre
concepteurs par une API sur Vercel Blob.

**Le rendu et le son.** Métaballes WebGL2 en deux passes, éclairage et ombres,
parallaxe, sprites, palette froide. Sons synthétisés en Web Audio (seule la
nappe de vapeur est un enregistrement), lits musicaux accrochés aux lieux et
aux événements plutôt qu'aux tableaux.

**Les commandes.** Souris, tactile (barre de commandes, pincement pour le
zoom) et manette — Steam Deck, Xbox, DualSense.

## Lancer

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

**Contrôles** : maintenir le pointeur pour éjecter vers ce point (le corps part
à l'opposé) · `,` / `.` time warp · `espace` pause · `R` recommencer.
Objectif : rejoindre le sas avec le plus de volume possible.

**Les outils du concepteur** sont derrière le mode concepteur : `?dev` dans
l'URL, ou sept tapes rapides sur le numéro de version (tactile compris).
`?editeur` ouvre l'éditeur directement, `?tableau=N` démarre à la salle N,
`?spawn=x,y` place le corps.

## Qualité

```bash
pnpm test        # 733 tests dans 66 fichiers, ~23 s
pnpm type-check
pnpm build
```

Les tests couvrent la physique (conservation de la quantité de mouvement,
cohésion, fusion, dispersion, grille spatiale, amas, chaleur, glace, vapeur,
recondensation, WASM), les règles de jeu (bonbonnes, condensat, économat,
codex, trophées, cycle, récompenses, voie, générateur) et les écrans
(commandes, cinématiques, planche, éditeur, bibliothèque partagée).

## Ce qui n'est pas fait

- **Le boss.** La Pompe de reprise n'est qu'une esquisse écrite
  ([`docs/boss-pompe.md`](docs/boss-pompe.md)) : rien n'est implémenté.
- **La carte à routes ramifiées** (§9 du document fonctionnel) : la descente
  se lit en profondeur et en choix de salle, il n'y a pas d'écran de carte.
- **Les cinq décisions ouvertes** du §14, à commencer par l'intensité de la
  cohésion — le curseur d'identité du jeu.
- **L'empaquetage Steam** : les visuels de boutique sont dessinés
  (`public/steam/`), le reste est à faire.
