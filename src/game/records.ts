// Registres du labo (§10) : le protocole consigne chaque essai. Par tableau,
// le record est le plus grand volume mis en bonbonne ; à volume égal (au
// centilitre), le temps de collecte le plus court départage. Les dispersions
// sont consignées aussi : côté labo, l'historique raconte l'expérience qui
// dérape. Persistance en localStorage, silencieuse si le stockage manque.

export interface TableauRecord {
  liters: number
  time: number // secondes simulées entre l'entrée du tableau et la collecte
  essai: number // n° de l'échantillon qui détient le record
  name: string // nom de l'opérateur au moment du record (façon borne d'arcade)
}

export interface HistoryEntry {
  no: number // n° d'échantillon au moment de l'entrée
  code: string // code du tableau (21-A…)
  won: boolean // true : échantillon collecté ; false : dispersion
  liters: number
  time: number
}

// La meilleure expédition : d'abord la distance (tableaux collectés), puis
// la réserve mise en bonbonne, puis le temps — dans cet ordre.
export interface ExpeditionRecord {
  tableaux: number
  liters: number
  time: number
  essai: number
  name: string
}

interface RecordsData {
  essais: number // essais terminés en dispersion (l'échantillon courant est essais + 1)
  operator: string // nom affiché sur les records
  tableaux: Record<string, TableauRecord>
  expedition: ExpeditionRecord | null
  history: HistoryEntry[]
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const KEY = 'projet21.registres.v1'
const HISTORY_MAX = 40

function blank(): RecordsData {
  return { essais: 0, operator: '', tableaux: {}, expedition: null, history: [] }
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export class Records {
  private data: RecordsData
  private storage: StorageLike | null

  constructor(storage: StorageLike | null = defaultStorage()) {
    this.storage = storage
    this.data = this.load()
  }

  private load(): RecordsData {
    try {
      const raw = this.storage?.getItem(KEY)
      if (raw) {
        const d = JSON.parse(raw) as RecordsData
        if (typeof d.essais === 'number' && d.tableaux && Array.isArray(d.history)) {
          if (typeof d.operator !== 'string') d.operator = '' // registres d'avant le nom
          if (d.expedition === undefined) d.expedition = null // registres d'avant la boucle
          return d
        }
      }
    } catch {
      // registre corrompu ou stockage indisponible : on repart à vide
    }
    return blank()
  }

  private save(): void {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.data))
    } catch {
      // stockage plein ou interdit : le jeu continue sans persistance
    }
  }

  /** N° de l'échantillon courant (le prochain à être consigné). */
  essaiNumber(): number {
    return this.data.essais + 1
  }

  operator(): string {
    return this.data.operator
  }

  /** Le nom estampillé sur les prochains records (borne d'arcade). */
  setOperator(name: string): void {
    this.data.operator = name.trim().toUpperCase().slice(0, 12)
    this.save()
  }

  tableauRecord(code: string): TableauRecord | null {
    return this.data.tableaux[code] ?? null
  }

  lastEntries(n: number): HistoryEntry[] {
    return this.data.history.slice(-n)
  }

  /** Sas franchi : consigne la collecte, renvoie si c'est un nouveau record. */
  noteCollection(code: string, liters: number, time: number): { newRecord: boolean } {
    const entry: HistoryEntry = {
      no: this.essaiNumber(),
      code,
      won: true,
      liters: Math.round(liters * 100) / 100,
      time: Math.round(time * 10) / 10,
    }
    this.pushHistory(entry)
    const prev = this.data.tableaux[code]
    const beats =
      !prev ||
      entry.liters > prev.liters ||
      (entry.liters === prev.liters && entry.time < prev.time)
    if (beats) {
      this.data.tableaux[code] = {
        liters: entry.liters,
        time: entry.time,
        essai: entry.no,
        name: this.data.operator,
      }
    }
    this.save()
    return { newRecord: beats }
  }

  expedition(): ExpeditionRecord | null {
    return this.data.expedition
  }

  /** Fin d'expédition (achevée ou perdue) : la meilleure est retenue. */
  noteExpedition(tableaux: number, liters: number, time: number): { newRecord: boolean } {
    if (tableaux === 0 && liters < 0.01) return { newRecord: false } // rien à consigner
    const entry: ExpeditionRecord = {
      tableaux,
      liters: Math.round(liters * 100) / 100,
      time: Math.round(time * 10) / 10,
      essai: this.essaiNumber(),
      name: this.data.operator,
    }
    const prev = this.data.expedition
    const beats =
      !prev ||
      entry.tableaux > prev.tableaux ||
      (entry.tableaux === prev.tableaux &&
        (entry.liters > prev.liters ||
          (entry.liters === prev.liters && entry.time < prev.time)))
    if (beats) {
      this.data.expedition = entry
      this.save()
    }
    return { newRecord: beats }
  }

  /** Dispersion : fin de l'échantillon, le laboratoire passe au suivant. */
  noteDispersion(code: string, time: number): void {
    this.pushHistory({
      no: this.essaiNumber(),
      code,
      won: false,
      liters: 0,
      time: Math.round(time * 10) / 10,
    })
    this.data.essais++
    this.save()
  }

  private pushHistory(entry: HistoryEntry): void {
    this.data.history.push(entry)
    if (this.data.history.length > HISTORY_MAX) this.data.history.shift()
  }

  wipe(): void {
    this.data = blank()
    try {
      this.storage?.removeItem(KEY)
    } catch {
      // rien à effacer si le stockage est indisponible
    }
  }
}
