import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, getToken, listCatas, listPendientes, listWines } from './lib/api'
import type { CataRecord, PendienteRecord, WineRecord } from './lib/types'
import { CatasScreen } from './screens/CatasScreen'
import { CellarScreen } from './screens/CellarScreen'
import { PendienteScreen } from './screens/PendienteScreen'
import { PendientesScreen } from './screens/PendientesScreen'
import { ScanScreen } from './screens/ScanScreen'
import { UnlockScreen } from './screens/UnlockScreen'
import { WineScreen } from './screens/WineScreen'
import { BookmarkIcon, CameraIcon, CellarIcon, GlassIcon } from './components/icons'

// Editar, borrar y ajustar stock no entran acá: son estado local de
// WineScreen, igual que la hoja de cata.
type View =
  | { name: 'cellar' }
  | { name: 'catas' }
  | { name: 'pendientes'; aviso?: string }
  | { name: 'pendiente'; pendiente?: PendienteRecord }
  | { name: 'scan'; pendiente?: PendienteRecord }
  | { name: 'wine'; codigoVino: string; desde?: 'catas' | 'pendientes'; aviso?: string }

/** A donde lleva "atras": lo que se abrio desde una pestaña vuelve a ella. */
function anterior(view: View): View {
  if (view.name === 'wine' && view.desde) return { name: view.desde }
  if (view.name === 'pendiente' || (view.name === 'scan' && view.pendiente)) {
    return { name: 'pendientes' }
  }
  return { name: 'cellar' }
}

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
  // Igual que el historico: solo se pide al abrir la pestaña.
  const [pendientes, setPendientes] = useState<PendienteRecord[] | null>(null)
  const [pendientesLoading, setPendientesLoading] = useState(false)
  const [pendientesError, setPendientesError] = useState<string | null>(null)
  // Se asume desbloqueada si ya hay clave guardada; un 401 la vuelve a pedir.
  const [unlocked, setUnlocked] = useState(() => getToken() !== '')
  // Desbloquear ya trae la lista para validar la clave: no se pide dos veces.
  const listaDelDesbloqueo = useRef<WineRecord[] | null>(null)
  // Solo cuenta la respuesta del ultimo pedido: una lenta no pisa a una nueva.
  const ultimoPedido = useRef(0)

  /**
   * El gesto de "atras" del telefono. Sin esto, instalada como PWA la app se
   * CIERRA al hacer atras desde cualquier pantalla, porque la navegacion vive
   * en un useState y el navegador no tiene nada que desandar.
   *
   * Cada pantalla que no es la cava empuja una entrada al historial; el atras
   * la consume y vuelve a la cava (o a Catas, si el vino se abrio desde ahi).
   * Desde la cava, sale de la app, que es lo que corresponde.
   */
  const enHistorial = useRef(false)

  useEffect(() => {
    const enCava = view.name === 'cellar'

    if (!enCava && !enHistorial.current) {
      window.history.pushState({ cava: true }, '')
      enHistorial.current = true
    }

    const alVolver = () => {
      // Cerrar una hoja con el boton consume su propia entrada con
      // `history.back()`, y eso dispara popstate igual que el gesto del
      // telefono. Sin mirar donde caimos, cerrar cualquier hoja de la ficha
      // devolvia a la cava. Solo es "volver" cuando lo que quedo abajo ya no
      // es ninguna entrada nuestra: la de la pantalla (`cava`) ni la de una
      // capa (`capa`).
      const estado = window.history.state
      if (estado?.cava || estado?.capa) return

      enHistorial.current = false
      setView(anterior(view))
    }

    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [view])

  const load = useCallback(() => {
    const pedido = ++ultimoPedido.current
    const vigente = () => pedido === ultimoPedido.current
    setLoading(true)
    setError(null)
    listWines()
      .then((lista) => {
        if (vigente()) setWines(lista)
      })
      .catch((cause: unknown) => {
        if (!vigente()) return
        if (cause instanceof ApiError && cause.status === 401) {
          setUnlocked(false)
          return
        }
        setError(
          cause instanceof Error ? cause.message : 'No se pudo cargar el inventario.',
        )
      })
      .finally(() => {
        if (vigente()) setLoading(false)
      })
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

  const loadPendientes = useCallback(() => {
    setPendientesLoading(true)
    setPendientesError(null)
    listPendientes()
      .then(setPendientes)
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.status === 401) {
          setUnlocked(false)
          return
        }
        setPendientesError(
          cause instanceof Error ? cause.message : 'No se pudieron cargar los pendientes.',
        )
      })
      .finally(() => setPendientesLoading(false))
  }, [])

  /** Al mutar un vino el histórico queda viejo: borrarlo deja catas huérfanas. */
  const invalidateCatas = useCallback(() => {
    setCatas(null)
    setCatasError(null)
  }, [])

  useEffect(() => {
    if (!unlocked) return
    if (listaDelDesbloqueo.current) {
      setWines(listaDelDesbloqueo.current)
      setLoading(false)
      listaDelDesbloqueo.current = null
      return
    }
    load()
  }, [unlocked, load])

  useEffect(() => {
    // Sin mirar el error, un fallo dejaba `catas` en null y el efecto volvia a
    // pedir en loop. Despues de un error se reintenta solo a mano.
    if (
      unlocked &&
      view.name === 'catas' &&
      catas === null &&
      !catasLoading &&
      catasError === null
    ) {
      loadCatas()
    }
  }, [unlocked, view, catas, catasLoading, catasError, loadCatas])

  useEffect(() => {
    if (
      unlocked &&
      view.name === 'pendientes' &&
      pendientes === null &&
      !pendientesLoading &&
      pendientesError === null
    ) {
      loadPendientes()
    }
  }, [unlocked, view, pendientes, pendientesLoading, pendientesError, loadPendientes])

  /** Volver desde la UI, dejando el historial como lo encontro. */
  function volver() {
    // Con una hoja abierta su entrada esta arriba de todo: se consume primero,
    // si no el `back` de abajo la cierra a ella y la pantalla no se mueve.
    if (window.history.state?.capa) {
      window.addEventListener('popstate', volver, { once: true })
      window.history.back()
      return
    }
    // A otra pestaña que no es la cava: la entrada del historial queda, porque
    // sigue siendo una pantalla de la que "atras" tiene que sacar.
    const destino = anterior(view)
    if (destino.name !== 'cellar') {
      setView(destino)
      return
    }
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
        onUnlocked={(lista) => {
          listaDelDesbloqueo.current = lista
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
          onSelect={(codigoVino) => setView({ name: 'wine', codigoVino, desde: 'catas' })}
        />
      )}

      {view.name === 'pendientes' && (
        <PendientesScreen
          pendientes={pendientes ?? []}
          wines={wines}
          loading={pendientesLoading}
          error={pendientesError}
          aviso={view.aviso}
          onRetry={loadPendientes}
          onNuevo={() => setView({ name: 'pendiente' })}
          onEditar={(pendiente) => setView({ name: 'pendiente', pendiente })}
          onComprar={(pendiente) => setView({ name: 'scan', pendiente })}
          onVerVino={(codigoVino) => setView({ name: 'wine', codigoVino, desde: 'pendientes' })}
          onBorrado={loadPendientes}
        />
      )}

      {view.name === 'pendiente' && (
        <PendienteScreen
          pendiente={view.pendiente}
          onCancel={volver}
          onSaved={(aviso) => {
            loadPendientes()
            setView({ name: 'pendientes', aviso })
          }}
        />
      )}

      {view.name === 'scan' && (
        <ScanScreen
          // Para avisar si la etiqueta que se acaba de leer ya esta en la cava.
          wines={wines}
          pendiente={view.pendiente}
          onCancel={volver}
          onSaved={(codigoVino, aviso) => {
            load()
            if (view.pendiente) {
              // Sale de pendientes y, si se habia probado, suma una cata.
              loadPendientes()
              invalidateCatas()
            }
            setView({
              name: 'wine',
              codigoVino,
              aviso,
              desde: view.pendiente ? 'pendientes' : undefined,
            })
          }}
        />
      )}

      {view.name === 'wine' && (
        <WineScreen
          codigoVino={view.codigoVino}
          aviso={view.aviso}
          onBack={volver}
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

      {/* La barra estorba en los formularios, que tienen su propia acción abajo. */}
      {view.name !== 'scan' && view.name !== 'pendiente' && (
        // Cuatro columnas iguales. Con la camara al medio de tres pestañas, dos
        // quedaban apretadas de un lado y una sola del otro, y en 320px los
        // rotulos de Cava y Pendientes se pegaban.
        <nav className="fixed inset-x-0 bottom-0 mx-auto grid max-w-[430px] grid-cols-4 items-center border-t border-borde bg-madera-900/95 px-4 pt-[13px] pb-seguro backdrop-blur-sm">
          <Pestaña
            activa={view.name === 'cellar'}
            etiqueta="Cava"
            icono={CellarIcon}
            onClick={() => setView({ name: 'cellar' })}
          />
          <Pestaña
            activa={view.name === 'pendientes'}
            etiqueta="Pendientes"
            icono={BookmarkIcon}
            onClick={() => setView({ name: 'pendientes' })}
          />

          <button
            type="button"
            onClick={() => setView({ name: 'scan' })}
            aria-label="Escanear etiqueta"
            className="-mt-[20px] flex h-[52px] w-[52px] items-center justify-center justify-self-center rounded-full bg-borra-600 text-madera-700 shadow-[0_5px_16px_rgba(124,35,56,0.32)] transition-transform duration-150 active:scale-95"
          >
            <CameraIcon size={21} />
          </button>

          <Pestaña
            activa={view.name === 'catas'}
            etiqueta="Catas"
            icono={GlassIcon}
            onClick={() => setView({ name: 'catas' })}
          />
        </nav>
      )}
    </div>
  )
}

function Pestaña({
  activa,
  etiqueta,
  icono: Icono,
  onClick,
}: {
  activa: boolean
  etiqueta: string
  icono: (props: { className?: string }) => React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // El color solo no alcanza: sin esto un lector de pantalla lee pestañas
      // identicas y ninguna dice cual esta abierta.
      aria-current={activa ? 'page' : undefined}
      className="flex flex-col items-center gap-[5px]"
    >
      <Icono className={activa ? 'text-oro' : 'text-tenue-600'} />
      <span
        className={`text-[10px] tracking-[0.1em] uppercase ${
          activa ? 'font-bold text-oro' : 'font-semibold text-tenue-600'
        }`}
      >
        {etiqueta}
      </span>
    </button>
  )
}
