// Rendu métaballes en deux passes (§11) :
//   A. chaque particule est un splat gaussien additif dans un champ basse
//      résolution (R = champ, G = champ·vitesse, B = champ·appartenance) ;
//   B. seuillage du champ plein écran + trame de repère procédurale du décor.

import type { FluidSim } from '../sim/solver'
import { KIND_PLAYER } from '../sim/solver'
import type { SimParams } from '../sim/params'
import type { DecalDef, ObstacleBox } from '../game/level'
import type { Camera } from './camera'

const MAX_BOXES = 24

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
  // Amplitude compensée : l'aire de l'ellipse a grandi de (1 + s)
  float gas = clamp(-vState, 0.0, 1.0);
  float f = t * t * uFieldScale / (1.0 + vStretch) * (1.0 - 0.25 * gas);
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

const COMPOSE_FS = `#version 300 es
precision highp float;
#define MAX_BOXES 24
#define MAX_WAVES 8
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
uniform float uBoxMats[MAX_BOXES]; // 0 mur, 1 hydrophile, 2 hydrophobe, 3 sas
uniform float uTime;
uniform float uExitRadius; // portée de l'aspiration du sas (halo de courant)
uniform float uColdBand;   // portée de l'aura de gel des plaques froides
uniform float uHeatBand;   // portée de l'aura de chaleur des radiateurs
uniform float uHydroBand;  // portée de la chimie des surfaces (hydrophile/phobe)
uniform float uChill;      // refroidissement du vaisseau (0 tiède, 1 glacial)
uniform int uWaveCount;
uniform vec4 uWaves[MAX_WAVES]; // x, y, instant de départ, amplitude
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
    if (h < 0.32) {
      vec2 c = (g + vec2(hash21(g + 3.1), hash21(g + 7.7))) * cell;
      float d = length(world - c);
      float r = max(3.4, 2.4 / zoom); // jamais sous-pixel : pas de scintillement
      float core = smoothstep(r, r * 0.2, d);
      float halo = exp(-d / (r * 7.0)) * 0.4;
      float per = 1.8 + 5.5 * hash21(g + 11.3);
      float ph = hash21(g + 19.1) * per;
      float blink = hash21(g + 23.7) < 0.66
        ? 0.35 + 0.65 * pow(0.5 + 0.5 * sin((t + ph) * 6.2831 / per), 2.0)
        : 0.85;
      float ch = hash21(g + 31.3);
      vec3 tint = ch < 0.60 ? vec3(0.22, 1.00, 0.82)  // turquoise : nominal
                : ch < 0.88 ? vec3(1.00, 0.62, 0.22)  // ambre : en veille
                            : vec3(1.00, 0.26, 0.20); // rouge : une alarme oubliée
      acc += tint * (core * 0.95 + halo * 1.3) * blink * vis;
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
    acc += vec3(0.55, 0.80, 1.00) * burst * exp(-pd / 190.0) * 0.30;
  }

  // 3. Poussières en dérive, deux profondeurs : les lentes au loin, les
  //    rapides près de l'œil — le volume de la cuve se sent.
  acc += vec3(0.10, 0.17, 0.22) * specks(world + vec2(t * 3.0, -t * 1.6), 150.0, 0.05, zoom) * 0.55;
  acc += vec3(0.14, 0.22, 0.28) * specks(world + vec2(-t * 12.0, t * 5.0), 60.0, 0.05, zoom) * 0.40;

  // 4. Respiration des machines : une houle lumineuse très lente, très large,
  //    qui parcourt les parois — le vaisseau inspire.
  float breath = 0.5 + 0.5 * sin(t * 0.33 + vnoise(world * 0.0006) * 6.2831);
  acc += vec3(0.014, 0.030, 0.042) * breath;

  return acc;
}

// distance signée à une boîte (négatif à l'intérieur)
float boxSdf(vec2 world, vec4 b) {
  vec2 c = (b.xy + b.zw) * 0.5;
  vec2 half_ = (b.zw - b.xy) * 0.5;
  vec2 q = abs(world - c) - half_;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

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
    float neb = vnoise(world * 0.0016 + vec2(3.7, 1.3));
    neb = neb * 0.6 + 0.4 * vnoise(world * 0.004 - vec2(1.1, 7.7));
    voidCol += vec3(0.010, 0.018, 0.038) * neb;
    voidCol += vec3(0.022, 0.010, 0.034) * vnoise(world * 0.0009 + 21.0);
    voidCol += vec3(0.50, 0.60, 0.75) * specks(world + uCenter * 0.5, 130.0, 0.10, uZoom) * 0.55;
    voidCol += vec3(0.75, 0.82, 0.95) * specks(world + 500.0, 200.0, 0.08, uZoom) * 0.85;
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
  float caus = vnoise(world * 0.012 + vec2(uTime * 0.05, -uTime * 0.03));
  caus *= vnoise(world * 0.03 - vec2(uTime * 0.02, uTime * 0.04));
  tank += vec3(0.010, 0.028, 0.040) * caus;
  float lw = 1.2 / uZoom;
  float gridDim = uHasTank > 0.5 ? 0.5 : 1.0; // la texture a ses propres lignes
  tank += vec3(0.05, 0.09, 0.13) * gridLine(world, 100.0, lw) * 0.30 * gridDim;
  tank += vec3(0.07, 0.12, 0.17) * gridLine(world, 500.0, lw * 1.6) * 0.45 * gridDim;
  // halo le long des parois : la cuve est éclairée par sa coque
  tank += vec3(0.020, 0.045, 0.060) * exp(min(0.0, roomD) * 0.02);
  // la vie du vaisseau : veilleuses, poussières en dérive, respiration
  tank += shipLife(world, uZoom, uTime);

  vec3 col = mix(voidCol, tank, inRoom);

  // La coque : bande procédurale d'intérim — la passe texturée (dessinée
  // par-dessus quand l'image est chargée) la remplace.
  float hull = smoothstep(-1.0, 2.0, roomD) * (1.0 - smoothstep(20.0, 34.0, roomD));
  vec3 hullCol = vec3(0.055, 0.085, 0.115) * (0.85 + 0.15 * sin(roomD * 0.9));
  col = mix(col, hullCol, hull * (1.0 - uHasHull));
  float wallLine = 1.0 - smoothstep(0.0, 3.0 / uZoom, abs(roomD));
  col += vec3(0.10, 0.22, 0.30) * wallLine * (1.0 - 0.8 * uHasHull);

  // Textures des matériaux : prélevées hors des branches (flux de contrôle
  // uniforme requis par les mipmaps), utilisées dans la boucle d'obstacles.
  // Les deux parois alternent selon un bruit très basse fréquence : les longs
  // murs cessent de répéter le même motif d'un bout à l'autre du tableau.
  vec3 texWallC = texture(uTexWall, world / 230.0).rgb;
  if (uHasWallA > 0.5) {
    vec3 wallA = texture(uTexWallA, world / 520.0).rgb;
    float blend = smoothstep(0.35, 0.65, vnoise(world * 0.0011 + 5.3));
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
  float drainEye = 0.0; // œil du sas, retenu pour assombrir l'eau qui y coule
  for (int bi = 0; bi < MAX_BOXES; bi++) {
    if (bi >= uBoxCount) break;
    float d = boxSdf(world, uBoxes[bi]);
    float mat = uBoxMats[bi];
    // Ombre portée douce autour de chaque solide (sauf le sas) : les blocs
    // se détachent du fond au lieu de flotter — la cuve prend de la
    // profondeur, les rectangles cessent d'être des aplats.
    if (mat < 2.5 || mat > 3.5) {
      float shade = 1.0 - smoothstep(0.0, 56.0, max(d, 0.0));
      col = mix(col, col * vec3(0.50, 0.56, 0.70), shade * shade * 0.5);
    }
    if (mat < 2.5) {
      float fill = 1.0 - smoothstep(-edgeW, 0.0, d);
      float edge = 1.0 - smoothstep(0.0, edgeW, abs(d));
      vec3 fillCol; vec3 edgeCol;
      if (mat < 0.5) {        // mur neutre : métal brossé
        fillCol = uHasWall > 0.5
          ? texWallC * 0.95
          : vec3(0.10, 0.13, 0.17) * (0.88 + 0.24 * vnoise(world * vec2(0.03, 0.30)));
        edgeCol = vec3(0.30, 0.38, 0.46);
      } else if (mat < 1.5) { // hydrophile : mouillé, brillant, reflet qui glisse
        float sheen = 0.5 + 0.5 * sin(world.x * 0.045 + world.y * 0.10 + uTime * 0.7);
        fillCol = uHasPhile > 0.5
          ? texPhileC * (0.85 + 0.25 * sheen)
          : vec3(0.05, 0.16, 0.20) + vec3(0.015, 0.055, 0.065) * sheen;
        edgeCol = vec3(0.20, 0.65, 0.70);
      } else {                // hydrophobe : cireux, grain perlé qui repousse
        float wax = smoothstep(0.72, 0.95, vnoise(world * 0.12));
        fillCol = uHasPhobe > 0.5
          ? texPhobeC * 0.75
          : vec3(0.16, 0.11, 0.20) + vec3(0.07, 0.035, 0.10) * wax;
        edgeCol = vec3(0.62, 0.42, 0.78);
      }
      col = mix(col, fillCol, fill);
      col = mix(col, edgeCol, edge * 0.9);
      if (mat > 0.5) {
        // L'aura dit la portée : une brume diffuse sur toute la bande
        // d'influence, sur le modèle de la chaleur du radiateur — turquoise
        // qui aspire (hydrophile), violette qui repousse (hydrophobe).
        // Atténuation LINÉAIRE : la brume emplit toute la bande au lieu de
        // s'écraser contre le mur — à n'importe quel zoom, le champ se voit
        float aura = (1.0 - smoothstep(0.0, uHydroBand, max(d, 0.0))) * step(0.0, d);
        float mist = 0.5 + 0.5 * vnoise(world * 0.045 + vec2(uTime * 0.10, -uTime * 0.07));
        vec3 auraCol = mat < 1.5 ? vec3(0.12, 0.42, 0.45) : vec3(0.38, 0.20, 0.52);
        col += auraCol * aura * (0.45 + 0.55 * mist);
      }
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
      float aura = (1.0 - smoothstep(0.0, uHeatBand, max(d, 0.0))) * step(0.0, d);
      float shimmer = 0.55 + 0.45 * vnoise(world * 0.06 + vec2(-uTime * 0.16, uTime * 0.24));
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
        barCol = vec3(0.17, 0.21, 0.26) * (0.9 + 0.2 * vnoise(world * 0.15));
      }
      col = mix(col, barCol, fill * (1.0 - hole * 0.85));
      col = mix(col, vec3(0.45, 0.60, 0.70), edge * 0.8);
    } else if (mat > 3.5) {
      // Plaque froide (tableau 2) : givre cristallin, arête pâle, et une
      // aura de brume glacée — le danger se lit avant le contact.
      float fill = 1.0 - smoothstep(-edgeW, 0.0, d);
      float edge = 1.0 - smoothstep(0.0, edgeW, abs(d));
      float sparkle = smoothstep(0.72, 0.94, vnoise(world * 0.22));
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
      float mist = 0.55 + 0.45 * vnoise(world * 0.05 + vec2(uTime * 0.10, -uTime * 0.06));
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
  // Fumée : bruit advecté à deux octaves — volutes internes et bords rongés
  float smokeN = vnoise(world * 0.045 + vec2(uTime * 0.22, -uTime * 0.15));
  smokeN = 0.62 * smokeN + 0.38 * vnoise(world * 0.11 - vec2(uTime * 0.31, -uTime * 0.24));

  float field2 = field * (1.0 + 0.14 * waveGlow);
  // Les bords du nuage bouillonnent : le bruit ronge et gonfle la surface
  field2 *= 1.0 + vap * (smokeN - 0.5) * 1.1;
  float body = smoothstep(th - s, th + s, field2);
  // La fumée est trouée et translucide par endroits
  body *= 1.0 - vap * (0.2 + 0.4 * smokeN);

  float speedT = clamp(speed, 0.0, 1.0);
  vec3 slow = vec3(0.07, 0.30, 0.48);
  vec3 fast = vec3(0.55, 0.85, 0.95);
  vec3 water = mix(slow, fast, speedT);
  water = mix(water * 0.40, water, clamp(player, 0.0, 1.0)); // eau libre plus sombre

  // Relief : pseudo-normale sur un champ FLOUTÉ (4 prélèvements écartés) —
  // les dérivées par pixel liraient chaque particule comme une bille.
  vec2 texel = 2.5 / vec2(textureSize(uField, 0));
  float fL = texture(uField, uv - vec2(texel.x, 0.0)).r;
  float fR = texture(uField, uv + vec2(texel.x, 0.0)).r;
  float fB = texture(uField, uv - vec2(0.0, texel.y)).r;
  float fT = texture(uField, uv + vec2(0.0, texel.y)).r;
  vec2 grad = vec2(fR - fL, fT - fB) / uFieldScale;
  vec3 nrm = normalize(vec3(-grad * 2.2, 1.0));
  vec3 lightDir = normalize(vec3(-0.35, 0.55, 0.75));
  float diffuse = max(dot(nrm, lightDir), 0.0);
  float specular = pow(max(reflect(-lightDir, nrm).z, 0.0), 12.0);

  // Cœur plus dense légèrement plus sombre, liseré plus clair
  float core = smoothstep(th * 1.8, th * 3.2, field2);
  water = mix(water, water * 0.75, core * 0.5);
  float rim = body * (1.0 - smoothstep(th + s, th * 1.9, field2));
  water += vec3(0.20, 0.45, 0.55) * rim * 0.55 * (1.0 - vap);

  // Scintillement interne discret : l'eau vit même au repos
  float shimmer = sin(world.x * 0.11 + uTime * 1.6) * sin(world.y * 0.09 - uTime * 1.2);
  water *= 1.0 + 0.05 * shimmer * core;

  // Le relief n'éclaire que la zone de surface : à l'intérieur, les
  // fluctuations de densité ne sont pas du relief — sans ce masque, l'eau
  // se couvre de reflets granuleux qui trahissent les particules.
  float surfaceZone = body * (1.0 - smoothstep(th * 1.4, th * 2.6, field2));
  water = mix(water, water * (0.55 + 0.75 * diffuse), surfaceZone * 0.55);
  water += vec3(0.85, 0.95, 1.0) * specular * 0.35 * surfaceZone * (1.0 - vap);
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

  col = mix(col, water, body);
  // L'eau qui recouvre l'œil du sas s'assombrit : elle sombre dans le trou
  col *= 1.0 - drainEye * body * 0.55;
  // Le vaisseau refroidit (§5) : la lumière vire au bleu et faiblit — la
  // pression temporelle se voit, elle ne se chronomètre pas
  col = mix(col, col * vec3(0.82, 0.92, 1.10), uChill * 0.6);
  col *= 1.0 - 0.12 * uChill;
  outColor = vec4(col, 1.0);
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
out vec4 outColor;
void main() {
  vec4 t = texture(uTexDecal, vUv);
  vec3 c = t.rgb * vec3(0.52, 0.62, 0.72); // refroidi, fondu dans la cuve
  outColor = vec4(c, t.a * uFade);
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
  private texDecalTuyaux: WebGLTexture | null = null
  private texDecalVanne: WebGLTexture | null = null
  // Textures d'habillage : null tant que l'image n'est pas chargée — le
  // décor procédural assure l'intérim, l'image prend le relais sans à-coup.
  private texStars: WebGLTexture | null = null
  private texStarsFar: WebGLTexture | null = null
  private texTank: WebGLTexture | null = null
  private texWall: WebGLTexture | null = null
  private texWallA: WebGLTexture | null = null
  private texFroid: WebGLTexture | null = null
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
  private readonly matScratch = new Float32Array(MAX_BOXES)
  private readonly floatField: boolean
  private fieldScale: number
  private fbo: WebGLFramebuffer | null = null
  private fieldTex: WebGLTexture | null = null
  private fboW = 0
  private fboH = 0
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
    for (const [name, program] of [
      ['splat', this.splatProgram],
      ['compose', this.composeProgram],
      ['sponge', this.spongeProgram],
      ['hull', this.hullProgram],
      ['decal', this.decalProgram],
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
    const boxCount = Math.min(boxes.length, MAX_BOXES)
    for (let i = 0; i < boxCount; i++) {
      const bx = boxes[i]
      this.boxScratch[i * 4] = bx.minX
      this.boxScratch[i * 4 + 1] = bx.minY
      this.boxScratch[i * 4 + 2] = bx.maxX
      this.boxScratch[i * 4 + 3] = bx.maxY
      this.matScratch[i] = bx.material
    }
    gl.uniform1i(cu['uBoxCount'], boxCount)
    gl.uniform4fv(cu['uBoxes[0]'], this.boxScratch)
    gl.uniform1fv(cu['uBoxMats[0]'], this.matScratch)
    gl.uniform1f(cu['uTime'], timeSec)
    gl.uniform1f(cu['uExitRadius'], params.exitRadius)
    // les auras dessinées suivent la physique refroidie (mêmes formules que
    // le solveur) : le danger se lit toujours à sa vraie portée
    gl.uniform1f(cu['uColdBand'], params.coldBand * (1 + params.chillColdGrowth * chill))
    gl.uniform1f(cu['uHeatBand'], Math.max(0, params.heatBand * (1 - params.chillHeatFade * chill)))
    gl.uniform1f(cu['uHydroBand'], params.hydroBand)
    gl.uniform1f(cu['uChill'], chill)
    gl.uniform1i(cu['uWaveCount'], waveCount)
    gl.uniform4fv(cu['uWaves[0]'], waves)
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
    bindTex(3, this.texPhobe, 'uTexPhobe', 'uHasPhobe')
    bindTex(4, this.texPhile, 'uTexPhile', 'uHasPhile')
    bindTex(5, this.texIris, 'uTexIris', 'uHasIris')
    gl.uniform1f(cu['uHasHull'], this.texHull ? 1 : 0)
    gl.activeTexture(gl.TEXTURE0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    // Passe B bis — coque texturée autour de la cuve
    this.drawHull(sim, camera, viewportW, viewportH)

    // Passe B ter — décalques de décor (tuyaux, vannes)
    this.drawDecals(decals, camera, viewportW, viewportH)

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
  ): void {
    if (decals.length === 0) return
    const gl = this.gl
    const du = this.uniforms['decal']
    let started = false
    for (const d of decals) {
      const tex = d.kind === 'vanne' ? this.texDecalVanne : this.texDecalTuyaux
      if (!tex) continue
      if (!started) {
        started = true
        gl.useProgram(this.decalProgram)
        gl.uniform2f(du['uCenter'], camera.x, camera.y)
        gl.uniform2f(du['uViewport'], viewportW, viewportH)
        gl.uniform1f(du['uZoom'], camera.zoom)
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
