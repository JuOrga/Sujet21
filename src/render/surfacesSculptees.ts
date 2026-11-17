// LES SURFACES SCULPTÉES PAR LES LAMPES (volume des parois, volet 3).
//
// Le mur, la seconde paroi, les deux matières et les huit habillages avaient
// leur lumière PEINTE : le soleil de l'atelier, venu du haut, donnait à
// chaque rivet un côté clair et un côté sombre fixes, quelles que soient les
// lampes du tableau. Ils sont re-rendus sous une lumière neutre, et leur
// relief voyage dans la couche alpha de la même image (docs/assets-ia.md
// §37 : aucune unité de texture n'était libre). Sans la règle qui suit, ces
// surfaces paraissaient PLATES : la lumière peinte retirée, rien ne la
// remplaçait.
//
// La règle : trois lectures de l'alpha (au point, un pas plus loin en x, un
// pas plus loin en y) donnent la pente du dessus ; sa normale, éclairée
// depuis lampeDir (la direction dominante des lampes, ou la direction par
// défaut quand « Lumière » est éteint), module la couleur. Un dessus PLAT
// (alpha constant, et donc une image encore opaque) rend exactement 1 :
// rien ne change d'un dessus d'avant, sans artefact. Le shader de
// composition reçoit la même règle en GLSL (RELIEF_SURFACES_GLSL, générée
// ici) ; surfacesSculptees.spec.ts tient les deux.

/** Le carreau est rendu à 1024 px pour une largeur (§37) : la pente vraie
 *  entre deux texels voisins vaut Δalpha × profondeur × 1024. */
export const TEXELS_CARREAU = 1024

/** La profondeur du relief de chaque surface, en largeurs de carreau :
 *  l'élévation vaut alpha × profondeur (+ une constante). C'est elle qui
 *  accorde les surfaces entre elles (§37, mesurée par relief.py). */
export const PROFONDEUR_RELIEF = {
  wall: 0.0205,
  wallA: 0.0205,
  phile: 0.0051,
  phobe: 0.0157,
} as const

/** Les cases de paroi-atlas, chacune sa fenêtre, dans l'ordre des
 *  habillages (skin 1 à 8) : caissons, conduites, poutrelle, blindage,
 *  aération, hublots, écrans, câbles. Les conduites dépassent de 15 cm. */
export const PROFONDEUR_RELIEF_ATLAS: readonly number[] = [
  0.0248, 0.1005, 0.0391, 0.014, 0.0153, 0.041, 0.034, 0.0361,
]

/** La taille d'un carreau dans le MONDE, en unités : chaque surface se
 *  répète à son échelle (le shader de composition la lit d'ici, pour la
 *  couleur comme pour le relief). */
export const CARREAU_MONDE = {
  wall: 230,
  // la seconde paroi porte LE MÊME treillis que le mur : à la même échelle,
  // leurs nervures tombent l'une sur l'autre et le fondu ne mêle que les
  // accessoires. À 520 (son échelle d'avant l'isogrid), deux treillis de
  // pas différents se superposeraient dans le fondu.
  wallA: 230,
  phile: 210,
  phobe: 170,
} as const

/** De combien la pente est exagérée. À la pente vraie, la lumière ne
 *  rendait aux tuyaux des conduites qu'une rondeur discrète (simulation du
 *  14/11, B1) : leur reflet peint est parti avec la lumière peinte, c'est
 *  ce relief qui doit la rendre. */
export const EXAGERATION_RELIEF = 2.5

/** La lumière qui sculpte le relief : sa hauteur (la composante z du
 *  vecteur unitaire vers elle, sinus de son élévation) et sa part ambiante
 *  (ce que la face cachée garde, pour ne jamais tomber au noir). Une lampe
 *  rasante creuserait chaque rivet, une lampe au zénith n'en dirait rien. */
export const HAUTEUR_LUMIERE_RELIEF = 0.6
export const PART_AMBIANTE_RELIEF = 0.35

/** Le REFLET : l'acier renvoie la lampe sur la pente qui la regarde (vue
 *  du dessus, à mi-chemin de la lampe et de l'œil). La lumière neutre de
 *  l'atelier ne laisse aucun reflet dans les images (le ciel y est noir
 *  pour les reflets nets) : sans ce terme, un tuyau ne recevait qu'un
 *  modelé mat et ne se lisait pas rond. Seul ce qu'une pente AJOUTE au
 *  reflet d'un dessus plat compte : un dessus plat reste à 1. */
export const REFLET_RELIEF = 1.5
export const BRILLANCE_RELIEF = 24

/** Le pas le plus court des différences finies, en texels du carreau.
 *  L'alpha est quantifié sur 256 niveaux : d'un texel au suivant, un niveau
 *  d'écart vaut une pente de profondeur × 1024 / 255 (0,4 sur les
 *  conduites, avant l'exagération) — à un texel près, la lumière en
 *  faisait un grésil au zoom. Deux texels l'apaisent, un rivet en fait dix. */
export const PAS_MIN_TEXELS = 2

/** Le pas des différences finies, en unités monde : un pixel (`pxMonde`),
 *  là où se joue le niveau de détail lu — jamais moins de PAS_MIN_TEXELS
 *  texels du carreau : sous un texel, la rampe bilinéaire est plate par
 *  morceaux et la lumière facetterait le dessus ; à un seul, la
 *  quantification de l'alpha grésillait. */
export function pasRelief(carreau: number, pxMonde: number): number {
  return Math.max(pxMonde, (PAS_MIN_TEXELS * carreau) / TEXELS_CARREAU)
}

/** La pente du dessus (dh/dx, dh/dy, sans unité) tirée de trois lectures
 *  de l'alpha : au point (`a0`), un pas plus loin en x (`ax`) et en y
 *  (`ay`). L'élévation vaut alpha × profondeur × carreau (unités monde),
 *  la pente l'écart divisé par le pas — exagérée. */
export function penteRelief(
  a0: number,
  ax: number,
  ay: number,
  profondeur: number,
  carreau: number,
  pas: number,
): [number, number] {
  const k = ((profondeur * carreau) / pas) * EXAGERATION_RELIEF
  return [(ax - a0) * k, (ay - a0) * k]
}

/** La normale du dessus pour une pente : (0, 0, 1) sur un dessus plat. */
export function normaleRelief(s: readonly [number, number]): [number, number, number] {
  const l = Math.hypot(s[0], s[1], 1)
  return [-s[0] / l, -s[1] / l, 1 / l]
}

/** Ce que la lumière venue de `dir` (unitaire, VERS la lumière, dans le
 *  plan) fait d'un dessus de pente `s` : 1 s'il est plat — le dessus garde
 *  exactement son clair d'avant, l'éclairage des lampes (eclSolide) reste
 *  celui du toit —, plus clair sur la face tournée vers la lumière (et son
 *  reflet), plus sombre sur l'autre, jamais sous la part ambiante. */
export function lumiereRelief(s: readonly [number, number], dir: readonly [number, number]): number {
  const n = normaleRelief(s)
  const lz = HAUTEUR_LUMIERE_RELIEF
  const lxy = Math.sqrt(1 - lz * lz)
  const ndl = Math.max(n[0] * dir[0] * lxy + n[1] * dir[1] * lxy + n[2] * lz, 0)
  // le demi-vecteur entre la lampe et l'œil (au-dessus, z)
  const hl = Math.hypot(lxy, lz + 1)
  const hxy = lxy / hl
  const hz = (lz + 1) / hl
  const ndh = Math.max(n[0] * dir[0] * hxy + n[1] * dir[1] * hxy + n[2] * hz, 0)
  const reflet = Math.max(ndh ** BRILLANCE_RELIEF - hz ** BRILLANCE_RELIEF, 0)
  return PART_AMBIANTE_RELIEF + ((1 - PART_AMBIANTE_RELIEF) * ndl) / lz + REFLET_RELIEF * reflet
}

/** Un nombre écrit en flottant GLSL (« 230 » ne compile pas comme float). */
export const glslFloat = (x: number): string => {
  const t = String(x)
  return t.includes('.') || t.includes('e') ? t : t + '.0'
}

/** La même règle en GLSL, pour le shader de composition. */
export const RELIEF_SURFACES_GLSL = `// (surfacesSculptees.ts : la règle et son jumeau TypeScript)
float pasRelief(float carreau, float pxMonde) {
  return max(pxMonde, ${glslFloat(PAS_MIN_TEXELS)} * carreau / ${glslFloat(TEXELS_CARREAU)});
}
vec2 penteRelief(float a0, float ax, float ay, float profondeur, float carreau, float pas) {
  return vec2(ax - a0, ay - a0) * (profondeur * carreau / pas * ${glslFloat(EXAGERATION_RELIEF)});
}
float lumiereRelief(vec2 s, vec2 dir) {
  vec3 n = normalize(vec3(-s, 1.0));
  float lz = ${glslFloat(HAUTEUR_LUMIERE_RELIEF)};
  float lxy = sqrt(1.0 - lz * lz);
  float ndl = max(dot(n, vec3(dir * lxy, lz)), 0.0);
  vec3 h = normalize(vec3(dir * lxy, lz + 1.0));
  float reflet = max(pow(max(dot(n, h), 0.0), ${glslFloat(BRILLANCE_RELIEF)}) - pow(h.z, ${glslFloat(BRILLANCE_RELIEF)}), 0.0);
  return ${glslFloat(PART_AMBIANTE_RELIEF)} + (1.0 - ${glslFloat(PART_AMBIANTE_RELIEF)}) * ndl / lz
       + ${glslFloat(REFLET_RELIEF)} * reflet;
}
`
