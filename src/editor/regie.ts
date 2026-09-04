// LA RÉGIE — la console du concepteur : un seul bouton sur l'accueil, un
// rail à gauche, et tout ce qui règle le système de run derrière — la
// carte, la descente, la planche, le récit et les fins, le scénario, le
// codex, le marchand, les récompenses, les textes. Elle n'héberge pas les
// outils dans son cadre (ce sont des voiles plein écran, chacun avec sa
// porte) : elle les ouvre, et elle reste dessous — on y revient en fermant
// l'outil. Ce qu'elle ajoute, et qu'aucun outil ne montrait : la VUE
// D'ENSEMBLE de ce qui est publié pour tout le monde, domaine par domaine,
// et le TIR À BLANC du système entier (tirABlanc.ts).
//
// Elle ne connaît ni les écrans ni le réseau : chaque section arrive avec
// sa porte (ouvre) et ses domaines de partage, les statuts et le tir sont
// prêtés par des crochets.

import { reperesTirABlanc, type RangTirABlanc } from '../game/tirABlanc'

export interface SectionRegie {
  id: string
  nom: string
  icone: string
  sous: string
  description: string
  /** les domaines de partage que cette section règle (clés des statuts) */
  domaines: string[]
  /** un intitulé de groupe : le rail le pose avant la première section qui le porte */
  groupe?: string
  ouvre(): void
}

export interface StatutPartage {
  nom: string
  publie: boolean
  auteur: string
  date: string
  detail?: string
  injoignable?: boolean
}

export interface HooksRegie {
  sections: SectionRegie[]
  statuts(): Promise<Record<string, StatutPartage>>
  tir(n: number): RangTirABlanc[]
  fermer(): void
}

const esc = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export class Regie {
  private courante = 'ensemble'
  private statuts: Record<string, StatutPartage> | null = null
  private lecture = false
  private combien = 12

  constructor(
    private host: HTMLElement,
    private hooks: HooksRegie,
  ) {
    host.innerHTML = gabarit()
    host.addEventListener('click', (e) => this.clic(e))
    host.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement
      if (t.id === 'rg-combien') {
        this.combien = Math.max(1, Math.min(200, Math.round(Number(t.value) || 12)))
        this.peintTir()
      }
    })
    host.addEventListener('pointerdown', (e) => {
      if (e.target === host) this.hooks.fermer()
    })
  }

  get visible(): boolean {
    return !this.host.hidden
  }

  open(section?: string): void {
    if (section) this.courante = section
    this.host.hidden = false
    this.render()
    void this.relit()
  }

  close(): void {
    this.host.hidden = true
  }

  /** Relit les statuts du magasin — à l'ouverture, et sur RECHARGER. */
  async relit(): Promise<void> {
    if (this.lecture) return
    this.lecture = true
    this.render()
    this.statuts = await this.hooks.statuts()
    this.lecture = false
    this.render()
  }

  // ---- LE RENDU --------------------------------------------------------------

  render(): void {
    if (this.host.hidden) return
    const rail = this.el('rg-rail')
    const fixes: [string, string, string][] = [
      ['ensemble', '◈', "VUE D'ENSEMBLE"],
      ['tir', '▶', 'TIR À BLANC'],
    ]
    rail.innerHTML =
      fixes.map(([id, ic, nom]) => `<button type="button" class="rg-item${id === this.courante ? ' on' : ''}" data-section="${id}"><i>${ic}</i><span>${nom}</span></button>`).join('') +
      `<hr>` +
      this.hooks.sections
        .map((s, i, all) => {
          const tete = s.groupe && s.groupe !== all[i - 1]?.groupe ? `<hr><small class="rg-groupe">${esc(s.groupe)}</small>` : ''
          return (
            tete +
            `<button type="button" class="rg-item${s.id === this.courante ? ' on' : ''}" data-section="${esc(s.id)}"><i>${s.icone}</i><span>${esc(s.nom)}<small>${esc(s.sous)}</small></span>${this.pastille(s)}</button>`
          )
        })
        .join('')
    if (this.courante === 'ensemble') this.peintEnsemble()
    else if (this.courante === 'tir') this.peintTir()
    else this.peintSection()
  }

  /** La pastille d'une section : verte si tout est publié, ambre si rien,
   *  grise si le magasin n'a pas répondu. */
  private pastille(s: SectionRegie): string {
    if (!this.statuts || s.domaines.length === 0) return ''
    const st = s.domaines.map((d) => this.statuts![d]).filter(Boolean)
    if (st.length === 0) return ''
    const cls = st.some((x) => x.injoignable) ? 'rg-p--muet' : st.every((x) => x.publie) ? 'rg-p--ok' : st.some((x) => x.publie) ? 'rg-p--partiel' : 'rg-p--rien'
    return `<b class="rg-p ${cls}" title="${st.every((x) => x.publie) ? 'publié pour tous' : 'le livré joue'}"></b>`
  }

  private peintEnsemble(): void {
    const pane = this.el('rg-pane')
    const lignes = this.hooks.sections
      .flatMap((s) => s.domaines.map((d) => ({ s, d })))
      .map(({ s, d }) => {
        const st = this.statuts?.[d]
        const etat = !this.statuts
          ? '<span class="rg-muet">lecture…</span>'
          : !st || st.injoignable
            ? '<span class="rg-muet">magasin injoignable</span>'
            : st.publie
              ? `<b class="rg-ok">PUBLIÉ</b> par ${esc(st.auteur || 'anonyme')}${st.date ? `, ${formateDate(st.date)}` : ''}${st.detail ? ` · ${esc(st.detail)}` : ''}`
              : `<i class="rg-rien">le livré joue</i>${st.detail ? ` · ${esc(st.detail)}` : ''}`
        return `<tr><td>${esc(st?.nom ?? d)}</td><td>${etat}</td><td><button type="button" class="rg-lien" data-section="${esc(s.id)}">${esc(s.nom)} →</button></td></tr>`
      })
      .join('')
    pane.innerHTML =
      `<h3>VUE D’ENSEMBLE <small>ce que les joueurs jouent</small></h3>` +
      `<p class="rg-texte">Le code livre, le concepteur publie, le magasin partagé joue pour tout le monde. Chaque ligne dit ce qui est publié — et sinon, c’est la version livrée avec le code qui joue. Un joueur ne voit jamais un brouillon de poste.</p>` +
      `<div class="rg-defil"><table class="rg-table"><thead><tr><th>Domaine</th><th>État</th><th>Se règle dans</th></tr></thead><tbody>${lignes}</tbody></table></div>` +
      `<div class="rg-outils"><button type="button" id="rg-relire"${this.lecture ? ' disabled' : ''}>⟳ RECHARGER</button></div>`
  }

  private peintSection(): void {
    const s = this.hooks.sections.find((x) => x.id === this.courante)
    const pane = this.el('rg-pane')
    if (!s) {
      pane.innerHTML = ''
      return
    }
    const partage = s.domaines.length
      ? `<div class="rg-partage"><span>LE PARTAGE</span>` +
        s.domaines
          .map((d) => {
            const st = this.statuts?.[d]
            if (!this.statuts) return `<p><b>${esc(d)}</b> — lecture…</p>`
            if (!st || st.injoignable) return `<p><b>${esc(st?.nom ?? d)}</b> — magasin injoignable</p>`
            return `<p><b>${esc(st.nom)}</b> — ${st.publie ? `<span class="rg-ok">publié</span> par ${esc(st.auteur || 'anonyme')}${st.date ? `, ${formateDate(st.date)}` : ''}` : '<i class="rg-rien">rien de publié, le livré joue</i>'}${st.detail ? ` · ${esc(st.detail)}` : ''}</p>`
          })
          .join('') +
        `</div>`
      : `<div class="rg-partage"><span>LE PARTAGE</span><p>Toujours partagé : la bibliothèque commune, pas de brouillon de poste.</p></div>`
    pane.innerHTML =
      `<h3><i>${s.icone}</i> ${esc(s.nom)} <small>${esc(s.sous)}</small></h3>` +
      `<p class="rg-texte">${esc(s.description)}</p>` +
      partage +
      `<div class="rg-outils"><button type="button" id="rg-ouvrir" class="primary">OUVRIR ${esc(s.nom)}</button></div>`
  }

  private peintTir(): void {
    const pane = this.el('rg-pane')
    const rangs = this.hooks.tir(this.combien)
    const reperes = reperesTirABlanc(rangs)
    const nom = (id: string | null): string => (id ? esc(id.replace(/^(recit|fin)-/, '')) : '—')
    const lignes = rangs
      .map(
        (r) =>
          `<tr class="${r.revelation ? 'rg-rev' : ''}${r.denouement ? ' rg-den' : ''}"><td>${r.run === 0 ? 'avant' : r.run}</td><td>${nom(r.fragment)}</td><td>${nom(r.fin)}</td><td>${r.fragmentsVus}</td><td>${r.finsVues}</td>` +
          `<td>${r.revelation ? '<b class="rg-ok">oui</b>' : '—'}</td><td>${r.denouement ? '<b class="rg-ok">oui</b>' : '—'}</td>` +
          `<td>${r.cines.map((c) => `<span class="rg-cine" title="${esc(c.moment)} · règle ${esc(c.regle)}">${esc(c.cine)}</span>`).join(' ') || '—'}</td></tr>`,
      )
      .join('')
    pane.innerHTML =
      `<h3>LE TIR À BLANC <small>le système de run, sans le jouer</small></h3>` +
      `<p class="rg-texte">Pour N expéditions <b>bouclées</b> d’affilée : ce que chacune révèle (le fragment du récit, la fin), les seuils qu’elle franchit (révélation, dénouement) et les cinématiques que le scénario déclenche au retour au hub puis au lancement suivant. Ce que le tir ne sait pas, il ne l’invente pas : aucun trophée ne tombe, et la révélation suppose la passerelle 4 réparée.</p>` +
      `<label class="rg-combien">EXPÉDITIONS BOUCLÉES <input type="number" id="rg-combien" min="1" max="200" value="${this.combien}"></label>` +
      `<ul class="rg-reperes">${reperes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` +
      `<div class="rg-defil"><table class="rg-table rg-table--tir"><thead><tr><th>Run</th><th>Fragment</th><th>Fin</th><th>Fragments</th><th>Fins</th><th>Révélation</th><th>Dénouement</th><th>Cinématiques</th></tr></thead><tbody>${lignes}</tbody></table></div>`
  }

  // ---- LES GESTES ------------------------------------------------------------

  private clic(e: Event): void {
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null
    if (!b || b.disabled) return
    if (b.id === 'regie-fermer') {
      this.hooks.fermer()
      return
    }
    if (b.dataset.section) {
      this.courante = b.dataset.section
      this.render()
      return
    }
    if (b.id === 'rg-relire') {
      void this.relit()
      return
    }
    if (b.id === 'rg-ouvrir') {
      this.hooks.sections.find((s) => s.id === this.courante)?.ouvre()
    }
  }

  private el(id: string): HTMLElement {
    const e = this.host.querySelector<HTMLElement>(`#${id}`)
    if (!e) throw new Error(`régie : #${id} manque dans le gabarit`)
    return e
  }
}

function formateDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function gabarit(): string {
  return (
    `<div class="rg-boite">` +
    `<header class="rg-tete"><h2>LA RÉGIE</h2><span>la console du concepteur — le système de run, d’un seul endroit</span>` +
    `<button type="button" id="regie-fermer" aria-label="Fermer la régie">✕</button></header>` +
    `<div class="rg-corps"><nav class="rg-rail" id="rg-rail"></nav><section class="rg-pane" id="rg-pane"></section></div>` +
    `</div>`
  )
}
