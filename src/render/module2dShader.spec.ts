// LE SHADER DU MODULE EN 2D et le moteur parlent des MÊMES uniformes : un
// uniforme envoyé sans être déclaré se perd en silence (WebGL l'ignore), un
// uniforme déclaré sans être envoyé vaut zéro — l'ombre de la salle à zéro,
// c'est un décor sans profondeur, et personne ne le signale.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MODULE2D_FS, MODULE2D_VS } from './module2dShader'

const moteur = readFileSync(join(process.cwd(), 'src/render/renderer.ts'), 'utf-8')
const debut = moteur.indexOf('private drawModule2d(')
const dessin = moteur.slice(debut, moteur.indexOf('\n  }\n', debut))
const envoyes = new Set([...dessin.matchAll(/u\['(u\w+)'\]/g)].map((m) => m[1]))
const declares = new Set([...(MODULE2D_VS + MODULE2D_FS).matchAll(/uniform\s+\w+\s+(u\w+)\s*;/g)].map((m) => m[1]))

describe('module 2D — le shader et le moteur', () => {
  it('le moteur dessine bien le module (le test lit la bonne fonction)', () => {
    expect(debut).toBeGreaterThan(0)
    expect(envoyes.size).toBeGreaterThan(8)
  })

  it('tout uniforme envoyé par le moteur est déclaré dans le shader', () => {
    for (const u of envoyes) expect(declares.has(u), u).toBe(true)
  })

  it('tout uniforme déclaré est envoyé par le moteur', () => {
    for (const u of declares) expect(envoyes.has(u), u).toBe(true)
  })

  it('la couverture peint le décor comme le mode 0 — même ombre, aucun flou : son quad déborde de la salle', () => {
    // le décor ne se floute plus contre la salle (13/11, « flou par endroit ») :
    // aucun mode ne lit les toiles autrement qu'un autre
    expect(MODULE2D_FS).not.toMatch(/float flou/)
    expect(MODULE2D_FS).not.toMatch(/texture\(uToile, uv, /)
    expect(MODULE2D_FS).not.toMatch(/texture\(uProche, up, /)
    expect(MODULE2D_FS).toMatch(/if \(uMode < 1\.5\) c\.rgb \*= mix\(1\.0, mix\(0\.32/)
    expect(MODULE2D_FS).not.toMatch(/uMode < 0\.5\) c\.rgb \*=/)
  })

  it('l’ombre de la salle et la respiration du décor se règlent du dehors', () => {
    expect(declares.has('uOmbre')).toBe(true)
    expect(declares.has('uTemps')).toBe(true)
    // sous « moins d'animations » le moteur envoie 0, et le shader ne touche à rien
    expect(MODULE2D_FS).toContain('if (uTemps <= 0.0) return c;')
  })
})
