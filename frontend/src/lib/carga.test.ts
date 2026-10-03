import { describe, expect, it } from 'vitest'
import { avisoDeCarga, DESPERTANDO_MS, TARDANDO_MS } from './carga'

describe('avisoDeCarga', () => {
  it('arranca con el aviso de la pantalla', () => {
    expect(avisoDeCarga('Abriendo la cava…', 0)).toBe('Abriendo la cava…')
  })

  it('si tarda, cuenta que el backend se esta despertando', () => {
    expect(avisoDeCarga('Abriendo la cava…', DESPERTANDO_MS)).toMatch(/dormida/)
  })

  it('si tarda demasiado, lo dice sin vueltas', () => {
    expect(avisoDeCarga('Abriendo la cava…', TARDANDO_MS)).toMatch(/tardando/)
  })
})
