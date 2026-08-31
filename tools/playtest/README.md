# Le banc de playtest

Un bot qui rejoue tous les tableaux sans navigateur et dit ce qu'ils valent.
Il ne remplace pas un joueur : il remplace la corvée de vérifier, à chaque
commit, qu'aucun tableau n'est devenu infranchissable ou méconnaissable.

```bash
pnpm playtest                        # tous les tableaux de la partie
pnpm playtest --audit                # l'audit seul, sans simuler (instantané)
pnpm playtest --tableau=21-A,21-01   # quelques tableaux
pnpm playtest --tous                 # école et hors-parcours compris
pnpm playtest --json                 # met à jour la référence versionnée
pnpm playtest --base                 # compare à elle, ÉCHOUE si régression
pnpm playtest --journal              # le journal de décision, coup par coup
pnpm playtest --essais=1 --temps=60  # plus court : un seul réglage, 60 s par essai
```

Code de sortie **1** si l'audit lève une erreur, ou si la comparaison à la
référence trouve une régression. De quoi le brancher en intégration continue.

## Ce que l'outil fait, et ce qu'il ne fait pas

Il a **deux moitiés, de fiabilité très différente** — les confondre serait le
seul vrai piège.

### L'audit : géométrie pure, aucune simulation, aucune fausse alerte

Instantané, déterministe, sans jugement. Quand il dit « le sas est muré », il
l'est. C'est cette moitié qu'on peut faire échouer un pipeline sans crainte.

Il vérifie, tableau par tableau :

- le corps naît-il dans une paroi ? le sas est-il vide, inversé, hors cuve,
  entièrement muré ?
- **dans quels états le sas est-il atteignable** — eau, glace, vapeur ? Chaque
  état a ses portes (la grille laisse passer la vapeur, le rideau la glace, la
  membrane l'eau), et l'audit refait le calcul pour les trois. Un sas fermé à
  l'eau n'est pas une panne : c'est peut-être la leçon du tableau. L'erreur
  n'est levée que si **aucun** état ne passe.
- la **section du plus large passage** qui mène au sas, comparée au diamètre
  du corps au départ. Ce n'est pas le goulot du plus court chemin (celui-là
  rase toujours un angle et ne dit rien) : c'est le chemin qui maximise sa
  propre section la plus étroite.
- le passage traverse-t-il forcément l'éponge ? le laser est-il obligatoire,
  ou les portes se contournent-elles ? le `par` est-il déclaré ?

### Le pilote : une simulation, et donc une opinion

Le bot joue vraiment. Il n'est **pas** un joueur humain et ne prétend pas
l'être : il franchit dix à onze des treize tableaux jouables à l'eau, en trois
à sept impulsions là où le `par` en annonce cinq à huit. Sur les deux ou trois
qu'il rate, la conclusion à tirer est « le bot n'y arrive pas », pas « le
tableau est cassé ».

Sa valeur n'est donc pas absolue, elle est **comparative**. La simulation étant
déterministe (aucun `Math.random` dans `src/sim/`, pas d'horloge murale), deux
exécutions du même code donnent exactement le même résultat. Un tableau qui
passait et ne passe plus est un signal, quel que soit le talent du bot :

```bash
pnpm playtest --base               # à chaque changement de niveau ou de physique
pnpm playtest --json               # quand l'écart est VOULU : on entérine
git add tools/playtest/reference.json
```

`tools/playtest/reference.json` est versionné : c'est ce que le banc donnait
sur une base saine. Le mettre à jour est un geste délibéré, qui se relit en
revue comme le reste du diff.

La comparaison signale : un sas devenu inatteignable, un tableau que le pilote
franchissait et rate désormais, et un effondrement du volume livré (plus de
15 points) — un changement d'équilibrage, voulu ou non, mais qui se voit.

## Comment le pilote joue

Pas de réseau entraîné, et c'est délibéré : on veut mesurer le TABLEAU, pas le
talent d'une IA. Un pilote lisible et reproductible est un meilleur instrument
qu'un joueur artificiel dont on ne saurait jamais si l'échec vient du niveau
ou de lui.

1. **Une carte** : les obstacles rastérisés en grille d'occupation, puis un
   champ de distance au sas (Dijkstra 8-connexe). Un second champ renchérit
   les abords des parois — le chemin tient le milieu des couloirs quand il
   peut, s'y colle quand il n'y a pas d'autre passage.
2. **Une seule question, à chaque décision** : *le corps gagne-t-il encore du
   terrain ?* Si oui, on ne fait **rien** — et ne rien faire est gratuit. Tout
   le rendement se joue là : la physique fait payer chaque impulsion
   (2 s de tenue sur un corps de 900 valent ~105 u/s et 13 % du volume), et un
   pilote qui corrige en permanence arrive au sas à sec.
3. **Une impulsion** = un appui maintenu, relâché dès que la consigne est
   atteinte. Le doigt bouge pendant l'appui, comme celui d'un joueur : le
   chemin tourne, une direction figée emmènerait le corps dans la paroi que le
   champ voulait éviter.
4. **Un réflexe** : le pilote balaie sa trajectoire une à deux secondes devant
   lui ; si elle mène dans une paroi, il freine et change de cap. Une paroi
   prise à 175 u/s ne se rebondit pas, elle pulvérise le corps (720 particules
   vivantes tombent à 32 en deux secondes).
5. **Le regroupement**, geste gratuit : quand des gouttes traînent dans le
   halo, `rassemble()` les rappelle sans rien coûter ni freiner.

Trois réglages sont essayés — `économe`, `franc`, `pressé` —, et le meilleur
essai fait foi. L'écart entre les trois est en soi une lecture de difficulté :
un tableau franchi par le seul « pressé » exige de la vitesse ; franchi par
« économe », il est généreux.

## Hors périmètre

Le pilote ne joue **que l'eau**. Il ne pilote ni faisceau laser ni changement
d'état, et le dit au lieu d'inventer un verdict : les tableaux à portes
asservies (21-H à 21-M) et ceux dont une zone impose la glace ou la vapeur
sont audités mais pas joués. C'est le premier chantier si l'outil doit aller
plus loin — piloter les cibles laser demanderait de raisonner sur le trajet du
faisceau, pas seulement sur celui du corps.

## Les fichiers

| fichier | rôle |
| --- | --- |
| `carte.ts` | grille d'occupation, distance aux parois, champ de flux, plus large passage |
| `monde.ts` | le tableau instancié sans DOM ; un pas = éjection, aspiration du sas, `sim.step` |
| `pilote.ts` | le contrôleur, ses réglages, le journal de décision |
| `audit.ts` | les contrôles sans simulation |
| `rapport.ts` | mise en forme, JSON, comparaison à une référence |
| `run.ts` | le CLI |
| `playtest.spec.ts` | les tests de l'outil (dont le déterminisme, dont tout dépend) |
