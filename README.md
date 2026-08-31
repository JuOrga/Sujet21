# Tension de surface

Roguelike ambiant et inertiel : vous êtes un volume d'eau qui s'échappe d'un
laboratoire orbital. En gravité nulle, la seule façon d'avancer est d'éjecter
une partie de soi-même — **se déplacer, c'est rétrécir**.

Le document de référence est [`docs/doc-fonctionnel.md`](docs/doc-fonctionnel.md).

## État : jalon 2 — le premier tableau

Prototype jouable dans le navigateur.

**Jalon 1 — le corps et le geste :**

- solveur de fluide **PBF 2D** (typed arrays, grille spatiale, pas de temps fixe) ;
- **cohésion** par contrainte de densité en égalité + correction tensile —
  l'intensité est le curseur de la décision ouverte n°1 ;
- **propulsion par éjection** à quantité de mouvement exactement conservée (§3.3) ;
- fusion automatique des masses d'eau, identification du corps par **amas
  connexe**, dispersion sous le volume critique (§3.1) ;
- **caméra à zoom automatique** et **time warp** (ne modifie jamais le pas
  physique, §11) ;
- rendu **métaballes** WebGL2 en deux passes, palette froide, trame de repère ;
- **banc de réglage** Tweakpane : tous les paramètres en direct, export/import
  JSON (§13).

**Jalon 2 — le premier tableau (§6, §7) :**

- **matériaux** : parois **hydrophobes** (bande de répulsion + rebond) et
  **hydrophiles** (adhésion, friction tangentielle, décoller se paie) ;
- **l'éponge** : traînée au contact, absorption après un temps de contact
  continu, saturation cellule par cellule — une cellule gorgée devient solide,
  la brèche payée en volume est permanente ;
- **le sas de sortie** et la boucle roguelike : pas d'eau à ramasser, le
  surplus à la sortie est compressé en **bonbonne**, on repart à capacité
  de base ;
- tableau 1 : cloison hydrophobe à deux ouvertures, îlot hydrophile, mur
  d'éponge avec couloir, sas derrière l'éponge ;
- vue d'ensemble dans le banc, `?spawn=x,y` pour itérer sur le level design.

## Lancer

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

**Contrôles** : maintenir le pointeur pour éjecter vers ce point (le corps part
à l'opposé) · `,` / `.` time warp · `espace` pause · `R` recommencer.
Objectif : rejoindre le sas vert avec le plus de volume possible.

## Qualité

```bash
pnpm test        # invariants physiques (Vitest)
pnpm type-check
pnpm build
```

Les tests couvrent : conservation de la quantité de mouvement (au repos et
pendant l'éjection), cohésion en apesanteur, fusion par contact, délai de
réabsorption des gouttelettes, dispersion sous volume critique, exactitude de
la grille spatiale et de l'étiquetage d'amas.

## Apprendre à jouer (renforcement)

Le jeu tourne aussi **sans écran** : `src/rl/` expose le tableau comme un
environnement d'apprentissage (le solveur est déterministe et n'a besoin
d'aucun DOM), avec deux pilotes de référence, un entraînement parallélisé et
la courbe de progression.

```bash
pnpm rl:rejoue --pilote cap --tableaux 21-01          # la référence à la main
pnpm rl:ppo --tableaux 21-01 --travailleurs 8         # PPO : réseau + gradient
pnpm rl:courbe --journal .rl/ppo.json --serie litres  # la progression, en direct
pnpm rl:entraine --tableaux 21-01 --generations 30    # l'ancienne voie, sans gradient
```

L'entraînement ne tient qu'aux **cœurs** de la machine (`--travailleurs`) :
99 % du temps part dans le solveur de fluide, le réseau ne pèse rien — un GPU
n'aurait rien à y faire.

On peut même le **regarder s'entraîner en direct** — `pnpm rl:ppo --sortie
public/agents/live.json` d'un côté, `?agent=./agents/live.json&suivre=2` de
l'autre : le jeu relit la politique toutes les deux secondes et l'agent
s'améliore à l'écran pendant que vous le regardez.

Et on peut le **regarder jouer dans le jeu**, sur n'importe quel tableau :
`/?tableau=3&agent=cap` (le pilote écrit à la main), `?agent=hasard`, ou
`?agent=./agents/berceau.json` pour une politique apprise. La touche `A`
reprend la main.

Tout est expliqué — l'environnement, les mesures de coût, les outils d'un vrai
PPO, ce que l'agent ne joue pas encore — dans
[`docs/apprentissage-par-renforcement.md`](docs/apprentissage-par-renforcement.md).

## Prochains jalons

3. **La chaleur et les états** — carte thermique, glace, vapeur,
   recondensation, refroidissement du vaisseau.
4. **La boucle roguelike** — enchaînement de tableaux distincts, contenu des
   bonbonnes (§8), routes ramifiées, méta-progression.
