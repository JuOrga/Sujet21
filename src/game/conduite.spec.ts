import { describe, expect, it } from 'vitest'
import { boutsEnMur, formePhysique } from './conduite'
import {
  CONDUITE,
  CONDUITE_ATLAS,
  BOUT_MUR_NEG,
  BOUT_MUR_POS,
  SENS_HORIZONTAL,
  SENS_VERTICAL,
  conduiteHoriz,
  FORME_CONDUITE,
  FORME_DISQUE,
  conduiteLongue,
  echelleArceau,
  modeConduite,
  formeContact,
  jointsConduite,
  piecesConduite,
  type FormeBox,
  type FormeContact,
} from './formes'
import { MAT_FROID, MAT_WALL, type ObstacleBox } from './level'
import { FluidSim } from '../sim/solver'
import { DEFAULT_PARAMS } from '../sim/params'

// La forme PHYSIQUE de la conduite d'ammoniac : ce que la physique et le
// laser lisent doit être ce que l'on voit — le tuyau givré, plus mince que
// le bloc, et ses brides de toute la largeur, aux bouts et aux joints.
const box = (minX: number, minY: number, maxX: number, maxY: number, material: number): ObstacleBox => ({
  minX,
  minY,
  maxX,
  maxY,
  material,
})

const out: FormeContact = { dist: 0, nx: 0, ny: 1 }
function contact(b: ObstacleBox, x: number, y: number): FormeContact {
  formeContact(x, y, formePhysique(b), out)
  return { ...out }
}

describe('conduite — forme physique', () => {
  it('une plaque froide rectangulaire prend la forme de conduite, sans toucher la salle', () => {
    const b = box(0, 0, 400, 60, MAT_FROID)
    expect(formePhysique(b).forme).toBe(FORME_CONDUITE)
    expect(b.forme).toBeUndefined()
  })

  it('le reste passe tel quel — la même boîte, sans copie', () => {
    const mur = box(0, 0, 400, 60, MAT_WALL)
    expect(formePhysique(mur)).toBe(mur)
    const disque = { ...box(0, 0, 100, 100, MAT_FROID), forme: FORME_DISQUE }
    expect(formePhysique(disque)).toBe(disque)
  })

  it('une longue conduite : brides aux bouts, joints au pas, à l’écart des bouts', () => {
    expect(conduiteLongue(670, 60)).toBe(true)
    expect(conduiteLongue(100, 100)).toBe(false)
    expect(jointsConduite(100, 100)).toEqual([]) // un petit bloc n'a pas de joint
    const j = jointsConduite(1200, 60)
    expect(j).toContain(0)
    expect(Math.max(...j) + CONDUITE.jointDemi * 60).toBeLessThanOrEqual(600 - CONDUITE.bout * 60)
    // trois pièces au moins : le tuyau et ses deux brides de bout
    expect(piecesConduite(670, 60).length).toBeGreaterThanOrEqual(3)
  })

  const b = box(0, 0, 670, 60, MAT_FROID) // la porte froide de la chambre froide

  it('entre les brides, le tuyau est plus mince que le bloc : le bord du bloc est DEHORS', () => {
    // à mi-longueur (hors joint), 3 u sous le bord haut du bloc
    const s = 170
    expect(jointsConduite(670, 60).some((x) => Math.abs(x + 335 - s) < CONDUITE.brideJoint * 60)).toBe(false)
    const c = contact(b, s, 57)
    expect(c.dist).toBeGreaterThan(0)
    expect(c.ny).toBeCloseTo(1, 9)
    // et le tuyau lui-même est plein
    expect(contact(b, s, 30).dist).toBeLessThan(0)
    // sa surface est à la demi-épaisseur du tuyau
    expect(contact(b, s, 30 + CONDUITE.tuyau * 60 + 4).dist).toBeCloseTo(4, 9)
  })

  it('la traversée de sol (plaque, puis bride) au bout libre', () => {
    // la bride avant le coude : plus large que le tuyau, moins que le bloc
    const sb = 670 - ((CONDUITE.brideBoutDe + CONDUITE.brideBoutA) / 2) * 60
    expect(contact(b, sb, 30 + CONDUITE.brideBoutDemi * 60 - 1).dist).toBeLessThan(0)
    expect(contact(b, sb, 30 + CONDUITE.brideBoutDemi * 60 + 3).dist).toBeCloseTo(3, 9)
  })

  it('la plaque de sol, elle, fait toute la largeur du bloc', () => {
    const s = 670 - ((CONDUITE.brideDe + CONDUITE.brideA) / 2) * 60
    expect(contact(b, s, 58).dist).toBeLessThan(0)
    expect(contact(b, s, 63).dist).toBeCloseTo(3, 9)
  })

  // LE SENS CHOISI à l'éditeur : il décide de ce qui tient dans le bloc —
  // 60 × 120 debout est un arceau (le long des 120) ; couché, le tuyau
  // n'aurait que 60 de long pour 120 d'épaisseur : une vanne de 60.
  it('le sens imposé change le dessin, collision comprise', () => {
    const b = box(0, 0, 60, 120, MAT_FROID)
    // debout (auto) : la plaque de la traversée du haut couvre l'axe
    expect(contact(b, 30, 100).dist).toBeLessThan(0)
    // couché : la vanne de 60, centrée (y 30..90) — ce point est du sol
    expect(contact({ ...b, sens: SENS_HORIZONTAL }, 30, 100).dist).toBeCloseTo(10, 9)
    expect(contact({ ...b, sens: SENS_VERTICAL }, 30, 100).dist).toBeLessThan(0)
    expect(conduiteHoriz(100, 120)).toBe(false)
    expect(conduiteHoriz(100, 120, SENS_HORIZONTAL)).toBe(true)
  })

  it('un bloc debout se lit dans son sens long', () => {
    const debout = box(0, 0, 60, 670, MAT_FROID)
    expect(contact(debout, 57, 170).dist).toBeGreaterThan(0)
    expect(contact(debout, 57, 170).nx).toBeCloseTo(1, 9)
  })

  // La panne vécue : le dessin ne peignait que la conduite, la physique
  // lisait la BOÎTE — l'eau butait sur du sol visible.
  it('le solveur lit la conduite à sa forme', () => {
    const s = new FluidSim({ ...DEFAULT_PARAMS }, { minX: -500, minY: -500, maxX: 900, maxY: 500 })
    s.setLevel([box(0, 0, 670, 60, MAT_FROID)], [])
    formeContact(170, 57, s.boxes[0], out)
    expect(out.dist).toBeGreaterThan(0)
  })
})

// LES PETITS BLOCS : en dessous de deux traversées bout à bout, les pièces
// de la conduite se chevauchaient (un joint écrasé entre deux moignons,
// deux traversées l'une dans l'autre — vu en aperçu sur iPad). Le dessin
// suit la place : vanne, arceau, conduite longue.
describe('conduite — selon la place', () => {
  it('les seuils : vanne sous 1,6, arceau jusqu’à deux traversées, longue au-delà', () => {
    expect(modeConduite(100, 100)).toBe('vanne')
    expect(modeConduite(95, 60)).toBe('vanne')
    expect(modeConduite(100, 60)).toBe('arceau')
    expect(modeConduite(2 * CONDUITE.bout * 60 - 1, 60)).toBe('arceau')
    expect(modeConduite(2 * CONDUITE.bout * 60, 60)).toBe('longue')
    expect(echelleArceau(2 * CONDUITE.bout * 60, 60)).toBe(1)
    expect(echelleArceau(100, 60)).toBeCloseTo(100 / (2 * CONDUITE.bout * 60), 9)
  })

  it('la vanne : sa plaque carrée, centrée, du côté de l’épaisseur', () => {
    const plot = box(0, 0, 100, 120, MAT_FROID) // debout : L 120, T 100
    expect(contact(plot, 50, 60).dist).toBeLessThan(0)
    expect(contact(plot, 50, 112).dist).toBeCloseTo(2, 9) // la plaque s'arrête à 110
    expect(contact(plot, 104, 60).dist).toBeCloseTo(4, 9)
  })

  it('l’arceau tient dans son bloc, sans chevauchement : les deux traversées se touchent au milieu', () => {
    for (const L of [100, 130, 160]) {
      const T = 60
      const k = echelleArceau(L, T)
      for (const [s0, s1, e] of piecesConduite(L, T)) {
        expect(s0).toBeGreaterThanOrEqual(-L / 2 - 1e-9)
        expect(s1).toBeLessThanOrEqual(L / 2 + 1e-9)
        expect(e).toBeLessThanOrEqual(T / 2 + 1e-9)
      }
      // chaque traversée mesure k × bout × T : à deux, toute la longueur
      expect(2 * CONDUITE.bout * k * T).toBeCloseTo(L, 9)
    }
  })

  it('un arceau contre un mur garde ses deux traversées : il tient dans le bloc', () => {
    const b = box(0, 0, 130, 60, MAT_FROID)
    const mur = box(130, -100, 200, 200, MAT_WALL)
    const p = formePhysique(b, [b, mur], null)
    expect(piecesConduite(130, 60, (p as FormeBox).bouts ?? 0)).toEqual(piecesConduite(130, 60))
  })
})

// LES BOUTS DANS LE MUR : une conduite posée contre une paroi s'arrêtait
// sur une bride, « posée là, sans arrivée ni départ ». Un bout contre un
// solide ou le bord de la salle y plonge : pas de bride, le tuyau file
// jusqu'au bord du bloc.
describe('conduite — les bouts dans le mur', () => {
  const salle = { minX: -1000, minY: -750, maxX: 1000, maxY: 750 }
  const porte = box(-500, -750, -440, -150, MAT_FROID) // du bord bas à mi-salle

  it('le bout contre le bord de la salle plonge, l’autre garde sa bride', () => {
    expect(boutsEnMur(porte, [porte], salle)).toBe(BOUT_MUR_NEG)
  })

  it('un bout contre un mur plonge ; contre le vide (sans physique), non', () => {
    const b = box(0, 0, 400, 60, MAT_FROID)
    const mur = box(400, -100, 460, 200, MAT_WALL)
    expect(boutsEnMur(b, [b, mur], null)).toBe(BOUT_MUR_POS)
    const vide = box(400, -100, 460, 200, 11) // MAT_VIDE : un trou, pas un mur
    expect(boutsEnMur(b, [b, vide], null)).toBe(0)
  })

  it('un mur qui ne prend que la moitié du tuyau ne l’avale pas', () => {
    const b = box(0, 0, 400, 60, MAT_FROID)
    const coin = box(400, 30, 460, 200, MAT_WALL) // ne couvre que le haut
    expect(boutsEnMur(b, [b, coin], null)).toBe(0)
  })

  it('au mur, pas de traversée : le tuyau touche le bord du bloc, le sol l’entoure', () => {
    const phys = formePhysique(porte, [porte], salle)
    expect((phys as FormeBox).bouts).toBe(BOUT_MUR_NEG)
    // au ras du bord bas, sur le flanc du BLOC : sans la salle, c'est la
    // plaque de sol de la traversée (toute la largeur) ; avec elle, le
    // tuyau plonge dans le bord, plus de plaque — du sol
    expect(contact(porte, -443, -740).dist).toBeLessThan(0)
    formeContact(-443, -740, phys, out)
    expect(out.dist).toBeGreaterThan(0)
    // et le tuyau, lui, touche le bord du bloc
    formeContact(-470, -749, phys, out)
    expect(out.dist).toBeLessThan(0)
    // l'autre bout, libre, garde sa bride de toute la largeur
    formeContact(-443, -150 - ((CONDUITE.brideDe + CONDUITE.brideA) / 2) * 60, phys, out)
    expect(out.dist).toBeLessThan(0)
  })

  it('le solveur trouve les bouts avec la salle', () => {
    const s = new FluidSim({ ...DEFAULT_PARAMS }, salle)
    s.setLevel([porte], [])
    expect((s.boxes[0] as FormeBox).bouts).toBe(BOUT_MUR_NEG)
  })
})

// LES JUMEAUX : le shader reçoit les constantes de CONDUITE telles quelles
// (renderer.ts les interpole) ; l'atlas, lui, est fabriqué par un script
// Python dont les cadres doivent être CEUX que lit le shader.
describe('conduite — les jumeaux', () => {
  it('le shader interpole CONDUITE et CONDUITE_ATLAS, sans copie à la main', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(new URL('../render/renderer.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/const float CN_TUYAU = \$\{f\(C\.tuyau\)\};/)
    expect(src).toMatch(/const vec4 CN_CADRE_BOUT = \$\{v4\(A\.bout\)\};/)
    // injecté dans la composition ET dans le cuiseur de lumière
    expect((src.match(/\$\{CONDUITE_GLSL\}/g) ?? []).length).toBe(2)
  })

  it('les cadres de l’atlas sont ceux du script qui le fabrique', async () => {
    const { readFileSync } = await import('node:fs')
    const py = readFileSync(new URL('../../tools/images/conduite_atlas.py', import.meta.url), 'utf8')
    const cadre = (nom: string) =>
      py.match(new RegExp(`CADRE_${nom} = \\((\\d+), (\\d+), (\\d+), (\\d+)\\)`))!.slice(1).map(Number)
    expect(cadre('CORPS')).toEqual(CONDUITE_ATLAS.corps)
    expect(cadre('BOUT')).toEqual(CONDUITE_ATLAS.bout)
    expect(cadre('JOINT')).toEqual(CONDUITE_ATLAS.joint)
    expect(cadre('GIVRE')).toEqual(CONDUITE_ATLAS.givre)
    expect(cadre('VANNE')).toEqual(CONDUITE_ATLAS.vanne)
    expect(Number(py.match(/^TAILLE = (\d+)/m)![1])).toBe(CONDUITE_ATLAS.taille)
  })
})
