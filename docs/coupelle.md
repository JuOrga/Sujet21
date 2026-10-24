# La coupelle — le péage en volume

*Livraison du 24/10/2026 : la mécanique, dans le moteur et dans
l'éditeur. Refonte le même jour, après l'essai du concepteur : la coupelle
aspire et boit à débit borné, et une outre a remplacé la jauge. Aucun
tableau n'en porte encore : c'est un outil posé pour le concepteur, pas
une salle.*

## 1. La règle, en une phrase

**La coupelle aspire le liquide et le boit, à débit borné, jusqu'à son
trait.**

Pleine, elle allume son **canal** pour de bon, comme une pastille laser
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
| `aspiration` | la force et la portée du courant, de 0 à 1 | `COUPELLE_ASPIRATION_DEFAUT` = 0,3 |

## 2. Pourquoi elle aspire : l'essai du 24/10

La première version avalait d'un coup tout ce qui entrait dans la bouche.
À l'essai, le concepteur a dit : *« on ne se rend pas compte que cela
aspire du liquide, ça fait juste le cercle qui se remplit en mode gaming…
on ne voit pas de liquide »*. Sur Terre, il suffirait d'une soucoupe :
l'eau qui avance sur une surface plate y tombe, et on la voit tomber. En
apesanteur, rien ne tombe. L'équivalent est **un courant** : c'est
l'aspiration qui déplace l'eau, comme dans les toilettes de l'ISS ou au sas
du jeu, dont les joueurs voient déjà le corps s'étirer et s'engouffrer.

Le moteur avait déjà appris la leçon une fois, avec l'aspiration du vide :
sans borne, 900 particules disparaissaient en 0,86 s, *« un clignement, pas
une aspiration »*. Une fois le débit borné, on voit le liquide s'étirer et
plonger. La coupelle suit la même règle.

## 3. Le champ, puis la gorgée

- **Le champ.** Dans sa portée, un courant rentrant entraîne le liquide
  vers le centre : le corps qui passe à côté s'étire vers la bouche, et
  les gouttes du jet y sont happées. Il n'y a pas de giration, donc pas
  d'orbite d'équilibre : l'eau entre droit. Hors du champ, il n'y a ni
  traînée ni adhérence.

  | Aspiration | Portée | Courant |
  | --- | --- | --- |
  | 0 | la bouche seule (`r`) | 105 u/s |
  | 0,3 (le défaut) | 1,6 × `r` | 200 u/s environ |
  | 1 | 3 × `r` | 420 u/s (`COUPELLE_COURANT`) |

  (`champCoupelle`, `src/game/coupelle.ts`). Le courant se renforce dans
  la bouche et se pose au centre, pour ne pas faire osciller l'eau.
- **La gorgée.** Dans la bouche, la coupelle boit au plus
  **`COUPELLE_DEBIT` = 90 particules par seconde**, les plus proches du
  centre d'abord. Ce débit est au-dessus du jet (32 gouttes par seconde)
  pour que tirer dans la coupelle ne déborde pas. Une courte rafale (un
  quart de seconde de débit) est tolérée, pour qu'une goutte qui traverse
  la bouche en quelques pas soit bue plutôt que manquée. Avec ce débit, un
  trait de 10 % d'un corps de 900 particules se boit en une seconde.

## 4. Ce qu'elle boit, et ce qu'elle laisse passer

- **Le trait est une part du corps, pas un volume en litres.** La masse de
  référence est le corps **à l'entrée du tableau** ; Recommencer la
  retrouve à l'identique. La capacité en particules est
  `⌈trait × référence⌉`, et elle n'est jamais nulle (`capaciteCoupelle`).
- **Elle boit le corps ET les gouttes libres.** Il n'y a qu'une règle.
  Une version qui aurait épargné le corps l'aurait tout de même grignoté :
  le remous détache des fragments au passage, et ces fragments sont des
  gouttes libres.
- **Elle ne prend jamais plus que son trait.** Pleine, elle n'aspire plus
  et ne boit plus une goutte.
- **La glace et la vapeur passent sans payer.** Le courant n'a pas de prise
  sur elles. Traverser gelé, c'est un passage gratuit, et c'est un levier
  de conception, pas un oubli.
- **Rien ne se reprend.** La reprise a été étudiée puis écartée : en
  gravité nulle, avec de l'inertie et un mouvement qui coûte du volume,
  revenir en arrière est une corvée, et un sacrifice qu'on se fait
  rembourser ne pèse rien.

**Il n'y a plus de couvercle solide.** La première version fermait la
coupelle d'un disque plein. Fermé d'un coup, il est apparu au milieu du
corps qui traversait encore la bouche et l'a fait éclater en étoile : un
corps de 2,5 L est arrivé à la porte réserve à sec, avec 0,14 L. Une
coupelle pleine ne boit plus rien, donc elle n'a pas besoin de devenir une
paroi : le corps peut la traverser sans risque.

## 5. Les deux façons de payer

1. **Avec le corps.** On passe dans la coupelle ou à côté : le courant
   tire, et l'eau coule dans la bouche. C'est rapide, mais on paie en plus
   de ce que coûte le déplacement.
2. **Avec le jet.** Les gouttes éjectées comptent, et le courant les
   happe. Le geste habile consiste à se placer dos à la coupelle et à tirer
   dedans : **le recul propulse le corps vers la porte que ce même jet est
   en train d'ouvrir**. L'eau qui le fait avancer est aussi celle qui paie.

Une aspiration forte rend la coupelle dangereuse à frôler, mais facile à
remplir au jet. Une aspiration faible, c'est l'inverse.

## 6. Le canal

La coupelle est une source de canal **au même titre qu'une pastille
laser** (`canalActif`, `src/game/laser.ts`, paramètre `autres`) :

- **OU** (la règle par défaut) : une coupelle pleine, ou une pastille
  allumée, du même numéro suffit ;
- **ET** : la porte attend toutes les sources de son numéro, pastilles et
  coupelles confondues.

Un tableau **sans émetteur laser** fonctionne aussi : dans ce cas, c'est
`majPortes` qui établit l'état des portes à chaque sous-pas
(`src/main.ts`).

## 7. Dans l'éditeur

- **Poser.** Palette, groupe des mécanismes : **Coupelle (péage en
  volume)**. Cliquer pose la coupelle, glisser règle le rayon de sa bouche.
  Elle prend le premier canal qu'aucune pastille ni coupelle ne porte.
- **Régler** (panneau de droite) : le trait en % du corps à l'entrée,
  l'aspiration en %, le canal, le rayon, la position. Le panneau dit
  combien de portes et de chasses le canal alimente.
- **Lire.** Un cercle pointillé fin montre la portée du courant ; un fil
  pointillé relie la coupelle à chaque porte et chasse qu'elle alimente.
  L'étiquette indique `nº canal · trait %`.
- **Une porte posée près d'une coupelle** prend son canal : la source la
  plus proche l'emporte, cible ou coupelle.
- **Dupliquer** garde le canal. **Copier-coller** marche aussi. **Paver**
  donne un canal libre à chaque cellule copiée, et ses portes suivent.
- **Ce que la vérification signale :**

  | Cas | Niveau |
  | --- | --- |
  | coupelle hors de la cuve | erreur |
  | aucune porte ni chasse sur son canal (« le corps y paiera pour rien ») | avertissement |
  | coupelle qui touche le départ (elle boira le corps dès la première image) | avertissement |
  | traits qui dépassent ensemble 90 % du corps (impossible de tout payer) | avertissement |
  | porte ou chasse visant un canal que ni cible ni coupelle ne porte | erreur, comme avant |

## 8. En jeu

- **L'outre.** En apesanteur, un réservoir n'a pas de fond où l'eau
  tombe ; il a une poche souple qui gonfle, comme les réservoirs spatiaux à
  vessie. Vide, l'outre pend, fripée, autour de la grille de la bouche.
  Chaque gorgée la gonfle et la fait frémir. Pleine, elle est tendue et
  luisante, et la vanne s'allume du vert des pastilles.
- **Le courant** se lit à des traits qui filent vers la bouche, dans la
  portée. Le corps qui s'étire vers la bouche, c'est la physique qui le
  dessine.
- **Le numéro de canal** est inscrit au pied de l'outre.
- Tout cela est dessiné par le code (`drawMecanismes`, `src/main.ts`) ; un
  asset illustré peut le remplacer plus tard, à commander selon
  `docs/assets-ia.md`.
- **Le son.** La gorgée s'entend, discrète et plus grave que le sas
  (`audio.gorgee`). Le trait atteint s'entend du côté où se trouve la
  coupelle (`audio.vanne`) : c'est l'instant où la porte s'ouvre, souvent
  hors du cadre.

## 9. Recettes de conception

Ce sont des pistes, pas des salles.

- **Le péage simple.** Une coupelle, une porte. On apprend que le jet la
  remplit.
- **Le jet propulsif.** La coupelle placée *derrière* le joueur quand il
  fait face à la porte : la bonne trajectoire paie et avance d'un seul
  geste.
- **La coupelle gourmande.** Une aspiration forte dans un couloir étroit :
  il faut passer vite, ou gelé.
- **Le choix de route.** Une porte chère (une coupelle à 25 %) contre deux
  portes bon marché (10 % chacune) sur un trajet plus long.
- **La coupelle partagée.** Une coupelle dont le canal ouvre deux portes :
  celui qui l'a vu paie une seule fois.
- **La paire en ET.** Deux coupelles éloignées sur le même canal, et une
  porte en ET. Le beau geste est une trajectoire courbe qui les remplit
  l'une après l'autre.

## 10. Où vit le code

| Quoi | Où |
| --- | --- |
| la définition, les défauts, les bornes | `src/game/level.ts` (`CoupelleDef`) |
| les règles pures (trait, capacité, champ, débit, sources de canal) | `src/game/coupelle.ts` |
| aspirer et boire | `src/sim/solver.ts` (`setCoupelles`, `processCoupelles`, `aspireCoupelle`, `boitCoupelle`) |
| canal, dessin de l'outre, son | `src/main.ts`, `src/game/audio.ts` |
| lecture, écriture, vérification | `src/game/levelIO.ts` |
| l'éditeur | `src/editor/editor.ts`, `fiches.ts`, `pavage.ts`, `pressePapier.ts`, `index.html` |
| les tests | `src/game/coupelle.spec.ts`, `src/sim/coupelle.spec.ts`, et les spécifications de `levelIO`, `pavage`, `fiches` |
