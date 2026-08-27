// LE CONDENSAT RAMASSABLE : des pastilles de matière pure posées dans les
// tableaux — les recoins du champ et surtout les CACHETTES, qui gagnent
// enfin une récompense tangible. Le condensat est la monnaie de RUN : la
// purge de fin de run (réussie ou non) le confisque — seule la MÉMOIRE
// (records.ts) survit.
//
// Le semis est DÉTERMINISTE : même tableau, mêmes pastilles — la graine
// est le code de la salle. Un tableau peut aussi poser ses pastilles à la
// main (LevelDef.condensats) : elles remplacent alors le semis.

import { dansForme, type FormeBox } from './formes'
import type { LevelDef, CondensatPose } from './level'

export type CondensatDef = CondensatPose

export const RAYON_PASTILLE = 26 // le rayon de contact (unités monde)
const CL_CACHETTE = 12
const CL_CHAMP = 8
const ECART_MIN = 260 // deux pastilles ne se serrent pas

/** Le hachage du code (FNV-1a) : la graine du semis. */
function hacheCode(txt: string): number {
  let h = 2166136261
  for (let i = 0; i < txt.length; i++) {
    h ^= txt.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Un générateur dédié (mulberry32) : le semis ne dépend de rien d'autre. */
function melange(graine: number): () => number {
  let a = graine >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Le point est-il FRANC : hors de toute pièce, avec une marge de corps ? */
function pointFranc(x: number, y: number, level: LevelDef): boolean {
  for (const b of level.boxes) {
    const fb = b as unknown as FormeBox
    for (const [dx, dy] of [
      [0, 0],
      [34, 0],
      [-34, 0],
      [0, 34],
      [0, -34],
    ] as const) {
      if (dansForme(fb, x + dx, y + dy)) return false
    }
  }
  return true
}

function loinDesAutres(out: CondensatDef[], x: number, y: number): boolean {
  return out.every((p) => Math.hypot(p.x - x, p.y - y) >= ECART_MIN)
}

/** Sème les pastilles d'un tableau. Déterministe (graine = code) ; les
 * pastilles posées à la main (level.condensats) priment sur le semis. */
export function semePastilles(level: LevelDef): CondensatDef[] {
  if (level.condensats && level.condensats.length > 0)
    return level.condensats.map((p) => ({ ...p }))
  const rng = melange(hacheCode(`${level.code}|${level.name}`))
  const out: CondensatDef[] = []

  // les CACHETTES d'abord : une pastille chacune (deux pour les vastes)
  for (const c of level.caches ?? []) {
    const n = (c.maxX - c.minX) * (c.maxY - c.minY) > 500000 ? 2 : 1
    for (let k = 0; k < n; k++) {
      for (let essai = 0; essai < 12; essai++) {
        const x = c.minX + 50 + rng() * Math.max(1, c.maxX - c.minX - 100)
        const y = c.minY + 50 + rng() * Math.max(1, c.maxY - c.minY - 100)
        if (!dansForme(c as unknown as FormeBox, x, y)) continue
        if (!pointFranc(x, y, level)) continue
        if (!loinDesAutres(out, x, y)) continue
        out.push({ x: Math.round(x), y: Math.round(y), cl: CL_CACHETTE })
        break
      }
    }
  }

  // le CHAMP ensuite : quelques pastilles au large, jamais sur le départ,
  // jamais sur le sas, jamais dans une cachette (elles ont les leurs)
  const b = level.bounds
  const aire = (b.maxX - b.minX) * (b.maxY - b.minY)
  const vises = Math.max(2, Math.min(4, Math.round(aire / 6000000)))
  const ex = (level.exit.minX + level.exit.maxX) / 2
  const ey = (level.exit.minY + level.exit.maxY) / 2
  let poses = 0
  for (let essai = 0; essai < 140 && poses < vises; essai++) {
    const x = b.minX + 120 + rng() * Math.max(1, b.maxX - b.minX - 240)
    const y = b.minY + 120 + rng() * Math.max(1, b.maxY - b.minY - 240)
    if (Math.hypot(x - level.spawn.x, y - level.spawn.y) < 500) continue
    if (Math.hypot(x - ex, y - ey) < 320) continue
    if (
      (level.caches ?? []).some(
        (c) => x > c.minX && x < c.maxX && y > c.minY && y < c.maxY,
      )
    )
      continue
    if (!pointFranc(x, y, level)) continue
    if (!loinDesAutres(out, x, y)) continue
    out.push({ x: Math.round(x), y: Math.round(y), cl: CL_CHAMP })
    poses++
  }
  return out
}

/** Ce que l'absorption lit du corps — le sous-ensemble utile de FluidSim. */
export interface CorpsLecture {
  count: number
  kind: Uint8Array
  posX: Float32Array
  posY: Float32Array
}
const KIND_JOUEUR = 1

/** L'absorption par CONTACT : une pastille est bue quand assez de
 * particules du corps la touchent. Marque `prises` et rend les indices
 * absorbés ce pas-ci. Pure : testable sans moteur. */
export function absorbePastilles(
  pastilles: readonly CondensatDef[],
  prises: boolean[],
  corps: CorpsLecture,
  rayon = RAYON_PASTILLE + 14,
  seuil = 5,
): number[] {
  const bues: number[] = []
  const r2 = rayon * rayon
  for (let pi = 0; pi < pastilles.length; pi++) {
    if (prises[pi]) continue
    const p = pastilles[pi]
    let n = 0
    for (let i = 0; i < corps.count; i++) {
      if (corps.kind[i] !== KIND_JOUEUR) continue
      const dx = corps.posX[i] - p.x
      const dy = corps.posY[i] - p.y
      if (dx * dx + dy * dy < r2 && ++n >= seuil) {
        prises[pi] = true
        bues.push(pi)
        break
      }
    }
  }
  return bues
}
