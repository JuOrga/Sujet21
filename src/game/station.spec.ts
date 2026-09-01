import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { momentAuRang, clampPlanVoie } from './voie'
import {
  CASES,
  MODULES,
  MODULE_HUB,
  caseDuRang,
  etatModule,
  moduleDuRang,
  pasRegulier,
  rangsDeCase,
  PLAN_LARGEUR,
  PLAN_HAUTEUR,
} from './station'
import { planStationSVG } from './planStation'

describe('la station — six modules, et pourquoi six', () => {
  it('se coupe par DEUX comme par TROIS', () => {
    // c'est toute la raison du chiffre : à douze salles on avance d'un
    // module toutes les deux, à dix-huit toutes les trois — sans reste.
    expect(CASES % 2).toBe(0)
    expect(CASES % 3).toBe(0)
    expect(pasRegulier(12)).toBe(2)
    expect(pasRegulier(18)).toBe(3)
    expect(pasRegulier(6)).toBe(1)
  })

  it('avoue quand la longueur ne tombe pas juste', () => {
    // l'écran ne doit pas annoncer « 2 salles par module » sur une descente
    // de treize salles : la répartition tient, le chiffre rond serait faux.
    expect(pasRegulier(13)).toBeNull()
    expect(pasRegulier(10)).toBeNull()
  })

  it('à douze salles, deux salles par module, exactement', () => {
    const cases = Array.from({ length: 12 }, (_, i) => caseDuRang(i + 1, 12))
    expect(cases).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6])
  })

  it('à dix-huit salles, trois par module, exactement', () => {
    const cases = Array.from({ length: 18 }, (_, i) => caseDuRang(i + 1, 18))
    expect(cases).toEqual([
      1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6,
    ])
  })

  it('LES TIERS DE LA DESCENTE TOMBENT SUR UNE FRONTIÈRE DE MODULE', () => {
    // c'est l'autre moitié de la raison du chiffre, et elle ne se voit
    // qu'ici : début · milieu · fin doivent valoir DEUX modules chacun,
    // sinon un module serait à cheval sur deux moments et le biome
    // changerait au milieu d'une salle.
    for (const longueur of [6, 12, 18, 24]) {
      const plan = clampPlanVoie({ longueur })
      for (let i = 0; i < CASES; i++) {
        const { premier, dernier } = rangsDeCase(i + 1, longueur)
        const moments = new Set<number>()
        for (let r = premier; r <= dernier; r++)
          moments.add(momentAuRang(r, plan))
        expect(
          moments.size,
          `module ${i + 1} à ${longueur} salles : ${[...moments].join('/')}`,
        ).toBe(1)
        // et le moment du module est bien celui que ses données annoncent
        expect([...moments][0]).toBe(MODULES[i].moment)
      }
    }
  })

  it('les rangs d’une case se suivent sans trou ni recouvrement', () => {
    for (const longueur of [6, 11, 12, 18, 20, 40]) {
      let attendu = 1
      for (let i = 1; i <= CASES; i++) {
        const { premier, dernier } = rangsDeCase(i, longueur)
        expect(premier).toBe(attendu)
        attendu = dernier + 1
      }
      expect(attendu - 1).toBe(longueur)
    }
  })

  it('répartit encore proportionnellement sur une longueur ingrate', () => {
    // 13 n'est pas un multiple de six : aucun rang ne doit pour autant
    // tomber hors des six modules.
    for (let r = 1; r <= 13; r++) {
      const c = caseDuRang(r, 13)
      expect(c).toBeGreaterThanOrEqual(1)
      expect(c).toBeLessThanOrEqual(CASES)
    }
    expect(caseDuRang(13, 13)).toBe(CASES)
  })

  it('au rang 0 on est au hub, pas dans la descente', () => {
    expect(caseDuRang(0, 12)).toBe(0)
    expect(moduleDuRang(0, 12)).toBe(MODULE_HUB)
    expect(moduleDuRang(1, 12)).toBe(MODULES[0])
    expect(moduleDuRang(12, 12)).toBe(MODULES[5])
  })

  it('l’état d’un module : franchi, courant, à venir', () => {
    // au rang 5 (cinq salles franchies) sur douze, la salle en cours est
    // dans le module 3 : les deux premiers sont derrière.
    expect(etatModule(0, 5, 12)).toBe('franchi')
    expect(etatModule(1, 5, 12)).toBe('franchi')
    expect(etatModule(2, 5, 12)).toBe('courant')
    expect(etatModule(3, 5, 12)).toBe('avenir')
    // avant de partir, aucun module n'est courant
    for (let i = 0; i < CASES; i++) expect(etatModule(i, 0, 12)).toBe('avenir')
  })
})

describe('la station — le biome de chaque module', () => {
  it('monte en mécanique sans jamais redescendre', () => {
    // le plan de descente ouvre les mécaniques au fil des moments ; la
    // traversée de la station raconte la même montée. Un module qui
    // redemanderait moins que le précédent la contredirait.
    const m = MODULES.map((x) => x.mecanique)
    expect(m).toEqual([...m].sort((a, b) => a - b))
    expect(m[0]).toBe(0) // on commence à l'eau seule
    expect(m[CASES - 1]).toBe(3) // on finit avec tout
  })

  it('donne à chaque module un nom, une matière et une teinte', () => {
    for (const m of [MODULE_HUB, ...MODULES]) {
      expect(m.nom.length).toBeGreaterThan(2)
      expect(m.ambiance.length).toBeGreaterThan(40)
      expect(m.matieres.length).toBeGreaterThan(0)
      expect(m.teinte).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('n’a ni doublon d’identifiant ni module qui en chevauche un autre', () => {
    const ids = [MODULE_HUB, ...MODULES].map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    const boites = [MODULE_HUB, ...MODULES].map((m) => m.boite)
    for (let i = 1; i < boites.length; i++)
      expect(
        boites[i].x,
        `le module ${i} recouvre le précédent`,
      ).toBeGreaterThan(boites[i - 1].x + boites[i - 1].w)
  })

  it('tient tout entier dans le cadre du plan', () => {
    for (const m of [MODULE_HUB, ...MODULES]) {
      expect(m.boite.x).toBeGreaterThanOrEqual(0)
      expect(m.boite.x + m.boite.w).toBeLessThanOrEqual(PLAN_LARGEUR)
      expect(m.boite.y).toBeGreaterThanOrEqual(0)
      expect(m.boite.y + m.boite.h).toBeLessThanOrEqual(PLAN_HAUTEUR)
    }
  })
})

describe('le plan dessiné', () => {
  const base = { rang: 0, longueur: 12, record: 0, scelle: true, selection: null }

  it('rend un SVG qui porte les six modules et le hub', () => {
    const svg = planStationSVG(base)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true)
    for (const m of MODULES) expect(svg).toContain(m.nom)
    expect(svg).toContain(MODULE_HUB.nom)
    // sept fûts : le hub et les six modules
    expect(svg.match(/class="ps-mod/g)).toHaveLength(7)
  })

  it('ne dessine ni route ni sujet tant qu’on n’est pas parti', () => {
    expect(planStationSVG(base)).not.toContain('ps-sujet')
    expect(planStationSVG({ ...base, rang: 1 })).toContain('ps-sujet')
  })

  it('marque un seul module courant, et les précédents franchis', () => {
    const svg = planStationSVG({ ...base, rang: 5 })
    expect(svg.match(/ps-courant/g)).toHaveLength(1)
    expect(svg.match(/ps-franchi/g)).toHaveLength(2)
  })

  it('lève le sceau du secteur 4 quand tout est raconté', () => {
    expect(planStationSVG(base)).toContain('ps-sceau')
    expect(planStationSVG({ ...base, scelle: false })).not.toContain('ps-sceau')
  })

  it('ne pose le fanion du record que DEVANT soi', () => {
    // derrière, il ne dirait rien qu'on ne voie déjà sur la route
    expect(planStationSVG({ ...base, rang: 1, record: 9 })).toContain('ps-record')
    expect(planStationSVG({ ...base, rang: 9, record: 9 })).not.toContain('ps-record')
    expect(planStationSVG({ ...base, rang: 11, record: 9 })).not.toContain('ps-record')
  })

  it('dessine le même ciel à chaque appel', () => {
    // un semis d'étoiles qui change à chaque ouverture se remarque, et pour
    // rien : le tirage est à graine fixe.
    expect(planStationSVG(base)).toBe(planStationSVG(base))
  })
})

// L'écran ne se monte pas tout seul : sa coque est dans index.html et son
// code dans main.ts, reliés par une poignée d'identifiants en toutes
// lettres. Un renommage donne un bouton qui n'ouvre rien, sans rien casser.
describe('l’écran LA STATION — la coque et sa porte', () => {
  const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')

  it('porte les identifiants que main.ts va chercher', () => {
    for (const id of [
      'home-station',
      'station',
      'station-plan',
      'station-fiche',
      'station-etat',
      'station-fermer',
    ])
      expect(HTML, `id="${id}" manque à index.html`).toContain(`id="${id}"`)
  })

  it('est un écran de JOUEUR : l’accueil public le montre', () => {
    // les outils de concepteur portent data-dev et disparaissent de
    // l'accueil public — le plan de la station, lui, est au joueur.
    const bouton = /<button id="home-station"[^>]*>/.exec(HTML)?.[0] ?? ''
    expect(bouton).not.toContain('data-dev')
  })
})
