// LE MARCHAND DU HUB : le Semblable du comptoir vend ce qui DURE.
//
// La décision du concepteur (03/09) : le condensat se perd à la fin de la
// run ; la mémoire est la monnaie durable ; les ORBES d'essence de
// conscience s'achètent ici contre de la mémoire (ou se trouvent en run),
// et l'écran des mémoires les dépense pour tisser les transformations. Le
// marchand vend aussi d'autres AMÉLIORATIONS DURABLES — elles valent à
// chaque descente, pour toujours, là où les provisions du comptoir ne
// valent que pour la suivante.
//
// Ce fichier est le CATALOGUE, pur : ce qui est en vente et à quel prix.
// Les prix des orbes sont ceux du cycle (TransfoCycle.cout) — une seule
// table de valeurs, pas deux qui divergent en silence. L'inventaire et les
// achats vivent dans records.ts ; l'étal, dans main.ts.

import { ORBES, type Orbe } from './carteStation'
import { TRANSFOS_CYCLE, transfoCycle } from './cycle'

export interface Amelioration {
  id: string
  nom: string
  detail: string
  icone: string
  prix: number // en mémoire
}

/** Les améliorations durables. Trois pour commencer — des provisions du
 *  comptoir rendues permanentes : ce sont les effets que le joueur connaît
 *  déjà, et le prix dit qu'on les achète une fois pour toutes. À étoffer
 *  avec le concepteur. */
export const AMELIORATIONS: readonly Amelioration[] = [
  {
    id: 'reserve',
    nom: 'RÉSERVE ÉLARGIE',
    detail: '+0,5 L à la bonbonne au départ de CHAQUE descente, pour toujours',
    icone: '🫙',
    prix: 12,
  },
  {
    id: 'souffle',
    nom: 'SECOND ÉCHANTILLON',
    detail: '+1 vie au départ de chaque descente, pour toujours',
    icone: '💠',
    prix: 20,
  },
  {
    id: 'flair',
    nom: 'FLAIR DE CACHETTE',
    detail: 'les voiles du premier tableau tombent d’emblée, à chaque descente',
    icone: '🗝️',
    prix: 15,
  },
]

export function amelioration(id: string): Amelioration | null {
  return AMELIORATIONS.find((a) => a.id === id) ?? null
}

/** Le prix d'un orbe au marchand — celui de sa transformation. Un orbe
 *  d'état, ou une transformation mystère, n'est pas en vente : null. */
export function prixOrbe(id: string): number | null {
  const t = transfoCycle(id)
  if (!t || t.etat === 'mystere') return null
  return t.cout
}

export interface OrbeEnVente extends Orbe {
  prix: number
  desc: string
}

/** L'étal des orbes : les transformations non mystères, dans l'ordre du
 *  cycle. Les orbes offerts d'origine (fusion, liquéfaction) y figurent —
 *  ils ne servent que sous verrou narratif, et l'étal le dira. */
export function orbesEnVente(): OrbeEnVente[] {
  const out: OrbeEnVente[] = []
  for (const t of TRANSFOS_CYCLE) {
    const prix = prixOrbe(t.id)
    if (prix === null) continue
    const o = ORBES.find((x) => x.id === t.id)
    if (!o) continue
    out.push({ ...o, prix, desc: t.desc })
  }
  return out
}
