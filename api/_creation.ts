// LA LISTE BLANCHE D'UNE CRÉATION : ce qu'une salle de joueur a le droit de
// contenir. UNE seule liste, lue des deux côtés : l'atelier du joueur
// (src/editor/profilJoueur.ts) n'offre que ces éléments, et le serveur
// (lot 3, api/creations) retire tout le reste avant d'enregistrer.
//
// Pourquoi les deux côtés : l'atelier ne protège rien à lui seul. Un joueur
// qui parle directement à l'API peut envoyer n'importe quel champ — un
// plot de boutique, une cinématique, un réglage de physique, un code de
// salle officielle. Le serveur ne fait donc confiance qu'à cette liste.
//
// Une LISTE BLANCHE, pas une liste noire : ce qui n'est pas nommé ici est
// retiré. Un champ ajouté demain à LevelDef pour le concepteur n'entre pas
// dans les créations par oubli — il faut venir l'écrire ici.
//
// Le serveur ne rejoue pas la lecture complète (levelIO.ts, 1 600 lignes,
// côté jeu) : il trie les CHAMPS, vérifie les TYPES et les PLAFONDS. Les
// valeurs se bornent à la relecture : tout lecteur d'une création passe
// par parseLevel, « impossible à charger cassé ». Le test de ce module
// vérifie qu'une création nettoyée se relit sans rejet.
//
// Sans dépendance (ni Node, ni le jeu) : le serveur et le navigateur
// l'importent tel quel.

/** Le numéro de format des créations — il voyage avec chacune. */
export const CREATION_FORMAT = 1

/** Le poids maximal d'une création sérialisée. Mesuré le 24/11/2026 : les
 *  24 salles livrées pèsent de 1,6 à 3,8 Ko, le hub (la plus grosse salle
 *  du jeu, 17 structures) 15,6 Ko. 24 Ko laissent la place d'une salle de
 *  la taille du hub, pas d'un document qui ralentirait la liste. */
export const CREATION_OCTETS_MAX = 24 * 1024

/** Les dimensions maximales de la cuve — celles du hub (9 000 × 2 400),
 *  arrondies : une salle de joueur peut être aussi vaste que le plus grand
 *  lieu du jeu, pas davantage. */
export const BORNES_MAX = { largeur: 9000, hauteur: 3000 } as const

/** Les longueurs maximales des textes libres (le joueur écrit dans sa
 *  salle ; tout cela se modère). L'étiquette garde la règle de l'éditeur
 *  (40 signes) ; les salles livrées vont jusqu'à 37. */
export const TEXTE_MAX = { nom: 40, description: 280, etiquette: 40 } as const

/** Le budget de blocs du rendu : parois ET structures partagent
 *  MAX_BOXES (src/render/renderer.ts). */
export const BLOCS_MAX = 160

/** Les plafonds par sorte d'élément. Mesuré le 24/11/2026 : les 24 salles
 *  livrées en ont au plus 3 éponges, 11 étiquettes, 2 décors, 3 lasers,
 *  3 pastilles, 3 portes, 1 rail de 5 points ; les trois hubs vont jusqu'à
 *  31 étiquettes et 14 décors. Les plafonds laissent de la marge pour
 *  créer — une salle aussi vaste que le hub doit pouvoir être aussi
 *  annotée —, sans laisser un document sans fin. Les lampes suivent le
 *  rendu (MAX_LUMIERES = 4). */
export const PLAFONDS = {
  sponges: 12,
  labels: 40,
  decals: 40,
  lasers: 8,
  cibles: 16,
  portes: 16,
  chasses: 16,
  puits: 6,
  mires: 12,
  coupelles: 8,
  rails: 12,
  lumieres: 4,
} as const

/** Les points d'un rail : au moins 2, au plus 32. */
export const RAIL_POINTS_MAX = 32

// ---- LES CHAMPS PERMIS -----------------------------------------------------

/** Un champ : 'n' nombre fini, 'b' booléen, 'p' liste de points, ou la liste
 *  des seules valeurs permises (une chaîne hors liste est retirée). */
type Sorte = 'n' | 'b' | 'p' | readonly (string | number)[]

interface Schema {
  requis: Record<string, Sorte>
  options: Record<string, Sorte>
}

const RECT = { minX: 'n', minY: 'n', maxX: 'n', maxY: 'n' } as const
const POINT = { x: 'n', y: 'n' } as const
const REGLE = ['et', 'ouex'] as const

/** Les matériaux qu'un joueur peut poser : tous, sauf le sas (MAT_EXIT = 3,
 *  rendu seulement — la sortie se pose par `exit`). */
export const MATERIAUX_PERMIS = [0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const

/** Les comportements de pastille offerts au joueur (maquettes validées le
 *  24/11) : NOR, MÉMOIRE et EFFACE restent au concepteur pour l'instant. */
export const MODES_PASTILLE = ['tor', 'maintien', 'bascule'] as const

/** Les tons d'étiquette (WorldLabel.tone). */
export const TONS = ['mur', 'phile', 'phobe', 'eponge', 'froid', 'grille', 'sas', 'chaud'] as const

/** Les cartes qu'une création peut imposer : l'Éclateur seul, parce que
 *  sans le tir de glace les mires ne servent à rien (levelIO le signale).
 *  Toute autre carte change l'économie de la run : réservée. */
export const CARTES_PERMISES = ['eclateur'] as const

/** Les décors que le moteur fabrique lui-même — jamais posés à la main. */
const DECORS_RESERVES = ['meta-', 'porte-trappe', 'sas-raccord']

export const SCHEMAS: Record<string, Schema> = {
  boxes: {
    requis: { ...RECT, material: MATERIAUX_PERMIS },
    options: { angle: 'n', aura: 'n', skin: 'n', forme: 'n', sens: 'n', p0: 'n', p1: 'n', p2: 'n' },
  },
  structures: {
    requis: { type: [0, 1], ...RECT },
    options: {
      ep: 'n', chanfrein: 'n', angle: 'n', axe: [0, 1], bouchon: MATERIAUX_PERMIS,
      material: MATERIAUX_PERMIS, skin: 'n', ouvertures: 'n', porte: 'n', raccord: 'b',
    },
  },
  sponges: {
    requis: { minX: 'n', minY: 'n', cols: 'n', rows: 'n', cellSize: 'n', capacityPerCell: 'n' },
    options: {},
  },
  labels: { requis: { ...POINT, tone: TONS }, options: {} }, // le texte : à part (nettoyé)
  decals: { requis: { ...POINT, w: 'n', h: 'n' }, options: { flip: 'b', fade: 'n', panne: 'b' } }, // kind : à part
  lasers: { requis: { ...POINT, angle: 'n' }, options: {} },
  cibles: { requis: { ...POINT, r: 'n' }, options: { mode: MODES_PASTILLE, canal: 'n' } },
  portes: {
    requis: { ...RECT, canal: 'n' },
    options: {
      regle: REGLE, repos: ['ouverte'], materialisation: ['rideau', 'eventail'],
      sens: 'n', pivot: 'n', horaire: 'b', allure: 'n',
    },
  },
  chasses: { requis: { ...RECT, angle: 'n' }, options: { allure: 'n', canal: 'n', regle: REGLE, duree: 'n' } },
  puits: { requis: { ...POINT }, options: { force: 'n', rayon: 'n', portee: 'n' } },
  mires: { requis: { ...POINT, r: 'n', points: 'n' }, options: {} },
  coupelles: { requis: { ...POINT, r: 'n', seuil: 'n', canal: 'n' }, options: { aspiration: 'n' } },
  rails: { requis: { points: 'p' }, options: { conduit: 'b' } },
  lumieres: {
    requis: { ...POINT },
    options: { h: 'n', portee: 'n', intensite: 'n', taille: 'n', forme: ['bandeau'], longueur: 'n', angle: 'n' }, // couleur : à part
  },
}

/** Les collections d'une création, dans l'ordre de LevelDef. */
export const COLLECTIONS = Object.keys(SCHEMAS)

/** Les champs de premier niveau qu'une création garde. Tout le reste — le
 *  méta de la run (plots, banc, pupitres, marchand, ancres, éclats, fiole,
 *  condensats, cachettes), la physique du tableau (`reglages`, `par`,
 *  `dashBudget`, `etats`, `exige`), la mise en scène (`cineAvant`,
 *  `cineApres`, `sequence`, `ambiance`, `figure`, `plafond`), la place dans
 *  la station (`biome`, `raccourciVers`, `minijeu`, `zones`) et le `code`
 *  (le serveur l'attribue) — est retiré. */
export const CHAMPS_GARDES = [
  'name', 'journal', 'bounds', 'spawn', 'exit', 'coque', 'raccords', 'ambiante', 'brume', 'cartes',
  ...COLLECTIONS,
]

// ---- LE NETTOYAGE ------------------------------------------------------------

export type VerdictCreation =
  | { ok: true; salle: Record<string, unknown>; retouches: string[] }
  | { ok: false; raison: string }

type Objet = Record<string, unknown>

function estObjet(v: unknown): v is Objet {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function nombre(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Un texte de joueur : sans caractère de contrôle, sans espaces en trop,
 *  borné. Rend la chaîne propre (peut-être vide). */
export function texteJoueur(v: unknown, max: number): string {
  if (typeof v !== 'string') return ''
  return v
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function conforme(valeur: unknown, sorte: Sorte): boolean {
  if (sorte === 'n') return nombre(valeur)
  if (sorte === 'b') return typeof valeur === 'boolean'
  if (sorte === 'p') {
    return (
      Array.isArray(valeur) &&
      valeur.length >= 2 &&
      valeur.length <= RAIL_POINTS_MAX &&
      valeur.every((q) => estObjet(q) && nombre(q.x) && nombre(q.y))
    )
  }
  return (sorte as readonly unknown[]).includes(valeur)
}

function copie(valeur: unknown, sorte: Sorte): unknown {
  // les points d'un rail : on ne garde que x et y
  if (sorte === 'p') return (valeur as Objet[]).map((q) => ({ x: q.x, y: q.y }))
  return valeur
}

/** Nettoie un élément selon son schéma. Rend l'élément propre, ou `null`
 *  si un champ REQUIS manque (l'élément est alors écarté). */
function nettoieElement(
  brut: unknown,
  schema: Schema,
  nom: string,
  retouches: Set<string>,
): Objet | null {
  if (!estObjet(brut)) return null
  const propre: Objet = {}
  for (const [champ, sorte] of Object.entries(schema.requis)) {
    if (!conforme(brut[champ], sorte)) return null
    propre[champ] = copie(brut[champ], sorte)
  }
  for (const [champ, sorte] of Object.entries(schema.options)) {
    if (brut[champ] === undefined) continue
    if (conforme(brut[champ], sorte)) propre[champ] = copie(brut[champ], sorte)
    else retouches.add(`${nom} : « ${champ} » hors des valeurs permises, retiré`)
  }
  for (const champ of Object.keys(brut)) {
    if (!(champ in schema.requis) && !(champ in schema.options) && !CHAMPS_A_PART[nom]?.includes(champ)) {
      retouches.add(`${nom} : « ${champ} » réservé au concepteur, retiré`)
    }
  }
  return propre
}

/** Les champs traités à part, hors schéma (textes, sortes de décor…). */
const CHAMPS_A_PART: Record<string, string[]> = {
  labels: ['text'],
  decals: ['kind'],
  lumieres: ['couleur'],
}

function rect(v: unknown): Objet | null {
  if (!estObjet(v)) return null
  if (![v.minX, v.minY, v.maxX, v.maxY].every(nombre)) return null
  if ((v.maxX as number) <= (v.minX as number) || (v.maxY as number) <= (v.minY as number)) return null
  return { minX: v.minX, minY: v.minY, maxX: v.maxX, maxY: v.maxY }
}

/** LE NETTOYAGE d'une création envoyée par un joueur : ce qui est permis
 *  est gardé, ce qui est réservé est retiré (et dit), ce qui ne peut pas
 *  être une salle est refusé. Les plafonds REFUSENT plutôt que de couper :
 *  amputer une salle de ses derniers éléments la changerait en silence. */
export function nettoieCreation(brut: unknown): VerdictCreation {
  if (!estObjet(brut)) return { ok: false, raison: 'une création est un objet JSON' }
  const retouches = new Set<string>()

  for (const champ of Object.keys(brut)) {
    if (!CHAMPS_GARDES.includes(champ)) retouches.add(`« ${champ} » réservé au concepteur, retiré`)
  }

  const nom = texteJoueur(brut.name, TEXTE_MAX.nom)
  if (!nom) return { ok: false, raison: 'une salle a besoin d’un nom' }
  if (typeof brut.name === 'string' && brut.name.trim().length > TEXTE_MAX.nom) {
    retouches.add(`le nom est coupé à ${TEXTE_MAX.nom} signes`)
  }

  const bounds = rect(brut.bounds)
  if (!bounds) return { ok: false, raison: 'la cuve (bounds) est absente ou vide' }
  const largeur = (bounds.maxX as number) - (bounds.minX as number)
  const hauteur = (bounds.maxY as number) - (bounds.minY as number)
  if (largeur > BORNES_MAX.largeur || hauteur > BORNES_MAX.hauteur) {
    return {
      ok: false,
      raison: `la cuve dépasse ${BORNES_MAX.largeur} × ${BORNES_MAX.hauteur} (${Math.round(largeur)} × ${Math.round(hauteur)})`,
    }
  }

  const sp = brut.spawn
  if (!estObjet(sp) || !nombre(sp.x) || !nombre(sp.y) || !nombre(sp.n)) {
    return { ok: false, raison: 'le départ (spawn) est absent ou incomplet' }
  }
  const spawn: Objet = { x: sp.x, y: sp.y, n: sp.n }
  if (sp.impulsion !== undefined) {
    const im = sp.impulsion
    if (estObjet(im) && nombre(im.angle) && nombre(im.vitesse)) {
      spawn.impulsion = { angle: im.angle, vitesse: im.vitesse }
    } else retouches.add('départ : élan illisible, retiré')
  }

  const exit = rect(brut.exit)
  if (!exit) return { ok: false, raison: 'la sortie (exit) est absente ou vide' }

  const salle: Objet = { name: nom, bounds, spawn, exit }

  const description = texteJoueur(brut.journal, TEXTE_MAX.description)
  if (description) salle.journal = description
  if (typeof brut.journal === 'string' && brut.journal.trim().length > TEXTE_MAX.description) {
    retouches.add(`la description est coupée à ${TEXTE_MAX.description} signes`)
  }
  if (brut.coque === 'cuve' || brut.coque === 'structures') salle.coque = brut.coque
  if (brut.raccords === 'aucun') salle.raccords = 'aucun'
  for (const champ of ['ambiante', 'brume'] as const) {
    if (nombre(brut[champ])) salle[champ] = brut[champ]
  }
  if (Array.isArray(brut.cartes)) {
    const cartes = brut.cartes.filter((c): c is string => (CARTES_PERMISES as readonly unknown[]).includes(c))
    if (cartes.length < brut.cartes.length) retouches.add('cartes imposées : seule l’Éclateur est permise, les autres sont retirées')
    if (cartes.length) salle.cartes = [...new Set(cartes)]
  }

  for (const collection of COLLECTIONS) {
    const liste = brut[collection]
    if (liste === undefined) continue
    if (!Array.isArray(liste)) {
      retouches.add(`« ${collection} » n’est pas une liste, retiré`)
      continue
    }
    const plafond = (PLAFONDS as Record<string, number>)[collection]
    if (plafond !== undefined && liste.length > plafond) {
      return { ok: false, raison: `trop d’éléments « ${collection} » : ${liste.length} pour ${plafond} au plus` }
    }
    const propres: Objet[] = []
    let ecartes = 0
    for (const el of liste) {
      const p = nettoieElement(el, SCHEMAS[collection], collection, retouches)
      if (!p || !finitElement(collection, el as Objet, p, retouches)) {
        ecartes++
        continue
      }
      propres.push(p)
    }
    if (ecartes) retouches.add(`${collection} : ${ecartes} élément(s) incomplet(s) ou réservé(s), écarté(s)`)
    salle[collection] = propres
  }
  // la relecture (parseLevel) attend ces trois listes, même vides
  for (const c of ['boxes', 'sponges', 'labels']) salle[c] ??= []

  const blocs = (salle.boxes as unknown[]).length + ((salle.structures as unknown[] | undefined)?.length ?? 0)
  if (blocs > BLOCS_MAX) {
    return { ok: false, raison: `trop de parois et de structures : ${blocs} pour ${BLOCS_MAX} au plus` }
  }

  const octets = new TextEncoder().encode(JSON.stringify(salle)).length
  if (octets > CREATION_OCTETS_MAX) {
    return { ok: false, raison: `création trop lourde : ${Math.ceil(octets / 1024)} Ko pour ${CREATION_OCTETS_MAX / 1024} au plus` }
  }
  return { ok: true, salle, retouches: [...retouches] }
}

/** Les règles propres à chaque sorte d'élément, au-delà de son schéma.
 *  Rend `false` si l'élément doit être écarté. */
function finitElement(collection: string, brut: Objet, p: Objet, retouches: Set<string>): boolean {
  switch (collection) {
    case 'labels': {
      const texte = texteJoueur(brut.text, TEXTE_MAX.etiquette)
      if (!texte) return false
      p.text = texte
      return true
    }
    case 'decals': {
      const kind = brut.kind
      if (typeof kind !== 'string' || !/^[a-z0-9-]{1,40}$/.test(kind)) return false
      if (DECORS_RESERVES.some((pre) => kind.startsWith(pre))) return false
      p.kind = kind
      return true
    }
    case 'lumieres': {
      if (brut.couleur !== undefined) {
        if (typeof brut.couleur === 'string' && /^#[0-9a-fA-F]{6}$/.test(brut.couleur)) p.couleur = brut.couleur
        else retouches.add('lumieres : couleur illisible, retirée')
      }
      return true
    }
    case 'portes':
    case 'coupelles':
      // un canal négatif ou nul est celui des séquences du concepteur :
      // dans une création, rien ne le déclencherait jamais
      return Number.isInteger(p.canal) && (p.canal as number) >= 1
    case 'cibles':
      // absent, le canal d'une pastille est son rang + 1 (canalDeCible) :
      // un canal illisible retombe sur cette règle
      if (p.canal !== undefined && !(Number.isInteger(p.canal) && (p.canal as number) >= 1)) {
        delete p.canal
        retouches.add('cibles : canal illisible, la pastille reprend son numéro de rang')
      }
      return true
    case 'chasses':
      // 0 : permanente (la convention de l'éditeur) ; négatif : la séquence
      // seule la déclenche, et une création n'a pas de séquence — la rendre
      // permanente changerait la salle en douce, on l'écarte
      if (p.canal === 0) delete p.canal
      if (p.canal !== undefined && !(Number.isInteger(p.canal) && (p.canal as number) >= 1)) return false
      return true
    default:
      return true
  }
}
