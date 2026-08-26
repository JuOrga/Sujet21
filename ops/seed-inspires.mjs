// Semis des tableaux « inspirés du crop circle » (ops/inspires-crop.json)
// dans la bibliothèque partagée (/api/levels) — SANS toucher à l'ordre de
// jeu ni aux tableaux existants : ils s'ajoutent simplement au bout.
//
// Même mécanique de gâchette que seed-levels : l'environnement d'analyse
// ne joint pas l'API, GitHub Actions si — un push sur seed-inspires-go
// tire. Ré-exécutable sans danger : un code déjà présent n'est jamais
// resemé (la version du joueur prime).

import { readFileSync } from 'node:fs'

const API = process.env.API ?? 'https://sujet21.vercel.app/api/levels'
const seeds = JSON.parse(readFileSync(new URL('./inspires-crop.json', import.meta.url), 'utf8'))

const get = await fetch(API, { cache: 'no-store' })
if (!get.ok) throw new Error(`GET ${get.status}`)
const levels = (await get.json()).levels ?? []
const codesPresents = new Set(levels.map((e) => e.level?.code))
console.log('bibliothèque actuelle :', levels.length, 'tableaux')

for (const s of seeds) {
  const code = s.level.code
  if (codesPresents.has(code)) {
    console.log('déjà présent, conservé tel quel :', code, '—', s.level.name)
    continue
  }
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level: s.level, id: '', auteur: 'Claude' }),
  })
  if (!r.ok) throw new Error(`POST ${code} → ${r.status}`)
  console.log('semé :', code, '—', s.level.name)
}

const apres = await fetch(API, { cache: 'no-store' })
const fin = (await apres.json()).levels ?? []
console.log('bibliothèque après semis :', fin.length, 'tableaux')
for (const e of fin) console.log('-', e.id, '|', e.level?.code, '|', e.level?.name)
