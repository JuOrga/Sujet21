import { describe, expect, it } from 'vitest'
import { entreesTiroir } from './athTiroir'
import { MANOEUVRES } from './commandes'

const RUN = { vortexActif: false }

describe('le tiroir de l’ATH', () => {
  it('range les commandes rares dans l’ordre de la spec', () => {
    expect(entreesTiroir({ ...RUN, vortexActif: true }).map((e) => e.id)).toEqual([
      'legende', 'etats', 'dossier', 'station', 'recadrer',
      'vortex', 'son', 'recommencer', 'fiche', 'banc',
    ])
  })

  it('ne montre le vortex que si le réglage l’active', () => {
    expect(entreesTiroir(RUN).map((e) => e.id)).not.toContain('vortex')
  })

  it('ne cite que des manœuvres qui existent : la touche affichée est la vraie', () => {
    const ids = MANOEUVRES.map((m) => m.id)
    for (const e of entreesTiroir({ ...RUN, vortexActif: true }))
      if (e.manoeuvre !== null) expect(ids, e.id).toContain(e.manoeuvre)
  })

})
