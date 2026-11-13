import { describe, expect, it } from 'vitest'
import { cartoucheHTML, ICONE_DE_GLYPHE, iconeDuGlyphe, offreHTML, plaqueHTML, puceHTML } from './cartouches'
import { ICONES_CEREMONIE } from './iconesStation'
import { offreDon, offresRepos } from './descenteCarte'
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

// LES HALTES (étape 6). Leurs données (descenteCarte.ts, evenements.ts, et
// les lignes d'issue de main.ts) parlent en émojis, que les écrans hors
// cérémonie gardent ; la cérémonie les traduit en icônes rendues par une
// seule table. Un glyphe qu'elle ne connaît pas (l'émoji d'un instrument,
// un glyphe ajouté plus tard) reste écrit tel quel : jamais une case vide.
describe('les glyphes des haltes', () => {
  it('traduit chaque glyphe des haltes en icône de cérémonie', () => {
    expect(ICONE_DE_GLYPHE).toEqual({
      '🫙': 'reserve', '💧': 'condensat', '🧠': 'memoire', '💠': 'secours',
      '🗺️': 'carte', '⚠️': 'danger', '🜄': 'profondeur', '🔮': 'orbe',
    })
    for (const icone of Object.values(ICONE_DE_GLYPHE)) expect(ICONES_CEREMONIE).toContain(icone)
  })
  it('lit un glyphe avec ou sans son sélecteur de variante', () => {
    // « 🗺️ » s'écrit avec U+FE0F dans un fichier, sans dans un autre : le
    // même dessin à l'écran, deux clés pour une table
    expect(iconeDuGlyphe('\u{1F5FA}')).toBe('carte')
    expect(iconeDuGlyphe('\u{1F5FA}\uFE0F')).toBe('carte')
    expect(iconeDuGlyphe('\u26A0')).toBe('danger')
    expect(iconeDuGlyphe('🧲')).toBeNull()
  })
  it('a une icône pour chaque offre de l’alcôve et du don', () => {
    const offres = [
      ...offresRepos({ vies: 1, viesMax: 3, bonbonne: 1, cap: 8 }),
      offreDon({ bonbonne: 1, cap: 8 }),
      offreDon({ bonbonne: 8, cap: 8 }),
    ]
    for (const o of offres) expect(iconeDuGlyphe(o.icone), o.nom).not.toBeNull()
  })
})

describe('la puce d’une issue', () => {
  it('pose l’icône rendue à la place du glyphe, et garde la phrase', () => {
    const html = puceHTML('🫙 réserve +1,5 L', 2)
    expect(html).toContain('class="ico-ceremonie"')
    expect(html).toContain('>réserve +1,5 L<')
    expect(html).not.toContain('🫙')
    expect(html).toContain('--i:2')
    expect(html).toMatch(/^<li class="mb-cartouche mb-puce"/)
  })
  it('garde un glyphe inconnu, écrit, dans l’alvéole — jamais une case vide', () => {
    const html = puceHTML('🧲 Aimant à rosée : la rosée vient à vous', 0)
    expect(html).toContain('>🧲<')
    expect(html).toContain('>Aimant à rosée : la rosée vient à vous<')
  })
  it('laisse une ligne sans glyphe telle quelle, sans alvéole', () => {
    // « +1 échantillon » commence par un chiffre : ce n'est pas un glyphe
    const html = puceHTML('+1 échantillon de secours', 0)
    expect(html).toContain('mb-puce-nue')
    expect(html).not.toContain('mb-cartouche-alv')
    expect(html).toContain('>+1 échantillon de secours<')
  })
  it('laisse l’appelant dessiner un glyphe que la table ne connaît pas', () => {
    const html = puceHTML('🧲 Aimant', 0, (g) => (g === '🧲' ? '<i class="ico-instrument"></i>' : null))
    expect(html).toContain('<i class="ico-instrument"></i>')
    expect(html).not.toContain('🧲')
  })
  it('échappe la phrase', () => {
    expect(puceHTML('💧 a <b> & "c"', 0)).toContain('a &lt;b&gt; &amp; &quot;c&quot;')
  })
})

describe('la plaque et l’offre', () => {
  it('une plaque dit un chiffre et un nom, avec son icône et son liseré', () => {
    const html = plaqueHTML({ cle: 'reserve', icone: 'reserve', valeur: '3,20 / 8 L', nom: 'RÉSERVE', titre: 'la bonbonne' }, 1)
    expect(html).toContain('class="mb-cartouche mb-cartouche-reserve"')
    expect(html).toContain('<b class="mb-cartouche-val">3,20 / 8 L</b>')
    expect(html).toContain('<span class="mb-cartouche-nom">RÉSERVE</span>')
    expect(html).toContain('title="la bonbonne"')
    expect(html).toContain('--i:1')
  })
  it('une offre porte son alvéole, son nom et son détail, échappés', () => {
    const html = offreHTML({ glyphe: '💠', nom: 'SECOND <SOUFFLE>', detail: '+1 échantillon' })
    expect(html).toContain('class="ico-ceremonie"')
    expect(html).toContain('<b class="mb-offre-nom">SECOND &lt;SOUFFLE&gt;</b>')
    expect(html).toContain('<small class="mb-offre-detail">+1 échantillon</small>')
  })
  it('une offre sans icône n’a pas d’alvéole ; un détail voilé se marque', () => {
    const html = offreHTML({ nom: 'FOUILLER', detail: '…', voile: true, mention: '<em class="mb-ev-sur">▸ sans risque</em>' })
    expect(html).not.toContain('mb-cartouche-alv')
    expect(html).toContain('<small class="mb-offre-detail mb-ev-voile">…</small>')
    expect(html).toContain('<em class="mb-ev-sur">▸ sans risque</em>')
  })
})
