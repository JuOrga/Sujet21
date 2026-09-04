// LE JOURNAL — le RÉCIT et les FINS, en DONNÉES.
//
// Contrairement aux fiches d'expérience, un fragment du récit ou une fin
// n'a pas de détecteur dans le code : il se sert DANS UN ORDRE, à chaque
// expédition bouclée. Rien n'oblige donc à le figer dans le code — et le
// concepteur demandait de tenir lui-même le nombre de fins, leur ordre, et
// le nombre de fragments ou de fins qui ouvrent la suite. Ce module porte
// ce modèle : le journal LIVRÉ (celui du code, le filet), le journal
// COURANT (le livré, ou celui publié au magasin partagé par le
// concepteur), les opérations pures de l'atelier, et les questions que le
// jeu pose (prochain fragment, prochaine fin, révélation, dénouement).
//
// DEUX RÈGLES QUI NE SE DISCUTENT PAS :
//   · un identifiant ne se réattribue JAMAIS — les registres des joueurs
//     s'en souviennent (records.decouvertes) : renommer le titre, oui ;
//     l'id, non. `fin-jouee` est réservé (le marqueur de la cinématique) ;
//   · les seuils se lisent en NOMBRE d'entrées servies, pas en position :
//     retirer une entrée déjà vue par un joueur ne lui retire rien.

import type { CodexDef } from './codex'

export interface EntreeJournal {
  /** `recit-…` ou `fin-…` : c'est l'id de la fiche du codex */
  id: string
  icone: string
  titre: string
  texte: string
}

export interface JournalDef {
  recit: EntreeJournal[]
  fins: EntreeJournal[]
  /** la RÉVÉLATION (le sceau du secteur 4 tombe) après N fragments servis */
  revelationApres: number
  /** le DÉNOUEMENT (la fin de l'arc se joue) après N fins atteintes */
  denouementApres: number
}

export type GroupeJournal = 'recit' | 'fins'
export const PREFIXE: Record<GroupeJournal, string> = { recit: 'recit-', fins: 'fin-' }
/** le marqueur de la cinématique de fin vue (records) — jamais une entrée */
export const ID_RESERVE = 'fin-jouee'
export const MAX_ENTREES = 60
export const MAX_TITRE = 80
export const MAX_TEXTE = 1200
export const MAX_ICONE = 8

/** Le journal LIVRÉ : le récit en dix fragments (« la livraison » ouvre,
 *  « le choix » ferme) et la fin de l'arc. Le filet sous le magasin. */
export const JOURNAL_LIVRE: Readonly<JournalDef> = {
  recit: [
    {
      id: 'recit-livraison',
      icone: '🛰️',
      titre: 'La livraison',
      texte:
        'Fragment de registre de quai : « Réception du miroir de rechange, 14 h 02. Rupture du portique, 14 h 03. » Le module Méduse a pris le choc — les pannes du hub datent de cette minute-là. Le télescope orbital attendait sa pièce ; la station attendait autre chose.',
    },
    {
      id: 'recit-cahier-charges',
      icone: '🪞',
      titre: 'Le cahier des charges',
      texte:
        'Note technique, en-tête arrachée : « Le produit n’est pas un sujet d’étude. Le produit est un MIROIR : un fluide capable de tenir une surface parfaite, à toute température, sous toute contrainte. » Vous n’avez pas été conçu pour apprendre. Vous avez appris quand même.',
    },
    {
      id: 'recit-note-vega',
      icone: '📄',
      titre: 'Note de service — Dr N. Véga',
      texte:
        '« On me demande de cesser de consigner le comportement du produit. Je consigne donc ceci : le produit prend les chicanes du conduit sans jamais se tromper. Il s’attarde devant le placard. Il LIT, je crois. Je ne cesserai pas de consigner. — N.V. »',
    },
    {
      id: 'recit-calibrations',
      icone: '📐',
      titre: 'Les calibrations',
      texte:
        'Vos « records » portent un autre nom dans les registres du labo : mesures de planéité. Chaque descente chronométrée était un banc d’essai optique — le mur des records est un banc de calibration. On ne mesurait pas vos exploits. On mesurait si vous feriez un bon miroir.',
    },
    {
      id: 'recit-endormis',
      icone: '🫙',
      titre: 'Les endormis',
      texte:
        'Les capsules de la cuve ne sont pas des réserves. Ce sont les essais d’avant vous — sujets 12 à 20 — mis en sommeil quand leur surface a été jugée « insuffisante ». Vivants. La consigne « NE PAS RÉVEILLER » n’est pas une précaution d’hygiène.',
    },
    {
      id: 'recit-semblable',
      icone: '🧿',
      titre: 'Le Semblable',
      texte:
        'Le marchand du comptoir en était un. Le sujet 12 — le premier à tenir une surface plus de dix secondes. Un matin, il a cessé de dormir, et personne n’a osé le rendormir. Alors on lui a donné une grille, un étal, et un registre. Il prend la mémoire en paiement : il sait ce qu’elle vaut.',
    },
    {
      id: 'recit-alerte',
      icone: '🚨',
      titre: 'Pourquoi l’alerte',
      texte:
        'L’alerte n’a pas été déclenchée par la rupture du portique — elle l’a PRÉCÉDÉE de neuf secondes. Le secteur 4 n’est pas scellé contre l’accident. Il est scellé contre ce qui doit partir. Quelqu’un a fermé cette porte en sachant ce qu’il faisait.',
    },
    {
      id: 'recit-la-haut',
      icone: '🔭',
      titre: 'Là-haut',
      texte:
        'Le télescope orbite depuis quatre ans, achevé à un miroir près. Sans son œil, il ne voit rien — et la station n’existe QUE pour le lui fournir. Chaque jour de retard se compte en carrières brisées, là-haut comme ici. N’importe quel miroir fera l’affaire. N’importe lequel.',
    },
    {
      id: 'recit-precurseurs',
      icone: '🕳️',
      titre: 'Ceux d’avant',
      texte:
        'Deux « produits conformes » ont déjà pris la route du secteur 4. Les registres notent le départ, le vide des capsules, la mise sous tension du convoyeur. Puis plus rien. Aucun message n’est jamais redescendu — mais le télescope, lui, ne voit toujours pas.',
    },
    {
      id: 'recit-le-choix',
      icone: '🚪',
      titre: 'Le choix',
      texte:
        'Tout est raconté. Le sceau du secteur 4 n’a plus de raison de tenir : la route du plasma mène au convoyeur, le convoyeur mène là-haut. Devenir l’œil du télescope — ou rester ce que vous êtes devenu. Personne n’a jamais eu ce choix avant vous. Le sas s’ouvre.',
    },
  ],
  fins: [
    {
      id: 'fin-miroir',
      icone: '🪞',
      titre: 'Le miroir',
      texte:
        'La route du plasma mène au convoyeur, le convoyeur mène là-haut. Un télescope achevé à un miroir près attend son œil. Devenir l’œil qui regarde l’univers — ou rester ce que vous êtes devenu. Le sas s’ouvre : cette fois, c’est vous qui décidez.',
    },
  ],
  revelationApres: 10,
  denouementApres: 1,
}

// ---- LES FICHES ---------------------------------------------------------------

export function ficheDe(e: EntreeJournal, groupe: GroupeJournal): CodexDef {
  return { id: e.id, groupe, icone: e.icone, titre: e.titre, texte: e.texte }
}

/** Les fiches du codex que ce journal produit : le récit, puis les fins. */
export function fichesJournal(j: JournalDef): CodexDef[] {
  return [...j.recit.map((e) => ficheDe(e, 'recit')), ...j.fins.map((e) => ficheDe(e, 'fins'))]
}

// ---- LES QUESTIONS DU JEU ----------------------------------------------------

export function fragmentsVus(j: JournalDef, vues: readonly string[]): number {
  return j.recit.filter((e) => vues.includes(e.id)).length
}

export function finsVues(j: JournalDef, vues: readonly string[]): number {
  return j.fins.filter((e) => vues.includes(e.id)).length
}

/** Le prochain fragment à servir — null : tout est raconté. */
export function prochainFragment(j: JournalDef, vues: readonly string[]): string | null {
  return j.recit.find((e) => !vues.includes(e.id))?.id ?? null
}

/** La prochaine fin à révéler — null : toutes le sont. */
export function prochaineFin(j: JournalDef, vues: readonly string[]): string | null {
  return j.fins.find((e) => !vues.includes(e.id))?.id ?? null
}

/** Assez de fragments servis pour la révélation ? (un seuil à 0 : dès le
 *  départ — le concepteur peut vouloir un sceau déjà tombé) */
export function revelationAtteinte(j: JournalDef, vues: readonly string[]): boolean {
  return fragmentsVus(j, vues) >= j.revelationApres
}

/** Assez de fins atteintes pour le dénouement ? */
export function denouementAtteint(j: JournalDef, vues: readonly string[]): boolean {
  return finsVues(j, vues) >= j.denouementApres
}

// ---- LA LECTURE (magasin, brouillon) ------------------------------------------

const ID_OK = /^[a-z0-9-]{3,48}$/

function litEntree(brut: unknown, groupe: GroupeJournal): EntreeJournal | null {
  if (typeof brut !== 'object' || brut === null) return null
  const p = brut as Record<string, unknown>
  if (typeof p.id !== 'string' || !ID_OK.test(p.id) || !p.id.startsWith(PREFIXE[groupe])) return null
  if (p.id === ID_RESERVE) return null
  return {
    id: p.id,
    icone: typeof p.icone === 'string' ? p.icone.trim().slice(0, MAX_ICONE) : '',
    titre: typeof p.titre === 'string' ? p.titre.trim().slice(0, MAX_TITRE) : '',
    texte: typeof p.texte === 'string' ? p.texte.trim().slice(0, MAX_TEXTE) : '',
  }
}

function litSeuil(brut: unknown, max: number, defaut: number): number {
  const n = Number(brut)
  return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.round(n))) : Math.min(max, defaut)
}

/** Un journal tel qu'il arrive (magasin, brouillon, import) — null s'il
 *  n'a pas la forme d'un journal. Les entrées abîmées sont écartées, les
 *  doublons d'id aussi (le premier gagne), les seuils bornés au nombre. */
export function litJournal(brut: unknown): JournalDef | null {
  if (typeof brut !== 'object' || brut === null) return null
  const p = brut as Record<string, unknown>
  if (!Array.isArray(p.recit) || !Array.isArray(p.fins)) return null
  const vus = new Set<string>()
  const lis = (liste: unknown[], groupe: GroupeJournal): EntreeJournal[] => {
    const out: EntreeJournal[] = []
    for (const b of liste) {
      const e = litEntree(b, groupe)
      if (!e || vus.has(e.id)) continue
      vus.add(e.id)
      out.push(e)
      if (out.length >= MAX_ENTREES) break
    }
    return out
  }
  const recit = lis(p.recit, 'recit')
  const fins = lis(p.fins, 'fins')
  return {
    recit,
    fins,
    revelationApres: litSeuil(p.revelationApres, recit.length, recit.length),
    denouementApres: litSeuil(p.denouementApres, fins.length, fins.length),
  }
}

export function cloneJournal(j: JournalDef): JournalDef {
  return {
    recit: j.recit.map((e) => ({ ...e })),
    fins: j.fins.map((e) => ({ ...e })),
    revelationApres: j.revelationApres,
    denouementApres: j.denouementApres,
  }
}

export function memeJournal(a: JournalDef, b: JournalDef): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Ce qui cloche, en clair — vide : rien. Un verdict qui commence par
 *  « ATTENTION » n'empêche pas de publier. */
export function verifieJournal(j: JournalDef): string[] {
  const v: string[] = []
  const ids = new Set<string>()
  const groupes: [GroupeJournal, EntreeJournal[], string][] = [
    ['recit', j.recit, 'fragment'],
    ['fins', j.fins, 'fin'],
  ]
  for (const [g, liste, nom] of groupes) {
    liste.forEach((e, i) => {
      const ou = `${nom} ${i + 1}`
      if (!ID_OK.test(e.id) || !e.id.startsWith(PREFIXE[g]))
        v.push(`${ou} : id « ${e.id} » invalide (attendu ${PREFIXE[g]}…, minuscules, chiffres, tirets)`)
      if (e.id === ID_RESERVE) v.push(`${ou} : l'id ${ID_RESERVE} est réservé au marqueur de la cinématique`)
      if (ids.has(e.id)) v.push(`${ou} : id « ${e.id} » en double`)
      ids.add(e.id)
      if (!e.titre.trim()) v.push(`${ou} : titre vide`)
      if (!e.texte.trim()) v.push(`${ou} : texte vide`)
    })
  }
  if (j.revelationApres > j.recit.length)
    v.push(`révélation après ${j.revelationApres} fragments, mais il n'y en a que ${j.recit.length}`)
  if (j.denouementApres > j.fins.length)
    v.push(`dénouement après ${j.denouementApres} fins, mais il n'y en a que ${j.fins.length}`)
  if (j.recit.length === 0) v.push('ATTENTION : aucun fragment — le journal ne racontera rien')
  if (j.fins.length === 0) v.push('ATTENTION : aucune fin — les expéditions bouclées n’en révéleront aucune')
  if (j.revelationApres === 0) v.push('ATTENTION : révélation après 0 fragment — le sceau tombe dès la première visite')
  return v
}

export const estAttention = (verdict: string): boolean => verdict.startsWith('ATTENTION')

// ---- LES OPÉRATIONS DE L'ATELIER (pures : un journal neuf à chaque fois) -----

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32) || 'entree'
  )
}

/** Un id que rien ne porte, dérivé du titre — figé à la création. */
export function idLibreJournal(j: JournalDef, groupe: GroupeJournal, titre: string): string {
  const pris = new Set([...j.recit, ...j.fins].map((e) => e.id))
  pris.add(ID_RESERVE)
  const base = `${PREFIXE[groupe]}${slug(titre)}`
  if (!pris.has(base)) return base
  let n = 2
  while (pris.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

export function ajouteEntree(j: JournalDef, groupe: GroupeJournal, titre: string): JournalDef {
  const c = cloneJournal(j)
  c[groupe].push({ id: idLibreJournal(j, groupe, titre), icone: groupe === 'fins' ? '🚪' : '📄', titre, texte: '' })
  return c
}

export function supprimeEntree(j: JournalDef, groupe: GroupeJournal, id: string): JournalDef {
  const c = cloneJournal(j)
  c[groupe] = c[groupe].filter((e) => e.id !== id)
  // le seuil ne peut pas dépasser ce qui reste
  if (groupe === 'recit') c.revelationApres = Math.min(c.revelationApres, c.recit.length)
  else c.denouementApres = Math.min(c.denouementApres, c.fins.length)
  return c
}

/** Déplace l'entrée `de` à la position `vers` (indices dans le groupe). */
export function deplaceEntree(j: JournalDef, groupe: GroupeJournal, de: number, vers: number): JournalDef {
  const c = cloneJournal(j)
  const l = c[groupe]
  if (de < 0 || de >= l.length) return c
  const cible = Math.max(0, Math.min(l.length - 1, vers))
  const [e] = l.splice(de, 1)
  l.splice(cible, 0, e)
  return c
}

export function modifieEntree(
  j: JournalDef,
  groupe: GroupeJournal,
  id: string,
  champ: 'icone' | 'titre' | 'texte',
  valeur: string,
): JournalDef {
  const c = cloneJournal(j)
  const e = c[groupe].find((x) => x.id === id)
  if (e) e[champ] = valeur.slice(0, champ === 'icone' ? MAX_ICONE : champ === 'titre' ? MAX_TITRE : MAX_TEXTE)
  return c
}

export function poseSeuil(j: JournalDef, quoi: 'revelationApres' | 'denouementApres', n: number): JournalDef {
  const c = cloneJournal(j)
  const max = quoi === 'revelationApres' ? c.recit.length : c.fins.length
  c[quoi] = litSeuil(n, max, c[quoi])
  return c
}

// ---- LE JOURNAL COURANT -------------------------------------------------------
// Le livré tant que rien n'est publié ; celui du magasin dès qu'il arrive.

let courant: JournalDef = cloneJournal(JOURNAL_LIVRE)

export function journalCourant(): JournalDef {
  return courant
}

/** Pose le journal joué — null : retour au livré. */
export function poseJournal(j: JournalDef | null): void {
  courant = cloneJournal(j ?? JOURNAL_LIVRE)
}

// ---- LE RÉSEAU : le magasin partagé -----------------------------------------

const ENDPOINT = '/api/journal'

export interface JournalPublie {
  journal: JournalDef | null
  auteur: string
  date: string
}

/** Le journal publié — journal null : rien de publié (le livré joue) ;
 *  résultat null : pas de réseau, on garde ce qu'on a. */
export async function fetchJournal(): Promise<JournalPublie | null> {
  try {
    const r = await fetch(ENDPOINT, { cache: 'no-store' })
    if (!r.ok) return null
    return litPublie(await r.json())
  } catch {
    return null
  }
}

function litPublie(data: unknown): JournalPublie {
  const p = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>
  return {
    journal: litJournal(p.journal),
    auteur: typeof p.auteur === 'string' ? p.auteur : '',
    date: typeof p.date === 'string' ? p.date : '',
  }
}

export async function pushJournal(j: JournalDef, auteur: string): Promise<JournalPublie | null> {
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ journal: j, auteur }),
    })
    if (!r.ok) return null
    return litPublie(await r.json())
  } catch {
    return null
  }
}

/** Retire le journal publié : le livré reprend, pour tout le monde. */
export async function deleteJournal(): Promise<boolean> {
  try {
    const r = await fetch(ENDPOINT, { method: 'DELETE' })
    return r.ok
  } catch {
    return false
  }
}
