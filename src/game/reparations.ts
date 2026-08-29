// LES RÉPARATIONS DU HUB — l'accident du télescope a laissé le module
// Méduse en panne : chaque station se remet en état AU CONTACT, payée en
// MÉMOIRE (records.repare). Le hub défini dans hub.ts (ou l'instantané de
// la bibliothèque) est le hub CIBLE, réparé : ce module DÉGRADE ce qui ne
// l'est pas encore — appliqueReparations retourne un clone, jamais une
// mutation, et un vieil instantané sans zones méta passe tel quel.
//
// Les ailes condamnées passent par level.portes (canal NÉGATIF : des
// portes scénarisées qu'aucun faisceau n'ouvre) : le pipeline existant
// les pose au solveur (setDoors) et les dessine en barrières d'énergie —
// une réparation payée les lève À CHAUD, sans respawn.

import type { LevelDef, PorteDef, WorldLabel } from './level'
import { zonesDuHub } from './hub'

export interface ReparationDef {
  id: string
  nom: string // 'RÉSEAU D'ÉCLAIRAGE' — la plaque de la station
  detail: string // la ligne du toast au succès
  icone: string
  prix: number // en MÉMOIRE
  /** Les textes de pancartes (exacts) retirés tant que la station est en
   * panne — la signalétique de l'état réparé ne ment jamais. */
  labelsCaches: string[]
  /** En panne, les écrans (ecran-on) DANS le plot de la station
   * s'éteignent (ecran-off). */
  eteintEcrans?: boolean
  /** En panne, tout le module s'assombrit : ambiante et lumières
   * réduites, la brume monte (le réseau d'éclairage). */
  assombrit?: boolean
  /** En panne, une PORTE d'énergie condamne l'aile (clé de
   * ZonesHub.portesDegat). */
  porte?: boolean
}

export const REPARATIONS: ReparationDef[] = [
  {
    id: 'eclairage',
    nom: 'RÉSEAU D’ÉCLAIRAGE',
    detail: 'le module se rallume — la brume de panne se dissipe',
    icone: '💡',
    prix: 10,
    labelsCaches: [],
    assombrit: true,
  },
  {
    id: 'table-depart',
    nom: 'TABLE DE DÉPART',
    detail: 'le plan de travail récapitule ce que vous emportez',
    icone: '🗺️',
    prix: 15,
    labelsCaches: ['LA TABLE DE DÉPART|CE QUE VOUS EMPORTEZ'],
    eteintEcrans: true,
  },
  {
    id: 'mur-records',
    nom: 'MUR DES RECORDS',
    detail: 'le banc optique des calibrations se rallume',
    icone: '📊',
    prix: 20,
    labelsCaches: ['LE MUR DES RECORDS|BANC OPTIQUE DES CALIBRATIONS'],
    eteintEcrans: true,
  },
  {
    id: 'bac-sable',
    nom: 'BAC D’ESSAI',
    detail: 'toutes les surfaces, sans enjeu — la cuve redevient un atelier',
    icone: '🧪',
    prix: 30,
    labelsCaches: ['LE BAC D’ESSAI|TOUTES LES SURFACES, SANS ENJEU'],
    porte: true,
  },
  {
    id: 'distillateur',
    nom: 'DISTILLATEUR DE PRIMES',
    detail: 'chaque retour de descente versera sa prime de mémoire',
    icone: '⚗️',
    prix: 40,
    labelsCaches: ['LE DISTILLATEUR|LA PRIME DU RETOUR'],
  },
  {
    id: 'aile-endormis',
    nom: 'AILE DES ENDORMIS',
    detail: 'les capsules des semblables sont de nouveau accessibles',
    icone: '🫙',
    prix: 50,
    labelsCaches: ['L’AILE DES ENDORMIS|NE PAS RÉVEILLER'],
    porte: true,
  },
  {
    id: 'passerelle-4',
    nom: 'PASSERELLE DU SECTEUR 4',
    detail: 'le couloir est dégagé — le sas, lui, reste scellé',
    icone: '🛠️',
    prix: 60,
    labelsCaches: [],
    porte: true,
  },
]

export function reparationDef(id: string): ReparationDef | null {
  return REPARATIONS.find((r) => r.id === id) ?? null
}

// le canal des portes de dégât : négatif (scénarisé), un cran par station
// pour que chaque porte garde son identité dans level.portes
const CANAL_DEGAT = -21

/** Le hub tel que l'accident l'a laissé : le CIBLE (base), dégradé pour
 * chaque réparation non payée. Clone superficiel — base n'est JAMAIS
 * modifié (c'est peut-être l'entrée partagée de la bibliothèque). Un
 * tableau sans zones méta (vieil instantané) revient tel quel. */
export function appliqueReparations(
  base: LevelDef,
  faites: readonly string[],
  cuveClose = false,
): LevelDef {
  const zones = zonesDuHub(base)
  if (!zones) return base
  const manquantes = REPARATIONS.filter((r) => !faites.includes(r.id))
  // tout est réparé : le hub cible, avec son seul SCEAU du secteur 4
  const labels: WorldLabel[] = [...(base.labels ?? [])]
  let decals = base.decals ? [...base.decals] : undefined
  let lumieres = base.lumieres ? [...base.lumieres] : undefined
  let ambiante = base.ambiante
  let brume = base.brume
  const portes: PorteDef[] = [...(base.portes ?? [])]

  // LA PORTE DE LA CUVE (acte 0) : le sujet naît enfermé — la séquence
  // ALERTE crève la brèche d'INDEX 0, cette porte doit donc rester la
  // toute première de la liste
  if (cuveClose) portes.unshift({ ...zones.porteCuve, canal: CANAL_DEGAT })

  // LE SCEAU : tant que l'arc du récit n'est pas achevé, le secteur 4
  // reste condamné — même passerelle réparée. (La fin le lèvera.)
  portes.push({ ...zones.sceau, canal: CANAL_DEGAT })

  for (const r of manquantes) {
    const plot = zones.stations[r.id]
    // la signalétique de l'état réparé se tait…
    for (const t of r.labelsCaches) {
      const i = labels.findIndex((l) => l.text === t)
      if (i >= 0) labels.splice(i, 1)
    }
    // …et la plaque de PANNE prend sa place, sur le plot de la station
    if (plot) {
      labels.push({
        x: (plot.minX + plot.maxX) / 2,
        y: (plot.minY + plot.maxY) / 2,
        text: `${r.nom} — EN PANNE|RÉPARER · ${r.prix} MÉMOIRE`,
        tone: 'chaud',
      })
    }
    if (r.eteintEcrans && decals && plot) {
      decals = decals.map((d) =>
        d.kind === 'ecran-on' &&
        d.x >= plot.minX - 400 &&
        d.x <= plot.maxX + 400 &&
        d.y >= plot.minY - 400 &&
        d.y <= plot.maxY + 400
          ? { ...d, kind: 'ecran-off' as const }
          : d,
      )
    }
    if (r.assombrit) {
      ambiante = (ambiante ?? 0.52) * 0.62
      brume = Math.min(1, (brume ?? 0) + 0.35)
      if (lumieres)
        lumieres = lumieres.map((l) => ({
          ...l,
          intensite: (l.intensite ?? 1) * 0.3,
        }))
    }
    if (r.porte) {
      const rect = zones.portesDegat[r.id]
      if (rect) portes.push({ ...rect, canal: CANAL_DEGAT })
    }
  }

  return {
    ...base,
    labels,
    ...(decals ? { decals } : {}),
    ...(lumieres ? { lumieres } : {}),
    ...(ambiante !== undefined ? { ambiante } : {}),
    ...(brume !== undefined ? { brume } : {}),
    portes,
  }
}
