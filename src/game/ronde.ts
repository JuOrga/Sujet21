// LA RONDE — un tableau de démonstration (le concepteur, 17/09, croquis) :
// « un niveau où le volume tourne non stop autour de ces trois centres de
// gravité, en glace ». Trois puits alignés, le corps gelé par la zone et
// lancé à une vitesse exacte : il enchaîne les trois puits en un huit à
// trois lobes (le sens s'inverse à chaque lobe) et se referme sur lui-même,
// sans fin. Rien à faire : en glace, rien ne se pilote — on regarde.
//
// L'ORBITE N'EST PAS DEVINÉE, ELLE EST TIRÉE (ronde.recherche.spec.ts) :
// une orbite périodique dans un champ à trois centres. Par symétrie (les
// puits sur x = 0, symétriques en y), un lancer qui part de (−a, 0) droit
// vers le haut et recoupe y = 0 à angle droit après avoir contourné le
// puits du haut est fermé — la moitié du bas est le miroir de la moitié du
// haut. Une famille entière existe, STABLE (1 u d'écart au départ reste
// quelques unités après vingt tours) tant que le croisement reste dans le
// cœur ; elle se déchire au-delà. Et le corps n'est pas un point : un bloc
// de glace reçoit la MOYENNE du champ sur son disque (solver.applyPuits),
// qui diffère de la valeur au centre dans le halo en 1/r² — la recherche
// tire avec ce champ moyenné, et le vrai solveur vérifie (sim/ronde.spec.ts).
import { estMiniJeu } from './minijeux'
import type { ImpulsionDef, LevelDef, PuitsDef } from './level'

export const CODE_RONDE = 'DEMO-RONDE'

export interface ReglesRonde {
  puits: PuitsDef[]
  depart: { x: number; y: number; impulsion: ImpulsionDef }
  /** la période mesurée (s), pour la doc et les gardes */
  periode: number
}

// LES NOMBRES : trouvés le 17/09 par ronde.recherche.spec.ts
// (RECHERCHE_RONDE=1 RECHERCHE_RONDE_F=600 RECHERCHE_RONDE_R=350
// RECHERCHE_RONDE_D=800 RECHERCHE_RONDE_CORPS=103 RECHERCHE_RONDE_AMIN=200
// RECHERCHE_RONDE_AMAX=340 RECHERCHE_RONDE_VMIN=380 RECHERCHE_RONDE_VMAX=540
// pnpm vitest run src/game/ronde.recherche.spec.ts). Cœur 350 pour un
// écart de 800 : le croisement entre deux puits (à 400 du centre de chacun)
// tombe juste hors des cœurs et le lobe du haut monte à 200 au-dessus de son
// puits — trois lobes ronds (cœur 300 : lobes plats ; 450 : ils s'étranglent).
// Force 600 : un tour en 13,45 s. La largeur a = 200 : la famille tient
// jusqu'à 210 avec le champ moyenné sur le corps, se déchire à 220 ; la
// vitesse 450,832 arrondie à 451 tient pareil (mesuré, sim/ronde.spec.ts).
// Mesuré sur le vrai bloc : il repasse par (−199,5, 0) à chaque tour, douze
// tours durant, entier, sans se tasser. À refaire si un puits bouge.
export const RONDE_FORCE = 600
export const RONDE_RAYON = 350
export const RONDE_ECART = 800
export const REGLES_RONDE: ReglesRonde = {
  puits: [
    { x: 0, y: RONDE_ECART, force: RONDE_FORCE, rayon: RONDE_RAYON },
    { x: 0, y: 0, force: RONDE_FORCE, rayon: RONDE_RAYON },
    { x: 0, y: -RONDE_ECART, force: RONDE_FORCE, rayon: RONDE_RAYON },
  ],
  depart: { x: -200, y: 0, impulsion: { angle: 90, vitesse: 451 } },
  periode: 13.45,
}

/** Ce tableau se joue SANS SAS : rien ne se dessine, rien n'aspire, rien ne
 *  conclut — les mini-jeux (qui mesurent) et la ronde (qui montre). */
export function sansSas(level: { code: string; minijeu?: LevelDef['minijeu'] }): boolean {
  return estMiniJeu(level) || level.code === CODE_RONDE
}

export function tableauRonde(regles: ReglesRonde = REGLES_RONDE): LevelDef {
  const b = { minX: -800, minY: -1250, maxX: 800, maxY: 1250 }
  return {
    name: 'La ronde',
    code: CODE_RONDE,
    journal:
      `Trois puits de gravité alignés, et le corps, pris en glace, lancé à la vitesse exacte : ` +
      `la gravité le porte d'un puits à l'autre en un huit à trois lobes qui se referme sur lui-même — une ronde sans fin. ` +
      `En glace, rien ne se pilote. Regardez.`,
    par: 1,
    bounds: b,
    spawn: { x: regles.depart.x, y: regles.depart.y, n: 900, impulsion: regles.depart.impulsion },
    exit: { minX: 1300, minY: -60, maxX: 1360, maxY: 60 },
    boxes: [],
    sponges: [],
    // toute la salle impose la glace : le bloc est rigide, la ronde tient
    zones: [{ ...b, force: 'glace', label: 'GLACE' }],
    puits: regles.puits,
    labels: [
      { x: 0, y: 1200, text: 'LA RONDE', tone: 'mur' },
      { x: -560, y: 150, text: '1 · EN GLACE, LANCÉ : LA GRAVITÉ FAIT LE RESTE', tone: 'mur' },
      { x: 560, y: -150, text: '2 · TROIS PUITS, UN HUIT À TROIS LOBES, SANS FIN', tone: 'mur' },
    ],
  }
}
