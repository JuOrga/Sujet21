# LES SUBSTANCES — ce que le corps boit, et ce que ça fait de lui

*Esquisse à trancher, 19/11/2026. Rien ici n'est du code.*

L'idée du concepteur (19/11/2026), telle qu'il l'a dite : *on a déjà les
semblables ; on aimerait, avec eux ou par autre chose — « essence »,
peut-être —, d'autres liquides que le volume puisse absorber, de couleurs
et de textures différentes, qui influencent ses propriétés et donnent
d'autres récompenses.* Et aussitôt : *je ne sais pas exactement si c'est
ça.*

Ce document existe pour qu'on n'ait pas à y revenir. Il fait trois choses :
il dit **ce que le jeu contient déjà** de cette idée (plus qu'on ne croit),
il pose **les huit décisions** qu'elle demande — chacune avec ses options,
une recommandation et sa raison —, et il propose **un premier palier**
assez petit pour être jugé en jouant plutôt qu'en lisant.

**La règle d'usage** : tant qu'une décision porte « À TRANCHER » au §9,
rien ne se code en aval d'elle. Un verdict s'écrit au §9, daté, et la
section correspondante est réécrite à l'indicatif. Quand les huit sont
rendus, ce document cesse d'être une esquisse et devient la référence.

---

## 1. L'idée en une phrase

**Le corps rencontre d'autres liquides que lui ; ce qu'il en absorbe le
change — on le voit autrement, il se comporte autrement, et il accède à
autre chose.**

Trois mots à tenir séparés dans tout ce qui suit, parce que les confondre
est ce qui ferait revenir sur le travail :

- **la substance** : le liquide lui-même, qu'on voit dans la salle puis
  dans le corps ;
- **la propriété** : ce que le corps fait différemment tant qu'il la porte ;
- **le prix** : ce qu'elle lui retire. Sans prix, c'est un bonus, et le jeu
  n'en donne pas (§4).

## 2. Ce que le jeu en contient déjà

L'idée n'arrive pas sur une page blanche. Six morceaux existent, écrits ou
codés, et aucun ne parle aux autres :

| Où | Ce qui y est | Ce que ça vaut pour l'idée |
| --- | --- | --- |
| `scenario.md`, « Les semblables et la douche » (canon validé) | les fioles du hub contiennent des semblables sans conscience ; la glace les libère ; ils **servent à muter** ; à la **douche**, le joueur **ajoute des substances à son essence** et obtient des pouvoirs par mutation. Post-démo. | **l'idée est déjà au canon**, sous sa forme méta (au hub). Le mot « substance » y est. |
| `doc-fonctionnel.md` §8 | « chaque bonbonne est une eau différente, pas un chiffre différent » : distillée, surchauffée, glycolée, salée, contaminée — chacune avec sa propriété et son prix | **le catalogue est déjà esquissé**, et sa règle d'écriture aussi |
| `doc-fonctionnel.md` §6 et §14.5 | « souillure (encre, huile, sel) : modifie les propriétés du corps » ; décision ouverte : *la contamination est-elle persistante ou nettoyable ?* | la question de la durée (D4) est ouverte depuis la v0.1 |
| `evenements.ts`, rencontre `rebuts` (LA CUVE DES REBUTS) | « EN BOIRE UN » : distillée, salée, surchauffée ou contaminée, au hasard | **on boit déjà** — mais c'est un texte et une carte : le corps ne change ni d'aspect ni de matière |
| `fioles.ts` | six fioles équipables, deux logements, un effet passif pour la run | des « échantillons scellés » qui ne touchent jamais le corps : un écran, pas une physique |
| `leviers.ts` | vingt-deux leviers nommés ; une récompense est une liste d'effets sur ces leviers, fabricable à l'atelier sans code | **la grammaire des propriétés existe** : une substance peut s'écrire en effets, comme un instrument |

Et les semblables, aujourd'hui, sont **quelqu'un**, jamais une matière :
le Sujet 12 derrière la grille de l'Économat, le Semblable du comptoir au
hub, le Sujet 09 endormi (rencontre `semblable`), les fioles de l'alcôve
de conservation, l'aile des endormis (une réparation du hub).

Côté moteur, le solveur ne connaît que deux matières (`KIND_FREE`,
`KIND_PLAYER`) et l'eau libre qui touche le corps fusionne avec lui. Il
porte en revanche des canaux par particule (`frost`, `vapor`, `ionise`) ;
`ionise` est le précédent utile : un état de **rendu** tenu par le solveur
« parce que seul le solveur sait qui voyage dans la bande », sans peser
sur aucune physique.

## 3. Le mot

« Essence » est déjà pris, trois fois :

1. **l'essence maximale** — le volume avec lequel le corps naît dans chaque
   salle, rogné par les sacrifices (`run.essence`, plancher à 40 % par défaut) ;
2. **les orbes d'essence de conscience** — les clés des transformations,
   au marchand et dans les caches ;
3. **« son essence »** au canon — ce que le Sujet est.

Un liquide nommé « essence » serait un quatrième sens, et les écrans
diraient « −12 % d'essence maximale » à côté de « une dose d'essence ».
Le canon a déjà le bon mot : **substance**. Et « semblable » reste un
*qui*, pas un *quoi* (D6).

## 4. Ce qui décide — les règles que l'idée ne peut pas casser

1. **Grossir n'est jamais une récompense, c'est une décision**
   (`doc-fonctionnel.md` §3.2), et **il n'y a pas d'eau à ramasser dans le
   niveau** (§7.1). Un liquide à absorber est, à la lettre, de l'eau à
   ramasser : D3 doit répondre à cela.
2. **Une seule ressource.** Pas de seconde jauge : ce que le corps porte
   se lit sur le corps.
3. **La physique produit les règles.** Une propriété qui ne se voit que
   dans une carte est un instrument avec une étape de plus.
4. **La charte.** Une seule couleur d'accent, le cyan ; l'ambre est au
   laboratoire, le violet au méta ; `sujet-vivant.md` §7 : « jamais une
   teinte nouvelle » sur le corps. Des liquides « de couleurs différentes »
   demandent donc un amendement explicite (D8), pas un contournement.
5. **Le laboratoire reste froid.** Les textes disent « échantillon »,
   « protocole », « contaminé » ; aucun ne s'émerveille.
6. **Le moteur.** Le shader de composition est au plafond de 16 textures
   (un test le garde) : aucune texture nouvelle. Le solveur a des noyaux
   WebAssembly (`asm/noyaux.ts`) : ce qu'un canal de plus par particule
   coûte de chaque côté est **à mesurer avant d'être promis**. Les présets
   du banc restent au pixel près.

## 5. Les huit décisions

### D1 — Le mot

- a. « essence » · b. **« substance »** · c. un mot neuf.

**Recommandation : b.** Raison au §3 : c'est le mot du canon, et « essence »
a déjà trois sens à l'écran.

### D2 — Où ça vit

- a. **Dans la run** : des liquides dans des lieux de la descente, que le
  corps absorbe physiquement.
- b. **Au hub** : la douche du canon, choisie avant de descendre.
- c. **Les deux, à deux étages** : on boit dans la run ; le hub (les
  semblables, la douche) décide *quelles* substances la run peut offrir.

**Recommandation : c, en commençant par la run.** La version « hub seul »
serait un écran de plus où l'on équipe quelque chose — les fioles le font
déjà. Ce que le jeu a et que les autres n'ont pas, c'est un corps simulé :
un liquide qui entre en lui *se voit entrer*. Et cela ne contredit pas le
canon, cela le prépare : la douche reste post-démo, elle arrive par-dessus.

### D3 — Ce qu'absorber fait au volume

- a. **Ajoute** : la dose s'additionne au corps (ce que fait la fusion
  aujourd'hui avec l'eau libre).
- b. **Remplace** : la dose prend la place d'une part égale du corps ; le
  volume ne bouge pas. *Boire, c'est se diluer.*
- c. **Marque** : aucune matière n'entre, le contact suffit.

**Recommandation : b.** C'est la seule qui tienne la règle 1 sans
exception à écrire, et elle donne le prix de base gratuitement : une part
de soi n'est plus soi. (a) ferait de chaque bassin un bonus de volume ;
(c) retire le geste physique, qui est tout l'intérêt.

### D4 — Combien de temps

- a. la salle · b. **la run** · c. **tant qu'il en reste dans le corps** ·
  d. pour toujours (mutation).

**Recommandation : b pour le premier palier, c comme cible, d réservé à la
douche.** (c) est la réponse la plus « Sujet 21 » : la substance part avec
les gouttes qu'on éjecte, donc *se déplacer, c'est aussi se rincer* — une
durée sans chronomètre, que le joueur règle par sa façon de jouer. Mais
elle demande un canal par particule, une loi concentration → effet, et de
porter la concentration d'une salle à l'autre (le corps renaît plein à
chaque salle). (b) se pose en un drapeau et suffit à juger si boire
*fait quelque chose*. Cela répond aussi à §14.5 du doc fonctionnel :
persistante dans la run, **nettoyable** par la distillée (§6).

### D5 — Une à la fois, ou des mélanges

- a. **une seule** : en boire une autre remplace la première ;
- b. plusieurs, effets cumulés ; c. des mélanges qui donnent autre chose.

**Recommandation : a.** Avec *n* substances, (c) fait *n(n−1)/2* couples à
concevoir, équilibrer et dessiner — dix pour cinq. Et « remplacer » crée
un vrai choix devant chaque bassin : *ce que j'ai, ou ce qu'on m'offre*.
Les mélanges, s'ils viennent, sont l'affaire de la douche.

### D6 — Le rôle des semblables

- a. **La source, au méta** : chaque semblable libéré apporte *sa*
  substance au répertoire des runs suivantes (le canon : « ils servent à
  muter »).
- b. Des marchands seulement, comme aujourd'hui.
- c. Sans lien : deux systèmes.

**Recommandation : a.** Le semblable est le *qui*, la substance le *quoi* :
l'aile des endormis devient la progression du système, et le Sujet 12
peut vendre une dose à l'Économat sans rien inventer. **Une question de
récit en découle, et elle est au concepteur** : que devient un semblable
dont on prend la substance ? S'il y survit, c'est un don ; s'il s'y
dissout, c'est le joueur qui fait au semblable ce que le laboratoire fait
au Sujet — et les fins « evil » et « semi-evil » prévues à `scenario.md`
ont là leur matière.

### D7 — Ce que « d'autres récompenses » veut dire

- a. Des **multiplicateurs** au sas (mémoire, condensat) selon la substance.
- b. Des **clés latérales** : chaque substance ouvre une chose qu'elle
  seule ouvre, comme les états (`doc-fonctionnel.md` §9.2).
- c. Des **cartes propres** : un tirage d'instruments réservé au porteur.

**Recommandation : b d'abord, a jamais seule.** « Une eau différente, pas
un chiffre différent » (§8) : un multiplicateur est un chiffre. Et les
déblocages du jeu ouvrent des chemins latéraux, jamais des raccourcis
(§9.1). La récompense est donc *où la substance permet d'aller* ; (c)
peut s'y ajouter plus tard, la grammaire des leviers le permet déjà.

### D8 — La couleur, face à la charte

- a. **Le corps entier** prend la teinte.
- b. **L'intérieur seulement** : la substance est un nuage dans le corps,
  comme une encre dans l'eau ; la peau (le liseré) reste cyan.
- c. **Pas de teinte** : la texture seule (grain, opalescence, lenteur de
  l'ondulation).

**Recommandation : b**, avec une palette courte et désaturée inscrite à
`charte-visuelle.md` comme amendement. Le liseré cyan est ce qui dit « c'est
lui » à toutes les distances ; le garder, c'est garder la lisibilité. Et
`sujet-vivant.md` (G1, « l'intérieur habité ») va dans le même sens : le
corps gagne un dedans. L'ambre et le violet restant pris, les teintes des
substances sont à choisir ailleurs — c'est le travail de l'amendement.
Sans texture nouvelle (règle 6), la teinte passerait par un canal par
particule versé dans le champ existant, à la manière de `ionise` : à
chiffrer.

## 6. Le catalogue — des candidats, pas des décisions

Repris de `doc-fonctionnel.md` §8 et de la cuve des rebuts, pour montrer la
forme d'une ligne. **La règle d'écriture** : une substance = une propriété,
un prix, une chose qu'elle ouvre. Une ligne qu'on ne sait pas remplir
jusqu'au bout ne part pas.

| Substance | Ce qu'on voit (dedans) | Propriété | Prix | Ce qu'elle ouvre | Accroche |
| --- | --- | --- | --- | --- | --- |
| **Salée** | un grain fin, des reflets | conductrice | attire les décharges | ce qui demande un courant | **à inventer** : rien d'électrique trouvé dans le code (`circuits.ts` est de la logique au laser) |
| **Glycolée** | sirupeuse, ondule lentement | le froid la prend mal | presque impossible à vaporiser | les modules cryo sans geler malgré soi | levier `peageVapeur` pour le prix ; le côté antigel est à relier au givre |
| **Surchauffée** | des bulles, un miroitement | pousse fort, se vaporise d'un rien | se consume vite | — *(ligne incomplète)* | leviers `peageVapeur`, `perteVapeur` |
| **Contaminée** | trouble, plus sombre | du volume en plus (exception assumée à D3) | fuite prioritaire | — *(ligne incomplète)* | l'effet `confinement` des rencontres existe |
| **Distillée** | limpide | aucune : **elle rince** la substance portée | on perd ce qu'on avait | les filtres sans perte | levier `perteGrille` |

Deux lignes sont incomplètes à dessein : c'est exactement le tri que la
règle doit faire. En réserve, de §6 : l'encre, l'huile.

## 7. Les paliers

| Palier | Ce qu'on livre | Ce qu'on y apprend |
| --- | --- | --- |
| **P0** | ce document, tranché (§9) | qu'on parle de la même chose |
| **P1 — la première gorgée** | **une** substance, **un** lieu (la cuve des rebuts devenue un vrai bassin, dans une halte), un drapeau pour la run, le nuage dans le corps, ses effets en leviers, sa fiche au codex | si boire *fait quelque chose* — vu, senti, compris sans lire |
| **P2 — le répertoire** | quatre ou cinq substances, la dose vendue à l'Économat, la distillée qui rince, une clé latérale par substance | si l'on hésite devant un bassin |
| **P3 — la dilution** | la durée par la physique (D4 c) | si « se rincer en bougeant » se pilote |
| **P4 — les semblables et la douche** | le méta du canon (D6), post-démo | — |

P1 est petit exprès : il se juge sur un aperçu, et tout ce qu'il pose
(la règle en fonctions pures et testées, comme `bonbonne.ts` ; le canal de
rendu ; l'interrupteur) sert aux paliers suivants.

**Ce qu'on ne fait pas, tant que rien ne le redemande** : des liquides
semés dans les salles ordinaires (règle 1) ; une jauge de substance
(règle 2) ; les mélanges (D5) ; un corps repeint tout entier (D8) ; un
second sens au mot « essence » (D1).

## 8. Comment on saura que ça marche

Pas une mesure, deux questions, posées à quelqu'un qui ne connaît pas le
jeu, après le bassin de P1 :

1. **« Qu'est-ce qui a changé ? »** — s'il le dit sans avoir lu la carte,
   la substance est une physique. Sinon c'est un instrument déguisé.
2. **« Tu as hésité avant de boire ? »** — si oui, le prix existe. Sinon
   c'est un bonus, et la règle 1 est cassée.

## 9. Les verdicts

| | Décision | Recommandé | Verdict | Date |
| --- | --- | --- | --- | --- |
| D1 | le mot | « substance » | À TRANCHER | |
| D2 | où ça vit | la run d'abord, le hub par-dessus | À TRANCHER | |
| D3 | absorber et le volume | remplace (se diluer) | À TRANCHER | |
| D4 | la durée | la run en P1, la dilution en cible | À TRANCHER | |
| D5 | une ou plusieurs | une à la fois | À TRANCHER | |
| D6 | les semblables | la source, au méta — et le sort du semblable | À TRANCHER | |
| D7 | les récompenses | des clés latérales | À TRANCHER | |
| D8 | la couleur | l'intérieur seulement, charte amendée | À TRANCHER | |
