// LA MÉMOIRE DE CAPTURE — les huit dernières secondes, toujours prêtes.
//
// Le bouton CAPTURER filme quatre secondes à partir du clic : on n'a jamais
// le doigt dessus au moment où l'effet se produit. Ici c'est l'inverse, à
// la manière d'un enregistreur de rejeu de console : quand le réglage est
// armé (PARAMÈTRES, mode concepteur, PC seulement), chaque image composée
// part dans l'encodeur vidéo du navigateur (WebCodecs), et l'on ne garde
// que les morceaux encodés des huit dernières secondes. Le clic fige ce
// qu'il y a, l'assembleur (webm.ts) en fait un fichier, et le panneau de la
// capture le présente comme un enregistrement ordinaire.
//
// CE QUE ÇA COÛTE, et pourquoi le réglage n'existe que sur PC. L'encodage
// tourne hors du fil principal, par le matériel quand le navigateur en a
// un ; sur le fil du rendu ne reste que la composition de l'image dans la
// petite toile (déjà la dépense de la capture de quatre secondes) et la
// création d'une VideoFrame depuis cette toile. Sur un téléphone,
// l'encodeur logiciel se battrait avec le solveur pour les mêmes cœurs :
// le réglage ne s'y montre pas. La mémoire, elle, est dérisoire : huit
// secondes encodées pèsent de l'ordre du mégaoctet, jamais des images
// brutes.
//
// L'ENCODEUR NE DOIT JAMAIS FREINER LE JEU : si sa file s'allonge (une
// machine qui n'y arrive pas), on saute des images plutôt que d'attendre.
// Une image sautée dans la mémoire vaut mieux qu'une image en retard à
// l'écran.
//
// La partie pure (l'élagage de la file, la cadence) est en tête, testée
// sans DOM ; la classe en dessous ne vit qu'avec WebCodecs.

import { assembleWebm, type MorceauVideo } from './webm'

/** Huit secondes : de quoi rattraper un effet vu trop tard, sous les trois
 *  mégaoctets du magasin même à 60 images par seconde. */
export const DUREE_TAMPON_MS = 8000
/** Une image clé par seconde : la mémoire élague par clusters d'une
 *  seconde, et un fichier commence toujours sur une clé. */
export const INTERVALLE_CLE_MS = 1000
/** Les cadences offertes. 0 : la mémoire est éteinte, rien ne tourne. */
export const CADENCES_TAMPON = [0, 30, 60] as const
export type CadenceTampon = (typeof CADENCES_TAMPON)[number]

/** Le débit selon la cadence : 60 images par seconde en réclament plus,
 *  mais pas le double — les images se ressemblent d'autant plus. Huit
 *  secondes à 2 Mbit/s font 2 Mo : sous le plafond du magasin (3 Mo). */
export function debitPour(ips: CadenceTampon): number {
  return ips >= 60 ? 2_000_000 : 1_200_000
}

/** Élague la file : on retire du début tant qu'une image CLÉ plus loin
 *  laisse encore `dureeMaxUs` de vidéo derrière elle. Le fichier commence
 *  ainsi toujours sur une clé, et garde entre huit et neuf secondes. */
export function elague(morceaux: MorceauVideo[], dureeMaxUs: number): MorceauVideo[] {
  if (morceaux.length === 0) return morceaux
  const fin = morceaux[morceaux.length - 1].tempsUs
  let debut = 0
  for (let i = 1; i < morceaux.length; i++) {
    if (morceaux[i].cle && fin - morceaux[i].tempsUs >= dureeMaxUs) debut = i
  }
  return debut > 0 ? morceaux.slice(debut) : morceaux
}

/** L'image du moment doit-elle partir à l'encodeur ? À 30 images par
 *  seconde sur un rendu à 60, une sur deux ; la décision se prend sur le
 *  temps écoulé depuis la dernière envoyée, avec une marge d'un tiers de
 *  période — un rendu à 58 Hz ne doit pas en laisser passer une sur trois. */
export function aEncoder(depuisDerniereMs: number, ips: number): boolean {
  if (ips <= 0) return false
  return depuisDerniereMs >= (1000 / ips) * (2 / 3)
}

/** Le tampon est-il disponible sur cet appareil ? PC et Steam Deck : un
 *  pointeur fin et l'encodeur WebCodecs. Le tactile reste dehors — c'est
 *  là que l'encodeur logiciel se bat avec le solveur. */
export function tamponDisponible(
  fenetre: { matchMedia?: (q: string) => { matches: boolean } } = window,
  encodeur: unknown = typeof VideoEncoder === 'undefined' ? undefined : VideoEncoder,
): boolean {
  if (!encodeur) return false
  const tactile = fenetre.matchMedia?.('(pointer: coarse)').matches ?? false
  return !tactile
}

/** Le codec demandé à WebCodecs : VP9 profil 0, 8 bits, 4:2:0. */
export const CODEC_VP9 = 'vp09.00.10.08'

// ---- LA CLASSE : ne vit qu'avec WebCodecs ------------------------------------------

export class TamponCapture {
  private encodeur: VideoEncoder | null = null
  private morceaux: MorceauVideo[] = []
  private largeur = 0
  private hauteur = 0
  private ips: CadenceTampon = 0
  private derniereEnvoyeeMs = -Infinity
  private derniereCleUs = -Infinity
  private origineMs = 0
  private enPanne = false
  /** images sautées parce que l'encodeur était en retard — pour le panneau */
  sautees = 0

  get armee(): boolean {
    return this.ips > 0 && this.encodeur !== null && !this.enPanne
  }

  get cadence(): CadenceTampon {
    return this.ips
  }

  /** Les secondes en mémoire, pour le bouton du HUD. */
  get secondes(): number {
    if (this.morceaux.length < 2) return 0
    return (this.morceaux[this.morceaux.length - 1].tempsUs - this.morceaux[0].tempsUs) / 1e6
  }

  /** Arme (ou re-arme à une autre cadence ou taille) — un changement vide
   *  la mémoire : l'encodeur ne change pas de taille en cours de route. */
  arme(ips: CadenceTampon, largeur: number, hauteur: number): void {
    if (ips === this.ips && largeur === this.largeur && hauteur === this.hauteur && this.encodeur) return
    this.eteint()
    if (ips === 0 || typeof VideoEncoder === 'undefined') return
    this.ips = ips
    this.largeur = largeur
    this.hauteur = hauteur
    this.origineMs = performance.now()
    const enc = new VideoEncoder({
      output: (morceau) => this.recoit(morceau),
      error: () => {
        // l'encodeur a lâché (mémoire, pilote) : la mémoire se tait, le
        // bouton retombe sur la capture ordinaire — jamais une exception
        // dans la boucle du jeu
        this.enPanne = true
      },
    })
    try {
      enc.configure({
        codec: CODEC_VP9,
        width: largeur,
        height: hauteur,
        bitrate: debitPour(ips),
        framerate: ips,
        latencyMode: 'realtime',
      })
    } catch {
      this.enPanne = true
      return
    }
    this.encodeur = enc
    this.enPanne = false
  }

  eteint(): void {
    if (this.encodeur) {
      try {
        this.encodeur.close()
      } catch {
        // déjà fermé : sans gravité
      }
    }
    this.encodeur = null
    this.morceaux = []
    this.ips = 0
    this.derniereEnvoyeeMs = -Infinity
    this.derniereCleUs = -Infinity
    this.sautees = 0
    this.enPanne = false
  }

  /** À chaque image composée : l'envoie à l'encodeur si la cadence le
   *  veut et si l'encodeur suit. */
  pousse(toile: HTMLCanvasElement): void {
    const enc = this.encodeur
    if (!enc || this.enPanne || enc.state !== 'configured') return
    const maintenant = performance.now()
    if (!aEncoder(maintenant - this.derniereEnvoyeeMs, this.ips)) return
    // encode() ne bloque pas : la file est celle de l'encodeur, hors du fil
    // du jeu. On la laisse absorber un à-coup (six images, un dixième de
    // seconde à 60) ; au-delà, l'encodeur ne suit pas et l'on saute plutôt
    // que de laisser la file enfler
    if (enc.encodeQueueSize > 6) {
      this.sautees++
      return
    }
    this.derniereEnvoyeeMs = maintenant
    const tempsUs = Math.round((maintenant - this.origineMs) * 1000)
    const cle = tempsUs - this.derniereCleUs >= INTERVALLE_CLE_MS * 1000
    if (cle) this.derniereCleUs = tempsUs
    let image: VideoFrame
    try {
      image = new VideoFrame(toile, { timestamp: tempsUs })
    } catch {
      return
    }
    try {
      enc.encode(image, { keyFrame: cle })
    } finally {
      image.close()
    }
  }

  private recoit(morceau: EncodedVideoChunk): void {
    const donnees = new Uint8Array(morceau.byteLength)
    morceau.copyTo(donnees)
    this.morceaux.push({ donnees, cle: morceau.type === 'key', tempsUs: morceau.timestamp })
    this.morceaux = elague(this.morceaux, DUREE_TAMPON_MS * 1000)
  }

  /** Fige la mémoire : vide l'encodeur, assemble le fichier. Null quand
   *  rien n'est prêt (moins d'une image clé). La mémoire continue ensuite. */
  async fige(): Promise<{ fichier: Uint8Array; secondes: number } | null> {
    const enc = this.encodeur
    if (!enc || enc.state !== 'configured') return null
    try {
      await enc.flush()
    } catch {
      return null
    }
    const morceaux = elague(this.morceaux, DUREE_TAMPON_MS * 1000)
    const premiereCle = morceaux.findIndex((m) => m.cle)
    if (premiereCle < 0) return null
    const utiles = morceaux.slice(premiereCle)
    if (utiles.length < 2) return null
    const secondes = (utiles[utiles.length - 1].tempsUs - utiles[0].tempsUs) / 1e6
    return { fichier: assembleWebm(utiles, this.largeur, this.hauteur, 'V_VP9'), secondes }
  }
}
