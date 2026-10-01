// LE VAISSEAU AUTOUR DE LA SALLE — en perspective à UN point de fuite.
//
// La salle qu'on joue est le plan avant (z = 0), vue de dessus comme
// toujours. Le reste du vaisseau est un PONT qui part du bord haut de la
// salle et file vers un HORIZON au-dessus d'elle (le concept du concepteur,
// 01/10 — le premier jet faisait monter chaque rang vers le point de fuite :
// les volumes s'étageaient en gradins dans le vide au lieu de se poser sur
// un sol) :
//
//   1. LA ZONE INTERMÉDIAIRE — le pont du module qui entoure la salle, entre
//      elle et le vide : habillée selon le BIOME du module ;
//   2. LES SALLES DU MODULE — la mini-carte (voiesModule.ts) posée sur le
//      pont : les trois VOIES donnent la position gauche–centre–droite, les
//      RANGS la profondeur. Chaque salle montre sa FAÇADE (de face, ses feux
//      de porte) et son TOIT (qui s'enfonce). Les joignables ont leurs feux
//      allumés et un tube qui y mène ; celles que les choix ont fermées
//      s'éteignent ; les salles jouées sont « derrière la caméra » ;
//   3. LES AUTRES MODULES DE LA STATION — la grande carte : de longs modules
//      qui BORDENT LA ROUTE, à gauche et à droite selon leur côté sur la
//      carte, d'autant plus loin qu'ils sont loin ; leurs flancs à hublots
//      font face à l'allée.
//
// LA PROFONDEUR DIT OÙ L'ON VA : l'horizon est le bout de la route.
//
// LA PROJECTION. Un point (x, y, z) — (x, y) dans le plan avant, en unités
// monde, z sans dimension — se voit au point du monde
//     P' = F + (P − F) / (1 + z)
// où F est le point de fuite, FIXÉ DANS LE MONDE au-dessus de la salle. Le
// plan y = haut de la zone, z > 0, est donc un SOL qui monte vers F ; une
// boîte posée dessus montre sa face z = z0 de face (la façade) et sa face
// y = haut (le toit) en fuite. Une arête qui s'enfonce reste une droite qui
// file exactement vers F, au déplacement comme au recul de la caméra : la
// projection est faite AVANT la caméra, et la caméra n'est qu'une échelle et
// un décalage (le shader). Ce fichier en est la seule implémentation côté
// CPU, et les tests la tiennent.

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
  sorte: 'pont' | 'zone' | 'salle' | 'couloir' | 'module'
  /** teinte du biome (multiplie la tôle) */
  teinte: [number, number, number]
  /** 0 éteinte · 1 en veille · 2 joignable (feux allumés) */
  etat: number
}

export const ZONE_MARGE = 0.55 // la zone déborde de la salle de 55 % de sa petite dimension
export const HORIZON = 1.7 // l'horizon au-dessus de la zone, en hauteurs de salle : à 0,8 (le concept), le vaisseau tenait dans une bande mince au zoom de jeu, où la salle ne fait qu'un cinquième de l'écran
export const ECART_VOIES = 0.55 // d'une voie à l'autre, en largeurs de salle : la mini-carte en MAQUETTE — le vaisseau est bien plus grand que la salle
export const PAS_RANG = 0.5 // la profondeur d'un rang à l'autre
export const Z_RANG1 = 0.15 // la profondeur du premier rang à venir : juste derrière la zone
export const PONT_LOIN = 7 // le bout du pont : au-delà, la brume l'a avalé

const TEINTES: Record<string, [number, number, number]> = {
  cryo: [0.78, 0.9, 1.05],
  tempere: [0.8, 0.98, 0.82],
  chaud: [1.05, 0.84, 0.66],
}
export function teinteBiome(biome: string): [number, number, number] {
  return TEINTES[biome] ?? [0.88, 0.9, 0.95]
}

/** L'IMAGE DE ZONE d'un biome : les trois livrées (01/10) ; l'antichambre,
 *  l'observatoire et le hub prennent la tempérée en attendant les leurs. */
export const ZONES_LIVREES = ['tempere', 'cryo', 'chaud'] as const
export function zoneDuBiome(biome: string): string {
  return (ZONES_LIVREES as readonly string[]).includes(biome) ? biome : 'tempere'
}

/** Le point de fuite : au centre de la salle, sur l'horizon, juste au-dessus
 *  de sa zone. */
export function pointDeFuite(salle: Rect): { x: number; y: number } {
  const w = salle.maxX - salle.minX
  const h = salle.maxY - salle.minY
  const m = ZONE_MARGE * Math.min(w, h)
  return { x: (salle.minX + salle.maxX) / 2, y: salle.maxY + m + HORIZON * h }
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
  const sol = salle.maxY + m
  // tout ce qui est posé sur le pont reste SOUS l'horizon : on en voit le toit
  const libre = HORIZON * h
  const rangs = sc.carte?.rangs ?? 6
  const voies = sc.carte?.voies ?? 3
  const rang = sc.carte?.rang ?? 0
  const voie = sc.carte?.voie ?? Math.floor(voies / 2)
  const sw = w * 0.46
  const sh = Math.min(0.2 * w, 0.3 * libre)
  // profondes : vu de si bas, un toit court ne se verrait pas
  const sdz = PAS_RANG * 0.78
  const xVoie = (v: number) => cx + (v - voie) * ECART_VOIES * w
  const zRang = (k: number) => Z_RANG1 + (k - 1) * PAS_RANG
  // les deux bords de l'allée : les modules de la station s'y alignent
  const demi = Math.max(voie, voies - 1 - voie) * ECART_VOIES * w + sw / 2
  const mw = w * 1.1
  const mh = libre * 0.5
  // LE PONT a la largeur de l'allée et de ses deux rangées de modules, pas
  // plus : un pont sans bord, large comme l'écran, se lisait comme une plaque
  // grise posée dans le vide (aperçu du 01/10)
  const bord = Math.max(demi + 0.1 * w + mw, w / 2 + m)
  // 1. la zone intermédiaire : le pont du module autour de la salle, aussi
  // large que l'allée qui en part — la plateforme se lit en T ; plus large,
  // la zone plate mangeait l'écran
  const zone: Rect = { minX: cx - Math.max(demi, w / 2 + m), minY: salle.minY - m, maxX: cx + Math.max(demi, w / 2 + m), maxY: sol }
  boites.push({ rect: zone, z0: 0.004, dz: 0.09, sorte: 'zone', teinte, etat: 1 })
  // 0. le pont lui-même, jusqu'à la brume
  boites.push({
    rect: { minX: cx - bord, minY: sol - m, maxX: cx + bord, maxY: sol },
    z0: 0.004,
    dz: PONT_LOIN,
    sorte: 'pont',
    teinte,
    etat: 1,
  })
  // 2. les salles du module, rang par rang, voie par voie, posées sur le pont
  const tube = 0.06 * w
  for (let r = rang + 1; r < rangs; r++) {
    const k = r - rang
    const etats: number[] = []
    for (let v = 0; v < voies; v++) {
      const x = xVoie(v)
      const etat = sc.carte ? (sc.carte.joignables.has(`${r}:${v}`) ? (k === 1 ? 2 : 1) : 0) : 1
      etats.push(etat)
      boites.push({
        rect: { minX: x - sw / 2, minY: sol, maxX: x + sw / 2, maxY: sol + sh },
        z0: zRang(k),
        dz: sdz,
        sorte: 'salle',
        teinte,
        etat,
      })
      // le tube qui y mène, sur le pont, depuis le rang d'avant (ou la zone)
      if (etat > 0) {
        const z0 = k === 1 ? 0.094 : zRang(k - 1) + sdz
        boites.push({
          rect: { minX: x - tube / 2, minY: sol, maxX: x + tube / 2, maxY: sol + tube * 0.8 },
          z0,
          dz: zRang(k) - z0,
          sorte: 'couloir',
          teinte,
          etat,
        })
      }
    }
    // entre deux salles voisines ouvertes, un tube couché les relie
    for (let v = 0; v + 1 < voies; v++) {
      if (etats[v] === 0 || etats[v + 1] === 0) continue
      boites.push({
        rect: { minX: xVoie(v) + sw / 2, minY: sol + sh * 0.25, maxX: xVoie(v + 1) - sw / 2, maxY: sol + sh * 0.25 + tube },
        z0: zRang(k) + sdz * 0.3,
        dz: sdz * 0.4,
        sorte: 'couloir',
        teinte,
        etat: Math.min(etats[v], etats[v + 1]),
      })
    }
  }
  // 3. les autres modules de la station, le long de l'allée : à gauche ceux
  // de gauche sur la carte, à droite ceux de droite, à la file, d'autant plus
  // loin qu'ils le sont sur la carte. Les rangées sont CONTINUES jusqu'à la
  // brume : là où la carte n'a rien à mettre (un trou, ou plus rien devant —
  // la fin de la route), un module de la station sans biome. Sans eux,
  // l'allée bordait le vide (aperçu du 01/10 : aucun module de visible).
  const PAS_MODULE = 1.25
  const suivant: Record<number, number> = { [-1]: 0.1, [1]: 0.1 }
  const poser = (cote: number, t: [number, number, number], z: number) => {
    const xi = cx + cote * (demi + 0.1 * w)
    boites.push({
      rect: { minX: Math.min(xi, xi + cote * mw), minY: sol, maxX: Math.max(xi, xi + cote * mw), maxY: sol + mh },
      z0: z,
      dz: PAS_MODULE * 0.92,
      sorte: 'module',
      teinte: t,
      etat: 1,
    })
    suivant[cote] = z + PAS_MODULE
  }
  const neutre = teinteBiome('')
  const comble = (cote: number, jusque: number) => {
    while (suivant[cote] + PAS_MODULE <= jusque + 1e-9) poser(cote, neutre, suivant[cote])
  }
  ;[...sc.modules]
    .sort((a, b) => a.distance - b.distance)
    .forEach((mod) => {
      const cote = mod.cote < 0 ? -1 : 1
      const zMin = 0.1 + (Math.max(1, mod.distance) - 1) * 1.3
      comble(cote, zMin)
      poser(cote, teinteBiome(mod.biome), Math.max(suivant[cote], zMin))
    })
  for (const cote of [-1, 1]) comble(cote, PONT_LOIN * 0.7)
  return boites
}

/** LES MATÉRIAUX, portés par le 4e canal de la couleur d'un sommet (le
 *  shader les relit, renderer.ts VAISSEAU_FS) : chaque face prend l'image
 *  qui lui revient, et la tôle de secours tant que l'image n'est pas là. */
export const MAT_PAROI = 0 // les flancs d'une salle : vaisseau-paroi, répétée
export const MAT_FEU = 1 // un feu : émissif, sans brume
export const MAT_TOIT = 2 // le toit d'une salle, en fuite : vaisseau-salle-toit, étiré
export const MAT_ZONE = 3 // la zone intermédiaire : vaisseau-zone-<biome>, pavée
export const MAT_MODULE = 4 // le toit (et le bout) d'un grand module : vaisseau-module-toit, étiré
export const MAT_COULOIR = 5 // un couloir : vaisseau-couloir, étiré d'un collier à l'autre
export const MAT_MODULE_PAROI = 6 // le flanc d'un grand module face à l'allée : vaisseau-module-paroi, répétée
export const MAT_PONT = 7 // le pont, en fuite : vaisseau-pont, pavé
export const MAT_FACADE = 8 // la façade d'une salle, sa porte au centre : vaisseau-salle-facade, étirée
/** Une répétition de la zone tous les ZONE_TUILE u. */
export const ZONE_TUILE = 760
/** Combien de fois les ponts à hublots se répètent le long d'un module, par
 *  unité de profondeur ; la tôle du pont, combien de fois, et tous les
 *  PONT_TUILE u en largeur. */
export const MODULE_REP_Z = 2.2
export const PONT_REP_Z = 2.5
export const PONT_TUILE = 900

/** Les flottants d'un sommet : position (x, y, z), uv, couleur (r, g, b), matériau. */
export const FLOTTANTS_SOMMET = 9

/**
 * LA GÉOMÉTRIE, triée du plus loin au plus près (l'algorithme du peintre :
 * les boîtes ne s'interpénètrent pas, la composition y veille). D'abord le
 * pont, puis les modules qui bordent l'allée — tout ce qui est dans l'allée
 * passe devant eux, à toute profondeur, puisqu'ils sont au-delà de ses bords
 * — puis le reste, du plus loin au plus près. Par boîte : le toit (ou le
 * dessous), le flanc tourné vers le point de fuite, la face avant, ses feux.
 */
export function geometrieVaisseau(boites: readonly Boite[], f: { x: number; y: number }): Float32Array {
  const rangOrdre = (b: Boite) => (b.sorte === 'pont' ? 0 : b.sorte === 'module' ? 1 : 2)
  const ordre = [...boites].sort((a, b) => rangOrdre(a) - rangOrdre(b) || b.z0 + b.dz / 2 - (a.z0 + a.dz / 2))
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
  const tuileZone = 1 / ZONE_TUILE
  for (const b of ordre) {
    const { minX: x0, minY: y0, maxX: x1, maxY: y1 } = b.rect
    const za = b.z0
    const zb = b.z0 + b.dz
    const t = b.teinte
    const ombre = (k: number): [number, number, number] => [t[0] * k, t[1] * k, t[2] * k]
    const lum =
      b.sorte === 'zone' || b.sorte === 'pont' ? 0.7 : b.sorte === 'module' ? 0.9 : b.etat === 0 ? 0.5 : b.etat === 2 ? 1.25 : 0.85
    // les quatre coins d'une face qui s'enfonce : le toit (y = cst) ou un flanc (x = cst)
    const toit: [number, number, number][] = y1 < f.y
      ? [[x0, y1, za], [x1, y1, za], [x1, y1, zb], [x0, y1, zb]]
      : [[x0, y0, za], [x1, y0, za], [x1, y0, zb], [x0, y0, zb]]
    const kToit = y1 < f.y ? 0.75 : 0.4
    const xf = x1 < f.x ? x1 : x0 > f.x ? x0 : null
    const flanc: [number, number, number][] | null =
      xf === null ? null : [[xf, y0, za], [xf, y1, za], [xf, y1, zb], [xf, y0, zb]]
    // (u, v) des coins dans l'ordre ci-dessus : « près → loin » sur l'axe de la profondeur
    const profU: [number, number][] = [[0, 0], [0, 1], [1, 1], [1, 0]] // u suit z
    const profV: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]] // v suit z
    const avant: [number, number, number][] = [[x0, y0, za], [x1, y0, za], [x1, y1, za], [x0, y1, za]]

    if (b.sorte === 'pont') {
      // seul le sol se voit : sa face avant serait sous la zone
      const r = b.dz * PONT_REP_Z
      quad(toit, [[x0 / PONT_TUILE, 0], [x1 / PONT_TUILE, 0], [x1 / PONT_TUILE, r], [x0 / PONT_TUILE, r]], ombre(0.85 * lum), MAT_PONT)
      continue
    }
    if (b.sorte === 'zone') {
      quad(toit, [[x0 * tex, 1], [x1 * tex, 1], [x1 * tex, 0], [x0 * tex, 0]], ombre(0.7 * lum), MAT_PAROI)
      if (flanc) quad(flanc, [[y0 * tex, 1], [y1 * tex, 1], [y1 * tex, 0], [y0 * tex, 0]], ombre(0.55 * lum), MAT_PAROI)
      quad(avant, [[x0 * tuileZone, y0 * tuileZone], [x1 * tuileZone, y0 * tuileZone], [x1 * tuileZone, y1 * tuileZone], [x0 * tuileZone, y1 * tuileZone]], ombre(lum), MAT_ZONE)
      continue
    }
    if (b.sorte === 'couloir') {
      // LE TUBE, étiré d'un collier à l'autre, jamais répété : sa longueur
      // est dans la profondeur (vers le rang suivant) ou couchée en x (entre
      // deux salles voisines) — l'image suit
      const couche = x1 - x0 > 1.5 * (y1 - y0)
      quad(toit, couche ? profV : profU, ombre(0.75 * lum), MAT_COULOIR)
      if (flanc && !couche) quad(flanc, profU, ombre(0.55 * lum), MAT_COULOIR)
      if (couche) quad(avant, [[0, 0], [1, 0], [1, 1], [0, 1]], ombre(0.85 * lum), MAT_COULOIR)
      else quad(avant, [[x0 * tex, y0 * tex], [x1 * tex, y0 * tex], [x1 * tex, y1 * tex], [x0 * tex, y1 * tex]], ombre(0.6 * lum), MAT_PAROI)
      continue
    }
    const feu = (x: number, y: number, r: number, c: [number, number, number]) =>
      quad([[x - r, y - r, za], [x + r, y - r, za], [x + r, y + r, za], [x - r, y + r, za]], [[0, 0], [1, 0], [1, 1], [0, 1]], c, MAT_FEU)
    if (b.sorte === 'module') {
      // le toit, en fuite : sa longueur suit la profondeur ; le flanc face à
      // l'allée, ses ponts à hublots répétés le long ; le bout, étiré
      quad(toit, profU, ombre(kToit * lum), MAT_MODULE)
      const r = b.dz * MODULE_REP_Z
      if (flanc) quad(flanc, [[0, 0], [0, 1], [r, 1], [r, 0]], ombre(0.8 * lum), MAT_MODULE_PAROI)
      quad(avant, [[0, 0], [1, 0], [1, 1], [0, 1]], ombre(0.6 * lum), MAT_MODULE)
      const rb = Math.min(x1 - x0, y1 - y0) * 0.025
      feu(x0 + rb * 3, y1 - rb * 3, rb, [0.39, 0.72, 0.9])
      feu(x1 - rb * 3, y1 - rb * 3, rb, [0.95, 0.42, 0.3])
      continue
    }
    // UNE SALLE posée sur le pont : son toit en fuite (le même toit que vu de
    // dessus, étiré), ses flancs en paroi, et sa FAÇADE — l'élévation, sa
    // porte au centre, étirée une fois : les salles d'un rang côte à côte
    // montrent la même porte au même endroit
    quad(toit, profV, ombre(kToit * lum), MAT_TOIT)
    if (flanc) quad(flanc, [[0, 0], [1, 0], [1, b.dz * 2], [0, b.dz * 2]], ombre(0.5 * lum), MAT_PAROI)
    quad(avant, [[0, 0], [1, 0], [1, 1], [0, 1]], ombre(0.85 * lum), MAT_FACADE)
    // les feux de porte DANS les deux hublots peints de part et d'autre de
    // la porte (salle-facade livrée le 01/10 : à 36 % et 64 % de la largeur,
    // 51 % de la hauteur) : allumés orange sur une salle joignable, en veille
    // sur les autres, éteints sur une salle fermée
    const r = (y1 - y0) * 0.05
    const yh = y0 + (y1 - y0) * 0.51
    const c: [number, number, number] | null =
      b.etat === 2 ? [0.98, 0.62, 0.28] : b.etat === 1 ? [0.3, 0.4, 0.5] : null
    if (c) {
      feu(x0 + (x1 - x0) * 0.36, yh, r, c)
      feu(x0 + (x1 - x0) * 0.64, yh, r, c)
    }
  }
  return new Float32Array(out)
}
