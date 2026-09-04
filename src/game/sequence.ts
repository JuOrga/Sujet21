// LES SÉQUENCES IN-MAP : la mise en scène DANS le tableau, pendant qu'on y
// joue. Là où une cinématique montre des planches par-dessus le jeu, une
// séquence agit sur le monde lui-même : les lampes virent au rouge, une
// sirène part, la paroi cède, l'écran tremble, une carte s'affiche.
//
// Une séquence est une LISTE D'ÉTAPES jouées dans l'ordre, chacune durant
// son temps propre. Le vocabulaire d'actions est FERMÉ, comme les effets de
// planches : le montage compose, il ne code pas.
//
// Ce module est PUR : il ne touche ni au DOM ni au solveur. Il dit ce qui
// doit être vrai à l'instant t (teinte des lampes, secousse, carte) et
// signale les actions ponctuelles par des rappels. Le jeu applique.

export type ActionSeq =
  | 'attendre'
  | 'lampes'
  | 'bruitage'
  | 'ponctuation'
  | 'piste'
  | 'breche'
  | 'carte'
  | 'secousse'
  | 'cinematique'

export const ACTIONS: ActionSeq[] = [
  'attendre',
  'lampes',
  'bruitage',
  'ponctuation',
  'piste',
  'breche',
  'carte',
  'secousse',
  'cinematique',
]

export const ACTION_NOMS: Record<ActionSeq, string> = {
  attendre: 'Attendre (ne rien faire)',
  lampes: 'Teinter les lampes',
  bruitage: 'Bruitage',
  ponctuation: 'Ponctuation musicale',
  piste: 'Changer la musique',
  breche: 'Ouvrir une porte (la brèche)',
  carte: 'Afficher une carte',
  secousse: "Secouer l'écran",
  cinematique: 'Jouer une cinématique',
}

/** À quoi sert le champ TEXTE selon l'action — l'éditeur s'en sert pour
 *  n'afficher que ce qui compte. */
export function champTexte(a: ActionSeq): 'aucun' | 'couleur' | 'bruitage' | 'ponctuation' | 'piste' | 'libre' | 'code' {
  switch (a) {
    case 'lampes':
      return 'couleur'
    case 'bruitage':
      return 'bruitage'
    case 'ponctuation':
      return 'ponctuation'
    case 'piste':
      return 'piste'
    case 'carte':
      return 'libre'
    case 'cinematique':
      return 'code'
    default:
      return 'aucun'
  }
}

/** L'action se sert-elle du nombre ? (intensité des lampes, n° de porte) */
export function champValeur(a: ActionSeq): boolean {
  return a === 'lampes' || a === 'breche'
}

export interface EtapeSeq {
  action: ActionSeq
  texte: string // couleur, nom de son, texte de carte, code de cinématique
  valeur: number // intensité des lampes (×100) ou indice de porte
  duree: number // secondes avant l'étape suivante
}

export interface SequenceDef {
  code: string
  titre: string
  etapes: EtapeSeq[]
}

export const DUREE_MIN = 0
export const DUREE_MAX = 60

export function etapeVierge(): EtapeSeq {
  return { action: 'attendre', texte: '', valeur: 100, duree: 1 }
}

// ---- L'ÉTAT VIVANT : ce que le jeu doit appliquer à l'instant présent.

export interface EtatVivant {
  /** Teinte imposée aux lampes, ou null : elles gardent la leur. */
  teinte: string | null
  /** Facteur d'intensité des lampes (1 = inchangé). */
  gain: number
  /** Portes forcées ouvertes (indices) — la brèche, une fois ouverte, le
   *  reste : c'est un événement, pas un interrupteur. */
  brechesOuvertes: Set<number>
  /** L'écran tremble-t-il en ce moment ? */
  secousse: boolean
  /** La carte affichée, ou '' : aucune. */
  carte: string
}

export function etatVivantNeutre(): EtatVivant {
  return { teinte: null, gain: 1, brechesOuvertes: new Set(), secousse: false, carte: '' }
}

/** Les actions ponctuelles que le jeu exécute (sons, cinématique). */
export interface EchoSeq {
  bruitage(nom: string): void
  ponctuation(nom: string): void
  piste(nom: string): void
  /** Joue une cinématique ; la séquence ATTEND sa fin. */
  cinematique(code: string): Promise<void>
}

/**
 * Le séquenceur : avance dans les étapes au rythme du temps de jeu, tient
 * l'état vivant à jour, et déclenche les actions ponctuelles. Une seule
 * séquence à la fois — la suivante remplace la précédente (mais les
 * brèches déjà ouvertes le restent : on ne referme pas une paroi crevée).
 */
export class Sequenceur {
  private etapes: EtapeSeq[] = []
  private index = -1
  private reste = 0
  private attenteCine = false
  readonly etat: EtatVivant = etatVivantNeutre()

  constructor(private readonly echo: EchoSeq) {}

  get actif(): boolean {
    return this.index >= 0 && this.index < this.etapes.length
  }

  /** Remet tout à neuf — un tableau qui recommence repart vierge. */
  reinitialise(): void {
    this.etapes = []
    this.index = -1
    this.reste = 0
    this.attenteCine = false
    this.etat.teinte = null
    this.etat.gain = 1
    this.etat.brechesOuvertes.clear()
    this.etat.secousse = false
    this.etat.carte = ''
  }

  demarre(seq: SequenceDef): void {
    this.etapes = seq.etapes
    this.index = -1
    this.reste = 0
    this.attenteCine = false
    this.entreEtape()
  }

  /** Avance du temps écoulé (secondes de JEU : une pause ne la fait pas
   *  courir). */
  avance(dt: number): void {
    if (!this.actif || this.attenteCine) return
    this.reste -= dt
    // une étape de durée nulle enchaîne dans la même image
    let garde = 0
    while (this.actif && !this.attenteCine && this.reste <= 0 && garde++ < 64) {
      const debord = this.reste
      this.entreEtape()
      if (this.actif && !this.attenteCine) this.reste += debord
    }
  }

  /** Passe à l'étape suivante et applique son action. */
  private entreEtape(): void {
    // ce qui ne dure QUE le temps d'une étape s'éteint en la quittant
    this.etat.secousse = false
    this.etat.carte = ''
    this.index++
    if (!this.actif) return
    const e = this.etapes[this.index]
    this.reste = Math.max(0, e.duree)
    switch (e.action) {
      case 'lampes':
        // couleur vide : les lampes retrouvent la leur
        this.etat.teinte = e.texte.trim() || null
        this.etat.gain = Math.max(0, e.valeur) / 100
        break
      case 'bruitage':
        if (e.texte) this.echo.bruitage(e.texte)
        break
      case 'ponctuation':
        if (e.texte) this.echo.ponctuation(e.texte)
        break
      case 'piste':
        if (e.texte) this.echo.piste(e.texte)
        break
      case 'breche':
        this.etat.brechesOuvertes.add(Math.max(0, Math.round(e.valeur)))
        break
      case 'carte':
        this.etat.carte = e.texte
        break
      case 'secousse':
        this.etat.secousse = true
        break
      case 'cinematique':
        if (e.texte) {
          this.attenteCine = true
          void this.echo.cinematique(e.texte).then(() => {
            this.attenteCine = false
          })
        }
        break
      default:
        break
    }
  }
}

// ---- IO : parse tolérant (même contrat que le reste — une étape
// corrompue est écartée, jamais la séquence entière).

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function parseEtape(o: unknown): EtapeSeq | null {
  if (typeof o !== 'object' || o === null) return null
  const raw = o as Record<string, unknown>
  const e = etapeVierge()
  const action = str(raw.action)
  if (action) {
    if ((ACTIONS as string[]).includes(action)) e.action = action as ActionSeq
    else return null // une action inconnue n'a aucun sens : l'étape saute
  }
  e.texte = str(raw.texte).slice(0, 300)
  if (typeof raw.valeur === 'number' && Number.isFinite(raw.valeur)) {
    e.valeur = Math.max(0, Math.min(400, Math.round(raw.valeur)))
  }
  if (typeof raw.duree === 'number' && Number.isFinite(raw.duree)) {
    e.duree = Math.max(DUREE_MIN, Math.min(DUREE_MAX, raw.duree))
  }
  return e
}

export function parseSequence(obj: unknown): SequenceDef | null {
  if (typeof obj !== 'object' || obj === null) return null
  const o = obj as Record<string, unknown>
  const code = str(o.code).trim().slice(0, 24)
  if (!code) return null
  const brut = Array.isArray(o.etapes) ? o.etapes : []
  const etapes: EtapeSeq[] = []
  for (const b of brut) {
    const e = parseEtape(b)
    if (e) etapes.push(e)
  }
  if (etapes.length === 0) return null
  return { code, titre: str(o.titre).trim().slice(0, 80) || code, etapes }
}

export function serializeSequence(s: SequenceDef): string {
  return JSON.stringify(s, null, 2)
}

// ---- La réserve locale : les séquences du poste.

const CLE_SEQS = 'sujet21-sequences-v1'

export function chargeSequences(): SequenceDef[] {
  try {
    const raw = localStorage.getItem(CLE_SEQS)
    if (!raw) return []
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return []
    const out: SequenceDef[] = []
    for (const e of arr) {
      const s = parseSequence(e)
      if (s) out.push(s)
    }
    return out
  } catch {
    return []
  }
}

// ---- Les séquences PUBLIÉES (magasin partagé) : elles jouent pour tout le
// monde — une cinématique partagée peut les nommer par leur code. Le poste
// prime, code par code : une séquence du poste remplace la publiée du même
// code, le temps de la retoucher, puis on publie.

let publiees: SequenceDef[] = []

export function poseSequencesPubliees(brut: unknown): SequenceDef[] {
  const liste = (brut && typeof brut === 'object' ? (brut as { sequences?: unknown }).sequences : null) ?? brut
  publiees = []
  if (Array.isArray(liste)) for (const e of liste) {
    const s = parseSequence(e)
    if (s) publiees.push(s)
  }
  return publiees
}

export function sequencesPubliees(): SequenceDef[] {
  return publiees
}

/** Les publiées, puis celles du poste — qui priment par code. */
export function fusionneSequences(publiees: SequenceDef[], locales: SequenceDef[]): SequenceDef[] {
  const codes = new Set(locales.map((s) => s.code))
  return [...publiees.filter((p) => !codes.has(p.code)), ...locales]
}

/** Les séquences JOUÉES sur ce poste. (La livrée s'ajoute en tête chez
 *  l'appelant.) */
export function sequencesJouees(): SequenceDef[] {
  return fusionneSequences(publiees, chargeSequences())
}

export function documentSequences(): { sequences: SequenceDef[] } {
  return { sequences: chargeSequences() }
}

export function sauveSequences(seqs: SequenceDef[]): void {
  try {
    localStorage.setItem(CLE_SEQS, JSON.stringify(seqs))
  } catch {
    // stockage indisponible : les séquences vivent le temps de la session
  }
}

// ---- La séquence livrée : L'ALERTE — le gabarit de l'ouverture. Le module
// bascule en rouge, la sirène part, la cuve tremble, la paroi cède.

export const SEQUENCE_ALERTE: SequenceDef = {
  code: 'ALERTE',
  titre: "Alerte — l'esquisse de la brèche",
  etapes: [
    { action: 'attendre', texte: '', valeur: 100, duree: 2 },
    { action: 'carte', texte: 'Quelque chose ne va pas.', valeur: 100, duree: 2.5 },
    { action: 'lampes', texte: '#e8433c', valeur: 130, duree: 0 },
    { action: 'ponctuation', texte: 'sting-derniere-impulsion', valeur: 100, duree: 1.5 },
    { action: 'secousse', texte: '', valeur: 100, duree: 1.2 },
    { action: 'bruitage', texte: 'impact-glace', valeur: 100, duree: 0 },
    { action: 'breche', texte: '', valeur: 0, duree: 0.5 },
    { action: 'carte', texte: 'Le confinement a cédé.', valeur: 100, duree: 3 },
    { action: 'lampes', texte: '#e8843c', valeur: 90, duree: 0 },
  ],
}
