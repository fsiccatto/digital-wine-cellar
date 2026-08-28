import { describe, expect, it } from 'vitest'
import type { CataRecord, WineRecord } from './types'
import {
  cellarValue,
  glassTint,
  groupByMonth,
  guardaDe,
  splitVarietals,
  varietals,
  ventanaDeGuarda,
} from './wine'

/** Un vino cualquiera; cada test pisa solo lo que le importa. */
function wine(overrides: Partial<WineRecord> = {}): WineRecord {
  return {
    id: 'uuid',
    codigo_vino: 'TRA-MAL-2020-0001',
    fecha_ingreso: '2026-01-01T10:00:00',
    bodega: 'Trapiche',
    nombre_vino: 'Fond de Cave',
    varietal: 'Malbec',
    anada: 2020,
    region: 'Mendoza',
    alcohol: '14',
    cantidad: 1,
    ubicacion: null,
    precio_estimado: null,
    foto_url: null,
    ...overrides,
  }
}

// Fecha fija: si no, los tests de guarda cambian de resultado cada 1 de enero.
const HOY = new Date('2026-08-27')

describe('splitVarietals', () => {
  it('deja una uva sola como está', () => {
    expect(splitVarietals('Malbec')).toEqual(['Malbec'])
  })

  it('NO parte una uva de dos palabras', () => {
    // Partir por el espacio confundiria "Cabernet Sauvignon" con "Cabernet Franc".
    expect(splitVarietals('Cabernet Sauvignon')).toEqual(['Cabernet Sauvignon'])
  })

  it('parte un corte por sus separadores', () => {
    expect(splitVarietals('Malbec, Cabernet Sauvignon, Petit Verdot & Tannat')).toEqual([
      'Malbec',
      'Cabernet Sauvignon',
      'Petit Verdot',
      'Tannat',
    ])
  })

  it('descarta los conectores sueltos', () => {
    expect(splitVarietals('Malbec y Tannat')).toEqual(['Malbec', 'Tannat'])
  })
})

describe('varietals', () => {
  it('un corte aporta cada una de sus uvas a los chips', () => {
    const lista = varietals([
      wine({ varietal: 'Malbec' }),
      wine({ varietal: 'Malbec & Cabernet Franc' }),
    ])
    expect(lista).toEqual(['Cabernet Franc', 'Malbec'])
  })
})

describe('ventanaDeGuarda', () => {
  it('un blanco se toma joven', () => {
    expect(ventanaDeGuarda(wine({ varietal: 'Chardonnay' }))).toEqual({ desde: 1, hasta: 4 })
  })

  it('un Malbec va al termino medio', () => {
    expect(ventanaDeGuarda(wine({ varietal: 'Malbec' }))).toEqual({ desde: 2, hasta: 8 })
  })

  it('una uva tanica aguanta anos', () => {
    expect(ventanaDeGuarda(wine({ varietal: 'Cabernet Sauvignon' }))).toEqual({
      desde: 3,
      hasta: 15,
    })
  })

  it('una uva desconocida cae en el termino medio, no en un extremo', () => {
    expect(ventanaDeGuarda(wine({ varietal: 'Uva Rara' }))).toEqual({ desde: 2, hasta: 8 })
  })

  it('de un corte manda la uva mas tanica', () => {
    // Es la que sostiene la estructura, asi que define cuanto aguanta.
    expect(ventanaDeGuarda(wine({ varietal: 'Malbec & Tannat' }))).toEqual({
      desde: 3,
      hasta: 15,
    })
  })

  it('"Reserva" estira un tinto', () => {
    expect(
      ventanaDeGuarda(wine({ varietal: 'Malbec', nombre_vino: 'Gran Reserva' })),
    ).toEqual({ desde: 2, hasta: 12 })
  })

  it('"Reserva" NO estira un blanco', () => {
    // Ahi la palabra habla de la barrica; guardarlo igual lo arruina.
    expect(
      ventanaDeGuarda(
        wine({ varietal: 'Sauvignon Blanc', nombre_vino: 'Don David Reserve' }),
      ),
    ).toEqual({ desde: 1, hasta: 4 })
  })

  it('"Reservado" no se confunde con "Reserva"', () => {
    expect(
      ventanaDeGuarda(wine({ varietal: 'Malbec', nombre_vino: 'Reservado del Fundador' })),
    ).toEqual({ desde: 2, hasta: 8 })
  })
})

describe('guardaDe', () => {
  it('marca joven lo que todavia no entro en ventana', () => {
    expect(guardaDe(wine({ anada: 2025, varietal: 'Cabernet Sauvignon' }), HOY)?.estado).toBe(
      'joven',
    )
  })

  it('marca listo lo que esta en ventana', () => {
    expect(guardaDe(wine({ anada: 2020, varietal: 'Malbec' }), HOY)?.estado).toBe('listo')
  })

  it('avisa el ultimo ano de la ventana', () => {
    expect(guardaDe(wine({ anada: 2019, varietal: 'Malbec' }), HOY)?.estado).toBe('pasando')
  })

  it('marca pasado lo que se fue de ventana', () => {
    expect(guardaDe(wine({ anada: 2010, varietal: 'Malbec' }), HOY)?.estado).toBe('pasado')
  })

  it('cuenta desde la anada y no desde el ingreso', () => {
    // Un 2018 comprado ayer ya tiene los anos encima.
    const viejo = wine({ anada: 2018, varietal: 'Malbec', fecha_ingreso: '2026-08-26T10:00:00' })
    expect(guardaDe(viejo, HOY)?.edad).toBe(8)
  })

  it('un blanco en punto no invita a guardarlo', () => {
    expect(guardaDe(wine({ anada: 2025, varietal: 'Sauvignon Blanc' }), HOY)?.detalle).toBe(
      'Fresco, para tomar',
    )
  })

  it('no estima con una anada invalida', () => {
    expect(guardaDe(wine({ anada: 0 }), HOY)).toBeNull()
  })

  it('no estima con una anada futura', () => {
    expect(guardaDe(wine({ anada: 2030 }), HOY)).toBeNull()
  })
})

describe('cellarValue', () => {
  it('multiplica el precio por las botellas que quedan', () => {
    const total = cellarValue([
      wine({ precio_estimado: 1000, cantidad: 3 }),
      wine({ precio_estimado: 500, cantidad: 2 }),
    ])
    expect(total).toBe(4000)
  })

  it('un vino sin precio no suma', () => {
    expect(cellarValue([wine({ precio_estimado: null, cantidad: 9 })])).toBe(0)
  })

  it('un stock negativo del Sheet no resta', () => {
    expect(cellarValue([wine({ precio_estimado: 1000, cantidad: -5 })])).toBe(0)
  })
})

describe('glassTint', () => {
  it('un corte se pinta como corte', () => {
    const corte = glassTint('Malbec & Cabernet Franc')
    expect(corte).toEqual(glassTint('Blend'))
  })

  it('un blanco no se confunde con un Cabernet Sauvignon', () => {
    expect(glassTint('Cabernet Sauvignon')).not.toEqual(glassTint('Sauvignon Blanc'))
  })
})

describe('groupByMonth', () => {
  function cata(fecha: string, id = fecha): CataRecord {
    return {
      id_cata: id,
      vino_id: 'TRA-MAL-2020-0001',
      fecha_consumo: fecha,
      puntuacion: 4,
      notas_cata: null,
      maridaje: null,
      bodega: null,
      nombre_vino: null,
      anada: null,
      vino_existe: true,
    }
  }

  it('agrupa por mes, mas reciente primero', () => {
    const grupos = groupByMonth([
      cata('2026-01-15T21:00:00'),
      cata('2026-03-02T21:00:00'),
      cata('2026-03-20T21:00:00'),
    ])
    expect(grupos.map((g) => g.key)).toEqual(['2026-03', '2026-01'])
    expect(grupos[0].catas).toHaveLength(2)
  })

  it('manda las fechas ilegibles al final, sin perderlas', () => {
    // El Sheet se edita a mano: una fecha rota no debe tirar el historico.
    const grupos = groupByMonth([cata('no es una fecha'), cata('2026-03-02T21:00:00')])
    expect(grupos[grupos.length - 1].label).toBe('Sin fecha')
    expect(grupos).toHaveLength(2)
  })
})
