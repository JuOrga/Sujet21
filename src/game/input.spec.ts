import { describe, expect, it } from 'vitest'
import { cibleHorsJeu, Input } from './input'

// La DEMANDE de transformation (bouton, clavier, manette) passe par le
// garde du cycle ; les toggles restent la voie du décor, sans garde.
describe('Input — le garde du cycle des états', () => {
  it('sans garde, demande() reproduit les bascules historiques', () => {
    const i = new Input()
    i.demande('glace') // eau → glace
    expect(i.freezeIntent).toBe(true)
    expect(i.etatManuel()).toBe('glace')
    i.demande('vapeur') // glace → vapeur : un seul état à la fois
    expect(i.gasIntent).toBe(true)
    expect(i.freezeIntent).toBe(false)
    i.demande('vapeur') // re-demander l'état courant = retour au liquide
    expect(i.etatManuel()).toBe('eau')
    i.demande('eau') // déjà liquide : rien ne bouge, pas de refus
    expect(i.etatManuel()).toBe('eau')
  })

  it('le garde bloque et prévient — les intentions ne bougent pas', () => {
    const i = new Input()
    const refus: string[] = []
    i.peutDevenir = (vers) => vers === 'eau'
    i.onDevenirRefuse = (vers) => refus.push(vers)
    i.demande('glace')
    i.demande('vapeur')
    expect(i.etatManuel()).toBe('eau')
    expect(refus).toEqual(['glace', 'vapeur'])
  })

  it('les toggles restent SANS garde : le décor transforme toujours', () => {
    const i = new Input()
    i.peutDevenir = () => false
    i.toggleGas() // la chaudière emprunte ce chemin
    expect(i.gasIntent).toBe(true)
    i.toggleGas()
    i.toggleFreeze() // la cryostase aussi
    expect(i.freezeIntent).toBe(true)
  })

  it('depuis un état imposé, le geste du dégel interroge le bon lien (vers l’eau)', () => {
    const i = new Input()
    const vus: string[] = []
    i.peutDevenir = (vers) => {
      vus.push(`${i.etatManuel()}->${vers}`)
      return true
    }
    i.freezeIntent = true // une zone a imposé la glace
    i.demande('glace') // re-presser ❄ : c'est la fusion qu'on demande
    expect(vus).toEqual(['glace->eau'])
    expect(i.etatManuel()).toBe('eau')
  })
})

// LES TOUCHES D'UN ÉCRAN NE SONT PAS AU JEU. Espace est la PAUSE : sur une
// touche visant un bouton de la cérémonie (#mb-veil), input.ts annulait la
// touche (preventDefault) — le bouton ne s'actionnait pas et la salle de
// derrière se mettait en pause. Le voile coupait alors la remontée
// (stopPropagation), ce qui masquait aussi la touche au réveil du son et à
// l'aide clavier du dossier. C'est input.ts qui laisse la touche à l'écran,
// comme il le fait déjà pour un champ de texte.
describe('Input — les touches qui ne sont pas au jeu', () => {
  // un élément du DOM, réduit à ce que la règle lit
  const el = (tagName: string, dans: string[] = []): { tagName: string; closest: (s: string) => unknown } => ({
    tagName,
    closest: (s: string) => (dans.includes(s) ? {} : null),
  })
  it('laisse la touche à un champ de texte', () => {
    expect(cibleHorsJeu(el('INPUT'))).toBe(true)
    expect(cibleHorsJeu(el('TEXTAREA'))).toBe(true)
  })
  it('laisse Espace et Entrée aux boutons de la cérémonie', () => {
    expect(cibleHorsJeu(el('BUTTON', ['#mb-veil']))).toBe(true)
    expect(cibleHorsJeu(el('DIV', ['#mb-veil']))).toBe(true)
  })
  it('garde la touche au jeu hors de la cérémonie : la pause reste intacte', () => {
    expect(cibleHorsJeu(el('BODY'))).toBe(false)
    expect(cibleHorsJeu(el('BUTTON'))).toBe(false)
    expect(cibleHorsJeu(null)).toBe(false)
    expect(cibleHorsJeu(cibleSansClosest())).toBe(false)
  })
})
// la cible d'une touche peut être la fenêtre elle-même, sans closest()
function cibleSansClosest(): { tagName?: string } {
  return {}
}
