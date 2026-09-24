import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// LES TROIS ÉTATS RESTENT TOUJOURS AU CADRAN.
//
// En passant de liquide à glace, le logement de la VAPEUR disparaissait :
// la SUBLIMATION n'étant pas tissée, le cadran le cachait (hidden), comme
// si l'état n'existait pas. Voulu : les trois logements toujours en place,
// celui dont le lien n'est pas tissé GRISÉ, un petit cadenas au coin.
//
// main.ts ne s'importe pas en test : on lit sa source, comme
// main-amorce.spec.ts ; index.html de même pour le style.

const SRC = readFileSync(new URL('./main.ts', import.meta.url), 'utf-8')
const HTML = readFileSync(new URL('../index.html', import.meta.url), 'utf-8')

const corps = (nom: string): string =>
  SRC.match(new RegExp(`function ${nom}\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? ''

describe('le cadran des états', () => {
  it('ne cache jamais un logement : un lien non tissé le grise', () => {
    const maj = corps('majCadranEtats')
    expect(maj).toContain('s.el.hidden = false')
    expect(maj).not.toMatch(/s\.el\.hidden = !/)
    // cadenassé dès que le lien n'est pas tenu — plus seulement après un refus
    expect(maj).toContain('const verrouille = !estCur && !tenue')
    expect(maj).toContain("s.el.classList.toggle('st-verrou', verrouille)")
    expect(maj).toContain("if (verrouille) kbd.innerHTML = picto('verrou')")
  })

  it('un logement cadenassé reste touchable : le refus se dit', () => {
    expect(corps('majCadranEtats')).toContain('s.el.disabled = zone\n')
  })

  it('le style grise le logement et montre le cadenas même au doigt', () => {
    expect(HTML).toMatch(/#statebar button\.st-verrou \{\s*--teinte: var\(--dim\);/)
    // #statebar kbd est masqué au doigt (pointer: coarse) : le cadenas, non
    expect(HTML).toMatch(/#statebar button\.st-verrou kbd \{[^}]*display: block;/)
  })
})
