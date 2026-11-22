import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// LE MULTI RESTE À PART — les promesses faites au concepteur, tenues
// par la lecture des sources (main.ts ne s'importe pas en test : il bâtit la
// page en se chargeant).
//
//  1. Le multi ne pèse rien pour qui ne l'ouvre pas : main.ts ne le fait
//     venir que par import() — un `import … from './multi/…'` le ferait
//     retomber dans le paquet de départ, copie du solveur comprise.
//  2. Le jeu ne dépend pas du multi : aucun fichier hors de src/multi ne
//     l'importe (sauf la porte de main.ts). Le prototype peut être supprimé
//     d'un geste sans rien casser.
//  3. Il est OUVERT À TOUS (depuis le 22/11 ; il était derrière le mode
//     concepteur tant qu'il n'était qu'un essai) : le bouton et le lien
//     d'invitation ne demandent plus « ?dev ».

const lit = (chemin: string): string => readFileSync(new URL(chemin, import.meta.url), 'utf-8')
const MAIN = lit('../main.ts')
const PAGE = lit('../../index.html')

/** Tous les fichiers .ts sous un dossier de src, en chemins relatifs à src. */
function sources(dossier: string): string[] {
  const racine = new URL('../' + dossier + '/', import.meta.url)
  const trouves: string[] = []
  for (const e of readdirSync(racine, { withFileTypes: true })) {
    if (e.isDirectory()) trouves.push(...sources(dossier + '/' + e.name))
    else if (e.name.endsWith('.ts')) trouves.push(dossier + '/' + e.name)
  }
  return trouves
}

describe('le multi reste à part', () => {
  it('main.ts ne le charge qu’à la demande', () => {
    expect(MAIN).toMatch(/await import\('\.\/multi\/ecranMulti'\)/)
    expect(MAIN).not.toMatch(/from '\.\/multi\//)
  })

  it('rien, hors de son dossier, ne dépend de lui', () => {
    const fautifs: string[] = []
    for (const dossier of ['sim', 'game', 'render', 'editor', 'bench', 'textes']) {
      for (const f of sources(dossier)) {
        if (/from '(\.\.\/)+multi\//.test(lit('../' + f)) || /import\('(\.\.\/)+multi\//.test(lit('../' + f))) fautifs.push(f)
      }
    }
    expect(fautifs).toEqual([])
  })

  it('le jeu derrière lui ne simule ni ne dessine tant qu’il est ouvert', () => {
    // la garde est dans corpsImage, et elle tient l'horloge à jour
    const corps = MAIN.slice(MAIN.indexOf('function corpsImage('))
    const garde = corps.slice(corps.indexOf('if (multiOuvert) {'), corps.indexOf('if (multiOuvert) {') + 80)
    expect(garde).toMatch(/lastTime = now/)
    expect(garde).toMatch(/return false/)
    // et elle vient AVANT le pas de simulation
    expect(corps.indexOf('if (multiOuvert) {')).toBeLessThan(corps.indexOf('loop.advance('))
    expect(corps.indexOf('if (multiOuvert) {')).toBeGreaterThan(0)
  })

  it('le bouton est là pour tous : ni réservé au concepteur, ni rangé parmi ses outils', () => {
    const bouton = PAGE.match(/<button id="home-multi"[^>]*>/)
    expect(bouton).not.toBeNull()
    expect(bouton![0]).not.toMatch(/\bdata-dev\b/)
    expect(bouton![0]).not.toMatch(/acc-outil/)
    expect(bouton![0]).not.toMatch(/\bhidden\b/)
  })

  it('le lien d’invitation ouvre la partie pour tous, sans « ?dev »', () => {
    const lien = MAIN.slice(MAIN.indexOf(".get('multi')"), MAIN.indexOf(".get('multi')") + 160)
    expect(lien).not.toMatch(/concepteur/)
    expect(lien).toMatch(/if \(code\) ouvreMulti\(code\)/)
    // et le lien que le multi fabrique ne l'écrit plus
    const ecran = lit('./ecranMulti.ts')
    const fabrique = ecran.slice(ecran.indexOf('function lienPartie('), ecran.indexOf('function lienPartie(') + 400)
    expect(fabrique).not.toMatch(/'dev'/)
    expect(fabrique).toMatch(/searchParams\.set\('multi'/)
  })
})
