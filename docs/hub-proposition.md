# Le hub — proposition de structure (v1, 15/09/2026)

> Écrite d'abord comme une proposition, puis **bâtie le même jour** dans
> `src/game/hub.ts` (module v9, code `HUB`). La section « Ce qui est bâti »
> en fin de document dit ce qui a été construit et mesuré ; le reste est
> la proposition telle qu'elle a été soumise. Elle repart de ce que le hub
> DOIT faire (la bible, les zones méta, les pupitres, les avaries) et non
> de son plan précédent.

## Ce que le hub doit tenir (le cahier des charges, tel qu'il existe)

Le canon (`scenario.md`) : **petit, dense, énigmatique**. Le module d'un
laboratoire d'humains, parcellisé comme l'ISS, où le sujet est observé.
Les fioles des semblables se découvrent en l'explorant ; les pictogrammes
d'état disent comment les humains gèrent la substance ; la seule issue est
le sas de lancement.

Ce que le code exige (`ZonesHub`, `pupitres.ts`, `reparations.ts`) :

| Fonction | Ce que c'est | Obligatoire à chaque run ? |
| --- | --- | --- |
| la cuve | la naissance, la porte close jusqu'à l'éveil | oui — on y naît |
| le sas de lancement | la sortie EAU, la carte s'ouvre dans la cérémonie | oui — on en part |
| les sorties GIVRE et VAPEUR | un rideau, une grille : des routes alternatives | non |
| le banc des mémoires | l'écran du cycle, tisser un lien avec son orbe | souvent, jamais forcé |
| le comptoir du Semblable | orbes, améliorations durables, provisions | souvent, jamais forcé |
| la table de départ | le récapitulatif de ce qu'on emporte (un toast) | non |
| le mur des records, le codex, la carte, les fioles | des pupitres : un contact, un écran | non |
| sept stations à réparer | éclairage, table, records, bac, distillateur, endormis, passerelle 4 | non — la progression |
| l'aile des endormis, le bac d'essai, le secteur 4 | des ailes condamnées, trois portes de dégât, un sceau | non |

Une seule chose est obligatoire : **aller de la cuve au sas**. Tout le reste
est un détour choisi. C'est le fait qui commande la structure.

## Aujourd'hui, en une ligne

Le module Méduse v8 est **une file** : CUVE — ENDORMIS — BAC — CENTRE —
CARREFOUR — SAS, six chambres et cinq couloirs alignés sur 9 000 unités ;
de la naissance (x = −4 100) à la sortie (x ≈ 4 230), le trajet obligé
fait **~8 300 unités** et passe au travers de deux ailes condamnées (la
porte de dégât en garde les deux moitiés, de part et d'autre du passage). Le hub compact v4 est une file aussi, plus courte (cuve |
poste | aile est). Dans les deux cas, ce qu'on ne veut pas faire est SUR
le chemin, et ce qu'on veut faire demande de se souvenir où c'est.

## La proposition : une rotonde, pas une file

Le hub tient sur **une ligne de vol droite et courte** (cuve → rotonde →
sas) et **des alcôves qui s'ouvrent dessus**. Ce qu'on fait avant de partir
se voit depuis le centre ; ce qui raconte est derrière une porte.

```
                        ⬡ AILE DES ENDORMIS                    ⬡ SECTEUR 4
                          (porte de dégât)                        (scellé)
                                 ║                                   ║
   ⬡ LA CUVE ═════ ⬡ LA ROTONDE ═════════ ⬡ LE SAS À TROIS BOUCHES ──▶ EAU
   (la naissance)    (le poste de gestion)    ╲ rideau : GIVRE
                                 ║              ╲ grille : VAPEUR
                          ⬡ LE BAC D'ESSAI
                          (porte de dégât)

   ═══ la ligne de vol (obligatoire, droite, portes centrées sur y = 0)
   ║   un détour (perpendiculaire, une alcôve, on revient par où on est entré)
```

Six lieux, cinq couloirs au gabarit du kit (420 de long, passage de 300).
Cible : un module d'environ **4 400 × 3 600**, un trajet obligé d'environ
**3 800 unités** en trois chambres au lieu de six.

### 1. La cuve (ouest) — la naissance, et les vingt d'avant

Une petite chambre, froide (la lampe bleue actuelle), la porte close
jusqu'à l'éveil. Sur ses parois, **vingt et une alvéoles numérotées** : les
vingt premières vides, la vingt-et-unième est celle où l'on naît
(`sujet-vivant.md` IV1 : « je suis le suivant », zéro mécanique). Le
**distillateur de primes** est ici, pas au centre : c'est la cuve qui
distille ce que le précédent a rapporté — la prime du retour tombe là où
l'on renaît, et la réparation se lit au premier regard de chaque run.

### 2. La rotonde (centre) — le poste de gestion des humains

Une chambre octogonale, la plus grande du module, neutre et large. Huit
faces, quatre portes (ouest la cuve, est le sas, nord les endormis, sud le
bac) et **quatre stations sur les quatre pans obliques** :

| Pan | Station | Ce qu'elle ouvre |
| --- | --- | --- |
| nord-ouest | le banc des mémoires | l'écran du cycle |
| sud-ouest | le comptoir du Semblable | le marchand |
| nord-est | le mur des records | records, et à côté le pupitre de la carte |
| sud-est | la vitrine des fioles | le pupitre des fioles — et **trois fioles de semblables** visibles |

Au centre, **l'armoire d'éclairage** : la première réparation, la moins
chère, au milieu de tout — le module se rallume autour de soi. Le long des
faces, entre les stations, **les pictogrammes d'état** (le rectangle de la
couleur du matériau, trois rangées de points) : la procédure des humains,
visible à chaque passage, jamais expliquée.

Pourquoi la vitrine : la bible veut que l'exploration du module révèle les
semblables dans le premier quart d'heure, et l'aile des endormis coûte
50 mémoire. Trois fioles sous verre dans la rotonde tiennent la promesse
de l'ouverture ; l'aile, derrière sa porte, tient celle de la suite (C3 :
il s'arrête, tapote la vitre, rien ne répond).

### 3. Le sas à trois bouches (est) — le seuil

Une chambre en longueur, verte. On y longe **la table de départ** (le
récapitulatif, un toast) et l'on choisit sa sortie **au seuil, par son
état** : au fond, la bouche d'EAU (le sas de lancement, la carte s'ouvre) ;
au nord-est, le **rideau** que seule la glace écarte ; au sud-est, la
**grille** que seul le souffle passe. Les trois routes se lisent d'un
regard, côte à côte — la règle « les états comme clés » (`doc-fonctionnel`
§9.2) devient un lieu. Derrière le rideau, la passerelle du secteur 4 :
condamnée (porte de dégât), puis scellée (le sceau) tant que l'arc du
récit n'est pas bouclé.

### 4. Les deux ailes (nord et sud) — ce qui se gagne

Deux pods au bout d'un couloir perpendiculaire, chacun derrière sa porte
de dégât :

- **L'aile des endormis** (nord) : les capsules des semblables, les fioles
  en nombre, la scène de solitude. Plus tard (post-démo) la libération et
  la douche y auront leur place sans rien déplacer.
- **Le bac d'essai** (sud) : toutes les surfaces, sans enjeu, dans
  l'ordre des pictogrammes de la rotonde — l'énigme du poste se vérifie
  ici, à qui veut.

Un détour est un aller-retour : on entre, on fait, on ressort par la même
porte sur la ligne de vol. On ne « traverse » jamais une aile.

## Les six règles qui rendent le parcours agréable

1. **La ligne de vol est droite.** Toutes les portes du trajet obligé sont
   centrées sur y = 0 : une seule éjection bien visée porte de la cuve au
   sas. Se déplacer, c'est rétrécir — le trajet obligé doit coûter le moins
   de gestes possible, chaque run.
2. **Un détour est perpendiculaire et court.** Une alcôve s'ouvre sur la
   ligne, jamais au bout d'une autre alcôve. Profondeur maximale : un
   couloir du kit.
3. **Tout ce qu'on fait avant de partir se voit du centre.** Banc,
   comptoir, records, fioles : quatre pans de la rotonde, aucun plan à
   retenir. La caméra à zoom automatique cadre la rotonde entière avec le
   corps dedans.
4. **Une salle, une fonction, une couleur.** La lampe dit le lieu avant la
   pancarte : cuve froide, rotonde neutre, sas vert, comptoir chaud — les
   quatre teintes existent déjà ; les ailes prennent la leur.
5. **Rien d'obligatoire derrière une porte d'état.** Le rideau et la
   grille ne gardent que des routes alternatives. La bouche d'eau est
   toujours ouverte.
6. **Le hub grandit avec les réparations.** Au premier quart d'heure, la
   rotonde est sombre, deux portes seulement s'ouvrent (la cuve derrière
   soi, le sas devant), les autres sont des barrières muettes et les
   stations des machines éteintes. Chaque réparation ajoute une pièce ou
   allume un pan. Le hub se découvre au rythme de la carte, et « petit,
   dense, énigmatique » devient « petit, puis peuplé ».

## Ce qui ne bouge pas

- **Le contrat des zones méta** : les mêmes ancres (sept stations, les
  portes de dégât, table de départ, sas scellé, sceau, porte de la cuve,
  sas de givre et de vapeur), les mêmes pupitres, le même catalogue de
  réparations. La proposition se pose **dans l'éditeur** (kit chambre /
  couloir, ancres, pupitres, pancartes à pictogrammes) et se publie sous
  le code `HUB` : la copie de bibliothèque prime sur le code, sans une
  ligne de TypeScript. À vérifier au premier essai : que l'octogone du kit
  accepte quatre portes centrées sur ses faces droites et quatre stations
  sur ses pans obliques.
- **L'ouverture jouable** : cuve → alerte → brèche → l'exploration (la
  rotonde et sa vitrine) → le sas. La brèche d'index 0 reste la porte de
  la cuve.
- **La règle du kit** : centre de face contre centre de face, couloir de
  420, passage de 300. Sans elle, l'assemblage ne se lit plus comme une
  station.

## Ce qui reste à trancher (concepteur)

- **Où renaît-on au retour d'une run ?** Dans la cuve (le protocole
  recommence avec le suivant, canon §10) — c'est l'hypothèse de ce plan ;
  la cuve touche la rotonde, le retour au comptoir coûte un couloir.
- **La vitrine de la rotonde** : trois fioles visibles avant l'aile, ou
  aucune (et l'aile des endormis devient la première réparation, pas la
  sixième) ? Les deux tiennent la bible ; la vitrine est la moins chère.
- **Le secteur 4** derrière le rideau (une route de glace, cohérent avec
  « ce qui doit partir ») ou derrière sa propre porte au bout du sas ?

## Ce que ce plan ne fait pas

Il ne dessine pas les décalques (les cinq stations attendent leurs
fichiers, `assets-ia.md` §20), ne fixe pas les coordonnées, et ne juge pas
le hub compact v4 autrement que par sa forme. Si la proposition convient,
l'étape suivante est un module posé dans l'éditeur, joué dix fois de la
cuve au sas, et le nombre de gestes du trajet obligé compté avant et après.

## Ce qui est bâti (module v9, `src/game/hub.ts`)

Le plan ci-dessus, à trois écarts près, tous dus au kit — une seule porte
par face, au centre de la face :

- **Le secteur 4 part du pod de vapeur**, pas du rideau : la chambre du
  sas n'a que quatre faces (le couloir de la rotonde, la bouche d'eau, la
  grille au nord, le rideau au sud). La passerelle prend donc la face est
  du pod de vapeur ; la sortie de vapeur est rangée à l'ouest du pod pour
  que le corps qui va au secteur 4 ne lance pas une descente en passant.
  **Conséquence à valider** : la fin de l'arc demande d'avoir tissé la
  vaporisation. Le gaz reste au nord et la glace au sud, comme avant.
- **Les stations sur les pans obliques** étaient trop courtes pour un étal
  (un pan de chanfrein fait ~300 unités) : les quatre quartiers de la
  rotonde les portent, contre les parois droites — le banc au nord-ouest,
  l'étal en L au sud-ouest avec le Semblable debout devant, le mur des
  records et les deux consoles au nord-est, la vitrine et le codex au
  sud-est. Sept pictogrammes d'état sous le banc.
- **Le Semblable est un pupitre** (`marchand`) : la boîte englobante des
  alcôves, élargie de 140, mordait sur la ligne de vol et aurait ouvert le
  voile en plein trajet. Les alcôves vendent toujours au contact.

Ce qui est ajouté par rapport à la proposition : la table de départ se
**longe** (sa zone de lecture couvre la ligne, le récapitulatif s'affiche
à chaque départ, sa station reste au sud de la ligne) ; les vingt alvéoles
de la cuve ; la vitrine de trois semblables ; un pupitre `codex` et un
pupitre `fioles`. Un test neuf (`hub.spec.ts`, « la ligne de vol ») tient
la promesse : rien de ce qui réagit au contact — station, alcôve, pupitre,
banc, porte — ne mord sur la bande que le corps balaie de la cuve au sas.

| Mesuré dans le code | v8 (file) | v9 (rotonde) |
| --- | --- | --- |
| trajet obligé, naissance → bouche d'eau | 8 330 u | 4 270 u |
| chambres traversées sur ce trajet | 6 | 3 |
| coques | 17 | 15 |
| emprise des coques | 8 800 × 2 360 | 5 450 × 3 560 |

Non mesuré : le nombre de gestes du trajet obligé, qui se compte en
jouant. C'est la vérification qui reste à faire sur l'aperçu.
