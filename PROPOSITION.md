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
| **M1 — Chaleur** | carte thermique, radiateurs, cryobaies ; états **glace** (trajectoire engagée) et **vapeur** (poussée explosive, perte définitive) | traverser un même tableau par 3 routes selon l'état |
| **M2 — Boucle roguelike** | enchaînement de tableaux, retour à capacité de base, surplus → bonbonnes, recondensation sur parois froides (perte 40–50 %) | une partie complète de 15–20 min |
| **M3 — Le vaisseau vivant** | refroidissement global, obstacles chimiques restants (hydrophile/phobe, filtres, champs), routes ramifiées | la pression temporelle se lit sans chronomètre |
| **M4 — Méta & narration** | bonbonnes typées (§8), déblocage des origines (§9.3), registres du labo, son | le contrat « hors protocole = déplacé, pas raccourci » est vérifiable |

Chaque jalon reste jouable de bout en bout ; le banc de réglage est l'outil
de recette de chacun.

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

## 5. Prochaine étape immédiate

Jouer la slice, trancher la décision n°1 (cohésion) au banc de réglage,
puis lancer M1 (la chaleur) — c'est elle qui déverrouille les deux autres
états et donc l'essentiel du level design.
