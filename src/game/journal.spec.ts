import { describe, expect, it } from 'vitest'
import { CODEX_EXPERIENCES, fichesCodex } from './codex'
import {
  ID_RESERVE,
  JOURNAL_LIVRE,
  ajouteEntree,
  denouementAtteint,
  deplaceEntree,
  estAttention,
  fichesJournal,
  finsVues,
  fragmentsVus,
  idLibreJournal,
  journalCourant,
  litJournal,
  memeJournal,
  modifieEntree,
  poseJournal,
  poseSeuil,
  prochainFragment,
  prochaineFin,
  revelationAtteinte,
  supprimeEntree,
  verifieJournal,
  type JournalDef,
} from './journal'

const ids = (j: JournalDef) => [...j.recit, ...j.fins].map((e) => e.id)

describe('le journal livré', () => {
  it('dix fragments — la livraison ouvre, le choix ferme — et la fin de l’arc', () => {
    expect(JOURNAL_LIVRE.recit.length).toBe(10)
    expect(JOURNAL_LIVRE.recit[0].id).toBe('recit-livraison')
    expect(JOURNAL_LIVRE.recit[9].id).toBe('recit-le-choix')
    expect(JOURNAL_LIVRE.fins.map((e) => e.id)).toEqual(['fin-miroir'])
    expect(JOURNAL_LIVRE.revelationApres).toBe(10)
    expect(JOURNAL_LIVRE.denouementApres).toBe(1)
  })

  it('les ids sont uniques, préfixés par leur groupe, jamais le marqueur réservé ; tout est écrit', () => {
    expect(new Set(ids(JOURNAL_LIVRE)).size).toBe(ids(JOURNAL_LIVRE).length)
    for (const e of JOURNAL_LIVRE.recit) expect(e.id.startsWith('recit-'), e.id).toBe(true)
    for (const e of JOURNAL_LIVRE.fins) expect(e.id.startsWith('fin-'), e.id).toBe(true)
    expect(ids(JOURNAL_LIVRE).includes(ID_RESERVE)).toBe(false)
    for (const e of [...JOURNAL_LIVRE.recit, ...JOURNAL_LIVRE.fins]) {
      expect(e.titre.length, e.id).toBeGreaterThan(3)
      expect(e.texte.length, e.id).toBeGreaterThan(80) // un vrai jalon, pas un stub
    }
    expect(verifieJournal(JOURNAL_LIVRE)).toEqual([])
  })

  it('se lit tel quel : un journal relu est le même journal', () => {
    expect(litJournal(JSON.parse(JSON.stringify(JOURNAL_LIVRE)))).toEqual(JOURNAL_LIVRE)
  })

  it('produit les fiches du codex, groupe recit puis fins, sans combinaison', () => {
    const f = fichesJournal(JOURNAL_LIVRE)
    expect(f.length).toBe(11)
    expect(f.slice(0, 10).every((d) => d.groupe === 'recit')).toBe(true)
    expect(f[10]).toMatchObject({ id: 'fin-miroir', groupe: 'fins' })
    expect(f.every((d) => d.mat === undefined)).toBe(true)
  })
})

describe('les questions du jeu', () => {
  it('le prochain fragment est le premier non-vu ; un id inconnu ne casse pas l’ordre', () => {
    expect(prochainFragment(JOURNAL_LIVRE, [])).toBe('recit-livraison')
    expect(prochainFragment(JOURNAL_LIVRE, ['recit-livraison', 'fantome', 'fin-jouee'])).toBe('recit-cahier-charges')
    expect(prochainFragment(JOURNAL_LIVRE, JOURNAL_LIVRE.recit.map((e) => e.id))).toBeNull()
  })

  it('les fins suivent leur propre file, indifférente au récit', () => {
    expect(prochaineFin(JOURNAL_LIVRE, ['recit-livraison'])).toBe('fin-miroir')
    expect(prochaineFin(JOURNAL_LIVRE, ['fin-miroir'])).toBeNull()
  })

  it('révélation et dénouement se comptent en entrées servies, jamais en position', () => {
    const vues = ['recit-le-choix', 'recit-alerte'] // deux fragments, pas les premiers
    expect(fragmentsVus(JOURNAL_LIVRE, vues)).toBe(2)
    expect(revelationAtteinte(JOURNAL_LIVRE, vues)).toBe(false)
    expect(revelationAtteinte(JOURNAL_LIVRE, JOURNAL_LIVRE.recit.map((e) => e.id))).toBe(true)
    expect(finsVues(JOURNAL_LIVRE, ['fin-jouee'])).toBe(0) // le marqueur n'est pas une fin
    expect(denouementAtteint(JOURNAL_LIVRE, [])).toBe(false)
    expect(denouementAtteint(JOURNAL_LIVRE, ['fin-miroir'])).toBe(true)
    // un seuil à 0 : atteint d'emblée
    expect(revelationAtteinte(poseSeuil(JOURNAL_LIVRE, 'revelationApres', 0), [])).toBe(true)
  })
})

describe('la lecture d’un journal reçu', () => {
  it('refuse ce qui n’a pas la forme d’un journal', () => {
    expect(litJournal(null)).toBeNull()
    expect(litJournal({ recit: 'x', fins: [] })).toBeNull()
  })

  it('écarte les entrées abîmées, les doublons, le marqueur réservé, et borne les seuils', () => {
    const j = litJournal({
      recit: [
        { id: 'recit-a', titre: 'A', texte: 't', icone: '📄' },
        { id: 'recit-a', titre: 'A bis', texte: 't' }, // doublon
        { id: 'fin-b', titre: 'mal rangé', texte: 't' }, // préfixe du mauvais groupe
        { id: 'Recit-C', titre: 'majuscule', texte: 't' },
        'pas un objet',
      ],
      fins: [{ id: 'fin-jouee', titre: 'réservé', texte: 't' }, { id: 'fin-ok', titre: 'OK', texte: 't' }],
      revelationApres: 40,
      denouementApres: -3,
    })!
    expect(j.recit.map((e) => e.id)).toEqual(['recit-a'])
    expect(j.fins.map((e) => e.id)).toEqual(['fin-ok'])
    expect(j.revelationApres).toBe(1)
    expect(j.denouementApres).toBe(0)
  })

  it('un seuil absent vaut « tout » ; les textes sont bornés', () => {
    const j = litJournal({ recit: [{ id: 'recit-a', titre: 'x'.repeat(200), texte: 'y'.repeat(5000) }], fins: [] })!
    expect(j.revelationApres).toBe(1)
    expect(j.denouementApres).toBe(0)
    expect(j.recit[0].titre.length).toBe(80)
    expect(j.recit[0].texte.length).toBe(1200)
  })
})

describe('les opérations de l’atelier', () => {
  it('ajouter dérive un id du titre, unique, figé — et ne touche pas l’original', () => {
    const j = ajouteEntree(JOURNAL_LIVRE, 'fins', 'La Fin Évil !')
    expect(j.fins.length).toBe(2)
    expect(j.fins[1].id).toBe('fin-la-fin-evil')
    expect(JOURNAL_LIVRE.fins.length).toBe(1)
    const j2 = ajouteEntree(j, 'fins', 'La fin evil')
    expect(j2.fins[2].id).toBe('fin-la-fin-evil-2')
    expect(idLibreJournal(JOURNAL_LIVRE, 'fins', 'jouee')).toBe('fin-jouee-2') // le marqueur reste réservé
    expect(idLibreJournal(JOURNAL_LIVRE, 'recit', '???')).toBe('recit-entree')
  })

  it('déplacer réordonne dans le groupe, aux bornes près', () => {
    const j = deplaceEntree(JOURNAL_LIVRE, 'recit', 9, 0)
    expect(j.recit[0].id).toBe('recit-le-choix')
    expect(j.recit[1].id).toBe('recit-livraison')
    expect(deplaceEntree(JOURNAL_LIVRE, 'recit', 0, 99).recit[9].id).toBe('recit-livraison')
    expect(memeJournal(deplaceEntree(JOURNAL_LIVRE, 'recit', 42, 0), JOURNAL_LIVRE)).toBe(true)
  })

  it('supprimer rabat le seuil sur ce qui reste', () => {
    const j = supprimeEntree(JOURNAL_LIVRE, 'recit', 'recit-alerte')
    expect(j.recit.length).toBe(9)
    expect(j.revelationApres).toBe(9)
    expect(supprimeEntree(JOURNAL_LIVRE, 'fins', 'fin-miroir').denouementApres).toBe(0)
  })

  it('modifier change titre, texte ou icône, jamais l’id', () => {
    const j = modifieEntree(JOURNAL_LIVRE, 'fins', 'fin-miroir', 'titre', 'Le miroir, vraiment')
    expect(j.fins[0]).toMatchObject({ id: 'fin-miroir', titre: 'Le miroir, vraiment' })
    expect(modifieEntree(JOURNAL_LIVRE, 'fins', 'fin-absente', 'titre', 'x')).toEqual(JOURNAL_LIVRE)
  })

  it('poser un seuil le borne au nombre d’entrées', () => {
    expect(poseSeuil(JOURNAL_LIVRE, 'revelationApres', 3).revelationApres).toBe(3)
    expect(poseSeuil(JOURNAL_LIVRE, 'revelationApres', 30).revelationApres).toBe(10)
    expect(poseSeuil(JOURNAL_LIVRE, 'denouementApres', NaN).denouementApres).toBe(1)
  })

  it('vérifier nomme ce qui cloche, et distingue l’attention de l’erreur', () => {
    let j = ajouteEntree(JOURNAL_LIVRE, 'fins', 'Vide')
    expect(verifieJournal(j)).toEqual(['fin 2 : texte vide'])
    j = { ...j, fins: [...j.fins, { ...j.fins[0] }], denouementApres: 9 }
    const v = verifieJournal(j)
    expect(v.some((x) => x.includes('en double'))).toBe(true)
    expect(v.some((x) => x.includes('dénouement après 9'))).toBe(true)
    const vide = litJournal({ recit: [], fins: [] })!
    const a = verifieJournal(vide)
    expect(a.length).toBe(3)
    expect(a.every(estAttention)).toBe(true)
  })
})

describe('le journal courant', () => {
  it('le livré joue tant que rien n’est posé ; poser change les fiches du codex ; null rétablit', () => {
    expect(journalCourant()).toEqual(JOURNAL_LIVRE)
    expect(fichesCodex().length).toBe(CODEX_EXPERIENCES.length + 11)
    poseJournal(ajouteEntree(JOURNAL_LIVRE, 'fins', 'Evil'))
    expect(fichesCodex().length).toBe(CODEX_EXPERIENCES.length + 12)
    expect(fichesCodex().at(-1)!.id).toBe('fin-evil')
    poseJournal(null)
    expect(fichesCodex().length).toBe(CODEX_EXPERIENCES.length + 11)
  })
})
