// Définition des tableaux (§7.1) : un problème fermé — on entre avec le
// volume plein, il n'y a pas d'eau à ramasser, on sort par un sas.
// Les obstacles sont de la chimie, pas de la géométrie (§6).

import type { Bounds } from '../sim/solver'

export const MAT_WALL = 0
export const MAT_HYDROPHILE = 1
export const MAT_HYDROPHOBE = 2
export const MAT_EXIT = 3 // rendu seulement, pas de physique
export const MAT_FROID = 4 // plaque froide : gèle l'eau qui s'attarde dans son aura

export interface ObstacleBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
  material: number
}

export interface SpongeDef {
  minX: number
  minY: number
  cols: number
  rows: number
  cellSize: number
  capacityPerCell: number // particules absorbées avant qu'une cellule se solidifie
}

export interface LevelDef {
  name: string
  bounds: Bounds
  spawn: { x: number; y: number; n: number }
  exit: { minX: number; minY: number; maxX: number; maxY: number }
  boxes: ObstacleBox[]
  sponges: SpongeDef[]
}

function box(minX: number, minY: number, maxX: number, maxY: number, material: number): ObstacleBox {
  return { minX, minY, maxX, maxY, material }
}

// Tableau 1 — lecture de gauche à droite :
// 1. une cloison hydrophobe percée de deux ouvertures (se scinder ou se
//    faufiler, les bords déviant les trajectoires) ;
// 2. un îlot hydrophile au centre : on s'y colle, on y rampe, il faut payer
//    une impulsion pour s'en arracher ;
// 3. un mur d'éponge qui barre la moitié basse : passer par le couloir haut,
//    ou payer le passage en volume et ouvrir une brèche permanente (§6) ;
// 4. le sas, en bas à droite — derrière l'éponge : le couloir haut oblige à
//    redescendre le long de la paroi.
export const TABLEAU_1: LevelDef = {
  name: 'Le sas',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -420, maxX: 1180, maxY: -180 },
  boxes: [
    // 1. cloison hydrophobe : trois segments, deux ouvertures
    box(-420, -750, -360, -380, MAT_HYDROPHOBE),
    box(-420, -180, -360, 180, MAT_HYDROPHOBE),
    box(-420, 380, -360, 750, MAT_HYDROPHOBE),
    // 2. îlot hydrophile
    box(-80, -160, 240, -40, MAT_HYDROPHILE),
    // muret neutre au-dessus du couloir de l'éponge
    box(560, 240, 640, 750, MAT_WALL),
  ],
  sponges: [
    // 3. mur d'éponge : bloque de bas en haut jusqu'au couloir (y = 40..240)
    {
      minX: 560,
      minY: -750,
      cols: 2,
      rows: 33,
      cellSize: 24,
      capacityPerCell: 5,
    },
  ],
}

// Tableau 2 — la chambre froide (une mécanique : l'état). Lecture :
// 1. deux plaques froides encadrent l'entrée : passer au centre, ou raser et
//    payer en givre — le froid se lit à son aura avant de mordre ;
// 2. une chicane hydrophobe au milieu : les rebonds font perdre le contrôle,
//    et le petit plot froid est un mouillage volontaire — geler un flanc pour
//    s'arrêter net, puis payer le dégel en temps ;
// 3. une barrière froide devant le sas, percée d'un passage étroit : viser
//    juste, ou traverser en acceptant un gel partiel.
export const TABLEAU_2: LevelDef = {
  name: 'La chambre froide',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: -950, y: 0, n: 900 },
  exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
  boxes: [
    // 1. porte froide d'entrée
    box(-500, -750, -440, -150, MAT_FROID),
    box(-500, 150, -440, 750, MAT_FROID),
    // 2. chicane hydrophobe + plot d'ancrage
    box(-100, -420, -20, -240, MAT_HYDROPHOBE),
    box(60, 240, 140, 420, MAT_HYDROPHOBE),
    box(180, -50, 260, 50, MAT_FROID),
    // 3. barrière froide devant le sas, passage en y = -80..180
    box(700, -750, 760, -80, MAT_FROID),
    box(700, 180, 760, 750, MAT_FROID),
  ],
  sponges: [],
}

// L'ordre de la partie : chaque tableau enseigne une chose, puis on boucle.
export const TABLEAUX: LevelDef[] = [TABLEAU_1, TABLEAU_2]

export function pointInBox(
  x: number,
  y: number,
  b: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY
}
