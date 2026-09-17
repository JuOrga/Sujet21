// LA RECHERCHE DES ORBITES — pas un test : un outil, en deux étages. Le
// premier balaye la hauteur du départ, l'angle et la vitesse de l'impulsion,
// trace le point-masse (la même loi que le solveur) et cherche le lancer
// qui ENROULE les trois puits dans l'ordre — au moins un tiers de tour
// autour de chacun, dans son cœur — et le plus court gagne. Le second fait
// REJOUER LES MEILLEURS PAR LE VRAI CORPS, dans la vraie salle (le
// croissant posé en face de l'arrivée), et imprime la part gardée au
// verdict : c'est elle qui tranche — la revue du 17/09 a trouvé un lancer
// parfait au point-masse qui laissait 8 % du corps. Le gagnant se gèle dans
// REGLES_ORBITES (avec l'angle du croissant).
//   RECHERCHE_ORBITES=1 [RECHERCHE_ORBITES_F=300 RECHERCHE_ORBITES_R=450
//   RECHERCHE_ORBITES_VRAIS=64] pnpm vitest run src/game/orbites.recherche.spec.ts
import { describe, expect, it } from 'vitest'
import { avanceOrbites, ETAT_ORBITES_NEUF, REGLES_ORBITES, tableauOrbites, type ReglesOrbites } from './minijeux'
import { PUITS_FORCE_DEFAUT, PUITS_RAYON_DEFAUT } from './level'
import { traceTrajectoire, type PointTrajectoire } from './trajectoire'
import { DEFAULT_PARAMS } from '../sim/params'
import { FluidSim, KIND_PLAYER } from '../sim/solver'

// LA PROFONDEUR DES VIRAGES : mesuré le 17/09 sur le vrai solveur, un virage
// pris à 0,93 R (la lisière du cœur) étire le corps de 73 à 250 u de rayon
// — le halo képlérien tire sur ses bords — et le suivant le déchire : 8 %
// du corps arrivait au croissant. Dans le cœur harmonique (a ∝ r), la marée
// comprime au lieu d'étirer : les virages se prennent à 0,75 R au plus.
const D_MAX = 0.75
const D_MIN = 0.3
// LA CIBLE SE POSE TÔT : mesuré le 17/09, un corps qui s'éloigne lentement
// du troisième cœur s'étire dans son halo (la marée : le dos, plus près,
// est freiné plus que le front) — rms 80 → 150 u en 1,5 s — et arrive en
// traîne sur la lèvre du croissant, qui en coupe 13 %. Le croissant se pose
// donc une demi-seconde après la sortie du cœur, le corps encore rond.
const SORTIE_APRES = 0.5

describe.runIf(process.env.RECHERCHE_ORBITES)('la recherche du lancer des orbites', () => {
  it('balaye départ, angle et vitesse et imprime les cinq meilleurs lancers', () => {
    const r = REGLES_ORBITES
    const bounds = { minX: -1200, minY: -1000, maxX: 1200, maxY: 1000 }
    // la force et le rayon des puits : ceux des règles, ou ceux qu'on essaie
    // (RECHERCHE_ORBITES_F, RECHERCHE_ORBITES_R) — pour choisir la physique
    // qui laisse le corps entier au bout du chemin
    const F = Number(process.env.RECHERCHE_ORBITES_F ?? r.puits[0].force ?? PUITS_FORCE_DEFAUT)
    const R = Number(process.env.RECHERCHE_ORBITES_R ?? r.puits[0].rayon ?? PUITS_RAYON_DEFAUT)
    const puits = r.puits.map((p) => ({ x: p.x, y: p.y, force: F, rayon: R }))
    console.log(`puits : force ${F}, rayon ${R}`)
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
    type Essai = { y0: number; angle: number; vitesse: number; score: number; detail: string; anneaux: PointTrajectoire[]; fin: PointTrajectoire; tFin: number; cap: number }
    const essais: Essai[] = []
    for (let y0 = -600; y0 <= 900; y0 += 50)
      for (let angle = -60; angle <= 40; angle += 2)
        for (let vitesse = 150; vitesse <= 600; vitesse += 10) {
          const a = (angle * Math.PI) / 180
          const tr = traceTrajectoire(
            { x: r.depart.x, y: y0, vx: Math.cos(a) * vitesse, vy: Math.sin(a) * vitesse },
            { bounds, boxes: [], puits, rayonCorps: 100, duree: 16, sous: 2 },
          )
          const pts = tr.points
          let depuis = 0
          let score = 0
          const anneaux: PointTrajectoire[] = []
          const sens: number[] = []
          let detail = ''
          let ok = true
          for (let w = 0; w < 3; w++) {
            const e = enroule(pts, puits[w], depuis)
            // un VRAI virage : au moins un tiers de tour, à bonne distance du
            // centre (traverser le cœur en plein milieu balaie 180° sans tourner)
            if (!e || e.tours < 0.35 || e.dMin < D_MIN * R || e.dMin > D_MAX * R) {
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
          // après le troisième virage : la sortie du CŒUR (d > R), puis
          // SORTIE_APRES — c'est là que la cible se pose ; un rebond de bord
          // avant cela disqualifie
          let kCoeur = anneaux.length > 0 ? pts.findIndex((q, i) => i > 0 && q.t >= anneaux[2].t && Math.hypot(q.x - puits[2].x, q.y - puits[2].y) > R) : -1
          if (kCoeur < 0) kCoeur = depuis
          const tSortie = pts[Math.min(kCoeur, pts.length - 1)].t
          let kFin = kCoeur
          while (kFin < pts.length && pts[kFin].t < tSortie + SORTIE_APRES) kFin++
          const fin = pts[Math.min(kFin, pts.length - 1)]
          if (kFin >= pts.length || tr.evenements.some((ev) => ev.t < fin.t) || Math.abs(fin.x) > 900 || Math.abs(fin.y) > 750) {
            score += 500
            detail += ' sortie:non'
          }
          const avant = pts[Math.max(0, Math.min(kFin, pts.length - 1) - 6)]
          const cap = Math.round((Math.atan2(fin.y - avant.y, fin.x - avant.x) * 180) / Math.PI)
          detail += ` arrivée ${cap}°`
          score += fin.t
          essais.push({ y0, angle, vitesse, score, detail, anneaux, fin, tFin: fin.t, cap })
        }
    essais.sort((a, b) => a.score - b.score)
    console.log(`${essais.length} lancers enroulent les trois puits`)
    const ligne = (e: Essai): string =>
      `y0 ${e.y0} angle ${e.angle}° vitesse ${e.vitesse} → score ${e.score.toFixed(1)} ;${e.detail} ; anneaux ${e.anneaux.map((p) => `(${p.x.toFixed(0)}, ${p.y.toFixed(0)}) t=${p.t.toFixed(1)}`).join(' · ')} ; sortie (${e.fin.x.toFixed(0)}, ${e.fin.y.toFixed(0)}) t=${e.tFin.toFixed(1)}`
    for (const e of essais.slice(0, 8)) console.log(ligne(e))
    // LE SECOND ÉTAGE : le vrai corps rejoue les meilleurs lancers du
    // point-masse DANS LA VRAIE SALLE (tableauOrbites avec ces règles :
    // le croissant posé, la bande en face), comme le jeu la joue — le plan
    // large immobile, le lancer, les puits, relabel tous les cinq pas, la
    // machine des anneaux sur le centre. Ce qu'on mesure : la part gardée à
    // l'instant du verdict (fini), la plus basse en route, les anneaux.
    const N_VRAIS = Number(process.env.RECHERCHE_ORBITES_VRAIS ?? 24)
    type Vrai = { e: Essai; part: number; partMin: number; anneaux: number; fin: string; tFin: number }
    const vrais: Vrai[] = []
    for (const e of essais.slice(0, N_VRAIS)) {
      const regles: ReglesOrbites = {
        ...r,
        puits,
        depart: { x: r.depart.x, y: e.y0, impulsion: { angle: e.angle, vitesse: e.vitesse } },
        anneaux: e.anneaux.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), r: 90 })),
        cible: { x: Math.round(e.fin.x), y: Math.round(e.fin.y), r: r.cible.r },
      }
      const lv = tableauOrbites(regles, e.cap)
      const s = new FluidSim({ ...DEFAULT_PARAMS }, lv.bounds, 4096)
      s.setLevel(lv.boxes, lv.sponges)
      s.spawnDisc(lv.spawn.x, lv.spawn.y, lv.spawn.n, KIND_PLAYER)
      const dt = s.params.dt
      for (let t = 0; t < 2.6; t += dt) s.step(dt) // le plan large de l'entrée
      const a = (e.angle * Math.PI) / 180
      s.lanceCorps(Math.cos(a) * e.vitesse, Math.sin(a) * e.vitesse)
      let etat = ETAT_ORBITES_NEUF
      let partMin = 1
      let k = 0
      let t = 0
      for (; t < regles.dureeMax && !etat.fini; t += dt, k++) {
        s.applyPuits(puits, dt)
        s.step(dt)
        s.updatePlayerStats()
        if (k % 5 === 0) {
          s.relabel()
          partMin = Math.min(partMin, s.playerCount / s.baseVolume)
        }
        etat = avanceOrbites(etat, { t, x: s.stats.centroidX, y: s.stats.centroidY }, regles)
      }
      s.relabel()
      const part = s.playerCount / s.baseVolume
      vrais.push({ e, part, partMin, anneaux: etat.anneauxPasses, fin: String(etat.fin), tFin: t })
    }
    vrais.sort((a, b) => b.part - a.part || a.e.score - b.e.score)
    console.log(`— le vrai corps, dans la vraie salle, sur les ${vrais.length} meilleurs —`)
    for (const v of vrais) console.log(`part ${(v.part * 100).toFixed(0)} % (min ${(v.partMin * 100).toFixed(0)} %) anneaux ${v.anneaux}/3 fin ${v.fin} à ${v.tFin.toFixed(1)} s · ${ligne(v.e)}`)
    expect(essais.length).toBeGreaterThanOrEqual(0)
  }, 1_800_000)
})
