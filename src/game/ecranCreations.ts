// L'ÉCRAN CRÉATIONS (lot 6, docs/atelier-joueur.md) : les salles que les
// joueurs ont bâties et partagées, jouées HORS de l'expédition — ni mémoire,
// ni orbe, ni trophée : seul le record compte, et il se range avec la salle
// (api/_creations.ts), jamais dans le palmarès officiel.
//
// Il ne connaît ni le jeu ni la partie : il lit par le réseau (netCreations)
// et rend la main par ses crochets — jouer une salle, ouvrir l'atelier,
// fermer. Ce qu'il affiche se décide dans creationsVue.ts, que le banc tient.

import type { LevelDef } from './level'
import { parseLevel } from './levelIO'
import {
  fetchCreation,
  fetchCreations,
  mesCreations,
  raisonCreation,
  retireCreation,
  type CreationComplete,
  type CreationListee,
  type RecordsCreation,
} from './netCreations'
import {
  ONGLETS_CREATIONS,
  libelleMeilleur,
  lignesClassement,
  listeAffichee,
  quandRelatif,
  type OngletCreations,
} from './creationsVue'

export interface HooksCreations {
  /** Jouer une création : la salle (lue par parseLevel) et ce qu'il faut
   *  pour y déposer un record. */
  jouer(level: LevelDef, creation: { id: string; empreinte: string }): void
  /** Ouvrir l'atelier pour en bâtir une. */
  creer(): void
  fermer(): void
  /** Le nom d'opérateur du poste : sa ligne de record se surligne. */
  operateur(): string
}

const esc = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Les couleurs des matières sur la vignette — celles de la légende de
 *  l'éditeur, en plus sobre : on reconnaît la salle, on ne la lit pas. */
const TEINTES: Record<number, string> = {
  0: '#4a6b80', 1: '#2ec6c9', 2: '#a878e8', 4: '#8fc8ee', 5: '#8fb0c6', 6: '#ff8a3c',
  7: '#35c9a0', 8: '#9fb9d8', 9: '#29d8ff', 10: '#b8c8dc', 11: '#1a2a44', 12: '#5a7fb0',
}

export class EcranCreations {
  private onglet: OngletCreations = 'recentes'
  private liste: CreationListee[] | null = null
  private erreurListe = ''
  private choisie: string | null = null
  private detail: { creation: CreationComplete; records: RecordsCreation; level: LevelDef | null } | null = null
  private chargeDetail = false

  constructor(
    private readonly host: HTMLElement,
    private readonly hooks: HooksCreations,
  ) {
    host.addEventListener('click', (e) => this.clic(e))
  }

  get visible(): boolean {
    return !this.host.hidden
  }

  /** Ouvre l'écran et relit la liste (une publication récente doit y être). */
  open(): void {
    this.host.hidden = false
    this.liste = null
    this.erreurListe = ''
    this.render()
    void this.relit()
  }

  close(): void {
    this.host.hidden = true
  }

  private async relit(): Promise<void> {
    const l = await fetchCreations()
    this.liste = l ?? []
    this.erreurListe = l === null ? raisonCreation() || 'Les créations sont injoignables pour l’instant.' : ''
    const visibles = listeAffichee(this.liste, this.onglet, mesCreations())
    if (!this.choisie || !visibles.some((c) => c.id === this.choisie)) this.choisie = visibles[0]?.id ?? null
    this.render()
    if (this.choisie) void this.charge(this.choisie)
  }

  private async charge(id: string): Promise<void> {
    this.chargeDetail = true
    this.render()
    const d = await fetchCreation(id)
    if (this.choisie !== id) return // un autre choix est passé entre-temps
    this.chargeDetail = false
    this.detail = d ? { ...d, level: parseLevel(d.creation.salle).level } : null
    this.render()
  }

  private clic(e: Event): void {
    const b = (e.target as HTMLElement).closest<HTMLElement>('button, [data-creation]')
    if (!b) {
      if (e.target === this.host) this.hooks.fermer()
      return
    }
    if (b.id === 'cr-fermer') return this.hooks.fermer()
    if (b.id === 'cr-creer') return this.hooks.creer()
    if (b.dataset.onglet) {
      this.onglet = b.dataset.onglet as OngletCreations
      this.choisie = null
      void this.relit()
      return
    }
    if (b.dataset.creation) {
      this.choisie = b.dataset.creation
      this.detail = null
      void this.charge(b.dataset.creation)
      return
    }
    if (b.id === 'cr-jouer' && this.detail?.level) {
      const c = this.detail.creation
      this.hooks.jouer(this.detail.level, { id: c.id, empreinte: c.empreinte })
      return
    }
    if (b.id === 'cr-retirer' && this.detail) {
      const c = this.detail.creation
      if (!confirm(`Retirer « ${c.nom} » des créations ? Elle ne sera plus jouable en ligne (elle reste dans votre atelier).`)) return
      void retireCreation(c.id).then((ok) => {
        if (!ok) {
          alert(`Le retrait a échoué : ${raisonCreation() || 'serveur injoignable'}.`)
          return
        }
        this.detail = null
        this.choisie = null
        void this.relit()
      })
    }
  }

  render(): void {
    if (this.host.hidden) return
    const miennes = mesCreations()
    const visibles = this.liste ? listeAffichee(this.liste, this.onglet, miennes) : []
    const cartes =
      this.liste === null
        ? '<p class="cr-vide">Lecture des créations…</p>'
        : this.erreurListe
          ? `<p class="cr-vide">${esc(this.erreurListe)}</p>`
          : visibles.length === 0
            ? `<p class="cr-vide">${this.onglet === 'miennes' ? 'Vous n’avez encore rien partagé depuis ce poste. Une salle se partage quand vous atteignez sa sortie dans l’atelier.' : 'Aucune création pour l’instant : soyez le premier.'}</p>`
            : visibles
                .map(
                  (c) =>
                    `<button type="button" class="cr-carte${c.id === this.choisie ? ' on' : ''}" data-creation="${esc(c.id)}" aria-pressed="${c.id === this.choisie}">` +
                    `<b>${esc(c.nom)}</b><span>par ${esc(c.auteur)} · ${esc(quandRelatif(c.majLe))}</span>` +
                    `<small>${esc(libelleMeilleur(c.meilleur))}</small></button>`,
                )
                .join('')
    this.host.innerHTML =
      `<div class="cr-boite">` +
      `<header class="cr-tete"><h2>CRÉATIONS</h2>` +
      `<div class="cr-onglets" role="tablist" aria-label="Quelles créations">` +
      ONGLETS_CREATIONS.map(
        (o) => `<button type="button" role="tab" data-onglet="${o.id}" aria-selected="${o.id === this.onglet}">${o.nom}</button>`,
      ).join('') +
      `</div><span class="cr-ressort"></span>` +
      `<button type="button" id="cr-creer" class="primary">Créer une salle</button>` +
      `<button type="button" id="cr-fermer" aria-label="Fermer les créations">✕</button></header>` +
      `<div class="cr-corps"><section class="cr-liste" aria-label="Les salles">${cartes}</section>` +
      `<aside class="cr-detail" aria-label="La salle choisie">${this.peintDetail(miennes)}</aside></div>` +
      `</div>`
    const toile = this.host.querySelector<HTMLCanvasElement>('#cr-vignette')
    if (toile && this.detail?.level) dessineVignette(toile, this.detail.level)
  }

  private peintDetail(miennes: string[]): string {
    if (!this.choisie) return '<p class="cr-vide">Choisissez une salle.</p>'
    if (this.chargeDetail || !this.detail) {
      return this.chargeDetail ? '<p class="cr-vide">Lecture de la salle…</p>' : `<p class="cr-vide">${esc(raisonCreation() || 'Cette salle est injoignable.')}</p>`
    }
    const { creation: c, records: r, level } = this.detail
    const moi = this.hooks.operateur()
    const classement = (titre: string, sorte: 'volume' | 'chrono'): string =>
      `<h3>${titre}</h3><ol class="cr-records">` +
      lignesClassement(sorte === 'volume' ? r.volume : r.chrono, sorte, moi)
        .map((l) => `<li${l.moi ? ' class="moi"' : ''}><span>${l.rang}</span><span>${esc(l.nom)}</span><b>${esc(l.valeur)}</b></li>`)
        .join('') +
      `</ol>`
    const desc = typeof c.salle.journal === 'string' ? c.salle.journal : ''
    return (
      `<canvas id="cr-vignette" width="360" height="200" aria-hidden="true"></canvas>` +
      `<small>par ${esc(c.auteur)} · ${esc(quandRelatif(c.majLe))}</small>` +
      `<h3 class="cr-nom">${esc(c.nom)}</h3>` +
      (desc ? `<p>${esc(desc)}</p>` : '') +
      (level
        ? `<button type="button" id="cr-jouer" class="primary">JOUER</button>`
        : '<p class="cr-vide">Cette salle ne se lit pas dans cette version du jeu.</p>') +
      classement('RECORDS — VOLUME', 'volume') +
      classement('RECORDS — CHRONO', 'chrono') +
      `<p class="cr-note">Jouée hors expédition : ni mémoire, ni orbe, ni trophée. Seul le record compte.</p>` +
      (miennes.includes(c.id) ? `<button type="button" id="cr-retirer">Retirer ma salle</button>` : '')
    )
  }
}

/** LA VIGNETTE : la salle dessinée depuis sa géométrie, à plat — parois
 *  et structures, éponges, puits, portes, le départ et la sortie. */
export function dessineVignette(toile: HTMLCanvasElement, l: LevelDef): void {
  const g = toile.getContext('2d')
  if (!g) return
  const W = toile.width
  const H = toile.height
  const b = l.bounds
  const k = Math.min(W / (b.maxX - b.minX), H / (b.maxY - b.minY)) * 0.92
  const ox = W / 2 - ((b.minX + b.maxX) / 2) * k
  const oy = H / 2 - ((b.minY + b.maxY) / 2) * k
  const rect = (r: { minX: number; minY: number; maxX: number; maxY: number }): [number, number, number, number] => [
    ox + r.minX * k,
    oy + r.minY * k,
    Math.max(1, (r.maxX - r.minX) * k),
    Math.max(1, (r.maxY - r.minY) * k),
  ]
  g.fillStyle = '#030710'
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#0a1420'
  g.fillRect(...rect(b))
  for (const s of l.structures ?? []) {
    g.strokeStyle = '#2a3542'
    g.lineWidth = Math.max(1, (s.ep ?? 40) * k)
    g.strokeRect(...rect(s))
  }
  for (const x of l.boxes) {
    g.fillStyle = TEINTES[x.material] ?? '#4a6b80'
    g.fillRect(...rect(x))
  }
  for (const s of l.sponges) {
    g.fillStyle = '#1f4a35'
    g.fillRect(ox + s.minX * k, oy + s.minY * k, s.cols * s.cellSize * k, s.rows * s.cellSize * k)
  }
  for (const p of l.portes ?? []) {
    g.fillStyle = '#9aa3ab'
    g.fillRect(...rect(p))
  }
  for (const p of l.puits ?? []) {
    g.strokeStyle = '#63b7e6'
    g.lineWidth = 1
    g.beginPath()
    g.arc(ox + p.x * k, oy + p.y * k, Math.max(2, (p.rayon ?? 300) * k), 0, Math.PI * 2)
    g.stroke()
  }
  g.strokeStyle = '#3fd69b'
  g.lineWidth = 2
  g.strokeRect(...rect(l.exit))
  g.fillStyle = '#63b7e6'
  g.beginPath()
  g.arc(ox + l.spawn.x * k, oy + l.spawn.y * k, Math.max(3, 60 * k), 0, Math.PI * 2)
  g.fill()
}
