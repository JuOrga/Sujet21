import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// PAS D'OPÉRATION DE GRADIENT DANS LES BOUCLES SUR LES BOÎTES, ET UNE BORNE
// QUE LE COMPILATEUR NE CONNAÎT PAS. Le rapport du 14/09/2026 (Firefox sur
// Windows) : 118,6 s de compilation du rendu, deux minutes de page noire à
// chaque chargement. Le compilateur Direct3D (fxc, derrière ANGLE) déroule
// entièrement une boucle à flot divergent qui contient un texture() sans
// niveau de détail explicite ou un dFdx/dFdy — et la boucle des boîtes en
// avait quatre, pour MAX_BOXES = 160 copies d'un corps de cinq cents lignes.
// Le commentaire au-dessus de gradSdfBoite (renderer.ts) dit le reste.
// Ce test lit la SOURCE des shaders : une opération de gradient qui revient
// dans une de ces boucles, ou une borne qui redevient MAX_BOXES, le fait
// tomber avant qu'un Firefox ne le mesure.
const source = readFileSync(
  fileURLToPath(new URL('./renderer.ts', import.meta.url)),
  'utf8',
)
// les commentaires ne comptent pas : un « texture( » ou un « main( » dans
// une phrase n'est pas un appel
const lignes = source.split('\n').map((l) => l.replace(/\/\/.*$/, ''))

// Les fonctions GLSL définies dans le fichier, avec leur corps — pour suivre
// le graphe d'appel : un gradient caché dans une fonction appelée depuis la
// boucle compte autant qu'un gradient écrit dedans.
const fonctions = new Map<string, string>()
const defRe = /^(?:float|vec2|vec3|vec4|int|bool|void|mat2)\s+(\w+)\s*\([^)]*\)\s*\{/
function finDuBloc(depart: number): number {
  let prof = 0
  let ouvert = false
  for (let j = depart; j < lignes.length; j++) {
    for (const c of lignes[j]) {
      if (c === '{') {
        prof++
        ouvert = true
      } else if (c === '}') prof--
    }
    if (ouvert && prof === 0) return j
  }
  return lignes.length - 1
}
for (let i = 0; i < lignes.length; i++) {
  const m = lignes[i].match(defRe)
  if (m) fonctions.set(m[1], lignes.slice(i, finDuBloc(i) + 1).join('\n'))
}

const GRADIENT = /\btexture\(|\btextureProj\(|\btextureOffset\(|\bdFdx\(|\bdFdy\(|\bfwidth\(/
function gradientDans(corps: string, vus = new Set<string>()): string | null {
  const m = corps.match(GRADIENT)
  if (m) return m[0]
  for (const appel of corps.matchAll(/\b(\w+)\s*\(/g)) {
    const nom = appel[1]
    if (!fonctions.has(nom) || vus.has(nom)) continue
    vus.add(nom)
    const g = gradientDans(fonctions.get(nom)!, vus)
    if (g) return `${g} (via ${nom})`
  }
  return null
}

// les boucles qui parcourent les boîtes : celles dont la borne cite
// uBoxCount ou MAX_BOXES
const boucles: { ligne: number; entete: string; corps: string }[] = []
for (let i = 0; i < lignes.length; i++) {
  const m = lignes[i].match(/^\s*for \(int \w+ = 0; (.*?); \w+\+\+\) \{/)
  // (nBoites : la liste de la case dans la grille de repérage — le shader de
  // composition ne parcourt plus que celle-ci, cf. grilleBoites.ts)
  if (!m || !/uBoxCount|MAX_BOXES|nBoites/.test(m[1])) continue
  boucles.push({ ligne: i + 1, entete: m[1], corps: lignes.slice(i, finDuBloc(i) + 1).join('\n') })
}

describe('Les boucles sur les boîtes des shaders — ce que fxc ne déroule pas', () => {
  it('il y a bien six boucles sur les boîtes (trois par shader)', () => {
    expect(boucles.map((b) => b.ligne)).toHaveLength(6)
  })

  it('leur borne est uBoxCount (ou la liste de la case), jamais la constante MAX_BOXES seule', () => {
    for (const b of boucles) {
      expect(b.entete, `ligne ${b.ligne}`).toMatch(/uBoxCount|nBoites/)
    }
  })

  it('aucune opération de gradient dedans, fonctions appelées comprises', () => {
    for (const b of boucles) {
      expect(gradientDans(b.corps), `boucle ligne ${b.ligne}`).toBeNull()
    }
  })

  it('le gradient du SDF vient bien des différences finies, et il est utilisé', () => {
    expect(fonctions.has('gradSdfBoite')).toBe(true)
    expect(lignes.join('\n').match(/gradSdfBoite\(bi/g)?.length).toBe(2)
  })
})
