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
import {
  deleteCine,
  fetchBibliotheque,
  pushCine,
  pushScenario,
  type SharedCine,
} from './netCines'
import {
  ACTION_NOMS,
  ACTIONS,
  SEQUENCE_ALERTE,
  type ActionSeq,
  type SequenceDef,
  champTexte,
  champValeur,
  chargeSequences,
  etapeVierge,
  sauveSequences,
} from './sequence'
import {
  CONDITION_NOMS,
  CONDITIONS,
  MOMENT_NOMS,
  MOMENTS,
  type ConditionScenario,
  type MomentScenario,
  type ScenarioDef,
  chargeScenario,
  chargeVues,
  conditionAValeur,
  idLibre,
  oublieVues,
  regleVierge,
  sauveScenario,
} from './scenario'

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
  /** Le scénario a changé : le jeu joue désormais celui-là. */
  surScenario?: (s: ScenarioDef) => void
  /** Les trophées connus, pour la condition « trophée débloqué ». */
  trophees?: { id: string; nom: string }[]
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
  private scenario: ScenarioDef = { regles: [] }
  private sequences: SequenceDef[] = []
  private seqCourante: SequenceDef | null = null
  private onglet: 'cines' | 'scenario' | 'sequences' = 'cines'
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
      <div class="mt-onglets">
        <button type="button" class="mt-ong actif" data-ong="cines">CINÉMATIQUES</button>
        <button type="button" class="mt-ong" data-ong="scenario" title="Les cinématiques hors tableau : avant le hub, au lancement d'une run, à la défaite — sous conditions">SCÉNARIO</button>
        <button type="button" class="mt-ong" data-ong="sequences" title="La mise en scène DANS le tableau : lampes qui virent, sirène, secousse, brèche qui s'ouvre">SÉQUENCES</button>
      </div>
      <div class="mt-corps"></div>
      <input type="file" accept="application/json,.json" hidden />`
    this.selectEl = root.querySelector('.mt-choix') as HTMLSelectElement
    this.corpsEl = root.querySelector('.mt-corps') as HTMLDivElement
    this.fichierEl = root.querySelector('input[type=file]') as HTMLInputElement

    root.querySelector('.mt-onglets')!.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.mt-ong') as HTMLButtonElement | null
      if (!btn) return
      const o = btn.dataset.ong
      this.onglet = o === 'scenario' ? 'scenario' : o === 'sequences' ? 'sequences' : 'cines'
      for (const b of root.querySelectorAll('.mt-ong')) {
        b.classList.toggle('actif', (b as HTMLElement).dataset.ong === this.onglet)
      }
      // le rayon des cinématiques n'a pas de sens dans l'onglet scénario
      root.classList.toggle('mt-en-scenario', this.onglet !== 'cines')
      this.dessine()
    })
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
    this.scenario = chargeScenario()
    this.sequences = chargeSequences()
    if (!this.courante)
      this.choisit(`livree:${this.opts.livrees[0]?.code ?? ''}`)
    else this.rafraichitListe()
    this.root.classList.add('visible')
    if (this.onglet !== 'cines') this.dessine()
    // la bibliothèque partagée, en arrière-plan : la liste se complète
    void fetchBibliotheque().then((biblio) => {
      if (!biblio) return
      this.partagees = biblio.cines
      this.opts.surPartagees?.(biblio.cines.map((s) => s.cine))
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
      // dans l'onglet SCÉNARIO, PARTAGER publie LE scénario (il n'y en a
      // qu'un : il remplace le précédent pour tout le monde)
      if (this.onglet === 'scenario') {
        this.statut('partage du scénario…')
        void pushScenario(this.scenario, this.opts.auteur()).then((s) => {
          if (!s) {
            this.statut('partage impossible (hors ligne ?)')
            return
          }
          this.scenario = s
          sauveScenario(s)
          this.opts.surScenario?.(s)
          this.statut('scénario partagé — il fait foi sur tous les postes')
        })
        return
      }
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

  // ---- L'onglet SCÉNARIO : la liste de règles, premier match gagne.

  private editeScenario(fait: () => void): void {
    fait()
    sauveScenario(this.scenario)
    this.opts.surScenario?.(this.scenario)
  }

  /** Tous les codes proposables : livrées, poste, partagées. */
  private codesConnus(): string[] {
    return [
      ...this.opts.livrees.map((c) => c.code),
      ...this.cines.map((c) => c.code),
      ...this.partagees.map((s) => s.cine.code),
    ].filter((c, i, t) => t.indexOf(c) === i)
  }

  private dessineScenario(): void {
    this.corpsEl.innerHTML = ''
    const intro = document.createElement('div')
    intro.className = 'mt-fiche'
    intro.innerHTML =
      `<em>Les cinématiques HORS TABLEAU. La liste se lit de haut en bas et la ` +
      `PREMIÈRE règle qui correspond gagne : rangez le particulier au-dessus du général. ` +
      `« Une seule fois » retient la règle pour toujours — c’est elle qui empêche ` +
      `l’ouverture de se rejouer à chaque run. ⇪ PARTAGER publie ce scénario pour tous.</em>`
    this.corpsEl.appendChild(intro)

    const codes = this.codesConnus()
    const trophees = this.opts.trophees ?? []
    this.scenario.regles.forEach((r, i) => {
      const row = document.createElement('div')
      row.className = 'mt-regle'
      row.innerHTML = `
        <span class="mt-rang">${i + 1}</span>
        <div class="mt-champs">
          <label>QUAND <select data-sc="moment">${MOMENTS.map(
            (m) => `<option value="${m}">${MOMENT_NOMS[m]}</option>`,
          ).join('')}</select></label>
          <label>SI <select data-sc="condition">${CONDITIONS.map(
            (c) => `<option value="${c}">${CONDITION_NOMS[c]}</option>`,
          ).join('')}</select></label>
          <label class="mt-si-valeur">N <input data-sc="valeur" type="number" min="0" max="999" step="1" /></label>
          <label class="mt-si-trophee">TROPHÉE <select data-sc="trophee"><option value="">— aucun —</option>${trophees
            .map((t) => `<option value="${t.id}">${t.nom}</option>`)
            .join('')}</select></label>
          <label>CINÉMATIQUE <input data-sc="cine" list="mt-codes" placeholder="code" /></label>
          <label class="mt-case">UNE SEULE FOIS <input data-sc="uneFois" type="checkbox" /></label>
          <label class="mt-case">ACTIVE <input data-sc="actif" type="checkbox" /></label>
        </div>
        <div class="mt-outils">
          <button type="button" data-op="monte" title="Monter (plus prioritaire)" ${i === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" data-op="descend" title="Descendre" ${
            i === this.scenario.regles.length - 1 ? 'disabled' : ''
          }>▼</button>
          <button type="button" data-op="retire" title="Retirer la règle">✕</button>
        </div>`
      const ch = <T extends HTMLInputElement | HTMLSelectElement>(nom: string) =>
        row.querySelector(`[data-sc=${nom}]`) as T
      ch<HTMLSelectElement>('moment').value = r.moment
      ch<HTMLSelectElement>('condition').value = r.condition
      ch<HTMLInputElement>('valeur').value = String(r.valeur)
      ch<HTMLSelectElement>('trophee').value = r.trophee
      ch<HTMLInputElement>('cine').value = r.cine
      ch<HTMLInputElement>('uneFois').checked = r.uneFois
      ch<HTMLInputElement>('actif').checked = r.actif
      // seuil et trophée ne s'affichent que si la condition les emploie
      const majPertinence = (): void => {
        row.classList.toggle('mt-avec-valeur', conditionAValeur(r.condition))
        row.classList.toggle('mt-avec-trophee', r.condition === 'trophee')
      }
      majPertinence()
      row.addEventListener('change', (e) => {
        const nom = (e.target as HTMLElement).dataset.sc
        if (!nom) return
        this.editeScenario(() => {
          if (nom === 'moment') r.moment = ch<HTMLSelectElement>('moment').value as MomentScenario
          else if (nom === 'condition') {
            r.condition = ch<HTMLSelectElement>('condition').value as ConditionScenario
            majPertinence()
          } else if (nom === 'valeur') {
            const v = Number(ch<HTMLInputElement>('valeur').value)
            r.valeur = Number.isFinite(v) ? Math.max(0, Math.min(999, Math.round(v))) : r.valeur
            ch<HTMLInputElement>('valeur').value = String(r.valeur)
          } else if (nom === 'trophee') r.trophee = ch<HTMLSelectElement>('trophee').value
          else if (nom === 'cine') r.cine = ch<HTMLInputElement>('cine').value.trim().slice(0, 24)
          else if (nom === 'uneFois') r.uneFois = ch<HTMLInputElement>('uneFois').checked
          else if (nom === 'actif') r.actif = ch<HTMLInputElement>('actif').checked
        })
      })
      row.querySelector('.mt-outils')!.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest('button[data-op]') as HTMLButtonElement | null
        if (!btn || btn.disabled) return
        this.editeScenario(() => {
          const t = this.scenario.regles
          if (btn.dataset.op === 'monte') [t[i - 1], t[i]] = [t[i], t[i - 1]]
          else if (btn.dataset.op === 'descend') [t[i], t[i + 1]] = [t[i + 1], t[i]]
          else t.splice(i, 1)
        })
        this.dessineScenario()
      })
      this.corpsEl.appendChild(row)
    })

    // la liste des codes proposés à la frappe
    const datalist = document.createElement('datalist')
    datalist.id = 'mt-codes'
    datalist.innerHTML = codes.map((c) => `<option value="${c}"></option>`).join('')
    this.corpsEl.appendChild(datalist)

    const pied = document.createElement('div')
    pied.className = 'mt-pied-scenario'
    pied.innerHTML = `
      <button type="button" class="mt-ajout" data-sc-op="ajoute">+ AJOUTER UNE RÈGLE</button>
      <button type="button" class="mt-oubli" data-sc-op="oublie" title="Effacer la mémoire des règles « une seule fois » : elles se rejoueront comme pour un nouveau joueur — pour tester l'ouverture, par exemple">↺ OUBLIER LES RÈGLES DÉJÀ VUES (${
        chargeVues().size
      })</button>`
    pied.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button[data-sc-op]') as HTMLButtonElement | null
      if (!btn) return
      if (btn.dataset.scOp === 'ajoute') {
        this.editeScenario(() => this.scenario.regles.push(regleVierge(idLibre(this.scenario))))
        this.dessineScenario()
      } else {
        oublieVues()
        this.statut('mémoire effacée : les cinématiques « une seule fois » se rejoueront')
        this.dessineScenario()
      }
    })
    this.corpsEl.appendChild(pied)
  }

  // ---- L'onglet SÉQUENCES : la mise en scène DANS le tableau.

  private editeSeqs(fait: () => void): void {
    fait()
    sauveSequences(this.sequences)
  }

  private dessineSequences(): void {
    this.corpsEl.innerHTML = ''
    const intro = document.createElement('div')
    intro.className = 'mt-fiche'
    intro.innerHTML =
      `<em>La mise en scène DANS le tableau : les étapes se jouent dans l’ordre, ` +
      `chacune durant son temps. Le code de la séquence se branche dans l’éditeur — ` +
      `champ SÉQUENCE du tableau (elle démarre à l’essai) ou d’une zone (elle attend le corps).</em>` +
      `<label>SÉQUENCE <select class="mt-seq-choix"></select></label>` +
      `<button type="button" class="mt-btn-seq" data-sq-op="nouvelle">NOUVELLE</button>` +
      `<button type="button" class="mt-btn-seq" data-sq-op="dupliquer">DUPLIQUER</button>` +
      `<button type="button" class="mt-btn-seq" data-sq-op="supprimer">SUPPRIMER</button>`
    this.corpsEl.appendChild(intro)

    const livrees = [SEQUENCE_ALERTE]
    const toutes = [...livrees, ...this.sequences]
    if (!this.seqCourante || !toutes.includes(this.seqCourante)) this.seqCourante = toutes[0] ?? null
    const choix = intro.querySelector('.mt-seq-choix') as HTMLSelectElement
    choix.innerHTML = toutes
      .map(
        (s, i) =>
          `<option value="${i}"${s === this.seqCourante ? ' selected' : ''}>${
            i < livrees.length ? '◆ ' : ''
          }${s.titre} [${s.code}]</option>`,
      )
      .join('')
    choix.addEventListener('change', () => {
      this.seqCourante = toutes[Number(choix.value)] ?? null
      this.dessineSequences()
    })
    intro.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button[data-sq-op]') as HTMLButtonElement | null
      if (!btn) return
      const op = btn.dataset.sqOp
      if (op === 'nouvelle' || op === 'dupliquer') {
        const source = op === 'dupliquer' && this.seqCourante ? this.seqCourante : null
        const pris = new Set(toutes.map((s) => s.code))
        let code = source ? source.code : 'SEQ'
        let n = 2
        while (pris.has(code)) code = `${source ? source.code : 'SEQ'}-${n++}`
        const neuve: SequenceDef = source
          ? { ...JSON.parse(JSON.stringify(source)), code, titre: `${source.titre} (copie)` }
          : { code, titre: 'Sans titre', etapes: [etapeVierge()] }
        this.editeSeqs(() => this.sequences.push(neuve))
        this.seqCourante = neuve
      } else if (op === 'supprimer') {
        if (!this.seqCourante || livrees.includes(this.seqCourante)) return
        this.editeSeqs(() => {
          this.sequences = this.sequences.filter((s) => s !== this.seqCourante)
        })
        this.seqCourante = null
      }
      this.dessineSequences()
    })

    const s = this.seqCourante
    if (!s) return
    const gel = livrees.includes(s)
    const fiche = document.createElement('div')
    fiche.className = 'mt-fiche'
    fiche.innerHTML = gel
      ? `<em>Séquence livrée avec le jeu — en lecture seule. DUPLIQUER pour la retoucher.</em>`
      : `<label>CODE <input data-sq="code" maxlength="24" /></label>
         <label>TITRE <input data-sq="titre" maxlength="80" /></label>`
    this.corpsEl.appendChild(fiche)
    if (!gel) {
      const code = fiche.querySelector('[data-sq=code]') as HTMLInputElement
      const titre = fiche.querySelector('[data-sq=titre]') as HTMLInputElement
      code.value = s.code
      titre.value = s.titre
      code.addEventListener('change', () =>
        this.editeSeqs(() => {
          s.code = code.value.trim().slice(0, 24) || s.code
          code.value = s.code
        }),
      )
      titre.addEventListener('change', () =>
        this.editeSeqs(() => {
          s.titre = titre.value.trim() || s.code
        }),
      )
    }

    s.etapes.forEach((e, i) => {
      const row = document.createElement('div')
      row.className = 'mt-regle'
      row.innerHTML = `
        <span class="mt-rang">${i + 1}</span>
        <div class="mt-champs">
          <label>ACTION <select data-sq="action" ${gel ? 'disabled' : ''}>${ACTIONS.map(
            (a) => `<option value="${a}">${ACTION_NOMS[a]}</option>`,
          ).join('')}</select></label>
          <label class="mt-sq-texte">${
            champTexte(e.action) === 'couleur'
              ? 'COULEUR'
              : champTexte(e.action) === 'libre'
                ? 'TEXTE'
                : champTexte(e.action) === 'code'
                  ? 'CODE'
                  : 'NOM'
          } ${
            champTexte(e.action) === 'bruitage'
              ? `<select data-sq="texte" ${gel ? 'disabled' : ''}>${optionsHTML(BRUITAGES, null, '— aucun —')}</select>`
              : champTexte(e.action) === 'ponctuation'
                ? `<select data-sq="texte" ${gel ? 'disabled' : ''}>${optionsHTML(PONCTUATIONS, null, '— aucune —')}</select>`
                : champTexte(e.action) === 'piste'
                  ? `<select data-sq="texte" ${gel ? 'disabled' : ''}>${optionsHTML(PISTES, PISTE_NOMS, '— inchangée —')}</select>`
                  : `<input data-sq="texte" placeholder="${
                      champTexte(e.action) === 'couleur' ? '#e8433c (vide = leur couleur)' : ''
                    }" ${gel ? 'disabled' : ''} />`
          }</label>
          <label class="mt-sq-valeur">${e.action === 'breche' ? 'N° DE PORTE' : 'INTENSITÉ (%)'} <input data-sq="valeur" type="number" min="0" max="400" step="1" ${gel ? 'disabled' : ''} /></label>
          <label>DURÉE (s) <input data-sq="duree" type="number" min="0" max="60" step="0.5" ${gel ? 'disabled' : ''} /></label>
        </div>
        <div class="mt-outils">
          <button type="button" data-op="monte" title="Monter" ${gel || i === 0 ? 'disabled' : ''}>▲</button>
          <button type="button" data-op="descend" title="Descendre" ${gel || i === s.etapes.length - 1 ? 'disabled' : ''}>▼</button>
          <button type="button" data-op="retire" title="Retirer l'étape" ${gel || s.etapes.length <= 1 ? 'disabled' : ''}>✕</button>
        </div>`
      const ch = <T extends HTMLInputElement | HTMLSelectElement>(n: string) =>
        row.querySelector(`[data-sq=${n}]`) as T
      ch<HTMLSelectElement>('action').value = e.action
      ch<HTMLInputElement>('texte').value = e.texte
      ch<HTMLInputElement>('valeur').value = String(e.valeur)
      ch<HTMLInputElement>('duree').value = String(e.duree)
      row.classList.toggle('mt-avec-texte', champTexte(e.action) !== 'aucun')
      row.classList.toggle('mt-avec-nombre', champValeur(e.action))
      row.addEventListener('change', (ev) => {
        const nom = (ev.target as HTMLElement).dataset.sq
        if (!nom || gel) return
        this.editeSeqs(() => {
          if (nom === 'action') {
            e.action = ch<HTMLSelectElement>('action').value as ActionSeq
            this.dessineSequences() // les champs pertinents changent
            return
          }
          if (nom === 'texte') e.texte = ch<HTMLInputElement>('texte').value.slice(0, 300)
          else if (nom === 'valeur') {
            const v = Number(ch<HTMLInputElement>('valeur').value)
            e.valeur = Number.isFinite(v) ? Math.max(0, Math.min(400, Math.round(v))) : e.valeur
            ch<HTMLInputElement>('valeur').value = String(e.valeur)
          } else if (nom === 'duree') {
            const v = Number(ch<HTMLInputElement>('duree').value)
            e.duree = Number.isFinite(v) ? Math.max(0, Math.min(60, v)) : e.duree
            ch<HTMLInputElement>('duree').value = String(e.duree)
          }
        })
      })
      row.querySelector('.mt-outils')!.addEventListener('click', (ev) => {
        const btn = (ev.target as HTMLElement).closest('button[data-op]') as HTMLButtonElement | null
        if (!btn || btn.disabled) return
        this.editeSeqs(() => {
          const t = s.etapes
          if (btn.dataset.op === 'monte') [t[i - 1], t[i]] = [t[i], t[i - 1]]
          else if (btn.dataset.op === 'descend') [t[i], t[i + 1]] = [t[i + 1], t[i]]
          else t.splice(i, 1)
        })
        this.dessineSequences()
      })
      this.corpsEl.appendChild(row)
    })

    if (!gel) {
      const ajout = document.createElement('button')
      ajout.type = 'button'
      ajout.className = 'mt-ajout'
      ajout.textContent = '+ AJOUTER UNE ÉTAPE'
      ajout.addEventListener('click', () => {
        this.editeSeqs(() => s.etapes.push(etapeVierge()))
        this.dessineSequences()
      })
      this.corpsEl.appendChild(ajout)
    }
  }

  private dessine(): void {
    if (this.onglet === 'sequences') {
      this.dessineSequences()
      return
    }
    if (this.onglet === 'scenario') {
      this.dessineScenario()
      return
    }
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
