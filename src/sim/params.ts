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
  recoilLocality: number // 0 : recul uniforme (corps rigide) ; 1 : recul concentré au point d'éjection, propagé par pression (le corps se déforme)
  reabsorbCooldown: number // délai avant qu'une gouttelette éjectée soit réabsorbable (s)

  // Vortex de regroupement (clic droit) — outil de test : il annule le coût
  // de la perte d'eau, donc coupé par défaut dans le protocole
  vortexEnabled: number // 0 : coupé ; 1 : actif (sandbox)
  vortexRadius: number // rayon d'action autour du point cliqué (unités monde)
  vortexPull: number // vitesse du courant du vortex (u/s)
  vortexSwirl: number // part giratoire du courant — rallonge la spirale de retour
  vortexDrag: number // taux d'entraînement de l'eau par le courant (1/s)
  vortexDuration: number // durée du vortex après le clic (s)
  vortexWindDown: number // fraction finale de la durée où le courant s'essouffle et dépose l'eau

  // Glace : l'eau gelée devient un bloc rigide qui garde son élan (palet
  // balistique, insensible à la chimie des parois, rebondit au lieu
  // d'éclabousser). On gèle volontairement (touche F / ❄) ou par exposition
  // aux plaques froides ; la glace prise au contact d'une plaque s'y soude.
  coldBand: number // portée de l'aura de gel autour des plaques (unités monde)
  freezeTime: number // s d'exposition en pleine aura avant le gel complet
  freezeSelfTime: number // s de prise du gel volontaire (touche F)
  thawTime: number // s de dégel (intention levée, ou à l'écart du froid)
  iceRestitution: number // rebond des blocs de glace sur les parois (0..1)

  // Radiateur (tableau 4) : la chaleur, symétrique du froid. Dans l'aura,
  // l'eau se vaporise qu'on le veuille ou non (danger OU ressource : la
  // vapeur gagnée traverse grilles et éponges), la glace dégèle, et la
  // vapeur qui s'attarde s'évapore — définitivement perdue.
  heatBand: number // portée de l'aura de chaleur autour des radiateurs (unités monde)
  boilTime: number // s d'exposition en pleine aura avant la vaporisation complète
  heatThawTime: number // s de dégel forcé en pleine aura (bien plus vite qu'à l'air libre)
  heatLossRate: number // particules de vapeur perdues / s d'exposition dans l'aura

  // Gaz (refonte 2026, « air dash ») : se changer en vapeur (touche G), viser
  // — le temps ralentit fortement, sans se figer — puis relâcher : le nuage
  // FUSE vers le point visé. Une impulsion unique, sans recul ni éjection ;
  // le prix est une fraction du volume COURANT, donc chaque dash propulse
  // pareil (Tsiolkovsky) — on peut toujours finir le tableau, chaque dash
  // coûte juste plus cher. La DISTANCE du doigt règle la puissance : pleine
  // à gasDashRange, dégressive en deçà — pas besoin de viser à deux
  // kilomètres pour avoir le maximum.
  vaporizeTime: number // s de changement d'état vers la vapeur (touche G)
  condenseTime: number // s de condensation quand l'intention est levée
  gasDashSpeed: number // vitesse du dash À PLEINE PUISSANCE (u/s)
  gasDashRange: number // distance (u) du pointeur au corps où la puissance atteint 1
  gasAimSlow: number // facteur de temps pendant la visée (0,06 = 16× plus lent)
  gasDashCost: number // fraction du volume courant évaporée par dash (≈ 1/3)
  gasExpand: number // répulsion interne du nuage (u/s²) : la vapeur s'étale
  gasTurb: number // turbulence : le nuage se tord en volutes (u/s²)
  gasDrag: number // flottement : freinage propre du gaz (1/s)
  // La vapeur n'est pas un passe-partout : être gaz se paie en continu, les
  // mailles d'une grille essorent le nuage au passage, et l'éponge prélève
  // son péage sur la vapeur qui la traverse (§4 : chaque bouffée part
  // définitivement — sauf la rosée, qui perle aux plaques froides).
  gasIdleLossRate: number // particules/s évaporées tant que le corps est en vapeur, même immobile
  grilleGasLoss: number // perte /s et par particule dans la maille d'une grille
  spongeGasToll: number // péage d'éponge sur la vapeur : perte /s et par particule dans l'éponge
  // Recondensation (§7.3) : la vapeur perdue se recondense sur les parois
  // froides — la rosée perle juste au-delà de l'aura, réabsorbable au prix
  // d'un détour. Plus le vaisseau refroidit, plus la condensation rend.
  recondRate: number // gouttes de rosée qui perlent par seconde (si réserve de vapeur perdue)
  recondFraction: number // part récupérable à vaisseau tiède (+0,25 à froid complet)
  gasLinkFactor: number // × le rayon d'amas : le nuage distendu reste un seul corps
  // Règles de transformation : changer d'état ne doit pas tuer.
  condenseRegroup: number // rappel des gouttelettes qui condensent vers le corps (u/s²)
  gasLinkDecay: number // s d'extinction de la mémoire de lien du gaz après condensation
  dispersalGrace: number // s continues sous le seuil critique avant de constater la dispersion

  // Refroidissement du vaisseau (§5) : pas un chronomètre affiché — le monde
  // devient progressivement moins jouable. Le facteur de froid (chill, 0..1,
  // fixé par le jeu selon le temps d'expédition) étend les auras froides,
  // durcit gel et dégel, affaiblit les radiateurs et ralentit la vapeur
  // volontaire.
  chillDuration: number // s simulées d'expédition pour atteindre le froid complet
  chillColdGrowth: number // extension des auras froides à froid complet (× coldBand)
  chillHeatFade: number // affaiblissement des radiateurs à froid complet (0..1)

  // Le ressenti thermique du LIQUIDE (avant tout changement d'état) : l'eau
  // qui givre s'engourdit — pâteuse, dure à propulser — et l'eau qui chauffe
  // frémit — agitée, vivante. La température se sent dans les mains avant de
  // se voir dans un état.
  frostSluggish: number // traînée à pleine givre (1/s) : l'eau engourdie rampe
  heatAgitation: number // frémissement à pleine chauffe (u/s²) : l'eau chaude bout doucement

  // Laser : le faisceau chauffe l'eau qu'il traverse — la glace le
  // réfléchit (miroir, palier 1), l'eau le RÉFRACTE (prisme, palier 2),
  // la vapeur le laisse passer. Les pertes rejoignent la réserve de rosée,
  // récupérables aux plaques froides.
  laserWidth: number // demi-largeur du couloir de chauffe (unités monde)
  laserEvapRate: number // évaporation (particule/s) pour CHAQUE particule d'eau dans le faisceau
  // Le miroir de glace est fait de particules : sans lissage, sa normale
  // épouse chaque bosse et le reflet tremble dans tous les sens. La normale
  // se moyenne sur ce rayon — grand = facette plane, petit = miroir brut.
  // Le dioptre de l'eau (palier 2) utilise le même lissage.
  laserMirrorSmooth: number // rayon (u) de moyennage de la normale du miroir
  // Indice de réfraction du corps liquide : 1,33 = eau réelle (angle
  // critique ≈ 49°). À 1 : l'eau redevient transparente comme au palier 1.
  laserRefractIndex: number

  // Sas de sortie : une bouche d'aspiration dans laquelle l'eau s'engouffre
  exitRadius: number // portée de l'aspiration autour de la bouche (unités monde)
  exitPull: number // vitesse du courant d'aspiration (u/s), renforcée à l'approche du trou
  exitSwirl: number // part giratoire du courant : l'eau spirale en entonnoir
  exitIceGrip: number // prise du courant sur la GLACE (0..1) : un bloc a de l'inertie

  // Matériaux (§6)
  hydroBand: number // portée des effets de surface (unités monde)
  hydrophilePull: number // accélération d'adhésion vers la surface (u/s²)
  hydrophileFriction: number // amortissement tangentiel au contact (1/s)
  hydrophobeRepel: number // accélération de répulsion dans la bande (u/s²)
  hydrophobeRestitution: number // rebond au contact (0..1)
  spongeDrag: number // traînée dans une cellule absorbante (1/s)
  spongeAbsorbTime: number // temps de contact continu avant absorption (s)
  wallSplashDamp: number // amorti du rebond normal près des murs neutres (0..1) : l'eau épouse la paroi au lieu d'éclater
  wallSplashBand: number // portée de cet amorti (unités monde) — effet de CONTACT, sans rapport avec la portée de la chimie
  // Mordant global : un seul curseur qui durcit TOUTES les surfaces —
  // adhésion et arrachage hydrophiles, répulsion hydrophobe, engluement et
  // absorption de l'éponge, gel d'aura, évaporation au radiateur. Appliqué
  // par-dessus les réglages individuels, donc aussi aux présets enregistrés
  // avant son existence.
  surfaceBite: number // 1 = nominal ; 1.5 = surfaces nettement plus dangereuses

  // Corps
  litersPerParticle: number // conversion volume affiché
  criticalVolumeLiters: number // sous ce volume ABSOLU : la RÉSERVE est à sec (dernière impulsion)
  // Fin de course (refonte 2026) : il n'y a plus de minimum à ramener, ni de
  // mort. Sous le seuil, le corps a droit à une DERNIÈRE impulsion, puis il se
  // fige en glace en gardant son élan — et dérive. Rien ne le freine : le vide
  // ne freine rien, et cette dérive peut encore atteindre le sas.
  // Seuil en LITRES (pas une fraction) : un tableau à petit volume de départ
  // ne doit pas déclencher la fin de course plus tôt qu'un grand.
  lastCallLiters: number // volume absolu (L) annonçant que la dernière impulsion approche
  iceCollectBonus: number // prime de collecte sur la part avalée à l'état de glace
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
  recoilLocality: 0.6,
  reabsorbCooldown: 1.2,

  vortexEnabled: 0,
  vortexRadius: 260,
  vortexPull: 420,
  vortexSwirl: 1.4,
  vortexDrag: 5,
  vortexDuration: 1.6,
  vortexWindDown: 0.35,

  // Portée sentie manette en main : le corps fait ~110 u de rayon — une aura
  // de 40 u n'en mordait qu'une tranche et ne se ressentait pas
  coldBand: 85,
  freezeTime: 1.2,
  freezeSelfTime: 0.45,
  thawTime: 2.5,
  iceRestitution: 0.45,

  // Fenêtre d'usage : ~1,5 s pour gagner la vapeur, puis ~8 particules/s de
  // perte si on s'attarde — le radiateur est une ressource qui devient un
  // danger, jamais un mur binaire (§6)
  heatBand: 130,
  boilTime: 1.2,
  heatThawTime: 0.35,
  heatLossRate: 8,

  vaporizeTime: 0.5,
  condenseTime: 0.9,
  gasDashSpeed: 620,
  gasDashRange: 300,
  gasAimSlow: 0.06,
  gasDashCost: 1 / 3,
  gasExpand: 260,
  gasTurb: 120,
  gasDrag: 1.3,
  gasIdleLossRate: 2,
  grilleGasLoss: 0.35,
  spongeGasToll: 1.1,
  // Perte de 50 % à vaisseau tiède, 25 % à vaisseau glacial : le rattrapage
  // devient plus généreux quand le jeu devient plus dur — auto-équilibré (§7.3)
  recondRate: 4,
  recondFraction: 0.5,
  gasLinkFactor: 3,
  condenseRegroup: 420,
  gasLinkDecay: 2.5,
  dispersalGrace: 2,

  // ~10 min de jeu simulé pour un vaisseau glacial (l'expédition fait 7
  // tableaux) : la vapeur devient rare (pas impossible) au dernier tiers,
  // le gel guette (§13 de la proposition)
  chillDuration: 600,
  chillColdGrowth: 0.5,
  chillHeatFade: 0.6,

  frostSluggish: 3,
  heatAgitation: 240,

  laserWidth: 9,
  laserEvapRate: 0.5,
  laserMirrorSmooth: 30,
  laserRefractIndex: 1.33,

  exitRadius: 240,
  exitPull: 300,
  exitSwirl: 1.1,
  exitIceGrip: 0.5,

  // Portée sentie : à 16 u la chimie ne mordait qu'au ras du mur — invisible
  // pour un corps de ~110 u de rayon. À 80 u (l'échelle des auras
  // thermiques), la déviation hydrophobe se négocie de loin et l'aspiration
  // hydrophile est un vrai champ.
  hydroBand: 80,
  hydrophilePull: 900,
  hydrophileFriction: 5,
  hydrophobeRepel: 1400,
  hydrophobeRestitution: 0.55,
  spongeDrag: 7,
  spongeAbsorbTime: 0.3,
  wallSplashDamp: 0.65,
  // Deux fois l'espacement des particules : l'amorti d'éclaboussure agit au
  // ras de la paroi. Il partageait jusqu'ici la portée de la chimie
  // (hydroBand), passée à 80 u pour les auras — les murs neutres retenaient
  // alors le corps à distance, comme s'ils collaient.
  wallSplashBand: 14,
  surfaceBite: 1.35,

  litersPerParticle: 0.005,
  // Le seuil ne tue plus : il annonce la dernière impulsion. On peut donc
  // descendre très bas et finir un tableau sur un souffle. En LITRES absolus :
  // on garde la main jusqu'à 300 ml quel que soit le volume de départ.
  criticalVolumeLiters: 0.3,
  lastCallLiters: 0.6,
  // Dans le vide, un palet garde son élan pour l'éternité : sans ce freinage,
  // la fin de course ne se conclurait jamais. Il laisse une dernière glissade
  // d'une dizaine de secondes — le temps d'espérer atteindre le sas.
  iceCollectBonus: 0.25,
  componentEvery: 5,
  linkRadiusFactor: 1.1,

  cameraFraction: 0.28,
  cameraSmoothing: 2.5,
  cameraMinZoom: 0.12,
  cameraMaxZoom: 3,

  timeWarp: 1,

  // Splats larges + seuil haut : le champ se lisse, les particules
  // individuelles ne se lisent plus comme des billes
  fieldThreshold: 0.8,
  fieldSoftness: 0.3,
  particleRenderRadius: 13,
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
