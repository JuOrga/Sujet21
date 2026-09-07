// RESTAURATION d'une sauvegarde (ops/sauvegarde.mjs) vers /api/*.
//
// CE QU'ELLE FAIT, ET CE QU'ELLE NE FAIT PAS. Elle REPOSE ce qui a été
// sauvegardé, par clé : un tableau par son `id`, un préset par son
// `title`. Puis elle remet l'ORDRE des tableaux — la séquence de
// l'expédition, qui est la moitié de ce qu'on perd quand la bibliothèque
// est écrasée.
//
// Elle n'appelle JAMAIS DELETE. Une entrée présente sur le serveur mais
// absente de la sauvegarde est laissée en place, et le réordonnancement de
// l'API la garde (« ce que l'appelant n'a pas cité reste, à la fin »).
// Autrement dit : restaurer ne peut que rendre, jamais retirer. Si l'on
// veut vraiment supprimer quelque chose, c'est un geste manuel et
// délibéré, pas un effet de bord de ce script.
//
// À BLANC PAR DÉFAUT. Sans CONFIRME=oui, rien n'est envoyé : le script
// affiche ce qu'il ferait, et s'arrête. C'est volontaire — un script qui
// écrit sur la bibliothèque partagée dès qu'on le lance par curiosité
// n'aurait pas sa place dans un dépôt.
//
// PORTÉE. Les familles dont l'écriture est un REMPLACEMENT PAR CLÉ, donc
// rejouable sans risque : les tableaux (par id) et les présets (par
// titre) depuis l'origine ; et, depuis le 07/09, ce qui se publie depuis
// la régie — le journal (un seul document), les cinq domaines de
// /api/reglages (un document par domaine : plan de la descente, carte,
// récompenses, textes, séquences) et les réglages du codex (par id de
// fiche : mémoire et rareté ; la vidéo reste celle que le serveur a, on
// ne peut pas renvoyer des octets qu'on n'a pas). Un domaine sauvegardé
// « rien de publié » est SAUTÉ : le livré joue, on ne publie pas du vide.
// Les règles, fiches et cinématiques se sauvegardent aussi (elles sont
// dans le dossier) mais se rendent à la main, depuis le jeu — écrire ici
// une restauration que personne n'a essayée serait un piège.
//
// CE QUI NE REVIENT PAS À L'IDENTIQUE : `majAt` prend la date de la
// restauration (le serveur l'écrit lui-même). L'auteur, le code et sa
// provenance sont préservés — l'API ne redate la codification que si le
// code CHANGE, et il ne change pas.
//
// USAGE
//   node ops/restaure.mjs sauvegardes            # à blanc
//   CONFIRME=oui node ops/restaure.mjs sauvegardes
//   API=https://…/api CONFIRME=oui node ops/restaure.mjs sauvegardes

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = (process.env.API ?? 'https://sujet21.vercel.app/api').replace(/\/$/, '')
const DOSSIER = process.argv[2] ?? 'sauvegardes'
const POUR_DE_BON = process.env.CONFIRME === 'oui'

function lit(fichier) {
  try {
    return JSON.parse(readFileSync(join(DOSSIER, fichier), 'utf8'))
  } catch (e) {
    throw new Error(`${join(DOSSIER, fichier)} illisible — ${e.message}`)
  }
}

async function poste(route, corps, quoi) {
  if (!POUR_DE_BON) {
    console.log(`    [à blanc] POST /${route} — ${quoi}`)
    return
  }
  const r = await fetch(`${BASE}/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corps),
  })
  const texte = await r.text()
  if (!r.ok) throw new Error(`POST /${route} (${quoi}) → HTTP ${r.status} — ${texte.slice(0, 200)}`)
  console.log(`    ✓ ${quoi}`)
}

console.log(`restauration vers ${BASE} depuis ${DOSSIER}/`)
if (!POUR_DE_BON) {
  console.log('MODE À BLANC — rien ne sera envoyé. Relancer avec CONFIRME=oui pour écrire.\n')
} else {
  console.log('ÉCRITURE RÉELLE.\n')
}

// ---- LES TABLEAUX, puis LA CARTE ----------------------------------------
// L'ordre vient en second et à part : il faut que toutes les entrées
// existent avant de pouvoir les enchaîner.
const levels = lit('levels.json').levels
if (!Array.isArray(levels)) throw new Error('levels.json : pas de tableau `levels`')
console.log(`  tableaux — ${levels.length} entrée(s)`)
for (const e of levels) {
  if (!e?.id || !e?.level) throw new Error(`entrée de tableau incomplète : ${JSON.stringify(e).slice(0, 120)}`)
  await poste('levels', { id: e.id, level: e.level, auteur: e.auteur ?? '' }, `${e.level.code ?? '?'} (${e.id})`)
}

console.log(`  carte — la séquence de l’expédition`)
const ordre = levels.map((e) => e.id)
await poste('levels', { order: ordre }, ordre.join(' → ') || '(vide)')

// ---- LES PRÉSETS, puis LE DÉFAUT ----------------------------------------
// Même raison : le défaut ne s'accepte que s'il désigne un préset déjà
// présent (l'API renvoie 400 sinon).
const presets = lit('presets.json')
if (!Array.isArray(presets.presets)) throw new Error('presets.json : pas de tableau `presets`')
console.log(`  présets — ${presets.presets.length} entrée(s)`)
for (const p of presets.presets) {
  await poste('presets', { title: p.title, description: p.description ?? '', params: p.params }, p.title)
}
if (presets.defaultTitle) {
  await poste('presets', { defaultTitle: presets.defaultTitle }, `défaut : ${presets.defaultTitle}`)
}

// ---- LE JOURNAL, LES RÉGLAGES, LE CODEX -------------------------------
// Chacun est facultatif dans le dossier : une sauvegarde d'avant le 07/09
// ne les a pas, et ce n'est pas une raison de ne pas rendre le reste.
function litSiPresent(fichier) {
  try {
    return lit(fichier)
  } catch {
    console.log(`  ${fichier} absent du dossier — famille sautée`)
    return null
  }
}

const journal = litSiPresent('journal.json')
if (journal) {
  if (journal.journal === null) console.log('  récit et fins — rien de publié dans la sauvegarde, le livré joue : sauté')
  else await poste('journal', { journal: journal.journal, auteur: journal.auteur ?? '' }, `récit et fins (${journal.auteur || '?'})`)
}

for (const domaine of ['plan-voie', 'carte', 'recompenses', 'textes', 'sequences']) {
  const r = litSiPresent(`reglages-${domaine}.json`)
  if (!r) continue
  if (r.document === null) {
    console.log(`  réglages · ${domaine} — rien de publié dans la sauvegarde : sauté`)
    continue
  }
  await poste('reglages', { domaine, document: r.document, auteur: r.auteur ?? '' }, `réglages · ${domaine} (${r.auteur || '?'})`)
}

const codex = litSiPresent('codex.json')
if (codex?.fiches && typeof codex.fiches === 'object') {
  const ids = Object.keys(codex.fiches)
  console.log(`  réglages du codex — ${ids.length} fiche(s) (mémoire et rareté ; la vidéo reste celle du serveur)`)
  for (const id of ids) {
    const f = codex.fiches[id]
    await poste('codex', { id, memoire: f.memoire, rarete: f.rarete, auteur: f.auteur ?? '' }, id)
  }
}

console.log(
  POUR_DE_BON
    ? '\nRestauration terminée. Rien n’a été supprimé.'
    : '\nRien n’a été envoyé (mode à blanc).',
)
