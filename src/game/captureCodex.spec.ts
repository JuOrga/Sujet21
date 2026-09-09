// La capture des vidéos du codex : la partie pure — le cadre, le type, le
// nom, le verdict. La classe qui enregistre ne vit qu'avec un DOM.

import { describe, expect, it } from 'vitest'
import {
  DUREE_CAPTURE_MS,
  LARGEUR_CAPTURE,
  cadreCapture,
  nomFichierCapture,
  typeCapture,
  typeNu,
  verdictCapture,
} from './captureCodex'
import { VIDEO_MAX_OCTETS } from './codexReglages'

describe('cadreCapture', () => {
  it('découpe le 4:3 au centre d’une scène large, en 640 de large', () => {
    const c = cadreCapture(1920, 1080)
    expect(c.largeur).toBe(LARGEUR_CAPTURE)
    expect(c.hauteur).toBe(480)
    // toute la hauteur, une largeur de 1440 sur 1920, centrée
    expect(c.h).toBeCloseTo(1)
    expect(c.y).toBeCloseTo(0)
    expect(c.w).toBeCloseTo(1440 / 1920)
    expect(c.x).toBeCloseTo(240 / 1920)
  })

  it('découpe le 4:3 au centre d’une scène haute', () => {
    const c = cadreCapture(800, 1200)
    expect(c.w).toBeCloseTo(1)
    expect(c.h).toBeCloseTo(600 / 1200)
    expect(c.y).toBeCloseTo(300 / 1200)
  })

  it('n’agrandit jamais : une scène étroite est livrée à sa taille, en pair', () => {
    const c = cadreCapture(333, 600)
    expect(c.largeur).toBe(332)
    expect(c.hauteur % 2).toBe(0)
    expect(c.hauteur).toBe(Math.round(332 / (4 / 3) / 2) * 2)
  })

  it('calcule la hauteur depuis la largeur rendue paire : 335 donne 334×250, pas 334×252', () => {
    const c = cadreCapture(335, 600)
    expect(c.largeur).toBe(334)
    expect(c.hauteur).toBe(250)
  })

  it('tient sur une scène sans taille', () => {
    const c = cadreCapture(0, 0)
    expect(c.w).toBe(1)
    expect(c.largeur).toBeGreaterThan(0)
  })
})

describe('typeCapture', () => {
  it('préfère VP9 en WebM, puis VP8, puis MP4', () => {
    expect(typeCapture(() => true)).toBe('video/webm;codecs=vp9')
    expect(typeCapture((m) => m === 'video/webm;codecs=vp8' || m === 'video/mp4')).toBe('video/webm;codecs=vp8')
    expect(typeCapture((m) => m === 'video/mp4')).toBe('video/mp4')
  })

  it('null quand rien n’est enregistrable', () => {
    expect(typeCapture(() => false)).toBeNull()
  })

  it('le type nu est celui que le magasin connaît', () => {
    expect(typeNu('video/webm;codecs=vp9')).toBe('video/webm')
    expect(typeNu('VIDEO/MP4')).toBe('video/mp4')
  })
})

describe('nomFichierCapture', () => {
  it('nomme le fichier comme le dossier l’attend', () => {
    expect(nomFichierCapture('eau-hydrophile', 'video/webm;codecs=vp9')).toBe('eau-hydrophile.webm')
    expect(nomFichierCapture('glace-rideau', 'video/mp4')).toBe('glace-rideau.mp4')
    expect(nomFichierCapture('x', 'video/inconnu')).toBe('x.webm')
  })
})

describe('verdictCapture', () => {
  it('accepte une boucle légère et dit son poids', () => {
    const v = verdictCapture(400 * 1024, 'video/webm;codecs=vp9')
    expect(v.ok).toBe(true)
    expect(v.texte).toContain('400 Ko')
    expect(v.texte).toContain(`${DUREE_CAPTURE_MS / 1000},0 s`)
    // la mémoire de capture dit sa durée réelle, à la décimale
    expect(verdictCapture(1000, 'video/webm', 8.37).texte).toContain('8,4 s')
  })

  it('refuse le vide, l’inconnu et le trop lourd', () => {
    expect(verdictCapture(0, 'video/webm').ok).toBe(false)
    expect(verdictCapture(1000, 'video/ogg').ok).toBe(false)
    expect(verdictCapture(VIDEO_MAX_OCTETS + 1, 'video/webm').ok).toBe(false)
    expect(verdictCapture(VIDEO_MAX_OCTETS, 'video/webm').ok).toBe(true)
  })
})
