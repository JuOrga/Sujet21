// La bibliothèque d'images : l'écran où les concepteurs IMPORTENT leurs
// visuels (planches de cinématiques, décors à venir) — recomprimés en WebP
// côté client, hébergés par /api/images, visibles de tous les postes.
// Deux usages : gestionnaire (depuis l'éditeur) et SÉLECTEUR (depuis la
// table de montage : open(choisir) — cliquer une vignette rend son URL).

import { deleteImage, fetchImages, pushImage, type SharedImage } from './netImages'
import { assetsLivres, RUBRIQUES, type AssetLivre } from './assetsLivres'

export interface ImagerieOptions {
  auteur: () => string
}

export class Imagerie {
  private images: SharedImage[] = []
  private choisir: ((url: string) => void) | null = null
  private readonly grilleEl: HTMLDivElement
  private readonly statutEl: HTMLSpanElement
  private readonly fichierEl: HTMLInputElement
  private readonly filtreEl: HTMLInputElement
  // Les images LIVRÉES avec le jeu (public/assets) : toujours là, jamais
  // supprimables — le catalogue se relit à chaque ouverture.
  private readonly livrees: AssetLivre[] = assetsLivres()

  constructor(
    private readonly root: HTMLElement,
    private readonly opts: ImagerieOptions,
  ) {
    root.innerHTML = `
      <div class="im-tete">
        <span class="im-titre">BIBLIOTHÈQUE D'IMAGES</span>
        <span class="im-statut"></span>
        <input class="im-filtre" type="search" placeholder="filtrer…" aria-label="Filtrer les images" />
        <span class="im-souffle"></span>
        <button type="button" class="im-importer">＋ IMPORTER</button>
        <button type="button" class="im-fermer">FERMER</button>
      </div>
      <div class="im-grille"></div>
      <input type="file" accept="image/*" multiple hidden />`
    this.grilleEl = root.querySelector('.im-grille') as HTMLDivElement
    this.statutEl = root.querySelector('.im-statut') as HTMLSpanElement
    this.fichierEl = root.querySelector('input[type=file]') as HTMLInputElement
    this.filtreEl = root.querySelector('.im-filtre') as HTMLInputElement
    this.filtreEl.addEventListener('input', () => this.dessine())
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
    this.filtreEl.value = ''
    // les images livrées s'affichent TOUT DE SUITE : la bibliothèque n'est
    // jamais vide, même hors ligne — le catalogue partagé s'y ajoute après
    this.dessine()
    this.statut('chargement du catalogue partagé…')
    void fetchImages().then((liste) => {
      if (liste) {
        this.images = liste
        this.statut('')
      } else {
        this.statut('catalogue partagé injoignable (hors ligne ?) — les images livrées restent là')
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

  /** Une carte de vignette : livrée (indélébile) ou importée. */
  private carte(nom: string, url: string, pied: string, livree: boolean): HTMLElement {
    const carte = document.createElement('div')
    carte.className = livree ? 'im-carte im-livree' : 'im-carte'
    carte.innerHTML = `
      <div class="im-vue"><img alt="" loading="lazy" draggable="false" /></div>
      <div class="im-pied"><b></b><span></span></div>
      <div class="im-outils">
        <button type="button" data-im="lien" title="Copier le lien de l'image">LIEN</button>
        ${livree ? '' : '<button type="button" data-im="retirer" title="Retirer de la bibliothèque">✕</button>'}
      </div>`
    ;(carte.querySelector('.im-vue img') as HTMLImageElement).src = url
    ;(carte.querySelector('.im-pied b') as HTMLElement).textContent = nom
    ;(carte.querySelector('.im-pied span') as HTMLElement).textContent = pied
    carte.querySelector('.im-vue')!.addEventListener('click', () => {
      if (this.choisir) {
        const rend = this.choisir
        this.close()
        rend(url)
      }
    })
    carte.querySelector('[data-im=lien]')!.addEventListener('click', () => {
      void navigator.clipboard?.writeText(url).then(
        () => this.statut(`lien de « ${nom} » copié`),
        () => this.statut(url), // sans presse-papier : l'URL s'affiche
      )
    })
    carte.querySelector('[data-im=retirer]')?.addEventListener('click', () => {
      this.statut(`retrait de « ${nom} »…`)
      void deleteImage(nom).then((liste) => {
        if (liste) {
          this.images = liste
          this.statut('')
        } else {
          this.statut('retrait impossible (hors ligne ?)')
        }
        this.dessine()
      })
    })
    return carte
  }

  /** Un intertitre de rubrique, avec le compte de ses vignettes. */
  private section(titre: string, n: number): HTMLElement {
    const t = document.createElement('div')
    t.className = 'im-section'
    t.innerHTML = `<span>${titre}</span><i>${n}</i>`
    return t
  }

  // La grille : les IMPORTÉES d'abord (le travail en cours), puis les
  // LIVRÉES par rubrique — surfaces, zones, machinerie, fonds… Un filtre
  // traverse les deux : on cherche « zone » et on voit tout ce qui s'appelle
  // ainsi, d'où qu'il vienne.
  private dessine(): void {
    this.grilleEl.innerHTML = ''
    const q = this.filtreEl.value.trim().toLowerCase()
    const garde = (nom: string, url: string, rubrique = ''): boolean =>
      !q ||
      nom.toLowerCase().includes(q) ||
      url.toLowerCase().includes(q) ||
      rubrique.toLowerCase().includes(q)

    const importees = this.images.filter((i) => garde(i.nom, i.url))
    if (importees.length > 0) {
      this.grilleEl.appendChild(this.section('Importées', importees.length))
      for (const img of importees) {
        const pied = `${Math.max(1, Math.round(img.poids / 1024))} Ko${img.auteur ? ' · ' + img.auteur : ''}`
        this.grilleEl.appendChild(this.carte(img.nom, img.url, pied, false))
      }
    }

    let vus = importees.length
    for (const rubrique of RUBRIQUES) {
      const lot = this.livrees.filter((a) => a.rubrique === rubrique && garde(a.nom, a.url, a.rubrique))
      if (lot.length === 0) continue
      vus += lot.length
      this.grilleEl.appendChild(this.section(rubrique, lot.length))
      for (const a of lot) this.grilleEl.appendChild(this.carte(a.nom, a.url, 'livrée', true))
    }
    if (vus === 0) {
      const vide = document.createElement('p')
      vide.className = 'im-vide'
      vide.textContent = q ? `Rien ne répond à « ${this.filtreEl.value.trim()} ».` : 'Aucune image.'
      this.grilleEl.appendChild(vide)
    }
  }
}
