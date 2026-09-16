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
  /** SANS SALLES GÉNÉRÉES (le réglage du plan coupé) : chaque nœud salle
   *  est un tableau du pool. La mini-carte doit vivre quel que soit ce
   *  réglage — couper les générées la faisait disparaître, et les salles
   *  se jouaient hors voies, la trace en retard sur le niveau (revue du
   *  16/09). Faux : une voie par rang porte le pool, les autres se
   *  génèrent. */
  toutEcrit: boolean
}
export const TISSAGE_DEFAUT: ReglagesTissage = {
  partEvenement: 0.2,
  rangMin: 1,
  bifurcation: 0.45,
  economats: 1,
  repos: 1,
  dons: 0,
  coffre: false,
  toutEcrit: false,
}

/** La nature d'un nœud : une salle à jouer, une rencontre à traverser, ou
 *  une HALTE — l'économat, l'alcôve de repos, la bonbonne oubliée, la cache
 *  à orbe. Le concepteur a tranché (16/09) : les haltes vivent dans la
 *  mini-carte, jamais sur la grande carte, qui ne montre que des biomes. */
export type NatureNoeud = 'salle' | 'evenement' | 'economat' | 'repos' | 'don' | 'coffre'
export const HALTES_NOEUD: readonly NatureNoeud[] = ['economat', 'repos', 'don', 'coffre']

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
 *  · `ecrites` — une voie par rang porte un tableau du pool (toutes, sous
 *    `reglages.toutEcrit`) ; faux, aucune.
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
  const rangs: NoeudVoie[][] = []
  for (let r = 0; r < n; r++) {
    const mecaniques = mecaniquesDuChoix(null, alea, null, permises)
    const modes = figuresDuChoix(momentAuRang(r), alea, figures.debut, figures.suite)
    // le tirage se fait même quand toutes les voies sont écrites : la
    // graine reste alignée quel que soit le réglage
    const voieEcrite = ecrites ? Math.min(VOIES - 1, Math.floor(alea() * VOIES)) : -1
    const toutEcrit = ecrites && reglages.toutEcrit
    // LES NŒUDS ÉVÉNEMENT. Le tirage se fait à CHAQUE rang, le premier
    // compris, pour que la graine reste alignée quel que soit le réglage —
    // mais les rangs sous `rangMin` n'en portent jamais (on entre dans un
    // biome par une salle, sinon le module ne se présente pas), et jamais
    // les TROIS d'un rang : il doit toujours rester une voie qui se joue.
    const evs = [0, 1, 2].map(() => alea() < part)
    if (r < rangMin || evs.every(Boolean)) evs[0] = false
    if (r < rangMin) evs[1] = evs[2] = false
    const rang: NoeudVoie[] = []
    for (let v = 0; v < VOIES; v++) {
      const suivants: number[] = []
      if (r < n - 1) {
        // la voie continue tout droit, et bifurque vers une voisine une
        // fois sur deux environ — les tirages se font TOUJOURS, même au
        // bord, pour que la graine reste alignée quel que soit le tracé
        const gauche = alea() < bif
        const droite = alea() < bif
        if (gauche && v > 0) suivants.push(v - 1)
        suivants.push(v)
        if (droite && v < VOIES - 1) suivants.push(v + 1)
      }
      rang.push({
        rang: r,
        voie: v,
        mecanique: mecaniques[v] ?? mecaniques[0],
        figure: modes[v] ?? false,
        // un nœud événement n'a pas de tableau : il n'a pas de salle
        ecrite: (toutEcrit || v === voieEcrite) && !evs[v],
        nature: evs[v] ? 'evenement' : 'salle',
        suivants,
      })
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
            // remplacer une salle doit en laisser une ; remplacer une rencontre n'en coûte aucune
            rangs[nd.rang].filter((x) => x.nature === 'salle').length > (nature === 'salle' ? 1 : 0),
        )
    // une halte prend d'abord la place d'une salle ; quand les rencontres
    // ont tout pris, elle prend celle d'une rencontre — la halte est promise
    // par le plan, la rencontre n'est qu'un tirage
    const candidats = libres('salle').length > 0 ? libres('salle') : libres('evenement')
    if (candidats.length === 0) continue
    const nd = candidats[Math.min(candidats.length - 1, Math.floor(tirage * candidats.length))]
    nd.nature = nature
    nd.ecrite = false
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
  if (noeuds.some((n) => n.nature === 'evenement')) out.push('rencontre')
  if (noeuds.some((n) => n.nature === 'economat')) out.push('économat')
  if (noeuds.some((n) => n.nature === 'repos')) out.push('alcôve')
  if (noeuds.some((n) => n.nature === 'don')) out.push('bonbonne')
  if (noeuds.some((n) => n.nature === 'coffre')) out.push('cache')
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
  }
  const nom = (nd: NoeudVoie): string =>
    nd.nature === 'evenement'
      ? 'une rencontre — on ne sait pas laquelle'
      : nd.nature !== 'salle'
        ? NOMS_HALTE[nd.nature] ?? nd.nature
        : nd.ecrite
          ? 'tableau du pool'
          : `${nd.figure ? 'figure' : 'salle'} · ${['eau', 'glace', 'vapeur', 'toutes'][nd.mecanique] ?? 'eau'}`
  const teinte = (nd: NoeudVoie): string =>
    nd.nature === 'evenement'
      ? 'mv-evenement'
      : nd.nature !== 'salle'
        ? `mv-halte mv-${nd.nature}`
        : nd.ecrite
          ? 'mv-pool'
          : `mv-m${nd.mecanique}`
  let liens = ''
  let noeuds = ''
  for (const rang of mc.rangs)
    for (const nd of rang) {
      const joueIci = o.trace[nd.rang] === nd.voie
      for (const s of nd.suivants) {
        const joue = joueIci && o.trace[nd.rang + 1] === s
        const ouvre = joueIci && nd.rang + 1 === o.rang && o.portes.includes(s)
        liens += `<line class="mv-lien${joue ? ' mv-joue' : ''}${ouvre ? ' mv-ouvre' : ''}" x1="${x(nd.rang) + S}" y1="${y(nd.voie)}" x2="${x(nd.rang + 1) - S}" y2="${y(s)}"/>`
      }
      const porte = nd.rang === o.rang && o.portes.includes(nd.voie)
      const cl =
        'mv-noeud ' + teinte(nd) +
        (joueIci ? ' mv-joue' : '') + (porte ? ' mv-porte' : '') +
        (nd.rang < o.rang && !joueIci ? ' mv-ferme' : '') +
        (nd.rang > o.rang ? ' mv-loin' : '')
      noeuds +=
        `<g class="${cl}" data-rang="${nd.rang}" data-voie="${nd.voie}" transform="translate(${x(nd.rang)} ${y(nd.voie)})">` +
        `<title>salle ${nd.rang + 1}, voie ${nd.voie + 1} — ${nom(nd)}</title>` +
        `<polygon class="mv-halo" points="${tuile}"/>` +
        `<polygon class="mv-tuile" points="${tuile}"/>` +
        `<use href="#mv-i-${icone(nd)}" x="-11" y="-11" width="22" height="22"/>` +
        (joueIci ? `<circle class="mv-coche" cx="${S - 3}" cy="${-S + 3}" r="4"/>` : '') +
        `</g>`
    }
  let titres = ''
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
  '<symbol id="mv-i-coffre" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3 21 12 12 21 3 12Z"/><path d="M12 8.5 15.5 12 12 15.5 8.5 12Z" fill="currentColor" opacity=".55"/></g></symbol>' +
  '</defs>'
