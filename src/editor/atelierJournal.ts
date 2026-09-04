// L'ATELIER DU JOURNAL — RÉCIT & FINS, à la main du concepteur.
//
// Ce qu'il tient : les fragments du récit et les fins, dans l'ordre où
// l'expédition bouclée les sert ; le titre, l'icône et le texte de chacun ;
// les deux seuils — la RÉVÉLATION après N fragments, le DÉNOUEMENT après N
// fins. Un BROUILLON par poste (localStorage, survit au rechargement), un
// journal PUBLIÉ pour tous (le magasin partagé, /api/journal), et le LIVRÉ
// du code sous les deux — on y revient d'un bouton.
//
// Tout ce qui se calcule vit dans game/journal.ts (testé) : l'atelier ne
// fait que peindre et relayer. Il ne connaît ni le réseau ni les registres :
// les crochets les lui prêtent, comme pour l'éditeur de la carte.
//
// UN ID NE SE RÉATTRIBUE JAMAIS : il se dérive du titre à la création et
// s'affiche en petit, sans champ pour le changer — les registres des
// joueurs s'en souviennent.

import {
  JOURNAL_LIVRE,
  ajouteEntree,
  cloneJournal,
  deplaceEntree,
  estAttention,
  litJournal,
  memeJournal,
  modifieEntree,
  poseSeuil,
  supprimeEntree,
  verifieJournal,
  type GroupeJournal,
  type JournalDef,
  type JournalPublie,
} from '../game/journal'

export interface HooksAtelierJournal {
  auteur(): string
  /** le journal publié au magasin — null : pas de réseau */
  charge(): Promise<JournalPublie | null>
  publie(j: JournalDef): Promise<JournalPublie | null>
  /** retire le journal publié : le livré reprend pour tous */
  retire(): Promise<boolean>
  /** fait jouer ce journal SUR CE POSTE, tout de suite (null : le publié ou le livré) */
  applique(j: JournalDef | null): void
  fermer(): void
}

export const CLE_BROUILLON = 'projet21.journal.brouillon.v1'

const esc = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const GROUPES: { g: GroupeJournal; nom: string; un: string; seuil: 'revelationApres' | 'denouementApres'; seuilNom: string }[] = [
  { g: 'recit', nom: 'LE RÉCIT', un: 'un fragment', seuil: 'revelationApres', seuilNom: 'LA RÉVÉLATION après' },
  { g: 'fins', nom: 'LES FINS', un: 'une fin', seuil: 'denouementApres', seuilNom: 'LE DÉNOUEMENT après' },
]

export class AtelierJournal {
  private brouillon: JournalDef = cloneJournal(JOURNAL_LIVRE)
  private publie: JournalDef | null = null
  private info: { auteur: string; date: string } = { auteur: '', date: '' }
  private charge = false
  private etat = ''
  private occupe = false
  private glisse: { g: GroupeJournal; i: number } | null = null
  private stockage: Storage | null

  constructor(
    private host: HTMLElement,
    private hooks: HooksAtelierJournal,
  ) {
    let st: Storage | null = null
    try {
      st = localStorage
    } catch {
      st = null
    }
    this.stockage = st
    host.innerHTML = gabarit()
    host.addEventListener('click', (e) => this.clic(e))
    host.addEventListener('input', (e) => this.saisie(e))
    host.addEventListener('dragstart', (e) => this.dragstart(e))
    host.addEventListener('dragover', (e) => {
      if (this.glisse && (e.target as HTMLElement).closest('.aj-carte')) e.preventDefault()
    })
    host.addEventListener('drop', (e) => this.drop(e))
    host.addEventListener('pointerdown', (e) => {
      if (e.target === host) this.hooks.fermer()
    })
  }

  get visible(): boolean {
    return !this.host.hidden
  }

  async open(): Promise<void> {
    this.host.hidden = false
    if (!this.charge) {
      this.etat = 'Lecture du magasin partagé…'
      this.render()
      await this.recharge(false)
    }
    this.render()
  }

  close(): void {
    this.host.hidden = true
  }

  // ---- LE BROUILLON ---------------------------------------------------------

  private litBrouillon(): JournalDef | null {
    try {
      return litJournal(JSON.parse(this.stockage?.getItem(CLE_BROUILLON) ?? 'null'))
    } catch {
      return null
    }
  }

  private pose(j: JournalDef): void {
    this.brouillon = j
    try {
      this.stockage?.setItem(CLE_BROUILLON, JSON.stringify(j))
    } catch {
      // stockage refusé : le brouillon ne tiendra que la session
    }
  }

  /** Le journal de référence : le publié, sinon le livré. */
  private reference(): JournalDef {
    return this.publie ?? JOURNAL_LIVRE
  }

  private async recharge(remplaceBrouillon: boolean): Promise<void> {
    const p = await this.hooks.charge()
    if (p) {
      this.publie = p.journal
      this.info = { auteur: p.auteur, date: p.date }
      this.charge = true
      this.etat = p.journal ? 'Journal publié relu.' : 'Rien de publié : le livré joue.'
    } else {
      this.etat = 'Magasin injoignable : le livré sert de référence.'
    }
    const brouillon = remplaceBrouillon ? null : this.litBrouillon()
    this.pose(brouillon ?? cloneJournal(this.reference()))
  }

  // ---- LE RENDU -------------------------------------------------------------

  render(): void {
    if (this.host.hidden) return
    this.peintEntete()
    this.peintCorps()
  }

  /** Statut, boutons, verdicts, état — ce qui change à chaque frappe. */
  private peintEntete(): void {
    const j = this.brouillon
    const verdicts = verifieJournal(j)
    const erreurs = verdicts.filter((v) => !estAttention(v))
    const modifie = !memeJournal(j, this.reference())
    const statut = this.el('aj-statut')
    statut.innerHTML =
      (this.publie
        ? `<b>PUBLIÉ</b> par ${esc(this.info.auteur || 'anonyme')}${this.info.date ? `, ${esc(formateDate(this.info.date))}` : ''}`
        : `<b>LE LIVRÉ JOUE</b> — rien de publié`) +
      (modifie ? ` · <i class="aj-modifie">brouillon modifié, non publié</i>` : ` · <i>brouillon identique</i>`)
    const b = (id: string, off: boolean): void => {
      const el = this.host.querySelector<HTMLButtonElement>(`#${id}`)
      if (el) el.disabled = off || this.occupe
    }
    b('aj-publier', erreurs.length > 0 || !modifie)
    b('aj-essayer', erreurs.length > 0)
    b('aj-revenir', !modifie)
    b('aj-retablir', this.publie === null)
    this.el('aj-etat').textContent = this.etat
    const v = this.el('aj-verdicts')
    v.innerHTML = verdicts.length
      ? verdicts.map((x) => `<li class="${estAttention(x) ? 'aj-attention' : 'aj-erreur'}">${esc(x)}</li>`).join('')
      : `<li class="aj-ok">Rien à signaler.</li>`
  }

  /** Seuils et colonnes — repeints seulement quand la structure change
   *  (ajout, retrait, déplacement, rechargement) : un champ repeint
   *  perdrait le curseur du concepteur en pleine phrase. */
  private peintCorps(): void {
    const j = this.brouillon
    const seuils = this.el('aj-seuils')
    seuils.innerHTML = GROUPES.map(
      (G) =>
        `<label><span>${G.seuilNom}</span><input type="number" min="0" max="${j[G.g].length}" step="1" data-seuil="${G.seuil}" value="${j[G.seuil]}"><small>${G.g === 'recit' ? 'fragments servis sur ' : 'fins atteintes sur '}${j[G.g].length}</small></label>`,
    ).join('')
    const cols = this.el('aj-colonnes')
    cols.innerHTML = GROUPES.map((G) => this.colonne(G, j)).join('')
  }

  private colonne(G: (typeof GROUPES)[number], j: JournalDef): string {
    const liste = j[G.g]
    return (
      `<section class="aj-col" data-groupe="${G.g}"><h3>${G.nom} <small>${liste.length}</small></h3>` +
      `<div class="aj-liste">` +
      liste
        .map(
          (e, i) =>
            `<article class="aj-carte" draggable="true" data-groupe="${G.g}" data-i="${i}" data-id="${esc(e.id)}">` +
            `<div class="aj-ligne"><span class="aj-poignee" title="Glisser pour réordonner">☰</span><b class="aj-num">${i + 1}</b>` +
            `<input class="aj-icone" data-champ="icone" value="${esc(e.icone)}" aria-label="Icône" maxlength="8">` +
            `<input class="aj-titre" data-champ="titre" value="${esc(e.titre)}" placeholder="Titre" aria-label="Titre" maxlength="80">` +
            `<button type="button" data-monte title="Monter" ${i === 0 ? 'disabled' : ''}>▲</button>` +
            `<button type="button" data-descend title="Descendre" ${i === liste.length - 1 ? 'disabled' : ''}>▼</button>` +
            `<button type="button" data-supprime title="Retirer">✕</button></div>` +
            `<textarea class="aj-texte" data-champ="texte" rows="3" placeholder="Le texte que le joueur lira" maxlength="1200">${esc(e.texte)}</textarea>` +
            `<small class="aj-id">${esc(e.id)}</small></article>`,
        )
        .join('') +
      `</div>` +
      `<div class="aj-ajout"><input type="text" data-nouveau="${G.g}" placeholder="Titre de ${G.un} à ajouter" maxlength="80"><button type="button" data-ajoute="${G.g}">+ AJOUTER</button></div>` +
      `</section>`
    )
  }

  // ---- LES GESTES -----------------------------------------------------------

  private saisie(e: Event): void {
    const t = e.target as HTMLInputElement | HTMLTextAreaElement
    if (t.dataset.seuil) {
      this.pose(poseSeuil(this.brouillon, t.dataset.seuil as 'revelationApres' | 'denouementApres', Number(t.value)))
      this.renderLeger()
      return
    }
    const champ = t.dataset.champ as 'icone' | 'titre' | 'texte' | undefined
    const carte = t.closest<HTMLElement>('.aj-carte')
    if (!champ || !carte) return
    this.pose(modifieEntree(this.brouillon, carte.dataset.groupe as GroupeJournal, carte.dataset.id!, champ, t.value))
    this.renderLeger()
  }

  /** Après une frappe : l'en-tête seulement — les champs gardent leur
   *  curseur ; un seuil tapé hors bornes est ramené à ce que le brouillon a
   *  retenu, sans l'arracher au clavier. */
  private renderLeger(): void {
    if (this.host.hidden) return
    this.peintEntete()
    this.host.querySelectorAll<HTMLInputElement>('[data-seuil]').forEach((i) => {
      const quoi = i.dataset.seuil as 'revelationApres' | 'denouementApres'
      i.max = String(this.brouillon[quoi === 'revelationApres' ? 'recit' : 'fins'].length)
      if (document.activeElement !== i) i.value = String(this.brouillon[quoi])
    })
  }

  private clic(e: Event): void {
    const t = e.target as HTMLElement
    const b = t.closest('button') as HTMLButtonElement | null
    if (!b || b.disabled) return
    const carte = b.closest<HTMLElement>('.aj-carte')
    if (carte) {
      const g = carte.dataset.groupe as GroupeJournal
      const i = Number(carte.dataset.i)
      if (b.hasAttribute('data-monte')) this.pose(deplaceEntree(this.brouillon, g, i, i - 1))
      else if (b.hasAttribute('data-descend')) this.pose(deplaceEntree(this.brouillon, g, i, i + 1))
      else if (b.hasAttribute('data-supprime')) {
        // retirer une entrée déjà servie ne retire rien aux joueurs : elle
        // reste dans leurs registres, invisible — on prévient quand même
        if (!window.confirm(`Retirer « ${carte.dataset.id} » du journal ? Les joueurs qui l'ont lue la perdent du codex.`)) return
        this.pose(supprimeEntree(this.brouillon, g, carte.dataset.id!))
      } else return
      this.render()
      return
    }
    if (b.dataset.ajoute) {
      const g = b.dataset.ajoute as GroupeJournal
      const champ = this.host.querySelector<HTMLInputElement>(`[data-nouveau="${g}"]`)
      const titre = champ?.value.trim() ?? ''
      if (!titre) {
        champ?.focus()
        return
      }
      this.pose(ajouteEntree(this.brouillon, g, titre))
      this.render()
      this.host.querySelector<HTMLElement>(`[data-groupe="${g}"] .aj-carte:last-child .aj-texte`)?.focus()
      return
    }
    switch (b.id) {
      case 'aj-fermer':
        this.hooks.fermer()
        return
      case 'aj-publier':
        void this.action(async () => {
          const p = await this.hooks.publie(this.brouillon)
          if (!p) return 'Échec : le magasin partagé ne répond pas.'
          this.publie = p.journal
          this.info = { auteur: p.auteur, date: p.date }
          this.hooks.applique(p.journal)
          return 'Journal publié : il joue pour tout le monde.'
        })
        return
      case 'aj-essayer':
        this.hooks.applique(this.brouillon)
        this.etat = 'Le brouillon joue sur ce poste, jusqu’au rechargement de la page.'
        this.render()
        return
      case 'aj-recharger':
        void this.action(async () => {
          await this.recharge(false)
          return this.etat
        })
        return
      case 'aj-revenir':
        this.pose(cloneJournal(this.reference()))
        this.etat = this.publie ? 'Brouillon remis sur le journal publié.' : 'Brouillon remis sur le livré.'
        this.render()
        return
      case 'aj-livre':
        this.pose(cloneJournal(JOURNAL_LIVRE))
        this.etat = 'Brouillon remis sur le journal livré (rien n’est publié tant que vous ne publiez pas).'
        this.render()
        return
      case 'aj-retablir':
        if (!window.confirm('Retirer le journal publié ? Le livré du code reprendra pour tout le monde.')) return
        void this.action(async () => {
          const ok = await this.hooks.retire()
          if (!ok) return 'Échec : le magasin partagé ne répond pas.'
          this.publie = null
          this.info = { auteur: '', date: '' }
          this.hooks.applique(null)
          return 'Journal publié retiré : le livré joue pour tout le monde.'
        })
        return
    }
  }

  private async action(f: () => Promise<string>): Promise<void> {
    this.occupe = true
    this.etat = 'Envoi…'
    this.render()
    this.etat = await f()
    this.occupe = false
    this.render()
  }

  private dragstart(e: DragEvent): void {
    const carte = (e.target as HTMLElement).closest<HTMLElement>('.aj-carte')
    if (!carte || !e.dataTransfer) return
    this.glisse = { g: carte.dataset.groupe as GroupeJournal, i: Number(carte.dataset.i) }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', carte.dataset.id ?? '')
  }

  private drop(e: DragEvent): void {
    const carte = (e.target as HTMLElement).closest<HTMLElement>('.aj-carte')
    const de = this.glisse
    this.glisse = null
    if (!carte || !de || carte.dataset.groupe !== de.g) return
    e.preventDefault()
    this.pose(deplaceEntree(this.brouillon, de.g, de.i, Number(carte.dataset.i)))
    this.render()
  }

  private el(id: string): HTMLElement {
    const e = this.host.querySelector<HTMLElement>(`#${id}`)
    if (!e) throw new Error(`atelier du journal : #${id} manque dans le gabarit`)
    return e
  }
}

function formateDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function gabarit(): string {
  return (
    `<div class="salles-boite aj-boite">` +
    `<div class="salles-tete"><span>RÉCIT &amp; FINS — l’atelier du journal</span>` +
    `<button type="button" id="aj-fermer" aria-label="Fermer">✕</button></div>` +
    `<p class="salles-legende">Chaque <b>expédition bouclée</b> sert le prochain fragment du récit et la prochaine fin, <b>dans cet ordre</b>. ` +
    `Réordonnez (glisser, ou ▲ ▼), écrivez, ajoutez, retirez ; réglez après combien de fragments tombe la <b>révélation</b> ` +
    `et après combien de fins se joue le <b>dénouement</b>. Un identifiant ne change jamais : les registres des joueurs s’en souviennent. ` +
    `La mémoire, la rareté et la vidéo de chaque entrée se règlent dans le codex.</p>` +
    `<div class="aj-barre"><p id="aj-statut" class="aj-statut"></p>` +
    `<div class="aj-boutons">` +
    `<button type="button" id="aj-publier" title="Publier ce brouillon au magasin partagé : il joue pour tout le monde">PUBLIER</button>` +
    `<button type="button" id="aj-essayer" title="Faire jouer ce brouillon sur ce poste, sans publier">ESSAYER SUR CE POSTE</button>` +
    `<button type="button" id="aj-recharger" title="Relire le journal publié (le brouillon est gardé)">RECHARGER</button>` +
    `<button type="button" id="aj-revenir" title="Abandonner le brouillon : reprendre le publié (ou le livré)">REVENIR AU PUBLIÉ</button>` +
    `<button type="button" id="aj-livre" title="Remettre le brouillon sur le journal livré avec le code">BROUILLON = LIVRÉ</button>` +
    `<button type="button" id="aj-retablir" class="aj-danger" title="Retirer le journal publié : le livré reprend pour tous">RETIRER LE PUBLIÉ</button>` +
    `</div></div>` +
    `<div id="aj-seuils" class="aj-seuils"></div>` +
    `<div id="aj-colonnes" class="aj-colonnes"></div>` +
    `<ul id="aj-verdicts" class="aj-verdicts"></ul>` +
    `<p class="pup-etat" id="aj-etat"></p>` +
    `</div>`
  )
}
