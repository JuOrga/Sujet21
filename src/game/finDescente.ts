// ---- LA FIN DE LA DESCENTE ---------------------------------------------------
// La descente bouclée (le plus grand moment du jeu), la défaite définitive et
// « échantillon dispersé — reprise » s'affichaient dans #overlay : un
// rectangle, un paragraphe gris, un bouton. Elles deviennent des scènes du
// voile de la cérémonie. Ce module dit ce que leur relevé écrit ; main.ts
// (mbMontreFinDescente) les met en scène.

import { GARDE_GESTE_MS, gesteTropTot } from './ceremonie'
import { sceauHTML } from './ceremonieObjets'
import { fmtDuree, fmtL } from './formats'
import { iconeCeremonieHTML, iconeInstrumentHTML, type IconeCeremonie } from './iconesStation'
import type { InstrumentDef } from './instruments'

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

/** Ce que la poutre et la ligne de contexte disent : le surtitre, le titre,
 *  et quelques mots sous la poutre (vides à la bouclée : l'image et le titre
 *  suffisent). Les phrases de l'overlay d'avant dépassaient 80 caractères ;
 *  la cause de la perte (le vide ou la dispersion) tient en quatre mots.
 *  `vide` : l'échantillon a été aspiré par le vide plutôt que dispersé. */
export function titresFin(issue: IssueDescente, vide: boolean): { sur: string; titre: string; contexte: string } {
  if (issue === 'bouclee') return { sur: 'FIN DE LA DESCENTE', titre: 'LA DESCENTE EST BOUCLÉE', contexte: '' }
  if (issue === 'perdue')
    return { sur: 'FIN DE LA RUN', titre: 'ÉCHANTILLON PERDU', contexte: vide ? 'EMPORTÉ PAR LE VIDE' : 'DÉFAIT PAR LA DISPERSION' }
  return {
    sur: 'ÉCHANTILLON DE SECOURS',
    titre: vide ? 'ÉCHANTILLON ASPIRÉ PAR LE VIDE' : 'ÉCHANTILLON DISPERSÉ',
    contexte: 'REPRISE À LA PREMIÈRE GOUTTE',
  }
}

/** Le libellé du levier : celui du bouton de l'overlay, à la lettre. */
export function levierFin(issue: IssueDescente, salle: number): string {
  return issue === 'reprise' ? `REPRENDRE — SALLE ${salle}` : 'RETOUR AU LABO'
}

/** Quand le levier paraît : son animation-delay dans la feuille
 *  (.mb-fin-levier, index.html — ceremonie.spec.ts garde l'accord). */
export const LEVIER_FIN_MS = 1200

/** Le levier répond-il ? Entrée et Espace font avancer les planches de la
 *  cinématique qui précède : la dernière pression la ferme, la scène s'ouvre,
 *  le levier prend le focus — et la pression suivante pressait RETOUR AU LABO
 *  avant que le levier ne soit seulement visible. Il ne répond qu'une fois
 *  paru. Sans animation, il paraît tout de suite : reste la garde du dépôt
 *  (gesteTropTot, GARDE_GESTE_MS) contre le geste qui vient d'ouvrir. Une
 *  horloge qui recule n'est pas « trop tôt » : on obéit. */
export function levierFinPret(maintenant: number, ouvertA: number, moinsAnimations: boolean): boolean {
  if (gesteTropTot(maintenant, ouvertA)) return false
  const ecart = maintenant - ouvertA
  return moinsAnimations || ecart < 0 || ecart >= Math.max(GARDE_GESTE_MS, LEVIER_FIN_MS)
}

/** Ce que la scène de fin montre sous la poutre. Tout sauf le relevé est
 *  facultatif : la défaite n'a ni tampon ni palmarès, la reprise n'a que
 *  ses secours et sa profondeur. */
export interface SceneFin {
  issue: IssueDescente
  releve: ReleveDescente
  /** les instruments emportés : leurs icônes rendues font le butin */
  butin?: ReadonlyArray<Pick<InstrumentDef, 'id' | 'icone' | 'nom'>>
  /** les records que la descente vient de battre (« MEILLEURE DESCENTE ») */
  tampons?: readonly string[]
  /** le palmarès du poste, cette descente comprise */
  palmares?: { bouclees: number; profondeurRecord: number; meilleurLivre: string } | null
  /** le condensat que la purge confisque au retour, en cL */
  purgeCl?: number | null
  /** à la reprise : les échantillons de secours qui resteront */
  secours?: number
}

/** Échappe ce qui finit dans un nœud ou un attribut : un nom d'instrument
 *  « perso » vient d'un champ que le concepteur tape. */
function echappe(t: string): string {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Une cartouche du relevé : la forme de cartouches.ts (alvéole, gros
 *  chiffre, nom), pour des chiffres qui ne sont pas des gains de la récolte
 *  — la durée, la profondeur, les secours n'ont pas de clé de Gain. Le sens
 *  long passe dans l'infobulle. */
function cartouche(cle: IconeCeremonie, valeur: string, nom: string, titre: string, i: number): string {
  return (
    `<div class="mb-cartouche mb-cartouche-${cle}" style="--i:${i}" title="${echappe(titre)}">` +
    `<span class="mb-cartouche-alv">${iconeCeremonieHTML(cle)}</span>` +
    `<b class="mb-cartouche-val">${echappe(valeur)}</b>` +
    `<span class="mb-cartouche-nom">${echappe(nom)}</span>` +
    `</div>`
  )
}

/** LE GABARIT DE LA SCÈNE. L'image est la scène : le relevé se pose dans son
 *  tiers bas, en UNE rangée — le sceau du module (les salles, et le tampon
 *  RECORD posé dessus), les cinq cartouches, le butin en icônes rendues.
 *  Le palmarès du poste passe dans l'infobulle du sceau, la purge dans celle
 *  de la mémoire : en cartouches, ils doublaient la hauteur du relevé et
 *  couvraient la moitié de l'image (relecture du lot E). Le levier n'y est
 *  pas : main.ts le crée pour l'écouter. Sorti de main.ts pour être testé,
 *  et posé tel quel par le banc de la cérémonie. */
export function finDescenteHTML(s: SceneFin): string {
  const r = s.releve
  if (s.issue === 'reprise') {
    const n = compte(s.secours ?? 0)
    return (
      `<div class="mb-fin mb-fin-reprise"><div class="mb-fin-releve">` +
      cartouche('secours', `×${n}`, 'SECOURS RESTANTS', 'les échantillons de secours qui resteront après celui-ci', 0) +
      cartouche('profondeur', r.salles, 'PROFONDEUR', 'salles franchies sur la longueur de la descente', 1) +
      `</div></div>`
    )
  }
  const butin = s.butin ?? []
  const tampons = s.tampons ?? []
  const p = s.palmares
  const titreSalles =
    'salles franchies sur la longueur de la descente' +
    (p
      ? ` — palmarès du poste : ${compte(p.bouclees)} bouclées · profondeur record ${compte(p.profondeurRecord)} · meilleur livré ${p.meilleurLivre}`
      : '')
  const titreMemoire =
    'la mémoire gravée cette descente — pour de bon : elle survit à la purge' +
    (s.purgeCl != null ? ` ; la purge du retour confisque ${compte(s.purgeCl)} cL de condensat` : '')
  let i = 0
  return (
    `<div class="mb-fin mb-fin-${s.issue}"><div class="mb-fin-releve">` +
    // LES SALLES sur le sceau du module : le chiffre de la descente, celui
    // qui tombe ; teinté par --mb-rang (l'or de la bouclée, le rouge du
    // figé). Un record battu s'y tamponne.
    `<figure class="mb-fin-salles" title="${echappe(titreSalles)}">` +
    `<div class="mb-sceau mb-fin-sceau"><span class="mb-fin-sceau-img">${sceauHTML('module')}</span>` +
    `<b class="mb-sceau-mot" style="--mb-nom-n:${r.salles.length}">${echappe(r.salles)}</b></div>` +
    `<figcaption>SALLES</figcaption>` +
    (tampons.length > 0 ? `<em class="mb-fin-tampon" title="${echappe(tampons.join(' · '))}">RECORD</em>` : '') +
    `</figure>` +
    `<div class="mb-fin-chiffres">` +
    cartouche('livre', r.litres, 'VOLUME', 'le volume livré : ce que les sas ont bu, de la première salle à la dernière', i++) +
    cartouche('chrono', r.duree, 'DURÉE', 'le temps de la descente, du premier sas au dernier', i++) +
    cartouche('instruments', String(r.instruments), 'INSTRUMENTS', 'les instruments emportés', i++) +
    cartouche('memoire', r.memoire, 'MÉMOIRE', titreMemoire, i++) +
    cartouche('maitrise', String(r.palier), 'PALIER', 'le palier de maîtrise atteint', i++) +
    `</div>` +
    // LE BUTIN : les instruments emportés, leurs icônes rendues (un
    // instrument sans case rend son emoji, ou son nom)
    (butin.length > 0
      ? `<div class="mb-fin-butin" title="le butin de la descente">${butin.map((d) => iconeInstrumentHTML(d)).join('')}</div>`
      : '') +
    `</div></div>`
  )
}
