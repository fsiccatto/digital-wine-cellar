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
  VineSprigIcon,
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
      <header className="relative px-5 pt-8 pb-3">
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-end gap-[7px]">
            <div className="flex flex-col gap-[2px]">
              <span className="text-[8.5px] font-bold tracking-[0.24em] text-tenue-500 uppercase">
                Mi Cava
              </span>
              <h1 className="font-serif text-[24px] leading-none font-semibold text-crema">
                La Bodega
              </h1>
            </div>
            <span className="mb-[1px] shrink-0">
              <VineSprigIcon />
            </span>
          </div>
          <div className="flex shrink-0 items-baseline gap-[4px]">
            <span className="cifra font-serif text-[19px] leading-none font-semibold text-oro">
              {totalBottles(visible)}
            </span>
            <span className="text-[8.5px] font-semibold tracking-[0.14em] text-tenue-500 uppercase">
              bot.
            </span>
          </div>
        </div>
      </header>

      <div className="relative flex gap-[7px] px-5 pb-[10px]">
        <label className="flex h-[34px] grow items-center gap-2 rounded-lg border border-borde bg-madera-700 px-[11px]">
          <SearchIcon size={12} className="shrink-0 text-tenue-600" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar"
            className="w-full bg-transparent text-[11.5px] placeholder:text-tenue-600 focus:outline-none"
          />
        </label>
        <button
          type="button"
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-borde bg-madera-700 text-oro"
          aria-label="Filtros"
        >
          <FiltersIcon size={13} />
        </button>
      </div>

      {options.length > 0 && (
        <div className="sin-barra relative flex gap-[5px] overflow-x-auto pb-[15px] pl-5 pr-0">
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
          {/* Chrome no respeta el padding-right del contenedor al final del
              scroll, asi que el margen final es un hijo mas. */}
          <div aria-hidden className="w-5 shrink-0" />
        </div>
      )}

      <div className="relative flex grow flex-col gap-4 px-5 pb-27">
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

        {shelves.map((shelf, index) => (
          <section
            key={shelf.key}
            className="brota flex flex-col"
            style={{ animationDelay: `${Math.min(index, 6) * 70}ms` }}
          >
            <div className="flex items-center gap-2 pb-[7px]">
              <span className="text-[8px] font-bold tracking-[0.2em] text-tenue-500 uppercase">
                {shelf.label}
              </span>
              <div className="h-px grow bg-borde" />
              <span className="text-[8px] font-medium text-tenue-600">
                {shelf.bottles} {shelf.bottles === 1 ? 'botella' : 'botellas'}
              </span>
            </div>

            <ul className="flex flex-col gap-[5px]">
              {shelf.wines.map((wine) => (
                <li key={wine.codigo_vino}>
                  <WineRow wine={wine} onSelect={onSelect} />
                </li>
              ))}
            </ul>

            <div
              className="mt-[7px] h-[3px] rounded-sm"
              style={{
                background: 'linear-gradient(180deg, #c9ab7d 0%, #a8875f 100%)',
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
      // El area tactil llega a 44px con padding vertical y margen negativo que
      // lo compensa: el dedo tiene donde caer y el layout no se entera.
      className="-my-[12px] shrink-0 py-[12px]"
    >
      <span
        className={
          active
            ? 'block rounded-full bg-borra-600 px-[10px] py-[3px] text-[9px] font-bold text-madera-700'
            : 'block rounded-full border border-borde bg-madera-700 px-[10px] py-[3px] text-[9px] font-medium text-tenue-400'
        }
      >
        {children}
      </span>
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
  const year = formatYear(wine.anada)
  const empty = wine.cantidad <= 0
  // La agotada pierde el tinte del vino: queda como vidrio vacio.
  const tint = empty
    ? { glass: '#ded3c0', edge: '#cbbda6' }
    : glassTint(wine.varietal)

  return (
    <button
      type="button"
      onClick={() => onSelect(wine.codigo_vino)}
      className={`tarjeta flex w-full items-center gap-[10px] rounded-[7px] border px-[11px] py-2 text-left ${
        empty
          ? 'border-borde/70 bg-madera-950/45 opacity-65'
          : 'border-borde bg-madera-700'
      }`}
      style={{ borderLeft: `2px solid ${tint.edge}` }}
    >
      <div className="flex w-[13px] shrink-0 items-center justify-center">
        <BottleIcon glass={tint.glass} edge={tint.edge} width={12} height={30} />
      </div>

      <div className="flex min-w-0 grow flex-col gap-px">
        <div className="flex items-baseline gap-[5px]">
          <span className="truncate text-[8px] font-bold tracking-[0.12em] text-tenue-500 uppercase">
            {wine.bodega}
          </span>
          {year && (
            <span className="cifra text-[8px] font-medium text-tenue-600">{year}</span>
          )}
        </div>
        <span
          className={`truncate font-serif text-[15px] leading-[1.15] font-semibold ${
            empty ? 'text-tenue-400' : 'text-crema'
          }`}
        >
          {wine.nombre_vino}
        </span>
        <div className="flex items-center gap-[6px]">
          <span className="shrink-0 text-[9.5px] text-tenue-400">{wine.varietal}</span>
          {wine.ubicacion && (
            <>
              <div className="h-[2.5px] w-[2.5px] shrink-0 rounded-full bg-borde-claro" />
              <span className="truncate text-[9.5px] text-tenue-600">
                {wine.ubicacion}
              </span>
            </>
          )}
        </div>
      </div>

      <span
        className={`cifra shrink-0 font-serif text-[16px] leading-none font-semibold ${
          empty ? 'text-tenue-600' : 'text-oro'
        }`}
      >
        {wine.cantidad}
      </span>
    </button>
  )
}
