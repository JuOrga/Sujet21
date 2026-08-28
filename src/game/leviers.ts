// LES LEVIERS : le vocabulaire des récompenses.
//
// Une récompense n'est plus du code : c'est une LISTE D'EFFETS, et chaque
// effet tire sur un levier nommé du jeu. Le catalogue devient donc des
// DONNÉES — et c'est ce qui permet à l'écran des Récompenses d'en fabriquer
// de neuves sans écrire une ligne : choisir un levier, poser une valeur,
// nommer la carte. Le jeu, lui, ne connaît que les leviers : il en lit la
// valeur une fois par tableau, et se moque de savoir quelle carte l'a posée.
//
// Ajouter un levier, c'est trois choses : l'entrée ci-dessous (le contrat
// et sa phrase), la lecture au bon endroit du jeu, et rien d'autre. Toutes
// les cartes présentes et à venir peuvent alors s'en servir.

export type LevierId =
  // le corps et sa matière
  | 'vies'
  | 'seuilDispersion'
  | 'reabsorption'
  | 'priseEponge'
  // les états
  | 'dashs'
  | 'peageVapeur'
  | 'rebondGlace'
  | 'visee'
  | 'froid'
  | 'rosee'
  // la collecte et la bourse
  | 'sasPortee'
  | 'primeGlace'
  | 'condensat'
  | 'bonbonne'
  // le protocole
  | 'cartes'

/** Un effet : un levier, une valeur. C'est toute la grammaire. */
export interface Effet {
  levier: LevierId
  valeur: number
}

export interface LevierDef {
  id: LevierId
  nom: string // le libellé dans l'écran des récompenses
  famille: 'corps' | 'etats' | 'collecte' | 'protocole'
  // MULT : les valeurs se multiplient entre cartes (neutre = 1).
  // ADD : elles s'additionnent (neutre = 0).
  mode: 'mult' | 'add'
  min: number
  max: number
  pas: number
  /** Sens du gain : +1 si monter la valeur AVANTAGE le joueur, -1 sinon. */
  bon: 1 | -1
  /** La carte se raconte toute seule : la phrase est écrite depuis la valeur. */
  phrase: (v: number) => string
}

// Les cartes se lisent en pourcentage, jamais en « ×1,5 » : un joueur ne
// lit pas un facteur. `plus` pour ce qui grandit, `moins` pour ce qui
// diminue — chaque phrase choisit le mot qui tombe juste dans SA syntaxe.
const plus = (v: number): number => Math.round((v - 1) * 100)
const moins = (v: number): number => Math.round((1 - v) * 100)

export const LEVIERS: LevierDef[] = [
  // ——— le corps et sa matière ————————————————————————————————
  {
    id: 'vies',
    nom: 'Échantillons de secours',
    famille: 'corps',
    mode: 'add',
    min: 1,
    max: 2,
    pas: 1,
    bon: 1,
    phrase: (v) =>
      `${v} échantillon${v > 1 ? 's' : ''} de secours de plus : ${v > 1 ? 'des dispersions pardonnées' : 'une dispersion pardonnée'}.`,
  },
  {
    id: 'seuilDispersion',
    nom: 'Seuil de dispersion',
    famille: 'corps',
    mode: 'mult',
    min: 0.6,
    max: 1,
    pas: 0.05,
    bon: -1,
    phrase: (v) =>
      `Le corps tient plus bas : le seuil de dispersion baisse de ${Math.round((1 - v) * 100)} %.`,
  },
  {
    id: 'reabsorption',
    nom: 'Délai de réabsorption',
    famille: 'corps',
    mode: 'mult',
    min: 0.3,
    max: 1,
    pas: 0.05,
    bon: -1,
    phrase: (v) =>
      `Les gouttes éjectées redeviennent réabsorbables ${Math.round((1 / v) * 10) / 10}× plus tôt.`,
  },
  {
    id: 'priseEponge',
    nom: 'Prise de l’éponge',
    famille: 'corps',
    mode: 'mult',
    min: 0.4,
    max: 1,
    pas: 0.05,
    bon: -1,
    phrase: (v) => `L’éponge a moins de prise : elle boit ${moins(v)} % moins vite.`,
  },

  // ——— les états ————————————————————————————————————————————
  {
    id: 'dashs',
    nom: 'Réserve de dashs',
    famille: 'etats',
    mode: 'add',
    min: 1,
    max: 3,
    pas: 1,
    bon: 1,
    phrase: (v) =>
      `${v} dash${v > 1 ? 's' : ''} de plus dans la réserve de chaque tableau.`,
  },
  {
    id: 'peageVapeur',
    nom: 'Péage de vaporisation',
    famille: 'etats',
    mode: 'mult',
    min: 0.3,
    max: 1,
    pas: 0.05,
    bon: -1,
    phrase: (v) => `Se vaporiser coûte ${moins(v)} % de gouttes en moins.`,
  },
  {
    id: 'rebondGlace',
    nom: 'Rebond du palet',
    famille: 'etats',
    mode: 'mult',
    min: 1,
    max: 1.6,
    pas: 0.05,
    bon: 1,
    phrase: (v) => `Le palet de glace rebondit ${plus(v)} % plus vif.`,
  },
  {
    id: 'visee',
    nom: 'Dilatation de la visée',
    famille: 'etats',
    mode: 'mult',
    min: 0.3,
    max: 1,
    pas: 0.05,
    bon: -1,
    phrase: (v) =>
      `La visée du dash ralentit le temps ${Math.round((1 / v) * 10) / 10}× plus : on choisit sa ligne.`,
  },
  {
    id: 'froid',
    nom: 'Refroidissement de la coque',
    famille: 'etats',
    mode: 'mult',
    min: 1,
    max: 2,
    pas: 0.05,
    bon: 1,
    phrase: (v) => `Le froid du vaisseau mord ${moins(1 / v)} % moins vite.`,
  },
  {
    id: 'rosee',
    nom: 'Rendement de la rosée',
    famille: 'etats',
    mode: 'add',
    min: 0.1,
    max: 0.6,
    pas: 0.05,
    bon: 1,
    phrase: (v) =>
      `La rosée recondensée rend ${Math.round(v * 100)} points de rendement en plus.`,
  },

  // ——— la collecte et la bourse ——————————————————————————————
  {
    id: 'sasPortee',
    nom: 'Portée du sas',
    famille: 'collecte',
    mode: 'mult',
    min: 1,
    max: 2.5,
    pas: 0.1,
    bon: 1,
    phrase: (v) =>
      `Le sas aspire ${plus(v)} % plus loin : les traînardes rentrent seules.`,
  },
  {
    id: 'primeGlace',
    nom: 'Prime de glace',
    famille: 'collecte',
    mode: 'mult',
    min: 1,
    max: 3,
    pas: 0.1,
    bon: 1,
    phrase: (v) => `La prime de glace vaut ${plus(v)} % de plus au sas.`,
  },
  {
    id: 'condensat',
    nom: 'Rendement en condensat',
    famille: 'collecte',
    mode: 'mult',
    min: 1,
    max: 2,
    pas: 0.05,
    bon: 1,
    phrase: (v) =>
      `${plus(v)} % de condensat en plus sur tout ce qui passe le sas.`,
  },
  {
    id: 'bonbonne',
    nom: 'Contenance de la bonbonne',
    famille: 'collecte',
    mode: 'add',
    min: 1,
    max: 6,
    pas: 1,
    bon: 1,
    phrase: (v) => `La bonbonne emporte ${v} litre${v > 1 ? 's' : ''} de plus.`,
  },

  // ——— le protocole ————————————————————————————————————————
  {
    id: 'cartes',
    nom: 'Cartes au tirage',
    famille: 'protocole',
    mode: 'add',
    min: 1,
    max: 2,
    pas: 1,
    bon: 1,
    phrase: (v) =>
      `${v} carte${v > 1 ? 's' : ''} de plus à chaque tirage de fin de salle.`,
  },
]

export const FAMILLE_NOMS: Record<LevierDef['famille'], string> = {
  corps: 'Le corps et sa matière',
  etats: 'Les états',
  collecte: 'La collecte et la bourse',
  protocole: 'Le protocole',
}

export function levierDef(id: string): LevierDef | null {
  return LEVIERS.find((l) => l.id === id) ?? null
}

/** La valeur NEUTRE d'un levier : celle qu'il vaut sans aucune carte. */
export function neutre(l: LevierDef): number {
  return l.mode === 'mult' ? 1 : 0
}

/**
 * La valeur d'un levier, tous effets confondus : les facteurs se
 * multiplient, les ajouts s'additionnent. C'est LA lecture du jeu — il ne
 * demande jamais « ai-je telle carte », il demande « que vaut ce levier ».
 */
export function valeurLevier(effets: Effet[], id: LevierId): number {
  const def = levierDef(id)
  if (!def) return 0
  let v = neutre(def)
  for (const e of effets) {
    if (e.levier !== id) continue
    if (def.mode === 'mult') v *= e.valeur
    else v += e.valeur
  }
  return v
}

/** La phrase d'un effet, écrite depuis son levier — la carte se raconte. */
export function phraseEffet(e: Effet): string {
  const def = levierDef(e.levier)
  return def ? def.phrase(e.valeur) : ''
}
