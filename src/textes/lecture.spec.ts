import { beforeEach, describe, expect, it } from 'vitest'
import {
  LANGUES,
  LANGUE_SOURCE,
  applique,
  poseTexte,
  videLangue,
} from './atelier'
import { catalogueTextes, cleTexte, enCle } from './catalogue'
import { codexLu, langueLue, poseLangueLue, texteDe } from './lecture'
import { CODEX_EXPERIENCES } from '../game/codex'

// LA BASCULE : LE JEU LIT LE CATALOGUE.
// Tant que le jeu affichait les chaînes du code, l'atelier des textes ne
// servait qu'à préparer un export. Ces tests vérifient les deux promesses
// de la bascule : une retouche PARAÎT en jeu, et une traduction manquante
// ne laisse JAMAIS un blanc au joueur.

const CAT = catalogueTextes()
const UNE = CODEX_EXPERIENCES[0]
const CLE_TITRE = cleTexte('codex', UNE.id, 'titre')

describe('Le jeu lit le catalogue', () => {
  beforeEach(() => {
    for (const l of LANGUES) videLangue(l.code)
    poseLangueLue(LANGUE_SOURCE)
  })

  it('sans retouche, rend exactement ce que dit le code', () => {
    expect(codexLu(UNE).titre).toBe(UNE.titre)
    expect(codexLu(UNE).texte).toBe(UNE.texte.trim())
    expect(texteDe('une.cle.inconnue', 'de secours')).toBe('de secours')
  })

  it('une retouche française PARAÎT en jeu — c’est tout l’objet', () => {
    poseTexte('fr', CLE_TITRE, 'Le liquide boude la paroi', UNE.titre)
    expect(codexLu(UNE).titre).toBe('Le liquide boude la paroi')
    // et le code, lui, n'a pas bougé : la source reste la source
    expect(UNE.titre).not.toBe('Le liquide boude la paroi')
  })

  it('en anglais, la traduction l’emporte', () => {
    poseTexte('en', CLE_TITRE, 'The liquid hugs the wall', UNE.titre)
    poseLangueLue('en')
    expect(codexLu(UNE).titre).toBe('The liquid hugs the wall')
  })

  it('en anglais, un texte non traduit retombe sur le français — jamais sur du VIDE', () => {
    poseLangueLue('en')
    expect(codexLu(UNE).titre).toBe(UNE.titre)
    expect(codexLu(UNE).texte.length).toBeGreaterThan(0)
    // aucune fiche du codex ne peut sortir blanche, même à 0 % traduit
    for (const d of CODEX_EXPERIENCES) {
      expect(codexLu(d).titre.trim().length, d.id).toBeGreaterThan(0)
      expect(codexLu(d).texte.trim().length, d.id).toBeGreaterThan(0)
    }
  })

  it('le repli passe par la RETOUCHE française, pas par la version d’avant', () => {
    // sinon un joueur anglais lirait un texte que le concepteur a désavoué
    poseTexte('fr', CLE_TITRE, 'La version réécrite', UNE.titre)
    poseLangueLue('en')
    expect(codexLu(UNE).titre).toBe('La version réécrite')
  })

  it('l’écran montre le trou, le jeu le bouche : les deux règles coexistent', () => {
    poseLangueLue('en')
    const vu = applique(CAT, 'en').find((e) => e.cle === CLE_TITRE)!
    expect(vu.texte).toBe('') // l'atelier : il reste du travail
    expect(vu.etat).toBe('a-traduire')
    expect(codexLu(UNE).titre).toBe(UNE.titre) // le jeu : rien de blanc
  })

  it('la langue lue se pose et se relit', () => {
    expect(langueLue()).toBe(LANGUE_SOURCE)
    poseLangueLue('en')
    expect(langueLue()).toBe('en')
  })

  // ---- ANTI-DÉRIVE : une seule clé, des deux côtés --------------------

  it('la clé du CATALOGUE est celle que le JEU lit, pour chaque fiche', () => {
    // le piège que ce test ferme : deux fabrications de clé qui divergent.
    // La retouche se rangerait sous un nom que le jeu n'irait pas chercher,
    // et l'écran des textes montrerait « RETOUCHÉ » sans que rien ne change.
    for (const d of CODEX_EXPERIENCES) {
      for (const [champ, defaut] of [
        ['titre', d.titre],
        ['texte', d.texte.trim()],
      ] as const) {
        const cle = `codex.${enCle(d.id)}.${champ}`
        // le catalogue connaît cette clé…
        expect(CAT.some((e) => e.cle === cle), cle).toBe(true)
        // …et une retouche posée dessus ressort par le lecteur du jeu
        poseTexte('fr', cle, `retouche ${cle}`, defaut)
        expect(codexLu(d)[champ], cle).toBe(`retouche ${cle}`)
      }
    }
  })

  it('cleTexte met les identifiants au même régime que le catalogue', () => {
    expect(cleTexte('codex', 'eau-mur', 'titre')).toBe('codex.eau-mur.titre')
    expect(cleTexte('cinematique', 'ESSAI', 'planche', '1')).toBe(
      'cinematique.essai.planche.1',
    )
    expect(cleTexte('levier', 'seuilDispersion', 'nom')).toBe(
      'levier.seuil-dispersion.nom',
    )
  })
})
