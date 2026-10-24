import { useMemo, useState } from 'react'
import { deletePendiente } from '../lib/api'
import type { PendienteRecord, WineRecord } from '../lib/types'
import type { Comprado } from '../lib/pendientes'
import { detallePendiente, matchesPendienteSearch, separarPendientes } from '../lib/pendientes'
import { formatDate, glassTint } from '../lib/wine'
import { formatPuntuacion, rellenoDe } from '../lib/puntuacion'
import { Sheet } from '../components/Sheet'
import { ListaSkeleton } from '../components/Skeleton'
import { IndicadorRecarga } from '../components/Recarga'
import { usePullToRefresh } from '../lib/usePullToRefresh'
import {
  BookmarkIcon,
  BottleIcon,
  CheckIcon,
  CloseIcon,
  PairingIcon,
  PlusIcon,
  RatingGlassIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
  VineSprigIcon,
} from '../components/icons'

interface Props {
  pendientes: PendienteRecord[]
  /** Para mostrar en que vino de la cava termino cada comprado. */
  wines: WineRecord[]
  loading: boolean
  error: string | null
  /** Lo que quedo a medias al guardar, como la foto que no subio. */
  aviso?: string
  onRetry: () => void
  onNuevo: () => void
  onEditar: (pendiente: PendienteRecord) => void
  onComprar: (pendiente: PendienteRecord) => void
  onVerVino: (codigoVino: string) => void
  onBorrado: () => void
}

/**
 * Lo que todavia no esta en la cava: lo que se probo afuera y lo que alguien
 * recomendo. Es la lista que se abre parado en la vinoteca.
 */
export function PendientesScreen({
  pendientes: todos,
  wines,
  loading,
  error,
  aviso,
  onRetry,
  onNuevo,
  onEditar,
  onComprar,
  onVerVino,
  onBorrado,
}: Props) {
  const [search, setSearch] = useState('')
  const [abierto, setAbierto] = useState<PendienteRecord | null>(null)

  const { pendientes, comprados } = useMemo(
    () => separarPendientes(todos, wines),
    [todos, wines],
  )
  const visibles = useMemo(
    () => pendientes.filter((pendiente) => matchesPendienteSearch(pendiente, search)),
    [pendientes, search],
  )

  const cargandoVacio = loading && todos.length === 0
  const { tiron, alcanzo } = usePullToRefresh(onRetry, !loading && abierto === null)

  return (
    <div className="vetas relative flex min-h-full flex-col">
      <IndicadorRecarga tiron={tiron} alcanzo={alcanzo} refrescando={loading && !cargandoVacio} />

      <header className="relative px-5 pt-8 pb-3">
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-end gap-[7px]">
            <div className="flex flex-col gap-[2px]">
              <span className="text-[10px] font-bold tracking-[0.24em] text-tenue-500 uppercase">
                Mi Cava
              </span>
              <h1 className="font-serif text-[24px] leading-none font-semibold text-crema">
                Pendientes
              </h1>
            </div>
            <span className="mb-[1px] shrink-0">
              <VineSprigIcon />
            </span>
          </div>
          <button
            type="button"
            onClick={onNuevo}
            className="flex h-[34px] shrink-0 items-center gap-[6px] rounded-full border border-borde-claro px-[13px] text-[12px] font-semibold text-oro"
          >
            <PlusIcon size={11} />
            Agregar
          </button>
        </div>
      </header>

      {(pendientes.length > 6 || search !== '') && (
        <div className="relative px-5 pb-[10px]">
          <label className="flex h-[38px] items-center gap-2 rounded-lg border border-borde bg-madera-700 px-[11px]">
            <SearchIcon size={12} className="shrink-0 text-tenue-600" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por vino, bodega o quién lo recomendó"
              className="w-full bg-transparent text-base placeholder:text-[13px] placeholder:text-tenue-600 focus:outline-none"
            />
            {search !== '' && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Borrar la búsqueda"
                className="-my-[10px] shrink-0 py-[10px] text-tenue-500"
              >
                <CloseIcon size={11} />
              </button>
            )}
          </label>
        </div>
      )}

      <div className="relative flex grow flex-col gap-4 px-5 pt-2 pb-barra">
        {aviso && (
          <p
            role="alert"
            className="rounded-[9px] border border-oro/30 bg-oro/5 p-3 text-[12px] leading-relaxed text-oro"
          >
            {aviso}
          </p>
        )}

        {cargandoVacio && <ListaSkeleton />}

        {error && !cargandoVacio && (
          <div
            role="alert"
            className="flex flex-col items-start gap-3 rounded-[11px] border border-borra-600/40 bg-borra-800/20 p-4"
          >
            <p className="text-[13px] leading-relaxed text-crema-300">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg border border-borde-claro px-3 py-[7px] text-[12px] font-semibold text-oro"
            >
              Reintentar
            </button>
          </div>
        )}

        {!cargandoVacio && !error && visibles.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16">
            <BookmarkIcon size={38} className="text-borde-claro" />
            <p className="max-w-[250px] text-center text-[13px] leading-relaxed text-tenue-500">
              {pendientes.length === 0
                ? 'El vino que probaste en una cena o el que te recomendaron: anotalo acá para conseguirlo después.'
                : 'Ningún pendiente coincide con lo que estás buscando.'}
            </p>
          </div>
        )}

        {visibles.length > 0 && (
          <ul className="flex flex-col gap-[5px]">
            {visibles.map((pendiente) => (
              <li key={pendiente.id}>
                <PendienteRow pendiente={pendiente} onOpen={() => setAbierto(pendiente)} />
              </li>
            ))}
          </ul>
        )}

        {comprados.length > 0 && search === '' && (
          <section className="flex flex-col pt-2">
            <div className="flex items-center gap-2 pb-[7px]">
              <span className="text-[10px] font-bold tracking-[0.2em] text-tenue-500 uppercase">
                Ya en tu cava
              </span>
              <div className="h-px grow bg-borde" />
              <span className="cifra text-[10px] font-medium text-tenue-600">
                {comprados.length}
              </span>
            </div>
            <ul className="flex flex-col gap-[5px]">
              {comprados.map((comprado) => (
                <li key={comprado.pendiente.id}>
                  <CompradoRow comprado={comprado} onVerVino={onVerVino} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {abierto && (
        <PendienteSheet
          pendiente={abierto}
          onClose={() => setAbierto(null)}
          onComprar={() => onComprar(abierto)}
          onEditar={() => onEditar(abierto)}
          onBorrado={() => {
            setAbierto(null)
            onBorrado()
          }}
        />
      )}
    </div>
  )
}

/** Sin bucket, foto_url guarda el nombre del objeto: solo una URL se muestra. */
function fotoDe(pendiente: PendienteRecord): string | null {
  return pendiente.foto_url?.startsWith('http') ? pendiente.foto_url : null
}

function PendienteRow({
  pendiente,
  onOpen,
}: {
  pendiente: PendienteRecord
  onOpen: () => void
}) {
  const tint = glassTint(pendiente.varietal ?? '')
  const detalle = detallePendiente(pendiente)
  const foto = fotoDe(pendiente)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="tarjeta flex w-full items-center gap-[10px] rounded-[7px] border border-borde bg-madera-700 px-[11px] py-2 text-left"
      style={{ borderLeft: `2px solid ${tint.edge}` }}
    >
      {/* La foto es lo que se reconoce en el estante de la vinoteca. */}
      <div className="flex w-[26px] shrink-0 items-center justify-center">
        {foto ? (
          <img
            src={foto}
            alt=""
            width={26}
            height={36}
            className="h-[36px] w-[26px] rounded-[3px] border border-borde object-cover"
          />
        ) : (
          <BottleIcon glass={tint.glass} edge={tint.edge} width={12} height={30} />
        )}
      </div>

      <div className="flex min-w-0 grow flex-col gap-px">
        {pendiente.bodega && (
          <span className="truncate text-[10px] font-bold tracking-[0.12em] text-tenue-500 uppercase">
            {pendiente.bodega}
          </span>
        )}
        <span className="truncate font-serif text-[15px] leading-[1.15] font-semibold text-crema">
          {pendiente.nombre_vino}
        </span>
        {(detalle || pendiente.origen) && (
          <div className="flex items-center gap-[6px]">
            {detalle && (
              <span className="cifra shrink-0 text-[10.5px] text-tenue-400">{detalle}</span>
            )}
            {detalle && pendiente.origen && (
              <div className="h-[2.5px] w-[2.5px] shrink-0 rounded-full bg-borde-claro" />
            )}
            {pendiente.origen && (
              <span className="truncate text-[10.5px] text-oro-oscuro">{pendiente.origen}</span>
            )}
          </div>
        )}
      </div>

      {pendiente.puntuacion !== null && (
        <span className="cifra flex shrink-0 items-center gap-[4px] font-serif text-[16px] leading-none font-semibold text-oro">
          <RatingGlassIcon size={13} filled />
          {formatPuntuacion(pendiente.puntuacion)}
        </span>
      )}
    </button>
  )
}

function CompradoRow({
  comprado: { pendiente, vino },
  onVerVino,
}: {
  comprado: Comprado
  onVerVino: (codigoVino: string) => void
}) {
  const contenido = (
    <>
      <CheckIcon size={12} className="shrink-0 text-vina" />
      <span className="min-w-0 grow truncate text-[12.5px] text-tenue-400">
        {vino?.nombre_vino ?? pendiente.nombre_vino}
      </span>
      {pendiente.origen && (
        <span className="max-w-[45%] shrink-0 truncate text-[10.5px] text-tenue-600">
          {pendiente.origen}
        </span>
      )}
    </>
  )
  const clases = 'flex w-full items-center gap-[9px] rounded-[7px] px-[11px] py-[7px] text-left'

  // Si el vino se borro de la cava ya no hay ficha a la que ir.
  return vino ? (
    <button
      type="button"
      onClick={() => onVerVino(vino.codigo_vino)}
      className={`${clases} border border-borde/70 bg-madera-950/45`}
    >
      {contenido}
    </button>
  ) : (
    <div className={`${clases} opacity-65`}>{contenido}</div>
  )
}

function PendienteSheet({
  pendiente,
  onClose,
  onComprar,
  onEditar,
  onBorrado,
}: {
  pendiente: PendienteRecord
  onClose: () => void
  onComprar: () => void
  onEditar: () => void
  onBorrado: () => void
}) {
  const [borrando, setBorrando] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const foto = fotoDe(pendiente)
  const detalle = detallePendiente(pendiente)
  const probado = pendiente.puntuacion !== null
  const fecha = pendiente.fecha_probado ? formatDate(pendiente.fecha_probado) : null

  async function borrar() {
    setSaving(true)
    setError(null)
    try {
      await deletePendiente(pendiente.id)
      onBorrado()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo borrar.')
      setSaving(false)
      setBorrando(false)
    }
  }

  return (
    <Sheet onClose={onClose}>
      {foto && (
        <img
          src={foto}
          alt={`Etiqueta de ${pendiente.nombre_vino}`}
          className="mb-4 h-[180px] w-full rounded-xl border border-borde object-cover"
        />
      )}

      <div className="mb-4 flex flex-col gap-1">
        {pendiente.bodega && (
          <span className="text-[10.5px] font-bold tracking-[0.2em] text-oro-oscuro uppercase">
            {pendiente.bodega}
          </span>
        )}
        <h2 className="font-serif text-[23px] leading-tight font-semibold text-crema">
          {pendiente.nombre_vino}
        </h2>
        {detalle && <span className="cifra text-[12px] text-tenue-400">{detalle}</span>}
        {pendiente.origen && (
          <span className="pt-[2px] text-[12px] font-semibold text-oro-oscuro">
            {pendiente.origen}
          </span>
        )}
      </div>

      {probado && (
        <div className="mb-4 flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((copa) => {
            const relleno = rellenoDe(copa, pendiente.puntuacion!)
            return (
              <RatingGlassIcon
                key={copa}
                size={22}
                filled={relleno === 'llena'}
                half={relleno === 'media'}
                className={relleno === 'vacia' ? 'text-borde-claro' : 'text-oro'}
              />
            )
          })}
          <span className="cifra font-serif text-[16px] font-semibold text-oro">
            {formatPuntuacion(pendiente.puntuacion!)}
          </span>
          {fecha && <span className="cifra ml-auto text-[11px] text-tenue-500">{fecha}</span>}
        </div>
      )}

      {pendiente.notas && (
        <p className="mb-3 text-[14px] leading-relaxed whitespace-pre-wrap text-crema-300">
          {pendiente.notas}
        </p>
      )}

      {pendiente.maridaje && (
        <p className="mb-4 flex items-center gap-2 text-[12.5px] text-tenue-400">
          <PairingIcon className="shrink-0 text-vina" />
          {pendiente.maridaje}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-[9px] border border-borra-600/40 bg-borra-800/20 p-3 text-[12px] text-crema-300"
        >
          {error}
        </p>
      )}

      {borrando ? (
        <div className="mt-2 flex flex-col gap-3">
          <p className="text-[13px] leading-relaxed text-crema-300">
            Se borra de tus pendientes y no se puede deshacer.
          </p>
          <div className="flex gap-[10px]">
            <button
              type="button"
              onClick={borrar}
              disabled={saving}
              className="flex h-13 shrink-0 items-center justify-center gap-2 rounded-xl border border-borra-600 px-5 text-[14px] font-semibold text-borra-600 disabled:opacity-60"
            >
              {saving ? <SpinnerIcon className="animate-spin" /> : <TrashIcon size={15} />}
              Borrar
            </button>
            <button
              type="button"
              onClick={() => setBorrando(false)}
              disabled={saving}
              className="h-13 grow rounded-xl border border-borde-claro text-[14px] font-semibold text-tenue-400"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          <div className="flex gap-[10px]">
            <button
              type="button"
              onClick={onEditar}
              className="h-13 shrink-0 rounded-xl border border-borde-claro px-5 text-[14px] font-semibold text-tenue-400"
            >
              Editar
            </button>
            {/* Lleva a la carga de siempre con los datos puestos: ahi se
                completa lo que falta y se avisa si ya estaba en la cava. */}
            <button
              type="button"
              onClick={onComprar}
              className="flex h-13 grow items-center justify-center gap-[10px] rounded-xl bg-borra-600 font-bold text-madera-700 shadow-[0_5px_16px_rgba(124,35,56,0.26)] transition-transform duration-150 active:scale-[0.985]"
            >
              <CheckIcon size={17} />
              <span className="text-[14px]">Lo compré</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setBorrando(true)}
            className="self-center text-[12px] font-semibold text-tenue-500 underline underline-offset-4"
          >
            Ya no lo quiero
          </button>
        </div>
      )}
    </Sheet>
  )
}
