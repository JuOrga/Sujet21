import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { OMBRE_COURTE_PAR_HAUTEUR } from './volume'

// LES HAUTEURS PAR BOÎTE (volume des parois, volet 4). Chaque solide a la
// hauteur que volume.ts lui donne (hauteursPartagees) : l'ombre courte, la
// carte cuite et la lumière du dessus la lisent, boîte par boîte, au lieu
// de la constante HAUTEUR_BLOCS. Le shader ne tourne pas sous vitest : on
// lit la SOURCE, comme epaisseur.spec.ts et lumiere.spec.ts.
const source = readFileSync(fileURLToPath(new URL('./renderer.ts', import.meta.url)), 'utf8')

const entre = (debut: string, fin: string, depuis = 0): string => {
  const a = source.indexOf(debut, depuis)
  expect(a).toBeGreaterThanOrEqual(0)
  const b = source.indexOf(fin, a + debut.length)
  expect(b).toBeGreaterThan(a)
  return source.slice(a, b)
}

const composeFs = entre('const COMPOSE_FS = `', '\n}`')
const lightFs = entre('const LIGHT_FS = `', '\n}`')
const sceneSdf = entre('float sceneSdf(vec2 p, float alt) {', '\n}', source.indexOf('const LIGHT_FS = `'))
const epaisseur = entre("// ——— L'ÉPAISSEUR", '// ——— LE FLANC')

describe('la table des hauteurs arrive au shader', () => {
  it('un quart de vec4 par boîte, dans les deux shaders : le budget d’uniformes tient', () => {
    // un vec4 par boîte coûterait 160 cases de plus à chaque shader, déjà
    // au-delà des 224 que WebGL2 garantit ; quatre hauteurs par vec4 n'en
    // coûtent que 40 (budgets.spec.ts tient MAX_BOXES lui-même)
    for (const fs of [composeFs, lightFs]) {
      expect(fs).toContain('uniform vec4 uBoxH[MAX_BOXES / 4];')
      expect(fs).toContain('float hauteurBoite(int bi)')
    }
  })

  it('elle vient de hauteursPartagees, une fois par décor, et suit l’ordre de peinture', () => {
    expect(source).toMatch(/hauteursPartagees\(/)
    // case k du shader = boîte rangs[k] de la liste
    expect(source).toMatch(/this\.hauteurScratch\[k\]\s*=\s*this\.hauteursBoites\[i\]/)
    expect(source).toContain("gl.uniform4fv(cu['uBoxH[0]'], this.hauteurScratch)")
    expect(source).toContain("gl.uniform4fv(lu['uBoxH[0]'], this.hauteurScratch)")
  })
})

describe('la carte cuite lit la hauteur de chaque boîte', () => {
  it("chaque boîte est enjambée à SA hauteur ; la coque garde HAUTEUR_COQUE", () => {
    expect(sceneSdf).toContain('hauteurBoite(i)')
    expect(sceneSdf).toMatch(/dec\.y > 4\.5 \? HAUTEUR_COQUE : hauteurBoite\(i\)/)
    // la constante seule ne décide plus
    expect(sceneSdf).not.toMatch(/HAUTEUR_COQUE\s*:\s*HAUTEUR_BLOCS/)
  })

  it('les tamis (évent, vitre) se bornent aussi à la hauteur de leur boîte', () => {
    for (const nom of ['float grilleTrans(', 'float vitreTrans(']) {
      const corps = entre(nom, '\n}', source.indexOf('const LIGHT_FS = `'))
      expect(corps).toContain('hauteurBoite(i)')
    }
  })

  it('la borne de marche est la plus haute hauteur posée, pas la constante', () => {
    expect(source).toMatch(/hautMax = Math\.max\(hautMax, this\.hauteurScratch\[k\]\)/)
  })

  it("un toit bas reçoit l'ombre d'un voisin plus haut : la carte en porte la visibilité dans son alpha", () => {
    // le cuiseur marche une seconde fois, depuis le TOIT, à la hauteur du toit
    expect(lightFs).toContain('float hT = hauteurToit(p);')
    expect(lightFs).toMatch(/sceneSdf\(p \+ dir \* tT, hT \+ tT \* monte\)/)
    expect(lightFs).toContain('outColor = vec4(clamp(total, 0.0, 1.0), toitVis);')
    // la composition la lit et l'applique à la lumière du dessus
    expect(composeFs).toMatch(/toitVis = lm4\.a;/)
    expect(composeFs).toMatch(/lumHaut \*= mix\(1\.0, toitVis, step\(dCouv, 0\.0\)\);/)
  })
})

describe('la lumière du dessus et l’ombre courte suivent la hauteur', () => {
  it('le dessus prend la lumière à SA hauteur', () => {
    expect(composeFs).toContain('float hToit = iCouv >= 0 ? hauteurBoite(iCouv) : HAUTEUR_BLOCS;')
    expect(composeFs).toContain('float hRel = max(uLampes[li].z - hToit, 0.0);')
    expect(composeFs).not.toContain('uLampes[li].z - HAUTEUR_BLOCS')
  })

  it("l'ombre courte est longue de la hauteur de la boîte au-dessus de ce qui la reçoit", () => {
    const m = /#define OMBRE_COURTE_PAR_HAUTEUR ([0-9.]+)/.exec(source)
    expect(m).not.toBeNull()
    expect(Number(m![1])).toBeCloseTo(OMBRE_COURTE_PAR_HAUTEUR, 6)
    expect(epaisseur).toContain('float lO = OMBRE_COURTE_PAR_HAUTEUR * max(hauteurBoite(bi) - hRecoit, 0.0);')
    expect(epaisseur).toMatch(/vec2 versLum = lampeDir \* lO;/)
    // sur le toit d'un voisin plus bas, elle est retenue et peinte APRÈS la
    // boucle des boîtes : le toit se peint peut-être après la source
    expect(epaisseur).toContain('ombreToit = max(ombreToit')
    const apres = source.indexOf("// L'OMBRE COURTE SUR LES TOITS")
    expect(apres).toBeGreaterThan(source.indexOf("// ——— L'ÉPAISSEUR"))
    expect(source.slice(apres, apres + 1200)).toMatch(/col = mix\(col, col \* vec3\(0\.50, 0\.56, 0\.70\), ombreToit \* 0\.65\);/)
  })

  it("l'aura des hydro part au-delà du contact et laisse lire l'ombre courte", () => {
    const aura = entre('float aura = (1.0 - smoothstep(0.0, uHydroBand', 'col += auraCol')
    expect(aura).toContain('aura *= (1.0 - contact) * (1.0 - 0.4 * ombreCourte);')
  })
})
