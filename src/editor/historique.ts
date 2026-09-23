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

  /** Le pas à rétablir, contenu ET entrée ouverte — ou null. */
  annule(): Pas | null {
    const pas = this.past.pop()
    if (pas === undefined) return null
    this.future.push(this.courant)
    this.courant = pas
    return { ...pas }
  }

  retablit(): Pas | null {
    const pas = this.future.pop()
    if (pas === undefined) return null
    this.past.push(this.courant)
    this.courant = pas
    return { ...pas }
  }

  get peutAnnuler(): boolean {
    return this.past.length > 0
  }

  get peutRetablir(): boolean {
    return this.future.length > 0
  }
}
