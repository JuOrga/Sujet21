# Le volume des parois — conception

14/11/2026. Branche `claude/volume-parois`, issue de `claude/apercu-quatre-chantiers`
(401cc0a = dev + #514–#517, dont les surfaces Blender de #516). La PR vers
`dev` ne part qu'après la fusion de ces quatre PR. Relue par un agent
« constructeur » ; ses neuf questions sont tranchées ci-dessous (par le
concepteur, ou par l'orchestrateur, et c'est dit).

## L'intention

Le concepteur, le 14/11 : « les éléments, bloc, paroi etc manquent de volume
même si c'est vue du dessus ». Les blocs, les parois et les plaques du tableau
doivent se lire comme des **objets épais, posés dans la cuve**, et non comme des
aplats collés sur le fond. C'est vrai caméra immobile, et plus encore quand elle
se déplace.

## Ce qui existe aujourd'hui (relevé du 14/11, `src/render/renderer.ts`)

- **Le relief 2.5D** (≈ l. 2646-2834). Le sommet de chaque solide est déplacé de
  `relDisp = (world − uCenter) · uRelief`, et le flanc (la tranche) est peint
  entre la base et le sommet. Il est éteint par défaut : `main.ts` ≈ 4218-4226,
  `RELIEF_K = { off: 0, leger: 0.035, fort: 0.07 }`, réglage « Relief des
  parois » (`#params-relief`, clé `sujet21-relief`).
- **Les défauts du relief vus par le concepteur** :
  1. les flancs ne portent pas la texture de l'élément. Ce sont des teintes
     calculées par matière, avec des strates, des joints et des rivets ;
  2. certains éléments n'ont pas de flanc du tout, « comme les hydro »
     (hydrophile `mat 1`, hydrophobe `mat 2`). Le code les compte pourtant
     comme solides : la cause est à trouver.
- **Le défaut que le concepteur a pressenti** (vérifié dans le code) : la
  physique s'appuie sur la BASE (`d`), mais le fluide se peint APRÈS les
  solides (≈ l. 3412 et suivantes), par-dessus tout. Avec le relief, du côté où
  le sommet déborde au-delà du pied, le fluide qui touche le pied se peint sur
  le dessus du mur.
- **L'ombre autour des solides** (≈ l. 2780) est un halo SYMÉTRIQUE de 56 u,
  peint même lumière éteinte. Il détache, mais ne dit pas la hauteur.
- **Les ombres des lampes sont cuites au sol** dans une carte de lumière (le
  « cuiseur », ≈ l. 4060-4300) : elles tombent à l'opposé de chaque lampe, et
  leur longueur suit la hauteur des blocs et celle de la lampe. Les hauteurs
  sont `HAUTEUR_BLOCS = 140` et `HAUTEUR_COQUE = 2400` pour la forme coque des
  tableaux en modules (`renderer.ts:96-102`). Le dessus des blocs n'est ombré
  par aucun voisin.
- **Le dessus d'un solide** est un aplat de texture, éclairé uniformément selon
  la distance aux lampes (`lumHaut`). Son seul modelé est un biseau mou
  (≈ l. 3368-3385) : ±30 % sur 30 u, côté lampe.
- **Les textures de surface ont leur lumière peinte dedans** :
  `chaud_tole.py:598-617` (`lumiere_camera`, appelée par `surfaces.py:573`)
  rend la couleur sous un soleil « haut » incliné de 50°. Les rivets et les
  tôles y ont déjà un côté clair et un côté sombre.
- **Les 16 unités de texture** du shader de composition sont toutes prises
  (≈ l. 6729-6766), et WebGL2 n'en garantit que 16.
- La conduite d'ammoniac et la chaudière (`aPieces`) ont leur propre relief
  composé, exempté du biseau et de la tranche génériques, avec des gardes
  (`conduiteRendu.spec.ts`). Les éponges ont leur passe et leur ombre cuite. La
  paroi de la cuve est peinte à part (`drawHull`, ≈ l. 6935). Les décalques sont
  peints après la composition (`drawDecals`, ≈ l. 6787).

## Les décisions du concepteur

- Faire les quatre volets ci-dessous.
- **Le pied du mur est la zone de contact** : là où le pied est caché par le
  sommet, le fluide passe SOUS le mur, pas dessus (« Sinon, cela pose
  problème »).
- **Le relief 2.5D reste éteint par défaut pour l'instant** (« Par défaut non
  pour l'instant »). Le volume doit donc venir des volets 2, 3 et 4 À EUX SEULS,
  relief éteint, et rester juste relief allumé.
- **Les surfaces sont re-rendues dans Blender sous une lumière neutre**, avec le
  même dessin et le même acier. Ce sont les lampes du jeu qui les sculptent
  (#516 n'a pas encore été vu en jeu : rien de validé n'est perdu).
- **Des solides qui se touchent ou se recouvrent partagent la plus grande de
  leurs hauteurs.** Un objet d'un seul tenant se lit comme un seul objet, et la
  hiérarchie se voit entre éléments séparés.
- **La paroi de la cuve** reçoit le chanfrein et l'ombre de contact (volet 2),
  sans hauteur ni relief.

## Les objectifs

### Volet 2 — l'épaisseur, même caméra immobile

- **Un chanfrein franc** sur le pourtour du dessus de chaque solide, en
  remplacement du biseau mou de 30 u. C'est une bande nette, comme une plaque
  d'acier dont l'arête est coupée : claire côté lumière, sombre à l'opposé,
  séparée du dessus par une arête lisible.
- **Un liseré de lumière** sur l'arête vive tournée vers la lumière.
- **Une ombre de contact** serrée et sombre au pied, côté sol.
- **Une ombre courte de lisibilité**, décalée à l'opposé de la lumière, d'une
  longueur qui suit la hauteur de l'élément. Elle remplace le halo symétrique.
  La carte cuite reste (l'ombre longue des lampes) et les deux ne doublent pas
  l'ombre là où elles se superposent.
- **La direction de la lumière** est la direction dominante des lampes
  (`lampeDir`). Lumière éteinte, c'est une direction par défaut, celle du soleil
  de l'atelier (venant du haut de l'écran) : le volume ne disparaît pas avec la
  lumière.
- **La paroi de la cuve** (`drawHull`) reçoit le chanfrein et l'ombre de contact
  sur son bord intérieur.

### Volet 4 — des hauteurs selon l'élément

- La hauteur devient une propriété **par solide**, tirée de sa matière par une
  table, sans changer le format des tableaux et sans saisie dans l'éditeur. Les
  trois rangs (valeurs exactes au constructeur) :
  - **hauts** : mur neutre et ses habillages, surchauffeur ;
  - **moyens** : hydrophile, hydrophobe, membrane, miroir, évent ;
  - **bas, mais pas nuls** : rideau, vitre, plaque froide à forme, grilles. Ils
    gardent un flanc, un chanfrein et une ombre de contact, car un élément qui
    arrête le fluide ne doit jamais se lire comme un sol.
- **Les solides qui se touchent ou se recouvrent partagent la plus grande de
  leurs hauteurs** (décision du concepteur), calculée une fois au chargement du
  tableau. La règle pure vit dans un module testé.
- **La coque** (forme coque des tableaux en modules) garde `HAUTEUR_COQUE` pour
  la lumière cuite. Pour l'image (flanc, ombre courte), sa hauteur est bornée à
  celle d'un mur haut, sinon son ombre noierait la salle.
- La hauteur pilote : la longueur du flanc au relief, la longueur de l'ombre
  courte, la carte cuite, et la lumière reçue par le dessus.
- **Un dessus bas reçoit l'ombre d'un voisin plus haut** : l'hypothèse « aucun
  n'ombre le toit d'un autre » tombe.

### Volet 3 — les surfaces sculptées par les lampes

- Les surfaces de l'atelier (`tools/images/blender/surfaces.py`,
  `habillages.py` : `wall`, `wall-a`, `phile`, `phobe`, les huit habillages de
  `paroi-atlas` ; `tank-bg` s'il en tire profit) sont **re-rendues sous une
  lumière neutre**, avec le même dessin, le même acier, le même cadrage et le
  même raccord. Leurs mesures de `prepare.py` sont refaites (la luminance des
  parois du 13/11 sert de repère).
- On rend aussi leur **relief** depuis la même scène, en hauteurs ou en
  normales, au choix du constructeur. Comme aucune unité de texture n'est libre,
  le relief est **rangé dans le canal alpha** de l'image de couleur, qui est
  opaque aujourd'hui. Les familles de `prepare.py` sont adaptées.
- Le shader éclaire le DESSUS des solides par les lampes avec ce relief : rivets,
  tôles, joints et coutures prennent la lumière d'un côté et l'ombre de l'autre.
  Les flancs peuvent en profiter aussi.
- Le « froid » n'a plus de texture de surface (`conduite-atlas` a remplacé
  `froid.webp`) : il sort de ce volet.

### Volet 1 — le relief 2.5D, réparé (derrière son réglage)

- **Le contact reste au pied.** La physique ne change pas.
- **Le sommet cache ce qu'il recouvre.** Là où le sommet déplacé couvre le sol
  au-delà du pied, il masque le fluide, ses éclaboussures, ses reflets et ses
  ondes. Du côté où le pied se voit, le fluide touche le bas du flanc.
- **Chaque flanc porte la texture de son élément**, projetée le long de l'arête
  (abscisse) et de la hauteur (ordonnée), assombrie vers le pied et éclairée
  selon la lumière (la règle « la tranche regarde la lampe » reste).
- **Aucun solide n'est sans flanc** : on trouve pourquoi les hydro n'en ont pas,
  puis on passe en revue chaque matière. Seules exceptions : la conduite et la
  chaudière (relief composé) et les éponges (passe à part).
- **Ce qui est posé sur un dessus** : les décalques plaqués sur un mur suivent
  son sommet. Les étiquettes de l'interface restent où elles sont. Les éponges ne
  changent pas, et c'est dit comme limite connue (choix de l'orchestrateur).
- Le relief reste éteint par défaut ; le réglage permet de l'essayer.

## Les non-objectifs

- Toucher à la physique, aux collisions, aux règles, au format des tableaux.
- Un vrai moteur 3D, ou une caméra inclinée.
- Changer le rendu du fluide lui-même, hors de son masquage sous les sommets.
- Changer le DESSIN des surfaces (seules leur lumière de rendu et leur relief
  changent).
- Allumer le relief par défaut.

## Les anti-objectifs (échec même si ça marche)

- **Un joueur qui ne sait plus où le fluide touche.** Le pied, côté visible,
  doit être net (ombre de contact) et le fluide doit visiblement s'y arrêter.
- **Une baisse de cadence** sur Steam Deck ou sur un portable modeste.
- **Des surfaces re-rendues qui changent d'identité** (autre dessin, autre
  teinte), ou qui deviennent plates et grises une fois la lumière peinte
  retirée.
- **Des flancs ou des reliefs qui jurent** avec l'acier de l'atelier.
- **De la couleur chaude** hors de ce qui luit (charte : palette froide).
- **Un mal de mer à la caméra** : relief allumé, il reste doux et se fond au zoom
  de carte comme aujourd'hui.
- **Une régression de la conduite, de la chaudière et des éponges**, avec leurs
  gardes vertes.

## Les contraintes

- Règles du dépôt (`CLAUDE.md`) : tout en français, commentaires qui disent
  POURQUOI, commits « symptôme / cause / correctif / vérification », aucun chiffre
  non mesuré, aucun nom de modèle ni ligne d'attribution. Vérifications avant
  chaque poussée : `./node_modules/.bin/tsc --noEmit`,
  `./node_modules/.bin/vitest run`, `./node_modules/.bin/vite build`. Jamais
  `npm exec pnpm`.
- Le shader du tableau vit dans un seul gros fichier, `src/render/renderer.ts`.
  Les gardes du dépôt lisent sa source en texte ; les nouvelles gardes en feront
  autant. Les règles pures (hauteur par matière, partage des hauteurs, direction
  et longueur d'ombre) sortent dans un module testable, comme `fusion.ts`.
- **Un seul agent sur Blender** (MCP). Pour l'atelier et ses pièges, voir
  `docs/assets-ia.md` (§17, §18, §24, §35, §36) et la note « chantier Blender » ;
  le Python avec pillow est `/home/julian/projets/tiktok/.venv/bin/python -I`.
- **La cadence se mesure** avant et après avec l'outillage de performance du
  dépôt (`src/bench`, `ops/LISEZ-MOI.md`, gâchette `perf-sync-go`). La cible
  est un surcoût du rendu du tableau d'au plus 10 % sur la référence mesurée.
  Le concepteur juge le Deck sur l'aperçu. Aucun nouveau réglage n'est créé, sauf
  si la mesure le rend nécessaire : les volets 2 et 4 sont toujours actifs, le
  volet 3 suit le réglage « Lumière », le volet 1 suit « Relief ».
- **La vérification visuelle est le point dur.** Le jeu demande WebGL2 et les
  captures sans tête sortent blanches. Une piste notée sur ce poste : le
  renderer a `preserveDrawingBuffer: true`, et on peut recopier le canvas WebGL
  dans un canvas 2D réduit puis en tirer un `toDataURL`. Sinon, l'aperçu
  `previsu-go` est regardé par le concepteur. Le constructeur dit honnêtement ce
  qui a été vu et ce qui a été déduit.

## Les choix de l'orchestrateur

- La hiérarchie des hauteurs (hauts / moyens / bas non nuls) et le rang de
  chaque matière ; la coque bornée à un mur haut pour l'image.
- L'ombre courte de lisibilité, dans la composition, plutôt qu'un cuiseur plus
  net ; la direction par défaut lumière éteinte.
- Le relief rangé dans l'alpha des surfaces (aucune unité de texture libre).
- La cadence : mesure avant/après, une cible à 10 %, pas de nouveau réglage
  d'office.
- L'ordre : volet 2, puis 4 (ce que tout le monde verra, relief éteint) ; le
  rendu Blender du volet 3 en parallèle dès le départ, puis sa lecture au
  shader ; le volet 1 en dernier. Une seule branche et une seule PR, avec des
  commits par volet.
- Relief allumé : les décalques suivent le sommet, les étiquettes et les éponges
  ne bougent pas.

## Ce qui reste au constructeur

- Le diagnostic des flancs absents, et la projection exacte des textures sur les
  flancs.
- La technique de masquage du fluide sous les sommets.
- Les largeurs, intensités et longueurs (chanfrein, liseré, ombres), les
  valeurs exactes des trois rangs de hauteur, le format du relief (hauteurs ou
  normales dans l'alpha), la technique d'ombre d'un toit sur un autre. Tout cela
  sous la contrainte de cadence.
- Les tests : chaque correctif de comportement (fluide masqué, flanc présent
  pour chaque matière, hauteur par matière et partage, ombre lumière éteinte)
  vient avec le test qui tombe sans lui.
