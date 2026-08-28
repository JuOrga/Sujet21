// L'INSTANTANÉ DU SEMIS : la bibliothèque partagée sert le tableau de code
// 'HUB' AVANT le code (hubLevel) — le hub joué est donc l'entrée
// « le-module-meduse-compact ». Pour que le méta du hub compact atteigne
// les joueurs, ops/maj-hub.mjs REMPLACE cette entrée par le JSON ci-dessous.
// Ce test garantit que le JSON semé reflète EXACTEMENT le code : toute
// évolution de TABLEAU_HUB_COMPACT doit régénérer le fichier —
//   MAJ_HUB_JSON=1 npx vitest run src/game/hubExport.spec.ts
// puis pousser la branche gâchette maj-hub-go.

import { readFileSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TABLEAU_HUB_COMPACT } from './hub'

const CHEMIN = new URL('../../ops/hub-compact.json', import.meta.url)
// le code passe à 'HUB' : c'est LUI que hubLevel() cherche en bibliothèque
const attendu = JSON.parse(
  JSON.stringify({ ...TABLEAU_HUB_COMPACT, code: 'HUB' }),
)

if (process.env.MAJ_HUB_JSON)
  writeFileSync(CHEMIN, JSON.stringify(attendu, null, 2) + '\n')

describe('ops/hub-compact.json — le semis suit le code', () => {
  it('le JSON est la copie conforme de TABLEAU_HUB_COMPACT (code HUB)', () => {
    const seme = JSON.parse(readFileSync(CHEMIN, 'utf8'))
    expect(seme).toEqual(attendu)
  })
})
