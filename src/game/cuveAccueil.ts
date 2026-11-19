// LA CUVE DE L'ACCUEIL — la salle qui tourne derrière le menu.
//
// Le concepteur, 18/11 : « pas le fond du hub, une structure ronde avec le
// volume dedans, et il faut que ce qui est éjecté revienne — donc peut-être
// un puits de gravité ». Derrière la fiche, le jeu chargeait le hub : ses
// couloirs, ses cuves, ses pancartes de réparation — un décor de partie,
// pas une vitrine. Ici, rien qu'un anneau de coque et l'échantillon au
// milieu, dans le vide.
//
// LA VITRE. Puis, l'anneau vu (et un fond étoilé seul essayé, puis écarté) :
// « comme s'il y avait une vitre sous lui ». L'intérieur de l'anneau devient
// une baie vitrée (MAT_BAIE) en disque : le dehors se voit au travers, teinté
// à peine, un reflet qui balaie le verre, une monture rivée contre la paroi.
// L'échantillon flotte au-dessus d'un hublot, pas dans le vide. La baie est
// du décor (sansPhysique) : le corps passe dessus comme sur un sol, et la
// physique mesurée plus bas n'en dépend pas.
//
// Puis, la vitre vue : « enlève la Terre derrière ; les reflets se répètent
// trop, et il faudrait un reflet du volume » — et « pas la Voie lactée,
// juste un ciel étoilé ». Derrière le verre, des étoiles sur la nuit
// (main.ts impose le ciel procédural à la cuve) ; la vitre porte
// l'habillage 1, que le rendu lit comme LA VITRE DE LA VITRINE : deux
// reflets fixés au verre, et le corps renvoyé dessous (renderer.ts,
// refletCorps).
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
import { FORME_ARC, FORME_DISQUE } from './formes'
import { MAT_BAIE, MAT_WALL, type LevelDef, type PuitsDef } from './level'

export const CODE_ACCUEIL = 'ACCUEIL'

/** Le rayon extérieur de l'anneau (u), et son épaisseur. */
export const ANNEAU_RAYON = 720
export const ANNEAU_EPAISSEUR = 70

/** Le rayon de la vitre (u) : elle passe sous la paroi de l'anneau, pour que
 *  sa monture se lise contre la paroi et qu'aucun jour ne reste entre les
 *  deux. */
export const VITRE_RAYON = ANNEAU_RAYON - ANNEAU_EPAISSEUR / 2

/** Le puits du centre : un cœur plus large que l'anneau (le halo képlérien,
 *  qui étire, n'existe jamais dans la cuve), une force qui ramène une goutte
 *  lancée à la vitesse d'éjection avant qu'elle n'atteigne la paroi.
 *
 *  3 000 et non plus 3 600 : « réduis un peu la gravité » (le concepteur,
 *  19/11). La période passe de 3,3 s à 3,6 s (2π·√(rayon/force)) : les
 *  gouttes montent plus loin et reviennent plus lentement, et le corps se
 *  laisse un peu plus déporter. Plus bas, le retour traîne : à 2 800,
 *  18 gouttes sur 900 sont encore dehors 4 s après (cuveAccueil.spec.ts). */
export const PUITS_ACCUEIL: PuitsDef = { x: 0, y: 0, force: 3000, rayon: 1000 }

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
      // LA VITRE sous l'échantillon — un fond (estUnFond) : elle se peint sous
      // tout le reste, quel que soit son rang
      {
        minX: -VITRE_RAYON,
        minY: -VITRE_RAYON,
        maxX: VITRE_RAYON,
        maxY: VITRE_RAYON,
        material: MAT_BAIE,
        forme: FORME_DISQUE,
        // l'habillage 1 d'une baie : la vitre de la vitrine — deux reflets
        // fixés au verre au lieu du balayage répété, et le reflet du corps
        skin: 1,
      },
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
