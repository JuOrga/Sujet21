import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CARTE_LIVREE,
  CRAN_MAX,
  HALTES,
  accessibles,
  cheminLePlusCourt,
  estHalte,
  longueurRoute,
  plusCourtVers,
  routesVersObjectif,
  cloneCarte,
  couleurTemperature,
  orbeRequis,
  biomesDeCarte,
  longueursTrajet,
  ORBES,
  liensDepuis,
  litCondition,
  parseCarte,
  serialiseCarte,
  traceLien,
  verifieCarte,
} from './carteStation'

// LA CARTE LIVRÉE EST LE FICHIER, ET LE FICHIER EST VALIDE. Le concepteur
// remplace src/game/carteStation.json par l'export de l'éditeur : si un
// jour ce fichier ne se lit plus, le jeu ne doit pas démarrer sur une carte
// muette — le test tombe avant.
const CHEMIN = new URL('./carteStation.json', import.meta.url)

describe('carteStation.json — la source de vérité', () => {
  it('se lit sans défaut de forme', () => {
    const brut = JSON.parse(readFileSync(CHEMIN, 'utf8'))
    const { carte, erreurs } = parseCarte(brut)
    expect(erreurs).toEqual([])
    expect(carte).not.toBeNull()
  })

  it('est la carte à routes : 13 modules, 19 coursives, 5 zones', () => {
    expect(CARTE_LIVREE.modules).toHaveLength(13)
    expect(CARTE_LIVREE.liens).toHaveLength(19)
    expect(CARTE_LIVREE.zones).toHaveLength(5)
    expect(CARTE_LIVREE.regles.depart).toBe('HUB')
    expect(CARTE_LIVREE.regles.objectif).toBe('OBS')
  })

  it('ne présente aucune ERREUR de fond (les attentions sont tolérées)', () => {
    const erreurs = verifieCarte(CARTE_LIVREE).filter((v) => v.niveau === 'erreur')
    expect(erreurs).toEqual([])
  })

  it('SE RELIT À L’IDENTIQUE : sérialiser puis lire rend la même carte', () => {
    // c'est ce qui rend les diffs du JSON lisibles — même ordre de clés,
    // rien d'ajouté, rien d'omis
    const texte = serialiseCarte(CARTE_LIVREE)
    const { carte } = parseCarte(JSON.parse(texte))
    expect(carte).toEqual(CARTE_LIVREE)
    expect(serialiseCarte(carte!)).toBe(texte)
  })

  it('le fichier du dépôt est déjà dans la forme que l’éditeur exporte', () => {
    // un export posé par-dessus le fichier ne doit produire AUCUN diff
    // parasite (indentation, ordre des clés) : seul le contenu compte
    expect(readFileSync(CHEMIN, 'utf8')).toBe(serialiseCarte(CARTE_LIVREE))
  })
})

describe('parseCarte — la lecture dit ce qui manque', () => {
  it('refuse ce qui n’est pas un objet', () => {
    expect(parseCarte(null).carte).toBeNull()
    expect(parseCarte('x').erreurs[0]).toMatch(/objet/)
  })

  it('nomme le module et le champ en défaut', () => {
    const brut = JSON.parse(serialiseCarte(CARTE_LIVREE))
    brut.modules[2].x = 'loin'
    brut.modules[3].type = 'donjon'
    const { carte, erreurs } = parseCarte(brut)
    expect(carte).toBeNull()
    expect(erreurs).toContain('modules[2] (T2) : x (nombre) requis')
    expect(erreurs).toContain('modules[3] (T3) : type inconnu « donjon »')
  })

  it('une carte d’avant les haltes et le cran reste lisible : libellés par défaut, cran à zéro', () => {
    // la carte PUBLIÉE (magasin) peut dater d'avant ces natures : la refuser
    // ferait jouer tout le monde sur la carte livrée sans que rien le dise
    const brut = JSON.parse(serialiseCarte(CARTE_LIVREE)) as Record<string, unknown>
    const types = { ...(brut.types as Record<string, string>) }
    delete types.economat
    delete types.repos
    const modules = (brut.modules as Record<string, unknown>[]).map((m) => {
      const { cran: _cran, ...reste } = m
      return reste
    })
    const { carte, erreurs } = parseCarte({ ...brut, types, modules })
    expect(erreurs).toEqual([])
    expect(carte!.types.economat).toBe('ÉCONOMAT')
    expect(carte!.types.repos).toBe('REPOS')
    expect(carte!.modules.every((m) => m.cran === 0)).toBe(true)
  })

  it('le cran de confinement se lit borné, et ne s’écrit que s’il compte', () => {
    const brut = JSON.parse(serialiseCarte(CARTE_LIVREE)) as { modules: Record<string, unknown>[] }
    brut.modules[1].cran = 2.4
    brut.modules[2].cran = 9
    brut.modules[3].cran = -1
    const { carte, erreurs } = parseCarte(brut)
    expect(erreurs).toEqual([])
    expect(carte!.modules.slice(1, 4).map((m) => m.cran)).toEqual([2, CRAN_MAX, 0])
    const relu = JSON.parse(serialiseCarte(carte!)) as { modules: Record<string, unknown>[] }
    expect(relu.modules[1].cran).toBe(2)
    expect('cran' in relu.modules[3]).toBe(false)
    brut.modules[1].cran = 'fort'
    expect(parseCarte(brut).erreurs.some((e) => /T1.*cran/.test(e))).toBe(true)
  })

  it('accepte une carte sans décor, et une condition vide comme un passage libre', () => {
    const brut = JSON.parse(serialiseCarte(CARTE_LIVREE))
    delete brut.decor
    brut.typesLiens.glace.condition = ''
    const { carte, erreurs } = parseCarte(brut)
    expect(erreurs).toEqual([])
    expect(carte!.decor).toEqual([])
    expect(carte!.typesLiens.glace.condition).toBeNull()
  })
})

describe('traceLien — la règle des coursives du hub', () => {
  const lien = (de: string, vers: string) => CARTE_LIVREE.liens.find((l) => l.de === de && l.vers === vers)!

  it('sort du flanc du HUB, à hauteur de la cible quand elle est en face', () => {
    // T2 est à y=385, le HUB aussi : la coursive part droit
    const t = traceLien(CARTE_LIVREE, lien('HUB', 'T2'))!
    expect(t.y1).toBe(385)
    expect(t.d).toBe('M263 385 L507 385')
  })

  it('borne la sortie à ±110 du centre du hub (h/2 − 36 pour un fût de 292)', () => {
    // T1 est à y=231, trop haut : la sortie se cale à 380 − 110 = 270
    expect(traceLien(CARTE_LIVREE, lien('HUB', 'T1'))!.y1).toBe(270)
    // T3 à 539 : 380 + 110 = 490
    expect(traceLien(CARTE_LIVREE, lien('HUB', 'T3'))!.y1).toBe(490)
  })

  it('un module plus large que haut part de son centre', () => {
    const t = traceLien(CARTE_LIVREE, lien('T1', 'N'))!
    expect(t.y1).toBe(231)
    expect(t.y2).toBe(385)
  })

  it('rend null quand un bout manque', () => {
    expect(traceLien(CARTE_LIVREE, { de: 'HUB', vers: 'NULLEPART', type: 'main' })).toBeNull()
  })
})

describe('les conditions d’accès — un orbe acquis, pas l’état du corps', () => {
  it('lit « orbe == solidification »', () => {
    expect(litCondition('orbe == solidification')).toEqual({ orbe: 'solidification' })
    expect(litCondition("orbe == 'vaporisation'")).toEqual({ orbe: 'vaporisation' })
    expect(litCondition(null)).toBeNull()
  })

  it('une condition illisible FERME la porte au lieu de l’ouvrir', () => {
    expect(litCondition('temp > 3')!.orbe.startsWith('?')).toBe(true)
    expect(litCondition('etatJoueur == glace')!.orbe.startsWith('?')).toBe(true)
  })

  it('les orbes sont les transformations et les états du cycle des mémoires', () => {
    const ids = ORBES.map((o) => o.id)
    for (const id of ['fusion', 'solidification', 'vaporisation', 'sublimation', 'solide', 'liquide', 'gaz', 'plasma'])
      expect(ids).toContain(id)
  })

  it('la transfo glace demande l’orbe de solidification, et rien d’autre', () => {
    const glace = CARTE_LIVREE.liens.find((l) => l.type === 'glace')!
    expect(orbeRequis(CARTE_LIVREE, glace, [])).toBe('solidification')
    expect(orbeRequis(CARTE_LIVREE, glace, ['vaporisation'])).toBe('solidification')
    expect(orbeRequis(CARTE_LIVREE, glace, ['solidification'])).toBeNull()
    expect(orbeRequis(CARTE_LIVREE, glace, new Set(['solidification']))).toBeNull()
    const libre = CARTE_LIVREE.liens.find((l) => l.type === 'main')!
    expect(orbeRequis(CARTE_LIVREE, libre, [])).toBeNull()
  })

  it('un orbe inconnu dans une condition est une erreur de fond', () => {
    const c = cloneCarte(CARTE_LIVREE)
    c.typesLiens.glace.condition = 'orbe == teleportation'
    expect(verifieCarte(c).some((v) => v.niveau === 'erreur' && v.message.includes('teleportation'))).toBe(true)
  })
})

describe('biomesDeCarte — la liste que la planche et l’éditeur proposent', () => {
  it('un biome par code, seuls les modules à salles, sans doublon', () => {
    expect(biomesDeCarte(CARTE_LIVREE).map((b) => b.code)).toEqual([
      'T1', 'T2', 'T3', 'S1', 'S2', 'S3', 'S1b', 'S3b', 'OBS',
    ])
    const c = cloneCarte(CARTE_LIVREE)
    c.modules[1].biome = 'T2' // T1 rejoint le biome de T2
    c.modules[5].niveaux = 0 // S1 n’a plus de salle
    expect(biomesDeCarte(c).map((b) => b.code)).toEqual(['T2', 'T3', 'S2', 'S3', 'S1b', 'S3b', 'OBS'])
    expect(biomesDeCarte(c)[0].nom).toBe('TRANSFO GLACE') // le premier qui le porte nomme le biome
  })
})

describe('un module est un biome — niveaux et trajet', () => {
  it('la carte livrée compte ses niveaux : 9 salles au plus court, 10 par une cache', () => {
    // HUB(0) → T2(3) → N(0) → S2(3) → ECO(0) → OBS(3) = 9 ; par une cache
    // (1 salle), 10 : l'orbe se paie d'une salle, jamais d'un cul-de-sac
    expect(longueursTrajet(CARTE_LIVREE)).toEqual({ min: 9, max: 10 })
    const c = cloneCarte(CARTE_LIVREE)
    c.modules[8].niveaux = 0 // la cache nord devient une halte
    c.modules[11].niveaux = 0
    expect(longueursTrajet(c)).toEqual({ min: 9, max: 9 })
  })

  it('un module d’où l’objectif est hors de portée se signale — le joueur reviendra sur ses pas', () => {
    // la carte livrée n'a plus de cul-de-sac : chaque cache mène à l'observatoire
    expect(verifieCarte(CARTE_LIVREE).some((x) => x.message.includes('hors de portée'))).toBe(false)
    const c = cloneCarte(CARTE_LIVREE)
    c.liens = c.liens.filter((l) => !(l.de === 'S1b' && l.vers === 'OBS'))
    const v = verifieCarte(c).filter((x) => x.message.includes('hors de portée'))
    expect(v.map((x) => x.module)).toEqual(['S1b'])
    expect(v.every((x) => x.niveau === 'attention')).toBe(true)
  })

  it('un objectif inatteignable n’a pas de trajet', () => {
    const c = cloneCarte(CARTE_LIVREE)
    c.liens = c.liens.filter((l) => l.vers !== 'OBS')
    expect(longueursTrajet(c)).toBeNull()
  })

  it('des niveaux sans code de biome, ou négatifs, se signalent', () => {
    const c = cloneCarte(CARTE_LIVREE)
    c.modules[1].biome = ''
    expect(verifieCarte(c).some((v) => v.niveau === 'attention' && v.module === 'T1' && v.message.includes('biome'))).toBe(true)
    c.modules[1].niveaux = -2
    expect(verifieCarte(c).some((v) => v.niveau === 'erreur' && v.module === 'T1')).toBe(true)
  })
})

describe('cheminLePlusCourt et routesVersObjectif — la matière des règles de route', () => {
  it('le chemin va du départ à l’arrivée, pesé en niveaux, et s’accorde avec plusCourtVers', () => {
    const chemin = cheminLePlusCourt(CARTE_LIVREE, 'HUB', 'OBS')!
    expect(chemin[0]).toBe('HUB')
    expect(chemin[chemin.length - 1]).toBe('OBS')
    expect(longueurRoute(CARTE_LIVREE, chemin.slice(1))).toBe(plusCourtVers(CARTE_LIVREE, 'HUB', 'OBS'))
    expect(cheminLePlusCourt(CARTE_LIVREE, 'OBS', 'OBS')).toEqual(['OBS'])
    expect(cheminLePlusCourt(CARTE_LIVREE, 'OBS', 'HUB')).toBeNull()
    expect(cheminLePlusCourt(CARTE_LIVREE, 'X', 'OBS')).toBeNull()
  })

  it('énumère les routes simples du départ à l’objectif, et les mesure', () => {
    const routes = routesVersObjectif(CARTE_LIVREE)
    expect(routes.length).toBeGreaterThan(0)
    for (const r of routes) {
      expect(r[0]).toBe('HUB')
      expect(r[r.length - 1]).toBe('OBS')
      expect(new Set(r).size).toBe(r.length) // simple : aucun module deux fois
    }
    const lt = longueursTrajet(CARTE_LIVREE)!
    expect(Math.min(...routes.map((r) => longueurRoute(CARTE_LIVREE, r)))).toBe(lt.min)
    expect(Math.max(...routes.map((r) => longueurRoute(CARTE_LIVREE, r)))).toBe(lt.max)
    // un objectif coupé du reste : aucune route
    const c = cloneCarte(CARTE_LIVREE)
    c.liens = c.liens.filter((l) => l.vers !== 'OBS')
    expect(routesVersObjectif(c)).toEqual([])
    // la borne tient une carte en plat de nouilles
    expect(routesVersObjectif(CARTE_LIVREE, 1)).toHaveLength(1)
  })

  it('les haltes sont les natures sans salle où l’on s’arrête', () => {
    expect(HALTES).toEqual(['economat', 'repos'])
    expect(estHalte({ type: 'economat' })).toBe(true)
    expect(estHalte({ type: 'combat' })).toBe(false)
  })
})

describe('couleurTemperature — l’échelle par seuils', () => {
  it('suit les seuils du JSON dans l’ordre', () => {
    const c = CARTE_LIVREE
    expect(couleurTemperature(c, -25)).toBe('#a7ddf5')
    expect(couleurTemperature(c, 0)).toBe('#a7ddf5')
    expect(couleurTemperature(c, 18)).toBe('#63b7e6')
    expect(couleurTemperature(c, 40)).toBe('#f2c98e')
    expect(couleurTemperature(c, 72)).toBe('#e0685c')
  })

  it('retombe sur « sinon » quand aucun seuil ne prend', () => {
    const c = cloneCarte(CARTE_LIVREE)
    c.regles.temperatureCouleur = { '<0': '#111', sinon: '#222' }
    expect(couleurTemperature(c, 5)).toBe('#222')
  })
})

describe('les routes', () => {
  it('depuis le HUB, trois coursives ; depuis une cache, la route continue', () => {
    expect(liensDepuis(CARTE_LIVREE, 'HUB').map((l) => l.vers)).toEqual(['T1', 'T2', 'T3'])
    expect(liensDepuis(CARTE_LIVREE, 'S1b').map((l) => l.vers)).toEqual(['OBS'])
  })

  it('tout est atteignable depuis le départ', () => {
    const vus = accessibles(CARTE_LIVREE, 'HUB')
    expect(vus.size).toBe(13)
  })

  it('les trois secteurs sont à distance égale de l’observatoire, une halte différente sur chaque route', () => {
    // le contrat du §9.3 : sortir hors protocole ne raccourcit pas le
    // parcours, il le déplace — trois secteurs, six salles chacun jusqu'au bout
    for (const s of ['S1', 'S2', 'S3']) expect(plusCourtVers(CARTE_LIVREE, s, 'OBS')).toBe(3)
    expect(liensDepuis(CARTE_LIVREE, 'S1').map((l) => l.vers)).toEqual(['S1b', 'ECO'])
    expect(liensDepuis(CARTE_LIVREE, 'S2').map((l) => l.vers)).toEqual(['ECO', 'REP'])
    expect(liensDepuis(CARTE_LIVREE, 'S3').map((l) => l.vers)).toEqual(['REP', 'S3b'])
    // les haltes n'ont pas de salle ; les secteurs du bord portent le cran
    expect(CARTE_LIVREE.modules.filter(estHalte).map((m) => `${m.id}:${m.niveaux}`)).toEqual(['ECO:0', 'REP:0'])
    expect(CARTE_LIVREE.modules.filter((m) => m.cran > 0).map((m) => m.id)).toEqual(['S1', 'S3'])
  })
})

describe('verifieCarte — les défauts de fond', () => {
  it('signale un lien vers un module inconnu, et un module isolé', () => {
    const c = cloneCarte(CARTE_LIVREE)
    c.liens.push({ de: 'OBS', vers: 'X', type: 'main' })
    c.modules.push({ ...c.modules[5], id: 'ILE', x: 1400, y: 100 })
    const v = verifieCarte(c)
    expect(v.some((x) => x.niveau === 'erreur' && /« X » inconnu/.test(x.message))).toBe(true)
    expect(v.some((x) => x.niveau === 'attention' && /ILE n’est atteignable/.test(x.message))).toBe(true)
  })

  it('refuse un objectif qu’aucune route n’atteint', () => {
    const c = cloneCarte(CARTE_LIVREE)
    c.liens = c.liens.filter((l) => l.vers !== 'OBS')
    expect(verifieCarte(c).some((x) => /OBS est inatteignable/.test(x.message))).toBe(true)
  })

  it('signale deux modules qui se chevauchent, et un identifiant double', () => {
    const c = cloneCarte(CARTE_LIVREE)
    c.modules[6].x = c.modules[5].x
    c.modules[6].y = c.modules[5].y
    c.modules[7].id = 'S1'
    const v = verifieCarte(c)
    expect(v.some((x) => /se chevauchent/.test(x.message))).toBe(true)
    expect(v.some((x) => x.niveau === 'erreur' && /« S1 » est porté par 2/.test(x.message))).toBe(true)
  })
})
