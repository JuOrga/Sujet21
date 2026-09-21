// LES PICTOGRAMMES DE L'ATH : une seule famille, au trait.
//
// Le cadran et la barre portaient des emoji (❄ 💧 💨 🛰 🌀 🔊). Un emoji se
// dessine autrement sous Windows, macOS, Android et Steam Deck : l'unité
// graphique en souffrait, et aucun ne ressemble à un instrument de 1970.
// Ici, un tracé par nom, dans une boîte de 24 × 24 ; le trait (1,6) et la
// couleur viennent du CSS (`.picto`), donc du texte qui l'entoure.

// Les trois états sont trois OBJETS de même nature : un cube, une goutte,
// un nuage — la matière elle-même, sous ses trois formes. Avant, seule
// l'eau était un objet : la glace était un flocon (un symbole de froid) et
// la vapeur trois volutes (un symbole de chaleur), et le cadran mélangeait
// « ce que tu es » et « la température qu'il fait ».
export const PICTOS = {
  glace: 'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9zM4.2 7.5L12 12l7.8-4.5M12 12v9',
  eau: 'M12 3.5c3.2 4.2 5.5 7.3 5.5 10.2a5.5 5.5 0 0 1-11 0C6.5 10.8 8.8 7.7 12 3.5z',
  vapeur:
    'M7.5 18.5a4 4 0 0 1-.6-7.95 5.5 5.5 0 0 1 10.7 1 3.5 3.5 0 0 1-.6 6.95z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  pause: 'M9 5v14M15 5v14',
  lecture: 'M8 5l11 7-11 7z',
  editeur: 'M9 7l-5 5 5 5M4 12h11a5 5 0 0 1 5 5',
  legende: 'M12 4l8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4',
  etats: 'M12 4.5l7.5 13h-15z',
  dossier: 'M4 7h6l2 2h8v10H4z',
  station: 'M8.5 3.5h7l5 5v7l-5 5h-7l-5-5v-7zM12 9v6M9 12h6',
  recadrer: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M12 11v2',
  vortex: 'M12 12a2 2 0 1 1 2 2 4 4 0 1 1-4-4 6 6 0 1 1 6 6',
  son: 'M4 10v4h3l4 3V7l-4 3zM15 9c1.2 1.6 1.2 4.4 0 6M17.5 6.5c2.6 3 2.6 8 0 11',
  muet: 'M4 10v4h3l4 3V7l-4 3zM16 9.5l5 5M21 9.5l-5 5',
  recommencer: 'M5 12a7 7 0 1 0 2.2-5.1M5 4v4h4',
  fiche: 'M7 3h8l3 3v15H7zM10 10h5M10 14h5M10 18h3',
  banc: 'M5 7h14M5 12h14M5 17h14M9 5.5v3M15 10.5v3M8 15.5v3',
  coque: 'M12 4a2 2 0 0 1 2 2v7.5a3.5 3.5 0 1 1-4 0V6a2 2 0 0 1 2-2z',
  instruments: 'M12 20a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM12 12l4-3',
  verrou: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
} as const

export type NomPicto = keyof typeof PICTOS

/** Le svg complet d'un pictogramme — décoratif : le nom est porté par le
 *  bouton qui le contient (title, aria-label), jamais par l'image. */
export function picto(nom: NomPicto): string {
  return `<svg class="picto" data-picto="${nom}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${PICTOS[nom]}"/></svg>`
}
