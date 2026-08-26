import { describe, expect, it } from 'vitest'
import {
  accessible,
  creeRng,
  genereNiveau,
  graineDepuisTexte,
  prouveMiroir,
  valideNiveau,
} from './generateur'
import { checkLevel } from './levelIO'

describe('generateur — une graine, une salle PROUVÉE', () => {
  it('est déterministe : même graine, même salle — au caractère près', () => {
    const a = JSON.stringify(genereNiveau(42))
    const b = JSON.stringify(genereNiveau(42))
    expect(a).toBe(b)
    expect(JSON.stringify(genereNiveau(43))).not.toBe(a)
  })

  it('le RNG est stable (mulberry32) : la suite ne bougera jamais', () => {
    const rng = creeRng(7)
    const suite = [rng(), rng(), rng()]
    const rng2 = creeRng(7)
    expect([rng2(), rng2(), rng2()]).toEqual(suite)
    // valeurs figées : un changement d'algorithme casserait TOUTES les graines
    expect(suite[0]).toBeCloseTo(0.011704753153026104, 12)
  })

  it("cinquante graines : toutes valides, sans erreur d'éditeur, sas accessible", () => {
    for (let g = 1; g <= 50; g++) {
      const niveau = genereNiveau(g)
      const erreurs = checkLevel(niveau).filter((v) => v.niveau === 'erreur')
      expect(erreurs, `graine ${g} : ${erreurs.map((e) => e.message).join(' · ')}`).toEqual([])
      // toutes les portes livrées sont ouvrables : la validation les a prouvées
      const ouvrables = new Set((niveau.portes ?? []).map((p) => p.canal))
      expect(accessible(niveau, ouvrables), `graine ${g} : sas inaccessible`).toBe(true)
    }
  })

  it('chaque porte livrée porte son énigme : émetteur + pastille du même canal', () => {
    for (let g = 1; g <= 50; g++) {
      const niveau = genereNiveau(g)
      for (const porte of niveau.portes ?? []) {
        const pastilles = (niveau.cibles ?? []).filter(
          (c, i) => (c.canal ?? i + 1) === porte.canal,
        )
        expect(pastilles.length, `graine ${g}, canal ${porte.canal}`).toBeGreaterThan(0)
      }
      if ((niveau.portes?.length ?? 0) > 0) {
        expect(niveau.lasers?.length ?? 0).toBeGreaterThan(0)
        // l'énigme est signalée au joueur : l'étiquette du miroir existe
        expect(niveau.labels.some((l) => l.text === 'MIROIR DE GLACE')).toBe(true)
      }
    }
  })

  it("la preuve du miroir discrimine : sans glace la porte reste close, avec elle s'ouvre", () => {
    // on cherche une graine à porte, puis on rejoue la preuve sur la salle finie
    for (let g = 1; g <= 80; g++) {
      const niveau = genereNiveau(g)
      const porte = (niveau.portes ?? [])[0]
      if (!porte) continue
      const em = (niveau.lasers ?? [])[0]
      const etiquette = niveau.labels.find((l) => l.text === 'MIROIR DE GLACE')!
      const miroir = { x: etiquette.x, y: etiquette.y + 66 }
      const { sansGlace, avecGlace } = prouveMiroir(niveau, em, miroir, porte.canal)
      expect(sansGlace).toBe(false)
      expect(avecGlace).toBe(true)
      return
    }
    throw new Error('aucune graine à porte parmi 1..80 — invraisemblable')
  })

  it('un niveau saboté est refusé : le sas muré ne passe pas la validation', () => {
    // une salle SANS porte : la validation rejouée ne bute que sur le mur
    let niveau = genereNiveau(1)
    for (let g = 1; (niveau.portes?.length ?? 0) > 0; g++) niveau = genereNiveau(g)
    const mur = {
      minX: niveau.exit.minX - 400,
      minY: niveau.bounds.minY,
      maxX: niveau.exit.minX - 340,
      maxY: niveau.bounds.maxY,
      material: 0,
    }
    const sabote = { ...niveau, boxes: [...niveau.boxes, mur] }
    const verdict = valideNiveau(sabote)
    expect(verdict.valide).toBe(false)
    expect(verdict.raisons.join(' ')).toContain('inaccessible')
  })

  it('les graines de partage : le texte base 36 fait l’aller-retour', () => {
    expect(graineDepuisTexte('ZZ')).toBe(1295)
    expect(graineDepuisTexte('zz')).toBe(1295)
    expect(graineDepuisTexte('')).toBeNull()
    expect(graineDepuisTexte('héhé')).toBeNull()
    const g = 48151623
    expect(graineDepuisTexte(g.toString(36))).toBe(g)
  })

  it('le code et le nom portent la graine : la salle se partage et se rejoue', () => {
    const niveau = genereNiveau(1295)
    expect(niveau.code).toBe('G-ZZ')
    expect(niveau.name).toContain('ZZ')
    expect(niveau.journal.length).toBeGreaterThanOrEqual(40)
  })
})
