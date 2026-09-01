import { describe, expect, it } from 'vitest'
import { PerfCollector } from './perf'
import { FixedLoop } from './loop'

// Une image notée, réduite à ce dont la vitesse du temps a besoin : sa durée
// réelle et le nombre de pas physiques qui y ont été payés.
function note(p: PerfCollector, dtMs: number, pas: number): void {
  p.note(dtMs, 0, 0, 0, pas, 900, 100)
}

describe('La vitesse du temps — le ralenti que rien ne disait', () => {
  it('se tait tant que la fenêtre est trop courte pour vouloir dire quelque chose', () => {
    const p = new PerfCollector()
    p.pasFixe(1000 / 120)
    for (let k = 0; k < 59; k++) note(p, 16.67, 2)
    expect(p.vitesseDuTemps()).toBeNull()
    note(p, 16.67, 2)
    expect(p.vitesseDuTemps()).not.toBeNull()
  })

  it('vaut 1 quand le monde avance à l’horloge', () => {
    const p = new PerfCollector()
    p.pasFixe(1000 / 120)
    // 16,67 ms d'image, 2 pas de 8,33 ms : tout le temps réel est payé
    for (let k = 0; k < 300; k++) note(p, 1000 / 60, 2)
    expect(p.vitesseDuTemps()!).toBeCloseTo(1, 3)
  })

  it('CHIFFRE LE RALENTI : deux pas payés dans une image de 20 ms', () => {
    // Le cas du rapport du 01/09 : la boucle s'arrête à 2 pas faute de
    // budget, l'image dure 20 ms — 16,67 ms de monde pour 20 ms d'horloge.
    const p = new PerfCollector()
    p.pasFixe(1000 / 120)
    for (let k = 0; k < 300; k++) note(p, 20, 2)
    expect(p.vitesseDuTemps()!).toBeCloseTo(0.833, 3)
  })

  it('ne se laisse pas fausser par un report d’accumulateur', () => {
    // Une image sur deux ne consomme aucun pas (le reste est REPORTÉ, pas
    // perdu) : sur la fenêtre, le monde a bien avancé à l'horloge.
    const p = new PerfCollector()
    p.pasFixe(1000 / 120)
    for (let k = 0; k < 300; k++) note(p, 1000 / 60, k % 2 === 0 ? 4 : 0)
    expect(p.vitesseDuTemps()!).toBeCloseTo(1, 2)
  })
})

describe('Le pas fixe — un relevé ne mélange jamais deux régimes de temps', () => {
  it('changer de pas VIDE la fenêtre', () => {
    const p = new PerfCollector()
    p.pasFixe(1000 / 120)
    for (let k = 0; k < 300; k++) note(p, 20, 2)
    expect(p.vitesseDuTemps()).not.toBeNull()
    p.pasFixe(1000 / 60) // passage à 60 Hz
    expect(p.vitesseDuTemps()).toBeNull() // la fenêtre est repartie de zéro
  })

  it('redire le même pas ne jette rien', () => {
    const p = new PerfCollector()
    p.pasFixe(1000 / 120)
    for (let k = 0; k < 300; k++) note(p, 20, 2)
    p.pasFixe(1000 / 120)
    expect(p.vitesseDuTemps()).not.toBeNull()
  })
})

// LE GARDE-FOU, sur la vraie boucle. C'est le défaut vécu : la machine ne
// peut pas payer 120 pas par seconde, `advance` abandonne le retard, et le
// monde tourne au ralenti — sans que la cadence en dise rien.
describe('La boucle et le collecteur, ensemble', () => {
  // cadence d'images relevée dans le rapport du 01/09 07:35 (iPad, « 111 —
  // Les régimes »), et coût de pas déduit du même rapport (physMs / pas).
  const CADENCE: [number, number][] = [
    [20, 953],
    [19, 851],
    [21, 653],
    [27, 460],
    [22, 446],
    [26, 378],
    [28, 328],
    [25, 315],
  ]
  const FPS_CAP = 60

  function rejoue(simHz: number, coutPasMs: number): number {
    const loop = new FixedLoop()
    const p = new PerfCollector()
    p.pasFixe(1000 / simHz)
    const dt = 1 / simHz
    let horloge = 0
    const vrai = performance.now
    ;(performance as { now: () => number }).now = () => horloge
    try {
      for (const [ms, n] of CADENCE) {
        for (let k = 0; k < n; k++) {
          // le budget de pas tel que le calcule main.ts, hors accélération
          const budget = Math.min(
            12,
            Math.max(5, ms * 0.6),
            Math.max(5, (1000 / FPS_CAP) * 0.7),
          )
          const pas = loop.advance(
            ms / 1000,
            1,
            dt,
            () => {
              horloge += coutPasMs
            },
            budget,
          )
          note(p, ms, pas)
        }
      }
    } finally {
      ;(performance as { now: () => number }).now = vrai
    }
    return p.vitesseDuTemps()!
  }

  it('à 120 Hz sur un pas coûteux, le monde prend du retard — et on le VOIT', () => {
    // Mesuré : 8,4 ms de pas × 120 pas/s = 1,008 s de calcul par seconde.
    // Le temps réel est hors d'atteinte, la boucle abandonne la différence.
    expect(rejoue(120, 8.4)).toBeLessThan(0.85)
  })

  it('le même appareil à 60 Hz tient l’horloge', () => {
    // Deux fois moins de pas par seconde, deux fois plus de monde par pas :
    // le budget suffit. C'est le remède, et il est déjà dans le voile.
    expect(rejoue(60, 8.4)).toBeCloseTo(1, 2)
  })

  it('à 120 Hz sur un pas bon marché, rien ne se perd', () => {
    expect(rejoue(120, 2)).toBeCloseTo(1, 2)
  })
})
