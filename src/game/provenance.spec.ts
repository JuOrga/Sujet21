import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PROVENANCE } from './provenance'

const vite = readFileSync(
  fileURLToPath(new URL('../../vite.config.ts', import.meta.url)),
  'utf8',
)
const main = readFileSync(
  fileURLToPath(new URL('../main.ts', import.meta.url)),
  'utf8',
)

describe('Provenance du paquet — d’où vient ce qu’on mesure', () => {
  // Vitest lit la MÊME configuration que la construction : la constante est
  // donc injectée ici aussi, avec ce que git répond dans le dépôt de
  // travail. Ce qu'on garde, c'est le CONTRAT — deux chaînes non vides, et
  // un commit qui est soit un vrai court (sept hexadécimaux), soit l'aveu
  // « inconnu ». Un rapport ne doit jamais porter une provenance vide :
  // elle se lirait comme une absence de réponse, pas comme une réponse.
  it('tient son contrat : deux chaînes, jamais vides', () => {
    expect(PROVENANCE.commit).toMatch(/^([0-9a-f]{7}|inconnu)$/)
    expect(PROVENANCE.branche.length).toBeGreaterThan(0)
  })

  // Le repli n'est pas décoratif — il n'est simplement pas observable
  // d'ici. C'est lui qui tient quand ce module est exécuté hors de Vite
  // (un script, un éditeur) : sans lui, l'import ferait tomber main.ts.
  it('garde un repli pour qui l’exécute hors de Vite', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./provenance.ts', import.meta.url)),
      'utf8',
    )
    expect(source).toContain("typeof __PROVENANCE__ === 'object'")
    expect(source).toContain("commit: 'inconnu'")
  })

  // LA GARDE. Le mécanisme d'injection est en trois morceaux — la
  // déclaration ici, le `define` de vite.config.ts, le `--build-env` du
  // workflow. Qu'un seul disparaisse et tous les paquets redeviennent
  // « inconnu » : le rapport ne mentirait pas, mais l'A/B redeviendrait
  // aveugle, et rien ne le signalerait avant la prochaine mesure perdue.
  it('est bien injectée par la configuration de construction', () => {
    expect(vite).toContain('__PROVENANCE__')
    expect(vite).toContain('VITE_COMMIT')
    expect(vite).toContain('VITE_BRANCHE')
  })

  it('voyage dans le rapport de performance ET s’affiche avant la mesure', () => {
    // dans le rapport : c'est ce qui rattache une mesure à un paquet
    expect(main).toContain('commit: PROVENANCE.commit')
    expect(main).toContain('branche: PROVENANCE.branche')
    // et à l'écran : on veut le lire AVANT de mesurer, pas après
    expect(main).toMatch(/perfVif\.textContent[\s\S]{0,120}PROVENANCE\.commit/)
  })
})
