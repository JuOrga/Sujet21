// La PROVENANCE d'un code : la planche annonce sous chaque code qui l'a
// saisi et quand. La règle tient en deux morceaux — la phrase affichée, et
// le repli sur le dernier enregistrement pour les entrées d'avant la règle.

import { describe, expect, it } from 'vitest'
import { mentionSaisie, readList } from './netLevels'
import { provenanceCode } from '../../api/_provenance'

const LEVEL = {
  name: 'Essai',
  code: '212',
  bounds: { minX: -1000, minY: -600, maxX: 1000, maxY: 600 },
  spawn: { x: -800, y: 0, n: 60 },
  exit: { minX: 900, minY: -60, maxX: 980, maxY: 60 },
  boxes: [{ minX: 0, minY: 0, maxX: 60, maxY: 200, material: 0 }],
}

describe('netLevels — « saisi par … le … »', () => {
  it('dit qui et quand, en clair', () => {
    // midi UTC : la date est la même de part et d'autre du méridien
    expect(mentionSaisie('JU', '2026-08-27T12:34:00.000Z')).toBe(
      'saisi par JU le 27/08/2026',
    )
    expect(mentionSaisie('  ', '2026-01-05T12:00:00.000Z')).toBe(
      'saisi par anonyme le 05/01/2026',
    )
  })

  it('sans date connue, dit au moins par qui — et ne rend jamais « Invalid Date »', () => {
    expect(mentionSaisie('JU', '')).toBe('saisi par JU')
    expect(mentionSaisie('JU', 'pas une date')).toBe('saisi par JU')
    expect(mentionSaisie('', '')).toBe('saisi par anonyme')
  })
})

describe('netLevels — la provenance du code voyage avec l’entrée', () => {
  it('le serveur qui la donne fait foi', () => {
    const [e] = readList({
      levels: [
        {
          id: 'a',
          auteur: 'MO',
          majAt: '2026-08-27T09:00:00.000Z',
          codeAuteur: 'JU',
          codeAt: '2026-08-20T12:00:00.000Z',
          level: LEVEL,
        },
      ],
    })
    // le tableau a été retouché par MO depuis, mais le CODE reste de JU
    expect(e.codeAuteur).toBe('JU')
    expect(mentionSaisie(e.codeAuteur, e.codeAt)).toBe(
      'saisi par JU le 20/08/2026',
    )
  })

  it('sans provenance de code (entrée d’avant la règle), on retombe sur l’enregistrement', () => {
    const [e] = readList({
      levels: [
        {
          id: 'a',
          auteur: 'MO',
          majAt: '2026-08-27T12:00:00.000Z',
          level: LEVEL,
        },
      ],
    })
    expect(e.codeAuteur).toBe('MO')
    expect(mentionSaisie(e.codeAuteur, e.codeAt)).toBe(
      'saisi par MO le 27/08/2026',
    )
  })
})

describe('netLevels — le serveur date la saisie du CODE, et elle seule', () => {
  const T0 = '2026-08-20T12:00:00.000Z'
  const T1 = '2026-08-27T12:00:00.000Z'
  const avant = {
    auteur: 'JU',
    majAt: T0,
    codeAuteur: 'JU',
    codeAt: T0,
    level: { code: '212' },
  }

  it('un code qui CHANGE se réattribue à qui l’a saisi, maintenant', () => {
    expect(provenanceCode(avant, '213', 'MO', T1)).toEqual({
      codeAuteur: 'MO',
      codeAt: T1,
    })
  })

  it('retoucher le tableau sans toucher au code ne réattribue RIEN', () => {
    // MO retravaille le décor et enregistre : le code reste de JU, à sa date
    expect(provenanceCode(avant, '212', 'MO', T1)).toEqual({
      codeAuteur: 'JU',
      codeAt: T0,
    })
  })

  it('à la création, le code est saisi par celui qui enregistre', () => {
    expect(provenanceCode(undefined, '212', 'MO', T1)).toEqual({
      codeAuteur: 'MO',
      codeAt: T1,
    })
  })

  it('entrée d’avant la règle : on hérite du dernier enregistrement', () => {
    expect(
      provenanceCode(
        { auteur: 'JU', majAt: T0, level: { code: '212' } },
        '212',
        'MO',
        T1,
      ),
    ).toEqual({ codeAuteur: 'JU', codeAt: T0 })
  })
})
