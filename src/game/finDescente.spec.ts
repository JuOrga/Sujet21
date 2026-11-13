import { describe, expect, it } from 'vitest'
import { GARDE_GESTE_MS } from './ceremonie'
import { finDescenteHTML, LEVIER_FIN_MS, levierFin, levierFinPret, releveDescente, titresFin } from './finDescente'

// LE RELEVÉ DE LA DESCENTE : ce que la scène de fin (bouclée, perdue,
// reprise) écrit en chiffres. Les attendus sont ceux que fmtL et fmtDuree
// rendaient dans main.ts avant leur déménagement (lancés une fois le 13/11,
// recopiés en dur) : le relevé ne doit pas changer l'écriture d'un litre ni
// d'une durée.
describe('le relevé de la descente', () => {
  const bouclee = {
    salles: 18,
    total: 18,
    livreL: 31.4,
    dureeS: 3720,
    instruments: 6,
    memoireGagnee: 240,
    palier: 4,
  }

  it('écrit une descente bouclée comme le reste du jeu l’écrit', () => {
    const r = releveDescente(bouclee)
    expect(r.salles).toBe('18/18')
    expect(r.litres).toBe('31,40 L')
    expect(r.duree).toBe('62:00')
    expect(r.instruments).toBe(6)
    expect(r.memoire).toBe('+240')
    expect(r.palier).toBe(4)
  })

  it('écrit une descente sans salle livrée comme fmtL(0)', () => {
    const r = releveDescente({ salles: 0, total: 18, livreL: 0, dureeS: 0, instruments: 0, memoireGagnee: 0, palier: 0 })
    expect(r.litres).toBe('0,00 L')
    expect(r.salles).toBe('0/18')
    expect(r.duree).toBe('0,0 s')
    expect(r.memoire).toBe('+0')
  })

  it('n’écrit jamais NaN, même d’une sauvegarde abîmée', () => {
    const r = releveDescente({
      salles: NaN,
      total: Infinity,
      livreL: NaN,
      dureeS: -Infinity,
      instruments: NaN,
      memoireGagnee: NaN,
      palier: NaN,
    })
    for (const [champ, v] of Object.entries(r)) {
      expect(String(v), champ).not.toMatch(/NaN|Infinity/)
      if (typeof v === 'number') expect(Number.isFinite(v), champ).toBe(true)
    }
  })

  it('porte la longueur à la profondeur quand la carte la donne plus courte (« 19/19 », jamais « 19/18 »)', () => {
    // la longueur se recalcule sur la carte : elle ne descend pas sous la
    // profondeur atteinte, mais un relevé ne doit pas dire « 19/18 »
    expect(releveDescente({ ...bouclee, salles: 19 }).salles).toBe('19/19')
  })
})

// LA SCÈNE : ce que le voile montre sous la poutre. Le gabarit vit ici,
// testé sans navigateur, et le banc de la cérémonie l'emploie tel quel.
describe('la scène de fin de descente', () => {
  const r = releveDescente({ salles: 18, total: 18, livreL: 31.4, dureeS: 3720, instruments: 3, memoireGagnee: 240, palier: 4 })
  const butin = [
    { id: 'aimant-rosee', icone: '🧲', nom: 'Aimant à rosée' },
    { id: 'croc-du-sas', icone: '🪝', nom: 'Croc du sas' },
    { id: 'ration-de-survie', icone: '🥫', nom: 'Ration de survie' },
  ]
  const EMOJI = /\p{Extended_Pictographic}/u

  it('pose le relevé en sceau et en cartouches, chaque chiffre à sa place', () => {
    const h = finDescenteHTML({ issue: 'bouclee', releve: r, butin })
    // les salles sur le sceau du module, le reste en cartouches
    expect(h).toMatch(/class="mb-sceau[^"]*"[\s\S]*ico-sceau[\s\S]*18\/18/)
    for (const v of ['31,40 L', '62:00', '+240']) expect(h).toContain(`<b class="mb-cartouche-val">${v}</b>`)
    expect(h).toContain('<b class="mb-cartouche-val">3</b>')
    expect(h).toContain('<b class="mb-cartouche-val">4</b>')
    expect(h.match(/class="mb-cartouche /g)?.length).toBe(5)
  })

  it('tient en UNE rangée : le sceau, les cartouches, le butin', () => {
    // la scène est l'image : le relevé se pose dans son tiers bas, sur une
    // seule rangée (constat de relecture : il en couvrait la moitié)
    const h = finDescenteHTML({ issue: 'bouclee', releve: r, butin, tampons: ['MEILLEURE DESCENTE'] })
    // la rangée est le seul enfant de la scène : on suit ses <div> jusqu'à
    // sa fermeture, qui doit être celle d'avant la dernière
    const debut = h.indexOf('<div class="mb-fin-releve">')
    expect(debut).toBeGreaterThan(-1)
    let prof = 0
    let fin = -1
    for (const m of h.slice(debut).matchAll(/<(\/?)div\b/g)) {
      prof += m[1] ? -1 : 1
      if (prof === 0) {
        fin = debut + m.index!
        break
      }
    }
    expect(fin).toBe(h.length - '</div></div>'.length)
    const rangee = h.slice(debut, fin)
    expect(h.slice(0, debut)).toBe('<div class="mb-fin mb-fin-bouclee">')
    for (const c of ['mb-fin-salles', 'mb-fin-butin', 'mb-fin-tampon']) expect(rangee, c).toContain(c)
    expect(h).not.toContain('mb-fin-palmares')
    expect(h).not.toContain('mb-fin-legende')
  })

  it('montre le butin en icônes rendues, sans un émoji', () => {
    const h = finDescenteHTML({ issue: 'bouclee', releve: r, butin, tampons: ['MEILLEURE DESCENTE'] })
    expect(h.match(/class="ico-instrument"/g)?.length).toBe(3)
    expect(h).not.toMatch(EMOJI)
  })

  it('rend son emoji à un instrument sans case, jamais un carré vide', () => {
    const h = finDescenteHTML({ issue: 'bouclee', releve: r, butin: [{ id: 'perso-1', icone: '🛠️', nom: 'Clef « maison »' }] })
    expect(h).toContain('🛠️')
    expect(h).toContain('Clef « maison »')
  })

  it('tamponne les records sur le sceau ; le palmarès et la purge passent en infobulle', () => {
    const h = finDescenteHTML({
      issue: 'bouclee',
      releve: r,
      butin,
      tampons: ['MEILLEURE DESCENTE', 'MEILLEURE EXPÉDITION'],
      palmares: { bouclees: 2, profondeurRecord: 18, meilleurLivre: '61,40 L' },
      purgeCl: 1890,
    })
    // UN tampon, posé dans la figure du sceau ; les records nommés en infobulle
    expect(h.match(/class="mb-fin-tampon"/g)?.length).toBe(1)
    expect(h).toMatch(/<figure class="mb-fin-salles"[^>]*>[\s\S]*<em class="mb-fin-tampon" title="MEILLEURE DESCENTE · MEILLEURE EXPÉDITION">RECORD<\/em>[\s\S]*<\/figure>/)
    // le palmarès du poste dans l'infobulle du sceau, la purge dans celle de la mémoire
    expect(h).toMatch(/<figure class="mb-fin-salles" title="[^"]*palmarès du poste : 2 bouclées · profondeur record 18 · meilleur livré 61,40 L"/)
    expect(h).toMatch(/class="mb-cartouche mb-cartouche-memoire" style="--i:\d" title="[^"]*1890 cL[^"]*"/)
    expect(h.match(/class="mb-cartouche /g)?.length).toBe(5)
  })

  it('ne tamponne rien et ne dit aucun palmarès quand il n’y en a pas', () => {
    const h = finDescenteHTML({ issue: 'perdue', releve: r, butin: [] })
    expect(h).not.toContain('mb-fin-tampon')
    expect(h).not.toContain('palmarès')
    expect(h).not.toContain('mb-fin-butin')
    expect(h).toContain('mb-fin-perdue')
  })

  it('à la reprise, dit les secours qui restent et la profondeur, sans sceau de fin', () => {
    const h = finDescenteHTML({ issue: 'reprise', releve: releveDescente({ salles: 5, total: 18, livreL: 7, dureeS: 400, instruments: 1, memoireGagnee: 30, palier: 1 }), secours: 2 })
    expect(h).not.toContain('mb-sceau')
    expect(h).toContain('<b class="mb-cartouche-val">×2</b>')
    expect(h).toContain('<b class="mb-cartouche-val">5/18</b>')
  })

  it('échappe ce qui vient de l’éditeur', () => {
    const h = finDescenteHTML({ issue: 'bouclee', releve: r, butin: [{ id: 'x', icone: '<b>', nom: '<script>' }], tampons: ['<i>'] })
    expect(h).not.toContain('<script>')
    expect(h).not.toContain('<i>')
  })
})

describe('les mots de la fin', () => {
  it('garde au levier le libellé du bouton de l’overlay', () => {
    expect(levierFin('reprise', 6)).toBe('REPRENDRE — SALLE 6')
    expect(levierFin('bouclee', 18)).toBe('RETOUR AU LABO')
    expect(levierFin('perdue', 7)).toBe('RETOUR AU LABO')
  })
  it('dit ce qui a emporté l’échantillon : la dispersion ou le vide', () => {
    expect(titresFin('perdue', false).contexte).toContain('DISPERSION')
    expect(titresFin('perdue', true).contexte).toContain('VIDE')
    expect(titresFin('reprise', true).titre).toBe('ÉCHANTILLON ASPIRÉ PAR LE VIDE')
    expect(titresFin('reprise', false).titre).toBe('ÉCHANTILLON DISPERSÉ')
    expect(titresFin('bouclee', false).titre).toBe('LA DESCENTE EST BOUCLÉE')
  })
})

// UN GESTE EN RAFALE NE SAUTE PAS LA SCÈNE (constat de relecture) : Entrée
// et Espace font avancer les planches de la cinématique ; la dernière la
// ferme, la scène s'ouvre, le levier prend le focus — et la pression
// suivante pressait RETOUR AU LABO, levier encore invisible. Il ne
// s'actionne qu'une fois paru ; sans animation il paraît tout de suite, et
// seule la garde du dépôt (GARDE_GESTE_MS) reste.
describe('le levier de la fin', () => {
  const t0 = 10_000
  it('ignore tout geste tant qu’il n’a pas paru', () => {
    expect(levierFinPret(t0, t0, false)).toBe(false)
    expect(levierFinPret(t0 + GARDE_GESTE_MS, t0, false)).toBe(false)
    expect(levierFinPret(t0 + LEVIER_FIN_MS - 1, t0, false)).toBe(false)
    expect(levierFinPret(t0 + LEVIER_FIN_MS, t0, false)).toBe(true)
  })
  it('sans animation, il paraît tout de suite : seule la garde du dépôt tient', () => {
    expect(levierFinPret(t0 + GARDE_GESTE_MS - 1, t0, true)).toBe(false)
    expect(levierFinPret(t0 + GARDE_GESTE_MS, t0, true)).toBe(true)
  })
  it('obéit plutôt que de bloquer si l’horloge recule', () => {
    expect(levierFinPret(t0 - 5, t0, false)).toBe(true)
  })
})

describe('les lignes de contexte', () => {
  it('disent quelques mots, pas une phrase', () => {
    for (const issue of ['bouclee', 'perdue', 'reprise'] as const)
      for (const vide of [false, true]) expect(titresFin(issue, vide).contexte.length, `${issue} ${vide}`).toBeLessThanOrEqual(32)
    // la bouclée n'en a pas : l'image et le titre suffisent
    expect(titresFin('bouclee', false).contexte).toBe('')
  })
})
