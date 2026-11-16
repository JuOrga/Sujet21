// L'AVIS DU JOUEUR SUR UNE SALLE — posé en un geste, au bilan de fin de
// salle. Le concepteur n'avait, pour savoir ce que vaut une salle, que ce
// que les testeurs pensaient à lui dire après coup : la salle pénible
// était oubliée trois salles plus loin. Le bilan est l'instant où l'on
// sait ce qu'on vient de vivre ; une rangée de cinq crans s'y tient sous
// le levier, et un clic (ou une touche de 1 à 5) suffit.
//
// « AVIS », pas « note » : la NOTE est déjà le score d'une salle (le volume
// pesé par la vitesse, game/ceremonie.ts motDeNote), et les étoiles disent
// son rang. L'avis, lui, juge la salle, pas le joueur.
//
// UN AVIS PAR PERSONNE ET PAR SALLE, de 1 à 5, le dernier posé fait foi.
// La personne, c'est le nom de la borne (celui des records) — sans nom,
// « anonyme », et tous les anonymes ne font qu'un : la même règle que
// l'avis sur une musique (ecouteAvis.ts). Retirer le sien (re-presser son
// cran) est l'absence d'entrée, pas une valeur rangée.
//
// DEUX ÉTAGES, parce qu'une écriture au magasin coûte 3 opérations sur les
// 2 000 du mois (api/_magasin.ts) et qu'une descente franchit une dizaine
// de salles :
//   · LE CARNET, sur le poste (localStorage) : mes avis, et ceux qui
//     ATTENDENT d'être publiés. Poser un avis n'écrit que là.
//   · LE DOCUMENT partagé (/api/reglages, domaine « avis-salles ») : les
//     avis de tous. Le carnet s'y verse d'UN coup — à la fin de la
//     descente, au retour à la fiche, et au démarrage s'il reste de
//     l'attente (le joueur a fermé l'onglet en pleine descente).
//
// Ce module tient la règle (bornes, moyenne, carnet) et rien du DOM : la
// rangée et la publication vivent dans main.ts.

import { AUTEUR_MAX, auteurAvis } from './ecouteAvis'

export type AvisSalle = 1 | 2 | 3 | 4 | 5

/** Les cinq crans, du plus bas au plus haut. */
export const CRANS_AVIS: readonly AvisSalle[] = [1, 2, 3, 4, 5]

/** Le mot de chaque cran — il accorde « cette salle est … ». */
export const MOTS_AVIS: Record<AvisSalle, string> = {
  1: 'pénible',
  2: 'bancale',
  3: 'correcte',
  4: 'bonne',
  5: 'excellente',
}

export interface AvisSallePose {
  avis: AvisSalle
  date: string
}

export interface DocumentAvisSalles {
  /** par code de salle (LevelDef.code), puis par auteur */
  avis: Record<string, Record<string, AvisSallePose>>
}

/** Un code de salle tient en 16 signes — la borne des records (api/records.ts). */
export const CODE_MAX = 16

/** LE PLAFOND DU DOCUMENT, en salles. Les salles GÉNÉRÉES portent leur
 *  graine dans leur code (« G-… ») : chaque descente en apporte de neuves,
 *  et le document grossirait sans fin vers les 200 Ko que le magasin
 *  accepte. On garde les salles dont l'avis le plus récent est le plus
 *  récent : une salle écrite, rejouée, ne sort jamais ; une graine d'il y a
 *  six mois, si. */
export const SALLES_MAX = 300

function objet(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function avisDeBrut(brut: unknown): AvisSalle | null {
  return brut === 1 || brut === 2 || brut === 3 || brut === 4 || brut === 5 ? brut : null
}

function codeDeBrut(brut: string): string {
  return brut.trim().slice(0, CODE_MAX)
}

/**
 * Le document tel qu'il arrive (magasin, ou rien), ramené dans ses bornes :
 * un code de salle court et non vide, un auteur non vide, un avis entier de
 * 1 à 5, une date texte. Ce qui ne rentre pas est écarté sans bruit — le
 * serveur ne connaît pas la forme, c'est ici qu'elle se tient.
 */
export function lisAvisSalles(document: unknown): DocumentAvisSalles {
  const brutes = objet(objet(document)?.avis) ?? {}
  const out: Record<string, Record<string, AvisSallePose>> = {}
  for (const [codeBrut, parAuteurBrut] of Object.entries(brutes)) {
    const code = codeDeBrut(codeBrut)
    const parAuteur = objet(parAuteurBrut)
    if (!code || !parAuteur) continue
    const entrees: Record<string, AvisSallePose> = { ...(out[code] ?? {}) }
    for (const [nom, e] of Object.entries(parAuteur)) {
      const r = objet(e)
      const avis = r ? avisDeBrut(r.avis) : null
      const auteur = nom.trim().slice(0, AUTEUR_MAX)
      if (avis === null || !auteur) continue
      entrees[auteur] = { avis, date: typeof r!.date === 'string' ? r!.date : '' }
    }
    if (Object.keys(entrees).length > 0) out[code] = entrees
  }
  return { avis: out }
}

/** L'avis d'une personne sur une salle : 1 à 5, ou 0 si elle n'en a pas. */
export function avisSalleDe(doc: DocumentAvisSalles, code: string, auteur: string): AvisSalle | 0 {
  return doc.avis[codeDeBrut(code)]?.[auteurAvis(auteur)]?.avis ?? 0
}

/**
 * Pose l'avis d'une personne — et rend un document NEUF. `0` retire le
 * sien : son entrée disparaît, celles des autres restent. Un code vide ne
 * pose rien (une salle sans code n'a pas d'identité à juger).
 */
export function poseAvisSalle(
  doc: DocumentAvisSalles,
  code: string,
  avis: AvisSalle | 0,
  auteur: string,
  date: string,
): DocumentAvisSalles {
  const c = codeDeBrut(code)
  if (!c) return doc
  const nom = auteurAvis(auteur)
  const entrees = { ...(doc.avis[c] ?? {}) }
  if (avis === 0) delete entrees[nom]
  else entrees[nom] = { avis, date }
  const out = { ...doc.avis }
  if (Object.keys(entrees).length === 0) delete out[c]
  else out[c] = entrees
  return { avis: out }
}

/** La moyenne d'une salle et le nombre d'avis qui la portent — null sans avis. */
export function moyenneAvis(doc: DocumentAvisSalles, code: string): { n: number; moyenne: number } | null {
  const entrees = Object.values(doc.avis[codeDeBrut(code)] ?? {})
  if (entrees.length === 0) return null
  return { n: entrees.length, moyenne: entrees.reduce((s, e) => s + e.avis, 0) / entrees.length }
}

/** Ce que le palmarès dit d'une salle : « 4,3 / 5 · 3 avis » — ou rien. Le
 *  nombre d'avis suit TOUJOURS la moyenne : un 5 / 5 d'une seule voix ne
 *  doit pas se lire comme un plébiscite. */
export function ligneMoyenne(doc: DocumentAvisSalles, code: string): string {
  const m = moyenneAvis(doc, code)
  if (!m) return ''
  return `${m.moyenne.toFixed(1).replace('.', ',')} / 5 · ${m.n} avis`
}

/** Ramène le document sous son plafond : les salles à l'avis le plus
 *  récent restent (voir SALLES_MAX). Sous le plafond, le document est rendu
 *  tel quel. */
export function elagueAvisSalles(doc: DocumentAvisSalles, max: number = SALLES_MAX): DocumentAvisSalles {
  const codes = Object.keys(doc.avis)
  if (codes.length <= max) return doc
  const dernier = (code: string): string =>
    Object.values(doc.avis[code]).reduce((d, e) => (e.date > d ? e.date : d), '')
  const gardes = codes
    .map((code) => ({ code, date: dernier(code) }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, Math.max(0, max))
  const out: Record<string, Record<string, AvisSallePose>> = {}
  for (const { code } of gardes) out[code] = doc.avis[code]
  return { avis: out }
}

// ---- LE CARNET : mes avis sur ce poste, et ce qui attend le magasin ----

export interface AvisEnAttente {
  /** 0 : retirer le mien du document partagé */
  avis: AvisSalle | 0
  date: string
}

export interface CarnetAvis {
  /** mon avis par salle — ce que la rangée rallume quand je rejoue la salle */
  miens: Record<string, AvisSallePose>
  /** ce qui a changé depuis la dernière publication, par salle */
  attente: Record<string, AvisEnAttente>
}

/** Le carnet tel qu'il sort de localStorage (ou rien), dans ses bornes. Un
 *  carnet illisible est un carnet vide : on perd un rappel, pas le jeu. */
export function lisCarnetAvis(brut: string | null): CarnetAvis {
  let p: Record<string, unknown> | null = null
  try {
    p = brut ? objet(JSON.parse(brut)) : null
  } catch {
    p = null
  }
  const miens: Record<string, AvisSallePose> = {}
  const attente: Record<string, AvisEnAttente> = {}
  for (const [codeBrut, e] of Object.entries(objet(p?.miens) ?? {})) {
    const code = codeDeBrut(codeBrut)
    const r = objet(e)
    const avis = r ? avisDeBrut(r.avis) : null
    if (code && avis !== null) miens[code] = { avis, date: typeof r!.date === 'string' ? r!.date : '' }
  }
  for (const [codeBrut, e] of Object.entries(objet(p?.attente) ?? {})) {
    const code = codeDeBrut(codeBrut)
    const r = objet(e)
    if (!code || !r) continue
    const avis = r.avis === 0 ? 0 : avisDeBrut(r.avis)
    if (avis !== null) attente[code] = { avis, date: typeof r.date === 'string' ? r.date : '' }
  }
  return { miens, attente }
}

/** LE GESTE SUR UN CRAN : presser un autre cran change d'avis, re-presser
 *  le sien le retire — c'est la seule façon de revenir sur un clic parti
 *  trop vite, et elle ne demande pas de sixième bouton. */
export function avisAuGeste(courant: AvisSalle | 0, presse: AvisSalle): AvisSalle | 0 {
  return courant === presse ? 0 : presse
}

/** La touche du clavier qui pose un avis : « 1 » à « 5 », rangée du haut
 *  comme pavé numérique (les deux rendent le même `key`). */
export function avisDeTouche(key: string): AvisSalle | null {
  return key.length === 1 ? avisDeBrut(Number(key)) : null
}

/** Inscrit un avis au carnet — et rend un carnet NEUF : le mien change tout
 *  de suite, et la salle passe en attente de publication. */
export function noteAuCarnet(carnet: CarnetAvis, code: string, avis: AvisSalle | 0, date: string): CarnetAvis {
  const c = codeDeBrut(code)
  if (!c) return carnet
  const miens = { ...carnet.miens }
  if (avis === 0) delete miens[c]
  else miens[c] = { avis, date }
  return { miens, attente: { ...carnet.attente, [c]: { avis, date } } }
}

/** Le document partagé avec MON attente posée par-dessus : ce qu'on publie
 *  (relu au magasin d'abord), et ce qu'on montre avant d'avoir publié. */
export function superposeAttente(
  doc: DocumentAvisSalles,
  attente: Record<string, AvisEnAttente>,
  auteur: string,
): DocumentAvisSalles {
  let out = doc
  for (const [code, a] of Object.entries(attente)) out = poseAvisSalle(out, code, a.avis, auteur, a.date)
  return out
}

/** Le carnet une fois l'envoi ACCEPTÉ : ce qui est parti quitte l'attente —
 *  sauf la salle re-jugée PENDANT l'écriture (sa date a changé) : celle-là
 *  attend le prochain envoi, sinon le dernier avis posé ne partirait jamais. */
export function carnetApresEnvoi(carnet: CarnetAvis, envoyees: Record<string, AvisEnAttente>): CarnetAvis {
  const attente: Record<string, AvisEnAttente> = {}
  for (const [code, a] of Object.entries(carnet.attente)) {
    const parti = envoyees[code]
    if (!parti || parti.date !== a.date || parti.avis !== a.avis) attente[code] = a
  }
  return { miens: carnet.miens, attente }
}
