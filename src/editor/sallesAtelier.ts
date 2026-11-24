// MES SALLES : les salles de l'atelier, rangées sur le poste.
//
// L'atelier n'avait qu'UN brouillon : « Nouvelle salle » écrasait le
// précédent, et une salle publiée ne se retrouvait plus pour la retoucher
// (le concepteur, 24/11 : « il faut pouvoir retrouver ces tableaux dans
// l'éditeur »). Désormais chaque salle a sa place dans une liste, sous une
// clé locale ; la salle ouverte y est rangée à chaque geste.
//
// Ce module ne connaît ni le DOM ni le stockage : il prend et rend des
// listes. L'éditeur lit et écrit localStorage (ATELIER_SALLES_KEY) ; le
// banc tient les règles.

/** Une salle de l'atelier. */
export interface SalleAtelier {
  /** La clé locale : stable, propre à ce poste. */
  cle: string
  nom: string
  /** La salle, sérialisée comme le brouillon (serializeLevel). */
  salle: string
  /** L'identifiant de la création publiée ('' : jamais publiée). */
  creationId: string
  /** La version EN LIGNE, sérialisée ('' : rien en ligne) — pour dire si
   *  des retouches attendent d'être publiées. */
  base: string
  majLe: string
}

/** Au-delà, la plus ancienne non publiée part (une salle publiée se
 *  retrouve toujours en ligne). Une salle pèse de 2 à 16 Ko : 60 salles
 *  tiennent largement dans le stockage du navigateur. */
export const SALLES_MAX = 60

/** Une clé locale neuve. */
export function nouvelleCleSalle(alea: () => number = Math.random, maintenant: number = Date.now()): string {
  return `s${maintenant.toString(36)}${Math.floor(alea() * 36 ** 4).toString(36).padStart(4, '0')}`
}

function estSalle(v: unknown): v is SalleAtelier {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Record<string, unknown>
  return ['cle', 'nom', 'salle', 'creationId', 'base', 'majLe'].every((k) => typeof s[k] === 'string')
}

/** Relit la liste rangée (un texte JSON) — illisible : vide, jamais une
 *  exception (un stockage abîmé ne doit pas fermer l'atelier). */
export function lisSalles(brut: string | null): SalleAtelier[] {
  if (!brut) return []
  try {
    const v = JSON.parse(brut) as unknown
    return Array.isArray(v) ? v.filter(estSalle) : []
  } catch {
    return []
  }
}

/** Range une salle : la remplace si sa clé existe, l'ajoute sinon. La plus
 *  récemment touchée vient en tête. Au-delà du plafond, la plus ancienne
 *  salle NON publiée part — jamais celle qu'on range. */
export function rangeSalle(liste: readonly SalleAtelier[], salle: SalleAtelier): SalleAtelier[] {
  const autres = liste.filter((s) => s.cle !== salle.cle)
  const tout = [salle, ...autres].sort((a, b) => b.majLe.localeCompare(a.majLe))
  while (tout.length > SALLES_MAX) {
    let i = -1
    for (let k = tout.length - 1; k >= 0; k--) {
      if (tout[k].cle !== salle.cle && !tout[k].creationId) {
        i = k
        break
      }
    }
    if (i < 0) break // toutes publiées : on garde tout
    tout.splice(i, 1)
  }
  return tout
}

/** Retire une salle de la liste (elle reste en ligne si elle est publiée). */
export function retireSalle(liste: readonly SalleAtelier[], cle: string): SalleAtelier[] {
  return liste.filter((s) => s.cle !== cle)
}

/** La salle locale qui porte une création publiée — pour rouvrir dans
 *  l'atelier une salle choisie dans l'écran CRÉATIONS. */
export function salleDeLaCreation(liste: readonly SalleAtelier[], creationId: string): SalleAtelier | null {
  return liste.find((s) => s.creationId === creationId) ?? null
}

/** Ce que dit la liste de chaque salle : publiée, à jour ou non. */
export function etatDeSalle(s: SalleAtelier): 'brouillon' | 'publiee' | 'retouchee' {
  if (!s.creationId) return 'brouillon'
  return s.base === s.salle ? 'publiee' : 'retouchee'
}
