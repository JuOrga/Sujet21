// LA CAPTURE DES VIDÉOS DU CODEX — depuis le jeu, pas depuis un générateur.
//
// Chaque fiche du codex est faite pour une vidéo de son effet (3 à 6 s, en
// boucle, muette — public/assets/codex/LISEZ-MOI.md), et le dossier était
// vide : aucune n'avait été livrée. Les fabriquer ailleurs (montage, IA)
// donnerait une imitation de l'effet ; le jeu SAIT le produire. Alors on le
// filme : en mode concepteur, un bouton du HUD enregistre quatre secondes
// de la scène, cadrées au 4:3 sur le centre, et les envoie à la fiche
// choisie par le même chemin que l'atelier du codex (le magasin partagé,
// où la vidéo envoyée prime sur celle du dossier).
//
// LES DEUX CANVAS. La scène est faite du canvas WebGL (le fluide, le décor)
// et, par-dessus, du calque 2D des mécanismes. captureStream() ne prend
// qu'un canvas : on compose les deux dans un troisième, à chaque image,
// APRÈS le rendu — dans le même rappel d'animation. C'est ce qui permet de
// lire le canvas WebGL sans preserveDrawingBuffer (renderer.ts dit ce que
// coûte ce drapeau sur les GPU à tuiles) : le tampon est encore là tant que
// le navigateur n'a pas composé l'image.
//
// LA MÉMOIRE DE CAPTURE (tamponCapture.ts) : armée par un réglage du
// concepteur (PC seulement), elle encode en continu les huit dernières
// secondes ; le même bouton les fige alors au lieu de filmer quatre
// secondes à partir du clic — on n'a jamais le doigt dessus au moment où
// l'effet se produit. Les deux chemins aboutissent au même panneau.
//
// La partie pure (cadrage, type, nom) est ici pour être testée sans
// navigateur ; la classe en dessous ne vit qu'avec un DOM.

import { VIDEO_MAX_OCTETS, VIDEO_TYPES, blobEnBase64, type EnvoiVideo } from './codexReglages'
import { TamponCapture, tamponDisponible, type CadenceTampon } from './tamponCapture'

/** Quatre secondes : dans la fourchette du LISEZ-MOI (3 à 6 s), assez pour
 *  une boucle qui montre l'effet, court pour rester sous le mégaoctet. */
export const DUREE_CAPTURE_MS = 4000
/** Trente images par seconde : le rendu du jeu en fait plus, mais VP9 à ce
 *  débit n'en montrerait pas la différence — et le fichier reste léger. */
export const IPS_CAPTURE = 30
/** 600 kbit/s : la commande ffmpeg du LISEZ-MOI (`-b:v 600k`), reprise
 *  telle quelle. */
export const DEBIT_CAPTURE = 600_000
/** La largeur livrée : `scale=640:-2` du LISEZ-MOI. */
export const LARGEUR_CAPTURE = 640
/** Le cadre : 4:3, celui du panneau de la fiche. */
export const RAPPORT_CAPTURE = 4 / 3

export interface CadreCapture {
  /** la découpe dans la scène, en fractions de sa largeur et de sa hauteur —
   *  les deux canvas n'ont pas la même taille en pixels, chacun applique
   *  les fractions à la sienne */
  x: number
  y: number
  w: number
  h: number
  /** la taille de la vidéo, en pixels */
  largeur: number
  hauteur: number
}

/** Le cadre de capture pour une scène de `vw`×`vh` : la plus grande découpe
 *  au rapport 4:3 centrée dans la scène, livrée en 640 de large (ou moins
 *  si la scène est plus étroite — on n'agrandit jamais, ça ne ferait que
 *  du flou). */
export function cadreCapture(vw: number, vh: number): CadreCapture {
  if (!(vw > 0) || !(vh > 0)) return { x: 0, y: 0, w: 1, h: 1, largeur: 4, hauteur: 3 }
  let w = vw
  let h = vh
  if (vw / vh > RAPPORT_CAPTURE) w = vh * RAPPORT_CAPTURE
  else h = vw / RAPPORT_CAPTURE
  // largeur et hauteur PAIRES : les encodeurs vidéo travaillent par blocs
  // de deux lignes, une dimension impaire est refusée ou arrondie en
  // silence — et la hauteur se calcule depuis la largeur DÉJÀ rendue
  // paire, sinon 335 donnait 334×252, plus tout à fait du 4:3
  const largeur = Math.max(2, Math.min(LARGEUR_CAPTURE, Math.floor(w)) & ~1)
  const hauteur = Math.max(2, Math.round(largeur / RAPPORT_CAPTURE / 2) * 2)
  return {
    x: (vw - w) / 2 / vw,
    y: (vh - h) / 2 / vh,
    w: w / vw,
    h: h / vh,
    largeur,
    hauteur,
  }
}

/** Les types à essayer, du meilleur au dernier recours : VP9 en WebM (ce que
 *  le LISEZ-MOI demande), VP8 sinon, et MP4 pour Safari, qui n'enregistre
 *  pas de WebM. Le premier que `supporte` accepte gagne ; null : ce
 *  navigateur n'enregistre rien d'utilisable. */
export function typeCapture(supporte: (mime: string) => boolean): string | null {
  const candidats = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']
  for (const c of candidats) if (supporte(c)) return c
  return null
}

/** Le type nu d'un enregistrement (`video/webm;codecs=vp9` → `video/webm`) :
 *  c'est celui que le magasin connaît (VIDEO_TYPES). */
export function typeNu(mime: string): string {
  return mime.split(';')[0].trim().toLowerCase()
}

/** Le nom du fichier téléchargé : celui que le dossier attend, pour qu'un
 *  concepteur puisse aussi le déposer dans public/assets/codex/ tel quel. */
export function nomFichierCapture(id: string, mime: string): string {
  const ext = VIDEO_TYPES[typeNu(mime)] ?? '.webm'
  return `${id}${ext}`
}

/** Ce qu'on dit d'un enregistrement fini : son poids, et s'il passe. */
export function verdictCapture(
  octets: number,
  mime: string,
  secondes: number = DUREE_CAPTURE_MS / 1000,
): { ok: boolean; texte: string } {
  const ko = Math.round(octets / 1024)
  if (octets <= 0) return { ok: false, texte: 'Rien n’a été enregistré.' }
  if (!VIDEO_TYPES[typeNu(mime)]) return { ok: false, texte: `Type ${typeNu(mime)} inconnu du magasin.` }
  if (octets > VIDEO_MAX_OCTETS) return { ok: false, texte: `${ko} Ko : trop lourd pour le magasin (3 Mo au plus).` }
  return { ok: true, texte: `${ko} Ko, ${secondes.toFixed(1).replace('.', ',')} s, ${mime}.` }
}

// ---- LA CLASSE : ne vit qu'avec un DOM ------------------------------------------

export interface FicheCapturable {
  id: string
  titre: string
  groupe: string
}

export interface HooksCapture {
  /** les deux canvas de la scène, lus au moment d'enregistrer */
  sources(): { gl: HTMLCanvasElement; fx: HTMLCanvasElement }
  /** les fiches où envoyer, dans l'ordre de lecture du codex */
  fiches(): FicheCapturable[]
  /** envoie la vidéo à la fiche — false : le magasin n'a pas répondu */
  envoie(id: string, video: EnvoiVideo): Promise<boolean>
  /** le mode concepteur est-il actif ? (le bouton ne se montre qu'à lui) */
  concepteur(): boolean
  /** la cadence de la mémoire de capture (PARAMÈTRES) — 0 : éteinte */
  cadenceTampon(): CadenceTampon
}

type Etape = 'repos' | 'enregistre' | 'pret'

export class CaptureCodex {
  private etape: Etape = 'repos'
  private toile: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private cadre: CadreCapture | null = null
  private enregistreur: MediaRecorder | null = null
  private morceaux: Blob[] = []
  // le temps COMPOSÉ : la somme des écarts entre images, chacun plafonné —
  // pas l'horloge murale. Un onglet caché ou un rendu qui cale ne compte
  // pas : les quatre secondes promises sont quatre secondes d'images
  private dureeComposee = 0
  private derniereImage = 0
  private imagesComposees = 0
  private readonly surVisibilite = (): void => this.visibilite()
  private resultat: Blob | null = null
  private urlResultat = ''
  private ficheChoisie = ''
  // la mémoire de capture et SA toile de composition, qui vit tant que le
  // réglage est armé (celle de la capture de quatre secondes ne vit que
  // pendant l'enregistrement)
  private readonly tampon = new TamponCapture()
  private toileTampon: HTMLCanvasElement | null = null
  private ctxTampon: CanvasRenderingContext2D | null = null
  private cadreTampon: CadreCapture | null = null
  private figeEnCours = false
  // la disponibilité ne change pas en cours de route : lue une fois, pas
  // une MediaQueryList par image
  private disponible: boolean | null = null
  // le dernier libellé écrit : le bouton ne se réécrit qu'au changement,
  // sinon c'est une mutation du DOM à chaque image sur le fil du rendu
  private libelleBouton = ''
  private etat = ''
  private envoiEnCours = false

  constructor(
    private readonly host: HTMLElement,
    private readonly bouton: HTMLButtonElement | null,
    private readonly hooks: HooksCapture,
  ) {
    bouton?.addEventListener('click', () => void this.demarre())
    host.addEventListener('click', (e) => this.clic(e))
    host.addEventListener('change', (e) => {
      const t = e.target as HTMLElement
      if (t.id === 'cc-fiche') this.ficheChoisie = (t as HTMLSelectElement).value
    })
  }

  /** Enregistre-t-on en ce moment ? (le HUD affiche le compte à rebours) */
  get enCours(): boolean {
    return this.etape === 'enregistre'
  }

  /** Lance l'enregistrement — rien si un autre est en cours ou si le
   *  navigateur ne sait pas enregistrer. */
  demarre(): void {
    if (this.etape === 'enregistre' || !this.hooks.concepteur()) return
    if (this.tampon.armee) {
      void this.figeTampon()
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      this.montre('Ce navigateur n’enregistre pas de vidéo.')
      return
    }
    const mime = typeCapture((m) => MediaRecorder.isTypeSupported(m))
    if (!mime) {
      this.montre('Aucun format vidéo enregistrable ici (ni WebM ni MP4).')
      return
    }
    const { gl } = this.hooks.sources()
    const cadre = cadreCapture(gl.width, gl.height)
    const toile = document.createElement('canvas')
    toile.width = cadre.largeur
    toile.height = cadre.hauteur
    const ctx = toile.getContext('2d')
    if (!ctx) return
    this.libere()
    this.toile = toile
    this.ctx = ctx
    this.cadre = cadre
    this.morceaux = []
    // captureStream(ips) prend une image à chaque dessin, plafonné : on
    // compose à chaque rappel d'animation, le flux garde ce qu'il lui faut
    const flux = toile.captureStream(IPS_CAPTURE)
    let enregistreur: MediaRecorder
    try {
      enregistreur = new MediaRecorder(flux, { mimeType: mime, videoBitsPerSecond: DEBIT_CAPTURE })
    } catch {
      this.montre('L’enregistreur a refusé de démarrer.')
      return
    }
    enregistreur.ondataavailable = (e) => {
      if (e.data.size > 0) this.morceaux.push(e.data)
    }
    enregistreur.onstop = () => this.termine(mime)
    this.enregistreur = enregistreur
    this.dureeComposee = 0
    this.derniereImage = performance.now()
    this.imagesComposees = 0
    this.etape = 'enregistre'
    this.host.hidden = true
    document.addEventListener('visibilitychange', this.surVisibilite)
    enregistreur.start(250)
    this.majBouton()
  }

  /** L'onglet se cache : l'enregistreur marque une pause, sinon il coudrait
   *  des secondes de la dernière image figée dans la boucle. */
  private visibilite(): void {
    const r = this.enregistreur
    if (!r || this.etape !== 'enregistre') return
    if (document.hidden && r.state === 'recording') r.pause()
    else if (!document.hidden && r.state === 'paused') {
      r.resume()
      this.derniereImage = performance.now()
    }
  }

  /** À appeler à CHAQUE image, après le rendu des deux canvas : compose la
   *  découpe dans la toile de capture. Ne coûte rien hors enregistrement. */
  compose(): void {
    this.alimenteTampon()
    if (this.etape !== 'enregistre' || !this.ctx || !this.toile || !this.cadre) return
    const { gl, fx } = this.hooks.sources()
    this.composeDans(this.ctx, this.cadre, gl, fx)
    this.imagesComposees++
    const maintenant = performance.now()
    // un écart plafonné à 100 ms : une image qui a mis dix secondes à venir
    // ne vaut pas dix secondes de boucle
    this.dureeComposee += Math.min(100, maintenant - this.derniereImage)
    this.derniereImage = maintenant
    this.majBouton(this.dureeComposee)
    // On n'arrête jamais sur la PREMIÈRE image composée : le flux du canvas
    // livre une image à l'encodeur après le dessin, et un stop() dans la
    // foulée du seul dessin rend un fichier vide (vu sur un rendu à moins
    // d'une image par seconde : quatre secondes, une image, zéro octet).
    if (this.dureeComposee >= DUREE_CAPTURE_MS && this.imagesComposees >= 2 && this.enregistreur?.state === 'recording') {
      this.enregistreur.stop()
    }
  }

  private composeDans(g: CanvasRenderingContext2D, c: CadreCapture, gl: HTMLCanvasElement, fx: HTMLCanvasElement): void {
    g.drawImage(gl, c.x * gl.width, c.y * gl.height, c.w * gl.width, c.h * gl.height, 0, 0, c.largeur, c.hauteur)
    g.drawImage(fx, c.x * fx.width, c.y * fx.height, c.w * fx.width, c.h * fx.height, 0, 0, c.largeur, c.hauteur)
  }

  /** La mémoire de capture, à chaque image : armée si le réglage le dit
   *  et que l'appareil le permet, éteinte sinon — et jamais pendant qu'un
   *  enregistrement de quatre secondes tourne, ni pendant le figeage. */
  private alimenteTampon(): void {
    if (this.disponible === null) this.disponible = tamponDisponible()
    const ips = this.hooks.concepteur() && this.disponible ? this.hooks.cadenceTampon() : 0
    if (ips === 0) {
      if (this.tampon.cadence !== 0) {
        this.tampon.eteint()
        this.toileTampon = null
        this.majBouton()
      }
      return
    }
    if (this.etape === 'enregistre' || this.figeEnCours) return
    const { gl, fx } = this.hooks.sources()
    const cadre = cadreCapture(gl.width, gl.height)
    // une taille qui change (fenêtre redimensionnée) recrée la toile et
    // ré-arme l'encodeur : la mémoire repart de zéro, c'est le prix
    if (!this.toileTampon || !this.cadreTampon || this.cadreTampon.largeur !== cadre.largeur || this.cadreTampon.hauteur !== cadre.hauteur) {
      const toile = document.createElement('canvas')
      toile.width = cadre.largeur
      toile.height = cadre.hauteur
      this.ctxTampon = toile.getContext('2d')
      this.toileTampon = toile
      this.cadreTampon = cadre
    }
    this.tampon.arme(ips, cadre.largeur, cadre.hauteur)
    if (!this.tampon.armee || !this.ctxTampon) return
    this.composeDans(this.ctxTampon, cadre, gl, fx)
    this.tampon.pousse(this.toileTampon)
    this.majBouton()
  }

  /** Le clic, mémoire armée : on fige ce qu'elle tient, et le fichier prend
   *  le chemin de tout enregistrement. */
  private async figeTampon(): Promise<void> {
    if (this.figeEnCours) return
    this.figeEnCours = true
    this.host.hidden = true
    let resultat: Awaited<ReturnType<TamponCapture['fige']>> = null
    try {
      resultat = await this.tampon.fige()
    } catch {
      resultat = null
    }
    this.figeEnCours = false
    if (!resultat) {
      this.montre('La mémoire de capture est encore vide : jouez une seconde, puis réessayez.')
      return
    }
    this.presente(new Blob([resultat.fichier], { type: 'video/webm' }), 'video/webm', resultat.secondes)
  }

  private termine(mime: string): void {
    document.removeEventListener('visibilitychange', this.surVisibilite)
    this.presente(new Blob(this.morceaux, { type: typeNu(mime) }), mime, DUREE_CAPTURE_MS / 1000)
  }

  /** Un enregistrement prêt, d'où qu'il vienne : le panneau. */
  private presente(blob: Blob, mime: string, secondes: number): void {
    this.etape = 'pret'
    this.resultat = blob
    if (this.urlResultat) URL.revokeObjectURL(this.urlResultat)
    this.urlResultat = URL.createObjectURL(blob)
    const v = verdictCapture(blob.size, mime, secondes)
    this.etat = v.texte
    const fiches = this.hooks.fiches()
    if (!fiches.some((f) => f.id === this.ficheChoisie)) this.ficheChoisie = fiches[0]?.id ?? ''
    this.majBouton()
    this.render()
    this.host.hidden = false
  }

  private montre(message: string): void {
    this.etat = message
    this.render()
    this.host.hidden = false
  }

  private majBouton(ecouleMs = 0): void {
    const b = this.bouton
    if (!b) return
    let texte: string
    let enregistre = false
    let sautees = false
    if (this.etape === 'enregistre') {
      const reste = Math.max(0, DUREE_CAPTURE_MS - ecouleMs) / 1000
      texte = `⏺ ${reste.toFixed(1).replace('.', ',')} s`
      enregistre = true
    } else if (this.tampon.armee) {
      // la mémoire se remplit : le bouton dit ce qu'il sauvera
      texte = `⏺ ${Math.min(this.tampon.secondes, 8).toFixed(0)} s`
      sautees = this.tampon.sautees > 30
    } else {
      texte = '⏺ CAPTURER'
    }
    const libelle = `${texte}|${enregistre}|${sautees}`
    if (libelle === this.libelleBouton) return
    this.libelleBouton = libelle
    b.textContent = texte
    b.classList.toggle('enregistre', enregistre)
    b.classList.toggle('sautees', sautees)
  }

  private render(): void {
    const fiches = this.hooks.fiches()
    const options = fiches
      .map((f) => `<option value="${esc(f.id)}"${f.id === this.ficheChoisie ? ' selected' : ''}>${esc(f.titre)} · ${esc(f.groupe)}</option>`)
      .join('')
    const pret = this.etape === 'pret' && this.resultat && verdictCapture(this.resultat.size, this.resultat.type).ok
    this.host.innerHTML =
      `<div class="cc-boite" role="dialog" aria-label="La capture pour le codex">` +
      `<h2>CAPTURE POUR LE CODEX</h2>` +
      (this.urlResultat
        ? `<video class="cc-video" src="${this.urlResultat}" muted loop autoplay playsinline></video>`
        : '') +
      `<p class="cc-etat">${esc(this.etat)}</p>` +
      (pret
        ? `<label><span>LA FICHE</span><select id="cc-fiche">${options}</select></label>` +
          `<div class="cc-boutons">` +
          `<button type="button" id="cc-envoyer"${this.envoiEnCours ? ' disabled' : ''}>ENVOYER AU CODEX</button>` +
          `<button type="button" id="cc-telecharger">TÉLÉCHARGER</button>` +
          `<button type="button" id="cc-refaire">REFAIRE</button>` +
          `<button type="button" id="cc-fermer">FERMER</button>` +
          `</div>`
        : `<div class="cc-boutons"><button type="button" id="cc-fermer">FERMER</button></div>`) +
      `<p class="cc-note">Envoyée, la vidéo prime sur celle du dossier pour tout le monde (magasin partagé). Téléchargée, elle porte le nom que public/assets/codex/ attend.${this.tampon.sautees > 0 ? ` La mémoire a sauté ${this.tampon.sautees} image${this.tampon.sautees > 1 ? 's' : ''} : l’encodeur ne suivait pas — baissez la cadence dans PARAMÈTRES.` : ''}</p>` +
      `</div>`
  }

  private clic(e: Event): void {
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null
    if (!b) return
    if (b.id === 'cc-fermer') {
      this.host.hidden = true
      return
    }
    if (b.id === 'cc-refaire') {
      this.host.hidden = true
      this.demarre()
      return
    }
    if (b.id === 'cc-telecharger' && this.resultat && this.urlResultat) {
      const a = document.createElement('a')
      a.href = this.urlResultat
      a.download = nomFichierCapture(this.ficheChoisie || 'capture', this.resultat.type)
      a.click()
      return
    }
    if (b.id === 'cc-envoyer') void this.envoie()
  }

  private async envoie(): Promise<void> {
    if (!this.resultat || !this.ficheChoisie || this.envoiEnCours) return
    this.envoiEnCours = true
    this.etat = 'Envoi…'
    this.render()
    let ok = false
    try {
      const data = await blobEnBase64(this.resultat)
      ok = await this.hooks.envoie(this.ficheChoisie, { type: this.resultat.type, data })
    } catch {
      ok = false
    }
    this.envoiEnCours = false
    this.etat = ok
      ? `Envoyée à la fiche « ${this.hooks.fiches().find((f) => f.id === this.ficheChoisie)?.titre ?? this.ficheChoisie} ».`
      : 'Échec de l’envoi : le magasin partagé ne répond pas.'
    this.render()
  }

  private libere(): void {
    document.removeEventListener('visibilitychange', this.surVisibilite)
    if (this.enregistreur && this.enregistreur.state !== 'inactive') this.enregistreur.stop()
    this.enregistreur = null
    this.resultat = null
    if (this.urlResultat) URL.revokeObjectURL(this.urlResultat)
    this.urlResultat = ''
  }
}

const esc = (t: string): string =>
  t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
