// LE BANC DU MODULE 2D : rejoue ce que le moteur fait du module (renderer.ts,
// drawModule2d) avec le VRAI shader, sur un quad — sans le reste du jeu, qui
// ne se rend pas dans un navigateur sans carte graphique.
import { MODULE2D_FS, MODULE2D_VS } from '/src/render/module2dShader.ts'

const SALLE_VS = `#version 300 es
uniform vec4 uQuad; uniform vec2 uCenter; uniform vec2 uViewport; uniform float uZoom;
out vec2 vK;
void main() {
  int i = gl_VertexID;
  vec2 c = vec2((i == 1 || i == 2 || i == 4) ? 1.0 : 0.0, (i == 2 || i == 4 || i == 5) ? 1.0 : 0.0);
  vK = c;
  vec2 m = mix(uQuad.xy, uQuad.zw, c);
  gl_Position = vec4((m - uCenter) * uZoom / (uViewport * 0.5), 0.0, 1.0);
}`
// une salle de carton : la coque, la cuve, un corps d'eau — de quoi juger le
// raccord entre la salle et le décor
const SALLE_FS = `#version 300 es
precision highp float;
in vec2 vK; uniform vec2 uTaille; uniform float uT; out vec4 o;
void main() {
  vec2 p = vK * uTaille;
  float b = min(min(p.x, uTaille.x - p.x), min(p.y, uTaille.y - p.y));
  vec3 c = b < uT ? vec3(0.07, 0.10, 0.14) : mix(vec3(0.035, 0.06, 0.09), vec3(0.06, 0.10, 0.15), vK.y);
  if (b >= uT && b < uT * 1.25) c = vec3(0.39, 0.72, 0.90) * 0.55;
  float d = length((p - uTaille * vec2(0.3, 0.45)) / uTaille.x);
  c = mix(c, vec3(0.45, 0.8, 0.95), smoothstep(0.075, 0.07, d) * 0.85);
  o = vec4(c, 1.0);
}`

function prog(gl, vs, fs) {
  const p = gl.createProgram()
  for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const sh = gl.createShader(t)
    gl.shaderSource(sh, s)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error('shader : ' + gl.getShaderInfoLog(sh))
    gl.attachShader(p, sh)
  }
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('lien : ' + gl.getProgramInfoLog(p))
  const u = {}
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS)
  for (let i = 0; i < n; i++) {
    const nom = gl.getActiveUniform(p, i).name
    u[nom] = gl.getUniformLocation(p, nom)
  }
  return { p, u }
}

export function creeScene(canvas) {
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true })
  const mod = prog(gl, MODULE2D_VS, MODULE2D_FS)
  const sal = prog(gl, SALLE_VS, SALLE_FS)
  const tex = (src) => {
    const t = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
  }
  const r4 = (loc, r) => loc && gl.uniform4f(loc, r.minX, r.minY, r.maxX, r.maxY)
  return {
    gl,
    tex,
    /** s : { toile, proche, cellule, celluleDepart (textures), monde, procheMonde, salle, coque, ratio, extra } */
    dessine(s, cam, cv) {
      const W = canvas.width, H = canvas.height
      gl.viewport(0, 0, W, H)
      gl.clearColor(0.012, 0.027, 0.063, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      const module = (mode) => {
        if (mode > 0 && (!cv || cv.opacite <= 0)) return
        if (mode === 2 && !cv.depart) return
        gl.useProgram(mod.p)
        const u = mod.u
        r4(u.uRect, s.monde)
        r4(u.uQuad, mode === 1 ? cv.salle : mode === 2 ? cv.depart : s.monde)
        gl.uniform1f(u.uMode, mode)
        r4(u.uCoque, s.coque)
        gl.uniform2f(u.uCenter, cam.x, cam.y)
        gl.uniform2f(u.uViewport, W, H)
        gl.uniform1f(u.uZoom, cam.zoom)
        r4(u.uSalle, s.salle)
        gl.uniform1f(u.uHasP, s.proche ? 1 : 0)
        if (s.proche) {
          r4(u.uRectP, s.procheMonde)
          gl.activeTexture(gl.TEXTURE2)
          gl.bindTexture(gl.TEXTURE_2D, s.proche)
          gl.uniform1i(u.uProche, 2)
        }
        if (mode > 0) {
          r4(u.uCouv, mode === 2 ? cv.depart : cv.couvre)
          gl.uniform1f(u.uCouvA, mode === 2 ? 1 : cv.opacite)
          gl.activeTexture(gl.TEXTURE1)
          gl.bindTexture(gl.TEXTURE_2D, mode === 2 ? s.celluleDepart : s.cellule)
          gl.uniform1i(u.uCellule, 1)
          gl.uniform1f(u.uRatioCellule, s.ratio ?? 0)
        }
        // les uniformes propres à une version du shader (banc avant / après)
        for (const [nom, v] of Object.entries(s.extra?.(mode, cv) ?? {})) if (u[nom]) gl.uniform1f(u[nom], v)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, s.toile)
        gl.uniform1i(u.uToile, 0)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
      }
      module(0)
      // la salle de carton, coque comprise
      gl.useProgram(sal.p)
      r4(sal.u.uQuad, s.coque)
      gl.uniform2f(sal.u.uCenter, cam.x, cam.y)
      gl.uniform2f(sal.u.uViewport, W, H)
      gl.uniform1f(sal.u.uZoom, cam.zoom)
      gl.uniform2f(sal.u.uTaille, s.coque.maxX - s.coque.minX, s.coque.maxY - s.coque.minY)
      gl.uniform1f(sal.u.uT, s.coque.maxX - s.coque.minX > 0 ? s.salle.minX - s.coque.minX : 0)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      module(1)
      module(2)
      gl.disable(gl.BLEND)
    },
  }
}
