import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { COMPOSE_FS, LIGHT_FS, sourceVitrine } from './renderer'

// LA VITRINE — le rendu réduit sur lequel le menu s'ouvre.
//
// Le concepteur, 19/11 : « un premier petit chargement pour le menu et la
// cuve, et les boutons bloqués tant que ce n'est pas fini ». Le shader de
// composition complet coûte des minutes au compilateur Direct3D à la
// première visite ; la cuve de l'accueil n'en montre qu'une petite part.
// sourceVitrine pose `#define VITRINE` en tête de la MÊME source, et ce que
// la cuve ne montre pas y est entouré de `#ifndef VITRINE`.
//
// Ces gardes lisent la source comme le pilote la verra : préprocesseur
// passé, commentaires ôtés, fonctions que main n'atteint plus retirées
// (ANGLE les retire avant de traduire). Elles tombent si la vitrine regonfle
// — un bloc ajouté hors des `#ifndef`, une coupe défaite — et si un `#ifndef`
// est mal fermé. Que les deux variantes donnent LA MÊME IMAGE ne se vérifie
// pas ici (pas de carte graphique) : c'est tools/banc-vitrine, dans le vrai
// jeu, pixel à pixel.

/** Le préprocesseur, pour VITRINE seulement : #ifdef, #ifndef, #else, #endif. */
function preprocesse(src: string): string {
  const defs = new Set<string>()
  const pile: boolean[] = []
  const garde = (): boolean => pile.every(Boolean)
  const out: string[] = []
  for (const ligne of src.split('\n')) {
    const m = ligne.match(/^\s*#\s*(define|ifdef|ifndef|else|endif)\b\s*(\w+)?/)
    if (m && (m[1] === 'ifdef' || m[1] === 'ifndef')) {
      pile.push(m[1] === 'ifdef' ? defs.has(m[2]!) : !defs.has(m[2]!))
      continue
    }
    if (m && m[1] === 'else') {
      if (pile.length === 0) throw new Error('#else sans #if')
      pile[pile.length - 1] = !pile[pile.length - 1]
      continue
    }
    if (m && m[1] === 'endif') {
      if (pile.length === 0) throw new Error('#endif sans #if')
      pile.pop()
      continue
    }
    if (!garde()) continue
    if (m && m[1] === 'define' && m[2]) defs.add(m[2])
    out.push(ligne)
  }
  if (pile.length > 0) throw new Error('#if non fermé')
  return out.join('\n')
}

const DEF = /^(?:float|vec2|vec3|vec4|int|bool|void|mat2|mat3)\s+(\w+)\s*\([^)]*\)\s*\{/

/** Ce que le pilote compile : sans commentaires, sans les fonctions que
 *  main n'atteint pas. */
function effectif(src: string): string {
  const lignes = preprocesse(src)
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '').trimEnd())
    .filter((l) => l.trim() !== '')
  // une fonction surchargée a plusieurs corps : on les garde tous, un par un
  const fonctions = new Map<string, [number, number][]>()
  for (let i = 0; i < lignes.length; i++) {
    const m = lignes[i].match(DEF)
    if (!m) continue
    let prof = 0
    let j = i
    for (; j < lignes.length; j++) {
      for (const c of lignes[j]) prof += c === '{' ? 1 : c === '}' ? -1 : 0
      if (prof === 0) break
    }
    fonctions.set(m[1], [...(fonctions.get(m[1]) ?? []), [i, j]])
    i = j
  }
  const atteintes = new Set<string>(['main'])
  const file = ['main']
  while (file.length > 0) {
    for (const [a, b] of fonctions.get(file.pop()!)!) {
      for (const appel of lignes.slice(a, b + 1).join('\n').matchAll(/\b(\w+)\s*\(/g)) {
        if (fonctions.has(appel[1]) && !atteintes.has(appel[1])) {
          atteintes.add(appel[1])
          file.push(appel[1])
        }
      }
    }
  }
  const ote = new Set<number>()
  for (const [nom, corps] of fonctions)
    if (!atteintes.has(nom)) for (const [a, b] of corps) for (let k = a; k <= b; k++) ote.add(k)
  return lignes.filter((_, k) => !ote.has(k)).join('\n')
}

const mesure = (src: string): { octets: number; lignes: number; boucles: number } => {
  const e = effectif(src)
  return { octets: e.length, lignes: e.split('\n').length, boucles: (e.match(/\bfor\s*\(/g) ?? []).length }
}

describe('la vitrine — le rendu réduit du menu', () => {
  it('est la même source, VITRINE défini en tête', () => {
    const v = sourceVitrine(COMPOSE_FS)
    expect(v.startsWith('#version 300 es\n#define VITRINE\n')).toBe(true)
    expect(v.replace('#define VITRINE\n', '')).toBe(COMPOSE_FS)
    expect(() => sourceVitrine('precision highp float;')).toThrow()
  })

  it('ses #ifndef VITRINE sont tous fermés, dans les deux shaders', () => {
    for (const src of [COMPOSE_FS, LIGHT_FS]) {
      expect(() => preprocesse(src)).not.toThrow()
      expect(() => preprocesse(sourceVitrine(src))).not.toThrow()
    }
  })

  // Mesuré le 19/11 (octets de GLSL que le pilote reçoit, fonctions mortes
  // ôtées) : la composition passe de 145 812 à 62 777 (30 boucles → 14), la
  // carte de lumière de 21 892 à 12 144 (8 → 5). On ne peut pas mesurer d'ici le temps du compilateur
  // Direct3D — il ne tourne que sous Windows ; le rapport de PARAMÈTRES le
  // dira sur la machine du joueur (amorcage : compileRenduMs pour la
  // vitrine, compileCompletMs pour le rendu complet). Les plafonds laissent
  // une marge de 8 % : au-delà, quelque chose est revenu dans la vitrine.
  it('pèse moins de la moitié de la composition complète', () => {
    const complet = mesure(COMPOSE_FS)
    const vitrine = mesure(sourceVitrine(COMPOSE_FS))
    expect(vitrine.octets).toBeLessThan(68000)
    expect(vitrine.octets).toBeLessThan(complet.octets * 0.47)
    expect(vitrine.boucles).toBeLessThanOrEqual(14)
  })

  it('sa carte de lumière ne marche plus que sur les formes de la cuve', () => {
    const complet = mesure(LIGHT_FS)
    const vitrine = mesure(sourceVitrine(LIGHT_FS))
    expect(vitrine.octets).toBeLessThan(13200)
    expect(vitrine.octets).toBeLessThan(complet.octets * 0.6)
    // ni évent, ni éponge, ni vitre : les trois tamis ne sont plus appelés
    const v = effectif(sourceVitrine(LIGHT_FS))
    for (const f of ['grilleTrans', 'epongeTrans', 'vitreTrans', 'conduiteOmbreSdf']) expect(v).not.toContain(f + '(')
  })

  it('ne garde que ce que la cuve montre : un mur nu, une baie, un arc', () => {
    const v = effectif(sourceVitrine(COMPOSE_FS))
    // les matières absentes de la cuve, leurs fonctions, les ciels importés
    for (const f of ['terre', 'shipLife', 'ombrePiedCoque', 'flancBalaye', 'flancBalayeCapsule', 'grilleEvent'])
      expect(v, f).not.toContain(f + '(')
    // ce qu'elle montre est toujours là
    for (const f of ['etoiles', 'refletCorps', 'flancAffine', 'formeSdf', 'ombreVolume', 'champCorps'])
      expect(v, f).toContain(f + '(')
    expect(v).toContain('vitreVitrine = max(vitreVitrine, verre)')
    // LE GEL ET LA VAPEUR RESTENT : le corps de la cuve n'est pas de l'eau
    // pure aux yeux du rendu — les couper changeait 1 500 pixels sur 256 000
    // au banc (19/11). Qui les recoupe fait sauter le corps à la bascule.
    expect(v).toContain('water = mix(water, iceCol, icy * 0.9)')
    expect(v).toContain('water = mix(water, smoke, vap * 0.92)')
  })

  it('le Renderer lance la vitrine avant les programmes complets', () => {
    const RENDU = readFileSync(new URL('./renderer.ts', import.meta.url), 'utf-8')
    expect(RENDU).toContain("{ nom: 'compose', vs: COMPOSE_VS, fs: sourceVitrine(COMPOSE_FS) }")
    expect(RENDU).toContain("{ nom: 'light', vs: COMPOSE_VS, fs: sourceVitrine(LIGHT_FS) }")
    // sans compilation parallèle, tout part d'un coup et la vitrine ne sert pas
    expect(RENDU).toContain('if (!this.programmesCommuns.enParallele) this.lanceComplets()')
    // les complets ne partent qu'après le verdict de la vitrine — une image
    // plus tard, la première de la cuve déjà partie — ou à son refus
    const i = RENDU.indexOf('  pretVitrine(): boolean {')
    const corps = RENDU.slice(i, RENDU.indexOf('\n  }\n', i))
    expect(corps.match(/this\.lanceComplets\(\)/g)).toHaveLength(2)
    expect(corps).toContain("this.etatVitrine = 'refusee'")
  })

  it('en vitrine, ni module ni coque ne se dessinent : leurs programmes ne sont pas liés', () => {
    const RENDU = readFileSync(new URL('./renderer.ts', import.meta.url), 'utf-8')
    expect(RENDU).toContain('const autour = !this.solModules && this.programmesPrets')
  })

  // main.ts tient le joueur dans la cuve tant que le rendu complet manque.
  // Rien ne relie ces gestes qu'un nom en toutes lettres : la garde les lit.
  describe('le menu attend le rendu complet', () => {
    const MAIN = readFileSync(new URL('../main.ts', import.meta.url), 'utf-8')
    const corps = (nom: string): string => {
      const i = MAIN.indexOf(`function ${nom}(`)
      expect(i, `function ${nom} manque à main.ts`).toBeGreaterThan(-1)
      return MAIN.slice(i, MAIN.indexOf('\n}\n', i))
    }

    it('seule la cuve se dessine sur la vitrine', () => {
      const boucle = corps('corpsImage')
      expect(boucle).toContain('const enCuve = level.code === CODE_ACCUEIL && !vitrinePause')
      expect(boucle).toContain('if (!(enCuve && renderer.pretVitrine())) {')
    })

    it('le bouton principal est bloqué, et dit où en est la préparation', () => {
      const fiche = corps('majAccueil')
      expect(fiche).toContain('startBtn.disabled = !renduComplet')
      expect(fiche).toContain('motPreparation(av.fait, av.total)')
      // et un clic forcé (manette, script) ne passe pas non plus
      expect(corps('closeHome').split('\n').slice(0, 4).join('\n')).toContain('if (!renduComplet) return')
    })

    it('le verbe se débloque au premier oui du rendu complet', () => {
      const boucle = corps('corpsImage')
      const i = boucle.indexOf('if (!renduComplet && renderer.pret()) {')
      expect(i).toBeGreaterThan(-1)
      expect(boucle.slice(i, i + 260)).toContain('majAccueil()')
    })
  })
})
