import { describe, expect, it } from 'vitest'
import { aleaDeGraine } from './voie'
import { cheminDePorte, ditNoeud, dessinMiniCarteSVG, fermeParPorte, REPERES_VOIE, portesDuRang, tisseMiniCarte, TISSAGE_DEFAUT, typesDuModule, VOIES, type MiniCarte } from './voiesModule'

// SANS HALTE par défaut : les tests des salles et des rencontres regardent la
// grille nue ; les haltes ont leur propre bloc
const NU = { ...TISSAGE_DEFAUT, economats: 0, repos: 0, dons: 0, coffre: false, minijeux: 0, partPrime: 0, dernierRangSalles: false }
const tisse = (graine: string, niveaux = 3, permises: (0 | 1 | 2 | 3)[] = [0, 1, 2, 3], ecrites = true) =>
  tisseMiniCarte(niveaux, aleaDeGraine(graine), permises, () => 2, { debut: 1, suite: 2 }, ecrites, NU)

describe('tisseMiniCarte — la grille de voies d’un module', () => {
  it('trois voies par rang, autant de rangs que de salles, et rien pour un module sans salle', () => {
    const mc = tisse('a')
    expect(mc.voies).toBe(VOIES)
    expect(mc.rangs).toHaveLength(3)
    for (const r of mc.rangs) expect(r.map((n) => n.voie)).toEqual([0, 1, 2])
    expect(tisse('a', 0).rangs).toEqual([])
  })

  it('se retisse à l’identique depuis la même graine, autrement depuis une autre', () => {
    expect(tisse('jour@S1')).toEqual(tisse('jour@S1'))
    const autres = [1, 2, 3, 4, 5].map((i) => JSON.stringify(tisse(`g${i}`)))
    expect(new Set(autres).size).toBeGreaterThan(1)
  })

  it('aucune voie morte : tout nœud mène au rang suivant, tout nœud d’un rang suivant a un prédécesseur', () => {
    for (let i = 0; i < 40; i++) {
      const mc = tisse(`t${i}`, 4)
      for (let r = 0; r < mc.rangs.length; r++)
        for (const nd of mc.rangs[r]) {
          if (r < mc.rangs.length - 1) {
            expect(nd.suivants.length).toBeGreaterThan(0)
            expect(nd.suivants).toContain(nd.voie) // tout droit, toujours
            for (const s of nd.suivants) expect(Math.abs(s - nd.voie)).toBeLessThanOrEqual(1)
            expect([...nd.suivants].sort()).toEqual(nd.suivants)
          } else expect(nd.suivants).toEqual([])
          if (r > 0) expect(mc.rangs[r - 1].some((p) => p.suivants.includes(nd.voie))).toBe(true)
        }
    }
  })

  it('une voie du pool par rang quand les tableaux écrits tiennent, aucune sinon ; les mécaniques restent permises', () => {
    const avec = tisse('p', 3, [0, 1])
    for (const r of avec.rangs) {
      expect(r.filter((n) => n.ecrite)).toHaveLength(1)
      for (const n of r) expect([0, 1]).toContain(n.mecanique)
    }
    const sans = tisse('p', 3, [0, 1], false)
    for (const r of sans.rangs) expect(r.some((n) => n.ecrite)).toBe(false)
  })

  it('une halte ne prend jamais la voie du pool tant qu’une autre salle reste, et le dernier rang de l’objectif n’est que salles', () => {
    for (let i = 0; i < 30; i++) {
      // les réglages livrés : un économat, une alcôve, des rencontres — et
      // pourtant une voie du pool par rang, toujours
      const mc = tisseMiniCarte(6, aleaDeGraine(`h${i}`), [0, 1, 2, 3], () => 2, { debut: 1, suite: 2 }, true, {
        ...TISSAGE_DEFAUT,
        economats: 1,
        repos: 1,
        dons: 1,
        coffre: true,
      })
      for (const r of mc.rangs) expect(r.filter((n) => n.ecrite)).toHaveLength(1)
      // le module objectif : son dernier rang se boucle au sas, donc que des salles
      const fin = tisseMiniCarte(6, aleaDeGraine(`h${i}`), [0, 1, 2, 3], () => 3, { debut: 1, suite: 2 }, true, {
        ...TISSAGE_DEFAUT,
        partEvenement: 0.6,
        economats: 2,
        repos: 2,
        dons: 2,
        coffre: true,
        dernierRangSalles: true,
      })
      expect(fin.rangs[5].every((n) => n.nature === 'salle')).toBe(true)
    }
  })

  it('la prime : au plus une par rang, jamais sous rangMin, jamais sur une rencontre ni une halte, et la grille reste la même', () => {
    const base = { ...NU, partEvenement: 0.3, rangMin: 1 }
    const sans = tisseMiniCarte(6, aleaDeGraine('pr'), [0, 1, 2, 3], () => 2, { debut: 1, suite: 2 }, true, base)
    const tout = tisseMiniCarte(6, aleaDeGraine('pr'), [0, 1, 2, 3], () => 2, { debut: 1, suite: 2 }, true, { ...base, partPrime: 1 })
    expect(sans.rangs.flat().every((n) => n.prime === null)).toBe(true)
    for (const r of tout.rangs) {
      const primes = r.filter((n) => n.prime !== null)
      expect(primes.length).toBe(r[0].rang === 0 ? 0 : 1) // le premier rang, jamais
      for (const n of primes) expect(n.nature).toBe('salle')
    }
    expect(tout.rangs.map((r) => r.map((n) => [n.nature, n.mecanique, n.suivants]))).toEqual(
      sans.rangs.map((r) => r.map((n) => [n.nature, n.mecanique, n.suivants])),
    )
    // une halte posée sur la salle primée efface la prime (pas de sas, rien à primer)
    const haltes = tisseMiniCarte(6, aleaDeGraine('pr'), [0, 1, 2, 3], () => 2, { debut: 1, suite: 2 }, true, {
      ...base,
      partPrime: 1,
      economats: 2,
      repos: 2,
      dons: 2,
    })
    for (const n of haltes.rangs.flat()) if (n.nature !== 'salle') expect(n.prime).toBeNull()
    expect(typesDuModule(tout)).toContain('salle à prime')
    expect(typesDuModule(sans)).not.toContain('salle à prime')
    // le dessin marque la prime d'un losange
    expect(dessinMiniCarteSVG(tout, { rang: 1, trace: [0], portes: [0, 1, 2] })).toMatch(/mv-prime mv-prime-(memoire|condensat|tirage)/)
  })

  it('le biome pèse : la mécanique favorite sort plus, jamais sur les trois voies, et la grille reste la même', () => {
    const base = { ...NU, partEvenement: 0.3 }
    const sans = tisseMiniCarte(6, aleaDeGraine('bio'), [0, 1, 2, 3], () => 2, { debut: 1, suite: 2 }, true, base)
    const glace = tisseMiniCarte(6, aleaDeGraine('bio'), [0, 1, 2, 3], () => 2, { debut: 1, suite: 2 }, true, {
      ...base,
      favori: 1,
      partFavori: 1,
    })
    const compte = (mc: ReturnType<typeof tisse>, mec: number): number =>
      mc.rangs.flat().filter((n) => n.mecanique === mec).length
    expect(compte(glace, 1)).toBeGreaterThan(compte(sans, 1))
    // à part entière (100 %), deux voies sur trois : jamais les trois
    for (const r of glace.rangs) {
      expect(r.filter((n) => n.mecanique === 1)).toHaveLength(2)
      expect(r.some((n) => n.mecanique !== 1)).toBe(true)
    }
    // la GRILLE ne bouge pas : mêmes natures, mêmes liaisons (la graine reste alignée)
    expect(glace.rangs.map((r) => r.map((n) => [n.nature, n.suivants]))).toEqual(
      sans.rangs.map((r) => r.map((n) => [n.nature, n.suivants])),
    )
    // une favorite que les mémoires ne permettent pas ne pèse rien
    const interdit = tisseMiniCarte(6, aleaDeGraine('bio'), [0, 2], () => 2, { debut: 1, suite: 2 }, true, { ...base, favori: 1, partFavori: 1 })
    expect(compte(interdit, 1)).toBe(0)
  })

  it('les figures suivent le réglage du plan : deux par rang au milieu', () => {
    const mc = tisse('f')
    for (const r of mc.rangs) expect(r.filter((n) => n.figure)).toHaveLength(2)
  })
})

describe('portesDuRang — ce qu’on peut ouvrir', () => {
  it('au premier rang les trois voies, ensuite celles que le nœud d’avant annonce', () => {
    const mc = tisse('q', 3)
    expect(portesDuRang(mc, 0, null).map((n) => n.voie)).toEqual([0, 1, 2])
    const depuis = mc.rangs[0][1]
    expect(portesDuRang(mc, 1, 1).map((n) => n.voie)).toEqual(depuis.suivants)
    // origine inconnue (sauvegarde d'avant les voies) : les trois
    expect(portesDuRang(mc, 1, null)).toHaveLength(3)
    expect(portesDuRang(mc, 1, 7)).toHaveLength(3)
    // hors de la grille : rien
    expect(portesDuRang(mc, 3, 0)).toEqual([])
  })
})

describe('dessinMiniCarteSVG — la grille dessinée', () => {
  it('un nœud par salle et par voie, les portes et le chemin joué marqués', () => {
    const mc = tisse('d', 3)
    const svg = dessinMiniCarteSVG(mc, { rang: 1, trace: [2], portes: mc.rangs[0][2].suivants })
    expect(svg.startsWith('<svg')).toBe(true)
    expect((svg.match(/class="mv-noeud[ "]/g) ?? []).length).toBe(9)
    expect((svg.match(/class="mv-coche"/g) ?? []).length).toBe(1) // la coche du nœud joué
    expect((svg.match(/ mv-porte"/g) ?? []).length).toBe(mc.rangs[0][2].suivants.length)
    expect(svg).toContain('SALLE 3')
    expect(dessinMiniCarteSVG(tisse('d', 0), { rang: 0, trace: [], portes: [] })).toBe('')
  })
})

describe('les nœuds ÉVÉNEMENT dans la grille', () => {
  it('jamais au premier rang, jamais les trois d’un rang — il reste toujours une salle', () => {
    for (let i = 0; i < 60; i++) {
      const mc = tisse(`e${i}`, 6)
      expect(mc.rangs[0].every((n) => n.nature === 'salle')).toBe(true)
      for (const r of mc.rangs) expect(r.some((n) => n.nature === 'salle')).toBe(true)
    }
  })

  it('un nœud événement n’a pas de tableau du pool : il n’a pas de salle', () => {
    for (let i = 0; i < 60; i++)
      for (const r of tisse(`f${i}`, 6).rangs)
        for (const n of r) if (n.nature === 'evenement') expect(n.ecrite).toBe(false)
  })

  it('il en sort, sans noyer le module : entre un dixième et la moitié des nœuds', () => {
    let evs = 0
    let total = 0
    for (let i = 0; i < 200; i++)
      for (const r of tisse(`g${i}`, 6).rangs)
        for (const n of r) {
          total++
          if (n.nature === 'evenement') evs++
        }
    expect(evs / total).toBeGreaterThan(0.1)
    expect(evs / total).toBeLessThan(0.5)
  })

  it('le dessin marque le nœud événement, et son titre ne dit pas laquelle', () => {
    const mc = tisse('h', 6)
    const svg = dessinMiniCarteSVG(mc, { rang: 0, trace: [], portes: [0, 1, 2] })
    const evs = mc.rangs.flat().filter((n) => n.nature === 'evenement').length
    expect((svg.match(/mv-noeud mv-evenement/g) ?? []).length).toBe(evs)
    if (evs > 0) expect(svg).toContain('une rencontre — on ne sait pas laquelle')
  })
})

describe('les réglages du tissage — ce que le concepteur tourne au banc', () => {
  it('part de rencontres à zéro : aucune ; rang minimal : rien avant', () => {
    // sur deux rangs éligibles à 60 %, un tirage sans aucune rencontre
    // reste possible (0,4⁶) : on compte sur vingt graines, pas sur chacune
    let avecRencontre = 0
    for (let i = 0; i < 20; i++) {
      const sans = tisseMiniCarte(6, aleaDeGraine(`z${i}`), [0, 1, 2, 3], () => 2, { debut: 1, suite: 2 }, true, {
        ...NU,
        partEvenement: 0,
      })
      expect(sans.rangs.flat().every((n) => n.nature === 'salle')).toBe(true)
      const tard = tisseMiniCarte(6, aleaDeGraine(`z${i}`), [0, 1, 2, 3], () => 2, { debut: 1, suite: 2 }, true, {
        ...NU,
        partEvenement: 0.6,
        rangMin: 4,
      })
      for (const r of tard.rangs.slice(0, 4)) expect(r.every((n) => n.nature === 'salle')).toBe(true)
      if (tard.rangs.slice(4).flat().some((n) => n.nature === 'evenement')) avecRencontre++
    }
    expect(avecRencontre).toBeGreaterThan(15)
  })

  it('bifurcation à zéro : trois couloirs parallèles ; à un : chaque paire de voisines reliée dans UN sens', () => {
    const droit = tisseMiniCarte(4, aleaDeGraine('b'), [0], () => 1, { debut: 0, suite: 0 }, false, { ...NU, bifurcation: 0 })
    for (const r of droit.rangs.slice(0, -1)) for (const n of r) expect(n.suivants).toEqual([n.voie])
    const tout = tisseMiniCarte(4, aleaDeGraine('b'), [0], () => 1, { debut: 0, suite: 0 }, false, { ...NU, bifurcation: 1 })
    // toutes les bifurcations sont tirées ; le X de chaque paire se défait
    // en gardant une seule des deux diagonales
    for (const r of tout.rangs.slice(0, -1))
      for (const v of [0, 1]) expect(Number(r[v].suivants.includes(v + 1)) + Number(r[v + 1].suivants.includes(v))).toBe(1)
  })

  it('aucun croisement : jamais deux voisines qui bifurquent l’une vers l’autre, et aucune voie morte', () => {
    // un X : la voie v mène à v+1 ET la voie v+1 mène à v, au même rang
    const croisements = (mc: MiniCarte): number =>
      mc.rangs.flat().filter((n) => n.suivants.includes(n.voie + 1) && mc.rangs[n.rang][n.voie + 1]?.suivants.includes(n.voie)).length
    let bifurcations = 0
    for (let g = 0; g < 400; g++) {
      const mc = tisseMiniCarte(6, aleaDeGraine(`x${g}`), [0, 1, 2, 3], () => 2, { debut: 1, suite: 2 }, true, NU)
      expect(croisements(mc)).toBe(0)
      bifurcations += mc.rangs.flat().filter((n) => n.suivants.length > 1).length
      for (let r = 1; r < mc.rangs.length; r++)
        for (const n of mc.rangs[r]) expect(mc.rangs[r - 1].some((p) => p.suivants.includes(n.voie))).toBe(true)
    }
    // les fourches restent : le choix ne se réduit pas à trois couloirs
    expect(bifurcations / 400).toBeGreaterThan(3)
  })

  it('les réglages n’ajoutent aucun tirage : la même graine donne la même grille quel que soit le réglage des salles', () => {
    // la part change QUELS nœuds sont des rencontres, pas la géométrie ni les mécaniques
    const a = tisseMiniCarte(6, aleaDeGraine('g'), [0, 1, 2, 3], () => 2, { debut: 1, suite: 2 }, true, { ...NU, partEvenement: 0 })
    const b = tisseMiniCarte(6, aleaDeGraine('g'), [0, 1, 2, 3], () => 2, { debut: 1, suite: 2 }, true, { ...NU, partEvenement: 0.5 })
    expect(a.rangs.flat().map((n) => `${n.mecanique}${n.suivants.join('')}`)).toEqual(b.rangs.flat().map((n) => `${n.mecanique}${n.suivants.join('')}`))
  })
})

describe('les HALTES dans la grille — l’économat, l’alcôve, la bonbonne, la cache', () => {
  const avec = (graine: string, r: Partial<typeof TISSAGE_DEFAUT> = {}) =>
    tisseMiniCarte(6, aleaDeGraine(graine), [0, 1, 2, 3], () => 2, { debut: 1, suite: 2 }, true, { ...TISSAGE_DEFAUT, ...r })

  it('pose exactement ce que le plan demande, jamais au premier rang, jamais la dernière salle d’un rang', () => {
    for (let i = 0; i < 40; i++) {
      const mc = avec(`h${i}`, { economats: 1, repos: 1, dons: 1, coffre: true, minijeux: 1 })
      const n = mc.rangs.flat()
      expect(n.filter((x) => x.nature === 'economat')).toHaveLength(1)
      expect(n.filter((x) => x.nature === 'repos')).toHaveLength(1)
      expect(n.filter((x) => x.nature === 'don')).toHaveLength(1)
      expect(n.filter((x) => x.nature === 'coffre')).toHaveLength(1)
      expect(n.filter((x) => x.nature === 'minijeu')).toHaveLength(1) // la pesée, posée comme une halte
      expect(mc.rangs[0].every((x) => x.nature === 'salle')).toBe(true)
      for (const r of mc.rangs) expect(r.some((x) => x.nature === 'salle')).toBe(true)
      for (const x of n) if (x.nature !== 'salle') expect(x.ecrite).toBe(false)
    }
  })

  it('à zéro, aucune ; sans orbe sur la carte, aucune cache', () => {
    const mc = avec('k', { economats: 0, repos: 0, dons: 0, coffre: false, minijeux: 0 })
    expect(mc.rangs.flat().every((x) => x.nature === 'salle' || x.nature === 'evenement')).toBe(true)
  })

  it('typesDuModule dit ce qu’on trouvera, par types, sans compter', () => {
    const t = typesDuModule(avec('t', { economats: 1, repos: 1, dons: 0, coffre: true, minijeux: 1, partEvenement: 0.5 }))
    expect(t).toContain('économat')
    expect(t).toContain('alcôve')
    expect(t).toContain('cache')
    expect(t).toContain('mini-jeu')
    expect(t).not.toContain('bonbonne')
    expect(t.some((x) => ['eau', 'glace', 'vapeur', 'toutes mécaniques'].includes(x))).toBe(true)
    // les mécaniques d'abord, les haltes ensuite : l'ordre de lecture
    expect(t.indexOf('économat')).toBeGreaterThan(t.findIndex((x) => ['eau', 'glace', 'vapeur', 'toutes mécaniques'].includes(x)))
    expect(new Set(t).size).toBe(t.length)
  })

  it('le dessin donne une icône et une teinte de halte à chaque nœud de halte', () => {
    const mc = avec('d2', { economats: 1, repos: 1, dons: 1, coffre: true })
    const svg = dessinMiniCarteSVG(mc, { rang: 0, trace: [], portes: [0, 1, 2] })
    for (const h of ['economat', 'repos', 'don', 'coffre']) {
      expect(svg).toContain(`mv-halte mv-${h}`)
      expect(svg).toContain(`href="#mv-i-${h}"`)
    }
  })
})

describe('cheminDePorte — ce que le survol d’une porte allume', () => {
  // 0 → 0,1 ; 1 → 1 ; 2 → 2 ; puis 0 → 0 ; 1 → 1,2 ; 2 → 2 ; dernier rang
  const nd = (rang: number, voie: number, suivants: number[]) =>
    ({ rang, voie, mecanique: 0, figure: false, ecrite: false, nature: 'salle', prime: null, suivants }) as const
  const mc: MiniCarte = {
    voies: 3,
    rangs: [
      [nd(0, 0, [0, 1]), nd(0, 1, [1]), nd(0, 2, [2])],
      [nd(1, 0, [0]), nd(1, 1, [1, 2]), nd(1, 2, [2])],
      [nd(2, 0, []), nd(2, 1, []), nd(2, 2, [])],
    ].map((r) => r.map((n) => ({ ...n, suivants: [...n.suivants] }))),
  }

  it('la coursive d’entrée, puis tout ce que la porte rend joignable — rien d’autre', () => {
    const ch = cheminDePorte(mc, 1, 1, 0)
    expect(ch.entree).toBe('0-0-1')
    expect(ch.noeuds.sort()).toEqual(['1-1', '2-1', '2-2'])
    expect(ch.liens.sort()).toEqual(['1-1-1', '1-1-2'])
  })

  it('au premier rang, pas d’entrée ; une porte hors grille, rien', () => {
    expect(cheminDePorte(mc, 0, 2, null)).toEqual({ noeuds: ['0-2', '1-2', '2-2'], liens: ['0-2-2', '1-2-2'], entree: null })
    expect(cheminDePorte(mc, 5, 0, null)).toEqual({ noeuds: [], liens: [], entree: null })
  })

  it('le choix interdit : après la voie 0, les liens et nœuds qui ne sont plus joignables s’éteignent', () => {
    // venu de la voie 0 au rang 0 : portes 0 et 1 au rang 1 ; la voie 2 n'est
    // plus joignable qu'en passant par 1 → 2 — le nœud 1-2 est interdit
    const svg = dessinMiniCarteSVG(mc, { rang: 1, trace: [0], portes: [0, 1] })
    const classe = (k: string): string => /class="([^"]*)" data-lien="/.exec(svg.slice(svg.indexOf(`data-lien="${k}"`) - 60))?.[1] ?? ''
    expect(classe('0-1-1')).toContain('mv-interdit') // une voie qu'on n'a pas prise
    expect(classe('0-2-2')).toContain('mv-interdit')
    expect(classe('1-2-2')).toContain('mv-interdit') // part d'un nœud qu'on n'atteindra plus
    expect(classe('0-0-1')).not.toContain('mv-interdit') // la porte ouverte
    expect(classe('1-1-2')).not.toContain('mv-interdit') // la suite joignable
    expect(svg).toMatch(/mv-interdit" data-rang="1" data-voie="2"/)
    expect(svg).not.toMatch(/mv-interdit" data-rang="2" data-voie="2"/) // joignable par 1 → 2
  })

  it('au premier rang, rien n’est interdit', () => {
    expect(dessinMiniCarteSVG(mc, { rang: 0, trace: [], portes: [0, 1, 2] })).not.toContain('mv-interdit')
  })

  it('les clés sont celles du dessin : chaque lien allumé existe dans le SVG', () => {
    const svg = dessinMiniCarteSVG(mc, { rang: 1, trace: [0], portes: [0, 1] })
    const ch = cheminDePorte(mc, 1, 1, 0)
    for (const k of [...ch.liens, ch.entree!]) expect(svg).toContain(`data-lien="${k}"`)
  })

  it('ce qu’une porte ferme : ce que les autres gardaient ouvert, et pas elle', () => {
    // venu de la voie 0 : portes 0 et 1. Prendre 0 perd la porte 1, la voie
    // 2 qu'elle seule atteint, et leurs coursives ; 1-1 → 2-1 est perdu
    // aussi (2-1 n'est joignable que par 1-1)
    const f = fermeParPorte(mc, 1, 0, [0, 1], 0)
    expect(f.noeuds.sort()).toEqual(['1-1', '2-1', '2-2'])
    expect(f.liens.sort()).toEqual(['0-0-1', '1-1-1', '1-1-2', '2-1-sas', '2-2-sas'])
    // prendre 1 perd la voie 0 : ses nœuds, sa coursive d'entrée
    const g = fermeParPorte(mc, 1, 1, [0, 1], 0)
    expect(g.noeuds.sort()).toEqual(['1-0', '2-0'])
    expect(g.liens.sort()).toEqual(['0-0-0', '1-0-0', '2-0-sas'])
    // une seule porte : elle ne ferme rien
    expect(fermeParPorte(mc, 1, 1, [1], 0)).toEqual({ noeuds: [], liens: [] })
  })

  it('les repères de voie : un signe par voie au bord de la grille, allumé là où une porte s’ouvre', () => {
    const svg = dessinMiniCarteSVG(mc, { rang: 1, trace: [0], portes: [0, 1] })
    for (const [v, rep] of REPERES_VOIE.entries()) expect(svg).toContain(`data-voie="${v}" x="16" y="${32 + v * 50}">${rep.signe}</text>`)
    expect(svg).toContain('class="mv-repere mv-repere-porte" data-voie="0"')
    expect(svg).toContain('class="mv-repere mv-repere-porte" data-voie="1"')
    expect(svg).toContain('class="mv-repere" data-voie="2"')
  })

  it('une forme par famille : octogone la salle, losange la rencontre, cercle la halte ; la prime a son anneau', () => {
    const avec = (nature: 'evenement' | 'repos', prime: 'memoire' | null = null): MiniCarte => ({
      voies: 3,
      rangs: mc.rangs.map((r) => r.map((n) => (n.rang === 1 && n.voie === 0 ? { ...n, nature, prime } : n))),
    })
    const tuile = (svg: string): string => {
      const g = svg.slice(svg.indexOf('data-rang="1" data-voie="0"'))
      return g.slice(g.indexOf('class="mv-tuile"') - 12, g.indexOf('class="mv-tuile"'))
    }
    expect(tuile(dessinMiniCarteSVG(mc, { rang: 1, trace: [0], portes: [0, 1] }))).toContain('<polygon')
    const ev = dessinMiniCarteSVG(avec('evenement'), { rang: 1, trace: [0], portes: [0, 1] })
    expect(tuile(ev)).toContain('<polygon')
    expect(ev).toMatch(/<polygon class="mv-tuile" points="0,-[\d.]+ [\d.]+,0 0,[\d.]+ -[\d.]+,0"\/>/) // quatre sommets : le losange
    expect(tuile(dessinMiniCarteSVG(avec('repos'), { rang: 1, trace: [0], portes: [0, 1] }))).toContain('<circle')
    const salle = mc.rangs.map((r) => r.map((n) => (n.rang === 1 && n.voie === 0 ? { ...n, prime: 'memoire' as const } : n)))
    expect(dessinMiniCarteSVG({ voies: 3, rangs: salle }, { rang: 1, trace: [0], portes: [0, 1] })).toContain('mv-prime-anneau mv-prime-memoire')
  })

  it('le sas au bout : chaque case du dernier rang y mène, éteinte avec elle ; la bande « ici » sur le rang du choix', () => {
    const svg = dessinMiniCarteSVG(mc, { rang: 1, trace: [0], portes: [0, 1] })
    expect(svg).toContain('class="mv-sas"')
    for (const v of [0, 1, 2]) expect(svg).toContain(`data-lien="2-${v}-sas"`)
    // venu de 0, portes 0 et 1 : les trois cases du dernier rang restent joignables
    expect(svg).not.toMatch(/mv-interdit" data-lien="2-\d-sas"/)
    expect(svg).toContain('class="mv-ici"')
    expect(svg).toMatch(/class="mv-titre mv-courant" x="140" y="\d+">SALLE 2</)
    // module fini : pas de bande
    expect(dessinMiniCarteSVG(mc, { rang: 3, trace: [0, 0, 0], portes: [] })).not.toContain('class="mv-ici"')
  })

  it('ditNoeud : la phrase de la fiche, prime comprise', () => {
    expect(ditNoeud(mc.rangs[0][0])).toBe('salle · eau')
    expect(ditNoeud({ ...mc.rangs[0][0], prime: 'tirage' })).toContain('PRIME : tirage garanti')
    expect(ditNoeud({ ...mc.rangs[0][0], nature: 'evenement' })).toBe('une rencontre — on ne sait pas laquelle')
  })
})
