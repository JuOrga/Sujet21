# La tranche des formes courbes — balayage exact là où il existe, affiné ailleurs

*Conception, 18/11/2026 — branche `claude/formes-courbes`. Choix du concepteur : « exact + affiné ».*

## Pourquoi

Relief 2.5D allumé, la tranche d'un DISQUE, d'une CAPSULE, d'un ARC et d'une
COQUE (tout le hub) est l'empilement de cinq copies décalées de la silhouette
(`renderer.ts`, boucle des boîtes, ~l.3332–3353 : le pied, trois pas à ¼ ½ ¾,
le sommet). Sur le bord en biais de la tranche, les copies se lisent en
marches. Les boîtes et le coin ont été réglés le 16/11 par un balayage EXACT
(`flancBalaye`, `flancBalayeTriangle`, `flancBalayeCoin` — `reliefParois.ts`,
TS jumeau + GLSL). Les formes courbes « gardaient l'estime et
l'échantillonnage » (commentaire l.3317).

## Le principe commun

Pour un pixel p (repère de la boîte), le dessus est lu en p − r (r : le
déplacement du sommet). La tranche couvre p s'il existe t ∈ [0, 1] tel que
p − t·r soit dans la silhouette ; la HAUTEUR VUE est le plus grand tel t (le
dernier passage du dedans au dehors). Hors de la tranche, la couverture
anticrénelée se lit sur une distance au VOLUME BALAYÉ.

## Ce qu'on fait

1. **Disque rond** (boîte carrée) : balayé, c'est une capsule de rayon R entre
   c et c + r. Intervalle exact : les racines de |q − t·r|² = R² (q = p − c) ;
   distance exacte : celle à la capsule.
2. **Disque ovale** (boîte non carrée) : image affine d'un disque rond —
   l'intervalle en t est EXACT après mise à l'échelle des axes (q et r divisés
   par les demi-axes) ; la distance pour l'anticrénelage, approchée comme
   aujourd'hui (`FORMES_DISTANCE_APPROCHEE`).
3. **Capsule** : segment [a, b] de rayon R. L'ensemble des t est un intervalle
   (distance à un convexe le long d'une droite : convexe) ; c'est l'union des
   intervalles des deux disques de bout et de la bande (deux demi-plans
   latéraux + l'encadrement du segment) — t1 = le plus grand des bouts.
   Distance : celle au parallélogramme balayé (a, b, a + r, b + r) moins R.
4. **Arc et coque** (non convexes, coque creuse et percée de portes) : 12 pas
   le long du chemin pied → sommet, comme `flancPieces`, puis **affinage par
   dichotomie** (3 itérations) du dernier passage dedans → dehors — la hauteur
   vue cesse d'être linéaire par morceaux. La couverture reste l'union des
   copies (12 au lieu de 5 : marches quatre fois plus petites).
5. **Jumeaux TS** dans `reliefParois.ts` (comme `flancBalaye`) testés contre une
   référence par force brute (N = 4000 pas), puis leur GLSL ; `hauteurTranche`
   apprend le disque et la capsule (aujourd'hui −1 hors rectangle et coin), ce
   qui les fait entrer dans `zVis`.

## Contraintes

- `gradientBoucles.spec.ts` : aucune opération de gradient dans la boucle des
  boîtes, borne `uBoxCount`, nombre d'appels `gradSdfBoite(bi` tenu.
- 16 unités de texture (`unitesTexture.spec.ts`) : rien à ajouter.
- Relief éteint : rien ne change, ni image ni coût (tout sous `uRelief > 0.0`).
- Cadence : mesurer avant / après au banc logiciel sur le hub (coques) et sur
  `?tableau=1` (le disque du berceau) ; dire le chiffre mesuré, rien d'estimé.
  Si le surcoût passe 10 % sur le hub, le dire avant de livrer.

## Approches considérées

- **Exact + affiné — retenue** : exact pour disque et capsule (formule fermée,
  pas plus cher qu'aujourd'hui), affiné pour arc et coque.
- 12 pas partout : plus simple, mais coût ×2 environ et micro-marches.
- Exact partout (coque décomposée en rectangle arrondi plein moins son creux) :
  le plus juste, le plus long, le plus risqué sur le hub.

## Vérification

Tests jumeaux contre force brute ; `tsc`, `vitest`, `vite build` ; banc relief
fort, formes en BORD de vue (le flanc grandit avec l'écart au centre), avant /
après sur le hub et le tableau 1.
