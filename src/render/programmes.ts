// LES PROGRAMMES DU RENDU, COMPILÉS EN COULISSE.
//
// Le shader de composition fait plus de cent kilo-octets de GLSL. Le
// compiler et le lier à la naissance du Renderer, puis lui demander aussitôt
// son verdict (LINK_STATUS) et ses uniformes, forçait le pilote à finir tout
// le travail SUR-LE-CHAMP, dans le fil principal — plusieurs secondes sur
// une carte ordinaire (ANGLE traduit le GLSL en HLSL, et le compilateur
// Direct3D est lent sur un gros shader), et pendant ce temps le navigateur
// ne peignait rien : page noire, aucun signe de vie, puis parfois le
// panneau de veille par-dessus un jeu qui tournait déjà.
//
// Ici, la compilation et l'édition de liens sont LANCÉES sans rien attendre.
// Avec l'extension KHR_parallel_shader_compile (Chrome, Edge, Firefox…), le
// pilote travaille dans ses propres fils et on ne lui pose la question
// bloquante qu'une fois COMPLETION_STATUS_KHR levé pour chaque programme.
// Sans l'extension, la question bloque comme avant — mais une image plus
// tard, pour que l'écran ait eu le temps de peindre le mot du chargement.
//
// La boucle de rendu demande `pret()` à chaque image et ne dessine rien tant
// que la réponse est non.

export interface SourceProgramme {
  nom: string
  vs: string
  fs: string
}

export type Uniformes = Record<string, WebGLUniformLocation | null>

/** Le sous-ensemble de WebGL2 dont la compilation a besoin — nommé pour
 *  être joué sans GPU dans les tests. */
export type GLProgrammes = Pick<
  WebGL2RenderingContext,
  | 'VERTEX_SHADER'
  | 'FRAGMENT_SHADER'
  | 'LINK_STATUS'
  | 'COMPILE_STATUS'
  | 'ACTIVE_UNIFORMS'
  | 'createShader'
  | 'shaderSource'
  | 'compileShader'
  | 'createProgram'
  | 'attachShader'
  | 'linkProgram'
  | 'getExtension'
  | 'getProgramParameter'
  | 'getProgramInfoLog'
  | 'getShaderParameter'
  | 'getShaderInfoLog'
  | 'getActiveUniform'
  | 'getUniformLocation'
>

interface Entree {
  nom: string
  program: WebGLProgram
  vs: WebGLShader
  fs: WebGLShader
}

export class Programmes {
  private readonly gl: GLProgrammes
  private readonly parallele: { COMPLETION_STATUS_KHR: number } | null
  private readonly entrees: Entree[] = []
  private readonly uniformesParNom: Record<string, Uniformes> = {}
  private prets = false
  private imagesAttendues = 0

  constructor(gl: GLProgrammes, sources: SourceProgramme[]) {
    this.gl = gl
    this.parallele = gl.getExtension('KHR_parallel_shader_compile')
    for (const s of sources) {
      const vs = this.compile(gl.VERTEX_SHADER, s.vs)
      const fs = this.compile(gl.FRAGMENT_SHADER, s.fs)
      const program = gl.createProgram()!
      gl.attachShader(program, vs)
      gl.attachShader(program, fs)
      gl.linkProgram(program)
      this.entrees.push({ nom: s.nom, program, vs, fs })
    }
  }

  private compile(type: number, src: string): WebGLShader {
    const shader = this.gl.createShader(type)!
    this.gl.shaderSource(shader, src)
    this.gl.compileShader(shader)
    return shader
  }

  /** Le programme, utilisable dès que `pret()` a répondu oui. */
  programme(nom: string): WebGLProgram {
    const e = this.entrees.find((x) => x.nom === nom)
    if (!e) throw new Error(`Programme inconnu : ${nom}`)
    return e.program
  }

  /** Les emplacements d'uniformes, vides tant que `pret()` n'a pas dit oui. */
  uniformes(nom: string): Uniformes {
    return this.uniformesParNom[nom] ?? {}
  }

  /** L'extension de compilation parallèle est-elle là ? (diagnostic) */
  get enParallele(): boolean {
    return this.parallele !== null
  }

  /**
   * Oui quand tous les programmes sont liés et leurs uniformes relevés.
   * À demander à chaque image : la réponse ne bloque jamais tant que le
   * pilote travaille encore, et le verdict (erreur de compilation comprise)
   * ne tombe qu'une fois le travail fini.
   */
  pret(): boolean {
    if (this.prets) return true
    const gl = this.gl
    if (this.parallele) {
      for (const e of this.entrees) {
        if (!gl.getProgramParameter(e.program, this.parallele.COMPLETION_STATUS_KHR))
          return false
      }
    } else if (this.imagesAttendues++ < 1) {
      // Sans l'extension, LINK_STATUS bloque le fil le temps de la
      // compilation : on laisse passer une image, que l'écran ait peint le
      // mot du chargement avant de se figer.
      return false
    }
    for (const e of this.entrees) {
      if (!gl.getProgramParameter(e.program, gl.LINK_STATUS)) {
        throw new Error(`Programme ${e.nom} : ${this.detailEchec(e)}`)
      }
      const map: Uniformes = {}
      const count = gl.getProgramParameter(e.program, gl.ACTIVE_UNIFORMS) as number
      for (let i = 0; i < count; i++) {
        const info = gl.getActiveUniform(e.program, i)
        if (info) map[info.name] = gl.getUniformLocation(e.program, info.name)
      }
      this.uniformesParNom[e.nom] = map
    }
    this.prets = true
    return true
  }

  /** Le journal le plus précis : celui du shader fautif, sinon celui du lien. */
  private detailEchec(e: Entree): string {
    const gl = this.gl
    for (const [quoi, shader] of [
      ['vertex', e.vs],
      ['fragment', e.fs],
    ] as const) {
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        return `shader ${quoi} — ${gl.getShaderInfoLog(shader) ?? ''}`
    }
    return gl.getProgramInfoLog(e.program) ?? 'édition de liens refusée'
  }
}
