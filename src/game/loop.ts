// Boucle à pas de temps fixe. Le time warp ne modifie jamais le pas physique,
// seulement le nombre de pas consommés par seconde réelle (§11).

export class FixedLoop {
  private accumulator = 0
  private readonly maxStepsPerFrame: number

  constructor(maxStepsPerFrame = 24) {
    this.maxStepsPerFrame = maxStepsPerFrame
  }

  // Appelle stepFn une fois par pas physique dû. Retourne le nombre de pas.
  advance(frameDtReal: number, timeWarp: number, dtFixed: number, stepFn: () => void): number {
    this.accumulator += frameDtReal * timeWarp
    let steps = 0
    while (this.accumulator >= dtFixed && steps < this.maxStepsPerFrame) {
      stepFn()
      this.accumulator -= dtFixed
      steps++
    }
    if (steps >= this.maxStepsPerFrame) this.accumulator = 0
    return steps
  }

  reset(): void {
    this.accumulator = 0
  }
}
