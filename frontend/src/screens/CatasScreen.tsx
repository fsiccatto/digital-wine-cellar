import { useMemo, useState } from 'react'
import type { CataRecord } from '../lib/types'
import { formatDate, groupByMonth, matchesCataSearch } from '../lib/wine'
import { formatPuntuacion, rellenoDe } from '../lib/puntuacion'
import { CataRow } from '../components/CataRow'
import { Sheet } from '../components/Sheet'
import {
  CloseIcon,
  GlassIcon,
  RatingGlassIcon,
  SearchIcon,
  VineSprigIcon,
} from '../components/icons'
import { ListaSkeleton } from '../components/Skeleton'
import { IndicadorRecarga } from '../components/Recarga'
import { usePullToRefresh } from '../lib/usePullToRefresh'

interface Props {
  catas: CataRecord[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onSelect: (codigoVino: string) => void
}

/**
 * El historico de catas. Se agrupa por mes y no por vino: es una bitacora, y la
 * pregunta natural es "que tomamos ultimamente". De paso reusa el rotulo con
 * linea y contador del estante, asi que se lee como hermana de la cava.
 */
export function CatasScreen({ catas, loading, error, onRetry, onSelect }: Props) {
  const [notes, setNotes] = useState<CataRecord | null>(null)
  const [search, setSearch] = useState('')

  const visibles = useMemo(
    () => catas.filter((cata) => matchesCataSearch(cata, search)),
    [catas, search],
  )
  const months = useMemo(() => groupByMonth(visibles), [visibles])

  const cargandoVacio = loading && catas.length === 0
  const { tiron, alcanzo } = usePullToRefresh(onRetry, !loading)

  return (
    <div className="vetas relative flex min-h-full flex-col">
      <IndicadorRecarga tiron={tiron} alcanzo={alcanzo} refrescando={loading} />

      <header className="relative px-5 pt-8 pb-3">
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-end gap-[7px]">
            <div className="flex flex-col gap-[2px]">
              <span className="text-[8.5px] font-bold tracking-[0.24em] text-tenue-500 uppercase">
                Mi Cava
              </span>
              <h1 className="font-serif text-[24px] leading-none font-semibold text-crema">
                Las Catas
              </h1>
            </div>
            <span className="mb-[1px] shrink-0">
              <VineSprigIcon />
            </span>
          </div>
          {/* Igual que en la cava: "0 catas" mientras carga miente. */}
          {!cargandoVacio && (
            <div className="flex shrink-0 items-baseline gap-[4px]">
              <span className="cifra font-serif text-[19px] leading-none font-semibold text-oro">
                {visibles.length}
              </span>
              <span className="text-[8.5px] font-semibold tracking-[0.14em] text-tenue-500 uppercase">
                {visibles.length === 1 ? 'cata' : 'catas'}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* El historico crece sin techo: sin buscador, encontrar "aquel que
          tomamos con cordero" es scrollear meses. Aparece recien cuando hay
          suficientes como para que haga falta. */}
      {(catas.length > 6 || search !== '') && (
        <div className="relative px-5 pb-[10px]">
          <label className="flex h-[34px] items-center gap-2 rounded-lg border border-borde bg-madera-700 px-[11px]">
            <SearchIcon size={12} className="shrink-0 text-tenue-600" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por vino, maridaje o notas"
              className="w-full bg-transparent text-[11.5px] placeholder:text-tenue-600 focus:outline-none"
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

      <div className="relative flex grow flex-col gap-4 px-5 pt-2 pb-27">
        {cargandoVacio && <ListaSkeleton aviso="Abriendo el libro…" />}

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
            <GlassIcon size={38} className="text-borde-claro" />
            <p className="max-w-[240px] text-center text-[13px] leading-relaxed text-tenue-500">
              {catas.length === 0
                ? 'Todavía no descorchaste ninguna botella. Cuando lo hagas, la cata queda registrada acá.'
                : 'Ninguna cata coincide con lo que estás buscando.'}
            </p>
            {catas.length > 0 && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="rounded-lg border border-borde-claro px-3 py-[7px] text-[12px] font-semibold text-oro"
              >
                Limpiar la búsqueda
              </button>
            )}
          </div>
        )}

        {months.map((month, index) => (
          <section
            key={month.key}
            className="brota flex flex-col"
            style={{ animationDelay: `${Math.min(index, 6) * 70}ms` }}
          >
            <div className="flex items-center gap-2 pb-[7px]">
              <span className="text-[8px] font-bold tracking-[0.2em] text-tenue-500 uppercase">
                {month.label}
              </span>
              <div className="h-px grow bg-borde" />
              <span className="text-[8px] font-medium text-tenue-600">
                {month.catas.length} {month.catas.length === 1 ? 'cata' : 'catas'}
              </span>
            </div>

            <ul className="flex flex-col gap-[5px]">
              {month.catas.map((cata) => (
                <li key={cata.id_cata}>
                  <CataRow cata={cata} onSelect={onSelect} onNotes={setNotes} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {notes && (
        <NotesSheet cata={notes} onClose={() => setNotes(null)} onSelect={onSelect} />
      )}
    </div>
  )
}

/** Las notas no entran en la fila; se leen acá, sin editar. */
function NotesSheet({
  cata,
  onClose,
  onSelect,
}: {
  cata: CataRecord
  onClose: () => void
  onSelect: (codigoVino: string) => void
}) {
  const date = formatDate(cata.fecha_consumo)

  return (
    <Sheet onClose={onClose}>
      <div className="mb-5 flex flex-col gap-1">
        <span className="text-[9.5px] font-bold tracking-[0.2em] text-tenue-500 uppercase">
          Notas de cata
        </span>
        <h2 className="font-serif text-[23px] leading-tight font-semibold text-crema">
          {cata.vino_existe ? cata.nombre_vino : cata.vino_id}
        </h2>
        {date && <span className="cifra text-[11px] text-tenue-500">{date}</span>}
      </div>

      {cata.puntuacion !== null && (
        <div className="mb-5 flex gap-2">
          {[1, 2, 3, 4, 5].map((copa) => {
            const relleno = rellenoDe(copa, cata.puntuacion!)
            return (
              <RatingGlassIcon
                key={copa}
                size={26}
                filled={relleno === 'llena'}
                half={relleno === 'media'}
                className={relleno === 'vacia' ? 'text-borde-claro' : 'text-oro'}
              />
            )
          })}
          <span className="cifra self-center font-serif text-[17px] font-semibold text-oro">
            {formatPuntuacion(cata.puntuacion!)}
          </span>
        </div>
      )}

      <p className="mb-5 text-[14px] leading-relaxed whitespace-pre-wrap text-crema-300">
        {cata.notas_cata}
      </p>

      <div className="flex gap-[10px]">
        <button
          type="button"
          onClick={onClose}
          className="h-13 grow rounded-xl border border-borde-claro text-[14px] font-semibold text-tenue-400"
        >
          Cerrar
        </button>
        {/* La correccion vive en la ficha del vino, junto al resto de sus catas;
            duplicar el formulario aca serian dos lugares que mantener. */}
        {cata.vino_existe && (
          <button
            type="button"
            onClick={() => onSelect(cata.vino_id)}
            className="h-13 shrink-0 rounded-xl border border-borde-claro px-5 text-[14px] font-semibold text-oro"
          >
            Ver el vino
          </button>
        )}
      </div>
    </Sheet>
  )
}
