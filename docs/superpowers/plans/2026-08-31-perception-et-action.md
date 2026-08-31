# Plan A — Le nouveau contrat de perception et d'action

> **Pour les agents qui exécutent :** SOUS-COMPÉTENCE REQUISE — utiliser
> `superpowers:subagent-driven-development` (recommandé) ou
> `superpowers:executing-plans` pour dérouler ce plan tâche par tâche. Les
> étapes sont des cases à cocher (`- [ ]`).

**But :** figer définitivement la forme de l'observation (43 → 71 entrées) et
du jeu d'actions (19 → 21, avec glace et vapeur), pour que plus rien de ce qui
sera entraîné ensuite ne soit à jeter.

**Architecture :** `src/rl/capteurs.ts` est le pont partagé entre
l'entraînement sans écran et le jeu dans le navigateur — une seule définition
de l'observation, les deux côtés la lisent. On l'étend par blocs, chacun testé
seul. Les capteurs ne calculent aucune règle de jeu : l'état des cibles, des
lasers et des zones leur est **passé en paramètre** par l'appelant (avec des
valeurs neutres par défaut), pour que la version qui simule vraiment les
énigmes (plan C) n'ait qu'à brancher de vraies valeurs sans jamais réinventer
une règle divergente de `main.ts`.

**Pile technique :** TypeScript, Vitest, aucun ajout de dépendance.

## Contraintes globales

- **`pnpm` est cassé sur cette machine.** Tous les binaires s'appellent
  directement : `./node_modules/.bin/vitest`, `./node_modules/.bin/tsc`,
  `./node_modules/.bin/vite-node`. Ne jamais écrire `pnpm <script>` dans une
  commande à exécuter.
- Le français est la langue du code, des commentaires, des tests et des
  messages de commit. Les commentaires expliquent **pourquoi**, pas quoi.
- `./node_modules/.bin/vitest run` doit rester vert à chaque commit (658 tests
  au départ).
- `./node_modules/.bin/tsc --noEmit` doit rester vert à chaque commit.
- La taille de l'observation est `39 + 2 × rayons`, soit **71** avec les 16
  rayons par défaut. Ce nombre est un contrat : il ne doit plus bouger après ce
  plan.
- L'ordre des entrées dans le vecteur est un contrat lui aussi. Toute insertion
  se fait **à la fin d'un bloc existant**, jamais au milieu.
- Aucun `any`. Aucun `TODO` laissé dans le code.

## Structure des fichiers

| fichier | responsabilité | statut |
|---|---|---|
| `src/rl/capteurs.ts` | l'observation, et rien d'autre : lire le monde, écrire 71 flottants | modifié |
| `src/rl/capteurs.spec.ts` | les tests de l'observation, bloc par bloc | **créé** |
| `src/rl/env.ts` | la boucle de décision, les actions, la récompense | modifié |
| `src/rl/env.spec.ts` | tests de l'environnement | modifié |
| `src/rl/agent.ts` | l'agent qui joue à l'écran : traduit une action en geste de joueur | modifié |
| `src/rl/agent.spec.ts` | tests de l'agent en jeu | modifié |
| `src/main.ts` | applique l'ordre de l'agent à `input` | modifié (≈6 lignes) |
| `public/agents/heritage-43/` | les politiques de l'ancien format, archivées | **créé** |
| `docs/apprentissage-par-renforcement.md` | la doc de référence | modifié |

---

### Tâche 1 : le bloc corps — l'état, les dashs, le péage (43 → 48)

**Fichiers :**
- Modifier : `src/rl/capteurs.ts:78` (`this.taille`), `src/rl/capteurs.ts:83-112` (`lis`)
- Créer : `src/rl/capteurs.spec.ts`

**Interfaces :**
- Consomme : `FluidSim` (`freezeIntent`, `gasIntent`, `dashBudget`,
  `dashBudgetMax`, `vaporTollFactor`), déjà présents dans `src/sim/solver.ts`.
- Produit : `Capteurs.taille === 16 + 2 * rayons`. Les entrées 11, 12, 13
  sont l'état du corps en one-hot (eau, glace, vapeur) ; 14 la réserve de
  dashs dans `[0, 1]` ; 15 le péage de vaporisation.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `src/rl/capteurs.spec.ts` :

```ts
// Les capteurs sont un CONTRAT : leur taille et l'ordre de leurs entrées sont
// lus par des politiques entraînées des semaines plus tôt. Un décalage d'une
// case ne casse rien visiblement — il rend l'agent fou en silence. D'où ces
// tests, entrée par entrée.

import { describe, expect, it } from 'vitest'
import { Capteurs } from './capteurs'
import { EnvSujet21 } from './env'

const PETIT = { particules: 200, dureeMax: 6, pasParDecision: 12 } as const

describe('Capteurs — le bloc corps', () => {
  it('compte 16 scalaires de corps plus deux par rayon', () => {
    const env = new EnvSujet21({ code: '21-01', ...PETIT })
    expect(env.capteurs.taille).toBe(16 + 2 * 16)
  })

  it('dit l’état du corps en one-hot : eau par défaut', () => {
    const env = new EnvSujet21({ code: '21-01', ...PETIT })
    const o = env.capteurs.lis(env.sim, 0)
    expect([o[11], o[12], o[13]]).toEqual([1, 0, 0])
  })

  it('bascule le one-hot quand le corps passe en vapeur', () => {
    const env = new EnvSujet21({ code: '21-01', ...PETIT })
    env.sim.gasIntent = true
    const o = env.capteurs.lis(env.sim, 0)
    expect([o[11], o[12], o[13]]).toEqual([0, 0, 1])
  })

  it('bascule le one-hot quand le corps passe en glace', () => {
    const env = new EnvSujet21({ code: '21-01', ...PETIT })
    env.sim.freezeIntent = true
    const o = env.capteurs.lis(env.sim, 0)
    expect([o[11], o[12], o[13]]).toEqual([0, 1, 0])
  })

  it('rapporte la réserve de dashs pleine au départ, et sa décrue', () => {
    const env = new EnvSujet21({ code: '21-01', ...PETIT })
    expect(env.capteurs.lis(env.sim, 0)[14]).toBe(1)
    env.sim.dashBudget = env.sim.dashBudgetMax * 0.25
    expect(env.capteurs.lis(env.sim, 0)[14]).toBeCloseTo(0.25, 5)
  })

  it('rapporte le péage de vaporisation, plein tarif par défaut', () => {
    const env = new EnvSujet21({ code: '21-01', ...PETIT })
    // `vaporTollFactor` vaut 1 au repos (src/sim/solver.ts:232) : c'est le
    // « détendeur » des leviers qui l'abaisse, jamais l'agent.
    expect(env.capteurs.lis(env.sim, 0)[15]).toBe(1)
    env.sim.vaporTollFactor = 0.3
    expect(env.capteurs.lis(env.sim, 0)[15]).toBeCloseTo(0.3, 5)
  })
})
```

- [ ] **Étape 2 : lancer le test pour le voir échouer**

```bash
./node_modules/.bin/vitest run src/rl/capteurs.spec.ts
```

Attendu : ÉCHEC — `expected 43 to be 48` sur le premier test, et les suivants
lisent des cases hors du bloc corps.

- [ ] **Étape 3 : écrire l'implémentation minimale**

Dans `src/rl/capteurs.ts`, remplacer `this.taille = 11 + 2 * this.rayons` par :

```ts
    // 16 scalaires de corps + 2 par rayon. Le compte est un CONTRAT : voir
    // capteurs.spec.ts, et le refus de reprise dans entrainePPO.ts.
    this.taille = 16 + 2 * this.rayons
```

Puis, dans `lis`, juste après `o[i++] = Math.min(1, temps / this.dureeReference)`
et **avant** la boucle des rayons :

```ts
    // L'ÉTAT DU CORPS en one-hot plutôt qu'en un scalaire : eau, glace et
    // vapeur ne sont pas trois graduations d'une même grandeur, et un réseau
    // ne devrait pas avoir à découvrir que 0,5 ne veut rien dire.
    o[i++] = !sim.freezeIntent && !sim.gasIntent ? 1 : 0
    o[i++] = sim.freezeIntent ? 1 : 0
    o[i++] = sim.gasIntent ? 1 : 0
    // Ce que coûte de rester en vapeur, et ce qu'il reste pour s'élancer :
    // sans ces deux nombres, une politique en vapeur ne peut pas savoir
    // qu'elle est en train de se ruiner.
    o[i++] = sim.dashBudgetMax > 0 ? sim.dashBudget / sim.dashBudgetMax : 0
    o[i++] = sim.vaporTollFactor
```

- [ ] **Étape 4 : lancer les tests pour les voir passer**

```bash
./node_modules/.bin/vitest run src/rl/capteurs.spec.ts
./node_modules/.bin/vitest run
```

Attendu : les 6 nouveaux tests passent. **Des tests existants vont échouer** —
ceux qui écrivent en dur `tailleObs === 43` ou qui chargent
`public/agents/*.json`. C'est attendu et ce sera traité en tâche 7 ; noter
lesquels échouent et continuer.

- [ ] **Étape 5 : commit**

```bash
git add src/rl/capteurs.ts src/rl/capteurs.spec.ts
git commit -m "Le corps se sait : état, réserve de dashs et péage entrent dans l'observation"
```

---

### Tâche 2 : les cibles et les lasers (48 → 64)

**Fichiers :**
- Modifier : `src/rl/capteurs.ts` (constructeur, `lis`, nouvelle interface)
- Modifier : `src/rl/capteurs.spec.ts`

**Interfaces :**
- Produit : `interface EtatMonde { ciblesTouchees?: boolean[]; lasersActifs?: boolean[]; zoneActive?: ZoneForce }`
  exportée depuis `src/rl/capteurs.ts`.
- Produit : `lis(sim: FluidSim, temps: number, monde?: EtatMonde): Float32Array`
  — le troisième paramètre est **facultatif**, valeurs neutres par défaut
  (aucune cible touchée, tous lasers actifs, zone libre).
- Produit : `Capteurs.taille === 32 + 2 * rayons`. Entrées 16-23 : deux cibles
  (dirX, dirY, distance, touchée). Entrées 24-31 : deux lasers (dirX, dirY,
  distance, actif).

**Pourquoi un paramètre plutôt qu'un calcul :** les capteurs ne doivent
inventer aucune règle de jeu. Savoir si une cible est allumée est la
responsabilité de `main.ts` (à l'écran) et de `src/rl/enigmes.ts` (plan C). Si
les capteurs le recalculaient de leur côté, les deux versions divergeraient un
jour et personne ne saurait pourquoi l'agent se comporte autrement à l'écran.

- [ ] **Étape 1 : écrire le test qui échoue**

Ajouter dans `src/rl/capteurs.spec.ts` :

```ts
describe('Capteurs — cibles et lasers', () => {
  it('compte 32 scalaires plus deux par rayon', () => {
    const env = new EnvSujet21({ code: '21-01', ...PETIT })
    expect(env.capteurs.taille).toBe(32 + 2 * 16)
  })

  it('laisse les emplacements neutres sur un tableau sans cible ni laser', () => {
    const env = new EnvSujet21({ code: '21-01', ...PETIT })
    const o = env.capteurs.lis(env.sim, 0)
    // direction nulle, distance au maximum, éteint : « il n'y a rien »
    for (const base of [16, 20, 24, 28]) {
      expect(o[base]).toBe(0)
      expect(o[base + 1]).toBe(0)
      expect(o[base + 2]).toBe(1)
      expect(o[base + 3]).toBe(0)
    }
  })

  it('pointe la cible la plus proche, direction normalisée', () => {
    const niveau = {
      ...trouveNiveauNu(),
      cibles: [{ x: 1000, y: 0, r: 20 }],
    }
    const c = new Capteurs(niveau)
    const sim = simAuCentre(niveau)
    const o = c.lis(sim, 0)
    expect(o[16]).toBeCloseTo(1, 2) // droit devant en x
    expect(o[17]).toBeCloseTo(0, 2)
    expect(o[18]).toBeGreaterThan(0)
    expect(o[18]).toBeLessThanOrEqual(1)
    expect(o[19]).toBe(0) // pas encore touchée
  })

  it('dit qu’une cible est touchée quand on le lui dit', () => {
    const niveau = { ...trouveNiveauNu(), cibles: [{ x: 1000, y: 0, r: 20 }] }
    const c = new Capteurs(niveau)
    const o = c.lis(simAuCentre(niveau), 0, { ciblesTouchees: [true] })
    expect(o[19]).toBe(1)
  })

  it('range les deux cibles de la plus proche à la plus lointaine', () => {
    const niveau = {
      ...trouveNiveauNu(),
      cibles: [
        { x: 2000, y: 0, r: 20 },
        { x: 500, y: 0, r: 20 },
      ],
    }
    const c = new Capteurs(niveau)
    const o = c.lis(simAuCentre(niveau), 0)
    expect(o[18]).toBeLessThan(o[22]) // la plus proche d'abord
  })

  it('dit qu’un laser est actif par défaut, éteint sur demande', () => {
    const niveau = { ...trouveNiveauNu(), lasers: [{ x: 800, y: 0, angle: 0 }] }
    const c = new Capteurs(niveau)
    expect(c.lis(simAuCentre(niveau), 0)[27]).toBe(1)
    expect(c.lis(simAuCentre(niveau), 0, { lasersActifs: [false] })[27]).toBe(0)
  })
})
```

Ajouter en haut du fichier de test les deux aides (elles servent aussi aux
tâches suivantes) :

```ts
import { TABLEAUX, type LevelDef } from '../game/level'
import { FluidSim, KIND_PLAYER } from '../sim/solver'
import { DEFAULT_PARAMS } from '../sim/params'

/**
 * Un tableau dépouillé, centré sur l'origine : les tests de capteurs veulent
 * une géométrie qu'on peut calculer de tête, pas un vrai niveau.
 */
function trouveNiveauNu(): LevelDef {
  const modele = TABLEAUX[0]
  return {
    ...modele,
    bounds: { minX: -2400, minY: -2400, maxX: 2400, maxY: 2400 },
    spawn: { x: 0, y: 0, n: 200 },
    exit: { minX: 2200, minY: -100, maxX: 2400, maxY: 100 },
    boxes: [],
    sponges: [],
    zones: undefined,
    lasers: undefined,
    cibles: undefined,
    rails: undefined,
    portes: undefined,
  }
}

function simAuCentre(niveau: LevelDef): FluidSim {
  const sim = new FluidSim(DEFAULT_PARAMS, niveau.bounds, 4096)
  sim.setLevel(niveau.boxes, niveau.sponges)
  sim.spawnDisc(0, 0, 200, KIND_PLAYER)
  sim.relabel()
  sim.updatePlayerStats()
  return sim
}
```

- [ ] **Étape 2 : lancer le test pour le voir échouer**

```bash
./node_modules/.bin/vitest run src/rl/capteurs.spec.ts
```

Attendu : ÉCHEC — `expected 48 to be 64`.

- [ ] **Étape 3 : écrire l'implémentation minimale**

Dans `src/rl/capteurs.ts`, ajouter près du haut du fichier :

```ts
import type { CibleDef, LaserDef, ZoneForce } from '../game/level'

/**
 * Ce que le MONDE dit aux capteurs à cet instant. Les capteurs ne le
 * calculent jamais eux-mêmes : la règle des cibles et des zones appartient au
 * jeu (`main.ts`) et à l'environnement (`src/rl/enigmes.ts`). Deux
 * implémentations d'une même règle finissent toujours par diverger.
 */
export interface EtatMonde {
  /** Une entrée par cible du tableau, dans l'ordre de `level.cibles`. */
  ciblesTouchees?: boolean[]
  /** Une entrée par laser, dans l'ordre de `level.lasers`. Défaut : actif. */
  lasersActifs?: boolean[]
  /** L'état imposé par la zone qui tient le corps. Défaut : `'libre'`. */
  zoneActive?: ZoneForce
}

/** Emplacements réservés par famille d'objets. Deux suffisent à anticiper. */
const EMPLACEMENTS = 2
```

Ajouter deux champs privés dans la classe, renseignés au constructeur :

```ts
  private readonly cibles: CibleDef[]
  private readonly lasers: LaserDef[]
```

```ts
    this.cibles = level.cibles ?? []
    this.lasers = level.lasers ?? []
```

Passer la taille à :

```ts
    this.taille = 32 + 2 * this.rayons
```

Ajouter une méthode privée, utilisée pour les deux familles :

```ts
  /**
   * Les `EMPLACEMENTS` objets les plus proches du corps, écrits sous la forme
   * (direction x, direction y, distance, allumé). Un emplacement vide vaut
   * (0, 0, 1, 0) : « rien, et loin » — jamais du bruit.
   */
  private ecrisProches(
    o: Float32Array,
    depart: number,
    objets: { x: number; y: number }[],
    allume: (indice: number) => boolean,
    cx: number,
    cy: number,
  ): number {
    const tries = objets
      .map((p, indice) => ({ p, indice, d: Math.hypot(p.x - cx, p.y - cy) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, EMPLACEMENTS)
    let i = depart
    for (let k = 0; k < EMPLACEMENTS; k++) {
      const t = tries[k]
      if (!t) {
        o[i++] = 0
        o[i++] = 0
        o[i++] = 1
        o[i++] = 0
        continue
      }
      const d = t.d || 1
      o[i++] = (t.p.x - cx) / d
      o[i++] = (t.p.y - cy) / d
      o[i++] = Math.min(1, t.d / this.diagonale)
      o[i++] = allume(t.indice) ? 1 : 0
    }
    return i
  }
```

Changer la signature de `lis` et brancher les deux blocs, **après** le bloc
corps et **avant** la boucle des rayons :

```ts
  lis(sim: FluidSim, temps: number, monde: EtatMonde = {}): Float32Array {
```

```ts
    i = this.ecrisProches(
      o,
      i,
      this.cibles,
      (k) => monde.ciblesTouchees?.[k] ?? false,
      cx,
      cy,
    )
    i = this.ecrisProches(
      o,
      i,
      this.lasers,
      (k) => monde.lasersActifs?.[k] ?? true,
      cx,
      cy,
    )
```

- [ ] **Étape 4 : lancer les tests pour les voir passer**

```bash
./node_modules/.bin/vitest run src/rl/capteurs.spec.ts
```

Attendu : les tests de cette tâche et de la tâche 1 passent.

- [ ] **Étape 5 : commit**

```bash
git add src/rl/capteurs.ts src/rl/capteurs.spec.ts
git commit -m "Les cibles et les lasers entrent dans le champ de l'agent"
```

---

### Tâche 3 : le rail et les zones (64 → 71)

**Fichiers :**
- Modifier : `src/rl/capteurs.ts`
- Modifier : `src/rl/capteurs.spec.ts`

**Interfaces :**
- Produit : `Capteurs.taille === 39 + 2 * rayons` — **le nombre définitif**.
  Entrées 32-34 : le rail le plus proche (dirX, dirY, distance). Entrées
  35-38 : la zone (one-hot eau/glace/vapeur de l'état imposé, puis distance de
  la zone non libre la plus proche).
- Consomme : `EtatMonde.zoneActive` de la tâche 2.

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
describe('Capteurs — rails et zones', () => {
  it('compte 39 scalaires plus deux par rayon : le contrat définitif', () => {
    const env = new EnvSujet21({ code: '21-01', ...PETIT })
    expect(env.capteurs.taille).toBe(39 + 2 * 16)
    expect(env.capteurs.taille).toBe(71)
  })

  it('pointe le point de rail le plus proche', () => {
    const niveau = {
      ...trouveNiveauNu(),
      rails: [{ points: [{ x: 600, y: 0 }, { x: 900, y: 0 }] }],
    }
    const c = new Capteurs(niveau)
    const o = c.lis(simAuCentre(niveau), 0)
    expect(o[32]).toBeCloseTo(1, 2)
    expect(o[33]).toBeCloseTo(0, 2)
    expect(o[34]).toBeGreaterThan(0)
  })

  it('laisse le rail neutre quand il n’y en a pas', () => {
    const env = new EnvSujet21({ code: '21-01', ...PETIT })
    const o = env.capteurs.lis(env.sim, 0)
    expect([o[32], o[33], o[34]]).toEqual([0, 0, 1])
  })

  it('dit quel état la zone impose, quand on le lui dit', () => {
    const env = new EnvSujet21({ code: '21-01', ...PETIT })
    const libre = env.capteurs.lis(env.sim, 0)
    expect([libre[35], libre[36], libre[37]]).toEqual([0, 0, 0])
    const tenu = env.capteurs.lis(env.sim, 0, { zoneActive: 'vapeur' })
    expect([tenu[35], tenu[36], tenu[37]]).toEqual([0, 0, 1])
  })

  it('mesure la distance de la zone contraignante la plus proche', () => {
    const niveau = {
      ...trouveNiveauNu(),
      zones: [
        { minX: 400, minY: -100, maxX: 600, maxY: 100, force: 'vapeur' as const },
        { minX: -50, minY: -50, maxX: 50, maxY: 50, force: 'libre' as const },
      ],
    }
    const c = new Capteurs(niveau)
    const o = c.lis(simAuCentre(niveau), 0)
    // la zone « libre » ne contraint rien : elle est ignorée
    expect(o[38]).toBeGreaterThan(0)
    expect(o[38]).toBeLessThan(1)
  })
})
```

- [ ] **Étape 2 : lancer le test pour le voir échouer**

```bash
./node_modules/.bin/vitest run src/rl/capteurs.spec.ts
```

Attendu : ÉCHEC — `expected 64 to be 71`.

- [ ] **Étape 3 : écrire l'implémentation minimale**

Dans `src/rl/capteurs.ts`, ajouter les champs et leur initialisation :

```ts
  private readonly pointsRail: { x: number; y: number }[]
  private readonly zonesContraintes: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }[]
```

```ts
    // Un rail est une polyligne : le corps s'y accroche n'importe où, donc
    // c'est le POINT le plus proche qui compte, pas le rail comme objet.
    this.pointsRail = (level.rails ?? []).flatMap((r) => r.points)
    // Une zone « libre » n'impose rien : elle n'a rien à dire à l'agent.
    this.zonesContraintes = (level.zones ?? [])
      .filter((z) => z.force !== 'libre')
      .map((z) => ({ minX: z.minX, minY: z.minY, maxX: z.maxX, maxY: z.maxY }))
```

```ts
    this.taille = 39 + 2 * this.rayons
```

Puis, dans `lis`, après le bloc des lasers :

```ts
    // LE RAIL le plus proche — direction et distance, sans état : un rail ne
    // s'allume pas, il est là ou il n'est pas.
    if (this.pointsRail.length === 0) {
      o[i++] = 0
      o[i++] = 0
      o[i++] = 1
    } else {
      let meilleur = this.pointsRail[0]
      let meilleureD = Infinity
      for (const p of this.pointsRail) {
        const d = Math.hypot(p.x - cx, p.y - cy)
        if (d < meilleureD) {
          meilleureD = d
          meilleur = p
        }
      }
      const d = meilleureD || 1
      o[i++] = (meilleur.x - cx) / d
      o[i++] = (meilleur.y - cy) / d
      o[i++] = Math.min(1, meilleureD / this.diagonale)
    }

    // LA ZONE : l'état qu'elle impose (one-hot, tout à zéro si le corps est
    // libre), puis la distance de la plus proche zone contraignante — pour
    // qu'il puisse la viser ou l'éviter avant d'y être.
    const zone = monde.zoneActive ?? 'libre'
    o[i++] = zone === 'eau' ? 1 : 0
    o[i++] = zone === 'glace' ? 1 : 0
    o[i++] = zone === 'vapeur' ? 1 : 0
    let distZone = Infinity
    for (const z of this.zonesContraintes) {
      const px = Math.max(z.minX, Math.min(cx, z.maxX))
      const py = Math.max(z.minY, Math.min(cy, z.maxY))
      distZone = Math.min(distZone, Math.hypot(px - cx, py - cy))
    }
    o[i++] = distZone === Infinity ? 1 : Math.min(1, distZone / this.diagonale)
```

- [ ] **Étape 4 : lancer les tests pour les voir passer**

```bash
./node_modules/.bin/vitest run src/rl/capteurs.spec.ts
./node_modules/.bin/tsc --noEmit
```

Attendu : tous les tests de `capteurs.spec.ts` passent, `taille === 71`.

- [ ] **Étape 5 : commit**

```bash
git add src/rl/capteurs.ts src/rl/capteurs.spec.ts
git commit -m "Rails et zones : l'observation atteint sa forme définitive, 71 entrées"
```

---

### Tâche 4 : les rayons voient les nouvelles familles (taille inchangée)

**Fichiers :**
- Modifier : `src/rl/capteurs.ts` (`tate`, constantes de matériau)
- Modifier : `src/rl/capteurs.spec.ts`

**Interfaces :**
- Produit : `MAT_LASER = 12`, `MAT_RAIL = 13`, `MAT_ZONE = 14` exportés depuis
  `src/rl/capteurs.ts`, aux côtés de `MAT_EPONGE = 11` qui existe déjà.
- La taille de l'observation **ne change pas** : les rayons portent déjà un
  canal de matériau (`o[i++] = t.materiau / 10`).

**Limite connue, non traitée ici :** le matériau est donné comme un scalaire,
ce qui suggère au réseau un ordre entre les familles (laser « supérieur » à
éponge) qui n'a aucun sens. Ce choix est antérieur à ce plan et le corriger
coûterait 16 × N entrées. On le laisse tel quel, et on le note.

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
describe('Capteurs — ce que touchent les rayons', () => {
  it('rapporte un laser touché par un rayon', () => {
    const niveau = { ...trouveNiveauNu(), lasers: [{ x: 300, y: 0, angle: 0 }] }
    const c = new Capteurs(niveau)
    const o = c.lis(simAuCentre(niveau), 0)
    // le rayon 0 part vers +x et rencontre le laser avant la coque
    expect(o[39 + 1]).toBeCloseTo(MAT_LASER / 10, 5)
  })

  it('rapporte une zone contraignante touchée par un rayon', () => {
    const niveau = {
      ...trouveNiveauNu(),
      zones: [{ minX: 300, minY: -200, maxX: 500, maxY: 200, force: 'glace' as const }],
    }
    const c = new Capteurs(niveau)
    const o = c.lis(simAuCentre(niveau), 0)
    expect(o[39 + 1]).toBeCloseTo(MAT_ZONE / 10, 5)
  })

  it('ne voit rien de neuf sur un tableau sans énigme', () => {
    const env = new EnvSujet21({ code: '21-01', ...PETIT })
    const o = env.capteurs.lis(env.sim, 0)
    for (let k = 0; k < 16; k++) {
      const mat = o[39 + 2 * k + 1] * 10
      expect(mat).toBeLessThan(MAT_LASER)
    }
  })
})
```

Ajouter `MAT_LASER, MAT_RAIL, MAT_ZONE` à l'import de `./capteurs` en tête du
fichier de test.

- [ ] **Étape 2 : lancer le test pour le voir échouer**

```bash
./node_modules/.bin/vitest run src/rl/capteurs.spec.ts -t "rayons"
```

Attendu : ÉCHEC — `MAT_LASER` n'est pas exporté.

- [ ] **Étape 3 : écrire l'implémentation minimale**

Dans `src/rl/capteurs.ts`, à côté de `MAT_EPONGE` :

```ts
/**
 * Codes réservés aux objets d'énigme. Ils ne sont pas des matériaux du
 * décor : ce sont des choses que le corps doit SENTIR sans pouvoir les
 * toucher, comme il sent déjà l'éponge.
 */
export const MAT_LASER = 12
export const MAT_RAIL = 13
export const MAT_ZONE = 14
```

Ajouter au constructeur les géométries à sonder — un laser est un point, on lui
donne un rayon de détection généreux, parce qu'un rayon de télémétrie qui rate
un point de deux pixels ne rapporterait jamais rien :

```ts
  private readonly boitesSenties: {
    minX: number
    minY: number
    maxX: number
    maxY: number
    materiau: number
  }[]
```

```ts
    // Rayon de détection d'un objet ponctuel. Un laser est un point : sans
    // épaisseur, aucun rayon de télémétrie ne le rencontrerait jamais.
    const HALO = 40
    this.boitesSenties = [
      ...(level.lasers ?? []).map((l) => ({
        minX: l.x - HALO,
        minY: l.y - HALO,
        maxX: l.x + HALO,
        maxY: l.y + HALO,
        materiau: MAT_LASER,
      })),
      ...(level.rails ?? []).flatMap((r) =>
        r.points.map((p) => ({
          minX: p.x - HALO,
          minY: p.y - HALO,
          maxX: p.x + HALO,
          maxY: p.y + HALO,
          materiau: MAT_RAIL,
        })),
      ),
      ...(level.zones ?? [])
        .filter((z) => z.force !== 'libre')
        .map((z) => ({
          minX: z.minX,
          minY: z.minY,
          maxX: z.maxX,
          maxY: z.maxY,
          materiau: MAT_ZONE,
        })),
    ]
```

Dans `tate`, après la boucle des éponges et avant le `return` de fin de portée :

```ts
      for (let j = 0; j < this.boitesSenties.length; j++) {
        const b = this.boitesSenties[j]
        if (px >= b.minX && px <= b.maxX && py >= b.minY && py <= b.maxY) {
          return { distance: d, materiau: b.materiau }
        }
      }
```

- [ ] **Étape 4 : lancer les tests pour les voir passer**

```bash
./node_modules/.bin/vitest run src/rl/capteurs.spec.ts
./node_modules/.bin/tsc --noEmit
```

- [ ] **Étape 5 : commit**

```bash
git add src/rl/capteurs.ts src/rl/capteurs.spec.ts
git commit -m "Les rayons sentent lasers, rails et zones — le mur d'énigme n'est plus invisible"
```

---

### Tâche 5 : les actions glace et vapeur (19 → 21)

**Fichiers :**
- Modifier : `src/rl/env.ts:41-46` (constantes), `src/rl/env.ts:265-300` (`step`)
- Modifier : `src/rl/env.spec.ts`

**Interfaces :**
- Produit : `ACTION_GLACE = 3`, `ACTION_VAPEUR = 4`,
  `ACTION_POUSSE_0 = 5`, `NB_ACTIONS = 21`.
- **Attention à l'ordre :** `ACTION_POUSSE_0` passe de 3 à 5. Tout code qui
  calcule un angle à partir de `action - ACTION_POUSSE_0` continue de marcher,
  mais `src/rl/agent.ts` (`NOMS_ACTIONS`) et `src/rl/pilotes.ts` doivent être
  relus.

**L'hypothèse à vérifier ici :** pousser en vapeur *est* un dash, donc le dash
ne coûte aucune action. Si la lecture de `src/main.ts` (autour de la ligne
11164, `gasDashRange`) montre que le dash est un geste distinct du maintien,
**s'arrêter et le signaler** : le dash deviendrait un bloc de 16 directions
(21 → 37 actions), ce qui change la difficulté de l'apprentissage et n'est pas
une décision à prendre seul.

- [ ] **Étape 1 : écrire le test qui échoue**

Ajouter dans `src/rl/env.spec.ts` :

```ts
describe('EnvSujet21 — les trois états', () => {
  it('compte 21 actions : rien, rassembler, conclure, glace, vapeur, 16 poussées', () => {
    expect(NB_ACTIONS).toBe(21)
    expect(ACTION_POUSSE_0).toBe(5)
  })

  it('passe en glace et y reste', () => {
    const env = new EnvSujet21({ code: '21-01', ...PETIT })
    env.step(ACTION_GLACE)
    expect(env.sim.freezeIntent).toBe(true)
    expect(env.sim.gasIntent).toBe(false)
    env.step(ACTION_RIEN)
    expect(env.sim.freezeIntent).toBe(true)
  })

  it('redemander le même état revient à l’eau, comme la touche du jeu', () => {
    const env = new EnvSujet21({ code: '21-01', ...PETIT })
    env.step(ACTION_GLACE)
    env.step(ACTION_GLACE)
    expect(env.sim.freezeIntent).toBe(false)
    expect(env.sim.gasIntent).toBe(false)
  })

  it('passer en vapeur annule la glace : un seul état à la fois', () => {
    const env = new EnvSujet21({ code: '21-01', ...PETIT })
    env.step(ACTION_GLACE)
    env.step(ACTION_VAPEUR)
    expect(env.sim.freezeIntent).toBe(false)
    expect(env.sim.gasIntent).toBe(true)
  })

  it('reste déterministe avec les nouvelles actions', () => {
    const actions = [ACTION_VAPEUR, ACTION_POUSSE_0, ACTION_POUSSE_0 + 4, ACTION_GLACE]
    const a = new EnvSujet21({ code: '21-01', ...PETIT })
    const b = new EnvSujet21({ code: '21-01', ...PETIT })
    expect(suite(a, actions)).toEqual(suite(b, actions))
  })
})
```

Ajouter `ACTION_GLACE, ACTION_VAPEUR` à l'import de `./env`.

- [ ] **Étape 2 : lancer le test pour le voir échouer**

```bash
./node_modules/.bin/vitest run src/rl/env.spec.ts -t "trois états"
```

Attendu : ÉCHEC — `ACTION_GLACE` n'est pas exporté, `NB_ACTIONS` vaut 19.

- [ ] **Étape 3 : écrire l'implémentation minimale**

Dans `src/rl/env.ts`, remplacer le bloc de constantes :

```ts
export const DIRECTIONS = 16
export const ACTION_RIEN = 0
export const ACTION_RASSEMBLE = 1
export const ACTION_CONCLURE = 2
/**
 * Les deux BASCULES d'état, exactement les touches F et G du jeu : redemander
 * l'état courant y renonce et revient à l'eau. Le dash ne figure pas ici —
 * pousser en vapeur EST un dash, c'est la règle du jeu et ça évite d'ajouter
 * seize actions dont la politique n'aurait rien à faire en eau.
 */
export const ACTION_GLACE = 3
export const ACTION_VAPEUR = 4
export const ACTION_POUSSE_0 = 5
export const NB_ACTIONS = ACTION_POUSSE_0 + DIRECTIONS
```

Dans `step`, juste après le garde `if (this.fin !== 'en-cours')` et avant le
traitement de `ACTION_CONCLURE` :

```ts
    // LES BASCULES D'ÉTAT sont instantanées : elles ne consomment pas la
    // décision en pas physiques, elles changent l'intention que les pas
    // suivants appliqueront. C'est ce que fait le joueur en pressant F.
    if (action === ACTION_GLACE) {
      const etait = sim.freezeIntent
      sim.freezeIntent = !etait
      sim.gasIntent = false
    } else if (action === ACTION_VAPEUR) {
      const etait = sim.gasIntent
      sim.gasIntent = !etait
      sim.freezeIntent = false
    }
```

**Attention :** `const sim = this.sim` est déclaré plus bas dans la méthode ;
remonter cette déclaration au-dessus du bloc ci-dessus.

- [ ] **Étape 4 : lancer les tests pour les voir passer**

```bash
./node_modules/.bin/vitest run src/rl/env.spec.ts
./node_modules/.bin/tsc --noEmit
```

Corriger `NOMS_ACTIONS` dans `src/rl/agent.ts` pour qu'il reste aligné :

```ts
export const NOMS_ACTIONS: string[] = (() => {
  const noms = ['attend', 'se rassemble', 'conclut', 'passe en glace', 'passe en vapeur']
  const fleches = ['→', '↗', '↗', '↑', '↑', '↖', '↖', '←', '←', '↙', '↙', '↓', '↓', '↘', '↘', '→']
  for (let k = 0; k < DIRECTIONS; k++) noms.push(`vise ${fleches[k]}`)
  return noms
})()
```

- [ ] **Étape 5 : commit**

```bash
git add src/rl/env.ts src/rl/env.spec.ts src/rl/agent.ts
git commit -m "Glace et vapeur : l'agent joue enfin au même jeu que nous"
```

---

### Tâche 6 : le pont vers l'écran

**Fichiers :**
- Modifier : `src/rl/agent.ts` (interface `Ordre`, `ordre()`)
- Modifier : `src/main.ts:11196-11202`
- Modifier : `src/rl/agent.spec.ts`

**Interfaces :**
- Produit : `Ordre` gagne un champ `etat: 'eau' | 'glace' | 'vapeur'`.
- Consomme : `ACTION_GLACE`, `ACTION_VAPEUR` de la tâche 5.

**Pourquoi c'est indispensable :** sans cette tâche, l'agent sait décider de
passer en vapeur à l'entraînement mais ne peut pas le faire à l'écran. Les deux
mondes divergeraient exactement sur ce que ce plan ajoute.

- [ ] **Étape 1 : écrire le test qui échoue**

Ajouter dans `src/rl/agent.spec.ts` :

Le bloc `describe('AgentEnJeu — il ne parle au jeu que par le doigt')` de
`src/rl/agent.spec.ts:93` définit déjà les deux aides nécessaires : `agentDe(action)`
et `sim(cx, cy, swallowed?)`. **Ajouter ce nouveau bloc à l'intérieur du même
`describe`**, sous les tests existants, pour en hériter :

```ts
  it('demande l’eau par défaut', () => {
    expect(agentDe(ACTION_RIEN).ordre(sim(0, 0), 0).etat).toBe('eau')
  })

  it('demande la vapeur quand la politique choisit la vapeur', () => {
    expect(agentDe(ACTION_VAPEUR).ordre(sim(0, 0), 0).etat).toBe('vapeur')
  })

  it('revient à l’eau si la politique redemande le même état', () => {
    const agent = agentDe(ACTION_GLACE)
    const s = sim(0, 0)
    expect(agent.ordre(s, 0).etat).toBe('glace')
    expect(agent.ordre(s, 1).etat).toBe('eau')
  })

  it('ne pose pas le doigt pour une bascule d’état : changer d’état n’est pas viser', () => {
    expect(agentDe(ACTION_GLACE).ordre(sim(0, 0), 0).tient).toBe(false)
  })
```

Ajouter `ACTION_GLACE, ACTION_VAPEUR` à l'import de `./env` en tête de
`agent.spec.ts`.

- [ ] **Étape 2 : lancer le test pour le voir échouer**

```bash
./node_modules/.bin/vitest run src/rl/agent.spec.ts -t "états passent"
```

Attendu : ÉCHEC — `etat` n'existe pas sur `Ordre`.

- [ ] **Étape 3 : écrire l'implémentation minimale**

Dans `src/rl/agent.ts`, ajouter au champ de l'interface `Ordre` :

```ts
  /** L'état demandé au corps — ce que ferait le joueur avec F et G. */
  etat: 'eau' | 'glace' | 'vapeur'
```

Dans la classe qui produit l'ordre, tenir l'état courant et le basculer :

```ts
  private etat: 'eau' | 'glace' | 'vapeur' = 'eau'
```

```ts
    if (action === ACTION_GLACE) this.etat = this.etat === 'glace' ? 'eau' : 'glace'
    else if (action === ACTION_VAPEUR) this.etat = this.etat === 'vapeur' ? 'eau' : 'vapeur'
```

et renseigner `etat: this.etat` dans l'objet `Ordre` retourné. Réinitialiser
`this.etat = 'eau'` là où l'agent est remis à zéro pour un nouveau tableau.

Dans `src/main.ts`, dans le bloc `if (agent?.actif && …)` (ligne ≈11196) :

```ts
    const ordre = agent.ordre(sim, run.tableauTime)
    input.aimActive = ordre.tient
    if (ordre.tient) aim = { x: ordre.x, y: ordre.y }
    if (ordre.conclure) continuerVoulu = true
    // L'agent presse F et G comme un joueur. Les zones d'état, appliquées
    // plus bas, écrasent ce choix — c'est la règle du jeu, et elle doit
    // valoir pour lui aussi.
    input.freezeIntent = ordre.etat === 'glace'
    input.gasIntent = ordre.etat === 'vapeur'
    majBadgeAgent()
```

- [ ] **Étape 4 : lancer les tests pour les voir passer**

```bash
./node_modules/.bin/vitest run src/rl/agent.spec.ts
./node_modules/.bin/tsc --noEmit
```

Vérifier à l'écran, en vrai — l'entraînement n'est pas nécessaire, un agent au
hasard suffit à voir le corps changer d'état :

```bash
./node_modules/.bin/vite
```
puis ouvrir `http://localhost:5173/?tableau=1&agent=hasard` et constater que le
corps gèle et se vaporise parfois.

- [ ] **Étape 5 : commit**

```bash
git add src/rl/agent.ts src/rl/agent.spec.ts src/main.ts
git commit -m "L'agent presse F et G : les états franchissent le pont vers l'écran"
```

---

### Tâche 7 : archiver l'ancien format, remettre la suite au vert

**Fichiers :**
- Créer : `public/agents/heritage-43/ppo-berceau.json`,
  `public/agents/heritage-43/berceau.json`, `public/agents/heritage-43/LISEZMOI.md`
- Supprimer : `public/agents/ppo-berceau.json`, `public/agents/berceau.json`,
  `public/agents/live.json`
- Modifier : `docs/apprentissage-par-renforcement.md`
- Modifier : tout test qui écrit `43` ou charge un agent du dépôt

- [ ] **Étape 1 : recenser ce qui casse**

```bash
./node_modules/.bin/vitest run 2>&1 | grep -E "✗|FAIL|×" | head -30
grep -rn "\b43\b" src/rl/*.spec.ts src/rl/*.ts | grep -v capteurs.spec
```

Attendu : la liste exacte des tests à reprendre. Aucun ne doit être supprimé —
chacun est réécrit avec le nouveau compte.

- [ ] **Étape 2 : déplacer les politiques et écrire la note**

```bash
mkdir -p public/agents/heritage-43
git mv public/agents/ppo-berceau.json public/agents/heritage-43/
git mv public/agents/berceau.json public/agents/heritage-43/
git rm public/agents/live.json
```

`public/agents/heritage-43/LISEZMOI.md` :

```markdown
# Les politiques du format à 43 entrées

Ces fichiers ont été entraînés quand l'agent ne percevait que 43 nombres et ne
disposait que de 19 actions — ni glace, ni vapeur, et aucun objet d'énigme dans
son champ. Ils ne sont plus chargeables : l'observation en compte 71 et les
actions 21.

On les garde pour la mesure, pas pour le jeu. `ppo-berceau.json` est la
meilleure politique de cette époque : 1,09 L à l'épreuve à graines fixes,
3 traversées sur 3, sur `21-01`. C'est le chiffre que la version suivante doit
battre pour qu'on puisse dire qu'elle est meilleure.
```

- [ ] **Étape 3 : reprendre les tests recensés**

Remplacer chaque `43` par `71` et chaque compte d'actions `19` par `21`.
Aucune assertion n'est affaiblie ni supprimée.

- [ ] **Étape 4 : mettre la doc à jour**

Dans `docs/apprentissage-par-renforcement.md`, corriger la section des limites
assumées : l'eau n'est plus la seule (glace et vapeur sont là), les objets
d'énigme sont perçus mais **pas encore simulés** — `tableauxRL()` continue de
les écarter jusqu'au plan C.

- [ ] **Étape 5 : la suite complète au vert**

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
```

Attendu : tout vert. Le nombre de tests doit avoir **augmenté** (les ~20
nouveaux de `capteurs.spec.ts` et des tâches 5 et 6).

- [ ] **Étape 6 : commit**

```bash
git add -A
git commit -m "L'ancien format prend sa retraite : 1,09 L est désormais la barre à battre"
```

---

### Tâche 8 : la preuve par l'entraînement

**Fichiers :** aucun. Cette tâche mesure.

**Pourquoi elle existe :** tous les tests peuvent passer et l'agent être devenu
incapable d'apprendre — 71 entrées au lieu de 43, c'est un problème plus dur.
Le plan n'est pas fini tant qu'on ne l'a pas vu apprendre dans le nouveau
format.

- [ ] **Étape 1 : lancer un entraînement court**

```bash
./node_modules/.bin/vite-node src/rl/entrainePPO.ts \
  --tableaux 21-01 --iterations 120 --travailleurs 6 \
  --sortie .rl/apres-plan-a.json
```

- [ ] **Étape 2 : lire la courbe des épreuves**

```bash
./node_modules/.bin/vite-node src/rl/courbe.ts \
  --journal .rl/apres-plan-a.json --serie epreuve
```

**Critère de réussite :** l'épreuve à graines fixes atteint au moins **0,5 L
avec 2 traversées sur 3** avant l'itération 120. C'est en dessous des 1,09 L de
l'ancien format, et c'est voulu : 120 itérations contre 250, et un espace
d'observation plus grand à apprendre.

**Si le critère n'est pas atteint :** ne pas régler les poids de la récompense
pour le forcer. Vérifier d'abord que les nouvelles entrées ne sont pas
dégénérées — une entrée constante à zéro sur tous les pas est un bug de
branchement, pas un problème d'apprentissage :

```bash
./node_modules/.bin/vite-node src/rl/banc.ts --tableaux 21-01
```

- [ ] **Étape 3 : consigner le résultat**

Ajouter le chiffre obtenu au `LISEZMOI.md` de `heritage-43`, en face des
1,09 L, pour que la comparaison soit lisible sans fouiller l'historique.

```bash
git add public/agents/heritage-43/LISEZMOI.md
git commit -m "Le nouveau format apprend : <chiffre> L à l'épreuve en 120 itérations"
```

---

## Ce que ce plan ne fait pas

- **Il ne simule aucune énigme.** Les capteurs voient lasers, cibles, rails et
  zones ; l'environnement ne les fait pas encore agir, et `tableauxRL()`
  continue d'écarter les 8 tableaux concernés. C'est le plan C.
- **Il n'ajoute ni reprise, ni curriculum, ni sessions minutées.** C'est le
  plan B, qui s'appuie sur le format figé ici.
- **Il ne touche pas à la récompense.** Les six poids restent ceux de
  `POIDS_DEFAUT`, et ils ne sont pas encore réglables en ligne de commande.
