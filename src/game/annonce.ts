// L'ANNONCE DES NOUVEAUTÉS : une fenêtre qui se pose UNE fois sur la fiche
// d'accueil pour dire ce qui vient d'arriver — ici, COMMUNAUTÉ (l'éditeur
// ouvert aux joueurs, et les créations de la communauté). Le concepteur,
// 25/11 : « une fenêtre qui passe par-dessus le menu principal la première
// fois et qui se ferme, pour indiquer de manière ergonomique et récréative
// les nouveautés, avec image dans l'idéal ».
//
// Trois cartes à feuilleter plutôt qu'un mur de texte : OÙ c'est, ce qu'on
// y FAIT (bâtir), ce qu'on y TROUVE (jouer celles des autres). Chaque carte
// a son dessin, fait des pictogrammes de l'éditeur lui-même : le joueur y
// reconnaîtra la barre qu'il trouvera en entrant. Aucune promesse que le
// jeu ne tienne — la modération, pas encore faite, n'est pas annoncée.
//
// Sans DOM : main.ts pose le HTML que ce module rend, et retient dans le
// coffre (comme le voyant du codex) les annonces déjà vues.

import { ICONES_ATELIER } from '../editor/iconesAtelier'

export interface CarteAnnonce {
  /** le surtitre, en petites capitales */
  sur: string
  titre: string
  texte: string
  puces: string[]
  /** le dessin, en SVG en ligne */
  dessin: string
}

export interface Annonce {
  /** l'identifiant retenu une fois vue — en changer, c'est la remontrer */
  id: string
  cartes: CarteAnnonce[]
}

/** La clé du coffre : les annonces déjà vues (une liste d'identifiants). */
export const CLE_ANNONCES_VUES = 'sujet21-annonces-vues'

// ---- LES DESSINS ---------------------------------------------------------------
// 320 × 180, les teintes de la fiche : le fond de la cuve, le bleu du verbe,
// l'ambre des voyants.

const FOND = '#050b14'
const LIGNE = '#1d3448'
const ENCRE = '#d6e8f5'
const GLOW = '#63b7e6'
const TERNE = '#6f8799'

const cadre = (corps: string, titre: string): string =>
  `<svg class="an-dessin" viewBox="0 0 320 180" role="img" aria-label="${titre}" xmlns="http://www.w3.org/2000/svg">` +
  `<rect width="320" height="180" rx="10" fill="${FOND}"/>${corps}</svg>`

/** Un pictogramme de l'éditeur (32 × 32) posé en (x, y), à l'échelle k. */
const icone = (outil: string, x: number, y: number, k = 1): string => {
  const brut = ICONES_ATELIER[outil] ?? ''
  const interieur = brut.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
  return `<g transform="translate(${x} ${y}) scale(${k})" fill="none" stroke-linecap="round" stroke-linejoin="round">${interieur}</g>`
}

const texte = (x: number, y: number, t: string, couleur = ENCRE, taille = 9, extra = ''): string =>
  `<text x="${x}" y="${y}" fill="${couleur}" font-family="ui-monospace, monospace" font-size="${taille}" letter-spacing="1.2" ${extra}>${t}</text>`

/** 1. OÙ : le rail de la fiche, COMMUNAUTÉ ouvert sur ses deux choix. */
const DESSIN_MENU = cadre(
  [
    // le rail
    ...['MÉMOIRES', 'CODEX', 'RECORDS', 'MULTI'].map((n, i) => texte(30, 34 + i * 20, n, TERNE)),
    `<rect x="22" y="106" width="150" height="20" fill="#0b1826"/>`,
    `<path d="M22 106h6M22 106v6M172 126h-6M172 126v-6" stroke="${GLOW}" stroke-width="1.5"/>`,
    texte(30, 120, 'COMMUNAUTÉ ›', GLOW),
    `<path d="M34 130v38" stroke="${LIGNE}"/>`,
    texte(44, 144, 'ÉDITEUR', ENCRE, 8),
    texte(44, 162, 'CRÉATIONS DE LA COMMUNAUTÉ', ENCRE, 8),
    // la flèche qui le désigne, et le voyant ambre
    `<path class="an-pointe" d="M232 116h-44m8-7-8 7 8 7" stroke="#f2c98e" stroke-width="2.5" fill="none"/>`,
    `<circle cx="252" cy="116" r="12" fill="#f2c98e" opacity=".18"/><circle cx="252" cy="116" r="5" fill="#f2c98e"/>`,
    texte(218, 150, 'NOUVEAU', '#f2c98e', 10, 'font-weight="700"'),
  ].join(''),
  'Le menu principal : COMMUNAUTÉ, ouvert sur ÉDITEUR et CRÉATIONS DE LA COMMUNAUTÉ',
)

/** 2. BÂTIR : une salle en chantier — le départ, des parois, la sortie — et
 *  la barre de l'éditeur dessous, avec ses vrais pictogrammes. */
const DESSIN_EDITEUR = cadre(
  [
    // la salle
    `<rect x="16" y="12" width="288" height="112" rx="4" fill="#07111c" stroke="${LIGNE}"/>`,
    `<rect x="16" y="112" width="288" height="12" fill="#4a6b80"/>`,
    `<rect x="120" y="62" width="70" height="10" fill="#a878e8"/>`,
    `<rect x="210" y="40" width="10" height="72" fill="#35c9a0" opacity=".8"/>`,
    `<circle cx="155" cy="40" r="16" fill="none" stroke="${GLOW}" stroke-dasharray="2 3"/><circle cx="155" cy="40" r="3" fill="${ENCRE}"/>`,
    `<rect x="262" y="70" width="28" height="42" rx="2" fill="none" stroke="#3fd69b" stroke-width="2"/>`,
    // la goutte qui rebondit sur l'hydrophobe (animée par la feuille de style)
    `<g class="an-goutte"><path d="M60 72c6 7 9 11 9 15a9 9 0 0 1-18 0c0-4 3-8 9-15z" fill="${GLOW}"/></g>`,
    `<path d="M70 96 Q 110 40 150 60" stroke="${GLOW}" stroke-dasharray="3 4" fill="none" opacity=".7"/>`,
    // la barre
    `<rect x="16" y="132" width="288" height="38" rx="4" fill="#0a1420" stroke="${LIGNE}"/>`,
    icone('select', 24, 136, 0.9),
    icone('box:0', 70, 136, 0.9),
    icone('box:2', 106, 136, 0.9),
    icone('zone:glace', 142, 136, 0.9),
    icone('puits', 178, 136, 0.9),
    icone('laser', 214, 136, 0.9),
    icone('lumiere', 250, 136, 0.9),
    `<path d="M58 138v26" stroke="${LIGNE}"/>`,
  ].join(''),
  'L’éditeur : une salle en chantier et la barre de ses éléments',
)

/** 3. JOUER : trois salles partagées, leurs auteurs et leur record — la
 *  dernière, toute neuve, n'en a pas encore : la place est à prendre.
 *  (Des noms inventés, pour l'image.) */
const DESSIN_CREATIONS = cadre(
  [
    ...[
      ['LE PUITS SANS FOND', 'NOVA', '12,4 L', '0:41'],
      ['GLACE ET MIROIRS', 'KIRA', '9,8 L', '1:07'],
      ['LA GRANDE CHASSE', 'ORION', '', ''],
    ].map(([nom, auteur, litres, temps], i) => {
      const y = 18 + i * 52
      const neuve = !litres
      return (
        `<rect x="16" y="${y}" width="288" height="44" rx="5" fill="${neuve ? '#0b1826' : '#081320'}" stroke="${neuve ? GLOW : LIGNE}"/>` +
        `<rect x="24" y="${y + 6}" width="52" height="32" rx="3" fill="#07111c" stroke="${LIGNE}"/>` +
        `<rect x="28" y="${y + 30}" width="44" height="4" fill="#4a6b80"/>` +
        `<circle cx="${40 + i * 8}" cy="${y + 20}" r="4" fill="${GLOW}"/>` +
        texte(86, y + 19, nom, ENCRE, 9) +
        texte(86, y + 34, `par ${auteur}`, TERNE, 8) +
        (neuve
          ? texte(222, y + 21, 'AUCUN RECORD', GLOW, 7.5) + texte(222, y + 34, 'À PRENDRE !', '#f2c98e', 8)
          : `<path d="M226 ${y + 12}h12v6a6 6 0 0 1-12 0z" fill="#f2c98e"/><path d="M229 ${y + 25}h6" stroke="#f2c98e" stroke-width="2"/>` +
            texte(244, y + 19, litres, ENCRE, 8) +
            texte(244, y + 33, temps, TERNE, 8))
      )
    }),
  ].join(''),
  'Les créations de la communauté : des salles, leurs auteurs et leurs records',
)

// ---- L'ANNONCE DU 25/11 ----------------------------------------------------------

export const ANNONCE_COMMUNAUTE: Annonce = {
  id: 'communaute-2026-11',
  cartes: [
    {
      sur: 'NOUVEAU DANS LE LABORATOIRE',
      titre: 'COMMUNAUTÉ',
      texte: 'Un nouveau lieu du menu principal. Il s’ouvre sur deux portes : bâtir vos propres salles, et jouer celles des autres.',
      puces: ['Menu principal › COMMUNAUTÉ', 'ÉDITEUR — pour bâtir', 'CRÉATIONS DE LA COMMUNAUTÉ — pour jouer'],
      dessin: DESSIN_MENU,
    },
    {
      sur: 'COMMUNAUTÉ › ÉDITEUR',
      titre: 'BÂTISSEZ VOTRE SALLE',
      texte: 'Parois, zones d’effet, mécanismes, lumière : choisissez un élément dans la barre, posez-le dans la salle.',
      puces: [
        'Restez une seconde sur un élément : la bulle dit comment il marche.',
        'ESSAYER pour tester, ESSAYER ET PUBLIER pour la partager.',
        'Elle se publie quand VOUS atteignez sa sortie : une salle partagée est une salle traversable.',
      ],
      dessin: DESSIN_EDITEUR,
    },
    {
      sur: 'COMMUNAUTÉ › CRÉATIONS DE LA COMMUNAUTÉ',
      titre: 'JOUEZ CELLES DES AUTRES',
      texte: 'Les salles partagées par les joueurs, hors de l’expédition : rien à perdre, tout à battre.',
      puces: [
        'Chaque salle a ses records : le volume sauvé et le chrono.',
        '« Mes créations » : vos salles publiées, à retoucher dans l’éditeur.',
      ],
      dessin: DESSIN_CREATIONS,
    },
  ],
}

// ---- QUAND LA MONTRER ------------------------------------------------------------

/** Relit la liste des annonces vues — illisible : aucune. */
export function lisAnnoncesVues(brut: string | null): string[] {
  if (!brut) return []
  try {
    const v = JSON.parse(brut) as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/** La liste, l'annonce marquée vue (sans doublon). */
export function marqueAnnonceVue(vues: readonly string[], id: string): string[] {
  return vues.includes(id) ? [...vues] : [...vues, id]
}

export interface EtatAnnonce {
  /** déjà vue sur cet emplacement */
  vues: readonly string[]
  /** COMMUNAUTÉ paraît dans le rail : la partie a laissé une trace. Au
   *  tout premier lancement, le rail ne montre que SAUVEGARDES — annoncer
   *  un lieu invisible n'aurait pas de sens : l'annonce attend qu'il paraisse */
  lieuVisible: boolean
  /** une partie tourne derrière la fiche (une pause) : on n'interrompt pas */
  enPause: boolean
}

export function annonceAMontrer(a: Annonce, e: EtatAnnonce): boolean {
  return e.lieuVisible && !e.enPause && !e.vues.includes(a.id)
}

// ---- LE RENDU ----------------------------------------------------------------------

const esc = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Le corps de la fenêtre pour la carte `i` : le dessin, les mots, les
 *  points de pagination et les boutons. La dernière carte propose d'y
 *  aller tout de suite. */
export function rendCarteAnnonce(a: Annonce, i: number): string {
  const n = a.cartes.length
  const k = Math.max(0, Math.min(i, n - 1))
  const c = a.cartes[k]
  const derniere = k === n - 1
  return (
    `<div class="an-figure">${c.dessin}</div>` +
    `<div class="an-mots">` +
    `<p class="an-sur">${esc(c.sur)}</p>` +
    `<h2 id="an-titre">${esc(c.titre)}</h2>` +
    `<p class="an-texte">${esc(c.texte)}</p>` +
    `<ul class="an-puces">${c.puces.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` +
    `</div>` +
    `<div class="an-pied">` +
    `<div class="an-points" role="tablist" aria-label="Cartes">` +
    a.cartes
      .map(
        (_, j) =>
          `<button type="button" class="an-point" role="tab" data-carte="${j}" aria-selected="${j === k}" aria-label="Carte ${j + 1} sur ${n}"></button>`,
      )
      .join('') +
    `</div>` +
    `<div class="an-actions">` +
    (k > 0 ? `<button type="button" id="an-prec">‹ PRÉCÉDENT</button>` : '') +
    (derniere
      ? `<button type="button" id="an-creations">JOUER LES CRÉATIONS</button>` +
        `<button type="button" id="an-editeur" class="primary">OUVRIR L’ÉDITEUR</button>`
      : `<button type="button" id="an-suiv" class="primary">SUIVANT ›</button>`) +
    `</div>` +
    `</div>`
  )
}
