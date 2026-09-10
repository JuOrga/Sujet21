// L'ÉCRAN DES AVARIES — la console du concepteur pour l'accident du
// télescope : une ligne par station du module, son prix en mémoire, sa
// plaque, le pictogramme, la ligne du toast à la remise en état, et les
// trois effets que sa panne inflige au module. L'ordre des lignes est
// l'ordre du TABLEAU DES AVARIES que le joueur lit au centre de contrôle.
//
// Il ne connaît ni le magasin ni le jeu : il reçoit les fiches, il rend les
// fiches retouchées (pose), et les trois gestes du partage lui sont prêtés.
// Ce qu'il RÈGLE joue tout de suite sur ce poste ; PUBLIER POUR TOUS le
// fait jouer partout.
//
// L'identifiant, lui, ne se règle pas : c'est la clé du plot dans le hub,
// de l'ancre dans l'éditeur et de la réparation dans la sauvegarde. La
// ligne le montre en clair — sans quoi on ne saurait pas quelle station du
// module on est en train de retoucher.

import {
  AVARIES_LIVREES,
  etatAvaries,
  lisAvaries,
  memesAvaries,
  PRIX_MAX,
  type FicheAvarie,
} from '../game/avariesPartage'

export interface PublieAvaries {
  fiches: FicheAvarie[] | null
  auteur: string
  date: string
  charge: boolean
}

export interface HooksRegieAvaries {
  /** Les fiches qui jouent sur ce poste. */
  courantes(): FicheAvarie[]
  /** Le concepteur vient de retoucher : à appliquer au jeu, et à garder. */
  pose(fiches: FicheAvarie[]): void
  /** Ce que le magasin partagé porte. */
  publie(): PublieAvaries
  /** Publier le courant pour tout le monde. */
  publier(): Promise<PublieAvaries | null>
  /** Retirer le publié : le livré reprend, pour tout le monde. */
  retirer(): Promise<boolean>
  fermer(): void
}

const esc = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Les trois effets d'une panne, dans l'ordre où ils se lisent. */
const EFFETS: { champ: 'assombrit' | 'eteintEcrans' | 'porte'; mot: string; aide: string }[] = [
  {
    champ: 'assombrit',
    mot: 'le module s’assombrit',
    aide: 'ambiante et lumières réduites, la brume de panne monte — l’effet du réseau d’éclairage',
  },
  {
    champ: 'eteintEcrans',
    mot: 'les écrans du plot s’éteignent',
    aide: 'les écrans de décor passent en éteint, et les pupitres posés sur le plot disparaissent : une console morte n’ouvre pas son écran',
  },
  {
    champ: 'porte',
    mot: 'une porte condamne l’aile',
    aide: 'les rectangles de dégât de la station deviennent des barrières d’énergie qu’aucun faisceau n’ouvre',
  },
]

export class RegieAvaries {
  private message = ''

  constructor(
    private host: HTMLElement,
    private hooks: HooksRegieAvaries,
  ) {
    host.addEventListener('click', (e) => this.clic(e))
    host.addEventListener('change', (e) => this.change(e))
  }

  get visible(): boolean {
    return !this.host.hidden
  }

  open(): void {
    this.host.hidden = false
    this.message = ''
    this.render()
  }

  close(): void {
    this.host.hidden = true
  }

  /** Le magasin a répondu (à l'ouverture, après publication) : on repeint. */
  rafraichit(): void {
    if (!this.host.hidden) this.render()
  }

  // ---- LE RENDU --------------------------------------------------------------

  render(): void {
    if (this.host.hidden) return
    const fiches = this.hooks.courantes()
    this.el('rav-liste').innerHTML = fiches.map((f, i) => this.ligne(f, i, fiches.length)).join('')
    this.majEtat()
  }

  private ligne(f: FicheAvarie, i: number, n: number): string {
    const effets = EFFETS.map(
      (e) =>
        `<label class="rav-eff" title="${esc(e.aide)}"><input type="checkbox" data-champ="${e.champ}"${f[e.champ] ? ' checked' : ''}><span>${e.mot}</span></label>`,
    ).join('')
    return (
      `<article class="rav-carte${f.enAvarie ? '' : ' rav-hors'}" data-id="${esc(f.id)}">` +
      `<div class="rav-rang">` +
      `<button type="button" data-mv="-1" aria-label="Monter"${i === 0 ? ' disabled' : ''}>▲</button>` +
      `<b>${i + 1}</b>` +
      `<button type="button" data-mv="1" aria-label="Descendre"${i === n - 1 ? ' disabled' : ''}>▼</button>` +
      `</div>` +
      `<div class="rav-champs">` +
      `<label class="rav-f rav-f--ic"><span>Picto</span><input data-champ="icone" value="${esc(f.icone)}" maxlength="8" spellcheck="false"></label>` +
      `<label class="rav-f rav-f--nom"><span>Plaque de la station</span><input data-champ="nom" value="${esc(f.nom)}" maxlength="40"></label>` +
      `<label class="rav-f rav-f--prix"><span>Prix (mémoire)</span><input data-champ="prix" type="number" min="0" max="${PRIX_MAX}" step="1" value="${f.prix}"></label>` +
      `<label class="rav-f rav-f--det"><span>La ligne du toast, à la remise en état</span><input data-champ="detail" value="${esc(f.detail)}" maxlength="120"></label>` +
      `<div class="rav-effets">${effets}</div>` +
      `<p class="rav-cle"><code>${esc(f.id)}</code> — le plot du hub, l’ancre de l’éditeur et la réparation payée portent cet identifiant : il ne se règle pas.</p>` +
      `</div>` +
      `<label class="rav-bascule" title="Retirée de l’accident, la station est debout d’emblée pour tout le monde : rien à payer, et elle quitte le tableau des avaries.">` +
      `<input type="checkbox" data-champ="enAvarie"${f.enAvarie ? ' checked' : ''}><span>${f.enAvarie ? 'EN AVARIE' : 'HORS ACCIDENT'}</span></label>` +
      `</article>`
    )
  }

  /** La ligne d'état : ce qui joue ici, ce que le magasin porte, et le
   *  dernier mot dit au concepteur. */
  private majEtat(): void {
    const courant = this.hooks.courantes()
    const p = this.hooks.publie()
    const et = etatAvaries({ courant, publie: p.fiches })
    const enAvarie = courant.filter((f) => f.enAvarie).length
    const cout = courant.filter((f) => f.enAvarie).reduce((s, f) => s + f.prix, 0)
    const partage = !p.charge
      ? 'lecture du magasin…'
      : p.fiches === null
        ? 'rien de publié : les joueurs jouent les avaries du code'
        : `publié par ${esc(p.auteur || 'anonyme')}${p.date ? `, ${formateDate(p.date)}` : ''}`
    const joue =
      et.source === 'publie'
        ? '<b class="rav-ok">ce qui joue ici est le publié</b>'
        : et.source === 'livre'
          ? '<b>ce qui joue ici est le livré</b>'
          : '<b class="rav-brouillon">brouillon de ce poste — non publié</b>'
    this.el('rav-partage').innerHTML = partage
    this.el('rav-etat').innerHTML =
      `${joue} · ${enAvarie} station${enAvarie > 1 ? 's' : ''} en avarie, ${cout} mémoire pour tout rétablir` +
      (et.identiqueAuLivre ? ' · identique au livré' : '') +
      (this.message ? ` — ${esc(this.message)}` : '')
    const dispo = (id: string, on: boolean): void => {
      const b = this.host.querySelector<HTMLButtonElement>(`#${id}`)
      if (b) b.disabled = !on
    }
    dispo('rav-publier', !et.identiqueAuPublie)
    dispo('rav-reprendre', p.fiches !== null && !et.identiqueAuPublie)
    dispo('rav-retirer', p.fiches !== null)
    dispo('rav-livre', !et.identiqueAuLivre)
  }

  private dit(m: string): void {
    this.message = m
    this.majEtat()
  }

  // ---- LES GESTES ------------------------------------------------------------

  /** Une retouche : elle joue tout de suite sur ce poste. */
  private pose(fiches: FicheAvarie[]): void {
    this.hooks.pose(lisAvaries({ stations: fiches }))
  }

  private change(e: Event): void {
    const t = e.target as HTMLInputElement
    const champ = t.dataset.champ
    const id = t.closest<HTMLElement>('[data-id]')?.dataset.id
    if (!champ || !id) return
    const fiches = this.hooks.courantes()
    const f = fiches.find((x) => x.id === id)
    if (!f) return
    this.message = ''
    if (champ === 'prix') f.prix = Math.round(Number(t.value) || 0)
    else if (champ === 'nom' || champ === 'detail' || champ === 'icone') f[champ] = t.value
    else if (champ === 'assombrit' || champ === 'eteintEcrans' || champ === 'porte' || champ === 'enAvarie')
      f[champ] = t.checked
    this.pose(fiches)
    // les bornes ont peut-être corrigé la saisie (un prix de 4200, une
    // plaque vide) : on repeint la ligne plutôt que de laisser l'écran
    // mentir sur ce qui joue
    if (champ === 'enAvarie') this.render()
    else {
      const relue = this.hooks.courantes().find((x) => x.id === id)
      if (relue) {
        const valeur = champ === 'prix' ? String(relue.prix) : String(relue[champ as 'nom' | 'detail' | 'icone'])
        if (t.type !== 'checkbox' && t.value !== valeur) t.value = valeur
      }
      this.majEtat()
    }
  }

  private clic(e: Event): void {
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null
    if (!b || b.disabled) return
    if (b.id === 'rav-fermer') {
      this.hooks.fermer()
      return
    }
    if (b.dataset.mv) {
      const id = b.closest<HTMLElement>('[data-id]')?.dataset.id
      const fiches = this.hooks.courantes()
      const i = fiches.findIndex((f) => f.id === id)
      const j = i + Number(b.dataset.mv)
      if (i < 0 || j < 0 || j >= fiches.length) return
      ;[fiches[i], fiches[j]] = [fiches[j], fiches[i]]
      this.pose(fiches)
      this.render()
      return
    }
    if (b.id === 'rav-livre') {
      this.pose([...AVARIES_LIVREES])
      this.render()
      this.dit('Avaries rendues au livré, sur ce poste. Rien n’est publié tant que vous ne publiez pas.')
      return
    }
    if (b.id === 'rav-reprendre') {
      const p = this.hooks.publie()
      if (!p.fiches) return
      this.pose(p.fiches)
      this.render()
      this.dit('Brouillon remis sur le publié.')
      return
    }
    if (b.id === 'rav-publier') {
      // le bouton se ferme le temps de l'appel : deux clics pendant que le
      // magasin répond publiaient deux fois
      b.disabled = true
      this.dit('Publication…')
      void this.hooks.publier().then((p) => {
        this.render()
        this.dit(p ? 'Publié : tout le monde joue ces avaries.' : 'Échec : le magasin partagé ne répond pas — rien n’a été publié.')
      })
      return
    }
    if (b.id === 'rav-retirer') {
      if (!window.confirm('Retirer les avaries publiées ? Les joueurs joueront de nouveau celles du code.')) return
      b.disabled = true
      void this.hooks.retirer().then((ok) => {
        this.render()
        this.dit(ok ? 'Publication retirée : les joueurs jouent les avaries du code.' : 'Échec : le magasin partagé ne répond pas.')
      })
    }
  }

  private el(id: string): HTMLElement {
    const e = this.host.querySelector<HTMLElement>(`#${id}`)
    if (!e) throw new Error(`régie des avaries : #${id} manque dans le gabarit`)
    return e
  }
}

/** Ce que la régie affiche à côté de la section : le détail du domaine. */
export function detailAvaries(fiches: FicheAvarie[] | null): string | undefined {
  if (!fiches) return undefined
  const n = fiches.filter((f) => f.enAvarie).length
  return `${n} station(s) en avarie${memesAvaries(fiches, AVARIES_LIVREES) ? ', comme le livré' : ''}`
}

function formateDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
