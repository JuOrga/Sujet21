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

// ---- L'OUVERTURE : la cinématique livrée, sur les SEPT planches générées
// par le concepteur — l'acte 0 d'une traite. Onze temps : naissance, regard,
// alerte, fuite, brèche, module vide, couloir, seuil du sas. La même planche
// sert souvent DEUX battements (nouveau cadrage, nouvelle réplique) : c'est
// du montage, pas du gaspillage d'images.
// Les SVG essai-*.svg restent en place : ils servent de planches
// provisoires aux cinématiques qui attendent leurs images.

export const CINEMATIQUE_ESSAI: CinematiqueDef = {
  code: 'ESSAI',
  titre: "L'ouverture — la cuve, l'alerte, la brèche, le sas",
  planches: [
    {
      image: '/assets/cine/ouverture-1.webp',
      texte: 'Module Méduse. Une cuve, une substance.',
      duree: 6,
      effet: 'zoom-avant',
      fondu: 'noir',
      bruitage: '',
      ponctuation: '',
      piste: 'cuve-tiede',
    },
    {
      // le même plan, resserré : vingt échecs avant elle, et puis elle
      image: '/assets/cine/ouverture-1.webp',
      texte: 'Vingt tentatives. Vingt échecs. Puis vous.',
      duree: 4.5,
      effet: 'pan-haut',
      fondu: 'aucun',
      bruitage: 'goutte-rosee',
      ponctuation: '',
      piste: '',
    },
    {
      image: '/assets/cine/ouverture-2.webp',
      texte: 'Qui êtes-vous ? Où êtes-vous ?',
      duree: 5,
      effet: 'pan-droite',
      fondu: 'aucun',
      bruitage: 'condensation',
      ponctuation: '',
      piste: '',
    },
    {
      // le regard s'attarde : ils ne vous regardent pas, ils vous relèvent
      image: '/assets/cine/ouverture-2.webp',
      texte: 'Ils ne vous regardent pas. Ils vous relèvent.',
      duree: 4,
      effet: 'zoom-avant',
      fondu: 'aucun',
      bruitage: '',
      ponctuation: '',
      piste: '',
    },
    {
      image: '/assets/cine/ouverture-3.webp',
      texte: 'Pas le temps de philosopher.',
      duree: 4,
      effet: 'battement-rouge',
      fondu: 'aucun',
      bruitage: 'souffle-vapeur',
      ponctuation: 'sting-derniere-impulsion',
      piste: '',
    },
    {
      // ils partent — et personne ne vient chercher l'expérience ratée
      image: '/assets/cine/ouverture-3.webp',
      texte: 'Ils partent. Personne ne vient vous chercher.',
      duree: 4,
      effet: 'pan-gauche',
      fondu: 'aucun',
      bruitage: '',
      ponctuation: '',
      piste: '',
    },
    {
      image: '/assets/cine/ouverture-4.webp',
      texte: 'Le confinement cède.',
      duree: 4.5,
      effet: 'tremblement',
      fondu: 'aucun',
      bruitage: 'impact-glace',
      ponctuation: '',
      piste: '',
    },
    {
      // le module après eux : la coupure au noir sépare les deux moitiés,
      // et la piste bascule du tiède au glacial — le module s'est refroidi
      image: '/assets/cine/depart-1.webp',
      texte: 'Le module est vide. Les portes ne se rouvriront pas.',
      duree: 5.5,
      effet: 'zoom-arriere',
      fondu: 'noir',
      bruitage: '',
      ponctuation: '',
      piste: 'cuve-glaciale',
    },
    {
      // le même plan, glissé sur la cuve crevée : ce qu'on laisse derrière soi
      image: '/assets/cine/depart-1.webp',
      texte: 'Personne ne reviendra chercher l’expérience ratée.',
      duree: 4,
      effet: 'pan-droite',
      fondu: 'aucun',
      bruitage: 'goutte-rosee',
      ponctuation: '',
      piste: '',
    },
    {
      image: '/assets/cine/depart-2.webp',
      texte: 'Une seule ouverture, au bout du couloir. Elle aspire.',
      duree: 5.5,
      effet: 'zoom-avant',
      fondu: 'aucun',
      bruitage: 'vortex-sas',
      ponctuation: '',
      piste: '',
    },
    {
      // le seuil : la dernière planche pose la règle du jeu entier
      image: '/assets/cine/depart-3.webp',
      texte: 'Rien ne se perd. Tout ce qui passe compte.',
      duree: 5,
      effet: 'zoom-avant',
      fondu: 'aucun',
      bruitage: '',
      ponctuation: 'sting-collecte',
      piste: '',
    },
  ],
}

// ---- LE DÉPART : la reprise courte, pour le moment « lancement-run » du
// scénario — celui qui se rejoue à CHAQUE run, quand l'ouverture, elle, ne
// passe qu'une fois. Ce sont les quatre derniers battements de l'ouverture,
// sur les mêmes trois planches : le joueur qui repart reconnaît le couloir
// sans se retaper la naissance.

export const CINEMATIQUE_DEPART: CinematiqueDef = {
  code: 'DEPART',
  titre: 'Le départ — le sas de lancement',
  planches: [
    {
      image: '/assets/cine/depart-1.webp',
      texte: 'Le module est vide. Les portes ne se rouvriront pas.',
      duree: 5.5,
      effet: 'zoom-arriere',
      fondu: 'noir',
      bruitage: '',
      ponctuation: '',
      piste: 'cuve-glaciale',
    },
    {
      // la cuve crevée au premier plan : ce qu'on laisse derrière soi
      image: '/assets/cine/depart-1.webp',
      texte: 'Personne ne reviendra chercher l’expérience ratée.',
      duree: 4,
      effet: 'pan-droite',
      fondu: 'aucun',
      bruitage: 'goutte-rosee',
      ponctuation: '',
      piste: '',
    },
    {
      image: '/assets/cine/depart-2.webp',
      texte: 'Une seule ouverture, au bout du couloir. Elle aspire.',
      duree: 5.5,
      effet: 'zoom-avant',
      fondu: 'aucun',
      bruitage: 'vortex-sas',
      ponctuation: '',
      piste: '',
    },
    {
      image: '/assets/cine/depart-3.webp',
      texte: 'Rien ne se perd. Tout ce qui passe compte.',
      duree: 5,
      effet: 'zoom-avant',
      fondu: 'aucun',
      bruitage: '',
      ponctuation: 'sting-collecte',
      piste: '',
    },
  ],
}

// ─── LA RÉVÉLATION : tout est raconté — le sceau du secteur 4 tombe.
// Jouée par la règle « livre-revelation » au retour au module, quand le
// dixième jalon du récit est servi. (Planches sur les images existantes :
// le montage peut publier les siennes, les règles publiées priment.)
export const CINEMATIQUE_REVELATION: CinematiqueDef = {
  code: 'REVELATION',
  titre: 'La révélation — le sceau tombe',
  planches: [
    {
      image: '/assets/cine/ouverture-2.webp',
      texte: 'Tout est consigné. Tout est lu. Il ne reste rien à cacher.',
      duree: 5,
      effet: 'zoom-avant',
      fondu: 'noir',
      bruitage: '',
      ponctuation: '',
      piste: 'cuve-glaciale',
    },
    {
      image: '/assets/cine/ouverture-3.webp',
      texte: 'Quelqu’un avait scellé cette porte en sachant ce qu’il faisait.',
      duree: 4.5,
      effet: 'tremblement',
      fondu: 'aucun',
      bruitage: 'impact-glace',
      ponctuation: '',
      piste: '',
    },
    {
      image: '/assets/cine/depart-2.webp',
      texte: 'Le sceau n’a plus de raison de tenir. Le secteur 4 s’ouvre.',
      duree: 5.5,
      effet: 'zoom-avant',
      fondu: 'aucun',
      bruitage: 'vortex-sas',
      ponctuation: 'sting-collecte',
      piste: '',
    },
  ],
}

// ─── LE MIROIR : la fin de l'arc — franchir le sas du secteur 4. Le
// convoyeur, la montée, et le choix que personne n'a eu avant vous.
export const CINEMATIQUE_MIROIR: CinematiqueDef = {
  code: 'MIROIR',
  titre: 'Le miroir — la fin de l’arc',
  planches: [
    {
      image: '/assets/cine/depart-3.webp',
      texte: 'La route du plasma mène au convoyeur. Le convoyeur mène là-haut.',
      duree: 5.5,
      effet: 'zoom-avant',
      fondu: 'noir',
      bruitage: 'vortex-sas',
      ponctuation: '',
      piste: 'cuve-glaciale',
    },
    {
      image: '/assets/cine/ouverture-4.webp',
      texte: 'Là-haut, un télescope achevé à un miroir près attend son œil.',
      duree: 5,
      effet: 'pan-haut',
      fondu: 'aucun',
      bruitage: '',
      ponctuation: '',
      piste: '',
    },
    {
      image: '/assets/cine/ouverture-2.webp',
      texte: 'Devenir l’œil qui regarde l’univers — ou rester ce que vous êtes devenu.',
      duree: 6,
      effet: 'zoom-arriere',
      fondu: 'aucun',
      bruitage: '',
      ponctuation: '',
      piste: '',
    },
    {
      image: '/assets/cine/ouverture-1.webp',
      texte: 'Personne n’a jamais eu ce choix avant vous. Personne ne vous le prendra.',
      duree: 6,
      effet: 'fixe',
      fondu: 'blanc',
      bruitage: '',
      ponctuation: 'sting-collecte',
      piste: '',
    },
  ],
}

/** Les cinématiques livrées avec le jeu (lecture seule à la table). */
export const CINEMATIQUES_LIVREES: CinematiqueDef[] = [
  CINEMATIQUE_ESSAI,
  CINEMATIQUE_REVELATION,
  CINEMATIQUE_MIROIR,
  CINEMATIQUE_DEPART,
]
