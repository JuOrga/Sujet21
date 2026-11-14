import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { HAUTEUR_BLOCS } from './hauteurs'
import { FLOU_OMBRE_COURTE, LUMIERE_PAR_DEFAUT, longueurOmbreCourte } from './volume'

// L'ÉPAISSEUR (volet 2 du volume des parois) — chanfrein, liseré, ombre de
// contact, ombre courte. Le shader ne tourne pas sous vitest : on lit la
// SOURCE, comme conduiteRendu.spec.ts.
const source = readFileSync(fileURLToPath(new URL('./renderer.ts', import.meta.url)), 'utf8')

const define = (nom: string): number => {
  const m = new RegExp(`#define ${nom} ([0-9.]+)`).exec(source)
  return m ? Number(m[1]) : NaN
}

// le bloc de l'épaisseur dans la boucle des boîtes de la composition
const debut = source.indexOf("// ——— L'ÉPAISSEUR")
const bloc = source.slice(debut, source.indexOf('// ——— LE FLANC', debut))

// le shader de la coque, du début de HULL_FS au début du suivant
const hullFs = source.slice(source.indexOf('const HULL_FS ='), source.indexOf('`', source.indexOf('const HULL_FS =') + 20))
const drawHull = source.slice(source.indexOf('private drawHull('), source.indexOf('private drawHull(') + 6000)

describe("l'épaisseur des solides dans la composition", () => {
  it('le halo symétrique a disparu : il détachait sans dire la hauteur', () => {
    expect(source).not.toContain('smoothstep(0.0, 56.0, max(d, 0.0))')
  })

  it("l'ombre courte et le chanfrein épargnent la conduite et la chaudière (aPieces)", () => {
    expect(debut).toBeGreaterThan(0)
    // le bloc s'ouvre sur sa garde : rien ne s'y peint pour une boîte à pièces
    expect(bloc).toMatch(/^[^{]*if \(solide && !aPieces\) \{/)
    expect(bloc).toContain('ombreCourte')
    expect(bloc).toContain('contact')
    // le chanfrein du dessus, plus loin, garde la même exemption
    const ch = source.indexOf('// LE CHANFREIN')
    expect(ch).toBeGreaterThan(0)
    const garde = source.slice(ch, source.indexOf('{', ch) + 1)
    expect(garde).toContain('solide && !aPieces')
    // le biseau mou de 30 u qu'il remplace n'existe plus
    expect(source).not.toContain('smoothstep(0.0, 30.0, abs(d))')
  })

  it("l'ombre courte s'allonge à l'opposé de la lumière, et tient dans le rayon de rejet", () => {
    expect(define('OMBRE_COURTE')).toBeCloseTo(longueurOmbreCourte(HAUTEUR_BLOCS), 3)
    expect(define('OMBRE_COURTE_FLOU')).toBeCloseTo(FLOU_OMBRE_COURTE, 3)
    // le rejet grossier d'un solide saute tout pixel au-delà de son rayon :
    // il couvre l'ombre courte et son flou, sinon elle serait coupée net
    expect(source).toContain('float reachMax = max(56.0, OMBRE_COURTE + OMBRE_COURTE_FLOU);')
    // seulement hors de la boîte, et là où elle a une longueur (sous un
    // voisin aussi haut, rien) : ailleurs, ses SDF ne se paient pas
    expect(bloc).toMatch(/if \(d > 0\.0 && lO > 0\.0\) \{[^}]*sdfBoiteLocal/)
    // une paroi plus mince que la moitié de l'ombre passerait entre deux
    // échantillons : un troisième, au quart
    expect(bloc).toContain('lLoc * 0.25')
    // on remonte VERS la lumière depuis le sol : c'est là qu'est le bloc —
    // sur la longueur de SA hauteur (hauteursBoites.spec.ts)
    expect(bloc).toMatch(/lampeDir \* lO/)
  })

  it('lumière éteinte, la direction est la direction par défaut, en uniforme', () => {
    expect(source).toContain('uniform vec2 uLumiereDefaut;')
    expect(source).toMatch(/vec2 lampeDir = uLumiereDefaut;/)
    expect(source).toContain("gl.uniform2f(cu['uLumiereDefaut'], LUMIERE_PAR_DEFAUT[0], LUMIERE_PAR_DEFAUT[1])")
    // la lumière éteinte ne coupe plus le chanfrein : il ne dépend que de solide
    const ch = source.indexOf('// LE CHANFREIN')
    expect(source.slice(ch, source.indexOf('{', ch))).not.toContain('uLumiere > 0.5')
    // la bande suit sa largeur (au zoom de carte, 5 px valent bien plus de
    // 12 u) : le gradient ne se paie que là où elle se peint
    const chanfrein = source.slice(ch, source.indexOf('gradSdfBoite(', ch))
    expect(chanfrein).toContain('dT < d0 + wC + 2.0 * aaC')
    expect(chanfrein).not.toContain('dT < 12.0')
  })

  it("l'ombre courte ne double pas la carte cuite", () => {
    // là où la carte a déjà assombri le sol, l'ombre courte s'efface d'autant
    // …mais jamais sous les trois quarts : dans l'ombre cuite, le sol ne doit
    // pas s'éclaircir par rapport à l'ancien halo
    expect(bloc).toContain('mix(0.75, 1.0, solEclaire)')
  })
})

describe('la paroi de la cuve (drawHull)', () => {
  it('le shader de la coque peint le chanfrein de son bord intérieur', () => {
    expect(hullFs).toContain('uniform vec2 uLumiereCoque;')
    expect(hullFs).toContain('chanfrein')
    // lumière allumée, la moyenne des lampes vue du centre de la cuve
    expect(drawHull).toContain("gl.uniform2f(hu['uLumiereCoque'], this.lumiereCoque[0], this.lumiereCoque[1])")
    expect(source).toMatch(/this\.lumiereCoque = [^;]*directionLumiereMoyenne\(/)
  })

  it("l'ombre de contact court au pied de la paroi, côté cuve", () => {
    expect(source).toContain('contactCoque')
  })

  it('la lumière par défaut tombe du haut de l’écran', () => {
    // le repère de la composition a y vers le HAUT (gl_FragCoord), et
    // lampeDir pointe VERS la lampe
    expect(source).toContain('vec2 css = gl_FragCoord.xy / uDpr;')
    expect(source).toContain('vec2 world = uCenter + (css - uViewport * 0.5) / uZoom;')
    expect(source).toContain('vec2 dl = pointLampe(li, world) - world;')
    expect(LUMIERE_PAR_DEFAUT[1]).toBeGreaterThan(0)
  })
})
