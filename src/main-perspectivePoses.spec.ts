import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { HAUTEUR_BLOCS } from './render/hauteurs'
import { coupeDemiPlan } from './render/porteBlindee'
import { fractionSommet } from './render/reliefParois'
import { demiPlanDevant, echellesColonne, mesures } from './render/voileCache'

// LES ÉMETTEURS, LES CIBLES ET LES CACHETTES SUIVENT LE RELIEF.
//
// Relief allumé, les faisceaux passaient déjà sous le dessus des murs
// (main-faisceauxOccultes.spec.ts), pas l'émetteur dont ils partent ni la
// cible où ils arrivent ; et le voile des cachettes restait une nappe au sol
// peinte par-dessus tout (le concepteur, 27/11 : « émetteur laser pas caché
// par la perspective, et les cachettes ne gèrent pas la perspective »).
//
// main.ts ne s'importe pas en test : on lit sa source, comme
// main-faisceauxOccultes.spec.ts.

const SRC = readFileSync(new URL('./main.ts', import.meta.url), 'utf-8')
const corps = (nom: string): string =>
  SRC.match(new RegExp(`function ${nom}\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? ''

describe('les émetteurs et les cibles sous le dessus des murs', () => {
  it('drawMecanismes les peint sur un calque dont les murs sont effacés', () => {
    const d = corps('drawMecanismes')
    const ouvre = d.indexOf('calquePoses = { c, rect, occ }')
    const emetteurs = d.indexOf('for (const em of lasers) {')
    const cibles = d.indexOf('for (let c = 0; c < cibles.length; c++) {')
    const ferme = d.indexOf('if (calquePoses) {')
    const coupelles = d.indexOf('// les COUPELLES')
    expect(ouvre).toBeGreaterThan(0)
    expect(emetteurs).toBeGreaterThan(ouvre)
    expect(cibles).toBeGreaterThan(emetteurs)
    expect(ferme).toBeGreaterThan(cibles)
    expect(coupelles).toBeGreaterThan(ferme)
    // la même règle que les faisceaux : ce qui arrête la lumière les cache
    const bloc = d.slice(d.indexOf('let calquePoses'), emetteurs)
    expect(bloc).toContain('occultantsPres(rMonde, absorbeLumiere)')
    expect(bloc).toMatch(/if \(fMurHaut > 0 && lasers\.length \+ cibles\.length > 0\)/)
    expect(d.slice(ferme, coupelles)).toContain('effaceVolumes(m, occ, projetteRelief)')
  })
})

describe('la colonne des cachettes', () => {
  it('une seule couche, au sol, sans rien de dressé dedans', () => {
    expect(echellesColonne(1, 0, 40)).toEqual([1])
    expect(echellesColonne(1.05, 0, 40)).toEqual([1])
  })

  it('du pied au dessus, à pas assez fins pour ne pas faire de marche', () => {
    const f = fractionSommet(0.07, 1, HAUTEUR_BLOCS)
    const sHaut = 1 / (1 - f)
    const { lisiere } = mesures(1)
    // un pan au bord de l'écran : 600 px du centre
    const ecart = 600 * (sHaut - 1)
    const e = echellesColonne(sHaut, ecart, lisiere)
    expect(e[0]).toBe(1)
    expect(e[e.length - 1]).toBeCloseTo(sHaut, 12)
    for (let k = 1; k < e.length; k++) {
      expect(e[k]).toBeGreaterThan(e[k - 1])
      // deux couches voisines se décalent d'au plus une demi-lisière
      expect(((e[k] - e[k - 1]) / (sHaut - 1)) * ecart).toBeLessThanOrEqual(lisiere * 0.5 + 1e-9)
    }
  })

  it('plafonnée à douze couches', () => {
    expect(echellesColonne(2, 1e6, 12).length).toBe(13)
  })

  const carre = [
    { x: 100, y: -50 },
    { x: 200, y: -50 },
    { x: 200, y: 50 },
    { x: 100, y: 50 },
  ]

  it('ce qui est entre l’œil et la cachette la couvre, ce qui est au-delà non', () => {
    // l'œil à l'origine, la cachette à droite
    const dp = demiPlanDevant(carre, 0, 0)!
    expect(dp.a.x).toBeCloseTo(100)
    expect(dp.a.y).toBeCloseTo(0)
    expect(dp.n.x).toBeCloseTo(-1)
    // un mur entre les deux : gardé
    const devant = [
      { x: 60, y: -80 },
      { x: 90, y: -80 },
      { x: 90, y: 80 },
      { x: 60, y: 80 },
    ]
    expect(coupeDemiPlan(devant, dp.a, dp.n).length).toBeGreaterThan(0)
    // un mur derrière elle : la colonne se penche sur lui, il ne la cache pas
    const derriere = devant.map((q) => ({ x: q.x + 160, y: q.y }))
    expect(coupeDemiPlan(derriere, dp.a, dp.n)).toEqual([])
  })

  it('l’œil dans la cachette : rien ne la couvre', () => {
    expect(demiPlanDevant(carre, 150, 0)).toBeNull()
  })

  it('drawMecanismes dresse le voile en colonne, relief allumé seulement', () => {
    const d = corps('drawMecanismes')
    const debut = d.indexOf('LES CACHETTES, EN DERNIER')
    const voile = d.slice(debut)
    expect(debut).toBeGreaterThan(0)
    // relief éteint : la nappe d'avant, telle quelle
    expect(voile).toMatch(/if \(fMurHaut <= 0\) \{\s*dessine\(g\)\s*continue/)
    expect(voile).toContain('echellesColonne(sHaut, ecart, lisiere)')
    // les solides du dehors seulement, ceux qui arrêtent la lumière
    expect(voile).toContain('absorbeLumiere(box) && !cache(box)')
    expect(voile).toContain('effaceVolumes(m, occ, projetteRelief, devant!)')
  })
})
