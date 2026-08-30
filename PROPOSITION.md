# Proposition de développement — « Tension de surface »

Réponse au document fonctionnel v0.1 (`docs/`). Plutôt qu'un plan sur papier,
cette proposition s'accompagne d'une **slice verticale jouable** (`index.html`)
qui matérialise les choix ci-dessous.

---

## 1. Choix techniques

**Web, Canvas 2D, JavaScript sans build.**

- Le jeu est 2D, à ~300–600 particules : un solveur PBF en JavaScript tient
  60 fps sans peine. Pas besoin d'un moteur.
- Zéro outillage : on ouvre `index.html`, on joue. C'est aussi la condition
  d'efficacité du **banc de réglage** (§13 du doc) : modifier un slider et
  ressentir l'effet dans la même seconde, sans compilation.
- Le rendu métaballes s'obtient pour rien avec un filtre SVG (flou + seuil
  d'alpha) posé sur le canvas des particules.
- Portage ultérieur : si un jour le besoin de perfs l'exige (milliers de
  particules, champs thermiques), la migration naturelle est WebGL/WebGPU pour
  le rendu et éventuellement WASM pour le solveur — le code de jeu ne change pas.

**Architecture** : `fluid.js` (solveur pur, aucune notion de jeu),
`level.js` (données), `main.js` (règles), `render.js`, `tuning.js`, `params.js`.
La frontière solveur/jeu est stricte : tout ce qui est « règle » doit pouvoir
se dire en une phrase de physique, conformément au pilier 3.

## 2. Ce que la slice démontre déjà

- Corps en particules tenu par la tension de surface (contrainte de densité
  non bornée : les zones peu denses s'attirent — la cohésion émerge du solveur).
- Propulsion par éjection, **quantité de mouvement exactement conservée**
  (testé : Δv mesuré = Δv de l'équation de la fusée). Repères du §12 respectés :
  ~2 s de poussée ≈ 7 % du volume ≈ 90–100 px/s.
- Volume = vie : dispersion sous seuil critique, aucune barre à l'écran.
- Éponge conforme au cas détaillé du §6 : engluement, absorption à 0,3 s de
  contact, saturation par cellule, brèche permanente payée en volume.
  Tactique émergente déjà présente : saturer l'éponge **à distance** en
  éjectant des gouttes dedans.
- Scission/fusion par la physique seule, identification du corps par amas
  connexe, caméra auto-zoom, time warp à pas physique constant, banc de réglage.

## 3. Feuille de route proposée

| Jalon | Contenu | Critère de sortie |
|---|---|---|
| **M0 — Slice liquide** *(fait)* | verbe unique, éponge, un tableau, banc de réglage | on « sent » l'arbitrage gros/petit |
| **M1 — Chaleur** *(fait)* | carte thermique, radiateurs, cryobaies ; états **glace** (trajectoire engagée) et **vapeur** (poussée explosive, perte définitive) | traverser un même tableau par 3 routes selon l'état |
| **M1.5 — Relief** *(fait)* | niveaux (paliers, fosses), arêtes-parois, montée payante / descente gratuite, dénivelé franchissable, zone d'interaction à déclencheur | le décor a un axe de plus sans qu'aucun verbe ne s'ajoute |
| **M2 — Boucle roguelike** | enchaînement de tableaux, retour à capacité de base, surplus → bonbonnes, recondensation sur parois froides (perte 40–50 %) | une partie complète de 15–20 min |
| **M3 — Le vaisseau vivant** | refroidissement global, obstacles chimiques restants (hydrophile/phobe, filtres, champs), routes ramifiées | la pression temporelle se lit sans chronomètre |
| **M4 — Méta & narration** | bonbonnes typées (§8), déblocage des origines (§9.3), registres du labo, son | le contrat « hors protocole = déplacé, pas raccourci » est vérifiable |

Chaque jalon reste jouable de bout en bout ; le banc de réglage est l'outil
de recette de chacun.

## 3 bis. Le relief : ce qui a été ajouté, et ce que ça a coûté

Le §6 bis du doc fonctionnel est implémenté et jouable. Deux choses méritent
d'être dites, parce qu'elles engagent la suite.

**Le jeu se lit de dessus, donc l'altitude est un niveau, pas une force.**
C'est la seule lecture qui tienne : en vue de dessus, une pesanteur est
perpendiculaire à l'écran et ne produit aucun mouvement dans le plan. Un relief
est donc une **région portant une altitude** ; une arête sépare deux niveaux et
se comporte comme une paroi. Franchir, c'est ouvrir cette arête le temps que le
volume s'écoule à travers — pas téléporter le corps, pas lui appliquer une force
verticale. Le corps reste un fluide, et le solveur ne sait toujours rien du jeu.

**Ce que ça a demandé au moteur, et rien de plus :**

- une **altitude par particule** (`Fluid.reg`) : indice de la région où elle se
  trouve, `-1` au sol. Sans relief dans un tableau, tout vaut `-1` et le jeu
  d'avant est inchangé — c'est la garantie de non-régression, et le test de fumée
  la vérifie ;
- les voisins du solveur sont cherchés **à niveau constant** : deux étages
  occupent le même point du plan sans se toucher ;
- une **passerelle** déclarée par le jeu le temps d'un franchissement : le fluide
  redevient continu à cheval sur la marche, donc stable, et le corps reste un ;
- un **champ de forces extérieures** (`Fluid.accX/accY`) que le jeu remplit avant
  chaque pas. Il ne sert aujourd'hui qu'au ruissellement vers l'arête tenue —
  mais c'est exactement le point d'entrée des régimes proposés au §6.

**Le piège rencontré, à retenir :** la cohésion du corps vient d'une contrainte de
densité **non bornée** (§2). C'est ce qui fait la tension de surface — et c'est
aussi ce qui fait imploser un volume trop petit ou trop clairsemé. Toute mécanique
qui crée du fluide isolé (une goutte posée seule dans un étage vide, par exemple)
le paie immédiatement en instabilité. D'où la règle : **on ne déplace jamais une
particule à la main, on ouvre un passage et on laisse le fluide le prendre.**

**Réglages exposés au banc** (§13) : écoulement de montée et de descente, perte
par niveau monté, dénivelé franchissable, raideur et portée de la prise, seuil et
maintien du collecteur. La progression se branche là : le dénivelé franchissable
est le déblocage le plus lisible du jeu — la même carte, une route de plus.

---

## 4. Recommandations sur les décisions ouvertes (§14)

1. **Cohésion** — corps **mou mais compact** (position actuelle de la slice) :
   assez rigide pour viser, assez mou pour que se faufiler déforme visiblement.
   C'est un seul slider (`Tension de surface`) : à trancher manette en main,
   pas sur le papier.
2. **Capacité de base entre les parties** — **non** par défaut. La progression
   passe par les bonbonnes et les origines, qui sont des choix ; un gain
   passif de volume contredirait « grossir n'est jamais une récompense ».
   Si on la garde, en faire un choix d'avant-partie (embarquer plus d'eau =
   inertie thermique plus lourde), jamais un déblocage automatique.
3. **Tableaux et refroidissement** — 6–8 tableaux, ~15–20 min par tentative.
   Le refroidissement calibré pour que la vapeur devienne rare (pas impossible)
   au dernier tiers. À régler au banc, jalon M2.
4. **Scission volontaire** — **pas de commande dédiée** : la physique suffit
   (la slice le montre : une fente étroite scinde le corps, la fusion recolle).
   Une commande explicite ajouterait un verbe, contre le principe du geste unique.
5. **Contamination** — persistante sur la tentative, nettoyable par
   **distillation diégétique** : s'évaporer et se recondenser purifie — la
   souillure reste au sol. Cohérent avec la physique, coûteux (40–50 % de
   perte), donc un vrai choix.

6. **Le relief** — le prix d'une montée est le vrai curseur. Trop bas, monter
   devient la solution par défaut et le tableau perd sa tension ; trop haut,
   personne ne monte jamais. La valeur actuelle (≈ 30 % du volume déplacé par
   niveau) rend une montée aussi chère qu'une traversée d'obstacle absorbant
   (§12) : c'est un point de départ, pas une conclusion. À trancher au banc.

---

## 5. Prochaine étape immédiate

Jouer la slice, trancher la décision n°1 (cohésion) et le prix d'une montée
au banc de réglage, puis lancer M2 (la boucle roguelike) : le relief donne
enfin de quoi ramifier les tableaux sans ajouter de verbe.

---

## 6. Proposition : trois régimes de jeu

> **Rien de ce qui suit n'est implémenté.** C'est une proposition chiffrée,
> à trancher avant M3. Elle est écrite ici parce que le relief vient de poser
> les deux briques qui la rendent bon marché : un champ de forces extérieures
> par particule, et une notion de région du décor.

L'idée : le vaisseau n'a pas à être homogène. Chaque module peut relever d'un
**régime** différent, et le joueur les reconnaît à leur comportement avant même
de les lire. Trois régimes, du moins cher au plus cher.

### Régime A — l'apesanteur (c'est le jeu actuel)

Dérive inertielle, corps rond et cohésif, propulsion par éjection. C'est le
socle du §1 et il ne bouge pas. Le relief s'y applique tel quel : les niveaux
sont une propriété du décor, pas du régime.

### Régime B — le module sous pesanteur

La pesanteur est perpendiculaire au plan de jeu : elle ne pousse pas le corps
dans une direction, elle le **plaque au plancher**. Ce qui change, concrètement :

| | Apesanteur | Sous pesanteur |
|---|---|---|
| Silhouette | ronde, tenue par la tension de surface | étalée en flaque, la cohésion perd contre le poids |
| Dérive | infinie | freinée par le frottement au sol |
| Descendre | il faut le demander (prise + direction) | **automatique** : un trou aspire, on tombe dedans |
| Monter | prise + direction, coûteux | plus coûteux encore : on soulève vraiment |
| Éjection | conservation stricte de la quantité de mouvement | idem, mais le frottement mange l'élan |

Ce régime rend le relief **dangereux** au lieu d'optionnel : sous pesanteur, une
fosse n'attend plus votre accord. Il ouvre aussi le seul endroit du jeu où la
lenteur n'est pas un choix — et donc un contraste de rythme qui manque
aujourd'hui.

**Coût estimé : faible.** Trois paramètres au banc (poids, frottement,
descente automatique) + un aplatissement de la cohésion. Le champ
`Fluid.accX/accY` existe déjà ; le frottement est une traînée ; la descente
automatique est une condition en moins dans le code de franchissement.
**Risque : moyen** — l'étalement de la flaque met à l'épreuve l'identification
du corps par amas connexe (une flaque fine se fragmente). C'est le point à
vérifier en premier, avec un prototype d'une salle.

### Régime C — l'air

Un module est pressurisé ou il ne l'est pas, et **ça se joue**.

- **Module pressurisé** : l'air freine les gouttelettes éjectées (la poussée porte
  moins loin), amortit la dérive, et l'eau ne s'évapore pas librement — la vapeur
  du §4 y est moins efficace, la glace plus stable.
- **Module dépressurisé (le vide)** : plus rien ne freine, mais l'eau **bout à
  froid**. Le vide est une réserve d'énergie gratuite et un compte à rebours :
  on y va vite, on n'y reste pas. C'est le pendant exact du radiateur, et ça
  enrichit la carte thermique du §5 sans nouvelle mécanique.
- **La décompression** : ouvrir un sas entre les deux crée un **courant** — un
  champ de vitesse qui aspire tout vers la brèche pendant quelques secondes.
  Le joueur peut le subir (arraché de sa trajectoire) ou s'en servir (un transport
  gratuit, dans une direction qu'il n'a pas choisie). C'est du déplacement qui ne
  coûte pas de volume : la seule chose du jeu qui ne se paie pas en soi-même,
  donc à doser avec précaution.

**Coût estimé : moyen.** Le courant est un champ de vitesse ajouté à
`Fluid.accX/accY` — l'infrastructure est là. Le reste est du paramétrage
(traînée par module, seuil d'ébullition local). **Risque : faible côté moteur,
réel côté design** — un courant est une force que le joueur ne contrôle pas,
et le §11 tient à ce que rien n'arrive au joueur sans qu'il l'ait provoqué.
À réserver aux événements déclenchés par le joueur (il ouvre le sas), jamais
à un aléa.

### Recommandation d'ordre

1. **Finir M2** (la boucle roguelike) avec le seul régime A. C'est la boucle qui
   manque, pas la variété.
2. **Puis B**, sur un module unique, en fin de parcours : le vaisseau se
   re-pressurise et se remet à tourner à mesure qu'on approche du réacteur —
   la pesanteur devient un signal narratif autant qu'une mécanique.
3. **Puis C**, dont la décompression est un événement de fin de parcours idéal.

Faire les trois en même temps coûterait la lisibilité : le joueur apprend un
régime par ses erreurs, et il lui faut une salle entière pour ça. C'est aussi
pour ça qu'ils sont **des modules**, pas un réglage global — on peut en livrer
un seul et voir.
