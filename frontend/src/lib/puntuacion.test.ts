import { describe, expect, it } from 'vitest'
import { alTocar, formatPuntuacion, rellenoDe } from './puntuacion'

describe('alTocar', () => {
  it('tocar una copa nueva llena hasta ahi', () => {
    expect(alTocar(2, 5)).toBe(5)
    expect(alTocar(5, 3)).toBe(3)
  })

  it('tocar DOS VECES la misma copa la deja a la mitad', () => {
    // Es la forma de cargar un 4,5 sin apuntar a media copa de 15px.
    expect(alTocar(5, 5)).toBe(4.5)
    expect(alTocar(3, 3)).toBe(2.5)
  })

  it('un tercer toque vuelve a llenarla, para poder deshacer', () => {
    expect(alTocar(4.5, 5)).toBe(5)
  })

  it('el ciclo completo de una copa', () => {
    let v = 2
    v = alTocar(v, 5)
    expect(v).toBe(5)
    v = alTocar(v, 5)
    expect(v).toBe(4.5)
    v = alTocar(v, 5)
    expect(v).toBe(5)
  })

  it('la primera copa puede quedar en medio punto', () => {
    expect(alTocar(1, 1)).toBe(0.5)
  })
})

describe('rellenoDe', () => {
  it('con 4,5 las primeras cuatro estan llenas y la quinta a la mitad', () => {
    expect([1, 2, 3, 4, 5].map((c) => rellenoDe(c, 4.5))).toEqual([
      'llena',
      'llena',
      'llena',
      'llena',
      'media',
    ])
  })

  it('con un entero no hay ninguna a la mitad', () => {
    expect([1, 2, 3, 4, 5].map((c) => rellenoDe(c, 3))).toEqual([
      'llena',
      'llena',
      'llena',
      'vacia',
      'vacia',
    ])
  })

  it('con 0,5 solo la primera va por la mitad', () => {
    expect([1, 2, 3].map((c) => rellenoDe(c, 0.5))).toEqual(['media', 'vacia', 'vacia'])
  })
})

describe('formatPuntuacion', () => {
  it('usa coma decimal, no punto', () => {
    expect(formatPuntuacion(4.5)).toBe('4,5')
  })

  it('un entero no arrastra el decimal', () => {
    expect(formatPuntuacion(4)).toBe('4')
  })
})
