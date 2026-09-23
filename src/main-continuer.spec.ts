import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { boutonDe, MANOEUVRES } from './game/commandes'
import { BOUTON } from './game/manette'

// LE BOUTON CONTINUER NE PIÈGE PLUS LE JOUEUR — deux pannes lues.
//
// Quand le sas a bu assez, CONTINUER s'offre. Deux choses tournaient mal :
// à la SOURIS, un clic à côté du bouton éjectait, le reste du corps (sous
// le seuil critique, tenu par la seule emprise du sas) en sortait et se
// DISPERSAIT — la salle gagnée était perdue ; à la MANETTE, A validait le
// bouton dès son apparition, et A est le geste qui éjecte : on ne pilotait
// plus le reste du volume sans conclure malgré soi.
//
// main.ts ne s'importe pas en test : on lit sa source, comme
// main-amorce.spec.ts.

const SRC = readFileSync(new URL('./main.ts', import.meta.url), 'utf-8')

const corps = (nom: string): string =>
  SRC.match(new RegExp(`function ${nom}\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? ''

describe('la sortie offerte par CONTINUER', () => {
  it('une dispersion, une fois CONTINUER offert, conclut la salle', () => {
    expect(SRC).toMatch(/const sortieRattrapee =[\s\S]*?aspireAssez &&\s*\n\s*sim\.dispersed/)
    const drunk = SRC.match(/const drunk =([\s\S]*?)\n\s*\/\/|const drunk =([\s\S]*?)\n\n/)
    expect(drunk?.[0]).toContain('sortieRattrapee')
    // les conclusions de salle (essai, économat, run) acceptent le corps
    // rattrapé ; aucune n'exige plus un corps non dispersé
    expect(SRC).toContain('const corpsTient = !sim.dispersed || sortieRattrapee')
    expect(SRC).not.toMatch(/!sim\.dispersed &&\s*\n\s*\(drunk \|\| reached\) &&/)
    expect(SRC).not.toContain('!tableauDone && !sim.dispersed && (drunk || reached))')
    expect(SRC.match(/corpsTient &&\s*\n\s*\(drunk \|\| reached\) &&/g)).toHaveLength(2)
    expect(SRC).toContain('!tableauDone && corpsTient && (drunk || reached))')
  })

  it('seule la dispersion NÉE DE L’EMPRISE du sas est rattrapée (revue #453)', () => {
    // dix pour cent bus, puis le corps perdu loin du sas : c'est une défaite
    const decl = SRC.match(/const sortieRattrapee =([\s\S]*?)\n\s*if \(sortieRattrapee\)/)?.[1] ?? ''
    expect(decl).toMatch(/run\.tableauTime - endgame\.empriseJusqua <= params\.dispersalGrace/)
    // le solveur dit si le corps est dans l'emprise ; la boucle le date
    expect(SRC).toContain('if (sim.dansEmprise) endgame.empriseJusqua = run.tableauTime')
    // un nouvel essai oublie tout
    expect(corps('restart')).toContain('endgame.empriseJusqua = -1')
    expect(corps('restart')).toContain('endgame.rattrapee = false')
  })

  it('une sortie rattrapée ne se consigne pas en défaite (revue #453)', () => {
    // ni son, ni fin d'expédition publiée, ni mémoire d'échec
    expect(SRC).toMatch(/if \(sim\.dispersed && !sfx\.dispersed && !endgame\.rattrapee\) \{\s*\n\s*audio\.disperse\(\)/)
    // ni sursis de défaite, ni relance qui clignote l'image de la victoire
    expect(SRC).toMatch(/const horsRun =\s*\n?\s*[^\n]*endgame\.rattrapee/)
    expect(SRC).toMatch(/!\(aspireAssez && !sim\.dispersed\) &&[\s\S]{0,200}!sortieRattrapee &&/)
  })

  it('A ne valide plus CONTINUER : il reste le geste qui agit', () => {
    expect(corps('clicMenuManette')).not.toContain("'continuer'")
    expect(corps('clicMenuManette')).toContain("'relance'")
  })

  it('conclure a son geste, au clavier comme à la manette', () => {
    const m = MANOEUVRES.find((x) => x.id === 'conclure')
    expect(m).toBeDefined()
    expect(m?.fixe).toBeFalsy() // redéfinissable
    expect(boutonDe('conclure')).toBe(BOUTON.BAS)
    expect(boutonDe('conclure')).not.toBe(BOUTON.A)
    expect(SRC).toContain("if (manetteFait('conclure')) conclureSalle()")
    expect(SRC).toContain("else if (id === 'conclure') return conclureSalle()")
    // conclure ne fait rien tant que le bouton ne s'offre pas
    expect(corps('conclureSalle')).toMatch(/if \(!continuerOffert\(\)\) return false/)
  })
})
