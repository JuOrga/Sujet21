# La tranche de la conduite d'ammoniac — plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** relief allumé, la conduite d'ammoniac à pièces a une vraie tranche (bande Blender) ; un test garde les 16 unités de texture de la composition.

**Architecture :** comme la chaudière (#558, `docs/assets-ia.md` §38) : une bande d'une période, bordée de sa répétition, posée au bas de `conduite-atlas` agrandi à 1024×2048 ; `flancPieces` reçoit la sorte 2 (conduite) ; `tranchePieces` se généralise à un atlas passé en paramètre.

**Tech :** GLSL ES 3.0 (gabarits dans `renderer.ts`), TypeScript, Vitest ; Blender (MCP) ; Python (pillow/numpy).

**Spec :** `docs/superpowers/specs/2026-11-17-flancs-formes-design.md`

## Global Constraints

- Aucune nouvelle unité de texture dans la composition (16/16).
- `CONDUITE_ATLAS` (game/formes.ts) est la vérité unique des cadres ; les cadres existants (`corps`, `bout`, `joint`, `givre`, `vanne`) ne bougent pas : on agrandit vers le bas.
- Nouveau cadre `flanc: [16, 1040, 992, 120]`, `hauteur: 2048` ; période de la bande : `FLANC_PIECES.periode` (580 u), jumelle du script.
- Seconde compression des cadres existants mesurée (écart moyen), comme §38 (1,59/255 pour la chaudière).
- Style maison (français, commentaires POURQUOI, commits symptôme/cause/correctif/vérification, aucun identifiant de modèle).
- Outillage : `./node_modules/.bin/{tsc,vitest,vite}` ; Python `/home/julian/projets/tiktok/.venv/bin/python -I`.

## Review Focus

1. Le flip vertical de l'atlas : `atlasCadre` divise aujourd'hui `CN_ATLAS - pa.y` par `CN_ATLAS` (carré). Passé à 1024×2048, toutes les pièces du dessus se liraient de travers si une seule division reste en `CN_ATLAS` — le banc doit montrer le dessus INCHANGÉ.
2. Atlas absent (`uHasFroid` = 0) : aucune tranche, le givre de secours comme avant.
3. Plaque froide à FORME (`tuyau` faux) : jamais de tranche à pièces.
4. Relief éteint : rien ne change, ni coût ni image.
5. Les autres lecteurs de `CONDUITE_ATLAS` (cuiseur de lumière, physique, tests `conduiteRendu.spec.ts`) supposent-ils un carré ?

---

### Task 1 : le garde-fou des 16 unités

**Files :** Create `src/render/unitesTexture.spec.ts`.

- [ ] **Step 1 :** test qui lit `renderer.ts` comme `gradientBoucles.spec.ts`, extrait le gabarit `COMPOSE_FS` (du `const COMPOSE_FS = \`` à sa fermeture), compte les déclarations `uniform … sampler…` hors commentaires, ET celles des morceaux interpolés `${…}` qui en déclareraient (vérifier qu'aucun n'en déclare aujourd'hui ; si un morceau est interpolé, chercher sa définition dans le fichier). `expect(n).toBeLessThanOrEqual(16)` ; second test : `expect(n).toBe(16)` avec un commentaire disant que l'égalité documente l'état au 17/11 et se met à jour quand on libère une unité.
- [ ] **Step 2 :** vérifier qu'il échoue quand on ajoute une 17e déclaration à la main (puis la retirer) — dans les deux sens.
- [ ] **Step 3 : commit.**

### Task 2 : la bande, dans Blender

**Files :** Create `tools/images/blender/flanc_conduite.py` (sur le modèle de `flancs_pieces.py` : unités de jeu, tore de période 1 pour le bruit, `lance`, `MARGE_BANDE`).

Contenu : la conduite vue de côté — le tuyau d'acier givré sur ses plaques, collier/bride tous les ~290 u (deux par période), givre accumulé au pied et coulures de glace, acier froid de la conduite (lire les couleurs de `conduite-atlas.webp`, pas le bleu nuit des parois), aucune lueur. Lumière de la charte, venue du haut.

- [ ] **Step 1 :** rendu basse résolution, `look`, corriger ; vérifier le raccord (vue à x=0 et x=période identiques).
- [ ] **Step 2 :** rendu final → `masters/images/sources/flanc-conduite.png`.
- [ ] **Step 3 :** montrer la bande au concepteur avec la bande `flanc-chaud` à côté pour l'échelle — **attendre son avis.**

### Task 3 : l'atlas agrandi

**Files :** Modify `tools/images/conduite_atlas.py` (mode « repart de l'atlas livré », comme `chaudiere_atlas.py` : les sources ne sont plus sur le poste), `src/game/formes.ts` (`CONDUITE_ATLAS` : `hauteur: 2048`, `flanc`), `tools/images/prepare.py` (taille de la famille de l'atlas), `public/assets/conduite-atlas.webp`.

- [ ] **Step 1 :** le script pose `public/assets/conduite-atlas.webp` en haut d'un 1024×2048 transparent et la bande au cadre `flanc` (16 px de répétition de chaque côté) → `masters/images/conduite-atlas.png` ; `prepare.py conduite-atlas` → dans les seuils ; mesurer et noter l'écart moyen de seconde compression sur la moitié haute.
- [ ] **Step 2 : commit.**

### Task 4 : la tranche au shader

**Files :** Modify `src/render/renderer.ts` : `CONDUITE_GLSL` (`CN_ATLAS_H`, `CN_CADRE_FLANC`) ; `atlasCadre` (flip sur `CN_ATLAS_H`) ; `piecesSdf` (sorte 2 → `conduiteSdf`) ; `tranchePieces(sampler2D tex, vec2 atlas, vec4 cadre, …)` (les deux appels existants passent `uTexChaud, vec2(CH_ATLAS, CH_ATLAS_H)`) ; branche conduite (~l.4048–4085) : un bloc « LA TRANCHE de la conduite » calqué sur celui de la chaudière (~l.3970), garde `uRelief > 0.0 && tuyau && uHasFroid > 0.5`, lueur 0. Tests : `src/render/conduiteRendu.spec.ts`, `reliefParois.spec.ts`, `gradientBoucles.spec.ts` (le nouvel appel est dans la boucle des boîtes : `textureGrad` seulement).

- [ ] **Step 1 :** test dans `conduiteRendu.spec.ts` : `CONDUITE_ATLAS.hauteur === 2048`, le cadre `flanc` tient dans l'atlas et ne recoupe aucun autre cadre.
- [ ] **Step 2 :** implémenter ; `tsc` 0 ; `vitest run` code 0.
- [ ] **Step 3 :** banc (`tools/banc-tableau/`, mémoire « banc : ports et relief » — port neuf, blocs en bord de vue) : un tableau à conduite, relief FORT, avant/après ; le dessus de la conduite identique, la tranche visible ; relief éteint identique à `dev`.
- [ ] **Step 4 : commit.**

### Task 5 : doc, vérification, aperçu, PR

- [ ] **Step 1 :** `docs/assets-ia.md` §38 : la conduite (bande, cadre, script, écart mesuré) ; la garde des 16 unités citée.
- [ ] **Step 2 :** `tsc` 0, `vitest run` code 0, `vite build` OK.
- [ ] **Step 3 :** aperçu (`previsu-go` après vérification, sinon `gh workflow run deploy.yml --ref claude/flancs-formes -f cible=previsualisation`) → adresse au concepteur, avec le tableau où voir une conduite.
- [ ] **Step 4 :** PR `claude/flancs-formes` → `dev`.
