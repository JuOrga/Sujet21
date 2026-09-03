# Handoff : Carte de la station — Sujet 21

## Ce que c'est
Carte de progression du jeu *Sujet 21* : 11 modules reliés par 12 coursives, dans 4 zones, avec conditions d'accès selon l'état du joueur (eau / glace / vapeur). Rendu 100 % vectoriel (SVG + HTML), scène fixe 1600×804 mise à l'échelle.

Les fichiers de `reference/` sont des **maquettes HTML de référence** (look + comportement). Il ne faut pas les copier telles quelles : recréer le rendu dans la stack du jeu à partir de `map.json`.

## Fidélité : haute
Couleurs, tailles, positions et comportements sont définitifs. Le décor (arc, télescope) est indicatif mais son style (traits #324a62, lumières #63b7e6, plaques dégradées #1b2838→#0b1420) doit être conservé.

## Objectif côté dev
1. **Données** : `map.json` = source de vérité (modules, liens, types, décor, palette, règles). Le jeu la charge ; rien n'est codé en dur.
2. **Rendu in-game** : dessiner modules (octogone `polygon(22% 0,78% 0,100% 28%,100% 72%,78% 100%,22% 100%,0 72%,0 28%)`, rond pour `jonction`, dôme pour `boss`), coursives (3 traits superposés : paroi `coque`, sol `coque-6`, anneaux `coque+6` en tirets `4 44`), puis la ligne de route colorée par type.
3. **Éditeur de map** (mode debug ou outil séparé) : glisser les modules (met à jour x/y), redimensionner (w/h), créer un lien par glisser d'un module à l'autre, changer le type d'un lien, supprimer, éditer les champs texte, et **exporter le même `map.json`**. Snap sur grille 8 px.

## Modèle de données (map.json)
- `modules[]` : id, nom, type (sas|jonction|combat|enigme|coffre|boss), zone, x, y (centre), w, h, temp, forme, desc.
- `liens[]` : de, vers, type (main|alt|glace|vapeur). Orientés : le joueur avance de `de` vers `vers`.
- `typesLiens` : style + `condition` (null = libre ; sinon état requis) + `badge`.
- `decor[]` : éléments non jouables ancrés à un module (arc ↔ HUB, télescope ↔ OBS).
- `regles` : départ, objectif, états joueur, tracé des coursives du HUB, échelle de couleur température.

## Comportement
- Le joueur est sur `courant`. Sont cliquables les modules `vers` d'un lien dont `de == courant`.
- Lien avec condition non remplie → cadenas, bouton « ACCÈS REFUSÉ ».
- Entrer : `courant = cible`, ajouter l'ancien à `visites`, coursive parcourue passe à 35 % d'opacité.
- Module courant : pulsation 1.8 s, halo cyan. Lien actif : tirets animés (`stroke-dashoffset` −28 sur 1.2 s).
- Panneau latéral : vignette, nom, zone, description, température, état, bouton d'action.

## Typo
Michroma (titres, noms de modules, letter-spacing .1–.32em), IBM Plex Mono 400/600 (tout le reste). Fichiers dans `reference/` non inclus : Google Fonts.

## Fichiers
- `map.json` — données.
- `reference/Carte Station.dc.html` — maquette interactive (données dans la classe `Component`, rendu dans le template, vecteurs du décor dans le `<svg>` du début).
- `reference/Assets - Prompts.md` — prompts si retour à des vignettes bitmap.
