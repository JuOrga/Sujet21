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

import type { LevelDef, PorteDef, PupitreDef, WorldLabel } from './level'
import { ancreAbsente, zonesDuHub } from './hub'

export interface ReparationDef {
  id: string
  nom: string // 'RÉSEAU D'ÉCLAIRAGE' — la plaque de la station
  detail: string // la ligne du toast au succès
  icone: string
  prix: number // en MÉMOIRE
  /**
   * Les CLÉS des pancartes retirées tant que la station est en panne — la
   * signalétique de l'état réparé ne ment jamais. Ce furent longtemps les
   * TEXTES exacts, ce qui interdisait de réécrire un panneau du hub sans
   * casser la panne en silence. Une clé se réécrit sans rien casser ; une
   * prose, non.
   */
  labelsCaches: string[]
  /** En panne, les écrans (ecran-on) DANS le plot de la station
   * s'éteignent (ecran-off) — et les PUPITRES de la même bande se taisent :
   * une console morte n'ouvre pas son écran. */
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
    labelsCaches: ['hub.table-depart'],
    eteintEcrans: true,
  },
  {
    id: 'mur-records',
    nom: 'MUR DES RECORDS',
    detail: 'le banc optique des calibrations se rallume',
    icone: '📊',
    prix: 20,
    labelsCaches: ['hub.mur-records'],
    eteintEcrans: true,
  },
  {
    id: 'bac-sable',
    nom: 'BAC D’ESSAI',
    detail: 'toutes les surfaces, sans enjeu — la cuve redevient un atelier',
    icone: '🧪',
    prix: 30,
    labelsCaches: ['hub.bac-sable'],
    porte: true,
  },
  {
    id: 'distillateur',
    nom: 'DISTILLATEUR DE PRIMES',
    detail: 'chaque retour de descente versera sa prime de mémoire',
    icone: '⚗️',
    prix: 40,
    labelsCaches: ['hub.distillateur'],
  },
  {
    id: 'aile-endormis',
    nom: 'AILE DES ENDORMIS',
    detail: 'les capsules des semblables sont de nouveau accessibles',
    icone: '🫙',
    prix: 50,
    labelsCaches: ['hub.aile-endormis'],
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
export interface OptionsHub {
  /** L'acte 0 n'est pas joué : le sujet naît enfermé dans la cuve. */
  cuveClose?: boolean
  /** L'arc du récit est achevé ET la passerelle réparée : le sceau du
   * secteur 4 tombe, la signalétique bascule. */
  finOuverte?: boolean
}

export function appliqueReparations(
  base: LevelDef,
  faites: readonly string[],
  opts: OptionsHub = {},
): LevelDef {
  const zones = zonesDuHub(base)
  if (!zones) return base
  const manquantes = REPARATIONS.filter((r) => !faites.includes(r.id))
  // tout est réparé : le hub cible, avec son seul SCEAU du secteur 4
  const labels: WorldLabel[] = [...(base.labels ?? [])]
  let decals = base.decals ? [...base.decals] : undefined
  let pupitres = base.pupitres ? [...base.pupitres] : undefined
  let lumieres = base.lumieres ? [...base.lumieres] : undefined
  let ambiante = base.ambiante
  let brume = base.brume
  const portes: PorteDef[] = [...(base.portes ?? [])]

  // LA PORTE DE LA CUVE (acte 0) : le sujet naît enfermé — la séquence
  // ALERTE crève la brèche d'INDEX 0, cette porte doit donc rester la
  // toute première de la liste
  if (opts.cuveClose && !ancreAbsente(zones.porteCuve))
    portes.unshift({ ...zones.porteCuve, canal: CANAL_DEGAT })

  // LE SCEAU : tant que l'arc du récit n'est pas achevé, le secteur 4
  // reste condamné — même passerelle réparée. La fin le lève, et la
  // signalétique du scellé bascule.
  if (!opts.finOuverte) {
    if (!ancreAbsente(zones.sceau))
      portes.push({ ...zones.sceau, canal: CANAL_DEGAT })
  } else {
    for (const t of ['hub.secteur-scelle', 'hub.acces-condamne']) {
      const i = labels.findIndex((l) => l.cle === t)
      if (i >= 0) labels.splice(i, 1)
    }
    const sc = zones.sasScelle
    // un module rebâti sans alcôve du secteur 4 : rien à annoncer
    if (!ancreAbsente(sc)) {
      labels.push({
        x: (sc.minX + sc.maxX) / 2,
        y: sc.maxY + 190,
        text: 'LE SECTEUR 4|LA ROUTE DU TÉLESCOPE',
        tone: 'sas',
        rang: 'secteur',
      })
      labels.push({
        x: (sc.minX + sc.maxX) / 2,
        y: sc.minY - 150,
        text: 'LE SAS S’OUVRE|LE CHOIX VOUS APPARTIENT',
        tone: 'sas',
      })
    }
  }

  for (const r of manquantes) {
    const plot = zones.stations[r.id]
    // la signalétique de l'état réparé se tait…
    for (const t of r.labelsCaches) {
      const i = labels.findIndex((l) => l.cle === t)
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
    if (r.eteintEcrans && plot) {
      // Les ÉCRANS DE DÉCOR s'éteignent LARGE (le plot, plus 400 de marge) :
      // la vitrine d'une station déborde son plot de contact.
      if (decals)
        decals = decals.map((d) =>
          d.kind === 'ecran-on' &&
          d.x >= plot.minX - 400 &&
          d.x <= plot.maxX + 400 &&
          d.y >= plot.minY - 400 &&
          d.y <= plot.maxY + 400
            ? { ...d, kind: 'ecran-off' as const }
            : d,
        )
      // Le PUPITRE, lui, s'éteint SERRÉ — sur le plot exact. Un pupitre
      // n'est pas du décor : il rend un service, et la marge de 400 en
      // emporterait d'une salle voisine (le tableau des avaries du centre
      // de contrôle tombait avec le mur des records, à deux pièces de là).
      // En panne il DISPARAÎT plutôt que de rester posé et muet : le corps
      // qui traverse un mur des records éteint ne doit pas voir s'ouvrir le
      // palmarès. Il revient avec la réparation — applyLevel repose le
      // tableau à chaud, la console se rallume.
      if (pupitres)
        pupitres = pupitres.filter((q: PupitreDef) => {
          const cx = (q.minX + q.maxX) / 2
          const cy = (q.minY + q.maxY) / 2
          return !(
            cx >= plot.minX &&
            cx <= plot.maxX &&
            cy >= plot.minY &&
            cy <= plot.maxY
          )
        })
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
      for (const rect of zones.portesDegat[r.id] ?? [])
        if (!ancreAbsente(rect)) portes.push({ ...rect, canal: CANAL_DEGAT })
    }
  }

  return {
    ...base,
    labels,
    ...(decals ? { decals } : {}),
    ...(pupitres ? { pupitres } : {}),
    ...(lumieres ? { lumieres } : {}),
    ...(ambiante !== undefined ? { ambiante } : {}),
    ...(brume !== undefined ? { brume } : {}),
    portes,
  }
}
