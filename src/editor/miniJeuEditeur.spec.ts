import { describe, expect, it } from 'vitest'
import { CODE_CIBLES, CODE_PALET, estMiniJeu, REGLES_PALET, tableauCouperet, tableauPalet } from '../game/minijeux'
import { parseLevel, serializeLevel } from '../game/levelIO'
import type { LevelDef } from '../game/level'
import { CODE_DU_MINI_JEU, MINI_JEUX_MENU, miniJeuNeuf, noteMiniJeu, noteTirage, valeurMenu } from './miniJeuEditeur'

// un tableau ordinaire quelconque : le décor ne compte pas, seul le code
const ordinaire = (): LevelDef => {
  const t = tableauPalet()
  delete t.minijeu
  t.code = '21-7'
  t.name = 'Mon tableau'
  return t
}

describe('le menu « Mini-jeu » de l’éditeur', () => {
  it('chaque mini-jeu du menu pose un tableau que le jeu tient pour mini-jeu', () => {
    for (const type of MINI_JEUX_MENU) {
      const t = ordinaire()
      t.minijeu = miniJeuNeuf(type)
      expect(t.minijeu.type).toBe(type)
      expect(estMiniJeu(t)).toBe(true)
      expect(valeurMenu(t)).toBe(type)
    }
  })

  it('le mini-jeu posé survit à la publication (sérialiser puis relire)', () => {
    // sans quoi le menu posait un mini-jeu que levelIO écartait au
    // chargement suivant : « type inconnu » ou règles manquantes
    for (const type of MINI_JEUX_MENU) {
      const t = ordinaire()
      t.minijeu = miniJeuNeuf(type)
      const { level, rejets } = parseLevel(JSON.parse(serializeLevel(t)))
      expect(rejets.filter((r) => r.includes('mini-jeu'))).toEqual([])
      expect(level?.minijeu).toEqual(t.minijeu)
    }
  })

  it('le palet garde son banc (la glace qui glisse), pas seulement ses règles', () => {
    expect(miniJeuNeuf('palet')).toEqual(tableauPalet().minijeu)
    expect(miniJeuNeuf('palet').type === 'palet' && miniJeuNeuf('palet').reglages).toBeTruthy()
  })

  it('une retouche du mini-jeu posé ne touche pas les règles du code', () => {
    const mj = miniJeuNeuf('palet')
    if (mj.type !== 'palet') throw new Error('palet attendu')
    mj.regles.lancers = 99
    mj.regles.maison.x = -1
    expect(REGLES_PALET.lancers).not.toBe(99)
    expect(REGLES_PALET.maison.x).not.toBe(-1)
  })

  it('aucun mini-jeu : la valeur du menu est vide, et aucune note', () => {
    expect(valeurMenu(ordinaire())).toBe('')
    expect(noteMiniJeu(ordinaire())).toBe('')
  })

  it('la note dit le code sous lequel publier, tant qu’il n’est pas pris', () => {
    const t = ordinaire()
    t.minijeu = miniJeuNeuf('cibles')
    expect(noteMiniJeu(t)).toContain(`le code ${CODE_CIBLES}`)
    expect(noteMiniJeu(t)).toContain('« Tirage » sur « Cases mini-jeu »')
    t.tirage = 'minijeu'
    expect(noteMiniJeu(t)).toContain('sort sur les cases mini-jeu')
    delete t.tirage
    t.code = CODE_DU_MINI_JEU.cibles
    expect(noteMiniJeu(t)).toContain(`Publié sous ${CODE_CIBLES}`)
  })

  it('la note du tirage dit où sort le tableau, et comment il s’y joue', () => {
    const t = ordinaire()
    expect(noteTirage(t)).toBe('')
    t.tirage = 'minijeu'
    expect(noteTirage(t)).toContain('son sas')
    expect(noteTirage(t)).toContain('ne sort plus aux portes classiques')
    t.tirage = 'partout'
    expect(noteTirage(t)).toContain('aussi aux portes classiques')
    // un mini-jeu n'a pas de sas : « les deux » ne l'envoie pas aux portes
    t.minijeu = miniJeuNeuf('palet')
    expect(noteTirage(t)).toContain('Pas aux portes classiques')
  })

  it('un code de mini-jeu SANS mini-jeu est signalé (pas de sas, pas de fin)', () => {
    const t = ordinaire()
    t.code = CODE_PALET
    expect(noteMiniJeu(t)).toMatch(/^⚠/)
  })

  it('le couperet, hors menu, reste affiché tel quel (pas effacé en silence)', () => {
    const t = tableauCouperet(1)
    expect(valeurMenu(t)).toBe('couperet')
    expect(noteMiniJeu(t)).toContain('essai')
  })
})
