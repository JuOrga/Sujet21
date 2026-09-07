// LE COFFRE : les emplacements de sauvegarde du joueur.
//
// Avant lui, « le profil », c'était le navigateur : cinquante-huit clés
// éparses dans le stockage local, la progression mêlée aux réglages de
// l'appareil et aux brouillons du concepteur. Un emplacement n'existait pas
// en tant qu'objet — impossible de recommencer une partie sans perdre
// l'autre, impossible de porter sa progression sur une autre machine.
//
// Le coffre sépare TROIS natures de données, et ne prend que la première :
//   · la PROGRESSION du joueur (registres, codex, trophées, cycle, run en
//     cours, voie, prise en main…) — UN document par emplacement, ici ;
//   · les PRÉFÉRENCES de l'appareil (résolution, cadence, commandes, son) —
//     elles restent au stockage local : elles ne suivent pas le joueur ;
//   · les BROUILLONS du concepteur (éditeur, carte, scénario, textes) — de
//     même, ce ne sont pas des sauvegardes de partie.
//
// Le document d'un emplacement est fait pour être UN FICHIER : c'est ce que
// synchronise le Steam Cloud (mode Auto-Cloud : un dossier, trois fichiers)
// et ce qu'on exporte pour porter sa partie. D'où ses règles :
//   · il porte un numéro de FORMAT et se migre en chaîne — Steam peut
//     rapatrier une sauvegarde d'une version plus ancienne du jeu, et une
//     PLUS RÉCENTE (jouée ailleurs) : celle-là se lit en LECTURE SEULE, on
//     ne l'écrase jamais avec un jeu qui ne sait pas la relire ;
//   · il porte la date d'écriture et l'appareil qui a écrit : c'est ce que
//     l'écran de conflit de Steam montre au joueur ;
//   · il s'écrit EN ENTIER à chaque changement, jamais par morceaux : le dos
//     (navigateur ou hôte natif) le pose d'un bloc — l'hôte écrit un fichier
//     temporaire puis le renomme, une sauvegarde n'est jamais tronquée par
//     un plantage.
//
// Les modules de progression n'ont pas changé de contrat : ils lisent et
// écrivent des clés, comme avant, à travers la FAÇADE de l'emplacement
// actif (`coffre.stockage`). Leurs clés historiques deviennent les sections
// du document — c'est ce qui rend la migration triviale (copier les clés
// d'avant dans l'emplacement 1) et laisse chaque module lisible tel quel.
//
// Changer d'emplacement, c'est écrire le pointeur puis RECHARGER la page :
// tout l'état de main.ts se construit à l'ouverture depuis ces clés — plus
// sûr que de tenter de tout rebâtir à chaud.
//
// Ce module ne dépend de rien du jeu : le dos est injecté, la date aussi,
// et tout se teste en mémoire.

/** Ce que le coffre demande à un dos, et ce qu'il offre aux modules : les
 *  trois gestes du stockage local, rien de plus. `localStorage` en est un. */
export interface Stockage {
  getItem(cle: string): string | null
  setItem(cle: string, valeur: string): void
  removeItem(cle: string): void
}

export const NB_EMPLACEMENTS = 3
/** Le format du document. Monter d'un cran = écrire une migration dans
 *  `migreDocument`, jamais changer la lecture d'un format existant. */
export const FORMAT_COFFRE = 1

const PREFIXE = 'sujet21.coffre.'
/** L'emplacement joué sur CET appareil : un réglage de poste, pas de partie. */
export const CLE_ACTIF = `${PREFIXE}actif`
const CLE_MACHINE = `${PREFIXE}machine`
const CLE_MIGRE = `${PREFIXE}migre.v1`

export function cleEmplacement(n: number): string {
  return `${PREFIXE}${n}.v1`
}

/** Le document d'un emplacement, tel qu'il est écrit dans le dos. Les
 *  valeurs de `cles` sont les textes que les modules ont posés (du JSON
 *  pour la plupart) : le coffre ne les interprète pas, il les garde. */
export interface DocumentCoffre {
  format: number
  majAt: string // ISO de la dernière écriture
  machine: string // l'appareil qui a écrit (l'écran de conflit Steam)
  cles: Record<string, string>
}

/** Les clés d'AVANT le coffre qui sont de la progression : ce que la
 *  migration emporte dans l'emplacement 1. Tout le reste du stockage local
 *  (préférences, brouillons) reste où il est. La liste est fermée et
 *  historique : une clé neuve n'a pas à y figurer, elle naît dans le coffre. */
export const CLES_PROGRESSION: readonly string[] = [
  'projet21.registres.v1', // records, mémoire, fioles, cycle, réparations…
  'sujet21-codex', // les fiches découvertes
  'sujet21-codex-avant-deblocage', // le filet du passe-partout concepteur
  'projet21.codex.cibles.v1', // les objectifs suivis
  'sujet21-trophees',
  'sujet21-trophees-compteurs',
  'sujet21-voie-palmares-v1', // descentes, bouclées, profondeur record
  'sujet21-voie-elues-v1', // les salles générées élues (le butin)
  'sujet21-eveil-v3', // l'acte 0 joué
  'sujet21-run-v1', // la run en cours
  'projet21.tutoriel.v1', // les bulles de prise en main vues
  'sujet21-scenario-vues-v1', // les cinématiques déjà vues
  'sujet21-signature-v1', // le protocole signé
  'sujet21-condensat-v1', // l'héritage d'avant la purge (migré en mémoire)
]

/** Ce que l'écran des sauvegardes montre d'un emplacement, sans l'ouvrir. */
export interface ResumeEmplacement {
  n: number
  vide: boolean
  /** Écrit par un jeu plus récent : lisible, jamais réécrit. */
  lectureSeule: boolean
  operateur: string
  essais: number
  memoire: number
  salles: number // salles qui ont au moins un record
  fioles: number
  trophees: number
  runEnCours: boolean
  majAt: string
  machine: string
}

// ---- Le document : lecture tolérante, migration en chaîne -----------------

/** Lit un texte de document. `doc` est null si le texte n'en est pas un ;
 *  `tropRecent` dit qu'il vient d'un jeu plus neuf — ses clés sont lues
 *  (le résumé s'affiche), mais on n'y écrira pas. */
export function litDocument(texte: string | null): {
  doc: DocumentCoffre | null
  tropRecent: boolean
} {
  if (!texte) return { doc: null, tropRecent: false }
  let brut: unknown
  try {
    brut = JSON.parse(texte)
  } catch {
    return { doc: null, tropRecent: false }
  }
  if (typeof brut !== 'object' || brut === null) return { doc: null, tropRecent: false }
  const o = brut as Record<string, unknown>
  const format = typeof o.format === 'number' && Number.isInteger(o.format) ? o.format : 0
  if (format < 1) return { doc: null, tropRecent: false }
  const cles: Record<string, string> = {}
  if (typeof o.cles === 'object' && o.cles !== null) {
    for (const [k, v] of Object.entries(o.cles as Record<string, unknown>)) {
      if (typeof v === 'string') cles[k] = v
    }
  }
  const doc: DocumentCoffre = {
    format,
    majAt: typeof o.majAt === 'string' ? o.majAt : '',
    machine: typeof o.machine === 'string' ? o.machine : '',
    cles,
  }
  if (format > FORMAT_COFFRE) return { doc, tropRecent: true }
  return { doc: migreDocument(doc), tropRecent: false }
}

/** La chaîne des migrations de format : chaque cran connaît le précédent.
 *  Au format 1, rien à faire — la fonction existe pour que le cran 2 ait
 *  déjà sa place. */
export function migreDocument(doc: DocumentCoffre): DocumentCoffre {
  return doc.format >= FORMAT_COFFRE ? doc : { ...doc, format: FORMAT_COFFRE }
}

function ecritDocument(cles: Map<string, string>, majAt: string, machine: string): string {
  const doc: DocumentCoffre = {
    format: FORMAT_COFFRE,
    majAt,
    machine,
    cles: Object.fromEntries(cles),
  }
  return JSON.stringify(doc)
}

/** Le résumé d'un document — ou d'un emplacement vide. Il lit les clés des
 *  modules SANS les importer : le coffre ne doit dépendre de rien, et un
 *  résumé faux n'est jamais grave (il ne sert qu'à choisir). */
export function resumeDocument(
  n: number,
  doc: DocumentCoffre | null,
  lectureSeule = false,
): ResumeEmplacement {
  const r: ResumeEmplacement = {
    n,
    vide: !doc || Object.keys(doc.cles).length === 0,
    lectureSeule,
    operateur: '',
    essais: 0,
    memoire: 0,
    salles: 0,
    fioles: 0,
    trophees: 0,
    runEnCours: false,
    majAt: doc?.majAt ?? '',
    machine: doc?.machine ?? '',
  }
  if (!doc) return r
  const json = (cle: string): Record<string, unknown> | null => {
    const t = doc.cles[cle]
    if (!t) return null
    try {
      const v = JSON.parse(t) as unknown
      return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null
    } catch {
      return null
    }
  }
  const reg = json('projet21.registres.v1')
  if (reg) {
    r.operateur = typeof reg.operator === 'string' ? reg.operator : ''
    r.essais = typeof reg.essais === 'number' ? reg.essais : 0
    r.memoire = typeof reg.memoire === 'number' ? reg.memoire : 0
    r.salles =
      typeof reg.tableaux === 'object' && reg.tableaux !== null
        ? Object.keys(reg.tableaux as object).length
        : 0
    r.fioles = Array.isArray(reg.fioles) ? reg.fioles.length : 0
  }
  const tro = json('sujet21-trophees')
  if (tro) r.trophees = Object.keys(tro).length
  const run = json('sujet21-run-v1')
  r.runEnCours = !!run && typeof run.index === 'number' && run.index >= 1
  return r
}

// ---- L'héritage : les clés d'avant deviennent l'emplacement 1 --------------

/** Une seule fois par appareil : si aucun emplacement n'existe encore, les
 *  clés de progression d'avant le coffre sont copiées dans l'emplacement 1.
 *  Les clés d'origine restent en place CE démarrage-là (une sauvegarde
 *  qu'on aurait mal migrée se retrouverait) ; le démarrage suivant les
 *  balaie, une fois le document relu — voir balaieHeritage.
 *  Renvoie le nombre de clés emportées. */
export function migreHeritage(dos: Stockage, majAt: string, machine: string): number {
  if (dos.getItem(CLE_MIGRE) !== null) return 0
  let emportees = 0
  let dejaUnEmplacement = false
  for (let n = 1; n <= NB_EMPLACEMENTS; n++) {
    if (dos.getItem(cleEmplacement(n)) !== null) dejaUnEmplacement = true
  }
  if (!dejaUnEmplacement) {
    const cles = new Map<string, string>()
    for (const k of CLES_PROGRESSION) {
      const v = dos.getItem(k)
      if (v !== null) cles.set(k, v)
    }
    if (cles.size > 0) {
      dos.setItem(cleEmplacement(1), ecritDocument(cles, majAt, machine))
      emportees = cles.size
    }
  }
  dos.setItem(CLE_MIGRE, '1')
  return emportees
}

/** LE BALAYAGE des clés d'avant : au démarrage SUIVANT la migration, et
 *  seulement sous la preuve que l'emplacement 1 se relit (un document
 *  valide, pas un texte tronqué), les clés de progression à plat quittent
 *  le stockage — elles ne servaient plus qu'un ancien jeu, et deux copies
 *  d'une même partie finissent toujours par mentir l'une sur l'autre. Les
 *  préférences et les brouillons ne sont pas des clés de progression : ils
 *  restent. Renvoie le nombre de clés effacées. */
export function balaieHeritage(dos: Stockage): number {
  if (dos.getItem(CLE_MIGRE) === null) return 0
  const { doc } = litDocument(dos.getItem(cleEmplacement(1)))
  if (!doc) return 0
  let effacees = 0
  for (const k of CLES_PROGRESSION) {
    if (dos.getItem(k) === null) continue
    dos.removeItem(k)
    effacees++
  }
  return effacees
}

// ---- Le coffre ---------------------------------------------------------------

function borneEmplacement(v: unknown): number {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) && n >= 1 && n <= NB_EMPLACEMENTS ? n : 1
}

function idMachine(): string {
  return Math.floor(Math.random() * 36 ** 6)
    .toString(36)
    .padStart(6, '0')
}

export interface OptionsCoffre {
  /** La date d'écriture, injectable pour les tests. */
  maintenant?: () => string
  /** L'identifiant d'appareil à poser s'il n'en existe pas encore. */
  machine?: () => string
}

export class Coffre {
  /** L'emplacement joué (1..3). */
  readonly actif: number
  /** L'identifiant de cet appareil, posé une fois pour toutes. */
  readonly machine: string
  /** L'emplacement actif vient d'un jeu plus récent : on le lit, on n'y
   *  écrit pas — ses écritures sont ignorées en silence. */
  readonly lectureSeule: boolean
  /** La façade offerte aux modules de progression : le stockage de
   *  l'emplacement actif, avec les trois gestes du stockage local. */
  readonly stockage: Stockage

  private readonly cles = new Map<string, string>()
  private readonly maintenant: () => string
  // posé quand un document PLUS RÉCENT vient d'être importé dans l'actif :
  // la mémoire tient encore l'ancienne partie, une écriture l'écraserait
  private verrou = false

  constructor(
    private readonly dos: Stockage,
    options: OptionsCoffre = {},
  ) {
    this.maintenant = options.maintenant ?? (() => new Date().toISOString())
    let machine = ''
    try {
      machine = dos.getItem(CLE_MACHINE) ?? ''
      if (!machine) {
        machine = (options.machine ?? idMachine)()
        dos.setItem(CLE_MACHINE, machine)
      }
    } catch {
      machine = machine || 'inconnue'
    }
    this.machine = machine
    try {
      // la migration ce démarrage-ci, le balayage le suivant : jamais les
      // deux d'un coup — une migration ratée doit laisser ses sources
      if (migreHeritage(dos, this.maintenant(), machine) === 0) balaieHeritage(dos)
    } catch {
      // un dos qui refuse d'écrire : on jouera sans migrer, sans rien casser
    }
    let actif = 1
    try {
      actif = borneEmplacement(dos.getItem(CLE_ACTIF))
    } catch {
      actif = 1
    }
    this.actif = actif
    const { doc, tropRecent } = this.litEmplacement(actif)
    this.lectureSeule = tropRecent
    if (doc) for (const [k, v] of Object.entries(doc.cles)) this.cles.set(k, v)
    this.stockage = {
      getItem: (cle) => this.cles.get(cle) ?? null,
      setItem: (cle, valeur) => {
        this.cles.set(cle, String(valeur))
        this.persiste()
      },
      removeItem: (cle) => {
        if (this.cles.delete(cle)) this.persiste()
      },
    }
  }

  /** Le coffre du jeu : l'hôte natif s'il y en a un (la coquille Steam
   *  expose `window.sujet21Hote.coffre`, un stockage synchrone qui range
   *  chaque emplacement dans son fichier et l'écrit atomiquement), sinon le
   *  stockage local du navigateur, sinon la mémoire de la session. */
  static parDefaut(): Coffre {
    const hote = (globalThis as { sujet21Hote?: { coffre?: Stockage } }).sujet21Hote?.coffre
    if (hote && typeof hote.getItem === 'function' && typeof hote.setItem === 'function') {
      return new Coffre(hote)
    }
    try {
      if (typeof localStorage !== 'undefined') return new Coffre(localStorage)
    } catch {
      // stockage refusé (navigation privée stricte) : la session seule
    }
    return new Coffre(stockageMemoire())
  }

  private litEmplacement(n: number): { doc: DocumentCoffre | null; tropRecent: boolean } {
    try {
      return litDocument(this.dos.getItem(cleEmplacement(n)))
    } catch {
      return { doc: null, tropRecent: false }
    }
  }

  private persiste(): void {
    if (this.lectureSeule || this.verrou) return
    try {
      if (this.cles.size === 0) this.dos.removeItem(cleEmplacement(this.actif))
      else
        this.dos.setItem(
          cleEmplacement(this.actif),
          ecritDocument(this.cles, this.maintenant(), this.machine),
        )
    } catch {
      // quota ou stockage refusé : la progression tient la session, comme avant
    }
  }

  /** Le résumé d'un emplacement, l'actif lu depuis la mémoire (à jour). */
  resume(n: number): ResumeEmplacement {
    n = borneEmplacement(n)
    if (n === this.actif) {
      // les clés viennent de la mémoire (à jour), la date et la machine du
      // dos : c'est le DERNIER ÉCRIVAIN qu'on veut montrer, pas cet appareil
      const disque = this.litEmplacement(n).doc
      const doc: DocumentCoffre = {
        format: FORMAT_COFFRE,
        majAt: disque?.majAt ?? '',
        machine: disque?.machine ?? this.machine,
        cles: Object.fromEntries(this.cles),
      }
      return resumeDocument(n, this.cles.size ? doc : null, this.lectureSeule)
    }
    const { doc, tropRecent } = this.litEmplacement(n)
    return resumeDocument(n, doc, tropRecent)
  }

  resumes(): ResumeEmplacement[] {
    const out: ResumeEmplacement[] = []
    for (let n = 1; n <= NB_EMPLACEMENTS; n++) out.push(this.resume(n))
    return out
  }

  /** Désigne l'emplacement à jouer. Le coffre courant ne change pas :
   *  l'appelant recharge la page, et le prochain coffre lira celui-là. */
  choisit(n: number): void {
    try {
      this.dos.setItem(CLE_ACTIF, String(borneEmplacement(n)))
    } catch {
      // sans gravité : on rejouera l'emplacement d'avant
    }
  }

  /** Vide un emplacement — l'actif compris : sa mémoire se vide aussi, et
   *  les modules déjà chargés continuent sur du vide jusqu'au rechargement. */
  efface(n: number): void {
    n = borneEmplacement(n)
    try {
      this.dos.removeItem(cleEmplacement(n))
    } catch {
      // sans gravité
    }
    if (n === this.actif) this.cles.clear()
  }

  /** Le document d'un emplacement, tel qu'écrit — le fichier à emporter. */
  exporte(n: number): string | null {
    n = borneEmplacement(n)
    if (n === this.actif && this.cles.size > 0 && !this.lectureSeule) {
      return ecritDocument(this.cles, this.maintenant(), this.machine)
    }
    try {
      return this.dos.getItem(cleEmplacement(n))
    } catch {
      return null
    }
  }

  /** Pose un document dans un emplacement. Refuse ce qui n'en est pas un.
   *  Un document plus récent que le jeu s'importe quand même — il sera lu
   *  en lecture seule. L'emplacement actif importé demande un rechargement
   *  pour que les modules le relisent. */
  importe(n: number, texte: string): boolean {
    n = borneEmplacement(n)
    const { doc, tropRecent } = litDocument(texte)
    if (!doc) return false
    try {
      this.dos.setItem(cleEmplacement(n), texte)
    } catch {
      return false
    }
    // l'actif importé : la mémoire suit, sinon la prochaine écriture d'un
    // module reposerait l'ancien contenu par-dessus le fichier importé.
    // Un document trop récent ne monte pas en mémoire, et l'écriture se
    // VERROUILLE jusqu'au rechargement : entre l'import et le rechargement,
    // une image ou un événement peut encore écrire — un trophée, une run —
    // et reposer l'ancienne partie par-dessus le fichier importé.
    if (n === this.actif) {
      if (tropRecent) this.verrou = true
      else {
        this.cles.clear()
        for (const [k, v] of Object.entries(doc.cles)) this.cles.set(k, v)
      }
    }
    return true
  }
}

/** Un stockage en mémoire : les tests, et le repli quand tout est refusé. */
export function stockageMemoire(): Stockage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  }
}

/** LE coffre du jeu, construit à l'import : les modules de progression se
 *  branchent sur `coffre.stockage` dès leur construction. */
export const coffre = Coffre.parDefaut()
