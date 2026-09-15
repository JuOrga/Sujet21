import { describe, expect, it } from 'vitest'
import { aleaDeGraine } from './voie'
import {
  ditEffet,
  ESSENCE_PLANCHER,
  EVENEMENTS,
  evenementParId,
  offresDe,
  resoutChoix,
  tireEvenement,
  type EtatJoueur,
} from './evenements'

const riche: EtatJoueur = {
  bonbonne: 0.5,
  cap: 6,
  vies: 1,
  viesMax: 3,
  essence: 1,
  orbeAPrendre: true,
  inconnuALire: true,
}

describe('le catalogue des rencontres', () => {
  it('chaque événement est jouable : un titre, du lore, au moins deux offres, chacune avec une issue', () => {
    expect(EVENEMENTS.length).toBeGreaterThanOrEqual(8)
    const ids = EVENEMENTS.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const ev of EVENEMENTS) {
      expect(ev.titre.length).toBeGreaterThan(3)
      expect(ev.lieu.length).toBeGreaterThan(10)
      expect(ev.texte.length).toBeGreaterThan(80) // du lore, pas une étiquette
      expect(ev.choix.length).toBeGreaterThanOrEqual(2)
      for (const c of ev.choix) {
        expect(c.libelle.length).toBeGreaterThan(2)
        expect(c.detail.length).toBeGreaterThan(3)
        expect(c.issues.length).toBeGreaterThanOrEqual(1)
        for (const i of c.issues) {
          expect(i.poids).toBeGreaterThan(0)
          expect(i.texte.length).toBeGreaterThan(10)
          expect(i.effets.length).toBeGreaterThanOrEqual(1)
        }
      }
    }
    expect(evenementParId('condenseur')?.titre).toBe('LE CONDENSEUR')
    expect(evenementParId('inexistant')).toBeUndefined()
  })

  it('un sacrifice ne descend jamais sous le plancher d’essence : sous le plancher, l’offre se ferme', () => {
    // toute offre qui rogne l'essence doit se déclarer impossible quand la
    // run n'a plus de quoi payer — sinon un sacrifice de trop fait une impasse
    for (const ev of EVENEMENTS)
      for (const c of ev.choix) {
        const perte = c.issues
          .flatMap((i) => i.effets)
          .filter((e): e is { quoi: 'essence'; part: number } => e.quoi === 'essence')
          .reduce((t, e) => Math.min(t, e.part), 0)
        if (perte >= 0) continue
        const aupied: EtatJoueur = { ...riche, essence: ESSENCE_PLANCHER }
        const offre = offresDe(ev, aupied).find((o) => o.choix === c)!
        // une perte SÛRE se ferme au plancher ; une perte tirée au sort est
        // bornée à l'application (appliqueEffets) — on exige la fermeture
        // dès qu'elle est certaine
        if (c.issues.every((i) => i.effets.some((e) => e.quoi === 'essence')))
          expect(offre.possible).toBe(false)
      }
  })

  it('une offre qui ne donnerait rien est fermée : la réserve pleine, les vies au plafond', () => {
    const plein: EtatJoueur = { ...riche, bonbonne: 6, vies: 3, orbeAPrendre: false, inconnuALire: false }
    const condenseur = offresDe(evenementParId('condenseur')!, plein)
    expect(condenseur[0].possible).toBe(false)
    expect(condenseur[1].possible).toBe(false)
    expect(condenseur[2].possible).toBe(true) // passer se peut toujours
    const bac = offresDe(evenementParId('charnier')!, plein)
    expect(bac[1].possible).toBe(false) // rendre au cycle : plus de place
    const terminal = offresDe(evenementParId('terminal')!, plein)
    expect(terminal[1].possible).toBe(false) // plus rien à révéler
    // et tout s'ouvre sur une run qui a de la place
    expect(offresDe(evenementParId('condenseur')!, riche).every((o) => o.possible)).toBe(true)
  })
})

describe('tireEvenement — une rencontre à la fois', () => {
  it('ne repropose pas une rencontre déjà vue, et se remplit à nouveau quand tout est vu', () => {
    const vus: string[] = []
    for (let i = 0; i < EVENEMENTS.length; i++) {
      const ev = tireEvenement(vus, aleaDeGraine(`t${i}`))
      expect(vus).not.toContain(ev.id)
      vus.push(ev.id)
    }
    expect(vus).toHaveLength(EVENEMENTS.length)
    // chapeau vide : on retire dans le tout, jamais rien
    expect(tireEvenement(vus, () => 0.5)).toBeDefined()
  })

  it('la même graine donne la même rencontre — la descente du jour est commune à tous les postes', () => {
    const a = tireEvenement([], aleaDeGraine('2026-09-15@ev4'))
    const b = tireEvenement([], aleaDeGraine('2026-09-15@ev4'))
    expect(a.id).toBe(b.id)
  })
})

describe('resoutChoix — le pari', () => {
  it('une offre sûre ne consomme aucun hasard', () => {
    let tirages = 0
    const alea = (): number => {
      tirages++
      return 0.5
    }
    const sur = evenementParId('charnier')!.choix[0]
    expect(sur.issues).toHaveLength(1)
    expect(resoutChoix(sur, alea)).toBe(sur.issues[0])
    expect(tirages).toBe(0)
  })

  it('une offre à plusieurs issues les tire au poids', () => {
    const pari = evenementParId('condenseur')!.choix[1] // 3 contre 2
    expect(resoutChoix(pari, () => 0).texte).toBe(pari.issues[0].texte)
    expect(resoutChoix(pari, () => 0.99).texte).toBe(pari.issues[1].texte)
    // sur mille tirages, la part suit les poids à quelques points près
    let bons = 0
    const alea = aleaDeGraine('pari')
    for (let i = 0; i < 1000; i++) if (resoutChoix(pari, alea) === pari.issues[0]) bons++
    expect(bons / 1000).toBeGreaterThan(0.5)
    expect(bons / 1000).toBeLessThan(0.7)
  })
})

describe('ditEffet — chaque effet se lit en une ligne', () => {
  it('dit le signe et l’unité', () => {
    expect(ditEffet({ quoi: 'bonbonne', litres: 2 })).toBe('réserve +2,0 L')
    expect(ditEffet({ quoi: 'condensat', cl: -30 })).toBe('condensat -30 cL')
    expect(ditEffet({ quoi: 'memoire', n: 18 })).toBe('mémoire +18')
    expect(ditEffet({ quoi: 'essence', part: -0.12 })).toBe('essence maximale -12 %')
    expect(ditEffet({ quoi: 'instrument', bon: false })).toBe('une contrepartie embarquée')
    expect(ditEffet({ quoi: 'rien' })).toBe('rien')
  })

  it('tout effet du catalogue se dit — aucun ne sort vide', () => {
    for (const ev of EVENEMENTS)
      for (const c of ev.choix)
        for (const i of c.issues)
          for (const e of i.effets) expect(ditEffet(e).length).toBeGreaterThan(2)
  })
})
