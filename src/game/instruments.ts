// LES INSTRUMENTS EMBARQUÉS : la récompense de fin de salle. Trois cartes
// se retournent, on en emporte UNE pour le reste de la run — un avantage
// LATÉRAL, jamais un raccourci (règle d'or du doc de conception). Certaines
// cartes sont PAYANTES en condensat : la première dépense de la monnaie
// méta — le banc d'étalonnage (permanent) viendra ensuite.

export interface InstrumentDef {
  id: string
  nom: string
  desc: string
  icone: string
}

export const INSTRUMENTS: InstrumentDef[] = [
  {
    id: 'echantillon-secours',
    nom: 'Échantillon de secours',
    desc: 'Un échantillon de plus en réserve : une dispersion pardonnée.',
    icone: '🧪',
  },
  {
    id: 'gaine-isolante',
    nom: 'Gaine isolante',
    desc: 'Le refroidissement du vaisseau mord un tiers plus lentement.',
    icone: '🧊',
  },
  {
    id: 'buse-calibree',
    nom: 'Buse calibrée',
    desc: 'Un dash de plus dans la réserve de chaque tableau.',
    icone: '💨',
  },
  {
    id: 'aimant-rosee',
    nom: 'Aimant à rosée',
    desc: 'La rosée recondensée rend nettement plus de volume.',
    icone: '🫧',
  },
  {
    id: 'chambre-froide',
    nom: 'Chambre froide',
    desc: 'La prime de glace vaut moitié plus au sas.',
    icone: '⚗️',
  },

  // ——— Le corps et sa matière ————————————————————————————————
  {
    id: 'peau-tendue',
    nom: 'Peau tendue',
    desc: 'Les gouttes éjectées redeviennent réabsorbables deux fois plus tôt.',
    icone: '🩹',
  },
  {
    id: 'vanne-de-secours',
    nom: 'Vanne de secours',
    desc: 'Le corps tient plus bas : le seuil de dispersion descend d’un cinquième.',
    icone: '🚨',
  },
  {
    id: 'plastron',
    nom: 'Plastron',
    desc: 'L’éponge a moins de prise : elle boit un quart moins vite.',
    icone: '🛡️',
  },

  // ——— Les états ————————————————————————————————————————————
  {
    id: 'detendeur',
    nom: 'Détendeur',
    desc: 'Se vaporiser coûte 40 % de moins : le péage en gouttes s’allège.',
    icone: '🫁',
  },
  {
    id: 'patins-de-givre',
    nom: 'Patins de givre',
    desc: 'Le palet de glace rebondit presque sans rien perdre.',
    icone: '⛸️',
  },
  {
    id: 'lentille-de-visee',
    nom: 'Lentille de visée',
    desc: 'La visée du dash ralentit le temps deux fois plus : on choisit sa ligne.',
    icone: '🔭',
  },

  // ——— La collecte et la bourse ——————————————————————————————
  {
    id: 'gueule-ouverte',
    nom: 'Gueule ouverte',
    desc: 'Le sas aspire de moitié plus loin : les traînardes rentrent seules.',
    icone: '🌀',
  },
  {
    id: 'filtre-a-condensat',
    nom: 'Filtre à condensat',
    desc: 'Un quart de condensat en plus sur tout ce qui passe le sas.',
    icone: '💧',
  },
  {
    id: 'ballast',
    nom: 'Ballast',
    desc: 'La bonbonne emporte trois litres de plus.',
    icone: '⚖️',
  },

  // ——— Le protocole lui-même ————————————————————————————————
  {
    id: 'carnet-du-semblable',
    nom: 'Carnet du Semblable',
    desc: 'Une carte de plus à chaque tirage de fin de salle.',
    icone: '📓',
  },
]

export function instrumentDef(id: string): InstrumentDef | null {
  return INSTRUMENTS.find((t) => t.id === id) ?? null
}

/** Une carte du tirage : l'instrument, et son prix en condensat (0 : offerte). */
export interface CarteTirage {
  id: string
  prix: number
}

export const PRIX_CARTE = 150 // cL — le tarif unique des cartes payantes

/**
 * Le tirage de fin de salle : jusqu'à `nbCartes` cartes distinctes (3 par
 * défaut — le CARNET DU SEMBLABLE en ajoute une).
 * — un instrument déjà emporté ne revient pas (sauf l'échantillon de
 *   secours, tant que la réserve n'est pas pleine) ;
 * — l'échantillon de secours ne paraît que si une vie manque ;
 * — environ une carte sur trois est payante… mais jamais toutes : au moins
 *   une carte reste offerte (un joueur sans condensat choisit quand même).
 * `rand` est injecté : le tirage est pur et testable.
 */
export function tirageInstruments(
  rand: () => number,
  tenus: string[],
  vies: number,
  viesMax: number,
  nbCartes = 3,
): CarteTirage[] {
  const pool = INSTRUMENTS.filter((d) => {
    if (d.id === 'echantillon-secours') return vies < viesMax
    return !tenus.includes(d.id)
  }).map((d) => d.id)
  // mélange de Fisher-Yates sur la copie
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const t = pool[i]
    pool[i] = pool[j]
    pool[j] = t
  }
  const cartes = pool.slice(0, Math.max(1, nbCartes)).map((id) => ({
    id,
    prix: rand() < 1 / 3 ? PRIX_CARTE : 0,
  }))
  if (cartes.length > 0 && cartes.every((c) => c.prix > 0)) {
    cartes[Math.floor(rand() * cartes.length)].prix = 0
  }
  return cartes
}

// ---- La BONBONNE et l'XP d'étalonnage ----
// À chaque sas, le surplus se VERSE quelque part : dans la BONBONNE (une
// réserve d'eau embarquée, qu'on peut reverser dans le corps en cours de
// route — même non pleine) ou dans l'XP D'ÉTALONNAGE, qui nourrit les
// instruments. Bonbonne PLEINE : le surplus va forcément à l'XP.
export const BONBONNE_CAP = 8 // litres

// Les paliers d'XP (litres cumulés versés) : chaque palier franchi ouvre un
// tirage d'instruments. La marche grandit — la montée se mérite.
export const PALIERS_XP = [3, 6, 10, 15, 21, 28, 36]

export function paliersAtteints(xp: number): number {
  let n = 0
  for (const p of PALIERS_XP) if (xp >= p) n++
  return n
}

/** Le prochain palier à franchir, ou null si la table est épuisée. */
export function prochainPalier(xp: number): number | null {
  for (const p of PALIERS_XP) if (xp < p) return p
  return null
}
