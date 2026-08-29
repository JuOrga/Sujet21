import { beforeEach, describe, expect, it } from 'vitest'
import {
  INSTRUMENTS,
  SEUIL_MAJEUR,
  SEUIL_NOTABLE,
  aContrepartie,
  calibreInstrument,
  famillesInstrument,
  poidsInstrument,
  tirageInstruments,
} from './instruments'
import {
  LEVIERS,
  forceEffet,
  neutre,
  sensEffet,
  valeurProposee,
  type Effet,
} from './leviers'
import { catalogueRecompenses, poseRecompense, videAtelier } from './recompenses'

// LE RANG D'UNE CARTE SE DÉDUIT, IL NE SE SAISIT PAS.
// Aucune carte ne porte d'étiquette « rare » : la puissance se lit dans
// l'écart de ses leviers à leur valeur neutre. Conséquence directe : une
// carte fabriquée à l'atelier — ou importée d'un export — se range toute
// seule, sans un champ de plus à remplir.

function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

const parId = (id: string) => {
  const d = INSTRUMENTS.find((x) => x.id === id)
  if (!d) throw new Error(`carte introuvable : ${id}`)
  return d
}

describe('Le sens d’un effet — gain ou facture', () => {
  it('lit le SENS du levier, pas le signe de la valeur', () => {
    // `sasPortee` monte quand ça va bien (bon: +1)…
    expect(sensEffet({ levier: 'sasPortee', valeur: 1.8 })).toBe(1)
    expect(sensEffet({ levier: 'sasPortee', valeur: 0.7 })).toBe(-1)
    // …`visee` descend quand ça va bien (bon: -1). Même forme « ×0,x »,
    // sens inverse : c'est exactement le piège que cette fonction lève.
    expect(sensEffet({ levier: 'visee', valeur: 0.5 })).toBe(1)
    expect(sensEffet({ levier: 'visee', valeur: 1.4 })).toBe(-1)
    // un levier ADD se lit pareil
    expect(sensEffet({ levier: 'dashs', valeur: 1 })).toBe(1)
    expect(sensEffet({ levier: 'dashs', valeur: -1 })).toBe(-1)
  })

  it('l’intensité se rapporte à la plage du levier, jamais à l’unité brute', () => {
    // « +1 dash » sur une plage de 2 pèse comme « portée ×2 » sur 1,5 :
    // c'est ce qui permet de comparer des leviers sans commune mesure
    expect(forceEffet({ levier: 'sasPortee', valeur: 1 })).toBe(0)
    expect(forceEffet({ levier: 'sasPortee', valeur: 2.5 })).toBeCloseTo(1)
    expect(forceEffet({ levier: 'visee', valeur: 0.3 })).toBeCloseTo(1)
    const doux = forceEffet({ levier: 'sasPortee', valeur: 1.3 })
    const fort = forceEffet({ levier: 'sasPortee', valeur: 2.2 })
    expect(doux).toBeGreaterThan(0)
    expect(doux).toBeLessThan(fort)
    for (const d of INSTRUMENTS)
      for (const e of d.effets) {
        expect(forceEffet(e)).toBeGreaterThanOrEqual(0)
        expect(forceEffet(e)).toBeLessThanOrEqual(1)
      }
  })
})

describe('Le calibre d’une carte', () => {
  it('range les cartes livrées sur les trois rangs', () => {
    expect(calibreInstrument(parId('filtre-a-condensat'))).toBe('commun')
    expect(calibreInstrument(parId('tamis-fin'))).toBe('notable')
    expect(calibreInstrument(parId('lentille-de-visee'))).toBe('majeur')
    // les seuils sont ordonnés, et le rang suit le poids
    expect(SEUIL_NOTABLE).toBeLessThan(SEUIL_MAJEUR)
    for (const d of INSTRUMENTS) {
      const p = poidsInstrument(d)
      const c = calibreInstrument(d)
      expect(c).toBe(
        p >= SEUIL_MAJEUR ? 'majeur' : p >= SEUIL_NOTABLE ? 'notable' : 'commun',
      )
    }
  })

  it('le PRIX d’une carte à contrepartie ne la fait pas grossir', () => {
    // le poids ne compte que les gains : ajouter une facture à une carte ne
    // doit jamais la promouvoir d'un rang — sinon la contrepartie devient
    // un truc pour paraître rare
    const gain: Effet = { levier: 'sasPortee', valeur: 2.4 }
    const prix: Effet = { levier: 'visee', valeur: 1.5 }
    const seul = { id: 'a', nom: 'A', desc: '', icone: '✦', effets: [gain] }
    const paye = { id: 'b', nom: 'B', desc: '', icone: '✧', effets: [gain, prix] }
    expect(poidsInstrument(paye)).toBeCloseTo(poidsInstrument(seul))
    expect(calibreInstrument(paye)).toBe(calibreInstrument(seul))
  })

  it('la contrepartie se détecte sans drapeau en dur', () => {
    // les trois cartes du catalogue qui donnent ET prennent
    const ctr = INSTRUMENTS.filter(aContrepartie).map((d) => d.id)
    expect(ctr).toContain('sur-regime')
    expect(ctr).toContain('ration-de-survie')
    expect(ctr).toContain('oeilleres')
    // une carte à effet unique n'en est jamais une
    expect(aContrepartie(parId('buse-calibree'))).toBe(false)
    // et toute carte à contrepartie porte bien les deux sens
    for (const d of INSTRUMENTS.filter(aContrepartie)) {
      expect(d.effets.some((e) => sensEffet(e) > 0)).toBe(true)
      expect(d.effets.some((e) => sensEffet(e) < 0)).toBe(true)
    }
  })

  it('les familles se déduisent des leviers, sans doublon', () => {
    expect(famillesInstrument(parId('buse-calibree'))).toEqual(['etats'])
    expect(famillesInstrument(parId('sur-regime'))).toEqual(['etats', 'collecte'])
    for (const d of INSTRUMENTS) {
      const f = famillesInstrument(d)
      expect(f.length).toBeGreaterThan(0)
      expect(new Set(f).size).toBe(f.length)
    }
  })
})

describe('Une carte d’atelier va jusqu’au tirage', () => {
  beforeEach(() => videAtelier())

  it('se tire, se calibre et se raconte comme une carte gravée', () => {
    expect(
      poseRecompense({
        nom: 'Voile de tension',
        icone: '🪺',
        desc: 'Le sas aspire de bien plus loin.',
        effets: [{ levier: 'sasPortee', valeur: 2.4 }],
      }),
    ).toEqual([])
    const cat = catalogueRecompenses()
    const faite = cat.find((c) => c.id === 'voile-de-tension')
    expect(faite).toBeDefined()
    expect(calibreInstrument(faite!)).toBe('majeur')
    // et elle sort bel et bien du bassin : le tirage reçoit le catalogue
    // COMPLET — c'est ce qui rend l'atelier jouable et pas décoratif
    let vue = false
    for (let seed = 1; seed < 120 && !vue; seed++)
      vue = tirageInstruments(lcg(seed), [], 3, 3, 3, cat).some(
        (c) => c.id === 'voile-de-tension',
      )
    expect(vue).toBe(true)
  })
})

describe('La valeur proposée quand un levier arrive sur une carte', () => {
  it('tombe dans la plage, sur le pas, du bon côté — et jamais au neutre', () => {
    // l'atelier propose cette valeur au concepteur : une carte qui naît
    // inerte (valeur neutre) ou hors du pas (« 1,5 échantillon de
    // secours ») est une carte que la validation refusera aussitôt
    for (const l of LEVIERS) {
      const v = valeurProposee(l)
      const n = neutre(l)
      expect(v).toBeGreaterThanOrEqual(l.min)
      expect(v).toBeLessThanOrEqual(l.max)
      expect(v).not.toBe(n)
      // sur le pas, à la poussière de virgule flottante près
      const marches = (v - n) / l.pas
      expect(Math.abs(marches - Math.round(marches))).toBeLessThan(0.01)
      // et du côté qui AVANTAGE le joueur
      expect(sensEffet({ levier: l.id, valeur: v })).toBe(1)
    }
  })
})
