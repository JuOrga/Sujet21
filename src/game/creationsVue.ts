// L'ÉCRAN CRÉATIONS, sa partie pure : ce que la liste montre et dans quel
// ordre, les dates dites en mots, les lignes de records. Sans DOM : le banc
// la tient (creationsVue.spec.ts) ; ecranCreations.ts ne fait que peindre.

import type { CreationListee, LigneRecord, Meilleur, RecordsCreation } from './netCreations'
import { fmtL, fmtTime } from './formats'

export type OngletCreations = 'recentes' | 'miennes'

export const ONGLETS_CREATIONS: readonly { id: OngletCreations; nom: string }[] = [
  { id: 'recentes', nom: 'Récentes' },
  { id: 'miennes', nom: 'Mes créations' },
]

/** La liste d'un onglet : toutes les salles, ou celles publiées depuis ce
 *  poste — les plus récentes d'abord (la date de la dernière retouche). */
export function listeAffichee(
  creations: readonly CreationListee[],
  onglet: OngletCreations,
  miennes: readonly string[],
): CreationListee[] {
  const garde = onglet === 'miennes' ? creations.filter((c) => miennes.includes(c.id)) : [...creations]
  return garde.sort((a, b) => b.majLe.localeCompare(a.majLe))
}

/** Une date dite comme on la dit : « aujourd’hui », « hier », « il y a
 *  3 jours », puis la date. Les jours se comptent au calendrier local, pas
 *  par tranches de 24 h : publiée à 23 h, lue à 1 h, c'était « hier ». */
export function quandRelatif(iso: string, maintenant: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const jour = (x: Date): number => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate()) / 86_400_000
  const ecart = Math.round(jour(maintenant) - jour(d))
  if (ecart <= 0) return 'aujourd’hui'
  if (ecart === 1) return 'hier'
  if (ecart < 7) return `il y a ${ecart} jours`
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** La ligne de record d'une carte de la liste. */
export function libelleMeilleur(m: Meilleur | undefined): string {
  return m ? `Record : ${fmtL(m.litres)} par ${m.nom}` : 'Aucun record : à vous'
}

export interface LigneAffichee {
  rang: string
  nom: string
  valeur: string
  /** la ligne du joueur de ce poste : on la surligne */
  moi: boolean
}

/** Les lignes d'un classement, prêtes à peindre. Vide : une ligne qui
 *  invite à jouer plutôt qu'un tableau vide. */
export function lignesClassement(
  lignes: readonly LigneRecord[],
  sorte: 'volume' | 'chrono',
  moi: string,
): LigneAffichee[] {
  if (lignes.length === 0) return [{ rang: '—', nom: 'Personne encore : à vous', valeur: '', moi: false }]
  return lignes.map((l, i) => ({
    rang: String(i + 1),
    nom: l.nom,
    valeur: sorte === 'volume' ? fmtL(l.litres) : fmtTime(l.temps),
    moi: moi !== '' && l.nom === moi,
  }))
}

/** Ce que dit l'écran de fin après une partie d'une création. */
export function bilanPartie(
  ameliore: boolean | null,
  records: RecordsCreation | null,
  litres: number,
  temps: number,
): { titre: string; texte: string } {
  const partie = `${fmtL(litres)} en ${fmtTime(temps)}`
  if (ameliore === null || !records) {
    return {
      titre: 'SORTIE ATTEINTE',
      texte: `${partie}. Le record n’a pas pu être déposé — le serveur est injoignable, ou la salle a changé depuis.`,
    }
  }
  const v = records.volume[0]
  const c = records.chrono[0]
  const tetes = `Records de la salle : ${v ? `${fmtL(v.litres)} (${v.nom})` : '—'} · ${c ? `${fmtTime(c.temps)} (${c.nom})` : '—'}.`
  return ameliore
    ? { titre: 'NOUVEAU RECORD', texte: `${partie} : vous entrez au classement. ${tetes}` }
    : { titre: 'SORTIE ATTEINTE', texte: `${partie}. ${tetes}` }
}
