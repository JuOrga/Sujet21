// LA MINI-CARTE À VOIES d'un module : ce que la descente propose ENTRE deux
// ouvertures de la carte de la station.
//
// Jusqu'ici, chaque salle d'un module se choisissait parmi trois cartes
// tirées au rang, sans lien d'un rang à l'autre : trois portes, puis trois
// autres. Slay the Spire fait autrement — un acte est une grille de voies
// qui s'entrecroisent, et choisir un nœud FERME les autres : on planifie
// deux ou trois coups, pas un. Ici, un module de N salles se tisse en N
// rangs sur trois voies. Chaque nœud est une salle décidée d'avance (sa
// mécanique, figure ou compartiments, tableau du pool ou générée) et ne
// mène qu'à un ou deux nœuds du rang suivant. La salle elle-même ne se
// FABRIQUE qu'au moment d'ouvrir la porte (main.ts, propositionsVoie) :
// ici on ne décide que le plan, comme le tirage à blanc de descente.ts.
//
// LE TISSAGE EST REPRODUCTIBLE : il part d'une graine (la descente du jour
// en donne une par module, la même pour tous les postes ; sinon le poste
// en tire une à l'entrée) et se retisse à l'identique depuis la sauvegarde.
// Tout ici est pur : aucun DOM, aucun état.

import type { CodeAtelier } from './levelIO'
import { figuresDuChoix, mecaniquesDuChoix } from './voie'

/** Le nombre de voies d'un module — trois, comme les trois portes d'avant. */
export const VOIES = 3

/** LES RÉGLAGES DU TISSAGE — ceux du plan (voie.ts), rapportés en parts.
 *  Six salles de suite, c'est six fois le même geste : une part des nœuds
 *  n'est donc pas une salle mais une RENCONTRE (evenements.ts) — du texte,
 *  un choix, un prix. Le joueur peut toujours l'éviter en prenant une autre
 *  voie : c'est ce qui en fait un choix et non une interruption. Le
 *  concepteur règle la part au banc — « trop de points d'interrogation »
 *  (revue du 16/09) se corrige là, pas dans le code. */
export interface ReglagesTissage {
  /** la part de rencontres parmi les nœuds éligibles (0..1) */
  partEvenement: number
  /** le premier rang où une rencontre ou une halte peut se poser */
  rangMin: number
  /** la chance qu'une voie bifurque aussi vers une voisine (0..1) */
  bifurcation: number
  /** LES HALTES du module : combien d'économats, d'alcôves, de bonbonnes ;
   *  et la cache, si le module recèle un orbe (c'est la carte qui le dit) */
  economats: number
  repos: number
  dons: number
  coffre: boolean
  /** LES MINI-JEUX par module (le couperet…) : des salles où la physique est le
   *  jeu, posées comme des haltes — un nœud, une porte, une salle construite */
  minijeux: number
  /** LE BIOME PÈSE : la mécanique que le biome du module favorise (la
   *  carte le dit — la glace en cryo, la vapeur en chaud), null sans ;
   *  `partFavori` (0..1) : la chance qu'une voie la prenne. Jamais les
   *  trois voies d'un rang : il reste toujours une autre mécanique à jouer.
   *  C'est ce qui donne au choix d'une voie sur la grande carte un sens
   *  de jeu — « ma glace servira là » — et pas seulement un décor. */
  favori: CodeAtelier['mecanique'] | null
  partFavori: number
  /** LA PART DES RANGS À PRIME (0..1) : la chance qu'un rang porte une salle
   *  à prime — une seule par rang, jamais sous rangMin, jamais sur une
   *  rencontre ni une halte */
  partPrime: number
  /** LE DERNIER RANG N'EST QUE SALLES : ni rencontre ni halte. Pour le
   *  module OBJECTIF, c'est vital — l'expédition ne se boucle qu'au sas de
   *  sa dernière salle ; une rencontre ou une halte au dernier rang menait
   *  à une carte sans coursive, la run ne finissait jamais (revue du 16/09). */
  dernierRangSalles: boolean
}
/** LA PART DE CROISEMENT (0..1) : un X entre deux voies voisines ne se
 *  dessine que si ses deux bifurcations tombent sous `bifurcation × part`.
 *  ZÉRO : aucun X. Une demi-mesure (0,7 : un X sur deux, 25/09) laissait
 *  le défaut en place, en plus rare — et une carte où l'on suit sa voie du
 *  doigt ne se lit que si les traits ne se coupent JAMAIS (Slay the Spire
 *  n'en a aucun). Un X n'apportait presque rien au choix : les fourches et
 *  les jonctions gardent les deux cases du rang suivant joignables. */
export const PART_CROISEMENT = 0

export const TISSAGE_DEFAUT: ReglagesTissage = {
  partEvenement: 0.2,
  rangMin: 1,
  bifurcation: 0.45,
  economats: 1,
  repos: 1,
  dons: 0,
  coffre: false,
  minijeux: 1,
  favori: null,
  partFavori: 0,
  partPrime: 0.15,
  dernierRangSalles: false,
}

/** La nature d'un nœud : une salle à jouer, une rencontre à traverser, ou
 *  une HALTE — l'économat, l'alcôve de repos, la bonbonne oubliée, la cache
 *  à orbe. Le concepteur a tranché (16/09) : les haltes vivent dans la
 *  mini-carte, jamais sur la grande carte, qui ne montre que des biomes. */
export type NatureNoeud = 'salle' | 'evenement' | 'economat' | 'repos' | 'don' | 'coffre' | 'minijeu'

/** LA PRIME D'UN NŒUD : une salle « scellée », plus dure d'un cran, qui
 *  paie plus au sas — la mémoire double, le condensat double, ou un tirage
 *  d'instrument garanti. C'est l'élite de Slay the Spire à l'échelle du
 *  nœud : deux voies au même rang se distinguent par ce qu'on en tire, pas
 *  seulement par ce qu'on y joue (le concepteur, 16/09 : « les portes se
 *  distinguent par type, pas par gain »). Au plus une par rang : c'est un
 *  choix de voie. */
export type PrimeNoeud = 'memoire' | 'condensat' | 'tirage'
export const PRIMES: readonly PrimeNoeud[] = ['memoire', 'condensat', 'tirage']
export const NOMS_PRIME: Record<PrimeNoeud, string> = {
  memoire: 'mémoire ×2',
  condensat: 'condensat ×2',
  tirage: 'tirage garanti',
}
export const HALTES_NOEUD: readonly NatureNoeud[] = ['economat', 'repos', 'don', 'coffre', 'minijeu']

export interface NoeudVoie {
  /** la salle du module, 0-based */
  rang: number
  /** la voie, 0-based */
  voie: number
  mecanique: CodeAtelier['mecanique']
  /** la porte sera une FIGURE (si une famille est éligible au moment) */
  figure: boolean
  /** la porte est un TABLEAU DU POOL — pioché à l'ouverture ; à défaut, générée */
  ecrite: boolean
  /** salle à jouer, ou ÉVÉNEMENT (aucune salle : un écran, un choix) */
  nature: NatureNoeud
  /** la PRIME de la salle — plus dure d'un cran, elle paie plus ; null : aucune */
  prime: PrimeNoeud | null
  /** les voies joignables au rang suivant (vide au dernier rang) */
  suivants: number[]
}

export interface MiniCarte {
  voies: number
  /** rangs[r][v] : le nœud de la voie v au rang r */
  rangs: NoeudVoie[][]
}

/** TISSER la mini-carte d'un module de `niveaux` salles.
 *  · `permises` — les mécaniques que les mémoires tissées autorisent ;
 *  · `momentAuRang(r)` — le moment du plan pour la r-ième salle du module
 *    (le module peut chevaucher deux tiers de la descente) ;
 *  · `figures` — combien des trois voies sont des figures, au début et
 *    ensuite (le réglage du plan) ;
 *  · `ecrites` — une voie par rang porte un tableau du pool.
 *  Chaque nœud mène au moins à sa propre voie au rang suivant, et à une
 *  voisine une fois sur deux environ : tout nœud a un successeur, tout nœud
 *  d'un rang suivant a un prédécesseur — aucune voie morte. */
export function tisseMiniCarte(
  niveaux: number,
  alea: () => number,
  permises: readonly CodeAtelier['mecanique'][],
  momentAuRang: (rang: number) => CodeAtelier['moment'],
  figures: { debut: number; suite: number },
  ecrites: boolean,
  reglages: ReglagesTissage = TISSAGE_DEFAUT,
): MiniCarte {
  const n = Math.max(0, Math.floor(niveaux))
  const part = Math.max(0, Math.min(1, reglages.partEvenement))
  const bif = Math.max(0, Math.min(1, reglages.bifurcation))
  const rangMin = Math.max(0, Math.floor(reglages.rangMin))
  const favori = reglages.favori !== null && permises.includes(reglages.favori) ? reglages.favori : null
  const partFavori = Math.max(0, Math.min(1, reglages.partFavori))
  const rangs: NoeudVoie[][] = []
  for (let r = 0; r < n; r++) {
    const mecaniques = [...mecaniquesDuChoix(null, alea, null, permises)]
    // LE BIOME PÈSE : chaque voie tire (TOUJOURS, pour que la graine reste
    // alignée quel que soit le réglage), et prend la mécanique favorite si
    // le tirage tombe sous la part — sauf la dernière voie qui ne la porte
    // pas encore : un rang garde toujours une autre mécanique
    for (let v = 0; v < VOIES; v++) {
      const t = alea()
      if (favori === null || t >= partFavori || mecaniques[v] === favori) continue
      if (mecaniques.filter((x) => x !== favori).length <= 1) continue
      mecaniques[v] = favori
    }
    const modes = figuresDuChoix(momentAuRang(r), alea, figures.debut, figures.suite)
    // LA VOIE DU POOL se tire TOUJOURS (la graine reste alignée), mais se
    // pose parmi les voies qui sont des salles : une rencontre n'a pas de
    // tableau, et « une voie du pool par rang » doit être tenu — tirée sur
    // une rencontre, elle disparaissait du rang
    const tEcrite = alea()
    // LES NŒUDS ÉVÉNEMENT. Le tirage se fait à CHAQUE rang, le premier
    // compris, pour que la graine reste alignée quel que soit le réglage —
    // mais les rangs sous `rangMin` n'en portent jamais (on entre dans un
    // biome par une salle, sinon le module ne se présente pas), et jamais
    // les TROIS d'un rang : il doit toujours rester une voie qui se joue.
    const evs = [0, 1, 2].map(() => alea() < part)
    if (r < rangMin || evs.every(Boolean)) evs[0] = false
    if (r < rangMin) evs[1] = evs[2] = false
    // le dernier rang d'un module qui doit se boucler au sas : des salles
    if (reglages.dernierRangSalles && r === n - 1) evs[0] = evs[1] = evs[2] = false
    const voiesSalle = [0, 1, 2].filter((v) => !evs[v])
    const voieEcrite = ecrites ? voiesSalle[Math.min(voiesSalle.length - 1, Math.floor(tEcrite * voiesSalle.length))] : -1
    // la voie continue tout droit, et bifurque vers une voisine une fois
    // sur deux environ — les tirages se font TOUJOURS, même au bord, dans
    // l'ordre d'avant (gauche puis droite, voie par voie ; aucun au dernier
    // rang), pour que la graine reste alignée quel que soit le tracé
    const tG: number[] = []
    const tD: number[] = []
    if (r < n - 1)
      for (let v = 0; v < VOIES; v++) {
        tG.push(alea())
        tD.push(alea())
      }
    const va = (v: number, cote: 'g' | 'd'): boolean =>
      r < n - 1 && (cote === 'g' ? v > 0 && tG[v] < bif : v < VOIES - 1 && tD[v] < bif)
    // PAS DE CROISEMENT. Deux voisines qui bifurquent l'une vers l'autre
    // dessinent un X : à 45 % de bifurcation, il y en avait deux par module
    // de six salles, et la mini-carte se lisait comme un tressage où l'on
    // ne suivait plus sa voie (le concepteur, 25/09). Le X se défait : la
    // branche au tirage le plus haut (la moins « voulue ») tombe, sauf si
    // PART_CROISEMENT l'autorise. Aucun tirage de plus : la graine reste
    // alignée.
    const coupe = { g: new Set<number>(), d: new Set<number>() }
    for (let v = 0; v < VOIES - 1; v++) {
      if (!va(v, 'd') || !va(v + 1, 'g')) continue
      const seuil = bif * PART_CROISEMENT
      if (tD[v] < seuil && tG[v + 1] < seuil) continue
      if (tD[v] >= tG[v + 1]) coupe.d.add(v)
      else coupe.g.add(v + 1)
    }
    const rang: NoeudVoie[] = []
    for (let v = 0; v < VOIES; v++) {
      const suivants: number[] = []
      if (r < n - 1) {
        if (va(v, 'g') && !coupe.g.has(v)) suivants.push(v - 1)
        suivants.push(v)
        if (va(v, 'd') && !coupe.d.has(v)) suivants.push(v + 1)
      }
      rang.push({
        rang: r,
        voie: v,
        mecanique: mecaniques[v] ?? mecaniques[0],
        figure: modes[v] ?? false,
        // un nœud événement n'a pas de tableau : il n'a pas de salle
        ecrite: v === voieEcrite && !evs[v],
        nature: evs[v] ? 'evenement' : 'salle',
        prime: null,
        suivants,
      })
    }
    // LA PRIME DU RANG : trois tirages, TOUJOURS (la graine reste alignée
    // quel que soit le réglage) — le rang en porte-t-il une, sur quelle
    // voie, laquelle. Jamais sous rangMin, jamais sur une rencontre ; une
    // halte posée ensuite l'efface (une halte n'a pas de sas).
    const tp = alea()
    const tv = alea()
    const tf = alea()
    if (r >= rangMin && tp < Math.max(0, Math.min(1, reglages.partPrime))) {
      const salles = rang.filter((nd) => nd.nature === 'salle')
      if (salles.length > 0)
        salles[Math.min(salles.length - 1, Math.floor(tv * salles.length))].prime =
          PRIMES[Math.min(PRIMES.length - 1, Math.floor(tf * PRIMES.length))]
    }
    rangs.push(rang)
  }
  // LES HALTES SE POSENT APRÈS : sur des nœuds « salle » des rangs
  // éligibles, jamais deux sur le même nœud, et jamais au prix de la
  // dernière salle d'un rang — il reste toujours une voie qui se joue. Le
  // tirage consomme toujours le même nombre d'aléas par halte demandée,
  // pour que la graine reste alignée quel que soit le réglage.
  const demandes: NatureNoeud[] = [
    ...Array<NatureNoeud>(Math.max(0, Math.floor(reglages.economats))).fill('economat'),
    ...Array<NatureNoeud>(Math.max(0, Math.floor(reglages.repos))).fill('repos'),
    ...Array<NatureNoeud>(Math.max(0, Math.floor(reglages.dons))).fill('don'),
    ...(reglages.coffre ? (['coffre'] as NatureNoeud[]) : []),
    ...Array<NatureNoeud>(Math.max(0, Math.floor(reglages.minijeux))).fill('minijeu'),
  ]
  for (const nature of demandes) {
    const tirage = alea()
    const libres = (nature: NatureNoeud): NoeudVoie[] =>
      rangs
        .flat()
        .filter(
          (nd) =>
            nd.rang >= rangMin &&
            nd.nature === nature &&
            // jamais au dernier rang d'un module qui se boucle au sas
            !(reglages.dernierRangSalles && nd.rang === n - 1) &&
            // remplacer une salle doit en laisser une ; remplacer une rencontre n'en coûte aucune
            rangs[nd.rang].filter((x) => x.nature === 'salle').length > (nature === 'salle' ? 1 : 0),
        )
    // une halte prend d'abord la place d'une salle QUI N'EST PAS LA VOIE DU
    // POOL (« une voie du pool par rang » se tient — la halte effaçait la
    // seule porte écrite du rang, revue du 16/09), puis celle du pool s'il
    // ne reste qu'elle ; quand les rencontres ont tout pris, elle prend
    // celle d'une rencontre — la halte est promise par le plan, la
    // rencontre n'est qu'un tirage
    const sallesLibres = libres('salle')
    const sansPool = sallesLibres.filter((nd) => !nd.ecrite)
    const candidats = sansPool.length > 0 ? sansPool : sallesLibres.length > 0 ? sallesLibres : libres('evenement')
    if (candidats.length === 0) continue
    const nd = candidats[Math.min(candidats.length - 1, Math.floor(tirage * candidats.length))]
    nd.nature = nature
    nd.ecrite = false
    nd.prime = null // une halte n'a pas de sas : rien à primer
  }
  return { voies: VOIES, rangs }
}

/** CE QU'ON TROUVERA dans le module, par ses types — pas les comptes. C'est
 *  ce que le survol d'un module dit sur la grande carte (le concepteur,
 *  16/09 : « juste ce qu'il y aura en type, pas forcément le nombre »). Dans
 *  l'ordre où le joueur les lit : les mécaniques des salles, puis les
 *  formes, puis les rencontres et les haltes. */
export function typesDuModule(mc: MiniCarte): string[] {
  const noeuds = mc.rangs.flat()
  const out: string[] = []
  const salles = noeuds.filter((n) => n.nature === 'salle')
  const meca = ['eau', 'glace', 'vapeur', 'toutes mécaniques'] as const
  for (let m = 0; m < 4; m++) if (salles.some((n) => n.mecanique === m && !n.ecrite)) out.push(meca[m])
  if (salles.some((n) => n.figure && !n.ecrite)) out.push('figures')
  if (salles.some((n) => n.ecrite)) out.push('tableau du pool')
  if (salles.some((n) => n.prime)) out.push('salle à prime')
  if (noeuds.some((n) => n.nature === 'evenement')) out.push('rencontre')
  if (noeuds.some((n) => n.nature === 'economat')) out.push('économat')
  if (noeuds.some((n) => n.nature === 'repos')) out.push('alcôve')
  if (noeuds.some((n) => n.nature === 'don')) out.push('bonbonne')
  if (noeuds.some((n) => n.nature === 'coffre')) out.push('cache')
  if (noeuds.some((n) => n.nature === 'minijeu')) out.push('mini-jeu')
  return out
}

/** LES PORTES du rang : les nœuds qu'on peut ouvrir. Au premier rang, les
 *  trois voies ; ensuite, seules celles que le nœud d'où l'on vient
 *  annonce. Une voie d'origine inconnue (sauvegarde d'avant les voies)
 *  rouvre les trois : jamais une run sans porte. */
export function portesDuRang(mc: MiniCarte, rang: number, voieDOuLOnVient: number | null): NoeudVoie[] {
  const noeuds = mc.rangs[rang]
  if (!noeuds) return []
  if (rang === 0 || voieDOuLOnVient === null) return [...noeuds]
  const avant = mc.rangs[rang - 1]?.[voieDOuLOnVient]
  if (!avant) return [...noeuds]
  return noeuds.filter((x) => avant.suivants.includes(x.voie))
}

/** LE REPÈRE D'UNE VOIE, le même sur la porte et sur la mini-carte : la
 *  porte disait « PORTE 2 » et « VOIE 3 » à la fois, la mini-carte ne
 *  numérotait rien — le joueur faisait la correspondance de tête. Une
 *  flèche vers le haut pour la voie du haut : le signe dit la place. */
export const REPERES_VOIE: readonly { signe: string; nom: string }[] = [
  { signe: '▲', nom: 'HAUT' },
  { signe: '●', nom: 'MILIEU' },
  { signe: '▼', nom: 'BAS' },
]

/** CE QU'UNE PORTE FERME, pour le survol : ce que les AUTRES portes du rang
 *  rendent joignable et pas elle — nœuds et liens (clés du dessin), leurs
 *  coursives d'entrée comprises. Allumer tout ce qu'une porte ouvre ne
 *  disait rien au début d'un module : l'éventail couvrait presque la
 *  grille. Ce qui décide, c'est ce qu'on perd (le concepteur, 25/09) —
 *  comme le plan de la station éteint les modules qu'une porte ferme. */
export function fermeParPorte(
  mc: MiniCarte,
  rang: number,
  voie: number,
  portes: readonly number[],
  voieDOuLOnVient: number | null,
): { noeuds: string[]; liens: string[] } {
  const garde = new Set(cheminDePorte(mc, rang, voie, voieDOuLOnVient).noeuds)
  const noeuds = new Set<string>()
  const liens = new Set<string>()
  for (const p of portes) {
    if (p === voie) continue
    const ch = cheminDePorte(mc, rang, p, voieDOuLOnVient)
    if (ch.entree) liens.add(ch.entree)
    for (const k of ch.noeuds) if (!garde.has(k)) noeuds.add(k)
  }
  for (const k of noeuds) {
    const [r, v] = k.split('-').map(Number)
    for (const s of mc.rangs[r]?.[v]?.suivants ?? []) liens.add(`${r}-${v}-${s}`)
  }
  return { noeuds: [...noeuds], liens: [...liens] }
}

/** LE CHEMIN D'UNE PORTE, pour le survol : la coursive qui y entre depuis
 *  le nœud d'où l'on vient (`voieDOuLOnVient`, null au premier rang), puis
 *  tout ce qu'elle rend joignable jusqu'au bout du module. Rend les clés
 *  des nœuds (« rang-voie ») et des liens (« rang-voie-suivante », comme
 *  `data-lien` du dessin). Allumer le seul nœud visé ne disait pas où la
 *  porte menait : sur un tressage de voies, l'œil perdait la suite
 *  (le concepteur, 25/09). */
export function cheminDePorte(
  mc: MiniCarte,
  rang: number,
  voie: number,
  voieDOuLOnVient: number | null,
): { noeuds: string[]; liens: string[]; entree: string | null } {
  const noeuds = new Set<string>()
  const liens: string[] = []
  const avant = voieDOuLOnVient !== null ? mc.rangs[rang - 1]?.[voieDOuLOnVient] : undefined
  const entree = avant?.suivants.includes(voie) ? `${rang - 1}-${voieDOuLOnVient}-${voie}` : null
  if (!mc.rangs[rang]?.[voie]) return { noeuds: [], liens: [], entree: null }
  // rang par rang : les voies joignables au rang r, puis leurs suivantes
  let front = new Set<number>([voie])
  for (let r = rang; r < mc.rangs.length && front.size > 0; r++) {
    const suite = new Set<number>()
    for (const v of front) {
      noeuds.add(`${r}-${v}`)
      for (const s of mc.rangs[r][v]?.suivants ?? []) {
        liens.push(`${r}-${v}-${s}`)
        suite.add(s)
      }
    }
    front = suite
  }
  return { noeuds: [...noeuds], liens, entree }
}

/** LE DESSIN de la mini-carte, en SVG : les rangs de gauche à droite, les
 *  voies de haut en bas, le chemin déjà joué (`trace`, une voie par salle
 *  franchie), et les portes du rang courant allumées. Pur : une chaîne.
 *
 *  LES NŒUDS SONT DES TUILES, PAS DES POINTS. La première version posait
 *  des cercles de onze pixels avec un caractère dedans : illisible sur un
 *  Deck, et rien d'un jeu (revue du 16/09). Chaque nœud est un octogone —
 *  la silhouette des modules de la station, pour que la mini-carte se lise
 *  comme un zoom du plan — avec une ICÔNE VECTORIELLE de sa nature : la
 *  goutte (eau), le flocon (glace), les volutes (vapeur), les trois anneaux
 *  (toutes), la carte (pool), l'étoile (figure), le point d'interrogation
 *  (rencontre). Les couleurs viennent des classes CSS (mv-m0 … mv-m3,
 *  mv-pool, mv-evenement) : la charte les tient, pas le dessin. */
export function dessinMiniCarteSVG(
  mc: MiniCarte,
  o: { rang: number; trace: readonly number[]; portes: readonly number[] },
): string {
  const n = mc.rangs.length
  if (n === 0) return ''
  // SIX RANGS doivent tenir sous les portes, sur un téléphone comme sur un
  // écran large : le SVG se met à l'échelle par son viewBox
  const PAS_X = 92
  const PAS_Y = 50
  const X0 = 48
  const Y0 = 32
  const S = 18 // la demi-taille d'une tuile
  const w = X0 * 2 + PAS_X * (n - 1)
  const h = Y0 * 2 + PAS_Y * (mc.voies - 1) + 18
  const x = (r: number): number => X0 + r * PAS_X
  const y = (v: number): number => Y0 + v * PAS_Y
  // l'octogone de la station, centré : les coins coupés à 22 % / 28 %
  const a = 0.56 * S
  const b = 0.44 * S
  const tuile = `${-a},${-S} ${a},${-S} ${S},${-b} ${S},${b} ${a},${S} ${-a},${S} ${-S},${b} ${-S},${-b}`
  const icone = (nd: NoeudVoie): string =>
    nd.nature !== 'salle'
      ? nd.nature === 'evenement'
        ? 'rencontre'
        : nd.nature
      : nd.ecrite
        ? 'pool'
        : nd.figure
          ? 'figure'
          : (['eau', 'glace', 'vapeur', 'toutes'] as const)[nd.mecanique] ?? 'eau'
  const NOMS_HALTE: Record<string, string> = {
    economat: 'l’économat — le Semblable troque contre du condensat',
    repos: 'l’alcôve de repos — un souffle, de la réserve ou du condensat',
    don: 'une bonbonne oubliée',
    coffre: 'une cache — un orbe d’essence y dort',
    minijeu: 'un mini-jeu — le couperet (laisser dépasser du trait ce que la lame doit trancher), le palet (glisser en glace jusqu’au centre), les rafales (traverser entre deux souffles) ou les orbites (lancé autour de trois puits de gravité)',
  }
  const nom = (nd: NoeudVoie): string =>
    nd.nature === 'evenement'
      ? 'une rencontre — on ne sait pas laquelle'
      : nd.nature !== 'salle'
        ? NOMS_HALTE[nd.nature] ?? nd.nature
        : nd.ecrite
          ? 'tableau du pool'
          : `${nd.figure ? 'figure' : 'salle'} · ${['eau', 'glace', 'vapeur', 'toutes'][nd.mecanique] ?? 'eau'}` +
            (nd.prime ? ` · PRIME : ${NOMS_PRIME[nd.prime]} (plus dure d’un cran)` : '')
  const teinte = (nd: NoeudVoie): string =>
    nd.nature === 'evenement'
      ? 'mv-evenement'
      : nd.nature !== 'salle'
        ? `mv-halte mv-${nd.nature}`
        : nd.ecrite
          ? 'mv-pool'
          : `mv-m${nd.mecanique}`
  // CE QUE LE CHOIX INTERDIT : depuis les portes du rang courant, les
  // nœuds encore joignables. Tout lien qui n'en part pas (et n'est pas le
  // chemin joué) ne se prendra plus — il reste dessiné, mais éteint. Avant,
  // les voies abandonnées gardaient leur trait plein : la carte montrait
  // des croisements qui ne concernaient plus le joueur (le concepteur, 25/09).
  const joignables = new Set<string>()
  for (const p of o.portes) for (const k of cheminDePorte(mc, o.rang, p, null).noeuds) joignables.add(k)
  let liens = ''
  let noeuds = ''
  for (const rang of mc.rangs)
    for (const nd of rang) {
      const joueIci = o.trace[nd.rang] === nd.voie
      const ici = `${nd.rang}-${nd.voie}`
      for (const s of nd.suivants) {
        const joue = joueIci && o.trace[nd.rang + 1] === s
        const ouvre = joueIci && nd.rang + 1 === o.rang && o.portes.includes(s)
        const interdit = !joue && !ouvre && !joignables.has(ici)
        liens += `<line class="mv-lien${joue ? ' mv-joue' : ''}${ouvre ? ' mv-ouvre' : ''}${interdit ? ' mv-interdit' : ''}" data-lien="${nd.rang}-${nd.voie}-${s}" x1="${x(nd.rang) + S}" y1="${y(nd.voie)}" x2="${x(nd.rang + 1) - S}" y2="${y(s)}"/>`
      }
      const porte = nd.rang === o.rang && o.portes.includes(nd.voie)
      const cl =
        'mv-noeud ' + teinte(nd) +
        (joueIci ? ' mv-joue' : '') + (porte ? ' mv-porte' : '') +
        // TROIS ÉTATS, PAS CINQ : joué, joignable, hors d'atteinte — le
        // passé non joué et le futur perdu se lisent pareil, c'est la même
        // chose pour le joueur (fermé, lointain, interdit, reculé au survol :
        // cinq gris que l'œil ne distinguait pas, revue du 25/09)
        (!joueIci && (nd.rang < o.rang || !joignables.has(ici)) ? ' mv-interdit' : '')
      noeuds +=
        `<g class="${cl}" data-rang="${nd.rang}" data-voie="${nd.voie}" transform="translate(${x(nd.rang)} ${y(nd.voie)})">` +
        `<title>salle ${nd.rang + 1}, voie ${nd.voie + 1} — ${nom(nd)}</title>` +
        `<polygon class="mv-halo" points="${tuile}"/>` +
        `<polygon class="mv-tuile" points="${tuile}"/>` +
        `<use href="#mv-i-${icone(nd)}" x="-11" y="-11" width="22" height="22"/>` +
        (joueIci ? `<circle class="mv-coche" cx="${S - 3}" cy="${-S + 3}" r="4"/>` : '') +
        // LA PRIME : un losange au coin bas droit, teinté par ce qu'elle paie
        (nd.prime
          ? `<polygon class="mv-prime mv-prime-${nd.prime}" points="${S - 3},${S - 10} ${S + 4},${S - 3} ${S - 3},${S + 4} ${S - 10},${S - 3}"/>`
          : '') +
        `</g>`
    }
  let titres = ''
  // le repère de chaque voie à gauche de la grille, allumé là où une porte
  // s'ouvre — le même signe que sur la porte (REPERES_VOIE)
  for (let v = 0; v < mc.voies; v++) {
    const rep = REPERES_VOIE[v]
    if (rep)
      titres += `<text class="mv-repere${o.portes.includes(v) ? ' mv-repere-porte' : ''}" data-voie="${v}" x="${X0 - S - 14}" y="${y(v)}">${rep.signe}</text>`
  }
  for (let r = 0; r < n; r++)
    titres += `<text class="mv-titre${r === o.rang ? ' mv-courant' : ''}" x="${x(r)}" y="${h - 6}">SALLE ${r + 1}</text>`
  return (
    `<svg class="mv-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="les voies du module">` +
    ICONES_MINI_CARTE +
    `<g class="mv-liens">${liens}</g><g class="mv-noeuds">${noeuds}</g>${titres}</svg>`
  )
}

/** LES ICÔNES, en symboles SVG dessinés dans un repère 24 × 24 — le trait
 *  hérite de la couleur du nœud (currentColor). Une goutte, un flocon, des
 *  volutes, trois anneaux, une carte, une étoile, un point d'interrogation :
 *  le vocabulaire de la mini-carte, lisible sans légende. */
export const ICONES_MINI_CARTE =
  '<defs>' +
  // l'eau : la goutte
  '<symbol id="mv-i-eau" viewBox="0 0 24 24"><path d="M12 3 C12 3 6 10 6 14.5 A6 6 0 0 0 18 14.5 C18 10 12 3 12 3 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9.5 15 A2.5 2.5 0 0 0 12 17.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".7"/></symbol>' +
  // la glace : le flocon
  '<symbol id="mv-i-glace" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M12 3l-2.4 2.4M12 3l2.4 2.4M12 21l-2.4-2.4M12 21l2.4-2.4M4.2 7.5l3.3.2M4.2 7.5l.2 3.3M19.8 16.5l-3.3-.2M19.8 16.5l-.2-3.3M4.2 16.5l.2-3.3M4.2 16.5l3.3-.2M19.8 7.5l-.2 3.3M19.8 7.5l-3.3.2"/></g></symbol>' +
  // la vapeur : trois volutes qui montent
  '<symbol id="mv-i-vapeur" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M7 20c-2-2-2-4 0-6s2-4 0-6M12 20c-2-2-2-4 0-6s2-4 0-6M17 20c-2-2-2-4 0-6s2-4 0-6"/></g></symbol>' +
  // toutes les mécaniques : trois anneaux liés
  '<symbol id="mv-i-toutes" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4.2"/><circle cx="7.5" cy="15.5" r="4.2"/><circle cx="16.5" cy="15.5" r="4.2"/></g></symbol>' +
  // le tableau du pool : une carte
  '<symbol id="mv-i-pool" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4.5"/></g></symbol>' +
  // la figure : l'étoile à quatre pointes
  '<symbol id="mv-i-figure" viewBox="0 0 24 24"><path d="M12 2.5 L14.2 9.8 L21.5 12 L14.2 14.2 L12 21.5 L9.8 14.2 L2.5 12 L9.8 9.8 Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>' +
  // la rencontre : le point d'interrogation, gras
  '<symbol id="mv-i-rencontre" viewBox="0 0 24 24"><path d="M8.5 9a3.5 3.5 0 1 1 5.2 3.1c-1.3.8-1.7 1.5-1.7 3" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/></symbol>' +
  // l'économat : la balance du Semblable
  '<symbol id="mv-i-economat" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v17M7 20h10M4 9h16M6.5 9l-3 6h6l-3-6ZM17.5 9l-3 6h6l-3-6Z"/></g></symbol>' +
  // l'alcôve : la lune, le repos
  '<symbol id="mv-i-repos" viewBox="0 0 24 24"><path d="M15.5 3.5a8.5 8.5 0 1 0 5 15.5 7 7 0 0 1-5-15.5Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></symbol>' +
  // la bonbonne oubliée : le flacon
  '<symbol id="mv-i-don" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 3h5M10 3v4.5L6.5 12v7a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-7L14 7.5V3"/><path d="M7.5 15.5h9" opacity=".6"/></g></symbol>' +
  // la cache : le losange, l'orbe qui dort
  '<symbol id="mv-i-minijeu" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10v16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2Z"/><path d="M7 8h3M7 12h3M7 16h3"/><path d="M9 13.5c1.5-1 4.5-1 6 0V19H9Z" fill="currentColor" opacity=".5" stroke="none"/></g></symbol>' +
  '<symbol id="mv-i-coffre" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3 21 12 12 21 3 12Z"/><path d="M12 8.5 15.5 12 12 15.5 8.5 12Z" fill="currentColor" opacity=".55"/></g></symbol>' +
  '</defs>'
