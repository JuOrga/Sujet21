# Les icônes peintes — états, transformations, trophées ; l'ATH et la carte suivent

*Conception, 18/11/2026 — branche `claude/icones-peintes`. Choix du concepteur : planches Blender ; l'ATH « colle » pour les états.*

## Pourquoi

Le cycle des états, le codex, les trophées et la carte de la station
affichent encore des EMOJI : leur dessin change d'une machine à l'autre (une
machine sans police emoji n'affiche qu'un carré vide). La commande d'images
prévoit deux planches (`docs/assets-ia.md` §23a, §23b ; `assets-chantier.md`
C10, C11). Le comptoir a déjà sa planche peinte (`meta-icones.webp`, lue par
`metaAssets.ts` en HTML et en canvas) : c'est le modèle.

## Ce qu'on fait

1. **`cycle-icones.webp`**, 1024 × 768, grille 4 × 3 de cases 256, détourée,
   rendue dans Blender — dans l'ordre de §23a :
   - rangée 0 : SOLIDE (cristal), LIQUIDE (goutte), GAZ (nuée), PLASMA (arc) ;
   - rangée 1 : FUSION, LIQUÉFACTION, SOLIDIFICATION, VAPORISATION ;
   - rangée 2 : SUBLIMATION, CONDENSATION, IONISATION, DÉIONISATION.
   Une transformation : petite source à gauche, flèche fine courbe, petite
   cible à droite. Couleurs : glace #a7ddf5, eau #63b7e6, vapeur #f2c98e,
   plasma #c99aff ; ni texte, ni cadre.
2. **`trophees-icones.webp`**, 1024 × 512, grille 4 × 2, dans l'ordre de
   `trophees.ts` (= §23b) : sans une goutte, palet parfait, trois états, la
   ligne de crête / miroir vivant, recondensé, l'intégrale, opérateur de nuit.
3. **Le code lit les planches au lieu des emoji**, avec repli sur l'emoji si
   la planche manque (comme `dessineIconeArticle`) :
   - l'écran du cycle et les rayons du codex (états) ;
   - les transformations, qui n'avaient AUCUNE icône (texte seul) : elles en
     gagnent une là où le cycle les liste ;
   - les trophées : la carte `.tro-carte` et le toast ;
   - **l'ATH** : DANS les trois logements du cadran (cube, goutte, nuage), le
     symbole au trait (flocon, vagues, volutes) devient l'icône peinte de
     l'état. Les logements gardent leur silhouette, leur liseré et leurs
     animations. Les boutons d'interface (menu, pause, son…) restent au trait ;
   - **la carte de la station** (SVG) : le cadenas 🔒 devient le `verrou` au
     trait de l'ATH ; les badges « ❄ GLACE / 💨 GAZ » prennent l'icône peinte.
4. Un module unique pour lire les deux planches (sur le modèle de
   `metaAssets.ts` et `iconesStation.ts` : URL, grille, table des cases,
   `…HTML()` et `dessine…()` canvas), et le CSS à côté de `.ico-meta`.

## Ce qu'on ne fait pas

- Les autres emoji (réparations, économat, fioles, codex des fiches, journal,
  toasts divers) : hors de cette commande, listés pour plus tard.
- Les boutons d'interface de l'ATH : ce sont des commandes, au trait ils
  restent lisibles à 20 px.

## Le risque, et sa vérification

Une icône peinte peut devenir floue à la taille du cadran (~28 px). Les cases
sont rendues à 256 px avec des silhouettes franches ; la mesure se fait en jeu,
à la taille réelle, et le concepteur la voit avant le reste du branchement.

## Tests à tenir

`iconesPartout.spec.ts` (ses « excuses » doivent suivre exactement le code),
`dessinCarte.spec.ts` (badges et cadenas attendus), `ath.spec.ts` (pas
d'emoji dans la barre), `metaAssets.spec.ts`.
