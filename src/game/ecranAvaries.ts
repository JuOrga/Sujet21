// L'ÉCRAN DU TABLEAU DES AVARIES — le dessin du codex et du marchand
// (maquettes « Codex v2 » et « Marchand v2 »), peint sur l'état réel du
// module Méduse.
//
// Trois colonnes : le rail des SECTEURS (tout le module, l'énergie, les
// consoles, les accès — un anneau de complétion chacun), la grille des
// STATIONS du secteur (une carte par station, un filtre en pastilles), et
// la FICHE de la station lue : son illustration, éteinte tant qu'elle est
// en panne, ce qu'elle rend, ce que la panne fait, le prix, le solde
// après réparation — et la CONSIGNE. En tête, la progression du module et
// la bourse : la mémoire, seule monnaie de la réparation. En pied, la
// légende manette : croix pour parcourir, LB/RB pour le secteur, X pour
// le filtre, B pour quitter — A ne fait rien ici, et la légende le dit.
//
// CE N'EST PAS UNE BOUTIQUE : la réparation se paie AU CONTACT du plot de
// la station (main.ts, tenteReparation). Cet écran dit où l'on en est et où
// aller — il ne débite jamais. Tout ce qui se calcule vit dans
// avariesVue.ts (testé) ; ici, le DOM. La classe ne connaît pas les
// registres : elle reçoit ce qu'elle lit, par des crochets — comme le
// codex et le marchand.

import {
  FILTRES_AVARIES,
  SECTEURS,
  apresReparation,
  badge,
  compteSecteur,
  consigne,
  etatCourt,
  filtre,
  filtreSuivant,
  imageDe,
  libellePrix,
  partRetablie,
  retablie,
  secteur,
  stations,
  stationsDuSecteur,
  type EtatAvaries,
  type FiltreAvaries,
  type SecteurId,
  type StationVue,
} from './avariesVue'
import {
  PiloteEcran,
  colonnesDe,
  gesteClavier,
  legendeHTML,
  voisinGrille,
  type Geste,
  type LectureManette,
} from './padEcran'

export interface HooksAvaries {
  /** l'instantané des registres — relu à chaque rendu */
  registres(): EtatAvaries
  fermer(): void
  /** une manette est branchée : la légende parle ses boutons */
  manette(): boolean
}

const esc = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// le périmètre de l'anneau du rail (r = 19), comme au codex
const RAYON = 119.4

export class EcranAvaries {
  private secteur: SecteurId = 'tout'
  private filtre: FiltreAvaries = 'toutes'
  private sel: string | null = null
  private pilote = new PiloteEcran()
  private legendeManette: boolean | null = null

  constructor(
    private host: HTMLElement,
    private hooks: HooksAvaries,
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

  /** Ouvre le tableau — rendu à l'ouverture, jamais un état périmé (la
   *  mémoire dépensée entre deux visites, une station rétablie depuis). */
  open(): void {
    this.host.hidden = false
    this.render()
  }

  close(): void {
    this.host.hidden = true
  }

  // ---- LE RENDU --------------------------------------------------------------

  private liste(): StationVue[] {
    return filtre(stationsDuSecteur(this.secteur, this.hooks.registres()), this.filtre)
  }

  render(): void {
    if (this.host.hidden) return
    const s = this.hooks.registres()
    const liste = this.liste()
    if (!liste.some((st) => st.id === this.sel)) this.sel = liste[0]?.id ?? null
    const sel = liste.find((st) => st.id === this.sel) ?? null
    this.peintTete(s)
    this.peintNav(s)
    this.peintGrille(liste)
    this.peintFiche(sel, s.memoire)
    this.peintLegende()
  }

  private peintTete(s: EtatAvaries): void {
    const toutes = stations(s)
    const faites = toutes.filter(retablie).length
    this.el('av-faites').textContent = String(faites)
    this.el('av-total').textContent = `/ ${toutes.length}`
    this.el('av-barre-plein').style.width = `${(partRetablie(toutes) * 100).toFixed(1)}%`
    this.el('av-memoire').textContent = String(s.memoire)
    // le module entier rétabli : la tête le dit, en vert
    this.el('av-progression').classList.toggle('av-complet', faites === toutes.length && toutes.length > 0)
  }

  private peintNav(s: EtatAvaries): void {
    const rail = this.el('av-secteurs')
    // Le rail existe déjà : on le retouche EN PLACE (le secteur lu, l'arc,
    // le compte) plutôt que de le rebâtir — rebâti, l'anneau sautait à sa
    // nouvelle part au lieu d'y glisser, la transition CSS ne servait à rien
    const boutons = rail.querySelectorAll<HTMLButtonElement>('button[data-secteur]')
    if (boutons.length === SECTEURS.length) {
      boutons.forEach((b, i) => {
        const sec = SECTEURS[i]
        const liste = stationsDuSecteur(sec.id, s)
        b.classList.toggle('on', sec.id === this.secteur)
        b.querySelector<SVGCircleElement>('.av-arc')?.setAttribute('stroke-dashoffset', (RAYON * (1 - partRetablie(liste))).toFixed(1))
        const compte = b.querySelector('small')
        if (compte) compte.textContent = compteSecteur(liste)
      })
      return
    }
    rail.innerHTML = SECTEURS.map((sec) => {
      const liste = stationsDuSecteur(sec.id, s)
      const part = partRetablie(liste)
      const on = sec.id === this.secteur
      return (
        `<button type="button" class="av-secteur${on ? ' on' : ''}" data-secteur="${sec.id}" style="--t:${sec.teinte}">` +
        `<span class="av-anneau"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19"/><circle class="av-arc" cx="22" cy="22" r="19" stroke-dasharray="${RAYON}" stroke-dashoffset="${(RAYON * (1 - part)).toFixed(1)}"/></svg><i>${sec.icone}</i></span>` +
        `<span class="av-secteur-txt"><b>${esc(sec.nom)}</b><small>${esc(compteSecteur(liste))}</small></span></button>`
      )
    }).join('')
  }

  private peintGrille(liste: StationVue[]): void {
    const sec = secteur(this.secteur)
    this.el('av-entete').innerHTML =
      `<div class="av-entete-nom"><span style="color:${sec.teinte};text-shadow:0 0 12px ${sec.teinte}">${esc(sec.nom)}</span><small>${esc(sec.sous)}</small></div>` +
      `<div class="av-filtres" style="--t:${sec.teinte}">` +
      FILTRES_AVARIES.map(
        ([f, l]) => `<button type="button" data-filtre="${f}" class="${f === this.filtre ? 'on' : ''}">${l}</button>`,
      ).join('') +
      `</div>`
    const grille = this.el('av-grille')
    grille.style.setProperty('--t', sec.teinte)
    if (liste.length === 0) {
      grille.className = 'av-grille av-grille--vide'
      grille.innerHTML = `<p class="av-vide">${
        this.filtre === 'pannes'
          ? 'Rien en panne ici — le secteur est debout.'
          : this.filtre === 'retablies'
            ? 'Rien de rétabli dans ce secteur — pas encore.'
            : 'Aucune station dans ce secteur.'
      }</p>`
      return
    }
    grille.className = 'av-grille'
    grille.innerHTML = liste
      .map((st) => {
        const on = st.id === this.sel
        const ok = retablie(st)
        const t = secteur(st.secteur).teinte
        return (
          `<button type="button" class="av-station${on ? ' on' : ''}${ok ? ' av-ok' : ' av-panne'}${st.etat === 'solde-court' ? ' av-court' : ''}" data-station="${esc(st.id)}" style="--t:${t}">` +
          `<span class="av-station-tete"><i>${st.icone}</i><span><b>${esc(st.nom)}</b><small>${esc(secteur(st.secteur).nom)} · N° ${String(st.rang).padStart(2, '0')}</small></span></span>` +
          `<span class="av-station-txt">${esc(st.detail)}</span>` +
          `<span class="av-badge${ok ? ' av-badge--ok' : st.etat === 'solde-court' ? ' av-badge--court' : ' av-badge--panne'}">${esc(badge(st))}</span>` +
          `<span class="av-station-pied"><u class="${st.etat === 'solde-court' ? 'av-rouge' : ''}">${ok ? '—' : libellePrix(st.prix)}</u><em class="${st.etat === 'solde-court' ? 'av-rouge' : ok ? 'av-vert' : ''}">${esc(etatCourt(st))}</em></span>` +
          `</button>`
        )
      })
      .join('')
  }

  private peintFiche(st: StationVue | null, memoire: number): void {
    const panneau = this.el('av-fiche')
    const sec = secteur(this.secteur)
    if (!st) {
      panneau.innerHTML = `<div class="av-fiche-vide"><span class="av-apercu av-apercu--absente" style="--t:${sec.teinte}"><i>${sec.icone}</i></span><p>Choisissez une station.</p></div>`
      return
    }
    const ok = retablie(st)
    const t = secteur(st.secteur).teinte
    const c = consigne(st, memoire)
    const classeConsigne = ok ? 'av-consigne--fait' : st.etat === 'payable' ? 'av-consigne--ok' : 'av-consigne--non'
    panneau.innerHTML =
      // l'illustration : la même image, éteinte tant que la station est en
      // panne, allumée une fois rétablie — absente, le glyphe reste
      `<div class="av-apercu${ok ? ' av-apercu--allume' : ' av-apercu--panne'}" style="--t:${t}"><img src="${esc(imageDe(st.id))}" alt="" decoding="async"><i>${st.icone}</i><small>${esc(secteur(st.secteur).nom)}</small><em>${ok ? 'RÉTABLIE' : 'EN PANNE'}</em></div>` +
      `<div class="av-fiche-titres"><span class="av-etiquette" style="color:${t}">STATION N° ${String(st.rang).padStart(2, '0')} · ${esc(secteur(st.secteur).nom)}</span><h3>${esc(st.nom)}</h3></div>` +
      `<div class="av-bloc av-bloc--rend"><span>CE QU’ELLE REND</span><p>${esc(st.detail)}</p></div>` +
      `<div class="av-bloc${ok ? ' av-bloc--passe' : ' av-bloc--panne'}"><span>${ok ? 'CE QUE FAISAIT LA PANNE' : 'TANT QU’ELLE EST EN PANNE'}</span><ul>${st.effets.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` +
      `<div class="av-stats"><div><span>PRIX</span><b class="${ok ? '' : 'av-or'}">${ok ? 'payé' : esc(libellePrix(st.prix))}</b></div>` +
      `<div><span>APRÈS RÉPARATION</span><b class="${st.etat === 'solde-court' ? 'av-rouge' : ok ? 'av-vert' : ''}">${esc(apresReparation(st, memoire))}</b></div></div>` +
      `<div class="av-consigne ${classeConsigne}"><b>${esc(c.titre)}</b><small>${esc(c.note)}</small></div>`
    // l'image absente ne casse rien : le glyphe reste, l'état aussi
    const boite = panneau.querySelector<HTMLElement>('.av-apercu')
    const img = boite?.querySelector('img')
    if (boite && img) {
      img.addEventListener('error', () => boite.classList.add('av-apercu--absente'))
      img.addEventListener('load', () => boite.classList.add('av-apercu--prete'))
      if (img.complete && img.naturalWidth > 0) boite.classList.add('av-apercu--prete')
    }
  }

  private peintLegende(): void {
    const manette = this.hooks.manette()
    this.legendeManette = manette
    this.el('av-legende').innerHTML = legendeHTML(
      [
        { b: 'LBRB', t: 'SECTEUR' },
        { b: 'CROIX', t: 'PARCOURIR' },
        { b: 'A', t: '' }, // rien à acheter ici : la réparation se paie au plot
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
    if (b.id === 'repar-fermer') {
      this.hooks.fermer()
      return
    }
    if (b.dataset.secteur) {
      this.choisitSecteur(b.dataset.secteur as SecteurId)
      return
    }
    if (b.dataset.filtre) {
      this.filtre = b.dataset.filtre as FiltreAvaries
      this.render()
      return
    }
    if (b.dataset.station) {
      this.sel = b.dataset.station
      this.render()
    }
  }

  private choisitSecteur(id: SecteurId): void {
    this.secteur = id
    this.filtre = 'toutes'
    this.sel = null
    this.render()
  }

  /** Un geste du schéma — manette ou clavier, le même aiguillage. */
  private geste(g: Geste): void {
    switch (g) {
      case 'B':
        this.hooks.fermer()
        return
      case 'A':
      case 'Y':
        return // rien à acheter, rien à basculer : la console ne fait que dire
      case 'X':
        this.filtre = filtreSuivant(this.filtre)
        this.render()
        return
      case 'LB':
      case 'RB': {
        const i = SECTEURS.findIndex((s) => s.id === this.secteur)
        const n = SECTEURS.length
        this.choisitSecteur(SECTEURS[(i + (g === 'RB' ? 1 : -1) + n) % n].id)
        return
      }
      default: {
        const liste = this.liste()
        const i = liste.findIndex((st) => st.id === this.sel)
        const dx = g === 'gauche' ? -1 : g === 'droite' ? 1 : 0
        const dy = g === 'haut' ? -1 : g === 'bas' ? 1 : 0
        const v = voisinGrille(liste.length, i, dx, dy, colonnesDe(this.host.querySelector('#av-grille')))
        if (v === null) return
        this.sel = liste[v].id
        this.render()
        this.host.querySelector<HTMLElement>(`[data-station="${CSS.escape(this.sel)}"]`)?.scrollIntoView({ block: 'nearest' })
      }
    }
  }

  /** La manette, une image : relevée par la boucle de jeu (main.ts) tant
   *  que l'écran est au-dessus. */
  manette(m: LectureManette, now: number): void {
    if (this.host.hidden) return
    for (const g of this.pilote.lit(m, now)) this.geste(g)
    // la manette vient d'être branchée (ou débranchée) : la légende change de langue
    if (this.legendeManette !== this.hooks.manette()) this.peintLegende()
  }

  private clavier(e: KeyboardEvent): void {
    if (this.host.hidden) return
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
    const g = gesteClavier(e.key)
    if (!g) return
    // A ne fait rien sur cette console : Entrée sur un bouton focalisé
    // (Tab jusqu'au ✕, à une station) doit rester le clic natif — au
    // marchand, A achète, la touche a un sens ; ici elle serait avalée
    if (g === 'A' && t && t.tagName === 'BUTTON' && this.host.contains(t)) return
    e.preventDefault()
    e.stopImmediatePropagation()
    this.geste(g)
  }

  private el(id: string): HTMLElement {
    const e = this.host.querySelector<HTMLElement>(`#${id}`)
    if (!e) throw new Error(`avaries : #${id} manque dans le gabarit`)
    return e
  }
}

function gabarit(): string {
  return (
    `<div class="av-boite">` +
    `<header class="av-tete">` +
    `<div class="av-identite"><span class="av-avatar"><i>⚠</i></span>` +
    `<div class="av-titres"><div class="av-titre-ligne"><h2>TABLEAU DES AVARIES</h2><span>L’ÉTAT DU MODULE MÉDUSE</span></div>` +
    `<p>« L’accident du télescope a laissé le module en panne. Ce tableau ne répare rien : chaque station se remet en état au contact de son plot. »</p></div></div>` +
    `<div class="av-progression" id="av-progression"><div class="av-compte"><b id="av-faites">0</b><small id="av-total">/ 0</small></div>` +
    `<div class="av-barre"><i id="av-barre-plein"></i></div><span class="av-progression-txt">STATIONS RÉTABLIES</span></div>` +
    `<div class="av-bourse"><i>◈</i><div><span>MÉMOIRE</span><b id="av-memoire">0</b></div></div>` +
    `<button type="button" id="repar-fermer" aria-label="Fermer le tableau des avaries">✕</button>` +
    `</header>` +
    `<div class="av-corps">` +
    `<nav class="av-nav"><div id="av-secteurs" class="av-secteurs"></div><p class="av-note">La réparation se paie au plot de la station, en mémoire — la monnaie qui survit à la purge.</p></nav>` +
    `<section class="av-centre"><div class="av-entete" id="av-entete"></div><div class="av-defil"><div id="av-grille" class="av-grille"></div></div></section>` +
    `<aside class="av-fiche" id="av-fiche"></aside>` +
    `</div>` +
    `<footer class="pe-legende" id="av-legende"></footer>` +
    `</div>`
  )
}
