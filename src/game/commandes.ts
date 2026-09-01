// LES COMMANDES DU JEU, redéfinissables — clavier, souris, manette.
//
// Une seule table, ici : chaque MANŒUVRE (se changer en glace, verser la
// réserve, ralentir le temps…) porte sa touche et son bouton par défaut, et
// le joueur peut les changer dans PARAMÈTRES › COMMANDES. Le réglage est
// celui de la MAIN, pas de la partie : il vit dans le stockage local de
// l'appareil et suit le joueur d'une session à l'autre.
//
// Les manœuvres marquées `fixe` ne se redéfinissent pas : ce sont les
// poignées qui permettent de sortir d'un écran (Échap, Start) ou d'agir
// (A, clic). Les laisser réassigner, c'est risquer de s'enfermer.

export interface Manoeuvre {
  id: string
  nom: string
  aide: string
  section: string
  clavier: string | null // la touche, en minuscule (' ' pour l'espace)
  manette: number | null // l'index du bouton (voir BOUTON dans manette.ts)
  fixe?: boolean
}

/** Les défauts : l'état du jeu tel qu'il se joue depuis toujours. */
export const MANOEUVRES: Manoeuvre[] = [
  {
    id: 'agir',
    nom: 'Agir — éjecter, viser, se rassembler',
    aide: 'Maintenir : le corps éjecte vers le pointeur (il part à l’opposé). En vapeur : viser puis relâcher lance le dash. Sur le corps, sans viser : se rassembler, gratuitement.',
    section: 'Le geste',
    clavier: null,
    manette: 0, // A
    fixe: true,
  },
  {
    id: 'glace',
    nom: 'Se changer en GLACE',
    aide: 'Le bloc garde son élan et glisse ; il ne se rassemble plus.',
    section: 'Les états',
    clavier: 'f',
    manette: 2, // X
  },
  {
    id: 'vapeur',
    nom: 'Se changer en VAPEUR',
    aide: 'Le nuage passe les évents ; viser ralentit le temps, relâcher lance le dash.',
    section: 'Les états',
    clavier: 'g',
    manette: 3, // Y
  },
  {
    id: 'eau',
    nom: 'Revenir au LIQUIDE',
    aide: 'Fusion ou liquéfaction, selon l’état d’où l’on vient.',
    section: 'Les états',
    clavier: null,
    manette: 1, // B
  },
  {
    id: 'verser',
    nom: 'Verser la BONBONNE',
    aide: 'La réserve mise de côté se reverse dans le corps — en liquide seulement. La fiole du bandeau fait le même geste.',
    section: 'Les états',
    clavier: 'v',
    manette: 12, // croix ↑
  },
  {
    id: 'ralentir',
    nom: 'Ralentir le temps',
    aide: 'Le temps de la cuve s’étire — la physique suit, rien ne se fige.',
    section: 'Le temps',
    clavier: ',',
    manette: 4, // LB
  },
  {
    id: 'accelerer',
    nom: 'Accélérer le temps',
    aide: 'Le temps de la cuve se presse.',
    section: 'Le temps',
    clavier: '.',
    manette: 5, // RB
  },
  {
    id: 'pause',
    nom: 'Pause',
    aide: 'La cuve s’arrête ; l’écran reste.',
    section: 'Le temps',
    clavier: ' ',
    manette: null,
  },
  {
    id: 'recommencer',
    nom: 'Recommencer la salle',
    aide: 'La salle repart à zéro (la réserve et le refroidissement, eux, ne se rembobinent pas).',
    section: 'Le temps',
    clavier: 'r',
    manette: 8, // Select
  },
  {
    id: 'legende',
    nom: 'Légende des surfaces',
    aide: 'Le panneau qui nomme chaque matière de la cuve.',
    section: 'Les écrans',
    clavier: 'l',
    manette: null,
  },
  {
    id: 'etats',
    nom: 'Les trois états',
    aide: 'Le rappel des trois régimes et de leurs coûts.',
    section: 'Les écrans',
    clavier: 'e',
    manette: null,
  },
  {
    id: 'carte',
    nom: 'Le plan de la station',
    aide: 'Le complexe entier, module par module : d’où l’on vient, où l’on est, ce qui attend. Le plan couvre l’écran, il met donc la partie en pause.',
    section: 'Les écrans',
    clavier: 'c',
    manette: 8, // SELECT
  },
  {
    id: 'dossier',
    nom: 'Dossier de descente',
    aide: 'Tout le relevé de la run d’un geste, sans figer la partie.',
    section: 'Les écrans',
    clavier: 'Tab',
    manette: 11, // R3
  },
  {
    id: 'recadrer',
    nom: 'Recadrer la caméra',
    aide: 'La caméra revient au suivi automatique.',
    section: 'Les écrans',
    clavier: null,
    manette: 10, // L3
  },
  {
    id: 'fiche',
    nom: 'La fiche (pause + menu)',
    aide: 'L’écran d’accueil par-dessus la partie — et la sortie de tout panneau.',
    section: 'Les écrans',
    clavier: 'Escape',
    manette: 9, // Start
    fixe: true,
  },
]

const CLE = 'projet21.commandes.v1'

interface Redef {
  clavier?: string | null
  manette?: number | null
}

let redefs: Record<string, Redef> | null = null
let sourisInversee: boolean | null = null

function lit(): Record<string, Redef> {
  if (redefs) return redefs
  try {
    const brut = JSON.parse(localStorage.getItem(CLE) ?? '{}') as {
      touches?: Record<string, Redef>
      sourisInversee?: unknown
    }
    redefs = brut.touches ?? {}
    sourisInversee = brut.sourisInversee === true
  } catch {
    redefs = {}
    sourisInversee = false
  }
  return redefs
}

function ecrit(): void {
  try {
    localStorage.setItem(
      CLE,
      JSON.stringify({
        touches: redefs ?? {},
        sourisInversee: sourisInversee === true,
      }),
    )
  } catch {
    // stockage refusé : le réglage ne tiendra que la séance — sans gravité
  }
}

function defaut(id: string): Manoeuvre | undefined {
  return MANOEUVRES.find((m) => m.id === id)
}

/** La touche EN VIGUEUR pour une manœuvre (redéfinie, sinon d'origine). */
export function toucheDe(id: string): string | null {
  const r = lit()[id]
  if (r && 'clavier' in r) return r.clavier ?? null
  return defaut(id)?.clavier ?? null
}

/** Le bouton de manette EN VIGUEUR (index), ou null. */
export function boutonDe(id: string): number | null {
  const r = lit()[id]
  if (r && 'manette' in r) return r.manette ?? null
  return defaut(id)?.manette ?? null
}

/** Deux touches se valent-elles ? (la casse ne compte pas) */
function memeTouche(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false
  return a.toLowerCase() === b.toLowerCase()
}

/** La manœuvre déclenchée par cette touche, ou null. */
export function actionDeTouche(touche: string): string | null {
  for (const m of MANOEUVRES) {
    if (memeTouche(toucheDe(m.id), touche)) return m.id
  }
  return null
}

/** La manœuvre déclenchée par ce bouton de manette, ou null. */
export function actionDeBouton(index: number): string | null {
  for (const m of MANOEUVRES) {
    if (boutonDe(m.id) === index) return m.id
  }
  return null
}

/** Redéfinit une touche ou un bouton. La commande est EXCLUSIVE : si elle
 *  servait déjà ailleurs, elle est libérée de l'autre manœuvre — sinon deux
 *  gestes partiraient d'un même appui. Les manœuvres fixes refusent.
 *  Renvoie l'id de la manœuvre dépossédée, s'il y en a une. */
export function redefinis(
  id: string,
  quoi: 'clavier' | 'manette',
  valeur: string | number | null,
): string | null {
  const m = defaut(id)
  if (!m || m.fixe) return null
  const r = lit()
  let libere: string | null = null
  if (valeur !== null) {
    for (const autre of MANOEUVRES) {
      if (autre.id === id || autre.fixe) continue
      const occupe =
        quoi === 'clavier'
          ? memeTouche(toucheDe(autre.id), String(valeur))
          : boutonDe(autre.id) === valeur
      if (occupe) {
        r[autre.id] = { ...r[autre.id], [quoi]: null }
        libere = autre.id
      }
    }
  }
  r[id] = { ...r[id], [quoi]: valeur as never }
  ecrit()
  return libere
}

/** Remet une manœuvre — ou toutes — à leur commande d'origine. */
export function reinitialise(id?: string): void {
  const r = lit()
  if (id) delete r[id]
  else redefs = {}
  if (!id) sourisInversee = false
  ecrit()
}

/** Une manœuvre a-t-elle été redéfinie ? (l'écran le signale) */
export function redefinie(id: string): boolean {
  const r = lit()[id]
  if (!r) return false
  const m = defaut(id)
  if (!m) return false
  const c = 'clavier' in r && (r.clavier ?? null) !== (m.clavier ?? null)
  const b = 'manette' in r && (r.manette ?? null) !== (m.manette ?? null)
  return c || b
}

/** LES BOUTONS DE LA SOURIS : inversés, le clic DROIT éjecte et le gauche
 *  déplace la caméra (les gauchers, et les souris à pouce, y tiennent). */
export function sourisInverse(): boolean {
  lit()
  return sourisInversee === true
}

export function poseSourisInverse(v: boolean): void {
  lit()
  sourisInversee = v
  ecrit()
}

// ---- Les NOMS lisibles (l'écran des commandes les affiche tels quels) ----

const NOMS_BOUTON: Record<number, string> = {
  0: 'A',
  1: 'B',
  2: 'X',
  3: 'Y',
  4: 'LB',
  5: 'RB',
  6: 'LT',
  7: 'RT',
  8: 'Select',
  9: 'Start',
  10: 'L3 (stick G)',
  11: 'R3 (stick D)',
  12: 'croix ↑',
  13: 'croix ↓',
  14: 'croix ←',
  15: 'croix →',
}

export function nomBouton(i: number | null): string {
  if (i === null) return '—'
  return NOMS_BOUTON[i] ?? `bouton ${i}`
}

export function nomTouche(k: string | null): string {
  if (k === null) return '—'
  if (k === ' ') return 'ESPACE'
  if (k === 'Escape') return 'ÉCHAP'
  if (k === 'Tab') return 'TAB'
  if (k === 'ArrowUp') return '↑'
  if (k === 'ArrowDown') return '↓'
  if (k === 'ArrowLeft') return '←'
  if (k === 'ArrowRight') return '→'
  return k.length === 1 ? k.toUpperCase() : k
}

/** Les sections, dans l'ordre où l'écran les présente. */
export function sections(): { titre: string; manoeuvres: Manoeuvre[] }[] {
  const out: { titre: string; manoeuvres: Manoeuvre[] }[] = []
  for (const m of MANOEUVRES) {
    let s = out.find((x) => x.titre === m.section)
    if (!s) {
      s = { titre: m.section, manoeuvres: [] }
      out.push(s)
    }
    s.manoeuvres.push(m)
  }
  return out
}
