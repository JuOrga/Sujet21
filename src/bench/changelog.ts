// Journal des livraisons, affiché dans le banc de réglage (dossier
// « Livraisons »). Rempli automatiquement à chaque livraison — l'entrée la
// plus récente en premier. Les testeurs voient ainsi ce qui a changé sans
// quitter le jeu.

export interface Delivery {
  date: string // JJ/MM/AAAA HH:MM (heure de Paris)
  title: string
  notes: string[]
}

export const DELIVERIES: Delivery[] = [
  {
    date: '08/08/2026 16:28',
    title: 'Le creux de propulsion se voit',
    notes: [
      'L’entraînement ne pousse plus le liquide dans le sens du jet (il annulait le recul au même endroit) : il fait converger l’eau vers le point d’émission, en entonnoir.',
      'Résultat : la surface se pince visiblement là où l’eau est éjectée — la déformation de propulsion n’est plus masquée.',
    ],
  },
  {
    date: '08/08/2026 16:20',
    title: 'Recul fluide : le corps se déforme en accélérant',
    notes: [
      'Le recul de l’éjection n’est plus réparti uniformément (effet « solide ») : il est pondéré vers le point d’éjection et se propage par pression.',
      'Curseur « recul localisé » dans Propulsion : 0 = bloc rigide (ancien comportement), 1 = déformation maximale. Défaut 0,6.',
    ],
  },
  {
    date: '08/08/2026 16:07',
    title: 'Eau lissée : fini les billes',
    notes: [
      'Surface du corps lissée : splats élargis, seuil réajusté, relief limité à la zone de surface (l’intérieur ne grène plus).',
      'Les gouttes libres sont rendues plus fines que le corps : des gouttelettes, pas des boules.',
      'Captures d’écran du canvas désormais possibles (retours visuels des testeurs).',
    ],
  },
  {
    date: '08/08/2026 15:55',
    title: 'Éjection : creusement et jet liquide',
    notes: [
      'L’éjection entraîne le liquide voisin du point de départ : le corps se creuse en entonnoir (curseur « entraînement » dans Propulsion).',
      'Les gouttes rapides s’étirent dans le sens du mouvement : le jet devient un filament liquide au lieu d’un chapelet de boules.',
    ],
  },
  {
    date: '08/08/2026 15:47',
    title: 'Rendu de l’eau, ondes d’éjection, impacts amortis',
    notes: [
      'Une onde traverse le volume d’eau à chaque salve d’éjection (surface qui ondule + lueur).',
      'Relief de l’eau : éclairage et reflet spéculaire par gradient du champ, scintillement interne.',
      'Les impacts sur les murs neutres éclatent moins : l’eau s’étale et épouse les formes (curseur « amorti impact » dans Matériaux).',
      'Nouvel espace « Livraisons » : l’historique de ce qui est livré, rempli automatiquement.',
    ],
  },
  {
    date: '08/08/2026 15:32',
    title: 'Commandes compatibles smartphone',
    notes: [
      'Barre tactile : pause, time warp, vortex (armer 🌀 puis toucher), zoom auto, recommencer.',
      'Pincement à deux doigts = zoom. Banc replié au démarrage sur mobile et défilable.',
    ],
  },
  {
    date: '08/08/2026 15:24',
    title: 'Auto-déploiement',
    notes: ['Chaque mise à jour est en ligne sur sujet21.vercel.app une à deux minutes après livraison.'],
  },
  {
    date: '08/08/2026 15:09',
    title: 'Zoom manuel, vortex, aide du banc, présets',
    notes: [
      'Molette : zoom manuel ; bouton « Zoom auto » pour reprendre le suivi.',
      'Clic droit : vortex de regroupement — l’eau spirale vers le point cliqué puis est déposée sans élan.',
      'Chaque réglage du banc affiche son explication au survol.',
      'Présets nommés (titre + description) : créer, modifier, charger, supprimer, export/import JSON.',
    ],
  },
  {
    date: '08/08/2026 11:00',
    title: 'Jalon 2 — premier tableau',
    notes: ['Matériaux (hydrophile, hydrophobe), éponge à saturation, sas de sortie et bonbonnes.'],
  },
]
