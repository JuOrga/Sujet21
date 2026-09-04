// L'ÉCRAN DU CODEX — la maquette « Codex v2 » du concepteur, peinte sur
// les fiches réelles.
//
// Trois colonnes : le rail des ÉTATS (un anneau de complétion chacun), la
// grille des FICHES du rayon (hexagone-glyphe, titre, verrouillées en
// « ? »), et la FICHE LUE — avec, pour une fiche connue, la VIDÉO de
// l'effet en tête du panneau (demande du concepteur : « quand on clique
// dessus, dans le panneau à droite il y a une vidéo de l'effet »). En
// tête, la progression du mode ; deux modes, FICHES et JOURNAL (le récit,
// en frise). Une fiche verrouillée montre son indice et se MARQUE comme
// objectif : l'objectif suivi s'affiche en tête, et survit au rechargement.
//
// Tout ce qui se calcule vit dans codexVue.ts (testé) ; ici, le DOM. La
// classe ne connaît ni les registres ni le Codex : elle reçoit ce qu'elle
// lit par des crochets, comme l'éditeur reçoit les biomes.

import type { CodexDef } from './codex'
import {
  ecritCibles,
  fichesDuRayon,
  formateQuand,
  indice,
  litCibles,
  progression,
  rayonsDe,
  videoDe,
  visibles,
  voisine,
  type FiltreCodex,
  type ModeCodex,
  type RayonCodex,
} from './codexVue'

export interface HooksCodex {
  connu(id: string): boolean
  /** la date ISO de découverte — vide si inconnue */
  quand(id: string): string
  /** le titre et le texte tels que le catalogue des textes les lit */
  lu(d: CodexDef): { titre: string; texte: string }
  fermer(): void
}

const esc = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const RAYON = 119.4 // le périmètre de l'anneau (r = 19)

export class EcranCodex {
  private mode: ModeCodex = 'fiches'
  private rayon: string = 'eau'
  private filtre: FiltreCodex = 'tous'
  private sel: string | null = null
  private cibles: Set<string>
  private neuve: string | null = null
  private stockage: Storage | null

  constructor(
    private host: HTMLElement,
    private hooks: HooksCodex,
  ) {
    let st: Storage | null = null
    try {
      st = localStorage
    } catch {
      st = null
    }
    this.stockage = st
    this.cibles = litCibles(st)
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

  /** Ouvre le codex — sur une fiche, s'il en est donné une : son rayon est
   *  choisi, elle est lue, et elle s'illumine le temps d'un regard. */
  open(fiche?: string): void {
    if (fiche) {
      const r = [...rayonsDe('fiches'), ...rayonsDe('journal')].find((x) =>
        fichesDuRayon(x).some((d) => d.id === fiche),
      )
      if (r) {
        this.mode = r.groupe === 'recit' ? 'journal' : 'fiches'
        this.rayon = r.id
        this.filtre = 'tous'
        this.sel = fiche
        this.neuve = fiche
      }
    }
    this.host.hidden = false
    this.render()
    if (fiche) {
      this.host.querySelector<HTMLElement>(`[data-fiche="${CSS.escape(fiche)}"]`)?.scrollIntoView({ block: 'center' })
      window.setTimeout(() => {
        this.neuve = null
        this.host.querySelectorAll('.cx-neuve').forEach((el) => el.classList.remove('cx-neuve'))
      }, 3200)
    }
  }

  close(): void {
    this.host.hidden = true
    // une vidéo qui tourne derrière un voile fermé, c'est du CPU pour rien
    this.host.querySelectorAll('video').forEach((v) => v.pause())
  }

  // ---- LE RENDU --------------------------------------------------------------

  private rayonCourant(): RayonCodex {
    const rs = rayonsDe(this.mode)
    return rs.find((r) => r.id === this.rayon) ?? rs[0]
  }

  render(): void {
    if (this.host.hidden) return
    const r = this.rayonCourant()
    this.rayon = r.id
    const liste = visibles(r, this.filtre, (id) => this.hooks.connu(id))
    if (!liste.some((d) => d.id === this.sel)) this.sel = liste[0]?.id ?? null
    this.peintTete()
    this.peintNav()
    this.peintGrille(r, liste)
    this.peintFiche(r)
  }

  private peintTete(): void {
    const p = progression(this.mode, (id) => this.hooks.connu(id))
    this.el('cx-faites').textContent = String(p.faites)
    this.el('cx-total').textContent = `/ ${p.total}`
    ;(this.el('cx-barre-plein') as HTMLElement).style.width = `${p.pct}%`
    this.el('cx-sous').textContent =
      this.mode === 'journal' ? 'LE JOURNAL DU VAISSEAU' : 'LE MANUEL ÉCRIT PAR LA PARTIE'
    // l'objectif suivi : la première cible encore verrouillée
    const cible = [...this.cibles].find((id) => !this.hooks.connu(id))
    const def = cible ? [...rayonsDe('fiches'), ...rayonsDe('journal')].flatMap(fichesDuRayon).find((d) => d.id === cible) : undefined
    const suivi = this.el('cx-suivi')
    if (def) {
      suivi.innerHTML =
        `<i>◎</i><div><span>OBJECTIF SUIVI</span><b>${esc(this.hooks.connu(def.id) ? this.hooks.lu(def).titre : indice(def))}</b></div>`
      suivi.dataset.fiche = def.id
      suivi.classList.add('on')
    } else {
      suivi.innerHTML = `<i>◎</i><div><span>AUCUN OBJECTIF</span><b>Marquez une fiche à tenter : son indice restera ici.</b></div>`
      delete suivi.dataset.fiche
      suivi.classList.remove('on')
    }
  }

  private peintNav(): void {
    const modes = this.el('cx-modes')
    modes.innerHTML = (['fiches', 'journal'] as ModeCodex[])
      .map((m) => `<button type="button" data-mode="${m}" class="${m === this.mode ? 'on' : ''}">${m === 'fiches' ? 'FICHES' : 'JOURNAL'}</button>`)
      .join('')
    const rayons = this.el('cx-rayons')
    rayons.innerHTML = rayonsDe(this.mode)
      .map((r) => {
        const fiches = fichesDuRayon(r)
        const faites = fiches.filter((d) => this.hooks.connu(d.id)).length
        const part = fiches.length ? faites / fiches.length : 0
        const on = r.id === this.rayon
        return (
          `<button type="button" class="cx-rayon${on ? ' on' : ''}${r.scelle ? ' cx-scelle' : ''}" data-rayon="${r.id}" style="--t:${r.teinte}">` +
          `<span class="cx-anneau"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19"/><circle class="cx-arc" cx="22" cy="22" r="19" stroke-dasharray="${RAYON}" stroke-dashoffset="${(RAYON * (1 - part)).toFixed(1)}"/></svg><i>${r.icone}</i></span>` +
          `<span class="cx-rayon-txt"><b>${esc(r.nom)}</b><small>${r.scelle ? 'VERROUILLÉ' : `${faites} / ${fiches.length}`}</small></span></button>`
        )
      })
      .join('')
    this.el('cx-note').textContent =
      this.mode === 'journal'
        ? 'Chaque retour au laboratoire peut révéler un fragment.'
        : 'Les ? sont des expériences à tenter. Chaque fiche se gagne en jouant.'
  }

  private peintGrille(r: RayonCodex, liste: CodexDef[]): void {
    const tete = this.el('cx-entete')
    const libelles: [FiltreCodex, string][] =
      this.mode === 'journal'
        ? [['tous', 'TOUS'], ['ok', 'RÉVÉLÉS'], ['non', 'À DÉCOUVRIR']]
        : [['tous', 'TOUS'], ['ok', 'DÉCOUVERTES'], ['non', 'À TENTER']]
    tete.innerHTML =
      `<div class="cx-entete-nom"><span style="color:${r.teinte};text-shadow:0 0 12px ${r.teinte}">${esc(r.nom)}</span><small>${esc(r.sous)}</small></div>` +
      `<div class="cx-filtres" style="--t:${r.teinte}">` +
      libelles.map(([f, l]) => `<button type="button" data-filtre="${f}" class="${f === this.filtre ? 'on' : ''}">${l}</button>`).join('') +
      `</div>`
    const grille = this.el('cx-grille')
    grille.style.setProperty('--t', r.teinte)
    if (r.scelle) {
      grille.className = 'cx-grille cx-grille--vide'
      grille.innerHTML = `<p class="cx-vide">Le quatrième état n’est pas encore joué. Le secteur reste sous clé : rien à consigner ici pour l’instant.</p>`
      return
    }
    if (liste.length === 0) {
      grille.className = 'cx-grille cx-grille--vide'
      grille.innerHTML = `<p class="cx-vide">${this.filtre === 'ok' ? 'Rien de découvert dans ce rayon — pas encore.' : 'Tout est découvert ici.'}</p>`
      return
    }
    if (this.mode === 'journal') {
      grille.className = 'cx-grille cx-frise'
      grille.innerHTML = liste
        .map((d) => {
          const ok = this.hooks.connu(d.id)
          const on = d.id === this.sel
          const lu = ok ? this.hooks.lu(d) : null
          const quand = ok ? formateQuand(this.hooks.quand(d.id)) : '?'
          return (
            `<button type="button" class="cx-fragment${ok ? '' : ' cx-verrou'}${on ? ' on' : ''}${this.neuve === d.id ? ' cx-neuve' : ''}" data-fiche="${esc(d.id)}">` +
            `<span class="cx-point"></span>` +
            `<span class="cx-tag">${ok ? 'FRAGMENT RÉVÉLÉ' : 'FRAGMENT VERROUILLÉ'}</span><span class="cx-quand">${esc(quand)}</span>` +
            `<b>${ok ? esc(lu!.titre) : '— — —'}</b>` +
            `<span class="cx-extrait">${ok ? esc(lu!.texte) : esc(indice(d))}</span></button>`
          )
        })
        .join('')
      return
    }
    grille.className = 'cx-grille'
    grille.innerHTML = liste
      .map((d) => {
        const ok = this.hooks.connu(d.id)
        const on = d.id === this.sel
        const cible = this.cibles.has(d.id)
        const lu = ok ? this.hooks.lu(d) : null
        return (
          `<button type="button" class="cx-carte${ok ? '' : ' cx-verrou'}${on ? ' on' : ''}${cible && !ok ? ' cx-cible' : ''}${this.neuve === d.id ? ' cx-neuve' : ''}" data-fiche="${esc(d.id)}">` +
          `<span class="cx-hex"><i>${ok ? d.icone : '?'}</i></span>` +
          `<b>${ok ? esc(lu!.titre) : '? ? ?'}</b>` +
          `<small>${ok ? '' : cible ? '◎ OBJECTIF' : 'à tenter'}</small></button>`
        )
      })
      .join('')
  }

  private peintFiche(r: RayonCodex): void {
    const panneau = this.el('cx-fiche')
    // les vidéos de la fiche d'avant s'arrêtent : on repeint tout le panneau
    panneau.querySelectorAll('video').forEach((v) => v.pause())
    const d = this.sel ? fichesDuRayon(r).find((x) => x.id === this.sel) : undefined
    if (!d) {
      panneau.innerHTML = `<div class="cx-fiche-vide"><span class="cx-hex cx-hex--grand"><i>${r.icone}</i></span><p>${esc(r.scelle ? 'Secteur sous clé.' : 'Choisissez une fiche.')}</p></div>` + piedFiche()
      return
    }
    const ok = this.hooks.connu(d.id)
    const lu = ok ? this.hooks.lu(d) : null
    const numero = String(fichesDuRayon(r).indexOf(d) + 1).padStart(2, '0')
    const cible = this.cibles.has(d.id)
    const video = ok
      ? `<div class="cx-video" data-video="${esc(d.id)}">` +
        `<video muted loop autoplay playsinline preload="metadata" poster="${esc(videoDe(d.id).poster)}"><source src="${esc(videoDe(d.id).src)}" type="video/webm"></video>` +
        `<span class="cx-hex cx-hex--grand"><i>${d.icone}</i></span><em>APERÇU À VENIR</em></div>`
      : `<div class="cx-video cx-video--absente cx-video--verrou"><span class="cx-hex cx-hex--grand"><i>?</i></span></div>`
    panneau.innerHTML =
      video +
      `<div class="cx-fiche-titres"><span class="cx-etiquette" style="color:${r.teinte}">${ok ? `FICHE N° ${numero}` : this.mode === 'journal' ? 'FRAGMENT VERROUILLÉ' : 'EXPÉRIENCE À TENTER'}</span>` +
      `<h3>${ok ? esc(lu!.titre) : this.mode === 'journal' ? 'FRAGMENT SOUS CLÉ' : 'FICHE VERROUILLÉE'}</h3>` +
      `<small>${esc(r.nom)}${ok && d.etat !== undefined ? ' × contact' : ''}</small></div>` +
      `<p class="cx-texte${ok ? '' : ' cx-texte--muet'}">${ok ? esc(lu!.texte) : 'Le vaisseau n’a rien consigné. Ce que le fluide fait ici reste à observer de vos propres yeux.'}</p>` +
      (ok
        ? `<div class="cx-stats"><div><span>DÉCOUVERT</span><b>${esc(formateQuand(this.hooks.quand(d.id)) || '—')}</b></div><div><span>RAYON</span><b style="color:${r.teinte}">${esc(r.nom)}</b></div></div>`
        : `<div class="cx-indice"><span>INDICE</span><p>${esc(indice(d))}</p>` +
          `<button type="button" id="cx-cibler" class="${cible ? 'on' : ''}">${cible ? '◎ OBJECTIF SUIVI' : 'MARQUER COMME OBJECTIF'}</button></div>`) +
      piedFiche()
    // la vidéo absente ne casse rien : le glyphe reste, avec « aperçu à venir »
    const v = panneau.querySelector<HTMLVideoElement>('.cx-video video')
    const boite = panneau.querySelector<HTMLElement>('.cx-video')
    if (v && boite) {
      const absente = (): void => boite.classList.add('cx-video--absente')
      v.addEventListener('error', absente)
      v.querySelector('source')?.addEventListener('error', absente)
      v.addEventListener('loadeddata', () => boite.classList.add('cx-video--prete'))
      void v.play().catch(() => {
        // lecture refusée (politique du navigateur) : le poster suffit
      })
    }
  }

  // ---- LES GESTES ------------------------------------------------------------

  private clic(e: Event): void {
    const t = e.target as HTMLElement
    const b = t.closest('button') as HTMLButtonElement | null
    const suivi = t.closest('#cx-suivi') as HTMLElement | null
    if (suivi?.dataset.fiche) {
      this.open(suivi.dataset.fiche)
      return
    }
    if (!b) return
    if (b.id === 'codex-fermer') {
      this.hooks.fermer()
      return
    }
    if (b.dataset.mode) {
      this.mode = b.dataset.mode as ModeCodex
      this.rayon = rayonsDe(this.mode)[0].id
      this.filtre = 'tous'
      this.sel = null
      this.render()
      return
    }
    if (b.dataset.rayon) {
      this.rayon = b.dataset.rayon
      this.sel = null
      this.render()
      return
    }
    if (b.dataset.filtre) {
      this.filtre = b.dataset.filtre as FiltreCodex
      this.render()
      return
    }
    if (b.dataset.fiche) {
      this.sel = b.dataset.fiche
      this.render()
      return
    }
    if (b.id === 'cx-cibler' && this.sel) {
      if (this.cibles.has(this.sel)) this.cibles.delete(this.sel)
      else this.cibles.add(this.sel)
      ecritCibles(this.stockage, this.cibles)
      this.render()
    }
  }

  private clavier(e: KeyboardEvent): void {
    if (this.host.hidden) return
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
    if (e.key === 'Escape') {
      e.stopImmediatePropagation()
      this.hooks.fermer()
      return
    }
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    const liste = visibles(this.rayonCourant(), this.filtre, (id) => this.hooks.connu(id))
    const v = voisine(liste, this.sel, e.key === 'ArrowRight' ? 1 : -1)
    if (!v) return
    e.preventDefault()
    this.sel = v.id
    this.render()
    this.host.querySelector<HTMLElement>(`[data-fiche="${CSS.escape(v.id)}"]`)?.scrollIntoView({ block: 'nearest' })
  }

  private el(id: string): HTMLElement {
    const e = this.host.querySelector<HTMLElement>(`#${id}`)
    if (!e) throw new Error(`codex : #${id} manque dans le gabarit`)
    return e
  }
}

function piedFiche(): string {
  return `<div class="cx-pied"><span>◀ ▶ NAVIGUER</span><span>ÉCHAP FERMER</span></div>`
}

function gabarit(): string {
  return (
    `<div class="cx-boite">` +
    `<header class="cx-tete">` +
    `<div class="cx-titres"><div class="cx-titre-ligne"><h2>CODEX DU PROTOCOLE</h2><span id="cx-sous"></span></div>` +
    `<div class="cx-progression"><div class="cx-compte"><b id="cx-faites">0</b><small id="cx-total">/ 0</small></div>` +
    `<div class="cx-barre"><i id="cx-barre-plein"></i><u style="left:25%"></u><u style="left:50%"></u><u style="left:75%"></u></div></div></div>` +
    `<button type="button" id="cx-suivi" class="cx-suivi"></button>` +
    `<button type="button" id="codex-fermer" aria-label="Fermer le codex">✕</button>` +
    `</header>` +
    `<div class="cx-corps">` +
    `<nav class="cx-nav"><div class="cx-modes" id="cx-modes"></div><div id="cx-rayons" class="cx-rayons"></div><p class="cx-note" id="cx-note"></p></nav>` +
    `<section class="cx-centre"><div class="cx-entete" id="cx-entete"></div><div class="cx-defil"><div id="cx-grille" class="cx-grille"></div></div></section>` +
    `<aside class="cx-fiche" id="cx-fiche"></aside>` +
    `</div></div>`
  )
}
