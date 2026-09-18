# L'ATH : des instruments aux coins

**Date** : 2026-09-18
**État** : design validé sur maquette, prêt pour le plan d'exécution
**Maquette** : une page interactive avant/après (bureau et téléphone en paysage),
remise au concepteur le jour du design — elle fait foi pour les cotes citées ici

## Le problème

L'interface en jeu barre l'écran de deux bandes et garde visible ce qui ne
sert presque jamais. Relevé dans le code, sur `dev` au 18/09/2026 :

1. **Le bandeau du haut** (`#hud`, `index.html:4954`) prend toute la largeur
   sur ~51 px, fond flouté compris. La jauge, qui est l'information vitale,
   n'en occupe que 5 px — étirés sur toute la largeur libre.
2. **La barre du bas** (`#touchbar`, peuplée par `main.ts:16773+`) montre
   14 boutons en permanence, sur deux rangées : LÉGENDE, ÉTATS, BANC, le son,
   le vortex, la fiche… Le cadran des états (`#statebar`), qui est LA commande
   de jeu, est empilé par-dessus via `--tb-h`.
3. **Les pancartes du monde paient la note** : `BANDE_HAUTE = 46` et
   `bandeBasse ≈ 150` (`main.ts:1569-1597`) effacent toute signalétique sur
   deux bandes pleine largeur, alors que l'interface n'en couvre qu'une
   fraction.
4. **La progression se lit trois fois** : la pastille `SALLE n/N`, le rail du
   flanc droit (`#voie-hud`, 76 px × 56 vh) et le dossier.
5. **Téléphone en paysage : la colonne de boutons déborde.** 3 chips de 40 px
   + 7 boutons de 42 px + les écarts font ~459 px pour 390 px d'écran
   (`index.html:6255-6278`) : elle sort par le haut et passe sur le bandeau.
   `--tb-h` vaut alors ~459 px et envoie `#rejeu-barre` hors écran
   (`index.html:5578`, jamais surchargé en compact).
6. **Du code mort reste dans le DOM** : `#tutor` (`main.ts:17640`,
   `if (true) return`), `#tableau-card` (`showTableauCard()` vide,
   `main.ts:1929`), `.hud-restes` (caché, mais écrit à chaque image,
   `main.ts:19485`).

## Ce qu'on construit

**Plus aucune bande. Trois coins d'instruments et un cadran, posés sur la
cuve sans panneau ; ce qui ne sert pas s'efface.**

Deux invariants de `docs/sujet-vivant.md` cadrent tout : « le coût est sur la
jauge, pas sur l'être » — la jauge reste donc **toujours** lisible ; et rien
ne se lit comme une interface **sur le corps** — aucun instrument ne suit le
Sujet.

### Les quatre postes

| poste | où | ce qu'il porte |
| --- | --- | --- |
| **le module vital** | haut-gauche | le litrage en grand (Plex Mono 600, 24 px), l'unité `L` en Michroma, la fiole (`#bonbonne`), une jauge courte de 168 × 4 px avec le seuil rouge. À droite de la jauge, la perte (`#hud-perte`) ; dessous, la rosée et le fantôme. Ces trois lignes **n'occupent de place que lorsqu'elles parlent**. |
| **la capsule d'état** | haut-droit | les crans de progression + `SALLE n/N`, puis une rangée de lectures séparées par un filet : vies, condensat, coque, instruments (et `⏺ CAPTURER` en mode concepteur). Pas de cadre par lecture. |
| **les commandes** | bas-gauche | trois boutons : `≡` (le tiroir), pause, le temps (`×1`). En essai depuis l'éditeur, `↩ ÉDITEUR` reste un quatrième bouton permanent. |
| **le cadran des états** | bas-centre ; colonne bas-droite en compact | les trois médaillons, octogonaux (la forme des modules du plan de la station). Le courant est plein, 56 px, avec son nom ; les autres 42 px, en creux, avec leur touche. |

Le centre-haut, libéré, reçoit la bannière d'alerte (`#hud-danger`, de
`top: 62px` à `top: 14px`).

### Le style

- **Pas de panneau plein.** Chaque coin porte une **équerre gravée** (deux
  filets `--line-strong` de 12 px) et un **voile local** : un dégradé radial
  de `--void` à 60 % qui s'éteint avant le bord du coin. Les textes portent
  une ombre `0 0 6px var(--void)` : lisibles sur le fluide sans le masquer.
- **L'ambre est un voyant**, comme le veut la charte (§3) : une lampe de 6 px
  s'allume devant la coque quand elle gèle (l'état `.warn` actuel). Le rouge
  reste l'alerte ; le menthe `--valid`, le cran courant.
- **Une seule famille de pictogrammes, au trait** (24 × 24, trait 1,6,
  `currentColor`), à la place des emoji du cadran, des commandes et du
  tiroir : un emoji se rend différemment sur chaque appareil et jure avec un
  laboratoire de 1970. Les icônes méta de la planche
  `/assets/meta-icones.webp` (instruments) ne changent pas.
- **Toute taille de texte reste `calc(Npx * var(--ui))`.** C'est le seul
  levier d'accessibilité du jeu ; la refonte n'y déroge nulle part.
- Cibles tactiles : 36 px au pointeur fin, **≥ 44 px** en `pointer: coarse`.
  La zone débordante de la fiole (`index.html:7635`) est conservée.

### Le tiroir `≡`

Un toucher sur `≡` ouvre, au-dessus du coin des commandes, une grille de deux
colonnes : LÉGENDE `L` · ÉTATS `E` · DOSSIER `TAB` · STATION `C` · RECADRER ·
VORTEX (si le réglage l'active) · SON · RECOMMENCER · FICHE D'ESSAI `ÉCH` ·
BANC. Chaque entrée montre son pictogramme, son nom et sa touche **telle que
le joueur l'a redéfinie** (`src/game/commandes.ts`).

- Le tiroir **ne met pas la partie en pause** (le patron du dossier).
- Il se ferme en choisissant une entrée, d'un toucher ailleurs, ou d'Échap /
  `B`. Les entrées sont de vrais `<button>`, atteignables au clavier.
- Clavier et manette gardent tous leurs raccourcis : le tiroir est un
  confort de pointeur et de doigt, pas un passage obligé.
- Le bouton du temps montre `×N` (ambre si ≠ ×1) ; un toucher le déplie en
  `‹ ×N ›` pendant 3 s.

### Le repos (réglage DISCRET)

PARAMÈTRES reçoit une ligne **ATH : DISCRET / COMPLET** (`#params-ath`, clé
`sujet21-ath`, **DISCRET par défaut**).

En DISCRET, après **4 s** sans geste vers elles, les commandes et les
médaillons non courants passent à 30 % d'opacité, la capsule à 62 %. Ils
reviennent d'un coup : pointeur à moins de 140 px d'un de ces postes, toucher
sur l'ATH, bouton de manette, changement d'état, tiroir ouvert, alerte.
**Le module vital et le médaillon courant ne s'estompent jamais.** Sous
`prefers-reduced-motion`, le passage est sans transition.

### Les panneaux de lecture

`#legend` et `#states` quittent le centre de l'écran (ils tombaient sur le
corps) : au bureau, **volet latéral droit** sur le patron de `#dossier` ; en
compact, la feuille montante actuelle, plafonnée à `60dvh` au lieu de 78.

### Le compact (téléphone en paysage)

Mêmes points de rupture qu'aujourd'hui (`max-width: 700px`, ou `pointer:
coarse` et `max-height: 620px`). Le module vital tient sur une ligne
(litrage 18 px, jauge 118 px), la capsule aussi (crans, salle, vies,
condensat, coque — les instruments passent au dossier). Commandes en rangée
bas-gauche, cadran en colonne bas-droite sous le pouce. Plus aucune colonne
de boutons : **le débordement disparaît avec sa cause**. Les
`env(safe-area-inset-*)` sont repris sur les quatre postes.

## Comment c'est bâti

### Ce qui garde son nom

Les ids que le code et les tests cherchent **ne changent pas** : `#hud`,
`#hud-volume`, `#bonbonne`, `#gauge-fill`, `#gauge-threshold`,
`#hud-tableau`, `#hud-vies(-chip)`, `#hud-cond(-chip)`, `#hud-instr(-chip)`,
`#hud-coque`, `#hud-capture`, `#hud-perte`, `#hud-rosee`, `#hud-fantome`,
`#statebar`, `#state-eau|glace|vapeur|zone`, `#touchbar`, `#voie-hud`,
`#vh-rang`, `#vh-rail`, `#vh-stade`. La boucle de mise à jour
(`main.ts:19406-19515`) continue d'écrire aux mêmes endroits ; ce sont les
**conteneurs et le CSS** qui changent.

- `#hud` devient une couche plein écran **qui ne peint rien**
  (`pointer-events: none`, ni fond ni flou) et contient deux coins :
  `.ath-vital` et `.ath-etat`. Le patron actuel est conservé : seuls les
  boutons et la fiole reprennent `pointer-events: auto`.
- `#voie-hud` entre dans `.ath-etat` ; `#vh-rail` passe à l'horizontale par
  le CSS — le code qui pose les crans (`main.ts:16147-16188`) ne bouge pas.
- `#touchbar` garde son id et ne reçoit plus que les boutons permanents ;
  les autres sont créés par la même fabrique (`touchButton`) mais rangés
  dans `#tiroir`, nouvel élément frère.

### Quatre petits modules purs, testés

| module | rôle |
| --- | --- |
| `src/game/athPictos.ts` | le dictionnaire des tracés et `picto(nom)` → SVG. |
| `src/game/athTiroir.ts` | la liste ordonnée des entrées (id, nom, picto, manœuvre de `commandes.ts`, condition d'affichage) et ce qui reste permanent selon le contexte (essai depuis l'éditeur, vortex). |
| `src/game/athRepos.ts` | l'automate du repos : `(maintenant, dernierGeste, réglage, forcé) → 'eveille' \| 'repos'`. `main.ts` ne fait que lui donner l'heure et poser `body.ath-repos`. |
| `src/game/athZones.ts` | les zones interdites aux pancartes : à partir des rectangles mesurés des quatre postes, dit si une pancarte `(sx, sy, hw, hh)` est libre. Remplace les deux bandes. |

### Les pancartes retrouvent l'écran

`majBandeBasse` (`main.ts:1577`) devient la mesure, quatre fois par seconde
comme aujourd'hui, des rectangles de `.ath-vital`, `.ath-etat`, `#touchbar`
et `#statebar` (marge `MARGE_PANCARTE`). Le test de `main.ts:1644` interroge
`athZones` au lieu de comparer à deux bandes. Une pancarte ne s'efface plus
que si elle **touche réellement** un poste.

### `--tb-h` s'en va

Plus rien ne s'empile sur la barre du bas. Le cadran publie sa hauteur en
`--cadran-h` (même `ResizeObserver`) ; `#relance`, `#continuer` et
`#rejeu-barre` se calent dessus au bureau et prennent des cotes fixes en
compact — `#rejeu-barre` y gagne la surcharge qui lui manquait.

### Les retouches de voisinage

- `#fps-coin` passe de bas-gauche à bas-droite (le coin est pris).
- Les bornes de `#obj-arrow` (`main.ts:19656+`) suivent les nouvelles marges.
- `#instr-panel` et `#trophee-toast` restent sous la capsule (`top: 64px`).
- Suppression de `#tutor`, `#tableau-card`, `.hud-restes`, de leur CSS et du
  code qui les alimente.

## Ce qui ne bouge pas

La flèche du sas, la visée et l'étiquette du dash, les toasts, le dossier,
le plan de la station, la cérémonie, l'éveil, les menus, l'éditeur, le banc.
**L'ATH des mini-jeux** (peint sur `#fx-canvas`, en pixels fixes et en
`ui-monospace`) relève d'une seconde passe, avec sa propre spec.

## Comment on sait que c'est bon

- **Tests de contrat** dans le style du dépôt (`src/game/ath.spec.ts`, lit
  `index.html` et `main.ts`) : tous les ids ci-dessus existent ; `#tutor`,
  `#tableau-card`, `.hud-restes` et `--tb-h` ont disparu ; `#hud` n'a ni
  `background` ni `backdrop-filter` ; aucune `font-size` du bloc ATH n'est
  écrite sans `var(--ui)` ; le bloc porte un `prefers-reduced-motion` ; le
  compact ne contient plus de `#touchbar { flex-direction: column }`.
- **Tests des quatre modules purs**, écrits avant eux : l'ordre et les
  conditions du tiroir ; chaque manœuvre du tiroir existe dans
  `commandes.ts` ; l'automate du repos (4 s, réveils, COMPLET, alerte) ; une
  pancarte au centre-haut est libre, une pancarte sur un coin ne l'est pas.
- Les specs existantes qui lisent `index.html` (`gardeBoucle`, `ceremonie`,
  `descente`, `miseEnPage`, `amorce-garde`) restent vertes sans retouche.
- `pnpm type-check`, `pnpm test`, `pnpm build` avant chaque poussée.
- **À l'œil** : la machine de développement n'a pas WebGL 2 ; la relecture
  visuelle se fait sur un aperçu (`previsu-go`), bureau et téléphone en
  paysage, par le concepteur.
- Livraison : une entrée en tête de `src/bench/changelog.ts`, puis PR vers
  `dev`.
