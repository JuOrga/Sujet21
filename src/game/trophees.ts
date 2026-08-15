// Trophées du protocole : les succès internes du jeu — conçus pour se
// brancher 1:1 sur Steamworks le jour d'une sortie Steam (chaque
// déblocage interne appellera en plus l'API Steam ; les identifiants
// ci-dessous sont les futurs identifiants Steam). Là où les records
// récompensent l'OPTIMISATION, les trophées récompensent l'EXPLORATION
// des mécaniques : des raisons de rejouer orthogonales au palmarès.

export interface TropheeDef {
  id: string
  nom: string
  desc: string
  icone: string
}

export const TROPHEES: TropheeDef[] = [
  {
    id: 'sans-une-goutte',
    nom: 'Sans une goutte',
    desc: 'Conclure une salle en livrant au moins 95 % du volume de départ.',
    icone: '💧',
  },
  {
    id: 'palet-parfait',
    nom: 'Palet parfait',
    desc: 'Rester gelé 30 secondes d’affilée dans une même salle.',
    icone: '❄',
  },
  {
    id: 'trois-etats',
    nom: 'Trois états',
    desc: 'Liquide, glace et vapeur dans la même salle, en moins de 15 secondes.',
    icone: '☯',
  },
  {
    id: 'ligne-de-crete',
    nom: 'La ligne de crête',
    desc: 'Décrocher le rang 1 en NOTE sur une salle du palmarès partagé.',
    icone: '🏔',
  },
  {
    id: 'miroir-vivant',
    nom: 'Miroir vivant',
    desc: 'Réfléchir un laser avec son propre corps gelé.',
    icone: '🔦',
  },
  {
    id: 'recondense',
    nom: 'Recondensé',
    desc: 'Faire perler cinq gouttes de rosée sur une plaque froide.',
    icone: '🫧',
  },
  {
    id: 'integrale',
    nom: 'L’intégrale',
    desc: 'Boucler toute l’expédition en une seule session.',
    icone: '🛰',
  },
  {
    id: 'operateur-de-nuit',
    nom: 'Opérateur de nuit',
    desc: 'Vingt-et-une collectes réussies, toutes sessions confondues.',
    icone: '🌙',
  },
]

const CLE = 'sujet21-trophees'
const CLE_COMPTEURS = 'sujet21-trophees-compteurs'

/** Déblocages (id → date ISO) et compteurs cumulés, persistés en local.
 * Un rappel `onDebloque` reçoit chaque trophée NOUVELLEMENT gagné — c'est
 * là que le toast s'accroche, et plus tard l'appel Steamworks. */
export class Trophees {
  private etat: Record<string, string> = {}
  private compteurs: Record<string, number> = {}
  onDebloque: (t: TropheeDef) => void = () => {}

  constructor(private readonly storage: Storage | null = null) {
    try {
      const s = this.storage ?? localStorage
      this.etat = JSON.parse(s.getItem(CLE) ?? '{}') as Record<string, string>
      this.compteurs = JSON.parse(s.getItem(CLE_COMPTEURS) ?? '{}') as Record<string, number>
    } catch {
      // stockage indisponible : les trophées vivent le temps de la session
    }
  }

  private sauve(): void {
    try {
      const s = this.storage ?? localStorage
      s.setItem(CLE, JSON.stringify(this.etat))
      s.setItem(CLE_COMPTEURS, JSON.stringify(this.compteurs))
    } catch {
      // sans gravité
    }
  }

  gagne(id: string): boolean {
    return id in this.etat
  }

  quand(id: string): string {
    return this.etat[id] ?? ''
  }

  /** Débloque (idempotent). Retourne true si c'est un déblocage NOUVEAU. */
  debloque(id: string): boolean {
    if (id in this.etat) return false
    const def = TROPHEES.find((t) => t.id === id)
    if (!def) return false
    this.etat[id] = new Date().toISOString()
    this.sauve()
    this.onDebloque(def)
    return true
  }

  /** Incrémente un compteur cumulé (collectes…) et retourne sa valeur. */
  compte(cle: string, delta = 1): number {
    this.compteurs[cle] = (this.compteurs[cle] ?? 0) + delta
    this.sauve()
    return this.compteurs[cle]
  }

  compteur(cle: string): number {
    return this.compteurs[cle] ?? 0
  }

  nbGagnes(): number {
    return Object.keys(this.etat).length
  }
}
