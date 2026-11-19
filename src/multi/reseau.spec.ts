import { describe, expect, it } from 'vitest'
import {
  ATTR_CORPS,
  ATTR_ORPHELINE,
  ATTR_PROPRIO,
  OCTETS_PAR_PARTICULE,
  PARTICULES_PAR_MORCEAU,
  VITESSE_MAX,
  attributs,
  decodeCommande,
  decodeParticules,
  encodeCommande,
  encodeEtat,
  litEnteteEtat,
  particulesVides,
  type CorpsTrame,
} from './trame'
import { ALPHABET_CODE, LONGUEUR_CODE, litCodePartie, tireCode } from './code'
import { adresseRelais } from './relais'
import { CAPACITE, DEPARTS, Hote, Miroir, SALLE, VOLUME_DEPART } from './partie'

const UN_CORPS: CorpsTrame = {
  compte: 812,
  prets: 14,
  base: 900,
  x: 1234.5,
  y: 678.25,
  disperse: false,
  pousse: true,
  viseeX: 3000,
  viseeY: 100,
}

describe('trame — l’état', () => {
  it('une particule fait l’aller-retour à moins d’une unité, sa vitesse à moins de 24 u/s', () => {
    const p = particulesVides(8)
    p.n = 3
    p.x.set([0, 1919.3, 3840])
    p.y.set([2160, 1080.7, 0])
    p.vx.set([1400, -37.5, 0])
    p.vy.set([-1400, 12, 2999])
    p.attr.set([attributs(0, true, 0), attributs(1, false, 2), attributs(4, false, 0)])
    const morceaux = encodeEtat(7, 1.5, SALLE, [UN_CORPS], p)
    expect(morceaux.length).toBe(1)
    const e = litEnteteEtat(morceaux[0], SALLE)!
    expect(e.seq).toBe(7)
    expect(e.tSim).toBeCloseTo(1.5, 5)
    expect(e.total).toBe(3)
    const r = particulesVides(8)
    decodeParticules(morceaux[0], e, SALLE, r)
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(r.x[i] - p.x[i])).toBeLessThan(1)
      expect(Math.abs(r.y[i] - p.y[i])).toBeLessThan(1)
      expect(Math.abs(r.vx[i] - p.vx[i])).toBeLessThan(VITESSE_MAX / 127)
      expect(Math.abs(r.vy[i] - p.vy[i])).toBeLessThan(VITESSE_MAX / 127)
      expect(r.attr[i]).toBe(p.attr[i])
    }
  })

  it('les attributs disent le propriétaire, le corps et l’orpheline', () => {
    const a = attributs(1, true, 0)
    expect(a & ATTR_PROPRIO).toBe(1)
    expect(a & ATTR_CORPS).not.toBe(0)
    expect(a & ATTR_ORPHELINE).toBe(0)
    expect(attributs(255, false, 0) & ATTR_ORPHELINE).not.toBe(0)
  })

  it('l’état d’un corps fait l’aller-retour, visée comprise', () => {
    const p = particulesVides(1)
    const e = litEnteteEtat(encodeEtat(1, 0, SALLE, [UN_CORPS, { ...UN_CORPS, disperse: true, pousse: false }], p)[0], SALLE)!
    expect(e.corps.length).toBe(2)
    expect(e.corps[0].compte).toBe(812)
    expect(e.corps[0].prets).toBe(14)
    expect(e.corps[0].base).toBe(900)
    expect(e.corps[0].x).toBeCloseTo(1234.5, 3)
    expect(e.corps[0].pousse).toBe(true)
    expect(e.corps[0].disperse).toBe(false)
    expect(Math.abs(e.corps[0].viseeX - 3000)).toBeLessThan(1)
    expect(Math.abs(e.corps[0].viseeY - 100)).toBeLessThan(1)
    expect(e.corps[1].disperse).toBe(true)
    expect(e.corps[1].pousse).toBe(false)
  })

  it('une image de 1 800 particules part en deux morceaux de moins de 16 Ko', () => {
    const p = particulesVides(CAPACITE)
    p.n = 1800
    const morceaux = encodeEtat(1, 0, SALLE, [UN_CORPS, UN_CORPS], p)
    expect(morceaux.length).toBe(2)
    for (const m of morceaux) expect(m.length).toBeLessThan(16 * 1024)
    const total = morceaux.reduce((s, m) => s + m.length, 0)
    // le poids d'une image : c'est lui, fois la cadence, qui fait le débit
    expect(total).toBeLessThan(1800 * OCTETS_PAR_PARTICULE + 200)
    expect(litEnteteEtat(morceaux[1], SALLE)!.debut).toBe(PARTICULES_PAR_MORCEAU)
  })

  it('ce qui n’est pas une trame d’état est refusé sans jeter', () => {
    expect(litEnteteEtat(new Uint8Array(0), SALLE)).toBeNull()
    expect(litEnteteEtat(new Uint8Array([9, 9, 9, 9]), SALLE)).toBeNull()
    const bonne = encodeEtat(1, 0, SALLE, [UN_CORPS], particulesVides(4))[0]
    const autreVersion = bonne.slice()
    autreVersion[1] = 99
    expect(litEnteteEtat(autreVersion, SALLE)).toBeNull()
    expect(litEnteteEtat(bonne.subarray(0, bonne.length - 3), SALLE)).toBeNull()
    expect(litEnteteEtat(encodeCommande(1, { pousse: true, x: 1, y: 2 }), SALLE)).toBeNull()
  })
})

describe('trame — la commande', () => {
  it('fait l’aller-retour', () => {
    const r = decodeCommande(encodeCommande(42, { pousse: true, x: 1234.5, y: -8 }))!
    expect(r.seq).toBe(42)
    expect(r.commande).toEqual({ pousse: true, x: 1234.5, y: -8 })
  })

  it('refuse ce qui n’est pas un nombre : rien de tel n’entre dans le solveur', () => {
    expect(decodeCommande(encodeCommande(1, { pousse: true, x: Number.NaN, y: 0 }))).toBeNull()
    expect(decodeCommande(encodeCommande(1, { pousse: true, x: 0, y: Infinity }))).toBeNull()
    expect(decodeCommande(new Uint8Array(4))).toBeNull()
  })
})

describe('le code de partie', () => {
  it('un code tiré fait cinq caractères de l’alphabet, sans lettre qui se confonde', () => {
    for (let k = 0; k < 200; k++) {
      const code = tireCode()
      expect(code).toHaveLength(LONGUEUR_CODE)
      for (const c of code) expect(ALPHABET_CODE).toContain(c)
      expect(code).not.toMatch(/[IO01]/)
    }
    // les bornes du hasard ne sortent pas de l'alphabet
    expect(tireCode(() => 0)).toBe('AAAAA')
    expect(tireCode(() => 0.999999)).toBe('99999')
  })

  it('un code tapé est remis au propre : minuscules, espaces et tirets tolérés', () => {
    expect(litCodePartie('k7q2m')).toEqual({ ok: true, code: 'K7Q2M' })
    expect(litCodePartie('  K7-Q2 M \n')).toEqual({ ok: true, code: 'K7Q2M' })
  })

  it('refuse le vide, la mauvaise longueur et le caractère impossible — en disant pourquoi', () => {
    const vide = litCodePartie('   ')
    expect(vide.ok).toBe(false)
    const court = litCodePartie('K7Q')
    expect(court.ok).toBe(false)
    if (!court.ok) expect(court.raison).toContain('3')
    // 0 et O n'existent dans aucun code : c'est une faute de recopie
    const zero = litCodePartie('K0Q2M')
    expect(zero.ok).toBe(false)
    if (!zero.ok) expect(zero.raison).toContain('0')
  })

  it('le relais est celui du projet, sauf désigné en local — un lien piégé ne le détourne pas', () => {
    const enLigne = adresseRelais('')
    // un déploiement du projet du jeu, et rien d'autre
    expect(enLigne).toMatch(/^wss:\/\/sujet21-[a-z0-9]+-julianamets-projects\.vercel\.app\/ws$/)
    expect(adresseRelais('?dev&multi=K7Q2M')).toBe(enLigne)
    expect(adresseRelais('?relais=ws://localhost:9100/ws')).toBe('ws://localhost:9100/ws')
    expect(adresseRelais('?relais=ws://127.0.0.1:9100/ws')).toBe('ws://127.0.0.1:9100/ws')
    for (const piege of ['wss://mechant.example/ws', 'ws://localhost.mechant.example/ws', 'ws://mechant.example/?x=ws://localhost/']) {
      expect(adresseRelais('?relais=' + encodeURIComponent(piege))).toBe(enLigne)
    }
  })
})

describe('la partie — de l’hôte au miroir', () => {
  it('l’hôte fait naître deux corps face à face', () => {
    const h = new Hote()
    const c = h.corps()
    expect(c.length).toBe(2)
    expect(c[0].compte).toBe(VOLUME_DEPART)
    expect(c[1].compte).toBe(VOLUME_DEPART)
    expect(c[0].x).toBeCloseTo(DEPARTS[0].x, 0)
    expect(c[1].x).toBeCloseTo(DEPARTS[1].x, 0)
  })

  it('la commande de l’invité meut SON corps, pas celui de l’hôte', () => {
    const h = new Hote()
    // l'invité (joueur 1) pousse vers la droite : son corps part à gauche
    h.commande(1, decodeCommande(encodeCommande(1, { pousse: true, x: SALLE.maxX, y: DEPARTS[1].y }))!.commande)
    for (let k = 0; k < 60; k++) h.avance(1 / 60, Infinity)
    expect(h.sim.corps[1].stats.velX).toBeLessThan(-10)
    expect(Math.abs(h.sim.corps[0].stats.velX)).toBeLessThan(0.5)
    expect(h.corps()[1].pousse).toBe(true)
    expect(h.corps()[0].pousse).toBe(false)
  })

  it('une visée hors de la salle y est ramenée', () => {
    const h = new Hote()
    h.commande(0, { pousse: true, x: -1e9, y: 1e9 })
    expect(h.commandes[0].x).toBe(SALLE.minX)
    expect(h.commandes[0].y).toBe(SALLE.maxY)
  })

  it('le miroir voit ce que l’hôte simule, à moins d’une unité', () => {
    const h = new Hote()
    const m = new Miroir()
    h.commande(0, { pousse: true, x: SALLE.minX, y: 300 })
    for (let k = 0; k < 30; k++) h.avance(1 / 60, Infinity)
    let complete = false
    for (const morceau of h.image()) complete = m.recoit(morceau, 1000) || complete
    expect(complete).toBe(true)
    const vu = m.vue(1000) // à l'instant de la réception : rien à prolonger
    const vrai = h.vue()
    expect(vu.n).toBe(vrai.n)
    let pire = 0
    for (let i = 0; i < vu.n; i++) {
      pire = Math.max(pire, Math.abs(vu.x[i] - vrai.x[i]), Math.abs(vu.y[i] - vrai.y[i]))
      expect(vu.attr[i]).toBe(vrai.attr[i])
    }
    expect(pire).toBeLessThan(1)
    expect(m.corps[0].compte).toBe(h.sim.corps[0].playerCount)
    expect(m.corps[1].compte).toBe(VOLUME_DEPART)
  })

  it('entre deux images, le miroir prolonge le mouvement — et s’arrête si la liaison se tait', () => {
    const h = new Hote()
    const m = new Miroir()
    h.commande(0, { pousse: true, x: SALLE.minX, y: DEPARTS[0].y })
    for (let k = 0; k < 120; k++) h.avance(1 / 60, Infinity)
    for (const morceau of h.image()) m.recoit(morceau, 0)
    // une goutte en vol : la plus rapide de l'image
    const a0 = m.vue(0)
    let rapide = 0
    for (let i = 1; i < a0.n; i++) if (Math.abs(a0.vx[i]) > Math.abs(a0.vx[rapide])) rapide = i
    const x0 = a0.x[rapide]
    const vx = a0.vx[rapide]
    expect(Math.abs(vx)).toBeGreaterThan(200)
    const x33 = m.vue(33).x[rapide]
    expect(x33 - x0).toBeCloseTo(vx * 0.033, 0)
    // dix secondes de silence : la goutte n'a pas traversé la salle
    const x10s = m.vue(10_000).x[rapide]
    expect(Math.abs(x10s - x0)).toBeLessThanOrEqual(Math.abs(vx) * 0.12 + 1)
  })

  it('une image en retard est jetée, une image trouée est abandonnée', () => {
    const h = new Hote()
    const m = new Miroir()
    const premiere = h.image() // deux morceaux (1 800 particules)
    h.avance(1 / 60, Infinity)
    const seconde = h.image()
    expect(premiere.length).toBe(2)
    // le premier morceau de la première image arrive seul, puis la seconde
    expect(m.recoit(premiere[0], 0)).toBe(false)
    expect(m.recoit(seconde[0], 10)).toBe(false)
    expect(m.recoit(seconde[1], 10)).toBe(true)
    expect(m.perdues).toBe(1)
    // le morceau manquant de la première arrive enfin : trop tard
    expect(m.recoit(premiere[1], 20)).toBe(false)
    expect(m.recues).toBe(1)
  })

  it('recommencer rend les deux corps entiers à leur départ', () => {
    const h = new Hote()
    h.commande(0, { pousse: true, x: SALLE.minX, y: 0 })
    for (let k = 0; k < 120; k++) h.avance(1 / 60, Infinity)
    expect(h.sim.corps[0].playerCount).toBeLessThan(VOLUME_DEPART)
    h.recommence()
    expect(h.sim.corps[0].playerCount).toBe(VOLUME_DEPART)
    expect(h.sim.corps[1].playerCount).toBe(VOLUME_DEPART)
    expect(h.tSim).toBe(0)
    expect(h.commandes[0].pousse).toBe(false)
    expect(h.corps()[0].x).toBeCloseTo(DEPARTS[0].x, 0)
  })
})
