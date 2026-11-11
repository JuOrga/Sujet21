// LE MODULE EN 2D DE FACE autour de la salle (render/module2d.ts) : une toile
// composée hors du moteur (module2dCanvas.ts), posée dans le monde comme un
// seul quad. Rien ne s'en peint dans la salle — la salle y est encastrée.
//
// Dans son propre fichier (il vivait dans renderer.ts) : le banc d'aperçu le
// compile sans monter le moteur, et un test tient ses uniformes alignés sur
// ceux que le moteur lui envoie (module2dShader.spec.ts).
export const MODULE2D_VS = `#version 300 es
uniform vec4 uQuad;      // ce que le quad couvre : la toile, ou la salle (la couverture)
uniform vec2 uCenter;
uniform vec2 uViewport;
uniform float uZoom;
out vec2 vMonde;
void main() {
  int i = gl_VertexID;
  vec2 c = vec2((i == 1 || i == 2 || i == 4) ? 1.0 : 0.0, (i == 2 || i == 4 || i == 5) ? 1.0 : 0.0);
  vMonde = mix(uQuad.xy, uQuad.zw, c);
  gl_Position = vec4((vMonde - uCenter) * uZoom / (uViewport * 0.5), 0.0, 1.0);
}`

export const MODULE2D_FS = `#version 300 es
precision highp float;
in vec2 vMonde;
uniform sampler2D uToile;
uniform vec4 uRect;
uniform vec4 uSalle;
uniform sampler2D uProche; // la toile PROCHE, plus fine, autour de la salle
uniform vec4 uRectP;
uniform float uHasP;
uniform vec4 uCoque;     // la salle et sa coque : le décor s'y fond
uniform float uMode;     // 0 : autour de la salle ; 1 : la COUVERTURE de la transition
uniform vec4 uCouv;      // la cellule qui grossit, dans le monde
uniform float uCouvA;    // à quel point elle cache la salle
uniform sampler2D uCellule;
uniform float uRatioCellule; // hauteur / largeur de l'image de la cellule ; 0 : étirée
uniform float uOmbre;    // l'ombre de la salle sur le décor : 1 en jeu, 0 tant qu'elle n'est qu'une cellule
uniform float uTemps;    // secondes ; 0 : rien ne bouge (« moins d'animations »)
out vec4 outColor;
// LE MODULE RESPIRE : ce qui luit sur la toile — les vitrages, les voyants,
// la lueur des tubes praticables — bat doucement, en une onde qui court vers
// la DROITE, le sens de la descente. La toile est une image fixe : sans cela
// le module était un fond d'écran derrière une salle vivante (relecture du
// 10/11). Ce qui luit se reconnaît à l'image même — clair ET coloré —, sans
// seconde texture : la tôle, grise, ne bouge pas.
vec3 respire(vec3 c, vec2 m) {
  if (uTemps <= 0.0) return c;
  float haut = max(c.r, max(c.g, c.b));
  float luit = smoothstep(0.26, 0.6, haut) * smoothstep(0.08, 0.26, haut - min(c.r, min(c.g, c.b)));
  vec2 q = m / (uCoque.z - uCoque.x);
  return c * (1.0 + luit * 0.17 * sin(uTemps * 1.7 - q.x * 2.6 + 1.4 * sin(q.y * 1.9)));
}
// LA CELLULE TIENT À SES PROPORTIONS, centrée dans son rectangle : étirée à
// la forme de la salle, la capsule de la serre (2,4 fois plus large que
// haute) se déformait en grossissant (05/10). Rend ses coordonnées, hors de
// [0, 1] en dehors de l'image.
vec2 dansCellule(vec2 p, vec4 r) {
  vec2 t = r.zw - r.xy;
  vec2 k = (p - r.xy) / t;
  float rr = t.y / t.x;
  // les autres cellules, rectangles pleins, restent étirées : tenues à leurs
  // proportions, elles laissaient des bandes sur les côtés de la salle
  if (uRatioCellule > 0.0) {
    if (uRatioCellule < rr) k.y = (k.y - 0.5) * rr / uRatioCellule + 0.5;
    else k.x = (k.x - 0.5) * uRatioCellule / rr + 0.5;
  }
  return vec2(k.x, 1.0 - k.y);
}
void main() {
  bool dansSalle = all(greaterThan(vMonde, uSalle.xy)) && all(lessThan(vMonde, uSalle.zw));
  if (uMode < 0.5 && dansSalle) discard;
  // LE FONDU AU BORD DE LA SALLE : la limite était une coupure nette entre
  // la salle et le décor (aperçu du 02/10). Contre la coque, le décor est
  // dans l'OMBRE de la salle et légèrement FLOU, comme une profondeur de
  // champ ; à une demi-salle, il est net et pleinement éclairé.
  vec2 dd = max(max(uCoque.xy - vMonde, vMonde - uCoque.zw), 0.0);
  float d = length(dd) / (uCoque.z - uCoque.x);
  // (le flou réduit de 2,2 à 1,0 crans le 06/10 : zoomé sur la salle, on ne
  // voit presque que cette bande, et le décor y paraissait flou partout)
  // LA COUVERTURE (mode 1) PEINT LE MÊME DÉCOR que le mode 0 — même flou,
  // même ombre : elle déborde de la salle (main.ts la gonfle de la frange de
  // la coque), et la moindre différence dessinait le bord de son quad
  float flou = uMode > 1.5 ? 0.0 : uOmbre * (1.0 - smoothstep(0.0, 0.14, d));
  // la toile a son origine EN HAUT (une toile 2D) : v descend avec y
  vec2 uv = vec2((vMonde.x - uRect.x) / (uRect.z - uRect.x), (uRect.w - vMonde.y) / (uRect.w - uRect.y));
  vec4 c = texture(uToile, uv, flou);
  if (uHasP > 0.5) {
    // près de la salle, la toile fine ; elle se fond dans l'autre sur ses bords
    vec2 up = vec2((vMonde.x - uRectP.x) / (uRectP.z - uRectP.x), (uRectP.w - vMonde.y) / (uRectP.w - uRectP.y));
    vec2 b = min(up, 1.0 - up);
    float w = smoothstep(0.0, 0.06, min(b.x, b.y));
    if (w > 0.0) c = mix(c, texture(uProche, up, flou), w);
  }
  if (uMode < 1.5) c.rgb = respire(c.rgb, vMonde);
  // l'ombre s'efface quand la salle n'est qu'une cellule (uOmbre, voir
  // module2d.ts, EtatTransition) : elle cernait un trou de salle vide
  if (uMode < 1.5) c.rgb *= mix(1.0, mix(0.32, 1.0, smoothstep(0.0, 0.45, d)), uOmbre);
  if (uMode > 1.5) {
    // la cellule quittée, peinte nette sur son quad
    vec2 k = dansCellule(vMonde, uCouv);
    if (any(lessThan(k, vec2(0.0))) || any(greaterThan(k, vec2(1.0)))) discard;
    outColor = texture(uCellule, k);
    return;
  }
  if (uMode > 0.5) {
    // LA TRANSITION : sur la salle, la tôle du module, et la cellule choisie
    // qui grossit — la salle n'apparaît qu'une fois la cellule à sa taille
    vec2 k = dansCellule(vMonde, uCouv);
    if (all(greaterThanEqual(k, vec2(0.0))) && all(lessThanEqual(k, vec2(1.0)))) {
      // une capsule détourée laisse voir la toile autour d'elle
      vec4 tx = texture(uCellule, k);
      c = tx + c * (1.0 - tx.a);
    }
    c *= uCouvA;
  }
  outColor = c;
}`
