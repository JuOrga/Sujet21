"use strict";

// Tous les paramètres de ressenti du prototype. Le banc de réglage (touche T)
// les expose en sliders et sait les exporter en JSON (§13 du doc fonctionnel).
const P = {
  // --- Solveur PBF ---
  h: 14,            // rayon d'interaction (px)
  spacing: 7,       // espacement de spawn (px)
  substeps: 4,
  iterations: 3,
  eps: 0.01,        // relaxation du solveur de densité
  sCorrK: 0.08,     // anti-agglutination (tension de surface)
  sCorrDq: 0.25,
  viscosity: 0.18,  // lissage XSPH
  maxSpeed: 1400,

  // --- Corps et éjection ---
  baseCount: 220,     // volume de base = 1,00 L
  ejectRate: 8,       // gouttelettes / s
  ejectSpeed: 1200,    // vitesse d'éjection (px/s)
  remergeDelay: 1.2,  // délai avant qu'une goutte éjectée soit ré-absorbable (s)
  linkDist: 11,       // distance de connexité pour l'amas joueur (px)
  disperseCount: 25,  // sous ce nombre de particules : dispersion

  // --- Éponge ---
  spongeAbsorbTime: 0.3, // s de contact continu avant absorption
  spongeDrag: 6,         // traînée dans l'éponge
  spongeCellCap: 2,      // particules par cellule avant saturation

  // --- Chaleur (M1) ---
  // Température normalisée : 0 = gel, 1 = ébullition. Au-delà de 1, la
  // chaleur reçue est de la chaleur latente ; la particule s'évapore
  // (perte définitive) quand elle atteint 1 + latentHeat.
  tempAmbient: 0.45,  // température de la salle
  tempRelax: 0.06,    // retour vers l'ambiante (1/s)
  heatPower: 0.3,     // apport d'un radiateur (1/s)
  coldPower: 0.3,     // retrait d'une cryobaie (1/s)
  freezeT: 0.12,      // gel du corps sous cette température moyenne
  meltT: 0.32,        // dégel au-dessus (hystérésis)
  boilT: 0.75,        // au-dessus : l'éjection devient une bouffée de vapeur
  latentHeat: 0.25,   // marge avant évaporation spontanée (fenêtre d'usage)
  steamBoost: 2.2,    // multiplicateur de poussée des bouffées de vapeur
  iceBounce: 0.8,     // restitution des rebonds du corps gelé
  steamLife: 1.4,     // durée de vie visuelle d'une bouffée (s)

  // --- Caméra et temps ---
  camFraction: 0.16, // le corps occupe cette fraction du petit côté de l'écran
  camSmooth: 3.0,
  zoomMin: 0.35,
  zoomMax: 1.6,
};

// [clé, libellé, min, max, pas]
const PARAM_SCHEMA = [
  ["ejectRate",        "Éjection (gouttes/s)",     1,   30,  1],
  ["ejectSpeed",       "Vitesse d'éjection",       200, 1500, 10],
  ["remergeDelay",     "Délai de refusion (s)",    0,   4,   0.1],
  ["disperseCount",    "Seuil de dispersion",      5,   80,  1],
  ["sCorrK",           "Tension de surface",       0,   0.3, 0.005],
  ["viscosity",        "Viscosité",                0,   0.6, 0.01],
  ["eps",              "Relaxation solveur",       0.002, 0.08, 0.002],
  ["iterations",       "Itérations solveur",       1,   6,   1],
  ["substeps",         "Sous-pas physiques",       1,   5,   1],
  ["heatPower",        "Radiateur : puissance",    0.05, 1.5, 0.05],
  ["coldPower",        "Cryobaie : puissance",     0.05, 1.5, 0.05],
  ["tempRelax",        "Retour à l'ambiante",      0,    0.5, 0.01],
  ["freezeT",          "Seuil de gel",             0.02, 0.3, 0.01],
  ["meltT",            "Seuil de dégel",           0.1,  0.6, 0.01],
  ["boilT",            "Seuil de vapeur",          0.5,  0.95, 0.01],
  ["latentHeat",       "Chaleur latente",          0.05, 0.8, 0.05],
  ["steamBoost",       "Poussée vapeur (×)",       1,    4,   0.1],
  ["iceBounce",        "Rebond de la glace",       0.2,  1,   0.05],
  ["spongeAbsorbTime", "Éponge : t. d'absorption", 0.05, 1.5, 0.05],
  ["spongeDrag",       "Éponge : traînée",         0,   15,  0.5],
  ["spongeCellCap",    "Éponge : capacité/cellule",1,   6,   1],
  ["camFraction",      "Cadrage caméra",           0.06, 0.4, 0.01],
  ["maxSpeed",         "Vitesse max",              200, 2000, 50],
];
