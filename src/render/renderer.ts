// Rendu métaballes en deux passes (§11) :
//   A. chaque particule est un splat gaussien additif dans un champ basse
//      résolution (R = champ, G = champ·vitesse, B = champ·appartenance) ;
//   B. seuillage du champ plein écran + trame de repère procédurale du décor.

import type { FluidSim } from '../sim/solver'
import { KIND_PLAYER } from '../sim/solver'
import type { SimParams } from '../sim/params'
import type { ObstacleBox } from '../game/level'
import type { Camera } from './camera'

const MAX_BOXES = 24

const SPLAT_VS = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in float aSpeed;
layout(location = 2) in float aPlayer;
layout(location = 3) in vec2 aVel; // direction × étirement (0..~1.2)
uniform vec2 uCenter;
uniform vec2 uViewport; // px CSS
uniform float uZoom;    // px CSS / unité monde
uniform float uPointSize; // px du framebuffer champ
out float vSpeed;
out float vPlayer;
out vec2 vDir;
out float vStretch;
void main() {
  vec2 clip = (aPos - uCenter) * uZoom / (uViewport * 0.5);
  gl_Position = vec4(clip, 0.0, 1.0);
  float s = length(aVel);
  // Le sprite est agrandi pour contenir l'ellipse étirée dans le sens du
  // mouvement — les gouttes rapides deviennent des traînées liquides.
  gl_PointSize = uPointSize * (1.0 + s);
  vSpeed = aSpeed;
  vPlayer = aPlayer;
  vDir = s > 1e-4 ? aVel / s : vec2(1.0, 0.0);
  vStretch = s;
}`

const SPLAT_FS = `#version 300 es
precision highp float;
in float vSpeed;
in float vPlayer;
in vec2 vDir;
in float vStretch;
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
  float f = t * t * uFieldScale / (1.0 + vStretch);
  outColor = vec4(f, f * vSpeed, f * vPlayer, f);
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
uniform int uWaveCount;
uniform vec4 uWaves[MAX_WAVES]; // x, y, instant de départ, amplitude
out vec4 outColor;

float gridLine(vec2 world, float spacing, float widthWorld) {
  vec2 g = abs(fract(world / spacing) - 0.5) * spacing;
  float d = min(g.x, g.y);
  return 1.0 - smoothstep(0.0, widthWorld, d);
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

  // Obstacles : remplissage + liseré, couleur par matériau (§6)
  float edgeW = 2.5 / uZoom;
  for (int bi = 0; bi < MAX_BOXES; bi++) {
    if (bi >= uBoxCount) break;
    float d = boxSdf(world, uBoxes[bi]);
    float mat = uBoxMats[bi];
    if (mat < 2.5) {
      float fill = 1.0 - smoothstep(-edgeW, 0.0, d);
      float edge = 1.0 - smoothstep(0.0, edgeW, abs(d));
      vec3 fillCol; vec3 edgeCol;
      if (mat < 0.5) {        // mur neutre
        fillCol = vec3(0.10, 0.13, 0.17); edgeCol = vec3(0.30, 0.38, 0.46);
      } else if (mat < 1.5) { // hydrophile : mouillé, brillant
        fillCol = vec3(0.05, 0.16, 0.20); edgeCol = vec3(0.20, 0.65, 0.70);
      } else {                // hydrophobe : cireux, repoussant
        fillCol = vec3(0.16, 0.11, 0.20); edgeCol = vec3(0.62, 0.42, 0.78);
      }
      col = mix(col, fillCol, fill);
      col = mix(col, edgeCol, edge * 0.9);
    } else {                  // sas de sortie : liseré pulsant, pas de solide
      float pulse = 0.6 + 0.4 * sin(uTime * 2.2);
      float edge = 1.0 - smoothstep(0.0, edgeW * 2.0, abs(d));
      float inner = 1.0 - smoothstep(-edgeW * 6.0, 0.0, d);
      col += vec3(0.15, 0.75, 0.55) * edge * pulse;
      col += vec3(0.05, 0.25, 0.18) * inner * (0.35 + 0.2 * pulse);
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
  float field2 = field * (1.0 + 0.14 * waveGlow);
  float body = smoothstep(th - s, th + s, field2);

  float speedT = clamp(speed, 0.0, 1.0);
  vec3 slow = vec3(0.07, 0.30, 0.48);
  vec3 fast = vec3(0.55, 0.85, 0.95);
  vec3 water = mix(slow, fast, speedT);
  water = mix(water * 0.40, water, clamp(player, 0.0, 1.0)); // eau libre plus sombre

  // Relief : le gradient du champ donne une pseudo-normale — éclairage doux
  // et reflet spéculaire, l'eau prend du volume au lieu d'être plate.
  vec2 grad = vec2(dFdx(field2), dFdy(field2)) * uCanvasSize;
  vec3 nrm = normalize(vec3(-grad * 0.55, 1.0));
  vec3 lightDir = normalize(vec3(-0.35, 0.55, 0.75));
  float diffuse = max(dot(nrm, lightDir), 0.0);
  float specular = pow(max(reflect(-lightDir, nrm).z, 0.0), 28.0);

  // Cœur plus dense légèrement plus sombre, liseré plus clair
  float core = smoothstep(th * 1.8, th * 3.2, field2);
  water = mix(water, water * 0.75, core * 0.5);
  float rim = body * (1.0 - smoothstep(th + s, th * 1.9, field2));
  water += vec3(0.20, 0.45, 0.55) * rim * 0.55;

  // Scintillement interne discret : l'eau vit même au repos
  float shimmer = sin(world.x * 0.11 + uTime * 1.6) * sin(world.y * 0.09 - uTime * 1.2);
  water *= 1.0 + 0.05 * shimmer * core;

  water = water * (0.78 + 0.30 * diffuse) + vec3(0.85, 0.95, 1.0) * specular * 0.30;
  water += vec3(0.30, 0.55, 0.65) * waveGlow * 0.45;

  col = mix(col, water, body);
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
void main() {
  vec2 clip = (aPos - uCenter) * uZoom / (uViewport * 0.5);
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = uPointSize;
  vSat = aSat;
}`

const SPONGE_FS = `#version 300 es
precision highp float;
in float vSat;
out vec4 outColor;
void main() {
  vec2 pc = gl_PointCoord * 2.0 - 1.0;
  float d = max(abs(pc.x), abs(pc.y));
  vec3 dry = vec3(0.30, 0.26, 0.15);      // absorbante : ocre poreux
  vec3 wet = vec3(0.12, 0.18, 0.24);      // en cours de saturation
  vec3 solid = vec3(0.20, 0.26, 0.32);    // gorgée : solide, pierre humide
  vec3 col = vSat >= 1.0 ? solid : mix(dry, wet, clamp(vSat, 0.0, 1.0));
  col *= 1.0 - 0.35 * smoothstep(0.7, 1.0, d); // bord de cellule plus sombre
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
  private readonly spongeProgram: WebGLProgram
  private readonly splatVao: WebGLVertexArrayObject
  private readonly splatVbo: WebGLBuffer
  private readonly spongeVao: WebGLVertexArrayObject
  private readonly spongeVbo: WebGLBuffer
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
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false })
    if (!gl) throw new Error('WebGL2 indisponible')
    this.gl = gl

    this.floatField = gl.getExtension('EXT_color_buffer_float') !== null
    this.fieldScale = this.floatField ? 1.0 : 0.02

    this.splatProgram = link(gl, SPLAT_VS, SPLAT_FS)
    this.composeProgram = link(gl, COMPOSE_VS, COMPOSE_FS)
    this.spongeProgram = link(gl, SPONGE_VS, SPONGE_FS)
    for (const [name, program] of [
      ['splat', this.splatProgram],
      ['compose', this.composeProgram],
      ['sponge', this.spongeProgram],
    ] as const) {
      const map: Record<string, WebGLUniformLocation | null> = {}
      const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number
      for (let i = 0; i < count; i++) {
        const info = gl.getActiveUniform(program, i)
        if (info) map[info.name] = gl.getUniformLocation(program, info.name)
      }
      this.uniforms[name] = map
    }

    this.scratch = new Float32Array(capacity * 6)
    this.splatVao = gl.createVertexArray()!
    this.splatVbo = gl.createBuffer()!
    gl.bindVertexArray(this.splatVao)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatVbo)
    gl.bufferData(gl.ARRAY_BUFFER, this.scratch.byteLength, gl.DYNAMIC_DRAW)
    const stride = 6 * 4
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0)
    gl.enableVertexAttribArray(1)
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, stride, 8)
    gl.enableVertexAttribArray(2)
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 12)
    gl.enableVertexAttribArray(3)
    gl.vertexAttribPointer(3, 2, gl.FLOAT, false, stride, 16)
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
  ): void {
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
    const invStretchSpeed = 1 / 900 // vitesse (u/s) donnant un étirement ×2
    for (let i = 0; i < n; i++) {
      const o = i * 6
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
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.splatVbo)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, n * 6)

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
    gl.uniform1i(cu['uWaveCount'], waveCount)
    gl.uniform4fv(cu['uWaves[0]'], waves)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    // Passe C — cellules d'éponge
    this.drawSponges(sim, camera, viewportW, viewportH, dpr)
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
    gl.bindVertexArray(this.spongeVao)
    gl.drawArrays(gl.POINTS, 0, totalCells)
    gl.bindVertexArray(null)
  }
}
