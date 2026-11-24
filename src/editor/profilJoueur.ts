// LE PROFIL DU JOUEUR : tout ce que l'atelier offre à un joueur, et rien
// d'autre. La palette en six familles et les réglages en paliers nommés
// sont ceux des maquettes validées le 24/11/2026 (docs/atelier-joueur.md,
// lot 4 bis) ; ce qui peut entrer dans une salle est la liste blanche
// PARTAGÉE avec le serveur (api/_creation.ts) — une seule liste, deux
// lecteurs.
//
// L'éditeur du concepteur règle tout en nombres (« Force (u/s², au bord
// du cœur) », « Trait (% du corps à l'entrée) ») : 69 champs. Le joueur
// choisit des PALIERS, dont les valeurs sont posées ici. Chaque palier
// reste dans les bornes que parseLevel accepte sans retouche — le test le
// tient. Les valeurs partent des défauts du jeu (le palier du milieu) ;
// les extrêmes sont à régler au banc, en jouant.

import { MATERIAUX_PERMIS, MODES_PASTILLE, SCHEMAS } from '../../api/_creation'

// ---- LA PALETTE ----------------------------------------------------------------

export interface OutilJoueur {
  /** L'identifiant de l'outil dans la palette de l'éditeur (data-tool). */
  outil: string
  nom: string
  /** Ce qu'il fait au corps, en une phrase. */
  phrase: string
  /** La collection de LevelDef où l'outil pose (spawn et exit : à part). */
  collection: string
}

export interface FamilleJoueur {
  id: string
  nom: string
  phrase: string
  outils: OutilJoueur[]
}

const o = (outil: string, nom: string, phrase: string, collection: string): OutilJoueur => ({
  outil,
  nom,
  phrase,
  collection,
})

/** Les six familles, rangées par intention et non par type technique. */
export const FAMILLES_JOUEUR: FamilleJoueur[] = [
  {
    id: 'batir',
    nom: 'Bâtir',
    phrase: 'Les murs de la salle, le départ du corps et la sortie.',
    outils: [
      o('box:0', 'Paroi', 'Le mur : rien ne le traverse.', 'boxes'),
      o('struct:0', 'Chambre', 'Une pièce fermée, à relier par ses côtés.', 'structures'),
      o('struct:1', 'Couloir', 'Un tube ouvert entre deux pièces.', 'structures'),
      o('spawn', 'Départ', 'Là où le corps d’eau apparaît.', 'spawn'),
      o('exit', 'Sortie', 'Le sas à atteindre.', 'exit'),
    ],
  },
  {
    id: 'matieres',
    nom: 'Matières',
    phrase: 'Des parois qui trient : ce qui passe, ce qui colle, ce qui rebondit.',
    outils: [
      o('box:2', 'Hydrophobe', 'Repousse l’eau ; la glace y rebondit.', 'boxes'),
      o('box:1', 'Hydrophile', 'Retient ce qui la touche.', 'boxes'),
      o('box:7', 'Membrane', 'Seule l’eau passe.', 'boxes'),
      o('box:5', 'Évent', 'Seule la vapeur passe.', 'boxes'),
      o('box:8', 'Rideau', 'Seule la glace passe.', 'boxes'),
      o('sponge', 'Éponge', 'Boit le liquide qui s’attarde.', 'sponges'),
      o('box:11', 'Vide', 'Le dehors : qui s’y attarde est aspiré.', 'boxes'),
    ],
  },
  {
    id: 'chaleur',
    nom: 'Chaleur',
    phrase: 'Geler, faire bouillir : changer l’état du corps.',
    outils: [
      o('box:4', 'Hublot froid', 'Une aura de gel.', 'boxes'),
      o('box:6', 'Chaudière', 'Vaporise l’eau, dégèle la glace.', 'boxes'),
      o('box:9', 'Surchauffeur', 'Rend un élan à la vapeur, une fois.', 'boxes'),
    ],
  },
  {
    id: 'forces',
    nom: 'Forces',
    phrase: 'Ce qui attire, pousse ou guide le corps.',
    outils: [
      o('puits', 'Puits de gravité', 'Attire le corps : on peut y orbiter.', 'puits'),
      o('chasse', 'Chasse', 'Un courant qui pousse sans déchirer.', 'chasses'),
      o('rail', 'Rail', 'Guide l’arc du plasma.', 'rails'),
    ],
  },
  {
    id: 'meca',
    nom: 'Mécanismes',
    phrase: 'Des commandes qui ouvrent des portes : laser, pastilles, coupelles.',
    outils: [
      o('laser', 'Laser', 'Un faisceau que la glace renvoie.', 'lasers'),
      o('cible', 'Pastille', 'Touchée par le laser, elle commande.', 'cibles'),
      o('coupelle', 'Coupelle', 'Boit jusqu’à son trait, puis commande.', 'coupelles'),
      o('porte', 'Porte', 'S’ouvre quand ses commandes s’allument.', 'portes'),
      o('mire', 'Mire', 'Une cible à points pour les éclats de glace.', 'mires'),
    ],
  },
  {
    id: 'decor',
    nom: 'Décor',
    phrase: 'Lumières, décors et textes. Sans effet sur le corps.',
    outils: [
      o('label', 'Texte', 'Un mot sur un mur (40 signes).', 'labels'),
      o('lumiere', 'Lampe', 'Éclaire la salle (4 au plus).', 'lumieres'),
      o('bande', 'Bandeau lumineux', 'Une ligne de lumière.', 'lumieres'),
      o('box:12', 'Baie vitrée', 'Le dehors derrière une vitre.', 'boxes'),
      o('decal:tuyaux', 'Tuyaux', 'Un décor de tuyauterie.', 'decals'),
      o('decal:serre-ble-nain', 'Blé nain', 'Un bac de la serre.', 'decals'),
    ],
  },
]

/** Les outils transverses, hors familles : choisir et déplacer. */
export const OUTILS_TRANSVERSES = ['select'] as const

/** Tous les identifiants d'outils permis au joueur. */
export const OUTILS_PERMIS: ReadonlySet<string> = new Set([
  ...OUTILS_TRANSVERSES,
  ...FAMILLES_JOUEUR.flatMap((f) => f.outils.map((x) => x.outil)),
])

/** L'atelier offre-t-il cet outil au joueur ? */
export function outilPermis(outil: string): boolean {
  return OUTILS_PERMIS.has(outil)
}

/** Un outil `box:N` pose-t-il un matériau que la liste blanche accepte ? */
export function materiauDeLOutil(outil: string): number | null {
  const m = /^box:(\d+)$/.exec(outil)
  if (!m) return null
  const n = Number(m[1])
  return (MATERIAUX_PERMIS as readonly number[]).includes(n) ? n : null
}

// ---- LES PALIERS ---------------------------------------------------------------

/** Un palier : son nom pour le joueur, et les champs qu'il écrit sur
 *  l'élément (`undefined` : le champ est retiré, le défaut du jeu joue). */
export interface Palier {
  label: string
  champs: Record<string, unknown>
}

export interface ReglageJoueur {
  id: string
  nom: string
  paliers: Palier[]
  /** Le palier proposé à la pose. */
  defaut: number
}

const p = (label: string, champs: Record<string, unknown>): Palier => ({ label, champs })

/** Les réglages offerts, par collection — au plus TROIS par élément. Le
 *  départ écrit dans `spawn` (n, impulsion). */
export const REGLAGES_JOUEUR: Record<string, ReglageJoueur[]> = {
  spawn: [
    // n : 50..3000 à la relecture, 900 par défaut
    { id: 'taille', nom: 'Taille du corps', defaut: 1, paliers: [p('Petit', { n: 500 }), p('Moyen', { n: 900 }), p('Grand', { n: 1500 })] },
    // la DIRECTION de l'élan se règle à la flèche (angle) ; le palier dit sa
    // force, et s'applique à `spawn.impulsion` (vitesse 0 : parseLevel
    // retire l'impulsion, le corps naît immobile)
    {
      id: 'elan',
      nom: 'Élan au départ',
      defaut: 0,
      paliers: [p('Immobile', { vitesse: 0 }), p('Doux', { vitesse: 400 }), p('Fort', { vitesse: 900 })],
    },
  ],
  puits: [
    // force : défaut 540 u/s² (PUITS_FORCE_DEFAUT) ; 300 est la force
    // « modérée » des cœurs larges de docs/puits.md
    { id: 'force', nom: 'Attraction', defaut: 1, paliers: [p('Faible', { force: 300 }), p('Moyenne', { force: 540 }), p('Forte', { force: 1000 })] },
    // rayon : défaut 300 (PUITS_RAYON_DEFAUT) ; 450, le cœur large de la doc
    { id: 'coeur', nom: 'Taille du cœur', defaut: 1, paliers: [p('Petit', { rayon: 150 }), p('Moyen', { rayon: 300 }), p('Grand', { rayon: 450 })] },
    // portée absente : tout le tableau
    {
      id: 'portee',
      nom: 'Portée',
      defaut: 2,
      paliers: [p('Proche', { portee: 600 }), p('Moyenne', { portee: 1200 }), p('Toute la salle', { portee: undefined })],
    },
  ],
  coupelles: [
    // seuil : 0,01..0,9, défaut 0,1 (COUPELLE_SEUIL_DEFAUT)
    {
      id: 'boit',
      nom: 'Ce qu’elle boit',
      defaut: 0,
      paliers: [p('Une gorgée', { seuil: 0.1 }), p('Un quart du corps', { seuil: 0.25 }), p('La moitié', { seuil: 0.5 })],
    },
    // aspiration : 0..1, défaut 0,3 (COUPELLE_ASPIRATION_DEFAUT)
    {
      id: 'aspi',
      nom: 'Aspiration',
      defaut: 1,
      paliers: [p('Bouche seule', { aspiration: 0 }), p('Douce', { aspiration: 0.3 }), p('Forte', { aspiration: 0.7 })],
    },
  ],
  portes: [
    { id: 'repos', nom: 'Au repos', defaut: 0, paliers: [p('Fermée', { repos: undefined }), p('Ouverte', { repos: 'ouverte' })] },
    // OU / ET / OUEX, dits en phrase
    {
      id: 'regle',
      nom: 'Elle bascule quand',
      defaut: 0,
      paliers: [
        p('Une commande s’allume', { regle: undefined }),
        p('Toutes sont allumées', { regle: 'et' }),
        p('Une seule l’est', { regle: 'ouex' }),
      ],
    },
    {
      id: 'anim',
      nom: 'Mouvement',
      defaut: 0,
      paliers: [
        p('D’un coup', { materialisation: undefined }),
        p('Rideau', { materialisation: 'rideau' }),
        p('Éventail', { materialisation: 'eventail' }),
      ],
    },
  ],
  cibles: [
    {
      id: 'mode',
      nom: 'Quand le faisceau la touche',
      defaut: 0,
      paliers: [
        p('Reste allumée', { mode: undefined }), // 'tor', le défaut
        p('Tant qu’il tient', { mode: 'maintien' }),
        p('Change à chaque fois', { mode: 'bascule' }),
      ],
    },
  ],
  boxes: [
    // forme : 0 rectangle (absent), 1 disque, 2 capsule
    { id: 'forme', nom: 'Forme', defaut: 0, paliers: [p('Rectangle', { forme: undefined }), p('Disque', { forme: 1 }), p('Capsule', { forme: 2 })] },
  ],
  chasses: [
    // allure : défaut 350 u/s (CHASSE_ALLURE_DEFAUT)
    { id: 'force', nom: 'Poussée', defaut: 0, paliers: [p('Douce', { allure: 350 }), p('Forte', { allure: 600 })] },
    // « commandée » : le canal vient du FIL tiré jusqu'à elle (lot 5) ;
    // le palier « toujours » retire le canal
    { id: 'quand', nom: 'Fonctionne', defaut: 0, paliers: [p('Toujours', { canal: undefined }), p('Quand on la commande', {})] },
  ],
}

/** Applique un palier à un élément : rend une COPIE, les champs du
 *  palier écrits (ou retirés quand ils valent `undefined`). */
export function appliquePalier<T extends object>(element: T, palier: Palier): T {
  const copie = { ...element } as Record<string, unknown>
  for (const [champ, valeur] of Object.entries(palier.champs)) {
    if (valeur === undefined) delete copie[champ]
    else copie[champ] = valeur
  }
  return copie as T
}

/** Le palier où se trouve un élément pour un réglage — le premier dont
 *  tous les champs correspondent, sinon `null` (une valeur hors paliers,
 *  posée par le concepteur dans une salle reprise). */
export function palierCourant(element: object, reglage: ReglageJoueur): number | null {
  const e = element as Record<string, unknown>
  const i = reglage.paliers.findIndex((pal) =>
    Object.entries(pal.champs).every(([champ, valeur]) => e[champ] === valeur),
  )
  return i >= 0 ? i : null
}

/** Le contrôle croisé du profil : chaque champ qu'un palier écrit doit être
 *  un champ que la liste blanche garde, et chaque mode de pastille offert
 *  doit y être permis. Rend la liste des écarts (vide : le profil tient). */
export function ecartsDuProfil(): string[] {
  const ecarts: string[] = []
  for (const [collection, reglages] of Object.entries(REGLAGES_JOUEUR)) {
    if (reglages.length > 3) ecarts.push(`${collection} : plus de trois réglages`)
    if (collection === 'spawn') continue // départ : n et impulsion, lus à part
    const schema = SCHEMAS[collection]
    if (!schema) {
      ecarts.push(`${collection} : absente de la liste blanche`)
      continue
    }
    for (const r of reglages) {
      for (const pal of r.paliers) {
        for (const champ of Object.keys(pal.champs)) {
          if (!(champ in schema.requis) && !(champ in schema.options)) {
            ecarts.push(`${collection}.${r.id} écrit « ${champ} », que la liste blanche retire`)
          }
        }
      }
    }
  }
  for (const pal of REGLAGES_JOUEUR.cibles[0].paliers) {
    const mode = pal.champs.mode
    if (mode !== undefined && !(MODES_PASTILLE as readonly unknown[]).includes(mode)) {
      ecarts.push(`pastille : le mode « ${String(mode)} » n’est pas permis`)
    }
  }
  for (const f of FAMILLES_JOUEUR) {
    for (const x of f.outils) {
      if (x.collection !== 'spawn' && x.collection !== 'exit' && !SCHEMAS[x.collection]) {
        ecarts.push(`l’outil ${x.outil} pose dans « ${x.collection} », absente de la liste blanche`)
      }
      if (x.outil.startsWith('box:') && materiauDeLOutil(x.outil) === null) {
        ecarts.push(`l’outil ${x.outil} pose un matériau réservé`)
      }
    }
  }
  return ecarts
}
