// ---------------------------------------------------------------------------
// LA POLITIQUE ET SON APPRENTISSAGE — volontairement minuscules.
//
// La politique est LINÉAIRE : chaque action reçoit une note, somme pondérée
// de l'observation ; la meilleure note l'emporte. Pas de réseau, pas de
// gradient, pas de dépendance — de quoi voir une courbe d'apprentissage
// monter dès la première soirée, et un point de comparaison honnête le jour
// où un vrai réseau (PPO, DQN) prendra la suite.
//
// L'apprentissage est une MÉTHODE D'ENTROPIE CROISÉE (CEM) : on tire une
// population de politiques autour d'une moyenne, on ne garde que l'élite, on
// recentre la moyenne sur elle, on resserre. C'est de l'optimisation sans
// gradient : elle ne demande RIEN à l'environnement qu'un score final, donc
// elle marche même si la récompense est bruitée, éparse ou mal formée. Elle
// plafonne plus bas qu'un algorithme à gradient — c'est le prix du zéro
// dépendance.
// ---------------------------------------------------------------------------

import { NB_ACTIONS } from './env'

export interface Politique {
  tailleObs: number
  nbActions: number
  /** Poids en ligne : nbActions × (tailleObs + 1), le +1 est le biais. */
  poids: Float64Array
}

export function politiqueVide(tailleObs: number, nbActions = NB_ACTIONS): Politique {
  return {
    tailleObs,
    nbActions,
    poids: new Float64Array(nbActions * (tailleObs + 1)),
  }
}

export function nbParams(tailleObs: number, nbActions = NB_ACTIONS): number {
  return nbActions * (tailleObs + 1)
}

/** L'action la mieux notée — politique déterministe, essais reproductibles. */
export function decide(pol: Politique, obs: Float32Array): number {
  const n = pol.tailleObs
  let meilleure = 0
  let meilleurScore = -Infinity
  for (let a = 0; a < pol.nbActions; a++) {
    const base = a * (n + 1)
    let s = pol.poids[base + n] // biais
    for (let i = 0; i < n; i++) s += pol.poids[base + i] * obs[i]
    if (s > meilleurScore) {
      meilleurScore = s
      meilleure = a
    }
  }
  return meilleure
}

export function politiqueDepuis(
  tailleObs: number,
  poids: ArrayLike<number>,
  nbActions = NB_ACTIONS,
): Politique {
  const p = politiqueVide(tailleObs, nbActions)
  p.poids.set(poids)
  return p
}

// ---- Aléa reproductible : deux entraînements de même graine sont identiques.
export function alea(graine: number): () => number {
  let s = graine >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Tirage gaussien (Box-Muller) à partir d'un uniforme reproductible. */
export function gauss(rnd: () => number): number {
  let u = 0
  while (u === 0) u = rnd()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd())
}

export interface EtatCEM {
  moyenne: Float64Array
  ecart: Float64Array
}

export function cemDepart(taille: number, ecart0 = 0.5): EtatCEM {
  return {
    moyenne: new Float64Array(taille),
    ecart: new Float64Array(taille).fill(ecart0),
  }
}

export function cemEchantillon(
  etat: EtatCEM,
  rnd: () => number,
): Float64Array {
  const v = new Float64Array(etat.moyenne.length)
  for (let i = 0; i < v.length; i++) {
    v[i] = etat.moyenne[i] + etat.ecart[i] * gauss(rnd)
  }
  return v
}

/**
 * Recentre la loi sur l'élite. `bruitSup` empêche l'effondrement prématuré de
 * l'écart-type : sans lui, la population se fige sur le premier comportement
 * à peu près viable et n'explore plus.
 */
export function cemRecentre(
  etat: EtatCEM,
  elite: Float64Array[],
  bruitSup = 0,
): void {
  const n = etat.moyenne.length
  for (let i = 0; i < n; i++) {
    let m = 0
    for (const e of elite) m += e[i]
    m /= elite.length
    let v = 0
    for (const e of elite) v += (e[i] - m) * (e[i] - m)
    v /= elite.length
    etat.moyenne[i] = m
    etat.ecart[i] = Math.sqrt(v) + bruitSup
  }
}

// ---------------------------------------------------------------------------
// L'IMITATION — partir de ce qu'un humain sait déjà faire.
//
// Chercher au hasard une politique qui traverse un tableau, c'est chercher
// une aiguille : la récompense de la traversée n'arrive qu'au bout d'un
// enchaînement que le hasard ne produit presque jamais. L'usage, en
// apprentissage par renforcement, est de PARTIR d'une démonstration : on
// apprend d'abord à copier un pilote écrit à la main (régression softmax sur
// ses décisions), puis on laisse l'optimisation améliorer la copie. La courbe
// ne part plus de zéro mais du niveau du pilote — et ce qu'elle gagne
// ensuite est exactement ce que la machine a trouvé toute seule.
// ---------------------------------------------------------------------------

export interface Exemple {
  obs: Float32Array
  action: number
}

/**
 * Régression softmax (descente de gradient simple) : les poids qui
 * reproduisent au mieux les décisions du pilote. Quelques milliers
 * d'exemples, quelques centaines de passes — l'affaire d'une seconde.
 */
export function apprendParImitation(
  exemples: Exemple[],
  tailleObs: number,
  nbActions = NB_ACTIONS,
  passes = 400,
  pas = 0.5,
): { poids: Float64Array; exactitude: number } {
  const n = tailleObs
  const poids = new Float64Array(nbActions * (n + 1))
  const logits = new Float64Array(nbActions)
  for (let e = 0; e < passes; e++) {
    const grad = new Float64Array(poids.length)
    for (const ex of exemples) {
      let max = -Infinity
      for (let a = 0; a < nbActions; a++) {
        const base = a * (n + 1)
        let z = poids[base + n]
        for (let i = 0; i < n; i++) z += poids[base + i] * ex.obs[i]
        logits[a] = z
        if (z > max) max = z
      }
      let somme = 0
      for (let a = 0; a < nbActions; a++) {
        logits[a] = Math.exp(logits[a] - max)
        somme += logits[a]
      }
      for (let a = 0; a < nbActions; a++) {
        const err = logits[a] / somme - (a === ex.action ? 1 : 0)
        const base = a * (n + 1)
        for (let i = 0; i < n; i++) grad[base + i] += err * ex.obs[i]
        grad[base + n] += err
      }
    }
    const echelle = pas / exemples.length
    for (let i = 0; i < poids.length; i++) poids[i] -= echelle * grad[i]
  }
  // L'exactitude dit si la copie a pris : sous 60 %, la politique linéaire
  // n'a pas les moyens du pilote qu'on lui demande d'imiter, et partir de là
  // ne vaut pas mieux que partir de zéro.
  const pol = { tailleObs: n, nbActions, poids }
  let bons = 0
  for (const ex of exemples) if (decide(pol, ex.obs) === ex.action) bons++
  return { poids, exactitude: bons / exemples.length }
}
