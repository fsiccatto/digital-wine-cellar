import { useMemo, useState } from 'react'
import type { WineRecord } from '../lib/types'
import {
  formatYear,
  glassTint,
  groupByShelf,
  matchesSearch,
  totalBottles,
  varietals,
} from '../lib/wine'
import {
  BottleIcon,
  FiltersIcon,
  SearchIcon,
  SpinnerIcon,
  VineLeafIcon,
} from '../components/icons'

interface Props {
  wines: WineRecord[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onSelect: (codigoVino: string) => void
}

export function CellarScreen({ wines, loading, error, onRetry, onSelect }: Props) {
  const [search, setSearch] = useState('')
  const [varietal, setVarietal] = useState<string | null>(null)

  const options = useMemo(() => varietals(wines), [wines])

  const visible = useMemo(
    () =>
      wines.filter(
        (wine) =>
          matchesSearch(wine, search) &&
          (varietal === null || wine.varietal === varietal),
      ),
    [wines, search, varietal],
  )

  const shelves = useMemo(() => groupByShelf(visible), [visible])

  return (
    <div className="vetas relative flex min-h-full flex-col">
      <header className="relative px-[22px] pt-13 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-[5px]">
            <div className="flex items-center gap-[9px]">
              <VineLeafIcon className="text-vina" />
              <span className="text-[10px] font-semibold tracking-[0.22em] text-tenue-500 uppercase">
                Mi Cava
              </span>
            </div>
            <h1 className="font-serif text-[33px] leading-[1.05] font-semibold tracking-tight text-crema">
              La Bodega
            </h1>
          </div>
          <div className="flex flex-col items-end gap-[3px] pt-[6px]">
            <span className="cifra font-serif text-[30px] leading-none font-semibold text-oro">
              {totalBottles(visible)}
            </span>
            <span className="text-[9px] font-semibold tracking-[0.16em] text-tenue-600 uppercase">
              botellas
            </span>
          </div>
        </div>
      </header>

      <div className="relative flex gap-[10px] px-[22px] pb-[14px]">
        <label className="flex h-[46px] grow items-center gap-[10px] rounded-[11px] border border-borde bg-madera-950/60 px-[13px]">
          <SearchIcon className="shrink-0 text-tenue-600" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar bodega, varietal…"
            className="w-full bg-transparent text-[13.5px] placeholder:text-tenue-700 focus:outline-none"
          />
        </label>
        <button
          type="button"
          className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[11px] border border-borde bg-madera-950/60 text-oro"
          aria-label="Filtros"
        >
          <FiltersIcon />
        </button>
      </div>

      {options.length > 0 && (
        <div className="relative flex gap-[7px] overflow-x-auto px-[22px] pb-[22px]">
          <Chip active={varietal === null} onClick={() => setVarietal(null)}>
            Todos
          </Chip>
          {options.map((option) => (
            <Chip
              key={option}
              active={varietal === option}
              onClick={() => setVarietal(varietal === option ? null : option)}
            >
              {option}
            </Chip>
          ))}
        </div>
      )}

      <div className="relative flex grow flex-col gap-[26px] px-[22px] pb-27">
        {loading && (
          <div className="flex items-center justify-center gap-[10px] py-16 text-tenue-500">
            <SpinnerIcon className="animate-spin" />
            <span className="text-[13px]">Abriendo la cava…</span>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-start gap-3 rounded-[11px] border border-borra-600/40 bg-borra-800/20 p-4">
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

        {!loading && !error && visible.length === 0 && (
          <p className="py-16 text-center text-[13px] leading-relaxed text-tenue-600">
            {wines.length === 0
              ? 'Todavía no hay botellas. Escaneá una etiqueta para empezar.'
              : 'Ninguna botella coincide con la búsqueda.'}
          </p>
        )}

        {shelves.map((shelf) => (
          <section key={shelf.key} className="flex flex-col">
            <div className="flex items-center gap-[11px] pb-[11px]">
              <span className="text-[9.5px] font-bold tracking-[0.2em] text-tenue-500 uppercase">
                {shelf.label}
              </span>
              <div className="h-px grow bg-gradient-to-r from-borde to-transparent" />
              <span className="text-[9.5px] font-medium text-tenue-700">
                {shelf.bottles} {shelf.bottles === 1 ? 'botella' : 'botellas'}
              </span>
            </div>

            <ul className="flex flex-col gap-[9px]">
              {shelf.wines.map((wine) => (
                <li key={wine.codigo_vino}>
                  <WineRow wine={wine} onSelect={onSelect} />
                </li>
              ))}
            </ul>

            <div
              className="mt-[11px] h-[5px] rounded-sm shadow-[0_3px_11px_rgba(0,0,0,0.55)]"
              style={{
                background:
                  'linear-gradient(180deg, #5c3620 0%, #3a2115 55%, #241410 100%)',
              }}
            />
          </section>
        ))}
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'shrink-0 rounded-full border border-borra-600 bg-borra-700 px-[14px] py-[7px] text-[11.5px] font-semibold text-crema'
          : 'shrink-0 rounded-full border border-borde bg-madera-950/50 px-[14px] py-[7px] text-[11.5px] font-medium text-tenue-400'
      }
    >
      {children}
    </button>
  )
}

function WineRow({
  wine,
  onSelect,
}: {
  wine: WineRecord
  onSelect: (codigoVino: string) => void
}) {
  const tint = glassTint(wine.varietal)
  const year = formatYear(wine.anada)

  return (
    <button
      type="button"
      onClick={() => onSelect(wine.codigo_vino)}
      className="flex w-full items-stretch gap-[13px] rounded-[10px] border border-borde bg-gradient-to-br from-madera-700/90 to-madera-800/90 p-[13px] text-left"
      style={{ borderLeft: `3px solid ${tint.edge}` }}
    >
      <div className="flex w-[26px] shrink-0 items-center justify-center">
        <BottleIcon glass={tint.glass} edge={tint.edge} />
      </div>

      <div className="flex min-w-0 grow flex-col gap-1">
        <div className="flex items-baseline gap-[7px]">
          <span className="truncate text-[9.5px] font-semibold tracking-[0.13em] text-tenue-500 uppercase">
            {wine.bodega}
          </span>
          {year && (
            <>
              <span className="text-[9.5px] text-tenue-700">·</span>
              <span className="text-[9.5px] font-medium text-tenue-600">{year}</span>
            </>
          )}
        </div>
        <span className="font-serif text-[19.5px] leading-[1.12] font-semibold text-crema">
          {wine.nombre_vino}
        </span>
        <div className="flex items-center gap-2 pt-[2px]">
          <span className="text-[11px] font-medium text-tenue-400">{wine.varietal}</span>
          <div className="h-[3px] w-[3px] rounded-full bg-borde-claro" />
          <span className="truncate text-[11px] text-tenue-600">{wine.region}</span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end justify-between">
        <span className="cifra font-serif text-[21px] leading-none font-semibold text-oro">
          {wine.cantidad}
        </span>
        {wine.ubicacion && (
          <span className="text-[8.5px] font-semibold tracking-[0.1em] text-tenue-700 uppercase">
            {wine.ubicacion}
          </span>
        )}
      </div>
    </button>
  )
}
