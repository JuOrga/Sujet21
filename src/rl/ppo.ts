// ---------------------------------------------------------------------------
// PPO — l'algorithme qui apprend vraiment.
//
// La méthode d'entropie croisée (politique.ts) cherchait des politiques
// entières au hasard et gardait les meilleures : sans gradient, elle plafonne
// vite. PPO fait l'inverse — il regarde CHAQUE décision prise, estime si elle
// valait mieux que la moyenne (l'AVANTAGE), et pousse la politique dans ce
// sens, d'un pas borné pour ne jamais s'effondrer d'un coup (le « clip »).
//
// Trois idées, et rien de plus :
//   1. GAE — l'avantage d'une décision, estimé en mêlant la récompense reçue
//      et ce que le critique prédisait (λ règle le dosage : peu de biais d'un
//      côté, peu de variance de l'autre) ;
//   2. le rapport de vraisemblance π_nouvelle/π_ancienne, ÉCRÊTÉ à ±ε : on
//      réutilise plusieurs fois le même lot sans jamais s'éloigner beaucoup
//      de la politique qui l'a produit ;
//   3. une prime d'ENTROPIE : tant que la politique hésite, elle explore.
//
// Ce fichier ne connaît ni le jeu ni les processus : il prend un lot de
// transitions et rend un pas d'apprentissage. C'est ce qui le rend testable.
// ---------------------------------------------------------------------------

import {
  Adam,
  Reseau,
  entropie,
  gradientsPlats,
  probabilites,
  videGradients,
} from './reseau'

export interface ReglagesPPO {
  gamma: number // horizon : ce que vaut demain par rapport à aujourd'hui
  lambda: number // GAE : le dosage biais / variance
  clip: number // ε de l'écrêtage
  epoques: number // passes sur le même lot
  tailleLot: number // taille d'un mini-lot
  coefValeur: number
  coefEntropie: number
  normeMax: number // plafond de la norme du gradient
}

export const PPO_DEFAUT: ReglagesPPO = {
  gamma: 0.99,
  lambda: 0.95,
  clip: 0.2,
  epoques: 4,
  tailleLot: 256,
  coefValeur: 0.5,
  coefEntropie: 0.01,
  normeMax: 0.5,
}

/** Une transition observée, telle que les travailleurs la rapportent. */
export interface Transition {
  obs: Float32Array
  action: number
  logp: number // log π(a|s) SOUS LA POLITIQUE QUI A AGI
  valeur: number // V(s) estimée au moment d'agir
  recompense: number
  /** L'épisode s'arrête ici (le pas suivant repart d'un tableau neuf). */
  fini: boolean
}

/**
 * GAE(λ). `valeurFinale` est V(s_T) : ce que vaut la suite quand le lot se
 * termine au milieu d'un épisode — sans elle, PPO croirait que le monde
 * s'arrête à chaque fin de collecte et n'apprendrait que des fins.
 */
export function avantagesGAE(
  transitions: Transition[],
  valeurFinale: number,
  gamma: number,
  lambda: number,
): { avantages: Float64Array; retours: Float64Array } {
  const n = transitions.length
  const avantages = new Float64Array(n)
  const retours = new Float64Array(n)
  let suivantA = 0
  let suivantV = valeurFinale
  for (let t = n - 1; t >= 0; t--) {
    const tr = transitions[t]
    const continu = tr.fini ? 0 : 1
    const delta = tr.recompense + gamma * suivantV * continu - tr.valeur
    suivantA = delta + gamma * lambda * continu * suivantA
    avantages[t] = suivantA
    retours[t] = suivantA + tr.valeur
    suivantV = tr.valeur
  }
  return { avantages, retours }
}

export interface Diagnostic {
  pertePolitique: number
  perteValeur: number
  entropie: number
  klApprox: number
  fractionEcretee: number
}

/**
 * Un pas d'apprentissage sur un lot. Les avantages sont normalisés lot par
 * lot : c'est ce qui rend PPO insensible à l'échelle des récompenses — on
 * peut donc changer les poids de la récompense du jeu sans retoucher le
 * pas d'apprentissage.
 */
export function majPPO(
  politique: Reseau,
  valeur: Reseau,
  adamP: Adam,
  adamV: Adam,
  transitions: Transition[],
  avantages: Float64Array,
  retours: Float64Array,
  r: ReglagesPPO,
  rnd: () => number,
): Diagnostic {
  const n = transitions.length
  const nbActions = politique.tailles[politique.tailles.length - 1]
  const probs = new Float64Array(nbActions)
  const dLogits = new Float64Array(nbActions)
  const gP = politique.gradientsVides()
  const gV = valeur.gradientsVides()
  const platsP = gradientsPlats(gP)
  const platsV = gradientsPlats(gV)

  let moy = 0
  for (let i = 0; i < n; i++) moy += avantages[i]
  moy /= n || 1
  let variance = 0
  for (let i = 0; i < n; i++) variance += (avantages[i] - moy) ** 2
  const ecart = Math.sqrt(variance / (n || 1)) + 1e-8

  const ordre = new Int32Array(n)
  for (let i = 0; i < n; i++) ordre[i] = i
  const diag: Diagnostic = {
    pertePolitique: 0,
    perteValeur: 0,
    entropie: 0,
    klApprox: 0,
    fractionEcretee: 0,
  }
  let lots = 0

  for (let e = 0; e < r.epoques; e++) {
    // mélange de Fisher-Yates : les mini-lots ne doivent pas suivre le temps
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      const tmp = ordre[i]
      ordre[i] = ordre[j]
      ordre[j] = tmp
    }
    for (let debut = 0; debut < n; debut += r.tailleLot) {
      const fin = Math.min(n, debut + r.tailleLot)
      const taille = fin - debut
      if (taille < 2) continue
      videGradients(gP)
      videGradients(gV)
      let pertePol = 0
      let perteVal = 0
      let hMoy = 0
      let klMoy = 0
      let ecretes = 0

      for (let k = debut; k < fin; k++) {
        const i = ordre[k]
        const tr = transitions[i]
        const a = (avantages[i] - moy) / ecart

        // ---- politique
        const logits = politique.avant(tr.obs)
        probabilites(logits, probs)
        const logp = Math.log(Math.max(probs[tr.action], 1e-12))
        const ratio = Math.exp(logp - tr.logp)
        const ratioEcrete = Math.min(Math.max(ratio, 1 - r.clip), 1 + r.clip)
        const nonEcrete = ratio * a
        const ecrete = ratioEcrete * a
        const actif = nonEcrete <= ecrete // la branche que le min retient
        if (!actif) ecretes++
        pertePol += -Math.min(nonEcrete, ecrete)
        const h = entropie(probs)
        hMoy += h
        klMoy += tr.logp - logp // KL approché : positif quand on s'éloigne

        // d(perte)/d(logits) : le gradient du log-softmax, mis à l'échelle du
        // rapport — nul là où l'écrêtage a mordu (c'est tout son effet).
        const poids = actif ? -ratio * a : 0
        for (let j = 0; j < nbActions; j++) {
          const indic = j === tr.action ? 1 : 0
          // ∂(−H)/∂z_j = p_j (log p_j + H) — pousse vers l'hésitation
          const dH = probs[j] * (Math.log(Math.max(probs[j], 1e-12)) + h)
          dLogits[j] = (poids * (indic - probs[j]) + r.coefEntropie * dH) / taille
        }
        politique.arriere(dLogits, gP.gW, gP.gb)

        // ---- critique
        const v = valeur.avant(tr.obs)[0]
        const err = v - retours[i]
        perteVal += err * err
        valeur.arriere([(2 * r.coefValeur * err) / taille], gV.gW, gV.gb)
      }

      adamP.pas(platsP, r.normeMax)
      adamV.pas(platsV, r.normeMax)
      diag.pertePolitique += pertePol / taille
      diag.perteValeur += perteVal / taille
      diag.entropie += hMoy / taille
      diag.klApprox += klMoy / taille
      diag.fractionEcretee += ecretes / taille
      lots++
    }
  }
  const d = lots || 1
  diag.pertePolitique /= d
  diag.perteValeur /= d
  diag.entropie /= d
  diag.klApprox /= d
  diag.fractionEcretee /= d
  return diag
}
