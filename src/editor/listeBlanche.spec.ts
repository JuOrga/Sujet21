// LA LISTE BLANCHE DES CRÉATIONS (api/_creation.ts) et LE PROFIL DU JOUEUR
// (profilJoueur.ts) : une seule liste, deux lecteurs.
//
// Ce que le banc tient :
//   · une salle livrée, passée au nettoyage, se RELIT sans rejet
//     (parseLevel) — le serveur ne garde rien que le jeu ne sache lire ;
//   · le méta de la run, la physique du tableau, la mise en scène et le
//     code sont RETIRÉS, et le nettoyage le dit ;
//   · ce qui ne peut pas être une salle est REFUSÉ, avec sa raison ;
//   · chaque outil de la palette du joueur existe dans l'éditeur, et chaque
//     palier écrit des valeurs que la relecture garde telles quelles.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  BLOCS_MAX,
  BORNES_MAX,
  CREATION_OCTETS_MAX,
  PLAFONDS,
  TEXTE_MAX,
  nettoieCreation,
  texteJoueur,
} from '../../api/_creation'
import { TABLEAUX, MAT_EXIT, MAT_WALL, type LevelDef } from '../game/level'
import { TABLEAU_HUB } from '../game/hub'
import { parseLevel, serializeLevel } from '../game/levelIO'
import {
  FAMILLES_JOUEUR,
  OUTILS_PERMIS,
  REGLAGES_JOUEUR,
  appliquePalier,
  ecartsDuProfil,
  materiauDeLOutil,
  outilPermis,
  palierCourant,
} from './profilJoueur'

/** Une salle telle qu'elle voyagerait : du JSON, pas un objet du jeu. */
const enJSON = (l: LevelDef): Record<string, unknown> => JSON.parse(serializeLevel(l)) as Record<string, unknown>

/** La salle nettoyée, relue comme le jeu la relira (le serveur lui donne
 *  son code). */
function relue(salle: Record<string, unknown>): ReturnType<typeof parseLevel> {
  return parseLevel({ ...salle, code: 'J-TEST' })
}

function petiteSalle(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Essai',
    bounds: { minX: -1000, minY: -600, maxX: 1000, maxY: 600 },
    spawn: { x: -800, y: 0, n: 900 },
    exit: { minX: 800, minY: -100, maxX: 950, maxY: 100 },
    boxes: [],
    sponges: [],
    labels: [],
    ...extra,
  }
}

function nettoyee(brut: unknown): { salle: Record<string, unknown>; retouches: string[] } {
  const v = nettoieCreation(brut)
  if (!v.ok) throw new Error(`refusée : ${v.raison}`)
  return v
}

describe('les salles livrées passent la liste blanche', () => {
  it.each(TABLEAUX.map((t) => [t.code, t] as const))('%s : acceptée, et relue sans rejet', (_code, t) => {
    const { salle } = nettoyee(enJSON(t))
    const { level, rejets } = relue(salle)
    expect(rejets).toEqual([])
    expect(level).not.toBeNull()
    // la géométrie jouée est intacte
    expect(level!.boxes.length).toBe(t.boxes.length)
    expect(level!.bounds).toEqual(t.bounds)
  })

  it('le hub perd tout son méta (boutique, marchand, pupitres, ancres) et se relit encore', () => {
    const brut = enJSON(TABLEAU_HUB)
    const { salle, retouches } = nettoyee(brut)
    for (const champ of ['plots', 'marchand', 'pupitres', 'ancres', 'bancMemoires', 'code']) {
      if (champ in brut) {
        expect(salle).not.toHaveProperty(champ)
        expect(retouches.join('\n')).toContain(`« ${champ} »`)
      }
    }
    expect(relue(salle).level).not.toBeNull()
  })
})

describe('ce qui est réservé au concepteur est retiré', () => {
  it('le méta de la run, la physique, la mise en scène, la place dans la station', () => {
    const reserves = {
      code: '21-A',
      reglages: { gravite: 9 },
      par: 3,
      dashBudget: 9,
      etats: 'libres',
      exige: ['glace'],
      cineAvant: 'INTRO',
      cineApres: 'FIN',
      sequence: 'ALERTE',
      ambiance: 'tension',
      figure: 'x.webp',
      plafond: 'planete',
      biome: 'serre',
      raccourciVers: '21-Z',
      minijeu: { sorte: 'palet' },
      caches: [{ x: 0, y: 0 }],
      condensats: [{ x: 0, y: 0 }],
      fiole: { x: 0, y: 0 },
      eclats: [{ x: 0, y: 0, n: 5 }],
      plots: [{}],
      marchand: { x: 0, y: 0 },
      pupitres: [{}],
      ancres: [{}],
      bancMemoires: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
    }
    const { salle, retouches } = nettoyee(petiteSalle(reserves))
    for (const champ of Object.keys(reserves)) {
      expect(salle).not.toHaveProperty(champ)
      expect(retouches.some((r) => r.includes(`« ${champ} »`))).toBe(true)
    }
  })

  it('une zone d’état garde sa forme et son état — pas la mise en scène de la run', () => {
    const { salle } = nettoyee(
      petiteSalle({
        zones: [
          { minX: 0, minY: 0, maxX: 100, maxY: 80, force: 'glace', label: 'FROID', cine: 'INTRO', sequence: 'ALERTE' },
          { minX: 0, minY: 0, maxX: 10, maxY: 10, force: 'plasma' },
        ],
      }),
    )
    expect(salle.zones).toEqual([{ minX: 0, minY: 0, maxX: 100, maxY: 80, force: 'glace' }])
  })

  it('une carte imposée autre que l’Éclateur', () => {
    const { salle, retouches } = nettoyee(petiteSalle({ cartes: ['eclateur', 'semelles-polies', 'eclateur'] }))
    expect(salle.cartes).toEqual(['eclateur'])
    expect(retouches.join()).toContain('Éclateur')
  })

  it('les champs réservés d’un élément, et les valeurs hors liste', () => {
    const { salle, retouches } = nettoyee(
      petiteSalle({
        labels: [{ x: 0, y: 0, text: 'ici', tone: 'mur', cle: 'textes.x', rang: 'secteur' }],
        cibles: [{ x: 0, y: 0, r: 26, mode: 'memoire' }],
      }),
    )
    expect(salle.labels).toEqual([{ x: 0, y: 0, tone: 'mur', text: 'ici' }])
    expect(salle.cibles).toEqual([{ x: 0, y: 0, r: 26 }])
    expect(retouches.join('\n')).toContain('« cle » réservé au concepteur')
    expect(retouches.join('\n')).toContain('« mode » hors des valeurs permises')
  })

  it('les éléments que la run seule pourrait déclencher, ou que le moteur fabrique, sont écartés', () => {
    const { salle } = nettoyee(
      petiteSalle({
        boxes: [
          { minX: 0, minY: 0, maxX: 10, maxY: 10, material: MAT_EXIT },
          { minX: 0, minY: 0, maxX: 10, maxY: 10, material: MAT_WALL },
        ],
        portes: [
          { minX: 0, minY: 0, maxX: 10, maxY: 50, canal: -1 },
          { minX: 0, minY: 0, maxX: 10, maxY: 50, canal: 2 },
        ],
        chasses: [
          { minX: 0, minY: 0, maxX: 50, maxY: 50, angle: 0, canal: -1 },
          { minX: 0, minY: 0, maxX: 50, maxY: 50, angle: 0, canal: 0 },
        ],
        decals: [
          { x: 0, y: 0, w: 10, h: 10, kind: 'meta-station' },
          { x: 0, y: 0, w: 10, h: 10, kind: 'tuyaux' },
        ],
        rails: [{ points: [{ x: 0, y: 0 }] }, { points: [{ x: 0, y: 0, z: 9 }, { x: 5, y: 5 }] }],
        lumieres: [{ x: 0, y: 0, couleur: 'rouge' }],
      }),
    )
    expect((salle.boxes as unknown[]).length).toBe(1)
    expect(salle.portes).toEqual([{ minX: 0, minY: 0, maxX: 10, maxY: 50, canal: 2 }])
    // la séquence seule : écartée ; 0 : permanente
    expect(salle.chasses).toEqual([{ minX: 0, minY: 0, maxX: 50, maxY: 50, angle: 0 }])
    expect((salle.decals as { kind: string }[]).map((d) => d.kind)).toEqual(['tuyaux'])
    expect(salle.rails).toEqual([{ points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] }])
    expect(salle.lumieres).toEqual([{ x: 0, y: 0 }])
  })
})

describe('les textes du joueur', () => {
  it('sans caractère de contrôle ni espace invisible, bornés', () => {
    expect(texteJoueur('  LA\u0000 RONDE\u200b\n DU  PUITS ', 40)).toBe('LA RONDE DU PUITS')
    expect(texteJoueur(42, 40)).toBe('')
    expect(texteJoueur('x'.repeat(100), TEXTE_MAX.etiquette)).toHaveLength(TEXTE_MAX.etiquette)
  })

  it('nom et description coupés, et le nettoyage le dit', () => {
    const { salle, retouches } = nettoyee(petiteSalle({ name: 'N'.repeat(60), journal: 'D'.repeat(400) }))
    expect(salle.name).toHaveLength(TEXTE_MAX.nom)
    expect(salle.journal).toHaveLength(TEXTE_MAX.description)
    expect(retouches.join('\n')).toContain('nom est coupé')
    expect(retouches.join('\n')).toContain('description est coupée')
  })

  it('une étiquette vide après nettoyage est écartée', () => {
    const { salle } = nettoyee(petiteSalle({ labels: [{ x: 0, y: 0, text: '\u200b \u0007', tone: 'mur' }] }))
    expect(salle.labels).toEqual([])
  })
})

describe('ce qui ne peut pas être une salle est refusé', () => {
  const refus = (brut: unknown): string => {
    const v = nettoieCreation(brut)
    if (v.ok) throw new Error('acceptée à tort')
    return v.raison
  }

  it('la forme', () => {
    expect(refus(null)).toContain('objet JSON')
    expect(refus([])).toContain('objet JSON')
    expect(refus(petiteSalle({ name: '   ' }))).toContain('nom')
    expect(refus(petiteSalle({ bounds: { minX: 0, minY: 0, maxX: 0, maxY: 10 } }))).toContain('cuve')
    expect(refus(petiteSalle({ spawn: { x: 0 } }))).toContain('départ')
    expect(refus(petiteSalle({ exit: null }))).toContain('sortie')
  })

  it('une cuve plus vaste que le hub', () => {
    const r = refus(petiteSalle({ bounds: { minX: 0, minY: 0, maxX: BORNES_MAX.largeur + 1, maxY: 100 } }))
    expect(r).toContain(`${BORNES_MAX.largeur}`)
  })

  it('un plafond dépassé refuse — il ne coupe pas la salle en silence', () => {
    const lasers = Array.from({ length: PLAFONDS.lasers + 1 }, () => ({ x: 0, y: 0, angle: 0 }))
    expect(refus(petiteSalle({ lasers }))).toContain('lasers')
    const boxes = Array.from({ length: BLOCS_MAX - 1 }, () => ({ minX: 0, minY: 0, maxX: 10, maxY: 10, material: 0 }))
    const structures = Array.from({ length: 2 }, () => ({ type: 0, minX: 0, minY: 0, maxX: 400, maxY: 400 }))
    expect(refus(petiteSalle({ boxes, structures }))).toContain(`${BLOCS_MAX}`)
  })

  it('une création trop lourde, même sous les plafonds', () => {
    const long = 0.12345678901234567
    const boxes = Array.from({ length: BLOCS_MAX }, () => ({
      minX: long, minY: long, maxX: long + 1, maxY: long + 1, material: 0,
      angle: long, aura: long, skin: long, forme: long, sens: long, p0: long, p1: long, p2: long,
    }))
    expect(JSON.stringify(boxes).length).toBeGreaterThan(CREATION_OCTETS_MAX)
    expect(refus(petiteSalle({ boxes }))).toContain('trop lourde')
  })
})

describe('le profil du joueur tient avec la liste blanche', () => {
  it('aucun écart entre la palette, les paliers et la liste du serveur', () => {
    expect(ecartsDuProfil()).toEqual([])
  })

  it('chaque outil du joueur existe dans la palette de l’éditeur', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')
    const outils = new Set([...html.matchAll(/data-tool="([^"]+)"/g)].map((m) => m[1]))
    for (const outil of OUTILS_PERMIS) expect(outils.has(outil), outil).toBe(true)
  })

  it('aucun outil du concepteur ne s’est glissé dans la palette du joueur', () => {
    for (const outil of ['plot:condensat', 'plot:memoire', 'banc', 'pupitre', 'ancre', 'marchand', 'eclat', 'fiole', 'condensat', 'cache', 'zone:libre', 'struct:0', 'struct:1']) {
      expect(outilPermis(outil), outil).toBe(false)
    }
    expect(materiauDeLOutil(`box:${MAT_EXIT}`)).toBeNull()
  })

  it('six familles, au plus trois réglages par élément', () => {
    expect(FAMILLES_JOUEUR.map((f) => f.nom)).toEqual([
      'Départ & sortie',
      'Parois',
      'Zones d’effet',
      'Mécanismes',
      'Lumière',
      'Décor',
    ])
    for (const reglages of Object.values(REGLAGES_JOUEUR)) expect(reglages.length).toBeLessThanOrEqual(3)
  })
})

/** Un élément de base par collection, pour poser les paliers dessus. */
const BASES: Record<string, Record<string, unknown>> = {
  puits: { x: 0, y: 0 },
  coupelles: { x: 0, y: 200, r: 60, seuil: 0.1, canal: 1 },
  portes: { minX: 300, minY: -100, maxX: 330, maxY: 100, canal: 1 },
  cibles: { x: -300, y: 200, r: 26 },
  boxes: { minX: -200, minY: -300, maxX: -100, maxY: -200, material: 2 },
  chasses: { minX: 400, minY: 200, maxX: 600, maxY: 300, angle: 0 },
}

describe('chaque palier écrit des valeurs que le jeu garde telles quelles', () => {
  for (const [collection, reglages] of Object.entries(REGLAGES_JOUEUR)) {
    if (collection === 'spawn') continue
    for (const r of reglages) {
      it.each(r.paliers.map((pal) => [pal.label, pal] as const))(`${collection} · ${r.nom} · %s`, (_l, pal) => {
        const el = appliquePalier(BASES[collection], pal)
        const { salle } = nettoyee(petiteSalle({ [collection]: [el] }))
        const { level, rejets } = relue(salle)
        expect(rejets).toEqual([])
        const lu = (level as unknown as Record<string, Record<string, unknown>[]>)[collection][0]
        for (const [champ, valeur] of Object.entries(pal.champs)) {
          // retiré : le défaut du jeu joue (absent, ou relu à sa valeur par défaut)
          if (valeur === undefined) continue
          expect(lu[champ], `${champ}`).toBe(valeur)
        }
        // un palier sans champ (« quand on la commande » : le canal vient du
        // fil) ne se reconnaît pas à ses champs
        if (Object.keys(pal.champs).length) expect(palierCourant(el, r)).toBe(r.paliers.indexOf(pal))
      })
    }
  }

  it('le départ : la taille et l’élan', () => {
    const [taille, elan] = REGLAGES_JOUEUR.spawn
    for (const pal of taille.paliers) {
      const { salle } = nettoyee(petiteSalle({ spawn: { x: -800, y: 0, ...pal.champs } }))
      expect(relue(salle).level!.spawn.n).toBe(pal.champs.n)
    }
    for (const pal of elan.paliers) {
      const { salle } = nettoyee(petiteSalle({ spawn: { x: -800, y: 0, n: 900, impulsion: { angle: 30, ...pal.champs } } }))
      const lu = relue(salle).level!.spawn.impulsion
      if (pal.champs.vitesse === 0) expect(lu).toBeUndefined()
      else expect(lu).toEqual({ angle: 30, vitesse: pal.champs.vitesse })
    }
  })

  it('le palier courant se retrouve depuis l’élément', () => {
    const [force] = REGLAGES_JOUEUR.puits
    for (const [i, pal] of force.paliers.entries()) {
      expect(palierCourant(appliquePalier({ x: 0, y: 0 }, pal), force)).toBe(i)
    }
    // une valeur posée par le concepteur, hors paliers
    expect(palierCourant({ x: 0, y: 0, force: 777 }, force)).toBeNull()
  })
})
