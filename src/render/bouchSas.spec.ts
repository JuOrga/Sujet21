import { describe, expect, it } from 'vitest'
import { COMPOSE_FS } from './renderer'

// LA BOUCHE DU SAS est l'accent SARCELLE de la cuve (docs/charte-visuelle.md
// §3, docs/assets-ia.md §4) : son anneau et ses stries étaient VERTS, la
// couleur que la charte réserve à la serre. Ce test lit les teintes posées
// autour de l'iris : aucune ne doit tirer sur le vert (vert > bleu).
describe('la bouche du sas, en sarcelle', () => {
  it('ses stries et ses anneaux ont plus de bleu que de vert', () => {
    const debut = COMPOSE_FS.indexOf('halo de courant')
    const fin = COMPOSE_FS.indexOf('Relief d', debut)
    expect(debut).toBeGreaterThan(0)
    const bloc = COMPOSE_FS.slice(debut, fin)
    const teintes = [...bloc.matchAll(/col \+= vec3\(([\d.]+), ([\d.]+), ([\d.]+)\) \* (?:ring|streaks)/g)].map((m) => m.slice(1).map(Number))
    expect(teintes.length).toBe(3)
    for (const [, g, b] of teintes) expect(b).toBeGreaterThan(g)
  })
})
