# Projet 21 — bible narrative (v2)

> v2 — 17/08/2026 : intégration de la ligne de conduite du concepteur
> (origine accidentelle, ouverture jouable, semblables, révélation « miroir
> spatial », douche des mutations, carte ISS, hub compact à pictogrammes) et
> de la STRATÉGIE : une démo jouable pour un Steam fest. La voix, le twist
> du collecteur et la structure en actes de la v1 restent le socle.

## Le pitch

À bord du **module Méduse**, accroché à une station spatiale laboratoire,
un chercheur en quête de grandes découvertes **crée la vie par accident**.
Une petite substance, confinée, étudiée. Cette substance, c'est le joueur :
**Sujet 21**.

Ses premières pensées sont les nôtres : *qui êtes-vous ? où êtes-vous ?*
Pas le temps de philosopher — lumières rouges, alertes, le module se vide
des êtres qui semblaient l'observer.

## La fonction vraie (révélation d'acte II)

Sujet 21 n'a pas été créé pour être étudié. Il a été créé pour **servir de
miroir spatial** : c'est sa vraie fonction, industrielle, banale. Sa
conscience n'est qu'un **accident** — et en début de jeu, il n'est
officiellement qu'une **expérience ratée**. Le protocole « Tension de
surface » de Véga n'est pas de la recherche fondamentale : c'est du
**contrôle qualité** qui a dérapé en fascination.

Cette révélation éclate **après plusieurs runs** (un plot d'inter-run au
hub), jamais dans l'ouverture.

## L'ouverture jouable (le premier quart d'heure — cœur de la démo)

1. **La cuve.** Le joueur naît dans la cuve d'entraînement du module
   Méduse. Cartes de l'éveil : « Qui êtes-vous ? Où êtes-vous ? »
2. **L'alerte.** Lumières rouges, sirènes, le module se vide (les
   silhouettes des Créateurs disparaissent des hublots d'observation).
3. **La brèche** — *premier instant de gameplay* : le confinement cède,
   on sort de la cuve. Les commandes s'apprennent ici (l'éveil actuel se
   greffe sur cette scène).
4. **L'exploration du module.** On traverse le hub en alerte. On y trouve
   la confirmation : ces êtres sont nos **Créateurs** — et d'autres
   **semblables** à nous sont enfermés dans des **fioles** étranges
   (assets sans interaction pour l'instant, directement dans la salle
   du hub).
5. **La seule sortie : commencer le jeu.** Le sas de lancement est
   l'unique issue — le premier run démarre.

## Les semblables et la douche (méta-progression, post-démo)

- Les **fioles** du hub contiennent des semblables — même substance,
  **dépourvus de conscience**. Assets d'abord, mécanique ensuite.
- Une fois le pouvoir de **glace** acquis (prise de conscience scénarisée),
  le joueur peut **libérer ses semblables**. Ils ne le suivent pas : ils
  servent à **muter**.
- Après plusieurs runs et des **prises de conscience successives** (chacune
  débloque du gameplay — c'est la narration des déblocages : le fluide
  « comprend »), la **douche** s'ouvre : avec des semblables libérés, le
  joueur y **ajoute des substances à son essence** et obtient des pouvoirs
  par **mutation**. (La douche : clin d'œil à l'hygiène en apesanteur —
  cabine fermée, gouttelettes captives — cf. référence ISS.)

## La carte : une station, pas des niveaux

La carte globale s'inspire de la **structure de l'ISS** : une épine dorsale
et des **modules** accrochés, chaque module **parcellisé** — un grand
espace fragmenté en petits espaces de travail. Règles :

- chaque tableau EST un module ou une parcelle de module (pas une « map ») ;
- les modules s'enchaînent par des **nœuds/jonctions** (les conduits actuels) ;
- l'architecture se lit au plan large : on doit reconnaître « la station »
  comme on reconnaît l'ISS sur une infographie ;
- la parcellisation donne le rythme roguelike : petites chambres de travail,
  portes, alternance serré/ouvert.

## Le hub, refondu : petit, dense, énigmatique

Le hub actuel (8000×3600, cinq salles) est **trop grand**. Cible : un
module **compact**, dans lequel tout se lit vite, avec des
**assets/informations purement graphiques** — aucune influence sur le
joueur. Ce sont des **indications pour les humains** : comment EUX gèrent
les trois états de la substance.

### Les pictogrammes d'état (spécification)

Panneau type : un **rectangle de la couleur du matériau** (le code couleur
du jeu, celui de la légende), et dessous **trois rangées de points** — une
par état (EAU, GLACE, VAPEUR), notées de 0 à 3 :

| points | lecture GESTIONNAIRE (humains) | lecture SUBSTANCE (joueur) |
|---|---|---|
| 0 | totalement inefficace | traverse / ignore |
| 1 | ça confine | une paroi |
| 2 | c'est efficace | dangereux |
| 3 | l'outil idéal pour gérer l'état | peut être mortel |

Exemple — l'**éponge** (rectangle ambre) : EAU ●●●, GLACE ●, VAPEUR ●.
(Elle boit l'eau — l'outil idéal ; pour la glace et la vapeur, une simple
paroi.)

Règles :
- n'y figurent QUE les moyens que les humains utilisent pour **gérer les
  états** (éponge, plaques froides, chaudière, grilles, membrane, rideau,
  surchauffeur…) — pas les hublots ni le décor ;
- même code couleur que la légende du jeu, aucun texte explicatif ;
- **volontairement énigmatique** : le joueur ne comprend pas forcément au
  premier passage — c'est une grille de lecture qui se gagne.

## Le twist central (inchangé, jamais dit frontalement)

Le sas vers lequel on nage n'est pas une sortie : c'est **le collecteur**.
Chaque « réussite » est une **collecte** pour le laboratoire. Le compteur
« BONBONNES » est la moisson du labo, pas le score du joueur. La vraie
victoire — s'échapper de la station — reste l'horizon de l'acte III.

## La voix (inchangée)

Toute la narration passe par **le journal de bord du Dr N. Véga**. On ne
lit jamais le point de vue de l'eau ; on lit un scientifique qui consigne
des choses qu'il ne devrait pas avoir à écrire.

Règles d'écriture :
- Ton clinique, phrases courtes, vocabulaire de protocole. Jamais d'exclamation.
- La peur monte par **les moyens engagés**, pas par les mots.
- Les guillemets sont l'aveu : « choisit », « insiste », « attend ».
- Une entrée par tableau, une à deux phrases, signée.
- Après la révélation : les entrées côté DIRECTION parlent du « produit »
  et du « miroir » ; celles de Véga, du « sujet ». Le conflit des mots EST
  le conflit du récit.

## Structure : trois actes (v2)

**Acte 0 — L'ouverture jouable** (voir plus haut). Cuve → alerte → brèche →
exploration → sas. C'est le tutoriel diégétique et le hameçon de la démo.

**Acte I — La routine.** Le labo teste, l'échantillon « réussit » les
parcours. Contre-mesures d'un essai à l'autre : froid, grilles… Après
plusieurs runs : **révélation du miroir spatial** (plot d'inter-run).

**Acte II — Le confinement.** La sécurité prend le protocole. Les entrées
changent de mains, Véga disparaît des signatures. Les cuves deviennent des
pièges. En parallèle, côté hub : glace → **libération des semblables** →
**douche des mutations** — le sujet raté devient quelque chose que
personne n'a conçu.

**Acte III — L'évasion.** La salle des bonbonnes, la masse reprise, la
coque, le vide. Le bloc de glace qui dérive vers la Terre. « Perte de
confinement. Volume non récupéré : 4,5 L. » (Faux — ils n'ont jamais su
combien il en est sorti.)

## Stratégie : la démo Steam fest

Tout ce qui précède se hiérarchise par UN critère : **qu'est-ce qui rend la
démo inoubliable en 20 minutes ?**

Dans la démo (par ordre de chantier) :
1. **L'ouverture jouable** (acte 0 complet — le hameçon) ;
2. **Le hub compact** avec fioles (assets) et pictogrammes d'état ;
3. **La carte ISS** : re-parcellisation des tableaux existants en modules
   reliés, lisible au plan large ;
4. **Un run court et dense** (3-5 modules) + la première graine du doute
   (une entrée de Véga qui dérape).

Hors démo (mais fondations posées) : révélation complète, libération des
semblables, douche/mutations, actes II-III.

## Les entrées du journal (en jeu, cartons d'ouverture de tableau)

| Code | Tableau | Entrée |
|---|---|---|
| 21-A | Le sas | « Cohésion nominale. L'échantillon dérive vers le collecteur avec une constance… inhabituelle. Sept essais, sept trajectoires identiques. — Dr N. Véga » |
| 21-B | La chambre froide | « Installation de plaques cryogéniques sur demande. Si l'échantillon "choisit" ses trajectoires, le froid les lui fera payer. Note : il a appris à s'en servir. — Dr N. Véga » |
| 21-C | Le conduit | « Les grilles retiennent l'eau et la glace. Ce matin, l'échantillon a traversé la première à l'état de vapeur. Je demande le passage en confinement de niveau 3. — Dr N. Véga » |

## Textes système (la même fiction partout)

- Fin de tableau : **ÉCHANTILLON COLLECTÉ** — « X L transférés en bonbonne —
  réserve du laboratoire : Y L · l'essai continue… »
- Défaite : **DISPERSION** — « La cohésion ne tient plus. Le laboratoire
  consigne : perte de l'échantillon. »
- Lieu : **module Méduse, station laboratoire** (bandeau de la fiche d'essai).

## Idées en réserve (non implémentées)

- Les entrées de journal consultables dans le banc, archivées au fil des
  déblocages.
- Des annotations griffonnées de Véga qui contredisent les entrées officielles.
- Un 22e essai mentionné une seule fois, jamais expliqué.
- Le badge de mission daté d'avant l'anomalie.
- L'infographie ISS de référence : l'hygiène (la douche !), le sommeil
  sanglé, l'impesanteur — un gisement de modules et de pictogrammes.
