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
import { checkLevel, parseLevel } from '../game/levelIO'
import {
  FAMILLES_JOUEUR,
  canalDeCommande,
  cleDOutil,
  commandesDe,
  coupeLiens,
  familleDeLOutil,
  familleDuDock,
  lisPalier,
  outilDeSelection,
  posePalier,
  reglagesDeSelection,
  relie,
  verdictsJoueur,
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

  it('la ligne ne déborde pas la salle : la colonne de la scène est BORNÉE', () => {
    // une colonne implicite (« auto ») s'élargissait à la ligne entière :
    // 1 388 px pour une salle de 958, rien à faire défiler (aperçu du 24/11)
    const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')
    const regle = /#editor\.ed-joueur #ed-stage \{([^}]*)\}/.exec(HTML)?.[1] ?? ''
    expect(regle).toContain('grid-template-columns: minmax(0, 1fr)')
    expect(/#editor \.ed-dock-outils \{([^}]*)\}/.exec(HTML)?.[1]).toContain('min-width: 0')
    expect(HTML).toContain('#editor.ed-joueur #ed-dock { min-width: 0; }')
  })

  it('la ligne se fait défiler à la souris : flèches, glisser, molette', () => {
    const ED = readFileSync(new URL('./editor.ts', import.meta.url), 'utf-8')
    const DEF = readFileSync(new URL('./defileLigne.ts', import.meta.url), 'utf-8')
    expect(ED).toContain('data-fleche="-1"')
    expect(ED).toContain('data-fleche="1"')
    expect(ED).toContain('defileLigne(dock, ligne)')
    expect(DEF).toContain("'wheel'")
    expect(DEF).toContain("'pointermove'")
    // le clic qui suit un glisser est avalé : on ne choisit pas un outil en tirant
    expect(DEF).toMatch(/addEventListener\('click', \(e\) => e\.stopPropagation\(\), \{ capture: true, once: true \}\)/)
  })

  it('au profil joueur, la palette latérale cède la place à la barre sous la salle', () => {
    const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')
    // la barre vit DANS la scène, sous le canevas
    expect(HTML).toMatch(/<div id="ed-stage">[\s\S]*?<nav id="ed-dock"[\s\S]*?<\/div>/)
    expect(HTML).toMatch(/#editor\.ed-joueur > \.ed-side:not\(\.ed-side--right\) \{ display: none; \}/)
    expect(HTML).toMatch(/#editor\.ed-joueur #ed-dock \{/)
  })
})

describe('changer d’élément à la volée', () => {
  it('outil en main, une autre famille ouverte RESTE ouverte au rafraîchissement', () => {
    // l'hydrophobe en main : la barre ouvre « Matières »
    let etat = familleDuDock({ famille: 'batir', outilVu: '' }, 'box:2')
    expect(etat.famille).toBe('matieres')
    // le joueur clique l'onglet « Forces » — l'outil en main n'a pas changé
    etat = { ...etat, famille: 'forces' }
    // la barre se repeint (clic, pose, annulation…) : « Forces » tient
    expect(familleDuDock(etat, 'box:2').famille).toBe('forces')
    // et il prend le puits directement, sans repasser par la Sélection
    expect(familleDuDock(etat, 'puits')).toEqual({ famille: 'forces', outilVu: 'puits' })
  })

  it('un outil pris autrement que par la barre (une annulation) ouvre sa famille', () => {
    expect(familleDuDock({ famille: 'decor', outilVu: 'label' }, 'laser').famille).toBe('meca')
    // la Sélection n'a pas de famille : celle ouverte reste
    expect(familleDuDock({ famille: 'decor', outilVu: 'label' }, 'select').famille).toBe('decor')
  })
})

describe('deux essais : pour soi, ou pour publier', () => {
  const ED = readFileSync(new URL('./editor.ts', import.meta.url), 'utf-8')
  const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')
  const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')

  it('ESSAYER (masqué au concepteur) et ESSAYER ET PUBLIER', () => {
    expect(HTML).toMatch(/<button type="button" id="ed-essai-seul" data-hors-profil>/)
    expect(ED).toContain("this.el('ed-play').addEventListener('click', () => essaie(true))")
    expect(ED).toContain("this.el('ed-essai-seul').addEventListener('click', () => essaie(false))")
    expect(ED).toContain("['ed-essai-seul', '▶ ESSAYER']")
  })

  it('seul l’essai « et publier » publie à la sortie', () => {
    expect(MAIN).toContain('essaiPublie = opts?.publier === true')
    expect(MAIN).toMatch(/editor\?\.profil === 'joueur' && testLevel && essaiPublie\) \{[\s\S]{0,200}partageDepuisAtelier/)
  })

  it('la Sélection s’appelle ainsi, et se met en évidence quand on n’y est pas', () => {
    expect(ED).toContain('<span>Sélection</span>')
    expect(ED).not.toContain('Choisir / déplacer')
    expect(HTML).toMatch(/#editor \.ed-dock-choisir\[aria-pressed='false'\] \{[^}]*var\(--glow\)/)
  })
})

describe('la vérification, dite au joueur', () => {
  const vierge = (extra: Partial<LevelDef> = {}): LevelDef => ({
    name: 'Ma salle',
    code: 'J-BROUILLON',
    journal: '',
    bounds: { minX: -1200, minY: -750, maxX: 1200, maxY: 750 },
    spawn: { x: -950, y: 0, n: 900 },
    exit: { minX: 1040, minY: -120, maxX: 1180, maxY: 120 },
    boxes: [{ minX: -100, minY: 300, maxX: 100, maxY: 330, material: 0 }],
    sponges: [],
    labels: [],
    ...extra,
  })

  it('les messages du concepteur (journal, chimie, étiquette du sas) ne parviennent pas au joueur', () => {
    const bruts = checkLevel(vierge()).map((v) => v.message)
    // le concepteur, lui, les reçoit bien : c'est ce que la capture montrait
    expect(bruts.some((m) => m.startsWith('L’entrée de journal'))).toBe(true)
    expect(bruts.some((m) => m.startsWith('Aucune chimie'))).toBe(true)
    expect(verdictsJoueur(checkLevel(vierge()))).toEqual([])
  })

  it('une porte non reliée se dit sans numéro de canal, avec ce qu’il faut faire', () => {
    const l = vierge({ portes: [{ minX: 500, minY: -200, maxX: 530, maxY: 200, canal: 4 }] })
    const dits = verdictsJoueur(checkLevel(l)).map((v) => v.message)
    const porte = dits.find((m) => m.includes('porte'))
    expect(porte).toBeDefined()
    expect(porte).not.toMatch(/canal|nº/)
    expect(porte).toContain('Relier une commande')
  })

  it('le départ dans une paroi : une erreur redite, toujours là', () => {
    const l = vierge({ boxes: [{ minX: -1000, minY: -100, maxX: -900, maxY: 100, material: 0 }] })
    const v = verdictsJoueur(checkLevel(l))
    expect(v.find((x) => x.niveau === 'erreur')?.message).toContain('Le départ touche une paroi')
    expect(v.map((x) => x.message).join(' ')).not.toMatch(/\bu\b de dégagement/)
  })

  it('une erreur sans traduction n’est jamais escamotée', () => {
    const inconnue = { niveau: 'erreur' as const, message: 'Une erreur que la table ne connaît pas.' }
    const retiree = { niveau: 'erreur' as const, message: 'L’entrée de journal fait moins de 40 caractères.' }
    expect(verdictsJoueur([inconnue, retiree])).toEqual([inconnue, retiree])
  })
})

describe('le masque du profil tient aux réécritures de l’éditeur', () => {
  it('un attribut, pas une classe : el.className = … ne le fait plus sauter', () => {
    const ED = readFileSync(new URL('./editor.ts', import.meta.url), 'utf-8')
    const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf-8')
    // l'éditeur réécrit bien le className de la lecture du code…
    expect(ED).toMatch(/el\.className = 'ed-code-lecture/)
    // …donc le masque ne peut pas être une classe
    expect(ED).toContain("toggleAttribute('data-hors-profil'")
    expect(ED).not.toContain('ed-hors-profil')
    expect(HTML).toContain('#editor [data-hors-profil] { display: none !important; }')
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
    expect(MAIN).toMatch(/editor\?\.profil === 'joueur' && testLevel && essaiPublie\)[\s\S]{0,300}partageDepuisAtelier\(editor, testLevel/)
    // l'atelier retient la version EN LIGNE : l'encart dit si des retouches attendent
    expect(MAIN).toMatch(/ed\.noteCreation\(p\.id, salle\)/)
  })

  it('l’atelier dit où en est la salle, et comment la partager', () => {
    expect(HTML).toMatch(/<div id="ed-etat-salle"/)
    const ED = readFileSync(new URL('./editor.ts', import.meta.url), 'utf-8')
    expect(ED).toContain('Enregistrée sur ce poste')
    expect(ED).toContain('ESSAYER ET PUBLIER')
  })
})
