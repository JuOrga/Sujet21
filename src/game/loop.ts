// Boucle à pas de temps fixe. Le time warp ne modifie jamais le pas physique,
// seulement le nombre de pas consommés par seconde réelle (§11).

export class FixedLoop {
  private accumulator = 0
  private readonly maxStepsPerFrame: number

  // Le plafond n'est qu'un garde-fou grossier : le vrai frein anti-spirale
  // est budgetMs (le temps CPU réellement dépensé). Il doit rester assez haut
  // pour que le time warp s'exprime — à 60 images/s, ×6 demande 12 pas par
  // image ; un plafond à 6 muselait l'accélération en silence.
  constructor(maxStepsPerFrame = 24) {
    this.maxStepsPerFrame = maxStepsPerFrame
  }

  // Appelle stepFn une fois par pas physique dû. Retourne le nombre de pas.
  // budgetMs borne le TEMPS CPU consacré aux pas dans cette image : dès
  // qu'un pas dépasse le budget, on arrête (au moins un pas passe toujours).
  // C'est le frein anti-spirale : sans lui, une image en retard impose plus
  // de pas, donc coûte plus cher, donc prend plus de retard — et la machine
  // s'installe à 15-20 fps alors qu'elle en vaut 60. Avec lui, le jeu passe
  // en léger ralenti le temps que la machine respire, puis rattrape.
  // maxSteps peut resserrer le plafond POUR CETTE IMAGE : le régime de
  // croisière de la cadence visée, sans rafale de rattrapage. Mesuré sur
  // Pixel 8 Pro (rapport v3) : après une image accrochée à 25 ms, le
  // rattrapage exécutait 3 pas au lieu de 2 (~13 ms de physique) — l'image
  // suivante ratait donc AUSSI son rendez-vous. Chaque accroc système se
  // payait deux ou trois fois. Mieux vaut perdre 8 ms de temps simulé
  // (invisible) qu'une image de plus.
  advance(
    frameDtReal: number,
    timeWarp: number,
    dtFixed: number,
    stepFn: () => void,
    budgetMs = Infinity,
    maxSteps = this.maxStepsPerFrame,
  ): number {
    this.accumulator += frameDtReal * timeWarp
    let steps = 0
    const plafond = Math.min(maxSteps, this.maxStepsPerFrame)
    const t0 = performance.now()
    while (this.accumulator >= dtFixed && steps < plafond) {
      stepFn()
      this.accumulator -= dtFixed
      steps++
      if (performance.now() - t0 > budgetMs) break
    }
    if (this.accumulator >= dtFixed) this.accumulator = 0 // le retard non payé est abandonné
    return steps
  }

  reset(): void {
    this.accumulator = 0
  }
}
