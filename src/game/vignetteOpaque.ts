// LES SURFACES EN RELIEF, VUES SANS LEUR ALPHA (la galerie des images).
//
// Leur couche alpha est un RELIEF (assets-ia §37), pas une transparence : un
// <img> la composait sur le fond de la vignette, et la cire, presque à zéro
// sous ses perles, n'y était plus qu'une tache sombre. Un fond opaque n'y
// change rien : c'est la couleur qu'il faut montrer, alpha ignoré.
//
// Le navigateur garde ses images décodées PRÉMULTIPLIÉES (couleur × alpha) :
// ni un canvas 2D ni un filtre CSS ne rendent la couleur d'un pixel à alpha
// nul — elle y est déjà perdue. WebGL, lui, reçoit l'image NON prémultipliée
// (UNPACK_PREMULTIPLY_ALPHA_WEBGL à faux, la règle de la spécification, et
// le chargement du jeu s'y fie déjà) : on y dessine la couleur, alpha à 1,
// dans un petit canvas dont on tire une image. Un seul contexte pour toute la
// galerie (un navigateur en ouvre une poignée, pas un par vignette).

const VS = `#version 300 es
in vec2 p;
out vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`

const FS = `#version 300 es
precision mediump float;
uniform sampler2D t;
in vec2 uv;
out vec4 o;
void main() { o = vec4(texture(t, uv).rgb, 1.0); }`

let gl: WebGL2RenderingContext | null | undefined
const faites = new Map<string, string>()

function contexte(): WebGL2RenderingContext | null {
  if (gl !== undefined) return gl
  gl = null
  const c = document.createElement('canvas')
  const g = c.getContext('webgl2', { alpha: false, preserveDrawingBuffer: true, antialias: false })
  if (!g) return null
  const sh = (type: number, src: string): WebGLShader => {
    const s = g.createShader(type)!
    g.shaderSource(s, src)
    g.compileShader(s)
    return s
  }
  const prog = g.createProgram()!
  g.attachShader(prog, sh(g.VERTEX_SHADER, VS))
  g.attachShader(prog, sh(g.FRAGMENT_SHADER, FS))
  g.bindAttribLocation(prog, 0, 'p')
  g.linkProgram(prog)
  if (!g.getProgramParameter(prog, g.LINK_STATUS)) return null
  g.useProgram(prog)
  const buf = g.createBuffer()
  g.bindBuffer(g.ARRAY_BUFFER, buf)
  g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW)
  g.enableVertexAttribArray(0)
  g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0)
  gl = g
  return g
}

/** L'image `img` (chargée) en vignette OPAQUE de `largeur` pixels au plus :
 *  une URL de données, ou null si WebGL2 manque (la vignette garde alors
 *  l'image telle quelle). Mise en cache par URL : la grille se redessine à
 *  chaque frappe du filtre. */
export function vignetteSansAlpha(img: HTMLImageElement, largeur = 480): string | null {
  const deja = faites.get(img.src)
  if (deja) return deja
  try {
    const g = contexte()
    if (!g || img.naturalWidth === 0) return null
    const l = Math.min(largeur, img.naturalWidth)
    const h = Math.max(1, Math.round((l * img.naturalHeight) / img.naturalWidth))
    const c = g.canvas as HTMLCanvasElement
    c.width = l
    c.height = h
    const tex = g.createTexture()
    g.bindTexture(g.TEXTURE_2D, tex)
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true)
    g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, g.RGBA, g.UNSIGNED_BYTE, img)
    g.generateMipmap(g.TEXTURE_2D)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR)
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
    g.viewport(0, 0, l, h)
    g.drawArrays(g.TRIANGLE_STRIP, 0, 4)
    const url = c.toDataURL('image/png')
    g.deleteTexture(tex)
    faites.set(img.src, url)
    return url
  } catch {
    return null
  }
}
