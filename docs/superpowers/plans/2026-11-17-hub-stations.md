# Les stations du hub — plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** cinq pièces de machinerie (Blender) deviennent des sortes de décor de l'éditeur ; une pièce près d'une station en panne s'assombrit ; un plafond du hub.

**Architecture :** une sorte de décalque = une ligne dans six listes (type, lecture, éditeur ×2, renderer, noms des fichiers livrés). La panne pose un drapeau d'exécution `panne` sur le décalque dans `appliqueReparations` (clone, jamais écrit dans un fichier) ; le shader des décalques l'éteint. Les images sortent de `tools/images/blender/hub_stations.py`, passent par `prepare.py`.

**Tech :** TypeScript strict, Vitest, WebGL2 ; Blender (MCP) + Cycles ; Python (pillow/numpy) pour `prepare.py`.

**Spec :** `docs/superpowers/specs/2026-11-17-hub-stations-design.md`

## Global Constraints

- Tout en français, commentaires qui disent POURQUOI ; messages de commit : symptôme, cause, correctif, vérification ; aucun identifiant de modèle dans le code/commits/PR.
- Sortes : `hub-eclairage`, `hub-table-depart`, `hub-mur-records`, `hub-bac-sable`, `hub-distillateur` ; fichiers `public/assets/<sorte>.webp`.
- Tailles : `hub-eclairage`, `hub-bac-sable`, `hub-distillateur` 1024×1024 ; `hub-table-depart` 1536×512 ; `hub-mur-records` 1536×439 ; `plafond-hub` à la taille des autres `plafond-*.webp` (la lire).
- Panne : zone = plot de la station ± 400 (la règle des écrans) ; rendu : luminance ×0,45, désaturé de 35 %.
- Ne PAS toucher `TABLEAU_HUB_COMPACT`, `ops/hub-compact.json`, ni pousser `maj-hub-go`.
- Outillage : `./node_modules/.bin/tsc --noEmit -p .`, `./node_modules/.bin/vitest run`, `./node_modules/.bin/vite build` (lien `node_modules` déjà posé) ; jamais `npm exec pnpm`. Python : `/home/julian/projets/tiktok/.venv/bin/python -I`.
- Lire le code de sortie et « Test Files » de vitest, pas seulement « N passed ».

## Review Focus

1. Un tableau sauvegardé avec une pièce `hub-*` se relit sans rejet (`levelIO`), et l'éditeur la propose — un oubli dans une seule des listes écarte la pièce en silence.
2. Le drapeau `panne` ne doit jamais finir dans un fichier exporté ni dans la bibliothèque (l'éditeur exporte le tableau brut, pas le clone dégradé) — test.
3. Station réparée → la pièce redevient normale (pas de drapeau résiduel) ; station retirée de l'accident (`enAvarie: false`) → jamais assombrie.
4. Une pièce posée à plus de 400 du plot d'une station en panne ne bouge pas ; une pièce non `hub-*` (vanne, tuyaux) près du plot ne s'assombrit pas.
5. Image absente (avant livraison) : le chargeur tolère, rien ne casse.

---

### Task 1 : les cinq sortes et le plafond, de bout en bout

**Files :**
- Modify : `src/game/level.ts` (`DecalDef['kind']` ~l.360 ; `PLAFONDS_CONNUS` ~l.416 : ajouter `'hub'`)
- Modify : `src/game/levelIO.ts` (`SORTES` ~l.527)
- Modify : `src/editor/editor.ts` (`DECAL_SORTES` ~l.262, `DECAL_NOMS` ~l.273)
- Modify : `src/render/renderer.ts` (`FICHIER_DECAL` ~l.6111)
- Modify : `src/game/assetsLivres.ts` (noms lisibles des cinq fichiers et de `plafond-hub.webp`)
- Modify : `tools/images/prepare.py` (famille « décalque » : ajouter `'hub-*'`)
- Test : `src/game/levelIO.spec.ts`

**Interfaces — Produces :** `DecalDef['kind']` accepte les cinq sortes ; noms d'éditeur : « Hub — réseau d'éclairage », « Hub — table de départ », « Hub — mur des records », « Hub — bac d'essai », « Hub — distillateur ».

- [ ] **Step 1 : test qui échoue** — dans `levelIO.spec.ts`, `it('relit les cinq pièces du hub sans les écarter')` : un tableau minimal portant un décalque de chacune des cinq sortes (w/h > 0) ; `expect(lu.decals.map(d => d.kind)).toEqual([...cinq])` et `expect(rejets).toEqual([])` (suivre la forme des tests de décalques voisins du fichier).
- [ ] **Step 2 :** `./node_modules/.bin/vitest run src/game/levelIO.spec.ts` → FAIL (sortes écartées).
- [ ] **Step 3 :** ajouter les sortes dans les six listes ci-dessus ; commentaire au type : posées par l'admin, jamais synthétisées.
- [ ] **Step 4 :** `./node_modules/.bin/tsc --noEmit -p .` → 0 erreur (le compilateur exige `FICHIER_DECAL` et `DECAL_NOMS` complets) ; le test → PASS.
- [ ] **Step 5 : commit.**

### Task 2 : la pièce d'une station en panne s'assombrit

**Files :**
- Modify : `src/game/level.ts` (`DecalDef` : `panne?: boolean`, commenté « drapeau d'exécution, posé par appliqueReparations, jamais lu ni écrit par levelIO »)
- Modify : `src/game/reparations.ts` (~l.247, à côté des écrans)
- Modify : `src/render/renderer.ts` (`DECAL_FS` : `uniform float uPanne;` ; dessin ~l.8355 : `gl.uniform1f(du['uPanne'], d.panne ? 1 : 0)`)
- Test : `src/game/reparations.spec.ts`

**Interfaces — Consumes :** les sortes de la Task 1. **Produces :** `DecalDef.panne?: boolean`.

- [ ] **Step 1 : tests qui échouent** (dans `reparations.spec.ts`, à la manière du test des écrans ~l.127) :
  - `pièce hub-* à ≤ 400 du plot d'une station en panne → panne === true` ;
  - `même pièce, station réparée → panne absent` ;
  - `pièce à 401+ du plot → panne absent` ; `vanne près du plot → panne absent` ;
  - `station enAvarie:false → panne absent` ;
  - `le tableau d'entrée n'est pas muté` (le décalque source n'a pas `panne`).
- [ ] **Step 2 :** vitest sur le fichier → FAIL.
- [ ] **Step 3 :** dans `appliqueReparations`, pour TOUTE station en panne qui a un plot (pas seulement `eteintEcrans`), marquer `{ ...d, panne: true }` les décalques dont `kind.startsWith('hub-')` et dont le centre est dans le plot ± 400 ; factoriser le test de zone avec celui des écrans (une fonction `presDuPlot(d, plot, 400)`).
- [ ] **Step 4 :** shader : `if (uPanne > 0.5) c = mix(c, vec3(dot(c, vec3(0.299, 0.587, 0.114))), 0.35) * 0.45;` après le refroidissement ; poser `uPanne` à chaque décalque (et à 0 dans le second appel ~l.8448).
- [ ] **Step 5 :** test `levelIO` : un tableau dont un décalque porte `panne: true` se relit SANS le drapeau (Review Focus 2). Vitest → PASS ; tsc → 0.
- [ ] **Step 6 : commit.**

### Task 3 : les cinq pièces et le plafond, dans Blender

**Files :**
- Create : `tools/images/blender/hub_stations.py` (méthode : `docs/assets-ia.md` §35 et la mémoire de l'atelier : rendus par `bpy.app.timers`, `exec` du script dans le même appel, Cycles OptiX, caméra ortho de FACE, fond transparent, avant en y négatif)
- Create : `masters/images/hub-*.png`, `masters/images/plafond-hub.png`
- Create (par `prepare.py`) : `public/assets/hub-*.webp`, `public/assets/plafond-hub.webp`

Contenu de chaque pièce : les descriptions de §20a–e et §21b (`docs/assets-ia.md` l.864–1002) font foi — aucun texte ni chiffre, cadrans vierges, sarcelle `#63b7e6` en liseré seulement, ambre `#e8951f` en veilleuse seulement. Acier : celui de la chaufferie/des équipements déjà rendus (reprendre les matières de `equipements.py`/`vanne.py`). Matière polie de face : spéculaire bridé (`Specular IOR Level` ~0,1).

- [ ] **Step 1 :** écrire le script, une fonction par pièce + `lance(nom)` ; rendre en basse résolution, regarder chaque pièce (`look`), corriger.
- [ ] **Step 2 :** rendu final aux tailles des Global Constraints dans `masters/images/`.
- [ ] **Step 3 :** `/home/julian/projets/tiktok/.venv/bin/python -I tools/images/prepare.py hub-eclairage` (etc.) → chaque image dans les seuils de sa famille ; hors seuil : on refait.
- [ ] **Step 4 :** montrer les six images au concepteur (planche contact) — **attendre son avis** avant la Task 4.
- [ ] **Step 5 : commit** (script, masters, webp).

### Task 4 : la doc, la vérification, l'aperçu, la PR

- [ ] **Step 1 :** `docs/assets-ia.md` §20 et §21b : livrées dans Blender (script, date), posées par l'admin dans l'éditeur (groupe Décor), assombries en panne ; `docs/assets-chantier.md` : C1–C5, C7 livrés.
- [ ] **Step 2 :** `./node_modules/.bin/tsc --noEmit -p .` (0), `./node_modules/.bin/vitest run` (code 0, « Test Files » sans échec), `./node_modules/.bin/vite build` (succès).
- [ ] **Step 3 :** aperçu : `git fetch origin previsu-go`, vérifier que personne d'autre n'y travaille (mémoire « previsu-go partagée »), sinon `gh workflow run deploy.yml --ref claude/hub-stations -f cible=previsualisation` ; donner l'adresse au concepteur avec le mode d'emploi (éditeur → Décor → poser une pièce au hub).
- [ ] **Step 4 :** PR `claude/hub-stations` → `dev`.
