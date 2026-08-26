// La bulle savante ne doit jamais rester muette : chaque matériau posable
// a sa fiche complète (les trois états racontés), et chaque genre
// d'élément sélectionnable a la sienne.

import { describe, expect, it } from 'vitest'
import { FICHES_MATERIAUX, ficheBox, ficheElement } from './fiches'
import {
  MAT_WALL,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_FROID,
  MAT_GRILLE,
  MAT_CHAUD,
  MAT_MEMBRANE,
  MAT_RIDEAU,
  MAT_SURCHAUFFEUR,
  type LevelDef,
} from '../game/level'

const MATS = [
  MAT_WALL,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_FROID,
  MAT_GRILLE,
  MAT_CHAUD,
  MAT_MEMBRANE,
  MAT_RIDEAU,
  MAT_SURCHAUFFEUR,
]

const niveau: LevelDef = {
  name: 'Banc des fiches',
  code: '21-F',
  journal: '',
  bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
  spawn: { x: 0, y: 0, n: 700 },
  exit: { minX: 900, minY: -100, maxX: 1000, maxY: 100 },
  boxes: [
    { minX: 0, minY: 0, maxX: 100, maxY: 200, material: MAT_CHAUD, angle: 30 },
  ],
  sponges: [
    { minX: 0, minY: 0, cols: 4, rows: 3, cellSize: 20, capacityPerCell: 12 },
  ],
  labels: [{ x: 0, y: 0, text: 'ESSAI', tone: 'mur', rang: 'secteur' }],
  lasers: [{ x: 0, y: 0, angle: 45 }],
  cibles: [{ x: 10, y: 10, r: 14, mode: 'nor', canal: 3 }],
  portes: [{ minX: 0, minY: 0, maxX: 40, maxY: 100, canal: 3, regle: 'et' }],
  zones: [
    { minX: 0, minY: 0, maxX: 50, maxY: 50, force: 'glace', cine: 'ouverture' },
  ],
  caches: [{ minX: 0, minY: 0, maxX: 50, maxY: 50, style: 'paroi' }],
  rails: [
    {
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
    },
  ],
  lumieres: [{ x: 0, y: 0, h: 200 }],
  decals: [{ x: 0, y: 0, w: 60, h: 40, kind: 'vanne' }],
}

describe('les fiches de la bulle savante', () => {
  it('couvre chaque matériau posable, les trois états racontés', () => {
    for (const m of MATS) {
      const f = FICHES_MATERIAUX[m]
      expect(f, `matériau ${m}`).toBeTruthy()
      const cles = f.lignes.map((l) => l.cle)
      expect(cles, `matériau ${m}`).toContain('EAU')
      expect(cles, `matériau ${m}`).toContain('GLACE')
      expect(cles, `matériau ${m}`).toContain('VAPEUR')
    }
  })

  it('la fiche d’une paroi posée ajoute sa géométrie vive', () => {
    const f = ficheBox(niveau.boxes[0])!
    const geo = f.lignes[f.lignes.length - 1].txt
    expect(geo).toContain('30°')
    expect(geo).toContain('100 × 200')
  })

  it('chaque genre sélectionnable a sa fiche, paramètres vifs compris', () => {
    const genres: [string, string][] = [
      ['exit', 'bonbonne'],
      ['spawn', '700 particules'],
      ['sponge', '4 × 3'],
      ['laser', '45°'],
      ['cible', 'Canal n° 3'],
      ['porte', 'Règle ET'],
      ['zone', 'GLACE'],
      ['cache', 'FACTICE'],
      ['rail', 'IONISÉ'],
      ['lumiere', 'Hauteur 200'],
      ['decal', 'Aucune physique'],
      ['label', 'SECTEUR'],
    ]
    for (const [kind, attendu] of genres) {
      const f = ficheElement({ kind, index: 0 }, niveau)
      expect(f, kind).toBeTruthy()
      const tout = [f!.titre, f!.resume, ...f!.lignes.map((l) => l.txt)].join(
        ' ',
      )
      expect(tout, kind).toContain(attendu)
    }
  })

  it('la cible NOR raconte le scellement, la TOR le verrou ouvrant', () => {
    const nor = ficheElement({ kind: 'cible', index: 0 }, niveau)!
    expect(nor.titre).toContain('NOR')
    expect([nor.resume, ...nor.lignes.map((l) => l.txt)].join(' ')).toContain(
      'scelle',
    )
    const tor = ficheElement(
      { kind: 'cible', index: 0 },
      { ...niveau, cibles: [{ x: 0, y: 0, r: 14 }] },
    )!
    expect(tor.titre).toContain('TOR')
    expect(tor.resume).toContain('seul passage')
  })
})
