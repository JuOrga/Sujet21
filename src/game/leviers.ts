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
  | 'bascule'
  | 'perteVapeur'
  | 'perteGrille'
  | 'rebondGlace'
  | 'glisseGlace'
  | 'visee'
  | 'froid'
  | 'rosee'
  // la collecte et la bourse
  | 'sasPortee'
  | 'priseSasGlace'
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
    max: 1.4,
    pas: 0.05,
    bon: -1,
    phrase: (v) =>
      v <= 1
        ? `Le corps tient plus bas : le seuil de dispersion baisse de ${moins(v)} %.`
        : `Le corps lâche plus tôt : le seuil de dispersion monte de ${plus(v)} %.`,
  },
  {
    id: 'reabsorption',
    nom: 'Délai de réabsorption',
    famille: 'corps',
    mode: 'mult',
    min: 0.3,
    max: 2,
    pas: 0.05,
    bon: -1,
    phrase: (v) =>
      v <= 1
        ? `Les gouttes éjectées redeviennent réabsorbables ${Math.round((1 / v) * 10) / 10}× plus tôt.`
        : `Les gouttes éjectées traînent ${Math.round(v * 10) / 10}× plus longtemps avant de revenir.`,
  },
  {
    id: 'priseEponge',
    nom: 'Prise de l’éponge',
    famille: 'corps',
    mode: 'mult',
    min: 0.4,
    max: 1.8,
    pas: 0.05,
    bon: -1,
    phrase: (v) =>
      v <= 1
        ? `L’éponge a moins de prise : elle boit ${moins(v)} % moins vite.`
        : `L’éponge mord : elle boit ${plus(v)} % plus vite.`,
  },

  // ——— les états ————————————————————————————————————————————
  // (rien ici ne fait perdre du volume à la GLACE : un bloc ne se fait
  //  jamais grignoter au contact — éponge, feutre, maille le laissent
  //  passer ou l'arrêtent, aucun ne le mange.)
  {
    id: 'dashs',
    nom: 'Réserve de dashs',
    famille: 'etats',
    mode: 'add',
    min: -2,
    max: 3,
    pas: 1,
    bon: 1,
    phrase: (v) =>
      v > 0
        ? `${v} dash${v > 1 ? 's' : ''} de plus dans la réserve de chaque tableau.`
        : `${-v} dash${v < -1 ? 's' : ''} de moins dans la réserve de chaque tableau.`,
  },
  {
    id: 'peageVapeur',
    nom: 'Péage de vaporisation',
    famille: 'etats',
    mode: 'mult',
    min: 0.3,
    max: 1.8,
    pas: 0.05,
    bon: -1,
    phrase: (v) =>
      v <= 1
        ? `Se vaporiser coûte ${moins(v)} % de gouttes en moins.`
        : `Se vaporiser coûte ${plus(v)} % de gouttes en plus.`,
  },
  {
    id: 'bascule',
    nom: 'Vitesse de bascule d’état',
    famille: 'etats',
    mode: 'mult',
    min: 0.4,
    max: 1.8,
    pas: 0.05,
    bon: -1,
    phrase: (v) =>
      v <= 1
        ? `Se figer ou se vaporiser prend ${moins(v)} % de temps en moins.`
        : `Se figer ou se vaporiser prend ${plus(v)} % de temps en plus.`,
  },
  {
    id: 'perteVapeur',
    nom: 'Évaporation du nuage',
    famille: 'etats',
    mode: 'mult',
    min: 0.3,
    max: 2,
    pas: 0.05,
    bon: -1,
    phrase: (v) =>
      v <= 1
        ? `Le nuage s’évapore ${moins(v)} % moins vite au repos.`
        : `Le nuage s’évapore ${plus(v)} % plus vite au repos.`,
  },
  {
    id: 'perteGrille',
    nom: 'Perte dans les mailles',
    famille: 'etats',
    mode: 'mult',
    min: 0.2,
    max: 2,
    pas: 0.05,
    bon: -1,
    phrase: (v) =>
      v <= 1
        ? `Traverser une maille coûte ${moins(v)} % de vapeur en moins.`
        : `Traverser une maille coûte ${plus(v)} % de vapeur en plus.`,
  },
  {
    id: 'rebondGlace',
    nom: 'Rebond du palet',
    famille: 'etats',
    mode: 'mult',
    min: 0.6,
    max: 1.6,
    pas: 0.05,
    bon: 1,
    phrase: (v) =>
      v >= 1
        ? `Le palet de glace rebondit ${plus(v)} % plus vif.`
        : `Le palet de glace rebondit ${moins(v)} % plus mou.`,
  },
  {
    id: 'glisseGlace',
    nom: 'Glisse du palet',
    famille: 'etats',
    mode: 'mult',
    min: 0.2,
    max: 2,
    pas: 0.05,
    bon: -1,
    phrase: (v) =>
      v <= 1
        ? `L’hydrophile retient ${moins(v)} % moins le palet : la glace garde sa ligne.`
        : `L’hydrophile retient ${plus(v)} % plus le palet.`,
  },
  {
    id: 'visee',
    nom: 'Dilatation de la visée',
    famille: 'etats',
    mode: 'mult',
    min: 0.3,
    max: 1.6,
    pas: 0.05,
    bon: -1,
    phrase: (v) =>
      v <= 1
        ? `La visée du dash ralentit le temps ${Math.round((1 / v) * 10) / 10}× plus : on choisit sa ligne.`
        : `La visée du dash ralentit ${plus(v)} % moins le temps : il faut décider vite.`,
  },
  {
    id: 'froid',
    nom: 'Refroidissement de la coque',
    famille: 'etats',
    mode: 'mult',
    min: 0.6,
    max: 2,
    pas: 0.05,
    bon: 1,
    phrase: (v) =>
      v >= 1
        ? `Le froid du vaisseau mord ${moins(1 / v)} % moins vite.`
        : `Le froid du vaisseau mord ${plus(1 / v)} % plus vite.`,
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
    min: 0.5,
    max: 2.5,
    pas: 0.1,
    bon: 1,
    phrase: (v) =>
      v >= 1
        ? `Le sas aspire ${plus(v)} % plus loin : les traînardes rentrent seules.`
        : `Le sas aspire ${moins(v)} % moins loin : il faut aller lui porter l’eau.`,
  },
  {
    id: 'priseSasGlace',
    nom: 'Prise du sas sur la glace',
    famille: 'collecte',
    mode: 'mult',
    min: 0.4,
    max: 3,
    pas: 0.1,
    bon: 1,
    phrase: (v) =>
      v >= 1
        ? `Le sas happe la glace ${plus(v)} % plus fort : un palet ne file plus devant la bouche.`
        : `Le sas n’a que ${moins(v)} % de prise en moins sur la glace : le palet passe tout droit.`,
  },
  {
    id: 'primeGlace',
    nom: 'Prime de glace',
    famille: 'collecte',
    mode: 'mult',
    min: 0.4,
    max: 3,
    pas: 0.1,
    bon: 1,
    phrase: (v) =>
      v >= 1
        ? `La prime de glace vaut ${plus(v)} % de plus au sas.`
        : `La prime de glace vaut ${moins(v)} % de moins au sas.`,
  },
  {
    id: 'condensat',
    nom: 'Rendement en condensat',
    famille: 'collecte',
    mode: 'mult',
    min: 0.6,
    max: 2,
    pas: 0.05,
    bon: 1,
    phrase: (v) =>
      v >= 1
        ? `${plus(v)} % de condensat en plus sur tout ce qui passe le sas.`
        : `${moins(v)} % de condensat en moins sur tout ce qui passe le sas.`,
  },
  {
    id: 'bonbonne',
    nom: 'Contenance de la bonbonne',
    famille: 'collecte',
    mode: 'add',
    min: -3,
    max: 6,
    pas: 1,
    bon: 1,
    phrase: (v) =>
      v > 0
        ? `La bonbonne emporte ${v} litre${v > 1 ? 's' : ''} de plus.`
        : `La bonbonne emporte ${-v} litre${v < -1 ? 's' : ''} de moins.`,
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

/**
 * LE SENS D'UN EFFET : +1 s'il avantage le joueur, −1 si c'est un prix.
 *
 * C'est la lecture qui manquait le plus à l'écran : dix leviers sur vingt
 * et un ont `bon: -1`, donc le signe brut ne dit RIEN. « visée ×0,5 » est
 * un gros cadeau, « condensat ×0,8 » une facture — l'œil ne peut pas les
 * distinguer sans passer par ici.
 */
export function sensEffet(e: Effet): 1 | -1 {
  const def = levierDef(e.levier)
  if (!def) return 1
  const ecart = e.valeur - neutre(def)
  // un effet à la valeur neutre ne se joue pas (la validation l'interdit) :
  // on le compte comme un gain, faute de mieux, plutôt que de rendre 0
  return ecart === 0 ? 1 : ((Math.sign(ecart) * def.bon) as 1 | -1)
}

/**
 * L'INTENSITÉ d'un effet, de 0 (ne fait rien) à 1 (le bout de la plage).
 * Rapportée à SA plage : « +1 dash » sur une plage de 3 pèse autant que
 * « portée ×2 » sur une plage de 1,5 — c'est ce qui permet de comparer des
 * leviers qui n'ont ni la même unité ni la même échelle.
 */
export function forceEffet(e: Effet): number {
  const def = levierDef(e.levier)
  if (!def) return 0
  const n = neutre(def)
  const ampli = Math.max(Math.abs(def.min - n), Math.abs(def.max - n))
  if (ampli <= 0) return 0
  return Math.min(1, Math.abs(e.valeur - n) / ampli)
}

/**
 * La valeur qu'on PROPOSE quand un levier arrive sur une carte : à
 * mi-chemin entre le neutre et le bon bout de sa plage, calée sur le pas.
 * Jamais la valeur neutre (la carte ne ferait rien — la validation la
 * refuse), jamais une valeur hors du pas (« 1,5 échantillon de secours »).
 */
export function valeurProposee(l: LevierDef): number {
  const n = neutre(l)
  const bout = l.bon > 0 ? l.max : l.min
  const pas = l.pas || 1
  let v = Math.round((n + (bout - n) * 0.5) / pas) * pas
  if (Math.abs(v - n) < pas / 2) v = n + Math.sign(bout - n) * pas
  v = Math.min(l.max, Math.max(l.min, v))
  // le pas peut être décimal : on coupe le bruit de virgule flottante
  return Math.round(v * 1000) / 1000
}
