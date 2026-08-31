// LE RAPPORT — mise en forme console, sérialisation JSON, et surtout la
// COMPARAISON à une référence. C'est elle qui fait l'outil de non-régression :
// le pilote n'a pas besoin de jouer aussi bien qu'un humain, il a besoin de
// jouer PAREIL d'un jour à l'autre. Un tableau qui passait et ne passe plus
// est un signal, quel que soit le talent du bot.

import type { Audit, Constat } from './audit'
import { reussi, type Essai } from './pilote'

export interface LigneRapport {
  code: string
  nom: string
  par?: number
  audit: Audit
  /** Raison pour laquelle le pilote n'a pas joué ce tableau, le cas échéant. */
  horsPerimetre?: string
  essais: Essai[]
}

export interface Rapport {
  genere: string
  tableaux: LigneRapport[]
}

export function meilleurEssai(l: LigneRapport): Essai | null {
  if (l.essais.length === 0) return null
  return l.essais.reduce((a, b) => {
    const ra = reussi(a.verdict)
    const rb = reussi(b.verdict)
    if (ra !== rb) return ra ? a : b
    if (ra) return b.litres > a.litres ? b : a
    return b.distanceMin < a.distanceMin ? b : a
  })
}

const SIGNE: Record<Constat['gravite'], string> = {
  erreur: '✗',
  alerte: '!',
  note: '·',
}

function cadre(t: string, n: number): string {
  return t.length > n ? t.slice(0, n - 1) + '…' : t.padEnd(n)
}

export function formate(rapport: Rapport): string {
  const lignes: string[] = []
  lignes.push(
    `BANC DE PLAYTEST — ${rapport.tableaux.length} tableaux · ${rapport.genere}`,
  )
  lignes.push('')
  lignes.push(
    `${cadre('CODE', 7)}${cadre('TABLEAU', 24)}${cadre('PASSE EN', 20)}` +
      `${cadre('VERDICT', 10)}${cadre('IMP/PAR', 9)}${cadre('VOLUME', 8)}${'PASSAGE/CORPS'}`,
  )
  lignes.push('─'.repeat(88))
  for (const l of rapport.tableaux) {
    const m = meilleurEssai(l)
    const passe =
      l.audit.etatsQuiPassent.length > 0
        ? l.audit.etatsQuiPassent.join(', ')
        : 'AUCUN ÉTAT'
    const verdict = l.horsPerimetre ? '(non joué)' : (m?.verdict ?? '—')
    const imp = m ? `${m.impulsions}${l.par ? `/${l.par}` : ''}` : '—'
    const vol = m ? `${(m.rendement * 100).toFixed(0)} %` : '—'
    const passage = l.audit.accessible
      ? `${l.audit.largeurPassage.toFixed(0)}/${l.audit.diametreCorps.toFixed(0)} u`
      : '—'
    lignes.push(
      cadre(l.code, 7) +
        cadre(l.nom, 24) +
        cadre(passe, 20) +
        cadre(verdict, 10) +
        cadre(imp, 9) +
        cadre(vol, 8) +
        passage,
    )
  }

  const avecConstats = rapport.tableaux.filter(
    (l) => l.audit.constats.length > 0,
  )
  if (avecConstats.length > 0) {
    lignes.push('')
    lignes.push('CONSTATS')
    for (const l of avecConstats) {
      lignes.push(`  ${l.code} — ${l.nom}`)
      for (const c of l.audit.constats) {
        lignes.push(`    ${SIGNE[c.gravite]} ${c.message}`)
      }
    }
  }
  return lignes.join('\n')
}

export interface Ecart {
  code: string
  gravite: 'regression' | 'progres'
  message: string
}

/** La comparaison à une référence. Ce que l'on surveille, dans l'ordre :
 *   1. un tableau accessible qui ne l'est plus — une paroi de trop, et le
 *      sas est muré ; c'est la panne qu'on ne voit jamais en jouant les
 *      premiers écrans ;
 *   2. un tableau que le pilote franchissait et ne franchit plus ;
 *   3. un effondrement du volume livré — le tableau passe encore, mais il
 *      est devenu bien plus cher : c'est un changement d'équilibrage, voulu
 *      ou non, et il mérite d'être vu. */
export function compare(base: Rapport, neuf: Rapport, seuilVolume = 0.15): Ecart[] {
  const parCode = new Map(base.tableaux.map((l) => [l.code, l]))
  const ecarts: Ecart[] = []
  for (const l of neuf.tableaux) {
    const avant = parCode.get(l.code)
    if (!avant) {
      ecarts.push({
        code: l.code,
        gravite: 'progres',
        message: 'tableau nouveau : rien à comparer',
      })
      continue
    }
    if (avant.audit.accessible && !l.audit.accessible) {
      ecarts.push({
        code: l.code,
        gravite: 'regression',
        message: 'le sas était atteignable, il ne l’est plus',
      })
    }
    const mAvant = meilleurEssai(avant)
    const mNeuf = meilleurEssai(l)
    const passaitAvant = mAvant !== null && reussi(mAvant.verdict)
    const passeMaintenant = mNeuf !== null && reussi(mNeuf.verdict)
    if (passaitAvant && !passeMaintenant) {
      ecarts.push({
        code: l.code,
        gravite: 'regression',
        message: `le pilote franchissait ce tableau (${mAvant.reglage}), il échoue maintenant (${mNeuf?.verdict ?? '—'})`,
      })
    } else if (!passaitAvant && passeMaintenant) {
      ecarts.push({
        code: l.code,
        gravite: 'progres',
        message: `le pilote franchit ce tableau désormais (${mNeuf?.reglage})`,
      })
    }
    if (passaitAvant && passeMaintenant && mAvant && mNeuf) {
      const delta = mNeuf.rendement - mAvant.rendement
      if (delta < -seuilVolume) {
        ecarts.push({
          code: l.code,
          gravite: 'regression',
          message: `le volume livré chute de ${(mAvant.rendement * 100).toFixed(0)} % à ${(mNeuf.rendement * 100).toFixed(0)} %`,
        })
      } else if (delta > seuilVolume) {
        ecarts.push({
          code: l.code,
          gravite: 'progres',
          message: `le volume livré monte de ${(mAvant.rendement * 100).toFixed(0)} % à ${(mNeuf.rendement * 100).toFixed(0)} %`,
        })
      }
    }
    const erreursAvant = new Set(
      avant.audit.constats.filter((c) => c.gravite === 'erreur').map((c) => c.code),
    )
    for (const c of l.audit.constats) {
      if (c.gravite === 'erreur' && !erreursAvant.has(c.code)) {
        ecarts.push({
          code: l.code,
          gravite: 'regression',
          message: `nouvelle erreur d'audit : ${c.message}`,
        })
      }
    }
  }
  return ecarts
}
