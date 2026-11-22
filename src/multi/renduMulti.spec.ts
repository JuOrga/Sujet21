import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RAYON_COINS, TERRAIN } from './hockey'
import { REGARD_PORTEE, STADE, coeursDe, tourneRegard } from './renduMulti'
import { Hote } from './partie'
import { MODE_LIBRE, attributs, particulesVides, type Particules } from './trame'

// Le rendu lui-même est un shader : il se juge à l'œil, dans un navigateur.
// Ce qui le NOURRIT se teste ici — le cœur de chaque corps, autour duquel le
// miroir est radial, et le regard, qui se tourne vers ce que le joueur vise.

/** Un disque plein de particules de corps du joueur `j`, de rayon `r`, plus
 *  des gouttes libres au loin (qui ne doivent pas compter). */
function disque(p: Particules, j: number, cx: number, cy: number, r: number, pas = 6): void {
  for (let y = -r; y <= r; y += pas) {
    for (let x = -r; x <= r; x += pas) {
      if (x * x + y * y > r * r) continue
      p.x[p.n] = cx + x
      p.y[p.n] = cy + y
      p.attr[p.n] = attributs(j, true, 0)
      p.n++
    }
  }
}
function goutte(p: Particules, j: number, x: number, y: number, orpheline = false): void {
  p.x[p.n] = x
  p.y[p.n] = y
  p.attr[p.n] = attributs(orpheline ? 4 : j, false, 0)
  p.n++
}

describe('rendu du multi — le cœur des corps', () => {
  it('le cœur est le centre des particules DU CORPS, et son rayon celui du disque', () => {
    const p = particulesVides(4096)
    disque(p, 0, 700, 600, 100)
    disque(p, 1, 2100, 650, 60)
    // des gouttes en vol, une matière sans maître : ni l'une ni l'autre ne
    // tire le cœur à elle
    goutte(p, 0, 3000, 100)
    goutte(p, 0, 2900, 120)
    goutte(p, 1, 0, 0, true)
    const c = coeursDe(p, new Float32Array(16))
    expect(c[0]).toBeCloseTo(700, 0)
    expect(c[1]).toBeCloseTo(600, 0)
    expect(c[3]).toBe(1)
    expect(c[4]).toBeCloseTo(2100, 0)
    expect(c[5]).toBeCloseTo(650, 0)
    // √2 fois l'écart quadratique rend le rayon d'un disque plein (à la
    // maille près : 6 u)
    expect(Math.abs(c[2] - 100)).toBeLessThan(4)
    expect(Math.abs(c[6] - 60)).toBeLessThan(4)
    // personne aux canaux 2 et 3
    expect(Array.from(c.subarray(8, 16))).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('un corps réduit à quelques particules n’a pas de cœur', () => {
    const p = particulesVides(64)
    for (let k = 0; k < 11; k++) {
      p.x[k] = 500 + k
      p.y[k] = 500
      p.attr[k] = attributs(0, true, 0)
    }
    p.n = 11
    const c = coeursDe(p, new Float32Array(16).fill(7))
    expect(Array.from(c.subarray(0, 4))).toEqual([0, 0, 0, 0])
  })
})

describe('rendu du multi — le regard', () => {
  it('il se tourne vers le point visé, sans sortir de la masse', () => {
    const e = new Float32Array(4)
    // né : posé d'emblée, à sa portée, du côté visé
    tourneRegard(e, 0, 1000, 500, 100, true, 1900, 500, 0.016)
    expect(e[0]).toBeCloseTo(REGARD_PORTEE * 100, 3)
    expect(e[1]).toBeCloseTo(0, 3)
    expect(e[2]).toBe(1)
    // la visée passe en bas : il la rejoint, pas d'un coup
    tourneRegard(e, 0, 1000, 500, 100, true, 1000, 1400, 0.016)
    expect(e[0]).toBeGreaterThan(REGARD_PORTEE * 100 * 0.7)
    expect(e[1]).toBeGreaterThan(0)
    let plusLoin = 0
    for (let k = 0; k < 60; k++) {
      tourneRegard(e, 0, 1000, 500, 100, true, 1000, 1400, 0.016)
      plusLoin = Math.max(plusLoin, Math.hypot(e[0], e[1]))
    }
    expect(e[0]).toBeCloseTo(0, 1)
    expect(e[1]).toBeCloseTo(REGARD_PORTEE * 100, 1)
    // en route il n'a jamais dépassé sa portée (une corde, pas un détour)
    expect(plusLoin).toBeLessThanOrEqual(REGARD_PORTEE * 100 + 1e-3)
  })

  it('visé SUR le corps, le regard s’y pose (il ne file pas au bord)', () => {
    const e = new Float32Array(4)
    tourneRegard(e, 0, 1000, 500, 100, true, 1012, 495, 0.016)
    expect(e[0]).toBeCloseTo(12, 3)
    expect(e[1]).toBeCloseTo(-5, 3)
  })

  it('c’est un ÉCART au cœur : le corps peut filer, le regard le suit d’un bloc', () => {
    const e = new Float32Array(4)
    tourneRegard(e, 0, 1000, 500, 100, true, 1900, 500, 0.016)
    const avant = e[0]
    // le corps a fait 400 u d'une image à l'autre, la visée a suivi
    tourneRegard(e, 0, 1400, 500, 100, true, 2300, 500, 0.016)
    expect(e[0]).toBeCloseTo(avant, 3)
  })

  it('un corps sans cœur n’a pas de regard, et le retrouve d’emblée', () => {
    const e = new Float32Array(4)
    tourneRegard(e, 0, 1000, 500, 100, true, 1900, 500, 0.016)
    tourneRegard(e, 0, 0, 0, 0, false, 1900, 500, 0.016)
    expect(e[2]).toBe(0)
    tourneRegard(e, 0, 300, 300, 80, true, 300, -900, 0.016)
    expect(e[0]).toBeCloseTo(0, 3)
    expect(e[1]).toBeCloseTo(-REGARD_PORTEE * 80, 3)
    expect(e[2]).toBe(1)
  })
})

describe('rendu du multi — ce qui suit le corps à chaque image', () => {
  it('le centre des particules bouge à CHAQUE pas ; l’état du corps, un pas sur cinq', () => {
    // C'est pourquoi le réticule de la manette (ecranMulti.ts) s'accroche au
    // centre des particules : accroché à l'état du corps, il avançait par
    // sauts (le concepteur, 22/11 : « il saccade, alors que le reste est
    // fluide »). Si ce test tombe parce que l'état devient frais à chaque
    // pas, l'accroche aux particules reste juste, elle n'est plus nécessaire.
    const h = new Hote(2, undefined, MODE_LIBRE)
    const c = h.sim.corps[0].stats
    h.commande(0, { pousse: true, ouvert: false, x: c.centroidX - 400, y: c.centroidY })
    for (let s = 0; s < 60; s++) h.avance(h.params.dt, 1e9)
    const sortie = new Float32Array(16)
    let etatBouge = 0
    let particulesBougent = 0
    let etat = h.corps()[0].x
    let vu = coeursDe(h.vue(), sortie)[0]
    for (let s = 0; s < 20; s++) {
      h.avance(h.params.dt, 1e9)
      const e = h.corps()[0].x
      const v = coeursDe(h.vue(), sortie)[0]
      if (e !== etat) etatBouge++
      if (v !== vu) particulesBougent++
      etat = e
      vu = v
    }
    expect(particulesBougent).toBe(20)
    expect(etatBouge).toBeLessThanOrEqual(5)
    // et les deux disent le même corps (à la goutte près)
    expect(Math.abs(vu - etat)).toBeLessThan(10)
  })
})

describe('rendu du multi — le stade du hockey', () => {
  // L'image du stade est rendue dans Blender (tools/images/blender/
  // stade_hockey.py) et posée sous la patinoire par le shader. Si l'un des
  // deux bouge sans l'autre, la rambarde peinte ne tombe plus sur le bord du
  // terrain : on le lit dans le script lui-même.
  const script = readFileSync(join(__dirname, '../../tools/images/blender/stade_hockey.py'), 'utf-8')
  const nombres = (motif: RegExp): number[] => {
    const m = script.match(motif)
    if (!m) throw new Error('introuvable dans le script : ' + motif)
    return m[1].split(',').map((x) => Number(x.trim()))
  }

  it('le script modélise la piste du jeu (1 unité Blender = 100 unités du monde)', () => {
    const [largeur, hauteur] = nombres(/^LARGEUR, HAUTEUR = ([^#\n]+)/m)
    expect(largeur * 100).toBeCloseTo(TERRAIN.maxX - TERRAIN.minX, 6)
    expect(hauteur * 100).toBeCloseTo(TERRAIN.maxY - TERRAIN.minY, 6)
    const [rayon] = nombres(/^RAYON_COINS = ([^#\n]+)/m)
    expect(rayon * 100).toBeCloseTo(RAYON_COINS, 6)
  })

  it('l’image couvre le rectangle que le shader croit (le y de Blender est l’opposé de celui du jeu)', () => {
    const [xMin, xMax, yMin, yMax] = nombres(/^CADRE = \(([^)]+)\)/m)
    expect(xMin * 100).toBeCloseTo(STADE.minX, 6)
    expect((xMax - xMin) * 100).toBeCloseTo(STADE.largeur, 6)
    // le haut de l'image (y Blender le plus grand) est le y du jeu le plus petit
    expect(-yMax * 100).toBeCloseTo(STADE.minY, 6)
    expect((yMax - yMin) * 100).toBeCloseTo(STADE.hauteur, 6)
    // et la patinoire est dedans, avec de quoi voir les gradins autour
    expect(STADE.minX).toBeLessThan(TERRAIN.minX - 400)
    expect(STADE.minY).toBeLessThan(TERRAIN.minY - 400)
    expect(STADE.minX + STADE.largeur).toBeGreaterThan(TERRAIN.maxX + 400)
    expect(STADE.minY + STADE.hauteur).toBeGreaterThan(TERRAIN.maxY + 400)
  })

  it('l’image livrée a les proportions du rectangle', () => {
    // l'en-tête d'un WebP (VP8 avec perte) : la largeur et la hauteur, sur
    // 14 bits, aux octets 26 à 29
    const octets = readFileSync(join(__dirname, '../../public', STADE.url))
    expect(octets.subarray(0, 4).toString('ascii')).toBe('RIFF')
    expect(octets.subarray(8, 12).toString('ascii')).toBe('WEBP')
    expect(octets.subarray(12, 16).toString('ascii')).toBe('VP8 ')
    const largeur = octets.readUInt16LE(26) & 0x3fff
    const hauteur = octets.readUInt16LE(28) & 0x3fff
    expect(largeur / hauteur).toBeCloseTo(STADE.largeur / STADE.hauteur, 2)
    // assez fine pour l'écran : au moins 0,7 pixel par unité du monde (une
    // patinoire de 2 880 u occupe ~1 900 pixels d'un écran de 1080)
    expect(largeur / STADE.largeur).toBeGreaterThanOrEqual(0.7)
  })
})
