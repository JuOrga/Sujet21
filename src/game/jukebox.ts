// L'ÉCOUTE — le mini-lecteur des musiques du projet, sur l'accueil, en mode
// concepteur. Le concepteur génère des lits par lots et doit se faire une
// oreille : entendre chaque piste telle que le jeu la jouera (la boucle
// taillée par tools/audio/prepare.py, pas le master), en passer une, revenir
// à la précédente, s'arrêter. Rien ici ne touche la bande-son du joueur :
// ce module ne connaît que la liste et l'ordre ; la lecture est l'affaire de
// Soundtrack.ecoute().
//
// L'ordre est TIRÉ AU SORT à la création — chaque ouverture de l'accueil
// propose les pistes dans un ordre neuf, pour ne pas toujours juger la même
// en premier — puis il est FIXE : « précédent » rend bien la piste qu'on
// vient d'entendre, et un tour complet passe par toutes sans en répéter une.

export type FamilleEcoute = 'lit' | 'ambiance'

export interface PisteEcoute {
  /** le nom du fichier dans public/sound/, sans extension */
  fichier: string
  titre: string
  famille: FamilleEcoute
  /** la piste JOUE dans le jeu (sinon : une candidate, livrée à côté) */
  enJeu: boolean
}

// Les musiques du projet : les six lits qui jouent, et les candidates
// (`-v2`, cf. tools/audio/prepare.py). Une candidate garde le titre que le
// générateur lui a donné : c'est sous ce nom que le concepteur la connaît.
export const PISTES_ECOUTE: readonly PisteEcoute[] = [
  { fichier: 'accueil', titre: 'Accueil — protocole', famille: 'lit', enJeu: true },
  { fichier: 'cuve-tiede', titre: 'Cuve tiède (coque chaude)', famille: 'lit', enJeu: true },
  { fichier: 'cuve-glaciale', titre: 'Cuve glaciale (coque froide)', famille: 'lit', enJeu: true },
  { fichier: 'zone-hublot', titre: 'Hublot fendu (glace)', famille: 'ambiance', enJeu: true },
  { fichier: 'zone-conduite', titre: 'Conduite rompue (vapeur)', famille: 'ambiance', enJeu: true },
  { fichier: 'zone-chambre', titre: 'Chambre pressurisée (eau)', famille: 'ambiance', enJeu: true },
  { fichier: 'accueil-v2', titre: 'M1 — accueil, candidate', famille: 'lit', enJeu: false },
  { fichier: 'cuve-tiede-v2', titre: 'M2 — cuve tiède, candidate', famille: 'lit', enJeu: false },
  { fichier: 'cuve-glaciale-v2', titre: 'Desolate Laboratory — cuve glaciale, candidate', famille: 'lit', enJeu: false },
  { fichier: 'zone-hublot-v2', titre: 'Frozen Hiss — hublot fendu, candidate', famille: 'ambiance', enJeu: false },
  { fichier: 'zone-conduite-v2', titre: 'Warm Pressure — conduite rompue, candidate', famille: 'ambiance', enJeu: false },
  { fichier: 'zone-chambre-v2', titre: 'Warm Dark Rest — chambre pressurisée, candidate', famille: 'ambiance', enJeu: false },
  { fichier: 'temps-suspendu-v2', titre: 'Tension Held — temps suspendu, candidate', famille: 'ambiance', enJeu: false },
  { fichier: 'hub', titre: 'Quiet Resting Atmosphere — lit du hub, candidate', famille: 'lit', enJeu: false },
]

export class Jukebox {
  private readonly ordre: number[]
  private position: number | null = null

  constructor(
    private readonly pistes: readonly PisteEcoute[],
    alea: () => number = Math.random,
  ) {
    // Fisher-Yates : une permutation uniforme, et rien d'autre que `alea`
    // pour la tirer — un test la rend déterministe
    const o = pistes.map((_, i) => i)
    for (let i = o.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.floor(alea() * (i + 1)))
      const t = o[i]
      o[i] = o[j]
      o[j] = t
    }
    this.ordre = o
  }

  /** L'ordre tiré, en indices de la liste — pour les tests et l'affichage. */
  get sequence(): readonly number[] {
    return this.ordre
  }

  /** La piste en cours, ou null à l'arrêt. */
  enCours(): PisteEcoute | null {
    return this.position === null ? null : this.pistes[this.ordre[this.position]]
  }

  /** Le rang affiché (« 3 / 11 »), 0 à l'arrêt. */
  rang(): number {
    return this.position === null ? 0 : this.position + 1
  }

  get total(): number {
    return this.pistes.length
  }

  /** La suivante dans l'ordre tiré ; depuis l'arrêt, la première ; après la
   * dernière, on reboucle. */
  suivant(): PisteEcoute | null {
    if (this.pistes.length === 0) return null
    this.position = this.position === null ? 0 : (this.position + 1) % this.pistes.length
    return this.enCours()
  }

  /** La précédente ; depuis l'arrêt, la dernière de l'ordre. */
  precedent(): PisteEcoute | null {
    if (this.pistes.length === 0) return null
    const n = this.pistes.length
    this.position = this.position === null ? n - 1 : (this.position + n - 1) % n
    return this.enCours()
  }

  stop(): void {
    this.position = null
  }
}
