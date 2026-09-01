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
    for (const mauvais of [
      'PLAT', 'plate', 'nu2', ' zero', 'oui', '1',
      'arret', 'arret0', 'arret6', 'arret12', 'ARRET1', 'arret-1',
      'boites', 'boites0', 'boites3', 'boites32', 'BOITES4',
    ]) {
      expect(litSonde(`?sonde=${mauvais}`).mode).toBe('')
      expect(litSonde(`?sonde=${mauvais}`).plat).toBe(false)
    }
  })

  // L'escalier : chaque marche garde tout ce que la précédente retirait.
  // Une marche qui n'emboîterait pas la suivante rendrait les mesures
  // incomparables entre elles — c'est tout l'intérêt d'un escalier.
  it('emboîte ses marches de couches', () => {
    expect(litSonde('?sonde=plat')).toEqual({
      mode: 'plat', plat: true, nu: false, zero: false, arret: 0, boites: 0,
    })
    expect(litSonde('?sonde=nu')).toEqual({
      mode: 'nu', plat: true, nu: true, zero: false, arret: 0, boites: 0,
    })
    expect(litSonde('?sonde=zero')).toEqual({
      mode: 'zero', plat: true, nu: true, zero: true, arret: 0, boites: 0,
    })
  })

  // LE PROFIL ne retire aucune couche : il GARDE tout et arrête la
  // composition à la fin d'un bloc. Confondre les deux familles fausserait
  // la lecture — on comparerait un shader coupé à un écran dépouillé.
  // Le COMPTE ne coupe pas le shader et ne retire pas de couche : il borne
  // la boucle. Trois familles, trois questions — les confondre ferait lire
  // un profil pour un autre.
  it('borne la boucle sans rien couper d’autre', () => {
    for (const n of [1, 2, 4, 8, 16]) {
      const s = litSonde(`?sonde=boites${n}`)
      expect(s.boites).toBe(n)
      expect(s.arret).toBe(0)
      expect(s.plat).toBe(false)
      expect(s.nu).toBe(false)
    }
  })

  it('garde toutes les couches sur une marche de profil', () => {
    for (let n = 1; n <= 5; n++) {
      const s = litSonde(`?sonde=arret${n}`)
      expect(s.arret).toBe(n)
      expect(s.boites).toBe(0)
      expect(s.plat).toBe(false)
      expect(s.nu).toBe(false)
      expect(s.zero).toBe(false)
    }
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
    expect(main).toContain('if (!sonde.zero)')
    expect(main).toContain('if (sonde.nu) fxCanvas.hidden = true')
    expect(main).toMatch(/sonde\.nu[\s\S]{0,80}worldLabelsHost\.hidden = true/)
    expect(renderer).toContain('const SONDE_FS')
    expect(main).toContain(
      'renderer.setSonde(sonde.plat, sonde.arret, sonde.boites)',
    )
  })

  // Les cinq marches doivent EXISTER dans le shader : sans elles, l'adresse
  // répondrait sans rien couper, et le profil serait plat par construction.
  it('porte ses cinq marches dans le shader', () => {
    for (let n = 1; n <= 5; n++) {
      expect(renderer).toContain(`#if SONDE_ARRET == ${n}`)
    }
    expect(renderer).toContain('#define SONDE_ARRET 0')
  })

  // Une mesure sondée n'est pas une mesure du jeu. Rien ne serait pire que
  // de les retrouver côte à côte dans le labo sans pouvoir les distinguer —
  // c'est exactement l'erreur qui a coûté l'A/B du 01/09, en version pire.
  it('se déclare dans le rapport de performance', () => {
    expect(main).toMatch(/sonde: sonde\.mode === '' \? 'aucune' : sonde\.mode/)
  })
})
