import { describe, expect, it } from 'vitest'
import {
  type EchoSeq,
  type EtapeSeq,
  SEQUENCE_ALERTE,
  Sequenceur,
  fusionneSequences,
  parseSequence,
  poseSequencesPubliees,
  sequencesJouees,
  serializeSequence,
} from './sequence'

function echoMuet(): EchoSeq & { bruits: string[]; cines: string[] } {
  const bruits: string[] = []
  const cines: string[] = []
  return {
    bruits,
    cines,
    bruitage: (n) => bruits.push(n),
    ponctuation: (n) => bruits.push(`p:${n}`),
    piste: (n) => bruits.push(`m:${n}`),
    cinematique: (c) => {
      cines.push(c)
      return Promise.resolve()
    },
  }
}

const et = (p: Partial<EtapeSeq>): EtapeSeq => ({
  action: 'attendre',
  texte: '',
  valeur: 100,
  duree: 1,
  ...p,
})

describe('le séquenceur — la mise en scène dans le tableau', () => {
  it('déroule les étapes au rythme du temps de jeu', () => {
    const echo = echoMuet()
    const s = new Sequenceur(echo)
    s.demarre({
      code: 'T',
      titre: 'T',
      etapes: [et({ duree: 1 }), et({ action: 'bruitage', texte: 'gel', duree: 1 })],
    })
    expect(echo.bruits).toEqual([]) // la première étape attend
    s.avance(0.5)
    expect(echo.bruits).toEqual([])
    s.avance(0.6) // on franchit la seconde
    expect(echo.bruits).toEqual(['gel'])
    expect(s.actif).toBe(true)
    s.avance(1.1)
    expect(s.actif).toBe(false) // la séquence est finie
  })

  it('enchaîne sans trou les étapes de durée nulle', () => {
    const echo = echoMuet()
    const s = new Sequenceur(echo)
    s.demarre({
      code: 'T',
      titre: 'T',
      etapes: [
        et({ action: 'bruitage', texte: 'a', duree: 0 }),
        et({ action: 'bruitage', texte: 'b', duree: 0 }),
        et({ action: 'bruitage', texte: 'c', duree: 5 }),
      ],
    })
    // la première part au démarrage, les suivantes au premier souffle
    s.avance(0.016)
    expect(echo.bruits).toEqual(['a', 'b', 'c'])
  })

  it('les lampes virent, puis retrouvent leur couleur quand on la vide', () => {
    const s = new Sequenceur(echoMuet())
    s.demarre({
      code: 'T',
      titre: 'T',
      etapes: [
        et({ action: 'lampes', texte: '#e8433c', valeur: 130, duree: 1 }),
        et({ action: 'lampes', texte: '', valeur: 100, duree: 1 }),
      ],
    })
    expect(s.etat.teinte).toBe('#e8433c')
    expect(s.etat.gain).toBeCloseTo(1.3)
    s.avance(1.1)
    expect(s.etat.teinte).toBeNull()
    expect(s.etat.gain).toBeCloseTo(1)
  })

  it('LA BRÈCHE ne se referme jamais — c’est un événement, pas un interrupteur', () => {
    const s = new Sequenceur(echoMuet())
    s.demarre({
      code: 'T',
      titre: 'T',
      etapes: [et({ action: 'breche', valeur: 2, duree: 1 }), et({ duree: 1 })],
    })
    expect([...s.etat.brechesOuvertes]).toEqual([2])
    s.avance(1.1)
    expect([...s.etat.brechesOuvertes]).toEqual([2]) // toujours ouverte
    s.avance(5)
    expect([...s.etat.brechesOuvertes]).toEqual([2]) // même la séquence finie
  })

  it('la carte et la secousse ne durent QUE leur étape', () => {
    const s = new Sequenceur(echoMuet())
    s.demarre({
      code: 'T',
      titre: 'T',
      etapes: [
        et({ action: 'carte', texte: 'Le confinement cède.', duree: 2 }),
        et({ action: 'secousse', duree: 1 }),
        et({ duree: 1 }),
      ],
    })
    expect(s.etat.carte).toBe('Le confinement cède.')
    expect(s.etat.secousse).toBe(false)
    s.avance(2.1)
    expect(s.etat.carte).toBe('') // la carte s'efface en changeant d'étape
    expect(s.etat.secousse).toBe(true)
    s.avance(1.1)
    expect(s.etat.secousse).toBe(false)
  })

  it('une cinématique SUSPEND la séquence jusqu’à sa fin', async () => {
    const echo = echoMuet()
    let debloque: () => void = () => {}
    echo.cinematique = (c) => {
      echo.cines.push(c)
      return new Promise<void>((r) => (debloque = r))
    }
    const s = new Sequenceur(echo)
    s.demarre({
      code: 'T',
      titre: 'T',
      etapes: [
        et({ action: 'cinematique', texte: 'MIROIR', duree: 0 }),
        et({ action: 'bruitage', texte: 'apres', duree: 1 }),
      ],
    })
    expect(echo.cines).toEqual(['MIROIR'])
    s.avance(10) // le temps passe : rien ne bouge tant que la ciné tient
    expect(echo.bruits).toEqual([])
    debloque()
    await Promise.resolve()
    s.avance(0.016)
    expect(echo.bruits).toEqual(['apres'])
  })

  it('réinitialiser rend le tableau vierge (y compris les brèches)', () => {
    const s = new Sequenceur(echoMuet())
    s.demarre({
      code: 'T',
      titre: 'T',
      etapes: [et({ action: 'breche', valeur: 1, duree: 0 }), et({ action: 'lampes', texte: '#f00', duree: 5 })],
    })
    s.avance(0.016)
    expect(s.etat.brechesOuvertes.size).toBe(1)
    expect(s.etat.teinte).toBe('#f00')
    s.reinitialise()
    expect(s.actif).toBe(false)
    expect(s.etat.brechesOuvertes.size).toBe(0)
    expect(s.etat.teinte).toBeNull()
    expect(s.etat.gain).toBe(1)
  })

  it('une séquence sans étape jouable ne bloque rien', () => {
    const s = new Sequenceur(echoMuet())
    s.demarre({ code: 'T', titre: 'T', etapes: [] })
    expect(s.actif).toBe(false)
    s.avance(1) // ne doit pas boucler ni jeter
    expect(s.actif).toBe(false)
  })
})

describe('les séquences — le format de données', () => {
  it('sérialise puis relit à l’identique', () => {
    const s = {
      code: 'ALERTE',
      titre: 'Alerte',
      etapes: [et({ action: 'lampes', texte: '#e8433c', valeur: 130, duree: 0 })],
    }
    expect(parseSequence(JSON.parse(serializeSequence(s)))).toEqual(s)
  })

  it('refuse le vide, écarte les étapes illisibles ou d’action inconnue', () => {
    expect(parseSequence(null)).toBeNull()
    expect(parseSequence({ code: '', etapes: [et({})] })).toBeNull()
    expect(parseSequence({ code: 'X', etapes: [] })).toBeNull()
    const s = parseSequence({
      code: 'X',
      etapes: [{ action: 'exploser-la-lune' }, 'pas un objet', { action: 'attendre', duree: 3 }],
    })!
    expect(s.etapes).toHaveLength(1)
    expect(s.etapes[0].duree).toBe(3)
  })

  it('borne les durées et les valeurs', () => {
    const s = parseSequence({
      code: 'X',
      etapes: [{ action: 'attendre', duree: 9999 }, { action: 'lampes', valeur: -5 }],
    })!
    expect(s.etapes[0].duree).toBe(60)
    expect(s.etapes[1].valeur).toBe(0)
  })

  it('la séquence ALERTE livrée est valide et se relit', () => {
    const relu = parseSequence(JSON.parse(serializeSequence(SEQUENCE_ALERTE)))
    expect(relu).toEqual(SEQUENCE_ALERTE)
  })

  it('LE GABARIT DE L’OUVERTURE : rouge, secousse, brèche — dans cet ordre', () => {
    const echo = echoMuet()
    const s = new Sequenceur(echo)
    s.demarre(SEQUENCE_ALERTE)
    const virages: string[] = []
    // on déroule 15 s par pas de 0,1 s et on note ce qui change
    let teintePrec: string | null = null
    let brechePrec = 0
    let secoussePrec = false
    for (let t = 0; t < 150; t++) {
      s.avance(0.1)
      if (s.etat.teinte !== teintePrec) {
        teintePrec = s.etat.teinte
        virages.push(`teinte:${teintePrec}`)
      }
      if (s.etat.secousse !== secoussePrec) {
        secoussePrec = s.etat.secousse
        if (secoussePrec) virages.push('secousse')
      }
      if (s.etat.brechesOuvertes.size !== brechePrec) {
        brechePrec = s.etat.brechesOuvertes.size
        virages.push('breche')
      }
    }
    expect(virages).toEqual(['teinte:#e8433c', 'secousse', 'breche', 'teinte:#e8843c'])
    expect(s.actif).toBe(false) // tout est joué en moins de 15 s
  })
})

describe('les séquences publiées — le poste prime, par code', () => {
  const seq = (code: string, titre: string) => ({ code, titre, etapes: [{ action: 'attendre', texte: '', valeur: 100, duree: 1 }] })

  it('les publiées se relisent propres et jouent ; une séquence du poste remplace la publiée du même code', () => {
    const publiees = poseSequencesPubliees({ sequences: [seq('A', 'publiée A'), seq('B', 'publiée B'), { code: '' }] })
    expect(publiees.map((s) => s.titre)).toEqual(['publiée A', 'publiée B'])
    // sans stockage (ici), le poste n'a rien : les publiées jouent seules
    expect(sequencesJouees().map((s) => s.titre)).toEqual(['publiée A', 'publiée B'])
    const locales = [parseSequence(seq('B', 'poste B'))!, parseSequence(seq('C', 'poste C'))!]
    expect(fusionneSequences(publiees, locales).map((s) => s.titre)).toEqual(['publiée A', 'poste B', 'poste C'])
    expect(poseSequencesPubliees(null)).toEqual([])
    expect(fusionneSequences([], locales).map((s) => s.code)).toEqual(['B', 'C'])
  })
})
