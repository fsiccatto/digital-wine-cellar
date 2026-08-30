import { describe, expect, it } from 'vitest'
import { necesitaEntrada, pasoAtras } from './navegacion'

describe('pasoAtras', () => {
  it('desde la cava, sin nada abierto, sale de la app', () => {
    expect(pasoAtras('cellar', false)).toEqual({ hacer: 'salir' })
  })

  it('desde un vino vuelve a la cava, no cierra la app', () => {
    // Este era el bug: instalada como PWA, atras cerraba la app entera.
    expect(pasoAtras('wine', false)).toEqual({ hacer: 'ir-a-cava' })
  })

  it('desde catas y desde el escaneo tambien vuelve', () => {
    expect(pasoAtras('catas', false)).toEqual({ hacer: 'ir-a-cava' })
    expect(pasoAtras('scan', false)).toEqual({ hacer: 'ir-a-cava' })
  })

  it('una capa abierta se cierra antes que cambiar de pantalla', () => {
    // Es lo ultimo que abriste, asi que es lo primero que espera cerrarse.
    expect(pasoAtras('wine', true)).toEqual({ hacer: 'cerrar-capa' })
  })

  it('una capa abierta en la cava tampoco cierra la app', () => {
    expect(pasoAtras('cellar', true)).toEqual({ hacer: 'cerrar-capa' })
  })
})

describe('necesitaEntrada', () => {
  it('la cava desnuda no ocupa una entrada del historial', () => {
    expect(necesitaEntrada('cellar', false)).toBe(false)
  })

  it('un vino ocupa una', () => {
    expect(necesitaEntrada('wine', false)).toBe(true)
  })

  it('una capa abierta ocupa una, este donde este', () => {
    expect(necesitaEntrada('cellar', true)).toBe(true)
    expect(necesitaEntrada('wine', true)).toBe(true)
  })
})
