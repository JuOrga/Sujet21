// LE FEU DE LA CÉRÉMONIE — des particules, et rien que leur mouvement.
//
// Chaque grand instant de la fin de salle jette des éclats : le rang qui
// tombe, le record tamponné, le palier franchi, la carte élue, la porte
// choisie. Le canvas qui les dessine est dans main.ts ; ce qui se SIMULE
// (naissance, gravité, frottement, mort, plafond) est ici, sans DOM ni
// horloge — mêmes entrées, mêmes sorties. C'est ce qui permet de garantir
// qu'une rafale ne vit jamais plus longtemps que prévu et que mille
// touchers n'amassent pas dix mille particules.

export type Forme = 'eclat' | 'confetti' | 'etincelle'

export interface Particule {
  x: number
  y: number
  vx: number
  vy: number
  /** l'âge, en secondes */
  age: number
  /** la durée de vie totale, en secondes */
  duree: number
  taille: number
  teinte: string
  forme: Forme
  rot: number
  vrot: number
  /** la gravité, propre à la rafale : les confettis tombent, les
   *  étincelles d'un palier flottent */
  gravite: number
}

export interface Rafale {
  /** combien de particules jaillissent */
  n: number
  /** les teintes tirées au sort, une par particule */
  teintes: string[]
  /** la vitesse initiale, en pixels par seconde (moyenne) */
  vitesse: number
  /** la gravité, en pixels par seconde carrée (0 : les éclats flottent) */
  gravite?: number
  /** la forme de la rafale (défaut : éclats) */
  forme?: Forme
  /** la durée de vie moyenne, en secondes */
  duree?: number
  /** la taille moyenne, en pixels */
  taille?: number
  /** un cône (radians autour de `angle`) plutôt qu'un anneau complet */
  cone?: { angle: number; ouverture: number }
}

/** Le nombre au-delà duquel les plus vieilles particules cèdent la place :
 *  le feu reste un ornement, il ne doit jamais coûter une image. */
export const PLAFOND_PARTICULES = 900

/** La force du frottement : la vitesse perd cette part par seconde. */
const FROTTEMENT = 2.2

export class Feu {
  readonly particules: Particule[] = []

  /** Le feu a-t-il quelque chose à dessiner ? (la boucle de rendu s'arrête
   *  sinon — le canvas ne tourne pas pour rien) */
  get vivant(): boolean {
    return this.particules.length > 0
  }

  /** Une RAFALE au point (x, y). `alea` est injecté : les tests la figent. */
  eclate(x: number, y: number, r: Rafale, alea: () => number = Math.random): void {
    const gravite = r.gravite ?? 520
    const forme = r.forme ?? 'eclat'
    const dureeMoy = r.duree ?? 0.9
    const tailleMoy = r.taille ?? 5
    for (let i = 0; i < r.n; i++) {
      const angle = r.cone
        ? r.cone.angle + (alea() - 0.5) * r.cone.ouverture
        : alea() * Math.PI * 2
      const v = r.vitesse * (0.45 + alea() * 1.1)
      this.particules.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        age: 0,
        duree: dureeMoy * (0.6 + alea() * 0.8),
        taille: tailleMoy * (0.6 + alea() * 0.9),
        teinte: r.teintes[Math.floor(alea() * r.teintes.length)] ?? '#ffffff',
        forme,
        rot: alea() * Math.PI * 2,
        vrot: (alea() - 0.5) * 12,
        gravite,
      })
    }
    // le plafond : les plus vieilles s'effacent d'abord
    if (this.particules.length > PLAFOND_PARTICULES)
      this.particules.splice(0, this.particules.length - PLAFOND_PARTICULES)
  }

  /** Un pas de simulation de `dt` secondes : les vivantes avancent, les
   *  mortes s'en vont. Un `dt` fou (onglet revenu au premier plan après une
   *  minute) est borné : le feu ne saute pas hors de l'écran, il finit. */
  pas(dt: number): void {
    const h = Math.max(0, Math.min(0.05, dt))
    const frein = Math.max(0, 1 - FROTTEMENT * h)
    let ecrit = 0
    for (let i = 0; i < this.particules.length; i++) {
      const p = this.particules[i]
      p.age += h
      if (p.age >= p.duree) continue
      p.vy += p.gravite * h
      p.vx *= frein
      p.vy *= frein
      p.x += p.vx * h
      p.y += p.vy * h
      p.rot += p.vrot * h
      this.particules[ecrit++] = p
    }
    this.particules.length = ecrit
  }

  /** Le dessin, sur un contexte 2D déjà effacé. Séparé de `pas` : on peut
   *  simuler sans dessiner (les tests), et dessiner sans avancer (pause). */
  dessine(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particules) {
      const vie = 1 - p.age / p.duree
      ctx.globalAlpha = Math.min(1, vie * 1.6)
      ctx.fillStyle = p.teinte
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      if (p.forme === 'confetti') {
        ctx.fillRect(-p.taille * 0.9, -p.taille * 0.35, p.taille * 1.8, p.taille * 0.7)
      } else if (p.forme === 'etincelle') {
        // une étincelle est un trait qui s'étire dans sa course
        const l = p.taille * 2.4
        ctx.fillRect(-l / 2, -p.taille * 0.18, l, p.taille * 0.36)
      } else {
        ctx.beginPath()
        ctx.arc(0, 0, p.taille * (0.5 + vie * 0.5), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }
    ctx.globalAlpha = 1
  }

  vide(): void {
    this.particules.length = 0
  }
}
