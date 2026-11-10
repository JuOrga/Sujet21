import { describe, expect, it } from 'vitest'
import { CARTE_LIVREE, cloneCarte } from './carteStation'
import {
  ETATS_DITS,
  cadreCarte,
  dessinCarteSVG,
  etatModule,
  legendeCarte,
  legendeCarteHTML,
  nomLien,
  octogone,
  type OptionsDessin,
} from './dessinCarte'

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
    expect(svg).toContain('viewBox="0 0 2100 804"')
    expect(compte(svg, /class="cs-mod /g)).toBe(12)
    // le cran se marque sur les deux secteurs du bord, et nulle part ailleurs
    expect(compte(svg, /class="cs-cran"/g)).toBe(3)
    // la ligne de route colorée : une par coursive (les prises en plus en édition)
    expect(compte(svg, /class="cs-route[ "]/g)).toBe(21)
    expect(compte(svg, /class="cs-lien-prise"/g)).toBe(21)
  })

  it('reprend la maquette : octogone 22/78/28/72, rond pour la jonction, dôme pour le terminal', () => {
    expect(octogone(0, 0, 100, 50)).toBe('22,0 78,0 100,14 100,36 78,50 22,50 0,36 0,14')
    // la carte livrée n'a plus de nœud : on en pose un pour le dessin
    const c = cloneCarte(CARTE_LIVREE)
    c.modules.push({ ...c.modules[1], id: 'NOEUD', type: 'jonction', forme: 'rond', x: 650, y: 402, w: 60, h: 60, niveaux: 0, biome: '' })
    const svg = dessinCarteSVG(c, base)
    expect(svg).toMatch(/data-mod="NOEUD"[^>]*>.*?<circle cx="650" cy="402"/s)
    expect(svg).toMatch(/data-mod="OBS"[^>]*>.*?url\(#cs-dome\)/s)
  })

  it('pose les badges des transfos, et les coursives en trois traits', () => {
    const svg = dessinCarteSVG(CARTE_LIVREE, base)
    expect(svg).toContain('❄ GLACE')
    expect(svg).toContain('💨 GAZ')
    // paroi, sol, anneaux « 4 44 » — pour les 12 coursives
    expect(compte(svg, /stroke-dasharray="4 44"/g)).toBe(21)
  })

  it('applique la règle du hub au tracé (sortie bornée à ±110)', () => {
    const svg = dessinCarteSVG(CARTE_LIVREE, base)
    expect(svg).toContain('d="M263 292 L500 210"')
    expect(svg).toContain('d="M263 512 L500 594"')
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
    // seule la coursive OUVERTE coule : les deux verrouillées ne disent pas « par ici »
    expect(compte(svg, /cs-active/g)).toBe(1)
    expect(compte(svg, /cs-fermee/g)).toBe(2)
    expect(svg).toMatch(/class="cs-route cs-principale cs-active" data-lien="1"/)
  })

  it('un module éteint ne laisse pas voir les coursives qui passent dessous', () => {
    // les coursives vont de centre à centre : sous un groupe à 60 %, elles se
    // croisaient à travers le fût. Le socle est plein, seul le corps s'éteint
    const svg = dessinCarteSVG(CARTE_LIVREE, { ...base, mode: 'jeu', courant: 'HUB' })
    const p1 = /<g class="cs-mod[^"]*" data-mod="P1"[^>]*>(.*?)<text class="cs-nom"/s.exec(svg)
    expect(p1).not.toBeNull()
    // le groupe du module n'est plus transparent
    expect(/<g class="cs-mod[^"]*" data-mod="P1"[^>]*>/.exec(svg)![0]).not.toContain('opacity=')
    // un socle à la couleur du fond, PUIS le corps éteint
    expect(p1![1]).toMatch(/class="cs-socle" fill="#030710"\/><g class="cs-corps" opacity="0\.6">/)
  })

  it('avec l’orbe de solidification, la transfo glace s’ouvre et la transfo gaz reste close', () => {
    const svg = dessinCarteSVG(CARTE_LIVREE, { ...base, mode: 'jeu', courant: 'HUB', orbes: ['solidification'] })
    expect(svg).toMatch(/cs-cible" data-mod="T1"/)
    expect(svg).toMatch(/cs-verrou" data-mod="T3"/)
  })

  it('une coursive parcourue s’efface à 35 %', () => {
    const svg = dessinCarteSVG(CARTE_LIVREE, { ...base, mode: 'jeu', courant: 'N', visites: ['HUB', 'T2'] })
    expect(svg).toMatch(/cs-parcourue" data-lien="1" d="M263 402 L500 402"[^>]*opacity="0.35"/)
  })

  it('le mode éditeur ajoute grille, flèches de sens et poignées du module choisi', () => {
    const svg = dessinCarteSVG(CARTE_LIVREE, { ...base, selection: 'T2' })
    expect(svg).toContain('id="cs-grille"')
    expect(compte(svg, /class="cs-sens"/g)).toBe(21)
    expect(compte(svg, /data-poignee="/g)).toBe(4)
    const jeu = dessinCarteSVG(CARTE_LIVREE, { ...base, mode: 'jeu', courant: 'HUB' })
    expect(jeu).not.toContain('cs-grille')
    expect(jeu).not.toContain('cs-sens')
    // les niveaux du biome ne se lisent qu'en édition
    expect(svg).toContain('6 NIV. · tempere')
    expect(jeu).not.toContain('NIV.')
    expect(jeu).not.toContain('data-poignee')
  })

  it('dessine le décor depuis les données : l’arc, le télescope et son tube', () => {
    const svg = dessinCarteSVG(CARTE_LIVREE, base)
    expect(svg).toContain('data-decor="arc"')
    expect(svg).toContain('data-decor="telescope"')
    expect(svg).toContain('translate(1714 443) rotate(-33)')
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

describe('le « ? » sur le plan', () => {
  it('se dessine en point d’interrogation, puis sous sa nature révélée', () => {
    // la carte livrée n'a plus de « ? » : on en pose un pour le dessin
    const c = cloneCarte(CARTE_LIVREE)
    c.modules.push({ ...c.modules[5], id: 'INC', nom: '?', type: 'inconnu', niveaux: 1, cran: 0, x: 630, y: 402 })
    const avant = dessinCarteSVG(c, base)
    expect(avant).toContain('aria-label="? — INCONNU"')
    const apres = dessinCarteSVG(c, { ...base, revelations: { INC: 'combat' } })
    expect(apres).toContain('aria-label="? — COMBAT — COMBAT — confinement +1"')
    expect(compte(apres, /class="cs-cran"/g)).toBe(4)
  })
})

describe('l’état d’un module — où suis-je, où puis-je aller, pourquoi pas ailleurs', () => {
  const jeu: OptionsDessin = { ...base, mode: 'jeu', grille: 0 }
  // au milieu d'une descente : HUB → T2 → C2, l'orbe de glace en poche
  const milieu: OptionsDessin = { ...jeu, courant: 'C2', visites: ['HUB', 'T2'], orbes: ['solidification'] }

  it('distingue ce qui reste sur la route de ce qu’on ne pourra plus atteindre', () => {
    const e = (id: string) => etatModule(CARTE_LIVREE, milieu, id)
    expect(e('C2')).toBe('ici')
    expect(['P1', 'P2', 'P3'].map(e)).toEqual(['joignable', 'joignable', 'joignable'])
    expect(['HUB', 'T2'].map(e)).toEqual(['traverse', 'traverse'])
    expect(['ANTI', 'OBS'].map(e)).toEqual(['plus-loin', 'plus-loin'])
    // derrière le joueur : aucune coursive n'y mène plus
    expect(['T1', 'T3', 'C1', 'C3'].map(e)).toEqual(['ferme', 'ferme', 'ferme', 'ferme'])
    // au hub, sans orbe : les deux transfos sont verrouillées, pas fermées
    expect(etatModule(CARTE_LIVREE, { ...jeu, courant: 'HUB' }, 'T1')).toBe('verrou')
    expect(etatModule(CARTE_LIVREE, { ...jeu, courant: 'HUB' }, 'P1')).toBe('plus-loin')
    // sans joueur (l'éditeur), aucun état
    expect(etatModule(CARTE_LIVREE, base, 'T1')).toBe('neutre')
  })

  it('depuis un cul-de-sac, ce que rouvre le retour n’est pas fermé', () => {
    const c = cloneCarte(CARTE_LIVREE)
    c.liens = c.liens.filter((l) => l.de !== 'P1')
    const o: OptionsDessin = { ...jeu, courant: 'P1', visites: ['HUB', 'T2', 'C2'], retour: 'C2' }
    expect(etatModule(c, o, 'C2')).toBe('retour')
    expect(etatModule(c, o, 'P2')).toBe('plus-loin')
    expect(etatModule(c, o, 'C1')).toBe('ferme')
  })

  it('écrit « VOUS ÊTES ICI » et « OBJECTIF » en toutes lettres, et borde le courant de blanc', () => {
    const svg = dessinCarteSVG(CARTE_LIVREE, milieu)
    expect(compte(svg, /class="cs-plaque /g)).toBe(2)
    expect(svg).toMatch(/data-mod="C2".*?class="cs-bord" fill="#eef8ff".*?cs-plaque-ici.*?VOUS ÊTES ICI/s)
    expect(svg).toMatch(/data-mod="OBS".*?cs-plaque-objectif.*?OBJECTIF/s)
    // arrivé à l'objectif, une seule plaque : on y est
    const fin = dessinCarteSVG(CARTE_LIVREE, { ...jeu, courant: 'OBS', visites: ['HUB'] })
    expect(compte(fin, /class="cs-plaque /g)).toBe(1)
    expect(fin).not.toContain('cs-plaque-objectif')
    // l'éditeur n'a pas de joueur : pas de plaque
    expect(dessinCarteSVG(CARTE_LIVREE, base)).not.toContain('class="cs-plaque ')
  })

  it('met le chemin parcouru en retrait et éteint ce qui est fermé', () => {
    const svg = dessinCarteSVG(CARTE_LIVREE, milieu)
    const corps = (id: string) => new RegExp(`data-mod="${id}".*?<g class="cs-corps" opacity="([\\d.]+)"`, 's').exec(svg)![1]
    expect(corps('C2')).toBe('1')
    expect(corps('P1')).toBe('1')
    expect(corps('OBS')).toBe('1') // l'objectif reste allumé : c'est le cap
    expect(corps('T2')).toBe('0.7')
    expect(corps('ANTI')).toBe('0.6')
    expect(corps('C1')).toBe('0.3')
    expect(svg).toMatch(/cs-ferme" data-mod="C1"/)
  })

  it('dit l’état dans l’étiquette d’accessibilité', () => {
    const svg = dessinCarteSVG(CARTE_LIVREE, milieu)
    expect(svg).toContain(`aria-label="CONDUITS — ÉNIGME — ${ETATS_DITS.ici}"`)
    expect(svg).toContain(`aria-label="PUITS FROID — COMBAT — ${ETATS_DITS.joignable}"`)
    expect(svg).toContain(`aria-label="CRYOSTAT — COMBAT — confinement +1 — ${ETATS_DITS.ferme}"`)
    expect(svg).toContain(`aria-label="OBSERVATOIRE — TERMINAL — confinement +1 — objectif — ${ETATS_DITS['plus-loin']}"`)
  })

  it('range les coursives : l’ouverte s’épaissit, la morte s’efface', () => {
    const svg = dessinCarteSVG(CARTE_LIVREE, milieu)
    // C2 → P1 (une « alt » ouverte d'ici) : 2,5 + 1,5 d'épaisseur, pleine
    expect(svg).toMatch(/class="cs-route cs-active" data-lien="12"[^>]*stroke-width="4"[^>]*opacity="1"/)
    // T1 → C1 part d'un module hors de portée
    expect(svg).toMatch(/class="cs-route cs-morte" data-lien="3"[^>]*opacity="0.2"/)
    // la voie principale, devant : C2 → P2 active, P2 → ANTI à venir
    expect(svg).toMatch(/class="cs-route cs-principale" data-lien="18"[^>]*opacity="0.9"/)
    // aucune coursive morte sans joueur
    expect(dessinCarteSVG(CARTE_LIVREE, base)).not.toContain('cs-morte')
  })
})

describe('le cadre du plan — ce qui se joue, pas toute la scène', () => {
  it('l’éditeur voit la scène entière, le jeu cadre les modules', () => {
    expect(cadreCarte(CARTE_LIVREE, 'editeur')).toEqual({ x: 0, y: 0, w: 2100, h: 804 })
    // HUB (bord gauche 207) à OBSERVATOIRE (bord droit 1603), 110 de marge ;
    // de la plaque au-dessus de T1 à la température sous T3, 14 de marge
    expect(cadreCarte(CARTE_LIVREE, 'jeu')).toEqual({ x: 97, y: 102, w: 1616, h: 616 })
    const svg = dessinCarteSVG(CARTE_LIVREE, { ...base, mode: 'jeu', courant: 'HUB' })
    expect(svg).toContain('viewBox="97 102 1616 616"')
  })

  it('tient chaque module, son étiquette et sa plaque dans le cadre, sans sortir de la scène', () => {
    const c = cloneCarte(CARTE_LIVREE)
    // un nom sur deux lignes tout en bas, un module à cheval sur le bord droit
    c.modules.find((m) => m.id === 'T3')!.nom = 'TRANSFORMATEUR À GAZ'
    c.modules.find((m) => m.id === 'OBS')!.x = 2040
    const k = cadreCarte(c, 'jeu')
    for (const m of c.modules) {
      expect(m.x - m.w / 2).toBeGreaterThanOrEqual(k.x)
      expect(m.x + m.w / 2).toBeLessThanOrEqual(k.x + k.w)
      expect(m.y - m.h / 2 - 30).toBeGreaterThanOrEqual(k.y) // la plaque
      expect(m.y + m.h / 2 + 46).toBeLessThanOrEqual(k.y + k.h) // nom + température
    }
    // la seconde ligne du nom de T3 allonge le cadre d'un pas
    expect(k.h).toBe(616 + 18)
    // la marge s'arrête à la scène ; le module qui dépasse reste entier, sans marge
    expect(k.x + k.w).toBe(2040 + 166 / 2)
    expect(k.y).toBeGreaterThanOrEqual(0)
  })

  it('une carte sans module garde la scène', () => {
    const c = cloneCarte(CARTE_LIVREE)
    c.modules = []
    c.liens = []
    expect(cadreCarte(c, 'jeu')).toEqual({ x: 0, y: 0, w: 2100, h: 804 })
  })
})

describe('la légende — ce que le plan montre sans le dire', () => {
  it('nomme les coursives pour le joueur, jamais par leur clé de données', () => {
    expect(nomLien(CARTE_LIVREE, 'main')).toBe('voie principale')
    expect(nomLien(CARTE_LIVREE, 'alt')).toBe('voie secondaire')
    // une coursive conditionnelle porte le nom de son badge, celui du plan
    expect(nomLien(CARTE_LIVREE, 'glace')).toBe('❄ glace')
    expect(nomLien(CARTE_LIVREE, 'retour')).toBe('retour sur ses pas')
    // une clé inconnue se montre telle quelle plutôt que rien
    expect(nomLien(CARTE_LIVREE, 'tunnel')).toBe('tunnel')
  })

  it('suit la carte livrée : états, natures présentes, coursives utilisées', () => {
    const l = legendeCarte(CARTE_LIVREE)
    expect(l.filter((e) => e.genre === 'etat').map((e) => e.cle)).toEqual(['allume', 'eteint', 'traverse', 'verrou', 'cran'])
    // les natures dans l'ordre de la carte ; ni halte ni « ? » : il n'y en a pas
    expect(l.filter((e) => e.genre === 'nature').map((e) => `${e.signe} ${e.texte}`)).toEqual(['⊕ hub', '▦ énigme', '⚔ combat', '⬢ terminal'])
    expect(l.filter((e) => e.genre === 'coursive').map((e) => e.texte)).toEqual([
      'voie principale', 'voie secondaire', '❄ glace — orbe requis', '💨 gaz — orbe requis',
    ])
    expect(l.find((e) => e.cle === 'alt')!.tirets).toBe(true)
    expect(l).toHaveLength(13)
    // aucune clé de données ne passe dans le texte montré
    expect(l.map((e) => e.texte).join(' ')).not.toMatch(/\b(main|alt)\b/)
  })

  it('ne montre ni cadenas ni cran ni type de coursive que la carte n’a pas', () => {
    const c = cloneCarte(CARTE_LIVREE)
    c.liens = c.liens.map((l) => ({ ...l, type: 'main' }))
    c.modules.forEach((m) => (m.cran = 0))
    c.modules.find((m) => m.id === 'C1')!.type = 'inconnu'
    const l = legendeCarte(c)
    expect(l.map((e) => e.cle)).not.toContain('verrou')
    expect(l.map((e) => e.cle)).not.toContain('cran')
    expect(l.filter((e) => e.genre === 'coursive').map((e) => e.cle)).toEqual(['main'])
    expect(l.find((e) => e.cle === 'inconnu')!.signe).toBe('?')
  })

  it('se rend en éléments de liste, textes échappés', () => {
    const c = cloneCarte(CARTE_LIVREE)
    c.types.combat = 'COMBAT <DUR>'
    const html = legendeCarteHTML(c)
    expect((html.match(/<li class="cs-lg /g) ?? []).length).toBe(13)
    expect(html).toContain('combat &lt;dur&gt;')
    expect(html).toContain('<i class="cs-lg-trait cs-lg-tirets" style="--c:#7f9cb0"></i>voie secondaire')
    expect(html).toContain('<i class="cs-lg-fut cs-lg-allume"></i>allumé : joignable d’ici')
  })
})
