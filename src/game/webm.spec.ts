// L'assembleur WebM : la structure du fichier relue élément par élément —
// l'en-tête, le segment, les infos, la piste, les clusters aux images clés
// et leurs blocs. Le décodage réel se vérifie au navigateur et à ffmpeg.

import { describe, expect, it } from 'vitest'
import { ID, assembleWebm, litElement, litEnfants, type MorceauVideo } from './webm'

const morceau = (tempsMs: number, cle: boolean, octet: number): MorceauVideo => ({
  donnees: new Uint8Array([octet, octet + 1, octet + 2]),
  cle,
  tempsUs: tempsMs * 1000,
})

function structure(b: Uint8Array): {
  segment: ReturnType<typeof litEnfants>
  clusters: { temps: number; blocs: { ecart: number; cle: boolean; octets: number[] }[] }[]
  largeur: number
  hauteur: number
  duree: number
} {
  const entete = litElement(b, 0)
  expect(entete.id).toBe(ID.EBML)
  const seg = litElement(b, entete.debut + entete.taille)
  expect(seg.id).toBe(ID.Segment)
  const segment = litEnfants(b, seg.debut, seg.debut + seg.taille)
  const info = segment.find((e) => e.id === ID.Info)!
  const dureeEl = litEnfants(b, info.debut, info.debut + info.taille).find((e) => e.id === ID.Duration)!
  const duree = new DataView(b.buffer, b.byteOffset + dureeEl.debut, 8).getFloat64(0)
  const pistes = segment.find((e) => e.id === ID.Tracks)!
  const piste = litEnfants(b, pistes.debut, pistes.debut + pistes.taille)[0]
  const video = litEnfants(b, piste.debut, piste.debut + piste.taille).find((e) => e.id === ID.Video)!
  const dims = litEnfants(b, video.debut, video.debut + video.taille)
  const lit = (e: (typeof dims)[number]): number => {
    let v = 0
    for (let i = 0; i < e.taille; i++) v = v * 256 + b[e.debut + i]
    return v
  }
  const largeur = lit(dims.find((e) => e.id === ID.PixelWidth)!)
  const hauteur = lit(dims.find((e) => e.id === ID.PixelHeight)!)
  const clusters = segment
    .filter((e) => e.id === ID.Cluster)
    .map((c) => {
      const enfants = litEnfants(b, c.debut, c.debut + c.taille)
      const temps = lit(enfants.find((e) => e.id === ID.Timecode)!)
      const blocs = enfants
        .filter((e) => e.id === ID.SimpleBlock)
        .map((e) => ({
          ecart: new DataView(b.buffer, b.byteOffset + e.debut + 1, 2).getInt16(0),
          cle: (b[e.debut + 3] & 0x80) !== 0,
          octets: [...b.slice(e.debut + 4, e.debut + e.taille)],
        }))
      return { temps, blocs }
    })
  return { segment, clusters, largeur, hauteur, duree }
}

describe('assembleWebm', () => {
  it('écrit un en-tête webm, une piste VP9 aux bonnes dimensions, et un cluster par image clé', () => {
    const b = assembleWebm(
      [morceau(1000, true, 10), morceau(1033, false, 20), morceau(2000, true, 30), morceau(2033, false, 40)],
      640,
      480,
    )
    // les quatre premiers octets : l'identifiant EBML
    expect([...b.slice(0, 4)]).toEqual([0x1a, 0x45, 0xdf, 0xa3])
    expect(new TextDecoder().decode(b).includes('webm')).toBe(true)
    expect(new TextDecoder().decode(b).includes('V_VP9')).toBe(true)
    const s = structure(b)
    expect(s.largeur).toBe(640)
    expect(s.hauteur).toBe(480)
    expect(s.clusters).toHaveLength(2)
    // les temps sont ramenés au premier morceau : 0 puis 1000 ms
    expect(s.clusters[0].temps).toBe(0)
    expect(s.clusters[1].temps).toBe(1000)
    expect(s.clusters[0].blocs.map((x) => x.ecart)).toEqual([0, 33])
    expect(s.clusters[0].blocs.map((x) => x.cle)).toEqual([true, false])
    expect(s.clusters[1].blocs[1].octets).toEqual([40, 41, 42])
    // la durée : jusqu'à la fin de la dernière image (1033 ms + un pas moyen)
    expect(s.duree).toBeCloseTo(1033 + 1033 / 3, 3)
  })

  it('refuse un fichier vide ou qui ne commence pas par une image clé', () => {
    expect(() => assembleWebm([], 640, 480)).toThrow()
    expect(() => assembleWebm([morceau(0, false, 1)], 640, 480)).toThrow(/clé/)
  })

  it('sait écrire VP8 et une seule image', () => {
    const b = assembleWebm([morceau(0, true, 1)], 320, 240, 'V_VP8')
    expect(new TextDecoder().decode(b).includes('V_VP8')).toBe(true)
    const s = structure(b)
    expect(s.clusters).toHaveLength(1)
    expect(s.duree).toBe(40)
  })

  it('les tailles annoncées couvrent exactement le fichier (aucun octet perdu)', () => {
    const b = assembleWebm([morceau(0, true, 1), morceau(40, false, 2), morceau(80, false, 3)], 64, 48)
    const entete = litElement(b, 0)
    const seg = litElement(b, entete.debut + entete.taille)
    expect(seg.debut + seg.taille).toBe(b.length)
  })
})
