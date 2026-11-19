// L'ÉCRAN MULTI — créer une partie, la rejoindre, y jouer à deux.
//
// Un prototype, derrière le mode concepteur (le concepteur, 19/11 : « un
// nouvel écran, Multi, que pour les concepteurs pour l'instant »). Il est
// chargé à la demande (main.ts, import()) : un joueur qui n'ouvre jamais le
// mode concepteur ne télécharge rien de ce dossier.
//
// L'écran se suffit : il fabrique son gabarit et sa feuille de style ici,
// au lieu d'ajouter trois cents lignes à index.html pour un essai qui peut
// ne pas survivre. S'il devient un vrai mode, il rejoindra la page.
//
// QUI FAIT QUOI :
//  - l'HÔTE (celui qui crée) fait tourner la simulation et envoie l'état ;
//  - l'INVITÉ (celui qui rejoint) envoie sa commande et affiche ;
//  - SEUL : les deux corps sur une machine, pour essayer sans personne.

import { NoyauxWasm } from '../sim/wasm'
import { cadreSalle, cadreVoulu, ecranVersMonde, mondeVersEcran, suitCadre, type Cadre } from './cadrage'
import { litCodePartie, LONGUEUR_CODE } from './code'
import { CADENCE_ETAT, CAPACITE, Hote, Miroir, SALLE } from './partie'
import { adresseRelais, creePartie, liaisonPossible, rejointPartie, type EtatLiaison, type Liaison, type Ordre } from './relais'
import { RenduMulti, couleurCss } from './renduMulti'
import { VERSION_TRAME, decodeCommande, encodeCommande, type Commande, type CorpsTrame, type Particules } from './trame'

type Role = 'hote' | 'invite' | 'seul'
type Page = 'salon' | 'creation' | 'jonction' | 'jeu'

export interface EcranMulti {
  /** Ouvre l'écran. Avec un code (celui d'un lien d'invitation), il va
   *  droit rejoindre cette partie. */
  ouvre(code?: string): void
  ferme(): void
  ouvert(): boolean
}

const STYLE = `
#multi { position: fixed; inset: 0; z-index: 200; background: var(--void, #030710); color: var(--ink, #d9ecf7);
  font-family: var(--font-mono, monospace); font-size: calc(14px * var(--ui, 1)); display: flex; }
#multi[hidden], #multi [hidden] { display: none !important; }
#multi button { font: inherit; color: inherit; background: rgba(150, 200, 235, 0.07); border: 1px solid var(--line-strong, rgba(150,200,235,.38));
  padding: 0.7em 1.2em; cursor: pointer; letter-spacing: 0.08em; }
#multi button:hover:not(:disabled), #multi button:focus-visible { background: rgba(150, 200, 235, 0.18); outline: none; border-color: var(--glow, #a7ddf5); }
#multi button:disabled { opacity: 0.4; cursor: default; }
#multi button.mu-fort { background: rgba(99, 183, 230, 0.2); border-color: var(--specimen, #63b7e6); }
#multi button.mu-discret { border-color: var(--line, rgba(150,200,235,.16)); color: var(--dim, #7f9cb0); }
.mu-salon { margin: auto; width: min(680px, calc(100% - 36px)); display: flex; flex-direction: column; gap: 1.1em; padding: 24px 0; max-height: 100%; overflow-y: auto; }
.mu-titre { font-family: var(--font-display, sans-serif); font-size: calc(22px * var(--ui, 1)); letter-spacing: 0.2em; margin: 0; }
.mu-sous { color: var(--dim, #7f9cb0); margin: 0; line-height: 1.5; }
.mu-choix { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.mu-choix button { padding: 1.4em 1em; text-align: left; display: flex; flex-direction: column; gap: 0.5em; }
.mu-choix button b { font-family: var(--font-display, sans-serif); font-weight: 400; letter-spacing: 0.14em; }
.mu-choix button span { color: var(--dim, #7f9cb0); letter-spacing: 0; line-height: 1.4; }
.mu-etape { border: 1px solid var(--line, rgba(150,200,235,.16)); padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.mu-etape h3 { margin: 0; font-size: 1em; font-weight: 400; letter-spacing: 0.1em; color: var(--glow, #a7ddf5); }
.mu-etape p { margin: 0; color: var(--dim, #7f9cb0); line-height: 1.5; }
.mu-code { font-family: var(--font-display, sans-serif); font-size: calc(46px * var(--ui, 1)); letter-spacing: 0.32em; text-align: center; padding: 0.35em 0 0.35em 0.32em;
  color: var(--glow, #a7ddf5); background: rgba(0, 0, 0, 0.35); border: 1px solid var(--line-strong, rgba(150,200,235,.38)); user-select: all; }
.mu-etape input { width: 100%; box-sizing: border-box; background: rgba(0, 0, 0, 0.35); color: var(--ink, #d9ecf7); border: 1px solid var(--line-strong, rgba(150,200,235,.38));
  font-family: var(--font-display, sans-serif); font-size: calc(34px * var(--ui, 1)); letter-spacing: 0.3em; text-align: center; padding: 0.35em 0.2em; text-transform: uppercase; }
.mu-etape input:focus { outline: none; border-color: var(--glow, #a7ddf5); }
.mu-etape form { display: flex; flex-direction: column; gap: 10px; margin: 0; }
.mu-rang { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.mu-mot { min-height: 1.5em; line-height: 1.5; }
.mu-mot[data-ton="alerte"] { color: var(--alert, #e0685c); }
.mu-mot[data-ton="bon"] { color: var(--valid, #3fd69b); }
.mu-detail { color: var(--dim, #7f9cb0); font-size: 0.78em; line-height: 1.5; margin: 0; word-break: break-word; user-select: all; }
.mu-jeu { position: absolute; inset: 0; }
.mu-jeu canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; cursor: crosshair; }
.mu-ath { position: absolute; top: 14px; left: 14px; display: flex; flex-direction: column; gap: 8px; pointer-events: none; min-width: 230px; }
.mu-jauge { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; background: var(--panel, rgba(9,18,30,.82)); border: 1px solid var(--line, rgba(150,200,235,.16)); padding: 6px 10px; }
.mu-jauge i { width: 12px; height: 12px; border-radius: 50%; display: block; }
.mu-jauge .mu-barre { height: 6px; background: rgba(150, 200, 235, 0.12); position: relative; }
.mu-jauge .mu-barre u { position: absolute; left: 0; top: 0; bottom: 0; display: block; }
.mu-jauge small { grid-column: 2 / 4; color: var(--dim, #7f9cb0); font-size: 0.8em; letter-spacing: 0.06em; }
.mu-jauge b { font-weight: 400; font-variant-numeric: tabular-nums; }
.mu-lien { color: var(--dim, #7f9cb0); font-size: 0.8em; padding: 0 2px; font-variant-numeric: tabular-nums; }
.mu-actions { position: absolute; top: 14px; right: 14px; display: flex; gap: 8px; }
.mu-actions button { background: var(--panel, rgba(9,18,30,.82)); padding: 0.5em 0.9em; font-size: 0.85em; }
.mu-aide { position: absolute; left: 0; right: 0; bottom: 16px; text-align: center; color: var(--dim, #7f9cb0); pointer-events: none; font-size: 0.85em; padding: 0 16px; }
.mu-voile { position: absolute; inset: 0; background: rgba(2, 6, 12, 0.78); display: flex; align-items: center; justify-content: center; padding: 18px; }
.mu-voile[hidden] { display: none; }
.mu-voile div { max-width: 520px; display: flex; flex-direction: column; gap: 14px; text-align: center; line-height: 1.5; }
.mu-etiquette { position: absolute; transform: translate(-50%, -50%); pointer-events: none; font-family: var(--font-display, sans-serif); letter-spacing: 0.2em;
  font-size: calc(12px * var(--ui, 1)); text-shadow: 0 0 8px #000, 0 0 2px #000; transition: opacity 0.6s; }
@media (max-width: 560px) { .mu-choix { grid-template-columns: 1fr; } }
`

const GABARIT = `
<div class="mu-salon" data-page="salon">
  <h2 class="mu-titre">MULTI</h2>
  <p class="mu-sous">Prototype à deux, chacun chez soi. L’un crée la partie et donne son code, l’autre le tape. Aucun compte.</p>
  <div class="mu-choix">
    <button type="button" data-geste="creer"><b>CRÉER UNE PARTIE</b><span>Votre machine fait tourner la simulation : à choisir sur le PC le plus puissant.</span></button>
    <button type="button" data-geste="rejoindre"><b>REJOINDRE UNE PARTIE</b><span>Votre ami vous a donné un code de cinq caractères.</span></button>
  </div>
  <div class="mu-rang">
    <button type="button" class="mu-discret" data-geste="seul">ESSAYER SEUL</button>
    <button type="button" class="mu-discret" data-geste="quitter">RETOUR À L’ACCUEIL</button>
  </div>
  <p class="mu-mot" data-mot="salon"></p>
</div>

<div class="mu-salon" data-page="creation" hidden>
  <h2 class="mu-titre">CRÉER UNE PARTIE</h2>
  <div class="mu-etape">
    <h3>DONNEZ CE CODE À VOTRE AMI</h3>
    <p>Il le tape dans « Rejoindre une partie ». Ou envoyez-lui le lien : il arrive droit dans la partie. Rien ne presse — laissez cette page ouverte, la partie démarre toute seule quand il arrive.</p>
    <div class="mu-code" data-code aria-live="polite" aria-label="Code de la partie">·····</div>
    <div class="mu-rang"><button type="button" data-geste="copier-code" disabled>COPIER LE CODE</button><button type="button" data-geste="copier-lien" disabled>COPIER LE LIEN</button><span class="mu-mot" data-mot="copie"></span></div>
  </div>
  <p class="mu-mot" data-mot="creation"></p>
  <p class="mu-detail" data-detail="creation"></p>
  <div class="mu-rang"><button type="button" class="mu-discret" data-geste="retour">ANNULER</button></div>
</div>

<div class="mu-salon" data-page="jonction" hidden>
  <h2 class="mu-titre">REJOINDRE UNE PARTIE</h2>
  <div class="mu-etape">
    <h3>TAPEZ LE CODE DE LA PARTIE</h3>
    <p>Cinq caractères, donnés par la personne qui a créé la partie.</p>
    <form data-formulaire="code">
      <input type="text" data-champ="code" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" maxlength="12" aria-label="Code de la partie" placeholder="·····">
      <div class="mu-rang"><button type="submit" class="mu-fort" data-geste="valider-code">REJOINDRE</button></div>
    </form>
  </div>
  <p class="mu-mot" data-mot="jonction"></p>
  <p class="mu-detail" data-detail="jonction"></p>
  <div class="mu-rang"><button type="button" class="mu-discret" data-geste="retour">ANNULER</button></div>
</div>

<div class="mu-jeu" data-page="jeu" hidden>
  <canvas aria-label="La salle du multi"></canvas>
  <div class="mu-etiquette" data-etiquette hidden>VOUS</div>
  <div class="mu-ath">
    <div class="mu-jauge" data-jauge="0"><i></i><div class="mu-barre"><u></u></div><b>100 %</b><small></small></div>
    <div class="mu-jauge" data-jauge="1"><i></i><div class="mu-barre"><u></u></div><b>100 %</b><small></small></div>
    <div class="mu-lien" data-lien></div>
  </div>
  <div class="mu-actions">
    <button type="button" data-geste="changer" hidden>CHANGER DE CORPS</button>
    <button type="button" data-geste="recommencer">RECOMMENCER</button>
    <button type="button" data-geste="quitter-partie">QUITTER</button>
  </div>
  <div class="mu-aide" data-aide>Maintenez le clic : la matière part vers le pointeur, le corps part à l’opposé.</div>
  <div class="mu-voile" data-voile hidden><div><p data-voile-mot></p><span class="mu-rang" style="justify-content:center"><button type="button" class="mu-fort" data-geste="retour-salon">REVENIR AU SALON</button></span></div></div>
</div>
`

export function creeEcranMulti(quitte: () => void): EcranMulti {
  let racine: HTMLDivElement | null = null
  let page: Page = 'salon'
  let role: Role = 'seul'
  let ouvert = false

  // ---- la partie en cours
  let rendu: RenduMulti | null = null
  let hote: Hote | null = null
  let miroir: Miroir | null = null
  let liaison: Liaison | null = null
  /** le code de la partie créée (pour le copier) */
  let codePartie = ''
  let noyaux: NoyauxWasm | null = null
  let cadre: Cadre = cadreSalle(SALLE, 16 / 9)
  let rafId = 0
  let dernier = 0
  let resteEnvoi = 0
  let seqCommande = 0
  let seqCommandeRecue = -1
  /** le corps que pilote ce joueur */
  let moi = 0
  // le pointeur, en fraction de la toile
  const pointeur = { actif: false, fx: 0.5, fy: 0.5 }
  // le pouls de la liaison
  let poulsId = 0
  let poulsParti = 0
  let poulsReste = 0
  let latenceMs = -1
  let debitReste = 0
  let debitRecus = 0
  let debitEnvoyes = 0
  let debitTexte = ''
  let etiquetteJusqua = 0
  /** images que l'hôte n'a pas envoyées parce que sa ligne ne suivait pas */
  let imagesSautees = 0
  let minuteurLiaison = 0

  const el = <T extends HTMLElement>(selecteur: string): T => {
    const e = racine?.querySelector<T>(selecteur)
    if (!e) throw new Error('écran multi : ' + selecteur + ' manque')
    return e
  }
  const mot = (nom: string, texte: string, ton: '' | 'alerte' | 'bon' = ''): void => {
    const e = el<HTMLElement>(`[data-mot="${nom}"]`)
    e.textContent = texte
    e.dataset.ton = ton
  }

  /** Le détail technique d'une panne, sous le message : c'est ce qu'il
   *  faut photographier pour qu'on sache ce qui s'est passé. */
  const detail = (ou: 'creation' | 'jonction', texte: string): void => {
    el<HTMLElement>(`[data-detail="${ou}"]`).textContent = texte ? 'Détail pour le dépannage — ' + texte : ''
  }

  function construit(): HTMLDivElement {
    const style = document.createElement('style')
    style.textContent = STYLE
    document.head.appendChild(style)
    const r = document.createElement('div')
    r.id = 'multi'
    r.hidden = true
    r.setAttribute('role', 'dialog')
    r.setAttribute('aria-label', 'Multi : jouer à deux')
    r.innerHTML = GABARIT
    document.body.appendChild(r)
    r.addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-geste]')
      // le bouton d'un formulaire agit par « submit » (ci-dessous) : la
      // touche Entrée dans le champ fait alors le même geste que le clic
      if (b && !b.disabled && b.type !== 'submit') void geste(b.dataset.geste ?? '')
    })
    r.querySelector<HTMLFormElement>('[data-formulaire="code"]')!.addEventListener('submit', (ev) => {
      ev.preventDefault()
      void geste('valider-code')
    })
    brancheToile(r.querySelector('canvas')!)
    // la fenêtre qui perd la main ne doit pas laisser un jet coincé ouvert
    window.addEventListener('blur', () => {
      pointeur.actif = false
    })
    return r
  }

  function montre(p: Page): void {
    page = p
    if (!racine) return
    for (const e of racine.querySelectorAll<HTMLElement>('[data-page]')) e.hidden = e.dataset.page !== p
  }

  async function copie(texte: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(texte)
      mot('copie', 'Copié.', 'bon')
    } catch {
      // presse-papiers refusé (permission, page non sécurisée) : le code
      // est écrit en grand, il se recopie à la main
      mot('copie', 'La copie est refusée par ce navigateur : recopiez le code à la main.')
    }
  }

  /** Le lien qui mène droit dans la partie : l'ami n'a rien à taper. */
  function lienPartie(): string {
    const u = new URL(location.href)
    u.search = ''
    u.hash = ''
    u.searchParams.set('dev', '')
    u.searchParams.set('multi', codePartie)
    // « ?dev=&multi=X » → « ?dev&multi=X » : plus court, et c'est la forme
    // que tout le dépôt écrit
    return u.toString().replace('dev=&', 'dev&')
  }

  // ---- LA LIAISON ---------------------------------------------------------

  function brancheLiaison(l: Liaison): void {
    // une liaison précédente qui a échoué laisse la place (l'ami réessaie)
    if (liaison && liaison !== l) liaison.ferme()
    liaison = l
    seqCommandeRecue = -1
    l.surEtat = (etat) => surEtatLiaison(l, etat)
    l.surOrdre = (o) => surOrdre(o)
    l.surFlux = (octets) => {
      if (role === 'invite') miroir?.recoit(octets, performance.now())
      else if (role === 'hote') {
        const c = decodeCommande(octets)
        // une commande plus vieille que la dernière reçue est jetée
        if (c && c.seq > seqCommandeRecue) {
          seqCommandeRecue = c.seq
          hote?.commande(1, c.commande)
        }
      }
    }
    // la liaison a pu s'ouvrir (ou tomber) avant qu'on ne l'écoute
    if (l.etat !== 'attente') surEtatLiaison(l, l.etat)
  }

  function surEtatLiaison(l: Liaison, etat: EtatLiaison): void {
    if (l !== liaison) return
    if (etat === 'ouverte') {
      // la liaison reste « ouverte » à travers les reconnexions au relais :
      // on ne passe ici qu'UNE fois, et la partie n'est lancée qu'une fois
      l.envoieOrdre({ t: 'salut', version: VERSION_TRAME })
      lancePartie(role)
    } else if (etat === 'echec') {
      if (page === 'creation' || page === 'jonction') {
        mot(page, l.raison || 'La partie n’a pas pu s’établir.', 'alerte')
        detail(page, l.diagnostic())
        if (page === 'jonction') el<HTMLButtonElement>('[data-geste="valider-code"]').disabled = false
      }
    } else if (etat === 'coupee' && page === 'jeu') {
      voile((l.raison || 'La liaison est coupée.') + ' — ' + l.diagnostic())
    }
  }

  function surOrdre(o: Ordre): void {
    if (o.t === 'salut') {
      if (o.version !== VERSION_TRAME) voile('Vous n’avez pas la même version du jeu. Rechargez la page tous les deux, puis recommencez.')
    } else if (o.t === 'recommence') {
      if (role === 'hote') recommence()
      else marqueEtiquette()
    } else if (o.t === 'pouls') {
      liaison?.envoieOrdre({ t: 'echo', id: o.id })
    } else if (o.t === 'echo') {
      if (o.id === poulsId) latenceMs = Math.round(performance.now() - poulsParti)
    } else if (o.t === 'adieu') {
      if (page === 'jeu') voile('L’autre joueur a quitté la partie.')
    }
  }

  function fermeLiaison(): void {
    window.clearTimeout(minuteurLiaison)
    const l = liaison
    liaison = null
    l?.ferme()
  }

  // ---- LES GESTES ---------------------------------------------------------

  async function geste(g: string): Promise<void> {
    switch (g) {
      case 'quitter':
        api.ferme()
        quitte()
        return
      case 'seul':
        role = 'seul'
        lancePartie('seul')
        return
      case 'creer':
        await ouvreCreation()
        return
      case 'rejoindre':
        ouvreJonction()
        return
      case 'retour':
      case 'retour-salon':
      case 'quitter-partie':
        arretePartie()
        fermeLiaison()
        montre('salon')
        return
      case 'copier-code':
        await copie(codePartie)
        return
      case 'copier-lien':
        await copie(lienPartie())
        return
      case 'valider-code':
        await valideCode()
        return
      case 'recommencer':
        if (role === 'invite') liaison?.envoieOrdre({ t: 'recommence' })
        else recommence()
        return
      case 'changer':
        // SEUL : le pointeur passe d'un corps à l'autre
        if (hote) hote.commande(moi, { pousse: false, x: 0, y: 0 })
        moi = moi === 0 ? 1 : 0
        marqueEtiquette()
        return
    }
  }

  async function ouvreCreation(): Promise<void> {
    if (!liaisonPossible()) {
      mot('salon', 'Ce navigateur est trop ancien pour le multi. Essayez avec Chrome ou Edge à jour.', 'alerte')
      return
    }
    role = 'hote'
    fermeLiaison()
    montre('creation')
    codePartie = ''
    el<HTMLElement>('[data-code]').textContent = '·'.repeat(LONGUEUR_CODE)
    el<HTMLButtonElement>('[data-geste="copier-code"]').disabled = true
    el<HTMLButtonElement>('[data-geste="copier-lien"]').disabled = true
    mot('copie', '')
    detail('creation', '')
    mot('creation', 'Ouverture de la partie…')
    const c = await creePartie(adresseRelais(location.search))
    // l'écran a pu être quitté pendant l'ouverture
    if (page !== 'creation' || role !== 'hote') {
      if (c.ok) c.accueil.liaison.ferme()
      return
    }
    if (!c.ok) {
      mot('creation', c.raison, 'alerte')
      detail('creation', c.detail)
      return
    }
    codePartie = c.accueil.code
    el<HTMLElement>('[data-code]').textContent = codePartie
    el<HTMLButtonElement>('[data-geste="copier-code"]').disabled = false
    el<HTMLButtonElement>('[data-geste="copier-lien"]').disabled = false
    mot('creation', 'En attente de votre ami…')
    // la liaison est déjà là : elle s'ouvre quand l'ami prend place
    brancheLiaison(c.accueil.liaison)
  }

  function ouvreJonction(code = ''): void {
    if (!liaisonPossible()) {
      mot('salon', 'Ce navigateur est trop ancien pour le multi. Essayez avec Chrome ou Edge à jour.', 'alerte')
      return
    }
    role = 'invite'
    fermeLiaison()
    montre('jonction')
    const champ = el<HTMLInputElement>('[data-champ="code"]')
    champ.value = code
    el<HTMLButtonElement>('[data-geste="valider-code"]').disabled = false
    mot('jonction', '')
    detail('jonction', '')
    if (code) void valideCode()
    else champ.focus()
  }

  async function valideCode(): Promise<void> {
    const bouton = el<HTMLButtonElement>('[data-geste="valider-code"]')
    if (bouton.disabled) return
    const lu = litCodePartie(el<HTMLInputElement>('[data-champ="code"]').value)
    if (!lu.ok) {
      mot('jonction', lu.raison, 'alerte')
      return
    }
    bouton.disabled = true
    detail('jonction', '')
    mot('jonction', 'Recherche de la partie…')
    fermeLiaison()
    const j = await rejointPartie(adresseRelais(location.search), lu.code)
    if (page !== 'jonction' || role !== 'invite') {
      if (j.ok) j.liaison.ferme()
      return
    }
    if (!j.ok) {
      bouton.disabled = false
      mot('jonction', j.raison, 'alerte')
      detail('jonction', j.detail)
      return
    }
    mot('jonction', 'Partie trouvée…')
    brancheLiaison(j.liaison)
  }

  // ---- LA PARTIE ----------------------------------------------------------

  function voile(texte: string): void {
    el<HTMLElement>('[data-voile-mot]').textContent = texte
    el<HTMLElement>('[data-voile]').hidden = false
  }

  function marqueEtiquette(): void {
    etiquetteJusqua = performance.now() + 5000
  }

  function recommence(): void {
    hote?.recommence()
    seqCommandeRecue = -1
    liaison?.envoieOrdre({ t: 'recommence' })
    marqueEtiquette()
  }

  function lancePartie(r: Role): void {
    arretePartie()
    role = r
    montre('jeu')
    el<HTMLElement>('[data-voile]').hidden = true
    el<HTMLButtonElement>('[data-geste="changer"]').hidden = r !== 'seul'
    moi = r === 'invite' ? 1 : 0
    try {
      rendu = new RenduMulti(el<HTMLCanvasElement>('canvas'), CAPACITE)
    } catch (e) {
      console.error('multi : rendu', e)
      voile('L’affichage n’a pas pu démarrer sur cette machine (WebGL2 indisponible).')
      return
    }
    if (r === 'invite') {
      miroir = new Miroir()
    } else {
      hote = new Hote()
      hote.poseNoyaux(noyaux)
      if (!noyaux) {
        // les noyaux compilés, en arrière-plan : la partie démarre sur le
        // moteur JS et bascule dès qu'ils sont là. Échec = on reste en JS.
        fetch('/noyaux.wasm')
          .then((rep) => (rep.ok ? rep.arrayBuffer() : Promise.reject(new Error(String(rep.status)))))
          .then((tampon) => NoyauxWasm.charge(tampon))
          .then((n) => {
            noyaux = n
            hote?.poseNoyaux(n)
          })
          .catch(() => {})
      }
    }
    el<HTMLElement>('[data-aide]').textContent =
      r === 'hote'
        ? 'Maintenez le clic : la matière part vers le pointeur, le corps part à l’opposé. Votre machine simule la partie : ne fermez pas cet onglet.'
        : 'Maintenez le clic : la matière part vers le pointeur, le corps part à l’opposé.'
    cadre = cadreSalle(SALLE, rendu.aspect())
    seqCommande = 0
    seqCommandeRecue = -1
    latenceMs = -1
    poulsReste = 0
    debitReste = 0
    debitRecus = liaison?.recus ?? 0
    debitEnvoyes = liaison?.envoyes ?? 0
    debitTexte = ''
    imagesSautees = 0
    resteEnvoi = 0
    pointeur.actif = false
    marqueEtiquette()
    dernier = performance.now()
    if (r === 'hote') lanceBattement()
    rafId = requestAnimationFrame(image)
  }

  function arretePartie(): void {
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    arreteBattement()
    const avaitRendu = rendu !== null
    rendu?.libere()
    rendu = null
    hote = null
    miroir = null
    // libérer le rendu rend son contexte graphique : la toile qui l'a porté
    // n'en donnera plus. Une toile neuve pour la prochaine partie.
    const vieille = racine?.querySelector('canvas')
    if (vieille && avaitRendu) {
      const neuve = vieille.cloneNode(false) as HTMLCanvasElement
      vieille.replaceWith(neuve)
      brancheToile(neuve)
    }
  }

  /** Le pointeur sur la toile : maintenir pousse, relâcher arrête. */
  function brancheToile(toile: HTMLCanvasElement): void {
    const suit = (ev: PointerEvent): void => {
      const b = toile.getBoundingClientRect()
      pointeur.fx = (ev.clientX - b.left) / Math.max(1, b.width)
      pointeur.fy = (ev.clientY - b.top) / Math.max(1, b.height)
    }
    const lache = (): void => {
      pointeur.actif = false
    }
    toile.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return
      toile.setPointerCapture(ev.pointerId)
      suit(ev)
      pointeur.actif = true
      ev.preventDefault()
    })
    toile.addEventListener('pointermove', suit)
    toile.addEventListener('pointerup', lache)
    toile.addEventListener('pointercancel', lache)
    toile.addEventListener('contextmenu', (ev) => ev.preventDefault())
  }

  // LE BATTEMENT D'ARRIÈRE-PLAN. Un navigateur n'appelle plus
  // requestAnimationFrame pour une fenêtre cachée (un alt-tab qui la
  // recouvre, un autre onglet) et ralentit ses minuteries à une par seconde :
  // la simulation de l'hôte s'arrêterait, et l'invité regarderait une image
  // figée. Les minuteries d'un WORKER, elles, ne sont pas ralenties : il bat
  // soixante fois par seconde, et quand la page est cachée c'est lui qui
  // fait avancer la partie — sans dessiner, personne ne regarde.
  let battement: Worker | null = null
  let battementUrl = ''
  function lanceBattement(): void {
    if (battement) return
    try {
      battementUrl = URL.createObjectURL(new Blob(['setInterval(function(){postMessage(0)},16)'], { type: 'text/javascript' }))
      battement = new Worker(battementUrl)
      battement.onmessage = () => {
        if (document.hidden && rendu && role === 'hote') tour(performance.now(), false)
      }
    } catch {
      // pas de worker ici : la partie se figera fenêtre cachée, rien de plus
      battement = null
    }
  }
  function arreteBattement(): void {
    battement?.terminate()
    battement = null
    if (battementUrl) URL.revokeObjectURL(battementUrl)
    battementUrl = ''
  }

  function image(maintenant: number): void {
    rafId = requestAnimationFrame(image)
    tour(maintenant, true)
  }

  /** Un tour de partie. `dessine` est faux quand la fenêtre est cachée :
   *  on simule et on envoie, on ne peint rien. */
  function tour(maintenant: number, dessine: boolean): void {
    if (!rendu) return
    const dt = Math.min(0.1, Math.max(0, (maintenant - dernier) / 1000))
    dernier = maintenant

    // la commande de CE joueur, dans le monde
    const vise = ecranVersMonde(cadre, pointeur.fx, pointeur.fy)
    const commande: Commande = { pousse: pointeur.actif && dessine, x: vise.x, y: vise.y }

    let particules: Particules
    let corps: CorpsTrame[]
    if (role === 'invite') {
      liaison?.envoieFlux(encodeCommande(++seqCommande, commande))
      particules = miroir!.vue(maintenant)
      corps = miroir!.corps
    } else {
      const h = hote!
      h.commande(moi, commande)
      h.avance(dt)
      if (role === 'hote' && liaison) {
        resteEnvoi -= dt
        if (resteEnvoi <= 0) {
          resteEnvoi += 1 / CADENCE_ETAT
          if (resteEnvoi < 0) resteEnvoi = 0
          // ligne engorgée : on saute l'image ENTIÈRE (un morceau seul ne
          // sert à rien) — la cadence s'ajuste à ce que la ligne porte
          if (liaison.engorgee) imagesSautees++
          else for (const morceau of h.image()) liaison.envoieFlux(morceau)
        }
      }
      particules = h.vue()
      corps = h.corps()
    }

    if (!dessine) return
    if (corps.length > 0) cadre = suitCadre(cadre, cadreVoulu(corps, SALLE, rendu.aspect()), dt)
    rendu.dessine(particules, cadre, SALLE)
    peintAth(corps, maintenant, dt)
  }

  function peintAth(corps: CorpsTrame[], maintenant: number, dt: number): void {
    for (let j = 0; j < 2; j++) {
      const boite = el<HTMLElement>(`[data-jauge="${j}"]`)
      const c = corps[j]
      const part = c && c.base > 0 ? Math.max(0, Math.min(1, (c.compte + c.prets) / c.base)) : 0
      const couleur = couleurCss(j)
      ;(boite.querySelector('i') as HTMLElement).style.background = couleur
      const barre = boite.querySelector('u') as HTMLElement
      barre.style.background = couleur
      barre.style.width = `${(part * 100).toFixed(1)}%`
      boite.querySelector('b')!.textContent = c ? `${Math.round(part * 100)} %` : '—'
      const qui = j === moi ? 'VOUS' : role === 'seul' ? 'L’AUTRE CORPS' : 'VOTRE AMI'
      boite.querySelector('small')!.textContent = c?.disperse ? `${qui} · DISPERSÉ` : qui
    }

    // le pouls et le débit, une fois par seconde
    const lien = el<HTMLElement>('[data-lien]')
    if (role === 'seul') {
      lien.textContent = 'essai seul — aucune liaison'
    } else if (liaison) {
      poulsReste -= dt
      if (poulsReste <= 0) {
        poulsReste = 1
        poulsId++
        poulsParti = performance.now()
        liaison.envoieOrdre({ t: 'pouls', id: poulsId })
      }
      debitReste -= dt
      if (debitReste <= 0) {
        const duree = 1 - debitReste
        debitReste = 1
        const recus = (liaison.recus - debitRecus) / duree / 1024
        const envoyes = (liaison.envoyes - debitEnvoyes) / duree / 1024
        debitRecus = liaison.recus
        debitEnvoyes = liaison.envoyes
        debitTexte = `envoi ${envoyes.toFixed(0)} ko/s · réception ${recus.toFixed(0)} ko/s`
        if (imagesSautees > 0) debitTexte += ` · ${imagesSautees} image(s) sautée(s) : la ligne ne suit pas`
      }
      const silence = role === 'invite' && miroir ? miroir.age(maintenant) : 0
      lien.textContent =
        silence > 1.5
          ? 'en attente de l’hôte… (sa fenêtre est peut-être en arrière-plan)'
          : `liaison ${latenceMs < 0 ? '…' : latenceMs + ' ms'} · ${debitTexte}`
    }

    // l'étiquette VOUS, au-dessus de son corps, les premières secondes
    const etiquette = el<HTMLElement>('[data-etiquette]')
    const c = corps[moi]
    if (c && !c.disperse && maintenant < etiquetteJusqua) {
      const e = mondeVersEcran(cadre, c.x, c.y - 190)
      etiquette.hidden = false
      etiquette.style.left = `${(e.fx * 100).toFixed(2)}%`
      etiquette.style.top = `${(e.fy * 100).toFixed(2)}%`
      etiquette.style.color = couleurCss(moi)
      etiquette.style.opacity = etiquetteJusqua - maintenant < 800 ? '0' : '1'
    } else {
      etiquette.hidden = true
    }
  }

  // LE CLAVIER NE TRAVERSE PAS. Le jeu écoute les touches sur la fenêtre
  // (pause, recommencer, raccourcis d'écran) : derrière le multi, il est
  // figé mais il entendrait encore. On arrête donc les touches à la
  // descente, avant qu'elles n'atteignent ses écouteurs. L'action par
  // défaut n'est pas empêchée : coller un code dans un champ marche.
  const bouclier = (ev: KeyboardEvent): void => {
    ev.stopPropagation()
  }

  const api: EcranMulti = {
    ouvre(code?: string): void {
      if (!racine) racine = construit()
      if (!ouvert) {
        window.addEventListener('keydown', bouclier, true)
        window.addEventListener('keyup', bouclier, true)
      }
      ouvert = true
      racine.hidden = false
      mot('salon', '')
      montre('salon')
      if (code) ouvreJonction(code)
    },
    ferme(): void {
      arretePartie()
      fermeLiaison()
      window.removeEventListener('keydown', bouclier, true)
      window.removeEventListener('keyup', bouclier, true)
      ouvert = false
      if (racine) racine.hidden = true
    },
    ouvert: () => ouvert,
  }

  // SONDE DE TEST : ce que l'écran sait de la partie, pour un essai piloté
  // (deux onglets qui se joignent). Lecture seule.
  ;(window as unknown as { __multiSonde?: () => unknown }).__multiSonde = () => ({
    page,
    role,
    moi,
    liaison: liaison?.etat ?? null,
    latenceMs,
    debit: debitTexte,
    imagesSautees,
    corps: role === 'invite' ? (miroir?.corps ?? []) : (hote?.corps() ?? []),
    images: miroir ? { recues: miroir.recues, perdues: miroir.perdues } : null,
    particules: role === 'invite' ? (miroir?.vue(performance.now()).n ?? 0) : (hote?.sim.count ?? 0),
    tSim: role === 'invite' ? (miroir?.tSim ?? 0) : (hote?.tSim ?? 0),
    wasm: hote ? hote.sim.moteurWasm : null,
  })

  return api
}
