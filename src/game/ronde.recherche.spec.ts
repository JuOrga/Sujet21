// LA RECHERCHE DE LA RONDE — pas un test : un outil. Le concepteur (17/09,
// croquis) : « un niveau où le volume tourne non stop autour de ces trois
// centres de gravité, en glace » — trois puits alignés, la trajectoire les
// enchaîne en huit à trois lobes (le sens s'inverse à chaque lobe) et se
// referme sur elle-même. Une ORBITE PÉRIODIQUE dans un champ à trois
// centres : on ne la devine pas, on la TIRE. Par symétrie (les puits sur
// x = 0, symétriques en y), une orbite qui coupe y = 0 à angle droit en
// (−a, 0) en montant, puis, après avoir contourné le puits du haut, recoupe
// y = 0 à angle droit en (+b, 0) en descendant, est fermée : la moitié du
// bas est le miroir de la moitié du haut. Deux inconnues (a, v), une
// condition (vx = 0 au recroisement) : une famille à un paramètre, dans
// laquelle on garde celles qui font un vrai lobe autour du puits du haut
// (passent au-dessus de lui) et, surtout, qui sont STABLES — une orbite
// périodique instable ne « tourne pas non stop », elle s'en va en quelques
// tours. La stabilité se mesure : un écart de 1 u au départ, combien vaut-il
// après vingt tours ?
// Le champ est celui que reçoit le BLOC (moyenné sur son disque, voir CORPS)
// et la famille se lit par largeur croissante : le gagnant est le plus large
// qui tient encore, avec une marge. La recherche complète (point, tous les
// réglages) coûte une minute ; avec le disque, dix (91 points par pas) — on
// la resserre autour de la famille trouvée au point.
//   RECHERCHE_RONDE=1 RECHERCHE_RONDE_F=600 RECHERCHE_RONDE_R=350 RECHERCHE_RONDE_D=800 \
//   RECHERCHE_RONDE_CORPS=103 RECHERCHE_RONDE_AMIN=200 RECHERCHE_RONDE_AMAX=340 \
//   RECHERCHE_RONDE_VMIN=380 RECHERCHE_RONDE_VMAX=540 pnpm vitest run src/game/ronde.recherche.spec.ts
// Mesuré le 17/09 (force 300, un point) : cœur 300 / écart 650 tient jusqu'à
// a = 290 mais le lobe du haut est plat (sommet à 164 au-dessus du puits) ;
// cœur 350 / écart 800 tient jusqu'à 320 avec un lobe rond (sommet à 224) ;
// cœur 450 s'étrangle. Avec le disque du corps (103 u), la même famille
// tient jusqu'à a = 210 et se déchire à 220 : le tableau prend a = 200.
import { describe, expect, it } from 'vitest'
import type { PuitsDef } from './level'
import { accelerationPuits, type Accel } from './puits'

const DT = 1 / 120
const F = Number(process.env.RECHERCHE_RONDE_F ?? 300)
// LE CORPS N'EST PAS UN POINT : un bloc de glace reçoit la MOYENNE du champ
// sur son disque (solver.applyPuits), et dans le halo en 1/r² cette moyenne
// n'est pas la valeur au centre — mesuré le 17/09 : lancé sur l'orbite du
// point-masse, le bloc s'en écartait de 40 u/s dès le premier croisement et
// de 300 u après un tour. La recherche tire donc avec le même champ moyenné
// sur un disque du rayon du corps (RECHERCHE_RONDE_CORPS, 0 : un point).
const CORPS = Number(process.env.RECHERCHE_RONDE_CORPS ?? 0)
const ECHANTILLON: { dx: number; dy: number }[] = []
if (CORPS > 0) {
  // un pavage hexagonal du disque, comme les particules du corps
  const pas = CORPS / 5
  for (let j = -6; j <= 6; j++)
    for (let i = -6; i <= 6; i++) {
      const dx = (i + (j & 1 ? 0.5 : 0)) * pas
      const dy = j * pas * Math.sqrt(3) * 0.5
      if (dx * dx + dy * dy <= CORPS * CORPS) ECHANTILLON.push({ dx, dy })
    }
}

type Etat = { x: number; y: number; vx: number; vy: number }

/** Un pas d'Euler semi-implicite, l'intégration du solveur. */
function pas(e: Etat, puits: PuitsDef[], acc: Accel): void {
  acc.ax = 0
  acc.ay = 0
  if (ECHANTILLON.length === 0) accelerationPuits(puits, e.x, e.y, acc)
  else {
    for (const q of ECHANTILLON) accelerationPuits(puits, e.x + q.dx, e.y + q.dy, acc)
    acc.ax /= ECHANTILLON.length
    acc.ay /= ECHANTILLON.length
  }
  e.vx += acc.ax * DT
  e.vy += acc.ay * DT
  e.x += e.vx * DT
  e.y += e.vy * DT
}

/** Depuis (−a, 0) vers le haut à v : le premier recroisement de y = 0 en
 *  descendant, avec x > 0, après être passé au-dessus du puits du haut.
 *  Rend vx et x au croisement (interpolés), le temps, et le y maximal. */
function demiTour(a: number, v: number, puits: PuitsDef[], d: number, tMax: number): { vx: number; x: number; t: number; yMax: number; toursHaut: number; yCroise: number; largeur: number; ok: boolean } {
  const e: Etat = { x: -a, y: 0, vx: 0, vy: v }
  const acc: Accel = { ax: 0, ay: 0 }
  let yMax = 0
  let prev = { ...e }
  // l'angle balayé autour du puits du haut : un lobe en fait un tour
  let balaye = 0
  let angPrec = Math.atan2(e.y - d, e.x)
  let yCroise = NaN // le croisement x = 0 en montant : là où le lobe du haut commence
  let largeur = 0 // la demi-largeur du lobe du haut
  for (let t = 0; t < tMax; t += DT) {
    prev = { ...e }
    pas(e, puits, acc)
    yMax = Math.max(yMax, e.y)
    if (Number.isNaN(yCroise) && prev.x < 0 && e.x >= 0) yCroise = e.y
    if (!Number.isNaN(yCroise)) largeur = Math.max(largeur, Math.abs(e.x))
    const ang = Math.atan2(e.y - d, e.x)
    let da = ang - angPrec
    while (da > Math.PI) da -= 2 * Math.PI
    while (da < -Math.PI) da += 2 * Math.PI
    balaye += da
    angPrec = ang
    if (yMax > d && prev.y > 0 && e.y <= 0 && e.x > 0) {
      const f = prev.y / (prev.y - e.y)
      return { vx: prev.vx + (e.vx - prev.vx) * f, x: prev.x + (e.x - prev.x) * f, t: t + f * DT, yMax, toursHaut: Math.abs(balaye) / (2 * Math.PI), yCroise, largeur, ok: true }
    }
    if (Math.hypot(e.x, e.y) > 6 * d) break // parti
  }
  return { vx: NaN, x: NaN, t: NaN, yMax, toursHaut: 0, yCroise: NaN, largeur: 0, ok: false }
}

/** Suit l'orbite depuis (−a, 0) sur `tours` périodes ; rend l'écart maximal
 *  entre la position et celle du même instant sur la période de référence. */
function derive(a: number, v: number, puits: PuitsDef[], T: number, tours: number, ecart: number): number {
  const ref: Etat = { x: -a, y: 0, vx: 0, vy: v }
  const per: Etat = { x: -a + ecart, y: 0, vx: 0, vy: v }
  const acc: Accel = { ax: 0, ay: 0 }
  let dMax = 0
  const n = Math.round((T * tours) / DT)
  for (let k = 0; k < n; k++) {
    pas(ref, puits, acc)
    pas(per, puits, acc)
    dMax = Math.max(dMax, Math.hypot(ref.x - per.x, ref.y - per.y))
  }
  return dMax
}

describe.runIf(process.env.RECHERCHE_RONDE)('la recherche de la ronde', () => {
  it('tire les orbites fermées à trois lobes et dit lesquelles tiennent', () => {
    const R = Number(process.env.RECHERCHE_RONDE_R ?? 450)
    const d = Number(process.env.RECHERCHE_RONDE_D ?? 650)
    const puits: PuitsDef[] = [
      { x: 0, y: d, force: F, rayon: R },
      { x: 0, y: 0, force: F, rayon: R },
      { x: 0, y: -d, force: F, rayon: R },
    ]
    console.log(`puits : force ${F}, cœur ${R}, écart ${d} ; corps : ${CORPS > 0 ? `disque de ${CORPS} u (${ECHANTILLON.length} points)` : 'un point'}`)
    const A_MIN = Number(process.env.RECHERCHE_RONDE_AMIN ?? 40)
    const A_MAX = Number(process.env.RECHERCHE_RONDE_AMAX ?? 1.6 * R)
    const V_MIN = Number(process.env.RECHERCHE_RONDE_VMIN ?? 60)
    const V_MAX = Number(process.env.RECHERCHE_RONDE_VMAX ?? 900)
    type Cand = { a: number; v: number; T: number; b: number; yMax: number; tours: number; yCroise: number; largeur: number; derive20: number; derive5: number }
    const cands: Cand[] = []
    for (let a = A_MIN; a <= A_MAX; a += 10) {
      // vx au recroisement en fonction de v : on cherche ses zéros
      let vPrec = NaN
      let fPrec = NaN
      for (let v = V_MIN; v <= V_MAX; v += 5) {
        const r = demiTour(a, v, puits, d, 40)
        const f = r.ok ? r.vx : NaN
        if (Number.isFinite(f) && Number.isFinite(fPrec) && Math.sign(f) !== Math.sign(fPrec)) {
          // bissection
          let lo = vPrec
          let hi = v
          let flo = fPrec
          for (let i = 0; i < 30; i++) {
            const mid = (lo + hi) / 2
            const fm = demiTour(a, mid, puits, d, 40).vx
            if (!Number.isFinite(fm)) break
            if (Math.sign(fm) === Math.sign(flo)) {
              lo = mid
              flo = fm
            } else hi = mid
          }
          const vz = (lo + hi) / 2
          const rz = demiTour(a, vz, puits, d, 40)
          if (rz.ok && Math.abs(rz.vx) < 0.5) {
            const T = 2 * rz.t
            cands.push({ a, v: vz, T, b: rz.x, yMax: rz.yMax, tours: rz.toursHaut, yCroise: rz.yCroise, largeur: rz.largeur, derive5: derive(a, vz, puits, T, 5, 1), derive20: derive(a, vz, puits, T, 20, 1) })
          }
        }
        vPrec = v
        fPrec = f
      }
    }
    cands.sort((p, q) => p.derive20 - q.derive20)
    // de VRAIS LOBES (le croquis) : le recroisement loin du centre du puits
    // du milieu (le lobe du milieu a une largeur), le sommet bien au-dessus
    // du puits du haut (le lobe du haut l'entoure)
    // UN SEUL TOUR autour du puits du haut par lobe (le croquis) : entre
    // 0,6 et 1,4 tour balayé — au-delà, l'orbite s'enroule plusieurs fois
    const simples = cands.filter((c) => c.tours > 0.6 && c.tours < 1.4).sort((p, q) => p.a - q.a)
    console.log(`${cands.length} orbites fermées, ${simples.length} à un seul tour par lobe (par largeur a croissante)`)
    for (const c of simples)
      console.log(
        `a ${c.a} v ${c.v.toFixed(3)} → période ${c.T.toFixed(2)} s, recroise en x = ${c.b.toFixed(1)} ; lobe du haut : croisement y = ${c.yCroise.toFixed(0)}, sommet y = ${c.yMax.toFixed(0)}, demi-largeur ${c.largeur.toFixed(0)} (${c.tours.toFixed(2)} tour) ; écart après 5 tours ${c.derive5.toFixed(1)} u, après 20 tours ${c.derive20.toFixed(1)} u`,
      )
    expect(cands.length).toBeGreaterThanOrEqual(0)
  }, 1_800_000)
})
