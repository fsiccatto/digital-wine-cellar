import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getToken, listCatas, listWines } from './lib/api'
import type { CataRecord, WineRecord } from './lib/types'
import { CatasScreen } from './screens/CatasScreen'
import { CellarScreen } from './screens/CellarScreen'
import { ScanScreen } from './screens/ScanScreen'
import { UnlockScreen } from './screens/UnlockScreen'
import { WineScreen } from './screens/WineScreen'
import { CameraIcon, CellarIcon, GlassIcon } from './components/icons'

// Editar, borrar y ajustar stock no entran acá: son estado local de
// WineScreen, igual que la hoja de cata.
type View =
  | { name: 'cellar' }
  | { name: 'catas' }
  | { name: 'scan' }
  | { name: 'wine'; codigoVino: string }

export default function App() {
  const [view, setView] = useState<View>({ name: 'cellar' })
  const [wines, setWines] = useState<WineRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // El histórico crece sin techo y la app abre en Cava, así que no se carga en
  // el arranque: `null` significa "todavía no se pidió".
  const [catas, setCatas] = useState<CataRecord[] | null>(null)
  const [catasLoading, setCatasLoading] = useState(false)
  const [catasError, setCatasError] = useState<string | null>(null)
  // Se asume desbloqueada si ya hay clave guardada; un 401 la vuelve a pedir.
  const [unlocked, setUnlocked] = useState(() => getToken() !== '')

  /**
   * El gesto de "atras" del telefono. Sin esto, instalada como PWA la app se
   * CIERRA al hacer atras desde cualquier pantalla, porque la navegacion vive
   * en un useState y el navegador no tiene nada que desandar.
   *
   * Cada pantalla que no es la cava empuja una entrada al historial; el atras
   * la consume y vuelve a la cava. Desde la cava, sale de la app, que es lo
   * que corresponde.
   */
  const enHistorial = useRef(false)

  useEffect(() => {
    const enCava = view.name === 'cellar'

    if (!enCava && !enHistorial.current) {
      window.history.pushState({ cava: true }, '')
      enHistorial.current = true
    }

    const alVolver = () => {
      enHistorial.current = false
      setView({ name: 'cellar' })
    }

    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [view])

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    listWines()
      .then(setWines)
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.status === 401) {
          setUnlocked(false)
          return
        }
        setError(
          cause instanceof Error ? cause.message : 'No se pudo cargar el inventario.',
        )
      })
      .finally(() => setLoading(false))
  }, [])

  const loadCatas = useCallback(() => {
    setCatasLoading(true)
    setCatasError(null)
    listCatas()
      .then(setCatas)
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.status === 401) {
          setUnlocked(false)
          return
        }
        setCatasError(
          cause instanceof Error ? cause.message : 'No se pudo cargar el histórico.',
        )
      })
      .finally(() => setCatasLoading(false))
  }, [])

  /** Al mutar un vino el histórico queda viejo: borrarlo deja catas huérfanas. */
  const invalidateCatas = useCallback(() => {
    setCatas(null)
  }, [])

  useEffect(() => {
    if (unlocked) load()
  }, [unlocked, load])

  useEffect(() => {
    if (unlocked && view.name === 'catas' && catas === null && !catasLoading) {
      loadCatas()
    }
  }, [unlocked, view, catas, catasLoading, loadCatas])

  /** Volver a la cava desde la UI, dejando el historial como lo encontro. */
  function volverACava() {
    if (enHistorial.current) {
      enHistorial.current = false
      // Consume la entrada propia en vez de dejarla colgada.
      window.history.back()
      return
    }
    setView({ name: 'cellar' })
  }

  if (!unlocked) {
    return (
      <UnlockScreen
        onUnlocked={() => {
          setUnlocked(true)
          setView({ name: 'cellar' })
        }}
      />
    )
  }

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

      {view.name === 'catas' && (
        <CatasScreen
          catas={catas ?? []}
          loading={catasLoading}
          error={catasError}
          onRetry={loadCatas}
          onSelect={(codigoVino) => setView({ name: 'wine', codigoVino })}
        />
      )}

      {view.name === 'scan' && (
        <ScanScreen
          onCancel={volverACava}
          onSaved={(codigoVino) => {
            load()
            setView({ name: 'wine', codigoVino })
          }}
        />
      )}

      {view.name === 'wine' && (
        <WineScreen
          codigoVino={view.codigoVino}
          onBack={volverACava}
          onConsumed={() => {
            load()
            invalidateCatas()
          }}
          onChanged={() => {
            load()
            invalidateCatas()
          }}
          onDeleted={() => {
            load()
            invalidateCatas()
          }}
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
            onClick={() => setView({ name: 'catas' })}
            className="flex flex-col items-center gap-[5px]"
            aria-label="Catas"
          >
            <GlassIcon className={view.name === 'catas' ? 'text-oro' : 'text-tenue-600'} />
            <span
              className={`text-[8.5px] tracking-[0.1em] uppercase ${
                view.name === 'catas' ? 'font-bold text-oro' : 'font-semibold text-tenue-600'
              }`}
            >
              Catas
            </span>
          </button>
        </nav>
      )}
    </div>
  )
}
