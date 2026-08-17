// La bibliothèque d'images : l'écran où les concepteurs IMPORTENT leurs
// visuels (planches de cinématiques, décors à venir) — recomprimés en WebP
// côté client, hébergés par /api/images, visibles de tous les postes.
// Deux usages : gestionnaire (depuis l'éditeur) et SÉLECTEUR (depuis la
// table de montage : open(choisir) — cliquer une vignette rend son URL).

import { deleteImage, fetchImages, pushImage, type SharedImage } from './netImages'

export interface ImagerieOptions {
  auteur: () => string
}

export class Imagerie {
  private images: SharedImage[] = []
  private choisir: ((url: string) => void) | null = null
  private readonly grilleEl: HTMLDivElement
  private readonly statutEl: HTMLSpanElement
  private readonly fichierEl: HTMLInputElement

  constructor(
    private readonly root: HTMLElement,
    private readonly opts: ImagerieOptions,
  ) {
    root.innerHTML = `
      <div class="im-tete">
        <span class="im-titre">BIBLIOTHÈQUE D'IMAGES</span>
        <span class="im-statut"></span>
        <span class="im-souffle"></span>
        <button type="button" class="im-importer">＋ IMPORTER</button>
        <button type="button" class="im-fermer">FERMER</button>
      </div>
      <div class="im-grille"></div>
      <input type="file" accept="image/*" multiple hidden />`
    this.grilleEl = root.querySelector('.im-grille') as HTMLDivElement
    this.statutEl = root.querySelector('.im-statut') as HTMLSpanElement
    this.fichierEl = root.querySelector('input[type=file]') as HTMLInputElement
    root.querySelector('.im-importer')!.addEventListener('click', () => this.fichierEl.click())
    root.querySelector('.im-fermer')!.addEventListener('click', () => this.close())
    this.fichierEl.addEventListener('change', () => void this.importe())
  }

  get visible(): boolean {
    return this.root.classList.contains('visible')
  }

  /** Ouvre la bibliothèque ; avec `choisir`, cliquer une vignette rend son
   *  URL et referme (mode sélecteur de la table de montage). */
  open(choisir?: (url: string) => void): void {
    this.choisir = choisir ?? null
    this.root.classList.toggle('im-mode-choix', !!choisir)
    this.root.classList.add('visible')
    this.statut('chargement…')
    void fetchImages().then((liste) => {
      if (liste) {
        this.images = liste
        this.statut(liste.length === 0 ? 'la bibliothèque est vide — importez !' : '')
      } else {
        this.statut('bibliothèque injoignable (hors ligne ?) ')
      }
      this.dessine()
    })
  }

  close(): void {
    this.root.classList.remove('visible')
    this.choisir = null
  }

  private statut(txt: string): void {
    this.statutEl.textContent = txt
  }

  private async importe(): Promise<void> {
    const fichiers = Array.from(this.fichierEl.files ?? [])
    this.fichierEl.value = ''
    for (const f of fichiers) {
      const nom = f.name.replace(/\.[^.]+$/, '')
      this.statut(`import de « ${nom} »…`)
      const liste = await pushImage(nom, f, this.opts.auteur())
      if (liste) {
        this.images = liste
        this.statut('')
      } else {
        this.statut(`échec de l'import de « ${nom} » (fichier illisible ou trop lourd ?)`)
      }
      this.dessine()
    }
  }

  private dessine(): void {
    this.grilleEl.innerHTML = ''
    for (const img of this.images) {
      const carte = document.createElement('div')
      carte.className = 'im-carte'
      carte.innerHTML = `
        <div class="im-vue"><img alt="" loading="lazy" draggable="false" /></div>
        <div class="im-pied"><b></b><span>${Math.max(1, Math.round(img.poids / 1024))} Ko${
          img.auteur ? ' · ' + img.auteur : ''
        }</span></div>
        <div class="im-outils">
          <button type="button" data-im="lien" title="Copier le lien de l'image">LIEN</button>
          <button type="button" data-im="retirer" title="Retirer de la bibliothèque">✕</button>
        </div>`
      ;(carte.querySelector('.im-vue img') as HTMLImageElement).src = img.url
      ;(carte.querySelector('.im-pied b') as HTMLElement).textContent = img.nom
      carte.querySelector('.im-vue')!.addEventListener('click', () => {
        if (this.choisir) {
          const rend = this.choisir
          this.close()
          rend(img.url)
        }
      })
      carte.querySelector('[data-im=lien]')!.addEventListener('click', () => {
        void navigator.clipboard?.writeText(img.url).then(
          () => this.statut(`lien de « ${img.nom} » copié`),
          () => this.statut(img.url), // sans presse-papier : l'URL s'affiche
        )
      })
      carte.querySelector('[data-im=retirer]')!.addEventListener('click', () => {
        this.statut(`retrait de « ${img.nom} »…`)
        void deleteImage(img.nom).then((liste) => {
          if (liste) {
            this.images = liste
            this.statut('')
          } else {
            this.statut('retrait impossible (hors ligne ?)')
          }
          this.dessine()
        })
      })
      this.grilleEl.appendChild(carte)
    }
  }
}
