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
import { vitesseCirculaire } from './puits'

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

/** LES SATELLITES : quelques boules du corps déjà en orbite à l'ouverture.
 *
 *  Le concepteur, 19/11 : « dès l'ouverture du menu, des boules du
 *  satellite en orbite autour du volume — ça le fait souvent en s'amusant
 *  avec, mais je souhaite que par défaut il y en ait, de façon aléatoire à
 *  chaque ouverture ». En jouant, ce sont les gouttes éjectées qui ont
 *  frôlé la paroi : elles y ont pris un moment cinétique et tournent sans
 *  repasser par le corps (cuveAccueil.spec.ts, la garde du retour). Ici on
 *  les pose d'emblée, prises AU corps : le total reste celui du spawn.
 *
 *  Le puits étant harmonique, une vitesse circulaire donne un cercle et
 *  toute autre vitesse TANGENTE une ellipse CENTRÉE (demi-axes r et f·r) :
 *  la boule reste entre r et f·r, sans jamais plonger vers le corps. Les
 *  orbites ont toutes la même période — le système tourne d'un bloc, et
 *  deux boules sur des cercles distincts ne se rencontrent jamais.
 *
 *  Bornes MESURÉES sur le vrai solveur (cuveAccueil.spec.ts) :
 *  - le rayon : au-dessus du halo de capture du corps (≈ 180 u, 2,5 fois
 *    son rayon quadratique de 73 u) — sinon le rappel des égarées les
 *    reprend aussitôt —, et sous la paroi (650 u) même au bout de l'ellipse ;
 *  - la taille : jusqu'à 5 billes, une boule tient 30 s en orbite sans se
 *    défaire ; à 19, la différence de vitesse entre ses deux bords la
 *    déchire en un tour. */
export const SATELLITES_RAYON_MIN = 230
export const SATELLITES_RAYON_MAX = 560
/** Le nombre de boules (bornes incluses) et de billes par boule. */
export const SATELLITES_BOULES: readonly [number, number] = [3, 6]
export const SATELLITES_BILLES: readonly [number, number] = [2, 5]
/** L'écart à la vitesse circulaire : 0,92 à 1,08 — des ellipses à peine
 *  aplaties, pour que le ballet ne soit pas un mécanisme d'horloge. */
export const SATELLITES_EXCENTRICITE = 0.08

export interface BilleSatellite {
  x: number
  y: number
  vx: number
  vy: number
}

/** Les billes des satellites, tirées au sort (alea : Math.random en jeu, une
 *  suite fixée en test). Chaque boule a son anneau à elle : la plage de
 *  rayons est découpée en autant de bandes que de boules, et chaque boule
 *  tombe au milieu de sa bande (± un quart) — deux boules voisines restent
 *  à une demi-bande au moins l'une de l'autre. Toutes tournent dans le
 *  même sens, tiré lui aussi. `espacement` est celui du réseau du corps
 *  (params.particleSpacing) : une boule y est un petit amas hexagonal. */
export function satellitesAccueil(alea: () => number, espacement: number): BilleSatellite[] {
  const P = PUITS_ACCUEIL
  const entre = ([a, b]: readonly [number, number]): number => a + Math.floor(alea() * (b - a + 1))
  const nBoules = entre(SATELLITES_BOULES)
  const sens = alea() < 0.5 ? 1 : -1
  const bande = (SATELLITES_RAYON_MAX - SATELLITES_RAYON_MIN) / nBoules
  const billes: BilleSatellite[] = []
  for (let b = 0; b < nBoules; b++) {
    const r = SATELLITES_RAYON_MIN + bande * (b + 0.5 + (alea() - 0.5) * 0.5)
    const phase = alea() * 2 * Math.PI
    const f = 1 + (alea() * 2 - 1) * SATELLITES_EXCENTRICITE
    // la vitesse angulaire du centre de la boule, appliquée à TOUTE la
    // boule comme à un solide : ses billes partent ensemble
    const w = (sens * f * vitesseCirculaire(P, r)) / r
    const cx = P.x + r * Math.cos(phase)
    const cy = P.y + r * Math.sin(phase)
    const n = entre(SATELLITES_BILLES)
    for (let k = 0; k < n; k++) {
      // la bille 0 au centre, les suivantes en couronne hexagonale
      const a = ((k - 1) / 6) * 2 * Math.PI + phase
      const x = k === 0 ? cx : cx + espacement * Math.cos(a)
      const y = k === 0 ? cy : cy + espacement * Math.sin(a)
      billes.push({ x, y, vx: -w * (y - P.y), vy: w * (x - P.x) })
    }
  }
  return billes
}

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
