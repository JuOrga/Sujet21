// LE TIR À BLANC DU SYSTÈME DE RUN : pour N expéditions BOUCLÉES d'affilée,
// ce qui tombe à chacune — le fragment du récit, la fin, la révélation, le
// dénouement, et les cinématiques que le scénario déclenche au retour au
// hub et au lancement suivant. LA DESCENTE savait dérouler un plan sans le
// jouer ; ceci déroule le récit sans le jouer : c'est là qu'on voit si dix
// runs avant le secteur 4, c'est trop ou pas assez.
//
// Pur : le journal, le scénario et un nombre en entrée ; une table en
// sortie. Ce que le tir ne sait pas, il ne l'invente pas : les trophées ne
// tombent pas (condition « trophée » jamais remplie), la meilleure salle et
// le condensat restent à zéro, et la révélation suppose la passerelle 4
// réparée (une réparation, pas un compte de runs).

import type { JournalDef } from './journal'
import { denouementAtteint, fragmentsVus, finsVues, prochainFragment, prochaineFin, revelationAtteinte } from './journal'
import { choisitRegle, type EtatScenario, type MomentScenario, type ScenarioDef } from './scenario'

export interface CineTiree {
  moment: MomentScenario
  cine: string
  regle: string
}

export interface RangTirABlanc {
  /** 0 : avant la première descente (le premier lancement) */
  run: number
  fragment: string | null
  fin: string | null
  fragmentsVus: number
  finsVues: number
  revelation: boolean
  denouement: boolean
  /** ce que le scénario joue : au retour au hub, puis au lancement suivant */
  cines: CineTiree[]
}

function etatDe(journal: JournalDef, vues: string[], runs: number): EtatScenario {
  return {
    runs,
    salleMax: 0,
    condensat: 0,
    decouvertes: fragmentsVus(journal, vues),
    revelation: revelationAtteinte(journal, vues),
    denouement: denouementAtteint(journal, vues),
    trophee: () => false,
  }
}

export function tirABlanc(journal: JournalDef, scenario: ScenarioDef, n: number): RangTirABlanc[] {
  const combien = Math.max(0, Math.min(200, Math.round(n)))
  const vues: string[] = []
  const reglesVues = new Set<string>()
  const joue = (moment: MomentScenario, etat: EtatScenario, cines: CineTiree[]): void => {
    const r = choisitRegle(scenario, moment, etat, reglesVues)
    if (!r) return
    if (r.uneFois) reglesVues.add(r.id)
    cines.push({ moment, cine: r.cine, regle: r.id })
  }
  const out: RangTirABlanc[] = []
  // avant la première descente : le premier lancement, puis le lancement
  const avant: CineTiree[] = []
  joue('premier-lancement', etatDe(journal, vues, 0), avant)
  joue('lancement-run', etatDe(journal, vues, 0), avant)
  out.push({ run: 0, fragment: null, fin: null, fragmentsVus: 0, finsVues: 0, revelation: revelationAtteinte(journal, vues), denouement: denouementAtteint(journal, vues), cines: avant })
  for (let run = 1; run <= combien; run++) {
    const fragment = prochainFragment(journal, vues)
    if (fragment) vues.push(fragment)
    const fin = prochaineFin(journal, vues)
    if (fin) vues.push(fin)
    const cines: CineTiree[] = []
    const etat = etatDe(journal, vues, run)
    joue('avant-hub', etat, cines)
    joue('lancement-run', etat, cines)
    out.push({
      run,
      fragment,
      fin,
      fragmentsVus: fragmentsVus(journal, vues),
      finsVues: finsVues(journal, vues),
      revelation: etat.revelation,
      denouement: etat.denouement,
      cines,
    })
  }
  return out
}

/** Les repères du tir, en une phrase chacun : à quelle run tombe quoi. */
export function reperesTirABlanc(rangs: RangTirABlanc[]): string[] {
  const out: string[] = []
  const premiere = (f: (r: RangTirABlanc) => boolean): RangTirABlanc | undefined => rangs.find((r) => r.run > 0 && f(r))
  const rev = premiere((r) => r.revelation)
  out.push(rev ? `La révélation tombe à la run ${rev.run} (passerelle 4 réparée).` : `La révélation ne tombe pas en ${rangs.length - 1} runs.`)
  const den = premiere((r) => r.denouement)
  out.push(den ? `Le dénouement est atteint à la run ${den.run}.` : `Le dénouement n’est pas atteint en ${rangs.length - 1} runs.`)
  const dernierFragment = [...rangs].reverse().find((r) => r.fragment)
  if (dernierFragment) out.push(`Le récit est entièrement raconté à la run ${dernierFragment.run}.`)
  const derniereFin = [...rangs].reverse().find((r) => r.fin)
  if (derniereFin) out.push(`Toutes les fins sont atteintes à la run ${derniereFin.run}.`)
  const cines = rangs.flatMap((r) => r.cines.map((c) => `${c.cine} (run ${r.run}, ${c.moment})`))
  out.push(cines.length ? `Cinématiques du scénario : ${cines.join(', ')}.` : 'Aucune cinématique du scénario ne se déclenche.')
  return out
}
