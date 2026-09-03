# Les mélanges imaginés — fluides étrangers, récompenses à boire, et la run noire

> Planche d'idées du 03/09/2026, seconde livraison : « des mélanges de
> fluides, l'absorption de récompenses, une evil run, et les capacités que
> cela pourrait donner ». Rien n'est construit. Même convention que
> `etats-imagines.md` : le geste, la traversée, le prix, le moment, le
> moteur.

## Le principe : le corps est de l'eau, le vaisseau est plein d'autre chose

Un laboratoire orbital ne contient pas que de l'eau. Il y a du liquide de
refroidissement dans les conduites, de l'azote liquide dans les cryobaies,
du carburant dans le bloc thermique, de l'huile dans les paliers, du
mercure dans les instruments, de l'alcool dans les réserves, de l'encre
dans les imprimantes, du sel dans les serres, du savon dans la douche, du
gel dans les cultures. Tout ça fuit, perle, flotte — en apesanteur, chaque
fuite est une sphère qui dérive.

**Le corps peut les boire.** Il absorbe par contact ce qu'il absorbe déjà
(la rosée, le condensat), et il devient un **mélange** : de l'eau à un
certain **titre** d'autre chose. Le titre est la seule variable : 0 %
c'est le Sujet pur, 100 % c'est l'autre fluide. Tout le reste en découle,
et c'est ce qui rend l'idée profonde plutôt que décorative :

- **un mélange a une physique**, calculée du titre — densité, viscosité,
  tension de surface, point de gel, point d'ébullition, mouillage ;
- **le titre se dilue et se concentre par le jeu même** : éjecter, c'est
  éjecter du mélange (le titre ne bouge pas), mais **changer d'état trie
  les fluides**. La glace exclut le sel — geler puis fondre le bord d'un
  corps salé, c'est le *dessaler* ; l'alcool bout avant l'eau — chauffer un
  corps alcoolisé, c'est le *distiller*. **Le cycle des états devient un
  outil de chimie**, et les mémoires tissées y prennent un second sens.

Deux familles de fluides, et deux façons de les porter :

- **miscibles** (sel, alcool, glycol, savon, encre, gel) — ils se
  dissolvent, le corps change de propriétés en proportion du titre ;
- **immiscibles** (huile, mercure, carburant, azote) — ils ne se mélangent
  pas : ils forment une **seconde phase** que le corps porte en lui — un
  noyau, une peau, des billes qui roulent dedans. Le corps a deux corps.

## I. Le catalogue des fluides — ce qu'ils donnent

### 🧂 SAUMURE (sel, les serres)

**Physique.** Le sel abaisse le point de gel et alourdit l'eau. À 20 %,
l'eau ne gèle plus qu'à −20 °C.

**Ce que ça donne.** *Antigel* : les plaques froides ne prennent plus
sur vous — le corps salé les traverse en s'engourdissant à peine. Un
cryobaie devient une salle comme les autres. *Lest* : plus lourd, le
corps résiste au sas et aux rails (moins happé), et pousse plus fort les
gouttes libres.

**Le prix.** Le sel ne s'éjecte pas : chaque goutte partie l'emporte,
mais le titre reste. Se **dessaler** demande de geler exprès une plaque
froide : la glace qui prend est pure, la saumure se concentre dans ce
qui reste liquide — on abandonne le liquide, on garde la glace. Et un
corps trop salé (>40 %) **ne gèle plus du tout** : la glace volontaire
est perdue, le sas ne donne plus la prime de glace.

**Le moment.** Passer une cryobaie entière en eau, à travers l'aura, en
regardant le givre glisser sur soi sans prendre.

**Moteur : facile** — un facteur sur freezeTime et sur l'aura froide, une
masse par particule dans les courants.

### 🍶 ESPRIT (alcool, les réserves)

**Physique.** L'alcool bout à 78 °C, gèle à −114 °C, mouille tout, et
s'évapore à l'air libre.

**Ce que ça donne.** *Volatil* : la vaporisation est **gratuite** — plus
de péage, et la bascule est instantanée — et le nuage est plus rapide.
*Mouillant* : l'hydrophobe ne repousse plus (l'alcool mouille le téflon).

**Le prix.** Le corps **s'évapore tout seul**, en continu, même en eau —
plus le titre est haut, plus vite. Et un nuage d'esprit près d'une
chaudière **s'enflamme** : une bouffée qui vous propulse violemment et
brûle un dixième du volume. Se **distiller** : chauffer un corps
alcoolisé sans intention, l'alcool part le premier — on perd du titre en
perdant de la vapeur.

**Le moment.** Le nuage qui passe devant la chaudière et s'allume : un
flash, un coup de canon, et le corps de l'autre côté de la salle.

**Moteur : facile** — vaporTollFrac, gasDashSpeed, une perte continue,
et l'inflammation est un dash forcé.

### 🫒 HUILE (les paliers, immiscible)

**Physique.** Elle ne se mélange pas : elle fait une **peau** autour de
l'eau, ou des billes dedans. Elle ne gèle pas, elle ne mouille pas, elle
glisse.

**Ce que ça donne.** *Peau* : le corps porte une pellicule d'huile qui
le rend **imperméable à la chimie** — l'hydrophile ne colle pas, l'éponge
ne boit pas, la membrane ne laisse pas passer (l'huile bloque). *Glisse* :
la glace huilée ne s'arrête jamais sur l'hydrophile.

**Le prix.** La peau **isole aussi de soi** : les gouttes éjectées ne se
réabsorbent plus (elles ont de l'huile dessus), le rappel ne les ramène
plus, et **la membrane devient un mur** — le seul passage de l'eau se
ferme. Se **déshuiler** : passer une grille (l'huile reste sur la maille)
ou chauffer (l'huile ne vaporise pas : elle reste derrière quand on part
en nuage).

**Le moment.** Traverser une éponge vivante sans qu'elle boive une
goutte, en la regardant chercher.

**Moteur : moyen** — la seconde phase est un kind de particule de plus,
qui reste liquide quand le corps change d'état.

### ⚗️ VIF-ARGENT (mercure, les instruments, immiscible)

**Physique.** Treize fois plus dense que l'eau, il ne mouille rien, il
perle en billes parfaites, il reste liquide à −39 °C.

**Ce que ça donne.** *Le boulet* : le mercure roule **au cœur** du corps
comme une bille lourde — le centre de masse est là où il est. Éjecter le
mercure (viser avec lui) donne une **propulsion énorme** pour une goutte
(treize fois l'élan). *Percussion* : un corps au mercure qui heurte une
porte ou un rideau les **enfonce**.

**Le prix.** Le mercure ne gèle pas et ne vaporise pas : **en glace, il
est une bille libre dans le bloc** (le palet a un cœur mobile, qui
déséquilibre ses rebonds) ; **en vapeur, il tombe** — il reste sur place
quand le nuage part. Et il est **toxique** : le titre grignote la
réserve d'échantillons.

**Le moment.** Le bloc qui roule avec sa bille dedans, et le rebond qui
part de travers parce que la bille était à gauche.

**Moteur : moyen** — le même kind que l'huile, avec une masse.

### 🛢️ CARBURANT (le bloc thermique, immiscible)

**Physique.** De l'hydrazine, qui s'enflamme au contact d'un catalyseur
chaud.

**Ce que ça donne.** *Le moteur-fusée* : viser une chaudière avec du
carburant en soi et éjecter — la goutte s'allume au contact de l'aura et
la **réaction est décuplée**. Une seule impulsion traverse une salle.
*La charge* : un bloc de glace au carburant qui heurte une chaudière
**explose** en nuage, avec l'onde du geyser.

**Le prix.** Il **brûle** : chaque bouffée coûte du corps. Et il ne se
sépare pas : une fois dedans, il y reste jusqu'à ce qu'il ait brûlé.

**Le moment.** L'allumage. Il faut un son qu'on n'oublie pas.

**Moteur : facile** — un multiplicateur d'éjection quand la goutte naît
dans une aura de chaleur.

### 🧊 AZOTE (les cryobaies, immiscible et volatil)

**Physique.** −196 °C. Au contact de l'eau il **bout instantanément** et
la gèle. Il s'évapore en quelques secondes à l'air libre.

**Ce que ça donne.** *L'armure* : une bulle d'azote bue gèle
**instantanément** la peau du corps — une coque de glace autour d'un cœur
liquide. Le corps rebondit comme un palet **et** se propulse (le cœur
éjecte à travers les failles de la coque). *Le gel projeté* : éjecter de
l'azote gèle ce qu'il touche — une goutte libre devient un glaçon, une
éponge vivante se fige.

**Le prix.** L'azote **s'épuise seul** en dix secondes : la coque fond
de l'intérieur. Et boire de l'azote coûte du corps : l'eau qu'il touche
en bouillant part en vapeur perdue.

**Le moment.** La prise instantanée, le craquement, et le corps qui
roule en boule de glace avec de l'eau qui bouge dedans.

**Moteur : moyen** — la coque est un gel par distance au centre ; le
reste est l'esquille depuis le cœur.

### 🧼 SAVON (la douche)

**Physique.** Un tensioactif divise la tension de surface par trois :
l'eau s'étale, mousse, fait des bulles.

**Ce que ça donne.** *L'étalement* : le corps s'aplatit et **passe sous
les portes** (un rideau à moitié fermé, une grille à mailles larges).
*La mousse* : trois impulsions vers soi et le corps mousse (voir
`etats-imagines.md`). *Les bulles* : chaque goutte éjectée est une bulle
qui **flotte** plus longtemps et se récupère plus loin.

**Le prix.** Une tension de surface faible, c'est un corps qui **se
disperse plus facilement** : le seuil de dispersion monte, le
rassemblement est plus lent. Le savon part au rinçage : une membrane
traversée en garde la moitié.

**Le moment.** Le corps qui s'étale sous une porte fermée et se relève
de l'autre côté.

**Moteur : facile** — sCorrK, seuil de dispersion, et la forme est un
paramètre de cohésion.

### 🖋️ ENCRE (les imprimantes)

**Physique.** Elle absorbe la lumière. Un corps noir **chauffe** au
soleil, et il bloque un faisceau.

**Ce que ça donne.** *L'ombre* : le corps encré **coupe les lasers** —
on éteint une porte en s'interposant, on protège une pastille. *La
marque* : tout ce que le corps touche reste **taché** pour le reste du
tableau : le chemin parcouru se lit sur les murs, la salle se cartographie
en la touchant. *Le corps noir* : sous un projecteur (les tableaux à
éclairage contrasté), le corps encré **s'échauffe seul** — vapeur gratuite
dans la lumière, gel impossible.

**Le prix.** L'encre est **indélébile** : elle ne se distille pas, ne se
gèle pas à part, ne se rince pas. Le seul moyen de s'en défaire est de
l'**éjecter** — et le titre reste le même. On la garde toute la run.

**Le moment.** Laisser sa trace sur les murs d'un labyrinthe, et
retrouver son chemin dedans.

**Moteur : moyen** — le laser sait déjà rencontrer des obstacles ; la
tache est un dépôt sur les boîtes, comme l'enduit du brouillard.

### 🧪 GEL (les cultures)

**Physique.** Un hydrogel : de l'eau prise dans un réseau. Elle ne coule
plus, elle **tient une forme**, et elle rebondit.

**Ce que ça donne.** *Mémoire de forme* : le corps gélifié garde la forme
qu'on lui donne (il se moule contre une paroi, il en garde l'empreinte)
et **la reprend** après un choc. *Amorti* : les chocs ne dispersent plus
rien, les éjections tirent des morceaux qui **reviennent** en élastique.

**Le prix.** Le gel ne gèle pas franchement (il craque) et ne vaporise
pas (il sèche, en perdant du volume). Un corps gélifié est lent :
viscosité ×5.

**Le moment.** Se mouler dans une serrure de couloir, et passer en
gardant la forme.

**Moteur : chantier** — la forme mémorisée demande des ressorts entre
particules ; c'est un autre solveur (position-based, mais avec repos).

### 🥣 FÉCULE (les cuisines) — *l'oobleck*

**Physique (vraie, et la plus drôle de toutes).** Un fluide rhéoépaississant :
**liquide quand on le manipule doucement, solide quand on le frappe**. On
peut courir sur une piscine d'oobleck, et on s'y enfonce si on s'arrête.

**Ce que ça donne.** *La glace sans gel* : un corps à la fécule est de
l'eau qui se propulse… et **devient bloc à l'impact** — tout choc rapide le
fige (rebond de palet), tout repos le liquéfie (propulsion). C'est la
surfusion **réversible et sans bouton** : l'état dépend de la vitesse.
*Le mur* : viser fort dans une éponge, elle bute sur un solide.

**Le prix.** Un corps qui devient solide à chaque choc **ne colle plus à
l'hydrophile** et **ne passe plus les membranes en vitesse** — il faut
ralentir pour redevenir eau, et ralentir coûte une impulsion.

**Le moment.** Foncer dans un mur en eau et rebondir en bloc, repartir
en eau. Sans une touche.

**Moteur : facile** — la surfusion de la branche en cours, avec le germe
piloté par la vitesse d'impact et le dégel piloté par le repos.

## II. Les récompenses à boire

Aujourd'hui la récompense de fin de salle est une carte. Les fluides
offrent une seconde façon de récompenser, **physique** au lieu de
lexicale : la récompense est une **flaque à boire**.

### La cave

Au sas, à côté des trois cartes, **trois sphères** dérivent : trois
fluides, avec leur titre. On en boit **une** — elle entre dans le corps,
le titre se calcule, la physique change à l'instant, et **la salle
suivante est conçue pour ça** (le générateur lit le titre comme il lit
les mémoires : une salle à cryobaies quand on est salé, une salle à
lasers quand on est encré).

### Les recettes

Deux fluides dans le même corps ne s'additionnent pas : ils **réagissent**.
C'est là que l'atelier devient une paillasse.

| mélange | ce que ça donne |
| --- | --- |
| sel + azote | **la saumure glaciale** : l'armure d'azote ne fond plus — une coque de glace permanente autour d'un cœur qui ne gèle jamais |
| alcool + carburant | **le bleu** : le nuage s'allume tout seul près de toute chaleur, dash et propulsion décuplés, mais le corps brûle à chaque bascule |
| savon + huile | **l'émulsion** : l'huile se disperse en billes dans le corps — plus de peau, mais un corps qui rebondit partout comme une mousse lourde |
| encre + mercure | **le miroir noir** : le corps coupe les lasers ET les réfléchit sur son cœur de mercure — une porte s'éteint ici, s'allume là |
| fécule + gel | **la pâte** : solide au choc, élastique au repos, qui garde la forme du choc — on se moule en frappant |
| sel + alcool | **le dissolvant** : ni gel ni ébullition faciles — le corps est **verrouillé en eau**, mais l'eau la plus rapide et la plus lourde du jeu |
| azote + carburant | **le cryogène** : la charge glacée — un bloc qui explose en givre au contact d'une chaudière, et fige tout autour |

Les recettes se **découvrent** en jouant (le codex les note) et se
**refont** à la douche du hub, avec les semblables libérés — c'est la
mutation de la bible : « ajouter des substances à son essence ».

### Le titre comme seconde monnaie

Le sas boit le mélange. Il paie **l'eau** en condensat (comme aujourd'hui)
et **l'autre fluide** à part : le sel, l'alcool, l'huile ont un cours à
l'économat. Un corps bien chargé vaut plus — mais il a joué la salle
avec ses contraintes. **Grossir n'est jamais une récompense, c'est une
décision** : se charger non plus.

## III. La run noire

### Ce que c'est

Les fioles du hub contiennent les semblables : même substance, sans
conscience. La bible dit qu'une fois la glace acquise, on peut les
**libérer**, et qu'ils servent à muter. La run noire est **l'autre
choix** : ne pas les libérer. **Les boire.**

Un semblable bu, c'est du Sujet sans Sujet : de la matière pure qui
**double le corps** sans rien lui apprendre. Et il laisse une trace : le
corps devient un peu **noir** — le titre de la run noire est un titre
d'**Ombre**, et il ne descend jamais. Chaque semblable bu monte l'Ombre
d'un cran. À trois crans, c'est la run noire : le vaisseau le sait.

### Ce que l'Ombre donne

Chaque cran est une capacité — les plus fortes du jeu, et aucune n'est
propre :

1. **LA FAIM** (cran 1) — le corps **boit tout** : la rosée, le condensat,
   les gouttes chassées, et **le contenu des éponges** (une éponge saturée
   se vide dans le corps au contact). Il peut grossir au-delà de son
   volume de départ — la jauge dépasse 100 %. *La règle d'or est
   inversée : grossir devient le but.*
2. **LA CONTAGION** (cran 2) — le corps **noircit ce qu'il touche** : une
   surface noircie perd sa chimie (l'hydrophobe ne repousse plus,
   l'hydrophile ne colle plus, la plaque froide ne gèle plus). Le
   vaisseau s'éteint derrière vous, salle par salle.
3. **LA MEUTE** (cran 3) — les gouttes éjectées **ne sont plus perdues** :
   elles deviennent des semblables miniatures qui **vous suivent** en
   essaim, passent où vous passez, et **rentrent quand vous voulez**. Se
   déplacer ne rétrécit plus.
4. **L'ÉCHO** (cran 4) — vous n'êtes plus un corps : vous êtes **deux**.
   Un second corps, noir, que vous pilotez en alternance (une touche pour
   changer). Deux sas, deux salles, une seule descente.
5. **LE MIROIR NOIR** (cran 5, le dernier semblable) — le corps entier
   est noir. Les lasers meurent en vous, le froid et la chaleur n'ont
   plus de prise, le sas ne peut plus vous boire : **vous ne rentrez plus
   au hub**. La run continue jusqu'à la dispersion, ou jusqu'au fond de
   la station.

### Ce que le vaisseau fait

La run noire n'est pas une run facile : elle est une run où **le vaisseau
se défend**. À chaque cran :

- les **plaques froides deviennent des pièges** : elles ne gèlent plus,
  elles **retiennent** (un corps noir qui touche le froid y reste collé
  une seconde de plus par cran) ;
- les **chaudières chassent** : leur aura pousse le corps noir au lieu de
  le vaporiser — le Leidenfrost, mais contre vous ;
- les **rails s'inversent** : le champ vous repousse ;
- les **portes se ferment** quand vous approchez encré ; les lasers
  cherchent le corps (une porte qui s'éteint sous vous **se rallume
  ailleurs**) ;
- le **sas ne boit plus la glace** : il ne prend que l'eau, et de moins
  en moins ;
- l'**économat ne vend plus** : le Semblable vous reconnaît.

Et le **hub** change : les fioles vides restent vides, éclairées rouge.
Le codex consigne « DÉVORÉ » à la page du semblable. Les trophées de la
run noire ont un nom pour eux seuls, et le palmarès les affiche à part.

### Ce que ça rapporte

La run noire paie en **mémoire ×3**. C'est le seul moyen rapide de
tisser les mémoires chères (le superfluide, le plasma, le point triple).
Et c'est un choix irréversible pour la **run** — pas pour le compte : à
la purge, l'Ombre tombe, les fioles restent vides, et **un semblable
libéré plus tard ne revient pas**. Le prix se paie dans le hub, à chaque
visite, en regardant les fioles.

### La fin de la run noire

Deux fins possibles, au fond de la station :

- **la dispersion** — le corps noir se disperse, et l'écran de fin ne dit
  rien d'autre que le nombre de semblables ;
- **le retour** — la douche. Si le joueur a gardé de l'eau pure (un titre
  d'Ombre sous 100 %), la douche **sépare** : l'Ombre est rincée, un
  semblable est **rendu** à sa fiole. Un par run noire. La rédemption est
  possible, et elle est lente.

### Pourquoi c'est bien

Parce que le jeu dit depuis le premier jour que « grossir n'est jamais
une récompense, c'est une décision », et que la run noire est ce qui
arrive quand on décide **le contraire**. Elle ne casse pas la règle
d'or : elle en fait un choix moral. Et elle donne aux fioles du hub —
des assets sans interaction — la seule interaction qui compte.

## IV. Les capacités qui en sortent — la liste courte

Si on ne garde que ce qui fait un geste nouveau, testable, pour la
branche en cours :

| capacité | fluide / cran | geste | moteur |
| --- | --- | --- | --- |
| **Antigel** | sel | traverser une aura froide en eau | facile |
| **Inflammation** | alcool | le nuage s'allume à la chaudière : un dash forcé | facile |
| **Peau** | huile | l'éponge et l'hydrophile n'ont plus prise ; la membrane est un mur | moyen |
| **Boulet** | mercure | éjecter lourd : une goutte, treize fois l'élan | moyen |
| **Fusée** | carburant | l'éjection dans une aura chaude est décuplée | facile |
| **Armure** | azote | coque de glace, cœur liquide, dix secondes | moyen |
| **Étalement** | savon | passer sous une porte | facile |
| **Ombre** | encre | couper un laser ; laisser sa trace | moyen |
| **Oobleck** | fécule | solide au choc, eau au repos, sans bouton | facile |
| **Faim** | Ombre 1 | boire les éponges, dépasser 100 % | facile |
| **Contagion** | Ombre 2 | noircir la chimie des surfaces | chantier |
| **Meute** | Ombre 3 | les gouttes éjectées suivent et rentrent | moyen |
| **Écho** | Ombre 4 | deux corps, une touche pour changer | chantier |

Mes trois premiers, dans l'ordre : **Oobleck** (c'est la surfusion de la
branche avec deux lignes de plus, et c'est le fluide le plus drôle qui
existe), **Azote** (l'armure : le premier vrai *mélange* d'états dans un
seul corps), et **la Faim** (le premier cran de la run noire suffit à
la raconter : boire une éponge est déjà une trahison).
