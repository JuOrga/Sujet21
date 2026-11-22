import { describe, expect, it } from 'vitest'
import { commandeManette, defileCaractere, litManette, litMenu, nouvelEtatManette, nouvelEtatMenu, voisinMenu, type PadLu } from './manetteMulti'
import { ALPHABET_CODE } from './code'
import { Hote } from './partie'
import { MODE_HOCKEY, decodeCommande, encodeCommande } from './trame'

/** Une fausse manette : le stick gauche, et les boutons tenus. */
const pad = (ax: number, ay: number, ...tenus: number[]): PadLu => ({
  axes: [ax, ay, 0, 0],
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: tenus.includes(i), value: tenus.includes(i) ? 1 : 0 })),
})
const A = 0
const LB = 4
const LT = 6
const RT = 7
const B = 1
const SELECT = 8
const START = 9
const HAUT = 12
const DROITE = 15

describe('manette du multi — la lecture', () => {
  it('le stick donne la direction et l’inclinaison, au-delà de la zone morte', () => {
    const e = nouvelEtatManette()
    litManette(pad(0.1, 0.05), e)
    expect(e.force).toBe(0)
    expect(e.vie).toBe(false)
    litManette(pad(0, -1), e)
    expect(e.force).toBe(1)
    expect(e.dirX).toBeCloseTo(0, 6)
    expect(e.dirY).toBeCloseTo(-1, 6)
    expect(e.vie).toBe(true)
  })

  it('relâché, le stick garde sa dernière direction', () => {
    const e = nouvelEtatManette()
    litManette(pad(-0.8, 0), e)
    litManette(pad(0, 0), e)
    expect(e.force).toBe(0)
    expect(e.dirX).toBeCloseTo(-1, 6)
  })

  it('A ou RT poussent, LT ou LB ouvrent', () => {
    const e = nouvelEtatManette()
    for (const b of [A, RT]) {
      litManette(pad(0, 0, b), e)
      expect(e.pousse).toBe(true)
      expect(e.ouvert).toBe(false)
    }
    for (const b of [LT, LB]) {
      litManette(pad(0, 0, b), e)
      expect(e.ouvert).toBe(true)
      expect(e.pousse).toBe(false)
    }
  })

  it('B ou RB : le dash, tenu tant que le bouton l’est (l’hôte en lit l’appui)', () => {
    const e = nouvelEtatManette()
    for (const b of [1, 5]) {
      litManette(pad(1, 0, b), e)
      expect(e.dash).toBe(true)
      expect(commandeManette(e, 0, 0).dash).toBe(true)
    }
    litManette(pad(1, 0), e)
    expect(commandeManette(e, 0, 0).dash).toBe(false)
  })

  it('Start recommence UNE fois par appui, même tenu', () => {
    const e = nouvelEtatManette()
    litManette(pad(0, 0, START), e)
    expect(e.recommence).toBe(true)
    litManette(pad(0, 0, START), e)
    expect(e.recommence).toBe(false)
    litManette(pad(0, 0), e)
    litManette(pad(0, 0, START), e)
    expect(e.recommence).toBe(true)
  })

  it('débranchée en pleine poussée : plus rien n’est tenu', () => {
    const e = nouvelEtatManette()
    litManette(pad(1, 0, A, LT), e)
    litManette(null, e)
    expect(e.connectee).toBe(false)
    expect(e.pousse).toBe(false)
    expect(e.ouvert).toBe(false)
    expect(e.force).toBe(0)
  })
})

describe('manette du multi — la commande', () => {
  it('on vise HORS de son corps, du côté du stick, et la visée dit où aller', () => {
    const e = nouvelEtatManette()
    litManette(pad(1, 0, A), e)
    const c = commandeManette(e, 1000, 500)
    expect(c.aller).toBe(true)
    expect(c.pousse).toBe(true)
    expect(c.y).toBeCloseTo(500, 6)
    // au-delà du corps (~105 u de rayon) : sinon pousser rassemblerait
    expect(c.x - 1000).toBeGreaterThan(200)
  })

  it('stick au repos et A tenu : on vise son propre cœur — se rassembler', () => {
    const e = nouvelEtatManette()
    litManette(pad(0, 0, A), e)
    expect(commandeManette(e, 1000, 500)).toMatchObject({ pousse: true, x: 1000, y: 500 })
  })

  it('stick au repos, rien de tenu : on ne pousse pas, mais la visée reste où elle était', () => {
    const e = nouvelEtatManette()
    litManette(pad(0, 1), e)
    litManette(pad(0, 0), e)
    const c = commandeManette(e, 1000, 500)
    expect(c.pousse).toBe(false)
    expect(c.y - 500).toBeGreaterThan(200)
  })

  it('le sens « où aller » voyage dans la trame', () => {
    for (const aller of [true, false]) {
      const lu = decodeCommande(encodeCommande(3, { pousse: true, ouvert: false, x: 10, y: 20, aller }))!
      expect(lu.commande.aller).toBe(aller)
    }
  })
})

describe('manette du multi — chez l’hôte', () => {
  const pas = (h: Hote, n: number): void => {
    for (let s = 0; s < n; s++) h.avance(h.params.dt, 1e9)
  }

  it('pousser le stick à droite fait ALLER à droite ; à la souris, viser à droite fait aller à gauche', () => {
    const vitesse = (aller: boolean): number => {
      const h = new Hote(2)
      pas(h, 30)
      const c = h.sim.corps[0].stats
      for (let s = 0; s < 120; s++) {
        h.commande(0, { pousse: true, ouvert: false, x: c.centroidX + 300, y: c.centroidY, aller })
        pas(h, 1)
      }
      return h.sim.corps[0].stats.velX
    }
    expect(vitesse(true)).toBeGreaterThan(25)
    expect(vitesse(false)).toBeLessThan(-25)
  })

  it('au hockey, le palet part du côté où pointe le stick', () => {
    const h = new Hote(2, undefined, MODE_HOCKEY)
    pas(h, 60)
    // le décompte de l'engagement passé
    h.hockey!.decompte = 0
    pas(h, 1)
    const e = nouvelEtatManette()
    const commande = (p: PadLu): void => {
      litManette(p, e)
      const c = h.sim.corps[1].stats
      h.commande(1, commandeManette(e, c.centroidX, c.centroidY))
    }
    // LT tenu : le corps 1 s'ouvre, le palet lui arrive dessus
    h.sim.palet.vx = 600
    for (let s = 0; s < 360 && h.hockey!.tenuPar !== 1; s++) {
      commande(pad(0, 0, LT))
      pas(h, 1)
    }
    expect(h.hockey!.tenuPar).toBe(1)
    // le stick vers le HAUT, on tient, puis on relâche LT
    for (let s = 0; s < 150; s++) {
      commande(pad(0, -1, LT))
      pas(h, 1)
    }
    commande(pad(0, -1))
    pas(h, 1)
    expect(h.hockey!.tenuPar).toBe(-1)
    expect(h.sim.palet.vy).toBeLessThan(-1200)
    expect(Math.abs(h.sim.palet.vx)).toBeLessThan(200)
  })
})

describe('manette du multi — au salon', () => {
  it('Select quitte, une fois par appui', () => {
    const e = nouvelEtatManette()
    litManette(pad(0, 0, SELECT), e)
    expect(e.quitte).toBe(true)
    litManette(pad(0, 0, SELECT), e)
    expect(e.quitte).toBe(false)
  })

  it('le bouton encore tenu à l’ouverture du salon ne valide pas', () => {
    const e = nouvelEtatMenu()
    // on vient de valider MULTI sur l'accueil : A est toujours enfoncé
    expect(litMenu(pad(0, 0, A), e, 0).valide).toBe(false)
    expect(litMenu(pad(0, 0), e, 40).valide).toBe(false)
    expect(litMenu(pad(0, 0, A), e, 80).valide).toBe(true)
    expect(litMenu(pad(0, 0, A), e, 120).valide).toBe(false)
  })

  it('B revient en arrière', () => {
    const e = nouvelEtatMenu()
    litMenu(pad(0, 0), e, 0)
    expect(litMenu(pad(0, 0, B), e, 40).retour).toBe(true)
  })

  it('la croix donne un pas, puis se répète si on la tient', () => {
    const e = nouvelEtatMenu()
    expect(litMenu(pad(0, 0, DROITE), e, 0)).toMatchObject({ dx: 1, dy: 0 })
    expect(litMenu(pad(0, 0, DROITE), e, 200)).toMatchObject({ dx: 0, dy: 0 })
    expect(litMenu(pad(0, 0, DROITE), e, 400)).toMatchObject({ dx: 1 })
    expect(litMenu(pad(0, 0, DROITE), e, 460)).toMatchObject({ dx: 0 })
    expect(litMenu(pad(0, 0, DROITE), e, 540)).toMatchObject({ dx: 1 })
    expect(litMenu(pad(0, 0, HAUT), e, 560)).toMatchObject({ dx: 0, dy: -1 })
  })

  it('le stick vaut une croix, franchement incliné seulement', () => {
    const e = nouvelEtatMenu()
    expect(litMenu(pad(0.4, 0), e, 0)).toMatchObject({ dx: 0, dy: 0 })
    expect(litMenu(pad(0, 0.9), e, 40)).toMatchObject({ dx: 0, dy: 1 })
    expect(litMenu(pad(-0.9, 0.2), e, 80)).toMatchObject({ dx: -1, dy: 0 })
  })

  it('d’un bouton à l’autre : le plus proche du côté demandé, sur sa ligne d’abord', () => {
    // le salon : deux modes en haut, deux choix dessous, deux petits boutons en bas
    const boutons = [
      { x: 100, y: 100 }, { x: 300, y: 100 },
      { x: 100, y: 200 }, { x: 300, y: 200 },
      { x: 60, y: 280 }, { x: 180, y: 280 },
    ]
    expect(voisinMenu(boutons[0], boutons, 1, 0)).toBe(1)
    expect(voisinMenu(boutons[0], boutons, 0, 1)).toBe(2)
    expect(voisinMenu(boutons[3], boutons, -1, 0)).toBe(2)
    expect(voisinMenu(boutons[2], boutons, 0, 1)).toBe(4)
    // rien à gauche du premier : on reste où l'on est
    expect(voisinMenu(boutons[0], boutons, -1, 0)).toBe(-1)
  })

  it('le code se compose en faisant défiler l’alphabet des codes, qui boucle', () => {
    expect(defileCaractere(ALPHABET_CODE, 'A', 1)).toBe('B')
    expect(defileCaractere(ALPHABET_CODE, 'A', -1)).toBe('9')
    expect(defileCaractere(ALPHABET_CODE, '9', 1)).toBe('A')
    // ni I ni O n'existent dans un code : H mène à J
    expect(defileCaractere(ALPHABET_CODE, 'H', 1)).toBe('J')
    expect(defileCaractere(ALPHABET_CODE, '?', 1)).toBe('A')
  })
})
