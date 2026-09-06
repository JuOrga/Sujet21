// LE FANTÔME : la trace d'une course, rejouée en silhouette dans la salle.
//
// Ce n'est PAS un rejeu des entrées. La simulation n'a aucun aléa, mais le
// solveur appelle des fonctions (puissance, exponentielle, sinus) dont le
// dernier bit varie d'un navigateur à l'autre, et le test de parité
// JS ↔ WASM tolère déjà un écart qui grandit avec le temps — les contacts
// amplifient tout. Rejouer les entrées d'un joueur sur une autre machine
// donnerait un autre film au bout de quelques secondes. On enregistre
// donc LE CORPS LUI-MÊME, comme les jeux de course enregistrent la
// voiture : à cadence fixe de temps SIMULÉ (le time warp ne fausse rien,
// la pause suspend), le centre, le volume, l'état — et, depuis la
// version 2, LA FORME (l'étendue du corps dans seize secteurs autour du
// centre : la goutte qui s'étire, se creuse quand elle éjecte, se tasse en
// bloc, se gonfle en nuage) et LE GESTE (la direction de poussée quand le
// joueur éjecte, les dashs de vapeur en événements). Un fantôme se lit
// alors comme une leçon : on voit où il a gelé, où il a dashé, comment il
// a viré.
//
// Un fantôme par salle et par record — le VOLUME (gros et lent) et le
// CHRONO (petit et vif) : on voit littéralement l'arbitrage du jeu incarné
// par une course d'avant. Le tout vit dans l'emplacement de sauvegarde
// (coffre), donc dans le fichier que le Steam Cloud synchronise — d'où
// l'encodage serré : vingt-cinq octets par échantillon, en base64, et un
// budget global qui évince les plus anciens plutôt que de faire déborder
// le stockage du navigateur (vers 5 Mo pour tout le site).
//
// Ce module est PUR : ni DOM, ni solveur. Le jeu lui donne des nombres,
// il rend des nombres — tout se teste.

/** Le nombre de secteurs du PROFIL : l'étendue du corps tous les 22,5°,
 *  en partant de l'est, dans le sens trigonométrique (le repère monde). */
export const SECTEURS = 16

/** Ce qu'on note d'un corps à un instant : le centre, le rayon quadratique
 *  moyen, le volume en centilitres, l'état (0 eau · 1 glace · 2 vapeur),
 *  la POUSSÉE (l'angle monde vers lequel le joueur éjecte, null s'il
 *  n'éjecte pas) et le PROFIL (seize étendues depuis le centre, en unités
 *  monde ; vide pour une trace d'avant la forme). */
export interface EchantillonFantome {
  x: number
  y: number
  r: number
  cl: number
  etat: number
  poussee: number | null
  profil: number[]
}

export const ETAT_EAU = 0
export const ETAT_GLACE = 1
export const ETAT_VAPEUR = 2

/** Les ÉVÉNEMENTS d'une course : ce qui ne se lit pas dans la forme. */
export const EV_DASH = 1

export interface EvenementFantome {
  t: number // temps simulé du tableau (s)
  type: number
  angle: number // radians, repère monde
}

/** La cadence d'échantillonnage, en secondes SIMULÉES. Dix par seconde :
 *  une silhouette interpolée à dix images par seconde se lit sans à-coup. */
export const CADENCE_FANTOME = 0.1

/** Un fantôme rangé : la trace encodée, et ce qu'il faut pour l'annoncer
 *  et l'arbitrer (litres, temps, date, opérateur). La version 1 (huit
 *  octets : ni forme ni geste) se relit toujours — en cercle. */
export interface FantomeDef {
  v: 1 | 2
  cadence: number
  n: number // nombre d'échantillons
  litres: number
  temps: number
  quand: string // ISO
  nom: string // l'opérateur
  donnees: string // base64 des échantillons
  /** Les événements, à plat : [t en ms, type, angle en degrés, …] */
  ev?: number[]
}

export type CategorieFantome = 'volume' | 'chrono'

const OCTETS_V1 = 8
const OCTETS_V2 = 8 + 1 + SECTEURS // 25
function octetsDe(v: number): number {
  return v >= 2 ? OCTETS_V2 : OCTETS_V1
}

// ---- L'encodage --------------------------------------------------------------
// x, y : Int16 (unités monde, les cuves tiennent dans ±32 767) ·
// r : Uint8 au demi (0..510) · cl : Uint16 (0..65 535 cL) · etat : Uint8 ·
// poussée : Uint8 (0 = aucune, 1..255 = l'angle sur 254 crans) ·
// profil : 16 × Uint8 au quart (0..1 020 unités par secteur).

function borne(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(v)))
}

const TAU = Math.PI * 2

function encodePoussee(a: number | null): number {
  if (a === null || !Number.isFinite(a)) return 0
  const t = ((a % TAU) + TAU) % TAU
  return 1 + Math.round((t / TAU) * 254)
}

function decodePoussee(v: number): number | null {
  return v === 0 ? null : ((v - 1) / 254) * TAU
}

export function encodeEchantillons(pts: readonly EchantillonFantome[]): string {
  const buf = new Uint8Array(pts.length * OCTETS_V2)
  const vue = new DataView(buf.buffer)
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const o = i * OCTETS_V2
    vue.setInt16(o, borne(p.x, -32768, 32767))
    vue.setInt16(o + 2, borne(p.y, -32768, 32767))
    vue.setUint8(o + 4, borne(p.r / 2, 0, 255))
    vue.setUint16(o + 5, borne(p.cl, 0, 65535))
    vue.setUint8(o + 7, borne(p.etat, 0, 255))
    vue.setUint8(o + 8, encodePoussee(p.poussee))
    for (let s = 0; s < SECTEURS; s++) {
      // un profil absent (trace d'avant) se remplace par le rayon du corps
      const e = p.profil.length === SECTEURS ? p.profil[s] : p.r * 1.41
      vue.setUint8(o + 9 + s, borne(e / 4, 0, 255))
    }
  }
  let bin = ''
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
  return btoa(bin)
}

export function decodeEchantillons(donnees: string, n: number, v = 2): EchantillonFantome[] {
  let bin: string
  try {
    bin = atob(donnees)
  } catch {
    return []
  }
  const octets = octetsDe(v)
  const total = Math.min(n, Math.floor(bin.length / octets))
  const buf = new Uint8Array(total * octets)
  for (let i = 0; i < buf.length; i++) buf[i] = bin.charCodeAt(i)
  const vue = new DataView(buf.buffer)
  const out: EchantillonFantome[] = []
  for (let i = 0; i < total; i++) {
    const o = i * octets
    const e: EchantillonFantome = {
      x: vue.getInt16(o),
      y: vue.getInt16(o + 2),
      r: vue.getUint8(o + 4) * 2,
      cl: vue.getUint16(o + 5),
      etat: vue.getUint8(o + 7),
      poussee: null,
      profil: [],
    }
    if (v >= 2) {
      e.poussee = decodePoussee(vue.getUint8(o + 8))
      for (let s = 0; s < SECTEURS; s++) e.profil.push(vue.getUint8(o + 9 + s) * 4)
    }
    out.push(e)
  }
  return out
}

export function encodeEvenements(evs: readonly EvenementFantome[]): number[] {
  const out: number[] = []
  for (const e of evs) {
    out.push(Math.round(e.t * 1000), e.type, Math.round((e.angle * 180) / Math.PI))
  }
  return out
}

export function decodeEvenements(brut: unknown): EvenementFantome[] {
  if (!Array.isArray(brut)) return []
  const out: EvenementFantome[] = []
  for (let i = 0; i + 2 < brut.length; i += 3) {
    const t = brut[i]
    const type = brut[i + 1]
    const deg = brut[i + 2]
    if (typeof t !== 'number' || typeof type !== 'number' || typeof deg !== 'number') continue
    out.push({ t: t / 1000, type, angle: (deg * Math.PI) / 180 })
  }
  return out
}

/** Le PROFIL d'un nuage de points autour d'un centre : par secteur,
 *  l'étendue maximale (0 si le secteur est vide). Pur, pour les tests ;
 *  le jeu appelle la variante sur tableaux typés. */
export function profilDe(
  cx: number,
  cy: number,
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  garde: (i: number) => boolean,
  n: number,
): number[] {
  const p = new Array<number>(SECTEURS).fill(0)
  for (let i = 0; i < n; i++) {
    if (!garde(i)) continue
    const dx = xs[i] - cx
    const dy = ys[i] - cy
    const d = Math.hypot(dx, dy)
    if (d === 0) continue
    let a = Math.atan2(dy, dx)
    if (a < 0) a += TAU
    const s = Math.min(SECTEURS - 1, Math.floor((a / TAU) * SECTEURS))
    if (d > p[s]) p[s] = d
  }
  // un secteur vide (le corps est mince, ou creusé) prend la moyenne de ses
  // voisins : la silhouette ne se déchire pas pour un trou d'échantillonnage
  for (let s = 0; s < SECTEURS; s++) {
    if (p[s] > 0) continue
    const g = p[(s + SECTEURS - 1) % SECTEURS]
    const d = p[(s + 1) % SECTEURS]
    if (g > 0 && d > 0) p[s] = (g + d) / 2
    else p[s] = Math.max(g, d) * 0.6
  }
  return p
}

// ---- L'enregistreur : une course en train de se jouer -------------------------

export class EnregistreurFantome {
  private readonly pts: EchantillonFantome[] = []
  private readonly evs: EvenementFantome[] = []
  private prochain = 0

  constructor(readonly cadence = CADENCE_FANTOME) {}

  /** Est-ce l'instant d'un échantillon ? À appeler à chaque pas de
   *  simulation avec le temps simulé du tableau ; l'échantillon n'est
   *  demandé (et le corps parcouru) qu'une fois par cran de cadence. */
  aBesoin(t: number): boolean {
    return t + 1e-9 >= this.prochain
  }

  note(t: number, e: EchantillonFantome): void {
    if (!this.aBesoin(t)) return
    this.pts.push({ ...e, profil: e.profil.slice() })
    // le cran suivant se cale sur la grille, pas sur l'instant de la note :
    // un pas en retard ne décale pas toute la trace
    this.prochain = (Math.floor(t / this.cadence + 1e-9) + 1) * this.cadence
  }

  /** Un événement daté : le dash de vapeur, à l'instant où il part. */
  evenement(t: number, type: number, angle: number): void {
    this.evs.push({ t, type, angle })
  }

  get taille(): number {
    return this.pts.length
  }

  get evenements(): number {
    return this.evs.length
  }

  /** La trace close : le corps a bu le sas. */
  fin(nom: string, litres: number, temps: number, quand = new Date().toISOString()): FantomeDef {
    const def: FantomeDef = {
      v: 2,
      cadence: this.cadence,
      n: this.pts.length,
      litres,
      temps,
      quand,
      nom,
      donnees: encodeEchantillons(this.pts),
    }
    if (this.evs.length > 0) def.ev = encodeEvenements(this.evs)
    return def
  }
}

// ---- Le lecteur : la silhouette à l'instant t ---------------------------------

export class LecteurFantome {
  readonly pts: EchantillonFantome[]
  readonly evenements: EvenementFantome[]
  readonly duree: number
  // les distances au sas, calculées à la demande pour l'écart de temps
  private sasCle = ''
  private distMin: Float32Array | null = null

  constructor(readonly def: FantomeDef) {
    this.pts = decodeEchantillons(def.donnees, def.n, def.v)
    this.evenements = decodeEvenements(def.ev)
    this.duree = Math.max(0, this.pts.length - 1) * def.cadence
  }

  /** Le corps du fantôme à l'instant t (temps simulé du tableau), interpolé
   *  entre deux échantillons. Null avant le premier et APRÈS le dernier :
   *  le fantôme a bu le sas, il n'est plus là. */
  a(t: number): EchantillonFantome | null {
    const n = this.pts.length
    if (n === 0 || t < 0 || t > this.duree) return null
    if (n === 1) return this.pts[0]
    const pos = t / this.def.cadence
    const i = Math.min(n - 2, Math.floor(pos))
    const f = Math.min(1, pos - i)
    const a = this.pts[i]
    const b = this.pts[i + 1]
    const proche = f <= 0.5 ? a : b
    const profil: number[] = []
    if (a.profil.length === SECTEURS && b.profil.length === SECTEURS) {
      for (let s = 0; s < SECTEURS; s++) profil.push(a.profil[s] + (b.profil[s] - a.profil[s]) * f)
    }
    return {
      x: a.x + (b.x - a.x) * f,
      y: a.y + (b.y - a.y) * f,
      r: a.r + (b.r - a.r) * f,
      cl: a.cl + (b.cl - a.cl) * f,
      // l'état et la poussée ne s'interpolent pas : l'échantillon le plus proche
      etat: proche.etat,
      poussee: proche.poussee,
      profil,
    }
  }

  /** Les événements survenus dans ]t0, t1] — ce que l'image doit jouer. */
  evenementsEntre(t0: number, t1: number): EvenementFantome[] {
    return this.evenements.filter((e) => e.t > t0 && e.t <= t1)
  }

  /** L'ÉCART DE TEMPS avec le fantôme, façon jeu de course : à l'instant t,
   *  je suis à `maDistance` du sas — combien de temps le fantôme a-t-il mis
   *  pour être aussi près ? Positif : je suis en retard. Null si le fantôme
   *  n'a jamais été aussi près (je suis devant tout ce qu'il a fait) — ou
   *  si la trace est vide. La distance retenue est la MEILLEURE atteinte
   *  jusqu'à chaque échantillon : un aller-retour ne compte pas deux fois. */
  ecartTemps(t: number, maDistance: number, sasX: number, sasY: number): number | null {
    const n = this.pts.length
    if (n === 0) return null
    const cle = `${sasX}|${sasY}`
    if (!this.distMin || this.sasCle !== cle) {
      this.sasCle = cle
      const d = new Float32Array(n)
      let meilleure = Infinity
      for (let i = 0; i < n; i++) {
        const p = this.pts[i]
        meilleure = Math.min(meilleure, Math.hypot(p.x - sasX, p.y - sasY))
        d[i] = meilleure
      }
      this.distMin = d
    }
    const d = this.distMin
    if (d[n - 1] > maDistance) return null
    // le premier échantillon aussi près : la suite est monotone, on cherche
    let lo = 0
    let hi = n - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (d[mid] <= maDistance) hi = mid
      else lo = mid + 1
    }
    return t - lo * this.def.cadence
  }
}

// ---- Le rangement : par salle, par record, sous budget -------------------------

export const CLE_FANTOMES = 'sujet21-fantomes-v1'
/** Le budget du rangement, en caractères du JSON écrit. Le stockage du
 *  navigateur plafonne vers 5 Mo pour tout le site, sauvegarde comprise :
 *  sans soupape, une centaine de records ferait déborder l'emplacement et
 *  l'écriture échouerait en silence. Une course de trois minutes en
 *  version 2 pèse ~60 Ko encodée : le budget en garde une vingtaine, les
 *  plus anciennes partent d'abord. Une coquille qui écrit dans un fichier
 *  peut relever la barre. */
export const BUDGET_FANTOMES = 1_500_000

export interface FantomesDeSalle {
  volume?: FantomeDef
  chrono?: FantomeDef
}

interface StockageFantomes {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
}

function litFantome(brut: unknown): FantomeDef | null {
  if (typeof brut !== 'object' || brut === null) return null
  const o = brut as Record<string, unknown>
  if ((o.v !== 1 && o.v !== 2) || typeof o.donnees !== 'string') return null
  const nombre = (v: unknown, def: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : def
  const def: FantomeDef = {
    v: o.v,
    cadence: nombre(o.cadence, CADENCE_FANTOME) || CADENCE_FANTOME,
    n: Math.max(0, Math.floor(nombre(o.n, 0))),
    litres: nombre(o.litres, 0),
    temps: nombre(o.temps, 0),
    quand: typeof o.quand === 'string' ? o.quand : '',
    nom: typeof o.nom === 'string' ? o.nom : '',
    donnees: o.donnees,
  }
  if (Array.isArray(o.ev) && o.ev.every((x) => typeof x === 'number')) def.ev = o.ev as number[]
  return def
}

export class Fantomes {
  private table: Record<string, FantomesDeSalle> = {}

  constructor(
    private readonly stockage: StockageFantomes | null,
    private readonly budget = BUDGET_FANTOMES,
  ) {
    try {
      const brut = JSON.parse(stockage?.getItem(CLE_FANTOMES) ?? '{}') as unknown
      if (typeof brut === 'object' && brut !== null) {
        for (const [code, salle] of Object.entries(brut as Record<string, unknown>)) {
          if (typeof salle !== 'object' || salle === null) continue
          const s = salle as Record<string, unknown>
          const volume = litFantome(s.volume)
          const chrono = litFantome(s.chrono)
          if (volume || chrono) {
            this.table[code] = {}
            if (volume) this.table[code].volume = volume
            if (chrono) this.table[code].chrono = chrono
          }
        }
      }
    } catch {
      this.table = {}
    }
  }

  pour(code: string): FantomesDeSalle {
    return this.table[code] ?? {}
  }

  codes(): string[] {
    return Object.keys(this.table)
  }

  /** Range un fantôme — le record est tombé, sa trace remplace l'ancienne.
   *  Puis le budget : tant que le rangement déborde, le fantôme le plus
   *  ANCIEN part (jamais celui qu'on vient de poser). */
  pose(code: string, cat: CategorieFantome, def: FantomeDef): void {
    const salle = this.table[code] ?? (this.table[code] = {})
    salle[cat] = def
    this.evince(def)
    this.sauve()
  }

  oublie(code: string): void {
    delete this.table[code]
    this.sauve()
  }

  private evince(garde: FantomeDef): void {
    for (;;) {
      if (JSON.stringify(this.table).length <= this.budget) return
      let plusVieux: { code: string; cat: CategorieFantome; quand: string } | null = null
      for (const [code, salle] of Object.entries(this.table)) {
        for (const cat of ['volume', 'chrono'] as const) {
          const f = salle[cat]
          if (!f || f === garde) continue
          if (!plusVieux || f.quand < plusVieux.quand) plusVieux = { code, cat, quand: f.quand }
        }
      }
      if (!plusVieux) return // il ne reste que celui qu'on garde : tant pis pour le budget
      const salle = this.table[plusVieux.code]
      delete salle[plusVieux.cat]
      if (!salle.volume && !salle.chrono) delete this.table[plusVieux.code]
    }
  }

  private sauve(): void {
    try {
      this.stockage?.setItem(CLE_FANTOMES, JSON.stringify(this.table))
    } catch {
      // stockage refusé : les fantômes tiennent la session
    }
  }
}
