# La coupelle — le péage en volume

*Livraison du 24/10/2026 : la mécanique, dans le moteur et dans
l'éditeur. Aucun tableau n'en porte encore : c'est un outil posé pour le
concepteur, pas une salle.*

## 1. La règle, en une phrase

**La coupelle boit tout le liquide qui y entre, jusqu'à son trait, puis
se ferme.**

Fermée, elle allume son **canal** pour de bon, comme une pastille laser
TOR : les portes et les chasses qui portent ce numéro s'ouvrent ou
soufflent. Le doc fonctionnel l'annonçait déjà (§6, l'éponge) : *« on peut
payer un passage en volume, saturer une zone et ouvrir une brèche
permanente »*. La coupelle en fait un élément lisible, qu'on règle au
trait près.

| Champ (`CoupelleDef`) | Sens | Défaut |
| --- | --- | --- |
| `x`, `y` | le centre de la bouche | — |
| `r` | le rayon de la bouche (u) | `COUPELLE_R_DEFAUT` = 60 |
| `seuil` | le **trait** : la part de la masse de référence à payer, de 0,01 à 0,9 | `COUPELLE_SEUIL_DEFAUT` = 0,1 |
| `canal` | le numéro (≥ 1) que les portes et les chasses visent | le premier libre, à la pose |

## 2. Ce qu'elle boit, et ce qu'elle laisse passer

- **Le trait est une part du corps, pas un volume en litres.** La masse de
  référence est le corps **à l'entrée du tableau** ; Recommencer la
  retrouve à l'identique. Une coupelle à 10 % coûte un dixième de soi à un
  corps gros comme à un corps maigre : l'énigme est la même pour tous. La
  capacité en particules est `⌈trait × référence⌉`, et elle n'est jamais
  nulle (`capaciteCoupelle`, `src/game/coupelle.ts`).
- **Elle boit le corps ET les gouttes libres.** Il n'y a qu'une règle.
  Une version qui aurait épargné le corps l'aurait tout de même grignoté :
  le remous détache des fragments au passage, et ces fragments sont des
  gouttes libres.
- **Elle ne prend jamais plus que son trait.** Une fois pleine, elle ne
  boit plus une goutte.
- **La glace et la vapeur passent sans payer.** C'est l'eau liquide
  qu'elle boit, comme l'éponge. Traverser gelé, c'est un passage gratuit,
  et c'est un levier de conception, pas un oubli.
- **Aucune traînée, aucune adhérence.** C'est ce qui la sépare de l'éponge
  (`spongeDrag`) et de l'hydrophile, qui retiennent le corps. Le corps
  entre dans la coupelle et en ressort librement ; elle lui prend sa part,
  sans le garder.

## 3. Les deux façons de payer

1. **Avec le corps.** On entre dans la coupelle et elle mord sa part.
   C'est rapide, mais on paie en plus de ce que coûte le déplacement.
2. **Avec le jet.** Les gouttes éjectées comptent. Le geste habile consiste
   à se placer dos à la coupelle et à tirer dedans : **le recul propulse le
   corps vers la porte que ce même jet est en train d'ouvrir**. L'eau qui
   le fait avancer est aussi celle qui paie : il ne paie qu'une fois.

Personne ne calcule l'élégance d'une solution : on la lit dans le volume
de sortie.

## 4. Le couvercle

Pleine, la coupelle allume son canal **tout de suite**. Mais le couvercle,
un disque plein que le jeu ajoute aux parois comme une porte fermée,
**attend que la bouche soit vide** pour tomber : plus rien dedans, ni
liquide, ni glace, ni vapeur. Une première version le fermait d'un coup.
Dans l'essai du 24/10 (un corps de 500 particules, soit 2,5 L, lancé à
travers une coupelle à 12 %), le disque est apparu au milieu du corps qui
traversait encore la bouche et l'a fait éclater en étoile : la coupelle
avait bien bu ses 60 particules, mais le corps est arrivé à la porte
réserve à sec, avec 0,14 L. Une fois tombé, ce que la coupelle a bu est
hors d'atteinte, et le corps ne peut pas revenir payer deux fois. Tant
qu'un nuage de vapeur traîne dans la bouche, le couvercle attend ; le canal,
lui, est déjà allumé.

**Rien ne se reprend.** La reprise a été étudiée puis écartée (conversation
de conception du 24/10) :

- en gravité nulle, avec de l'inertie et un mouvement qui coûte du
  volume, revenir en arrière est une corvée ;
- forcer la reprise demandait une règle de plus, un verrou de sas qui
  n'existait que pour la rattraper ;
- un sacrifice qu'on se fait rembourser ne pèse rien.

## 5. Le canal

La coupelle est une source de canal **au même titre qu'une pastille
laser** (`canalActif`, `src/game/laser.ts`, paramètre `autres`) :

- **OU** (la règle par défaut) : une coupelle pleine, ou une pastille
  allumée, du même numéro suffit ;
- **ET** : la porte attend toutes les sources de son numéro, pastilles et
  coupelles confondues.

Un tableau **sans émetteur laser** fonctionne aussi : dans ce cas, c'est
`majPortes` qui établit l'état des portes à chaque sous-pas (`src/main.ts`),
puisque le bloc des lasers ne tourne pas.

## 6. Dans l'éditeur

- **Poser.** Palette, groupe des mécanismes : **Coupelle (péage en
  volume)**. Cliquer pose la coupelle, glisser règle le rayon de sa bouche.
  Elle prend le premier canal qu'aucune pastille ni coupelle ne porte, pour
  ne jamais ouvrir par accident la porte d'une autre.
- **Régler** (panneau de droite) : le trait en % du corps à l'entrée, le
  canal, le rayon, la position. Le panneau dit combien de portes et de
  chasses le canal alimente.
- **Lire.** Un fil pointillé relie chaque coupelle à ses portes et à ses
  chasses. L'étiquette indique `nº canal · trait %`.
- **Une porte posée près d'une coupelle** prend son canal : la source la
  plus proche l'emporte, cible ou coupelle.
- **Dupliquer** garde le canal, donc deux coupelles qui ouvrent la même
  porte, en ET ou en OU. **Copier-coller** marche aussi. **Paver** donne un
  canal libre à chaque cellule copiée, et ses portes suivent.
- **Ce que la vérification signale :**

  | Cas | Niveau |
  | --- | --- |
  | coupelle hors de la cuve | erreur |
  | aucune porte ni chasse sur son canal (« le corps y paiera pour rien ») | avertissement |
  | coupelle qui touche le départ (elle boira le corps dès la première image) | avertissement |
  | traits qui dépassent ensemble 90 % du corps (impossible de tout payer) | avertissement |
  | porte ou chasse visant un canal que ni cible ni coupelle ne porte | erreur, comme avant |

## 7. En jeu

- **Le dessin est propre à la coupelle**, ce n'est pas celui de l'éponge.
  On voit une bouche cerclée de métal ; l'eau bue monte du centre (sa
  surface est la part payée) ; un anneau se referme depuis midi, où un cran
  marque le trait. Une fois fermée, un couvercle d'acier à six rayons
  allumés du vert des pastilles. Le numéro de canal est frappé au centre.
  Il est dessiné par le code (`drawMecanismes`, `src/main.ts`) ; un asset
  illustré peut le remplacer plus tard, à commander selon
  `docs/assets-ia.md`.
- **Le son.** Elle boit en silence, comme l'éponge (le bruit de succion de
  l'éponge agaçait). Le **trait atteint** s'entend, du côté où elle se
  trouve : un verrou d'acier qui claque, puis deux notes qui montent
  (`audio.couvercle`). C'est l'instant où la porte s'ouvre, souvent hors
  du cadre.

## 8. Recettes de conception

Ce sont des pistes, pas des salles.

- **Le péage simple.** Une coupelle, une porte. On apprend que le jet la
  remplit.
- **Le jet propulsif.** La coupelle placée *derrière* le joueur quand il
  fait face à la porte : la bonne trajectoire paie et avance d'un seul
  geste.
- **Le choix de route.** Une porte chère (une coupelle à 25 %) contre deux
  portes bon marché (10 % chacune) sur un trajet plus long.
- **La coupelle partagée.** Une coupelle dont le canal ouvre deux portes :
  celui qui l'a vu paie une seule fois.
- **La paire en ET.** Deux coupelles éloignées sur le même canal, et une
  porte en ET. Le beau geste est une trajectoire courbe qui remplit l'une
  puis l'autre au passage, aidée d'une chasse.
- **Le passage gelé.** Une coupelle dans un couloir étroit : celui qui
  passe gelé ne paie rien, mais il ne pilote plus.

## 9. Où vit le code

| Quoi | Où |
| --- | --- |
| la définition, les défauts, les bornes | `src/game/level.ts` (`CoupelleDef`) |
| les règles pures (trait borné, capacité, sources de canal) | `src/game/coupelle.ts` |
| boire, la fermeture du couvercle | `src/sim/solver.ts` (`setCoupelles`, `processCoupelles`, `fermeCoupellesVides`) |
| canal, couvercle en paroi, dessin, son | `src/main.ts`, `src/game/audio.ts` |
| lecture, écriture, vérification | `src/game/levelIO.ts` |
| l'éditeur | `src/editor/editor.ts`, `fiches.ts`, `pavage.ts`, `pressePapier.ts`, `index.html` |
| les tests | `src/game/coupelle.spec.ts`, `src/sim/coupelle.spec.ts`, et les spécifications de `levelIO`, `pavage`, `fiches` |
