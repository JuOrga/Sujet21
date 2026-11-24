// LES PICTOGRAMMES DE L'ATELIER : un dessin par élément de la barre, qui
// dit ce que l'élément FAIT plutôt que ce qu'il est — la goutte qui rebondit
// sur l'hydrophobe, celle qui colle à l'hydrophile, le flocon du hublot, les
// anneaux du puits. Les couleurs des matières sont celles que l'éditeur
// donne déjà à leurs parois (MAT_COLORS) : le joueur retrouve dans la salle
// la teinte qu'il a choisie dans la barre.
//
// Du SVG en ligne, sans fichier : le codex n'a pas encore d'images de ses
// éléments (public/assets/codex ne tient que son mode d'emploi). Le jour où
// il en aura, c'est ici qu'on les branchera.

const EAU = '#63b7e6'
const TRAIT = '#d6e8f5'
const ACIER = '#4a6b80'
const SAS = '#3fd69b'
const CHAUD = '#ff8a3c'
const AMBRE = '#f2c98e'

const svg = (corps: string): string =>
  `<svg viewBox="0 0 32 32" width="32" height="32" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corps}</svg>`

/** Une paroi de la couleur donnée, en bas du pictogramme. */
const paroi = (couleur: string, y = 22): string => `<rect x="4" y="${y}" width="24" height="6" rx="1" fill="${couleur}"/>`
const goutte = (x: number, y: number, r = 3.2): string =>
  `<path d="M${x} ${y - r * 1.6} C ${x + r} ${y - r * 0.2}, ${x + r} ${y + r}, ${x} ${y + r} C ${x - r} ${y + r}, ${x - r} ${y - r * 0.2}, ${x} ${y - r * 1.6} Z" fill="${EAU}"/>`

export const ICONES_ATELIER: Readonly<Record<string, string>> = {
  // ---- Départ & sortie, parois ----
  'box:0': svg(`<rect x="5" y="6" width="22" height="20" rx="1.5" fill="${ACIER}"/><path d="M5 13h22M5 20h22M12 6v7M20 13v7M14 20v6" stroke="#0a1420" stroke-width="1.2"/>`),
  spawn: svg(`${goutte(16, 17, 6)}<path d="M23 9l4-4m0 0h-4m4 0v4" stroke="${TRAIT}" stroke-width="1.6"/>`),
  exit: svg(`<rect x="15" y="6" width="12" height="20" rx="1.5" stroke="${SAS}" stroke-width="2"/><path d="M4 16h9m-3-3 3 3-3 3" stroke="${SAS}" stroke-width="2"/>`),
  'box:2': svg(`${paroi('#a878e8')}${goutte(16, 9)}<path d="M10 17c2-4 4-4 6-1M22 17c-2-4-4-4-6-1" stroke="${TRAIT}" stroke-width="1.3"/>`),
  'box:1': svg(`${paroi('#2ec6c9', 6)}<path d="M9 12c0 3 2 4 3 2M17 12c0 5 3 5 3 2" stroke="${EAU}" stroke-width="2.2"/>${goutte(16, 23)}`),
  'box:7': svg(`<path d="M16 4v24" stroke="#35c9a0" stroke-width="3" stroke-dasharray="2.5 2.5"/>${goutte(8, 16)}<path d="M20 16h7m-3-3 3 3-3 3" stroke="${EAU}" stroke-width="1.8"/>`),
  'box:5': svg(`<path d="M5 22h22M5 26h22M9 22v4M14 22v4M19 22v4M24 22v4" stroke="#8fb0c6" stroke-width="1.6"/><path d="M11 18c-2-3 2-4 0-7s2-4 0-6M20 18c-2-3 2-4 0-7s2-4 0-6" stroke="${TRAIT}" stroke-width="1.4"/>`),
  'box:8': svg(`<path d="M6 5v22M11 5v22M16 5v22M21 5v22M26 5v22" stroke="#9fb9d8" stroke-width="1.6"/><path d="M16 11l3 5-3 5-3-5z" fill="${TRAIT}"/>`),
  sponge: svg(`<rect x="5" y="9" width="22" height="16" rx="2" fill="#1f4a35"/><path d="M5 17h22M12 9v16M20 9v16" stroke="#3fd69b" stroke-width="1"/>${goutte(16, 6, 2.4)}`),
  'box:11': svg(`<rect x="4" y="8" width="24" height="16" rx="1.5" fill="#030710" stroke="#1a2a44" stroke-width="1.5" stroke-dasharray="3 2"/><circle cx="10" cy="13" r="1" fill="${TRAIT}"/><circle cx="21" cy="18" r="1.2" fill="${TRAIT}"/><circle cx="16" cy="11" r=".7" fill="${TRAIT}"/>`),
  'box:4': svg(`${paroi('#8fc8ee')}<path d="M16 3v14M10 6l12 8M22 6 10 14M13 4l3 2 3-2M13 16l3-2 3 2" stroke="#8fc8ee" stroke-width="1.6"/>`),
  'box:6': svg(`${paroi(CHAUD)}<path d="M16 4c4 4 6 7 6 10a6 6 0 0 1-12 0c0-2 1-4 3-5 0 2 1 3 2 3 0-3 0-5 1-8z" fill="${CHAUD}"/>`),
  'box:9': svg(`${paroi('#29d8ff')}<path d="M8 17c-2-3 2-4 0-7M14 17c-2-3 2-4 0-7" stroke="${TRAIT}" stroke-width="1.4"/><path d="M18 11h9m-3-3 3 3-3 3" stroke="#29d8ff" stroke-width="2"/>`),
  // ---- Zones d'effet, mécanismes ----
  puits: svg(`<circle cx="16" cy="16" r="12" stroke="${EAU}" stroke-width="1" stroke-dasharray="2 2.5"/><circle cx="16" cy="16" r="7" stroke="${EAU}" stroke-width="2"/><circle cx="16" cy="16" r="2.2" fill="${TRAIT}"/>`),
  chasse: svg(`<rect x="3" y="7" width="26" height="18" rx="2" stroke="#9aa3ab" stroke-width="1" stroke-dasharray="2 2"/><path d="M7 12h11m-3-3 3 3-3 3M13 20h11m-3-3 3 3-3 3" stroke="${TRAIT}" stroke-width="1.7"/>`),
  rail: svg(`<path d="M4 24 12 12l8 8 8-14" stroke="#9e6bc7" stroke-width="2.5"/><circle cx="4" cy="24" r="2" fill="#9e6bc7"/><circle cx="12" cy="12" r="2" fill="#9e6bc7"/><circle cx="20" cy="20" r="2" fill="#9e6bc7"/><circle cx="28" cy="6" r="2" fill="#9e6bc7"/>`),
  laser: svg(`<rect x="3" y="12" width="8" height="8" rx="1.5" fill="#2a3542" stroke="#9aa3ab" stroke-width="1.2"/><path d="M11 16h18" stroke="#ff5c5c" stroke-width="2"/><path d="M11 16h18" stroke="#ffd0d0" stroke-width=".7"/>`),
  cible: svg(`<circle cx="16" cy="16" r="10" stroke="${EAU}" stroke-width="2.5"/><circle cx="16" cy="16" r="4" fill="${EAU}"/><path d="M2 16h4" stroke="#ff5c5c" stroke-width="2"/>`),
  coupelle: svg(`<path d="M5 10v4a11 11 0 0 0 22 0v-4" stroke="#9aa3ab" stroke-width="2.4"/><path d="M7.5 18a9 9 0 0 0 17 0z" fill="${EAU}" opacity=".7"/><path d="M5 15h22" stroke="${TRAIT}" stroke-width="1.2" stroke-dasharray="2 2"/>`),
  porte: svg(`<path d="M6 4v24M26 4v24" stroke="${ACIER}" stroke-width="3"/><rect x="9" y="6" width="6.5" height="20" fill="#9aa3ab"/><rect x="16.5" y="6" width="6.5" height="20" fill="#9aa3ab" opacity=".45"/>`),
  mire: svg(`<circle cx="16" cy="16" r="11" stroke="#b06a8f" stroke-width="2"/><circle cx="16" cy="16" r="6" stroke="#b06a8f" stroke-width="2"/><circle cx="16" cy="16" r="1.8" fill="#b06a8f"/><path d="M25 6l-5 5" stroke="${TRAIT}" stroke-width="1.6"/>`),
  // ---- Lumière, décor ----
  label: svg(`<rect x="4" y="8" width="24" height="16" rx="2" stroke="${TRAIT}" stroke-width="1.4"/><path d="M10 13h12M16 13v8" stroke="${TRAIT}" stroke-width="2"/>`),
  lumiere: svg(`<circle cx="16" cy="13" r="6" fill="${AMBRE}"/><path d="M13 21h6M14 24h4" stroke="${AMBRE}" stroke-width="1.6"/><path d="M16 2v2M5 13H3M29 13h-2M8 5l1.5 1.5M24 5l-1.5 1.5" stroke="${AMBRE}" stroke-width="1.3"/>`),
  bande: svg(`<rect x="3" y="13" width="26" height="6" rx="3" fill="${AMBRE}"/><path d="M6 23v3M11 23v4M16 23v4M21 23v4M26 23v3" stroke="${AMBRE}" stroke-width="1.2" opacity=".7"/>`),
  'box:12': svg(`<rect x="4" y="6" width="24" height="20" rx="1.5" fill="#030710" stroke="#5a7fb0" stroke-width="2"/><path d="M16 6v20M4 16h24" stroke="#5a7fb0" stroke-width="1.2"/><circle cx="10" cy="11" r=".9" fill="${TRAIT}"/><circle cx="22" cy="21" r="1.1" fill="${TRAIT}"/>`),
  'decal:tuyaux': svg(`<path d="M3 10h14a4 4 0 0 1 4 4v15M3 17h8a3 3 0 0 1 3 3v9" stroke="#9aa3ab" stroke-width="2.6"/><rect x="18" y="5" width="6" height="4" rx="1" fill="${ACIER}"/>`),
  'decal:serre-ble-nain': svg(`<path d="M8 28V12M16 28V8M24 28V12" stroke="#7fe3a8" stroke-width="1.6"/><path d="M8 12c-2-2-2-4 0-6 2 2 2 4 0 6zM16 8c-2-2-2-4 0-6 2 2 2 4 0 6zM24 12c-2-2-2-4 0-6 2 2 2 4 0 6z" fill="#3fd69b"/><path d="M4 28h24" stroke="${ACIER}" stroke-width="2"/>`),
  // ---- Formes (dans la matière choisie : dessinées en acier) ----
  'forme:1': svg(`<circle cx="16" cy="16" r="11" fill="${ACIER}"/>`),
  'forme:2': svg(`<rect x="3" y="10" width="26" height="12" rx="6" fill="${ACIER}"/>`),
  'forme:3': svg(`<path d="M4 27h24V5z" fill="${ACIER}"/>`),
  'forme:4': svg(`<path d="M6 24a11 11 0 0 1 20 0" stroke="${ACIER}" stroke-width="6"/>`),
  // ---- Zones d'effet ----
  'zone:eau': svg(`<rect x="3" y="5" width="26" height="22" rx="2" fill="${EAU}" fill-opacity=".18" stroke="${EAU}" stroke-width="1.4" stroke-dasharray="3 2"/>${goutte(16, 17, 5)}`),
  'zone:glace': svg(`<rect x="3" y="5" width="26" height="22" rx="2" fill="#8fc8ee" fill-opacity=".18" stroke="#8fc8ee" stroke-width="1.4" stroke-dasharray="3 2"/><path d="M16 9v14M10 12l12 8M22 12l-12 8" stroke="#8fc8ee" stroke-width="1.8"/>`),
  'zone:vapeur': svg(`<rect x="3" y="5" width="26" height="22" rx="2" fill="${AMBRE}" fill-opacity=".18" stroke="${AMBRE}" stroke-width="1.4" stroke-dasharray="3 2"/><path d="M12 23c-2-3 2-4 0-7s2-4 0-6M20 23c-2-3 2-4 0-7s2-4 0-6" stroke="${TRAIT}" stroke-width="1.5"/>`),
  // ---- Outils transverses ----
  gomme: svg(`<path d="M13 26 4 17 17 4l11 11-11 11z" fill="#e88aa0"/><path d="M8.5 21.5 17 13" stroke="#0a1420" stroke-width="1.4"/><path d="M13 26h15" stroke="${TRAIT}" stroke-width="1.6"/>`),
  cut: svg(`<rect x="3" y="11" width="18" height="16" rx="1.5" fill="${ACIER}"/><rect x="11" y="5" width="18" height="16" rx="1.5" fill="#a878e8" fill-opacity=".85"/><path d="M11 11h10v10" stroke="${TRAIT}" stroke-width="1.4" stroke-dasharray="2 2"/>`),
  select: svg(`<path d="M8 4v20l5-5 4 9 3-1.5-4-8.5h7z" fill="${TRAIT}"/>`),
}

/** Le pictogramme d'un outil — un carré neutre si l'outil n'en a pas
 *  (aucun ne devrait manquer : le banc le vérifie). */
export function iconeOutil(outil: string): string {
  return ICONES_ATELIER[outil] ?? svg(`<rect x="6" y="6" width="20" height="20" rx="3" stroke="${TRAIT}" stroke-width="1.5"/>`)
}
