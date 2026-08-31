# Apprendre à jouer — l'agent, l'environnement, les outils

*Réponse à la question : « est-ce qu'on pourrait faire en sorte qu'une IA
apprenne à jouer à Sujet 21, et qu'on voie comment elle évolue ? »*

**Oui.** Le jeu est un candidat inhabituellement propre pour l'apprentissage
par renforcement, et une première boucle complète — environnement, agent,
entraînement, courbe de progression — est livrée dans `src/rl/`. Ce document
dit ce qui est déjà là, ce que ça mesure, et ce qu'il faut comme outils pour
aller plus loin.

---

## 1. Pourquoi ce jeu s'y prête

Trois propriétés, vérifiées dans le code, décident de tout :

| Propriété | Vérification |
| --- | --- |
| **Le solveur ne dépend pas du navigateur** | `src/sim/solver.ts` n'importe ni DOM, ni canvas, ni audio — la suite de tests le fait déjà tourner sous Node. |
| **Aucun aléa dans la physique** | pas un `Math.random()` dans `src/sim/` : deux essais aux mêmes gestes donnent la même trajectoire, au bit près. C'est ce qui rend une courbe d'apprentissage lisible. |
| **La boucle de jeu tient en quatre appels** | à chaque pas, `main.ts` ne demande au solveur que `eject` (ou `rassemble`), `applyExitSuction` et `step`. L'environnement d'entraînement fait exactement les mêmes appels, dans le même ordre. |

À quoi s'ajoute un avantage rare : le score du jeu est déjà un nombre —
les **litres livrés au sas** — et les records humains sont enregistrés
(`src/game/records.ts`). L'agent et le joueur se comparent sur la même règle.

## 2. Ce qui est livré

```
src/rl/capteurs.ts   ce que l'agent VOIT — partagé par l'entraînement et le jeu
src/rl/reseau.ts     le réseau (MLP), sa passe arrière et Adam — sans dépendance
src/rl/ppo.ts        PPO : avantages (GAE) et pas écrêté — testables à la main
src/rl/rollout.ts    la collecte : faire jouer la politique et rapporter
src/rl/entrainePPO.ts  l'entraînement PPO en ligne de commande, parallélisé
src/rl/env.ts        l'environnement : le jeu sans écran (reset / step / observe)
src/rl/politique.ts  politique linéaire, apprentissage sans gradient (CEM), imitation
src/rl/pilotes.ts    deux pilotes ÉCRITS À LA MAIN — le plancher de comparaison
src/rl/entraine.ts   l'entraînement en ligne de commande, parallélisé
src/rl/rejoue.ts     rejouer une politique, tableau par tableau, et tracer ses gestes
src/rl/courbe.ts     la courbe de progression, dans le terminal, pendant que ça tourne
src/rl/agent.ts      l'agent qui joue DANS LE JEU (?agent=…) — voir §6
src/rl/banc.ts       le banc de vitesse : combien de jeu par seconde de machine
src/rl/*.spec.ts     les garanties : déterminisme, fins conformes, capteurs identiques
```

Les sorties d'entraînement (politiques, journaux, traces) vont dans `.rl/`,
ignoré par git.

```bash
pnpm rl:rejoue --pilote hasard --tableaux 21-01      # le plancher
pnpm rl:rejoue --pilote cap    --tableaux 21-01      # la référence à la main
pnpm rl:entraine --tableaux 21-01 --generations 30 --travailleurs 4
pnpm rl:courbe --journal .rl/politique.json        # même pendant l'entraînement
pnpm rl:rejoue --politique .rl/politique.json --tableaux tous
```

### L'environnement en trois lignes

- **Observation** (43 nombres) : position et vitesse du corps, direction et
  distance du sas, volume restant, volume déjà bu, étalement du corps, temps
  écoulé, et **seize rayons de télémétrie** qui tâtent les parois autour du
  corps (distance + matériau). Pas de pixels : le corps ne « voit » pas
  l'écran, il sent sa forme et son voisinage — ce qui suffit, et coûte mille
  fois moins cher qu'une image.
- **Actions** (19) : ne rien faire · se rassembler · **conclure** (le bouton
  CONTINUER du jeu, offert dès qu'un dixième du volume est bu) · pousser dans
  l'une des 16 directions. Une décision toutes les 0,1 s simulée (12 pas
  physiques), comme un joueur au geste tenu.
- **Récompense** : les litres livrés (le score du jeu), plus la progression
  vers le sas, moins ce qu'on abandonne en route et le temps qui passe ; prime
  à la traversée, amende à la dispersion. Le **score** rapporté, lui, reste
  celui du jeu, litre pour litre : c'est lui qu'on compare aux records.

### Les fins d'un essai, recopiées de `main.ts`

`sas` (tout est bu) · `conclu` (le joueur embarque le surplus) · `disperse`
(le corps s'est défait) · `perdu` (plus rien de vivant) · `temps` (le chrono
de l'entraînement, qui n'existe pas en jeu).

## 3. Ce que ça coûte — mesures, pas estimations

Mesuré sur ce dépôt (`pnpm rl:banc`, à refaire sur votre machine), un cœur,
tableau 21-A, moteur JavaScript puis WASM (`public/noyaux.wasm`, déjà
compilé) :

| Particules | JS | WASM | Vitesse / temps réel |
| ---: | ---: | ---: | ---: |
| 900 (le jeu) | 2,63 ms/pas | 1,83 ms/pas | ×3,2 à ×4,5 |
| 450 | 1,13 ms/pas | 0,85 ms/pas | ×7,4 à ×9,8 |
| 200 | 0,42 ms/pas | 0,41 ms/pas | ×20 |

Traduction : **un essai de 60 secondes de jeu coûte 8 à 16 secondes de
calcul** sur un cœur, à 450–900 particules. Sur une machine à 8 cœurs, une
nuit d'entraînement, c'est de l'ordre de 20 000 essais. C'est peu pour du RL
moderne — mais l'espace d'action est minuscule et l'observation est un vecteur
de 43 nombres, pas une image : c'est jouable.

Les leviers, dans l'ordre de rentabilité :

1. **Paralléliser** (déjà là) : `--travailleurs N`, un processus par cœur,
   accélération quasi linéaire.
2. **Réduire le corps** : `--particules 450`. Attention, ce n'est pas neutre —
   le seuil de dispersion est un volume absolu ; l'environnement le met donc à
   l'échelle du corps pour que l'arbitrage du jeu reste le même. Un corps plus
   petit reste plus fragile : à valider avant d'entraîner sérieusement.
3. **Les noyaux WASM** : +40 % à 900 particules, rien à 200.
4. **Raccourcir les essais** (`--duree`) : la plupart des politiques ratées se
   trahissent dans les dix premières secondes.

## 4. Les outils — trois paliers

### Palier 0 — ce qui est déjà installé (rien à acheter)

`node`, `pnpm`, `vite-node` (ajouté aux dépendances de développement) et les
fichiers ci-dessus. L'apprentissage est une **méthode d'entropie croisée**
(CEM) : on tire une population de politiques, on garde l'élite, on recentre.
Sans gradient, sans réseau, sans dépendance. Ça monte, ça se voit, et ça donne
le premier point de comparaison honnête.

Sa limite est connue : une politique **linéaire** de 836 poids ne saura jamais
enfiler un couloir en trois temps. C'est un plancher, pas un plafond.

**Deux départs possibles.** `--depart zero` cherche à partir de rien.
`--depart cap` **imite d'abord le pilote écrit à la main**, puis optimise sa
copie : c'est la recette classique (imitation puis renforcement), et elle
change tout quand la récompense de la traversée est trop rare pour être
trouvée au hasard. Copier les décisions du pilote sur ses propres
trajectoires ne suffit pas — la copie dérive au premier écart et se retrouve
dans des situations que le pilote n'a jamais traversées ; `--tours N`
applique donc le rattrapage classique (DAgger) : on rejoue les trajectoires
de la COPIE en demandant au pilote ce qu'il aurait fait. Mesuré ici sur *Le
berceau* : la copie brute vaut un retour de −2,25 (elle n'ose plus bouger),
et trois tours de rattrapage la portent à +5,76 — avant même la première
génération d'optimisation.

### Palier 1 — PPO (fait)

```bash
pnpm rl:ppo --tableaux 21-01 --iterations 300 --travailleurs 8
pnpm rl:courbe --journal .rl/ppo.json --serie litres     # pendant que ça tourne
```

Un réseau à deux couches de 64 (**8 211 poids** pour la politique, 7 041 pour
le critique) et **PPO** : politique stochastique, actions discrètes, épisodes
courts, récompense dense — c'est exactement son terrain. Écrit à la main, sans
dépendance : à cette taille, charger un moteur de tenseurs coûterait plus cher
que le calcul. La passe arrière est vérifiée par différences finies dans les
tests ; l'écrêtage et GAE sont vérifiés sur des cas calculables de tête.

Les réglages qui comptent, dans l'ordre :

| Option | Rôle | Défaut |
| --- | --- | --- |
| `--travailleurs N` | processus de collecte — **mettez le nombre de cœurs** | 4 |
| `--envs K` | tableaux menés de front par travailleur | 2 |
| `--horizon T` | décisions collectées par tableau et par itération | 256 |
| `--iterations` | nombre de pas d'apprentissage | 300 |
| `--couches 64,64` | la taille du réseau | 64,64 |
| `--particules` / `--duree` | le corps et la durée d'un essai | 450 / 45 s |
| `--lr`, `--recuit 0` | pas d'apprentissage, et son extinction linéaire | 3e-4 |

Une itération collecte `travailleurs × envs × horizon` décisions. Le journal
et la politique sont réécrits **à chaque itération** : la courbe se regarde en
direct, et la politique se pose dans `public/agents/` pour la voir jouer.

**Et le GPU ?** Il ne servira à rien, et ce n'est pas une figure de style :
99 % du temps part dans le solveur de fluide (CPU, séquentiel, un cœur par
tableau), et le réseau représente ~8 000 multiplications par décision — moins
d'un millième de la facture. Le seul levier est le **nombre de cœurs**. Sur
une machine à 8 cœurs, `--travailleurs 8`.

### Palier 1 bis — le pont vers Python, si un jour l'envie prend

Ce n'est PAS nécessaire (le PPO ci-dessus est complet), mais si vous voulez
l'écosystème de référence :

| Outil | Rôle |
| --- | --- |
| **Python 3.11+** | l'écosystème |
| **Gymnasium** | l'interface standard `reset/step` — 60 lignes d'enveloppe autour du pont |
| **Stable-Baselines3** (ou **CleanRL**) | PPO/DQN prêts à l'emploi, éprouvés |
| **PyTorch** | le réseau (CPU suffit : notre observation est un vecteur) |
| **TensorBoard** ou **Weights & Biases** | les courbes, les comparaisons de graines |
| **Optuna** | la recherche d'hyperparamètres, plus tard |

Le pont : un processus Node par environnement, qui lit une action et écrit une
observation en JSON par ligne sur stdin/stdout — exactement le protocole que
`--travailleurs` utilise déjà. `SubprocVecEnv` en lance seize, PPO les
consomme. Compter une journée de travail. (Le portage du solveur en Python est
à exclure : 3 000 lignes de physique à maintenir en double, et la moindre
divergence rend l'entraînement mensonger.)

Le gain serait dans l'outillage (TensorBoard, Optuna, les algorithmes déjà
réglés), jamais dans la vitesse : la simulation resterait dans Node, sur les
mêmes cœurs.

### Palier 2 — si l'ambition monte

- **Jouer le VRAI jeu** : glace, vapeur, dash, lasers, cibles, portes (§5) ;
- **entraînement sur tableaux générés** (`src/game/generateur.ts` en produit à
  la demande, avec graine) : c'est le vrai remède au sur-apprentissage, et le
  jeu a déjà l'outil ;
- **apprentissage par imitation** : les traversées humaines existent
  (`records.ts`) ; pré-entraîner sur des démonstrations avant le RL divise le
  coût par cinq quand la récompense est rare ;
- **agent-designer** : retourner l'outil et faire mesurer par l'agent la
  difficulté d'un tableau généré (« un agent moyen le passe-t-il ? à quel
  prix ? ») — c'est le débouché le plus utile pour le jeu lui-même.

## 5. Ce que l'agent ne joue pas encore (et pourquoi)

L'environnement est une **réduction assumée** : il ne connaît que l'eau. Ni
glace, ni vapeur, ni dash — non par difficulté technique, mais parce que ces
règles-là vivent dans `main.ts` (péage de bascule, réserve de dashs,
transformations subies) et non dans le solveur. Les lasers, cibles, rails,
zones et toute la méta (bonbonnes, instruments, boutique) sont hors champ pour
la même raison. `tableauxRL()` ne propose donc que les tableaux qui s'en
passent — dix-neuf aujourd'hui, dont 21-A.

**Le vrai travail d'ingénierie à venir n'est pas l'IA : c'est d'extraire de
`main.ts` la boucle de règles** (états, dashs, lasers, portes) dans un module
sans écran, que le jeu ET l'entraînement appelleraient tous les deux. Ce
serait un gain pour le jeu seul — cette boucle est aujourd'hui impossible à
tester autrement qu'à la main.

En attendant, un garde-fou est indispensable : **un test de parité** qui
rejoue la même suite de gestes dans le navigateur et dans l'environnement, et
compare les trajectoires. Sans lui, un réglage du banc peut faire diverger
l'entraînement du jeu réel sans que rien ne prévienne.

## 6. Comment on regarde l'agent progresser

Quatre manières, de la plus immédiate à la plus parlante :

1. **Le tableau, en direct.** Chaque génération imprime retour moyen, meilleur
   retour, litres livrés, traversées et temps écoulé. C'est le pouls.
2. **La courbe, pendant que ça tourne.** Le journal est réécrit dans le JSON
   de sortie **après chaque génération** (pas à la fin) : `pnpm rl:courbe
   --journal .rl/politique.json` la trace dans le terminal, à n'importe quel
   moment, depuis un autre onglet. Trois séries : `--serie retour` (ce que
   l'agent optimise — la moyenne de la population ET le meilleur de la
   génération), `--serie litres` (le score du jeu), `--serie traversees`.
   Lire les deux traits du retour ensemble vaut le détour : une moyenne qui
   monte sans meilleur qui monte, c'est une population qui se range derrière
   une prudence — le symptôme d'une récompense qui paie l'immobilité.
   Le même JSON s'ouvre dans n'importe quel tableur ou notebook, le champ
   `journal` est une simple liste de lignes.
3. **Le duel avec les références.** `pnpm rl:rejoue --politique …` rejoue la
   politique tableau par tableau et affiche fin, litres et chrono — à
   comparer aux deux pilotes écrits à la main et aux records humains.
4. **La regarder jouer, dans le vrai jeu.** `?agent=…` fait tenir le doigt par
   l'agent, sur n'importe quel tableau :

   ```
   /?tableau=3&agent=cap                    le pilote écrit à la main
   /?tableau=3&agent=hasard                 le plancher
   /?tableau=3&agent=./agents/berceau.json  une politique apprise
   ```

   Le tableau se choisit par `?tableau=N`, ou en direct par le saut de salle
   du banc — les capteurs de l'agent suivent la nouvelle salle. Un bandeau en
   bas à gauche dit qui joue, ce qu'il fait à l'instant, combien de gestes il
   a faits et ce que lui coûte une décision. **La touche A le débranche** : on
   reprend la main en pleine partie, et on la lui rend.

   L'agent ne triche pas : il n'écrit ni dans le solveur ni dans le monde. Il
   pose le doigt là où un joueur le poserait — `input.aimActive` et un point
   visé, rien d'autre —, et le jeu ne sait pas qui tient le doigt. Poser une
   politique apprise à l'écran, c'est copier son JSON dans `public/agents/`.

5. **Le regarder S'ENTRAÎNER, en direct.** Deux terminaux et un onglet :

   ```bash
   pnpm rl:ppo --sortie public/agents/live.json --travailleurs 8   # terminal 1
   pnpm dev                                                        # terminal 2
   ```
   ```
   http://localhost:5173/?tableau=1&agent=./agents/live.json&suivre=2
   ```

   Le jeu relit le fichier toutes les deux secondes et **remplace le cerveau
   de l'agent à chaud**, sans couper la partie : la traversée en cours
   continue avec une politique un peu meilleure. Le bandeau affiche l'état de
   l'entraînement (itération, litres moyens, traversées) à côté de ce que
   l'agent fait à l'écran.

   En suivi, c'est la politique **du moment** qui joue (`poidsCourants`), pas
   la meilleure retenue depuis le début : regarder s'entraîner, c'est voir
   aussi les mauvais moments. Trois détails rendent la chose possible :
   l'entraînement écrit son fichier **de façon atomique** (écrit à côté, puis
   renommé — sinon le jeu lirait un JSON coupé en deux) ; la requête porte un
   anti-cache ; et `vite.config.ts` exclut `public/agents/` de la surveillance
   du serveur de développement, sans quoi vite rechargerait la page à chaque
   itération. Cela demande `pnpm dev` : `pnpm preview` sert une copie figée.
Les plafonds de comparaison, dans l'ordre : le hasard (0,00 L, corps défait
en dix secondes) · le pilote « cap » écrit à la main (1,82 L sur *Le berceau*
à 900 particules, 0,72 L à 450, dispersé sur *Le sas*) · les records humains
de `records.ts`.

## 6 bis. Ce que ça coûte de la REGARDER jouer (rien)

Mesuré dans Chromium : **0,19 ms par décision** pour une politique apprise
(capteurs compris — les seize rayons sont l'essentiel de la facture), 0,01 à
0,06 ms pour le pilote écrit à la main, qui ne lit que le centre de gravité.
À dix décisions par seconde simulée, l'agent ajoute **~2 ms par seconde de
jeu** — face aux ~310 ms que coûtent les 120 pas de fluide de cette même
seconde. Moins de 1 % : regarder l'agent jouer coûte ce que coûte jouer.

Tout se passe **sur la machine du joueur, dans l'onglet** : aucun serveur,
aucun appel réseau (le JSON de la politique fait 6 ko), rien à installer. Le
coût de calcul du projet est ailleurs — il est dans l'ENTRAÎNEMENT (§3), qui
se fait hors ligne, sur des cœurs de CPU, et dont le prix unitaire est le pas
de fluide.

## 7. Les pièges connus

- **La récompense est un contrat, pas un vœu.** C'est arrivé au premier
  entraînement de ce dépôt : avec une amende de dispersion à 10 et un coût du
  temps à 0,02, rester immobile coûtait 1,2 et tenter la traversée en coûtait
  10. En cinq générations l'agent avait appris la seule leçon que le contrat
  récompensait — **ne rien faire**. Les poids ont été rééquilibrés (l'immobilité
  doit coûter plus cher qu'un échec courageux) ; la trace de l'incident est
  dans `POIDS_DEFAUT`. Toute modification des poids demande un coup d'œil à ce
  que l'agent FAIT, pas seulement à ce qu'il marque.
- **Il trouvera les failles de la physique** avant de trouver le beau jeu.
  C'est une bonne nouvelle : un agent qui exploite un bug est un détecteur de
  bugs qui ne se fatigue jamais.
- **Le sur-apprentissage par tableau** : une politique qui « connaît » 21-01
  par cœur ne transfère pas. D'où l'entraînement multi-tableaux
  (`--tableaux 21-01,21-A,21-C`) et, ensuite, les tableaux générés.
- **La dérive de fidélité** entre l'environnement et le jeu : voir le test de
  parité, §5.

## 8. Où en est l'apprentissage, honnêtement

Deux entraînements de trente générations sur *Le berceau* (450 particules,
essais de 45 s, quatre cœurs, ~20 minutes chacun) :

| Départ | Retour, gén. 1 → 30 | Litres livrés |
| --- | --- | --- |
| à froid (`--depart zero`) | −6,6 → −1,0 | 0,00 |
| imitation + rattrapage (`--depart cap --tours 3`) | +6,7 → +6,4 (pic 8,8) | 0,00 |

La progression est réelle et lisible — à froid, l'agent apprend en trente
générations à ne plus se disperser ; en partant de l'imitation, il navigue
d'emblée bien mieux. **Mais aucune des deux ne livre une goutte au sas**,
là où le pilote écrit à la main livre 0,72 L.

Le diagnostic est net, et c'est celui qu'on attendait : une politique
**linéaire** n'a pas les moyens de la décision qui fait la traversée
(« pousser SI la vitesse vers le sas est sous le seuil, sinon se rassembler »
— une condition, pas une pondération). L'imitation le montre chiffre en main :
elle recopie 80 à 94 % des décisions du pilote et rate exactement celles qui
comptent. Ce n'est pas un problème d'exploration, c'est un plafond de
représentation.

## 9. Si je devais faire la suite, dans cet ordre

1. **PPO avec un petit réseau** (deux couches de 64 : quelques milliers de
   poids au lieu de 836, et surtout des non-linéarités) — chemin A, en
   TypeScript, face aux mêmes pilotes de référence. C'est LE pas suivant :
   tout le reste est déjà en place.
2. Un **test de parité** navigateur ↔ environnement, pour que les capteurs
   partagés le restent quoi qu'il arrive au banc.
3. L'**extraction de la boucle de règles** hors de `main.ts` — glace, vapeur,
   dash — qui ouvre les tableaux restants (le gros morceau, utile au jeu
   lui-même).
4. L'entraînement sur **tableaux générés**, puis l'agent au service du level
   design.
