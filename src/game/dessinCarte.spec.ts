import { describe, expect, it } from 'vitest'
import { CARTE_LIVREE, cloneCarte } from './carteStation'
import { dessinCarteSVG, octogone, type OptionsDessin } from './dessinCarte'

const base: OptionsDessin = {
  courant: null,
  visites: [],
  selection: null,
  lienSelection: null,
  orbes: [],
  mode: 'editeur',
  afficherTemp: true,
  grille: 8,
}
const compte = (s: string, re: RegExp): number => (s.match(re) ?? []).length

describe('dessinCarteSVG — le plan, depuis les données', () => {
  it('dessine chaque module et chaque coursive, dans un seul SVG', () => {
    const svg = dessinCarteSVG(CARTE_LIVREE, base)
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('viewBox="0 0 1600 804"')
    expect(compte(svg, /class="cs-mod /g)).toBe(11)
    // la ligne de route colorée : une par coursive (les prises en plus en édition)
    expect(compte(svg, /class="cs-route[ "]/g)).toBe(12)
    expect(compte(svg, /class="cs-lien-prise"/g)).toBe(12)
  })

  it('reprend la maquette : octogone 22/78/28/72, rond pour la jonction, dôme pour le terminal', () => {
    expect(octogone(0, 0, 100, 50)).toBe('22,0 78,0 100,14 100,36 78,50 22,50 0,36 0,14')
    const svg = dessinCarteSVG(CARTE_LIVREE, base)
    expect(svg).toMatch(/data-mod="N"[^>]*>.*?<circle cx="666" cy="385"/s)
    expect(svg).toMatch(/data-mod="OBS"[^>]*>.*?url\(#cs-dome\)/s)
  })

  it('pose les badges des transfos, et les coursives en trois traits', () => {
    const svg = dessinCarteSVG(CARTE_LIVREE, base)
    expect(svg).toContain('❄ GLACE')
    expect(svg).toContain('💨 GAZ')
    // paroi, sol, anneaux « 4 44 » — pour les 12 coursives
    expect(compte(svg, /stroke-dasharray="4 44"/g)).toBe(12)
  })

  it('applique la règle du hub au tracé (sortie bornée à ±110)', () => {
    const svg = dessinCarteSVG(CARTE_LIVREE, base)
    expect(svg).toContain('d="M263 270 L507 231"')
    expect(svg).toContain('d="M263 490 L507 539"')
  })

  it('en mode jeu : le courant pulse, les cibles s’allument, le verrou se voit', () => {
    const svg = dessinCarteSVG(CARTE_LIVREE, { ...base, mode: 'jeu', courant: 'HUB', selection: 'T2' })
    expect(svg).toMatch(/data-mod="HUB"[^>]*class=|class="cs-mod cs-sas cs-courant/)
    expect(svg).toContain('class="cs-mod cs-sas cs-courant"')
    // T2 (voie libre) est une cible ; T1 (glace) et T3 (vapeur) sont verrouillés en état eau
    expect(svg).toContain('cs-cible cs-sel" data-mod="T2"')
    expect(svg).toMatch(/cs-verrou" data-mod="T1"/)
    expect(svg).toMatch(/cs-verrou" data-mod="T3"/)
    expect(compte(svg, /🔒/g)).toBe(2)
    // les coursives actives (depuis le courant) portent l'animation
    expect(compte(svg, /cs-active/g)).toBe(3)
  })

  it('avec l’orbe de solidification, la transfo glace s’ouvre et la transfo gaz reste close', () => {
    const svg = dessinCarteSVG(CARTE_LIVREE, { ...base, mode: 'jeu', courant: 'HUB', orbes: ['solidification'] })
    expect(svg).toMatch(/cs-cible" data-mod="T1"/)
    expect(svg).toMatch(/cs-verrou" data-mod="T3"/)
  })

  it('une coursive parcourue s’efface à 35 %', () => {
    const svg = dessinCarteSVG(CARTE_LIVREE, { ...base, mode: 'jeu', courant: 'N', visites: ['HUB', 'T2'] })
    expect(svg).toMatch(/cs-parcourue" data-lien="1" d="M263 385 L507 385"[^>]*opacity="0.35"/)
  })

  it('le mode éditeur ajoute grille, flèches de sens et poignées du module choisi', () => {
    const svg = dessinCarteSVG(CARTE_LIVREE, { ...base, selection: 'T2' })
    expect(svg).toContain('id="cs-grille"')
    expect(compte(svg, /class="cs-sens"/g)).toBe(12)
    expect(compte(svg, /data-poignee="/g)).toBe(4)
    const jeu = dessinCarteSVG(CARTE_LIVREE, { ...base, mode: 'jeu', courant: 'HUB' })
    expect(jeu).not.toContain('cs-grille')
    expect(jeu).not.toContain('cs-sens')
    // les niveaux du biome ne se lisent qu'en édition
    expect(svg).toContain('3 NIV. · T2')
    expect(jeu).not.toContain('NIV.')
    expect(jeu).not.toContain('data-poignee')
  })

  it('dessine le décor depuis les données : l’arc, le télescope et son tube', () => {
    const svg = dessinCarteSVG(CARTE_LIVREE, base)
    expect(svg).toContain('data-decor="arc"')
    expect(svg).toContain('data-decor="telescope"')
    expect(svg).toContain('translate(1222 426) rotate(-33)')
    const sans = cloneCarte(CARTE_LIVREE)
    sans.decor = []
    expect(dessinCarteSVG(sans, base)).not.toContain('data-decor')
  })

  it('échappe les noms : un « < » dans un nom ne casse pas le SVG', () => {
    const c = cloneCarte(CARTE_LIVREE)
    c.modules[1].nom = 'A <B> & "C"'
    const svg = dessinCarteSVG(c, base)
    expect(svg).toContain('A &lt;B&gt; &amp; &quot;C&quot;')
    expect(svg).not.toContain('<B>')
  })
})
