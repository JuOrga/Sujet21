// ---- LA FIN DE LA DESCENTE ---------------------------------------------------
// La descente bouclée (le plus grand moment du jeu), la défaite définitive et
// « échantillon dispersé — reprise » s'affichaient dans #overlay : un
// rectangle, un paragraphe gris, un bouton. Elles deviennent des scènes du
// voile de la cérémonie. Ce module dit ce que leur relevé écrit ; main.ts
// (mbMontreFinDescente) les met en scène.

import { fmtDuree, fmtL } from './formats'

export type IssueDescente = 'bouclee' | 'perdue' | 'reprise'

/** Le relevé, tel qu'il s'écrit. Seulement des chiffres que la run tient
 *  déjà : pas de « meilleur rang », il faudrait un état de plus dans la
 *  sauvegarde. */
export interface ReleveDescente {
  salles: string
  litres: string
  duree: string
  instruments: number
  memoire: string
  palier: number
}

/** Un compte sûr : une sauvegarde abîmée ou un calcul cassé rend 0, jamais
 *  NaN à l'écran. */
function compte(n: number): number {
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
}
function mesure(n: number): number {
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

export function releveDescente(e: {
  salles: number
  total: number
  livreL: number
  dureeS: number
  instruments: number
  memoireGagnee: number
  palier: number
}): ReleveDescente {
  const salles = compte(e.salles)
  // la longueur se recalcule sur la carte au fil de la descente : un relevé
  // ne dit jamais plus de salles franchies qu'il n'y en avait
  const total = Math.max(salles, compte(e.total))
  return {
    salles: `${salles}/${total}`,
    litres: fmtL(mesure(e.livreL)),
    duree: fmtDuree(mesure(e.dureeS)),
    instruments: compte(e.instruments),
    memoire: `+${compte(e.memoireGagnee)}`,
    palier: compte(e.palier),
  }
}
