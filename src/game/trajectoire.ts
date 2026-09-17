// LA TRAJECTOIRE PRÉDITE — un point-masse qui suit LA MÊME INTÉGRATION que
// le corps : la loi des puits (game/puits.ts, celle que le solveur applique),
// le même pas (1/120 s), le même ordre (la vitesse d'abord, puis la
// position — l'Euler semi-implicite du solveur : « prd = pos + vel·dt » après
// que les champs ont poussé la vitesse). Pure : ni écran, ni solveur —
// l'éditeur l'appelle depuis le départ du tableau, à chaque réglage (le
// patron de laser.ts : un traceur sans monde). En jeu, elle ne se dessine
// pas (le concepteur, 17/09) : seule la prévision exacte s'y demande.
//
// POURQUOI UN POINT-MASSE PRÉDIT UN FLUIDE. Dans le cœur harmonique d'un
// puits, la force est linéaire en position : la somme sur le corps donne
// exactement la force sur son centre, et les forces internes (pression,
// viscosité XSPH, tension de surface) s'annulent deux à deux. Le centre du
// corps suit donc l'équation du point — mesuré (sim/puits.spec.ts) : ±1 % de
// rayon sur quatre secondes. La ligne dévie aux marées du halo képlérien et
// aux parois : un fluide ne rebondit pas comme une bille (wallSplashDamp
// épouse la paroi), d'où une restitution calibrée sur le vrai solveur
// (trajectoire.spec.ts) et, en jeu, la PRÉVISION EXACTE à la demande.
//
// NON MODÉLISÉ, à dessein : les éponges, les pertes des grilles, les portes
// fermées (l'appelant les ajoute aux boîtes comme le jeu le fait pour les
// lasers), la vapeur (gasDrag la fait spiraler : `frottement` l'approche).
// La ligne est celle du corps LIQUIDE : une membrane le laisse passer (elle
// ne bute que la glace et la vapeur), elle n'est donc pas une paroi ici.
import type { Bounds } from '../sim/solver'
import { MAT_HYDROPHILE, MAT_HYDROPHOBE, MAT_MEMBRANE, sansPhysique, type ObstacleBox, type PuitsDef } from './level'
import { formeContact, type FormeContact } from './formes'
import { accelerationPuits, type Accel } from './puits'

export interface DepartTrajectoire {
  x: number
  y: number
  vx: number
  vy: number
}

export interface MondeTrajectoire {
  bounds: Bounds
  boxes: readonly ObstacleBox[]
  puits: readonly PuitsDef[]
  /** le mobile n'est pas un point : le rayon du corps (stats.rmsRadius en jeu). Défaut 0. */
  rayonCorps?: number
  /** la restitution sur une paroi neutre. Défaut TRAJ_RESTITUTION_MUR (calibrée). */
  restitution?: number
  /** la restitution sur l'hydrophobe. Défaut TRAJ_RESTITUTION_HYDROPHOBE. */
  restitutionHydrophobe?: number
  /** un freinage exponentiel (1/s) : 0 pour l'eau et la glace, gasDrag pour la vapeur. */
  frottement?: number
  /** la durée prédite (s) */
  duree: number
  /** le pas (s). Défaut TRAJ_DT : le pas du solveur. */
  dt?: number
  /** un point tous les `sous` pas. Défaut 4 (30 points par seconde). */
  sous?: number
}

export interface PointTrajectoire {
  x: number
  y: number
  t: number
}

export interface EvenementTrajectoire {
  t: number
  x: number
  y: number
  /** rebond sur une boîte, sur un bord de la cuve, ou collé (hydrophile : le corps s'arrête) */
  type: 'rebond' | 'bord' | 'colle'
  boite?: number
}

export interface PassagePuits {
  puits: number
  t: number
  /** la plus courte distance au centre du puits sur toute la durée */
  distance: number
}

export interface Trajectoire {
  points: PointTrajectoire[]
  evenements: EvenementTrajectoire[]
  passages: PassagePuits[]
  fin: 'duree' | 'colle'
}

/** LE PAS de la prédiction : celui du solveur (params.dt). */
export const TRAJ_DT = 1 / 120
/** LA RESTITUTION D'UNE PAROI NEUTRE vue par le centre du corps. MESURÉ le
 *  17/09 sur le vrai solveur (trajectoire.spec.ts, « la calibration ») : un
 *  corps de 400 ou 900 particules lancé à 250 ou 400 u/s contre un mur neutre
 *  NE REBONDIT PAS — sa vitesse de retour vaut 1 à 2 % de l'aller (la paroi
 *  amortit le rebond normal, wallSplashDamp : l'eau épouse la paroi au lieu
 *  d'éclater), et il y laisse des gouttes. La ligne prédite s'arrête donc
 *  contre un mur neutre, tangentiel gardé. */
export const TRAJ_RESTITUTION_MUR = 0.02
/** L'HYDROPHOBE renvoie : mesuré 0,63 à 400 u/s et 0,80 à 250 u/s sur le
 *  centre d'un corps de 400 (le même test) — 0,7, à ±40 % près. */
export const TRAJ_RESTITUTION_HYDROPHOBE = 0.7
/** Sur l'hydrophile le corps s'accroche : le tangentiel qui reste. */
const TRAJ_GLISSE_HYDROPHILE = 0.3

export function traceTrajectoire(depart: DepartTrajectoire, monde: MondeTrajectoire): Trajectoire {
  const dt = monde.dt ?? TRAJ_DT
  const sous = Math.max(1, Math.round(monde.sous ?? 4))
  const rayon = monde.rayonCorps ?? 0
  const eMur = monde.restitution ?? TRAJ_RESTITUTION_MUR
  const ePhobe = monde.restitutionHydrophobe ?? TRAJ_RESTITUTION_HYDROPHOBE
  const frein = monde.frottement && monde.frottement > 0 ? Math.exp(-monde.frottement * dt) : 1
  const boites = monde.boxes.filter((b) => !sansPhysique(b.material) && b.material !== MAT_MEMBRANE)
  const steps = Math.max(1, Math.round(monde.duree / dt))
  const b = monde.bounds
  let x = depart.x
  let y = depart.y
  let vx = depart.vx
  let vy = depart.vy
  const points: PointTrajectoire[] = [{ x, y, t: 0 }]
  const evenements: EvenementTrajectoire[] = []
  // le départ compte : s'il est déjà la plus courte approche, c'est lui
  const passages: PassagePuits[] = monde.puits.map((p, i) => ({ puits: i, t: 0, distance: Math.hypot(p.x - x, p.y - y) }))
  const acc: Accel = { ax: 0, ay: 0 }
  const contact: FormeContact = { dist: 0, nx: 0, ny: 1 }
  // un contact qui dure (le corps glisse le long d'une paroi) n'est qu'un
  // seul événement : on note les boîtes déjà en contact au pas précédent
  let enContact = new Set<number>()
  // même chose pour les bords : un puits qui plaque le corps contre la cuve
  // le ferait « rebondir » à chaque pas — un seul événement par contact
  let bordContact = false
  let fin: Trajectoire['fin'] = 'duree'
  for (let k = 1; k <= steps; k++) {
    const t = k * dt
    // la vitesse d'abord (les puits), puis la position : l'ordre du solveur
    acc.ax = 0
    acc.ay = 0
    if (accelerationPuits(monde.puits, x, y, acc)) {
      vx += acc.ax * dt
      vy += acc.ay * dt
    }
    vx *= frein
    vy *= frein
    x += vx * dt
    y += vy * dt
    // les parois : le rejet rapide d'abord (la boîte englobante ; une boîte
    // TOURNÉE déborde de la sienne — son cercle englobant, comme le solveur),
    // le contact exact ensuite
    const contactsMaintenant = new Set<number>()
    let colle = false
    for (let i = 0; i < boites.length; i++) {
      const bx = boites[i]
      if (bx.angle) {
        const rc = Math.hypot(bx.maxX - bx.minX, bx.maxY - bx.minY) / 2 + rayon + 2
        if (Math.abs(x - (bx.minX + bx.maxX) / 2) > rc || Math.abs(y - (bx.minY + bx.maxY) / 2) > rc) continue
      } else if (x < bx.minX - rayon - 2 || x > bx.maxX + rayon + 2 || y < bx.minY - rayon - 2 || y > bx.maxY + rayon + 2) continue
      formeContact(x, y, bx, contact)
      if (contact.dist >= rayon) continue
      contactsMaintenant.add(i)
      const nx = contact.nx
      const ny = contact.ny
      // repoussé hors de la paroi, à un rayon d'elle
      const enfonce = rayon - contact.dist
      x += nx * enfonce
      y += ny * enfonce
      const vn = vx * nx + vy * ny
      if (vn >= 0) continue // s'en éloigne déjà
      const nouveau = !enContact.has(i)
      if (bx.material === MAT_HYDROPHILE) {
        // le mouillage retient : le normal meurt, le tangentiel s'essouffle, le corps s'arrête là
        const tx = vx - vn * nx
        const ty = vy - vn * ny
        vx = tx * TRAJ_GLISSE_HYDROPHILE
        vy = ty * TRAJ_GLISSE_HYDROPHILE
        if (nouveau) evenements.push({ t, x, y, type: 'colle', boite: i })
        colle = true
        break
      }
      const e = bx.material === MAT_HYDROPHOBE ? ePhobe : eMur
      vx -= (1 + e) * vn * nx
      vy -= (1 + e) * vn * ny
      if (nouveau) evenements.push({ t, x, y, type: 'rebond', boite: i })
    }
    enContact = contactsMaintenant
    // les bords de la cuve : le même rebond amorti qu'une paroi neutre
    let bord = false
    if (x - rayon < b.minX && vx < 0) {
      x = b.minX + rayon
      vx = -vx * eMur
      bord = true
    } else if (x + rayon > b.maxX && vx > 0) {
      x = b.maxX - rayon
      vx = -vx * eMur
      bord = true
    }
    if (y - rayon < b.minY && vy < 0) {
      y = b.minY + rayon
      vy = -vy * eMur
      bord = true
    } else if (y + rayon > b.maxY && vy > 0) {
      y = b.maxY - rayon
      vy = -vy * eMur
      bord = true
    }
    if (bord && !bordContact) evenements.push({ t, x, y, type: 'bord' })
    bordContact = bord
    // la plus courte approche de chaque puits
    for (let i = 0; i < monde.puits.length; i++) {
      const d = Math.hypot(monde.puits[i].x - x, monde.puits[i].y - y)
      if (d < passages[i].distance) {
        passages[i].distance = d
        passages[i].t = t
      }
    }
    if (k % sous === 0 || k === steps || colle) points.push({ x, y, t })
    if (colle) {
      fin = 'colle'
      break
    }
  }
  return { points, evenements, passages, fin }
}
