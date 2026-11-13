import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { caseIcone, iconeMetaHTML, ICONES_COLONNES } from './metaAssets'

// LA GARDE DES ICÔNES PARTOUT. Les icônes rendues dans Blender remplacent les
// émojis d'instruments dans TOUT le jeu, et le condensat, la mémoire et la vie
// quittent la planche générée `meta-icones` pour celle de la cérémonie : une
// monnaie, un seul dessin. Vitest tourne sans navigateur : la garde lit les
// sources en TEXTE et tombe sur toute icône d'instrument encore interpolée
// telle quelle — un émoji qui se dessine autrement sous Windows, macOS et
// Steam Deck.

const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Les fichiers lus : tout `src/**\/*.ts` sauf les tests, la donnée
 *  (`instruments.ts` garde ses émojis : c'est le repli et ce que l'éditeur
 *  montre) et le contrat des planches (`iconesStation.ts`, qui rend l'émoji
 *  d'une carte perso) — plus la feuille et le gabarit, `index.html`. */
function sources(): string[] {
  const out: string[] = []
  const parcours = (dossier: string): void => {
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      const p = join(dossier, e.name)
      if (e.isDirectory()) parcours(p)
      else if (
        e.name.endsWith('.ts') &&
        !e.name.endsWith('.spec.ts') &&
        e.name !== 'instruments.ts' &&
        e.name !== 'iconesStation.ts'
      )
        out.push(relative(RACINE, p))
    }
  }
  parcours(join(RACINE, 'src'))
  return [...out.sort(), 'index.html']
}

const lire = (f: string): string => readFileSync(join(RACINE, f), 'utf-8')

/** Les formes d'une icône d'instrument posée en émoji : interpolée dans du
 *  HTML ou du texte, peinte au canvas, ou mise bout à bout dans un compte. */
const MOTIFS = [
  /\$\{[^}]*\.icone\b[^}]*\}/g,
  /fillText\([^)]*\.icone/g,
  /\.icone\b[^;\n]*\)\.join\(/g,
]

/** Une interpolation qui passe déjà par une planche rendue n'est pas un reste. */
const DEJA_RENDUE = /icone(Ceremonie|Instrument)HTML\(/

/** Les `.icone` qui NE SONT PAS des instruments, et que rien ne remplace : la
 *  conception ne donne de dessin rendu qu'aux instruments, aux contreparties
 *  et aux marques de la cérémonie. Une ligne est excusée si elle contient
 *  l'extrait, dans ce fichier — un extrait assez long pour ne pas couvrir un
 *  instrument qui viendrait s'asseoir à côté. */
const AUTRES_GLYPHES: { fichier: string; extrait: string; pourquoi: string }[] = [
  // ---- les champs de saisie : la DONNÉE, telle que le concepteur la tape
  { fichier: 'src/editor/atelierJournal.ts', extrait: 'data-champ="icone" value="${esc(e.icone)}"', pourquoi: 'champ de saisie du glyphe d’une entrée du journal' },
  { fichier: 'src/editor/regieAvaries.ts', extrait: 'data-champ="icone" value="${esc(f.icone)}"', pourquoi: 'champ de saisie du picto d’une station' },
  // ---- l'éditeur : des <option> (texte seul) et le plan, hors instruments
  { fichier: 'src/editor/editor.ts', extrait: '${a.icone} ${a.nom} — ${a.prix}', pourquoi: 'article de l’Économat dans une <option>' },
  { fichier: 'src/editor/editor.ts', extrait: '${r.icone} ${r.nom} — ${r.prix} mém.', pourquoi: 'réparation dans une <option>' },
  { fichier: 'src/editor/editor.ts', extrait: '${f.icone} ${f.nom}</option>', pourquoi: 'écran de pupitre dans une <option>' },
  { fichier: 'src/editor/editor.ts', extrait: 'g.fillText(fiche?.icone ?? \'?\', cx, cy - t * 0.15)', pourquoi: 'article d’un plot, au plan de l’éditeur' },
  { fichier: 'src/editor/editor.ts', extrait: 'g.fillText(fiche.icone, cx, cy + t * 0.35)', pourquoi: 'station d’avarie, au plan de l’éditeur' },
  { fichier: 'src/editor/editor.ts', extrait: 'g.fillText(fiche?.icone ?? \'?\', cx, (a.sy + b.sy) / 2 + 4)', pourquoi: 'écran de pupitre, au plan de l’éditeur' },
  // ---- la régie : ses sections
  { fichier: 'src/editor/regie.ts', extrait: '<i>${s.icone}</i><span>${esc(s.nom)}', pourquoi: 'section de la régie' },
  { fichier: 'src/editor/regie.ts', extrait: '<h3><i>${s.icone}</i> ${esc(s.nom)}', pourquoi: 'section de la régie' },
  // ---- les avaries : secteurs et stations du vaisseau
  { fichier: 'src/game/ecranAvaries.ts', extrait: '</svg><i>${sec.icone}</i></span>', pourquoi: 'secteur du vaisseau' },
  { fichier: 'src/game/ecranAvaries.ts', extrait: '<span class="av-station-tete"><i>${st.icone}</i>', pourquoi: 'station du vaisseau' },
  { fichier: 'src/game/ecranAvaries.ts', extrait: 'av-apercu--absente" style="--t:${sec.teinte}"><i>${sec.icone}</i>', pourquoi: 'secteur du vaisseau' },
  { fichier: 'src/game/ecranAvaries.ts', extrait: 'decoding="async"><i>${st.icone}</i>', pourquoi: 'station du vaisseau' },
  // ---- le codex : rayons, fiches et jalons du journal
  { fichier: 'src/game/ecranCodex.ts', extrait: '</svg><i>${r.icone}</i></span>', pourquoi: 'rayon du codex' },
  { fichier: 'src/game/ecranCodex.ts', extrait: '<span class="cx-medaille"><i>${ok ? d.icone : \'?\'}</i>', pourquoi: 'jalon du journal' },
  { fichier: 'src/game/ecranCodex.ts', extrait: '<span class="cx-hex"><i>${ok ? d.icone : \'?\'}</i>', pourquoi: 'fiche du codex' },
  { fichier: 'src/game/ecranCodex.ts', extrait: '<span class="cx-hex cx-hex--grand"><i>${r.icone}</i>', pourquoi: 'rayon du codex' },
  { fichier: 'src/game/ecranCodex.ts', extrait: '<span class="cx-hex cx-hex--grand"><i>${d.icone}</i></span><em>', pourquoi: 'fiche du codex' },
  { fichier: 'src/game/ecranCodex.ts', extrait: '<i>${ok ? x.icone : \'?\'}</i><span>', pourquoi: 'fiche citée du codex' },
  // ---- le marchand : rayons et articles (orbes, améliorations, provisions)
  { fichier: 'src/game/ecranMarchand.ts', extrait: '<span class="mr-rayon-ico"><i>${r.icone}</i>', pourquoi: 'rayon du marchand' },
  { fichier: 'src/game/ecranMarchand.ts', extrait: 'mr-apercu" style="--t:${r.teinte}"><i>${r.icone}</i></span>', pourquoi: 'rayon du marchand' },
  { fichier: 'src/game/marchandVue.ts', extrait: "iconeMonnaieHTML(a.id)) || `<i>${a.icone}</i>`", pourquoi: 'orbe ou amélioration : pas de dessin rendu' },
  // ---- l'éditeur des récompenses : un refus qui cite un NOM, pas une icône
  { fichier: 'src/game/recompenses.ts', extrait: 'autres.find((c) => c.icone === icone)?.nom', pourquoi: 'refus de l’atelier, qui nomme la carte' },
  // ---- main.ts : trophées, fiches, fioles — et la cérémonie, déjà rendue
  { fichier: 'src/main.ts', extrait: 'iconeMetaHTML(t.article, t.icone) : `<i>${t.icone}</i>`', pourquoi: 'toast d’un trophée, d’une fiche ou d’une fiole' },
  { fichier: 'src/main.ts', extrait: '<div class="tro-carte${ok ? \'\' : \' verrou\'}"><i>${t.icone}</i>', pourquoi: 'trophée' },
  { fichier: 'src/main.ts', extrait: '<div class="cdx-carte" data-fiole="${f.id}"', pourquoi: 'fiole du dossier' },
  { fichier: 'src/main.ts', extrait: 'mb-cartouche-${iconeDuGlyphe(o.icone) ?? \'offre\'}', pourquoi: 'nom de classe tiré du glyphe (cérémonie, déjà rendue)' },
  {
    fichier: 'src/main.ts',
    extrait: 'lignes.push(`${pris.icone} ${e.bon ?',
    pourquoi: 'jeton de la halte (appliqueEffets) : mbTranche le relit et rend iconeInstrumentHTML',
  },
]

interface Reste {
  fichier: string
  ligne: number
  texte: string
}

function restes(): { restes: Reste[]; excusesVues: Set<number> } {
  const out: Reste[] = []
  const excusesVues = new Set<number>()
  for (const f of sources()) {
    const t = lire(f)
    const lignes = t.split('\n')
    for (const motif of MOTIFS) {
      for (const m of t.matchAll(motif)) {
        if (DEJA_RENDUE.test(m[0])) continue
        const n = t.slice(0, m.index).split('\n').length
        const ligne = lignes[n - 1]
        const excuse = AUTRES_GLYPHES.findIndex((a) => a.fichier === f && ligne.includes(a.extrait))
        if (excuse >= 0) {
          excusesVues.add(excuse)
          continue
        }
        out.push({ fichier: f, ligne: n, texte: m[0].replace(/\s+/g, ' ').slice(0, 120) })
      }
    }
  }
  return { restes: out, excusesVues }
}

describe('les icônes d’instruments, partout rendues', () => {
  const { restes: r, excusesVues } = restes()

  it('aucune icône d’instrument n’est plus interpolée en émoji, ni peinte en texte au canvas', () => {
    const liste = r.map((x) => `  ${x.fichier}:${x.ligne}  ${x.texte}`).join('\n')
    expect(r, `des icônes d’instrument restent en émoji :\n${liste}`).toEqual([])
  })

  it('chaque excuse sert encore — une excuse orpheline couvrirait n’importe quoi plus tard', () => {
    const orphelines = AUTRES_GLYPHES.filter((_, i) => !excusesVues.has(i)).map((a) => `  ${a.fichier} : ${a.extrait}`)
    expect(orphelines, `excuses qui ne servent plus :\n${orphelines.join('\n')}`).toEqual([])
  })
})

describe('condensat, mémoire, vie : une monnaie, un seul dessin', () => {
  // `secours` est l'article qui DONNE une vie (l'échantillon de secours) :
  // c'est la même marque, elle prend le même dessin
  const MONNAIES = ['condensat', 'memoire', 'vie', 'secours'] as const

  it('la planche générée ne leur donne plus de case — rien ne peut plus la lire pour elles', () => {
    for (const id of MONNAIES) expect(caseIcone(id), id).toBeNull()
  })

  it('iconeMetaHTML les rend par la planche de la cérémonie', () => {
    for (const id of MONNAIES) {
      const h = iconeMetaHTML(id, '?')
      expect(h, id).toContain('ico-ceremonie')
      expect(h, id).not.toContain('ico-meta')
    }
  })

  it('aucun appel n’écrit encore iconeMetaHTML(« condensat » | « mémoire » | « vie »)', () => {
    const appels: string[] = []
    for (const f of sources()) {
      lire(f)
        .split('\n')
        .forEach((l, i) => {
          if (/iconeMetaHTML\(\s*['"](condensat|memoire|vie|secours)['"]/.test(l)) appels.push(`  ${f}:${i + 1}  ${l.trim()}`)
        })
    }
    expect(appels, `appels à rerouter vers iconeCeremonieHTML :\n${appels.join('\n')}`).toEqual([])
  })

  it('aucune pastille ico-meta n’est plus posée à la main sur leurs anciennes cases', () => {
    // les cases 3 (secours), 5 (mémoire), 6 (condensat), 7 (vie) de la
    // planche 4 × 2, telles que le gabarit les écrivait en dur
    const anciennes = new Set([3, 5, 6, 7])
    const poses: string[] = []
    for (const f of sources()) {
      lire(f)
        .split('\n')
        .forEach((l, i) => {
          for (const m of l.matchAll(/class="ico-meta" style="--ic-x:(\d+);--ic-y:(\d+)"/g)) {
            if (anciennes.has(Number(m[1]) + Number(m[2]) * ICONES_COLONNES)) poses.push(`  ${f}:${i + 1}  ${m[0]}`)
          }
        })
    }
    expect(poses, `pastilles à reprendre :\n${poses.join('\n')}`).toEqual([])
  })
})
