// LE MONDE DU BOT — un tableau qui tourne sans navigateur, sans rendu et
// sans horloge murale. Le temps n'avance QUE par sim.step(params.dt) : une
// partie du bot est donc rejouable à l'identique, et va aussi vite que la
// machine le permet.
//
// La séquence d'un pas reproduit celle de main.ts (la boucle physique) :
//     éjection éventuelle → aspiration du sas → pas du solveur.
// Tout ce qui n'est pas physique — caméra, audio, HUD, cinématiques,
// cérémonie de bonbonne — n'existe pas ici.
//
// CE QUE LE MONDE NE JOUE PAS, et le dit : les portes asservies au laser
// (aucun faisceau n'est piloté) et les zones qui imposent la glace ou la
// vapeur. Un tableau qui en dépend est déclaré HORS PÉRIMÈTRE plutôt que
// rendu avec un verdict inventé.

import { DEFAULT_PARAMS, type SimParams } from '../../src/sim/params'
import { FluidSim, KIND_FREE, KIND_PLAYER } from '../../src/sim/solver'
import { niveauExpanse } from '../../src/game/structures'
import { zoneForceAt, type LevelDef } from '../../src/game/level'

/** La capacité de main.ts — le bot doit buter sur les mêmes limites. */
export const CAPACITE = 4096

export type Verdict =
  | 'bu' // le sas a tout avalé : le tableau est conclu
  | 'atteint' // le corps principal est avalé — un joueur conclurait ici
  | 'disperse' // le corps a perdu sa cohésion : essai perdu
  | 'bloque' // plus rien ne bouge, et le sas est encore loin
  | 'temps' // le temps imparti est écoulé
  | 'encours'

export interface Monde {
  level: LevelDef
  params: SimParams
  sim: FluidSim
  bouche: { x: number; y: number }
  /** Temps SIMULÉ écoulé, en secondes — jamais du temps réel. */
  temps: number
  pas: number
}

export interface OptionsMonde {
  params?: Partial<SimParams>
}

export function nouveauMonde(brut: LevelDef, o: OptionsMonde = {}): Monde {
  // Les structures de coque se déplient AVANT tout le reste : le solveur ne
  // voit jamais une structure, seulement les parois qu'elle fabrique.
  const level = niveauExpanse(brut)
  const params: SimParams = { ...DEFAULT_PARAMS, ...o.params }
  const sim = new FluidSim(params, level.bounds, CAPACITE)
  // Aucun instrument embarqué : le bot mesure la RUN NUE, la référence de
  // conception. Une run équipée serait forcément plus facile.
  sim.dashBudgetMax = level.dashBudget ?? params.gasDashBudget
  sim.dashBudget = sim.dashBudgetMax
  sim.setLevel(level.boxes, level.sponges)
  sim.spawnDisc(level.spawn.x, level.spawn.y, level.spawn.n, KIND_PLAYER)
  sim.relabel()
  return {
    level,
    params,
    sim,
    bouche: {
      x: (level.exit.minX + level.exit.maxX) * 0.5,
      y: (level.exit.minY + level.exit.maxY) * 0.5,
    },
    temps: 0,
    pas: 0,
  }
}

/** Un pas physique.
 *  `viseur` : le point visé — le corps part à l'OPPOSÉ (§3.3). null : on
 *  laisse courir, et rien ne se dépense.
 *  `rassembler` : le geste du doigt POSÉ SUR SOI — le corps se reforme et
 *  rappelle les gouttes encore à portée. Il ne coûte RIEN et ne freine pas
 *  (l'élan commun est conservé) : c'est de l'eau rendue gratuitement après
 *  un choc. Un bot qui l'ignore arrive au sas deux fois plus maigre. */
export function avance(
  monde: Monde,
  viseur: { x: number; y: number } | null,
  rassembler = false,
): void {
  const { sim, params } = monde
  if (rassembler && !sim.dispersed) sim.rassemble(params.dt)
  else if (viseur && !sim.dispersed) sim.eject(viseur.x, viseur.y, params.dt)
  sim.applyExitSuction(monde.bouche.x, monde.bouche.y, params.dt)
  sim.step(params.dt)
  monde.temps += params.dt
  monde.pas++
}

/** Le seuil d'engloutissement complet de main.ts : sous 2 % du volume de
 *  base (au moins 6 particules), le sas a tout bu. */
export function seuilBu(sim: FluidSim): number {
  return Math.max(6, sim.baseVolume * 0.02)
}

/** Le seuil du bouton CONTINUER : un dixième du volume de départ en
 *  bonbonne. Un joueur conclut le tableau ici — le bot le note donc comme
 *  une réussite, distincte de l'engloutissement total. */
export function seuilAspireAssez(sim: FluidSim): number {
  return Math.max(20, sim.baseVolume * 0.1)
}

export function verdictCourant(monde: Monde): Verdict {
  const { sim } = monde
  if (sim.swallowed > 0 && sim.count <= seuilBu(sim)) return 'bu'
  if (sim.swallowed >= seuilAspireAssez(sim)) return 'atteint'
  if (sim.dispersed) return 'disperse'
  return 'encours'
}

/** Le volume livré, en litres — ce que la mise en bonbonne compterait :
 *  ce qui reste vivant, plus ce que le sas a déjà bu. La prime de glace est
 *  ignorée : le bot ne joue que l'eau. */
export function volumeLivre(monde: Monde): number {
  const { sim, params } = monde
  return sim.liters() + sim.swallowed * params.litersPerParticle
}

/** Les gouttes que `rassemble()` ramènerait à l'instant : libres, hors délai
 *  de réabsorption, ni gelées ni gazeuses, et dans le rayon de capture du
 *  corps. On les recompte au lieu de lire `sim.enPretCount` : ce compteur est
 *  neutralisé dès qu'un sas existe (voir applyExitSuction, qui allume
 *  `drainOn` quelle que soit la distance à la bouche) et vaut donc 0 en
 *  partie réelle. */
export function gouttesRecuperables(monde: Monde): number {
  const { sim, params } = monde
  const cx = sim.stats.centroidX
  const cy = sim.stats.centroidY
  const capture = Math.max(sim.stats.rmsRadius * 2.5, params.kernelRadius * 6)
  const capture2 = capture * capture
  let n = 0
  for (let i = 0; i < sim.count; i++) {
    if (sim.kind[i] !== KIND_FREE || sim.cooldown[i] > 0) continue
    if (sim.frozen[i] === 1 || sim.gaseous[i] === 1) continue
    const dx = cx - sim.posX[i]
    const dy = cy - sim.posY[i]
    if (dx * dx + dy * dy <= capture2) n++
  }
  return n
}

/** Le diamètre du corps au départ, MESURÉ : on sème le disque et on lit le
 *  rayon quadratique que le solveur en calcule. Une formule d'aire se
 *  tromperait — le semis n'est pas un pavage parfait. */
export function rayonAuDepart(level: LevelDef): number {
  return nouveauMonde(level).sim.stats.rmsRadius
}

export interface HorsPerimetre {
  raison: string
}

/** Ce tableau est-il jouable par un bot qui ne connaît QUE l'eau ? La
 *  réponse est une raison lisible, ou null. */
export function horsPerimetre(level: LevelDef): HorsPerimetre | null {
  if ((level.portes ?? []).length > 0) {
    return {
      raison: 'portes asservies au laser — le bot ne pilote pas le faisceau',
    }
  }
  const impose = (level.zones ?? []).filter(
    (z) => z.force === 'glace' || z.force === 'vapeur',
  )
  if (impose.length > 0) {
    return { raison: `zone qui impose ${impose[0].force} — le bot ne joue que l'eau` }
  }
  if ((level.exige ?? []).length > 0) {
    return { raison: `exige ${(level.exige ?? []).join(' et ')}` }
  }
  if (zoneForceAt(level, level.spawn.x, level.spawn.y) !== 'libre') {
    return { raison: 'le corps naît dans une zone à régime imposé' }
  }
  return null
}
