import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { litSonde, SONDE_ETEINTE } from './sonde'

describe('Sonde de rendu — elle dort, sauf si on la réveille', () => {
  // LA GARDE QUI COMPTE. Un jeu qui se livrerait en aplat bleu parce qu'un
  // drapeau vaut vrai par défaut serait un désastre silencieux : tout passe
  // (type-check, tests, build), et l'écran est vide chez le joueur.
  it('est éteinte quand personne ne la demande', () => {
    for (const recherche of ['', '?', '?tableau=3', '?sonde=', '?sonde']) {
      expect(litSonde(recherche)).toEqual(SONDE_ETEINTE)
    }
  })

  // Le défaut n'est pas « le mode le plus proche » : c'est « aucune sonde ».
  // Une faute de frappe, ou un paramètre traînant dans un lien partagé, ne
  // doit jamais dépouiller l'écran de quelqu'un qui n'a rien demandé.
  it('éteint tout ce qu’elle ne reconnaît pas', () => {
    for (const mauvais of ['PLAT', 'plate', 'nu2', ' zero', 'oui', '1']) {
      expect(litSonde(`?sonde=${mauvais}`).mode).toBe('')
      expect(litSonde(`?sonde=${mauvais}`).plat).toBe(false)
    }
  })

  // L'escalier : chaque marche garde tout ce que la précédente retirait.
  // Une marche qui n'emboîterait pas la suivante rendrait les mesures
  // incomparables entre elles — c'est tout l'intérêt d'un escalier.
  it('emboîte ses marches', () => {
    expect(litSonde('?sonde=plat')).toEqual({
      mode: 'plat', plat: true, nu: false, zero: false,
    })
    expect(litSonde('?sonde=nu')).toEqual({
      mode: 'nu', plat: true, nu: true, zero: false,
    })
    expect(litSonde('?sonde=zero')).toEqual({
      mode: 'zero', plat: true, nu: true, zero: true,
    })
  })
})

describe('Sonde de rendu — elle est branchée, et elle se dit', () => {
  const main = readFileSync(
    fileURLToPath(new URL('../main.ts', import.meta.url)),
    'utf8',
  )
  const renderer = readFileSync(
    fileURLToPath(new URL('../render/renderer.ts', import.meta.url)),
    'utf8',
  )

  it('remplace la composition, retire les couches, et coupe le rendu', () => {
    expect(main).toContain('renderer.setSonde(sonde.plat)')
    expect(main).toContain('if (!sonde.zero)')
    expect(main).toContain('if (sonde.nu) fxCanvas.hidden = true')
    expect(main).toMatch(/sonde\.nu[\s\S]{0,80}worldLabelsHost\.hidden = true/)
    expect(renderer).toContain('const SONDE_FS')
  })

  // Une mesure sondée n'est pas une mesure du jeu. Rien ne serait pire que
  // de les retrouver côte à côte dans le labo sans pouvoir les distinguer —
  // c'est exactement l'erreur qui a coûté l'A/B du 01/09, en version pire.
  it('se déclare dans le rapport de performance', () => {
    expect(main).toMatch(/sonde: sonde\.mode === '' \? 'aucune' : sonde\.mode/)
  })
})
