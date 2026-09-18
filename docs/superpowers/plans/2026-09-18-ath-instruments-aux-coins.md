# L'ATH en instruments aux coins — plan d'exécution

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** remplacer les deux bandes de l'interface en jeu par trois coins d'instruments et un cadran, sans panneau, avec un tiroir pour les commandes rares et un mode DISCRET.

**Architecture:** les ids que `main.ts` et les tests cherchent ne changent pas ; on change leurs conteneurs (`index.html`) et leur CSS. La logique nouvelle vit dans quatre modules purs testés (`athPictos`, `athTiroir`, `athRepos`, `athZones`) ; `main.ts` ne fait que les brancher. Un test de contrat (`ath.spec.ts`) lit `index.html` et `main.ts` en texte, dans le style du dépôt.

**Tech Stack:** TypeScript strict, Vite 5, Vitest 2 (sans navigateur), DOM + CSS dans `index.html`.

**Spec:** `docs/superpowers/specs/2026-09-18-ath-instruments-aux-coins-design.md`

## Global Constraints

- Branche `claude/ath-instruments-aux-coins`, issue de `dev`. Jamais de poussée sur `dev` ni `prod` ; la fin est une PR vers `dev`.
- Tout en français : code, commentaires (ils disent POURQUOI), messages de commit (symptôme, cause, correctif, vérification). Aucun nom de modèle dans le code ni le corps des commits ; les deux lignes d'attribution de fin de message suivent l'usage du dépôt.
- **Toute taille de texte s'écrit `calc(Npx * var(--ui))`.** Aucune exception.
- Les ids listés dans la spec (« Ce qui garde son nom ») ne sont ni renommés ni supprimés.
- `#hud` reste `pointer-events: none` ; seuls les boutons et la fiole reprennent `auto`.
- Cibles tactiles ≥ 44 px sous `@media (pointer: coarse)`.
- Mode compact = `@media (max-width: 700px), (pointer: coarse) and (max-height: 620px)` — le même qu'aujourd'hui.
- `pnpm` est cassé sur cette machine : appeler les binaires locaux.
  - un fichier de tests : `./node_modules/.bin/vitest run src/game/<fichier>.spec.ts`
  - tout : `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run && ./node_modules/.bin/vite build`
- Les numéros de ligne cités sont ceux de `dev` au 18/09/2026 ; **retrouver chaque bloc par son sélecteur ou son commentaire**, les numéros glissent d'une tâche à l'autre.
- Pas de WebGL 2 sur cette machine : aucune vérification visuelle locale. La relecture à l'œil se fait sur un aperçu (tâche 12).

## Les fichiers

| fichier | rôle |
| --- | --- |
| `src/game/athPictos.ts` (+ `.spec.ts`) | créé — les tracés des pictogrammes, `picto(nom)` |
| `src/game/athTiroir.ts` (+ `.spec.ts`) | créé — les entrées du tiroir |
| `src/game/athZones.ts` (+ `.spec.ts`) | créé — `Rect`, zones interdites aux pancartes |
| `src/game/athRepos.ts` (+ `.spec.ts`) | créé — l'automate du repos, le réglage |
| `src/game/ath.spec.ts` | créé — le contrat de l'ATH, grossi tâche après tâche |
| `index.html` | modifié — balisage de `#hud`, `#statebar`, `#tiroir`, PARAMÈTRES ; CSS de l'ATH |
| `src/main.ts` | modifié — barre du bas, tiroir, repos, zones, nettoyage |
| `src/bench/livraisons.ts` | modifié — l'entrée de livraison |

---

### Task 1: Les pictogrammes

**Files:**
- Create: `src/game/athPictos.ts`
- Test: `src/game/athPictos.spec.ts`

**Interfaces:**
- Produces: `PICTOS` (dictionnaire nom → tracé), `type NomPicto = keyof typeof PICTOS`, `picto(nom: NomPicto): string` (un `<svg class="picto" …>` complet).

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/game/athPictos.spec.ts
import { describe, expect, it } from 'vitest'
import { PICTOS, picto, type NomPicto } from './athPictos'

describe('les pictogrammes de l’ATH', () => {
  const noms = Object.keys(PICTOS) as NomPicto[]

  it('couvre le cadran, les commandes, le tiroir et la capsule', () => {
    for (const n of [
      'glace', 'eau', 'vapeur',
      'menu', 'pause', 'lecture', 'editeur',
      'legende', 'etats', 'dossier', 'station', 'recadrer', 'vortex',
      'son', 'muet', 'recommencer', 'fiche', 'banc',
      'coque', 'instruments',
    ])
      expect(noms).toContain(n)
  })

  it('n’écrit que des tracés SVG bien formés', () => {
    for (const n of noms) {
      expect(PICTOS[n], n).toMatch(/^M[0-9MmLlHhVvCcSsQqTtAaZz .,-]+$/)
    }
  })

  it('rend un svg décoratif, sans couleur propre : le CSS le teinte', () => {
    const s = picto('eau')
    expect(s).toContain('viewBox="0 0 24 24"')
    expect(s).toContain('aria-hidden="true"')
    expect(s).toContain(`d="${PICTOS.eau}"`)
    expect(s).not.toMatch(/fill=|stroke=/)
  })
})
```

- [ ] **Step 2: Le voir échouer**

Run: `./node_modules/.bin/vitest run src/game/athPictos.spec.ts`
Expected: FAIL — « Failed to resolve import "./athPictos" ».

- [ ] **Step 3: Écrire le module**

```ts
// src/game/athPictos.ts
// LES PICTOGRAMMES DE L'ATH : une seule famille, au trait.
//
// Le cadran et la barre portaient des emoji (❄ 💧 💨 🛰 🌀 🔊). Un emoji se
// dessine autrement sous Windows, macOS, Android et Steam Deck : l'unité
// graphique en souffrait, et aucun ne ressemble à un instrument de 1970.
// Ici, un tracé par nom, dans une boîte de 24 × 24 ; le trait (1,6) et la
// couleur viennent du CSS (`.picto`), donc du texte qui l'entoure.

export const PICTOS = {
  glace:
    'M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M12 6.5l-2-2M12 6.5l2-2M12 17.5l-2 2M12 17.5l2 2',
  eau: 'M12 3.5c3.2 4.2 5.5 7.3 5.5 10.2a5.5 5.5 0 0 1-11 0C6.5 10.8 8.8 7.7 12 3.5z',
  vapeur:
    'M8 20c-2-3 2-5 0-8s2-5 0-8M12 20c-2-3 2-5 0-8s2-5 0-8M16 20c-2-3 2-5 0-8s2-5 0-8',
  menu: 'M4 7h16M4 12h16M4 17h16',
  pause: 'M9 5v14M15 5v14',
  lecture: 'M8 5l11 7-11 7z',
  editeur: 'M9 7l-5 5 5 5M4 12h11a5 5 0 0 1 5 5',
  legende: 'M12 4l8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4',
  etats: 'M12 4.5l7.5 13h-15z',
  dossier: 'M4 7h6l2 2h8v10H4z',
  station: 'M8.5 3.5h7l5 5v7l-5 5h-7l-5-5v-7zM12 9v6M9 12h6',
  recadrer: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M12 11v2',
  vortex: 'M12 12a2 2 0 1 1 2 2 4 4 0 1 1-4-4 6 6 0 1 1 6 6',
  son: 'M4 10v4h3l4 3V7l-4 3zM15 9c1.2 1.6 1.2 4.4 0 6M17.5 6.5c2.6 3 2.6 8 0 11',
  muet: 'M4 10v4h3l4 3V7l-4 3zM16 9.5l5 5M21 9.5l-5 5',
  recommencer: 'M5 12a7 7 0 1 0 2.2-5.1M5 4v4h4',
  fiche: 'M7 3h8l3 3v15H7zM10 10h5M10 14h5M10 18h3',
  banc: 'M5 7h14M5 12h14M5 17h14M9 5.5v3M15 10.5v3M8 15.5v3',
  coque: 'M12 4a2 2 0 0 1 2 2v7.5a3.5 3.5 0 1 1-4 0V6a2 2 0 0 1 2-2z',
  instruments: 'M12 20a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM12 12l4-3',
} as const

export type NomPicto = keyof typeof PICTOS

/** Le svg complet d'un pictogramme — décoratif : le nom est porté par le
 *  bouton qui le contient (title, aria-label), jamais par l'image. */
export function picto(nom: NomPicto): string {
  return `<svg class="picto" data-picto="${nom}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${PICTOS[nom]}"/></svg>`
}
```

- [ ] **Step 4: Le voir passer**

Run: `./node_modules/.bin/vitest run src/game/athPictos.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/athPictos.ts src/game/athPictos.spec.ts
git commit -m "Les pictogrammes de l'ATH : une famille au trait, à la place des emoji"
```
(Corps du message : pourquoi les emoji partent ; vérification = le test. Ajouter les deux lignes d'attribution d'usage.)

---

### Task 2: Les entrées du tiroir

**Files:**
- Create: `src/game/athTiroir.ts`
- Test: `src/game/athTiroir.spec.ts`

**Interfaces:**
- Consumes: `NomPicto` (tâche 1) ; `MANOEUVRES` de `src/game/commandes.ts` (existant : `{ id: string; clavier: string | null; … }[]`).
- Produces: `interface EntreeTiroir { id: string; nom: string; picto: NomPicto; manoeuvre: string | null }`, `entreesTiroir(ctx: { vortexActif: boolean }): EntreeTiroir[]`.

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/game/athTiroir.spec.ts
import { describe, expect, it } from 'vitest'
import { entreesTiroir } from './athTiroir'
import { MANOEUVRES } from './commandes'

const RUN = { vortexActif: false }

describe('le tiroir de l’ATH', () => {
  it('range les commandes rares dans l’ordre de la spec', () => {
    expect(entreesTiroir({ ...RUN, vortexActif: true }).map((e) => e.id)).toEqual([
      'legende', 'etats', 'dossier', 'station', 'recadrer',
      'vortex', 'son', 'recommencer', 'fiche', 'banc',
    ])
  })

  it('ne montre le vortex que si le réglage l’active', () => {
    expect(entreesTiroir(RUN).map((e) => e.id)).not.toContain('vortex')
  })

  it('ne cite que des manœuvres qui existent : la touche affichée est la vraie', () => {
    const ids = MANOEUVRES.map((m) => m.id)
    for (const e of entreesTiroir({ ...RUN, vortexActif: true }))
      if (e.manoeuvre !== null) expect(ids, e.id).toContain(e.manoeuvre)
  })

})
```

- [ ] **Step 2: Le voir échouer**

Run: `./node_modules/.bin/vitest run src/game/athTiroir.spec.ts`
Expected: FAIL — import introuvable.

- [ ] **Step 3: Écrire le module**

```ts
// src/game/athTiroir.ts
// LE TIROIR DE L'ATH : ce qui sert une fois par salle n'a pas à rester à
// l'écran. La barre du bas montrait 14 boutons en permanence, sur deux
// rangées ; en colonne sur téléphone, elle dépassait l'écran (~459 px pour
// 390). Trois boutons restent ; le reste se range ici, chacun avec sa touche.

import type { NomPicto } from './athPictos'

export interface EntreeTiroir {
  id: string
  nom: string
  picto: NomPicto
  /** l'id de la manœuvre dans commandes.ts, pour afficher la touche EN
   *  VIGUEUR (le joueur peut l'avoir redéfinie) ; null = pas de touche */
  manoeuvre: string | null
}

const ENTREES: EntreeTiroir[] = [
  { id: 'legende', nom: 'LÉGENDE', picto: 'legende', manoeuvre: 'legende' },
  { id: 'etats', nom: 'ÉTATS', picto: 'etats', manoeuvre: 'etats' },
  { id: 'dossier', nom: 'DOSSIER', picto: 'dossier', manoeuvre: 'dossier' },
  { id: 'station', nom: 'STATION', picto: 'station', manoeuvre: 'carte' },
  { id: 'recadrer', nom: 'RECADRER', picto: 'recadrer', manoeuvre: 'recadrer' },
  { id: 'vortex', nom: 'VORTEX', picto: 'vortex', manoeuvre: null },
  { id: 'son', nom: 'SON', picto: 'son', manoeuvre: null },
  { id: 'recommencer', nom: 'RECOMMENCER', picto: 'recommencer', manoeuvre: 'recommencer' },
  { id: 'fiche', nom: 'FICHE D’ESSAI', picto: 'fiche', manoeuvre: 'fiche' },
  { id: 'banc', nom: 'BANC', picto: 'banc', manoeuvre: null },
]

/** Les entrées à montrer. `vortexActif` = params.vortexEnabled >= 0.5 : le
 *  vortex est un outil qu'un réglage du banc allume. (Ce qui RESTE à l'écran —
 *  tiroir, pause, temps, et le retour à l'éditeur pendant un essai — n'est pas
 *  une liste : ce sont trois boutons bâtis à la main dans main.ts.) */
export function entreesTiroir(ctx: { vortexActif: boolean }): EntreeTiroir[] {
  return ENTREES.filter((e) => e.id !== 'vortex' || ctx.vortexActif)
}
```

- [ ] **Step 4: Le voir passer**

Run: `./node_modules/.bin/vitest run src/game/athTiroir.spec.ts` — Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/athTiroir.ts src/game/athTiroir.spec.ts
git commit -m "Le tiroir de l'ATH : dix commandes rares, rangées avec leur touche"
```

---

### Task 3: Les zones interdites aux pancartes (module pur)

**Files:**
- Create: `src/game/athZones.ts`
- Test: `src/game/athZones.spec.ts`

**Interfaces:**
- Produces: `interface Rect { left: number; top: number; right: number; bottom: number }`, `zonesInterdites(postes: (Rect | null)[], marge: number): Rect[]`, `pancarteLibre(sx: number, sy: number, hw: number, hh: number, zones: Rect[]): boolean`. (`DOMRect` satisfait `Rect`.)

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/game/athZones.spec.ts
import { describe, expect, it } from 'vitest'
import { pancarteLibre, zonesInterdites } from './athZones'

// un écran de 1280 × 720 : module vital en haut à gauche, cadran en bas
const VITAL = { left: 14, top: 12, right: 250, bottom: 70 }
const CADRAN = { left: 540, top: 640, right: 740, bottom: 706 }

describe('les zones interdites aux pancartes', () => {
  const zones = zonesInterdites([VITAL, null, CADRAN], 10)

  it('ignore les postes absents et gonfle les autres de la marge', () => {
    expect(zones).toHaveLength(2)
    expect(zones[0]).toEqual({ left: 4, top: 2, right: 260, bottom: 80 })
  })

  it('ignore un poste sans surface (masqué)', () => {
    expect(zonesInterdites([{ left: 5, top: 5, right: 5, bottom: 9 }], 10)).toEqual([])
  })

  it('rend le haut de l’écran aux pancartes : seul le coin est pris', () => {
    // l'ancienne bande de 46 px effaçait cette pancarte, au centre-haut
    expect(pancarteLibre(640, 24, 60, 10, zones)).toBe(true)
    expect(pancarteLibre(120, 40, 60, 10, zones)).toBe(false)
  })

  it('rend le bas aussi : à côté du cadran, la pancarte tient', () => {
    expect(pancarteLibre(1000, 680, 60, 10, zones)).toBe(true)
    expect(pancarteLibre(640, 680, 60, 10, zones)).toBe(false)
  })

  it('compte un simple contact de bord comme libre', () => {
    // boîte [260..380] contre zone [..260] : elles se touchent, sans se couvrir
    expect(pancarteLibre(320, 40, 60, 10, zones)).toBe(true)
  })
})
```

- [ ] **Step 2: Le voir échouer**

Run: `./node_modules/.bin/vitest run src/game/athZones.spec.ts` — Expected: FAIL, import introuvable.

- [ ] **Step 3: Écrire le module**

```ts
// src/game/athZones.ts
// OÙ UNE PANCARTE DU MONDE PEUT SE POSER.
//
// L'interface était deux bandes pleine largeur ; main.ts interdisait donc
// aux pancartes 46 px en haut et ~150 px en bas, sur TOUTE la largeur —
// près d'un cinquième de l'écran, pour une interface qui n'en couvrait
// qu'une fraction. L'ATH tient maintenant dans des coins : seuls les
// rectangles réellement occupés sont interdits.

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

/** Les rectangles occupés, gonflés d'une marge de respiration. Un poste
 *  absent (null) ou sans surface (masqué) n'interdit rien. */
export function zonesInterdites(postes: (Rect | null)[], marge: number): Rect[] {
  const zones: Rect[] = []
  for (const p of postes) {
    if (!p || p.right - p.left <= 0 || p.bottom - p.top <= 0) continue
    zones.push({
      left: p.left - marge,
      top: p.top - marge,
      right: p.right + marge,
      bottom: p.bottom + marge,
    })
  }
  return zones
}

/** La pancarte centrée en (sx, sy), de demi-côtés (hw, hh), évite-t-elle
 *  toutes les zones ? Un contact de bord n'est pas un recouvrement. */
export function pancarteLibre(
  sx: number,
  sy: number,
  hw: number,
  hh: number,
  zones: Rect[],
): boolean {
  for (const z of zones) {
    if (sx + hw > z.left && sx - hw < z.right && sy + hh > z.top && sy - hh < z.bottom)
      return false
  }
  return true
}
```

- [ ] **Step 4: Le voir passer** — `./node_modules/.bin/vitest run src/game/athZones.spec.ts` → PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/athZones.ts src/game/athZones.spec.ts
git commit -m "Les pancartes : des zones interdites à la place des deux bandes (module pur)"
```

---

### Task 4: L'automate du repos (module pur)

**Files:**
- Create: `src/game/athRepos.ts`
- Test: `src/game/athRepos.spec.ts`

**Interfaces:**
- Consumes: `Rect` de `./athZones` (tâche 3).
- Produces: `type ReglageAth = 'discret' | 'complet'`, `CLE_REGLAGE_ATH = 'sujet21-ath'`, `DELAI_REPOS_MS = 4000`, `RAYON_EVEIL_PX = 140`, `litReglageAth(brut: string | null): ReglageAth`, `athAuRepos(e: { maintenant: number; dernierGeste: number; reglage: ReglageAth; force: boolean }): boolean`, `pointeurPres(x: number, y: number, postes: Rect[], rayon?: number): boolean`.

- [ ] **Step 1: Écrire le test qui échoue**

```ts
// src/game/athRepos.spec.ts
import { describe, expect, it } from 'vitest'
import { DELAI_REPOS_MS, athAuRepos, litReglageAth, pointeurPres } from './athRepos'

const base = { maintenant: 10_000, dernierGeste: 10_000, reglage: 'discret' as const, force: false }

describe('le repos de l’ATH', () => {
  it('est DISCRET par défaut, et ne reconnaît que « complet » comme refus', () => {
    expect(litReglageAth(null)).toBe('discret')
    expect(litReglageAth('n’importe quoi')).toBe('discret')
    expect(litReglageAth('complet')).toBe('complet')
  })

  it('s’endort après le délai, pas avant', () => {
    expect(athAuRepos({ ...base, maintenant: 10_000 + DELAI_REPOS_MS - 1 })).toBe(false)
    expect(athAuRepos({ ...base, maintenant: 10_000 + DELAI_REPOS_MS })).toBe(true)
  })

  it('ne s’endort jamais en COMPLET', () => {
    expect(athAuRepos({ ...base, maintenant: 99_000, reglage: 'complet' })).toBe(false)
  })

  it('reste éveillé tant qu’on le force (tiroir ouvert, pause, alerte)', () => {
    expect(athAuRepos({ ...base, maintenant: 99_000, force: true })).toBe(false)
  })

  it('se réveille quand le pointeur approche d’un poste', () => {
    const postes = [{ left: 14, top: 650, right: 150, bottom: 706 }]
    expect(pointeurPres(200, 600, postes)).toBe(true) // ~71 px du coin
    expect(pointeurPres(640, 360, postes)).toBe(false)
    expect(pointeurPres(80, 680, postes)).toBe(true) // dedans
  })
})
```

- [ ] **Step 2: Le voir échouer** — `./node_modules/.bin/vitest run src/game/athRepos.spec.ts` → FAIL, import introuvable.

- [ ] **Step 3: Écrire le module**

```ts
// src/game/athRepos.ts
// LE REPOS DE L'ATH : ce dont on ne se sert pas s'estompe.
//
// Les commandes et la capsule d'état ne servent que par moments ; le reste
// du temps elles pèsent sur l'image. En DISCRET, elles s'estompent après
// quelques secondes sans geste vers elles, et reviennent d'un coup. Le
// module vital, lui, ne passe jamais par ici : « le coût est sur la jauge »
// (docs/sujet-vivant.md) — la jauge se lit en continu.

import type { Rect } from './athZones'

export type ReglageAth = 'discret' | 'complet'
export const CLE_REGLAGE_ATH = 'sujet21-ath'
export const DELAI_REPOS_MS = 4000
export const RAYON_EVEIL_PX = 140

/** Le réglage mémorisé. Tout ce qui n'est pas « complet » vaut DISCRET :
 *  c'est le défaut, et une valeur abîmée ne doit pas figer l'interface. */
export function litReglageAth(brut: string | null): ReglageAth {
  return brut === 'complet' ? 'complet' : 'discret'
}

export function athAuRepos(e: {
  maintenant: number
  dernierGeste: number
  reglage: ReglageAth
  /** tiroir ouvert, pause, alerte : l'ATH doit rester lisible */
  force: boolean
}): boolean {
  if (e.reglage === 'complet' || e.force) return false
  return e.maintenant - e.dernierGeste >= DELAI_REPOS_MS
}

/** Le pointeur est-il à moins de `rayon` d'un des postes ? */
export function pointeurPres(
  x: number,
  y: number,
  postes: Rect[],
  rayon = RAYON_EVEIL_PX,
): boolean {
  for (const p of postes) {
    const dx = Math.max(p.left - x, 0, x - p.right)
    const dy = Math.max(p.top - y, 0, y - p.bottom)
    if (Math.hypot(dx, dy) <= rayon) return true
  }
  return false
}
```

- [ ] **Step 4: Le voir passer** — PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/athRepos.ts src/game/athRepos.spec.ts
git commit -m "Le repos de l'ATH : l'automate et son réglage (module pur)"
```

---

### Task 5: Le haut de l'écran — module vital et capsule d'état

**Files:**
- Create: `src/game/ath.spec.ts`
- Modify: `index.html` — balisage `#hud` (~9268-9331), balisage `#voie-hud` (~10659-10665), CSS « HUD : la bande de vie » (~4951-5143), CSS `#voie-hud` (~736-781), CSS `#hud-danger` (~5163), bloc compact (~6232-6309)
- Modify: `src/main.ts` — `hudVolume.innerHTML` (~19477), `hudCoque.classList.toggle` (~19426)

**Interfaces:**
- Consumes: `PICTOS` (tâche 1) — les svg écrits en dur dans `index.html` doivent porter le même tracé.
- Produces: les conteneurs `.ath-coin.ath-vital` et `.ath-coin.ath-etat` (mesurés par les tâches 8 et 9) ; la classe `.picto` ; le fichier `ath.spec.ts` et ses constantes `HTML`, `MAIN`, `CSS_ATH`.

- [ ] **Step 1: Écrire le contrat qui échoue**

```ts
// src/game/ath.spec.ts
// LE CONTRAT DE L'ATH. Rien ne relie index.html à main.ts qu'un nom écrit en
// toutes lettres : un id renommé donne une interface muette, sans erreur et
// sans test rouge. Et une taille écrite sans --ui échappe au seul réglage
// d'accessibilité du jeu. Ce fichier verrouille les deux.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PICTOS, type NomPicto } from './athPictos'

const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')
const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')

/** Le CSS de l'ATH, entre ses deux bornes écrites dans index.html. */
const CSS_ATH = ((): string => {
  const a = HTML.indexOf('/* ==== ATH : DÉBUT ==== */')
  const b = HTML.indexOf('/* ==== ATH : FIN ==== */')
  return a >= 0 && b > a ? HTML.slice(a, b) : ''
})()

describe('l’ATH garde les noms que le jeu cherche', () => {
  it.each([
    'hud', 'hud-volume', 'bonbonne', 'gauge-fill', 'gauge-threshold',
    'hud-tableau', 'hud-vies', 'hud-vies-chip', 'hud-cond', 'hud-cond-chip',
    'hud-instr', 'hud-instr-chip', 'hud-coque', 'hud-capture',
    'hud-perte', 'hud-rosee', 'hud-fantome',
    'voie-hud', 'vh-rang', 'vh-rail', 'vh-stade',
    'statebar', 'state-eau', 'state-glace', 'state-vapeur', 'state-zone',
    'touchbar', 'hud-danger',
  ])('#%s existe', (id) => {
    expect(HTML).toContain(`id="${id}"`)
  })
})

describe('le haut de l’écran : deux coins, plus de bandeau', () => {
  it('borne son CSS', () => {
    expect(CSS_ATH.length).toBeGreaterThan(0)
  })

  it('range les instruments dans .ath-vital et .ath-etat', () => {
    const hud = HTML.slice(HTML.indexOf('<div id="hud">'), HTML.indexOf('id="rejeu-barre"'))
    const vital = hud.slice(hud.indexOf('ath-vital'), hud.indexOf('ath-etat'))
    const etat = hud.slice(hud.indexOf('ath-etat'))
    for (const id of ['hud-volume', 'bonbonne', 'gauge-fill', 'hud-perte', 'hud-rosee', 'hud-fantome'])
      expect(vital, id).toContain(`id="${id}"`)
    for (const id of ['voie-hud', 'hud-tableau', 'hud-vies', 'hud-cond', 'hud-coque', 'hud-capture'])
      expect(etat, id).toContain(`id="${id}"`)
  })

  it('ne peint plus de bandeau : #hud n’a ni fond ni flou', () => {
    const regle = /#hud \{[^}]*\}/.exec(CSS_ATH)?.[0] ?? ''
    expect(regle).toContain('pointer-events: none')
    expect(regle).not.toMatch(/background|backdrop-filter|border-bottom/)
  })

  it('écrit toutes ses tailles de texte à l’échelle --ui', () => {
    const tailles = CSS_ATH.match(/font-size:[^;]+;/g) ?? []
    expect(tailles.length).toBeGreaterThan(5)
    for (const t of tailles) expect(t).toContain('var(--ui)')
  })

  it('respecte prefers-reduced-motion', () => {
    expect(CSS_ATH).toContain('prefers-reduced-motion: reduce')
  })

  it('écrit en dur les mêmes tracés que le dictionnaire', () => {
    const durs = [...HTML.matchAll(/data-picto="([a-z]+)"[^>]*><path d="([^"]+)"/g)]
    expect(durs.length).toBeGreaterThan(0)
    for (const [, nom, d] of durs) expect(d, nom).toBe(PICTOS[nom as NomPicto])
  })
})

export { HTML, MAIN, CSS_ATH }
```

- [ ] **Step 2: Le voir échouer**

Run: `./node_modules/.bin/vitest run src/game/ath.spec.ts`
Expected: les ids passent ; « borne son CSS », « range les instruments », « ne peint plus », « tailles », « reduced-motion », « tracés » échouent.

- [ ] **Step 3: Réécrire le balisage de `#hud`**

Remplacer tout le bloc, du commentaire `<!-- La bande de vie : …` jusqu'au `</div>` fermant `#hud` (juste avant `<!-- LA BARRE DU REJEU`), par ce qui suit. **Le `<button id="bonbonne">…</button>` est repris tel quel**, avec son svg et ses deux `<span>` : ne pas le retaper, le déplacer.

```html
    <!-- L'ATH, HAUT DE L'ÉCRAN : deux coins, plus de bandeau. À gauche le
         MODULE VITAL (le litrage, la fiole, la jauge et son seuil — ce qu'on
         dépense se lit en continu) ; à droite la CAPSULE D'ÉTAT (où l'on en
         est, ce qu'on porte). #hud n'est qu'une couche : il ne peint rien et
         ne prend aucun toucher. -->
    <div id="hud">
      <div class="ath-coin ath-vital">
        <div class="ath-ligne">
          <div id="hud-volume">— <small>L</small></div>
          <!-- ICI : le <button id="bonbonne" …> existant, inchangé -->
        </div>
        <div class="ath-ligne">
          <div class="gauge">
            <div id="gauge-fill"></div>
            <div id="gauge-threshold"></div>
          </div>
          <span id="hud-perte"></span>
        </div>
        <div class="hud-sous"><span id="hud-rosee"></span><span id="hud-fantome"></span></div>
      </div>
      <div class="ath-coin ath-etat">
        <!-- LE FIL DE LA DESCENTE : un cran par salle, les tiers marqués, le
             record étoilé. Il tenait tout le flanc droit ; il tient ici en
             une ligne, à côté du compte qu'il illustre. -->
        <div id="voie-hud" hidden aria-label="Progression de la descente">
          <div id="vh-rang"></div>
          <div id="vh-rail"></div>
          <div id="vh-stade"></div>
        </div>
        <button type="button" class="hud-chip ath-salle" data-nom="progression de l'expédition"><span class="v" id="hud-tableau">SALLE 1/1</span></button>
        <div class="hud-chips">
          <button type="button" class="hud-chip" data-nom="échantillons de secours — le dernier perdu, la run s'arrête" id="hud-vies-chip"><i class="ico-meta" style="--ic-x:3;--ic-y:1"></i><span class="v" id="hud-vies">×1</span></button>
          <button type="button" class="hud-chip" data-nom="condensat de la run — la matière ramassée, purgée en fin de run" id="hud-cond-chip"><i class="ico-meta" style="--ic-x:2;--ic-y:1"></i><span class="v" id="hud-cond">0 cL</span></button>
          <button type="button" class="hud-chip" data-nom="coque du vaisseau — elle refroidit : la pression du temps" id="hud-coque-chip"><i class="voyant"></i><svg class="picto" data-picto="coque" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4a2 2 0 0 1 2 2v7.5a3.5 3.5 0 1 1-4 0V6a2 2 0 0 1 2-2z"/></svg><span class="v" id="hud-coque">+21°</span></button>
          <button type="button" class="hud-chip" data-nom="instruments embarqués — toucher pour le détail" id="hud-instr-chip" hidden><svg class="picto" data-picto="instruments" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 20a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM12 12l4-3"/></svg><span class="v" id="hud-instr">—</span></button>
          <!-- LA CAPTURE POUR LE CODEX (mode concepteur) : quatre secondes de
               la scène, cadrées 4:3, envoyées à la fiche choisie -->
          <button type="button" class="hud-chip hud-capture" data-dev id="hud-capture" data-nom="capture pour le codex : 4 s de la scène, à envoyer à une fiche">⏺ CAPTURER</button>
        </div>
      </div>
      <!-- relevés secondaires : encore alimentés par le jeu, plus affichés
           (retirés à la tâche 11) -->
      <div class="hud-restes" hidden>
        <i id="coque-bar"><b></b></i>
        <span id="hud-seuil"></span><span id="hud-vitesse"></span>
        <span id="hud-state"></span><span id="hud-warp"></span>
      </div>
    </div>
```

Puis **supprimer** l'ancien `<div id="voie-hud" …>…</div>` et son commentaire `<!-- LE FIL DE LA DESCENTE : …` (~10659-10665) : il vit maintenant dans la capsule.

- [ ] **Step 4: Réécrire le CSS du haut**

Dans le bloc `/* ---- HUD : la bande de vie, sur toutes les plateformes ---- … */` : **remplacer** les règles `#hud`, `body.playing #hud`, `.hud-vie`, `.hud-vie .gauge`, `.hud-chips`, `.hud-chip`, `.hud-chip i`, `.hud-sous`, `#hud-volume`, `#hud-volume small`, `.gauge`, `#gauge-threshold`, `#hud-state.warn, #hud-coque.warn`, `#hud-perte`, `#hud-rosee` par le bloc ci-dessous. **Garder telles quelles** : `.hud-chip[hidden]`, `.ico-meta`, `.hud-chip .ico-meta`, `.hud-chip.ouvert::after`, `.hud-row*`, `#hud-volume .retour`, `#gauge-fill` et ses états, `body.dispersed …`, `@keyframes gaugePulse`, `#hud-fantome*`, `#coque-bar*` — en les plaçant **après** le nouveau bloc, avant la borne de fin.

```css
      /* ==== ATH : DÉBUT ==== */
      /* ---- L'ATH : des instruments aux coins ----
         L'interface était deux bandes : un bandeau de 51 px dont la jauge
         n'occupait que 5, et une barre de 14 boutons. Elle tient maintenant
         dans trois coins et un cadran, SANS PANNEAU : une équerre gravée,
         un voile de nuit juste derrière le texte, et la cuve partout
         ailleurs. #hud n'est plus qu'une couche : il ne peint rien. */
      #hud {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 9;
        opacity: 0;
        transition: opacity 0.5s ease 0.2s;
      }
      body.playing #hud {
        opacity: 1;
      }
      /* le trait des pictogrammes (game/athPictos.ts) : à la couleur et à la
         taille du texte qui l'entoure */
      .picto {
        width: 1.15em;
        height: 1.15em;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.6;
        stroke-linecap: round;
        stroke-linejoin: round;
        vertical-align: -0.2em;
        flex: none;
      }
      .ath-coin {
        position: absolute;
        padding: 10px 12px;
        /* lisible sur le fluide sans le masquer */
        text-shadow: 0 0 6px var(--void), 0 1px 2px var(--void);
        transition: opacity 0.5s ease;
      }
      /* l'équerre gravée : deux filets, pas un cadre */
      .ath-coin::before {
        content: '';
        position: absolute;
        width: 12px;
        height: 12px;
        border: 0 solid var(--line-strong);
      }
      .ath-vital {
        left: calc(14px + env(safe-area-inset-left));
        top: calc(12px + env(safe-area-inset-top));
        display: flex;
        flex-direction: column;
        gap: 7px;
        background: radial-gradient(ellipse at 0 0, rgba(3, 7, 16, 0.66), transparent 72%);
      }
      .ath-vital::before {
        left: 0;
        top: 0;
        border-width: 1px 0 0 1px;
      }
      .ath-etat {
        right: calc(14px + env(safe-area-inset-right));
        top: calc(12px + env(safe-area-inset-top));
        display: grid;
        grid-template-columns: 1fr auto;
        grid-template-areas: 'rail salle' 'lectures lectures' 'stade stade';
        align-items: center;
        justify-items: end;
        gap: 7px 8px;
        background: radial-gradient(ellipse at 100% 0, rgba(3, 7, 16, 0.66), transparent 72%);
      }
      .ath-etat::before {
        right: 0;
        top: 0;
        border-width: 1px 1px 0 0;
      }
      .ath-ligne {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      #hud-volume {
        font-size: calc(24px * var(--ui));
        font-weight: 600;
        line-height: 1;
        color: var(--specimen);
        font-variant-numeric: tabular-nums;
      }
      #hud-volume small {
        font-family: var(--font-display);
        font-weight: 400;
        font-size: calc(9px * var(--ui));
        letter-spacing: 0.18em;
        color: var(--dim);
        margin-left: 6px;
      }
      /* Jauge de volume : courte. Étirée sur toute la largeur, elle ne disait
         rien de plus ; le trait vertical marque le seuil de dernière impulsion */
      .gauge {
        position: relative;
        width: 168px;
        height: 4px;
        flex: none;
        background: rgba(150, 200, 235, 0.14);
        overflow: hidden;
      }
      #gauge-threshold {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        background: var(--alert);
      }
      /* les lignes qui ne parlent pas ne prennent pas de place */
      #hud-perte {
        font-size: calc(10.5px * var(--ui));
        color: #f2a98f;
        letter-spacing: 0.05em;
        white-space: nowrap;
      }
      .hud-sous {
        display: flex;
        gap: 14px;
      }
      .hud-sous:not(:has(span:not(:empty))) {
        display: none;
      }
      #hud-rosee {
        font-size: calc(10px * var(--ui));
        color: #9fd8e8;
        letter-spacing: 0.05em;
      }
      /* la capsule : des lectures séparées par un filet, sans cadre */
      .hud-chips {
        grid-area: lectures;
        display: flex;
        pointer-events: auto;
      }
      .hud-chip {
        position: relative;
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 2px 9px;
        background: transparent;
        border: 0;
        border-left: 1px solid var(--line);
        color: var(--ink);
        font-family: var(--font-mono);
        font-size: calc(11.5px * var(--ui));
        font-variant-numeric: tabular-nums;
        text-shadow: inherit;
        cursor: pointer;
        pointer-events: auto;
      }
      .hud-chips .hud-chip:first-child,
      .hud-chip.ath-salle {
        border-left: 0;
      }
      .hud-chips .hud-chip:last-child {
        padding-right: 0;
      }
      .hud-chip .picto {
        color: var(--dim);
      }
      .hud-chip.ath-salle {
        grid-area: salle;
        padding: 0;
        font-size: calc(12px * var(--ui));
      }
      /* L'AMBRE EST UN VOYANT (charte §3) : une lampe s'allume devant la
         coque quand elle gèle, à la place du pictogramme */
      .voyant {
        display: none;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #f2c98e;
        box-shadow: 0 0 6px #f2c98e;
      }
      .hud-chip.gele .voyant {
        display: block;
      }
      .hud-chip.gele .picto {
        display: none;
      }
      #hud-state.warn,
      #hud-coque.warn {
        color: #f2c98e;
      }
      /* ---- le fil de la descente, dans la capsule ---- */
      #voie-hud {
        display: none;
      }
      /* display: contents : le rail et le stade se posent directement dans la
         grille de la capsule, sans que main.ts ait à connaître la mise en page */
      body.playing #voie-hud:not([hidden]) {
        display: contents;
      }
      #vh-rang {
        display: none; /* le compte est déjà dit par SALLE n/N, juste à côté */
      }
      #vh-rail {
        grid-area: rail;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .vh-cran {
        position: relative;
        width: 7px;
        height: 7px;
        flex: none;
        border-radius: 50%;
        border: 1px solid var(--line-strong);
        transition: background 0.5s, border-color 0.5s, box-shadow 0.5s;
      }
      .vh-franchi {
        background: var(--specimen);
        border-color: var(--specimen);
      }
      .vh-courant {
        background: var(--valid);
        border-color: var(--valid);
        animation: vh-pouls 2.2s ease-in-out infinite;
      }
      @keyframes vh-pouls {
        0%, 100% { box-shadow: 0 0 0 2px rgba(63, 214, 155, 0.25); }
        50% { box-shadow: 0 0 0 5px rgba(63, 214, 155, 0.08); }
      }
      .vh-tiers {
        width: 1px;
        height: 9px;
        flex: none;
        background: var(--line-strong);
      }
      .vh-record::after {
        content: '✦';
        position: absolute;
        left: 50%;
        top: 100%;
        transform: translateX(-50%);
        font-size: calc(7px * var(--ui));
        color: #ffd9a8;
        line-height: 1.2;
      }
      #vh-stade {
        grid-area: stade;
        font-family: var(--font-display);
        font-size: calc(8px * var(--ui));
        letter-spacing: 0.14em;
        color: var(--dim);
      }
      @media (prefers-reduced-motion: reduce) {
        .vh-courant { animation: none; }
        .ath-coin { transition: none; }
      }
```

…puis les règles conservées (liste ci-dessus), puis :

```css
      /* ==== ATH : FIN ==== */
```

Supprimer l'ancien bloc CSS `#voie-hud … #vh-stade` (~736-781), **sauf** son commentaire d'en-tête s'il sert aussi au `#dossier` qui suit (le relire avant de couper), et l'ancienne règle `@media (prefers-reduced-motion)` qui citait `.vh-courant` (~1088-1091) si elle ne cite rien d'autre.

`#hud-danger` : dans sa règle, `top: 62px;` devient `top: calc(14px + env(safe-area-inset-top));`.

- [ ] **Step 5: Le compact**

Dans le bloc `@media (max-width: 700px), (pointer: coarse) and (max-height: 620px)` qui commence par le commentaire « Au doigt : la bande de vie se fait minuscule » : **remplacer** les règles `#hud`, `#hud-volume`, `.hud-chip`, `#hud-danger`, `#hud-perte`, `#hud-rosee` par :

```css
        /* Au doigt : chaque coin tient sur une ligne, et l'essentiel seul */
        .ath-coin {
          padding: 8px 10px;
        }
        .ath-vital {
          left: calc(8px + env(safe-area-inset-left));
          top: calc(6px + env(safe-area-inset-top));
          flex-direction: row;
          flex-wrap: wrap;
          align-items: center;
          gap: 3px 10px;
          max-width: 46vw;
        }
        .ath-etat {
          right: calc(8px + env(safe-area-inset-right));
          top: calc(6px + env(safe-area-inset-top));
          grid-template-columns: auto auto auto;
          grid-template-areas: 'rail salle lectures';
        }
        #hud-volume {
          font-size: calc(18px * var(--ui));
        }
        .gauge {
          width: 118px;
        }
        .hud-chip {
          padding: 2px 7px;
          font-size: calc(10.5px * var(--ui));
        }
        /* les instruments et le stade se lisent au dossier */
        #hud-instr-chip,
        #vh-stade,
        #hud-rosee {
          display: none;
        }
        #hud-perte {
          font-size: calc(9.5px * var(--ui));
        }
        #hud-danger {
          top: calc(8px + env(safe-area-inset-top));
          font-size: calc(10px * var(--ui));
          max-width: 60vw;
          white-space: normal;
          text-align: center;
        }
```

(Laisser pour l'instant les règles `#touchbar`, `#statebar`, `#relance`, `#continuer`, `#tableau-card` de ce bloc : tâches 6, 7 et 11.)

Ce bloc compact est **hors** des bornes `ATH : DÉBUT/FIN` ; vérifier à la main que chacune de ses `font-size` porte `var(--ui)`.

- [ ] **Step 6: Deux lignes de `main.ts`**

Le compte de particules quitte le module vital (il reste au survol) — remplacer :

```ts
  hudVolume.innerHTML = `${sim.liters().toFixed(2)} <small>L · ${sim.aliveCount()} part.</small>`
```
par :
```ts
  // le litrage seul : le compte de particules est une mesure d'atelier, il
  // se lit au survol — l'écran garde ce qui se joue
  hudVolume.innerHTML = `${sim.liters().toFixed(2)} <small>L</small>`
  hudVolume.title = `${sim.aliveCount()} particules`
```

Le voyant de la coque — sous `hudCoque.classList.toggle('warn', chillNow() > 0.75)`, ajouter :
```ts
  hudCoqueChip.classList.toggle('gele', chillNow() > 0.75)
```
et, près de `const hudCoque = el('hud-coque')` (~1700) : `const hudCoqueChip = el('hud-coque-chip')`.

- [ ] **Step 7: Vérifier**

Run: `./node_modules/.bin/vitest run src/game/ath.spec.ts && ./node_modules/.bin/tsc --noEmit`
Expected: tout PASS, 0 erreur de types.
Run: `./node_modules/.bin/vitest run` — Expected: aucune spec existante cassée (`descente`, `ceremonie`, `gardeBoucle`, `miseEnPage`, `amorce-garde`).

- [ ] **Step 8: Commit**

```bash
git add index.html src/main.ts src/game/ath.spec.ts
git commit -m "Le haut de l'écran : un module vital et une capsule d'état, plus de bandeau"
```

---

### Task 6: Le cadran des états

**Files:**
- Modify: `index.html` — balisage `#statebar` (~9347-9358), CSS « Sélecteur d'état » (~5605-5755), `#rejeu-barre` (~5578), `#relance` (~5258), `#continuer` (~5231), bloc compact
- Modify: `src/main.ts` — `publishTouchbarHeight` (~16850-16860)
- Test: `src/game/ath.spec.ts`

**Interfaces:**
- Consumes: `HTML`, `MAIN`, `CSS_ATH` de `ath.spec.ts` ; `PICTOS`.
- Produces: la variable CSS `--cadran-h` (hauteur réelle de `#statebar`), posée sur `<html>` ; `--tb-h` n'existe plus.

- [ ] **Step 1: Ajouter au contrat (échec attendu)**

À la fin de `src/game/ath.spec.ts`, avant l'`export` :

```ts
describe('le cadran des états', () => {
  it('porte des pictogrammes, plus d’emoji', () => {
    const bar = HTML.slice(HTML.indexOf('<div id="statebar"'), HTML.indexOf('id="state-zone"'))
    expect(bar).not.toMatch(/[💧❄💨]/u)
    for (const n of ['eau', 'glace', 'vapeur']) expect(bar).toContain(`data-picto="${n}"`)
  })

  it('ne s’empile plus sur la barre du bas : --tb-h a disparu', () => {
    expect(HTML).not.toContain('--tb-h')
    expect(MAIN).not.toContain('--tb-h')
    expect(MAIN).toContain('--cadran-h')
  })

  it('garde la barre de rejeu dans l’écran en compact', () => {
    // elle héritait de --tb-h (~459 px en colonne) et partait hors écran
    const compact = HTML.slice(HTML.indexOf('/* ATH compact : le bas */'))
    expect(compact.slice(0, 1200)).toContain('#rejeu-barre')
  })
})
```

Run: `./node_modules/.bin/vitest run src/game/ath.spec.ts` — Expected: ces 3 tests FAIL.

- [ ] **Step 2: Le balisage**

Dans `#statebar`, remplacer les trois `<span class="st-ico">…</span>` :

```html
        <span class="st-ico"><svg class="picto" data-picto="eau" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3.5c3.2 4.2 5.5 7.3 5.5 10.2a5.5 5.5 0 0 1-11 0C6.5 10.8 8.8 7.7 12 3.5z"/></svg></span>
```
```html
        <span class="st-ico"><svg class="picto" data-picto="glace" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M12 6.5l-2-2M12 6.5l2-2M12 17.5l-2 2M12 17.5l2 2"/></svg></span>
```
```html
        <span class="st-ico"><svg class="picto" data-picto="vapeur" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 20c-2-3 2-5 0-8s2-5 0-8M12 20c-2-3 2-5 0-8s2-5 0-8M16 20c-2-3 2-5 0-8s2-5 0-8"/></svg></span>
```
(Le test « tracés » de la tâche 5 vérifie qu'ils égalent le dictionnaire.)

- [ ] **Step 3: Le CSS du cadran**

**Déplacer** le bloc du sélecteur d'état à l'intérieur des bornes ATH (juste avant `/* ==== ATH : FIN ==== */`) et y **remplacer** les règles `#statebar`, `#statebar button`, `#statebar .st-ico`, `#statebar .st-label`, `#statebar kbd`, `#statebar button.active`, `#state-eau.active`, `#state-glace.active`, `#state-vapeur .st-ico`, `#state-vapeur.active`, `#statebar button.st-cur`, `#statebar button.st-cur .st-label` par :

```css
      /* ---- Le cadran des états : LA commande du jeu ----
         Trois logements fixes, glace à gauche, liquide au centre, vapeur à
         droite. Des médaillons OCTOGONAUX — la forme des modules sur le plan
         de la station. Le courant est plein, à la couleur de son état ; les
         autres sont en creux, et ne paraissent que si leur transformation
         est tissée. Posé au bord bas : plus rien ne s'empile dessous. */
      #statebar {
        position: fixed;
        left: 50%;
        bottom: calc(14px + env(safe-area-inset-bottom));
        transform: translateX(-50%);
        display: flex;
        align-items: flex-end;
        gap: 10px;
        z-index: 10;
        opacity: 0;
        transition: opacity 0.5s ease 0.2s;
      }
      #statebar button {
        --teinte: var(--specimen);
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 0;
        background: none;
        border: 0;
        color: var(--dim);
        font-family: var(--font-mono);
        cursor: pointer;
        touch-action: manipulation;
        transition: opacity 0.5s ease;
      }
      #state-glace { --teinte: var(--glow); }
      #state-vapeur { --teinte: #f2c98e; }
      #statebar .st-ico {
        display: grid;
        place-items: center;
        width: 42px;
        height: 42px;
        font-size: calc(17px * var(--ui));
        color: var(--teinte);
        background: rgba(10, 20, 32, 0.62);
        clip-path: polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%);
        transition: background 0.15s ease, color 0.15s ease;
      }
      #statebar button:hover .st-ico {
        background: rgba(20, 36, 54, 0.8);
      }
      #statebar button.st-cur {
        cursor: default;
      }
      #statebar button.st-cur .st-ico {
        width: 56px;
        height: 56px;
        font-size: calc(23px * var(--ui));
        color: var(--void);
        background: var(--teinte);
      }
      #statebar .st-label {
        font-family: var(--font-display);
        font-size: calc(8px * var(--ui));
        letter-spacing: 0.18em;
        text-shadow: 0 0 6px var(--void);
      }
      #statebar button.st-cur .st-label {
        color: var(--teinte);
      }
      #statebar kbd {
        position: absolute;
        top: -7px;
        right: -7px;
        font-family: inherit;
        font-size: calc(9px * var(--ui));
        color: var(--dim);
        background: var(--void);
        border: 1px solid var(--line);
        padding: 0 3px;
      }
```

**Garder** (en les déplaçant avec le bloc) : `body.playing #statebar`, `#state-glace/eau/vapeur { order }`, `#statebar button[hidden]`, `.st-verrou` (remplacer son `border-style: dashed` par `#statebar button.st-verrou .st-ico { outline: 1px dashed var(--line-strong); outline-offset: -3px; }`), `#statebar.st-zone …`, `#state-zone` (son `top: -24px` reste), le `@media (pointer: coarse)` des `kbd`. **Supprimer** l'ancien filtre sépia de `#state-vapeur .st-ico` : le pictogramme prend `--teinte`.

Remplacer la partie `#statebar` du bloc compact (~5734-5755) par :

```css
      @media (max-width: 700px), (pointer: coarse) and (max-height: 620px) {
        /* au doigt : colonne à droite, sous le pouce */
        #statebar {
          left: auto;
          right: calc(12px + env(safe-area-inset-right));
          bottom: calc(12px + env(safe-area-inset-bottom));
          transform: none;
          flex-direction: column;
          align-items: center;
          gap: 7px;
        }
        #statebar .st-ico {
          width: 46px;
          height: 46px;
        }
        #statebar button.st-cur .st-ico {
          width: 54px;
          height: 54px;
        }
        #statebar .st-label {
          display: none;
        }
      }
```

- [ ] **Step 4: `--cadran-h` à la place de `--tb-h`**

`main.ts`, remplacer `publishTouchbarHeight` et son branchement par :

```ts
// Le cadran publie sa hauteur réelle : les boutons de relance se posent
// AU-DESSUS de lui. (Avant, tout s'empilait sur la barre du bas via --tb-h ;
// en colonne sur téléphone elle mesurait ~459 px, et la barre de rejeu
// partait hors de l'écran.)
function publieHauteurCadran(): void {
  const h = Math.round(statebarEl.getBoundingClientRect().height)
  if (h > 0) document.documentElement.style.setProperty('--cadran-h', `${h}px`)
}
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(publieHauteurCadran).observe(statebarEl)
} else {
  window.addEventListener('resize', publieHauteurCadran)
}
publieHauteurCadran()
```
(`statebarEl` existe déjà dans `main.ts` — `majCadranEtats` s'en sert. S'il est déclaré PLUS BAS que ce bloc en `const`, déplacer ce bloc juste après sa déclaration.)

`index.html` :
- `#rejeu-barre` : `bottom: calc(var(--tb-h, 56px) + 20px)` → `bottom: calc(14px + env(safe-area-inset-bottom))` (il remplace le cadran, masqué en rejeu).
- `#relance` : `bottom: calc(var(--tb-h, 56px) + 96px)` → `bottom: calc(var(--cadran-h, 76px) + 34px)`.
- `#continuer` : `bottom: calc(var(--tb-h, 56px) + 148px)` → `bottom: calc(var(--cadran-h, 76px) + 86px)`.
- Bloc compact : remplacer les règles `#statebar`, `#relance`, `#continuer` par :

```css
        /* ATH compact : le bas */
        /* le cadran est en colonne à droite : ce qui se centre en bas n'a
           plus rien sous lui, et prend des cotes fixes */
        #relance {
          bottom: calc(14px + env(safe-area-inset-bottom));
        }
        #continuer {
          bottom: calc(66px + env(safe-area-inset-bottom));
        }
        #rejeu-barre {
          bottom: calc(10px + env(safe-area-inset-bottom));
        }
```

- [ ] **Step 5: Vérifier** — `./node_modules/.bin/vitest run src/game/ath.spec.ts && ./node_modules/.bin/tsc --noEmit` → PASS / 0 erreur. Puis `grep -n "tb-h" index.html src/main.ts` → aucune ligne.

- [ ] **Step 6: Commit**

```bash
git add index.html src/main.ts src/game/ath.spec.ts
git commit -m "Le cadran des états : des médaillons octogonaux au bord bas, et --tb-h s'en va"
```

---

### Task 7: Les commandes et le tiroir

**Files:**
- Modify: `index.html` — ajouter `<div id="tiroir" hidden></div>` après `<div id="touchbar"></div>` ; CSS « Barre tactile » (~5757-5891) ; bloc compact (`#touchbar*`, `.tb-break`, `.tb-snd`, `.tb-vortex`) ; la règle `#touchbar { left: 268px }` (~6316-6320) ; `#touchbar button.tb-editor`
- Modify: `src/main.ts` — la fabrique `touchButton` et tous ses appels (~16773-16900, ~17515-17533), les mises à jour par image (~19375-19388, ~19404)
- Test: `src/game/ath.spec.ts`

**Interfaces:**
- Consumes: `picto`, `NomPicto` (tâche 1) ; `entreesTiroir` (tâche 2) ; `toucheDe`, `nomTouche` de `./game/commandes`.
- Produces dans `main.ts` : `let tiroirOuvert: boolean`, `function ouvreTiroir(v: boolean): void` (utilisés par la tâche 9).

- [ ] **Step 1: Ajouter au contrat (échec attendu)**

```ts
describe('les commandes et le tiroir', () => {
  it('a son tiroir dans la coque', () => {
    expect(HTML).toContain('id="tiroir"')
  })

  it('bâtit le tiroir depuis la liste testée, pas depuis une liste recopiée', () => {
    expect(MAIN).toContain('entreesTiroir(')
    expect(MAIN).toContain('toucheDe(')
  })

  it('ne met plus la barre en colonne : c’est elle qui débordait', () => {
    const regles = HTML.match(/#touchbar \{[^}]*\}/g) ?? []
    for (const r of regles) expect(r).not.toContain('flex-direction: column')
  })

  it('n’a plus l’ancienne fabrique à emoji', () => {
    expect(MAIN).not.toContain('touchButton(')
  })
})
```

Run → ces 4 tests FAIL.

- [ ] **Step 2: La fabrique et les boutons (`main.ts`)**

Imports en tête de `main.ts` (suivre l'ordre des imports `./game/…`) :
```ts
import { picto, type NomPicto } from './game/athPictos'
import { entreesTiroir } from './game/athTiroir'
```
(`toucheDe` et `nomTouche` : les ajouter à l'import existant de `./game/commandes` s'ils n'y sont pas.)

Remplacer `touchButton` par :

```ts
// LES COMMANDES DE L'ATH. Trois boutons restent à l'écran (le tiroir, la
// pause, le temps — plus le retour à l'éditeur pendant un essai) ; les
// autres se rangent dans le tiroir, bâti depuis game/athTiroir.ts.
const touchbar = document.getElementById('touchbar') as HTMLDivElement
const tiroir = document.getElementById('tiroir') as HTMLDivElement
function athBouton(
  hote: HTMLElement,
  nom: NomPicto,
  title: string,
  onTap: () => void,
  cls = '',
): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.dataset.picto = nom
  b.innerHTML = picto(nom)
  b.title = title
  b.setAttribute('aria-label', title)
  if (cls) b.className = cls
  b.addEventListener('click', onTap)
  hote.appendChild(b)
  return b
}
/** Change le pictogramme d'un bouton SANS réécrire le DOM à chaque image :
 *  seul le svg est remplacé, le nom et la touche restent. */
function posePicto(b: HTMLButtonElement, nom: NomPicto): void {
  if (b.dataset.picto === nom) return
  b.dataset.picto = nom
  b.querySelector('svg')?.remove()
  b.insertAdjacentHTML('afterbegin', picto(nom))
}
```

Le tiroir — placer ce bloc **après** la définition de `toggleLegend`, `toggleStates`, `toggleBench`. (`ouvreDossier`, `ouvreStation`, `resetAction`, `openHome`, `openEditor` sont appelés DANS des fonctions fléchées : ils peuvent être définis plus bas.)

```ts
let tiroirOuvert = false
const btnTiroir = athBouton(touchbar, 'menu', 'les autres commandes', () =>
  ouvreTiroir(!tiroirOuvert),
)
btnTiroir.setAttribute('aria-expanded', 'false')
btnTiroir.setAttribute('aria-controls', 'tiroir')

function basculeSon(): void {
  audio.resume()
  audio.setEnabled(!audio.enabled)
  if (audio.enabled) {
    bande.eveiller()
  }
  majInviteSon()
  pane?.refresh()
}
const GESTES_TIROIR: Record<string, () => void> = {
  legende: () => toggleLegend(),
  etats: () => toggleStates(),
  dossier: () => ouvreDossier(!dossierOuvert),
  station: () => ouvreStation(true),
  recadrer: () => camera.resetAutoZoom(),
  vortex: () => {
    input.vortexArmed = !input.vortexArmed
  },
  son: () => basculeSon(),
  recommencer: () => resetAction(),
  fiche: () => openHome(),
  banc: () => toggleBench(),
}
const boutonsTiroir: Record<string, HTMLButtonElement> = {}
// toutes les entrées sont bâties, vortex compris : c'est la boucle qui le
// montre ou le masque selon le réglage (params.vortexEnabled peut changer)
for (const e of entreesTiroir({ vortexActif: true })) {
  const b = athBouton(tiroir, e.picto, e.nom, () => {
    // le vortex s'ARME et le son BASCULE : le tiroir reste ouvert pour qu'on
    // voie l'état changer ; tout le reste ouvre autre chose — il cède la place
    if (e.id !== 'vortex' && e.id !== 'son') ouvreTiroir(false)
    GESTES_TIROIR[e.id]()
  })
  b.insertAdjacentHTML('beforeend', `<span class="ti-nom">${e.nom}</span><kbd></kbd>`)
  b.dataset.manoeuvre = e.manoeuvre ?? ''
  boutonsTiroir[e.id] = b
}
const chipLegend = boutonsTiroir.legende
const chipStates = boutonsTiroir.etats
const chipBench = boutonsTiroir.banc
const btnVortex = boutonsTiroir.vortex
const btnSound = boutonsTiroir.son

/** Les touches affichées sont celles EN VIGUEUR : relues à chaque ouverture,
 *  le joueur a pu les redéfinir entre-temps. */
function majTouchesTiroir(): void {
  for (const b of Object.values(boutonsTiroir)) {
    const kbd = b.querySelector('kbd') as HTMLElement
    const m = b.dataset.manoeuvre
    const t = m ? toucheDe(m) : null
    kbd.textContent = t ? nomTouche(t) : ''
    kbd.hidden = !t
  }
}
function ouvreTiroir(v: boolean): void {
  tiroirOuvert = v
  tiroir.hidden = !v
  btnTiroir.classList.toggle('active', v)
  btnTiroir.setAttribute('aria-expanded', String(v))
  if (v) majTouchesTiroir()
}
// un toucher ailleurs le referme — sans RETENIR le toucher : viser la cuve
// avec le tiroir ouvert vise, et le referme au passage
document.addEventListener(
  'pointerdown',
  (ev) => {
    if (!tiroirOuvert) return
    const t = ev.target as Node
    if (tiroir.contains(t) || btnTiroir.contains(t)) return
    ouvreTiroir(false)
  },
  true,
)
// Échap, tiroir ouvert, referme le tiroir — et ne mène PAS à la fiche
window.addEventListener(
  'keydown',
  (ev) => {
    if (!tiroirOuvert || ev.key !== 'Escape') return
    ev.preventDefault()
    ev.stopImmediatePropagation()
    ouvreTiroir(false)
  },
  true,
)
```

Les boutons permanents, dans cet ordre, à la place des anciens appels :
```ts
const btnPause = athBouton(touchbar, 'pause', 'pause (espace)', () => input.togglePause())
```
Le bloc temps — garder `#tb-time` et `#tb-speed`, mais `tbSpeed` devient un bouton qui déplie les pas :
```ts
const tbTime = document.createElement('div')
tbTime.id = 'tb-time'
touchbar.appendChild(tbTime)
let replieTemps = 0
/** ‹ et › ne paraissent que 3 s après un toucher sur ×N (ou au survol) :
 *  la vitesse est une INFO permanente, ses réglages non. */
function deplieTemps(): void {
  tbTime.classList.add('deplie')
  window.clearTimeout(replieTemps)
  replieTemps = window.setTimeout(() => tbTime.classList.remove('deplie'), 3000)
}
const pasTemps = (label: string, title: string, sens: -1 | 1): void => {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'tb-pas'
  b.textContent = label
  b.title = title
  b.addEventListener('click', () => {
    input.stepWarp(sens)
    deplieTemps()
  })
  tbTime.appendChild(b)
}
pasTemps('‹', 'ralentir le temps (,)', -1)
const tbSpeed = document.createElement('button')
tbSpeed.type = 'button'
tbSpeed.id = 'tb-speed'
tbSpeed.textContent = '×1'
tbSpeed.title = 'vitesse du temps simulé — toucher pour la régler'
tbSpeed.addEventListener('click', deplieTemps)
tbTime.appendChild(tbSpeed)
pasTemps('›', 'accélérer le temps (.)', 1)
```
Le retour à l'éditeur reste permanent :
```ts
// Retour à l'éditeur : n'apparaît que pendant l'essai d'un tableau édité
const chipEditor = athBouton(
  touchbar,
  'editeur',
  'revenir à l’éditeur (le tableau est retrouvé tel qu’il était)',
  () => void openEditor(),
  'tb-editor',
)
chipEditor.insertAdjacentHTML('beforeend', '<span class="ti-nom">ÉDITEUR</span>')
chipEditor.style.display = 'none'
```

**Supprimer** : les anciens appels `touchButton(…)` pour LÉGENDE, ÉTATS, BANC, `↩ ÉDITEUR`, `⏸`, `▤`, `🛰`, `🌀`, `⌖`, `🔊`, `↺`, `≡` ; le bloc `{ const brk = … 'tb-break' … }` ; l'ancienne fonction `timeButton`. **Conserver** les commentaires historiques voisins (la puce HUB retirée le 16/09, etc.).

Mises à jour par image (~19375-19404) — remplacer :
```ts
  btnPause.textContent = input.paused ? '▶' : '⏸'
```
par `posePicto(btnPause, input.paused ? 'lecture' : 'pause')`, et
```ts
  btnSound.textContent = audio.enabled ? '🔊' : '🔇'
```
par `posePicto(btnSound, audio.enabled ? 'son' : 'muet')`. Les `classList.toggle('active', …)` de `chipLegend`, `chipStates`, `chipBench`, `btnVortex` et les deux `style.display` restent tels quels.

- [ ] **Step 3: Le balisage et le CSS**

`index.html`, après `<div id="touchbar"></div>` :
```html
    <!-- LE TIROIR : les commandes rares, bâties par main.ts depuis
         game/athTiroir.ts. Il ne met pas la partie en pause. -->
    <div id="tiroir" hidden role="group" aria-label="Autres commandes"></div>
```

**Déplacer** le bloc « Barre tactile » dans les bornes ATH et le **remplacer entièrement** (de `#touchbar {` jusqu'à `#touchbar button.tb-chip.active { … }`, **sauf** la règle `body:not(.playing) #touchbar, … { visibility: hidden }` qu'on garde en y ajoutant `body:not(.playing) #tiroir`) par :

```css
      /* ---- Les commandes : le coin bas-gauche ----
         Trois boutons. Le conteneur épouse ses boutons : tout le reste du
         bas de l'écran laisse passer les gestes de visée. */
      #touchbar {
        position: fixed;
        left: calc(14px + env(safe-area-inset-left));
        bottom: calc(12px + env(safe-area-inset-bottom));
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 12px;
        background: radial-gradient(ellipse at 0 100%, rgba(3, 7, 16, 0.6), transparent 72%);
        pointer-events: none;
        z-index: 10;
        opacity: 0;
        transition: opacity 0.5s ease 0.2s;
      }
      #touchbar::before {
        content: '';
        position: absolute;
        left: 0;
        bottom: 0;
        width: 12px;
        height: 12px;
        border: solid var(--line-strong);
        border-width: 0 0 1px 1px;
      }
      body.playing #touchbar {
        opacity: 1;
      }
      #touchbar button,
      #tiroir button {
        pointer-events: auto;
        cursor: pointer;
        touch-action: manipulation;
        color: var(--ink);
        font-family: var(--font-mono);
        border: 1px solid var(--line-strong);
        background: rgba(10, 20, 32, 0.6);
        transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
      }
      #touchbar button {
        display: grid;
        place-items: center;
        min-width: 36px;
        min-height: 36px;
        padding: 0;
        font-size: calc(16px * var(--ui));
        line-height: 1;
      }
      #touchbar button:hover,
      #tiroir button:hover {
        border-color: var(--specimen);
      }
      #touchbar button.active,
      #tiroir button.active {
        border-color: var(--specimen);
        color: var(--specimen);
        background: rgba(99, 183, 230, 0.16);
      }
      /* Le TEMPS : ×N est une information permanente ; ‹ › ne paraissent
         qu'au survol ou 3 s après un toucher */
      #tb-time {
        display: flex;
        align-items: stretch;
        gap: 4px;
        pointer-events: none;
      }
      #touchbar #tb-speed {
        padding: 0 10px;
        color: var(--dim);
        font-weight: 600;
        font-size: calc(12px * var(--ui));
      }
      #touchbar #tb-speed.actif {
        color: #f2c14e;
        border-color: rgba(242, 193, 78, 0.6);
        background: rgba(242, 193, 78, 0.12);
      }
      #touchbar .tb-pas {
        display: none;
        font-size: calc(20px * var(--ui));
        padding-bottom: 3px; /* ‹ › optiquement centrés */
      }
      #tb-time:hover .tb-pas,
      #tb-time.deplie .tb-pas {
        display: grid;
      }
      /* Retour à l'éditeur : présent seulement pendant l'essai d'un tableau
         édité — il se distingue, c'est le geste le plus fréquent d'un essai */
      #touchbar button.tb-editor {
        display: flex;
        gap: 7px;
        padding: 0 11px;
        color: var(--valid);
        border-color: rgba(63, 214, 155, 0.55);
        background: rgba(63, 214, 155, 0.1);
      }
      .ti-nom {
        font-family: var(--font-display);
        font-size: calc(9px * var(--ui));
        letter-spacing: 0.14em;
      }
      /* ---- Le tiroir : les commandes rares, au-dessus du coin ---- */
      #tiroir {
        position: fixed;
        left: calc(14px + env(safe-area-inset-left));
        bottom: calc(74px + env(safe-area-inset-bottom));
        width: min(330px, calc(100vw - 28px));
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1px;
        background: var(--line);
        border: 1px solid var(--line-strong);
        z-index: 14;
      }
      #tiroir[hidden] {
        display: none;
      }
      #tiroir button {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 38px;
        padding: 0 10px;
        border: 0;
        background: rgba(10, 20, 32, 0.95);
        text-align: left;
        font-size: calc(15px * var(--ui));
      }
      #tiroir .picto {
        color: var(--specimen);
      }
      #tiroir kbd {
        margin-left: auto;
        font-family: var(--font-mono);
        font-size: calc(9px * var(--ui));
        color: var(--dim);
      }
      /* Au doigt : un cran plus grand */
      @media (pointer: coarse) {
        #touchbar button {
          min-width: 44px;
          min-height: 44px;
          font-size: calc(19px * var(--ui));
        }
        #tiroir button {
          min-height: 46px;
        }
        #tiroir kbd {
          display: none; /* pas de clavier sous le pouce */
        }
      }
```

Bloc compact : **supprimer** les règles `#touchbar .tb-snd`, `#touchbar .tb-vortex`, `#touchbar { … flex-direction: column … }`, `.tb-break`, `#touchbar button.tb-chip`, `#touchbar button { min-width: 42px … }` et les remplacer par :
```css
        #touchbar {
          left: calc(8px + env(safe-area-inset-left));
          bottom: calc(6px + env(safe-area-inset-bottom));
          padding: 8px 10px;
        }
        #tiroir {
          left: calc(8px + env(safe-area-inset-left));
          bottom: calc(66px + env(safe-area-inset-bottom));
          width: min(300px, calc(100vw - 16px));
          max-height: calc(100dvh - 80px);
          overflow-y: auto;
        }
```
**Supprimer** aussi le bloc `@media (min-width: 701px) and (pointer: fine), … { #touchbar { left: 268px; } }` et son commentaire (« le panneau de bord occupe le coin bas gauche » : ce panneau n'existe plus, `#home` est masqué en jeu), ainsi que l'ancienne règle isolée `#touchbar button.tb-editor` plus bas (elle est reprise ci-dessus).

- [ ] **Step 4: Vérifier**

Run: `./node_modules/.bin/vitest run src/game/ath.spec.ts && ./node_modules/.bin/tsc --noEmit`
Expected: PASS ; 0 erreur — `tsc` en mode strict signale tout identifiant resté orphelin (`timeButton`, `publishTouchbarHeight`).
Run: `grep -n "touchButton\|tb-chip\|tb-break\|tb-snd\|tb-vortex" src/main.ts index.html` → aucune ligne.

- [ ] **Step 5: Commit**

```bash
git add index.html src/main.ts src/game/ath.spec.ts
git commit -m "Les commandes : trois boutons et un tiroir, à la place des quatorze"
```
(Le corps du message raconte le débordement sur téléphone : ~459 px de colonne pour 390 px d'écran, disparu avec sa cause.)

---

### Task 8: Les pancartes retrouvent l'écran, et le voisinage suit

**Files:**
- Modify: `src/main.ts` — `BANDE_HAUTE`, `bandeBasse`, `bandeMesuree`, `majBandeBasse` (~1566-1598), son appel (~1608), le test des bandes (~1644) ; la flèche du sas (~19660-19672)
- Modify: `index.html` — `#fps-coin` (~3278)
- Test: `src/game/ath.spec.ts`

**Interfaces:**
- Consumes: `zonesInterdites`, `pancarteLibre`, `type Rect` (tâche 3) ; les conteneurs `.ath-vital`, `.ath-etat`, `#touchbar`, `#statebar`.
- Produces dans `main.ts` : `let postesAth: Rect[]` (les rectangles mesurés des postes qui S'ESTOMPENT — capsule, commandes, cadran ; lus par la tâche 9).

- [ ] **Step 1: Ajouter au contrat (échec attendu)**

```ts
describe('les pancartes du monde', () => {
  it('ne connaissent plus de bandes : seuls les postes occupés sont interdits', () => {
    expect(MAIN).not.toContain('BANDE_HAUTE')
    expect(MAIN).not.toContain('bandeBasse')
    expect(MAIN).toContain('pancarteLibre(')
    expect(MAIN).toContain('zonesInterdites(')
  })
})
```

- [ ] **Step 2: Brancher les zones**

Import : `import { pancarteLibre, zonesInterdites, type Rect } from './game/athZones'`.

Remplacer, de `// Bandes réservées à l'interface : …` jusqu'à la fin de `majBandeBasse`, par :

```ts
// OÙ UNE PANCARTE PEUT SE POSER. L'interface était deux bandes : on
// interdisait 46 px en haut et ~150 px en bas, sur toute la largeur. Elle
// tient maintenant dans des coins (game/athZones.ts) : une pancarte ne
// s'efface que si elle TOUCHE un poste.
// Relu quatre fois par seconde — les postes apparaissent avec la partie,
// changent de place en tournant l'écran, et une lecture de mise en page par
// image ne se justifie pas pour ça.
let zonesAth: Rect[] = []
/** les postes qui s'estompent au repos : capsule, commandes, cadran */
let postesAth: Rect[] = []
let zonesMesurees = 0
function majZonesAth(t: number): void {
  if (t - zonesMesurees < 250) return
  zonesMesurees = t
  const mesure = (sel: string): Rect | null => {
    const r = document.querySelector(sel)?.getBoundingClientRect()
    return r && r.width > 0 && r.height > 0 ? r : null
  }
  const vital = mesure('.ath-vital')
  const mobiles = [mesure('.ath-etat'), mesure('#touchbar'), mesure('#statebar')]
  zonesAth = zonesInterdites([vital, ...mobiles], MARGE_PANCARTE)
  postesAth = mobiles.filter((r): r is Rect => r !== null)
}
```
L'appel `majBandeBasse(performance.now())` devient `majZonesAth(performance.now())`.
Le test :
```ts
    if (sy - hh < BANDE_HAUTE || sy + hh > vh - bandeBasse) {
```
devient :
```ts
    if (!pancarteLibre(sx, sy, hw, hh, zonesAth)) {
```
et le commentaire de deux lignes qui le précède devient : `// sur un poste de l'interface : la pancarte serait masquée à moitié — qu'elle s'efface franchement plutôt que de dépasser d'un bouton`. Si `vh` n'est plus lu nulle part dans la fonction après ce changement, `tsc` le dira : le retirer alors.

- [ ] **Step 3: La flèche du sas et le compteur d'images**

La flèche évitait les bandes (`exitSy > 92`, `vh - 140`, bornes `106` et `vh - 152`). Remplacer :
```ts
  const exitOnScreen =
    exitSx > 30 && exitSx < vw - 30 && exitSy > 92 && exitSy < vh - 140
```
par
```ts
  // plus de bandes à éviter : le sas est « à l'écran » dès qu'il est
  // visible, et la flèche se pose sous les coins du haut, au-dessus du
  // cadran et des commandes
  const exitOnScreen =
    exitSx > 30 && exitSx < vw - 30 && exitSy > 30 && exitSy < vh - 30
```
et
```ts
    const ay = Math.min(vh - 152, Math.max(106, exitSy))
```
par
```ts
    const ay = Math.min(vh - 96, Math.max(84, exitSy))
```

`index.html`, `#fps-coin` : `left: 10px; bottom: 10px;` → `right: 10px; bottom: 10px;` avec, au-dessus, le commentaire `/* bas-DROITE : le coin bas-gauche est celui des commandes */`.

- [ ] **Step 4: Vérifier** — `./node_modules/.bin/vitest run src/game/ath.spec.ts src/game/athZones.spec.ts && ./node_modules/.bin/tsc --noEmit` → PASS / 0 erreur.

- [ ] **Step 5: Commit**

```bash
git add index.html src/main.ts src/game/ath.spec.ts
git commit -m "Les pancartes retrouvent le haut et le bas de l'écran : des zones, plus de bandes"
```

---

### Task 9: Le repos et son réglage

**Files:**
- Modify: `index.html` — une ligne de PARAMÈTRES après le bloc FLÈCHE DE CAP (~10374-10380) ; CSS du repos dans les bornes ATH
- Modify: `src/main.ts` — état du réglage près de `flecheVisible` (~3740), rendu du choix près de `renderFleche` (~4150-4175), branchement dans la boucle (près de `majCadranEtats(zoneActive)`, ~19389), réveil dans `majCadranEtats`
- Test: `src/game/ath.spec.ts`

**Interfaces:**
- Consumes: `athAuRepos`, `pointeurPres`, `litReglageAth`, `CLE_REGLAGE_ATH`, `type ReglageAth` (tâche 4) ; `postesAth` (tâche 8) ; `tiroirOuvert` (tâche 7).

- [ ] **Step 1: Ajouter au contrat (échec attendu)**

```ts
describe('le repos de l’ATH', () => {
  it('a son réglage dans PARAMÈTRES', () => {
    expect(HTML).toContain('id="params-ath"')
  })

  it('passe par l’automate testé', () => {
    expect(MAIN).toContain('athAuRepos(')
    expect(MAIN).toContain("'ath-repos'")
  })

  it('n’estompe jamais le module vital ni le médaillon courant', () => {
    const regles = CSS_ATH.match(/body\.ath-repos[^{]*\{[^}]*\}/g) ?? []
    expect(regles.length).toBeGreaterThan(0)
    for (const r of regles) expect(r).not.toContain('.ath-vital')
    expect(regles.join('\n')).toContain(':not(.st-cur)')
  })
})
```

- [ ] **Step 2: Le réglage**

`index.html`, juste après `<div id="params-fleche" …></div>` :
```html
          <div class="params-nom" style="margin-top: 16px">L'INTERFACE EN JEU</div>
          <div class="params-desc">
            Discrète (défaut) : les commandes et la capsule d'état s'estompent
            après quelques secondes sans geste vers elles, et reviennent dès
            qu'on s'en approche. Le litrage et la jauge, eux, ne s'estompent
            jamais. Complète : tout reste affiché, mémorisé.
          </div>
          <div id="params-ath" class="params-choix" role="group" aria-label="Interface en jeu"></div>
```

`main.ts`, import : `import { CLE_REGLAGE_ATH, athAuRepos, litReglageAth, pointeurPres, type ReglageAth } from './game/athRepos'`.
Près de `let flecheVisible = …` :
```ts
let reglageAth: ReglageAth = litReglageAth(localStorage.getItem(CLE_REGLAGE_ATH))
```
Après le bloc `if (choixFleche) { … }` :
```ts
  const choixAth = document.getElementById('params-ath') as HTMLDivElement | null
  if (choixAth) {
    const renderAth = (): void => {
      choixAth.innerHTML = ''
      for (const [cle, label] of [
        ['discret', 'DISCRÈTE'],
        ['complet', 'COMPLÈTE'],
      ] as const) {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = label
        b.className = reglageAth === cle ? 'actif' : ''
        b.addEventListener('click', () => {
          reglageAth = cle
          localStorage.setItem(CLE_REGLAGE_ATH, cle)
          renderAth()
        })
        choixAth.appendChild(b)
      }
    }
    renderAth()
  }
```

- [ ] **Step 3: Le branchement**

Après la définition de `ouvreTiroir` (tâche 7) :
```ts
// LE REPOS (game/athRepos.ts) : main.ts ne fait que dire l'heure du dernier
// geste VERS l'interface. Le stick ne compte pas : il bouge en permanence.
let dernierGesteAth = performance.now()
function reveilleAth(): void {
  dernierGesteAth = performance.now()
}
window.addEventListener(
  'pointermove',
  (ev) => {
    if (pointeurPres(ev.clientX, ev.clientY, postesAth)) reveilleAth()
  },
  { passive: true },
)
for (const sel of ['#touchbar', '#tiroir', '#statebar', '.ath-etat'])
  document.querySelector(sel)?.addEventListener('pointerdown', reveilleAth)
```
Dans `majCadranEtats`, juste après `cadranSignature = sig` : `reveilleAth() // l'état change (clavier, doigt ou manette) : le cadran se montre`.
Dans la boucle, après `majCadranEtats(zoneActive)` :
```ts
  document.body.classList.toggle(
    'ath-repos',
    athAuRepos({
      maintenant: performance.now(),
      dernierGeste: dernierGesteAth,
      reglage: reglageAth,
      // tiroir ouvert, pause, dispersion, jauge en alerte : l'interface
      // doit rester lisible
      force:
        tiroirOuvert ||
        input.paused ||
        sim.dispersed ||
        gaugeFill.classList.contains('danger'),
    }),
  )
```

- [ ] **Step 4: Le CSS** (dans les bornes ATH, en dernier)

```css
      /* ---- Le repos (réglage DISCRÈTE) : ce qui ne sert pas s'estompe.
         Le module vital n'est pas cité ici, et ne doit jamais l'être : « le
         coût est sur la jauge » — elle se lit en continu. ---- */
      body.ath-repos #touchbar {
        opacity: 0.3;
      }
      body.ath-repos #statebar button:not(.st-cur) {
        opacity: 0.3;
      }
      body.ath-repos .ath-etat {
        opacity: 0.62;
      }
      @media (prefers-reduced-motion: reduce) {
        #touchbar,
        #statebar button {
          transition: none;
        }
      }
```
(`body.ath-repos #touchbar` a la même spécificité que `body.playing #touchbar` : il doit rester écrit APRÈS lui.)

- [ ] **Step 5: Vérifier** — `./node_modules/.bin/vitest run src/game/ath.spec.ts src/game/athRepos.spec.ts && ./node_modules/.bin/tsc --noEmit` → PASS / 0 erreur.

- [ ] **Step 6: Commit**

```bash
git add index.html src/main.ts src/game/ath.spec.ts
git commit -m "Le repos de l'ATH : les commandes s'estompent, la jauge jamais — réglage DISCRÈTE / COMPLÈTE"
```

---

### Task 10: Les panneaux de lecture quittent le centre

**Files:**
- Modify: `index.html` — la règle `#legend, #states` (~6044-6062) et sa surcharge compacte (~6214-6228)
- Test: `src/game/ath.spec.ts`

- [ ] **Step 1: Ajouter au contrat (échec attendu)**

```ts
describe('les panneaux de lecture', () => {
  it('ne tombent plus au centre de l’écran, sur le corps', () => {
    const regle = /#legend,\s*#states \{[^}]*\}/.exec(HTML)?.[0] ?? ''
    expect(regle).not.toBe('')
    expect(regle).not.toContain('translate(-50%, -50%)')
    expect(regle).toMatch(/right:\s*0/)
  })
})
```

- [ ] **Step 2: Le volet latéral**

Dans la règle `#legend, #states`, remplacer
```css
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: min(430px, calc(100vw - 24px));
        max-height: min(560px, calc(100vh - 40px));
```
par
```css
        /* VOLET À DROITE, sur le patron du dossier : au centre, le panneau
           tombait pile sur le corps — on lisait la légende sans plus voir
           ce qu'elle légendait */
        top: 0;
        right: 0;
        bottom: 0;
        width: min(430px, 34vw);
        min-width: min(340px, 100vw);
```
`border-left: 2px solid var(--specimen);` reste ; ajouter `padding-top: calc(14px + env(safe-area-inset-top));`.
Dans la surcharge compacte : ajouter `right: auto; min-width: 0;` et passer `max-height: 78vh; max-height: 78dvh;` à `max-height: 60vh; max-height: 60dvh;` (commentaire : « la feuille laisse 40 % de la cuve visible »).

- [ ] **Step 3: Vérifier et commit**

`./node_modules/.bin/vitest run src/game/ath.spec.ts` → PASS.
```bash
git add index.html src/game/ath.spec.ts
git commit -m "LÉGENDE et ÉTATS : un volet à droite, plus un panneau au centre sur le corps"
```

---

### Task 11: Le code mort s'en va

**Files:**
- Modify: `index.html` — `<div id="tutor" …>` (~9681), `#tableau-card` et ses enfants (~10652-10657), `.hud-restes` (dans `#hud`), leurs CSS (`#tutor` ~5455-5506, `#tableau-card` ~5376-5453 et sa surcharge compacte, `#coque-bar` ~5146-5161, `.hud-row*` si plus rien ne l'utilise)
- Modify: `src/main.ts` — le bloc tutoriel (~17591-17715) et son appel `updateTutor(dtReal)` (~19239) ; `tableauCard`, `showTableauCard` et son appel (~1920-1934, ~16303) ; `hudSeuil`, `hudVitesse`, `hudState`, `hudWarp`, `coqueBar` (~1709-1718) et leurs écritures
- Test: `src/game/ath.spec.ts`

- [ ] **Step 1: Ajouter au contrat (échec attendu)**

```ts
describe('le code mort est parti', () => {
  it.each(['id="tutor"', 'id="tableau-card"', 'hud-restes', 'id="coque-bar"'])(
    '%s n’est plus dans la coque',
    (trace) => {
      expect(HTML).not.toContain(trace)
    },
  )

  it('main.ts ne les alimente plus', () => {
    for (const nom of ['updateTutor', 'showTableauCard', 'hudVitesse', 'coqueBar'])
      expect(MAIN, nom).not.toContain(nom)
  })
})
```

- [ ] **Step 2: Retirer, en laissant `tsc` tenir le fil**

1. `main.ts` : supprimer le bloc `// ---- Tutoriel diégétique …` jusqu'à la fin de `updateTutor` (vérifier que rien d'autre n'est pris), la sonde `__tutor`, et l'appel `updateTutor(dtReal)`. **Avant de couper**, relire le commentaire de `updateTutor` qui explique pourquoi il avait été neutralisé (`if (true) return` — retours joueurs : pas de popup à fermer) et le résumer dans le message de commit : c'est la mémoire du dépôt.
2. `main.ts` : supprimer `const tableauCard`, `function showTableauCard`, l'écouteur de `card-fermer`, l'appel `showTableauCard()`. Même soin pour le commentaire.
3. `main.ts` : supprimer `hudSeuil`, `hudVitesse`, `hudState`, `hudWarp`, `coqueBar` et chaque ligne qui y écrit. Chercher aussi `hudState.` et `hudWarp.` (classes `warn`…).
4. Run `./node_modules/.bin/tsc --noEmit` : chaque identifiant orphelin (`tutorActive`, `TUTOR_TEXTS`…) sort en erreur ; les retirer un à un jusqu'à 0 erreur. **Ne pas** retirer une valeur encore lue ailleurs (`speed` alimente `monitor.speed`).
5. `index.html` : supprimer les trois balisages et leurs CSS, y compris `#tableau-card { top: 64px; }` du bloc compact et `#hud-state.warn,` dans le sélecteur partagé avec `#hud-coque.warn`.

- [ ] **Step 3: Vérifier tout**

Run: `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run`
Expected: 0 erreur ; toute la suite verte.
Run: `grep -n "tutor\|tableau-card\|hud-restes" index.html src/main.ts` → aucune ligne (hors éventuel texte de jeu sans rapport : le lire avant de conclure).

- [ ] **Step 4: Commit**

```bash
git add index.html src/main.ts src/game/ath.spec.ts
git commit -m "Le tutoriel neutralisé, le carton vide et les relevés cachés quittent le dépôt"
```

---

### Task 12: La livraison

**Files:**
- Modify: `src/bench/livraisons.ts` — une entrée en tête de `DELIVERIES`
- Modify: `docs/superpowers/specs/2026-09-18-ath-instruments-aux-coins-design.md` — « État » devient « livré sur la branche, à relire à l'œil sur aperçu »

- [ ] **Step 1: Les trois commandes, sans exception**

Run: `./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/vitest run && ./node_modules/.bin/vite build`
Expected: 0 erreur de types ; tous les tests verts (noter le nombre exact affiché) ; build réussi.

- [ ] **Step 2: Mesurer ce qu'on annonce**

Le dépôt interdit d'annoncer un chiffre non mesuré. Relever, pour la note de livraison :
- le nombre de tests : la dernière ligne de `vitest run` ;
- le poids : `git show origin/dev:index.html | wc -c` contre `wc -c index.html`, et `git diff --stat origin/dev -- index.html src/main.ts | tail -1`.

- [ ] **Step 3: L'entrée du journal**

Heure de Paris : `TZ=Europe/Paris date '+%d/%m/%Y %H:%M'`. En tête de `DELIVERIES` :

```ts
  {
    date: '<la sortie de la commande ci-dessus>',
    title: 'L’ATH EN INSTRUMENTS AUX COINS : plus de bandeau ni de barre — trois coins, un cadran, un tiroir',
    notes: [
      'LE CONSTAT : deux bandes barraient l’écran — un bandeau de ~51 px dont la jauge n’occupait que 5, une barre de 14 boutons sur deux rangées — et interdisaient les pancartes du monde sur 46 px en haut et ~150 px en bas. Sur téléphone en paysage, la colonne de boutons faisait ~459 px pour 390 px d’écran : elle sortait par le haut et envoyait la barre de rejeu hors champ.',
      'LE HAUT : à gauche le module vital (le litrage en grand, la fiole, une jauge courte et son seuil — il ne s’estompe jamais) ; à droite la capsule d’état (les crans de la descente à la place du rail du flanc droit, vies, condensat, coque, instruments). Pas de panneau : une équerre gravée et un voile de nuit derrière le texte. L’ambre est un voyant : il s’allume devant la coque quand elle gèle.',
      'LE BAS : le cadran des états en médaillons octogonaux, posé au bord ; trois commandes (tiroir, pause, temps) et un tiroir pour les dix autres, chacune avec sa touche en vigueur. Une seule famille de pictogrammes au trait remplace les emoji.',
      'LE REPOS : PARAMÈTRES → L’INTERFACE EN JEU, DISCRÈTE (défaut) ou COMPLÈTE. Les commandes et la capsule s’estompent après 4 s sans geste vers elles.',
      'AUSSI : LÉGENDE et ÉTATS en volet à droite (ils tombaient sur le corps) ; les pancartes ne s’effacent plus que sur un poste réellement occupé ; le tutoriel neutralisé, le carton vide et les relevés cachés quittent le dépôt.',
      'VÉRIFIÉ : ath.spec (le contrat des ids, des tailles à l’échelle --ui, des tracés), athPictos, athTiroir, athZones, athRepos ; type-check à 0, <N> tests verts, build passé. À L’ŒIL : sur aperçu, bureau et téléphone en paysage.',
    ],
  },
```
Remplacer `<N>` par le nombre relevé au pas 1. Vérifier que les specs du journal restent vertes : `./node_modules/.bin/vitest run src/bench`.

- [ ] **Step 4: Commit, pousser, PR vers `dev`**

```bash
git add src/bench/livraisons.ts docs/superpowers/specs/2026-09-18-ath-instruments-aux-coins-design.md
git commit -m "Livraison : l'ATH en instruments aux coins"
git push -u origin claude/ath-instruments-aux-coins
gh pr create --base dev --title "L'ATH en instruments aux coins" --body "<résumé : le constat, les quatre postes, le tiroir, le repos, ce qui est vérifié, ce qui reste à relire à l'œil>"
```
(Pousser une branche de travail ne déclenche ni CI ni déploiement.)

- [ ] **Step 5: L'aperçu — sur accord du concepteur**

La relecture à l'œil ne peut pas se faire sur cette machine (pas de WebGL 2). **Demander avant** : un aperçu coûte une construction Vercel.
```bash
git push -f origin claude/ath-instruments-aux-coins:previsu-go
```
L'adresse s'affiche en tête du résumé de l'exécution `deploy`. À relire : bureau ET téléphone en paysage ; le tiroir ; le repos ; une alerte de jauge ; un essai depuis l'éditeur (`ÉDITEUR`) ; un rejeu de fantôme en compact (la barre doit rester dans l'écran) ; un mini-jeu des cibles (son cartouche de score, peint en canvas à `y = 52`, ne doit pas chevaucher la bannière d'alerte).
