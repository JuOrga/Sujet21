// La table de montage : l'écran où le concepteur a la main sur les
// cinématiques — planches réordonnables, champs (image, texte, durée,
// effet, fondu, sons), lecture immédiate, export/import JSON. Les
// cinématiques du poste vivent en localStorage (chargeCinematiques) ;
// les livrées (ESSAI, puis l'ouverture) sont en lecture seule — DUPLIQUER
// pour partir d'elles.

import {
  type CinematiqueDef,
  DUREE_MAX,
  DUREE_MIN,
  EFFET_NOMS,
  EFFETS,
  FONDUS,
  chargeCinematiques,
  parseCinematique,
  plancheVierge,
  sauveCinematiques,
  serializeCinematique,
} from './cinematique'
import { BRUITAGES, PISTE_NOMS, PISTES, PONCTUATIONS } from './soundtrack'
import { deleteCine, fetchCines, pushCine, type SharedCine } from './netCines'

export interface MontageOptions {
  /** Les cinématiques livrées avec le jeu (lecture seule). */
  livrees: CinematiqueDef[]
  /** Jouer une cinématique (le lecteur plein écran). */
  lire: (cine: CinematiqueDef) => Promise<void>
  /** Le nom d'opérateur — signe les partages. */
  auteur: () => string
  /** Ouvrir la bibliothèque d'images en sélecteur (rend l'URL choisie). */
  choisirImage?: (rend: (url: string) => void) => void
  /** Les partagées viennent d'arriver/de changer : le jeu met à jour sa
   *  résolution par code. */
  surPartagees?: (cines: CinematiqueDef[]) => void
}

function copie(c: CinematiqueDef): CinematiqueDef {
  return JSON.parse(JSON.stringify(c)) as CinematiqueDef
}

function optionsHTML(
  valeurs: string[],
  noms: Record<string, string> | null,
  vide: string,
): string {
  const opts = [`<option value="">${vide}</option>`]
  for (const v of valeurs)
    opts.push(`<option value="${v}">${noms ? (noms[v] ?? v) : v}</option>`)
  return opts.join('')
}

export class TableMontage {
  private cines: CinematiqueDef[] = []
  private partagees: SharedCine[] = []
  private courante: CinematiqueDef | null = null
  // d'où vient la sélection : seul le POSTE s'édite — livrées et partagées
  // se dupliquent (et une partagée se remplace en re-PARTAGEANT son code)
  private source: 'livree' | 'poste' | 'partagee' = 'livree'
  private readonly selectEl: HTMLSelectElement
  private readonly corpsEl: HTMLDivElement
  private readonly fichierEl: HTMLInputElement

  constructor(
    private readonly root: HTMLElement,
    private readonly opts: MontageOptions,
  ) {
    root.innerHTML = `
      <div class="mt-tete">
        <span class="mt-titre">TABLE DE MONTAGE</span>
        <select class="mt-choix" aria-label="Choisir une cinématique"></select>
        <button type="button" data-mt="nouvelle">NOUVELLE</button>
        <button type="button" data-mt="dupliquer">DUPLIQUER</button>
        <button type="button" data-mt="supprimer">SUPPRIMER</button>
        <button type="button" data-mt="exporter">EXPORTER</button>
        <button type="button" data-mt="importer">IMPORTER</button>
        <button type="button" data-mt="partager" title="Publier dans la bibliothèque partagée : visible et jouable (par son code) sur tous les postes — un partage du même code remplace le précédent">⇪ PARTAGER</button>
        <span class="mt-statut"></span>
        <span class="mt-souffle"></span>
        <button type="button" class="mt-lire" data-mt="lire">▶ LIRE</button>
        <button type="button" data-mt="fermer">FERMER</button>
      </div>
      <div class="mt-corps"></div>
      <input type="file" accept="application/json,.json" hidden />`
    this.selectEl = root.querySelector('.mt-choix') as HTMLSelectElement
    this.corpsEl = root.querySelector('.mt-corps') as HTMLDivElement
    this.fichierEl = root.querySelector('input[type=file]') as HTMLInputElement

    this.selectEl.addEventListener('change', () =>
      this.choisit(this.selectEl.value),
    )
    this.fichierEl.addEventListener('change', () => this.importeFichier())
    root.querySelector('.mt-tete')!.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest(
        'button[data-mt]',
      ) as HTMLButtonElement | null
      if (btn) this.action(btn.dataset.mt!)
    })
  }

  open(): void {
    this.cines = chargeCinematiques()
    if (!this.courante)
      this.choisit(`livree:${this.opts.livrees[0]?.code ?? ''}`)
    else this.rafraichitListe()
    this.root.classList.add('visible')
    // la bibliothèque partagée, en arrière-plan : la liste se complète
    void fetchCines().then((liste) => {
      if (!liste) return
      this.partagees = liste
      this.opts.surPartagees?.(liste.map((s) => s.cine))
      this.rafraichitListe()
    })
  }

  close(): void {
    this.root.classList.remove('visible')
  }

  private action(quoi: string): void {
    if (quoi === 'fermer') {
      this.close()
    } else if (quoi === 'lire') {
      if (this.courante) void this.opts.lire(this.courante)
    } else if (quoi === 'nouvelle') {
      const c = {
        code: this.codeLibre('CINE'),
        titre: 'Sans titre',
        planches: [plancheVierge()],
      }
      this.cines.push(c)
      this.persiste()
      this.choisit(`poste:${c.code}`)
    } else if (quoi === 'dupliquer') {
      if (!this.courante) return
      const c = copie(this.courante)
      c.code = this.codeLibre(c.code)
      c.titre = `${c.titre} (copie)`
      this.cines.push(c)
      this.persiste()
      this.choisit(`poste:${c.code}`)
    } else if (quoi === 'supprimer') {
      if (!this.courante) return
      if (this.source === 'poste') {
        this.cines = this.cines.filter((c) => c !== this.courante)
        this.persiste()
        this.choisit(`livree:${this.opts.livrees[0]?.code ?? ''}`)
      } else if (this.source === 'partagee') {
        // retirer de la bibliothèque partagée — pour tout le monde
        this.statut('retrait du partage…')
        void deleteCine(this.courante.code).then((liste) => {
          if (!liste) {
            this.statut('retrait impossible (hors ligne ?)')
            return
          }
          this.partagees = liste
          this.opts.surPartagees?.(liste.map((s) => s.cine))
          this.statut('')
          this.choisit(`livree:${this.opts.livrees[0]?.code ?? ''}`)
        })
      }
    } else if (quoi === 'partager') {
      if (!this.courante) return
      this.statut('partage…')
      void pushCine(this.courante, this.opts.auteur()).then((liste) => {
        if (!liste) {
          this.statut('partage impossible (hors ligne ?)')
          return
        }
        this.partagees = liste
        this.opts.surPartagees?.(liste.map((s) => s.cine))
        this.statut(`« ${this.courante!.code} » partagée — visible sur tous les postes`)
        this.rafraichitListe()
      })
    } else if (quoi === 'exporter') {
      if (!this.courante) return
      const blob = new Blob([serializeCinematique(this.courante)], {
        type: 'application/json',
      })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `cinematique-${this.courante.code.toLowerCase()}.json`
      a.click()
      URL.revokeObjectURL(a.href)
    } else if (quoi === 'importer') {
      this.fichierEl.click()
    }
  }

  private importeFichier(): void {
    const f = this.fichierEl.files?.[0]
    this.fichierEl.value = ''
    if (!f) return
    f.text().then((txt) => {
      let brut: unknown
      try {
        brut = JSON.parse(txt)
      } catch {
        return
      }
      const r = parseCinematique(brut)
      if (!r) return
      r.cine.code = this.codeLibre(r.cine.code)
      this.cines.push(r.cine)
      this.persiste()
      this.choisit(`poste:${r.cine.code}`)
    })
  }

  private codeLibre(base: string): string {
    const pris = new Set([
      ...this.cines.map((c) => c.code),
      ...this.opts.livrees.map((c) => c.code),
    ])
    let code = base
    let n = 2
    while (pris.has(code)) code = `${base}-${n++}`
    return code
  }

  private persiste(): void {
    sauveCinematiques(this.cines)
  }

  private statut(txt: string): void {
    const el = this.root.querySelector('.mt-statut') as HTMLSpanElement | null
    if (el) el.textContent = txt
  }

  private rafraichitListe(): void {
    const cle = `${this.source}:${this.courante?.code}`
    this.selectEl.innerHTML = [
      ...this.opts.livrees.map(
        (c) =>
          `<option value="livree:${c.code}">◆ ${c.titre} (livrée)</option>`,
      ),
      ...this.cines.map(
        (c) =>
          `<option value="poste:${c.code}">${c.titre} [${c.code}]</option>`,
      ),
      ...this.partagees.map(
        (s) =>
          `<option value="partagee:${s.cine.code}">◇ ${s.cine.titre} [${s.cine.code}]${
            s.auteur ? ' — ' + s.auteur : ''
          } (partagée)</option>`,
      ),
    ].join('')
    this.selectEl.value = cle
  }

  private choisit(cle: string): void {
    const [ou, ...reste] = cle.split(':')
    const code = reste.join(':')
    if (ou === 'poste') {
      this.courante = this.cines.find((c) => c.code === code) ?? null
      this.source = 'poste'
    } else if (ou === 'partagee') {
      this.courante = this.partagees.find((s) => s.cine.code === code)?.cine ?? null
      this.source = 'partagee'
    } else {
      this.courante = this.opts.livrees.find((c) => c.code === code) ?? null
      this.source = 'livree'
    }
    this.rafraichitListe()
    this.dessine()
  }

  // Toute édition écrit immédiatement (localStorage) : la table n'a pas de
  // bouton « enregistrer » à oublier.
  private edite(fait: () => void): void {
    if (!this.courante || this.source !== 'poste') return
    fait()
    this.persiste()
  }

  private dessine(): void {
    const c = this.courante
    this.corpsEl.innerHTML = ''
    if (!c) return
    const gel = this.source !== 'poste'
    const tete = document.createElement('div')
    tete.className = 'mt-fiche'
    tete.innerHTML = gel
      ? this.source === 'partagee'
        ? `<em>Cinématique partagée — DUPLIQUER pour la retoucher, puis ⇪ PARTAGER : le même code remplace cette version pour tout le monde.</em>`
        : `<em>Cinématique livrée avec le jeu — en lecture seule. DUPLIQUER pour la retoucher.</em>`
      : `<label>CODE <input data-ch="code" maxlength="24" /></label>
         <label>TITRE <input data-ch="titre" maxlength="80" /></label>`
    this.corpsEl.appendChild(tete)
    if (!gel) {
      const code = tete.querySelector('[data-ch=code]') as HTMLInputElement
      const titre = tete.querySelector('[data-ch=titre]') as HTMLInputElement
      code.value = c.code
      titre.value = c.titre
      code.addEventListener('change', () =>
        this.edite(() => {
          const propre = code.value.trim() || c.code
          c.code = propre === c.code ? propre : this.codeLibre(propre)
          code.value = c.code
          this.rafraichitListe()
        }),
      )
      titre.addEventListener('change', () =>
        this.edite(() => {
          c.titre = titre.value.trim() || c.code
          this.rafraichitListe()
        }),
      )
    }

    c.planches.forEach((p, i) => {
      const row = document.createElement('div')
      row.className = 'mt-planche'
      row.innerHTML = `
        <div class="mt-vignette"><img alt="" draggable="false" /><span>${i + 1}</span></div>
        <div class="mt-champs">
          <label class="mt-large">IMAGE <span class="mt-image"><input data-ch="image" placeholder="/assets/cine/… ou URL" ${gel ? 'disabled' : ''} /><button type="button" data-op="biblio" title="Choisir dans la bibliothèque d'images" ${gel || !this.opts.choisirImage ? 'disabled' : ''}>▣</button></span></label>
          <label class="mt-large">TEXTE <textarea data-ch="texte" rows="2" ${gel ? 'disabled' : ''}></textarea></label>
          <label>DURÉE (s) <input data-ch="duree" type="number" min="${DUREE_MIN}" max="${DUREE_MAX}" step="0.5" ${gel ? 'disabled' : ''} /></label>
          <label>EFFET <select data-ch="effet" ${gel ? 'disabled' : ''}>${EFFETS.map((e) => `<option value="${e}">${EFFET_NOMS[e]}</option>`).join('')}</select></label>
          <label>FONDU <select data-ch="fondu" ${gel ? 'disabled' : ''}>${FONDUS.map((f) => `<option value="${f}">${f}</option>`).join('')}</select></label>
          <label>BRUITAGE <select data-ch="bruitage" ${gel ? 'disabled' : ''}>${optionsHTML(BRUITAGES, null, '— aucun —')}</select></label>
          <label>PONCTUATION <select data-ch="ponctuation" ${gel ? 'disabled' : ''}>${optionsHTML(PONCTUATIONS, null, '— aucune —')}</select></label>
          <label>PISTE <select data-ch="piste" ${gel ? 'disabled' : ''}>${optionsHTML(PISTES, PISTE_NOMS, '— la musique continue —')}</select></label>
        </div>
        <div class="mt-outils">
          <button type="button" data-op="monte" title="Monter" ${gel || i === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" data-op="descend" title="Descendre" ${gel || i === c.planches.length - 1 ? 'disabled' : ''}>▼</button>
          <button type="button" data-op="retire" title="Retirer la planche" ${gel || c.planches.length <= 1 ? 'disabled' : ''}>✕</button>
        </div>`
      const img = row.querySelector('.mt-vignette img') as HTMLImageElement
      if (p.image) img.src = p.image
      img.addEventListener('error', () => img.removeAttribute('src'))
      // ▣ : la bibliothèque d'images s'ouvre en sélecteur par-dessus la table
      row.querySelector('[data-op=biblio]')?.addEventListener('click', () => {
        this.opts.choisirImage?.((url) => {
          this.edite(() => {
            p.image = url
            ;(row.querySelector('[data-ch=image]') as HTMLInputElement).value = url
            img.src = url
          })
        })
      })
      const champ = <
        T extends HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
      >(
        ch: string,
      ) => row.querySelector(`[data-ch=${ch}]`) as T
      champ<HTMLInputElement>('image').value = p.image
      champ<HTMLTextAreaElement>('texte').value = p.texte
      champ<HTMLInputElement>('duree').value = String(p.duree)
      champ<HTMLSelectElement>('effet').value = p.effet
      champ<HTMLSelectElement>('fondu').value = p.fondu
      champ<HTMLSelectElement>('bruitage').value = p.bruitage
      champ<HTMLSelectElement>('ponctuation').value = p.ponctuation
      champ<HTMLSelectElement>('piste').value = p.piste
      row.addEventListener('change', (e) => {
        const cible = e.target as HTMLElement
        const ch = cible.dataset.ch
        if (!ch) return
        this.edite(() => {
          if (ch === 'duree') {
            const v = Number(champ<HTMLInputElement>('duree').value)
            p.duree = Number.isFinite(v)
              ? Math.min(DUREE_MAX, Math.max(DUREE_MIN, v))
              : p.duree
            champ<HTMLInputElement>('duree').value = String(p.duree)
          } else if (ch === 'image') {
            p.image = champ<HTMLInputElement>('image').value.trim()
            if (p.image) img.src = p.image
            else img.removeAttribute('src')
          } else if (ch === 'texte') {
            p.texte = champ<HTMLTextAreaElement>('texte').value
          } else if (
            ch === 'effet' ||
            ch === 'fondu' ||
            ch === 'bruitage' ||
            ch === 'ponctuation' ||
            ch === 'piste'
          ) {
            // les select ne proposent que le vocabulaire fermé : copie directe
            ;(p as unknown as Record<string, string>)[ch] =
              champ<HTMLSelectElement>(ch).value
          }
        })
      })
      row.querySelector('.mt-outils')!.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest(
          'button[data-op]',
        ) as HTMLButtonElement | null
        if (!btn || btn.disabled) return
        this.edite(() => {
          if (btn.dataset.op === 'monte') {
            ;[c.planches[i - 1], c.planches[i]] = [
              c.planches[i],
              c.planches[i - 1],
            ]
          } else if (btn.dataset.op === 'descend') {
            ;[c.planches[i], c.planches[i + 1]] = [
              c.planches[i + 1],
              c.planches[i],
            ]
          } else {
            c.planches.splice(i, 1)
          }
          this.dessine()
        })
      })
      this.corpsEl.appendChild(row)
    })

    if (!gel) {
      const ajout = document.createElement('button')
      ajout.type = 'button'
      ajout.className = 'mt-ajout'
      ajout.textContent = '+ AJOUTER UNE PLANCHE'
      ajout.addEventListener('click', () =>
        this.edite(() => {
          c.planches.push(plancheVierge())
          this.dessine()
        }),
      )
      this.corpsEl.appendChild(ajout)
    }
  }
}
