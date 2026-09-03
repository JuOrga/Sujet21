# Les capacités — des transformations qui n'existaient pas

> Branche d'essai issue de `prod` (03/09/2026). Ce document décrit ce qui a
> été construit, ce que chaque geste fait exactement, et comment l'éprouver.
> Rien n'est gravé : c'est une planche d'essais à jouer, à garder, à jeter.

## L'idée

Jusqu'ici une récompense **modulait** une règle existante : un dash de plus,
une éponge qui mord moins, un sas qui aspire plus loin. Les cinq cartes de
cette branche **ouvrent un geste** qui n'est pas dans le jeu sans elles. Le
principe reste celui du dépôt — une carte est une liste d'effets, chaque
effet tire un **levier**, et le solveur lit les leviers au chargement du
tableau — mais ces leviers-là ont une propriété nouvelle : à leur valeur
neutre, **le geste n'existe pas**, et le solveur joue exactement comme avant
la carte. C'est ce qui permet de les livrer sans toucher aux 788 tests qui
décrivent le jeu d'avant : chacune est testée dans les deux sens (avec la
carte / sans la carte).

Toutes tiennent dans la physique du corps. Aucune n'est un pouvoir posé
par-dessus : l'esquille est une réaction, la surfusion est un état réel de
l'eau, le coussin de Leidenfrost est celui de la goutte sur la plaque
chaude, et le ricochet est ce que fait un jet qui frappe une paroi.

## Les cinq gestes

### ❄ ESQUILLE — *la glace se propulse, en se rétrécissant*

**Le geste.** En glace, **toucher** (souris, doigt, gâchette) détache un
éclat du bloc vers le point visé. Le palet part à l'opposé — réaction
exacte, comme l'éjection liquide : *se déplacer, c'est rétrécir*, en glace
aussi. L'esquille est un vrai petit palet : rigide, balistique, elle
rebondit sur les parois… et peut revenir **percuter** le bloc, ou s'y
ressouder au contact. Hors du corps, elle fond comme toute glace en ~1 s et
ses gouttes se récupèrent (elles sont marquées « du corps »).

**Le levier** `esquille` : la part du bloc qui part par touche, 0 à 30 %.
Jamais sous 3 particules, jamais au point de dissoudre le palet (un cœur de
6 particules reste, et sous 8 particules gelées rien ne part). La carte
livrée en donne 15 %.

**Mesuré** (bloc de 60 particules à l'arrêt, 15 %) : 9 particules partent
à 980 u/s, le bloc recule à 173 u/s.

Pourquoi c'est amusant : la glace était jusqu'ici un état *subi* — on
choisissait une trajectoire et on la regardait. Avec l'esquille, on peut la
corriger, à un prix qu'on voit partir. Et l'éclat qui revient est un petit
drame à chaque tir.

### 🧭 GOUVERNAIL — *la glace se pilote, sans rien dépenser*

**Le geste.** En glace, **maintenir** le pointeur infléchit la course du
palet vers lui. La vitesse **tourne**, elle ne change pas de norme : rien
n'est dépensé, rien ne s'accélère, l'élan reste celui qu'on a choisi.

**Le levier** `gouvernail` : la vitesse angulaire de l'inflexion, 0 à
3 rad/s. À 1,5 (la carte livrée), un quart de tour en une seconde ; à 3, un
tour en deux secondes — le palet **fait des cercles** (c'est le palier T3 de
la table de récompenses du document de conception : « glissade abusée,
possibilité de faire des cercles »).

**Mesuré** (3 rad/s, viser derrière soi) : demi-tour complet en 1,05 s,
norme de vitesse conservée à 200,0 u/s.

Esquille et gouvernail cohabitent sur le même bouton : *toucher* détache,
*maintenir* pilote. La carte **Grêlon** donne les deux d'un coup, contre un
palet plus mou et une bonbonne plus petite.

### 🌡️ SURFUSION — *l'eau qui cristallise au choc*

**La physique.** De l'eau pure, refroidie doucement sous 0 °C, reste
liquide : elle est *surfondue*. Un seul germe — une poussière, un choc — et
tout le volume cristallise d'un coup. C'est un état réel, et il est
exactement ce qu'il faut à ce jeu.

**Le geste.** Avec la carte, le bouton GLACE n'immobilise plus sur place.
Le corps **s'arme** : le givre monte juste sous le gel (0,95), le corps
reste **liquide et pilotable** — l'éjection marche, le rassemblement
aussi — et il cristallise **d'un coup, en entier, dans son élan** au
premier choc franc contre une paroi (vitesse d'impact > 60 u/s). Il devient
alors un palet, qui rebondit comme un palet. Une plaque froide gèle comme
toujours, surfusion ou pas : c'est le gel *volontaire* qui change.

**Ce qui ne change pas.** Une glace **imposée** — zone forcée, dernière
impulsion de la fin de course — fige sur place : la surfusion ne vaut que
pour une glace décidée (`surfusionLibre`, posé par le jeu à chaque image).

**Mesuré** (80 particules à 250 u/s vers un mur à 300 u) : prise à
t = 1,06 s, 80 particules gelées sur 80, le palet repart à −110 u/s.

Pourquoi c'est amusant : on garde la propulsion jusqu'au dernier instant
et on **choisit le mur** où l'on devient glace — le gel n'est plus un pari
sur une trajectoire, c'est un pari sur un impact. Et le corps armé se voit :
il est givré sans être pris.

### 🍳 LEIDENFROST — *la goutte qui danse sur la plaque chaude*

**La physique.** Une goutte posée sur une plaque bien plus chaude que son
point d'ébullition ne bout pas : sa face inférieure se vaporise
instantanément et la goutte flotte sur ce coussin de vapeur, isolée de la
plaque, en glissant sans frottement. C'est l'effet Leidenfrost.

**Le geste.** Il n'y en a pas : c'est un état du liquide. Près d'une
chaudière, l'aura **repousse** le corps liquide (une poussée normale à la
plaque, proportionnelle à l'exposition — un bumper de chaleur, du même
ordre que la répulsion hydrophobe) et **l'isole** : seule l'exposition qui
perce le coussin compte, pour la chauffe comme pour le seuil des 95 % qui
déclenche la vaporisation. Un corps qui frôle l'aura n'y bascule plus ; un
corps qu'on y enfonce, si.

**Le levier** `leidenfrost` : la part d'aura isolée, 0 à 0,8. La carte en
donne 0,5 : la vaporisation ne s'enclenche qu'à mi-profondeur d'aura.

**Mesuré** (le rig du test « catapulte » de heat.spec : 300 particules à
150 u/s vers une chaudière) : sans la carte, 100 % du corps baigne après
3 s ; avec 0,5, **0 %** — le corps est refoulé à x = 22 (parti de 60), en
recul à 132 u/s. Le coussin ne porte que le liquide : la glace dégèle et
la vapeur s'évapore exactement comme avant.

Pourquoi c'est amusant : la chaudière, jusqu'ici un piège à éviter, devient
un **bumper** pour l'eau — et l'hydrophobe en est déjà un pour la glace.
Chaque état finit par avoir sa paroi qui rend.

### 🎱 RICOCHET — *le dash se joue à la bande*

**Le geste.** Dans la fenêtre qui suit un dash (0,8 s), le nuage qui frappe
une paroi **repart** : la composante normale que la résolution de contact
efface lui est rendue, à la restitution près. Chaque rebond rouvre la
fenêtre — tant que ça touche, ça rebondit — et c'est le flottement du gaz
qui finit par l'éteindre. Un nuage qui *dérive* contre une paroi sans dash
s'y écrase comme avant : la fenêtre est celle du dash. Le souffle chassé
(qui n'est plus à vous) ne rebondit pas non plus.

**Le levier** `ricochet` : la restitution, 0 à 1. La carte en donne 0,65 ;
**Bille de vapeur** donne 1 (aucune perte au rebond) contre un nuage qui
s'évapore moitié plus vite au repos.

**Mesuré** (dash de 820 u/s sur un mur à 400 u, 0,9 s plus tard) : sans la
carte, le nuage est collé au mur (vx = +4) ; à 0,65, il repart à −154 u/s ;
à 1, à −243 u/s.

Pourquoi c'est amusant : le dash devient un **coup de billard**. Un couloir
en coude se prend d'un seul dash, en bande, et le compte de dashs prend une
autre valeur.

## Les cartes livrées

| Carte | Icône | Effets | Calibre |
| --- | --- | --- | --- |
| Esquille | 💠 | esquille 0,15 | commun |
| Gouvernail | 🧭 | gouvernail 1,5 | commun |
| Surfusion | 🌡️ | surfusion 1 | majeur |
| Coussin de Leidenfrost | 🍳 | leidenfrost 0,5 | notable |
| Ricochet | 🎱 | ricochet 0,65 | notable |
| Grêlon | 🌨️ | esquille 0,2 · gouvernail 2,5 · rebondGlace ×0,7 · bonbonne −2 | majeur, contrepartie |
| Trempe | 🔩 | surfusion 1 · rebondGlace ×1,2 · bascule ×1,35 | majeur, contrepartie |
| Bille de vapeur | 🪩 | ricochet 1 · perteVapeur ×1,5 | majeur, contrepartie |

Le calibre est **déduit** des leviers (instruments.ts), jamais saisi. Les
cinq leviers sont dans l'atelier des Récompenses, famille « Les états » :
on peut y forger d'autres combinaisons sans écrire une ligne, à n'importe
quelle valeur de la plage.

## Où c'est écrit

- `src/game/leviers.ts` — les cinq leviers, leurs plages, leurs phrases.
- `src/game/instruments.ts` — les huit cartes.
- `src/sim/solver.ts` — la physique : `esquille()`, `gouverneGlace()`,
  `applyRicochet()`, et dans `processCold` la surfusion (germe + armement)
  et le coussin de Leidenfrost (poussée + isolation).
- `src/main.ts` — le branchement : les leviers posés dans `createSim`, la
  touche en glace (front) pour l'esquille, le maintien dans le pas physique
  pour le gouvernail, `surfusionLibre` à chaque image, un retour manette à
  la cristallisation.
- `src/sim/capacites.spec.ts` — 18 tests, chaque geste dans les deux sens.

## Comment l'éprouver en jeu

1. Pousser la branche sur la gâchette d'aperçu — jamais un déploiement
   automatique :
   ```bash
   git push -f origin claude/roguelike-rewards-transformations-dzoyc1:previsu-go
   ```
   L'adresse s'affiche en tête du résumé de l'exécution `deploy`.
2. Dans l'aperçu, ouvrir l'écran **Récompenses** (mode concepteur, `?dev`)
   et « emporter » une carte pour la run : les cinq gestes sont dans la
   famille « Les états ». La sonde console `__levier('surfusion')` dit ce
   que vaut chaque levier.
3. Ce qu'il faut regarder, carte par carte :
   - **Esquille** : la lisibilité de l'éclat qui part (il a le même rendu
     que la glace, il faudra peut-être une traînée), et le retour — trop
     fréquent ? pas assez ?
   - **Gouvernail** : 1,5 rad/s est-il trop docile ? Le T3 à 3 rad/s
     tourne en rond, c'est voulu ; à 2 la glace pourrait déjà trop se
     laisser conduire dans les tableaux à rideaux.
   - **Surfusion** : le corps armé est-il assez distinct du gel ? (le givre
     à 0,95 se rend comme de la glace ; un frémissement ou une teinte à
     part serait sans doute mieux). Le seuil de choc à 60 u/s : une paroi
     frôlée doit-elle germer ?
   - **Leidenfrost** : 1 800 u/s² de poussée à coussin plein — est-ce trop
     de bumper ? Le corps est refoulé nettement ; les tableaux où la
     chaudière est le passage obligé (mécanique 2) deviennent plus durs,
     pas impossibles (on peut s'enfoncer).
   - **Ricochet** : l'angle de sortie (le nuage ne rebondit pas comme un
     bloc, chaque particule repart de son point) et la fenêtre de 0,8 s.

## Ce qui n'est pas fait, et pourquoi

- **Aucun rendu propre** aux gestes : pas de traînée d'esquille, pas de
  teinte de surfusion, pas d'éclair de ricochet. C'est délibéré : on
  éprouve d'abord la *physique* ; le rendu vient quand un geste est retenu.
- **Aucun son** : un retour manette seulement (esquille, cristallisation).
- **Le codex et les trophées** ne consignent pas ces gestes.
- **Les zones forcées** ne sont pas touchées : une zone qui impose la
  glace fige sur place, avec ou sans surfusion. Le coussin de Leidenfrost
  ne s'oppose qu'à l'*aura* des chaudières, pas à une zone qui impose la
  vapeur.
