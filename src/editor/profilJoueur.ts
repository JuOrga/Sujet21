// LE PROFIL DU JOUEUR : tout ce que l'atelier offre à un joueur, et rien
// d'autre. La palette en familles et les réglages en paliers nommés
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
import { canalDeCible } from '../game/laser'
import type { LevelDef } from '../game/level'

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

/** Les familles, rangées par ce que l'élément FAIT au corps. Une première
 *  barre en six familles (24/11) mêlait les parois dans trois d'entre elles
 *  (Bâtir, Matières, Chaleur) et les lampes au décor ; le concepteur, le
 *  même jour : « toutes les parois devraient être ensemble, les zones
 *  d'effet également », et la lumière à part. La chambre et le couloir
 *  (les coques du concepteur) sont sortis de l'atelier : une salle de
 *  joueur se bâtit en parois. */
export const FAMILLES_JOUEUR: FamilleJoueur[] = [
  {
    id: 'depart',
    nom: 'Départ & sortie',
    phrase: 'Où naît le corps d’eau, et le sas qu’il doit atteindre.',
    outils: [
      o('spawn', 'Départ', 'Là où le corps d’eau apparaît.', 'spawn'),
      o('exit', 'Sortie', 'Le sas à atteindre.', 'exit'),
    ],
  },
  {
    id: 'parois',
    nom: 'Parois',
    phrase: 'Tous les murs : le simple, ceux qui trient, ceux qui chauffent ou gèlent — et leurs formes.',
    outils: [
      o('box:0', 'Paroi', 'Le mur : rien ne le traverse.', 'boxes'),
      o('box:2', 'Hydrophobe', 'Repousse l’eau ; la glace y rebondit.', 'boxes'),
      o('box:1', 'Hydrophile', 'Retient ce qui la touche.', 'boxes'),
      o('box:7', 'Membrane', 'Seule l’eau passe.', 'boxes'),
      o('box:5', 'Évent', 'Seule la vapeur passe.', 'boxes'),
      o('box:8', 'Rideau', 'Seule la glace passe.', 'boxes'),
      o('box:4', 'Hublot froid', 'Une aura de gel.', 'boxes'),
      o('box:6', 'Chaudière', 'Vaporise l’eau, dégèle la glace.', 'boxes'),
      o('box:9', 'Surchauffeur', 'Rend un élan à la vapeur, une fois.', 'boxes'),
      // LES MOULES : une forme coulée dans la DERNIÈRE paroi choisie — le
      // disque en chaudière, la rampe en hydrophobe
      o('forme:1', 'Disque', 'Une paroi ronde, dans la dernière matière choisie.', 'boxes'),
      o('forme:2', 'Capsule', 'Une pilule aux bouts ronds, même matière.', 'boxes'),
      o('forme:3', 'Rampe', 'Un coin en pente : la moitié d’un rectangle.', 'boxes'),
      o('forme:4', 'Arc', 'Une conduite courbe ; l’ouverture se règle.', 'boxes'),
    ],
  },
  {
    id: 'zones',
    nom: 'Zones d’effet',
    phrase: 'Des régions qui agissent sur le corps : imposer un état, attirer, pousser, boire.',
    outils: [
      o('zone:eau', 'Zone liquide', 'Qui y entre redevient eau, et le reste.', 'zones'),
      o('zone:glace', 'Zone glace', 'Qui y entre gèle, et le reste.', 'zones'),
      o('zone:vapeur', 'Zone vapeur', 'Qui y entre s’évapore, et le reste.', 'zones'),
      o('puits', 'Puits de gravité', 'Attire le corps : on peut y orbiter.', 'puits'),
      o('chasse', 'Chasse', 'Un courant qui pousse sans déchirer.', 'chasses'),
      o('sponge', 'Éponge', 'Boit le liquide qui s’attarde.', 'sponges'),
      o('box:11', 'Vide', 'Le dehors : qui s’y attarde est aspiré.', 'boxes'),
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
      o('rail', 'Rail', 'Guide l’arc du plasma.', 'rails'),
    ],
  },
  {
    id: 'lumiere',
    nom: 'Lumière',
    phrase: 'L’éclairage de la salle. Sans effet sur le corps.',
    outils: [
      o('lumiere', 'Lampe', 'Éclaire la salle (4 au plus).', 'lumieres'),
      o('bande', 'Bandeau lumineux', 'Une ligne de lumière.', 'lumieres'),
    ],
  },
  {
    id: 'decor',
    nom: 'Décor',
    phrase: 'Textes, fonds et décors. Sans effet sur le corps.',
    outils: [
      o('label', 'Texte', 'Un mot sur un mur (40 signes).', 'labels'),
      o('box:12', 'Baie vitrée', 'Le dehors derrière une vitre.', 'boxes'),
      o('decal:tuyaux', 'Tuyaux', 'Un décor de tuyauterie.', 'decals'),
      o('decal:serre-ble-nain', 'Blé nain', 'Un bac de la serre.', 'decals'),
    ],
  },
]

/** Les outils transverses, hors familles, toujours à portée : choisir et
 *  déplacer, effacer à la GOMME, et la SUPERPOSITION (deux parois qui se
 *  chevauchent : celle du dessus ronge l'autre). Le concepteur, 24/11 :
 *  « il manque tous les outils à disposition dans l'éditeur ». */
export const OUTILS_TRANSVERSES = ['select', 'gomme', 'cut'] as const

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

// ---- L'ÉLÉMENT CHOISI DANS L'ATELIER ------------------------------------------
// L'éditeur désigne sa sélection par une SORTE au singulier (« porte »,
// « box ») et un rang ; la liste blanche et les paliers parlent en
// collections (« portes », « boxes »). Ces fonctions font le pont, sans
// DOM : le banc les tient.

/** Une sélection de l'éditeur, réduite à ce que l'atelier en lit. */
export interface SelectionJoueur {
  kind: string
  index?: number
}

/** La collection de LevelDef que désigne une sorte de sélection. */
export const COLLECTION_DE_SORTE: Readonly<Record<string, string>> = {
  box: 'boxes',
  structure: 'structures',
  sponge: 'sponges',
  label: 'labels',
  laser: 'lasers',
  cible: 'cibles',
  puits: 'puits',
  mire: 'mires',
  coupelle: 'coupelles',
  porte: 'portes',
  chasse: 'chasses',
  rail: 'rails',
  lumiere: 'lumieres',
  decal: 'decals',
  zone: 'zones',
  spawn: 'spawn',
  exit: 'exit',
}

const OUTIL_DE_SORTE: Readonly<Record<string, string>> = {
  sponge: 'sponge',
  label: 'label',
  laser: 'laser',
  cible: 'cible',
  puits: 'puits',
  mire: 'mire',
  coupelle: 'coupelle',
  porte: 'porte',
  chasse: 'chasse',
  rail: 'rail',
  spawn: 'spawn',
  exit: 'exit',
}

const TOUS_LES_OUTILS: ReadonlyMap<string, OutilJoueur & { famille: string }> = new Map(
  FAMILLES_JOUEUR.flatMap((f) => f.outils.map((x) => [x.outil, { ...x, famille: f.nom }] as const)),
)

function element(level: LevelDef, s: SelectionJoueur): Record<string, unknown> | null {
  if (s.kind === 'spawn') return level.spawn as unknown as Record<string, unknown>
  if (s.kind === 'exit') return level.exit as unknown as Record<string, unknown>
  const liste = (level as unknown as Record<string, unknown>)[COLLECTION_DE_SORTE[s.kind] ?? '']
  if (!Array.isArray(liste) || s.index === undefined) return null
  return (liste[s.index] as Record<string, unknown> | undefined) ?? null
}

/** L'outil du joueur qui correspond à l'élément choisi — son nom, sa
 *  phrase et sa famille, pour l'en-tête du panneau. `null` : un élément
 *  hors du profil (une salle reprise d'ailleurs). */
export function outilDeSelection(
  level: LevelDef,
  s: SelectionJoueur,
): (OutilJoueur & { famille: string }) | null {
  const el = element(level, s)
  if (!el) return null
  let outil = OUTIL_DE_SORTE[s.kind]
  if (s.kind === 'box') outil = `box:${String(el.material)}`
  else if (s.kind === 'structure') outil = `struct:${String(el.type)}`
  else if (s.kind === 'lumiere') outil = el.forme === 'bandeau' ? 'bande' : 'lumiere'
  else if (s.kind === 'decal') outil = `decal:${String(el.kind)}`
  else if (s.kind === 'zone') outil = `zone:${String(el.force)}`
  return (outil && TOUS_LES_OUTILS.get(outil)) || null
}

/** Les réglages qu'offre l'élément choisi (au plus trois). */
export function reglagesDeSelection(s: SelectionJoueur): ReglageJoueur[] {
  return REGLAGES_JOUEUR[COLLECTION_DE_SORTE[s.kind] ?? ''] ?? []
}

/** Le palier où se trouve l'élément pour un réglage. Le départ est à part :
 *  sa taille est `spawn.n`, son élan la vitesse de `spawn.impulsion`. */
export function lisPalier(level: LevelDef, s: SelectionJoueur, r: ReglageJoueur): number | null {
  if (s.kind === 'spawn' && r.id === 'elan') {
    const v = level.spawn.impulsion?.vitesse ?? 0
    const i = r.paliers.findIndex((p) => p.champs.vitesse === v)
    return i >= 0 ? i : null
  }
  const el = element(level, s)
  return el ? palierCourant(el, r) : null
}

/** Pose un palier sur l'élément choisi. Rend une COPIE du tableau (le
 *  tableau d'origine n'est pas touché), ou `null` si l'élément n'existe
 *  pas. L'élan du départ garde sa DIRECTION (réglée à la flèche) ; à
 *  vitesse nulle, l'impulsion disparaît — le corps naît immobile. */
export function posePalier(level: LevelDef, s: SelectionJoueur, reglageId: string, i: number): LevelDef | null {
  const r = reglagesDeSelection(s).find((x) => x.id === reglageId)
  const palier = r?.paliers[i]
  if (!palier) return null
  const copie = structuredClone(level)
  if (s.kind === 'spawn') {
    if (reglageId === 'elan') {
      const vitesse = palier.champs.vitesse as number
      if (vitesse > 0) copie.spawn.impulsion = { angle: copie.spawn.impulsion?.angle ?? 0, vitesse }
      else delete copie.spawn.impulsion
    } else {
      Object.assign(copie.spawn, palier.champs)
    }
    return copie
  }
  const liste = (copie as unknown as Record<string, unknown[]>)[COLLECTION_DE_SORTE[s.kind] ?? '']
  if (!Array.isArray(liste) || s.index === undefined || !liste[s.index]) return null
  liste[s.index] = appliquePalier(liste[s.index] as object, palier)
  return copie
}

// ---- RELIER : la commande et ce qu'elle ouvre ----------------------------------
// Dans l'éditeur du concepteur, une porte vise un numéro de canal recopié à
// la main. Dans l'atelier, on RELIE : la porte (ou la chasse) choisie, puis
// la pastille ou la coupelle qui la commandera. Sous le moteur, chaque lien
// reste un canal — le format des salles ne change pas.

/** Les canaux en usage dans la salle (pastilles, coupelles, portes, chasses). */
function canauxPris(level: LevelDef): Set<number> {
  const pris = new Set<number>()
  const cibles = level.cibles ?? []
  cibles.forEach((_, i) => pris.add(canalDeCible(cibles, i)))
  for (const x of [...(level.coupelles ?? []), ...(level.portes ?? []), ...(level.chasses ?? [])]) {
    if (typeof x.canal === 'number') pris.add(x.canal)
  }
  return pris
}

function canalLibre(level: LevelDef): number {
  const pris = canauxPris(level)
  let n = 1
  while (pris.has(n)) n++
  return n
}

/** Le canal d'une commande (pastille ou coupelle), ou `null`. */
export function canalDeCommande(level: LevelDef, s: SelectionJoueur): number | null {
  if (s.index === undefined) return null
  if (s.kind === 'cible' && level.cibles?.[s.index]) return canalDeCible(level.cibles, s.index)
  if (s.kind === 'coupelle' && level.coupelles?.[s.index]) return level.coupelles[s.index].canal
  return null
}

/** Les commandes qui pilotent une porte ou une chasse : celles qui partagent
 *  son canal. */
export function commandesDe(level: LevelDef, s: SelectionJoueur): SelectionJoueur[] {
  const cible = element(level, s)
  const canal = cible?.canal
  if (typeof canal !== 'number') return []
  const out: SelectionJoueur[] = []
  ;(level.cibles ?? []).forEach((_, i) => {
    if (canalDeCible(level.cibles!, i) === canal) out.push({ kind: 'cible', index: i })
  })
  ;(level.coupelles ?? []).forEach((c, i) => {
    if (c.canal === canal) out.push({ kind: 'coupelle', index: i })
  })
  return out
}

export type Liaison = { ok: true; level: LevelDef; message: string } | { ok: false; message: string }

/** RELIE une commande à une porte ou une chasse. Si la porte n'a encore
 *  aucune commande, elle adopte le canal de celle-ci ; sinon, la commande
 *  REJOINT le canal de la porte — ses autres commandes restent branchées.
 *  Rend une copie du tableau. */
export function relie(level: LevelDef, cible: SelectionJoueur, commande: SelectionJoueur): Liaison {
  if (cible.kind !== 'porte' && cible.kind !== 'chasse') {
    return { ok: false, message: 'On relie une commande à une porte ou à une chasse.' }
  }
  const canalCommande = canalDeCommande(level, commande)
  if (canalCommande === null) {
    return { ok: false, message: 'Cliquez une pastille ou une coupelle : ce sont elles qui commandent.' }
  }
  const copie = structuredClone(level)
  const col = cible.kind === 'porte' ? copie.portes : copie.chasses
  const visee = col?.[cible.index ?? -1]
  if (!visee) return { ok: false, message: 'La porte n’existe plus.' }
  const nom = cible.kind === 'porte' ? 'La porte' : 'La chasse'
  if (commandesDe(level, cible).some((c) => c.kind === commande.kind && c.index === commande.index)) {
    return { ok: false, message: `${nom} est déjà reliée à cette commande.` }
  }
  if (typeof visee.canal !== 'number' || commandesDe(level, cible).length === 0) {
    visee.canal = canalCommande
  } else if (commande.kind === 'cible') {
    copie.cibles![commande.index!].canal = visee.canal
  } else {
    copie.coupelles![commande.index!].canal = visee.canal
  }
  return { ok: true, level: copie, message: `${nom} est reliée : elle obéit à cette commande.` }
}

/** COUPE les liens d'une porte ou d'une chasse : elle prend un canal que
 *  rien n'allume. Une porte fermée au repos le restera ; une chasse
 *  redevient permanente. */
export function coupeLiens(level: LevelDef, cible: SelectionJoueur): LevelDef | null {
  const copie = structuredClone(level)
  if (cible.kind === 'porte' && copie.portes?.[cible.index ?? -1]) {
    copie.portes[cible.index!].canal = canalLibre(level)
    return copie
  }
  if (cible.kind === 'chasse' && copie.chasses?.[cible.index ?? -1]) {
    delete copie.chasses[cible.index!].canal
    return copie
  }
  return null
}

// ---- LA BARRE DE L'ATELIER -------------------------------------------------------

/** La clé de palette (data-tool) de l'outil en main : la barre de
 *  l'atelier s'en sert pour surligner le bon bouton. */
export function cleDOutil(t: {
  kind: string
  material?: number
  forme?: number
  sorte?: string
  type?: number
  force?: string
  monnaie?: string
}): string {
  switch (t.kind) {
    case 'box':
      return t.forme ? `forme:${t.forme}` : `box:${t.material ?? 0}`
    case 'decal':
      return `decal:${t.sorte ?? ''}`
    case 'structure':
      return `struct:${t.type ?? 0}`
    case 'zone':
      return `zone:${t.force ?? ''}`
    case 'plot':
      return `plot:${t.monnaie ?? ''}`
    default:
      return t.kind
  }
}

/** La famille où se range un outil — la barre s'y ouvre quand l'outil
 *  est pris ailleurs (un raccourci, l'annulation). */
export function familleDeLOutil(outil: string): string | null {
  return FAMILLES_JOUEUR.find((f) => f.outils.some((x) => x.outil === outil))?.id ?? null
}

// ---- LA VÉRIFICATION, DITE AU JOUEUR -------------------------------------------
// checkLevel (levelIO.ts) parle au CONCEPTEUR : le journal de bord, la
// « chimie », l'étiquette du sas, les canaux numérotés, les unités « u ».
// Le joueur ne voit ni journal, ni canal, ni unité (le concepteur, 24/11 :
// « je ne comprends pas ces messages »). Chaque message passe donc par
// cette table : retiré s'il ne concerne que le concepteur, REDIT sinon,
// avec ce qu'il faut faire. Une ERREUR n'est jamais retirée — elle bloque
// l'essai, le joueur doit savoir pourquoi ; une erreur sans traduction
// reste telle quelle plutôt que de disparaître.

interface Traduction {
  motif: RegExp
  /** null : un message du concepteur, retiré (avertissements seulement) */
  dit: string | null | ((m: RegExpExecArray) => string)
}

const TRADUCTIONS: Traduction[] = [
  // ce qui ne regarde que le concepteur
  { motif: /^L’entrée de journal fait moins/, dit: null },
  { motif: /^Aucune étiquette ne désigne le sas/, dit: null },
  { motif: /^Aucune chimie ni éponge/, dit: null },
  { motif: /^Le tableau est vide/, dit: null },
  { motif: /^Le sas est à moins de 800 u du départ/, dit: null },
  { motif: /^La carte imposée/, dit: null },
  { motif: /^Le preset et une carte imposée/, dit: null },
  { motif: /^Des mires sans le tir de glace/, dit: null }, // l'atelier impose l'Éclateur lui-même
  // le départ et la sortie
  { motif: /^Le point de départ est hors de la cuve/, dit: 'Le départ est hors de la salle : ramenez-le à l’intérieur.' },
  { motif: /^Le point de départ naît dans une surface/, dit: 'Le départ touche une paroi : le corps naîtrait coincé. Écartez-le un peu.' },
  { motif: /^Le sas déborde de la cuve/, dit: 'La sortie dépasse de la salle : ramenez-la à l’intérieur.' },
  { motif: /^Le sas est trop petit/, dit: 'La sortie est trop petite : agrandissez-la en tirant ses coins.' },
  { motif: /^Le départ est posé dans le corps d’un rail/, dit: 'Le départ est posé sur un rail : le corps naîtrait coincé. Écartez-le.' },
  // les budgets
  { motif: /^Trop de blocs : (\d+) posés, (\d+)/, dit: (m) => `Trop de parois : ${m[1]} pour ${m[2]} au plus — les dernières seraient invisibles. Retirez-en quelques-unes.` },
  { motif: /^Trop de lampes : (\d+) posées, (\d+)/, dit: (m) => `Trop de lampes : ${m[1]} pour ${m[2]} au plus — les dernières resteraient éteintes.` },
  // les liens (le joueur RELIE, il ne voit jamais de numéro de canal)
  { motif: /^Une porte est asservie au canal/, dit: 'Une porte n’est reliée à aucune commande : elle ne bougera jamais. Choisissez-la, puis « Relier une commande ».' },
  { motif: /^Une chasse est asservie au canal/, dit: 'Une chasse attend une commande qui n’existe plus. Reliez-la, ou « Couper les liens » pour qu’elle souffle toujours.' },
  { motif: /^Une coupelle allume le canal/, dit: 'Une coupelle n’ouvre rien : le corps y paierait pour rien. Reliez-la à une porte.' },
  { motif: /^Une cible sans émetteur laser/, dit: 'Une pastille sans laser : elle ne s’allumera jamais. Posez un laser qui la vise.' },
  { motif: /^Un émetteur laser sans cible/, dit: 'Un laser sans pastille : son faisceau n’ouvre rien.' },
  // le reste, redit sans unités ni jargon
  { motif: /^Une coupelle touche le départ/, dit: 'Une coupelle touche le départ : elle aspirerait le corps dès la première seconde.' },
  { motif: /^Les coupelles demandent ensemble (\d+) %/, dit: (m) => `Les coupelles demandent ensemble ${m[1]} % du corps : personne ne pourra toutes les payer.` },
  { motif: /^Un puits a une portée plus courte que son cœur/, dit: 'Un puits a une portée plus courte que son cœur : choisissez une portée plus grande.' },
  { motif: /^Le corps naît au fond d’un puits/, dit: 'Le départ est au fond d’un puits : le corps n’en sortira qu’en se vidant. Donnez-lui de l’élan, ou éloignez-le.' },
  { motif: /^Deux cœurs de puits se recouvrent/, dit: 'Deux puits se chevauchent : le corps s’y déchirerait. Écartez-les.' },
  { motif: /^Un rail magnétique sans émetteur laser/, dit: 'Un rail sans laser : il ne guide rien.' },
]

/** Les messages de la vérification, dits au joueur. */
export function verdictsJoueur(verdicts: readonly { niveau: 'erreur' | 'avertissement'; message: string }[]): {
  niveau: 'erreur' | 'avertissement'
  message: string
}[] {
  const out: { niveau: 'erreur' | 'avertissement'; message: string }[] = []
  for (const v of verdicts) {
    let dit: string | null = v.message
    for (const t of TRADUCTIONS) {
      const m = t.motif.exec(v.message)
      if (!m) continue
      dit = typeof t.dit === 'function' ? t.dit(m) : t.dit
      break
    }
    // une erreur ne disparaît jamais : elle bloque l'essai
    if (dit === null && v.niveau === 'erreur') dit = v.message
    if (dit !== null) out.push({ niveau: v.niveau, message: dit })
  }
  return out
}

/** LA FAMILLE OUVERTE DANS LA BARRE. Elle suit l'outil en main quand
 *  l'outil CHANGE (pris autrement que par la barre : une annulation, un
 *  profil rouvert) — et seulement alors. Avant, elle le suivait à chaque
 *  rafraîchissement : l'hydrophobe en main, cliquer « Forces » rouvrait
 *  aussitôt « Matières », et il fallait repasser par « Choisir » (sans
 *  famille) pour changer d'élément (le concepteur, 24/11). */
export function familleDuDock(
  etat: { famille: string; outilVu: string },
  outilCourant: string,
): { famille: string; outilVu: string } {
  if (outilCourant === etat.outilVu) return etat
  return { famille: familleDeLOutil(outilCourant) ?? etat.famille, outilVu: outilCourant }
}
