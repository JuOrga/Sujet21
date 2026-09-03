// LA CARTE DE LA STATION : le modèle de données du plan à routes RAMIFIÉES.
//
// Le document fonctionnel le demande au §9 (« ramification à la Dead
// Cells : plusieurs sorties par tableau, menant à des modules différents »)
// et le README l'avouait comme non fait : la descente se lisait en
// profondeur, il n'y avait pas d'écran de carte. Le plan linéaire de
// station.ts (six modules sur une poutre) reste en place ; ce fichier-ci
// porte la carte DESSINÉE par le concepteur — onze modules, douze
// coursives, quatre zones, des conditions d'accès selon l'état du joueur.
//
// LA SOURCE DE VÉRITÉ EST UN FICHIER JSON (carteStation.json), pas du
// code : c'est ce que l'éditeur de carte exporte et importe, et c'est ce
// que le concepteur remplace pour faire évoluer la carte sans toucher au
// TypeScript. Rien de la carte n'est écrit en dur ici — ni les couleurs,
// ni les positions, ni les règles d'accès. Ce fichier ne fait que LIRE
// (parse + vérification), SÉRIALISER (le même JSON, dans le même ordre de
// clés, pour que les diffs restent lisibles) et répondre aux questions
// PURES que le dessin et le jeu se posent : où passe une coursive, quel
// module est atteignable, quelle couleur pour cette température.
//
// Tout ici est pur : aucun DOM, aucun état — testable sans navigateur.

import brut from './carteStation.json'
import { ETATS_CYCLE, TRANSFOS_CYCLE } from './cycle'

/** LES ORBES D'ESSENCE DE CONSCIENCE. Chaque orbe est UNE transformation ou
 *  UN état du cycle des mémoires (décision du concepteur, 03/09) : on les
 *  achète au marchand du hub contre de la mémoire, ou on les trouve en run,
 *  et l'écran des mémoires les dépense pour tisser. Une coursive
 *  conditionnée s'ouvre quand l'orbe est ACQUIS — un acquis durable, pas
 *  l'état du corps à l'instant : la carte se lit comme une progression, pas
 *  comme un guichet où l'on se transformerait devant la porte. */
export interface Orbe {
  id: string
  nom: string
}
export const ORBES: readonly Orbe[] = [
  ...TRANSFOS_CYCLE.map((t) => ({
    id: t.id,
    nom: t.etat === 'mystere' ? `${t.de} → ${t.vers} (???)` : t.nom.toLowerCase(),
  })),
  ...(Object.keys(ETATS_CYCLE) as (keyof typeof ETATS_CYCLE)[]).map((id) => ({
    id,
    nom: `état ${ETATS_CYCLE[id].nom.toLowerCase()}`,
  })),
]
export function orbeConnu(id: string): boolean {
  return ORBES.some((o) => o.id === id)
}

/** Une zone (secteur) de la station : un code, un nom, une teinte. */
export interface ZoneCarte {
  id: number
  code: string
  nom: string
  couleur: string
}

/** Les six natures de module — les clés de `types`, qui donne leurs libellés. */
export type TypeModule = 'sas' | 'jonction' | 'combat' | 'enigme' | 'coffre' | 'boss'
export const TYPES_MODULE: readonly TypeModule[] = [
  'sas',
  'jonction',
  'combat',
  'enigme',
  'coffre',
  'boss',
]

/** La silhouette dessinée : octogone (le fût), rond (le nœud), dôme (le terminal). */
export type FormeModule = 'octogone' | 'rond' | 'octogone-dome'
export const FORMES_MODULE: readonly FormeModule[] = ['octogone', 'rond', 'octogone-dome']

export interface ModuleCarte {
  id: string
  nom: string
  type: TypeModule
  zone: number
  /** le CENTRE du module, dans le repère de la scène */
  x: number
  y: number
  w: number
  h: number
  /** la température du module, en °C — colorée par `regles.temperatureCouleur` */
  temp: number
  forme: FormeModule
  /** UN MODULE EST UN BIOME : le nombre de salles qu'on y joue avant que la
   *  carte ne s'ouvre à nouveau. 0 : un lieu sans salle (le hub, un nœud). */
  niveaux: number
  /** le code du biome dans la nomenclature atelier — la pioche ne tirera
   *  que des tableaux qui le portent. Vide : à définir. */
  biome: string
  desc: string
}

/** Une coursive, ORIENTÉE : le joueur avance de `de` vers `vers`. */
export interface LienCarte {
  de: string
  vers: string
  /** une clé de `typesLiens` */
  type: string
}

/** Le style et la règle d'accès d'un type de coursive. */
export interface StyleLien {
  couleur: string
  epaisseur: number
  /** la largeur de la paroi de coque, la coursive dessinée en trois traits */
  coque: number
  tirets?: string
  /** null : passage libre ; sinon « orbe == solidification » (un id d'ORBES) */
  condition: string | null
  badge?: string
}

/** Un élément de décor, ancré à un module — non jouable. */
export interface DecorCarte {
  id: string
  type: string
  ancrage: string
  x?: number
  y?: number
  rotation?: number
  exterieur?: string
  interieur?: string
  tube?: string
}

export interface PaletteCarte {
  fond: string
  plaque: string
  plaqueSombre: string
  bord: string
  couloirParoi: string
  couloirSol: string
  couloirAnneau: string
  texte: string
  texteSecondaire: string
  chaud: string
  dome: string[]
}

export interface ReglesCarte {
  depart: string
  objectif: string
  /** la règle des coursives du hub, en français — la fonction traceLien l'applique */
  couloirHub: string
  /** l'échelle de couleur, par seuils : « <=0 », « <30 », « <60 », « sinon » */
  temperatureCouleur: Record<string, string>
}

export interface CarteStation {
  scene: { width: number; height: number }
  zones: ZoneCarte[]
  types: Record<TypeModule, string>
  modules: ModuleCarte[]
  liens: LienCarte[]
  typesLiens: Record<string, StyleLien>
  decor: DecorCarte[]
  palette: PaletteCarte
  regles: ReglesCarte
}

// ---- LECTURE -------------------------------------------------------------

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const estChaine = (v: unknown): v is string => typeof v === 'string'

/** Lit une carte depuis un JSON quelconque. Rend la carte ET la liste des
 *  défauts de FORME (un champ manquant, un type faux) : la carte n'est
 *  rendue que si la forme est entière. Les défauts de FOND (un lien vers un
 *  module inconnu, un module inatteignable) sont l'affaire de verifieCarte :
 *  on peut vouloir ouvrir une carte bancale pour la réparer. */
export function parseCarte(entree: unknown): {
  carte: CarteStation | null
  erreurs: string[]
} {
  const erreurs: string[] = []
  if (!estObjet(entree)) return { carte: null, erreurs: ['la carte n’est pas un objet JSON'] }
  const o = entree

  const scene = estObjet(o.scene) ? o.scene : {}
  if (!estNombre(scene.width) || !estNombre(scene.height) || scene.width <= 0 || scene.height <= 0)
    erreurs.push('scene.width et scene.height doivent être des nombres positifs')

  const zones: ZoneCarte[] = []
  if (!Array.isArray(o.zones)) erreurs.push('zones doit être une liste')
  else
    o.zones.forEach((z, i) => {
      if (!estObjet(z) || !estNombre(z.id) || !estChaine(z.code) || !estChaine(z.nom) || !estChaine(z.couleur))
        erreurs.push(`zones[${i}] : id (nombre), code, nom et couleur sont requis`)
      else zones.push({ id: z.id, code: z.code, nom: z.nom, couleur: z.couleur })
    })

  const types = {} as Record<TypeModule, string>
  if (!estObjet(o.types)) erreurs.push('types doit être un objet { sas, jonction, combat, enigme, coffre, boss }')
  else
    for (const t of TYPES_MODULE) {
      const v = o.types[t]
      if (!estChaine(v)) erreurs.push(`types.${t} manque`)
      else types[t] = v
    }

  const modules: ModuleCarte[] = []
  if (!Array.isArray(o.modules)) erreurs.push('modules doit être une liste')
  else
    o.modules.forEach((m, i) => {
      if (!estObjet(m)) return erreurs.push(`modules[${i}] n’est pas un objet`)
      const ou = `modules[${i}]${estChaine(m.id) ? ` (${m.id})` : ''}`
      if (!estChaine(m.id) || m.id.trim() === '') erreurs.push(`${ou} : id requis`)
      if (!estChaine(m.nom)) erreurs.push(`${ou} : nom requis`)
      if (!TYPES_MODULE.includes(m.type as TypeModule)) erreurs.push(`${ou} : type inconnu « ${String(m.type)} »`)
      if (!estNombre(m.zone)) erreurs.push(`${ou} : zone (nombre) requise`)
      for (const k of ['x', 'y', 'w', 'h', 'temp', 'niveaux'] as const)
        if (!estNombre(m[k])) erreurs.push(`${ou} : ${k} (nombre) requis`)
      if (!FORMES_MODULE.includes(m.forme as FormeModule)) erreurs.push(`${ou} : forme inconnue « ${String(m.forme)} »`)
      if (erreurs.some((e) => e.startsWith(ou))) return
      modules.push({
        id: (m.id as string).trim(),
        nom: m.nom as string,
        type: m.type as TypeModule,
        zone: m.zone as number,
        x: m.x as number,
        y: m.y as number,
        w: m.w as number,
        h: m.h as number,
        temp: m.temp as number,
        forme: m.forme as FormeModule,
        niveaux: m.niveaux as number,
        biome: estChaine(m.biome) ? m.biome.trim() : '',
        desc: estChaine(m.desc) ? m.desc : '',
      })
    })

  const liens: LienCarte[] = []
  if (!Array.isArray(o.liens)) erreurs.push('liens doit être une liste')
  else
    o.liens.forEach((l, i) => {
      if (!estObjet(l) || !estChaine(l.de) || !estChaine(l.vers) || !estChaine(l.type))
        erreurs.push(`liens[${i}] : de, vers et type (chaînes) sont requis`)
      else liens.push({ de: l.de, vers: l.vers, type: l.type })
    })

  const typesLiens: Record<string, StyleLien> = {}
  if (!estObjet(o.typesLiens)) erreurs.push('typesLiens doit être un objet')
  else
    for (const [k, s] of Object.entries(o.typesLiens)) {
      if (!estObjet(s) || !estChaine(s.couleur) || !estNombre(s.epaisseur) || !estNombre(s.coque)) {
        erreurs.push(`typesLiens.${k} : couleur, epaisseur et coque sont requis`)
        continue
      }
      const st: StyleLien = {
        couleur: s.couleur,
        epaisseur: s.epaisseur,
        coque: s.coque,
        condition: estChaine(s.condition) && s.condition.trim() !== '' ? s.condition : null,
      }
      if (estChaine(s.tirets) && s.tirets !== '') st.tirets = s.tirets
      if (estChaine(s.badge) && s.badge !== '') st.badge = s.badge
      typesLiens[k] = st
    }

  const decor: DecorCarte[] = []
  if (o.decor !== undefined && !Array.isArray(o.decor)) erreurs.push('decor doit être une liste')
  else
    (Array.isArray(o.decor) ? o.decor : []).forEach((d, i) => {
      if (!estObjet(d) || !estChaine(d.id) || !estChaine(d.type) || !estChaine(d.ancrage)) {
        erreurs.push(`decor[${i}] : id, type et ancrage sont requis`)
        return
      }
      const e: DecorCarte = { id: d.id, type: d.type, ancrage: d.ancrage }
      if (estNombre(d.x)) e.x = d.x
      if (estNombre(d.y)) e.y = d.y
      if (estNombre(d.rotation)) e.rotation = d.rotation
      if (estChaine(d.exterieur)) e.exterieur = d.exterieur
      if (estChaine(d.interieur)) e.interieur = d.interieur
      if (estChaine(d.tube)) e.tube = d.tube
      decor.push(e)
    })

  const CLES_PALETTE = [
    'fond', 'plaque', 'plaqueSombre', 'bord', 'couloirParoi', 'couloirSol',
    'couloirAnneau', 'texte', 'texteSecondaire', 'chaud',
  ] as const
  const palette = {} as PaletteCarte
  if (!estObjet(o.palette)) erreurs.push('palette doit être un objet')
  else {
    for (const k of CLES_PALETTE) {
      const v = o.palette[k]
      if (!estChaine(v)) erreurs.push(`palette.${k} manque`)
      else palette[k] = v
    }
    const dome = o.palette.dome
    if (!Array.isArray(dome) || dome.length < 2 || !dome.every(estChaine))
      erreurs.push('palette.dome doit lister au moins deux couleurs')
    else palette.dome = [...dome]
  }

  let regles: ReglesCarte | null = null
  if (!estObjet(o.regles)) erreurs.push('regles doit être un objet')
  else {
    const r = o.regles
    if (!estChaine(r.depart)) erreurs.push('regles.depart manque')
    if (!estChaine(r.objectif)) erreurs.push('regles.objectif manque')
    const tc = estObjet(r.temperatureCouleur) ? r.temperatureCouleur : null
    if (!tc || !Object.values(tc).every(estChaine)) erreurs.push('regles.temperatureCouleur doit associer des seuils à des couleurs')
    if (estChaine(r.depart) && estChaine(r.objectif) && tc)
      regles = {
        depart: r.depart,
        objectif: r.objectif,
        couloirHub: estChaine(r.couloirHub) ? r.couloirHub : '',
        temperatureCouleur: { ...(tc as Record<string, string>) },
      }
  }

  if (erreurs.length > 0 || !regles) return { carte: null, erreurs }
  return {
    carte: {
      scene: { width: scene.width as number, height: scene.height as number },
      zones, types, modules, liens, typesLiens, decor, palette, regles,
    },
    erreurs,
  }
}

/** Le même JSON que celui qu'on lit — mêmes clés, même ordre, deux espaces,
 *  saut de ligne final : un export relu donne un diff vide. */
export function serialiseCarte(c: CarteStation): string {
  const ordonne: CarteStation = {
    scene: { width: c.scene.width, height: c.scene.height },
    zones: c.zones.map((z) => ({ id: z.id, code: z.code, nom: z.nom, couleur: z.couleur })),
    types: Object.fromEntries(TYPES_MODULE.map((t) => [t, c.types[t]])) as Record<TypeModule, string>,
    modules: c.modules.map((m) => ({
      id: m.id, nom: m.nom, type: m.type, zone: m.zone, x: m.x, y: m.y, w: m.w, h: m.h,
      temp: m.temp, forme: m.forme, niveaux: m.niveaux, biome: m.biome, desc: m.desc,
    })),
    liens: c.liens.map((l) => ({ de: l.de, vers: l.vers, type: l.type })),
    typesLiens: Object.fromEntries(
      Object.entries(c.typesLiens).map(([k, s]) => {
        const o: Record<string, unknown> = { couleur: s.couleur, epaisseur: s.epaisseur, coque: s.coque }
        if (s.tirets) o.tirets = s.tirets
        o.condition = s.condition
        if (s.badge) o.badge = s.badge
        return [k, o as unknown as StyleLien]
      }),
    ),
    decor: c.decor.map((d) => ({ ...d })),
    palette: { ...c.palette, dome: [...c.palette.dome] },
    regles: {
      depart: c.regles.depart,
      objectif: c.regles.objectif,
      couloirHub: c.regles.couloirHub,
      temperatureCouleur: { ...c.regles.temperatureCouleur },
    },
  }
  return JSON.stringify(ordonne, null, 2) + '\n'
}

/** Une copie profonde — l'historique de l'éditeur en garde une par geste. */
export function cloneCarte(c: CarteStation): CarteStation {
  return JSON.parse(JSON.stringify(c)) as CarteStation
}

// ---- LA CARTE LIVRÉE -------------------------------------------------------

const lecture = parseCarte(brut)
if (!lecture.carte)
  throw new Error(`carteStation.json est invalide :\n${lecture.erreurs.join('\n')}`)
/** La carte livrée avec le jeu — celle du fichier JSON, vérifiée au chargement. */
export const CARTE_LIVREE: CarteStation = lecture.carte

// ---- LES QUESTIONS PURES ---------------------------------------------------

export function moduleParId(c: CarteStation, id: string): ModuleCarte | undefined {
  return c.modules.find((m) => m.id === id)
}

export function zoneDe(c: CarteStation, m: ModuleCarte): ZoneCarte | undefined {
  return c.zones.find((z) => z.id === m.zone)
}

/** LA GÉOMÉTRIE D'UNE COURSIVE. La règle du hub (regles.couloirHub) dit :
 *  « un lien partant du HUB sort à y = clamp(cible.y, HUB.y−110, HUB.y+110)
 *  puis va en ligne droite vers la cible ». Le 110 n'est pas un nombre
 *  magique : c'est h/2 − 36 pour un hub de 292 de haut — la coursive sort
 *  du flanc du fût, à au moins 36 unités du coin. La règle s'applique donc
 *  à tout module PLUS HAUT QUE LARGE, à chaque bout : un second hub ajouté
 *  par le concepteur se comportera comme le premier sans qu'on y touche. */
export function traceLien(
  c: CarteStation,
  l: LienCarte,
): { x1: number; y1: number; x2: number; y2: number; d: string } | null {
  const p = moduleParId(c, l.de)
  const q = moduleParId(c, l.vers)
  if (!p || !q) return null
  const sortie = (m: ModuleCarte, cible: ModuleCarte): number => {
    if (m.h <= m.w) return m.y
    const marge = Math.max(0, m.h / 2 - 36)
    return Math.max(m.y - marge, Math.min(m.y + marge, cible.y))
  }
  const y1 = sortie(p, q)
  const y2 = sortie(q, p)
  return { x1: p.x, y1, x2: q.x, y2, d: `M${p.x} ${y1} L${q.x} ${y2}` }
}

/** Les coursives qui PARTENT d'un module : ce que le joueur peut viser. */
export function liensDepuis(c: CarteStation, id: string): LienCarte[] {
  return c.liens.filter((l) => l.de === id)
}

/** La condition d'un type de lien, lue : « orbe == solidification » demande
 *  l'orbe de la solidification. Une condition qu'on ne sait pas lire est
 *  traitée comme FERMÉE, et dite telle quelle — mieux vaut une porte close
 *  qu'une porte qui s'ouvre parce qu'on n'a pas compris la consigne. */
export function litCondition(condition: string | null): { orbe: string } | null {
  if (!condition) return null
  const m = /^\s*orbe\s*==\s*['"]?([\w-]+)['"]?\s*$/.exec(condition)
  return { orbe: m ? m[1] : `?${condition}` }
}

/** Le lien est-il franchissable avec ces orbes acquis ? Rend null si oui,
 *  sinon l'orbe qui manque. */
export function orbeRequis(
  c: CarteStation,
  l: LienCarte,
  orbes: ReadonlySet<string> | readonly string[],
): string | null {
  const style = c.typesLiens[l.type]
  if (!style) return null
  const cond = litCondition(style.condition)
  if (!cond) return null
  const acquis = orbes instanceof Set ? orbes.has(cond.orbe) : (orbes as readonly string[]).includes(cond.orbe)
  return acquis ? null : cond.orbe
}

/** La couleur d'une température, par seuils. Les clés sont lues dans
 *  l'ORDRE du JSON : « <=0 », « <30 », « <60 », puis « sinon ». */
export function couleurTemperature(c: CarteStation, temp: number): string {
  let sinon = c.palette.chaud
  for (const [cle, couleur] of Object.entries(c.regles.temperatureCouleur)) {
    const m = /^\s*(<=|<|>=|>)\s*(-?\d+(?:\.\d+)?)\s*$/.exec(cle)
    if (!m) {
      if (cle.trim() === 'sinon') sinon = couleur
      continue
    }
    const v = Number(m[2])
    const ok =
      m[1] === '<=' ? temp <= v : m[1] === '<' ? temp < v : m[1] === '>=' ? temp >= v : temp > v
    if (ok) return couleur
  }
  return sinon
}

/** Les modules atteignables depuis `depart` en suivant les coursives dans
 *  leur sens, quel que soit l'état (les conditions ne sont pas des murs :
 *  le joueur peut changer d'état). */
export function accessibles(c: CarteStation, depart: string): Set<string> {
  const vus = new Set<string>()
  const pile = [depart]
  while (pile.length) {
    const id = pile.pop()!
    if (vus.has(id)) continue
    vus.add(id)
    for (const l of liensDepuis(c, id)) if (!vus.has(l.vers)) pile.push(l.vers)
  }
  return vus
}

/** LE TRAJET EN NIVEAUX : combien de salles séparent le départ de
 *  l'objectif, au plus court et au plus long, en suivant les coursives dans
 *  leur sens (la longueur d'une run n'est plus un réglage : elle découle de
 *  la carte). Null : l'objectif est inatteignable. Les chemins simples
 *  s'énumèrent — la carte a une dizaine de modules, pas mille. */
export function longueursTrajet(c: CarteStation): { min: number; max: number } | null {
  const niv = new Map(c.modules.map((m) => [m.id, Math.max(0, m.niveaux)]))
  if (!niv.has(c.regles.depart) || !niv.has(c.regles.objectif)) return null
  let min = Infinity
  let max = -Infinity
  let budget = 20000 // au-delà, la carte est un plat de nouilles : on s'arrête
  const marche = (id: string, total: number, vus: Set<string>): void => {
    if (budget-- <= 0) return
    const t = total + (niv.get(id) ?? 0)
    if (id === c.regles.objectif) {
      min = Math.min(min, t)
      max = Math.max(max, t)
      return
    }
    for (const l of liensDepuis(c, id)) {
      if (vus.has(l.vers) || !niv.has(l.vers)) continue
      vus.add(l.vers)
      marche(l.vers, t, vus)
      vus.delete(l.vers)
    }
  }
  marche(c.regles.depart, 0, new Set([c.regles.depart]))
  return Number.isFinite(min) ? { min, max } : null
}

/** LE PLUS COURT CHEMIN EN NIVEAUX d'un module à un autre, en suivant les
 *  coursives dans leur sens — les niveaux du module de DÉPART ne comptent
 *  pas (on y est déjà), ceux de l'arrivée si. Null : inatteignable. C'est
 *  ce qui reste à jouer, au mieux, depuis là où l'on est. */
export function plusCourtVers(c: CarteStation, de: string, vers: string): number | null {
  const niv = new Map(c.modules.map((m) => [m.id, Math.max(0, m.niveaux)]))
  if (!niv.has(de) || !niv.has(vers)) return null
  if (de === vers) return 0
  // Dijkstra sur une dizaine de sommets : la file est une liste triée
  const dist = new Map<string, number>([[de, 0]])
  const file: string[] = [de]
  const clos = new Set<string>()
  while (file.length) {
    file.sort((a, b) => (dist.get(a) ?? 0) - (dist.get(b) ?? 0))
    const id = file.shift()!
    if (clos.has(id)) continue
    clos.add(id)
    if (id === vers) return dist.get(id) ?? null
    for (const l of liensDepuis(c, id)) {
      if (!niv.has(l.vers)) continue
      const d = (dist.get(id) ?? 0) + (niv.get(l.vers) ?? 0)
      if (d < (dist.get(l.vers) ?? Infinity)) {
        dist.set(l.vers, d)
        file.push(l.vers)
      }
    }
  }
  return null
}

// ---- LA VÉRIFICATION DE FOND ----------------------------------------------

export interface VerdictCarte {
  niveau: 'erreur' | 'attention'
  message: string
  /** l'élément en cause, pour que l'éditeur le montre */
  module?: string
  lien?: number
}

/** Ce qui rend une carte injouable (erreur) ou douteuse (attention). */
export function verifieCarte(c: CarteStation): VerdictCarte[] {
  const v: VerdictCarte[] = []
  const ids = new Map<string, number>()
  for (const m of c.modules) ids.set(m.id, (ids.get(m.id) ?? 0) + 1)
  for (const [id, n] of ids)
    if (n > 1) v.push({ niveau: 'erreur', message: `l’identifiant « ${id} » est porté par ${n} modules`, module: id })

  for (const m of c.modules) {
    if (!zoneDe(c, m)) v.push({ niveau: 'erreur', message: `${m.id} : zone ${m.zone} inconnue`, module: m.id })
    if (m.w < 24 || m.h < 24) v.push({ niveau: 'attention', message: `${m.id} : module trop petit pour être lu (${m.w}×${m.h})`, module: m.id })
    if (!Number.isInteger(m.niveaux) || m.niveaux < 0)
      v.push({ niveau: 'erreur', message: `${m.id} : niveaux doit être un entier positif ou nul (${m.niveaux})`, module: m.id })
    if (m.niveaux > 0 && m.biome.trim() === '')
      v.push({ niveau: 'attention', message: `${m.id} : ${m.niveaux} niveau${m.niveaux > 1 ? 'x' : ''} sans code de biome — la pioche ne saura pas quels tableaux lui donner`, module: m.id })
    if (m.x - m.w / 2 < 0 || m.y - m.h / 2 < 0 || m.x + m.w / 2 > c.scene.width || m.y + m.h / 2 > c.scene.height)
      v.push({ niveau: 'attention', message: `${m.id} déborde de la scène`, module: m.id })
  }
  for (let i = 0; i < c.modules.length; i++)
    for (let j = i + 1; j < c.modules.length; j++) {
      const a = c.modules[i]
      const b = c.modules[j]
      if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2)
        v.push({ niveau: 'attention', message: `${a.id} et ${b.id} se chevauchent`, module: b.id })
    }

  c.liens.forEach((l, i) => {
    if (!ids.has(l.de)) v.push({ niveau: 'erreur', message: `lien ${i + 1} : module de départ « ${l.de} » inconnu`, lien: i })
    if (!ids.has(l.vers)) v.push({ niveau: 'erreur', message: `lien ${i + 1} : module d’arrivée « ${l.vers} » inconnu`, lien: i })
    if (l.de === l.vers) v.push({ niveau: 'erreur', message: `lien ${i + 1} : ${l.de} est relié à lui-même`, lien: i })
    if (!c.typesLiens[l.type]) v.push({ niveau: 'erreur', message: `lien ${i + 1} : type « ${l.type} » inconnu`, lien: i })
    const double = c.liens.findIndex((o, j) => j < i && o.de === l.de && o.vers === l.vers)
    if (double >= 0) v.push({ niveau: 'attention', message: `lien ${i + 1} double le lien ${double + 1} (${l.de} → ${l.vers})`, lien: i })
  })
  for (const [k, s] of Object.entries(c.typesLiens)) {
    const cond = litCondition(s.condition)
    if (cond && (cond.orbe.startsWith('?') || !orbeConnu(cond.orbe)))
      v.push({ niveau: 'erreur', message: `typesLiens.${k} : condition illisible ou orbe inconnu « ${s.condition} » — attendu « orbe == <id> », ids : ${ORBES.map((o) => o.id).join(', ')}` })
  }

  if (!ids.has(c.regles.depart))
    v.push({ niveau: 'erreur', message: `le départ « ${c.regles.depart} » n’est pas un module` })
  if (!ids.has(c.regles.objectif))
    v.push({ niveau: 'erreur', message: `l’objectif « ${c.regles.objectif} » n’est pas un module` })

  if (ids.has(c.regles.depart)) {
    const vus = accessibles(c, c.regles.depart)
    if (ids.has(c.regles.objectif) && !vus.has(c.regles.objectif))
      v.push({ niveau: 'erreur', message: `l’objectif ${c.regles.objectif} est inatteignable depuis ${c.regles.depart}` })
    for (const m of c.modules)
      if (!vus.has(m.id)) v.push({ niveau: 'attention', message: `${m.id} n’est atteignable par aucune route depuis ${c.regles.depart}`, module: m.id })
  }
  for (const d of c.decor)
    if (!ids.has(d.ancrage)) v.push({ niveau: 'attention', message: `décor ${d.id} : ancrage « ${d.ancrage} » inconnu` })
  return v
}
