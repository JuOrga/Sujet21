// LE RETOUR DE COMMUNAUTÉ (main.ts, lu dans la source : il ne s'importe
// pas sans DOM). Le défaut du 25/11 : COMMUNAUTÉ › ÉDITEUR puis Accueil,
// et la fiche se croyait en PAUSE (REPRENDRE, RECOMMENCER) avec une vraie
// salle figée derrière elle, ses pancartes comprises — mesuré sur le jeu
// construit : la scène derrière la fiche passait de la cuve (2000 × 2000)
// au hub (4250 × 3200).

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')

/** Le corps d'une fonction (ou d'un crochet) qui commence à `debut`. */
function bloc(debut: string, fin = '\n}\n'): string {
  const i = MAIN.indexOf(debut)
  expect(i, debut).toBeGreaterThan(-1)
  return MAIN.slice(i, MAIN.indexOf(fin, i))
}

describe('rentrer de COMMUNAUTÉ rend la fiche d’avant', () => {
  it('l’aller retient s’il y avait une partie — une seule fois', () => {
    const part = bloc('function partCommunaute')
    expect(part).toContain('if (partieAvantCommunaute === null) partieAvantCommunaute = hasPlayed')
    // l'éditeur du joueur et une création jouée passent par là
    expect(bloc('async function openEditor')).toContain("if (ed.profil === 'joueur') partCommunaute()")
    const jouer = bloc('  jouer: (lvl, c) => {', '\n  },')
    expect(jouer.indexOf('partCommunaute()')).toBeGreaterThan(-1)
    expect(jouer.indexOf('partCommunaute()')).toBeLessThan(jouer.indexOf('startTest('))
  })

  it('entrer dans l’éditeur ne fait plus croire à une partie en cours', () => {
    expect(bloc("document.getElementById('home-atelier')?.addEventListener", '\n})')).not.toContain('hasPlayed = true')
    expect(bloc('  creer: () => {', '\n  },')).not.toContain('hasPlayed = true')
    expect(bloc('  modifier: (lvl, id) => {', '\n  },')).not.toContain('hasPlayed = true')
  })

  it('le retour remet l’état d’avant, et la salle AVANT la fiche', () => {
    const r = bloc('function reviensDeCommunaute')
    expect(r).toContain('hasPlayed = avant')
    expect(r).toContain('testLevel = null')
    expect(r).toMatch(/if \(!avant\) \{[\s\S]*input\.paused = false/)
    // restart() pose la salle (ou la cuve), PUIS la fiche
    expect(r.indexOf('restart()')).toBeGreaterThan(-1)
    expect(r.indexOf('restart()')).toBeLessThan(r.indexOf('openHome()'))
  })

  it('les deux sorties y passent : quitter l’éditeur du joueur, finir une création', () => {
    const quit = bloc('      quit: () => {\n        ed.close()', '\n      },')
    expect(quit).toMatch(/if \(ed\.profil === 'joueur'\) \{\s*reviensDeCommunaute\(\)\s*return/)
    expect(bloc('      if (fromCreation) {', '\n      }')).toContain('reviensDeCommunaute()')
  })

  it('le concepteur aussi : restart() avant openHome(), sinon la salle reste figée derrière la fiche', () => {
    const quit = bloc('      quit: () => {\n        ed.close()', '\n      },')
    const apres = quit.slice(quit.indexOf('return\n        }'))
    expect(apres.indexOf('restart()')).toBeGreaterThan(-1)
    expect(apres.indexOf('restart()')).toBeLessThan(apres.indexOf('openHome()'))
  })

  it('une vraie partie qui commence oublie l’escapade retenue', () => {
    expect(bloc("startBtn.addEventListener('click'", '\n})')).toContain('if (testLevel === null) partieAvantCommunaute = null')
  })
})
