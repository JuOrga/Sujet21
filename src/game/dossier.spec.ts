import { describe, expect, it } from 'vitest'
import {
  gesteEtat,
  gestesFermerDossier,
  motCoque,
  nomBoutonCourt,
  peripheriqueALaMain,
} from './dossier'
import { BOUTON } from './manette'

const CALME = {
  manetteConnectee: true,
  manetteAt: 0,
  pointeurAt: 0,
  clavierAt: 0,
  tactile: false,
}

describe('le dossier : qui a la main', () => {
  it('la manette, si elle a parlé après le pointeur ET le clavier', () => {
    expect(peripheriqueALaMain({ ...CALME, manetteAt: 5, pointeurAt: 3, clavierAt: 4 })).toBe('manette')
  })

  it('le clavier, pressé après la manette, reprend la main', () => {
    // le cas qui écrivait « B » à qui venait de presser Tab
    expect(peripheriqueALaMain({ ...CALME, manetteAt: 5, pointeurAt: 3, clavierAt: 6 })).toBe('clavier')
  })

  it('une manette débranchée ne compte pas, même récente', () => {
    expect(peripheriqueALaMain({ ...CALME, manetteConnectee: false, manetteAt: 9 })).toBe('clavier')
  })

  it('au doigt, le dernier toucher l’emporte sur une touche plus ancienne', () => {
    expect(peripheriqueALaMain({ ...CALME, tactile: true, pointeurAt: 7, clavierAt: 2 })).toBe('tactile')
    expect(peripheriqueALaMain({ ...CALME, tactile: true, pointeurAt: 2, clavierAt: 7 })).toBe('clavier')
  })
})

describe('le dossier : le pied dit le bon geste', () => {
  it('à la manette : B, puis le bouton du dossier sans sa parenthèse', () => {
    expect(gestesFermerDossier('manette', 'Tab', BOUTON.R3)).toEqual(['B', 'R3'])
  })

  it('à la manette, sans bouton de dossier (ou redéfini sur B) : B seul', () => {
    expect(gestesFermerDossier('manette', 'Tab', null)).toEqual(['B'])
    expect(gestesFermerDossier('manette', 'Tab', BOUTON.B)).toEqual(['B'])
  })

  it('au clavier : la touche du dossier, jamais un bouton', () => {
    expect(gestesFermerDossier('clavier', 'Tab', BOUTON.R3)).toEqual(['TAB'])
    expect(gestesFermerDossier('clavier', 'd', BOUTON.R3)).toEqual(['D'])
  })

  it('au doigt, ou sans touche : la croix', () => {
    expect(gestesFermerDossier('tactile', 'Tab', BOUTON.R3)).toEqual(['✕'])
    expect(gestesFermerDossier('clavier', null, BOUTON.R3)).toEqual(['✕'])
  })

  it('le nom court d’un bouton perd sa précision', () => {
    expect(nomBoutonCourt(BOUTON.R3)).toBe('R3')
    expect(nomBoutonCourt(BOUTON.X)).toBe('X')
    expect(nomBoutonCourt(null)).toBe('—')
  })
})

describe('le dossier : la commande d’un état', () => {
  it('suit l’appareil qui a la main', () => {
    expect(gesteEtat('manette', 'f', BOUTON.X)).toBe('X')
    expect(gesteEtat('clavier', 'f', BOUTON.X)).toBe('F')
  })

  it('se rabat sur l’autre appareil plutôt que de ne rien dire', () => {
    expect(gesteEtat('manette', 'f', null)).toBe('F')
    expect(gesteEtat('clavier', null, BOUTON.Y)).toBe('Y')
    expect(gesteEtat('clavier', null, null)).toBeNull()
  })

  it('se tait au doigt : on touche le cadran', () => {
    expect(gesteEtat('tactile', 'f', BOUTON.X)).toBeNull()
  })
})

describe('le dossier : la coque en un mot', () => {
  it('suit les seuils de degrés', () => {
    expect(motCoque(21)).toBe('tiède')
    expect(motCoque(5)).toBe('fraîche')
    expect(motCoque(-10)).toBe('froide')
    expect(motCoque(-40)).toBe('glaciale')
    expect(motCoque(-60)).toBe('glaciale')
  })
})
