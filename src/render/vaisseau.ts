// LE VAISSEAU AUTOUR DE LA SALLE — en perspective à UN point de fuite.
//
// La salle qu'on joue est le plan avant (z = 0), vue de dessus comme
// toujours. Tout le reste s'étage DERRIÈRE elle, en profondeur, et converge
// vers un point de fuite posé au centre, au-dessus de la salle (le croquis
// du concepteur, 01/10) :
//
//   1. LA ZONE INTERMÉDIAIRE — le pont du module qui entoure la salle, entre
//      elle et le vide : habillée selon le BIOME du module, percée de portes ;
//   2. LES SALLES DU MODULE — la mini-carte (voiesModule.ts) mise en 3D : les
//      trois VOIES donnent la position gauche–centre–droite, les RANGS la
//      profondeur. Les salles qu'on peut joindre ont leurs feux allumés, et un
//      couloir part vers elles de la zone ; celles que les choix ont fermées
//      s'éteignent ; les salles jouées sont « derrière la caméra » — on ne les
//      voit plus ;
//   3. LES AUTRES MODULES DE LA STATION — la grande carte : de grands volumes
//      voilés par la distance, d'autant plus loin qu'ils sont loin sur la carte.
//
// LA PROFONDEUR DIT OÙ L'ON VA : le point de fuite est le bout de la route.
//
// LA PROJECTION. Un point (x, y, z) — (x, y) dans le plan avant, en unités
// monde, z sans dimension — se voit au point du monde
//     P' = F + (P − F) / (1 + z)
// où F est le point de fuite, FIXÉ DANS LE MONDE au-dessus de la salle. Une
// arête qui s'enfonce reste donc une droite qui file exactement vers F, au
// déplacement comme au recul de la caméra : la projection est faite AVANT la
// caméra, et la caméra n'est qu'une échelle et un décalage (le shader). Ce
// fichier en est la seule implémentation côté CPU, et les tests la tiennent.

export interface Rect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Ce que la mini-carte dit du module, réduit à ce que le décor montre. */
export interface VueMiniCarte {
  rangs: number
  voies: number
  /** la salle où l'on joue */
  rang: number
  voie: number
  /** pour chaque nœud ("r:v"), joignable depuis la salle courante ? */
  joignables: ReadonlySet<string>
}

/** Un autre module de la station, vu d'ici. */
export interface ModuleLointain {
  biome: string
  /** combien de modules le séparent de celui-ci, au plus court (≥ 1) */
  distance: number
  /** son côté sur la carte : −1 à gauche … +1 à droite */
  cote: number
}

export interface SceneVaisseau {
  /** la salle en cours, dans le monde (y vers le HAUT) */
  salle: Rect
  biome: string
  carte: VueMiniCarte | null
  modules: readonly ModuleLointain[]
}

/** Une boîte : sa face avant (dans le plan avant), sa profondeur. */
export interface Boite {
  rect: Rect
  z0: number
  dz: number
  /** ce que c'est — décide du matériau et de la lumière */
  sorte: 'zone' | 'salle' | 'couloir' | 'module'
  /** teinte du biome (multiplie la tôle) */
  teinte: [number, number, number]
  /** 0 éteinte · 1 en veille · 2 joignable (feux allumés) */
  etat: number
}

export const ZONE_MARGE = 0.55 // la zone déborde de la salle de 55 % de sa petite dimension
export const ECART_VOIES = 1.45 // d'une voie à l'autre, en largeurs de salle
export const PAS_RANG = 0.42 // la profondeur d'un rang à l'autre
export const MONTEE_RANG = 0.55 // et sa montée, en hauteurs de salle : un rang se lit AU-DESSUS du précédent

const TEINTES: Record<string, [number, number, number]> = {
  cryo: [0.78, 0.9, 1.05],
  tempere: [0.8, 0.98, 0.82],
  chaud: [1.05, 0.84, 0.66],
}
export function teinteBiome(biome: string): [number, number, number] {
  return TEINTES[biome] ?? [0.88, 0.9, 0.95]
}

/** Le point de fuite : au centre de la salle, au-dessus de sa zone. */
export function pointDeFuite(salle: Rect): { x: number; y: number } {
  const w = salle.maxX - salle.minX
  const h = salle.maxY - salle.minY
  const m = ZONE_MARGE * Math.min(w, h)
  return { x: (salle.minX + salle.maxX) / 2, y: salle.maxY + m + 1.8 * h }
}

/** LA PROJECTION — le jumeau exact du vertex shader (renderer.ts, VAISSEAU_VS). */
export function projette(f: { x: number; y: number }, x: number, y: number, z: number): [number, number] {
  const s = 1 / (1 + Math.max(z, 0))
  return [f.x + (x - f.x) * s, f.y + (y - f.y) * s]
}

/** COMPOSER le vaisseau autour d'une salle. */
export function composeVaisseau(sc: SceneVaisseau): Boite[] {
  const { salle } = sc
  const w = salle.maxX - salle.minX
  const h = salle.maxY - salle.minY
  const cx = (salle.minX + salle.maxX) / 2
  const m = ZONE_MARGE * Math.min(w, h)
  const teinte = teinteBiome(sc.biome)
  const boites: Boite[] = []
  // 1. la zone intermédiaire : un pont épais autour de la salle
  const zone: Rect = { minX: salle.minX - m, minY: salle.minY - m, maxX: salle.maxX + m, maxY: salle.maxY + m }
  boites.push({ rect: zone, z0: 0.004, dz: 0.09, sorte: 'zone', teinte, etat: 1 })
  // 2. les salles du module, rang par rang, voie par voie
  const rangs = sc.carte?.rangs ?? 6
  const voies = sc.carte?.voies ?? 3
  const rang = sc.carte?.rang ?? 0
  const voie = sc.carte?.voie ?? Math.floor(voies / 2)
  const sw = w * 0.82
  const sh = h * 0.82
  const zoneTop = zone.maxY
  for (let r = rang + 1; r < rangs; r++) {
    const k = r - rang
    for (let v = 0; v < voies; v++) {
      const x = cx + (v - voie) * ECART_VOIES * w
      const y = zoneTop - sh * 0.5 + (k - 1) * MONTEE_RANG * h + 0.25 * h
      const cle = `${r}:${v}`
      const etat = sc.carte ? (sc.carte.joignables.has(cle) ? (k === 1 ? 2 : 1) : 0) : 1
      boites.push({
        rect: { minX: x - sw / 2, minY: y - sh / 2, maxX: x + sw / 2, maxY: y + sh / 2 },
        z0: 0.12 + (k - 1) * PAS_RANG,
        dz: PAS_RANG * 0.55,
        sorte: 'salle',
        teinte,
        etat,
      })
      // le couloir qui y mène, depuis le rang d'avant (ou la zone)
      if (etat > 0) {
        const larg = 0.16 * Math.min(w, h)
        const xd = k === 1 ? cx + (v - voie) * 0.32 * w : x
        const yd = k === 1 ? zoneTop - larg : y - MONTEE_RANG * h
        boites.push({
          rect: { minX: Math.min(xd, x) - larg / 2, minY: yd, maxX: Math.max(xd, x) + larg / 2, maxY: yd + larg },
          z0: k === 1 ? 0.03 : 0.12 + (k - 2) * PAS_RANG + PAS_RANG * 0.55,
          dz: k === 1 ? 0.09 : PAS_RANG * 0.45,
          sorte: 'couloir',
          teinte,
          etat,
        })
      }
    }
  }
  // 3. les autres modules de la station, au-delà du dernier rang
  const zFond = 0.12 + (rangs - rang) * PAS_RANG
  sc.modules.forEach((mod, i) => {
    const d = Math.max(1, mod.distance)
    // grands, larges, et posés PLUS HAUT que les gradins des salles : ils
    // dépassent au-dessus d'elles au lieu de se cacher derrière
    const mw = w * (3.6 + (i % 3) * 0.7)
    const mh = h * 2.2
    const x = cx + mod.cote * w * (2.2 + d * 1.6)
    const y = zoneTop + h * (rangs - rang) * MONTEE_RANG + h * (0.9 + d * 0.8)
    boites.push({
      rect: { minX: x - mw / 2, minY: y - mh / 2, maxX: x + mw / 2, maxY: y + mh / 2 },
      z0: zFond + d * 0.9,
      dz: 0.8,
      sorte: 'module',
      teinte: teinteBiome(mod.biome),
      etat: 1,
    })
  })
  return boites
}

/** Les flottants d'un sommet : position (x, y, z), uv, couleur (r, g, b), émission. */
export const FLOTTANTS_SOMMET = 9

/**
 * LA GÉOMÉTRIE, triée du plus loin au plus près (l'algorithme du peintre :
 * les boîtes ne s'interpénètrent pas, la composition y veille). Par boîte :
 * le dessus ou le dessous, puis le flanc tourné vers le point de fuite, puis
 * la face avant, puis ses feux. Deux triangles par face.
 */
export function geometrieVaisseau(boites: readonly Boite[], f: { x: number; y: number }): Float32Array {
  const ordre = [...boites].sort((a, b) => b.z0 + b.dz / 2 - (a.z0 + a.dz / 2))
  const out: number[] = []
  const quad = (
    pts: [number, number, number][],
    uvs: [number, number][],
    c: [number, number, number],
    em: number,
  ) => {
    for (const i of [0, 1, 2, 0, 2, 3]) out.push(...pts[i], ...uvs[i], ...c, em)
  }
  const tex = 1 / 900 // une répétition de la tôle tous les 900 u
  for (const b of ordre) {
    const { minX: x0, minY: y0, maxX: x1, maxY: y1 } = b.rect
    const za = b.z0
    const zb = b.z0 + b.dz
    const t = b.teinte
    const ombre = (k: number): [number, number, number] => [t[0] * k, t[1] * k, t[2] * k]
    const lum = b.sorte === 'zone' ? 0.7 : b.sorte === 'module' ? 0.9 : b.etat === 0 ? 0.5 : b.etat === 2 ? 1.25 : 0.85
    // dessus (boîte sous le point de fuite) ou dessous
    if (y1 < f.y)
      quad([[x0, y1, za], [x1, y1, za], [x1, y1, zb], [x0, y1, zb]], [[x0 * tex, 0], [x1 * tex, 0], [x1 * tex, 1], [x0 * tex, 1]], ombre(0.55 * lum), 0)
    else
      quad([[x0, y0, za], [x1, y0, za], [x1, y0, zb], [x0, y0, zb]], [[x0 * tex, 0], [x1 * tex, 0], [x1 * tex, 1], [x0 * tex, 1]], ombre(0.3 * lum), 0)
    // le flanc tourné vers le point de fuite
    if (x1 < f.x)
      quad([[x1, y0, za], [x1, y1, za], [x1, y1, zb], [x1, y0, zb]], [[y0 * tex, 0], [y1 * tex, 0], [y1 * tex, 1], [y0 * tex, 1]], ombre(0.42 * lum), 0)
    else if (x0 > f.x)
      quad([[x0, y0, za], [x0, y1, za], [x0, y1, zb], [x0, y0, zb]], [[y0 * tex, 0], [y1 * tex, 0], [y1 * tex, 1], [y0 * tex, 1]], ombre(0.42 * lum), 0)
    // la face avant
    quad([[x0, y0, za], [x1, y0, za], [x1, y1, za], [x0, y1, za]], [[x0 * tex, y0 * tex], [x1 * tex, y0 * tex], [x1 * tex, y1 * tex], [x0 * tex, y1 * tex]], ombre(0.85 * lum), 0)
    // les feux : une paire en haut de la face avant d'une salle joignable,
    // un seul, éteint, sur les autres ; un rang de hublots sur les modules
    const feu = (x: number, y: number, r: number, c: [number, number, number]) =>
      quad([[x - r, y - r, za], [x + r, y - r, za], [x + r, y + r, za], [x - r, y + r, za]], [[0, 0], [1, 0], [1, 1], [0, 1]], c, 1)
    const r = Math.min(x1 - x0, y1 - y0) * 0.05
    if (b.sorte === 'salle') {
      if (b.etat === 2) {
        feu(x0 + (x1 - x0) * 0.2, y1 - r * 3, r, [0.95, 0.79, 0.56])
        feu(x0 + (x1 - x0) * 0.8, y1 - r * 3, r, [0.39, 0.72, 0.9])
      } else if (b.etat === 1) feu(x0 + (x1 - x0) * 0.5, y1 - r * 3, r * 0.8, [0.35, 0.45, 0.55])
    } else if (b.sorte === 'module') {
      for (let k = 1; k < 8; k++) feu(x0 + ((x1 - x0) * k) / 8, (y0 + y1) / 2, r * 0.5, [0.39, 0.72, 0.9])
    }
  }
  return new Float32Array(out)
}
