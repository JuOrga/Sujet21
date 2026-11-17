import { describe, expect, it } from 'vitest'
import { COMPOSE_FS } from './renderer'

// LES SEIZE UNITÉS DE TEXTURE DE LA COMPOSITION. WebGL2 garantit au moins
// 16 textures lues par un même shader de fragment, et beaucoup de machines
// s'arrêtent là : les téléphones, les puces Intel intégrées, les Mac,
// Chrome sous Windows (ANGLE sur Direct3D). La carte du poste de
// développement en offre 32. Une 17e texture y passe donc sans un mot —
// et chez le joueur à 16, le shader ne se lie pas : la cuve ne s'affiche
// pas. Rien ne le signalait jusqu'ici que deux commentaires de renderer.ts ;
// le dépôt avait déjà frôlé la limite (les images de zones regroupées en un
// tableau de textures pour faire place à la carte de lumière).
//
// Le compte se fait sur la source ASSEMBLÉE (les morceaux interpolés
// compris) : un morceau importé qui déclarerait sa texture compte autant.
function texturesDeclarees(source: string): string[] {
  return source
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .filter((l) => /^\s*uniform\s+(?:(?:lowp|mediump|highp)\s+)?[iu]?sampler\w+\s+\w+/.test(l))
    .map((l) => l.trim())
}

describe('la composition et ses unités de texture', () => {
  const declarees = texturesDeclarees(COMPOSE_FS)

  it('ne lit jamais plus de 16 textures (le minimum garanti par WebGL2)', () => {
    expect(declarees.length).toBeLessThanOrEqual(16)
  })

  it('en lit exactement 16 au 17/11/2026 — à mettre à jour quand on en libère une', () => {
    // L'égalité documente l'état : il ne reste AUCUNE place. Une nouvelle
    // image va dans un atlas existant (comme les flancs des éléments à
    // pièces) ou dans un tableau de textures (comme les zones).
    expect(declarees.length).toBe(16)
  })

  it('compte une déclaration ajoutée (le compteur voit ce qu’il doit voir)', () => {
    const plus = COMPOSE_FS.replace(
      'uniform sampler2D uField;',
      'uniform sampler2D uField;\nuniform highp sampler2D uDix7;',
    )
    expect(texturesDeclarees(plus).length).toBe(declarees.length + 1)
  })
})
