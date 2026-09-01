import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ECHELLES_MAT } from './renderer'

// LE NIVEAU DE DÉTAIL DES TEXTURES DE MATÉRIAU EST ÉCRIT DEUX FOIS.
//
// Dans le shader, comme diviseur du prélèvement (world / 460.0) ; et dans
// ECHELLES_MAT, parce que le CPU en a besoin pour calculer le niveau à
// passer à textureLod. Les deux DOIVENT dire la même chose.
//
// Si elles divergent, rien ne casse : ça compile, ça s'affiche, les tests
// passent. La texture est simplement prélevée au mauvais niveau — trop
// floue, ou grésillante d'aliasing selon le sens de l'écart — et personne
// ne saura pourquoi. C'est exactement le genre de panne muette que ce
// dépôt attrape par un test plutôt que par une relecture.
const source = readFileSync(
  fileURLToPath(new URL('./renderer.ts', import.meta.url)),
  'utf8',
)

/** Les sept textures, dans l'ordre des indices de uLodMat. */
const TEXTURES = [
  'uTexWall',
  'uTexWallA',
  'uTexPhobe',
  'uTexPhile',
  'uTexFroid',
  'uTexChaud',
  'uTexGrille',
] as const

describe('Textures de matériau — l’échelle du CPU et celle du shader', () => {
  it('en déclare autant que le shader en prélève', () => {
    expect(ECHELLES_MAT).toHaveLength(TEXTURES.length)
  })

  it.each(TEXTURES.map((nom, i) => ({ nom, i })))(
    '$nom : le diviseur du shader est celui du CPU',
    ({ nom, i }) => {
      const prise = new RegExp(
        `textureLod\\(\\s*${nom}\\s*,\\s*world\\s*/\\s*([0-9.]+)\\s*,\\s*uLodMat\\[(\\d+)\\]`,
      )
      const m = source.match(prise)
      expect(m, `aucun prélèvement de ${nom} en textureLod`).not.toBeNull()
      expect(Number(m![1])).toBe(ECHELLES_MAT[i])
      // et l'INDICE doit être le bon : deux échelles justes mais croisées
      // donneraient deux textures floues sans qu'aucun chiffre soit faux
      expect(Number(m![2])).toBe(i)
    },
  )

  // Le fond du correctif : ces prélèvements ne doivent plus JAMAIS être sur
  // le chemin commun. Sept par pixel, partout, coûtaient 18 ms des 40 —
  // plus que tout le reste du jeu réuni (iPad Pro M1, hub, sonde de profil).
  it.each(TEXTURES)('%s ne se prélève plus hors des branches', (nom) => {
    const horsBranche = new RegExp(`^\\s*vec3 \\w+ = texture\\(${nom},`, 'm')
    expect(source).not.toMatch(horsBranche)
  })
})
