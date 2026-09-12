// LA VIE VISIBLE DU SUJET — les MOTES en suspension dans le corps, et la
// LUEUR des gouttes qu'il perd (docs/sujet-vivant.md, pistes G1 et G6).
//
// Rendu seulement : rien ici ne touche à la simulation ni à ses présets.
// Les motes sont PORTÉES par les gouttes du corps — chacune s'accroche à
// une goutte hôte et la suit : l'advection par le fluide vient gratuitement,
// et une mote ne peut pas quitter le corps autrement qu'en étant éjectée
// avec sa goutte (elle se raccroche alors ailleurs). La lueur d'une goutte
// perdue se lit dans ce que le solveur sait déjà d'elle : son délai de
// réabsorption (fraîchement partie, elle brille ; il expire, elle s'éteint)
// et sa marque « du corps » (dans le halo de rappel, elle reviendra : une
// braise reste ; au-delà, plus rien — elle est devenue de l'eau).
//
// Pourquoi des motes : le module s'appelle Méduse, et une méduse est un
// être sans visage dont on VOIT l'intérieur. Un cœur uniforme ne dit rien ;
// des grains qui se resserrent autour du regard quand il a peur, qui
// s'étalent au calme et se figent dans la glace disent quelqu'un.

/** Une goutte hôte possible : les tableaux du solveur, lus tels quels. */
export type Hotes = {
  count: number
  posX: Float32Array
  posY: Float32Array
  kind: Uint8Array // 1 : du corps (KIND_PLAYER)
  frozen: Uint8Array
  gaseous: Uint8Array
}

/** L'humeur du Sujet, image par image, calculée par le jeu. */
export type Humeur = {
  regardX: number // le point du regard (monde) : c'est là qu'on se serre
  regardY: number
  rassemble: number // 0..1 : les motes se resserrent autour du regard
  agite: number // 0..1 : la nervosité du frétillement
  dispersed: boolean // le corps est défait : tout s'éparpille et s'éteint
  sommeil?: number // 0..1 : endormi, les grains s'immobilisent presque
}

/** Un point de vie envoyé au rendu : position, rayon monde, genre, alpha. */
export const VIE_STRIDE = 5
export const GENRE_MOTE = 0
export const GENRE_LUEUR = 1

const KIND_PLAYER = 1

/** Les motes : quelques dizaines de grains, chacun sur une goutte hôte. */
export class Motes {
  readonly n: number
  readonly x: Float32Array
  readonly y: Float32Array
  readonly alpha: Float32Array
  readonly rayon: Float32Array
  private readonly hote: Int32Array
  private readonly phase: Float32Array
  // LE TRAJET : chaque mote a sa propre dérive autour de son hôte — un cap
  // qui tourne au gré d'une courbure qui se promène, une allure qui enfle
  // et retombe, un rayon de vagabondage à elle. Le premier jet tournait en
  // rond (un cosinus, un sinus) : ça se voyait, c'était une horloge. Ici,
  // aucune mote ne suit le même chemin deux fois.
  private readonly ox: Float32Array // l'écart à l'hôte
  private readonly oy: Float32Array
  private readonly cap: Float32Array // la direction du trajet (rad)
  private readonly courbure: Float32Array // la vitesse de rotation du cap
  private readonly allure: Float32Array // l'allure de base (u/s)
  private readonly rayonErrance: Float32Array // jusqu'où elle s'écarte
  // l'instant où la mote changera d'hôte d'elle-même : elle circule dans
  // le corps au lieu de rester rivée à la même goutte toute la run
  private readonly releve: Float32Array
  private t = 0

  constructor(n = 44, rand: () => number = Math.random) {
    this.n = n
    this.x = new Float32Array(n)
    this.y = new Float32Array(n)
    this.alpha = new Float32Array(n)
    this.rayon = new Float32Array(n)
    this.hote = new Int32Array(n).fill(-1)
    this.phase = new Float32Array(n)
    this.releve = new Float32Array(n)
    this.ox = new Float32Array(n)
    this.oy = new Float32Array(n)
    this.cap = new Float32Array(n)
    this.courbure = new Float32Array(n)
    this.allure = new Float32Array(n)
    this.rayonErrance = new Float32Array(n)
    for (let m = 0; m < n; m++) {
      this.phase[m] = rand() * 6.2832
      // trois tailles : la plupart petites, quelques-unes plus grosses
      this.rayon[m] = 1.6 + rand() * rand() * 3.2
      this.releve[m] = rand() * 8
      this.cap[m] = rand() * 6.2832
      this.allure[m] = 4 + rand() * 8
      this.rayonErrance[m] = 6 + rand() * 10
    }
  }

  /** Tout oublier (nouveau tableau) : les motes renaîtront sur le corps. */
  reset(): void {
    this.hote.fill(-1)
    this.alpha.fill(0)
  }

  /**
   * Une image de vie. `rand` est injectable pour les tests.
   * Une mote sans hôte valide (goutte éjectée, index recyclé par le
   * solveur, corps défait) se raccroche à une goutte du corps tirée au
   * sort — et renaît en fondu, jamais d'un coup.
   */
  update(dt: number, h: Hotes, hu: Humeur, rand: () => number = Math.random): void {
    this.t += dt
    const kIn = 1 - Math.exp(-3.0 * dt)
    for (let m = 0; m < this.n; m++) {
      if (hu.dispersed) {
        // le corps se défait : chaque grain dérive et s'éteint
        this.alpha[m] = Math.max(0, this.alpha[m] - dt / 1.4)
        this.x[m] += Math.cos(this.phase[m]) * 18 * dt
        this.y[m] += Math.sin(this.phase[m]) * 18 * dt
        this.hote[m] = -1
        continue
      }
      let i = this.hote[m]
      // l'hôte reste-t-il une goutte du corps, à portée ? (le solveur
      // recycle les index : une goutte disparue peut en devenir une autre,
      // à l'autre bout de la salle — le saut le trahit)
      const valide =
        i >= 0 &&
        i < h.count &&
        h.kind[i] === KIND_PLAYER &&
        Math.abs(h.posX[i] - this.x[m]) < 90 &&
        Math.abs(h.posY[i] - this.y[m]) < 90
      if (!valide || this.t >= this.releve[m]) {
        i = this.choisitHote(h, rand)
        this.hote[m] = i
        // une relève volontaire garde sa lueur ; une perte renaît en fondu
        if (!valide) this.alpha[m] = 0
        this.releve[m] = this.t + 6 + rand() * 10
        if (i < 0) continue
        if (!valide) {
          this.x[m] = h.posX[i]
          this.y[m] = h.posY[i]
        }
      }
      const gele = h.frozen[i] === 1
      const gaz = h.gaseous[i] === 1
      const sommeil = hu.sommeil ?? 0
      // LA DÉRIVE : la courbure du cap se promène (une marche au hasard
      // rappelée vers zéro : des virages, puis des lignes, puis des
      // virages), l'allure enfle et retombe lentement, et un rappel doux
      // ramène la mote quand elle s'écarte trop de son hôte — figée dans
      // la glace, élargie et plus vive dans la vapeur, presque immobile
      // dans le sommeil
      if (!gele) {
        this.courbure[m] += (rand() - 0.5) * 9 * dt
        this.courbure[m] *= Math.exp(-0.9 * dt)
        this.cap[m] += this.courbure[m] * dt * (1 + 1.5 * hu.agite)
        this.phase[m] += dt * 0.6
        const souffle = 0.55 + 0.45 * Math.sin(this.phase[m])
        const v =
          this.allure[m] *
          souffle *
          (1 + 1.6 * hu.agite) *
          (gaz ? 2.4 : 1) *
          (1 - 0.92 * sommeil)
        this.ox[m] += Math.cos(this.cap[m]) * v * dt
        this.oy[m] += Math.sin(this.cap[m]) * v * dt
        const R = this.rayonErrance[m] * (gaz ? 2.5 : 1)
        const r = Math.hypot(this.ox[m], this.oy[m])
        if (r > R) {
          // trop loin : le cap se retourne vers l'hôte, en douceur
          const versHote = Math.atan2(-this.oy[m], -this.ox[m])
          let ecart = versHote - this.cap[m]
          ecart = Math.atan2(Math.sin(ecart), Math.cos(ecart))
          this.cap[m] += ecart * Math.min(1, 4 * dt)
          const rappel = Math.min(1, ((r - R) / R) * 3 * dt)
          this.ox[m] -= this.ox[m] * rappel
          this.oy[m] -= this.oy[m] * rappel
        }
      }
      let tx = h.posX[i] + this.ox[m]
      let ty = h.posY[i] + this.oy[m]
      // le rassemblement : sous la peur, les grains se serrent vers le
      // regard — sans jamais le rejoindre tout à fait (un banc, pas un tas)
      if (hu.rassemble > 0.001 && !gele) {
        tx += (hu.regardX - tx) * 0.62 * hu.rassemble
        ty += (hu.regardY - ty) * 0.62 * hu.rassemble
      }
      // la mote traîne un peu derrière sa goutte : la lecture d'un grain en
      // suspension, pas d'un point collé au fluide
      const k = 1 - Math.exp(-(gele ? 14 : 5.5) * dt)
      this.x[m] += (tx - this.x[m]) * k
      this.y[m] += (ty - this.y[m]) * k
      const cible = gele ? 0.55 : gaz ? 0.7 : 1
      this.alpha[m] += (cible - this.alpha[m]) * kIn
    }
  }

  private choisitHote(h: Hotes, rand: () => number): number {
    if (h.count <= 0) return -1
    for (let essai = 0; essai < 12; essai++) {
      const i = Math.floor(rand() * h.count)
      if (h.kind[i] === KIND_PLAYER) return i
    }
    // un corps réduit à quelques gouttes parmi l'eau libre de la salle :
    // les tirages manquent — on prend la première goutte du corps à partir
    // d'un point tiré au sort, sinon les motes s'éteignaient quand il est
    // petit, précisément quand on a besoin de les voir
    const depart = Math.floor(rand() * h.count)
    for (let k = 0; k < h.count; k++) {
      const i = (depart + k) % h.count
      if (h.kind[i] === KIND_PLAYER) return i
    }
    return -1
  }
}

/**
 * La lueur d'une goutte détachée du corps, 0..1.
 * `cooldown` : le délai de réabsorption restant (s) ; `cooldownMax` : sa
 * valeur au départ ; `duCorps` : la marque du solveur — 0 elle n'a jamais
 * été lui (ou l'est encore), 1 détachée hors du halo, 2 détachée mais
 * dans le halo de rappel (elle reviendra).
 */
export function lueurGoutte(
  cooldown: number,
  cooldownMax: number,
  duCorps: number,
): number {
  if (duCorps === 0) return 0
  const fraiche =
    cooldownMax > 0 ? Math.min(1, Math.max(0, cooldown / cooldownMax)) : 0
  // fraîchement partie, elle brille encore de sa lumière ; le délai
  // expiré, il reste une braise tant qu'elle est à portée du rappel
  const braise = duCorps === 2 ? 0.3 : 0
  return Math.max(braise, fraiche * fraiche)
}

/**
 * Remplit le tampon de points de vie pour le rendu : les motes d'abord,
 * puis une lueur par goutte détachée. Rend le nombre de points écrits.
 */
export function remplitVie(
  out: Float32Array,
  motes: Motes,
  h: Hotes & { cooldown: Float32Array; duCorps: Uint8Array },
  cooldownMax: number,
): number {
  let n = 0
  const cap = Math.floor(out.length / VIE_STRIDE)
  for (let m = 0; m < motes.n && n < cap; m++) {
    if (motes.alpha[m] <= 0.01) continue
    const o = n * VIE_STRIDE
    out[o] = motes.x[m]
    out[o + 1] = motes.y[m]
    out[o + 2] = motes.rayon[m]
    out[o + 3] = GENRE_MOTE
    out[o + 4] = motes.alpha[m]
    n++
  }
  for (let i = 0; i < h.count && n < cap; i++) {
    if (h.kind[i] === KIND_PLAYER) continue
    const a = lueurGoutte(h.cooldown[i], cooldownMax, h.duCorps[i])
    if (a <= 0.01) continue
    const o = n * VIE_STRIDE
    out[o] = h.posX[i]
    out[o + 1] = h.posY[i]
    out[o + 2] = 5.5
    out[o + 3] = GENRE_LUEUR
    out[o + 4] = a
    n++
  }
  return n
}
