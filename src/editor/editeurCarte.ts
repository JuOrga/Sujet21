// L'ÉDITEUR DE LA CARTE DE LA STATION — le plan à routes ramifiées se
// dessine ici, à la souris ou au doigt, et s'exporte en carteStation.json.
//
// POURQUOI UN ÉDITEUR AVANT LA CARTE. La carte du concepteur (handoff
// « Carte de la station ») est une maquette : onze modules, douze coursives,
// des positions au pixel. La recopier en code, c'est la figer — la
// prochaine évolution redemanderait un développeur. Avec un éditeur, la
// carte est un DOCUMENT : on glisse un module, on trace une coursive, on
// change sa règle d'accès, on exporte, et le fichier JSON remplace l'ancien.
// Le jeu lit ce fichier ; rien de la carte n'est écrit en dur.
//
// TROIS COUCHES, SÉPARÉES. Le dessin (game/dessinCarte.ts) est pur et rend
// une chaîne SVG ; les gestes (carteOperations.ts) sont purs et modifient la
// carte ; ce fichier-ci ne fait que le DOM : traduire un pointeur en
// coordonnées de scène, tenir la sélection, peindre les panneaux. C'est ce
// qui rend le reste testable sans navigateur.
//
// LE MODE APERÇU JEU rejoue le comportement voulu de la carte in-game (le
// joueur sur un module, les cibles cliquables, le cadenas quand l'orbe
// manque, ENTRER) — sans quitter l'éditeur, pour vérifier qu'une
// carte se traverse avant de la livrer.

import {
  CARTE_LIVREE,
  FORMES_MODULE,
  TYPES_MODULE,
  cloneCarte,
  couleurTemperature,
  longueursTrajet,
  ORBES,
  liensDepuis,
  moduleParId,
  parseCarte,
  serialiseCarte,
  verifieCarte,
  zoneDe,
  type CarteStation,
  type ModuleCarte,
} from '../game/carteStation'
import { GLYPHES, dessinCarteSVG, esc, type OptionsDessin } from '../game/dessinCarte'
import { choixModules, entreModule as entreModuleCarte, type EtatCarteRun } from '../game/descenteCarte'
import {
  Historique,
  ajouteLien,
  ajouteModule,
  deplaceModule,
  inverseLien,
  modifieLien,
  poseChamp,
  redimensionneModule,
  renommeModule,
  supprimeLien,
  supprimeModule,
  type Poignee,
} from './carteOperations'

export interface HooksEditeurCarte {
  /** Quitter l'éditeur et revenir à la fiche d'essai. */
  quit(): void
}

/** Le document en cours, retenu d'une séance à l'autre sur ce poste. */
const CLE_CARTE = 'projet21.carte-station.v1'
const CLE_REGLAGES = 'projet21.carte-station.reglages.v1'

type Outil = 'selection' | 'lier'

interface Geste {
  genre: 'deplacer' | 'redimensionner' | 'lier'
  id: string
  poignee?: Poignee
  origine: { x: number; y: number; w: number; h: number }
  depart: { x: number; y: number }
  /** un geste qui n'a pas encore bougé n'entre pas dans l'historique */
  bouge: boolean
}

export class EditeurCarte {
  private carte: CarteStation = cloneCarte(CARTE_LIVREE)
  private hist = new Historique()
  private selection: string | null = null
  private lienSel: number | null = null
  private outil: Outil = 'selection'
  private mode: 'editeur' | 'jeu' = 'editeur'
  private grille = 8
  private aimant = true
  private typeLienNeuf = 'main'
  // l'aperçu jeu
  private courant = CARTE_LIVREE.regles.depart
  private visites: string[] = []
  /** les orbes acquis dans l'aperçu — décident des cadenas */
  private orbes = new Set<string>()
  private geste: Geste | null = null
  private brouillon: OptionsDessin['brouillon'] = null
  private svg: SVGSVGElement | null = null
  private image = 0
  visible = false

  constructor(
    private host: HTMLElement,
    private hooks: HooksEditeurCarte,
  ) {
    host.innerHTML = gabarit()
    this.litReglages()
    this.brancheBarre()
    this.brancheScene()
    this.branchePanneaux()
    window.addEventListener('keydown', (e) => this.clavier(e))
  }

  // ---- OUVERTURE / FERMETURE ------------------------------------------------

  open(): void {
    this.restaure()
    this.visible = true
    this.host.classList.add('visible')
    this.courant = this.carte.regles.depart
    this.visites = []
    this.orbes.clear()
    this.dessine()
  }

  close(): void {
    this.visible = false
    this.host.classList.remove('visible')
  }

  /** Échap : d'abord le geste en cours, puis la sélection ; rend false quand
   *  il n'y a plus rien à défaire — l'appelant quitte alors l'éditeur. */
  echap(): boolean {
    if (this.geste) {
      this.geste = null
      this.brouillon = null
      this.dessine()
      return true
    }
    if (this.outil === 'lier') {
      this.poseOutil('selection')
      return true
    }
    if (this.selection !== null || this.lienSel !== null) {
      this.selectionne(null, null)
      return true
    }
    return false
  }

  carteCourante(): CarteStation {
    return this.carte
  }

  // ---- PERSISTANCE ------------------------------------------------------------

  private persiste(): void {
    try {
      localStorage.setItem(CLE_CARTE, serialiseCarte(this.carte))
    } catch {
      // stockage refusé : l'édition continue, sans reprise après coup
    }
  }

  private restaure(): void {
    try {
      const brut = localStorage.getItem(CLE_CARTE)
      if (!brut) return
      const { carte } = parseCarte(JSON.parse(brut))
      if (carte) this.carte = carte
    } catch {
      // un document illisible ne doit pas empêcher d'ouvrir l'éditeur
    }
  }

  private litReglages(): void {
    try {
      const r = JSON.parse(localStorage.getItem(CLE_REGLAGES) ?? '{}') as {
        grille?: number
        aimant?: boolean
      }
      if (typeof r.grille === 'number' && r.grille >= 0) this.grille = r.grille
      if (typeof r.aimant === 'boolean') this.aimant = r.aimant
    } catch {
      // sans réglages retenus, les défauts font l'affaire
    }
    ;(this.el('ce-grille') as HTMLInputElement).value = String(this.grille)
    ;(this.el('ce-aimant') as HTMLInputElement).checked = this.aimant
  }

  private ecritReglages(): void {
    try {
      localStorage.setItem(CLE_REGLAGES, JSON.stringify({ grille: this.grille, aimant: this.aimant }))
    } catch {
      // idem
    }
  }

  // ---- LE CYCLE D'UNE MODIFICATION -----------------------------------------------

  /** Avant un geste qui change la carte : l'historique garde l'état d'avant. */
  private memorise(): void {
    this.hist.pousse(this.carte)
  }

  /** Après : on enregistre et on repeint. */
  private change(): void {
    this.persiste()
    this.dessine()
  }

  private annule(): void {
    const c = this.hist.annule(this.carte)
    if (!c) return
    this.carte = c
    this.garantitSelection()
    this.change()
  }

  private retablit(): void {
    const c = this.hist.retablit(this.carte)
    if (!c) return
    this.carte = c
    this.garantitSelection()
    this.change()
  }

  /** Une sélection qui ne désigne plus rien (module supprimé, lien parti) tombe. */
  private garantitSelection(): void {
    if (this.selection !== null && !moduleParId(this.carte, this.selection)) this.selection = null
    if (this.lienSel !== null && this.lienSel >= this.carte.liens.length) this.lienSel = null
    if (!moduleParId(this.carte, this.courant)) {
      this.courant = this.carte.regles.depart
      this.visites = []
    }
  }

  private selectionne(module: string | null, lien: number | null): void {
    this.selection = module
    this.lienSel = lien
    this.dessine()
  }

  // ---- LE DESSIN -------------------------------------------------------------------

  /** L'état de l'aperçu, dans les termes de la descente : le module courant
   *  y est toujours tenu pour épuisé (l'aperçu ne joue pas les salles). */
  private etatApercu(module = this.courant): EtatCarteRun {
    return { module, niveau: moduleParId(this.carte, module)?.niveaux ?? 0, visites: this.visites }
  }

  private options(): OptionsDessin {
    const jeu = this.mode === 'jeu'
    return {
      retour: jeu ? (choixModules(this.carte, this.etatApercu(), [...this.orbes]).find((x) => x.retour)?.module.id ?? null) : null,
      courant: jeu ? this.courant : null,
      visites: jeu ? this.visites : [],
      selection: this.selection,
      lienSelection: jeu ? null : this.lienSel,
      orbes: [...this.orbes],
      mode: jeu ? 'jeu' : 'editeur',
      cle: 'editeur', // l'aperçu jeu remplace le plan dans la même scène : une seule clé suffit
      afficherTemp: true,
      grille: this.grille,
      brouillon: this.brouillon,
    }
  }

  private dessine(): void {
    const hote = this.el('ce-scene')
    hote.innerHTML = dessinCarteSVG(this.carte, this.options())
    this.svg = hote.querySelector('svg')
    this.peintBarre()
    this.peintListes()
    this.peintPanneau()
    this.peintVerdicts()
  }

  /** Pendant un glissement, on ne repeint que la scène — et au plus une fois
   *  par image : les panneaux ne bougent pas, le pointeur si. */
  private redessineScene(): void {
    if (this.image) return
    this.image = requestAnimationFrame(() => {
      this.image = 0
      const hote = this.el('ce-scene')
      hote.innerHTML = dessinCarteSVG(this.carte, this.options())
      this.svg = hote.querySelector('svg')
      this.peintPanneau()
    })
  }

  private peintBarre(): void {
    ;(this.el('ce-undo') as HTMLButtonElement).disabled = !this.hist.peutAnnuler
    ;(this.el('ce-redo') as HTMLButtonElement).disabled = !this.hist.peutRetablir
    this.el('ce-lier').classList.toggle('active', this.outil === 'lier')
    const jeu = this.mode === 'jeu'
    this.el('ce-mode').textContent = jeu ? '✎ Édition' : '⏵ Aperçu jeu'
    this.el('ce-mode').classList.toggle('primary', !jeu)
    this.host.classList.toggle('ce-jeu', jeu)
    // la légende suit les types de coursive de la carte : un trait par type
    this.el('ce-legende').innerHTML =
      Object.entries(this.carte.typesLiens)
        .map(
          ([k, s]) =>
            `<span><i style="${s.tirets ? `height:0;border-top:2px dashed ${s.couleur}` : `background:${s.couleur};box-shadow:0 0 8px ${s.couleur}`}"></i>${esc((s.badge ?? k).toUpperCase())}${s.condition ? ' 🔒' : ''}</span>`,
        )
        .join('') +
      `<span><i style="width:10px;height:10px;border-radius:50%;border:2px solid #7f9cb0;background:none"></i>${esc(this.carte.types.jonction)}</span>`
    const types = this.el('ce-type-lien') as HTMLSelectElement
    if (!this.carte.typesLiens[this.typeLienNeuf]) this.typeLienNeuf = Object.keys(this.carte.typesLiens)[0] ?? 'main'
    types.innerHTML = Object.keys(this.carte.typesLiens)
      .map((t) => `<option value="${esc(t)}"${t === this.typeLienNeuf ? ' selected' : ''}>${esc(t)}</option>`)
      .join('')
  }

  private peintListes(): void {
    const c = this.carte
    this.el('ce-liste-modules').innerHTML = c.modules
      .map((m) => {
        const z = zoneDe(c, m)
        return (
          `<button type="button" class="ce-item${m.id === this.selection ? ' active' : ''}" data-mod-liste="${esc(m.id)}" style="--z:${z?.couleur ?? '#7f9cb0'}">` +
          `<i></i><b>${esc(m.id)}</b><span>${esc(m.nom)}${m.niveaux > 0 ? ` · ${m.niveaux} niv.` : ''}</span><em>${GLYPHES[m.type] || '○'}</em></button>`
        )
      })
      .join('')
    this.el('ce-liste-liens').innerHTML = c.liens
      .map((l, i) => {
        const st = c.typesLiens[l.type]
        return (
          `<button type="button" class="ce-item${i === this.lienSel ? ' active' : ''}" data-lien-liste="${i}" style="--z:${st?.couleur ?? '#7f9cb0'}">` +
          `<i></i><b>${esc(l.de)} → ${esc(l.vers)}</b><span>${esc(l.type)}${st?.badge ? ' · ' + esc(st.badge) : ''}</span></button>`
        )
      })
      .join('')
  }

  private peintVerdicts(): void {
    const v = verifieCarte(this.carte)
    const hote = this.el('ce-verdicts')
    const t = longueursTrajet(this.carte)
    const trajet = t ? ` · trajet ${t.min === t.max ? `${t.min}` : `${t.min} à ${t.max}`} niveaux` : ''
    if (v.length === 0) {
      hote.innerHTML = `<p class="ce-ok">✓ carte cohérente — ${this.carte.modules.length} modules, ${this.carte.liens.length} coursives${trajet}</p>`
      return
    }
    hote.innerHTML = v
      .map(
        (x) =>
          `<button type="button" class="ce-verdict ce-${x.niveau}"` +
          (x.module ? ` data-mod-liste="${esc(x.module)}"` : x.lien !== undefined ? ` data-lien-liste="${x.lien}"` : '') +
          `>${x.niveau === 'erreur' ? '✕' : '△'} ${esc(x.message)}</button>`,
      )
      .join('')
  }

  // ---- LE PANNEAU DE DROITE ---------------------------------------------------------

  private peintPanneau(): void {
    const p = this.el('ce-panneau')
    if (this.mode === 'jeu') {
      p.innerHTML = this.ficheJeu()
      return
    }
    const m = this.selection !== null ? moduleParId(this.carte, this.selection) : undefined
    if (m) p.innerHTML = this.formulaireModule(m)
    else if (this.lienSel !== null && this.carte.liens[this.lienSel]) p.innerHTML = this.formulaireLien(this.lienSel)
    else p.innerHTML = this.formulaireCarte()
  }

  private champ(chemin: string, libelle: string, valeur: unknown, attrs = ''): string {
    const v = valeur === null || valeur === undefined ? '' : String(valeur)
    return (
      `<label class="ce-f"><span>${libelle}</span>` +
      `<input data-chemin="${esc(chemin)}" value="${esc(v)}" ${attrs}/></label>`
    )
  }

  private choix(chemin: string, libelle: string, valeur: string | number, options: [string | number, string][]): string {
    return (
      `<label class="ce-f"><span>${libelle}</span><select data-chemin="${esc(chemin)}">` +
      options
        .map(([v, t]) => `<option value="${esc(String(v))}"${String(v) === String(valeur) ? ' selected' : ''}>${esc(t)}</option>`)
        .join('') +
      `</select></label>`
    )
  }

  private formulaireModule(m: ModuleCarte): string {
    const c = this.carte
    const i = c.modules.indexOf(m)
    const z = zoneDe(c, m)
    const P = `modules.${i}.`
    const modulesOptions = c.modules.filter((o) => o.id !== m.id).map((o): [string, string] => [o.id, `${o.id} — ${o.nom}`])
    return (
      `<div class="ce-group"><span class="k" style="--z:${z?.couleur ?? '#7f9cb0'}">Module <b>${esc(m.id)}</b></span>` +
      `<label class="ce-f"><span>Identifiant</span><input id="ce-id" value="${esc(m.id)}" spellcheck="false"/></label>` +
      `<p class="ce-erreur" id="ce-id-erreur"></p>` +
      this.champ(P + 'nom', 'Nom (sur le plan)', m.nom) +
      this.choix(P + 'type', 'Nature', m.type, TYPES_MODULE.map((t) => [t, `${GLYPHES[t] || '○'} ${c.types[t]} (${t})`])) +
      this.choix(P + 'zone', 'Zone', m.zone, c.zones.map((zz) => [zz.id, `${zz.code} · ${zz.nom}`])) +
      this.choix(P + 'forme', 'Silhouette', m.forme, FORMES_MODULE.map((f) => [f, f])) +
      `<div class="ce-grille2">` +
      this.champ(P + 'niveaux', 'Niveaux (salles)', m.niveaux, 'type="number" step="1" min="0" title="Un module est un biome : le nombre de salles qu’on y joue avant que la carte ne s’ouvre à nouveau. 0 : un lieu sans salle (hub, nœud)"') +
      this.champ(P + 'biome', 'Code de biome', m.biome, 'spellcheck="false" title="Le code du biome dans la nomenclature atelier : la pioche ne tirera que des tableaux qui le portent"') +
      `</div><div class="ce-grille2">` +
      this.champ(P + 'x', 'x (centre)', m.x, 'type="number" step="1"') +
      this.champ(P + 'y', 'y (centre)', m.y, 'type="number" step="1"') +
      this.champ(P + 'w', 'largeur', m.w, 'type="number" step="1" min="32"') +
      this.champ(P + 'h', 'hauteur', m.h, 'type="number" step="1" min="32"') +
      `</div>` +
      this.champ(P + 'temp', 'Température (°C)', m.temp, 'type="number" step="1"') +
      `<label class="ce-f" title="Une cache : l’orbe pris quand le module est épuisé, une fois par poste"><span>Orbe recelé</span><select id="ce-orbe">` +
      `<option value=""${m.orbe ? '' : ' selected'}>— aucun —</option>` +
      ORBES.map((o) => `<option value="${esc(o.id)}"${m.orbe === o.id ? ' selected' : ''}>${esc(o.id)} · ${esc(o.nom)}</option>`).join('') +
      `</select></label>` +
      `<label class="ce-f"><span>Description</span><textarea data-chemin="${P}desc" rows="3">${esc(m.desc)}</textarea></label>` +
      `</div>` +
      `<div class="ce-group"><span class="k">Coursives depuis ${esc(m.id)}</span>` +
      (liensDepuis(c, m.id)
        .map((l) => `<button type="button" class="ce-item" data-lien-liste="${c.liens.indexOf(l)}"><b>→ ${esc(l.vers)}</b><span>${esc(l.type)}</span></button>`)
        .join('') || `<p class="ce-note">aucune — cul-de-sac</p>`) +
      (modulesOptions.length
        ? `<div class="ce-ligne"><select id="ce-lier-vers">${modulesOptions.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('')}</select>` +
          `<button type="button" id="ce-lier-ajouter" title="Trace une coursive de ce module vers celui choisi, du type réglé dans la barre">+ Lier</button></div>`
        : '') +
      `</div>` +
      `<div class="ce-group"><span class="k">Vers ${esc(m.id)}</span>` +
      (c.liens
        .filter((l) => l.vers === m.id)
        .map((l) => `<button type="button" class="ce-item" data-lien-liste="${c.liens.indexOf(l)}"><b>${esc(l.de)} →</b><span>${esc(l.type)}</span></button>`)
        .join('') || `<p class="ce-note">aucune — inatteignable</p>`) +
      `</div>` +
      `<div class="ce-group">` +
      `<button type="button" id="ce-depart" ${c.regles.depart === m.id ? 'disabled' : ''}>⌂ En faire le départ</button>` +
      `<button type="button" id="ce-objectif" ${c.regles.objectif === m.id ? 'disabled' : ''}>⚑ En faire l’objectif</button>` +
      `<button type="button" id="ce-dupliquer">⧉ Dupliquer</button>` +
      `<button type="button" id="ce-supprimer" class="ce-danger">✕ Supprimer le module</button>` +
      `</div>`
    )
  }

  private formulaireLien(i: number): string {
    const c = this.carte
    const l = c.liens[i]
    const st = c.typesLiens[l.type]
    const mods = c.modules.map((m): [string, string] => [m.id, `${m.id} — ${m.nom}`])
    return (
      `<div class="ce-group"><span class="k" style="--z:${st?.couleur ?? '#7f9cb0'}">Coursive <b>${esc(l.de)} → ${esc(l.vers)}</b></span>` +
      this.choix(`liens.${i}.de`, 'Départ', l.de, mods) +
      this.choix(`liens.${i}.vers`, 'Arrivée', l.vers, mods) +
      this.choix(`liens.${i}.type`, 'Type', l.type, Object.keys(c.typesLiens).map((t) => [t, t])) +
      `<p class="ce-note">${st?.condition ? `accès : ${esc(st.condition)}` : 'passage libre'}${st?.badge ? ` · badge ${esc(st.badge)}` : ''}</p>` +
      `<p class="ce-erreur" id="ce-lien-erreur"></p>` +
      `</div><div class="ce-group">` +
      `<button type="button" id="ce-inverser">⇄ Inverser le sens</button>` +
      `<button type="button" id="ce-supprimer-lien" class="ce-danger">✕ Supprimer la coursive</button>` +
      `</div>`
    )
  }

  private formulaireCarte(): string {
    const c = this.carte
    const mods = c.modules.map((m): [string, string] => [m.id, `${m.id} — ${m.nom}`])
    return (
      `<div class="ce-group"><span class="k">La carte</span>` +
      `<p class="ce-note">Cliquez un module ou une coursive pour l’éditer. Glissez un module pour le déplacer, ses coins pour le redimensionner. « Lier » (ou Maj + glisser) trace une coursive d’un module à un autre.</p>` +
      this.choix('regles.depart', 'Départ', c.regles.depart, mods) +
      this.choix('regles.objectif', 'Objectif', c.regles.objectif, mods) +
      `<div class="ce-grille2">` +
      this.champ('scene.width', 'scène : largeur', c.scene.width, 'type="number" step="1" min="200"') +
      this.champ('scene.height', 'scène : hauteur', c.scene.height, 'type="number" step="1" min="200"') +
      `</div></div>` +
      `<div class="ce-group"><span class="k">Zones</span>` +
      c.zones
        .map(
          (z, i) =>
            `<div class="ce-ligne" style="--z:${z.couleur}"><i class="ce-pastille"></i>` +
            `<input data-chemin="zones.${i}.code" value="${esc(z.code)}" style="width:52px" title="code"/>` +
            `<input data-chemin="zones.${i}.nom" value="${esc(z.nom)}" title="nom"/>` +
            `<input data-chemin="zones.${i}.couleur" value="${esc(z.couleur)}" type="color" title="couleur"/></div>`,
        )
        .join('') +
      `<button type="button" id="ce-zone-ajouter">+ Zone</button></div>` +
      `<div class="ce-group"><span class="k">Types de coursive</span>` +
      Object.entries(c.typesLiens)
        .map(
          ([k, s]) =>
            `<details class="ce-type" style="--z:${s.couleur}"><summary><i class="ce-pastille"></i>${esc(k)}${s.badge ? ` · ${esc(s.badge)}` : ''}${s.condition ? ' · 🔒' : ''}</summary>` +
            this.champ(`typesLiens.${k}.couleur`, 'couleur', s.couleur, 'type="color"') +
            `<div class="ce-grille2">` +
            this.champ(`typesLiens.${k}.epaisseur`, 'trait', s.epaisseur, 'type="number" step="0.5" min="0.5"') +
            this.champ(`typesLiens.${k}.coque`, 'coque', s.coque, 'type="number" step="1" min="4"') +
            `</div>` +
            this.champ(`typesLiens.${k}.tirets`, 'tirets (ex. « 6 8 »)', s.tirets ?? '') +
            this.champ(`typesLiens.${k}.condition`, 'condition (ex. « orbe == solidification »)', s.condition ?? '') +
            this.champ(`typesLiens.${k}.badge`, 'badge', s.badge ?? '') +
            `</details>`,
        )
        .join('') +
      `<p class="ce-note">orbes connus : ${ORBES.map((o) => esc(o.id)).join(', ')}</p>` +
      `<button type="button" id="ce-type-ajouter">+ Type de coursive</button></div>`
    )
  }

  /** LA FICHE DE L'APERÇU JEU : la maquette, en lecture — le module visé,
   *  sa zone, sa température, l'accès, et le bouton ENTRER. */
  private ficheJeu(): string {
    const c = this.carte
    const m = (this.selection !== null ? moduleParId(c, this.selection) : undefined) ?? moduleParId(c, this.courant)
    if (!m) return `<p class="ce-note">Aucun module.</p>`
    const z = zoneDe(c, m)
    const choix = choixModules(c, this.etatApercu(), [...this.orbes]).find((x) => x.module.id === m.id)
    const lien = choix?.lien
    const requis = choix?.orbeManquant ?? null
    const ici = m.id === this.courant
    const traverse = this.visites.includes(m.id)
    const bloque = !choix || requis !== null
    const etat = ici ? 'POSITION' : choix?.retour ? 'RETOUR' : traverse ? 'TRAVERSÉ' : lien ? (requis ? 'VERROUILLÉ' : 'ACCESSIBLE') : 'HORS DE PORTÉE'
    const couleurEtat = ici ? '#a7ddf5' : lien && !requis ? '#3fd69b' : requis ? '#e0685c' : '#7f9cb0'
    const nomOrbe = (id: string): string => ORBES.find((o) => o.id === id)?.nom ?? id
    const acces = requis
      ? `Orbe nécessaire : ${nomOrbe(requis)}.`
      : choix?.retour
        ? 'Revenir sur ses pas — l’objectif est hors de portée d’ici.'
        : lien
          ? `Coursive « ${lien.type} ».`
          : ici
            ? 'Vous êtes ici.'
            : 'Aucun passage direct depuis votre position.'
    const tc = couleurTemperature(c, m.temp)
    return (
      `<div class="ce-fiche" style="--z:${z?.couleur ?? '#7f9cb0'}">` +
      `<div class="ce-fiche-tete"><span>MODULE SÉLECTIONNÉ</span><span class="ce-fiche-type">${esc(c.types[m.type])}</span></div>` +
      `<div class="ce-fiche-vignette">${GLYPHES[m.type] || '○'}</div>` +
      `<h3>${esc(m.nom)}</h3>` +
      `<div class="ce-fiche-zone">${esc(z ? `${z.code} · ${z.nom}` : '—')}</div>` +
      `<p>${esc(m.desc)}</p>` +
      `<div class="ce-grille2">` +
      `<div class="ce-case"><small>TEMPÉRATURE</small><b style="color:${tc}">${m.temp}°C</b></div>` +
      `<div class="ce-case"><small>ÉTAT</small><b style="color:${couleurEtat}">${etat}</b></div>` +
      `</div>` +
      `<p class="ce-acces" style="color:${requis ? '#e0685c' : '#7f9cb0'}">${esc(acces)}</p>` +
      `<button type="button" id="ce-entrer" class="ce-entrer" ${bloque ? 'disabled' : ''}>${bloque ? (requis ? 'ACCÈS REFUSÉ' : 'INACCESSIBLE') : 'ENTRER →'}</button>` +
      `</div>` +
      `<div class="ce-group"><span class="k">Orbes acquis</span>` +
      `<p class="ce-note">Chaque orbe est une transformation ou un état du cycle. Cochez ce que le sujet possède : les cadenas suivent.</p>` +
      `<div class="ce-orbes">${ORBES.map((o) => `<button type="button" class="ce-etat${this.orbes.has(o.id) ? ' active' : ''}" data-orbe="${esc(o.id)}" title="${esc(o.nom)}">${esc(o.id)}</button>`).join('')}</div>` +
      `<p class="ce-note">modules traversés : ${this.visites.length + 1} · objectif : ${esc(c.regles.objectif)}${this.courant === c.regles.objectif ? ' — ATTEINT' : ''}</p>` +
      `<button type="button" id="ce-rejouer">↺ Revenir au départ</button></div>`
    )
  }

  // ---- LA BARRE ----------------------------------------------------------------------

  private poseOutil(o: Outil): void {
    this.outil = o
    this.peintBarre()
  }

  private brancheBarre(): void {
    this.el('ce-module').addEventListener('click', () => {
      this.memorise()
      const m = ajouteModule(this.carte, this.carte.scene.width / 2, this.carte.scene.height / 2, this.pas())
      this.selection = m.id
      this.lienSel = null
      this.change()
    })
    this.el('ce-lier').addEventListener('click', () => this.poseOutil(this.outil === 'lier' ? 'selection' : 'lier'))
    this.el('ce-type-lien').addEventListener('change', (e) => {
      this.typeLienNeuf = (e.target as HTMLSelectElement).value
    })
    this.el('ce-undo').addEventListener('click', () => this.annule())
    this.el('ce-redo').addEventListener('click', () => this.retablit())
    this.el('ce-grille').addEventListener('change', (e) => {
      const v = Number((e.target as HTMLInputElement).value)
      this.grille = Number.isFinite(v) && v >= 0 ? v : 8
      this.ecritReglages()
      this.dessine()
    })
    this.el('ce-aimant').addEventListener('change', (e) => {
      this.aimant = (e.target as HTMLInputElement).checked
      this.ecritReglages()
    })
    this.el('ce-mode').addEventListener('click', () => {
      this.mode = this.mode === 'jeu' ? 'editeur' : 'jeu'
      if (this.mode === 'jeu') {
        this.courant = this.carte.regles.depart
        this.visites = []
        this.orbes.clear()
        this.selection = this.cibleParDefaut(this.courant)
        this.lienSel = null
        this.outil = 'selection'
      }
      this.dessine()
    })
    this.el('ce-export').addEventListener('click', () => this.exporte())
    this.el('ce-copier').addEventListener('click', () => {
      void navigator.clipboard?.writeText(serialiseCarte(this.carte)).then(
        () => this.signale('JSON copié dans le presse-papiers'),
        () => this.signale('copie refusée par le navigateur'),
      )
    })
    this.el('ce-import').addEventListener('click', () => (this.el('ce-fichier') as HTMLInputElement).click())
    this.el('ce-fichier').addEventListener('change', (e) => {
      const f = (e.target as HTMLInputElement).files?.[0]
      if (!f) return
      void f.text().then((t) => this.importe(t))
      ;(e.target as HTMLInputElement).value = ''
    })
    this.el('ce-coller').addEventListener('click', () => {
      const t = window.prompt('Collez ici le JSON de la carte :')
      if (t) this.importe(t)
    })
    this.el('ce-reset').addEventListener('click', () => {
      if (!window.confirm('Revenir à la carte livrée avec le jeu ? Le document en cours est remplacé (annulable par ↶).')) return
      this.memorise()
      this.carte = cloneCarte(CARTE_LIVREE)
      this.selection = null
      this.lienSel = null
      this.garantitSelection()
      this.change()
    })
    this.el('ce-quit').addEventListener('click', () => this.hooks.quit())
  }

  private pas(): number {
    return this.aimant ? this.grille : 0
  }

  private signale(texte: string): void {
    const s = this.el('ce-signal')
    s.textContent = texte
    s.classList.add('on')
    window.setTimeout(() => s.classList.remove('on'), 2200)
  }

  private exporte(): void {
    const blob = new Blob([serialiseCarte(this.carte)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'carteStation.json'
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    this.signale('carteStation.json exporté — à déposer dans src/game/')
  }

  private importe(texte: string): void {
    let brut: unknown
    try {
      brut = JSON.parse(texte)
    } catch {
      this.signale('ce n’est pas du JSON')
      return
    }
    const { carte, erreurs } = parseCarte(brut)
    if (!carte) {
      window.alert(`La carte n’a pas pu être lue :\n\n${erreurs.join('\n')}`)
      return
    }
    this.memorise()
    this.carte = carte
    this.selection = null
    this.lienSel = null
    this.garantitSelection()
    this.change()
    this.signale(`carte importée : ${carte.modules.length} modules, ${carte.liens.length} coursives`)
  }

  // ---- LA SCÈNE : POINTEUR --------------------------------------------------------------

  /** Le pointeur, en coordonnées de scène — par la matrice du SVG, quelle
   *  que soit l'échelle à laquelle le navigateur l'a ajusté. */
  private point(e: PointerEvent): { x: number; y: number } {
    const svg = this.svg
    if (!svg) return { x: 0, y: 0 }
    const m = svg.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }

  private brancheScene(): void {
    const hote = this.el('ce-scene')
    hote.addEventListener('pointerdown', (e) => this.pointeurBas(e))
    hote.addEventListener('pointermove', (e) => this.pointeurBouge(e))
    hote.addEventListener('pointerup', (e) => this.pointeurHaut(e))
    hote.addEventListener('pointercancel', () => {
      this.geste = null
      this.brouillon = null
      this.dessine()
    })
    // le clavier vise aussi : Tab parcourt les modules (tabindex), Entrée sélectionne
    hote.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      const id = (e.target as Element | null)?.closest?.('[data-mod]')?.getAttribute('data-mod')
      if (id) {
        e.preventDefault()
        this.clicModule(id)
      }
    })
  }

  private pointeurBas(e: PointerEvent): void {
    if (e.button !== 0) return
    const cible = e.target as Element
    const gPoignee = cible.closest?.('[data-poignee]')
    const gMod = cible.closest?.('[data-mod]')
    const gLien = cible.closest?.('[data-lien]')
    const p = this.point(e)
    const hote = this.el('ce-scene')

    if (this.mode === 'jeu') {
      const id = gMod?.getAttribute('data-mod')
      if (id) this.clicModule(id)
      return
    }
    if (gPoignee && this.selection !== null) {
      const m = moduleParId(this.carte, this.selection)
      if (!m) return
      this.geste = {
        genre: 'redimensionner', id: m.id, poignee: gPoignee.getAttribute('data-poignee') as Poignee,
        origine: { x: m.x, y: m.y, w: m.w, h: m.h }, depart: p, bouge: false,
      }
      hote.setPointerCapture(e.pointerId)
      e.preventDefault()
      return
    }
    const id = gMod?.getAttribute('data-mod')
    if (id) {
      const m = moduleParId(this.carte, id)
      if (!m) return
      if (this.outil === 'lier' || e.shiftKey) {
        this.geste = { genre: 'lier', id, origine: { x: m.x, y: m.y, w: m.w, h: m.h }, depart: p, bouge: false }
        this.brouillon = { x1: m.x, y1: m.y, x2: p.x, y2: p.y }
      } else {
        this.selection = id
        this.lienSel = null
        this.geste = { genre: 'deplacer', id, origine: { x: m.x, y: m.y, w: m.w, h: m.h }, depart: p, bouge: false }
      }
      hote.setPointerCapture(e.pointerId)
      e.preventDefault()
      this.dessine()
      return
    }
    const li = gLien?.getAttribute('data-lien')
    if (li !== null && li !== undefined) {
      this.selectionne(null, Number(li))
      return
    }
    if (this.selection !== null || this.lienSel !== null) this.selectionne(null, null)
  }

  private pointeurBouge(e: PointerEvent): void {
    const g = this.geste
    if (!g) return
    const p = this.point(e)
    const dx = p.x - g.depart.x
    const dy = p.y - g.depart.y
    if (!g.bouge) {
      if (Math.hypot(dx, dy) < 2) return
      g.bouge = true
      if (g.genre !== 'lier') this.memorise()
    }
    if (g.genre === 'deplacer') deplaceModule(this.carte, g.id, g.origine.x + dx, g.origine.y + dy, this.pas())
    else if (g.genre === 'redimensionner' && g.poignee)
      redimensionneModule(this.carte, g.id, g.poignee, g.origine, dx, dy, this.pas())
    else if (g.genre === 'lier') this.brouillon = { x1: g.origine.x, y1: g.origine.y, x2: p.x, y2: p.y }
    this.redessineScene()
  }

  private pointeurHaut(e: PointerEvent): void {
    const g = this.geste
    if (!g) return
    this.geste = null
    if (g.genre === 'lier') {
      this.brouillon = null
      const p = this.point(e)
      const vers = this.moduleSous(p.x, p.y)
      if (vers && vers !== g.id) {
        this.memorise()
        const i = ajouteLien(this.carte, g.id, vers, this.typeLienNeuf)
        if (i >= 0) {
          this.selection = null
          this.lienSel = i
          this.change()
          return
        }
        this.hist.annule(this.carte) // rien n'a changé : on ne laisse pas une étape vide
        this.signale('coursive refusée : elle existe déjà')
      } else if (!g.bouge) {
        // un simple clic en mode « lier » : sélectionner, pour lire la fiche
        this.selection = g.id
        this.lienSel = null
      }
      this.dessine()
      return
    }
    if (g.bouge) this.change()
    else this.dessine()
  }

  /** Le module sous un point de scène — par la géométrie, car sous le doigt
   *  qui relâche se trouve la ligne brouillon, pas le module. */
  private moduleSous(x: number, y: number): string | null {
    for (let i = this.carte.modules.length - 1; i >= 0; i--) {
      const m = this.carte.modules[i]
      if (Math.abs(x - m.x) <= m.w / 2 && Math.abs(y - m.y) <= m.h / 2) return m.id
    }
    return null
  }

  /** L'aperçu jeu : cliquer un module, c'est le viser ; le bouton ENTRER y va. */
  private clicModule(id: string): void {
    if (this.mode !== 'jeu') {
      this.selectionne(id, null)
      return
    }
    this.selectionne(id, null)
  }


  /** La cible proposée d'office depuis `id` : la première coursive que
   *  l'état du sujet laisse passer — sinon la première tout court, pour que
   *  la fiche explique le refus. Null en cul-de-sac. */
  private cibleParDefaut(id: string): string | null {
    const choix = choixModules(this.carte, this.etatApercu(id), [...this.orbes])
    const ouvert = choix.find((x) => !x.orbeManquant)
    return (ouvert ?? choix[0])?.module.id ?? null
  }

  private entre(): void {
    const cible = this.selection
    if (cible === null) return
    // le même chemin que le jeu (descenteCarte) : coursives, cadenas, retour
    const suivant = entreModuleCarte(this.carte, this.etatApercu(), cible, [...this.orbes])
    if (!suivant) return
    this.visites = suivant.visites
    this.courant = suivant.module
    this.selection = this.cibleParDefaut(this.courant) ?? this.courant
    this.dessine()
  }

  // ---- LES PANNEAUX ---------------------------------------------------------------------

  private branchePanneaux(): void {
    // les listes et les verdicts : un clic sélectionne
    this.host.addEventListener('click', (e) => {
      const t = e.target as Element
      const bm = t.closest?.('[data-mod-liste]')
      if (bm) {
        this.selectionne(bm.getAttribute('data-mod-liste'), null)
        return
      }
      const bl = t.closest?.('[data-lien-liste]')
      if (bl) {
        this.selectionne(null, Number(bl.getAttribute('data-lien-liste')))
        return
      }
      const bo = t.closest?.('[data-orbe]')
      if (bo) {
        const id = bo.getAttribute('data-orbe') ?? ''
        if (this.orbes.has(id)) this.orbes.delete(id)
        else this.orbes.add(id)
        this.dessine()
        return
      }
      const id = (t.closest?.('button') as HTMLButtonElement | null)?.id
      if (!id) return
      this.boutonPanneau(id)
    })
    // les champs : un chemin, une valeur
    const applique = (el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, direct: boolean): void => {
      const chemin = el.dataset.chemin
      if (!chemin) return
      if (!direct) this.memorise()
      if (!poseChamp(this.carte, chemin, el.value)) {
        if (!direct) this.hist.annule(this.carte)
        el.classList.add('ce-invalide')
        return
      }
      el.classList.remove('ce-invalide')
      this.persiste()
      // un texte qui se tape se voit sans que le champ perde la main : on ne
      // repeint que la scène ; le formulaire se repeint au « change »
      if (direct) this.redessineSceneSeule()
      else this.change()
    }
    this.host.addEventListener('input', (e) => {
      const el = e.target as HTMLInputElement
      if (el.dataset.chemin && (el.type === 'text' || el.tagName === 'TEXTAREA' || el.type === 'color')) {
        if (!el.dataset.memorise) {
          this.memorise()
          el.dataset.memorise = '1'
        }
        applique(el, true)
      }
    })
    this.host.addEventListener('change', (e) => {
      const el = e.target as HTMLInputElement
      if (el.id === 'ce-orbe') {
        const m = this.selection !== null ? moduleParId(this.carte, this.selection) : undefined
        if (!m) return
        this.memorise()
        if (el.value) m.orbe = el.value
        else delete m.orbe
        this.change()
        return
      }
      if (el.id === 'ce-id') {
        this.memorise()
        const err = renommeModule(this.carte, this.selection ?? '', el.value)
        if (err) {
          this.hist.annule(this.carte)
          this.el('ce-id-erreur').textContent = err
          return
        }
        this.selection = el.value.trim()
        this.change()
        return
      }
      if (!el.dataset.chemin) return
      const memorise = el.dataset.memorise === '1'
      delete el.dataset.memorise
      if (/^liens\.\d+\./.test(el.dataset.chemin)) {
        // une coursive se modifie par modifieLien, qui refuse les doublons
        const [, i, champ] = /^liens\.(\d+)\.(\w+)$/.exec(el.dataset.chemin) ?? []
        this.memorise()
        if (!modifieLien(this.carte, Number(i), { [champ]: el.value })) {
          this.hist.annule(this.carte)
          this.el('ce-lien-erreur').textContent = 'refusé : coursive en double, ou reliée à elle-même'
          return
        }
        this.change()
        return
      }
      applique(el, memorise)
    })
  }

  private redessineSceneSeule(): void {
    if (this.image) return
    this.image = requestAnimationFrame(() => {
      this.image = 0
      const hote = this.el('ce-scene')
      hote.innerHTML = dessinCarteSVG(this.carte, this.options())
      this.svg = hote.querySelector('svg')
      this.peintListes()
      this.peintVerdicts()
    })
  }

  private boutonPanneau(id: string): void {
    const c = this.carte
    const sel = this.selection
    switch (id) {
      case 'ce-supprimer':
        if (sel === null) return
        this.memorise()
        supprimeModule(c, sel)
        this.selection = null
        this.garantitSelection()
        this.change()
        return
      case 'ce-dupliquer': {
        const m = sel !== null ? moduleParId(c, sel) : undefined
        if (!m) return
        this.memorise()
        const n = ajouteModule(c, m.x + m.w + 24, m.y, this.pas())
        Object.assign(n, {
          nom: m.nom, type: m.type, zone: m.zone, w: m.w, h: m.h, temp: m.temp, forme: m.forme,
          niveaux: m.niveaux, biome: m.biome, desc: m.desc, ...(m.orbe ? { orbe: m.orbe } : {}),
        })
        this.selection = n.id
        this.change()
        return
      }
      case 'ce-depart':
        if (sel === null) return
        this.memorise()
        c.regles.depart = sel
        this.change()
        return
      case 'ce-objectif':
        if (sel === null) return
        this.memorise()
        c.regles.objectif = sel
        this.change()
        return
      case 'ce-lier-ajouter': {
        const vers = (this.host.querySelector('#ce-lier-vers') as HTMLSelectElement | null)?.value
        if (sel === null || !vers) return
        this.memorise()
        const i = ajouteLien(c, sel, vers, this.typeLienNeuf)
        if (i < 0) {
          this.hist.annule(c)
          this.signale('coursive refusée : elle existe déjà')
          return
        }
        this.change()
        return
      }
      case 'ce-inverser':
        if (this.lienSel === null) return
        this.memorise()
        if (!inverseLien(c, this.lienSel)) {
          this.hist.annule(c)
          this.signale('l’inverse existe déjà')
          return
        }
        this.change()
        return
      case 'ce-supprimer-lien':
        if (this.lienSel === null) return
        this.memorise()
        supprimeLien(c, this.lienSel)
        this.lienSel = null
        this.change()
        return
      case 'ce-zone-ajouter': {
        this.memorise()
        const idZ = c.zones.reduce((m, z) => Math.max(m, z.id), -1) + 1
        c.zones.push({ id: idZ, code: `Z-${String(idZ + 1).padStart(2, '0')}`, nom: 'Nouvelle zone', couleur: '#7f9cb0' })
        this.change()
        return
      }
      case 'ce-type-ajouter': {
        this.memorise()
        let k = 'type'
        for (let n = 2; c.typesLiens[k]; n++) k = `type${n}`
        c.typesLiens[k] = { couleur: '#7f9cb0', epaisseur: 2.5, coque: 18, condition: null }
        this.change()
        return
      }
      case 'ce-entrer':
        this.entre()
        return
      case 'ce-rejouer':
        this.courant = c.regles.depart
        this.visites = []
        this.selection = this.cibleParDefaut(this.courant)
        this.dessine()
        return
    }
  }

  // ---- LE CLAVIER ---------------------------------------------------------------------------

  private clavier(e: KeyboardEvent): void {
    if (!this.visible) return
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
    const ctrl = e.ctrlKey || e.metaKey
    if (ctrl && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      if (e.shiftKey) this.retablit()
      else this.annule()
      return
    }
    if (ctrl && e.key.toLowerCase() === 'y') {
      e.preventDefault()
      this.retablit()
      return
    }
    if (this.mode === 'jeu') {
      if (e.key === 'Enter') this.entre()
      return
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selection !== null) this.boutonPanneau('ce-supprimer')
      else if (this.lienSel !== null) this.boutonPanneau('ce-supprimer-lien')
      return
    }
    if (e.key === 'l' || e.key === 'L') {
      this.poseOutil(this.outil === 'lier' ? 'selection' : 'lier')
      return
    }
    const fleche: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    }
    const f = fleche[e.key]
    if (f && this.selection !== null) {
      e.preventDefault()
      const m = moduleParId(this.carte, this.selection)
      if (!m) return
      const pas = (this.grille > 0 ? this.grille : 1) * (e.shiftKey ? 5 : 1)
      this.memorise()
      deplaceModule(this.carte, m.id, m.x + f[0] * pas, m.y + f[1] * pas, 0)
      this.change()
    }
  }

  private el(id: string): HTMLElement {
    const e = this.host.querySelector<HTMLElement>(`#${id}`)
    if (!e) throw new Error(`éditeur de carte : #${id} manque dans le gabarit`)
    return e
  }
}

/** Le gabarit de l'écran : la barre, deux colonnes, la scène au milieu. */
function gabarit(): string {
  return (
    `<div class="ce-bar">` +
    `<span class="ce-title">CARTE DE LA STATION</span>` +
    `<button type="button" id="ce-module" title="Ajoute un module au centre de la scène — glissez-le ensuite">+ Module</button>` +
    `<button type="button" id="ce-lier" title="Tracer une coursive : glissez d'un module à un autre (L, ou Maj + glisser)">⟶ Lier</button>` +
    `<label class="ce-f ce-f--ligne" title="Le type des coursives qu'on trace"><span>type</span><select id="ce-type-lien"></select></label>` +
    `<button type="button" id="ce-undo" title="Annuler (Ctrl+Z)" disabled>↶</button>` +
    `<button type="button" id="ce-redo" title="Rétablir (Ctrl+Y ou Ctrl+Maj+Z)" disabled>↷</button>` +
    `<button type="button" id="ce-import" title="Importer un carteStation.json">Fichier</button>` +
    `<input type="file" id="ce-fichier" accept="application/json,.json" hidden/>` +
    `<button type="button" id="ce-coller" title="Coller le JSON d'une carte">Coller</button>` +
    `<button type="button" id="ce-copier" title="Copier le JSON de la carte dans le presse-papiers">Copier</button>` +
    `<button type="button" id="ce-export" class="primary" title="Télécharge carteStation.json — à déposer dans src/game/ pour que le jeu la lise">Exporter</button>` +
    `<button type="button" id="ce-reset" title="Revenir à la carte livrée avec le jeu">Carte livrée</button>` +
    `<span class="sp"></span>` +
    `<span id="ce-signal" class="ce-signal"></span>` +
    `<label class="ce-f ce-f--ligne"><span>Grille</span><input type="number" id="ce-grille" value="8" min="0" step="1" style="width:52px"/></label>` +
    `<label class="ce-f ce-f--ligne" title="AIMANT : les positions s'arrondissent au pas de la grille"><span>Aimant</span><input type="checkbox" id="ce-aimant" checked/></label>` +
    `<button type="button" id="ce-mode" class="primary">⏵ Aperçu jeu</button>` +
    `<button type="button" id="ce-quit">↩ Accueil</button>` +
    `</div>` +
    `<aside class="ce-side">` +
    `<div class="ce-group"><span class="k">Modules</span><div id="ce-liste-modules" class="ce-liste"></div></div>` +
    `<div class="ce-group"><span class="k">Coursives</span><div id="ce-liste-liens" class="ce-liste"></div></div>` +
    `<div class="ce-group"><span class="k">Vérification</span><div id="ce-verdicts" class="ce-liste"></div></div>` +
    `</aside>` +
    `<div class="ce-cadre"><div id="ce-scene" class="ce-scene" tabindex="-1"></div>` +
    `<div class="ce-legende" id="ce-legende"></div></div>` +
    `<aside class="ce-side ce-side--droite" id="ce-panneau"></aside>`
  )
}
