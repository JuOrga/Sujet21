import { describe, expect, it } from 'vitest'
import { Input } from './input'

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
