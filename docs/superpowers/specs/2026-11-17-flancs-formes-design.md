# La tranche de la conduite d'ammoniac, et la garde des 16 unités

*Conception courte, 17/11/2026 — branche `claude/flancs-formes`.*

## Pourquoi

Suite de #558 (tranches de la chaudière et du surchauffeur à pièces). Relief
2.5D allumé, la conduite d'ammoniac soulève encore son image sans rien entre
pied et dessus.

## La contrainte qui décide de tout

Le shader de composition lit **16 textures** — exactement le minimum que
WebGL2 garantit. Une 17e passe sur une carte à 32 unités (le poste du
concepteur) et **ne compile pas** sur une machine à 16 (téléphones, Intel
intégré, Mac, Chrome sous Windows) : la cuve ne s'affiche pas, sans que rien
ne le signale en développement. Aucune nouvelle texture, donc : les bandes
vont dans les atlas existants.

## Ce qu'on fait

1. **Un test garde-fou** : il compte les textures déclarées par le shader de
   composition et échoue au-delà de 16.
2. **La conduite d'ammoniac** : `conduite-atlas` passe de 1024² à 1024×2048 ;
   au bas, une bande `flanc-conduite` rendue dans Blender (même méthode que
   `flancs_pieces.py` : une période, bordée de sa propre répétition), lue par
   le chemin des tranches à pièces (`tranchePieces`).

## Approches considérées

- **Bandes dans les atlas existants — retenue** : zéro unité de texture.
- Une nouvelle texture « flancs » : écartée, c'est la 17e unité.
- Libérer des unités (tableau de textures pour les atlas de même taille) :
  faisable, mais touche tout le rendu ; pas maintenant.

## Ce qu'on ne fait pas

- **Les éléments à forme** (plaque froide, chaudière, surchauffeur, membrane,
  miroir) : leur DESSUS est calculé (givre, rayures, serpentin, trame, poli)
  — vérifié dans la composition le 17/11, contrairement à ce que la première
  version de cette note disait. Une tranche Blender sous un dessus calculé
  jurerait ; ils gardent leur tranche calculée, cohérente avec leur dessus
  (choix du concepteur, 17/11).
- **Le rideau** : pas pour l'instant (concepteur, 17/11) ; il garde sa
  tranche calculée.
- Les angles du chanfrein aux jonctions (« plus tard », 16/11).

## Vérification

`pnpm type-check`, `pnpm test`, `pnpm build` ; banc de captures sur les
tableaux où ces éléments se voient, relief allumé ; seconde compression des
atlas mesurée (comme §38) ; le concepteur juge sur l'aperçu.
