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
  REVELATIONS,
  moduleRevele,
  verifieRoutes,
  ECART_ROUTES_MAX,
  PAS_ROUTES_MAX,
  cloneCarte,
  couleurTemperature,
  orbeRequis,
  biomeEffectif,
  biomesDeCarte,
  mecaniqueDuBiome,
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

  it('est la carte à cinq biomes, rien que des biomes : 12 modules, 21 coursives, 5 zones', () => {
    expect(CARTE_LIVREE.modules).toHaveLength(12)
    expect(CARTE_LIVREE.liens).toHaveLength(21)
    expect(CARTE_LIVREE.zones).toHaveLength(5)
    // les haltes vivent dans la mini-carte : aucune sur la grande carte
    expect(CARTE_LIVREE.modules.some((m) => estHalte(m) || m.type === 'inconnu' || m.type === 'coffre')).toBe(false)
    expect(CARTE_LIVREE.regles.depart).toBe('HUB')
    expect(CARTE_LIVREE.regles.objectif).toBe('OBS')
    // CINQ BIOMES, PAS DOUZE (le concepteur, 16/09) : la voie froide, la
    // voie tempérée, la voie chaude, l'antichambre, l'observatoire — et
    // chacun a sa fiche, avec la mécanique qu'il favorise au tissage
    expect(biomesDeCarte(CARTE_LIVREE).map((b) => b.code)).toEqual(['cryo', 'tempere', 'chaud', 'antichambre', 'observatoire'])
    expect(CARTE_LIVREE.modules.filter((m) => m.biome === 'cryo').map((m) => m.id)).toEqual(['T1', 'C1', 'P1'])
    expect(CARTE_LIVREE.modules.filter((m) => m.biome === 'chaud').map((m) => m.id)).toEqual(['T3', 'C3', 'P3'])
    expect(mecaniqueDuBiome(CARTE_LIVREE, 'cryo')).toBe(1)
    expect(mecaniqueDuBiome(CARTE_LIVREE, 'chaud')).toBe(2)
    expect(mecaniqueDuBiome(CARTE_LIVREE, 'tempere')).toBeNull()
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
    expect(t.y1).toBe(402)
    expect(t.d).toBe('M263 402 L500 402')
  })

  it('borne la sortie à ±110 du centre du hub (h/2 − 36 pour un fût de 292)', () => {
    // T1 est à y=210, trop haut : la sortie se cale à 402 − 110 = 292
    expect(traceLien(CARTE_LIVREE, lien('HUB', 'T1'))!.y1).toBe(292)
    // T3 à 594 : 402 + 110 = 512
    expect(traceLien(CARTE_LIVREE, lien('HUB', 'T3'))!.y1).toBe(512)
  })

  it('un module plus large que haut part de son centre', () => {
    const t = traceLien(CARTE_LIVREE, lien('T1', 'C2'))!
    expect(t.y1).toBe(210)
    expect(t.y2).toBe(402)
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
  it('un biome par code, dans l’ordre des modules, seuls les modules à salles, sans doublon', () => {
    expect(biomesDeCarte(CARTE_LIVREE).map((b) => `${b.code}:${b.nom}`)).toEqual([
      'cryo:CRYO', 'tempere:TEMPÉRÉ', 'chaud:CHAUD', 'antichambre:ANTICHAMBRE', 'observatoire:OBSERVATOIRE',
    ])
    const c = cloneCarte(CARTE_LIVREE)
    c.modules[1].biome = 'tempere' // T1 rejoint la voie tempérée
    c.modules.find((m) => m.id === 'C1')!.niveaux = 0 // le cryostat n’a plus de salle
    expect(biomesDeCarte(c).map((b) => b.code)).toEqual(['tempere', 'chaud', 'cryo', 'antichambre', 'observatoire'])
    // sans fiche, le premier module qui porte le biome le nomme
    c.modules.find((m) => m.id === 'P1')!.biome = 'abysses'
    expect(biomesDeCarte(c).find((b) => b.code === 'abysses')!.nom).toBe('PUITS FROID')
    expect(verifieCarte(c).some((v) => v.niveau === 'attention' && v.module === 'P1' && v.message.includes('fiche'))).toBe(true)
  })

  it('biomeEffectif : un tableau marqué d’un code de module suit le biome de ce module', () => {
    // les tableaux d'avant le regroupement portaient « C1 » : ils jouent en cryo
    expect(biomeEffectif(CARTE_LIVREE, 'C1')).toBe('cryo')
    expect(biomeEffectif(CARTE_LIVREE, 'P3')).toBe('chaud')
    expect(biomeEffectif(CARTE_LIVREE, 'cryo')).toBe('cryo')
    expect(biomeEffectif(CARTE_LIVREE, '')).toBe('')
    expect(biomeEffectif(CARTE_LIVREE, undefined)).toBe('')
    expect(biomeEffectif(CARTE_LIVREE, 'inconnu')).toBe('inconnu')
  })
})

describe('un module est un biome — niveaux et trajet', () => {
  it('la carte livrée compte ses niveaux : 30 salles, 27 par la voie courte', () => {
    // HUB(0) T(6) C(6) P(6) ANTI(6) OBS(6) = 30 ; les SOUTES (P2) n'ont que
    // trois salles : les routes qui y passent font 27 — la voie courte se
    // paie en récompenses et en rampe, pas en salles (le concepteur, 16/09)
    expect(longueursTrajet(CARTE_LIVREE)).toEqual({ min: 27, max: 30 })
    expect(routesVersObjectif(CARTE_LIVREE)).toHaveLength(17)
    const c = cloneCarte(CARTE_LIVREE)
    c.modules.find((m) => m.id === 'C2')!.niveaux = 7
    expect(longueursTrajet(c)).toEqual({ min: 27, max: 31 }) // les routes du bord par les soutes gardent 27
  })

  it('un module d’où l’objectif est hors de portée se signale — le joueur reviendra sur ses pas', () => {
    // la carte livrée n'a plus de cul-de-sac : toute halte continue
    expect(verifieCarte(CARTE_LIVREE).some((x) => x.message.includes('hors de portée'))).toBe(false)
    const c = cloneCarte(CARTE_LIVREE)
    c.liens = c.liens.filter((l) => l.de !== 'P1')
    const v = verifieCarte(c).filter((x) => x.message.includes('hors de portée'))
    expect(v.map((x) => x.module)).toEqual(['P1'])
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
    // à salles égales, la voie sans confinement passe devant : la route
    // projetée depuis le nœud ne traverse aucun module sous cran
    const n1 = cheminLePlusCourt(CARTE_LIVREE, 'T2', 'OBS')!
    expect(n1[0]).toBe('T2')
    expect(n1[n1.length - 1]).toBe('OBS')
    // l'antichambre est sous cran sur toute route : c'est le seul qu'on ne peut pas éviter
    expect(n1.reduce((t, id) => t + (CARTE_LIVREE.modules.find((m) => m.id === id)?.cran ?? 0), 0)).toBe(1)
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
    expect(HALTES).toEqual(['economat', 'repos', 'don'])
    expect(estHalte({ type: 'economat' })).toBe(true)
    expect(estHalte({ type: 'combat' })).toBe(false)
  })

  it('moduleRevele — le « ? » sous sa nature : le nom la dit, une halte perd ses salles, un combat prend un cran', () => {
    // la carte livrée n'a plus de « ? » (les haltes vivent dans la mini-carte) : on en pose un
    const inc = { ...CARTE_LIVREE.modules[5], id: 'INC', nom: '?', type: 'inconnu' as const, niveaux: 1, cran: 0 }
    expect(inc.type).toBe('inconnu')
    expect(REVELATIONS).toEqual(['economat', 'repos', 'don', 'coffre', 'combat'])
    const eco = moduleRevele(CARTE_LIVREE, inc, 'economat')
    expect(eco.type).toBe('economat')
    expect(eco.nom).toBe('? — ÉCONOMAT')
    expect(eco.niveaux).toBe(0)
    const combat = moduleRevele(CARTE_LIVREE, inc, 'combat')
    expect(combat.niveaux).toBe(1)
    expect(combat.cran).toBe(1) // surchauffé : un cran de plus que le module
    expect(moduleRevele(CARTE_LIVREE, inc, 'coffre').cran).toBe(0)
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
    expect(liensDepuis(CARTE_LIVREE, 'C1').map((l) => l.vers)).toEqual(['P1', 'P2'])
  })

  it('tout est atteignable depuis le départ', () => {
    const vus = accessibles(CARTE_LIVREE, 'HUB')
    expect(vus.size).toBe(12)
  })

  it('les trois actes sont à distance équivalente de l’objectif, et chaque module ouvre sur deux ou trois du suivant', () => {
    // le contrat du §9.3 : sortir hors protocole ne raccourcit pas le
    // parcours, il le déplace — trois voies par acte ; la seule exception
    // est la VOIE COURTE des soutes (trois salles), qui se paie ailleurs.
    // plusCourtVers ne compte pas les salles du module où l'on EST, et
    // passe par les soutes quand il le peut
    expect(plusCourtVers(CARTE_LIVREE, 'HUB', 'OBS')).toBe(27)
    for (const t of ['T1', 'T2', 'T3']) expect(plusCourtVers(CARTE_LIVREE, t, 'OBS')).toBe(21)
    for (const s of ['C1', 'C2', 'C3']) expect(plusCourtVers(CARTE_LIVREE, s, 'OBS')).toBe(15)
    for (const s of ['P1', 'P3']) expect(plusCourtVers(CARTE_LIVREE, s, 'OBS')).toBe(12)
    expect(plusCourtVers(CARTE_LIVREE, 'P2', 'OBS')).toBe(12) // ANTI + OBS : la voie courte est derrière soi
    // chaque module d'acte ouvre sur DEUX haltes, et deux voisins n'offrent
    // jamais la même paire : la halte se choisit autant que le secteur
    // dès la première porte, la route diverge : chaque transformateur
    // ouvre sur deux coursives, jamais la même paire que son voisin, et
    // la voie du milieu ouvre sur les trois profondeurs
    expect(liensDepuis(CARTE_LIVREE, 'T1').map((l) => l.vers)).toEqual(['C1', 'C2'])
    expect(liensDepuis(CARTE_LIVREE, 'T2').map((l) => l.vers)).toEqual(['C1', 'C2', 'C3'])
    expect(liensDepuis(CARTE_LIVREE, 'T3').map((l) => l.vers)).toEqual(['C2', 'C3'])
    expect(liensDepuis(CARTE_LIVREE, 'C2').map((l) => l.vers)).toEqual(['P1', 'P2', 'P3'])
    // LA SYMÉTRIE EST CASSÉE (le concepteur, 16/09) : la voie froide paie
    // TÔT (le cryostat, cran 1 et sa cache, puis rien), la voie chaude paie
    // TARD et GROS (rien à la chaufferie, le réacteur à cran 2 avec sa
    // cache), la voie du milieu paie en SALLES (les soutes, trois salles) ;
    // et le terminal est sous confinement pour tout le monde — jamais deux
    // crans d'affilée, l'antichambre respire
    expect(CARTE_LIVREE.modules.filter((m) => m.cran > 0).map((m) => `${m.id}:${m.cran}`)).toEqual(['C1:1', 'P3:2', 'OBS:1'])
    expect(CARTE_LIVREE.modules.filter((m) => m.orbe).map((m) => `${m.id}:${m.orbe}`)).toEqual(['C1:sublimation', 'P3:condensation'])
    expect(CARTE_LIVREE.modules.find((m) => m.id === 'P2')!.niveaux).toBe(3)
  })
})

describe('routesVersObjectif — la marche a un budget', () => {
  it('un amas qui boucle sans atteindre l’objectif rend vite, sans figer', () => {
    // douze modules liés dans les deux sens, l'objectif pas raccordé : les
    // chemins simples sont en nombre factoriel — la vérification tourne à
    // chaque geste de l'éditeur, elle ne doit jamais y passer la nuit
    const c = cloneCarte(CARTE_LIVREE)
    const ids = c.modules.filter((m) => m.id !== 'HUB' && m.id !== 'OBS').map((m) => m.id)
    c.liens = [{ de: 'HUB', vers: ids[0], type: 'main' }]
    for (const a of ids) for (const b of ids) if (a !== b) c.liens.push({ de: a, vers: b, type: 'alt' })
    const t0 = performance.now()
    expect(routesVersObjectif(c)).toEqual([])
    expect(performance.now() - t0).toBeLessThan(2000)
    expect(PAS_ROUTES_MAX).toBe(20000)
  })
})

describe('verifieRoutes — les règles de route, à la Slay the Spire', () => {
  it('la carte livrée les respecte toutes', () => {
    expect(verifieRoutes(CARTE_LIVREE)).toEqual([])
  })

  it('une seule route vers l’objectif : le plan n’offre aucun choix', () => {
    const c = cloneCarte(CARTE_LIVREE)
    // on ne laisse qu'une voie par acte : une seule route mène au bout
    c.liens = c.liens.filter((l) => !['T1', 'T3', 'C1', 'C3', 'P1', 'P3'].includes(l.vers))
    const v = verifieRoutes(c)
    expect(v.some((x) => /une seule route/.test(x.message))).toBe(true)
  })

  it('des routes à distance inéquivalente se signalent (§9.3) — jusqu’à trois salles d’écart, non', () => {
    const c = cloneCarte(CARTE_LIVREE)
    c.modules.find((m) => m.id === 'C2')!.niveaux = 1 // CONDUITS perd cinq salles : 22 par les soutes
    expect(verifieRoutes(c).some((x) => /distance équivalente.*de 22 à 30/.test(x.message))).toBe(true)
    // la carte livrée va de 27 (la voie courte) à 30 : dans la tolérance
    expect(verifieRoutes(CARTE_LIVREE).some((x) => /distance équivalente/.test(x.message))).toBe(false)
    expect(ECART_ROUTES_MAX).toBe(3)
  })

  it('deux confinements supérieurs d’affilée se signalent, la paire nommée', () => {
    const c = cloneCarte(CARTE_LIVREE)
    c.modules.find((m) => m.id === 'ANTI')!.cran = 1 // l'antichambre reprend un cran
    const v = verifieRoutes(c).filter((x) => /d’affilée/.test(x.message))
    // prise en sandwich : le réacteur avant, le terminal après
    expect(v.map((x) => x.module).sort()).toEqual(['ANTI', 'OBS'])
    expect(v.some((x) => x.message.includes('P3 → ANTI'))).toBe(true)
    expect(v.some((x) => x.message.includes('ANTI → OBS'))).toBe(true)
  })

  it('une halte avec des salles est une erreur de fond', () => {
    const c = cloneCarte(CARTE_LIVREE)
    c.modules.push({ ...c.modules[5], id: 'ECO', type: 'economat', niveaux: 2, x: 1800, y: 100, biome: '' })
    const v = verifieCarte(c)
    expect(v.some((x) => x.niveau === 'erreur' && x.module === 'ECO' && /halte/.test(x.message))).toBe(true)
    // sans réclamer de biome : une halte n'en a pas
    expect(v.some((x) => x.module === 'ECO' && /biome/.test(x.message))).toBe(false)
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
    c.modules[7].id = c.modules[5].id
    const v = verifieCarte(c)
    expect(v.some((x) => /se chevauchent/.test(x.message))).toBe(true)
    expect(v.some((x) => x.niveau === 'erreur' && /est porté par 2 modules/.test(x.message))).toBe(true)
  })
})
