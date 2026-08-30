// L'ATELIER DES TEXTES : retoucher le lore sans toucher au code.
//
// Le catalogue (catalogue.ts) LIT les modules du jeu : il est la SOURCE,
// et il est pur. Ce module pose une couche par-dessus — les retouches du
// concepteur, rangées par langue et par clé.
//
// LA TROUVAILLE, c'est que réécrire et traduire sont le même geste. Une
// retouche française remplace la source ; une entrée anglaise remplit un
// vide. Même stockage, même export, même écran. Ajouter une langue ne
// demande donc rien d'autre qu'une ligne dans LANGUES — pas une refonte.
//
// OÙ VIVENT CES RETOUCHES : dans le stockage du poste, comme les cartes de
// l'atelier des récompenses. Elles ne sont pas dans le dépôt tant qu'on ne
// les a pas exportées et gravées — et l'écran le dit sans détour, pour que
// personne ne réécrive cinq cents textes en croyant les avoir livrés.

import type { EntreeTexte } from './catalogue'

export type Langue = 'fr' | 'en'

export interface LangueDef {
  code: Langue
  nom: string
  /** La langue SOURCE : celle qu'on lit dans le code. Une seule. */
  source?: boolean
}

export const LANGUES: LangueDef[] = [
  { code: 'fr', nom: 'Français', source: true },
  { code: 'en', nom: 'English' },
]

export const LANGUE_SOURCE: Langue = 'fr'

export function langueDef(code: string): LangueDef | null {
  return LANGUES.find((l) => l.code === code) ?? null
}

const CLE = 'projet21.textes.v1'

function stockage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null // navigation privée : l'atelier tient pour la session
  }
}

type Registre = Partial<Record<Langue, Record<string, string>>>
let registre: Registre | null = null

function lu(): Registre {
  if (registre) return registre
  registre = {}
  try {
    const brut = stockage()?.getItem(CLE)
    if (brut) {
      const d = JSON.parse(brut) as unknown
      if (d && typeof d === 'object') {
        for (const l of LANGUES) {
          const bloc = (d as Registre)[l.code]
          if (!bloc || typeof bloc !== 'object') continue
          const propre: Record<string, string> = {}
          for (const [k, v] of Object.entries(bloc))
            if (typeof v === 'string') propre[k] = v
          registre[l.code] = propre
        }
      }
    }
  } catch {
    registre = {} // registre illisible : on repart à vide, le jeu tourne
  }
  return registre
}

function ecrit(): void {
  try {
    stockage()?.setItem(CLE, JSON.stringify(lu()))
  } catch {
    // plein ou refusé : les retouches valent pour la session
  }
}

/** Les retouches d'une langue, par clé. */
export function surcharges(langue: Langue): Record<string, string> {
  const r = lu()
  if (!r[langue]) r[langue] = {}
  return r[langue]
}

/**
 * Pose une retouche. Un texte VIDE, ou identique à la source, efface la
 * retouche au lieu d'en enregistrer une : on ne garde pas une surcharge
 * qui ne surcharge rien — elle ferait croire à un travail fait.
 */
export function poseTexte(
  langue: Langue,
  cle: string,
  texte: string,
  source: string,
): void {
  const t = texte.trim()
  const bloc = surcharges(langue)
  if (!t || (langue === LANGUE_SOURCE && t === source.trim())) delete bloc[cle]
  else bloc[cle] = t
  ecrit()
}

export function retireTexte(langue: Langue, cle: string): void {
  delete surcharges(langue)[cle]
  ecrit()
}

export function videLangue(langue: Langue): void {
  lu()[langue] = {}
  ecrit()
}

/** L'état d'une entrée dans la langue regardée. */
export type EtatTexte = 'origine' | 'retouche' | 'traduit' | 'a-traduire'

export interface EntreeLangue extends EntreeTexte {
  /** Le texte du CODE, toujours — la référence pendant qu'on traduit. */
  source: string
  etat: EtatTexte
}

/**
 * Le catalogue vu dans une langue. `texte` porte ce qu'on lit à l'écran :
 * la retouche s'il y en a une, la source sinon — et rien du tout dans une
 * langue où la traduction manque, parce qu'un trou doit se voir.
 */
export function applique(
  cat: EntreeTexte[],
  langue: Langue,
): EntreeLangue[] {
  const sur = surcharges(langue)
  const estSource = langue === LANGUE_SOURCE
  return cat.map((e) => {
    const retouche = sur[e.cle]
    const texte = retouche ?? (estSource ? e.texte : '')
    const etat: EtatTexte = retouche
      ? estSource
        ? 'retouche'
        : 'traduit'
      : estSource
        ? 'origine'
        : 'a-traduire'
    return { ...e, texte, source: e.texte, etat }
  })
}

export interface AvanceLangue {
  total: number
  faits: number
  /** Les signes du travail RENDU dans cette langue. */
  signes: number
}

/** Où en est une langue : ce qui est traduit, ce qui manque. */
export function avance(entrees: EntreeLangue[]): AvanceLangue {
  let faits = 0
  let signes = 0
  for (const e of entrees) {
    if (e.etat === 'retouche' || e.etat === 'traduit') faits++
    signes += e.texte.length
  }
  return { total: entrees.length, faits, signes }
}

/**
 * L'export d'une langue : les CLÉS et leurs textes, rien d'autre. C'est ce
 * qu'on rend pour graver dans le code — ou ce qu'un traducteur renvoie.
 */
export function exporteTextes(langue: Langue): string {
  const bloc = surcharges(langue)
  const cles = Object.keys(bloc).sort()
  const ordonne: Record<string, string> = {}
  for (const c of cles) ordonne[c] = bloc[c]
  return JSON.stringify({ langue, textes: ordonne }, null, 2)
}

/**
 * Reprend un export. Rend le nombre de textes repris, ou -1 si illisible.
 * La langue du document l'emporte sur celle qu'on regarde : un fichier
 * anglais ne doit pas atterrir dans le français parce qu'un onglet était
 * ouvert au mauvais endroit.
 */
export function importeTextes(json: string): {
  langue: Langue | null
  repris: number
} {
  let d: unknown
  try {
    d = JSON.parse(json)
  } catch {
    return { langue: null, repris: -1 }
  }
  if (!d || typeof d !== 'object') return { langue: null, repris: -1 }
  const o = d as { langue?: unknown; textes?: unknown }
  const l = langueDef(String(o.langue))
  if (!l) return { langue: null, repris: -1 }
  if (!o.textes || typeof o.textes !== 'object')
    return { langue: l.code, repris: -1 }
  const bloc = surcharges(l.code)
  let n = 0
  for (const [k, v] of Object.entries(o.textes as Record<string, unknown>)) {
    if (typeof v !== 'string') continue
    const t = v.trim()
    if (!t) continue
    bloc[k] = t
    n++
  }
  ecrit()
  return { langue: l.code, repris: n }
}
