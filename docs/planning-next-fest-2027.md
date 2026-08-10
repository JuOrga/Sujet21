# Planning — Steam Next Fest, février 2027

Objectif : arriver au festival avec une démo solide **et une liste de souhaits
déjà constituée**, puis sortir au printemps 2027.

Rappel de la règle qui commande tout le reste : **on ne participe qu'une fois
par jeu, à vie**. Une démo tiède en février 2027 brûle définitivement la carte.

---

## Les dates fixes

| Date | Quoi |
|---|---|
| **~début janvier 2027** | clôture des inscriptions *(à confirmer — pour l'édition d'octobre 2026 c'était 7 semaines avant)* |
| **25 janvier 2027** | **date butoir réelle** : build de démo + page boutique soumis à validation pour l'aperçu presse |
| **8 février 2027** | tous les éléments requis soumis à validation |
| **22 février – 1er mars 2027** | le festival |

Deux contraintes Steam à intégrer en amont :

- **30 jours d'attente** après paiement du Steam Direct avant de pouvoir sortir
  le jeu. Le compteur doit être lancé en août, pas en décembre.
- La page **« Prochainement » doit être publique** avant l'inscription, et de
  toute façon au moins deux semaines avant la sortie. En pratique : **en ligne
  fin novembre**, parce que chaque jour en ligne est un jour de souhaits.

*Dates vérifiées le 10/08/2026 depuis des sources secondaires ; la
documentation Steamworks est derrière un accès partenaire. À reconfirmer sur
`partner.steamgames.com` avant de caler quoi que ce soit dessus.*

---

## Phase 0 — Cette semaine (11–17 août)

Rien de créatif, uniquement des délais à lancer.

- [ ] Compte Steamworks : questionnaire fiscal, coordonnées bancaires,
      vérification d'identité. *(Prévoir la question de la structure juridique —
      c'est parfois ce qui bloque une semaine.)*
- [ ] **Payer le Steam Direct (100 $)** — lance les 30 jours. Récupérable au-delà
      de 1 000 $ de revenus.
- [ ] **Trancher la question de l'exposition IA** (voir plus bas). Cette décision
      colore la communication entière : mieux vaut la prendre à froid maintenant
      qu'à chaud en décembre.
- [ ] Hygiène du dépôt : branche par défaut sur le tronc réel, fusion de
      `record-system-0qql18` et `game-development-mj7yk1`.

---

## Phase 1 — 18 août → 20 septembre : le périmètre et le socle

**La décision structurante : qu'est-ce qui est vendu, et qu'est-ce qui est
montré.** Elle se prend maintenant, pas en janvier.

- [ ] **Définir le contenu du jeu vendu.** Recommandation : les bonbonnes typées
      (§8) et les origines déblocables (§9.3) sont hors périmètre v1. Beaucoup
      de production, peu de retour joueur, et ce sont les candidats naturels à
      un contenu post-lancement.
- [ ] **Définir la démo** : les 3 premiers tableaux, 20 à 30 minutes, qui se
      termine sur une accroche, pas sur un écran de fin. La démo doit donner
      envie du reste, pas le résumer.
- [ ] **Empaquetage bureau (Tauri).** À faire **tôt** : c'est là que sortent les
      surprises — WebGL2 dans le wrapper, plein écran et résolutions, emplacement
      de sauvegarde, taille du binaire.
- [ ] **Fonctionnement hors ligne** durci : le jeu vendu ne peut pas dépendre de
      `/api/levels` ni `/api/records`. Le repli existe, il doit devenir le
      chemin nominal de la build Steam.
- [ ] **Playtest nº 1 — 5 personnes qui n'ont jamais vu le jeu.** On les regarde
      en silence, on ne les aide pas, on note où elles décrochent. C'est le seul
      test qui répond à la vraie question ouverte du projet : le pilotage
      inertiel est-il sublime ou insupportable ?

> **Porte de décision (fin septembre).** Si les dix premières minutes ne
> fonctionnent pas avec des inconnus, on ne fabrique pas de contenu
> supplémentaire — on corrige le ressenti. Ajouter des tableaux par-dessus un
> pilotage frustrant ne fait qu'agrandir le problème.

---

## Phase 2 — 21 septembre → 1er novembre : le ressenti et la finition

- [ ] Corriger ce qu'a révélé le playtest nº 1. Priorité absolue aux dix
      premières minutes.
- [ ] **Manette et Steam Deck.** Une visée analogique convient parfaitement à ce
      geste, et la vérification Steam Deck est un vrai levier de visibilité.
- [ ] **Menus et options** : sauvegarde, réglages audio, résolution, sensibilité,
      rappel des commandes. C'est fastidieux, c'est jugé en avis.
- [ ] **Accessibilité de base** : taille de texte, contrastes, option de
      réduction des secousses et des effets lumineux.
- [ ] Contenu de la démo verrouillé et équilibré au banc.
- [ ] **Constituer la banque de clips** au fil du travail : 15 à 30 secondes,
      capturés à chaque session. On ne les fabrique pas en novembre, on les
      accumule à partir de maintenant.

---

## Phase 3 — 2 → 30 novembre : les actifs de vente

La phase que tout le monde sous-estime, et celle qui décide du résultat.

- [ ] **La capsule.** C'est l'image affichée dans chaque liste Steam, et le
      premier filtre de tous les joueurs. **Recommandation ferme : la faire
      faire par un illustrateur** (300–800 €). C'est l'euro le mieux dépensé du
      projet ; c'est aussi le seul actif où « fait maison » se voit
      immédiatement.
- [ ] **Trailer, 60–75 s.** Les cinq premières secondes doivent montrer le verbe :
      un corps d'eau qui s'éjecte et rétrécit. Pas de logo d'ouverture, pas de
      plan d'ambiance avant l'accroche.
- [ ] **8 à 10 captures**, chacune montrant une chose différente (les trois
      états, une aura, l'éponge saturée, le sas).
- [ ] Texte de la page, tags, genres, description courte. Le pitch en une phrase
      existe déjà — l'utiliser tel quel.
- [ ] **Formulaire de contenu IA** rempli (voir plus bas).

---

## Phase 4 — 1er → 20 décembre : la page en ligne et la campagne

- [ ] **Page « Prochainement » publique — au plus tard le 15 décembre.**
- [ ] **Démo web gratuite sur itch.io**, avec bouton vers la liste de souhaits
      Steam. C'est votre avantage structurel : le jeu tourne déjà dans un
      navigateur, les jeux natifs ne peuvent pas offrir ça.
- [ ] Campagne : Reddit (r/IndieGaming, r/gamedev le samedi, r/Games), Bluesky,
      formats courts YouTube/TikTok à partir de la banque de clips.
- [ ] Envoi presse et curateurs. Le jeu a deux angles éditoriaux solides : la
      physique qui produit les règles, et le twist du collecteur.
- [ ] **Objectif chiffré : 2 000 à 4 000 souhaits avant le festival**, pour que
      le festival multiplie au lieu de partir de zéro.

> **Porte de décision (20 décembre).** Si la page n'est pas en ligne, on renonce
> à février et on vise juin 2027. Se présenter au festival sans souhaits
> accumulés, c'est dépenser la carte unique pour la moitié de sa valeur.

---

## Phase 5 — 21 décembre → 25 janvier : la démo

- [ ] **11 janvier : gel des fonctionnalités.** Plus que des corrections.
- [ ] **Playtest nº 2** sur la build de démo réelle, empaquetée, sur une autre
      machine que les vôtres.
- [ ] Inscription au festival dès l'ouverture (~début janvier).
- [ ] **25 janvier : soumission de la démo et de la page à validation.**
      Prévoir une semaine de marge : Valve refuse des builds, et le refus arrive
      sans préavis.

---

## Phase 6 — 22 février → 1er mars : le festival

- [ ] Être présent : créneaux de diffusion en direct, réponse à chaque
      commentaire et chaque avis sur la démo.
- [ ] Correctif à mi-parcours si un blocage remonte — c'est autorisé et c'est
      souvent décisif.
- [ ] Mesurer : conversion démo → souhait, durée de jeu médiane, endroit exact
      où les joueurs s'arrêtent.

---

## Phase 7 — mars → mai : le lancement

- [ ] **La liste de souhaits décide de la date.** Au-dessus de 7 000 fin février,
      on sort 8 à 12 semaines après le festival. En dessous de 5 000, on ne sort
      pas dans le silence : on continue et on repousse.
- [ ] Prix recommandé : **12,99 € / 14,99 $**.
- [ ] Localisation : le jeu est presque sans texte, une dizaine de langues coûte
      quelques centaines d'euros et ouvre les marchés chinois et russe. Un des
      rares gains faciles.

---

## La question de l'exposition IA

Deux sujets distincts, à ne pas confondre.

**L'obligation Steam.** Depuis la réécriture des règles du 16 janvier 2026,
Valve distingue nettement :

- les **outils de développement assistés par IA** — écrire le code — **ne
  demandent aucune déclaration** ;
- le **contenu généré** que le joueur voit — vos textures (`docs/assets-ia.md`),
  et tout visuel de la page boutique ou du matériel promotionnel — **doit être
  déclaré**, et la mention apparaît sur la page du jeu.

Concrètement : les textures sont à déclarer, le code non. À remplir dans le
questionnaire de contenu, sans hésitation — la non-déclaration est un vrai
risque de retrait.

**La question de communication, qui est autre chose.** « Fait avec Claude Code
en quelques semaines » est un angle presse réel, et une part du public réagit
très mal aux jeux associés à l'IA. Les deux sont vrais en même temps. La
décision à prendre en Phase 0 est simple : **on met le jeu en avant, pas sa
méthode de fabrication.** La déclaration légale se fait proprement dans le
formulaire ; la communication parle du fluide, des trois états et du
collecteur. Si un journaliste pose la question, on répond franchement — mais on
ne construit pas la campagne là-dessus, parce qu'un angle qui divise capte
l'attention sur le procédé au lieu du jeu.

---

## Budget

| Poste | Montant |
|---|---|
| Steam Direct | 100 $ *(récupérable)* |
| Capsule par un illustrateur | 300–800 € |
| Musique et complément sonore | 0–1 500 € *(le son procédural couvre déjà beaucoup)* |
| Localisation | 200–500 € |
| Montage du trailer si externalisé | 0–600 € |
| **Total** | **600 à 3 500 €** |

---

## Ce qui manque à l'équipe

Deux personnes couvrent le code et le level design. Le troisième rôle —
**image et mise en marché** (capsule, trailer, page, campagne) — n'est couvert
par personne, et c'est précisément lui qui détermine le résultat commercial.
À arbitrer entre le prendre en charge explicitement à partir de novembre, ou
en sous-traiter la partie visuelle.

---

## Les risques, par ordre d'importance

| Risque | Signal d'alerte | Parade |
|---|---|---|
| Le pilotage frustre les nouveaux joueurs | playtest nº 1, fin septembre | corriger avant de produire du contenu |
| Aucune liste de souhaits au festival | page pas en ligne au 20 décembre | reporter à juin 2027 |
| La capsule ne se distingue pas | comparaison honnête avec dix pages voisines | illustrateur |
| Retard de validation Valve | refus de build fin janvier | soumettre le 18 janvier, pas le 25 |
| Dépendance serveur dans la build vendue | plantage hors ligne | repli nominal, testé en Phase 1 |

---

## Le chemin critique en une ligne

**Playtest fin septembre → page en ligne mi-décembre → démo soumise le
25 janvier.** Tout le reste peut glisser d'une semaine ; ces trois-là, non.
