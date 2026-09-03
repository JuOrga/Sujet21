// LES GESTES DE L'ÉDITEUR DE CARTE — purs, sans DOM, donc testés.
//
// L'éditeur (editeurCarte.ts) ne fait que traduire des événements de
// pointeur et de clavier en appels d'ici : glisser un module, le
// redimensionner par une poignée, tracer une coursive d'un module à un
// autre, renommer un identifiant (et tout ce qui le cite suit), supprimer
// (et les coursives orphelines partent avec). Chaque geste modifie la carte
// EN PLACE ; c'est l'historique qui garde les copies — une par geste, et
// pas une par image de glissement.

import {
  cloneCarte,
  moduleParId,
  type CarteStation,
  type LienCarte,
  type ModuleCarte,
} from '../game/carteStation'

/** La taille au-dessous de laquelle un module ne se lit plus. */
export const MODULE_MIN = 32

/** Arrondit au pas de la grille — 0 ou moins : à l'unité. */
export function aimante(v: number, pas: number): number {
  if (!(pas > 0)) return Math.round(v)
  return Math.round(v / pas) * pas
}

/** Déplace le CENTRE d'un module, aimanté, retenu dans la scène. */
export function deplaceModule(c: CarteStation, id: string, x: number, y: number, pas: number): boolean {
  const m = moduleParId(c, id)
  if (!m) return false
  m.x = Math.max(0, Math.min(c.scene.width, aimante(x, pas)))
  m.y = Math.max(0, Math.min(c.scene.height, aimante(y, pas)))
  return true
}

export type Poignee = 'nw' | 'ne' | 'sw' | 'se'

/** Redimensionne depuis une poignée de coin : le coin OPPOSÉ ne bouge pas,
 *  le coin tenu suit le pointeur (aimanté). `origine` est la boîte au début
 *  du geste — on recalcule toujours depuis elle, pour que l'aimant ne
 *  dérive pas image après image. */
export function redimensionneModule(
  c: CarteStation,
  id: string,
  poignee: Poignee,
  origine: { x: number; y: number; w: number; h: number },
  dx: number,
  dy: number,
  pas: number,
): boolean {
  const m = moduleParId(c, id)
  if (!m) return false
  let l = origine.x - origine.w / 2
  let t = origine.y - origine.h / 2
  let r = origine.x + origine.w / 2
  let b = origine.y + origine.h / 2
  if (poignee === 'nw' || poignee === 'sw') l = Math.min(aimante(l + dx, pas), r - MODULE_MIN)
  else r = Math.max(aimante(r + dx, pas), l + MODULE_MIN)
  if (poignee === 'nw' || poignee === 'ne') t = Math.min(aimante(t + dy, pas), b - MODULE_MIN)
  else b = Math.max(aimante(b + dy, pas), t + MODULE_MIN)
  m.w = r - l
  m.h = b - t
  m.x = (l + r) / 2
  m.y = (t + b) / 2
  return true
}

/** Un identifiant que personne ne porte : « M1 », « M2 »… ou base-2, base-3. */
export function identifiantLibre(c: CarteStation, base = 'M'): string {
  const pris = new Set(c.modules.map((m) => m.id))
  if (base !== 'M' && !pris.has(base)) return base
  for (let n = 1; ; n++) {
    const id = base === 'M' ? `M${n}` : `${base}-${n + 1}`
    if (!pris.has(id)) return id
  }
}

/** Ajoute un module au point donné. Il prend la zone du module le plus
 *  proche — on ajoute presque toujours à côté de quelque chose. */
export function ajouteModule(c: CarteStation, x: number, y: number, pas: number): ModuleCarte {
  let zone = c.zones[0]?.id ?? 0
  let meilleur = Infinity
  for (const m of c.modules) {
    const d = Math.hypot(m.x - x, m.y - y)
    if (d < meilleur) {
      meilleur = d
      zone = m.zone
    }
  }
  const m: ModuleCarte = {
    id: identifiantLibre(c),
    nom: 'MODULE ?',
    type: 'combat',
    zone,
    x: aimante(x, pas),
    y: aimante(y, pas),
    w: 100,
    h: 100,
    temp: 20,
    forme: 'octogone',
    niveaux: 3,
    biome: '',
    desc: 'À définir.',
  }
  c.modules.push(m)
  return m
}

/** Supprime un module ET les coursives qui le touchent. Le décor ancré et
 *  les règles qui le citent restent : la vérification le dira. */
export function supprimeModule(c: CarteStation, id: string): boolean {
  const i = c.modules.findIndex((m) => m.id === id)
  if (i < 0) return false
  c.modules.splice(i, 1)
  c.liens = c.liens.filter((l) => l.de !== id && l.vers !== id)
  return true
}

/** Renomme un identifiant partout où il est cité. Rend le défaut, ou null. */
export function renommeModule(c: CarteStation, ancien: string, nouveau: string): string | null {
  const id = nouveau.trim()
  if (id === '') return 'l’identifiant ne peut pas être vide'
  if (id === ancien) return null
  if (!/^[\w-]+$/.test(id)) return 'un identifiant ne contient que lettres, chiffres, _ et -'
  if (moduleParId(c, id)) return `« ${id} » est déjà pris`
  const m = moduleParId(c, ancien)
  if (!m) return `« ${ancien} » n’existe pas`
  m.id = id
  for (const l of c.liens) {
    if (l.de === ancien) l.de = id
    if (l.vers === ancien) l.vers = id
  }
  for (const d of c.decor) if (d.ancrage === ancien) d.ancrage = id
  if (c.regles.depart === ancien) c.regles.depart = id
  if (c.regles.objectif === ancien) c.regles.objectif = id
  return null
}

/** Trace une coursive. Refuse un module relié à lui-même, un doublon (même
 *  départ, même arrivée) et un bout inconnu. Rend l'index, ou -1. */
export function ajouteLien(c: CarteStation, de: string, vers: string, type: string): number {
  if (de === vers) return -1
  if (!moduleParId(c, de) || !moduleParId(c, vers)) return -1
  if (c.liens.some((l) => l.de === de && l.vers === vers)) return -1
  if (!c.typesLiens[type]) return -1
  c.liens.push({ de, vers, type })
  return c.liens.length - 1
}

export function supprimeLien(c: CarteStation, i: number): boolean {
  if (i < 0 || i >= c.liens.length) return false
  c.liens.splice(i, 1)
  return true
}

/** Retourne le sens d'une coursive — sauf si l'inverse existe déjà. */
export function inverseLien(c: CarteStation, i: number): boolean {
  const l = c.liens[i]
  if (!l) return false
  if (c.liens.some((o, j) => j !== i && o.de === l.vers && o.vers === l.de)) return false
  const de = l.de
  l.de = l.vers
  l.vers = de
  return true
}

export function modifieLien(c: CarteStation, i: number, patch: Partial<LienCarte>): boolean {
  const l = c.liens[i]
  if (!l) return false
  const de = patch.de ?? l.de
  const vers = patch.vers ?? l.vers
  const type = patch.type ?? l.type
  if (de === vers || !moduleParId(c, de) || !moduleParId(c, vers) || !c.typesLiens[type]) return false
  if (c.liens.some((o, j) => j !== i && o.de === de && o.vers === vers)) return false
  l.de = de
  l.vers = vers
  l.type = type
  return true
}

/** POSE UN CHAMP PAR SON CHEMIN — « modules.3.temp », « zones.1.couleur »,
 *  « typesLiens.glace.condition », « regles.depart ». Le formulaire de
 *  l'éditeur est ainsi GÉNÉRIQUE : un champ, un chemin, et c'est tout. Le
 *  type suit la valeur en place : un nombre reste un nombre (une saisie
 *  qui n'en est pas un est refusée), une chaîne vide dans `condition`
 *  redevient null (passage libre). Rend false si le chemin n'existe pas
 *  ou si la valeur est irrecevable. */
export function poseChamp(c: CarteStation, chemin: string, texte: string): boolean {
  const parts = chemin.split('.')
  let o: unknown = c
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof o !== 'object' || o === null) return false
    o = (o as Record<string, unknown>)[parts[i]]
  }
  if (typeof o !== 'object' || o === null) return false
  const cle = parts[parts.length - 1]
  const cible = o as Record<string, unknown>
  if (!(cle in cible)) return false
  const actuel = cible[cle]
  if (typeof actuel === 'number') {
    const v = Number(texte)
    if (texte.trim() === '' || !Number.isFinite(v)) return false
    cible[cle] = v
    return true
  }
  if (actuel === null || (cle === 'condition' && typeof actuel === 'string')) {
    cible[cle] = texte.trim() === '' ? null : texte.trim()
    return true
  }
  if (typeof actuel === 'string') {
    cible[cle] = texte
    return true
  }
  return false
}

/** L'HISTORIQUE : une copie par geste, dans les deux sens. */
export class Historique {
  private passe: CarteStation[] = []
  private futur: CarteStation[] = []
  constructor(private limite = 100) {}

  /** À appeler AVANT de modifier : garde l'état d'avant le geste. */
  pousse(c: CarteStation): void {
    this.passe.push(cloneCarte(c))
    if (this.passe.length > this.limite) this.passe.shift()
    this.futur = []
  }

  annule(courant: CarteStation): CarteStation | null {
    const avant = this.passe.pop()
    if (!avant) return null
    this.futur.push(cloneCarte(courant))
    return avant
  }

  retablit(courant: CarteStation): CarteStation | null {
    const apres = this.futur.pop()
    if (!apres) return null
    this.passe.push(cloneCarte(courant))
    return apres
  }

  get peutAnnuler(): boolean {
    return this.passe.length > 0
  }
  get peutRetablir(): boolean {
    return this.futur.length > 0
  }
  vide(): void {
    this.passe = []
    this.futur = []
  }
}
