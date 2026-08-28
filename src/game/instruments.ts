// LES INSTRUMENTS EMBARQUÉS : la récompense de fin de salle. Trois cartes
// se retournent, on en emporte UNE pour le reste de la run — un avantage
// LATÉRAL, jamais un raccourci (règle d'or du doc de conception). Certaines
// cartes sont PAYANTES en condensat : la première dépense de la monnaie
// méta — le banc d'étalonnage (permanent) viendra ensuite.

import type { Effet, LevierId } from './leviers'
import { phraseEffet, valeurLevier } from './leviers'

export interface InstrumentDef {
  id: string
  nom: string
  desc: string
  icone: string
  /** Ce que la carte FAIT, en leviers. Le jeu ne lit que ça. */
  effets: Effet[]
  /** Carte fabriquée à l'écran des récompenses (jamais livrée en dur). */
  perso?: boolean
}

export const INSTRUMENTS: InstrumentDef[] = [
  {
    id: 'echantillon-secours',
    nom: 'Échantillon de secours',
    desc: 'Un échantillon de plus en réserve : une dispersion pardonnée.',
    icone: '🧪',
    effets: [{ levier: 'vies', valeur: 1 }],
  },
  {
    id: 'gaine-isolante',
    nom: 'Gaine isolante',
    desc: 'Le refroidissement du vaisseau mord un tiers plus lentement.',
    icone: '🧊',
    effets: [{ levier: 'froid', valeur: 1.5 }],
  },
  {
    id: 'buse-calibree',
    nom: 'Buse calibrée',
    desc: 'Un dash de plus dans la réserve de chaque tableau.',
    icone: '💨',
    effets: [{ levier: 'dashs', valeur: 1 }],
  },
  {
    id: 'aimant-rosee',
    nom: 'Aimant à rosée',
    desc: 'La rosée recondensée rend nettement plus de volume.',
    icone: '🫧',
    effets: [{ levier: 'rosee', valeur: 0.35 }],
  },
  {
    id: 'chambre-froide',
    nom: 'Chambre froide',
    desc: 'La prime de glace vaut moitié plus au sas.',
    icone: '⚗️',
    effets: [{ levier: 'primeGlace', valeur: 1.5 }],
  },

  // ——— Le corps et sa matière ————————————————————————————————
  {
    id: 'peau-tendue',
    nom: 'Peau tendue',
    desc: 'Les gouttes éjectées redeviennent réabsorbables deux fois plus tôt.',
    icone: '🩹',
    effets: [{ levier: 'reabsorption', valeur: 0.5 }],
  },
  {
    id: 'vanne-de-secours',
    nom: 'Vanne de secours',
    desc: 'Le corps tient plus bas : le seuil de dispersion descend d’un cinquième.',
    icone: '🚨',
    effets: [{ levier: 'seuilDispersion', valeur: 0.8 }],
  },
  {
    id: 'plastron',
    nom: 'Plastron',
    desc: 'L’éponge a moins de prise : elle boit un quart moins vite.',
    icone: '🛡️',
    effets: [{ levier: 'priseEponge', valeur: 0.75 }],
  },

  // ——— Les états ————————————————————————————————————————————
  {
    id: 'detendeur',
    nom: 'Détendeur',
    desc: 'Se vaporiser coûte 40 % de moins : le péage en gouttes s’allège.',
    icone: '🫁',
    effets: [{ levier: 'peageVapeur', valeur: 0.6 }],
  },
  {
    id: 'patins-de-givre',
    nom: 'Patins de givre',
    desc: 'Le palet de glace rebondit presque sans s’amortir.',
    icone: '⛸️',
    effets: [{ levier: 'rebondGlace', valeur: 1.35 }],
  },
  {
    id: 'lentille-de-visee',
    nom: 'Lentille de visée',
    desc: 'La visée du dash ralentit le temps deux fois plus : on choisit sa ligne.',
    icone: '🔭',
    effets: [{ levier: 'visee', valeur: 0.5 }],
  },

  // ——— La collecte et la bourse ——————————————————————————————
  {
    id: 'gueule-ouverte',
    nom: 'Gueule ouverte',
    desc: 'Le sas aspire de moitié plus loin : les traînardes rentrent seules.',
    icone: '🌀',
    effets: [{ levier: 'sasPortee', valeur: 1.5 }],
  },
  {
    id: 'filtre-a-condensat',
    nom: 'Filtre à condensat',
    desc: 'Un quart de condensat en plus sur tout ce qui passe le sas.',
    icone: '💧',
    effets: [{ levier: 'condensat', valeur: 1.25 }],
  },
  {
    id: 'ballast',
    nom: 'Ballast',
    desc: 'La bonbonne emporte trois litres de plus.',
    icone: '⚖️',
    effets: [{ levier: 'bonbonne', valeur: 3 }],
  },

  // ——— Les états, suite : ce que coûte une transformation ————
  // (aucune de ces cartes ne touche au VOLUME DE LA GLACE : un bloc ne se
  //  fait jamais grignoter au contact — c'est la vapeur qui fuit, la glace
  //  ne perd rien à toucher quoi que ce soit.)
  {
    id: 'bascule-rapide',
    nom: 'Bascule rapide',
    desc: 'Se figer ou se vaporiser prend 40 % de temps en moins.',
    icone: '⏱️',
    effets: [{ levier: 'bascule', valeur: 0.6 }],
  },
  {
    id: 'chambre-etanche',
    nom: 'Chambre étanche',
    desc: 'Le nuage s’évapore beaucoup moins vite quand il ne fait rien.',
    icone: '🧯',
    effets: [{ levier: 'perteVapeur', valeur: 0.55 }],
  },
  {
    id: 'tamis-fin',
    nom: 'Tamis fin',
    desc: 'Traverser une maille d’évent ne coûte presque plus de vapeur.',
    icone: '🕸️',
    effets: [{ levier: 'perteGrille', valeur: 0.4 }],
  },
  {
    id: 'semelles-polies',
    nom: 'Semelles polies',
    desc: 'L’hydrophile ne retient presque plus le palet : la glace garde sa ligne.',
    icone: '🛷',
    effets: [{ levier: 'glisseGlace', valeur: 0.4 }],
  },
  {
    id: 'croc-du-sas',
    nom: 'Croc du sas',
    desc: 'Le sas happe la glace : un palet ne file plus devant la bouche.',
    icone: '🪝',
    effets: [{ levier: 'priseSasGlace', valeur: 2 }],
  },

  // ——— LES CONTREPARTIES : ce qu'on gagne, ce qu'on paie ————
  // Une carte peut tirer un levier du mauvais côté. C'est là que le tirage
  // devient un choix : l'avantage se lit d'un œil, le prix de l'autre.
  {
    id: 'sur-regime',
    nom: 'Sur-régime',
    desc: 'Deux dashs de plus par tableau — la bonbonne emporte deux litres de moins.',
    icone: '🔥',
    effets: [
      { levier: 'dashs', valeur: 2 },
      { levier: 'bonbonne', valeur: -2 },
    ],
  },
  {
    id: 'ration-de-survie',
    nom: 'Ration de survie',
    desc: 'Un échantillon de secours de plus — le Semblable prélève sa dîme : un cinquième du condensat.',
    icone: '🥫',
    effets: [
      { levier: 'vies', valeur: 1 },
      { levier: 'condensat', valeur: 0.8 },
    ],
  },
  {
    id: 'oeilleres',
    nom: 'Œillères',
    desc: 'La visée du dash ralentit deux fois plus le temps — mais le sas aspire 30 % moins loin.',
    icone: '👁️',
    effets: [
      { levier: 'visee', valeur: 0.5 },
      { levier: 'sasPortee', valeur: 0.7 },
    ],
  },

  // ——— Le protocole lui-même ————————————————————————————————
  {
    id: 'carnet-du-semblable',
    nom: 'Carnet du Semblable',
    desc: 'Une carte de plus à chaque tirage de fin de salle.',
    icone: '📓',
    effets: [{ levier: 'cartes', valeur: 1 }],
  },
]

export function instrumentDef(
  id: string,
  catalogue: InstrumentDef[] = INSTRUMENTS,
): InstrumentDef | null {
  return catalogue.find((t) => t.id === id) ?? null
}

/** Tous les effets des cartes EMPORTÉES, mis bout à bout. */
export function effetsTenus(
  tenus: string[],
  catalogue: InstrumentDef[] = INSTRUMENTS,
): Effet[] {
  const out: Effet[] = []
  for (const id of tenus) {
    const d = instrumentDef(id, catalogue)
    if (d) out.push(...d.effets)
  }
  return out
}

/**
 * Ce que vaut un levier pour la run en cours. C'est L'UNIQUE question que
 * le jeu pose au catalogue : il ne demande jamais « ai-je telle carte »,
 * il demande « que vaut ce levier » — et une carte fabriquée à l'écran des
 * récompenses répond exactement comme une carte livrée.
 */
export function levier(
  tenus: string[],
  id: LevierId,
  catalogue: InstrumentDef[] = INSTRUMENTS,
): number {
  return valeurLevier(effetsTenus(tenus, catalogue), id)
}

/** La description d'une carte : celle qu'on a écrite, ou celle que ses
 * effets dictent (les cartes fabriquées se racontent toutes seules). */
export function descriptionInstrument(d: InstrumentDef): string {
  if (d.desc.trim()) return d.desc
  return d.effets.map(phraseEffet).filter(Boolean).join(' ')
}

/** Une carte du tirage : l'instrument, et son prix en condensat (0 : offerte). */
export interface CarteTirage {
  id: string
  prix: number
}

export const PRIX_CARTE = 150 // cL — le tarif unique des cartes payantes

/**
 * Le tirage de fin de salle : jusqu'à `nbCartes` cartes distinctes (3 par
 * défaut — le CARNET DU SEMBLABLE en ajoute une).
 * — un instrument déjà emporté ne revient pas (sauf l'échantillon de
 *   secours, tant que la réserve n'est pas pleine) ;
 * — l'échantillon de secours ne paraît que si une vie manque ;
 * — environ une carte sur trois est payante… mais jamais toutes : au moins
 *   une carte reste offerte (un joueur sans condensat choisit quand même).
 * `rand` est injecté : le tirage est pur et testable.
 */
export function tirageInstruments(
  rand: () => number,
  tenus: string[],
  vies: number,
  viesMax: number,
  nbCartes = 3,
  catalogue: InstrumentDef[] = INSTRUMENTS,
): CarteTirage[] {
  const pool = catalogue.filter((d) => {
    // une carte qui donne une VIE ne paraît que s'il en manque une — peu
    // importe son nom : c'est son levier qui la range là
    if (d.effets.some((e) => e.levier === 'vies')) return vies < viesMax
    return !tenus.includes(d.id)
  }).map((d) => d.id)
  // mélange de Fisher-Yates sur la copie
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const t = pool[i]
    pool[i] = pool[j]
    pool[j] = t
  }
  const cartes = pool.slice(0, Math.max(1, nbCartes)).map((id) => ({
    id,
    prix: rand() < 1 / 3 ? PRIX_CARTE : 0,
  }))
  if (cartes.length > 0 && cartes.every((c) => c.prix > 0)) {
    cartes[Math.floor(rand() * cartes.length)].prix = 0
  }
  return cartes
}

// ---- La BONBONNE et l'XP d'étalonnage ----
// À chaque sas, le surplus se VERSE quelque part : dans la BONBONNE (une
// réserve d'eau embarquée, qu'on peut reverser dans le corps en cours de
// route — même non pleine) ou dans l'XP D'ÉTALONNAGE, qui nourrit les
// instruments. Bonbonne PLEINE : le surplus va forcément à l'XP.
export const BONBONNE_CAP = 8 // litres

// Les paliers d'XP (litres cumulés versés) : chaque palier franchi ouvre un
// tirage d'instruments. La marche grandit — la montée se mérite.
export const PALIERS_XP = [3, 6, 10, 15, 21, 28, 36]

export function paliersAtteints(xp: number): number {
  let n = 0
  for (const p of PALIERS_XP) if (xp >= p) n++
  return n
}

/** Le prochain palier à franchir, ou null si la table est épuisée. */
export function prochainPalier(xp: number): number | null {
  for (const p of PALIERS_XP) if (xp < p) return p
  return null
}
