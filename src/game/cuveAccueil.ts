// LA CUVE DE L'ACCUEIL — ce qui tourne derrière le menu, et derrière la pause.
//
// Le concepteur, 18/11 : « pas le fond du hub, une structure ronde avec le
// volume dedans, et il faut que ce qui est éjecté revienne — donc peut-être
// un puits de gravité ». Puis, l'anneau vu : « juste un beau fond étoilé,
// sans la planète et sans la structure serait parfait, peut-être une gravité
// légèrement plus faible ». Il ne reste donc RIEN que l'échantillon, un puits
// invisible et la Voie lactée derrière (main.ts impose le ciel « plaque » ici,
// quel que soit celui que le joueur a choisi pour la partie).
//
// LE PUITS EST HARMONIQUE là où la matière va (son cœur déborde la plus
// lointaine goutte) : a = force · r / rayon, et toutes les orbites ont la
// MÊME période. Ce qui part du centre y revient au même instant, une
// demi-période plus tard : les gouttes et le corps qui recule se recroisent
// au centre, et y fusionnent. La marée harmonique est compressive
// (docs/puits.md §2) : elle tient le corps rond au lieu de l'étirer.
//
// LE FREIN. L'anneau d'avant amortissait les gouttes à chaque rebond ; sans
// lui, une goutte partie de biais (le corps recule pendant qu'on éjecte) suit
// une ellipse qui ne recroise plus le corps, et orbite sans fin — mesuré :
// 894 particules sur 900 six secondes après un jet de 1,5 s. Un frein léger
// sur toute la vitrine (pas sur le jeu : le vide du jeu ne freine rien) fait
// spiraler ces gouttes jusqu'au centre.
//
// Les nombres sont MESURÉS sur le vrai solveur (cuveAccueil.spec.ts) :
// à refaire si on les touche.
import type { LevelDef, PuitsDef } from './level'

export const CODE_ACCUEIL = 'ACCUEIL'

/** Le puits du centre. Force 2 700 (3 600 avec l'anneau, le concepteur la
 *  voulait un peu plus faible) ; un cœur de 1 000 u, plus large que la plus
 *  lointaine goutte (695 u mesurés) : le halo képlérien, qui étire, n'est
 *  jamais atteint. */
export const PUITS_ACCUEIL: PuitsDef = { x: 0, y: 0, force: 2700, rayon: 1000 }

/** Le frein de la vitrine, en 1/s, sur la vitesse de chaque particule. */
export const FREIN_VITRINE = 0.6

/** Le rayon montré (u) : la caméra cadre ce disque autour du corps. Les
 *  gouttes les plus lancées en sortent un instant, et reviennent. */
export const CADRE_RAYON = 620

export function tableauAccueil(): LevelDef {
  // les bornes du solveur sont des murs : assez loin pour qu'aucune goutte
  // ne les touche (695 u au plus), et sous 2 600 u de large — au-delà,
  // zonesDuHub prête au hub des sas et des comptoirs codés en dur
  const b = { minX: -1250, minY: -1250, maxX: 1250, maxY: 1250 }
  return {
    name: 'Cuve d’essai',
    code: CODE_ACCUEIL,
    journal: '',
    bounds: b,
    spawn: { x: 0, y: 0, n: 900 },
    // pas de sas (ronde.ts, sansSas) : rien ne se dessine, rien n'aspire —
    // la boîte reste hors de portée
    exit: { minX: 1150, minY: -40, maxX: 1210, maxY: 40 },
    boxes: [],
    sponges: [],
    labels: [],
    puits: [PUITS_ACCUEIL],
    // bâti « en structures » sans en poser aucune : pas de fond de cuve, le
    // dehors partout — l'échantillon flotte devant les étoiles
    coque: 'structures',
  }
}

/** Le frein de la vitrine, à appliquer à chaque pas avant le pas lui-même. */
export function freineVitrine(
  s: { count: number; velX: Float32Array | number[]; velY: Float32Array | number[] },
  dt: number,
): void {
  const k = Math.exp(-FREIN_VITRINE * dt)
  for (let i = 0; i < s.count; i++) {
    s.velX[i] *= k
    s.velY[i] *= k
  }
}

/** LE CADRAGE : le disque de CADRE_RAYON, centré dans la place que le menu
 *  laisse libre (à droite du rail ; au téléphone debout, la fenêtre entre le
 *  titre et le verbe). La caméra ne suit pas le corps ici — il revient
 *  toujours au centre — elle montre la vitrine. Rend la position de la
 *  caméra (monde) et son zoom (px CSS par unité). */
export function cadreAccueil(
  vueL: number,
  vueH: number,
  libre: { left: number; top: number; right: number; bottom: number },
): { x: number; y: number; zoom: number } {
  const l = Math.max(80, libre.right - libre.left)
  const h = Math.max(80, libre.bottom - libre.top)
  const zoom = Math.min(l, h) / (2 * CADRE_RAYON)
  const cx = (libre.left + libre.right) / 2
  const cy = (libre.top + libre.bottom) / 2
  // l'écran place (wx, wy) en (vueL/2 + (wx − x)·zoom, vueH/2 − (wy − y)·zoom) :
  // on veut le centre du monde (0, 0) au centre de la place libre
  return { x: (vueL / 2 - cx) / zoom, y: (cy - vueH / 2) / zoom, zoom }
}
