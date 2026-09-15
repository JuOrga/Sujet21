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
): MiniCarte {
  const n = Math.max(0, Math.floor(niveaux))
  const rangs: NoeudVoie[][] = []
  for (let r = 0; r < n; r++) {
    const mecaniques = mecaniquesDuChoix(null, alea, null, permises)
    const modes = figuresDuChoix(momentAuRang(r), alea, figures.debut, figures.suite)
    const voieEcrite = ecrites ? Math.min(VOIES - 1, Math.floor(alea() * VOIES)) : -1
    const rang: NoeudVoie[] = []
    for (let v = 0; v < VOIES; v++) {
      const suivants: number[] = []
      if (r < n - 1) {
        // la voie continue tout droit, et bifurque vers une voisine une
        // fois sur deux environ — les tirages se font TOUJOURS, même au
        // bord, pour que la graine reste alignée quel que soit le tracé
        const gauche = alea() < 0.45
        const droite = alea() < 0.45
        if (gauche && v > 0) suivants.push(v - 1)
        suivants.push(v)
        if (droite && v < VOIES - 1) suivants.push(v + 1)
      }
      rang.push({
        rang: r,
        voie: v,
        mecanique: mecaniques[v] ?? mecaniques[0],
        figure: modes[v] ?? false,
        ecrite: v === voieEcrite,
        suivants,
      })
    }
    rangs.push(rang)
  }
  return { voies: VOIES, rangs }
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
 *  franchie), et les portes du rang courant allumées. Pur : une chaîne. */
export function dessinMiniCarteSVG(
  mc: MiniCarte,
  o: { rang: number; trace: readonly number[]; portes: readonly number[] },
): string {
  const n = mc.rangs.length
  if (n === 0) return ''
  const PAS_X = 96
  const PAS_Y = 34
  const X0 = 48
  const Y0 = 22
  const w = X0 * 2 + PAS_X * (n - 1)
  const h = Y0 * 2 + PAS_Y * (mc.voies - 1) + 14
  const x = (r: number): number => X0 + r * PAS_X
  const y = (v: number): number => Y0 + v * PAS_Y
  const glyphe = (nd: NoeudVoie): string =>
    nd.ecrite ? '▤' : nd.figure ? '✧' : ['○', '❄', '♨', '◎'][nd.mecanique] ?? '○'
  const nom = (nd: NoeudVoie): string =>
    nd.ecrite ? 'tableau du pool' : `${nd.figure ? 'figure' : 'salle'} · ${['eau', 'glace', 'vapeur', 'toutes'][nd.mecanique] ?? 'eau'}`
  let liens = ''
  let noeuds = ''
  for (const rang of mc.rangs)
    for (const nd of rang) {
      const joueIci = o.trace[nd.rang] === nd.voie
      for (const s of nd.suivants) {
        const joue = joueIci && o.trace[nd.rang + 1] === s
        const ouvre = joueIci && nd.rang + 1 === o.rang && o.portes.includes(s)
        liens += `<line class="mv-lien${joue ? ' mv-joue' : ''}${ouvre ? ' mv-ouvre' : ''}" x1="${x(nd.rang)}" y1="${y(nd.voie)}" x2="${x(nd.rang + 1)}" y2="${y(s)}"/>`
      }
      const porte = nd.rang === o.rang && o.portes.includes(nd.voie)
      const cl =
        'mv-noeud' + (joueIci ? ' mv-joue' : '') + (porte ? ' mv-porte' : '') +
        (nd.rang < o.rang && !joueIci ? ' mv-ferme' : '')
      noeuds +=
        `<g class="${cl}" data-rang="${nd.rang}" data-voie="${nd.voie}" transform="translate(${x(nd.rang)} ${y(nd.voie)})">` +
        `<title>salle ${nd.rang + 1}, voie ${nd.voie + 1} — ${nom(nd)}</title>` +
        `<circle r="11"/><text>${glyphe(nd)}</text></g>`
    }
  let titres = ''
  for (let r = 0; r < n; r++)
    titres += `<text class="mv-titre${r === o.rang ? ' mv-courant' : ''}" x="${x(r)}" y="${h - 4}">SALLE ${r + 1}</text>`
  return (
    `<svg class="mv-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="les voies du module">` +
    `<g class="mv-liens">${liens}</g><g class="mv-noeuds">${noeuds}</g>${titres}</svg>`
  )
}
