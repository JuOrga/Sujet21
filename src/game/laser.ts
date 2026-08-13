// Le traceur de faisceau laser (palier 1) — partagé entre le jeu et
// l'éditeur : la MÊME marche de rayon sert la mécanique, le rendu et
// l'aperçu de conception. Règles optiques :
//   · les parois pleines ABSORBENT (mur, hydrophile, hydrophobe, froid,
//     chaud) — le faisceau s'arrête, il ne rebondit pas sur la tôle ;
//   · la grille et le sas laissent passer (de la lumière entre des mailles) ;
//   · une PORTE FERMÉE absorbe ; ouverte, elle n'existe pas ;
//   · la GLACE RÉFLÉCHIT : le corps gelé est un miroir — c'est le cœur du
//     scénario. La normale locale vient du champ de particules (callback,
//     fourni par la simulation ; l'éditeur n'en a pas et trace tout droit) ;
//   · une CIBLE touchée s'allume et absorbe le faisceau ;
//   · l'EAU RÉFRACTE (palier 2) : le corps liquide est un prisme vivant.
//     À chaque traversée de surface, Snell-Descartes plie le rayon
//     (indice ≈ 1,33) ; en ressortant trop à plat (au-delà de l'angle
//     critique, ≈ 49° de la normale), c'est la RÉFLEXION TOTALE INTERNE :
//     le faisceau reste prisonnier de l'eau et ricoche sous sa surface.
//     Traverser est GRATUIT : la lumière plie le corps, elle ne le boit
//     pas — servir de prisme ne coûte rien ;
//   · la VAPEUR IONISE (palier 3) : le faisceau qui traverse le nuage
//     devient un arc de PLASMA — et le plasma, extrêmement soumis aux
//     champs magnétiques, est CAPTURÉ par les rails posés dans le décor :
//     s'il passe près de la ligne (N'IMPORTE OÙ le long du rail) en étant
//     ionisé, l'arc s'y accroche et la suit DANS LE SENS DU TRACÉ — du
//     premier point vers le dernier (virages, serpentins) — puis repart
//     tout droit au bout. Le faisceau ordinaire ignore les rails. Le
//     plasma se PROVOQUE — être vapeur dans la lumière au bon endroit —
//     il ne se choisit pas : ce n'est pas un quatrième état.

import { MAT_EXIT, MAT_GRILLE, type LaserDef, type ObstacleBox } from './level'
import type { Bounds } from '../sim/solver'

export const LASER_STEP = 5 // u par pas de marche — sous le rayon de glace
export const LASER_MAX_BOUNCES = 8
export const LASER_MAX_LENGTH = 9000 // u de course totale : personne ne verra plus loin
// Les dioptres (entrées/sorties d'eau, réflexions totales internes) ont leur
// propre plafond, plus généreux que les rebonds de miroir : un nuage de
// gouttes sur le trajet en crée facilement une dizaine.
export const LASER_MAX_REFRACT = 32
export const LASER_INDICE_EAU = 1.33
// Rayon de capture par défaut autour de la LIGNE du rail (tout du long),
// et plafond de rails suivis par un même faisceau (contre les boucles).
export const LASER_RAIL_RADIUS = 30
export const LASER_MAX_RAILS = 6

export interface CiblePoint {
  x: number
  y: number
  r: number
}

export interface Rect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface TraceMonde {
  bounds: Bounds
  boxes: ObstacleBox[]
  portesFermees: Rect[]
  cibles: CiblePoint[]
  /** Normale de la surface de glace en (x, y), ou null si pas de glace là.
   * L'éditeur passe null pour l'ensemble : il trace sans miroir. */
  iceNormal: ((x: number, y: number) => { nx: number; ny: number } | null) | null
  /** Le milieu liquide, pour la réfraction (palier 2) — ou null (éditeur :
   * pas de corps, le faisceau file droit dans l'air). `dedans` est le test
   * de milieu, appelé à CHAQUE pas (il doit rester bon marché) ; `normale`
   * n'est appelée qu'au franchissement d'un dioptre. */
  eau: {
    dedans(x: number, y: number): boolean
    normale(x: number, y: number): { nx: number; ny: number }
  } | null
  /** Indice de réfraction de l'eau (défaut LASER_INDICE_EAU ≈ 1,33).
   * À 1 : l'eau redevient optiquement transparente, comme au palier 1. */
  indice?: number
  /** La vapeur ionisante (palier 3), ou null (éditeur : pas de nuage, le
   * faisceau ne s'ionise jamais et les rails restent muets). Appelée à
   * chaque pas — elle doit rester bon marché. */
  vapeur: ((x: number, y: number) => boolean) | null
  /** Les rails magnétiques du tableau (polylignes, ≥ 2 points chacune —
   * l'ORDRE des points est le sens de circulation de l'arc). */
  rails: { points: { x: number; y: number }[] }[]
  /** Rayon de capture autour de la ligne du rail (défaut LASER_RAIL_RADIUS). */
  railRadius?: number
}

export interface TraceResultat {
  /** Polyligne du faisceau : émetteur, dioptres, rebonds, nœuds de rail,
   * point d'arrêt. `eau` marque les points d'où le segment SUIVANT court
   * sous l'eau (halo élargi et rosé) ; `plasma` ceux d'où il court ionisé
   * — dans la vapeur ou guidé le long d'un rail (arc blanc-violet). */
  points: { x: number; y: number; eau?: boolean; plasma?: boolean }[]
  /** Indices des cibles allumées par CE faisceau. */
  touchees: number[]
  /** Indices des rails PARCOURUS par l'arc — le champ y est actif : la
   * simulation y convoie la vapeur le long de la ligne. */
  railsSuivis: number[]
}

function dansRect(x: number, y: number, r: Rect & { angle?: number }): boolean {
  if (r.angle) {
    const cx = (r.minX + r.maxX) / 2
    const cy = (r.minY + r.maxY) / 2
    const rad = (r.angle * Math.PI) / 180
    const ca = Math.cos(rad)
    const sa = Math.sin(rad)
    const rx = x - cx
    const ry = y - cy
    const lx = cx + rx * ca + ry * sa
    const ly = cy - rx * sa + ry * ca
    return lx >= r.minX && lx <= r.maxX && ly >= r.minY && ly <= r.maxY
  }
  return dansRectAxe(x, y, r)
}

function dansRectAxe(x: number, y: number, r: Rect): boolean {
  return x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY
}

/** Une boîte absorbe-t-elle la lumière ? Grille et sas laissent passer. */
function absorbe(b: ObstacleBox): boolean {
  return b.material !== MAT_GRILLE && b.material !== MAT_EXIT
}

export function traceLaser(em: LaserDef, monde: TraceMonde): TraceResultat {
  const indice = monde.indice ?? LASER_INDICE_EAU
  const refracte = monde.eau !== null && indice > 1.001
  let dansEau = refracte && monde.eau!.dedans(em.x, em.y)
  const points: TraceResultat['points'] = [{ x: em.x, y: em.y, eau: dansEau }]
  const touchees: number[] = []
  const railsSuivis: number[] = []
  const a = (em.angle * Math.PI) / 180
  let dx = Math.cos(a)
  let dy = Math.sin(a)
  let x = em.x
  let y = em.y
  let bounces = 0
  let dioptres = 0
  let course = 0
  // ---- plasma (palier 3) ----
  const rr = monde.railRadius ?? LASER_RAIL_RADIUS
  let dansVapeur = monde.vapeur !== null && monde.vapeur(em.x, em.y)
  if (dansVapeur) points[0].plasma = true
  let railsPris = 0
  let capSursis = 0 // distance à parcourir avant de pouvoir reprendre un rail

  // Marche GUIDÉE le long d'un rail capturé : l'arc suit la polyligne nœud
  // par nœud, mais reste de la lumière — cibles, parois et portes fermées
  // l'arrêtent en chemin. Renvoie true si le faisceau s'est éteint.
  const suivreRail = (ordre: { x: number; y: number }[]): boolean => {
    for (const noeud of ordre) {
      let restant = Math.hypot(noeud.x - x, noeud.y - y)
      if (restant < 1e-6) continue
      const ux = (noeud.x - x) / restant
      const uy = (noeud.y - y) / restant
      dx = ux
      dy = uy
      while (restant > 0) {
        if (course >= LASER_MAX_LENGTH) {
          points.push({ x, y, plasma: true })
          return true
        }
        const pas = Math.min(LASER_STEP, restant)
        x += ux * pas
        y += uy * pas
        course += pas
        restant -= pas
        for (let c = 0; c < monde.cibles.length; c++) {
          const t = monde.cibles[c]
          const ddx = x - t.x
          const ddy = y - t.y
          if (ddx * ddx + ddy * ddy <= t.r * t.r) {
            points.push({ x: t.x, y: t.y })
            touchees.push(c)
            return true
          }
        }
        for (const b of monde.boxes) {
          if (absorbe(b) && dansRect(x, y, b)) {
            points.push({ x, y })
            return true
          }
        }
        for (const p of monde.portesFermees) {
          if (dansRect(x, y, p)) {
            points.push({ x, y })
            return true
          }
        }
      }
      points.push({ x: noeud.x, y: noeud.y, plasma: true })
    }
    return false
  }

  while (course < LASER_MAX_LENGTH) {
    const px = x
    const py = y
    x += dx * LASER_STEP
    y += dy * LASER_STEP
    course += LASER_STEP

    // hors de la cuve : le faisceau se perd dans la coque
    if (x < monde.bounds.minX || x > monde.bounds.maxX || y < monde.bounds.minY || y > monde.bounds.maxY) {
      points.push({ x, y })
      return { points, touchees, railsSuivis }
    }

    // une cible : elle s'allume et boit le faisceau
    for (let c = 0; c < monde.cibles.length; c++) {
      const t = monde.cibles[c]
      const ddx = x - t.x
      const ddy = y - t.y
      if (ddx * ddx + ddy * ddy <= t.r * t.r) {
        points.push({ x: t.x, y: t.y })
        touchees.push(c)
        return { points, touchees, railsSuivis }
      }
    }

    // une paroi pleine ou une porte fermée : absorbé
    let stoppe = false
    for (const b of monde.boxes) {
      if (absorbe(b) && dansRect(x, y, b)) {
        stoppe = true
        break
      }
    }
    if (!stoppe) {
      for (const p of monde.portesFermees) {
        if (dansRect(x, y, p)) {
          stoppe = true
          break
        }
      }
    }
    if (stoppe) {
      points.push({ x, y })
      return { points, touchees, railsSuivis }
    }

    // la glace : miroir. On réfléchit sur la normale locale, puis on ressort
    // du champ de la surface pour ne pas se re-cogner au pas suivant.
    const n = monde.iceNormal ? monde.iceNormal(x, y) : null
    if (n) {
      if (bounces >= LASER_MAX_BOUNCES) {
        points.push({ x, y })
        return { points, touchees, railsSuivis }
      }
      bounces++
      points.push({ x, y })
      const d = dx * n.nx + dy * n.ny
      dx -= 2 * d * n.nx
      dy -= 2 * d * n.ny
      const inv = 1 / Math.max(1e-6, Math.hypot(dx, dy))
      dx *= inv
      dy *= inv
      // dégagement : on recule le long de la normale jusqu'à quitter la glace
      let garde = 0
      while (garde++ < 8 && monde.iceNormal && monde.iceNormal(x, y)) {
        x += n.nx * LASER_STEP
        y += n.ny * LASER_STEP
        course += LASER_STEP
      }
      // le dégagement a pu nous déposer dans l'eau ou la vapeur (la glace
      // baigne dans le corps) : on resynchronise SANS déclencher de dioptre
      if (refracte) dansEau = monde.eau!.dedans(x, y)
      if (monde.vapeur) dansVapeur = monde.vapeur(x, y)
      points[points.length - 1].eau = dansEau
      points[points.length - 1].plasma = dansVapeur
      continue
    }

    // l'eau : dioptre. Changer de milieu plie le rayon (Snell-Descartes) ;
    // sortir trop à plat le RÉFLÉCHIT sous la surface (réflexion totale).
    if (refracte) {
      const la = monde.eau!.dedans(x, y)
      if (la !== dansEau) {
        if (dioptres >= LASER_MAX_REFRACT) {
          points.push({ x, y })
          return { points, touchees, railsSuivis } // trop de gouttes : le faisceau se diffuse
        }
        dioptres++
        const n = monde.eau!.normale(x, y)
        // la normale doit faire FACE au rayon incident
        let nx = n.nx
        let ny = n.ny
        let cosi = -(dx * nx + dy * ny)
        if (cosi < 0) {
          nx = -nx
          ny = -ny
          cosi = -cosi
        }
        const eta = dansEau ? indice : 1 / indice // n1/n2 du milieu quitté vers l'autre
        const k = 1 - eta * eta * (1 - cosi * cosi)
        if (k < 0) {
          // réflexion totale interne : le rayon reste dans son milieu.
          // On revient au point d'AVANT le franchissement pour repartir
          // du bon côté de la surface.
          points.push({ x: px, y: py, eau: dansEau })
          const d = dx * nx + dy * ny
          dx -= 2 * d * nx
          dy -= 2 * d * ny
          x = px
          y = py
        } else {
          points.push({ x, y, eau: la })
          const t = eta * cosi - Math.sqrt(k)
          dx = eta * dx + t * nx
          dy = eta * dy + t * ny
          dansEau = la
        }
        const inv = 1 / Math.max(1e-6, Math.hypot(dx, dy))
        dx *= inv
        dy *= inv
      }
    }

    // le plasma : dans la vapeur, le faisceau s'ionise (l'arc se voit) —
    // et l'arc ionisé qui passe près d'une extrémité de rail est CAPTURÉ
    // par le champ : il suit la ligne jusqu'à l'autre bout, puis repart
    // tout droit, désionisé (sauf à ressortir dans un nuage).
    if (capSursis > 0) capSursis -= LASER_STEP
    if (monde.vapeur) {
      const ion = monde.vapeur(x, y)
      if (ion !== dansVapeur) {
        dansVapeur = ion
        points.push({ x, y, eau: dansEau, plasma: dansVapeur })
      }
      if (dansVapeur && capSursis <= 0 && railsPris < LASER_MAX_RAILS) {
        for (let ri = 0; ri < monde.rails.length; ri++) {
          const pts = monde.rails[ri].points
          if (pts.length < 2) continue
          // le point de la LIGNE le plus proche du faisceau : la capture se
          // fait n'importe où le long du rail, pas seulement aux bouts
          let best = Infinity
          let bx = 0
          let by = 0
          let bseg = -1
          for (let s = 0; s + 1 < pts.length; s++) {
            const a = pts[s]
            const b = pts[s + 1]
            const abx = b.x - a.x
            const aby = b.y - a.y
            const len2 = abx * abx + aby * aby
            const t =
              len2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / len2))
            const qx = a.x + abx * t
            const qy = a.y + aby * t
            const d = Math.hypot(x - qx, y - qy)
            if (d < best) {
              best = d
              bx = qx
              by = qy
              bseg = s
            }
          }
          if (best > rr) continue
          railsPris++
          if (!railsSuivis.includes(ri)) railsSuivis.push(ri)
          points.push({ x, y, plasma: true })
          // l'arc rejoint la ligne au point de capture, puis la suit dans
          // le SENS DU TRACÉ — du point de capture vers le dernier point
          const ordre = [{ x: bx, y: by }, ...pts.slice(bseg + 1)]
          if (suivreRail(ordre)) return { points, touchees, railsSuivis }
          // sorti au bout du rail : on repart tout droit, dans le milieu
          // qu'on y trouve — et un court sursis évite de reprendre le
          // même rail par son extrémité de sortie.
          capSursis = rr + LASER_STEP * 2
          if (refracte) dansEau = monde.eau!.dedans(x, y)
          dansVapeur = monde.vapeur(x, y)
          const dernier = points[points.length - 1]
          dernier.eau = dansEau
          dernier.plasma = dansVapeur
          break
        }
      }
    }
  }
  points.push({ x, y })
  return { points, touchees, railsSuivis }
}

// ---- Les récepteurs (TOR / NOR) : la mémoire des cibles, pure et testable ----
// Deux familles, chacune à transition UNIQUE :
//   · TOR : un passage du faisceau allume POUR DE BON — la porte asservie
//     s'ouvre et le reste (l'activation est acquise jusqu'au Recommencer) ;
//   · NOR : active TANT QUE le faisceau la tient — à la PREMIÈRE coupure,
//     la pastille grille : scellée, la porte se referme définitivement.
// La persistance absorbe le tremblement d'une image (miroir de glace qui
// frémit, porte qui s'ouvre et déplace le trajet à l'image suivante) : une
// micro-coupure sous ce délai ne scelle pas.
export const CIBLE_PERSISTANCE = 0.12 // s

export interface EtatRecepteurs {
  vues: boolean[] // touchée au moins une fois depuis le début (TOR : verrou)
  dernierPhoton: number[] // date du dernier photon reçu, en secondes
  scellees: boolean[] // NOR : la coupure est passée par là — plus rien ne bouge
}

export function creerEtatRecepteurs(n: number): EtatRecepteurs {
  return {
    vues: Array.from({ length: n }, () => false),
    dernierPhoton: Array.from({ length: n }, () => -Infinity),
    scellees: Array.from({ length: n }, () => false),
  }
}

/** Avancé une fois par image, APRÈS le traçage : consigne les photons reçus
 * puis scelle les NOR dont le faisceau vient de se couper. */
export function avancerRecepteurs(
  cibles: { mode?: 'tor' | 'nor' }[],
  touchees: number[],
  etat: EtatRecepteurs,
  now: number,
): void {
  for (const c of touchees) {
    if (c < 0 || c >= cibles.length) continue
    etat.vues[c] = true
    etat.dernierPhoton[c] = now
  }
  for (let c = 0; c < cibles.length; c++) {
    if ((cibles[c].mode ?? 'tor') !== 'nor') continue
    if (etat.vues[c] && !etat.scellees[c] && now - etat.dernierPhoton[c] > CIBLE_PERSISTANCE) {
      etat.scellees[c] = true
    }
  }
}

/** Une cible alimente-t-elle ses portes en cet instant ?
 * TOR : oui dès qu'elle a été vue. NOR : oui sous le faisceau (persistance
 * comprise), plus jamais une fois scellée. */
export function cibleActive(
  cible: { mode?: 'tor' | 'nor' },
  etat: EtatRecepteurs,
  c: number,
  now: number,
): boolean {
  if ((cible.mode ?? 'tor') === 'nor') {
    return etat.vues[c] && !etat.scellees[c] && now - etat.dernierPhoton[c] <= CIBLE_PERSISTANCE
  }
  return etat.vues[c] === true
}
