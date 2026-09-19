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

## 8. Le mini-jeu « Les cibles » — le tir de glace, les mires, la physique par tableau

Le concepteur (17/09, croquis) : la ronde couchée, le corps en glace, et
« envoyer des petits morceaux de glace venir toucher les cibles ».

**Le tir de glace** (`FluidSim.lanceEclat`, `params.glaceTir`) : en glace,
le même geste que le dash de vapeur — viser ralentit le temps
(`gasAimSlow`), relâcher DÉTACHE UN ÉCLAT : les particules les plus en
avant dans la direction du doigt (une part `glaceTir` du corps restant,
jamais moins de trois, jamais en laissant moins de trois au corps)
cessent d'être au corps, sont poussées hors du rayon de liaison et
partent à la vitesse du corps plus `glaceTirVitesse` × la puissance (la
distance du doigt, `gasDashRange`). L'éclat est un bloc rigide à part ;
il **reste glace** (le concepteur : « il reste en glace dans la salle »,
`processCold` le tient), il n'est ni rappelé ni dispersé, il rebondit sur
les bandes et s'agglomère à ses semblables. Le corps rétrécit à chaque tir
et **ne s'épuise jamais** : les éclats rapetissent avec lui. `glaceTir`
vaut 0 dans le jeu : ailleurs, en glace, rien ne part.

**Les mires** (`MireDef`, `LevelDef.mires` ; l'outil « Mire » de
l'éditeur : poser, glisser le rayon, les points dans la fiche) : des
cibles à points. `FluidSim.touchesMires` compte, à chaque image, chaque
éclat libre dont une particule est dans une mire — le bloc entier
disparaît (un amas compte pour sa taille entière), la mire reste. Les
points (`pointsTouche`) : ceux de la mire × la taille de l'éclat rapportée
à l'éclat de référence (`reference` × le corps de départ, soit le premier
tir), plafonnés au double. Trente secondes ; verdict aux paliers 60 / 30 /
10 — une hypothèse, à éprouver en main.

**La physique par tableau** (`LevelDef.reglages`) : le concepteur, « pour
chaque tableau on doit pouvoir forcer un preset de la physique du volume ».
Dans le panneau Tableau de l'éditeur, un menu des presets du banc (livrés
et enregistrés) : choisir COPIE ses valeurs dans le tableau — le fichier
reste autonome, un preset qui change ou disparaît ne le touche pas ; le
menu retrouve le preset dont les valeurs sont celles du tableau, ou dit
« réglages propres ». `createSim` recouvre le banc de ces réglages puis de
ceux du mini-jeu, le temps de la salle, et rend tout à la suivante.
`levelIO` ne relit que les clés du banc, finies, et dit celles qu'il
écarte. Le preset « ⚙ Tir de glace » livré avec le banc porte le geste :
2 600 u/s à pleine puissance (« plus de vitesse d'éjection », le
concepteur, deux fois ; mesuré sur le solveur : un éclat ne traverse pas
un sol de 40 u jusqu'à 2 600 u/s, neutre ou hydrophobe — `tirGlace.spec` ;
c'est le plafond mesuré, on n'ira pas plus haut sans le remesurer).

**Le tir en carte, et les cartes par tableau** (`leviers.ts`,
`cartesTableau.ts`, `LevelDef.cartes`) : le concepteur, « le lancer de glace
en tant que buff, une carte qu'on peut mettre dans la run… et attribuer
n'importe quelle carte sur n'importe quel tableau, surcharger ». Deux
leviers : `glaceTir` (un AJOUT, neutre 0 : la part de l'éclat) et
`glaceTirVitesse` (un facteur). La carte « Éclateur » (🧨, `glaceTir` 0,1)
est au catalogue livré : elle se tire aux paliers, se fabrique à l'atelier
comme modèle, et donne le geste en glace dans n'importe quelle salle. Un
tableau peut IMPOSER des cartes (panneau Tableau → « Cartes imposées », une
case par carte du catalogue, contreparties et cartes d'atelier comprises) :
elles jouent le temps de la salle comme si le joueur les tenait, le HUD les
montre « imposées par la salle ». **La règle de priorité, en trois
couches** — la question du concepteur, « est-ce que ça n'entre pas en
conflit avec le preset défini par tableau ? et en cas de multicarte ? » :
le banc → le preset du tableau → les réglages du mini-jeu écrivent les
NOMBRES de la physique, clé par clé, le dernier gagne ; les cartes
n'écrivent jamais dans le preset, elles tirent des leviers lus PAR-DESSUS
(un facteur multiplie, un ajout s'ajoute) — le preset est la base, la carte
le modificateur, comme les patins de givre multiplient déjà la restitution
que le banc fixe ; plusieurs cartes suivent la règle des leviers (produit
des facteurs, somme des ajouts), et une carte tenue ET imposée ne compte
qu'une fois. Pour le tir : la part = preset + cartes, plafonnée à 50 % du
corps (`GLACE_TIR_PART_MAX`) ; la salle des cibles garde son preset (0,1),
un joueur qui y entre avec l'Éclateur tire des éclats de 0,2 — qui valent
double aux mires (le prorata, plafonné ×2) et rétrécissent le corps deux
fois plus vite : un vrai pari de carte. `checkLevel` le dit quand un
tableau cumule les deux, dit une carte inconnue du catalogue (l'atelier
d'un autre poste : gardée dans le fichier, inerte ici), et accepte
l'Éclateur imposé comme tir pour des mires. À savoir : hors des cibles, un
éclat n'a pas d'usage encore (il reste un bloc de glace libre, ni rappelé
ni compté) — la carte est un geste, pas un avantage, tant qu'aucune salle
ne lui donne une cible.

**Ce qui se sent** (le concepteur : « des effets satisfaisants et
gamifiés »). Une **jauge des paliers** au bord droit de la salle, graduée
aux trois paliers avec leur verdict, qui se remplit en glissant avec les
points et pulse au palier franchi (le haut vaut le premier palier et un
quart). Une **touche qui se sent** : le « +N » grossit avec la taille de
l'éclat, la mire touchée pulse, la touche sonne d'autant plus haut
qu'elle vaut, une touche pleine secoue la cuve et la manette ; une
**série** de touches à moins de deux secondes multiplie (×2 la deuxième,
×3 au plus) et s'annonce. **La fin du compteur** : les dix dernières
secondes, le chrono grossit, bat et tique ; à zéro, un coup, le monde se
fige, le total se compte chiffre à chiffre, le verdict se tamponne, puis
seulement la carte. Ces effets appartiennent au mini-jeu et se dessinent
à partir des données du tableau (les points des mires, les paliers et la
durée des règles) : rien à poser dans l'éditeur. Ce que l'éditeur règle,
lui, c'est les **règles** : le panneau « Mini-jeu : les cibles » (durée,
trois paliers) apparaît sur un tableau de cibles ; `checkLevel` exige des
paliers décroissants et au moins cinq secondes.

**Trouver la salle dans l'éditeur** : panneau de droite, « Modèles gravés
dans le jeu — ouvrir une copie », `MJ-CIBLES — Les cibles` (les autres
mini-jeux et la ronde y sont aussi). Le mini-jeu, ses mires et ses
réglages suivent la copie : « Essayer » joue la salle avec son chrono et
son compte. `levelIO` relit le mini-jeu tel quel (le type du catalogue,
ses règles) et filtre ses réglages comme ceux du tableau. **Publier** :
une copie enregistrée sous le code de la salle (`MJ-CIBLES`, `MJ-PALET`,
`MJ-ORBITES`, `MJ-RAFALES`, `DEMO-RONDE`) **prime sur la salle du code**,
au nœud de la descente comme au pupitre — la même règle que le hub et
l'Économat (`salleMiniJeu`, `main.ts`). Le couperet reste au code : son
trait se tire à la graine. Effacer le mini-jeu d'une copie en fait une
salle ordinaire, jouée telle quelle.

## 9. Le mini-jeu « Le métronome » — l'isochronie jouée

La proposition du 19/09, retenue par le concepteur : jouer la propriété
du cœur harmonique que rien n'exploitait encore — **la période ne dépend
pas de l'amplitude** (§1). Un seul puits (cœur 1 000 u, force 600 u/s² :
T = 8,1 s), le corps lancé de son centre à 116 u/s (150 u d'amplitude) :
il oscille de part et d'autre et repasse au centre toutes les 4,05 s,
quoi qu'on fasse. Mesuré sur le vrai corps (900 particules, sans un
geste) : onze passages en 45 s, tous à 4,05 s ± 0,1 — c'est le battement.

**Le jeu : pomper.** Une éjection ajoute Δv au corps ; l'énergie qu'elle
lui donne vaut v · Δv — tout au passage du centre, où v est la plus
grande, rien aux extrémités, où le corps s'arrête. Pousser en cadence,
dans la **fenêtre** du centre (160 u, une fois et demie le rayon du
corps ; dedans, la vitesse vaut plus de 85 % de son maximum dès le
premier anneau) et dans le sens de la marche, gonfle l'amplitude pour le
moins de gouttes. Trois **anneaux** concentriques (300 / 450 / 600 u) :
l'amplitude qu'il faut ; ils se passent forcément dans l'ordre. 45 s.
Verdict : la part du volume gardée (≥ 65 / 50 / 35 %), un palier de moins
par anneau manqué. La part compte ce qui fait corps **et** ce qui est en
prêt dans le halo : une poussée laisse des miettes derrière soi que le
rappel ramène, les compter mortes à l'instant du dernier anneau mentait
de 8 %.

**Ce que la mesure a imposé** (`sim/metronome.spec.ts`, trois joueurs sur
le vrai corps : en cadence, sans arrêt, rien) :

- **des éponges sur les quatre parois.** Sans elles, la cuve est un bol :
  chaque goutte éjectée montait jusqu'à la paroi, s'y arrêtait, puis
  retombait vers le centre à 900 u/s au travers du corps, à chaque
  battement — le corps en cadence perdait 41 % pour 28 % éjectés, et
  l'amplitude stagnait trois passages de suite (les gouttes rappelées lui
  rendaient leur élan à rebours). Les éponges boivent ce qui atteint la
  paroi : une goutte partie est partie. Le corps, lui, n'y arrive jamais
  (600 u au dernier anneau, la paroi à 1 150).
- **une éjection accordée** (`REGLAGES_METRONOME`) : 2 400 u/s au lieu de
  1 400 — à 1 400, gagner les 350 u/s qu'il faut coûte 25 % du corps
  avant la moindre miette, le barème ne tenait pas — et **24 gouttes par
  seconde au lieu de 32** : à 64, la salle se gagnait d'une seule poussée
  tenue depuis le centre, sans jamais revenir ; le battement ne servait à
  rien. Lente, la poussée ne suffit pas en un passage : il faut repasser,
  et c'est là que la cadence se paie ou se gagne.
- **les miettes** : à chaque poussée, ce qui n'est pas d'un seul tenant
  avec le corps à l'instant du recul ne le reçoit pas, reste en arrière
  et oscille à part, hors du halo — autant de perdu que d'éjecté. C'est
  le solveur, pas la salle ; les paliers le comptent.

Les nombres : en cadence (la fenêtre, le sens de la marche), le troisième
anneau en 22 s, six passages, 69 % gardés (16 % éjectés, 16 % de
miettes) ; sans arrêt, 6 s et 57 % ; rien, 100 %, aucun anneau. Les
paliers se posent entre les deux, avec de la marge pour une main moins
régulière que le banc. La garde du vrai corps tient les trois ; si la
physique ou les réglages changent, on remesure — jamais on ne déplace un
palier à la main.

**En jeu** : la fenêtre est un disque au centre, allumé quand le corps y
est (la consigne dit « POUSSEZ ») ; les anneaux passés sont verts, le
prochain bat en ambre ; un cercle fin dit l'apogée atteinte ; un cercle
s'ouvre au centre à chaque passage, avec un tic. **P** écrit la prévision
exacte, comme aux orbites. S'essaie sans run : « Jouer le métronome
(essai) », `__metronome()` ; dans l'éditeur, `MJ-METRONOME — Le
métronome` parmi les modèles gravés, et une copie publiée sous ce code
prime sur la salle du code, comme les autres.
