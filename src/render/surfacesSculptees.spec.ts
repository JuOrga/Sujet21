import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { LUMIERE_PAR_DEFAUT } from './volume'
import {
  CARREAU_MONDE,
  EXAGERATION_RELIEF,
  PROFONDEUR_RELIEF,
  PAS_MIN_TEXELS,
  PROFONDEUR_RELIEF_ATLAS,
  REFLET_RELIEF,
  RELIEF_SURFACES_GLSL,
  TEXELS_CARREAU,
  lumiereRelief,
  normaleRelief,
  pasRelief,
  penteRelief,
} from './surfacesSculptees'
import { occurrencesDans } from './blocsSource'

// LES SURFACES SCULPTÉES PAR LES LAMPES (volet 3 du volume des parois) : le
// relief rangé dans l'alpha des surfaces (assets-ia §37) éclaire leur dessus.
// Le shader ne tourne pas sous vitest : la règle a un jumeau TypeScript, et
// la SOURCE du shader est lue en texte, comme conduiteRendu.spec.ts.
const lire = (chemin: string): string => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8')
const source = lire('./renderer.ts')
const doc = lire('../../docs/assets-ia.md')

// le shader de composition, du début de COMPOSE_FS à la fin de son gabarit
// (`\n}\``, l'accolade de main puis le guillemet) — vide si l'une ou l'autre
// manque : les gardes « dans la composition » échouent alors, au lieu de lire
// le reste du fichier (l'ancienne fin, `\n\``, n'existait pas dans le shader et
// tombait 5 000 lignes plus loin : cuiseur, coque et hôte compris)
const debutCompose = source.indexOf('const COMPOSE_FS = `')
const finCompose = debutCompose < 0 ? -1 : source.indexOf('\n}`', debutCompose)
const compose = finCompose < 0 ? '' : source.slice(debutCompose, finCompose + 2)
// le remplissage des dessus dans la boucle des boîtes (mur, habillages, hydro)
const debutRemplissage = compose.indexOf('if (mat < 2.5) {\n      float fill')
const remplissage = compose.slice(debutRemplissage, compose.indexOf('col = mix(col, edgeCol * eclMat', debutRemplissage))

const nombre = (s: string): number => Number(s.replace(',', '.'))

describe('le contrat du relief : les profondeurs de la §37', () => {
  it('chaque surface a la profondeur que la §37 publie', () => {
    const fichiers: Record<keyof typeof PROFONDEUR_RELIEF, string> = {
      wall: 'wall',
      wallA: 'wall-a',
      phile: 'phile',
      phobe: 'phobe',
    }
    for (const [cle, fichier] of Object.entries(fichiers)) {
      const m = new RegExp('\\| `' + fichier + '` \\| ([0-9]+,[0-9]+) \\|').exec(doc)
      expect(m, fichier).not.toBeNull()
      expect(PROFONDEUR_RELIEF[cle as keyof typeof PROFONDEUR_RELIEF], fichier).toBe(nombre(m![1]))
    }
  })

  it("les huit cases de l'atlas, dans l'ordre des habillages (skin 1 à 8)", () => {
    const cases = ['caissons', 'conduites', 'poutrelle', 'blindage', 'aération', 'hublots', 'écrans', 'câbles']
    const phrase = doc.slice(doc.indexOf("Les cases de l'atlas"), doc.indexOf('Raccords mesurés'))
    expect(PROFONDEUR_RELIEF_ATLAS).toHaveLength(8)
    cases.forEach((nom, i) => {
      const m = new RegExp(nom + '\\s+([0-9]+,[0-9]+)').exec(phrase)
      expect(m, nom).not.toBeNull()
      expect(PROFONDEUR_RELIEF_ATLAS[i], nom).toBe(nombre(m![1]))
    })
  })

  it('le carreau est rendu à 1024 pixels pour une largeur', () => {
    expect(TEXELS_CARREAU).toBe(1024)
    expect(doc).toContain('le carreau est rendu à 1024 px pour une largeur')
  })
})

describe('la règle : une normale tirée de l’alpha, éclairée par la lumière', () => {
  const dir = LUMIERE_PAR_DEFAUT

  it('une image OPAQUE (alpha 1 partout) donne la normale (0, 0, 1) : un dessus plat, inchangé', () => {
    const s = penteRelief(1, 1, 1, PROFONDEUR_RELIEF.wall, CARREAU_MONDE.wall, 1)
    expect(s[0]).toBe(0)
    expect(s[1]).toBe(0)
    const n = normaleRelief(s)
    expect(n[0]).toBeCloseTo(0, 12)
    expect(n[1]).toBeCloseTo(0, 12)
    expect(n[2]).toBe(1)
    // rien ne change d'un dessus d'avant : la lumière n'y ajoute ni n'ôte
    expect(lumiereRelief(s, dir)).toBeCloseTo(1, 12)
    expect(lumiereRelief(s, [1, 0])).toBeCloseTo(1, 12)
  })

  it('un alpha constant, quel qu’il soit, est un dessus plat (pas de pente sans écart)', () => {
    for (const a of [0, 0.3, 0.77]) {
      expect(lumiereRelief(penteRelief(a, a, a, 0.1005, 420, 2), dir)).toBeCloseTo(1, 12)
    }
  })

  it('la pente vraie entre deux texels voisins : Δalpha × profondeur × 1024, exagérée', () => {
    const carreau = CARREAU_MONDE.wallA
    const texel = carreau / TEXELS_CARREAU
    const s = penteRelief(0.5, 0.52, 0.47, PROFONDEUR_RELIEF.wallA, carreau, texel)
    expect(s[0]).toBeCloseTo(0.02 * PROFONDEUR_RELIEF.wallA * 1024 * EXAGERATION_RELIEF, 9)
    expect(s[1]).toBeCloseTo(-0.03 * PROFONDEUR_RELIEF.wallA * 1024 * EXAGERATION_RELIEF, 9)
    // le pas ne change pas la pente d'une même rampe : deux fois plus loin,
    // deux fois plus d'écart
    const s2 = penteRelief(0.5, 0.54, 0.44, PROFONDEUR_RELIEF.wallA, carreau, 2 * texel)
    expect(s2[0]).toBeCloseTo(s[0], 9)
    expect(s2[1]).toBeCloseTo(s[1], 9)
  })

  it('le pas : un pixel, jamais moins de deux texels (la quantification de l’alpha grésillerait)', () => {
    expect(PAS_MIN_TEXELS).toBe(2)
    expect(pasRelief(230, 2)).toBe(2)
    expect(pasRelief(230, 0.01)).toBeCloseTo((2 * 230) / TEXELS_CARREAU, 12)
  })

  it('le reflet : la pente qui regarde la lampe brille, un dessus plat n’en reçoit rien de plus', () => {
    // la pente qui renvoie la lampe vers l'œil (normale sur le demi-vecteur)
    const lz = 0.6
    const h = [0, Math.sqrt(1 - lz * lz), lz + 1]
    const t = h[1] / h[2] // la pente dont la normale est h
    const brille = lumiereRelief([0, -t], [0, 1])
    expect(brille).toBeGreaterThan(1 + 0.9 * REFLET_RELIEF)
    expect(lumiereRelief([0, 0], [0, 1])).toBeCloseTo(1, 12)
  })

  it('la pente qui regarde la lumière s’éclaire, l’autre s’assombrit — et cela tourne avec elle', () => {
    // un rivet : l'élévation MONTE vers +x, la face est tournée vers −x
    const s = penteRelief(0.4, 0.45, 0.4, 0.0084, 230, 0.5)
    const versMoinsX = lumiereRelief(s, [-1, 0])
    const versPlusX = lumiereRelief(s, [1, 0])
    expect(versMoinsX).toBeGreaterThan(1.05)
    expect(versPlusX).toBeLessThan(0.95)
    // une lumière de côté (perpendiculaire à la pente) ne la voit pas plus
    // qu'un dessus plat : au plus le cosinus de la pente
    expect(lumiereRelief(s, [0, 1])).toBeLessThanOrEqual(1)
    expect(lumiereRelief(s, [0, 1])).toBeGreaterThan(0.9)
    // la face cachée ne tombe jamais au noir : la part ambiante reste
    expect(lumiereRelief(penteRelief(0, 1, 0, 0.1005, 420, 0.4), [1, 0])).toBeGreaterThan(0.2)
  })
})

describe('le shader lit le relief dans l’alpha (composition)', () => {
  it('la tranche lue est la composition, et elle seule', () => {
    expect(debutCompose).toBeGreaterThan(0)
    expect(finCompose).toBeGreaterThan(debutCompose)
    expect(compose).toContain('void main() {')
    // ni le cuiseur, ni la coque, ni l'hôte
    for (const autre of ['const LIGHT_FS = `', 'const HULL_FS', 'export class Renderer']) expect(compose).not.toContain(autre)
  })

  it('la règle GLSL, générée du même module, est dans la composition', () => {
    expect(debutCompose).toBeGreaterThan(0)
    expect(compose).toContain('${RELIEF_SURFACES_GLSL}')
    expect(RELIEF_SURFACES_GLSL).toContain('vec2 penteRelief(')
    expect(RELIEF_SURFACES_GLSL).toContain('float lumiereRelief(')
    expect(RELIEF_SURFACES_GLSL).toContain('float pasRelief(')
  })

  it('les cinq textures en relief lisent leur alpha (.a), pas seulement leur couleur', () => {
    for (const s of ['uTexWall', 'uTexWallA', 'uTexPhile', 'uTexPhobe', 'uTexParoi']) {
      // le pas voisin, lu au même niveau de détail que le point
      expect(compose, s).toMatch(new RegExp('textureGrad\\(' + s + ',[^;]*\\)\\.a'))
    }
  })

  it('chaque dessus texturé passe par lumiereRelief : le mur, l’atlas, l’hydrophile, l’hydrophobe', () => {
    expect(debutRemplissage).toBeGreaterThan(0)
    const appels = remplissage.match(/lumiereRelief\(/g) ?? []
    expect(appels.length).toBeGreaterThanOrEqual(4)
    expect(remplissage).toMatch(/texWallC \* 0\.95[^;]*lumiereRelief\(/)
    expect(remplissage).toMatch(/textureGrad\(uTexParoi[\s\S]*?lumiereRelief\(/)
    expect(remplissage).toMatch(/texPhileC[^;]*lumiereRelief\(/)
    expect(remplissage).toMatch(/texPhobeC[^;]*lumiereRelief\(/)
  })

  it('la lumière vient de lampeDir : les lampes allumées, la direction par défaut éteintes', () => {
    // lampeDir vaut uLumiereDefaut tant que « Lumière » est éteint
    expect(compose).toContain('vec2 lampeDir = uLumiereDefaut;')
    expect(remplissage).toMatch(/lumiereRelief\([^;]*lampeDir/)
    // l'atlas pivote avec sa boîte : la lumière passe dans son repère local
    expect(remplissage).toMatch(/lumiereRelief\([^;]*lumLoc/)
  })

  it('« Lumière » coupé, le relief des surfaces reste, éclairé par le haut (choix du 15/11)', () => {
    // Le couper rendrait plates les surfaces re-rendues sous lumière neutre
    // sur le chemin de secours (conception : anti-objectif « plates et
    // grises », vigilance 2 « le volume tient »). Rien, dans le remplissage
    // des dessus, ne lit uLumiere — ni une garde, ni un ternaire autour d'un
    // appel — et aucun bloc qui contient un appel ne dépend de lui.
    expect(remplissage).not.toContain('uLumiere')
    const appels = occurrencesDans(compose, 'lumiereRelief(').filter(
      (a) => a.position > debutRemplissage && a.position < debutRemplissage + remplissage.length,
    )
    expect(appels.length).toBeGreaterThanOrEqual(4)
    for (const a of appels) expect(a.entetes.filter((e) => e.includes('uLumiere'))).toEqual([])
    // et la direction par défaut sculpte : une pente vers le haut de l'écran
    // prend la lumière, la pente opposée l'ombre
    const versLeHaut = penteRelief(0.4, 0.4, 0.45, 0.0084, 230, 0.5)
    const versLeBas = penteRelief(0.4, 0.4, 0.35, 0.0084, 230, 0.5)
    expect(lumiereRelief(versLeHaut, LUMIERE_PAR_DEFAUT)).not.toBeCloseTo(lumiereRelief(versLeBas, LUMIERE_PAR_DEFAUT), 2)
  })

  it('le relief ne se paie que sur le dessus (fill > 0), pas sur tout pixel proche', () => {
    const garde = remplissage.match(/if \(fill > 0\.0\)/g) ?? []
    expect(garde.length).toBeGreaterThanOrEqual(1)
  })
})

describe("le joint de tuile de l'atlas des habillages", () => {
  // au bord de sa case, le filtrage lisait la case VOISINE de l'atlas : son
  // alpha (une autre matière, un autre relief) faisait une pente parasite —
  // une arête sombre en travers des conduites à chaque joint (banc, R4)
  const uvParoi = compose.slice(compose.indexOf('vec2 uvParoi('), compose.indexOf('\n}', compose.indexOf('vec2 uvParoi(')))

  it('la coordonnée se tient loin du bord de la case, d’une empreinte de pixel au moins un demi-texel', () => {
    expect(uvParoi).toContain('vec2 uvParoi(vec2 w, vec2 tuile, vec2 origine, vec2 pas, vec2 marge)')
    expect(uvParoi).toContain('clamp(fract((w - origine) / pas), marge, 1.0 - marge)')
    expect(compose).toContain('vec2 margeP = max(vec2(0.5 / 1024.0), pxMonde / pas);')
  })

  it('chaque lecture de l’atlas passe par cette marge : le point, ses deux voisins, la tranche', () => {
    // les arguments de chaque appel, comptés au premier niveau de parenthèses
    const nArgs = (depuis: number): number => {
      let prof = 0
      let n = 1
      for (let i = depuis; i < compose.length; i++) {
        const c = compose[i]
        if (c === '(') prof++
        else if (c === ')' && --prof === 0) return n
        else if (c === ',' && prof === 1) n++
      }
      return -1
    }
    const appels = [...compose.matchAll(/uvParoi\(/g)]
      .map((m) => m.index! + 'uvParoi'.length)
      .filter((i) => !compose.startsWith('(vec2 w,', i))
    // les trois lectures du dessus, celle de la tranche
    expect(appels.length).toBeGreaterThanOrEqual(4)
    for (const i of appels) expect(nArgs(i), compose.slice(i, i + 60)).toBe(5)
  })
})
