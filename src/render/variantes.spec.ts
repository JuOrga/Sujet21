import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  MAT_CHAUD,
  MAT_FROID,
  MAT_GRILLE,
  MAT_HYDROPHILE,
  MAT_HYDROPHOBE,
  MAT_WALL,
} from '../game/level'
import {
  DRAPEAUX,
  MASQUE_TOUT,
  masqueCompose,
  nomSi,
  prelude,
  sourceVariante,
} from './variantes'
import type { Drapeau, EtatCompose } from './variantes'

// Le shader de composition vit dans un littéral de gabarit de renderer.ts :
// on le lit comme du TEXTE, comme le fait déjà lumiere.spec.ts. Ce que ces
// tests gardent, aucun type ne peut le garder — un #ifdef mal orthographié
// compile parfaitement et éteint un effet POUR TOUJOURS, en silence.
const source = readFileSync(
  fileURLToPath(new URL('./renderer.ts', import.meta.url)),
  'utf8',
)
const debut = source.indexOf('const COMPOSE_FS = ')
const fin = source.indexOf('const LIGHT_FS = ')
const compose = source.slice(debut, fin)

const etatVide: EtatCompose = {
  modules: false,
  zones: false,
  relief: false,
  brume: false,
  ombreVolume: false,
  materiaux: new Set(),
  texturesPretes: new Set(),
}

const allume = (masque: number, drapeau: Drapeau): boolean =>
  (masque & (1 << DRAPEAUX.indexOf(drapeau))) !== 0

describe('Variantes de composition — le shader et les drapeaux se répondent', () => {
  it('a bien trouvé le shader de composition', () => {
    expect(debut).toBeGreaterThan(0)
    expect(fin).toBeGreaterThan(debut)
    expect(compose).toContain('void main()')
  })

  // LA GARDE ESSENTIELLE. Un « #ifdef AVEC_RELEIF » compile sans un mot :
  // le bloc n'est simplement JAMAIS retenu, le relief disparaît de toutes
  // les variantes, et rien ne le signale — ni le compilateur, ni l'écran
  // d'un tableau qui n'a pas de relief. Ce test l'attrape à la seconde.
  it('n’emploie aucun drapeau qui ne soit déclaré', () => {
    const declares = new Set<string>()
    for (const d of DRAPEAUX) {
      declares.add(d)
      declares.add(nomSi(d))
    }
    const employes = new Set(compose.match(/\b(?:AVEC|SI)_[A-Z_]+\b/g) ?? [])
    const inconnus = [...employes].filter((n) => !declares.has(n))
    expect(inconnus).toEqual([])
  })

  // L'inverse : un drapeau que le shader ne lit nulle part ne retire rien.
  // Il ferait grossir le cache de variantes pour rien, et surtout il
  // MENTIRAIT — le masque prétendrait qu'un tableau est allégé quand il ne
  // l'est pas, et la mesure d'après serait à jeter.
  it('n’en déclare aucun que le shader ignore', () => {
    const oubliés = DRAPEAUX.filter(
      (d) => !compose.includes(d) && !compose.includes(nomSi(d)),
    )
    expect(oubliés).toEqual([])
  })

  it('referme chaque directive qu’il ouvre', () => {
    const ouvertes = (compose.match(/^#if(?:def|ndef)?\b/gm) ?? []).length
    const fermees = (compose.match(/^#endif\b/gm) ?? []).length
    expect(ouvertes).toBe(fermees)
    expect(ouvertes).toBeGreaterThan(0)
  })
})

describe('Variantes de composition — le prélude', () => {
  // Les deux formes disent la MÊME chose parce qu'elles sortent du même
  // booléen. Si elles pouvaient diverger, le pire cas passerait en silence :
  // le calcul gardé (#ifdef vrai) mais sa lecture éteinte (SI_ faux) — on
  // paierait le prix fort pour un effet invisible.
  it('accorde toujours le #define et son jumeau SI_', () => {
    for (const masque of [0, MASQUE_TOUT, 0b101010, 0b010101]) {
      const texte = prelude(masque)
      for (const d of DRAPEAUX) {
        const actif = allume(masque, d)
        expect(texte.includes(`#define ${d} 1`)).toBe(actif)
        expect(texte).toContain(`const bool ${nomSi(d)} = ${actif};`)
      }
    }
  })

  // Un SI_ jamais déclaré ne compilerait pas — et pas au banc : chez le
  // joueur, au chargement du tableau qui tombe sur cette variante-là.
  it('déclare TOUS les jumeaux, même ceux qui valent faux', () => {
    const texte = prelude(0)
    for (const d of DRAPEAUX) expect(texte).toContain(`const bool ${nomSi(d)}`)
    expect(texte).not.toContain('#define AVEC_')
  })

  it('laisse la directive de version en première ligne', () => {
    const variante = sourceVariante('#version 300 es\nprecision highp float;\n', 3)
    expect(variante.split('\n')[0]).toBe('#version 300 es')
    expect(variante).toContain('precision highp float;')
  })

  // C'EST CE QUI REND LE REPLI SÛR : la générique allume tout, donc elle est
  // mot pour mot le shader d'avant cette brique. Tant qu'une variante
  // spécialisée n'est pas liée, c'est elle qui dessine — l'image ne peut
  // pas changer pendant l'attente.
  it('allume tout dans la variante générique', () => {
    const texte = prelude(MASQUE_TOUT)
    for (const d of DRAPEAUX) {
      expect(texte).toContain(`#define ${d} 1`)
      expect(texte).toContain(`const bool ${nomSi(d)} = true;`)
    }
  })
})

describe('Variantes de composition — le masque d’un tableau', () => {
  it('n’allume rien pour un tableau nu', () => {
    expect(masqueCompose(etatVide)).toBe(0)
  })

  it('allume tout quand tout sert', () => {
    const tous = new Set([
      MAT_WALL,
      MAT_HYDROPHILE,
      MAT_HYDROPHOBE,
      MAT_FROID,
      MAT_GRILLE,
      MAT_CHAUD,
    ])
    expect(
      masqueCompose({
        modules: true,
        zones: true,
        relief: true,
        brume: true,
        ombreVolume: true,
        materiaux: tous,
        texturesPretes: tous,
      }),
    ).toBe(MASQUE_TOUT)
  })

  // Le cas d'école : « L'école des parois » n'a ni plaque froide ni
  // chaudière. Leurs textures étaient prélevées sur CHAQUE pixel de l'écran,
  // hors de toute branche — les mipmaps l'exigent — pour une valeur que
  // personne ne lit ensuite.
  it('ne prélève pas le givre là où aucune plaque froide n’est posée', () => {
    const m = masqueCompose({
      ...etatVide,
      materiaux: new Set([MAT_WALL, MAT_HYDROPHOBE]),
      texturesPretes: new Set([MAT_WALL, MAT_HYDROPHOBE, MAT_FROID, MAT_CHAUD]),
    })
    expect(allume(m, 'AVEC_TEX_FROID')).toBe(false)
    expect(allume(m, 'AVEC_TEX_CHAUD')).toBe(false)
    expect(allume(m, 'AVEC_TEX_PAROI')).toBe(true)
    expect(allume(m, 'AVEC_TEX_PHOBE')).toBe(true)
  })

  // L'autre moitié de la règle : une image pas encore arrivée laisse le
  // décor procédural en place. La prélever ne servirait à rien — et son
  // arrivée change le masque, donc fait cuire la bonne variante.
  it('ne prélève pas une texture qui n’est pas encore chargée', () => {
    const m = masqueCompose({
      ...etatVide,
      materiaux: new Set([MAT_FROID]),
      texturesPretes: new Set(),
    })
    expect(allume(m, 'AVEC_TEX_FROID')).toBe(false)
  })

  it('sépare bien les drapeaux de décor', () => {
    const m = masqueCompose({ ...etatVide, relief: true, brume: true })
    expect(allume(m, 'AVEC_RELIEF')).toBe(true)
    expect(allume(m, 'AVEC_BRUME')).toBe(true)
    expect(allume(m, 'AVEC_ZONES')).toBe(false)
    expect(allume(m, 'AVEC_MODULES')).toBe(false)
    expect(allume(m, 'AVEC_OMBRE_VOLUME')).toBe(false)
  })
})
