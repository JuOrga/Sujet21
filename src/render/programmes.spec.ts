import { describe, expect, it } from 'vitest'
import { Programmes, type GLProgrammes } from './programmes'

// LA COMPILATION EN COULISSE — ce que la boucle de rendu attend d'elle.
//
// La panne vécue : le Renderer demandait LINK_STATUS à sa naissance, ce qui
// force le pilote à finir la compilation du shader de composition (107 ko
// de GLSL) dans le fil principal — plusieurs secondes de page noire. Ces
// tests jouent un WebGL de carton qui NOTE chaque question posée : la
// question bloquante ne doit jamais partir tant que le pilote n'a pas dit
// « fini ».

const COMPLETION_STATUS_KHR = 0x91b1

function glDeCarton(options: { parallele: boolean; lie?: boolean }) {
  const questions: string[] = []
  let fini = false
  const uniformes = ['uBoxCount', 'uBoxes[0]']
  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    LINK_STATUS: 3,
    COMPILE_STATUS: 4,
    ACTIVE_UNIFORMS: 5,
    createShader: (type: number) => ({ type }),
    shaderSource: () => {},
    compileShader: () => {},
    createProgram: () => ({}),
    attachShader: () => {},
    linkProgram: () => {},
    getExtension: (nom: string) =>
      nom === 'KHR_parallel_shader_compile' && options.parallele
        ? { COMPLETION_STATUS_KHR }
        : null,
    getProgramParameter: (_p: unknown, quoi: number) => {
      if (quoi === COMPLETION_STATUS_KHR) {
        questions.push('COMPLETION')
        return fini
      }
      if (quoi === 3) {
        questions.push('LINK_STATUS')
        return options.lie ?? true
      }
      if (quoi === 5) return uniformes.length
      return null
    },
    getProgramInfoLog: () => 'lien refusé',
    getShaderParameter: (s: { type: number }) => s.type !== 2, // le fragment est le fautif
    getShaderInfoLog: () => 'ERROR: 0:12: syntaxe',
    getActiveUniform: (_p: unknown, i: number) => ({ name: uniformes[i] }),
    getUniformLocation: (_p: unknown, nom: string) => ({ nom }),
  } as unknown as GLProgrammes
  return { gl, questions, finit: () => (fini = true) }
}

const SOURCES = [
  { nom: 'compose', vs: 'vs', fs: 'fs' },
  { nom: 'splat', vs: 'vs', fs: 'fs' },
]

describe('Programmes — la compilation en coulisse', () => {
  it('ne pose JAMAIS la question bloquante tant que le pilote travaille', () => {
    const { gl, questions, finit } = glDeCarton({ parallele: true })
    const p = new Programmes(gl, SOURCES)
    expect(questions).toEqual([]) // la naissance n'attend rien
    expect(p.pret()).toBe(false)
    expect(p.pret()).toBe(false)
    expect(questions).not.toContain('LINK_STATUS')
    finit()
    expect(p.pret()).toBe(true)
    expect(questions.filter((q) => q === 'LINK_STATUS')).toHaveLength(2)
    // les uniformes ne sont relevés qu'à ce moment-là, et une seule fois
    expect(p.uniformes('compose')).toEqual({
      uBoxCount: { nom: 'uBoxCount' },
      'uBoxes[0]': { nom: 'uBoxes[0]' },
    })
    const n = questions.length
    expect(p.pret()).toBe(true)
    expect(questions).toHaveLength(n)
  })

  it('sans l’extension, laisse passer UNE image avant de se figer sur le verdict', () => {
    const { gl, questions } = glDeCarton({ parallele: false })
    const p = new Programmes(gl, SOURCES)
    expect(p.enParallele).toBe(false)
    expect(p.pret()).toBe(false) // l'image qui peint le mot du chargement
    expect(questions).toEqual([])
    expect(p.pret()).toBe(true)
    expect(questions).toEqual(['LINK_STATUS', 'LINK_STATUS'])
  })

  it('un shader refusé se dit au moment du verdict, avec le journal du fautif', () => {
    const { gl, finit } = glDeCarton({ parallele: true, lie: false })
    const p = new Programmes(gl, SOURCES)
    expect(p.pret()).toBe(false) // pas d'erreur tant que rien n'est fini
    finit()
    expect(() => p.pret()).toThrow(/compose.*fragment.*syntaxe/)
  })

  it('rend ses programmes par nom, et refuse un nom inconnu', () => {
    const { gl } = glDeCarton({ parallele: true })
    const p = new Programmes(gl, SOURCES)
    expect(p.programme('splat')).toBeDefined()
    expect(p.uniformes('splat')).toEqual({}) // vide tant que ce n'est pas prêt
    expect(() => p.programme('ombre')).toThrow(/inconnu/)
  })
})
