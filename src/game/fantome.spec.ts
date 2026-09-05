// Le contrat du fantôme : l'encodage à huit octets qui fait l'aller-retour,
// l'enregistreur qui échantillonne à cadence fixe de temps simulé, le
// lecteur qui interpole et disparaît au sas, le rangement par salle et par
// record sous budget.
import { describe, expect, it } from 'vitest'
import {
  BUDGET_FANTOMES,
  CADENCE_FANTOME,
  CLE_FANTOMES,
  ETAT_EAU,
  ETAT_GLACE,
  ETAT_VAPEUR,
  EnregistreurFantome,
  Fantomes,
  LecteurFantome,
  decodeEchantillons,
  encodeEchantillons,
  type EchantillonFantome,
} from './fantome'

function memoire(): { getItem(k: string): string | null; setItem(k: string, v: string): void } {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }
}

describe('Le fantôme — la trace du corps', () => {
  it('encode huit octets par échantillon et les relit à l’identique (aux arrondis près)', () => {
    const pts: EchantillonFantome[] = [
      { x: -950.4, y: 12.6, r: 61.3, cl: 312.7, etat: ETAT_EAU },
      { x: 1234, y: -400, r: 80, cl: 250, etat: ETAT_GLACE },
      { x: 32767, y: -32768, r: 600, cl: 70000, etat: ETAT_VAPEUR },
    ]
    const texte = encodeEchantillons(pts)
    expect(texte.length).toBe(Math.ceil((3 * 8) / 3) * 4) // base64 de 24 octets
    const relus = decodeEchantillons(texte, 3)
    expect(relus[0]).toEqual({ x: -950, y: 13, r: 62, cl: 313, etat: ETAT_EAU })
    expect(relus[1]).toEqual({ x: 1234, y: -400, r: 80, cl: 250, etat: ETAT_GLACE })
    // les bornes : le rayon plafonne à 510, les centilitres à 65 535
    expect(relus[2]).toEqual({ x: 32767, y: -32768, r: 510, cl: 65535, etat: ETAT_VAPEUR })
    // un texte cassé ne lève pas : trace vide
    expect(decodeEchantillons('%%%', 3)).toEqual([])
    // n plus grand que les données : on lit ce qu'il y a
    expect(decodeEchantillons(texte, 10)).toHaveLength(3)
  })

  it('l’enregistreur prend un échantillon par cran de temps simulé, jamais deux, et se cale sur la grille', () => {
    const rec = new EnregistreurFantome(0.1)
    const e = { x: 0, y: 0, r: 10, cl: 100, etat: ETAT_EAU }
    // des pas de 1/120 s : 120 pas = 1 s → 11 échantillons (t = 0, 0.1 … 1.0)
    for (let i = 0; i <= 120; i++) {
      const t = i / 120
      if (rec.aBesoin(t)) rec.note(t, { ...e, x: t * 100 })
    }
    expect(rec.taille).toBe(11)
    const def = rec.fin('REX', 3.2, 1.0, '2026-09-06T00:00:00.000Z')
    expect(def).toMatchObject({ v: 1, n: 11, cadence: 0.1, litres: 3.2, temps: 1.0, nom: 'REX' })
    const pts = decodeEchantillons(def.donnees, def.n)
    expect(pts.map((p) => p.x)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
    // un pas de retard (t = 0.19 sans échantillon à 0.1) ne décale pas la grille
    const rec2 = new EnregistreurFantome(0.1)
    rec2.note(0, e)
    rec2.note(0.19, e) // pris (dû depuis 0.1)
    expect(rec2.aBesoin(0.199)).toBe(false)
    expect(rec2.aBesoin(0.2)).toBe(true) // le cran suivant reste 0.2, pas 0.29
  })

  it('le lecteur interpole entre deux échantillons et disparaît après le dernier', () => {
    const rec = new EnregistreurFantome(0.5)
    rec.note(0, { x: 0, y: 0, r: 20, cl: 300, etat: ETAT_EAU })
    rec.note(0.5, { x: 100, y: 50, r: 30, cl: 200, etat: ETAT_GLACE })
    rec.note(1.0, { x: 100, y: 150, r: 30, cl: 200, etat: ETAT_GLACE })
    const l = new LecteurFantome(rec.fin('X', 2, 1))
    expect(l.duree).toBe(1)
    expect(l.a(0)).toEqual({ x: 0, y: 0, r: 20, cl: 300, etat: ETAT_EAU })
    expect(l.a(0.25)).toEqual({ x: 50, y: 25, r: 25, cl: 250, etat: ETAT_EAU })
    expect(l.a(0.3)!.etat).toBe(ETAT_GLACE) // l'état bascule au milieu du cran
    expect(l.a(0.75)).toEqual({ x: 100, y: 100, r: 30, cl: 200, etat: ETAT_GLACE })
    expect(l.a(1.0)).toEqual({ x: 100, y: 150, r: 30, cl: 200, etat: ETAT_GLACE })
    expect(l.a(1.01)).toBeNull() // le sas est bu
    expect(l.a(-0.1)).toBeNull()
    // une trace vide ou à un seul point
    expect(new LecteurFantome(new EnregistreurFantome().fin('X', 0, 0)).a(0)).toBeNull()
    const un = new EnregistreurFantome(0.1)
    un.note(0, { x: 5, y: 5, r: 1, cl: 1, etat: 0 })
    expect(new LecteurFantome(un.fin('X', 0, 0)).a(0)).toEqual({ x: 5, y: 5, r: 2, cl: 1, etat: 0 })
  })

  it('le rangement : un fantôme par salle et par record, relu depuis le stockage', () => {
    const st = memoire()
    const f = new Fantomes(st)
    expect(f.pour('21-A')).toEqual({})
    const rec = new EnregistreurFantome()
    rec.note(0, { x: 1, y: 2, r: 3, cl: 4, etat: 0 })
    const vol = rec.fin('REX', 3.4, 80, '2026-09-06T00:00:01.000Z')
    const chr = rec.fin('REX', 2.1, 40, '2026-09-06T00:00:02.000Z')
    f.pose('21-A', 'volume', vol)
    f.pose('21-A', 'chrono', chr)
    expect(f.pour('21-A').volume).toEqual(vol)
    expect(f.pour('21-A').chrono).toEqual(chr)
    // un second rangement relit tout depuis le stockage
    const g = new Fantomes(st)
    expect(g.codes()).toEqual(['21-A'])
    expect(g.pour('21-A').chrono?.litres).toBe(2.1)
    // un record qui retombe remplace la trace
    const chr2 = rec.fin('REX', 2.5, 35, '2026-09-06T00:00:03.000Z')
    g.pose('21-A', 'chrono', chr2)
    expect(new Fantomes(st).pour('21-A').chrono?.temps).toBe(35)
    g.oublie('21-A')
    expect(new Fantomes(st).codes()).toEqual([])
    // un stockage qui contient n'importe quoi : rangement vide, pas d'erreur
    st.setItem(CLE_FANTOMES, '[1, 2')
    expect(new Fantomes(st).codes()).toEqual([])
    st.setItem(CLE_FANTOMES, JSON.stringify({ '21-B': { volume: { v: 2, donnees: 'x' } }, '21-C': 7 }))
    expect(new Fantomes(st).codes()).toEqual([])
  })

  it('le budget : les fantômes les plus anciens partent, jamais celui qu’on vient de poser', () => {
    const st = memoire()
    // un fantôme d'environ 4 000 caractères, un budget pour trois
    const gros = (quand: string): ReturnType<EnregistreurFantome['fin']> => {
      const rec = new EnregistreurFantome(0.1)
      for (let i = 0; i < 350; i++) rec.note(i * 0.1, { x: i, y: i, r: 10, cl: 100, etat: 0 })
      return rec.fin('REX', 1, 35, quand)
    }
    const taille = JSON.stringify({ a: { volume: gros('2026-01-01') } }).length
    const f = new Fantomes(st, taille * 3 + 50)
    f.pose('21-A', 'volume', gros('2026-01-01T00:00:00Z'))
    f.pose('21-B', 'volume', gros('2026-01-03T00:00:00Z'))
    f.pose('21-A', 'chrono', gros('2026-01-02T00:00:00Z'))
    expect(f.codes().sort()).toEqual(['21-A', '21-B'])
    // un quatrième : le plus ancien (21-A volume, du 1er) s'en va
    f.pose('21-C', 'volume', gros('2026-01-04T00:00:00Z'))
    expect(f.pour('21-A').volume).toBeUndefined()
    expect(f.pour('21-A').chrono).toBeDefined()
    expect(f.pour('21-C').volume).toBeDefined()
    // un fantôme plus gros que tout le budget reste seul, mais reste
    const seul = new Fantomes(memoire(), 10)
    seul.pose('21-Z', 'chrono', gros('2026-01-05T00:00:00Z'))
    expect(seul.pour('21-Z').chrono).toBeDefined()
    expect(BUDGET_FANTOMES).toBeGreaterThan(20 * 19_000) // une bonne soixantaine de courses
    expect(CADENCE_FANTOME).toBe(0.1)
  })
})
