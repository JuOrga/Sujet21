# Les routes de Sujet 21 — le système, ses paramètres, ses pistes

> Le document de synthèse demandé le 16/09/2026 : ce que la route d'une run
> met en jeu (transformations, chaleur, biome, difficulté, récompenses,
> salles bonus, natures de salle), comment ces éléments se tiennent, où le
> concepteur règle chaque paramètre, et ce qui reste à inventer pour que le
> jeu cesse de citer Slay the Spire et parle sa propre langue. La carte
> elle-même est décrite dans `carte-station.md` ; ici, la mécanique.

---

## 1. Les deux échelles d'une route

Une run se choisit à deux échelles, et chaque échelle a son écran.

### 1.1 La station — la grande carte

![La grande carte de la station : douze modules, tous des biomes, du hub à l'observatoire](routes/station.png)

La station est découpée en **modules**. Chaque module est un **biome** : un
ensemble de six salles, une nature dominante (combat, énigme), une
température, parfois un cran de confinement. Plusieurs modules peuvent
porter le même biome. La grande carte ne montre **que** des biomes — ni
haltes, ni « ? », ni types de tableau : ceux-là vivent dans le module.

On y choisit **le module suivant**, à la sortie de chaque module. Le survol
d'un module dit ce qu'on y trouvera, par types et sans compter — « on y
trouve : eau, glace, figures, rencontre, économat, alcôve » —, ce que la
porte ouvre juste après, et ce qu'elle ferme (les modules qu'on ne pourra
plus joindre s'éteignent).

### 1.2 Le module — la mini-carte

![La mini-carte d'un module : six rangs sur trois voies, les tuiles des salles, des rencontres et des haltes](routes/mini-carte.png)

Dans un module, les six salles se **tissent** en six rangs sur trois voies,
depuis une graine (celle du jour, commune à tous les postes, ou celle de
la run). Entre deux salles, la mini-carte montre ce qui vient : chaque
tuile porte l'icône de sa nature — une salle (eau, glace, vapeur, toutes
mécaniques ; figure ; tableau du pool), une **rencontre** (le « ? », on ne
sait pas laquelle), ou une **halte** (l'économat, l'alcôve, la bonbonne
oubliée, la cache à orbe). Les portes proposées sont les tuiles joignables
depuis celle qu'on vient d'ouvrir : **ouvrir une porte ferme les autres**.

Les deux s'emboîtent : la carte décide du **biome** (la température, le
cran, la nature dominante, la cache), la mini-carte décide du **rythme**
(salle, rencontre, halte) et ferme les voies qu'on n'a pas prises. La
longueur d'une run n'est pas un réglage : elle découle du trajet — trente
salles sur la carte livrée, cinq biomes de six.

---

## 2. Ce qui fait la matière d'un choix

Un choix ne vaut que si les options se distinguent **avant** qu'on les
prenne. Voici les six leviers qui distinguent deux routes, et ce que le
joueur en lit.

### 2.1 Les transformations acquises — les cadenas

Une coursive peut exiger un **orbe d'essence de conscience** (glace :
solidification, vapeur : vaporisation). Un cadenas lit un ACQUIS durable,
pas l'état du corps à l'instant : la carte se lit comme une progression.
Le contrat du §9.3 du document fonctionnel tient : un déblocage ouvre un
chemin **latéral**, jamais un raccourci — toutes les routes de la carte
livrée font trente salles, à une près.

*Ce que le joueur lit* : le cadenas sur le plan, l'orbe qui manque dans la
fiche, la secousse quand il insiste.

### 2.2 La chaleur — le climat d'une route

Chaque module porte une température. Elle fait le **climat** des dangers
des salles générées : sous 10 °C des hublots fendus (le froid, sur la
coque), dès 45 °C des chaudières, entre les deux le pile ou face. Une route
froide se joue en glace, une route chaude en vapeur : **la route est le
build**. Deux joueurs aux mémoires différentes ne prennent pas la même.

*Ce que le joueur lit* : la barre de température sous chaque module, la
couleur du nom.

### 2.3 Le biome — ce que la pioche ose

Un module est un biome : sa `nature` pose la posture des salles (combat :
dangers fréquents, pas d'énigme ; énigme : aucun danger, un faisceau à
lire ; cache : la cachette toujours), son `biome` filtre les tableaux du
pool, et la mini-carte tisse ses six salles avec les mécaniques que les
mémoires permettent.

*Ce que le joueur lit* : le glyphe du module, la nature dans la fiche, les
icônes de la mini-carte.

### 2.4 La difficulté — la rampe et le cran

La rampe du plan monte de 0 au plafond sur la longueur de la run, en dents
de scie (respiration), avec une finale à prendre. Le **cran** d'un module
s'y ajoute : « plus difficile, plus généreux » — la mémoire du sas se
multiplie par 1 + cran. Une rencontre peut aussi **réveiller la station** :
un cran promis à la prochaine salle, qui s'éteint quand il est servi.

*Ce que le joueur lit* : le « +1 » au coin du fût, « CONFINEMENT +1 ·
MÉMOIRE ×2 » en tête du choix de salle, « LA STATION EST RÉVEILLÉE ».

### 2.5 Les récompenses — ce qui dépend des premiers choix

C'est ici que la stratégie se noue. Les récompenses de Sujet 21 sont de
quatre monnaies, et les premiers choix les orientent :

| Monnaie | Durée | Où elle vient | Où elle va |
| --- | --- | --- | --- |
| **Condensat** | la run | chaque sas, les rencontres, le don | l'économat, les cartes payantes du tirage |
| **Mémoire** | durable | chaque sas (×2 sous cran), les rencontres | le marchand du hub : orbes, améliorations |
| **Instruments** | la run | les paliers d'étalonnage, les rencontres | des leviers sur le corps et les états |
| **Essence maximale** | la run | 100 % au départ, **rognée** par les sacrifices | ce que le corps a en naissant dans chaque salle |

Ce qui fait dépendre la fin du début :

- **Prendre la route sous cran tôt** donne de la mémoire tôt, donc des
  orbes plus vite au prochain passage au hub — c'est un pari sur la run
  suivante autant que sur celle-ci.
- **Sacrifier de l'essence** au décanteur achète un instrument fort, mais
  chaque salle jusqu'à la fin se joue avec un corps plus petit : le prix se
  paie trente fois.
- **Passer par l'économat** en acte 1 vaut si l'on a du condensat, donc si
  l'on a livré ; passer par l'alcôve vaut si l'on a perdu un échantillon.
- **Les orbes des caches** sont durables et une fois par poste : la route
  qui les vise ne sert qu'une fois — après, elle ne vaut que par ses salles.

### 2.6 Les salles bonus — les haltes

Les haltes sont des **nœuds de la mini-carte**, posés au tissage du
module : tant d'économats, d'alcôves et de bonbonnes par module (le plan
de descente en décide), et une cache quand le module recèle un orbe (la
carte en décide). Elles prennent la place d'une salle, jamais au premier
rang, jamais la dernière salle d'un rang. Comme les rencontres, elles
s'évitent en changeant de voie — et c'est ce qui en fait un choix : viser
l'alcôve, c'est renoncer à la salle d'à côté.

---

## 3. Les natures de salle

Ce qui existe, ce qui est proposé.

### 3.1 Ce qui existe

| Nature | Où | Ce que c'est | Ce qui se règle |
| --- | --- | --- | --- |
| **Combat** | module (grande carte) | des salles à dangers fréquents, sans énigme au faisceau | la nature du module (éditeur de carte) |
| **Énigme** | module (grande carte) | aucun danger, une énigme au faisceau garde le passage | idem |
| **Terminal** | module (grande carte) | la Pompe (`boss-pompe.md`) | — |
| **Salle** | nœud de la mini-carte | un tableau à jouer : sa mécanique, figure ou compartiments, tableau du pool ou générée | le plan (figures, tableaux écrits, pioche) |
| **Rencontre** | nœud de la mini-carte | du lore, deux ou trois offres, des issues pesées | la part, le rang minimal (LA DESCENTE), le catalogue `evenements.ts` |
| **Économat** | nœud de la mini-carte | le Semblable troque contre du condensat | économats par module (LA DESCENTE) |
| **Alcôve (repos)** | nœud de la mini-carte | un souffle, de la réserve ou du condensat — un seul des trois | alcôves par module ; `REPOS_RESERVE_L`, `REPOS_CONDENSAT_CL` |
| **Bonbonne oubliée (don)** | nœud de la mini-carte | de la réserve, ou du condensat si elle est pleine | bonbonnes par module |
| **Cache** | nœud de la mini-carte | un orbe d'essence, une fois par poste | `orbe` du module (éditeur de carte) |

Le modèle de carte garde les natures de module `economat`, `repos`, `don`,
`inconnu` et `coffre` : l'éditeur peut encore poser une halte ou un « ? »
sur la grande carte, et le jeu sait les jouer — mais la carte livrée n'en
a plus, par décision du concepteur (16/09).

### 3.2 Ce qui est proposé — les mini-jeux sur la physique du corps

Le concepteur veut des salles qui soient des **mini-jeux à partir du volume
du joueur**. Sujet 21 a un atout qu'aucun deck-builder n'a : le corps est
une simulation de fluide, et tout ce qu'on lui fait faire est déjà une
règle. Six propositions, chacune une salle sans sas ordinaire, chronométrée
ou comptée, où la physique EST le jeu :

| Mini-jeu | Ce qu'on fait | Ce qu'on mesure | Ce qu'on gagne |
| --- | --- | --- | --- |
| **La pesée** | remplir une cuve graduée avec exactement N litres de soi, ni plus ni moins | l'écart au trait | la précision paie en mémoire : ±5 % ×3, ±15 % ×1 |
| **La scission** | se couper en deux masses égales sur deux plateaux de balance | l'égalité des deux masses au bout de dix secondes | un instrument si la balance est à l'équilibre |
| **Le tamis** | passer une grille fine sans perdre plus de X % — en vapeur c'est facile, en eau c'est un art | le volume perdu | du condensat au prorata de ce qui passe |
| **La tenue** | rester en glace sur une plaque chaude le plus longtemps possible | le temps avant la fonte | une prime de glace au sas |
| **Le pont** | figer un jet pour faire pont au-dessus d'un vide, et le traverser avant qu'il ne fonde | réussir ou tomber | l'accès à une cache derrière |
| **La cible** | éjecter des gouttes sur des cibles, chaque goutte est une part de soi qui ne revient pas | les cibles touchées contre le volume dépensé | un tirage d'instrument par cible, mais on repart plus petit |

Chacun s'appuie sur un fait du modèle : la conservation du volume, la
fusion des masses, les états, la tension de surface. Aucun n'ajoute une
règle — c'est ce qui les rend compatibles avec le pilier « la physique
produit les règles ». Ils s'insèrent comme une **nature de nœud** de la
mini-carte (`'minijeu'`), au même titre que les rencontres, avec leur part
réglable au banc.

---

## 4. Là où le concepteur tourne les boutons

Tout paramètre de route a un réglage. Aucun n'est un nombre écrit dans le
code sans nom.

### 4.1 L'éditeur de carte (`?carte`)

| Paramètre | Sur quoi | Effet |
| --- | --- | --- |
| `niveaux` | module | le nombre de salles (six sur la carte livrée) |
| `type` | module | la nature : combat, énigme, terminal (les haltes et le « ? » restent possibles, mais vivent dans la mini-carte) |
| `temp` | module | le climat des dangers ; la couleur du plan |
| `cran` | module | +cran de difficulté, ×(1 + cran) mémoire |
| `orbe` | module | l'orbe que recèle la cache posée dans la mini-carte du module |
| `biome` | module | le filtre des tableaux du pool |
| `condition` | type de coursive | l'orbe exigé (`orbe == solidification`) |
| la vérification | carte | deux routes minimum, distance équivalente, jamais deux crans d'affilée |

### 4.2 L'écran LA DESCENTE (le plan de voie)

| Section | Réglages |
| --- | --- |
| Le plan | plafond de difficulté, descente du jour, salles générées (coupées : toutes les portes de la mini-carte piochent dans le pool), tableaux écrits |
| La rampe | recul du sommet, respiration, finale |
| La posture des rangs | rangs sans danger, cadence labyrinthe, cadence contraste, figures au début et ensuite |
| **Les voies et les rencontres** | **part de rencontres** (0 à 60 %), **rang minimal**, **bifurcation** (0 à 100 %), **économats**, **alcôves** et **bonbonnes par module** (0 à 2) |
| La pioche | les quatre poids de l'écart au cahier |

Le plan se publie (magasin `/api/reglages`) : ce que le concepteur règle
joue pour tout le monde.

### 4.3 Dans le code, nommé et documenté

| Constante | Fichier | Rôle |
| --- | --- | --- |
| `ESSENCE_PLANCHER` | `evenements.ts` | l'essence ne descend jamais sous 40 % du plein |
| `REVELATIONS` | `carteStation.ts` | ce qu'un « ? » peut devenir |
| `REPOS_RESERVE_L`, `REPOS_CONDENSAT_CL` | `descenteCarte.ts` | ce que l'alcôve et le don rendent |
| `EVENEMENTS` | `evenements.ts` | le catalogue des rencontres : textes, offres, issues, effets |
| `CONTREPARTIES` | `instruments.ts` | les cartes qui coûtent |
| `postureDuModule`, `climatDuModule` | `descenteCarte.ts` | ce que la nature et la température imposent |

Ce qui devrait **rejoindre le banc** à la prochaine étape : les valeurs des
haltes (réserve, condensat), le plancher d'essence, le multiplicateur de
mémoire par cran — trois curseurs de plus dans LA DESCENTE.

---

## 5. Pour cesser de citer Slay the Spire — les pistes propres au jeu

Slay the Spire a donné la grammaire : nœuds typés, voies qui se ferment,
inconnu, élites, haltes. Ce qui suit n'existe dans aucun deck-builder,
parce que ça vient du corps d'eau.

### 5.1 La route se lit dans le corps

Dans Slay the Spire on lit sa route sur une carte. Ici le corps **est** une
carte : sa température, son état, sa taille sont visibles à l'écran, tout le
temps. Piste : **la coque de la station refroidit au fil de la run** (elle
le fait déjà : +21 ° au départ, −60 ° à froid complet), et **le climat d'un
module se compose avec la température de la coque**. Une route chaude
prise tard vaut un module tiède ; une route froide prise tard est
mortelle. La même carte ne se joue pas pareil selon quand on la traverse.
Le choix de route devient un choix de **tempo** : foncer par le froid tant
que la coque est chaude, ou garder le chaud pour la fin.

### 5.2 L'essence comme monnaie de route

Le sacrifice existe (le décanteur). Piste : **des coursives à péage
d'essence** — une porte qui ne s'ouvre qu'à un corps d'au moins N litres,
ou qui prend X % en passant. Une route « étroite » (passe en petit) et une
route « large » (passe en grand) : le volume décide de la carte, et la
carte décide du volume. Aucun autre jeu ne peut faire ça : les PV ne sont
pas une clé.

### 5.3 Les états comme clés rétroactives — et les coursives qui changent de sens

Le §9.2 du document fonctionnel : chaque état débloque des passages dans
des modules déjà connus. Piste concrète : **une coursive peut avoir deux
conditions**, une par sens. Vers l'avant elle exige la glace ; vers
l'arrière elle exige la vapeur. Une carte qui se traverse dans un sens en
glace et se remonte en vapeur — et **le retour sur ses pas devient une
route**, pas un pis-aller. Le module OBSERVATOIRE d'aujourd'hui pourrait
n'être qu'un milieu.

### 5.4 Le protocole s'affine — la carte se souvient des Semblables

Le §10 : chaque run est la n-ième tentative, le protocole s'affine. Piste :
**les vingt tentatives précédentes ont laissé des traces sur la carte** —
et ce sont les runs précédentes du joueur. Là où le Sujet 20 (la run
d'avant) s'est dispersé, une auréole sur le plan et une rencontre « le bac
des tentatives » qui parle de LUI, de sa route, de ce qu'il portait. Les
choix d'une run écrivent le lore de la suivante. Aucun texte à rédiger :
les données de la run suffisent (module, salle, volume, instruments).

### 5.5 La station se réveille — une horloge d'alerte

Le confinement promis existe. Piste : en faire **une jauge de run**. Chaque
action bruyante (réveiller un Semblable, saboter, piller) monte
l'ALERTE ; à chaque seuil, la station ferme une coursive sur la carte
(une porte de moins), ou ouvre une chasse. La carte **se rétrécit** au fil
de la run pour un joueur bruyant, s'ouvre pour un joueur discret. Le
choix de route devient aussi un choix de bruit.

### 5.6 Naître ailleurs — la carte lue à l'envers

Le §9.3 : sortir hors protocole (en glace, en vapeur) ne raccourcit pas le
parcours, il le **déplace** — autres modules, autres routes, distance
équivalente, confinement supérieur d'entrée de jeu. Piste : **trois
départs sur la carte**, un par état maîtrisé, à distance égale de
l'observatoire, et des transformateurs qui ne sont plus la première
colonne mais le milieu. Le joueur choisit sa difficulté en choisissant
comment il naît, et la carte qu'il croyait connaître se lit depuis un
autre bord.

### 5.7 Le volume comme mise — les mini-jeux

Le §3.2 ci-dessus. Ce qui les distingue de tout ce qu'un deck-builder
propose : la mise n'est pas de l'or, c'est **une part de soi qui ne revient
pas**. Chaque cible touchée est une goutte perdue. C'est la phrase du jeu
— se déplacer, c'est rétrécir — appliquée au risque.

---

## 6. L'ordre proposé

1. **Les trois curseurs manquants au banc** (haltes, plancher d'essence,
   mémoire par cran) — une soirée.
2. **La coque qui compose avec le climat** (§5.1) — le plus grand effet
   pour le moins de code : une lecture de plus dans `climatDuModule`.
3. **Un mini-jeu** pour prouver la forme (§3.2, la pesée), comme nature de
   nœud de la mini-carte.
4. **Les traces des Semblables** (§5.4) — le lore qui s'écrit tout seul.
5. **L'alerte** (§5.5), puis **les coursives à deux sens** (§5.3), puis
   **les trois départs** (§5.6) — chacun redessine la carte, et c'est le
   concepteur qui dessine.
