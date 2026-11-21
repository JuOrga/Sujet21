import { describe, expect, it } from 'vitest'
import { PALETTE, PSEUDO_MAX, couleursDeLaPartie, litProfil, nettoiePseudo } from './profil'

describe('profil — ce qui arrive de l’autre joueur est remis au propre', () => {
  it('un pseudo : espaces resserrés, douze caractères au plus', () => {
    expect(nettoiePseudo('  Léa   la  goutte  ')).toBe('Léa la goutt')
    expect([...nettoiePseudo('x'.repeat(40))].length).toBe(PSEUDO_MAX)
    expect(nettoiePseudo('')).toBe('')
  })

  it('ni retour à la ligne, ni caractère de commande, ni balise qui tienne', () => {
    const car = (k: number): string => String.fromCodePoint(k)
    expect(nettoiePseudo('a' + car(10) + 'b' + car(9) + 'c' + car(0) + 'd')).toBe('a b c d')
    // l'écran pose les noms en TEXTE : une balise reste des caractères
    expect(nettoiePseudo('<b>x</b>')).toBe('<b>x</b>')
    // la marque qui renverse le sens d'écriture, l'espace sans largeur
    expect(nettoiePseudo('a' + car(0x202e) + 'b')).toBe('a b')
    expect(nettoiePseudo('a' + car(0x200b) + car(0xfeff) + 'b')).toBe('a b')
  })

  it('un émoji compte pour un caractère, et n’est pas coupé en deux', () => {
    const p = nettoiePseudo('💧'.repeat(20))
    expect([...p].length).toBe(PSEUDO_MAX)
    expect(p).toBe('💧'.repeat(PSEUDO_MAX))
  })

  it('ce qui n’est pas un texte ne donne rien', () => {
    for (const brut of [undefined, null, 12, {}, ['a']]) expect(nettoiePseudo(brut)).toBe('')
  })

  it('un profil mal formé devient le profil neutre', () => {
    expect(litProfil(null)).toEqual({ pseudo: '', couleur: 0 })
    expect(litProfil('profil')).toEqual({ pseudo: '', couleur: 0 })
    expect(litProfil({ pseudo: 42, couleur: 'rouge' })).toEqual({ pseudo: '', couleur: 0 })
    expect(litProfil({ pseudo: 'Sam', couleur: 99 })).toEqual({ pseudo: 'Sam', couleur: 0 })
    expect(litProfil({ pseudo: 'Sam', couleur: 2.5 })).toEqual({ pseudo: 'Sam', couleur: 0 })
    expect(litProfil({ pseudo: 'Sam', couleur: PALETTE.length - 1 })).toEqual({ pseudo: 'Sam', couleur: PALETTE.length - 1 })
  })
})

describe('profil — les couleurs de la partie', () => {
  const p = (couleur: number) => ({ pseudo: '', couleur })

  it('chacun garde la couleur qu’il a choisie', () => {
    expect(couleursDeLaPartie(p(3), p(1))).toEqual([3, 1])
  })

  it('la même couleur des deux côtés : l’hôte la garde, l’invité prend la suivante', () => {
    expect(couleursDeLaPartie(p(2), p(2))).toEqual([2, 3])
    expect(couleursDeLaPartie(p(PALETTE.length - 1), p(PALETTE.length - 1))).toEqual([PALETTE.length - 1, 0])
  })

  it('les deux joueurs n’ont jamais la même', () => {
    for (let h = 0; h < PALETTE.length; h++) {
      for (let i = 0; i < PALETTE.length; i++) {
        const [a, b] = couleursDeLaPartie(p(h), p(i))
        expect(a).not.toBe(b)
      }
    }
  })
})
