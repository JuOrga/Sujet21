// LE RELIEF 2.5D DES PAROIS, RÉPARÉ (volume des parois, volet 1) — les
// règles pures. Le shader de composition en reçoit le jumeau GLSL
// (RELIEF_PAROIS_GLSL, généré ici) ; reliefParois.spec.ts tient les deux.
//
// Le relief allumé, le SOMMET de chaque solide fuit le centre de l'écran
// (le dessus d'une paroi haute est plus près de l'œil que son pied) et la
// tranche se révèle du côté qui regarde le centre. La physique, elle, reste
// sur la BASE : c'est au pied que le fluide touche. Trois choses en
// découlent, que le relief d'avant ignorait :
//  - la longueur du flanc suit la hauteur de l'élément (volume.ts) : une
//    plaque basse ne se dresse pas comme un mur ;
//  - là où le sommet déplacé recouvre le sol au-delà du pied, ce sol ne se
//    voit plus — ni le fluide qui touche le pied, ni ce qui se pose au sol ;
//  - ce qui est plaqué sur un dessus (les décalques d'un mur) suit son sommet.
import { HAUTEUR_BLOCS } from './hauteurs'
import { glslFloat } from './surfacesSculptees'
import { MAT_GRILLE, MAT_MEMBRANE, MAT_RIDEAU } from '../game/level'

/** Les solides que le fluide TRAVERSE, sous l'une de ses phases (level.ts) :
 *  la vapeur passe l'évent, l'eau la membrane, la glace le rideau. Leur base
 *  peut contenir du fluide ; celle d'un étanche, rien que la lisière qui
 *  touche son pied. */
export const MATIERES_PERMEABLES: readonly number[] = [MAT_GRILLE, MAT_MEMBRANE, MAT_RIDEAU]

/** La part du déplacement que prend le sommet d'un solide de hauteur `h` :
 *  sa hauteur sur celle d'un mur haut. Le mur haut (HAUTEUR_BLOCS) garde le
 *  flanc d'avant ; un hydro moyen n'en prend que 90/140, une plaque basse
 *  40/140. Bornée au mur haut, comme la coque l'est pour l'image (volume.ts :
 *  hauteurPropre) — sinon une cloison de modules (2400) jaillirait de
 *  l'écran. */
export function facteurRelief(h: number): number {
  return Math.min(Math.max(h, 0), HAUTEUR_BLOCS) / HAUTEUR_BLOCS
}

/** Le relief s'efface au zoom de carte (en dessous de ~0,8) : de loin, des
 *  sommets qui glissent donneraient le mal de mer. La même formule que le
 *  shader (`clamp(uZoom * 1.2, 0, 1)`). */
export function fonduRelief(zoom: number): number {
  return Math.min(Math.max(zoom * 1.2, 0), 1)
}

/** La fraction `f` dont le sommet d'un solide de hauteur `h` s'écarte du
 *  centre de l'écran : le shader montre, au point `w` de l'écran, le sommet
 *  du point `c + (w − c)(1 − f)` de la base (`k` : RELIEF_K, main.ts). */
export function fractionSommet(k: number, zoom: number, h: number): number {
  return k * fonduRelief(zoom) * facteurRelief(h)
}

/** Où se voit, relief allumé, le point (x, y) du DESSUS d'un solide : la
 *  réciproque de la règle du shader. Un décalque plaqué sur le mur y pose
 *  ses sommets ; f = 0 le laisse où il est. */
export function pointDuSommet(
  x: number,
  y: number,
  cx: number,
  cy: number,
  f: number,
): [number, number] {
  const s = 1 / (1 - f)
  return [cx + (x - cx) * s, cy + (y - cy) * s]
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

/** Le SOL QUE LE SOLIDE CACHE, 0..1, en un pixel : `relief` le relief du
 *  moment (uRelief : 0 éteint), `d` la distance signée à la base, `dV` au
 *  sommet déplacé, `flanc` la tranche peinte ici (0..1), `w` le fondu d'un
 *  pixel. UNE règle : un dessus opaque cache ce qui est dessous.
 *  - RELIEF ÉTEINT, ELLE VAUT 0, quoi qu'on lui passe d'autre. Relief éteint,
 *    le sommet ne bouge pas (dV = d) : sur la base, 1 − smoothstep(−w, 0, d)
 *    vaut 1, et la règle seule cacherait le fluide dans tout solide —
 *    membrane, rideau, évent : par défaut. La garde uRelief du shader ne
 *    suffisait pas à le tenir (relecture finale : un appel sorti de sa garde,
 *    toute la suite restait verte) ; la règle le tient elle-même.
 *  - Partout où le dessus couvre le pixel, le sol est caché — au-delà du
 *    pied du côté où il déborde (le fluide qui touche le pied passe dessous),
 *    et sur la base aussi. Un solide étanche n'y contient rien (seule la
 *    lisière des splats y déborde) ; un PERMÉABLE (membrane, évent, rideau)
 *    y laisse passer le fluide, qui entre sous le dessus et ressort au-delà
 *    du débord, sans couture. (La première règle ne cachait la base que du
 *    côté du débord : le fluide qui traversait une membrane s'arrêtait net au
 *    milieu de son dessus — vu au banc, tableau 9, relecture R4.)
 *  - Hors de la base, la tranche est peinte (une face latérale vue de
 *    biais) : le sol derrière elle est caché.
 *  - Côté où le pied se voit (la tranche sur la base, d ≤ 0, hors du dessus) :
 *    sur un ÉTANCHE, rien n'est caché — la base n'y contient que la lisière
 *    du fluide, qui touche le bas du flanc. Sur un PERMÉABLE (`permeable` 1),
 *    la base contient le fluide qui le traverse : il se peignait sur toute la
 *    face latérale, devant une face opaque — l'eau se lisait devant le mur
 *    (relecture finale, mineur 1). Il y est caché, sauf une bande de pied
 *    d'environ `w`, où il touche le bas du flanc comme ailleurs.
 *  - `opacite` : celle du dessus (1 ; la vitre, 0,32 à 1) — sous un verre, on
 *    voit le sol au travers. Sa tranche (le dormant) reste opaque.
 *  Le shader ne l'appelle que relief allumé (sous uRelief > 0) : relief
 *  éteint, ni calcul ni changement. */
export function solCache(
  relief: number,
  d: number,
  dV: number,
  flanc: number,
  w: number,
  opacite = 1,
  permeable = 0,
): number {
  if (!(relief > 0)) return 0
  const sommet = (1 - smoothstep(-w, 0, dV)) * opacite
  const tranche = d > 0 ? flanc : flanc * permeable * smoothstep(0.5 * w, 1.5 * w, -d)
  return Math.max(sommet, tranche)
}

/** LE FLANC D'UNE BOÎTE, BALAYÉ EXACTEMENT. Le point `p` (dans le repère de
 *  la boîte `b` = minX, minY, maxX, maxY) est sur la tranche s'il existe un
 *  t de [0, 1] tel que `p − t·r` soit dans la boîte : t = 0 le pied, t = 1
 *  le sommet (`r` le déplacement du sommet, dans le même repère). Rend
 *  [distance signée au balayage, hauteur vue].
 *  POURQUOI pas des échantillons : le flanc était la réunion de cinq copies
 *  de la boîte (pied, ¼, ½, ¾, sommet) ; au coin LIBRE d'une paroi, le bord
 *  en biais du flanc tombait en escalier — quatre marches, « l'affichage
 *  pose problème là où c'est en contact » (le concepteur, 16/11, les
 *  hydrophobes isolées et la porte D2).
 *  - Dedans : l'intervalle des t qui tombent dans la boîte se lit axe par axe
 *    (les « tranches » d'un lancer de rayon). La hauteur vue est sa borne
 *    haute — le DERNIER passage du dedans au dehors en montant ; la distance,
 *    celle de la boîte au milieu de l'intervalle (négative, nulle au bord).
 *  - Dehors : la distance d'un segment à un rectangle qu'il ne coupe pas —
 *    le plus court de ses deux bouts à la boîte et des quatre coins au
 *    segment. Exacte : le bord en biais est une droite. La hauteur vue est
 *    celle du point le plus proche (le liseré d'anticrénelage suit la
 *    tranche). */
export function flancBalaye(
  px: number,
  py: number,
  b: readonly number[],
  rx: number,
  ry: number,
): [number, number] {
  const boite = (x: number, y: number): number => {
    const qx = Math.abs(x - (b[0] + b[2]) * 0.5) - (b[2] - b[0]) * 0.5
    const qy = Math.abs(y - (b[1] + b[3]) * 0.5) - (b[3] - b[1]) * 0.5
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0)
  }
  let t0 = 0
  let t1 = 1
  const tranche = (p: number, r: number, lo: number, hi: number): void => {
    if (Math.abs(r) < 1e-6) {
      if (p < lo || p > hi) t0 = 2
      return
    }
    const a = (p - hi) / r
    const c = (p - lo) / r
    t0 = Math.max(t0, Math.min(a, c))
    t1 = Math.min(t1, Math.max(a, c))
  }
  tranche(px, rx, b[0], b[2])
  tranche(py, ry, b[1], b[3])
  if (t0 <= t1) {
    const tm = 0.5 * (t0 + t1)
    return [Math.min(boite(px - tm * rx, py - tm * ry), 0), t1]
  }
  let d = boite(px, py)
  let t = 0
  const d1 = boite(px - rx, py - ry)
  if (d1 < d) {
    d = d1
    t = 1
  }
  const rr = Math.max(rx * rx + ry * ry, 1e-6)
  for (const [cx, cy] of [
    [b[0], b[1]],
    [b[2], b[1]],
    [b[0], b[3]],
    [b[2], b[3]],
  ]) {
    const tc = Math.min(Math.max(((px - cx) * rx + (py - cy) * ry) / rr, 0), 1)
    const dc = Math.hypot(px - tc * rx - cx, py - tc * ry - cy)
    if (dc < d) {
      d = dc
      t = tc
    }
  }
  return [d, t]
}

/** Les règles en GLSL, pour le shader de composition. */
export const RELIEF_PAROIS_GLSL = `// (reliefParois.ts : les règles et leur jumeau TypeScript)
float facteurRelief(float h) {
  return clamp(h, 0.0, ${glslFloat(HAUTEUR_BLOCS)}) / ${glslFloat(HAUTEUR_BLOCS)};
}
bool matPermeable(float mat) {
  return ${MATIERES_PERMEABLES.map((m) => `abs(mat - ${glslFloat(m)}) < 0.5`).join(' || ')};
}
float solCache(float relief, float d, float dV, float flanc, float w, float opacite, float permeable) {
  if (relief <= 0.0) return 0.0;
  float sommet = (1.0 - smoothstep(-w, 0.0, dV)) * opacite;
  float tranche = d > 0.0 ? flanc : flanc * permeable * smoothstep(0.5 * w, 1.5 * w, -d);
  return max(sommet, tranche);
}
// le flanc d'une boîte, balayé exactement (flancBalaye, reliefParois.ts) :
// (distance signée au balayage, hauteur vue). La boîte se mesure ici, à la
// main : boxSdf vient plus loin dans le shader.
float boiteFlanc(vec2 p, vec4 b) {
  vec2 q = abs(p - (b.xy + b.zw) * 0.5) - (b.zw - b.xy) * 0.5;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}
vec2 flancBalaye(vec2 p, vec4 b, vec2 r) {
  float t0 = 0.0;
  float t1 = 1.0;
  for (int k = 0; k < 2; k++) {
    float pk = k == 0 ? p.x : p.y;
    float rk = k == 0 ? r.x : r.y;
    float lo = k == 0 ? b.x : b.y;
    float hi = k == 0 ? b.z : b.w;
    if (abs(rk) < 1e-6) {
      if (pk < lo || pk > hi) t0 = 2.0;
    } else {
      float a = (pk - hi) / rk;
      float c = (pk - lo) / rk;
      t0 = max(t0, min(a, c));
      t1 = min(t1, max(a, c));
    }
  }
  if (t0 <= t1) {
    float tm = 0.5 * (t0 + t1);
    return vec2(min(boiteFlanc(p - tm * r, b), 0.0), t1);
  }
  float d = boiteFlanc(p, b);
  float t = 0.0;
  float d1 = boiteFlanc(p - r, b);
  if (d1 < d) { d = d1; t = 1.0; }
  float rr = max(dot(r, r), 1e-6);
  for (int k = 0; k < 4; k++) {
    vec2 c = vec2(k == 0 || k == 2 ? b.x : b.z, k < 2 ? b.y : b.w);
    float tc = clamp(dot(p - c, r) / rr, 0.0, 1.0);
    float dc = length(p - tc * r - c);
    if (dc < d) { d = dc; t = tc; }
  }
  return vec2(d, t);
}
float solCache(float relief, float d, float dV, float flanc, float w) {
  return solCache(relief, d, dV, flanc, w, 1.0, 0.0);
}
`
