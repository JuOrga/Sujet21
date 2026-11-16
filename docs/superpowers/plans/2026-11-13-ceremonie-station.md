# La cérémonie « station » — plan d'exécution

> **Pour les agents qui exécutent :** SOUS-COMPÉTENCE REQUISE : superpowers:subagent-driven-development
> (recommandé) ou superpowers:executing-plans, tâche par tâche. Les étapes se cochent (`- [ ]`).

**Le but :** refaire la mise en scène des écrans de récompense (`#mb-veil`) et des fins de partie dans
le vocabulaire d'une station spatiale. Les assets sont tous rendus dans Blender, et les icônes Blender
remplacent les émojis dans tout le jeu.

**L'architecture :** quatre contrats posés d'abord par l'orchestrateur (Tâche 0) :

- deux modules d'images, `iconesStation.ts` et `ceremonieObjets.ts` ;
- une voix sonore, `sonsCeremonie.ts` ;
- les familles de `prepare.py`.

Ensuite, des lots parallèles travaillent chacun dans leur arbre, sur une branche issue de
`claude/ceremonie-station`, et l'orchestrateur fusionne entre les vagues. Les règles du jeu ne
bougent pas : seuls le DOM, la feuille inline et les images changent.

**La pile :** TypeScript strict, Vite, Vitest (sans navigateur : les gardes lisent `index.html` et
`main.ts` en texte), Web Audio, Blender + Cycles par le MCP, Python + pillow (`prepare.py`), le banc
Chromium sans tête (`tools/banc-ceremonie/`).

**La conception :** `docs/superpowers/specs/2026-11-13-ceremonie-station-design.md` (approuvée le
13/11/2026) et son inventaire `docs/superpowers/specs/2026-11-13-ceremonie-inventaire.md`. La maquette
de direction est `docs/superpowers/specs/ceremonie/direction-maquette.html`. **Tout agent lit la
conception avant sa tâche.**

## Les contraintes globales

- Tout est en français : le code, les commentaires, les commits, les PR. Les commentaires disent
  POURQUOI.
- Un commit = une idée. Son message raconte le symptôme, la cause, le correctif et la vérification
  (voir `git log`). Il ne contient **aucun nom de modèle et aucune ligne d'attribution**, ni dans les
  commits, ni dans le code, ni dans les PR.
- On n'annonce aucun chiffre sans l'avoir mesuré (poids, durées, pixels).
- Les vérifications avant chaque poussée, depuis la racine de l'arbre :
  `./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/vitest run`, `./node_modules/.bin/vite build`.
  **Jamais** `npm exec pnpm` ni `pnpm` (pnpm 12 réinstalle et élague `node_modules`). On ne pousse
  jamais une branche rouge.
- Dans un arbre neuf : `ln -s /home/julian/projets/sujet21/node_modules node_modules`.
  esbuild : `/home/julian/projets/sujet21/node_modules/.pnpm/node_modules/.bin/esbuild`.
- Un correctif de comportement arrive avec le test qui tombe sans lui. On le vérifie dans les deux
  sens : test rouge sans le correctif, vert avec.
- On ne pousse **jamais** sur `dev` ni sur `prod`. On ne fusionne pas vers `prod`. La PR finale va
  vers `dev`, et seulement après la fusion de #514–#517, sur lesquelles la branche est empilée.
- `previsu-go` est partagée avec d'autres agents. Avant toute poussée forcée : `git fetch origin
  previsu-go` et vérifier le commit présent.
- **Un seul agent tient Blender** (MCP `mcp__blender__*`) : le lot B.
- **Aucune image générée** n'est ni créée ni réemployée (`meta-icones`, `badge`, `fiole-*`, `iris`,
  `cine/*`…). Ce qui sort de l'atelier `tools/images/blender/` est réutilisable.
- Les couleurs : palette froide. L'ambre et l'or sont réservés à ce qui luit (veilleuses, primes,
  paliers, rang S). Les teintes de rang restent celles de `ceremonie.ts` (S `#ffd977`, A `#6dffb8`,
  B `#63b7e6`, C `#a9c3de`, D `#e0685c`). Les bandes de danger sont en ocre terni (`mat_rayures`).
- Les polices restent Michroma et IBM Plex Mono. Aucune étiquette sous 10 px × `--ui`.
- La cérémonie ne s'allonge pas : `TEMPS_BILAN.versement ≤ 4900` ms. Chaque étape se passe d'un geste
  (clic, toucher, Entrée, Espace, A à la manette).
- Rien ne déborde à 1280×720 ni à 1280×800. Chaque animation a son repli
  `prefers-reduced-motion: reduce`.
- La manette (`pad-vise`), le clavier et le doigt (`porteArmee.ts`) ne doivent pas casser.
- Le code de la cérémonie vit dans `src/main.ts`, de `mbMontreChoixPalet` (≈ l. 14407) à
  `montreMiseEnBonbonne` (≈ l. 17370). Sa feuille vit dans `index.html`, entre
  `/* ==== LA CÉRÉMONIE DE FIN DE SALLE` et `/* ---- Le panneau du GÉNÉRATEUR`. Un lot ne touche que
  les fonctions et les règles de ses étapes (voir chaque tâche).
- Le banc de la cérémonie, depuis la racine de l'arbre :

  ```bash
  ./node_modules/.bin/vite build && (./node_modules/.bin/vite preview --port 5291 --strictPort &)
  /home/julian/projets/sujet21/node_modules/.pnpm/node_modules/.bin/esbuild tools/banc-ceremonie/fabrique.ts \
    --bundle --format=iife --outfile=tools/banc-ceremonie/fabrique.js
  node tools/banc-ceremonie/banc-ceremonie.cjs 5291        # captures/ + mesures.json
  ```

  `fabrique.js` et `captures/` ne se commitent pas. Toute étape dont le DOM change met sa pose à jour
  dans `tools/banc-ceremonie/poses.js`, recopiée à la lettre du nouveau gabarit de `main.ts`.
- Les gardes lisent `main.ts` et `index.html` en texte. `corps(nom)` et `regle(sélecteur)` sont les
  aides déjà écrites dans `ceremonie.spec.ts` (le bloc « le choix de la salle tient dans l'écran ») :
  on les remonte en tête de fichier pour les partager.

## Le point de vigilance des relectures

Cinq cas que la conception implique sans qu'aucun test d'étape les exerce, du plus probable au moins
probable :

1. **Une image absente ou pas encore chargée** (le lot B en retard, un réseau lent, un nom mal
   orthographié). La cérémonie doit rester lisible : l'alvéole ou la silhouette tient la place, le
   chiffre et le nom restent, rien ne se décale. Testé en Tâche 0 (le gabarit HTML ne dépend pas du
   chargement) et en F1 (les primitives ont un fond propre, l'image s'ajoute par-dessus).
2. **Les gestes en rafale.** Entrée tenue, double clic ou A martelé pendant le bilan. On saute UNE
   étape et une seule : le versement ne se choisit pas tout seul, et un minuteur du bilan qui tombe
   après le saut ne réécrit rien. Testé en F2.
3. **« Moins d'animations »** (réglage du jeu ou du système). Chaque nouvelle animation des primitives
   et des étapes a son repli. Testé en F1, étendu par chaque lot d'étape.
4. **Un instrument sans case** : une carte « perso » de l'éditeur, avec un émoji tapé par le
   concepteur, ou un instrument ajouté plus tard. L'émoji (ou le nom) revient, jamais un carré vide.
   Testé en Tâche 0.
5. **Le son coupé ou indisponible** (pas d'`AudioContext`, son désactivé, volume à 0). Aucune voix ne
   part, aucune exception ne remonte. Testé en S1.

---

## Vague 0 — les contrats (l'orchestrateur, sur `claude/ceremonie-station`)

### Tâche 0 : les contrats d'images et de son

**Fichiers :**
- Créer : `src/game/iconesStation.ts`, `src/game/iconesStation.spec.ts`
- Créer : `src/game/ceremonieObjets.ts`, `src/game/ceremonieObjets.spec.ts`
- Créer : `src/game/sonsCeremonie.ts` (le type et la table vide ; S1 les remplit)
- Modifier : `src/game/audio.ts` (une méthode `ceremonie` qui, pour l'instant, ne fait rien)
- Modifier : `src/main.ts` (une ligne `sonCeremonie` près de `const bande`, ≈ l. 788)
- Modifier : `index.html`, près de `.ico-meta` (≈ l. 5083) : les règles `.ico-ceremonie`,
  `.ico-instrument`, `.ico-sceau`
- Modifier : `tools/images/prepare.py` (`FAMILLES`) : quatre familles

**Les interfaces :**
- Produit (`iconesStation.ts`) :
  ```ts
  export const ICONES_CEREMONIE = ['condensat','memoire','tirage','orbe','livre','reserve','maitrise',
    'instruments','chrono','note','secours','profondeur','repos','don','rencontre','cache','economat',
    'carte','danger','couperet','palet','rafales','orbites','cibles','minijeu','contrepartie'] as const
  export type IconeCeremonie = (typeof ICONES_CEREMONIE)[number]
  export const ICONES_CEREMONIE_URL = '/assets/ceremonie-icones.webp' // 7 × 4 cases de 512², ordre ci-dessus
  export const ICONES_CEREMONIE_COLONNES = 7
  export const ICONES_CEREMONIE_RANGEES = 4
  export function iconeCeremonieHTML(id: IconeCeremonie, titre?: string): string
  export const ICONES_INSTRUMENTS_URL = '/assets/instruments-icones.webp' // 8 × 4 cases de 256²
  export const ICONES_INSTRUMENTS_COLONNES = 8
  export const ICONES_INSTRUMENTS_RANGEES = 4
  /** l'ordre des cases : INSTRUMENTS puis CONTREPARTIES, tel que le catalogue les range au 13/11 */
  export const ORDRE_INSTRUMENTS: readonly string[]
  export function caseInstrument(id: string): number | null
  export function iconeInstrumentHTML(d: Pick<InstrumentDef, 'id' | 'icone' | 'nom'>): string
  /** au canvas : dessine la case si l'image est prête et l'instrument a sa case ; sinon false */
  export function dessineIconeInstrument(ctx: CanvasRenderingContext2D, planche: HTMLImageElement | null,
    id: string, x: number, y: number, cote: number): boolean
  ```
  Les sept `Gain['cle']` de `recolte.ts` (`livre`, `condensat`, `memoire`, `maitrise`,
  `instruments`, `tirage`, `orbe`) font partie de `IconeCeremonie`.
- Produit (`ceremonieObjets.ts`) :
  ```ts
  export const SCEAUX_URL = '/assets/ceremonie-sceaux.webp' // 3 × 2 cases de 512² : S A B C D module
  export const ORDRE_SCEAUX: readonly (Rang | 'module')[] = ['S', 'A', 'B', 'C', 'D', 'module']
  export function sceauHTML(s: Rang | 'module'): string
  export interface Fenetre { x: number; y: number; l: number; h: number } // en fractions de l'image
  export interface ObjetCuve { dos: string; verre: string; largeur: number; hauteur: number; liquide: Fenetre }
  export const OBJETS: Record<'bonbonne' | 'reserve' | 'maitrise', ObjetCuve>
  export function cuveHTML(o: keyof typeof OBJETS, idLiquide: string): string
  export const ANNEAU_URL = '/assets/ceremonie-anneau.webp' // 2 × 1 cases de 512² : intact, brisé
  export const SCENES_FIN = { bouclee: '/assets/fin-capsule.webp', perdue: '/assets/fin-fiole-brisee.webp' } as const
  ```
  Les valeurs de `OBJETS` posées ici sont provisoires : 512×1024 et une fenêtre de liquide
  `{ x: 0.3, y: 0.2, l: 0.4, h: 0.65 }`. **Seul le lot B les remplace**, par les mesures de ses
  rendus (B3).
- Produit (`sonsCeremonie.ts` + `audio.ts` + `main.ts`) :
  ```ts
  export type VoixCeremonie = 'compteur' | 'sceau' | 'cartouche' | 'deversement' | 'palier' | 'elu' | 'levier'
  // audio.ts, classe AudioFx :
  ceremonie(voix: VoixCeremonie, force = 1): void
  // main.ts :
  const sonCeremonie = (voix: VoixCeremonie, force = 1): void => audio.ceremonie(voix, force)
  ```
- Produit (`index.html`) : `.ico-ceremonie`, `.ico-instrument` et `.ico-sceau`. Ce sont des `<i>`
  carrés à 1 em, dont le fond est la planche, placés par `--ic-x` / `--ic-y` (même principe que
  `.ico-meta`). Sous la planche, une **alvéole hexagonale** en `clip-path`, d'un gris-bleu à 25 %,
  garde la place visible si l'image manque.
- Produit (`prepare.py`) : les familles `planche de cérémonie` (`ceremonie-icones`,
  `ceremonie-sceaux`, `ceremonie-anneau`), `planche des instruments` (`instruments-icones`),
  `objet de cérémonie` (`ceremonie-*-dos`, `ceremonie-*-verre`) et `scène de fin` (`fin-*`, 1600×900).
  On copie les plafonds de chauds par défaut. Le lot B ajuste les poids quand il les a **mesurés**.
  Les familles s'insèrent **avant** les motifs génériques qui accepteraient ces noms.

- [ ] **Étape 1 : écrire les tests qui tombent**

```ts
// iconesStation.spec.ts
import { CONTREPARTIES, INSTRUMENTS } from './instruments'
it('donne une case à chaque instrument et à chaque contrepartie, une seule fois', () => {
  const ids = [...INSTRUMENTS, ...CONTREPARTIES].map((d) => d.id)
  expect(new Set(ORDRE_INSTRUMENTS).size).toBe(ORDRE_INSTRUMENTS.length)
  for (const id of ids) expect(caseInstrument(id), id).not.toBeNull()
  expect(ORDRE_INSTRUMENTS.length).toBeLessThanOrEqual(ICONES_INSTRUMENTS_COLONNES * ICONES_INSTRUMENTS_RANGEES)
})
it('rend l’émoji d’un instrument sans case — jamais un carré vide', () => {
  const html = iconeInstrumentHTML({ id: 'perso-x', icone: '🦑', nom: 'Seiche' })
  expect(html).toContain('🦑')
  expect(html).not.toContain('ico-instrument')
})
it('rend la case d’un instrument connu, placée par --ic-x / --ic-y, sans émoji', () => {
  const d = INSTRUMENTS[9]
  const html = iconeInstrumentHTML(d)
  expect(html).toContain('ico-instrument')
  expect(html).toContain(`--ic-x:${9 % 8}`)
  expect(html).toContain(`--ic-y:${Math.floor(9 / 8)}`)
  expect(html).not.toContain(d.icone)
})
it('tient les 26 icônes de cérémonie dans la planche 7 × 4', () => {
  expect(ICONES_CEREMONIE.length).toBe(26)
  expect(iconeCeremonieHTML('cibles')).toContain('--ic-x:2') // case 23 : colonne 2, rangée 3
  expect(iconeCeremonieHTML('cibles')).toContain('--ic-y:3')
  expect(iconeCeremonieHTML('orbe', 'Orbe')).toContain('title="Orbe"')
})
it('ne dessine rien au canvas tant que la planche n’est pas prête', () => {
  const ctx = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D
  expect(dessineIconeInstrument(ctx, null, INSTRUMENTS[0].id, 0, 0, 32)).toBe(false)
  expect(ctx.drawImage).not.toHaveBeenCalled()
})
// ceremonieObjets.spec.ts
it('range les sceaux dans l’ordre des rangs, le module en dernier', () => {
  expect(ORDRE_SCEAUX).toEqual(['S', 'A', 'B', 'C', 'D', 'module'])
  expect(sceauHTML('module')).toContain('--ic-x:2')
  expect(sceauHTML('module')).toContain('--ic-y:1')
})
it('garde chaque fenêtre de liquide dans son image', () => {
  for (const [nom, o] of Object.entries(OBJETS)) {
    const f = o.liquide
    expect(f.x, nom).toBeGreaterThanOrEqual(0)
    expect(f.y, nom).toBeGreaterThanOrEqual(0)
    expect(f.x + f.l, nom).toBeLessThanOrEqual(1)
    expect(f.y + f.h, nom).toBeLessThanOrEqual(1)
  }
})
it('pose le liquide ENTRE le dos et le verre', () => {
  const html = cuveHTML('bonbonne', 'mb-eau')
  const iDos = html.indexOf(OBJETS.bonbonne.dos), iEau = html.indexOf('id="mb-eau"'), iVerre = html.indexOf(OBJETS.bonbonne.verre)
  expect(iDos).toBeGreaterThan(-1)
  expect(iDos).toBeLessThan(iEau)
  expect(iEau).toBeLessThan(iVerre)
})
```

- [ ] **Étape 2 : lancer les tests et les voir tomber.** Commande :
  `./node_modules/.bin/vitest run src/game/iconesStation.spec.ts src/game/ceremonieObjets.spec.ts`.
  Attendu : ÉCHEC (modules introuvables).
- [ ] **Étape 3 : écrire les deux modules, `sonsCeremonie.ts`, la méthode muette, la ligne de
  `main.ts`, les règles CSS et les familles.** `ORDRE_INSTRUMENTS` est écrit en toutes lettres,
  sans être dérivé du catalogue : une case ne doit pas changer de dessin quand un instrument
  s'insère au milieu. `iconeInstrumentHTML` porte `title="${nom}"` et `aria-hidden` sur l'icône.
- [ ] **Étape 4 : relancer.** Même commande. Attendu : VERT. Puis les trois vérifications globales,
  et `python -I tools/images/prepare.py --help`
  (`/home/julian/projets/tiktok/.venv/bin/python`) pour voir que le script se charge encore.
- [ ] **Étape 5 : commit et poussée** de `claude/ceremonie-station`.

---

## Vague 1 — trois lots en parallèle (chacun sur sa branche issue de `claude/ceremonie-station`)

### Lot B — Blender (`claude/ceremonie-blender`), seul à tenir Blender

Méthode commune à B1–B5 :

- `docs/assets-ia.md` : §35 (le module 2D), §17 (les livraisons), §18 et §24 (les surfaces et
  l'atlas du 13/11).
- L'atelier est `tools/images/blender/surfaces.py`, réemployé par `exec`, comme le fait
  `habillages.py`. Le rendu se lance par `bpy.app.timers` via `lance()`, et le `exec` du script se
  fait dans le même appel MCP. Cycles OptiX ; les chemins sont `\\wsl.localhost\Ubuntu\…`.
- Le Python est `/home/julian/projets/tiktok/.venv/bin/python -I`.
- On livre par `tools/images/prepare.py`. Les masters vont où le dit §17.
- Le code nouveau va dans **`tools/images/blender/ceremonie.py`** : l'atelier des pictogrammes, des
  sceaux et des objets, et l'assemblage des planches hors de Blender, en mode `python -I`, comme
  `habillages.py`. Les scènes de fin vont dans **`tools/images/blender/fins.py`**.
- La lumière, l'acier et le grain sont **ceux de `surfaces.py`** : c'est l'anti-objectif « des images
  qui jurent avec le fond de cuve ».
- Les icônes sont lisibles à 32 px. On le vérifie par une planche réduite, qu'on regarde avec `look`
  ou `Read`.
- Chaque tâche ajoute ses fichiers à la liste `LIVREES` de `src/game/ceremonieObjets.spec.ts`. Le
  test `it.each(LIVREES)('livre %s', (u) => expect(existsSync('public' + u)).toBe(true))` est créé
  par B1. Chaque tâche ajoute aussi un paragraphe dans une **§36 « La cérémonie station »** de
  `docs/assets-ia.md`, qui dit quoi, où, comment le refaire et les poids mesurés.
- Chaque tâche finit par `prepare.py` (sans alerte), les trois vérifications globales et un commit
  par planche. Le lot pousse sa branche après chaque tâche, pour que l'orchestrateur puisse fusionner
  au fil de l'eau.

#### B1 : l'atelier des pictogrammes et la planche de cérémonie
- Créer : `tools/images/blender/ceremonie.py`, `public/assets/ceremonie-icones.webp` (3584×2048,
  transparente)
- Consomme : l'ordre `ICONES_CEREMONIE` de la Tâche 0. La case `i` est en colonne `i % 7`, rangée
  `⌊i / 7⌋`. Les deux dernières cases restent vides.
- Le langage : des objets de station en acier, pas des pictos plats. Condensat : une goutte sous
  verre. Mémoire : un cristal. Orbe : une sphère dans une cage. Réserve : un bocal. Livré : la
  bonbonne. Maîtrise : une colonne cerclée. Chrono : un manomètre à aiguille. Note : une réglette.
  Secours : une ampoule de vie. Danger : un triangle à bandes. Les cinq mini-jeux sont lisibles par
  leur objet : couperet, palet, rafales (ventilateur), orbites, cibles.
- [ ] Rendre, assembler, livrer par `prepare.py`, vérifier à 32 px, créer le test `LIVREES`
  (voir la méthode commune), commit.

#### B2 : les sceaux
- `public/assets/ceremonie-sceaux.webp` (1536×1024, cases dans l'ordre `ORDRE_SCEAUX`).
- Des médaillons octogonaux en **acier neutre, sans teinte** : la couleur vient du CSS
  (`--mb-rang`). Chaque rang a sa gravure de régime : du lisse (S, superfluide) au strié figé (D).
  Le sceau de module porte le plan octogonal d'un module.
- [ ] Rendre, livrer, ajouter à `LIVREES`, commit.

#### B3 : la bonbonne, les deux cuves et l'anneau
- `public/assets/ceremonie-{bonbonne,reserve,maitrise}-{dos,verre}.webp` et
  `ceremonie-anneau.webp` (1024×512 : intact, brisé).
- Le dos est l'ossature et l'intérieur sombre ; le verre est le reflet et les montants avant. Le
  liquide CSS passera entre les deux. La colonne de maîtrise porte trois anneaux de palier vides.
- **Mesurer** dans le rendu la fenêtre où le liquide se voit, en fractions de l'image, et
  **remplacer les valeurs provisoires de `OBJETS`** dans `src/game/ceremonieObjets.ts` (largeur,
  hauteur, `liquide`). C'est le seul fichier de code que le lot B touche, avec sa liste `LIVREES`.
- [ ] Rendre, livrer, mesurer, mettre à jour `OBJETS`, relancer `ceremonieObjets.spec.ts` (attendu :
  VERT), commit.

#### B4 : la planche des instruments
- `public/assets/instruments-icones.webp` (2048×1024, ordre `ORDRE_INSTRUMENTS` : 24 instruments
  puis 7 contreparties, la case 32 vide).
- Chaque instrument est un objet de l'atelier qui dit son effet (lentille de visée → une lunette ;
  ballast → un lest ; éclateur → une charge…). Le nom et la description de `instruments.ts`
  guident le dessin. Les contreparties sont du même acier, mais abîmées (fuite, fêlure, encrassement).
- [ ] Rendre, livrer, ajouter à `LIVREES`, commit.

#### B5 : les deux scènes de fin
- Créer : `tools/images/blender/fins.py`, `public/assets/fin-capsule.webp` (la bonbonne scellée qui
  part en capsule, la station derrière) et `fin-fiole-brisee.webp` (l'échantillon perdu : une fiole
  brisée dans le noir), en 1600×900.
- Le bas du cadre reste sombre : le relevé s'y pose (E2).
- [ ] Rendre, livrer, ajouter à `LIVREES`, commit.

### Lot F — la fondation et le cœur (`claude/ceremonie-coeur`) : étapes 1 à 4

Le lot touche, dans `main.ts` : `montreMiseEnBonbonne`, `mbFigeBilan`, `mbMontreVersement`,
`mbPeintEtal`, `mbAnimeEtalonnage`, `mbPalierEclair`, `mbVerseXp`, `mbMontreDraft`, `carteHTML`
et `mbGainHTML`. Dans `index.html` : la coque `#mb-veil` et les règles de ces étapes. Les images
absentes (le lot B tourne en même temps) sont référencées sous leur nom final : l'alvéole ou la
silhouette CSS de la Tâche 0 tient leur place.

Chaque geste sonne par `sonCeremonie`, selon cette table (les stings restent pour le rang ≥ 4 ★,
le record et le palier) :

| Geste | Voix |
| --- | --- |
| un compteur qui roule (litres, gains, maîtrise) | `compteur` |
| le sceau qui tombe, le tampon RECORD | `sceau` |
| une cartouche de gain qui se pose | `cartouche` |
| l'orbe du surplus qui se déverse | `deversement` |
| un anneau de palier qui se brise | `palier` |
| la carte élue au tirage | `elu` |
| le levier pressé (passer, continuer) | `levier` |

#### F1 : le vocabulaire
- Modifier : `index.html`, en tête de la section de la cérémonie : les primitives, en variables
  (`--mb-chanfrein`, et les gris-bleus codés en dur nommés en variables). Ce sont `.mb-coupe`
  (chanfrein symétrique), `.mb-coupe-diag` (deux coins opposés), `.mb-poutre` (titre effilé,
  rivets, deux bandes de danger), `.mb-cartouche` (chanfrein, liseré de couleur à gauche, alvéole
  hexagonale), `.mb-sceau` (octogone, l'image de B2 et un calque teinté par `--mb-rang`),
  `.mb-mano` (arc SVG gradué, rempli par `--mb-mano-p` de 0 à 1) et `.mb-levier` (bouton biseauté).
- Modifier : `tools/banc-ceremonie/banc-ceremonie.cjs`, pour qu'il lise `BANC_TAILLE` (`1280x720`
  par défaut, ou `1280x800`) et `BANC_MOINS=1` (`reducedMotion: 'reduce'`). Il écrit dans
  `captures/<taille>[-moins]/`.
- Test (dans `ceremonie.spec.ts`) :

```ts
describe('la cérémonie — le vocabulaire de la station', () => {
  const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')
  const css = HTML.slice(HTML.indexOf('/* ==== LA CÉRÉMONIE DE FIN DE SALLE'), HTML.indexOf('/* ---- Le panneau du GÉNÉRATEUR'))
  const regle = (s: string): string => { const d = css.indexOf(`\n      ${s} {`); expect(d, s).toBeGreaterThan(-1); return css.slice(d, css.indexOf('}', d)) }
  it('taille ses cadres au chanfrein, pas à l’arrondi', () => {
    for (const s of ['.mb-coupe', '.mb-coupe-diag', '.mb-cartouche', '.mb-levier', '.mb-sceau', '.mb-poutre'])
      expect(regle(s), s).toMatch(/clip-path:\s*polygon\(/)
    expect(regle('.mb-levier')).not.toMatch(/border-radius:\s*999/)
  })
  it('donne un repli « moins d’animations » à chaque primitive animée', () => {
    const moins = css.slice(css.lastIndexOf('prefers-reduced-motion: reduce'))
    for (const s of ['.mb-sceau', '.mb-cartouche', '.mb-poutre', '.mb-levier', '.mb-mano']) expect(moins, s).toContain(s)
  })
})
```

- [ ] Écrire le test, le voir tomber, écrire les primitives et le banc, le voir passer, faire les
  trois vérifications globales, commit.

#### F2 : le bilan « SALLE FRANCHIE » (étape 1)
- Modifier : la coque `#mb-releve` dans `index.html`, `montreMiseEnBonbonne`, `mbFigeBilan` et la
  pose `bilan` de `poses.js`.
- Créer : `src/game/cartouches.ts`, avec `cartoucheHTML(g: Gain, i: number): string`. Il remplace
  `mbGainHTML` (il en sort pour être testé, et le lot M le réemploie). Son contenu : l'icône par
  `iconeCeremonieHTML(g.cle)`, le gros chiffre `.mb-cartouche-val` et le nom. `g.role` et
  `g.detail` passent dans `title`. Pas de solde sous forme de phrase : `solde.valeur` en petit
  chiffre, si présent.
- La mise en scène :
  - la bannière devient une `.mb-poutre` ;
  - `#mb-rang` devient un `.mb-sceau` (`sceauHTML(verdict.rang)`) qui tombe ;
  - au centre, `cuveHTML('bonbonne', 'mb-eau')`, cerclée d'un `.mb-mano` (`#mb-mano`, la part
    livrée) ;
  - à droite, `#mb-l` en très grand et, dessous, `#mb-ligne` : chrono et note en une ligne, avec
    les icônes `chrono` / `note`, ou le tampon RECORD s'il y a record ;
  - `#mb-lignes` (les barres de 6 px) et `#mb-recolte-titre` disparaissent ;
  - les cartouches claquent une à une à `TEMPS_BILAN.condensat + 170·i` ms.
  - `TEMPS_BILAN` peut être resserré, jamais allongé.
- Le saut au geste : `#mb-passer` devient `<button class="mb-levier mb-passer" id="mb-passer">PASSER ▸</button>`,
  focalisé à l'ouverture du bilan (donc Entrée, Espace et A à la manette le pressent). Son `click`
  et le `pointerdown` existant appellent `mbSauteBilan()`, qui ne fait rien si `mbEtape !== 'bilan'`.
  Le premier geste fige le bilan et ouvre le versement ; les suivants ne choisissent rien. Le focus
  passe ensuite à la première cuve du versement (pas de clic hérité sur une cible).
- Tests :

```ts
// cartouches.spec.ts — avec de vrais gains (la fonction de recolte.ts qui fabrique les gains d'une salle)
it('une cartouche dit un chiffre et un nom, jamais une phrase', () => {
  for (const g of gainsExemple) {
    const html = cartoucheHTML(g, 0)
    expect(html).not.toContain('mb-gain-role')
    expect(html).not.toMatch(/>[^<]{60,}</) // aucun texte visible de plus de 60 caractères
    expect(html).toContain(`title="`)
    expect(html).not.toContain(`>${g.icone}<`) // l'émoji est parti
  }
})
// ceremonie.spec.ts
it('ne s’allonge pas : le versement arrive au plus tard à 4,9 s', () => {
  expect(TEMPS_BILAN.versement).toBeLessThanOrEqual(4900)
})
it('se passe d’un geste : le levier est un bouton focalisé à l’ouverture', () => {
  expect(HTML).toMatch(/<button[^>]*id="mb-passer"/)
  expect(corps('montreMiseEnBonbonne')).toMatch(/mbEl\('mb-passer'\)\.focus\(/)
})
it('saute une étape et une seule, même sous les gestes en rafale', () => {
  expect(corps('mbSauteBilan')).toMatch(/if \(mbEtape !== 'bilan'\) return/)
})
it('n’a plus aucun émoji dans le bilan', () => {
  const coque = HTML.slice(HTML.indexOf('id="mb-releve"'), HTML.indexOf('id="mb-etal"'))
  expect(coque).not.toMatch(/\p{Extended_Pictographic}/u)
})
```

- [ ] Écrire les tests, les voir tomber, mettre en scène, les voir passer, faire les trois
  vérifications globales. Rejouer le banc (`01`, `02`) à 1280×720, à 1280×800 et avec
  `BANC_MOINS=1`. Regarder les captures, puis commit.

#### F3 : le versement (étape 2)
- Modifier : `mbMontreVersement`, ses règles et la pose `versement`.
- La mise en scène :
  - à l'ouverture, `#mb-releve` est **caché** (au plus un bandeau d'une ligne `.mb-compact`) ;
  - deux `.mb-coupe-diag`, RÉSERVE (`cuveHTML('reserve', 'mb-v-res')`) et MAÎTRISE
    (`cuveHTML('maitrise', 'mb-v-mai')`), avec les anneaux d'`ANNEAU_URL` posés sur la colonne ;
  - l'orbe du surplus au centre, qui penche vers la cible visée ;
  - au choix, le liquide de la cible monte et la voix `deversement` part ;
  - « avant → après » se réduit à un chiffre ; la jauge de 8 px disparaît.
  - La visée, `pad-vise`, le bocal plein grisé et le tampon « un palier se franchit » restent.
- Test :

```ts
it('le versement ne garde pas le bilan au-dessus de lui', () => {
  expect(corps('mbMontreVersement')).toMatch(/mbEl\('mb-releve'\)\.hidden = true|mbScene\.classList\.add\('mb-compact'\)/)
})
```

- [ ] Test, rouge, mise en scène, vert. Rejouer le banc `03` : `mesures.json` doit montrer une
  scène ≤ la hauteur visible, à 1280×720 **et** à 1280×800. Puis commit.

#### F4 : le palier (étape 3)
- Modifier : `mbPeintEtal`, `mbAnimeEtalonnage`, `mbPalierEclair`, `mbVerseXp`, les règles
  `.mb-etal*` et la pose `etalonnage`.
- La mise en scène :
  - le héros est la colonne de maîtrise (`cuveHTML('maitrise', 'mb-etal-fluide')`, en grand) ;
  - au palier franchi, l'anneau intact est remplacé par l'anneau brisé (la case 2 de
    `ANNEAU_URL`), qui s'écarte, et la voix `palier` part ;
  - la bande `#mb-palier-eclair` devient une `.mb-poutre` qui traverse l'écran ;
  - les paragraphes de `.mb-etal-nom small` disparaissent (ils passent dans `title`).
- Test : `index.html` ne contient plus `les litres qu’on y verse` ailleurs que dans un attribut
  `title`.
- [ ] Test, rouge, mise en scène, vert. Banc `04`, puis commit.

#### F5 : le tirage (étape 4)
- Modifier : `mbMontreDraft`, `carteHTML` (l'icône par `iconeInstrumentHTML(d)` ; `carteHTML` sert
  aussi l'atelier `.crt`, à vérifier dans l'atelier), les règles `.crt*` / `.mb-pli*` du voile et
  la pose `draft`.
- La mise en scène :
  - la colonne et son tampon **s'en vont** (`mbEl('mb-etal').hidden = true` à l'ouverture du
    tirage) ;
  - trois cartouches d'instrument à coins coupés : icône rendue, nom, une ligne ; le texte complet
    va en `title` ;
  - à l'élu, la voix `elu`.
- Le dos : vérifier dans un Chromium **avec GPU** (le banc avec `--use-gl=angle`, ou un aperçu
  `previsu-go`) si `.mb-pli::before` montre la face en miroir. Si oui, corriger le dos
  (`backface-visibility` sur la face, le dos peint à 180°) et ajouter la garde CSS qui tombe sans le
  correctif.
- Tests :

```ts
it('le tirage n’est pas surplombé par la jauge et son tampon', () => {
  expect(corps('mbMontreDraft')).toContain(`mbEl('mb-etal').hidden = true`)
})
it('les cartes du tirage dessinent leur icône, sans émoji', () => {
  expect(corps('carteHTML')).toContain('iconeInstrumentHTML(')
  expect(corps('carteHTML')).not.toMatch(/\$\{d\.icone\}/)
})
```

- [ ] Tests, rouge, mise en scène, vert. Banc `05`, `06`, `06b`, puis commit.

### Lot S — les sons (`claude/ceremonie-sons`)

#### S1 : les sept voix
- Modifier : `src/game/sonsCeremonie.ts`, avec la table `VOIX: Record<VoixCeremonie, VoixDef>`.
  `VoixDef = { duree: number; gain: number; ... }` : le détail (oscillateurs, bruit filtré,
  enveloppes) est au choix de l'agent. Le compteur est un tic dont la cadence s'accélère sur sa
  durée. Le sceau est un choc sourd métallique. Le déversement est un écoulement filtré. Le palier
  est une montée, puis un anneau qui casse.
- Modifier : `src/game/audio.ts`, pour que `AudioFx.ceremonie` joue la voix sur le bus des effets
  (`graph()`). Si le son est coupé ou le contexte absent (`graph()` renvoie `null`), rien ne joue.
  Le niveau est réglé sur les stings existants ; on note dans le commit la valeur retenue, mesurée
  en crête sur un rendu hors ligne (`OfflineAudioContext`).
- Tests (`sonsCeremonie.spec.ts`) :

```ts
it('donne une voix à chaque geste, brève', () => {
  for (const v of ['compteur','sceau','cartouche','deversement','palier','elu','levier'] as const) {
    expect(VOIX[v].duree, v).toBeGreaterThan(0)
    expect(VOIX[v].duree, v).toBeLessThanOrEqual(1.6)
  }
})
it('ne joue rien et ne lève rien quand le son est coupé', () => {
  const fx = new AudioFx({ ...loadAudioPrefs(), enabled: false })
  expect(() => fx.ceremonie('sceau')).not.toThrow()
  expect(fx.graph()).toBeNull()
})
```

  Les noms des champs de `AudioPrefs` se lisent dans `audio.ts:13`. On adapte le test au vrai nom
  du champ qui coupe le son.
- [ ] Tests, rouge, voix, vert, trois vérifications globales, commit.

### Fusion de la vague 1 (l'orchestrateur)

- [ ] Fusionner B (ce qui est livré), S et F dans `claude/ceremonie-station`, puis faire les trois
  vérifications globales.
- [ ] Rejouer le banc entier (1280×720, 1280×800, `BANC_MOINS=1`), images du lot B en place. Les
  regarder.
- [ ] Faire une passe de relecture du lot F (superpowers:requesting-code-review), puis pousser.

---

## Vague 2 — deux lots en parallèle (après la fusion de la vague 1 ; le lot B continue B4–B5 s'il n'a pas fini)

### Lot M — fin de module et haltes (`claude/ceremonie-haltes`)

Le lot touche `mbMontreBilanModule`, `mbMontreRepos`, `mbMontreDon`, `mbMontreEvenement`,
`mbPeintEvenement`, `mbTranche`, `mbMontreCache`, `mbMontreResultatMiniJeu`, `mbMontreChoixPalet`,
`mbMontreFin`, `mbPorte` et `mbPorteNoeud` ; leurs règles (et celles de `.mb-station*`) ; leurs
poses.

#### M1 : « MODULE TRAVERSÉ » (étape 5)
- Le héros est `sceauHTML('module')`, en grand. Les salles s'affichent en rangée de petits
  `sceauHTML(rang)` teintés, avec le code et les litres. Les gains passent par `cartoucheHTML`. Le
  bouton devient un `.mb-levier` (voix `levier`).
- Test : `corps('mbMontreBilanModule')` contient `cartoucheHTML(` et `sceauHTML('module')`, et ne
  contient plus `mbGainHTML(`.
- [ ] Test, rouge, mise en scène, vert. Banc `08`, `09`, puis commit.

#### M2 : haltes, rencontres, cache, mini-jeu (étape 6)
- Le héros de chaque halte est son icône de cérémonie en grand (`repos`, `don`, `rencontre`,
  `cache`, et `couperet` … `cibles` par mini-jeu, d'après `MiniJeuId`). Les offres et les puces
  d'issue passent en cartouches (icônes de cérémonie). Un choix déclenche `mbEclate`, `mbFlash` et
  la voix `levier`, comme les autres choix.
- Le titre de l'alcôve dit **REPOS** (il disait le type du module, « ÉNIGME »).
- Les correspondances émoji → icône des puces d'issue : 🫙 → `reserve`, 💧 → `condensat`,
  🧠 → `memoire`, 💠 → `secours`, 🗺️ → `carte`, ⚠️ → `danger`, 🜄 → `profondeur`, 🔮 → `orbe`.
  Elles vont dans `ICONE_DE_GLYPHE: Record<string, IconeCeremonie>`, exporté de `cartouches.ts`,
  qui sert aussi en vague 3. Un glyphe absent de la table reste affiché tel quel, plutôt qu'une case
  vide.
- Tests :

```ts
it('l’alcôve s’appelle REPOS, quel que soit le module', () => {
  expect(corps('mbMontreRepos')).toMatch(/'REPOS/)
})
it('un choix de halte claque comme les autres choix', () => {
  for (const f of ['mbMontreRepos', 'mbMontreDon', 'mbTranche', 'mbMontreCache'])
    expect(corps(f), f).toMatch(/mbFlash\(\)/)
})
it('aucun émoji ne reste dans les haltes', () => {
  for (const f of ['mbMontreRepos', 'mbMontreDon', 'mbPeintEvenement', 'mbTranche', 'mbMontreCache', 'mbMontreResultatMiniJeu', 'mbMontreChoixPalet'])
    expect(corps(f), f).not.toMatch(/\p{Extended_Pictographic}/u)
})
```

  Les données des haltes (`descenteCarte.ts`, `evenements.ts`) gardent leurs émojis pour les écrans
  hors cérémonie. Le gabarit de la cérémonie ne les lit plus : il passe par `ICONE_DE_GLYPHE`.
- La fin ordinaire (`mbMontreFin`, hors voie) suit le même traitement : la rangée de jauges en
  texte devient des cartouches, et le bouton devient un `.mb-levier`.
- [ ] Tests, rouge, mise en scène, vert. Banc `11` à `17`, puis commit.

#### M3 : habiller le choix de la salle et la carte de la station (non refaits : habillés)
- Modifier : les règles `.mb-porte*` et `.mb-station*` du voile, et `mbPorte` / `mbPorteNoeud`
  pour la seule pastille ENTRER, qui devient un `.mb-levier`. Les portes prennent `.mb-coupe`,
  et l'icône de nœud vient de la planche de cérémonie (par `ICONE_DE_GLYPHE`). La disposition,
  l'épure du 13/11 (#517) et le plan SVG ne bougent pas : les gardes existantes de
  `ceremonie.spec.ts` (« le choix de la salle tient dans l'écran », « la carte ne bouge pas sous le
  survol ») doivent rester vertes sans être retouchées.
- Test :

```ts
it('les portes sont taillées au chanfrein, ENTRER est un levier', () => {
  expect(regle('.mb-porte')).toMatch(/clip-path:\s*polygon\(/)
  expect(corps('mbPorte')).toContain('mb-levier')
})
```

- [ ] Test, rouge, habillage, vert. Banc `07`, `07b`, `07c`, `10` aux deux tailles. Vérifier au
  doigt (`porteArmee.spec.ts` vert) et à la manette (`pad-vise` toujours écouté sur les portes).
  Puis commit.

### Lot E — les fins de partie (`claude/ceremonie-fins`)

#### E1 : le relevé de la descente
- Créer : `src/game/finDescente.ts`, `src/game/finDescente.spec.ts`.
  ```ts
  export type IssueDescente = 'bouclee' | 'perdue' | 'reprise'
  export interface ReleveDescente { salles: string; litres: string; duree: string; instruments: number; memoire: string; palier: number }
  export function releveDescente(e: { salles: number; total: number; livreL: number; dureeS: number;
    instruments: number; memoireGagnee: number; palier: number }): ReleveDescente
  ```
  On n'utilise que des chiffres qui existent déjà dans `run` (pas de « meilleur rang » : il faudrait
  un état de plus dans la sauvegarde). Formats : `fmtL` / `fmtDuree`. S'ils vivent dans `main.ts`,
  on les déplace dans un module partagé, sans changer leur sortie.
- Tests : pour une descente de 18/18 salles, 31,4 L, 3 720 s, 6 instruments, +240 mémoire, palier 4,
  le relevé donne `salles: '18/18'` et, pour `litres` et `duree`, exactement ce que `fmtL(31.4)` et
  `fmtDuree(3720)` rendent aujourd'hui (on les lance une fois pour écrire l'attendu en dur). Une
  descente sans salle livrée donne la chaîne de `fmtL(0)`, et aucun champ ne contient `NaN`.
- [ ] Tests, rouge, module, vert, commit.

#### E2 : les trois scènes
- Modifier : `main.ts`, avec `mbMontreFinDescente(issue: IssueDescente, r: ReleveDescente, suite: () => void)`.
  - La fonction ouvre `#mb-veil` (`mbEtape = 'fin'`).
  - Pour `bouclee` / `perdue`, l'image `SCENES_FIN[…]` est posée en fond.
  - Le titre est une `.mb-poutre`. Le relevé s'affiche en sceaux et en chiffres.
  - Un `.mb-levier` focalisé porte le libellé actuel (RETOUR AU LABO / REPRENDRE — SALLE n).
- On appelle cette fonction **à la place de** `showOverlay` en trois endroits : la descente bouclée
  (≈ l. 20404), la défaite définitive (`afficheDispersion`, ≈ l. 17873) et la reprise
  (≈ l. 17859). `suite` fait exactement ce que fait aujourd'hui le clic sur `#overlay-btn`
  (`resetAction`, l. 17999). Il faut vérifier que `ecranDispersion` et la reprise suivent le même
  chemin.
- La cinématique `joueMoment(...)` joue toujours **avant**. Les fins d'essai, d'éditeur et de
  mini-jeu en test (≈ l. 20146, 20173) restent sur `#overlay`.
- Le palmarès du poste et le butin (les glyphes d'instruments) deviennent des cartouches et des
  icônes (`iconeInstrumentHTML`).
- Tests :

```ts
it('la descente bouclée, la défaite et la reprise ne passent plus par l’overlay brut', () => {
  expect(corps('afficheDispersion')).not.toContain('showOverlay(')
  expect(corps('afficheDispersion')).toContain('mbMontreFinDescente(')
  expect(MAIN).not.toMatch(/showOverlay\(\s*'LA DESCENTE EST BOUCLÉE'/)
})
it('la scène de fin se quitte d’un geste', () => {
  expect(corps('mbMontreFinDescente')).toMatch(/\.focus\(/)
})
```

- Ajouter deux poses au banc (`18-fin-bouclee`, `19-fin-perdue`).
- [ ] Tests, rouge, scènes, vert. Banc `18`, `19` aux deux tailles et avec `BANC_MOINS=1`, puis
  commit.

### Fusion de la vague 2 (l'orchestrateur)
- [ ] Fusionner M, E et le reste du lot B. Faire les trois vérifications globales et le banc entier,
  puis une relecture des deux lots, puis pousser.

---

## Vague 3 — les icônes partout (`claude/ceremonie-icones`, un agent, hors de la zone de la cérémonie)

### I1 : la garde
- Créer : `src/game/iconesPartout.spec.ts`. Il parcourt `src/**/*.ts` (hors `*.spec.ts`,
  `instruments.ts` et `iconesStation.ts`) et `index.html`. Il échoue sur toute interpolation d'une
  icône d'instrument dans du HTML ou du canvas : `/\$\{[^}]*\.icone\b[^}]*\}/` et
  `/fillText\([^)]*\.icone/`.
  Il échoue aussi sur un appel à `iconeMetaHTML('condensat' | 'memoire' | 'vie', …)` qui lirait encore
  `meta-icones`. Le message d'échec liste le fichier et la ligne de chaque reste.
- [ ] Écrire la garde. La lancer, et voir qu'elle tombe sur les écrans de la conception (HUD,
  toasts, journal, codex, marchand, avaries, atelier `.crt`, éditeur, régie, `module2dCanvas.ts`,
  `main.ts`). Elle reste rouge **en local seulement**, sans commit, jusqu'à la fin d'I3, puis elle
  est commitée avec I3.

### I2 : le HTML et le texte brut
- Remplacer chaque interpolation par `iconeInstrumentHTML(d)`. Dans une phrase en texte brut (un
  toast en `textContent`, un `title`), l'émoji disparaît au profit du nom ; si la phrase devient
  HTML, elle prend la balise.
- `iconeMetaHTML` envoie `condensat`, `memoire` et `vie` vers `iconeCeremonieHTML`
  (`vie` → `secours`) : une monnaie, un seul dessin. Les autres articles du commerce restent sur
  leur planche.
- [ ] Remplacer fichier par fichier, avec un commit par écran. Avant chaque commit, les trois
  vérifications globales (la garde I1, pas encore commitée, n'en fait pas partie).

### I3 : le canvas
- `module2dCanvas.ts` et `main.ts` dessinent par `dessineIconeInstrument`. La planche est chargée
  une fois, comme les autres images du canvas. Quand la fonction renvoie `false` (image pas prête,
  ou instrument perso), on retombe sur l'ancien `fillText`.
- [ ] Remplacer, voir la garde I1 passer au VERT, la commiter avec le canvas, faire les trois
  vérifications globales, pousser.

---

## La fin (l'orchestrateur)

- [ ] Fusionner la vague 3. Faire les trois vérifications globales et le banc entier (1280×720,
  1280×800, `BANC_MOINS=1`).
- [ ] Faire une relecture de toute la branche (superpowers:requesting-code-review).
- [ ] Mettre à jour la note de mémoire `chantier-ceremonie-station`.
- [ ] Préparer un aperçu : `git fetch origin previsu-go`, vérifier qui l'occupe, puis
  `git push -f origin claude/ceremonie-station:previsu-go`. Donner l'adresse au concepteur pour
  l'essai sur un vrai GPU (dos de carte, sons, manette, Deck).
- [ ] Ouvrir la PR `claude/ceremonie-station` → `dev`, une fois #514–#517 fusionnées. On ne
  fusionne pas vers `prod`.
