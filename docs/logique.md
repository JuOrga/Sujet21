# Les fonctions logiques — récepteurs, règles, portes

*Livraison du 25/10/2026. Le concepteur était « bloqué à cause des portes
qui ne peuvent pas avoir un état différent (ouvert ou fermé) de base », et
voulait des cibles qui fassent « vraiment des fonctions logiques pour des
énigmes ».*

## 1. Ce qui manquait

L'algèbre du cabinet logique (`src/game/circuits.ts`) tenait avec trois
pièces : la pastille TOR (une mémoire qu'on ne peut pas effacer), le canal
partagé (un OU), la règle « et » (un ET), plus la pastille NOR comme NON.
Mais ce NON grille à la première coupure, il ne sert qu'une fois. Et une
porte était toujours **fermée au départ**. On ne pouvait donc écrire ni une
entrée qui suit son opérande, ni un interrupteur, ni une porte qui se ferme
quand on l'alimente.

## 2. Les quatre récepteurs

| Mode | Il est actif… | Ce qu'il est |
| --- | --- | --- |
| **TOR** (défaut) | dès le premier passage, pour de bon | une mémoire qu'on ne peut pas effacer |
| **NOR** | tant que le faisceau tient, et grille à la première coupure | un maintien qui ne sert qu'une fois |
| **MAINTIEN** *(nouveau)* | tant que le faisceau tient, éteint sinon, jamais grillé | le bouton-poussoir : l'entrée qui suit son opérande |
| **BASCULE** *(nouveau)* | selon le nombre de passages : chaque nouveau passage inverse son état | l'interrupteur : une mémoire qu'on peut effacer |

- Une micro-coupure de moins de 0,12 s (`CIBLE_PERSISTANCE`) ne compte pas.
  Elle n'éteint pas un maintien et ne fait pas rebasculer une bascule ;
  sans cette marge, un faisceau qui scintille ferait battre l'interrupteur.
- Une bascule est **éteinte au départ**. Un faisceau qui tient ne compte
  qu'une fois : pour la faire basculer de nouveau, il faut couper le
  faisceau puis le rendre.

## 3. Les règles du canal

Plusieurs sources (pastilles et coupelles) peuvent porter le même numéro.
La porte, ou la chasse, choisit comment les combiner :

| Règle | La porte est alimentée quand… |
| --- | --- |
| **OU** (défaut) | au moins une source est active |
| **ET** | toutes les sources sont actives |
| **OUEX** *(nouveau)* | **une seule** source est active, pas plus (le OU exclusif) |

## 4. L'état de repos de la porte *(nouveau)*

- **Fermée au repos** (le défaut, comme avant) : elle s'ouvre quand son
  canal l'alimente.
- **Ouverte au repos** : elle **se ferme** quand son canal l'alimente.
  C'est le NON.

Une porte ouverte au repos l'est dès la première image : elle ne joue pas
d'animation d'ouverture au chargement. Une brèche (séquence) ouvre une
porte quel que soit son repos. Une porte scénarisée (canal négatif)
ouverte au repos ne servirait à rien, et l'éditeur le signale.

## 5. Toutes les portes logiques

Deux entrées A et B, deux pastilles du même canal (en MAINTIEN pour
qu'elles suivent le faisceau) :

| Porte logique | Règle | Repos | 00 | 10 | 01 | 11 |
| --- | --- | --- | --- | --- | --- | --- |
| OU | OU | fermée | fermée | ouverte | ouverte | ouverte |
| ET | ET | fermée | fermée | fermée | fermée | ouverte |
| OU exclusif | OUEX | fermée | fermée | ouverte | ouverte | fermée |
| NON-OU | OU | ouverte | ouverte | fermée | fermée | fermée |
| NON-ET | ET | ouverte | ouverte | ouverte | ouverte | fermée |
| équivalence | OUEX | ouverte | ouverte | fermée | fermée | ouverte |
| NON (une entrée) | OU | ouverte | — | — | — | — |

Ces tables sont vérifiées dans `src/game/logique.spec.ts`.

Avec la BASCULE, on obtient des énigmes à états : un interrupteur qu'il
faut actionner un nombre impair de fois, deux bascules en OUEX qu'il faut
mettre dans des états opposés, une porte ouverte au repos qu'une bascule
referme puis rouvre.

## 6. Dans l'éditeur

- **Cible**, panneau de droite → *Récepteur* : TOR, NOR, MAINTIEN ou
  BASCULE. Le maintien porte un anneau pointillé bleu, la bascule deux
  demi-anneaux violets, en jeu comme dans l'éditeur.
- **Porte**, panneau de droite → *Règle* (OU, ET, OUEX) et *État de repos*
  (fermée, ouverte). Une porte ouverte au repos est dessinée en cadre
  pointillé, et son étiquette le dit (`OUVERTE AU REPOS`). L'aperçu du
  faisceau se trace au repos : il passe à travers une porte ouverte au
  repos.
- **Chasse** → *Règle* : OU, ET ou OUEX, comme une porte.

## 7. Où vit le code

| Quoi | Où |
| --- | --- |
| les types (`CibleMode`, `RegleCanal`, `PorteDef.repos`) | `src/game/level.ts` |
| les récepteurs, les canaux, `etatPorte` | `src/game/laser.ts` |
| l'état des portes en jeu, le dessin des récepteurs | `src/main.ts` |
| lecture, écriture, vérification | `src/game/levelIO.ts` |
| l'éditeur | `src/editor/editor.ts`, `src/editor/fiches.ts` |
| les tests | `src/game/logique.spec.ts`, `src/game/levelIO.spec.ts` |
