import { describe, expect, it } from 'vitest'
import { CARTE_LIVREE, cloneCarte, plusCourtVers } from './carteStation'
import {
  choisitVoie,
  choixModules,
  climatDuModule,
  derniereVoie,
  ditProjection,
  moduleCourant,
  offreDon,
  offresRepos,
  reveleInconnu,
  projectionDepuis,
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
// LA CARTE AVEC UN CUL-DE-SAC : la carte livrée n'en a plus (toute halte
// continue vers les profondeurs), mais une carte de l'éditeur peut en
// avoir — le retour sur ses pas reste une règle du jeu, et se teste ici sur
// une cache nord dont on a coupé les coursives de sortie
const sansSuite = cloneCarte(CARTE_LIVREE)
sansSuite.liens = sansSuite.liens.filter((l) => l.de !== 'CN')

describe('plusCourtVers — le plus court chemin en niveaux', () => {
  it('du HUB à l’observatoire : 30 salles — cinq biomes de six', () => {
    // HUB(0) T(6) N1(0) halte(0) C(6) halte(0) P(6) halte(0) ANTI(6) OBS(6)
    expect(plusCourtVers(c, 'HUB', 'OBS')).toBe(30)
    expect(plusCourtVers(c, 'N1', 'OBS')).toBe(24)
    expect(plusCourtVers(c, 'C2', 'OBS')).toBe(18)
    expect(plusCourtVers(c, 'P2', 'OBS')).toBe(12)
    expect(plusCourtVers(c, 'ANTI', 'OBS')).toBe(6)
    expect(plusCourtVers(c, 'OBS', 'OBS')).toBe(0)
  })
  it('un cul-de-sac ne mène nulle part ; un module inconnu non plus', () => {
    expect(plusCourtVers(c, 'CN', 'OBS')).toBe(18) // la cache livrée continue
    expect(plusCourtVers(sansSuite, 'CN', 'OBS')).toBeNull()
    expect(plusCourtVers(c, 'X', 'OBS')).toBeNull()
  })
})

describe('la descente sur la carte', () => {
  it('part du HUB, un module sans salle : la carte s’ouvre tout de suite', () => {
    const e = departCarte(c)
    expect(e).toEqual({ module: 'HUB', niveau: 0, visites: [], revelations: {}, tissage: '', trace: [] })
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
    expect(entreModule(c, e, 'T2', [])).toEqual({ module: 'T2', niveau: 0, visites: ['HUB'], revelations: {}, tissage: '', trace: [] })
    expect(entreModule(c, e, 'T1', ['solidification'])?.module).toBe('T1')
  })

  it('une cache n’est pas un piège : quand l’objectif est hors de portée, on revient sur ses pas', () => {
    // HUB → T1 → N → S1 → S1b, sur la carte au cul-de-sac : de la cache,
    // rien ne repart — sauf le retour
    const e = { module: 'CN', niveau: 0, visites: ['HUB', 'T1', 'N1', 'ECO1', 'C1'], revelations: {}, tissage: '', trace: [] }
    const choix = choixModules(sansSuite, e, [])
    expect(choix.map((x) => `${x.module.id}:${x.retour ? 'retour' : x.lien.type}`)).toEqual(['C1:retour'])
    const r = entreModule(sansSuite, e, 'C1', [])!
    // C1 est déjà traversé : la carte se rouvre sans rejouer ses salles
    expect(r).toEqual({
      module: 'C1',
      niveau: 6,
      visites: ['HUB', 'T1', 'N1', 'ECO1', 'C1', 'CN'],
      revelations: {},
      tissage: '',
      trace: [],
    })
    // de C1, l'objectif reste atteignable par la bonbonne : aucun retour
    expect(choixModules(sansSuite, r, []).some((x) => x.retour)).toBe(false)
    // sur la carte livrée, la cache continue vers les profondeurs
    expect(choixModules(c, e, []).map((x) => `${x.module.id}:${x.lien.type}`)).toEqual(['P1:alt', 'P2:alt'])
  })

  it('un module traversé est épuisé pour la run, même en y rentrant par une coursive ordinaire', () => {
    // une carte qui boucle : l'économat renvoie vers S1 — S1 a déjà été joué
    const boucle = cloneCarte(c)
    boucle.liens.push({ de: 'CN', vers: 'C1', type: 'alt' })
    boucle.liens.push({ de: 'CN', vers: 'ANTI', type: 'alt' })
    const e = { module: 'CN', niveau: 0, visites: ['HUB', 'T2', 'N1', 'ECO1', 'C1'], revelations: {}, tissage: '', trace: [] }
    const r = entreModule(boucle, e, 'C1', [])!
    expect(r.niveau).toBe(6) // épuisé : ses salles ne se rejouent pas
    expect(moduleFini(boucle, r)).toBe(true)
    // un module jamais traversé s'entame à zéro
    expect(entreModule(boucle, e, 'ANTI', [])!.niveau).toBe(0)
  })

  it('un module se finit salle par salle ; l’objectif s’atteint au bout du sien', () => {
    const six = (x: typeof e): typeof e => [0, 1, 2, 3, 4, 5].reduce((a) => franchitSalle(a), x)
    let e = entreModule(c, departCarte(c), 'T2', [])!
    expect(moduleFini(c, e)).toBe(false)
    e = franchitSalle(franchitSalle(e))
    expect(moduleFini(c, e)).toBe(false)
    e = franchitSalle(franchitSalle(franchitSalle(franchitSalle(e))))
    expect(moduleFini(c, e)).toBe(true)
    e = entreModule(c, e, 'N1', [])!
    expect(moduleFini(c, e)).toBe(true) // le nœud n'a pas de salle
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    e = entreModule(c, e, 'ECO1', [])!
    expect(moduleFini(c, e)).toBe(true) // une halte n'a pas de salle
    e = entreModule(c, six(entreModule(c, e, 'C2', [])!), 'CN', [])!
    e = entreModule(c, six(entreModule(c, e, 'P2', [])!), 'ECO2', [])!
    e = entreModule(c, six(entreModule(c, e, 'ANTI', [])!), 'OBS', [])!
    expect(objectifAtteint(c, e)).toBe(false)
    e = six(e)
    expect(objectifAtteint(c, e)).toBe(true)
    expect(e.visites).toEqual(['HUB', 'T2', 'N1', 'ECO1', 'C2', 'CN', 'P2', 'ECO2', 'ANTI'])
  })

  it('la longueur de la run découle du trajet et s’affine en route', () => {
    let e = departCarte(c)
    expect(longueurRun(c, e, 0)).toBe(30)
    e = entreModule(c, e, 'T2', [])!
    expect(longueurRun(c, e, 0)).toBe(30)
    e = franchitSalle(e)
    expect(longueurRun(c, e, 1)).toBe(30) // 1 franchie + 5 restantes + 24
    // un détour par T1 (3) puis S1 (3) puis la cache S1b (1) : la salle de
    // la cache s'ajoute, puis l'observatoire (3) — 10
    const d = { module: 'CN', niveau: 0, visites: ['HUB', 'T1', 'N1', 'ECO1', 'C1'], revelations: {}, tissage: '', trace: [] }
    expect(longueurRun(c, d, 12)).toBe(30) // 12 franchies + la cache (0) + 18
    // sur une carte au cul-de-sac, l'objectif n'est plus atteignable d'ici :
    // il ne reste que le module
    expect(longueurRun(sansSuite, d, 12)).toBe(12)
    // jamais plus petite que le rang
    expect(longueurRun(c, { module: 'OBS', niveau: 6, visites: [], revelations: {}, tissage: '', trace: [] }, 30)).toBe(30)
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
    expect(litEtatCarteRun({ module: 'C2', niveau: 1.7, visites: ['HUB', 'X', 'N1'] }, c)).toEqual({
      module: 'C2',
      niveau: 1,
      visites: ['HUB', 'N1'],
      revelations: {},
      tissage: '',
      trace: [],
    })
    // une carte qui change de départ : l'état suit
    const c2 = cloneCarte(c)
    c2.regles.depart = 'N1'
    expect(departCarte(c2).module).toBe('N1')
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
    expect(c.modules.filter((x) => primeMemoire(x) === 2).map((x) => x.id)).toEqual(['C1', 'C3', 'P1', 'P3'])
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
    expect(c.modules.filter((m) => climatDuModule(m) === 1).map((m) => m.id)).toEqual(['T1', 'C1', 'CN', 'P1', 'ANTI'])
    expect(c.modules.filter((m) => climatDuModule(m) === 2).map((m) => m.id)).toEqual(['T3', 'C3', 'CS', 'P3'])
  })
})

describe('offresRepos — l’alcôve, une seule offre', () => {
  it('trois offres, dans l’ordre souffle · réserve · condensat, toutes possibles quand il y a de la place', () => {
    const o = offresRepos({ vies: 1, viesMax: 3, bonbonne: 0.2, cap: 2 })
    expect(o.map((x) => `${x.id}:${x.possible}`)).toEqual(['souffle:true', 'reserve:true', 'condensat:true'])
    expect(o[1].detail).toBe('+0,5 L en bonbonne')
    expect(o[2].detail).toBe('+40 cL dans la bourse')
  })

  it('une offre qui ne donnerait rien reste visible mais impossible, et le dit', () => {
    const o = offresRepos({ vies: 3, viesMax: 3, bonbonne: 2, cap: 2 })
    expect(o[0].possible).toBe(false)
    expect(o[0].detail).toBe('échantillons au plafond')
    expect(o[1].possible).toBe(false)
    expect(o[1].detail).toBe('bonbonne pleine')
    expect(o[2].possible).toBe(true) // la bourse n'a pas de plafond
  })
})

describe('projectionDepuis — le survol qui projette', () => {
  it('mesure la route la plus courte depuis un module : salles, arrêts, confinements', () => {
    const p = projectionDepuis(c, 'C1')!
    expect(p.chemin[0]).toBe('C1')
    expect(p.chemin[p.chemin.length - 1]).toBe('OBS')
    expect(p.salles).toBe(24) // C1 (6) + halte (0) + P (6) + halte (0) + ANTI (6) + OBS (6)
    expect(p.crans).toBe(1) // le cryostat, et rien d'autre : la suite évite l'élite
    expect(p.arrets.length).toBeGreaterThan(0)
    expect(ditProjection(c, p)).toContain('par ici : 24 salles jusqu’à OBSERVATOIRE')
    expect(ditProjection(c, p)).toContain('confinement +1 sur la route')
    // depuis le nœud, la voie la plus sûre : aucun confinement, que des haltes
    const n = projectionDepuis(c, 'N1')!
    expect(n.salles).toBe(24)
    expect(n.crans).toBe(0)
    expect(ditProjection(c, n)).toContain('par ici : 24 salles jusqu’à OBSERVATOIRE')
  })

  it('une cache compte comme arrêt ; sans arrêt, la fiche le dit ; un cul-de-sac n’a pas de projection', () => {
    const p = projectionDepuis(c, 'CN')!
    expect(p.arrets[0]).toBe('CACHE NORD')
    expect(p.salles).toBe(18)
    expect(ditProjection(c, projectionDepuis(c, 'ANTI')!)).toBe('par ici : 12 salles jusqu’à OBSERVATOIRE · sans arrêt')
    expect(projectionDepuis(sansSuite, 'CN')).toBeNull()
    expect(projectionDepuis(c, 'X')).toBeNull()
  })
})

describe('le module « ? » — la nature se révèle à l’entrée', () => {
  const dansINC = { module: 'INC1', niveau: 0, visites: ['HUB', 'T2', 'N1'], revelations: {}, tissage: '', trace: [] }

  it('tire une nature parmi REVELATIONS, la grave, et ne retire jamais', () => {
    const r = reveleInconnu(c, dansINC, 'INC1', () => 0.99)
    expect(r.revelations).toEqual({ INC1: 'combat' })
    expect(reveleInconnu(c, r, 'INC1', () => 0).revelations).toEqual({ INC1: 'combat' })
    // un module qui n'est pas un « ? » : rien
    expect(reveleInconnu(c, dansINC, 'C2', () => 0)).toBe(dansINC)
    expect(reveleInconnu(c, dansINC, 'X', () => 0)).toBe(dansINC)
  })

  it('le module courant se joue sous sa nature : une halte est épuisée, un combat surchauffé a sa salle', () => {
    expect(moduleCourant(c, dansINC)?.type).toBe('inconnu')
    const halte = reveleInconnu(c, dansINC, 'INC1', () => 0) // economat
    expect(moduleCourant(c, halte)?.type).toBe('economat')
    expect(moduleFini(c, halte)).toBe(true)
    expect(longueurRun(c, halte, 6)).toBe(30) // la salle du « ? » ne compte plus
    const combat = reveleInconnu(c, dansINC, 'INC1', () => 0.99)
    expect(moduleCourant(c, combat)?.cran).toBe(1)
    expect(moduleFini(c, combat)).toBe(false)
    expect(longueurRun(c, combat, 6)).toBe(31)
  })

  it('la révélation traverse la sauvegarde, et se nettoie', () => {
    const lu = litEtatCarteRun({ module: 'INC1', niveau: 0, visites: [], revelations: { INC1: 'repos', C2: 'combat', X: 'don', OBS: 'boss' } }, c)
    expect(lu.revelations).toEqual({ INC1: 'repos' })
    // une carte sans « ? » : l'entrée se fait sans révélation
    expect(entreModule(c, departCarte(c), 'T2', [])!.revelations).toEqual({})
  })

  it('offreDon : de la réserve s’il y a de la place, sinon du condensat', () => {
    expect(offreDon({ bonbonne: 0.5, cap: 2 })).toMatchObject({ id: 'reserve', nom: 'UNE BONBONNE OUBLIÉE', possible: true })
    expect(offreDon({ bonbonne: 2, cap: 2 })).toMatchObject({ id: 'condensat', nom: 'UN FÛT DE CONDENSAT', possible: true })
  })
})

describe('la mini-carte à voies dans l’état de la run', () => {
  it('entrer tisse (la graine donnée) et vide la trace ; ouvrir une porte l’écrit', () => {
    let e = entreModule(c, departCarte(c), 'T2', [], 'jour@T2')!
    expect(e.tissage).toBe('jour@T2')
    expect(e.trace).toEqual([])
    expect(derniereVoie(e)).toBeNull()
    e = choisitVoie(e, 2)
    expect(e.trace).toEqual([2])
    e = franchitSalle(e)
    expect(derniereVoie(e)).toBe(2)
    e = choisitVoie(e, 1)
    expect(e.trace).toEqual([2, 1])
    // rouvrir une porte du même rang REMPLACE (jamais deux voies pour une salle)
    expect(choisitVoie(e, 0).trace).toEqual([2, 0])
    // sans graine (un outil) : pas de voies
    expect(entreModule(c, departCarte(c), 'T2', [])!.tissage).toBe('')
  })

  it('la sauvegarde garde le tissage et la trace, et se nettoie', () => {
    const lu = litEtatCarteRun({ module: 'C2', niveau: 2, visites: [], tissage: 'x@S2', trace: [1, 'b', 2.7, -1] }, c)
    expect(lu.tissage).toBe('x@S2')
    expect(lu.trace).toEqual([1, 2, 0])
    expect(derniereVoie(lu)).toBe(2)
    // une sauvegarde d'avant les voies : origine inconnue, les trois portes s'ouvriront
    const vieux = litEtatCarteRun({ module: 'C2', niveau: 2, visites: [] }, c)
    expect(vieux.tissage).toBe('')
    expect(derniereVoie(vieux)).toBeNull()
  })
})
