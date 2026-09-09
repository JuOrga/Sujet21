// L'ASSEMBLEUR WEBM — un fichier vidéo à partir de morceaux déjà encodés.
//
// La mémoire de capture (tamponCapture.ts) garde les huit dernières secondes
// sous la forme que l'encodeur du navigateur lui donne : des morceaux VP9,
// chacun daté, certains « clés » (décodables seuls). Pour en faire un
// fichier que le codex lit dans une balise vidéo, il faut les envelopper
// dans un conteneur — et le navigateur ne sait pas le faire : MediaRecorder
// n'accepte qu'un flux d'images, pas des morceaux. D'où cet assembleur,
// écrit ici plutôt que pris à une bibliothèque : cent lignes, une seule
// piste vidéo, pas de son, pas de sous-titres, et testables sans DOM.
//
// LE FORMAT. WebM est du Matroska restreint : des éléments EBML — un
// identifiant, une taille, un contenu — emboîtés. Ce qu'un lecteur exige :
// l'en-tête EBML (le type de document « webm »), puis un Segment qui porte
// les Infos (l'échelle de temps, la durée), les Pistes (une piste vidéo,
// codec V_VP9, largeur, hauteur) et des Clusters — chacun daté, contenant
// des SimpleBlocks (un morceau, son écart de temps au cluster, le drapeau
// « clé »). Pas de Cues : la balise vidéo boucle sans index, comme sur les
// fichiers de MediaRecorder, qui n'en écrit pas non plus.
//
// LES TEMPS sont en millisecondes (TimecodeScale = 1 000 000 ns). L'écart
// d'un bloc à son cluster tient sur un entier signé de 16 bits : un cluster
// s'ouvre à chaque image clé, donc jamais plus d'une seconde ou deux entre
// deux, très loin des 32 s que l'entier permet.

export interface MorceauVideo {
  /** les octets encodés, tels que l'encodeur les a rendus */
  donnees: Uint8Array
  /** décodable seul (image clé) — un fichier doit commencer par un */
  cle: boolean
  /** l'horodatage de l'image, en microsecondes */
  tempsUs: number
}

export type CodecWebm = 'V_VP9' | 'V_VP8'

// ---- EBML : les briques ----------------------------------------------------------

/** La taille d'un élément en « vint » : 1 à 8 octets, le premier bit posé
 *  dit la longueur. On écrit toujours sur 8 octets pour les conteneurs
 *  (simple, et la taille n'est connue qu'après les enfants), sur le plus
 *  court pour les feuilles. */
function vint(n: number, octets?: number): Uint8Array {
  let l = octets ?? 1
  if (octets === undefined) while (l < 8 && n >= 2 ** (7 * l) - 1) l++
  const out = new Uint8Array(l)
  let v = n
  for (let i = l - 1; i >= 0; i--) {
    out[i] = v & 0xff
    v = Math.floor(v / 256)
  }
  out[0] |= 0x80 >> (l - 1)
  return out
}

function id(code: number): Uint8Array {
  const out: number[] = []
  let v = code
  while (v > 0) {
    out.unshift(v & 0xff)
    v = Math.floor(v / 256)
  }
  return new Uint8Array(out)
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  let n = 0
  for (const p of parts) n += p.length
  const out = new Uint8Array(n)
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function element(code: number, contenu: Uint8Array, tailleFixe?: number): Uint8Array {
  return concat([id(code), vint(contenu.length, tailleFixe), contenu])
}

function entier(code: number, n: number): Uint8Array {
  const out: number[] = []
  let v = Math.max(0, Math.floor(n))
  do {
    out.unshift(v & 0xff)
    v = Math.floor(v / 256)
  } while (v > 0)
  return element(code, new Uint8Array(out))
}

function flottant(code: number, x: number): Uint8Array {
  const b = new Uint8Array(8)
  new DataView(b.buffer).setFloat64(0, x)
  return element(code, b)
}

function chaine(code: number, s: string): Uint8Array {
  return element(code, new TextEncoder().encode(s))
}

// Les identifiants Matroska dont on se sert, et rien d'autre.
export const ID = {
  EBML: 0x1a45dfa3,
  EBMLVersion: 0x4286,
  EBMLReadVersion: 0x42f7,
  EBMLMaxIDLength: 0x42f2,
  EBMLMaxSizeLength: 0x42f3,
  DocType: 0x4282,
  DocTypeVersion: 0x4287,
  DocTypeReadVersion: 0x4285,
  Segment: 0x18538067,
  Info: 0x1549a966,
  TimecodeScale: 0x2ad7b1,
  Duration: 0x4489,
  MuxingApp: 0x4d80,
  WritingApp: 0x5741,
  Tracks: 0x1654ae6b,
  TrackEntry: 0xae,
  TrackNumber: 0xd7,
  TrackUID: 0x73c5,
  TrackType: 0x83,
  CodecID: 0x86,
  Video: 0xe0,
  PixelWidth: 0xb0,
  PixelHeight: 0xba,
  Cluster: 0x1f43b675,
  Timecode: 0xe7,
  SimpleBlock: 0xa3,
} as const

/** Un SimpleBlock : numéro de piste (vint), écart de temps signé sur 16
 *  bits, drapeaux (0x80 = image clé), puis les octets. */
function simpleBlock(m: MorceauVideo, ecartMs: number): Uint8Array {
  const tete = new Uint8Array(4)
  tete[0] = 0x81 // piste 1
  const e = Math.max(-32768, Math.min(32767, Math.round(ecartMs)))
  tete[1] = (e >> 8) & 0xff
  tete[2] = e & 0xff
  tete[3] = m.cle ? 0x80 : 0x00
  return element(ID.SimpleBlock, concat([tete, m.donnees]))
}

/** Le fichier WebM d'une suite de morceaux. Les morceaux doivent être dans
 *  l'ordre du temps et commencer par une image clé — c'est le contrat de
 *  la mémoire de capture, vérifié ici parce qu'un fichier qui commence en
 *  plein mouvement ne se décode pas. Les temps sont ramenés au premier. */
export function assembleWebm(
  morceaux: readonly MorceauVideo[],
  largeur: number,
  hauteur: number,
  codec: CodecWebm = 'V_VP9',
): Uint8Array<ArrayBuffer> {
  if (morceaux.length === 0) throw new Error('WebM : aucun morceau')
  if (!morceaux[0].cle) throw new Error('WebM : le premier morceau doit être une image clé')
  const origine = morceaux[0].tempsUs
  const ms = (m: MorceauVideo): number => (m.tempsUs - origine) / 1000
  // la durée : jusqu'à la fin de la dernière image, estimée par l'écart
  // moyen entre images (une seule image : un vingt-cinquième de seconde)
  const fin = ms(morceaux[morceaux.length - 1])
  const pas = morceaux.length > 1 ? fin / (morceaux.length - 1) : 40
  const duree = fin + pas

  const entete = element(
    ID.EBML,
    concat([
      entier(ID.EBMLVersion, 1),
      entier(ID.EBMLReadVersion, 1),
      entier(ID.EBMLMaxIDLength, 4),
      entier(ID.EBMLMaxSizeLength, 8),
      chaine(ID.DocType, 'webm'),
      entier(ID.DocTypeVersion, 4),
      entier(ID.DocTypeReadVersion, 2),
    ]),
  )
  const info = element(
    ID.Info,
    concat([
      entier(ID.TimecodeScale, 1_000_000),
      flottant(ID.Duration, duree),
      chaine(ID.MuxingApp, 'sujet21'),
      chaine(ID.WritingApp, 'sujet21 capture'),
    ]),
  )
  const pistes = element(
    ID.Tracks,
    element(
      ID.TrackEntry,
      concat([
        entier(ID.TrackNumber, 1),
        entier(ID.TrackUID, 1),
        entier(ID.TrackType, 1), // vidéo
        chaine(ID.CodecID, codec),
        element(ID.Video, concat([entier(ID.PixelWidth, largeur), entier(ID.PixelHeight, hauteur)])),
      ]),
    ),
  )

  // un cluster par image clé : le temps du cluster est celui de la clé,
  // les blocs qui suivent en donnent l'écart
  const clusters: Uint8Array[] = []
  let debutCluster = 0
  let blocs: Uint8Array[] = []
  const ferme = (): void => {
    if (blocs.length === 0) return
    clusters.push(element(ID.Cluster, concat([entier(ID.Timecode, debutCluster), ...blocs])))
    blocs = []
  }
  for (const m of morceaux) {
    const t = ms(m)
    if (m.cle) {
      ferme()
      debutCluster = Math.round(t)
    }
    blocs.push(simpleBlock(m, t - debutCluster))
  }
  ferme()

  const segment = element(ID.Segment, concat([info, pistes, ...clusters]), 8)
  return concat([entete, segment])
}

// ---- Une lecture minimale, pour les tests et les vérifications --------------------

export interface ElementLu {
  id: number
  taille: number
  /** l'indice du premier octet du contenu */
  debut: number
}

/** Lit l'élément qui commence à `pos` : son identifiant, sa taille, où
 *  commence son contenu. Sert aux tests ; jette sur un vint invalide. */
export function litElement(b: Uint8Array, pos: number): ElementLu {
  let p = pos
  const l1 = Math.clz32(b[p]) - 24 + 1
  if (l1 < 1 || l1 > 4) throw new Error(`identifiant EBML invalide à ${pos}`)
  let idv = 0
  for (let i = 0; i < l1; i++) idv = idv * 256 + b[p + i]
  p += l1
  const l2 = Math.clz32(b[p]) - 24 + 1
  if (l2 < 1 || l2 > 8) throw new Error(`taille EBML invalide à ${p}`)
  let taille = b[p] & (0xff >> l2)
  for (let i = 1; i < l2; i++) taille = taille * 256 + b[p + i]
  p += l2
  return { id: idv, taille, debut: p }
}

/** Les enfants directs d'un contenu [debut, fin). */
export function litEnfants(b: Uint8Array, debut: number, fin: number): ElementLu[] {
  const out: ElementLu[] = []
  let p = debut
  while (p < fin) {
    const e = litElement(b, p)
    out.push(e)
    p = e.debut + e.taille
  }
  return out
}
