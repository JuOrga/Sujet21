import { describe, expect, it } from 'vitest'
import {
  CIRCUITS,
  SPOTS_ET,
  SPOTS_OU,
  SPOT_MEMOIRE,
  SPOT_NON,
  SPOT_VERROU_CLE,
  SPOT_VERROU_FIL,
} from './circuits'
import { accessible, prouveBarriere, prouveMiroir } from './generateur'
import { checkLevel } from './levelIO'

// Le cabinet logique se prouve comme une salle générée : par le VRAI
// traceur de faisceau, corps synthétique posé à l'endroit prévu.

const [MEMOIRE, OU, ET, NON, VERROU] = CIRCUITS

describe('Le cabinet logique — cinq circuits prouvés', () => {
  it('les cinq salles passent les garde-fous du level design', () => {
    for (const lv of CIRCUITS) {
      const erreurs = checkLevel(lv).filter((v) => v.niveau === 'erreur')
      expect(erreurs, `${lv.code} : ${erreurs.map((e) => e.message).join(' · ')}`).toEqual([])
    }
  })

  it('les cinq salles sont traversables, portes réputées ouvrables', () => {
    for (const lv of CIRCUITS) {
      // le jeu d'ouvrables se donne par CANAL — toutes nos portes sont au 1
      expect(accessible(lv, new Set([1])), lv.code).toBe(true)
    }
  })

  it('CL-1 · la MÉMOIRE : sans glace le bit reste à 0, gelé au fil il passe à 1', () => {
    const p = prouveMiroir(MEMOIRE, MEMOIRE.lasers![0], SPOT_MEMOIRE, 1)
    expect(p.sansGlace).toBe(false)
    expect(p.avecGlace).toBe(true)
  })

  it('CL-2 · le OU : chaque entrée, seule, allume le canal', () => {
    for (let i = 0; i < 2; i++) {
      const p = prouveMiroir(OU, OU.lasers![i], SPOTS_OU[i], 1)
      expect(p.sansGlace, `entrée ${i}`).toBe(false)
      expect(p.avecGlace, `entrée ${i}`).toBe(true)
    }
  })

  it('CL-3 · le ET : les deux entrées s’écrivent, chacune à son miroir', () => {
    expect(ET.portes![0].regle).toBe('et')
    for (let i = 0; i < 2; i++) {
      const p = prouveMiroir(ET, ET.lasers![i], SPOTS_ET[i], 1)
      expect(p.sansGlace, `entrée ${i}`).toBe(false)
      expect(p.avecGlace, `entrée ${i}`).toBe(true)
    }
  })

  it('CL-4 · le NON : le fil tient d’office, la vapeur le traverse, l’eau le coupe', () => {
    const p = prouveBarriere(NON, NON.lasers![0], SPOT_NON, 1)
    expect(p.directe).toBe(true) // la pastille NOR est tenue par défaut
    expect(p.enVapeur).toBe(true) // ionisé, le faisceau file droit
    expect(p.enEau).toBe(false) // l'eau plie le fil : coupure
    expect(NON.cibles![0].mode).toBe('nor')
  })

  it('CL-5 · le VERROU : porte = clé ÉCRITE ET fil intact', () => {
    expect(VERROU.portes![0].regle).toBe('et')
    // la clé : une mémoire TOR qui s'écrit au miroir
    const cle = prouveMiroir(VERROU, VERROU.lasers![0], SPOT_VERROU_CLE, 1)
    expect(cle.sansGlace).toBe(false)
    expect(cle.avecGlace).toBe(true)
    // le fil : une barrière NOR tenue, traversable en vapeur seulement
    const fil = prouveBarriere(VERROU, VERROU.lasers![1], SPOT_VERROU_FIL, 1)
    expect(fil.directe).toBe(true)
    expect(fil.enVapeur).toBe(true)
    expect(fil.enEau).toBe(false)
  })
})
