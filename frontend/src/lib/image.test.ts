import { describe, expect, it } from 'vitest'
import { PRESET_GUARDAR, PRESET_OCR, escala } from './image'

describe('escala', () => {
  it('achica una foto de telefono al lado pedido', () => {
    // 3072x4096 es una foto real del bucket.
    expect(escala(3072, 4096, 2048)).toBeCloseTo(0.5)
  })

  it('NO agranda una foto que ya es chica', () => {
    // Reescalar hacia arriba solo inventa pixeles y suma peso.
    expect(escala(800, 600, 2048)).toBe(1)
  })

  it('mide sobre el lado mayor, sea cual sea la orientacion', () => {
    expect(escala(4096, 3072, 2048)).toBeCloseTo(0.5)
  })

  it('deja pasar el caso exacto sin tocarlo', () => {
    expect(escala(2048, 1000, 2048)).toBe(1)
  })

  it('no explota con dimensiones invalidas', () => {
    expect(escala(0, 0, 2048)).toBe(1)
  })
})

describe('presets', () => {
  it('al OCR le da mas pixeles que a la copia de mostrar', () => {
    // Gemini lee texto chico de la etiqueta; el visor solo tiene que verse bien.
    expect(PRESET_OCR.maxEdge).toBeGreaterThan(PRESET_GUARDAR.maxEdge)
    expect(PRESET_OCR.quality).toBeGreaterThan(PRESET_GUARDAR.quality)
  })

  it('ninguno baja de 1280 ni de calidad 0.8', () => {
    // Por debajo de eso los artefactos JPEG se ven en el visor grande.
    for (const preset of [PRESET_OCR, PRESET_GUARDAR]) {
      expect(preset.maxEdge).toBeGreaterThanOrEqual(1280)
      expect(preset.quality).toBeGreaterThanOrEqual(0.8)
    }
  })
})
