// L'historique Annuler / Rétablir de l'éditeur, hors du DOM pour être testé.
//
// Un PAS n'est pas seulement le contenu du tableau : c'est le contenu ET
// l'entrée de bibliothèque à laquelle il appartient (openId, base). Tant que
// l'historique ne retenait que le contenu, ouvrir un autre tableau puis
// annuler ramenait l'ANCIEN contenu sous le NOUVEL identifiant — et
// ENREGISTRER publiait l'un par-dessus l'autre. C'est ainsi qu'« echangette »
// a disparu le 28/08 : « Les 3 voies » ouverte, clic sur « echangette »,
// annuler, retouches, ENREGISTRER — l'échangette portait désormais les
// 3 voies, et l'entrée `les-3-voies` d'origine a fini supprimée comme
// doublon.

export interface Lien {
  /** l'entrée de bibliothèque ouverte ('' : brouillon détaché) */
  openId: string
  /** son contenu à la dernière synchro (cf. rattrapeBibliotheque) */
  base: string
}

export interface Pas extends Lien {
  /** le tableau, sérialisé (serializeLevel) */
  snap: string
}

const PROFONDEUR = 100

export class Historique {
  private past: Pas[] = []
  private future: Pas[] = []
  private courant: Pas

  constructor(depart: Pas) {
    this.courant = { ...depart }
  }

  /** Le contenu a peut-être changé : un pas s'il a changé, et dans tous les
   *  cas le LIEN courant est retenu — un enregistrement change l'entrée
   *  ouverte sans changer le contenu, l'annulation suivante doit le savoir. */
  note(etat: Pas): void {
    if (etat.snap === this.courant.snap) {
      this.courant = { ...etat }
      return
    }
    this.past.push(this.courant)
    if (this.past.length > PROFONDEUR) this.past.shift()
    this.future.length = 0
    this.courant = { ...etat }
  }

  /** Le lien change sans que le contenu change (rattrapage silencieux). */
  relie(lien: Lien): void {
    this.courant = { ...this.courant, ...lien }
  }

  /** Le pas à rétablir, contenu ET entrée ouverte — ou null. `present` :
   *  le lien tel qu'il est à l'instant (un enregistrement a pu l'avancer). */
  annule(present: Lien): Pas | null {
    const pas = this.past.pop()
    if (pas === undefined) return null
    this.future.push({ ...this.courant, ...present })
    return this.devient(pas, present)
  }

  retablit(present: Lien): Pas | null {
    const pas = this.future.pop()
    if (pas === undefined) return null
    this.past.push({ ...this.courant, ...present })
    return this.devient(pas, present)
  }

  // Sur la MÊME entrée, la base ne recule pas avec le contenu : elle dit ce
  // que la bibliothèque tenait à la dernière synchro, et ça, annuler ne le
  // change pas. Reculer la base faisait passer le brouillon annulé pour
  // « sans travail local » — le rattrapage suivant le remplaçait en silence
  // par la version enregistrée. Changer d'entrée, en revanche, rend la base
  // de l'entrée qu'on rouvre.
  private devient(pas: Pas, present: Lien): Pas {
    const r = pas.openId === present.openId ? { ...pas, base: present.base } : pas
    this.courant = { ...r }
    return { ...r }
  }

  get peutAnnuler(): boolean {
    return this.past.length > 0
  }

  get peutRetablir(): boolean {
    return this.future.length > 0
  }
}
