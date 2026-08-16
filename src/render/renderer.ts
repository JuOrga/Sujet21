// Rendu métaballes en deux passes (§11) :
//   A. chaque particule est un splat gaussien additif dans un champ basse
//      résolution (R = champ, G = champ·vitesse, B = champ·appartenance) ;
//   B. seuillage du champ plein écran + trame de repère procédurale du décor.

import type { FluidSim } from '../sim/solver'
import { KIND_PLAYER } from '../sim/solver'
import type { SimParams } from '../sim/params'
import { LAMPE_HAUTEUR_DEFAUT, LAMPE_HAUTEUR_MAX, LAMPE_HAUTEUR_MIN, lampeCouleurRVB, zonePhases } from '../game/level'
import type { DecalDef, LumiereDef, ObstacleBox, ZoneDef } from '../game/level'
import { ARC_EPAISSEUR_DEFAUT, ARC_OUVERTURE_DEFAUT, FORME_ARC, FORME_COIN, FORME_RECT } from '../game/formes'
import type { Camera } from './camera'

// Budgets de rendu : au-delà, les éléments excédentaires ne sont plus
// dessinés (la physique, elle, les voit tous) — l'éditeur avertit quand un
// tableau les dépasse, et le sas reste toujours dessiné (il garde sa place
// dans le budget quoi qu'il arrive).
// Élargis pour les GRANDES CARTES (3-4 tableaux en une) : le court-circuit
// par boîte dans le shader (reachMax) fait que seules les 1-2 boîtes qui
// concernent un pixel se paient vraiment — le plafond peut monter sans que
// chaque pixel paie les 96.
export const MAX_BOXES = 96
export const MAX_ZONES = 16
// Lampes par tableau : au-delà, les excédentaires ne s'allument pas —
// l'éditeur avertit (même contrat que MAX_BOXES). La hauteur des blocs pour
// le calcul d'ombre est HAUTEUR_BLOCS (140 u), définie dans le shader.
export const MAX_LUMIERES = 4

const SPLAT_VS = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in float aSpeed;
layout(location = 2) in float aPlayer;
layout(location = 3) in vec2 aVel; // direction × étirement (0..~1.2)
layout(location = 4) in float aState; // givre (+0..1) ou vapeur (-0..1)
uniform vec2 uCenter;
uniform vec2 uViewport; // px CSS
uniform float uZoom;    // px CSS / unité monde
uniform float uPointSize; // px du framebuffer champ
out float vSpeed;
out float vPlayer;
out vec2 vDir;
out float vStretch;
out float vState;
void main() {
  vec2 clip = (aPos - uCenter) * uZoom / (uViewport * 0.5);
  gl_Position = vec4(clip, 0.0, 1.0);
  float gas = clamp(-aState, 0.0, 1.0);
  float s = length(aVel) * (1.0 - gas); // la vapeur ne file pas en traînées
  // Le sprite est agrandi pour contenir l'ellipse étirée dans le sens du
  // mouvement — les gouttes rapides deviennent des traînées liquides.
  // Les gouttes libres sont plus fines que le corps : des gouttelettes,
  // pas des boules. La vapeur, elle, est plus large et plus diffuse.
  gl_PointSize = uPointSize * (1.0 + s) * mix(0.6, 1.0, aPlayer) * (1.0 + 0.9 * gas);
  vSpeed = aSpeed;
  vPlayer = aPlayer;
  vDir = s > 1e-4 ? aVel / s : vec2(1.0, 0.0);
  vStretch = s;
  vState = aState;
}`

const SPLAT_FS = `#version 300 es
precision highp float;
in float vSpeed;
in float vPlayer;
in vec2 vDir;
in float vStretch;
in float vState;
uniform float uFieldScale;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  // Ellipse alignée sur la vitesse : composante parallèle gardée (le sprite
  // agrandi l'étire), perpendiculaire re-normalisée. gl_PointCoord a l'axe y
  // inversé par rapport au monde.
  vec2 dir = vec2(vDir.x, -vDir.y);
  float dpar = dot(d, dir);
  vec2 dperp = d - dpar * dir;
  vec2 e = dir * dpar + dperp * (1.0 + vStretch);
  float r2 = dot(e, e);
  if (r2 > 1.0) discard;
  float t = 1.0 - r2;
  // Amplitude compensée : l'aire de l'ellipse a grandi de (1 + s).
  // MAIS pas pour les gouttes LIBRES : une goutte isolée culmine à 1,0 de
  // champ — compensée à pleine vitesse elle tombait à 0,45, SOUS le seuil
  // de 0,8, et n'était JAMAIS dessinée. Le joueur payait un carburant que
  // l'image ne montrait pas (« aucune goutte ne sort, mais la vie baisse »).
  // Les libres gardent leur encre (compensation douce) et brillent un peu
  // plus : chaque goutte qui part se VOIT partir, en traînée liquide.
  float gas = clamp(-vState, 0.0, 1.0);
  float comp = 1.0 + vStretch * mix(0.25, 1.0, vPlayer);
  float f = t * t * uFieldScale * mix(1.6, 1.0, vPlayer) / comp * (1.0 - 0.25 * gas);
  // Alpha : champ pondéré par l'état — givre en positif, vapeur en négatif.
  // La composition retrouve la part de chaque état en divisant par le champ
  // total (canal R) ; les zones mixtes se neutralisent en douceur.
  outColor = vec4(f, f * vSpeed, f * vPlayer, f * vState);
}`

const COMPOSE_VS = `#version 300 es
void main() {
  vec2 pos = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0))[gl_VertexID];
  gl_Position = vec4(pos, 0.0, 1.0);
}`

// ---- Formes d'obstacle, côté GPU (le miroir GLSL de src/game/formes.ts) ----
// La forme et ses paramètres voyagent EMPAQUETÉS dans le slot matériau
// (uBoxAux.x) : code = mat + 16·forme + 128·q0 + 16384·q1 — des entiers
// exacts en float32, zéro uniforme de plus (le budget mobile est déjà plein).
// q0 : orientation du coin (0..3) ou épaisseur d'arc ×100 ; q1 : demi-
// ouverture d'arc en degrés.
const FORMES_GLSL = `
vec4 decodeAux(float code) { // (matériau, forme, q0, q1)
  float q1 = floor(code / 16384.0);
  code -= q1 * 16384.0;
  float q0 = floor(code / 128.0);
  code -= q0 * 128.0;
  float forme = floor(code / 16.0);
  return vec4(code - forme * 16.0, forme, q0, q1);
}

// distance signée à une forme (négatif dedans), dans le repère LOCAL de la
// boîte (déjà dépivotée) — les mêmes formules que formes.ts, à l'identique
float formeSdf(vec2 w, vec4 b, float forme, float q0, float q1) {
  vec2 c = (b.xy + b.zw) * 0.5;
  vec2 half_ = max((b.zw - b.xy) * 0.5, vec2(1e-6));
  vec2 p = w - c;
  if (forme < 0.5) { // rectangle
    vec2 q = abs(p) - half_;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  }
  if (forme < 1.5) { // disque : ellipse inscrite (SDF approché, cercle exact)
    float k0 = length(p / half_);
    if (k0 < 1e-6) return -min(half_.x, half_.y);
    float k1 = length(p / (half_ * half_));
    return k0 * (k0 - 1.0) / k1;
  }
  if (forme < 2.5) { // capsule : segment sur le grand axe, bouts ronds
    float r = min(half_.x, half_.y);
    vec2 a = max(half_ - vec2(r), 0.0);
    return length(p - clamp(p, -a, a)) - r;
  }
  if (forme < 3.5) { // coin : la moitié triangulaire de la boîte (q0 = 0..3)
    vec2 A; vec2 B; vec2 C;
    if (q0 < 0.5)      { A = vec2(-half_.x, -half_.y); B = vec2( half_.x, -half_.y); C = vec2(-half_.x,  half_.y); }
    else if (q0 < 1.5) { A = vec2( half_.x, -half_.y); B = vec2( half_.x,  half_.y); C = vec2(-half_.x, -half_.y); }
    else if (q0 < 2.5) { A = vec2( half_.x,  half_.y); B = vec2(-half_.x,  half_.y); C = vec2( half_.x, -half_.y); }
    else               { A = vec2(-half_.x,  half_.y); B = vec2(-half_.x, -half_.y); C = vec2( half_.x,  half_.y); }
    vec2 e0 = B - A; vec2 v0 = p - A;
    vec2 e1 = C - B; vec2 v1 = p - B;
    vec2 e2 = A - C; vec2 v2 = p - C;
    vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
    vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
    vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
    float s = sign(e0.x * e2.y - e0.y * e2.x);
    vec2 dd = min(min(vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
                      vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
                      vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
    return -sqrt(dd.x) * sign(dd.y);
  }
  // arc d'anneau aux bouts ronds : rayon = le petit demi-côté, épaisseur
  // q0/100, demi-ouverture q1 (°) autour de +x — à épaisseur 1 : camembert
  float R = min(half_.x, half_.y);
  float ep = clamp(q0 / 100.0, 0.08, 1.0);
  float rm = R * (1.0 - ep * 0.5);
  float ht = R * ep * 0.5;
  float ouv = radians(q1);
  float th = atan(p.y, p.x);
  if (abs(th) <= ouv) return abs(length(p) - rm) - ht;
  vec2 e = rm * vec2(cos(ouv), sin(ouv) * sign(th));
  return length(p - e) - ht;
}`

const COMPOSE_FS = `#version 300 es
precision highp float;
#define MAX_BOXES 96
#define MAX_WAVES 8
#define MAX_ZONES 16
uniform sampler2D uField;
uniform vec2 uCanvasSize;  // px device
uniform float uDpr;
uniform vec2 uViewport;    // px CSS
uniform vec2 uCenter;
uniform float uZoom;
uniform float uThreshold;
uniform float uSoftness;
uniform float uFieldScale;
uniform vec2 uRoomCenter;
uniform vec2 uRoomHalf;
uniform int uBoxCount;
uniform vec4 uBoxes[MAX_BOXES];   // minX, minY, maxX, maxY
// x : matériau (0 mur, 1 hydrophile, 2 hydrophobe, 3 sas…) ; y : rotation
// (radians) autour du centre — 0 : boîte droite ; z : charge (surchauffeur :
// 1 plein, 0 déchargé) ; w : portée d'aura propre (chaudière, 1 = banc).
// Empaquetés par boîte pour tenir dans le budget des GPU mobiles.
uniform vec4 uBoxAux[MAX_BOXES];
uniform float uTime;
uniform float uExitRadius; // portée de l'aspiration du sas (halo de courant)
uniform float uColdBand;   // portée de l'aura de gel des plaques froides
uniform float uHeatBand;   // portée de l'aura de chaleur des radiateurs
uniform float uHydroBand;  // portée de la chimie des surfaces (hydrophile/phobe)
uniform float uChill;      // refroidissement du vaisseau (0 tiède, 1 glacial)
// Décor procédural : 1 riche (défaut), 0 sobre. Le mode sobre débranche le
// bruit DÉCORATIF (vie du vaisseau, caustiques, brumes texturées, volutes)
// en gardant tout ce qui se lit : corps d'eau, auras à intensité constante,
// lisières de zones. C'est l'instrument de mesure du coût GPU du décor —
// et un réglage de secours pour les machines modestes.
uniform float uDecor;
// Rendu du LIQUIDE : 1 riche (défaut), 0 sobre. Le sobre débranche tout
// l'éclairage de l'eau — relief (4 prélèvements de champ), spéculaire,
// miroir vivant, scintillement — en gardant la silhouette, les couleurs de
// vitesse et les teintes d'état (givre, vapeur). Deuxième instrument A/B :
// il isole le coût du liquide lui-même, indépendamment du décor.
uniform float uEau;
uniform int uWaveCount;
uniform vec4 uWaves[MAX_WAVES]; // x, y, instant de départ, amplitude
// Zones d'état : régions qui IMPOSENT un état. Elles doivent se voir de loin
// — c'est une règle du tableau, pas une décoration.
uniform int uZoneCount;
uniform vec4 uZones[MAX_ZONES];    // minX, minY, maxX, maxY
// phases d'ondulation de la lisière — calculées CPU par la MÊME fonction que
// la mécanique (zonePhases) : ce qu'on voit est exactement ce qu'on subit
uniform vec3 uZonePhase[MAX_ZONES];
uniform float uZoneForce[MAX_ZONES]; // 1 eau, 2 glace, 3 vapeur, 0 libre
// Textures d'habillage (chargées en arrière-plan ; uHas* passe à 1 quand
// prêtes — d'ici là, le décor procédural fait l'intérim)
uniform sampler2D uTexStars;
uniform sampler2D uTexStarsFar; // lointain orbital : la station à la dérive
uniform sampler2D uTexTank; // fond de cuve : panneaux, conduites, liserés
uniform sampler2D uTexWall;
uniform sampler2D uTexWallA; // seconde paroi : les murs alternent, sans répétition visible
uniform sampler2D uTexFroid;
uniform sampler2D uTexChaud;
uniform sampler2D uTexGrille;
uniform sampler2D uTexPhobe;
uniform sampler2D uTexPhile;
uniform sampler2D uTexIris;
// atlas des habillages de parois : 8 tuiles de 1024 px en grille 4×2
// (caissons, conduites, poutrelle, blindage, aération, hublot, écrans,
// câbles — les assets du joueur) ; le procédural reste le secours
uniform sampler2D uTexParoi;
uniform float uHasParoi;
uniform float uHasStars;
uniform float uHasStarsFar;
uniform float uHasTank;
uniform float uHasWall;
uniform float uHasWallA;
uniform float uHasFroid;
uniform float uHasChaud;
uniform float uHasGrille;
uniform float uHasPhobe;
uniform float uHasPhile;
uniform float uHasIris;
uniform float uHasHull; // la passe coque texturée remplace la bande procédurale
// Images de zones : la CAUSE peinte (hublot fendu, conduite rompue, rampe de
// buses). Sans mipmaps : elles s'échantillonnent dans une branche non
// uniforme (l'intérieur de la zone), où les dérivées sont indéfinies.
// TABLEAU de textures (calques : 0 buses/eau, 1 hublot/glace, 2 conduite/
// vapeur) : une seule unité au lieu de trois — les 16 unités garanties
// étaient toutes prises, la carte de lumière avait besoin de la place.
uniform mediump sampler2DArray uTexZones;
uniform vec3 uHasZones; // x buses (eau), y hublot (glace), z conduite (vapeur)
// Éclairage de la pièce : carte de lumière PRÉCALCULÉE en espace monde
// (visibilité × retombée, recalculée au changement de décor seulement) —
// le coût par image se réduit à une lecture de texture. uLumiere la
// débranche entièrement (bouton PARAMÈTRES, comme uDecor/uEau).
uniform float uLumiere;
// Lumière GÉNÉRALE du tableau (réglée à l'éditeur) : la part d'éclat que la
// pièce garde là où aucune lampe ne porte. 0,52 = niveau historique ;
// 0 = noir total hors des lampes.
uniform float uAmbiante;
// RELIEF 2.5D : les parois ont une hauteur — leur sommet fuit le centre de
// la caméra (perspective), et la face latérale se révèle du côté qui
// regarde le centre. En se déplaçant, on « aperçoit » les flancs des
// éléments qu'on aborde. 0 : débranché. L'effet s'estompe au dézoom
// (caméra lointaine = vue orthographique — le plan large reste une carte).
uniform float uRelief;
// Éclairage du VOLUME (le corps d'eau, la glace, la vapeur) : 1 branché —
// le corps baigne dans la même carte de lumière que la pièce, les ombres
// portées le traversent, le reflet suit la lampe dominante. 0 : l'eau garde
// son éclairage fixe historique. Débranchable séparément de la pièce.
uniform float uLumiereEau;
#define MAX_LUMIERES 4
uniform int uLampeCount;
uniform vec4 uLampes[MAX_LUMIERES]; // x, y, hauteur, portée
uniform float uLampesInt[MAX_LUMIERES]; // intensité
uniform vec3 uLampesCol[MAX_LUMIERES]; // couleur
uniform vec2 uLightMapMin;     // coin bas-gauche de la carte (monde)
uniform vec2 uLightMapInvSize; // 1 / taille monde de la carte
uniform sampler2D uLightMap;
out vec4 outColor;

float gridLine(vec2 world, float spacing, float widthWorld) {
  vec2 g = abs(fract(world / spacing) - 0.5) * spacing;
  float d = min(g.x, g.y);
  return 1.0 - smoothstep(0.0, widthWorld, d);
}

float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.5);
  return fract(p.x * p.y);
}

// Bruit de valeur lissé — la matière première du décor (nébulosité, textures)
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

// Bruit DÉCORATIF : en mode sobre il rend sa moyenne — la brume garde son
// intensité, elle perd sa texture. La branche est dynamiquement uniforme :
// le GPU saute réellement le calcul, c'est bien du coût en moins.
float dnoise(vec2 p) {
  return uDecor > 0.5 ? vnoise(p) : 0.5;
}

// Points épars (étoiles, poussières) : au plus un par cellule de grille,
// taille bornée en pixels pour ne pas scintiller au dézoom, et fondu global
// quand les cellules passent sous quelques pixels (sinon : neige quadrillée).
float specks(vec2 world, float cell, float density, float zoom) {
  float vis = smoothstep(4.0, 12.0, cell * zoom);
  if (vis <= 0.0) return 0.0;
  vec2 g = floor(world / cell);
  float h = hash21(g);
  if (h > density) return 0.0;
  vec2 center = (g + 0.5 + 0.7 * (vec2(hash21(g + 17.3), hash21(g + 39.7)) - 0.5)) * cell;
  float r = max(cell * (0.015 + 0.035 * hash21(g + 5.1)), 1.2 / zoom);
  float d = length(world - center);
  return smoothstep(r * 2.5, r * 0.5, d) * (0.4 + 0.6 * hash21(g + 8.9)) * vis;
}

// Champ doux sans réseau : somme de sinus modulés. Le bruit de valeur, à très
// basse fréquence, laisse voir son réseau carré (interpolation bilinéaire sur
// une grille entière) — d'où des PAVÉS de lumière à l'écran. Ceci n'en a pas.
float smoothField(vec2 p) {
  float a = sin(p.x + sin(p.y * 0.73) * 1.7);
  float b = sin(p.y * 0.87 + sin(p.x * 0.61) * 1.3);
  return 0.5 + 0.25 * (a + b);
}

// ---- La vie du vaisseau : veilleuses, dérive, respiration des machines ----
// Tout est procédural, calé sur le hash de la cellule : chaque veilleuse a sa
// place, sa période, sa phase et sa couleur. Le vaisseau doit avoir l'air
// ALIMENTÉ — quelque chose tourne encore derrière les parois — sans jamais
// disputer l'attention à l'échantillon.
vec3 shipLife(vec2 world, float zoom, float t) {
  vec3 acc = vec3(0.0);

  // 1. Veilleuses de paroi : une par cellule de 300 u, sur un quart d'entre
  //    elles. Les deux tiers clignotent lentement, le reste reste fixe.
  float cell = 300.0;
  float vis = smoothstep(2.5, 9.0, cell * zoom);
  if (vis > 0.0) {
    vec2 g = floor(world / cell);
    float h = hash21(g);
    // Sobriété (retour de test : « sapin de Noël ») : une veilleuse sur
    // SEPT cellules, pas une sur trois — des repères épars, pas une guirlande.
    if (h < 0.14) {
      vec2 c = (g + vec2(hash21(g + 3.1), hash21(g + 7.7))) * cell;
      float d = length(world - c);
      float r = max(3.4, 2.4 / zoom); // jamais sous-pixel : pas de scintillement
      float core = smoothstep(r, r * 0.2, d);
      // Halo à SUPPORT COMPACT : il atteint zéro avant la frontière de sa
      // cellule. Une décroissance exponentielle, elle, valait encore ~10 % au
      // bord — et se faisait trancher net : les lumières paraissaient cubiques.
      float reach = min(cell * 0.42, r * 16.0);
      float halo = pow(max(0.0, 1.0 - d / reach), 2.5) * 0.42;
      float per = 1.8 + 5.5 * hash21(g + 11.3);
      float ph = hash21(g + 19.1) * per;
      float blink = hash21(g + 23.7) < 0.66
        ? 0.35 + 0.65 * pow(0.5 + 0.5 * sin((t + ph) * 6.2831 / per), 2.0)
        : 0.85;
      float ch = hash21(g + 31.3);
      // Palette assagie : le turquoise discret domine largement, l'ambre est
      // rare, le rouge exceptionnel (une alarme oubliée doit rester un
      // ÉVÉNEMENT) — et le gain global baisse : des veilleuses, pas des LED.
      vec3 tint = ch < 0.82 ? vec3(0.24, 0.78, 0.66)  // turquoise : nominal
                : ch < 0.96 ? vec3(0.90, 0.55, 0.20)  // ambre : en veille
                            : vec3(0.95, 0.24, 0.18); // rouge : une alarme oubliée
      acc += tint * (core * 0.60 + halo * 0.80) * blink * vis;
    }
  }

  // 2. Panneau qui bégaie : très rares cellules où la lumière stroboscope
  //    quelques dixièmes de seconde, puis se tait longtemps.
  float pcell = 900.0;
  vec2 pg = floor(world / pcell);
  if (hash21(pg + 41.7) < 0.14) {
    float period = 9.0 + 11.0 * hash21(pg + 47.3);
    float phase = fract((t + hash21(pg + 53.9) * period) / period);
    float burst = step(phase, 0.055) * step(0.6, fract(t * 21.0));
    vec2 pc = (pg + vec2(hash21(pg + 59.1), hash21(pg + 61.7))) * pcell;
    float pd = length(world - pc);
    // même règle : la lueur meurt avant le bord de sa cellule, sinon elle s'y
    // découpe au carré le temps de l'éclat
    float pr = pcell * 0.40;
    acc += vec3(0.55, 0.80, 1.00) * burst * pow(max(0.0, 1.0 - pd / pr), 2.0) * 0.34;
  }

  // 3. Poussières en dérive, deux profondeurs : les lentes au loin, les
  //    rapides près de l'œil — le volume de la cuve se sent.
  acc += vec3(0.10, 0.17, 0.22) * specks(world + vec2(t * 3.0, -t * 1.6), 150.0, 0.05, zoom) * 0.55;
  acc += vec3(0.14, 0.22, 0.28) * specks(world + vec2(-t * 12.0, t * 5.0), 60.0, 0.05, zoom) * 0.40;

  // 4. Respiration des machines : une houle lumineuse très lente, très large,
  //    qui parcourt les parois — le vaisseau inspire.
  float breath = 0.5 + 0.5 * sin(t * 0.33 + smoothField(world * 0.0016) * 6.2831);
  acc += vec3(0.014, 0.030, 0.042) * breath;

  return acc;
}

// Distance d'un point à un segment — sert aux fissures du hublot.
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

// ---- Le décor des zones : la CAUSE du régime imposé ----------------------
// Une zone n'impose pas un état par décret : il s'est passé quelque chose ici.
// Le hublot fendu laisse entrer le vide et tout gèle ; la conduite rompue
// noie la salle de vapeur ; la chambre pressurisée interdit tout changement
// de phase. On dessine la cause, le joueur en déduit la règle.
// hasTex : 1 quand l'image de la cause est peinte en fond — la géométrie
// STATIQUE du décor procédural s'efface (l'image la remplace), seuls les
// effets ANIMÉS restent : souffle glacé, panache, gouttes, voile.
vec3 zoneDecor(vec2 world, vec2 zc, vec2 zh, float force, float t, float hasTex) {
  vec3 acc = vec3(0.0);
  vec2 q = world - zc;
  float geo = 1.0 - hasTex;

  if (force > 1.5 && force < 2.5) {
    // GLACE — le hublot fendu. Un grand hublot en arrière-plan : cadre
    // métallique, verre sur le vide étoilé, fêlures depuis le point d'impact,
    // et le givre qui gagne depuis la monture.
    float R = min(zh.x, zh.y) * 0.66;
    float d = length(q);
    float glass = 1.0 - smoothstep(R * 0.94, R, d);

    // le vide au-delà de la vitre : plus noir que la cuve, et des étoiles
    acc -= vec3(0.045, 0.062, 0.082) * glass * geo;
    float star = specks(q * 1.7 + vec2(311.0, 57.0), 90.0, 0.07, 1.0);
    acc += vec3(0.55, 0.70, 0.92) * star * glass * 0.5 * geo;

    // la monture : un anneau large, métal froid
    float ring = (1.0 - smoothstep(R * 0.055, R * 0.10, abs(d - R * 0.97)));
    acc += vec3(0.30, 0.42, 0.54) * ring * 0.55 * geo;
    float bolt = 0.5 + 0.5 * sin(atan(q.y, q.x) * 14.0);
    acc += vec3(0.40, 0.54, 0.66) * ring * smoothstep(0.86, 1.0, bolt) * 0.5 * geo;

    // les fêlures : cinq éclats depuis un point d'impact décentré
    vec2 hit = vec2(R * 0.26, -R * 0.17);
    float crack = 0.0;
    for (int k = 0; k < 5; k++) {
      float a = float(k) * 1.2566 + 0.5;
      float len = R * (0.75 + 0.25 * hash21(vec2(float(k), 3.0)));
      vec2 e = hit + vec2(cos(a), sin(a)) * len;
      crack = max(crack, 1.0 - smoothstep(0.0, R * 0.018, segDist(q, hit, e)));
    }
    // une fêlure transversale, pour que le réseau ne soit pas une étoile
    crack = max(crack, 1.0 - smoothstep(0.0, R * 0.014,
      segDist(q, hit + vec2(-R * 0.5, R * 0.35), hit + vec2(R * 0.55, R * 0.62))));
    acc += vec3(0.78, 0.92, 1.00) * crack * glass * 0.55 * geo;

    // le givre : depuis la monture vers l'intérieur, en dentelle
    float rim = smoothstep(R * 0.45, R, d) * glass;
    float lace = 0.5 + 0.5 * vnoise(q * 0.12 + vec2(t * 0.02, -t * 0.015));
    acc += vec3(0.42, 0.62, 0.78) * rim * lace * 0.34 * geo;
    // souffle glacé qui s'échappe de l'impact
    float breath = (1.0 - smoothstep(0.0, R * 1.5, length(q - hit)));
    acc += vec3(0.20, 0.34, 0.46) * breath * breath *
      (0.5 + 0.5 * vnoise(q * 0.05 + vec2(-t * 0.22, t * 0.14))) * 0.30;
  } else if (force > 2.5) {
    // VAPEUR — la conduite rompue. Un gros collecteur traverse la salle ;
    // sa brèche crache un panache qui monte et se tord.
    float pipeR = min(zh.y * 0.34, 90.0);
    float floorY = -zh.y * 0.66; // sans image : le collecteur court au sol
    // avec l'image, le collecteur est peint au CENTRE de la zone : le tube
    // procédural s'efface et le panache part de la brèche de l'image
    floorY = mix(floorY, 0.0, hasTex);
    float pipe = 1.0 - smoothstep(pipeR * 0.86, pipeR, abs(q.y - floorY));
    acc += vec3(0.16, 0.19, 0.24) * pipe * 0.9 * geo;
    // brides régulières le long du tube
    float flange = smoothstep(0.90, 1.0, 0.5 + 0.5 * sin(q.x * 0.035));
    acc += vec3(0.26, 0.31, 0.38) * pipe * flange * 0.7 * geo;
    // la brèche, au centre du tube
    float breach = 1.0 - smoothstep(pipeR * 0.5, pipeR * 1.4, length(q - vec2(0.0, floorY)));
    acc -= vec3(0.05, 0.06, 0.08) * breach * geo;
    // le panache : il monte depuis la brèche et se disperse en hauteur
    vec2 pl = q - vec2(0.0, floorY);
    float up = clamp(pl.y / max(zh.y * 1.7, 1.0), 0.0, 1.0);
    float wide = 1.0 - smoothstep(pipeR * (0.6 + 3.0 * up), pipeR * (1.4 + 5.0 * up), abs(pl.x));
    float curl = 0.5 + 0.5 * vnoise(vec2(pl.x * 0.03, pl.y * 0.012 - t * 0.5));
    acc += vec3(0.46, 0.36, 0.58) * wide * curl * (1.0 - 0.75 * up) * 0.52 * step(0.0, pl.y);
  } else if (force > 0.5) {
    // EAU — la chambre pressurisée. Des rampes de buses au plafond, un voile
    // de condensation, des gouttes qui perlent : ici, rien ne bout ni ne gèle.
    float ceil_ = zh.y * 0.78;
    float rail = 1.0 - smoothstep(10.0, 16.0, abs(q.y - ceil_));
    acc += vec3(0.20, 0.28, 0.36) * rail * 0.8 * geo;
    float nozzle = smoothstep(0.86, 1.0, 0.5 + 0.5 * sin(q.x * 0.045));
    acc += vec3(0.30, 0.52, 0.66) * rail * nozzle * 0.9 * geo;
    // gouttes : elles descendent lentement sous chaque buse
    float col = sin(q.x * 0.045);
    float fall = fract((ceil_ - q.y) * 0.006 + t * 0.11 + hash21(vec2(floor(q.x * 0.0072), 1.0)));
    float drop = smoothstep(0.96, 1.0, 1.0 - fall) * smoothstep(0.86, 1.0, 0.5 + 0.5 * col);
    acc += vec3(0.30, 0.56, 0.74) * drop * 0.5 * step(0.0, ceil_ - q.y);
    // voile de condensation, dense en bas
    float mistY = 1.0 - smoothstep(-zh.y, zh.y * 0.4, q.y);
    acc += vec3(0.16, 0.30, 0.40) * mistY *
      (0.4 + 0.6 * vnoise(q * 0.02 + vec2(t * 0.05, 0.0))) * 0.16;
  }
  return acc;
}

// distance signée à une boîte (négatif à l'intérieur)
float boxSdf(vec2 world, vec4 b) {
  vec2 c = (b.xy + b.zw) * 0.5;
  vec2 half_ = (b.zw - b.xy) * 0.5;
  vec2 q = abs(world - c) - half_;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}
${FORMES_GLSL}

void main() {
  vec2 uv = gl_FragCoord.xy / uCanvasSize;
  vec4 tex = texture(uField, uv);

  float field = tex.r / uFieldScale;
  float speed = tex.g / max(tex.r, 1e-5);
  float player = tex.b / max(tex.r, 1e-5);
  float stateS = tex.a / max(tex.r, 1e-5); // givre en positif, vapeur en négatif
  float icy = clamp(stateS, 0.0, 1.0);
  float vap = clamp(-stateS, 0.0, 1.0);

  // Reconstruction monde (repère y vers le haut, cohérent avec la passe A)
  vec2 css = gl_FragCoord.xy / uDpr;
  vec2 world = uCenter + (css - uViewport * 0.5) / uZoom;

  // La cuve d'essai flotte dans le vide : le décor se scinde en deux mondes
  // de part et d'autre de la coque (roomD < 0 : intérieur).
  vec2 dr = abs(world - uRoomCenter) - uRoomHalf;
  float roomD = max(dr.x, dr.y);
  float inRoom = 1.0 - smoothstep(0.0, 6.0 / uZoom, roomD);

  // Dehors : nuit orbitale — texture générée si chargée (deux couches, la
  // lointaine en parallaxe : elle suit à moitié la caméra), sinon décor
  // procédural d'intérim.
  vec3 voidCol;
  if (uHasStars > 0.5) {
    // Atténuée : le vide doit rester plus sombre que la cuve éclairée,
    // sinon la hiérarchie lumineuse s'inverse et la scène se noie.
    // La couche lointaine (station à la dérive) suit à moitié la caméra et
    // s'échantillonne en miroir : sa répétition ne se lit pas dans le noir.
    vec3 far_ = uHasStarsFar > 0.5
      ? texture(uTexStarsFar, (world - uCenter * 0.62) / 5200.0).rgb * 1.35
      : texture(uTexStars, (world - uCenter * 0.55) / 3400.0).rgb;
    vec3 near_ = texture(uTexStars, world / 1500.0).rgb;
    voidCol = (far_ * 0.4 + near_ * 0.6) * 0.55;
  } else {
    voidCol = vec3(0.004, 0.007, 0.014);
    if (uDecor > 0.5) {
      float neb = vnoise(world * 0.0016 + vec2(3.7, 1.3));
      neb = neb * 0.6 + 0.4 * vnoise(world * 0.004 - vec2(1.1, 7.7));
      voidCol += vec3(0.010, 0.018, 0.038) * neb;
      voidCol += vec3(0.022, 0.010, 0.034) * vnoise(world * 0.0009 + 21.0);
      voidCol += vec3(0.50, 0.60, 0.75) * specks(world + uCenter * 0.5, 130.0, 0.10, uZoom) * 0.55;
      voidCol += vec3(0.75, 0.82, 0.95) * specks(world + 500.0, 200.0, 0.08, uZoom) * 0.85;
    }
  }

  // Dedans : fond de cuve, vignette, caustiques discrètes (la lumière du
  // labo joue dans l'eau de l'essai), trame de mesure, poussières en dérive.
  // Le fond texturé (panneaux, conduites, liserés) remplace l'aplat procédural
  // dès qu'il est chargé — échantillonné avec une légère parallaxe : la paroi
  // est DERRIÈRE l'eau, elle suit un peu la caméra et la profondeur se sent.
  vec2 nuv = uv * 2.0 - 1.0;
  float vign = 1.0 - 0.35 * dot(nuv, nuv);
  vec3 tankTex = texture(uTexTank, (world - uCenter * 0.10) / 900.0).rgb;
  vec3 tank = uHasTank > 0.5
    ? tankTex * (0.55 * vign + 0.12)
    : vec3(0.012, 0.022, 0.040) * vign;
  if (uDecor > 0.5) {
    float caus = vnoise(world * 0.012 + vec2(uTime * 0.05, -uTime * 0.03));
    caus *= vnoise(world * 0.03 - vec2(uTime * 0.02, uTime * 0.04));
    tank += vec3(0.010, 0.028, 0.040) * caus;
  }
  float lw = 1.2 / uZoom;
  float gridDim = uHasTank > 0.5 ? 0.5 : 1.0; // la texture a ses propres lignes
  tank += vec3(0.05, 0.09, 0.13) * gridLine(world, 100.0, lw) * 0.30 * gridDim;
  tank += vec3(0.07, 0.12, 0.17) * gridLine(world, 500.0, lw * 1.6) * 0.45 * gridDim;
  // halo le long des parois : la cuve est éclairée par sa coque
  tank += vec3(0.020, 0.045, 0.060) * exp(min(0.0, roomD) * 0.02);
  // Éclairage de la pièce : la carte précalculée (visibilité × retombée)
  // module le FOND — les ombres portées se couchent sur la cuve, les blocs
  // eux-mêmes restent éclairés (leur relief vient du biseau directionnel).
  // Appliqué AVANT la vie du vaisseau : les veilleuses sont des lumières,
  // elles n'ont pas à subir l'ombre de la lampe principale.
  // La direction de lumière dominante ICI (pour le biseau des arêtes) : la
  // somme des lampes, pondérée par intensité et retombée.
  vec2 lampeDir = vec2(0.0, 1.0);
  if (uLumiere > 0.5) {
    vec2 acc = vec2(0.0);
    for (int li = 0; li < MAX_LUMIERES; li++) {
      if (li >= uLampeCount) break;
      vec2 dl = uLampes[li].xy - world;
      float dn = max(length(dl), 1.0);
      float w = uLampesInt[li] * (1.0 - 0.55 * smoothstep(0.0, uLampes[li].w, dn));
      acc += (dl / dn) * w;
    }
    float an = length(acc);
    if (an > 1e-5) lampeDir = acc / an;
  }
  if (uLumiere > 0.5) {
    vec2 luv = (world - uLightMapMin) * uLightMapInvSize;
    // la carte est COLORÉE : chaque lampe y a versé sa teinte × visibilité
    vec3 lm = texture(uLightMap, clamp(luv, 0.0, 1.0)).rgb;
    tank *= uAmbiante + 0.95 * lm;
    // un léger surcroît dans les pleins feux — la teinte suit les lampes
    tank += lm * lm * 0.06;
    // la monture de chaque lampe : un point de sa couleur au plafond —
    // large et doux quand elle est haute, serré quand elle rase le sol
    for (int li = 0; li < MAX_LUMIERES; li++) {
      if (li >= uLampeCount) break;
      float dl = length(world - uLampes[li].xy);
      float rayon = 26.0 + uLampes[li].z * 0.05;
      float halo = pow(max(0.0, 1.0 - dl / rayon), 2.0);
      tank += (uLampesCol[li] * 0.5 + vec3(0.1, 0.09, 0.06)) * halo * 0.55 * uLampesInt[li];
    }
  }
  // la vie du vaisseau : veilleuses, poussières en dérive, respiration
  if (uDecor > 0.5) tank += shipLife(world, uZoom, uTime);

  vec3 col = mix(voidCol, tank, inRoom);

  // La coque : bande procédurale d'intérim — la passe texturée (dessinée
  // par-dessus quand l'image est chargée) la remplace.
  float hull = smoothstep(-1.0, 2.0, roomD) * (1.0 - smoothstep(20.0, 34.0, roomD));
  vec3 hullCol = vec3(0.055, 0.085, 0.115) * (0.85 + 0.15 * sin(roomD * 0.9));
  col = mix(col, hullCol, hull * (1.0 - uHasHull));
  float wallLine = 1.0 - smoothstep(0.0, 3.0 / uZoom, abs(roomD));
  col += vec3(0.10, 0.22, 0.30) * wallLine * (1.0 - 0.8 * uHasHull);

  // Zones d'état, sous les surfaces : un voile teinté qui emplit la région,
  // un liseré net à la frontière, et des chevrons lents qui balaient vers
  // l'intérieur — on voit qu'on entre dans un régime imposé, pas dans un décor.
  for (int zi = 0; zi < MAX_ZONES; zi++) {
    if (zi >= uZoneCount) break;
    float f = uZoneForce[zi];
    if (f < 0.5) continue; // zone libre : rien à signaler
    vec3 zc = f < 1.5 ? vec3(0.28, 0.62, 0.90)   // eau
            : f < 2.5 ? vec3(0.56, 0.80, 0.95)   // glace
                      : vec3(0.72, 0.56, 0.95);  // vapeur
    // Forme du rayon d'action : superellipse qui épouse le rectangle (coins
    // adoucis), ondulée par trois harmoniques (mêmes phases que la
    // mécanique). szn < 1 : dedans.
    vec2 zc2 = (uZones[zi].xy + uZones[zi].zw) * 0.5;
    vec2 zh2 = max((uZones[zi].zw - uZones[zi].xy) * 0.5, vec2(1e-6));
    vec2 nq = (world - zc2) / zh2;
    vec2 aq = abs(nq);
    float dz = pow(pow(aq.x, 8.0) + pow(aq.y, 8.0), 0.125);
    float thz = atan(nq.y, nq.x);
    vec3 phz = uZonePhase[zi];
    float wz = 0.955 + 0.02 * sin(3.0 * thz + phz.x) + 0.012 * sin(5.0 * thz + phz.y)
             + 0.008 * sin(8.0 * thz + phz.z);
    float szn = dz / wz;
    float inZone = 1.0 - step(1.0, szn);         // 1 dedans
    float assetA = 0.0; // alpha de l'illustration à ce fragment
    float hasZTex = f < 1.5 ? uHasZones.x : f < 2.5 ? uHasZones.y : uHasZones.z;
    // L'illustration de la cause N'EST PAS tronquée par la lisière : c'est
    // un objet (rampe, conduite, hublot), pas un gaz — elle se dessine
    // entière dans son cadre, même là où la brume ne va pas.
    if (hasZTex > 0.5) {
      float ta = f < 1.5 ? 1.5 : f < 2.5 ? 0.667 : 1.0; // largeur/hauteur des images
      vec2 zsz = zh2 * 2.0 * 0.94;
      float sc = min(zsz.x / ta, zsz.y);
      vec2 fit = vec2(ta, 1.0) * sc;
      vec2 tuv = (world - zc2) / fit + 0.5;
      if (tuv.x > 0.0 && tuv.x < 1.0 && tuv.y > 0.0 && tuv.y < 1.0) {
        // calque du tableau de zones : 0 buses (eau), 1 hublot, 2 conduite
        vec4 zt = texture(uTexZones, vec3(tuv, f - 1.0));
        col = mix(col, zt.rgb * vec3(0.68, 0.76, 0.86), zt.a * 0.92);
        assetA = zt.a;
      }
    }
    // les effets ANIMÉS du décor, allégés sur l'illustration : le panache et
    // les gouttes vivent autour de l'objet, ils ne le recouvrent pas
    if (szn < 1.0 && uDecor > 0.5) {
      col += zoneDecor(world, zc2, zh2, f, uTime, hasZTex) * (1.0 - 0.6 * assetA);
    }
    // Une BRUME d'accident, pas un contour : dense au foyer, teintée, elle
    // se dissout en lambeaux vers la lisière — le bruit déchire le bord au
    // lieu de le dessiner. Aucune ligne : une atmosphère qui s'échappe.
    float n1 = dnoise(world * 0.011 + vec2(uTime * 0.05, -uTime * 0.033) + zc2 * 0.003);
    float n2 = dnoise(world * 0.031 - vec2(uTime * 0.021, uTime * 0.037));
    float fog = 0.6 * n1 + 0.4 * n2;
    // le bord de la brume suit la forme, déchiqueté par le bruit (±0,13) —
    // les lambeaux meurent SUR la lisière mécanique, jamais au-delà
    float body = smoothstep(1.0, 0.5, szn + (fog - 0.5) * 0.26);
    // La glace givre en BLANC : du cyan sur une cuve cyan ne se voyait pas.
    // Sa brume est blanchie et nettement renforcée — les deux autres restent
    // dans leur teinte (le violet et le bleu contrastent déjà).
    vec3 fogCol = zc;
    float fogAmp = 1.0;
    if (f > 1.5 && f < 2.5) {
      fogCol = mix(zc, vec3(0.82, 0.93, 1.0), 0.6);
      fogAmp = 1.9;
    }
    // plus légère sur l'illustration : la cause reste lisible sous sa brume
    col += fogCol * body * (0.05 + 0.15 * fog) * fogAmp * (1.0 - 0.72 * assetA);
    // un souffle discret au ras de la lisière, en lambeaux lui aussi — la
    // limite se devine, elle ne se trace pas
    col += fogCol * exp(-abs(szn - 1.0) * 26.0) * 0.14 * fog * fog * fogAmp;
  }

  // Textures des matériaux : prélevées hors des branches (flux de contrôle
  // uniforme requis par les mipmaps), utilisées dans la boucle d'obstacles.
  // Les deux parois alternent selon un bruit très basse fréquence : les longs
  // murs cessent de répéter le même motif d'un bout à l'autre du tableau.
  vec3 texWallC = texture(uTexWall, world / 230.0).rgb;
  if (uHasWallA > 0.5) {
    vec3 wallA = texture(uTexWallA, world / 520.0).rgb;
    float blend = uDecor > 0.5 ? smoothstep(0.35, 0.65, smoothField(world * 0.0023 + 5.3)) : 0.5;
    texWallC = uHasWall > 0.5 ? mix(texWallC, wallA, blend) : wallA;
  }
  vec3 texPhobeC = texture(uTexPhobe, world / 170.0).rgb;
  vec3 texPhileC = texture(uTexPhile, world / 210.0).rgb;
  vec3 texFroidC = texture(uTexFroid, world / 460.0).rgb;
  vec3 texChaudC = texture(uTexChaud, world / 380.0).rgb;
  // la grille est calée pour que ses perforations fassent ~24 u, comme le
  // motif procédural qu'elle remplace
  vec3 texGrilleC = texture(uTexGrille, world / 624.0).rgb;

  // Obstacles : remplissage texturé + liseré, couleur par matériau (§6)
  float edgeW = 2.5 / uZoom;
  // relief : décalage du sommet des parois, proportionnel à l'écart au
  // centre (en écran), fondu sous le zoom de carte
  vec2 relDisp = (world - uCenter) * (uRelief * clamp(uZoom * 1.2, 0.0, 1.0));
  float drainEye = 0.0; // œil du sas, retenu pour assombrir l'eau qui y coule
  for (int bi = 0; bi < MAX_BOXES; bi++) {
    if (bi >= uBoxCount) break;
    // boîte oblique : le monde pivote dans le repère local de la boîte —
    // la distance signée (remplissage, arête, aura) suit la rotation
    vec2 wb = world;
    float bAng = uBoxAux[bi].y;
    if (abs(bAng) > 0.0005) {
      vec2 bc = 0.5 * (uBoxes[bi].xy + uBoxes[bi].zw);
      vec2 rel = world - bc;
      float bca = cos(bAng);
      float bsa = sin(bAng);
      wb = bc + vec2(bca * rel.x + bsa * rel.y, -bsa * rel.x + bca * rel.y);
    }
    float d = boxSdf(wb, uBoxes[bi]);
    vec4 dec = decodeAux(uBoxAux[bi].x);
    float mat = dec.x;
    // Court-circuit : au-delà de toute influence visuelle (ombre 56 u, arête,
    // aura selon le matériau), la boîte ne peut plus teinter ce pixel — on
    // saute remplissage, bruit et mélanges. Sur un tableau à 30-40 boîtes,
    // chaque pixel n'en paie plus que les 1-2 qui le concernent. Le SAS garde
    // son grand rayon d'aspiration : jamais coupé. Le rejet se fait sur la
    // BOÎTE englobante : toute forme y est inscrite, il reste conservateur.
    if (mat < 2.5 || mat > 3.5) {
      float reachMax = 56.0;
      if (mat > 0.5 && mat < 2.5) reachMax = max(reachMax, uHydroBand);
      else if (mat > 5.5 && mat < 6.5) reachMax = max(reachMax, uHeatBand * uBoxAux[bi].w);
      else if (mat > 3.5 && mat < 4.5) reachMax = max(reachMax, uColdBand);
      else if (mat > 8.5) reachMax = max(reachMax, 60.0);
      if (d > reachMax + edgeW + (uRelief > 0.0 ? length(relDisp) : 0.0)) continue;
    }
    // FORME de la pièce : la distance se raffine après le rejet grossier —
    // remplissage, arête, ombre et auras suivent la vraie silhouette
    if (dec.y > 0.5) d = formeSdf(wb, uBoxes[bi], dec.y, dec.z, dec.w);

    // ——— RELIEF 2.5D (murs, hydrophile, hydrophobe) ————————————————
    // dV / wbV : la géométrie du SOMMET (déplacé) — le remplissage et les
    // habillages la suivent. d reste LA BASE : ombres portées, auras et
    // physique y demeurent ancrées. Entre les deux : le FLANC, échantillonné
    // à deux hauteurs intermédiaires (les parois minces ne laissent pas de
    // trou quand le sommet glisse au-delà de leur épaisseur).
    float dV = d;
    vec2 wbV = wb;
    float flanc = 0.0;
    if (uRelief > 0.0 && mat < 2.5) {
      vec2 wT = world - relDisp;
      vec2 wbT = wT;
      float bAngR = uBoxAux[bi].y;
      float caR = 1.0;
      float saR = 0.0;
      vec2 bcR = vec2(0.0);
      if (abs(bAngR) > 0.0005) {
        bcR = 0.5 * (uBoxes[bi].xy + uBoxes[bi].zw);
        caR = cos(bAngR);
        saR = sin(bAngR);
        vec2 relT = wT - bcR;
        wbT = bcR + vec2(caR * relT.x + saR * relT.y, -saR * relT.x + caR * relT.y);
      }
      dV = dec.y > 0.5 ? formeSdf(wbT, uBoxes[bi], dec.y, dec.z, dec.w) : boxSdf(wbT, uBoxes[bi]);
      wbV = wbT;
      if (dV > 0.0) {
        if (d <= 0.0) {
          flanc = 1.0; // sur la base, sous le vide : pleine tranche
        } else {
          for (int fs = 1; fs <= 2; fs++) {
            vec2 wM = world - relDisp * (float(fs) / 3.0);
            vec2 wbM = wM;
            if (abs(bAngR) > 0.0005) {
              vec2 relM = wM - bcR;
              wbM = bcR + vec2(caR * relM.x + saR * relM.y, -saR * relM.x + caR * relM.y);
            }
            float dM = dec.y > 0.5 ? formeSdf(wbM, uBoxes[bi], dec.y, dec.z, dec.w) : boxSdf(wbM, uBoxes[bi]);
            flanc = max(flanc, 1.0 - smoothstep(-1.0, 1.5, dM));
          }
        }
      }
    }
    // Ombre portée douce autour de chaque solide (sauf le sas) : les blocs
    // se détachent du fond au lieu de flotter — la cuve prend de la
    // profondeur, les rectangles cessent d'être des aplats.
    if (mat < 2.5 || mat > 3.5) {
      float shade = 1.0 - smoothstep(0.0, 56.0, max(d, 0.0));
      col = mix(col, col * vec3(0.50, 0.56, 0.70), shade * shade * 0.5);
    }
    if (mat < 2.5) {
      float fill = 1.0 - smoothstep(-edgeW, 0.0, dV);
      float edge = 1.0 - smoothstep(0.0, edgeW, abs(dV));
      vec3 fillCol; vec3 edgeCol;
      if (mat < 0.5) {        // mur neutre : métal brossé — ou un HABILLAGE
        // (aux.z : 1 caissons, 2 conduites, 3 poutrelle, 4 blindage). Pur
        // décor : la physique reste celle d'une paroi neutre. Motifs dans le
        // repère LOCAL de la boîte (wb) : ils pivotent avec elle.
        float skin = uBoxAux[bi].z;
        edgeCol = vec3(0.30, 0.38, 0.46);
        if (skin > 0.5 && uHasParoi > 0.5) {
          // habillage TEXTURÉ : tuile (skin-1) de l'atlas, répétée dans le
          // repère local — les motifs pivotent avec la boîte. Les tuiles
          // étant elles-mêmes sans couture, le léger saignement de mip aux
          // bords se fond dans le motif.
          float si = skin - 1.0;
          vec2 tuile = vec2(mod(si, 4.0), floor(si / 4.0 + 0.001));
          // RACCORD : le motif se cale sur la BOÎTE, plus sur la grille du
          // monde (qui tranchait les caissons et hublots n'importe où).
          // Axe assez grand : un nombre ENTIER de tuiles, légèrement
          // étirées pour tomber JUSTE aux deux bords. Axe étroit : échelle
          // native, motif CENTRÉ — le rognage devient symétrique.
          vec2 bmin = uBoxes[bi].xy;
          vec2 bsize = max(uBoxes[bi].zw - bmin, vec2(1.0));
          vec2 rep = floor(bsize / 420.0 + 0.5);
          vec2 grand = step(1.0, rep);
          vec2 pas = mix(vec2(420.0), bsize / max(rep, vec2(1.0)), grand);
          vec2 origine = mix(bmin + 0.5 * bsize - 210.0, bmin, grand);
          vec2 uvp = (tuile + fract((wbV - origine) / pas)) * vec2(0.25, 0.5);
          // l'atlas est téléversé avec UNPACK_FLIP_Y : le V se lit depuis le
          // BAS — sans cette inversion, chaque habillage affichait la tuile
          // de l'AUTRE rangée (caissons devenait aération, écrans poutrelle…)
          uvp.y = 1.0 - uvp.y;
          fillCol = texture(uTexParoi, uvp).rgb * 0.92;
          edgeCol = vec3(0.32, 0.40, 0.48);
        } else if (skin > 3.5) {
          // BLINDAGE : plaque lourde mate, chevrons d'avertissement au bord
          float pl = 0.9 + 0.2 * dnoise(wbV * 0.05);
          fillCol = vec3(0.13, 0.15, 0.19) * pl;
          float bord = smoothstep(26.0, 12.0, -dV);
          float chev = smoothstep(0.55, 0.85, 0.5 + 0.5 * sin((wbV.x + wbV.y) * 0.28));
          fillCol = mix(fillCol, vec3(0.62, 0.52, 0.13), bord * chev * 0.5);
          edgeCol = vec3(0.55, 0.50, 0.26);
        } else if (skin > 2.5) {
          // POUTRELLE : âme métallique et croisillons rivetés
          float croix = min(abs(fract((wbV.x + wbV.y) * 0.014) - 0.5), abs(fract((wbV.x - wbV.y) * 0.014) - 0.5));
          float brace = 1.0 - smoothstep(0.05, 0.10, croix);
          float riv = smoothstep(0.90, 0.98, cos(wbV.x * 0.11) * cos(wbV.y * 0.11));
          fillCol = vec3(0.09, 0.11, 0.145) + vec3(0.07, 0.08, 0.10) * brace + vec3(0.12) * riv;
          edgeCol = vec3(0.36, 0.42, 0.50);
        } else if (skin > 1.5) {
          // CONDUITES : faisceau de tubes couchés, brides régulières
          float ph = fract(wbV.y / 46.0) - 0.5;
          float tube = sqrt(max(0.0, 1.0 - ph * ph * 4.0));
          float bride = smoothstep(0.92, 1.0, 0.5 + 0.5 * sin(wbV.x * 0.045));
          fillCol = vec3(0.10, 0.125, 0.16) * (0.55 + 0.65 * tube) + vec3(0.05, 0.06, 0.075) * bride;
          edgeCol = vec3(0.34, 0.42, 0.50);
        } else if (skin > 0.5) {
          // CAISSONS : panneaux empilés, joints sombres, teinte par caisson
          vec2 cel = floor(wbV / vec2(84.0, 56.0));
          vec2 cuvC = fract(wbV / vec2(84.0, 56.0));
          float joint = min(min(cuvC.x, 1.0 - cuvC.x), min(cuvC.y, 1.0 - cuvC.y));
          float bordC = smoothstep(0.02, 0.10, joint);
          float teinte = 0.85 + 0.3 * hash21(cel + 7.7);
          fillCol = vec3(0.105, 0.125, 0.155) * teinte * (0.55 + 0.45 * bordC);
          edgeCol = vec3(0.32, 0.39, 0.46);
        } else {
          fillCol = uHasWall > 0.5
            ? texWallC * 0.95
            : vec3(0.10, 0.13, 0.17) * (0.88 + 0.24 * dnoise(world * vec2(0.03, 0.30)));
        }
      } else if (mat < 1.5) { // hydrophile : mouillé, brillant, reflet qui glisse
        float sheen = 0.5 + 0.5 * sin(world.x * 0.045 + world.y * 0.10 + uTime * 0.7);
        fillCol = uHasPhile > 0.5
          ? texPhileC * (0.85 + 0.25 * sheen)
          : vec3(0.05, 0.16, 0.20) + vec3(0.015, 0.055, 0.065) * sheen;
        edgeCol = vec3(0.20, 0.65, 0.70);
      } else {                // hydrophobe : cireux, grain perlé qui repousse
        float wax = smoothstep(0.72, 0.95, dnoise(world * 0.12));
        fillCol = uHasPhobe > 0.5
          ? texPhobeC * 0.75
          : vec3(0.16, 0.11, 0.20) + vec3(0.07, 0.035, 0.10) * wax;
        edgeCol = vec3(0.62, 0.42, 0.78);
      }
      // LE FLANC : la tranche du mur, sombre et teintée matériau — c'est
      // elle qu'on « aperçoit » en se déplaçant, du côté qui regarde le
      // centre. Peinte sous le remplissage du sommet.
      vec3 flancCol = mix(vec3(0.045, 0.058, 0.075), edgeCol, 0.20);
      col = mix(col, flancCol, flanc * (1.0 - fill));
      col = mix(col, fillCol, fill);
      col = mix(col, edgeCol, edge * 0.9);
      if (mat > 0.5) {
        // L'aura dit la portée : une brume diffuse sur toute la bande
        // d'influence, sur le modèle de la chaleur du radiateur — turquoise
        // qui aspire (hydrophile), violette qui repousse (hydrophobe).
        // Atténuation LINÉAIRE : la brume emplit toute la bande au lieu de
        // s'écraser contre le mur — à n'importe quel zoom, le champ se voit
        float aura = (1.0 - smoothstep(0.0, uHydroBand, max(d, 0.0))) * step(0.0, d);
        float mist = 0.5 + 0.5 * dnoise(world * 0.045 + vec2(uTime * 0.10, -uTime * 0.07));
        vec3 auraCol = mat < 1.5 ? vec3(0.12, 0.42, 0.45) : vec3(0.38, 0.20, 0.52);
        col += auraCol * aura * (0.45 + 0.55 * mist);
      }
    } else if (mat > 8.5) {
      // SURCHAUFFEUR : serpentin cyan sous verre — la borne de recharge du
      // dash. Chargé (aux.z = 1), le serpentin pulse ; déchargé, il s'éteint
      // et le panneau redevient un mur gris — le manomètre est la lumière.
      float fill = 1.0 - smoothstep(-edgeW, 0.0, d);
      float edge = 1.0 - smoothstep(0.0, edgeW, abs(d));
      float charge = uBoxAux[bi].z;
      float coil = 0.5 + 0.5 * sin(world.x * 0.30 + sin(world.y * 0.24) * 2.2);
      float tube = smoothstep(0.55, 0.9, coil);
      float pulse = 0.7 + 0.3 * sin(uTime * 3.1 + world.y * 0.05);
      vec3 metal = vec3(0.10, 0.13, 0.17) * (0.9 + 0.2 * dnoise(world * 0.14));
      vec3 lueur = mix(vec3(0.16, 0.22, 0.26), vec3(0.16, 0.85, 1.0) * pulse, charge);
      col = mix(col, metal + lueur * tube * 0.85, fill);
      col = mix(col, mix(vec3(0.35, 0.44, 0.50), vec3(0.45, 0.95, 1.0), charge), edge * 0.9);
      // le halo dit « approchez en vapeur » : il meurt avec la charge
      float aura = (1.0 - smoothstep(0.0, 60.0, max(d, 0.0))) * step(0.0, d);
      col += vec3(0.05, 0.30, 0.36) * aura * aura * charge;
    } else if (mat > 7.5) {
      // Rideau lamellaire : lamelles souples bleu-glace qui ondulent — seule
      // la GLACE les écarte. Des fentes fines entre lamelles laissent deviner
      // le fond : c'est un rideau, pas un mur.
      float fill = 1.0 - smoothstep(-edgeW, 0.0, d);
      float edge = 1.0 - smoothstep(0.0, edgeW, abs(d));
      float sway = sin(world.y * 0.30 + uTime * 1.1 + world.x * 0.02) * 1.8;
      float lam = 0.5 + 0.5 * sin((world.y + sway) * 0.55);
      float fente = smoothstep(0.86, 0.97, lam);
      vec3 lamCol = vec3(0.34, 0.46, 0.60) * (0.72 + 0.38 * lam);
      col = mix(col, lamCol, fill * (1.0 - fente * 0.75));
      col = mix(col, vec3(0.70, 0.85, 0.98), edge * 0.85);
    } else if (mat > 6.5) {
      // Membrane gorgée d'eau : trame tissée vert d'eau qui suinte — seule
      // l'EAU la traverse. Des gouttes descendent le long de la trame.
      float fill = 1.0 - smoothstep(-edgeW, 0.0, d);
      float edge = 1.0 - smoothstep(0.0, edgeW, abs(d));
      float weave = 0.5 + 0.5 * sin(world.x * 0.42) * sin(world.y * 0.42);
      float drip = smoothstep(0.78, 1.0,
        0.5 + 0.5 * sin(world.y * 0.10 - uTime * 1.6 + dnoise(world * 0.05) * 6.0));
      vec3 memCol = vec3(0.05, 0.20, 0.17) + vec3(0.04, 0.15, 0.12) * weave;
      col = mix(col, memCol + vec3(0.03, 0.11, 0.09) * drip, fill);
      col = mix(col, vec3(0.25, 0.78, 0.62), edge * 0.9);
    } else if (mat > 5.5) {
      // Radiateur (tableau 4) : rayures chaudes qui défilent, arête incandes-
      // cente, et une aura de chaleur qui tremble — le danger (et la
      // ressource) se lit avant le contact, comme pour le froid.
      float fill = 1.0 - smoothstep(-edgeW, 0.0, d);
      float edge = 1.0 - smoothstep(0.0, edgeW, abs(d));
      float stripe = 0.5 + 0.5 * sin((world.x + world.y - uTime * 46.0) * 0.14);
      // Panneau à ailettes texturé quand l'image est là : les rayures animées
      // deviennent la CHALEUR qui court dessus, pas le panneau lui-même.
      // L'image est très sombre : sans ce réchauffement, le panneau se lit
      // comme du métal noir et perd son identité de SOURCE DE CHALEUR.
      vec3 fillCol = uHasChaud > 0.5
        ? texChaudC * vec3(2.3, 1.45, 0.95) + vec3(0.30, 0.11, 0.02) * smoothstep(0.4, 0.9, stripe)
        : vec3(0.26, 0.11, 0.05) + vec3(0.42, 0.17, 0.04) * smoothstep(0.35, 0.85, stripe);
      col = mix(col, fillCol, fill);
      col = mix(col, vec3(1.0, 0.56, 0.24), edge * 0.9);
      // chaque chaudière porte sa propre portée d'aura (aux.w) : le halo
      // dessiné est exactement la portée mécanique
      float aura = (1.0 - smoothstep(0.0, uHeatBand * max(uBoxAux[bi].w, 0.001), max(d, 0.0))) * step(0.0, d);
      float shimmer = 0.55 + 0.45 * dnoise(world * 0.06 + vec2(-uTime * 0.16, uTime * 0.24));
      col += vec3(0.36, 0.15, 0.04) * aura * aura * shimmer;
    } else if (mat > 4.5) {
      // Grille (tableau 3) : panneau perforé — le liquide s'y écrase, la
      // vapeur passe entre les mailles. Les trous laissent voir le fond.
      float fill = 1.0 - smoothstep(-edgeW, 0.0, d);
      float edge = 1.0 - smoothstep(0.0, edgeW, abs(d));
      // Panneau perforé texturé : les trous de l'image (quasi noirs) servent
      // eux-mêmes de masque — le fond se voit à travers, comme avant.
      float hole;
      vec3 barCol;
      if (uHasGrille > 0.5) {
        float lum = dot(texGrilleC, vec3(0.299, 0.587, 0.114));
        hole = 1.0 - smoothstep(0.020, 0.075, lum);
        barCol = texGrilleC * 1.5;
      } else {
        vec2 cellUv = fract(world / 24.0) - 0.5;
        hole = 1.0 - smoothstep(0.26, 0.34, max(abs(cellUv.x), abs(cellUv.y)));
        barCol = vec3(0.17, 0.21, 0.26) * (0.9 + 0.2 * dnoise(world * 0.15));
      }
      col = mix(col, barCol, fill * (1.0 - hole * 0.85));
      col = mix(col, vec3(0.45, 0.60, 0.70), edge * 0.8);
    } else if (mat > 3.5) {
      // Plaque froide (tableau 2) : givre cristallin, arête pâle, et une
      // aura de brume glacée — le danger se lit avant le contact.
      float fill = 1.0 - smoothstep(-edgeW, 0.0, d);
      float edge = 1.0 - smoothstep(0.0, edgeW, abs(d));
      float sparkle = smoothstep(0.72, 0.94, dnoise(world * 0.22));
      // Givre texturé quand l'image est là ; le scintillement procédural
      // reste par-dessus : le gel a l'air vivant, pas imprimé.
      // Teinte franchement bleue : brute, l'image tire vers le gris béton et
      // la plaque cesse de se lire comme du GEL au premier coup d'œil.
      vec3 fillCol = uHasFroid > 0.5
        ? texFroidC * vec3(0.52, 0.74, 1.02) * (0.60 + 0.28 * sparkle)
        : vec3(0.15, 0.21, 0.29) + vec3(0.26, 0.34, 0.40) * sparkle * 0.55;
      col = mix(col, fillCol, fill);
      col = mix(col, vec3(0.70, 0.86, 0.97), edge * 0.9);
      float aura = (1.0 - smoothstep(0.0, uColdBand, max(d, 0.0))) * step(0.0, d);
      float mist = 0.55 + 0.45 * dnoise(world * 0.05 + vec2(uTime * 0.10, -uTime * 0.06));
      col += vec3(0.14, 0.27, 0.40) * aura * aura * mist;
    } else {
      // Sas de sortie : une bouche d'aspiration — un trou dans lequel l'eau
      // s'engouffre. Gorge sombre, œil noir, anneau qui respire, et stries
      // spiralées qui matérialisent le courant jusqu'au rayon d'aspiration.
      vec2 c = (uBoxes[bi].xy + uBoxes[bi].zw) * 0.5;
      vec2 hb = (uBoxes[bi].zw - uBoxes[bi].xy) * 0.5;
      float rad = min(hb.x, hb.y);
      vec2 rel = world - c;
      float dh = length(rel);
      float ang = atan(rel.y, rel.x);
      float pulse = 0.75 + 0.25 * sin(uTime * 2.0);
      // halo de courant : stries qui convergent en spirale vers la bouche
      float reach = 1.0 - smoothstep(rad * 0.6, max(uExitRadius, rad), dh);
      float streaks = 0.5 + 0.5 * sin(ang * 5.0 - dh * 0.055 + uTime * 3.2);
      col += vec3(0.05, 0.28, 0.22) * streaks * reach * reach * 0.35;
      float eye = 1.0 - smoothstep(rad * 0.22, rad * 0.5, dh);
      drainEye = max(drainEye, eye);
      if (uHasIris > 0.5) {
        // Iris mécanique (image générée) : détouré au cercle du cadre — le
        // fond de l'image disparaît. Les lamelles internes tournent lentement,
        // le cadre reste fixe (la transition tombe sur l'anneau, invisible).
        float frameR = rad * 1.35;
        float rr = dh / frameR;
        float rot = (1.0 - smoothstep(0.40, 0.55, rr)) * uTime * 0.5;
        float cs = cos(rot);
        float sn = sin(rot);
        vec2 cuv = mat2(cs, -sn, sn, cs) * (rel / (2.0 * frameR));
        vec3 irisCol = texture(uTexIris, cuv + 0.5).rgb;
        // Détourage serré : le cadre touche le bord de l'image, on coupe juste
        // à l'intérieur pour que le fond brun ne déborde jamais.
        float aMask = 1.0 - smoothstep(0.435, 0.465, length(rel) / (2.0 * frameR));
        // assise : léger sombre sous le cadre pour le détacher de la paroi
        col = mix(col, vec3(0.004, 0.010, 0.012), (1.0 - smoothstep(rad * 0.8, frameR * 1.1, dh)) * 0.45);
        col = mix(col, irisCol, aMask);
        // l'anneau vert respire par-dessus l'image
        float ring = exp(-pow((dh - rad * 0.74) * 5.0 / rad, 2.0));
        col += vec3(0.10, 0.55, 0.40) * ring * pulse * 0.5;
      } else {
        // gorge de l'entonnoir : l'espace s'assombrit en tombant vers le trou
        float throat = 1.0 - smoothstep(0.0, rad, dh);
        col = mix(col, vec3(0.004, 0.010, 0.012), throat * 0.85);
        // œil du trou : noir profond
        col = mix(col, vec3(0.0, 0.002, 0.004), eye);
        // anneau lumineux qui respire au bord de la gorge
        float ring = exp(-pow((dh - rad * 0.55) * 6.0 / rad, 2.0));
        col += vec3(0.15, 0.75, 0.55) * ring * pulse * 0.8;
      }
    }
    // Relief d'éclairage : un biseau directionnel sur l'arête de chaque
    // solide — la face tournée vers la lampe s'éclaire, l'opposée plonge.
    // Le gradient du SDF vient des dérivées d'écran : gratuit, et il suit
    // n'importe quelle forme. (Le sas, une bouche, ne se biseaute pas.)
    if (uLumiere > 0.5 && (mat < 2.5 || mat > 3.5)) {
      vec2 gd = vec2(dFdx(d), dFdy(d));
      float gn = length(gd);
      if (gn > 1e-6) {
        float facing = dot(gd / gn, lampeDir);
        float bevel = 1.0 - smoothstep(0.0, 30.0, abs(d));
        col += col * (facing * bevel * 0.30);
      }
    }
  }

  // Ondes d'éjection : anneaux qui traversent le volume depuis le point
  // d'éjection. Elles gonflent légèrement le champ (la surface ondule) et
  // éclaircissent l'eau sur leur passage.
  float waveGlow = 0.0;
  for (int wi = 0; wi < MAX_WAVES; wi++) {
    if (wi >= uWaveCount) break;
    vec4 wv = uWaves[wi];
    float age = uTime - wv.z;
    if (age < 0.0 || age > 0.9) continue;
    float radius = age * 320.0;
    float dW = length(world - wv.xy);
    float ring = exp(-pow((dW - radius) / 15.0, 2.0));
    waveGlow += ring * exp(-age * 3.5) * wv.w;
  }

  // Eau : seuillage du champ (l'onde déforme la surface)
  float th = uThreshold;
  float s = max(th * uSoftness, 1e-4);
  // Fumée : bruit advecté à deux octaves — volutes internes et bords rongés.
  // La première octave FAÇONNE le nuage (mécanique lisible) : elle reste en
  // mode sobre ; seule la seconde, purement texturante, se débranche.
  // Calculée SEULEMENT là où il y a de la vapeur : ailleurs, elle ne pèse
  // dans aucun terme (tout est multiplié par vap).
  float smokeN = 0.5;
  if (vap > 0.001) {
    smokeN = vnoise(world * 0.045 + vec2(uTime * 0.22, -uTime * 0.15));
    smokeN = 0.62 * smokeN + 0.38 * dnoise(world * 0.11 - vec2(uTime * 0.31, -uTime * 0.24));
  }

  float field2 = field * (1.0 + 0.14 * waveGlow);
  // Les bords du nuage bouillonnent : le bruit ronge et gonfle la surface
  field2 *= 1.0 + vap * (smokeN - 0.5) * 1.1;
  float body = smoothstep(th - s, th + s, field2);
  // La fumée est trouée et translucide par endroits
  body *= 1.0 - vap * (0.2 + 0.4 * smokeN);

  // Tout l'habillage de l'eau ne se calcule que LÀ OÙ IL Y A DE L'EAU : le
  // liquide couvre une fraction de l'écran, le reste des pixels sortait déjà
  // avec body = 0 — mais payait quand même relief, miroir et teintes. La
  // branche est cohérente par blocs de pixels : le GPU la saute vraiment.
  if (body > 0.001) {
    float speedT = clamp(speed, 0.0, 1.0);
    vec3 slow = vec3(0.07, 0.30, 0.48);
    vec3 fast = vec3(0.55, 0.85, 0.95);
    vec3 water = mix(slow, fast, speedT);
    water = mix(water * 0.40, water, clamp(player, 0.0, 1.0)); // eau libre plus sombre

    // Relief : pseudo-normale sur un champ FLOUTÉ (4 prélèvements écartés) —
    // les dérivées par pixel liraient chaque particule comme une bille.
    // En liquide SOBRE, pas de relief : normale plate, éclairage constant —
    // les 4 prélèvements et les puissances du miroir sont économisés.
    // Éclairage du VOLUME : la lampe dominante du pixel donne la direction
    // du relief — l'eau et la pièce vivent dans la même lumière. La carte
    // (sans mipmaps) se lit aussi ici : pas de lumière, pas de reflet.
    vec3 lightDir = uLumiereEau > 0.5
      ? normalize(vec3(lampeDir * 0.62, 0.78))
      : normalize(vec3(-0.35, 0.55, 0.75));
    vec3 lmEau = vec3(1.0);
    vec3 lumSpec = vec3(1.0);
    if (uLumiereEau > 0.5) {
      vec2 luvEau = (world - uLightMapMin) * uLightMapInvSize;
      lmEau = texture(uLightMap, clamp(luvEau, 0.0, 1.0)).rgb;
      lumSpec = vec3(uAmbiante * 0.577) + 0.90 * lmEau;
    }
    vec3 nrm = vec3(0.0, 0.0, 1.0);
    float diffuse = 0.55;
    float specular = 0.0;
    if (uEau > 0.5) {
      vec2 texel = 2.5 / vec2(textureSize(uField, 0));
      float fL = texture(uField, uv - vec2(texel.x, 0.0)).r;
      float fR = texture(uField, uv + vec2(texel.x, 0.0)).r;
      float fB = texture(uField, uv - vec2(0.0, texel.y)).r;
      float fT = texture(uField, uv + vec2(0.0, texel.y)).r;
      vec2 grad = vec2(fR - fL, fT - fB) / uFieldScale;
      nrm = normalize(vec3(-grad * 2.2, 1.0));
      diffuse = max(dot(nrm, lightDir), 0.0);
      specular = pow(max(reflect(-lightDir, nrm).z, 0.0), 12.0);
    }

    // Cœur plus dense légèrement plus sombre, liseré plus clair
    float core = smoothstep(th * 1.8, th * 3.2, field2);
    water = mix(water, water * 0.75, core * 0.5);
    float rim = body * (1.0 - smoothstep(th + s, th * 1.9, field2));
    water += vec3(0.20, 0.45, 0.55) * rim * 0.55 * (1.0 - vap);

    // Le relief n'éclaire que la zone de surface : à l'intérieur, les
    // fluctuations de densité ne sont pas du relief — sans ce masque, l'eau
    // se couvre de reflets granuleux qui trahissent les particules.
    float surfaceZone = body * (1.0 - smoothstep(th * 1.4, th * 2.6, field2));
    if (uEau > 0.5) {
      // Scintillement interne discret : l'eau vit même au repos
      float shimmer = sin(world.x * 0.11 + uTime * 1.6) * sin(world.y * 0.09 - uTime * 1.2);
      water *= 1.0 + 0.05 * shimmer * core;
      water = mix(water, water * (0.55 + 0.75 * diffuse), surfaceZone * 0.55);
      water += vec3(0.85, 0.95, 1.0) * lumSpec * specular * 0.35 * surfaceZone * (1.0 - vap);
      // Le miroir vivant (lore) : l'échantillon REFLÈTE la lumière. Trois
      // couches sur la seule zone de surface — un éclat spéculaire dur (le
      // reflet net d'une source), un voile de fresnel froid aux incidences
      // rasantes (le poli du métal liquide), et un semis d'étincelles qui
      // GLISSE avec la courbure : la surface a l'air de renvoyer la salle.
      float miroir = surfaceZone * (1.0 - vap);
      float specDur = pow(max(reflect(-lightDir, nrm).z, 0.0), 42.0);
      float fres = pow(1.0 - clamp(nrm.z, 0.0, 1.0), 2.0);
      float etincelles = uDecor > 0.5
        ? specks(world + nrm.xy * 55.0 + vec2(uTime * 7.0, -uTime * 4.0), 48.0, 0.10, uZoom)
        : 0.0;
      water += vec3(0.95, 0.99, 1.0) * lumSpec * specDur * 0.80 * miroir;
      water += vec3(0.50, 0.68, 0.85) * lumSpec * fres * 0.40 * miroir;
      water += vec3(0.90, 0.97, 1.0) * lumSpec * etincelles * (0.25 + specDur) * 0.55 * miroir;
    }
    water += vec3(0.30, 0.55, 0.65) * waveGlow * 0.45 * (1.0 - icy) * (1.0 - vap);

    // Gel (tableau 2) : la teinte pâlit vers la glace mate — le givre se lit
    // sur le corps avant même la prise, la partie gelée devient blême et fixe.
    vec3 iceCol = vec3(0.60, 0.76, 0.88) * (0.72 + 0.45 * diffuse);
    water = mix(water, iceCol, icy * 0.9);
    // Vapeur (tableau 3) : vapeur d'opale — cœur turquoise voilé, liseré
    // nacré qui accroche la lumière sur les bords, ombres lilas dans les plis.
    float smokeEdgeMix = 1.0 - smoothstep(th, th * 3.2, field2);
    vec3 smokeCore = vec3(0.34, 0.52, 0.62);
    vec3 smokeEdge = vec3(0.84, 0.94, 1.00);
    vec3 smoke = mix(smokeCore, smokeEdge, smokeEdgeMix * (0.35 + 0.65 * smokeN));
    smoke += vec3(0.16, 0.22, 0.28) * smokeN * smokeN; // volutes lumineuses qui roulent
    smoke = mix(smoke, vec3(0.46, 0.42, 0.62), (1.0 - smokeN) * 0.22); // plis lilas
    water = mix(water, smoke, vap * 0.92);

    // Le corps baigne dans la lumière de la pièce : les ombres portées le
    // traversent, la teinte des lampes le colore — liquide, glace et vapeur
    // pareillement. Plage COMPRESSÉE : la silhouette est la jauge de vie du
    // joueur, elle reste lisible au plus noir de l'ombre.
    if (uLumiereEau > 0.5) water *= 0.70 + 0.55 * lmEau;

    col = mix(col, water, body);
    // L'eau qui recouvre l'œil du sas s'assombrit : elle sombre dans le trou
    col *= 1.0 - drainEye * body * 0.55;
  }
  // Le vaisseau refroidit (§5) : la lumière vire au bleu et faiblit — la
  // pression temporelle se voit, elle ne se chronomètre pas
  col = mix(col, col * vec3(0.82, 0.92, 1.10), uChill * 0.6);
  col *= 1.0 - 0.12 * uChill;
  outColor = vec4(col, 1.0);
}`

// Carte de lumière de la pièce : cuite en espace MONDE, à basse résolution,
// seulement quand le décor change (les obstacles d'un tableau sont figés).
// Chaque texel marche le long de son rayon vers la lampe (sphere tracing sur
// le SDF de la scène) : la pénombre vient du passage au ras des solides. La
// grille et le sas laissent passer la lumière — la même règle que le laser.
// Par image, le coût retombe à UNE lecture de texture dans la composition.
const LIGHT_FS = `#version 300 es
precision highp float;
#define MAX_BOXES 96
#define MAX_LUMIERES 4
#define HAUTEUR_BLOCS 140.0
uniform int uBoxCount;
uniform vec4 uBoxes[MAX_BOXES];
uniform vec4 uBoxAux[MAX_BOXES];
uniform vec2 uMapMin;   // coin bas-gauche de la carte (monde)
uniform vec2 uMapSize;  // taille de la carte (monde)
uniform vec2 uMapPx;    // résolution de la carte (texels)
uniform int uLampeCount;
uniform vec4 uLampes[MAX_LUMIERES]; // x, y, hauteur, portée
uniform float uLampesInt[MAX_LUMIERES]; // intensité
uniform vec3 uLampesCol[MAX_LUMIERES]; // couleur
out vec4 outColor;
${FORMES_GLSL}

float sceneSdf(vec2 p) {
  float d = 1e9;
  for (int i = 0; i < MAX_BOXES; i++) {
    if (i >= uBoxCount) break;
    vec4 dec = decodeAux(uBoxAux[i].x);
    if (dec.x > 2.5 && dec.x < 3.5) continue; // sas : une bouche, pas un mur
    if (dec.x > 4.5 && dec.x < 5.5) continue; // évent : tamisé à part (grilleTrans)
    vec2 wb = p;
    float ang = uBoxAux[i].y;
    if (abs(ang) > 0.0005) {
      vec2 bc = 0.5 * (uBoxes[i].xy + uBoxes[i].zw);
      vec2 rel = p - bc;
      float ca = cos(ang);
      float sa = sin(ang);
      wb = bc + vec2(ca * rel.x + sa * rel.y, -sa * rel.x + ca * rel.y);
    }
    d = min(d, formeSdf(wb, uBoxes[i], dec.y, dec.z, dec.w));
  }
  return d;
}

// L'OMBRE DE LA GRILLE : les barreaux bloquent, les trous laissent passer —
// derrière un évent, la lumière se couche en BANDES claires et sombres, la
// projection du damier de 24 u qui dessine l'évent lui-même (mêmes trous,
// même calage monde : ce qu'on voit sur le panneau est ce qui s'imprime au
// sol). Loin derrière, le motif se fond en tamis uniforme — la pénombre
// d'une source réelle. Les formes d'évent ne projettent que là où le rayon
// traverse vraiment leur silhouette (SDF au point de passage).
float grilleTrans(vec2 p, vec2 dir, float tMax) {
  float trans = 1.0;
  for (int i = 0; i < MAX_BOXES; i++) {
    if (i >= uBoxCount) break;
    vec4 dec = decodeAux(uBoxAux[i].x);
    if (dec.x < 4.5 || dec.x > 5.5) continue; // seuls les évents
    vec2 lp = p;
    vec2 ld = dir;
    float ang = uBoxAux[i].y;
    if (abs(ang) > 0.0005) {
      vec2 bc = 0.5 * (uBoxes[i].xy + uBoxes[i].zw);
      float ca = cos(ang);
      float sa = sin(ang);
      vec2 rel = p - bc;
      lp = bc + vec2(ca * rel.x + sa * rel.y, -sa * rel.x + ca * rel.y);
      ld = vec2(ca * dir.x + sa * dir.y, -sa * dir.x + ca * dir.y);
    }
    // la tranche [t0, t1] du rayon dans la boîte englobante (slabs)
    vec2 safe = vec2(abs(ld.x) < 1e-6 ? 1e-6 : ld.x, abs(ld.y) < 1e-6 ? 1e-6 : ld.y);
    vec2 ta = (uBoxes[i].xy - lp) / safe;
    vec2 tb = (uBoxes[i].zw - lp) / safe;
    float t0 = max(max(min(ta.x, tb.x), min(ta.y, tb.y)), 0.0);
    float t1 = min(min(max(ta.x, tb.x), max(ta.y, tb.y)), tMax);
    if (t1 <= t0) continue;
    float tmid = 0.5 * (t0 + t1);
    // évent en FORME : hors de la silhouette, pas d'ombre
    if (dec.y > 0.5 && formeSdf(lp + ld * tmid, uBoxes[i], dec.y, dec.z, dec.w) >= 0.0) continue;
    // le point de passage, en coordonnées MONDE : les trous du damier de
    // l'évent sont calés sur le monde, comme son dessin
    vec2 pc = p + dir * tmid;
    vec2 cellUv = fract(pc / 24.0) - 0.5;
    float trous = 1.0 - smoothstep(0.20, 0.34, max(abs(cellUv.x), abs(cellUv.y)));
    // p est à t0 unités DERRIÈRE la grille : plus on s'éloigne, plus les
    // bandes se fondent vers la transmission moyenne du panneau (~0,45)
    float flou = clamp(t0 * 0.0009, 0.0, 1.0);
    float ouvert = mix(trous, 0.45, flou);
    trans *= mix(0.06, 1.0, ouvert);
  }
  return trans;
}

void main() {
  vec2 p = uMapMin + (gl_FragCoord.xy / uMapPx) * uMapSize;
  vec3 total = vec3(0.0);
  for (int li = 0; li < MAX_LUMIERES; li++) {
    if (li >= uLampeCount) break;
    vec2 toL = uLampes[li].xy - p;
    float hL = uLampes[li].z;
    float distL = max(length(toL), 1e-4);
    vec2 dir = toL / distL;
    // La HAUTEUR borne l'ombre : le rayon qui grimpe du sol vers la lampe
    // passe au-dessus des blocs dès que son altitude dépasse la leur — seuls
    // les obstacles rencontrés avant t·hLampe/distL = HAUTEUR_BLOCS comptent.
    // Lampe haute : ombres courtes et douces ; lampe basse : ombres longues.
    float tLim = min(distL, distL * HAUTEUR_BLOCS / max(hL, HAUTEUR_BLOCS + 1.0));
    // ombre douce : le min de k·h/t le long de la marche vers la lampe —
    // la pénombre s'élargit avec la hauteur (une lampe haute diffuse)
    float pen = 6.0 + hL * 0.012;
    float res = 1.0;
    float t = 4.0;
    for (int k = 0; k < 40; k++) {
      if (t >= tLim || res < 0.004) break;
      float h = sceneSdf(p + dir * t);
      res = min(res, pen * h / t);
      t += clamp(h, 8.0, 200.0);
    }
    res = clamp(res, 0.0, 1.0);
    // les évents tamisent ce qui reste : la lumière passe entre les barreaux
    res *= grilleTrans(p, dir, min(distL, tLim));
    // retombée douce, à support large : la lampe porte loin, les coins de
    // la cuve restent lisibles — l'ambiance de la composition fait le
    // plancher
    float fall = 1.0 - 0.55 * smoothstep(0.0, uLampes[li].w, distL);
    total += uLampesCol[li] * (res * fall * uLampesInt[li]);
  }
  outColor = vec4(clamp(total, 0.0, 1.0), 1.0);
}`

// Cellules d'éponge : carrés pleins, couleur par état (sèche → gorgée →
// solidifiée). Dessinés par-dessus la composition.
const SPONGE_VS = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in float aSat;
uniform vec2 uCenter;
uniform vec2 uViewport;
uniform float uZoom;
uniform float uPointSize;
out float vSat;
out vec2 vCell; // centre de la cellule (monde) pour l'échantillonnage texturé
void main() {
  vec2 clip = (aPos - uCenter) * uZoom / (uViewport * 0.5);
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = uPointSize;
  vSat = aSat;
  vCell = aPos;
}`

const SPONGE_FS = `#version 300 es
precision highp float;
in float vSat;
in vec2 vCell;
uniform float uCellWorld; // taille d'une cellule en unités monde
uniform sampler2D uTexDry;
uniform sampler2D uTexWet;
uniform float uHasSponge;
out vec4 outColor;
void main() {
  vec2 pc = gl_PointCoord * 2.0 - 1.0;
  float d = max(abs(pc.x), abs(pc.y));
  float sat = clamp(vSat, 0.0, 1.0);
  vec3 col;
  if (uHasSponge > 0.5) {
    // Texture continue en coordonnées monde : la mousse traverse les
    // cellules sans couture. gl_PointCoord a l'axe y vers le bas.
    vec2 world = vCell + vec2(pc.x, -pc.y) * uCellWorld * 0.5;
    vec2 uv = world / 190.0;
    vec3 dry = texture(uTexDry, uv).rgb;
    vec3 wet = texture(uTexWet, uv).rgb;
    col = mix(dry, wet, sat);
    // gorgée → solidifiée : la mousse vire pierre humide, froide
    if (vSat >= 1.0) col = mix(col, col * vec3(0.75, 0.95, 1.25) + vec3(0.03), 0.55);
  } else {
    vec3 dry = vec3(0.30, 0.26, 0.15);      // absorbante : ocre poreux
    vec3 wet = vec3(0.12, 0.18, 0.24);      // en cours de saturation
    vec3 solid = vec3(0.20, 0.26, 0.32);    // gorgée : solide, pierre humide
    col = vSat >= 1.0 ? solid : mix(dry, wet, sat);
  }
  col *= 1.0 - 0.35 * smoothstep(0.7, 1.0, d); // bord de cellule plus sombre
  outColor = vec4(col, 1.0);
}`

// Coque texturée : quatre bandes autour de la cuve, tube lumineux côté
// intérieur. Dessinée par-dessus la composition (le liquide reste dedans).
const HULL_VS = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
uniform vec2 uCenter;
uniform vec2 uViewport;
uniform float uZoom;
out vec2 vUv;
void main() {
  vec2 clip = (aPos - uCenter) * uZoom / (uViewport * 0.5);
  gl_Position = vec4(clip, 0.0, 1.0);
  vUv = aUv;
}`

const HULL_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexHull;
out vec4 outColor;
void main() {
  outColor = vec4(texture(uTexHull, vUv).rgb, 1.0);
}`

// Décalques de décor : machinerie posée sur les parois (tuyaux, vannes).
// Purement décoratifs — aucune physique, aucune lecture de jeu à en tirer :
// ils sont donc assombris et légèrement bleutés pour rester en arrière-plan
// derrière les surfaces qui, elles, ont un sens.
const DECAL_VS = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
uniform vec2 uCenter;
uniform vec2 uViewport;
uniform float uZoom;
out vec2 vUv;
void main() {
  vec2 clip = (aPos - uCenter) * uZoom / (uViewport * 0.5);
  gl_Position = vec4(clip, 0.0, 1.0);
  vUv = aUv;
}`

const DECAL_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexDecal;
uniform float uFade; // atténuation : le décor ne doit jamais crier
// Le champ de fluide de la passe A : un décal est un élément de DÉCOR, le
// corps passe DEVANT — là où il y a de l'eau, le décal s'efface. Sans ça,
// une vanne peinte flottait par-dessus l'échantillon.
uniform sampler2D uField;
uniform vec2 uCanvasSize;
uniform float uThreshold;
uniform float uSoftness;
uniform float uFieldScale;
out vec4 outColor;
void main() {
  vec4 t = texture(uTexDecal, vUv);
  vec3 c = t.rgb * vec3(0.52, 0.62, 0.72); // refroidi, fondu dans la cuve
  float field = texture(uField, gl_FragCoord.xy / uCanvasSize).r / uFieldScale;
  float th = uThreshold;
  float sfn = max(th * uSoftness, 1e-4);
  float fluide = smoothstep(th - sfn, th + sfn, field);
  outColor = vec4(c, t.a * uFade * (1.0 - fluide));
}`

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader: ${gl.getShaderInfoLog(shader)}`)
  }
  return shader
}

function link(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const program = gl.createProgram()!
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vs))
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program: ${gl.getProgramInfoLog(program)}`)
  }
  return program
}

export class Renderer {
  private readonly gl: WebGL2RenderingContext
  private readonly canvas: HTMLCanvasElement
  private readonly splatProgram: WebGLProgram
  private readonly composeProgram: WebGLProgram
  private readonly spongeProgram: WebGLProgram
  private readonly hullProgram: WebGLProgram
  private readonly decalProgram: WebGLProgram
  private readonly lightProgram: WebGLProgram
  private readonly splatVao: WebGLVertexArrayObject
  private readonly splatVbo: WebGLBuffer
  private readonly spongeVao: WebGLVertexArrayObject
  private readonly spongeVbo: WebGLBuffer
  private readonly hullVao: WebGLVertexArrayObject
  private readonly hullVbo: WebGLBuffer
  private readonly decalVao: WebGLVertexArrayObject
  private readonly decalVbo: WebGLBuffer
  private readonly hullScratch = new Float32Array(6 * 4 * 4) // 4 bandes × 6 sommets × (pos, uv)
  private readonly decalScratch = new Float32Array(6 * 4) // un quad : 6 sommets × (pos, uv)
  private readonly zoneScratch = new Float32Array(MAX_ZONES * 4)
  private readonly zoneForceScratch = new Float32Array(MAX_ZONES)
  private readonly zonePhaseScratch = new Float32Array(MAX_ZONES * 3)
  private texDecalTuyaux: WebGLTexture | null = null
  private texDecalVanne: WebGLTexture | null = null
  private texDecalEcranOff: WebGLTexture | null = null
  private texDecalEcranOn: WebGLTexture | null = null
  // Tableau de textures des zones (calques : 0 buses/eau, 1 hublot/glace,
  // 2 conduite/vapeur) : une seule unité de texture pour les trois images.
  private texZones: WebGLTexture | null = null
  private readonly hasZones = new Float32Array(3)
  // Textures d'habillage : null tant que l'image n'est pas chargée — le
  // décor procédural assure l'intérim, l'image prend le relais sans à-coup.
  private texStars: WebGLTexture | null = null
  private texStarsFar: WebGLTexture | null = null
  private texTank: WebGLTexture | null = null
  private texWall: WebGLTexture | null = null
  private texWallA: WebGLTexture | null = null
  private texFroid: WebGLTexture | null = null
  private texParoi: WebGLTexture | null = null
  private texChaud: WebGLTexture | null = null
  private texGrille: WebGLTexture | null = null
  private texPhobe: WebGLTexture | null = null
  private texPhile: WebGLTexture | null = null
  private texIris: WebGLTexture | null = null
  private texHull: WebGLTexture | null = null
  private texSpongeDry: WebGLTexture | null = null
  private texSpongeWet: WebGLTexture | null = null
  private spongeScratch = new Float32Array(0)
  private readonly scratch: Float32Array
  private readonly boxScratch = new Float32Array(MAX_BOXES * 4)
  private readonly auxScratch = new Float32Array(MAX_BOXES * 4) // matériau, angle, charge, aura
  private readonly floatField: boolean
  private fieldScale: number
  private fbo: WebGLFramebuffer | null = null
  private fieldTex: WebGLTexture | null = null
  private fboW = 0
  private fboH = 0
  // Carte de lumière : cible fixe basse résolution, cuite seulement quand le
  // décor change — la clé résume boîtes, bornes et lampe.
  private lightFbo: WebGLFramebuffer | null = null
  private lightTex: WebGLTexture | null = null
  private lightW = 0
  private lightH = 0
  private lightKey = ''
  private lightMapMinX = 0
  private lightMapMinY = 0
  private lightMapSizeX = 1
  private lightMapSizeY = 1
  private readonly lampScratch = new Float32Array(MAX_LUMIERES * 4) // x, y, hauteur, portée
  private readonly lampIntScratch = new Float32Array(MAX_LUMIERES)
  private readonly lampColScratch = new Float32Array(MAX_LUMIERES * 3)
  private uniforms: Record<string, Record<string, WebGLUniformLocation | null>> = {}

  constructor(canvas: HTMLCanvasElement, capacity: number) {
    this.canvas = canvas
    // preserveDrawingBuffer : les captures d'écran du canvas fonctionnent
    // (retours des testeurs, comparaisons de réglages) — surcoût négligeable.
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true })
    if (!gl) throw new Error('WebGL2 indisponible')
    this.gl = gl
    // Perte de contexte (pilote, veille, onglet gourmand) : un canvas noir est
    // pire qu'un rechargement — on repart proprement.
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      location.reload()
    })

    this.floatField = gl.getExtension('EXT_color_buffer_float') !== null
    this.fieldScale = this.floatField ? 1.0 : 0.02

    this.splatProgram = link(gl, SPLAT_VS, SPLAT_FS)
    this.composeProgram = link(gl, COMPOSE_VS, COMPOSE_FS)
    this.spongeProgram = link(gl, SPONGE_VS, SPONGE_FS)
    this.hullProgram = link(gl, HULL_VS, HULL_FS)
    this.decalProgram = link(gl, DECAL_VS, DECAL_FS)
    this.lightProgram = link(gl, COMPOSE_VS, LIGHT_FS)
    for (const [name, program] of [
      ['splat', this.splatProgram],
      ['compose', this.composeProgram],
      ['sponge', this.spongeProgram],
      ['hull', this.hullProgram],
      ['decal', this.decalProgram],
      ['light', this.lightProgram],
    ] as const) {
      const map: Record<string, WebGLUniformLocation | null> = {}
      const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number
      for (let i = 0; i < count; i++) {
        const info = gl.getActiveUniform(program, i)
        if (info) map[info.name] = gl.getUniformLocation(program, info.name)
      }
      this.uniforms[name] = map
    }

    this.scratch = new Float32Array(capacity * 7)
    this.splatVao = gl.createVertexArray()!
    this.splatVbo = gl.createBuffer()!
    gl.bindVertexArray(this.splatVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatVbo)
    gl.bufferData(gl.ARRAY_BUFFER, this.scratch.byteLength, gl.DYNAMIC_DRAW)
    const stride = 7 * 4
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, stride, 8)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 12)
    gl.enableVertexAttribArray(3)
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 16)
    gl.enableVertexAttribArray(4)
    gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 24)
    gl.bindVertexArray(null)

    this.spongeVao = gl.createVertexArray()!
    this.spongeVbo = gl.createBuffer()!
    gl.bindVertexArray(this.spongeVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spongeVbo)
    const spongeStride = 3 * 4
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, spongeStride, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, spongeStride, 8)
    gl.bindVertexArray(null)

    this.hullVao = gl.createVertexArray()!
    this.hullVbo = gl.createBuffer()!
    gl.bindVertexArray(this.hullVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.hullVbo)
    gl.bufferData(gl.ARRAY_BUFFER, this.hullScratch.byteLength, gl.DYNAMIC_DRAW)
    const hullStride = 4 * 4
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, hullStride, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, hullStride, 8)
    gl.bindVertexArray(null)

    this.decalVao = gl.createVertexArray()!
    this.decalVbo = gl.createBuffer()!
    gl.bindVertexArray(this.decalVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.decalVbo)
    gl.bufferData(gl.ARRAY_BUFFER, this.decalScratch.byteLength, gl.DYNAMIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, hullStride, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, hullStride, 8)
    gl.bindVertexArray(null)

    // Habillage généré par IA (public/assets) : chargé en arrière-plan.
    // L'iris est échantillonné dans une branche non uniforme du shader :
    // pas de mipmaps pour lui (dérivées indéfinies sinon).
    this.loadTexture('/assets/stars.webp', true, true, (t) => (this.texStars = t))
    // Le lointain n'est pas raccordable : répété en MIROIR, la couture ne se
    // lit pas dans le noir et la station à la dérive reste unique à l'écran.
    this.loadTexture('/assets/stars-far.webp', true, true, (t) => (this.texStarsFar = t), true)
    this.loadTexture('/assets/tank-bg.webp', true, true, (t) => (this.texTank = t))
    this.loadTexture('/assets/wall.webp', true, true, (t) => (this.texWall = t))
    this.loadTexture('/assets/wall-a.webp', true, true, (t) => (this.texWallA = t))
    this.loadTexture('/assets/froid.webp', true, true, (t) => (this.texFroid = t))
    // atlas des habillages de parois (8 tuiles de 1024 en grille 4×2)
    this.loadTexture('/assets/paroi-atlas.webp', true, true, (t) => (this.texParoi = t))
    this.loadTexture('/assets/chaud.webp', true, true, (t) => (this.texChaud = t))
    this.loadTexture('/assets/grille.webp', true, true, (t) => (this.texGrille = t))
    this.loadTexture('/assets/phobe.webp', true, true, (t) => (this.texPhobe = t))
    this.loadTexture('/assets/phile.webp', true, true, (t) => (this.texPhile = t))
    this.loadTexture('/assets/iris.webp', false, false, (t) => (this.texIris = t))
    this.loadTexture('/assets/hull.webp', true, true, (t) => (this.texHull = t))
    this.loadTexture('/assets/sponge-dry.webp', true, true, (t) => (this.texSpongeDry = t))
    this.loadTexture('/assets/sponge-wet.webp', true, true, (t) => (this.texSpongeWet = t))
    // Décalques : pièces détourées (alpha), donc bord franc — pas de répétition
    this.loadTexture('/assets/decal-tuyaux.webp', false, true, (t) => (this.texDecalTuyaux = t))
    this.loadTexture('/assets/decal-vanne.webp', false, true, (t) => (this.texDecalVanne = t))
    // L'écran de contrôle de la salle d'observation : éteint aujourd'hui
    // (HORS TENSION), allumé quand la méta-progression prendra ses quartiers
    this.loadTexture('/assets/decal-ecran-off.webp', false, true, (t) => (this.texDecalEcranOff = t))
    this.loadTexture('/assets/decal-ecran-on.webp', false, true, (t) => (this.texDecalEcranOn = t))
    // Images de zones : la cause peinte (voir zoneDecor). Sans mipmaps —
    // échantillonnées dans une branche non uniforme du shader. En calques
    // d'un même tableau de textures : une seule unité pour les trois.
    this.loadZoneLayer('/assets/zone-buses.webp', 0)
    this.loadZoneLayer('/assets/zone-hublot.webp', 1)
    this.loadZoneLayer('/assets/zone-conduite.webp', 2)
  }

  // Charge une image de zone dans SON calque du tableau de textures. Le
  // redimensionnement en 1024² passe par un canvas, qui fait aussi le
  // retournement vertical (UNPACK_FLIP_Y est interdit sur les entrées 3D).
  private loadZoneLayer(url: string, layer: number): void {
    const img = new Image()
    img.onload = () => {
      const gl = this.gl
      const cv = document.createElement('canvas')
      cv.width = 1024
      cv.height = 1024
      const c2 = cv.getContext('2d')
      if (!c2) return
      c2.translate(0, 1024)
      c2.scale(1, -1)
      c2.drawImage(img, 0, 0, 1024, 1024)
      if (!this.texZones) {
        this.texZones = gl.createTexture()!
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texZones)
        gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, 1024, 1024, 3)
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      } else {
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texZones)
      }
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, 1024, 1024, 1, gl.RGBA, gl.UNSIGNED_BYTE, cv)
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, null)
      this.hasZones[layer] = 1
    }
    img.src = url
  }

  private loadTexture(
    url: string,
    repeat: boolean,
    mips: boolean,
    assign: (t: WebGLTexture) => void,
    mirrored = false,
  ): void {
    const img = new Image()
    img.onload = () => {
      const gl = this.gl
      const tex = gl.createTexture()!
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      const wrap = repeat ? (mirrored ? gl.MIRRORED_REPEAT : gl.REPEAT) : gl.CLAMP_TO_EDGE
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      if (mips) {
        gl.generateMipmap(gl.TEXTURE_2D)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      }
      gl.bindTexture(gl.TEXTURE_2D, null)
      assign(tex)
    }
    img.src = url
  }

  private ensureFieldTarget(w: number, h: number): void {
    if (w === this.fboW && h === this.fboH && this.fbo) return
    const gl = this.gl
    if (this.fieldTex) gl.deleteTexture(this.fieldTex)
    if (this.fbo) gl.deleteFramebuffer(this.fbo)
    this.fboW = w
    this.fboH = h
    this.fieldTex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.fieldTex)
    if (this.floatField) {
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA16F, w, h)
    } else {
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h)
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    this.fbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fieldTex, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  private ensureLightTarget(w: number, h: number): void {
    if (w === this.lightW && h === this.lightH && this.lightFbo) return
    const gl = this.gl
    if (this.lightTex) gl.deleteTexture(this.lightTex)
    if (this.lightFbo) gl.deleteFramebuffer(this.lightFbo)
    this.lightW = w
    this.lightH = h
    this.lightTex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.lightTex)
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    this.lightFbo = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightFbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.lightTex, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    this.lightKey = '' // nouvelle cible : la carte doit recuire
  }

  // Les lampes effectives d'un tableau : celles posées à l'éditeur (bornées
  // à MAX_LUMIERES, valeurs assainies), ou — quand aucune n'est déclarée —
  // la lampe par défaut de la cuve : au centre, un peu vers le haut, assez
  // haute pour coucher les ombres sans les étirer.
  private lampesEffectives(
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    lumieres: LumiereDef[],
  ): { x: number; y: number; h: number; portee: number; intensite: number; rvb: [number, number, number] }[] {
    const diag = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY)
    if (lumieres.length === 0) {
      return [
        {
          x: (bounds.minX + bounds.maxX) / 2,
          y: bounds.minY + (bounds.maxY - bounds.minY) * 0.7,
          h: LAMPE_HAUTEUR_DEFAUT,
          portee: diag * 0.62,
          intensite: 1,
          rvb: [1, 1, 1],
        },
      ]
    }
    return lumieres.slice(0, MAX_LUMIERES).map((l) => ({
      x: l.x,
      y: l.y,
      h: Math.max(LAMPE_HAUTEUR_MIN, Math.min(LAMPE_HAUTEUR_MAX, l.h ?? LAMPE_HAUTEUR_DEFAUT)),
      portee: l.portee && l.portee > 0 ? l.portee : diag * 0.62,
      intensite: Math.max(0.2, Math.min(2, l.intensite ?? 1)),
      rvb: lampeCouleurRVB(l.couleur) ?? [1, 1, 1],
    }))
  }

  // Cuit la carte de lumière si le décor OU les lampes ont changé — les
  // scratchs de boîtes doivent déjà être remplis. Quelques dizaines de
  // milliers de texels, une fois par tableau : le prix d'une image.
  private bakeLight(
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    boxes: ObstacleBox[],
    boxCount: number,
    lampes: { x: number; y: number; h: number; portee: number; intensite: number; rvb: [number, number, number] }[],
  ): void {
    const gl = this.gl
    const marge = 80
    const minX = bounds.minX - marge
    const minY = bounds.minY - marge
    const sizeX = bounds.maxX - bounds.minX + marge * 2
    const sizeY = bounds.maxY - bounds.minY + marge * 2
    // Assez fin pour résoudre l'ombre des barreaux d'évent (damier de 24 u :
    // ~4-5 texels par période sur une cuve standard) — cuite une fois, la
    // résolution ne pèse pas sur l'image.
    const w = 480
    const h = Math.max(48, Math.min(480, Math.round((w * sizeY) / sizeX)))
    this.ensureLightTarget(w, h)
    let key = `${boxCount};${minX},${minY},${sizeX},${sizeY}`
    for (const l of lampes) key += `;L${l.x},${l.y},${l.h},${l.portee},${l.intensite},${l.rvb.join('/')}`
    for (let i = 0; i < boxCount; i++) {
      const bx = boxes[i]
      key += `;${bx.minX},${bx.minY},${bx.maxX},${bx.maxY},${bx.angle ?? 0},${bx.material},${bx.forme ?? 0},${bx.p0 ?? 0},${bx.p1 ?? 0}`
    }
    if (key === this.lightKey) return
    this.lightKey = key
    this.lightMapMinX = minX
    this.lightMapMinY = minY
    this.lightMapSizeX = sizeX
    this.lightMapSizeY = sizeY
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.lightFbo)
    gl.viewport(0, 0, w, h)
    gl.useProgram(this.lightProgram)
    const lu = this.uniforms['light']
    gl.uniform1i(lu['uBoxCount'], boxCount)
    gl.uniform4fv(lu['uBoxes[0]'], this.boxScratch)
    gl.uniform4fv(lu['uBoxAux[0]'], this.auxScratch)
    gl.uniform2f(lu['uMapMin'], minX, minY)
    gl.uniform2f(lu['uMapSize'], sizeX, sizeY)
    gl.uniform2f(lu['uMapPx'], w, h)
    this.remplitLampes(lampes)
    gl.uniform1i(lu['uLampeCount'], lampes.length)
    gl.uniform4fv(lu['uLampes[0]'], this.lampScratch)
    gl.uniform1fv(lu['uLampesInt[0]'], this.lampIntScratch)
    gl.uniform3fv(lu['uLampesCol[0]'], this.lampColScratch)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  private remplitLampes(
    lampes: { x: number; y: number; h: number; portee: number; intensite: number; rvb: [number, number, number] }[],
  ): void {
    for (let i = 0; i < lampes.length && i < MAX_LUMIERES; i++) {
      this.lampScratch[i * 4] = lampes[i].x
      this.lampScratch[i * 4 + 1] = lampes[i].y
      this.lampScratch[i * 4 + 2] = lampes[i].h
      this.lampScratch[i * 4 + 3] = lampes[i].portee
      this.lampIntScratch[i] = lampes[i].intensite
      this.lampColScratch[i * 3] = lampes[i].rvb[0]
      this.lampColScratch[i * 3 + 1] = lampes[i].rvb[1]
      this.lampColScratch[i * 3 + 2] = lampes[i].rvb[2]
    }
  }

  render(
    sim: FluidSim,
    camera: Camera,
    params: SimParams,
    viewportW: number,
    viewportH: number,
    dpr: number,
    boxes: ObstacleBox[],
    timeSec: number,
    waves: Float32Array, // MAX_WAVES × (x, y, t0, amplitude)
    waveCount: number,
    downsample = params.renderDownsample, // la qualité adaptative peut forcer plus grossier
    chill = 0, // refroidissement du vaisseau : teinte froide, auras effectives
    decals: DecalDef[] = [], // machinerie de décor, sans physique
    zones: ZoneDef[] = [], // régions qui imposent un état
    decor = 1, // 1 décor riche, 0 sobre (bruit décoratif débranché)
    eau = 1, // 1 liquide riche, 0 sobre (relief/miroir de l'eau débranchés)
    lumiere = 1, // 1 éclairage de la pièce (carte d'ombres), 0 débranché
    lumieres: LumiereDef[] = [], // lampes du tableau ; vide : lampe par défaut
    lumiereEau = 1, // 1 le VOLUME baigne dans la lumière de la pièce, 0 non
    ambiante = 0.52, // lumière générale du tableau (plancher hors lampes)
    relief = 0, // relief 2.5D des parois (0 débranché ; ~0,035 léger)
  ): void {
    const gl = this.gl
    const devW = Math.max(1, Math.round(viewportW * dpr))
    const devH = Math.max(1, Math.round(viewportH * dpr))
    if (this.canvas.width !== devW || this.canvas.height !== devH) {
      this.canvas.width = devW
      this.canvas.height = devH
    }
    const down = Math.max(1, downsample)
    const fboW = Math.max(1, Math.round(devW / down))
    const fboH = Math.max(1, Math.round(devH / down))
    this.ensureFieldTarget(fboW, fboH)

    // Boîtes → scratchs, partagés par la composition ET la carte de lumière.
    // aux.x empaquette matériau + forme + paramètres (voir FORMES_GLSL) :
    // des entiers exacts en float32, aucun uniforme de plus.
    const boxCount = Math.min(boxes.length, MAX_BOXES)
    for (let i = 0; i < boxCount; i++) {
      const bx = boxes[i]
      this.boxScratch[i * 4] = bx.minX
      this.boxScratch[i * 4 + 1] = bx.minY
      this.boxScratch[i * 4 + 2] = bx.maxX
      this.boxScratch[i * 4 + 3] = bx.maxY
      const forme = bx.forme ?? FORME_RECT
      let q0 = 0
      let q1 = 0
      if (forme === FORME_COIN) q0 = ((Math.round(bx.p0 ?? 0) % 4) + 4) % 4
      else if (forme === FORME_ARC) {
        q0 = Math.round(Math.min(1, Math.max(0.08, bx.p0 ?? ARC_EPAISSEUR_DEFAUT)) * 100)
        q1 = Math.round(Math.min(180, Math.max(15, bx.p1 ?? ARC_OUVERTURE_DEFAUT)))
      }
      this.auxScratch[i * 4] = bx.material + forme * 16 + q0 * 128 + q1 * 16384
      this.auxScratch[i * 4 + 1] = ((bx.angle ?? 0) * Math.PI) / 180
      // aux.z : charge du surchauffeur (le solveur dit lesquels sont vides)
      // — ou HABILLAGE d'une paroi neutre (1-4), pur décor
      this.auxScratch[i * 4 + 2] =
        bx.material === 0 ? (bx.skin ?? 0) : sim.surchauffesVides.has(i) ? 0 : 1
      this.auxScratch[i * 4 + 3] = bx.aura ?? 1
    }
    // La carte de lumière recuit si le décor ou les lampes ont changé
    const lampes = this.lampesEffectives(sim.bounds, lumieres)
    if (lumiere > 0.5) this.bakeLight(sim.bounds, boxes, boxCount, lampes)

    // Remplissage du buffer de splats
    const n = sim.count
    const data = this.scratch
    const invSpeedScale = 1 / Math.max(1, params.speedColorScale)
    const invStretchSpeed = 1 / 900 // vitesse (u/s) donnant un étirement ×2
    for (let i = 0; i < n; i++) {
      const o = i * 7
      data[o] = sim.posX[i]
      data[o + 1] = sim.posY[i]
      const vx = sim.velX[i]
      const vy = sim.velY[i]
      const v = Math.hypot(vx, vy)
      const speed = v * invSpeedScale
      data[o + 2] = speed > 1 ? 1 : speed
      data[o + 3] = sim.kind[i] === KIND_PLAYER ? 1 : 0
      // Étirement selon la vitesse : les gouttes rapides filent en traînées
      const s = Math.min(v * invStretchSpeed, 1.2)
      if (v > 1e-3 && s > 1e-3) {
        data[o + 4] = (vx / v) * s
        data[o + 5] = (vy / v) * s
      } else {
        data[o + 4] = 0
        data[o + 5] = 0
      }
      data[o + 6] = sim.frost[i] - sim.vapor[i] // givre positif, vapeur négative
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatVbo)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, n * 7)

    // Passe A — champ
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    gl.viewport(0, 0, fboW, fboH)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE)
    gl.useProgram(this.splatProgram)
    const su = this.uniforms['splat']
    gl.uniform2f(su['uCenter'], camera.x, camera.y)
    gl.uniform2f(su['uViewport'], viewportW, viewportH)
    gl.uniform1f(su['uZoom'], camera.zoom)
    const pointSize = ((params.particleRenderRadius * 2 * camera.zoom * dpr) / down) * 1.0
    gl.uniform1f(su['uPointSize'], Math.max(1, pointSize))
    gl.uniform1f(su['uFieldScale'], this.fieldScale)
    gl.bindVertexArray(this.splatVao)
    gl.drawArrays(gl.POINTS, 0, n)
    gl.bindVertexArray(null)
    gl.disable(gl.BLEND)

    // Passe B — composition
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, devW, devH)
    gl.useProgram(this.composeProgram)
    const cu = this.uniforms['compose']
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.fieldTex)
    gl.uniform1i(cu['uField'], 0)
    gl.uniform2f(cu['uCanvasSize'], devW, devH)
    gl.uniform1f(cu['uDpr'], dpr)
    gl.uniform2f(cu['uViewport'], viewportW, viewportH)
    gl.uniform2f(cu['uCenter'], camera.x, camera.y)
    gl.uniform1f(cu['uZoom'], camera.zoom)
    gl.uniform1f(cu['uThreshold'], params.fieldThreshold)
    gl.uniform1f(cu['uSoftness'], params.fieldSoftness)
    gl.uniform1f(cu['uFieldScale'], this.fieldScale)
    const b = sim.bounds
    gl.uniform2f(cu['uRoomCenter'], (b.minX + b.maxX) * 0.5, (b.minY + b.maxY) * 0.5)
    gl.uniform2f(cu['uRoomHalf'], (b.maxX - b.minX) * 0.5, (b.maxY - b.minY) * 0.5)
    gl.uniform1i(cu['uBoxCount'], boxCount)
    gl.uniform4fv(cu['uBoxes[0]'], this.boxScratch)
    gl.uniform4fv(cu['uBoxAux[0]'], this.auxScratch)
    gl.uniform1f(cu['uTime'], timeSec)
    gl.uniform1f(cu['uExitRadius'], params.exitRadius)
    // les auras dessinées suivent la physique refroidie (mêmes formules que
    // le solveur) : le danger se lit toujours à sa vraie portée
    gl.uniform1f(cu['uColdBand'], params.coldBand * (1 + params.chillColdGrowth * chill))
    gl.uniform1f(cu['uHeatBand'], Math.max(0, params.heatBand * (1 - params.chillHeatFade * chill)))
    gl.uniform1f(cu['uHydroBand'], params.hydroBand)
    gl.uniform1f(cu['uChill'], chill)
    gl.uniform1f(cu['uDecor'], decor)
    gl.uniform1f(cu['uEau'], eau)
    // Éclairage de la pièce : la carte cuite + les lampes (le biseau des
    // arêtes et les montures en ont besoin par pixel)
    gl.uniform1f(cu['uLumiere'], lumiere > 0.5 && this.lightTex ? 1 : 0)
    gl.uniform1f(cu['uAmbiante'], ambiante)
    gl.uniform1f(cu['uRelief'], relief)
    // le volume n'a de lumière à recevoir que si la pièce en a une
    gl.uniform1f(cu['uLumiereEau'], lumiere > 0.5 && lumiereEau > 0.5 && this.lightTex ? 1 : 0)
    this.remplitLampes(lampes)
    gl.uniform1i(cu['uLampeCount'], lampes.length)
    gl.uniform4fv(cu['uLampes[0]'], this.lampScratch)
    gl.uniform1fv(cu['uLampesInt[0]'], this.lampIntScratch)
    gl.uniform3fv(cu['uLampesCol[0]'], this.lampColScratch)
    gl.uniform2f(cu['uLightMapMin'], this.lightMapMinX, this.lightMapMinY)
    gl.uniform2f(cu['uLightMapInvSize'], 1 / this.lightMapSizeX, 1 / this.lightMapSizeY)
    gl.uniform1i(cu['uWaveCount'], waveCount)
    gl.uniform4fv(cu['uWaves[0]'], waves)
    // Zones d'état : au plus MAX_ZONES par tableau
    const zoneCount = Math.min(zones.length, MAX_ZONES)
    for (let i = 0; i < zoneCount; i++) {
      const z = zones[i]
      this.zoneScratch[i * 4] = z.minX
      this.zoneScratch[i * 4 + 1] = z.minY
      this.zoneScratch[i * 4 + 2] = z.maxX
      this.zoneScratch[i * 4 + 3] = z.maxY
      this.zoneForceScratch[i] =
        z.force === 'eau' ? 1 : z.force === 'glace' ? 2 : z.force === 'vapeur' ? 3 : 0
      // les phases de la lisière : la même fonction que la mécanique
      const [p1, p2, p3] = zonePhases(z)
      this.zonePhaseScratch[i * 3] = p1
      this.zonePhaseScratch[i * 3 + 1] = p2
      this.zonePhaseScratch[i * 3 + 2] = p3
    }
    gl.uniform1i(cu['uZoneCount'], zoneCount)
    if (zoneCount > 0) {
      gl.uniform4fv(cu['uZones[0]'], this.zoneScratch)
      gl.uniform1fv(cu['uZoneForce[0]'], this.zoneForceScratch)
      gl.uniform3fv(cu['uZonePhase[0]'], this.zonePhaseScratch)
    }
    const bindTex = (unit: number, tex: WebGLTexture | null, sampler: string, flag: string) => {
      gl.activeTexture(gl.TEXTURE0 + unit)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.uniform1i(cu[sampler], unit)
      gl.uniform1f(cu[flag], tex ? 1 : 0)
    }
    bindTex(1, this.texStars, 'uTexStars', 'uHasStars')
    bindTex(2, this.texWall, 'uTexWall', 'uHasWall')
    bindTex(6, this.texTank, 'uTexTank', 'uHasTank')
    bindTex(7, this.texStarsFar, 'uTexStarsFar', 'uHasStarsFar')
    bindTex(8, this.texWallA, 'uTexWallA', 'uHasWallA')
    bindTex(9, this.texFroid, 'uTexFroid', 'uHasFroid')
    bindTex(10, this.texChaud, 'uTexChaud', 'uHasChaud')
    bindTex(11, this.texGrille, 'uTexGrille', 'uHasGrille')
    // le tableau des zones (12) et la carte de lumière (13) : les unités
    // libérées par la fusion des trois images de zones en un seul tableau
    gl.activeTexture(gl.TEXTURE0 + 12)
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texZones)
    gl.uniform1i(cu['uTexZones'], 12)
    gl.uniform3f(cu['uHasZones'], this.hasZones[0], this.hasZones[1], this.hasZones[2])
    gl.activeTexture(gl.TEXTURE0 + 13)
    gl.bindTexture(gl.TEXTURE_2D, this.lightTex)
    gl.uniform1i(cu['uLightMap'], 13)
    bindTex(3, this.texPhobe, 'uTexPhobe', 'uHasPhobe')
    bindTex(4, this.texPhile, 'uTexPhile', 'uHasPhile')
    bindTex(5, this.texIris, 'uTexIris', 'uHasIris')
    bindTex(15, this.texParoi, 'uTexParoi', 'uHasParoi')
    gl.uniform1f(cu['uHasHull'], this.texHull ? 1 : 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    // Passe B bis — coque texturée autour de la cuve
    this.drawHull(sim, camera, viewportW, viewportH)

    // Passe B ter — décalques de décor (tuyaux, vannes), effacés sous l'eau
    this.drawDecals(decals, camera, viewportW, viewportH, params)

    // Passe C — cellules d'éponge
    this.drawSponges(sim, camera, viewportW, viewportH, dpr)
  }

  // Quatre bandes de coque autour de la cuve, tube lumineux (bas de l'image,
  // v = 0 avec le flip) tourné vers l'intérieur. Les horizontales débordent
  // de l'épaisseur aux deux bouts et couvrent les angles.
  private drawHull(sim: FluidSim, camera: Camera, viewportW: number, viewportH: number): void {
    if (!this.texHull) return
    const gl = this.gl
    const b = sim.bounds
    const T = 90 // épaisseur de la coque (unités monde)
    const REP = 225 // longueur d'une répétition de texture (aspect 2,5:1)
    const data = this.hullScratch
    let o = 0
    // x0..x1 le long de la bande, « in » = bord intérieur (tube), « out » = bord extérieur
    const quad = (
      ax: number, ay: number, au: number, av: number,
      bx: number, by: number, bu: number, bv: number,
      cx: number, cy: number, cu2: number, cv: number,
      dx: number, dy: number, du: number, dv: number,
    ) => {
      data[o++] = ax; data[o++] = ay; data[o++] = au; data[o++] = av
      data[o++] = bx; data[o++] = by; data[o++] = bu; data[o++] = bv
      data[o++] = cx; data[o++] = cy; data[o++] = cu2; data[o++] = cv
      data[o++] = ax; data[o++] = ay; data[o++] = au; data[o++] = av
      data[o++] = cx; data[o++] = cy; data[o++] = cu2; data[o++] = cv
      data[o++] = dx; data[o++] = dy; data[o++] = du; data[o++] = dv
    }
    const uLen = (len: number) => len / REP
    // haut : tube en y = maxY (v 0), extérieur en maxY + T (v 1)
    quad(
      b.minX - T, b.maxY, 0, 0,
      b.maxX + T, b.maxY, uLen(b.maxX - b.minX + 2 * T), 0,
      b.maxX + T, b.maxY + T, uLen(b.maxX - b.minX + 2 * T), 1,
      b.minX - T, b.maxY + T, 0, 1,
    )
    // bas : tube en y = minY
    quad(
      b.minX - T, b.minY, 0, 0,
      b.maxX + T, b.minY, uLen(b.maxX - b.minX + 2 * T), 0,
      b.maxX + T, b.minY - T, uLen(b.maxX - b.minX + 2 * T), 1,
      b.minX - T, b.minY - T, 0, 1,
    )
    // gauche : tube en x = minX
    quad(
      b.minX, b.minY, 0, 0,
      b.minX, b.maxY, uLen(b.maxY - b.minY), 0,
      b.minX - T, b.maxY, uLen(b.maxY - b.minY), 1,
      b.minX - T, b.minY, 0, 1,
    )
    // droite : tube en x = maxX
    quad(
      b.maxX, b.minY, 0, 0,
      b.maxX, b.maxY, uLen(b.maxY - b.minY), 0,
      b.maxX + T, b.maxY, uLen(b.maxY - b.minY), 1,
      b.maxX + T, b.minY, 0, 1,
    )
    gl.bindBuffer(gl.ARRAY_BUFFER, this.hullVbo)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data)
    gl.useProgram(this.hullProgram)
    const hu = this.uniforms['hull']
    gl.uniform2f(hu['uCenter'], camera.x, camera.y)
    gl.uniform2f(hu['uViewport'], viewportW, viewportH)
    gl.uniform1f(hu['uZoom'], camera.zoom)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texHull)
    gl.uniform1i(hu['uTexHull'], 0)
    gl.bindVertexArray(this.hullVao)
    gl.drawArrays(gl.TRIANGLES, 0, 24)
    gl.bindVertexArray(null)
  }

  // Décalques : un quad par pièce, dessinés en transparence. Le décor n'a pas
  // de physique — il ne coûte qu'un appel de dessin par pièce, et un tableau
  // n'en porte qu'une poignée.
  private drawDecals(
    decals: DecalDef[],
    camera: Camera,
    viewportW: number,
    viewportH: number,
    params: SimParams,
  ): void {
    if (decals.length === 0) return
    const gl = this.gl
    const du = this.uniforms['decal']
    let started = false
    for (const d of decals) {
      const tex =
        d.kind === 'vanne'
          ? this.texDecalVanne
          : d.kind === 'ecran-off'
            ? this.texDecalEcranOff
            : d.kind === 'ecran-on'
              ? this.texDecalEcranOn
              : this.texDecalTuyaux
      if (!tex) continue
      if (!started) {
        started = true
        gl.useProgram(this.decalProgram)
        gl.uniform2f(du['uCenter'], camera.x, camera.y)
        gl.uniform2f(du['uViewport'], viewportW, viewportH)
        gl.uniform1f(du['uZoom'], camera.zoom)
        // le champ de fluide de la passe A : l'eau efface les décals
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, this.fieldTex)
        gl.uniform1i(du['uField'], 1)
        gl.uniform2f(du['uCanvasSize'], gl.drawingBufferWidth, gl.drawingBufferHeight)
        gl.uniform1f(du['uThreshold'], params.fieldThreshold)
        gl.uniform1f(du['uSoftness'], params.fieldSoftness)
        gl.uniform1f(du['uFieldScale'], this.fieldScale)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
        gl.bindVertexArray(this.decalVao)
      }
      const hw = d.w * 0.5
      const hh = d.h * 0.5
      const u0 = d.flip ? 1 : 0
      const u1 = d.flip ? 0 : 1
      // v inversé : les textures sont chargées avec UNPACK_FLIP_Y
      const q = this.decalScratch
      let o = 0
      const put = (x: number, y: number, u: number, v: number): void => {
        q[o++] = x
        q[o++] = y
        q[o++] = u
        q[o++] = v
      }
      put(d.x - hw, d.y - hh, u0, 0)
      put(d.x + hw, d.y - hh, u1, 0)
      put(d.x + hw, d.y + hh, u1, 1)
      put(d.x - hw, d.y - hh, u0, 0)
      put(d.x + hw, d.y + hh, u1, 1)
      put(d.x - hw, d.y + hh, u0, 1)
      gl.bindBuffer(gl.ARRAY_BUFFER, this.decalVbo)
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, q)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.uniform1i(du['uTexDecal'], 0)
      gl.uniform1f(du['uFade'], d.fade ?? 0.55)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }
    if (started) {
      gl.bindVertexArray(null)
      gl.disable(gl.BLEND)
    }
  }

  private drawSponges(sim: FluidSim, camera: Camera, viewportW: number, viewportH: number, dpr: number): void {
    let totalCells = 0
    for (const sp of sim.sponges) totalCells += sp.saturation.length
    if (totalCells === 0) return
    const gl = this.gl
    if (this.spongeScratch.length < totalCells * 3) {
      this.spongeScratch = new Float32Array(totalCells * 3)
    }
    const data = this.spongeScratch
    let o = 0
    let cellSize = 24
    for (const sp of sim.sponges) {
      const d = sp.def
      cellSize = d.cellSize
      for (let cell = 0; cell < sp.saturation.length; cell++) {
        const cx = cell % d.cols
        const cy = Math.floor(cell / d.cols)
        data[o++] = d.minX + (cx + 0.5) * d.cellSize
        data[o++] = d.minY + (cy + 0.5) * d.cellSize
        data[o++] = sp.saturation[cell] / d.capacityPerCell
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.spongeVbo)
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, totalCells * 3), gl.DYNAMIC_DRAW)
    gl.useProgram(this.spongeProgram)
    const su = this.uniforms['sponge']
    gl.uniform2f(su['uCenter'], camera.x, camera.y)
    gl.uniform2f(su['uViewport'], viewportW, viewportH)
    gl.uniform1f(su['uZoom'], camera.zoom)
    gl.uniform1f(su['uPointSize'], Math.max(1, cellSize * camera.zoom * dpr))
    gl.uniform1f(su['uCellWorld'], cellSize)
    const spongeReady = this.texSpongeDry && this.texSpongeWet
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texSpongeDry)
    gl.uniform1i(su['uTexDry'], 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, this.texSpongeWet)
    gl.uniform1i(su['uTexWet'], 1)
    gl.activeTexture(gl.TEXTURE0)
    gl.uniform1f(su['uHasSponge'], spongeReady ? 1 : 0)
    gl.bindVertexArray(this.spongeVao)
    gl.drawArrays(gl.POINTS, 0, totalCells)
    gl.bindVertexArray(null)
  }
}
