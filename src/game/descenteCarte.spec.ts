import { describe, expect, it } from 'vitest'
import { CARTE_LIVREE, cloneCarte, plusCourtVers } from './carteStation'
import {
  choixModules,
  climatDuModule,
  departCarte,
  difficulteSousCran,
  postureDuModule,
  primeMemoire,
  entreModule,
  franchitSalle,
  litEtatCarteRun,
  longueurRun,
  moduleFini,
  objectifAtteint,
  orbesDuCycle,
} from './descenteCarte'

const c = CARTE_LIVREE
// LA CARTE AVEC UN CUL-DE-SAC : la carte livrée n'en a plus (chaque cache
// mène à l'observatoire), mais une carte de l'éditeur peut en avoir — le
// retour sur ses pas reste une règle du jeu, et se teste sur celle-ci
const sansSuite = cloneCarte(CARTE_LIVREE)
sansSuite.liens = sansSuite.liens.filter((l) => !(l.de === 'S1b' && l.vers === 'OBS'))

describe('plusCourtVers — le plus court chemin en niveaux', () => {
  it('du HUB à l’observatoire : 9 salles (T2 3, N 0, S2 3, OBS 3)', () => {
    expect(plusCourtVers(c, 'HUB', 'OBS')).toBe(9)
    expect(plusCourtVers(c, 'N', 'OBS')).toBe(6)
    expect(plusCourtVers(c, 'S2', 'OBS')).toBe(3)
    expect(plusCourtVers(c, 'OBS', 'OBS')).toBe(0)
  })
  it('un cul-de-sac ne mène nulle part ; un module inconnu non plus', () => {
    expect(plusCourtVers(c, 'S1b', 'OBS')).toBe(3) // la cache livrée continue
    expect(plusCourtVers(sansSuite, 'S1b', 'OBS')).toBeNull()
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
    // HUB → T1 → N → S1 → S1b, sur la carte au cul-de-sac : de la cache,
    // rien ne repart — sauf le retour
    const e = { module: 'S1b', niveau: 1, visites: ['HUB', 'T1', 'N', 'S1'] }
    const choix = choixModules(sansSuite, e, [])
    expect(choix.map((x) => `${x.module.id}:${x.retour ? 'retour' : x.lien.type}`)).toEqual(['S1:retour'])
    const r = entreModule(sansSuite, e, 'S1', [])!
    // S1 est déjà épuisé : la carte se rouvre sans rejouer ses salles
    expect(r).toEqual({ module: 'S1', niveau: 3, visites: ['HUB', 'T1', 'N', 'S1', 'S1b'] })
    // de S1, l'objectif est atteignable par l'économat : aucun retour offert
    const c2 = choixModules(sansSuite, r, [])
    expect(c2.map((x) => `${x.module.id}:${x.retour ? 'retour' : x.lien.type}`)).toEqual(['S1b:alt', 'ECO:alt'])
    // sur la carte livrée, la cache continue : la coursive vers l'observatoire
    expect(choixModules(c, e, []).map((x) => `${x.module.id}:${x.retour ? 'retour' : x.lien.type}`)).toEqual(['OBS:alt'])
  })

  it('un module traversé est épuisé pour la run, même en y rentrant par une coursive ordinaire', () => {
    // une carte qui boucle : l'économat renvoie vers S1 — S1 a déjà été joué
    const boucle = cloneCarte(c)
    boucle.liens.push({ de: 'ECO', vers: 'S1', type: 'alt' })
    const e = { module: 'ECO', niveau: 0, visites: ['HUB', 'T2', 'N', 'S1'] }
    const r = entreModule(boucle, e, 'S1', [])!
    expect(r.niveau).toBe(3) // épuisé : ses salles ne se rejouent pas
    expect(moduleFini(boucle, r)).toBe(true)
    // un module jamais traversé s'entame à zéro
    expect(entreModule(boucle, e, 'OBS', [])!.niveau).toBe(0)
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
    e = entreModule(c, franchitSalle(franchitSalle(franchitSalle(e))), 'ECO', [])!
    expect(moduleFini(c, e)).toBe(true) // une halte n'a pas de salle
    e = entreModule(c, e, 'OBS', [])!
    expect(objectifAtteint(c, e)).toBe(false)
    e = franchitSalle(franchitSalle(franchitSalle(e)))
    expect(objectifAtteint(c, e)).toBe(true)
    expect(e.visites).toEqual(['HUB', 'T2', 'N', 'S2', 'ECO'])
  })

  it('la longueur de la run découle du trajet et s’affine en route', () => {
    let e = departCarte(c)
    expect(longueurRun(c, e, 0)).toBe(9)
    e = entreModule(c, e, 'T2', [])!
    expect(longueurRun(c, e, 0)).toBe(9)
    e = franchitSalle(e)
    expect(longueurRun(c, e, 1)).toBe(9) // 1 franchie + 2 restantes + 6
    // un détour par T1 (3) puis S1 (3) puis la cache S1b (1) : la salle de
    // la cache s'ajoute, puis l'observatoire (3) — 10
    const d = { module: 'S1b', niveau: 0, visites: ['HUB', 'T1', 'N', 'S1'] }
    expect(longueurRun(c, d, 6)).toBe(10)
    // sur une carte au cul-de-sac, l'objectif n'est plus atteignable d'ici :
    // il ne reste que le module
    expect(longueurRun(sansSuite, d, 6)).toBe(7)
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

describe('la nature du module commande la salle', () => {
  const m = (type: (typeof c.modules)[number]['type'], cran = 0) => ({ ...c.modules[5], type, cran })

  it('combat : dangers fréquents et aucune énigme — sauf les premiers rangs sans danger', () => {
    expect(postureDuModule(m('combat'), false)).toEqual({ dangers: 3, mecanismes: 1 })
    expect(postureDuModule(m('combat'), true)).toEqual({ dangers: 1, mecanismes: 1 })
  })

  it('énigme : aucun danger, une énigme au faisceau ; cache : la cachette toujours', () => {
    expect(postureDuModule(m('enigme'), false)).toEqual({ dangers: 1, mecanismes: 2 })
    expect(postureDuModule(m('coffre'), false)).toEqual({ cachette: 2 })
  })

  it('le terminal, une halte ou l’absence de module laissent l’auto', () => {
    expect(postureDuModule(m('boss'), false)).toEqual({})
    expect(postureDuModule(m('economat'), false)).toEqual({})
    expect(postureDuModule(undefined, false)).toEqual({})
  })

  it('le cran monte la difficulté, borné à 9, et multiplie la mémoire', () => {
    expect(difficulteSousCran(2, m('combat'))).toBe(2)
    expect(difficulteSousCran(2, m('combat', 1))).toBe(3)
    expect(difficulteSousCran(9, m('combat', 2))).toBe(9)
    expect(difficulteSousCran(1, undefined)).toBe(1)
    expect(primeMemoire(m('combat'))).toBe(1)
    expect(primeMemoire(m('combat', 1))).toBe(2)
    expect(primeMemoire(undefined)).toBe(1)
    // la carte livrée : les secteurs du bord paient double
    expect(c.modules.filter((x) => primeMemoire(x) === 2).map((x) => x.id)).toEqual(['S1', 'S3'])
  })
})

describe('climatDuModule — la température fait le climat des dangers', () => {
  it('froid sous 10 °C, chaud dès 45 °C, auto entre les deux ; sans module, auto', () => {
    const t = (temp: number) => climatDuModule({ ...c.modules[5], temp })
    expect([t(-25), t(5), t(9)]).toEqual([1, 1, 1])
    expect([t(10), t(30), t(44)]).toEqual([0, 0, 0])
    expect([t(45), t(72)]).toEqual([2, 2])
    expect(climatDuModule(undefined)).toBe(0)
    // la carte livrée : le cryostat et la cache nord au froid, la
    // chaufferie et la cache sud au chaud, les conduits en auto
    expect(c.modules.filter((m) => climatDuModule(m) === 1).map((m) => m.id)).toEqual(['T1', 'S1', 'S1b'])
    expect(c.modules.filter((m) => climatDuModule(m) === 2).map((m) => m.id)).toEqual(['T3', 'S3', 'S3b'])
  })
})
