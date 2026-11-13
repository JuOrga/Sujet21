import { describe, expect, it } from 'vitest'
import { cartoucheHTML } from './cartouches'
import { condensatDuSas, gainsDeModule, gainsDeSalle, memoireDuSas, recolteNeuve } from './recolte'

// De VRAIS gains : ceux que le sas d'une salle scellée fabrique (bourse,
// mémoire, tirage garanti, orbe), puis ceux d'une fin de module — les
// textes réels de recolte.ts, rôles et provenances compris, pas des
// exemples taillés pour passer.
const condensat = condensatDuSas({ surplusL: 4.18, rendement: 1.25, primeDouble: true, pastillesCl: 35 })
const memoire = memoireDuSas({ premiereFois: true, newVolume: true, newChrono: true, primeMur: 1, facteurModule: 1.5, primeDouble: true })
const gainsSalle = gainsDeSalle({
  condensat,
  bourseCl: 655,
  memoire: memoire.brut,
  memoireDetail: memoire.detail,
  memoireSolde: 148,
  tirageGaranti: true,
  orbe: 'ORBE DE GIVRE',
})
const gainsModule = gainsDeModule({
  recolte: { ...recolteNeuve('m1', [], 0), condensatCl: 820, memoire: 31, orbes: ['ORBE DE GIVRE'] },
  bourseCl: 655,
  memoireSolde: 148,
  instruments: [],
  nomInstrument: () => null,
  paliers: 2,
})
const gainsExemple = [...gainsSalle, ...gainsModule]

describe('la cartouche d’un gain', () => {
  it('couvre bien toutes les sortes de gain (le test regarde quelque chose)', () => {
    expect(new Set(gainsExemple.map((g) => g.cle)).size).toBeGreaterThanOrEqual(6)
  })

  it('une cartouche dit un chiffre et un nom, jamais une phrase', () => {
    for (const g of gainsExemple) {
      const html = cartoucheHTML(g, 0)
      expect(html).not.toContain('mb-gain-role')
      expect(html).not.toMatch(/>[^<]{60,}</) // aucun texte visible de plus de 60 caractères
      expect(html).toContain(`title="`)
      expect(html).not.toContain(`>${g.icone}<`) // l'émoji est parti
    }
  })

  it('porte le gros chiffre, le nom et l’icône rendue de sa monnaie', () => {
    const g = gainsSalle[0]
    const html = cartoucheHTML(g, 2)
    expect(html).toContain(`<b class="mb-cartouche-val">${g.valeur}</b>`)
    expect(html).toContain('CONDENSAT')
    expect(html).toContain('class="ico-ceremonie"')
    expect(html).toContain('--i:2')
  })

  it('range le rôle et la provenance dans l’infobulle, échappés', () => {
    const g = gainsSalle[0]
    const html = cartoucheHTML(g, 0)
    const titre = /title="([^"]*)"/.exec(html)?.[1] ?? ''
    expect(titre).toContain(g.role.slice(0, 20))
    expect(titre).toContain('livraison')
    const piege = cartoucheHTML({ ...g, role: 'a "b" <c> & d', detail: '' }, 0)
    expect(piege).toContain('a &quot;b&quot; &lt;c&gt; &amp; d')
  })

  it('montre le solde en petit chiffre, sans sa phrase', () => {
    const g = gainsSalle[0] // EN BOURSE 655 cL
    const html = cartoucheHTML(g, 0)
    expect(html).toContain('>655 cL<')
    expect(html).not.toContain('>EN BOURSE<')
    const sans = gainsSalle.find((x) => x.solde === null)!
    expect(cartoucheHTML(sans, 0)).not.toContain('mb-cartouche-solde')
  })
})
