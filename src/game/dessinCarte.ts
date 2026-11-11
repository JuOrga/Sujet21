// LE DESSIN DE LA CARTE À ROUTES RAMIFIÉES — en SVG, depuis les données.
//
// Même parti que planStation.ts, et pour les mêmes raisons : la carte se
// survole, se clique, se glisse (dans l'éditeur), porte du texte qui doit
// rester net, et ses animations (la pulsation du module courant, le flux
// des tirets sur la coursive active) tiennent en CSS. La fonction est PURE :
// elle rend une chaîne à partir de la carte et d'un état de lecture — rien
// n'y touche au DOM, et un test la vérifie sans navigateur.
//
// Le rendu suit la maquette du concepteur (handoff « Carte de la station »)
// avec une fidélité HAUTE : octogone `22 % / 78 % / 28 % / 72 %` pour un
// module, rond pour une jonction, dôme pour le terminal ; les coursives en
// trois traits superposés (paroi, sol, anneaux en tirets « 4 44 ») puis la
// ligne de route colorée par type ; les plaques en dégradé, les traits
// #324a62, les lumières #63b7e6. Aucune de ces couleurs n'est écrite ici
// deux fois : elles viennent de la palette de la carte.
//
// TOUT EST DANS UN SEUL SVG — la maquette mêlait HTML et SVG, ce qui obligeait
// à mettre la scène à l'échelle à la main. Un seul viewBox, et le navigateur
// fait l'échelle ; l'éditeur convertit un pointeur en coordonnées de scène
// par la matrice du SVG, sans rien calculer.

import {
  accessibles,
  couleurTemperature,
  orbeRequis,
  liensDepuis,
  moduleParId,
  moduleRevele,
  traceLien,
  zoneDe,
  type CarteStation,
  type DecorCarte,
  type LienCarte,
  type ModuleCarte,
  type TypeModule,
} from './carteStation'

export interface OptionsDessin {
  /** le module où se trouve le joueur — null : pas de joueur (édition) */
  courant: string | null
  /** les modules déjà traversés */
  visites: readonly string[]
  /** le module mis en avant (fiche ouverte, ou sélection de l'éditeur) */
  selection: string | null
  /** la coursive sélectionnée dans l'éditeur (index dans liens) */
  lienSelection: number | null
  /** les orbes acquis — décident des cadenas */
  orbes: readonly string[]
  /** l'éditeur ajoute poignées, flèches de sens, zones de prise et grille */
  mode: 'jeu' | 'editeur'
  afficherTemp: boolean
  /** le pas de la grille dessinée (éditeur) — 0 : aucune */
  grille?: number
  /** la coursive en cours de tracé (éditeur) */
  brouillon?: { x1: number; y1: number; x2: number; y2: number } | null
  /** le module joignable EN REVENANT SUR SES PAS (l'objectif est hors de
   *  portée d'ici) : il s'allume comme une cible, sans coursive */
  retour?: string | null
  /** les « ? » révélés de la run : le plan les dessine sous leur nature */
  revelations?: Record<string, TypeModule>
}

/** Les glyphes des natures de module — le dessin, pas la donnée : un
 *  symbole par nature, comme la maquette. */
export const GLYPHES: Record<TypeModule, string> = {
  sas: '⊕',
  jonction: '',
  combat: '⚔',
  enigme: '▦',
  coffre: '◆',
  boss: '⬢',
  economat: '⚖',
  repos: '☾',
  don: '✦',
  inconnu: '?',
}

const COURANT = '#a7ddf5' // le givre : les lumières du décor, le trait du socle
// LE « VOUS ÊTES ICI » EST BLANC, et lui seul : le givre (#a7ddf5) est AUSSI
// la couleur de la zone des coursives — au deuxième choix de la descente, le
// module où l'on se tient et les trois qu'il ouvre portaient le même bord, et
// rien ne disait lequel était « ici » (capture du 10/11). La légende de
// l'écran LA STATION le promettait déjà blanc.
const ICI = '#eef8ff'
const INERTE = '#4a6478' // un module hors de portée

// ---- CE QUE LA RUN DIT D'UN MODULE -----------------------------------------------

/** L'ÉTAT D'UN MODULE pour le joueur, là où il se tient. UNE seule lecture,
 *  que le dessin, l'étiquette d'accessibilité et les fiches partagent : avant,
 *  le plan ne distinguait pas « plus loin sur ma route » de « je ne pourrai
 *  plus y aller » — les deux à 60 % —, et la fiche répondait la même phrase
 *  aux deux (« aucune coursive n'y mène d'ici »). */
export type EtatModule =
  | 'ici'
  /** une coursive ouverte y mène d'ici */
  | 'joignable'
  /** une coursive y mène, mais l'orbe manque */
  | 'verrou'
  /** le cul-de-sac : le module d'où l'on vient, par où l'on repart */
  | 'retour'
  | 'traverse'
  /** pas encore : il reste sur une route qu'on peut prendre */
  | 'plus-loin'
  /** plus jamais de cette descente : aucune coursive n'y mène plus */
  | 'ferme'
  /** pas de joueur (l'éditeur) */
  | 'neutre'

type Lecture = Pick<OptionsDessin, 'courant' | 'visites' | 'orbes' | 'retour'>

/** Ce qu'on peut encore atteindre d'ici — et, depuis un cul-de-sac, ce que
 *  rouvre le module par où l'on repart. */
function encoreJoignables(c: CarteStation, o: Lecture): Set<string> {
  if (o.courant === null) return new Set()
  const s = accessibles(c, o.courant)
  if (o.retour) for (const id of accessibles(c, o.retour)) s.add(id)
  return s
}

export function etatModule(c: CarteStation, o: Lecture, id: string, joignables?: ReadonlySet<string>): EtatModule {
  if (o.courant === null) return 'neutre'
  if (id === o.courant) return 'ici'
  const arete = liensDepuis(c, o.courant).find((l) => l.vers === id)
  if (arete) return orbeRequis(c, arete, o.orbes) !== null ? 'verrou' : 'joignable'
  if (o.retour === id) return 'retour'
  if (o.visites.includes(id)) return 'traverse'
  return (joignables ?? encoreJoignables(c, o)).has(id) ? 'plus-loin' : 'ferme'
}

/** L'état, en mots — pour qui ne voit pas les couleurs, et pour les fiches. */
export const ETATS_DITS: Record<EtatModule, string> = {
  ici: 'vous êtes ici',
  joignable: 'joignable d’ici',
  verrou: 'verrouillé — un orbe manque',
  retour: 'retour sur ses pas',
  traverse: 'déjà traversé',
  'plus-loin': 'plus loin sur la route — pas encore joignable',
  ferme: 'hors de portée — plus aucune coursive n’y mène',
  neutre: '',
}

/** Un nombre au dixième, sans traîne flottante (« 14 », pas « 14.000000002 »). */
const n1 = (v: number): string => {
  const r = Math.round(v * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}
/** Un facteur d'échelle, avec la précision qu'il demande. */
const n4 = (v: number): string => String(Math.round(v * 10000) / 10000)
export const esc = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** L'octogone de la maquette, en coordonnées absolues :
 *  polygon(22% 0, 78% 0, 100% 28%, 100% 72%, 78% 100%, 22% 100%, 0 72%, 0 28%). */
export function octogone(l: number, t: number, w: number, h: number): string {
  const p = [
    [l + 0.22 * w, t], [l + 0.78 * w, t], [l + w, t + 0.28 * h], [l + w, t + 0.72 * h],
    [l + 0.78 * w, t + h], [l + 0.22 * w, t + h], [l, t + 0.72 * h], [l, t + 0.28 * h],
  ]
  return p.map(([x, y]) => `${n1(x)},${n1(y)}`).join(' ')
}

/** Le nom coupé en deux lignes au blanc le plus proche du milieu — même
 *  règle que planStation.coupeNom, sans quoi « AUCUNE TRANSFO » déborde. */
function lignesNom(nom: string, seuil = 14): string[] {
  if (nom.length <= seuil || !nom.includes(' ')) return [nom]
  const milieu = nom.length / 2
  let coupe = -1
  for (let i = 0; i < nom.length; i++)
    if (nom[i] === ' ' && (coupe < 0 || Math.abs(i - milieu) < Math.abs(coupe - milieu))) coupe = i
  return [nom.slice(0, coupe), nom.slice(coupe + 1)]
}

// ---- LA LÉGENDE --------------------------------------------------------------

// LES COURSIVES ONT UN NOM POUR LE JOUEUR. Les clés de `typesLiens` sont des
// identifiants de données : la fiche de la cérémonie disait « coursive « alt »
// ouverte », la légende de LA STATION listait « main » et « alt ». Une
// coursive conditionnelle se nomme par son badge (« ❄ GLACE »), celui que le
// plan porte déjà ; une clé inconnue se montre telle quelle plutôt que rien.
const NOMS_LIENS: Record<string, string> = {
  main: 'voie principale',
  alt: 'voie secondaire',
  retour: 'retour sur ses pas',
}
export function nomLien(c: CarteStation, type: string): string {
  return NOMS_LIENS[type] ?? (c.typesLiens[type]?.badge ?? type).toLowerCase()
}

/** Une ligne de la légende : ce que le plan montre SANS le dire. */
export interface EntreeLegende {
  genre: 'etat' | 'nature' | 'coursive'
  cle: string
  /** le signe tel que le plan le porte ; vide : une pastille dessinée par la feuille */
  signe: string
  texte: string
  couleur?: string
  tirets?: boolean
}

/** LA LÉGENDE, DEPUIS LES DONNÉES : seulement ce que CETTE carte montre — pas
 *  de cadenas sur une carte sans orbe, pas de glyphe pour une nature absente.
 *  « Vous êtes ici » et « objectif » n'y sont pas : le plan les écrit en
 *  toutes lettres. Elle n'existait que sur l'écran LA STATION, réduite aux
 *  types de coursive ; la cérémonie, où le choix se prend, n'en avait pas. */
export function legendeCarte(c: CarteStation): EntreeLegende[] {
  const out: EntreeLegende[] = [
    { genre: 'etat', cle: 'allume', signe: '', texte: 'allumé : joignable d’ici' },
    { genre: 'etat', cle: 'eteint', signe: '', texte: 'éteint : hors de portée' },
    { genre: 'etat', cle: 'traverse', signe: '✓', texte: 'déjà traversé' },
  ]
  const typesUtilises = new Set(c.liens.map((l) => l.type))
  if ([...typesUtilises].some((t) => c.typesLiens[t]?.condition))
    out.push({ genre: 'etat', cle: 'verrou', signe: '🔒', texte: 'un orbe manque' })
  if (c.modules.some((m) => m.cran > 0))
    out.push({ genre: 'etat', cle: 'cran', signe: '+1', texte: 'confinement : plus dur, paie plus', couleur: c.palette.chaud })
  // les natures, dans l'ordre de leur première apparition sur la carte
  const vues = new Set<TypeModule>()
  for (const m of c.modules) {
    if (vues.has(m.type) || !GLYPHES[m.type]) continue
    vues.add(m.type)
    out.push({ genre: 'nature', cle: m.type, signe: GLYPHES[m.type], texte: c.types[m.type].toLowerCase() })
  }
  for (const [type, st] of Object.entries(c.typesLiens)) {
    if (!typesUtilises.has(type)) continue
    out.push({
      genre: 'coursive', cle: type, signe: '', couleur: st.couleur, tirets: !!st.tirets,
      texte: nomLien(c, type) + (st.condition ? ' — orbe requis' : ''),
    })
  }
  return out
}

/** La légende en éléments de liste, pour les deux écrans qui montrent le plan. */
export function legendeCarteHTML(c: CarteStation): string {
  return legendeCarte(c)
    .map((e) => {
      const signe =
        e.genre === 'coursive'
          ? `<i class="cs-lg-trait${e.tirets ? ' cs-lg-tirets' : ''}" style="--c:${esc(e.couleur ?? '')}"></i>`
          : e.signe
            ? `<i class="cs-lg-signe"${e.couleur ? ` style="color:${esc(e.couleur)}"` : ''}>${esc(e.signe)}</i>`
            : `<i class="cs-lg-fut cs-lg-${esc(e.cle)}"></i>`
      return `<li class="cs-lg cs-lg-${e.genre}">${signe}${esc(e.texte)}</li>`
    })
    .join('')
}

// ---- LE CADRE ----------------------------------------------------------------

// L'ÉTIQUETTE SOUS LE FÛT, en unités de scène. Les tailles de police vivent
// dans la feuille (.cs-nom 15, .cs-temp 13) ; ces pas-ci doivent les suivre.
const NOM_BASE = 22 // du bas du fût à la ligne de base du nom
const NOM_PAS = 18 // d'une ligne du nom à la suivante
const TEMP_PAS = 16 // du nom à la jauge de température
const PLAQUE_HAUT = 30 // la plaque « vous êtes ici » / « objectif », au-dessus du fût

export interface Cadre {
  x: number
  y: number
  w: number
  h: number
}

/** CE QUE LE PLAN MONTRE. L'éditeur voit toute la scène. Le JEU cadre ce qui
 *  se joue : les modules, leurs étiquettes, leurs plaques, les badges.
 *
 *  Pourquoi : la scène fait 2100 de large pour loger le télescope, et l'arc
 *  de coque la tient à 804 de haut — le jouable n'en occupe que les deux
 *  tiers. Cadrée entière dans la cérémonie d'un écran de 1280 × 800, elle
 *  tombait à 0,58 : un nom de module à 6,3 px, une température à 6,9 px
 *  (mesuré le 10/11). Le décor déborde du cadre au lieu de le remplir — et
 *  comme un SVG ne coupe qu'à sa boîte, un cadre plus large que le plan en
 *  montre davantage tout seul. */
export function cadreCarte(c: CarteStation, mode: OptionsDessin['mode']): Cadre {
  const tout: Cadre = { x: 0, y: 0, w: c.scene.width, h: c.scene.height }
  if (mode === 'editeur' || c.modules.length === 0) return tout
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const m of c.modules) {
    x0 = Math.min(x0, m.x - m.w / 2)
    x1 = Math.max(x1, m.x + m.w / 2)
    y0 = Math.min(y0, m.y - m.h / 2 - PLAQUE_HAUT)
    y1 = Math.max(y1, m.y + m.h / 2 + NOM_BASE + (lignesNom(m.nom).length - 1) * NOM_PAS + TEMP_PAS + 8)
  }
  // la marge des côtés laisse voir d'où part la station (l'arc de coque) ;
  // celle du haut et du bas est juste de quoi respirer — c'est la hauteur
  // qui décide de l'échelle. Le télescope s'amarre DANS ce cadre, au-dessus
  // de son module (amarrageTelescope)
  // LA MARGE s'arrête au bord de la scène ; un module, jamais — posé à cheval
  // sur le bord par l'éditeur, il doit rester entier dans le cadre
  x0 = Math.min(x0, Math.max(0, x0 - 110))
  x1 = Math.max(x1, Math.min(c.scene.width, x1 + 110))
  y0 = Math.min(y0, Math.max(0, y0 - 14))
  y1 = Math.max(y1, Math.min(c.scene.height, y1 + 14))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

// ---- LE DÉCOR ----------------------------------------------------------------

type Pt = [number, number]
const bezier = (p0: Pt, c1: Pt, c2: Pt, p1: Pt, t: number): Pt => {
  const u = 1 - t
  return [
    u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
    u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
  ]
}
const nombres = (d: string): number[] => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)

/** L'ARC DE COQUE : un croissant en deux courbes (extérieure, intérieure),
 *  ses nervures et ses lumières CALCULÉES sur les courbes — la maquette les
 *  posait à la main ; ici l'arc peut changer de forme sans qu'on les refasse. */
function arcDeCoque(c: CarteStation, d: DecorCarte): string {
  const e = nombres(d.exterieur ?? '')
  const i = nombres(d.interieur ?? '')
  if (e.length < 8 || i.length < 6) return ''
  const p0: Pt = [e[0], e[1]]
  const ec1: Pt = [e[2], e[3]]
  const ec2: Pt = [e[4], e[5]]
  const p1: Pt = [e[6], e[7]]
  const ic1: Pt = [i[0], i[1]]
  const ic2: Pt = [i[2], i[3]]
  const p2: Pt = [i[4], i[5]]
  const chemin = `${d.exterieur} ${d.interieur} Z`
  const P = c.palette
  let nervures = ''
  let lumieres = ''
  for (const t of [0.18, 0.34, 0.5, 0.66, 0.82]) {
    const a = bezier(p0, ec1, ec2, p1, t)
    const b = bezier(p1, ic1, ic2, p2, 1 - t)
    nervures += `M${n1(a[0])} ${n1(a[1])} L${n1(b[0])} ${n1(b[1])} `
    const lx = a[0] + (b[0] - a[0]) * 0.3
    const ly = (a[1] + b[1]) / 2
    lumieres += `<rect x="${n1(lx - 2)}" y="${n1(ly - 8)}" width="4" height="16"/>`
  }
  // la coursive d'amarrage du module ancré : un moignon de paroi qui entre
  // dans le fût par son flanc gauche
  const anc = moduleParId(c, d.ancrage)
  const amarrage = anc
    ? `<path d="M${n1(anc.x - anc.w / 2 - 44)} ${n1(anc.y)} H${n1(anc.x - anc.w / 2 + 4)}" stroke="${P.couloirParoi}" stroke-width="22"/>`
    : ''
  return (
    `<g class="cs-arc" data-decor="${esc(d.id)}" filter="url(#cs-ombre)">` +
    `<path d="${esc(chemin)}" fill="url(#cs-plaque)" stroke="${P.bord}" stroke-width="3"/>` +
    `<path d="${esc(chemin)}" fill="none" stroke="${c.zones[0]?.couleur ?? COURANT}" stroke-width="1" opacity=".5"/>` +
    `<path d="${nervures}" stroke="${P.bord}" stroke-width="3"/>` +
    `<g fill="${c.zones[0]?.couleur ?? COURANT}" class="cs-lumieres">${lumieres}</g>` +
    amarrage +
    `</g>`
  )
}

// LE TÉLESCOPE, en repère local (la maquette du concepteur) : son amarre à
// l'origine, le fût le long de x jusqu'au pare-soleil (436), les panneaux
// solaires de part et d'autre (±150)
const TEL_LONG = 436
const TEL_DEMI = 150
/** réduit : à sa taille de maquette il faisait deux fois et demie l'observatoire */
const TEL_ECHELLE = 0.45
/** penché de huit degrés : à plat, il se lisait comme un bandeau du plan */
const TEL_PENTE = 8

export interface AmarrageTelescope {
  /** l'amarre du télescope, dans la scène */
  x: number
  y: number
  rotation: number
  echelle: number
  /** le tube coudé, du module à l'amarre */
  tube: string
  /** où s'écrit son nom */
  nom: { x: number; y: number }
  /** ce que le télescope occupe, nom compris */
  boite: { x0: number; y0: number; x1: number; y1: number }
}

/** OÙ LE TÉLESCOPE S'AMARRE : au-dessus de son module d'ancrage, réduit,
 *  relié par un tube coudé qui sort du coin du module et l'aborde dans son
 *  axe — CALCULÉ, plus lu dans les données.
 *
 *  Pourquoi : la maquette le posait à droite de l'observatoire, à pleine
 *  taille, par des coordonnées écrites dans la carte. Depuis que le jeu
 *  cadre ce qui se joue (cadreCarte), il sortait du plan — on n'en voyait
 *  que le tube. Et des coordonnées en dur ne suivaient ni un observatoire
 *  déplacé dans l'éditeur, ni une carte PUBLIÉE, qui remplace la livrée avec
 *  son propre décor. Sans place au-dessus (un module contre le haut de la
 *  scène), il s'amarre dessous. null : l'ancrage n'existe pas. */
export function amarrageTelescope(c: CarteStation, d: DecorCarte): AmarrageTelescope | null {
  const m = moduleParId(c, d.ancrage)
  if (!m) return null
  const E = TEL_ECHELLE
  const cos = Math.cos((TEL_PENTE * Math.PI) / 180)
  const sin = Math.sin((TEL_PENTE * Math.PI) / 180)
  // sa demi-hauteur et sa demi-longueur dans la scène, penché
  const demiH = (TEL_DEMI * cos + (TEL_LONG / 2) * sin) * E
  const demiL = ((TEL_LONG / 2) * cos + TEL_DEMI * sin) * E
  // au-dessus : la plaque du module (« objectif ») reste dégagée ; dessous :
  // son nom et sa température
  const dessus = m.y - m.h / 2 - PLAQUE_HAUT - 12 - 2 * demiH >= 0
  const s = dessus ? -1 : 1
  const cx = m.x - 20
  const cy = dessus
    ? m.y - m.h / 2 - PLAQUE_HAUT - 12 - demiH
    : m.y + m.h / 2 + NOM_BASE + (lignesNom(m.nom).length - 1) * NOM_PAS + TEMP_PAS + 20 + demiH
  // l'axe du fût : il pointe à droite, relevé du côté opposé au module
  const ax = cos
  const ay = s * sin
  const x = cx - (TEL_LONG / 2) * E * ax
  const y = cy - (TEL_LONG / 2) * E * ay
  // le tube part de l'intérieur du coin du module (le fût du module, dessiné
  // après le décor, couvre son départ) et arrive dans l'axe de l'amarre
  const dx = m.x - 0.36 * m.w
  const dy = m.y + s * 0.33 * m.h
  const k = 118 * E
  const tube = `M${n1(dx)} ${n1(dy)} C ${n1(dx - 30)} ${n1(dy + s * 37)}, ${n1(x - k * ax)} ${n1(y - k * ay)}, ${n1(x)} ${n1(y)}`
  // le nom, à gauche de l'amarre : sous le télescope, il touchait la plaque
  const nom = { x: x - 100, y: cy }
  return {
    x,
    y,
    rotation: s * TEL_PENTE,
    echelle: E,
    tube,
    nom,
    boite: { x0: nom.x - 82, y0: cy - demiH, x1: cx + demiL, y1: cy + demiH },
  }
}

/** LE TÉLESCOPE AMARRÉ : les vecteurs de la maquette, en repère local — sa
 *  place, son échelle et son tube viennent de l'amarrage. */
function telescope(c: CarteStation, d: DecorCarte): string {
  const a = amarrageTelescope(c, d)
  if (!a) return ''
  const P = c.palette
  // le tube suit l'échelle du télescope, sans descendre sous un trait lisible
  const ep = (l: number) => n1(l * Math.max(0.6, a.echelle))
  const tube =
    `<path d="${a.tube}" fill="none" stroke="${P.couloirParoi}" stroke-width="${ep(18)}"/>` +
    `<path d="${a.tube}" fill="none" stroke="${P.couloirSol}" stroke-width="${ep(12)}"/>` +
    `<path d="${a.tube}" fill="none" stroke="${P.couloirAnneau}" stroke-width="${ep(22)}" stroke-dasharray="4 26"/>`
  const cyan = c.zones[0]?.couleur ?? COURANT
  return (
    `<g class="cs-telescope" data-decor="${esc(d.id)}">` +
    tube +
    `<g transform="translate(${n1(a.x)} ${n1(a.y)}) rotate(${n1(a.rotation)}) scale(${n4(a.echelle)})" filter="url(#cs-ombre)">` +
    `<rect x="0" y="-14" width="40" height="28" rx="3" fill="${P.plaque}" stroke="#4a6478" stroke-width="2"/>` +
    `<path d="M8 -14V14 M20 -14V14 M32 -14V14" stroke="${P.bord}" stroke-width="1.5"/>` +
    `<path d="M200 -36 V-150 M200 36 V150" stroke="#5a7a96" stroke-width="4"/>` +
    `<g stroke="#3f5c85" stroke-width="2">` +
    `<rect x="110" y="-150" width="180" height="96" fill="url(#cs-cellules)"/>` +
    `<rect x="110" y="54" width="180" height="96" fill="url(#cs-cellules)"/></g>` +
    `<path d="M200 -150 V-54 M200 54 V150 M110 -102 H290 M110 102 H290" stroke="#5a7a96" stroke-width="2"/>` +
    `<rect x="40" y="-38" width="330" height="76" rx="6" fill="url(#cs-plaque)" stroke="#4a6478" stroke-width="2.5"/>` +
    `<rect x="40" y="-38" width="330" height="76" rx="6" fill="none" stroke="rgba(150,200,235,.3)" stroke-width="1"/>` +
    `<path d="M40 -12 H370 M40 12 H370" stroke="rgba(150,200,235,.14)" stroke-width="1"/>` +
    `<path d="M120 -38 V38 M170 -38 V38 M230 -38 V38 M300 -38 V38" stroke="${P.bord}" stroke-width="2.5"/>` +
    `<rect x="230" y="-30" width="70" height="60" fill="#1f2f44" stroke="${P.couloirAnneau}" stroke-width="1.5"/>` +
    `<path d="M240 -20 H290 M240 -8 H290 M240 4 H290 M240 16 H290" stroke="rgba(150,200,235,.16)" stroke-width="1"/>` +
    `<g fill="${cyan}" class="cs-lumieres"><rect x="60" y="-30" width="10" height="3"/><rect x="60" y="27" width="10" height="3"/><rect x="345" y="-30" width="10" height="3"/><rect x="345" y="27" width="10" height="3"/></g>` +
    `<rect x="360" y="-42" width="24" height="84" rx="4" fill="#243648" stroke="#5a7a96" stroke-width="2.5"/>` +
    `<ellipse cx="384" cy="0" rx="6" ry="36" fill="#05080f" stroke="${cyan}" stroke-width="1.5"/>` +
    `<path d="M384 -42 L430 -78 L436 -68 L388 -34 Z" fill="${P.plaque}" stroke="#5a7a96" stroke-width="2"/>` +
    `<path d="M100 38 L100 74" stroke="#4a6478" stroke-width="3"/>` +
    `<ellipse cx="100" cy="84" rx="16" ry="10" fill="#16253a" stroke="#5a7a96" stroke-width="2"/>` +
    `<path d="M100 84 V70" stroke="${COURANT}" stroke-width="1.5"/>` +
    `</g>` +
    `<text class="cs-decor-nom" x="${n1(a.nom.x)}" y="${n1(a.nom.y - 3)}">TÉLESCOPE SPATIAL</text>` +
    `<text class="cs-decor-sous" x="${n1(a.nom.x)}" y="${n1(a.nom.y + 12)}">AMARRÉ · HORS ACCÈS</text>` +
    `</g>`
  )
}

function decor(c: CarteStation): string {
  return c.decor
    .map((d) =>
      d.type === 'coque-croissant' ? arcDeCoque(c, d) : d.type === 'telescope-hubble' ? telescope(c, d) : '',
    )
    .join('')
}

// ---- LES COURSIVES -------------------------------------------------------------

interface LienDessine {
  i: number
  l: LienCarte
  d: string
  x1: number
  y1: number
  x2: number
  y2: number
  couleur: string
  epaisseur: number
  coque: number
  tirets: string | null
  badge: string | null
  active: boolean
  parcourue: boolean
  /** elle part d'ici, mais l'orbe manque */
  fermee: boolean
  /** elle part d'un module qu'on ne peut plus atteindre */
  morte: boolean
}

function liensDessines(c: CarteStation, o: OptionsDessin): LienDessine[] {
  const out: LienDessine[] = []
  const joignables = encoreJoignables(c, o)
  c.liens.forEach((l, i) => {
    const t = traceLien(c, l)
    const st = c.typesLiens[l.type]
    if (!t || !st) return
    const dIci = o.courant !== null && l.de === o.courant
    // UNE COURSIVE VERROUILLÉE NE COULE PAS : les trois coursives du hub
    // défilaient vers leurs modules, deux cadenas compris — le flux disait
    // « par ici » devant une porte close
    const fermee = dIci && orbeRequis(c, l, o.orbes) !== null
    const active = dIci && !fermee
    const parcourue =
      o.visites.includes(l.de) && (o.visites.includes(l.vers) || l.vers === o.courant)
    // CE QU'ON NE PRENDRA PLUS : une coursive qui part d'un module hors de
    // portée. Elle restait à 75 % — plus vive que la trace du chemin parcouru
    // (35 %) —, et la voie principale gardait son halo jusque dans le dos du
    // joueur : le réseau mort criait plus fort que la route
    const morte = o.courant !== null && !dIci && !parcourue && !joignables.has(l.de)
    out.push({
      i, l, ...t,
      couleur: st.couleur, epaisseur: st.epaisseur, coque: st.coque,
      tirets: st.tirets ?? (active ? '14 14' : null),
      badge: st.badge ?? null, active, parcourue, fermee, morte,
    })
  })
  return out
}

function coursives(c: CarteStation, L: LienDessine[]): string {
  const P = c.palette
  // trois couches, chacune sur TOUTES les coursives : une paroi ne doit
  // jamais recouvrir le sol de sa voisine au croisement
  const paroi = L.map((e) => `<path d="${e.d}" stroke="${P.couloirParoi}" stroke-width="${n1(e.coque)}"/>`).join('')
  const sol = L.map((e) => `<path d="${e.d}" stroke="${P.couloirSol}" stroke-width="${n1(e.coque - 6)}"/>`).join('')
  const anneaux = L.map(
    (e) => `<path d="${e.d}" stroke="${P.couloirAnneau}" stroke-width="${n1(e.coque + 6)}" stroke-dasharray="4 44"/>`,
  ).join('')
  return `<g class="cs-coursives" fill="none" stroke-linecap="butt">${paroi}${sol}${anneaux}</g>`
}

function routes(L: LienDessine[], o: OptionsDessin): string {
  return (
    `<g class="cs-routes" fill="none" stroke-linecap="round">` +
    L.map((e) => {
      const sel = o.lienSelection === e.i
      const cl =
        'cs-route' + (e.l.type === 'main' ? ' cs-principale' : '') + (e.active ? ' cs-active' : '') + (e.parcourue ? ' cs-parcourue' : '') +
        (e.fermee ? ' cs-fermee' : '') + (e.morte ? ' cs-morte' : '') + (sel ? ' cs-lien-sel' : '')
      // quatre intensités, de ce qui se décide maintenant à ce qui ne compte
      // plus : la coursive ouverte d'ici, celles de la suite, la trace, le mort
      const op = e.parcourue ? 0.35 : e.active ? 1 : e.morte ? 0.2 : e.fermee ? 0.6 : e.l.type === 'main' ? 0.9 : 0.75
      // la coursive qu'on peut prendre s'épaissit : une « alt » ouverte d'ici
      // ne se distinguait de ses voisines que par un halo gris sur gris
      const ep = e.active ? e.epaisseur + 1.5 : e.epaisseur
      let s =
        `<path class="${cl}" data-lien="${e.i}" d="${e.d}" stroke="${e.couleur}" stroke-width="${n1(ep)}"` +
        (e.tirets ? ` stroke-dasharray="${e.tirets}"` : '') +
        ` opacity="${op}" style="--c:${e.couleur}"/>`
      if (o.mode === 'editeur') {
        // le sens de la coursive : un chevron aux deux tiers, tourné vers l'arrivée
        const k = 0.66
        const x = e.x1 + (e.x2 - e.x1) * k
        const y = e.y1 + (e.y2 - e.y1) * k
        const a = (Math.atan2(e.y2 - e.y1, e.x2 - e.x1) * 180) / Math.PI
        s +=
          `<path class="cs-sens" d="M-7 -6 L4 0 L-7 6" transform="translate(${n1(x)} ${n1(y)}) rotate(${n1(a)})" stroke="${e.couleur}" stroke-width="2"/>` +
          // la zone de prise : large et invisible, pour attraper le trait au doigt
          `<path class="cs-lien-prise" data-lien="${e.i}" d="${e.d}" stroke="transparent" stroke-width="${n1(Math.max(e.coque, 22))}"/>`
      }
      return s
    }).join('') +
    `</g>`
  )
}

function badges(c: CarteStation, L: LienDessine[]): string {
  return (
    `<g class="cs-badges">` +
    L.filter((e) => e.badge)
      .map((e) => {
        const x = (e.x1 + e.x2) / 2
        const y = (e.y1 + e.y2) / 2 + (e.y2 < e.y1 ? -20 : 20)
        const texte = e.badge!
        const w = texte.length * 8.3 + 18
        return (
          `<g class="cs-badge" transform="translate(${n1(x)} ${n1(y)})">` +
          `<rect x="${n1(-w / 2)}" y="-11" width="${n1(w)}" height="22" rx="3" fill="${c.palette.plaqueSombre}" stroke="${e.couleur}"/>` +
          `<text x="0" y="4.5" fill="${e.couleur}">${esc(texte)}</text></g>`
        )
      })
      .join('') +
    `</g>`
  )
}

// ---- LES MODULES ---------------------------------------------------------------

function vecteurs(m: ModuleCarte, accent: string, P: CarteStation['palette']): string {
  // les détails du fût, en repère 0-100 étiré au module (comme la maquette) ;
  // le trait ne s'étire pas (vector-effect), la géométrie si
  const rond = m.forme === 'rond'
  const dome = m.forme === 'octogone-dome'
  const ns = 'vector-effect="non-scaling-stroke"'
  let corps = `<rect width="100" height="100" fill="url(#cs-plaque)"/>`
  if (rond)
    corps +=
      `<circle cx="50" cy="50" r="40" fill="none" stroke="rgba(150,200,235,.35)" stroke-width="2" ${ns}/>` +
      `<circle cx="50" cy="50" r="22" fill="${P.plaqueSombre}" stroke="${accent}" stroke-width="1.5" ${ns}/>` +
      `<path d="M50 10V28M50 72V90M10 50H28M72 50H90" stroke="rgba(150,200,235,.35)" stroke-width="1.5" ${ns}/>`
  else if (dome)
    corps +=
      `<circle cx="50" cy="50" r="28" fill="url(#cs-dome)" stroke="#a7b8ff" stroke-width="1.5" ${ns}/>` +
      `<path d="M22 50H78M50 22V78M30 30L70 70M70 30L30 70" stroke="rgba(200,215,255,.35)" stroke-width="1" ${ns}/>` +
      `<circle cx="50" cy="50" r="16" fill="none" stroke="rgba(200,215,255,.35)" stroke-width="1" ${ns}/>`
  else
    corps +=
      `<polygon points="27,8 73,8 92,30 92,70 73,92 27,92 8,70 8,30" fill="none" stroke="rgba(150,200,235,.32)" stroke-width="1.5" ${ns}/>` +
      `<polygon points="33,16 67,16 84,34 84,66 67,84 33,84 16,66 16,34" fill="#0d1826" stroke="rgba(150,200,235,.16)" stroke-width="1" ${ns}/>` +
      `<path d="M50 16V84M16 50H84" stroke="rgba(150,200,235,.14)" stroke-width="1" ${ns}/>` +
      `<path d="M33 16L16 34M67 16L84 34M16 66L33 84M84 66L67 84" stroke="rgba(150,200,235,.14)" stroke-width="1" ${ns}/>` +
      `<g fill="${accent}"><rect x="47" y="9" width="6" height="3"/><rect x="47" y="88" width="6" height="3"/><rect x="9" y="47" width="3" height="6"/><rect x="88" y="47" width="3" height="6"/></g>`
  return corps
}

function module(c: CarteStation, m0: ModuleCarte, k: number, o: OptionsDessin, joignables: ReadonlySet<string>): string {
  const P = c.palette
  // un « ? » révélé se dessine sous sa nature — glyphe, nom, cran
  const nature = o.revelations?.[m0.id]
  const m = m0.type === 'inconnu' && nature ? moduleRevele(c, m0, nature) : m0
  const zc = zoneDe(c, m)?.couleur ?? P.texteSecondaire
  const rond = m.forme === 'rond'
  const boss = m.type === 'boss'
  const jonction = m.type === 'jonction'
  const etat = etatModule(c, o, m.id, joignables)
  const estCourant = etat === 'ici'
  const visite = o.visites.includes(m.id)
  const verrou = etat === 'verrou'
  const cliquable = etat === 'joignable' || verrou || etat === 'retour'
  const ferme = etat === 'ferme'
  const objectif = o.courant !== null && m.id === c.regles.objectif
  const sel = o.selection === m.id
  const edition = o.mode === 'editeur'

  const bord = estCourant ? ICI : sel ? P.texte : cliquable ? (verrou ? P.texteSecondaire : zc)
    : visite ? c.zones[0]?.couleur ?? COURANT : jonction ? P.texteSecondaire : edition ? zc : INERTE
  const fond = estCourant ? 'rgba(99,183,230,.35)' : visite ? 'rgba(99,183,230,.18)' : boss ? 'rgba(201,154,255,.2)' : P.plaqueSombre
  // un module verrouillé n'invite pas : son nom en teinte de zone le faisait
  // lire comme ouvert, à côté de celui qui l'était
  const texte = estCourant || sel ? P.texte : (cliquable && !verrou) || edition ? zc : P.texteSecondaire
  // LE CORPS DIT L'ÉTAT, en quatre crans : ce qui se joue maintenant (ici, les
  // portes, l'objectif) à plein ; le chemin parcouru en retrait — il brillait
  // autant que le module où l'on se tient ; la suite à 60 % ; et ce qu'on ne
  // pourra plus atteindre, presque éteint
  const opacite = edition || estCourant || cliquable || objectif || (boss && !ferme) ? 1 : etat === 'traverse' ? 0.7 : ferme ? 0.3 : 0.6
  const accent = estCourant ? ICI : zc
  const glyphe = estCourant ? '◈' : GLYPHES[m.type]
  const fonte = boss ? 34 : jonction ? 0 : 26

  const l = m.x - m.w / 2
  const t = m.y - m.h / 2
  const forme = (inset: number): string =>
    rond
      ? `<circle cx="${n1(m.x)}" cy="${n1(m.y)}" r="${n1(Math.min(m.w, m.h) / 2 - inset)}"`
      : `<polygon points="${octogone(l + inset, t + inset, m.w - 2 * inset, m.h - 2 * inset)}"`
  const classes =
    'cs-mod cs-' + m.type +
    (estCourant ? ' cs-courant' : '') + (visite && !estCourant ? ' cs-visite' : '') +
    (ferme ? ' cs-ferme' : '') + (objectif ? ' cs-objectif' : '') +
    (cliquable ? (verrou ? ' cs-verrou' : ' cs-cible') : '') + (sel ? ' cs-sel' : '') +
    (edition ? ' cs-editable' : '')
  const clip = `cs-clip-${k}`

  // L'ÉTAT SE DIT AUSSI EN MOTS : un lecteur d'écran n'entendait que le nom et
  // la nature — rien de ce que le plan dit par la couleur et l'éclat
  const dit =
    `${esc(m.nom)} — ${esc(c.types[m.type])}${m.cran > 0 ? ` — confinement +${m.cran}` : ''}` +
    (objectif && !estCourant ? ' — objectif' : '') + (etat !== 'neutre' ? ` — ${ETATS_DITS[etat]}` : '')
  let s =
    `<g class="${classes}" data-mod="${esc(m.id)}" tabindex="0" role="button" style="--z:${zc};--bord:${bord}" aria-label="${dit}">` +
    `<title>${dit}</title>` +
    `<clipPath id="${clip}">${forme(3)}/></clipPath>` +
    // LE SOCLE OPAQUE, sous le fût : les coursives vont de centre à centre,
    // donc PASSENT SOUS chaque module. L'extinction (60 %) portait sur tout le
    // groupe : un module éteint devenait une vitre, et l'on voyait jusqu'à six
    // coursives se croiser sur son glyphe — le plan se lisait comme un nœud de
    // traits partout où le joueur ne pouvait pas aller (capture du 10/11).
    // Le socle est plein, à la couleur du fond ; seul le CORPS s'éteint dessus.
    `${forme(0)} class="cs-socle" fill="${P.fond}"/>` +
    `<g class="cs-corps" opacity="${opacite}">` +
    `${forme(0)} class="cs-bord" fill="${bord}"/>` +
    `${forme(3)} class="cs-fond" fill="${fond}"/>` +
    // les détails du fût, dessinés en repère 0-100 puis ÉTIRÉS au module.
    // Pas un <svg> imbriqué : Chrome lit alors le clip-path dans le repère
    // du viewBox intérieur, et le fût entier disparaissait sous sa coque —
    // mesuré au banc, le HUB visité n'était plus qu'une plaque bleue pleine.
    // La découpe est donc posée sur un groupe SANS transformation (repère de
    // la scène), et l'étirement sur un groupe dedans.
    `<g class="cs-vecteurs" clip-path="url(#${clip})" opacity="${estCourant ? 0.7 : visite ? 0.75 : 1}">` +
    `<g transform="translate(${n1(l + 3)} ${n1(t + 3)}) scale(${n4((m.w - 6) / 100)} ${n4((m.h - 6) / 100)})">` +
    vecteurs(m, accent, P) +
    `</g></g>`
  if (fonte > 0 && glyphe)
    s += `<text class="cs-glyphe" x="${n1(m.x)}" y="${n1(m.y)}" font-size="${fonte}" fill="${estCourant ? P.texte : zc}">${glyphe}</text>`
  s += `</g>`
  if (verrou)
    s += `${forme(0)} class="cs-voile" fill="rgba(3,7,16,.55)"/><text class="cs-cadenas" x="${n1(m.x)}" y="${n1(m.y)}">🔒</text>`
  if (visite && !estCourant)
    s += `<text class="cs-coche" x="${n1(l + m.w - 10)}" y="${n1(t + 10)}">✓</text>`
  // LE CONFINEMENT SUPÉRIEUR se lit sur le plan avant qu'on s'y engage : le
  // joueur pèse la route en voyant la marque, comme l'élite d'un Slay the
  // Spire — plus dur, plus généreux
  if (m.cran > 0)
    s += `<text class="cs-cran" x="${n1(l + m.w - 12)}" y="${n1(t + m.h - 10)}" fill="${P.chaud}">+${m.cran}</text>`

  // l'étiquette : le nom sous le fût, puis la température
  const etiquette = !jonction || sel || estCourant || edition
  if (etiquette) {
    const y0 = t + m.h + NOM_BASE
    const lignes = lignesNom(m.nom)
    s +=
      `<text class="cs-nom" x="${n1(m.x)}" y="${n1(y0)}" fill="${texte}"${ferme ? ' opacity="0.45"' : ''}>` +
      lignes.map((li, i) => `<tspan x="${n1(m.x)}" dy="${i === 0 ? 0 : NOM_PAS}">${esc(li)}</tspan>`).join('') +
      `</text>`
    if (o.afficherTemp) {
      const yt = y0 + (lignes.length - 1) * NOM_PAS + TEMP_PAS
      const tc = couleurTemperature(c, m.temp)
      const larg = Math.max(4, Math.min(100, (m.temp + 60) / 1.6))
      s +=
        `<g class="cs-temp" transform="translate(${n1(m.x)} ${n1(yt)})"${ferme ? ' opacity="0.45"' : ''}>` +
        `<rect x="-38" y="-2.5" width="44" height="5" fill="rgba(150,200,235,.12)"/>` +
        `<rect x="-38" y="-2.5" width="${n1((44 * larg) / 100)}" height="5" fill="${tc}"/>` +
        `<text x="12" y="4.5" fill="${tc}">${n1(m.temp)}°</text></g>`
      // en édition, la mesure qui compte pour la run : les niveaux du biome
      if (edition && m.niveaux > 0)
        s += `<text class="cs-niv" x="${n1(m.x)}" y="${n1(yt + 17)}" fill="${P.texteSecondaire}">${m.niveaux} NIV.${m.biome ? ' · ' + esc(m.biome) : ''}</text>`
    }
  }
  // LES DEUX PLAQUES QUI RÉPONDENT AUX DEUX QUESTIONS DU PLAN, en toutes
  // lettres au-dessus du fût : où suis-je, où vais-je. Le courant ne se
  // disait que par un éclat et un glyphe, l'objectif par rien du tout — il
  // fallait survoler pour l'apprendre. Des mots : ni la couleur ni la forme
  // ne portent seules le sens.
  const plaque = (mot: string, couleur: string, classe: string): string => {
    const w = mot.length * 8.7 + 18
    return (
      `<g class="cs-plaque ${classe}" transform="translate(${n1(m.x)} ${n1(t - 18)})">` +
      `<rect x="${n1(-w / 2)}" y="-11" width="${n1(w)}" height="22" rx="3" fill="${P.plaqueSombre}" stroke="${couleur}"/>` +
      `<text x="0" y="4.5" fill="${couleur}">${mot}</text></g>`
    )
  }
  if (estCourant) s += plaque('VOUS ÊTES ICI', ICI, 'cs-plaque-ici')
  else if (objectif) s += plaque('OBJECTIF', zc, 'cs-plaque-objectif')
  if (edition && sel) {
    // les poignées de redimensionnement, aux quatre coins
    const poignees: [string, number, number][] = [
      ['nw', l, t], ['ne', l + m.w, t], ['sw', l, t + m.h], ['se', l + m.w, t + m.h],
    ]
    s += poignees
      .map(([p, x, y]) => `<rect class="cs-poignee" data-poignee="${p}" x="${n1(x - 5)}" y="${n1(y - 5)}" width="10" height="10"/>`)
      .join('')
  }
  return s + `</g>`
}

// ---- LE TOUT ---------------------------------------------------------------------

function defs(c: CarteStation): string {
  const P = c.palette
  const [d0, d1, d2] = [P.dome[0], P.dome[1] ?? P.dome[0], P.dome[2] ?? P.dome[P.dome.length - 1]]
  return (
    `<defs>` +
    `<linearGradient id="cs-plaque" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.plaque}"/><stop offset="1" stop-color="${P.plaqueSombre}"/></linearGradient>` +
    `<radialGradient id="cs-dome" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="${d0}"/><stop offset=".45" stop-color="${d1}"/><stop offset="1" stop-color="${d2}"/></radialGradient>` +
    `<pattern id="cs-cellules" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#0f1a36"/><path d="M10 0H0V10" fill="none" stroke="#2c4a8a" stroke-width="1"/></pattern>` +
    `<pattern id="cs-hex" width="28" height="48.5" patternUnits="userSpaceOnUse"><path d="M14 0 L28 8 L28 24 L14 32 L0 24 L0 8 Z M14 32 L14 48.5" fill="none" stroke="rgba(150,200,235,.06)" stroke-width="1"/></pattern>` +
    `<filter id="cs-ombre" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000" flood-opacity=".75"/></filter>` +
    `</defs>`
  )
}

function grille(c: CarteStation, pas: number): string {
  if (pas <= 0) return ''
  const gros = pas * 6
  return (
    `<pattern id="cs-grille" width="${n1(pas)}" height="${n1(pas)}" patternUnits="userSpaceOnUse"><path d="M${n1(pas)} 0H0V${n1(pas)}" fill="none" stroke="rgba(150,200,235,.05)" stroke-width="1"/></pattern>` +
    `<pattern id="cs-grille-6" width="${n1(gros)}" height="${n1(gros)}" patternUnits="userSpaceOnUse"><path d="M${n1(gros)} 0H0V${n1(gros)}" fill="none" stroke="rgba(150,200,235,.1)" stroke-width="1"/></pattern>` +
    `<rect class="cs-grille" width="${c.scene.width}" height="${c.scene.height}" fill="url(#cs-grille)"/>` +
    `<rect class="cs-grille" width="${c.scene.width}" height="${c.scene.height}" fill="url(#cs-grille-6)"/>`
  )
}

/** LA CARTE COMPLÈTE, en une chaîne SVG. */
export function dessinCarteSVG(c: CarteStation, o: OptionsDessin): string {
  const L = liensDessines(c, o)
  const joignables = encoreJoignables(c, o)
  const W = c.scene.width
  const H = c.scene.height
  const K = cadreCarte(c, o.mode)
  const brouillon = o.brouillon
    ? `<path class="cs-brouillon" d="M${n1(o.brouillon.x1)} ${n1(o.brouillon.y1)} L${n1(o.brouillon.x2)} ${n1(o.brouillon.y2)}"/>`
    : ''
  return (
    `<svg class="cs-svg cs-${o.mode}" viewBox="${n1(K.x)} ${n1(K.y)} ${n1(K.w)} ${n1(K.h)}" preserveAspectRatio="xMidYMid meet" ` +
    `role="group" aria-label="Carte de la station : ${c.modules.length} modules, ${c.liens.length} coursives" ` +
    `style="background:${c.palette.fond}">` +
    defs(c) +
    `<rect class="cs-fond" width="${W}" height="${H}" fill="url(#cs-hex)"/>` +
    (o.mode === 'editeur' ? grille(c, o.grille ?? 0) : '') +
    decor(c) +
    coursives(c, L) +
    routes(L, o) +
    badges(c, L) +
    `<g class="cs-modules">${c.modules.map((m, k) => module(c, m, k, o, joignables)).join('')}</g>` +
    brouillon +
    `</svg>`
  )
}
