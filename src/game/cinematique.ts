// Cinématiques en planches : la troisième famille d'écrans, entre le menu
// et le tableau jouable. Une cinématique est une DONNÉE (comme un tableau) :
// une suite de planches illustrées — image plein écran, lent mouvement de
// caméra, texte, sons — que le lecteur (cinelecteur.ts) enchaîne. Le
// vocabulaire d'effets est fermé : le montage compose, il ne code pas.

import { BRUITAGES, PISTES, PONCTUATIONS } from './soundtrack'

// Le mouvement de la planche, sur toute sa durée. « battement-rouge »
// est l'alerte : pulsation rouge par-dessus un zoom discret.
export type EffetPlanche =
  | 'fixe'
  | 'zoom-avant'
  | 'zoom-arriere'
  | 'pan-gauche'
  | 'pan-droite'
  | 'pan-haut'
  | 'pan-bas'
  | 'tremblement'
  | 'battement-rouge'

export const EFFETS: EffetPlanche[] = [
  'fixe',
  'zoom-avant',
  'zoom-arriere',
  'pan-gauche',
  'pan-droite',
  'pan-haut',
  'pan-bas',
  'tremblement',
  'battement-rouge',
]

export const EFFET_NOMS: Record<EffetPlanche, string> = {
  fixe: 'Fixe',
  'zoom-avant': 'Zoom avant (lent)',
  'zoom-arriere': 'Zoom arrière (lent)',
  'pan-gauche': 'Panoramique vers la gauche',
  'pan-droite': 'Panoramique vers la droite',
  'pan-haut': 'Panoramique vers le haut',
  'pan-bas': 'Panoramique vers le bas',
  tremblement: 'Tremblement',
  'battement-rouge': 'Alerte (battement rouge)',
}

// Le fondu d'ENTRÉE de la planche (la sortie est le fondu d'entrée de la
// suivante — un seul réglage par jonction, pas deux qui se contredisent).
export type FonduPlanche = 'noir' | 'blanc' | 'aucun'
export const FONDUS: FonduPlanche[] = ['noir', 'blanc', 'aucun']

export interface PlancheDef {
  image: string // URL d'un asset (public/assets/…) ou data URI
  texte: string // '' : planche muette
  duree: number // secondes, bornée DUREE_MIN..DUREE_MAX
  effet: EffetPlanche
  fondu: FonduPlanche
  bruitage: string // '' : aucun — sinon un nom de Bruitage (soundtrack)
  ponctuation: string // '' : aucune — sinon un nom de Ponctuation
  piste: string // '' : la musique en cours continue — sinon un nom de Piste
}

export interface CinematiqueDef {
  code: string
  titre: string
  planches: PlancheDef[]
}

export const DUREE_MIN = 1
export const DUREE_MAX = 30
export const DUREE_DEFAUT = 5

export function plancheVierge(): PlancheDef {
  return {
    image: '',
    texte: '',
    duree: DUREE_DEFAUT,
    effet: 'zoom-avant',
    fondu: 'noir',
    bruitage: '',
    ponctuation: '',
    piste: '',
  }
}

// ---- IO : parse tolérant (rejets nommés, jamais d'exception), même
// contrat que levelIO — une donnée corrompue perd le champ, pas le tout.

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function parsePlanche(
  obj: unknown,
  idx: number,
  rejets: string[],
): PlancheDef | null {
  if (typeof obj !== 'object' || obj === null) {
    rejets.push(`planche ${idx + 1} : entrée illisible, ignorée`)
    return null
  }
  const o = obj as Record<string, unknown>
  const p = plancheVierge()
  p.image = str(o.image)
  p.texte = str(o.texte)
  if (typeof o.duree === 'number' && Number.isFinite(o.duree)) {
    const bornee = Math.min(DUREE_MAX, Math.max(DUREE_MIN, o.duree))
    if (bornee !== o.duree)
      rejets.push(`planche ${idx + 1} : durée ramenée à ${bornee} s`)
    p.duree = bornee
  }
  const effet = str(o.effet)
  if (effet) {
    if ((EFFETS as string[]).includes(effet)) p.effet = effet as EffetPlanche
    else
      rejets.push(
        `planche ${idx + 1} : effet « ${effet} » inconnu, zoom-avant à la place`,
      )
  }
  const fondu = str(o.fondu)
  if (fondu) {
    if ((FONDUS as string[]).includes(fondu)) p.fondu = fondu as FonduPlanche
    else
      rejets.push(
        `planche ${idx + 1} : fondu « ${fondu} » inconnu, noir à la place`,
      )
  }
  const bruitage = str(o.bruitage)
  if (bruitage) {
    if ((BRUITAGES as string[]).includes(bruitage)) p.bruitage = bruitage
    else
      rejets.push(
        `planche ${idx + 1} : bruitage « ${bruitage} » inconnu, retiré`,
      )
  }
  const ponctuation = str(o.ponctuation)
  if (ponctuation) {
    if ((PONCTUATIONS as string[]).includes(ponctuation))
      p.ponctuation = ponctuation
    else
      rejets.push(
        `planche ${idx + 1} : ponctuation « ${ponctuation} » inconnue, retirée`,
      )
  }
  const piste = str(o.piste)
  if (piste) {
    if ((PISTES as string[]).includes(piste)) p.piste = piste
    else
      rejets.push(`planche ${idx + 1} : piste « ${piste} » inconnue, retirée`)
  }
  return p
}

export function parseCinematique(
  obj: unknown,
): { cine: CinematiqueDef; rejets: string[] } | null {
  if (typeof obj !== 'object' || obj === null) return null
  const o = obj as Record<string, unknown>
  const rejets: string[] = []
  const code = str(o.code).trim()
  if (!code) return null
  const brut = Array.isArray(o.planches) ? o.planches : []
  const planches: PlancheDef[] = []
  for (let i = 0; i < brut.length; i++) {
    const p = parsePlanche(brut[i], i, rejets)
    if (p) planches.push(p)
  }
  if (planches.length === 0) return null
  return {
    cine: { code, titre: str(o.titre).trim() || code, planches },
    rejets,
  }
}

export function serializeCinematique(cine: CinematiqueDef): string {
  return JSON.stringify(cine, null, 2)
}

// ---- La réserve locale (table de montage) : les cinématiques du poste,
// à côté des livrées. Une entrée corrompue est écartée, jamais bloquante.

const CLE_CINES = 'sujet21-cinematiques-v1'

export function chargeCinematiques(): CinematiqueDef[] {
  try {
    const raw = localStorage.getItem(CLE_CINES)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    const out: CinematiqueDef[] = []
    for (const e of arr) {
      const r = parseCinematique(e)
      if (r) out.push(r.cine)
    }
    return out
  } catch {
    return []
  }
}

export function sauveCinematiques(cines: CinematiqueDef[]): void {
  try {
    localStorage.setItem(CLE_CINES, JSON.stringify(cines))
  } catch {
    // stockage indisponible : la table vit en mémoire pour la session
  }
}

// ---- La cinématique d'essai (images provisoires) : l'esquisse de
// l'ouverture, en attendant les planches générées par le concepteur.

export const CINEMATIQUE_ESSAI: CinematiqueDef = {
  code: 'ESSAI',
  titre: "Essai — esquisse de l'ouverture",
  planches: [
    {
      image: '/assets/cine/essai-1.svg',
      texte: 'Module Méduse. Une cuve, une substance. Vingt échecs avant elle.',
      duree: 6,
      effet: 'zoom-avant',
      fondu: 'noir',
      bruitage: '',
      ponctuation: '',
      piste: 'cuve-tiede',
    },
    {
      image: '/assets/cine/essai-2.svg',
      texte: 'Qui êtes-vous ? Où êtes-vous ?',
      duree: 5,
      effet: 'pan-droite',
      fondu: 'aucun',
      bruitage: 'condensation',
      ponctuation: '',
      piste: '',
    },
    {
      image: '/assets/cine/essai-3.svg',
      texte: 'Pas le temps de philosopher.',
      duree: 4,
      effet: 'battement-rouge',
      fondu: 'aucun',
      bruitage: 'souffle-vapeur',
      ponctuation: 'sting-derniere-impulsion',
      piste: '',
    },
    {
      image: '/assets/cine/essai-4.svg',
      texte: 'Le confinement cède.',
      duree: 4,
      effet: 'tremblement',
      fondu: 'aucun',
      bruitage: 'impact-glace',
      ponctuation: '',
      piste: '',
    },
  ],
}
