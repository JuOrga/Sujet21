// LE RENDU DU MULTI — deux volumes, deux couleurs, et la matière du jeu.
//
// Le moteur de rendu du jeu (render/renderer.ts) dessine UN corps, sa
// lumière, sa coque, ses décors : lui apprendre une couleur par joueur,
// c'était le modifier, et il est partagé avec le jeu solo. Le multi a donc
// son propre rendu — même principe que pour le solveur. Ce qu'on doit y
// lire d'abord, c'est QUI est QUOI.
//
// LES CORPS ONT L'HABILLAGE DU JEU. Ils ont d'abord été dessinés à plat (une
// teinte, un liseré) ; le concepteur a retenu « les graphismes du jeu » pour
// les corps (21/11). Le moteur du jeu ne se branche pas ici — 8 750 lignes
// liées à UN corps, UNE salle et ses lampes — mais sa recette, si : le bloc
// « habillage de l'eau » de son shader, en surface MIROITANT MERCURE, est
// recopié couche par couche dans FS_ECRAN (relief flouté, éclats durs,
// fresnel, étincelles, miroir d'un seul tenant, regard, gel à facettes).
// Ce qui diffère est dit sur place : la teinte est celle du joueur, et ce
// que la peau mire est le terrain du multi. Une correction faite là-bas
// n'arrive pas ici — même prix que pour le solveur.
//
// DEUX PASSES :
//  1. LE CHAMP. Chaque particule dépose une tache douce dans une texture,
//     en addition, sur le CANAL de son propriétaire (rouge = joueur 0,
//     vert = joueur 1, bleu = joueur 2, alpha = joueur 3 ou personne).
//  2. LA SURFACE. Les corps OUVERTS forment un seul groupe : leurs canaux
//     s'ajoutent, et là où la somme passe le seuil il y a de l'eau, teintée
//     au prorata — deux corps ouverts qui se touchent se fondent en un
//     dégradé, on VOIT la matière se mêler. Un corps FERMÉ, lui, est un
//     groupe à lui seul, et les groupes se DISPUTENT la place : le champ de
//     chacun est diminué de celui des autres. Entre deux corps fermés au
//     contact, aucun ne l'emporte — il reste un VIDE, et deux peaux.
//
//     La première version additionnait tous les canaux, ouverts ou non : deux
//     corps fermés collés se dessinaient d'un seul contour, en dégradé —
//     « même si on ne fait pas s'ouvrir, les corps fusionnent à moitié » (le
//     concepteur, 20/11). La physique les séparait, l'image les fondait.

import type { Cadre } from './cadrage'
import { PALETTE, teintesDeLaPartie, type Teinte } from './profil'
import { ATTR_CORPS, ATTR_ORPHELINE, ATTR_PROPRIO, type Bornes, type Particules } from './trame'

/** Une teinte (profil.ts), pour le CSS. */
export function teinteCss(c: Teinte): string {
  return `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`
}

/** La couleur d'un rang de la palette (profil.ts), pour le CSS. */
export function couleurCss(rang: number): string {
  return teinteCss(PALETTE[((rang % PALETTE.length) + PALETTE.length) % PALETTE.length])
}

/** Le rayon d'une tache, en unités monde : quatre pas de particule. Au
 *  cœur d'un corps une cinquantaine de taches se recouvrent (le champ y
 *  vaut ~14) et le bord est tenu par beaucoup de particules à la fois : il
 *  est LISSE. Essayé d'abord à 14,5 u avec un seuil de 0,6 : le contour
 *  suivait chaque particule du bord, et à l'échelle de la salle (un pas de
 *  particule ≈ 3 pixels) cela se lisait comme du bruit. */
const RAYON_TACHE = 26

/** LE STADE DU HOCKEY : une image rendue dans Blender
 *  (tools/images/blender/stade_hockey.py), et le rectangle du MONDE qu'elle
 *  couvre — un CONTRAT avec ce script : la piste y tombe pile sous la
 *  patinoire (TERRAIN, hockey.ts). Elle n'est chargée qu'à la première
 *  image d'un match de hockey : ni l'accueil du jeu, ni le salon du multi
 *  ne la paient. */
export const STADE = { url: '/assets/multi/stade-hockey.webp', minX: -560, minY: -640, largeur: 4000, hauteur: 2500 } as const
/** Le seuil du champ : dessous, le vide ; dessus, l'eau. À ~14 au cœur et
 *  ~7 sur un bord droit, 3 pose le contour juste au ras des particules. */
const SEUIL = 3
/** Une GOUTTE LIBRE pèse plus lourd dans le champ : seule, sa tache
 *  culmine à 1 et ne passerait jamais le seuil — on ne verrait ni le jet,
 *  ni ce qu'il reste à ramasser. À 4, elle se dessine en point d'environ
 *  8 u de rayon. */
const POIDS_GOUTTE = 4

/** Ce que le rendu lit d'un corps : son état (la peau, la glace) et le point
 *  qu'il vise — son regard s'y tourne. L'état d'un corps tel qu'il voyage
 *  (trame.ts) en a tout ce qu'il faut. */
export interface CorpsVu {
  ouvert: boolean
  glace?: boolean
  viseeX: number
  viseeY: number
}

/** Le nombre de canaux du champ : un par joueur. */
const CANAUX = 4
/** En dessous de ce compte, un corps n'a pas de cœur : ni miroir, ni regard
 *  (c'est le seuil sous lequel le solveur le dit perdu). */
const CORPS_MIN = 12

/** LE CŒUR DE CHAQUE CORPS, lu sur les particules qu'on dessine : (x, y,
 *  rayon, connu) par joueur, dans `sortie`. Le miroir du rendu est radial
 *  autour de lui, et le regard s'y loge. On le relit ici plutôt que dans
 *  l'état du corps : chez l'invité cet état arrive vingt fois par seconde,
 *  alors que les particules sont prolongées à chaque image — un cœur en
 *  retard sur son corps ferait glisser le reflet. Le rayon est celui du
 *  disque de même étalement (√2 fois l'écart quadratique). */
export function coeursDe(p: Particules, sortie: Float32Array): Float32Array {
  sortie.fill(0, 0, CANAUX * 4)
  const compte = [0, 0, 0, 0]
  for (let i = 0; i < p.n; i++) {
    const a = p.attr[i]
    if ((a & ATTR_CORPS) === 0 || (a & ATTR_ORPHELINE) !== 0) continue
    const j = a & ATTR_PROPRIO
    sortie[j * 4] += p.x[i]
    sortie[j * 4 + 1] += p.y[i]
    compte[j]++
  }
  for (let j = 0; j < CANAUX; j++) {
    if (compte[j] < CORPS_MIN) {
      sortie[j * 4] = 0
      sortie[j * 4 + 1] = 0
      continue
    }
    sortie[j * 4] /= compte[j]
    sortie[j * 4 + 1] /= compte[j]
    sortie[j * 4 + 3] = 1
  }
  for (let i = 0; i < p.n; i++) {
    const a = p.attr[i]
    if ((a & ATTR_CORPS) === 0 || (a & ATTR_ORPHELINE) !== 0) continue
    const j = a & ATTR_PROPRIO
    if (compte[j] < CORPS_MIN) continue
    const dx = p.x[i] - sortie[j * 4]
    const dy = p.y[i] - sortie[j * 4 + 1]
    sortie[j * 4 + 2] += dx * dx + dy * dy
  }
  for (let j = 0; j < CANAUX; j++) if (compte[j] >= CORPS_MIN) sortie[j * 4 + 2] = Math.sqrt((2 * sortie[j * 4 + 2]) / compte[j])
  return sortie
}

/** Jusqu'où le regard s'écarte du cœur, en part du rayon : au-delà il
 *  sortirait de la masse, et c'est sous la surface qu'il vit. */
export const REGARD_PORTEE = 0.42
/** La vivacité du regard (1/s) : il rejoint sa cible aux deux tiers en un
 *  dixième de seconde — assez vite pour suivre un pointeur, assez lentement
 *  pour ne pas sauter quand la visée change d'un coup. */
const REGARD_VIF = 10

/** OÙ REGARDE UN CORPS : vers le point visé, depuis son cœur, sans sortir de
 *  sa masse. `etat` tient, à partir de `k`, l'ÉCART du regard au cœur (x, y)
 *  et sa présence : c'est l'écart qu'on rapproche de sa cible du temps `dt`,
 *  pas la position — le regard suit ainsi son corps d'un bloc, un corps
 *  rapide ne le sème pas. Un corps sans cœur n'a pas de regard, et celui qui
 *  vient de naître le pose d'emblée. */
export function tourneRegard(etat: Float32Array, k: number, cx: number, cy: number, rayon: number, connu: boolean, viseeX: number, viseeY: number, dt: number): void {
  if (!connu) {
    etat[k + 2] = 0
    return
  }
  const dx = viseeX - cx
  const dy = viseeY - cy
  const d = Math.hypot(dx, dy)
  const portee = Math.min(d, REGARD_PORTEE * rayon)
  const tx = d > 1e-6 ? (dx / d) * portee : 0
  const ty = d > 1e-6 ? (dy / d) * portee : 0
  const suit = etat[k + 2] === 0 ? 1 : 1 - Math.exp(-REGARD_VIF * Math.max(0, dt))
  etat[k] += (tx - etat[k]) * suit
  etat[k + 1] += (ty - etat[k + 1]) * suit
  etat[k + 2] = 1
}

/** Ce que le hockey ajoute à l'image : le palet et les cages. */
export interface SceneHockey {
  /** SUMO : l'anneau, ou null. */
  anneau?: { x: number; y: number; rayon: number } | null
  /** Le rayon des coins de la patinoire. */
  coins: number
  /** Les cercles de mise en jeu des zones : leur distance à la ligne de but,
   *  leur écart à l'axe du terrain, leur rayon. */
  miseEnJeu: { decalage: number; ecart: number; rayon: number }
  /** Les cages : la distance de la ligne de but au fond du terrain, leur
   *  profondeur, leur demi-largeur à l'ouverture puis au fond, l'épaisseur
   *  de leurs parois. */
  cage: { ligne: number; profondeur: number; demiOuverture: number; demiFond: number; epaisseur: number }
  palet: { x: number; y: number; rayon: number; vx: number; vy: number } | null
  /** HOCKEY : les poteaux de métal (quatre au plus). */
  poteaux?: readonly { x: number; y: number; rayon: number }[]
  /** HOCKEY : la distance des lignes bleues à la ligne rouge, et le rayon du
   *  rond central (430 et 200 au duel ; la grande piste les agrandit). */
  lignes?: { bleue: number; rond: number }
  /** HOCKEY : l'agrandissement de la piste — l'image du stade, faite pour la
   *  piste du duel, est agrandie d'autant : sa rambarde reste au bord. */
  echelle?: number
  /** Le joueur qui tient le palet (−1 : personne), sa charge (0 à 1) et le
   *  point qu'il vise : le lancer partira vers là. */
  porteur: number
  charge: number
  viseeX: number
  viseeY: number
  /** Dessiner le trait de visée du porteur (vrai par défaut). Faux quand le
   *  porteur, c'est moi, à la souris : l'écran trace le sien, jusqu'au
   *  viseur — deux traits l'un sur l'autre se brouillaient. */
  traitPorteur?: boolean
}

/** Un ÉCLAT : l'onde qui part d'un choc. `age` en secondes, `force` de 0 à 1. */
export interface Eclat {
  x: number
  y: number
  age: number
  force: number
}
/** Le nombre d'éclats dessinés à la fois, et leur durée (s). */
export const ECLATS_MAX = 4
export const DUREE_ECLAT = 0.45

const VS_CHAMP = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in float aCanal;
uniform vec2 uCentre;
uniform vec2 uDemi;
uniform float uTaille;
uniform float uPoidsGoutte;
out vec4 vMasque;
void main() {
  vec2 c = (aPos - uCentre) / uDemi;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
  gl_PointSize = uTaille;
  // aCanal = le canal (0 à 3), plus 4 pour une goutte libre
  float libre = step(3.5, aCanal);
  float canal = aCanal - 4.0 * libre;
  vMasque = vec4(canal < 0.5, canal > 0.5 && canal < 1.5, canal > 1.5 && canal < 2.5, canal > 2.5) * mix(1.0, uPoidsGoutte, libre);
}`

const FS_CHAMP = `#version 300 es
precision highp float;
in vec4 vMasque;
uniform float uGain;
out vec4 o;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 >= 1.0) discard;
  float w = 1.0 - r2;
  o = vMasque * (w * w * w * uGain);
}`

const VS_ECRAN = `#version 300 es
out vec2 vUv;
void main() {
  // un seul triangle qui couvre l'écran
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const FS_ECRAN = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uChamp;
uniform sampler2D uStade;   // hockey : l'image du stade (tools/images/blender/stade_hockey.py)
uniform vec4 uStadeRect;    // le rectangle du monde qu'elle couvre : x, y, largeur, hauteur
uniform float uStadePret;   // 1 quand elle est chargée (avant : le dessin d'origine)
uniform vec2 uCentre;
uniform vec2 uDemi;
uniform vec4 uSalle;      // minX, minY, maxX, maxY
uniform vec3 uCouleurs[4];
uniform float uSeuil;
uniform float uGain;      // le champ est stocké divisé par ce gain (texture 8 bits)
uniform float uPixel;     // la taille d'un pixel, en unités monde
uniform vec4 uOuvert;     // 1 si le joueur de ce canal est OUVERT
uniform vec4 uGlace;      // 1 si le joueur de ce canal est EN GLACE
uniform float uTemps;     // secondes, pour le souffle d'un corps ouvert
uniform vec4 uCage;       // hockey : ligne de but, profondeur, demi-ouverture, demi-fond (0 : pas de cage)
uniform float uCageEp;    // hockey : l'épaisseur des parois d'une cage
uniform float uCoins;     // hockey : le rayon des coins du terrain (0 : des angles droits)
uniform vec3 uMiseEnJeu;  // hockey : les cercles de zone — distance à la ligne de but, écart à l'axe, rayon
uniform vec2 uLignes;     // hockey : les lignes bleues (distance à la rouge), le rayon du rond central
uniform vec3 uAnneau;     // sumo : le centre de l'anneau et son rayon (0 : pas d'anneau)
uniform vec4 uPalet;      // hockey : x, y, rayon, 1 s'il est en jeu
uniform vec4 uPorteur;    // hockey : qui le tient (−1 : personne), sa charge, sa visée (x, y)
uniform float uTraitPorteur; // 1 : dessiner son trait de visée (0 : l'écran trace le sien)
uniform vec2 uPaletV;     // hockey : la vitesse du palet (sa traînée)
uniform vec4 uEclats[4];  // les chocs en cours : x, y, âge (s), force (0 : aucun)
uniform vec4 uCoeurs[4];  // le CŒUR de chaque corps : x, y, son rayon, 1 s'il est connu
uniform vec4 uRegards[4]; // son REGARD : x, y, sa présence (0 : aucun)
uniform vec3 uPoteaux[4]; // hockey : les poteaux, x, y, rayon (0 : aucun)
out vec4 o;

// ---- les bruits du jeu (render/renderer.ts), tels quels
float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.5);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// Un semis de points épars : au plus un par cellule, taille bornée en pixels
// (sinon il scintille au dézoom), et fondu quand les cellules passent sous
// quelques pixels (sinon : neige quadrillée).
float semis(vec2 monde, float cellule, float densite) {
  float zoom = 1.0 / uPixel;
  float vis = smoothstep(4.0, 12.0, cellule * zoom);
  if (vis <= 0.0) return 0.0;
  vec2 g = floor(monde / cellule);
  float h = hash21(g);
  if (h > densite) return 0.0;
  vec2 centre = (g + 0.5 + 0.7 * (vec2(hash21(g + 17.3), hash21(g + 39.7)) - 0.5)) * cellule;
  float r = max(cellule * (0.015 + 0.035 * hash21(g + 5.1)), 1.2 / zoom);
  return smoothstep(r * 2.5, r * 0.5, length(monde - centre)) * (0.4 + 0.6 * hash21(g + 8.9)) * vis;
}

// LE CHAMP D'UN POINT : celui du groupe qui y gagne, diminué des autres
// (voir main). Sert au relief (quatre prélèvements écartés) et à l'ombre
// portée. textureLod : ces lectures se font dans des branches.
float champTotal(vec2 uv) {
  vec4 c = textureLod(uChamp, uv, 0.0) * uGain;
  float ouvertC = dot(c, uOuvert);
  vec4 f = c * (1.0 - uOuvert);
  float gagne = max(ouvertC, max(max(f.r, f.g), max(f.b, f.a)));
  return max(2.0 * gagne - (c.r + c.g + c.b + c.a), 0.0);
}

// LE PLAFOND de l'aréna, qu'on ne voit que MIRÉ dans les corps : des rampes
// de lumière en bandeaux, le long de la salle. Elles sont fixes dans le
// monde — un corps qui file les voit défiler sur sa peau, et c'est ce
// défilement qui dit sa vitesse.
vec3 plafond(vec2 p) {
  float rang = abs(fract(p.y / 420.0) - 0.5) * 420.0;
  float bande = 1.0 - smoothstep(14.0, 46.0, rang);
  float coupe = smoothstep(0.07, 0.13, abs(fract(p.x / 640.0) - 0.5));
  return vec3(0.55, 0.75, 0.95) * bande * coupe * 0.9 + vec3(0.02, 0.035, 0.05);
}
// Ses PROJECTEURS : six, au-dessus de la salle. Chacun se mire en un éclat
// au point du reflet qui le regarde.
vec3 projecteurs(vec2 p) {
  vec2 c = (uSalle.xy + uSalle.zw) * 0.5;
  vec2 d = uSalle.zw - uSalle.xy;
  vec3 e = vec3(0.0);
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j += 2) {
      float dl = distance(p, c + vec2(float(i) * d.x * 0.3, float(j) * d.y * 0.22));
      e += vec3(1.0, 0.96, 0.88) * exp(-dl * dl / (2.0 * 60.0 * 60.0));
    }
  }
  return e;
}

float grille(vec2 m, float pas, float px) {
  vec2 g = abs(fract(m / pas - 0.5) - 0.5) * pas;
  return 1.0 - smoothstep(0.0, px * 1.5, min(g.x, g.y));
}

// LE DÉCOR en un point du monde. C'est une fonction (et non plus le début de
// main) parce que les corps le MIRENT : leur peau relit le terrain à
// distance, le long de sa normale. « px » est la finesse du trait, en unités
// monde : un pixel pour le sol, bien plus pour le reflet — miré au pixel, le
// filet d'une cage se lisait comme du bruit et les lignes comme des cheveux.
vec3 decor(vec2 monde, float px) {
  // ---- LE STADE (hockey) : l'image rendue dans Blender, posée sous le
  // terrain — ses gradins, sa rambarde, ses néons. Les lignes, les cages et
  // les poteaux restent dessinés ici, par-dessus. Lue à la finesse du trait
  // (textureLod : ce décor se lit aussi dans des branches, pour le miroir) :
  // nette sur le sol, floue dans le reflet d'un corps.
  bool stade = uStadePret > 0.5 && uCage.x > 0.0;
  vec3 fond = vec3(0.012, 0.027, 0.063);
  if (stade) {
    vec2 st = (monde - uStadeRect.xy) / uStadeRect.zw;
    float texels = px * float(textureSize(uStade, 0).x) / uStadeRect.z;
    vec3 image = textureLod(uStade, st, log2(max(texels, 1.0))).rgb;
    // hors de l'image (un écran très haut, en portrait) : le vide
    float dedansImage = step(0.0, st.x) * step(st.x, 1.0) * step(0.0, st.y) * step(st.y, 1.0);
    fond = mix(vec3(0.002, 0.003, 0.008), image, dedansImage);
    // la piste un ton plus bas : ses dalles ne doivent pas disputer leurs
    // joints aux lignes du jeu (les bleues surtout)
    vec2 demiPiste = (uSalle.zw - uSalle.xy) * 0.5;
    vec2 versCoinPiste = abs(monde - (uSalle.xy + uSalle.zw) * 0.5) - demiPiste + uCoins;
    float surPiste = step(length(max(versCoinPiste, 0.0)) + min(max(versCoinPiste.x, versCoinPiste.y), 0.0), uCoins);
    fond *= 1.0 - 0.35 * surPiste;
  }
  // la salle : un rectangle, ou — au hockey — une patinoire aux coins ronds.
  // « mur » est la distance à la paroi, positive DEDANS (uCoins nul : un
  // rectangle exactement).
  vec2 demiSalle = (uSalle.zw - uSalle.xy) * 0.5;
  vec2 versCoin = abs(monde - (uSalle.xy + uSalle.zw) * 0.5) - demiSalle + uCoins;
  float mur = uCoins - length(max(versCoin, 0.0)) - min(max(versCoin.x, versCoin.y), 0.0);
  float salle = step(0.0, mur);
  // (avec le stade, la piste a ses dalles, et la rambarde est dans l'image)
  if (!stade) {
  fond += salle * vec3(0.012, 0.022, 0.034);
  // le quadrillage dit le mouvement dans une salle vide ; la patinoire a
  // ses lignes, qui le disent mieux
  float quadrille = uCage.x > 0.0 ? 0.35 : 1.0;
  fond += salle * quadrille * grille(monde, 240.0, px) * vec3(0.022, 0.036, 0.05);
  fond += salle * quadrille * grille(monde, 960.0, px) * vec3(0.03, 0.05, 0.068);
  // la paroi : un trait clair, et un halo vers l'intérieur
  float trait = 1.0 - smoothstep(0.0, max(6.0, px * 2.0), abs(mur));
  fond += trait * vec3(0.38, 0.55, 0.68);
  fond += salle * exp(-max(mur, 0.0) / 90.0) * vec3(0.03, 0.055, 0.075);
  }
  // ---- le hockey : la patinoire. Ses lignes sont celles d'une vraie — la
  // ligne rouge et son cercle au centre, les deux lignes bleues, les lignes
  // de but d'un bord à l'autre, les cercles de mise en jeu — et ses cages
  // sont posées DANS le terrain : on passe derrière. Chaque cage porte la
  // couleur de celui qui la GARDE.
  if (uCage.x > 0.0) {
    vec2 centre = (uSalle.xy + uSalle.zw) * 0.5;
    float aGauche = step(monde.x, centre.x);
    vec3 camp = mix(uCouleurs[1], uCouleurs[0], aGauche);
    // les deux moitiés se dessinent d'un coup, en miroir : la distance au
    // fond de SON côté du terrain, et l'écart à l'axe
    float duFond = mix(uSalle.z - monde.x, monde.x - uSalle.x, aGauche);
    float ecartAxe = abs(monde.y - centre.y);
    float net = px * 1.5;
    float fin = px * 2.0;
    vec3 rouge = vec3(0.5, 0.16, 0.2);
    vec3 bleu = vec3(0.14, 0.3, 0.55);
    // la ligne rouge, son cercle et son point
    float axe = abs(monde.x - centre.x);
    fond += salle * rouge * 0.5 * (1.0 - smoothstep(2.0, 2.0 + fin, axe));
    float duCentre = length(monde - centre);
    fond += salle * bleu * 0.55 * (1.0 - smoothstep(0.0, fin, abs(duCentre - uLignes.y)));
    fond += salle * bleu * 0.7 * (1.0 - smoothstep(10.0, 10.0 + fin, duCentre));
    // les lignes bleues
    fond += salle * bleu * 0.75 * (1.0 - smoothstep(3.0, 3.0 + fin, abs(axe - uLignes.x)));
    // la ligne de but, d'un bord à l'autre
    float ligne = uCage.x;
    fond += salle * rouge * 0.42 * (1.0 - smoothstep(0.0, fin, abs(duFond - ligne)));
    // les cercles de mise en jeu, de part et d'autre de la cage
    float miseEnJeu = length(vec2(duFond - ligne - uMiseEnJeu.x, ecartAxe - uMiseEnJeu.y));
    fond += salle * rouge * 0.4 * (1.0 - smoothstep(0.0, fin, abs(miseEnJeu - uMiseEnJeu.z)));
    fond += salle * rouge * 0.5 * (1.0 - smoothstep(9.0, 9.0 + fin, miseEnJeu));
    // ---- la cage : un trapèze, plus étroit au fond
    float creux = uCage.x - uCage.y;
    float demiOuv = uCage.z;
    float demiFond = uCage.w;
    float ep = uCageEp;
    // la distance au côté penché (positive dehors), et la position le long de lui
    float longueur = length(vec2(uCage.y, demiOuv - demiFond));
    vec2 lelong = vec2(-uCage.y, demiFond - demiOuv) / longueur;
    vec2 dehors = vec2(demiFond - demiOuv, uCage.y) / longueur;
    vec2 duPoteau = vec2(duFond - ligne, ecartAxe - demiOuv);
    float aCote = dot(duPoteau, dehors);
    float surCote = dot(duPoteau, lelong);
    // le filet, dans la cage
    float dedans = step(creux, duFond) * step(duFond, ligne) * step(aCote, 0.0);
    fond += salle * dedans * camp * (0.07 + 0.2 * grille(monde, 20.0, px));
    // ses parois : le fond, et les deux côtés
    float paroiFond = smoothstep(creux - ep - net, creux - ep, duFond) * (1.0 - smoothstep(creux, creux + net, duFond)) * (1.0 - smoothstep(demiFond + ep, demiFond + ep + net, ecartAxe));
    float paroiCote = smoothstep(-net, 0.0, aCote) * (1.0 - smoothstep(ep, ep + net, aCote)) * smoothstep(-6.0 - net, -6.0, surCote) * (1.0 - smoothstep(longueur + 6.0, longueur + 6.0 + net, surCote));
    fond = mix(fond, camp * 0.62 + vec3(0.05), salle * max(paroiFond, paroiCote));
    // la zone du gardien, devant la ligne
    float zone = length(vec2(max(duFond - ligne, 0.0), monde.y - centre.y));
    float devant = step(ligne, duFond);
    fond += salle * devant * camp * 0.05 * (1.0 - smoothstep(demiOuv + 36.0, demiOuv + 40.0, zone));
    fond += salle * devant * camp * 0.3 * (1.0 - smoothstep(0.0, fin, abs(zone - demiOuv - 40.0)));
  }

  // ---- les poteaux de métal (hockey), vus de DESSUS. Un premier dessin —
  // un disque gris au reflet rond — se lisait comme une bille, presque une
  // goutte à ramasser (le concepteur, 22/11 : « on dirait plutôt des
  // éléments destinés au volume, pas des poutres métalliques »). Un poteau
  // vu d'en haut, c'est la TÊTE d'un fût : plate, usinée en cercles, une vis
  // à six pans au centre, un biseau qui prend la lumière d'un seul côté — et
  // il est SCELLÉ au sol par une platine boulonnée, cerclée d'une bande de
  // signalisation. La platine n'est qu'un dessin : seul le fût (le rayon du
  // poteau) arrête l'eau et le palet. Ils sont DANS le décor : la peau des
  // corps les mire aussi.
  for (int k = 0; k < 4; k++) {
    vec3 q = uPoteaux[k];
    if (q.z <= 0.0) continue;
    float r = q.z;
    vec2 dq = monde - q.xy;
    float d = length(dq);
    float bordQ = max(px, 1.0);
    // l'ombre portée du fût, longue : il est haut
    float ombreQ = 1.0 - smoothstep(r * 1.1, r * 1.9, length(dq - vec2(12.0, 16.0)));
    fond *= 1.0 - 0.5 * ombreQ;
    // l'EMBASE : un disque d'acier sombre, ses six boulons en cercle, et la
    // bande jaune et noire en couronne. (Elle a d'abord été carrée : « il
    // faut qu'ils soient ronds », le concepteur, 22/11 — le carré se lisait
    // avant le fût.)
    float embase = 1.0 - smoothstep(r * 1.6 - bordQ, r * 1.6 + bordQ, d);
    vec3 plat = vec3(0.16, 0.18, 0.21);
    float bande = smoothstep(r * 1.3 - bordQ, r * 1.3 + bordQ, d);
    float angleQ = atan(dq.y, dq.x) / 6.2831853;
    // (miré dans un corps, le trait est large : les rayures s'y fondent en
    // leur teinte moyenne — nettes, elles s'y lisaient comme des gribouillis)
    float rayure = mix(step(0.5, fract(angleQ * 14.0)), 0.5, clamp(px * 3.0 / (r * 0.55), 0.0, 1.0));
    plat = mix(plat, mix(vec3(0.07, 0.07, 0.08), vec3(0.86, 0.66, 0.12), rayure), bande);
    float secteur = (fract(angleQ * 6.0 + 0.5) - 0.5) / 6.0 * 6.2831853;
    vec2 boulon = vec2(d * cos(secteur) - r * 1.15, d * sin(secteur));
    float boulons = (1.0 - smoothstep(r * 0.09, r * 0.09 + bordQ, length(boulon))) * (1.0 - bande);
    plat = mix(plat, vec3(0.42, 0.45, 0.5), boulons);
    fond = mix(fond, plat, embase);
    // la tête du fût
    float disqueQ = 1.0 - smoothstep(r - bordQ, r + bordQ, d);
    vec2 u = dq / r;
    float lu = length(u);
    vec3 acier = vec3(0.56, 0.6, 0.65) * (0.93 + 0.07 * sin(d * 1.8));
    // le biseau : clair du côté de la lampe (en haut à gauche), sombre en face
    float cote = dot(u / max(lu, 1e-3), vec2(-0.6, -0.8));
    float biseau = smoothstep(0.74, 0.84, lu);
    acier = mix(acier, vec3(0.3, 0.33, 0.37) + vec3(0.62, 0.6, 0.56) * max(cote, 0.0), biseau);
    // la vis à six pans, et son creux
    vec2 h = abs(u);
    float hexa = max(h.x * 0.866 + h.y * 0.5, h.y);
    acier = mix(acier, vec3(0.3, 0.33, 0.37), 1.0 - smoothstep(0.3, 0.33, hexa));
    acier = mix(acier, vec3(0.08, 0.09, 0.1), 1.0 - smoothstep(0.13, 0.16, hexa));
    fond = mix(fond, acier, disqueQ);
  }

  // ---- le sumo : l'anneau. Dedans, le jeu ; dehors, on a perdu — le sol y
  // rougeoie, et le bord de l'anneau se voit de loin.
  if (uAnneau.z > 0.0) {
    float duCoeur = length(monde - uAnneau.xy);
    float horsAnneau = smoothstep(uAnneau.z, uAnneau.z + px * 2.0, duCoeur);
    fond += salle * horsAnneau * vec3(0.11, 0.018, 0.03);
    fond += salle * (1.0 - horsAnneau) * vec3(0.01, 0.02, 0.032);
    float bordAnneau = 1.0 - smoothstep(3.0, 3.0 + px * 2.0, abs(duCoeur - uAnneau.z));
    fond += salle * bordAnneau * vec3(0.85, 0.62, 0.3);
    // une lueur à l'intérieur du bord : on la voit se resserrer
    fond += salle * (1.0 - horsAnneau) * exp(-(uAnneau.z - duCoeur) / 46.0) * vec3(0.16, 0.1, 0.03);
    // la marque du centre, et les deux traits de départ
    fond += salle * vec3(0.3, 0.22, 0.1) * (1.0 - smoothstep(0.0, px * 2.0, abs(duCoeur - 60.0)));
  }
  return fond;
}

void main() {
  // le monde a son axe y vers le bas, la texture vers le haut
  vec2 monde = uCentre + vec2(vUv.x * 2.0 - 1.0, 1.0 - vUv.y * 2.0) * uDemi;
  vec3 fond = decor(monde, uPixel);

  // ---- l'eau
  vec4 ch = texture(uChamp, vUv) * uGain;
  // les groupes : tous les ouverts ensemble, chaque fermé pour lui
  float champOuvert = dot(ch, uOuvert);
  vec4 fermes = ch * (1.0 - uOuvert);
  float champFerme = max(max(fermes.r, fermes.g), max(fermes.b, fermes.a));
  float gagnant = max(champOuvert, champFerme);
  float somme = ch.r + ch.g + ch.b + ch.a;
  // le champ du groupe gagnant, diminué de celui des autres : là où deux
  // groupes se valent il tombe à zéro — c'est le vide entre deux peaux
  float total = max(2.0 * gagnant - somme, 0.0);
  float bord = fwidth(total) * 0.9 + 1e-4;
  float eau = smoothstep(uSeuil - bord, uSeuil + bord, total);
  // ouv : le pixel est-il au groupe des ouverts ? (à égalité, oui)
  float ouv = step(champFerme, champOuvert);
  vec4 po = ch * uOuvert;
  vec3 teinteOuverte = (po.r * uCouleurs[0] + po.g * uCouleurs[1] + po.b * uCouleurs[2] + po.a * uCouleurs[3]) / max(champOuvert, 1e-4);
  // un corps fermé garde SA couleur, pure, jusqu'au bord
  vec3 teinteFermee = fermes.r >= champFerme ? uCouleurs[0] : fermes.g >= champFerme ? uCouleurs[1] : fermes.b >= champFerme ? uCouleurs[2] : uCouleurs[3];
  vec3 teinte = mix(teinteFermee, teinteOuverte, ouv);
  // EN GLACE : le canal qui tient ce pixel est-il gelé ?
  float gel = (1.0 - ouv) * (fermes.r >= champFerme ? uGlace.r : fermes.g >= champFerme ? uGlace.g : fermes.b >= champFerme ? uGlace.b : uGlace.a);
  // LE MAÎTRE DU PIXEL : le canal le plus fort — c'est SON cœur, SON regard
  int maitre = ch.r >= max(ch.g, max(ch.b, ch.a)) ? 0 : ch.g >= max(ch.b, ch.a) ? 1 : ch.b >= ch.a ? 2 : 3;
  vec4 coeur = uCoeurs[maitre];
  vec4 regard = uRegards[maitre];
  float th = uSeuil;
  float menisque = 1.0 - smoothstep(uSeuil, uSeuil + 3.5, total);
  float souffle = 0.5 + 0.5 * sin(uTemps * 5.0);
  vec3 couleur = vec3(0.0);
  // L'HABILLAGE DE L'EAU EST CELUI DU JEU (render/renderer.ts, le bloc
  // « habillage de l'eau », surface MIROITANT MERCURE — son réglage par
  // défaut), recopié couche par couche. Ce qui change : la teinte est celle
  // du JOUEUR et non le bleu du Sujet, et ce que la peau mire n'est pas une
  // salle de la station mais le terrain, son plafond et ses projecteurs.
  // Il ne se calcule que là où il y a de l'eau.
  if (eau > 0.001) {
    vec3 water = teinte * 0.66;
    // cœur plus dense légèrement plus sombre, liseré plus clair
    float core = smoothstep(th * 1.8, th * 3.2, total);
    water = mix(water, water * 0.75, core * 0.5);
    float rim = 1.0 - smoothstep(th + bord, th * 1.9, total);
    water += (teinte * 0.5 + vec3(0.04, 0.07, 0.09)) * rim * 0.55 * (1.0 - gel);
    // le relief : une pseudo-normale sur le champ FLOUTÉ (quatre prélèvements
    // écartés) — les dérivées par pixel liraient chaque particule comme une
    // bille. La pente est ramenée à l'unité monde : elle ne dépend pas du zoom.
    vec2 texel = 2.5 / vec2(textureSize(uChamp, 0));
    float fL = champTotal(vUv - vec2(texel.x, 0.0));
    float fR = champTotal(vUv + vec2(texel.x, 0.0));
    float fB = champTotal(vUv - vec2(0.0, texel.y));
    float fT = champTotal(vUv + vec2(0.0, texel.y));
    vec2 grad = vec2(fR - fL, fT - fB) / (5.0 * uPixel);
    vec3 nrm = normalize(vec3(-grad * 6.0, 1.0));
    vec3 lampe = normalize(vec3(-0.35, 0.55, 0.75));
    float diffuse = max(dot(nrm, lampe), 0.0);
    float reflet = max(reflect(-lampe, nrm).z, 0.0);
    float specular = pow(reflet, 12.0);
    // le relief n'éclaire que la zone de surface : à l'intérieur, les
    // fluctuations de densité ne sont pas du relief
    float surfaceZone = 1.0 - smoothstep(th * 1.4, th * 2.6, total);
    // un scintillement interne discret : l'eau vit même au repos
    float shimmer = sin(monde.x * 0.11 + uTemps * 1.6) * sin(monde.y * 0.09 - uTemps * 1.2);
    water *= 1.0 + 0.05 * shimmer * core;
    water = mix(water, water * (0.55 + 0.75 * diffuse), surfaceZone * 0.55);
    water += vec3(0.85, 0.95, 1.0) * specular * 0.35 * surfaceZone * (1.0 - gel);
    // le miroir vivant : un éclat dur, un voile de fresnel aux incidences
    // rasantes, et un semis d'étincelles qui GLISSE avec la courbure
    float miroir = surfaceZone * (1.0 - gel);
    float specDur = pow(reflet, 42.0);
    float fres = pow(1.0 - clamp(nrm.z, 0.0, 1.0), 2.0);
    // (sur le CORPS seulement : une goutte en vol est toute en surface et
    // toute en pente — le semis n'y glisse plus, il s'y pose en points de
    // trois pixels qui se lisent comme des défauts ; vu à la première capture)
    float part = coeur.w > 0.5 ? length(monde - coeur.xy) / max(coeur.z, 1.0) : 9.0;
    float proche = 1.0 - smoothstep(1.2, 1.7, part);
    float etincelles = (1.0 - smoothstep(1.0, 1.15, part)) * semis(monde + nrm.xy * 55.0 + vec2(uTemps * 7.0, -uTemps * 4.0), 48.0, 0.10);
    water += vec3(0.95, 0.99, 1.0) * specDur * 0.80 * miroir;
    water += mix(vec3(0.50, 0.68, 0.85), teinte, 0.4) * fres * 0.40 * miroir;
    water += vec3(0.90, 0.97, 1.0) * etincelles * (0.25 + specDur) * 0.55 * miroir;
    // LE DÔME DU REGARD : là où l'œil se pose, le volume se soulève — une
    // bosse locale incline le miroir, et le reflet se courbe autour d'elle
    vec2 relOeil = monde - regard.xy;
    float rOeil = length(relOeil);
    float poulsOeil = 0.85 + 0.15 * sin(uTemps * 0.7);
    float sigOeil = 34.0;
    float domeOeil = regard.z * poulsOeil * (1.0 - gel) * exp(-rOeil * rOeil / (2.0 * sigOeil * sigOeil));
    vec2 penteOeil = (relOeil / max(rOeil, 1.0)) * (rOeil / sigOeil) * domeOeil;
    // LE MIROIR D'UN SEUL TENANT (mercure) : la normale est RADIALE depuis
    // le cœur du corps et la portée croît du centre au bord — le cœur mire
    // le plafond juste au-dessus, le bord balaie le terrain alentour : ses
    // lignes, ses cages et ses rampes s'y reconnaissent, courbées comme sur
    // une goutte de mercure. Une houle lente incline le tout d'un bloc.
    vec3 gelMiroir = vec3(0.0);
    float gelForce = 0.0;
    if (coeur.w > 0.5) {
      vec2 rad = monde - coeur.xy;
      float rC = length(rad);
      vec2 Nw = rad / max(rC, 1.0);
      float houle = vnoise(monde * 0.006 + vec2(uTemps * 0.10, -uTemps * 0.07)) - 0.5;
      float ca = cos(houle * 0.55);
      float sa = sin(houle * 0.55);
      Nw = vec2(Nw.x * ca - Nw.y * sa, Nw.x * sa + Nw.y * ca);
      float profil = smoothstep(0.08, 1.0, part);
      vec2 reflPos = monde + Nw * (30.0 * profil + 330.0 * profil * profil) + penteOeil * 170.0;
      // l'image NUE, avant la teinte de l'eau : le gel la reprendra
      // (le plancher de 0,10 : le terrain est presque noir, et sans lui le
      // bord d'un corps, qui ne mire que du sol, se fondait dans le fond)
      vec3 envNu = vec3(0.10) + decor(reflPos, max(uPixel * 3.0, 7.0)) * 2.6 + plafond(reflPos) * (1.0 - 0.55 * profil);
      vec3 eclatsLampes = projecteurs(reflPos);
      // (un miroir d'eau n'est pas du chrome : le reflet prend la teinte du
      // joueur — c'est aussi ce qui garde à chacun SA couleur jusqu'au bord)
      vec3 env = min(envNu * mix(vec3(0.6), teinte, 0.7), vec3(1.1));
      env = min(env + eclatsLampes * 1.5, vec3(1.7));
      // couverture continue : pleine au bord (incidence rasante), plus
      // discrète au cœur — l'eau profonde montre sa propre couleur. Une
      // goutte partie loin du corps ne mire rien : elle doit rester lisible.
      float bordCorps = smoothstep(0.40, 0.98, part);
      water = mix(water, env, (1.0 - gel) * proche * clamp(0.24 + 0.50 * bordCorps, 0.0, 0.74));
      // le gel poli mire la salle du même reflet, mais GIVRÉ : désaturé (le
      // blanc reste maître), les éclats des lampes plus francs
      float lumR = dot(envNu, vec3(0.299, 0.587, 0.114));
      vec3 givre = mix(vec3(lumR), envNu, 0.30) * vec3(0.94, 0.98, 1.04);
      gelMiroir = min(givre * 0.80 + eclatsLampes * 1.25, vec3(1.6));
      gelForce = proche * clamp(0.20 + 0.42 * bordCorps, 0.0, 0.60);
    }
    // LE REGARD : quelque chose vit sous la surface, voilé par l'épaisseur.
    // Une pénombre large dessine sa silhouette ; au centre, un noyau clair
    // pulse lentement ; et le dôme se modèle — le flanc tourné vers le haut
    // prend la lumière, l'autre s'ombre. Ici il regarde OÙ LE JOUEUR VISE.
    if (regard.z > 0.003) {
      float masque = regard.z * (1.0 - gel);
      float ombreOeil = exp(-rOeil * rOeil / (2.0 * 44.0 * 44.0));
      water = mix(water, water * 0.80, ombreOeil * masque * 0.6);
      float noyau = exp(-rOeil * rOeil / (2.0 * 27.0 * 27.0));
      float pouls = 0.8 + 0.2 * sin(uTemps * 0.7);
      water += (teinte * 0.55 + vec3(0.10, 0.14, 0.16)) * noyau * masque * pouls;
      float ombrage = (-relOeil.y / max(rOeil, 1.0)) * (rOeil / sigOeil) * exp(-rOeil * rOeil / (2.0 * sigOeil * sigOeil));
      water *= 1.0 + ombrage * 0.22 * masque * poulsOeil;
    }
    // LE GEL : la teinte pâlit vers la glace mate, et le bloc poli se taille
    // en GRANDES facettes — un Voronoï ancré au cœur du bloc (il dérive avec
    // lui), chaque cellule sa nuance, les arêtes en fins liserés de lumière.
    // Le relief par goutte s'efface : figé, il se lisait comme une tôle
    // ondulée. La teinte du joueur y reste, en fond.
    if (gel > 0.5) {
      float diffuseGel = mix(diffuse, 0.58, 0.85);
      vec2 rel = (monde - coeur.xy) / 95.0;
      vec2 ip = floor(rel);
      vec2 fp = fract(rel);
      float f1 = 8.0;
      float f2 = 8.0;
      vec2 idBest = vec2(0.0);
      for (int gy = -1; gy <= 1; gy++) {
        for (int gx = -1; gx <= 1; gx++) {
          vec2 g = vec2(float(gx), float(gy));
          vec2 cell = ip + g;
          vec2 d = g + vec2(hash21(cell), hash21(cell + 41.7)) * 0.85 - fp;
          float dd = dot(d, d);
          if (dd < f1) {
            f2 = f1;
            f1 = dd;
            idBest = cell;
          } else if (dd < f2) {
            f2 = dd;
          }
        }
      }
      float facette = hash21(idBest + 7.3) * 2.0 - 1.0;
      float aretes = 1.0 - smoothstep(0.02, 0.16, f2 - f1);
      vec3 iceCol = mix(vec3(0.60, 0.76, 0.88), teinte, 0.25) * (0.72 + 0.45 * diffuseGel);
      iceCol = mix(iceCol, gelMiroir, gelForce);
      iceCol *= 1.0 + 0.07 * facette;
      iceCol += vec3(0.88, 0.95, 1.05) * aretes * 0.12;
      water = mix(water, iceCol, 0.9);
      // l'œil du gel : un cœur sombre figé sous la surface, cerné de givre
      float coeurG = exp(-rOeil * rOeil / (2.0 * 20.0 * 20.0));
      float givreG = exp(-pow((rOeil - 27.0) / 11.0, 2.0));
      float poulsG = 0.92 + 0.08 * sin(uTemps * 0.45);
      water = mix(water, water * 0.68, coeurG * regard.z * 0.8);
      water += vec3(0.74, 0.90, 1.05) * givreG * regard.z * 0.34 * poulsG;
    }
    couleur = water;
    // OUVERT OU FERMÉ, lisible d'un coup d'œil — cela, c'est le multi. Un
    // corps FERMÉ porte une peau : un liseré sombre et net au bord, la
    // cloison qu'on ne traverse pas (en glace : une arête claire). Un corps
    // OUVERT n'en a pas : son bord est clair et il respire.
    float peau = 1.0 - smoothstep(uSeuil, uSeuil + 1.3, total);
    couleur = mix(couleur, couleur * 0.3, peau * (1.0 - ouv) * (1.0 - gel) * 0.85);
    couleur = mix(couleur, vec3(0.97, 0.99, 1.0), peau * gel * 0.8);
    couleur += menisque * ouv * (0.22 + 0.3 * souffle);
  }
  // L'OMBRE PORTÉE : le corps a une épaisseur, il la pose sur le sol, du
  // côté opposé à la lampe (le champ relu un peu plus haut à gauche).
  float ombreSol = smoothstep(th * 0.5, th * 1.8, champTotal(vUv + vec2(-16.0, 22.0) / (2.0 * uDemi)));
  fond *= 1.0 - 0.42 * ombreSol;
  // un souffle de lumière autour du corps, dans sa teinte
  float halo = smoothstep(0.0, uSeuil, total) * (1.0 - eau);
  fond += halo * teinte * (0.14 + ouv * (0.2 + 0.25 * souffle));

  vec3 image = mix(fond, couleur, eau);

  // ---- le hockey : le palet, par-dessus l'eau (porté, il doit rester visible)
  if (uPalet.w > 0.5) {
    vec2 dp = monde - uPalet.xy;
    float rp = length(dp) / uPalet.z;
    float disque = 1.0 - smoothstep(1.0 - uPixel / uPalet.z, 1.0 + uPixel / uPalet.z, rp);
    vec3 glace = vec3(0.86, 0.91, 0.95);
    glace *= mix(1.0, 0.58, smoothstep(0.6, 1.0, rp));
    glace = mix(glace, vec3(0.2, 0.27, 0.33), smoothstep(0.74, 0.78, rp) * (1.0 - smoothstep(0.84, 0.88, rp)) * 0.7);
    glace += 0.22 * (1.0 - smoothstep(0.0, 0.45, length(dp / uPalet.z - vec2(-0.32, -0.36))));
    // la traînée : libre et lancé, il laisse un sillage qui dit d'où il
    // vient et à quelle allure — sans elle un palet rapide ne se suit pas
    float allure = length(uPaletV);
    if (uPorteur.x < -0.5 && allure > 140.0) {
      vec2 u = uPaletV / allure;
      float derriere = -dot(dp, u);
      float longueur = min(300.0, allure * 0.18);
      float effile = 1.0 - derriere / longueur;
      float travers = abs(dp.x * u.y - dp.y * u.x);
      float sillage = step(0.0, derriere) * step(derriere, longueur) * (1.0 - smoothstep(uPalet.z * effile * 0.55, uPalet.z * effile, travers));
      image += vec3(0.55, 0.78, 0.95) * 0.3 * effile * sillage * (1.0 - disque);
    }
    // une ombre portée, pour le détacher du fond comme de l'eau
    image *= 1.0 - 0.45 * (1.0 - smoothstep(1.0, 1.35, rp)) * (1.0 - disque);
    if (uPorteur.x > -0.5) {
      vec3 teintePorteur = uCouleurs[int(uPorteur.x + 0.5)];
      glace = mix(glace, teintePorteur, 0.3);
      // l'anneau de charge : il s'épaissit tant qu'on tient
      float epais = 3.0 + 13.0 * uPorteur.y;
      float anneau = smoothstep(1.0, 1.0 + uPixel * 2.0 / uPalet.z, rp) * (1.0 - smoothstep(epais, epais + uPixel * 2.0, (rp - 1.0) * uPalet.z - 5.0));
      image = mix(image, teintePorteur * 1.25, anneau * 0.85);
      // le trait de visée : le lancer partira par là, d'autant plus loin
      // que la charge est haute
      vec2 vers = uPorteur.zw - uPalet.xy;
      float lv = length(vers);
      if (lv > 1.0 && uTraitPorteur > 0.5) {
        vec2 u = vers / lv;
        float le = dot(dp, u);
        float ecartAxe = abs(dp.x * u.y - dp.y * u.x);
        float portee = uPalet.z + 30.0 + 320.0 * (0.25 + 0.75 * uPorteur.y);
        float surLeTrait = step(uPalet.z + 26.0, le) * step(le, portee) * (1.0 - smoothstep(3.0, 3.0 + uPixel * 2.0, ecartAxe));
        float tirets = step(0.45, fract(le / 34.0));
        image = mix(image, teintePorteur * 1.3, surLeTrait * tirets * 0.9);
      }
    }
    image = mix(image, glace, disque);
  }

  // ---- les éclats : une onde claire qui part de chaque choc et s'efface
  for (int k = 0; k < 4; k++) {
    vec4 e = uEclats[k];
    float t = e.z / 0.45;
    if (e.w <= 0.0 || t >= 1.0) continue;
    float rayonOnde = 28.0 + 240.0 * t * (0.45 + 0.55 * e.w);
    float ecartOnde = abs(length(monde - e.xy) - rayonOnde);
    float onde = 1.0 - smoothstep(0.0, 4.0 + 12.0 * (1.0 - t) + uPixel, ecartOnde);
    image += onde * (1.0 - t) * (1.0 - t) * (0.35 + 0.65 * e.w) * vec3(0.72, 0.88, 1.0) * 0.6;
  }

  o = vec4(image, 1.0);
}`

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const s = gl.createShader(type)
  if (!s) throw new Error('rendu du multi : shader refusé')
  gl.shaderSource(s, source)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const journal = gl.getShaderInfoLog(s) ?? ''
    gl.deleteShader(s)
    throw new Error('rendu du multi : ' + journal)
  }
  return s
}

function programme(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()
  if (!p) throw new Error('rendu du multi : programme refusé')
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('rendu du multi : ' + (gl.getProgramInfoLog(p) ?? ''))
  return p
}

export class RenduMulti {
  private readonly gl: WebGL2RenderingContext
  private readonly canvas: HTMLCanvasElement
  private readonly progChamp: WebGLProgram
  private readonly progEcran: WebGLProgram
  private readonly vao: WebGLVertexArrayObject
  private readonly vaoVide: WebGLVertexArrayObject
  private readonly tampon: WebGLBuffer
  private readonly cible: WebGLFramebuffer
  private readonly texture: WebGLTexture
  private donnees: Float32Array
  /** Le rang, dans la palette, de la couleur du joueur 0 puis du joueur 1. */
  /** La teinte de chaque canal (profil.ts, teintesDeLaPartie). */
  teintes: Teinte[] = teintesDeLaPartie([0, 1], 2)
  private readonly eclats = new Float32Array(ECLATS_MAX * 4)
  private readonly coeurs = new Float32Array(CANAUX * 4)
  /** L'écart du regard de chaque corps à son cœur (voir tourneRegard), et
   *  ce qui part au shader : sa position dans le monde. */
  private readonly ecarts = new Float32Array(CANAUX * 4)
  private readonly regards = new Float32Array(CANAUX * 4)
  private readonly poteaux = new Float32Array(4 * 3)
  private tempsRegard = -1
  private largeur = 0
  private hauteur = 0
  /** Le champ tient-il en demi-flottants ? Sinon huit bits, et le gain
   *  ramène la somme sous 1 (le relief s'y écrase un peu, la couleur tient). */
  private readonly flottant: boolean
  /** L'image du stade : sa texture, et où en est son chargement. */
  private readonly texStade: WebGLTexture
  private stade: 'absent' | 'en-cours' | 'pret' = 'absent'
  private readonly gain: number

  constructor(canvas: HTMLCanvasElement, capacite: number) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' })
    if (!gl) throw new Error('WebGL2 indisponible')
    this.gl = gl
    this.canvas = canvas
    this.flottant = gl.getExtension('EXT_color_buffer_float') !== null || gl.getExtension('EXT_color_buffer_half_float') !== null
    this.gain = this.flottant ? 1 : 1 / 24
    this.progChamp = programme(gl, VS_CHAMP, FS_CHAMP)
    this.progEcran = programme(gl, VS_ECRAN, FS_ECRAN)
    this.donnees = new Float32Array(capacite * 3)
    const vao = gl.createVertexArray()
    const vaoVide = gl.createVertexArray()
    const tampon = gl.createBuffer()
    const cible = gl.createFramebuffer()
    const texture = gl.createTexture()
    const texStade = gl.createTexture()
    if (!vao || !vaoVide || !tampon || !cible || !texture || !texStade) throw new Error('rendu du multi : mémoire graphique refusée')
    this.texStade = texStade
    // un pixel noir en attendant l'image : une texture vide liée au shader
    // vaut un avertissement par image dans certains navigateurs
    gl.bindTexture(gl.TEXTURE_2D, texStade)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
    this.vao = vao
    this.vaoVide = vaoVide
    this.tampon = tampon
    this.cible = cible
    this.texture = texture
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, tampon)
    gl.bufferData(gl.ARRAY_BUFFER, this.donnees.byteLength, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 12, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 12, 8)
    gl.bindVertexArray(null)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  /** Lance le chargement de l'image du stade, une fois. Tant qu'elle n'est
   *  pas là — ou si elle manque —, le terrain garde son dessin d'origine. */
  private chargeStade(): void {
    if (this.stade !== 'absent' || typeof Image === 'undefined') return
    this.stade = 'en-cours'
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => {
      const gl = this.gl
      if (gl.isContextLost()) return
      gl.bindTexture(gl.TEXTURE_2D, this.texStade)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
      // des mipmaps : le reflet dans les corps la lit floue, à la finesse
      // de son trait (voir decor dans le shader)
      gl.generateMipmap(gl.TEXTURE_2D)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      this.stade = 'pret'
    }
    // une image qui manque ne casse rien : on garde le dessin d'origine
    image.onerror = () => undefined
    image.src = STADE.url
  }

  /** Accorde la toile à sa boîte. Rend true si la taille a changé. */
  private accorde(): boolean {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const l = Math.max(2, Math.round(this.canvas.clientWidth * dpr))
    const h = Math.max(2, Math.round(this.canvas.clientHeight * dpr))
    if (l === this.largeur && h === this.hauteur) return false
    this.largeur = l
    this.hauteur = h
    this.canvas.width = l
    this.canvas.height = h
    const gl = this.gl
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    if (this.flottant) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, l, h, 0, gl.RGBA, gl.HALF_FLOAT, null)
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, l, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.cible)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return true
  }

  /** Le rapport largeur/hauteur de la toile, pour le cadrage. */
  aspect(): number {
    const l = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    return h > 0 ? l / h : 16 / 9
  }

  /** `corps[j]` : l'état du joueur j (ouvert, en glace, où il vise).
   *  `temps` en secondes. */
  dessine(p: Particules, cadre: Cadre, salle: Bornes, corps: readonly CorpsVu[] = [], temps = 0, scene: SceneHockey | null = null, eclats: readonly Eclat[] = []): void {
    const gl = this.gl
    const ouverts = corps.map((c) => c.ouvert)
    const glaces = corps.map((c) => c.glace === true)
    // le cœur de chaque corps, et son regard, tourné vers ce qu'il vise
    const coeurs = coeursDe(p, this.coeurs)
    const dtRegard = this.tempsRegard < 0 ? 0 : Math.min(0.1, Math.max(0, temps - this.tempsRegard))
    this.tempsRegard = temps
    for (let j = 0; j < CANAUX; j++) {
      const c = corps[j]
      tourneRegard(this.ecarts, j * 4, coeurs[j * 4], coeurs[j * 4 + 1], coeurs[j * 4 + 2], c !== undefined && coeurs[j * 4 + 3] > 0, c?.viseeX ?? 0, c?.viseeY ?? 0, dtRegard)
      this.regards[j * 4] = coeurs[j * 4] + this.ecarts[j * 4]
      this.regards[j * 4 + 1] = coeurs[j * 4 + 1] + this.ecarts[j * 4 + 1]
      this.regards[j * 4 + 2] = this.ecarts[j * 4 + 2]
    }
    this.accorde()
    const n = Math.min(p.n, this.donnees.length / 3)
    const d = this.donnees
    for (let i = 0; i < n; i++) {
      const a = p.attr[i]
      d[i * 3] = p.x[i]
      d[i * 3 + 1] = p.y[i]
      d[i * 3 + 2] = ((a & ATTR_ORPHELINE) !== 0 ? 3 : a & ATTR_PROPRIO) + ((a & ATTR_CORPS) !== 0 ? 0 : 4)
    }

    // 1. le champ
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.cible)
    gl.viewport(0, 0, this.largeur, this.hauteur)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE)
    gl.useProgram(this.progChamp)
    gl.uniform2f(gl.getUniformLocation(this.progChamp, 'uCentre'), cadre.cx, cadre.cy)
    gl.uniform2f(gl.getUniformLocation(this.progChamp, 'uDemi'), cadre.demiL, cadre.demiH)
    const pixelsParUnite = this.hauteur / (2 * cadre.demiH)
    gl.uniform1f(gl.getUniformLocation(this.progChamp, 'uTaille'), Math.max(2, 2 * RAYON_TACHE * pixelsParUnite))
    gl.uniform1f(gl.getUniformLocation(this.progChamp, 'uGain'), this.gain)
    gl.uniform1f(gl.getUniformLocation(this.progChamp, 'uPoidsGoutte'), POIDS_GOUTTE)
    gl.bindVertexArray(this.vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.tampon)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, d, 0, n * 3)
    gl.drawArrays(gl.POINTS, 0, n)

    // 2. la surface
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.largeur, this.hauteur)
    gl.disable(gl.BLEND)
    gl.useProgram(this.progEcran)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.uniform1i(gl.getUniformLocation(this.progEcran, 'uChamp'), 0)
    // le stade : au hockey seulement (la scène a des cages)
    const hockey = (scene?.cage.ligne ?? 0) > 0
    if (hockey) this.chargeStade()
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.texStade)
    gl.uniform1i(gl.getUniformLocation(this.progEcran, 'uStade'), 1)
    // (la piste agrandie l'est depuis son coin, l'origine du monde : l'image
    // aussi — sa rambarde suit le bord)
    const k = scene?.echelle ?? 1
    gl.uniform4f(gl.getUniformLocation(this.progEcran, 'uStadeRect'), STADE.minX * k, STADE.minY * k, STADE.largeur * k, STADE.hauteur * k)
    gl.uniform1f(gl.getUniformLocation(this.progEcran, 'uStadePret'), hockey && this.stade === 'pret' ? 1 : 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.uniform2f(gl.getUniformLocation(this.progEcran, 'uCentre'), cadre.cx, cadre.cy)
    gl.uniform2f(gl.getUniformLocation(this.progEcran, 'uDemi'), cadre.demiL, cadre.demiH)
    gl.uniform4f(gl.getUniformLocation(this.progEcran, 'uSalle'), salle.minX, salle.minY, salle.maxX, salle.maxY)
    // la couleur de chaque joueur : celle qu'il a choisie ; à quatre, celle de
    // son équipe, éclaircie pour l'équipier (profil.ts). (La matière sans
    // maître se peint au canal 3 : au hockey il n'y en a jamais — tous les
    // corps naissent à quelqu'un, et le solveur ne les en dépossède pas.)
    gl.uniform3fv(gl.getUniformLocation(this.progEcran, 'uCouleurs'), this.teintes.flat())
    gl.uniform1f(gl.getUniformLocation(this.progEcran, 'uSeuil'), SEUIL)
    gl.uniform1f(gl.getUniformLocation(this.progEcran, 'uGain'), 1 / this.gain)
    gl.uniform1f(gl.getUniformLocation(this.progEcran, 'uPixel'), 1 / pixelsParUnite)
    gl.uniform4f(gl.getUniformLocation(this.progEcran, 'uOuvert'), ouverts[0] ? 1 : 0, ouverts[1] ? 1 : 0, ouverts[2] ? 1 : 0, ouverts[3] ? 1 : 0)
    gl.uniform4f(gl.getUniformLocation(this.progEcran, 'uGlace'), glaces[0] ? 1 : 0, glaces[1] ? 1 : 0, glaces[2] ? 1 : 0, glaces[3] ? 1 : 0)
    gl.uniform1f(gl.getUniformLocation(this.progEcran, 'uTemps'), temps % 1000)
    const palet = scene?.palet ?? null
    const cage = scene?.cage
    gl.uniform4f(gl.getUniformLocation(this.progEcran, 'uCage'), cage?.ligne ?? 0, cage?.profondeur ?? 0, cage?.demiOuverture ?? 0, cage?.demiFond ?? 0)
    gl.uniform1f(gl.getUniformLocation(this.progEcran, 'uCageEp'), cage?.epaisseur ?? 0)
    gl.uniform1f(gl.getUniformLocation(this.progEcran, 'uCoins'), scene?.coins ?? 0)
    gl.uniform3f(gl.getUniformLocation(this.progEcran, 'uAnneau'), scene?.anneau?.x ?? 0, scene?.anneau?.y ?? 0, scene?.anneau?.rayon ?? 0)
    gl.uniform3f(gl.getUniformLocation(this.progEcran, 'uMiseEnJeu'), scene?.miseEnJeu.decalage ?? 0, scene?.miseEnJeu.ecart ?? 0, scene?.miseEnJeu.rayon ?? 0)
    gl.uniform2f(gl.getUniformLocation(this.progEcran, 'uLignes'), scene?.lignes?.bleue ?? 430, scene?.lignes?.rond ?? 200)
    gl.uniform4f(gl.getUniformLocation(this.progEcran, 'uPalet'), palet?.x ?? 0, palet?.y ?? 0, palet?.rayon ?? 1, palet ? 1 : 0)
    gl.uniform2f(gl.getUniformLocation(this.progEcran, 'uPaletV'), palet?.vx ?? 0, palet?.vy ?? 0)
    const e = this.eclats
    e.fill(0)
    for (let k = 0; k < Math.min(ECLATS_MAX, eclats.length); k++) {
      e[k * 4] = eclats[k].x
      e[k * 4 + 1] = eclats[k].y
      e[k * 4 + 2] = eclats[k].age
      e[k * 4 + 3] = eclats[k].force
    }
    gl.uniform4fv(gl.getUniformLocation(this.progEcran, 'uEclats'), e)
    gl.uniform4fv(gl.getUniformLocation(this.progEcran, 'uCoeurs'), coeurs)
    gl.uniform4fv(gl.getUniformLocation(this.progEcran, 'uRegards'), this.regards)
    const poteaux = this.poteaux
    poteaux.fill(0)
    for (let k = 0; k < Math.min(4, scene?.poteaux?.length ?? 0); k++) {
      const q = scene!.poteaux![k]
      poteaux[k * 3] = q.x
      poteaux[k * 3 + 1] = q.y
      poteaux[k * 3 + 2] = q.rayon
    }
    gl.uniform3fv(gl.getUniformLocation(this.progEcran, 'uPoteaux'), poteaux)
    gl.uniform4f(gl.getUniformLocation(this.progEcran, 'uPorteur'), scene?.porteur ?? -1, scene?.charge ?? 0, scene?.viseeX ?? 0, scene?.viseeY ?? 0)
    gl.uniform1f(gl.getUniformLocation(this.progEcran, 'uTraitPorteur'), scene?.traitPorteur === false ? 0 : 1)
    gl.bindVertexArray(this.vaoVide)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindVertexArray(null)
  }

  /** Rend la mémoire graphique : l'écran se ferme. */
  libere(): void {
    const gl = this.gl
    gl.deleteProgram(this.progChamp)
    gl.deleteProgram(this.progEcran)
    gl.deleteBuffer(this.tampon)
    gl.deleteVertexArray(this.vao)
    gl.deleteVertexArray(this.vaoVide)
    gl.deleteFramebuffer(this.cible)
    gl.deleteTexture(this.texture)
    gl.deleteTexture(this.texStade)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
