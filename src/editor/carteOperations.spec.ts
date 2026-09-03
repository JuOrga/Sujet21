import { describe, expect, it } from 'vitest'
import { CARTE_LIVREE, cloneCarte, moduleParId } from '../game/carteStation'
import {
  Historique,
  aimante,
  ajouteLien,
  ajouteModule,
  deplaceModule,
  identifiantLibre,
  inverseLien,
  modifieLien,
  poseChamp,
  redimensionneModule,
  renommeModule,
  supprimeLien,
  supprimeModule,
} from './carteOperations'

const carte = () => cloneCarte(CARTE_LIVREE)

describe('l’aimant de grille', () => {
  it('arrondit au pas, et à l’unité sans pas', () => {
    expect(aimante(13, 8)).toBe(16)
    expect(aimante(11, 8)).toBe(8)
    expect(aimante(11.4, 0)).toBe(11)
  })
})

describe('déplacer et redimensionner', () => {
  it('déplace le centre, aimanté, sans sortir de la scène', () => {
    const c = carte()
    expect(deplaceModule(c, 'T2', 513, 390, 8)).toBe(true)
    expect(moduleParId(c, 'T2')).toMatchObject({ x: 512, y: 392 })
    deplaceModule(c, 'T2', -50, 9000, 8)
    expect(moduleParId(c, 'T2')).toMatchObject({ x: 0, y: 804 })
    expect(deplaceModule(c, 'X', 0, 0, 8)).toBe(false)
  })

  it('tient le coin opposé fixe, et ne descend pas sous la taille minimale', () => {
    const c = carte()
    const o = { x: 507, y: 385, w: 136, h: 136 } // T2 : de 439 à 575
    redimensionneModule(c, 'T2', 'se', o, 40, -8, 8)
    const m = moduleParId(c, 'T2')!
    // le coin nord-ouest (439, 317) n'a pas bougé
    expect(m.x - m.w / 2).toBe(439)
    expect(m.y - m.h / 2).toBe(317)
    // le coin tenu, lui, s'aimante à la grille : 615 → 616, 445 → 448
    expect(m.x + m.w / 2).toBe(616)
    expect(m.y + m.h / 2).toBe(448)
    // tirer le coin au-delà du coin opposé : la taille s'arrête au minimum
    redimensionneModule(c, 'T2', 'nw', o, 500, 500, 8)
    expect(moduleParId(c, 'T2')!.w).toBe(32)
    expect(moduleParId(c, 'T2')!.h).toBe(32)
  })

  it('recalcule depuis l’origine du geste : l’aimant ne dérive pas', () => {
    const c = carte()
    const o = { x: 507, y: 385, w: 136, h: 136 }
    for (let i = 1; i <= 30; i++) redimensionneModule(c, 'T2', 'se', o, i * 0.5, 0, 8)
    // 15 unités au total : le bord droit 575 va à 592 (aimanté à 8), pas plus loin
    expect(moduleParId(c, 'T2')!.x + moduleParId(c, 'T2')!.w / 2).toBe(592)
  })
})

describe('ajouter, dupliquer, supprimer, renommer', () => {
  it('donne un identifiant libre et la zone du voisin le plus proche', () => {
    const c = carte()
    expect(identifiantLibre(c)).toBe('M1')
    expect(identifiantLibre(c, 'T2')).toBe('T2-2')
    const m = ajouteModule(c, 1030, 400, 8)
    expect(m.id).toBe('M1')
    expect(m.zone).toBe(3) // à côté de l'observatoire
    expect(c.modules).toHaveLength(12)
    expect(ajouteModule(c, 0, 0, 8).id).toBe('M2')
  })

  it('supprimer un module emporte ses coursives', () => {
    const c = carte()
    expect(supprimeModule(c, 'N')).toBe(true)
    expect(c.modules.some((m) => m.id === 'N')).toBe(false)
    expect(c.liens.some((l) => l.de === 'N' || l.vers === 'N')).toBe(false)
    expect(c.liens).toHaveLength(6)
    expect(supprimeModule(c, 'N')).toBe(false)
  })

  it('renommer suit partout : coursives, décor, règles', () => {
    const c = carte()
    expect(renommeModule(c, 'HUB', 'MEDUSE')).toBeNull()
    expect(moduleParId(c, 'HUB')).toBeUndefined()
    expect(c.liens.filter((l) => l.de === 'MEDUSE')).toHaveLength(3)
    expect(c.decor.find((d) => d.id === 'arc')!.ancrage).toBe('MEDUSE')
    expect(c.regles.depart).toBe('MEDUSE')
  })

  it('renommer refuse le vide, le doublon et les caractères hors nom', () => {
    const c = carte()
    expect(renommeModule(c, 'T1', '')).toMatch(/vide/)
    expect(renommeModule(c, 'T1', 'T2')).toMatch(/déjà pris/)
    expect(renommeModule(c, 'T1', 'T 1')).toMatch(/lettres/)
    expect(renommeModule(c, 'T1', 'T1')).toBeNull()
    expect(moduleParId(c, 'T1')).toBeDefined()
  })
})

describe('les coursives', () => {
  it('trace, refuse le doublon, le lien sur soi et le bout inconnu', () => {
    const c = carte()
    expect(ajouteLien(c, 'S1b', 'OBS', 'alt')).toBe(12)
    expect(ajouteLien(c, 'S1b', 'OBS', 'main')).toBe(-1) // même départ, même arrivée
    expect(ajouteLien(c, 'OBS', 'S1b', 'alt')).toBe(13) // l'inverse est un autre lien
    expect(ajouteLien(c, 'OBS', 'OBS', 'main')).toBe(-1)
    expect(ajouteLien(c, 'OBS', 'X', 'main')).toBe(-1)
    expect(ajouteLien(c, 'OBS', 'S3b', 'teleport')).toBe(-1)
  })

  it('inverse le sens, sauf si l’inverse existe déjà', () => {
    const c = carte()
    expect(inverseLien(c, 0)).toBe(true)
    expect(c.liens[0]).toEqual({ de: 'T1', vers: 'HUB', type: 'glace' })
    ajouteLien(c, 'HUB', 'T1', 'main')
    expect(inverseLien(c, 0)).toBe(false)
  })

  it('modifie un bout ou le type, en refusant ce qui ferait doublon', () => {
    const c = carte()
    expect(modifieLien(c, 3, { type: 'main' })).toBe(true) // T1 → N
    expect(modifieLien(c, 3, { vers: 'T1' })).toBe(false) // sur soi
    expect(modifieLien(c, 3, { de: 'T2' })).toBe(false) // T2 → N existe
    expect(supprimeLien(c, 3)).toBe(true)
    expect(c.liens).toHaveLength(11)
    expect(supprimeLien(c, 40)).toBe(false)
  })
})

describe('poseChamp — un chemin, une valeur', () => {
  it('garde le type en place : un nombre reste un nombre', () => {
    const c = carte()
    expect(poseChamp(c, 'modules.1.temp', '-30')).toBe(true)
    expect(c.modules[1].temp).toBe(-30)
    expect(poseChamp(c, 'modules.1.temp', 'froid')).toBe(false)
    expect(c.modules[1].temp).toBe(-30)
    expect(poseChamp(c, 'modules.1.nom', 'CRYO')).toBe(true)
    expect(c.modules[1].nom).toBe('CRYO')
  })

  it('une condition vide redevient un passage libre', () => {
    const c = carte()
    expect(poseChamp(c, 'typesLiens.glace.condition', '  ')).toBe(true)
    expect(c.typesLiens.glace.condition).toBeNull()
    expect(poseChamp(c, 'typesLiens.main.condition', 'etatJoueur == vapeur')).toBe(true)
    expect(c.typesLiens.main.condition).toBe('etatJoueur == vapeur')
  })

  it('refuse un chemin qui n’existe pas', () => {
    const c = carte()
    expect(poseChamp(c, 'modules.99.nom', 'x')).toBe(false)
    expect(poseChamp(c, 'modules.1.inconnu', 'x')).toBe(false)
    expect(poseChamp(c, 'regles.etatsJoueur', 'x')).toBe(false)
  })
})

describe('l’historique', () => {
  it('annule et rétablit, une copie par geste', () => {
    const h = new Historique(3)
    const c = carte()
    h.pousse(c)
    deplaceModule(c, 'T2', 600, 400, 0)
    expect(h.peutAnnuler).toBe(true)
    const avant = h.annule(c)!
    expect(moduleParId(avant, 'T2')!.x).toBe(507)
    expect(h.peutRetablir).toBe(true)
    const apres = h.retablit(avant)!
    expect(moduleParId(apres, 'T2')!.x).toBe(600)
    expect(h.annule(apres)).not.toBeNull()
    expect(h.annule(apres)).toBeNull()
  })

  it('un nouveau geste efface le futur, et la pile est bornée', () => {
    const h = new Historique(2)
    const c = carte()
    h.pousse(c)
    h.pousse(c)
    h.pousse(c)
    expect(h.annule(c)).not.toBeNull()
    expect(h.annule(c)).not.toBeNull()
    expect(h.annule(c)).toBeNull()
    h.retablit(c)
    h.pousse(c)
    expect(h.peutRetablir).toBe(false)
  })
})
