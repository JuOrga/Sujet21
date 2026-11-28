import { describe, expect, it } from 'vitest'
import {
  BONBONNE_CAP,
  INSTRUMENTS,
  PALIERS_XP,
  PRIX_CARTE,
  TOUS_ETATS_OUVERTS,
  instrumentOuvert,
  paliersAtteints,
  prochainPalier,
  tirageInstruments,
  tirage,
  relanceTirage,
  remplaceBannie,
  gestesRestants,
  BANNISSEMENTS_PAR_RUN,
  RELANCES_PAR_RUN,
  type ContexteTirage,
} from './instruments'
import type { InstrumentDef } from './instruments'
import { LEVIERS } from './leviers'

// Générateur déterministe (LCG) : le tirage se rejoue à l'identique
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

describe('Instruments — le tirage de fin de salle', () => {
  it('propose au plus 3 cartes distinctes, tirées du bon bassin', () => {
    const cartes = tirageInstruments(lcg(7), [], 1, 3)
    expect(cartes.length).toBe(3)
    const ids = cartes.map((c) => c.id)
    expect(new Set(ids).size).toBe(3)
    for (const id of ids) expect(INSTRUMENTS.some((d) => d.id === id)).toBe(true)
  })

  it('un instrument déjà emporté ne revient pas — sauf les cartes de secours', () => {
    // TOUT le catalogue est en poche, sauf les cartes qui donnent une VIE
    // (celles-là ne s'emportent pas, elles se consomment) : il ne peut
    // donc rester qu'elles. Écrit ainsi, le test dit la RÈGLE et survit à
    // l'ajout de nouvelles cartes.
    const secours = INSTRUMENTS.filter((d) =>
      d.effets.some((e) => e.levier === 'vies'),
    ).map((d) => d.id)
    const tenus = INSTRUMENTS.map((d) => d.id).filter(
      (id) => !secours.includes(id),
    )
    expect(secours.length).toBeGreaterThan(0)
    for (let seed = 1; seed < 40; seed++) {
      const cartes = tirageInstruments(lcg(seed), tenus, 1, 3)
      expect(cartes.length).toBeGreaterThan(0)
      for (const c of cartes) expect(secours).toContain(c.id)
    }
  })

  it('le catalogue ne contient ni deux fois le même identifiant, ni deux fois la même icône', () => {
    // la carte se reconnaît à son glyphe dans le HUD des instruments : deux
    // cartes de même icône seraient indiscernables une fois embarquées
    const ids = INSTRUMENTS.map((d) => d.id)
    const icones = INSTRUMENTS.map((d) => d.icone)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(icones).size).toBe(icones.length)
    for (const d of INSTRUMENTS) {
      expect(d.nom.length).toBeGreaterThan(2)
      expect(d.desc.length).toBeGreaterThan(10)
    }
  })

  it('le CARNET DU SEMBLABLE ouvre une quatrième carte', () => {
    for (let seed = 1; seed < 40; seed++) {
      expect(tirageInstruments(lcg(seed), [], 1, 3, 4)).toHaveLength(4)
      expect(tirageInstruments(lcg(seed), [], 1, 3)).toHaveLength(3)
      // et les cartes restent distinctes
      const ids = tirageInstruments(lcg(seed), [], 1, 3, 4).map((c) => c.id)
      expect(new Set(ids).size).toBe(4)
    }
  })

  it('l’échantillon de secours ne paraît que si une vie manque', () => {
    for (let seed = 1; seed < 40; seed++) {
      const pleines = tirageInstruments(lcg(seed), [], 3, 3)
      expect(pleines.some((c) => c.id === 'echantillon-secours')).toBe(false)
    }
  })

  it('au moins une carte reste offerte, et les prix sont au tarif unique', () => {
    for (let seed = 1; seed < 200; seed++) {
      const cartes = tirageInstruments(lcg(seed), [], 1, 3)
      expect(cartes.some((c) => c.prix === 0)).toBe(true)
      for (const c of cartes) expect([0, PRIX_CARTE]).toContain(c.prix)
    }
  })

  it('des cartes payantes existent bel et bien (sur l’ensemble des graines)', () => {
    let payantes = 0
    for (let seed = 1; seed < 200; seed++) {
      payantes += tirageInstruments(lcg(seed), [], 1, 3).filter((c) => c.prix > 0).length
    }
    expect(payantes).toBeGreaterThan(50)
  })
})

// « NE PAS PROPOSER DES RÉCOMPENSES QUI CONCERNENT DES ÉTATS AUXQUELS ON
// N'A PAS ENCORE ACCÈS » (le concepteur, 22/11). Le tirage proposait les
// Patins de givre à un Sujet qui ne sait pas encore se figer, la Buse
// calibrée à qui ne sait pas se vaporiser : une carte morte, choisie pour
// rien. La règle se lit sur les leviers (leviers.ts, `etats`) ; ce tableau
// en fixe la lecture carte par carte, pour qu'un levier rangé de travers
// se voie ici, pas en partie.
describe('Instruments — pas de carte d’un état verrouillé', () => {
  const FERME = { glace: false, vapeur: false }
  const GLACE = { glace: true, vapeur: false }
  const VAPEUR = { glace: false, vapeur: true }
  const ATTENDU: Record<string, 'tout' | 'glace' | 'vapeur' | 'l’un'> = {
    'echantillon-secours': 'tout',
    'gaine-isolante': 'tout', // le froid de la coque mord aussi le liquide
    'buse-calibree': 'vapeur', // le dash est un geste de vapeur
    'aimant-rosee': 'vapeur', // la rosée rend la vapeur perdue
    'chambre-froide': 'glace',
    'peau-tendue': 'tout',
    'vanne-de-secours': 'tout',
    plastron: 'tout',
    tuyere: 'tout', // le jet est le geste du liquide, toujours là
    surpresseur: 'tout',
    detendeur: 'vapeur',
    'patins-de-givre': 'glace',
    'lentille-de-visee': 'vapeur',
    'gueule-ouverte': 'tout',
    'filtre-a-condensat': 'tout',
    ballast: 'tout',
    'bascule-rapide': 'l’un', // se figer OU se vaporiser
    'chambre-etanche': 'vapeur',
    'tamis-fin': 'vapeur',
    'semelles-polies': 'glace',
    eclateur: 'glace',
    'croc-du-sas': 'glace',
    'sur-regime': 'vapeur', // deux dashs qui ne partiraient pas : il ne resterait que le prix
    'ration-de-survie': 'tout',
    oeilleres: 'vapeur',
    'carnet-du-semblable': 'tout',
  }
  const ouverte = (d: InstrumentDef) => ({
    rien: instrumentOuvert(d, FERME),
    glace: instrumentOuvert(d, GLACE),
    vapeur: instrumentOuvert(d, VAPEUR),
    tout: instrumentOuvert(d, TOUS_ETATS_OUVERTS),
  })
  const LECTURE = {
    tout: { rien: true, glace: true, vapeur: true, tout: true },
    glace: { rien: false, glace: true, vapeur: false, tout: true },
    vapeur: { rien: false, glace: false, vapeur: true, tout: true },
    'l’un': { rien: false, glace: true, vapeur: true, tout: true },
  }

  it('range chaque carte livrée selon l’état dont elle dépend vraiment', () => {
    // le tableau couvre tout le catalogue : une carte neuve doit s'y ranger
    expect(Object.keys(ATTENDU).sort()).toEqual(INSTRUMENTS.map((d) => d.id).sort())
    for (const d of INSTRUMENTS) expect(ouverte(d), d.id).toEqual(LECTURE[ATTENDU[d.id]])
  })

  it('ne tire aucune carte d’un état fermé, quelles que soient la graine et la main', () => {
    for (const [ouverts, interdit] of [
      [FERME, ['glace', 'vapeur', 'l’un']],
      [GLACE, ['vapeur']],
      [VAPEUR, ['glace']],
    ] as const) {
      for (let seed = 1; seed < 300; seed++) {
        const cartes = tirageInstruments(lcg(seed), [], 1, 3, 4, INSTRUMENTS, ouverts)
        expect(cartes.length).toBe(4) // le bassin reste assez large pour un tirage plein
        for (const c of cartes) expect(interdit, `${c.id} (graine ${seed})`).not.toContain(ATTENDU[c.id])
      }
    }
  })

  it('tous les états ouverts : le tirage d’avant la règle, à l’identique', () => {
    for (let seed = 1; seed < 60; seed++)
      expect(tirageInstruments(lcg(seed), [], 1, 3, 3, INSTRUMENTS, TOUS_ETATS_OUVERTS)).toEqual(
        tirageInstruments(lcg(seed), [], 1, 3),
      )
  })

  it('range aussi une carte fabriquée à l’atelier, sur ses seuls leviers', () => {
    const faite: InstrumentDef = {
      id: 'perso-givre',
      nom: 'Givre maison',
      desc: '',
      icone: '🧊',
      perso: true,
      effets: [
        { levier: 'condensat', valeur: 1.2 },
        { levier: 'rebondGlace', valeur: 1.3 },
      ],
    }
    expect(instrumentOuvert(faite, VAPEUR)).toBe(false)
    expect(instrumentOuvert(faite, GLACE)).toBe(true)
    const cat = [...INSTRUMENTS, faite]
    for (let seed = 1; seed < 200; seed++)
      expect(tirageInstruments(lcg(seed), [], 1, 3, 4, cat, VAPEUR).map((c) => c.id)).not.toContain('perso-givre')
  })

  it('chaque levier dit ses états : la famille « états » ne suffit pas à les deviner', () => {
    // la réserve de dashs, la gaine isolante et la rosée sont rangées dans
    // la même famille ; seule la première et la dernière dépendent de la vapeur
    for (const l of LEVIERS) for (const e of l.etats) expect(['glace', 'vapeur'], l.id).toContain(e)
    expect(LEVIERS.find((l) => l.id === 'froid')?.etats).toEqual([])
    expect(LEVIERS.find((l) => l.id === 'dashs')?.etats).toEqual(['vapeur'])
  })
})

describe('Bonbonne et XP d’étalonnage', () => {
  it('les paliers se comptent et s’annoncent', () => {
    expect(paliersAtteints(0)).toBe(0)
    expect(paliersAtteints(3)).toBe(1)
    expect(paliersAtteints(9.9)).toBe(2)
    expect(paliersAtteints(10)).toBe(3)
    expect(prochainPalier(0)).toBe(3)
    expect(prochainPalier(3)).toBe(6)
    expect(prochainPalier(PALIERS_XP[PALIERS_XP.length - 1])).toBe(null)
  })
  it('la capacité de la bonbonne est bien posée', () => {
    expect(BONBONNE_CAP).toBeGreaterThan(0)
  })
})

describe('Bannir et relancer — les deux gestes de la table du tirage', () => {
  const ctx = (bannies: string[] = [], tenus: string[] = [], vies = 3): ContexteTirage => ({
    tenus,
    vies,
    viesMax: 3,
    nbCartes: 3,
    catalogue: INSTRUMENTS,
    ouverts: TOUS_ETATS_OUVERTS,
    bannies,
  })

  it('une carte bannie ne se propose plus, sur aucun tirage de la run', () => {
    const banni = INSTRUMENTS.find((d) => !d.contrepartie && !d.effets.some((e) => e.levier === 'vies'))!.id
    for (let seed = 1; seed < 300; seed++)
      expect(tirage(lcg(seed), ctx([banni])).map((c) => c.id)).not.toContain(banni)
  })

  it('bannir l’échantillon de secours tient même quand il manque une vie', () => {
    // la règle des vies le ramènerait au premier échantillon perdu : bannir
    // passe avant elle
    let vu = false
    for (let seed = 1; seed < 300; seed++) {
      vu ||= tirage(lcg(seed), ctx([], [], 1)).some((c) => c.id === 'echantillon-secours')
      expect(tirage(lcg(seed), ctx(['echantillon-secours'], [], 1)).map((c) => c.id)).not.toContain('echantillon-secours')
    }
    expect(vu).toBe(true) // sans bannissement, il paraît bel et bien
  })

  it('la bannie laisse sa place à une carte neuve ; les autres ne bougent pas', () => {
    for (let seed = 1; seed < 200; seed++) {
      const table = tirage(lcg(seed), ctx())
      const banni = table[1].id
      const apres = remplaceBannie(lcg(seed + 7), ctx([banni]), table, banni)
      expect(apres).toHaveLength(3)
      expect(apres.map((c) => c.id)).not.toContain(banni)
      // à la même place : seul le prix peut changer, si plus rien n'était offert
      expect(apres[0].id).toBe(table[0].id)
      expect(apres[2].id).toBe(table[2].id)
      expect(new Set(apres.map((c) => c.id)).size).toBe(3)
      expect(apres.some((c) => c.prix === 0)).toBe(true)
    }
  })

  it('bassin épuisé : la table compte une carte de moins, sans doublon', () => {
    const cat = INSTRUMENTS.filter((d) => !d.contrepartie && !d.effets.some((e) => e.levier === 'vies')).slice(0, 3)
    const c: ContexteTirage = { ...ctx(), catalogue: cat }
    const table = tirage(lcg(3), c)
    expect(table).toHaveLength(3)
    const apres = remplaceBannie(lcg(4), { ...c, bannies: [table[0].id] }, table, table[0].id)
    expect(apres.map((x) => x.id).sort()).toEqual(table.slice(1).map((x) => x.id).sort())
    expect(apres.some((x) => x.prix === 0)).toBe(true)
  })

  it('la relance pose une table neuve tant que le bassin le permet', () => {
    for (let seed = 1; seed < 200; seed++) {
      const table = tirage(lcg(seed), ctx())
      const neuve = relanceTirage(lcg(seed + 11), ctx(), table.map((c) => c.id))
      expect(neuve).toHaveLength(3)
      for (const c of neuve) expect(table.map((x) => x.id)).not.toContain(c.id)
      expect(neuve.some((c) => c.prix === 0)).toBe(true)
    }
  })

  it('bassin trop court pour une table neuve : elle se complète avec les refusées, bannies exclues', () => {
    const cat = INSTRUMENTS.filter((d) => !d.contrepartie && !d.effets.some((e) => e.levier === 'vies')).slice(0, 5)
    const c: ContexteTirage = { ...ctx([cat[4].id]), catalogue: cat }
    const table = tirage(lcg(9), c)
    const neuve = relanceTirage(lcg(10), c, table.map((x) => x.id)).map((x) => x.id)
    expect(neuve).toHaveLength(3)
    expect(new Set(neuve).size).toBe(3)
    expect(neuve).not.toContain(cat[4].id)
    // la seule carte jamais montrée y est
    const jamais = cat.slice(0, 4).map((d) => d.id).find((id) => !table.some((x) => x.id === id))!
    expect(neuve).toContain(jamais)
  })

  it('les gestes se comptent par run, jamais sous zéro — et il y en a', () => {
    expect(BANNISSEMENTS_PAR_RUN).toBeGreaterThan(0)
    expect(RELANCES_PAR_RUN).toBeGreaterThan(0)
    expect(gestesRestants(2, 0)).toBe(2)
    expect(gestesRestants(2, 2)).toBe(0)
    expect(gestesRestants(2, 5)).toBe(0)
    expect(gestesRestants(2, -3)).toBe(2)
  })
})
