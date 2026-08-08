// Tous les paramètres de ressenti du jeu, modifiables en direct dans le banc
// de réglage et exportables en JSON (voir doc fonctionnel §13).

export interface SimParams {
  // Intégration
  dt: number // pas de temps physique, fixe — le time warp ne le modifie jamais (§11)
  solverIterations: number

  // Solveur PBF
  kernelRadius: number // h, rayon du noyau SPH (unités monde)
  particleSpacing: number // espacement du réseau à l'initialisation
  epsilonLambda: number // relaxation CFM du multiplicateur lambda
  sCorrK: number // cohésion : intensité de la correction anti-clustering
  sCorrN: number // cohésion : exposant
  sCorrDq: number // cohésion : distance de référence, en fraction de h
  xsphC: number // viscosité XSPH
  maxDeltaPFactor: number // plafond de correction par itération, en fraction de h
  maxSpeed: number // plafond de vitesse global (stabilité)

  // Propulsion par éjection (§3.3)
  ejectRate: number // particules éjectées / seconde de maintien
  ejectSpeed: number // vitesse d'éjection relative au corps (unités monde / s)
  ejectEntrain: number // part de la vitesse d'éjection communiquée au liquide voisin du point de départ (le corps se creuse)
  reabsorbCooldown: number // délai avant qu'une gouttelette éjectée soit réabsorbable (s)

  // Vortex de regroupement (clic droit)
  vortexRadius: number // rayon d'action autour du point cliqué (unités monde)
  vortexPull: number // vitesse du courant du vortex (u/s)
  vortexSwirl: number // part giratoire du courant — rallonge la spirale de retour
  vortexDrag: number // taux d'entraînement de l'eau par le courant (1/s)
  vortexDuration: number // durée du vortex après le clic (s)
  vortexWindDown: number // fraction finale de la durée où le courant s'essouffle et dépose l'eau

  // Matériaux (§6)
  hydroBand: number // portée des effets de surface (unités monde)
  hydrophilePull: number // accélération d'adhésion vers la surface (u/s²)
  hydrophileFriction: number // amortissement tangentiel au contact (1/s)
  hydrophobeRepel: number // accélération de répulsion dans la bande (u/s²)
  hydrophobeRestitution: number // rebond au contact (0..1)
  spongeDrag: number // traînée dans une cellule absorbante (1/s)
  spongeAbsorbTime: number // temps de contact continu avant absorption (s)
  wallSplashDamp: number // amorti du rebond normal près des murs neutres (0..1) : l'eau épouse la paroi au lieu d'éclater

  // Corps
  litersPerParticle: number // conversion volume affiché
  criticalVolumeFraction: number // sous cette fraction du volume de base : dispersion (§3.1)
  componentEvery: number // pas entre deux identifications d'amas connexes
  linkRadiusFactor: number // rayon d'adjacence des amas, en fraction de h

  // Caméra (§11)
  cameraFraction: number // diamètre du corps en fraction du petit côté de l'écran
  cameraSmoothing: number // taux de lissage exponentiel (1/s)
  cameraMinZoom: number
  cameraMaxZoom: number

  // Temps (§11)
  timeWarp: number

  // Rendu métaballes
  fieldThreshold: number
  fieldSoftness: number
  particleRenderRadius: number // rayon de splat par particule (unités monde)
  speedColorScale: number // vitesse (unités/s) correspondant à la couleur « rapide »
  renderDownsample: number // facteur de sous-résolution du champ
}

export const DEFAULT_PARAMS: SimParams = {
  dt: 1 / 120,
  solverIterations: 3,

  kernelRadius: 12,
  particleSpacing: 6.6,
  epsilonLambda: 1e-4,
  // Balayage mesuré (repos 5 s + poussée 2 s, corps de 300) : xsphC < 0.2
  // laisse le corps se désagréger par agitation interne ; à 0.25 la perte de
  // volume est exactement le volume éjecté. Avec le corps de 900, 2 s de
  // poussée ≈ 7 % du volume pour ~100 u/s — les repères du doc §12.
  sCorrK: 0.05,
  sCorrN: 4,
  sCorrDq: 0.25,
  xsphC: 0.25,
  maxDeltaPFactor: 0.1,
  maxSpeed: 3000,

  ejectRate: 32,
  ejectSpeed: 1400,
  ejectEntrain: 0.16,
  reabsorbCooldown: 1.2,

  vortexRadius: 260,
  vortexPull: 420,
  vortexSwirl: 1.4,
  vortexDrag: 5,
  vortexDuration: 1.6,
  vortexWindDown: 0.35,

  hydroBand: 16,
  hydrophilePull: 900,
  hydrophileFriction: 5,
  hydrophobeRepel: 1400,
  hydrophobeRestitution: 0.55,
  spongeDrag: 7,
  spongeAbsorbTime: 0.3,
  wallSplashDamp: 0.65,

  litersPerParticle: 0.005,
  criticalVolumeFraction: 0.35,
  componentEvery: 5,
  linkRadiusFactor: 1.1,

  cameraFraction: 0.28,
  cameraSmoothing: 2.5,
  cameraMinZoom: 0.12,
  cameraMaxZoom: 3,

  timeWarp: 1,

  fieldThreshold: 0.55,
  fieldSoftness: 0.25,
  particleRenderRadius: 9,
  speedColorScale: 220,
  renderDownsample: 2,
}

export function exportParams(params: SimParams): string {
  return JSON.stringify(params, null, 2)
}

export function importParams(json: string, into: SimParams): void {
  const parsed = JSON.parse(json) as Partial<SimParams>
  for (const key of Object.keys(into) as (keyof SimParams)[]) {
    const value = parsed[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      into[key] = value
    }
  }
}
