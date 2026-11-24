# L'atelier du joueur — le plan du chantier

*Plan du 24/11/2026. Le but : ouvrir l'éditeur aux joueurs, sans leur
ouvrir la run. Les salles qu'ils créent se partagent d'elles-mêmes, se
jouent dans un écran à part et tiennent leurs propres records. Elles
n'entrent pas dans l'expédition, pour le moment.*

## 1. Ce qui décide de tout : quatre contraintes du dépôt

Ces contraintes ne sont pas des préférences. Le plan en découle.

1. **L'API n'avait aucun verrou.** N'importe quel navigateur pouvait
   réécrire ou effacer la bibliothèque, la carte, le récit… par un simple
   POST ou DELETE. Le mode concepteur ne cachait que des boutons. Avant
   d'ouvrir quoi que ce soit aux joueurs, il fallait poser une serrure.
   C'est le **lot 1**, déjà fait (§3).
2. **Les douze fonctions Vercel sont prises.** Le plan Hobby en compte
   douze et `api/` en a douze. `api/reglages.ts` héberge déjà les avis des
   joueurs faute de place. Un endpoint `creations` de plus casserait le
   déploiement : il faut d'abord **libérer une place** (lot 2).
3. **Vercel Blob compte ses écritures.** Le plan Hobby donne 2 000
   opérations avancées par mois. Une écriture du magasin
   (`api/_magasin.ts`) en coûte **3** (2 put + 1 list), soit de l'ordre de
   **660 écritures par mois pour tout le site**, concepteurs compris. Les
   fantômes (`api/fantomes.ts`) le rappellent : leur écriture est rare
   *exprès*. Des créations publiées « automatiquement », plus leurs
   records, ne tiennent pas dans ce régime. **Le magasin des créations est
   la décision structurante du chantier** (lot 3).
4. **Rien ne vérifie avant `prod`.** Une PR vers `dev` ne déclenche rien.
   Chaque lot arrive avec ses tests et passe `type-check` / `test` /
   `build` en local.

## 2. La forme générale

```
                 ┌──────────── la RUN (inchangée) ─────────────┐
 concepteurs ──▶ │ bibliothèque · carte · récit · réglages      │ ◀── tout le monde LIT
   (clé)         │ api/levels, api/reglages… (Blob)             │
                 └──────────────────────────────────────────────┘

                 ┌──────────── les CRÉATIONS ──────────────────┐
 joueurs ──────▶ │ salles des joueurs + leurs records           │ ◀── écran CRÉATIONS
 (jeton d'auteur)│ api/creations (magasin à choisir, lot 3)     │
                 └──────────────────────────────────────────────┘
                     jamais lu par la run : aucune passerelle
```

- **Le même moteur, un autre écran.** L'atelier du joueur réutilise
  `LevelEditor` (canevas, pose, sélection, annulation, validation) avec un
  **profil**. Le profil dit ce que le joueur peut poser et quels panneaux
  il voit. Pas de second éditeur à maintenir.
- **Une liste blanche, des deux côtés.** Le profil liste ce qui est
  permis. Un outil ajouté plus tard pour le concepteur reste donc invisible
  au joueur tant qu'on ne l'y ajoute pas. Le serveur applique **la même
  liste** (un module partagé, comme `api/_provenance.ts`) : un joueur qui
  contourne l'atelier et parle directement à l'API ne passe pas un champ
  interdit.
- **Aucune passerelle vers la run.** La run lit `api/levels` ; les
  créations vivent ailleurs, sous des codes qui ne peuvent pas entrer en
  collision avec les codes officiels.

## 3. Lot 1 — la clé concepteur ✅ (cette PR)

Le seul lot livré dans cette PR.

- **Lire reste libre**, puisque le jeu en a besoin. **Écrire exige une
  clé** sur les neuf endpoints qui changent ce que tout le monde joue :
  `levels`, `presets`, `cinematiques`, `codex`, `fiches`, `images`,
  `journal`, `regles`, `reglages`.
- **Restent ouverts, sans clé** : ce que les joueurs déposent, c'est-à-dire
  `records`, `fantomes`, `perf`, et les deux domaines d'avis de `reglages`
  (`ecoute`, `avis-salles`). *Effacer* un avis demande la clé.
- **Une clé par personne**, nommée, dans la variable Vercel
  `CLES_CONCEPTEUR` :
  `CLES_CONCEPTEUR = "julian:<clé>, ami:<autre clé>"`.
  On retire l'une sans toucher à l'autre, et le serveur sait qui écrit.
  Une clé de moins de 16 caractères est ignorée.
- **Sans clé configurée, les écritures sont refusées (503)** avec un
  message qui le dit. Une variable oubliée ne rouvre pas la porte en
  silence.
- **Sur le poste** : RÉGIE › CLÉ CONCEPTEUR. On colle la clé, ENREGISTRER
  la vérifie aussitôt auprès du serveur (`GET /api/reglages?verifie=cle`,
  qui n'écrit rien). Elle se range dans le navigateur, à part du coffre
  des sauvegardes (jamais dans le Steam Cloud). La cloison réseau
  (`src/game/reseau.ts`) la pose sur chaque écriture, jamais sur une
  lecture.
- **Les gâchettes `ops/`** (`seed-levels`, `seed-inspires`, `maj-hub`,
  `rend-rescape`) lisent le secret GitHub `CLE_CONCEPTEUR`. Pour
  `restaure.mjs`, lancé à la main : `CLE_CONCEPTEUR=… CONFIRME=oui node
  ops/restaure.mjs`.

### À faire par l'humain, AVANT de livrer vers `prod`

1. Générer une clé par personne, par exemple `openssl rand -base64 32`.
2. Vercel › projet › Settings › Environment Variables : `CLES_CONCEPTEUR`,
   cochée pour **Production et Preview**.
3. GitHub › Settings › Secrets › Actions : `CLE_CONCEPTEUR`, l'une des
   clés, pour les gâchettes.
4. Transmettre sa clé à l'ami par un canal privé, puis la saisir dans la
   régie sur chaque appareil.

Sans l'étape 2, la livraison verrouille toutes les publications jusqu'à
ce que la variable existe.

### Ce que la clé ne cache pas

L'**ordre de la run** reste lisible par `GET /api/levels` : le jeu le
télécharge pour jouer, donc un joueur curieux peut le lire. L'atelier ne
le montrera pas, mais le cacher vraiment demanderait que le serveur
compose la run lui-même. C'est un autre chantier, à ouvrir seulement si
ça compte.

## 4. Les lots suivants

Chaque lot : une branche issue de `dev`, une PR vers `dev`.

### Lot 2 — libérer une fonction

Fusionner deux endpoints concepteur peu sollicités en un seul. Par
exemple, `presets` et `regles` deviennent deux domaines d'un endpoint
commun, comme `reglages` l'a fait pour huit domaines. Le contrat côté
client ne change pas : seuls `src/bench/presets.ts` et les appels
`/api/regles` de `main.ts` changent d'adresse. Le lot comprend aussi
une migration des documents existants (relecture de l'ancien préfixe) et
la mise à jour de `ops/sauvegarde.mjs`.

### Lot 3 — le magasin des créations (DÉCISION À PRENDRE)

Blob ne tient pas le régime (§1.3). Trois voies :

| Voie | Pour | Contre |
| --- | --- | --- |
| **Une base gratuite** branchée par le Marketplace Vercel (Redis ou Postgres) | écritures nombreuses et bon marché ; index, tri, compteurs natifs | une dépendance de plus ; quota gratuit à **mesurer** avant de choisir |
| **Blob, en lots** : les créations s'accumulent et s'écrivent par paquets | rien de neuf | publication différée, pas « automatique » ; records quasi impossibles |
| **Hors ligne d'abord** : chaque création vit sur son poste, et se partage par fichier ou lien | coût nul | ce n'est pas le partage automatique demandé |

**Recommandation : une base gratuite**, choisie après avoir relevé sur
leurs pages, au moment du choix, les quotas réels (commandes ou lignes
par mois, stockage). Le budget visé se calcule : nombre de créations
publiées par mois plus nombre de records déposés, contre le quota. Blob
reste le magasin des documents officiels. Le jour du build Steam, le
**Workshop** prend le relais pour le partage (le contenu y est hébergé
gratuitement).

### Lot 4 — le profil du joueur (liste blanche)

Un module pur, `src/editor/profilJoueur.ts`, et son jumeau côté serveur,
`api/_creation.ts`, partagent une seule liste.

| Le joueur PEUT poser | Le joueur NE voit PAS |
| --- | --- |
| bornes, départ (sans impulsion d'abord), sortie | la bibliothèque, la séquence, la planche, le semis |
| parois et structures de coque, matériaux (hydrophobe, hydrophile, membrane, grille, rideau, plaques chaudes et froides, surchauffeur, vide, baie, miroir) | les plots de boutique, le marchand, le banc des mémoires, les pupitres |
| éponges, lasers, pastilles, portes, chasses, puits, coupelles, rails, mires et cibles | les ancres méta, les éclats, la fiole, les condensats, les caches à orbe |
| lumières, décalques de décor | les codes réservés (`HUB3`…), les cinématiques et séquences, le journal de bord du protocole |
| un **nom** et une **courte description** (texte borné) | la publication officielle |

Le serveur **retire** tout champ hors liste et **refuse** une salle que
`levelIO` ne relit pas. Il applique aussi des bornes de taille (une salle
écrite pèse ~1,5 Ko d'après `api/_budget.ts`, donc un plafond de l'ordre
de 16 Ko laisse de la marge) et des nombres d'éléments maximum.

### Lot 4 bis — concevoir l'atelier pour un joueur (AVANT le code)

L'éditeur du concepteur est un outil d'expert : **69 champs numériques**
dans `src/editor/editor.ts`, en unités du monde (« X min », « Rayon de la
bouche (u) », « N° (canal) », « Canal (0 permanente · −1 séquence
seule) »). Le joueur ne doit rien en voir. **Même moteur, autre visage** :
l'atelier se dessine et se valide sur maquettes, puis il se code.

Les principes :

- **Manipuler, pas saisir.** Position, taille, rayon et angle se règlent
  par des poignées sur le canevas, jamais par des coordonnées. Les
  nombres disparaissent de l'atelier.
- **Peu de réglages, avec des mots.** Chaque élément montre au plus
  **trois réglages**, en paliers nommés plutôt qu'en valeurs : une
  coupelle *petite / moyenne / grande* qui boit *un peu / beaucoup*, un
  puits *faible / fort*. Les paliers sont des valeurs choisies au banc :
  le joueur ne peut pas fabriquer une salle cassée par un réglage absurde.
- **Les liens se tirent, ils ne se numérotent pas.** Le canal (laser →
  pastille → porte, coupelle → porte) devient un fil qu'on tire d'un
  élément à l'autre, et qui se dessine en couleur. Plus de numéro à
  recopier.
- **Voir l'effet avant de jouer.** Chaque réglage se prévisualise sur
  place : la portée d'un puits, le souffle d'une chasse, le trajet d'un
  laser, la zone chaude d'une plaque.
- **Une palette rangée par intention**, pas par type technique : *Bâtir*
  (parois, structures), *Matières* (hydrophobe, éponge, membrane…),
  *Chaleur* (plaques, surchauffeur), *Forces* (puits, chasses, rails),
  *Mécanismes* (lasers, pastilles, portes, coupelles). Chaque élément a
  son icône peinte (celles du codex), son nom, et une phrase qui dit ce
  qu'il fait au corps.
- **Aide au bon moment** : une fiche courte au survol ou à l'appui long,
  qui reprend le codex (avec sa vidéo quand elle existe). Une salle
  d'apprentissage de l'atelier à la première ouverture.
- **Rien d'irréversible** : annuler et rétablir toujours visibles, la
  sauvegarde continue, et une corbeille plutôt qu'une suppression sèche.
- **Les erreurs avant l'essai** : l'atelier signale en clair ce qui
  empêche de jouer (pas de sortie, départ dans un mur, porte sans
  commande), sur l'élément fautif.
- **Toutes les mains** : souris, tactile (grandes cibles, pincement,
  appui long à la place du clic droit) et manette (Steam Deck : la
  sélection se déplace d'élément en élément, les gâchettes changent de
  palette). Contrastes et tailles de texte lisibles (cible WCAG AA), et
  rien qui ne se dise que par la couleur.

La méthode :

1. **L'inventaire.** Pour chaque élément de la liste blanche (lot 4), ses
   champs actuels, et le sort de chacun : *poignée*, *palier nommé*,
   *fil*, *valeur fixe* (choisie pour le joueur) ou *caché*. Un tableau
   par élément, relu ensemble.
2. **Les maquettes** des écrans : palette, élément sélectionné, fils de
   liaison, aide, erreurs, version tactile et manette. Elles sont validées
   **avant** la première ligne de code.
3. **L'essai à blanc** : une personne qui n'a jamais vu l'éditeur bâtit
   une salle sans aide. Ce qu'elle cherche sans le trouver revient dans
   les maquettes.

### Lot 5 — l'atelier (l'écran)

Il code les maquettes validées au lot 4 bis.


- Une porte **ATELIER** sur l'accueil, pour tous, sans `?dev`.
- `LevelEditor` ouvert avec le profil joueur : la palette réduite, sans le
  panneau bibliothèque, et un panneau **MES CRÉATIONS** à sa place.
- **Sauvegarde continue sur le poste** : un brouillon par création, rien
  ne part sur le réseau pendant le travail.
- **ESSAYER** joue la salle telle quelle.
- **La publication automatique, au bon moment** : une création se
  partage quand **son auteur a atteint la sortie** en l'essayant. Les
  retouches suivantes se republient à la sortie de l'atelier, pas à
  chaque geste, pour ménager le quota. Une salle infranchissable ne part
  donc pas. C'est une garantie de bonne foi, pas une preuve : le serveur
  ne rejoue pas la physique.
- **Le jeton d'auteur** : un secret tiré au hasard à la première
  publication et rangé sur le poste. Lui seul permet de modifier ou de
  retirer ses créations, sans compte (le principe des places du relais).

### Lot 6 — l'écran CRÉATIONS

- La liste des créations publiées : les plus récentes d'abord, le nom,
  l'auteur, une vignette dessinée depuis la géométrie (le dessin de la
  planche).
- **Jouer hors run** : la salle seule, sans mémoire, orbes, butin,
  trophées ni avancée du codex. Elle ne touche à rien de la sauvegarde.
- Les records de la salle, affichés comme ceux des salles officielles.

### Lot 7 — les records des créations

- Les mêmes deux classements que les salles officielles : **volume**
  (le temps départage) et **chrono** (les litres départagent).
- Chaque record porte l'**empreinte du contenu** de la création :
  modifier une salle publiée remet ses records à zéro, puisque ce n'est
  plus la même salle.
- Le palmarès officiel (`api/records`) n'est pas touché : les codes des
  créations ne peuvent pas y entrer.
- **Les fantômes viendront plus tard** : une trace pèse jusqu'à ~60 Ko par
  course de trois minutes (`api/fantomes.ts`). À rouvrir une fois le
  magasin et son quota connus.

### Lot 8 — la modération (avant l'ouverture au public)

- Un bouton **SIGNALER** sur chaque création.
- Sous clé concepteur : **MASQUER** une création (elle disparaît de la
  liste, sans être effacée) ou la retirer.
- Débit limité par adresse sur les publications et les records ; textes
  bornés.

### Plus tard

- J'aime et tri par popularité.
- **Faire entrer une création dans la run** : un geste de concepteur, qui
  copie la création dans la bibliothèque officielle, crédit de l'auteur
  compris. C'est la seule passerelle, et elle est humaine.
- Le Workshop Steam.

## 5. Les questions ouvertes

1. **Le magasin** (lot 3) : d'accord pour une base gratuite branchée par
   le Marketplace Vercel ?
2. **Les textes libres** : le nom et la description suffisent-ils, ou le
   joueur peut-il aussi poser des étiquettes dans la salle ? Chaque texte
   libre est un texte à modérer.
3. **Le nom affiché** : le nom d'opérateur des records suffit-il ?
4. **La validation par l'auteur** (atteindre la sortie avant de
   partager) : on la garde ?
5. **Les maquettes de l'atelier** (lot 4 bis) : en pages interactives
   qu'on clique, ou dans Figma ?
