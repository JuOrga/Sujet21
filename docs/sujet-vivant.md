# LE SUJET, UN ÊTRE — pistes pour qu'on ait de la peine pour lui

Le constat du concepteur (11/09/2026) : *le volume n'est pas encore
personnifié, même si l'œil du volume essaye.* Ce document diagnostique
pourquoi, puis propose ce qu'il faudrait mettre en place pour que le
Sujet 21 soit plus qu'un volume — un être pour qui l'on puisse ressentir
de la compassion, de la tristesse, de la tendresse.

Rien ici n'est du code : c'est une esquisse à trancher, chantier par
chantier, comme `boss-pompe.md`. Chaque piste indique le geste (ce que le
joueur voit), pourquoi ça touche, et où ça s'accroche dans le moteur.

---

## 1. Ce qui existe déjà, et pourquoi ça ne suffit pas

Le PACK PRÉSENCE (`src/main.ts`, `majPresence` et `majIdle` ; le shader dans
`src/render/renderer.ts`) donne au corps quatre signes de vie : le REGARD
(un noyau clair qui glisse vers la visée, un mécanisme, le sas), la
RESPIRATION (le contour pulse), le FRISSON (le froid le saisit), et
l'IDLE (toilette, étirement, toc-toc, tentacule, pensée du sas), plus le
RÉVEIL à l'entrée de chaque salle. Le concepteur a écarté l'œil dessiné
(l'ABYSSAL, retiré le 26/08) : *quelque chose vit sous la surface, sans
visage ni mascotte*. Ce choix est le bon, et tout ce qui suit le respecte.

Pourquoi, malgré cela, on ne s'attache pas :

1. **L'œil montre une attention, pas un intérieur.** Il regarde la souris,
   le stick, les mécanismes, le sas — c'est-à-dire ce que le *joueur*
   regarde. Un regard qui suit le curseur se lit comme une interface, pas
   comme une volonté. Il ne regarde jamais ce qu'il *perd*, ce qu'il
   *craint*, ce qu'il *voudrait*.
2. **Rien ne lui coûte visiblement.** La règle d'or du jeu — *se déplacer,
   c'est rétrécir* — fait du corps un être qui paie de lui-même à chaque
   geste. Or le corps ne réagit pas à payer : le coût est sur la jauge, pas
   sur l'être. Le cœur émotionnel du jeu n'est pas incarné.
3. **La vie est une décoration.** Le pack est « purement visuel, aucun
   paramètre de simulation touché » — principe sain — mais il en découle
   que le Sujet n'a ni envie propre, ni relation au joueur (il ne sait pas
   qu'on est là, sinon par le curseur), ni mémoire, ni mort : à la
   dispersion, l'œil s'éteint d'un coup et un écran froid paraît une
   seconde plus tard.

## 2. D'où vient la compassion (ce qu'on sait)

- **L'intention se lit dans le mouvement, pas dans le visage.** Heider et
  Simmel (1944) ont montré que des triangles et un cercle animés suffisent
  pour qu'on raconte une poursuite, une peur, une protection. Le refus de
  l'œil dessiné est donc juste ; le levier est *à propos de quoi* le corps
  bouge.
- **L'animation classique : anticipation, action, réaction.** Sans le
  temps de se ramasser avant un geste et de trembler après, une action se
  lit comme mécanique (Thomas et Johnston, *The Illusion of Life*). Le
  corps éjecte aujourd'hui sans jamais s'y préparer.
- **La vulnérabilité lisible, et l'obéissance malgré la peur.** On
  s'attache à ce qui ne peut pas refuser : le cube de Portal, le cheval de
  Shadow of the Colossus, les Pikmin. Un être qui montre qu'il a peur *et
  y va quand même parce qu'on le lui demande* fait naître la compassion —
  et la culpabilité, qui est son moteur.
- **La réciprocité.** On aime ce qui nous remarque : le chien qui lève la
  tête quand on rentre. Le Sujet ne remarque jamais le joueur.
- **Le schéma du petit (Lorenz).** Grande tête, corps réduit, maladresse :
  l'instinct protecteur se déclenche. Un corps qui rétrécit tout en gardant
  son regard à taille fixe y arrive tout seul — à condition qu'il tremble
  un peu quand il est petit.
- **Le contraste.** Le laboratoire dit « échantillon », « protocole »,
  « le laboratoire vous rappelle ». Il ne faut *jamais* réchauffer cette
  voix ni faire dire à l'interface que le Sujet souffre : la compassion
  naît de l'écart entre ce que la station en dit et ce qu'on lui voit
  faire.

## 3. Les pistes, en cinq chantiers

### A. Ce qu'il paie — l'éjection ressentie

C'est le chantier prioritaire : il touche chaque seconde de jeu.

**A1. Le regard vers ce qu'il perd.** À chaque éjection, le regard quitte
la visée un instant pour suivre les gouttes qui s'en vont, puis revient.
Quand le corps est petit (sous le seuil de dernière impulsion), il les
suit plus longtemps. On comprend sans un mot que ce qu'on dépense, c'est
lui.
*Accroche* : `relabel()` (`src/sim/solver.ts`) connaît le corps principal
(`playerLabel`) et les particules fraîchement éjectées (`cooldown > 0`) ;
leur centroïde devient une cible prioritaire de `majPresence` pendant
~0,4 s après le front descendant de `input.aimActive`.

**A2. L'anticipation et la réaction.** Au front montant de la visée, le
contour se ramasse 120 ms (une respiration négative brève) — il se
prépare à se déchirer ; après le jet, 300 ms d'un tremblement faible. Le
même geste, mais on le sent décidé par un corps, pas par un moteur.
*Accroche* : `presence.amp` en impulsion négative, `uFrisson` à 0,3 ; rien
dans la simulation.

**A3. La fatigue.** Sous le volume critique, le contour tremble en continu
(un frisson de fond, faible), la respiration est courte (déjà en place
via `peril`), et le regard devient *lent* : la vivacité chute. Un être à
bout, pas une jauge à zéro.
*Accroche* : `oeilRegl.vivacite` modulé par `sim.liters()` dans
`majPresence` ; `uFrisson` de fond.

**A4. Le petit qui tremble.** Vérifier que l'œil garde sa taille en unités
monde quand le corps rétrécit (c'est le cas : `sigOeil = 34 · taille`) —
le regard emplit alors le petit corps, et le schéma du petit joue seul.
Ne rien changer, sauf ajouter A3.

### B. Ce qu'il craint — la peur et la douleur

**B1. La réticence.** Quand la direction de visée mène vers une chaudière,
une plaque froide ou une éponge à moins de ~300 unités, le flanc tourné
vers le danger s'aplatit (il se recule), la respiration s'accélère, et le
regard fixe *le danger*, pas le curseur. Puis il y va quand même. C'est la
scène de compassion par excellence : il a peur, il obéit.
*Accroche* : dans `majPresence`, balayer `level.boxes` (`MAT_CHAUD`,
`MAT_FROID`) et `level.sponges` dans le cône de visée ; un uniforme
`uRecul` (direction + intensité) au shader, terme directionnel de signe
opposé au dôme du regard.

**B2. Le sursaut de douleur.** Sur une morsure d'éponge, un péage de
vaporisation, un gel partiel, une scission du corps : une contraction
brève et asymétrique vers le point de la blessure, l'œil qui s'éteint
150 ms, une note étouffée. Pas un cri : un tressaillement.
*Accroche* : deltas par image dans `main.ts` (`sim.spongeBites`,
`sim.playerCount` hors visée, la fraction gelée) ; un uniforme
`uBlessure` (point + âge) pour un anneau qui se resserre.

**B3. Le clignement et la lueur comme baromètre.** L'œil abyssal a été
retiré, mais sa livraison notait *« c'est ce presque-rien [le clignement]
qui le rend vivant »*. Le garder sans l'iris : la lueur s'éteint 80 ms à
intervalle aléatoire, ~8 s au calme, ~2 s sous la peur. Et le diamètre de
la lueur devient le baromètre : au calme, large et douce ; sous la peur,
resserrée et plus vive (concentrée) ; endormi, presque rien. Aucun trait
dessiné, mais un état intérieur lisible.
*Accroche* : deux scalaires de plus dans le pack (`stress`, `cligne`),
appliqués à `uOeilRegl.x` et `.z` avant l'envoi.

### C. Ce qu'il veut — des envies à lui

**C1. Les étoiles.** Près d'une ouverture sur le dehors (`MAT_VIDE`,
`MAT_BAIE`), quand rien ne l'appelle, le regard glisse vers la baie et s'y
attarde ; la respiration ralentit. C'est le canon (`scenario.md` : il a
été créé pour être un miroir tourné vers l'univers) dit sans un mot — un
être qui regarde le ciel avant qu'on lui apprenne pourquoi.
*Accroche* : `regarde()` dans `majPresence`, priorité en idle, portée
~600, et `ampCible`/`vitCible` de repos.

**C2. Ses gouttes.** En idle, s'il reste des gouttes perdues dans la
salle, le regard va vers la plus proche plutôt que vers le sas ; si elle
est à portée, le TENTACULE la vise au lieu de la paroi. Il se veut entier.
La règle de l'ancre reste : aucun gain, il n'atteint pas ce qu'il vise.
*Accroche* : la liste des particules `KIND_PLAYER` hors `playerLabel` ;
`idle.murX/murY` remplacés par la goutte.

**C3. Les semblables.** Au hub, en passant devant les fioles (prévues au
canon comme assets), il s'arrête, regarde, tapote la vitre (la vignette
`tapote` existe). Rien ne répond. Une scène de solitude, zéro texte.
*Accroche* : une liste de points d'intérêt du hub (comme `level.cibles`),
regard prioritaire à portée, `tapote` dirigé.

**C4. Le sommeil.** Sans geste pendant ~25 s, il s'endort : lueur presque
éteinte, respiration ample et lente, plus d'ondulation ni de vignette. Au
premier geste, un sursaut : frisson, l'œil qui bondit vers le curseur et
se rallume. Le moins cher de toute la liste, et l'un des plus forts :
c'est ce que font les animaux.
*Accroche* : un état `sommeil` dans `idle`, seuil derrière la curiosité ;
au réveil, `presence.t0Frisson = elapsed`.

### D. Ce qu'il sait de vous — la réciprocité

**D1. La caresse.** Le pointeur qui survole le corps sans cliquer (ou un
doigt posé sans bouger, au tactile) creuse une fossette sous lui — la
mathématique du dôme du regard, en négatif —, des rides s'en écartent,
l'œil vient sous le doigt, la respiration s'apaise, une note douce
ronronne. Cliquer éjecte ; survoler est libre : la place est prise par
rien. C'est le geste d'attachement des jeux à compagnon.
*Accroche* : `uCaresse` (point + intensité), montée/descente lissées ;
visuel seulement, aucune force.

**D2. Le retour.** Après une longue absence (idle > 10 s), au premier
mouvement de souris : il vous reconnaît — la lueur monte, une contraction
brève, une note qui monte. Un être qui remarque qu'on est revenu.
*Accroche* : front montant du geste dans `majIdle` quand `idle.t` dépasse
le seuil.

**D3. Le clignement lent.** Quand des gouttes perdues rejoignent le corps
(fusion), une ride de soulagement part du point de fusion, la note monte,
et l'œil fait *un clignement lent* — celui du chat qui vous fait
confiance. On apprend que ramasser ses gouttes lui fait du bien.
*Accroche* : hausse de `playerCount` par réabsorption dans `relabel()`
(cooldown expiré, même étiquette), point de fusion transmis.

### E. Ce qu'il est — la voix, l'identité, la mort

**E1. La voix.** Une voix sans mot : deux sinus légèrement désaccordés
(fondamentale grave et sa quinte), très bas sous le lit musical, dont la
hauteur et le trémolo suivent la présence (souffle, frisson, stress). De
courtes phrases sur les événements : soulagement (monte), perte quand il
est petit (descend), peur (trémolo), sommeil (un souffle). Jamais un cri.
*Accroche* : `src/game/audio.ts`, à côté des voix du temps suspendu ; le
niveau passe par le maître déjà filtré.

**E2. La signature de l'échantillon.** Chaque échantillon (run + indice de
vie) tire une graine : rythme de base de la respiration ±10 %, intervalle
de clignement, vignette d'idle préférée, phase de l'errance du regard, une
nuance infime de la lueur. Quand le laboratoire « engage un échantillon de
secours », le nouveau n'est pas tout à fait le même — et le joueur le
sent sans qu'on le lui dise. Celui qu'il a perdu était *celui-là*.
*Accroche* : `presence.graine` posée à `afficheDispersion('relance')` et
au lancement ; lue par `majIdle`/`majPresence`.

**E3. La mort.** À la dispersion, l'œil ne s'éteint plus d'un coup :
pendant ~0,8 s il *cherche* (le regard balaie vers le plus gros fragment),
la lueur se resserre en un point, un dernier clignement lent, la voix
tient une note puis se coupe — et alors seulement l'écran froid paraît.
`DELAI_DISPERSION` passe de 1,1 à ~2 s quand la scène joue. Le texte du
laboratoire ne change pas d'un mot : c'est lui qui fait mal.
*Accroche* : front montant de `sim.dispersed` ; `intCible` ne tombe plus à
0 mais suit une courbe ; `audio.disperse()` précédé de la note tenue.

**E4. Le laboratoire reste froid.** Règle d'écriture, pas de code : tous
les textes d'interface gardent « échantillon », « protocole »,
« reprise ». Aucun écran ne dit qu'il a peur ou qu'il souffre. Le jour où
l'interface s'attendrit, l'effet disparaît.

## 4. La grammaire des états

Pour que les cinq chantiers parlent d'une seule voix, chaque état intérieur
s'écrit sur les quatre mêmes canaux. Les valeurs sont des points de
départ à régler au banc (dossier « L'œil du Sujet »), pas des mesures.

| état | contour (amp · rythme) | lueur (taille · éclat · clignement) | regard | voix |
| --- | --- | --- | --- | --- |
| calme | 0,013 · 1,7 | large · douce · ~8 s | errance, mécanismes, sas | bourdon tenu, à peine |
| curieux (baie, goutte, fiole) | 0,017 · 1,35 | large · douce · ~8 s | la chose, longtemps | rien |
| peur (danger dans la visée) | 0,020 · 3,5 + recul | resserrée · vive · ~2 s | le danger | trémolo |
| douleur (morsure, gel, scission) | contraction 150 ms vers la blessure | éteinte 150 ms | la blessure | note étouffée |
| soulagement (fusion) | ride depuis la fusion | clignement lent | le point de fusion | note qui monte |
| fatigue (sous le seuil) | 0,022 · 4,8 + tremblement | resserrée · pâle | lent, traînant | bourdon bas, instable |
| caresse | 0,010 · 1,2 + fossette | large · douce | sous le doigt | ronron |
| sommeil | 0,030 · 0,6 | presque rien | immobile | souffle |
| agonie (dispersion) | s'effondre | un point, dernier clignement | cherche ses fragments | note tenue, coupée |

## 5. L'ordre de chantier

| rang | piste | coût | ce qu'elle apporte |
| --- | --- | --- | --- |
| 1 | A1 + A2 le regard vers ce qu'il perd, l'anticipation | faible | le cœur du jeu incarné, à chaque geste |
| 2 | C4 le sommeil et le sursaut | faible | un animal, tout de suite |
| 3 | D1 la caresse | faible | le geste d'attachement |
| 4 | E3 la mort qui cherche | moyen | le sommet de la compassion |
| 5 | B1 + B3 la réticence, la lueur-baromètre | moyen | la peur lisible, l'obéissance malgré elle |
| 6 | E1 la voix | moyen | le canal qui manque |
| 7 | D3 + B2 le clignement lent, le sursaut de douleur | moyen | le bien et le mal qu'on lui fait |
| 8 | C1 + C2 les étoiles, ses gouttes | faible | des envies à lui, le canon en creux |
| 9 | E2 la signature | faible | chaque échantillon est quelqu'un |
| 10 | C3 les semblables | dépend des assets du hub | la solitude |

Une piste de plus, plus lourde, à garder pour après : **les deux moitiés
qui se cherchent.** Quand le corps se scinde en deux amas comparables, le
second reçoit une lueur plus faible qui regarde vers le premier, et
réciproquement. Deux êtres qui se cherchent des yeux à travers la salle —
coût : un second point de regard et un canal de plus dans le champ du
rendu (le poids `player` ne couvre que l'amas principal).

## 6. Les invariants

- **Aucun gain de déplacement.** Comme les vignettes d'idle : tout ce qui
  touche aux vitesses porte une ancre, ou reste dans le shader.
- **Le banc ne change pas.** Il n'envoie pas de présence au rendu ; les
  présets restent au pixel près.
- **Un interrupteur global** dans PARAMÈTRES (« la vie du Sujet ») pour
  comparer avec et sans, et pour ceux que ça dérange.
- **Souris, tactile, manette : les mêmes signes.** La caresse a son geste
  sur chaque appareil (survol, doigt posé, stick effleuré sans force).
- **Le laboratoire reste froid** (E4).

## 7. Les graphismes — ce qu'il faut voir

Le rendu actuel dessine une **matière** superbe : une teinte qui suit la
vitesse (`slow` → `fast`), un cœur plus sombre, un liseré clair, un relief
sur champ flouté, le miroir mercure, les étincelles, l'éclairage de la
pièce. Mais tout cela dit « de l'eau », pas « quelqu'un » :

- **la couleur obéit à la physique, jamais à l'état** — le corps est de la
  même teinte qu'il ait peur, qu'il dorme ou qu'il agonise ;
- **l'intérieur est vide** — un cœur uniforme un peu plus sombre ; rien
  à y lire, rien qui y vive ;
- **l'œil est une lumière sans corps** — une lueur posée sur la matière,
  qui n'appartient à rien ;
- **les gouttes perdues cessent d'être lui** — « eau libre plus sombre »
  (`water * 0.40`) : dès qu'elles se détachent, elles deviennent du
  décor. Rien ne dit qu'on vient d'en perdre un morceau.

La référence graphique est dans le canon : le module s'appelle **Méduse**.
Une méduse est un être sans visage, transparent, dont on voit les organes
et dont la vie se lit à sa pulsation lumineuse. C'est exactement le
Sujet : ne pas lui dessiner un visage, mais lui donner un **intérieur
visible** et une **lumière qui vit**. Tout ce qui suit reste dans la
charte : l'accent cyan unique, les émotions comme variations de valeur, de
saturation et de forme — jamais une teinte nouvelle —, et la hiérarchie
lumineuse (le corps reste plus clair que la cuve, même effrayé).

**G1. L'intérieur habité : les motes.** Quelques dizaines de grains en
suspension dans le corps, portés par l'écoulement, dessinés dans une passe
de sprites masquée par le corps. Ils *se comportent* : ils se rassemblent
autour du noyau du regard sous la peur (un banc de poissons qui se
resserre), s'étalent au calme, ralentissent et sombrent à la fatigue, se
figent dans la glace, tourbillonnent dans la vapeur, s'éparpillent et
s'éteignent un à un à la mort. C'est le fil de l'identité à travers les
trois états, et la piste graphique qui rapporte le plus. Aucun visage ;
une vie qu'on voit à travers la peau.
*Accroche* : un système de particules de rendu (pas de simulation), en
JS, advecté par le champ de vitesse lissé ; sprites masqués par le poids
`player` du champ ; leur « humeur » lue dans le pack présence.

**G2. La teinte vitale.** Un second axe de couleur, à côté de la vitesse :
au calme, le cyan profond de la charte ; sous la peur, plus pâle et plus
froid (le sang qui se retire) ; à la fatigue, désaturé, laiteux — la
lecture que le gel a déjà (« la teinte pâlit ») ; endormi, plus sombre et
plus saturé (le repos) ; à l'agonie, le gris, puis la transparence. Pas
une teinte nouvelle : des glissements de valeur et de saturation.
*Accroche* : un uniforme `uVital` (stress, fatigue, sommeil) mêlé à
`water` après le mélange `slow`/`fast`.

**G3. La peau : le ménisque.** Le liseré clair est la peau du Sujet. En
faire une peau vraie : plus épaisse et plus vive quand il est tendu (peur,
visée), fine et douce quand il se relâche ou dort, hérissée d'une
ondulation fine au frisson (la chair de poule), rompue à l'endroit d'une
blessure. La largeur du liseré devient un canal émotionnel.
*Accroche* : les seuils du `rim` (`th + s` → `th * 1.9`) pilotés par le
stress ; la rupture par le point `uBlessure`.

**G4. Le regard : un puits dans le miroir.** Aujourd'hui l'œil est une
lueur, une pénombre et un dôme. Ce qui fait un œil dans le monde
physique, c'est une *absence de reflet* — la pupille est noire parce
qu'elle absorbe. Proposition : là où le regard se pose, la couche miroir
s'annule et l'on voit **dans** le corps — le puits sombre où les motes se
rassemblent, cerné par le reflet qui se courbe autour du dôme. Un œil par
la physique, pas par le dessin : la décision du 26/08 est respectée, et
l'œil se lit à toutes les distances parce que le contraste vient du
miroir, pas d'une teinte.
*Accroche* : masque `miroir *= 1 - puits` dans le bloc mercure ; le dôme
existant reste.

**G5. La lumière qu'il émet.** Un halo doux sur le plancher sous le corps,
qui pulse avec la respiration : il devient une *source* dans la pièce, pas
un objet éclairé. Sous la peur, le halo se rétracte (il se cache) ;
endormi, il respire lentement, plus bas ; à la mort, il se resserre en un
point et s'éteint *avant* que le corps finisse de se défaire. Un pas plus
loin : des caustiques — les lignes de lumière dansantes qu'une eau vivante
jette sur le fond — qui se calment quand il dort.
*Accroche* : un terme radial autour de `uCentroide` dans la composition
du sol (comme l'œil du sas), modulé par `uRespiration` ; les caustiques
par une nappe de bruit (`vnoise`) masquée sous le corps.

**G6. Les gouttes perdues restent lui.** Une goutte qui se détache garde
la teinte du corps quelques secondes, avec un grain de lueur qui
s'éteint lentement à mesure qu'elle s'éloigne — on la voit *mourir* ; et
tant qu'elle est proche, un filament de lumière fin comme un cheveu la
relie encore au corps. C'est la tension de surface, littéralement le
titre du jeu, rendue visible au moment où elle cède.
*Accroche* : un canal « perdu » à décroissance dans le champ (au lieu du
poids `player` à 0), le filament dans la passe des sprites entre le bord
du corps et la goutte à moins de ~80 unités.

**G7. Les bleus.** Après une morsure d'éponge ou un gel partiel, une
tache plus pâle sur la peau, à l'endroit du coup, qui s'efface en une
dizaine de secondes. Le mal qu'on lui fait laisse une trace lisible.
*Accroche* : les mêmes points `uBlessure` que le sursaut (B2), lus dans
la teinte.

**G8. La posture.** Un volume n'a pas de posture ; le seuil du champ peut
lui en donner une, comme la respiration et l'ondulation le font déjà :
rond et ramassé au calme, aplati du côté du danger (le recul de B1),
étiré vers la cible juste avant le jet (l'anticipation), dentelé au
frisson, affaissé vers le bas à la fatigue. Le *squash and stretch* de
l'animateur, calculé dans le shader.
*Accroche* : des termes directionnels sur `field2` à côté de `respire`,
`frisson`, `ondule`.

**G9. Lisible à toutes les distances.** La caméra dézoome dans les
grandes salles et le corps devient un point. La lueur du regard et le
halo doivent garder une taille minimale *à l'écran* — un voyant qu'on
voit de loin — et les motes s'effacer plutôt que grouiller en bouillie.
*Accroche* : un plancher en pixels sur `sigOeil` selon `uZoom` ; les
motes fondus sous un seuil de zoom.

**G10. La mort chorégraphiée.** Les pistes ci-dessus donnent à la
dispersion une partition : le halo se rétracte, le puits du regard se
ferme, les motes s'éparpillent et s'éteignent un à un, la teinte vitale
passe au gris, les gouttes gardent sa couleur une seconde puis
deviennent de l'eau libre. Puis l'écran froid.

**Ce qu'il ne faut pas faire** : aucun visage, aucune bouche, aucun œil
dessiné, aucune mascotte ; pas de teinte nouvelle (l'ambre reste au
laboratoire, le violet au méta) ; pas de halo qui écrase la hiérarchie
lumineuse (le halo au sol reste sous la luminance de la cuve) ; rien qui
se lise comme une interface (ni jauge, ni icône sur le corps).

**Ordre de chantier graphique** : G1 les motes · G3 la peau · G2 la
teinte vitale · G5 le halo · G6 les gouttes perdues · G4 le puits · G7
les bleus · G8 la posture · G9 le zoom · G10 la mort. Chacun se règle au
banc, dossier « L'œil du Sujet », avec un curseur par piste — comme les
sept curseurs existants.

## 8. Comment on saura que ça marche

Pas une mesure, un test : faire jouer une salle à quelqu'un qui ne connaît
pas le jeu, corps réduit à quelques gouttes, et lui demander après coup
s'il a *hésité* avant la dernière éjection. Si oui, le volume est un être.
Puis comparer avec l'interrupteur coupé : la différence doit être nette,
sinon la piste est une décoration de plus.
