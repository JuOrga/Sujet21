# Apprendre les énigmes, un tableau après l'autre

**Date** : 2026-08-31
**État** : validé, prêt pour le plan d'exécution

## Le problème

L'agent PPO traverse `21-01` correctement (1,09 L à l'épreuve à graines fixes,
3/3 traversées, contre 0,72 L au pilote écrit à la main). Mais il est enfermé
dans un jeu strictement plus pauvre que celui du joueur, et il oublie tout
entre deux lancements.

Trois murs, mesurés dans le code :

1. **8 tableaux sur 27 sont exclus d'office.** `tableauxRL()` (`src/rl/env.ts`)
   écarte tout niveau contenant lasers, cibles, rails, zones ou plots — c'est
   exactement l'ensemble des tableaux à énigmes : `21-S3`, `21-09` (zones),
   `21-H`, `21-I`, `21-K` (lasers, cibles), `21-J`, `21-L`, `21-M` (lasers,
   cibles, rails).
2. **Il ne les percevrait pas.** Les 16 rayons de télémétrie
   (`src/rl/capteurs.ts`) ne sont testés que contre les parois solides et les
   éponges. Lasers, cibles, rails et zones sont absents de la géométrie sondée.
3. **Il ne pourrait pas agir.** Les 19 actions sont : ne rien faire, se
   rassembler, conclure, pousser dans 16 directions. Ni glace, ni vapeur — or
   les énigmes de ce jeu se résolvent en changeant d'état.

Et une quatrième limite, transverse : `entrainePPO.ts:208` fait
`new Reseau([...], rnd)` à chaque lancement. Rien n'est jamais relu. Couper une
session, c'est repartir des poids aléatoires.

## Ce qu'on construit

**Une politique généraliste, apprise un tableau à la fois, qui garde les
précédents en révision.**

L'intention de l'utilisateur — « un par un, et il apprend de chacun » — est un
curriculum avec reprise de poids. Les sessions courtes de quinze minutes en
découlent gratuitement : c'est le même mécanisme, arrêté par un chrono.

### Deux décisions structurantes, prises et assumées

**L'ordre : capteurs d'abord, reprise ensuite.** Reprendre un entraînement
exige une architecture identique. Élargir l'observation invalide toute
politique entraînée avec l'ancienne. Livrer la reprise en premier ferait donc
jeter tout ce qui aurait été accumulé entre-temps. On fige la forme définitive
de l'observation avant d'ouvrir la reprise.

**La révision contre l'oubli catastrophique.** Un réseau qui apprend `21-05` en
partant des poids de `21-04` réutilise ce qu'il peut et écrase le reste : après
trois ou quatre tableaux enchaînés, il ne sait typiquement plus faire le
premier. On garde donc les tableaux déjà appris dans le mélange d'entraînement,
avec une part réglable.

## Les cinq pièces

Dans cet ordre. Les trois premières figent les formats, les deux dernières
s'appuient dessus.

### 1. Les capteurs — 43 → 71 entrées

`src/rl/capteurs.ts`. Ce fichier est le pont partagé entre l'entraînement sans
écran et le jeu dans le navigateur : une seule définition, les deux côtés la
lisent. C'est ce qui garantit qu'une politique entraînée hors ligne se comporte
identiquement à l'écran.

Les 16 rayons rapportent **déjà** un code de matériau en plus de la distance
(`o[i++] = t.materiau / 10`). Leur taille ne change pas ; ce qui change, c'est
la géométrie qu'ils testent.

| bloc | aujourd'hui | demain |
|---|---|---|
| corps : position, vitesse, direction et distance du sas, volume vivant, volume bu, rayon, chrono | 11 | 16 — plus l'état eau/glace/vapeur (3), la réserve de dashs (1), le péage de vaporisation (1) |
| 2 cibles les plus proches | — | 8 — direction (2), distance (1), touchée ou non (1), par cible |
| 2 lasers les plus proches | — | 8 — direction (2), distance (1), actif ou non (1), par laser |
| rail le plus proche | — | 3 — direction (2), distance (1) |
| zones | — | 4 — état forcé par la zone qui tient le corps (3, one-hot), distance de la plus proche (1) |
| 16 rayons × (distance, matériau) | 32 | 32 — inchangé en taille ; les matériaux couvrent les nouvelles familles |
| **total** | **43** | **71** |

Deux emplacements par famille plutôt qu'un : `21-K` a 2 lasers et 2 cibles,
`21-M` en a 3. « La plus proche » seule empêche toute anticipation. Trois
emplacements coûteraient 8 entrées de plus pour un seul tableau — on s'arrête à
deux, quitte à y revenir si `21-M` bloque là-dessus.

Tout reste normalisé dans `[-1, 1]` environ, comme le reste du fichier.

### 2. Les actions — 19 → 21

`src/rl/env.ts`. On ajoute `ACTION_GLACE` et `ACTION_VAPEUR`, des bascules
(re-demander l'état courant revient à l'eau), exactement comme les touches F et
G du jeu.

Le solveur sait déjà tout faire : `transfoVapeur()`, `naitEnVapeur()`,
`gasDash()`, `freezeIntent`, `gasIntent`, `iceNormalAt()`, `railConvoy()`. Ce
que `main.ts` ajoute tient en deux lignes (`sim.freezeIntent = …`,
`sim.vaporTollFactor = lev('peageVapeur')`).

**Le dash ne coûte aucune action nouvelle** : pousser en vapeur *est* un dash.
Hypothèse à vérifier contre `main.ts` pendant la construction. Si elle est
fausse, le dash devient un bloc de 16 directions (21 → 37 actions) et il faut
le signaler avant de continuer.

### 3. Le filtre levé, famille par famille

`tableauxRL()` s'ouvre en trois temps, chacun vérifiable seul :

1. **zones** → `21-S3`, `21-09`
2. **lasers et cibles** → `21-H`, `21-I`, `21-K`
3. **rails** → `21-J`, `21-L`, `21-M`

**C'est le risque principal du projet.** La logique des lasers et des cibles
vit dans `main.ts`, un fichier de plus de onze mille lignes, où elle est
vraisemblablement mêlée au rendu. La porter dans l'environnement sans écran est
un travail d'archéologie, pas de plomberie.

Elle va dans un module neuf, `src/rl/enigmes.ts`, plutôt que de gonfler
`env.ts` (déjà 14 Ko et responsable de la boucle de décision). Frontière :
`enigmes.ts` répond à « quel est l'état des cibles, des lasers, des rails et
des zones à cet instant, et que faut-il appliquer au solveur ? » ; `env.ts`
reste la boucle et la récompense.

Si l'extraction d'une famille s'avère plus tortueuse que prévu, les deux autres
sont livrées et le blocage est nommé explicitement.

### 4. La récompense

`src/rl/env.ts`. Trois termes s'ajoutent aux six existants (`livre` 6,
`approche` 5, `reussite` 10, `perte` −1,5, `dispersion` −3, `temps` −0,05) :

| terme | signe | rôle |
|---|---|---|
| `cible` | + | prime par cible touchée — le vrai but, mais rare |
| `approcheCible` | + | remplace `approche` tant qu'il reste des cibles : le corps est tiré vers la prochaine cible, pas vers le sas |
| `bascule` | − | petit coût par changement d'état, sinon la politique clignote entre eau et vapeur |

`approcheCible` est l'idée centrale. Une énigme ne paie qu'à la fin ; sans
terme dense qui pointe vers l'étape suivante, on retrouve exactement le piège
documenté dans `env.ts:88` — l'agent apprend que ne rien faire coûte moins cher
qu'échouer courageusement.

**Les neuf poids deviennent réglables en ligne de commande** :
`--poids cible=8,approcheCible=4`. C'était le seul paramètre inaccessible, et
c'est celui qui décide de tout.

### 5. La reprise, le curriculum, le chrono

`src/rl/entrainePPO.ts`.

```bash
# première session : quinze minutes sur le berceau
vite-node src/rl/entrainePPO.ts --tableaux 21-01 --minutes 15 --sortie run.json

# le lendemain : on continue et on ajoute un tableau, l'ancien passe en révision
vite-node src/rl/entrainePPO.ts --reprend run.json --tableaux 21-02:3,21-01:1 --minutes 15
```

- **`--reprend <fichier>`** charge les poids de la politique et du critique,
  **et l'état de l'optimiseur** (les moments d'Adam) — sans eux la reprise fait
  un à-coup visible. Le fichier passe d'environ 134 Ko à environ 400 Ko.
- **Refus explicite en cas d'incompatibilité** : si `tailleObs`, `couches` ou
  le nombre d'actions diffèrent, l'entraînement s'arrête avec un message qui
  nomme l'écart (« entraîné avec 43 entrées, cet environnement en a 71 »).
  Jamais d'agent silencieusement fou.
- **`--minutes N`** s'arrête proprement à la fin d'une itération, écrit le
  fichier, et **affiche la commande à recoller** pour la session suivante.
- **`--tableaux 21-02:3,21-01:1`** : le nombre après les deux-points est la
  part de calcul. Trois quarts sur le nouveau, un quart en révision. Sans
  deux-points, part égale — la forme actuelle reste valide.
- **L'épreuve à graines fixes devient un tableau de bord par niveau.** Une
  moyenne unique cacherait précisément ce qu'on cherche à surveiller : l'oubli
  d'un tableau déjà acquis.

## Ce que ça casse

`public/agents/ppo-berceau.json` et `public/agents/live.json` deviennent
injouables dès que les capteurs changent. Ils sont archivés sous
`public/agents/heritage-43/` avec une note expliquant qu'ils appartiennent au
format à 43 entrées. Le choix est assumé : c'est le prix de ne rien jeter
ensuite.

## Ce que ça ne garantit pas

Les pièces 1, 2, 3 et 5 sont de l'ingénierie : elles sont vérifiables et on
s'engage dessus.

La pièce 4 reste un problème ouvert. Elle fournit des outils réglables et une
prime d'approche bien pensée, pas la certitude que l'agent résoudra `21-M`.
Aucune promesse de résultat n'est faite sur les tableaux à énigmes.

## Vérification

- Tests unitaires sur les capteurs élargis : chaque nouvelle famille
  d'objets produit les entrées attendues sur un tableau qui la contient, et des
  entrées neutres sur un tableau qui n'en a pas.
- Test de non-régression du pont : l'observation calculée côté environnement et
  celle calculée côté navigateur restent identiques au nombre près.
- Test de la reprise : un entraînement coupé puis repris donne la même
  trajectoire qu'un entraînement continu de même durée (aux arrondis près).
- Test du refus : un fichier de l'ancien format produit l'erreur explicite, pas
  un plantage.
- La suite existante (658 tests) reste verte.
