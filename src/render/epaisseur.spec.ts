import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { HAUTEUR_BLOCS } from './hauteurs'
import {
  FLOU_OMBRE_COURTE,
  FORMES_DISTANCE_APPROCHEE,
  LUMIERE_PAR_DEFAUT,
  OMBRE_PORTEE_GLSL,
  longueurOmbreCourte,
  ombreCourtePeutPorter,
} from './volume'
import {
  FORME_ARC,
  FORME_CAPSULE,
  FORME_COIN,
  FORME_COQUE,
  FORME_DISQUE,
  FORME_RECT,
  coquePack,
  formeContact,
  type FormeBox,
  type FormeContact,
} from '../game/formes'
import { blocApres, occurrencesDans } from './blocsSource'

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
    // seulement hors de la boîte, là où elle a une longueur (sous un voisin
    // aussi haut, rien), et à sa portée (ombreCourtePeutPorter) : ailleurs,
    // ses SDF ne se paient pas
    expect(bloc).toMatch(/if \(ombreCourtePeutPorter\(dR, lO, dec\.y\)\) \{[^}]*sdfBoiteLocal/)
    expect(source).toContain('${OMBRE_PORTEE_GLSL}')
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

  it("au-delà de sa portée, l'ombre courte vaut exactement 0 : ses trois distances ne se paient plus", () => {
    // LE COÛT VISÉ : le rejet grossier se fait sur le rectangle englobant,
    // une coque garde donc toute sa salle, et chaque pixel y payait trois
    // distances par coque, même à 300 u de toute paroi. Ses échantillons sont
    // au plus à lO du point : pour une distance 1-lipschitzienne, d ≥ lO + flou
    // les laisse tous à plus du flou de la forme — o = 0 exactement. Vérifié
    // ici sur les jumelles TypeScript des distances du shader (formes.ts).
    const c: FormeContact = { dist: 0, nx: 0, ny: 1 }
    const sdf = (b: FormeBox, x: number, y: number): number => (formeContact(x, y, b, c), c.dist)
    const coque = { minX: -260, minY: -180, maxX: 260, maxY: 180, forme: FORME_COQUE, ...coquePack({ cotes: 5, chanfrein: 0.4, ep: 24, porte: 96 }) }
    const exactes: FormeBox[] = [
      { minX: -60, minY: -20, maxX: 60, maxY: 20, forme: FORME_RECT },
      { minX: -60, minY: -20, maxX: 60, maxY: 20, forme: FORME_RECT, angle: 30 },
      { minX: -90, minY: -15, maxX: 90, maxY: 15, forme: FORME_CAPSULE },
      { minX: -50, minY: -70, maxX: 50, maxY: 70, forme: FORME_COIN, p0: 1 },
      coque,
    ]
    let vus = 0
    const ecarts: string[] = []
    for (const b of exactes) {
      for (const lO of [16, 36, 56]) {
        for (let x = b.minX - 140; x <= b.maxX + 140; x += 8) {
          for (let y = b.minY - 140; y <= b.maxY + 140; y += 8) {
            const d = sdf(b, x, y)
            if (d <= 0 || ombreCourtePeutPorter(d, lO, b.forme ?? FORME_RECT)) continue
            for (let k = 0; k < 12; k++) {
              const vx = Math.cos((k * Math.PI) / 6) * lO
              const vy = Math.sin((k * Math.PI) / 6) * lO
              const dO = Math.min(sdf(b, x + vx * 0.25, y + vy * 0.25), sdf(b, x + vx * 0.5, y + vy * 0.5), sdf(b, x + vx, y + vy))
              if (dO < FLOU_OMBRE_COURTE && ecarts.length < 5) ecarts.push(`forme ${b.forme} lO ${lO} en (${x}, ${y}) : ${dO}`)
              vus++
            }
          }
        }
      }
    }
    expect(ecarts).toEqual([])
    expect(vus).toBeGreaterThan(10000)
    // le creux d'une coque, loin des parois : plus rien à payer
    expect(ombreCourtePeutPorter(sdf(coque, 0, 0), 56, FORME_COQUE)).toBe(false)
    // le disque (ellipse) et l'arc ont une distance APPROCHÉE, pas
    // 1-lipschitzienne : au bout d'une ellipse de 1600 × 40, elle passe de
    // 28 à 7 u en 16 u de chemin, sur un arc étiré de 71 à −12 u en 56 u.
    // Ils paient partout, comme avant : l'image ne change nulle part.
    expect([...FORMES_DISTANCE_APPROCHEE].sort()).toEqual([FORME_DISQUE, FORME_ARC].sort())
    for (const f of FORMES_DISTANCE_APPROCHEE) expect(ombreCourtePeutPorter(500, 20, f)).toBe(true)
    // dedans, ou sans longueur : jamais
    expect(ombreCourtePeutPorter(-3, 56, FORME_RECT)).toBe(false)
    expect(ombreCourtePeutPorter(10, 0, FORME_DISQUE)).toBe(false)
    // le jumeau GLSL dit la même chose
    expect(OMBRE_PORTEE_GLSL).toContain('bool ombreCourtePeutPorter(float d, float lO, float forme)')
    expect(OMBRE_PORTEE_GLSL).toContain(`abs(forme - ${FORME_DISQUE}.0) < 0.5`)
    expect(OMBRE_PORTEE_GLSL).toContain(`abs(forme - ${FORME_ARC}.0) < 0.5`)
    expect(OMBRE_PORTEE_GLSL).toContain('d < lO + 12.0')
  })

  it("relief allumé, l'ombre sur le toit d'un voisin plus bas suit le sommet de ce toit", () => {
    // le pixel montre le point de la BASE du toit que son sommet a fait
    // glisser (sa part du déplacement) : l'ombre se lit là, comme toitVis
    // (pToit) — lue au sol, elle se décalait d'autant sur le toit
    const glisse = blocApres(bloc, 'if (uRelief > 0.0 && hRecoit > 0.0) {')
    expect(glisse).toContain('vec2 dep = relDisp * facteurRelief(hRecoit);')
    expect(glisse).toContain('wbO = wb - vec2(bca * dep.x + bsa * dep.y, -bsa * dep.x + bca * dep.y);')
    expect(glisse).toContain('dR = sdfBoiteLocal(bi, wbO, dec);')
    // relief éteint (ou au sol), le point est celui d'avant
    expect(bloc).toContain('vec2 wbO = wb;')
    expect(bloc).toContain('float dR = d;')
    // la portée, les trois échantillons et le fondu se lisent à ce point
    expect(bloc).toContain('if (ombreCourtePeutPorter(dR, lO, dec.y)) {')
    for (const t of ['0.25', '0.5']) expect(bloc).toContain(`sdfBoiteLocal(bi, wbO + lLoc * ${t}, dec)`)
    expect(bloc).toContain('sdfBoiteLocal(bi, wbO + lLoc, dec)')
    expect(bloc).toContain('smoothstep(0.0, lO + OMBRE_COURTE_FLOU, dR)')
    expect(bloc).not.toMatch(/sdfBoiteLocal\(bi, wb \+ lLoc/)
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
    // dans la composition, au fond de la cuve (tank), avant qu'il ne soit
    // posé dans l'image ; la salle en modules n'en a pas besoin (ses coques
    // sont des solides, la boucle des boîtes leur donne la leur)
    const compo = source.slice(source.indexOf('const COMPOSE_FS = `'), source.indexOf('\n}`', source.indexOf('const COMPOSE_FS = `')))
    const decl = occurrencesDans(compo, 'float contactCoque =')
    expect(decl).toHaveLength(1)
    expect(decl[0].entetes[0]).toBe('if (uSolModules < 0.5)')
    const garde = blocApres(compo, 'if (uSolModules < 0.5) {', compo.lastIndexOf('if (uSolModules < 0.5) {', decl[0].position))
    // serrée (quelques unités, deux pixels au moins au recul), du côté de la
    // cuve seulement (roomD < 0 : l'intérieur)
    expect(garde).toContain('float contactCoque = (1.0 - smoothstep(0.0, max(6.0, 2.0 * pxMonde), -roomD)) * step(roomD, 0.0);')
    // et elle assombrit le fond, avant que le fond ne soit peint
    expect(garde).toContain('tank *= 1.0 - 0.45 * contactCoque;')
    expect(decl[0].position).toBeLessThan(compo.indexOf('vec3 col = mix(voidCol, tank, inRoom);'))
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
