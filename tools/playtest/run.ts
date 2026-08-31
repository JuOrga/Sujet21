// LE BANC DE PLAYTEST — point d'entrée.
//
//   pnpm playtest                      tous les tableaux de la partie
//   pnpm playtest --audit              l'audit seul, sans simuler (instantané)
//   pnpm playtest --tableau=21-A,21-01 quelques tableaux
//   pnpm playtest --tous               y compris l'école et les hors-parcours
//   pnpm playtest --json                met à jour la référence versionnée
//   pnpm playtest --base                compare à elle, et ÉCHOUE si un
//                                       tableau a régressé
//   pnpm playtest --journal            le journal de décision (un tableau)
//
// Code de sortie : 1 si l'audit lève une ERREUR, ou si la comparaison à la
// référence trouve une régression. De quoi le brancher en intégration.

import { writeFileSync, readFileSync } from 'node:fs'
import * as catalogue from '../../src/game/level'
import type { LevelDef } from '../../src/game/level'
import { audite } from './audit'
import { horsPerimetre } from './monde'
import { REGLAGES, joue, type Essai, type LigneJournal } from './pilote'
import {
  compare,
  formate,
  meilleurEssai,
  type LigneRapport,
  type Rapport,
} from './rapport'

/** La référence versionnée : ce que le banc donnait sur une base saine.
 *  `--json` sans valeur la met à jour, `--base` sans valeur s'y compare. */
const REFERENCE = 'tools/playtest/reference.json'

function estTableau(v: unknown): v is LevelDef {
  const o = v as LevelDef
  return (
    typeof o === 'object' &&
    o !== null &&
    typeof o.code === 'string' &&
    typeof o.name === 'string' &&
    Array.isArray(o.boxes) &&
    o.spawn !== undefined &&
    o.exit !== undefined
  )
}

/** Tous les tableaux déclarés dans level.ts, dédoublonnés par code. On les
 *  ramasse par introspection du module plutôt qu'en recopiant une liste :
 *  un tableau ajouté demain est audité sans que personne y pense. */
function tousLesTableaux(): LevelDef[] {
  const vus = new Map<string, LevelDef>()
  for (const lv of catalogue.TABLEAUX) vus.set(lv.code, lv)
  for (const v of Object.values(catalogue)) {
    if (estTableau(v) && !vus.has(v.code)) vus.set(v.code, v)
    if (Array.isArray(v)) {
      for (const e of v) if (estTableau(e) && !vus.has(e.code)) vus.set(e.code, e)
    }
  }
  return [...vus.values()]
}

interface Options {
  audit: boolean
  tous: boolean
  codes: string[] | null
  essais: number
  temps: number
  json: string | null
  base: string | null
  journal: boolean
}

function lisLesOptions(argv: string[]): Options {
  const o: Options = {
    audit: false,
    tous: false,
    codes: null,
    essais: REGLAGES.length,
    temps: 120,
    json: null,
    base: null,
    journal: false,
  }
  for (const a of argv) {
    const [cle, val] = a.replace(/^--/, '').split('=')
    switch (cle) {
      case 'audit':
        o.audit = true
        break
      case 'tous':
        o.tous = true
        break
      case 'journal':
        o.journal = true
        break
      case 'tableau':
        o.codes = (val ?? '').split(',').filter(Boolean)
        break
      case 'essais':
        o.essais = Math.max(1, Number(val))
        break
      case 'temps':
        o.temps = Math.max(5, Number(val))
        break
      case 'json':
        o.json = val ?? REFERENCE
        break
      case 'base':
        o.base = val ?? REFERENCE
        break
      default:
        console.error(`option inconnue : ${a}`)
        process.exit(2)
    }
  }
  return o
}

function main(): void {
  const o = lisLesOptions(process.argv.slice(2))
  let tableaux = o.tous ? tousLesTableaux() : [...catalogue.TABLEAUX]
  if (o.codes) {
    const voulus = new Set(o.codes.map((c) => c.toUpperCase()))
    tableaux = tousLesTableaux().filter((lv) => voulus.has(lv.code.toUpperCase()))
    const trouves = new Set(tableaux.map((lv) => lv.code.toUpperCase()))
    for (const c of voulus) {
      if (!trouves.has(c)) console.error(`tableau inconnu : ${c}`)
    }
  }
  if (tableaux.length === 0) {
    console.error('aucun tableau à jouer')
    process.exit(2)
  }

  const lignes: LigneRapport[] = []
  for (const lv of tableaux) {
    const audit = audite(lv)
    const hors = horsPerimetre(lv)
    const essais: Essai[] = []
    // On ne fait jouer le pilote que si le sas est atteignable À L'EAU : le
    // faire s'acharner sur un tableau qui demande la vapeur ne renseigne sur
    // rien et coûte une minute de simulation par réglage.
    if (!o.audit && !hors && audit.accessible) {
      for (const r of REGLAGES.slice(0, o.essais)) {
        const journal: LigneJournal[] = []
        const e = joue(lv, r, {
          tempsMax: o.temps,
          journal: o.journal ? (l) => journal.push(l) : undefined,
        })
        essais.push(e)
        if (o.journal) {
          console.log(`\n── ${lv.code} · ${r.nom} ──`)
          for (const l of journal) {
            console.log(
              `t=${l.t.toFixed(1).padStart(5)} pos=(${l.x.toFixed(0)},${l.y.toFixed(0)})` +
                ` v=(${l.vx.toFixed(0)},${l.vy.toFixed(0)}) d=${l.d.toFixed(0)}` +
                ` rappr=${l.rapprochement.toFixed(0)} vivants=${l.vivants}` +
                `${l.menace ? ' MENACE' : ''}${l.pousse ? ' POUSSE' : ''}` +
                `${l.rassemble ? ' RASSEMBLE' : ''}`,
            )
          }
        }
      }
    }
    lignes.push({
      code: lv.code,
      nom: lv.name,
      par: lv.par,
      audit,
      horsPerimetre: hors?.raison,
      essais,
    })
  }

  const rapport: Rapport = {
    genere: new Date().toISOString(),
    tableaux: lignes,
  }
  console.log(formate(rapport))

  if (o.json) {
    writeFileSync(o.json, JSON.stringify(rapport, null, 2))
    console.log(`\nrapport écrit dans ${o.json}`)
  }

  let echec = false
  const erreurs = lignes.flatMap((l) =>
    l.audit.constats.filter((c) => c.gravite === 'erreur').map((c) => ({ l, c })),
  )
  if (erreurs.length > 0) {
    console.log(`\n${erreurs.length} ERREUR(S) D'AUDIT`)
    echec = true
  }

  if (o.base) {
    const base = JSON.parse(readFileSync(o.base, 'utf8')) as Rapport
    const ecarts = compare(base, rapport)
    console.log(`\nCOMPARAISON À ${o.base}`)
    if (ecarts.length === 0) {
      console.log('  rien à signaler')
    }
    for (const e of ecarts) {
      console.log(`  ${e.gravite === 'regression' ? '✗' : '↑'} ${e.code} — ${e.message}`)
      if (e.gravite === 'regression') echec = true
    }
  }

  // Le résumé qu'on lit en diagonale
  const joues = lignes.filter((l) => l.essais.length > 0)
  const franchis = joues.filter((l) => {
    const m = meilleurEssai(l)
    return m !== null && (m.verdict === 'bu' || m.verdict === 'atteint')
  })
  if (joues.length > 0) {
    console.log(
      `\n${franchis.length}/${joues.length} tableaux franchis par le pilote` +
        ` · ${lignes.length - joues.length} non joués (hors périmètre ou audit seul)`,
    )
  }
  process.exit(echec ? 1 : 0)
}

main()
