import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// L'ORDRE D'AMORÇAGE DE main.ts — un test qui garde une panne vécue.
//
// main.ts est un module : son corps s'exécute DE HAUT EN BAS. Plusieurs
// fonctions y sont appelées au chargement (applyLevel(), renderSalles()…),
// bien AVANT que les grands objets du jeu ne naissent — `const renderer =
// new Renderer(...)` arrive quatre mille lignes plus bas. Une fonction
// appelée tôt qui touche le renderer lit donc une liaison encore en zone
// morte : « Cannot access before initialization », et l'ACCUEIL NE
// S'AFFICHE PLUS DU TOUT. C'est arrivé le 30/08 avec le sol des modules —
// une seule ligne, et le jeu ne démarrait plus.
//
// Le piège est traître pour deux raisons. En développement (modules ES
// séparés) l'ordre diffère et la page démarre ; la panne n'apparaît qu'au
// BUILD. Et le compilateur ne la voit pas : `renderer` est bien déclaré,
// simplement plus bas.
//
// PORTÉE, dite franchement : on ne suit qu'UN niveau d'appel — les
// fonctions appelées directement au niveau du module. Une fonction appelée
// tôt qui en appelle une autre qui, elle, touche le renderer, passerait au
// travers. C'est le cas qui s'est produit, et le filet vaut mieux que rien.

const SRC = readFileSync(new URL('./main.ts', import.meta.url), 'utf-8')

/** Les objets nés TARD dans le module : les toucher tôt est une panne. */
const TARDIFS = ['renderer', 'loop', 'input']

/** Le corps d'une fonction déclarée au niveau du module, accolades comprises. */
function corpsDe(nom: string): string | null {
  const i = SRC.indexOf(`\nfunction ${nom}(`)
  if (i < 0) return null
  const debut = SRC.indexOf('{', i)
  let n = 0
  for (let k = debut; k < SRC.length; k++) {
    if (SRC[k] === '{') n++
    else if (SRC[k] === '}' && --n === 0) return SRC.slice(debut, k + 1)
  }
  return null
}

describe('L’amorçage de main.ts', () => {
  it('déclare bien ses grands objets APRÈS le corps d’amorçage', () => {
    // si ce test tombe, c'est que le module a été réordonné — relire le
    // raisonnement ci-dessus avant de toucher au reste
    for (const nom of TARDIFS)
      expect(SRC.includes(`\nconst ${nom} = new `), nom).toBe(true)
  })

  it('n’appelle AUCUN objet tardif dans une fonction lancée au chargement', () => {
    const naissances = TARDIFS.map((n) => SRC.indexOf(`\nconst ${n} = new `))
    const premiere = Math.min(...naissances.filter((i) => i >= 0))
    const amorce = SRC.slice(0, premiere)

    // les fonctions appelées au niveau du module, avant cette naissance
    const appelees = [...amorce.matchAll(/^([a-zA-Z_$][\w$]*)\(\)/gm)].map(
      (m) => m[1],
    )
    expect(appelees.length).toBeGreaterThan(5) // le test regarde bien quelque chose
    expect(appelees).toContain('applyLevel') // celle qui a cassé l'accueil

    const fautes: string[] = []
    for (const nom of appelees) {
      const corps = corpsDe(nom)
      if (!corps) continue
      for (const tardif of TARDIFS)
        if (new RegExp(`\\b${tardif}\\s*\\.`).test(corps))
          fautes.push(`${nom}() touche ${tardif}`)
    }
    expect(fautes).toEqual([])
  })
})
