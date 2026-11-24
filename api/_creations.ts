// LE MAGASIN DES CRÉATIONS : les salles des joueurs, partagées d'elles-mêmes,
// et leurs records. Ce module porte les RÈGLES ; api/creations.ts branche le
// vrai dépôt (Vercel Blob). Entre les deux, une interface de trois gestes
// (lire, écrire, effacer) : le banc joue les règles contre un dépôt en
// mémoire, conflits d'écriture compris (src/game/creations.spec.ts).
//
// POURQUOI PAS LE MAGASIN DES CONCEPTEURS (_magasin.ts). Il garde UN
// document par domaine, réécrit en entier, et « le dernier écrivain
// gagne » : suffisant pour deux concepteurs qui se parlent. Avec des
// joueurs qui publient chacun de leur côté, deux publications à la même
// seconde s'écraseraient — l'une des deux salles disparaîtrait de la liste
// sans que personne le sache. Ici :
//   · UN DOCUMENT PAR CRÉATION (creations/salles/<id>.json), écrit par son
//     seul auteur ;
//   · ses RECORDS à côté (creations/records/<id>.json) ;
//   · un INDEX léger (creations/index.json) que l'écran CRÉATIONS lit en
//     une fois — et qu'on n'écrit qu'en ÉCRITURE CONDITIONNELLE : on lit
//     l'index et son ETag, on écrit « seulement si l'ETag n'a pas bougé » ;
//     s'il a bougé, on relit et on réapplique, au lieu d'écraser.
//
// L'AUTEUR, sans compte : un JETON secret tiré au hasard sur son poste à
// la première publication. Le serveur n'en garde que l'empreinte ; seul
// celui qui tient le jeton modifie ou retire ses salles.
//
// LE COÛT (plan Pro, facturé à l'usage) : une publication coûte trois
// écritures (la salle, ses records, l'index), un record battu une ou deux.
// La lecture de la liste est une lecture simple. Mesuré la semaine du
// 15/11 : 0,017 $ d'opérations d'écriture Blob pour tout le site.

import { createHash, randomBytes } from 'node:crypto'
import { nettoieCreation, texteJoueur } from './_creation.js'

// ---- LE DÉPÔT ----------------------------------------------------------------

export interface LuDepot {
  corps: unknown
  etag: string
}

/** Les trois gestes dont le magasin a besoin. `ecrit` avec un ETag
 *  n'écrit que si le document n'a pas changé depuis ; avec `null`, que
 *  s'il n'existe pas encore. Un refus rend 'conflit', jamais une erreur. */
export interface Depot {
  lit(chemin: string): Promise<LuDepot | null>
  ecrit(chemin: string, corps: unknown, etag: string | null): Promise<'ok' | 'conflit'>
  efface(chemin: string): Promise<void>
}

export const CHEMIN_INDEX = 'creations/index.json'
export const cheminSalle = (id: string): string => `creations/salles/${id}.json`
export const cheminRecords = (id: string): string => `creations/records/${id}.json`

// ---- LES BORNES --------------------------------------------------------------

/** Le nombre de créations que la liste tient. Une entrée d'index pèse de
 *  l'ordre de 250 octets : mille entrées, ~250 Ko lus d'un coup par
 *  l'écran CRÉATIONS. Au-delà, il faudra paginer. */
export const CREATIONS_MAX = 1000

/** Les créations qu'un même auteur (un même jeton) peut tenir en ligne :
 *  assez pour créer, pas assez pour remplir la liste à lui seul. */
export const PAR_AUTEUR_MAX = 30

/** Les places de chaque classement d'une création (volume, chrono). */
export const RECORDS_MAX = 5

/** Les essais d'une écriture conditionnelle avant d'abandonner. */
export const ESSAIS_ECRITURE = 4

/** Le nom affiché d'un auteur ou d'un recordman. */
export const NOM_MAX = 24

const ID_MOTIF = /^[a-z0-9]{8}$/
const JETON_MOTIF = /^[A-Za-z0-9_-]{32,128}$/

// ---- LES FORMES --------------------------------------------------------------

export interface Meilleur {
  nom: string
  litres: number
  temps: number
}

export interface EntreeIndex {
  id: string
  code: string
  nom: string
  auteur: string
  creeLe: string
  majLe: string
  empreinte: string
  /** Un préfixe de l'empreinte du jeton : compte les salles d'un auteur.
   *  Jamais servi au public. */
  cle: string
  meilleur?: Meilleur
}

export interface IndexCreations {
  format: 1
  creations: EntreeIndex[]
}

export interface DocSalle {
  format: 1
  id: string
  code: string
  nom: string
  auteur: string
  creeLe: string
  majLe: string
  empreinte: string
  empreinteJeton: string
  salle: Record<string, unknown>
}

export interface LigneRecord {
  nom: string
  litres: number
  temps: number
  quand: string
}

export interface RecordsCreation {
  /** L'empreinte de la salle que ces records concernent : une salle
   *  retouchée n'est plus la même, ses records repartent de zéro. */
  empreinte: string
  volume: LigneRecord[]
  chrono: LigneRecord[]
}

// ---- LES OUTILS ----------------------------------------------------------------

const sha = (texte: string): string => createHash('sha256').update(texte, 'utf8').digest('hex')

/** L'empreinte d'une salle nettoyée : son contenu, pas sa date ni son nom
 *  d'auteur. Le nettoyage construit les objets dans un ordre fixe, donc le
 *  même contenu donne la même empreinte. */
export function empreinteSalle(salle: Record<string, unknown>): string {
  return sha(JSON.stringify(salle)).slice(0, 16)
}

export const empreinteJeton = (jeton: string): string => sha(`jeton:${jeton}`)

/** Un identifiant de huit caractères : 36^8 ≈ 2,8 × 10^12 tirages, une
 *  collision ne se joue pas à mille créations. */
export function nouvelId(alea: (n: number) => Uint8Array = (n) => new Uint8Array(randomBytes(n))): string {
  const lettres = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return [...alea(8)].map((o) => lettres[o % lettres.length]).join('')
}

/** Le code d'une création : « J- » et son identifiant. Il ne peut pas
 *  ressembler à un code officiel (21-A, HUB3…) — la run ne le connaît pas. */
export const codeCreation = (id: string): string => `J-${id.toUpperCase()}`

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const nombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Une mesure de partie plausible : des litres (0..10 000) et un temps
 *  (0,1 s..10 h). Hors de là, ce n'est pas une partie. */
function mesure(v: unknown): { litres: number; temps: number } | null {
  if (!estObjet(v) || !nombre(v.litres) || !nombre(v.temps)) return null
  if (v.litres < 0 || v.litres > 10_000 || v.temps < 0.1 || v.temps > 36_000) return null
  return { litres: Math.round(v.litres * 100) / 100, temps: Math.round(v.temps * 10) / 10 }
}

const parVolume = (a: LigneRecord, b: LigneRecord): number => b.litres - a.litres || a.temps - b.temps
const parChrono = (a: LigneRecord, b: LigneRecord): number => a.temps - b.temps || b.litres - a.litres

/** Range une partie dans un classement ; rend le classement et s'il a
 *  changé. Un même nom ne garde que sa meilleure ligne. */
function classe(
  lignes: LigneRecord[],
  ligne: LigneRecord,
  ordre: (a: LigneRecord, b: LigneRecord) => number,
): { lignes: LigneRecord[]; change: boolean } {
  const sienne = lignes.find((l) => l.nom === ligne.nom)
  if (sienne && ordre(ligne, sienne) >= 0) return { lignes, change: false }
  const autres = lignes.filter((l) => l.nom !== ligne.nom)
  const neuves = [...autres, ligne].sort(ordre).slice(0, RECORDS_MAX)
  return { lignes: neuves, change: neuves.includes(ligne) }
}

function meilleurDe(r: RecordsCreation): Meilleur | undefined {
  const m = r.volume[0]
  return m ? { nom: m.nom, litres: m.litres, temps: m.temps } : undefined
}

function indexValide(v: unknown): IndexCreations {
  if (estObjet(v) && Array.isArray(v.creations)) return { format: 1, creations: v.creations as EntreeIndex[] }
  return { format: 1, creations: [] }
}

function recordsValides(v: unknown, empreinte: string): RecordsCreation {
  if (estObjet(v) && typeof v.empreinte === 'string' && Array.isArray(v.volume) && Array.isArray(v.chrono)) {
    return v as unknown as RecordsCreation
  }
  return { empreinte, volume: [], chrono: [] }
}

// ---- LES RÉPONSES --------------------------------------------------------------

export interface Reponse {
  statut: number
  corps: unknown
}

const refus = (statut: number, erreur: string): Reponse => ({ statut, corps: { error: erreur } })

class Refus extends Error {
  constructor(readonly reponse: Reponse) {
    super(String((reponse.corps as { error?: string }).error))
  }
}

/** LIRE, MODIFIER, ÉCRIRE — sans écraser une écriture concurrente : on
 *  relit et on réapplique tant que l'ETag a bougé entre-temps. La
 *  modification peut REFUSER (lever un Refus) au vu de l'état relu. */
async function modifie<T>(
  depot: Depot,
  chemin: string,
  lis: (v: unknown | null) => T,
  change: (courant: T) => T | null,
): Promise<T> {
  for (let i = 0; i < ESSAIS_ECRITURE; i++) {
    const lu = await depot.lit(chemin)
    const courant = lis(lu ? lu.corps : null)
    const neuf = change(courant)
    if (neuf === null) return courant // rien à écrire
    if ((await depot.ecrit(chemin, neuf, lu ? lu.etag : null)) === 'ok') return neuf
  }
  throw new Refus(refus(409, 'trop d’écritures simultanées — réessayez dans un instant'))
}

// ---- LES GESTES ----------------------------------------------------------------

export interface Requete {
  methode: string
  query: Record<string, string | undefined>
  corps: unknown
  /** L'en-tête x-jeton-auteur (retrait d'une salle). */
  jeton?: string
}

/** Tout le magasin des créations, sans transport : la requête entre, la
 *  réponse sort. `maintenant` et `alea` s'injectent pour le banc. */
export async function traiteCreations(
  req: Requete,
  depot: Depot,
  maintenant: () => string = () => new Date().toISOString(),
  alea?: (n: number) => Uint8Array,
): Promise<Reponse> {
  try {
    const m = req.methode.toUpperCase()
    if (m === 'GET') return req.query.id ? await litUne(depot, req.query.id) : await litListe(depot)
    if (m === 'POST') {
      const c = estObjet(req.corps) ? req.corps : {}
      if (c.action === 'publier') return await publie(depot, c, maintenant(), alea)
      if (c.action === 'record') return await deposeRecord(depot, c, maintenant())
      return refus(400, 'action inconnue : publier ou record')
    }
    if (m === 'DELETE') return await retire(depot, req.query.id, req.jeton)
    return refus(405, 'méthode non autorisée')
  } catch (e) {
    if (e instanceof Refus) return e.reponse
    throw e
  }
}

/** La liste publique : sans la clé d'auteur, la plus récente d'abord. */
async function litListe(depot: Depot): Promise<Reponse> {
  const lu = await depot.lit(CHEMIN_INDEX)
  const index = indexValide(lu?.corps ?? null)
  const creations = index.creations
    .map(({ cle: _cle, ...publique }) => publique)
    .sort((a, b) => b.creeLe.localeCompare(a.creeLe))
  return { statut: 200, corps: { creations } }
}

/** Une création : la salle (son code posé, prête pour parseLevel) et ses
 *  records — jamais l'empreinte du jeton. */
async function litUne(depot: Depot, id: string): Promise<Reponse> {
  if (!ID_MOTIF.test(id)) return refus(400, 'identifiant de création illisible')
  const lu = await depot.lit(cheminSalle(id))
  if (!lu) return refus(404, 'cette création n’existe pas, ou plus')
  const doc = lu.corps as DocSalle
  const rec = await depot.lit(cheminRecords(id))
  const { empreinteJeton: _ej, ...publique } = doc
  return {
    statut: 200,
    corps: {
      creation: { ...publique, salle: { ...doc.salle, code: doc.code } },
      records: recordsValides(rec?.corps ?? null, doc.empreinte),
    },
  }
}

async function publie(
  depot: Depot,
  c: Record<string, unknown>,
  quand: string,
  alea?: (n: number) => Uint8Array,
): Promise<Reponse> {
  if (typeof c.jeton !== 'string' || !JETON_MOTIF.test(c.jeton)) {
    return refus(400, 'jeton d’auteur absent ou illisible')
  }
  const auteur = texteJoueur(c.auteur, NOM_MAX)
  if (!auteur) return refus(400, 'il faut un nom d’auteur')
  // LA PREUVE DE TRAVERSÉE : l'auteur a atteint la sortie en essayant.
  // Le serveur ne rejoue pas la physique — c'est une garantie de bonne
  // foi, pas une preuve ; elle devient le premier record de la salle.
  const essai = mesure(c.essai)
  if (!essai) return refus(400, 'la salle se partage une fois sa sortie atteinte : il manque la partie de l’auteur')
  const nettoyage = nettoieCreation(c.salle)
  if (!nettoyage.ok) return refus(400, nettoyage.raison)
  const salle = nettoyage.salle
  const empreinte = empreinteSalle(salle)
  const ej = empreinteJeton(c.jeton)
  const premier: LigneRecord = { nom: auteur, ...essai, quand }
  const nom = salle.name as string

  // ---- UNE SALLE DÉJÀ PUBLIÉE : son auteur la retouche ----
  if (c.id !== undefined) {
    const id = String(c.id)
    if (!ID_MOTIF.test(id)) return refus(400, 'identifiant de création illisible')
    const lu = await depot.lit(cheminSalle(id))
    if (!lu) return refus(404, 'cette création n’existe pas, ou plus')
    const ancien = lu.corps as DocSalle
    if (ancien.empreinteJeton !== ej) return refus(403, 'seul l’auteur retouche sa salle')
    const doc: DocSalle = { ...ancien, nom, auteur, majLe: quand, empreinte, salle }
    if ((await depot.ecrit(cheminSalle(id), doc, lu.etag)) !== 'ok') {
      return refus(409, 'la salle a changé ailleurs entre-temps — rouvrez-la et réessayez')
    }
    // une salle retouchée n'est plus la même : ses records repartent de la
    // partie de l'auteur
    const records =
      ancien.empreinte === empreinte
        ? await modifie(depot, cheminRecords(id), (v) => recordsValides(v, empreinte), () => null)
        : await modifie(depot, cheminRecords(id), (v) => recordsValides(v, empreinte), () => ({
            empreinte,
            volume: [premier],
            chrono: [premier],
          }))
    await modifie(depot, CHEMIN_INDEX, indexValide, (index) => {
      const e = index.creations.find((x) => x.id === id)
      if (!e) return null // retirée entre-temps : rien à remettre
      Object.assign(e, { nom, auteur, majLe: quand, empreinte, meilleur: meilleurDe(records) })
      return index
    })
    return { statut: 200, corps: { ok: true, id, code: doc.code, empreinte, records } }
  }

  // ---- UNE NOUVELLE SALLE ----
  const cle = ej.slice(0, 12)
  const plafonds = (index: IndexCreations): void => {
    if (index.creations.length >= CREATIONS_MAX) {
      throw new Refus(refus(507, `la liste des créations est pleine (${CREATIONS_MAX})`))
    }
    if (index.creations.filter((x) => x.cle === cle).length >= PAR_AUTEUR_MAX) {
      throw new Refus(refus(429, `${PAR_AUTEUR_MAX} salles en ligne au plus par auteur — retirez-en une pour publier`))
    }
  }
  // un premier regard sur les plafonds, avant toute écriture
  plafonds(indexValide((await depot.lit(CHEMIN_INDEX))?.corps ?? null))

  let id = ''
  for (let i = 0; i < ESSAIS_ECRITURE && !id; i++) {
    const essaiId = nouvelId(alea)
    const doc: DocSalle = {
      format: 1, id: essaiId, code: codeCreation(essaiId), nom, auteur,
      creeLe: quand, majLe: quand, empreinte, empreinteJeton: ej, salle,
    }
    // `null` : n'écrire que si l'identifiant est libre
    if ((await depot.ecrit(cheminSalle(essaiId), doc, null)) === 'ok') id = essaiId
  }
  if (!id) return refus(409, 'aucun identifiant libre — réessayez')

  const records: RecordsCreation = { empreinte, volume: [premier], chrono: [premier] }
  await depot.ecrit(cheminRecords(id), records, null)
  const entree: EntreeIndex = {
    id, code: codeCreation(id), nom, auteur, creeLe: quand, majLe: quand, empreinte, cle, meilleur: meilleurDe(records),
  }
  try {
    await modifie(depot, CHEMIN_INDEX, indexValide, (index) => {
      plafonds(index) // relu : un autre a pu publier entre-temps
      index.creations.push(entree)
      return index
    })
  } catch (e) {
    // pas de place dans la liste : la salle écrite ne doit pas traîner
    await depot.efface(cheminSalle(id))
    await depot.efface(cheminRecords(id))
    throw e
  }
  return {
    statut: 200,
    corps: { ok: true, id, code: entree.code, empreinte, records, retouches: nettoyage.retouches },
  }
}

async function deposeRecord(depot: Depot, c: Record<string, unknown>, quand: string): Promise<Reponse> {
  const id = String(c.id ?? '')
  if (!ID_MOTIF.test(id)) return refus(400, 'identifiant de création illisible')
  const nom = texteJoueur(c.nom, NOM_MAX)
  if (!nom) return refus(400, 'il faut un nom de joueur')
  const partie = mesure(c)
  if (!partie) return refus(400, 'record invalide : des litres et un temps plausibles')
  if (typeof c.empreinte !== 'string') return refus(400, 'il manque l’empreinte de la salle jouée')
  const ligne: LigneRecord = { nom, ...partie, quand }
  let ameliore = false
  const avant = await depot.lit(cheminRecords(id))
  if (!avant) return refus(404, 'cette création n’existe pas, ou plus')
  const records = await modifie(depot, cheminRecords(id), (v) => recordsValides(v, String(c.empreinte)), (r) => {
    if (r.empreinte !== c.empreinte) {
      throw new Refus(refus(409, 'la salle a été retouchée depuis votre partie : ce record ne compte plus'))
    }
    const v = classe(r.volume, ligne, parVolume)
    const ch = classe(r.chrono, ligne, parChrono)
    ameliore = v.change || ch.change
    return ameliore ? { ...r, volume: v.lignes, chrono: ch.lignes } : null
  })
  if (ameliore) {
    const meilleur = meilleurDe(records)
    await modifie(depot, CHEMIN_INDEX, indexValide, (index) => {
      const e = index.creations.find((x) => x.id === id)
      if (!e || JSON.stringify(e.meilleur) === JSON.stringify(meilleur)) return null
      e.meilleur = meilleur
      return index
    })
  }
  return { statut: 200, corps: { ok: true, ameliore, records } }
}

async function retire(depot: Depot, id: string | undefined, jeton: string | undefined): Promise<Reponse> {
  if (!id || !ID_MOTIF.test(id)) return refus(400, 'identifiant de création illisible')
  if (!jeton || !JETON_MOTIF.test(jeton)) return refus(401, 'jeton d’auteur manquant')
  const lu = await depot.lit(cheminSalle(id))
  if (!lu) return refus(404, 'cette création n’existe pas, ou plus')
  if ((lu.corps as DocSalle).empreinteJeton !== empreinteJeton(jeton)) {
    return refus(403, 'seul l’auteur retire sa salle')
  }
  // l'index d'abord : une salle retirée ne doit plus s'afficher, même si
  // l'effacement de ses fichiers échouait ensuite
  await modifie(depot, CHEMIN_INDEX, indexValide, (index) => {
    const n = index.creations.length
    index.creations = index.creations.filter((x) => x.id !== id)
    return index.creations.length === n ? null : index
  })
  await depot.efface(cheminSalle(id))
  await depot.efface(cheminRecords(id))
  return { statut: 200, corps: { ok: true } }
}
