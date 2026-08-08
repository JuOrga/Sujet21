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

  // --- Chaleur (M1) : 0 = gel, 1 = ébullition ---
  ambient: 0.4,        // température du vaisseau (baissera avec le refroidissement, M3)
  envRate: 1.6,        // vitesse d'échange particule <-> milieu (1/s)
  diffusion: 3.0,      // conduction interne entre voisines (1/s)
  freezeT: 0.1,        // en dessous : le corps gèle
  meltT: 0.24,         // au-dessus : la glace fond (hystérésis)
  boilT: 1.0,          // au-dessus : la particule se vaporise
  vaporSpeed: 950,     // vitesse de la bouffée de vapeur (px/s)
  vaporLife: 2.4,      // durée de vie de la vapeur avant disparition (s)
  iceRestitution: 0.55,// rebond de la glace sur les parois
  iceEnvRate: 0.55,    // la glace échange plus lentement (chaleur latente)

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
  ["ambient",          "Température ambiante",     0,   0.9, 0.01],
  ["envRate",          "Échange thermique",        0.2, 6,   0.1],
  ["diffusion",        "Conduction interne",       0,   12,  0.25],
  ["freezeT",          "Seuil de gel",             0,   0.3, 0.01],
  ["meltT",            "Seuil de fonte",           0.05, 0.5, 0.01],
  ["vaporSpeed",       "Vapeur : vitesse",         300, 1500, 25],
  ["vaporLife",        "Vapeur : durée de vie (s)",0.5, 6,   0.1],
  ["iceRestitution",   "Glace : rebond",           0,   1,   0.05],
  ["spongeAbsorbTime", "Éponge : t. d'absorption", 0.05, 1.5, 0.05],
  ["spongeDrag",       "Éponge : traînée",         0,   15,  0.5],
  ["spongeCellCap",    "Éponge : capacité/cellule",1,   6,   1],
  ["camFraction",      "Cadrage caméra",           0.06, 0.4, 0.01],
  ["maxSpeed",         "Vitesse max",              200, 2000, 50],
];
