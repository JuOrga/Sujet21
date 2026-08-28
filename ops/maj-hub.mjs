// MISE À JOUR DU HUB EN BIBLIOTHÈQUE — la bibliothèque partagée sert le
// tableau de code 'HUB' AVANT le code (hubLevel) : tant que l'instantané
// « le-module-meduse-compact » reste l'ancien, aucune refonte du hub
// n'atteint les joueurs. Ce script REMPLACE cette entrée (POST avec son id,
// sémantique saveLevel) par ops/hub-compact.json — généré depuis
// TABLEAU_HUB_COMPACT, gardé conforme par src/game/hubExport.spec.ts.
//
// Même gâchette que les semis : l'environnement d'analyse ne joint pas
// l'API, GitHub Actions si — un push sur maj-hub-go tire. Ré-exécutable
// sans danger : si la bibliothèque porte déjà cette géométrie, rien n'est
// réécrit.

import { readFileSync } from 'node:fs'

const API = process.env.API ?? 'https://sujet21.vercel.app/api/levels'
const v4 = JSON.parse(readFileSync(new URL('./hub-compact.json', import.meta.url), 'utf8'))

const get = await fetch(API, { cache: 'no-store' })
if (!get.ok) throw new Error(`GET ${get.status}`)
const levels = (await get.json()).levels ?? []
console.log('bibliothèque actuelle :', levels.length, 'tableaux')

// L'instantané visé : l'entrée de code HUB si elle existe (elle masque le
// code), sinon l'entrée du module compact elle-même — le concepteur peut
// l'avoir recodée (HUB2) pour rendre la main au code : on met alors le
// contenu à niveau SANS toucher à son code, pour ne pas re-masquer.
const ID = 'le-module-meduse-compact'
const entree =
  levels.find((e) => e.level?.code === 'HUB') ??
  levels.find((e) => e.id === ID) ??
  levels.find((e) => e.level?.code === 'HUB2')
if (!entree) {
  console.log('aucun instantané du hub en bibliothèque : le code fait foi, rien à faire')
  process.exit(0)
}
const cible = { ...v4, code: entree.level.code }
console.log('instantané visé :', entree.id, '| code', entree.level.code, '| bornes', JSON.stringify(entree.level.bounds), '| boxes', entree.level.boxes?.length)

if (JSON.stringify(entree.level) === JSON.stringify(cible)) {
  console.log('déjà à jour (v4) : rien à réécrire')
  process.exit(0)
}

const r = await fetch(API, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ level: cible, id: entree.id, auteur: 'Claude' }),
})
if (!r.ok) throw new Error(`POST ${entree.id} → ${r.status}`)
console.log('remplacé :', entree.id, '→ hub compact v4 (comptoir, banc, sorties gardées)')

const apres = await fetch(API, { cache: 'no-store' })
const fin = (await apres.json()).levels ?? []
const maj = fin.find((e) => e.id === entree.id)
console.log('relecture :', maj?.id, '| code', maj?.level?.code, '| bornes', JSON.stringify(maj?.level?.bounds), '| boxes', maj?.level?.boxes?.length, '| labels', maj?.level?.labels?.length)
if (maj?.level?.bounds?.maxX !== v4.bounds.maxX)
  console.log('NOTE : le cache CDN (60 s) peut servir l’ancienne version en relecture immédiate')
