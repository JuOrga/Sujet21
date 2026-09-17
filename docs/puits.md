# Les puits de gravité — la loi, ses nombres, ce qu'on peut en attendre

*Livraison 1 (17/09/2026) : la physique, l'impulsion de départ, la
trajectoire prédite, le mini-jeu « Les orbites ». L'éditeur suit
(livraison 2, §6).*

## 1. Ce qu'est un puits

Un point du tableau qui **attire** le corps. Pas un courant : le sas, le
vortex et les chasses sont des **champs de vitesses** (le solveur ramène la
vitesse de chaque particule vers une cible), faits pour converger — leurs
notes dans `src/sim/solver.ts` disent trois fois pourquoi : « une force
pure ferait orbiter ». Ici c'est le but. Le puits est la **seule
accélération pure** du solveur (`applyPuits`), et sa loi vit dans un module
pur, `src/game/puits.ts`, partagé par le solveur, le prédicteur et demain
l'éditeur : ce que la ligne dit est ce que le corps subit.

| Champ (`PuitsDef`) | Sens | Défaut |
| --- | --- | --- |
| `x`, `y` | le centre | — |
| `force` | l'accélération au bord du cœur (u/s²) | `PUITS_FORCE_DEFAUT` = 540 |
| `rayon` | le rayon du cœur (u) | `PUITS_RAYON_DEFAUT` = 300 |
| `portee` | au-delà, plus rien ; fondu linéaire sur le dernier quart | absente : tout le tableau |

**La loi.** Dans le cœur, harmonique : `a = force · r / rayon` — pas de
singularité au centre, les orbites sont des ellipses centrées sur le puits,
et **toutes ont la même période** `T = 2π·√(rayon/force)` (4,7 s aux
défauts) : c'est ce qui rend une chaîne de puits prévisible. Au-delà,
képlérien : `a = force · rayon² / r²`, continu au bord. Plusieurs puits se
somment. Vitesse circulaire au bord √(force·rayon) = 402 u/s, à 0,7 rayon
282 u/s ; vitesse d'évasion au bord 569 u/s, loin sous `maxSpeed` (3 000).

**Ce qui orbite, ce qui est capturé.** L'eau orbite, et reste un corps.
La glace orbite (la moyenne d'`icePass` porte la traction ; l'écart entre
particules devient une marée en rotation). La vapeur, elle, est capturée :
`gasDrag` (1,3/s) la fait spiraler vers le cœur — un nuage n'orbite pas.
Le dash de vapeur (820 u/s) reste une porte de sortie.

## 2. Les orbites vivent dans le cœur, la lisière déchire

Mesuré le 17/09 (`src/sim/puits.spec.ts`) : un corps de 400 ou 900
particules lancé en orbite circulaire **à l'intérieur** du cœur (0,5 à 0,8
rayon) garde 100 % de lui-même sur quatre secondes et tient son rayon à
±1 % — la marée harmonique est **compressive** (deux particules sont
rappelées l'une vers l'autre à proportion de leur écart), elle aide la
cohésion. Lancé **au bord** du cœur, il perd 45 % : la moitié du corps est
dans le halo, où la marée s'inverse et étire (≈ 3Ω²·r), et la lisière est
une ligne de cisaillement. Le test garde le phénomène, pas une valeur.

**Règles de conception.** Une orbite se pose à moins de 0,8 rayon du
puits. Le halo ne sert qu'aux transferts, traversés vite. Deux cœurs ne se
recouvrent pas (`checkLevel` avertit). Un lancer utile est entre la
vitesse circulaire et la vitesse d'évasion.

## 3. L'impulsion de départ

`spawn.impulsion { angle, vitesse }` — degrés trigonométriques (0 vers
l'est, 90 vers le nord) et u/s, la convention des chasses. Le corps naît
lancé (`FluidSim.lanceCorps`). En jeu, la physique tourne pendant le plan
large de l'entrée de caméra : l'impulsion **se tient** jusqu'à la fin du
plan (ou au premier geste, qui le coupe), et les puits n'agissent pas tant
qu'elle attend — le corps reste immobile, en apesanteur. `checkLevel`
refuse une vitesse au-delà de `maxSpeed`.

En jeu, les autres lancements exacts existent déjà : une **chasse**
(`angle` + `allure`) est un lanceur — un servo qui amène le corps à une
vitesse précise ; le dash de vapeur aussi.

## 4. Les deux prévisions

**La ligne rapide** (`src/game/trajectoire.ts`, pure) : un point-masse
intégré en Euler semi-implicite au pas du solveur, la vitesse d'abord (la
loi des puits), la position ensuite — l'ordre du solveur. Dans le cœur
harmonique la force est linéaire : la somme sur le corps est la force sur
son centre, les forces internes s'annulent, le centre suit le point. La
ligne dévie aux marées du halo et aux parois. Parois : `formeContact`
(toutes formes, rotation comprise), bords de la cuve, rayon du corps,
frottement (la vapeur). Restitution **mesurée** sur le vrai solveur
(`trajectoire.spec.ts`) : un corps ne rebondit pas sur un mur neutre (1 à
2 % revient — l'eau épouse la paroi), l'hydrophobe renvoie à 0,6-0,8,
l'hydrophile colle. Non modélisé : les éponges, les pertes des grilles.
Dessinée à chaque image en pointillé, sur six secondes, un cercle à
chaque rebond.

**La prévision exacte** (touche **P**, redéfinissable) : une copie du
solveur (`FluidSim.copiePourPrevision`, l'état de chaque particule et le
tableau entier) avance à part, par tranches de 6 ms par image, et écrit en
trait plein la vraie trajectoire du centre sur trois secondes. Effacée à
toute éjection ou changement d'état, et à chaque salle. Un pas à 900
particules coûte quelques millisecondes : la ligne se lit en train de
s'écrire. Le mini-jeu la lance au moment du lancer.

## 5. Le mini-jeu « Les orbites »

Trois puits **en quinconce** (le croquis les alignait ; mesuré : alignés,
trois lancers sur huit mille enroulent les trois puits et aucun sans
rebondir sur un bord — en quinconce, des centaines, aux sens alternés),
aux réglages par défaut. Le corps naît lancé (angle −50°, 310 u/s) et la
ligne dit où il va : un virage autour du premier puits, un autour du
deuxième de l'autre côté, un autour du troisième, puis il remonte le bord
gauche jusqu'au **croissant**, un arc hydrophile où il se colle. Trois
anneaux jalonnent ce chemin, dans l'ordre. À chaque seconde : **laisser
porter** (gratuit, la ligne dit où ça mène) ou **corriger** d'une
éjection (chaque goutte coûte, la ligne se courbe à vue). Verdict : la
part du volume gardée (intact ≥ 90 %, écorné ≥ 70 %, entamé ≥ 45 %), un
palier de moins par anneau manqué, rien sans le croissant.

Le lancer, les anneaux (posés à mi-virage) et la cible (1,2 s après le
troisième virage) ont été **trouvés par une recherche**, pas à la main :
`RECHERCHE_ORBITES=1 pnpm vitest run src/game/orbites.recherche.spec.ts`
balaie la hauteur du départ, l'angle et la vitesse, exige un vrai virage
autour de chaque puits (au moins un tiers de tour, à 0,3-0,95 rayon du
centre — traverser le cœur en plein milieu balaie 180° sans tourner) et
imprime les meilleurs. Deux tests de garde : le point-masse passe les
anneaux et finit dans la cible ; le **vrai solveur** (900 particules)
passe le premier anneau et s'approche du deuxième sans se disperser. Si
la physique ou les puits changent, on refait la recherche — jamais on ne
déplace un anneau à la main.

## 6. Livraison 2 — l'éditeur

Outil « puits » (poser au clic, glisser pour le rayon), fiche `force /
rayon / portee`, fiche du départ avec `impulsion` (angle, vitesse) et un
glisser depuis le départ, les anneaux des puits et la ligne prédite
dessinés en direct (`traceTrajectoire` depuis le départ, comme le
faisceau des lasers), un bouton « Prévision exacte » sur un solveur sans
écran. Le stockage est déjà prêt : `levelIO` lit, écrit et valide les
puits et l'impulsion.
