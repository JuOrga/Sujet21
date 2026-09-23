// Rendre un RESCAPÉ : un tableau perdu côté serveur, retrouvé ailleurs
// (journal d'une exécution, poste d'un concepteur), gardé dans ops/rescapes/.
//
// Pourquoi pas restaure.mjs : elle repose chaque tableau PAR SON id. Or un
// rescapé a souvent perdu son id au profit d'un autre tableau — « echangette »
// porte aujourd'hui « Les 3 voies » : la reposer sous son id écraserait
// celles-ci. Ici on CRÉE (id vide) : le serveur choisit un id libre
// (« echangette-2 ») et range l'entrée en fin de bibliothèque. Aucun autre
// tableau n'est touché, l'ordre de l'expédition non plus.
//
// À blanc par défaut, comme restaure.mjs. Ré-exécutable : un code déjà
// présent dans la bibliothèque n'est jamais recréé.
//
//   node ops/rend-rescape.mjs                          # voir, rien n'est écrit
//   CONFIRME=oui node ops/rend-rescape.mjs             # écrire pour de bon
//   RESCAPE=ops/rescapes/autre.json node ops/rend-rescape.mjs

import { readFileSync } from 'node:fs'

const API = process.env.API ?? 'https://sujet21.vercel.app/api/levels'
const chemin = process.env.RESCAPE ?? 'ops/rescapes/echangette-2026-08-25.json'
const ecrire = process.env.CONFIRME === 'oui'

const rescape = JSON.parse(readFileSync(chemin, 'utf8'))
const level = rescape.level
if (!level || typeof level.code !== 'string') throw new Error(`${chemin} : pas de tableau codé`)
console.log(`rescapé : « ${level.name} » (${level.code}), ${level.boxes?.length ?? 0} pièces, auteur ${rescape.auteur}`)

const get = await fetch(API, { cache: 'no-store' })
if (!get.ok) throw new Error(`GET ${get.status}`)
const levels = (await get.json()).levels ?? []
const meme = levels.find((e) => e.level?.code === level.code)
if (meme) {
  console.log(`déjà présent sous l'id « ${meme.id} » — rien à faire`)
  process.exit(0)
}
const homonyme = levels.find((e) => e.id === rescape.id)
if (homonyme) {
  console.log(`l'id « ${rescape.id} » est occupé par « ${homonyme.level?.name} » — il ne sera PAS touché`)
}

if (!ecrire) {
  console.log('à blanc : rien n’est envoyé. CONFIRME=oui pour créer l’entrée.')
  process.exit(0)
}

const r = await fetch(API, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ level, id: '', auteur: rescape.auteur }),
})
if (!r.ok) throw new Error(`POST → ${r.status} ${await r.text()}`)
const rep = await r.json()
console.log(`rendu sous l'id « ${rep.id} », en fin de bibliothèque (${rep.levels.length} tableaux)`)
