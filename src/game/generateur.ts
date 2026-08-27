// Le GÉNÉRATEUR DE SALLES : une graine → un tableau complet, PROUVÉ
// traversable avant d'être remis au joueur. La recette qui évite la soupe
// aléatoire : on tire d'abord la CHAÎNE D'INTENTIONS (la suite des
// franchissements — évent, rideau, membrane, énigmes au laser), puis on
// habille chaque maillon en géométrie, et l'on REFUSE tout tirage dont la
// traversée ne se démontre pas :
//   · accessibilité spawn → sas par parcours en largeur, avec la marge du
//     corps (aucun goulet infranchissable) — les surfaces à état (évent,
//     rideau, membrane) comptent passantes, puisqu'un état du corps les
//     traverse et que l'état se choisit librement ;
//   · chaque porte asservie est prouvée OUVRABLE par le VRAI traceur de
//     faisceau (laser.ts), corps synthétique posé à l'endroit prévu pour le
//     joueur — glace-miroir, nuage ionisant ou traversée en vapeur selon
//     l'énigme — et l'énigme doit EXISTER : sans le corps, rien ne s'ouvre
//     (sauf la barrière NOR, allumée d'office par contrat).
// Même graine, même salle — le générateur est déterministe : une salle se
// partage par son code (G-…), se rejoue, se retouche à l'éditeur.
//
// LA GRAMMAIRE DES MAILLONS (un par cloison) :
//   · libre     — un passage nu ;
//   · grille    — l'évent : seul le corps en VAPEUR le traverse ;
//   · rideau    — seule la GLACE l'écarte ;
//   · membrane  — seule l'EAU la traverse ;
//   · porte     — l'énigme du MIROIR : un fil à plomb de lumière, le corps
//     gelé dessous ; son flanc renvoie le faisceau sur la pastille ;
//   · et        — DEUX miroirs, deux pastilles du même canal, règle ET :
//     la porte exige les deux (le TOR retient — l'une après l'autre) ;
//   · rail      — le PLASMA : se tenir en vapeur au point marqué ionise le
//     faisceau, le rail magnétique capture l'arc et le guide à la pastille ;
//   · nor       — la BARRIÈRE TENUE : un faisceau vertical barre le chemin,
//     sa pastille NOR tient la porte ouverte TANT QU'IL la touche. L'eau le
//     plie, la glace le renvoie — couper le faisceau scelle la porte.
//     Traverser la lumière EN VAPEUR : le faisceau s'ionise mais file droit.

import {
  MAT_WALL,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_FROID,
  MAT_GRILLE,
  MAT_CHAUD,
  MAT_MEMBRANE,
  MAT_RIDEAU,
  MAT_MIROIR,
  type LevelDef,
  type ObstacleBox,
  type WorldLabel,
  type CibleDef,
  type PorteDef,
  type LaserDef,
  type LumiereDef,
  type CacheDef,
  type DecalDef,
  type RailDef,
} from './level'
import { traceLaser, type TraceMonde } from './laser'
import {
  checkLevel,
  MECANIQUE_NOMS,
  MOMENT_NOMS,
  type CodeAtelier,
} from './levelIO'
import { dansForme, formeContact, FORME_RECT } from './formes'
import { essaieFigure } from './figures'

// ---- Le hasard APPRIVOISÉ : mulberry32, la graine fait tout -------------
export function creeRng(graine: number): () => number {
  let a = graine >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rng = () => number
const entre = (rng: Rng, a: number, b: number): number => a + rng() * (b - a)
const parmi = <T>(rng: Rng, xs: readonly T[]): T =>
  xs[Math.floor(rng() * xs.length)]

// ---- La CHAÎNE : ce que chaque cloison exige pour être franchie ---------
export type Maillon =
  | 'libre'
  | 'grille'
  | 'rideau'
  | 'membrane'
  | 'porte'
  | 'et'
  | 'rail'
  | 'nor'

// Les FAMILLES de maillons, dans les termes de la nomenclature atelier :
// la mécanique d'un code MMD dit ce que la salle EXIGE pour être franchie.
const GLACEUX: readonly Maillon[] = ['rideau', 'porte', 'et'] // exigent la glace
const VAPOREUX: readonly Maillon[] = ['grille', 'rail', 'nor'] // exigent la vapeur
const estVaporeux = (m: Maillon): boolean => VAPOREUX.includes(m)

// ---- Le CAHIER DES CHARGES atelier : « 101 » n'est pas une graine --------
// Le code à trois chiffres de la nomenclature (moment · mécanique ·
// difficulté) DÉCRIT une salle, il n'en identifie pas une : plusieurs
// salles portent naturellement « 101 ». Le générateur le prend donc comme
// un CAHIER DES CHARGES — la mécanique choisit les familles de maillons,
// la difficulté dose compartiments, contraintes, passages et dangers — et
// la VARIANTE (quelques lettres) fait l'identité : « 101-K7 » est UNE
// salle précise, rejouable au caractère près.
export interface SaisieAtelier {
  type: 'atelier'
  cahier: CodeAtelier
  variante: string | null // null : le générateur en tirera une au hasard
  options: OptionsGen | null // portées par le suffixe « ~XXX » du code
}
export interface SaisieLibre {
  type: 'libre'
  graine: number
  options: OptionsGen | null
}

// ---- Les OPTIONS du générateur : des réglages qui VOYAGENT dans le code --
// Chaque réglage a un cran « auto » (le comportement historique). Dès qu'un
// réglage s'en écarte, le tout s'encode en un court suffixe base 36 accolé
// au code de la salle (« G-212-BJB~1A2 ») : retaper le code, suffixe
// compris, redonne la même salle — les réglages font partie de l'identité.
export const FAMILLES_OPT: readonly Maillon[] = [
  'grille',
  'rideau',
  'membrane',
  'porte',
  'et',
  'rail',
  'nor',
]

export interface OptionsGen {
  salles: 0 | 3 | 4 | 5 // 0 : auto
  familles: number // masque de bits sur FAMILLES_OPT — 127 (tout) : auto
  dangers: 0 | 1 | 2 | 3 // 0 auto · 1 aucun · 2 rares · 3 fréquents
  cachette: 0 | 1 | 2 // 0 auto · 1 jamais · 2 toujours
  decor: 0 | 1 | 2 | 3 // 0 auto · 1 sobre · 2 normal · 3 chargé
  // l'esprit LABYRINTHE : des traverses horizontales ancrées aux flancs,
  // qui forcent le serpentin — 0 auto (léger) · 1 aucune · 2 marqué ·
  // 3 dédale (plus de traverses, couloirs plus étroits)
  laby: 0 | 1 | 2 | 3
  // l'ÉCLAIRAGE CONTRASTÉ : ambiante presque éteinte, lampes BASSES et
  // intenses (les ombres s'étirent), bandeaux lumineux, teintes, et des
  // écrans d'ombre posés exprès — 0 auto · 1 contrasté
  contraste: 0 | 1
  // le MODE FIGURE (figures.ts) : le tableau devient un GLYPHE posé dans
  // un champ immense, à la manière des tableaux faits main (crop circle,
  // tournesol, cortège des lunes) — 0 : salles à compartiments
  // (l'historique) · 1 : figure, famille tirée de la graine · 2..7 :
  // famille forcée (anneaux, spirale, cortège, rosace, nef, constellation)
  figure: number
  // l'AMPLEUR du champ, en mode figure — 0 auto · 1 intime · 2 vaste ·
  // 3 immense
  ampleur: 0 | 1 | 2 | 3
  // les MÉCANISMES greffés sur la couture finale, en mode figure —
  // 0 auto · 1 aucun (filtres d'état seuls) · 2 une énigme · 3 deux
  mecanismes: 0 | 1 | 2 | 3
}

export const OPTIONS_DEFAUT: OptionsGen = {
  salles: 0,
  familles: 127,
  dangers: 0,
  cachette: 0,
  decor: 0,
  laby: 0,
  contraste: 0,
  figure: 0,
  ampleur: 0,
  mecanismes: 0,
}

/** Le suffixe des options — vide quand tout est « auto ». Les réglages du
 * MODE FIGURE occupent les bits hauts : un ancien code (sans eux) se
 * décode inchangé, figure à zéro. */
export function encodeOptions(o: OptionsGen): string {
  const sallesIdx = o.salles === 0 ? 0 : o.salles - 2 // 3, 4, 5 → 1, 2, 3
  const familles = o.familles & 127 || 127
  const paquet =
    sallesIdx |
    (familles << 2) |
    (o.dangers << 9) |
    (o.cachette << 11) |
    (o.decor << 13) |
    (o.laby << 15) |
    (o.contraste << 17) |
    ((o.figure & 7) << 18) |
    (o.ampleur << 21) |
    (o.mecanismes << 23)
  const defaut = 0 | (127 << 2)
  return paquet === defaut ? '' : paquet.toString(36).toUpperCase()
}

export function decodeOptions(txt: string): OptionsGen | null {
  if (!/^[0-9A-Z]{1,5}$/i.test(txt.trim())) return null
  const paquet = parseInt(txt.trim(), 36)
  if (!Number.isFinite(paquet) || paquet < 0 || paquet >= 1 << 25) return null
  const sallesIdx = paquet & 3
  return {
    salles: (sallesIdx === 0 ? 0 : sallesIdx + 2) as OptionsGen['salles'],
    familles: (paquet >> 2) & 127 || 127,
    dangers: ((paquet >> 9) & 3) as OptionsGen['dangers'],
    cachette: Math.min(2, (paquet >> 11) & 3) as OptionsGen['cachette'],
    decor: ((paquet >> 13) & 3) as OptionsGen['decor'],
    laby: ((paquet >> 15) & 3) as OptionsGen['laby'],
    contraste: ((paquet >> 17) & 1) as OptionsGen['contraste'],
    figure: (paquet >> 18) & 7,
    ampleur: ((paquet >> 21) & 3) as OptionsGen['ampleur'],
    mecanismes: ((paquet >> 23) & 3) as OptionsGen['mecanismes'],
  }
}

/** Lit une saisie de génération : « 101 » ou « 101-K7 » (atelier, avec le
 * préfixe G- toléré — on retape ce qu'affiche la salle), sinon une graine
 * libre en base 36 — chacune avec son éventuel suffixe d'options « ~XXX ».
 * Null : illisible. */
export function analyseSaisie(txt: string): SaisieAtelier | SaisieLibre | null {
  let nu = txt.trim().toUpperCase().replace(/^G-/, '')
  let options: OptionsGen | null = null
  const tilde = /~\s*([0-9A-Z]{1,5})$/.exec(nu)
  if (tilde) {
    options = decodeOptions(tilde[1])
    if (options === null) return null
    nu = nu.slice(0, tilde.index).trim()
  }
  const m = /^([123])([0-3])(\d)(?:\s*-\s*([0-9A-Z]{1,6}))?$/.exec(nu)
  if (m) {
    return {
      type: 'atelier',
      cahier: {
        moment: Number(m[1]) as CodeAtelier['moment'],
        mecanique: Number(m[2]) as CodeAtelier['mecanique'],
        difficulte: Number(m[3]),
      },
      variante: m[4] ?? null,
      options,
    }
  }
  const graine = graineDepuisTexte(nu)
  return graine === null ? null : { type: 'libre', graine, options }
}

/** La graine numérique d'une salle atelier : cahier ⊕ variante — même
 * couple, même salle, toujours. */
export function graineAtelier(cahier: CodeAtelier, variante: string): number {
  const mmd = cahier.moment * 100 + cahier.mecanique * 10 + cahier.difficulte
  return ((parseInt(variante, 36) >>> 0) ^ Math.imul(mmd, 2654435761)) >>> 0
}

// La marge du corps pour le parcours de validation : un couloir plus étroit
// que ça n'est pas un passage, c'est un piège à goutte.
const MARGE_CORPS = 40
const PAS_GRILLE_VALID = 20 // résolution du parcours en largeur (u)

// ---- La TOPOLOGIE : une grille de compartiments, plus seulement une ligne
// Les salles s'arrangent en couloir 1×N (le classique), en grille 2×2 ou
// 2×3, ou en L (un coin muré plein) ; les rangées se relient par des
// OUVERTURES percées dans le plancher — d'où des boucles (PLUSIEURS VOIES
// mènent au sas) et des embranchements en cul-de-sac où nichent les
// cachettes. Le contrat de la nomenclature tient toujours : l'entrée du
// sas est UNIQUE (coin de grille, jamais d'ouverture verticale dans sa
// colonne) et porte la mécanique obligatoire — quelle que soit la voie,
// on finit par elle.
interface Rect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface SalleT {
  ix: number
  iy: number // 0 : rangée haute
  rect: Rect // l'espace intérieur de la salle
}

interface ConnexionT {
  sens: 'h' | 'v' // h : cloison verticale · v : plancher percé entre rangées
  a: number // salle côté spawn — l'énigme s'y joue
  b: number
  maillon: Maillon
}

interface Topo {
  salles: SalleT[]
  pleins: Rect[] // les coins murés des formes en L
  conns: ConnexionT[]
  spawnSalle: number
  exitSalle: number
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

const EP_CLOISON = 60

/** Une famille de maillons est-elle AUTORISÉE par les options ? */
function autorise(o: OptionsGen, m: Maillon): boolean {
  return m === 'libre' || (o.familles & (1 << FAMILLES_OPT.indexOf(m))) !== 0
}

/** Restreint une liste aux maillons autorisés — la liste entière si les
 * options excluaient tout (un cahier atelier ne se laisse pas trahir). */
function filtre(o: OptionsGen, xs: readonly Maillon[]): readonly Maillon[] {
  const f = xs.filter((m) => autorise(o, m))
  return f.length ? f : xs
}

// Les PLAFONDS de lisibilité (deux miroirs simples, un ET, un rail, une
// barrière, trois lasers en tout), en restant DANS la famille du maillon
// ET dans les familles autorisées : un excédent glaceux redevient rideau,
// un excédent vaporeux, évent — sinon membrane, sinon passage libre.
function plafonne(
  maillons: Maillon[],
  largeurs: number[],
  o: OptionsGen,
): Maillon[] {
  const retombe = (pref: Maillon[]): Maillon =>
    pref.find((m) => autorise(o, m)) ?? 'libre'
  let miroirs = 0
  let ets = 0
  let rails = 0
  let nors = 0
  let lasers = 0
  return maillons.map((m, i) => {
    // le double miroir exige une salle large ; à défaut, un miroir simple
    if (m === 'et' && largeurs[i] < 820)
      m = retombe(['porte', 'rideau', 'membrane'])
    if (m === 'et' && ets >= 1) m = retombe(['porte', 'rideau', 'membrane'])
    if (m === 'porte' && miroirs >= 2) m = retombe(['rideau', 'membrane'])
    if (m === 'rail' && rails >= 1) m = retombe(['grille', 'membrane'])
    if (m === 'nor' && nors >= 1) m = retombe(['grille', 'membrane'])
    if (
      (m === 'porte' || m === 'et' || m === 'rail' || m === 'nor') &&
      lasers >= 3
    )
      m = estVaporeux(m)
        ? retombe(['grille', 'membrane'])
        : retombe(['rideau', 'membrane'])
    if (m === 'porte') miroirs++
    if (m === 'et') ets++
    if (m === 'rail') rails++
    if (m === 'nor') nors++
    if (m === 'porte' || m === 'et' || m === 'rail' || m === 'nor') lasers++
    return m
  })
}

/** Le tirage de la topologie : la forme, les connexions, puis la chaîne
 * d'intentions posée sur les connexions — le contrat du cahier d'abord
 * (l'entrée du sas), la couleur ensuite. */
function tireTopologie(
  rng: Rng,
  cahier: CodeAtelier | null,
  o: OptionsGen,
): Topo {
  const D = cahier ? cahier.difficulte : -1
  let nb =
    o.salles !== 0
      ? o.salles
      : cahier
        ? D <= 2
          ? 3
          : D <= 5
            ? 4
            : 5
        : 3 + Math.floor(rng() * 3)
  // le même code ne donne pas toujours le même GABARIT
  if (cahier && o.salles === 0) {
    const j = rng()
    if (j < 0.18 && nb > 3) nb--
    else if (j > 0.82 && nb < 6) nb++
  }
  // la FORME : couloir, grille, ou L (coin haut-droit muré plein)
  let cols: number
  let rangs: number
  let coinMure = false
  if (nb <= 3) {
    cols = 3
    rangs = 1
  } else if (nb === 4) {
    if (rng() < 0.65) {
      cols = 2
      rangs = 2
    } else {
      cols = 4
      rangs = 1
    }
  } else if (nb === 5) {
    if (rng() < 0.65) {
      cols = 3
      rangs = 2
      coinMure = true
    } else {
      cols = 5
      rangs = 1
    }
  } else {
    cols = 3
    rangs = 2
  }
  const largCol: number[] = []
  for (let c = 0; c < cols; c++)
    largCol.push(Math.round(entre(rng, 640, 880) / 10) * 10)
  const hautRang: number[] = []
  for (let r = 0; r < rangs; r++)
    hautRang.push(
      Math.round(
        entre(rng, rangs === 1 ? 1150 : 640, rangs === 1 ? 1450 : 800) / 10,
      ) * 10,
    )
  const totalW = largCol.reduce((s, w) => s + w, 0) + (cols - 1) * EP_CLOISON
  const totalH = hautRang.reduce((s, h) => s + h, 0) + (rangs - 1) * EP_CLOISON
  const x0 = -Math.round(totalW / 2)
  const yHaut = Math.round(totalH / 2)
  const colX: [number, number][] = []
  {
    let x = x0
    for (let c = 0; c < cols; c++) {
      colX.push([x, x + largCol[c]])
      x += largCol[c] + EP_CLOISON
    }
  }
  const rowY: [number, number][] = []
  {
    let y = yHaut
    for (let r = 0; r < rangs; r++) {
      rowY.push([y - hautRang[r], y])
      y -= hautRang[r] + EP_CLOISON
    }
  }
  const presente = (c: number, r: number): boolean =>
    !(coinMure && r === 0 && c === cols - 1)
  const salles: SalleT[] = []
  const idx = new Map<string, number>()
  const pleins: Rect[] = []
  for (let r = 0; r < rangs; r++)
    for (let c = 0; c < cols; c++) {
      const rect: Rect = {
        minX: colX[c][0],
        minY: rowY[r][0],
        maxX: colX[c][1],
        maxY: rowY[r][1],
      }
      if (!presente(c, r)) {
        pleins.push(rect)
        continue
      }
      idx.set(`${c},${r}`, salles.length)
      salles.push({ ix: c, iy: r, rect })
    }
  const spawnSalle = idx.get('0,0')!
  const exitSalle = idx.get(`${cols - 1},${rangs - 1}`)!
  // les connexions : les voisines d'une rangée se parlent toutes ; les
  // rangées se relient par le plancher percé — jamais dans la colonne du
  // sas (son entrée reste unique), et parfois DEUX ouvertures : la boucle
  const brutes: { sens: 'h' | 'v'; a: number; b: number }[] = []
  for (let r = 0; r < rangs; r++)
    for (let c = 0; c + 1 < cols; c++) {
      const a = idx.get(`${c},${r}`)
      const b = idx.get(`${c + 1},${r}`)
      if (a !== undefined && b !== undefined) brutes.push({ sens: 'h', a, b })
    }
  const candidatesV: { a: number; b: number }[] = []
  for (let c = 0; c < cols; c++) {
    if (rangs < 2 || c === cols - 1) continue
    const a = idx.get(`${c},0`)
    const b = idx.get(`${c},1`)
    if (a !== undefined && b !== undefined) candidatesV.push({ a, b })
  }
  const ouvertes = candidatesV.filter(() => rng() < 0.7)
  if (rangs === 2 && ouvertes.length === 0 && candidatesV.length > 0)
    ouvertes.push(parmi(rng, candidatesV))
  for (const v of ouvertes) brutes.push({ sens: 'v', a: v.a, b: v.b })
  // profondeur depuis le spawn : l'énigme d'une connexion se joue côté spawn
  const adj = new Map<number, number[]>()
  for (const e of brutes) {
    adj.set(e.a, [...(adj.get(e.a) ?? []), e.b])
    adj.set(e.b, [...(adj.get(e.b) ?? []), e.a])
  }
  const prof = new Map<number, number>([[spawnSalle, 0]])
  const fileP = [spawnSalle]
  while (fileP.length) {
    const s = fileP.shift()!
    for (const v of adj.get(s) ?? [])
      if (!prof.has(v)) {
        prof.set(v, prof.get(s)! + 1)
        fileP.push(v)
      }
  }
  const conns: ConnexionT[] = brutes.map((e) => {
    const [a, b] =
      (prof.get(e.a) ?? 0) <= (prof.get(e.b) ?? 0) ? [e.a, e.b] : [e.b, e.a]
    return { sens: e.sens, a, b, maillon: 'libre' as Maillon }
  })
  // ---- la chaîne d'intentions, posée sur les connexions ----
  const mec = cahier?.mecanique
  const idxExit = conns.findIndex(
    (cn) => cn.b === exitSalle || cn.a === exitSalle,
  )
  const versExit = conns[idxExit]
  const forces = new Set<number>([idxExit])
  if (cahier) {
    versExit.maillon =
      mec === 0
        ? 'membrane'
        : mec === 2
          ? parmi(rng, filtre(o, VAPOREUX))
          : parmi(rng, filtre(o, GLACEUX)) // mec 1 et 3 : la glace garde le sas
    if (mec === 3) {
      // la SECONDE famille verrouille TOUTES les entrées de l'avant-sas :
      // quelle que soit la voie, la vapeur se prouve avant la glace
      const pred = versExit.a === exitSalle ? versExit.b : versExit.a
      for (let i = 0; i < conns.length; i++) {
        if (i === idxExit) continue
        if (conns[i].a === pred || conns[i].b === pred) {
          conns[i].maillon = parmi(rng, filtre(o, VAPOREUX))
          forces.add(i)
        }
      }
    }
  } else {
    const pool = FAMILLES_OPT.filter((m) => autorise(o, m))
    versExit.maillon = parmi(rng, pool.length ? pool : [...FAMILLES_OPT])
  }
  const restants = conns.map((_, i) => i).filter((i) => !forces.has(i))
  const doux: readonly Maillon[] = autorise(o, 'membrane')
    ? (['libre', 'libre', 'membrane'] as const)
    : (['libre'] as const)
  if (cahier) {
    const renforts: readonly Maillon[] =
      mec === 0
        ? ['membrane']
        : mec === 1
          ? filtre(o, GLACEUX)
          : mec === 2
            ? filtre(o, VAPOREUX)
            : [...filtre(o, GLACEUX), ...filtre(o, VAPOREUX)]
    const viser = Math.min(
      restants.length,
      Math.max(0, 1 + Math.floor(D / 3) + (mec === 3 ? 1 : 0) - forces.size),
    )
    for (let i = restants.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[restants[i], restants[j]] = [restants[j], restants[i]]
    }
    restants.forEach((ci, k) => {
      conns[ci].maillon = k < viser ? parmi(rng, renforts) : parmi(rng, doux)
    })
  } else {
    const contraints = FAMILLES_OPT.filter((m) => autorise(o, m))
    const types: readonly Maillon[] = [
      'libre',
      'libre',
      ...(contraints.length ? contraints : [...FAMILLES_OPT]),
    ]
    for (const ci of restants) conns[ci].maillon = parmi(rng, types)
  }
  // la barrière NOR ne sait tenir qu'une cloison verticale ; ailleurs, évent
  for (const cn of conns)
    if (cn.maillon === 'nor' && cn.sens !== 'h')
      cn.maillon = autorise(o, 'grille') ? 'grille' : 'membrane'
  // les plafonds de lisibilité — les maillons du CONTRAT passent en premier
  {
    const ordre = [...forces, ...restants]
    const larg = ordre.map((ci) => {
      const R = salles[conns[ci].a].rect
      return R.maxX - R.minX
    })
    const apres = plafonne(
      ordre.map((ci) => conns[ci].maillon),
      larg,
      o,
    )
    ordre.forEach((ci, k) => {
      conns[ci].maillon = apres[k]
    })
  }
  const bounds = {
    minX: x0 - 40,
    minY: yHaut - totalH - 40,
    maxX: x0 + totalW + 40,
    maxY: yHaut + 40,
  }
  return { salles, pleins, conns, spawnSalle, exitSalle, bounds }
}

const gonfle = (r: Rect, m: number): Rect => ({
  minX: r.minX - m,
  minY: r.minY - m,
  maxX: r.maxX + m,
  maxY: r.maxY + m,
})
const chevauche = (a: Rect, b: Rect): boolean =>
  a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY

/** La boîte englobante VRAIE d'une pièce pivotée : ses coins débordent de
 * min/max (définis avant rotation) — la validation doit voir large. */
function aabbVraie(b: Rect & { angle?: number }): Rect {
  if (!b.angle) return b
  const hx = (b.maxX - b.minX) / 2
  const hy = (b.maxY - b.minY) / 2
  const cx = (b.minX + b.maxX) / 2
  const cy = (b.minY + b.maxY) / 2
  const rad = (b.angle * Math.PI) / 180
  const c = Math.abs(Math.cos(rad))
  const s = Math.abs(Math.sin(rad))
  const ex = hx * c + hy * s
  const ey = hx * s + hy * c
  return { minX: cx - ex, minY: cy - ey, maxX: cx + ex, maxY: cy + ey }
}

// ---- Les PREUVES à mener sur la salle finie ------------------------------
export interface PreuveDef {
  kind: 'miroir' | 'rail' | 'nor'
  canal: number
  emetteur: LaserDef
  /** miroir : où geler le corps · rail : où se tenir en vapeur ·
   * nor : où le chemin croise le faisceau (la traversée à démontrer). */
  spot: { x: number; y: number }
  /** miroir : la normale du flanc de glace attendu (le montage varie —
   * plafond, plancher, flanc — et le reflet part dans les quatre sens). */
  normale: { nx: number; ny: number }
  cibleIndex: number
}

type LevelGen = LevelDef & { __preuves?: PreuveDef[] }

interface Atelier {
  cahier: CodeAtelier
  variante: string
}

/** Un essai de salle complet — géométrie, mécanismes, habillage. */
function essaieNiveau(
  graine: number,
  rng: Rng,
  atelier: Atelier | null,
  o: OptionsGen,
): LevelDef {
  // le MODE FIGURE : le tableau-glyphe (figures.ts), même identité de
  // code, mêmes preuves — mais pas de retournement (les transformations
  // ne savent pas encore emporter les formes en arc : la promenade des
  // figures se lit toujours vers l'est).
  if (o.figure !== 0) {
    const suffixeF = encodeOptions(o)
    const identF =
      (atelier
        ? `${atelier.cahier.moment}${atelier.cahier.mecanique}${atelier.cahier.difficulte}-${atelier.variante}`
        : (graine >>> 0).toString(36).toUpperCase()) +
      (suffixeF ? `~${suffixeF}` : '')
    return essaieFigure(
      rng,
      {
        figure: o.figure,
        ampleur: o.ampleur,
        mecanismes: o.mecanismes,
        famillesMasque: o.familles,
      },
      atelier?.cahier ?? null,
      identF,
    )
  }
  const topo = tireTopologie(rng, atelier?.cahier ?? null, o)
  const bounds = topo.bounds

  const boxes: ObstacleBox[] = []
  const labels: WorldLabel[] = []
  const cibles: CibleDef[] = []
  const portes: PorteDef[] = []
  const lasers: LaserDef[] = []
  const rails: RailDef[] = []
  const lumieres: LumiereDef[] = []
  const caches: CacheDef[] = []
  const decals: DecalDef[] = []
  // les couloirs à garder LIBRES : le chemin, les faisceaux, le spawn, le sas
  const reserves: Rect[] = []
  const preuves: PreuveDef[] = []

  const rectDe = (s: number): Rect => topo.salles[s].rect

  const rs = rectDe(topo.spawnSalle)
  const spawn = {
    x: rs.minX + 230,
    y: Math.round((rs.minY + rs.maxY) / 2),
    n: 700,
  }
  reserves.push({
    minX: spawn.x - 230,
    minY: spawn.y - 230,
    maxX: spawn.x + 230,
    maxY: spawn.y + 230,
  })

  const re = rectDe(topo.exitSalle)
  const eyC = Math.round((re.minY + re.maxY) / 2)
  const exit = {
    minX: re.maxX - 130,
    minY: eyC - 110,
    maxX: re.maxX - 10,
    maxY: eyC + 110,
  }
  labels.push({
    x: (exit.minX + exit.maxX) / 2,
    y: exit.maxY + 60,
    text: 'SAS',
    tone: 'sas',
  })
  reserves.push(gonfle(exit, 140))

  // Les INDICES peints au sol : un par ESPÈCE d'énigme et par salle au
  // plus — et plus aucun au-delà de la difficulté 2 (l'atelier suppose le
  // protocole connu ; le petit mot tuto n'a pas à se répéter partout).
  const indicesVus = new Set<string>()
  const poseIndice = (
    type: string,
    x: number,
    y: number,
    text: string,
    tone: WorldLabel['tone'],
  ): void => {
    if (indicesVus.has(type)) return
    if (atelier && atelier.cahier.difficulte > 2) return
    indicesVus.add(type)
    labels.push({ x, y, text, tone, rang: 'detail' })
  }

  /** Une bande rectangulaire autour du segment a → b, pour les réserves. */
  const bande = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    m: number,
  ): Rect => ({
    minX: Math.min(ax, bx) - m,
    minY: Math.min(ay, by) - m,
    maxX: Math.max(ax, bx) + m,
    maxY: Math.max(ay, by) + m,
  })

  // L'ÉNIGME DU MIROIR — le MONTAGE varie (plafond, plancher, flanc de la
  // salle) et le reflet part dans les quatre sens selon la place. Tout est
  // LOCAL à la salle : la grille des compartiments n'a plus de « pleine
  // hauteur » commune. La pastille est posée par CALIBRAGE sur le trajet
  // du reflet — la preuve tranche, un tirage raté se re-tire.
  const poseMiroir = (s: number, canal: number): void => {
    const R = rectDe(s)
    const midY = (R.minY + R.maxY) / 2
    const demi = (R.maxY - R.minY) / 2
    const montage = parmi(rng, ['plafond', 'plancher', 'flanc'] as const)
    let em: LaserDef
    let spot: { x: number; y: number }
    let d: { x: number; y: number }
    let r: { x: number; y: number }
    let L: number
    // le TRAJET RELAYÉ : au-delà de la difficulté 2 (ou une fois sur trois
    // en tirage libre), un MIROIR FIXE en losange relaie le fil — le
    // faisceau tombe, le losange poli le couche à l'horizontale à travers
    // la salle, le corps gelé du joueur le redresse vers la pastille :
    // la cible finit LOIN de l'émetteur, le trajet se lit en trois temps.
    const veutRelais =
      montage !== 'flanc' &&
      (atelier ? atelier.cahier.difficulte >= 3 : rng() < 0.35)
    if (veutRelais) {
      const ex = Math.round(entre(rng, R.minX + 180, R.maxX - 180) / 10) * 10
      const duHaut = montage === 'plafond'
      em = {
        x: ex,
        y: duHaut ? R.maxY - 24 : R.minY + 24,
        angle: duHaut ? -90 : 90,
      }
      const d0y = duHaut ? -1 : 1
      const myF =
        Math.round(entre(rng, midY - demi * 0.3, midY + demi * 0.3) / 10) * 10
      const espaceDroite = R.maxX - 90 - ex
      const espaceGauche = ex - (R.minX + 90)
      const sHor = espaceDroite >= espaceGauche ? 1 : -1
      const espace = sHor > 0 ? espaceDroite : espaceGauche
      if (espace >= 330) {
        // le losange poli, décalé du fil pour présenter sa face à 45°
        const decal = -sHor * 40
        boxes.push({
          minX: ex + decal - 40,
          minY: myF - 40,
          maxX: ex + decal + 40,
          maxY: myF + 40,
          material: MAT_MIROIR,
          angle: 45,
        })
        const hitY = myF - d0y * 17
        const Lf = entre(rng, 210, Math.min(420, espace - 110))
        spot = { x: Math.round((ex + sHor * Lf) / 10) * 10, y: hitY }
        d = { x: sHor, y: 0 } // le fil ARRIVE horizontal sur le corps gelé
        const espaceHaut = R.maxY - 80 - hitY
        const espaceBas = hitY - (R.minY + 80)
        const versHaut =
          espaceHaut < 180 ? false : espaceBas < 180 ? true : rng() < 0.5
        r = { x: 0, y: versHaut ? 1 : -1 }
        L = entre(
          rng,
          150,
          Math.min(
            340,
            Math.max(160, (versHaut ? espaceHaut : espaceBas) - 20),
          ),
        )
        // réserves : le fil vertical (losange compris), puis le relais
        reserves.push(bande(em.x, em.y, ex, myF, 80))
        reserves.push(bande(ex, hitY, spot.x + sHor * 40, hitY, 80))
        const nl0 = Math.hypot(r.x - d.x, r.y - d.y)
        const normale0 = { nx: (r.x - d.x) / nl0, ny: (r.y - d.y) / nl0 }
        const cible0: CibleDef = {
          x: spot.x - d.x * 44 + normale0.nx * 8 + r.x * L,
          y: spot.y - d.y * 44 + normale0.ny * 8 + r.y * L,
          r: 30,
          canal,
        }
        cibles.push(cible0)
        lasers.push(em)
        preuves.push({
          kind: 'miroir',
          canal,
          emetteur: em,
          spot,
          normale: normale0,
          cibleIndex: cibles.length - 1,
        })
        poseIndice(
          'miroir',
          spot.x + d.x * 66,
          spot.y + d.y * 66,
          'MIROIR DE GLACE',
          'froid',
        )
        reserves.push(
          bande(spot.x, spot.y, cible0.x + r.x * 40, cible0.y + r.y * 40, 90),
        )
        return
      }
    }
    if (montage === 'flanc') {
      const ey =
        Math.round(entre(rng, midY - demi * 0.3, midY + demi * 0.3) / 10) * 10
      em = { x: R.minX + 16, y: ey, angle: 0 }
      d = { x: 1, y: 0 }
      const mx = Math.round(entre(rng, R.minX + 210, R.maxX - 160) / 10) * 10
      spot = { x: mx, y: ey }
      const espaceHaut = R.maxY - 80 - ey
      const espaceBas = ey - (R.minY + 80)
      const versHaut =
        espaceHaut < 180 ? false : espaceBas < 180 ? true : rng() < 0.5
      r = { x: 0, y: versHaut ? 1 : -1 }
      L = entre(
        rng,
        150,
        Math.min(320, Math.max(160, (versHaut ? espaceHaut : espaceBas) - 20)),
      )
    } else {
      const ex = Math.round(entre(rng, R.minX + 150, R.maxX - 150) / 10) * 10
      const duHaut = montage === 'plafond'
      em = {
        x: ex,
        y: duHaut ? R.maxY - 24 : R.minY + 24,
        angle: duHaut ? -90 : 90,
      }
      d = { x: 0, y: duHaut ? -1 : 1 }
      spot = {
        x: ex,
        y:
          Math.round(entre(rng, midY - demi * 0.35, midY + demi * 0.35) / 10) *
          10,
      }
      const espaceDroite = R.maxX - 70 - ex
      const espaceGauche = ex - (R.minX + 70)
      const versDroite =
        espaceDroite < 175 ? false : espaceGauche < 175 ? true : rng() < 0.6
      r = { x: versDroite ? 1 : -1, y: 0 }
      L = entre(
        rng,
        150,
        Math.min(300, Math.max(160, versDroite ? espaceDroite : espaceGauche)),
      )
    }
    const nl = Math.hypot(r.x - d.x, r.y - d.y)
    const normale = { nx: (r.x - d.x) / nl, ny: (r.y - d.y) / nl }
    const cible: CibleDef = {
      x: spot.x - d.x * 44 + normale.nx * 8 + r.x * L,
      y: spot.y - d.y * 44 + normale.ny * 8 + r.y * L,
      r: 30,
      canal,
    }
    cibles.push(cible)
    lasers.push(em)
    preuves.push({
      kind: 'miroir',
      canal,
      emetteur: em,
      spot,
      normale,
      cibleIndex: cibles.length - 1,
    })
    poseIndice(
      'miroir',
      spot.x + d.x * 66,
      spot.y + d.y * 66,
      'MIROIR DE GLACE',
      'froid',
    )
    reserves.push(bande(em.x, em.y, spot.x - d.x * 40, spot.y - d.y * 40, 70))
    reserves.push(
      bande(spot.x, spot.y, cible.x + r.x * 40, cible.y + r.y * 40, 90),
    )
  }

  // Le DOUBLE MIROIR (canal ET) garde son montage classique — deux fils à
  // plomb écartés dans la même salle : il reste reconnaissable.
  const poseMiroirPlafond = (
    s: number,
    ex: number,
    exMax: number,
    canal: number,
  ): void => {
    const R = rectDe(s)
    const midY = (R.minY + R.maxY) / 2
    const demi = (R.maxY - R.minY) / 2
    const my =
      Math.round(entre(rng, midY - demi * 0.35, midY + demi * 0.35) / 10) * 10
    const emetteur: LaserDef = { x: ex, y: R.maxY - 24, angle: -90 }
    const porteeCible = entre(
      rng,
      150,
      Math.min(260, Math.max(160, exMax - 70 - ex)),
    )
    const cible: CibleDef = { x: ex + porteeCible, y: my + 52, r: 30, canal }
    cibles.push(cible)
    lasers.push(emetteur)
    preuves.push({
      kind: 'miroir',
      canal,
      emetteur,
      spot: { x: ex, y: my },
      normale: { nx: N45, ny: N45 },
      cibleIndex: cibles.length - 1,
    })
    poseIndice('miroir', ex, my - 66, 'MIROIR DE GLACE', 'froid')
    reserves.push({
      minX: ex - 70,
      minY: my - 120,
      maxX: ex + 70,
      maxY: R.maxY,
    })
    reserves.push({
      minX: ex - 70,
      minY: my - 90,
      maxX: ex + porteeCible + 90,
      maxY: my + 130,
    })
  }

  const poseRail = (s: number, canal: number): void => {
    const R = rectDe(s)
    const midY = (R.minY + R.maxY) / 2
    const demi = (R.maxY - R.minY) / 2
    const ex = Math.round(entre(rng, R.minX + 150, R.maxX - 150) / 10) * 10
    const duHaut = rng() < 0.5
    const d = { x: 0, y: duHaut ? -1 : 1 }
    const emetteur: LaserDef = {
      x: ex,
      y: duHaut ? R.maxY - 24 : R.minY + 24,
      angle: duHaut ? -90 : 90,
    }
    const ny =
      Math.round(entre(rng, midY - demi * 0.3, midY + demi * 0.3) / 10) * 10
    const espaceDroite = R.maxX - 60 - ex
    const espaceGauche = ex - (R.minX + 60)
    const versDroite = espaceDroite >= espaceGauche
    const sgn = versDroite ? 1 : -1
    const Lr =
      Math.round(
        entre(
          rng,
          140,
          Math.min(
            200,
            Math.max(150, (versDroite ? espaceDroite : espaceGauche) - 110),
          ),
        ) / 10,
      ) * 10
    lasers.push(emetteur)
    const railY = ny + d.y * 30
    rails.push({
      points: [
        { x: ex, y: railY },
        { x: ex + sgn * Lr, y: railY },
      ],
    })
    const cible: CibleDef = { x: ex + sgn * (Lr + 100), y: railY, r: 26, canal }
    cibles.push(cible)
    preuves.push({
      kind: 'rail',
      canal,
      emetteur,
      spot: { x: ex, y: ny },
      normale: { nx: 0, ny: 0 }, // sans objet : le nuage n'a pas de flanc
      cibleIndex: cibles.length - 1,
    })
    poseIndice('rail', ex, ny - d.y * 74, 'IONISER ICI', 'grille')
    reserves.push(bande(emetteur.x, emetteur.y, ex, ny - d.y * 60, 70))
    reserves.push(bande(ex, railY, cible.x + sgn * 50, railY, 90))
  }

  /** La BARRIÈRE TENUE, dans la salle-énigme, entre ses entrées et la
   * porte : le faisceau vertical court du plafond au plancher DE LA SALLE.
   * `versDroite` : la porte est sur le flanc droit de la salle. */
  const poseBarriereNor = (
    s: number,
    canal: number,
    gy: number,
    versDroite: boolean,
  ): void => {
    const R = rectDe(s)
    const bx =
      Math.round(
        (versDroite
          ? entre(rng, Math.max(R.minX + 130, R.maxX - 320), R.maxX - 150)
          : entre(rng, R.minX + 150, Math.min(R.maxX - 130, R.minX + 320))) /
          10,
      ) * 10
    const duHaut = rng() < 0.5
    const emetteur: LaserDef = {
      x: bx,
      y: duHaut ? R.maxY - 24 : R.minY + 24,
      angle: duHaut ? -90 : 90,
    }
    lasers.push(emetteur)
    const cible: CibleDef = {
      x: bx,
      y: duHaut ? R.minY + 52 : R.maxY - 52,
      r: 22,
      mode: 'nor',
      canal,
    }
    cibles.push(cible)
    preuves.push({
      kind: 'nor',
      canal,
      emetteur,
      spot: { x: bx, y: gy },
      normale: { nx: 0, ny: 0 }, // sans objet : on traverse, on ne reflète pas
      cibleIndex: cibles.length - 1,
    })
    if (!indicesVus.has('nor')) {
      indicesVus.add('nor')
      labels.push({
        x: bx,
        y: gy + 120,
        text: 'TRAVERSER EN VAPEUR',
        tone: 'grille',
        rang: 'detail',
      })
    }
    // la colonne du faisceau reste dégagée du plafond au plancher : le
    // décor ne coupera jamais la barrière à la place du joueur
    reserves.push({ minX: bx - 60, minY: R.minY, maxX: bx + 60, maxY: R.maxY })
  }

  // ---- la GRILLE : murs, passages, maillons ----
  const serrage = atelier ? atelier.cahier.difficulte * 6 : 0
  let canalSuivant = 1
  // les coins murés des L : des blocs pleins, soudés à leurs murs
  for (const p of topo.pleins)
    boxes.push({
      ...gonfle(p, EP_CLOISON),
      material: MAT_WALL,
      skin: 1 + Math.floor(rng() * 4),
    })

  // le maillon d'une connexion, posé dans son passage
  const habilleMaillon = (
    cn: ConnexionT,
    gapRect: Rect,
    gapCentre: { x: number; y: number },
  ): void => {
    const m = cn.maillon
    if (m === 'grille' || m === 'rideau' || m === 'membrane') {
      const mat =
        m === 'grille' ? MAT_GRILLE : m === 'rideau' ? MAT_RIDEAU : MAT_MEMBRANE
      boxes.push({ ...gapRect, material: mat })
      const tone =
        m === 'grille' ? 'grille' : m === 'rideau' ? 'froid' : 'phile'
      const nom =
        m === 'grille' ? 'ÉVENT' : m === 'rideau' ? 'RIDEAU' : 'MEMBRANE'
      labels.push({
        x: gapCentre.x + (cn.sens === 'v' ? 0 : 0),
        y:
          gapCentre.y +
          (cn.sens === 'h' ? (gapRect.maxY - gapRect.minY) / 2 + 60 : 0),
        ...(cn.sens === 'v'
          ? { x: gapCentre.x + (gapRect.maxX - gapRect.minX) / 2 + 80 }
          : {}),
        text: nom,
        tone,
        rang: 'detail',
      } as WorldLabel)
    } else if (m === 'porte') {
      const canal = canalSuivant++
      portes.push({ ...gapRect, canal })
      poseMiroir(cn.a, canal)
    } else if (m === 'et') {
      const canal = canalSuivant++
      portes.push({ ...gapRect, canal, regle: 'et' })
      const R = rectDe(cn.a)
      const ex1 = Math.round(entre(rng, R.minX + 140, R.minX + 240) / 10) * 10
      const ex2 = Math.round(entre(rng, ex1 + 280, R.maxX - 220) / 10) * 10
      poseMiroirPlafond(cn.a, ex1, ex2 - 90, canal)
      poseMiroirPlafond(cn.a, ex2, R.maxX, canal)
      labels.push({
        x: gapCentre.x,
        y:
          gapCentre.y +
          (cn.sens === 'h' ? (gapRect.maxY - gapRect.minY) / 2 + 60 : 90),
        text: 'DEUX PASTILLES — LES DEUX',
        tone: 'grille',
        rang: 'detail',
      })
    } else if (m === 'rail') {
      const canal = canalSuivant++
      portes.push({ ...gapRect, canal })
      poseRail(cn.a, canal)
    } else if (m === 'nor') {
      const canal = canalSuivant++
      portes.push({ ...gapRect, canal })
      poseBarriereNor(
        cn.a,
        canal,
        gapCentre.y,
        topo.salles[cn.a].ix < topo.salles[cn.b].ix,
      )
    }
  }

  // les frontières VERTICALES (entre colonnes d'une même rangée).
  // Les bandes du CHEMIN se posent à part : les traverses du labyrinthe
  // ont le droit de barrer le chemin nominal (c'est le serpentin) — seul
  // le décor doit s'en écarter, elles rejoindront les réserves après.
  const bandesChemin: Rect[] = []
  const gapsParPlancher = new Map<
    number,
    { c: number; gapMin: number; gapMax: number }[]
  >()
  for (const cn of topo.conns) {
    const A = topo.salles[cn.a]
    const B = topo.salles[cn.b]
    if (cn.sens === 'h') {
      const gaucheS = A.ix < B.ix ? A : B
      const R = gaucheS.rect
      const wx = R.maxX
      const gapH =
        Math.round(Math.max(190, entre(rng, 220, 290) - serrage) / 10) * 10
      const gy =
        Math.round(
          entre(rng, R.minY + 160 + gapH / 2, R.maxY - 160 - gapH / 2) / 10,
        ) * 10
      const gapMin = gy - gapH / 2
      const gapMax = gy + gapH / 2
      boxes.push({
        minX: wx,
        minY: gapMax,
        maxX: wx + EP_CLOISON,
        maxY: R.maxY,
        material: MAT_WALL,
        skin: 1 + Math.floor(rng() * 4),
      })
      boxes.push({
        minX: wx,
        minY: R.minY,
        maxX: wx + EP_CLOISON,
        maxY: gapMin,
        material: MAT_WALL,
        skin: 1 + Math.floor(rng() * 4),
      })
      reserves.push({
        minX: wx - 190,
        minY: gapMin - 40,
        maxX: wx + EP_CLOISON + 190,
        maxY: gapMax + 40,
      })
      habilleMaillon(
        cn,
        { minX: wx, minY: gapMin, maxX: wx + EP_CLOISON, maxY: gapMax },
        { x: wx + EP_CLOISON / 2, y: gy },
      )
      // le chemin d'une voie reste dégagé : centre → passage → centre
      const ca = {
        x: (A.rect.minX + A.rect.maxX) / 2,
        y: (A.rect.minY + A.rect.maxY) / 2,
      }
      const cb = {
        x: (B.rect.minX + B.rect.maxX) / 2,
        y: (B.rect.minY + B.rect.maxY) / 2,
      }
      bandesChemin.push(bande(ca.x, ca.y, wx + EP_CLOISON / 2, gy, 120))
      bandesChemin.push(bande(wx + EP_CLOISON / 2, gy, cb.x, cb.y, 120))
    } else {
      const hautS = A.iy < B.iy ? A : B
      const R = hautS.rect
      const wy = R.minY - EP_CLOISON // la bande du plancher percé
      const gapW =
        Math.round(Math.max(190, entre(rng, 220, 290) - serrage) / 10) * 10
      const gx =
        Math.round(
          entre(rng, R.minX + 160 + gapW / 2, R.maxX - 160 - gapW / 2) / 10,
        ) * 10
      const gapMin = gx - gapW / 2
      const gapMax = gx + gapW / 2
      const liste = gapsParPlancher.get(hautS.iy) ?? []
      liste.push({ c: hautS.ix, gapMin, gapMax })
      gapsParPlancher.set(hautS.iy, liste)
      reserves.push({
        minX: gapMin - 40,
        minY: wy - 190,
        maxX: gapMax + 40,
        maxY: wy + EP_CLOISON + 190,
      })
      habilleMaillon(
        cn,
        { minX: gapMin, minY: wy, maxX: gapMax, maxY: wy + EP_CLOISON },
        { x: gx, y: wy + EP_CLOISON / 2 },
      )
      const ca = {
        x: (A.rect.minX + A.rect.maxX) / 2,
        y: (A.rect.minY + A.rect.maxY) / 2,
      }
      const cb = {
        x: (B.rect.minX + B.rect.maxX) / 2,
        y: (B.rect.minY + B.rect.maxY) / 2,
      }
      bandesChemin.push(bande(ca.x, ca.y, gx, wy + EP_CLOISON / 2, 120))
      bandesChemin.push(bande(gx, wy + EP_CLOISON / 2, cb.x, cb.y, 120))
    }
  }
  // le PLANCHER entre rangées : pleine largeur, percé aux seules ouvertures
  const rangees = [...new Set(topo.salles.map((s) => s.iy))]
  if (rangees.length > 1) {
    const hauts = topo.salles.filter((s) => s.iy === 0)
    const wyTop = Math.min(...hauts.map((s) => s.rect.minY))
    const wy = wyTop - EP_CLOISON
    const trous = (gapsParPlancher.get(0) ?? []).sort(
      (a, b) => a.gapMin - b.gapMin,
    )
    let x = bounds.minX
    for (const t of trous) {
      if (t.gapMin > x)
        boxes.push({
          minX: x,
          minY: wy,
          maxX: t.gapMin,
          maxY: wy + EP_CLOISON,
          material: MAT_WALL,
          skin: 1 + Math.floor(rng() * 4),
        })
      x = t.gapMax
    }
    if (x < bounds.maxX)
      boxes.push({
        minX: x,
        minY: wy,
        maxX: bounds.maxX,
        maxY: wy + EP_CLOISON,
        material: MAT_WALL,
        skin: 1 + Math.floor(rng() * 4),
      })
  }

  // ---- les BANDEAUX de silhouette : un par salle sur trois environ ----
  for (const s of topo.salles) {
    if (rng() >= 0.32) continue
    const R = s.rect
    const hB = Math.round(entre(rng, 120, 240) / 10) * 10
    const enHaut = rng() < 0.5
    const r: Rect = {
      minX: R.minX,
      minY: enHaut ? R.maxY - hB : R.minY,
      maxX: R.maxX,
      maxY: enHaut ? R.maxY : R.minY + hB,
    }
    let libre = true
    for (const res of reserves)
      if (chevauche(gonfle(r, 30), res)) {
        libre = false
        break
      }
    if (!libre) continue
    boxes.push({ ...r, material: MAT_WALL, skin: 1 + Math.floor(rng() * 4) })
    reserves.push(r)
  }

  // ---- les TRAVERSES : l'esprit labyrinthe, local à chaque salle ----
  if (o.laby !== 1) {
    for (const s of topo.salles) {
      const R = s.rect
      const larg = R.maxX - R.minX
      const nTrav =
        o.laby === 3
          ? rng() < 0.6
            ? 2
            : 1
          : o.laby === 2
            ? 1
            : rng() < 0.45
              ? 1
              : 0
      const haut = R.maxY - R.minY
      const posees: { vert: boolean; pos: number }[] = []
      let gauche = rng() < 0.5
      for (let t = 0; t < nTrav; t++) {
        for (let essai = 0; essai < 30; essai++) {
          // la traverse se couche OU se dresse : dans une salle large et
          // basse, la coupe verticale (ancrée au plafond ou au plancher)
          // est la bonne — on alterne les deux au fil des refus
          const verticale = (essai + (haut < larg ? 0 : 1)) % 2 === 0
          const flanc = essai % 6 < 3 ? gauche : !gauche
          const canalT =
            o.laby === 3 ? entre(rng, 150, 200) : entre(rng, 180, 250)
          let r: Rect
          let pos: number
          if (verticale) {
            if (R.maxX - 240 <= R.minX + 240) continue
            pos = Math.round(entre(rng, R.minX + 240, R.maxX - 240) / 10) * 10
            const lenH = haut - canalT
            if (lenH < 200) continue
            r = flanc
              ? {
                  minX: pos - 25,
                  minY: R.maxY - lenH,
                  maxX: pos + 25,
                  maxY: R.maxY,
                }
              : {
                  minX: pos - 25,
                  minY: R.minY,
                  maxX: pos + 25,
                  maxY: R.minY + lenH,
                }
          } else {
            if (R.maxY - 220 <= R.minY + 220) continue
            pos = Math.round(entre(rng, R.minY + 220, R.maxY - 220) / 10) * 10
            const lenW = larg - canalT
            if (lenW < 200) continue
            r = flanc
              ? {
                  minX: R.minX,
                  minY: pos - 25,
                  maxX: R.minX + lenW,
                  maxY: pos + 25,
                }
              : {
                  minX: R.maxX - lenW,
                  minY: pos - 25,
                  maxX: R.maxX,
                  maxY: pos + 25,
                }
          }
          if (
            posees.some(
              (q) => q.vert === verticale && Math.abs(q.pos - pos) < 260,
            )
          )
            continue
          let libre = true
          for (const res of reserves)
            if (chevauche(gonfle(r, 30), res)) {
              libre = false
              break
            }
          if (!libre) continue
          boxes.push({
            ...r,
            material: MAT_WALL,
            skin: 1 + Math.floor(rng() * 4),
          })
          posees.push({ vert: verticale, pos })
          gauche = !flanc
          break
        }
      }
    }
  }

  // le chemin nominal rejoint les réserves — les traverses sont posées,
  // le décor et les cachettes, eux, s'en écarteront
  reserves.push(...bandesChemin)

  // ---- le décor et les dangers, par rejet : jamais sur une réserve ----
  const posePossible = (r: Rect): boolean => {
    if (r.minX < bounds.minX + 30 || r.maxX > bounds.maxX - 30) return false
    if (r.minY < bounds.minY + 30 || r.maxY > bounds.maxY - 30) return false
    for (const res of reserves) if (chevauche(gonfle(r, 40), res)) return false
    for (const b of boxes)
      if (chevauche(gonfle(r, 60), aabbVraie(b))) return false
    return true
  }

  for (const s of topo.salles) {
    const R = s.rect
    const nDecor =
      o.decor === 1
        ? Math.floor(rng() * 2)
        : o.decor === 3
          ? 2 + Math.floor(rng() * 2)
          : 1 + Math.floor(rng() * 2)
    for (let d = 0; d < nDecor; d++) {
      for (let essai = 0; essai < 24; essai++) {
        const w = entre(rng, 110, 260)
        const h = entre(rng, 110, 260)
        const cx = entre(rng, R.minX + 80, R.maxX - 80)
        const cy = entre(rng, R.minY + 120, R.maxY - 120)
        const r: Rect = {
          minX: cx - w / 2,
          minY: cy - h / 2,
          maxX: cx + w / 2,
          maxY: cy + h / 2,
        }
        if (!posePossible(r)) continue
        const mat = parmi(rng, [
          MAT_WALL,
          MAT_WALL,
          MAT_HYDROPHILE,
          MAT_HYDROPHOBE,
        ])
        const forme = parmi(rng, [0, 0, 1, 2, 3])
        boxes.push({
          ...r,
          material: mat,
          ...(forme ? { forme } : {}),
          ...(forme === 3 ? { p0: Math.floor(rng() * 4) } : {}),
          ...(mat === MAT_WALL && !forme
            ? { skin: Math.floor(rng() * 5) }
            : {}),
          ...(rng() < 0.4 && !forme
            ? { angle: Math.round(entre(rng, -30, 30)) }
            : {}),
        })
        if (mat === MAT_HYDROPHILE && rng() < 0.5)
          labels.push({
            x: cx,
            y: cy,
            text: 'HYDROPHILE',
            tone: 'phile',
            rang: 'detail',
          })
        if (mat === MAT_HYDROPHOBE && rng() < 0.5)
          labels.push({
            x: cx,
            y: cy,
            text: 'HYDROPHOBE',
            tone: 'phobe',
            rang: 'detail',
          })
        break
      }
    }
    const pDanger =
      o.dangers === 1
        ? 0
        : o.dangers === 2
          ? 0.12
          : o.dangers === 3
            ? 0.6
            : atelier
              ? Math.min(0.75, 0.15 + 0.07 * atelier.cahier.difficulte)
              : 0.34
    if (rng() < pDanger) {
      // le LORE place les dangers : le froid vient de l'ESPACE — un hublot
      // fendu ne peut être que sur la COQUE (le tour du plateau). La
      // chaudière est une machine du vaisseau : n'importe quel bord.
      const surCoque = {
        haut: Math.abs(R.maxY - (bounds.maxY - 40)) < 1,
        bas: Math.abs(R.minY - (bounds.minY + 40)) < 1,
        gauche: Math.abs(R.minX - (bounds.minX + 40)) < 1,
        droite: Math.abs(R.maxX - (bounds.maxX - 40)) < 1,
      }
      const bordsCoque = (['haut', 'bas', 'gauche', 'droite'] as const).filter(
        (b) => surCoque[b],
      )
      let chaud = rng() < 0.5
      if (!chaud && bordsCoque.length === 0) chaud = true // salle sans coque
      const bords = chaud
        ? (['haut', 'bas', 'gauche', 'droite'] as const)
        : bordsCoque
      for (let essai = 0; essai < 18; essai++) {
        const bord = parmi(rng, bords)
        const long = entre(rng, 140, 240)
        const ep = entre(rng, 50, 70)
        const vertical = bord === 'gauche' || bord === 'droite'
        const cx = vertical
          ? bord === 'gauche'
            ? R.minX + ep / 2 + 4
            : R.maxX - ep / 2 - 4
          : entre(rng, R.minX + 120, R.maxX - 120)
        const cy = vertical
          ? entre(rng, R.minY + 120, R.maxY - 120)
          : bord === 'haut'
            ? R.maxY - ep / 2 - 4
            : R.minY + ep / 2 + 4
        const w = vertical ? ep : long
        const h = vertical ? long : ep
        const r: Rect = {
          minX: cx - w / 2,
          minY: cy - h / 2,
          maxX: cx + w / 2,
          maxY: cy + h / 2,
        }
        if (!posePossible(r)) continue
        boxes.push({
          ...r,
          material: chaud ? MAT_CHAUD : MAT_FROID,
          ...(chaud ? { aura: 0.8 } : {}),
        })
        labels.push({
          x: vertical ? cx + (bord === 'gauche' ? w + 60 : -w - 60) : cx,
          y: vertical ? cy : cy + (bord === 'haut' ? -h - 40 : h + 40),
          text: chaud ? 'CHAUDIÈRE' : 'HUBLOT FENDU',
          tone: chaud ? 'chaud' : 'froid',
          rang: 'detail',
        })
        break
      }
    }
    if (lumieres.length < 4) {
      const midY = (R.minY + R.maxY) / 2
      const demi = (R.maxY - R.minY) / 2
      if (o.contraste === 1) {
        // le MODE CONTRASTÉ : lampe BASSE, intense, teintée, près d'un
        // flanc — parfois en BANDEAU aligné à l'architecture
        const versGauche = rng() < 0.5
        const lx = Math.round(
          versGauche
            ? entre(rng, R.minX + 110, R.minX + 260)
            : entre(rng, R.maxX - 260, R.maxX - 110),
        )
        const ly = Math.round(
          entre(rng, midY - demi * 0.45, midY + demi * 0.45),
        )
        const bandeau = rng() < 0.45
        lumieres.push({
          x: lx,
          y: ly,
          h: Math.round(entre(rng, 90, 170)),
          intensite: Number(entre(rng, 1.2, 1.6).toFixed(2)),
          ...(rng() < 0.6
            ? {
                couleur: parmi(rng, [
                  '#ffd9a8',
                  '#a8c8ff',
                  '#ffc4c4',
                  '#ffffff',
                ]),
              }
            : {}),
          ...(bandeau
            ? {
                forme: 'bandeau' as const,
                longueur: Math.round(entre(rng, 240, 420)),
                angle: parmi(rng, [0, 90]),
              }
            : {}),
        })
        // et son ÉCRAN D'OMBRE : un pilier fin face à la lampe
        const versX = (R.minX + R.maxX) / 2 - lx
        const versY = midY - ly
        const dEcran = Math.hypot(versX, versY) || 1
        const ex2 = lx + (versX / dEcran) * entre(rng, 140, 220)
        const ey2 = ly + (versY / dEcran) * entre(rng, 140, 220)
        const angleEcran = Math.round(
          (Math.atan2(versY, versX) * 180) / Math.PI + 90 + entre(rng, -15, 15),
        )
        const wE = entre(rng, 44, 64)
        const hE = entre(rng, 150, 250)
        const rE: Rect = {
          minX: ex2 - wE / 2,
          minY: ey2 - hE / 2,
          maxX: ex2 + wE / 2,
          maxY: ey2 + hE / 2,
        }
        if (posePossible(rE)) {
          boxes.push({ ...rE, material: MAT_WALL, angle: angleEcran, skin: 3 })
        }
      } else {
        lumieres.push({
          x: Math.round((R.minX + R.maxX) / 2),
          y: Math.round(entre(rng, midY - demi * 0.3, midY + demi * 0.3)),
          intensite: Number(entre(rng, 0.85, 1.15).toFixed(2)),
        })
      }
    }
  }

  // ---- la CACHETTE : de préférence dans un CUL-DE-SAC (la voie qui ne
  // mène qu'à elle), sinon n'importe quelle salle ----
  const degres = new Map<number, number>()
  for (const cn of topo.conns) {
    degres.set(cn.a, (degres.get(cn.a) ?? 0) + 1)
    degres.set(cn.b, (degres.get(cn.b) ?? 0) + 1)
  }
  const culsDeSac = topo.salles
    .map((_, i) => i)
    .filter(
      (i) =>
        (degres.get(i) ?? 0) === 1 &&
        i !== topo.spawnSalle &&
        i !== topo.exitSalle,
    )
  const pCache = o.cachette === 1 ? 0 : o.cachette === 2 ? 1 : 0.55
  if (rng() < pCache) {
    for (let essai = 0; essai < (o.cachette === 2 ? 60 : 20); essai++) {
      const si =
        culsDeSac.length && rng() < 0.7
          ? parmi(rng, culsDeSac)
          : Math.floor(rng() * topo.salles.length)
      const R = rectDe(si)
      const w = entre(rng, 200, 280)
      const h = entre(rng, 200, 280)
      const enHaut = rng() < 0.5
      const cx = entre(rng, R.minX + w / 2 + 40, R.maxX - w / 2 - 40)
      const cy = enHaut ? R.maxY - h / 2 - 30 : R.minY + h / 2 + 30
      const r: Rect = {
        minX: cx - w / 2,
        minY: cy - h / 2,
        maxX: cx + w / 2,
        maxY: cy + h / 2,
      }
      let libre = true
      for (const res of reserves) if (chevauche(r, res)) libre = false
      if (!libre) continue
      caches.push({ ...r, ...(rng() < 0.5 ? { style: 'paroi' as const } : {}) })
      decals.push({
        x: cx,
        y: cy,
        w: 90,
        h: 70,
        kind: rng() < 0.5 ? 'fiole-pleine' : 'ecran-off',
        fade: 0.7,
      })
      break
    }
  }

  const nbEnigmes = preuves.length
  const nbVoies = topo.conns.length - (topo.salles.length - 1) // les boucles
  // l'IDENTITÉ : en mode atelier, le code porte la nomenclature ET la
  // variante (« G-101-K7 ») — retaper ce code redonne cette salle-là
  const suffixe = encodeOptions(o)
  const ident =
    (atelier
      ? `${atelier.cahier.moment}${atelier.cahier.mecanique}${atelier.cahier.difficulte}-${atelier.variante}`
      : (graine >>> 0).toString(36).toUpperCase()) +
    (suffixe ? `~${suffixe}` : '')
  const noms = [
    'La dérivation',
    'Le collecteur',
    'La travée',
    'Le carrefour',
    'La conduite',
    'Le compartiment',
    'La soute',
    'Le déversoir',
  ]
  const journal = atelier
    ? `Salle au cahier des charges ${atelier.cahier.moment}${atelier.cahier.mecanique}${atelier.cahier.difficulte} — ` +
      `${MOMENT_NOMS[atelier.cahier.moment]}, mécanique : ${MECANIQUE_NOMS[atelier.cahier.mecanique]}, ` +
      `difficulté ${atelier.cahier.difficulte}. Variante ${atelier.variante}, traversée démontrée par le traceur ` +
      `avant consignation. — Unité GÉN.`
    : `Plan tiré par le protocole génératif (graine ${ident}). ` +
      `La traversée a été démontrée par le traceur avant consignation : ` +
      `${topo.salles.length} compartiments, ${topo.conns.filter((c) => c.maillon !== 'libre').length} franchissements contraints` +
      `${nbVoies > 0 ? `, ${1 + nbVoies} voies` : ''}. — Unité GÉN.`
  const level: LevelDef = {
    name: `${parmi(rng, noms)} ${ident}`,
    code: `G-${ident}`,
    journal,
    bounds,
    spawn,
    exit,
    boxes,
    sponges: [],
    labels,
    ...(decals.length ? { decals } : {}),
    ...(lasers.length ? { lasers } : {}),
    ...(cibles.length ? { cibles } : {}),
    ...(portes.length ? { portes } : {}),
    ...(rails.length ? { rails } : {}),
    ...(caches.length ? { caches } : {}),
    lumieres,
    // la FIN de run s'assombrit ; le mode CONTRASTÉ éteint presque tout —
    // seules les lampes basses sculptent la salle
    ...(o.contraste === 1
      ? { ambiante: Number(entre(rng, 0.1, 0.16).toFixed(2)) }
      : atelier && atelier.cahier.moment > 1
        ? { ambiante: atelier.cahier.moment === 2 ? 0.46 : 0.4 }
        : {}),
    par:
      2 +
      3 * topo.conns.length +
      2 * nbEnigmes +
      (atelier ? atelier.cahier.difficulte : 0),
  }
  // la preuve se joue sur le niveau FINI (tout le décor posé)
  ;(level as LevelGen).__preuves = preuves

  // ---- l'ORIENTATION : le même squelette ne se lit pas toujours dans le
  // même sens. Un niveau sur quatre reste tel quel ; les autres se
  // retournent, se dressent, ou plongent — la transposition et le miroir
  // emportent TOUT : parois, mécanismes, faisceaux, rails, preuves. La
  // validation se joue après, sur la géométrie définitive.
  const orientation = Math.floor(rng() * 4)
  if (orientation & 2) transposeNiveau(level, preuves)
  if (orientation & 1) miroirXNiveau(level, preuves)
  return level
}

// ---- Les RETOURNEMENTS : x ↔ y (le niveau se dresse), et x → −x ---------
type Pt = { x: number; y: number }
const swapPt = (p: Pt): void => {
  const t = p.x
  p.x = p.y
  p.y = t
}
const swapRect = (r: Rect): void => {
  let t = r.minX
  r.minX = r.minY
  r.minY = t
  t = r.maxX
  r.maxX = r.maxY
  r.maxY = t
}

function transposeNiveau(level: LevelDef, preuves: PreuveDef[]): void {
  swapRect(level.bounds as Rect)
  for (const b of level.boxes) {
    swapRect(b)
    if (b.angle) b.angle = -b.angle // la réflexion sur la diagonale inverse le sens
  }
  swapPt(level.spawn)
  swapRect(level.exit)
  for (const l of level.labels) swapPt(l)
  for (const dcl of level.decals ?? []) {
    swapPt(dcl)
    const t = dcl.w
    dcl.w = dcl.h
    dcl.h = t
  }
  for (const em of level.lasers ?? []) {
    swapPt(em)
    em.angle = 90 - em.angle // (dx, dy) → (dy, dx)
  }
  for (const c of level.cibles ?? []) swapPt(c)
  for (const p of level.portes ?? []) swapRect(p)
  for (const r of level.rails ?? []) for (const pt of r.points) swapPt(pt)
  for (const c of level.caches ?? []) {
    swapRect(c)
    if (c.angle) c.angle = -c.angle
  }
  for (const lum of level.lumieres ?? []) {
    swapPt(lum)
    if (lum.forme === 'bandeau') lum.angle = 90 - (lum.angle ?? 0)
  }
  for (const p of preuves) {
    swapPt(p.spot)
    const t = p.normale.nx
    p.normale.nx = p.normale.ny
    p.normale.ny = t
    // p.emetteur et la pastille sont les MÊMES objets que dans le niveau :
    // déjà retournés ci-dessus
  }
}

function miroirXNiveau(level: LevelDef, preuves: PreuveDef[]): void {
  const flipRect = (r: Rect): void => {
    const t = r.minX
    r.minX = -r.maxX
    r.maxX = -t
  }
  flipRect(level.bounds as Rect)
  for (const b of level.boxes) {
    flipRect(b)
    if (b.angle) b.angle = -b.angle
  }
  level.spawn.x = -level.spawn.x
  flipRect(level.exit)
  for (const l of level.labels) l.x = -l.x
  for (const dcl of level.decals ?? []) dcl.x = -dcl.x
  for (const em of level.lasers ?? []) {
    em.x = -em.x
    em.angle = 180 - em.angle // (dx, dy) → (−dx, dy)
  }
  for (const c of level.cibles ?? []) c.x = -c.x
  for (const p of level.portes ?? []) flipRect(p)
  for (const r of level.rails ?? []) for (const pt of r.points) pt.x = -pt.x
  for (const c of level.caches ?? []) {
    flipRect(c)
    if (c.angle) c.angle = -c.angle
  }
  for (const lum of level.lumieres ?? []) {
    lum.x = -lum.x
    if (lum.forme === 'bandeau') lum.angle = 180 - (lum.angle ?? 0)
  }
  for (const p of preuves) {
    p.spot.x = -p.spot.x
    p.normale.nx = -p.normale.nx
  }
}

// ---- LES CORPS SYNTHÉTIQUES : le vrai traceur, un corps posé pour lui ----
// La preuve rejoue l'idée du joueur : un disque de GLACE au flanc à 45°
// (le corps gelé sous le fil du faisceau), un NUAGE de vapeur ionisant, ou
// une flaque d'EAU-lentille (la traversée qui plie le faisceau). Le traceur
// est celui du jeu — la preuve et la partie parlent la même optique.
const N45 = Math.SQRT1_2

interface CorpsSynthetiques {
  glace?: { x: number; y: number; nx: number; ny: number } // le flanc et sa normale
  vapeur?: { x: number; y: number }
  eau?: { x: number; y: number }
}

function traceSynthetique(
  level: LevelDef,
  em: LaserDef,
  corps: CorpsSynthetiques,
): number[] {
  const monde: TraceMonde = {
    bounds: level.bounds,
    boxes: level.boxes,
    // TOUTES les portes fermées : la preuve se joue avant toute ouverture
    portesFermees: level.portes ?? [],
    cibles: (level.cibles ?? []).map((c) => ({ x: c.x, y: c.y, r: c.r })),
    iceNormal: corps.glace
      ? (x, y) => {
          const dx = x - corps.glace!.x
          const dy = y - corps.glace!.y
          return dx * dx + dy * dy <= 44 * 44
            ? { nx: corps.glace!.nx, ny: corps.glace!.ny }
            : null
        }
      : null,
    eau: corps.eau
      ? {
          dedans: (x, y) => {
            const dx = x - corps.eau!.x
            const dy = y - corps.eau!.y
            return dx * dx + dy * dy <= 40 * 40
          },
          normale: (x, y) => {
            const dx = x - corps.eau!.x
            const dy = y - corps.eau!.y
            const d = Math.hypot(dx, dy) || 1
            return { nx: dx / d, ny: dy / d }
          },
        }
      : null,
    vapeur: corps.vapeur
      ? (x, y) => {
          const dx = x - corps.vapeur!.x
          const dy = y - corps.vapeur!.y
          return dx * dx + dy * dy <= 44 * 44
        }
      : null,
    rails: level.rails ?? [],
  }
  return traceLaser(em, monde).touchees
}

/** L'énigme du MIROIR : sans glace la pastille du canal reste éteinte,
 * avec un corps gelé au point prévu (flanc à la normale donnée — 45°
 * haut-droit par défaut, le montage historique) elle s'allume. */
export function prouveMiroir(
  level: LevelDef,
  emetteur: LaserDef,
  miroir: { x: number; y: number },
  canal: number,
  normale: { nx: number; ny: number } = { nx: N45, ny: N45 },
): { sansGlace: boolean; avecGlace: boolean } {
  const duCanal = (touchees: number[]): boolean =>
    touchees.some((c) => ((level.cibles ?? [])[c]?.canal ?? c + 1) === canal)
  return {
    sansGlace: duCanal(traceSynthetique(level, emetteur, {})),
    avecGlace: duCanal(
      traceSynthetique(level, emetteur, {
        glace: { x: miroir.x, y: miroir.y, nx: normale.nx, ny: normale.ny },
      }),
    ),
  }
}

/** L'énigme du PLASMA : sans nuage le rail est muet, avec un corps en
 * vapeur au point marqué l'arc suit le rail et allume la pastille. */
export function prouvePlasma(
  level: LevelDef,
  emetteur: LaserDef,
  nuage: { x: number; y: number },
  canal: number,
): { sansVapeur: boolean; avecVapeur: boolean } {
  const duCanal = (touchees: number[]): boolean =>
    touchees.some((c) => ((level.cibles ?? [])[c]?.canal ?? c + 1) === canal)
  return {
    sansVapeur: duCanal(traceSynthetique(level, emetteur, {})),
    avecVapeur: duCanal(traceSynthetique(level, emetteur, { vapeur: nuage })),
  }
}

/** La BARRIÈRE TENUE : le faisceau tient sa pastille d'office ; la
 * traversée en VAPEUR ne le coupe pas ; la traversée en EAU le plie et le
 * coupe — c'est toute l'énigme. La flaque d'essai est décalée
 * PERPENDICULAIREMENT au faisceau (quel que soit son sens) : c'est le
 * flanc de la goutte qui plie la lumière, pas son cœur. */
export function prouveBarriere(
  level: LevelDef,
  emetteur: LaserDef,
  croisement: { x: number; y: number },
  canal: number,
): { directe: boolean; enVapeur: boolean; enEau: boolean } {
  const duCanal = (touchees: number[]): boolean =>
    touchees.some((c) => ((level.cibles ?? [])[c]?.canal ?? c + 1) === canal)
  const a = (emetteur.angle * Math.PI) / 180
  const perp = { x: -Math.sin(a), y: Math.cos(a) }
  return {
    directe: duCanal(traceSynthetique(level, emetteur, {})),
    enVapeur: duCanal(
      traceSynthetique(level, emetteur, { vapeur: croisement }),
    ),
    enEau: duCanal(
      traceSynthetique(level, emetteur, {
        eau: { x: croisement.x + perp.x * 24, y: croisement.y + perp.y * 24 },
      }),
    ),
  }
}

// ---- L'ACCESSIBILITÉ : parcours en largeur avec la marge du corps --------
// Les surfaces à état (évent, rideau, membrane) comptent passantes : un état
// du corps les traverse, et l'état se choisit librement. Les portes PROUVÉES
// ouvrables comptent ouvertes ; les autres, murées.
export function accessible(
  level: LevelDef,
  portesOuvrables: Set<number>,
): boolean {
  const b = level.bounds
  const pas = PAS_GRILLE_VALID
  const cols = Math.floor((b.maxX - b.minX) / pas)
  const rows = Math.floor((b.maxY - b.minY) / pas)
  if (cols < 2 || rows < 2) return false
  const solides: Rect[] = []
  // les pièces à FORME (disque, capsule, coin, arc) se jugent au champ de
  // distance exact : la boîte englobante d'un anneau est presque toute
  // vide, la prendre pleine condamnerait les figures — le SDF est la
  // vérité du solveur comme du rendu. Les rectangles gardent le chemin
  // rapide historique (boîte vraie, prudente pour les pivotés).
  const formes: ObstacleBox[] = []
  for (const box of level.boxes) {
    if (
      box.material === MAT_GRILLE ||
      box.material === MAT_MEMBRANE ||
      box.material === MAT_RIDEAU
    )
      continue
    if ((box.forme ?? FORME_RECT) !== FORME_RECT) {
      formes.push(box)
      continue
    }
    // une forme tient DANS sa boîte englobante, et une pièce PIVOTÉE
    // déborde de la sienne : la validation voit la boîte vraie — prudente,
    // jamais laxiste, pour la traversée
    solides.push(aabbVraie(box))
  }
  for (const p of level.portes ?? []) {
    if (!portesOuvrables.has(p.canal)) solides.push(p)
  }
  const gonfles = solides.map((r) => gonfle(r, MARGE_CORPS))
  const aabbsFormes = formes.map((f) => gonfle(aabbVraie(f), MARGE_CORPS))
  const contactScratch = { dist: 0, nx: 0, ny: 1 }
  const bloque = (x: number, y: number): boolean => {
    if (
      x < b.minX + MARGE_CORPS ||
      x > b.maxX - MARGE_CORPS ||
      y < b.minY + MARGE_CORPS ||
      y > b.maxY - MARGE_CORPS
    )
      return true
    for (const r of gonfles)
      if (x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY) return true
    for (let i = 0; i < formes.length; i++) {
      const a = aabbsFormes[i]
      if (x < a.minX || x > a.maxX || y < a.minY || y > a.maxY) continue
      if (dansForme(formes[i], x, y)) return true
      formeContact(x, y, formes[i], contactScratch)
      if (contactScratch.dist <= MARGE_CORPS) return true
    }
    return false
  }
  const idx = (c: number, l: number): number => l * cols + c
  const vu = new Uint8Array(cols * rows)
  const cellDe = (x: number, y: number): [number, number] => [
    Math.max(0, Math.min(cols - 1, Math.floor((x - b.minX) / pas))),
    Math.max(0, Math.min(rows - 1, Math.floor((y - b.minY) / pas))),
  ]
  const [sc, sl] = cellDe(level.spawn.x, level.spawn.y)
  const file: number[] = []
  if (bloque(b.minX + (sc + 0.5) * pas, b.minY + (sl + 0.5) * pas)) return false
  vu[idx(sc, sl)] = 1
  file.push(idx(sc, sl))
  const ex = level.exit
  while (file.length > 0) {
    const cur = file.pop()!
    const c = cur % cols
    const l = Math.floor(cur / cols)
    const x = b.minX + (c + 0.5) * pas
    const y = b.minY + (l + 0.5) * pas
    if (
      x >= ex.minX - pas &&
      x <= ex.maxX + pas &&
      y >= ex.minY - pas &&
      y <= ex.maxY + pas
    )
      return true
    const voisins: [number, number][] = [
      [c - 1, l],
      [c + 1, l],
      [c, l - 1],
      [c, l + 1],
    ]
    for (const [nc, nl] of voisins) {
      if (nc < 0 || nc >= cols || nl < 0 || nl >= rows) continue
      const ni = idx(nc, nl)
      if (vu[ni]) continue
      const nx = b.minX + (nc + 0.5) * pas
      const ny = b.minY + (nl + 0.5) * pas
      if (bloque(nx, ny)) continue
      vu[ni] = 1
      file.push(ni)
    }
  }
  return false
}

// ---- LE VERDICT : un niveau généré est bon, ou il n'existe pas -----------
export interface VerdictGen {
  valide: boolean
  raisons: string[]
}

export function valideNiveau(level: LevelDef): VerdictGen {
  const raisons: string[] = []
  const erreurs = checkLevel(level).filter((v) => v.niveau === 'erreur')
  for (const e of erreurs) raisons.push(`éditeur : ${e.message}`)
  const preuves = (level as LevelGen).__preuves ?? []

  // L'ÉTAT DE BASE : chaque émetteur tracé sans corps. Seules les pastilles
  // des barrières NOR ont le droit d'être allumées d'office — toute autre
  // pastille allumée sans le joueur est une énigme morte (allumage croisé).
  const norIndex = new Set(
    preuves.filter((p) => p.kind === 'nor').map((p) => p.cibleIndex),
  )
  const baseParEmetteur = new Map<LaserDef, Set<number>>()
  for (const em of level.lasers ?? []) {
    const touchees = new Set(traceSynthetique(level, em, {}))
    baseParEmetteur.set(em, touchees)
    for (const t of touchees) {
      if (!norIndex.has(t))
        raisons.push(
          `pastille ${t + 1} allumée sans le joueur (allumage croisé) — l'énigme est morte`,
        )
    }
  }

  // chaque preuve, dans les termes de son énigme
  const canauxProuves = new Map<number, number>() // canal → preuves réussies
  const attendus = new Map<number, number>() // canal → preuves exigées
  for (const p of preuves)
    attendus.set(p.canal, (attendus.get(p.canal) ?? 0) + 1)
  for (const p of preuves) {
    const base = baseParEmetteur.get(p.emetteur) ?? new Set()
    let ok = false
    if (p.kind === 'miroir') {
      const avec = traceSynthetique(level, p.emetteur, {
        glace: { x: p.spot.x, y: p.spot.y, nx: p.normale.nx, ny: p.normale.ny },
      })
      if (base.has(p.cibleIndex))
        raisons.push(`canal ${p.canal} : la pastille s'allume sans miroir`)
      else if (!avec.includes(p.cibleIndex))
        raisons.push(
          `canal ${p.canal} : le reflet du miroir n'allume pas la pastille`,
        )
      else {
        // le miroir ne doit servir QUE sa pastille : allumer la jumelle
        // d'un canal ET depuis le même point trivialiserait l'énigme
        const autres = preuves.filter((q) => q !== p && q.canal === p.canal)
        ok = autres.every((q) => !avec.includes(q.cibleIndex))
        if (!ok)
          raisons.push(
            `canal ${p.canal} : un seul miroir allume les deux pastilles`,
          )
      }
    } else if (p.kind === 'rail') {
      const avec = traceSynthetique(level, p.emetteur, { vapeur: p.spot })
      if (base.has(p.cibleIndex))
        raisons.push(`canal ${p.canal} : la pastille s'allume sans nuage`)
      else if (!avec.includes(p.cibleIndex))
        raisons.push(`canal ${p.canal} : l'arc guidé n'atteint pas la pastille`)
      else ok = true
    } else {
      // nor : allumée d'office, la vapeur ne coupe pas, l'eau coupe —
      // la flaque d'essai décalée perpendiculairement au faisceau
      const aB = (p.emetteur.angle * Math.PI) / 180
      const perpB = { x: -Math.sin(aB), y: Math.cos(aB) }
      const enVapeur = traceSynthetique(level, p.emetteur, { vapeur: p.spot })
      const enEau = traceSynthetique(level, p.emetteur, {
        eau: { x: p.spot.x + perpB.x * 24, y: p.spot.y + perpB.y * 24 },
      })
      if (!base.has(p.cibleIndex))
        raisons.push(`canal ${p.canal} : la barrière n'atteint pas sa pastille`)
      else if (!enVapeur.includes(p.cibleIndex))
        raisons.push(
          `canal ${p.canal} : la traversée en vapeur coupe la barrière`,
        )
      else if (enEau.includes(p.cibleIndex))
        raisons.push(
          `canal ${p.canal} : l'eau ne plie pas le faisceau — la barrière ne punit rien`,
        )
      else ok = true
    }
    if (ok) canauxProuves.set(p.canal, (canauxProuves.get(p.canal) ?? 0) + 1)
  }
  const ouvrables = new Set<number>()
  for (const [canal, n] of attendus)
    if ((canauxProuves.get(canal) ?? 0) === n) ouvrables.add(canal)
  // une porte sans preuve n'est jamais ouvrable : elle doit ne pas exister
  for (const porte of level.portes ?? []) {
    if (!attendus.has(porte.canal))
      raisons.push(`canal ${porte.canal} : porte sans énigme prouvée`)
  }
  if (raisons.length === 0 && !accessible(level, ouvrables))
    raisons.push('le sas est inaccessible avec la marge du corps')
  return { valide: raisons.length === 0, raisons }
}

// ---- L'ENTRÉE : graine → salle prouvée ----------------------------------
// Un tirage raté n'est pas une erreur, c'est un tirage : on re-tire (avec
// une sous-graine dérivée, pour rester déterministe) jusqu'à la preuve —
// et l'on abandonne au-delà de 60 essais, ce qui ne s'observe pas en
// pratique (les tests le tiennent à l'œil).
export function genereNiveauDetaille(
  graine: number,
  atelier: Atelier | null = null,
  options: OptionsGen = OPTIONS_DEFAUT,
): { niveau: LevelDef; preuves: PreuveDef[] } {
  for (let essai = 0; essai < 60; essai++) {
    const rng = creeRng((graine >>> 0) + essai * 0x9e3779b9)
    const niveau = essaieNiveau(graine, rng, atelier, options)
    if (valideNiveau(niveau).valide) {
      const preuves = (niveau as LevelGen).__preuves ?? []
      delete (niveau as LevelGen).__preuves
      return { niveau, preuves }
    }
  }
  throw new Error(`générateur : aucune salle prouvée pour la graine ${graine}`)
}

export function genereNiveau(
  graine: number,
  atelier: Atelier | null = null,
  options: OptionsGen = OPTIONS_DEFAUT,
): LevelDef {
  return genereNiveauDetaille(graine, atelier, options).niveau
}

/** Une salle AU CODE ATELIER : « 101 » est le cahier des charges, la
 * variante fait l'identité — le couple (et les options) redonne toujours
 * la même salle. */
export function genereNiveauAtelier(
  cahier: CodeAtelier,
  variante: string,
  options: OptionsGen = OPTIONS_DEFAUT,
): LevelDef {
  const nue = variante.trim().toUpperCase()
  return genereNiveau(
    graineAtelier(cahier, nue),
    { cahier, variante: nue },
    options,
  )
}

/** Une graine de partage lisible (base 36) → nombre, et retour. */
export function graineDepuisTexte(txt: string): number | null {
  const nu = txt.trim().toUpperCase()
  if (!/^[0-9A-Z]{1,7}$/.test(nu)) return null
  const n = parseInt(nu, 36)
  return Number.isFinite(n) ? n >>> 0 : null
}
