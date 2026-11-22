import { describe, expect, it } from 'vitest'
import { AMORTI, AMORTI_QUITTE, ENCRE_MAX, Nappe, Ressort, SEUIL_CALME, SOUS_PAS, SOUS_TEXTE } from './onde'

// L'EAU D'UNE CARTE DU TIRAGE (onde.ts, ondeVue.ts). L'effet d'avant
// sautait d'un événement à l'autre et se remettait à plat d'un coup : « ça
// fait buggé, pas fluide, pas beau » (le concepteur, 22/11). Ces gardes
// tiennent ce qui le rend fluide (une physique stable, qui se calme d'elle-
// même), lisible (une encre plafonnée sous le texte) et tenable à 60 i/s.

// la nappe de la plus grande carte du tirage, à 4 px la maille (ondeVue.ts,
// MAILLE_PX) : 361 × 389 px au banc, en 1280 × 800
const W = 90
const H = 97
/** les pas d'onde pour `s` secondes à 60 images par seconde */
const pasPour = (s: number): number => Math.round(s * 60 * SOUS_PAS)

describe('la nappe — une onde qui se calme', () => {
  it('une goutte franche tremble encore à une demi-seconde, et se tait avant deux', () => {
    const n = new Nappe(W, H)
    n.goutte(W / 2, H * 0.36, 5.5, 1.4)
    let crete = 1
    let i = 0
    let mi = 0
    for (; i < pasPour(5) && crete >= SEUIL_CALME; i++) {
      crete = n.pas()
      if (i === pasPour(0.5)) mi = crete
    }
    const duree = i / (60 * SOUS_PAS)
    // à mi-chemin, la carte tremble encore : on la voit onduler
    expect(mi).toBeGreaterThan(SEUIL_CALME * 4)
    // et elle se tait tout à fait (la boucle d'images s'arrête) avant deux
    // secondes — à l'œil, bien avant : sous un centième de crête, l'éclat
    // ne pose plus que quelques niveaux d'encre (mesuré : 1,84 s au seuil)
    expect(duree).toBeGreaterThan(0.6)
    expect(duree).toBeLessThan(2)
  })

  it('une carte quittée se tait au moins deux fois plus vite que la carte visée', () => {
    const silence = (amorti: number): number => {
      const n = new Nappe(W, H)
      n.goutte(W / 2, H * 0.36, 5.5, 1.4)
      let i = 0
      while (i < pasPour(5) && n.pas(amorti) >= SEUIL_CALME) i++
      return i / (60 * SOUS_PAS)
    }
    expect(silence(AMORTI_QUITTE)).toBeLessThan(silence(AMORTI) / 2 + 0.05)
    expect(silence(AMORTI_QUITTE)).toBeGreaterThan(0.4) // elle se calme, elle ne s'éteint pas d'un coup
  })

  it('reste stable : aucune crête ne grandit, même sous un sillage rageur', () => {
    const n = new Nappe(W, H)
    let max = 0
    for (let t = 0; t < 600; t++) {
      // un pointeur qui fait des allers-retours à pleine vitesse
      const x = W / 2 + Math.sin(t / 3) * W * 0.4
      n.goutte(x, H / 2, 3.5, -0.2)
      const c = n.pas()
      if (t > 300) max = Math.max(max, c)
      expect(Number.isFinite(c)).toBe(true)
    }
    // le régime établi est borné : la cuve ne déborde pas
    expect(max).toBeLessThan(3)
  })

  it('renvoie l’onde sur ses bords : la carte est une cuve, la vague revient', () => {
    const n = new Nappe(W, H)
    n.goutte(10, H / 2, 5, 1)
    // le front file vers la droite, touche le bord, et revient : au centre,
    // on le voit passer deux fois
    let passages = 0
    let haut = false
    for (let i = 0; i < pasPour(1.2); i++) {
      n.pas()
      const v = Math.abs(n.hauteur(W / 2, H / 2)) > 0.01
      if (v && !haut) passages++
      haut = v
    }
    expect(passages).toBeGreaterThanOrEqual(2)
  })

  it('l’amortissement reste celui d’un liquide, pas d’une gelée', () => {
    expect(AMORTI).toBeGreaterThan(0.95)
    expect(AMORTI).toBeLessThan(1)
  })

  it('aplanit() rend la nappe à plat, d’un coup', () => {
    const n = new Nappe(W, H)
    n.goutte(W / 2, H / 2, 5, 1)
    n.pas()
    n.aplanit()
    expect(n.pas()).toBe(0)
  })
})

describe('l’ombrage — lisible sous le texte', () => {
  it('ne pose jamais plus que ENCRE_MAX, même sous la plus forte vague', () => {
    const n = new Nappe(W, H)
    for (let k = 0; k < 12; k++) n.goutte(10 + k * 6, 20 + k * 5, 3, k % 2 ? 4 : -4)
    const rgba = new Uint8ClampedArray(W * H * 4)
    let maxA = 0
    for (let i = 0; i < 40; i++) {
      n.pas()
      n.ombre(rgba)
      for (let o = 3; o < rgba.length; o += 4) if (rgba[o] > maxA) maxA = rgba[o]
    }
    expect(maxA).toBeGreaterThan(255 * ENCRE_MAX * 0.8) // elle se voit
    expect(maxA).toBeLessThanOrEqual(Math.ceil(255 * ENCRE_MAX))
  })

  it('sous une ligne de texte, le masque retient l’éclat à SOUS_TEXTE du plafond', () => {
    const n = new Nappe(W, H)
    // une bande de texte au milieu de la carte
    n.masque = new Float32Array(W * H).fill(1)
    for (let j = 40; j < 60; j++) for (let i = 0; i < W; i++) n.masque[j * W + i] = SOUS_TEXTE
    for (let k = 0; k < 12; k++) n.goutte(10 + k * 6, 30 + k * 3, 3, k % 2 ? 4 : -4)
    const rgba = new Uint8ClampedArray(W * H * 4)
    let dessous = 0
    let ailleurs = 0
    for (let i = 0; i < 40; i++) {
      n.pas()
      n.ombre(rgba)
      for (let j = 0; j < H; j++) {
        for (let x = 0; x < W; x++) {
          const o = (j * W + x) * 4
          if (rgba[o] < 60) continue // l'ombre n'est pas retenue : elle aide le texte clair
          if (j >= 40 && j < 60) dessous = Math.max(dessous, rgba[o + 3])
          else ailleurs = Math.max(ailleurs, rgba[o + 3])
        }
      }
    }
    expect(ailleurs).toBeGreaterThan(255 * ENCRE_MAX * 0.8) // l'eau reste vive hors du texte
    expect(dessous).toBeLessThanOrEqual(Math.ceil(255 * ENCRE_MAX * SOUS_TEXTE))
  })

  it('sous le texte, au plus fort de l’éclat : 4,5:1 pour la légende, 7:1 pour le texte', () => {
    // le plus clair : le reflet pâle (217, 236, 247) à ENCRE_MAX × SOUS_TEXTE
    // sur la coque d'une carte visée (--panel-solid #0a1420 sous le voile
    // du spécimen à 9 %), sous l'encre du texte (--ink #d9ecf7) et celle des
    // légendes (--dim #7f9cb0, déjà à 5,6:1 au repos)
    const lin = (c: number): number => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
    const lum = (r: number, g: number, b: number): number => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    const coque = [10 + 0.09 * 89, 20 + 0.09 * 163, 32 + 0.09 * 198]
    const a = ENCRE_MAX * SOUS_TEXTE
    const fond = lum(...([217, 236, 247].map((c, k) => c * a + coque[k] * (1 - a)) as [number, number, number]))
    const contraste = (l: number): number => (l + 0.05) / (fond + 0.05)
    expect(contraste(lum(0xd9, 0xec, 0xf7))).toBeGreaterThan(7)
    expect(contraste(lum(0x7f, 0x9c, 0xb0))).toBeGreaterThan(4.5)
  })

  it('une nappe calme ne peint rien : la carte au repos est la carte d’avant', () => {
    const n = new Nappe(W, H)
    const rgba = new Uint8ClampedArray(W * H * 4)
    n.ombre(rgba)
    expect(rgba.every((v, i) => i % 4 !== 3 || v === 0)).toBe(true)
  })
})

describe('le coût d’une image', () => {
  it('trois pas d’onde et l’ombrage tiennent bien sous 2 ms par carte', () => {
    // le budget d'une image à 60 i/s est de 16,7 ms ; le Steam Deck et un
    // téléphone vont trois à cinq fois moins vite que la machine des tests :
    // à moins de 2 ms ici, deux cartes qui tremblent ensemble (la quittée
    // et la visée) restent loin du budget
    const n = new Nappe(W, H)
    const rgba = new Uint8ClampedArray(W * H * 4)
    n.goutte(W / 2, H / 2, 5, 1.4)
    for (let i = 0; i < 30; i++) { for (let k = 0; k < SOUS_PAS; k++) n.pas(); n.ombre(rgba) }
    const t0 = performance.now()
    const N = 200
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < SOUS_PAS; k++) n.pas()
      n.ombre(rgba)
    }
    const ms = (performance.now() - t0) / N
    expect(ms).toBeLessThan(2)
  })
})

describe('le ressort — rejoindre sa cible sans sauter', () => {
  it('ne saute pas : d’une image à l’autre, la valeur avance par petits pas', () => {
    const r = new Ressort(0, 150, 13)
    r.cible = 5 // l'inclinaison au bord de la carte
    let avant = 0
    let ecart = 0
    for (let i = 0; i < 120; i++) {
      r.pas(1 / 60)
      ecart = Math.max(ecart, Math.abs(r.valeur - avant))
      avant = r.valeur
    }
    expect(ecart).toBeLessThan(5 * 0.25) // jamais plus d'un quart du chemin par image
    expect(r.pose()).toBe(true)
  })

  it('flotte : il dépasse un peu sa cible avant de se poser, sans osciller sans fin', () => {
    const r = new Ressort(0, 210, 16)
    r.cible = -6 // la flottaison de la carte visée
    let min = 0
    let i = 0
    for (; i < 240 && !r.pose(0.05); i++) {
      r.pas(1 / 60)
      min = Math.min(min, r.valeur)
    }
    expect(min).toBeLessThan(-6.05) // le léger dépassement
    expect(min).toBeGreaterThan(-7.5) // … léger
    expect(i / 60).toBeLessThan(1.2) // posé en moins d'une seconde et quart
  })

  it('reste stable à 30 images par seconde', () => {
    const r = new Ressort(0, 420, 11)
    r.vitesse = 0.32
    for (let i = 0; i < 120; i++) r.pas(1 / 30)
    expect(Math.abs(r.valeur)).toBeLessThan(0.001)
  })
})
