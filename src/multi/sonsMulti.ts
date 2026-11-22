// LES SONS DU MULTI — ce qu'on entend quand il se passe quelque chose.
//
// Deux moitiés :
//  1. ENTENDRE (pure, testée) : on compare l'état du jeu d'une image à la
//     suivante, et on en tire ce qui vient d'arriver — le palet a tapé la
//     paroi, quelqu'un l'a avalé, un but. Rien ne voyage pour cela : l'hôte
//     et l'invité lisent chacun ce qu'ils affichent, l'un sa simulation,
//     l'autre les images reçues. Le son suit donc toujours l'image.
//  2. JOUER : un petit synthétiseur, sans un seul fichier — quelques
//     oscillateurs et du bruit filtré. Le jeu a son moteur (game/audio.ts) ;
//     on ne lui prend que ses RÉGLAGES (le son coupé ou non, le volume), pour
//     qu'un joueur qui a coupé le son du jeu ne soit pas surpris ici.

import { loadAudioPrefs } from '../game/audio'
import { PHASE_DECOMPTE, PHASE_FINI, PHASE_JEU, type Bornes, type CorpsTrame, type JeuTrame } from './trame'

/** Ce qu'on regarde du jeu, à un instant. */
export interface Instantane {
  /** L'heure, en secondes. */
  t: number
  corps: readonly CorpsTrame[]
  jeu: JeuTrame | null
  salle: Bornes
  /** Le rayon du palet (0 hors hockey). */
  rayonPalet: number
  /** Les poteaux du hockey, s'il y en a : un choc du palet près de l'un
   *  d'eux est un choc sur le métal. */
  poteaux?: readonly { x: number; y: number; rayon: number }[]
}

export type TypeSon = 'paroi' | 'choc-palet' | 'prise' | 'lancer' | 'but' | 'engagement' | 'fin' | 'ouvre' | 'ferme' | 'contact' | 'dash' | 'tic' | 'gel' | 'degel' | 'poteau'

export interface Son {
  type: TypeSon
  /** De 0 à 1 : la violence du choc, la charge du lancer. */
  force: number
  /** Où cela s'est passé, en unités monde (pour le placer à gauche ou à
   *  droite, et pour l'éclat qui l'accompagne à l'écran). */
  x: number
  y: number
  /** Cela concerne-t-il le joueur de cette machine ? (un but marqué par lui,
   *  son corps qui s'ouvre) */
  mien: boolean
}

/** Le chiffre qu'affiche le décompte pour ce qu'il en reste : 3, 2, 1 (sept
 *  dixièmes chacun). Borné à 3 : 2,1 / 0,7 donne 3,0000000000000004, et
 *  l'arrondi au-dessus affichait un « 4 » à la première image. */
export function chiffreDecompte(reste: number): number {
  return Math.max(1, Math.min(3, Math.ceil(reste / 0.7 - 1e-6)))
}

/** Le rayon du rond qu'occupent n particules (solveurMulti.ts, RAYON_ROND,
 *  pour un pas de 6,6 u). */
const rayonCorps = (compte: number): number => 0.5222 * 6.6 * Math.sqrt(Math.max(0, compte))
/** Sous ce saut de vitesse d'une image à l'autre, le palet n'a rien heurté
 *  (le frottement de la glace lui en prend bien moins). */
const SAUT_CHOC = 60
/** Deux corps qui se rapprochent moins vite que cela se touchent sans bruit. */
const APPROCHE_MIN = 40

/** Ce qui vient d'arriver entre deux instantanés. `moi` : le joueur de cette
 *  machine. Sans instantané précédent, rien (on ne sonne pas l'état trouvé
 *  en arrivant). */
export function entend(avant: Instantane | null, apres: Instantane, moi: number): Son[] {
  if (!avant) return []
  const sons: Son[] = []
  const milieu = (apres.salle.minX + apres.salle.maxX) / 2
  const milieuY = (apres.salle.minY + apres.salle.maxY) / 2
  /** Le chiffre qu'affiche le décompte : 3, 2, 1 (sept dixièmes chacun). */
  const chiffre = (j: JeuTrame): number => (j.phase === PHASE_DECOMPTE ? chiffreDecompte(j.decompte) : 0)

  // ---- les corps : s'ouvrir, se refermer, se heurter
  const n = Math.min(avant.corps.length, apres.corps.length)
  for (let j = 0; j < n; j++) {
    const a = avant.corps[j]
    const b = apres.corps[j]
    if (a.ouvert !== b.ouvert) sons.push({ type: b.ouvert ? 'ouvre' : 'ferme', force: j === moi ? 1 : 0.4, x: b.x, y: b.y, mien: j === moi })
    if (b.dash && !a.dash) sons.push({ type: 'dash', force: j === moi ? 1 : 0.6, x: b.x, y: b.y, mien: j === moi })
    if ((a.glace === true) !== (b.glace === true)) sons.push({ type: b.glace ? 'gel' : 'degel', force: j === moi ? 1 : 0.6, x: b.x, y: b.y, mien: j === moi })
  }
  if (n >= 2 && apres.t > avant.t) {
    const [a0, a1] = [avant.corps[0], avant.corps[1]]
    const [b0, b1] = [apres.corps[0], apres.corps[1]]
    const fondus = b0.ouvert && b1.ouvert
    if (!fondus && !b0.disperse && !b1.disperse) {
      const touche = rayonCorps(b0.compte) + rayonCorps(b1.compte) + 14
      const dAvant = Math.hypot(a1.x - a0.x, a1.y - a0.y)
      const dApres = Math.hypot(b1.x - b0.x, b1.y - b0.y)
      const approche = (dAvant - dApres) / (apres.t - avant.t)
      // le moment où ils ENTRENT au contact, et pas tout le temps qu'il dure
      if (dAvant > touche && dApres <= touche && approche > APPROCHE_MIN) {
        sons.push({ type: 'contact', force: Math.min(1, approche / 400), x: (b0.x + b1.x) / 2, y: (b0.y + b1.y) / 2, mien: true })
      }
    }
  }

  // ---- le hockey
  const ja = avant.jeu
  const jb = apres.jeu
  if (ja && jb) {
    const marques = jb.scores[0] + jb.scores[1] - ja.scores[0] - ja.scores[1]
    if (marques > 0) {
      sons.push({ type: jb.phase === PHASE_FINI ? 'fin' : 'but', force: 1, x: milieu, y: milieuY, mien: jb.buteur === moi })
    } else if (jb.phase === PHASE_FINI && ja.phase !== PHASE_FINI) {
      // la fin au temps, sans but
      sons.push({ type: 'fin', force: 1, x: milieu, y: milieuY, mien: jb.buteur === moi })
    } else if (chiffre(jb) > 0 && chiffre(jb) !== chiffre(ja)) {
      sons.push({ type: 'tic', force: 1, x: milieu, y: milieuY, mien: true })
    } else if (ja.phase !== PHASE_JEU && jb.phase === PHASE_JEU) {
      sons.push({ type: 'engagement', force: 1, x: milieu, y: milieuY, mien: true })
    } else if (ja.tenuPar < 0 && jb.tenuPar >= 0) {
      sons.push({ type: 'prise', force: 1, x: jb.paletX, y: jb.paletY, mien: jb.tenuPar === moi })
    } else if (ja.tenuPar >= 0 && jb.tenuPar < 0 && jb.paletActif) {
      const vitesse = Math.hypot(jb.paletVx, jb.paletVy)
      sons.push({ type: 'lancer', force: Math.min(1, vitesse / 1500), x: jb.paletX, y: jb.paletY, mien: ja.tenuPar === moi })
    } else if (ja.paletActif && jb.paletActif && ja.tenuPar < 0 && jb.tenuPar < 0) {
      // libre avant comme après : un saut de vitesse, c'est un choc
      const saut = Math.hypot(jb.paletVx - ja.paletVx, jb.paletVy - ja.paletVy)
      if (saut > SAUT_CHOC) {
        const r = apres.rayonPalet + 60
        const s = apres.salle
        const surUnCote = (jb.paletX - s.minX < r || s.maxX - jb.paletX < r) && ja.paletVx * jb.paletVx < 0
        const surUnBord = (jb.paletY - s.minY < r || s.maxY - jb.paletY < r) && ja.paletVy * jb.paletVy < 0
        // contre un poteau (hockey) : le métal sonne
        const poteau = (apres.poteaux ?? []).some((q) => Math.hypot(jb.paletX - q.x, jb.paletY - q.y) < q.rayon + apres.rayonPalet + 40)
        if (poteau) {
          const vitesse = Math.hypot(jb.paletVx, jb.paletVy)
          sons.push({ type: 'poteau', force: Math.min(1, vitesse / 1000), x: jb.paletX, y: jb.paletY, mien: true })
        } else if (surUnCote || surUnBord) {
          const vitesse = Math.hypot(ja.paletVx, ja.paletVy)
          sons.push({ type: 'paroi', force: Math.min(1, vitesse / 1200), x: jb.paletX, y: jb.paletY, mien: true })
        } else {
          sons.push({ type: 'choc-palet', force: Math.min(1, saut / 600), x: jb.paletX, y: jb.paletY, mien: true })
        }
      }
    }
  }
  return sons
}

// ---- JOUER ------------------------------------------------------------------

/** Deux chocs du même type ne sonnent pas à moins de cela l'un de l'autre (ms). */
const ECART_CHOCS = 140

/** Les notes d'un but : la montée pour celui qui marque, la descente pour
 *  celui qui encaisse (en hertz). */
const BUT_POUR = [523.25, 659.25, 783.99]
const BUT_CONTRE = [392, 311.13, 261.63]
const FIN_POUR = [523.25, 659.25, 783.99, 1046.5]
const FIN_CONTRE = [392, 349.23, 311.13, 233.08]

export class SonsMulti {
  private ctx: AudioContext | null = null
  private maitre: GainNode | null = null
  private bruit: AudioBuffer | null = null
  // les deux sons CONTINUS : le jet (du bruit filtré) et la charge du
  // lancer (une note qui monte tant qu'on tient le palet)
  private jetGain: GainNode | null = null
  private chargeGain: GainNode | null = null
  private chargeOsc: OscillatorNode | null = null
  /** Les sons joués depuis l'ouverture, par type : la sonde d'essai les lit
   *  (un essai automatique n'a pas d'oreilles). */
  readonly joues: Partial<Record<TypeSon, number>> = {}
  /** L'heure du dernier choc joué, par type (ms). */
  private readonly derniers: Partial<Record<TypeSon, number>> = {}

  /** Le navigateur ne laisse sonner qu'après un geste : à appeler sur un
   *  clic, une touche, un bouton de manette. Sans danger à répétition. */
  reveille(): void {
    if (typeof AudioContext === 'undefined') return
    try {
      if (!this.ctx) this.monte()
      if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
    } catch {
      // pas d'audio sur cette machine : le multi se joue aussi en silence
      this.ctx = null
    }
  }

  private monte(): void {
    const ctx = new AudioContext()
    const prefs = loadAudioPrefs()
    const maitre = ctx.createGain()
    maitre.gain.value = prefs.on ? prefs.volume : 0
    maitre.connect(ctx.destination)
    // une seconde de bruit blanc, rejouée en boucle
    const bruit = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const d = bruit.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    // le jet
    const source = ctx.createBufferSource()
    source.buffer = bruit
    source.loop = true
    const filtre = ctx.createBiquadFilter()
    filtre.type = 'bandpass'
    filtre.frequency.value = 1500
    filtre.Q.value = 0.7
    const jetGain = ctx.createGain()
    jetGain.gain.value = 0
    source.connect(filtre).connect(jetGain).connect(maitre)
    source.start()
    // la charge
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 180
    const chargeGain = ctx.createGain()
    chargeGain.gain.value = 0
    osc.connect(chargeGain).connect(maitre)
    osc.start()
    this.ctx = ctx
    this.maitre = maitre
    this.bruit = bruit
    this.jetGain = jetGain
    this.chargeGain = chargeGain
    this.chargeOsc = osc
  }

  /** Les sons continus. `jet` : de 0 à 1 (le sien plein, celui de l'autre
   *  en retrait) ; `charge` : de 0 à 1 tant qu'on tient le palet, −1 sinon. */
  continu(jet: number, charge: number): void {
    const ctx = this.ctx
    if (!ctx || !this.jetGain || !this.chargeGain || !this.chargeOsc) return
    const t = ctx.currentTime
    this.jetGain.gain.setTargetAtTime(Math.max(0, Math.min(1, jet)) * 0.11, t, 0.05)
    this.chargeGain.gain.setTargetAtTime(charge >= 0 ? 0.035 + 0.045 * charge : 0, t, 0.04)
    if (charge >= 0) this.chargeOsc.frequency.setTargetAtTime(180 + 380 * charge, t, 0.05)
  }

  /** Joue un son. `pan` : de −1 (à gauche de l'écran) à 1. Rend false si
   *  le son est TU : un choc qui suit de trop près le précédent du même
   *  type. Le palet pris entre deux corps à l'engagement cognait à chaque
   *  image — quinze chocs comptés en quelques secondes, à l'essai. */
  joue(son: Son, pan = 0, maintenant = typeof performance !== 'undefined' ? performance.now() : 0): boolean {
    if (son.type === 'choc-palet' || son.type === 'paroi' || son.type === 'contact' || son.type === 'poteau') {
      const dernier = this.derniers[son.type] ?? -Infinity
      if (maintenant - dernier < ECART_CHOCS) return false
      this.derniers[son.type] = maintenant
    }
    this.jouerVraiment(son, pan)
    return true
  }

  private jouerVraiment(son: Son, pan: number): void {
    this.joues[son.type] = (this.joues[son.type] ?? 0) + 1
    const ctx = this.ctx
    if (!ctx || !this.maitre || ctx.state !== 'running') return
    const sortie = ctx.createStereoPanner()
    sortie.pan.value = Math.max(-1, Math.min(1, pan))
    sortie.connect(this.maitre)
    const f = Math.max(0.15, Math.min(1, son.force))
    switch (son.type) {
      case 'paroi':
        // sec et clair : le palet sur la bande
        this.note(sortie, 'triangle', 950, 480, 0.07, 0.22 * f)
        this.souffle(sortie, 2600, 0.05, 0.16 * f)
        break
      case 'poteau':
        // un tintement de métal : deux notes aiguës, presque pures, qui
        // durent un peu — on reconnaît le poteau sans le regarder
        this.note(sortie, 'sine', 1760, 1720, 0.32, 0.18 * f)
        this.note(sortie, 'sine', 2630, 2600, 0.22, 0.09 * f)
        this.note(sortie, 'triangle', 880, 860, 0.12, 0.1 * f)
        break
      case 'choc-palet':
        // mat et mouillé : le palet dans l'eau
        this.note(sortie, 'sine', 230, 85, 0.16, 0.34 * f)
        this.souffle(sortie, 650, 0.12, 0.2 * f)
        break
      case 'contact':
        // plus grave : deux corps qui se heurtent
        this.note(sortie, 'sine', 150, 58, 0.22, 0.36 * f)
        this.souffle(sortie, 380, 0.16, 0.14 * f)
        break
      case 'prise':
        // une gorgée : la note plonge puis remonte
        this.note(sortie, 'sine', 330, 130, 0.11, 0.26)
        this.note(sortie, 'sine', 130, 290, 0.12, 0.22, 0.1)
        break
      case 'lancer':
        // un souffle qui file, d'autant plus aigu que le lancer est fort
        this.note(sortie, 'triangle', 220, 420 + 520 * f, 0.16, 0.2 + 0.14 * f)
        this.souffle(sortie, 1200 + 1800 * f, 0.2, 0.2 + 0.12 * f)
        break
      case 'ouvre':
        this.note(sortie, 'sine', 420, 640, 0.09, 0.1 * f)
        break
      case 'ferme':
        this.note(sortie, 'sine', 640, 400, 0.09, 0.1 * f)
        break
      case 'engagement':
        // le « partez » : plus haut et plus long que les tics du décompte
        this.note(sortie, 'triangle', 880, 880, 0.22, 0.2)
        break
      case 'tic':
        this.note(sortie, 'triangle', 440, 440, 0.09, 0.16)
        break
      case 'dash':
        // un coup de vent
        this.note(sortie, 'sine', 170, 520, 0.16, 0.16 * f)
        this.souffle(sortie, 900, 0.22, 0.3 * f)
        break
      case 'gel':
        // un craquement de cristal : deux notes hautes qui se serrent
        this.note(sortie, 'triangle', 1500, 2300, 0.07, 0.13 * f)
        this.note(sortie, 'sine', 3100, 2500, 0.1, 0.08 * f, 0.04)
        break
      case 'degel':
        // la goutte qui retombe
        this.note(sortie, 'sine', 900, 320, 0.14, 0.11 * f)
        break
      case 'but':
        this.arpege(sortie, son.mien ? BUT_POUR : BUT_CONTRE, 0.11, 0.22)
        break
      case 'fin':
        this.arpege(sortie, son.mien ? FIN_POUR : FIN_CONTRE, 0.16, 0.24)
        break
    }
  }

  /** Une note qui glisse de `de` à `vers` hertz et s'éteint. */
  private note(sortie: AudioNode, forme: OscillatorType, de: number, vers: number, duree: number, volume: number, retard = 0): void {
    const ctx = this.ctx
    if (!ctx) return
    const t = ctx.currentTime + retard
    const osc = ctx.createOscillator()
    osc.type = forme
    osc.frequency.setValueAtTime(de, t)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, vers), t + duree)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(volume, t + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0008, t + duree)
    osc.connect(gain).connect(sortie)
    osc.start(t)
    osc.stop(t + duree + 0.03)
  }

  /** Une bouffée de bruit filtré autour de `frequence`. */
  private souffle(sortie: AudioNode, frequence: number, duree: number, volume: number): void {
    const ctx = this.ctx
    if (!ctx || !this.bruit) return
    const t = ctx.currentTime
    const source = ctx.createBufferSource()
    source.buffer = this.bruit
    const filtre = ctx.createBiquadFilter()
    filtre.type = 'bandpass'
    filtre.frequency.value = frequence
    filtre.Q.value = 1.2
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(volume, t)
    gain.gain.exponentialRampToValueAtTime(0.0008, t + duree)
    source.connect(filtre).connect(gain).connect(sortie)
    source.start(t, Math.random() * 0.5)
    source.stop(t + duree + 0.03)
  }

  private arpege(sortie: AudioNode, notes: readonly number[], pas: number, volume: number): void {
    notes.forEach((hz, i) => this.note(sortie, 'triangle', hz, hz, i === notes.length - 1 ? pas * 3 : pas * 1.4, volume, i * pas))
  }

  /** Tout se tait (on quitte la partie) : les sons continus retombent. */
  silence(): void {
    this.continu(0, -1)
  }

  /** On quitte le multi : le contexte audio est rendu. */
  ferme(): void {
    const ctx = this.ctx
    this.ctx = null
    this.maitre = null
    this.jetGain = null
    this.chargeGain = null
    this.chargeOsc = null
    this.bruit = null
    if (ctx) void ctx.close().catch(() => undefined)
  }
}
