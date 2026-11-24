// L'ATELIER DU JOUEUR (lot 5) : ce que le panneau lit et écrit, sans DOM.
//
// L'éditeur désigne sa sélection par une sorte au singulier et un rang ;
// les paliers, la liste blanche et le serveur parlent en collections. Les
// fonctions de profilJoueur.ts font le pont — le banc les tient, avec le
// RELIER qui remplace le numéro de canal recopié à la main.
//
// main.ts ne s'importe pas en test : son câblage se lit dans sa source,
// comme main-salleHub.spec.ts.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { nettoieCreation } from '../../api/_creation'
import { ICONES_ATELIER, iconeOutil } from './iconesAtelier'
import type { LevelDef } from '../game/level'
import { parseLevel } from '../game/levelIO'
import {
  FAMILLES_JOUEUR,
  canalDeCommande,
  cleDOutil,
  commandesDe,
  coupeLiens,
  familleDeLOutil,
  lisPalier,
  outilDeSelection,
  posePalier,
  reglagesDeSelection,
  relie,
} from './profilJoueur'

function salle(extra: Partial<LevelDef> = {}): LevelDef {
  return {
    name: 'Essai',
    code: 'J-BROUILLON',
    journal: '',
    bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
    spawn: { x: -950, y: 0, n: 900 },
    exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
    boxes: [{ minX: -100, minY: 300, maxX: 100, maxY: 330, material: 2 }],
    sponges: [],
    labels: [],
    cibles: [{ x: 0, y: -300, r: 26 }, { x: 200, y: -300, r: 26 }],
    coupelles: [{ x: 400, y: 300, r: 60, seuil: 0.1, canal: 7 }],
    portes: [{ minX: 900, minY: -200, maxX: 930, maxY: 200, canal: 9 }],
    chasses: [{ minX: -500, minY: 0, maxX: -300, maxY: 100, angle: 0 }],
    puits: [{ x: 0, y: 0 }],
    ...extra,
  }
}

describe('l’en-tête du panneau : ce qu’est l’élément choisi', () => {
  it('le nom, la phrase et la famille de l’outil du joueur', () => {
    const l = salle()
    expect(outilDeSelection(l, { kind: 'box', index: 0 })).toMatchObject({ nom: 'Hydrophobe', famille: 'Matières' })
    expect(outilDeSelection(l, { kind: 'cible', index: 0 })).toMatchObject({ nom: 'Pastille', famille: 'Mécanismes' })
    expect(outilDeSelection(l, { kind: 'puits', index: 0 })?.phrase).toContain('orbiter')
    expect(outilDeSelection(l, { kind: 'spawn' })?.nom).toBe('Départ')
  })

  it('un élément hors du profil n’a pas d’outil (le panneau le dit)', () => {
    const l = salle({ boxes: [{ minX: 0, minY: 0, maxX: 10, maxY: 10, material: 10 }] }) // le miroir
    expect(outilDeSelection(l, { kind: 'box', index: 0 })).toBeNull()
    expect(outilDeSelection(l, { kind: 'puits', index: 5 })).toBeNull()
  })

  it('au plus trois réglages, et aucun pour ce qui se règle à la main', () => {
    expect(reglagesDeSelection({ kind: 'puits' }).map((r) => r.id)).toEqual(['force', 'coeur', 'portee'])
    expect(reglagesDeSelection({ kind: 'laser' })).toEqual([])
    expect(reglagesDeSelection({ kind: 'exit' })).toEqual([])
  })
})

describe('poser un palier', () => {
  it('écrit sur l’élément choisi, dans une copie', () => {
    const l = salle()
    const n = posePalier(l, { kind: 'porte', index: 0 }, 'regle', 1)!
    expect(n.portes![0].regle).toBe('et')
    expect(l.portes![0].regle).toBeUndefined()
    const [, regle] = reglagesDeSelection({ kind: 'porte' })
    expect(lisPalier(n, { kind: 'porte', index: 0 }, regle)).toBe(1)
  })

  it('revenir au palier « par défaut » retire le champ', () => {
    const l = posePalier(salle(), { kind: 'porte', index: 0 }, 'repos', 1)!
    expect(l.portes![0].repos).toBe('ouverte')
    expect(posePalier(l, { kind: 'porte', index: 0 }, 'repos', 0)!.portes![0]).not.toHaveProperty('repos')
  })

  it('le départ : sa taille, et son élan qui garde sa direction', () => {
    const l = salle({ spawn: { x: -950, y: 0, n: 900, impulsion: { angle: 45, vitesse: 400 } } })
    const [taille, elan] = reglagesDeSelection({ kind: 'spawn' })
    expect(lisPalier(l, { kind: 'spawn' }, elan)).toBe(1)
    const fort = posePalier(l, { kind: 'spawn' }, 'elan', 2)!
    expect(fort.spawn.impulsion).toEqual({ angle: 45, vitesse: 900 })
    // immobile : l'impulsion disparaît
    expect(posePalier(l, { kind: 'spawn' }, 'elan', 0)!.spawn).not.toHaveProperty('impulsion')
    expect(posePalier(l, { kind: 'spawn' }, 'taille', 2)!.spawn.n).toBe(1500)
    expect(lisPalier(l, { kind: 'spawn' }, taille)).toBe(1)
  })

  it('un réglage ou un élément inconnu ne touche à rien', () => {
    expect(posePalier(salle(), { kind: 'porte', index: 0 }, 'couleur', 0)).toBeNull()
    expect(posePalier(salle(), { kind: 'porte', index: 9 }, 'regle', 0)).toBeNull()
    expect(posePalier(salle(), { kind: 'porte', index: 0 }, 'regle', 7)).toBeNull()
  })
})

describe('relier une commande à une porte, sans numéro', () => {
  it('une porte sans commande adopte le canal de la première', () => {
    const r = relie(salle(), { kind: 'porte', index: 0 }, { kind: 'coupelle', index: 0 })
    if (!r.ok) throw new Error(r.message)
    expect(r.level.portes![0].canal).toBe(7)
    expect(commandesDe(r.level, { kind: 'porte', index: 0 })).toEqual([{ kind: 'coupelle', index: 0 }])
  })

  it('une seconde commande REJOINT la porte : la première reste branchée', () => {
    const a = relie(salle(), { kind: 'porte', index: 0 }, { kind: 'coupelle', index: 0 })
    if (!a.ok) throw new Error(a.message)
    const b = relie(a.level, { kind: 'porte', index: 0 }, { kind: 'cible', index: 1 })
    if (!b.ok) throw new Error(b.message)
    expect(b.level.cibles![1].canal).toBe(7)
    expect(commandesDe(b.level, { kind: 'porte', index: 0 })).toEqual([
      { kind: 'cible', index: 1 },
      { kind: 'coupelle', index: 0 },
    ])
    // l'autre pastille n'a pas bougé
    expect(canalDeCommande(b.level, { kind: 'cible', index: 0 })).toBe(1)
  })

  it('une chasse se relie de même, et devient « commandée »', () => {
    const r = relie(salle(), { kind: 'chasse', index: 0 }, { kind: 'cible', index: 0 })
    if (!r.ok) throw new Error(r.message)
    expect(r.level.chasses![0].canal).toBe(1)
    const [, quand] = reglagesDeSelection({ kind: 'chasse' })
    expect(lisPalier(r.level, { kind: 'chasse', index: 0 }, quand)).toBe(1)
  })

  it('refuse ce qui n’est pas une commande, ou un lien qui existe déjà', () => {
    const l = salle()
    const pasCommande = relie(l, { kind: 'porte', index: 0 }, { kind: 'puits', index: 0 })
    expect(pasCommande.ok).toBe(false)
    expect(pasCommande.message).toContain('pastille ou une coupelle')
    expect(relie(l, { kind: 'puits', index: 0 }, { kind: 'cible', index: 0 }).ok).toBe(false)
    const a = relie(l, { kind: 'porte', index: 0 }, { kind: 'coupelle', index: 0 })
    if (!a.ok) throw new Error(a.message)
    expect(relie(a.level, { kind: 'porte', index: 0 }, { kind: 'coupelle', index: 0 }).ok).toBe(false)
  })

  it('couper les liens : la porte prend un canal que rien n’allume, la chasse redevient permanente', () => {
    const a = relie(salle(), { kind: 'porte', index: 0 }, { kind: 'coupelle', index: 0 })
    if (!a.ok) throw new Error(a.message)
    const coupee = coupeLiens(a.level, { kind: 'porte', index: 0 })!
    expect(commandesDe(coupee, { kind: 'porte', index: 0 })).toEqual([])
    expect(coupee.portes![0].canal).toBeGreaterThanOrEqual(1)
    const c = relie(salle(), { kind: 'chasse', index: 0 }, { kind: 'cible', index: 0 })
    if (!c.ok) throw new Error(c.message)
    expect(coupeLiens(c.level, { kind: 'chasse', index: 0 })!.chasses![0]).not.toHaveProperty('canal')
  })

  it('une salle reliée passe la liste blanche et se relit avec ses liens', () => {
    const a = relie(salle(), { kind: 'porte', index: 0 }, { kind: 'coupelle', index: 0 })
    if (!a.ok) throw new Error(a.message)
    const v = nettoieCreation(JSON.parse(JSON.stringify(a.level)))
    if (!v.ok) throw new Error(v.raison)
    const { level } = parseLevel({ ...v.salle, code: 'J-TEST' })
    expect(level!.portes![0].canal).toBe(level!.coupelles![0].canal)
  })
})

describe('la barre de l’atelier : des familles, pas une liste à faire défiler', () => {
  it('chaque famille tient en une rangée : sept outils au plus', () => {
    for (const f of FAMILLES_JOUEUR) expect(f.outils.length, f.nom).toBeLessThanOrEqual(7)
  })

  it('l’outil en main se retrouve dans la barre, et ouvre sa famille', () => {
    expect(cleDOutil({ kind: 'box', material: 2 })).toBe('box:2')
    expect(cleDOutil({ kind: 'box', material: 0, forme: 1 })).toBe('forme:1')
    expect(cleDOutil({ kind: 'structure', type: 1 })).toBe('struct:1')
    expect(cleDOutil({ kind: 'decal', sorte: 'tuyaux' })).toBe('decal:tuyaux')
    expect(cleDOutil({ kind: 'bande' })).toBe('bande')
    expect(cleDOutil({ kind: 'select' })).toBe('select')
    expect(familleDeLOutil('puits')).toBe('forces')
    expect(familleDeLOutil('box:6')).toBe('chaleur')
    expect(familleDeLOutil('select')).toBeNull()
    // chaque outil de la barre a sa famille
    for (const f of FAMILLES_JOUEUR) for (const o of f.outils) expect(familleDeLOutil(o.outil)).toBe(f.id)
  })

  it('chaque outil de la barre a SON pictogramme', () => {
    const outils = ['select', ...FAMILLES_JOUEUR.flatMap((f) => f.outils.map((o) => o.outil))]
    for (const o of outils) {
      expect(ICONES_ATELIER[o], o).toBeDefined()
      expect(iconeOutil(o)).toMatch(/^<svg [^>]*aria-hidden="true"/)
    }
    // pas deux outils sous le même dessin
    expect(new Set(outils.map((o) => ICONES_ATELIER[o])).size).toBe(outils.length)
  })

  it('les outils d’une famille tiennent sur UNE ligne, qui défile de côté', () => {
    const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')
    const regle = /#editor \.ed-dock-outils \{([^}]*)\}/.exec(HTML)?.[1] ?? ''
    expect(regle).toContain('flex-wrap: nowrap')
    expect(regle).toContain('overflow-x: auto')
  })

  it('au profil joueur, la palette latérale cède la place à la barre sous la salle', () => {
    const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')
    // la barre vit DANS la scène, sous le canevas
    expect(HTML).toMatch(/<div id="ed-stage">[\s\S]*?<nav id="ed-dock"[\s\S]*?<\/div>/)
    expect(HTML).toMatch(/#editor\.ed-joueur > \.ed-side:not\(\.ed-side--right\) \{ display: none; \}/)
    expect(HTML).toMatch(/#editor\.ed-joueur #ed-dock \{/)
  })
})

describe('le câblage de l’atelier (main.ts, index.html)', () => {
  const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')
  const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')

  it('la porte ATELIER ouvre l’éditeur au profil joueur', () => {
    expect(HTML).toMatch(/id="home-atelier"/)
    expect(MAIN).toMatch(/home-atelier[\s\S]{0,200}openEditor\('joueur'\)/)
  })

  it('chaque entrée du concepteur force son profil ; seul le retour d’un essai garde le sien', () => {
    const sansProfil = MAIN.split('\n').filter((l) => /openEditor\(\)/.test(l))
    // le retour par R après l'essai, et la puce « revenir à l'éditeur »
    expect(sansProfil).toHaveLength(2)
    for (const l of sansProfil) expect(l).toMatch(/essai|=> void openEditor\(\)/)
    expect(MAIN.match(/openEditor\('concepteur'\)/g)?.length).toBe(3)
  })

  it('la sortie atteinte depuis l’atelier partage la salle jouée', () => {
    expect(MAIN).toMatch(/editor\?\.profil === 'joueur' && testLevel\)[\s\S]{0,300}partageDepuisAtelier\(editor, testLevel/)
    // l'atelier retient la version EN LIGNE : l'encart dit si des retouches attendent
    expect(MAIN).toMatch(/ed\.noteCreation\(p\.id, salle\)/)
  })

  it('l’atelier dit où en est la salle, et comment la partager', () => {
    expect(HTML).toMatch(/<div id="ed-etat-salle"/)
    const ED = readFileSync(new URL('./editor.ts', import.meta.url), 'utf-8')
    expect(ED).toContain('Enregistrée sur ce poste')
    expect(ED).toContain('ESSAYER ET PARTAGER')
  })
})
