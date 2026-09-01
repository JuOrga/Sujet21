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
// PORTÉE. Tableaux et présets seulement : ce sont les deux familles dont
// la sémantique d'écriture est un remplacement par clé, donc rejouable
// sans risque. Les règles, fiches et cinématiques se sauvegardent aussi
// (elles sont dans le dossier) mais se rendent à la main, depuis le jeu —
// écrire ici une restauration que personne n'a essayée serait un piège.
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

console.log(
  POUR_DE_BON
    ? '\nRestauration terminée. Rien n’a été supprimé.'
    : '\nRien n’a été envoyé (mode à blanc).',
)
