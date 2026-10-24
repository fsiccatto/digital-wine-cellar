import { describe, expect, it } from 'vitest'
import {
  detallePendiente,
  matchesPendienteSearch,
  separarPendientes,
  yaEnLaCava,
} from './pendientes'
import type { PendienteRecord, WineRecord } from './types'

function pendiente(overrides: Partial<PendienteRecord> = {}): PendienteRecord {
  return {
    id: 'p1',
    fecha_alta: '2026-10-01T21:00:00',
    nombre_vino: 'Gran Enemigo Gualtallary',
    bodega: 'El Enemigo',
    varietal: null,
    anada: null,
    region: null,
    alcohol: null,
    origen: 'Cena en lo de Ana',
    puntuacion: null,
    notas: null,
    maridaje: null,
    fecha_probado: null,
    foto_url: null,
    vino_id: null,
    ...overrides,
  }
}

const vino = { id: 'vino-uuid', codigo_vino: 'ELE-CAB-2019-0001' } as WineRecord

describe('matchesPendienteSearch', () => {
  it('encuentra por quien lo recomendo, sin acentos', () => {
    expect(matchesPendienteSearch(pendiente({ origen: 'Martín' }), 'martin')).toBe(true)
  })

  it('no rompe con los campos que faltan', () => {
    expect(matchesPendienteSearch(pendiente({ bodega: null, origen: null }), 'malbec')).toBe(
      false,
    )
  })
})

describe('separarPendientes', () => {
  it('separa lo comprado y lo cruza con la cava', () => {
    const { pendientes, comprados } = separarPendientes(
      [
        pendiente({ id: 'viejo', fecha_alta: '2026-09-01T10:00:00' }),
        pendiente({ id: 'nuevo', fecha_alta: '2026-10-20T10:00:00' }),
        pendiente({ id: 'comprado', vino_id: 'vino-uuid' }),
        pendiente({ id: 'borrado', vino_id: 'ya-no-esta' }),
      ],
      [vino],
    )

    expect(pendientes.map((p) => p.id)).toEqual(['nuevo', 'viejo'])
    expect(comprados.map((c) => [c.pendiente.id, c.vino?.codigo_vino ?? null])).toEqual([
      ['comprado', 'ELE-CAB-2019-0001'],
      ['borrado', null],
    ])
  })
})

describe('detallePendiente', () => {
  it('arma la linea con lo que haya', () => {
    expect(detallePendiente(pendiente({ varietal: 'Cabernet Franc', anada: 2019 }))).toBe(
      'Cabernet Franc · 2019',
    )
    expect(detallePendiente(pendiente())).toBe('')
  })
})

describe('yaEnLaCava', () => {
  const cava = [
    { ...vino, id: 'a', bodega: 'Luca', nombre_vino: 'Beso de Dante', cantidad: 0 },
    { ...vino, id: 'b', bodega: 'Luca', nombre_vino: 'Beso de Dante', cantidad: 2 },
    { ...vino, id: 'c', bodega: 'Catena Zapata', nombre_vino: 'Angélica Zapata', cantidad: 1 },
  ] as WineRecord[]

  it('reconoce el nombre con la bodega adelante y prefiere el que tiene stock', () => {
    expect(yaEnLaCava(cava, { nombre_vino: 'luca beso de dante', bodega: '' })?.id).toBe('b')
  })

  it('acepta un nombre mas largo que el de la cava, sin acentos', () => {
    expect(yaEnLaCava(cava, { nombre_vino: 'Angelica Zapata Malbec', bodega: '' })?.id).toBe(
      'c',
    )
  })

  it('una sola palabra no alcanza para decir que es el mismo', () => {
    expect(yaEnLaCava(cava, { nombre_vino: 'Zapata', bodega: '' })).toBeNull()
  })

  it('si dice la bodega, tiene que coincidir', () => {
    expect(yaEnLaCava(cava, { nombre_vino: 'Beso de Dante', bodega: 'Otra' })).toBeNull()
  })
})
