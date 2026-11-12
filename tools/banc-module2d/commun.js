// ce que les deux pages du banc partagent : la vue d'essai, lue dans l'adresse
import * as M from '/src/render/module2d.ts'
export const q = new URLSearchParams(location.search)
export const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d)
const ICONES = ['eau', 'glace', 'vapeur', 'toutes', 'pool', 'figure', 'rencontre', 'economat', 'repos', 'don', 'minijeu', 'coffre']
export function vueDEssai() {
  const biome = q.get('biome') ?? 'tempere'
  const forme = q.get('forme') ?? M.formeDuBiome(biome)
  const rangs = num('rangs', 6), voies = num('voies', 3), rang = num('rang', 2), voie = num('voie', 1)
  const joues = (q.get('joues') ?? '1,1').split(',').filter(Boolean).map(Number)
  const suivants = (r, v) => [v - 1, v, v + 1].filter((w) => w >= 0 && w < voies && ((r * 7 + v * 3 + w) % 4 !== 0 || w === v))
  // un nœud sur quatre n'est pas une salle, une salle sur six porte une prime
  const noeud = (r, v) => {
    const h = (r * 5 + v * 3) % 12
    const ic = r === 0 ? 'eau' : (r + v) % 4 === 1 ? ICONES[6 + ((r * 2 + v) % 6)] : ICONES[h % 6]
    return { icone: q.get('icones') === '0' ? '' : ic, prime: (r * 3 + v) % 6 === 5 }
  }
  return { biome, forme, vue: { rangs, voies, rang, voie, joues, suivants, noeud } }
}
