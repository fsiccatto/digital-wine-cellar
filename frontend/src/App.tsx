import { useCallback, useEffect, useState } from 'react'
import { listWines } from './lib/api'
import type { WineRecord } from './lib/types'
import { CellarScreen } from './screens/CellarScreen'
import { ScanScreen } from './screens/ScanScreen'
import { WineScreen } from './screens/WineScreen'
import { CameraIcon, CellarIcon, GlassIcon } from './components/icons'

type View =
  | { name: 'cellar' }
  | { name: 'scan' }
  | { name: 'wine'; codigoVino: string }

export default function App() {
  const [view, setView] = useState<View>({ name: 'cellar' })
  const [wines, setWines] = useState<WineRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listWines()
      .then(setWines)
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error ? cause.message : 'No se pudo cargar el inventario.',
        )
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  return (
    <div className="mx-auto flex min-h-dvh max-w-[430px] flex-col bg-madera-900">
      {view.name === 'cellar' && (
        <CellarScreen
          wines={wines}
          loading={loading}
          error={error}
          onRetry={load}
          onSelect={(codigoVino) => setView({ name: 'wine', codigoVino })}
        />
      )}

      {view.name === 'scan' && (
        <ScanScreen
          onCancel={() => setView({ name: 'cellar' })}
          onSaved={(codigoVino) => {
            load()
            setView({ name: 'wine', codigoVino })
          }}
        />
      )}

      {view.name === 'wine' && (
        <WineScreen
          codigoVino={view.codigoVino}
          onBack={() => setView({ name: 'cellar' })}
          onConsumed={load}
        />
      )}

      {/* La barra estorba en el escaneo, que tiene su propia acción abajo. */}
      {view.name !== 'scan' && (
        <nav className="fixed inset-x-0 bottom-0 mx-auto flex max-w-[430px] items-center justify-between border-t border-borde bg-madera-900/95 px-[30px] pt-[13px] pb-[26px] backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setView({ name: 'cellar' })}
            className="flex flex-col items-center gap-[5px]"
          >
            <CellarIcon className={view.name === 'cellar' ? 'text-oro' : 'text-tenue-600'} />
            <span
              className={`text-[8.5px] tracking-[0.1em] uppercase ${
                view.name === 'cellar' ? 'font-bold text-oro' : 'font-semibold text-tenue-600'
              }`}
            >
              Cava
            </span>
          </button>

          <button
            type="button"
            onClick={() => setView({ name: 'scan' })}
            aria-label="Escanear etiqueta"
            className="-mt-[20px] flex h-[52px] w-[52px] items-center justify-center rounded-full bg-borra-600 text-madera-700 shadow-[0_5px_16px_rgba(124,35,56,0.32)] transition-transform duration-150 active:scale-95"
          >
            <CameraIcon size={21} />
          </button>

          <button
            type="button"
            className="flex flex-col items-center gap-[5px]"
            aria-label="Catas"
          >
            <GlassIcon className="text-tenue-600" />
            <span className="text-[8.5px] font-semibold tracking-[0.1em] text-tenue-600 uppercase">
              Catas
            </span>
          </button>
        </nav>
      )}
    </div>
  )
}
