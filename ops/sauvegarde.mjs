// SAUVEGARDE des documents partagés (Vercel Blob, via /api/*).
//
// POURQUOI. Tout ce que les concepteurs écrivent depuis le jeu — les
// tableaux ET LEUR ORDRE (la séquence de l'expédition), les présets de
// réglage, le cahier des règles, les fiches réécrites, les cinématiques —
// vit dans UN document JSON par famille, en régime « dernier écrivain
// gagnant », derrière un endpoint sans authentification. Le magasin garde
// bien un historique de 4 versions (api/_magasin.ts), mais c'est un filet
// d'écriture, pas une sauvegarde : quatre enregistrements suffisent à le
// faire défiler entièrement. Ici, chaque exécution ajoute un COMMIT — donc
// l'historique complet, aussi loin qu'on remonte.
//
// GARANTIE. Ce script ne fait que des GET. Il ne peut rien écrire, rien
// effacer, rien réordonner sur le serveur. Le rendre est le travail de
// ops/restaure.mjs, qui est séparé, manuel, et n'efface jamais non plus.
//
// UN ÉCHEC N'EST JAMAIS UN DOCUMENT VIDE. C'est la règle du magasin, et
// c'est encore plus vrai ici : écrire « {} » par-dessus une bonne
// sauvegarde parce que l'API répondait 500, ce serait perdre la sauvegarde
// en croyant en faire une. Toute famille illisible fait ÉCHOUER le script
// sans rien écrire du tout.
//
// USAGE
//   node ops/sauvegarde.mjs [dossier]        (défaut : sauvegardes/)
//   API=https://…/api node ops/sauvegarde.mjs
//
// L'environnement d'analyse ne joint pas le site (la politique réseau du
// bac à sable refuse sujet21.vercel.app) ; GitHub Actions si — d'où le
// workflow .github/workflows/sauvegarde.yml, qui l'exécute et commite le
// résultat sur la branche `sauvegardes`.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = (process.env.API ?? 'https://sujet21.vercel.app/api').replace(/\/$/, '')
const DOSSIER = process.argv[2] ?? 'sauvegardes'

/** Les familles sauvegardées. `resume` sert au manifeste ET de contrôle de
 *  vraisemblance : une famille qui ne ressemble pas à sa forme attendue est
 *  traitée comme illisible. */
const FAMILLES = [
  {
    nom: 'tableaux',
    route: 'levels',
    fichier: 'levels.json',
    // L'ORDRE du tableau EST la séquence de l'expédition : le JSON le
    // conserve, et c'est la moitié de ce qu'on sauvegarde ici.
    resume: (d) => {
      if (!Array.isArray(d?.levels)) return null
      const codes = d.levels.map((l) => l?.level?.code ?? '?')
      return { compte: d.levels.length, detail: `séquence : ${codes.join(' → ') || '(vide)'}` }
    },
  },
  {
    nom: 'présets',
    route: 'presets',
    fichier: 'presets.json',
    resume: (d) => {
      if (!Array.isArray(d?.presets)) return null
      const titres = d.presets.map((p) => p?.title ?? '?')
      return {
        compte: d.presets.length,
        detail: `défaut : ${d.defaultTitle ?? '(aucun)'} · ${titres.join(', ') || '(vide)'}`,
      }
    },
  },
  {
    nom: 'cahier des règles',
    route: 'regles',
    fichier: 'regles.json',
    resume: (d) => {
      if (!Array.isArray(d?.notes) || !Array.isArray(d?.ajouts)) return null
      return {
        compte: d.notes.length + d.ajouts.length,
        detail: `${d.notes.length} note(s), ${d.ajouts.length} ajout(s)`,
      }
    },
  },
  {
    nom: 'fiches réécrites',
    route: 'fiches',
    fichier: 'fiches.json',
    resume: (d) => {
      if (!Array.isArray(d?.surcharges)) return null
      return { compte: d.surcharges.length, detail: `${d.surcharges.length} fiche(s) réécrite(s)` }
    },
  },
  {
    nom: 'cinématiques',
    route: 'cinematiques',
    fichier: 'cinematiques.json',
    resume: (d) => {
      if (!Array.isArray(d?.cines)) return null
      const codes = d.cines.map((c) => c?.code ?? '?')
      return { compte: d.cines.length, detail: codes.join(', ') || '(vide)' }
    },
  },
  {
    nom: 'catalogue d’images',
    route: 'images',
    fichier: 'images.json',
    // ATTENTION : le catalogue garde les URL des blobs, PAS les pixels.
    // Un blob supprimé côté Vercel laisse ici une URL morte. Le manifeste
    // le redit, pour qu'on ne croie pas les images sauvées.
    resume: (d) => {
      if (!Array.isArray(d?.images)) return null
      return { compte: d.images.length, detail: `${d.images.length} entrée(s) — URL seulement, pas les pixels` }
    },
  },
  {
    nom: 'registres',
    route: 'records',
    fichier: 'records.json',
    resume: (d) => {
      if (d === null || typeof d !== 'object') return null
      const t = Object.keys(d.tableaux ?? {}).length
      const tops = Object.keys(d.tops ?? {}).length
      return { compte: t + tops, detail: `${t} tableau(x), ${tops} top(s), expédition : ${d.expedition ? 'oui' : 'non'}` }
    },
  },
]

/** Un GET qui n'accepte ni l'erreur HTTP, ni le corps d'erreur de l'API,
 *  ni une forme inattendue. Trois essais : une lambda Vercel froide peut
 *  répondre 500 une fois et servir correctement la suivante. */
async function litFamille(f) {
  let derniere
  for (let essai = 1; essai <= 3; essai++) {
    try {
      const r = await fetch(`${BASE}/${f.route}`, { cache: 'no-store' })
      const texte = await r.text()
      if (!r.ok) throw new Error(`HTTP ${r.status} — ${texte.slice(0, 200)}`)
      let doc
      try {
        doc = JSON.parse(texte)
      } catch {
        throw new Error(`réponse illisible (${texte.slice(0, 120)}…)`)
      }
      if (doc && typeof doc === 'object' && 'error' in doc) {
        throw new Error(`l’API refuse : ${doc.error} — ${doc.detail ?? ''}`)
      }
      const resume = f.resume(doc)
      if (!resume) throw new Error(`forme inattendue : ${JSON.stringify(doc).slice(0, 160)}…`)
      return { doc, resume }
    } catch (e) {
      derniere = e
      if (essai < 3) await new Promise((ok) => setTimeout(ok, essai * 2000))
    }
  }
  throw new Error(`${f.nom} (/${f.route}) — ${derniere.message}`)
}

const quand = new Date().toISOString()
console.log(`sauvegarde depuis ${BASE} — ${quand}`)

// D'ABORD tout lire, ENSUITE tout écrire : si une seule famille manque, on
// n'a pas laissé un dossier à moitié rempli derrière soi.
const lues = []
const ratees = []
for (const f of FAMILLES) {
  try {
    const { doc, resume } = await litFamille(f)
    lues.push({ f, doc, resume })
    console.log(`  ✓ ${f.nom.padEnd(20)} ${String(resume.compte).padStart(4)} — ${resume.detail}`)
  } catch (e) {
    ratees.push(e.message)
    console.error(`  ✗ ${f.nom.padEnd(20)} ${e.message}`)
  }
}

if (ratees.length > 0) {
  console.error(`\nRIEN N’A ÉTÉ ÉCRIT — ${ratees.length} famille(s) illisible(s).`)
  console.error('Une sauvegarde partielle qui écrase la précédente est pire que pas de sauvegarde.')
  process.exit(1)
}

mkdirSync(DOSSIER, { recursive: true })
for (const { f, doc } of lues) {
  writeFileSync(join(DOSSIER, f.fichier), `${JSON.stringify(doc, null, 2)}\n`, 'utf8')
}

const manifeste = [
  '# Sauvegarde des documents partagés',
  '',
  `Prise le **${quand}** depuis \`${BASE}\`.`,
  '',
  '| Famille | Fichier | Entrées | Détail |',
  '| --- | --- | ---: | --- |',
  ...lues.map(({ f, resume }) => `| ${f.nom} | \`${f.fichier}\` | ${resume.compte} | ${resume.detail} |`),
  '',
  '## Ce que cette sauvegarde contient — et ce qu’elle ne contient pas',
  '',
  '- **`levels.json` porte la carte.** L’ordre du tableau `levels` EST la',
  '  séquence de l’expédition : le restaurer remet les salles *et* leur',
  '  enchaînement.',
  '- **`images.json` ne porte pas les pixels.** Le catalogue garde les URL',
  '  des blobs. Si un blob est supprimé côté Vercel, l’URL sauvegardée est',
  '  morte — sauvegarder les binaires demanderait un autre dispositif.',
  '- **Rien de ce qui est local au joueur** (progression, réglages, run en',
  '  cours) n’est ici : cela vit dans le `localStorage` de chaque poste.',
  '',
  '## Rendre une sauvegarde',
  '',
  '```bash',
  '# 1. ce qui SERAIT écrit, sans rien écrire (défaut)',
  'node ops/restaure.mjs <dossier>',
  '',
  '# 2. écrire pour de bon',
  'CONFIRME=oui node ops/restaure.mjs <dossier>',
  '```',
  '',
  'La restauration ne fait que des ajouts et des remplacements par clé :',
  'elle ne supprime jamais une entrée présente sur le serveur.',
  '',
].join('\n')
writeFileSync(join(DOSSIER, 'MANIFESTE.md'), manifeste, 'utf8')

console.log(`\n${lues.length} famille(s) écrite(s) dans ${DOSSIER}/`)
