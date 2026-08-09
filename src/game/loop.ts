// Boucle à pas de temps fixe. Le time warp ne modifie jamais le pas physique,
// seulement le nombre de pas consommés par seconde réelle (§11).

export class FixedLoop {
  private accumulator = 0
  private readonly maxStepsPerFrame: number

  // Plafond bas : sur machine lente, mieux vaut un jeu qui ralentit doucement
  // qu'une spirale de rattrapage où chaque image en retard en impose plus.
  constructor(maxStepsPerFrame = 6) {
    this.maxStepsPerFrame = maxStepsPerFrame
  }

  // Appelle stepFn une fois par pas physique dû. Retourne le nombre de pas.
  // budgetMs borne le TEMPS CPU consacré aux pas dans cette image : dès
  // qu'un pas dépasse le budget, on arrête (au moins un pas passe toujours).
  // C'est le frein anti-spirale : sans lui, une image en retard impose plus
  // de pas, donc coûte plus cher, donc prend plus de retard — et la machine
  // s'installe à 15-20 fps alors qu'elle en vaut 60. Avec lui, le jeu passe
  // en léger ralenti le temps que la machine respire, puis rattrape.
  advance(
    frameDtReal: number,
    timeWarp: number,
    dtFixed: number,
    stepFn: () => void,
    budgetMs = Infinity,
  ): number {
    this.accumulator += frameDtReal * timeWarp
    let steps = 0
    const t0 = performance.now()
    while (this.accumulator >= dtFixed && steps < this.maxStepsPerFrame) {
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
