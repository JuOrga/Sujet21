import '@fontsource/michroma'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/600.css'
import { DEFAULT_PARAMS, type SimParams } from './sim/params'
import { FluidSim, KIND_PLAYER } from './sim/solver'
import { NoyauxWasm } from './sim/wasm'
import { TROPHEES, Trophees } from './game/trophees'
import { evenementsPlasma } from './game/plasmaFx'
import { CODEX, Codex, type CodexGroupe } from './game/codex'
import { niveauExpanse } from './game/structures'
import {
  TABLEAU_HUB,
  articleComptoir,
  zonesDuHub,
  type ArticleHub,
} from './game/hub'
import {
  REPARATIONS,
  appliqueReparations,
  reparationDef,
} from './game/reparations'
import {
  DECOUVERTES,
  prochaineDecouverte,
  recitAcheve,
} from './game/decouvertes'
import {
  MECANIQUE_NOMS,
  codeCanon,
  decodeCode21,
  decodeCodeAtelier,
  estCodeHub,
  type CodeAtelier,
} from './game/levelIO'
import { dessineMiniCarte } from './game/carte'
import { piocheEcrite, propositionsSalles } from './game/poule'
import {
  genereNiveauAtelier,
  OPTIONS_DEFAUT,
  type OptionsGen,
} from './game/generateur'
import { FAMILLES_REGLES, reglesDeFamille } from './game/reglesGen'
import {
  ampleurAuRang,
  clampPlanVoie,
  diffAuRang,
  figureDeLaCarte,
  figuresDuChoix,
  hachage,
  litPalmaresVoie,
  masqueMecanique,
  masquePermis,
  mecaniquesDuChoix,
  mecaniquesPermises,
  momentAuRang,
  reglageAuRang,
  varianteDuJour,
  type PalmaresVoie,
  type PlanVoie,
} from './game/voie'
import { FIGURE_FAMILLES, FIGURE_NOMS } from './game/figures'
import { CIRCUITS } from './game/circuits'
import type { LevierId } from './game/leviers'
import {
  catalogueRecompenses,
  exporteRecompenses,
  idDepuisNom,
  importeRecompenses,
  poseRecompense,
  recompensesPerso,
  retireRecompense,
} from './game/recompenses'
import type { InstrumentDef } from './game/instruments'
import {
  BONBONNE_CAP,
  INSTRUMENTS,
  PALIERS_XP,
  aContrepartie,
  calibreInstrument,
  descriptionInstrument,
  famillesInstrument,
  instrumentDef,
  levier,
  paliersAtteints,
  prochainPalier,
  tirageInstruments,
} from './game/instruments'
import {
  FAMILLE_NOMS,
  LEVIERS,
  forceEffet,
  levierDef,
  neutre,
  phraseEffet,
  sensEffet,
  valeurLevier,
  valeurProposee,
} from './game/leviers'
import { dansForme, formeOutline } from './game/formes'
import {
  DOMAINE_NOMS,
  catalogueMarkdown,
  catalogueTextes,
  comptesParDomaine,
  type DomaineTexte,
} from './textes/catalogue'
import {
  DOMAINES_LUS,
  codexLu,
  langueLue,
  poseLangueLue,
} from './textes/lecture'
import {
  LANGUES,
  LANGUE_SOURCE,
  applique,
  avance,
  exporteTextes,
  importeTextes,
  langueDef,
  poseTexte,
  retireTexte,
  type EntreeLangue,
  type EtatTexte,
  type Langue,
} from './textes/atelier'
import {
  PLAFOND_DPR,
  echelleDepart,
  viseEchelle,
} from './game/resolution'
import {
  DERNIERE_LIVRAISON,
  VERSION,
  litLivraisons,
  versionDe,
} from './bench/changelog'
import { Camera } from './render/camera'
import { MAX_BOXES, Renderer } from './render/renderer'
import { FixedLoop } from './game/loop'
import { Input } from './game/input'
import {
  MAT_EXIT,
  MAT_FROID,
  TABLEAU_1BIS,
  TABLEAUX,
  TABLEAUX_ECOLE,
  MAT_CHAUD,
  MAT_WALL,
  pointInBox,
  ZONE_CAUSES,
  zoneForceAt,
  zoneName,
  zoneShape,
  type DecalDef,
  type LevelDef,
  type LumiereDef,
  type ObstacleBox,
  type PlotMeta,
  type ZoneForce,
  AMBIANTE_DEFAUT,
} from './game/level'
import { LevelEditor } from './editor/editor'
import {
  traceLaser,
  creerEtatRecepteurs,
  avancerRecepteurs,
  cibleActive,
  canalActif,
  type TraceResultat,
} from './game/laser'
import { BOUTON, Manette } from './game/manette'
import {
  MANOEUVRES,
  actionDeTouche,
  boutonDe,
  nomBouton,
  nomTouche,
  poseSourisInverse,
  redefinis as redefinisCommande,
  redefinie as commandeRedefinie,
  reinitialise as reinitialiseCommandes,
  sections as sectionsCommandes,
  sourisInverse,
  toucheDe,
} from './game/commandes'
import { PARALLAXE_DEFAUTS, facteurG } from './render/parallaxe'
import { PerfCollector } from './game/perf'
import {
  fetchLibrary,
  reorderLibrary,
  mentionSaisie,
  raisonDuRefus,
  saveLevel,
  type StoredLevel,
} from './game/netLevels'
import {
  bonbonneIllimitee,
  doitVerserAuto,
} from './game/bonbonne'
import { AudioFx, loadAudioPrefs } from './game/audio'
import {
  Soundtrack,
  type Bruitage,
  type Piste,
  type Ponctuation,
} from './game/soundtrack'
import {
  CINEMATIQUES_LIVREES,
  chargeCinematiques,
  type CinematiqueDef,
} from './game/cinematique'
import { LecteurCinematique } from './game/cinelecteur'
import { TableMontage } from './game/montage'
import { Imagerie } from './game/imagerie'
import { fetchBibliotheque } from './game/netCines'
import {
  SEQUENCE_ALERTE,
  Sequenceur,
  chargeSequences,
  type SequenceDef,
} from './game/sequence'
import {
  type EtatScenario,
  type MomentScenario,
  type ScenarioDef,
  avecScenarioLivre,
  chargeScenario,
  chargeVues,
  choisitRegle,
  noteVue,
  sauveScenario,
} from './game/scenario'
import { Records } from './game/records'
import {
  RAYON_PASTILLE,
  absorbePastilles,
  semeFiole,
  semePastilles,
  type CondensatDef,
} from './game/condensat'
import { FIOLES, FIOLES_SLOTS, fioleDef } from './game/fioles'
import {
  ETATS_CYCLE,
  TRANSFOS_CYCLE,
  transfoAchetable,
  transfoCycle,
  transfoEntre,
  transfoTenue,
} from './game/cycle'
import type { EtatManuel } from './game/input'
import {
  ECLAT_URL,
  ICONES_COLONNES,
  ICONES_RANGEES,
  ICONES_URL,
  cadreAlcove,
  caseIcone,
  decalsDuMeta,
  iconeMetaHTML,
  vuesEclat,
} from './game/metaAssets'
import { sprite, spritesCharges } from './render/sprites'
import {
  ETAL_ECONOMAT,
  TABLEAU_ECONOMAT,
  articleEtal,
  estEconomat,
  type ArticleEconomat,
} from './game/economat'
import {
  fetchSharedBoard,
  pushExpeditionRecord,
  pushTableauRecord,
  type SharedBoard,
} from './game/netRecords'
import { createBench, type BenchMonitor } from './bench/bench'

const CAPACITY = 4096
// (l'ancien délai d'affichage du bilan a cédé la place à la MISE EN
// BONBONNE : c'est le choix d'instrument qui mène au tableau suivant)

const params: SimParams = { ...DEFAULT_PARAMS }

// L'expédition (§7) : les tableaux en séquence, UNE fois. Le surplus de
// chaque sas part en bonbonne ; seul le dernier sas conclut l'expédition.
// Pendant ce temps, le vaisseau refroidit (§5) : pas de chronomètre affiché,
// le monde devient moins jouable — c'est la pression temporelle.
const run = {
  bonbonneLiters: 0,
  exitTimer: 0, // > 0 : bilan de sortie affiché, tableau suivant imminent
  tableauTime: 0, // secondes simulées depuis l'entrée du tableau (pour les records)
  runTime: 0, // secondes simulées depuis le début de l'expédition (refroidissement)
  ended: false, // expédition conclue : bilan affiché, en attente de la suivante
  // Les VIES du roguelike : des ÉCHANTILLONS DE SECOURS. On part avec UN
  // seul — toujours. Une dispersion en consomme un et renvoie à la première
  // goutte du tableau ; le dernier perdu, c'est la fin de la run — retour
  // au labo. Les échantillons SUPPLÉMENTAIRES ne se gagnent pas en route :
  // ils se FARMENT (façon Hadès) — futur banc d'étalonnage (permanent,
  // payé en condensat) et instruments embarqués (par run).
  vies: 1,
  conclues: 0, // salles conclues cette run (statistique, et futur farm)
  // Les INSTRUMENTS EMBARQUÉS : les cartes emportées aux mises en bonbonne
  // de cette run — des avantages latéraux, perdus à la fin de la run.
  instruments: [] as string[],
  // L'XP D'ÉTALONNAGE : les litres versés côté instruments — chaque palier
  // franchi (PALIERS_XP) ouvre un tirage de cartes.
  xp: 0,
  // Le TOTAL LIVRÉ de la run (records d'expédition) : la bonbonne, elle,
  // est une réserve qui se VIDE quand on la verse dans le corps.
  livreTotal: 0,
  // Les PASTILLES bues dans CE tableau (centilitres) — pour le bilan de la
  // mise en bonbonne ; remis à zéro à chaque entrée de tableau.
  pastillesCl: 0,
  // La MÉMOIRE gravée pendant cette run (l'affichage du butin ; le solde
  // vrai vit dans les registres et survit à tout).
  memoireGagnee: 0,
}
const VIES_MAX = 3 // plafond, étalonnage et instruments compris
// Sonde de test : l'état de la run depuis la console (comme __sim, __cam)
;(window as unknown as { __run: typeof run }).__run = run

// ---- LE CONDENSAT : la monnaie de RUN du roguelike. De la MATIÈRE — les
// centilitres livrés au sas, les pastilles ramassées dans les tableaux et
// les cachettes. Elle se dépense EN ROUTE (cartes payantes de la mise en
// bonbonne, et bientôt l'Économat du Semblable) ; à la fin de la run,
// réussie ou non, le laboratoire PURGE la cuve : le condensat est
// confisqué. Seule la MÉMOIRE (records) survit — le Sujet se souvient.
const CLE_CONDENSAT = 'sujet21-condensat-v1' // l'héritage : migré en mémoire
let condensat = 0
function gagneCondensat(cl: number): void {
  if (cl <= 0) return
  condensat += Math.round(cl)
  majCondensatUI()
}
/** Débite la réserve de la run si elle suffit (cartes payantes de la mise
 * en bonbonne, étal de l'Économat). */
function depenseCondensat(cl: number): boolean {
  if (cl <= 0) return true
  if (condensat < cl) return false
  condensat -= cl
  majCondensatUI()
  return true
}
/** La PURGE : la fin de run (réussie, perdue ou abandonnée) confisque la
 * matière. Le compteur repart à zéro — la mémoire, elle, ne bouge pas. */
function purgeCondensat(): void {
  condensat = 0
  majCondensatUI()
}
function majCondensatUI(): void {
  const dd = document.getElementById('home-condensat')
  if (dd) dd.textContent = `${condensat} cL`
}
majCondensatUI()

// LA LECTURE DES RÉCOMPENSES. Le jeu ne demande jamais « ai-je telle
// carte » : il demande ce que vaut un LEVIER, tous instruments confondus.
// Une carte fabriquée à l'atelier répond donc exactement comme une carte
// livrée — c'est ce qui rend l'écran des récompenses jouable, et pas
// seulement décoratif.
function lev(id: LevierId): number {
  return levier(run.instruments, id, catalogueRecompenses())
}

// La fiche d'une carte, LIVRÉE OU FABRIQUÉE. Passer par ici plutôt que par
// `instrumentDef(id)` nu : sans le catalogue complet, une carte d'atelier
// est tirée puis introuvable — elle disparaît du tirage, du HUD et du
// bilan sans un mot. Un seul point de lecture, plus d'oubli possible.
function carteDef(id: string): InstrumentDef | null {
  return instrumentDef(id, catalogueRecompenses())
}

// La contenance de la bonbonne POUR CETTE RUN : le BALLAST (instrument
// embarqué) lui ajoute trois litres. Toute lecture passe par ici — jauges
// et bilans compris, sinon la réserve afficherait un plafond qu'elle
// dépasse, ou refuserait un versement qu'elle peut tenir.
// Sonde de test : ce que vaut un levier depuis la console (comme __sim,
// __run) — « __levier('bonbonne') » dit tout de suite ce que les cartes
// embarquées pèsent sur un réglage.
;(window as unknown as { __levier: (id: LevierId) => number }).__levier = lev

function capBonbonne(): number {
  // une contrepartie peut rogner la bonbonne — jamais en dessous de deux
  // litres : en dessous, la réserve ne servirait plus à rien
  return Math.max(2, BONBONNE_CAP + lev('bonbonne'))
}

function chillNow(): number {
  // la gaine isolante (instrument embarqué) ralentit le refroidissement —
  // la fiole d'ISOLANT (équipée au placard) s'y cumule
  const gaine = Math.max(0.2, lev('froid'))
  const fiole = records.fioleEquipee('isolant') ? 1.15 : 1
  return Math.min(
    1,
    run.runTime / (Math.max(30, params.chillDuration) * gaine * fiole),
  )
}

// Effets sonores : le contexte audio naît au premier geste (clic, toucher)
const audio = new AudioFx(loadAudioPrefs())
// Bande-son : mêmes réglages, même bus — elle ne s'éveille qu'au premier geste
// et ne télécharge rien tant que le son est coupé.
const bande = new Soundtrack(audio)
function eveilAudio(): void {
  audio.resume()
  if (audio.enabled) {
    bande.eveiller()
  }
  majInviteSon()
}
window.addEventListener('pointerdown', eveilAudio)
window.addEventListener('keydown', eveilAudio)
// Le navigateur n'autorise le son qu'après un geste : sans invitation, le
// premier geste de la partie est le clic sur COMMENCER, et le thème d'accueil
// n'aurait jamais l'occasion de se faire entendre. La fiche le propose donc.
// Le son s'éveille au premier geste (toucher, clic, touche) — plus de
// bouton d'activation. La fiche garde un simple MUTE, comme la barre du jeu.
const btnMute = document.getElementById('home-mute') as HTMLButtonElement | null
function majInviteSon(): void {
  if (btnMute)
    btnMute.innerHTML = audio.enabled
      ? '<i>♪</i><span>SON</span>'
      : '<i>⊘</i><span>MUET</span>'
}
btnMute?.addEventListener('click', () => {
  audio.setEnabled(!audio.enabled)
  if (audio.enabled) eveilAudio()
  majInviteSon()
})
majInviteSon()
// Mémoire pour les transitions sonores (fronts d'état)
const sfx = {
  allFrozen: false,
  allGas: false,
  dispersed: false,
  swallowed: 0,
  aiming: false,
  dropTimer: 0,
  lastCall: false,
  spent: false,
}

// Registres du labo (§10) : records par tableau et historique des essais.
const records = new Records()

// ---- LA MÉMOIRE : la monnaie PERSISTANTE de l'Éveil, gravée dans les
// registres. De l'information, pas de la matière : la purge de fin de run
// ne peut pas la confisquer — le Sujet se souvient, même d'une run
// échouée. Elle paiera l'arbre de l'Éveil (améliorations permanentes).
function majMemoireUI(): void {
  const dd = document.getElementById('home-memoire')
  if (dd) dd.textContent = String(records.memoire())
}
/** Grave la mémoire ET tient le compteur de butin de la run courante.
 * La fiole de SOUVENIR majore chaque gain de 25 %. */
function gagneMemoireRun(n: number): void {
  if (n <= 0) return
  const majore = Math.round(n * (records.fioleEquipee('souvenir') ? 1.25 : 1))
  records.gagneMemoire(majore)
  run.memoireGagnee += majore
  majMemoireUI()
}
// L'HÉRITAGE : l'ancien condensat persistant (d'avant la purge) devient de
// la mémoire, une fois pour toutes — 10 cL de matière = 1 souvenir. La clé
// disparaît ensuite : rien ne se migre deux fois.
try {
  const brut = Math.floor(Number(localStorage.getItem(CLE_CONDENSAT)))
  if (Number.isFinite(brut) && brut > 0) {
    records.gagneMemoire(Math.max(1, Math.floor(brut / 10)))
  }
  localStorage.removeItem(CLE_CONDENSAT)
} catch {
  // stockage indisponible : rien à migrer
}
majMemoireUI()

function fmtTime(s: number): string {
  return `${s.toFixed(1).replace('.', ',')} s`
}

// Les litres à la française : la virgule, pas le point
function fmtL(l: number): string {
  return `${l.toFixed(2).replace('.', ',')} L`
}

// Les durées d'expédition se lisent en minutes : « 13:32 » plutôt que 812 s
function fmtDuree(s: number): string {
  if (s < 120) return fmtTime(s)
  const mn = Math.floor(s / 60)
  const sec = Math.round(s % 60)
  return `${mn}:${String(sec).padStart(2, '0')}`
}

// ---- Moteur physique : les noyaux WASM (public/noyaux.wasm), chargés en
// arrière-plan. Choix mémorisé (sujet21-moteur) : WASM par défaut quand le
// module charge, JAVASCRIPT sinon ou sur demande — le retour arrière est
// instantané, même en pleine partie (le solveur bascule au pas suivant).
let noyauxWasm: NoyauxWasm | null = null
// Défaut : JAVASCRIPT — verdict des rapports du Pixel (A/B propre du
// 15/08) : le JIT mobile bat les noyaux WASM de ~40 % sur ces boucles.
// Le WASM reste en option : c'est un instrument de mesure, pas un dogme.
let moteurChoisi = localStorage.getItem('sujet21-moteur') ?? 'js'
function appliqueMoteur(s: FluidSim): void {
  s.noyauxWasm = noyauxWasm
  s.moteurWasm = noyauxWasm !== null && moteurChoisi === 'wasm'
}

function createSim(level: LevelDef): FluidSim {
  const sim = new FluidSim(params, level.bounds, CAPACITY)
  appliqueMoteur(sim)
  // les dashs sont la RÉSERVE DU TABLEAU : N par écran (le tableau peut
  // fixer son propre nombre, sinon celui du banc), pleins dès le chargement.
  // Changer d'état n'y touche jamais — la chaudière transforme, elle ne
  // recharge pas — et seul un surchauffeur frôlé en rend un, plafonné au max.
  sim.dashBudgetMax = level.dashBudget ?? params.gasDashBudget
  // Instruments embarqués : la buse calibrée agrandit la réserve d'un dash,
  // l'aimant à rosée bonifie la recondensation
  // Les instruments embarqués, lus PAR LEVIER : le réglage du banc n'est
  // jamais modifié, il est multiplié (ou augmenté) pour cette run.
  // une carte à contrepartie peut RETIRER un dash : jamais sous un seul,
  // sinon la vapeur devient une impasse au lieu d'un choix
  sim.dashBudgetMax = Math.max(1, sim.dashBudgetMax + lev('dashs'))
  sim.recondBonus = lev('rosee')
  sim.exitRadiusFactor = lev('sasPortee')
  sim.reabsorbFactor = lev('reabsorption')
  sim.vaporTollFactor = lev('peageVapeur')
  sim.iceBounceFactor = lev('rebondGlace')
  sim.spongeGripFactor = lev('priseEponge')
  sim.criticalFactor = lev('seuilDispersion')
  sim.basculeFactor = lev('bascule')
  sim.perteGazFactor = lev('perteVapeur')
  sim.perteGrilleFactor = lev('perteGrille')
  sim.priseSasGlaceFactor = lev('priseSasGlace')
  sim.glisseGlaceFactor = lev('glisseGlace')
  const naitVapeur =
    zoneForceAt(level, level.spawn.x, level.spawn.y) === 'vapeur'
  sim.dashBudget = sim.dashBudgetMax
  sim.setLevel(level.boxes, level.sponges)
  // Le tube d'un conduit épouse la bande de convoyage (railConvoy travaille
  // à plasmaRailRadius × 2,5) : ce qui est porté est exactement ce qui est
  // dedans, sinon le nuage se ferait expulser d'un bord qu'il croyait libre.
  sim.setConduits(level.rails ?? [], params.plasmaRailRadius * 2.5)
  sim.spawnDisc(level.spawn.x, level.spawn.y, level.spawn.n, KIND_PLAYER)
  // né dans une zone qui impose la vapeur : le corps EST un nuage dès la
  // première image — sinon le compteur annonce des dashs qui ne partent pas,
  // le temps que la vaporisation progressive s'achève
  if (naitVapeur) sim.naitEnVapeur()
  sim.relabel()
  return sim
}

// Enchaînement des tableaux : chaque sas mène au suivant, puis on boucle.
let levelIndex = 0
// Aide au level design : ?tableau=N démarre où l'on veut, ?spawn=x,y place le corps
{
  const q = new URLSearchParams(location.search)
  const t = Number(q.get('tableau'))
  if (Number.isFinite(t) && t >= 1 && t <= TABLEAUX.length) levelIndex = t - 1
  const spawnParam = q.get('spawn')
  if (spawnParam) {
    const [sx, sy] = spawnParam.split(',').map(Number)
    if (Number.isFinite(sx) && Number.isFinite(sy)) {
      const lv = TABLEAUX[levelIndex]
      lv.spawn = { ...lv.spawn, x: sx, y: sy }
    }
  }
}
// La séquence jouable : les tableaux de la bibliothèque partagée d'abord
// (dans l'ordre fixé par l'éditeur), puis TOUS les tableaux livrés, dans
// l'ordre choisi de l'expédition. La bibliothèque ne REMPLACE plus
// l'expédition — elle s'y enchaîne (avant : un seul tableau d'éditeur
// amputait les 13 livrés). Un tableau de bibliothèque qui porte le CODE
// d'un livré (une variante de 21-A) prend sa place : pas de doublon, la
// version de l'éditeur prime. Memoïsé : le HUD interroge chaque image.
let libraryLevels: LevelDef[] = []
let sequenceCache: { source: LevelDef[]; seq: LevelDef[] } | null = null
function playedLevels(): LevelDef[] {
  if (sequenceCache?.source !== libraryLevels) {
    // le HUB (code « HUB ») vit dans la bibliothèque comme salle spéciale :
    // éditable comme les autres, mais jamais dans la séquence de l'expédition.
    // TOUTE la famille est écartée (HUB2, les chantiers…) : une copie du hub
    // publiée deviendrait la « salle 1 » et le sas semblerait y renvoyer.
    const jouables = libraryLevels.filter((l) => !estCodeHub(l.code))
    const codes = new Set(jouables.map((l) => l.code))
    sequenceCache = {
      source: libraryLevels,
      seq:
        jouables.length === 0
          ? TABLEAUX
          : [...jouables, ...TABLEAUX.filter((t) => !codes.has(t.code))],
    }
  }
  return sequenceCache.seq
}

// Le hub joué : la version publiée dans la bibliothèque (code « HUB ») prime
// sur celle du code — le laboratoire se remodèle depuis l'éditeur.
let hubMemo: { base: LevelDef; cle: string; lv: LevelDef } | null = null
/** Le hub JOUÉ : le hub cible (code ou bibliothèque), DÉGRADÉ pour
 * chaque réparation encore due — l'accident du télescope se lit dans les
 * murs. Mémoïsé : même base + mêmes réparations → même référence (le
 * niveau est comparé par référence un peu partout). */
function finOuverte(): boolean {
  return (
    recitAcheve(records.decouvertesVues()) && records.estRepare('passerelle-4')
  )
}
function hubJoue(): LevelDef {
  const base = hubLevel()
  const opts = { cuveClose: !eveilJoue(), finOuverte: finOuverte() }
  const cle = `${opts.cuveClose ? 'cuve|' : ''}${opts.finOuverte ? 'fin|' : ''}${records.reparationsFaites().sort().join('+')}`
  if (hubMemo && hubMemo.base === base && hubMemo.cle === cle) return hubMemo.lv
  const lv = appliqueReparations(base, records.reparationsFaites(), opts)
  hubMemo = { base, cle, lv }
  return lv
}

function hubLevel(): LevelDef {
  return libraryLevels.find((l) => l.code === 'HUB') ?? TABLEAU_HUB
}

// L'Économat joué : même règle — la copie de bibliothèque (code « ECO »),
// remodelable dans l'éditeur, prime sur la salle du code.
function economatLevel(): LevelDef {
  return libraryLevels.find((l) => estEconomat(l)) ?? TABLEAU_ECONOMAT
}

// Un essai hors expédition : un tableau à part (prototype, salle laser,
// tableau d'éditeur), sans toucher aux registres. La FILE enchaîne les
// tableaux d'essai au sas — la trilogie laser se joue ainsi.
let testLevel: LevelDef | null = null
// La file d'essai est mixte : tableaux et cinématiques s'y enchaînent.
let testQueue: (LevelDef | CinematiqueDef)[] = []
let level: LevelDef = TABLEAUX[levelIndex]
// Les boîtes rendues incluent le sas (rendu seulement, pas de physique solide),
// et la bouche d'aspiration est le centre du sas du tableau courant.
let renderBoxes: ObstacleBox[] = []
let levelHasCold = false // le HUD n'annonce la rosée que si des plaques la rendent
const exitMouth = { x: 0, y: 0 }
// LE HUB : le module d'accueil (src/game/hub.ts) — la zone de départ du
// roguelike. Prioritaire derrière les essais (testLevel) : l'éditeur et les
// parcours d'essai passent toujours devant. C'est aussi le décor du
// CHARGEMENT : derrière la fiche, l'échantillon dérive déjà dans la cuve
// d'entraînement (sauf navigation directe ?tableau=N, outil de conception).
let auHub = !new URLSearchParams(location.search).has('tableau')
// Le tableau COMMENCE-t-il en vapeur (départ posé dans une zone qui
// l'impose) ? Alors la vapeur est l'ÉTAT INITIAL, pas une bascule : elle ne
// se paie pas. Le drapeau se consomme au premier basculement de l'image.
let departEnVapeur = false

// ---- LA VOIE SEMI-PROCÉDURALE : l'état de la descente --------------------
// Armée par le bouton de la fiche : à chaque récompense, la suite ÉCRITE de
// la séquence est mise en face d'une salle GÉNÉRÉE assortie à la
// progression de la run. La salle générée élue s'INTERCALE : elle prend la
// place du rang suivant, puis la séquence reprend son cours.
// UNE SEULE DESCENTE. Il n'y a plus de « mode voie » : toute descente suit
// le PLAN (longueur, rampe de difficulté, moments) et gagne les mêmes
// récompenses, le même butin, le même rail, le même palmarès. Le seul
// réglage qui la change : voiePlan.generees — les salles fabriquées
// proposées (ou non) à chaque récompense.
const sallesGenerees = (): boolean => voiePlan.generees
// la DESCENTE DU JOUR forcée par le SAS DE VAPEUR du hub — le temps d'une
// run, sans toucher au réglage du plan (qui reste celui du poste)
let voieDuJourForcee = false
function descenteDuJour(): boolean {
  return voiePlan.graineDuJour || voieDuJourForcee
}
let voieGenereeChoisie: LevelDef | null = null
let voieIntercalaire: LevelDef | null = null
// le RANG de la descente en cours : combien de salles FRANCHIES — la voie
// se boucle quand il atteint la longueur du plan, quelle que soit la
// séquence écrite (épuisée, elle cède la place aux salles générées)
let voieRang = 0
// LE REGISTRE DES SALLES VUES de la descente en cours (par code). La pioche
// du pool tire dans la bibliothèque sans se soucier de l'ordre : c'est lui
// qui garantit qu'on ne rejoue pas deux fois le même tableau dans une run,
// et c'est lui qui rend le SAUT ARRIÈRE sûr (un tableau situé plus haut
// dans la bibliothèque peut remplir une case tardive du plan).
const voieVues = new Set<string>()

// L'ÉCONOMAT : la salle du Semblable s'intercale UNE fois par run, à
// mi-descente — son sas est un passage (rien ne s'y consigne), ses achats
// se font au contact des alcôves de l'étal.
let economatIntercalaire: LevelDef | null = null
let economatVisiteCetteRun = false
// APPELER LE SEMBLABLE (outil de conception, banc et pupitre) : l'Économat
// s'intercale d'ordinaire tout seul, une fois par run et à mi-descente —
// impossible à convoquer pour l'essayer. Armé ici, il prend la prochaine
// salle quoi qu'il arrive, même déjà visité cette run. Le drapeau ne
// s'efface QUE lorsqu'il a servi : armé au hub, il tient jusqu'à la
// première traversée ; armé en salle, il ouvre la suivante.
let economatForce = false
// la CLEF DE CACHETTE achetée : les voiles du PROCHAIN tableau tombent
let clefCachette = false
// les achats déjà servis dans CETTE visite de l'Économat, et l'état
// d'occupation des alcôves (l'achat se tente au FRONT d'entrée)
const achatsEconomat = new Set<string>()
// ---- LE COMPTOIR DU HUB : les provisions de la PROCHAINE descente ------
// Payées en MÉMOIRE (la monnaie qui survit à la purge), elles s'appliquent
// au lancement de l'expédition suivante — le temps de la session.
const achatsHub = new Set<string>()
let plotsHubDedans: boolean[] = []
// les STATIONS DE RÉPARATION du hub accidenté : front montant par station
// (l'ordre du catalogue REPARATIONS fait foi)
let plotsReparDedans: boolean[] = []
let sasScelleDedans = false
// les PLOTS POSÉS du tableau courant (le méta en données — hub et Économat
// modernes compris) : un drapeau « dedans » par plot, l'achat se tente au
// FRONT d'entrée seulement
let plotsPosesDedans: boolean[] = []
// les ÉCLATS DE MÉMOIRE : gravés une fois par RUN (pas de ferme au R) —
// la clé note la salle et l'index de l'éclat
const eclatsPrisRun = new Set<string>()
let eclatsEssai: { x: number; y: number; memoire: number; cle: string }[] = []
let eclatsPrisEssai: boolean[] = []
let bancMemoiresDedans = false
const provisionsRun = { bonbonne: 0, vies: 0, clef: false, condensat: 0 }
let plotsDedans: boolean[] = []

// Le PLAN de la voie : paramétrable au banc, mémorisé par poste.
const CLE_PLAN_VOIE = 'sujet21-voie-plan-v1'
const voiePlan: PlanVoie = (() => {
  try {
    return clampPlanVoie(
      JSON.parse(localStorage.getItem(CLE_PLAN_VOIE) ?? 'null') as PlanVoie,
    )
  } catch {
    return clampPlanVoie(null)
  }
})()
function sauvePlanVoie(): void {
  try {
    localStorage.setItem(CLE_PLAN_VOIE, JSON.stringify(clampPlanVoie(voiePlan)))
  } catch {
    // stockage refusé : le plan ne tiendra que la session
  }
}

// Le PALMARÈS de la voie : descentes, bouclées, profondeur record, meilleur
// livré — ce qui donne envie de redescendre. Par poste.
const CLE_PALMARES_VOIE = 'sujet21-voie-palmares-v1'
function chargePalmaresVoie(): PalmaresVoie {
  let brut: string | null = null
  try {
    brut = localStorage.getItem(CLE_PALMARES_VOIE)
  } catch {
    brut = null
  }
  return litPalmaresVoie(brut)
}
function sauvePalmaresVoie(p: PalmaresVoie): void {
  try {
    localStorage.setItem(CLE_PALMARES_VOIE, JSON.stringify(p))
  } catch {
    // stockage refusé : tant pis pour cette fois
  }
}

// Le BUTIN de la voie : les salles générées ÉLUES, retenues sur ce poste
// (registres locaux) — rejouables depuis l'écran SALLES, publiables dans la
// bibliothèque partagée d'un geste. Dédupliqué par code, borné aux 20 plus
// récentes.
const CLE_BUTIN_VOIE = 'sujet21-voie-elues-v1'
interface SalleElue {
  level: LevelDef
  eluAt: string
  publie?: boolean
}
function chargeButin(): SalleElue[] {
  try {
    const arr = JSON.parse(
      localStorage.getItem(CLE_BUTIN_VOIE) ?? '[]',
    ) as unknown
    return Array.isArray(arr)
      ? (arr as SalleElue[]).filter(
          (e) => e && e.level && typeof e.level.code === 'string',
        )
      : []
  } catch {
    return []
  }
}
function sauveButin(butin: SalleElue[]): void {
  try {
    localStorage.setItem(CLE_BUTIN_VOIE, JSON.stringify(butin.slice(0, 20)))
  } catch {
    // stockage refusé : le butin ne tiendra que la session — sans gravité
  }
}
function noteSalleElue(lv: LevelDef): void {
  const butin = chargeButin().filter((e) => e.level.code !== lv.code)
  butin.unshift({ level: structuredClone(lv), eluAt: new Date().toISOString() })
  sauveButin(butin)
}

function applyLevel(): void {
  // LES STRUCTURES DE COQUE se déplient ICI, à l'entonnoir unique : le jeu
  // et le bouton ESSAYER de l'éditeur voient exactement la même chose. Un
  // tableau sans structure traverse sans être touché (même référence).
  level = niveauExpanse(
    testLevel ??
      (auHub
        ? hubJoue()
        : (economatIntercalaire ??
          voieIntercalaire ??
          playedLevels()[levelIndex] ??
          playedLevels()[0])),
  )
  levelHasCold = level.boxes.some((b) => b.material === MAT_FROID)
  rebuildRenderBoxes()
  exitMouth.x = (level.exit.minX + level.exit.maxX) * 0.5
  exitMouth.y = (level.exit.minY + level.exit.maxY) * 0.5
  bande.setAmbiance((level.ambiance as Piste | undefined) ?? null)
  departEnVapeur = zoneForceAt(level, level.spawn.x, level.spawn.y) === 'vapeur'
  buildWorldLabels()
}

// Étiquettes de monde : le nom de chaque surface, projeté par la caméra —
// la lisibilité de la légende, mais dans le décor lui-même.
const worldLabelsHost = document.getElementById(
  'world-labels',
) as HTMLDivElement
// Chaque pancarte connaît sa taille (mesurée UNE fois, à la construction :
// le zoom ne fait que la mettre à l'échelle) et sa portée — de quoi décider,
// à chaque image, qui a le droit d'occuper la place.
let labelEls: {
  span: HTMLSpanElement
  x: number
  y: number
  w: number
  h: number
  secteur: boolean
  place: boolean // avait sa place à l'image précédente (mémoire anti-papillotement)
}[] = []
const ZONE_LABEL_COLORS: Record<string, string> = {
  eau: '#63b7e6',
  glace: '#8fc8ee',
  vapeur: '#f2c98e',
  libre: '#7b93a8',
}
// Une étiquette peut se composer sur PLUSIEURS LIGNES : le saut de ligne
// saisi dans l'éditeur en devient un à l'écran (jamais de HTML injecté —
// on assemble des nœuds de texte et des <br>).
function poseLignes(hote: HTMLElement, texte: string): void {
  const lignes = texte.trim().split('\n')
  lignes.forEach((ligne, i) => {
    if (i > 0) hote.appendChild(document.createElement('br'))
    hote.appendChild(document.createTextNode(ligne.trim()))
  })
}

function buildWorldLabels(): void {
  worldLabelsHost.innerHTML = ''
  labelEls = level.labels.map((l) => {
    const span = document.createElement('span')
    span.className = `world-label wl-${l.tone}`
    // PICTOGRAMME D'ÉTAT (bible v3.1) : un rectangle à la couleur du
    // matériau, trois rangées de points EAU/GLACE/VAPEUR notées 0..3.
    // Aucun texte : une indication pour les HUMAINS, énigmatique pour le
    // joueur — la grille de lecture se gagne.
    if (l.picto) {
      span.classList.add('wl-picto')
      const swatch = document.createElement('i')
      swatch.className = 'picto-swatch'
      swatch.style.background = l.picto.couleur
      span.appendChild(swatch)
      const ETATS: ['eau' | 'glace' | 'vapeur', string][] = [
        ['eau', '#63b7e6'],
        ['glace', '#8fc8ee'],
        ['vapeur', '#f2c98e'],
      ]
      for (const [etat, couleur] of ETATS) {
        const rangee = document.createElement('u')
        rangee.className = 'picto-rangee'
        const note = l.picto[etat]
        for (let d = 0; d < 3; d++) {
          const point = document.createElement('b')
          point.className = d < note ? 'plein' : 'vide'
          point.style.color = couleur
          rangee.appendChild(point)
        }
        span.appendChild(rangee)
      }
      worldLabelsHost.appendChild(span)
      return { span, x: l.x, y: l.y, w: 0, h: 0, secteur: false, place: false }
    }
    // « SUR-TITRE|TITRE » : l'étiquette devient une PLAQUE de signalétique
    // sur deux lignes (petit sur-titre mono, titre en capitales), avec fond
    // et liseré teinté — la lisibilité d'un panneau, plus un texte qui flotte
    if (l.text.includes('|')) {
      const [sur, titre] = l.text.split('|')
      span.classList.add('plaque')
      const i = document.createElement('i')
      poseLignes(i, sur)
      const b = document.createElement('b')
      poseLignes(b, titre)
      span.append(i, b)
    } else {
      poseLignes(span, l.text)
    }
    worldLabelsHost.appendChild(span)
    return {
      span,
      x: l.x,
      y: l.y,
      w: 0,
      h: 0,
      secteur: l.rang === 'secteur',
      place: false,
    }
  })
  // Chaque zone d'état porte son nom en haut de son emprise : la règle du
  // lieu s'annonce, elle ne se découvre pas en la subissant.
  for (const z of level.zones ?? []) {
    if (z.force === 'libre') continue
    const span = document.createElement('span')
    span.className = 'world-label wl-zone'
    // le nom dit la CAUSE (« hublot fendu »), le suffixe dit la règle
    span.textContent = `${zoneName(z)} · ${z.force.toUpperCase()}`
    span.style.color = ZONE_LABEL_COLORS[z.force] ?? '#7b93a8'
    span.style.borderColor = ZONE_LABEL_COLORS[z.force] ?? '#7b93a8'
    worldLabelsHost.appendChild(span)
    labelEls.push({
      span,
      x: (z.minX + z.maxX) / 2,
      y: z.maxY - 40,
      w: 0,
      h: 0,
      secteur: false,
      place: false,
    })
  }
  // Mesure unique : la taille d'une pancarte ne dépend que de son texte —
  // le zoom ne fait que l'échelonner. Une seule lecture de mise en page par
  // tableau chargé, jamais par image.
  for (const l of labelEls) {
    l.w = l.span.offsetWidth
    l.h = l.span.offsetHeight
  }
}

// Marge de respiration entre deux pancartes, en pixels d'écran : elles ne
// doivent pas seulement NE PAS se toucher, elles doivent se laisser lire.
const MARGE_PANCARTE = 10
// Bandes réservées à l'interface : le relevé en haut, le sélecteur d'état
// et la barre tactile en bas. Une pancarte qui s'y glisserait passerait
// DERRIÈRE les boutons — elle s'efface plutôt.
const BANDE_HAUTE = 46
let bandeBasse = 150 // recalculée sur la vraie hauteur des barres
let bandeMesuree = 0

// Hauteur d'écran interdite en bas : le sélecteur d'état et la barre
// tactile. Relue quatre fois par seconde — les barres apparaissent avec la
// partie, changent de hauteur en tournant l'écran, et une lecture de mise
// en page par image ne se justifie pas pour ça.
function majBandeBasse(t: number): void {
  if (t - bandeMesuree < 250) return
  bandeMesuree = t
  let haut = window.innerHeight
  for (const el of [
    document.getElementById('statebar'),
    document.getElementById('touchbar'),
  ]) {
    const r = el?.getBoundingClientRect()
    if (!r || r.height <= 0) continue
    // Seule une vraie barre POSÉE EN BAS définit la bande interdite : LARGE
    // (pas une colonne) et dans la moitié basse. En paysage mobile, ces
    // barres deviennent des COLONNES latérales dont le sommet est presque
    // en haut de l'écran : les prendre pour des barres basses interdisait
    // TOUT l'écran aux pancartes — plus une seule visible sur téléphone
    // ou tablette en paysage.
    if (r.width < r.height || r.width < window.innerWidth * 0.35) continue
    if (r.top < window.innerHeight * 0.55) continue
    if (r.top < haut) haut = r.top
  }
  bandeBasse = Math.max(0, window.innerHeight - haut) + 10
}

// Les pancartes gardent une taille de LECTURE quel que soit le zoom (comme
// les noms sur un plan) — d'où le risque de les voir s'empiler quand la
// carte se resserre. La place est donc ATTRIBUÉE, à chaque image : les
// plaques de secteur (les lieux) servies d'abord, puis les détails du plus
// proche du regard au plus lointain ; ce qui ne rentre plus s'efface en
// fondu. Résultat : jamais deux textes l'un sur l'autre, à aucun zoom, et
// le plan large se lit comme une carte — les lieux, sans le bavardage.
function updateWorldLabels(vw: number, vh: number): void {
  majBandeBasse(performance.now())
  // Au plan large, les pancartes RÉTRÉCISSENT avec la carte (plancher 0,45)
  // au lieu de garder leur taille de lecture : deux plaques géantes
  // masquaient la carte entière et effaçaient toutes les autres — la
  // signalétique redevient une carte annotée, et grossit en zoomant.
  const scale = Math.max(0.45, Math.min(1.3, Math.sqrt(camera.zoom)))
  const cx = vw * 0.5
  const cy = vh * 0.5
  const candidats: {
    l: (typeof labelEls)[number]
    sx: number
    sy: number
    hw: number
    hh: number
    cle: number
  }[] = []
  for (const l of labelEls) {
    // sous un voile de cachette encore fermé : la pancarte flotterait
    // AU-DESSUS du brouillard et vendrait le secret — elle se tait
    if (dansCacheVoilee(l.x, l.y)) {
      l.span.style.display = 'none'
      l.place = false
      continue
    }
    const sx = cx + (l.x - camera.x) * camera.zoom
    const sy = cy - (l.y - camera.y) * camera.zoom
    const hw = (l.w * scale) / 2 + MARGE_PANCARTE
    const hh = (l.h * scale) / 2 + MARGE_PANCARTE
    // hors champ : rien à dessiner, et surtout aucune place à réserver
    if (sx + hw < 0 || sx - hw > vw || sy + hh < 0 || sy - hh > vh) {
      l.span.style.display = 'none'
      l.place = false
      continue
    }
    // sous les barres d'interface : la pancarte serait masquée à moitié —
    // qu'elle s'efface franchement plutôt que de dépasser d'un bouton
    if (sy - hh < BANDE_HAUTE || sy + hh > vh - bandeBasse) {
      l.span.style.display = ''
      l.span.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`
      l.span.classList.add('efface')
      l.place = false
      continue
    }
    l.span.style.display = ''
    l.span.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%) scale(${scale.toFixed(3)})`
    // clé de service : les secteurs d'abord (rang 0), puis — À RANG ÉGAL —
    // les TITULAIRES avant les prétendants (mémoire d'image en image : une
    // pancarte affichée garde sa place tant qu'elle tient, au lieu de la
    // perdre parce qu'une voisine s'est approchée du centre du regard),
    // enfin du plus proche du centre de l'écran au plus lointain
    const d = Math.hypot(sx - cx, sy - cy)
    candidats.push({
      l,
      sx,
      sy,
      hw,
      hh,
      cle: (l.secteur ? 0 : 1e7) + (l.place ? 0 : 5e6) + d,
    })
  }
  candidats.sort((a, b) => a.cle - b.cle)
  const places: typeof candidats = []
  for (const c of candidats) {
    // Hystérésis : un titulaire tolère un léger chevauchement (le zoom
    // respire sans faire clignoter la plaque) ; un prétendant doit entrer
    // avec la marge pleine. L'apparition reste progressive, sans va-et-vient.
    const marge = c.l.place ? -8 : 0
    const gene = places.some(
      (p) =>
        Math.abs(p.sx - c.sx) < p.hw + c.hw + marge &&
        Math.abs(p.sy - c.sy) < p.hh + c.hh + marge,
    )
    c.l.span.classList.toggle('efface', gene)
    c.l.place = !gene
    if (!gene) places.push(c)
  }
}
applyLevel()

const canvas = document.getElementById('glcanvas') as HTMLCanvasElement
const overlay = document.getElementById('overlay') as HTMLDivElement
const overlayTitle = document.getElementById('overlay-title') as HTMLDivElement
const overlaySub = document.getElementById('overlay-sub') as HTMLDivElement

const el = (id: string) => document.getElementById(id) as HTMLElement
const hudTableau = el('hud-tableau')
const hudVies = el('hud-vies')
const hudViesChip = el('hud-vies-chip') as HTMLButtonElement
const bonbonneEl = el('bonbonne') as HTMLButtonElement
// le groupe du liquide : on le fait GLISSER dans le verre (translateY en
// unités du viewBox) — l'intérieur est clippé, le niveau se lit tout seul
const bbLiquide = document.getElementById('bb-liquide') as SVGGElement | null
// le niveau AFFICHÉ court après le niveau réel : la réserve monte et descend
// à vue, jamais d'un coup — c'est là qu'est le plaisir
let bbAffiche = 0
let bbPresenteA = -1 // instant de la dernière présentation (début de tableau)
const hudBonbonne = el('hud-bonbonne')
const hudCondChip = el('hud-cond-chip') as HTMLButtonElement
const hudCond = el('hud-cond')
const hudCoque = el('hud-coque')
const hudVolume = el('hud-volume')
const hudSeuil = el('hud-seuil')
const hudVitesse = el('hud-vitesse')
const hudState = el('hud-state')
const hudWarp = el('hud-warp')
const gaugeFill = el('gauge-fill')
const gaugeThreshold = el('gauge-threshold')
const hudPerte = el('hud-perte')
const hudRosee = el('hud-rosee')
const hudDanger = el('hud-danger')
const coqueBar = el('coque-bar').firstElementChild as HTMLElement
const objArrow = el('obj-arrow')
const objArrowGlyph = objArrow.firstElementChild as HTMLElement
const objDist = el('obj-dist')
const homeVolume = el('home-volume')
const homeParticles = el('home-particles')
const homeState = el('home-state')
const recEssai = el('rec-essai')
const recRows = el('rec-rows')

// Le tableau d'honneur partagé (/api/records) : chargé au démarrage, mis à
// jour à chaque record publié. Hors ligne, les registres locaux suffisent.
let sharedBoard: SharedBoard | null = null
fetchSharedBoard().then((b) => {
  if (b) {
    sharedBoard = b
    renderRegistres()
  }
})

// Écran record de la fiche : DEUX colonnes par salle — 💧 VOLUME (le
// meilleur du protocole partagé prime sur le local) et ⏱ CHRONO (vos
// meilleurs temps, tenus en local). Le détenteur signe chaque record.
function renderRegistres(): void {
  recEssai.textContent = `ÉCHANTILLON Nº ${records.essaiNumber()}`
  const moi = records.operator()
  const signe = (name: string): string =>
    name
      ? `<i class="rec-qui${name === moi ? ' rec-moi' : ''}">${htmlSafe(name)}</i>`
      : ''
  // Le panneau est le CONDENSÉ de l'écran RECORDS : le palmarès partagé
  // (note, volume, chrono — rang 1 de chaque podium), seules les salles
  // qui ONT un palmarès s'affichent, bornées pour tenir SANS défilement.
  // Le détail (top 5, trophées) vit derrière le bouton RECORDS.
  const rows: string[] = []
  const tops = sharedBoard?.tops ?? {}
  let affichees = 0
  let cachees = 0
  for (const t of playedLevels()) {
    const top = tops[t.code]
    if (!top || top.note.length === 0) continue
    if (affichees >= 9) {
      cachees++
      continue
    }
    affichees++
    const n0 = top.note[0]
    const v0 = top.volume[0]
    const c0 = top.chrono[0]
    rows.push(
      `<div class="rec-row"><span class="rec-code">${t.code}</span><span class="rec-name">${t.name}</span>` +
        `<span class="rec-val rec-note"><b>${n0.note} pts</b> ${signe(n0.name)}</span>` +
        `<span class="rec-val rec-vol"><b>${fmtL(v0?.liters ?? 0)}</b> ${signe(v0?.name ?? '')}</span>` +
        `<span class="rec-val rec-chr"><b>${fmtTime(c0?.time ?? 0)}</b> ${signe(c0?.name ?? '')}</span></div>`,
    )
  }
  if (rows.length > 0) {
    rows.unshift(
      `<div class="rec-row rec-titres"><span class="rec-code"></span><span class="rec-name">SALLE</span>` +
        `<span class="rec-val rec-note">★ NOTE</span>` +
        `<span class="rec-val rec-vol">💧 VOLUME</span><span class="rec-val rec-chr">⏱ CHRONO</span></div>`,
    )
  } else {
    rows.push(
      '<div class="rec-hist">Le palmarès est à prendre : chaque collecte y inscrit sa note, son volume et son chrono.</div>',
    )
  }
  if (cachees > 0) {
    rows.push(
      `<div class="rec-hist">+ ${cachees} autre(s) salle(s) au palmarès — bouton RECORDS.</div>`,
    )
  }
  // le palmarès de LA VOIE : la ligne qui donne envie de redescendre
  {
    const palm = chargePalmaresVoie()
    if (palm.descentes > 0) {
      rows.push(
        `<div class="rec-hist">⑂ LA VOIE : ${palm.bouclees} bouclée(s) sur ${palm.descentes} descente(s) · profondeur record ${palm.profondeurRecord} · meilleur livré ${fmtL(palm.meilleurLivre)}</div>`,
      )
    }
  }
  const localExp = records.expedition()
  const sharedExp = sharedBoard?.expedition ?? null
  const exp =
    sharedExp &&
    (!localExp ||
      sharedExp.tableaux > localExp.tableaux ||
      (sharedExp.tableaux === localExp.tableaux &&
        (sharedExp.liters > localExp.liters ||
          (sharedExp.liters === localExp.liters &&
            sharedExp.time < localExp.time))))
      ? sharedExp
      : localExp
  if (exp) {
    rows.unshift(
      `<div class="rec-row rec-exp"><span class="rec-code">EXPÉDITION</span><span class="rec-name"></span>` +
        `<span class="rec-val" style="grid-column: span 2"><b>${exp.tableaux}/${playedLevels().length} salles</b> · 💧 ${fmtL(exp.liters)} · ⏱ ${fmtDuree(exp.time)} ${
          exp.name
            ? `<i class="rec-qui${exp.name === moi ? ' rec-moi' : ''}">${htmlSafe(exp.name)}</i>`
            : ''
        }</span></div>`,
    )
  }
  recRows.innerHTML = rows.join('')
}
renderRegistres()

// Le nom estampillé sur les records, façon borne d'arcade — et obligatoire :
// le protocole n'admet pas d'opérateur anonyme dans la cuve.
const recName = document.getElementById('rec-name') as HTMLInputElement
const recNeed = document.getElementById('rec-need') as HTMLDivElement
recName.value = records.operator()
recName.addEventListener('input', () => {
  if (recName.value.trim()) {
    recName.classList.remove('need')
    recNeed.hidden = true
  }
})
recName.addEventListener('change', () => {
  records.setOperator(recName.value)
  recName.value = records.operator()
  renderRegistres()
})

// La fiche s'ouvre EN HAUT, toujours : le navigateur restaure sinon le
// défilement de la visite précédente une demi-seconde après l'affichage —
// le titre devenait inaccessible sans remonter à la main (constaté).
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
window.scrollTo(0, 0)
requestAnimationFrame(() => {
  window.scrollTo(0, 0)
  const homeEl = document.getElementById('home')
  if (homeEl) homeEl.scrollTop = 0
})

// ---- Voile de SIGNATURE (premier lancement) : le nom, et le geste qui
// éveille l'audio. Il couvre tout : aucun clic inopiné ne part vers la
// fiche ou la cuve tant qu'on n'a pas signé. La clé versionnée le montre
// UNE fois par version — y compris aux joueurs d'avant le voile.
{
  const sigEl = document.getElementById('signature') as HTMLDivElement
  const sigNom = document.getElementById('sig-nom') as HTMLInputElement
  const signer = (): void => {
    const nom = sigNom.value.trim()
    if (!nom) {
      sigNom.classList.remove('need')
      void sigNom.offsetWidth
      sigNom.classList.add('need')
      sigNom.focus()
      return
    }
    records.setOperator(nom)
    recName.value = records.operator()
    // le clic de signature EST le geste utilisateur : l'audio s'éveille là
    audio.resume()
    bande.eveiller()
    majInviteSon()
    renderRegistres()
    try {
      localStorage.setItem('sujet21-signature-v1', '1')
    } catch {
      // sans gravité : le voile se remontrerait, simple re-clic
    }
    sigEl.hidden = true
  }
  document.getElementById('sig-valider')?.addEventListener('click', signer)
  sigNom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') signer()
  })
  // les clics sur le voile ne traversent jamais (pas de fermeture au fond :
  // signer est le seul chemin — c'est un portail, pas un popup)
  sigEl.addEventListener('pointerdown', (e) => e.stopPropagation())
  // Le voile se montre au premier lancement — ET une fois aux joueurs qui
  // ont un nom d'AVANT le voile : ils re-signent (champ PRÉ-REMPLI, un
  // clic suffit) et le son s'éveille par la même occasion. La clé versionnée
  // garantit « une fois » ; la re-signature n'efface aucun record.
  const CLE_SIGNATURE = 'sujet21-signature-v1'
  if (!records.operator() || !localStorage.getItem(CLE_SIGNATURE)) {
    sigNom.value = records.operator()
    sigEl.hidden = false
    // le focus attend une image : le champ existe et la fiche est posée —
    // pas de défilement parasite ni de clavier mobile ouvert sur du vide
    requestAnimationFrame(() => sigNom.focus({ preventScroll: true }))
  }
}

// La plongée exige un nom : on interpelle le champ au lieu d'ouvrir la cuve.
function requireName(): boolean {
  // le champ peut être rempli sans avoir encore perdu le focus (pas de change)
  if (recName.value.trim()) records.setOperator(recName.value)
  if (records.operator()) return false
  // sur mobile, les registres (et leur champ de nom) vivent derrière le
  // bouton RECORDS : on ouvre le voile pour montrer où signer
  if (recName.offsetParent === null) ouvrirRecs()
  recNeed.hidden = false
  recName.classList.remove('need')
  void recName.offsetWidth // relance l'animation de secousse
  recName.classList.add('need')
  recName.scrollIntoView({ block: 'center', behavior: 'smooth' })
  recName.focus({ preventScroll: true })
  return true
}
const tableauCard = el('tableau-card')

// Carton d'ouverture : l'entrée du journal de bord du tableau. Il RESTE
// affiché tant qu'on ne l'a pas fermé à la croix — lire ne se chronomètre
// pas (l'effacement automatique partait trop vite).
// Le carton de journal (signé Dr N. Véga) ne s'affiche PLUS : retour
// joueur — un popup à fermer à chaque tableau n'est pas ergonomique. Le
// texte reste dans les tableaux (éditeur, champ journal) si on veut le
// réutiliser autrement un jour.
function showTableauCard(): void {
  // volontairement vide — aucun carton ne s'affiche
}
document.getElementById('card-fermer')?.addEventListener('click', () => {
  tableauCard.classList.remove('visible')
})

// Fiche d'essai : visible au chargement ; « échap » ou ≡ pour y revenir.
// L'essai continue de dériver derrière la fiche — elle observe, elle ne fige pas.
const startBtn = document.getElementById('start') as HTMLButtonElement
let hasPlayed = false
// ---- Onboarding tactile : trois gestes, montrés une fois, au premier
// lancement sur écran tactile. Le voile intercepte les touchers (il couvre
// le canvas) et fige l'essai le temps de la lecture.
const onboardEl = document.getElementById('onboard') as HTMLDivElement
let obEtape = 0
// La prise en main se montre PARTOUT : cartes tactiles au doigt, cartes
// souris/clavier ailleurs — chaque mode a sa propre mémoire (on peut
// découvrir le jeu au bureau puis sur téléphone, chaque main a sa leçon).
const obTactile = (): boolean => window.matchMedia('(pointer: coarse)').matches
const obCle = (): string =>
  obTactile() ? 'projet21.onboard.v1' : 'projet21.onboard.pc.v1'
// L'ÉVEIL (la prise en main scénarisée) a sa propre clé — versionnée : en
// changer la version rejoue l'éveil à tout le monde. Déclarée ici car
// le chargement (plus bas) doit savoir s'il faut geler l'échantillon.
// v2 : l'éveil finalisé (bouton CONTINUER, dizaine d'impulsions, ralenti
// + fondus) se rejoue une fois pour tous — même les premiers testeurs.
const CLE_EVEIL = 'sujet21-eveil-v3' // v3 : l'accident du télescope — l'acte 0 se rejoue pour tous
function eveilJoue(): boolean {
  try {
    return !!localStorage.getItem(CLE_EVEIL)
  } catch {
    return true // stockage muet : ne jamais enfermer le joueur
  }
}
// Cartes gestuelles MISES DE CÔTÉ : l'ÉVEIL les remplace au premier
// lancement. Le code et les cartes restent entiers au cas où — remettre
// ce drapeau à true les rendrait au premier plan.
const CARTES_GESTES: boolean = false
function majOnboard(): void {
  const etapes = Array.from(
    onboardEl.querySelectorAll<HTMLElement>('.ob-etape'),
  )
  etapes.forEach((e, i) => {
    e.hidden = i !== obEtape
  })
  const points = Array.from(
    onboardEl.querySelectorAll<HTMLElement>('.ob-points i'),
  )
  points.forEach((p, i) => p.classList.toggle('on', i === obEtape))
  const suite = onboardEl.querySelector<HTMLElement>('.ob-suite')
  if (suite) {
    const geste = obTactile() ? 'TOUCHER' : 'CLIQUER'
    suite.textContent =
      obEtape >= 4 ? `${geste} POUR PLONGER` : `${geste} POUR CONTINUER`
  }
}
function montrerOnboard(): void {
  if (!CARTES_GESTES) return
  if (localStorage.getItem(obCle())) return
  onboardEl.dataset.mode = obTactile() ? 'tactile' : 'pc'
  obEtape = 0
  majOnboard()
  onboardEl.hidden = false
  input.paused = true
  input.gelees = true // AUCUNE commande de jeu pendant la prise en main
}
function avanceOnboard(): void {
  obEtape++
  if (obEtape > 4) {
    onboardEl.hidden = true
    try {
      localStorage.setItem(obCle(), '1')
    } catch {
      // stockage refusé : l'onboarding se remontrera, sans gravité
    }
    input.paused = false
    input.gelees = false
  } else {
    majOnboard()
  }
}
onboardEl.addEventListener('pointerdown', (e) => {
  e.stopPropagation()
  e.preventDefault()
  avanceOnboard()
})

// Le verrou de rotation existe : « continuer en portrait » retire le voile
document.getElementById('tourner-quand-meme')?.addEventListener('click', () => {
  document.body.classList.add('portrait-ok')
})

// ---- Le voile RECORDS (mobile) : les registres se déplacent dedans ----
const recsEl = document.getElementById('recs') as HTMLDivElement
const recsBoite = recsEl.querySelector('.recs-boite') as HTMLDivElement
const recsBloc = document.querySelector('.home-records') as HTMLDivElement
const recsParent = recsBloc.parentElement as HTMLElement
function ouvrirRecs(): void {
  recsBoite.appendChild(recsBloc) // le bloc déménage dans le voile
  recsEl.hidden = false
}
function fermerRecs(): void {
  recsEl.hidden = true
  recsParent.appendChild(recsBloc) // et revient à sa place sur la fiche
}
recsEl.addEventListener('pointerdown', (e) => {
  if (e.target === recsEl) fermerRecs()
})

// ---- Le voile SALLES : charger n'importe quel tableau, à l'essai ----
// La liste se RECONSTRUIT à chaque changement de bibliothèque : les salles
// de l'éditeur (dans l'ordre fixé là-bas) s'affichent en tête quand la
// bibliothèque partagée en contient, au-dessus de l'expédition livrée.
const sallesEl = document.getElementById('salles') as HTMLDivElement
// Tri du voile : l'ordre de l'éditeur (défaut), ou l'un des trois chiffres
// du CODE ATELIER (« 111 » : phase · mécanique requise · difficulté). Les
// codes hors convention se rangent après, dans l'ordre de l'éditeur.
let sallesTri: 'editeur' | 'moment' | 'meca' | 'diff' = 'editeur'
// le MOMENT en un mot, pour les pastilles et la carte de couverture
const MOMENT_COURT: Record<CodeAtelier['moment'], string> = {
  1: 'DÉBUT',
  2: 'MILIEU',
  3: 'FIN',
}
// Filtres par les chiffres du code : null = tout montrer. Quand un filtre
// est actif, seuls les codes atelier peuvent répondre — les autres (livrés
// 21-A, HUB…) sont masqués, et la section le dit.
let sallesFiltreMeca: CodeAtelier['mecanique'] | null = null
let sallesFiltreDiff: number | null = null
let sallesCouvVisible = false
function renderSalles(): void {
  const liste = document.getElementById('salles-liste') as HTMLDivElement
  liste.innerHTML = ''
  const esc = (t: string): string =>
    t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const section = (titre: string): void => {
    const h = document.createElement('div')
    h.className = 'salles-sec'
    h.textContent = titre
    liste.appendChild(h)
  }
  const salle = (lv: LevelDef): void => {
    const b = document.createElement('button')
    b.type = 'button'
    const d = decodeCodeAtelier(lv.code)
    const chips = d
      ? `<span class="salle-chips"><i>${MOMENT_COURT[d.moment]}</i>` +
        `<i class="sc-m${d.mecanique}">${MECANIQUE_NOMS[d.mecanique].toUpperCase()}</i>` +
        `<i>DIFF ${d.difficulte}</i></span>`
      : ''
    b.innerHTML = `<b>${esc(lv.code)}</b><span class="salle-nom">${esc(lv.name)}</span>${chips}`
    b.addEventListener('click', () => {
      sallesEl.hidden = true
      startTest([lv])
    })
    liste.appendChild(b)
  }
  let enSequence = libraryLevels.filter((l) => !estCodeHub(l.code))
  const decodes = enSequence
    .map((lv) => decodeCodeAtelier(lv.code))
    .filter((d): d is CodeAtelier => d !== null)

  // ---- les FILTRES : mécanique et difficulté, bâtis sur ce qui existe ----
  const filtres = document.getElementById('salles-filtres') as HTMLDivElement
  if (decodes.length === 0) {
    filtres.innerHTML = ''
    sallesFiltreMeca = null
    sallesFiltreDiff = null
  } else {
    const mecas = [...new Set(decodes.map((d) => d.mecanique))].sort()
    const diffs = [...new Set(decodes.map((d) => d.difficulte))].sort(
      (a, b) => a - b,
    )
    const chip = (
      groupe: 'fm' | 'fd',
      valeur: number | null,
      texte: string,
      actif: boolean,
    ): string =>
      `<button type="button" data-${groupe}="${valeur ?? ''}"${actif ? ' class="actif"' : ''}>${texte}</button>`
    filtres.innerHTML =
      `<span>MÉCANIQUE</span>` +
      chip('fm', null, 'TOUT', sallesFiltreMeca === null) +
      mecas
        .map((m) =>
          chip(
            'fm',
            m,
            MECANIQUE_NOMS[m].toUpperCase(),
            sallesFiltreMeca === m,
          ),
        )
        .join('') +
      `<span style="margin-left:8px">DIFFICULTÉ</span>` +
      chip('fd', null, 'TOUT', sallesFiltreDiff === null) +
      diffs
        .map((d) => chip('fd', d, String(d), sallesFiltreDiff === d))
        .join('')
    for (const b of Array.from(filtres.querySelectorAll('button'))) {
      b.addEventListener('click', () => {
        if (b.dataset.fm !== undefined) {
          sallesFiltreMeca =
            b.dataset.fm === ''
              ? null
              : (Number(b.dataset.fm) as CodeAtelier['mecanique'])
        } else {
          sallesFiltreDiff = b.dataset.fd === '' ? null : Number(b.dataset.fd)
        }
        renderSalles()
      })
    }
  }

  // ---- la CARTE DE COUVERTURE : salles par case phase × difficulté ----
  const couv = document.getElementById('salles-couv') as HTMLDivElement
  couv.hidden = !sallesCouvVisible
  document
    .getElementById('salles-couv-btn')
    ?.classList.toggle('actif', sallesCouvVisible)
  if (sallesCouvVisible) {
    if (decodes.length === 0) {
      couv.innerHTML =
        '<p class="couv-note">Aucune salle au code atelier (« 111 ») dans la bibliothèque : rien à cartographier.</p>'
    } else {
      const pMin = Math.min(...decodes.map((d) => d.moment))
      const pMax = Math.max(...decodes.map((d) => d.moment))
      const dMin = Math.min(...decodes.map((d) => d.difficulte))
      const dMax = Math.max(...decodes.map((d) => d.difficulte))
      let html = '<table><tr><th></th>'
      for (let df = dMin; df <= dMax; df++) html += `<th>DIFF ${df}</th>`
      html += '</tr>'
      for (let p = pMin; p <= pMax; p++) {
        html += `<tr><th>${MOMENT_COURT[p as CodeAtelier['moment']]}</th>`
        for (let df = dMin; df <= dMax; df++) {
          const dedans = enSequence
            .map((lv) => ({ lv, d: decodeCodeAtelier(lv.code) }))
            .filter(
              (x): x is { lv: LevelDef; d: CodeAtelier } =>
                x.d !== null && x.d.moment === p && x.d.difficulte === df,
            )
          if (dedans.length === 0) {
            html += '<td class="vide">—</td>'
            continue
          }
          const noms = dedans.map(
            (x) =>
              `${x.lv.code} ${x.lv.name} (${MECANIQUE_NOMS[x.d.mecanique]})`,
          )
          // un point par MÉCANIQUE présente dans la case, couleur des chips
          const mecas = [...new Set(dedans.map((x) => x.d.mecanique))].sort()
          const points = mecas
            .map((m) => `<i class="cm-${m}" title="${MECANIQUE_NOMS[m]}"></i>`)
            .join('')
          html += `<td class="plein" title="${esc(noms.join('\n'))}">${dedans.length}<span class="couv-mecas">${points}</span></td>`
        }
        html += '</tr>'
      }
      html +=
        '</table><p class="couv-note">Chaque case compte les salles de la bibliothèque — les « — » sont les trous à combler. Les points donnent les mécaniques présentes (gris aucune · bleu glace · ambre vapeur · violet toutes) ; survolez une case pour lire les noms.</p>'
      couv.innerHTML = html
    }
  }

  // ---- le TRI, puis le FILTRE, puis la liste ----
  if (sallesTri !== 'editeur') {
    const rang = (d: CodeAtelier): number =>
      sallesTri === 'moment'
        ? d.moment
        : sallesTri === 'meca'
          ? d.mecanique
          : d.difficulte
    // tri STABLE : à égalité, l'ordre de l'éditeur tient ; le chiffre choisi
    // prime, les deux autres départagent (phase, puis mécanique, puis diff)
    enSequence = [...enSequence].sort((a, b) => {
      const da = decodeCodeAtelier(a.code)
      const db = decodeCodeAtelier(b.code)
      if (!da && !db) return 0
      if (!da) return 1
      if (!db) return -1
      return (
        rang(da) - rang(db) ||
        da.moment - db.moment ||
        da.mecanique - db.mecanique ||
        da.difficulte - db.difficulte
      )
    })
  }
  const filtreActif = sallesFiltreMeca !== null || sallesFiltreDiff !== null
  if (filtreActif) {
    enSequence = enSequence.filter((lv) => {
      const d = decodeCodeAtelier(lv.code)
      if (!d) return false
      if (sallesFiltreMeca !== null && d.mecanique !== sallesFiltreMeca)
        return false
      if (sallesFiltreDiff !== null && d.difficulte !== sallesFiltreDiff)
        return false
      return true
    })
    section(
      enSequence.length > 0
        ? 'BIBLIOTHÈQUE DU LABO — filtrée par le code atelier (les codes hors convention sont masqués)'
        : 'Aucune salle ne répond à ce filtre — TOUT le retire.',
    )
    for (const lv of enSequence) salle(lv)
    return
  }
  if (enSequence.length > 0) {
    section(
      sallesTri === 'editeur'
        ? 'BIBLIOTHÈQUE DU LABO — en tête de séquence, dans l’ordre de l’éditeur'
        : 'BIBLIOTHÈQUE DU LABO — triée par le code atelier',
    )
    for (const lv of enSequence) salle(lv)
    section('EXPÉDITION LIVRÉE — elle s’enchaîne à la suite')
  }
  for (const lv of [...TABLEAUX_ECOLE, ...TABLEAUX, TABLEAU_1BIS]) salle(lv)
  // LE BUTIN DE LA VOIE : les salles générées élues pendant les descentes
  // semi-procédurales — retenues sur ce poste, rejouables, publiables
  const butin = chargeButin()
  if (butin.length > 0) {
    section(
      'LE BUTIN DE LA VOIE — les salles générées élues en descente (ce poste)',
    )
    for (const e of butin) {
      const ligne = document.createElement('div')
      ligne.className = 'salle-butin'
      const dg = /^G-(\d)(\d)(\d)-/.exec(e.level.code)
      const chips = dg
        ? `<span class="salle-chips"><i>${MOMENT_COURT[Number(dg[1]) as CodeAtelier['moment']]}</i>` +
          `<i class="sc-m${dg[2]}">${MECANIQUE_NOMS[Number(dg[2]) as CodeAtelier['mecanique']].toUpperCase()}</i>` +
          `<i>DIFF ${dg[3]}</i></span>`
        : ''
      const dt = new Date(e.eluAt)
      const quand = Number.isNaN(dt.getTime())
        ? ''
        : `élue le ${dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} à ${dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
      const b = document.createElement('button')
      b.type = 'button'
      b.title = 'Rejouer cette salle générée (essai)'
      b.innerHTML =
        `<b>${esc(e.level.code)}</b><span class="salle-nom">${esc(e.level.name)}</span>` +
        `<small class="salle-butin-date">${quand}</small>${chips}`
      b.addEventListener('click', () => {
        sallesEl.hidden = true
        startTest([structuredClone(e.level)])
      })
      const pub = document.createElement('button')
      pub.type = 'button'
      pub.className = 'salle-butin-act'
      pub.textContent = e.publie ? '✓ PUBLIÉE' : '⇪ PUBLIER'
      pub.disabled = !!e.publie
      pub.title =
        'Publier cette salle dans la BIBLIOTHÈQUE PARTAGÉE (en fin de séquence) — elle apparaîtra dans la planche et l’éditeur, réordonnable comme les autres'
      pub.addEventListener('click', () => {
        pub.disabled = true
        pub.textContent = '…'
        void saveLevel(
          structuredClone(e.level),
          '',
          records.operator() || 'anonyme',
        ).then((saved) => {
          if (saved) {
            const maj = chargeButin()
            const mienne = maj.find((x) => x.level.code === e.level.code)
            if (mienne) mienne.publie = true
            sauveButin(maj)
            plancheSync(saved.levels) // bibliothèque, planche, salles : tout suit
          } else {
            pub.disabled = false
            pub.textContent = 'INJOIGNABLE — RÉESSAYER'
          }
        })
      })
      const sup = document.createElement('button')
      sup.type = 'button'
      sup.className = 'salle-butin-act'
      sup.textContent = '✕'
      sup.title = 'Retirer du butin (la salle reste regénérable par son code)'
      sup.addEventListener('click', () => {
        sauveButin(chargeButin().filter((x) => x.level.code !== e.level.code))
        renderSalles()
      })
      ligne.append(b, pub, sup)
      liste.appendChild(ligne)
    }
  }
  // LE CABINET LOGIQUE : les mécanismes détournés en algèbre booléenne —
  // des démonstrations à l'essai, volontairement hors expédition et hors
  // accueil (l'écran SALLES est déjà l'antichambre du concepteur)
  section(
    'LE CABINET LOGIQUE — pastilles et portes en algèbre booléenne (démonstration)',
  )
  for (const lv of CIRCUITS) salle(lv)
}
renderSalles()
{
  const boutons = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      '#salles-outils button[data-tri]',
    ),
  )
  for (const btn of boutons) {
    btn.addEventListener('click', () => {
      sallesTri = (btn.dataset.tri as typeof sallesTri) ?? 'editeur'
      for (const b of boutons) b.classList.toggle('actif', b === btn)
      renderSalles()
    })
  }
  document.getElementById('salles-couv-btn')?.addEventListener('click', () => {
    sallesCouvVisible = !sallesCouvVisible
    renderSalles()
  })
}
document.getElementById('home-salles')?.addEventListener('click', () => {
  sallesEl.hidden = false
})
// ---- Le voile NOTES DE VERSION : le journal du chantier, sorti du banc ----
// Chaque entrée peut porter une illustration (champ figure) et affiche la
// version qu'elle a inaugurée ; le bouton TÉLÉCHARGER exporte tout le
// journal en Markdown, hors ligne compris.
const livraisonsEl = document.getElementById('livraisons') as HTMLDivElement
{
  // la version, affichée partout depuis la même source : sous le titre de
  // la fiche (en petit) et dans l'en-tête du voile
  const versionJeu = document.getElementById('version-jeu')
  if (versionJeu) versionJeu.textContent = `v${VERSION} — prototype`

  // ---- MODE CONCEPTEUR : deux accueils dans le même jeu ----
  // L'accueil PUBLIC ne montre que l'essentiel (jouer, records, codex,
  // commandes, paramètres) ; le mode concepteur rallume les outils
  // (éditeur, montage, salles, pupitre…). Il se gagne par ?dev dans l'URL,
  // ou par 7 TOUCHERS sur le numéro de version — Steam Deck et mobile
  // n'ont pas de barre d'adresse sous la main. ?dev=0 le rend.
  const CLE_CONCEPTEUR = 'projet21.concepteur.v1'
  const concepteurActif = (): boolean => {
    try {
      return localStorage.getItem(CLE_CONCEPTEUR) === '1'
    } catch {
      return false
    }
  }
  const poseConcepteur = (on: boolean): void => {
    try {
      if (on) localStorage.setItem(CLE_CONCEPTEUR, '1')
      else localStorage.removeItem(CLE_CONCEPTEUR)
    } catch {
      // stockage refusé : le mode ne tiendra que la session — sans gravité
    }
    document.body.classList.toggle('concepteur', on)
  }
  {
    const q = new URLSearchParams(location.search)
    if (q.get('dev') === '0') poseConcepteur(false)
    else if (q.has('dev')) poseConcepteur(true)
    else document.body.classList.toggle('concepteur', concepteurActif())
  }
  let tapsVersion = 0
  let dernierTapVersion = 0
  versionJeu?.addEventListener('pointerdown', () => {
    const t = performance.now()
    if (t - dernierTapVersion > 1600) tapsVersion = 0
    dernierTapVersion = t
    tapsVersion++
    if (tapsVersion < 7) return
    tapsVersion = 0
    const on = !concepteurActif()
    poseConcepteur(on)
    const avant = versionJeu.textContent
    versionJeu.textContent = on
      ? 'MODE CONCEPTEUR ACTIVÉ'
      : 'ACCUEIL PUBLIC RÉTABLI'
    window.setTimeout(() => {
      versionJeu.textContent = avant
    }, 2200)
  })
  const livVersion = document.getElementById('liv-version')
  if (livVersion) livVersion.textContent = `le jeu est en v${VERSION}`
  const corps = document.getElementById('livraisons-corps') as HTMLDivElement
  let rendu = false
  // Le journal n'est plus dans le paquet : il arrive à la PREMIÈRE
  // ouverture de l'écran. Le voile s'affiche tout de suite, la liste se
  // remplit un instant après — sur un écran que l'on vient d'ouvrir, cela
  // ne se voit pas ; dans le paquet de tous les joueurs, cela se voyait.
  const renderLivraisons = async (): Promise<void> => {
    if (rendu) return
    rendu = true
    const DELIVERIES = await litLivraisons()
    const esc = (t: string): string => t.replace(/</g, '&lt;')
    // L'ESSENTIEL — le récap éclair des dernières 24 h : une ligne par
    // livraison (heure + titre), pour embrasser la journée avant le détail
    const litDate = (d: string): number => {
      const m = /^(\d\d)\/(\d\d)\/(\d{4}) (\d\d):(\d\d)$/.exec(d.trim())
      if (!m) return NaN
      return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]).getTime()
    }
    const aujourdhui = new Date()
    const jourDe = (t: number): string =>
      new Date(t).getDate() === aujourdhui.getDate() ? '' : 'hier '
    const fraiches = DELIVERIES.map((d) => ({ d, t: litDate(d.date) })).filter(
      (x) => Number.isFinite(x.t) && Date.now() - x.t < 24 * 3600_000,
    )
    const recap =
      fraiches.length >= 2
        ? `<div class="liv-recap"><h3>L’ESSENTIEL — DERNIÈRES 24 H (${fraiches.length} livraisons)</h3>` +
          fraiches
            .map(
              (x) =>
                `<div class="liv-r"><time>${jourDe(x.t)}${x.d.date.slice(11)}</time><span>${esc(x.d.title)}</span></div>`,
            )
            .join('') +
          `</div>`
        : ''
    corps.innerHTML =
      recap +
      DELIVERIES.map(
        (d, i) =>
          `<div class="liv-e"><h3>${esc(d.title)}</h3>` +
          `<time>v${versionDe(i)} · ${esc(d.date)}</time>` +
          (d.figure ? `<img src="${d.figure}" alt="" loading="lazy" />` : '') +
          `<ul>${d.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`,
      ).join('')
  }
  document.getElementById('home-livraisons')?.addEventListener('click', () => {
    void renderLivraisons()
    livraisonsEl.hidden = false
  })
  document
    .getElementById('livraisons-fermer')
    ?.addEventListener('click', () => {
      livraisonsEl.hidden = true
    })
  livraisonsEl.addEventListener('pointerdown', (e) => {
    if (e.target === livraisonsEl) livraisonsEl.hidden = true
  })
  document.getElementById('livraisons-dl')?.addEventListener('click', () => {
    void (async () => {
    const DELIVERIES = await litLivraisons()
    const md =
      `# Sujet 21 — notes de version (v${VERSION})\n\n` +
      DELIVERIES.map(
        (d, i) =>
          `## v${versionDe(i)} — ${d.date} — ${d.title}\n\n${d.notes.map((n) => `- ${n}`).join('\n')}\n`,
      ).join('\n')
    const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'sujet21-notes-de-version.md'
    a.click()
    URL.revokeObjectURL(url)
    })()
  })
}

// ---- Compteur de FPS permanent (réglage du voile PARAMÈTRES) ----
const fpsCoin = document.getElementById('fps-coin') as HTMLDivElement
let fpsAffiche = localStorage.getItem('sujet21-fps-aff') === '1'
fpsCoin.hidden = !fpsAffiche
let fpsCoinTimer = 0
function majFpsCoin(dtReal: number): void {
  if (!fpsAffiche) return
  fpsCoinTimer += dtReal
  if (fpsCoinTimer < 0.25) return
  fpsCoinTimer = 0
  fpsCoin.textContent = `${Math.round(fpsSmoothed)} im/s`
}

// ---- Trophées du protocole : succès internes, prêts pour Steam ----
// Les déblocages passent par un toast (la petite fanfare) ; la page vit
// dans le voile RECORDS. Détection par échantillonnage léger (4 Hz).
const trophees = new Trophees()
const tropheeToast = document.getElementById('trophee-toast') as HTMLDivElement
// LE GENRE D'UNE RÉCOMPENSE : six natures partageaient un seul bandeau
// gris — trophée, fiche de codex, éclat de mémoire, fiole, achat. Le genre
// leur donne une couleur et un cartouche, pour qu'on sache d'un coup d'œil
// ce qu'on vient de gagner. Il se DÉDUIT de l'étiquette déjà passée : aucun
// appelant n'a à changer, chacun pourra le préciser ensuite.
type ToastGenre = 'trophee' | 'codex' | 'eclat' | 'fiole' | 'achat'
const toastFile: {
  nom: string
  icone: string
  sur?: string
  fiche?: string
  genre?: ToastGenre
  // l'article du méta, quand il y en a un : son icône vient alors de LA
  // PLANCHE (la même sur toutes les machines), pas d'un emoji système
  article?: string
}[] = []
function toastGenre(t: {
  sur?: string
  fiche?: string
  genre?: ToastGenre
}): ToastGenre {
  if (t.genre) return t.genre
  if (t.fiche) return 'codex'
  const sur = (t.sur ?? '').toUpperCase()
  if (sur.includes('CODEX')) return 'codex'
  if (sur.includes('ÉCLAT')) return 'eclat'
  if (sur.includes('FIOLE')) return 'fiole'
  if (sur.includes('ÉCONOMAT') || sur.includes('COMPTOIR')) return 'achat'
  return 'trophee'
}
const TOAST_TEINTE: Record<ToastGenre, string> = {
  trophee: '#ffd977',
  codex: '#63b7e6',
  eclat: '#c99aff',
  fiole: '#6dffb8',
  achat: '#8fd8c8',
}
// La durée d'un toast se compte en TEMPS RÉEL, pas en temps de rendu : la
// barre de vie qui se vide est une animation CSS (horloge du navigateur),
// et le toast doit disparaître AVEC elle. Le delta est plafonné à une
// demi-seconde pour qu'un onglet caché ne consomme pas la file d'un coup.
let toastTimer = 0
let toastHorloge = 0
trophees.onDebloque = (t) => {
  toastFile.push({ nom: `${t.nom} · +10 mémoire`, icone: t.icone })
  audio.collect()
  // chaque trophée grave sa mémoire — une seule fois, l'amont le garantit
  gagneMemoireRun(10)
}
// Le CODEX partage la fanfare des trophées : même toast, autre étiquette —
// et sa page (fiche d'essai, bouton CODEX) se remplit au fil des découvertes
const codex = new Codex()
codex.onDecouverte = (d) => {
  toastFile.push({
    nom: codexLu(d).titre,
    icone: d.icone,
    sur: 'CODEX — NOUVELLE FICHE',
    fiche: d.id,
  })
  audio.collect()
  renderCodexVoile()
}
function majToast(): void {
  const now = performance.now()
  const dt = toastHorloge > 0 ? Math.min((now - toastHorloge) / 1000, 0.5) : 0
  toastHorloge = now
  if (toastTimer > 0) {
    toastTimer -= dt
    if (toastTimer <= 0) {
      tropheeToast.classList.remove('visible')
      document.body.classList.remove('toast-on')
    }
    return
  }
  const t = toastFile.shift()
  if (!t) return
  // une fiche codex se VISITE : le toast devient un bouton — clic, toucher,
  // ou SELECT à la manette — et le codex s'ouvre, défilé sur la fiche neuve
  const voir = t.fiche
    ? `<em class="tt-voir">${manette.connectee ? 'SELECT · VOIR LA FICHE' : 'VOIR LA FICHE'}</em>`
    : ''
  const genre = toastGenre(t)
  const duree = t.fiche ? 5.2 : 3.8
  tropheeToast.style.setProperty('--tt', TOAST_TEINTE[genre])
  tropheeToast.style.setProperty('--dur', `${duree}s`)
  tropheeToast.dataset.genre = genre
  tropheeToast.innerHTML =
    `<span class="tt-cartouche">${
      t.article ? iconeMetaHTML(t.article, t.icone) : `<i>${t.icone}</i>`
    }</span>` +
    `<span class="tt-corps"><b>${t.sur ?? 'TROPHÉE DÉBLOQUÉ'}</b>` +
    `<span class="tt-nom">${htmlSafe(t.nom)}</span>${voir}</span>` +
    `<span class="tt-vie"></span>`
  if (t.fiche) tropheeToast.dataset.fiche = t.fiche
  else delete tropheeToast.dataset.fiche
  tropheeToast.classList.toggle('cliquable', Boolean(t.fiche))
  // relancer l'entrée quand deux récompenses s'enchaînent : sans ce
  // redémarrage, la seconde hériterait de l'animation déjà consommée
  tropheeToast.classList.remove('visible')
  void tropheeToast.offsetWidth
  tropheeToast.classList.add('visible')
  // le panneau des instruments occupe le MÊME coin : il se décale sous le
  // toast le temps qu'il vive, au lieu de disparaître dessous
  document.documentElement.style.setProperty(
    '--toast-h',
    `${Math.round(tropheeToast.offsetHeight) + 10}px`,
  )
  document.body.classList.add('toast-on')
  toastTimer = duree
}
tropheeToast.addEventListener('click', () => {
  const fiche = tropheeToast.dataset.fiche
  if (!fiche || !tropheeToast.classList.contains('visible')) return
  tropheeToast.classList.remove('visible')
  document.body.classList.remove('toast-on')
  toastTimer = 0
  ouvreCodexSur(fiche)
})
// état de détection par salle — remis à zéro quand la salle change
let tropheeNiveauRef: unknown = null
let gelContinu = 0
let vuEau = -1
let vuGel = -1
let vuVapeur = -1
let tropheeEchant = 0
function updateTrophees(dtReal: number): void {
  majToast()
  if (tropheeNiveauRef !== level) {
    tropheeNiveauRef = level
    gelContinu = 0
    vuEau = -1
    vuGel = -1
    vuVapeur = -1
  }
  if (input.paused || run.ended || sim.dispersed) return
  tropheeEchant += dtReal
  if (tropheeEchant < 0.25) return
  const pas = tropheeEchant
  tropheeEchant = 0
  const n = sim.count
  if (n === 0) return
  let gels = 0
  let gaz = 0
  for (let i = 0; i < n; i++) {
    if (sim.frozen[i] === 1) gels++
    else if (sim.gaseous[i] === 1) gaz++
  }
  // « Palet parfait » : gelé en continu (≥ 80 % du corps) pendant 30 s
  if (gels / n >= 0.8) {
    gelContinu += pas
    if (gelContinu >= 30) trophees.debloque('palet-parfait')
  } else {
    gelContinu = 0
  }
  // « Trois états » : les trois régimes vus dans une fenêtre de 15 s
  if (gels / n >= 0.5) vuGel = elapsed
  else if (gaz / n >= 0.5) vuVapeur = elapsed
  else vuEau = elapsed
  if (vuEau >= 0 && vuGel >= 0 && vuVapeur >= 0) {
    if (elapsed - Math.min(vuEau, vuGel, vuVapeur) < 15)
      trophees.debloque('trois-etats')
  }
  // « Miroir vivant » : un faisceau réfléchi par le corps gelé
  if (!trophees.gagne('miroir-vivant')) {
    for (const vue of laserEtat.vues) {
      if ((vue.rebondsGlace ?? 0) > 0) {
        trophees.debloque('miroir-vivant')
        break
      }
    }
  }
  // « Recondensé » : cinq gouttes de rosée perlées sur cette salle
  if (sim.roseePerlee >= 5) trophees.debloque('recondense')

  // ---- CODEX : les découvertes de la salle, au même échantillonnage ----
  // Les combinaisons état × matériau viennent du solveur (contacts et
  // passages consignés au vol) ; les phénomènes se lisent ici.
  codex.litContacts(sim.codexContacts)
  if (sim.roseePerlee > 0) codex.marque('rosee')
  if (!codex.connu('laser-glace')) {
    for (const vue of laserEtat.vues) {
      if ((vue.rebondsGlace ?? 0) > 0) {
        codex.marque('laser-glace')
        break
      }
    }
  }
  if (!codex.connu('eponge')) {
    for (const sp of sim.sponges) {
      let bu = false
      for (let c = 0; c < sp.saturation.length; c++)
        if (sp.saturation[c] > 0) {
          bu = true
          break
        }
      if (bu) {
        codex.marque('eponge')
        break
      }
    }
  }
  const forceIci = zoneForceAt(level, sim.stats.centroidX, sim.stats.centroidY)
  if (forceIci === 'glace' && gels / n >= 0.5) codex.marque('zone-glace')
  if (forceIci === 'vapeur' && gaz / n >= 0.5) codex.marque('zone-vapeur')
}

// ---- Le voile RECORDS : le palmarès partagé, trois podiums par salle ----
// La NOTE (cL × 60 / (60 + s)) est calculée serveur ET client — même
// formule des deux côtés, l'affichage recalcule pour les vieux rapports.
const recordsEl = document.getElementById('records') as HTMLDivElement
const recordsCorps = document.getElementById('records-corps') as HTMLDivElement
function renderRecordsVoile(): void {
  recordsCorps.innerHTML = '<div class="rec-vide">Chargement du palmarès…</div>'
  void fetchSharedBoard().then((board) => {
    if (!board) {
      recordsCorps.innerHTML =
        '<div class="rec-vide">Palmarès injoignable (hors ligne ou serveur local).</div>'
      return
    }
    const moi = records.operator()
    const esc = (t: string): string => t.replace(/</g, '&lt;')
    const podium = (
      titre: string,
      liste: { name: string; note: number; liters: number; time: number }[],
      fmt: (e: { note: number; liters: number; time: number }) => string,
      brut: (e: { note: number; liters: number; time: number }) => number,
      desc: boolean,
    ): string => {
      const meilleurs = liste.slice(0, 5)
      const medailles = ['①', '②', '③', '4.', '5.']
      let h = `<div class="rec-pod"><h4>${titre}</h4>`
      for (let i = 0; i < meilleurs.length; i++) {
        const e = meilleurs[i]
        h += `<div class="rec-ligne${e.name === moi ? ' moi' : ''}"><span class="rg">${medailles[i]}</span><span class="nm">${esc(e.name)}</span><span class="vl">${fmt(e)}</span></div>`
      }
      // l'aiguillon : l'écart de MA ligne au rang au-dessus
      const r = meilleurs.findIndex((e) => e.name === moi)
      if (r > 0) {
        const d = Math.abs(brut(meilleurs[r - 1]) - brut(meilleurs[r]))
        const unite =
          titre === 'CHRONO' ? 's' : titre === 'VOLUME' ? 'cL' : 'pts'
        const v =
          titre === 'VOLUME'
            ? Math.max(1, Math.round(d * 100))
            : Math.ceil(d * 10) / 10
        h += `<div class="rec-ecart">à ${v} ${unite} du rang ${r}${desc ? '' : ''}</div>`
      }
      return h + '</div>'
    }
    let html =
      '<div class="rec-salle">TROPHÉES DU PROTOCOLE</div><div class="tro-grille">'
    for (const t of TROPHEES) {
      const ok = trophees.gagne(t.id)
      const date = ok
        ? new Date(trophees.quand(t.id)).toLocaleDateString('fr-FR')
        : ''
      html += `<div class="tro-carte${ok ? '' : ' verrou'}"><i>${t.icone}</i><div><b>${t.nom}</b><span>${t.desc}</span>${ok ? `<em>débloqué le ${date}</em>` : ''}</div></div>`
    }
    html += '</div>'
    const tops = board.tops ?? {}
    for (const lv of playedLevels()) {
      const t = tops[lv.code]
      html += `<div class="rec-salle">${esc(lv.code)} — ${esc(lv.name)}</div>`
      if (!t || t.note.length === 0) {
        html +=
          '<div class="rec-vide">Aucune collecte enregistrée — le palmarès est à prendre.</div>'
        continue
      }
      html += '<div class="rec-grille">'
      html += podium(
        'NOTE',
        t.note,
        (e) => `${e.note} pts`,
        (e) => e.note,
        true,
      )
      html += podium(
        'VOLUME',
        t.volume,
        (e) => fmtL(e.liters),
        (e) => e.liters,
        true,
      )
      html += podium(
        'CHRONO',
        t.chrono,
        (e) => fmtDuree(e.time),
        (e) => e.time,
        false,
      )
      html += '</div>'
    }
    recordsCorps.innerHTML = html || '<div class="rec-vide">Aucune salle.</div>'
  })
}
document.getElementById('home-records')?.addEventListener('click', () => {
  recordsEl.hidden = false
  renderRecordsVoile()
})
document.getElementById('records-fermer')?.addEventListener('click', () => {
  recordsEl.hidden = true
})
recordsEl.addEventListener('pointerdown', (e) => {
  if (e.target === recordsEl) recordsEl.hidden = true
})

// ---- Le voile des MÉMOIRES : le cycle des états ------------------------
// Le diagramme (le croquis du concepteur) est posé en dur dans index.html :
// trois états en colonne, l'entité mystère, les liens en SVG. Ici on
// habille : chaque lien porte son statut — TISSÉ (le flux anime le trait),
// À TISSER (cliquer la bulle achète, si la mémoire suffit), MYSTÈRE.
const cycleEl = document.getElementById('cycle') as HTMLDivElement
const cycleEcran = document.getElementById('cycle-ecran') as HTMLDivElement
const cycleScene = document.getElementById('cycle-scene') as HTMLDivElement
const cycleRegListe = document.getElementById(
  'cycle-reg-liste',
) as HTMLDivElement
/** Le STATUT d'un lien : offert d'origine · tissé · à tisser payable · à
 * tisser, solde insuffisant · mystère. Il pilote le trait, la plaque ET la
 * ligne du registre. Les deux premiers sont ACQUIS — même vert, même
 * lien qui coule : ce qui compte, c'est de l'avoir, pas de l'avoir payé.
 * Un VERROU narratif referme même un lien offert : il redevient à tisser. */
function statutTransfo(
  t: (typeof TRANSFOS_CYCLE)[number],
  acquis: readonly string[],
  solde: number,
  verrous: readonly string[],
): 'origine' | 'tenue' | 'payable' | 'verrou' | 'mystere' {
  if (t.etat === 'mystere') return 'mystere'
  if (!transfoTenue(t.id, acquis, verrous))
    return solde >= t.cout ? 'payable' : 'verrou'
  return t.etat === 'acquis-depart' && !acquis.includes(t.id)
    ? 'origine'
    : 'tenue'
}
const CY_STATUTS = [
  'cy-origine',
  'cy-tenue',
  'cy-payable',
  'cy-verrou',
  'cy-mystere',
]
function renderCycleVoile(): void {
  const acquis = records.eveilAcquis()
  const verrous = records.verrousCycle()
  const solde = records.memoire()
  const soldeEl = document.getElementById('cycle-solde-n')
  if (soldeEl) soldeEl.textContent = String(solde)
  // la jauge se remplit vers le lien à tisser le plus cher : pleine, tout
  // ce qui reste est payable (ou tout est tissé)
  const restants = TRANSFOS_CYCLE.filter(
    (t) => statutTransfo(t, acquis, solde, verrous) === 'verrou',
  ).map((t) => t.cout)
  const cible = restants.length > 0 ? Math.max(...restants) : 0
  const jauge = document.querySelector<HTMLElement>('#cycle-jauge b')
  if (jauge)
    jauge.style.width = `${cible > 0 ? Math.min(100, (solde / cible) * 100) : 100}%`
  let registre = ''
  for (const t of TRANSFOS_CYCLE) {
    const statut = statutTransfo(t, acquis, solde, verrous)
    const sous =
      statut === 'mystere'
        ? '???'
        : statut === 'origine'
          ? 'ACQUISE D’ORIGINE'
          : statut === 'tenue'
            ? 'TISSÉE'
            : statut === 'payable'
              ? `▸ TISSER · ${t.cout}`
              : `TISSER · ${t.cout}`
    const plaque = cycleScene.querySelector<HTMLElement>(
      `.cy-transfo[data-transfo="${t.id}"]`,
    )
    if (plaque) {
      plaque.classList.remove(...CY_STATUTS, 'cy-refus')
      plaque.classList.add(`cy-${statut}`)
      plaque.innerHTML = `<b>${t.nom}</b><span>${sous}</span>`
      plaque.title = t.desc
    }
    // le lien du schéma : trois couches (halo, corps, comètes) réglées par
    // le statut porté sur leur groupe
    cycleScene
      .querySelector<SVGGElement>(`.cy-lien[data-transfo="${t.id}"]`)
      ?.setAttribute('data-etat', statut)
    const de = ETATS_CYCLE[t.de].nom
    const vers = ETATS_CYCLE[t.vers].nom
    registre += `<button type="button" class="cy-reg cy-${statut}" data-transfo="${t.id}" title="${t.desc}"><span><b>${t.nom}</b><small>${de} → ${vers}</small></span><em>${sous}</em></button>`
  }
  cycleRegListe.innerHTML = registre
  cycleScene.classList.remove('cy-isole') // le registre est neuf : rien n'est survolé
}
// LE SURVOL ISOLE : approcher une plaque (ou sa ligne au registre) éteint
// tous les autres traits. C'est la réponse à « à quel lien appartient ce
// label ? » — la question ne se pose plus une seconde. Le focus clavier
// fait pareil : la manette et le Deck y ont droit aussi.
function survoleTransfo(id: string | null): void {
  cycleScene.classList.toggle('cy-isole', id !== null)
  for (const el of cycleEcran.querySelectorAll<HTMLElement>(
    '.cy-lien, .cy-transfo, .cy-reg',
  ))
    el.classList.toggle('cy-survol', id !== null && el.dataset.transfo === id)
}
const survolDepuis = (e: Event): void => {
  const c = (e.target as HTMLElement).closest(
    '.cy-transfo, .cy-reg',
  ) as HTMLElement | null
  survoleTransfo(c?.dataset.transfo ?? null)
}
cycleEcran.addEventListener('pointerover', survolDepuis)
cycleEcran.addEventListener('focusin', survolDepuis)
cycleEcran.addEventListener('pointerleave', () => survoleTransfo(null))

// Le tissage se fait des DEUX mains : la plaque du projecteur ou la ligne
// du registre — même lien, même geste. Un refus secoue ce qu'on a touché.
cycleEcran.addEventListener('click', (e) => {
  const cible = (e.target as HTMLElement).closest(
    '.cy-transfo, .cy-reg',
  ) as HTMLElement | null
  if (!cible) return
  const t = transfoCycle(cible.dataset.transfo ?? '')
  if (
    !t ||
    !transfoAchetable(t.id, records.eveilAcquis(), records.verrousCycle())
  )
    return
  if (!records.acquiertEveil(t.id, t.cout)) {
    // solde insuffisant : la jauge le rappelle, la plaque proteste
    renderCycleVoile()
    const rendu = document.querySelector<HTMLElement>(
      `.cy-reg[data-transfo="${t.id}"]`,
    )
    const proteste = cible.isConnected ? cible : rendu
    if (proteste) {
      proteste.classList.remove('cy-refus')
      void proteste.offsetWidth // relance l'animation même en refus répété
      proteste.classList.add('cy-refus')
    }
    return
  }
  majMemoireUI()
  audio.collect()
  renderCycleVoile()
})
document.getElementById('home-cycle')?.addEventListener('click', () => {
  cycleEl.hidden = false
  renderCycleVoile()
})
document.getElementById('cycle-fermer')?.addEventListener('click', () => {
  cycleEl.hidden = true
})
// OUTIL CONCEPTEUR : tout détisser pour rejouer la progression du cycle.
// Les liens tissés s'effacent et la mémoire dépensée revient — les verrous
// narratifs, eux, ne bougent pas : ils appartiennent au scénario. Le
// bouton n'existe qu'en mode concepteur (CSS body.concepteur).
document.getElementById('cycle-reset')?.addEventListener('click', () => {
  const rembourse = records
    .eveilAcquis()
    .reduce((somme, id) => somme + (transfoCycle(id)?.cout ?? 0), 0)
  records.reinitialiseCycle(rembourse)
  majMemoireUI()
  renderCycleVoile()
  audio.collect()
})
cycleEl.addEventListener('pointerdown', (e) => {
  if (e.target === cycleEl) cycleEl.hidden = true
})

// ---- Le voile FIOLES : la collection d'échantillons scellés ------------
// Deux logements ; cliquer une fiole possédée l'équipe ou la range — les
// effets sont passifs et valent pour toute la run.
const fiolesEl = document.getElementById('fioles') as HTMLDivElement
const fiolesCorps = document.getElementById('fioles-corps') as HTMLDivElement
function renderFiolesVoile(): void {
  const eq = records.fiolesEquipees()
  const titre = document.getElementById('fioles-titre')
  if (titre)
    titre.textContent = `LES FIOLES — ${records.fioles().length}/${FIOLES.length} trouvées · ${eq.length}/${FIOLES_SLOTS} équipées`
  let html = '<div class="cdx-grille">'
  for (const f of FIOLES) {
    if (records.possedeFiole(f.id)) {
      const equipee = eq.includes(f.id)
      html += `<div class="cdx-carte" data-fiole="${f.id}" style="cursor:pointer${equipee ? ';outline:2px solid #6dffb8' : ''}"><i>${f.icone}</i><div><b>${f.nom}${equipee ? ' · ÉQUIPÉE' : ''}</b><span>${f.desc}</span></div></div>`
    } else {
      html += `<div class="cdx-carte cdx-verrou"><i>?</i><div><b>FIOLE À TROUVER</b><span>${f.rare ? 'Elle dort dans une cachette profonde…' : 'Cachette profonde, ou le sac du Semblable…'}</span></div></div>`
    }
  }
  html += '</div>'
  fiolesCorps.innerHTML = html
}
fiolesCorps.addEventListener('click', (e) => {
  const carte = (e.target as HTMLElement).closest('[data-fiole]')
  if (!carte) return
  records.basculeFiole(carte.getAttribute('data-fiole') ?? '', FIOLES_SLOTS)
  renderFiolesVoile()
})
document.getElementById('home-fioles')?.addEventListener('click', () => {
  fiolesEl.hidden = false
  renderFiolesVoile()
})
document.getElementById('fioles-fermer')?.addEventListener('click', () => {
  fiolesEl.hidden = true
})
fiolesEl.addEventListener('pointerdown', (e) => {
  if (e.target === fiolesEl) fiolesEl.hidden = true
})

// ---- Le voile CODEX : le manuel écrit par la partie elle-même ----------
// Chaque fiche se débloque en VIVANT l'interaction (toucher une surface
// hydrophile en liquide, écarter un rideau en glace…). Verrouillée, une
// fiche n'affiche qu'un « ? » : la question donne envie d'aller essayer.
const codexEl = document.getElementById('codex') as HTMLDivElement
const codexCorps = document.getElementById('codex-corps') as HTMLDivElement
const codexCompte = document.getElementById('codex-compte') as HTMLSpanElement
function renderCodexVoile(): void {
  if (!codexCorps) return
  const groupes: { cle: CodexGroupe; nom: string; icone: string }[] = [
    { cle: 'eau', nom: 'LIQUIDE', icone: '💧' },
    { cle: 'glace', nom: 'GLACE', icone: '❄' },
    { cle: 'vapeur', nom: 'VAPEUR', icone: '💨' },
    { cle: 'phenomenes', nom: 'PHÉNOMÈNES', icone: '✦' },
    { cle: 'recit', nom: 'LE RÉCIT', icone: '🛰️' },
  ]
  let html = ''
  for (const g of groupes) {
    const fiches = CODEX.filter((d) => d.groupe === g.cle)
    const connues = fiches.filter((d) => codex.connu(d.id)).length
    html += `<div class="cdx-groupe"><span>${g.icone} ${g.nom}</span><i>${connues}/${fiches.length}</i></div>`
    html += '<div class="cdx-grille">'
    for (const d of fiches) {
      if (codex.connu(d.id)) {
        // le titre et le corps viennent du CATALOGUE : ce que le
        // concepteur a réécrit sur l'écran TEXTES paraît ici, dans la
        // langue du moment — et se voit donc échapper, comme tout texte
        // qui n'est plus une constante du code
        const lu = codexLu(d)
        html += `<div class="cdx-carte" data-fiche="${d.id}"><i>${d.icone}</i><div><b>${htmlSafe(lu.titre)}</b><span>${htmlSafe(lu.texte)}</span></div></div>`
      } else {
        html += `<div class="cdx-carte cdx-verrou"><i>?</i><div><b>FICHE À DÉCOUVRIR</b><span>Une interaction du protocole reste à vivre…</span></div></div>`
      }
    }
    html += '</div>'
  }
  codexCorps.innerHTML = html
  if (codexCompte)
    codexCompte.textContent = `${codex.compte()}/${CODEX.length} fiches consignées`
}
document.getElementById('home-codex')?.addEventListener('click', () => {
  codexEl.hidden = false
  renderCodexVoile()
})
// Ouvert DEPUIS LE TOAST en pleine partie, le codex fige l'essai (lecture au
// calme) et le rend en se fermant — ouvert depuis la fiche, rien à figer.
let codexAPause = false
function fermeCodex(): void {
  codexEl.hidden = true
  if (codexAPause) {
    codexAPause = false
    input.paused = false
  }
}
/** Ouvre le codex DÉFILÉ sur une fiche : le chemin du toast (clic, toucher,
 * SELECT à la manette) — la fiche neuve s'illumine le temps d'un regard. */
function ouvreCodexSur(fiche: string): void {
  if (document.body.classList.contains('playing') && !input.paused) {
    input.paused = true
    codexAPause = true
  }
  codexEl.hidden = false
  renderCodexVoile()
  const carte = codexCorps.querySelector<HTMLElement>(`[data-fiche="${fiche}"]`)
  if (carte) {
    carte.scrollIntoView({ block: 'center' })
    carte.classList.add('cdx-neuve')
    window.setTimeout(() => carte.classList.remove('cdx-neuve'), 3200)
  }
}
document.getElementById('codex-fermer')?.addEventListener('click', fermeCodex)
codexEl.addEventListener('pointerdown', (e) => {
  if (e.target === codexEl) fermeCodex()
})

document.getElementById('salles-fermer')?.addEventListener('click', () => {
  sallesEl.hidden = true
})
sallesEl.addEventListener('pointerdown', (e) => {
  if (e.target === sallesEl) sallesEl.hidden = true
})

// ---- Le voile PARAMÈTRES : les réglages du joueur (le banc règle la physique) ----
// Premier réglage : le VERROU DE FRÉQUENCE, anti yo-yo. Le joueur choisit
// une cadence plafond ; la boucle saute les images d'avance. Sur un écran
// rapide (90/120 Hz), verrouiller à 60 échange le « parfois 90, parfois
// 55 » contre un 60 régulier — c'est la stabilité qui se sent, pas la
// pointe. La qualité adaptative vise la cadence choisie (bornée à 60).
// 45 : le Steam Deck cadencé à 45 Hz (réglage SteamOS) — le verrou épouse
// alors exactement la grille de l'écran. Sur un téléphone à 60 Hz, 45 ne
// divise pas 60 : la cadence alterne 17/25 ms (tressautement mécanique) —
// sur écran 60 Hz, préférer 60 ou 30.
const FPS_CHOIX = [30, 45, 50, 60, 90, 120, 240]
let fpsCap = ((): number => {
  const v = Number(localStorage.getItem('sujet21-fps-cap'))
  return FPS_CHOIX.includes(v) ? v : 60
})()
let fpsCapPrecedent = 0 // horloge du limiteur (dernière image RENDUE)
// Résolution dynamique : DÉSACTIVÉE par défaut — le rendu reste en
// résolution native constante, aucune surprise visuelle. Sur une machine
// borderline, la qualité qui descendait « pour tenir 60 » se voyait plus
// que les images perdues. Qui veut l'adaptatif (mobile) l'active au voile.
// Résolution de rendu : FIXE au choix (élevée = native, moyenne ×0,75,
// faible ×0,5) ou DYNAMIQUE (l'adaptatif historique). Constat qui l'a
// motivée : à réglages égaux, le Pixel pousse ~4,2 Mpx quand le Steam Deck
// en pousse ~1 — le shader de composition coûte PAR PIXEL, le téléphone
// paie 4×. Moyenne = 56 % des pixels, faible = 25 % : un allègement GPU
// massif et CONSTANT (pas de yo-yo), l'interface HTML restant nette.
type ResChoix = 'elevee' | 'moyenne' | 'faible' | 'dyn'
const RES_ECHELLES: Record<ResChoix, number> = {
  elevee: 1,
  moyenne: 0.75,
  faible: 0.5,
  dyn: 1,
}
let resChoix: ResChoix = ((): ResChoix => {
  const v = localStorage.getItem('sujet21-res')
  if (v === 'elevee' || v === 'moyenne' || v === 'faible' || v === 'dyn')
    return v
  // migration : l'ancien interrupteur résolution dynamique
  if (localStorage.getItem('sujet21-res-dyn') === '1') return 'dyn'
  // PREMIÈRE OUVERTURE. Sur un écran TACTILE, « élevée » veut dire natif,
  // c'est-à-dire cinq mégapixels sur un iPad — mesuré à ~10 im/s. Personne
  // ne va chercher un réglage avant de juger un jeu : l'adaptatif prend la
  // main par défaut, et il ne descend jamais sous « faible ». Sur un écran
  // de bureau, où le natif passe, on ne touche à rien.
  try {
    if (window.matchMedia('(pointer: coarse)').matches) return 'dyn'
  } catch {
    // pas de matchMedia : on garde le défaut historique
  }
  return 'elevee'
})()
const resDynamique = (): boolean => resChoix === 'dyn'
// rendu de la section MOTEUR PHYSIQUE — paresseux : `sim` n'existe pas
// encore quand le voile se câble, il se dessine à l'ouverture
let majMoteurUI: () => void = () => {}
// Rattrapage après un accroc : TEMPS RÉEL (historique — la simulation
// rattrape le temps perdu, quitte à allonger l'image suivante) ou
// FLUIDITÉ (anti-domino : jamais plus de pas que le régime de croisière,
// le retard est abandonné). Les rapports montrent que 80-90 % des images
// lentes du téléphone sont des rafales de rattrapage — mais le ressenti
// appartient au joueur : c'est un réglage.
let rattrapageFluide = localStorage.getItem('sujet21-rattrapage') === 'fluide'
// Cadence de SIMULATION (expérimental) : 120 Hz (précision, défaut) ou
// 60 Hz (économie — un pas par image à 60 im/s : CPU et CHAUFFE divisés
// par deux). Verdict des rapports Pixel : le coût d'un pas TRIPLE au fil
// d'une session (throttling thermique) — le seul remède est de calculer
// moins par seconde. Le comportement physique diffère légèrement à 60 Hz
// (pas deux fois plus grands) : c'est un réglage assumé, pas un défaut.
let simHz: 60 | 120 = localStorage.getItem('sujet21-simhz') === '60' ? 60 : 120
function appliqueSimHz(): void {
  params.dt = 1 / simHz
}
appliqueSimHz()
// Graphismes du décor : RICHE par défaut (bruit procédural complet), SOBRE
// pour débrancher le décoratif dans le shader de composition — mêmes formes,
// mêmes auras, moins de calcul par pixel. C'est l'instrument du test A/B :
// deux rapports de performance, mêmes conditions, seul ce réglage change —
// l'écart chiffre le coût réel des graphismes sur la machine du joueur.
let decorRiche = localStorage.getItem('sujet21-decor') !== 'sobre'
// LE CIEL DU DEHORS. Trois fonds pour le vide, du plus riche au plus léger :
// la PLAQUE (une image de 4096², un champ profond), la TUILE d'intérim
// (l'ancien fond, deux petites textures répétées), le PROCÉDURAL (rien à
// charger, tout calculé). La plaque ne se télécharge qu'à son premier
// affichage — un joueur qui la coupe ne la paie jamais.
type CielChoix = 'plaque' | 'tuile' | 'procedural'
const CIEL_MODE: Record<CielChoix, number> = { procedural: 0, tuile: 1, plaque: 2 }
let cielChoix = (localStorage.getItem('sujet21-ciel') ??
  'plaque') as CielChoix
if (!(cielChoix in CIEL_MODE)) cielChoix = 'plaque'
// Réglés au banc, à vue : c'est en regardant le vide qu'on trouve le dosage.
// La FORCE dose la plaque — le vide doit rester plus sombre que la cuve
// éclairée, sans quoi la hiérarchie lumineuse s'inverse. L'ÉTENDUE dit
// combien d'unités-monde la plaque couvre : plus elle est petite, plus le
// ciel est net et plus il défile vite.
// Les défauts sont ceux du premier étalonnage à l'écran : à force 1, la
// plaque écrasait la station — le vide devenait le sujet et les modules des
// découpes plates. 0,45 la remet DERRIÈRE la cuve éclairée, là où elle doit
// être. L'étendue de 6000 donnait des volutes énormes, plus proches d'un
// ciel de nuages que d'un champ profond ; 12 000 les diluait en brume.
// 8 000 rend la structure lisible sans qu'elle prenne toute la place.
const cielReglages = { force: 0.45, etendue: 8000 }

// LA PROFONDEUR DES COUCHES DE FOND : la règle, les valeurs et les tests
// vivent dans render/parallaxe.ts — ici on n'en tient que la copie RÉGLABLE,
// celle que les curseurs du banc modifient en direct. Aplatie en un objet
// plat parce que le banc lie des champs, pas des objets imbriqués.
const parallaxeReglages = {
  cielSuivi: PARALLAXE_DEFAUTS.ciel.suivi,
  cielZoom: PARALLAXE_DEFAUTS.ciel.zoom,
  semisSuivi: PARALLAXE_DEFAUTS.semis.suivi,
  semisZoom: PARALLAXE_DEFAUTS.semis.zoom,
  cuveSuivi: PARALLAXE_DEFAUTS.cuve.suivi,
  cuveZoom: PARALLAXE_DEFAUTS.cuve.zoom,
  ref: PARALLAXE_DEFAUTS.ref,
}
// Sonde de test : la profondeur du fond depuis la console (comme __sim, __cam)
;(
  window as unknown as { __parallaxe: typeof parallaxeReglages }
).__parallaxe = parallaxeReglages
// Graphismes du LIQUIDE, séparés du décor : SOBRE débranche l'éclairage de
// l'eau (relief, spéculaire, miroir, scintillement) dans le shader — la
// silhouette, les couleurs de vitesse et les états restent. C'est le second
// bras du test A/B : si c'est le rendu du liquide qui pèse, c'est CE
// réglage qui fera bouger les chiffres, pas celui du décor.
let eauRiche = localStorage.getItem('sujet21-eau') !== 'sobre'
// Surface du fluide, TROIS rendus au choix : MIROITANT MERCURE (défaut —
// le reflet s'enroule d'un seul tenant autour du corps, comme une bille de
// mercure : le cœur mire le plafond, le bord balaie la salle, les lampes
// s'y mirent), MIROITANTE (reflet des alentours par la houle de chaque
// goutte) ou CLASSIQUE (l'ancien rendu, au pixel près). Valeur passée
// telle quelle au shader : 0 classique, 1 miroitante, 2 mercure.
// La FLÈCHE DE CAP à la manette : retirée par défaut (le regard du Sujet
// suit déjà le stick) — réactivable dans PARAMÈTRES pour qui la préfère.
let flecheVisible = localStorage.getItem('sujet21-fleche') === 'visible'
// LE FAISCEAU laser, trois crans : FOUDROYANT par défaut (aura pulsante
// + mini-arcs électriques qui crépitent le long du rayon, sursaut
// amplifié), SOMPTUEUX (flux + lueurs, sursaut sobre), CLASSIQUE
// (l'ancien rendu au pixel près).
let faisceauChoix = ((): number => {
  const v = localStorage.getItem('sujet21-faisceau')
  return v === 'classique' ? 0 : v === 'somptueux' ? 1 : 2
})()
let eauMiroir =
  localStorage.getItem('sujet21-miroir') === 'classique'
    ? 0
    : localStorage.getItem('sujet21-miroir') === 'miroir'
      ? 1
      : 2
// Éclairage de la PIÈCE : une lampe par cuve, des ombres portées cuites dans
// une carte de lumière (recalculée seulement au changement de décor) et un
// biseau directionnel sur les arêtes — du relief pour presque rien. ACTIF
// par défaut, débranchable ici même ; l'éclairage du volume viendra après.
let lumiereActive = localStorage.getItem('sujet21-lumiere') !== 'off'
// Éclairage du VOLUME : le corps (eau, glace, vapeur) baigne dans la même
// lumière que la pièce — ombres portées comprises, reflet vers la lampe.
// Débranchable séparément ; sans éclairage de pièce, il n'a rien à recevoir.
let lumiereEauActive = localStorage.getItem('sujet21-lumiere-eau') !== 'off'
// RELIEF 2.5D des parois : leur sommet fuit le centre de la caméra, la face
// latérale se révèle du côté qui regarde le centre — en se déplaçant, on
// aperçoit les flancs des éléments qu'on aborde. EXPÉRIMENTAL : OFF par
// défaut le temps de la validation à la manette ; LÉGER puis FORT à l'essai.
let reliefChoix = (localStorage.getItem('sujet21-relief') ?? 'off') as
  | 'off'
  | 'leger'
  | 'fort'
const RELIEF_K = { off: 0, leger: 0.035, fort: 0.07 } as const

// L'ÉCHELLE DES TEXTES. Toute l'interface est écrite en `calc(Npx *
// var(--ui))` : ce seul nombre grossit tout d'un coup, sans qu'aucune boîte
// ne soit redessinée. Un Steam Deck (7 pouces, à bout de bras) et un 27
// pouces posé à soixante centimètres ne demandent pas la même chose — d'où
// un réglage, et non une valeur unique décidée ici. Il s'applique AVANT le
// premier dessin : la page ne doit pas sauter sous les yeux du joueur.
const ECHELLES = [1, 1.15, 1.3, 1.45] as const
let uiEchelle = ((): number => {
  const v = Number(localStorage.getItem('sujet21-ui-echelle'))
  return ECHELLES.includes(v as (typeof ECHELLES)[number]) ? v : 1
})()
function appliqueEchelle(): void {
  document.documentElement.style.setProperty('--ui', String(uiEchelle))
}
appliqueEchelle()

const paramsEl = document.getElementById('params') as HTMLDivElement
{
  const choixTaille = document.getElementById('params-taille') as HTMLDivElement
  const renderTaille = (): void => {
    choixTaille.innerHTML = ''
    for (const [k, label] of [
      [1, 'NORMALE'],
      [1.15, 'GRANDE'],
      [1.3, 'TRÈS GRANDE'],
      [1.45, 'ÉNORME'],
    ] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.className = k === uiEchelle ? 'actif' : ''
      b.addEventListener('click', () => {
        uiEchelle = k
        localStorage.setItem('sujet21-ui-echelle', String(k))
        appliqueEchelle()
        renderTaille()
      })
      choixTaille.appendChild(b)
    }
  }
  renderTaille()

  const choix = document.getElementById('params-fps') as HTMLDivElement
  const renderFps = (): void => {
    choix.innerHTML = ''
    for (const hz of FPS_CHOIX) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = `${hz}`
      b.className = hz === fpsCap ? 'actif' : ''
      b.addEventListener('click', () => {
        fpsCap = hz
        localStorage.setItem('sujet21-fps-cap', String(hz))
        fpsCapPrecedent = 0 // la prochaine image passe tout de suite
        perf.reset() // la fenêtre de mesure repart : un rapport = une config
        renderFps()
      })
      choix.appendChild(b)
    }
  }
  renderFps()

  const choixRes = document.getElementById('params-resdyn') as HTMLDivElement
  const renderRes = (): void => {
    choixRes.innerHTML = ''
    for (const [mode, label] of [
      ['elevee', 'ÉLEVÉE'],
      ['moyenne', 'MOYENNE'],
      ['faible', 'FAIBLE'],
      ['dyn', 'DYNAMIQUE'],
    ] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.className = resChoix === mode ? 'actif' : ''
      b.addEventListener('click', () => {
        resChoix = mode
        localStorage.setItem('sujet21-res', mode)
        dynAmorce = false // l'adaptatif se réamorce au prochain passage
        perf.reset()
        renderRes()
      })
      choixRes.appendChild(b)
    }
  }
  renderRes()

  const choixDecor = document.getElementById('params-decor') as HTMLDivElement
  const renderDecor = (): void => {
    choixDecor.innerHTML = ''
    for (const [riche, label] of [
      [true, 'RICHES'],
      [false, 'SOBRES'],
    ] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.className = decorRiche === riche ? 'actif' : ''
      b.addEventListener('click', () => {
        decorRiche = riche
        localStorage.setItem('sujet21-decor', riche ? 'riche' : 'sobre')
        perf.reset()
        renderDecor()
      })
      choixDecor.appendChild(b)
    }
  }
  renderDecor()

  const choixCiel = document.getElementById('params-ciel') as HTMLDivElement
  const renderCiel = (): void => {
    if (!choixCiel) return
    choixCiel.innerHTML = ''
    for (const [mode, label] of [
      ['plaque', 'PLAQUE'],
      ['tuile', 'TUILE'],
      ['procedural', 'PROCÉDURAL'],
    ] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.className = cielChoix === mode ? 'actif' : ''
      b.addEventListener('click', () => {
        cielChoix = mode
        localStorage.setItem('sujet21-ciel', mode)
        perf.reset()
        renderCiel()
      })
      choixCiel.appendChild(b)
    }
  }
  renderCiel()

  const choixRelief = document.getElementById('params-relief') as HTMLDivElement
  const renderRelief = (): void => {
    choixRelief.innerHTML = ''
    for (const [mode, label] of [
      ['off', 'OFF'],
      ['leger', 'LÉGER'],
      ['fort', 'FORT'],
    ] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.className = reliefChoix === mode ? 'actif' : ''
      b.addEventListener('click', () => {
        reliefChoix = mode
        localStorage.setItem('sujet21-relief', mode)
        perf.reset()
        renderRelief()
      })
      choixRelief.appendChild(b)
    }
  }
  renderRelief()

  const choixFpsAff = document.getElementById('params-fpsaff') as HTMLDivElement
  const renderFpsAff = (): void => {
    choixFpsAff.innerHTML = ''
    for (const [on, label] of [
      [false, 'MASQUÉ'],
      [true, 'AFFICHÉ'],
    ] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.className = fpsAffiche === on ? 'actif' : ''
      b.addEventListener('click', () => {
        fpsAffiche = on
        localStorage.setItem('sujet21-fps-aff', on ? '1' : '0')
        fpsCoin.hidden = !on
        renderFpsAff()
      })
      choixFpsAff.appendChild(b)
    }
  }
  renderFpsAff()

  const choixSim = document.getElementById('params-simhz') as HTMLDivElement
  const renderSimHz = (): void => {
    choixSim.innerHTML = ''
    for (const hz of [120, 60] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = hz === 120 ? '120 — PRÉCISION' : '60 — ÉCONOMIE'
      b.className = simHz === hz ? 'actif' : ''
      b.addEventListener('click', () => {
        simHz = hz
        localStorage.setItem('sujet21-simhz', String(hz))
        appliqueSimHz()
        perf.reset()
        renderSimHz()
      })
      choixSim.appendChild(b)
    }
  }
  renderSimHz()

  const choixRatt = document.getElementById(
    'params-rattrapage',
  ) as HTMLDivElement
  const renderRatt = (): void => {
    choixRatt.innerHTML = ''
    for (const [fluide, label] of [
      [false, 'TEMPS RÉEL'],
      [true, 'FLUIDITÉ'],
    ] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.className = rattrapageFluide === fluide ? 'actif' : ''
      b.addEventListener('click', () => {
        rattrapageFluide = fluide
        localStorage.setItem('sujet21-rattrapage', fluide ? 'fluide' : 'reel')
        perf.reset()
        renderRatt()
      })
      choixRatt.appendChild(b)
    }
  }
  renderRatt()

  const choixMoteur = document.getElementById('params-moteur') as HTMLDivElement
  const etatMoteur = document.getElementById(
    'params-moteur-etat',
  ) as HTMLDivElement
  const renderMoteur = (): void => {
    choixMoteur.innerHTML = ''
    for (const [mode, label] of [
      ['wasm', 'WASM'],
      ['js', 'JAVASCRIPT'],
    ] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      const actif = mode === 'wasm' ? sim.moteurWasm : !sim.moteurWasm
      b.className = actif ? 'actif' : ''
      if (mode === 'wasm' && noyauxWasm === null) b.disabled = true
      b.addEventListener('click', () => {
        moteurChoisi = mode
        localStorage.setItem('sujet21-moteur', mode)
        appliqueMoteur(sim)
        perf.reset() // A/B propre : le rapport ne mélange jamais deux moteurs
        renderMoteur()
      })
      choixMoteur.appendChild(b)
    }
    etatMoteur.textContent =
      noyauxWasm === null
        ? 'Module WASM en cours de chargement — JavaScript en attendant.'
        : sim.moteurWasm
          ? 'Noyaux compilés actifs (grille, voisins, densité, viscosité).'
          : 'Moteur JavaScript historique actif.'
  }
  majMoteurUI = renderMoteur

  const choixEau = document.getElementById('params-eau') as HTMLDivElement
  const renderEau = (): void => {
    choixEau.innerHTML = ''
    for (const [riche, label] of [
      [true, 'RICHE'],
      [false, 'SOBRE'],
    ] as const) {
      const b = document.createElement('button')
      b.type = 'button'
      b.textContent = label
      b.className = eauRiche === riche ? 'actif' : ''
      b.addEventListener('click', () => {
        eauRiche = riche
        localStorage.setItem('sujet21-eau', riche ? 'riche' : 'sobre')
        perf.reset()
        renderEau()
      })
      choixEau.appendChild(b)
    }
  }
  renderEau()

  const choixMiroir = document.getElementById(
    'params-miroir',
  ) as HTMLDivElement | null
  if (choixMiroir) {
    const renderMiroir = (): void => {
      choixMiroir.innerHTML = ''
      for (const [miroir, cle, label] of [
        [2, 'mercure', 'MIROITANT MERCURE'],
        [1, 'miroir', 'MIROITANTE'],
        [0, 'classique', 'CLASSIQUE'],
      ] as const) {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = label
        b.className = eauMiroir === miroir ? 'actif' : ''
        b.addEventListener('click', () => {
          eauMiroir = miroir
          localStorage.setItem('sujet21-miroir', cle)
          perf.reset()
          renderMiroir()
        })
        choixMiroir.appendChild(b)
      }
    }
    renderMiroir()
  }

  const choixFaisceau = document.getElementById(
    'params-faisceau',
  ) as HTMLDivElement | null
  if (choixFaisceau) {
    const renderFaisceau = (): void => {
      choixFaisceau.innerHTML = ''
      for (const [val, cle, label] of [
        [2, 'foudroyant', 'FOUDROYANT'],
        [1, 'somptueux', 'SOMPTUEUX'],
        [0, 'classique', 'CLASSIQUE'],
      ] as const) {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = label
        b.className = faisceauChoix === val ? 'actif' : ''
        b.addEventListener('click', () => {
          faisceauChoix = val
          localStorage.setItem('sujet21-faisceau', cle)
          renderFaisceau()
        })
        choixFaisceau.appendChild(b)
      }
    }
    renderFaisceau()
  }

  const choixFleche = document.getElementById(
    'params-fleche',
  ) as HTMLDivElement | null
  if (choixFleche) {
    const renderFleche = (): void => {
      choixFleche.innerHTML = ''
      for (const [visible, cle, label] of [
        [false, 'masquee', 'MASQUÉE'],
        [true, 'visible', 'VISIBLE'],
      ] as const) {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = label
        b.className = flecheVisible === visible ? 'actif' : ''
        b.addEventListener('click', () => {
          flecheVisible = visible
          localStorage.setItem('sujet21-fleche', cle)
          renderFleche()
        })
        choixFleche.appendChild(b)
      }
    }
    renderFleche()
  }

  const choixLumiere = document.getElementById(
    'params-lumiere',
  ) as HTMLDivElement | null
  if (choixLumiere) {
    const renderLumiere = (): void => {
      choixLumiere.innerHTML = ''
      for (const [on, label] of [
        [true, 'ACTIF'],
        [false, 'COUPÉ'],
      ] as const) {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = label
        b.className = lumiereActive === on ? 'actif' : ''
        b.addEventListener('click', () => {
          lumiereActive = on
          localStorage.setItem('sujet21-lumiere', on ? 'on' : 'off')
          perf.reset()
          renderLumiere()
        })
        choixLumiere.appendChild(b)
      }
    }
    renderLumiere()
  }

  const choixLumEau = document.getElementById(
    'params-lumeau',
  ) as HTMLDivElement | null
  if (choixLumEau) {
    const renderLumEau = (): void => {
      choixLumEau.innerHTML = ''
      for (const [on, label] of [
        [true, 'ACTIF'],
        [false, 'COUPÉ'],
      ] as const) {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = label
        b.className = lumiereEauActive === on ? 'actif' : ''
        b.addEventListener('click', () => {
          lumiereEauActive = on
          localStorage.setItem('sujet21-lumiere-eau', on ? 'on' : 'off')
          perf.reset()
          renderLumEau()
        })
        choixLumEau.appendChild(b)
      }
    }
    renderLumEau()
  }
}

// ---- Rapport de performance : mesurer la VRAIE machine, analyser à distance ----
const perf = new PerfCollector()
const perfVif = document.getElementById('perf-vif') as HTMLDivElement
const perfEtat = document.getElementById('perf-etat') as HTMLDivElement
let perfVifCompte = 0
function majPerfVifForce(): void {
  const r = perf.resume()
  // la VERSION est dite ici aussi : c'est la question qu'on se pose juste
  // avant de mesurer (« suis-je bien sur le paquet que je crois ? »), et
  // un iPad peut garder un onglet ouvert longtemps après une mise en ligne
  perfVif.textContent =
    `v${VERSION} · ` +
    (r.images < 30
      ? 'mesure en cours — jouez quelques secondes, le voile ouvert ou fermé.'
      : `en direct : ${r.p50.toFixed(0)} im/s en médiane · plancher (p5) ${r.p95.toFixed(0)} im/s · fenêtre de ${r.images} images.`)
}
function majPerfVif(): void {
  if (paramsEl.hidden) return
  if (++perfVifCompte % 30 !== 0) return // rafraîchi ~2 fois par seconde
  majPerfVifForce()
}
function rapportPerf(): Record<string, unknown> {
  return perf.rapport({
    // LA VERSION DU JEU MESURÉ. Sans elle, un rapport ne se rattache à
    // rien : on ne peut pas dire si une correction a payé, ni même si
    // l'appareil tournait sur la version qu'on croit (un iPad garde un
    // paquet en cache bien après la mise en ligne). Deux rapports ne se
    // comparent que s'ils disent d'où ils viennent.
    build: {
      version: VERSION,
      livraison: DERNIERE_LIVRAISON.date,
      titre: DERNIERE_LIVRAISON.title,
    },
    config: {
      fpsCap,
      resolution: resChoix,
      resolutionDynamique: resDynamique(),
      graphismes: decorRiche ? 'riches' : 'sobres',
      liquide: eauRiche ? 'riche' : 'sobre',
      eclairage: lumiereActive ? 'actif' : 'coupe',
      eclairageVolume: lumiereActive && lumiereEauActive ? 'actif' : 'coupe',
      moteur: sim.moteurWasm
        ? 'wasm'
        : noyauxWasm
          ? 'javascript'
          : 'javascript (wasm non chargé)',
      rattrapage: rattrapageFluide ? 'fluidite' : 'temps-reel',
      simHz,
      // l'ÉCHELLE DE RENDU réellement appliquée (1 = natif, plafonné à
      // 2 dpr) : c'est le seul chiffre qui explique une cadence, puisque
      // le coût est proportionnel au nombre de pixels
      echelleRendu: Math.round(echelleRendue() * 1000) / 1000,
      megapixels:
        Math.round(
          ((window.innerWidth * window.innerHeight * echelleRendue() ** 2) /
            1e6) * 100,
        ) / 100,
      timeWarp: params.timeWarp,
      downsampleChamp: params.renderDownsample,
    },
    session: {
      tableau: `${level.code} — ${level.name}`,
      particules: sim.count,
      volumeL: Math.round(sim.liters() * 100) / 100,
      // la composition dit ce que le tableau coûte : boîtes (rendu par
      // pixel + collisions), lasers (traçage par image), zones, éponges
      composition: {
        boites: level.boxes.length,
        lasers: (level.lasers ?? []).length,
        cibles: (level.cibles ?? []).length,
        zones: (level.zones ?? []).length,
        rails: (level.rails ?? []).length,
        lumieres: (level.lumieres ?? []).length,
        cellulesEponge: (level.sponges ?? []).reduce(
          (a, s) => a + s.cols * s.rows,
          0,
        ),
        etiquettes: level.labels.length,
      },
      enPause: input.paused,
    },
  })
}
// COPIER et ENVOYER : une seule mise en œuvre, DEUX poignées — le voile
// PARAMÈTRES et le banc. Chacune rend le mot d'état, que l'appelant
// affiche chez lui. Le banc compte double ici : il flotte AU-DESSUS du jeu
// qui tourne, alors que le voile s'ouvre depuis la fiche, laquelle met
// l'essai en pause. Un rapport pris au banc mesure donc une VRAIE partie ;
// un rapport pris au voile mesure le menu.
/**
 * COPIER UN TEXTE. `navigator.clipboard` manque en contexte non sécurisé
 * (http://) et sur de vieux navigateurs : sans ce garde, la promesse
 * n'existe pas et le clic part en erreur au lieu de retomber sur la
 * console. Rend `false` quand le presse-papier a refusé — l'appelant le
 * dit à sa façon, et le texte est dans la console dans tous les cas.
 */
async function copieTexte(texte: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) throw new Error('presse-papier indisponible')
    await navigator.clipboard.writeText(texte)
    return true
  } catch {
    console.log(texte)
    return false
  }
}
async function copiePerf(): Promise<string> {
  return (await copieTexte(JSON.stringify(rapportPerf(), null, 2)))
    ? 'Rapport copié — collez-le dans la conversation d’analyse.'
    : 'Presse-papier refusé — le rapport est dans la console (F12).'
}
async function envoiePerf(): Promise<string> {
  try {
    const r = await fetch('/api/perf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auteur: records.operator() || 'anonyme',
        rapport: rapportPerf(),
      }),
    })
    if (!r.ok) throw new Error(String(r.status))
    return 'Envoyé au labo ✓ — signalez-le, l’analyse peut commencer.'
  } catch {
    return 'Envoi impossible (hors ligne ou serveur local) — utilisez COPIER.'
  }
}
document.getElementById('perf-copier')?.addEventListener('click', () => {
  void copiePerf().then((mot) => {
    perfEtat.textContent = mot
  })
})
document.getElementById('perf-envoyer')?.addEventListener('click', () => {
  perfEtat.textContent = 'Envoi…'
  void envoiePerf().then((mot) => {
    perfEtat.textContent = mot
  })
})

document.getElementById('home-params')?.addEventListener('click', () => {
  paramsEl.hidden = false
  majPerfVifForce() // l'aperçu s'affiche tout de suite, pas 30 images plus tard
  majMoteurUI() // la section moteur reflète l'état réel (module chargé ou non)
})
document.getElementById('params-fermer')?.addEventListener('click', () => {
  paramsEl.hidden = true
})
// ---- PROTOCOLE : rejouer l'éveil, réinitialiser l'opérateur ----
document.getElementById('proto-rejouer')?.addEventListener('click', () => {
  try {
    localStorage.removeItem(CLE_EVEIL)
  } catch {
    // sans gravité : lanceEveil rejouera quand même cette session
  }
  paramsEl.hidden = true
  if (requireName()) return
  // l'éveil se rejoue SUR le tableau en cours : plan large, cryostase, cartes
  document.body.classList.add('playing')
  input.paused = false
  hasPlayed = true
  startBtn.textContent = "REPRENDRE L'ESSAI"
  homeRestartBtn.hidden = false
  restart()
  lanceEveil()
})
// Réinitialiser l'opérateur : destructif, donc DEUX clics — le premier arme
// le bouton (libellé rouge explicite), le second efface nom + registres
// locaux et recharge : le voile de signature revient, vierge. Les trophées
// et les réglages restent (seuls les RECORDS sont annoncés perdus).
const protoReset = document.getElementById(
  'proto-reset-nom',
) as HTMLButtonElement | null
let protoResetArme = 0
protoReset?.addEventListener('click', () => {
  const now = performance.now()
  if (now - protoResetArme > 6000) {
    protoResetArme = now
    protoReset.classList.add('danger')
    protoReset.textContent = 'EFFACER NOM + RECORDS — CONFIRMER'
    window.setTimeout(() => {
      // non confirmé à temps : le bouton se désarme, rien n'est perdu
      if (performance.now() - protoResetArme >= 5900) {
        protoReset.classList.remove('danger')
        protoReset.textContent = 'RÉINITIALISER L’OPÉRATEUR'
      }
    }, 6000)
    return
  }
  try {
    localStorage.removeItem('projet21.registres.v1')
    localStorage.removeItem('sujet21-signature-v1')
  } catch {
    // stockage indisponible : rien à effacer non plus
  }
  location.reload()
})
paramsEl.addEventListener('pointerdown', (e) => {
  if (e.target === paramsEl) paramsEl.hidden = true
})

// ---- L'appel de l'œil : à l'arrivée sur la fiche, le son et le plein
// écran battent trois fois — on sait où toucher d'abord.
function appelOeil(): void {
  for (const id of ['home-mute', 'home-plein']) {
    const b = document.getElementById(id) as HTMLButtonElement | null
    if (!b || b.hidden) continue
    b.classList.remove('appel')
    void b.offsetWidth // relance l'animation
    b.classList.add('appel')
  }
}
window.setTimeout(appelOeil, 600)

const homeRestartBtn = document.getElementById(
  'home-restart',
) as HTMLButtonElement
function closeHome(): void {
  if (requireName()) return // pas de plongée sans opérateur identifié
  // NAVIGATION DIRECTE (?tableau=N, outil de conception) : on entre dans
  // CETTE salle — le bouton ne doit pas renvoyer au module d'accueil.
  if (!hasPlayed && !auHub) {
    hasPlayed = true
    document.body.classList.add('playing')
    input.paused = false
    startBtn.textContent = "REPRENDRE L'ESSAI"
    homeRestartBtn.hidden = false
    restart()
    return
  }
  // Une descente SAUVÉE attend et rien n'a encore été joué : le bouton
  // principal EST la reprise (au début de sa salle) — aucune fausse
  // manœuvre ne peut repartir de la salle 1 par réflexe.
  const save = runSauvee()
  if (!hasPlayed && save) {
    reprendreRun(save)
    return
  }
  if (!hasPlayed) {
    // Premier plongeon : le jeu COMMENCE AU HUB — la cuve d'entraînement
    // du module Méduse, sous l'œil des Créateurs. L'éveil s'y joue.
    entrerHub()
    return
  }
  document.body.classList.add('playing')
  input.paused = false // la fiche figeait l'essai : il repart
  startBtn.textContent = "REPRENDRE L'ESSAI"
  homeRestartBtn.hidden = false
}

// Entrer au hub : le module d'accueil, joué SANS enjeu (pas de records,
// pas d'échantillon consommé). Son sas lance la run.
function entrerHub(): void {
  auHub = true
  testLevel = null
  fromEditor = false
  hasPlayed = true
  document.body.classList.add('playing')
  input.paused = false
  startBtn.textContent = "REPRENDRE L'ESSAI"
  homeRestartBtn.hidden = false
  restart()
  montrerOnboard()
  lanceEveil() // la cryostase s'éveille dans la cuve d'entraînement
  // LE SCÉNARIO : l'ouverture froide (une seule fois dans la vie du
  // joueur) puis l'arrivée au hub — elles s'enchaînent si les deux
  // s'appliquent. C'est ici que vit le fil narratif du roguelike.
  void joueMoment('premier-lancement').then(() => joueMoment('avant-hub'))
}
function openHome(): void {
  document.body.classList.remove('playing')
  appelOeil()
  // La fiche fige l'essai : revenir au menu, c'est faire une pause — la
  // cuve n'avance plus dans le dos du joueur.
  if (hasPlayed) input.paused = true
  homeRestartBtn.hidden = !hasPlayed
  majBoutonsRun()
}
// LE BOUTON PRINCIPAL : il n'y a qu'UNE descente et qu'une porte. Reprendre
// celle qui est sauvée, ou rejoindre le module — c'est son sas qui lance.
startBtn.addEventListener('click', () => {
  voieDuJourForcee = false // le réglage du plan décide, pas un bouton
  closeHome()
  majVoieHud()
})

// ---- L'EXPÉDITION SE SOUVIENT : la progression (salle atteinte, réserve,
// chrono) s'écrit au DÉBUT de chaque salle du parcours PRINCIPAL. On peut
// retourner au menu, fermer le jeu, revenir — et reprendre au début de la
// salle où on était. La RUN SECONDAIRE joue le même parcours (records
// comptés) sans JAMAIS toucher à cette sauvegarde : l'expédition
// principale reste à l'abri.
const CLE_RUN = 'sujet21-run-v1'
interface RunSauvee {
  index: number
  rang?: number // profondeur dans le plan (absente : vieilles sauvegardes)
  liters: number
  time: number
  vies: number
  conclues: number
  instruments: string[]
  xp: number
  livreTotal: number
  condensat?: number // la bourse de la run (absente : anciennes sauvegardes)
  memoireGagnee?: number // le butin de mémoire déjà gravé cette run
  economatVisite?: boolean // l'annexe du Semblable a-t-elle déjà servi ?
}
function runSauvee(): RunSauvee | null {
  try {
    const d = JSON.parse(
      localStorage.getItem(CLE_RUN) ?? 'null',
    ) as RunSauvee | null
    if (!d || typeof d.index !== 'number' || d.index < 1) return null
    return {
      index: Math.floor(d.index),
      liters: Number(d.liters) || 0,
      time: Number(d.time) || 0,
      // sauvegardes d'avant les vies : on reprend avec l'échantillon unique
      vies: Math.max(1, Math.min(VIES_MAX, Math.floor(Number(d.vies) || 1))),
      conclues: Math.max(0, Math.floor(Number(d.conclues) || 0)),
      instruments: Array.isArray(d.instruments)
        ? d.instruments.filter((x): x is string => typeof x === 'string')
        : [],
      xp: Math.max(0, Number(d.xp) || 0),
      livreTotal: Math.max(0, Number(d.livreTotal) || 0),
    }
  } catch {
    return null
  }
}
function sauveRun(): void {
  // seule l'expédition PRINCIPALE s'écrit — et seulement passée la salle 1
  // (une partie à peine commencée n'a rien à sauver ; y revenir efface).
  // Le hub, hors run, ne touche jamais à la sauvegarde.
  if (testLevel || auHub) return
  try {
    if (levelIndex < 1) localStorage.removeItem(CLE_RUN)
    else
      localStorage.setItem(
        CLE_RUN,
        JSON.stringify({
          index: levelIndex,
          rang: voieRang,
          liters: run.bonbonneLiters,
          time: run.runTime,
          vies: run.vies,
          conclues: run.conclues,
          instruments: run.instruments,
          xp: run.xp,
          livreTotal: run.livreTotal,
          condensat,
          memoireGagnee: run.memoireGagnee,
          economatVisite: economatVisiteCetteRun,
        }),
      )
  } catch {
    // stockage indisponible : la reprise attendra
  }
  majBoutonsRun()
}
function effaceRun(): void {
  try {
    localStorage.removeItem(CLE_RUN)
  } catch {
    // sans gravité
  }
  majBoutonsRun()
}
function reprendreRun(save: RunSauvee): void {
  auHub = false
  testLevel = null
  fromEditor = false
  levelIndex = Math.min(save.index, playedLevels().length - 1)
  // le rang de la descente : celui de la sauvegarde, ou l'index à défaut
  voieRang = Math.max(0, Math.round(save.rang ?? save.index))
  run.bonbonneLiters = save.liters
  run.runTime = save.time
  run.vies = save.vies
  run.conclues = save.conclues
  run.instruments = save.instruments.slice()
  run.xp = save.xp
  run.livreTotal = save.livreTotal
  condensat = Math.max(0, Math.round(save.condensat ?? 0))
  majCondensatUI()
  run.memoireGagnee = Math.max(0, Math.round(save.memoireGagnee ?? 0))
  economatIntercalaire = null
  economatVisiteCetteRun = save.economatVisite ?? false
  hasPlayed = true
  document.body.classList.add('playing')
  input.paused = false
  startBtn.textContent = "REPRENDRE L'ESSAI"
  homeRestartBtn.hidden = false
  appliqueProvisions() // les provisions du comptoir valent aussi à la reprise
  restart()
  lanceEveil()
  majBoutonsRun()
}
function majBoutonsRun(): void {
  const save = runSauvee()
  const total = voiePlan.longueur // la descente dure ce que le plan dit
  const btnAband = document.getElementById(
    'start-abandon',
  ) as HTMLButtonElement | null
  if (btnAband) {
    // seulement quand une run est EN COURS : au labo il n'y a rien à quitter,
    // et un essai d'éditeur se referme par son propre chemin
    btnAband.hidden = auHub || !!testLevel || !hasPlayed
    if (btnAband.hidden) {
      btnAband.classList.remove('arme')
      btnAband.textContent = 'QUITTER LA DESCENTE — RETOUR AU MENU'
    }
  }
  if (!hasPlayed) {
    // hors partie, le bouton dit ce qu'il fera : reprendre la descente
    // sauvée, ou en commencer une (par le module et son sas)
    startBtn.textContent = save
      ? `REPRENDRE LA DESCENTE — SALLE ${(save.rang ?? save.index) + 1}/${total}`
      : "COMMENCER L'ESSAI"
  }
}
// Abandonner : en DEUX temps (l'expédition en cours se perd — un clic de
// travers ne doit pas l'emporter). Le second clic renvoie au labo.
document.getElementById('start-abandon')?.addEventListener('click', (e) => {
  const b = e.currentTarget as HTMLButtonElement
  if (!b.classList.contains('arme')) {
    b.classList.add('arme')
    b.textContent = 'CONFIRMER — LA DESCENTE EN COURS SERA PERDUE'
    return
  }
  b.classList.remove('arme')
  b.textContent = 'QUITTER LA DESCENTE — RETOUR AU MENU'
  quitteAuMenu()
})
// au chargement, la fiche est déjà à l'écran : les boutons disent tout de
// suite s'il y a une expédition à reprendre
majBoutonsRun()
// Recommencer depuis la fiche : on referme, on relance le tableau courant
homeRestartBtn.addEventListener('click', () => {
  if (requireName()) return
  document.body.classList.add('playing')
  input.paused = false
  startBtn.textContent = "REPRENDRE L'ESSAI"
  resetAction()
})
// Un essai HORS EXPÉDITION : un tableau (ou une file de tableaux) joué à
// part, sans toucher aux registres. Sert au prototype 21-A bis (depuis le
// banc) et aux salles laser (bouton de la fiche) — la file enchaîne les
// tableaux au sas, comme une mini-expédition d'essai.
// ---- Les cinématiques : le lecteur plein écran, branché sur la bande-son.
// La file d'essai est MIXTE : une étape est un tableau OU une cinématique —
// l'ouverture jouable enchaînera exactement ainsi (planches, puis la cuve).
const lecteurCine = new LecteurCinematique(el('cine'), {
  bruitage: (n) => bande.bruitage(n as Bruitage),
  ponctuation: (n) => bande.ponctuation(n as Ponctuation),
  // null : la cinématique rend la main — le lit du tableau courant reprend
  piste: (n) =>
    bande.setAmbiance(
      n === null
        ? ((level.ambiance as Piste | undefined) ?? null)
        : (n as Piste),
    ),
})
function lireCine(cine: CinematiqueDef): Promise<void> {
  const pause = input.paused
  input.paused = true // aucun geste de jeu ne traverse l'écran de cinématique
  return lecteurCine.joue(cine).then(() => {
    input.paused = pause
  })
}
// Les cinématiques ANCRÉES aux tableaux (cineAvant/cineApres, zones
// déclencheuses) référencent un CODE : cherché parmi les livrées, puis les
// cinématiques du poste (montage), puis la bibliothèque PARTAGÉE — un code
// inconnu est ignoré sans bruit.
let cinesPartagees: CinematiqueDef[] = []
// LE SCÉNARIO : le fil narratif hors tableaux (avant le hub, au lancement
// d'une run, à la défaite…). Le poste garde le dernier connu ; la version
// PARTAGÉE fait foi dès qu'elle arrive.
let scenario: ScenarioDef = avecScenarioLivre(chargeScenario())
fetchBibliotheque().then((biblio) => {
  if (!biblio) return
  cinesPartagees = biblio.cines.map((s) => s.cine)
  if (biblio.scenario) {
    scenario = avecScenarioLivre(biblio.scenario)
    sauveScenario(biblio.scenario) // hors ligne la prochaine fois, il est là
  }
})
function lireCineParCode(code: string): Promise<void> {
  const cible = code.trim().toLowerCase()
  const cine = [
    ...CINEMATIQUES_LIVREES,
    ...chargeCinematiques(),
    ...cinesPartagees,
  ].find((c) => c.code.trim().toLowerCase() === cible)
  return cine ? lireCine(cine) : Promise.resolve()
}
// L'état du jeu que les conditions du scénario interrogent — tout existe
// déjà ailleurs, on ne fait que le présenter.
function etatScenario(): EtatScenario {
  return {
    runs: Math.max(0, records.essaiNumber() - 1),
    salleMax: records.expedition()?.tableaux ?? 0,
    condensat,
    // seuls les jalons du RÉCIT comptent (les marqueurs annexes, non)
    decouvertes: records
      .decouvertesVues()
      .filter((id) => DECOUVERTES.includes(id)).length,
    trophee: (id) => trophees.gagne(id),
  }
}
/**
 * Joue la cinématique que le scénario retient pour ce moment, s'il y en a
 * une. Premier match gagne ; une règle « une seule fois » est mémorisée
 * DÈS le déclenchement (sauter la cinématique ne la fait pas revenir).
 */
function joueMoment(moment: MomentScenario): Promise<void> {
  const regle = choisitRegle(scenario, moment, etatScenario(), chargeVues())
  if (!regle) return Promise.resolve()
  if (regle.uneFois) noteVue(regle.id)
  return lireCineParCode(regle.cine)
}

// ---- LES SÉQUENCES IN-MAP : la mise en scène DANS le tableau. Le
// séquenceur dit ce qui doit être vrai (teinte des lampes, secousse,
// carte, brèches ouvertes) ; le jeu applique, ici et à chaque image.
const sequenceur = new Sequenceur({
  bruitage: (n) => bande.bruitage(n as Bruitage),
  ponctuation: (n) => bande.ponctuation(n as Ponctuation),
  piste: (n) => bande.setAmbiance(n as Piste),
  cinematique: (code) => lireCineParCode(code),
})
;(window as unknown as { __seq: Sequenceur }).__seq = sequenceur
;(window as unknown as { __repare: (id: string) => void }).__repare =
  tenteReparation
/** Une séquence par son code : livrée, puis celles du poste. */
function trouveSequence(code: string): SequenceDef | null {
  const cible = code.trim().toLowerCase()
  return (
    [SEQUENCE_ALERTE, ...chargeSequences()].find(
      (s) => s.code.trim().toLowerCase() === cible,
    ) ?? null
  )
}
function demarreSequence(code: string): void {
  const seq = trouveSequence(code)
  if (seq) sequenceur.demarre(seq)
}
// La carte de séquence : un bandeau discret, dans le monde du jeu
const carteSeqEl = el('carte-seq')
let carteSeqTexte = ''
/** Applique à l'écran ce que le séquenceur tient pour vrai. */
function appliqueSequence(): void {
  if (sequenceur.etat.carte !== carteSeqTexte) {
    carteSeqTexte = sequenceur.etat.carte
    carteSeqEl.textContent = carteSeqTexte
    carteSeqEl.classList.toggle('visible', !!carteSeqTexte)
  }
  document.body.classList.toggle('secousse', sequenceur.etat.secousse)
}
/** Les lampes du tableau, teintées par la séquence s'il y a lieu. On ne
 *  touche JAMAIS aux données du tableau : c'est une copie de rendu. */
function lumieresVives(): LumiereDef[] {
  const base = level.lumieres ?? []
  const { teinte, gain } = sequenceur.etat
  if (!teinte && gain === 1) return base
  return base.map((l) => ({
    ...l,
    couleur: teinte ?? l.couleur,
    intensite: (l.intensite ?? 1) * gain,
  }))
}

// Déclencheurs déjà joués dans l'essai en cours (réarmés par restart)
const cinesVues = new Set<string>()
// Le tableau dont la cinématique d'entrée a été jouée : un R sur place ne
// doit pas la rejouer, seule l'ARRIVÉE dans un autre tableau la relance.
let cineNiveauVu: LevelDef | null = null
function estCine(e: LevelDef | CinematiqueDef): e is CinematiqueDef {
  return 'planches' in e
}
// Joue les cinématiques en tête de file (il peut y en avoir plusieurs à la
// suite), puis rend la main au tableau qui suit.
function joueCinesEnTete(puis: () => void): void {
  const tete = testQueue[0]
  if (tete && estCine(tete)) {
    testQueue.shift()
    void lireCine(tete).then(() => joueCinesEnTete(puis))
    return
  }
  puis()
}
function startTest(etapes: (LevelDef | CinematiqueDef)[]): void {
  if (requireName()) {
    openHome() // le champ du nom vit sur la fiche : on la montre pour le remplir
    return
  }
  testQueue = etapes.slice()
  fromEditor = false
  // tout nouveau départ désarme le retour-planche : seule la carte ⏵ le
  // ré-arme, juste après cet appel
  fromPlanche = false
  document.getElementById('planche-retour')?.setAttribute('hidden', '')
  run.bonbonneLiters = 0
  run.runTime = 0
  hasPlayed = true
  // « playing » d'abord : restart() se charge alors lui-même du plan large et
  // du carton de journal — sinon les deux se jouaient en double, en décalé.
  document.body.classList.add('playing')
  input.paused = false
  startBtn.textContent = "REPRENDRE L'ESSAI"
  homeRestartBtn.hidden = false
  joueCinesEnTete(() => {
    const lv = testQueue.shift()
    if (!lv || estCine(lv)) {
      // la file ne contenait que des cinématiques : retour à la fiche
      testLevel = null
      openHome()
      return
    }
    testLevel = lv
    restart()
    montrerOnboard() // premier contact tactile : la prise en main d'abord
    lanceEveil() // premier contact tout court : l'éveil d'abord
  })
}
function startBisTest(): void {
  startTest([TABLEAU_1BIS])
}
// La bibliothèque d'images : import (recompressé WebP), catalogue partagé,
// sélecteur pour les planches — accessible de l'éditeur et du montage
const imagerie = new Imagerie(el('imagerie'), {
  auteur: () => records.operator(),
})
document
  .getElementById('ed-images')
  ?.addEventListener('click', () => imagerie.open())
// La table de montage des cinématiques : l'écran où le concepteur a la
// main — planches, effets, sons, lecture immédiate, export/import, partage.
const montage = new TableMontage(el('montage'), {
  livrees: CINEMATIQUES_LIVREES,
  lire: (c) => lireCine(c),
  auteur: () => records.operator(),
  choisirImage: (rend) => imagerie.open(rend),
  surPartagees: (liste) => {
    cinesPartagees = liste
  },
  surScenario: (s) => {
    scenario = s
  },
  trophees: TROPHEES.map((t) => ({ id: t.id, nom: t.nom })),
})
document
  .getElementById('open-montage')
  ?.addEventListener('click', () => montage.open())
// …et depuis l'éditeur aussi : la table s'ouvre PAR-DESSUS lui (z-index),
// on compose la cinématique puis on branche son code dans le tableau
document
  .getElementById('ed-montage')
  ?.addEventListener('click', () => montage.open())
// Sondes de conception/test : jouer une cinématique arbitraire, lire l'état
;(
  window as unknown as { __lireCine: (c: unknown) => Promise<void> }
).__lireCine = (c) => lireCine(c as CinematiqueDef)
;(window as unknown as { __cineActif: () => boolean }).__cineActif = () =>
  lecteurCine.actif
// ---- Éditeur de tableaux ----
// Il se superpose au jeu ; « Essayer » repasse par le même chemin que le
// prototype (testLevel), donc un tableau édité se joue avec toutes les
// mécaniques, sans toucher à l'expédition ni aux registres.
// « Essayer » vient-il de l'éditeur ? Si oui, on doit pouvoir y retourner
// d'un geste, à tout instant — y compris depuis l'écran de fin d'essai.
let fromEditor = false
const editor = new LevelEditor(el('editor'), {
  // les portées dessinées (aspiration du sas, auras, rails) suivent le banc
  params: () => params,
  play: (lvl) => {
    testLevel = lvl
    fromEditor = true
    run.bonbonneLiters = 0
    run.runTime = 0
    hasPlayed = true
    editor.close()
    document.body.classList.add('playing')
    input.paused = false
    restart()
  },
  quit: () => {
    editor.close()
    fromEditor = false
    testLevel = null
    openHome()
    restart()
  },
  operator: () => records.operator(),
  // les menus déroulants de l'éditeur : les VRAIES cinématiques et séquences
  // connues du poste — livrées, composées ici, et partagées en ligne
  cines: () =>
    [...CINEMATIQUES_LIVREES, ...chargeCinematiques(), ...cinesPartagees]
      .filter((c, i, t) => t.findIndex((o) => o.code === c.code) === i)
      .map((c) => ({ code: c.code, titre: c.titre })),
  sequences: () =>
    [SEQUENCE_ALERTE, ...chargeSequences()]
      .filter((s, i, t) => t.findIndex((o) => o.code === s.code) === i)
      .map((s) => ({ code: s.code, titre: s.titre })),
  libraryChanged: (levels) => {
    libraryLevels = levels.map((s) => s.level)
    renderRegistres()
    updateLibraryButton()
    renderSalles()
  },
  // l'éditeur n'ordonne plus lui-même : son bouton renvoie à LA PLANCHE
  planche: () => void ouvrePlanche(),
  // L2 tenu = Maj : la multi-sélection au Steam Deck (trackpad droit en
  // souris, aucune touche Maj sous la main)
  modMulti: () => manette.ltVal > 0.5,
})

// ---- Les panneaux de l'éditeur se TIRENT au doigt --------------------------
// Steam Deck, trackpad gauche en souris : presser n'importe où dans le
// panneau et GLISSER — le contenu suit le geste, convention tactile (on tire
// le contenu, pas l'ascenseur : glisser vers le haut fait monter le bas de
// la liste). Un clic sans glissement reste un clic ; passé 6 px, le geste
// devient défilement et le clic qui suivrait est avalé.
function glisseAuDoigt(zone: HTMLElement): void {
  let suivi: {
    id: number
    x0: number
    y0: number
    cible: HTMLElement
    top0: number
    left0: number
    engage: boolean
  } | null = null
  let avaleClic = false
  // la zone à défiler : le défilable le plus proche du point pressé (la
  // liste des tableaux a son propre ascenseur, imbriqué dans le panneau)
  const defilable = (depart: HTMLElement): HTMLElement => {
    let n: HTMLElement | null = depart
    while (n) {
      if (n.scrollHeight > n.clientHeight + 1) {
        const s = getComputedStyle(n)
        if (/(auto|scroll)/.test(s.overflowY)) return n
      }
      if (n === zone) break
      n = n.parentElement
    }
    return zone
  }
  zone.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    avaleClic = false
    const t = e.target as HTMLElement
    if (t.closest('input, select, textarea')) return // les champs d'abord
    suivi = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      cible: defilable(t),
      top0: 0,
      left0: 0,
      engage: false,
    }
    suivi.top0 = suivi.cible.scrollTop
    suivi.left0 = suivi.cible.scrollLeft
  })
  zone.addEventListener('pointermove', (e) => {
    if (!suivi || e.pointerId !== suivi.id) return
    const dx = e.clientX - suivi.x0
    const dy = e.clientY - suivi.y0
    if (!suivi.engage) {
      if (Math.hypot(dx, dy) < 6) return
      suivi.engage = true
      try {
        zone.setPointerCapture(e.pointerId)
      } catch {
        // pointeur déjà relâché ou simulé : le glissement marche sans capture
      }
    }
    suivi.cible.scrollTop = suivi.top0 - dy
    suivi.cible.scrollLeft = suivi.left0 - dx
    e.preventDefault()
  })
  const finit = (e: PointerEvent): void => {
    if (!suivi || e.pointerId !== suivi.id) return
    avaleClic = suivi.engage // le glissement ne doit pas cliquer en se posant
    suivi = null
  }
  zone.addEventListener('pointerup', finit)
  zone.addEventListener('pointercancel', finit)
  zone.addEventListener(
    'click',
    (e) => {
      if (avaleClic) {
        avaleClic = false
        e.preventDefault()
        e.stopPropagation()
      }
    },
    true,
  )
}
for (const p of Array.from(
  document.querySelectorAll<HTMLElement>('#editor .ed-side'),
))
  glisseAuDoigt(p)

// ---- L'ÉDITEUR au STICK GAUCHE : ses panneaux défilent comme la planche —
// même mécanique que le stick droit des menus, même vitesse. Le trackpad
// gauche du Deck configuré en joystick parle sur les mêmes axes. Le
// défilement vise le défilable SOUS LE CURSEUR (panneau gauche, panneau
// droit, liste des tableaux…) — à défaut, le panneau de droite.
const editeurHote = document.getElementById('editor') as HTMLElement
let editeurDefilable: HTMLElement | null = null
function defilableSous(depart: HTMLElement | null): HTMLElement | null {
  let n: HTMLElement | null = depart
  while (n && n !== editeurHote) {
    if (
      n.scrollHeight > n.clientHeight + 4 ||
      n.scrollWidth > n.clientWidth + 4
    ) {
      const s = getComputedStyle(n)
      if (/(auto|scroll)/.test(s.overflowY + s.overflowX)) return n
    }
    n = n.parentElement
  }
  return null
}
editeurHote.addEventListener('pointermove', (e) => {
  editeurDefilable = defilableSous(e.target as HTMLElement)
})
function defileEditeur(dt: number): void {
  const vx = manette.dirX * manette.force
  const vy = manette.dirY * manette.force
  if (Math.abs(vx) < 0.02 && Math.abs(vy) < 0.02) return
  const sc =
    editeurDefilable && document.contains(editeurDefilable)
      ? editeurDefilable
      : document.querySelector<HTMLElement>('#editor .ed-side--right')
  if (!sc) return
  sc.scrollTop += vy * 1100 * dt
  sc.scrollLeft += vx * 1100 * dt
}

// ---- LA PLANCHE : l'ordonnancement de l'expédition, en cartes visuelles --
// Toutes les salles de la bibliothèque en mini-cartes : glisser (ou ◀ ▶)
// réordonne LA séquence — la même que l'éditeur (reorderLibrary), qui se
// resynchronise aussitôt. Le champ code enregistre la nomenclature via
// saveLevel. Le hub et ses chantiers ne s'affichent pas (hors séquence)
// mais GARDENT leur place dans l'ordre envoyé au serveur.
const plancheEl = document.getElementById('planche') as HTMLDivElement
let plancheTous: StoredLevel[] = []
let plancheBusy = false
// L'ESSAI DEPUIS LA PLANCHE : le ⏵ d'une carte lance le tableau, et l'on
// REVIENT là où on en était — bouton « revenir à la planche » en jeu, et
// retour automatique à la conclusion de l'essai (le miroir de fromEditor).
let fromPlanche = false
let plancheScroll = 0
function retournePlanche(): void {
  fromPlanche = false
  document.getElementById('planche-retour')?.setAttribute('hidden', '')
  openHome() // fige l'essai, comme le retour au menu
  plancheEl.hidden = false
  const corps = document.getElementById('planche-corps')
  if (corps) corps.scrollTop = plancheScroll
}
document
  .getElementById('planche-retour')
  ?.addEventListener('click', retournePlanche)
function plancheDit(msg: string): void {
  const e = document.getElementById('planche-etat')
  if (e) e.textContent = msg
}
/** Répercute une réponse serveur partout : planche, fiche, salles, éditeur.
 * L'éditeur ADOPTE la réponse telle quelle : re-télécharger tomberait sur le
 * cache du magasin (pointeur servi 60 s) et faisait revenir l'ancien ordre. */
function plancheSync(saved: StoredLevel[]): void {
  plancheTous = saved
  libraryLevels = saved.map((s) => s.level)
  renderRegistres()
  updateLibraryButton()
  renderSalles()
  editor.adopteBibliotheque(saved)
  renderPlanche()
}
async function ouvrePlanche(): Promise<void> {
  plancheEl.hidden = false
  const corps = document.getElementById('planche-corps')
  if (corps) corps.innerHTML = ''
  plancheDit('Chargement de la bibliothèque…')
  const lib = await fetchLibrary()
  if (!lib) {
    plancheDit(
      'Bibliothèque injoignable (hors ligne ou serveur local) : la planche ordonne la bibliothèque partagée, elle a besoin du serveur.',
    )
    return
  }
  // LA PLANCHE SYNCHRONISE TOUT LE MONDE, pas seulement ses cartes. Elle se
  // contentait de « plancheTous = lib ; renderPlanche() » : l'éditeur, lui,
  // gardait sa bibliothèque d'avant. Un tableau apparu depuis (autre poste,
  // autre session) s'affichait donc bien dans la planche, mais son ✎
  // ouvrait un identifiant que l'éditeur ne connaissait pas — il ne
  // chargeait rien, gardait le tableau précédent, et ENREGISTRER écrivait
  // ce tableau-là. La modification semblait « pas prise en compte », et une
  // autre salle pouvait se faire écraser au passage.
  plancheSync(lib)
  plancheDit(
    plancheTous.some((s) => !estCodeHub(s.level.code))
      ? ''
      : 'Bibliothèque vide : enregistrez des tableaux depuis l’éditeur, ils apparaîtront ici.',
  )
}
/** L'ordre COMPLET à envoyer : les cartes visibles réarrangées, le hub et
 * ses chantiers inchangés à leurs positions d'origine. */
async function plancheOrdonne(visibles: StoredLevel[]): Promise<void> {
  if (plancheBusy) return
  plancheBusy = true
  let k = 0
  const ordre = plancheTous.map((s) =>
    estCodeHub(s.level.code) ? s.id : visibles[k++].id,
  )
  // rendu optimiste : la carte bouge tout de suite, le serveur confirme
  const avant = plancheTous
  plancheTous = ordre.map((id) => plancheTous.find((s) => s.id === id)!)
  renderPlanche()
  plancheDit('Enregistrement de l’ordre…')
  const saved = await reorderLibrary(ordre)
  plancheBusy = false
  if (saved) {
    plancheSync(saved)
    plancheDit('Ordre enregistré — la séquence de l’éditeur suit.')
  } else {
    plancheTous = avant
    renderPlanche()
    plancheDit('Réordonnancement refusé : bibliothèque injoignable.')
  }
}
async function plancheCode(id: string, brut: string): Promise<void> {
  if (plancheBusy) return
  const entry = plancheTous.find((s) => s.id === id)
  if (!entry) return
  const code = codeCanon(brut.trim()).slice(0, 16)
  if (!code || code === entry.level.code) {
    renderPlanche() // restaure l'affichage si le champ a été vidé
    return
  }
  plancheBusy = true
  entry.level.code = code
  plancheDit(`Enregistrement du code « ${code} »…`)
  const saved = await saveLevel(
    entry.level,
    id,
    records.operator() || 'anonyme',
  )
  plancheBusy = false
  if (saved) {
    plancheSync(saved.levels)
    const d = decodeCodeAtelier(code)
    plancheDit(
      d
        ? `Code « ${code} » enregistré — ${MOMENT_COURT[d.moment].toLowerCase()} · ${MECANIQUE_NOMS[d.mecanique]} · difficulté ${d.difficulte}.`
        : `Code « ${code} » enregistré (hors nomenclature : il se joue pareil, sans tri par code).`,
    )
  } else {
    plancheDit(
      `Enregistrement refusé : ${raisonDuRefus() || 'bibliothèque injoignable'}.`,
    )
    void ouvrePlanche() // repart de l'état serveur
  }
}
// ---- Les MOLETTES du code : chaque chiffre se règle sur place ----------
// Un cran ▴ au-dessus, la valeur au centre (une liste déroulante : le
// picker natif sur iPad), un cran ▾ en dessous — sobre, au doigt comme à
// la souris. L'enregistrement part un instant après le dernier cran.
const CHOIX_MOMENT = ['1', '2', '3']
const CHOIX_MECA = ['0', '1', '2', '3']
const CHOIX_DIFF = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
function roueHtml(
  cur: string,
  choix: string[],
  titre: string,
  cap: string,
): string {
  const i = choix.indexOf(cur)
  const opts = choix
    .map(
      (v) =>
        `<option value="${v}"${v === cur ? ' selected' : ''}>${v}</option>`,
    )
    .join('')
  return (
    `<span class="pr-col">` +
    `<button type="button" class="pr-cran" data-dir="1" title="${titre} — cran au-dessus"${i >= choix.length - 1 ? ' disabled' : ''}>▴</button>` +
    `<select class="pr-sel" title="${titre}">${opts}</select>` +
    `<button type="button" class="pr-cran" data-dir="-1" title="${titre} — cran en dessous"${i <= 0 ? ' disabled' : ''}>▾</button>` +
    `<small class="pr-cap">${cap}</small>` +
    `</span>`
  )
}
function chipsHtml(code: string): string {
  const d = decodeCodeAtelier(code)
  return d
    ? `<i>${MOMENT_COURT[d.moment]}</i>` +
        `<i class="sc-m${d.mecanique}">${MECANIQUE_NOMS[d.mecanique].toUpperCase()}</i>` +
        `<i>DIFF ${d.difficulte}</i>`
    : ''
}
const plancheTimers = new Map<string, number>()
/** On peut monter plusieurs crans d'affilée : un seul enregistrement part,
 * un instant après le dernier geste. */
function plancheCodePlusTard(id: string, code: string): void {
  const t = plancheTimers.get(id)
  if (t !== undefined) window.clearTimeout(t)
  plancheTimers.set(
    id,
    window.setTimeout(() => {
      plancheTimers.delete(id)
      if (plancheBusy) {
        plancheCodePlusTard(id, code) // le serveur est occupé : on repasse
        return
      }
      void plancheCode(id, code)
    }, 600),
  )
}
function renderPlanche(): void {
  const corps = document.getElementById('planche-corps')
  if (!corps) return
  const visibles = plancheTous.filter((s) => !estCodeHub(s.level.code))
  corps.innerHTML = ''
  visibles.forEach((s, i) => {
    const carte = document.createElement('div')
    carte.className = 'pl-carte'
    carte.draggable = true
    carte.dataset.id = s.id
    const d = decodeCodeAtelier(s.level.code)
    const esc = (t: string): string =>
      t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    // le code, molette par molette : « 123 » nu, ou la codification
    // complète « 21AB-123 » — le préfixe ET les lettres d'ordre sont
    // GRAVÉS (l'ordre de jeu se règle en glissant les cartes, pas dans le
    // code) : seuls les trois chiffres de la fin s'ajustent
    const m21 = /^21\s*([A-Z])([A-Z])\s*-\s*(\d)(\d)(\d)$/i.exec(s.level.code)
    const m3 = /^(\d)(\d)(\d)$/.exec(s.level.code.trim())
    const roues = d !== null && (m21 !== null || m3 !== null)
    const chiffres = m21
      ? [m21[3], m21[4], m21[5]]
      : m3
        ? [m3[1], m3[2], m3[3]]
        : []
    const rouesHtml = !roues
      ? ''
      : `<div class="pl-roues">` +
        (m21
          ? `<span class="pr-fixe" title="Le préfixe et les lettres sont GRAVÉS — l'ordre de jeu se règle en glissant les cartes, pas dans le code. Seuls les chiffres de la fin s'ajustent.">21${m21[1].toUpperCase()}${m21[2].toUpperCase()}-</span>`
          : '') +
        roueHtml(
          chiffres[0],
          CHOIX_MOMENT,
          'MOMENT de la run — 1 début · 2 milieu · 3 fin',
          'MOMENT',
        ) +
        roueHtml(
          chiffres[1],
          CHOIX_MECA,
          'MÉCANIQUE requise — 0 aucune · 1 glace · 2 vapeur · 3 toutes',
          'MÉCA',
        ) +
        roueHtml(
          chiffres[2],
          CHOIX_DIFF,
          'DIFFICULTÉ — de 0 à 9, à moment et mécanique égaux',
          'DIFF',
        ) +
        `</div>`
    // sous le code : QUI l'a saisi et QUAND — en petit, pour savoir à qui
    // s'adresser quand une codification surprend (l'heure exacte en info-bulle)
    const quand = s.codeAt ? new Date(s.codeAt) : null
    const saisi = `<small class="pl-saisi" title="${esc(
      quand && !Number.isNaN(quand.getTime())
        ? `Code saisi par ${s.codeAuteur || 'anonyme'} — ${quand.toLocaleString('fr-FR')}`
        : `Code saisi par ${s.codeAuteur || 'anonyme'}`,
    )}">${esc(mentionSaisie(s.codeAuteur, s.codeAt))}</small>`
    carte.innerHTML =
      `<canvas width="220" height="126"></canvas>` +
      `<span class="pl-rang">${i + 1}</span>` +
      `<button type="button" class="pl-jouer" title="Essayer ce tableau — le bouton « revenir à la planche » vous ramènera ici">⏵</button>` +
      `<button type="button" class="pl-editer" title="Ouvrir ce tableau dans l'ÉDITEUR — la planche est le sélecteur grand format">✎</button>` +
      rouesHtml +
      (roues ? saisi : '') +
      `<div class="pl-bas">` +
      (roues
        ? ''
        : `<input class="pl-code" maxlength="16" value="${esc(s.level.code)}" title="Le code nomenclature (« 111 ») — Entrée ou sortir du champ enregistre" />`) +
      `<span class="pl-nom" title="${esc(s.level.name)}">${esc(s.level.name)}</span>` +
      `<span class="pl-ord">` +
      `<button type="button" data-tot="-1" title="Jouer plus tôt"${i === 0 ? ' disabled' : ''}>◀</button>` +
      `<button type="button" data-tot="1" title="Jouer plus tard"${i === visibles.length - 1 ? ' disabled' : ''}>▶</button>` +
      `</span></div>` +
      (roues ? '' : saisi) +
      (d ? `<span class="salle-chips">${chipsHtml(s.level.code)}</span>` : '')
    dessineMiniCarte(
      carte.querySelector('canvas') as HTMLCanvasElement,
      s.level,
    )
    // ◀ ▶ : l'échange avec la voisine
    for (const b of Array.from(
      carte.querySelectorAll<HTMLButtonElement>('[data-tot]'),
    )) {
      b.addEventListener('click', () => {
        const j = i + Number(b.dataset.tot)
        if (j < 0 || j >= visibles.length) return
        const next = [...visibles]
        ;[next[i], next[j]] = [next[j], next[i]]
        void plancheOrdonne(next)
      })
    }
    if (roues) {
      // les MOLETTES : chaque cran ajuste un caractère, l'ensemble
      // recompose le code et l'enregistre après le dernier geste
      const sels = Array.from(
        carte.querySelectorAll<HTMLSelectElement>('.pr-sel'),
      )
      const chips = carte.querySelector('.salle-chips')
      // les lettres gravées viennent du code d'origine — seules les trois
      // molettes de chiffres écrivent
      const lire = (): string =>
        m21
          ? `21${m21[1].toUpperCase()}${m21[2].toUpperCase()}-${sels[0].value}${sels[1].value}${sels[2].value}`
          : sels.map((x) => x.value).join('')
      const applique = (): void => {
        for (const col of Array.from(carte.querySelectorAll('.pr-col'))) {
          const sel = col.querySelector('select') as HTMLSelectElement
          for (const b of Array.from(
            col.querySelectorAll<HTMLButtonElement>('.pr-cran'),
          ))
            b.disabled =
              b.dataset.dir === '1'
                ? sel.selectedIndex >= sel.options.length - 1
                : sel.selectedIndex <= 0
        }
        const code = lire()
        if (chips) chips.innerHTML = chipsHtml(code) // le sens suit le cran
        plancheCodePlusTard(s.id, code)
      }
      for (const sel of sels) {
        sel.addEventListener('change', applique)
        sel.addEventListener('pointerdown', (e) => e.stopPropagation())
      }
      for (const b of Array.from(
        carte.querySelectorAll<HTMLButtonElement>('.pr-cran'),
      )) {
        b.addEventListener('click', () => {
          const sel = b.parentElement?.querySelector('select')
          if (!sel) return
          const j = sel.selectedIndex + Number(b.dataset.dir)
          if (j < 0 || j >= sel.options.length) return
          sel.selectedIndex = j
          applique()
        })
        b.addEventListener('pointerdown', (e) => e.stopPropagation())
      }
    } else {
      // code hors nomenclature : le champ libre reste — Entrée ou la
      // sortie du champ enregistre (taper « 123 » fait naître les molettes)
      const codeInp = carte.querySelector('.pl-code') as HTMLInputElement
      codeInp.addEventListener(
        'change',
        () => void plancheCode(s.id, codeInp.value),
      )
      codeInp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          codeInp.blur()
        }
        e.stopPropagation()
      })
      codeInp.addEventListener('pointerdown', (e) => e.stopPropagation())
    }
    // le ✎ : la carte s'ouvre dans l'ÉDITEUR — le sélecteur grand format,
    // bien plus commode au doigt que la liste du panneau (Steam Deck)
    carte.querySelector('.pl-editer')?.addEventListener('click', (e) => {
      e.stopPropagation()
      plancheEl.hidden = true
      sallesEl.hidden = true
      openEditor()
      editor.ouvreTableau(s.id)
    })
    // l'ESSAI : la carte se joue, et on saura revenir ici même
    carte.querySelector('.pl-jouer')?.addEventListener('click', (e) => {
      e.stopPropagation()
      plancheScroll = corps.scrollTop
      plancheEl.hidden = true
      sallesEl.hidden = true
      editor.close() // la planche peut être posée sur l'éditeur : on le replie
      startTest([s.level])
      // startTest peut rendre la main à la fiche (nom d'opérateur manquant) :
      // le retour ne s'arme que si l'essai a vraiment démarré
      if (document.body.classList.contains('playing')) {
        fromPlanche = true
        document.getElementById('planche-retour')?.removeAttribute('hidden')
      }
    })
    // le glisser-déposer : attraper une carte, la lâcher sur une autre —
    // la carte prend cette place (le geste de l'éditeur, en grand)
    carte.addEventListener('dragstart', (e) => {
      if (
        (e.target as HTMLElement).closest(
          'input, select, .pl-roues, .pl-ord, .pl-jouer, .pl-editer',
        )
      ) {
        e.preventDefault()
        return
      }
      e.dataTransfer?.setData('text/plain', s.id)
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
      carte.classList.add('dragging')
    })
    carte.addEventListener('dragend', () => {
      carte.classList.remove('dragging')
      for (const c of Array.from(corps.querySelectorAll('.drag-over')))
        c.classList.remove('drag-over')
    })
    carte.addEventListener('dragover', (e) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
      carte.classList.add('drag-over')
    })
    carte.addEventListener('dragleave', () =>
      carte.classList.remove('drag-over'),
    )
    carte.addEventListener('drop', (e) => {
      e.preventDefault()
      carte.classList.remove('drag-over')
      const id = e.dataTransfer?.getData('text/plain') ?? ''
      const from = visibles.findIndex((x) => x.id === id)
      if (id === '' || from < 0 || from === i) return
      const next = [...visibles]
      const [prise] = next.splice(from, 1)
      next.splice(i, 0, prise)
      void plancheOrdonne(next)
    })
    corps.appendChild(carte)
  })
}
document
  .getElementById('salles-planche-btn')
  ?.addEventListener('click', () => void ouvrePlanche())
// la planche s'ouvre aussi depuis l'ACCUEIL (mode concepteur) et depuis
// l'ÉDITEUR : le voile se pose par-dessus, le fermer rend l'écran d'avant
document
  .getElementById('home-planche')
  ?.addEventListener('click', () => void ouvrePlanche())
document
  .getElementById('ed-planche')
  ?.addEventListener('click', () => void ouvrePlanche())
document.getElementById('planche-fermer')?.addEventListener('click', () => {
  plancheEl.hidden = true
})
plancheEl?.addEventListener('pointerdown', (e) => {
  if (e.target === plancheEl) plancheEl.hidden = true
})

// ---- LE CAHIER DES RÈGLES : la génération procédurale, noir sur blanc ----
// Le catalogue (reglesGen.ts) dit ce que le générateur FAIT et ce qu'un
// level designer en ATTEND ; l'écran laisse ANNOTER chaque règle et en
// CONSIGNER de nouvelles en texte libre. Notes et ajouts vivent dans le
// magasin partagé (/api/regles) : écrits depuis le Deck ou la tablette,
// ils sont relus au moment d'implémenter — le cahier est le pont entre
// la partie et l'atelier.
const reglesEl = document.getElementById('regles') as HTMLDivElement
interface NoteRegle {
  id: string
  note: string
  auteur: string
  date: string
}
interface AjoutRegle {
  id: string
  titre: string
  texte: string
  auteur: string
  date: string
}
let reglesNotes: NoteRegle[] = []
let reglesAjouts: AjoutRegle[] = []
let reglesJoignable = false
let reglesBusy = false
function reglesDit(msg: string): void {
  const e = document.getElementById('regles-etat')
  if (e) e.textContent = msg
}
function signeRegle(verbe: string, auteur: string, date: string): string {
  const dt = new Date(date)
  if (Number.isNaN(dt.getTime())) return ''
  const quand = `${dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} à ${dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
  return `${verbe} par ${auteur || 'anonyme'} le ${quand}`
}
async function ouvreRegles(): Promise<void> {
  reglesEl.hidden = false
  const corps = document.getElementById('regles-corps')
  if (corps) corps.innerHTML = ''
  reglesDit('Chargement du cahier partagé…')
  try {
    const r = await fetch('/api/regles')
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const d = (await r.json()) as { notes?: NoteRegle[]; ajouts?: AjoutRegle[] }
    reglesNotes = Array.isArray(d.notes) ? d.notes : []
    reglesAjouts = Array.isArray(d.ajouts) ? d.ajouts : []
    reglesJoignable = true
    reglesDit('')
  } catch {
    reglesNotes = []
    reglesAjouts = []
    reglesJoignable = false
    reglesDit(
      'Magasin injoignable (hors ligne ou serveur local) : le cahier se lit, mais notes et ajouts ne s’enregistreront pas.',
    )
  }
  renderRegles()
}
// Sur ÉCHEC ou refus, on ne re-rend JAMAIS l'écran : ce que le concepteur a
// tapé reste sous ses yeux — seul le succès reconstruit (et vide le champ).
function reglesOccupe(): boolean {
  if (!reglesBusy) return false
  reglesDit('Un enregistrement est déjà en cours — réessayez dans un instant.')
  return true
}
/** Annote une règle (note vide : l'annotation s'efface). */
async function posteNoteRegle(id: string, note: string): Promise<void> {
  if (!reglesJoignable || reglesOccupe()) return
  reglesBusy = true
  reglesDit('Enregistrement de la note…')
  try {
    const r = await fetch('/api/regles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'note',
        id,
        note,
        auteur: records.operator() || 'anonyme',
      }),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const d = (await r.json()) as { note?: NoteRegle }
    reglesNotes = reglesNotes.filter((n) => n.id !== id)
    if (d.note && d.note.note) reglesNotes.push(d.note)
    reglesBusy = false
    reglesDit(
      note ? 'Note enregistrée — partagée entre postes.' : 'Note effacée.',
    )
    renderRegles()
  } catch {
    reglesBusy = false
    reglesDit(
      'Enregistrement refusé : magasin injoignable — la note reste à l’écran, réessayez.',
    )
  }
}
/** Consigne une règle nouvelle (ou réécrit un ajout existant : même id). */
async function posteAjoutRegle(texte: string, id?: string): Promise<void> {
  if (!reglesJoignable || !texte.trim() || reglesOccupe()) return
  reglesBusy = true
  reglesDit('Consignation de la règle…')
  try {
    const r = await fetch('/api/regles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'ajout',
        ...(id ? { id } : {}),
        texte,
        auteur: records.operator() || 'anonyme',
      }),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const d = (await r.json()) as { ajout?: AjoutRegle }
    if (d.ajout) {
      reglesAjouts = reglesAjouts.filter((a) => a.id !== d.ajout!.id)
      reglesAjouts.push(d.ajout)
    }
    reglesBusy = false
    reglesDit(
      id
        ? 'Règle réécrite.'
        : 'Règle consignée — elle attend son implémentation.',
    )
    renderRegles()
  } catch {
    reglesBusy = false
    reglesDit(
      'Consignation refusée : magasin injoignable — votre texte reste à l’écran, réessayez.',
    )
  }
}
async function oteAjoutRegle(id: string): Promise<void> {
  if (!reglesJoignable || reglesOccupe()) return
  reglesBusy = true
  reglesDit('Retrait de la règle…')
  try {
    const r = await fetch(`/api/regles?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    reglesAjouts = reglesAjouts.filter((a) => a.id !== id)
    reglesNotes = reglesNotes.filter((n) => n.id !== id)
    reglesBusy = false
    reglesDit('Règle retirée.')
    renderRegles()
  } catch {
    reglesBusy = false
    reglesDit('Retrait refusé : magasin injoignable.')
  }
}
/** La zone d'annotation d'une règle : le texte se pose, le blur enregistre. */
function zoneNoteRegle(id: string, conteneur: HTMLElement): void {
  const note = reglesNotes.find((n) => n.id === id)
  const ta = document.createElement('textarea')
  ta.className = 'rg-note'
  ta.placeholder =
    'Annoter cette règle — votre note est partagée entre concepteurs…'
  ta.value = note?.note ?? ''
  ta.dataset.initial = ta.value
  ta.disabled = !reglesJoignable
  ta.addEventListener('blur', () => {
    if (ta.value.trim() === (ta.dataset.initial ?? '').trim()) return
    void posteNoteRegle(id, ta.value.trim())
  })
  conteneur.appendChild(ta)
  if (note?.note) {
    const s = document.createElement('small')
    s.className = 'rg-signe'
    s.textContent = signeRegle('annotée', note.auteur, note.date)
    conteneur.appendChild(s)
  }
}
// Le panneau des PARAMÈTRES DU CYCLE reste ouvert d'un re-rendu à l'autre
let reglesCycleOuvert = false
/** Le bouton + panneau PARAMÈTRES DU CYCLE : le plan de la voie (longueur,
 * difficulté max, descente du jour) se règle ICI — plus au banc : le banc
 * règle la simulation, le cahier règle le cycle de vie d'une partie. */
function monteCycleRegles(corps: HTMLElement): void {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'rg-cycle-btn'
  btn.id = 'regles-cycle-btn'
  btn.textContent = '⚙ PARAMÈTRES DU CYCLE — LE PLAN DE LA VOIE'
  corps.appendChild(btn)
  const panneau = document.createElement('div')
  panneau.className = 'rg-cycle'
  panneau.id = 'regles-cycle'
  panneau.hidden = !reglesCycleOuvert
  panneau.innerHTML =
    `<p>La descente complète de la VOIE SEMI-PROCÉDURALE : sa <b>longueur</b> ` +
    `(la voie se boucle au bout, salles générées à la relève), la <b>difficulté ` +
    `maximale</b> (la rampe monte de 0 au départ jusqu'à ce plafond), et la ` +
    `<b>descente du jour</b> (les salles viennent de la date — les mêmes pour ` +
    `tous les postes, les palmarès se comparent). Les <b>tableaux écrits</b> se ` +
    `coupent : salles générées seules, la descente est alors TOUT PROCÉDURALE. ` +
    `Quand ils tiennent, le tableau proposé n'est plus celui du rang suivant ` +
    `mais une PIOCHE du pool sur le trigramme du plan — deux descentes ne ` +
    `racontent plus la même suite. Chaque réglage s'enregistre ` +
    `aussitôt et prend effet à la prochaine descente.</p>`
  const lignes = document.createElement('div')
  lignes.className = 'rg-cycle-lignes'
  const cran = (
    nom: string,
    lit: () => number,
    pose: (v: number) => void,
  ): HTMLElement => {
    const p = document.createElement('div')
    p.className = 'rg-param'
    const titre = document.createElement('b')
    titre.textContent = nom
    const moins = document.createElement('button')
    moins.type = 'button'
    moins.textContent = '−'
    const val = document.createElement('output')
    val.textContent = String(lit())
    const plus = document.createElement('button')
    plus.type = 'button'
    plus.textContent = '+'
    const applique = (delta: number): void => {
      pose(lit() + delta)
      Object.assign(voiePlan, clampPlanVoie(voiePlan))
      sauvePlanVoie()
      val.textContent = String(lit())
      reglesDit('Plan enregistré — il prend effet à la prochaine descente.')
    }
    moins.addEventListener('click', () => applique(-1))
    plus.addEventListener('click', () => applique(1))
    p.append(titre, moins, val, plus)
    return p
  }
  lignes.appendChild(
    cran(
      'LONGUEUR',
      () => voiePlan.longueur,
      (v) => {
        voiePlan.longueur = v
      },
    ),
  )
  lignes.appendChild(
    cran(
      'DIFFICULTÉ MAX',
      () => voiePlan.diffMax,
      (v) => {
        voiePlan.diffMax = v
      },
    ),
  )
  // LE réglage qui change la nature d'une descente : proposer ou non des
  // salles fabriquées à chaque récompense. Tout le reste est commun.
  const pGen = document.createElement('div')
  pGen.className = 'rg-param'
  const labG = document.createElement('label')
  const cocheG = document.createElement('input')
  cocheG.type = 'checkbox'
  cocheG.id = 'regles-cycle-generees'
  cocheG.checked = voiePlan.generees
  cocheG.addEventListener('change', () => {
    voiePlan.generees = cocheG.checked
    sauvePlanVoie()
    reglesDit(
      cocheG.checked
        ? 'Salles générées ACTIVES — chaque récompense proposera des salles fabriquées.'
        : 'Salles générées coupées — la descente suit la séquence écrite.',
    )
  })
  const labGTxt = document.createElement('b')
  labGTxt.textContent = 'SALLES GÉNÉRÉES AUX RÉCOMPENSES'
  labG.append(cocheG, labGTxt)
  pGen.appendChild(labG)
  lignes.appendChild(pGen)
  // LES TABLEAUX ÉCRITS : coupés alors que les salles générées tiennent, la
  // descente devient TOUT PROCÉDURALE — trois cartes fabriquées à chaque
  // récompense, aucun tableau fait main. La façon de jouer une descente
  // inédite quand la bibliothèque est sue par cœur.
  const pEcr = document.createElement('div')
  pEcr.className = 'rg-param'
  const labE = document.createElement('label')
  const cocheE = document.createElement('input')
  cocheE.type = 'checkbox'
  cocheE.id = 'regles-cycle-ecrites'
  cocheE.checked = voiePlan.ecrites
  cocheE.addEventListener('change', () => {
    voiePlan.ecrites = cocheE.checked
    sauvePlanVoie()
    reglesDit(
      cocheE.checked
        ? 'Tableaux écrits ACTIFS — la pioche du pool en pose un face aux salles générées.'
        : voiePlan.generees
          ? 'Descente TOUT PROCÉDURALE — que des salles générées, aucun tableau écrit.'
          : 'Tableaux écrits coupés : rallumez les salles générées, sinon la descente n’a plus rien à proposer.',
    )
  })
  const labETxt = document.createElement('b')
  labETxt.textContent = 'TABLEAUX ÉCRITS AU CHOIX'
  labE.append(cocheE, labETxt)
  pEcr.appendChild(labE)
  lignes.appendChild(pEcr)
  const pJour = document.createElement('div')
  pJour.className = 'rg-param'
  const lab = document.createElement('label')
  const coche = document.createElement('input')
  coche.type = 'checkbox'
  coche.id = 'regles-cycle-jour'
  coche.checked = voiePlan.graineDuJour
  coche.addEventListener('change', () => {
    voiePlan.graineDuJour = coche.checked
    sauvePlanVoie()
    reglesDit('Plan enregistré — il prend effet à la prochaine descente.')
  })
  const labTxt = document.createElement('b')
  labTxt.textContent = 'DESCENTE DU JOUR'
  lab.append(coche, labTxt)
  pJour.appendChild(lab)
  lignes.appendChild(pJour)
  panneau.appendChild(lignes)
  corps.appendChild(panneau)
  btn.addEventListener('click', () => {
    reglesCycleOuvert = !reglesCycleOuvert
    panneau.hidden = !reglesCycleOuvert
  })
}

function renderRegles(): void {
  const corps = document.getElementById('regles-corps')
  if (!corps) return
  corps.innerHTML = ''
  // ---- Les PARAMÈTRES DU CYCLE : le plan de la voie, réglé ici ----
  monteCycleRegles(corps)
  // ---- VOS RÈGLES : les ajouts en texte libre, la partie vivante ----
  const tete = document.createElement('div')
  tete.className = 'rg-famille'
  tete.innerHTML = `VOS RÈGLES <small>en texte libre — à implémenter</small>`
  corps.appendChild(tete)
  for (const a of [...reglesAjouts].sort((x, y) =>
    x.date.localeCompare(y.date),
  )) {
    const carte = document.createElement('div')
    carte.className = 'rg-regle rg-libre'
    const oter = document.createElement('button')
    oter.type = 'button'
    oter.className = 'rg-oter'
    oter.textContent = '✕'
    oter.title = 'Retirer cette règle du cahier'
    oter.disabled = !reglesJoignable
    oter.addEventListener('click', () => void oteAjoutRegle(a.id))
    carte.appendChild(oter)
    const teteR = document.createElement('div')
    teteR.className = 'rg-tete'
    teteR.innerHTML = `<span class="rg-badge">RÈGLE À IMPLÉMENTER</span>`
    carte.appendChild(teteR)
    const ta = document.createElement('textarea')
    ta.className = 'rg-note'
    ta.value = a.texte
    ta.dataset.initial = a.texte
    ta.disabled = !reglesJoignable
    ta.addEventListener('blur', () => {
      const neuf = ta.value.trim()
      if (neuf === (ta.dataset.initial ?? '').trim()) return
      if (neuf) void posteAjoutRegle(neuf, a.id)
      else renderRegles() // vider n'efface pas : le ✕ est le geste d'effacement
    })
    carte.appendChild(ta)
    const s = document.createElement('small')
    s.className = 'rg-signe'
    s.textContent = signeRegle('consignée', a.auteur, a.date)
    carte.appendChild(s)
    corps.appendChild(carte)
  }
  const ajout = document.createElement('div')
  ajout.className = 'rg-ajout'
  const taNeuf = document.createElement('textarea')
  taNeuf.className = 'rg-note'
  taNeuf.id = 'regles-neuve'
  taNeuf.placeholder =
    'Écrivez une règle nouvelle pour le générateur — en français libre, comme elle vous vient. Exemple : « une salle sur trois doit se traverser sans jamais toucher une paroi ».'
  taNeuf.disabled = !reglesJoignable
  const consigner = document.createElement('button')
  consigner.type = 'button'
  consigner.className = 'rg-consigner'
  consigner.id = 'regles-consigner'
  consigner.textContent = 'CONSIGNER LA RÈGLE'
  consigner.disabled = !reglesJoignable
  consigner.addEventListener('click', () => {
    const texte = taNeuf.value.trim()
    if (!texte) {
      reglesDit('La règle est vide : écrivez-la d’abord.')
      return
    }
    // le champ n'est PAS vidé ici : seul le succès reconstruit l'écran —
    // un refus (occupé, hors ligne) laisse le texte sous les yeux
    void posteAjoutRegle(texte)
  })
  ajout.appendChild(taNeuf)
  ajout.appendChild(consigner)
  corps.appendChild(ajout)
  // ---- Le CATALOGUE : en place (annotable) et propositions ----
  for (const f of FAMILLES_REGLES) {
    const t = document.createElement('div')
    t.className = 'rg-famille'
    t.innerHTML = `${f.nom} <small>${f.propos}</small>`
    corps.appendChild(t)
    for (const r of reglesDeFamille(f.id)) {
      const carte = document.createElement('div')
      carte.className = `rg-regle ${r.etat === 'en-place' ? 'rg-place' : 'rg-propo'}`
      const teteR = document.createElement('div')
      teteR.className = 'rg-tete'
      const badge = r.etat === 'en-place' ? 'EN PLACE' : 'PROPOSITION'
      teteR.innerHTML = `<span class="rg-titre"></span><span class="rg-badge">${badge}</span>`
      teteR.querySelector('.rg-titre')!.textContent = r.titre
      carte.appendChild(teteR)
      const texte = document.createElement('p')
      texte.className = 'rg-texte'
      texte.textContent = r.texte
      carte.appendChild(texte)
      zoneNoteRegle(r.id, carte)
      corps.appendChild(carte)
    }
  }
}
document
  .getElementById('home-regles')
  ?.addEventListener('click', () => void ouvreRegles())
document.getElementById('regles-fermer')?.addEventListener('click', () => {
  reglesEl.hidden = true
})
reglesEl?.addEventListener('pointerdown', (e) => {
  if (e.target === reglesEl) reglesEl.hidden = true
})

// La fiche annonce la séquence jouée : bibliothèque partagée en tête
// (si elle en contient), puis l'expédition livrée à la suite.
const homeSeq = el('home-seq')
function updateLibraryButton(): void {
  const nb = libraryLevels.filter((l) => !estCodeHub(l.code)).length
  homeSeq.textContent =
    nb > 0
      ? `Séquence : ${nb} tableau(x) de la bibliothèque, puis l'expédition livrée — ${playedLevels().length} salles en tout.`
      : `Expédition livrée : ${TABLEAUX.length} tableaux. La bibliothèque partagée est vide.`
}
updateLibraryButton()

// Au démarrage : si la bibliothèque contient une séquence, elle passe en
// tête de l'expédition — mais jamais au milieu d'une partie en cours.
fetchLibrary().then((lib) => {
  if (!lib || lib.length === 0) return
  libraryLevels = lib.map((s) => s.level)
  updateLibraryButton()
  renderRegistres()
  renderSalles()
  if (!hasPlayed) {
    levelIndex = 0
    restart()
  }
})

// Sonde de débogage/test : le tableau en cours d'édition
;(window as unknown as { __editorLevel: () => LevelDef }).__editorLevel = () =>
  editor.currentLevel()
// L'éditeur possède son document : on le rouvre tel qu'on l'a laissé, sans
// écraser le travail en cours par le tableau qu'on vient d'essayer.
function openEditor(): void {
  overlay.classList.remove('visible')
  document.body.classList.remove('playing')
  // l'éditeur a la main : le jeu se met en PAUSE derrière lui — la physique
  // ne tourne plus dans son dos (« Essayer » relance, quitter rend la fiche)
  input.paused = true
  editor.open()
}
document
  .getElementById('start-editor')!
  .addEventListener('click', () => openEditor())
// ---- Le panneau COMMANDES : trois onglets (PC, manette, tactile) ----
// Les commandes ont quitté la fiche : un bouton, un panneau, trois écrans.
const cmdsEl = document.getElementById('cmds') as HTMLDivElement
function ongletCmds(nom: string): void {
  for (const b of Array.from(
    cmdsEl.querySelectorAll<HTMLButtonElement>('[data-onglet]'),
  )) {
    b.classList.toggle('on', b.dataset.onglet === nom)
  }
  for (const p of Array.from(
    cmdsEl.querySelectorAll<HTMLElement>('[data-page]'),
  )) {
    p.hidden = p.dataset.page !== nom
  }
}
document.getElementById('home-cmds')?.addEventListener('click', () => {
  // l'onglet d'accueil suit la façon de jouer : tactile au doigt, sinon PC
  ongletCmds(window.matchMedia('(pointer: coarse)').matches ? 'tactile' : 'pc')
  cmdsEl.hidden = false
})
for (const b of Array.from(
  cmdsEl.querySelectorAll<HTMLButtonElement>('[data-onglet]'),
)) {
  b.addEventListener('click', () => ongletCmds(b.dataset.onglet!))
}
document.getElementById('cmds-fermer')?.addEventListener('click', () => {
  cmdsEl.hidden = true
})
cmdsEl.addEventListener('pointerdown', (e) => {
  if (e.target === cmdsEl) cmdsEl.hidden = true // toucher le voile referme
})

// ---- Plein écran : PC comme mobile — masqué là où l'API manque (iOS) ----
const pleinBtn = document.getElementById(
  'home-plein',
) as HTMLButtonElement | null
if (pleinBtn) {
  if (!document.documentElement.requestFullscreen) {
    pleinBtn.hidden = true
  } else {
    pleinBtn.addEventListener('click', () => {
      if (document.fullscreenElement) void document.exitFullscreen()
      else void document.documentElement.requestFullscreen().catch(() => {})
    })
    document.addEventListener('fullscreenchange', () => {
      pleinBtn.innerHTML = document.fullscreenElement
        ? '<i>⛶</i><span>QUITTER</span>'
        : '<i>⛶</i><span>PLEIN ÉCRAN</span>'
    })
  }
}
window.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
  if (e.key === 'Escape') {
    if (lecteurCine.actif) return // le lecteur gère lui-même son Échap (sauter)
    if (!recsEl.hidden)
      fermerRecs() // les voiles d'abord
    else if (!cmdsEl.hidden) cmdsEl.hidden = true
    else if (!sallesEl.hidden) sallesEl.hidden = true
    else if (imagerie.visible) imagerie.close()
    else if (el('montage').classList.contains('visible')) montage.close()
    else if (document.body.classList.contains('playing')) openHome()
    else closeHome()
  } else if (e.key === 'Tab' && actionDeTouche('Tab') === 'dossier') {
    // le dossier passe par la table des commandes (input.onCommande) ; ici
    // on empêche seulement la tabulation de promener le focus
    e.preventDefault()
  }
  // légende, états, dossier, recadrage : voir la table des commandes
  // (game/commandes.ts) — ils arrivent par input.onCommande, redéfinis ou non
})

let sim = createSim(level)
// Sonde de débogage : accès à la simulation depuis la console du navigateur
const exposeSim = (): void => {
  ;(window as unknown as { __sim: FluidSim }).__sim = sim
}
exposeSim()
const camera = new Camera()
;(window as unknown as { __cam: Camera }).__cam = camera
;(window as unknown as { __params: SimParams }).__params = params
;(window as unknown as { __audio: AudioFx }).__audio = audio
// Sonde de test : injecter des zones dans le tableau courant sans l'éditeur
;(
  window as unknown as { __zones: (z: NonNullable<LevelDef['zones']>) => void }
).__zones = (z) => {
  level.zones = z
  buildWorldLabels()
}
// Sonde de test : régler la lumière générale du tableau courant en direct
;(window as unknown as { __ambiante: (v: number) => void }).__ambiante = (
  v,
) => {
  level.ambiante = Math.max(0, Math.min(1, v))
}

camera.snapTo(sim.stats.centroidX, sim.stats.centroidY, 1)

// Chargement des noyaux WASM, en arrière-plan : le jeu démarre sur le
// moteur JS et bascule dès que le module est prêt (sauf choix contraire au
// voile PARAMÈTRES). Échec de chargement = on reste en JS, sans bruit.
fetch('/noyaux.wasm')
  .then((r) =>
    r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status))),
  )
  .then((buf) => NoyauxWasm.charge(buf))
  .then((n) => {
    noyauxWasm = n
    appliqueMoteur(sim)
    majMoteurUI()
  })
  .catch(() => {
    noyauxWasm = null
    majMoteurUI()
  })

const renderer = new Renderer(canvas, CAPACITY)
const loop = new FixedLoop()
const input = new Input()
// Ouverture directe par ?editeur — APRÈS la naissance d'input : openEditor
// met le jeu en pause via input, l'appeler plus haut plantait tout le
// module au premier lancement (TDZ) et laissait une page à moitié câblée.
if (new URLSearchParams(location.search).has('editeur')) {
  hasPlayed = true
  openEditor()
}
// CRYOSTASE : tant que l'éveil n'a pas été joué, l'échantillon attend GELÉ
// dès le premier pixel — même en dérive derrière la fiche. Le premier
// contact visuel avec le sujet 21, c'est un bloc de glace.
if (!localStorage.getItem(CLE_EVEIL)) input.freezeIntent = true

// ---- Manette (Steam Deck, Xbox, DualSense) ----
// Elle pilote le même pointeur que le doigt : un curseur en orbite autour du
// corps, la gâchette pour agir. Le tactile garde toujours la priorité.
const manette = new Manette()
const manetteCurseur = { x: 0, y: 0 }
let manetteTenait = false // le « doigt » manette était posé à l'image d'avant

function boutonVisible(el: HTMLElement | null): el is HTMLElement {
  if (!el || (el as HTMLButtonElement).hidden) return false
  const r = el.getBoundingClientRect()
  const st = getComputedStyle(el)
  return (
    r.width > 0 &&
    r.height > 0 &&
    st.visibility !== 'hidden' &&
    st.pointerEvents !== 'none'
  )
}

/** A dans les écrans de JEU (relance, fin de tableau) : valide le bouton. */
function clicMenuManette(): boolean {
  for (const id of ['continuer', 'relance', 'overlay-btn']) {
    const el = document.getElementById(id)
    if (boutonVisible(el)) {
      el.click()
      return true
    }
  }
  return false
}

// ---- LA NAVIGATION MANETTE DES MENUS : générique, le même geste partout --
// Fini la liste de boutons codée en dur : l'écran ACTIF est le premier
// visible de la pile ci-dessous, et ses éléments actionnables (boutons,
// sélecteurs, cases) se parcourent à la croix ou au stick dans l'ORDRE
// VISUEL — la navigation est en 2D : on va au plus proche dans la
// direction pressée. A active, B REVIENT (chaque écran déclare sa porte
// de sortie), gauche/droite ajustent un sélecteur, et le focus — liseré
// bleu — reste toujours en vue (défilement suiveur).
interface CoucheMenu {
  id: string
  /** ce que B déclenche : l'id du bouton de fermeture de l'écran */
  retour?: string
  /** couche LÉGÈRE (légende, états, panneau d'instruments, ouverts en
   * pleine partie) : seul B est capté — le jeu garde tous ses boutons */
  legere?: boolean
  /** condition d'activation supplémentaire (défaut : le conteneur est visible) */
  actif?: () => boolean
}
const COUCHES_MENU: CoucheMenu[] = [
  { id: 'mb-veil' }, // la cérémonie : pas de porte de sortie — on choisit
  { id: 'codex', retour: 'codex-fermer' },
  { id: 'cmds', retour: 'cmds-fermer' },
  { id: 'planche', retour: 'planche-fermer' },
  { id: 'regles', retour: 'regles-fermer' },
  { id: 'cycle', retour: 'cycle-fermer' }, // les mémoires — ouvertes au banc du hub aussi
  { id: 'salles', retour: 'salles-fermer' },
  { id: 'records', retour: 'records-fermer' },
  { id: 'livraisons', retour: 'livraisons-fermer' },
  // l'écran des commandes se pose SUR les paramètres : il passe donc avant
  { id: 'touches', retour: 'touches-fermer' },
  { id: 'params', retour: 'params-fermer' },
  { id: 'legend', retour: 'legend-close', legere: true },
  { id: 'states', retour: 'states-close', legere: true },
  { id: 'instr-panel', retour: 'hud-instr-chip', legere: true },
  {
    id: 'home',
    retour: 'start', // B depuis la fiche : reprendre l'essai (s'il y en a un)
    actif: () => !document.body.classList.contains('playing'),
  },
]

function elementVisible(el: HTMLElement | null): el is HTMLElement {
  if (!el || el.hidden) return false
  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return false
  const st = getComputedStyle(el)
  return st.visibility !== 'hidden' && st.display !== 'none'
}

/** L'écran actuellement au-dessus, s'il y en a un. */
function coucheMenuActive(): CoucheMenu | null {
  for (const c of COUCHES_MENU) {
    const el = document.getElementById(c.id)
    if (!elementVisible(el)) continue
    if (c.actif && !c.actif()) continue
    return c
  }
  return null
}

/** Les éléments actionnables de l'écran, visibles et vivants. */
function actionnables(couche: HTMLElement): HTMLElement[] {
  const els = couche.querySelectorAll<HTMLElement>(
    'button, select, input[type="checkbox"], input[type="range"], [role="button"]',
  )
  return [...els].filter(
    (el) =>
      elementVisible(el) &&
      !(el as HTMLButtonElement).disabled &&
      getComputedStyle(el).pointerEvents !== 'none',
  )
}

// le focus par écran : l'élément visé survit à l'aller-retour d'un
// sous-menu ; s'il disparaît (liste reconstruite), on reprend au début
const focusParCouche = new Map<string, HTMLElement>()
let padNavPret = true // anti-répétition du stick
let padNavDepuis = 0 // début du maintien, pour la répétition auto

/** Un pas de navigation 2D : le plus proche dans la direction pressée. */
function plusProcheVers(
  depuis: HTMLElement,
  parmi: HTMLElement[],
  dx: number,
  dy: number,
): HTMLElement | null {
  const a = depuis.getBoundingClientRect()
  const ax = (a.left + a.right) / 2
  const ay = (a.top + a.bottom) / 2
  let mieux: HTMLElement | null = null
  let mieuxScore = Infinity
  for (const el of parmi) {
    if (el === depuis) continue
    const b = el.getBoundingClientRect()
    const bx = (b.left + b.right) / 2
    const by = (b.top + b.bottom) / 2
    const le = (bx - ax) * dx + (by - ay) * dy // l'avancée dans la direction
    if (le < 4) continue
    const travers = Math.abs((bx - ax) * dy) + Math.abs((by - ay) * dx)
    const score = le + travers * 2.2
    if (score < mieuxScore) {
      mieuxScore = score
      mieux = el
    }
  }
  return mieux
}

// ---- Le DÉFILEMENT au stick droit : le geste « pavé » du Steam Deck ----
// Dans n'importe quel écran de menu, le stick droit (ou le pavé configuré
// en joystick) fait défiler — comme la molette en mode bureau. On défile
// le conteneur du focus s'il en a un, sinon le plus grand défilable de
// l'écran (mémorisé tant qu'il reste valable).
const defilables = new Map<string, HTMLElement>()

function conteneurDefilant(
  couche: HTMLElement,
  depuis: HTMLElement | null,
): HTMLElement | null {
  const defile = (el: HTMLElement): boolean => {
    if (
      el.scrollHeight <= el.clientHeight + 4 &&
      el.scrollWidth <= el.clientWidth + 4
    )
      return false
    const st = getComputedStyle(el)
    return /(auto|scroll)/.test(st.overflowY + st.overflowX)
  }
  let el: HTMLElement | null = depuis
  while (el && el !== couche.parentElement) {
    if (defile(el)) return el
    el = el.parentElement
  }
  const connu = defilables.get(couche.id)
  if (connu && couche.contains(connu) && defile(connu)) return connu
  if (defile(couche)) {
    defilables.set(couche.id, couche)
    return couche
  }
  let mieux: HTMLElement | null = null
  let aire = 0
  for (const cand of couche.querySelectorAll<HTMLElement>(
    'div, section, aside',
  )) {
    if (!defile(cand)) continue
    const r = cand.getBoundingClientRect()
    if (r.width * r.height > aire) {
      aire = r.width * r.height
      mieux = cand
    }
  }
  if (mieux) defilables.set(couche.id, mieux)
  return mieux
}

function defileCouche(couche: CoucheMenu, dt: number): void {
  if (Math.abs(manette.panX) < 0.02 && Math.abs(manette.panY) < 0.02) return
  const host = document.getElementById(couche.id)
  if (!host) return
  const vise = focusParCouche.get(couche.id) ?? null
  const sc = conteneurDefilant(host, vise && host.contains(vise) ? vise : null)
  if (!sc) return
  sc.scrollTop += manette.panY * 1100 * dt
  sc.scrollLeft += manette.panX * 1100 * dt
}

/** La navigation d'un écran de menu, une image. */
function navigueMenu(couche: CoucheMenu, dt: number): void {
  const host = document.getElementById(couche.id)!
  // le stick droit défile — dans tous les écrans, légers compris
  defileCouche(couche, dt)
  // B : la porte de sortie de l'écran
  if (manette.edge(BOUTON.B) && couche.retour) {
    const porte = document.getElementById(couche.retour)
    if (boutonVisible(porte)) {
      porte.click()
      return
    }
  }
  if (couche.legere) return // légende & co : B seulement, le jeu garde la main
  // ☰ (Start) depuis la fiche : reprendre l'essai directement
  if (couche.id === 'home' && manette.edge(BOUTON.START)) {
    document.getElementById('start')?.click()
    return
  }
  // le codex garde ses fermetures historiques (START et SELECT)
  if (
    couche.id === 'codex' &&
    (manette.edge(BOUTON.START) || manette.edge(BOUTON.SELECT))
  ) {
    document.getElementById('codex-fermer')?.click()
    return
  }
  const els = actionnables(host)
  // la cérémonie en phase contemplative (bilan) : aucun bouton — A avance
  if (els.length === 0) {
    if (manette.edge(BOUTON.A))
      host.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    return
  }
  let vise = focusParCouche.get(couche.id) ?? null
  if (!vise || !els.includes(vise)) vise = els[0]
  // la direction pressée : croix, ou stick avec un cran anti-répétition
  // (puis répétition douce au maintien — les longues listes se parcourent)
  let dx = 0
  let dy = 0
  if (manette.edge(BOUTON.HAUT)) dy = -1
  else if (manette.edge(BOUTON.BAS)) dy = 1
  else if (manette.edge(BOUTON.GAUCHE)) dx = -1
  else if (manette.edge(BOUTON.DROITE)) dx = 1
  else if (manette.force > 0.55) {
    const now = performance.now() / 1000
    if (padNavPret || now - padNavDepuis > 0.34) {
      if (Math.abs(manette.dirY) > Math.abs(manette.dirX))
        dy = manette.dirY > 0 ? 1 : -1
      else dx = manette.dirX > 0 ? 1 : -1
      if (padNavPret) padNavDepuis = now
      else padNavDepuis = now - 0.22 // la répétition suivante vient plus vite
      padNavPret = false
    }
  }
  if (manette.force < 0.3) padNavPret = true
  // un SÉLECTEUR visé : gauche/droite changent sa valeur, pas le focus
  if (dx !== 0 && vise instanceof HTMLSelectElement) {
    const n = vise.options.length
    if (n > 0) {
      vise.selectedIndex = Math.max(0, Math.min(n - 1, vise.selectedIndex + dx))
      vise.dispatchEvent(new Event('change', { bubbles: true }))
    }
    dx = 0
  }
  if (dx !== 0 || dy !== 0) {
    const prochain = plusProcheVers(vise, els, dx, dy)
    if (prochain) vise = prochain
  }
  focusParCouche.set(couche.id, vise)
  // le liseré s'affiche si la MANETTE a la main (a parlé plus récemment
  // que le pointeur) — pas de fenêtre de temps : sur un menu au rendu
  // plafonné, une horloge expirerait entre deux images. UN SEUL liseré à
  // l'écran : celui de la couche active — l'écran de dessous rend le sien
  // (il le retrouvera par la mémoire de focus en revenant).
  const padALaMain = manette.lastActivity > input.lastPointerAt
  for (const el of document.querySelectorAll<HTMLElement>('.pad-focus'))
    if (el !== vise) el.classList.remove('pad-focus')
  vise.classList.toggle('pad-focus', padALaMain)
  if (dx !== 0 || dy !== 0)
    vise.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  if (manette.edge(BOUTON.A)) vise.click()
}
// sonde du banc d'essai : l'état de la navigation manette, lisible du dehors
let manettePolls = 0
let manettePollNow = 0
;(window as unknown as { __menu: unknown }).__menu = {
  couche: () => coucheMenuActive()?.id ?? null,
  pad: () => ({
    connectee: manette.connectee,
    active: manette.active,
    polls: manettePolls,
    now: manettePollNow,
    vie: manette.lastActivity,
  }),
  actionnables: (id: string) => {
    const el = document.getElementById(id)
    return el ? actionnables(el).length : -1
  },
}
input.attach(canvas)

const monitor: BenchMonitor = {
  fps: 0,
  particles: 0,
  volume: 0,
  speed: 0,
  quality: 0,
  physMs: 0,
  renderMs: 0,
  overview: false,
}

// Vortex de regroupement : déclenché au clic droit, actif vortexDuration s
const vortex = { x: 0, y: 0, timer: 0 }

// Le pointeur est-il posé SUR le corps ? (à un rayon de noyau et des
// poussières près : la surface visible dépasse un peu les centres de
// particules). Sert à retourner l'impulsion : sur soi, on se rassemble.
function corpsSousLePointeur(x: number, y: number): boolean {
  const r = params.kernelRadius * 1.6
  const r2 = r * r
  for (let i = 0; i < sim.count; i++) {
    if (sim.kind[i] !== KIND_PLAYER || sim.gaseous[i] === 1) continue
    const dx = sim.posX[i] - x
    const dy = sim.posY[i] - y
    if (dx * dx + dy * dy < r2) return true
  }
  return false
}

// Ondes d'éjection (rendu seulement) : une onde traverse le corps à chaque
// salve d'éjection, depuis le point de sortie de la matière
const MAX_WAVES = 8
const WAVE_EVERY = 0.16 // s d'éjection continue entre deux ondes
const waves: { x: number; y: number; t: number }[] = []
const waveScratch = new Float32Array(MAX_WAVES * 4)
let waveCarry = WAVE_EVERY // première salve : onde immédiate

// Fin de course (refonte 2026) : il n'y a plus de minimum à ramener, ni de
// mort. Sous le seuil, le corps a droit à UNE dernière impulsion ; elle
// relâchée, il se fige en glace avec l'élan qu'il lui reste et dérive — rien
// ne le freine. Un rebond peut encore le mener au sas ; sinon le joueur
// relance quand il le décide, avec un bouton qui ne masque pas la dérive.
const endgame = {
  lastCall: false, // la prochaine impulsion est la dernière
  spent: false, // elle a été donnée : le corps se fige et dérive
  wasAiming: false, // front de relâchement du pointeur
  sasVu: 0, // particules avalées déjà constatées (détection « le sas boit »)
  sasBoitJusqua: -1, // temps simulé jusqu'auquel la fin de course se tait
  enCollecte: false, // le sas boit en ce moment : alarmes et seuils se taisent
}
// Dash de vapeur : viser fige le temps, relâcher lance le nuage (« air
// dash »). On ne retient qu'une chose entre deux images : était-on en visée.
const dash = { aiming: false }
// Front montant de l'intention vapeur : la TRANSFORMATION (péage + dashs)
// se paie au basculement, quelle qu'en soit la cause.
let gasIntentAvant = false

// ---- Mécanismes laser (palier 1) ----
// Le faisceau se trace une fois par IMAGE (pas par pas physique) : la glace
// bouge à l'échelle de l'image, pas du sous-pas. Une cible reste « allumée »
// un court instant après le dernier photon (persistance) : la porte ne
// clignote pas quand le miroir tremble.
const fxCanvas = document.getElementById('fx-canvas') as HTMLCanvasElement
const fxCtx = fxCanvas.getContext('2d')!
const laserEtat = {
  vues: [] as TraceResultat[],
  // La mémoire des récepteurs (TOR : verrou ouvrant · NOR : maintien, la
  // première coupure scelle) — machine à états pure, voir laser.ts
  recepteurs: creerEtatRecepteurs(0),
  portesOuvertes: [] as boolean[],
  doorsKey: '', // signature des portes fermées envoyées au solveur
  // LE SURSAUT DE VICTOIRE : à l'allumage d'une pastille, la trajectoire
  // du rayon vainqueur est GELÉE un court instant et rejouée en flash —
  // même si la physique l'a déjà emporté ailleurs. Un balayage éclair sur
  // la cible ne passe plus inaperçu.
  impacts: [] as {
    t0: number
    cible: number
    points: { x: number; y: number; eau?: boolean; plasma?: boolean }[]
  }[],
  litPrec: [] as boolean[],
  // ——— LES DEUX INSTANTS DU PLASMA ————————————————————————————————————
  // Ils étaient jusqu'ici invisibles : le rayon changeait de couleur, le
  // rail s'allumait, et c'était tout. Or ce sont les deux gestes que
  // l'énigme demande — se vaporiser DANS la lumière, puis amener l'arc au
  // pied du tube. Ce qu'on demande au joueur doit se voir quand il le
  // réussit. Chaque événement GÈLE sa géométrie : le rayon vivant est
  // reparti ailleurs bien avant la fin du flash.
  //
  // L'IONISATION : le faisceau vient d'entrer dans la vapeur du corps.
  ionisations: [] as {
    t0: number
    entree: { x: number; y: number }
    points: { x: number; y: number }[]
  }[],
  // LA CAPTURE : l'arc ionisé vient d'être happé par un rail — le champ
  // s'engage, et si c'est un conduit, le tube s'ouvre. `cumul` : les deux
  // instants sont tombés dans la MÊME image (le joueur s'est vaporisé pile
  // au pied du tube) — un seul temps fort, plus large, remplace les deux.
  captures: [] as {
    t0: number
    prise: { x: number; y: number }
    ligne: { x: number; y: number }[]
    cumul: boolean
  }[],
  // l'arête d'ionisation se lit par émetteur : un rayon qui RESTE dans la
  // vapeur ne doit pas rallumer l'effet soixante fois par seconde
  ionisePrec: [] as boolean[],
}
// Sonde de test : l'état des portes/récepteurs depuis la console (comme __sim)
;(window as unknown as { __laserEtat: typeof laserEtat }).__laserEtat =
  laserEtat
// ---- LE DÉCOR AFFICHÉ : le décor POSÉ, plus les décalques que le méta
// synthétise (l'alcôve d'un plot, le pupitre du banc, la masse du Sujet 12).
// Le résultat se mémorise par tableau : la liste ne bouge pas d'une image à
// l'autre, et il serait absurde de la reconstruire soixante fois par seconde.
let decorMemoTableau: LevelDef | null = null
let decorMemoListe: DecalDef[] = []
function decorAffiche(): DecalDef[] {
  if (decorMemoTableau !== level) {
    decorMemoTableau = level
    const meta = decalsDuMeta(level)
    decorMemoListe =
      meta.length > 0
        ? [...(level.decals ?? []), ...meta]
        : (level.decals ?? [])
  }
  return decorMemoListe
}
// Sonde d'atelier : le décor réellement envoyé au rendu, méta compris
;(window as unknown as { __decor: () => DecalDef[] }).__decor = decorAffiche
// Sonde d'atelier : les images 2D effectivement chargées (méta compris)
;(window as unknown as { __sprites: () => string[] }).__sprites = spritesCharges

// ---- LES DEUX PIÈCES 2D DU MÉTA : elles se dessinent PAR-DESSUS le fluide
// (un éclat noyé qu'on ne verrait plus serait une information perdue), donc
// ici et pas en décalque. Chacune prend son image si elle est livrée, et
// retombe sur le tracé vectoriel sinon — le jeu ne dépend jamais d'un fichier.

/** L'icône d'un article : la case de la planche du méta, ou l'emoji du
 *  catalogue tant que la planche n'est pas déposée. Le centre est donné ;
 *  l'appelant a posé textAlign/textBaseline au centre. */
function dessineIconeArticle(
  g: CanvasRenderingContext2D,
  article: string,
  emoji: string,
  cx: number,
  cy: number,
  taille: number,
): void {
  const planche = sprite(ICONES_URL)
  const c = caseIcone(article)
  if (planche && c !== null) {
    const cw = planche.naturalWidth / ICONES_COLONNES
    const ch = planche.naturalHeight / ICONES_RANGEES
    const col = c % ICONES_COLONNES
    const rang = Math.floor(c / ICONES_COLONNES)
    g.drawImage(
      planche,
      col * cw,
      rang * ch,
      cw,
      ch,
      cx - taille / 2,
      cy - taille / 2,
      taille,
      taille,
    )
    return
  }
  g.font = `${taille}px system-ui`
  g.fillText(emoji, cx, cy)
}

/** L'éclat de mémoire. Trois cas : une BANDE de vues déjà tournées (le moteur
 *  y puise la vue du moment), une vignette carrée (il la fait pivoter), ou
 *  rien de livré — et le losange se trace au vecteur, comme aujourd'hui. */
function dessineEclat(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  phase: number,
): void {
  const img = sprite(ECLAT_URL)
  if (img) {
    // la vignette garde SA forme : le cristal livré est haut et étroit, le
    // forcer dans un carré l'écraserait
    const vues = vuesEclat(img.naturalWidth, img.naturalHeight)
    const source = img.naturalWidth / vues
    const hauteur = r * 3.2
    const largeur = hauteur * (source / img.naturalHeight)
    if (vues > 1) {
      const tour = (((phase / (Math.PI * 2)) % 1) + 1) % 1
      const k = Math.min(vues - 1, Math.floor(tour * vues))
      g.drawImage(
        img,
        k * source,
        0,
        source,
        img.naturalHeight,
        cx - largeur / 2,
        cy - hauteur / 2,
        largeur,
        hauteur,
      )
    } else {
      g.save()
      g.translate(cx, cy)
      g.rotate(phase)
      g.drawImage(img, -largeur / 2, -hauteur / 2, largeur, hauteur)
      g.restore()
    }
    return
  }
  g.save()
  g.translate(cx, cy)
  g.rotate(phase)
  g.beginPath()
  g.moveTo(0, -r * 1.15)
  g.lineTo(r * 0.72, 0)
  g.lineTo(0, r * 1.15)
  g.lineTo(-r * 0.72, 0)
  g.closePath()
  g.fillStyle = 'rgba(140,255,205,0.5)'
  g.fill()
  g.lineWidth = 1.5
  g.strokeStyle = '#8effcd'
  g.stroke()
  g.beginPath()
  g.arc(0, -r * 0.25, r * 0.22, 0, Math.PI * 2)
  g.fillStyle = 'rgba(235,255,245,0.9)'
  g.fill()
  g.restore()
}

// La superposition des mécanismes : faisceaux, émetteurs, cibles, portes —
// dessinée en 2D par-dessus la cuve, avec la même caméra que le rendu WebGL.
function drawMecanismes(vw: number, vh: number, dpr: number): void {
  const lasers = level.lasers ?? []
  const cibles = level.cibles ?? []
  const portes = level.portes ?? []
  const rails = level.rails ?? []
  const caches = level.caches ?? []
  const actif =
    lasers.length +
      cibles.length +
      portes.length +
      rails.length +
      caches.length +
      pastilles.length +
      eclatsEssai.length +
      (level.plots?.length ?? 0) +
      (level.bancMemoires ? 1 : 0) +
      (level.marchand ? 1 : 0) +
      (fiolePastille ? 1 : 0) >
    0
  const dprC = Math.min(dpr, 2)
  if (
    fxCanvas.width !== Math.round(vw * dprC) ||
    fxCanvas.height !== Math.round(vh * dprC)
  ) {
    fxCanvas.width = Math.round(vw * dprC)
    fxCanvas.height = Math.round(vh * dprC)
  }
  const g = fxCtx
  g.setTransform(dprC, 0, 0, dprC, 0, 0)
  g.clearRect(0, 0, vw, vh)
  if (!actif || !document.body.classList.contains('playing')) return
  const S = (x: number, y: number): { sx: number; sy: number } => ({
    sx: vw * 0.5 + (x - camera.x) * camera.zoom,
    sy: vh * 0.5 - (y - camera.y) * camera.zoom,
  })
  const z = camera.zoom

  // portes : barrières d'énergie — pleines quand closes, un cadre quand ouvertes
  for (let i = 0; i < portes.length; i++) {
    const p = portes[i]
    // sous un voile de cachette : la porte se tait (elle flotterait
    // au-dessus d'une paroi factice et vendrait le secret)
    if (dansCacheVoilee((p.minX + p.maxX) / 2, (p.minY + p.maxY) / 2)) continue
    const a = S(p.minX, p.maxY)
    const b = S(p.maxX, p.minY)
    const ouverte = laserEtat.portesOuvertes[i]
    if (ouverte) {
      g.strokeStyle = 'rgba(90,220,170,0.45)'
      g.setLineDash([5, 7])
      g.lineWidth = 1.5
      g.strokeRect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy)
      g.setLineDash([])
    } else {
      const puls = 0.75 + 0.25 * Math.sin(elapsed * 3.1 + i)
      g.fillStyle = `rgba(255,72,72,${(0.16 * puls).toFixed(3)})`
      g.fillRect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy)
      g.strokeStyle = `rgba(255,96,96,${(0.85 * puls).toFixed(3)})`
      g.lineWidth = 2
      g.strokeRect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy)
      // barreaux d'énergie
      g.strokeStyle = `rgba(255,110,110,${(0.35 * puls).toFixed(3)})`
      g.lineWidth = 1
      g.beginPath()
      const pas = Math.max(10, 16 * z)
      if (b.sx - a.sx > b.sy - a.sy) {
        for (let x = a.sx + pas; x < b.sx; x += pas) {
          g.moveTo(x, a.sy)
          g.lineTo(x, b.sy)
        }
      } else {
        for (let y = a.sy + pas; y < b.sy; y += pas) {
          g.moveTo(a.sx, y)
          g.lineTo(b.sx, y)
        }
      }
      g.stroke()
    }
  }

  // rails magnétiques : des lignes de champ posées dans le décor — bande de
  // capture translucide (l'arc s'accroche N'IMPORTE OÙ le long), pointillé
  // violet, et des CHEVRONS qui donnent le sens de circulation de l'arc.
  // Le faisceau ordinaire les ignore ; seul le plasma s'y accroche.
  rails.forEach((rail, railIdx) => {
    const pts = rail.points
    if (pts.length < 2) return
    // un rail entièrement sous voile se tait ; un rail qui en sort reste
    // dessiné (le voile brume le couvre, et couper une polyligne la fausse)
    if (pts.every((p) => dansCacheVoilee(p.x, p.y))) return
    const engage = railsEngages.has(railIdx)
    const chemin = (): void => {
      g.beginPath()
      const p0 = S(pts[0].x, pts[0].y)
      g.moveTo(p0.sx, p0.sy)
      for (let k = 1; k < pts.length; k++) {
        const pk = S(pts[k].x, pts[k].y)
        g.lineTo(pk.sx, pk.sy)
      }
    }
    // la bande de capture : la portée du champ, tout du long
    // LA BANDE DESSINÉE DOIT ÊTRE LE TUBE RÉEL. Un conduit fait collision sur
    // `plasmaRailRadius × 2,5` (la bande de convoyage) alors que la bande de
    // CAPTURE du faisceau ne fait qu'un rayon : dessiner la seconde pour un
    // conduit ferait buter le corps 45 unités avant tout ce qui se voit.
    const rayonDessine = rail.conduit === true
      ? params.plasmaRailRadius * 2.5
      : params.plasmaRailRadius
    g.strokeStyle = rail.conduit === true
      ? 'rgba(150,120,255,0.14)' // un conduit est une PAROI : il se voit plus
      : 'rgba(150,120,255,0.07)'
    g.lineWidth = Math.max(2, rayonDessine * 2 * z)
    g.lineJoin = 'round'
    g.lineCap = 'round'
    chemin()
    g.stroke()
    // la ligne elle-même — et quand le champ est ENGAGÉ (il porte un nuage,
    // même rayon éteint), le rail s'embrase : halo + tirets qui défilent
    // dans le sens du convoyage. Il s'éteint quand l'attirance se relâche.
    if (engage) {
      g.strokeStyle = 'rgba(190,160,255,0.30)'
      g.lineWidth = Math.max(3, 10 * z)
      chemin()
      g.stroke()
    }
    g.strokeStyle = engage ? 'rgba(215,190,255,0.95)' : 'rgba(150,120,255,0.45)'
    g.lineWidth = Math.max(1, (engage ? 3 : 2) * z)
    g.setLineDash([2 * z, 9 * z])
    if (engage) g.lineDashOffset = -((performance.now() * 0.05) % 11) * z
    chemin()
    g.stroke()
    g.setLineDash([])
    g.lineDashOffset = 0
    // chevrons de sens, à intervalle régulier le long de chaque tronçon
    g.strokeStyle = 'rgba(190,160,255,0.7)'
    g.lineWidth = Math.max(1, 1.6 * z)
    const taille = Math.max(3, 7 * z)
    for (let k = 0; k + 1 < pts.length; k++) {
      const a = pts[k]
      const b = pts[k + 1]
      const len = Math.hypot(b.x - a.x, b.y - a.y)
      if (len < 1) continue
      const ux = (b.x - a.x) / len
      const uy = (b.y - a.y) / len
      const n = Math.max(1, Math.floor(len / 70))
      for (let m = 1; m <= n; m++) {
        const t = m / (n + 1)
        const p = S(a.x + ux * len * t, a.y + uy * len * t)
        // direction en coordonnées écran (y inversé)
        const ex = ux
        const ey = -uy
        g.beginPath()
        g.moveTo(
          p.sx - (ex + ey * 0.6) * taille,
          p.sy - (ey - ex * 0.6) * taille,
        )
        g.lineTo(p.sx, p.sy)
        g.lineTo(
          p.sx - (ex - ey * 0.6) * taille,
          p.sy - (ey + ex * 0.6) * taille,
        )
        g.stroke()
      }
    }
  })

  // MINI-ARCS ÉLECTRIQUES (mode foudroyant) : un éclair en zigzag qui
  // serpente le long d'un segment — ancré aux deux bouts, offsets
  // perpendiculaires pseudo-aléatoires re-tirés plusieurs fois par
  // seconde (le crépitement), amplitude en ventre au milieu du chemin.
  // Partagé entre le rayon vivant et le sursaut de victoire.
  const bruitArc = (graine: number, i: number): number => {
    const v = Math.sin(graine * 127.1 + i * 311.7) * 43758.5453
    return (v - Math.floor(v)) * 2 - 1
  }
  const traceArcFx = (
    a: { sx: number; sy: number },
    b: { sx: number; sy: number },
    graine: number,
    amp: number,
    coul: string,
    larg: number,
  ): void => {
    const dx = b.sx - a.sx
    const dy = b.sy - a.sy
    const L = Math.hypot(dx, dy)
    if (L < 14) return
    const n = Math.min(26, Math.max(4, Math.round(L / (22 * Math.max(0.4, z)))))
    const px = -dy / L
    const py = dx / L
    g.strokeStyle = coul
    g.lineWidth = larg
    g.lineJoin = 'round'
    g.beginPath()
    g.moveTo(a.sx, a.sy)
    for (let i = 1; i < n; i++) {
      const tI = i / n
      const ventre = Math.sin(Math.PI * tI)
      const off = bruitArc(graine, i) * amp * ventre
      g.lineTo(a.sx + dx * tI + px * off, a.sy + dy * tI + py * off)
    }
    g.lineTo(b.sx, b.sy)
    g.stroke()
  }

  // faisceaux : halo large + cœur fin, en fusion additive
  g.globalCompositeOperation = 'lighter'
  for (const t of laserEtat.vues) {
    if (t.points.length < 2) continue
    const chemins = t.points.map((pt) => S(pt.x, pt.y))
    const scint = 0.85 + 0.15 * Math.sin(elapsed * 21)
    // dans l'air : trait rouge net. Sous l'eau : le halo s'élargit et
    // rosit — la lumière diffuse dans le corps qu'elle traverse. Ionisé
    // (vapeur, rail) : un ARC blanc-violet, éblouissant.
    const AIR: [number, string][] = [
      [10 * z, `rgba(255,60,50,${(0.1 * scint).toFixed(3)})`],
      [4.5 * z, `rgba(255,90,70,${(0.3 * scint).toFixed(3)})`],
      [1.8 * z, `rgba(255,220,200,${(0.95 * scint).toFixed(3)})`],
    ]
    const EAU: [number, string][] = [
      [15 * z, `rgba(255,70,110,${(0.13 * scint).toFixed(3)})`],
      [6.5 * z, `rgba(255,120,150,${(0.32 * scint).toFixed(3)})`],
      [1.8 * z, `rgba(255,235,225,${(0.88 * scint).toFixed(3)})`],
    ]
    const scintP = 0.7 + 0.3 * Math.sin(elapsed * 37) // l'arc crépite plus vite
    const PLASMA: [number, string][] = [
      [18 * z, `rgba(150,90,255,${(0.16 * scintP).toFixed(3)})`],
      [7.5 * z, `rgba(190,150,255,${(0.42 * scintP).toFixed(3)})`],
      [2.4 * z, `rgba(250,245,255,${(0.98 * scintP).toFixed(3)})`],
    ]
    const palettes = [AIR, EAU, PLASMA]
    const modeDe = (pt: (typeof t.points)[number]): number =>
      pt.plasma === true ? 2 : pt.eau === true ? 1 : 0
    // tronçons homogènes (air / eau / plasma) tracés d'un trait chacun
    // Mode SOMPTUEUX : un FLUX de paquets lumineux remonte chaque tronçon
    // (tirets animés le long du chemin) — l'énergie VOYAGE au lieu de
    // poser un simple trait. Le classique garde ses trois passes, au
    // pixel près.
    const FLUX: string[] = [
      'rgba(255,240,230,0.55)',
      'rgba(255,245,240,0.5)',
      'rgba(255,255,255,0.6)',
    ]
    let k = 0
    while (k + 1 < chemins.length) {
      const mode = modeDe(t.points[k])
      let e = k + 1
      while (e + 1 < chemins.length && modeDe(t.points[e]) === mode) e++
      // en FOUDROYANT, l'aura respire : une seconde nappe encore plus
      // large dont l'intensité pulse lentement — le rayon irradie
      const pulseAura = 0.75 + 0.25 * Math.sin(elapsed * 3.1)
      const passes: [number, string][] =
        faisceauChoix >= 1
          ? [
              ...(faisceauChoix === 2
                ? ([
                    [
                      40 * z,
                      mode === 2
                        ? `rgba(150,90,255,${(0.05 * pulseAura).toFixed(3)})`
                        : `rgba(255,60,45,${(0.055 * pulseAura).toFixed(3)})`,
                    ],
                  ] as [number, string][])
                : []),
              // l'AMBIANCE : une nappe très large et très douce — le rayon
              // baigne la salle au lieu de la rayer
              [
                26 * z,
                mode === 2
                  ? `rgba(140,80,255,${(0.06 * scintP).toFixed(3)})`
                  : `rgba(255,50,40,${(0.07 * scint).toFixed(3)})`,
              ],
              ...palettes[mode].map(
                ([l, c]) =>
                  [l * (faisceauChoix === 2 ? 1.5 : 1.35), c] as [
                    number,
                    string,
                  ],
              ),
            ]
          : palettes[mode]
      for (const [larg, coul] of passes) {
        g.strokeStyle = coul
        g.lineWidth = Math.max(0.8, larg)
        g.lineJoin = 'round'
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(chemins[k].sx, chemins[k].sy)
        for (let m = k + 1; m <= e; m++) g.lineTo(chemins[m].sx, chemins[m].sy)
        g.stroke()
      }
      if (faisceauChoix >= 1) {
        const pas = 46 * z
        g.strokeStyle = FLUX[mode]
        g.lineWidth = Math.max(1.1, 3.2 * z)
        g.setLineDash([12 * z, pas - 12 * z])
        g.lineDashOffset = -((elapsed * 300 * z) % pas)
        g.beginPath()
        g.moveTo(chemins[k].sx, chemins[k].sy)
        for (let m = k + 1; m <= e; m++) g.lineTo(chemins[m].sx, chemins[m].sy)
        g.stroke()
        g.setLineDash([])
        g.lineDashOffset = 0
      }
      if (faisceauChoix === 2) {
        // deux éclairs par SEGMENT (un rayon plié garde ses coudes),
        // re-tirés ~24 fois par seconde : le CRÉPITEMENT
        const grainT = Math.floor(elapsed * 24)
        for (let m = k; m < e; m++) {
          traceArcFx(
            chemins[m],
            chemins[m + 1],
            grainT * 7.31 + m * 13.7,
            8 * z,
            mode === 2 ? 'rgba(210,180,255,0.6)' : 'rgba(150,215,255,0.55)',
            Math.max(0.8, 1.3 * z),
          )
          traceArcFx(
            chemins[m],
            chemins[m + 1],
            grainT * 11.73 + m * 5.1 + 99,
            4.5 * z,
            'rgba(255,255,255,0.4)',
            Math.max(0.7, 1.0 * z),
          )
        }
      }
      k = e
    }
    if (faisceauChoix >= 1) {
      // les EXTRÉMITÉS luisent : la bouche de l'émetteur, et le point
      // d'arrivée du rayon — l'absorption se VOIT, elle crépite doucement
      const bouts = [chemins[0], chemins[chemins.length - 1]]
      for (let b = 0; b < 2; b++) {
        const pt = bouts[b]
        const r =
          (b === 0 ? 10 : 16) * z * (0.85 + 0.15 * Math.sin(elapsed * 23 + b))
        const gr = g.createRadialGradient(
          pt.sx,
          pt.sy,
          0,
          pt.sx,
          pt.sy,
          Math.max(2, r),
        )
        gr.addColorStop(0, 'rgba(255,235,225,0.85)')
        gr.addColorStop(0.4, 'rgba(255,120,90,0.4)')
        gr.addColorStop(1, 'rgba(255,80,60,0)')
        g.fillStyle = gr
        g.beginPath()
        g.arc(pt.sx, pt.sy, Math.max(2, r), 0, Math.PI * 2)
        g.fill()
      }
    }
  }

  // LE SURSAUT DE VICTOIRE : les trajectoires gelées à l'allumage d'une
  // pastille rejouent en flash blanc-vert pendant ~un demi-souffle — le
  // rayon SURSAUTE, la cible irradie, des étincelles jaillissent. Même si
  // le rayon vivant est déjà parti ailleurs : la victoire reste lisible.
  if (faisceauChoix >= 1 && laserEtat.impacts.length > 0) {
    const nowFx = performance.now() / 1000
    // en FOUDROYANT, le sursaut dure un souffle de plus et frappe plus fort
    const DUR = faisceauChoix === 2 ? 0.7 : 0.55
    const boost = faisceauChoix === 2 ? 1.6 : 1
    laserEtat.impacts = laserEtat.impacts.filter((im) => nowFx - im.t0 < DUR)
    for (const im of laserEtat.impacts) {
      const age = nowFx - im.t0
      const kAge = age / DUR
      const flash = Math.exp(-age / 0.12) // le sursaut : violent puis calmé
      const alpha = 1 - kAge
      const chemins = im.points.map((pt) => S(pt.x, pt.y))
      const PASSES: [number, string][] = [
        [
          16 * z * (1 + 1.6 * flash * boost),
          `rgba(120,255,190,${(0.16 * alpha).toFixed(3)})`,
        ],
        [
          6 * z * (1 + 2.2 * flash * boost),
          `rgba(180,255,220,${(0.4 * alpha).toFixed(3)})`,
        ],
        [
          2.2 * z * (1 + 2.6 * flash * boost),
          `rgba(255,255,250,${(0.95 * alpha).toFixed(3)})`,
        ],
      ]
      for (const [larg, coul] of PASSES) {
        g.strokeStyle = coul
        g.lineWidth = Math.max(0.8, larg)
        g.lineJoin = 'round'
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(chemins[0].sx, chemins[0].sy)
        for (let m = 1; m < chemins.length; m++)
          g.lineTo(chemins[m].sx, chemins[m].sy)
        g.stroke()
      }
      if (faisceauChoix === 2) {
        // la FOUDRE de la victoire : des éclairs verts serpentent le long
        // de la trajectoire gelée tant que le flash vit
        const grainV = Math.floor(nowFx * 30)
        for (let m = 0; m + 1 < chemins.length; m++) {
          traceArcFx(
            chemins[m],
            chemins[m + 1],
            grainV * 9.17 + m * 3.3,
            12 * z * (0.4 + 0.6 * flash),
            `rgba(190,255,225,${(0.7 * alpha).toFixed(3)})`,
            Math.max(0.9, 1.5 * z),
          )
          traceArcFx(
            chemins[m],
            chemins[m + 1],
            grainV * 5.53 + m * 17.9 + 41,
            7 * z * (0.4 + 0.6 * flash),
            `rgba(255,255,255,${(0.5 * alpha).toFixed(3)})`,
            Math.max(0.8, 1.1 * z),
          )
        }
      }
      // la cible irradie : anneau qui s'évase depuis la pastille touchée
      const cib = cibles[im.cible]
      if (cib) {
        const pc = S(cib.x, cib.y)
        const rBase = Math.max(4, cib.r * z)
        g.strokeStyle = `rgba(150,255,200,${(0.8 * alpha).toFixed(3)})`
        g.lineWidth = Math.max(1, 3 * z * (1 - kAge * 0.6))
        g.beginPath()
        g.arc(pc.sx, pc.sy, rBase * (1 + (2.6 + boost) * kAge), 0, Math.PI * 2)
        g.stroke()
        if (faisceauChoix === 2 && kAge > 0.18) {
          // le second anneau part avec un temps de retard — l'onde double
          const k2 = (kAge - 0.18) / (1 - 0.18)
          g.strokeStyle = `rgba(210,255,235,${(0.55 * (1 - k2)).toFixed(3)})`
          g.lineWidth = Math.max(1, 2 * z * (1 - k2 * 0.5))
          g.beginPath()
          g.arc(pc.sx, pc.sy, rBase * (1 + 3.4 * k2), 0, Math.PI * 2)
          g.stroke()
        }
        // les étincelles : huit éclats déterministes qui fusent de l'impact
        const fin = chemins[chemins.length - 1]
        const nEtin = faisceauChoix === 2 ? 12 : 8
        for (let s2 = 0; s2 < nEtin; s2++) {
          const a2 = (s2 / nEtin) * Math.PI * 2 + im.t0 * 3.7
          const d0 = rBase * 0.5 + (10 + 34 * kAge) * z
          const d1 = d0 + (6 + 10 * flash) * z
          g.strokeStyle = `rgba(220,255,235,${(0.75 * alpha).toFixed(3)})`
          g.lineWidth = Math.max(0.8, 1.6 * z)
          g.beginPath()
          g.moveTo(fin.sx + Math.cos(a2) * d0, fin.sy + Math.sin(a2) * d0)
          g.lineTo(fin.sx + Math.cos(a2) * d1, fin.sy + Math.sin(a2) * d1)
          g.stroke()
        }
      }
    }
  }
  // ═══ LES DEUX INSTANTS DU PLASMA ═══════════════════════════════════════
  // Ce que l'énigme demande — se vaporiser DANS la lumière, puis amener
  // l'arc au pied du tube — ne se voyait pas quand on le réussissait : le
  // rayon changeait de teinte, le rail s'allumait, et c'était tout. Deux
  // temps forts le disent maintenant, et un troisième quand ils coïncident.

  // ① L'IONISATION : la traversée s'embrase. Une onde blanche court sur la
  // portion ionisée, l'entrée dans le nuage souffle un anneau, et deux
  // filaments serpentent le long du chemin — le gaz devient conducteur, il
  // ne se contente pas de changer de couleur.
  if (laserEtat.ionisations.length > 0) {
    const nowFx = performance.now() / 1000
    const DUR = 0.42
    laserEtat.ionisations = laserEtat.ionisations.filter(
      (io) => nowFx - io.t0 < DUR,
    )
    for (const io of laserEtat.ionisations) {
      const age = nowFx - io.t0
      const k = age / DUR
      const vif = Math.exp(-age / 0.09) // le claquement, puis la braise
      const a = 1 - k
      const ch = io.points.map((pt) => S(pt.x, pt.y))
      if (ch.length >= 2) {
        for (const [larg, coul] of [
          [26 * z * (1 + 1.4 * vif), `rgba(150,90,255,${(0.18 * a).toFixed(3)})`],
          [9 * z * (1 + 2.0 * vif), `rgba(200,160,255,${(0.45 * a).toFixed(3)})`],
          [2.6 * z * (1 + 2.4 * vif), `rgba(252,248,255,${(0.95 * a).toFixed(3)})`],
        ] as [number, string][]) {
          g.strokeStyle = coul
          g.lineWidth = Math.max(0.8, larg)
          g.lineJoin = 'round'
          g.lineCap = 'round'
          g.beginPath()
          g.moveTo(ch[0].sx, ch[0].sy)
          for (let m = 1; m < ch.length; m++) g.lineTo(ch[m].sx, ch[m].sy)
          g.stroke()
        }
        // les filaments : le gaz conduit, et ça se tord
        const grain = Math.floor(nowFx * 34)
        for (let m = 0; m + 1 < ch.length; m++) {
          traceArcFx(ch[m], ch[m + 1], grain * 7.7 + m * 4.1,
            14 * z * (0.3 + 0.7 * vif),
            `rgba(215,180,255,${(0.7 * a).toFixed(3)})`, Math.max(0.9, 1.4 * z))
          traceArcFx(ch[m], ch[m + 1], grain * 3.3 + m * 12.7 + 61,
            8 * z * (0.3 + 0.7 * vif),
            `rgba(250,245,255,${(0.5 * a).toFixed(3)})`, Math.max(0.7, 1 * z))
        }
      }
      // l'anneau de souffle, au point d'entrée dans le nuage
      const pe = S(io.entree.x, io.entree.y)
      g.strokeStyle = `rgba(205,170,255,${(0.75 * a * a).toFixed(3)})`
      g.lineWidth = Math.max(1, 3 * z * (1 - k * 0.7))
      g.beginPath()
      g.arc(pe.sx, pe.sy, Math.max(3, (14 + 70 * k) * z), 0, Math.PI * 2)
      g.stroke()
    }
  }

  // ② LA CAPTURE, et ③ LE CUMUL : le champ prend l'arc. Une CRÊTE remonte
  // la ligne du point de prise jusqu'au bout — le champ se propage, il ne
  // s'allume pas d'un bloc — et une onde s'ouvre au point de prise. En
  // cumul (l'ionisation dans la même image), tout est plus large, plus
  // long, et une seconde onde part en retard : c'est l'énigme qui se
  // résout d'un seul geste, ça mérite un temps fort à part.
  if (laserEtat.captures.length > 0) {
    const nowFx = performance.now() / 1000
    laserEtat.captures = laserEtat.captures.filter(
      (c) => nowFx - c.t0 < (c.cumul ? 1.0 : 0.7),
    )
    for (const c of laserEtat.captures) {
      const DUR = c.cumul ? 1.0 : 0.7
      const boost = c.cumul ? 1.9 : 1
      const age = nowFx - c.t0
      const k = age / DUR
      const a = 1 - k
      const ch = c.ligne.map((q) => S(q.x, q.y))
      // longueurs cumulées : la crête avance à vitesse constante le long
      // du tracé, quel que soit le nombre de tronçons
      const cum = [0]
      for (let m = 1; m < ch.length; m++)
        cum.push(cum[m - 1] + Math.hypot(ch[m].sx - ch[m - 1].sx, ch[m].sy - ch[m - 1].sy))
      const total = cum[cum.length - 1] || 1
      const tete = total * Math.min(1, k * 1.7)
      const queue = Math.max(0, tete - total * 0.35)
      const sur = (d: number): { sx: number; sy: number } => {
        let m = 1
        while (m < cum.length - 1 && cum[m] < d) m++
        const t = (d - cum[m - 1]) / Math.max(1e-6, cum[m] - cum[m - 1])
        return {
          sx: ch[m - 1].sx + (ch[m].sx - ch[m - 1].sx) * t,
          sy: ch[m - 1].sy + (ch[m].sy - ch[m - 1].sy) * t,
        }
      }
      // la crête : un segment lumineux qui remonte la ligne
      if (tete > queue) {
        const pas = Math.max(6, total / 40)
        const pts: { sx: number; sy: number }[] = []
        for (let d = queue; d <= tete; d += pas) pts.push(sur(d))
        pts.push(sur(tete))
        for (const [larg, coul] of [
          [24 * z * boost, `rgba(150,90,255,${(0.20 * a).toFixed(3)})`],
          [10 * z * boost, `rgba(200,165,255,${(0.5 * a).toFixed(3)})`],
          [3 * z * boost, `rgba(252,250,255,${(0.95 * a).toFixed(3)})`],
        ] as [number, string][]) {
          g.strokeStyle = coul
          g.lineWidth = Math.max(0.8, larg)
          g.lineJoin = 'round'
          g.lineCap = 'round'
          g.beginPath()
          g.moveTo(pts[0].sx, pts[0].sy)
          for (let m = 1; m < pts.length; m++) g.lineTo(pts[m].sx, pts[m].sy)
          g.stroke()
        }
      }
      // l'onde au point de prise — deux en cumul, la seconde en retard
      const pp = S(c.prise.x, c.prise.y)
      const anneau = (kk: number, larg: number, alpha: number): void => {
        if (kk <= 0 || kk >= 1) return
        g.strokeStyle = `rgba(215,185,255,${(alpha * (1 - kk)).toFixed(3)})`
        g.lineWidth = Math.max(1, larg * z * (1 - kk * 0.6))
        g.beginPath()
        g.arc(pp.sx, pp.sy, Math.max(3, (10 + 110 * boost * kk) * z), 0, Math.PI * 2)
        g.stroke()
      }
      anneau(k, 3.4 * boost, 0.85)
      if (c.cumul) anneau((k - 0.22) / 0.78, 2.4, 0.6)
      // les étincelles de la prise : l'arc SAUTE sur la ligne
      const nEt = c.cumul ? 14 : 9
      for (let e = 0; e < nEt; e++) {
        const ang = (e / nEt) * Math.PI * 2 + c.t0 * 5.1
        const d0 = (12 + 60 * boost * k) * z
        const d1 = d0 + (7 + 14 * (1 - k)) * z
        g.strokeStyle = `rgba(235,215,255,${(0.8 * a).toFixed(3)})`
        g.lineWidth = Math.max(0.8, 1.6 * z)
        g.beginPath()
        g.moveTo(pp.sx + Math.cos(ang) * d0, pp.sy + Math.sin(ang) * d0)
        g.lineTo(pp.sx + Math.cos(ang) * d1, pp.sy + Math.sin(ang) * d1)
        g.stroke()
      }
    }
  }
  g.globalCompositeOperation = 'source-over'

  // émetteurs : un fût court orienté, une bouche lumineuse
  for (const em of lasers) {
    if (dansCacheVoilee(em.x, em.y)) continue
    const p = S(em.x, em.y)
    const a = (-em.angle * Math.PI) / 180 // écran : y vers le bas
    g.save()
    g.translate(p.sx, p.sy)
    g.rotate(a)
    const L = Math.max(8, 16 * z)
    g.fillStyle = '#2a3742'
    g.strokeStyle = '#5c7285'
    g.lineWidth = 1.5
    g.beginPath()
    g.roundRect(-L, -L * 0.45, L * 1.7, L * 0.9, L * 0.2)
    g.fill()
    g.stroke()
    g.fillStyle = '#ff6a5a'
    g.beginPath()
    g.arc(L * 0.7, 0, Math.max(2, L * 0.22), 0, Math.PI * 2)
    g.fill()
    g.restore()
  }

  // cibles : pastille éteinte / embrasée — et pour le NOR, l'anneau ambré
  // dit « à maintien », la pastille GRILLÉE dit que la coupure est passée
  const nowCibles = performance.now() / 1000
  for (let c = 0; c < cibles.length; c++) {
    const t = cibles[c]
    if (dansCacheVoilee(t.x, t.y)) continue
    const p = S(t.x, t.y)
    const nor = t.mode === 'nor'
    const scellee = nor && laserEtat.recepteurs.scellees[c] === true
    const lit = !scellee && cibleActive(t, laserEtat.recepteurs, c, nowCibles)
    const r = Math.max(4, t.r * z)
    g.beginPath()
    g.arc(p.sx, p.sy, r, 0, Math.PI * 2)
    g.fillStyle = scellee
      ? 'rgba(48,32,30,0.75)'
      : lit
        ? 'rgba(120,255,190,0.30)'
        : 'rgba(40,56,66,0.6)'
    g.fill()
    g.lineWidth = 2
    g.strokeStyle = scellee
      ? '#6b4a42'
      : lit
        ? '#6dffb8'
        : nor
          ? '#c99a4e'
          : '#5c7285'
    g.stroke()
    if (nor && !scellee) {
      // l'anneau pointillé ambré : ce récepteur veut le faisceau MAINTENU
      g.beginPath()
      g.setLineDash([3, 5])
      g.arc(p.sx, p.sy, r * 0.72, 0, Math.PI * 2)
      g.strokeStyle = lit ? '#ffd98a' : '#a67c3f'
      g.lineWidth = 1.5
      g.stroke()
      g.setLineDash([])
    }
    g.beginPath()
    g.arc(p.sx, p.sy, r * 0.45, 0, Math.PI * 2)
    g.fillStyle = scellee ? '#241b19' : lit ? '#a9ffd6' : '#33424e'
    g.fill()
    if (scellee) {
      // la fêlure : la pastille a brûlé, plus rien n'y passera
      g.beginPath()
      g.moveTo(p.sx - r * 0.5, p.sy + r * 0.42)
      g.lineTo(p.sx - r * 0.1, p.sy - r * 0.05)
      g.lineTo(p.sx + r * 0.18, p.sy + r * 0.2)
      g.lineTo(p.sx + r * 0.52, p.sy - r * 0.4)
      g.strokeStyle = '#8a5a50'
      g.lineWidth = 1.5
      g.stroke()
    }
  }

  // les pastilles de CONDENSAT : des gouttes de matière pure qui respirent
  // doucement — bues au contact, elles s'éteignent du tableau
  const nowPastilles = performance.now() / 1000
  for (let i = 0; i < pastilles.length; i++) {
    if (pastillesPrises[i]) continue
    const pa = pastilles[i]
    // la fiole de SONDE fait luire les pastilles à travers les voiles
    if (!fioleActive('sonde') && dansCacheVoilee(pa.x, pa.y)) continue
    const p = S(pa.x, pa.y)
    const pouls = 0.82 + 0.18 * Math.sin(nowPastilles * 2.1 + i * 1.7)
    const r = Math.max(3, RAYON_PASTILLE * 0.55 * z) * pouls
    // le halo : la pastille se voit de loin, sans crier
    g.beginPath()
    g.arc(p.sx, p.sy, r * 2.1, 0, Math.PI * 2)
    g.fillStyle = 'rgba(110,200,255,0.10)'
    g.fill()
    g.beginPath()
    g.arc(p.sx, p.sy, r, 0, Math.PI * 2)
    g.fillStyle = 'rgba(140,215,255,0.55)'
    g.fill()
    g.lineWidth = 1.5
    g.strokeStyle = '#9fdcff'
    g.stroke()
    g.beginPath()
    g.arc(p.sx - r * 0.28, p.sy - r * 0.3, r * 0.32, 0, Math.PI * 2)
    g.fillStyle = 'rgba(235,250,255,0.85)'
    g.fill()
  }
  // la FIOLE scellée : un double anneau violet, plus rare que la matière
  if (
    fiolePastille &&
    !fiolePrise &&
    (fioleActive('sonde') || !dansCacheVoilee(fiolePastille.x, fiolePastille.y))
  ) {
    const p = S(fiolePastille.x, fiolePastille.y)
    const pouls = 0.85 + 0.15 * Math.sin(nowPastilles * 1.6)
    const r = Math.max(4, RAYON_PASTILLE * 0.7 * z) * pouls
    g.beginPath()
    g.arc(p.sx, p.sy, r * 2, 0, Math.PI * 2)
    g.fillStyle = 'rgba(200,140,255,0.10)'
    g.fill()
    g.beginPath()
    g.arc(p.sx, p.sy, r, 0, Math.PI * 2)
    g.fillStyle = 'rgba(190,130,255,0.35)'
    g.fill()
    g.lineWidth = 2
    g.strokeStyle = '#c99aff'
    g.stroke()
    g.beginPath()
    g.arc(p.sx, p.sy, r * 0.55, 0, Math.PI * 2)
    g.strokeStyle = '#e8d2ff'
    g.lineWidth = 1.2
    g.stroke()
  }

  // ---- LE MÉTA POSÉ : plots d'article, banc des mémoires, marchand,
  // éclats — la teinte dit la monnaie (cyan : condensat, menthe : mémoire).
  const plotsDessin = level.plots ?? []
  for (let i = 0; i < plotsDessin.length; i++) {
    const pl = plotsDessin[i]
    if (dansCacheVoilee((pl.minX + pl.maxX) / 2, (pl.minY + pl.maxY) / 2))
      continue
    const fiche =
      pl.monnaie === 'memoire'
        ? articleComptoir(pl.article)
        : articleEtal(pl.article)
    if (!fiche) continue
    const servi =
      pl.monnaie === 'memoire'
        ? achatsHub.has(pl.article)
        : achatsEconomat.has(pl.article)
    // le cadre suit LA NICHE DESSINÉE, pas le rectangle du plot : sans cela
    // le trait en pointillés doublait le cadre de métal de l'alcôve, plus
    // large que lui, et l'œil voyait deux boîtes au lieu d'une
    const cadre = cadreAlcove(pl)
    const a = S(cadre.minX, cadre.maxY)
    const b = S(cadre.maxX, cadre.minY)
    if (b.sx < 0 || a.sx > vw || b.sy < 0 || a.sy > vh) continue
    const teinte = pl.monnaie === 'memoire' ? '109,255,184' : '140,215,255'
    const pouls = servi ? 0 : 0.5 + 0.5 * Math.sin(nowPastilles * 1.8 + i)
    // l'alcôve respire tant qu'elle n'a pas servi
    g.fillStyle = `rgba(${teinte},${servi ? 0.03 : 0.05 + 0.04 * pouls})`
    g.fillRect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy)
    g.setLineDash([7, 6])
    g.lineWidth = servi ? 1 : 1.6
    g.strokeStyle = `rgba(${teinte},${servi ? 0.22 : 0.55 + 0.25 * pouls})`
    g.strokeRect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy)
    g.setLineDash([])
    // la fiche au centre : l'icône, puis le prix (ou « servi »)
    const cx = (a.sx + b.sx) / 2
    const cy = (a.sy + b.sy) / 2
    const t = Math.max(10, Math.min(26, 88 * z))
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.globalAlpha = servi ? 0.35 : 1
    g.fillStyle = `rgba(${teinte},0.95)`
    dessineIconeArticle(g, pl.article, fiche.icone, cx, cy - t * 0.42, t)
    g.font = `600 ${Math.round(t * 0.62)}px system-ui, sans-serif`
    g.fillStyle = `rgba(${teinte},0.9)`
    g.fillText(
      servi
        ? 'SERVI'
        : `${pl.prix ?? fiche.prix} ${pl.monnaie === 'memoire' ? 'mém.' : 'cL'}`,
      cx,
      cy + t * 0.55,
    )
    g.globalAlpha = 1
  }
  // le BANC DES MÉMOIRES : une lueur menthe, l'atome au centre
  if (level.bancMemoires) {
    const bz = level.bancMemoires
    if (!dansCacheVoilee((bz.minX + bz.maxX) / 2, (bz.minY + bz.maxY) / 2)) {
      const a = S(bz.minX, bz.maxY)
      const b = S(bz.maxX, bz.minY)
      const cx = (a.sx + b.sx) / 2
      const cy = (a.sy + b.sy) / 2
      const pouls = 0.6 + 0.4 * Math.sin(nowPastilles * 1.3)
      const ray = Math.max(8, Math.max(b.sx - a.sx, b.sy - a.sy) * 0.6)
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, ray)
      grad.addColorStop(0, `rgba(109,255,184,${0.08 + 0.16 * pouls})`)
      grad.addColorStop(1, 'rgba(109,255,184,0)')
      g.fillStyle = grad
      g.fillRect(cx - ray, cy - ray, ray * 2, ray * 2)
      g.setLineDash([4, 7])
      g.strokeStyle = `rgba(109,255,184,${0.35 + 0.3 * pouls})`
      g.lineWidth = 1.4
      g.strokeRect(a.sx, a.sy, b.sx - a.sx, b.sy - a.sy)
      g.setLineDash([])
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.font = `${Math.max(12, Math.min(30, 100 * z))}px system-ui`
      g.fillStyle = '#bdffdf'
      g.fillText('⚛', cx, cy)
    }
  }
  // le MARCHAND : une présence — l'anneau rose pâle pulse autour du point
  if (level.marchand && !dansCacheVoilee(level.marchand.x, level.marchand.y)) {
    const p = S(level.marchand.x, level.marchand.y)
    const pouls = 0.75 + 0.25 * Math.sin(nowPastilles * 1.1)
    const r = Math.max(10, 150 * z) * pouls
    const grad = g.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 1.8)
    grad.addColorStop(0, 'rgba(255,170,210,0.16)')
    grad.addColorStop(1, 'rgba(255,170,210,0)')
    g.fillStyle = grad
    g.beginPath()
    g.arc(p.sx, p.sy, r * 1.8, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.arc(p.sx, p.sy, r, 0, Math.PI * 2)
    g.setLineDash([2, 6])
    g.strokeStyle = `rgba(255,190,220,${0.3 + 0.3 * pouls})`
    g.lineWidth = 1.6
    g.stroke()
    g.setLineDash([])
  }
  // les ÉCLATS DE MÉMOIRE : le losange menthe qui tourne — l'information
  // cristallisée, visible à travers les voiles avec la SONDE seulement
  for (let i = 0; i < eclatsEssai.length; i++) {
    if (eclatsPrisEssai[i]) continue
    const e = eclatsEssai[i]
    if (!fioleActive('sonde') && dansCacheVoilee(e.x, e.y)) continue
    const p = S(e.x, e.y)
    const pouls = 0.85 + 0.15 * Math.sin(nowPastilles * 2.4 + i)
    const r = Math.max(4, RAYON_PASTILLE * 0.62 * z) * pouls
    g.beginPath()
    g.arc(p.sx, p.sy, r * 2.2, 0, Math.PI * 2)
    g.fillStyle = 'rgba(109,255,184,0.10)'
    g.fill()
    dessineEclat(g, p.sx, p.sy, r, nowPastilles * 1.4 + i * 0.9)
  }

  // LES CACHETTES, EN DERNIER : le brouillard « non cartographié » couvre
  // TOUT — parois, fluide, mécanismes, décor. Le centre du corps qui entre
  // lève le voile en fondu ; il reste levé pour l'essai (Recommencer
  // re-voile, la découverte se rejoue). Des nappes de brume dérivent
  // lentement dans le voile pour qu'il se lise comme du brouillard, pas
  // comme un rectangle mort.
  if (cachesLevee.length !== caches.length) {
    cachesLevee = caches.map(() => Infinity)
  }
  for (let i = 0; i < caches.length; i++) {
    const c = caches[i]
    if (
      cachesLevee[i] === Infinity &&
      !sim.dispersed &&
      dansForme(c, sim.stats.centroidX, sim.stats.centroidY)
    ) {
      cachesLevee[i] = elapsed
      // la PAROI FACTICE sort du décor à l'instant de la révélation — la
      // dissolution 2D ci-dessous couvre la transition
      if (c.style === 'paroi') rebuildRenderBoxes()
    }
    const alpha =
      cachesLevee[i] === Infinity
        ? 1
        : Math.max(0, 1 - (elapsed - cachesLevee[i]) / 0.9)
    if (alpha <= 0) continue
    const a = S(c.minX, c.maxY)
    const b = S(c.maxX, c.minY)
    const w = b.sx - a.sx
    const h = b.sy - a.sy
    if (b.sx < 0 || a.sx > vw || b.sy < 0 || a.sy > vh) continue
    // le chemin ÉPOUSE la forme de la cachette (disque, capsule, coin,
    // arc, rotation…) — le rectangle n'est qu'un cas particulier
    const chemin = (): void => {
      const pts = formeOutline(c, 56)
      g.beginPath()
      for (let k = 0; k < pts.length; k++) {
        const sp = S(pts[k].x, pts[k].y)
        if (k === 0) g.moveTo(sp.sx, sp.sy)
        else g.lineTo(sp.sx, sp.sy)
      }
      g.closePath()
    }
    if (c.style === 'paroi') {
      // PAROI FACTICE : voilée, c'est le MOTEUR qui la rend (vraie paroi,
      // vraies ombres) — ici on ne dessine que sa DISSOLUTION une fois
      // révélée : la teinte de paroi s'évapore du contour exact
      if (cachesLevee[i] === Infinity) continue
      g.save()
      chemin()
      g.clip()
      g.globalAlpha = alpha * 0.92
      g.fillStyle = '#3a4450'
      g.fillRect(a.sx, a.sy, w, h)
      g.globalAlpha = alpha * 0.5
      g.fillStyle = '#232b36'
      g.fillRect(a.sx, a.sy, w, h * 0.5)
      g.restore()
      g.globalAlpha = 1
      continue
    }
    g.save()
    chemin()
    g.clip()
    g.globalAlpha = alpha
    g.fillStyle = '#0d1320'
    g.fillRect(a.sx, a.sy, w, h)
    for (let k = 0; k < 4; k++) {
      const ph = i * 7.3 + k * 2.1
      const nx = a.sx + w * (0.5 + 0.42 * Math.sin(elapsed * 0.11 + ph * 1.7))
      const ny = a.sy + h * (0.5 + 0.42 * Math.cos(elapsed * 0.089 + ph))
      const r = Math.max(w, h) * (0.3 + 0.1 * Math.sin(ph * 3.7))
      const grad = g.createRadialGradient(nx, ny, 0, nx, ny, Math.max(8, r))
      grad.addColorStop(0, 'rgba(52,68,92,0.24)')
      grad.addColorStop(1, 'rgba(52,68,92,0)')
      g.fillStyle = grad
      g.fillRect(a.sx, a.sy, w, h)
    }
    g.restore()
    // le liseré, à peine plus clair : le pan se devine sans se trahir
    g.globalAlpha = alpha * 0.45
    g.strokeStyle = 'rgba(74,94,120,0.55)'
    g.lineWidth = 1
    chemin()
    g.stroke()
    g.globalAlpha = 1
  }
}

// Flèche de cap manette : elle apparaît dès qu'on touche le stick et montre
// où l'on veut ALLER — l'éjection, elle, part à l'opposé sans qu'on y pense.
// Tout est lissé (naissance, cap, longueur) : la flèche glisse, elle ne
// saute pas. En visée de dash, la ligne du dash prend le relais.
const fleche = { alpha: 0, ang: 0, len: 60 }
function drawFleche(dtReal: number, dpr: number): void {
  const enJeu = document.body.classList.contains('playing')
  const aMain =
    manette.connectee &&
    manette.lastActivity > input.lastPointerAt &&
    input.touchCount === 0
  const veut =
    flecheVisible &&
    aMain &&
    enJeu &&
    manette.force > 0.03 &&
    !dash.aiming &&
    !input.paused
  // naissance et extinction en douceur
  fleche.alpha += ((veut ? 1 : 0) - fleche.alpha) * Math.min(1, dtReal * 9)
  if (fleche.alpha < 0.02) return
  // cap : on tourne par le plus court chemin, sans à-coup
  const cible = Math.atan2(manette.dirY, manette.dirX)
  let d = cible - fleche.ang
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  fleche.ang += d * Math.min(1, dtReal * 14)
  const lenCible =
    (36 + 90 * manette.force) * Math.max(0.5, Math.min(1.6, camera.zoom))
  fleche.len += (lenCible - fleche.len) * Math.min(1, dtReal * 10)

  const dprC = Math.min(dpr, 2)
  const g = fxCtx
  g.setTransform(dprC, 0, 0, dprC, 0, 0)
  const bx =
    window.innerWidth * 0.5 + (sim.stats.centroidX - camera.x) * camera.zoom
  const by =
    window.innerHeight * 0.5 - (sim.stats.centroidY - camera.y) * camera.zoom
  const r0 = sim.stats.rmsRadius * camera.zoom + 12 // on part du bord du corps
  const L = fleche.len
  const puls = 1 + 0.04 * Math.sin(elapsed * 4.2)
  g.save()
  g.translate(bx, by)
  g.rotate(fleche.ang)
  g.scale(puls, puls)
  const bout = r0 + L
  const grad = g.createLinearGradient(r0, 0, bout, 0)
  grad.addColorStop(0, `rgba(140,210,255,0)`)
  grad.addColorStop(1, `rgba(215,240,255,${(0.9 * fleche.alpha).toFixed(3)})`)
  g.lineCap = 'round'
  g.lineJoin = 'round'
  // halo doux, puis fût net
  g.strokeStyle = `rgba(120,190,240,${(0.16 * fleche.alpha).toFixed(3)})`
  g.lineWidth = 9
  g.beginPath()
  g.moveTo(r0, 0)
  g.lineTo(bout - 6, 0)
  g.stroke()
  g.strokeStyle = grad
  g.lineWidth = 3.2
  g.beginPath()
  g.moveTo(r0, 0)
  g.lineTo(bout - 6, 0)
  g.stroke()
  // la pointe : un chevron galbé
  g.strokeStyle = `rgba(230,246,255,${(0.92 * fleche.alpha).toFixed(3)})`
  g.lineWidth = 3.2
  g.beginPath()
  g.moveTo(bout - 13, -8)
  g.quadraticCurveTo(bout - 3, 0, bout - 13, 8)
  g.stroke()
  g.restore()
}

let lastRailTime = 0
// quand le hub a versé pour la dernière fois (temps de tableau) : le repos
// entre deux versements évite que le son de collecte ne crépite
let dernierVersementAuto = -99
// rails dont le champ est engagé : allumés par un arc, ils ne se relâchent
// qu'une fois leur bande vidée (le nuage porté jusqu'à l'arrivée)
const railsEngages = new Set<number>()
// LES CACHETTES : l'instant où le voile de chaque pan s'est levé
// (Infinity : encore voilé). Le corps qui entre lève le voile — et
// Recommencer re-voile tout : la découverte se rejoue à chaque essai.
let cachesLevee: number[] = []
// LES PASTILLES DE CONDENSAT : semées à l'entrée du tableau (condensat.ts,
// semis déterministe par code — les cachettes ont les leurs), bues au
// contact du corps. « Recommencer » re-sème tout : la cueillette se rejoue.
let pastilles: CondensatDef[] = []
let pastillesPrises: boolean[] = []
// LA FIOLE du tableau (au plus une, dans la cachette la plus profonde) —
// null : ce tableau n'en cache pas, ou la collection est complète
let fiolePastille: { x: number; y: number } | null = null
let fiolePrise = false
/** Une fiole équipée est-elle active ? (les effets passifs de la run) */
const fioleActive = (id: string): boolean => records.fioleEquipee(id)
/** Ce point est-il sous un voile encore fermé ? (masque étiquettes et
 * mécanismes — la cachette a la forme qu'on lui a donnée). */
function dansCacheVoilee(x: number, y: number): boolean {
  const caches = level.caches ?? []
  for (let i = 0; i < caches.length; i++) {
    if ((cachesLevee[i] ?? Infinity) === Infinity && dansForme(caches[i], x, y))
      return true
  }
  return false
}
// Le décor rendu : les parois du tableau, PLUS les PAROIS FACTICES des
// cachettes voilées (style « paroi ») — le moteur les rend comme de vraies
// parois, ombres portées comprises. À la révélation, la factice sort du
// décor (et la carte de lumière se recuit une fois, sans elle).
function rebuildRenderBoxes(): void {
  const factices: ObstacleBox[] = (level.caches ?? [])
    .filter(
      (c, i) =>
        c.style === 'paroi' && (cachesLevee[i] ?? Infinity) === Infinity,
    )
    .map(({ style: _style, ...reste }) => ({ ...reste, material: MAT_WALL }))
  renderBoxes = [
    ...level.boxes.slice(0, Math.max(1, MAX_BOXES - 1 - factices.length)),
    ...factices,
    { ...level.exit, material: MAT_EXIT },
  ]
}
// ---- LE PACK PRÉSENCE : le Sujet est vivant ----
// Trois signes de vie, purement visuels, calculés ici et rendus au shader :
// · le REGARD — un noyau interne glisse vers ce que le corps regarde (la
//   visée, un mécanisme proche, le sas) ;
// · la RESPIRATION — le contour pulse : lent au calme, court en alerte
//   (réserve à sec), suspendu pendant la visée ;
// · le FRISSON — un tremblement bref quand le froid saisit le corps.
const presence = {
  x: 0,
  y: 0,
  int: 0,
  amp: 0,
  vit: 1.7,
  frisson: 0,
  t0Frisson: -9,
  armeFrisson: true,
  ondule: 0, // 0..1 : l'ondulation du contour, quand on le laisse tranquille
}
;(window as unknown as { __presence: typeof presence }).__presence = presence

// ---- LES CURSEURS DE L'ŒIL : la présence se règle (banc → L'œil) ----
// Sept curseurs, mémorisés par appareil. Les DÉFAUTS ci-dessous sont
// l'étalonnage du concepteur (26/08) : un noyau plus lumineux dans une
// pénombre discrète, un œil un rien plus petit et plus plat, un regard
// plus vif qui erre peu — et un Sujet nettement plus occupé. La valeur
// 1 sur un curseur reste « le rendu du moteur, non dosé ».
const OEIL_DEFAUTS = {
  lueur: 1.6, // luminosité du noyau (0 : éteint · 2,5 : phare)
  ombre: 0.3, // profondeur de la pénombre (0 : aucune silhouette)
  taille: 0.9, // échelle de l'œil entier (noyau, ombre, dôme)
  relief: 0.85, // hauteur du dôme : courbure du miroir et modelé
  vivacite: 1.25, // vitesse de glissement du regard
  errance: 0.8, // le regard vagabonde quand rien ne l'appelle
  curiosite: 1.85, // fréquence des vignettes d'idle (toilette, tentacule…)
}
type OeilRegl = typeof OEIL_DEFAUTS
const CLE_OEIL = 'sujet21-oeil-v1'
const oeilRegl: OeilRegl = (() => {
  try {
    const d = JSON.parse(
      localStorage.getItem(CLE_OEIL) ?? 'null',
    ) as Partial<OeilRegl> | null
    const lit = (v: unknown, def: number): number =>
      typeof v === 'number' && Number.isFinite(v)
        ? Math.max(0, Math.min(3, v))
        : def
    return {
      lueur: lit(d?.lueur, OEIL_DEFAUTS.lueur),
      ombre: lit(d?.ombre, OEIL_DEFAUTS.ombre),
      taille: Math.max(0.4, lit(d?.taille, OEIL_DEFAUTS.taille)),
      relief: lit(d?.relief, OEIL_DEFAUTS.relief),
      vivacite: Math.max(0.2, lit(d?.vivacite, OEIL_DEFAUTS.vivacite)),
      errance: lit(d?.errance, OEIL_DEFAUTS.errance),
      curiosite: Math.max(0.25, lit(d?.curiosite, OEIL_DEFAUTS.curiosite)),
    }
  } catch {
    return { ...OEIL_DEFAUTS }
  }
})()
function sauveOeil(): void {
  try {
    localStorage.setItem(CLE_OEIL, JSON.stringify(oeilRegl))
  } catch {
    // stockage refusé : les curseurs ne tiendront que la session
  }
}
// Les curseurs vivent dans LE BANC (dossier « L'œil du Sujet ») : le banc
// flotte sur le jeu qui tourne — réglage à vue, image par image. Voir le
// branchement dans createBench (actions.oeil), plus bas.

// ---- L'IDLE : la vie quand on ne joue pas ----
// Sans geste pendant quelques secondes, le Sujet EXISTE tout seul — de
// petites vignettes, jamais utiles, jamais à sa place : il fait sa
// toilette (se resserre soigneusement), pense au sas (le regard y
// glisse), s'étire (une grande respiration lente), tapote la paroi la
// plus proche (deux petits coups, comme on éprouve un mur), ou étend un
// TENTACULE — un doigt de liquide qui va toucher la paroi, puis rentre.
// Le moindre geste du joueur remet tout à zéro.
const idle = {
  t: 0, // secondes sans geste
  prochaine: 6, // seuil (en secondes d'idle) de la prochaine vignette
  type: '' as '' | 'toilette' | 'sas' | 'etire' | 'tapote' | 'tentacule',
  t0: 0, // début de la vignette (elapsed)
  murX: 0,
  murY: 0,
  ancX: 0, // l'ancre du centroïde au départ de la vignette : rien à gagner
  ancY: 0,
}
;(window as unknown as { __idle: typeof idle }).__idle = idle
// L'ÉVEIL DU TABLEAU : pendant le zoom automatique d'entrée, le Sujet se
// RÉVEILLE — un petit scénario aléatoire à chaque salle : grande
// inspiration, regard qui balaie un coin de la pièce avant de glisser au
// sas, parfois un frisson, parfois une vignette physique (toilette,
// étirement). Jamais deux fois le même réveil : la salle paraît vivante
// dès le plan large.
const reveil = {
  actif: false,
  t0: 0,
  frissonT: -1, // instant du frisson de réveil dans l'intro (-1 : aucun)
  frissonFait: false,
  balayageX: 0, // le point que le regard visite avant le sas
  balayageY: 0,
  bascule: 1, // seconde où le regard quitte ce point pour le sas
}
;(window as unknown as { __reveil: typeof reveil }).__reveil = reveil
// Le STICK parle-t-il ? incliné, et la manette plus récente que le pointeur :
// le regard le suit, et l'idle sait que le joueur est là
function stickVise(): boolean {
  return (
    manette.connectee &&
    input.touchCount === 0 &&
    manette.lastActivity > input.lastPointerAt &&
    manette.force > 0.03
  )
}
function majIdle(dtReal: number): void {
  // une souris qui BOUGE compte comme un geste (fenêtre courte : posée,
  // elle laisse l'idle venir même si le regard la fixe encore)
  const geste =
    input.aimActive ||
    input.freezeIntent ||
    input.gasIntent ||
    stickVise() ||
    performance.now() / 1000 - input.sourisAt < 0.4
  const enVie =
    document.body.classList.contains('playing') &&
    !input.paused &&
    !sim.dispersed &&
    !run.ended &&
    !miseEnBonbonne &&
    !lecteurCine.actif
  if (geste || !enVie) {
    idle.t = 0
    idle.type = ''
    // la CURIOSITÉ (curseur) rapproche ou éloigne la prochaine vignette
    idle.prochaine = (6 + Math.random() * 3) / oeilRegl.curiosite
    return
  }
  idle.t += dtReal
  if (idle.type) {
    const age = elapsed - idle.t0
    const duree =
      idle.type === 'tentacule'
        ? 3.9
        : idle.type === 'sas'
          ? 2.6
          : idle.type === 'etire'
            ? 1.9
            : idle.type === 'tapote'
              ? 1.1
              : 1.0
    if (age > duree) {
      idle.type = ''
      idle.prochaine = idle.t + (4 + Math.random() * 5) / oeilRegl.curiosite
    }
  } else if (idle.t >= idle.prochaine) {
    // choisir la vignette — tapoter seulement si une paroi est à portée
    const cx = sim.stats.centroidX
    const cy = sim.stats.centroidY
    let murX = 0
    let murY = 0
    let best = Infinity
    for (const b of level.boxes) {
      const px = Math.max(b.minX, Math.min(cx, b.maxX))
      const py = Math.max(b.minY, Math.min(cy, b.maxY))
      const d = Math.hypot(px - cx, py - cy)
      if (d < best) {
        best = d
        murX = px
        murY = py
      }
    }
    const choix: Array<'toilette' | 'sas' | 'etire' | 'tapote' | 'tentacule'> =
      ['toilette', 'sas', 'etire']
    if (best < sim.stats.rmsRadius + 130) choix.push('tapote')
    // le TENTACULE porte plus loin que le toc-toc — et c'est la vignette
    // vedette : deux billets dans le chapeau
    if (best > 30 && best < sim.stats.rmsRadius + 300)
      choix.push('tentacule', 'tentacule')
    idle.type = choix[Math.floor(Math.random() * choix.length)]
    idle.t0 = elapsed
    idle.murX = murX
    idle.murY = murY
    idle.ancX = cx
    idle.ancY = cy
  }
  // les vignettes PHYSIQUES — infimes, sans aucun gain de déplacement
  if (idle.type === 'toilette') {
    // la toilette : le corps se resserre soigneusement sur lui-même
    const cx = sim.stats.centroidX
    const cy = sim.stats.centroidY
    const k = Math.min(1, 2.2 * dtReal)
    for (let i = 0; i < sim.count; i++) {
      if (
        sim.kind[i] !== KIND_PLAYER ||
        sim.frozen[i] === 1 ||
        sim.gaseous[i] === 1
      )
        continue
      const dx = cx - sim.posX[i]
      const dy = cy - sim.posY[i]
      const d = Math.hypot(dx, dy)
      if (d < 1e-3) continue
      const ux = dx / d
      const uy = dy / d
      const vTarget = Math.min(38, d * 1.1)
      const vRadial = sim.velX[i] * ux + sim.velY[i] * uy
      sim.velX[i] += (vTarget - vRadial) * ux * k * 0.5
      sim.velY[i] += (vTarget - vRadial) * uy * k * 0.5
    }
  } else if (idle.type === 'tapote') {
    // deux petits coups vers la paroi, puis plus rien — un toc-toc
    const age = elapsed - idle.t0
    const coup = age < 0.14 || (age > 0.45 && age < 0.59)
    if (coup) {
      const cx = sim.stats.centroidX
      const cy = sim.stats.centroidY
      const d = Math.hypot(idle.murX - cx, idle.murY - cy) || 1
      const ax = ((idle.murX - cx) / d) * 240 * dtReal
      const ay = ((idle.murY - cy) / d) * 240 * dtReal
      for (let i = 0; i < sim.count; i++) {
        if (
          sim.kind[i] !== KIND_PLAYER ||
          sim.frozen[i] === 1 ||
          sim.gaseous[i] === 1
        )
          continue
        sim.velX[i] += ax
        sim.velY[i] += ay
      }
    }
    if (age >= 0.14 && age < 0.14 + dtReal) audio.iceImpact(0.16)
    if (age >= 0.59 && age < 0.59 + dtReal) audio.iceImpact(0.12)
  } else if (idle.type === 'tentacule') {
    // le PSEUDOPODE : un aimant au bout du doigt tire les gouttes en
    // chaîne — il sort du flanc, s'étire jusqu'à la paroi, l'effleure,
    // puis rentre en se rembobinant
    const age = elapsed - idle.t0
    const cx = sim.stats.centroidX
    const cy = sim.stats.centroidY
    const dxM = idle.murX - cx
    const dyM = idle.murY - cy
    const dMur = Math.hypot(dxM, dyM) || 1
    const ux = dxM / dMur
    const uy = dyM / dMur
    const depart = Math.min(dMur, sim.stats.rmsRadius * 0.85)
    // l'avancée du bout : sortie (→1,2 s), toucher (→1,9 s), retour
    // (→3,15 s), rassemblement (→3,9 s). Le bout vise LÉGÈREMENT DANS la
    // paroi : la collision fait le contact — les gouttes traînent toujours
    // un peu derrière l'aimant, sans ça le doigt s'arrêtait à vingt unités
    const lisse = (t: number): number => t * t * (3 - 2 * t)
    const av =
      lisse(Math.min(1, age / 1.2)) *
      (1 - lisse(age < 2.1 ? 0 : Math.min(1, (age - 2.1) / 1.05)))
    const tipD = depart + (dMur + 18 - depart) * av
    const tipX = cx + ux * tipD
    const tipY = cy + uy * tipD
    const k = Math.min(1, 5 * dtReal)
    const retire = age >= 2.1 ? 1.35 : 1 // le rembobinage tire plus fort
    let mvx = 0
    let mvy = 0
    let nLiq = 0
    for (let i = 0; i < sim.count; i++) {
      if (
        sim.kind[i] !== KIND_PLAYER ||
        sim.frozen[i] === 1 ||
        sim.gaseous[i] === 1
      )
        continue
      nLiq++
      const px = tipX - sim.posX[i]
      const py = tipY - sim.posY[i]
      const d = Math.hypot(px, py)
      if (age < 3.15) {
        // aimant du bout, puis rassemblement
        if (d > 52 || d < 1e-3) {
          // rien : hors de portée de l'aimant
        } else {
          const vCible = Math.min(130, 26 + d * 2.0) * retire
          sim.velX[i] += ((px / d) * vCible - sim.velX[i]) * k
          sim.velY[i] += ((py / d) * vCible - sim.velY[i]) * k
        }
      } else {
        // le RASSEMBLEMENT : ce qui dépasse encore rentre au bercail
        const gx = cx - sim.posX[i]
        const gy = cy - sim.posY[i]
        const g = Math.hypot(gx, gy)
        if (g >= sim.stats.rmsRadius * 1.05) {
          const vCible = Math.min(60, g * 1.2)
          const vRad = (sim.velX[i] * gx + sim.velY[i] * gy) / g
          sim.velX[i] += ((vCible - vRad) * gx * k * 0.6) / g
          sim.velY[i] += ((vCible - vRad) * gy * k * 0.6) / g
        }
      }
      mvx += sim.velX[i]
      mvy += sim.velY[i]
    }
    // l'ANCRE : le pseudopode ne doit RIEN faire gagner. La neutralité
    // d'élan ne suffit pas — le contact de la paroi POUSSE le corps ; un
    // ressort doux (uniforme : il ne déforme pas le doigt) ramène le
    // centroïde à sa position de départ et amortit la vitesse d'ensemble
    if (nLiq > 0) {
      mvx /= nLiq
      mvy /= nLiq
      const rx = ((idle.ancX - cx) * 6 - mvx * 2.5) * dtReal
      const ry = ((idle.ancY - cy) * 6 - mvy * 2.5) * dtReal
      for (let i = 0; i < sim.count; i++) {
        if (
          sim.kind[i] !== KIND_PLAYER ||
          sim.frozen[i] === 1 ||
          sim.gaseous[i] === 1
        )
          continue
        sim.velX[i] += rx
        sim.velY[i] += ry
      }
    }
    if (age >= 1.25 && age < 1.25 + dtReal) audio.iceImpact(0.09)
  }
}
function majPresence(dtReal: number, aimX: number, aimY: number): void {
  const cx = sim.stats.centroidX
  const cy = sim.stats.centroidY
  // le réveil ne vit que le temps de l'intro caméra
  if (reveil.actif && (!camera.introEnCours || sim.dispersed))
    reveil.actif = false
  const tReveil = performance.now() / 1000 - reveil.t0
  // 1. l'ATTENTION : la visée d'abord ; sinon le mécanisme notable le plus
  // proche — chaudière, cible laser, cachette encore voilée — puis le sas
  let tx = 0
  let ty = 0
  let vise = false
  if (reveil.actif) {
    // le RÉVEIL : le regard visite un coin de la salle, puis glisse au sas
    if (tReveil < reveil.bascule) {
      tx = reveil.balayageX
      ty = reveil.balayageY
    } else {
      tx = exitMouth.x
      ty = exitMouth.y
    }
    vise = true
  } else if (stickVise()) {
    // à la manette, le point de visée est le point d'ÉJECTION — derrière le
    // corps en eau : le regard, lui, suit le STICK — là où l'on veut aller
    // (axe Y du stick vers le bas, monde vers le haut)
    tx = cx + manette.dirX * 400
    ty = cy - manette.dirY * 400
    vise = true
  } else if (
    input.aimActive ||
    // la souris retient le regard SANS clic : tant qu'elle a la main et
    // qu'elle a bougé il y a peu — immobile trop longtemps, la curiosité
    // reprend (mécanismes, sas, vignettes d'idle)
    (performance.now() / 1000 - input.sourisAt < 6 &&
      input.lastPointerAt >= manette.lastActivity)
  ) {
    tx = aimX
    ty = aimY
    vise = true
  } else if (idle.type === 'sas') {
    // la vignette d'idle : il pense au sas — le regard y glisse
    tx = exitMouth.x
    ty = exitMouth.y
    vise = true
  } else if (idle.type === 'tentacule' || idle.type === 'tapote') {
    // il regarde ce qu'il touche : le point de paroi de son propre geste
    tx = idle.murX
    ty = idle.murY
    vise = true
  } else if (!sim.dispersed) {
    let best = Infinity
    const regarde = (x: number, y: number, portee: number): void => {
      const d = Math.hypot(x - cx, y - cy)
      if (d < portee && d < best) {
        best = d
        tx = x
        ty = y
        vise = true
      }
    }
    for (const b of level.boxes) {
      if (b.material === MAT_CHAUD)
        regarde((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, 420)
    }
    for (const t of level.cibles ?? []) regarde(t.x, t.y, 500)
    const caches = level.caches ?? []
    for (let i = 0; i < caches.length; i++) {
      if ((cachesLevee[i] ?? Infinity) === Infinity) {
        const c = caches[i]
        regarde((c.minX + c.maxX) / 2, (c.minY + c.maxY) / 2, 420)
      }
    }
    regarde(exitMouth.x, exitMouth.y, 1100)
  }
  // le noyau vit DANS le corps : à mi-chemin du bord, du côté regardé —
  // la VIVACITÉ (curseur) règle la vitesse du glissement
  const k = 1 - Math.exp(-4.5 * oeilRegl.vivacite * dtReal)
  if (vise) {
    const d = Math.hypot(tx - cx, ty - cy) || 1
    const portee = Math.min(d, sim.stats.rmsRadius * 0.55)
    presence.x += (cx + ((tx - cx) / d) * portee - presence.x) * k
    presence.y += (cy + ((ty - cy) / d) * portee - presence.y) * k
  } else {
    // l'ERRANCE (curseur) : rien ne l'appelle — au lieu de rentrer se
    // poser au centre, le regard vagabonde lentement dans le corps
    const port = sim.stats.rmsRadius * 0.3 * Math.min(1.6, oeilRegl.errance)
    const tw = elapsed * 0.33
    const wx = Math.sin(tw + 1.7) * 0.7 + Math.sin(tw * 2.3) * 0.3
    const wy = Math.cos(tw * 0.83) * 0.7 + Math.sin(tw * 1.9 + 4.2) * 0.3
    presence.x += (cx + wx * port - presence.x) * k
    presence.y += (cy + wy * port - presence.y) * k
  }
  // sans cible, l'œil ne s'éteint plus tout à fait : l'errance se VOIT
  // (elle garde une demi-présence — 0 sur le curseur la rend invisible)
  const intCible = sim.dispersed
    ? 0
    : vise
      ? 1
      : Math.min(0.65, 0.65 * oeilRegl.errance)
  presence.int += (intCible - presence.int) * k
  // 2. la RESPIRATION : le rythme raconte l'état intérieur
  const peril = endgame.lastCall || endgame.spent
  // l'idle approfondit le souffle ; l'ÉTIREMENT est une grande inspiration
  const ampCible = reveil.actif
    ? 0.03 // la grande inspiration du réveil
    : input.aimActive
      ? 0.004
      : peril
        ? 0.022
        : idle.type === 'etire'
          ? 0.034
          : idle.t > 4
            ? 0.017
            : 0.013
  const vitCible = reveil.actif
    ? 1.0
    : peril
      ? 4.8
      : idle.type === 'etire'
        ? 0.9
        : idle.t > 4
          ? 1.35
          : 1.7
  presence.amp += (ampCible - presence.amp) * k
  presence.vit += (vitCible - presence.vit) * k
  // l'ONDULATION de l'abandon : un court répit et le contour se met à
  // onduler franchement (le shader la dessine) — un geste, et elle s'efface
  const ondCible = idle.t > 1.5 ? 1 : 0
  presence.ondule +=
    (ondCible - presence.ondule) * (1 - Math.exp(-2.0 * dtReal))
  // 3. le FRISSON : armé hors du froid, déclenché quand il saisit
  if (sim.froidFrac < 0.05) presence.armeFrisson = true
  if (presence.armeFrisson && sim.froidFrac >= 0.18) {
    presence.armeFrisson = false
    presence.t0Frisson = elapsed
  }
  // le frisson de RÉVEIL, à son instant tiré au sort
  if (
    reveil.actif &&
    !reveil.frissonFait &&
    reveil.frissonT >= 0 &&
    tReveil >= reveil.frissonT
  ) {
    reveil.frissonFait = true
    presence.t0Frisson = elapsed
  }
  const dtF = elapsed - presence.t0Frisson
  presence.frisson = dtF >= 0 && dtF < 1 ? Math.exp(-dtF * 3.4) : 0
}

// ---- HUD : les instruments emportés, et la bonbonne qui se VERSE ----
const hudInstrChip = document.getElementById(
  'hud-instr-chip',
) as HTMLButtonElement
const hudInstr = document.getElementById('hud-instr') as HTMLElement
const instrPanel = document.getElementById('instr-panel') as HTMLDivElement
/** La pastille montre les icônes emportées ; le panneau donne le détail. */
function majInstrumentsUI(): void {
  if (!hudInstrChip) return
  const defs = run.instruments
    .map((id) => carteDef(id))
    .filter((d): d is NonNullable<typeof d> => d !== null)
  hudInstr.textContent =
    defs.length > 0 ? defs.map((d) => d.icone).join('') : '—'
  if (instrPanel) {
    instrPanel.innerHTML =
      `<h4>INSTRUMENTS EMBARQUÉS</h4>` +
      (defs.length === 0
        ? `<p class="ip-vide">Aucun pour l'instant — les paliers d'étalonnage (XP) ouvrent les tirages.</p>`
        : defs
            .map(
              (d) =>
                `<div class="ip-row"><span class="ip-ico">${d.icone}</span><div><b>${d.nom}</b><small>${d.desc}</small></div></div>`,
            )
            .join('')) +
      `<p class="ip-note">valables jusqu'à la fin de la run</p>`
  }
}
hudInstrChip?.addEventListener('click', () => {
  if (instrPanel) instrPanel.hidden = !instrPanel.hidden
})
instrPanel?.addEventListener('click', () => {
  instrPanel.hidden = true
})

/** VERSER LA BONBONNE : la réserve se reverse dans le corps, en jeu — même
 * non pleine. Le corps se regonfle jusqu'à son volume de départ ; l'état
 * liquide est requis (la glace n'absorbe pas, le nuage disperserait). */
function verserBonbonne(): string {
  // AU HUB, la réserve est INFINIE et le versement y est admis : on ne
  // s'assèche pas chez soi, et perdre un corps en allant parler au marchand
  // n'a aucun intérêt de jeu. Ailleurs, le contexte refuse comme avant.
  const illimitee = bonbonneIllimitee(auHub)
  if ((auHub && !illimitee) || testLevel || miseEnBonbonne || sim.dispersed)
    return 'contexte'
  if (input.paused || run.ended || run.exitTimer > 0) return 'pause'
  if (input.freezeIntent || input.gasIntent) return 'etat'
  const manque = Math.max(0, level.spawn.n - sim.playerCount)
  const nParts = illimitee
    ? manque
    : Math.min(
        manque,
        Math.floor(run.bonbonneLiters / params.litersPerParticle),
      )
  if (nParts < 1) return 'rien'
  // le versement s'installe dans les CREUX autour du corps (jamais sur les
  // particules en place) : poser au centroïde faisait exploser la densité —
  // la bonbonne ne se débite que de ce qui a réellement trouvé sa place
  const poses = sim.verserAuCorps(
    sim.stats.centroidX,
    sim.stats.centroidY,
    nParts,
    KIND_PLAYER,
  )
  if (poses < 1) return 'rien'
  // une réserve infinie ne se débite pas — sinon la jauge du hub tomberait
  // à zéro en montrant « ∞ »
  if (!illimitee)
    run.bonbonneLiters = Math.max(
      0,
      run.bonbonneLiters - poses * params.litersPerParticle,
    )
  sim.relabel()
  bande.ponctuation('sting-collecte', 0.5)
  bonbonneEl.classList.add('ouvert')
  window.setTimeout(() => bonbonneEl.classList.remove('ouvert'), 600)
  return 'ok'
}
/** LE GESTE COMPLET : verser, et DIRE ce qui s'est passé — au toucher, à la
 *  touche V ou à la croix HAUT de la manette. Sans un mot, un refus (corps
 *  plein, état glace, réserve vide) passait pour un bouton mort. */
/** Ce bouton-ci vient-il d'être pressé POUR CETTE MANŒUVRE ? La table des
 *  commandes donne l'index (redéfini ou d'origine) ; sans bouton assigné,
 *  la manœuvre n'a pas de geste manette et la réponse est non. */
function manetteFait(id: string): boolean {
  const b = boutonDe(id)
  return b !== null && manette.edge(b)
}

function verseEtDis(): void {
  const r = verserBonbonne()
  bbMot(
    r === 'ok'
      ? 'réserve versée'
      : r === 'rien'
        ? run.bonbonneLiters < params.litersPerParticle
          ? 'réserve vide'
          : 'le corps est déjà plein'
        : r === 'etat'
          ? 'seulement en LIQUIDE'
          : r === 'pause'
            ? 'pas maintenant'
            : 'pas ici',
    r === 'ok',
  )
}
let bbMotTimer = 0
/** Le mot sous la fiole : deux secondes, puis il s'efface. */
function bbMot(texte: string, bon: boolean): void {
  const e = document.getElementById('bb-mot')
  if (!e) return
  e.textContent = texte
  e.classList.toggle('bb-non', !bon)
  e.classList.add('visible')
  window.clearTimeout(bbMotTimer)
  bbMotTimer = window.setTimeout(() => e.classList.remove('visible'), 2200)
}
// le toucher sur la fiole : le même geste — et il ne file JAMAIS au jeu
// derrière (un clic à côté coûtait une goutte : la cible s'est élargie)
bonbonneEl?.addEventListener('pointerdown', (e) => e.stopPropagation())
bonbonneEl?.addEventListener('click', (e) => {
  e.stopPropagation()
  verseEtDis()
})
input.onVerser = verseEtDis
// LES MANŒUVRES D'ÉCRAN : la table des commandes les nomme, le jeu les
// exécute — c'est le même chemin pour la touche d'origine et pour celle
// que le joueur a redéfinie.
// ---- L'ÉCRAN DES COMMANDES : redéfinir touches et boutons ---------------
// Une ligne par manœuvre, deux cases : la touche et le bouton. On clique la
// case, l'écran ÉCOUTE (le clavier en capture, la manette au sondage), et le
// premier appui devient la commande. ÉCHAP annule, ⌫ efface. La commande est
// exclusive : si elle servait ailleurs, elle y est libérée — et l'écran le
// dit, pour qu'on ne cherche pas ensuite pourquoi un geste a disparu.
const touchesEl = el('touches')
const touchesListe = el('touches-liste')
const touchesAide = el('touches-aide')
const touchesSouris = el('touches-souris') as HTMLInputElement
const AIDE_TOUCHES =
  'Cliquez une case, puis appuyez sur la touche ou le bouton voulu. ÉCHAP annule ; ⌫ efface la commande.'
let ecouteCase: { id: string; quoi: 'clavier' | 'manette' } | null = null

function litTouches(): void {
  touchesSouris.checked = sourisInverse()
  let html = ''
  for (const sec of sectionsCommandes()) {
    html += `<div class="tch-sec">${sec.titre}</div>`
    html +=
      '<div class="tch-tete"><span>manœuvre</span><span>clavier</span><span>manette</span></div>'
    for (const m of sec.manoeuvres) {
      const t = nomTouche(toucheDe(m.id))
      const b = nomBouton(boutonDe(m.id))
      const chg = commandeRedefinie(m.id) ? ' tch-change' : ''
      const fixe = m.fixe
        ? ' disabled title="commande fixe : elle ouvre et ferme les écrans"'
        : ''
      html +=
        `<div class="tch-ligne"><div class="tch-nom">${m.nom}<small>${m.aide}</small></div>` +
        `<button type="button" class="tch-case${chg}" data-tch="${m.id}" data-quoi="clavier"${fixe}>${t}</button>` +
        `<button type="button" class="tch-case${chg}" data-tch="${m.id}" data-quoi="manette"${fixe}>${b}</button></div>`
    }
  }
  touchesListe.innerHTML = html
  for (const b of Array.from(
    touchesListe.querySelectorAll<HTMLButtonElement>('.tch-case'),
  )) {
    b.addEventListener('click', () => {
      if (b.disabled) return
      ecouteCase = {
        id: b.dataset.tch ?? '',
        quoi: (b.dataset.quoi as 'clavier' | 'manette') ?? 'clavier',
      }
      for (const x of Array.from(touchesListe.querySelectorAll('.tch-case')))
        x.classList.remove('tch-ecoute')
      b.classList.add('tch-ecoute')
      b.textContent = ecouteCase.quoi === 'clavier' ? 'appuyez…' : 'un bouton…'
      if (ecouteCase.quoi === 'manette') armeSondeManette()
      else arreteSondeManette()
      touchesAide.textContent =
        ecouteCase.quoi === 'clavier'
          ? 'Appuyez sur la touche voulue (ÉCHAP annule, ⌫ efface).'
          : 'Appuyez sur le bouton de la manette (ÉCHAP annule, ⌫ efface).'
    })
  }
}

// L'ÉCOUTE D'UN BOUTON a son propre sondage (16 ms) : quand un panneau est
// ouvert, la boucle d'images du jeu se met en veille — attendre une image
// pour lire la manette, c'est attendre indéfiniment.
let sondeEcoute = 0
let etatBoutons: boolean[] = []
function armeSondeManette(): void {
  arreteSondeManette()
  etatBoutons = []
  sondeEcoute = window.setInterval(() => {
    if (!ecouteCase || ecouteCase.quoi !== 'manette' || touchesEl.hidden) return
    const pads = navigator.getGamepads?.() ?? []
    const gp = [...pads].find((g) => g?.connected)
    if (!gp) return
    for (let i = 0; i < gp.buttons.length && i < 16; i++) {
      const b = gp.buttons[i]
      const p = !!b && (b.pressed || b.value > 0.5)
      if (p && !etatBoutons[i]) {
        etatBoutons[i] = p
        poseCommande(i)
        return
      }
      etatBoutons[i] = p
    }
  }, 16)
}
function arreteSondeManette(): void {
  if (sondeEcoute) window.clearInterval(sondeEcoute)
  sondeEcoute = 0
}

/** Termine l'écoute : pose la commande (ou l'annule) et redessine. */
function poseCommande(valeur: string | number | null, annule = false): void {
  const c = ecouteCase
  ecouteCase = null
  arreteSondeManette()
  if (!c) return
  if (!annule) {
    const libere = redefinisCommande(c.id, c.quoi, valeur)
    touchesAide.textContent = libere
      ? `Commande posée — elle a été libérée de « ${MANOEUVRES.find((m) => m.id === libere)?.nom ?? libere} ».`
      : 'Commande posée.'
  } else {
    touchesAide.textContent = AIDE_TOUCHES
  }
  litTouches()
}

// le CLAVIER de l'écoute : en capture, avant tout le reste du jeu
window.addEventListener(
  'keydown',
  (e) => {
    if (!ecouteCase || touchesEl.hidden) return
    e.preventDefault()
    e.stopPropagation()
    if (e.key === 'Escape') return poseCommande(null, true)
    if (e.key === 'Backspace' || e.key === 'Delete') return poseCommande(null)
    if (ecouteCase.quoi === 'clavier') poseCommande(e.key)
  },
  true,
)
;(
  window as unknown as {
    __commandes: {
      touche: (id: string) => string | null
      bouton: (id: string) => number | null
      action: (t: string) => string | null
      redefinis: typeof redefinisCommande
      reinitialise: typeof reinitialiseCommandes
    }
  }
).__commandes = {
  touche: toucheDe,
  bouton: boutonDe,
  action: actionDeTouche,
  redefinis: redefinisCommande,
  reinitialise: reinitialiseCommandes,
}

el('params-touches')?.addEventListener('click', () => {
  touchesEl.hidden = false
  touchesAide.textContent = AIDE_TOUCHES
  litTouches()
})
el('touches-fermer')?.addEventListener('click', () => {
  ecouteCase = null
  arreteSondeManette()
  touchesEl.hidden = true
})
touchesEl.addEventListener('pointerdown', (e) => {
  if (e.target === touchesEl) {
    ecouteCase = null
    touchesEl.hidden = true
  }
})
touchesSouris.addEventListener('change', () => {
  poseSourisInverse(touchesSouris.checked)
  touchesAide.textContent = touchesSouris.checked
    ? 'Souris inversée : le clic DROIT éjecte, le GAUCHE attrape la caméra.'
    : 'Souris standard : le clic GAUCHE éjecte, le DROIT attrape la caméra.'
})
el('touches-defaut')?.addEventListener('click', () => {
  reinitialiseCommandes()
  touchesSouris.checked = false
  touchesAide.textContent = 'Toutes les commandes sont revenues à l’origine.'
  litTouches()
})

input.onCommande = (id: string): boolean => {
  if (id === 'legende') toggleLegend()
  else if (id === 'etats') toggleStates()
  else if (id === 'dossier') ouvreDossier(!dossierOuvert)
  else if (id === 'recadrer') camera.resetAutoZoom()
  else return false
  return true
}
// Sonde de test : verser depuis la console (comme __sim, __run)
;(window as unknown as { __verser: () => string }).__verser = verserBonbonne
/** La cérémonie avec un surplus factice — la sonde __bonbonne et le
 * PUPITRE D'ESSAIS passent tous deux par ici. */
// VALIDER LA SALLE EN COURS (outil de conception). Rien n'est simulé : on
// déclare le sas franchi, et c'est le VRAI chemin de fin de salle qui se
// déroule — surplus réellement compté, records consignés, condensat versé,
// rang de la descente creusé, cérémonie ouverte. Une cérémonie simulée
// (boutons voisins) ne fait rien de tout cela : elle ne sert qu'à regarder
// l'écran couler.
let forceSas = false
function valideSalleCourante(): string {
  if (!hasPlayed) return 'menu'
  if (auHub) return 'hub'
  if (miseEnBonbonne || run.ended) return 'deja'
  if (sim.dispersed) return 'disperse'
  forceSas = true
  return 'ok'
}

// PASSER LE HUB (outil de conception). Le hub est un tableau comme un
// autre pour le concepteur — sauf qu'il faut le TRAVERSER À LA NAGE
// jusqu'au bon sas, et que le sas n'est pas un détail de trajet : c'est
// lui qui décide du mode de descente (l'expédition écrite par le sas
// principal, LA VOIE par le givre, LA DESCENTE DU JOUR par la vapeur).
// Comme pour la salle, rien n'est simulé : on lève un drapeau, et c'est
// le VRAI chemin de sortie qui se déroule à l'image suivante — même
// cinématique, même son, même reprise de sauvegarde.
// Le type porte les trois portes ; seul le sas principal est câblé au
// panneau pour l'instant (les deux gardées coûteront un bouton chacune).
let forceSortieHub: 'principal' | 'givre' | 'vapeur' | null = null
function passeLeHub(sortie: 'principal' | 'givre' | 'vapeur'): string {
  if (!hasPlayed) return 'menu'
  if (!auHub) return 'dehors'
  if (sim.dispersed) return 'disperse'
  forceSortieHub = sortie
  return 'ok'
}

// Arme l'Économat pour la prochaine salle. Rien n'est déplacé tout de
// suite : c'est la traversée suivante qui l'intercale, comme le ferait la
// mi-descente — le chemin est le vrai, seul le déclenchement est forcé.
function appelleEconomat(): string {
  if (testLevel) return 'essai'
  if (estEconomat(level)) return 'dedans'
  economatForce = true
  return auHub ? 'hub' : 'ok'
}

function simuleBonbonne(surplus = 2): void {
  montreMiseEnBonbonne({
    surplus,
    prime: 0,
    pct: Math.min(1, surplus / 4),
    temps: 61.2,
    newVolume: false,
    newChrono: false,
    recVol: '',
    recChr: '',
    note: 0,
    gainCl: Math.round(surplus * 10),
    totalCl: condensat,
  })
}
// Sonde de test : la cérémonie depuis la console — __bonbonne(2.5) ouvre la
// mise en bonbonne avec un surplus factice, pour regarder la jauge couler
;(window as unknown as { __bonbonne: (surplus?: number) => void }).__bonbonne =
  simuleBonbonne

// ---- LE PUPITRE D'ESSAIS : les événements du jeu, simulés au doigt ----
// La console navigateur n'existe ni sur Steam Deck ni sur mobile : le
/** Le réglage système « moins d'animations » : la mise en scène du tirage
 * se saute, le jeu reste jouable au même rythme. */
function sansAnimation(): boolean {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// ---- LA CARTE DE RÉCOMPENSE : un seul dessin, trois emplois ----
// L'atelier (vignette), le tirage de fin de salle (draft) et l'aperçu
// vivant de la forge passent tous par `carteHTML`. Ce que le concepteur
// fabrique a donc EXACTEMENT la tête de ce que le joueur tire — c'est ce
// qui fait de l'atelier autre chose qu'une maquette.
// Contenu en phrasing pur (span/b/em/i) : la carte du tirage est un
// <button>, qui n'admet ni <p> ni <ul>.

const FAMILLE_TEINTE: Record<string, string> = {
  corps: '#63b7e6',
  etats: '#f2c98e',
  collecte: '#6dffb8',
  protocole: '#c99aff',
}
const CALIBRE_MOT: Record<string, string> = {
  commun: 'Commun',
  notable: 'Notable',
  majeur: 'Majeur',
}
// les noms de famille en court : sur une carte, « Le corps et sa matière »
// mange la ligne et répète le titre de la rangée
const FAMILLE_COURT: Record<string, string> = {
  corps: 'Corps',
  etats: 'États',
  collecte: 'Collecte',
  protocole: 'Protocole',
}

/** La valeur d'un effet, en clair : « +40 % », « −20 % », « +1 ». Jamais
 * « ×0,8 » — un joueur ne lit pas un facteur. */
function valeurEffetLisible(e: { levier: string; valeur: number }): string {
  const l = levierDef(e.levier)
  if (!l) return ''
  if (l.mode === 'add') {
    // un levier additif dont le PAS est sous l'unité compte en points de
    // rendement, pas en unités : « +0,35 » ne veut rien dire, « +35 pts » si
    const v = l.pas < 1 ? Math.round(e.valeur * 100) : e.valeur
    const unite = l.pas < 1 ? ' pts' : ''
    return `${v > 0 ? '+' : '−'}${Math.abs(v)}${unite}`
  }
  const pct = Math.round((e.valeur - 1) * 100)
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)} %`
}

interface CarteOpts {
  variante: 'vignette' | 'draft' | 'apercu'
  /** Déjà embarquée dans la run en cours. */
  tenue?: boolean
  /** Prix en condensat (tirage) : 0 = offerte, undefined = pas de prix. */
  prix?: number
  /** HTML des boutons d'action, glissé dans le pied (atelier). */
  actions?: string
  /** Rendu en <button> (tirage) plutôt qu'en <div>. */
  bouton?: boolean
  /** Attributs supplémentaires sur l'élément racine. */
  attrs?: string
}

/** Le dessin complet d'une carte, prêt à coller dans un innerHTML. */
function carteHTML(d: InstrumentDef, o: CarteOpts): string {
  const fams = famillesInstrument(d)
  const t1 = FAMILLE_TEINTE[fams[0] ?? 'corps'] ?? '#63b7e6'
  const t2 = FAMILLE_TEINTE[fams[1] ?? fams[0] ?? 'corps'] ?? t1
  const cal = calibreInstrument(d)
  const ctr = aContrepartie(d)
  const rang =
    `${CALIBRE_MOT[cal]} · ` +
    fams.map((f) => FAMILLE_COURT[f] ?? f).join(' + ')
  const effets = d.effets
    .map((e) => {
      const l = levierDef(e.levier)
      if (!l) return ''
      const prix = sensEffet(e) < 0
      return (
        `<span class="eff${prix ? ' eff-prix' : ''}">` +
        `<i>${htmlSafe(l.nom)}</i><em>${valeurEffetLisible(e)}</em>` +
        `<span class="eff-jauge" style="--f:${forceEffet(e).toFixed(2)}"></span>` +
        `</span>`
      )
    })
    .join('')
  const pied: string[] = []
  if (o.tenue) pied.push('<i class="crt-tenue">EN POCHE</i>')
  if (d.perso) pied.push('<i class="crt-perso">ATELIER</i>')
  if (o.prix !== undefined)
    pied.push(
      o.prix > 0
        ? `<em class="crt-prix">${o.prix} cL</em>`
        : `<em class="crt-prix crt-offert">offert</em>`,
    )
  if (o.actions) pied.push(`<span class="crt-actions">${o.actions}</span>`)
  const cls =
    `crt crt-${o.variante} cal-${cal}` +
    (ctr ? ' a-contrepartie' : '') +
    (d.perso ? ' crt-perso-c' : '')
  const balise = o.bouton ? 'button' : 'div'
  return (
    `<${balise} class="${cls}" style="--fam:${t1};--fam2:${t2}"${o.bouton ? ' type="button"' : ''}${o.attrs ?? ''}>` +
    `<span class="crt-halo"></span>` +
    `<span class="crt-tete"><i class="crt-ico">${htmlSafe(d.icone)}</i>` +
    `<span class="crt-titres"><b class="crt-nom">${htmlSafe(d.nom)}</b>` +
    `<i class="crt-rang">${htmlSafe(rang)}</i></span></span>` +
    `<span class="crt-txt">${htmlSafe(descriptionInstrument(d))}</span>` +
    (ctr ? `<span class="crt-ctr">CONTREPARTIE</span>` : '') +
    `<span class="crt-effets">${effets}</span>` +
    (pied.length ? `<span class="crt-pied">${pied.join('')}</span>` : '') +
    `</${balise}>`
  )
}

// ---- L'ÉCRAN DES TEXTES : relire ET RÉÉCRIRE le lore d'un seul endroit ----
// Le catalogue (src/textes/catalogue.ts) parcourt les modules et rend une
// liste plate à clés — c'est la SOURCE, elle vient du code. L'atelier
// (src/textes/atelier.ts) pose par-dessus les retouches du concepteur,
// rangées par langue.
//
// Réécrire et traduire sont le même geste : une retouche française
// remplace la source, une entrée anglaise remplit un vide. Même écran,
// même stockage, même export — et ajouter une langue ne demandera qu'une
// ligne dans LANGUES.
const textesEl = document.getElementById('textes') as HTMLDivElement
let txFiltre: DomaineTexte | 'tout' = 'tout'
let txQuete = ''
/**
 * LA LANGUE REGARDÉE EST CELLE DU JEU. Il n'y a pas deux réglages : basculer
 * sur ENGLISH ici met le jeu en anglais — c'est ce qui rend la traduction
 * jouable au lieu de rester un tableur. L'écran et le jeu la RENDENT
 * différemment, et c'est voulu : l'écran laisse voir les trous, le jeu les
 * bouche avec le français (src/textes/lecture.ts).
 */
const txLangue = (): Langue => langueLue()
let txSaisie: string | null = null // la clé en cours d'édition, s'il y en a une

function txDit(msg: string): void {
  const el = document.getElementById('tx-etat')
  if (el) el.textContent = msg
}

/** Le catalogue vu dans la langue du moment. */
function txToutes(): EntreeLangue[] {
  return applique(catalogueTextes(), txLangue())
}

/** Les entrées qui passent le filtre et la recherche du moment. */
function txRetenues(): EntreeLangue[] {
  const q = txQuete.trim().toLowerCase()
  return txToutes().filter((e) => {
    if (txFiltre !== 'tout' && e.domaine !== txFiltre) return false
    if (!q) return true
    // on cherche dans le TEXTE, la SOURCE, la CLÉ et le LIEU : « où ai-je
    // écrit ça ? » et « qu'est-ce qui parle du sas ? » sont la même
    // question ici — et en traduisant, on cherche dans le français
    return (
      e.texte.toLowerCase().includes(q) ||
      e.source.toLowerCase().includes(q) ||
      e.cle.toLowerCase().includes(q) ||
      e.ou.toLowerCase().includes(q)
    )
  })
}

/** Le passage cherché, surligné — sans jamais laisser passer de balise. */
function txSurligne(texte: string, q: string): string {
  const sur = htmlSafe(texte)
  if (!q) return sur
  const cible = htmlSafe(q)
  const i = sur.toLowerCase().indexOf(cible.toLowerCase())
  if (i < 0) return sur
  return (
    sur.slice(0, i) +
    `<mark>${sur.slice(i, i + cible.length)}</mark>` +
    sur.slice(i + cible.length)
  )
}

function renderTxLangues(): void {
  const host = document.getElementById('tx-langues')
  if (!host) return
  host.innerHTML = LANGUES.map((l) => {
    const a = avance(applique(catalogueTextes(), l.code))
    // la langue SOURCE n'a pas d'avancement à montrer (tout y est écrit) :
    // on y compte les RETOUCHES, ce qui n'est pas la même promesse
    const chiffre = l.source ? `${a.faits} retouches` : `${a.faits} / ${a.total}`
    return (
      `<button type="button" class="tx-lg${l.code === txLangue() ? ' on' : ''}"` +
      ` title="Affiche le catalogue ET LE JEU dans cette langue` +
      `${l.source ? '' : ' — un texte non traduit y reste en français'}"` +
      ` data-lg="${l.code}">${htmlSafe(l.nom.toUpperCase())}<i>${chiffre}</i></button>`
    )
  }).join('')
}

function renderTxFiltres(): void {
  const host = document.getElementById('tx-filtres')
  if (!host) return
  const cat = txToutes()
  const chips = [
    { cle: 'tout' as const, mot: 'Tout', n: cat.length },
    ...comptesParDomaine(cat).map((c) => ({
      cle: c.domaine,
      mot: c.nom,
      n: c.entrees,
    })),
  ]
  // une pastille grisée : le domaine se retouche, mais le JEU ne le lit pas
  // encore — la bascule se fait domaine par domaine, et il vaut mieux le
  // dire que laisser réécrire dans le vide
  host.innerHTML = chips
    .map((c) => {
      const lu = c.cle === 'tout' || DOMAINES_LUS.has(c.cle)
      return (
        `<button type="button" class="tx-chip${c.cle === txFiltre ? ' on' : ''}` +
        `${lu ? '' : ' pas-lu'}" data-dom="${c.cle}"` +
        ` title="${
          lu
            ? 'Le jeu affiche ces textes tels que vous les écrivez ici'
            : 'Pas encore branché : vos retouches sont gardées et exportables, mais le jeu affiche encore le texte du code'
        }">${htmlSafe(c.mot.toUpperCase())} · ${c.n}${lu ? '' : ' °'}</button>`
      )
    })
    .join('')
}

const TX_ETAT_MOT: Record<EtatTexte, string> = {
  origine: '',
  retouche: 'RETOUCHÉ',
  traduit: 'TRADUIT',
  'a-traduire': 'À TRADUIRE',
}

function renderTextes(): void {
  const host = document.getElementById('tx-liste')
  if (!host) return
  const toutes = txToutes()
  const a = avance(toutes)
  const mets = (id: string, v: string): void => {
    const el = document.getElementById(id)
    if (el) el.textContent = v
  }
  mets('tx-n-entrees', String(a.total))
  mets('tx-n-faits', String(a.faits))
  mets('tx-n-signes', String(a.signes))
  const vues = txRetenues()
  if (vues.length === 0) {
    host.innerHTML = `<p class="tx-vide">Rien ne répond à « ${htmlSafe(txQuete)} ». La recherche va dans le texte, la source, la clé et le lieu.</p>`
    return
  }
  const q = txQuete.trim()
  const estSource = txLangue() === LANGUE_SOURCE
  let out = ''
  for (const c of comptesParDomaine(vues)) {
    const lot = vues.filter((e) => e.domaine === c.domaine)
    out +=
      `<div class="tx-fam">${htmlSafe(c.nom.toUpperCase())}` +
      `<small>${c.entrees} entrées</small>` +
      (DOMAINES_LUS.has(c.domaine)
        ? `<small class="tx-lu">lu par le jeu</small>`
        : `<small class="tx-pas-lu">pas encore lu par le jeu</small>`) +
      `</div>`
    for (const e of lot) {
      const mot = TX_ETAT_MOT[e.etat]
      const vide = e.texte.length === 0
      out +=
        `<article class="tx-e ${e.etat}${e.engendre ? ' engendre' : ''}" data-cle="${htmlSafe(e.cle)}">` +
        `<div class="tx-e-tete"><code class="tx-cle">${htmlSafe(e.cle)}</code>` +
        `<span class="tx-ou">${htmlSafe(e.ou)}</span>` +
        (e.engendre ? `<i class="tx-tag">ENGENDRÉE PAR LE CODE</i>` : '') +
        (mot ? `<i class="tx-etat-tag">${mot}</i>` : '') +
        (e.etat === 'retouche' || e.etat === 'traduit'
          ? `<button type="button" class="tx-defaire" data-defaire="${htmlSafe(e.cle)}">rendre à la source</button>`
          : '') +
        `</div>` +
        `<p class="tx-t${vide ? ' vide' : ''}" data-edit="${htmlSafe(e.cle)}">` +
        (vide ? 'à traduire — cliquez pour écrire' : txSurligne(e.texte, q)) +
        `</p>` +
        // en traduction, le français reste sous les yeux : on n'écrit pas
        // une langue en se souvenant de l'autre
        (!estSource
          ? `<p class="tx-src">${txSurligne(e.source, q)}</p>`
          : '') +
        `</article>`
    }
  }
  host.innerHTML = out
  if (txSaisie) txOuvreSaisie(txSaisie)
}

/** Le texte devient une zone de saisie, sur place. Une seule à la fois. */
function txOuvreSaisie(cle: string): void {
  const p = document.querySelector<HTMLElement>(`.tx-t[data-edit="${CSS.escape(cle)}"]`)
  if (!p) return
  const e = txToutes().find((x) => x.cle === cle)
  if (!e) return
  txSaisie = cle
  const ta = document.createElement('textarea')
  ta.className = 'tx-saisie'
  ta.value = e.texte
  ta.rows = Math.max(2, Math.min(14, e.texte.split('\n').length + 1))
  const aide = document.createElement('p')
  aide.className = 'tx-aide-saisie'
  aide.textContent =
    'Entrée pour un retour à la ligne · Échap pour annuler · cliquer ailleurs pour garder'
  p.replaceWith(ta)
  ta.after(aide)
  ta.focus()
  ta.setSelectionRange(ta.value.length, ta.value.length)
  let annule = false
  ta.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      annule = true
      ta.blur()
    }
  })
  ta.addEventListener('blur', () => {
    txSaisie = null
    if (!annule) {
      poseTexte(txLangue(), cle, ta.value, e.source)
      txDit(
        `« ${cle} » enregistré sur ce poste` +
          `${DOMAINES_LUS.has(e.domaine) ? ' — et déjà visible en jeu' : ''}. ` +
          `Exportez pour le graver dans le dépôt.`,
      )
    }
    renderTxLangues()
    renderTextes()
  })
}

function ouvreTextes(): void {
  textesEl.hidden = false
  renderTxLangues()
  renderTxFiltres()
  renderTextes()
  const lus = [...DOMAINES_LUS].map((d) => DOMAINE_NOMS[d].toLowerCase())
  txDit(
    `Cliquez un texte pour le réécrire — ${lus.join(', ')} : ce que vous écrivez ` +
      `PARAÎT EN JEU tout de suite. Les autres domaines attendent leur bascule. ` +
      `Dans tous les cas les retouches vivent SUR CE POSTE : exportez-les pour ` +
      `qu’elles soient gravées dans le dépôt.`,
  )
}
document.getElementById('home-textes')?.addEventListener('click', ouvreTextes)
document.getElementById('textes-fermer')?.addEventListener('click', () => {
  textesEl.hidden = true
})
document.getElementById('tx-langues')?.addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest('button')
  const l = b?.dataset.lg
  if (!l || !langueDef(l)) return
  poseLangueLue(l as Langue)
  txSaisie = null
  renderTxLangues()
  renderTxFiltres()
  renderTextes()
})
document.getElementById('tx-filtres')?.addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest('button')
  const d = b?.dataset.dom
  if (!d) return
  txFiltre = d as DomaineTexte | 'tout'
  renderTxFiltres()
  renderTextes()
})
document.getElementById('tx-q')?.addEventListener('input', (ev) => {
  txQuete = (ev.target as HTMLInputElement).value
  renderTextes()
})
document.getElementById('tx-liste')?.addEventListener('click', (ev) => {
  const cible = ev.target as HTMLElement
  const rendre = cible.closest<HTMLElement>('[data-defaire]')?.dataset.defaire
  if (rendre) {
    retireTexte(txLangue(), rendre)
    txDit(`« ${rendre} » rendu à la source.`)
    renderTxLangues()
    renderTextes()
    return
  }
  const cle = cible.closest<HTMLElement>('[data-edit]')?.dataset.edit
  if (cle && cle !== txSaisie) txOuvreSaisie(cle)
})
// L'EXPORT : le Markdown se lit et s'annote ; l'export de RETOUCHES est ce
// qu'on rend pour graver dans le code, ou ce qu'un traducteur renvoie.
document.getElementById('tx-md')?.addEventListener('click', () => {
  const t = catalogueMarkdown(txRetenues())
  void copieTexte(t).then((ok: boolean) =>
    txDit(
      ok
        ? `Markdown copié — ${txRetenues().length} entrées, clés comprises.`
        : 'Presse-papier refusé — le Markdown est dans la console (F12).',
    ),
  )
})
document.getElementById('tx-exp')?.addEventListener('click', () => {
  const a = avance(txToutes())
  if (a.faits === 0) {
    txDit('Aucune retouche dans cette langue : rien à exporter.')
    return
  }
  void copieTexte(exporteTextes(txLangue())).then((ok: boolean) =>
    txDit(
      ok
        ? `${a.faits} retouche(s) copiée(s) en ${txLangue().toUpperCase()} — collez-les-moi pour que je les grave.`
        : 'Presse-papier refusé — l’export est dans la console (F12).',
    ),
  )
})
document.getElementById('tx-imp')?.addEventListener('click', () => {
  const ta = document.getElementById('tx-io') as HTMLTextAreaElement
  ta.hidden = false
  if (!ta.value.trim()) {
    ta.placeholder = 'Collez un export de retouches ici, puis reprenez ce bouton.'
    ta.focus()
    txDit('Collez un export dans la zone, puis reprenez « Importer ».')
    return
  }
  const r = importeTextes(ta.value)
  if (r.repris < 0) {
    txDit('Ce n’est pas un export lisible (il lui faut une langue et des textes).')
    return
  }
  if (r.langue) poseLangueLue(r.langue)
  ta.value = ''
  ta.hidden = true
  renderTxLangues()
  renderTxFiltres()
  renderTextes()
  txDit(`${r.repris} texte(s) repris en ${String(r.langue).toUpperCase()}.`)
})

// ---- L'ATELIER DES RÉCOMPENSES ----
// Un écran pour VOIR le catalogue (ce que chaque carte tire comme levier,
// livrée ou fabriquée), et une forge pour en faire de neuves avec les
// mêmes pièces. Rien n'y est maquette : une carte fabriquée ici entre au
// tirage, s'emporte et agit — c'est le même chemin que les cartes gravées.
const recEl = document.getElementById('recompenses') as HTMLDivElement
let recEffetsForme: { levier: string; valeur: number }[] = []
let recEdite: string | null = null // l'identifiant en cours de retouche
let recFiltre = 'tout'

function recDit(msgs: string[], bon = false): void {
  const el = document.getElementById('rec-refus')
  if (!el) return
  el.classList.toggle('bon', bon)
  el.innerHTML = msgs.map((m) => htmlSafe(m)).join('<br>')
}

/** Les chips de tri : d'abord la provenance, puis les quatre familles. */
const AT_FILTRES: { cle: string; mot: string; teinte?: string }[] = [
  { cle: 'tout', mot: 'Toutes' },
  { cle: 'atelier', mot: 'Atelier', teinte: '#8fd8c8' },
  { cle: 'poche', mot: 'En poche', teinte: '#6dffb8' },
  { cle: 'corps', mot: FAMILLE_NOMS.corps, teinte: FAMILLE_TEINTE.corps },
  { cle: 'etats', mot: FAMILLE_NOMS.etats, teinte: FAMILLE_TEINTE.etats },
  {
    cle: 'collecte',
    mot: FAMILLE_NOMS.collecte,
    teinte: FAMILLE_TEINTE.collecte,
  },
  {
    cle: 'protocole',
    mot: FAMILLE_NOMS.protocole,
    teinte: FAMILLE_TEINTE.protocole,
  },
]

function renderRecFiltres(): void {
  const host = document.getElementById('at-filtres')
  if (!host) return
  host.innerHTML = AT_FILTRES.map(
    (f) =>
      `<button type="button" class="at-chip${f.cle === recFiltre ? ' on' : ''}"` +
      ` data-filtre="${f.cle}"${f.teinte ? ` style="--fc:${f.teinte}"` : ''}>` +
      `${htmlSafe(f.mot.toUpperCase())}</button>`,
  ).join('')
}

function renderRecCompteurs(): void {
  const mets = (id: string, n: number): void => {
    const el = document.getElementById(id)
    if (el) el.textContent = String(n)
  }
  mets('at-n-livrees', INSTRUMENTS.length)
  mets('at-n-atelier', recompensesPerso().length)
  mets('at-n-poche', run.instruments.length)
}

/** La vitrine : les cartes du catalogue, groupées par FAMILLE de leviers
 * — c'est le rangement qui parle au joueur (« qu'est-ce que ça touche »),
 * pas celui du dépôt (« livrée ou fabriquée »), déjà dit par le liseré. */
function renderRecListe(): void {
  const host = document.getElementById('rec-liste')
  if (!host) return
  renderRecCompteurs()
  const vignette = (d: InstrumentDef): string =>
    carteHTML(d, {
      variante: 'vignette',
      tenue: run.instruments.includes(d.id),
      actions:
        `<button type="button" data-rec-essai="${htmlSafe(d.id)}" title="embarquer tout de suite dans la run en cours">essayer</button>` +
        (d.perso
          ? `<button type="button" data-rec-edit="${htmlSafe(d.id)}" title="reprendre cette carte">✎</button>` +
            `<button type="button" data-rec-sup="${htmlSafe(d.id)}" title="retirer de l’atelier">✕</button>`
          : ''),
    })
  const tout = catalogueRecompenses().filter((d) => {
    if (recFiltre === 'tout') return true
    if (recFiltre === 'atelier') return d.perso === true
    if (recFiltre === 'poche') return run.instruments.includes(d.id)
    return famillesInstrument(d).includes(
      recFiltre as ReturnType<typeof famillesInstrument>[number],
    )
  })
  if (tout.length === 0) {
    host.innerHTML = `<p class="at-vide">Aucune carte ici. Changez de filtre, ou fabriquez-en une : la forge, à droite, part d’un nom et d’un levier.</p>`
    return
  }
  const familles = ['corps', 'etats', 'collecte', 'protocole'] as const
  let out = ''
  for (const fam of familles) {
    // une carte multi-familles paraît sous SA PREMIÈRE famille, pas deux fois
    const lot = tout.filter((d) => famillesInstrument(d)[0] === fam)
    if (lot.length === 0) continue
    out +=
      `<div class="at-fam" style="--fc:${FAMILLE_TEINTE[fam]}">${htmlSafe(FAMILLE_NOMS[fam].toUpperCase())}` +
      `<small>${lot.length}</small></div>` +
      `<div class="at-rangee">${lot.map(vignette).join('')}</div>`
  }
  host.innerHTML = out
}

/** La carte en cours de fabrication, telle que la validation la verra. */
function recBrouillon(): InstrumentDef {
  const lit = (id: string): string =>
    (document.getElementById(id) as HTMLInputElement | null)?.value ?? ''
  const nom = lit('rec-nom').trim()
  return {
    id: recEdite ?? idDepuisNom(nom),
    nom: nom || 'Carte sans nom',
    desc: lit('rec-desc').trim(),
    icone: lit('rec-icone').trim() || '✦',
    effets: recEffetsForme as { levier: LevierId; valeur: number }[],
    perso: true,
  }
}

/** L'APERÇU VIVANT : la carte se dessine pendant qu'on la fabrique, et le
 * verdict dit son rang — le calibre se DÉDUIT, il n'y a rien à saisir. */
function recApercu(): void {
  const boite = document.getElementById('at-apercu-carte')
  const verdict = document.getElementById('rec-apercu')
  const d = recBrouillon()
  if (boite)
    boite.innerHTML =
      d.effets.length === 0
        ? `<p class="at-vide">Posez un levier : la carte se dessinera ici.</p>`
        : carteHTML(d, { variante: 'apercu' })
  if (verdict) {
    if (d.effets.length === 0) verdict.textContent = ''
    else {
      const cal = calibreInstrument(d)
      verdict.textContent =
        `Calibre ${CALIBRE_MOT[cal].toUpperCase()}` +
        (aContrepartie(d) ? ' · à contrepartie' : '') +
        ` · ${famillesInstrument(d)
          .map((f) => FAMILLE_NOMS[f])
          .join(' + ')}`
    }
  }
}

function renderRecEffets(): void {
  const host = document.getElementById('rec-effets')
  if (!host) return
  host.innerHTML = ''
  recEffetsForme.forEach((e, i) => {
    const def = levierDef(e.levier)
    const bloc = document.createElement('div')
    bloc.className = 'at-effet'
    const tete = document.createElement('div')
    tete.className = 'at-effet-tete'
    const sel = document.createElement('select')
    for (const fam of ['corps', 'etats', 'collecte', 'protocole'] as const) {
      const g = document.createElement('optgroup')
      g.label = FAMILLE_NOMS[fam]
      for (const l of LEVIERS.filter((x) => x.famille === fam)) {
        const o = document.createElement('option')
        o.value = l.id
        o.textContent = l.nom
        o.selected = l.id === e.levier
        g.appendChild(o)
      }
      sel.appendChild(g)
    }
    sel.addEventListener('change', () => {
      const l = levierDef(sel.value)
      // à changement de levier, on propose une valeur qui FAIT quelque
      // chose, et qui tombe sur le pas du levier
      recEffetsForme[i] = {
        levier: sel.value,
        valeur: l ? valeurProposee(l) : 1,
      }
      renderRecEffets()
      recApercu()
    })
    const val = document.createElement('input')
    val.type = 'number'
    val.className = 'at-val'
    const glis = document.createElement('input')
    glis.type = 'range'
    if (def) {
      for (const c of [val, glis]) {
        c.min = String(def.min)
        c.max = String(def.max)
        c.step = String(def.pas)
      }
    }
    val.value = String(e.valeur)
    glis.value = String(e.valeur)
    const sup = document.createElement('button')
    sup.type = 'button'
    sup.className = 'at-sup'
    sup.textContent = '✕'
    sup.title = 'retirer cet effet'
    sup.addEventListener('click', () => {
      recEffetsForme.splice(i, 1)
      renderRecEffets()
      recApercu()
    })
    tete.append(sel, val, sup)
    // LA PISTE : la moitié qui AVANTAGE le joueur est teintée en vert, la
    // moitié qui coûte en ambre, et la valeur neutre porte un repère. On
    // voit qu'on franchit la ligne au lieu de le déduire d'un signe.
    const piste = document.createElement('div')
    piste.className = 'at-piste'
    piste.appendChild(glis)
    const phrase = document.createElement('p')
    phrase.className = 'at-phrase'
    const raconte = (): void => {
      const eff = recEffetsForme[i] as { levier: LevierId; valeur: number }
      phrase.textContent = phraseEffet(eff)
      bloc.classList.toggle('eff-prix', sensEffet(eff) < 0)
    }
    if (def) {
      const n = neutre(def)
      const part = Math.max(
        0,
        Math.min(100, ((n - def.min) / (def.max - def.min)) * 100),
      )
      // `bon: +1` : le gain est à DROITE du repère ; `bon: -1` : à gauche
      const gauche =
        def.bon > 0 ? 'rgba(242,201,142,.22)' : 'rgba(109,255,184,.22)'
      const droite =
        def.bon > 0 ? 'rgba(109,255,184,.22)' : 'rgba(242,201,142,.22)'
      piste.style.setProperty('--gsplit', `${part.toFixed(1)}%`)
      piste.style.setProperty('--g1', gauche)
      piste.style.setProperty('--g2', droite)
    }
    const change = (src: HTMLInputElement, autre: HTMLInputElement): void => {
      const v = Number(src.value)
      if (!Number.isFinite(v)) return
      recEffetsForme[i].valeur = v
      autre.value = src.value
      raconte()
      recApercu()
    }
    val.addEventListener('input', () => change(val, glis))
    glis.addEventListener('input', () => change(glis, val))
    raconte()
    bloc.append(tete, piste, phrase)
    host.append(bloc)
  })
}

function recVideForme(): void {
  recEdite = null
  recEffetsForme = []
  for (const id of ['rec-nom', 'rec-icone', 'rec-desc'])
    (document.getElementById(id) as HTMLInputElement).value = ''
  const t = document.getElementById('rec-forge-titre')
  if (t) t.textContent = 'FABRIQUER UNE CARTE'
  renderRecEffets()
  recApercu()
  recDit([])
}

function recReprend(d: InstrumentDef): void {
  recEdite = d.id
  ;(document.getElementById('rec-nom') as HTMLInputElement).value = d.nom
  ;(document.getElementById('rec-icone') as HTMLInputElement).value = d.icone
  ;(document.getElementById('rec-desc') as HTMLInputElement).value = d.desc
  recEffetsForme = d.effets.map((e) => ({ ...e }))
  const t = document.getElementById('rec-forge-titre')
  if (t) t.textContent = `REPRENDRE « ${d.nom.toUpperCase()} »`
  renderRecEffets()
  recApercu()
  recDit([])
  document.querySelector('.at-etabli')?.scrollIntoView({ block: 'nearest' })
}

function ouvreRecompenses(): void {
  recEl.hidden = false
  renderRecFiltres()
  renderRecListe()
  renderRecEffets()
  recApercu()
}
document
  .getElementById('home-recompenses')
  ?.addEventListener('click', ouvreRecompenses)
document.getElementById('recompenses-fermer')?.addEventListener('click', () => {
  recEl.hidden = true
})
// l'aperçu suit la frappe : nom, icône et texte se voient sur la carte
for (const id of ['rec-nom', 'rec-icone', 'rec-desc'])
  document.getElementById(id)?.addEventListener('input', recApercu)
document.getElementById('at-filtres')?.addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest('button')
  const f = b?.dataset.filtre
  if (!f) return
  recFiltre = f
  renderRecFiltres()
  renderRecListe()
})
document.getElementById('rec-ajout-effet')?.addEventListener('click', () => {
  // le premier levier libre : on ne propose jamais deux fois le même sur
  // une carte (deux valeurs pour un même levier ne se liraient pas)
  const pris = new Set(recEffetsForme.map((e) => e.levier))
  const l = LEVIERS.find((x) => !pris.has(x.id))
  if (!l) {
    recDit(['Tous les leviers sont déjà posés sur cette carte.'])
    return
  }
  recEffetsForme.push({ levier: l.id, valeur: valeurProposee(l) })
  renderRecEffets()
  recApercu()
})
document.getElementById('rec-annuler')?.addEventListener('click', recVideForme)
document.getElementById('rec-fabriquer')?.addEventListener('click', () => {
  const nom = (document.getElementById('rec-nom') as HTMLInputElement).value
  const icone = (document.getElementById('rec-icone') as HTMLInputElement).value
  const desc = (document.getElementById('rec-desc') as HTMLInputElement).value
  const refus = poseRecompense(
    {
      id: recEdite ?? idDepuisNom(nom),
      nom,
      icone,
      desc,
      effets: recEffetsForme as { levier: LevierId; valeur: number }[],
    },
    recEdite ?? undefined,
  )
  if (refus.length > 0) {
    recDit(refus)
    return
  }
  const neuve = recEdite === null
  recVideForme()
  renderRecListe()
  recDit(
    [
      neuve
        ? `« ${nom.trim()} » rejoint le catalogue : elle entre au tirage dès la prochaine fin de salle.`
        : `« ${nom.trim()} » est mise à jour.`,
    ],
    true,
  )
})
document.getElementById('rec-exporter')?.addEventListener('click', () => {
  const ta = document.getElementById('rec-json') as HTMLTextAreaElement
  ta.hidden = false
  ta.value = exporteRecompenses()
  ta.select()
  recDit(
    ['Le JSON est prêt : à coller dans instruments.ts pour graver ces cartes.'],
    true,
  )
})
document.getElementById('rec-importer')?.addEventListener('click', () => {
  const ta = document.getElementById('rec-json') as HTMLTextAreaElement
  ta.hidden = false
  if (!ta.value.trim()) {
    recDit(['Collez un export dans la zone, puis reprenez ce bouton.'])
    return
  }
  const n = importeRecompenses(ta.value)
  if (n < 0) {
    recDit(['Ce n’est pas un export lisible.'])
    return
  }
  renderRecListe()
  recDit([`${n} carte(s) reprise(s).`], true)
})
document.getElementById('rec-liste')?.addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest('button')
  if (!b) return
  const essai = b.dataset.recEssai
  const edit = b.dataset.recEdit
  const sup = b.dataset.recSup
  if (essai) {
    const d = carteDef(essai)
    if (!d) return
    const gainVies = valeurLevier(d.effets, 'vies')
    if (gainVies > 0) run.vies = Math.min(VIES_MAX, run.vies + gainVies)
    if (
      d.effets.some((e) => e.levier !== 'vies') &&
      !run.instruments.includes(d.id)
    )
      run.instruments.push(d.id)
    majInstrumentsUI()
    majBoutonsRun()
    // les facteurs se posent au chargement du tableau : on le recharge pour
    // que la carte agisse tout de suite, sans attendre la salle suivante
    if (hasPlayed) restart()
    renderRecListe()
    recDit(
      [`« ${d.nom} » embarquée — le tableau est rechargé pour qu’elle agisse.`],
      true,
    )
  } else if (edit) {
    const d = carteDef(edit)
    if (d) recReprend(d)
  } else if (sup) {
    if (retireRecompense(sup)) {
      const i = run.instruments.indexOf(sup)
      if (i >= 0) run.instruments.splice(i, 1) // plus au catalogue, plus en poche
      majInstrumentsUI()
      renderRecListe()
      recDit(['Carte retirée de l’atelier.'], true)
    }
  }
})

// pupitre est un écran du menu (mode concepteur) qui rejoue les mêmes
// événements en gros boutons — cérémonie, bonbonne, paliers, sons.
const pupitreEl = document.getElementById('pupitre') as HTMLDivElement
let pupDernierMot = ''
function pupDit(msg: string): void {
  pupDernierMot = msg
  const e = document.getElementById('pup-etat')
  if (e) e.textContent = msg
}
document.getElementById('home-pupitre')?.addEventListener('click', () => {
  pupitreEl.hidden = false
  pupDit('')
})
document.getElementById('pupitre-fermer')?.addEventListener('click', () => {
  pupitreEl.hidden = true
})
pupitreEl?.addEventListener('pointerdown', (e) => {
  if (e.target === pupitreEl) pupitreEl.hidden = true
})
/** UNE MANŒUVRE DU PUPITRE, par sa clé (data-pup). Le panneau du menu et le
 *  BANC de réglage l'appellent tous deux : une seule mécanique, deux
 *  poignées. Renvoie le mot que la manœuvre a laissé (le banc l'affiche
 *  dans sa ligne d'aide, faute d'avoir celle du pupitre sous les yeux). */
function actionPupitre(quoi: string): string {
  pupDernierMot = ''
  lanceManoeuvre(quoi)
  return pupDernierMot
}
;(window as unknown as { __pupitre: (c: string) => string }).__pupitre =
  actionPupitre
function lanceManoeuvre(quoi: string): void {
  {
    if (quoi.startsWith('ceremonie-')) {
      pupitreEl.hidden = true
      simuleBonbonne(Number(quoi.split('-')[1]))
      return
    }
    switch (quoi) {
      case 'economat': {
        const r = appelleEconomat()
        pupDit(
          r === 'ok'
            ? 'Le Semblable est appelé : l’Économat prendra la prochaine salle — la salle choisie à la cérémonie attendra sa sortie. (Avec « Valider la salle en cours », il est là en deux gestes.)'
            : r === 'hub'
              ? 'Le Semblable est appelé : l’Économat s’intercalera dès la première salle franchie de la descente.'
              : r === 'dedans'
                ? 'Vous y êtes déjà — c’est l’Économat.'
                : 'Pas d’Économat dans un essai de tableau : lancez une descente.',
        )
        break
      }
      case 'hub-principal': {
        const r = passeLeHub('principal')
        if (r === 'ok') {
          // la fiche fige l'essai : sans la refermer, la boucle ne tourne
          // pas et le sas ne serait jamais franchi
          pupitreEl.hidden = true
          closeHome()
        } else {
          pupDit(
            r === 'menu'
              ? 'Aucun essai en cours : entrez au hub d’abord.'
              : r === 'dehors'
                ? 'Vous n’êtes pas au hub — ici, c’est « Valider la salle en cours ».'
                : 'Le corps est dispersé : le sas ne s’ouvre pas.',
          )
        }
        break
      }
      case 'valider-salle': {
        const r = valideSalleCourante()
        if (r === 'ok') {
          // la fiche fige l'essai : sans la refermer, la boucle ne tourne
          // pas et le sas ne serait jamais franchi
          pupitreEl.hidden = true
          closeHome()
        } else {
          pupDit(
            r === 'menu'
              ? 'Aucun essai en cours : lancez une descente d’abord.'
              : r === 'hub'
                ? 'Au hub il n’y a rien à valider : prenez « Partir par le sas principal ».'
                : r === 'deja'
                  ? 'La salle est déjà conclue (cérémonie ouverte ou expédition achevée).'
                  : 'Le corps est dispersé : plus rien à livrer.',
          )
        }
        break
      }
      case 'bonbonne-plus':
        run.bonbonneLiters = Math.min(capBonbonne(), run.bonbonneLiters + 2)
        pupDit(
          `Bonbonne : ${run.bonbonneLiters.toFixed(1)} / ${capBonbonne()} L.`,
        )
        break
      case 'bonbonne-vider':
        run.bonbonneLiters = 0
        pupDit('Bonbonne vidée.')
        break
      case 'verser': {
        const r = verserBonbonne()
        pupDit(
          r === 'ok'
            ? 'Versé au corps.'
            : r === 'rien'
              ? 'Rien à verser : bonbonne vide, ou corps déjà au volume de départ.'
              : r === 'etat'
                ? 'Impossible en glace ou en vapeur — redevenez liquide.'
                : r === 'pause'
                  ? 'Impossible : jeu en pause ou essai conclu.'
                  : 'Impossible ici (hub, essai de tableau ou cérémonie en cours).',
        )
        break
      }
      case 'xp-bord': {
        const p = prochainPalier(run.xp)
        if (p === null) {
          pupDit('Table des paliers épuisée : plus rien à franchir.')
        } else {
          run.xp = Math.max(run.xp, p - 0.5)
          pupDit(
            `XP amenée à ${run.xp.toFixed(1)} L (palier à ${p} L) — la prochaine cérémonie le franchira.`,
          )
        }
        break
      }
      case 'xp-sec':
        run.xp += 2
        pupDit(
          `XP : ${run.xp.toFixed(1)} L — à sec, sans cérémonie (les tirages ne s'ouvrent qu'en cérémonie).`,
        )
        break
      case 'condensat':
        gagneCondensat(150)
        pupDit('Condensat +150 cL (bourse de la run).')
        break
      case 'memoire':
        gagneMemoireRun(25)
        pupDit(`Mémoire +25 — solde gravé : ${records.memoire()}.`)
        break
      case 'fiole': {
        const manque = FIOLES.filter((f) => !records.possedeFiole(f.id))
        if (manque.length === 0) {
          pupDit('La collection de fioles est déjà complète.')
        } else {
          const f = manque[Math.floor(Math.random() * manque.length)]
          records.ajouteFiole(f.id)
          pupDit(`${f.nom} ajoutée à la collection (${fioleDef(f.id)?.desc}).`)
        }
        break
      }
      case 'toasts': {
        // LES CINQ POPUPS DE RÉCOMPENSE, à la file : chaque nature a sa
        // couleur et son cartouche, et l'enchaînement se voit d'un coup.
        // Rien ne se grave : ni trophée, ni fiche, ni fiole — c'est un
        // essai d'affichage, pas un gain.
        pupitreEl.hidden = true
        toastFile.push(
          {
            nom: 'Essai d’affichage — rien n’est gravé',
            icone: '🏆',
            genre: 'trophee',
          },
          {
            nom: 'Essai d’affichage — rien n’est gravé',
            icone: '📄',
            sur: 'CODEX — NOUVELLE FICHE',
            genre: 'codex',
          },
          {
            nom: '+3 mémoire — essai d’affichage',
            icone: '✦',
            article: 'memoire',
            sur: 'ÉCLAT DE MÉMOIRE',
            genre: 'eclat',
          },
          {
            nom: 'Essai d’affichage — rien n’est gravé',
            icone: '🧪',
            sur: 'FIOLE TROUVÉE',
            genre: 'fiole',
          },
          {
            nom: 'Essai d’affichage — rien n’est débité',
            icone: '🛒',
            article: 'gouttes',
            sur: 'L’ÉCONOMAT',
            genre: 'achat',
          },
        )
        pupDit('Cinq popups à la file — aucun registre touché.')
        break
      }
      case 'cycle':
        // l'écran des mémoires s'ouvre PAR-DESSUS le pupitre : on tisse,
        // on referme, le pupitre est toujours là
        cycleEl.hidden = false
        renderCycleVoile()
        pupDit(
          `L’écran des mémoires est ouvert — mémoire disponible : ${records.memoire()}.`,
        )
        break
      case 'verrous': {
        // L'ACTE 0 en essai : le scénario referme les deux liens offerts —
        // le Sujet sort de cuve sans même savoir revenir liquide, et les
        // rachète en mémoire. Bascule, pour éprouver le déblocage progressif.
        const ferme = records.basculeVerrouCycle('fusion')
        if (records.verrousCycle().includes('liquefaction') !== ferme)
          records.basculeVerrouCycle('liquefaction')
        renderCycleVoile()
        pupDit(
          ferme
            ? 'Verrous posés : fusion et liquéfaction sont à retisser.'
            : 'Verrous levés : le retour au liquide est de nouveau offert.',
        )
        break
      }
      case 'vie':
        run.vies = Math.min(VIES_MAX, run.vies + 1)
        majBoutonsRun()
        pupDit(`Vies : ${run.vies} / ${VIES_MAX}.`)
        break
      case 'son-collecte':
        bande.ponctuation('sting-collecte', 0.8)
        pupDit('♪ sting-collecte')
        break
      case 'son-record':
        bande.ponctuation('sting-record', 0.8)
        pupDit('♪ sting-record')
        break
      case 'son-fin':
        bande.ponctuation('fin-de-course', 0.8)
        pupDit('♪ fin-de-course')
        break
    }
  }
}
// LE PANNEAU : chaque bouton tire la même corde que le banc
for (const b of Array.from(
  pupitreEl?.querySelectorAll<HTMLButtonElement>('[data-pup]') ?? [],
)) {
  b.addEventListener('click', () => actionPupitre(b.dataset.pup ?? ''))
}

/** LE CATALOGUE des manœuvres, lu sur le panneau lui-même : le HTML reste
 *  la seule source (titres, explications, ordre) — le banc s'en sert pour
 *  offrir les mêmes gestes sans qu'on ait à tenir deux listes. */
function cataloguePupitre(): {
  titre: string
  boutons: { cle: string; titre: string; aide: string }[]
}[] {
  const out: {
    titre: string
    boutons: { cle: string; titre: string; aide: string }[]
  }[] = []
  const corps = pupitreEl?.querySelector('.pup-corps')
  let section: (typeof out)[number] | null = null
  for (const el of Array.from(corps?.children ?? [])) {
    if (el.classList.contains('pup-sec')) {
      section = { titre: (el.textContent ?? '').trim(), boutons: [] }
      out.push(section)
      continue
    }
    for (const b of Array.from(
      el.querySelectorAll<HTMLElement>('[data-pup]'),
    )) {
      if (!section) {
        section = { titre: 'Manœuvres', boutons: [] }
        out.push(section)
      }
      section.boutons.push({
        cle: b.dataset.pup ?? '',
        titre: (
          b.querySelector('b')?.textContent ??
          b.dataset.pup ??
          ''
        ).trim(),
        aide: (b.querySelector('small')?.textContent ?? '').trim(),
      })
    }
  }
  return out
}

function resetLasers(): void {
  laserEtat.vues = []
  laserEtat.impacts = []
  laserEtat.litPrec = []
  laserEtat.ionisations = []
  laserEtat.captures = []
  laserEtat.ionisePrec = []
  laserEtat.recepteurs = creerEtatRecepteurs((level.cibles ?? []).length)
  laserEtat.portesOuvertes = (level.portes ?? []).map(() => false)
  laserEtat.doorsKey = ''
  lastRailTime = 0
  railsEngages.clear()
  cachesLevee = (level.caches ?? []).map(() => Infinity)
  // la CLEF DE CACHETTE se consomme ici : les voiles du tableau tombent
  // d'emblée (le hub et l'Économat ne l'usent pas)
  if (clefCachette && !estEconomat(level) && !auHub) {
    clefCachette = false
    cachesLevee = (level.caches ?? []).map(() => 0)
  }
  // les pastilles de condensat se re-sèment (mêmes places : semis
  // déterministe) — ni au hub ni à l'Économat, on n'y farme rien
  pastilles = auHub || estEconomat(level) ? [] : semePastilles(level)
  pastillesPrises = pastilles.map(() => false)
  run.pastillesCl = 0
  // la FIOLE — seulement s'il en manque encore à la collection : posée
  // main par le tableau (level.fiole), sinon le semis automatique décide
  const manqueFiole = FIOLES.some((f) => !records.possedeFiole(f.id))
  fiolePastille =
    auHub || estEconomat(level) || !manqueFiole
      ? null
      : level.fiole
        ? { ...level.fiole }
        : semeFiole(level)
  fiolePrise = false
  // l'étal de l'Économat se réarme (le condensat dépensé, lui, l'est)
  achatsEconomat.clear()
  plotsDedans = ETAL_ECONOMAT.map(() => false)
  // le comptoir du hub aussi : un article par VISITE du module — le
  // réarmement suit la géométrie du hub joué, pas un compte figé
  achatsHub.clear()
  plotsHubDedans = (zonesDuHub(level)?.etal ?? []).map(() => false)
  plotsReparDedans = REPARATIONS.map(() => false)
  sasScelleDedans = false
  // les plots POSÉS du tableau (le méta en données)
  plotsPosesDedans = (level.plots ?? []).map(() => false)
  // les éclats de mémoire : ceux déjà gravés CETTE RUN ne reviennent pas
  eclatsEssai = (level.eclats ?? [])
    .map((e, i) => ({ ...e, cle: `${level.code}|${i}` }))
    .filter((e) => !eclatsPrisRun.has(e.cle))
  eclatsPrisEssai = eclatsEssai.map(() => false)
  bancMemoiresDedans = false
  rebuildRenderBoxes() // les parois factices reprennent leur poste
}

// ---- L'ACHAT à l'Économat : le corps plonge dans une alcôve de l'étal —
// le prix se débite, l'effet s'applique, le Semblable ne rend jamais.
function tenteAchat(a: ArticleEconomat): void {
  if (achatsEconomat.has(a.id)) {
    toastFile.push({
      nom: `${a.nom} — DÉJÀ SERVI`,
      icone: a.icone,
      article: a.id,
      sur: 'L’ÉCONOMAT',
    })
    return
  }
  // la fiole de TROC : le Semblable vous reconnaît, les prix baissent
  const prix = fioleActive('troc') ? Math.round(a.prix * 0.75) : a.prix
  if (!depenseCondensat(prix)) {
    toastFile.push({
      nom: `${a.nom} — CONDENSAT INSUFFISANT (${prix} cL)`,
      icone: '🚫',
      sur: 'L’ÉCONOMAT',
    })
    return
  }
  achatsEconomat.add(a.id)
  audio.collect()
  let detail = a.detail
  switch (a.id) {
    case 'gouttes':
      run.bonbonneLiters = Math.min(capBonbonne(), run.bonbonneLiters + 0.8)
      break
    case 'dashs':
      sim.dashBudget = sim.dashBudgetMax
      break
    case 'clef':
      clefCachette = true
      break
    case 'secours':
      run.vies = Math.min(VIES_MAX, run.vies + 1)
      majBoutonsRun()
      break
    case 'sac': {
      const tirage = Math.random()
      const communes = FIOLES.filter(
        (f) => !f.rare && !records.possedeFiole(f.id),
      )
      if (tirage < 0.4) {
        gagneCondensat(100)
        detail = 'dedans : +100 cL de condensat'
      } else if (tirage < 0.7) {
        gagneMemoireRun(2)
        detail = 'dedans : +2 mémoire — il vous a appris quelque chose'
      } else if (tirage < 0.85 && communes.length > 0) {
        const f = communes[Math.floor(Math.random() * communes.length)]
        records.ajouteFiole(f.id)
        detail = `dedans : ${f.nom} — ${f.desc}`
      } else {
        detail = 'le sac était vide. Le Semblable vous fixe.'
      }
      break
    }
  }
  toastFile.push({
    nom: `${a.nom} — ${detail}`,
    icone: a.icone,
    article: a.id,
    sur: 'L’ÉCONOMAT',
  })
}

// ---- L'ACHAT au COMPTOIR du hub : payé en MÉMOIRE, livré au départ -----
// Le Semblable détaché au module vend des PROVISIONS : elles s'appliquent
// au lancement de la prochaine descente (le viatique ne gonfle pas une
// bonbonne qui sera remise à zéro au départ — il attend le départ).
// ---- LA RÉPARATION au contact : le corps se pose sur une station en
// panne — la mémoire se débite, la gravure est atomique (records.repare),
// et le hub se RALLUME à chaud : le mémo est invalidé, applyLevel repose
// pancartes, écrans, lumières ; les portes d'énergie se lèvent au frame
// suivant (doorsKey → setDoors). Pas de restart : rien ne respawn.
// Une station déjà réparée se tait (la table de départ vit sur sa zone).
function tenteReparation(id: string): void {
  const r = reparationDef(id)
  if (!r || records.estRepare(id)) return
  if (!records.repare(id, r.prix)) {
    toastFile.push({
      nom: `${r.nom} — MÉMOIRE INSUFFISANTE (${r.prix})`,
      icone: '🚫',
      sur: 'RÉPARATION',
    })
    return
  }
  audio.collect()
  bande.ponctuation('sting-collecte', 0.8)
  majMemoireUI()
  hubMemo = null
  applyLevel()
  toastFile.push({
    nom: `${r.nom} — RÉPARÉ · ${r.detail}`,
    icone: r.icone,
    sur: 'LE MODULE SE RALLUME',
  })
}

// ---- LA TABLE DE DÉPART (réparée) : le récapitulatif de ce qu'on
// emportera à la prochaine descente, quand on longe le plan de travail.
let tableDepartDedans = false
function montreTableDepart(): void {
  const vies = Math.min(
    VIES_MAX,
    1 + (fioleActive('second-souffle') ? 1 : 0) + provisionsRun.vies,
  )
  const morceaux = [`${vies} vie${vies > 1 ? 's' : ''}`]
  if (provisionsRun.bonbonne > 0)
    morceaux.push(
      `réserve +${provisionsRun.bonbonne.toFixed(1).replace('.', ',')} L`,
    )
  const eq = records.fiolesEquipees()
  if (eq.length > 0) morceaux.push(`fioles : ${eq.join(' + ')}`)
  if (provisionsRun.clef) morceaux.push('clef de cachette')
  if (provisionsRun.condensat > 0)
    morceaux.push(`+${provisionsRun.condensat} cL de condensat`)
  toastFile.push({
    nom: morceaux.join(' · '),
    icone: '🗺️',
    sur: 'LA TABLE DE DÉPART — VOUS EMPORTEZ',
  })
}

function tenteAchatHub(a: ArticleHub): void {
  if (achatsHub.has(a.id)) {
    toastFile.push({
      nom: `${a.nom} — DÉJÀ SERVI`,
      icone: a.icone,
      article: a.id,
      sur: 'LE COMPTOIR',
    })
    return
  }
  if (!records.depenseMemoire(a.prix)) {
    toastFile.push({
      nom: `${a.nom} — MÉMOIRE INSUFFISANTE (${a.prix})`,
      icone: '🚫',
      sur: 'LE COMPTOIR',
    })
    return
  }
  achatsHub.add(a.id)
  audio.collect()
  majMemoireUI()
  let detail = a.detail
  switch (a.id) {
    case 'viatique':
      provisionsRun.bonbonne += 0.8
      break
    case 'clef':
      provisionsRun.clef = true
      break
    case 'secours':
      provisionsRun.vies += 1
      break
    case 'sac': {
      const tirage = Math.random()
      if (tirage < 0.45) {
        provisionsRun.condensat += 100
        detail = 'dedans : +100 cL de condensat, au départ de la descente'
      } else if (tirage < 0.8) {
        records.gagneMemoire(2)
        majMemoireUI()
        detail = 'dedans : +2 mémoire — il vous a appris quelque chose'
      } else {
        detail = 'dedans : rien. Le Semblable vous fixe.'
      }
      break
    }
  }
  toastFile.push({
    nom: `${a.nom} — ${detail}`,
    icone: a.icone,
    article: a.id,
    sur: 'LE COMPTOIR',
  })
}

// ---- L'ACHAT sur un PLOT POSÉ : le méta en données. La monnaie choisit
// le catalogue ET la caisse — condensat : l'étal (effet immédiat) ;
// mémoire : le comptoir (provisions de la PROCHAINE descente, où que le
// plot soit posé). Le prix posé surcharge le catalogue. Les caisses
// « déjà servi » restent celles des étals : deux plots du même article
// dans un tableau ne servent qu'une fois.
function tenteAchatPlot(p: PlotMeta): void {
  if (p.monnaie === 'memoire') {
    const base = articleComptoir(p.article)
    if (!base) return
    tenteAchatHub({ ...base, prix: p.prix ?? base.prix, plot: p })
  } else {
    const base = articleEtal(p.article)
    if (!base) return
    tenteAchat({ ...base, prix: p.prix ?? base.prix, plot: p })
  }
}

/** Les PROVISIONS achetées au comptoir se livrent au départ de la
 * descente — puis la besace se vide (elles valent UNE expédition). */
function appliqueProvisions(): void {
  if (provisionsRun.vies > 0)
    run.vies = Math.min(VIES_MAX, run.vies + provisionsRun.vies)
  if (provisionsRun.bonbonne > 0)
    run.bonbonneLiters = Math.min(
      capBonbonne(),
      run.bonbonneLiters + provisionsRun.bonbonne,
    )
  if (provisionsRun.clef) clefCachette = true
  if (provisionsRun.condensat > 0) gagneCondensat(provisionsRun.condensat)
  provisionsRun.bonbonne = 0
  provisionsRun.vies = 0
  provisionsRun.clef = false
  provisionsRun.condensat = 0
  majBoutonsRun()
}

// ---- LA MISE EN BONBONNE : l'écran de récompense de fin de salle ----
// Quatre temps : la compression (le surplus coule dans la bonbonne), la
// lecture du protocole (les lignes tombent, les records se tamponnent), le
// condensat (les centilitres s'égrènent vers la bourse de la run), et LE CHOIX
// (trois cartes d'instruments, on en emporte une — certaines payantes en
// condensat). Un toucher saute aux cartes ; le choix, lui, ne se saute pas.
let miseEnBonbonne = false
const mbVeil = document.getElementById('mb-veil') as HTMLDivElement
const mbTimers: number[] = []
// Le fil de la cérémonie : bilan (temps 1-3, sautables) → versement (le
// surplus choisit sa destination) → draft (un tirage par palier franchi)
// → fin (jauge et CONTINUER). Le versement et la suite ne se sautent pas.
let mbEtape: 'bilan' | 'versement' | 'etalonnage' | 'draft' | 'salles' | 'fin' =
  'bilan'
let mbDraftsRestants = 0
let mbBilanCourant: BilanSalle | null = null

/** Le sas mène à la salle suivante (raccourci éventuel compris). */
function avanceSalle(): void {
  overlay.classList.remove('visible')
  // la salle GÉNÉRÉE élue s'INTERCALE : elle prend la place du rang suivant
  // de la séquence — franchie, la séquence reprend après ce rang
  if (voieGenereeChoisie) {
    voieIntercalaire = voieGenereeChoisie
    voieGenereeChoisie = null
    levelIndex += 1
    restart()
    return
  }
  // L'ÉCONOMAT : on en SORT (la séquence reprend son cours), ou il
  // s'INTERCALE — une fois par run, à mi-descente. Le choix de salle fait
  // à la cérémonie (salleChoisie) attend sagement la sortie de l'annexe.
  if (economatIntercalaire && estEconomat(level)) {
    economatIntercalaire = null
  } else if (
    !auHub &&
    !testLevel &&
    (economatForce || !economatVisiteCetteRun)
  ) {
    const total = voiePlan.longueur
    const rang = voieRang
    if (economatForce || (total >= 4 && rang >= Math.floor(total / 2))) {
      economatForce = false // il a servi
      economatVisiteCetteRun = true
      economatIntercalaire = economatLevel()
      voieIntercalaire = null // la salle précédente est franchie
      restart()
      return
    }
  }
  voieIntercalaire = null // l'intercalaire vient d'être franchie (ou quittée)
  // RACCOURCI (mécanique roguelike, préparée) : un tableau peut déclarer
  // `raccourciVers` — son sas envoie alors directement à la salle codée,
  // en SAUTANT les intermédiaires. Vers l'avant uniquement (pas de boucle).
  const cible = level.raccourciVers
    ? playedLevels().findIndex((t) => t.code === level.raccourciVers)
    : -1
  // le CHOIX du pool prime : la salle élue à la cérémonie devient la suivante.
  // LE SAUT ARRIÈRE EST PERMIS depuis que la voie PIOCHE dans le pool : la
  // position d'un tableau dans la bibliothèque n'est plus son rang, et une
  // case tardive du plan peut très bien se remplir d'un tableau rangé haut.
  // Ce qui interdit la boucle n'est plus la direction mais le REGISTRE des
  // salles vues — un tableau déjà joué n'est jamais repioché de la run.
  const elue = salleChoisie
  const choix = elue ? playedLevels().indexOf(elue) : -1
  salleChoisie = null
  const sautLibre = choix >= 0 && elue !== null && !voieVues.has(elue.code)
  levelIndex =
    choix > levelIndex || sautLibre
      ? choix
      : cible > levelIndex
        ? cible
        : levelIndex + 1
  // garde-fou : séquence écrite épuisée sans salle élue — on ne REboucle
  // jamais sur la salle 1 en pleine descente (la dernière écrite tient)
  levelIndex = Math.min(levelIndex, Math.max(0, playedLevels().length - 1))
  restart()
}

interface BilanSalle {
  surplus: number
  prime: number
  pct: number // part du volume de départ livrée (0..1+)
  temps: number
  newVolume: boolean
  newChrono: boolean
  recVol: string
  recChr: string
  note: number
  gainCl: number
  totalCl: number // réserve APRÈS le gain
}

function mbEl(id: string): HTMLElement {
  return mbVeil.querySelector('#' + id) as HTMLElement
}

function fermeMiseEnBonbonne(): void {
  for (const t of mbTimers) clearTimeout(t)
  mbTimers.length = 0
  mbVeil.hidden = true
  miseEnBonbonne = false
  mbBilanCourant = null
}

/** Fige les temps 1-3 à leur état final (saut ou passage naturel). */
function mbFigeBilan(): void {
  for (const t of mbTimers) clearTimeout(t)
  mbTimers.length = 0
  const b = mbBilanCourant
  if (b) {
    mbEl('mb-eau').style.height = `${Math.min(100, b.pct * 100).toFixed(0)}%`
    mbEl('mb-l').textContent = `${b.surplus.toFixed(2)} L`
    if (b.prime >= 0.01) {
      const pr = mbEl('mb-prime')
      pr.hidden = false
      pr.textContent = `+${b.prime.toFixed(2)} L — PRIME DE GLACE`
      mbEl('mb-glace').hidden = false
    }
    for (const l of Array.from(mbVeil.querySelectorAll('.mb-ligne'))) {
      l.classList.add('mb-on')
    }
    const cond = mbEl('mb-cond')
    cond.hidden = false
    cond.classList.add('mb-on')
    mbEl('mb-cond-n').textContent = String(b.totalCl)
  }
  mbEl('mb-passer').hidden = true
}

/** LE VERSEMENT : le surplus choisit sa destination — la RÉSERVE (bonbonne,
 * reversable dans le corps en route) ou l'ÉTALONNAGE (l'XP des
 * instruments). Bonbonne pleine : l'XP est le seul chemin. */
function mbMontreVersement(): void {
  if (mbEtape !== 'bilan') return
  mbEtape = 'versement'
  mbFigeBilan()
  const b = mbBilanCourant
  if (!b) return
  const bloc = mbEl('mb-choix')
  bloc.hidden = false
  mbEl('mb-choix-titre').textContent = 'OÙ VERSER LE SURPLUS ?'
  const host = mbCartes()
  host.innerHTML = ''
  const espace = Math.max(0, capBonbonne() - run.bonbonneLiters)
  const verse = Math.min(b.surplus, espace)
  const spill = b.surplus - verse
  const pleine = espace < 0.01

  const cb = document.createElement('button')
  cb.type = 'button'
  cb.className = 'mb-carte mb-dest' + (pleine ? ' mb-pauvre' : '')
  cb.disabled = pleine
  cb.innerHTML =
    `<span class="mb-ico">🫙</span><b>RÉSERVE</b>` +
    `<small>${
      pleine
        ? 'bonbonne PLEINE — tout va à l’étalonnage'
        : `+${verse.toFixed(2)} L en bonbonne (${run.bonbonneLiters.toFixed(1)} / ${capBonbonne()} L)` +
          (spill > 0.01 ? ` · excédent +${spill.toFixed(2)} L → XP` : '')
    }</small>` +
    `<em class="mb-prix mb-offert">se reverse dans le corps, en jeu</em>`
  cb.addEventListener('click', () => {
    run.bonbonneLiters = Math.min(capBonbonne(), run.bonbonneLiters + verse)
    bande.ponctuation('sting-collecte', 0.55)
    mbVerseXp(spill)
  })
  host.appendChild(cb)

  const prochain = prochainPalier(run.xp)
  const cx = document.createElement('button')
  cx.type = 'button'
  cx.className = 'mb-carte mb-dest'
  cx.innerHTML =
    `<span class="mb-ico">🧰</span><b>ÉTALONNAGE</b>` +
    `<small>+${b.surplus.toFixed(2)} L d’XP (jauge : ${run.xp.toFixed(1)} L${
      prochain !== null ? ` · palier à ${prochain} L` : ''
    })</small>` +
    `<em class="mb-prix mb-offert">chaque palier ouvre un tirage</em>`
  cx.addEventListener('click', () => {
    bande.ponctuation('sting-collecte', 0.55)
    mbVerseXp(b.surplus)
  })
  host.appendChild(cx)
}

// ---- LA JAUGE D'ÉTALONNAGE : l'XP se VOIT couler, palier par palier ----
// La barre couvre le segment « palier atteint → palier suivant » (façon
// barre de niveau) : un franchissement l'emplit, l'embrase, fait sauter le
// compteur de paliers, tamponne « PALIER n — TIRAGE OUVERT » — puis elle
// repart de zéro sur le segment suivant. Table épuisée : elle reste pleine.

/** Le segment courant de la jauge : dernier palier atteint → prochain. */
function mbSegmentXp(xp: number): { base: number; cible: number | null } {
  let base = 0
  for (const p of PALIERS_XP) {
    if (xp >= p) base = p
    else return { base, cible: p }
  }
  return { base, cible: null }
}

/** Peint la jauge pour une valeur d'XP donnée (remplissage, bornes, litres). */
function mbPeintEtal(xp: number): void {
  const seg = mbSegmentXp(xp)
  const part =
    seg.cible === null
      ? 1
      : Math.max(0, Math.min(1, (xp - seg.base) / (seg.cible - seg.base)))
  const pct = `${(part * 100).toFixed(2)}%`
  mbEl('mb-etal-fluide').style.width = pct
  mbEl('mb-etal-lueur').style.left = pct
  mbEl('mb-etal-l').textContent = xp.toFixed(1)
  mbEl('mb-etal-pg').querySelector('b')!.textContent = String(
    paliersAtteints(xp),
  )
  const pd = mbEl('mb-etal-pd')
  pd.querySelector('b')!.textContent =
    seg.cible === null ? '★' : `${seg.cible} L`
  pd.querySelector('small')!.textContent =
    seg.cible === null ? 'complet' : 'prochain'
}

/** Fait COULER la jauge de `depart` à `arrivee` : le fluide monte, chaque
 * palier franchi s'embrase et se tamponne, puis `onDone` enchaîne. */
function mbAnimeEtalonnage(
  depart: number,
  arrivee: number,
  onDone: () => void,
): void {
  const etal = mbEl('mb-etal')
  etal.hidden = false
  mbEl('mb-etal-tampon').hidden = true
  const gainEl = mbEl('mb-etal-gain')
  const gain = arrivee - depart
  if (gain > 0.005) {
    gainEl.hidden = false
    gainEl.textContent = `+${gain.toFixed(2)} L`
  } else {
    gainEl.hidden = true
  }
  mbPeintEtal(depart)
  if (gain <= 0.005) {
    onDone()
    return
  }
  etal.classList.add('coule')
  // le fluide coule segment par segment — la durée suit la part du gain,
  // bornée pour que ni un filet ni un torrent ne cassent le rythme
  const etape = (xp: number): void => {
    const seg = mbSegmentXp(xp)
    const cible = seg.cible !== null ? Math.min(arrivee, seg.cible) : arrivee
    const duree = Math.max(
      450,
      Math.min(1400, ((cible - xp) / Math.max(0.001, gain)) * 1800),
    )
    const t0 = performance.now()
    const anime = (): void => {
      if (!miseEnBonbonne || mbEtape !== 'etalonnage') return // cérémonie fermée
      const t = Math.min(1, (performance.now() - t0) / duree)
      const e = t * t * (3 - 2 * t) // douce au départ ET à l'arrivée
      mbPeintEtal(xp + (cible - xp) * e)
      if (t < 1) {
        requestAnimationFrame(anime)
        return
      }
      const franchit = seg.cible !== null && cible >= seg.cible - 1e-9
      if (franchit) {
        // PALIER FRANCHI : l'embrasement du tube, le pop du compteur, le
        // tampon doré, la ponctuation des records
        const no = paliersAtteints(cible)
        const tube = mbEl('mb-etal-tube')
        tube.classList.remove('eclair')
        void tube.offsetWidth // relance l'animation CSS
        tube.classList.add('eclair')
        const pg = mbEl('mb-etal-pg')
        pg.classList.remove('saute')
        void pg.offsetWidth
        pg.classList.add('saute')
        const tampon = mbEl('mb-etal-tampon')
        tampon.hidden = false
        tampon.textContent = `PALIER ${no} — TIRAGE OUVERT`
        bande.ponctuation('sting-record', 0.75)
        mbPeintEtal(cible) // la jauge repart de zéro sur le segment suivant
        mbTimers.push(
          window.setTimeout(
            () => {
              if (cible < arrivee - 1e-9) etape(cible)
              else {
                etal.classList.remove('coule')
                onDone()
              }
            },
            cible < arrivee - 1e-9 ? 850 : 1000,
          ),
        )
        return
      }
      etal.classList.remove('coule')
      mbTimers.push(window.setTimeout(onDone, 450))
    }
    requestAnimationFrame(anime)
  }
  etape(depart)
}

/** Crédite l'XP et fait COULER la jauge — puis un tirage par palier
 * franchi, sinon la suite de la cérémonie. */
function mbVerseXp(litres: number): void {
  const avantXp = run.xp
  const avant = paliersAtteints(run.xp)
  run.xp += litres
  mbDraftsRestants = paliersAtteints(run.xp) - avant
  mbEtape = 'etalonnage'
  // les cartes du versement s'effacent : la jauge prend la scène
  mbEl('mb-choix-titre').textContent =
    litres > 0.005 ? 'L’ÉTALONNAGE SE CHARGE' : 'ÉTALONNAGE'
  mbCartes().innerHTML = ''
  mbAnimeEtalonnage(avantXp, run.xp, () => {
    if (mbDraftsRestants > 0) mbMontreDraft()
    else mbApresRecompense()
  })
}

/** Le porte-cartes de la cérémonie, remis à neuf. Versement, tirage et
 * choix de salle le réemploient tour à tour : il ne doit rien garder de
 * l'étape précédente — ni disposition, ni mise en scène en cours. */
function mbCartes(): HTMLElement {
  const h = mbEl('mb-cartes')
  h.classList.remove('mb-draft', 'mb-isole', 'mb-elu')
  h.style.removeProperty('--n')
  return h
}

/** Un TIRAGE d'instruments (palier franchi) : trois cartes, on en emporte
 * une — certaines payantes en condensat, jamais toutes. */
function mbMontreDraft(): void {
  mbEtape = 'draft'
  const palierNo = paliersAtteints(run.xp) - mbDraftsRestants + 1
  mbEl('mb-choix-titre').textContent =
    `PALIER D'ÉTALONNAGE ${palierNo} — EMPORTEZ UN INSTRUMENT`
  const host = mbCartes()
  host.innerHTML = ''
  // le CARNET DU SEMBLABLE ouvre une quatrième carte
  const cartes = tirageInstruments(
    Math.random,
    run.instruments,
    run.vies,
    VIES_MAX,
    3 + lev('cartes'),
    catalogueRecompenses(),
  )
  const suite = (): void => {
    mbDraftsRestants -= 1
    if (mbDraftsRestants > 0) mbMontreDraft()
    else mbApresRecompense()
  }
  if (cartes.length === 0) {
    // plus rien au bassin (tout emporté, réserve pleine) : palier honoré
    mbDraftsRestants = 0
    mbApresRecompense()
    return
  }
  // les colonnes suivent le NOMBRE de cartes : le Carnet du Semblable en
  // ouvre une quatrième, qui passait jusqu'ici seule à la ligne
  host.classList.add('mb-draft')
  host.style.setProperty('--n', String(Math.min(4, cartes.length)))
  // le tirage se POSE : chaque carte arrive avec un décalage, et le survol
  // isole celle qu'on regarde (le motif de l'écran des mémoires). Au
  // clavier ou à la manette, le focus fait le même office que la souris.
  const isole = (el: HTMLElement | null): void => {
    host.classList.toggle('mb-isole', el !== null)
    for (const c of host.children) c.classList.toggle('crt-survol', c === el)
  }
  cartes.forEach((carte, i) => {
    const def = carteDef(carte.id)
    if (!def) return
    const payable = carte.prix === 0 || condensat >= carte.prix
    const enveloppe = document.createElement('div')
    enveloppe.innerHTML = carteHTML(def, {
      variante: 'draft',
      bouton: true,
      prix: carte.prix,
    })
    const btn = enveloppe.firstElementChild as HTMLButtonElement
    if (!payable) {
      btn.classList.add('mb-pauvre')
      btn.disabled = true
    }
    btn.style.setProperty('--i', String(i))
    for (const ev of ['pointerenter', 'focusin'] as const)
      btn.addEventListener(ev, () => isole(btn))
    for (const ev of ['pointerleave', 'focusout'] as const)
      btn.addEventListener(ev, () => isole(null))
    btn.addEventListener('click', () => {
      if (!depenseCondensat(carte.prix)) return
      // LA CARTE ÉLUE s'embrase, les autres se retirent — puis la suite
      isole(null)
      host.classList.add('mb-elu')
      btn.classList.add('crt-elue')
      // le levier « vies » se consomme À L'INSTANT (une vie n'est pas un
      // facteur qu'on relit : elle se prend) ; tout le reste s'embarque
      const def = carteDef(carte.id)
      const gainVies = valeurLevier(def?.effets ?? [], 'vies')
      if (gainVies > 0) {
        run.vies = Math.min(VIES_MAX, run.vies + gainVies)
        majBoutonsRun()
      }
      if ((def?.effets ?? []).some((e) => e.levier !== 'vies'))
        run.instruments.push(carte.id)
      majInstrumentsUI()
      bande.ponctuation('sting-collecte', 0.7)
      // l'embrasement dure 320 ms ; sans animation (réglage système), la
      // suite s'enchaîne quand même — le tirage reste jouable
      window.setTimeout(suite, sansAnimation() ? 0 : 320)
    })
    host.appendChild(btn)
  })
}

// ---- Le POOL de salles : le choix de la prochaine, après la récompense --
// Deux chemins, et il faut les distinguer. En VOIE (salles générées
// allumées, l'ordinaire), le choix se compose au rang : trois salles
// fabriquées et, si les tableaux écrits tiennent, un tableau PIOCHÉ dans le
// pool sur le trigramme du plan. Hors voie, le vieux chemin subsiste : les
// codes « 21XX-MMD » peuvent porter plusieurs tableaux au MÊME ordre, et le
// jeu en propose alors deux — sinon l'enchaînement reste linéaire.
let salleChoisie: LevelDef | null = null

/** Après la récompense : en VOIE SEMI-PROCÉDURALE, le tableau PIOCHÉ dans
 * le pool face aux salles générées ; sinon le choix du pool au rang, si
 * celui-ci offre deux tableaux — à défaut, la fin ordinaire. */
function mbApresRecompense(): void {
  const seq = playedLevels()
  if (sallesGenerees()) {
    const duo = propositionsVoie(seq)
    if (duo) {
      mbMontreSallesVoie(duo)
      return
    }
  }
  const props = propositionsSalles(seq, levelIndex + 2, seq.length)
  if (props.length === 2) mbMontreSalles(props)
  else mbMontreFin()
}

/** Une carte du choix de la voie. */
interface CarteVoie {
  lv: LevelDef
  cahier: CodeAtelier | null
  generee: boolean
  etiquette: string
}

/** LA VOIE SEMI-PROCÉDURALE : le choix du rang suivant, tiré du PLAN de
 * descente (longueur, rampe de difficulté, moment par tiers). TROIS salles
 * générées, trois mécaniques — plus, quand les tableaux écrits tiennent, un
 * tableau PIOCHÉ dans le pool sur le trigramme du rang. Pool vide ou
 * tableaux écrits coupés : la descente est tout procédurale et continue
 * jusqu'au bout du plan. En DESCENTE DU JOUR, graine, mécaniques et pioche
 * viennent de la date : les mêmes salles pour tous les postes ce jour-là. */
function propositionsVoie(seq: LevelDef[]): CarteVoie[] | null {
  const rangSuivant = voieRang + 1 // la salle que le choix désigne, dans le plan
  if (rangSuivant > voiePlan.longueur) return null // la fin se joue au sas
  const moment = momentAuRang(rangSuivant, voiePlan)
  const difficulte = diffAuRang(rangSuivant, voiePlan)
  const jour = new Date().toISOString().slice(0, 10)
  const alea = descenteDuJour()
    ? ((): (() => number) => {
        let h = hachage(`${jour}@${rangSuivant}`)
        return () => {
          h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0
          return h / 2 ** 32
        }
      })()
    : Math.random
  // LE CYCLE tient aussi la voie : la descente ne propose jamais une salle
  // qui exige une transformation manuelle non tissée — mécaniques ET
  // maillons se restreignent aux liens que le joueur possède.
  const acquisCycle = records.eveilAcquis()
  const verrousCycle = records.verrousCycle()
  const solidTenue = transfoTenue('solidification', acquisCycle, verrousCycle)
  const vapoTenue = transfoTenue('vaporisation', acquisCycle, verrousCycle)
  const permises = mecaniquesPermises(solidTenue, vapoTenue)
  const masqueCycle = masquePermis(solidTenue, vapoTenue)
  // LA PIOCHE DU POOL remplace l'ordre figé. Le tableau écrit ne vient plus
  // de la POSITION suivante dans la bibliothèque : le plan dit ce qu'il veut
  // pour ce rang (le trigramme moment · mécanique · difficulté) et l'on tire
  // dans le pool le tableau qui s'en approche le plus, parmi ceux qu'on n'a
  // pas encore vus de la descente. Deux runs ne racontent plus la même
  // suite. Coupée au banc (« tableaux écrits »), la descente est TOUT
  // PROCÉDURALE : aucun tableau fait main ne se propose.
  const jouee = identiteAtelier(level)?.mecanique ?? null
  const ecrite = voiePlan.ecrites
    ? piocheEcrite(
        seq,
        { moment, mecanique: 3, difficulte },
        voieVues,
        // un tableau qui EXIGE un état non tissé n'est pas jouable
        (lv) =>
          (lv.exige ?? []).every((e) =>
            e === 'glace' ? solidTenue : vapoTenue,
          ),
        alea,
        jouee,
      )
    : null
  const aEcrite = ecrite ? decodeCodeAtelier(ecrite.code) : null
  // la mécanique de la salle qu'on VIENT de jouer s'évite : la foulée varie
  const [mecaA, mecaB, mecaC] = mecaniquesDuChoix(
    aEcrite?.mecanique ?? null,
    alea,
    jouee,
    permises,
  )
  // le RÉGLAGE DU RANG (enseigner · éprouver · tordre) : la posture de la
  // salle générée — pureté du début, laby du milieu, contraste de la fin,
  // dangers différés — voyage dans le code (suffixe ~), l'identité tient
  const regl = reglageAuRang(rangSuivant, voiePlan)
  // LE MÉLANGE DES DEUX GÉNÉRATEURS : les salles à compartiments (le
  // système historique) et les FIGURES — dont les familles tirées des
  // tableaux de BOIZ. Le choix du rang en montre les deux : une figure au
  // début, deux dès que le milieu s'ouvre, les autres cartes en
  // compartiments. La famille se tire dans le vivier éligible (mémoires
  // tissées, mécanique de la carte, moment du plan).
  const modesFigure = figuresDuChoix(moment, alea)
  const optionsDuRang = (
    mec: CodeAtelier['mecanique'],
    carte: number,
  ): OptionsGen => ({
    ...OPTIONS_DEFAUT,
    dangers: regl.dangers,
    laby: regl.laby,
    contraste: regl.contraste,
    familles: (regl.purete ? masqueMecanique(mec) : 127) & masqueCycle,
    figure: figureDeLaCarte(
      modesFigure[carte] ?? false,
      moment,
      mec,
      solidTenue,
      vapoTenue,
      alea,
    ),
    ampleur: ampleurAuRang(rangSuivant, voiePlan),
  })
  const variante = (n: number): string =>
    descenteDuJour()
      ? varianteDuJour(jour, rangSuivant * 10 + n)
      : Math.floor(Math.random() * 36 ** 4)
          .toString(36)
          .toUpperCase()
          .padStart(2, '0')
  const genere = (
    mecanique: CodeAtelier['mecanique'],
    n: number,
    carte: number,
  ): { lv: LevelDef; cahier: CodeAtelier; figure: number } | null => {
    const cahier: CodeAtelier = { moment, mecanique, difficulte }
    // les options se tirent UNE FOIS par carte (la famille de figure est un
    // tirage) : les variantes de secours redonnent la même salle, pas une
    // autre famille — et l'étiquette de la carte reste vraie
    const opts = optionsDuRang(mecanique, carte)
    // une figure qui ne se prouve pas ne coûte pas la carte : le repli est
    // la salle à compartiments, le système historique
    for (const o of opts.figure !== 0 ? [opts, { ...opts, figure: 0 }] : [opts])
      for (let essai = 0; essai < 3; essai++) {
        try {
          return {
            lv: genereNiveauAtelier(cahier, variante(n + essai * 3), o),
            cahier,
            figure: o.figure,
          }
        } catch {
          // graine sans salle prouvée : on retire une variante voisine
        }
      }
    return null
  }
  // Le choix porte TOUJOURS TROIS salles générées, trois mécaniques — la
  // suite écrite (si la séquence en offre une) s'y ajoute en quatrième
  // carte : la voie reste procédurale d'abord, l'écrite est une option.
  const cartes: CarteVoie[] = []
  // le tableau pioché (déjà filtré sur ce qu'il EXIGE) ouvre le choix :
  // la voie reste procédurale d'abord, l'écrit est une option
  if (ecrite)
    cartes.push({
      lv: ecrite,
      cahier: aEcrite,
      generee: false,
      etiquette: 'TABLEAU DU POOL',
    })
  const etiquettesGen = [
    'SALLE GÉNÉRÉE — INÉDITE, PROUVÉE',
    'SALLE GÉNÉRÉE — L’AUTRE MÉCANIQUE',
    'SALLE GÉNÉRÉE — LA TROISIÈME MÉCANIQUE',
  ]
  // une figure s'annonce PAR SA FAMILLE : le joueur apprend à les
  // reconnaître d'un rang à l'autre, et le choix se prend sur la forme
  // autant que sur la mécanique
  const etiquetteGeneree = (figure: number, i: number): string => {
    const fam = FIGURE_FAMILLES[figure - 2]
    return fam
      ? `SALLE GÉNÉRÉE — FIGURE : ${FIGURE_NOMS[fam].toUpperCase()}`
      : etiquettesGen[Math.min(i, etiquettesGen.length - 1)]
  }
  ;[mecaA, mecaB, mecaC].forEach((mec, i) => {
    const g = genere(mec, i + 1, i)
    if (g)
      cartes.push({
        lv: g.lv,
        cahier: g.cahier,
        generee: true,
        etiquette: etiquetteGeneree(g.figure, i),
      })
  })
  // le FILET : si un tirage a échoué (graine ingrate), on balaie les
  // mécaniques restantes jusqu'à tenir la garantie — au moins UNE générée,
  // et trois tant que le générateur en donne
  if (cartes.filter((c) => c.generee).length < 3) {
    for (const mec of permises) {
      if (cartes.filter((c) => c.generee).length >= 3) break
      if (cartes.some((c) => c.generee && c.cahier?.mecanique === mec)) continue
      const gx = genere(mec, 5 + mec, cartes.filter((c) => c.generee).length)
      if (gx)
        cartes.push({
          lv: gx.lv,
          cahier: gx.cahier,
          generee: true,
          etiquette: etiquetteGeneree(gx.figure, 0),
        })
    }
  }
  // il faut au moins une porte pour continuer la descente ; une seule carte
  // reste un choix jouable (la séquence épuisée sur une graine ingrate)
  return cartes.length >= 1 ? cartes : null
}

function mbMontreSallesVoie(cartes: CarteVoie[]): void {
  mbEtape = 'salles'
  // le CHANGEMENT DE STADE s'annonce : franchir un tiers du plan est un
  // événement de la descente, pas un détail de nomenclature
  const rangSuivant = voieRang + 1
  const stadeNeuf =
    voieRang >= 1 &&
    momentAuRang(rangSuivant, voiePlan) !==
      momentAuRang(Math.max(1, voieRang), voiePlan)
      ? momentAuRang(rangSuivant, voiePlan) === 2
        ? ' · LE MILIEU S’OUVRE'
        : ' · LA FIN S’OUVRE'
      : ''
  mbEl('mb-choix-titre').textContent =
    `LA VOIE SE SÉPARE — SALLE ${rangSuivant} / ${voiePlan.longueur}` +
    (descenteDuJour() ? ' · DESCENTE DU JOUR' : '') +
    stadeNeuf
  // les JAUGES restent en scène, comme à la fin ordinaire : le choix se
  // prend en voyant ce qu'on possède — étalonnage en grand, réserve en ligne
  mbEl('mb-etal').hidden = false
  mbPeintEtal(run.xp)
  // le COMPACT : le bilan déjà lu se replie, les cartes prennent la scène
  mbVeil.querySelector('.mb-panneau')?.classList.add('mb-compact')
  const host = mbCartes()
  host.innerHTML = ''
  // trois cartes : trois colonnes ; quatre (l'écrite en plus) : carré 2×2
  host.classList.toggle('mb-trio', cartes.length === 3)
  const jauges = document.createElement('div')
  jauges.className = 'mb-jauges'
  jauges.innerHTML = `<span>🫙 réserve <b>${run.bonbonneLiters.toFixed(2)} / ${capBonbonne()} L</b></span><span>💠 ×${run.vies} · profondeur ${voieRang} / ${voiePlan.longueur}</span>`
  host.appendChild(jauges)
  const esc = (t: string): string =>
    t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  for (const c of cartes) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'mb-carte mb-salle'
    btn.innerHTML =
      `<canvas width="220" height="126"></canvas>` +
      `<em class="mb-voie-tag${c.generee ? ' mb-voie-gen' : ''}">${c.etiquette}</em>` +
      `<b>${esc(c.lv.code)}</b><small>${esc(c.lv.name)}</small>` +
      (c.cahier
        ? `<span class="salle-chips"><i>${MOMENT_COURT[c.cahier.moment]}</i>` +
          `<i class="sc-m${c.cahier.mecanique}">${MECANIQUE_NOMS[c.cahier.mecanique].toUpperCase()}</i>` +
          `<i>DIFF ${c.cahier.difficulte}</i></span>`
        : '')
    dessineMiniCarte(btn.querySelector('canvas') as HTMLCanvasElement, c.lv)
    btn.addEventListener('click', () => {
      if (c.generee) {
        voieGenereeChoisie = c.lv
        noteSalleElue(c.lv) // le butin retient l'élue : rejouable, publiable
      } else salleChoisie = c.lv
      bande.ponctuation('sting-collecte', 0.7)
      fermeMiseEnBonbonne()
      avanceSalle()
    })
    host.appendChild(btn)
  }
}

function mbMontreSalles(props: LevelDef[]): void {
  mbEtape = 'salles'
  mbEl('mb-choix-titre').textContent =
    'PAROI DU SAS OUVERTE — CHOISISSEZ LA PROCHAINE SALLE'
  mbVeil.querySelector('.mb-panneau')?.classList.add('mb-compact')
  const host = mbCartes()
  host.innerHTML = ''
  for (const lv of props) {
    const c21 = decodeCode21(lv.code)
    const a = c21?.atelier
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'mb-carte mb-salle'
    const esc = (t: string): string =>
      t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    btn.innerHTML =
      `<canvas width="220" height="126"></canvas>` +
      `<b>${esc(lv.code)}</b><small>${esc(lv.name)}</small>` +
      (a
        ? `<span class="salle-chips"><i>${MOMENT_COURT[a.moment]}</i>` +
          `<i class="sc-m${a.mecanique}">${MECANIQUE_NOMS[a.mecanique].toUpperCase()}</i>` +
          `<i>DIFF ${a.difficulte}</i></span>`
        : '')
    dessineMiniCarte(btn.querySelector('canvas') as HTMLCanvasElement, lv)
    btn.addEventListener('click', () => {
      salleChoisie = lv
      bande.ponctuation('sting-collecte', 0.7)
      fermeMiseEnBonbonne()
      avanceSalle()
    })
    host.appendChild(btn)
  }
}

/** La FIN : l'état des jauges, et CONTINUER mène à la salle suivante. */
function mbMontreFin(): void {
  mbEtape = 'fin'
  mbEl('mb-choix-titre').textContent = 'PAROI DU SAS OUVERTE'
  // la jauge d'étalonnage reste en scène (l'XP se lit dessus, en grand)
  mbEl('mb-etal').hidden = false
  mbPeintEtal(run.xp)
  const host = mbCartes()
  host.innerHTML = ''
  const info = document.createElement('div')
  info.className = 'mb-jauges'
  info.innerHTML = `<span>🫙 réserve <b>${run.bonbonneLiters.toFixed(2)} / ${capBonbonne()} L</b></span><span>se reverse dans le corps, en jeu</span>`
  host.appendChild(info)
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'mb-continuer'
  btn.textContent = 'SALLE SUIVANTE'
  btn.addEventListener('click', () => {
    fermeMiseEnBonbonne()
    avanceSalle()
  })
  host.appendChild(btn)
}

function montreMiseEnBonbonne(b: BilanSalle): void {
  miseEnBonbonne = true
  mbEtape = 'bilan'
  mbDraftsRestants = 0
  mbBilanCourant = b
  mbVeil.hidden = false
  mbCartes().classList.remove('mb-trio') // la disposition du choix repart à neuf
  mbVeil.querySelector('.mb-panneau')?.classList.remove('mb-compact')
  // état de départ
  mbEl('mb-eau').style.height = '0%'
  mbEl('mb-l').textContent = '0,00 L'
  mbEl('mb-prime').hidden = true
  mbEl('mb-glace').hidden = true
  mbEl('mb-choix').hidden = true
  mbEl('mb-cond').hidden = true
  mbEl('mb-cond').classList.remove('mb-on')
  mbEl('mb-etal').hidden = true
  mbEl('mb-etal').classList.remove('coule')
  mbEl('mb-etal-tampon').hidden = true
  mbEl('mb-etal-gain').hidden = true
  mbEl('mb-passer').hidden = false
  const apres = (ms: number, fn: () => void): void => {
    mbTimers.push(window.setTimeout(fn, ms))
  }
  // Temps 1 — la COMPRESSION : le niveau monte, le compteur égrène
  apres(150, () => {
    mbEl('mb-eau').style.height = `${Math.min(100, b.pct * 100).toFixed(0)}%`
  })
  const t0 = performance.now() + 150
  const litres = (): void => {
    const t = Math.min(1, (performance.now() - t0) / 1300)
    const e = 1 - (1 - t) * (1 - t) // sortie douce
    mbEl('mb-l').textContent = `${(b.surplus * e).toFixed(2)} L`
    if (t < 1 && mbEtape === 'bilan') requestAnimationFrame(litres)
  }
  requestAnimationFrame(litres)
  if (b.prime >= 0.01) {
    apres(1550, () => {
      const pr = mbEl('mb-prime')
      pr.hidden = false
      pr.textContent = `+${b.prime.toFixed(2)} L — PRIME DE GLACE`
      mbEl('mb-glace').hidden = false
      audio.iceImpact(1)
    })
  }
  // Temps 2 — la LECTURE DU PROTOCOLE : les lignes tombent une à une
  const tampon = (neuf: boolean): string =>
    neuf ? `<em class="mb-record">RECORD DU PROTOCOLE</em>` : ''
  const lignes = [
    `<span>💧 <b>${b.surplus.toFixed(2)} L</b> · ${Math.round(b.pct * 100)} % du volume de départ</span>${tampon(b.newVolume)}${b.newVolume ? '' : `<small>record : ${b.recVol}</small>`}`,
    `<span>⏱ <b>${fmtTime(b.temps)}</b></span>${tampon(b.newChrono)}${b.newChrono ? '' : `<small>record : ${b.recChr}</small>`}`,
    `<span>◈ NOTE <b>${b.note}</b></span>`,
  ]
  const hostLignes = mbEl('mb-lignes')
  hostLignes.innerHTML = lignes
    .map((l) => `<div class="mb-ligne">${l}</div>`)
    .join('')
  Array.from(hostLignes.children).forEach((el2, i) => {
    apres(2000 + i * 260, () => el2.classList.add('mb-on'))
  })
  // Temps 3 — le CONDENSAT : les centilitres s'égrènent vers la réserve
  apres(2950, () => {
    const cond = mbEl('mb-cond')
    cond.hidden = false
    cond.classList.add('mb-on')
    mbEl('mb-cond-gain').textContent = `+${b.gainCl} cL`
    const c0 = performance.now()
    const roule = (): void => {
      const t = Math.min(1, (performance.now() - c0) / 1100)
      const e = 1 - (1 - t) * (1 - t)
      mbEl('mb-cond-n').textContent = String(
        Math.round(b.totalCl - b.gainCl * (1 - e)),
      )
      if (t < 1 && mbEtape === 'bilan') requestAnimationFrame(roule)
    }
    requestAnimationFrame(roule)
  })
  // Temps 4 — LE VERSEMENT
  apres(4300, mbMontreVersement)
}
// un toucher pendant les temps 1-3 saute au versement ; jamais l'inverse
mbVeil?.addEventListener('pointerdown', (e) => {
  if (
    mbEtape === 'bilan' &&
    (e.target as HTMLElement).closest('.mb-carte') === null
  ) {
    mbMontreVersement()
  }
})
const dashAimEl = el('dash-aim')
const dashCostEl = el('dash-cost')

// ---- LE FIL DE LA DESCENTE : elle se lit d'un regard --------------------
// Un rail à CRANS sur le flanc droit — un cran par salle de la séquence (la
// suite écrite comme le plan de la voie), les tiers
// (début · milieu · fin) marqués d'une couture, le cran courant qui pulse
// menthe, les franchis pleins, la profondeur record étoilée ✦. Et à chaque
// entrée de salle, la CARTE D'IDENTITÉ complète (nom, code, moment,
// mécanique, difficulté, rang) passe en fondu — sans rien bloquer.
const voieHudEl = document.getElementById('voie-hud') as HTMLDivElement
const voieCarteEl = document.getElementById('voie-carte') as HTMLDivElement
let voieCarteTimer = 0

/** L'identité atelier d'une salle, quel que soit son code : « 21XX-MMD »,
 * « MMD » nu, ou généré « G-MMD-VAR » (suffixe d'options toléré). */
function identiteAtelier(lv: LevelDef): CodeAtelier | null {
  const d = decodeCodeAtelier(lv.code)
  if (d) return d
  const g = /^G-([123])([0-3])(\d)-/.exec(lv.code.trim().toUpperCase())
  if (!g) return null
  return {
    moment: Number(g[1]) as CodeAtelier['moment'],
    mecanique: Number(g[2]) as CodeAtelier['mecanique'],
    difficulte: Number(g[3]),
  }
}

/** LE RAIL SE MONTRE DANS TOUTE DESCENTE, pas seulement en VOIE. Il était
 *  enfermé dans le mode voie depuis le premier jour : hors de ce mode, plus
 *  rien sur le flanc droit ne disait où l'on en était de la séquence — la
 *  question la plus élémentaire d'un jeu de salles. Seuls le hub et l'essai
 *  d'éditeur s'en passent (on sait où l'on est), et une séquence d'une seule
 *  salle n'a pas de progression à montrer. */
function voieHudVisible(): boolean {
  if (!hasPlayed || auHub || testLevel !== null) return false
  return voiePlan.longueur > 1
}

/** Reconstruit le rail : appelé à chaque entrée de salle (restart). */
function majVoieHud(): void {
  const montre = voieHudVisible()
  voieHudEl.hidden = !montre
  if (!montre) return
  const total = voiePlan.longueur
  const rang = Math.min(total, voieRang + 1) // la salle en cours
  el('vh-rang').textContent = `${rang} / ${total}`
  const id = identiteAtelier(level)
  el('vh-stade').textContent =
    MOMENT_COURT[momentDuRang(rang, total)] +
    (id ? ` · DIFF ${id.difficulte}` : '')
  const rail = el('vh-rail')
  rail.innerHTML = ''
  // l'étoile marque la PROFONDEUR RECORD : elle n'a de sens qu'en voie, où
  // la descente se rejoue depuis le début et se compare à elle-même
  const record = chargePalmaresVoie().profondeurRecord
  for (let r = 1; r <= total; r++) {
    if (r > 1 && momentDuRang(r, total) !== momentDuRang(r - 1, total)) {
      const sep = document.createElement('i')
      sep.className = 'vh-tiers'
      rail.appendChild(sep)
    }
    const c = document.createElement('i')
    c.className =
      'vh-cran' + (r < rang ? ' vh-franchi' : r === rang ? ' vh-courant' : '')
    if (r === record && record > 0) {
      c.classList.add('vh-record')
      c.title = 'profondeur record du poste'
    }
    rail.appendChild(c)
  }
}

/** La carte d'entrée : l'identité complète de la salle, en fondu. Elle se
 * montre à CHAQUE entrée de tableau — descente ordinaire comprise : c'est
 * la présentation du niveau, pas un ornement du mode voie. Seuls le hub et
 * l'essai d'éditeur s'en passent (on sait où l'on est). */
function annonceVoieCarte(): void {
  if (auHub || testLevel !== null) return
  clearTimeout(voieCarteTimer)
  const total = voiePlan.longueur
  const rang = Math.min(total, voieRang + 1)
  el('vc-rang').textContent =
    `SALLE ${rang} / ${total}` +
    (estEconomat(level) ? ' · L’ÉCONOMAT' : '') +
    (voieIntercalaire ? ' · SALLE GÉNÉRÉE' : '') +
    (descenteDuJour() ? ' · DESCENTE DU JOUR' : '')
  el('vc-nom').textContent = level.name
  el('vc-code').textContent = level.code
  const id = identiteAtelier(level)
  const chips = el('vc-chips')
  chips.innerHTML = id
    ? `<i>${MOMENT_COURT[id.moment]}</i>` +
      `<i class="sc-m${id.mecanique}">${MECANIQUE_NOMS[id.mecanique].toUpperCase()}</i>` +
      `<i>DIFF ${id.difficulte}</i>`
    : ''
  chips.hidden = !id
  voieCarteEl.hidden = false
  voieCarteEl.classList.remove('joue')
  void voieCarteEl.offsetWidth // repartir l'animation du fondu
  voieCarteEl.classList.add('joue')
  voieCarteTimer = window.setTimeout(() => {
    voieCarteEl.hidden = true
  }, 4400)
}

function restart(): void {
  run.exitTimer = 0
  run.tableauTime = 0
  // remis à zéro AVEC l'horloge qu'il mesure : sans cela, après un versement
  // au temps T, la visite suivante du hub calculait depuisDernier = −T et
  // taisait le versement pendant T secondes — donc la bannière d'alerte
  // s'affichait au hub, précisément ce que la mécanique promet d'éviter
  dernierVersementAuto = -99
  // la BONBONNE se présente : le niveau repart de zéro et remonte à vue,
  // l'éclat balaie le verre — un rappel discret de ce qu'on a en réserve
  bbAffiche = 0
  bbPresenteA = 0
  bonbonneEl.classList.remove('presente')
  void bonbonneEl.offsetWidth // relancer l'animation, même deux fois de suite
  if (run.bonbonneLiters > 0) bonbonneEl.classList.add('presente')
  run.ended = false
  ecranDispersion = 'aucun'
  dispersionDelai = 0
  perduAvant = false
  endgame.lastCall = false
  endgame.sasVu = 0
  endgame.sasBoitJusqua = -1
  continuerVoulu = false
  btnContinuer.classList.remove('visible')
  endgame.spent = false
  endgame.wasAiming = false
  vortex.timer = 0
  lossPrevLiters = -1
  lossRate = 0
  input.freezeIntent = false
  input.gasIntent = false
  // un éveil en cours reprend du début : la cryostase ressaisit l'échantillon
  if (eveil.etape !== 'off') lanceEveil()
  // chaque début de salle grave la progression de l'expédition principale
  sauveRun()
  applyLevel()
  majVoieHud()
  sim = createSim(level)
  exposeSim()
  resetLasers()
  loop.reset()
  overlay.classList.remove('visible')
  // les déclencheurs (cinématiques, séquences) se réarment à chaque essai
  cinesVues.clear()
  // la mise en scène repart de zéro : lampes rendues, brèches refermées
  sequenceur.reinitialise()
  appliqueSequence()
  if (document.body.classList.contains('playing')) {
    camera.startIntro(sim.bounds, window.innerWidth, window.innerHeight)
    // le RÉVEIL : tirage du petit scénario joué pendant l'intro caméra —
    // chronométré en temps RÉEL, comme le zoom qu'il accompagne
    reveil.actif = true
    reveil.t0 = performance.now() / 1000
    reveil.frissonT = Math.random() < 0.7 ? 0.4 + Math.random() * 1.2 : -1
    reveil.frissonFait = false
    const bv = level.bounds
    reveil.balayageX =
      bv.minX + (0.2 + 0.6 * Math.random()) * (bv.maxX - bv.minX)
    reveil.balayageY =
      bv.minY + (0.2 + 0.6 * Math.random()) * (bv.maxY - bv.minY)
    reveil.bascule = 0.8 + Math.random() * 0.9
    // une vignette physique au réveil, une fois sur deux — le corps se
    // rassemble ou s'étire en sortant de sa torpeur
    if (Math.random() < 0.55) {
      idle.type = Math.random() < 0.5 ? 'toilette' : 'etire'
      idle.t0 = elapsed
    }
    showTableauCard()
    annonceVoieCarte()
    // la cinématique d'ENTRÉE du tableau : à l'arrivée seulement — un R sur
    // place ne la rejoue pas (et MAINTENIR la saute de toute façon)
    if (level !== cineNiveauVu) {
      cineNiveauVu = level
      if (level.cineAvant) void lireCineParCode(level.cineAvant)
    }
    // la SÉQUENCE du tableau démarre à chaque essai : elle fait partie du
    // tableau, pas de l'arrivée — la rejouer après un R est le bon geste
    if (level.sequence) demarreSequence(level.sequence)
  } else {
    camera.snapTo(sim.stats.centroidX, sim.stats.centroidY, camera.zoom)
  }
  majInstrumentsUI()
}

// Nouvelle expédition : retour au premier tableau, réserve vidée, vaisseau
// retiédi. Le protocole recommence avec l'échantillon suivant (§10).
// Crochet d'atelier : lancer l'expédition SANS traverser le hub — les
// essais automatisés (et le pupitre, au besoin) sautent le sas de lancement.
;(window as unknown as { __expedition: () => void }).__expedition = () => {
  auHub = false
  hasPlayed = true
  // un essai en cours (Économat, prototype) resterait sinon le tableau joué,
  // et la descente se croirait « hors run » — dossier sans butin, registres
  // muets. Lancer l'expédition, c'est quitter l'essai.
  testLevel = null
  document.body.classList.add('playing')
  newExpedition()
}

// Crochet d'atelier : entrer directement à l'ÉCONOMAT (essai hors run) —
// pour les sondes et le pupitre ; les registres ne bougent pas.
;(window as unknown as { __economat: () => void }).__economat = () => {
  auHub = false
  hasPlayed = true
  document.body.classList.add('playing')
  testLevel = economatLevel()
  restart()
}

function newExpedition(): void {
  levelIndex = 0
  voieRang = 0 // une descente neuve repart du premier rang du plan
  voieVues.clear()
  run.bonbonneLiters = 0
  run.runTime = 0
  // la fiole de SECOND SOUFFLE ajoute son échantillon de secours au départ
  run.vies = Math.min(VIES_MAX, 1 + (fioleActive('second-souffle') ? 1 : 0))
  run.conclues = 0
  run.instruments = []
  run.xp = 0
  run.livreTotal = 0
  run.memoireGagnee = 0
  // les éclats de mémoire repoussent : une nouvelle run, une nouvelle chance
  eclatsPrisRun.clear()
  purgeCondensat() // la bourse d'une run commence toujours vide
  economatIntercalaire = null
  economatVisiteCetteRun = false
  clefCachette = false
  // les PROVISIONS du comptoir se livrent maintenant — après la remise à
  // zéro (le viatique s'ajoute à une bonbonne vide), avant la première salle
  appliqueProvisions()
  restart()
}

// Fin de run (dernier échantillon dispersé, ou expédition conclue) : le
// laboratoire rappelle — on se réveille AU HUB, prêt à relancer par le sas.
function retourAuLabo(): void {
  // ---- L'ARC DES DÉCOUVERTES : chaque retour de run (bouclée, dispersée
  // ou abandonnée) livre le prochain jalon du récit — la fiche se
  // consigne au codex (groupe RÉCIT), le toast est celui des fiches.
  // (jamais depuis un ESSAI d'éditeur ni avant l'acte 0 : le récit ne se
  // livre qu'aux vraies descentes)
  const jalon = prochaineDecouverte(records.decouvertesVues())
  if (jalon && eveilJoue() && !testLevel) {
    records.noteDecouverte(jalon)
    codex.marque(`recit-${jalon}`)
  }
  // LE DISTILLATEUR (réparé) : la prime du retour — le delta garanti
  if (records.estRepare('distillateur') && !testLevel) {
    gagneMemoireRun(2)
    toastFile.push({
      nom: '+2 MÉMOIRE — la prime du retour',
      icone: '⚗️',
      sur: 'LE DISTILLATEUR',
    })
  }
  voieIntercalaire = null
  voieGenereeChoisie = null
  voieDuJourForcee = false // la descente du jour forcée valait UNE run
  voieRang = 0 // la profondeur est déjà consignée au palmarès, en direct
  voieVues.clear()
  levelIndex = 0
  run.bonbonneLiters = 0
  run.runTime = 0
  run.vies = 1
  run.conclues = 0
  run.instruments = []
  run.xp = 0
  run.livreTotal = 0
  run.ended = false
  run.memoireGagnee = 0
  // LA PURGE : le labo confisque la matière de la run — la mémoire reste
  purgeCondensat()
  economatIntercalaire = null
  economatVisiteCetteRun = false
  clefCachette = false
  entrerHub()
  majBoutonsRun()
}
// L'ÉCRAN DE DISPERSION paraît TOUT SEUL, une seconde après la perte du
// corps — le temps de voir le nuage se défaire. Avant, il fallait deviner
// qu'il fallait presser R : la run semblait sans fin, le game over
// « ne fonctionnait pas ». Deux visages selon la réserve d'échantillons :
// « RELANCE » (il en reste) ou « FIN » (c'était le dernier).
let ecranDispersion: 'aucun' | 'relance' | 'fin' = 'aucun'
let dispersionDelai = 0
let perduAvant = false
// Battement avant l'écran, selon CE QUI a été perdu :
// — le corps s'est défait (dispersed) : une seconde, on l'a vu partir ;
// — la RÉSERVE est à sec (endgame.spent) : le corps gelé dérive encore et
//   une paroi peut le renvoyer au sas. On lui laisse ce sursis, puis le
//   protocole conclut. Sans lui, la run ne se terminait JAMAIS : le palet
//   dérivait sans fin et « ÉCHANTILLON PERDU » n'arrivait pas — c'était le
//   game over qui « ne fonctionnait pas ».
const DELAI_DISPERSION = 1.1
const SURSIS_EPUISE = 6

// Sonde de test : l'état de la fin de run depuis la console (comme __run)
const sondeFin = {
  get ecran() {
    return ecranDispersion
  },
  get delai() {
    return dispersionDelai
  },
  get hub() {
    return auHub
  },
  get spent() {
    return endgame.spent
  },
  get lastCall() {
    return endgame.lastCall
  },
  get vise() {
    return input.aimActive
  },
  get collecte() {
    return endgame.enCollecte
  },
  get sortie() {
    return run.exitTimer
  },
  get finie() {
    return run.ended
  },
}
;(window as unknown as { __fin: typeof sondeFin }).__fin = sondeFin

function afficheDispersion(): void {
  if (ecranDispersion !== 'aucun') return
  dispersionDelai = 0
  if (run.vies > 1) {
    ecranDispersion = 'relance'
    showOverlay(
      'ÉCHANTILLON DISPERSÉ',
      `Le laboratoire engage un échantillon de secours — il en restera ${run.vies - 1}. Reprise à la première goutte de la salle.`,
      'danger',
      `REPRENDRE — SALLE ${levelIndex + 1}`,
    )
    return
  }
  // dernier échantillon : GAME OVER — la sauvegarde de la principale
  // s'efface (la run est perdue), la secondaire n'y touche pas
  ecranDispersion = 'fin'
  effaceRun()
  // LE SCÉNARIO : la cinématique de défaite, par-dessus l'écran de fin
  void joueMoment('run-perdue')
  showOverlay(
    'ÉCHANTILLON PERDU — FIN DE LA RUN',
    `La dispersion a eu raison du dernier échantillon. Le laboratoire vous rappelle.`,
    'danger',
    'RETOUR AU LABO',
  )
}

/** QUITTER LA DESCENTE : la partie s'arrête et l'on revient au MENU (pas au
 * module — quitter, c'est vraiment sortir). La descente en cours est perdue,
 * les acquis (mémoire, liens, fioles, records) restent : ils survivent à
 * tout. Le bouton principal redira alors COMMENCER. */
function quitteAuMenu(): void {
  effaceRun()
  ecranDispersion = 'aucun'
  overlay.classList.remove('visible')
  // l'état de descente se remet à zéro sans passer par le module
  voieIntercalaire = null
  voieGenereeChoisie = null
  voieDuJourForcee = false
  voieRang = 0
  voieVues.clear()
  levelIndex = 0
  economatIntercalaire = null
  economatVisiteCetteRun = false
  clefCachette = false
  run.ended = false
  purgeCondensat()
  auHub = false
  testLevel = null
  hasPlayed = false // la partie est close : le bouton redit COMMENCER
  document.body.classList.remove('playing')
  input.paused = true
  homeRestartBtn.hidden = true
  majVoieHud()
  majBoutonsRun()
  openHome()
}

// Recommencer un tableau relance l'essai ; une expédition conclue (bilan
// affiché) ou un échantillon dispersé repart pour une expédition neuve.
// En mode prototype (21-A bis) : l'essai conclu ramène au protocole, la
// dispersion remet l'échantillon en cuve pour un nouvel essai du bis.
function resetAction(): void {
  if (miseEnBonbonne) return // la mise en bonbonne se conclut par une carte
  if (testLevel) {
    if (run.ended) {
      if (fromEditor) {
        openEditor() // l'essai vient de l'éditeur : on y retourne
        return
      }
      if (fromPlanche) {
        retournePlanche() // l'essai vient de la planche : on y retourne
        return
      }
      // la file d'essai continue : le sas mène à la salle suivante —
      // en jouant d'abord les cinématiques qui la précèdent
      if (testQueue.length > 0) {
        joueCinesEnTete(() => {
          const lv = testQueue.shift()
          if (!lv || estCine(lv)) {
            // il ne restait que des cinématiques : la file est finie
            testLevel = null
            newExpedition()
            openHome()
            return
          }
          testLevel = lv
          run.runTime = 0
          restart()
        })
        return
      }
      testLevel = null
      newExpedition()
      openHome()
      return
    }
    run.runTime = 0
    restart()
    return
  }
  if (ecranDispersion !== 'aucun') {
    // l'écran de dispersion est à l'écran : le bouton fait ce qu'il annonce
    const quoi = ecranDispersion
    ecranDispersion = 'aucun'
    overlay.classList.remove('visible')
    if (quoi === 'fin') {
      retourAuLabo()
      return
    }
    // un échantillon de secours prend le relais : retour à la première
    // goutte du tableau — la run continue
    run.vies -= 1
    restart()
    return
  }
  if (auHub) {
    // au hub, rien ne se paie : la dispersion recompose, R recommence
    restart()
    return
  }
  if (run.ended) {
    // expédition conclue : le bilan ramène au labo — le sas relancera
    retourAuLabo()
    return
  }
  if (sim.dispersed) {
    // R pressé avant la fin du battement : l'écran paraît tout de suite
    afficheDispersion()
    return
  }
  restart()
}

document.getElementById('overlay-btn')!.addEventListener('click', resetAction)

const pane = createBench(params, monitor, {
  reset: resetAction,
  autoZoom: () => camera.resetAutoZoom(),
  oeil: { regl: oeilRegl, defauts: OEIL_DEFAUTS, sauve: sauveOeil },
  // le PUPITRE au banc : mêmes manœuvres, catalogue lu sur le panneau
  pupitre: { sections: cataloguePupitre(), lance: actionPupitre },
  perf: { copier: copiePerf, envoyer: envoiePerf },
  ciel: cielReglages,
  parallaxe: parallaxeReglages,
  tableaux: TABLEAUX.map((t) => t.name),
  gotoTableau: (index) => {
    testLevel = null // le banc navigue dans l'expédition, pas dans le prototype
    auHub = false
    fromEditor = false
    levelIndex = index
    restart()
  },
  gotoBis: () => startBisTest(),
  sound: {
    get actif() {
      return audio.enabled
    },
    set actif(v: boolean) {
      audio.resume()
      audio.setEnabled(v)
      if (v) {
        bande.eveiller()
      }
      majInviteSon()
    },
    get volume() {
      return audio.volume
    },
    set volume(v: number) {
      audio.setVolume(v)
    },
  },
})
input.onReset = resetAction
input.onZoom = (factor, cx, cy) =>
  camera.zoomAt(factor, cx, cy, window.innerWidth, window.innerHeight, params)
input.onPan = (dx, dy) => camera.panBy(dx, dy)
input.onPanEnd = (vx, vy) => camera.flingBy(vx, vy)
input.onVortex = (clientX, clientY) => {
  if (params.vortexEnabled < 0.5) return // outil de test, coupé dans le protocole
  const w = camera.screenToWorld(
    clientX,
    clientY,
    window.innerWidth,
    window.innerHeight,
  )
  vortex.x = w.x
  vortex.y = w.y
  vortex.timer = params.vortexDuration
  audio.vortex()
  bande.bruitage('vortex-sas', 0.55)
}

// Barre tactile : les commandes clavier/souris accessibles au doigt
const touchbar = document.getElementById('touchbar') as HTMLDivElement
function touchButton(
  label: string,
  title: string,
  onTap: () => void,
  cls = '',
): HTMLButtonElement {
  const b = document.createElement('button')
  b.textContent = label
  b.title = title
  if (cls) b.className = cls
  b.addEventListener('click', onTap)
  touchbar.appendChild(b)
  return b
}

// Panneaux de lecture : la légende des surfaces et les trois états (qui
// bloque quoi). Chips étiquetées en tête de barre — mises en évidence, sans
// rivaliser avec le sélecteur d'état. Un seul panneau ouvert à la fois.
const legend = document.getElementById('legend') as HTMLDivElement
const statesPanel = document.getElementById('states') as HTMLDivElement
function togglePanel(el: HTMLDivElement, other: HTMLDivElement): void {
  const show = !el.classList.contains('visible')
  other.classList.remove('visible')
  el.classList.toggle('visible', show)
}
const toggleLegend = (): void => togglePanel(legend, statesPanel)
const toggleStates = (): void => togglePanel(statesPanel, legend)
document.getElementById('legend-close')!.addEventListener('click', toggleLegend)
document.getElementById('states-close')!.addEventListener('click', toggleStates)

// Banc de réglage : plus de panneau flottant permanent en haut — le bouton
// BANC de la barre le montre et le masque.
const benchHost = pane.element.closest('.tp-dfwv') as HTMLElement | null
if (benchHost) benchHost.style.display = 'none'
function toggleBench(): void {
  if (!benchHost) return
  benchHost.style.display = benchHost.style.display === 'none' ? '' : 'none'
}

const chipLegend = touchButton(
  'LÉGENDE',
  'légende des surfaces (L)',
  toggleLegend,
  'tb-chip',
)
const chipStates = touchButton(
  'ÉTATS',
  'les trois états : qui bloque quoi (E)',
  toggleStates,
  'tb-chip',
)
const chipBench = touchButton(
  'BANC',
  'banc de réglage : la physique en direct',
  toggleBench,
  'tb-chip',
)
// Retour à l'éditeur : n'apparaît que pendant l'essai d'un tableau édité
const chipEditor = touchButton(
  '↩ ÉDITEUR',
  'revenir à l’éditeur (le tableau est retrouvé tel qu’il était)',
  () => openEditor(),
  'tb-chip tb-editor',
)
chipEditor.style.display = 'none'
// LE HUB À TOUT MOMENT (outil de conception) : le module d'accueil est
// atteignable depuis n'importe quelle salle, sans repasser par la fiche ni
// abandonner la run. Réservé au mode concepteur (data-dev, comme les autres
// outils) : en partie publique, quitter une salle d'un doigt casserait la
// descente. La run n'est pas purgée — bonbonne, XP et instruments restent ;
// c'est le sas du hub qui relance une descente.
const chipHub = touchButton(
  '⌂ HUB',
  'aller au hub tout de suite (mode concepteur) — la salle en cours est quittée, la run n’est pas purgée',
  () => {
    if (miseEnBonbonne) fermeMiseEnBonbonne()
    entrerHub()
  },
  'tb-chip tb-hub',
)
chipHub.dataset.dev = ''

// La barre du bas passe sur deux lignes quand elle se remplit (le bouton de
// retour à l'éditeur, par exemple). On publie sa hauteur réelle en variable
// CSS : le sélecteur d'état se recale dessus au lieu de la chevaucher.
function publishTouchbarHeight(): void {
  const h = Math.round(touchbar.getBoundingClientRect().height)
  if (h > 0) document.documentElement.style.setProperty('--tb-h', `${h}px`)
}
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(publishTouchbarHeight).observe(touchbar)
} else {
  window.addEventListener('resize', publishTouchbarHeight)
}
publishTouchbarHeight()
{
  // au doigt, les chips ont leur rangée, les glyphes la leur
  const brk = document.createElement('i')
  brk.className = 'tb-break'
  touchbar.appendChild(brk)
}
const btnPause = touchButton('⏸', 'pause (espace)', () => input.togglePause())
// Le TEMPS en un seul bloc : ralentir · la vitesse courante · accélérer.
// La vitesse est une INFO permanente (elle s'allume dès qu'on quitte ×1),
// et le groupe reste au doigt — savoir à quelle vitesse on joue n'est pas
// un réglage de banc.
const tbTime = document.createElement('div')
tbTime.id = 'tb-time'
touchbar.appendChild(tbTime)
const timeButton = (
  label: string,
  title: string,
  onTap: () => void,
): HTMLButtonElement => {
  const b = document.createElement('button')
  b.textContent = label
  b.title = title
  b.addEventListener('click', onTap)
  tbTime.appendChild(b)
  return b
}
timeButton('‹', 'ralentir le temps (,)', () => input.stepWarp(-1))
const tbSpeed = document.createElement('span')
tbSpeed.id = 'tb-speed'
tbSpeed.textContent = '×1'
tbSpeed.title = 'vitesse du temps simulé'
tbTime.appendChild(tbSpeed)
timeButton('›', 'accélérer le temps (.)', () => input.stepWarp(1))
// le DOSSIER a son bouton dans la barre : au doigt comme au Deck, on n'a
// pas toujours un clavier sous la main
touchButton('▤', 'dossier de descente (Tab)', () =>
  ouvreDossier(!dossierOuvert),
)
const btnVortex = touchButton(
  '🌀',
  'vortex : armer puis toucher l’écran (clic droit)',
  () => {
    input.vortexArmed = !input.vortexArmed
  },
  'tb-vortex',
)

// ---- LE CADRAN DU CYCLE (refonte du sélecteur d'état) -------------------
// Trois LOGEMENTS fixes — ❄ à gauche, 💧 au centre, 💨 à droite : la
// mémoire musculaire tient, au doigt comme à la manette (X / B / Y). Mais
// ce qu'ils montrent a changé : le logement de l'état COURANT devient le
// MÉDAILLON (l'identité, pas une commande), et les autres ne paraissent
// que si la TRANSFORMATION qui y mène est tissée — ils portent alors son
// NOM (FUSION, SOLIDIFICATION…), le vocabulaire de l'écran des mémoires.
// Au tout début de partie : le médaillon seul, AUCUN bouton — c'est voulu.
// Le médaillon reste cliquable : re-toucher son état, c'est demander le
// retour au liquide (le geste historique du dégel ne se perd pas).
const stateEau = document.getElementById('state-eau') as HTMLButtonElement
const stateGlace = document.getElementById('state-glace') as HTMLButtonElement
const stateVapeur = document.getElementById('state-vapeur') as HTMLButtonElement
const stateZoneEl = document.getElementById('state-zone') as HTMLDivElement
const statebarEl = document.getElementById('statebar') as HTMLDivElement
stateEau.addEventListener('click', () => input.demande('eau'))
stateGlace.addEventListener('click', () => input.demande('glace'))
stateVapeur.addEventListener('click', () => input.demande('vapeur'))

// Le GARDE du cycle : en descente (hors tableau d'atelier et tableaux
// « états libres »), une transformation MANUELLE exige son lien tissé.
// Les régimes du décor (zones, chaudière, cryostase) n'y passent pas.
const CYCLE_PAR_ETAT = {
  eau: 'liquide',
  glace: 'solide',
  vapeur: 'gaz',
} as const
function cycleGateActif(): boolean {
  return testLevel === null && level.etats !== 'libres'
}
input.peutDevenir = (vers) => {
  if (!cycleGateActif()) return true
  const t = transfoEntre(
    CYCLE_PAR_ETAT[input.etatManuel()],
    CYCLE_PAR_ETAT[vers],
  )
  return (
    t !== null &&
    transfoTenue(t.id, records.eveilAcquis(), records.verrousCycle())
  )
}
// Un refus MONTRE le verrou : le logement visé paraît quelques secondes,
// cadenassé, le nom du lien à tisser dessus — l'envie se sème là.
const verrouEtat = { slot: null as EtatManuel | null, jusqua: 0 }
input.onDevenirRefuse = (vers) => {
  verrouEtat.slot = vers
  verrouEtat.jusqua = performance.now() / 1000 + 2.6
}

// Le cadran ne réécrit le DOM que quand sa SIGNATURE change — pas à
// chaque image. La zone forcée verrouille tout et s'annonce en badge.
let cadranSignature = ''
function majCadranEtats(zoneActive: ZoneForce): void {
  const cur = input.etatManuel()
  const manetteActive = manette.lastActivity > input.lastPointerAt
  const verrou =
    verrouEtat.slot !== null && performance.now() / 1000 < verrouEtat.jusqua
      ? verrouEtat.slot
      : null
  const acquis = records.eveilAcquis()
  const verrousCycle = records.verrousCycle()
  const gate = cycleGateActif()
  const zone = zoneActive !== 'libre'
  const sig = [
    cur,
    manetteActive,
    verrou,
    zoneActive,
    gate,
    acquis.join('+'),
    verrousCycle.join('+'),
  ].join('|')
  if (sig === cadranSignature) return
  cadranSignature = sig
  const NOMS_ETAT = {
    eau: 'LIQUIDE',
    glace: 'GLACE',
    vapeur: 'VAPEUR',
  } as const
  const slots = [
    { el: stateGlace, etat: 'glace' as const, kbd: 'F', pad: 'X' },
    {
      el: stateEau,
      etat: 'eau' as const,
      kbd: cur === 'vapeur' ? 'G' : 'F',
      pad: 'B',
    },
    { el: stateVapeur, etat: 'vapeur' as const, kbd: 'G', pad: 'Y' },
  ]
  for (const s of slots) {
    const label = s.el.querySelector('.st-label') as HTMLElement | null
    const kbd = s.el.querySelector('kbd') as HTMLElement | null
    if (!label || !kbd) continue
    const estCur = s.etat === cur
    const t = estCur
      ? null
      : transfoEntre(CYCLE_PAR_ETAT[cur], CYCLE_PAR_ETAT[s.etat])
    const tenue =
      t !== null && (!gate || transfoTenue(t.id, acquis, verrousCycle))
    const montreVerrou = !estCur && !tenue && t !== null && verrou === s.etat
    s.el.hidden = !estCur && !tenue && !montreVerrou
    s.el.classList.toggle('active', estCur)
    s.el.classList.toggle('st-cur', estCur)
    s.el.classList.toggle('st-verrou', montreVerrou)
    s.el.disabled = zone || montreVerrou
    label.textContent = !estCur && t ? t.nom : NOMS_ETAT[s.etat]
    kbd.textContent = montreVerrou ? '🔒' : manetteActive ? s.pad : s.kbd
    kbd.hidden = estCur
    s.el.title = estCur
      ? 're-toucher : revenir liquide'
      : montreVerrou
        ? `${t?.nom} — mémoire non tissée. Passez par le liquide, ou tissez le lien à l’écran des MÉMOIRES.`
        : (t?.desc ?? '')
  }
  statebarEl.classList.toggle('st-zone', zone)
  stateZoneEl.hidden = !zone
  if (zone)
    stateZoneEl.textContent = `🔒 ${ZONE_CAUSES[zoneActive]} — RÉGIME IMPOSÉ`
}

// ---- LE DOSSIER DE DESCENTE : tout le relevé, d'un seul geste -----------
// TAB (le bouton ▤ de la barre, R3 à la manette) fait glisser le panneau
// depuis la droite : la salle et son identité, le corps et ses réserves,
// le cycle et ce qu'il permet ICI, le butin, l'équipement embarqué. Il ne
// fige RIEN — la descente continue derrière, c'est un dossier qu'on
// consulte en jouant. Rafraîchi quatre fois par seconde tant qu'il est
// ouvert ; fermé, il ne coûte pas une instruction.
const dossierEl = document.getElementById('dossier') as HTMLElement
const doCorps = document.getElementById('do-corps') as HTMLDivElement
const doChrono = document.getElementById('do-chrono') as HTMLElement
dossierEl.hidden = false // le panneau vit hors-champ : c'est le glissement qui le montre
dossierEl.setAttribute('aria-hidden', 'true')
let dossierOuvert = false
let dossierProchainMaj = 0

// Les briques du dossier : une barre, une rangée de pastilles, une tuile.
// Elles disent toutes la même chose de la même façon — une icône, un mot en
// capitales, la mesure à droite —, pour que l'œil apprenne la grammaire du
// panneau en une lecture.
const doPastilles = (n: number, max: number, cls = ''): string => {
  let h = ''
  for (let i = 0; i < max; i++)
    h += `<i class="${cls}${i < n ? ' plein' : ''}"></i>`
  return h
}

/** Une BARRE : l'icône, le mot, la valeur, la jauge — et sous elle, la
 *  précision chiffrée pour qui veut la lire (elle éclaire la barre, elle ne
 *  la remplace pas). */
function doBarre(
  icone: string,
  nom: string,
  valeur: string,
  frac: number,
  o: { cls?: string; jauge?: string; note?: string } = {},
): string {
  const p = Math.max(0, Math.min(1, frac)) * 100
  return (
    '<div class="do-barre">' +
    `<div><u>${icone}</u>${nom}<b class="${o.cls ?? ''}">${valeur}</b></div>` +
    `<div class="do-jauge ${o.jauge ?? ''}"><i style="width:${p}%"></i></div>` +
    '</div>' +
    (o.note ? `<p class="do-note">${o.note}</p>` : '')
  )
}

/** Une RÉSERVE qui se compte sur les doigts : des pastilles, pas un ratio. */
function doPastilleLigne(
  icone: string,
  nom: string,
  n: number,
  max: number,
  cls: string,
  note: string,
): string {
  return (
    '<div class="do-barre">' +
    `<div><u>${icone}</u>${nom}<div class="do-pastilles">${doPastilles(n, max, cls)}</div></div>` +
    '</div>' +
    `<p class="do-note">${note}</p>`
  )
}

/** Une TUILE de butin : le gain se regarde, il ne se lit pas dans un tableau. */
const doTuile = (icone: string, val: string, quoi: string, cls = ''): string =>
  `<div class="do-tuile ${cls}"><u>${icone}</u><b>${val}</b><span>${quoi}</span></div>`

/** LE RAIL de la descente, en crans — une couture à chaque changement de
 *  moment (début · milieu · fin). En VOIE le plan donne le moment de chaque
 *  rang ; en descente ordinaire, c'est le code de la salle elle-même qui le
 *  dit. Au-delà de soixante salles, le rail ne veut plus rien dire : on
 *  l'omet plutôt que d'aligner des cheveux. */
function momentDuRang(r: number, total: number): 1 | 2 | 3 {
  if (voiePlan.longueur > 0) return momentAuRang(r, voiePlan)
  const lv = playedLevels()[r - 1]
  const id = lv ? identiteAtelier(lv) : null
  if (id) return id.moment
  // sans code lisible, on retombe sur les tiers de la séquence
  return r <= total / 3 ? 1 : r <= (2 * total) / 3 ? 2 : 3
}

function railDescente(rang: number, total: number): string {
  if (total < 2 || total > 60) return ''
  let h = '<div class="do-rail">'
  for (let r = 1; r <= total; r++) {
    if (r > 1 && momentDuRang(r, total) !== momentDuRang(r - 1, total))
      h += '<i class="coupe"></i>'
    h += `<i class="${r < rang ? 'franchi' : r === rang ? 'courant' : ''}"></i>`
  }
  return h + '</div>'
}

/** LE DOSSIER, ÉCRIT POUR CELUI QUI DESCEND. Il répond à trois questions,
 *  dans cet ordre : qu'est-ce que je dois faire ICI, qu'est-ce qu'il me
 *  RESTE, qu'est-ce que j'EMPORTE. D'où un objectif en tête avec sa jauge,
 *  des barres et des pastilles plutôt que des colonnes de chiffres, et des
 *  mots de joueur. Les mesures fines (compte de gouttes, degrés de coque)
 *  restent là, mais en second rang : elles éclairent la barre. */
function majDossier(): void {
  const enRun = !auHub && testLevel === null
  doChrono.textContent = enRun ? fmtTime(run.tableauTime) : '—'
  const litres = sim.liters()

  // ---- TA MISSION : où l'on est, et ce qu'on vient chercher
  const id = identiteAtelier(level)
  const total = voiePlan.longueur
  const rang = Math.min(total, voieRang + 1)
  let mission = '<section class="do-sec do-salle"><h4><u>🎯</u>TA MISSION</h4>'
  if (enRun && total > 1) {
    mission +=
      `<div class="do-place">SALLE <b>${rang} / ${total}</b>` +
      `${descenteDuJour() ? ' · DESCENTE DU JOUR' : ''}</div>` +
      railDescente(rang, total)
  }
  mission +=
    '<div class="do-mission">' +
    `<div class="do-nom">${auHub ? 'LE LABORATOIRE' : level.name}</div>` +
    `<div class="do-code">${level.code}${estEconomat(level) ? ' · L’ÉCONOMAT' : ''}</div>`
  if (id)
    mission +=
      `<div class="do-chips"><i>${MOMENT_COURT[id.moment]}</i>` +
      `<i>${MECANIQUE_NOMS[id.mecanique].toUpperCase()}</i>` +
      `<i>DIFF ${id.difficulte}</i></div>`
  if (enRun) {
    // L'OBJECTIF, en clair : le volume à ramener, et ce qu'il en manque —
    // c'est LA question du joueur, elle passe donc avant tout le reste
    if (level.par) {
      const atteint = litres >= level.par
      const reste = Math.max(0, level.par - litres)
      mission +=
        `<div class="do-objectif${atteint ? ' atteint' : ''}">` +
        `<b>RAMENER<em>${fmtL(level.par)}</em></b>` +
        `<div class="do-jauge j-but${atteint ? ' plein' : ''}" style="margin-top:8px">` +
        `<i style="width:${Math.min(100, (litres / level.par) * 100)}%"></i></div>` +
        `<p>${
          atteint
            ? 'Tu as de quoi. Le sas t’attend — tout litre en plus part à la bonbonne.'
            : `Il t’en manque ${fmtL(reste)} : ne laisse pas de gouttes derrière toi.`
        }</p></div>`
    } else {
      mission +=
        '<div class="do-objectif"><b>ATTEINDRE LE SAS</b>' +
        '<p>Aucun volume minimum ici : ressors, simplement — mais ce que tu ramènes compte quand même.</p></div>'
    }
  }
  mission += '</div>'
  // LES RECORDS, en défis à battre
  if (enRun) {
    const rec = records.tableauRecord(level.code)
    mission +=
      '<div class="do-defis">' +
      (rec
        ? `<div class="do-defi"><span>✦ TON VOLUME</span><b>${fmtL(rec.volume.liters)}</b></div>` +
          `<div class="do-defi"><span>✦ TON CHRONO</span><b>${fmtTime(rec.chrono.time)}</b></div>`
        : '<div class="do-defi vierge"><span>AUCUN RECORD</span><b>à écrire</b></div>') +
      '</div>'
  }
  mission += '</section>'

  // ---- TON CORPS : ce qu'il reste, et ce qui presse
  const depart = sim.baseVolume > 0 ? sim.baseVolume : level.spawn.n
  const frac = depart > 0 ? sim.playerCount / depart : 0
  const coque = Math.round(21 - 81 * chillNow())
  const critique = litres < params.criticalVolumeLiters * 1.7
  const motCoque =
    coque <= -40
      ? 'glaciale'
      : coque <= -10
        ? 'froide'
        : coque <= 5
          ? 'fraîche'
          : 'tiède'
  const corps =
    '<section class="do-sec do-corps"><h4><u>💧</u>TON CORPS</h4>' +
    doBarre('💧', 'VOLUME', fmtL(litres), frac, {
      cls: critique ? 'chaud' : '',
      jauge: critique ? 'j-alerte' : '',
      note:
        `${sim.playerCount} gouttes sur ${depart}` +
        (critique ? ' — sous ce seuil, le protocole conclut. Ramasse.' : ''),
    }) +
    doBarre('❄', 'COQUE', `${coque > 0 ? '+' : ''}${coque}°`, chillNow(), {
      cls: coque < -20 ? 'froid' : '',
      jauge: 'j-froid',
      note: `Coque ${motCoque} : elle ne se rembobine pas d’une salle à l’autre.`,
    }) +
    doPastilleLigne(
      '⚡',
      'DASHS',
      sim.dashBudget,
      Math.max(sim.dashBudgetMax, sim.dashBudget),
      '',
      'Trois par salle. Se changer en vapeur SOI-MÊME les rend ; les subir, non.',
    ) +
    (enRun
      ? doPastilleLigne(
          '🧪',
          'SECOURS',
          run.vies,
          VIES_MAX,
          'vie',
          'Un échantillon te relève d’une dispersion, une seule fois chacun.',
        )
      : '') +
    '</section>'

  // ---- TES ÉTATS : ce que les mémoires permettent ICI, à cet instant
  const cur = input.etatManuel()
  const acquis = records.eveilAcquis()
  const verrous = records.verrousCycle()
  const gate = cycleGateActif()
  const NOMS: Record<EtatManuel, string> = {
    eau: 'LIQUIDE',
    glace: 'GLACE',
    vapeur: 'VAPEUR',
  }
  const ICO: Record<EtatManuel, string> = {
    eau: '💧',
    glace: '❄',
    vapeur: '💨',
  }
  let cycle = '<section class="do-sec do-cycle"><h4><u>🔄</u>TES ÉTATS</h4>'
  for (const e of ['glace', 'eau', 'vapeur'] as EtatManuel[]) {
    if (e === cur) {
      cycle += `<div class="do-etat actuel"><i>${ICO[e]}</i><em>${NOMS[e]}</em><small>TU Y ES</small></div>`
      continue
    }
    const t = transfoEntre(CYCLE_PAR_ETAT[cur], CYCLE_PAR_ETAT[e])
    const tenue = t !== null && (!gate || transfoTenue(t.id, acquis, verrous))
    // LA COMMANDE VRAIE : celle de la table, redéfinie ou non — l'écrire en
    // dur, c'était mentir dès que le joueur change une touche
    const k = toucheDe(e)
    const b = boutonDe(e)
    const geste = k !== null ? nomTouche(k) : b !== null ? nomBouton(b) : '—'
    cycle +=
      `<div class="do-etat${tenue ? '' : ' verrou'}"><i>${ICO[e]}</i>` +
      `<em>${t ? t.nom : NOMS[e]}</em>` +
      (tenue
        ? `<small>D’UN GESTE</small><kbd>${geste}</kbd>`
        : `<small>🔒 MÉMOIRE À TISSER</small>`) +
      '</div>'
  }
  cycle +=
    '<p class="do-vide">Un lien non tissé se contourne : repasse par le LIQUIDE. ' +
    'Les régimes imposés par le décor, eux, te transforment de toute façon.</p></section>'

  // ---- TON BUTIN : ce que la descente t'a déjà rapporté
  const butin = enRun
    ? '<section class="do-sec do-butin"><h4><u>💎</u>TON BUTIN</h4>' +
      '<div class="do-tuiles">' +
      doTuile('🫙', `${run.bonbonneLiters.toFixed(1)} L`, 'BONBONNE', 'or') +
      doTuile(
        iconeMetaHTML('condensat', '💠'),
        `${condensat}`,
        'CONDENSAT cL',
        'or',
      ) +
      doTuile(
        iconeMetaHTML('memoire', '🧠'),
        `+${run.memoireGagnee}`,
        'MÉMOIRE',
        'vert',
      ) +
      '</div>' +
      `<div class="do-jauge j-but"><i style="width:${Math.min(100, (run.bonbonneLiters / capBonbonne()) * 100)}%"></i></div>` +
      `<p class="do-note" style="margin-top:6px">Bonbonne : ${run.bonbonneLiters.toFixed(2)} L sur ${capBonbonne()} — le surplus de chaque salle s’y range, et se reverse d’un geste.</p>` +
      '<div class="do-tuiles">' +
      doTuile('🔹', `${run.pastillesCl}`, 'PASTILLES cL') +
      doTuile('🚪', `${run.conclues}`, 'SALLES') +
      doTuile('⏱', fmtDuree(run.runTime), 'DESCENTE') +
      '</div></section>'
    : ''

  // ---- TON ÉQUIPEMENT : ce que tu portes sur toi
  const instrs = run.instruments
    .map((i) => carteDef(i))
    .filter((d): d is NonNullable<typeof d> => d !== null)
  const fioles = records
    .fiolesEquipees()
    .map((f) => fioleDef(f))
    .filter((d): d is NonNullable<typeof d> => d !== null)
  const equip =
    '<section class="do-sec do-equip"><h4><u>🎒</u>TON ÉQUIPEMENT</h4>' +
    (instrs.length === 0 && fioles.length === 0
      ? '<p class="do-vide">Les mains vides. Les instruments se gagnent aux paliers d’étalonnage, en fin de salle ; les fioles s’équipent au placard du laboratoire.</p>'
      : instrs
          .map(
            (d) =>
              `<div class="do-objet"><i>${d.icone}</i><div><b>${d.nom}</b><small>${d.desc}</small></div></div>`,
          )
          .join('') +
        fioles
          .map(
            (d) =>
              `<div class="do-objet"><i>⚗</i><div><b>${d.nom}</b><small>${d.desc}</small></div></div>`,
          )
          .join('')) +
    '</section>'

  doCorps.innerHTML = mission + corps + cycle + butin + equip
}

function ouvreDossier(v: boolean): void {
  dossierOuvert = v
  dossierEl.classList.toggle('ouvert', v)
  dossierEl.setAttribute('aria-hidden', v ? 'false' : 'true')
  if (v) {
    majDossier()
    dossierProchainMaj = performance.now() / 1000 + 0.25
  }
}
document.getElementById('do-fermer')?.addEventListener('click', () => {
  ouvreDossier(false)
})
// sonde d'essai : ouvrir/fermer le dossier depuis la console (comme __sim)
;(window as unknown as { __dossier: (v: boolean) => void }).__dossier =
  ouvreDossier

// ---- L'ÉVEIL : la prise en main scénarisée ------------------------------
// Trois temps, diégétiques. (1) Sortie de cryostase : le corps est GLACE
// depuis le chargement, le plan large se joue, puis une carte pose l'état —
// pas de direction, l'élan se conserve, et un mystère qui donne envie.
// (2) L'invite plane au-dessus du corps : redevenir liquide (💧 / F), le
// bouton d'interface pulse — le DÉGEL est la réponse, pas un clic de plus.
// (3) Une dizaine d'impulsions données (appui puis relâcher), une carte scelle la
// leçon du VOLUME. La clé CLE_EVEIL mémorise le passage ; PARAMÈTRES →
// REFAIRE LA PRISE EN MAIN la rejoue sur le tableau en cours.
const eveil1El = document.getElementById('eveil1') as HTMLDivElement
const eveil2El = document.getElementById('eveil2') as HTMLDivElement
const eveilInviteEl = document.getElementById('eveil-invite') as HTMLDivElement
type EveilEtape =
  | 'off'
  | 'zoom'
  | 'annonce1' // le monde décélère : la carte de cryostase s'annonce
  | 'glace'
  | 'invite'
  | 'gestes'
  | 'annonce2' // idem avant la carte du volume — jamais d'apparition sèche
  | 'volume'
// ralenti : le facteur de temps de l'éveil (1 = temps normal). Quand une
// carte s'annonce, la CIBLE descend vers ~0 et le monde décélère en douceur
// (même levier que le slow-mo de visée vapeur) ; la carte ne paraît qu'une
// fois le monde presque figé, en fondu. À la fermeture, la cible remonte :
// le monde se réveille progressivement au lieu de repartir d'un coup.
const eveil = {
  etape: 'off' as EveilEtape,
  gestes: 0,
  visePrec: false,
  ralenti: 1,
  cible: 1,
}
// Sonde de test : suivre l'éveil depuis la console (comme __sim, __cam)
;(window as unknown as { __eveil: typeof eveil }).__eveil = eveil
function lanceEveil(): void {
  if (localStorage.getItem(CLE_EVEIL)) return
  // relance propre (restart en plein éveil) : tout voile retombe d'abord
  for (const carte of [eveil1El, eveil2El]) {
    carte.hidden = true
    carte.classList.remove('montre')
  }
  eveilInviteEl.hidden = true
  stateEau.classList.remove('eveil-appel')
  input.gelees = false
  eveil.etape = 'zoom'
  eveil.gestes = 0
  eveil.ralenti = 1
  eveil.cible = 1
  // la cryostase tient l'échantillon : GLACE, quel que soit l'état d'avant
  input.freezeIntent = true
  input.gasIntent = false
}
function carteEveil(carte: HTMLDivElement, montrer: boolean): void {
  if (montrer) {
    carte.dataset.mode = obTactile() ? 'tactile' : 'pc'
    // fondu d'entrée : le voile paraît transparent, la classe « montre »
    // (posée à l'image suivante) lance la transition — jamais d'apparition sèche
    carte.hidden = false
    requestAnimationFrame(() => carte.classList.add('montre'))
  } else {
    // fondu de sortie : la classe s'en va, le voile s'efface, puis se cache
    carte.classList.remove('montre')
    window.setTimeout(() => {
      carte.hidden = true
    }, 600)
  }
  // les cartes figent tout, comme la prise en main : lecture au calme
  input.paused = montrer
  input.gelees = montrer
}
function avanceEveil(): void {
  if (eveil.etape === 'glace') {
    carteEveil(eveil1El, false)
    eveil.cible = 1 // le monde se réveille en douceur derrière le fondu
    eveil.etape = 'invite'
    eveilInviteEl.dataset.mode = obTactile() ? 'tactile' : 'pc'
    eveilInviteEl.hidden = false
    stateEau.classList.add('eveil-appel')
  } else if (eveil.etape === 'volume') {
    carteEveil(eveil2El, false)
    eveil.cible = 1
    eveil.etape = 'off'
    try {
      localStorage.setItem(CLE_EVEIL, '1')
    } catch {
      // stockage refusé : l'éveil se rejouera, sans gravité
    }
    // L'ALERTE : au moment où le sujet SAIT se mouvoir, la station bascule
    // en rouge, la cuve tremble — et la brèche (porte d'index 0 : celle de
    // la cuve) cède. On naît enfermé, on sort par l'accident.
    if (auHub && (level.portes?.length ?? 0) > 0) demarreSequence('ALERTE')
  }
}
for (const carte of [eveil1El, eveil2El]) {
  // le voile ÉCRANTE (rien ne traverse vers le jeu) mais n'avance pas :
  // seul le bouton CONTINUER / PLONGER tourne la page — pas de carte
  // sautée par un clic malheureux (à la manette, A reste le bouton)
  carte.addEventListener('pointerdown', (e) => e.stopPropagation())
  carte.querySelector('.ev-continuer')?.addEventListener('click', avanceEveil)
}
// Appelé chaque image (après la caméra) : fait avancer l'éveil au rythme
// de ce que fait réellement le joueur — pas de minuteries arbitraires.
function majEveil(dtReal: number): void {
  // le facteur de temps poursuit sa cible même hors éveil (le réveil du
  // monde après la dernière carte doit finir sa rampe) — descente vive
  // (~0,5 s), remontée plus paresseuse (~1 s) : on se réveille, on ne sursaute pas
  if (eveil.ralenti !== eveil.cible) {
    const k = 1 - Math.exp(-dtReal * (eveil.cible < eveil.ralenti ? 5 : 2.5))
    eveil.ralenti += (eveil.cible - eveil.ralenti) * k
    if (Math.abs(eveil.ralenti - eveil.cible) < 0.005)
      eveil.ralenti = eveil.cible
  }
  if (eveil.etape === 'off' || !document.body.classList.contains('playing'))
    return
  if (eveil.etape === 'zoom') {
    // le plan large d'abord — la salle se lit — puis le monde décélère
    if (!camera.introEnCours) {
      eveil.etape = 'annonce1'
      eveil.cible = 0.04
    }
  } else if (eveil.etape === 'annonce1') {
    // la carte ne paraît qu'une fois le monde presque figé : le ralenti
    // EST l'annonce — l'œil comprend qu'il se passe quelque chose
    if (eveil.ralenti < 0.09) {
      eveil.etape = 'glace'
      carteEveil(eveil1El, true)
    }
  } else if (eveil.etape === 'invite') {
    // l'invite plane au-dessus du corps et suit sa dérive
    const vw = window.innerWidth
    const vh = window.innerHeight
    const sx = vw * 0.5 + (sim.stats.centroidX - camera.x) * camera.zoom
    const sy =
      vh * 0.5 -
      (sim.stats.centroidY - camera.y) * camera.zoom -
      sim.stats.rmsRadius * camera.zoom -
      14
    const ax = Math.min(vw - 30, Math.max(30, sx))
    const ay = Math.min(vh - 120, Math.max(96, sy))
    eveilInviteEl.style.transform = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px) translate(-50%, -100%)`
    if (!input.freezeIntent) {
      // le dégel EST la réponse : l'invite s'efface, place aux impulsions
      eveilInviteEl.hidden = true
      stateEau.classList.remove('eveil-appel')
      eveil.etape = 'gestes'
      eveil.gestes = 0
      eveil.visePrec = input.aimActive
    }
  } else if (eveil.etape === 'gestes') {
    // une DIZAINE d'impulsions complètes (appui puis relâcher) : on laisse
    // vraiment jouer — sentir le volume qui part, essayer, se tromper —
    // puis la carte vient nommer ce qu'on vient de vivre
    if (eveil.visePrec && !input.aimActive) {
      eveil.gestes++
      if (eveil.gestes >= 10) {
        eveil.etape = 'annonce2'
        eveil.cible = 0.04
      }
    }
    eveil.visePrec = input.aimActive
  } else if (eveil.etape === 'annonce2') {
    if (eveil.ralenti < 0.09) {
      eveil.etape = 'volume'
      carteEveil(eveil2El, true)
    }
  }
}
touchButton('⌖', 'recadrer sur le corps (zoom et caméra auto)', () =>
  camera.resetAutoZoom(),
)
const btnSound = touchButton(
  '🔊',
  'son : couper / activer',
  () => {
    audio.resume()
    audio.setEnabled(!audio.enabled)
    if (audio.enabled) {
      bande.eveiller()
    }
    majInviteSon()
    pane.refresh()
  },
  'tb-snd', // masqué au doigt : la bascule du son reste au banc (dossier Son)
)
touchButton('↺', 'recommencer (R)', resetAction)
touchButton('≡', 'fiche d’essai (échap)', openHome)
input.onTimeWarpChange = (warp) => {
  params.timeWarp = warp
  majVitesse()
  pane.refresh()
}
// La vitesse affichée (barre + HUD) : mise à jour au changement ET à chaque
// image (le banc peut aussi changer timeWarp par ses curseurs)
function majVitesse(): void {
  const w = params.timeWarp
  const txt = `×${w}`
  if (tbSpeed.textContent !== txt) tbSpeed.textContent = txt
  tbSpeed.classList.toggle('actif', w !== 1)
}

const overlayBtn = document.getElementById('overlay-btn') as HTMLButtonElement
// Relance discrète : elle n'apparaît qu'une fois la dernière impulsion donnée,
// et ne recouvre rien — on peut la laisser là et regarder la dérive finir.
// Pastilles du HUD : un toucher montre le nom de la donnée, brièvement
for (const chip of Array.from(
  document.querySelectorAll<HTMLButtonElement>('.hud-chip'),
)) {
  chip.addEventListener('click', () => {
    chip.classList.add('ouvert')
    window.setTimeout(() => chip.classList.remove('ouvert'), 2400)
  })
}

const btnRelance = document.getElementById('relance') as HTMLButtonElement
// Continuer : le corps principal est bu, le joueur conclut quand il veut
const btnContinuer = document.getElementById('continuer') as HTMLButtonElement
let continuerVoulu = false
// le passage auto à l'état gazeux (chaudière) : armé tant que le corps
// n'a pas déjà déclenché — réarmé quand il ressort de l'aura
let autoGazArme = true
// la prochaine vaporisation est SUBIE (la chaudière vient de la provoquer) :
// elle se paie comme les autres, mais ne rend pas les dashs
let gazSubi = false
// la zone forcée actuellement TENUE par le corps (déclenchée à 95 %,
// relâchée sous 85 %) — l'état, lui, persiste à la sortie
let zoneTenue: number | null = null
btnContinuer.addEventListener('click', () => {
  continuerVoulu = true
  btnContinuer.classList.remove('visible')
})
// Le tableau seul reprend : la réserve déjà en bonbonne et le refroidissement
// du vaisseau, eux, ne se rembobinent pas — sinon la pression n'existerait plus.
// « J'en reste là » : en RUN, ce bouton ne rejoue pas la salle gratuitement
// (les échantillons de secours n'auraient plus de sens) — il conclut, et
// l'écran de fin décide : un secours engagé, ou la fin de la run. Au labo,
// dans un essai ou un tableau d'éditeur, il relance simplement.
btnRelance.addEventListener('click', () => {
  if (!testLevel && !auHub && !run.ended) {
    afficheDispersion()
    return
  }
  restart()
})
// ---- Tutoriel diégétique (tableau 1, première partie seulement) ----
// Les consignes du protocole apparaissent au bon moment, se valident par le
// geste qu'elles enseignent, et ne reviennent plus (localStorage). Les deux
// dernières sont contextuelles : l'éponge à l'approche, le sas à l'arrivée.
const TUTOR_KEY = 'projet21.tutoriel.v1'
const tutorEl = el('tutor')
let tutorActive = true
try {
  tutorActive = localStorage.getItem(TUTOR_KEY) !== 'ok'
} catch {
  // stockage indisponible : le tutoriel s'affiche à chaque visite, sans gravité
}
let tutorStep = 0
let tutorTimer = 0
let tutorEjectHeld = 0
let tutorShown = ''

const TUTOR_TEXTS = [
  'Maintenez le doigt (ou le pointeur) : la matière est éjectée <em>vers</em> lui — le corps part à l’opposé. Il n’y a pas de frein.',
  'Chaque goutte éjectée est perdue. La jauge en haut est votre corps : sous le trait rouge, il ne reste qu’une impulsion. <strong>Se déplacer, c’est rétrécir.</strong>',
  '<kbd>❄ / F</kbd> se changer en glace : l’élan se garde, re-presser dégèle. <kbd>💨 / G</kbd> vapeur : visez (le temps ralentit), relâchez — le nuage fuse, plus loin le doigt, plus fort le dash. Un tiers du volume à chaque fois. Essayez l’un des deux.',
  'L’éponge boit ce qui s’attarde à son contact. Passez vite, payez le passage en volume — ou cherchez la vapeur.',
  'Le sas aspire l’échantillon : laissez-vous boire. Le surplus part en bonbonne — la récompense, c’est ce qu’il vous reste.',
]

// Sonde de débogage/test : l'état du tutoriel depuis la console
;(window as unknown as { __tutor: () => object }).__tutor = () => ({
  active: tutorActive,
  step: tutorStep,
  held: tutorEjectHeld,
  timer: tutorTimer,
  aim: input.aimActive,
})

function tutorPersist(): void {
  try {
    localStorage.setItem(TUTOR_KEY, 'ok')
  } catch {
    // sans gravité
  }
}

function updateTutor(dtReal: number): void {
  // Bandeaux CONSIGNE DU PROTOCOLE désactivés (même retour joueur que le
  // carton) : l'onboarding gestuel du premier lancement suffit.
  if (tutorShown !== '') {
    tutorShown = ''
    tutorEl.classList.remove('visible')
  }
  if (true) return
  if (
    !tutorActive ||
    testLevel !== null ||
    levelIndex !== 0 ||
    sim.dispersed ||
    run.ended ||
    tutorStep >= TUTOR_TEXTS.length
  ) {
    if (tutorShown !== '') {
      tutorShown = ''
      tutorEl.classList.remove('visible')
    }
    return
  }
  const playing = document.body.classList.contains('playing') && !input.paused
  const cardVisible = tableauCard.classList.contains('visible')
  if (playing && input.aimActive) tutorEjectHeld += dtReal

  // conditions de validation de l'étape courante
  if (tutorStep === 0 && tutorEjectHeld > 1.2) {
    tutorStep = 1
    tutorTimer = 0
  } else if (tutorStep === 2 && (input.freezeIntent || input.gasIntent)) {
    tutorStep = 3
    tutorTimer = 0
    tutorPersist() // le cœur est acquis : plus de tutoriel aux prochaines visites
  }

  // texte à montrer (les étapes 3 et 4 sont contextuelles)
  let text = ''
  if (playing && !cardVisible) {
    if (tutorStep <= 2) {
      text = TUTOR_TEXTS[tutorStep]
    } else if (tutorStep === 3) {
      // à l'approche du mur d'éponge du tableau 1 (x = 560)
      if (sim.stats.centroidX > 60 && sim.stats.centroidX < 560)
        text = TUTOR_TEXTS[3]
    } else if (tutorStep === 4) {
      const d = Math.hypot(
        sim.stats.centroidX - exitMouth.x,
        sim.stats.centroidY - exitMouth.y,
      )
      if (d < Math.max(320, params.exitRadius * 1.6)) text = TUTOR_TEXTS[4]
    }
  }

  // écoulement du temps sur les étapes à durée
  if (text !== '') {
    tutorTimer += dtReal
    if (tutorStep === 1 && tutorTimer > 6) {
      tutorStep = 2
      tutorTimer = 0
    } else if (tutorStep === 2 && tutorTimer > 22) {
      tutorStep = 3 // on n'insiste pas : la consigne a été lue
      tutorTimer = 0
      tutorPersist()
    } else if (tutorStep === 3 && tutorTimer > 7) {
      tutorStep = 4
      tutorTimer = 0
    } else if (tutorStep === 4 && tutorTimer > 7) {
      tutorStep = 5
    }
  }

  if (text !== tutorShown) {
    tutorShown = text
    if (text !== '') {
      tutorEl.innerHTML = `<span class="consigne">CONSIGNE DU PROTOCOLE</span>${text}`
      tutorEl.classList.add('visible')
    } else {
      tutorEl.classList.remove('visible')
    }
  }
}

function htmlSafe(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function showOverlay(
  title: string,
  sub: string,
  tone: 'success' | 'danger',
  btn?: string,
): void {
  overlayTitle.textContent = title
  overlaySub.innerHTML = sub
  overlay.classList.remove('success', 'danger', 'end')
  overlay.classList.add('visible', tone)
  if (btn) {
    overlay.classList.add('end')
    overlayBtn.textContent = btn
  }
}

// Bilan d'expédition : la phrase que le tampon raconte au protocole
function expeditionSummary(tableauxDone: number): string {
  return `${tableauxDone}/${playedLevels().length} salles · 💧 ${fmtL(run.livreTotal)} · ⏱ ${fmtDuree(run.runTime)}`
}

let lastTime = performance.now()
let elapsed = 0
let fpsSmoothed = 60
// Débit de perte lissé (litres par seconde simulée) : ce que l'action en
// cours coûte au corps — éjection, coût d'état vapeur, éponge, radiateur.
let lossPrevLiters = -1
let lossPrevT = 0
let lossRate = 0

// Qualité adaptative : si la machine ne suit pas, on baisse LA RÉSOLUTION DE
// RENDU, et elle seule. Le champ de métaballes ne se grossit plus jamais tout
// seul : il est déjà rendu au 1/2, il ne porte que ~900 sprites, il ne pèse
// RIEN à côté de la composition plein écran — le grossir se voyait beaucoup
// (fluide en patchwork) et ne rapportait presque rien. La physique, elle,
// n'est jamais dégradée : sous forte charge, le jeu ralentit doucement
// (plafond de pas par image) au lieu de saccader.
// ---- LA RÉSOLUTION ADAPTATIVE ----
// Le calcul vit dans src/game/resolution.ts, où il se teste : le coût d'une
// image est proportionnel au nombre de pixels (mesuré sur iPad Pro M1), donc
// l'échelle qui atteint la cible se CALCULE au lieu de se chercher par
// paliers. Ici ne reste que le TEMPS : on descend vite, on remonte lentement.
let echelleDyn = 1
/** L'ÉCHELLE DE RENDU effective : ce par quoi on multiplie la taille de la
 * vue pour obtenir le tampon de dessin. C'est LE chiffre qui explique une
 * cadence, puisque le coût est proportionnel au nombre de pixels — d'où sa
 * place dans le rapport de performance, à côté des mégapixels qu'elle
 * représente. L'interface HTML, elle, reste à la netteté native. */
function echelleRendue(): number {
  return (
    Math.min(window.devicePixelRatio || 1, PLAFOND_DPR) *
    (resDynamique() ? echelleDyn : RES_ECHELLES[resChoix])
  )
}
let dynAmorce = false
let dynDepuis = 0 // s depuis le dernier ajustement
function updateQuality(dtReal: number): void {
  // Résolution FIXE choisie (voile PARAMÈTRES) : l'échelle est constante,
  // rien d'adaptatif ne s'applique — pas de yo-yo visuel.
  if (!resDynamique()) {
    dynAmorce = false
    echelleDyn = 1
    return
  }
  if (!dynAmorce) {
    dynAmorce = true
    const p = Math.min(window.devicePixelRatio || 1, PLAFOND_DPR)
    echelleDyn = echelleDepart(window.innerWidth * p * window.innerHeight * p)
    dynDepuis = 0
    return
  }
  dynDepuis += dtReal
  // La cible est la cadence VERROUILLÉE, bornée à 60 : le rendu est taillé
  // pour 60 — au-delà, l'écran rapide profite du surplus sans que la
  // qualité se sacrifie pour courir après 120.
  const a = viseEchelle(echelleDyn, fpsSmoothed, Math.min(fpsCap, 60))
  if (!a) return
  // Asymétrie : on descend vite (1,2 s de confirmation), on remonte
  // lentement (5 s) — remonter trop tôt fait clignoter la netteté.
  if (dynDepuis < (a.sens === 'baisse' ? 1.2 : 5)) return
  dynDepuis = 0
  echelleDyn = a.echelle
}


let tickPrecedent = 0
// La GARDE D'AMORÇAGE (index.html) tient un écran de panne prêt tant que le
// jeu n'a pas donné signe de vie : WebGL2 absent, exception au démarrage, ou
// douze secondes sans rien. C'est la PREMIÈRE IMAGE qui la désarme — et pas
// la fin du module : le module peut s'évaluer entièrement et la boucle ne
// jamais tourner. Une seule fois, puis plus rien : un incident en cours de
// partie n'a pas à recouvrir le jeu d'un panneau.
let amorceSignalee = false

function frame(now: number): void {
  if (!amorceSignalee) {
    amorceSignalee = true
    const w = window as unknown as { __sujet21Demarre?: () => void }
    w.__sujet21Demarre?.()
  }
  // chaque rappel rAF, rendu OU sauté, date l'horloge de l'écran : le
  // collecteur en tire le Hz réel du panneau (adaptatif sur mobile)
  if (tickPrecedent > 0) perf.tick(now - tickPrecedent)
  tickPrecedent = now
  // Verrou de fréquence : l'image d'avance est SAUTÉE (rien n'est simulé ni
  // rendu — dtReal la rattrapera). Cadencement à DETTE CONSERVÉE : l'horloge
  // avance d'une période exacte, pas jusqu'à `now` — sinon le verrou cale
  // sur un sous-multiple de l'écran (60 demandés sur un 144 Hz donnaient
  // 48 im/s : chaque image « en avance » repoussait toute la grille).
  const periode = 1000 / fpsCap
  if (now - fpsCapPrecedent < periode - 1) {
    requestAnimationFrame(frame)
    return
  }
  fpsCapPrecedent += periode
  // jamais plus d'une période de dette : une pause (onglet caché) ne
  // déclenche pas une rafale de rattrapage
  if (now - fpsCapPrecedent > periode) fpsCapPrecedent = now
  const dtBrutMs = now - lastTime // non plafonné : la VRAIE durée, pour le rapport
  const frameT0 = performance.now() // départ du CPU de cette frame (collecteur)
  const dtReal = Math.min((now - lastTime) / 1000, 0.1)
  lastTime = now
  elapsed += dtReal
  if (dtReal > 0) fpsSmoothed += (1 / dtReal - fpsSmoothed) * 0.05

  updateQuality(dtReal)
  const vw = window.innerWidth
  const vh = window.innerHeight
  // l'échelle fixe choisie s'applique ici : seul le canvas est mis à
  // l'échelle, l'interface HTML reste à la netteté native
  const dpr = echelleRendue()
  // mesures brutes de CETTE image, pour le collecteur de performance
  let physRaw = 0
  let stepsFaits = 0

  // ---- Manette : elle écrit dans le même pointeur que le doigt ----
  manettePolls++
  manettePollNow = performance.now() / 1000
  manette.poll(manettePollNow)
  if (manette.connectee) {
    const enJeu = document.body.classList.contains('playing')
    // (l'écoute d'un bouton pour REDÉFINIR une commande ne passe pas par
    // ici : elle a son propre sondage, la boucle d'images étant à l'arrêt
    // quand un panneau est ouvert — voir sondeManetteEcoute)
    // l'écran de menu au-dessus, s'il y en a un — codex, sous-menus de la
    // fiche, cérémonie, fiche elle-même… B y est TOUJOURS le retour
    const couche = coucheMenuActive()
    // une couche LÉGÈRE (légende, états, instruments — ouvertes en pleine
    // partie) : B la referme et se consume, le jeu garde tout le reste
    let bConsomme = false
    if (couche?.legere) {
      // le stick droit défile le panneau (la caméra lui cède le geste)
      defileCouche(couche, dtReal)
      if (manette.edge(BOUTON.B)) {
        navigueMenu(couche, dtReal)
        bConsomme = true
      }
    }
    if (!onboardEl.hidden) {
      // prise en main à l'écran : A avance les cartes, rien d'autre ne passe
      if (manette.edge(BOUTON.A)) avanceOnboard()
    } else if (!eveil1El.hidden || !eveil2El.hidden) {
      // cartes de l'éveil : A tourne la page, rien d'autre ne passe
      if (manette.edge(BOUTON.A)) avanceEveil()
    } else if (
      editeurHote.classList.contains('visible') &&
      (!couche || couche.id === 'home')
    ) {
      // l'ÉDITEUR : le stick gauche (ou le pavé gauche en joystick) défile
      // ses panneaux. La fiche SOUS l'éditeur ne prend pas la main — mais
      // une couche posée SUR lui (la planche, le montage…) la garde.
      defileEditeur(dtReal)
    } else if (couche && !couche.legere) {
      // un MENU au premier plan : croix/stick naviguent, A active, B revient
      navigueMenu(couche, dtReal)
    } else if (manette.edge(BOUTON.A) && clicMenuManette()) {
      // écrans de jeu (relance, fin de tableau) : le clic a consommé le A
    } else if (enJeu) {
      // ☰ (Start) : pause ET menu — la fiche fige l'essai en s'ouvrant
      if (manette.edge(BOUTON.START)) openHome()
      // SELECT : recommencer — sauf pendant le toast d'une fiche codex, où
      // il VISITE la fiche (l'invite du toast l'annonce)
      if (manette.edge(BOUTON.SELECT)) {
        const fiche = tropheeToast.classList.contains('visible')
          ? tropheeToast.dataset.fiche
          : undefined
        if (fiche) {
          tropheeToast.classList.remove('visible')
          ouvreCodexSur(fiche)
        } else {
          input.onReset?.()
        }
      }
      // le temps aux épaules : LB ralentit, RB accélère (la croix ↔ aussi)
      if (manetteFait('ralentir')) input.stepWarp(-1)
      if (manetteFait('accelerer')) input.stepWarp(1)
      // les trois états sur les trois boutons restants : X glace, Y vapeur,
      // B retour à l'eau — A reste la main qui agit. Tout passe par la
      // DEMANDE : le cycle des mémoires tranche, le cadran montre le verrou.
      if (manetteFait('glace')) input.demande('glace')
      if (manetteFait('vapeur')) input.demande('vapeur')
      if (!bConsomme && manetteFait('eau')) {
        // retour à l'eau, quel que soit l'état — sauf si B vient de
        // refermer un panneau léger (légende, états, instruments)
        input.demande('eau')
      }
      if (manette.edge(BOUTON.GAUCHE)) input.stepWarp(-1)
      if (manette.edge(BOUTON.DROITE)) input.stepWarp(1)
      // la croix HAUT verse la réserve : viser une fiole de douze pixels au
      // pavé tactile n'était pas un geste — au Deck, c'est un cran de croix
      if (manetteFait('verser')) verseEtDis()
      // enfoncer le stick GAUCHE recadre : la caméra revient au suivi auto
      if (manetteFait('recadrer')) camera.resetAutoZoom()
      // le stick DROIT ouvre le DOSSIER — la convention manette pour « la
      // fiche d'état » ; la descente continue derrière, comme au clavier
      if (manetteFait('dossier')) ouvreDossier(!dossierOuvert)
      if (manette.zoomAvant) camera.zoomBy(Math.pow(1.9, dtReal), params)
      if (manette.zoomArriere) camera.zoomBy(Math.pow(1.9, -dtReal), params)
      // les grosses gâchettes zooment, la pression dose la vitesse
      if (manette.rtVal > 0.02)
        camera.zoomBy(Math.pow(2.2, manette.rtVal * dtReal), params)
      if (manette.ltVal > 0.02)
        camera.zoomBy(Math.pow(2.2, -manette.ltVal * dtReal), params)
      if (!couche && (manette.panX !== 0 || manette.panY !== 0)) {
        // pousser à droite REGARDE à droite (le pan de drag est inversé) —
        // sauf panneau ouvert : le stick droit y DÉFILE, la caméra cède
        camera.panBy(-manette.panX * 900 * dtReal, -manette.panY * 900 * dtReal)
      }
      // viser et agir — seulement si la manette a parlé plus récemment que
      // la souris, et qu'aucun doigt n'est posé. Le STICK dit où l'on veut
      // ALLER : en eau, l'éjection part automatiquement à l'opposé (c'est
      // elle qui pousse) ; en vapeur, le dash part dans la direction du stick.
      if (
        input.touchCount === 0 &&
        manette.lastActivity > input.lastPointerAt
      ) {
        const scx = vw * 0.5 + (sim.stats.centroidX - camera.x) * camera.zoom
        const scy = vh * 0.5 - (sim.stats.centroidY - camera.y) * camera.zoom
        // pleine inclinaison = pleine puissance de dash ; un plancher garde
        // la direction lisible même stick à peine poussé
        const rPx =
          (0.15 + 0.85 * manette.force) * params.gasDashRange * camera.zoom
        const sens = input.gasIntent ? 1 : -1 // eau : le point d'éjection est derrière
        manetteCurseur.x = scx + manette.dirX * rPx * sens
        manetteCurseur.y = scy + manette.dirY * rPx * sens
        if (manette.agit) {
          input.aimActive = true
          input.aimClientX = manetteCurseur.x
          input.aimClientY = manetteCurseur.y
          manetteTenait = true
        } else if (manetteTenait) {
          manetteTenait = false
          input.aimActive = false
        } else if (manette.active) {
          // le curseur suit même sans presser : la visée se prépare
          input.aimClientX = manetteCurseur.x
          input.aimClientY = manetteCurseur.y
        }
      } else if (manetteTenait) {
        // la souris a repris la main en pleine action manette : on relâche
        manetteTenait = false
        input.aimActive = false
      }
    }
  }

  const aim = camera.screenToWorld(input.aimClientX, input.aimClientY, vw, vh)
  const tableauDone = run.exitTimer > 0 || run.ended || miseEnBonbonne

  // Zones d'état (refonte 2026) : une zone impose un état et verrouille le
  // sélecteur tant qu'on y est. L'intention du joueur est écrasée, pas effacée
  // — en ressortant, il retrouve l'état qu'il avait choisi.
  // Règle du 12/08 : une zone n'impose son état que lorsque 95 % du CORPS
  // ACTIF (les particules joueur — les gouttes éjectées ne comptent pas)
  // est dedans ; elle le tient ensuite jusqu'à retomber sous 85 %.
  const zonesForcees = (level.zones ?? [])
    .map((z, i) => ({ z, i }))
    .filter((e) => e.z.force !== 'libre')
  let zoneActive: ZoneForce = 'libre'
  if (zonesForcees.length > 0 && sim.playerCount > 0) {
    let bestFrac = 0
    let bestI = -1
    for (const e of zonesForcees) {
      let dedans = 0
      for (let i = 0; i < sim.count; i++) {
        if (sim.kind[i] !== KIND_PLAYER) continue
        // TOUT le rectangle déclaré compte : la lisière ondulée n'est que le
        // dessin (inscrite, sa bande morte au ras des parois posées en bord
        // de zone rendait les 95 % inatteignables — l'eau plaquée contre le
        // mur était « dehors » sans que rien ne le montre)
        const x = sim.posX[i]
        const y = sim.posY[i]
        if (x >= e.z.minX && x <= e.z.maxX && y >= e.z.minY && y <= e.z.maxY)
          dedans++
      }
      const f = dedans / sim.playerCount
      if (f > bestFrac) {
        bestFrac = f
        bestI = e.i
      }
    }
    const seuil = zoneTenue === bestI ? 0.85 : 0.95
    if (bestI >= 0 && bestFrac >= seuil) {
      zoneTenue = bestI
      zoneActive = (level.zones ?? [])[bestI].force
    } else {
      zoneTenue = null
    }
  } else {
    zoneTenue = null
  }
  if (zoneActive !== 'libre') {
    input.freezeIntent = zoneActive === 'glace'
    input.gasIntent = zoneActive === 'vapeur'
  }
  sim.freezeIntent = input.freezeIntent
  sim.gasIntent = input.gasIntent
  // La BASCULE en vapeur — G, chaudière à 95 %, zone forcée : toute cause —
  // se règle à l'instant du basculement : péage de 20 % du volume actif
  // (gerbe de gouttes récupérables). Le compteur de dashs, lui, dépend de
  // QUI a décidé : se vaporiser DE SON PROPRE CHEF (touche G, bouton
  // VAPEUR) refait le plein de la réserve — le péage en est le prix ; une
  // transformation SUBIE (chaudière à 95 %, zone qui impose la vapeur) ne
  // rend rien, sinon la salle vaudrait ferme à dashs.
  // Et un tableau qui COMMENCE en vapeur ne bascule pas : c'est son état de
  // départ. Ni péage, ni événement — le corps naît nuage, avec sa réserve
  // (createSim l'a remplie), sans qu'on lui prenne un cinquième de lui-même.
  if (input.gasIntent && !gasIntentAvant && !tableauDone && !input.paused) {
    // l'état de départ, c'est la PREMIÈRE prise de la zone, au tout début du
    // tableau : une bascule décidée plus tard (touche G) se paie et rend ses
    // dashs normalement, même dans un tableau né en vapeur
    const etatDeDepart =
      departEnVapeur && zoneActive === 'vapeur' && run.tableauTime < 3
    departEnVapeur = false
    const subie = gazSubi || zoneActive === 'vapeur'
    gazSubi = false
    if (!etatDeDepart) sim.transfoVapeur(!subie)
  }
  if (!input.gasIntent) gazSubi = false // rien à consommer : la marque tombe
  gasIntentAvant = input.gasIntent

  sim.chill = chillNow() // le vaisseau refroidit : la physique suit
  if (input.aimActive) camera.cancelIntro() // le joueur agit : la caméra suit

  // ---- Dash de vapeur (« air dash ») : viser RALENTIT fortement le temps
  // (physique, refroidissement, chrono — tout suit, rien ne se fige),
  // relâcher lance le nuage vers le point visé. Une impulsion unique — pas
  // de recul, pas d'éjection ; la DISTANCE du doigt règle la puissance.
  const vif = !input.paused && !tableauDone && !sim.dispersed && !endgame.spent
  const dashAiming = vif && input.gasIntent && input.aimActive
  // Le ralenti s'entend : tout le mixage plonge sous un passe-bas (et
  // baisse de moitié), un cœur au ralenti bat, la texture du temps suspendu
  // s'ouvre — seule à rester nette —, et l'air revient au dash.
  // (le ralenti d'annonce de l'éveil s'entend aussi : même texture suspendue)
  audio.setSlowMo(dashAiming || eveil.ralenti < 0.7)
  bande.setSuspendu(dashAiming || eveil.ralenti < 0.7)
  if (dash.aiming && !dashAiming) {
    // Relâcher déclenche ; changer d'état ou perdre la main en pleine visée
    // annule sans frais — la visée n'engage à rien tant qu'on n'a pas lâché.
    // Un second doigt posé (pincement pour zoomer) ANNULE la visée : elle ne
    // conclut pas. Sans ça, dézoomer en vapeur lâchait le dash.
    if (vif && input.gasIntent && !input.aimActive && !input.aimAnnulee) {
      const spent = sim.gasDash(aim.x, aim.y)
      if (spent > 0) manette.rumble(0.6, 90) // le dash se voit, il ne souffle plus
    }
  }
  dash.aiming = dashAiming

  // ---- Impulsion SANS direction : le geste se retourne vers soi ----
  // Stick au neutre (manette), ou doigt/pointeur posé SUR le corps : au lieu
  // d'éjecter au petit bonheur, le corps se RASSEMBLE autour de son centre —
  // l'anti-dispersion, gratuite (rien ne part, rien ne se paie).
  const rassembler =
    input.aimActive &&
    !input.gasIntent &&
    !sim.dispersed &&
    ((manetteTenait && manette.force < 0.02) ||
      corpsSousLePointeur(aim.x, aim.y))
  ;(window as unknown as { __rass: boolean }).__rass = rassembler // sonde de test

  if (!input.paused && !tableauDone) {
    // Budget CPU des pas physiques : ~60 % du temps d'image, borné à 5-12 ms.
    // Sans cette borne, une image en retard impose plus de pas, coûte plus
    // cher, prend plus de retard — et la machine s'installe à 15-20 fps.
    // ACCÉLÉRER étend le budget d'autant : le joueur qui met ×4 achète des
    // pas de simulation contre des images par seconde — sans cela, sur une
    // machine au taquet, le HUD affichait ×4 et la cuve restait à ×1.
    // le ralenti d'annonce de l'éveil multiplie le temps comme le slow-mo
    // de visée : physique, chrono, refroidissement — tout décélère ensemble
    const warpNow =
      (dashAiming
        ? params.timeWarp * params.gasAimSlow * lev('visee')
        : params.timeWarp) * eveil.ralenti
    const boost = Math.max(1, warpNow)
    // Troisième borne (retour joueur : « en accélérant, chutes drastiques ») :
    // la physique ne dépasse JAMAIS ~70 % de la période du verrou, même
    // accélérée. Machine rapide : ×4 tient en 6-8 ms, plein régime inchangé.
    // Machine juste : l'accélération plafonne d'elle-même — le temps avance
    // aussi vite que la machine le permet SANS casser la cadence, au lieu
    // d'afficher ×4 à 25 im/s. Le plancher 5 ms garantit le pas minimal.
    const bornePeriode = Math.max(5, (1000 / fpsCap) * 0.7)
    const stepBudget = Math.min(
      12 * boost,
      Math.max(5, dtReal * 1000 * 0.6 * boost),
      bornePeriode,
    )
    // FLUIDITÉ : plafond de pas au régime de croisière (cadence lissée,
    // bornée par le verrou) — l'accroc ne se paie qu'une fois. TEMPS RÉEL :
    // pas de plafond (le budget CPU reste seul juge), comportement historique.
    const periodeCroisiere = Math.min(
      50,
      Math.max(1000 / fpsCap, fpsSmoothed > 1 ? 1000 / fpsSmoothed : 1000 / 60),
    )
    const plafondPas = rattrapageFluide
      ? Math.max(
          1,
          Math.ceil(((periodeCroisiere / 1000) * warpNow) / params.dt - 0.05),
        )
      : Number.POSITIVE_INFINITY
    // L'anti-domino (plafond de pas au régime de croisière) a été ESSAYÉ
    // puis débranché : au ressenti sur machine réelle, l'abandon du temps
    // simulé après chaque accroc se voyait plus que la deuxième image lente
    // qu'il évitait. Le rattrapage historique reprend (budget CPU seul en
    // garde-fou) ; la capacité reste dans FixedLoop, testée, si on y revient.
    const physT0 = performance.now()
    stepsFaits = loop.advance(
      dtReal,
      warpNow,
      params.dt,
      () => {
        if (
          input.aimActive &&
          !input.gasIntent &&
          !sim.dispersed &&
          !endgame.spent
        ) {
          // En eau, maintenir éjecte ; en vapeur, la visée fige le temps —
          // le dash part au relâchement (voir plus haut), rien ne se pilote.
          // Sans direction (stick neutre, doigt sur le corps) : on se reforme.
          if (rassembler) sim.rassemble(params.dt)
          else sim.eject(aim.x, aim.y, params.dt)
        }
        if (vortex.timer > 0) {
          const life = Math.min(1, vortex.timer / params.vortexDuration)
          sim.applyVortex(vortex.x, vortex.y, params.dt, life)
          vortex.timer -= params.dt
        }
        sim.applyExitSuction(exitMouth.x, exitMouth.y, params.dt)
        // Rien ne freine le corps figé : dans le vide, une dérive reste une
        // trajectoire. Elle peut encore rencontrer une paroi, rebondir, et
        // finir dans le sas — c'est au joueur de décider quand y renoncer.
        sim.step(params.dt)
        run.tableauTime += params.dt // temps simulé : le time warp ne fausse pas les records
        run.runTime += params.dt // le vaisseau refroidit au fil de l'expédition
        // la mise en scène avance au TEMPS DE JEU : une pause la suspend,
        // une cinématique aussi (la boucle physique ne tourne plus)
        sequenceur.avance(params.dt)
      },
      stepBudget,
      plafondPas,
    )
    physRaw = performance.now() - physT0
    monitor.physMs += (physRaw - monitor.physMs) * 0.08
  }

  // ---- LES PORTES vers le solveur. HORS du bloc des lasers : un tableau
  // peut n'avoir que des portes SCÉNARISÉES (la brèche de l'ouverture),
  // sans le moindre émetteur — leur paroi doit tout de même être solide
  // jusqu'à l'instant où le récit la crève.
  {
    const portes = level.portes ?? []
    if (portes.length > 0) {
      if (laserEtat.portesOuvertes.length !== portes.length) {
        laserEtat.portesOuvertes = portes.map(() => false)
      }
      for (let i = 0; i < portes.length; i++) {
        if (sequenceur.etat.brechesOuvertes.has(i))
          laserEtat.portesOuvertes[i] = true
      }
      // le solveur ne reçoit que les portes closes — recomposé au changement
      const closes = portes.filter((_, i) => !laserEtat.portesOuvertes[i])
      const cle = closes
        .map((p) => `${p.minX},${p.minY},${p.maxX},${p.maxY}`)
        .join(';')
      if (cle !== laserEtat.doorsKey) {
        laserEtat.doorsKey = cle
        sim.setDoors(closes)
      }
    }
  }

  // ---- Les pastilles de CONDENSAT : bues au contact du corps ----
  if (pastilles.length > 0 && !sim.dispersed) {
    // la fiole d'AIMANT élargit le rayon de collecte
    const rayon = (RAYON_PASTILLE + 14) * (fioleActive('aimant') ? 1.6 : 1)
    const bues = absorbePastilles(pastilles, pastillesPrises, sim, rayon)
    for (const i of bues) {
      const cl = pastilles[i].cl
      gagneCondensat(cl)
      run.pastillesCl += cl
      audio.collect()
    }
  }
  // ---- Les ÉCLATS DE MÉMOIRE : l'information cristallisée, gravée au
  // contact — une fois par RUN (la clé retient la salle). Aux essais
  // d'éditeur, l'éclat se prend mais rien ne se grave : on ne farme pas
  // les registres depuis un banc.
  if (eclatsEssai.length > 0 && !sim.dispersed) {
    const formes = eclatsEssai.map((e) => ({ x: e.x, y: e.y, cl: 1 }))
    const graves = absorbePastilles(formes, eclatsPrisEssai, sim)
    for (const i of graves) {
      const e = eclatsEssai[i]
      eclatsPrisRun.add(e.cle)
      if (testLevel) {
        toastFile.push({
          nom: 'essai : rien ne se grave aux registres',
          icone: '✦',
          article: 'memoire',
          sur: 'ÉCLAT DE MÉMOIRE',
        })
      } else {
        gagneMemoireRun(e.memoire)
        toastFile.push({
          nom: `+${e.memoire} mémoire — la matière se souvient`,
          icone: '✦',
          article: 'memoire',
          sur: 'ÉCLAT DE MÉMOIRE',
        })
      }
      audio.collect()
    }
  }
  // la FIOLE de la cachette profonde : l'échantillon scellé rejoint la
  // collection — laquelle, le tableau en décide (celles qui manquent)
  if (fiolePastille && !fiolePrise && !sim.dispersed) {
    const marque = [false]
    if (
      absorbePastilles([{ ...fiolePastille, cl: 0 }], marque, sim).length > 0
    ) {
      fiolePrise = true
      const manquantes = FIOLES.filter((f) => !records.possedeFiole(f.id))
      if (manquantes.length > 0) {
        let h = 0
        for (const ch of level.code) h = (h * 31 + ch.charCodeAt(0)) | 0
        const f = manquantes[Math.abs(h) % manquantes.length]
        records.ajouteFiole(f.id)
        toastFile.push({
          nom: `${f.nom} — ${f.desc}`,
          icone: f.icone,
          sur: 'FIOLE TROUVÉE',
        })
        audio.collect()
      } else {
        gagneCondensat(30)
      }
    }
  }

  // ---- LES PLOTS POSÉS (le méta en données) : l'achat au front d'entrée
  // d'une alcôve. Le hub et l'Économat modernes passent ICI — les blocs
  // hérités qui suivent ne couvrent plus que les vieux instantanés de
  // bibliothèque, sans plots dans leur fichier.
  const plotsNiveau = level.plots ?? []
  if (plotsNiveau.length > 0 && !sim.dispersed) {
    for (let i = 0; i < plotsNiveau.length; i++) {
      const p = plotsNiveau[i]
      const dedans =
        sim.stats.centroidX > p.minX &&
        sim.stats.centroidX < p.maxX &&
        sim.stats.centroidY > p.minY &&
        sim.stats.centroidY < p.maxY
      if (dedans && !plotsPosesDedans[i]) tenteAchatPlot(p)
      plotsPosesDedans[i] = dedans
    }
  }

  // (hérité) l'étal de l'Économat en dur, pour un vieil instantané ECO
  if (estEconomat(level) && plotsNiveau.length === 0 && !sim.dispersed) {
    for (let i = 0; i < ETAL_ECONOMAT.length; i++) {
      const a = ETAL_ECONOMAT[i]
      const dedans =
        sim.stats.centroidX > a.plot.minX &&
        sim.stats.centroidX < a.plot.maxX &&
        sim.stats.centroidY > a.plot.minY &&
        sim.stats.centroidY < a.plot.maxY
      if (dedans && !plotsDedans[i]) tenteAchat(a)
      plotsDedans[i] = dedans
    }
  }

  // ---- LE MÉTA AU HUB : les zones héritées (comptoir par géométrie) —
  // seulement quand le module joué n'a pas de plots en données
  const zonesHub = auHub && !sim.dispersed ? zonesDuHub(level) : null
  if (zonesHub && plotsNiveau.length === 0) {
    for (let i = 0; i < zonesHub.etal.length; i++) {
      const a = zonesHub.etal[i]
      const dedans =
        sim.stats.centroidX > a.plot.minX &&
        sim.stats.centroidX < a.plot.maxX &&
        sim.stats.centroidY > a.plot.minY &&
        sim.stats.centroidY < a.plot.maxY
      if (dedans && !plotsHubDedans[i]) tenteAchatHub(a)
      plotsHubDedans[i] = dedans
    }
  }
  // ---- LES STATIONS DE RÉPARATION : le corps se pose sur la station en
  // panne, la mémoire se débite, le module se rallume À CHAUD ----
  if (zonesHub) {
    for (let i = 0; i < REPARATIONS.length; i++) {
      const r = REPARATIONS[i]
      const plot = zonesHub.stations[r.id]
      if (!plot) continue
      const dedans = pointInBox(sim.stats.centroidX, sim.stats.centroidY, plot)
      if (dedans && !plotsReparDedans[i]) tenteReparation(r.id)
      plotsReparDedans[i] = dedans
    }
    // LE SECTEUR 4 (fin ouverte) : entrer dans l'alcôve joue la fin de
    // l'arc — le convoyeur, la montée, le choix. Rejouable à chaque
    // visite du module : la route reste ouverte.
    const surScelle =
      finOuverte() &&
      pointInBox(sim.stats.centroidX, sim.stats.centroidY, zonesHub.sasScelle)
    if (surScelle && !sasScelleDedans) {
      records.noteDecouverte('fin-jouee') // le marqueur de la fin vue
      void lireCineParCode('MIROIR')
    }
    sasScelleDedans = surScelle
    // LA TABLE DE DÉPART (une fois réparée) : le récapitulatif de ce
    // qu'on emporte, au moment où on longe le plan de travail
    const surTable =
      records.estRepare('table-depart') &&
      pointInBox(sim.stats.centroidX, sim.stats.centroidY, zonesHub.tableDepart)
    if (surTable && !tableDepartDedans) montreTableDepart()
    tableDepartDedans = surTable
  }
  // ---- LE BANC DES MÉMOIRES : posé en données (n'importe quel tableau),
  // sinon celui du module hérité. Le contact ouvre l'écran du cycle.
  const bancRect =
    level.bancMemoires ?? (zonesHub && !level.plots ? zonesHub.banc : null)
  if (bancRect && !sim.dispersed) {
    const surBanc = pointInBox(
      sim.stats.centroidX,
      sim.stats.centroidY,
      bancRect,
    )
    if (surBanc && !bancMemoiresDedans && cycleEl.hidden) {
      cycleEl.hidden = false
      renderCycleVoile()
      audio.collect()
    }
    bancMemoiresDedans = surBanc
  }

  // ---- Lasers : traçage, cibles, portes ----
  const lasers = level.lasers ?? []
  if (lasers.length > 0) {
    const cibles = level.cibles ?? []
    const portes = level.portes ?? []
    if (laserEtat.recepteurs.vues.length !== cibles.length) resetLasers()
    // portes fermées AVANT ce traçage : un faisceau ne traverse pas une porte
    // encore close — elle s'ouvrira pour l'image suivante
    const fermees = portes.filter((_, i) => !laserEtat.portesOuvertes[i])
    const rIce = params.particleSpacing * 1.3
    // le rayon du champ qui DÉFINIT la surface du liquide (dioptres)
    const rEau = params.laserMirrorSmooth * 0.6
    laserEtat.vues = lasers.map((em) =>
      traceLaser(em, {
        bounds: sim.bounds,
        boxes: level.boxes,
        portesFermees: fermees,
        cibles,
        // contact précis, normale MOYENNÉE large : le miroir est une facette
        // plane, pas une râpe — le reflet ne tremble plus à chaque bosse
        iceNormal: (x, y) =>
          sim.iceNormalAt(x, y, rIce, params.laserMirrorSmooth),
        // palier 2 : le corps liquide est un prisme — le rayon se plie à
        // chaque dioptre, et se piège sous la surface au-delà de ~49°.
        // Le milieu est LISSÉ au même rayon que la normale : la surface
        // effective est l'isoligne de densité, pas le grain des particules.
        // Le dioptre : la surface traversée et la normale qui plie le rayon
        // doivent décrire LA MÊME surface. Elles se calculaient sur deux
        // champs de rayons différents (0,6× pour l'appartenance, 1× pour la
        // normale) : la normale n'était pas perpendiculaire au dioptre
        // franchi — 4,7° d'écart en moyenne, jusqu'à 14,6°, doublés par les
        // deux interfaces. L'angle de sortie était faux.
        eau: {
          dedans: (x, y) => sim.liquidAt(x, y, rEau),
          normale: (x, y) => sim.liquidNormalAt(x, y, rEau),
        },
        indice: params.laserRefractIndex,
        // palier 3 : la vapeur ionise le faisceau en arc de plasma, que
        // les rails magnétiques capturent et guident
        vapeur: (x, y) => sim.gasAt(x, y, rIce),
        rails: level.rails ?? [],
        railRadius: params.plasmaRailRadius,
      }),
    )
    // Récepteurs : TOR à verrou (un passage allume pour de bon), NOR à
    // maintien (ouvert sous le faisceau ; la première coupure scelle la
    // porte fermée, définitivement) — machine à états dans laser.ts.
    const nowRecepteurs = performance.now() / 1000
    const toucheesImage: number[] = []
    for (const t of laserEtat.vues)
      for (const c of t.touchees) toucheesImage.push(c)
    avancerRecepteurs(
      cibles,
      toucheesImage,
      laserEtat.recepteurs,
      nowRecepteurs,
    )
    // une porte s'ouvre par son laser… ou par une SÉQUENCE (la brèche).
    // Elle vise un CANAL (le n° des pastilles) avec sa règle : OU (défaut,
    // une pastille active suffit) ou ET (toutes en même temps) — une porte
    // sans canal valide est une paroi que seul le récit ouvre.
    laserEtat.portesOuvertes = portes.map(
      (p, i) =>
        sequenceur.etat.brechesOuvertes.has(i) ||
        canalActif(
          cibles,
          p.canal,
          p.regle,
          laserEtat.recepteurs,
          nowRecepteurs,
        ),
    )
    // le FRONT MONTANT d'une pastille : l'instant de la victoire — on gèle
    // la trajectoire du rayon qui l'a allumée pour le sursaut (mode
    // somptueux ; le classique reste au pixel près)
    {
      const litNow = cibles.map((t, c) =>
        cibleActive(t, laserEtat.recepteurs, c, nowRecepteurs),
      )
      if (faisceauChoix >= 1) {
        for (let c = 0; c < litNow.length; c++) {
          if (!litNow[c] || laserEtat.litPrec[c] === true) continue
          const trace = laserEtat.vues.find((t) => t.touchees.includes(c))
          if (trace && trace.points.length >= 2) {
            laserEtat.impacts.push({
              t0: nowRecepteurs,
              cible: c,
              points: trace.points.map((p) => ({ ...p })),
            })
            if (laserEtat.impacts.length > 6) laserEtat.impacts.shift()
          }
        }
      }
      laserEtat.litPrec = litNow
    }
    // convoyage : quand un arc circule sur un rail, le champ s'y ENGAGE —
    // et il reste engagé tant qu'un nuage voyage dans la bande, même si le
    // rayon ne traverse plus la vapeur : ce qui est pris est porté jusqu'à
    // l'ARRIVÉE du rail. Le champ ne se relâche que la bande vide (nuage
    // arrivé, dispersé ou recondensé). Au rythme du temps simulé réellement
    // avancé (le ralenti de visée compte).
    const dtRail = Math.max(0, run.tableauTime - lastRailTime)
    if (dtRail > 0 && !input.paused && !tableauDone && !sim.dispersed) {
      const railsDuNiveau = level.rails ?? []
      const actifs = new Set<number>()
      for (const t of laserEtat.vues)
        for (const ri of t.railsSuivis) actifs.add(ri)
      // LES DEUX INSTANTS DU PLASMA, relevés AVANT d'engager les rails :
      // c'est la comparaison avec l'image d'avant qui fait l'événement. La
      // règle vit dans un module PUR (game/plasmaFx.ts) parce qu'aucun test
      // ne vient ici ; main.ts ne fait que la brancher et la dessiner.
      const fx = evenementsPlasma(
        laserEtat.vues,
        railsDuNiveau,
        railsEngages,
        laserEtat.ionisePrec,
        performance.now() / 1000,
      )
      laserEtat.ionisations.push(...fx.ionisations)
      laserEtat.captures.push(...fx.captures)
      // on ne garde que les derniers : un effet vit moins d'une seconde,
      // en empiler douze ne ferait que blanchir l'écran
      if (laserEtat.ionisations.length > 4)
        laserEtat.ionisations.splice(0, laserEtat.ionisations.length - 4)
      if (laserEtat.captures.length > 4)
        laserEtat.captures.splice(0, laserEtat.captures.length - 4)
      laserEtat.ionisePrec = fx.ionise
      for (const ri of actifs) railsEngages.add(ri)
      // LE CONDUIT S'OUVRE AU PLASMA, PAS À LA VAPEUR. Un nuage seul ne
      // suffit pas : il faut que l'arc ionisé circule sur CE rail — donc
      // s'être vaporisé DANS le faisceau, au pied du tube. Le raccourci est
      // la récompense de l'énigme, pas son contournement. Tant que le champ
      // n'est pas levé, le tube reste plein pour tout le monde.
      sim.setConduitsActifs(railsEngages)
      for (const ri of [...railsEngages]) {
        const rail = railsDuNiveau[ri]
        if (!rail) {
          railsEngages.delete(ri)
          continue
        }
        // bande de convoyage plus large que la capture : le nuage ENTIER
        // embarque, pas seulement son cœur posé sur la ligne
        const nBande = sim.railConvoy(
          rail.points,
          params.plasmaRailRadius * 2.5,
          params.plasmaConvoy,
          dtRail,
        )
        if (nBande === 0 && !actifs.has(ri)) railsEngages.delete(ri)
      }
    }
  }
  lastRailTime = run.tableauTime

  // Sortie (§7.1-7.2). Sas aspirant : la victoire n'arrive que lorsque le sas
  // a quasi tout bu (≤ 2 % du volume de base) — l'animation d'engloutissement
  // se joue en entier, le tampon ne coupe plus la spirale. Sas désactivé au
  // banc (rayon ou courant à 0) : règle historique, le centre du corps
  // franchit la boîte. L'eau avalée est mise en bonbonne dans les deux cas.
  const drainActive = params.exitRadius > 0 && params.exitPull > 0
  // La victoire : quand TOUT est bu, elle est automatique. Mais des gouttes
  // égarées traînent presque toujours quelque part — alors dès que le CORPS
  // PRINCIPAL est avalé, un bouton CONTINUER s'offre : c'est le joueur qui
  // décide de conclure, ou d'aller cueillir les dernières gouttes.
  const seuilBu = Math.max(6, sim.baseVolume * 0.02)
  // « un peu d'aspiration » : un dixième du volume de départ en bonbonne
  // suffit — la route coûte de l'eau (chaque impulsion éjecte), exiger la
  // moitié du volume INITIAL rendait le bouton inatteignable en vraie partie
  const aspireAssez = sim.swallowed >= Math.max(20, sim.baseVolume * 0.1)
  // Une traversée déclarée par un OUTIL de conception. La salle se conclut
  // pour de bon — cérémonie, condensat, descente qui avance — mais RIEN DE
  // CE QUI SE MÉRITE ne s'écrit : ni record du protocole, ni tableau
  // partagé, ni palmarès de la voie, ni trophée. Un outil ne doit jamais
  // pouvoir salir les registres : un chrono de 0,1 s y resterait pour
  // toujours, et il ne serait de personne.
  const sasOutil = forceSas
  forceSas = false // le drapeau ne vaut que pour cette image
  // LA SORTIE DU HUB déclarée par un outil : lue ICI, avec l'autre
  // drapeau, pour qu'elle ne fuie jamais vers l'image suivante — même si
  // la branche du hub ne s'exécute pas (dispersion, salle déjà conclue).
  const sortieOutil = forceSortieHub
  forceSortieHub = null
  const drunk =
    sasOutil ||
    (sim.swallowed > 0 && sim.count <= seuilBu) ||
    (aspireAssez && continuerVoulu)
  btnContinuer.classList.toggle(
    'visible',
    aspireAssez &&
      !drunk &&
      !tableauDone &&
      !sim.dispersed &&
      !input.paused &&
      document.body.classList.contains('playing'),
  )
  const reached =
    !drainActive &&
    pointInBox(sim.stats.centroidX, sim.stats.centroidY, level.exit)
  // au HUB, pas d'engloutissement à attendre : dès que le CORPS est dans la
  // bouche du sas, la run part — le sas de lancement est une porte, pas un
  // collecteur
  // Zones déclencheuses de cinématique : le corps (son centre) entre dans
  // la zone → la cinématique codée se joue, UNE fois par essai. La lecture
  // met la simulation en pause ; au retour, rien n'a bougé.
  if (!lecteurCine.actif && !run.ended && !sim.dispersed) {
    const zs = level.zones ?? []
    for (let i = 0; i < zs.length; i++) {
      const dedans = (): boolean =>
        zoneShape(zs[i], sim.stats.centroidX, sim.stats.centroidY) <= 1
      const code = zs[i].cine
      if (code && !cinesVues.has(`${i}:${code}`) && dedans()) {
        cinesVues.add(`${i}:${code}`)
        void lireCineParCode(code)
      }
      // …et la SÉQUENCE in-map, même règle : une fois par essai
      const seq = zs[i].sequence
      if (seq && !cinesVues.has(`s${i}:${seq}`) && dedans()) {
        cinesVues.add(`s${i}:${seq}`)
        demarreSequence(seq)
      }
    }
  }
  // LES TROIS SAS DU HUB : le sas principal (l'eau) lance la descente
  // écrite ; le SAS DU GIVRE (derrière le rideau — la glace) lance LA
  // VOIE ; le SAS DE VAPEUR (derrière la grille) lance la DESCENTE DU
  // JOUR. Le verrou est la MATIÈRE : sans le lien tissé, pas de passage.
  const zonesSas = auHub ? zonesDuHub(level) : null
  // une sortie DÉCLARÉE par le pupitre vaut le corps posé dessus : tout
  // l'aval reste le vrai chemin (mode de descente, son, cinématique,
  // reprise de la sauvegarde) — seul le déclenchement est forcé
  const surSasGivre =
    sortieOutil === 'givre' ||
    (!!zonesSas &&
      pointInBox(sim.stats.centroidX, sim.stats.centroidY, zonesSas.sasGivre))
  const surSasVapeur =
    sortieOutil === 'vapeur' ||
    (!!zonesSas &&
      pointInBox(sim.stats.centroidX, sim.stats.centroidY, zonesSas.sasVapeur))
  const rejointSasHub =
    (auHub &&
      (sortieOutil !== null ||
        pointInBox(sim.stats.centroidX, sim.stats.centroidY, level.exit))) ||
    surSasGivre ||
    surSasVapeur
  if (
    !tableauDone &&
    !sim.dispersed &&
    (drunk || reached || rejointSasHub) &&
    auHub
  ) {
    // LE SAS DE LANCEMENT : au hub, le sas ne collecte rien — il LANCE la
    // run. Reprise de l'expédition sauvée s'il y en a une, salle 1 sinon.
    auHub = false
    // les sorties GARDÉES lancent une descente NEUVE (on repart du premier
    // rang) ; le sas principal, lui, reprend la descente sauvée s'il y en a
    const descenteNeuve = surSasGivre || surSasVapeur
    voieDuJourForcee = surSasVapeur
    audio.collect()
    bande.ponctuation('sting-collecte', 0.85)
    // LE SCÉNARIO : la cinématique du départ, s'il y en a une — la run
    // attend qu'elle finisse (la simulation est en pause pendant ce temps)
    void joueMoment('lancement-run').then(() => {
      // les sorties gardées lancent toujours une descente NEUVE : la
      // sauvegarde appartient à l'expédition écrite du sas principal
      const save = descenteNeuve ? null : runSauvee()
      if (save) {
        reprendreRun(save)
      } else {
        newExpedition()
      }
    })
  } else if (
    !tableauDone &&
    !sim.dispersed &&
    (drunk || reached) &&
    testLevel
  ) {
    // Prototype 21-A bis : l'essai conclut sans toucher aux registres ni à
    // l'expédition — on félicite, on ramène au protocole.
    const surplus = sim.liters() + sim.swallowed * params.litersPerParticle
    audio.collect()
    bande.ponctuation('sting-collecte', 0.85)
    run.ended = true
    const bestsLibre = records.tableauRecord(level.code)
    const refRecords = bestsLibre
      ? ` Records de la salle : 💧 ${fmtL(bestsLibre.volume.liters)} · ⏱ ${fmtTime(bestsLibre.chrono.time)}.`
      : ''
    showOverlay(
      fromEditor ? 'TABLEAU FRANCHI' : `ESSAI ${level.code} CONCLU`,
      fromEditor
        ? `${surplus.toFixed(2)} L collectés en ${fmtTime(run.tableauTime)} — le tableau se termine. Retour à l’éditeur pour l’ajuster.`
        : `${surplus.toFixed(2)} L collectés en ${fmtTime(run.tableauTime)} — essai hors expédition : les registres ne bougent pas.${refRecords}`,
      'success',
      fromEditor
        ? 'RETOUR À L’ÉDITEUR'
        : testQueue.length > 0
          ? 'SALLE SUIVANTE'
          : 'RETOUR AU PROTOCOLE',
    )
    // la cinématique de CONCLUSION : par-dessus le bilan, qui l'attend derrière
    if (level.cineApres) void lireCineParCode(level.cineApres)
  } else if (
    !tableauDone &&
    !sim.dispersed &&
    (drunk || reached) &&
    estEconomat(level)
  ) {
    // LE SAS DE REPRISE de l'Économat : un passage, pas un collecteur —
    // rien ne se consigne, pas de cérémonie ; la descente reprend, la
    // bourse en poche.
    audio.collect()
    bande.ponctuation('sting-collecte', 0.85)
    avanceSalle()
  } else if (!tableauDone && !sim.dispersed && (drunk || reached)) {
    // Prime de glace : ce que le sas a avalé SOLIDE vaut plus cher que ce
    // qu'il a bu goutte à goutte.
    // CHAMBRE FROIDE : la prime de glace vaut moitié plus — la carte le
    // promettait depuis le premier jour sans que rien ne l'applique
    const prime =
      sim.swallowedIce *
      params.litersPerParticle *
      params.iceCollectBonus *
      lev('primeGlace')
    const surplus =
      sim.liters() + sim.swallowed * params.litersPerParticle + prime
    run.livreTotal += surplus
    // FILTRE À CONDENSAT : un quart de plus sur tout ce qui passe le sas
    const rendement = lev('condensat')
    // chaque centilitre livré nourrit le CONDENSAT (la bourse de la RUN,
    // purgée à la fin) — y compris sur la
    // dernière salle : rien de ce qui atteint le sas n'est jamais perdu
    gagneCondensat(surplus * 100 * rendement)
    // Trophées de collecte : « Sans une goutte » (≥ 95 % du volume de
    // départ livré) et « Opérateur de nuit » (21 collectes cumulées)
    if (!sasOutil) {
      if (surplus >= 0.95 * level.spawn.n * params.litersPerParticle)
        trophees.debloque('sans-une-goutte')
      if (trophees.compte('collectes') >= 21)
        trophees.debloque('operateur-de-nuit')
      codex.marque('sas') // le codex consigne la première mise en bonbonne
    }
    const premiereFois = records.tableauRecord(level.code) === null
    // les registres ne bougent pas sous un outil : aucun record consigné,
    // donc aucun record neuf à annoncer
    const { newVolume, newChrono } = sasOutil
      ? { newVolume: false, newChrono: false }
      : records.noteCollection(level.code, surplus, run.tableauTime)
    // LA MÉMOIRE se grave à chaque sas — l'information survit à la purge :
    // +5 la traversée, +5 la toute première de ce tableau, +2 par record ;
    // LE MUR DES RECORDS réparé double la part des records (le banc
    // optique consigne mieux)
    const primeMur =
      records.estRepare('mur-records') && (newVolume || newChrono) ? 2 : 0
    gagneMemoireRun(
      5 +
        (premiereFois ? 5 : 0) +
        (newVolume ? 2 : 0) +
        (newChrono ? 2 : 0) +
        primeMur,
    )
    // Publication au tableau d'honneur partagé : le serveur ne garde que le
    // meilleur — la réponse remet les registres affichés à jour.
    if (!sasOutil)
      pushTableauRecord(
        level.code,
        surplus,
        run.tableauTime,
        records.operator(),
      ).then((b) => {
        if (b) {
          sharedBoard = b
          renderRegistres()
          // « La ligne de crête » : le rang 1 en NOTE vient de tomber ?
          const top = b.tops?.[level.code]?.note?.[0]
          if (top && top.name === records.operator())
            trophees.debloque('ligne-de-crete')
        }
      })
    // sous un outil, la salle peut n'avoir aucun record : le bilan le dit
    const bests = records.tableauRecord(level.code)
    audio.collect()
    // Le record a sa propre fanfare : la collecte ordinaire ne doit pas
    // sonner comme un exploit, sinon plus rien ne sonne comme un exploit.
    bande.ponctuation(
      newVolume || newChrono ? 'sting-record' : 'sting-collecte',
      0.85,
    )
    // LA VOIE : chaque sas bu creuse la descente d'un rang — le palmarès
    // suit en direct (profondeur record, descentes entamées)
    voieRang += 1 // la descente avance : c'est la progression, pas un titre
    voieVues.add(level.code) // la pioche ne la reproposera pas de la run
    if (!sasOutil) {
      const p = chargePalmaresVoie()
      if (voieRang === 1) p.descentes += 1
      if (voieRang > p.profondeurRecord) p.profondeurRecord = voieRang
      sauvePalmaresVoie(p)
    }
    // la fin : la descente se boucle au bout du PLAN — c'est le réglage de
    // longueur qui dit combien de salles fait une descente
    const finExpedition = voieRang >= voiePlan.longueur
    if (finExpedition) {
      // Dernier sas : l'expédition est achevée — bilan, et registres à jour
      run.ended = true
      if (!sasOutil) trophees.debloque('integrale')
      gagneMemoireRun(10) // l'expédition bouclée grave son souvenir
      const sallesFranchies = voieRang
      // une expédition CONCLUE PAR L'OUTIL ne s'inscrit nulle part : ni
      // record d'expédition, ni tableau partagé
      const exp = sasOutil
        ? { newRecord: false }
        : records.noteExpedition(sallesFranchies, run.livreTotal, run.runTime)
      if (!sasOutil)
        pushExpeditionRecord(
          sallesFranchies,
          run.livreTotal,
          run.runTime,
          records.operator(),
        ).then((b) => {
          if (b) {
            sharedBoard = b
            renderRegistres()
          }
        })
      // le palmarès de la voie : la descente est BOUCLÉE
      let voieNeuf = ''
      if (!sasOutil) {
        const p = chargePalmaresVoie()
        p.bouclees += 1
        if (run.livreTotal > p.meilleurLivre) {
          p.meilleurLivre = run.livreTotal
          voieNeuf = ' — <em class="bilan-neuf">MEILLEURE DESCENTE ✦</em>'
        }
        sauvePalmaresVoie(p)
      }
      renderRegistres()
      // l'expédition principale conclue n'a plus rien à reprendre
      if (!testLevel) effaceRun()
      // LE SCÉNARIO : la cinématique de fin d'expédition, sur le bilan
      void joueMoment('expedition-achevee')
      const palm = chargePalmaresVoie()
      // le BUTIN de la descente : ce que la run a réellement rapporté — les
      // instruments emportés (leurs glyphes), les paliers d'étalonnage, le
      // condensat nourri (chaque centilitre livré en a versé un)
      const glyphes = run.instruments
        .map((i) => carteDef(i)?.icone ?? '')
        .filter(Boolean)
        .join(' ')
      const butinVoie =
        `<br>Butin de la descente : ` +
        `${run.instruments.length > 0 ? `${glyphes} ${run.instruments.length} instrument(s)` : 'aucun instrument'} · ` +
        `palier d'étalonnage ${paliersAtteints(run.xp)} · ` +
        `+${run.memoireGagnee} MÉMOIRE gravée — la purge confisque le condensat restant (${condensat} cL).`
      showOverlay(
        'LA DESCENTE EST BOUCLÉE',
        `<span class="bilan"><span class="bilan-l">${expeditionSummary(sallesFranchies)}${voieNeuf}${
          exp.newRecord
            ? ' — <em class="bilan-neuf">MEILLEURE EXPÉDITION ✦</em>'
            : ''
        }</span></span>` +
          `Descente de ${sallesFranchies} salles, du premier sas au dernier.${butinVoie}<br>` +
          `Palmarès du poste : ${palm.bouclees} bouclée(s) · profondeur record ${palm.profondeurRecord} · meilleur livré ${fmtL(palm.meilleurLivre)}.`,
        'success',
        'RETOUR AU LABO',
      )
    } else {
      renderRegistres()
      run.conclues += 1
      // LA MISE EN BONBONNE : la cérémonie remplace le bandeau — elle tient
      // l'essai en suspens jusqu'au choix d'instrument, qui mène à la suite
      montreMiseEnBonbonne({
        surplus,
        prime,
        pct: surplus / Math.max(0.01, level.spawn.n * params.litersPerParticle),
        temps: run.tableauTime,
        newVolume,
        newChrono,
        recVol: bests
          ? `${fmtL(bests.volume.liters)}${bests.volume.name ? ' · ' + htmlSafe(bests.volume.name) : ''}`
          : '—',
        recChr: bests
          ? `${fmtTime(bests.chrono.time)}${bests.chrono.name ? ' · ' + htmlSafe(bests.chrono.name) : ''}`
          : '—',
        note: Math.round((surplus * 100 * 60) / (60 + run.tableauTime)),
        gainCl: Math.round(surplus * 100 * rendement) + run.pastillesCl,
        totalCl: condensat,
      })
    }
    // la cinématique de CONCLUSION du tableau : par-dessus le bilan — la
    // pause de lecture retient aussi le passage automatique à la suite
    if (level.cineApres) void lireCineParCode(level.cineApres)
  }
  if (run.exitTimer > 0) {
    run.exitTimer -= dtReal
    if (run.exitTimer <= 0) avanceSalle()
  }

  // Ondes d'éjection : naissance côté visée, sur le bord du corps (pas en vapeur)
  if (
    input.aimActive &&
    !input.gasIntent &&
    !sim.dispersed &&
    !input.paused &&
    !tableauDone
  ) {
    waveCarry += dtReal
    if (waveCarry >= WAVE_EVERY) {
      waveCarry = 0
      const dx = aim.x - sim.stats.centroidX
      const dy = aim.y - sim.stats.centroidY
      const len = Math.hypot(dx, dy) || 1
      const r = sim.stats.rmsRadius * 1.1
      // en rassemblement, l'onde part du CENTRE : le battement d'un cœur qui
      // se reforme, pas une salve qui sort
      waves.push({
        x: rassembler
          ? sim.stats.centroidX
          : sim.stats.centroidX + (dx / len) * r,
        y: rassembler
          ? sim.stats.centroidY
          : sim.stats.centroidY + (dy / len) * r,
        t: elapsed,
      })
      if (waves.length > MAX_WAVES) waves.shift()
    }
  } else {
    waveCarry = WAVE_EVERY
  }
  while (waves.length > 0 && elapsed - waves[0].t > 1) waves.shift()
  for (let i = 0; i < waves.length; i++) {
    waveScratch[i * 4] = waves[i].x
    waveScratch[i * 4 + 1] = waves[i].y
    waveScratch[i * 4 + 2] = waves[i].t
    waveScratch[i * 4 + 3] = 1
  }

  // Caméra : suivi du corps, ou vue d'ensemble du tableau depuis le banc
  if (monitor.overview) {
    const b = sim.bounds
    const fitZoom =
      Math.min(vw / (b.maxX - b.minX), vh / (b.maxY - b.minY)) * 0.94
    camera.snapTo((b.minX + b.maxX) * 0.5, (b.minY + b.maxY) * 0.5, fitZoom)
  } else {
    camera.update(
      dtReal,
      sim.stats.centroidX,
      sim.stats.centroidY,
      sim.stats.rmsRadius,
      vw,
      vh,
      params,
    )
    majEveil(dtReal) // l'éveil suit la caméra : ses repères (invite) sont à jour
  }
  updateTutor(dtReal)
  updateTrophees(dtReal)
  majFpsCoin(dtReal)
  updateWorldLabels(vw, vh)
  appliqueSequence() // carte et secousse de la mise en scène
  drawMecanismes(vw, vh, dpr)
  drawFleche(dtReal, dpr)
  majIdle(dtReal)
  majPresence(dtReal, aim.x, aim.y)
  // LE SOL DES MODULES : un tableau bâti en coques n'a pas de cuve — son
  // fond ne se peint qu'à l'intérieur des modules, et le dehors est le vide.
  // Le réglage se pose ICI, à l'image, et non dans applyLevel : applyLevel
  // tourne AU CHARGEMENT DU MODULE, avant que le renderer existe — l'appeler
  // là-bas jetait « Cannot access before initialization » et l'accueil ne
  // s'affichait plus du tout. Posé à l'image, il ne peut ni arriver trop tôt
  // ni rester en retard d'un tableau.
  renderer.setSolModules(level.coque === 'structures')
  renderer.setCiel(
    CIEL_MODE[cielChoix],
    cielReglages.force,
    cielReglages.etendue,
  )
  // LA PROFONDEUR DES COUCHES DE FOND : posée à l'image comme le ciel, pour
  // que le banc l'entende tout de suite. Le facteur se cuisine ICI, une fois
  // par image (il ne dépend que du zoom et des réglages) : le shader n'a plus
  // qu'une multiplication par pixel. En décor SOBRE, facteur 1 partout — le
  // rendu d'avant, au pixel près : un réglage d'ambiance ne doit pas être ce
  // qui distingue les deux branches du test A/B.
  const par = parallaxeReglages
  const g = (suivi: number, zoom: number): [number, number] => [
    suivi,
    decorRiche ? facteurG(camera.zoom, { suivi, zoom }, par.ref) : 1,
  ]
  renderer.setParallaxe(
    g(par.cielSuivi, par.cielZoom),
    g(par.semisSuivi, par.semisZoom),
    g(par.cuveSuivi, par.cuveZoom),
  )
  const renderT0 = performance.now()
  renderer.render(
    sim,
    camera,
    params,
    vw,
    vh,
    dpr,
    renderBoxes,
    elapsed,
    waveScratch,
    waves.length,
    params.renderDownsample,
    chillNow(),
    decorAffiche(),
    level.zones ?? [],
    decorRiche ? 1 : 0,
    eauRiche ? 1 : 0,
    lumiereActive ? 1 : 0,
    lumieresVives(),
    lumiereEauActive ? 1 : 0,
    level.ambiante ?? AMBIANTE_DEFAUT,
    RELIEF_K[reliefChoix],
    level.brume ?? 0,
    eauMiroir,
    level.plafond ?? '',
    {
      regardX: presence.x,
      regardY: presence.y,
      regardInt: presence.int,
      respAmp: presence.amp,
      respVit: presence.vit,
      frisson: presence.frisson,
      ondule: presence.ondule,
      oeilLueur: oeilRegl.lueur,
      oeilOmbre: oeilRegl.ombre,
      oeilTaille: oeilRegl.taille,
      oeilRelief: oeilRegl.relief,
    },
  )
  const rendRaw = performance.now() - renderT0
  monitor.renderMs += (rendRaw - monitor.renderMs) * 0.08
  // le collecteur note CHAQUE image rendue — c'est la matière du rapport.
  // Le CPU total inclut tout le rappel jusqu'ici : laser, étiquettes,
  // panneau 2D, HUD — ce que « autreJsMs » isole dans le rapport.
  perf.note(
    dtBrutMs,
    performance.now() - frameT0,
    physRaw,
    rendRaw,
    stepsFaits,
    sim.count,
    Math.round(echelleRendue() * 100),
  )
  majPerfVif()

  const speed = Math.hypot(sim.stats.velX, sim.stats.velY)
  monitor.fps = fpsSmoothed
  monitor.particles = sim.count
  monitor.volume = sim.liters()
  monitor.speed = speed
  monitor.quality = echelleRendue()

  btnPause.textContent = input.paused ? '▶' : '⏸'
  btnPause.classList.toggle('active', input.paused)
  chipLegend.classList.toggle('active', legend.classList.contains('visible'))
  chipStates.classList.toggle(
    'active',
    statesPanel.classList.contains('visible'),
  )
  chipBench.classList.toggle(
    'active',
    benchHost !== null && benchHost.style.display !== 'none',
  )
  chipEditor.style.display = fromEditor ? '' : 'none'
  btnVortex.classList.toggle('active', input.vortexArmed)
  btnVortex.style.display = params.vortexEnabled >= 0.5 ? '' : 'none'
  majCadranEtats(zoneActive)
  // le DOSSIER se rafraîchit quatre fois par seconde tant qu'il est ouvert
  if (dossierOuvert) {
    const tMaj = performance.now() / 1000
    if (tMaj >= dossierProchainMaj) {
      majDossier()
      dossierProchainMaj = tMaj + 0.25
    }
  }
  // dans une zone imposée, le sélecteur se grise : le choix n'est plus offert
  const locked = zoneActive !== 'libre'
  stateEau.disabled = locked
  stateGlace.disabled = locked
  stateVapeur.disabled = locked
  document.body.classList.toggle('state-locked', locked)
  btnSound.textContent = audio.enabled ? '🔊' : '🔇'

  // Instruments de bord
  const fraction = sim.baseVolume > 0 ? sim.playerCount / sim.baseVolume : 0
  hudTableau.textContent = testLevel
    ? 'BIS'
    : auHub
      ? 'LABO'
      : estEconomat(level)
        ? 'ÉCONOMAT'
        : `SALLE ${levelIndex + 1}/${playedLevels().length}`
  // les échantillons de secours (vies) et la bonbonne : en run seulement —
  // au labo comme aux essais, rien ne se paie et rien ne se collecte
  hudViesChip.hidden = !!testLevel || auHub
  bonbonneEl.hidden = !!testLevel || auHub
  hudCondChip.hidden = !!testLevel || auHub
  hudCond.textContent = `${condensat} cL`
  hudVies.textContent = `×${run.vies}`
  // La coque refroidit : +21° au départ, −60° à froid complet — la pression
  // temporelle se lit ici (chiffre ET barre), jamais sur un chronomètre
  const coque = Math.round(21 - 81 * chillNow())
  hudCoque.textContent = `${coque > 0 ? '+' : ''}${coque}°`
  hudCoque.classList.toggle('warn', chillNow() > 0.75)
  coqueBar.style.width = `${(chillNow() * 100).toFixed(1)}%`
  // AU HUB la réserve est infinie : afficher un litrage qui ne descend
  // jamais ferait croire à une jauge en panne.
  const bbInfinie = bonbonneIllimitee(auHub)
  hudBonbonne.textContent = bbInfinie
    ? '∞'
    : `${run.bonbonneLiters.toFixed(2)} / ${capBonbonne()} L`
  // LE NIVEAU DANS LE VERRE : la part de réserve, poursuivie en douceur.
  // L'intérieur utile va de y = 8,5 (plein) à y = 57,5 (vide) dans le
  // viewBox — soit 49 unités de descente pour un verre vide.
  const bbCible = bbInfinie
    ? 1
    : Math.max(0, Math.min(1, run.bonbonneLiters / capBonbonne()))
  bbAffiche += (bbCible - bbAffiche) * Math.min(1, dtReal * 5)
  if (Math.abs(bbCible - bbAffiche) < 0.002) bbAffiche = bbCible
  if (bbLiquide)
    bbLiquide.setAttribute(
      'transform',
      `translate(0 ${((1 - bbAffiche) * 49).toFixed(2)})`,
    )
  // le versement est possible : le verre s'ourle de vert pour inviter au geste
  const peutVerser =
    run.bonbonneLiters >= params.litersPerParticle &&
    sim.playerCount < level.spawn.n &&
    !input.freezeIntent &&
    !input.gasIntent
  bonbonneEl.classList.toggle('verse-ok', peutVerser)
  // RAPPEL : le corps touche à sa dernière goutte (il approche du seuil
  // critique) et la réserve peut le renflouer — la fiole bat doucement.
  // On ne bat pas pour rien : sans réserve utile, elle reste immobile.
  bonbonneEl.classList.toggle(
    'rappel',
    peutVerser &&
      !tableauDone &&
      !sim.dispersed &&
      sim.liters() < params.criticalVolumeLiters * 1.7,
  )
  // PRÉSENTATION : au début du tableau, la fiole se pose et son éclat
  // balaie le verre — le niveau remonte de zéro sous les yeux du joueur
  if (bbPresenteA >= 0 && run.tableauTime - bbPresenteA > 1) {
    bbPresenteA = -1
    bonbonneEl.classList.remove('presente')
  }
  if (hudInstrChip) {
    hudInstrChip.hidden = !!testLevel || auHub || run.instruments.length === 0
    if (hudInstrChip.hidden && instrPanel) instrPanel.hidden = true
  }
  // La vie compte la matière VIVANTE : le corps plus les gouttes marquées
  // encore dans son halo (la règle : n'est perdu que ce qui en SORT — et
  // tout ce qui reste dans le halo revient, le rappel s'en charge).
  hudVolume.innerHTML = `${sim.liters().toFixed(2)} <small>L · ${sim.aliveCount()} part.</small>`
  gaugeFill.style.width = `${Math.min(100, fraction * 100).toFixed(1)}%`
  // Le seuil est un volume ABSOLU : sa position sur la jauge (graduée en % du
  // volume de départ) dépend donc du volume de base de ce tableau.
  const baseLiters = sim.baseVolume * params.litersPerParticle
  const seuilPct =
    baseLiters > 0 ? (params.criticalVolumeLiters / baseLiters) * 100 : 0
  gaugeThreshold.style.left = `${Math.min(100, seuilPct).toFixed(1)}%`
  hudSeuil.textContent = `${params.criticalVolumeLiters.toFixed(2)} L`
  hudVitesse.textContent = `${speed.toFixed(0)} u/s`

  // Débit de perte lissé : combien coûte l'action en cours, et à quoi
  const nowLiters = sim.liters()
  const simT = run.tableauTime
  if (lossPrevLiters >= 0 && simT > lossPrevT) {
    const inst = (lossPrevLiters - nowLiters) / (simT - lossPrevT)
    lossRate +=
      (Math.max(0, inst) - lossRate) * Math.min(1, (simT - lossPrevT) * 4)
  } else if (simT < lossPrevT) {
    lossRate = 0
  }
  lossPrevLiters = nowLiters
  lossPrevT = simT
  if (lossRate > 0.02 && !sim.dispersed && !tableauDone) {
    const cause = input.gasIntent
      ? 'coût vapeur'
      : input.aimActive
        ? 'éjection'
        : 'surfaces'
    hudPerte.textContent = `−${lossRate.toFixed(2)} L/s · ${cause}`
  } else {
    hudPerte.textContent = ''
  }
  // La rosée : ce que la vapeur a perdu et que les plaques froides rendront
  const roseeL = sim.vaporBank * params.litersPerParticle
  hudRosee.textContent =
    levelHasCold && roseeL >= 0.05
      ? `rosée récupérable aux plaques froides : ${roseeL.toFixed(2)} L`
      : ''

  // ---- LE VERSEMENT AUTOMATIQUE DU HUB ------------------------------
  // Au hub, la jauge basse n'est pas une tension de jeu : c'est une gêne.
  // La réserve s'y verse donc toute seule, AVANT que la première alerte
  // n'ait eu le temps de s'afficher — le seuil est posé au-dessus de
  // `lastCallLiters` exprès (src/game/bonbonne.ts). Placé juste avant le
  // bloc de fin de course, qui est celui qui lève les alertes : à l'image
  // où la bannière se poserait, le corps est déjà renfloué.
  if (
    doitVerserAuto({
      auHub,
      litres: sim.liters(),
      litresPleins: level.spawn.n * params.litersPerParticle,
      lastCallLiters: params.lastCallLiters,
      empeche:
        input.paused ||
        input.freezeIntent ||
        input.gasIntent ||
        miseEnBonbonne ||
        sim.dispersed ||
        run.ended ||
        run.exitTimer > 0,
      depuisDernier: run.tableauTime - dernierVersementAuto,
    })
  ) {
    // l'horodatage se pose sur TOUTE tentative, pas seulement sur celle qui
    // réussit : un corps qui n'arrive pas à absorber (creux pleins) renvoie
    // 'rien', et sans cela le versement — et son son de collecte — repartait
    // à chaque image. C'est exactement le crépitement que le repos existe
    // pour empêcher.
    verserBonbonne()
    dernierVersementAuto = run.tableauTime
  }

  // ---- Fin de course : dernière impulsion, gel, arrêt ----
  // Aucun minimum à ramener : on peut finir un tableau sur un souffle. Sous le
  // seuil, la prochaine impulsion est la dernière ; une fois donnée, le corps
  // se fige avec son élan et l'essai s'achève à l'arrêt.
  // MAIS : quand le SAS BOIT, le volume fond parce qu'il est COLLECTÉ — la
  // fin de course n'a rien à y redire. Tant que l'aspiration avale (et une
  // bonne seconde après), alerte, dernière impulsion et gel se taisent.
  if (sim.swallowed > endgame.sasVu) {
    endgame.sasVu = sim.swallowed
    endgame.sasBoitJusqua = run.tableauTime + 1.2
  }
  const sasBoit = run.tableauTime <= endgame.sasBoitJusqua
  // Dès qu'un peu d'aspiration a eu lieu, le bouton CONTINUER prend le
  // relais : la fin de course funeste (alerte, dernière impulsion, gel)
  // n'a plus voix — un corps qui fond parce qu'il se fait BOIRE n'agonise
  // pas. Sans cela, 1,2 s après la fin de l'aspiration, « playerCount ≤ 8 »
  // déclarait « l'échantillon dérive » sur un corps... collecté.
  endgame.enCollecte = sasBoit || aspireAssez
  if (endgame.enCollecte) endgame.lastCall = false // le sas boit : l'alarme se tait
  const alive = !sim.dispersed && !tableauDone && !run.ended
  if (alive && !endgame.spent && !endgame.enCollecte) {
    endgame.lastCall = sim.liters() <= params.criticalVolumeLiters
    // se rassembler ne dépense rien : ce maintien-là n'est pas une impulsion,
    // il ne consomme pas la dernière
    const aiming = input.aimActive && !input.paused && !rassembler
    // le relâchement du pointeur conclut l'impulsion en cours
    if (endgame.lastCall && endgame.wasAiming && !aiming) endgame.spent = true
    // plus rien à éjecter : le gel s'impose sans attendre le relâchement
    if (sim.playerCount <= 8) endgame.spent = true
    endgame.wasAiming = aiming
    if (endgame.spent) {
      input.freezeIntent = true // le froid saisit ce qu'il reste, l'élan est gardé
      input.gasIntent = false
      manette.rumble(1, 260) // la dernière impulsion se sent dans les mains
    }
  }
  if (endgame.spent && alive) {
    // Le corps reste figé et dérive. Aucun arrêt ne conclut : le vide ne
    // freine rien, et une paroi peut encore renvoyer le palet vers le sas.
    // C'est le joueur qui décide d'en rester là — le bouton de relance
    // apparaît, sans rien masquer de la trajectoire.
    input.freezeIntent = true
    input.gasIntent = false
  }

  // La relance s'offre dès la dernière impulsion donnée, et ne coupe rien.
  // Son LIBELLÉ dit la vérité du moment : en run, elle conclut (le sursis
  // court, le sas peut encore boire) ; ailleurs, elle rejoue la salle.
  btnRelance.textContent =
    !testLevel && !auHub && !run.ended
      ? 'EN RESTER LÀ — CONCLURE LA SALLE'
      : 'RECOMMENCER LE TABLEAU'
  btnRelance.classList.toggle(
    'visible',
    (endgame.spent || sim.dispersed) &&
      // le CONTINUER offert prime : une seule invite à l'écran
      !(aspireAssez && !sim.dispersed) &&
      document.body.classList.contains('playing') &&
      !tableauDone &&
      !run.ended,
  )

  const nearLast =
    alive &&
    !endgame.spent &&
    !endgame.enCollecte &&
    sim.liters() <= params.lastCallLiters
  // une fois le CONTINUER offert, plus aucune bannière funeste : le bouton
  // est l'interface de fin, l'alarme n'a plus rien à dire
  const inDanger =
    alive && !aspireAssez && (endgame.spent || endgame.lastCall || nearLast)
  if (inDanger) {
    hudDanger.textContent = endgame.spent
      ? '❄ DERNIÈRE IMPULSION DONNÉE — L’ÉCHANTILLON DÉRIVE'
      : endgame.lastCall
        ? '⚠ RÉSERVE À SEC — LA PROCHAINE IMPULSION EST LA DERNIÈRE'
        : '⚠ RÉSERVE BASSE — LA DERNIÈRE IMPULSION APPROCHE'
  }
  hudDanger.classList.toggle(
    'visible',
    inDanger && document.body.classList.contains('playing') && !input.paused,
  )
  hudDanger.classList.toggle('spent', endgame.spent)
  gaugeFill.classList.toggle(
    'danger',
    (inDanger && endgame.lastCall) ||
      (endgame.spent && !aspireAssez) ||
      sim.dispersed,
  )
  gaugeFill.classList.toggle(
    'warn',
    nearLast && !endgame.lastCall && !sim.dispersed,
  )

  // L'objectif : quand le sas sort de l'écran, une flèche le pointe depuis le
  // bord du cadre, avec la distance restante — on sait toujours où aller.
  const exitSx = vw * 0.5 + (exitMouth.x - camera.x) * camera.zoom
  const exitSy = vh * 0.5 - (exitMouth.y - camera.y) * camera.zoom
  const exitOnScreen =
    exitSx > 30 && exitSx < vw - 30 && exitSy > 92 && exitSy < vh - 140
  const showArrow =
    document.body.classList.contains('playing') &&
    !tableauDone &&
    !sim.dispersed &&
    !monitor.overview &&
    !exitOnScreen
  if (showArrow) {
    const ang = Math.atan2(exitSy - vh * 0.5, exitSx - vw * 0.5)
    const ax = Math.min(vw - 48, Math.max(48, exitSx))
    const ay = Math.min(vh - 152, Math.max(106, exitSy))
    objArrow.style.transform = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px) translate(-50%, -50%)`
    objArrowGlyph.style.transform = `rotate(${((ang * 180) / Math.PI).toFixed(1)}deg)`
    const dWorld = Math.hypot(
      exitMouth.x - sim.stats.centroidX,
      exitMouth.y - sim.stats.centroidY,
    )
    objDist.textContent = `SAS · ${Math.round(dWorld)} u`
  }
  objArrow.classList.toggle('visible', showArrow)

  // Ligne de visée du dash : du corps au pointeur, avec le coût annoncé —
  // on choisit sa trajectoire en connaissance de cause, le temps attendra.
  if (dash.aiming) {
    const sx = vw * 0.5 + (sim.stats.centroidX - camera.x) * camera.zoom
    const sy = vh * 0.5 - (sim.stats.centroidY - camera.y) * camera.zoom
    const ex = input.aimClientX
    const ey = input.aimClientY
    const len = Math.hypot(ex - sx, ey - sy)
    const ang = Math.atan2(ey - sy, ex - sx)
    dashAimEl.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) rotate(${((ang * 180) / Math.PI).toFixed(2)}deg)`
    dashAimEl.style.width = `${Math.max(0, len - 14).toFixed(1)}px`
    dashCostEl.style.transform = `translate(${(ex + 18).toFixed(1)}px, ${(ey - 30).toFixed(1)}px)`
    // La puissance suit la distance du doigt AU CORPS (en unités monde) :
    // l'étiquette annonce les deux termes du marché — la poussée et le prix.
    const dMonde = Math.hypot(
      aim.x - sim.stats.centroidX,
      aim.y - sim.stats.centroidY,
    )
    const puissance = Math.min(1, dMonde / Math.max(1, params.gasDashRange))
    // À sec DANS une zone qui impose la vapeur : le sélecteur est verrouillé
    // et la zone ne recharge pas — l'étiquette dit où trouver un dash.
    dashCostEl.textContent =
      sim.dashBudget > 0
        ? `DASH ${Math.round(puissance * 100)} % · ${sim.dashBudget} dash${sim.dashBudget > 1 ? 's' : ''}`
        : zoneActive === 'vapeur'
          ? `À SEC — la zone impose la vapeur, elle ne recharge pas : un surchauffeur`
          : `À SEC — retransformez-vous, ou frôlez un surchauffeur`
  }
  dashAimEl.classList.toggle('visible', dash.aiming)
  dashCostEl.classList.toggle('visible', dash.aiming)
  let frozenCount = 0
  let gasCount = 0
  for (let i = 0; i < sim.count; i++) {
    if (sim.kind[i] !== KIND_PLAYER) continue
    if (sim.frozen[i] === 1) frozenCount++
    else if (sim.gaseous[i] === 1) gasCount++
  }
  const allFrozen = sim.playerCount > 0 && frozenCount >= sim.playerCount
  const allGas = sim.playerCount > 0 && gasCount >= sim.playerCount
  // Chaudière (règle du 12/08) : l'échauffement n'est qu'un effet visuel —
  // la TRANSFORMATION se déclenche quand 95 % du corps actif baigne dans
  // l'aura. Réarmement quand le corps en ressort (présence sous 50 %) :
  // revenir à l'eau dans l'aura ne déclenche pas de lutte.
  if (sim.chauffeFrac < 0.5) autoGazArme = true
  if (
    autoGazArme &&
    sim.chauffeFrac >= 0.95 &&
    !input.gasIntent &&
    !tableauDone &&
    !sim.dispersed &&
    !input.paused
  ) {
    autoGazArme = false
    if (input.freezeIntent) input.toggleFreeze()
    gazSubi = true // la salle décide à notre place : pas de plein de dashs
    input.toggleGas() // le même chemin que la touche G : sons et UI suivent
  }

  // ---- Sons : boucles continues et fronts d'état ----
  const audible = !input.paused && !tableauDone && !sim.dispersed
  // Le souffle continu d'éjection est retiré (la voix elle-même n'existe
  // plus) : l'eau se signale par la goutte qui « ploc » à chaque impulsion.
  audio.setGasLevel(
    audible && gasCount > 0
      ? input.aimActive && input.gasIntent
        ? 1
        : 0.35
      : 0,
  )

  // ---- Bande-son : décor sonore et ponctuations ----
  const enJeu = document.body.classList.contains('playing')
  bande.setScene(enJeu ? 'cuve' : 'accueil')
  bande.setChill(chillNow())
  bande.setZone(zoneActive)
  // Le geste d'impulsion : une bouffée à l'amorce, pas un souffle continu —
  // la boucle procédurale tient déjà la durée.
  // L'éjection d'eau est une goutte qui tombe dans l'eau — et elle GOUTTE :
  // une première au contact, puis une toutes les ~0,17 s tant qu'on maintient,
  // à cadence légèrement irrégulière (l'eau n'est pas un métronome). Trois
  // prises de hauteurs différentes tirées au sort, plus un écart de ±7 % :
  // deux fois le même « bloop » à la même note et l'oreille entend une
  // machine. En vapeur, la visée est silencieuse — le souffle part au dash.
  // pas de « ploc » en glace : un palet n'éjecte rien, il n'a pas à goutter —
  // ni en rassemblement : rien ne sort, rien ne goutte
  const vise =
    audible &&
    input.aimActive &&
    !input.gasIntent &&
    !input.freezeIntent &&
    !rassembler
  if (vise) {
    sfx.dropTimer -= dtReal
    if (!sfx.aiming || sfx.dropTimer <= 0) {
      const prise = 1 + Math.floor(Math.random() * 3)
      bande.bruitage(
        `ejection-${prise}` as Bruitage,
        0.65,
        0.93 + Math.random() * 0.14,
      )
      sfx.dropTimer = 0.12 + Math.random() * 0.1
    }
  }
  sfx.aiming = vise
  // L'éponge boit en silence : son bruit de succion agaçait plus qu'il
  // n'informait — la jauge et le feutre qui se remplit suffisent à le dire.
  if (endgame.lastCall && !sfx.lastCall)
    bande.ponctuation('sting-derniere-impulsion', 0.8)
  sfx.lastCall = endgame.lastCall
  if (endgame.spent && !sfx.spent) bande.ponctuation('fin-de-course', 0.85)
  sfx.spent = endgame.spent
  const drainOn = params.exitRadius > 0 && params.exitPull > 0
  const mouthDist = Math.hypot(
    sim.stats.centroidX - exitMouth.x,
    sim.stats.centroidY - exitMouth.y,
  )
  audio.setDrainLevel(
    audible && drainOn
      ? Math.max(0, 1 - mouthDist / Math.max(1, params.exitRadius))
      : 0,
  )
  if (sim.swallowed > sfx.swallowed)
    audio.pulseSwallow(sim.swallowed - sfx.swallowed)
  sfx.swallowed = sim.swallowed
  if (allFrozen && !sfx.allFrozen) {
    audio.freezeOn()
    bande.bruitage('gel', 0.7)
  } else if (!allFrozen && sfx.allFrozen) {
    audio.freezeOff()
    bande.bruitage('goutte-rosee', 0.6) // le dégel retombe en gouttes
  }
  sfx.allFrozen = allFrozen
  if (allGas && !sfx.allGas) {
    audio.vaporizeOn()
    bande.bruitage('vaporisation', 0.7)
  } else if (!allGas && sfx.allGas) {
    audio.vaporizeOff()
    bande.bruitage('condensation', 0.7)
  }
  sfx.allGas = allGas
  if (sim.dispersed && !sfx.dispersed) {
    audio.disperse()
    if (!testLevel && !auHub) {
      // fin de l'échantillon ET de l'expédition : les registres consignent
      // tout — mais pas au hub, où la dispersion recompose simplement
      // l'échantillon : elle ne clôt aucun essai, ne grave rien
      records.noteDispersion(level.code, run.tableauTime)
      // même l'échec grave sa mémoire : le Sujet apprend de ses dispersions
      gagneMemoireRun(2)
      records.noteExpedition(levelIndex, run.livreTotal, run.runTime)
      if (levelIndex > 0 || run.livreTotal >= 0.01) {
        pushExpeditionRecord(
          levelIndex,
          run.livreTotal,
          run.runTime,
          records.operator(),
        ).then((b) => {
          if (b) {
            sharedBoard = b
            renderRegistres()
          }
        })
      }
      renderRegistres()
    }
  }
  sfx.dispersed = sim.dispersed
  if (sim.iceImpact > 60) {
    audio.iceImpact(sim.iceImpact)
    // le choc porte : plus il est franc, plus l'échantillon sonne fort et sec
    const force = Math.min(1, sim.iceImpact / 700)
    bande.bruitage('impact-glace', 0.25 + 0.55 * force, 0.9 + 0.25 * force)
  }
  sim.iceImpact = 0

  const stateText = sim.dispersed
    ? 'DISPERSÉ'
    : locked
      ? `${zoneActive.toUpperCase()} — IMPOSÉE`
      : allFrozen
        ? 'GLACE'
        : allGas
          ? 'VAPEUR'
          : 'liquide'
  const gel = !allFrozen && frozenCount > 0 ? ' · gel partiel' : ''
  const vape = !allGas && gasCount > 0 ? ' · vapeur partielle' : ''
  const suffix = `${gel}${vape}${vortex.timer > 0 ? ' · vortex' : ''}${input.paused ? ' · pause' : ''}`
  hudState.textContent = stateText + suffix
  hudState.classList.toggle('warn', sim.dispersed)
  document.body.classList.toggle('dispersed', sim.dispersed)
  hudWarp.textContent = `×${params.timeWarp}`
  hudWarp.classList.toggle('warn', params.timeWarp !== 1)
  majVitesse()

  // Relevé vivant de la fiche d'essai
  if (!document.body.classList.contains('playing')) {
    homeVolume.textContent = `${sim.liters().toFixed(2)} L`
    homeParticles.textContent = `${sim.playerCount}`
    homeState.textContent = sim.dispersed ? 'dispersé' : 'en dérive'
  }

  // ---- LA RUN SE CONCLUT D'ELLE-MÊME ------------------------------------
  // Deux façons de perdre le corps : il se DÉFAIT (dispersed), ou sa RÉSERVE
  // est à SEC (endgame.spent — la dernière impulsion a été donnée, il se
  // fige et dérive). Le second cas était sans issue : rien ne concluait, le
  // palet dérivait indéfiniment. Il conclut maintenant, après un sursis
  // pendant lequel le sas peut encore le boire.
  {
    const horsRun = !!testLevel || auHub || run.ended || tableauDone
    const perdu = !horsRun && (sim.dispersed || endgame.spent)
    // Le sas qui AVALE suspend le sursis (la salle peut encore se conclure)
    // — mais la simple PROXIMITÉ du sas ne suffit pas : un palet gelé qui
    // stationne dans le rayon d'aspiration sans jamais être bu gelait la run
    // pour de bon (enCollecte restait vrai à jamais). Seule une gorgée
    // récente compte, et si elle s'arrête, le compte repart ENTIER.
    const sasAvale = run.tableauTime <= endgame.sasBoitJusqua
    const enSursis = perdu && !sasAvale
    if (enSursis && !perduAvant) {
      dispersionDelai = sim.dispersed ? DELAI_DISPERSION : SURSIS_EPUISE
    }
    perduAvant = enSursis
    if (!enSursis) dispersionDelai = 0
    else if (!input.paused) {
      dispersionDelai -= dtReal
      if (dispersionDelai <= 0) afficheDispersion()
    }
  }

  // Plus d'écran de fin : ni dispersion, ni fin de course. Ce qui reste de
  // l'échantillon dérive à l'écran, et le bouton de relance attend en bas
  // sans rien recouvrir. Seuls la victoire et le bilan d'expédition ouvrent
  // encore un tampon. (Recalculé, pas tableauDone : si la victoire tombe dans
  // cette image, le tampon SAS ATTEINT ne doit pas être effacé aussitôt.)
  if (run.exitTimer <= 0 && !run.ended && ecranDispersion === 'aucun') {
    overlay.classList.remove('visible')
  }

  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
