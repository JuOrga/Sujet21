// LA VUE DU MARCHAND — ce que l'écran montre, calculé sans DOM.
//
// Le concepteur a dessiné un marchand neuf (maquette « Marchand v2 »,
// 04/09) : un rail de RAYONS à gauche, l'ÉTAL au centre (des cartes
// d'article, un filtre en pastilles), la FICHE de l'article à droite avec
// le bouton d'achat, et une légende manette en pied. Ce fichier tient tout
// ce qui se calcule : les rayons et ce qu'ils vendent, l'état de chaque
// article face aux registres, les filtres, les libellés de prix et de
// solde. L'écran (ecranMarchand.ts) ne fait que le peindre.
//
// PAS D'INVENTION : la maquette montrait des cartes payées en condensat,
// une jauge de fidélité, un étal qui se renouvelle, des fioles à vendre —
// rien de cela n'existe au marchand du hub. Il vend TROIS choses, toutes
// en mémoire (marchand.ts, hub.ts) : les orbes, les améliorations durables,
// les provisions de la prochaine descente. C'est ce qu'on montre.

import { transfoTenue } from './cycle'
import { ARTICLES_COMPTOIR } from './hub'
import { AMELIORATIONS, orbesEnVente } from './marchand'

export type RayonMarchandId = 'orbes' | 'ameliorations' | 'provisions'

export interface RayonMarchand {
  id: RayonMarchandId
  nom: string
  icone: string
  teinte: string
  sous: string
  /** ce que dure un article du rayon, une fois acheté */
  tenue: string
}

export const RAYONS_MARCHAND: readonly RayonMarchand[] = [
  {
    id: 'orbes',
    nom: 'ORBES',
    icone: '🔮',
    teinte: '#b48cff',
    sous: 'Une transformation chacun. Se dépensent à l’écran des mémoires.',
    tenue: 'JUSQU’AU TISSAGE',
  },
  {
    id: 'ameliorations',
    nom: 'AMÉLIORATIONS',
    icone: '⚙',
    teinte: '#ffdda6',
    sous: 'Une fois pour toutes : elles valent au départ de chaque descente.',
    tenue: 'POUR TOUJOURS',
  },
  {
    id: 'provisions',
    nom: 'PROVISIONS',
    icone: '🧪',
    teinte: '#63b7e6',
    sous: 'Pour la PROCHAINE descente seulement. Les alcôves les vendent aussi.',
    tenue: 'PROCHAINE DESCENTE',
  },
]

export function rayonMarchand(id: string): RayonMarchand {
  return RAYONS_MARCHAND.find((r) => r.id === id) ?? RAYONS_MARCHAND[0]
}

/** L'état d'un article face aux registres : à vendre (et payable ou non),
 *  ou déjà tenu — chaque rayon a son mot pour « tenu ». */
export type EtatArticle =
  | 'a-vendre'
  | 'trop-cher'
  | 'en-poche' // un orbe acheté ou trouvé, pas encore dépensé
  | 'tissee' // la transformation de l'orbe est gravée
  | 'offerte' // la transformation est tenue d'origine : l'orbe ne sert pas
  | 'acquise' // une amélioration durable, une fois pour toutes
  | 'servie' // une provision déjà prise pour la prochaine descente

export interface ArticleMarchand {
  id: string
  rayon: RayonMarchandId
  icone: string
  nom: string
  detail: string
  prix: number // en mémoire
  etat: EtatArticle
}

/** Ce que l'écran lit des registres — un instantané, pas les registres. */
export interface EtatRegistres {
  memoire: number
  /** les orbes en poche */
  orbes: readonly string[]
  /** les transformations tissées */
  tissees: readonly string[]
  /** les verrous narratifs du cycle */
  verrous: readonly string[]
  ameliorations: readonly string[]
  /** les provisions déjà servies pour la prochaine descente */
  servies: readonly string[]
}

const paye = (prix: number, memoire: number): EtatArticle =>
  memoire >= prix ? 'a-vendre' : 'trop-cher'

export function articlesDuRayon(rayon: RayonMarchandId, s: EtatRegistres): ArticleMarchand[] {
  switch (rayon) {
    case 'orbes':
      return orbesEnVente().map((o) => ({
        id: o.id,
        rayon,
        icone: '🔮',
        nom: `ORBE — ${o.nom.toUpperCase()}`,
        detail: o.desc,
        prix: o.prix,
        etat: s.tissees.includes(o.id)
          ? 'tissee'
          : s.orbes.includes(o.id)
            ? 'en-poche'
            : transfoTenue(o.id, s.tissees, s.verrous)
              ? 'offerte'
              : paye(o.prix, s.memoire),
      }))
    case 'ameliorations':
      return AMELIORATIONS.map((a) => ({
        id: a.id,
        rayon,
        icone: a.icone,
        nom: a.nom,
        detail: a.detail,
        prix: a.prix,
        etat: s.ameliorations.includes(a.id) ? 'acquise' : paye(a.prix, s.memoire),
      }))
    case 'provisions':
      return ARTICLES_COMPTOIR.map((a) => ({
        id: a.id,
        rayon,
        icone: a.icone,
        nom: a.nom,
        detail: a.detail,
        prix: a.prix,
        etat: s.servies.includes(a.id) ? 'servie' : paye(a.prix, s.memoire),
      }))
  }
}

/** Tenu : l'article est déjà à soi, d'une façon ou d'une autre. */
export function tenu(a: ArticleMarchand): boolean {
  return a.etat !== 'a-vendre' && a.etat !== 'trop-cher'
}

export function achetable(a: ArticleMarchand): boolean {
  return a.etat === 'a-vendre'
}

export type FiltreMarchand = 'tous' | 'ok' | 'tenus'

export const FILTRES_MARCHAND: readonly [FiltreMarchand, string][] = [
  ['tous', 'TOUS'],
  ['ok', 'ABORDABLES'],
  ['tenus', 'ACQUIS'],
]

export function filtre(liste: readonly ArticleMarchand[], f: FiltreMarchand): ArticleMarchand[] {
  return liste.filter((a) => (f === 'tous' ? true : f === 'ok' ? achetable(a) : tenu(a)))
}

export function filtreSuivant(f: FiltreMarchand): FiltreMarchand {
  const i = FILTRES_MARCHAND.findIndex(([id]) => id === f)
  return FILTRES_MARCHAND[(i + 1) % FILTRES_MARCHAND.length][0]
}

/** Le mot de l'état d'un article tenu — le badge de sa carte. */
export function badge(a: ArticleMarchand): string {
  switch (a.etat) {
    case 'en-poche':
      return 'EN POCHE'
    case 'tissee':
      return 'TISSÉE'
    case 'offerte':
      return 'OFFERTE D’ORIGINE'
    case 'acquise':
      return 'ACQUISE'
    case 'servie':
      return 'DÉJÀ SERVIE'
    default:
      return ''
  }
}

/** La ligne du bas d'une carte : ce que l'achat dure, ou pourquoi il ne
 *  se fait pas. */
export function etatCourt(a: ArticleMarchand): string {
  if (a.etat === 'trop-cher') return 'TROP CHER'
  if (a.etat === 'a-vendre') return rayonMarchand(a.rayon).tenue
  return badge(a)
}

export function libellePrix(prix: number): string {
  return `${prix} MÉMOIRE`
}

/** Le solde après l'achat, ou ce qui manque. */
export function apresAchat(a: ArticleMarchand, memoire: number): string {
  if (tenu(a)) return 'déjà à vous'
  const reste = memoire - a.prix
  return reste >= 0 ? `reste ${reste} mémoire` : `manque ${-reste} mémoire`
}

/** Le bouton de la fiche : ce qu'il propose, en un mot. */
export function libelleBouton(a: ArticleMarchand): string {
  switch (a.etat) {
    case 'a-vendre':
      return `ACHETER — ${libellePrix(a.prix)}`
    case 'trop-cher':
      return 'MÉMOIRE INSUFFISANTE'
    case 'en-poche':
      return '✓ EN POCHE — À TISSER AUX MÉMOIRES'
    case 'tissee':
      return '✓ TRANSFORMATION TISSÉE'
    case 'offerte':
      return '✓ OFFERTE D’ORIGINE'
    case 'acquise':
      return '✓ ACQUISE POUR TOUJOURS'
    case 'servie':
      return '✓ SERVIE POUR LA PROCHAINE DESCENTE'
  }
}

/** Le compte d'un rayon sur le rail : « 2 acquis · 5 » ou « 5 articles ». */
export function compteRayon(liste: readonly ArticleMarchand[]): string {
  const n = liste.filter(tenu).length
  return n > 0 ? `${n} acquis · ${liste.length}` : `${liste.length} articles`
}
