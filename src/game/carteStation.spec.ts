import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CARTE_LIVREE,
  accessibles,
  cloneCarte,
  couleurTemperature,
  etatRequis,
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

  it('est la carte du concepteur : 11 modules, 12 coursives, 4 zones', () => {
    expect(CARTE_LIVREE.modules).toHaveLength(11)
    expect(CARTE_LIVREE.liens).toHaveLength(12)
    expect(CARTE_LIVREE.zones).toHaveLength(4)
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

describe('les conditions d’accès', () => {
  it('lit « etatJoueur == glace »', () => {
    expect(litCondition('etatJoueur == glace')).toEqual({ etat: 'glace' })
    expect(litCondition("etatJoueur == 'vapeur'")).toEqual({ etat: 'vapeur' })
    expect(litCondition(null)).toBeNull()
  })

  it('une condition illisible FERME la porte au lieu de l’ouvrir', () => {
    expect(litCondition('temp > 3')!.etat.startsWith('?')).toBe(true)
  })

  it('la transfo glace demande l’état glace, et rien d’autre', () => {
    const glace = CARTE_LIVREE.liens.find((l) => l.type === 'glace')!
    expect(etatRequis(CARTE_LIVREE, glace, 'eau')).toBe('glace')
    expect(etatRequis(CARTE_LIVREE, glace, 'glace')).toBeNull()
    const libre = CARTE_LIVREE.liens.find((l) => l.type === 'main')!
    expect(etatRequis(CARTE_LIVREE, libre, 'eau')).toBeNull()
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
  it('depuis le HUB, trois coursives ; depuis un cul-de-sac, aucune', () => {
    expect(liensDepuis(CARTE_LIVREE, 'HUB').map((l) => l.vers)).toEqual(['T1', 'T2', 'T3'])
    expect(liensDepuis(CARTE_LIVREE, 'S1b')).toEqual([])
  })

  it('tout est atteignable depuis le départ', () => {
    const vus = accessibles(CARTE_LIVREE, 'HUB')
    expect(vus.size).toBe(11)
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
