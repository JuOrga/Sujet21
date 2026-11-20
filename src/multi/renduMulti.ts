// LE RENDU DU MULTI — deux volumes, deux couleurs, et rien d'autre.
//
// Le moteur de rendu du jeu (render/renderer.ts) dessine UN corps, sa
// lumière, sa coque, ses décors : lui apprendre une couleur par joueur,
// c'était le modifier, et il est partagé avec le jeu solo. Le multi a donc
// son propre petit rendu — même principe que pour le solveur. Il est plus
// DÉPOUILLÉ que le jeu, et c'est assumé pour un prototype : ce qu'on doit y
// lire, c'est QUI est QUOI.
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
import { ATTR_CORPS, ATTR_ORPHELINE, ATTR_PROPRIO, type Bornes, type Particules } from './trame'

/** Les couleurs des joueurs. Le bleu est celui du spécimen du jeu ; l'ambre
 *  s'en distingue aussi pour un œil daltonien (teinte ET clarté diffèrent). */
export const COULEURS_JOUEURS: readonly [number, number, number][] = [
  [0.39, 0.72, 0.9],
  [0.96, 0.66, 0.28],
  [0.25, 0.84, 0.61],
  [0.71, 0.55, 0.95],
]
export function couleurCss(j: number): string {
  const c = COULEURS_JOUEURS[j % COULEURS_JOUEURS.length]
  return `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`
}

/** Le rayon d'une tache, en unités monde : quatre pas de particule. Au
 *  cœur d'un corps une cinquantaine de taches se recouvrent (le champ y
 *  vaut ~14) et le bord est tenu par beaucoup de particules à la fois : il
 *  est LISSE. Essayé d'abord à 14,5 u avec un seuil de 0,6 : le contour
 *  suivait chaque particule du bord, et à l'échelle de la salle (un pas de
 *  particule ≈ 3 pixels) cela se lisait comme du bruit. */
const RAYON_TACHE = 26
/** Le seuil du champ : dessous, le vide ; dessus, l'eau. À ~14 au cœur et
 *  ~7 sur un bord droit, 3 pose le contour juste au ras des particules. */
const SEUIL = 3
/** Une GOUTTE LIBRE pèse plus lourd dans le champ : seule, sa tache
 *  culmine à 1 et ne passerait jamais le seuil — on ne verrait ni le jet,
 *  ni ce qu'il reste à ramasser. À 4, elle se dessine en point d'environ
 *  8 u de rayon. */
const POIDS_GOUTTE = 4

/** Ce que le hockey ajoute à l'image : le palet et les cages. */
export interface SceneHockey {
  /** La hauteur de l'ouverture des cages. */
  cage: number
  palet: { x: number; y: number; rayon: number; vx: number; vy: number } | null
  /** Le joueur qui tient le palet (−1 : personne), sa charge (0 à 1) et le
   *  point qu'il vise : le lancer partira vers là. */
  porteur: number
  charge: number
  viseeX: number
  viseeY: number
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
uniform vec2 uCentre;
uniform vec2 uDemi;
uniform vec4 uSalle;      // minX, minY, maxX, maxY
uniform vec3 uCouleurs[4];
uniform float uSeuil;
uniform float uGain;      // le champ est stocké divisé par ce gain (texture 8 bits)
uniform float uPixel;     // la taille d'un pixel, en unités monde
uniform vec4 uOuvert;     // 1 si le joueur de ce canal est OUVERT
uniform float uTemps;     // secondes, pour le souffle d'un corps ouvert
uniform float uCage;      // hockey : la hauteur de l'ouverture des cages (0 : pas de cage)
uniform vec4 uPalet;      // hockey : x, y, rayon, 1 s'il est en jeu
uniform vec4 uPorteur;    // hockey : qui le tient (−1 : personne), sa charge, sa visée (x, y)
uniform vec2 uPaletV;     // hockey : la vitesse du palet (sa traînée)
uniform vec4 uEclats[4];  // les chocs en cours : x, y, âge (s), force (0 : aucun)
out vec4 o;

float grille(vec2 m, float pas) {
  vec2 g = abs(fract(m / pas - 0.5) - 0.5) * pas;
  return 1.0 - smoothstep(0.0, uPixel * 1.5, min(g.x, g.y));
}

void main() {
  // le monde a son axe y vers le bas, la texture vers le haut
  vec2 monde = uCentre + vec2(vUv.x * 2.0 - 1.0, 1.0 - vUv.y * 2.0) * uDemi;

  // ---- le fond : la nuit du jeu, un quadrillage pour LIRE le mouvement
  // (dans une salle vide, sans repère, un corps qui dérive semble immobile)
  vec3 fond = vec3(0.012, 0.027, 0.063);
  vec2 dedans = step(uSalle.xy, monde) * step(monde, uSalle.zw);
  float salle = dedans.x * dedans.y;
  fond += salle * vec3(0.012, 0.022, 0.034);
  fond += salle * grille(monde, 240.0) * vec3(0.022, 0.036, 0.05);
  fond += salle * grille(monde, 960.0) * vec3(0.03, 0.05, 0.068);
  // la paroi : un trait clair, et un halo vers l'intérieur
  vec2 dMur = min(monde - uSalle.xy, uSalle.zw - monde);
  float mur = min(dMur.x, dMur.y);
  float trait = 1.0 - smoothstep(0.0, max(6.0, uPixel * 2.0), abs(mur));
  // ---- le hockey : les cages. La paroi s'ouvre sur un tiers de sa hauteur ;
  // chaque cage porte la couleur de celui qui la GARDE.
  float milieuY = (uSalle.y + uSalle.w) * 0.5;
  float dansLAxe = uCage > 0.0 ? 1.0 - smoothstep(uCage * 0.5 - uPixel, uCage * 0.5 + uPixel, abs(monde.y - milieuY)) : 0.0;
  float surUnCote = step(dMur.x, dMur.y);
  trait *= 1.0 - dansLAxe * surUnCote;
  fond += trait * vec3(0.38, 0.55, 0.68);
  fond += salle * exp(-max(mur, 0.0) / 90.0) * vec3(0.03, 0.055, 0.075);
  if (uCage > 0.0) {
    float aGauche = step(monde.x, (uSalle.x + uSalle.z) * 0.5);
    vec3 camp = mix(uCouleurs[1], uCouleurs[0], aGauche);
    // le filet, derrière la ligne
    float derriere = -dMur.x;
    float filet = dansLAxe * step(0.0, derriere) * (1.0 - smoothstep(52.0, 60.0, derriere));
    fond += filet * camp * (0.16 + 0.22 * grille(monde, 20.0));
    // les poteaux
    vec2 poteau = vec2(dMur.x, abs(abs(monde.y - milieuY) - uCage * 0.5));
    fond += (1.0 - smoothstep(9.0, 9.0 + uPixel * 2.0, length(poteau))) * camp;
    // la zone du gardien, et la ligne du milieu : des repères, pas des murs
    float zone = length(vec2(dMur.x, monde.y - milieuY));
    fond += salle * camp * 0.05 * (1.0 - smoothstep(uCage * 0.5 - 4.0, uCage * 0.5, zone));
    fond += salle * camp * 0.22 * (1.0 - smoothstep(0.0, uPixel * 2.0, abs(zone - uCage * 0.5)));
    float axe = abs(monde.x - (uSalle.x + uSalle.z) * 0.5);
    fond += salle * vec3(0.05, 0.08, 0.1) * (1.0 - smoothstep(0.0, uPixel * 2.0, axe));
  }

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
  // l'épaisseur : le cœur est plus dense, le bord plus clair (le ménisque)
  float coeur = clamp((total - uSeuil) / 9.0, 0.0, 1.0);
  float menisque = 1.0 - smoothstep(uSeuil, uSeuil + 3.5, total);
  // un faux relief : la pente du champ, ramenée à l'unité monde (elle ne
  // dépend plus du zoom), sert de normale — le bord se bombe, le cœur est plat
  vec2 pente = vec2(dFdx(total), dFdy(total)) / uPixel;
  vec3 n = normalize(vec3(-pente * 2.6, 1.0));
  vec3 lampe = normalize(vec3(-0.5, 0.62, 0.6));
  float jour = max(dot(n, lampe), 0.0);
  float eclat = pow(jour, 22.0);
  vec3 couleur = teinte * mix(0.5, 0.82, coeur) * mix(0.72, 1.12, jour);
  couleur += menisque * teinte * 0.22;
  couleur += eclat * 0.4;
  // OUVERT OU FERMÉ, lisible d'un coup d'œil. Un corps FERMÉ porte une peau :
  // un liseré sombre et net au bord, la cloison qu'on ne traverse pas. Un
  // corps OUVERT n'en a pas : son bord est clair et il respire.
  float peau = 1.0 - smoothstep(uSeuil, uSeuil + 1.3, total);
  couleur = mix(couleur, couleur * 0.3, peau * (1.0 - ouv) * 0.85);
  float souffle = 0.5 + 0.5 * sin(uTemps * 5.0);
  couleur += menisque * ouv * (0.22 + 0.3 * souffle);
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
      if (lv > 1.0) {
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
  private readonly eclats = new Float32Array(ECLATS_MAX * 4)
  private largeur = 0
  private hauteur = 0
  /** Le champ tient-il en demi-flottants ? Sinon huit bits, et le gain
   *  ramène la somme sous 1 (le relief s'y écrase un peu, la couleur tient). */
  private readonly flottant: boolean
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
    if (!vao || !vaoVide || !tampon || !cible || !texture) throw new Error('rendu du multi : mémoire graphique refusée')
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

  /** `ouverts[j]` : le joueur j est-il ouvert ? `temps` en secondes. */
  dessine(p: Particules, cadre: Cadre, salle: Bornes, ouverts: readonly boolean[] = [], temps = 0, scene: SceneHockey | null = null, eclats: readonly Eclat[] = []): void {
    const gl = this.gl
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
    gl.uniform2f(gl.getUniformLocation(this.progEcran, 'uCentre'), cadre.cx, cadre.cy)
    gl.uniform2f(gl.getUniformLocation(this.progEcran, 'uDemi'), cadre.demiL, cadre.demiH)
    gl.uniform4f(gl.getUniformLocation(this.progEcran, 'uSalle'), salle.minX, salle.minY, salle.maxX, salle.maxY)
    gl.uniform3fv(gl.getUniformLocation(this.progEcran, 'uCouleurs'), COULEURS_JOUEURS.flat())
    gl.uniform1f(gl.getUniformLocation(this.progEcran, 'uSeuil'), SEUIL)
    gl.uniform1f(gl.getUniformLocation(this.progEcran, 'uGain'), 1 / this.gain)
    gl.uniform1f(gl.getUniformLocation(this.progEcran, 'uPixel'), 1 / pixelsParUnite)
    gl.uniform4f(gl.getUniformLocation(this.progEcran, 'uOuvert'), ouverts[0] ? 1 : 0, ouverts[1] ? 1 : 0, ouverts[2] ? 1 : 0, ouverts[3] ? 1 : 0)
    gl.uniform1f(gl.getUniformLocation(this.progEcran, 'uTemps'), temps % 1000)
    const palet = scene?.palet ?? null
    gl.uniform1f(gl.getUniformLocation(this.progEcran, 'uCage'), scene ? scene.cage : 0)
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
    gl.uniform4f(gl.getUniformLocation(this.progEcran, 'uPorteur'), scene?.porteur ?? -1, scene?.charge ?? 0, scene?.viseeX ?? 0, scene?.viseeY ?? 0)
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
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
