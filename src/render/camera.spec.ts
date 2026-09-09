// LE PLAN D'OUVERTURE, IMAGE PAR IMAGE : ce que grave ce fichier, c'est la
// continuité du mouvement — pas la forme de la courbe, qui est un choix de
// mise en scène, mais l'absence de saut. Le cas mesuré est celui du tableau
// livré (2400 × 1500, corps né au bord gauche) sur un écran 1280 × 720.

import { describe, expect, it } from 'vitest'
import { Camera } from './camera'
import { DEFAULT_PARAMS } from '../sim/params'

const VW = 1280
const VH = 720
const BOUNDS = { minX: -1200, minY: -750, maxX: 1200, maxY: 750 }
const CORPS = { x: -950, y: 0, r: 73 }

// Le plan tenu puis la plongée, posés explicitement : le test dit ses
// hypothèses au lieu de dépendre des valeurs par défaut de startIntro.
const TENUE = 0.9
const PLONGEE = 1.7
const IPS = 60

function ouvre(): Camera {
  const cam = new Camera()
  cam.startIntro(BOUNDS, VW, VH, TENUE, PLONGEE)
  return cam
}

/** Où le corps se dessine à l'écran, en pixels depuis le centre. */
function corpsEcran(cam: Camera): { x: number; y: number } {
  return { x: (CORPS.x - cam.x) * cam.zoom, y: (CORPS.y - cam.y) * cam.zoom }
}

/** Une image de durée dt ; rend le déplacement du corps à l'écran (px). */
function image(cam: Camera, dt: number): number {
  const avant = corpsEcran(cam)
  cam.update(dt, CORPS.x, CORPS.y, CORPS.r, VW, VH, DEFAULT_PARAMS)
  const apres = corpsEcran(cam)
  return Math.hypot(apres.x - avant.x, apres.y - avant.y)
}

describe('caméra — le plan d’ouverture', () => {
  it('à 60 images/s, le corps glisse sans à-coup jusqu’à la remise au suivi', () => {
    const cam = ouvre()
    let precedent = 0
    let plusGrand = 0
    for (let i = 0; i < (TENUE + PLONGEE + 1.4) * IPS; i++) {
      const introAvant = cam.introEnCours
      const d = image(cam, 1 / IPS)
      // le pas d'une image ne bondit jamais d'un coup par rapport au précédent
      expect(Math.abs(d - precedent)).toBeLessThan(0.35)
      // …et la remise au suivi (fin du plan) ne se voit pas non plus
      if (introAvant && !cam.introEnCours) expect(d).toBeLessThan(0.5)
      plusGrand = Math.max(plusGrand, d)
      precedent = d
    }
    expect(plusGrand).toBeGreaterThan(3) // la plongée a bien eu lieu
    expect(plusGrand).toBeLessThan(8)
    // et elle finit exactement sur le corps : rien à rattraper ensuite
    expect(cam.x).toBeCloseTo(CORPS.x, 3)
    expect(cam.y).toBeCloseTo(CORPS.y, 3)
  })

  it('une image longue en pleine plongée ne fait pas sauter la caméra', () => {
    // Le début de tableau est le moment des accrocs (chargement, premières
    // images, ramasse-miettes). Une image de 100 ms comptée au vrai temps
    // valait six images de mouvement d'un coup : c'est ce saut que l'œil
    // lisait comme un zoom « pas fluide du tout ». On la compare à ce que
    // vaut l'image lente la plus longue admise (1/30 s) : au plus le double
    // d'une image ordinaire, et à peine plus.
    const cam = ouvre()
    let ordinaire = 0
    // jusqu'au milieu de la plongée, là où la caméra va le plus vite
    const milieu = Math.round((TENUE + PLONGEE / 2) * IPS)
    for (let i = 0; i < milieu; i++) ordinaire = image(cam, 1 / IPS)
    expect(ordinaire).toBeGreaterThan(4)
    const accroc = image(cam, 0.1)
    expect(accroc).toBeLessThan(ordinaire * 2.2)
  })

  it('la main du joueur interrompt le plan sur-le-champ', () => {
    const cam = ouvre()
    image(cam, 1 / 60)
    expect(cam.introEnCours).toBe(true)
    cam.zoomBy(1.1, DEFAULT_PARAMS)
    expect(cam.introEnCours).toBe(false)
  })
})
