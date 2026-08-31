// L'AUDIT — les contrôles qui ne simulent RIEN. Ils sont instantanés, ils
// n'ont pas d'humeur, et ils ne se trompent jamais dans le sens dangereux :
// quand l'audit dit « le sas est muré », il l'est. C'est la moitié de l'outil
// sur laquelle on peut casser une intégration continue.
//
// Le pilote, lui, répond à « à quel prix ? » — une question de degré, et donc
// une réponse discutable. L'audit répond à « est-ce seulement possible ? ».

import {
  EPONGE,
  SOLIDE,
  celluleDe,
  champDepuisLeSas,
  construitGrille,
  distanceAuSas,
  distanceAuxParois,
  indice,
  largeurDuPassage,
  type Etat,
} from './carte'
import { CAPACITE, horsPerimetre, rayonAuDepart } from './monde'
import { niveauExpanse } from '../../src/game/structures'
import type { LevelDef } from '../../src/game/level'

export type Gravite = 'erreur' | 'alerte' | 'note'

export interface Constat {
  gravite: Gravite
  code: string
  message: string
}

export interface Audit {
  code: string
  nom: string
  constats: Constat[]
  /** Le sas est-il atteignable à l'eau liquide, portes ouvertes ? */
  accessible: boolean
  /** Les états dans lesquels le sas est atteignable, portes ouvertes. */
  etatsQuiPassent: Etat[]
  /** La section du plus large passage qui mène au sas, en unités monde. */
  largeurPassage: number
  /** Diamètre du corps au départ, en unités monde. */
  diametreCorps: number
}

function dedansBornes(
  b: { minX: number; minY: number; maxX: number; maxY: number },
  x: number,
  y: number,
): boolean {
  return x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY
}

export function audite(brut: LevelDef): Audit {
  const level = niveauExpanse(brut)
  const constats: Constat[] = []
  const dit = (gravite: Gravite, code: string, message: string): void => {
    constats.push({ gravite, code, message })
  }

  const grille = construitGrille(level)
  const proximite = distanceAuxParois(grille)
  const champ = champDepuisLeSas(grille, level)
  // Le diamètre du corps est MESURÉ (le solveur sème le disque, on lit son
  // rayon quadratique) : une formule d'aire se trompait d'un facteur deux et
  // faisait passer tous les couloirs pour des goulots.
  const diametreCorps = rayonAuDepart(level) * 2

  // ---- 1. Les points de départ et d'arrivée existent-ils vraiment ? ----
  if (!dedansBornes(level.bounds, level.spawn.x, level.spawn.y)) {
    dit('erreur', 'spawn-hors-bornes', 'le point de départ est hors de la cuve')
  }
  const [sx, sy] = celluleDe(grille, level.spawn.x, level.spawn.y)
  if (grille.cells[indice(grille, sx, sy)] === SOLIDE) {
    dit('erreur', 'spawn-mure', 'le corps naît DANS une paroi')
  }
  const e = level.exit
  if (e.maxX <= e.minX || e.maxY <= e.minY) {
    dit('erreur', 'sas-vide', 'le rectangle du sas est vide ou inversé')
  }
  if (
    !dedansBornes(level.bounds, (e.minX + e.maxX) / 2, (e.minY + e.maxY) / 2)
  ) {
    dit('erreur', 'sas-hors-bornes', 'la bouche du sas est hors de la cuve')
  }
  let sasLibre = 0
  {
    const [x0, y0] = celluleDe(grille, e.minX, e.minY)
    const [x1, y1] = celluleDe(grille, e.maxX, e.maxY)
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (grille.cells[indice(grille, cx, cy)] !== SOLIDE) sasLibre++
      }
    }
    if (sasLibre === 0) {
      dit('erreur', 'sas-mure', 'le sas est entièrement muré')
    }
  }

  // ---- 2. Le chemin existe-t-il ? ----
  const dDepart = distanceAuSas(champ, level.spawn.x, level.spawn.y)
  const accessible = isFinite(dDepart)
  const hors = horsPerimetre(level)

  // Chaque état a ses portes : la grille laisse passer la vapeur, le rideau
  // la glace, la membrane l'eau. Un sas fermé à l'eau n'est donc PAS une
  // panne — c'est peut-être la leçon du tableau. On n'appelle à l'erreur que
  // si AUCUN des trois états ne mène au sas.
  const etatsQuiPassent: Etat[] = []
  for (const etat of ['eau', 'glace', 'vapeur'] as Etat[]) {
    const g = etat === 'eau' ? grille : construitGrille(level, { etat })
    const c = etat === 'eau' ? champ : champDepuisLeSas(g, level)
    if (isFinite(distanceAuSas(c, level.spawn.x, level.spawn.y))) {
      etatsQuiPassent.push(etat)
    }
  }

  if (etatsQuiPassent.length === 0) {
    dit(
      'erreur',
      'sas-inatteignable',
      'aucun chemin ne mène du départ au sas, dans AUCUN état — ' +
        'ni eau, ni glace, ni vapeur (la géométrie seule le dit, ' +
        'portes réputées ouvertes)',
    )
  } else if (!accessible) {
    dit(
      'note',
      'sas-inatteignable-eau',
      `le sas ne s'atteint qu'en ${etatsQuiPassent.join(' ou ')}` +
        (hors ? ` — attendu ici (${hors.raison})` : ''),
    )
  }

  const largeurPassage = accessible
    ? largeurDuPassage(
        grille,
        proximite,
        level,
        level.spawn.x,
        level.spawn.y,
      ) * 2
    : 0

  if (accessible) {
    if (largeurPassage < diametreCorps * 0.5) {
      dit(
        'alerte',
        'goulot-serre',
        `le plus large passage vers le sas fait ${largeurPassage.toFixed(0)} u ` +
          `pour un corps de ${diametreCorps.toFixed(0)} u : la traversée se paie ` +
          'en déformation, et le tableau demande peut-être un autre état',
      )
    }
    // ---- 3. Le chemin passe-t-il forcément par l'éponge ? ----
    const sansEponge = construitGrille(level)
    for (let k = 0; k < sansEponge.cells.length; k++) {
      if (sansEponge.cells[k] === EPONGE) sansEponge.cells[k] = SOLIDE
    }
    const champSec = champDepuisLeSas(sansEponge, level)
    if (
      level.sponges.length > 0 &&
      !isFinite(distanceAuSas(champSec, level.spawn.x, level.spawn.y))
    ) {
      dit(
        'note',
        'eponge-obligatoire',
        "le seul passage traverse l'éponge : la brèche est payée en volume, " +
          'et elle est permanente',
      )
    }
  }

  // ---- 4. Les portes asservies ----
  if ((level.portes ?? []).length > 0) {
    const fermees = construitGrille(level, { portesFermees: true })
    const champFerme = champDepuisLeSas(fermees, level)
    const passeSansLaser = isFinite(
      distanceAuSas(champFerme, level.spawn.x, level.spawn.y),
    )
    dit(
      'note',
      passeSansLaser ? 'portes-contournables' : 'portes-obligatoires',
      passeSansLaser
        ? 'un chemin existe portes FERMÉES : le laser est facultatif ' +
          '(voulu ? un raccourci se conçoit, un oubli se corrige)'
        : 'le laser est obligatoire : portes fermées, le sas est coupé',
    )
  }

  // ---- 5. Les déclarations du tableau ----
  if (level.par === undefined) {
    dit(
      'note',
      'par-absent',
      "aucun budget d'impulsions déclaré : le record n'a pas de référence",
    )
  }
  if (level.spawn.n > CAPACITE * 0.8) {
    dit(
      'alerte',
      'capacite',
      `${level.spawn.n} particules au départ pour une capacité de ${CAPACITE} : ` +
        'les gouttes éjectées et la vapeur risquent de saturer le tampon',
    )
  }
  if (hors && accessible) {
    dit('note', 'hors-perimetre', `le pilote ne joue pas ce tableau : ${hors.raison}`)
  }

  return {
    code: level.code,
    nom: level.name,
    constats,
    accessible,
    etatsQuiPassent,
    largeurPassage,
    diametreCorps,
  }
}
