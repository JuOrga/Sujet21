// LA CUVE DE L'ACCUEIL — la salle qui tourne derrière le menu.
//
// Le concepteur, 18/11 : « pas le fond du hub, une structure ronde avec le
// volume dedans, et il faut que ce qui est éjecté revienne — donc peut-être
// un puits de gravité ». Derrière la fiche, le jeu chargeait le hub : ses
// couloirs, ses cuves, ses pancartes de réparation — un décor de partie,
// pas une vitrine. Ici, rien qu'un anneau de coque et l'échantillon au
// milieu, dans le vide.
//
// LE PUITS EST HARMONIQUE PARTOUT DANS L'ANNEAU (son cœur le déborde) :
// a = force · r / rayon, et toutes les orbites ont la MÊME période. Tout
// ce qui part d'un point y revient donc au même instant, une demi-période
// plus tard : les gouttes éjectées et le corps qui recule se recroisent au
// centre, et y fusionnent. Le joueur qui touche la cuve dès le menu voit
// la règle du jeu — se déplacer, c'est rétrécir — et voit la matière lui
// revenir. La marée harmonique est compressive (docs/puits.md §2) : elle
// tient le corps rond au lieu de l'étirer.
//
// Les nombres sont MESURÉS sur le vrai solveur (cuveAccueil.spec.ts) :
// à refaire si on les touche.
import { FORME_ARC } from './formes'
import { MAT_WALL, type LevelDef, type PuitsDef } from './level'

export const CODE_ACCUEIL = 'ACCUEIL'

/** Le rayon extérieur de l'anneau (u), et son épaisseur. */
export const ANNEAU_RAYON = 720
export const ANNEAU_EPAISSEUR = 70

/** Le puits du centre : un cœur plus large que l'anneau (le halo képlérien,
 *  qui étire, n'existe jamais dans la cuve), une force qui ramène une goutte
 *  lancée à la vitesse d'éjection avant qu'elle n'atteigne la paroi. */
export const PUITS_ACCUEIL: PuitsDef = { x: 0, y: 0, force: 3600, rayon: 1000 }

export function tableauAccueil(): LevelDef {
  const R = ANNEAU_RAYON
  // la salle ne dépasse pas 2 600 u de large : au-delà, zonesDuHub prête
  // au hub des sas et des comptoirs codés en dur (game/hub.ts)
  const b = { minX: -1000, minY: -1000, maxX: 1000, maxY: 1000 }
  return {
    name: 'Cuve d’essai',
    code: CODE_ACCUEIL,
    journal: '',
    bounds: b,
    spawn: { x: 0, y: 0, n: 900 },
    // pas de sas (ronde.ts, sansSas) : rien ne se dessine, rien n'aspire —
    // la boîte reste hors de l'anneau, inatteignable
    exit: { minX: 900, minY: -40, maxX: 960, maxY: 40 },
    boxes: [
      {
        minX: -R,
        minY: -R,
        maxX: R,
        maxY: R,
        material: MAT_WALL,
        forme: FORME_ARC,
        p0: ANNEAU_EPAISSEUR / R, // l'épaisseur, relative au rayon
        p1: 180, // la demi-ouverture : l'anneau entier
      },
    ],
    sponges: [],
    labels: [],
    puits: [PUITS_ACCUEIL],
    // le dehors est le vide spatial : l'anneau flotte, rien d'autre
    coque: 'structures',
  }
}

/** LE CADRAGE de la cuve : l'anneau ENTIER, centré dans la place que le
 *  menu laisse libre (à droite du rail ; au téléphone debout, la fenêtre
 *  entre le titre et le verbe). La caméra ne suit pas le corps ici — il
 *  revient toujours au centre — elle montre la vitrine. Rend la position
 *  de la caméra (monde) et son zoom (px CSS par unité). */
export function cadreAccueil(
  vueL: number,
  vueH: number,
  libre: { left: number; top: number; right: number; bottom: number },
): { x: number; y: number; zoom: number } {
  const l = Math.max(80, libre.right - libre.left)
  const h = Math.max(80, libre.bottom - libre.top)
  // l'anneau, sa paroi comprise, et une marge pour l'ombre de son relief
  const zoom = (Math.min(l, h) * 0.9) / (2 * ANNEAU_RAYON)
  const cx = (libre.left + libre.right) / 2
  const cy = (libre.top + libre.bottom) / 2
  // l'écran place (wx, wy) en (vueL/2 + (wx − x)·zoom, vueH/2 − (wy − y)·zoom) :
  // on veut le centre du monde (0, 0) au centre de la place libre
  return { x: (vueL / 2 - cx) / zoom, y: (cy - vueH / 2) / zoom, zoom }
}
