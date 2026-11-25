// MES SALLES : les salles de l'atelier, rangées dans le coffre de
// l'emplacement (game/clesAtelier.ts).
//
// L'atelier n'avait qu'UN brouillon : « Nouvelle salle » écrasait le
// précédent, et une salle publiée ne se retrouvait plus pour la retoucher
// (le concepteur, 24/11 : « il faut pouvoir retrouver ces tableaux dans
// l'éditeur »). Désormais chaque salle a sa place dans une liste, sous une
// clé locale ; la salle ouverte y est rangée à chaque geste.
//
// LE POIDS, pas le nombre, est la vraie limite : la liste vit dans le MÊME
// document que la progression de l'emplacement, et ce document entier se
// réécrit à chaque geste. Mesuré le 24/11 : 60 salles de la taille des
// salles livrées pèsent ~405 Ko dans le coffre, mais 60 salles au plafond
// de publication (24 Ko) ~4,5 Mo — au bord de ce qu'un navigateur accorde
// à un site, et une écriture refusée emportait la PROGRESSION avec elle.
// D'où un budget en octets, et la version en ligne gardée en EMPREINTE
// (quelques signes) plutôt qu'en seconde copie de la salle.
//
// Ce module ne connaît ni le DOM ni le stockage : il prend et rend des
// listes. L'éditeur lit et écrit le coffre (ATELIER_SALLES_KEY) ; le banc
// tient les règles.

/** Une salle de l'atelier. */
export interface SalleAtelier {
  /** La clé locale : stable, propre à ce poste. */
  cle: string
  nom: string
  /** La salle, sérialisée comme le brouillon (serializeLevel). */
  salle: string
  /** L'identifiant de la création publiée ('' : jamais publiée). */
  creationId: string
  /** L'EMPREINTE de la version en ligne (empreinteSalle ; '' : rien en
   *  ligne) — pour dire si des retouches attendent d'être publiées. Les
   *  listes d'avant y gardaient la salle entière : lisSalles les convertit. */
  base: string
  majLe: string
}

/** Au-delà, la plus ancienne part (les brouillons d'abord). */
export const SALLES_MAX = 60

/** Le budget de la liste, en signes de son texte JSON. Mesuré le 24/11
 *  (60 salles publiées, rangées une à une) : de la taille de la plus grosse
 *  salle livrée (2,1 Ko), les 60 restent et le coffre pèse ~200 Ko (405
 *  avec la copie en ligne d'avant) ; au plafond de publication (24 Ko), 36
 *  restent et le coffre pèse ~1,3 Mo (4,5 Mo avant) — loin des quelques Mo
 *  qu'un navigateur accorde à un site. */
export const SALLES_OCTETS_MAX = 1024 * 1024

/** L'EMPREINTE d'une salle sérialisée : assez pour dire « c'est la même
 *  version » sans en garder une copie. Pas un secret, pas une signature :
 *  une somme de contrôle rapide (cyrb53), préfixée pour se reconnaître. */
export function empreinteSalle(serialisee: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < serialisee.length; i++) {
    const c = serialisee.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `e:${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}`
}

/** `base` (une empreinte, ou la salle entière d'avant) désigne-t-elle
 *  cette version sérialisée ? */
export function memeVersion(base: string, serialisee: string): boolean {
  if (!base) return false
  return base.startsWith('e:') ? base === empreinteSalle(serialisee) : base === serialisee
}

/** La version en ligne en empreinte — ce qui s'y trouve déjà reste tel quel. */
export function versEmpreinte(base: string): string {
  return !base || base.startsWith('e:') ? base : empreinteSalle(base)
}

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
 *  exception (un stockage abîmé ne doit pas fermer l'atelier). Une liste
 *  d'avant l'empreinte (la version en ligne copiée entière) est allégée à
 *  la lecture : le prochain rangement l'écrit allégée. */
export function lisSalles(brut: string | null): SalleAtelier[] {
  if (!brut) return []
  try {
    const v = JSON.parse(brut) as unknown
    return Array.isArray(v) ? v.filter(estSalle).map((s) => ({ ...s, base: versEmpreinte(s.base) })) : []
  } catch {
    return []
  }
}

/** Le poids d'une liste, en signes de son texte JSON (ce que le coffre
 *  range). */
export function poidsSalles(liste: readonly SalleAtelier[]): number {
  return JSON.stringify(liste).length
}

export interface Rangement {
  liste: SalleAtelier[]
  /** Les salles sorties pour faire de la place (à dire au joueur). */
  retirees: SalleAtelier[]
}

/** Range une salle : la remplace si sa clé existe, l'ajoute sinon. La plus
 *  récemment touchée vient en tête. Au-delà de SALLES_MAX salles ou de
 *  SALLES_OCTETS_MAX, la plus ancienne part — un BROUILLON d'abord ; une
 *  salle publiée seulement s'il n'en reste plus (elle reste en ligne, et
 *  se rouvre depuis l'écran CRÉATIONS) — jamais celle qu'on range. */
export function rangeSalle(liste: readonly SalleAtelier[], salle: SalleAtelier): Rangement {
  const autres = liste.filter((s) => s.cle !== salle.cle)
  const tout = [{ ...salle, base: versEmpreinte(salle.base) }, ...autres].sort((a, b) => b.majLe.localeCompare(a.majLe))
  const retirees: SalleAtelier[] = []
  let poids = poidsSalles(tout)
  while (tout.length > SALLES_MAX || poids > SALLES_OCTETS_MAX) {
    const plusAncienne = (publiee: boolean): number => {
      for (let k = tout.length - 1; k >= 0; k--) {
        if (tout[k].cle !== salle.cle && Boolean(tout[k].creationId) === publiee) return k
      }
      return -1
    }
    let i = plusAncienne(false)
    if (i < 0) i = plusAncienne(true)
    if (i < 0) break // il ne reste que la salle qu'on range : elle reste
    const [partie] = tout.splice(i, 1)
    retirees.push(partie)
    // le poids se recalcule sans tout resérialiser : sa ligne, et sa virgule
    poids -= JSON.stringify(partie).length + 1
  }
  return { liste: tout, retirees }
}

/** Ce qu'une nouvelle salle ferait sortir de la liste — pour PRÉVENIR le
 *  joueur avant, plutôt que de le lui apprendre après. */
export function retraitsPrevus(liste: readonly SalleAtelier[], nouvelle: SalleAtelier): SalleAtelier[] {
  return rangeSalle(liste, nouvelle).retirees
}

/** Le message qui dit au joueur ce qui sort de MES SALLES — `prevu` :
 *  avant (« en sortirait »), sinon après (« en est sortie »). */
export function messageRetraits(retirees: readonly SalleAtelier[], prevu = false): string {
  if (retirees.length === 0) return ''
  const noms = retirees.map((s) => `« ${s.nom || 'Sans nom'} »`).join(', ')
  const publiees = retirees.some((s) => s.creationId)
  const plusieurs = retirees.length > 1
  const verbe = prevu ? (plusieurs ? 'en sortiraient' : 'en sortirait') : plusieurs ? 'en sont sorties' : 'en est sortie'
  return (
    `MES SALLES est pleine : ${noms} ${verbe}.` +
    (publiees ? ' Une salle publiée reste en ligne : rouvrez-la depuis COMMUNAUTÉ › CRÉATIONS DE LA COMMUNAUTÉ, onglet « Mes créations ».' : '')
  )
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
  return memeVersion(s.base, s.salle) ? 'publiee' : 'retouchee'
}
