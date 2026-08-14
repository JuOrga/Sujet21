// Semis de la bibliothèque partagée (/api/levels) : ajoute une copie
// MODIFIABLE de chaque tableau livré (ops/seed-levels.json — école,
// expédition dans l'ordre choisi, 1 bis), sans toucher aux tableaux déjà
// présents. Ordre final : le PREMIER tableau existant reste premier, les
// tableaux livrés s'insèrent ensuite, le reste des tableaux existants
// (les essais du labo) ferme la marche.
//
// Exécuté par le workflow seed-levels (gâchette : push sur seed-levels-go)
// — l'API n'est pas joignable depuis l'environnement d'analyse, GitHub
// Actions l'atteint. Ré-exécutable sans danger : un code déjà présent
// dans la bibliothèque n'est jamais resemé (la version du joueur prime).

import { readFileSync } from 'node:fs'

const API = process.env.API ?? 'https://sujet21.vercel.app/api/levels'
const seeds = JSON.parse(readFileSync(new URL('./seed-levels.json', import.meta.url), 'utf8'))

const get = await fetch(API, { cache: 'no-store' })
if (!get.ok) throw new Error(`GET ${get.status}`)
let levels = (await get.json()).levels ?? []
const existants = levels.map((e) => ({ id: e.id, code: e.level?.code }))
console.log('bibliothèque actuelle :', existants.map((e) => e.code).join(', ') || '(vide)')

const codesPresents = new Set(existants.map((e) => e.code))
const idsConnus = new Set(existants.map((e) => e.id))
const semes = [] // ids créés, dans l'ordre du semis
for (const s of seeds) {
  const code = s.level.code
  if (codesPresents.has(code)) {
    console.log('déjà présent, conservé tel quel :', code)
    // il garde sa place actuelle dans la bibliothèque (la version du joueur)
    continue
  }
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level: s.level, id: '', auteur: 'expédition livrée' }),
  })
  if (!r.ok) throw new Error(`POST ${code} → ${r.status}`)
  levels = (await r.json()).levels ?? []
  const neuf = levels.find((e) => !idsConnus.has(e.id))
  if (!neuf) throw new Error(`création introuvable pour ${code}`)
  idsConnus.add(neuf.id)
  semes.push(neuf.id)
  console.log('semé :', code, '→', neuf.id)
}

// l'ordre : premier existant, puis les semés (ordre du semis), puis le reste
const ordre = [
  ...(existants.length > 0 ? [existants[0].id] : []),
  ...semes,
  ...existants.slice(1).map((e) => e.id),
]
const ro = await fetch(API, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ order: ordre }),
})
if (!ro.ok) throw new Error(`reorder → ${ro.status}`)
const final = (await ro.json()).levels ?? []
console.log('séquence finale :', final.map((e) => e.level?.code).join(' → '))
