// LES DEUX INSTANTS DU PLASMA — la règle, à part du dessin.
//
// L'énigme du palier 3 demande deux gestes : se vaporiser DANS la lumière
// (le faisceau s'ionise et devient un arc), puis amener cet arc au pied
// d'un rail (le champ le happe, et si c'est un conduit, le tube s'ouvre).
// Réussis, ces deux gestes ne se voyaient pas : le rayon changeait de
// teinte, le rail s'allumait, et c'était tout.
//
// Ce module ne dessine RIEN. Il dit seulement QUAND l'un et l'autre
// viennent d'arriver, et fige la géométrie qu'il faudra rejouer — le rayon
// vivant sera reparti ailleurs bien avant la fin du flash. Il est pur :
// mêmes entrées, mêmes sorties, aucune horloge, aucun DOM. C'est ce qui le
// rend vérifiable, là où main.ts ne l'est pas.

export interface Point {
  x: number
  y: number
}

/** L'IONISATION : le faisceau vient d'ENTRER dans la vapeur du corps. */
export interface Ionisation {
  t0: number
  /** le point d'entrée dans le nuage — c'est là que souffle l'anneau */
  entree: Point
  /** la portion IONISÉE du tracé, gelée */
  points: Point[]
}

/** LA CAPTURE : l'arc ionisé vient d'être happé par un rail. */
export interface Capture {
  t0: number
  /** le point de la LIGNE où l'arc a sauté dessus */
  prise: Point
  /** le tracé du rail, gelé */
  ligne: Point[]
  /** les deux instants sont tombés dans la MÊME image */
  cumul: boolean
}

export interface VuePlasma {
  points: { x: number; y: number; plasma?: boolean }[]
  railsSuivis: number[]
}

export interface EvenementsPlasma {
  ionisations: Ionisation[]
  captures: Capture[]
  /** l'état d'ionisation de CHAQUE émetteur, à reporter à l'image suivante */
  ionise: boolean[]
}

/** Ce qui vient d'arriver, entre l'image d'avant et celle-ci.
 *
 *  `ionisePrec` : l'état rendu par l'appel précédent. C'est lui qui fait de
 *  l'ionisation un ÉVÉNEMENT et non un état — un rayon qui reste dans la
 *  vapeur ne doit pas rallumer l'effet soixante fois par seconde.
 *
 *  `dejaEngages` : les rails que le champ tient déjà. Un rail re-signalé
 *  par le traceur à chaque image n'est pas une capture neuve. */
export function evenementsPlasma(
  vues: readonly VuePlasma[],
  rails: readonly { points: Point[] }[],
  dejaEngages: ReadonlySet<number>,
  ionisePrec: readonly boolean[],
  t0: number,
): EvenementsPlasma {
  const ionise: boolean[] = []
  const ionisations: Ionisation[] = []
  for (let e = 0; e < vues.length; e++) {
    const pts = vues[e].points
    const iEntree = pts.findIndex((pt) => pt.plasma === true)
    ionise[e] = iEntree >= 0
    if (iEntree < 0 || ionisePrec[e] === true) continue
    // la traversée ionisée : de l'entrée jusqu'au bout de ce qui l'est.
    let iFin = iEntree
    while (iFin + 1 < pts.length && pts[iFin + 1].plasma === true) iFin++
    // UN SEGMENT, PAS UN POINT. Quand le basculement tombe sur le TOUT
    // DERNIER point du tracé — le rayon qui meurt dans le nuage — la
    // tranche ne contient qu'un point et il n'y a rien à dessiner. On
    // remonte alors d'un point en arrière : le flash couvre le segment par
    // lequel le rayon EST ENTRÉ, ce qui est de toute façon ce qu'on veut
    // montrer.
    let debut = iEntree
    const bout = Math.min(pts.length, iFin + 2)
    if (bout - debut < 2 && debut > 0) debut--
    ionisations.push({
      t0,
      entree: { x: pts[iEntree].x, y: pts[iEntree].y },
      points: pts.slice(debut, bout).map((pt) => ({ x: pt.x, y: pt.y })),
    })
  }

  // LE POINT DE PRISE : celui de la LIGNE le plus proche du tracé qui l'a
  // capturée. C'est là que l'arc a sauté — pas au bout du rail, la capture
  // se fait n'importe où le long (cf. laser.ts).
  const captures: Capture[] = []
  const vus = new Set<number>()
  for (const t of vues) for (const ri of t.railsSuivis) vus.add(ri)
  for (const ri of vus) {
    if (dejaEngages.has(ri)) continue
    const ligne = rails[ri]?.points
    if (!ligne || ligne.length < 2) continue
    let prise = ligne[0]
    let meilleur = Infinity
    for (const t of vues) {
      if (!t.railsSuivis.includes(ri)) continue
      for (const pt of t.points)
        for (const q of ligne) {
          const d = (pt.x - q.x) ** 2 + (pt.y - q.y) ** 2
          if (d < meilleur) {
            meilleur = d
            prise = q
          }
        }
    }
    captures.push({
      t0,
      prise: { x: prise.x, y: prise.y },
      ligne: ligne.map((q) => ({ x: q.x, y: q.y })),
      cumul: ionisations.length > 0,
    })
  }

  // LE CUMUL REMPLACE, IL NE SE SUPERPOSE PAS. Quand le joueur se vaporise
  // pile au pied du tube, les deux instants tombent dans la même image :
  // deux flashs l'un sur l'autre ne feraient qu'une bouillie blanche. Un
  // seul temps fort, plus large et plus long, dit la chose — et c'est le
  // moment où l'énigme se résout d'un seul geste, il mérite d'être à part.
  if (captures.some((c) => c.cumul)) ionisations.length = 0

  return { ionisations, captures, ionise }
}
