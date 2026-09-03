import { describe, expect, it } from 'vitest'
import { CARTE_LIVREE, cloneCarte, plusCourtVers } from './carteStation'
import {
  choixModules,
  departCarte,
  entreModule,
  franchitSalle,
  litEtatCarteRun,
  longueurRun,
  moduleFini,
  objectifAtteint,
  orbesDuCycle,
} from './descenteCarte'

const c = CARTE_LIVREE

describe('plusCourtVers — le plus court chemin en niveaux', () => {
  it('du HUB à l’observatoire : 9 salles (T2 3, N 0, S2 3, OBS 3)', () => {
    expect(plusCourtVers(c, 'HUB', 'OBS')).toBe(9)
    expect(plusCourtVers(c, 'N', 'OBS')).toBe(6)
    expect(plusCourtVers(c, 'S2', 'OBS')).toBe(3)
    expect(plusCourtVers(c, 'OBS', 'OBS')).toBe(0)
  })
  it('un cul-de-sac ne mène nulle part ; un module inconnu non plus', () => {
    expect(plusCourtVers(c, 'S1b', 'OBS')).toBeNull()
    expect(plusCourtVers(c, 'X', 'OBS')).toBeNull()
  })
})

describe('la descente sur la carte', () => {
  it('part du HUB, un module sans salle : la carte s’ouvre tout de suite', () => {
    const e = departCarte(c)
    expect(e).toEqual({ module: 'HUB', niveau: 0, visites: [] })
    expect(moduleFini(c, e)).toBe(true)
    expect(objectifAtteint(c, e)).toBe(false)
  })

  it('depuis le HUB, trois coursives : T2 libre, T1 et T3 sous orbe', () => {
    const e = departCarte(c)
    const choix = choixModules(c, e, [])
    expect(choix.map((x) => `${x.module.id}:${x.orbeManquant ?? 'ouvert'}`)).toEqual([
      'T1:solidification',
      'T2:ouvert',
      'T3:vaporisation',
    ])
    expect(choixModules(c, e, ['solidification'])[0].orbeManquant).toBeNull()
  })

  it('entrer : seulement par une coursive ouverte', () => {
    const e = departCarte(c)
    expect(entreModule(c, e, 'T1', [])).toBeNull()
    expect(entreModule(c, e, 'OBS', [])).toBeNull()
    expect(entreModule(c, e, 'T2', [])).toEqual({ module: 'T2', niveau: 0, visites: ['HUB'] })
    expect(entreModule(c, e, 'T1', ['solidification'])?.module).toBe('T1')
  })

  it('une cache n’est pas un piège : quand l’objectif est hors de portée, on revient sur ses pas', () => {
    // HUB → T1 → N → S1 → S1b : de la cache, rien ne repart — sauf le retour
    const e = { module: 'S1b', niveau: 1, visites: ['HUB', 'T1', 'N', 'S1'] }
    const choix = choixModules(c, e, [])
    expect(choix.map((x) => `${x.module.id}:${x.retour ? 'retour' : x.lien.type}`)).toEqual(['S1:retour'])
    const r = entreModule(c, e, 'S1', [])!
    // S1 est déjà épuisé : la carte se rouvre sans rejouer ses salles
    expect(r).toEqual({ module: 'S1', niveau: 3, visites: ['HUB', 'T1', 'N', 'S1', 'S1b'] })
    // de S1, l'objectif reste hors de portée (S1 ne mène qu'à S1b) : retour
    // vers N — le module d'où l'on VIENT, pas le dernier traversé (la cache)
    const c2 = choixModules(c, r, [])
    expect(c2.map((x) => `${x.module.id}:${x.retour ? 'retour' : x.lien.type}`)).toEqual(['S1b:alt', 'N:retour'])
    const n = entreModule(c, r, 'N', [])!
    // de N, l'objectif est atteignable : aucun retour offert
    expect(choixModules(c, n, []).some((x) => x.retour)).toBe(false)
    expect(choixModules(c, n, []).map((x) => x.module.id)).toEqual(['S1', 'S2', 'S3'])
  })

  it('un module se finit salle par salle ; l’objectif s’atteint au bout du sien', () => {
    let e = entreModule(c, departCarte(c), 'T2', [])!
    expect(moduleFini(c, e)).toBe(false)
    e = franchitSalle(franchitSalle(e))
    expect(moduleFini(c, e)).toBe(false)
    e = franchitSalle(e)
    expect(moduleFini(c, e)).toBe(true)
    e = entreModule(c, e, 'N', [])!
    expect(moduleFini(c, e)).toBe(true) // le nœud n'a pas de salle
    e = entreModule(c, e, 'S2', [])!
    e = entreModule(c, franchitSalle(franchitSalle(franchitSalle(e))), 'OBS', [])!
    expect(objectifAtteint(c, e)).toBe(false)
    e = franchitSalle(franchitSalle(franchitSalle(e)))
    expect(objectifAtteint(c, e)).toBe(true)
    expect(e.visites).toEqual(['HUB', 'T2', 'N', 'S2'])
  })

  it('la longueur de la run découle du trajet et s’affine en route', () => {
    let e = departCarte(c)
    expect(longueurRun(c, e, 0)).toBe(9)
    e = entreModule(c, e, 'T2', [])!
    expect(longueurRun(c, e, 0)).toBe(9)
    e = franchitSalle(e)
    expect(longueurRun(c, e, 1)).toBe(9) // 1 franchie + 2 restantes + 6
    // un détour par T1 (3) puis S1 (3) puis S1b (1) : l'objectif n'est plus
    // atteignable — il ne reste que le module
    const d = { module: 'S1b', niveau: 0, visites: ['HUB', 'T1', 'N', 'S1'] }
    expect(longueurRun(c, d, 6)).toBe(7)
    // jamais plus petite que le rang
    expect(longueurRun(c, { module: 'OBS', niveau: 3, visites: [] }, 12)).toBe(12)
  })

  it('les orbes se lisent dans le cycle : transformations tissées et états atteints', () => {
    // au départ, fusion et liquéfaction sont offertes : solide et gaz ne
    // sont pas des états ACQUIS pour autant — elles y RAMÈNENT
    expect(orbesDuCycle([]).sort()).toEqual(['fusion', 'liquefaction', 'liquide'])
    expect(orbesDuCycle(['solidification']).sort()).toEqual(
      ['fusion', 'liquefaction', 'liquide', 'solide', 'solidification'],
    )
    // un verrou narratif ferme même l'offert
    expect(orbesDuCycle([], ['fusion'])).not.toContain('fusion')
    // le mystère n'est jamais tenu
    expect(orbesDuCycle(['ionisation'])).not.toContain('ionisation')
  })

  it('une sauvegarde d’avant la carte, ou périmée, repart du départ', () => {
    expect(litEtatCarteRun(undefined, c)).toEqual(departCarte(c))
    expect(litEtatCarteRun({ module: 'DISPARU', niveau: 2 }, c)).toEqual(departCarte(c))
    expect(litEtatCarteRun({ module: 'S2', niveau: 1.7, visites: ['HUB', 'X', 'N'] }, c)).toEqual({
      module: 'S2',
      niveau: 1,
      visites: ['HUB', 'N'],
    })
    // une carte qui change de départ : l'état suit
    const c2 = cloneCarte(c)
    c2.regles.depart = 'N'
    expect(departCarte(c2).module).toBe('N')
  })
})
