// LE LECTEUR — la musique de l'accueil, et le mini-lecteur qui la pilote.
//
// Le concepteur génère des lits par lots et doit se faire une oreille :
// entendre chaque piste telle que le jeu la jouera (la boucle taillée par
// tools/audio/prepare.py, pas le master), en passer une, revenir à la
// précédente, s'arrêter — et noter celle qui joue. Le lecteur ne se pose
// donc pas PAR-DESSUS la musique de l'accueil : il EST la musique de
// l'accueil. À l'ouverture du jeu, une piste est tirée au sort et chargée ;
// c'est elle que l'accueil joue (dès que le son est permis), c'est elle que
// le lecteur affiche, c'est elle qu'on note. Ce module ne connaît que la
// liste, l'ordre et la position ; la lecture est l'affaire de
// Soundtrack.litAccueil().
//
// L'ordre est TIRÉ AU SORT à la création — chaque ouverture propose les
// pistes dans un ordre neuf, pour ne pas toujours juger la même en premier
// — puis il est FIXE : « précédent » rend bien la piste qu'on vient
// d'entendre, et un tour complet passe par toutes sans en répéter une.

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
  /** la piste CHARGÉE : la première de l'ordre dès la création */
  private position = 0
  private lecture = true

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

  /** La piste chargée — celle que l'accueil joue, ou tient prête à
   * l'arrêt. Null seulement sur une liste vide. */
  enCours(): PisteEcoute | null {
    return this.pistes.length === 0 ? null : this.pistes[this.ordre[this.position]]
  }

  /** La piste chargée JOUE-t-elle ? Faux après « arrêt ». */
  get enLecture(): boolean {
    return this.pistes.length > 0 && this.lecture
  }

  /** Le rang affiché (« 3 / 11 »), 0 sur une liste vide. */
  rang(): number {
    return this.pistes.length === 0 ? 0 : this.position + 1
  }

  get total(): number {
    return this.pistes.length
  }

  /** La suivante dans l'ordre tiré, et elle joue ; après la dernière, on
   * reboucle. */
  suivant(): PisteEcoute | null {
    if (this.pistes.length === 0) return null
    this.position = (this.position + 1) % this.pistes.length
    this.lecture = true
    return this.enCours()
  }

  /** La précédente, et elle joue ; en tête, on reboucle sur la dernière. */
  precedent(): PisteEcoute | null {
    if (this.pistes.length === 0) return null
    const n = this.pistes.length
    this.position = (this.position + n - 1) % n
    this.lecture = true
    return this.enCours()
  }

  /** Lecture : la piste chargée repart (depuis l'arrêt) ; en cours, rien. */
  joue(): PisteEcoute | null {
    this.lecture = true
    return this.enCours()
  }

  /** Arrêt : l'accueil se tait, la piste reste chargée — on peut encore la
   * noter, et « lecture » la fait repartir. */
  stop(): void {
    this.lecture = false
  }
}
