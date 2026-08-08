# Tension de surface

Roguelike ambiant et inertiel : vous êtes un volume d'eau qui s'échappe d'un
laboratoire orbital. En gravité nulle, la seule façon d'avancer est d'éjecter
une partie de soi-même — **se déplacer, c'est rétrécir**.

Le document de référence est [`docs/doc-fonctionnel.md`](docs/doc-fonctionnel.md).

## État : jalon 1 — le corps et le geste

Prototype jouable dans le navigateur :

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

## Lancer

```bash
pnpm install
pnpm dev        # http://localhost:5173
```

**Contrôles** : maintenir le pointeur pour éjecter vers ce point (le corps part
à l'opposé) · `,` / `.` time warp · `espace` pause · `R` recommencer.

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

## Prochains jalons

2. **Le premier tableau** — parois hydrophiles/hydrophobes, éponge à
   saturation, sas de sortie, boucle entrée → traversée → surplus.
3. **La chaleur et les états** — carte thermique, glace, vapeur,
   recondensation, refroidissement du vaisseau.
4. **La boucle roguelike** — enchaînement de tableaux, bonbonnes, routes
   ramifiées, méta-progression.
