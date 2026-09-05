// LE FANTÔME : la trace d'une course, rejouée en silhouette dans la salle.
//
// Ce n'est PAS un rejeu des entrées. La simulation n'a aucun aléa, mais le
// solveur appelle des fonctions (puissance, exponentielle, sinus) dont le
// dernier bit varie d'un navigateur à l'autre, et le test de parité
// JS ↔ WASM tolère déjà un écart qui grandit avec le temps — les contacts
// amplifient tout. Rejouer les entrées d'un joueur sur une autre machine
// donnerait un autre film au bout de quelques secondes. On enregistre
// donc LA TRAJECTOIRE DU CORPS, comme les jeux de course : le centre, le
// rayon, le volume et l'état, à cadence fixe de temps SIMULÉ (le time warp
// ne fausse rien, la pause suspend). Ça marche partout, et ça se partage.
//
// Un fantôme par salle et par record — le VOLUME (gros et lent) et le
// CHRONO (petit et vif) : on voit littéralement l'arbitrage du jeu incarné
// par une course d'avant. Le tout vit dans l'emplacement de sauvegarde
// (coffre), donc dans le fichier que le Steam Cloud synchronise — d'où
// l'encodage serré : huit octets par échantillon, en base64, et un budget
// global qui évince les plus anciens plutôt que de faire déborder le
// stockage du navigateur.
//
// Ce module est PUR : ni DOM, ni solveur. Le jeu lui donne des nombres,
// il rend des nombres — tout se teste.

/** Ce qu'on note d'un corps à un instant : le centre, le rayon quadratique
 *  moyen, le volume en centilitres, l'état (0 eau · 1 glace · 2 vapeur). */
export interface EchantillonFantome {
  x: number
  y: number
  r: number
  cl: number
  etat: number
}

export const ETAT_EAU = 0
export const ETAT_GLACE = 1
export const ETAT_VAPEUR = 2

/** La cadence d'échantillonnage, en secondes SIMULÉES. Dix par seconde :
 *  une silhouette interpolée à dix images par seconde se lit sans à-coup,
 *  et une course de trois minutes tient en quatorze kilo-octets. */
export const CADENCE_FANTOME = 0.1

/** Un fantôme rangé : la trace encodée, et ce qu'il faut pour l'annoncer
 *  et l'arbitrer (litres, temps, date, opérateur). */
export interface FantomeDef {
  v: 1
  cadence: number
  n: number // nombre d'échantillons
  litres: number
  temps: number
  quand: string // ISO
  nom: string // l'opérateur
  donnees: string // base64 des échantillons (8 octets chacun)
}

export type CategorieFantome = 'volume' | 'chrono'

const OCTETS = 8

// ---- L'encodage : huit octets par échantillon --------------------------------
// x, y : Int16 (unités monde, les cuves tiennent dans ±32 767) ·
// r : Uint8 au demi (0..510) · cl : Uint16 (0..65 535 cL) · etat : Uint8.

function borne(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(v)))
}

export function encodeEchantillons(pts: readonly EchantillonFantome[]): string {
  const buf = new Uint8Array(pts.length * OCTETS)
  const vue = new DataView(buf.buffer)
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const o = i * OCTETS
    vue.setInt16(o, borne(p.x, -32768, 32767))
    vue.setInt16(o + 2, borne(p.y, -32768, 32767))
    vue.setUint8(o + 4, borne(p.r / 2, 0, 255))
    vue.setUint16(o + 5, borne(p.cl, 0, 65535))
    vue.setUint8(o + 7, borne(p.etat, 0, 255))
  }
  let bin = ''
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
  return btoa(bin)
}

export function decodeEchantillons(donnees: string, n: number): EchantillonFantome[] {
  let bin: string
  try {
    bin = atob(donnees)
  } catch {
    return []
  }
  const total = Math.min(n, Math.floor(bin.length / OCTETS))
  const buf = new Uint8Array(total * OCTETS)
  for (let i = 0; i < buf.length; i++) buf[i] = bin.charCodeAt(i)
  const vue = new DataView(buf.buffer)
  const out: EchantillonFantome[] = []
  for (let i = 0; i < total; i++) {
    const o = i * OCTETS
    out.push({
      x: vue.getInt16(o),
      y: vue.getInt16(o + 2),
      r: vue.getUint8(o + 4) * 2,
      cl: vue.getUint16(o + 5),
      etat: vue.getUint8(o + 7),
    })
  }
  return out
}

// ---- L'enregistreur : une course en train de se jouer -------------------------

export class EnregistreurFantome {
  private readonly pts: EchantillonFantome[] = []
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
    this.pts.push({ ...e })
    // le cran suivant se cale sur la grille, pas sur l'instant de la note :
    // un pas en retard ne décale pas toute la trace
    this.prochain = (Math.floor(t / this.cadence + 1e-9) + 1) * this.cadence
  }

  get taille(): number {
    return this.pts.length
  }

  /** La trace close : le corps a bu le sas. */
  fin(nom: string, litres: number, temps: number, quand = new Date().toISOString()): FantomeDef {
    return {
      v: 1,
      cadence: this.cadence,
      n: this.pts.length,
      litres,
      temps,
      quand,
      nom,
      donnees: encodeEchantillons(this.pts),
    }
  }
}

// ---- Le lecteur : la silhouette à l'instant t ---------------------------------

export class LecteurFantome {
  readonly pts: EchantillonFantome[]
  readonly duree: number

  constructor(readonly def: FantomeDef) {
    this.pts = decodeEchantillons(def.donnees, def.n)
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
    return {
      x: a.x + (b.x - a.x) * f,
      y: a.y + (b.y - a.y) * f,
      r: a.r + (b.r - a.r) * f,
      cl: a.cl + (b.cl - a.cl) * f,
      // l'état ne s'interpole pas : il bascule au milieu du cran
      etat: f <= 0.5 ? a.etat : b.etat,
    }
  }
}

// ---- Le rangement : par salle, par record, sous budget -------------------------

export const CLE_FANTOMES = 'sujet21-fantomes-v1'
/** Le budget du rangement, en caractères du JSON écrit : le stockage du
 *  navigateur plafonne vers 5 Mo pour tout le jeu, l'emplacement de
 *  sauvegarde doit rester léger — un fantôme de trois minutes pèse ~19 Ko
 *  encodé, le budget en garde une grosse soixantaine. */
export const BUDGET_FANTOMES = 1_200_000

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
  if (o.v !== 1 || typeof o.donnees !== 'string') return null
  const nombre = (v: unknown, def: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : def
  return {
    v: 1,
    cadence: nombre(o.cadence, CADENCE_FANTOME) || CADENCE_FANTOME,
    n: Math.max(0, Math.floor(nombre(o.n, 0))),
    litres: nombre(o.litres, 0),
    temps: nombre(o.temps, 0),
    quand: typeof o.quand === 'string' ? o.quand : '',
    nom: typeof o.nom === 'string' ? o.nom : '',
    donnees: o.donnees,
  }
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
