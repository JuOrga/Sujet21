// Noyaux SPH 2D : poly6 pour la densité, gradient de spiky pour les forces.

export interface Kernels {
  h: number
  h2: number
  poly6Coeff: number
  spikyGradCoeff: number
  w(r2: number): number
}

export function makeKernels(h: number): Kernels {
  const h2 = h * h
  const poly6Coeff = 4 / (Math.PI * Math.pow(h, 8))
  const spikyGradCoeff = -30 / (Math.PI * Math.pow(h, 5))
  return {
    h,
    h2,
    poly6Coeff,
    spikyGradCoeff,
    w(r2: number): number {
      if (r2 >= h2) return 0
      const t = h2 - r2
      return poly6Coeff * t * t * t
    },
  }
}

// Densité de repos calculée numériquement sur un réseau hexagonal parfait à
// l'espacement donné : robuste aux changements de h/spacing dans le banc.
export function computeRestDensity(h: number, spacing: number): number {
  const k = makeKernels(h)
  const rowH = spacing * Math.sqrt(3) * 0.5
  const extent = Math.ceil((h * 1.5) / Math.min(spacing, rowH)) + 1
  let density = 0
  for (let row = -extent; row <= extent; row++) {
    const y = row * rowH
    const xOffset = (row & 1) !== 0 ? spacing * 0.5 : 0
    for (let col = -extent; col <= extent; col++) {
      const x = col * spacing + xOffset
      density += k.w(x * x + y * y)
    }
  }
  return density
}
