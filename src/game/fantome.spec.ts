// Le contrat du fantôme : l'encodage à vingt-cinq octets qui fait l'aller-
// retour (et la version 1 à huit octets qui se relit toujours), le profil en
// seize secteurs, l'enregistreur qui échantillonne à cadence fixe de temps
// simulé et date les événements, le lecteur qui interpole, disparaît au sas
// et donne l'écart de temps façon jeu de course, le rangement par salle et
// par record sous budget.
import { describe, expect, it } from 'vitest'
import {
  BUDGET_FANTOMES,
  CADENCE_FANTOME,
  CLE_FANTOMES,
  ETAT_EAU,
  ETAT_GLACE,
  ETAT_VAPEUR,
  EV_DASH,
  EnregistreurFantome,
  Fantomes,
  LecteurFantome,
  SECTEURS,
  decodeEchantillons,
  encodeEchantillons,
  profilDe,
  type EchantillonFantome,
} from './fantome'

function memoire(): { getItem(k: string): string | null; setItem(k: string, v: string): void } {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }
}

const rond = (r: number): number[] => new Array(SECTEURS).fill(r)
const ech = (x: number, y: number, extra: Partial<EchantillonFantome> = {}): EchantillonFantome => ({
  x,
  y,
  r: 10,
  cl: 100,
  etat: ETAT_EAU,
  poussee: null,
  profil: rond(14),
  ...extra,
})

describe('Le fantôme — la trace du corps', () => {
  it('encode vingt-cinq octets par échantillon et les relit à l’identique (aux arrondis près)', () => {
    const profil = Array.from({ length: SECTEURS }, (_, i) => 40 + i * 8)
    const pts: EchantillonFantome[] = [
      { x: -950.4, y: 12.6, r: 61.3, cl: 312.7, etat: ETAT_EAU, poussee: Math.PI / 2, profil },
      { x: 1234, y: -400, r: 80, cl: 250, etat: ETAT_GLACE, poussee: null, profil: rond(90) },
      { x: 32767, y: -32768, r: 600, cl: 70000, etat: ETAT_VAPEUR, poussee: -Math.PI / 2, profil: rond(2000) },
    ]
    const texte = encodeEchantillons(pts)
    expect(texte.length).toBe(Math.ceil((3 * 25) / 3) * 4) // base64 de 75 octets
    const relus = decodeEchantillons(texte, 3)
    expect(relus[0]).toMatchObject({ x: -950, y: 13, r: 62, cl: 313, etat: ETAT_EAU })
    expect(relus[0].poussee!).toBeCloseTo(Math.PI / 2, 1)
    expect(relus[0].profil).toEqual(profil)
    expect(relus[1]).toMatchObject({ x: 1234, y: -400, r: 80, cl: 250, etat: ETAT_GLACE, poussee: null })
    // les bornes : le rayon plafonne à 510, les centilitres à 65 535, un secteur à 1 020
    expect(relus[2]).toMatchObject({ x: 32767, y: -32768, r: 510, cl: 65535, etat: ETAT_VAPEUR })
    expect(relus[2].profil).toEqual(rond(1020))
    // −π/2 et 3π/2 sont le même angle
    expect(relus[2].poussee!).toBeCloseTo((3 * Math.PI) / 2, 1)
    // un texte cassé ne lève pas : trace vide
    expect(decodeEchantillons('%%%', 3)).toEqual([])
    // n plus grand que les données : on lit ce qu'il y a
    expect(decodeEchantillons(texte, 10)).toHaveLength(3)
  })

  it('une trace de version 1 (huit octets, ni forme ni geste) se relit toujours — en cercle', () => {
    // huit octets : x=100, y=−50, r/2=30, cl=200, etat=1
    const buf = new Uint8Array(8)
    const v = new DataView(buf.buffer)
    v.setInt16(0, 100)
    v.setInt16(2, -50)
    v.setUint8(4, 30)
    v.setUint16(5, 200)
    v.setUint8(7, 1)
    const texte = btoa(String.fromCharCode(...buf))
    const [p] = decodeEchantillons(texte, 1, 1)
    expect(p).toEqual({ x: 100, y: -50, r: 60, cl: 200, etat: 1, poussee: null, profil: [] })
    const l = new LecteurFantome({ v: 1, cadence: 0.1, n: 1, litres: 1, temps: 1, quand: '', nom: 'VIEUX', donnees: texte })
    expect(l.a(0)!.profil).toEqual([])
    // un profil absent s'encode au rayon du corps : la trace ré-encodée reste un cercle
    const re = decodeEchantillons(encodeEchantillons([p]), 1)
    expect(re[0].profil.every((e) => Math.abs(e - 60 * 1.41) < 4)).toBe(true)
  })

  it('le profil : l’étendue par secteur, et un secteur vide se comble par ses voisins', () => {
    // huit points : un carré aux quatre coins (d = √2 · 100) et quatre sur les axes (d = 50)
    const xs = [100, -100, -100, 100, 50, 0, -50, 0]
    const ys = [100, 100, -100, -100, 0, 50, 0, -50]
    const p = profilDe(0, 0, xs, ys, () => true, 8)
    expect(p).toHaveLength(SECTEURS)
    expect(p[0]).toBe(50) // l'est
    expect(p[2]).toBeCloseTo(141.42, 1) // 45° : le coin
    expect(p[4]).toBe(50) // le nord
    // les secteurs sans point (22,5°, 67,5°…) prennent la moyenne des voisins
    expect(p[1]).toBeCloseTo((50 + 141.42) / 2, 1)
    // la garde écarte des points : sans le coin nord-est, 45° se comble
    const q = profilDe(0, 0, xs, ys, (i) => i !== 0, 8)
    expect(q[2]).toBeGreaterThan(0)
    expect(q[2]).toBeLessThan(50) // un trou large s'effile, il ne se déchire pas
    // un nuage vide : tout à zéro, sans erreur
    expect(profilDe(0, 0, [], [], () => true, 0)).toEqual(rond(0))
  })

  it('l’enregistreur prend un échantillon par cran de temps simulé, jamais deux, se cale sur la grille, et date les événements', () => {
    const rec = new EnregistreurFantome(0.1)
    // des pas de 1/120 s : 120 pas = 1 s → 11 échantillons (t = 0, 0.1 … 1.0)
    for (let i = 0; i <= 120; i++) {
      const t = i / 120
      if (rec.aBesoin(t)) rec.note(t, ech(t * 100, 0, { poussee: t < 0.5 ? 0 : null }))
    }
    rec.evenement(0.42, EV_DASH, Math.PI)
    expect(rec.taille).toBe(11)
    expect(rec.evenements).toBe(1)
    const def = rec.fin('REX', 3.2, 1.0, '2026-09-06T00:00:00.000Z')
    expect(def).toMatchObject({ v: 2, n: 11, cadence: 0.1, litres: 3.2, temps: 1.0, nom: 'REX', ev: [420, EV_DASH, 180] })
    const pts = decodeEchantillons(def.donnees, def.n)
    expect(pts.map((p) => p.x)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
    expect(pts.map((p) => p.poussee === null)).toEqual([false, false, false, false, false, true, true, true, true, true, true])
    // sans événement, la clé ne s'écrit pas
    expect(new EnregistreurFantome().fin('X', 0, 0).ev).toBeUndefined()
    // un pas de retard (t = 0.19 sans échantillon à 0.1) ne décale pas la grille
    const rec2 = new EnregistreurFantome(0.1)
    rec2.note(0, ech(0, 0))
    rec2.note(0.19, ech(0, 0)) // pris (dû depuis 0.1)
    expect(rec2.aBesoin(0.199)).toBe(false)
    expect(rec2.aBesoin(0.2)).toBe(true) // le cran suivant reste 0.2, pas 0.29
  })

  it('le lecteur interpole entre deux échantillons (forme comprise), garde le geste le plus proche, et disparaît après le dernier', () => {
    const rec = new EnregistreurFantome(0.5)
    rec.note(0, ech(0, 0, { r: 20, cl: 300, profil: rond(20), poussee: 1 }))
    rec.note(0.5, ech(100, 50, { r: 30, cl: 200, etat: ETAT_GLACE, profil: rond(40), poussee: null }))
    rec.note(1.0, ech(100, 150, { r: 30, cl: 200, etat: ETAT_GLACE, profil: rond(40), poussee: null }))
    rec.evenement(0.6, EV_DASH, 0)
    const l = new LecteurFantome(rec.fin('X', 2, 1))
    expect(l.duree).toBe(1)
    expect(l.a(0)).toMatchObject({ x: 0, y: 0, r: 20, cl: 300, etat: ETAT_EAU, profil: rond(20) })
    expect(l.a(0)!.poussee).toBeCloseTo(1, 1)
    const mi = l.a(0.25)!
    expect(mi).toMatchObject({ x: 50, y: 25, r: 25, cl: 250, etat: ETAT_EAU, profil: rond(30) })
    expect(mi.poussee).toBeCloseTo(1, 1) // le plus proche : le premier
    expect(l.a(0.3)!.etat).toBe(ETAT_GLACE) // l'état bascule au milieu du cran
    expect(l.a(0.3)!.poussee).toBeNull()
    expect(l.a(1.0)).toMatchObject({ x: 100, y: 150 })
    expect(l.a(1.01)).toBeNull() // le sas est bu
    expect(l.a(-0.1)).toBeNull()
    // les événements de l'intervalle ]t0, t1]
    expect(l.evenementsEntre(0.5, 0.6)).toHaveLength(1)
    expect(l.evenementsEntre(0.6, 0.7)).toHaveLength(0)
    expect(l.evenementsEntre(0, 1)[0]).toMatchObject({ t: 0.6, type: EV_DASH, angle: 0 })
    // une trace vide ou à un seul point
    expect(new LecteurFantome(new EnregistreurFantome().fin('X', 0, 0)).a(0)).toBeNull()
    const un = new EnregistreurFantome(0.1)
    un.note(0, ech(5, 5, { r: 1, cl: 1 }))
    expect(new LecteurFantome(un.fin('X', 0, 0)).a(0)).toMatchObject({ x: 5, y: 5, r: 2, cl: 1 })
  })

  it('l’écart de temps façon jeu de course : combien le fantôme a mis pour être aussi près du sas', () => {
    // le fantôme file vers le sas (en x = 1000) à 100 u par cran de 0,1 s,
    // avec un aller-retour au milieu qui ne doit pas compter deux fois
    const rec = new EnregistreurFantome(0.1)
    const xs = [0, 100, 200, 300, 250, 200, 400, 500, 600, 700, 800, 900, 1000]
    xs.forEach((x, i) => rec.note(i * 0.1, ech(x, 0)))
    const l = new LecteurFantome(rec.fin('X', 1, 1.2))
    // à t = 1,0 je suis à 300 du sas (x = 700) : le fantôme y était au cran 9 (t = 0,9) → +0,1 s de retard
    expect(l.ecartTemps(1.0, 300, 1000, 0)).toBeCloseTo(0.1, 6)
    // à t = 0,5 je suis à 700 du sas (x = 300) : le fantôme y était au cran 3 (t = 0,3), pas au cran 5 → +0,2
    expect(l.ecartTemps(0.5, 700, 1000, 0)).toBeCloseTo(0.2, 6)
    // en avance : à t = 0,2 je suis déjà à 500 du sas ; le fantôme n'y était qu'au cran 7 → −0,5
    expect(l.ecartTemps(0.2, 500, 1000, 0)).toBeCloseTo(-0.5, 6)
    // plus près que le fantôme ne l'a jamais été : null
    expect(l.ecartTemps(1.0, -1, 1000, 0)).toBeNull()
    // un autre sas recalcule
    expect(l.ecartTemps(0.5, 300, 0, 0)).toBeCloseTo(0.5, 6) // à 300 de x=0, le fantôme y était au cran 0
    expect(new LecteurFantome(new EnregistreurFantome().fin('X', 0, 0)).ecartTemps(0, 0, 0, 0)).toBeNull()
  })

  it('le rangement : un fantôme par salle et par record, relu depuis le stockage, événements compris', () => {
    const st = memoire()
    const f = new Fantomes(st)
    expect(f.pour('21-A')).toEqual({})
    const rec = new EnregistreurFantome()
    rec.note(0, ech(1, 2))
    rec.evenement(0.5, EV_DASH, 1)
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
    expect(g.pour('21-A').volume?.ev).toEqual([500, EV_DASH, 57])
    // un record qui retombe remplace la trace
    const chr2 = rec.fin('REX', 2.5, 35, '2026-09-06T00:00:03.000Z')
    g.pose('21-A', 'chrono', chr2)
    expect(new Fantomes(st).pour('21-A').chrono?.temps).toBe(35)
    g.oublie('21-A')
    expect(new Fantomes(st).codes()).toEqual([])
    // un stockage qui contient n'importe quoi : rangement vide, pas d'erreur
    st.setItem(CLE_FANTOMES, '[1, 2')
    expect(new Fantomes(st).codes()).toEqual([])
    st.setItem(CLE_FANTOMES, JSON.stringify({ '21-B': { volume: { v: 3, donnees: 'x' } }, '21-C': 7 }))
    expect(new Fantomes(st).codes()).toEqual([])
    // une trace de version 1 rangée par un jeu d'avant se relit
    st.setItem(CLE_FANTOMES, JSON.stringify({ '21-D': { volume: { v: 1, cadence: 0.1, n: 0, litres: 1, temps: 1, quand: '', nom: 'V', donnees: '' } } }))
    expect(new Fantomes(st).pour('21-D').volume?.v).toBe(1)
  })

  it('le budget : les fantômes les plus anciens partent, jamais celui qu’on vient de poser', () => {
    const st = memoire()
    const gros = (quand: string): ReturnType<EnregistreurFantome['fin']> => {
      const rec = new EnregistreurFantome(0.1)
      for (let i = 0; i < 150; i++) rec.note(i * 0.1, ech(i, i))
      return rec.fin('REX', 1, 15, quand)
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
    // trois minutes à dix échantillons par seconde : ~60 Ko encodés, le budget en garde une vingtaine
    const troisMinutes = gros('x')
    const rec = new EnregistreurFantome(0.1)
    for (let i = 0; i < 1800; i++) rec.note(i * 0.1, ech(i, i))
    const poids = JSON.stringify(rec.fin('REX', 1, 180)).length
    expect(poids).toBeGreaterThan(55_000)
    expect(poids).toBeLessThan(65_000)
    expect(Math.floor(BUDGET_FANTOMES / poids)).toBeGreaterThanOrEqual(20)
    expect(troisMinutes.v).toBe(2)
    expect(CADENCE_FANTOME).toBe(0.1)
  })
})
