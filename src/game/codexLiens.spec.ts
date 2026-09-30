import { describe, expect, it } from 'vitest'
import { CODEX_EXPERIENCES, fichesCodex, type CodexDef } from './codex'
import { decoupeLiens, liensBrises, liensDe, liensEntrants, memeElement, texteNu } from './codexLiens'
import { JOURNAL_LIVRE, verifieJournal } from './journal'

const existe = (ids: string[]) => (id: string) => ids.includes(id)

describe('la syntaxe des liens', () => {
  it('découpe texte nu et liens, avec ou sans libellé', () => {
    expect(decoupeLiens('Seule [[glace-rideau|la glace]] passe, pas [[eau-mur]].', existe(['glace-rideau', 'eau-mur']))).toEqual([
      { texte: 'Seule ' },
      { lien: 'glace-rideau', libelle: 'la glace' },
      { texte: ' passe, pas ' },
      { lien: 'eau-mur', libelle: '' },
      { texte: '.' },
    ])
  })

  it('un texte sans lien reste un seul morceau, et un texte vide n’en donne aucun', () => {
    expect(decoupeLiens('Rien à lier.', () => true)).toEqual([{ texte: 'Rien à lier.' }])
    expect(decoupeLiens('', () => true)).toEqual([])
  })

  it('un lien vers une fiche inconnue redevient du texte nu — jamais de crochets', () => {
    expect(decoupeLiens('Voir [[fiche-retiree|la vieille fiche]] ou [[autre]].', () => false)).toEqual([
      { texte: 'Voir la vieille fiche ou .' },
    ])
  })

  it('tolère les espaces autour de l’id et du libellé', () => {
    expect(decoupeLiens('[[ rosee | la rosée ]]', existe(['rosee']))).toEqual([{ lien: 'rosee', libelle: 'la rosée' }])
  })

  it('liste les ids cités sans doublon, et repère ceux qui ne mènent nulle part', () => {
    const t = '[[a]] puis [[b|bé]] puis [[a|encore]] et [[zz]]'
    expect(liensDe(t)).toEqual(['a', 'b', 'zz'])
    expect(liensBrises(t, existe(['a', 'b']))).toEqual(['zz'])
  })

  it('le texte nu garde le libellé, ou le titre de la fiche visée', () => {
    expect(texteNu('Voir [[a|ceci]] et [[b]].', (id) => `titre de ${id}`)).toBe('Voir ceci et titre de b.')
  })
})

const fiche = (id: string, texte: string, extra: Partial<CodexDef> = {}): CodexDef => ({
  id,
  groupe: 'phenomenes',
  icone: '·',
  titre: id,
  texte,
  ...extra,
})

describe('les pages liées', () => {
  const fiches = [fiche('a', 'Voir [[c]].'), fiche('b', 'Voir [[c|ça]] et [[a]].'), fiche('c', 'Je me cite : [[c]].')]

  it('les fiches CONNUES qui citent celle-ci, jamais elle-même', () => {
    const tout = () => true
    expect(liensEntrants('c', fiches, (d) => d.texte, tout).map((d) => d.id)).toEqual(['a', 'b'])
    expect(liensEntrants('a', fiches, (d) => d.texte, tout).map((d) => d.id)).toEqual(['b'])
  })

  it('un texte encore secret ne se trahit pas par ses liens', () => {
    expect(liensEntrants('c', fiches, (d) => d.texte, existe(['b'])).map((d) => d.id)).toEqual(['b'])
  })

  it('lit le texte que le joueur lit (retouche du concepteur comprise)', () => {
    const retouche = (d: CodexDef) => (d.id === 'a' ? 'Plus aucun lien.' : d.texte)
    expect(liensEntrants('c', fiches, retouche, () => true).map((d) => d.id)).toEqual(['b'])
  })
})

describe('le même élément', () => {
  it('les autres états du même matériau, liquide → glace → vapeur', () => {
    const d = CODEX_EXPERIENCES.find((x) => x.id === 'vapeur-grille')!
    expect(memeElement(d, fichesCodex()).map((x) => x.id)).toEqual(['eau-grille', 'glace-grille'])
  })

  it('rien pour une fiche sans matériau', () => {
    const d = CODEX_EXPERIENCES.find((x) => x.id === 'rosee')!
    expect(memeElement(d, fichesCodex())).toEqual([])
  })
})

describe('les liens livrés', () => {
  // le filet : une fiche renommée ou retirée laisserait des liens morts,
  // lus en texte nu sans que personne ne s'en aperçoive
  it('chaque lien du codex et du journal livrés mène à une fiche existante', () => {
    const ids = new Set(fichesCodex().map((d) => d.id))
    const textes = [...CODEX_EXPERIENCES, ...JOURNAL_LIVRE.recit, ...JOURNAL_LIVRE.fins].map((d) => d.texte)
    const brises = textes.flatMap((t) => liensBrises(t, (id) => ids.has(id)))
    expect(brises).toEqual([])
    // et il y en a : le codex livré se lit déjà comme un wiki
    expect(textes.flatMap((t) => liensDe(t)).length).toBeGreaterThan(10)
  })

  it('aucune fiche ne se cite elle-même', () => {
    for (const d of CODEX_EXPERIENCES) expect(liensDe(d.texte)).not.toContain(d.id)
  })
})

describe('l’atelier du journal signale les liens morts', () => {
  it('un lien vers une fiche inconnue est une ATTENTION, pas une erreur', () => {
    const j = {
      ...JOURNAL_LIVRE,
      recit: [{ ...JOURNAL_LIVRE.recit[0], texte: 'Voir [[eau-mur|la paroi]] et [[nulle-part]].' }, ...JOURNAL_LIVRE.recit.slice(1)],
    }
    const v = verifieJournal(j, (id) => id === 'eau-mur')
    expect(v.filter((x) => x.includes('[['))).toEqual([
      'ATTENTION : fragment 1 : le lien [[nulle-part]] ne mène à aucune fiche — il se lira en texte nu',
    ])
  })

  it('un lien vers une autre entrée du journal est toujours bon', () => {
    const j = {
      ...JOURNAL_LIVRE,
      fins: [{ ...JOURNAL_LIVRE.fins[0], texte: `Tout commence à [[${JOURNAL_LIVRE.recit[0].id}]].` }],
    }
    expect(verifieJournal(j).some((x) => x.includes('[['))).toBe(false)
  })
})
