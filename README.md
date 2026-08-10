# Tension de surface

Roguelike ambiant et inertiel : vous êtes un volume d'eau qui s'échappe d'un
laboratoire orbital. En gravité nulle, la seule façon d'avancer est d'éjecter
une partie de soi-même — **se déplacer, c'est rétrécir**.

- [`docs/doc-fonctionnel.md`](docs/doc-fonctionnel.md) — le document de référence.
- [`docs/scenario.md`](docs/scenario.md) — la bible narrative (journal du Dr Véga).
- [`docs/assets-ia.md`](docs/assets-ia.md) — la production des textures.

## État : l'expédition tient debout

Prototype jouable dans le navigateur, du premier tableau au dernier. Le corps,
le geste, les trois états, la chaleur, la boucle roguelike et la narration sont
en place ; un éditeur permet de créer des tableaux sans toucher au code.

## Lancer

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

## Commandes

| Entrée | Effet |
|---|---|
| **Pointeur maintenu** | éjecte vers ce point ; le corps part à l'opposé |
| **F** | glace : le corps se fige, garde son élan ; re-presser dégèle |
| **G** | vapeur : détente explosive ; re-presser condense |
| **`,` / `.`** | time warp par crans (×0,25 à ×4) — le pas physique ne change jamais |
| **Espace** | pause · **R** recommencer · **Échap** retour à la fiche d'essai |
| **L** | légende des surfaces · **E** panneau des états |
| **Molette** | zoom · **clic droit maintenu** déplacer la vue · **clic droit bref** vortex de regroupement |
| **Bouton ⌖** | recadrer sur le corps (zoom et caméra automatiques) |

**Au doigt** : un doigt éjecte, deux doigts pincent pour zoomer et glissent pour
déplacer la vue. La barre tactile couvre pause, time warp, états, vortex et
recommencer — aucun clavier n'est nécessaire.

## Ce qui est en place

**Le corps et le geste (§3)**
Solveur **PBF 2D** (Macklin & Müller) en typed arrays, grille spatiale, pas de
temps fixe. La cohésion vient d'une contrainte de densité **en égalité** : en
apesanteur, le déficit de densité en surface attire les particules vers
l'intérieur — la tension de surface n'est pas une règle, c'est un comportement
du modèle. La correction tensile (`sCorr`) est le curseur de la décision
ouverte n°1. Propulsion par éjection à **quantité de mouvement exactement
conservée**, fusion automatique, identification du corps par amas connexe.

**Les trois états (§4)**
*Liquide* : souple, vulnérable, pilotage fin. *Glace* : on ne pilote plus, on
glisse et on rebondit — l'impulsion s'applique au **point de contact** avec le
moment d'inertie du bloc, donc un choc excentré fait tourner le palet et le
dévie. *Vapeur* : poussée violente, traverse les grilles, mais s'évapore en
continu — être vapeur coûte, même immobile. Changer d'état ne disperse jamais.

**La chaleur (§5)**
Chaque surface porte une **aura** de portée visible : le radiateur vaporise,
dégèle et évapore ce qui s'attarde ; la plaque froide gèle. Le vaisseau
**refroidit au fil de l'expédition** — les radiateurs faiblissent, les auras
froides s'étendent, la vapeur devient rare. Pas de compte à rebours à l'écran :
c'est le monde qui devient moins jouable.

**Les matériaux (§6)**
Parois neutres, **hydrophiles** (on y adhère, décoller se paie), **hydrophobes**
(répulsion et rebond), **éponge** (traînée, absorption après contact continu,
saturation cellule par cellule — une cellule gorgée devient solide et la brèche
payée en volume est permanente), **grille** (arrête liquide et glace, laisse
passer la vapeur), radiateur, plaque froide.

**La boucle (§7)**
Pas d'eau à ramasser : la pente est descendante. Le surplus à la sortie est
compressé en **bonbonne**, et l'on repart au tableau suivant à capacité de base.
Entrer dans le sas **en glace** rapporte une prime de collecte de 25 %. La
**recondensation** (§7.3) fournit la soupape : la vapeur perdue perle sur les
parois froides et se récupère avec perte — d'autant mieux que le vaisseau est
glacial.

**Fin de course, plutôt que mort**
Aucun minimum de volume à ramener. Sous le seuil, le HUD annonce que la
dernière impulsion approche ; une fois donnée, le corps se fige en gardant son
élan, ralentit, et l'essai se conclut là où il s'arrête. Seule la perte totale
de cohésion reste une **dispersion**.

**Lisibilité**
Chaque surface a une identité visuelle univoque et son nom peint dans le décor,
une aura tracée à sa portée exacte, et une légende (`L`) qui donne son effet
état par état. Les zones d'état imposé sont peintes au sol, avec liseré, marge
hachurée et étiquette ; le HUD affiche « VAPEUR — IMPOSÉE » et grise le
sélecteur. Le corps change de couleur avec sa température.

**Présentation**
Rendu **métaballes WebGL2** en deux passes (champ gaussien basse résolution,
puis seuillage plein écran), décor texturé avec parallaxe, machinerie et
veilleuses. **Son entièrement procédural** (Web Audio, aucun fichier) : boucles
d'éjection, de vapeur et de sas, one-shots de gel, dégel, impacts et
avalement, bourdon de station. Budget CPU des pas physiques avec palier de
rendu de secours pour tenir le fps. HUD adapté au mobile.

**Narration**
Tutoriel diégétique — le protocole du Dr Véga guide la première plongée. Le
twist est en jeu sans être dit : le sas n'est pas une sortie, c'est le
collecteur ; le compteur « BONBONNES » est la moisson du laboratoire.

**Registres (§10)**
Chaque essai est consigné. Par tableau, le record est le plus grand volume mis
en bonbonne, départagé par le temps de collecte. Persistance locale, plus un
**tableau d'honneur partagé** (`/api/records`) — silencieux hors ligne.

## L'expédition

Sept tableaux, dans cet ordre :

| | Code | Tableau |
|---|---|---|
| 1 | 21-A | Le sas |
| 2 | 21-B | La chambre froide |
| 3 | 21-C | Le conduit |
| 4 | 21-E | La serre |
| 5 | 21-F | Le dépôt de givre |
| 6 | 21-D | La cuve thermique |
| 7 | 21-G | La dérive |

Plus **21-A bis — La galerie noyée**, prototype accessible depuis la fiche
d'essai, candidat au remplacement de 21-A.

## L'éditeur de tableaux

Depuis la fiche d'essai, ou par l'adresse `?editeur`.

On trace les surfaces au glisser (paroi, hydrophile, hydrophobe, plaque froide,
radiateur, grille, éponge), on place le départ, le sas et les étiquettes, on
déplace et redimensionne à la poignée, avec grille aimantée réglable.
`Suppr` efface, `D` duplique, `Échap` désélectionne, clic droit déplace la vue,
molette zoome. On délimite des **zones d'état** qui imposent eau, glace ou
vapeur et verrouillent le sélecteur tant qu'on y est.

Un **contrôle automatique** applique aux tableaux édités les garde-fous des
niveaux livrés : départ hors cuve ou né dans une surface, sas trop petit ou
débordant, traversée trop courte, grille sans moyen de la franchir, zone vapeur
sans radiateur. Les erreurs bloquent l'essai, les avertissements passent.

**ESSAYER** joue le tableau immédiatement avec toutes les mécaniques, et un
bouton **↩ ÉDITEUR** ramène corriger à tout moment, le document intact.

**Bibliothèque partagée** : les tableaux s'enregistrent sur le serveur
(`/api/levels`) et la liste s'ouvre d'un clic. **L'ordre de la liste est la
séquence de l'expédition** (flèches ↑ ↓). Dès qu'un tableau y est enregistré,
la bibliothèque remplace l'expédition livrée ; vide ou hors ligne, on retombe
sur les sept tableaux d'origine. L'export en fichier JSON et le collage restent
disponibles en secours.

## Le banc de réglage (§13)

Bouton **BANC** : tous les paramètres de ressenti en sliders modifiables en
direct, chacun accompagné de son explication, avec export/import JSON et
présets partagés (`/api/presets`). Le dossier **Livraisons** affiche le journal
des changements — les testeurs voient ce qui a bougé sans quitter le jeu.

## Qualité

```bash
pnpm test         # 103 tests (Vitest)
pnpm type-check
pnpm build
```

Les tests portent sur les invariants, pas sur le décor : conservation de la
quantité de mouvement (au repos et pendant l'éjection), cohésion en apesanteur,
fusion par contact, dispersion sous volume critique, exactitude de la grille
spatiale et de l'étiquetage d'amas, coût d'état de la vapeur, action du
radiateur et de la plaque froide, refroidissement du vaisseau, recondensation,
transformations d'état sans dispersion, sérialisation des tableaux et validité
de l'expédition livrée.

## Architecture

```
src/sim/       solveur pur — aucune notion de jeu
src/game/      règles, tableaux, entrées, son, registres
src/render/    métaballes WebGL2, caméra
src/editor/    éditeur de tableaux
src/bench/     banc de réglage, présets, journal des livraisons
api/           bibliothèque, présets et records partagés (Vercel Blob)
```

La frontière solveur/jeu est stricte : tout ce qui est « règle » doit pouvoir
se dire en une phrase de physique (pilier 3).

## Paramètres d'adresse

| | |
|---|---|
| `?editeur` | ouvre l'éditeur |
| `?tableau=N` | démarre au N-ième tableau de l'expédition |
| `?spawn=x,y` | place le corps où l'on veut — itérer sur le level design |

## Prochains jalons

- **Contenu des bonbonnes (§8)** : distillée, surchauffée, glycolée, salée,
  contaminée — chaque eau est une eau différente, pas un chiffre différent.
- **Routes ramifiées (§9)** : plusieurs sorties par tableau, les états comme
  clés rétroactives sur des modules déjà connus.
- **Débloquer sa propre origine (§9.3)** : le flacon, et le contrat « hors
  protocole = déplacé, pas raccourci ».
