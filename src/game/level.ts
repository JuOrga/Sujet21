// Définition des tableaux (§7.1) : un problème fermé — on entre avec le
// volume plein, il n'y a pas d'eau à ramasser, on sort par un sas.
// Les obstacles sont de la chimie, pas de la géométrie (§6).

import type { Bounds } from '../sim/solver'

export const MAT_WALL = 0
export const MAT_HYDROPHILE = 1
export const MAT_HYDROPHOBE = 2
export const MAT_EXIT = 3 // rendu seulement, pas de physique

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

export function pointInBox(
  x: number,
  y: number,
  b: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY
}
