# Tension de surface
### Document fonctionnel — v0.1

*Titre de travail. « Tension de surface » désigne à la fois la force physique qui tient le personnage ensemble et l'état d'esprit du jeu.*

---

## 1. Pitch

Vous êtes un volume d'eau, échantillon d'un laboratoire orbital, en train de s'échapper.
En gravité nulle, la seule façon d'avancer est d'éjecter une partie de soi-même :
**se déplacer, c'est rétrécir**. Roguelike ambiant et inertiel, sans arme et sans ennemi —
seulement un vaisseau qui, méthodiquement, cherche à récupérer une fuite.

**Référence de ressenti :** Osmos (Hemisphere Games) — lent, contemplatif, chaque impulsion se paie.
**Référence de structure :** Dead Cells — routes ramifiées, déblocages qui ouvrent des chemins latéraux.

---

## 2. Les trois piliers

1. **Une seule ressource.** La masse est simultanément le corps, le carburant et les points de vie.
   Aucune barre de vie : on lit l'état du joueur dans sa silhouette.
2. **Aucun ennemi, une infrastructure.** Le vaisseau ne voit pas un personnage, il voit une fuite,
   et il fait son travail. Pas de boss, pas de combat.
3. **La physique produit les règles.** Absorption, fusion, dispersion, changement d'état : rien
   n'est une règle de jeu arbitraire, tout découle du modèle. Le joueur apprend de la physique,
   pas d'un tutoriel.

---

## 3. L'entité jouable

### 3.1 Le corps

Un volume d'eau simulé en particules, tenu par la tension de surface. Il se déforme, s'étire,
peut se scinder et se recomposer. Il n'a pas de « points de vie » : il a un **volume, en litres**.

- **Absorber** de l'eau libre l'agrandit. Ce n'est pas une règle : deux masses d'eau qui se touchent
  fusionnent, c'est tout.
- **Se disperser** sous un volume critique met fin à la tentative : la cohésion ne tient plus,
  le corps se fragmente.
- **Se scinder** volontairement permet de franchir deux ouvertures simultanées, puis de fusionner.
  Mal dosé, on laisse une gouttelette derrière — perdue.

### 3.2 L'arbitrage central : gros ou petit

Ni l'un ni l'autre n'est supérieur. C'est le cœur tactique du jeu.

| | Gros volume | Petit volume |
|---|---|---|
| **Réserve de mouvement** | longue | courte |
| **Inertie thermique** | lent à chauffer, lent à geler | change d'état presque instantanément |
| **Manœuvrabilité** | pataud, occupe l'espace | nerveux, passe partout |

> **Règle de conception :** grossir n'est jamais une récompense, c'est une décision.
> On n'ajoute jamais de « bonus de volume » gratuit dans un niveau.

### 3.3 Le verbe de base : la propulsion par éjection

Le joueur maintient un point **derrière** lui ; la matière est expulsée vers ce point, le corps
part à l'opposé. Quantité de mouvement rigoureusement conservée. Il n'existe pas de frein :
ralentir coûte une seconde impulsion, aussi chère que la première.

Ce geste unique porte tout le jeu. Il est disponible dès la première seconde et ne se remplace jamais.

---

## 4. Les trois états de l'eau

Les états ne sont pas de nouvelles mobilités : ce sont des **montées en puissance** du même geste.

### Liquide — la présence
État de base. Souple, cohésif, capable d'épouser n'importe quelle forme.
Vulnérable à tout : absorbé, aspiré, contaminé, dispersé.
Propulsion par gouttelettes : poussée faible, pilotage fin, gratuite en énergie mais coûteuse en volume.

### Glace — l'engagement
On choisit un vecteur, on gèle, on ne pilote plus. On glisse, on rebondit, on conserve sa
quantité de mouvement. En échange : le vide, la chaleur et les filtres n'ont plus prise.
**Geler, c'est parier sur une trajectoire.** L'incontrôlabilité n'est pas un défaut, c'est le prix.

### Vapeur — l'énergie
Une partie du corps est portée à ébullition et se détend violemment : propulsion explosive,
et arme contre les parois, sas et conduites. Nécessite une source de chaleur.
Chaque bouffée part définitivement — la vapeur éjectée ne revient pas.

---

## 5. La chaleur, seconde ressource

On ne peut pas se vaporiser sans énergie, ni geler dans une salle tiède. Le vaisseau est donc
lu comme une **carte thermique** : conduites brûlantes, réacteur, éclairages, cryobaies, coques
exposées au vide. Le level design ne se pense pas en portes et en murs, mais en gradients de
température : où je peux recharger, où je risque de me figer malgré moi.

### Le refroidissement du vaisseau
Le vaisseau refroidit au fil de la partie. Ce n'est pas un chronomètre affiché : c'est le monde
qui devient progressivement moins jouable — moins de vapeur possible, plus de gel subi.
Ce refroidissement remplit trois fonctions à la fois :

- **courbe de difficulté** qui monte sans qu'on ajoute d'ennemis,
- **pression temporelle** sans compte à rebours à l'écran,
- **justification narrative** de l'état du vaisseau et de la fin du parcours.

L'endroit le plus chaud du vaisseau — le dernier à s'éteindre — est nécessairement la destination.

---

## 6. Le vaisseau : un antagoniste sans visage

Le laboratoire réagit comme un système, pas comme un adversaire : déshumidificateurs, protocoles
de confinement, filtration, purges programmées. Personne ne vous en veut. C'est précisément
ce qui met mal à l'aise, et ça évite complètement le piège du boss.

### Les obstacles sont de la chimie, pas de la géométrie
L'eau passe partout : un mur n'arrête rien. Les obstacles jouent donc sur les propriétés du fluide.

| Élément | Effet |
|---|---|
| Surface hydrophile | on y adhère, on rampe dessus |
| Surface hydrophobe | repousse, dévie les trajectoires |
| Éponge / matériau absorbant | siphonne le volume au contact prolongé |
| Radiateur, conduite chaude | évapore — danger ou ressource selon l'état |
| Filtre, grille | laisse passer l'eau pure, retient le reste |
| Champ électrostatique | l'eau est polaire : attirée, déviée, retenue |
| Souillure (encre, huile, sel) | modifie les propriétés du corps (voir §8) |

### Cas détaillé : l'éponge (mécanique prototypée et validée)
- Le contact n'est pas mortel : il englue (forte traînée) et absorbe après ~0,3 s de contact continu.
  Frôler en vitesse coûte quelques gouttes ; s'écraser dessus vide le joueur.
- Chaque cellule d'éponge se **sature**. Une fois gorgée, elle devient solide et n'absorbe plus.
- Conséquence émergente, non scriptée : on peut **payer un passage en volume**, saturer une zone
  et ouvrir une brèche permanente. Le sacrifice est une option de traversée.

Ce cas sert de modèle pour tous les autres : un obstacle doit être un **gradient de risque**,
jamais un mur binaire.

---

## 6 bis. Le relief — les niveaux

*Ajout à la v0.1. Prototypé et jouable.*

Le tableau se lit **de dessus**. L'altitude n'est donc pas une force : c'est un **niveau**.
Une région de relief porte une altitude en niveaux — un **palier** au-dessus du sol,
une **fosse** en dessous — et le décor devient un empilement d'étages plutôt qu'un plan.

### La règle, en une phrase
Une arête sépare deux niveaux et **se comporte comme une paroi** : le corps s'arrête
tout seul contre un palier, et tout seul au bord d'un trou. Elle ne s'ouvre que si
le joueur **pousse dans sa direction et tient la prise** (un bouton). Une prise,
une arête : le passage terminé, il faut relâcher pour en tenir une autre.

### Monter coûte, descendre est gratuit
- **Monter.** L'arête s'ouvre, le volume s'y écoule lentement, à l'envers du
  ruissellement. Chaque part qui franchit la marche en laisse une fraction sur la
  paroi : **le film est perdu**. C'est un pouvoir, et il se paie en volume — donc
  en réserve de mouvement, en inertie thermique et en récompense de sortie.
- **Descendre.** L'arête s'ouvre, le volume tombe. Rien à payer : on ne fait
  qu'aider la pente. Ressortir, en revanche, est une montée.

Le contrat du §3.2 est intact : monter n'est pas « mieux », c'est un arbitrage.
On échange du volume contre une route.

### Le dénivelé franchissable
Une montée ne franchit qu'un dénivelé donné d'un seul élan (réglable au banc).
Au-delà, la marche reste une paroi et le jeu le dit (**TROP HAUT**) : on passe par
le palier d'en dessous. C'est le point d'accroche naturel d'un déblocage de
progression — le même décor, une route de plus, exactement le rôle donné aux états
au §9.2. Aucun raccourci : une route latérale.

### La zone d'interaction
Une fosse peut être un **collecteur** : quand le volume qu'on y a versé atteint le
seuil et s'y maintient, un déclencheur s'arme et ouvre une vanne ailleurs dans le
tableau. Le prix, c'est ce qu'on y laisse — et le ressortir est une montée. C'est
donc un vrai arbitrage, pas un interrupteur ; et cela ne crée aucune eau : le
collecteur ne rend rien, conformément au §7.1.

### Lecture
Un palier est clair, plus clair encore quand il est haut, et porte son ombre au
sol. Une fosse est un creux sombre à l'ombre intérieure. Chacun affiche son
niveau (+1, +2, −1). Le corps lui-même s'éclaircit d'un étage au-dessus, se
sourdit d'un étage en dessous ; le HUD nomme le niveau courant et l'état du
franchissement (MONTÉE, DESCENTE, TROP HAUT).

### Ce que ça n'est pas
Ce n'est pas une pesanteur dans le plan. Le jeu reste celui du §1 — apesanteur,
dérive inertielle, propulsion par éjection. Le relief ajoute un axe au décor,
pas une force au corps. Voir la proposition de **régimes de jeu** dans
`PROPOSITION.md` pour ce qu'ajouterait, à part, un module sous pesanteur.

---

## 7. Boucle roguelike

### 7.1 Le tableau
Chaque tableau est un problème fermé.

1. On entre avec une capacité de base (volume plein).
2. **Il n'y a pas d'eau à ramasser dans le niveau.** La pente est descendante.
3. On sort par un sas ; on repart au tableau suivant à la capacité de base.

### 7.2 La récompense, c'est le surplus
> Ce qu'il vous restait à la sortie est compressé en **bonbonne**.

Aucun butin ne tombe du décor : le loot, c'est votre propre maîtrise, mise en bouteille.
Traverser proprement enrichit ; bourriner permet de survivre les mains vides.
Le système d'économie tient en une conversion, sans mécanique supplémentaire.

### 7.3 Le rattrapage : la recondensation
Sans eau dans les niveaux, une erreur en début de tableau serait irrattrapable. La physique
fournit la soupape : **la vapeur perdue se recondense sur les parois froides** et peut être
réabsorbée, avec une perte importante (40–50 %). Ce n'est pas du butin dans le décor, c'est son
propre corps qu'on va rechercher — au prix d'un détour et de temps.

Effet secondaire vertueux : plus le vaisseau refroidit, plus la condensation est efficace.
Le jeu devient plus dur **et** légèrement plus indulgent en même temps. Auto-équilibré, et diégétique.

---

## 8. Les bonbonnes

Chaque bonbonne est une eau différente, pas un chiffre différent.

| Bonbonne | Effet |
|---|---|
| **Distillée** | volume pur, traverse les filtres sans perte |
| **Surchauffée** | vaporisation immédiate, poussée violente, se consume vite |
| **Glycolée** | antigel : résiste au froid ambiant, mais devient presque impossible à vaporiser |
| **Salée** | conductrice : déclenche les circuits, ouvre des portes, attire les décharges |
| **Contaminée** | beaucoup de volume, mais le vaisseau vous classe en fuite prioritaire |

---

## 9. Structure de carte et déblocages

### 9.1 Routes
Ramification à la Dead Cells : plusieurs sorties par tableau, menant à des modules différents.
Les déblocages ouvrent des chemins **latéraux**, jamais des raccourcis — sinon la progression
récompense le joueur par moins de jeu.

### 9.2 Les états comme clés rétroactives
Chaque état débloque des passages dans des modules déjà connus : figer un jet pour faire pont
ou caler une porte (glace), monter par les grilles et les conduits verticaux (vapeur).
Revenir dans le premier module et y voir trois chemins invisibles jusque-là est le moteur
des parties 2 à 15.

### 9.3 Le flacon : débloquer sa propre origine
La cinématique d'introduction n'est pas un temps mort à passer, c'est une **preuve de maîtrise**.
Le joueur ne débloque pas une porte : il débloque la façon dont il naît.

| État maîtrisé | Origine | Rapport au protocole |
|---|---|---|
| **Liquide** | on vous verse à l'endroit prévu | vous le subissez |
| **Glace** | vous faites éclater le flacon en transit | vous l'interrompez |
| **Vapeur** | vous vous évaporez dans le flacon scellé avant chargement, vous partez par la ventilation | **vous n'avez jamais été dans le flacon** |

À chaque état, on remonte plus tôt dans sa propre histoire.

**Le contrat, à respecter absolument :** sortir hors protocole ne raccourcit pas le parcours,
il le déplace — autres modules, autres températures, autres routes, distance équivalente.
Et il a un prix : une évasion non planifiée déclenche un **niveau de confinement supérieur
d'entrée de jeu**. Plus difficile, plus généreux. Le joueur choisit sa difficulté en choisissant
comment il naît.

---

## 10. Progression méta et narration

Vous êtes un échantillon. Quand vous vous dispersez, le laboratoire recommence l'expérience
avec le suivant. La progression entre parties n'a pas besoin d'être justifiée : c'est le
**protocole qui s'affine**, itération après itération. Le joueur ne « revient pas à la vie »,
il est la n-ième tentative.

Côté labo, la progression se lit dans les registres : le spécimen s'échappe de plus en plus tôt.
Ce n'est plus une montée en puissance du joueur, c'est **une expérience qui dérape** — et ça se
raconte sans une ligne de dialogue.

---

## 11. Ressenti, caméra, tempo

- **Lenteur assumée.** Grands espaces, vitesses faibles, longues dérives. Le jeu récompense
  la patience, pas la réactivité.
- **Time warp** (ralenti / accéléré). Ce n'est pas un confort mais la condition de jouabilité
  du genre : sans lui, l'inertie est frustrante. Il ne modifie jamais le pas de temps physique,
  seulement le nombre de pas consommés par seconde réelle.
- **Caméra à zoom automatique**, cadrant le corps à une fraction constante de l'écran :
  grossir se ressent par un dézoom, donc par une perte de contrôle perçue.
- **Trame de repère dans le décor.** Sans points fixes, la dérive en espace vide est imperceptible.
- **Rendu métaballes**, palette froide, lisibilité de l'état par la couleur et la vitesse.

---

## 12. Repères d'équilibrage (mesurés sur prototype)

- Maintenir la poussée 2 s ≈ **7 % du volume**, pour atteindre ~100 px/s.
- Maintenir 12 s sans interruption ≈ **dispersion complète**. La sur-éjection tue.
- Traverser une salle et s'arrêter proprement ≈ **20–30 % du volume** de départ.
- Franchir un obstacle absorbant sans maîtrise ≈ **jusqu'à un tiers du volume** perdu.

Ces valeurs donnent une marge nette entre le joueur appliqué et le joueur brouillon,
sans que la réussite soit gratuite.

---

## 13. État technique

**Validé sur prototype :** solveur de fluide PBF 2D, cohésion (le corps tient en apesanteur
sans s'effondrer), propulsion par éjection à quantité de mouvement exactement conservée,
absorption par temps de contact et saturation d'un matériau, identification dynamique du corps
joueur par amas connexe, fusion automatique des masses d'eau, caméra à zoom, time warp,
chaleur et changements d'état (glace, vapeur), **relief à niveaux** (§6 bis : arêtes-parois,
montée payante, descente gratuite, dénivelé franchissable, zone d'interaction).

**Non abordé :** son, interface de méta-progression, sauvegarde, manette, portage.

**Outil prioritaire :** le banc de réglage — tous les paramètres de ressenti en sliders modifiables
en direct, export des valeurs en JSON. C'est l'interface de travail entre le game design et le code.

---

## 14. Décisions ouvertes

1. **La cohésion.** Curseur d'identité du jeu : corps quasi rigide et précis (proche d'Osmos)
   ou corps mou et organique, plus original mais plus difficile à piloter. **À trancher en premier.**
2. **La capacité de base augmente-t-elle entre les parties ?** Si oui, on gagne en autonomie
   mais on perd en réactivité thermique — une montée en puissance qui alourdit le pilotage.
   Rare et intéressant, mais le joueur doit le vivre comme un choix, jamais comme une punition.
3. **Combien de tableaux par partie**, et à quelle vitesse le vaisseau refroidit.
4. **La scission volontaire** est-elle un verbe explicite (commande dédiée) ou seulement
   une conséquence de la physique que le joueur découvre ?
5. **La contamination** est-elle un état persistant sur toute la partie, ou nettoyable ?
6. **Le relief** (§6 bis) : quel prix pour une montée, et le dénivelé franchissable
   augmente-t-il avec la progression ? Les deux sont des sliders du banc, à trancher
   manette en main.
7. **Les régimes de jeu** : le vaisseau reste-t-il entièrement en apesanteur, ou
   comporte-t-il des modules sous pesanteur et des modules dépressurisés ?
   Proposition chiffrée dans `PROPOSITION.md`, §6.
