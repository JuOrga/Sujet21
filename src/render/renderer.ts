// Rendu métaballes en deux passes (§11) :
//   A. chaque particule est un splat gaussien additif dans un champ basse
//      résolution (R = champ, G = champ·vitesse, B = champ·appartenance) ;
//   B. seuillage du champ plein écran + trame de repère procédurale du décor.

import type { FluidSim } from '../sim/solver'
import { KIND_PLAYER } from '../sim/solver'
import type { SimParams } from '../sim/params'
import type { Camera } from './camera'

const SPLAT_VS = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in float aSpeed;
layout(location = 2) in float aPlayer;
uniform vec2 uCenter;
uniform vec2 uViewport; // px CSS
uniform float uZoom;    // px CSS / unité monde
uniform float uPointSize; // px du framebuffer champ
out float vSpeed;
out float vPlayer;
void main() {
  vec2 clip = (aPos - uCenter) * uZoom / (uViewport * 0.5);
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = uPointSize;
  vSpeed = aSpeed;
  vPlayer = aPlayer;
}`

const SPLAT_FS = `#version 300 es
precision highp float;
in float vSpeed;
in float vPlayer;
uniform float uFieldScale;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float t = 1.0 - r2;
  float f = t * t * uFieldScale;
  outColor = vec4(f, f * vSpeed, f * vPlayer, f);
}`

const COMPOSE_VS = `#version 300 es
void main() {
  vec2 pos = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0))[gl_VertexID];
  gl_Position = vec4(pos, 0.0, 1.0);
}`

const COMPOSE_FS = `#version 300 es
precision highp float;
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
out vec4 outColor;

float gridLine(vec2 world, float spacing, float widthWorld) {
  vec2 g = abs(fract(world / spacing) - 0.5) * spacing;
  float d = min(g.x, g.y);
  return 1.0 - smoothstep(0.0, widthWorld, d);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uCanvasSize;
  vec4 tex = texture(uField, uv);

  float field = tex.r / uFieldScale;
  float speed = tex.g / max(tex.r, 1e-5);
  float player = tex.b / max(tex.r, 1e-5);

  // Reconstruction monde (repère y vers le haut, cohérent avec la passe A)
  vec2 css = gl_FragCoord.xy / uDpr;
  vec2 world = uCenter + (css - uViewport * 0.5) / uZoom;

  // Fond froid, vignette légère
  vec2 nuv = uv * 2.0 - 1.0;
  float vign = 1.0 - 0.35 * dot(nuv, nuv);
  vec3 col = vec3(0.012, 0.022, 0.040) * vign;

  // Trame de repère (§11) : deux échelles
  float lw = 1.2 / uZoom;
  col += vec3(0.05, 0.09, 0.13) * gridLine(world, 100.0, lw) * 0.35;
  col += vec3(0.07, 0.12, 0.17) * gridLine(world, 500.0, lw * 1.6) * 0.5;

  // Parois de la salle
  vec2 dr = abs(world - uRoomCenter) - uRoomHalf;
  float dEdge = abs(max(dr.x, dr.y));
  float wall = 1.0 - smoothstep(0.0, 3.0 / uZoom, dEdge);
  col += vec3(0.10, 0.20, 0.28) * wall;

  // Eau : seuillage du champ
  float th = uThreshold;
  float s = max(th * uSoftness, 1e-4);
  float body = smoothstep(th - s, th + s, field);

  float speedT = clamp(speed, 0.0, 1.0);
  vec3 slow = vec3(0.07, 0.30, 0.48);
  vec3 fast = vec3(0.55, 0.85, 0.95);
  vec3 water = mix(slow, fast, speedT);
  water = mix(water * 0.40, water, clamp(player, 0.0, 1.0)); // eau libre plus sombre

  // Cœur plus dense légèrement plus sombre, liseré plus clair
  float core = smoothstep(th * 1.8, th * 3.2, field);
  water = mix(water, water * 0.75, core * 0.5);
  float rim = body * (1.0 - smoothstep(th + s, th * 1.9, field));
  water += vec3(0.20, 0.45, 0.55) * rim * 0.55;

  col = mix(col, water, body);
  outColor = vec4(col, 1.0);
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
  private readonly splatVao: WebGLVertexArrayObject
  private readonly splatVbo: WebGLBuffer
  private readonly scratch: Float32Array
  private readonly floatField: boolean
  private fieldScale: number
  private fbo: WebGLFramebuffer | null = null
  private fieldTex: WebGLTexture | null = null
  private fboW = 0
  private fboH = 0
  private uniforms: Record<string, Record<string, WebGLUniformLocation | null>> = {}

  constructor(canvas: HTMLCanvasElement, capacity: number) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
    if (!gl) throw new Error('WebGL2 indisponible')
    this.gl = gl

    this.floatField = gl.getExtension('EXT_color_buffer_float') !== null
    this.fieldScale = this.floatField ? 1.0 : 0.02

    this.splatProgram = link(gl, SPLAT_VS, SPLAT_FS)
    this.composeProgram = link(gl, COMPOSE_VS, COMPOSE_FS)
    for (const [name, program] of [
      ['splat', this.splatProgram],
      ['compose', this.composeProgram],
    ] as const) {
      const map: Record<string, WebGLUniformLocation | null> = {}
      const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number
      for (let i = 0; i < count; i++) {
        const info = gl.getActiveUniform(program, i)
        if (info) map[info.name] = gl.getUniformLocation(program, info.name)
      }
      this.uniforms[name] = map
    }

    this.scratch = new Float32Array(capacity * 4)
    this.splatVao = gl.createVertexArray()!
    this.splatVbo = gl.createBuffer()!
    gl.bindVertexArray(this.splatVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatVbo)
    gl.bufferData(gl.ARRAY_BUFFER, this.scratch.byteLength, gl.DYNAMIC_DRAW)
    const stride = 4 * 4
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, stride, 8)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 12)
    gl.bindVertexArray(null)
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

  render(sim: FluidSim, camera: Camera, params: SimParams, viewportW: number, viewportH: number, dpr: number): void {
    const gl = this.gl
    const devW = Math.max(1, Math.round(viewportW * dpr))
    const devH = Math.max(1, Math.round(viewportH * dpr))
    if (this.canvas.width !== devW || this.canvas.height !== devH) {
      this.canvas.width = devW
      this.canvas.height = devH
    }
    const down = Math.max(1, params.renderDownsample)
    const fboW = Math.max(1, Math.round(devW / down))
    const fboH = Math.max(1, Math.round(devH / down))
    this.ensureFieldTarget(fboW, fboH)

    // Remplissage du buffer de splats
    const n = sim.count
    const data = this.scratch
    const invSpeedScale = 1 / Math.max(1, params.speedColorScale)
    for (let i = 0; i < n; i++) {
      const o = i * 4
      data[o] = sim.posX[i]
      data[o + 1] = sim.posY[i]
      const speed = Math.hypot(sim.velX[i], sim.velY[i]) * invSpeedScale
      data[o + 2] = speed > 1 ? 1 : speed
      data[o + 3] = sim.kind[i] === KIND_PLAYER ? 1 : 0
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatVbo)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, n * 4)

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
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }
}
