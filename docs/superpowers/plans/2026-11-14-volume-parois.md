# Le volume des parois — plan d'exécution

> **Pour les agents qui exécutent :** SOUS-COMPÉTENCE REQUISE : superpowers:subagent-driven-development.
> Les étapes se cochent (`- [ ]`). Chaque tâche est relue avant la suivante de son lot.

**Le but :** que les blocs, les parois et les plaques du tableau se lisent comme des objets épais,
caméra immobile et relief 2.5D éteint, et que le relief, une fois allumé, soit juste.

**L'architecture :** un module pur `src/render/volume.ts` (hauteurs par matière, partage des
hauteurs, lumière par défaut), tenu par ses tests, que le shader consomme par une table de hauteurs
par boîte. Deux lots en parallèle :
- **R** (le rendu), séquentiel dans un seul arbre, parce que tout passe par `renderer.ts` ;
- **B** (Blender), seul sur le MCP, qui re-rend les surfaces et leur relief.

**La pile :** TypeScript strict, WebGL2 (GLSL ES 3.0, dans `src/render/renderer.ts`), Vitest
(les gardes lisent la source en texte), Blender + Cycles par le MCP, Python + pillow
(`tools/images/prepare.py`).

**La conception :** `docs/superpowers/specs/2026-11-14-volume-parois-design.md` (relue par un
constructeur ; ses décisions et les choix de l'orchestrateur y sont écrits). **Tout agent la lit
avant sa tâche.**

## Les contraintes globales

- Tout en français ; commentaires qui disent POURQUOI ; commits « symptôme / cause / correctif /
  vérification », un par idée, **sans nom de modèle ni ligne d'attribution** ; aucun chiffre non
  mesuré.
- Avant chaque poussée : `./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/vitest run`,
  `./node_modules/.bin/vite build`. Jamais `pnpm` ni `npm exec`. Jamais une branche rouge poussée.
  Jamais `git add -A` (`node_modules` est un lien non suivi).
- Le filtre rtk réécrit certaines sorties (`git log --format`, `git diff`, `sed`, `cat`) : pour lire
  un message ou un diff brut, utiliser `rtk proxy git …` ; ne jamais assembler un fichier par
  `sed -n … > f`.
- La physique et le format des tableaux ne changent pas. Le relief reste éteint par défaut.
- La conduite, la chaudière (`aPieces`) et les éponges gardent leur rendu ; leurs gardes
  (`conduiteRendu.spec.ts` et autres) restent vertes sans retouche.
- Palette froide ; l'or et l'ambre seulement pour ce qui luit.
- Un seul agent sur Blender.

## Le point de vigilance des relectures

1. **Le contact du fluide au pied.** L'ombre de contact et le chanfrein ne doivent jamais faire
   croire que le fluide s'arrête ailleurs qu'à la base. C'est vérifié en R1 et en R4.
2. **La lumière éteinte** (réglage « Lumière » sur off) : le volume tient avec la direction par
   défaut, et rien ne s'éteint en noir. C'est vérifié en R1.
3. **Les tableaux en modules** (coque à `HAUTEUR_COQUE`) : aucune salle noyée d'ombre. C'est
   vérifié en R2.
4. **Les images encore anciennes**, opaques et sans relief dans l'alpha : la lecture du relief
   (R3) retombe sur un dessus plat, sans artefact. C'est testé en R3.
5. **Le zoom de carte et les très grands tableaux** (le plafond de boîtes, `budgets.spec.ts`) : la
   table des hauteurs tient dans le budget d'uniformes. C'est vérifié en R0 et R2.

---

## Lot R — le rendu (`claude/volume-parois`, arbre `.claude/worktrees/volume`)

### R0 : le contrat des hauteurs
**Fichiers :** créer `src/render/volume.ts` et `src/render/volume.spec.ts`.
**Produit :**
```ts
export type RangHauteur = 'haut' | 'moyen' | 'bas'
export const RANG_DE_MATIERE: Record<number, RangHauteur>   // codes `mat` du shader, cf. conception (volet 4)
export const HAUTEUR_DE_RANG: Record<RangHauteur, number>   // valeurs au constructeur ; 'bas' > 0
export function hauteurPropre(mat: number, forme: number): number // la coque bornée à HAUTEUR_DE_RANG.haut
export function hauteursPartagees(boites: ReadonlyArray<{ x0: number; y0: number; x1: number; y1: number; mat: number; forme: number; angle: number }>): Float32Array
export const LUMIERE_PAR_DEFAUT: readonly [number, number]   // direction (monde) lumière éteinte : « du haut de l'écran »
```
`hauteursPartagees` regroupe les solides qui se touchent ou se recouvrent (boîtes orientées ; une
tolérance d'un pixel de jeu), et donne à chaque groupe la plus grande hauteur. Le sas, le vide et
la baie (non solides) ont une hauteur 0 et ne propagent rien.
**Tests (vus rouges, puis verts) :**
- chaque `mat` solide a un rang, et aucun rang n'a une hauteur nulle ;
- un mur seul vaut `haut`, un hydrophobe seul vaut `moyen`, un rideau seul vaut `bas` ;
- un plancher mur + rideau + hydrophobe bout à bout donne trois `haut` ;
- deux blocs séparés d'un jour gardent chacun leur hauteur ;
- une boîte tournée de 45° qui touche un mur se joint à lui ;
- une coque ne dépasse jamais `HAUTEUR_DE_RANG.haut` ;
- le sas, le vide et la baie valent 0 et ne joignent pas deux groupes ;
- `LUMIERE_PAR_DEFAUT` est unitaire.
- [ ] Tests, rouge, module, vert, les trois vérifications globales, commit, push.

### R1 : l'épaisseur (volet 2) et le banc du tableau
**Fichiers :** `src/render/renderer.ts` (composition : halo ≈ l. 2780, biseau ≈ l. 3368-3385 ;
`drawHull` pour la paroi de la cuve), `src/render/volume.spec.ts` ou une garde
`src/render/epaisseur.spec.ts` ; outil `tools/banc-tableau/`.
- **D'abord, le banc du tableau** (borné à environ une heure). Il faut une capture du tableau en jeu
  sans tête : construire, servir par `vite preview`, ouvrir un tableau avec Playwright (emprunté à
  `/home/julian/projets/PasMoi/node_modules/playwright-core`, comme `tools/banc-ceremonie/`), puis
  recopier le canvas WebGL (`preserveDrawingBuffer: true`) dans un canvas 2D et en tirer un
  `toDataURL`. Essayer aussi `--use-gl=angle --use-angle=swiftshader`. S'il marche, il est commité
  avec son mode d'emploi. S'il ne marche pas, le dire, et la vérification visuelle passe par
  l'aperçu (`previsu-go`, voir la fin).
- **Le shader :**
  - le chanfrein franc remplace le biseau mou ;
  - un liseré clair sur l'arête vive côté lumière ;
  - une ombre de contact serrée au pied ;
  - l'ombre courte décalée à l'opposé de la lumière, de longueur proportionnelle à la hauteur
    (`HAUTEUR_BLOCS` en attendant R2), qui remplace le halo symétrique et ne double pas la carte
    cuite ;
  - lumière éteinte (`uLumiere < 0.5`), la direction est `LUMIERE_PAR_DEFAUT` (en uniforme) ;
  - la paroi de la cuve : chanfrein et ombre de contact sur son bord intérieur.
- **Gardes (texte de la source, comme `conduiteRendu.spec.ts`) :**
  - le halo symétrique `smoothstep(0.0, 56.0, max(d, 0.0))` a disparu ;
  - l'ombre courte et le chanfrein restent exemptés pour `aPieces` ;
  - la branche lumière éteinte lit la direction par défaut ;
  - `drawHull` peint le chanfrein.
- [ ] Banc (ou constat d'échec), gardes, rouge, shader, vert, captures regardées (Read) si le banc
  marche, les trois vérifications, commit, push.

### R2 : les hauteurs par élément (volet 4)
**Fichiers :** `renderer.ts` (la table de hauteurs par boîte en uniforme : vérifier le budget
d'uniformes avec `budgets.spec.ts` ; la carte cuite ≈ l. 4060-4300 et `hautMax` ≈ l. 6253 ;
`lumHaut` ≈ l. 2486-2501), là où les boîtes sont envoyées au shader.
- La table vient de `hauteursPartagees`, calculée au chargement du décor (comme la carte cuite).
- La hauteur pilote : l'ombre courte, la carte cuite (chaque boîte à sa hauteur ; la coque garde
  `HAUTEUR_COQUE` pour la carte, bornée pour l'image) et la lumière du dessus.
- **Un dessus bas reçoit l'ombre d'un voisin plus haut** : la technique est au choix (une seconde
  carte cuite « toits », ou une lecture de la carte à la hauteur du toit…), sous contrainte de
  cadence.
- **Gardes :** la table de hauteurs arrive au shader ; la carte cuite lit la hauteur par boîte et
  ne lit plus la constante seule ; un test pur montre qu'un toit `moyen` voisin d'un `haut` reçoit
  de l'ombre, si la règle est sortie en TypeScript.
- [ ] Gardes, rouge, implémentation, vert, captures (un tableau ordinaire et un tableau en modules)
  si le banc marche, les trois vérifications, commit, push.

### R3 : les surfaces sculptées par les lampes (volet 3, partie shader)
**Prérequis :** la livraison de B1 fusionnée dans `claude/volume-parois`.
- Le dessus des solides `wall`, `wall-a`, `phile`, `phobe` et des habillages lit le relief dans
  l'alpha de sa texture : une normale (dérivée des hauteurs, ou décodée), éclairée par `lampeDir`
  (ou la direction par défaut) ; seulement si « Lumière » est actif.
- **Une image encore opaque** (alpha = 1 partout) donne un dessus plat, sans artefact.
- **Gardes :** les échantillons de ces textures lisent `.a` pour le relief ; une image opaque donne
  une normale (0, 0, 1) (règle pure testée si elle sort en TypeScript).
- [ ] Gardes, rouge, implémentation, vert, captures si possible, les trois vérifications, commit,
  push.

### R4 : le relief 2.5D réparé (volet 1)
- **Le fluide sous les sommets** : là où le sommet déplacé couvre le sol (`d > 0` et `dV ≤ 0`), le
  fluide, ses éclaboussures, ses reflets et ses ondes ne se peignent pas. La technique est au
  choix (dans la passe de composition, ou par un masque si une autre passe est en cause).
- **Les flancs texturés** : la texture de la matière, projetée sur l'arête et la hauteur, assombrie
  au pied, éclairée selon la lumière ; un relief dans l'alpha est permis.
- **Les flancs absents** (hydrophile, hydrophobe…) : diagnostic écrit dans le commit, correctif,
  puis revue de chaque `mat` solide.
- **Les décalques plaqués sur un mur suivent son sommet** (`drawDecals`) ; les étiquettes et les
  éponges ne bougent pas (limite écrite).
- La valeur par défaut reste `off` : une garde vérifie `?? 'off'` sur `sujet21-relief`.
- **Gardes :** la composition du fluide est masquée par le sommet déplacé ; chaque `mat` solide hors
  `aPieces` a sa branche de flanc ; le défaut reste `off`.
- [ ] Gardes, rouge, implémentation, vert, captures relief « léger » et « fort » si possible, les
  trois vérifications, commit, push.

---

## Lot B — Blender (`claude/volume-blender`, issue de `claude/volume-parois`, seul sur le MCP)

Méthode : l'atelier `tools/images/blender/` (`surfaces.py`, `habillages.py`, `chaud_tole.py`
`lumiere_camera`) ; `docs/assets-ia.md` §17, §18, §24, §35, §36 et la note « chantier Blender »
(rendus par `bpy.app.timers` via `lance()`, `exec` du script dans le même appel MCP, Cycles OptiX,
chemins `\\wsl.localhost\Ubuntu\…`) ; Python `/home/julian/projets/tiktok/.venv/bin/python -I`.

### B1 : les surfaces sous lumière neutre, avec leur relief dans l'alpha
- Une lumière de rendu NEUTRE : pas de soleil directionnel qui sculpte, mais un éclairage uniforme
  qui garde l'acier, sa teinte et sa matière, sans le côté clair et le côté sombre peints. Ajoutée à
  l'atelier comme une option (`lumiere_neutre()`), sans casser les rendus existants des autres
  pièces.
- Le relief rendu depuis la même scène (une passe de hauteur ou de normales, cadrage et raccord
  identiques), rangé dans le canal alpha de la même image.
- Les surfaces : `wall`, `wall-a`, `phile`, `phobe`, puis les huit habillages de `paroi-atlas`. Pour
  `tank-bg`, seulement si le fond en tire profit (à dire).
- `prepare.py` : les familles de ces surfaces acceptent un alpha qui porte du relief (pas une
  transparence) ; les mesures (luminance, raccord, poids) sont refaites et écrites. Le raccord du
  relief se mesure comme celui de la couleur.
- `docs/assets-ia.md` : une §37 « Les surfaces sous lumière neutre et leur relief ».
- **Jugement visuel** : chaque surface, avant et après, côte à côte, sous un éclairage simulé de
  quatre directions (avec le relief). Elle doit garder son identité, sans devenir plate ni grise.
- **Test :** une garde Vitest lit l'en-tête WebP de chaque surface livrée et exige un canal alpha
  (VP8X avec alpha), aux mêmes dimensions qu'avant.
- [ ] Rendre, assembler, livrer, mesurer, juger, la garde, les trois vérifications, un commit par
  famille de surfaces, push.

---

## Les étapes de l'orchestrateur

- [ ] Créer l'arbre de B (`claude/volume-blender`) ; lancer R0 et B1 en parallèle.
- [ ] Relire chaque tâche, puis fusionner B1 dans `claude/volume-parois` avant R3.
- [ ] **Mesure de cadence** : avant R1, puis après R4, un aperçu `previsu-go` (vérifier d'abord qui
  occupe la gâchette) ; demander au concepteur un rapport de performance en jeu, sur le même
  tableau et la même machine, puis le rapatrier (gâchette `perf-sync-go`). La cible est un surcoût
  d'au plus 10 %. Au-delà, on en parle avant de couper.
- [ ] Une relecture finale de la branche ; un aperçu final ; la mise à jour de la mémoire.
- [ ] La PR `claude/volume-parois` → `dev`, seulement après la fusion de #514–#517. On ne fusionne
  pas vers `prod`.
