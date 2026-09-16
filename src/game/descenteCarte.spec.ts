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
  VOIE_INCONNUE,
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
sansSuite.liens = sansSuite.liens.filter((l) => l.de !== 'P1')
// LA CARTE AVEC UN « ? » : la carte livrée n'en a plus (l'inconnu vit dans la
// mini-carte), mais l'éditeur peut en poser un ; le module se teste ici
const avecInc = cloneCarte(CARTE_LIVREE)
avecInc.modules.push({ ...avecInc.modules[5], id: 'INC', nom: '?', type: 'inconnu', niveaux: 1, biome: 'INC', cran: 0, x: 630, y: 402 })
delete avecInc.modules[avecInc.modules.length - 1].orbe
avecInc.liens.push({ de: 'T2', vers: 'INC', type: 'alt' }, { de: 'INC', vers: 'C2', type: 'alt' })

describe('plusCourtVers — le plus court chemin en niveaux', () => {
  it('du HUB à l’observatoire : 30 salles — cinq biomes de six', () => {
    // HUB(0) T(6) N1(0) halte(0) C(6) halte(0) P(6) halte(0) ANTI(6) OBS(6)
    expect(plusCourtVers(c, 'HUB', 'OBS')).toBe(30)
    expect(plusCourtVers(c, 'C2', 'OBS')).toBe(18)
    expect(plusCourtVers(c, 'P2', 'OBS')).toBe(12)
    expect(plusCourtVers(c, 'ANTI', 'OBS')).toBe(6)
    expect(plusCourtVers(c, 'OBS', 'OBS')).toBe(0)
  })
  it('un cul-de-sac ne mène nulle part ; un module inconnu non plus', () => {
    expect(plusCourtVers(c, 'P1', 'OBS')).toBe(12) // la carte livrée continue
    expect(plusCourtVers(sansSuite, 'P1', 'OBS')).toBeNull()
    expect(plusCourtVers(c, 'X', 'OBS')).toBeNull()
  })
})

describe('la descente sur la carte', () => {
  it('part du HUB, un module sans salle : la carte s’ouvre tout de suite', () => {
    const e = departCarte(c)
    expect(e).toEqual({ module: 'HUB', niveau: 0, visites: [], revelations: {}, tissage: '', trace: [], graineRun: '' })
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
    expect(entreModule(c, e, 'T2', [])).toEqual({ module: 'T2', niveau: 0, visites: ['HUB'], revelations: {}, tissage: '', trace: [], graineRun: '' })
    expect(entreModule(c, e, 'T1', ['solidification'])?.module).toBe('T1')
  })

  it('une cache n’est pas un piège : quand l’objectif est hors de portée, on revient sur ses pas', () => {
    // HUB → T1 → N → S1 → S1b, sur la carte au cul-de-sac : de la cache,
    // rien ne repart — sauf le retour
    const e = { module: 'P1', niveau: 6, visites: ['HUB', 'T1', 'C1'], revelations: {}, tissage: '', trace: [], graineRun: '' }
    const choix = choixModules(sansSuite, e, [])
    expect(choix.map((x) => `${x.module.id}:${x.retour ? 'retour' : x.lien.type}`)).toEqual(['C1:retour'])
    const r = entreModule(sansSuite, e, 'C1', [])!
    // C1 est déjà traversé : la carte se rouvre sans rejouer ses salles
    expect(r).toEqual({
      module: 'C1',
      niveau: 6,
      visites: ['HUB', 'T1', 'C1', 'P1'],
      revelations: {},
      tissage: '',
      trace: [],
      graineRun: '',
    })
    // de C1, l'objectif reste atteignable par les soutes : aucun retour
    expect(choixModules(sansSuite, r, []).some((x) => x.retour)).toBe(false)
    // sur la carte livrée, le puits froid continue vers l'antichambre
    expect(choixModules(c, e, []).map((x) => `${x.module.id}:${x.lien.type}`)).toEqual(['ANTI:alt'])
  })

  it('un module traversé est épuisé pour la run, même en y rentrant par une coursive ordinaire', () => {
    // une carte qui boucle : l'économat renvoie vers S1 — S1 a déjà été joué
    const boucle = cloneCarte(c)
    boucle.liens.push({ de: 'P1', vers: 'C1', type: 'alt' })
    const e = { module: 'P1', niveau: 6, visites: ['HUB', 'T2', 'C1'], revelations: {}, tissage: '', trace: [], graineRun: '' }
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
    e = six(entreModule(c, e, 'C2', [])!)
    e = six(entreModule(c, e, 'P2', [])!)
    e = six(entreModule(c, e, 'ANTI', [])!)
    e = entreModule(c, e, 'OBS', [])!
    expect(objectifAtteint(c, e)).toBe(false)
    e = six(e)
    expect(objectifAtteint(c, e)).toBe(true)
    expect(e.visites).toEqual(['HUB', 'T2', 'C2', 'P2', 'ANTI'])
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
    const d = { module: 'P1', niveau: 0, visites: ['HUB', 'T1', 'C1'], revelations: {}, tissage: '', trace: [], graineRun: '' }
    expect(longueurRun(c, d, 12)).toBe(30) // 12 franchies + 6 restantes + 12
    // sur une carte au cul-de-sac, l'objectif n'est plus atteignable d'ici :
    // il ne reste que le module
    expect(longueurRun(sansSuite, d, 12)).toBe(18)
    // jamais plus petite que le rang
    expect(longueurRun(c, { module: 'OBS', niveau: 6, visites: [], revelations: {}, tissage: '', trace: [], graineRun: '' }, 30)).toBe(30)
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
    expect(litEtatCarteRun({ module: 'C2', niveau: 1.7, visites: ['HUB', 'X', 'T2'] }, c)).toEqual({
      module: 'C2',
      niveau: 1,
      visites: ['HUB', 'T2'],
      revelations: {},
      tissage: '',
      trace: [VOIE_INCONNUE], // une salle franchie, aucune voie connue
      graineRun: '',
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
    expect(c.modules.filter((x) => primeMemoire(x) === 2).map((x) => x.id)).toEqual(['C1', 'C3', 'ANTI'])
    // LA PRIME SE RÈGLE (le plan) : 50 % par cran → ×1,5 au cran 1 ; 0 : le confinement ne paie pas
    expect(primeMemoire(m('combat', 1), 0.5)).toBe(1.5)
    expect(primeMemoire(m('combat', 2), 0.5)).toBe(2)
    expect(primeMemoire(m('combat', 2), 0)).toBe(1)
    expect(primeMemoire(m('combat', 1), -3)).toBe(1) // jamais une prime négative
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
    expect(c.modules.filter((m) => climatDuModule(m) === 1).map((m) => m.id)).toEqual(['T1', 'C1', 'P1', 'ANTI'])
    expect(c.modules.filter((m) => climatDuModule(m) === 2).map((m) => m.id)).toEqual(['T3', 'C3', 'P3'])
  })
})

describe('offresRepos — l’alcôve, une seule offre', () => {
  it('trois offres, dans l’ordre souffle · réserve · condensat, toutes possibles quand il y a de la place', () => {
    const o = offresRepos({ vies: 1, viesMax: 3, bonbonne: 0.2, cap: 2 })
    expect(o.map((x) => `${x.id}:${x.possible}`)).toEqual(['souffle:true', 'reserve:true', 'condensat:true'])
    expect(o[1].detail).toBe('+0,5 L en bonbonne')
    expect(o[2].detail).toBe('+40 cL dans la bourse')
    // CE QU'UNE HALTE REND SE RÈGLE (le plan) : les offres le disent au chiffre
    const r = offresRepos({ vies: 1, viesMax: 3, bonbonne: 0.2, cap: 2 }, { reserveL: 1.2, condensatCl: 75 })
    expect(r[1].detail).toBe('+1,2 L en bonbonne')
    expect(r[2].detail).toBe('+75 cL dans la bourse')
    expect(offreDon({ bonbonne: 0.5, cap: 2 }, { reserveL: 1.2, condensatCl: 75 }).detail).toBe('+1,2 L en bonbonne')
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
  it('mesure la route la plus courte depuis un module : salles, confinements, et ce qui s’ouvre ensuite', () => {
    const p = projectionDepuis(c, 'C1')!
    expect(p.chemin[0]).toBe('C1')
    expect(p.chemin[p.chemin.length - 1]).toBe('OBS')
    expect(p.salles).toBe(24) // C1 (6) + P (6) + ANTI (6) + OBS (6)
    expect(p.crans).toBe(2) // le cryostat, puis l'antichambre — la suite évite les soutes
    expect(p.prochains).toEqual(['PUITS FROID', 'SOUTES'])
    expect(ditProjection(c, p)).toBe(
      'par ici : 24 salles jusqu’à OBSERVATOIRE · ensuite PUITS FROID ou SOUTES · confinement +2 sur la route',
    )
    // depuis la voie libre, la route la moins confinée : l'antichambre seule
    const n = projectionDepuis(c, 'T2')!
    expect(n.salles).toBe(30)
    expect(n.crans).toBe(1)
    // ce qui distingue deux portes voisines dont les routes se rejoignent :
    // ce qu'elles ouvrent tout de suite après
    expect(projectionDepuis(c, 'T1')!.prochains).toEqual(['CRYOSTAT', 'CONDUITS'])
    expect(projectionDepuis(c, 'T3')!.prochains).toEqual(['CONDUITS', 'CHAUFFERIE'])
    expect(ditProjection(c, projectionDepuis(c, 'T3')!)).toContain('ensuite CONDUITS ou CHAUFFERIE')
  })

  it('les haltes ne sont plus des arrêts de la grande carte ; un cul-de-sac n’a pas de projection', () => {
    expect(projectionDepuis(c, 'P1')!.arrets).toEqual([])
    expect(ditProjection(c, projectionDepuis(c, 'ANTI')!)).toBe('par ici : 12 salles jusqu’à OBSERVATOIRE · confinement +1 sur la route')
    expect(projectionDepuis(sansSuite, 'P1')).toBeNull()
    expect(projectionDepuis(c, 'X')).toBeNull()
  })
})

describe('le module « ? » — la nature se révèle à l’entrée', () => {
  const dansINC = { module: 'INC', niveau: 0, visites: ['HUB', 'T2'], revelations: {}, tissage: '', trace: [], graineRun: '' }

  it('tire une nature parmi REVELATIONS, la grave, et ne retire jamais', () => {
    const r = reveleInconnu(avecInc, dansINC, 'INC', () => 0.99)
    expect(r.revelations).toEqual({ INC: 'combat' })
    expect(reveleInconnu(avecInc, r, 'INC', () => 0).revelations).toEqual({ INC: 'combat' })
    // un module qui n'est pas un « ? » : rien
    expect(reveleInconnu(avecInc, dansINC, 'C2', () => 0)).toBe(dansINC)
    expect(reveleInconnu(avecInc, dansINC, 'X', () => 0)).toBe(dansINC)
  })

  it('le module courant se joue sous sa nature : une halte est épuisée, un combat surchauffé a sa salle', () => {
    expect(moduleCourant(avecInc, dansINC)?.type).toBe('inconnu')
    const halte = reveleInconnu(avecInc, dansINC, 'INC', () => 0) // economat
    expect(moduleCourant(avecInc, halte)?.type).toBe('economat')
    expect(moduleFini(avecInc, halte)).toBe(true)
    expect(longueurRun(avecInc, halte, 6)).toBe(30) // la salle du « ? » ne compte plus
    const combat = reveleInconnu(avecInc, dansINC, 'INC', () => 0.99)
    expect(moduleCourant(avecInc, combat)?.cran).toBe(1)
    expect(moduleFini(avecInc, combat)).toBe(false)
    expect(longueurRun(avecInc, combat, 6)).toBe(31)
  })

  it('la révélation traverse la sauvegarde, et se nettoie', () => {
    const lu = litEtatCarteRun({ module: 'INC', niveau: 0, visites: [], revelations: { INC: 'repos', C2: 'combat', X: 'don', OBS: 'boss' } }, avecInc)
    expect(lu.revelations).toEqual({ INC: 'repos' })
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

  it('une salle franchie sans porte laisse un trou : la trace reste au rang de la salle', () => {
    // deux salles franchies sans qu'aucune porte ne s'écrive (une
    // sauvegarde d'une autre version, une salle du pool hors voies)
    let e = entreModule(c, departCarte(c), 'T2', [], 'jour@T2')!
    e = franchitSalle(franchitSalle(e))
    expect(derniereVoie(e)).toBeNull() // origine inconnue : les trois portes s'ouvrent
    // la porte ouverte pour la salle 3 s'écrit À L'INDEX 2, pas au bout d'une
    // trace vide — sinon la mini-carte la dessinait en salle 1
    e = choisitVoie(e, 1)
    expect(e.trace).toEqual([VOIE_INCONNUE, VOIE_INCONNUE, 1])
    e = franchitSalle(e)
    expect(derniereVoie(e)).toBe(1)
    expect(choisitVoie(e, 0).trace).toEqual([VOIE_INCONNUE, VOIE_INCONNUE, 1, 0])
  })

  it('la sauvegarde garde le tissage et la trace, et se nettoie', () => {
    const lu = litEtatCarteRun({ module: 'C2', niveau: 2, visites: [], tissage: 'x@S2', trace: [1, 'b', 2.7, -1] }, c)
    expect(lu.tissage).toBe('x@S2')
    // ce qui n'est pas une voie garde sa place (inconnue) : le chemin ne glisse pas
    expect(lu.trace).toEqual([1, VOIE_INCONNUE, 2, VOIE_INCONNUE])
    expect(derniereVoie(lu)).toBeNull() // la salle 2 n'a pas de voie connue
    // une sauvegarde d'avant les voies : origine inconnue, les trois portes s'ouvriront
    const vieux = litEtatCarteRun({ module: 'C2', niveau: 2, visites: [] }, c)
    expect(vieux.tissage).toBe('')
    expect(vieux.trace).toEqual([VOIE_INCONNUE, VOIE_INCONNUE]) // comblée jusqu'au niveau
    expect(derniereVoie(vieux)).toBeNull()
    // une trace en retard sur le niveau se comble : la porte suivante s'écrira au bon rang
    const retard = litEtatCarteRun({ module: 'C2', niveau: 3, visites: [], trace: [0] }, c)
    expect(choisitVoie(retard, 2).trace).toEqual([0, VOIE_INCONNUE, VOIE_INCONNUE, 2])
  })
})
