// LES FIOLES : les items équipables de la run. Des échantillons scellés —
// prélevés dans les cachettes profondes ou troqués à l'Économat — qu'on
// ÉQUIPE avant de descendre (deux logements). Leurs effets sont passifs
// et durent toute la run. La collection est PERSISTANTE (registres) :
// une fiole trouvée l'est pour toujours — l'équiper est le choix.

export interface FioleDef {
  id: string
  nom: string
  desc: string // l'effet, dit en une phrase
  icone: string
  rare: boolean // les rares ne se trouvent qu'en cachette profonde
}

export const FIOLES_SLOTS = 2 // les logements du placard

export const FIOLES: FioleDef[] = [
  {
    id: 'aimant',
    nom: 'FIOLE D’AIMANT',
    desc: 'le rayon de collecte des pastilles de condensat s’élargit (+60 %)',
    icone: '🧲',
    rare: false,
  },
  {
    id: 'sonde',
    nom: 'FIOLE DE SONDE',
    desc: 'les pastilles luisent À TRAVERS les voiles des cachettes',
    icone: '📡',
    rare: false,
  },
  {
    id: 'troc',
    nom: 'FIOLE DE TROC',
    desc: 'les prix de l’Économat baissent de 25 % — le Semblable vous reconnaît',
    icone: '🤝',
    rare: false,
  },
  {
    id: 'souvenir',
    nom: 'FIOLE DE SOUVENIR',
    desc: 'la mémoire gravée pendant la run est majorée de 25 %',
    icone: '🫧',
    rare: false,
  },
  {
    id: 'isolant',
    nom: 'FIOLE D’ISOLANT',
    desc: 'la coque refroidit 15 % plus lentement (se cumule à la gaine)',
    icone: '🧊',
    rare: true,
  },
  {
    id: 'second-souffle',
    nom: 'FIOLE DE SECOND SOUFFLE',
    desc: 'chaque run commence avec DEUX échantillons de secours',
    icone: '💠',
    rare: true,
  },
]

export function fioleDef(id: string): FioleDef | null {
  return FIOLES.find((f) => f.id === id) ?? null
}
