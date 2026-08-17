// Le lecteur de cinématiques : un écran DOM plein écran (aucune simulation
// derrière), qui enchaîne les planches d'une CinematiqueDef. Règles de
// confort non négociables : toucher = planche suivante, MAINTENIR = sauter
// toute la cinématique (roguelike : on ne revoit pas l'ouverture à chaque
// run), Échap = sauter aussi. Les effets sont des classes CSS — le lecteur
// ne connaît que leur nom et leur durée.

import type { CinematiqueDef, PlancheDef } from './cinematique'

// Le son passe par des rappels : le lecteur ne connaît ni AudioFx ni la
// bande-son — main.ts branche, et la table de montage peut prévisualiser
// en silence si besoin.
export interface SonsCine {
  bruitage(nom: string): void
  ponctuation(nom: string): void
  /** Une piste imposée par la planche — null : la cinématique est finie,
   *  rendre la main (le tableau suivant réimposera la sienne). */
  piste(nom: string | null): void
}

const MAINTIEN_MS = 650 // durée du maintien pour tout sauter
const CLIC_MS = 350 // en deçà : c'est un toucher (planche suivante)

export class LecteurCinematique {
  private readonly sceneEl: HTMLDivElement
  private readonly imgEl: HTMLImageElement
  private readonly rougeEl: HTMLDivElement
  private readonly voileEl: HTMLDivElement
  private readonly texteEl: HTMLParagraphElement
  private readonly jaugeEl: HTMLDivElement

  private planches: PlancheDef[] = []
  private index = -1
  private minuteur = 0
  private maintien = 0
  private appui = 0
  private fin: (() => void) | null = null

  constructor(
    private readonly root: HTMLElement,
    private readonly sons: SonsCine,
  ) {
    root.innerHTML = `
      <div class="cn-scene"><img class="cn-img" alt="" draggable="false" />
        <div class="cn-rouge"></div></div>
      <div class="cn-voile"></div>
      <p class="cn-texte"></p>
      <div class="cn-pied"><span>TOUCHER — SUITE</span><b>MAINTENIR — PASSER</b></div>
      <div class="cn-jauge"><i></i></div>`
    this.sceneEl = root.querySelector('.cn-scene') as HTMLDivElement
    this.imgEl = root.querySelector('.cn-img') as HTMLImageElement
    this.rougeEl = root.querySelector('.cn-rouge') as HTMLDivElement
    this.voileEl = root.querySelector('.cn-voile') as HTMLDivElement
    this.texteEl = root.querySelector('.cn-texte') as HTMLParagraphElement
    this.jaugeEl = root.querySelector('.cn-jauge') as HTMLDivElement

    root.addEventListener('pointerdown', this.surAppui)
    root.addEventListener('pointerup', this.surRelache)
    root.addEventListener('pointercancel', this.annuleAppui)
    root.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  get actif(): boolean {
    return this.fin !== null
  }

  /** Joue la cinématique ; résout à la fin (naturelle ou sautée). */
  joue(cine: CinematiqueDef): Promise<void> {
    if (this.fin) return Promise.resolve() // déjà en lecture : on n'empile pas
    if (cine.planches.length === 0) return Promise.resolve()
    this.planches = cine.planches
    this.index = -1
    this.root.hidden = false
    window.addEventListener('keydown', this.surTouche)
    return new Promise((resolve) => {
      this.fin = resolve
      this.avance()
    })
  }

  private avance = (): void => {
    clearTimeout(this.minuteur)
    this.index++
    if (this.index >= this.planches.length) {
      this.termine()
      return
    }
    const p = this.planches[this.index]
    // l'image et son mouvement : la classe repart de zéro (reflow forcé)
    this.imgEl.src = p.image
    this.sceneEl.className = 'cn-scene'
    void this.sceneEl.offsetWidth
    this.sceneEl.classList.add(`cn-effet-${p.effet}`)
    this.sceneEl.style.setProperty('--cn-duree', `${p.duree}s`)
    this.rougeEl.classList.toggle('cn-alerte', p.effet === 'battement-rouge')
    // le fondu d'entrée
    this.voileEl.className = 'cn-voile'
    if (p.fondu !== 'aucun') {
      void this.voileEl.offsetWidth
      this.voileEl.classList.add(`cn-fondu-${p.fondu}`)
    }
    // le texte
    this.texteEl.textContent = p.texte
    this.texteEl.classList.remove('cn-parait')
    if (p.texte) {
      void this.texteEl.offsetWidth
      this.texteEl.classList.add('cn-parait')
    }
    // les sons de la planche
    if (p.piste) this.sons.piste(p.piste)
    if (p.bruitage) this.sons.bruitage(p.bruitage)
    if (p.ponctuation) this.sons.ponctuation(p.ponctuation)
    // la suivante se précharge pendant que celle-ci se joue
    const prochaine = this.planches[this.index + 1]
    if (prochaine?.image) new Image().src = prochaine.image
    this.minuteur = window.setTimeout(this.avance, p.duree * 1000)
  }

  private termine(): void {
    clearTimeout(this.minuteur)
    clearTimeout(this.maintien)
    window.removeEventListener('keydown', this.surTouche)
    this.root.hidden = true
    this.jaugeEl.classList.remove('cn-remplit')
    this.imgEl.src = ''
    this.sons.piste(null)
    const fin = this.fin
    this.fin = null
    fin?.()
  }

  private surAppui = (e: PointerEvent): void => {
    if (!this.fin || e.button > 0) return
    this.appui = performance.now()
    this.jaugeEl.style.setProperty('--cn-maintien', `${MAINTIEN_MS}ms`)
    this.jaugeEl.classList.add('cn-remplit')
    this.maintien = window.setTimeout(() => this.termine(), MAINTIEN_MS)
  }

  private surRelache = (): void => {
    if (!this.fin) return
    clearTimeout(this.maintien)
    this.jaugeEl.classList.remove('cn-remplit')
    if (performance.now() - this.appui < CLIC_MS) this.avance()
  }

  private annuleAppui = (): void => {
    clearTimeout(this.maintien)
    this.jaugeEl.classList.remove('cn-remplit')
  }

  private surTouche = (e: KeyboardEvent): void => {
    if (!this.fin) return
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopImmediatePropagation() // Échap ne doit pas AUSSI rouvrir la fiche
      this.termine()
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      this.avance()
    }
  }
}
