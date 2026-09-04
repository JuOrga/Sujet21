// L'ÉCRAN DU MARCHAND — la maquette « Marchand v2 » du concepteur, peinte
// sur l'étal réel du hub.
//
// Trois colonnes : le rail des RAYONS (orbes, améliorations, provisions —
// ce que le marchand vend, rien d'autre), l'ÉTAL du rayon (une carte par
// article, un filtre en pastilles), et la FICHE de l'article lu, avec le
// bouton d'achat. En tête, la bourse : la mémoire, seule monnaie ici, et
// les orbes en poche. En pied, la légende manette : croix pour parcourir,
// LB/RB pour changer de rayon, A pour acheter, X pour le filtre, B pour
// quitter — au clavier, flèches, Q/E, ⏎, F, Échap.
//
// Tout ce qui se calcule vit dans marchandVue.ts (testé) ; ici, le DOM.
// La classe ne connaît ni les registres ni la caisse : elle reçoit ce
// qu'elle lit, et remet l'achat à main.ts, par des crochets — comme le
// codex.

import {
  FILTRES_MARCHAND,
  RAYONS_MARCHAND,
  achetable,
  apresAchat,
  articlesDuRayon,
  badge,
  compteRayon,
  etatCourt,
  filtre,
  filtreSuivant,
  libelleBouton,
  libellePrix,
  rayonMarchand,
  tenu,
  type ArticleMarchand,
  type EtatRegistres,
  type FiltreMarchand,
  type RayonMarchandId,
} from './marchandVue'
import {
  PiloteEcran,
  colonnesDe,
  gesteClavier,
  legendeHTML,
  voisinGrille,
  type Geste,
  type LectureManette,
} from './padEcran'

export interface HooksMarchand {
  /** l'instantané des registres — relu à chaque rendu */
  registres(): EtatRegistres
  /** tente l'achat : débite, applique, sonne — false : la caisse a refusé */
  achete(a: ArticleMarchand): boolean
  fermer(): void
  /** une manette est branchée : la légende parle ses boutons */
  manette(): boolean
}

const esc = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export class EcranMarchand {
  private rayon: RayonMarchandId = 'orbes'
  private filtre: FiltreMarchand = 'tous'
  private sel: string | null = null
  private pilote = new PiloteEcran()
  private legendeManette: boolean | null = null

  constructor(
    private host: HTMLElement,
    private hooks: HooksMarchand,
  ) {
    host.innerHTML = gabarit()
    host.addEventListener('click', (e) => this.clic(e))
    host.addEventListener('pointerdown', (e) => {
      if (e.target === host) this.hooks.fermer()
    })
    window.addEventListener('keydown', (e) => this.clavier(e))
  }

  get visible(): boolean {
    return !this.host.hidden
  }

  open(): void {
    this.host.hidden = false
    this.render()
  }

  close(): void {
    this.host.hidden = true
  }

  // ---- LE RENDU --------------------------------------------------------------

  private liste(): ArticleMarchand[] {
    return filtre(articlesDuRayon(this.rayon, this.hooks.registres()), this.filtre)
  }

  render(): void {
    if (this.host.hidden) return
    const s = this.hooks.registres()
    const liste = this.liste()
    if (!liste.some((a) => a.id === this.sel)) this.sel = liste[0]?.id ?? null
    const sel = liste.find((a) => a.id === this.sel) ?? null
    this.el('mr-memoire').textContent = String(s.memoire)
    this.el('mr-orbes').textContent = String(s.orbes.length)
    this.peintNav(s)
    this.peintEtal(liste)
    this.peintFiche(sel, s.memoire)
    this.peintLegende(sel)
  }

  private peintNav(s: EtatRegistres): void {
    this.el('mr-rayons').innerHTML = RAYONS_MARCHAND.map((r) => {
      const on = r.id === this.rayon
      return (
        `<button type="button" class="mr-rayon${on ? ' on' : ''}" data-rayon="${r.id}" style="--t:${r.teinte}">` +
        `<span class="mr-rayon-ico"><i>${r.icone}</i></span>` +
        `<span class="mr-rayon-txt"><b>${esc(r.nom)}</b><small>${esc(compteRayon(articlesDuRayon(r.id, s)))}</small></span></button>`
      )
    }).join('')
  }

  private peintEtal(liste: ArticleMarchand[]): void {
    const r = rayonMarchand(this.rayon)
    this.el('mr-entete').innerHTML =
      `<div class="mr-entete-nom"><span style="color:${r.teinte};text-shadow:0 0 12px ${r.teinte}">${esc(r.nom)}</span><small>${esc(r.sous)}</small></div>` +
      `<div class="mr-filtres" style="--t:${r.teinte}">` +
      FILTRES_MARCHAND.map(
        ([f, l]) => `<button type="button" data-filtre="${f}" class="${f === this.filtre ? 'on' : ''}">${l}</button>`,
      ).join('') +
      `</div>`
    const grille = this.el('mr-grille')
    grille.style.setProperty('--t', r.teinte)
    if (liste.length === 0) {
      grille.className = 'mr-grille mr-grille--vide'
      grille.innerHTML = `<p class="mr-vide">${
        this.filtre === 'ok'
          ? 'Rien d’abordable ici — la mémoire se gagne en descendant.'
          : this.filtre === 'tenus'
            ? 'Rien d’acquis dans ce rayon — pas encore.'
            : 'L’étal est vide.'
      }</p>`
      return
    }
    grille.className = 'mr-grille'
    grille.innerHTML = liste
      .map((a) => {
        const on = a.id === this.sel
        const b = badge(a)
        return (
          `<button type="button" class="mr-article${on ? ' on' : ''}${tenu(a) ? ' mr-tenu' : ''}${a.etat === 'trop-cher' ? ' mr-cher' : ''}" data-article="${esc(a.id)}">` +
          `<span class="mr-article-tete"><i>${a.icone}</i><span><b>${esc(a.nom)}</b><small>${esc(r.nom)}</small></span></span>` +
          `<span class="mr-article-txt">${esc(a.detail)}</span>` +
          `<span class="mr-badge${b ? '' : ' mr-badge--vide'}">${esc(b)}</span>` +
          `<span class="mr-article-pied"><u class="${a.etat === 'trop-cher' ? 'mr-rouge' : ''}">${tenu(a) ? '—' : libellePrix(a.prix)}</u><em class="${a.etat === 'trop-cher' ? 'mr-rouge' : tenu(a) ? 'mr-vert' : ''}">${esc(etatCourt(a))}</em></span>` +
          `</button>`
        )
      })
      .join('')
  }

  private peintFiche(a: ArticleMarchand | null, memoire: number): void {
    const panneau = this.el('mr-fiche')
    const r = rayonMarchand(this.rayon)
    if (!a) {
      panneau.innerHTML = `<div class="mr-fiche-vide"><span class="mr-apercu" style="--t:${r.teinte}"><i>${r.icone}</i></span><p>Choisissez un article.</p></div>`
      return
    }
    const b = badge(a)
    const ok = achetable(a)
    panneau.innerHTML =
      `<div class="mr-apercu" style="--t:${r.teinte}"><i>${a.icone}</i><small>${esc(r.nom)}</small></div>` +
      `<div class="mr-fiche-titres"><span class="mr-etiquette" style="color:${r.teinte}">${esc(r.nom)}${b ? ` · ${esc(b)}` : ''}</span><h3>${esc(a.nom)}</h3></div>` +
      `<p class="mr-texte">${esc(a.detail)}</p>` +
      `<div class="mr-stats"><div><span>TENUE</span><b class="mr-vert">${esc(r.tenue)}</b></div>` +
      `<div><span>APRÈS ACHAT</span><b class="${a.etat === 'trop-cher' ? 'mr-rouge' : ''}">${esc(apresAchat(a, memoire))}</b></div></div>` +
      `<button type="button" id="mr-acheter" class="${ok ? 'mr-ok' : tenu(a) ? 'mr-fait' : 'mr-non'}"${ok ? '' : ' disabled'}>${esc(libelleBouton(a))}</button>`
  }

  private peintLegende(sel: ArticleMarchand | null): void {
    const manette = this.hooks.manette()
    this.legendeManette = manette
    this.el('mr-legende').innerHTML = legendeHTML(
      [
        { b: 'LBRB', t: 'RAYON' },
        { b: 'CROIX', t: 'PARCOURIR' },
        { b: 'A', t: sel && achetable(sel) ? 'ACHETER' : '' },
        { b: 'X', t: 'FILTRE' },
        { b: 'B', t: 'QUITTER' },
      ],
      manette,
    )
  }

  // ---- LES GESTES ------------------------------------------------------------

  private clic(e: Event): void {
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null
    if (!b) return
    if (b.id === 'marchand-fermer') {
      this.hooks.fermer()
      return
    }
    if (b.dataset.rayon) {
      this.choisitRayon(b.dataset.rayon as RayonMarchandId)
      return
    }
    if (b.dataset.filtre) {
      this.filtre = b.dataset.filtre as FiltreMarchand
      this.render()
      return
    }
    if (b.dataset.article) {
      this.sel = b.dataset.article
      this.render()
      return
    }
    if (b.id === 'mr-acheter') this.achete()
  }

  private choisitRayon(id: RayonMarchandId): void {
    this.rayon = id
    this.filtre = 'tous'
    this.sel = null
    this.render()
  }

  private achete(): void {
    const a = this.liste().find((x) => x.id === this.sel)
    if (!a || !achetable(a)) return
    if (this.hooks.achete(a)) this.render()
  }

  /** Un geste du schéma — manette ou clavier, le même aiguillage. */
  private geste(g: Geste): void {
    switch (g) {
      case 'B':
        this.hooks.fermer()
        return
      case 'A':
        this.achete()
        return
      case 'X':
        this.filtre = filtreSuivant(this.filtre)
        this.render()
        return
      case 'Y':
        return // pas de renouvellement d'étal ici : l'étal du hub est fixe
      case 'LB':
      case 'RB': {
        const i = RAYONS_MARCHAND.findIndex((r) => r.id === this.rayon)
        const n = RAYONS_MARCHAND.length
        this.choisitRayon(RAYONS_MARCHAND[(i + (g === 'RB' ? 1 : -1) + n) % n].id)
        return
      }
      default: {
        const liste = this.liste()
        const i = liste.findIndex((a) => a.id === this.sel)
        const dx = g === 'gauche' ? -1 : g === 'droite' ? 1 : 0
        const dy = g === 'haut' ? -1 : g === 'bas' ? 1 : 0
        const v = voisinGrille(liste.length, i, dx, dy, colonnesDe(this.host.querySelector('#mr-grille')))
        if (v === null) return
        this.sel = liste[v].id
        this.render()
        this.host.querySelector<HTMLElement>(`[data-article="${CSS.escape(this.sel)}"]`)?.scrollIntoView({ block: 'nearest' })
      }
    }
  }

  /** La manette, une image : relevée par la boucle de jeu (main.ts) tant
   *  que l'écran est au-dessus. */
  manette(m: LectureManette, now: number): void {
    if (this.host.hidden) return
    for (const g of this.pilote.lit(m, now)) this.geste(g)
    // la manette vient d'être branchée (ou débranchée) : la légende change de langue
    if (this.legendeManette !== this.hooks.manette()) this.peintLegende(this.liste().find((a) => a.id === this.sel) ?? null)
  }

  private clavier(e: KeyboardEvent): void {
    if (this.host.hidden) return
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
    const g = gesteClavier(e.key)
    if (!g) return
    e.preventDefault()
    e.stopImmediatePropagation()
    this.geste(g)
  }

  private el(id: string): HTMLElement {
    const e = this.host.querySelector<HTMLElement>(`#${id}`)
    if (!e) throw new Error(`marchand : #${id} manque dans le gabarit`)
    return e
  }
}

function gabarit(): string {
  return (
    `<div class="mr-boite">` +
    `<header class="mr-tete">` +
    `<div class="mr-identite"><span class="mr-avatar"><i>◉</i></span>` +
    `<div class="mr-titres"><div class="mr-titre-ligne"><h2>LE MARCHAND</h2><span>LE SEMBLABLE DU COMPTOIR</span></div>` +
    `<p>« Le condensat ne survit pas à la run. Ce qui dure se paie en mémoire. »</p></div></div>` +
    `<div class="mr-bourses">` +
    `<div class="mr-bourse mr-bourse--memoire"><i>◈</i><div><span>MÉMOIRE</span><b id="mr-memoire">0</b></div></div>` +
    `<div class="mr-bourse mr-bourse--orbes"><i>🔮</i><div><span>ORBES EN POCHE</span><b id="mr-orbes">0</b></div></div>` +
    `</div>` +
    `<button type="button" id="marchand-fermer" aria-label="Fermer le marchand">✕</button>` +
    `</header>` +
    `<div class="mr-corps">` +
    `<nav class="mr-nav"><div id="mr-rayons" class="mr-rayons"></div><p class="mr-note">Les orbes se dépensent à l’écran des mémoires ; les provisions ne valent qu’une descente.</p></nav>` +
    `<section class="mr-centre"><div class="mr-entete" id="mr-entete"></div><div class="mr-defil"><div id="mr-grille" class="mr-grille"></div></div></section>` +
    `<aside class="mr-fiche" id="mr-fiche"></aside>` +
    `</div>` +
    `<footer class="pe-legende" id="mr-legende"></footer>` +
    `</div>`
  )
}
