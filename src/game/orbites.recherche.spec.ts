// LA RECHERCHE DES ORBITES — pas un test : un outil. Balaye la hauteur du
// départ, l'angle et la vitesse de l'impulsion, trace le point-masse (la
// même loi que le solveur) et cherche le lancer qui ENROULE les trois puits
// dans l'ordre — au moins un demi-tour autour de chacun, à portée de son
// cœur — puis s'en va vers la droite. Le meilleur est le plus court. Imprime
// les cinq meilleurs avec, pour chacun, les points d'anneaux (le point le
// plus éloigné du puits pendant l'enroulement) et la fin du chemin ; le
// gagnant se gèle dans REGLES_ORBITES.
//   RECHERCHE_ORBITES=1 pnpm vitest run src/game/orbites.recherche.spec.ts
import { describe, expect, it } from 'vitest'
import { REGLES_ORBITES } from './minijeux'
import { traceTrajectoire, type PointTrajectoire } from './trajectoire'

describe.runIf(process.env.RECHERCHE_ORBITES)('la recherche du lancer des orbites', () => {
  it('balaye départ, angle et vitesse et imprime les cinq meilleurs lancers', () => {
    const r = REGLES_ORBITES
    const bounds = { minX: -1200, minY: -1000, maxX: 1200, maxY: 1000 }
    const R = 300
    type Enroulement = { debut: number; fin: number; tours: number; anneau: PointTrajectoire; sens: number; dMin: number }
    /** L'enroulement autour du puits `p` à partir de l'indice `depuis` : le
     *  premier passage à portée (1,6 R), l'angle balayé tant qu'on y reste,
     *  le point le plus loin du puits pendant ce temps (l'anneau). */
    const enroule = (pts: PointTrajectoire[], p: { x: number; y: number }, depuis: number): Enroulement | null => {
      let k = depuis
      while (k < pts.length && Math.hypot(pts[k].x - p.x, pts[k].y - p.y) > 1.8 * R) k++
      if (k >= pts.length) return null
      const debut = k
      let balaye = 0
      let prev = Math.atan2(pts[k].y - p.y, pts[k].x - p.x)
      const balayes: number[] = [0]
      let dMin = Infinity
      for (k = debut + 1; k < pts.length; k++) {
        const d = Math.hypot(pts[k].x - p.x, pts[k].y - p.y)
        if (d > 1.8 * R) break
        dMin = Math.min(dMin, d)
        const a = Math.atan2(pts[k].y - p.y, pts[k].x - p.x)
        let da = a - prev
        while (da > Math.PI) da -= 2 * Math.PI
        while (da < -Math.PI) da += 2 * Math.PI
        balaye += da
        balayes.push(balaye)
        prev = a
      }
      // l'anneau : à mi-enroulement (la moitié de l'angle balayé) — au milieu du virage
      let iMi = 0
      for (let i = 0; i < balayes.length; i++) if (Math.abs(balayes[i]) <= Math.abs(balaye) / 2) iMi = i
      return { debut, fin: k, tours: Math.abs(balaye) / (2 * Math.PI), anneau: pts[debut + iMi], sens: Math.sign(balaye), dMin }
    }
    type Essai = { y0: number; angle: number; vitesse: number; score: number; detail: string; anneaux: PointTrajectoire[]; fin: PointTrajectoire; tFin: number }
    const essais: Essai[] = []
    for (let y0 = -600; y0 <= 900; y0 += 50)
      for (let angle = -60; angle <= 40; angle += 2)
        for (let vitesse = 150; vitesse <= 600; vitesse += 10) {
          const a = (angle * Math.PI) / 180
          const tr = traceTrajectoire(
            { x: r.depart.x, y: y0, vx: Math.cos(a) * vitesse, vy: Math.sin(a) * vitesse },
            { bounds, boxes: [], puits: r.puits, rayonCorps: 100, duree: 16, sous: 2 },
          )
          const pts = tr.points
          let depuis = 0
          let score = 0
          const anneaux: PointTrajectoire[] = []
          const sens: number[] = []
          let detail = ''
          let ok = true
          for (let w = 0; w < 3; w++) {
            const e = enroule(pts, r.puits[w], depuis)
            // un VRAI virage : au moins un tiers de tour, à bonne distance du
            // centre (traverser le cœur en plein milieu balaie 180° sans tourner)
            if (!e || e.tours < 0.35 || e.dMin < 0.3 * R || e.dMin > 0.95 * R) {
              ok = false
              score += 1000
              detail += ` p${w + 1}:${e ? `${e.tours.toFixed(2)}@${e.dMin.toFixed(0)}` : 'jamais'}`
              break
            }
            anneaux.push(e.anneau)
            sens.push(e.sens)
            detail += ` p${w + 1}:${e.tours.toFixed(2)}t${e.sens > 0 ? '↺' : '↻'}@${e.dMin.toFixed(0)}`
            depuis = e.fin
          }
          if (!ok) continue
          // le slalom du croquis alterne les sens : un enroulement de même sens que le précédent coûte
          if (sens[0] === sens[1]) score += 3
          if (sens[1] === sens[2]) score += 3
          // après le troisième enroulement : 1,2 s plus loin, c'est là que la
          // cible se pose ; un rebond de bord avant cela disqualifie
          const tSortie = pts[Math.min(depuis, pts.length - 1)].t
          let kFin = depuis
          while (kFin < pts.length && pts[kFin].t < tSortie + 1.2) kFin++
          const fin = pts[Math.min(kFin, pts.length - 1)]
          if (kFin >= pts.length || tr.evenements.some((ev) => ev.t < fin.t) || Math.abs(fin.x) > 900 || Math.abs(fin.y) > 750) {
            score += 500
            detail += ' sortie:non'
          }
          const avant = pts[Math.max(0, Math.min(kFin, pts.length - 1) - 6)]
          detail += ` arrivée ${((Math.atan2(fin.y - avant.y, fin.x - avant.x) * 180) / Math.PI).toFixed(0)}°`
          score += fin.t
          essais.push({ y0, angle, vitesse, score, detail, anneaux, fin, tFin: fin.t })
        }
    essais.sort((a, b) => a.score - b.score)
    console.log(`${essais.length} lancers enroulent les trois puits`)
    for (const e of essais.slice(0, 8)) {
      console.log(
        `y0 ${e.y0} angle ${e.angle}° vitesse ${e.vitesse} → score ${e.score.toFixed(1)} ;${e.detail} ; anneaux ${e.anneaux.map((p) => `(${p.x.toFixed(0)}, ${p.y.toFixed(0)}) t=${p.t.toFixed(1)}`).join(' · ')} ; sortie (${e.fin.x.toFixed(0)}, ${e.fin.y.toFixed(0)}) t=${e.tFin.toFixed(1)}`,
      )
    }
    expect(essais.length).toBeGreaterThanOrEqual(0)
  })
})
