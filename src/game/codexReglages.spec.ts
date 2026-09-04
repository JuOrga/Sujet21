import { describe, expect, it } from 'vitest'
import {
  MEMOIRE_DEFAUT,
  MEMOIRE_MAX,
  RARETES,
  REGLAGE_DEFAUT,
  estDefaut,
  litFichierVideo,
  litReglage,
  litReglages,
  rareteDef,
  reglageDe,
} from './codexReglages'
import { videoDe } from './codexVue'

describe('le réglage d’une fiche du codex', () => {
  it('toutes les fiches naissent normales, à dix de mémoire, vidéo du dossier', () => {
    expect(REGLAGE_DEFAUT.rarete).toBe('normale')
    expect(REGLAGE_DEFAUT.memoire).toBe(MEMOIRE_DEFAUT)
    expect(reglageDe({}, 'eau-mur')).toEqual(REGLAGE_DEFAUT)
    expect(estDefaut(reglageDe({}, 'eau-mur'))).toBe(true)
  })

  it('un réglage abîmé retombe champ par champ sur ses défauts', () => {
    expect(litReglage(null)).toEqual(REGLAGE_DEFAUT)
    const r = litReglage({ memoire: 'douze', rarete: 'mythique', video: 'javascript:alert(1)' })
    expect(r.memoire).toBe(MEMOIRE_DEFAUT)
    expect(r.rarete).toBe('normale')
    expect(r.video).toBe('')
  })

  it('la mémoire se borne : jamais négative, jamais au-delà du plafond, toujours entière', () => {
    expect(litReglage({ memoire: -5 }).memoire).toBe(0)
    expect(litReglage({ memoire: 12.6 }).memoire).toBe(13)
    expect(litReglage({ memoire: 99999 }).memoire).toBe(MEMOIRE_MAX)
  })

  it('une vidéo envoyée n’est gardée que si c’est une URL https', () => {
    const url = 'https://blob.vercel-storage.com/codex-blobs/eau-mur-abc.webm'
    expect(litReglage({ video: url }).video).toBe(url)
    expect(litReglage({ video: 'http://exemple/x.webm' }).video).toBe('')
    expect(litReglage({ video: '/assets/codex/eau-mur.webm' }).video).toBe('')
  })

  it('le document du magasin ne retient que les ids de fiches plausibles', () => {
    const r = litReglages({
      fiches: {
        'eau-mur': { memoire: 25, rarete: 'rare' },
        'Mauvais Id !': { memoire: 1 },
        'recit-le-choix': { memoire: 0, rarete: 'legendaire' },
      },
    })
    expect(Object.keys(r)).toEqual(['eau-mur', 'recit-le-choix'])
    expect(r['eau-mur']).toMatchObject({ memoire: 25, rarete: 'rare' })
    expect(r['recit-le-choix'].memoire).toBe(0)
    expect(litReglages(null)).toEqual({})
    expect(litReglages({ fiches: 'rien' })).toEqual({})
  })

  it('la rareté a un nom et une teinte, et une rareté inconnue vaut la normale', () => {
    expect(RARETES.map((r) => r.id)).toEqual(['normale', 'rare', 'legendaire'])
    expect(rareteDef('legendaire').nom).toBe('LÉGENDAIRE')
    expect(rareteDef('mythique').id).toBe('normale')
  })

  it('la vidéo lue est celle envoyée quand il y en a une, sinon celle du dossier', () => {
    expect(videoDe('eau-mur')).toEqual({ src: '/assets/codex/eau-mur.webm', poster: '/assets/codex/eau-mur.webp' })
    expect(videoDe('eau-mur', 'https://blob/x.webm')).toEqual({ src: 'https://blob/x.webm', poster: '' })
  })

  it('un fichier vidéo ne part que s’il est webm ou mp4, et pas trop lourd', () => {
    expect(litFichierVideo({ type: 'video/webm', size: 400_000 })).toBe('.webm')
    expect(litFichierVideo({ type: 'video/mp4', size: 400_000 })).toBe('.mp4')
    expect(litFichierVideo({ type: 'video/quicktime', size: 400_000 })).toBeNull()
    expect(litFichierVideo({ type: 'video/webm', size: 30_000_000 })).toBeNull()
    expect(litFichierVideo({ type: 'video/webm', size: 0 })).toBeNull()
  })
})
