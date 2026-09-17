# Les puits de gravité — la loi, ses nombres, ce qu'on peut en attendre

*Livraison 1 (17/09/2026) : la physique, l'impulsion de départ, la
trajectoire prédite, le mini-jeu « Les orbites ». Livraison 2 (le même
jour) : l'éditeur, §6.*

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
La glace orbite : **un bloc reçoit la moyenne du champ sur son disque**
(`applyPuits` somme les puits par bloc), pas une traction par particule —
particule par particule, le cœur (`a ∝ r`) tirait plus sur le bord loin
que sur le bord près, et la projection rigide d'`icePass` ne redresse que
les vitesses : le bloc se tassait de 1 u/s (mesuré le 17/09, rms 73 → 55
en 20 s). Dans le cœur, la moyenne est la valeur au centre : le bloc est
un point-masse exact ; dans le halo en 1/r², elle en diffère un peu — ce
qui compte quand on tire une orbite fermée (§7). La vapeur, elle, est capturée :
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

**Et un enchaînement déchire ce qu'un virage ne fait qu'étirer.** Mesuré
le 17/09 (la revue, sur le vrai corps dans la vraie salle des orbites) :
un seul passage à 0,5-0,75 rayon garde 100 % du corps quels que soient
force et rayon, mais l'étire (rms 73 → 200 u à force 540, cœur 300 ;
→ 120 u à force 180) — le virage suivant déchire la traîne. Et un corps
qui s'éloigne **lentement** d'un cœur s'étire dans son halo (le dos, plus
près, est freiné plus que le front) : rms 80 → 150 u en 1,5 s. Sur trois
virages, aux défauts (cœur 300, force 540), le meilleur lancer laissait
55 % du corps ; cœur 450 et force 300, il arrive entier. D'où les puits
des orbites, hors défauts.

**Règles de conception.** Une orbite se pose à moins de 0,8 rayon du
puits — et un enchaînement de virages à moins de 0,75 rayon, dans des
cœurs larges (450 pour un corps de 900) sous une force modérée (300). Le
halo ne sert qu'aux transferts, traversés vite ; une cible se pose juste
à la sortie d'un cœur, avant que le halo n'étire. Deux cœurs ne se
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
Elle ne se dessine **que dans l'éditeur** : c'est un outil de conception
(le concepteur, 17/09 : « je l'imaginais que dans l'éditeur »). En jeu,
rien ne trahit l'avenir — seule la prévision exacte se demande.

**La prévision exacte** (touche **P**, redéfinissable) : une copie du
solveur (`FluidSim.copiePourPrevision`, l'état de chaque particule et le
tableau entier) avance à part, par tranches de 6 ms par image, et écrit en
trait plein la vraie trajectoire du centre sur trois secondes. Effacée à
toute éjection ou changement d'état, et à chaque salle ; muette tant que
l'impulsion de départ attend (le corps n'est pas lancé). Un pas à 900
particules coûte quelques millisecondes : la ligne se lit en train de
s'écrire. **Elle ne joue que les puits** : la copie ne reçoit ni le
souffle du sas, ni les chasses, ni le vortex — dans une salle qui les
mêle aux puits, la ligne s'en écarte (à ajouter si une telle salle naît).

**Le dessin en jeu** (`src/game/puitsDessin.ts`, pur ; le concepteur, 17/09 :
« supprime le cercle visible en jeu, des particules pour identifier les
puits et leur aura » — puis, devant des lueurs qui tournaient : « il n'y
a pas de sens dans la gravité »). Plus d'anneau : une **aura** (un dégradé
qui s'éteint à la portée, sinon à 1,6 rayon), un **noyau** au centre (la
masse, sa taille dit la force) et **la chute** : des grains qui tombent
droit vers le centre, lâchés sans vitesse, à l'accélération du solveur,
et renaissent. Aucun sens de rotation. Le cœur a une propriété qui se
voit : harmonique, un grain lâché de n'importe quelle distance du cœur
arrive au centre au même instant, T/4 = (π/2)·√(rayon/force) — les
grains du cœur tombent en cadence, une respiration, et le liseré du
noyau respire avec eux ; ceux du halo traînent. On lit l'étendue,
l'allure et la lisière sans un trait. L'éditeur garde l'anneau du cœur et
la portée (des outils de conception) et ajoute la chute figée.

## 5. Le mini-jeu « Les orbites »

Trois puits **en quinconce** (le croquis les alignait ; mesuré : alignés,
trois lancers sur huit mille enroulent les trois puits et aucun sans
rebondir sur un bord — en quinconce, des centaines, aux sens alternés),
au cœur de 450 u et à la force de 300 u/s² (pas les défauts : voir §2,
le corps arrivait en morceaux). Le corps naît lancé (angle 36°, 260 u/s)
et la gravité le porte : un virage autour du premier puits, un autour du
deuxième de l'autre côté, un autour du troisième, puis il sort de ce cœur
vers le **croissant**, un arc hydrophile où il se colle. Trois
anneaux jalonnent ce chemin, dans l'ordre. À chaque seconde : **laisser
porter** (gratuit, le prochain anneau dit où aller, P dessine la
trajectoire exacte) ou **corriger** d'une éjection (chaque goutte coûte,
la jauge et la silhouette le disent). Verdict : la
part du volume gardée (intact ≥ 90 %, écorné ≥ 70 %, entamé ≥ 45 %), un
palier de moins par anneau manqué, rien sans le croissant.

Le lancer, les anneaux (posés à mi-virage) et la cible (une demi-seconde
après la sortie du troisième cœur) ont été **trouvés par une recherche**,
pas à la main : `RECHERCHE_ORBITES=1 RECHERCHE_ORBITES_F=300
RECHERCHE_ORBITES_R=450 RECHERCHE_ORBITES_VRAIS=64 pnpm vitest run
src/game/orbites.recherche.spec.ts` balaie la hauteur du départ, l'angle
et la vitesse, exige un vrai virage autour de chaque puits (au moins un
tiers de tour, à 0,3-0,75 rayon du centre — traverser le cœur en plein
milieu balaie 180° sans tourner), puis **le vrai corps rejoue les
meilleurs dans la vraie salle** (croissant compris, relabel au pas du jeu)
et imprime la part gardée au verdict. Deux tests de garde : le point-masse
passe les anneaux et finit dans la cible ; le **vrai solveur** (900
particules) refait toute la salle, passe les trois anneaux, finit dans le
croissant et y arrive au-dessus du premier palier — le meilleur verdict
s'obtient sans un geste. Si la physique ou les puits changent, on refait
la recherche — jamais on ne déplace un anneau ni un palier à la main.

## 6. L'éditeur (`?editeur`)

- **L'outil « Puits de gravité »** (palette Mécanismes) : un clic pose le
  puits, le glisser qui suit règle le rayon du cœur (moins de 40 u : le
  défaut reste). Il se sélectionne au centre, se déplace, se duplique
  (D), se supprime, se copie-colle et se pave comme une pastille.
- **Sa fiche** : la force (curseur, 50 à 3 000 u/s²), le rayon du cœur
  (40 à 1 200 u), la portée (0 : tout le tableau), X et Y. Le défaut
  efface la clé : le fichier ne porte que ce qui diffère du code. La fiche
  dit la période du cœur, la vitesse circulaire au bord et l'évasion, et
  rappelle la règle : les orbites vivent dans le cœur.
- **La fiche du départ** gagne l'impulsion : l'angle (curseur, 0 est, 90
  nord) et la vitesse (0 : né immobile). Une flèche la dessine au départ.
- **La ligne prédite** se dessine depuis le départ dès qu'il y a une
  impulsion ou un puits : douze secondes de point-masse (`traceTrajectoire`,
  la loi du solveur, les parois, les portes comptées fermées), un
  pointillé qui pâlit, un cercle à chaque rebond, les secondes tous les
  deux secondes. Elle se recalcule à chaque réglage : un curseur qui bouge
  déplace la ligne.
- **« Prévision exacte »** (bouton de la barre) : le vrai solveur, sans
  écran, sur ce tableau — le corps né au départ, lancé, sous les puits —
  écrit en trait plein la trajectoire de son centre sur douze secondes,
  par tranches pour que l'éditeur reste vivant. Toute modification
  l'efface.
- Le survol raconte le puits (la bulle savante) ; `checkLevel` avertit
  d'un puits hors cuve, d'un départ au fond d'un cœur sans impulsion, de
  deux cœurs qui se recouvrent.

## 7. La ronde (`Voir la ronde (démo)`, `__ronde()`)

Le concepteur (17/09, croquis) : « un niveau où le volume tourne non stop
autour de ces trois centres de gravité, en glace ». Trois puits alignés
sur x = 0 (écart 800, cœur 350, force 600), toute la salle en zone de
glace, le bloc lancé de (−200, 0) droit vers le haut à 451 u/s : il
enchaîne les trois puits en **un huit à trois lobes** (le sens s'inverse à
chaque lobe) et se referme sur lui-même, **sans fin**. Un tour dure
13,45 s. Rien ne se pilote : on regarde. Sans sas (`sansSas`, `ronde.ts`).

**L'orbite est tirée, pas devinée** (`src/game/ronde.recherche.spec.ts`,
la commande dans le fichier). Une orbite périodique dans un champ à trois
centres : par symétrie, un lancer qui part de (−a, 0) droit vers le haut et
recoupe y = 0 à angle droit après avoir contourné le puits du haut est
fermé — la moitié du bas est le miroir de la moitié du haut. Deux
inconnues (a, v), une condition : une famille à un paramètre, tirée par
bissection. Ce qui a été mesuré :

- **La stabilité se mesure**, elle ne se suppose pas : un écart de 1 u au
  départ, combien après vingt tours ? La famille à un tour par lobe tient
  (quelques unités) tant que le croisement reste dans le cœur ; elle se
  déchire au-delà (des centaines d'unités en cinq tours). Les orbites à
  plusieurs tours par lobe sont toutes instables.
- **Le cœur fait la forme** : cœur 300 pour un écart de 650, le lobe du
  haut est plat (164 au-dessus du puits) ; cœur 350 pour 800, il est rond
  (224) ; cœur 450, les lobes s'étranglent. La force ne change que le
  tempo (T ∝ 1/√force).
- **Le corps n'est pas un point** : lancé sur l'orbite du point-masse, le
  bloc s'en écartait de 40 u/s dès le premier croisement (la moyenne du
  champ sur son disque, dans le halo) et de 300 u après un tour. La
  recherche tire donc avec le champ moyenné sur un disque de 103 u ; la
  famille tient alors jusqu'à a = 210 et se déchire à 220. Le tableau
  prend a = 200.
- **Le vrai solveur confirme** (`src/sim/ronde.spec.ts`, six tours ;
  mesuré : vingt-cinq tours, 336 s) : le bloc repasse par (−200 ± 0,6, 0)
  à chaque tour, vitesse droite à ±7 u/s, période 13,45 s, entier, sans se
  tasser — avec la vitesse arrondie à l'entier, celle que l'éditeur écrit.
