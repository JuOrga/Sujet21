import { describe, expect, it } from 'vitest'
import { recommencerConclut, type EtatEssai } from './gesteRecommencer'

// Le symptôme (23/11) : la dernière impulsion donnée, R pressé pendant la
// dérive — avant l'écran de défaite — rejouait la salle sans prendre de
// secours. La dernière vie se rejouait à l'infini.

const vivant: EtatEssai = { disperse: false, epuise: false, continuerOffert: false }

describe('le geste recommencer en run', () => {
  it('un corps vivant se relance gratuitement', () => {
    expect(recommencerConclut(vivant)).toBe(false)
  })

  it('un corps figé qui dérive (sursis) CONCLUT : la relance gratuite est fermée', () => {
    expect(recommencerConclut({ ...vivant, epuise: true })).toBe(true)
  })

  it('un corps dispersé conclut, même pendant le battement de l’agonie', () => {
    expect(recommencerConclut({ ...vivant, disperse: true })).toBe(true)
  })

  it('un corps figé que le sas a bu (CONTINUER offert) ne perd rien', () => {
    expect(recommencerConclut({ ...vivant, epuise: true, continuerOffert: true })).toBe(false)
  })
})
