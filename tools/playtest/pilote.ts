// LE PILOTE — le bot qui joue le tableau. Ce n'est pas un réseau entraîné :
// c'est un asservissement de vitesse posé sur le champ de flux de la carte,
// et c'est délibéré. Ce qu'on veut mesurer, c'est le TABLEAU (est-il
// franchissable, à quel prix), pas le talent d'une IA — un pilote lisible et
// reproductible est un bien meilleur instrument qu'un joueur artificiel dont
// on ne saurait jamais si l'échec vient du niveau ou de lui.
//
// La boucle de décision, toutes les ~80 ms de temps simulé :
//   1. lire où le corps est et où il va (sim.stats) ;
//   2. demander au champ de flux la direction qui rapproche du sas ;
//   3. comparer la vitesse voulue à la vitesse réelle ;
//   4. si l'écart dépasse la zone morte, éjecter — sinon LAISSER COURIR.
//
// Le point 4 est la règle d'or du jeu, appliquée telle quelle : se déplacer,
// c'est rétrécir. Un pilote qui pousse en permanence arrive au sas à sec ;
// celui-ci ne paie que ce qu'il faut, et son volume restant devient une
// mesure honnête de la générosité du tableau.

import {
  SOLIDE,
  celluleDe,
  champDepuisLeSas,
  construitGrille,
  directionVersLeSas,
  distanceAuSas,
  distanceAuxParois,
  indice,
  type ChampFlux,
  type Grille,
} from './carte'
import {
  avance,
  gouttesRecuperables,
  nouveauMonde,
  seuilAspireAssez,
  seuilBu,
  verdictCourant,
  volumeLivre,
  type Monde,
  type Verdict,
} from './monde'
import type { LevelDef } from '../../src/game/level'

/** Pas physiques entre deux décisions. Au moins `componentEvery` (5), sinon
 *  le pilote relit des statistiques de corps qui n'ont pas bougé. */
const PAS_PAR_DECISION = 10

/** Repos minimal entre deux manœuvres d'évitement, en secondes. */
const REPOS_MENACE = 0.6

export interface Reglage {
  nom: string
  /** Vitesse de RAPPROCHEMENT du sas visée, en unités monde par seconde —
   *  mesurée sur le champ de flux, donc le long du chemin réel et non à vol
   *  d'oiseau. La physique en fixe le prix : éjecter une particule sur N
   *  donne au corps environ ejectSpeed/N (mesuré : 2 s de tenue sur un corps
   *  de 900 valent ~105 u/s et 13 % du volume). Viser vite, c'est arriver
   *  maigre. */
  vitesseCible: number
  /** On relance une impulsion quand le rapprochement tombe sous cette
   *  fraction de la cible. Tant que le corps gagne du terrain, on ne dépense
   *  RIEN : c'est là que se joue tout le rendement. */
  relance: number
  /** Durée maximale d'une impulsion, en secondes — un appui maintenu. */
  dureeImpulsion: number
  /** Repos imposé après une impulsion : le temps que le corps se reforme et
   *  que les gouttes égarées rentrent (reabsorbCooldown vaut 1,2 s). */
  repos: number
  /** Réserve intouchable : on cesse de pousser sous cette fraction du volume
   *  de départ. Sans elle, le pilote se dissout à mi-chemin et le tableau
   *  passe pour infranchissable alors qu'il ne l'est pas. */
  reserve: number
  /** Distance du point visé derrière le corps. Trop court, le tir laboure
   *  la masse ; trop long, la direction perd en précision près des parois. */
  longueurVisee: number
  /** Rayon de lecture du champ de flux, en cellules. */
  porteeGradient: number
  /** Confort de passage : de combien de RAYONS DE CORPS le chemin cherche à
   *  s'écarter des parois. Une paroi prise à pleine vitesse pulvérise le
   *  corps (mesuré : 720 particules vivantes tombent à 32 en deux secondes),
   *  et le chemin le plus court est presque toujours celui qui rase le mur. */
  confort: number
  /** Anticipation de collision, en secondes : le pilote regarde où il sera
   *  dans ce délai, et manœuvre AVANT de toucher. */
  anticipation: number
}

/** Trois façons de jouer, du prudent au pressé. Un tableau franchi par le
 *  seul réglage « pressé » est un tableau qui exige de la vitesse ; franchi
 *  par « économe », il est généreux. L'écart entre les trois est en soi une
 *  lecture de difficulté. */
export const REGLAGES: Reglage[] = [
  {
    nom: 'économe',
    vitesseCible: 100,
    relance: 0.45,
    dureeImpulsion: 2.4,
    repos: 1.5,
    reserve: 0.3,
    longueurVisee: 300,
    porteeGradient: 5,
    confort: 1.6,
    anticipation: 1.6,
  },
  {
    nom: 'franc',
    vitesseCible: 160,
    relance: 0.5,
    dureeImpulsion: 3,
    repos: 1.2,
    reserve: 0.2,
    longueurVisee: 340,
    porteeGradient: 4,
    confort: 1.4,
    anticipation: 1.3,
  },
  {
    nom: 'pressé',
    vitesseCible: 250,
    relance: 0.6,
    dureeImpulsion: 4,
    repos: 0.9,
    reserve: 0.12,
    longueurVisee: 380,
    porteeGradient: 3,
    confort: 1.1,
    anticipation: 1,
  },
]

export interface Essai {
  reglage: string
  verdict: Verdict
  /** Temps SIMULÉ de l'essai, en secondes. */
  temps: number
  /** Impulsions données — une impulsion = un appui maintenu, comme au
   *  compteur du jeu. C'est l'unité du `par` déclaré par le tableau. */
  impulsions: number
  /** Volume livré au sas, en litres. */
  litres: number
  /** Fraction du volume de départ qui arrive au sas (0..1). */
  rendement: number
  /** Ce que le champ de flux disait au départ, et le plus près qu'on soit
   *  parvenu : de quoi savoir OÙ l'essai a calé. */
  distanceDepart: number
  distanceMin: number
}

/** Une ligne du journal de décision — de quoi comprendre POURQUOI un essai
 *  a calé, sans rejouer la partie à l'aveugle. */
export interface LigneJournal {
  t: number
  x: number
  y: number
  vx: number
  vy: number
  /** Distance au sas le long du chemin, en unités monde. */
  d: number
  /** Vitesse de rapprochement du sas, en unités monde par seconde. */
  rapprochement: number
  vivants: number
  menace: boolean
  pousse: boolean
  rassemble: boolean
}

export interface OptionsJeu {
  /** Temps simulé maximum pour un essai, en secondes. */
  tempsMax?: number
  /** Secondes sans progrès avant d'abandonner. */
  patience?: number
  /** Appelé à chaque décision : le journal de bord de l'essai. */
  journal?: (ligne: LigneJournal) => void
}

interface Etat {
  monde: Monde
  champ: ChampFlux
  champStrict: ChampFlux
  /** Distance aux parois, en cellules — sert au réflexe anti-collision. */
  proximite: Float64Array
}

function proximiteEn(
  g: Grille,
  proximite: Float64Array,
  x: number,
  y: number,
): number {
  const [cx, cy] = celluleDe(g, x, y)
  const k = indice(g, cx, cy)
  return g.cells[k] === SOLIDE ? 0 : proximite[k]
}

/** La trajectoire actuelle mène-t-elle dans une paroi ? On BALAIE le segment
 *  parcouru pendant le délai d'anticipation, et pas seulement son extrémité :
 *  à 200 u/s, une paroi traversée à mi-chemin ne laisse rien voir au point
 *  d'arrivée. Deux conditions, et les deux comptent : quelque part devant, on
 *  est trop près d'un mur, ET plus près qu'à l'instant présent. Sans la
 *  seconde, longer une paroi — ce qui est sain, et fréquent dans une cuve —
 *  déclencherait une manœuvre à chaque décision, et le corps se viderait en
 *  évitements. */
function menaceDevant(
  g: Grille,
  proximite: Float64Array,
  x: number,
  y: number,
  vx: number,
  vy: number,
  delai: number,
  garde: number,
): boolean {
  const ici = proximiteEn(g, proximite, x, y)
  const ECHANTILLONS = 6
  for (let k = 1; k <= ECHANTILLONS; k++) {
    const t = (delai * k) / ECHANTILLONS
    const devant = proximiteEn(g, proximite, x + vx * t, y + vy * t)
    if (devant < garde && devant < ici) return true
  }
  return false
}

/** Les deux champs du pilote, sur UNE seule grille :
 *   · le STRICT, sans aucune marge — c'est lui qui mesure le progrès et qui
 *     dit la vérité sur l'accessibilité ;
 *   · celui du CONFORT, où les abords des parois coûtent cher — c'est lui
 *     que le pilote suit. Renchérir n'est pas interdire : le passage étroit
 *     reste franchissable, il est seulement choisi en dernier.
 *  La proximité aux parois sert en plus au réflexe anti-collision. */
function preparerChamps(
  level: LevelDef,
  rayonCorps: number,
  confort: number,
): Omit<Etat, 'monde'> {
  const grille = construitGrille(level)
  const champStrict = champDepuisLeSas(grille, level)
  const marge = Math.max(1, (rayonCorps * confort) / grille.pas)
  return {
    champStrict,
    champ: champDepuisLeSas(grille, level, { marge, poids: 6 }),
    proximite: distanceAuxParois(grille),
  }
}

/** La direction à suivre depuis (x, y) : le gradient du champ de pilotage,
 *  à défaut celui du champ strict, à défaut le cap direct sur la bouche. */
function capVers(
  etat: Etat,
  x: number,
  y: number,
  portee: number,
): { x: number; y: number } {
  const d =
    directionVersLeSas(etat.champ, x, y, portee) ??
    directionVersLeSas(etat.champStrict, x, y, portee)
  if (d) return d
  const dx = etat.monde.bouche.x - x
  const dy = etat.monde.bouche.y - y
  const len = Math.hypot(dx, dy) || 1
  return { x: dx / len, y: dy / len }
}

export function joue(
  level: LevelDef,
  reglage: Reglage,
  o: OptionsJeu = {},
): Essai {
  const tempsMax = o.tempsMax ?? 120
  const patience = o.patience ?? 16
  const monde = nouveauMonde(level)
  const sim = monde.sim
  // Le rayon du corps AU DÉPART : c'est lui qui règle la marge de confort.
  // Il rétrécit en jouant — tant mieux, la marge reste alors généreuse.
  const rayonCorps = Math.max(24, sim.stats.rmsRadius)
  const etat: Etat = {
    monde,
    ...preparerChamps(monde.level, rayonCorps, reglage.confort),
  }
  const volumeDepart = sim.baseVolume * monde.params.litersPerParticle
  const plancher = sim.baseVolume * reglage.reserve

  const distanceDepart = distanceAuSas(
    etat.champStrict,
    sim.stats.centroidX,
    sim.stats.centroidY,
  )
  let distanceMin = distanceDepart
  let dernierProgres = 0
  let impulsions = 0
  // L'IMPULSION est l'unité du jeu — un appui maintenu, une direction tenue.
  // Le pilote ne poursuit donc PAS le gradient en continu : il choisit un cap
  // au départ du geste, le tient jusqu'au bout, puis se tait le temps que le
  // corps se reforme et rattrape ses gouttes. C'est ce qui sépare un pilote
  // qui arrive plein d'un pilote qui se dissout en chemin.
  let pousseJusqua = -1 // temps simulé de fin de l'impulsion en cours
  let reposJusqua = 0
  let reposMenace = 0
  let pousse = false
  // Manœuvres de dégagement : deux tentatives latérales avant de conclure au
  // blocage. C'est ce que fait un joueur coincé dans un angle — pousser de
  // travers pour se décoller, plutôt que d'insister dans le mur.
  let degagements = 0
  let degagementSens = 1
  let degagementArme = false

  // La vitesse de RAPPROCHEMENT, lissée : la distance au sas relevée à
  // chaque décision, dérivée sur une fenêtre courte. Brut, le signal saute
  // (le centroïde tressaute d'une cellule à l'autre) et le pilote pousserait
  // au moindre hoquet.
  const FENETRE = 8 // décisions ≈ 0,67 s de temps simulé
  const releves: { t: number; d: number }[] = []
  const pasMonde = etat.champStrict.grille.pas

  let verdict: Verdict = 'encours'
  while (monde.temps < tempsMax) {
    const cx = sim.stats.centroidX
    const cy = sim.stats.centroidY
    const vx = sim.stats.velX
    const vy = sim.stats.velY

    const d = distanceAuSas(etat.champStrict, cx, cy) * pasMonde
    releves.push({ t: monde.temps, d })
    if (releves.length > FENETRE) releves.shift()
    const vieux = releves[0]
    const dt = monde.temps - vieux.t
    // Au tout début, aucune fenêtre : on se donne un rapprochement nul, donc
    // une première impulsion — c'est bien ce qu'il faut faire au départ.
    const rapprochement =
      dt > 0.2 && isFinite(vieux.d) && isFinite(d) ? (vieux.d - d) / dt : 0

    // Dans l'emprise du sas, on lâche tout : le courant fait le travail, et
    // pousser à cet endroit ne ferait qu'éparpiller le corps hors de la
    // bouche — de l'eau perdue juste avant la caisse.
    const dBouche = Math.hypot(monde.bouche.x - cx, monde.bouche.y - cy)
    const dansLeSas = dBouche < monde.params.exitRadius * 0.85
    const reserveOk = sim.playerCount > plancher

    // LE RÉFLEXE : où serai-je dans `anticipation` secondes ? Si c'est dans
    // une paroi — ou assez près pour que le corps la touche —, il faut
    // manœuvrer MAINTENANT. C'est la leçon de l'îlot du Berceau : un corps
    // qui percute à 175 u/s ne rebondit pas, il se pulvérise.
    const menace =
      !dansLeSas &&
      menaceDevant(
        etat.champStrict.grille,
        etat.proximite,
        cx,
        cy,
        vx,
        vy,
        reglage.anticipation,
        (rayonCorps * 0.8) / etat.champStrict.grille.pas,
      )

    const cap = capVers(etat, cx, cy, reglage.porteeGradient)
    const utile = vx * cap.x + vy * cap.y // vitesse le long du chemin

    if (dansLeSas || !reserveOk) {
      pousse = false
      pousseJusqua = -1
    } else if (pousse) {
      // Impulsion en cours. On la relâche dès qu'elle a fait son office —
      // tenir au-delà, c'est jeter du volume par la fenêtre.
      if (utile >= reglage.vitesseCible || monde.temps >= pousseJusqua) {
        pousse = false
        reposJusqua = monde.temps + reglage.repos
      }
    } else if (
      monde.temps >= reposJusqua ||
      (menace && monde.temps >= reposMenace)
    ) {
      // LA SEULE QUESTION : est-ce que le corps gagne encore du terrain ?
      // S'il en gagne, il n'y a rien à faire — et ne rien faire est gratuit.
      // C'est l'inverse d'un pilote qui corrige en permanence : ici,
      // l'inertie fait le trajet et l'eau reste dans le corps.
      const assezVite =
        rapprochement >= reglage.vitesseCible * reglage.relance
      if (!assezVite || menace || degagementArme) {
        pousse = true
        pousseJusqua = monde.temps + reglage.dureeImpulsion
        reposMenace = monde.temps + REPOS_MENACE
        impulsions++
      }
    }

    // LE DOIGT BOUGE PENDANT L'APPUI. C'est ce que fait un joueur, et c'est
    // indispensable ici : le chemin tourne (il contourne un îlot, il enfile
    // un couloir), et une direction figée pendant trois secondes emmène le
    // corps droit dans la paroi que le champ voulait éviter. Le geste — un
    // appui, une relâche — reste une impulsion au compteur.
    let viseur: { x: number; y: number } | null = null
    if (pousse) {
      let ux = cap.x
      let uy = cap.y
      if (degagementArme) {
        ux = -cap.y * degagementSens
        uy = cap.x * degagementSens
      }
      // Sous menace, on FREINE : la consigne tombe sous la vitesse actuelle.
      // Une paroi prise de plein fouet coûte l'essentiel du corps ; le prix
      // du freinage, lui, se compte en quelques dizaines de gouttes. Et
      // accélérer dans un virage serré ne ferait qu'élargir la trajectoire
      // vers la paroi qu'on cherche à éviter.
      const vitesse = Math.hypot(vx, vy)
      const consigne = menace
        ? Math.min(reglage.vitesseCible * 0.6, vitesse * 0.5)
        : reglage.vitesseCible
      // Annuler l'écart entre la vitesse voulue et la vitesse réelle : une
      // seule règle pour accélérer ET redresser un cap dévié par un rebond.
      const ex = ux * consigne - vx
      const ey = uy * consigne - vy
      const err = Math.hypot(ex, ey)
      if (err > 1e-3) {
        const L = reglage.longueurVisee / err
        // viser DERRIÈRE : le corps part à l'opposé du point visé
        viseur = { x: cx - ex * L, y: cy - ey * L }
      }
    }
    degagementArme = false

    // LE REGROUPEMENT, geste gratuit : quand des gouttes du corps traînent
    // encore dans le halo (un choc vient d'écarteler la masse, une éjection
    // a laissé des miettes), les rappeler ne coûte rien et ne freine pas —
    // l'élan commun est conservé. C'est la différence entre un bot qui
    // arrive au sas avec la moitié de lui-même et un bot qui arrive à sec.
    const rassembler =
      !viseur &&
      !dansLeSas &&
      gouttesRecuperables(monde) > Math.max(8, sim.playerCount * 0.05)

    o.journal?.({
      t: monde.temps,
      x: cx,
      y: cy,
      vx,
      vy,
      d,
      rapprochement,
      vivants: sim.aliveCount(),
      menace,
      pousse: viseur !== null,
      rassemble: rassembler,
    })

    for (let s = 0; s < PAS_PAR_DECISION; s++) {
      avance(monde, viseur, rassembler)
      const v = verdictCourant(monde)
      if (v !== 'encours') {
        verdict = v
        break
      }
    }
    if (verdict !== 'encours') break

    const apres = distanceAuSas(
      etat.champStrict,
      sim.stats.centroidX,
      sim.stats.centroidY,
    )
    if (isFinite(apres) && apres < distanceMin - 1e-9) {
      distanceMin = apres
      dernierProgres = monde.temps
    } else if (monde.temps - dernierProgres > patience) {
      if (degagements >= 2) {
        verdict = 'bloque'
        break
      }
      degagements++
      degagementSens = -degagementSens
      degagementArme = true
      reposJusqua = 0 // le dégagement ne s'attend pas
      dernierProgres = monde.temps
    }
  }
  if (verdict === 'encours') verdict = 'temps'

  const litres = volumeLivre(monde)
  return {
    reglage: reglage.nom,
    verdict,
    temps: monde.temps,
    impulsions,
    litres,
    rendement: volumeDepart > 0 ? litres / volumeDepart : 0,
    distanceDepart,
    distanceMin,
  }
}

/** Le verdict est-il une réussite ? « atteint » compte : c'est le moment où
 *  le bouton CONTINUER s'offre au joueur, et où il conclut en général. */
export function reussi(v: Verdict): boolean {
  return v === 'bu' || v === 'atteint'
}

/** Le meilleur essai d'une série : une réussite l'emporte toujours sur un
 *  échec ; entre deux réussites, le plus de volume livré ; entre deux
 *  échecs, celui qui s'est approché le plus près du sas — c'est lui qui
 *  renseigne sur l'endroit où le tableau résiste. */
export function meilleur(essais: Essai[]): Essai {
  return essais.reduce((a, b) => {
    const ra = reussi(a.verdict)
    const rb = reussi(b.verdict)
    if (ra !== rb) return ra ? a : b
    if (ra) return b.litres > a.litres ? b : a
    return b.distanceMin < a.distanceMin ? b : a
  })
}

export { seuilBu, seuilAspireAssez }
