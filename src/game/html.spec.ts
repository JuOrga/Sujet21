import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { htmlSafe } from './html'
import { poseRecompensesPubliees } from './recompenses'

// L'ÉCHAPPEMENT DES TEXTES DU MAGASIN PARTAGÉ — le test d'une faille.
//
// Le 07/09, six gabarits `innerHTML` interpolaient sans échappement des
// textes venus de /api/* : le nom d'un tableau (palmarès, dossier de
// mission, bibliothèque de l'éditeur), le titre et l'auteur d'une
// cinématique partagée (montage), le nom et le texte d'une carte de
// récompense publiée. Un `<img src=x onerror=…>` dans un nom de tableau
// (60 caractères suffisent) s'exécutait chez chaque visiteur qui ouvrait
// le palmarès. Ce fichier vérifie la fonction, puis relit les sources
// pour que ces six sites ne repartent pas nus.

describe('htmlSafe', () => {
  it('neutralise balises, entités et guillemets — texte ET attributs', () => {
    expect(htmlSafe('<img src=x onerror="fetch(1)">')).toBe(
      '&lt;img src=x onerror=&quot;fetch(1)&quot;&gt;',
    )
    expect(htmlSafe('a & b')).toBe('a &amp; b')
    expect(htmlSafe('rien à faire')).toBe('rien à faire')
  })
  it('un nom de tableau piégé ne contient plus aucun chevron', () => {
    const piege = '</span><img src=x onerror="alert(1)">'
    expect(htmlSafe(piege)).not.toMatch(/[<>]/)
  })
})

describe('Une carte de récompense publiée revient dans les bornes de l’atelier', () => {
  it('rogne nom, texte et icône aux largeurs des champs (28, 140, 4)', () => {
    const cartes = poseRecompensesPubliees({
      cartes: [
        {
          id: 'piege',
          nom: 'x'.repeat(200),
          desc: '<b>'.repeat(100),
          icone: '✦✦✦✦✦✦',
          effets: [{ levier: 'vies', valeur: 1 }],
        },
      ],
    })
    poseRecompensesPubliees(null) // on ne laisse pas la carte piégée aux tests suivants
    expect(cartes).toHaveLength(1)
    expect(cartes![0].nom).toHaveLength(28)
    expect(cartes![0].desc).toHaveLength(140)
    expect(cartes![0].icone).toHaveLength(4)
  })
})

// ---- LE FILET : les six sites, par lecture des sources -------------------

const RACINE = new URL('../../', import.meta.url)
const lit = (chemin: string): string => readFileSync(new URL(chemin, RACINE), 'utf-8')

/** Pour chaque fichier, les gabarits qui peignent un champ du magasin
 *  partagé : la forme ÉCHAPPÉE attendue, et la forme NUE d'avant, qu'on ne
 *  veut plus revoir. Les repères (rec-name, do-nom, ed-lib-open, option
 *  value=…) ancrent chaque interpolation à SON gabarit : ailleurs, la même
 *  expression peut légitimement rester nue (une clé, un texte de toast
 *  posé en textContent). */
const SITES: Record<string, { echappe: string; nu: string }[]> = {
  'src/main.ts': [
    // le palmarès du panneau (rec-row) : le code et le nom du tableau
    { echappe: 'class="rec-code">${htmlSafe(t.code)}</span><span class="rec-name">${htmlSafe(t.name)}</span>',
      nu: 'class="rec-code">${t.code}</span><span class="rec-name">${t.name}</span>' },
    // le dossier de mission : le nom et le code du tableau joué
    { echappe: "'LE LABORATOIRE' : htmlSafe(level.name)}</div>", nu: "'LE LABORATOIRE' : level.name}</div>" },
    { echappe: 'class="do-code">${htmlSafe(level.code)}', nu: 'class="do-code">${level.code}' },
    // les instruments embarqués (ip-row) et l'équipement du dossier
    // (do-objet) : des cartes de récompense, publiées par le magasin
    { echappe: 'class="ip-ico">${htmlSafe(d.icone)}</span><div><b>${htmlSafe(d.nom)}</b><small>${htmlSafe(d.desc)}</small>',
      nu: 'class="ip-ico">${d.icone}</span><div><b>${d.nom}</b><small>${d.desc}</small>' },
    { echappe: 'class="do-objet"><i>${htmlSafe(d.icone)}</i><div><b>${htmlSafe(d.nom)}</b><small>${htmlSafe(d.desc)}</small>',
      nu: 'class="do-objet"><i>${d.icone}</i><div><b>${d.nom}</b><small>${d.desc}</small>' },
  ],
  'src/editor/editor.ts': [
    // la bibliothèque de l'éditeur (ed-lib-row) : code, nom, auteur
    { echappe: '<b>${htmlSafe(s.level.code)}</b> ${htmlSafe(s.level.name)}', nu: '<b>${s.level.code}</b> ${s.level.name}' },
    { echappe: "${s.auteur ? htmlSafe(s.auteur) + ' · ' : ''}", nu: "${s.auteur ? s.auteur + ' · ' : ''}" },
  ],
  'src/game/montage.ts': [
    // les menus de cinématiques : titre, code, auteur d'une partagée
    { echappe: '<option value="poste:${htmlSafe(c.code)}">${htmlSafe(c.titre)}', nu: '<option value="poste:${c.code}">${c.titre}' },
    { echappe: "' — ' + htmlSafe(s.auteur)", nu: "' — ' + s.auteur" },
    { echappe: "' selected' : ''}>${htmlSafe(c.titre)} [${htmlSafe(c.code)}]", nu: "' selected' : ''}>${c.titre} [${c.code}]" },
  ],
}

describe('Le filet : aucun texte du magasin partagé ne repart nu dans un gabarit', () => {
  for (const [fichier, sites] of Object.entries(SITES)) {
    it(`${fichier} échappe ses ${sites.length} gabarits`, () => {
      const src = lit(fichier)
      expect(src, `${fichier} n’importe pas htmlSafe`).toMatch(/import \{ htmlSafe \} from '[./]+(game\/)?html'/)
      for (const { echappe, nu } of sites) {
        expect(src.includes(nu), `${fichier} : gabarit nu « ${nu} »`).toBe(false)
        expect(src.includes(echappe), `${fichier} : gabarit attendu introuvable « ${echappe} »`).toBe(true)
      }
    })
  }
})
