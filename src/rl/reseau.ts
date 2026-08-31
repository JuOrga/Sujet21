// ---------------------------------------------------------------------------
// LE RÉSEAU — deux couches cachées, écrites à la main, sans dépendance.
//
// Pourquoi pas une bibliothèque : le réseau dont ce jeu a besoin est minuscule
// (43 entrées, deux couches de 64, 19 sorties — 8 200 poids), et il tourne
// dans le NAVIGATEUR autant que dans l'entraînement. Charger un moteur de
// tenseurs pour ça coûterait plus cher que le calcul lui-même. Le coût du
// projet est ailleurs : dans le solveur de fluide, qui prend 99 % du temps.
//
// Ce qui manquait à la politique linéaire tient en un mot : une CONDITION.
// « Pousser SI je vais trop lentement, SINON me rassembler » ne se dit pas
// avec une pondération — il faut une non-linéarité entre les deux. C'est tout
// ce que ces tanh ajoutent, et c'est tout ce qui manquait.
//
// Convention : poids en f64, une couche = (W : sortie × entrée, b : sortie),
// activation tanh sauf la dernière (linéaire — logits ou valeur).
// ---------------------------------------------------------------------------

export class Reseau {
  readonly tailles: number[]
  readonly W: Float64Array[] = []
  readonly b: Float64Array[] = []
  /** Activations mémorisées par `avant`, relues par `arriere`. */
  private readonly a: Float64Array[] = []

  constructor(tailles: number[], rnd: () => number = Math.random, echelleFinale = 0.01) {
    this.tailles = tailles.slice()
    for (let l = 0; l + 1 < tailles.length; l++) {
      const entree = tailles[l]
      const sortie = tailles[l + 1]
      const W = new Float64Array(sortie * entree)
      // Xavier : la variance du signal traverse les couches sans enfler ni
      // s'éteindre. La DERNIÈRE couche est écrasée (×0,01) : au premier pas,
      // toutes les actions doivent être à peu près également probables —
      // une politique qui naît avec des convictions n'explore plus.
      const limite = Math.sqrt(6 / (entree + sortie))
      const echelle = l + 2 === tailles.length ? echelleFinale : 1
      for (let i = 0; i < W.length; i++) W[i] = (rnd() * 2 - 1) * limite * echelle
      this.W.push(W)
      this.b.push(new Float64Array(sortie))
    }
    for (const t of tailles) this.a.push(new Float64Array(t))
  }

  get nbCouches(): number {
    return this.W.length
  }

  /** Le nombre total de poids — ce qui se transporte entre processus. */
  get nbPoids(): number {
    let n = 0
    for (let l = 0; l < this.W.length; l++) n += this.W[l].length + this.b[l].length
    return n
  }

  /** Passe avant. Le tableau rendu est réutilisé : le recopier pour le garder. */
  avant(x: ArrayLike<number>): Float64Array {
    const a0 = this.a[0]
    for (let i = 0; i < a0.length; i++) a0[i] = x[i]
    for (let l = 0; l < this.W.length; l++) {
      const entree = this.tailles[l]
      const sortie = this.tailles[l + 1]
      const W = this.W[l]
      const b = this.b[l]
      const src = this.a[l]
      const dst = this.a[l + 1]
      const derniere = l + 1 === this.W.length
      for (let j = 0; j < sortie; j++) {
        let s = b[j]
        const base = j * entree
        for (let i = 0; i < entree; i++) s += W[base + i] * src[i]
        dst[j] = derniere ? s : Math.tanh(s)
      }
    }
    return this.a[this.W.length]
  }

  /**
   * Passe arrière, à partir du gradient sur la SORTIE. Les gradients
   * s'ACCUMULENT dans gW/gb (on somme sur le lot avant de faire un pas).
   * Suppose que `avant` vient d'être appelée sur l'exemple concerné.
   */
  arriere(dSortie: ArrayLike<number>, gW: Float64Array[], gb: Float64Array[]): void {
    let delta = Float64Array.from(dSortie)
    for (let l = this.W.length - 1; l >= 0; l--) {
      const entree = this.tailles[l]
      const sortie = this.tailles[l + 1]
      const src = this.a[l]
      const W = this.W[l]
      const gWl = gW[l]
      const gbl = gb[l]
      const suivant = l > 0 ? new Float64Array(entree) : null
      for (let j = 0; j < sortie; j++) {
        const d = delta[j]
        if (d === 0) continue
        gbl[j] += d
        const base = j * entree
        for (let i = 0; i < entree; i++) {
          gWl[base + i] += d * src[i]
          if (suivant) suivant[i] += d * W[base + i]
        }
      }
      if (suivant) {
        // dérivée de tanh : 1 − tanh², et tanh est déjà dans l'activation
        for (let i = 0; i < entree; i++) suivant[i] *= 1 - src[i] * src[i]
        delta = suivant
      }
    }
  }

  gradientsVides(): { gW: Float64Array[]; gb: Float64Array[] } {
    return {
      gW: this.W.map((w) => new Float64Array(w.length)),
      gb: this.b.map((v) => new Float64Array(v.length)),
    }
  }

  /** Tous les poids à plat — pour l'envoi aux travailleurs et la sauvegarde. */
  exporte(): number[] {
    const out: number[] = []
    for (let l = 0; l < this.W.length; l++) {
      for (const v of this.W[l]) out.push(v)
      for (const v of this.b[l]) out.push(v)
    }
    return out
  }

  importe(plat: ArrayLike<number>): void {
    let k = 0
    for (let l = 0; l < this.W.length; l++) {
      for (let i = 0; i < this.W[l].length; i++) this.W[l][i] = plat[k++]
      for (let i = 0; i < this.b[l].length; i++) this.b[l][i] = plat[k++]
    }
  }
}

/** Adam — le pas de descente qui pardonne les échelles mal réglées. */
export class Adam {
  private readonly m: Float64Array[]
  private readonly v: Float64Array[]
  private t = 0

  constructor(
    private readonly params: Float64Array[],
    public lr = 3e-4,
    private readonly beta1 = 0.9,
    private readonly beta2 = 0.999,
    private readonly eps = 1e-5,
  ) {
    this.m = params.map((p) => new Float64Array(p.length))
    this.v = params.map((p) => new Float64Array(p.length))
  }

  /**
   * Un pas. `normeMax` borne la norme globale du gradient : sans ce garde-fou,
   * un lot malheureux (une dispersion très négative) fait un bond qui détruit
   * la politique — c'est l'accident classique du PPO.
   */
  pas(grads: Float64Array[], normeMax = 0.5): void {
    let n2 = 0
    for (const g of grads) for (let i = 0; i < g.length; i++) n2 += g[i] * g[i]
    const norme = Math.sqrt(n2)
    const echelle = norme > normeMax && norme > 0 ? normeMax / norme : 1
    this.t++
    const c1 = 1 - Math.pow(this.beta1, this.t)
    const c2 = 1 - Math.pow(this.beta2, this.t)
    for (let k = 0; k < this.params.length; k++) {
      const p = this.params[k]
      const g = grads[k]
      const m = this.m[k]
      const v = this.v[k]
      for (let i = 0; i < p.length; i++) {
        const gi = g[i] * echelle
        m[i] = this.beta1 * m[i] + (1 - this.beta1) * gi
        v[i] = this.beta2 * v[i] + (1 - this.beta2) * gi * gi
        p[i] -= (this.lr * (m[i] / c1)) / (Math.sqrt(v[i] / c2) + this.eps)
      }
    }
  }
}

/** Tous les tampons de poids d'un réseau, dans l'ordre attendu par Adam. */
export function parametres(r: Reseau): Float64Array[] {
  const out: Float64Array[] = []
  for (let l = 0; l < r.nbCouches; l++) {
    out.push(r.W[l])
    out.push(r.b[l])
  }
  return out
}

export function gradientsPlats(g: {
  gW: Float64Array[]
  gb: Float64Array[]
}): Float64Array[] {
  const out: Float64Array[] = []
  for (let l = 0; l < g.gW.length; l++) {
    out.push(g.gW[l])
    out.push(g.gb[l])
  }
  return out
}

export function videGradients(g: { gW: Float64Array[]; gb: Float64Array[] }): void {
  for (const a of g.gW) a.fill(0)
  for (const a of g.gb) a.fill(0)
}

// ---- La loi de probabilité sur les actions (softmax des logits) -----------

export function logSommeExp(logits: ArrayLike<number>): number {
  let max = -Infinity
  for (let i = 0; i < logits.length; i++) if (logits[i] > max) max = logits[i]
  let s = 0
  for (let i = 0; i < logits.length; i++) s += Math.exp(logits[i] - max)
  return max + Math.log(s)
}

/** Probabilités, écrites dans `out` pour éviter une allocation par pas. */
export function probabilites(
  logits: ArrayLike<number>,
  out: Float64Array,
): Float64Array {
  const lse = logSommeExp(logits)
  for (let i = 0; i < out.length; i++) out[i] = Math.exp(logits[i] - lse)
  return out
}

/** Tirage d'une action selon la loi — l'exploration du PPO, reproductible. */
export function tire(probs: Float64Array, u: number): number {
  let cumul = 0
  for (let i = 0; i < probs.length; i++) {
    cumul += probs[i]
    if (u < cumul) return i
  }
  return probs.length - 1
}

export function entropie(probs: Float64Array): number {
  let h = 0
  for (let i = 0; i < probs.length; i++) if (probs[i] > 1e-12) h -= probs[i] * Math.log(probs[i])
  return h
}

export function argmax(v: ArrayLike<number>): number {
  let best = 0
  for (let i = 1; i < v.length; i++) if (v[i] > v[best]) best = i
  return best
}
