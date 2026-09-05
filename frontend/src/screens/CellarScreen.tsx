import { useMemo, useState } from 'react'
import type { WineRecord } from '../lib/types'
import type { CellarFilters, EstadoGuarda } from '../lib/wine'
import {
  activeFilterCount,
  cellarValue,
  formatMoney,
  formatYear,
  glassTint,
  guardaDe,
  groupByShelf,
  hasVarietal,
  matchesFilters,
  matchesSearch,
  SIN_FILTROS,
  totalBottles,
  varietals,
} from '../lib/wine'
import {
  BottleIcon,
  CheckIcon,
  CloseIcon,
  FiltersIcon,
  SearchIcon,
  VineSprigIcon,
} from '../components/icons'
import { Sheet } from '../components/Sheet'
import { ListaSkeleton } from '../components/Skeleton'

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
  const [filters, setFilters] = useState<CellarFilters>(SIN_FILTROS)
  const [filtrando, setFiltrando] = useState(false)

  const options = useMemo(() => varietals(wines), [wines])

  const visible = useMemo(
    () =>
      wines.filter(
        (wine) =>
          matchesSearch(wine, search) &&
          matchesFilters(wine, filters) &&
          // Por uva y no por la celda entera: un corte cae bajo cada una.
          (varietal === null || hasVarietal(wine, varietal)),
      ),
    [wines, search, varietal, filters],
  )

  const puestos = activeFilterCount(filters)
  // Lo que el usuario puede deshacer para volver a ver botellas.
  const acotado = puestos > 0 || varietal !== null || search.trim() !== ''

  function limpiar() {
    setFilters(SIN_FILTROS)
    setVarietal(null)
    setSearch('')
  }

  const shelves = useMemo(() => groupByShelf(visible), [visible])
  const valor = useMemo(() => cellarValue(visible), [visible])

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
          {/* Mientras carga no hay contador: un "0 bot." duro se lee como que la
              cava esta vacia, y despues salta al numero real. Mejor nada. */}
          <div className="flex shrink-0 flex-col items-end gap-[1px]">
            {!loading && (
              <div className="flex items-baseline gap-[4px]">
                <span className="cifra font-serif text-[19px] leading-none font-semibold text-oro">
                  {totalBottles(visible)}
                </span>
                <span className="text-[8.5px] font-semibold tracking-[0.14em] text-tenue-500 uppercase">
                  bot.
                </span>
              </div>
            )}
            {/* Solo si hay precios cargados: un "$ 0" no dice nada. */}
            {valor > 0 && (
              <span className="cifra text-[9px] font-medium text-tenue-600">
                {formatMoney(valor)}
              </span>
            )}
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
          {/* Borrar a mano un campo de busqueda en el telefono es tedioso, y es
              lo que hay que hacer para volver a ver la cava entera. */}
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
        <button
          type="button"
          onClick={() => setFiltrando(true)}
          aria-label={puestos === 0 ? 'Filtros' : `Filtros (${puestos} puestos)`}
          aria-expanded={filtrando}
          className={`relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border ${
            puestos > 0
              ? 'border-borra-600 bg-borra-600 text-madera-700'
              : 'border-borde bg-madera-700 text-oro'
          }`}
        >
          <FiltersIcon size={13} />
          {/* Un filtro puesto se tiene que ver desde la cava: si no, la lista
              queda corta y no se sabe por que. */}
          {puestos > 0 && (
            <span className="cifra absolute -top-[5px] -right-[5px] flex h-[15px] min-w-[15px] items-center justify-center rounded-full border border-madera-900 bg-crema px-[3px] text-[8.5px] font-bold text-madera-700">
              {puestos}
            </span>
          )}
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
        {loading && <ListaSkeleton aviso="Abriendo la cava…" estante />}

        {error && !loading && (
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

        {!loading && !error && visible.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16">
            {/* Una botella vacia dice "cava" mejor que un parrafo solo, y es la
                misma que despues llena los estantes. */}
            <span className="opacity-75">
              <BottleIcon glass="#e4dac8" edge="#b9a88f" width={30} height={72} />
            </span>
            <p className="max-w-[230px] text-center text-[13px] leading-relaxed text-tenue-500">
              {wines.length === 0
                ? 'Todavía no hay botellas. Escaneá una etiqueta para empezar.'
                : 'Ninguna botella coincide con lo que estás buscando.'}
            </p>
            {/* Con filtros puestos el vacio es reversible: decir solo "no hay
                nada" mandaba a buscar un boton que esta arriba y sin marcar. */}
            {wines.length > 0 && acotado && (
              <button
                type="button"
                onClick={limpiar}
                className="rounded-lg border border-borde-claro px-3 py-[7px] text-[12px] font-semibold text-oro"
              >
                Limpiar la búsqueda
              </button>
            )}
          </div>
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

      {filtrando && (
        <FiltersSheet
          filters={filters}
          onChange={setFilters}
          onClose={() => setFiltrando(false)}
        />
      )}
    </div>
  )
}

/** Los estados de guarda, con el nombre que usa quien mira la cava. */
const GUARDAS: { estado: EstadoGuarda; label: string; detalle: string }[] = [
  { estado: 'listo', label: 'En su punto', detalle: 'Se pueden abrir ya' },
  { estado: 'pasando', label: 'Tomalos este año', detalle: 'Les queda poca ventana' },
  { estado: 'joven', label: 'Para guardar', detalle: 'Todavía les falta' },
  { estado: 'pasado', label: 'Pasados', detalle: 'Se les fue la ventana' },
]

/**
 * Lo que los chips de varietal no cubren: el stock y el momento de guarda.
 *
 * Va en una hoja y no en mas chips porque son filtros de otra naturaleza: la
 * fila de arriba responde "que uva", esto responde "cual abro hoy".
 */
function FiltersSheet({
  filters,
  onChange,
  onClose,
}: {
  filters: CellarFilters
  onChange: (filters: CellarFilters) => void
  onClose: () => void
}) {
  return (
    <Sheet onClose={onClose}>
      <div className="mb-5 flex flex-col gap-1">
        <span className="text-[9.5px] font-bold tracking-[0.2em] text-tenue-500 uppercase">
          Filtros
        </span>
        <h2 className="font-serif text-[23px] leading-tight font-semibold text-crema">
          Qué mostrar
        </h2>
      </div>

      <div className="mb-5 flex flex-col gap-[6px]">
        <span className="text-[10px] font-bold tracking-[0.13em] text-tenue-500 uppercase">
          Stock
        </span>
        <Opcion
          activa={filters.soloConStock}
          label="Solo con botellas"
          detalle="Esconde las que ya se terminaron"
          onClick={() => onChange({ ...filters, soloConStock: !filters.soloConStock })}
        />
      </div>

      <div className="mb-6 flex flex-col gap-[6px]">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-bold tracking-[0.13em] text-tenue-500 uppercase">
            Guarda
          </span>
          <span className="text-[9.5px] text-tenue-600">estimada por varietal</span>
        </div>
        <div className="flex flex-col gap-[6px]">
          {GUARDAS.map((item) => (
            <Opcion
              key={item.estado}
              activa={filters.guarda === item.estado}
              label={item.label}
              detalle={item.detalle}
              // Volver a tocar el que ya esta puesto lo saca: es la forma de
              // quitarlo sin sumar un "cualquiera" que no dice nada.
              onClick={() =>
                onChange({
                  ...filters,
                  guarda: filters.guarda === item.estado ? null : item.estado,
                })
              }
            />
          ))}
        </div>
      </div>

      <div className="flex gap-[10px]">
        <button
          type="button"
          onClick={() => onChange(SIN_FILTROS)}
          disabled={activeFilterCount(filters) === 0}
          className="h-13 shrink-0 rounded-xl border border-borde-claro px-5 text-[14px] font-semibold text-tenue-400 disabled:opacity-45"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-13 grow items-center justify-center gap-[10px] rounded-xl bg-borra-600 text-[14px] font-bold text-madera-700 shadow-[0_5px_16px_rgba(124,35,56,0.26)] transition-transform duration-150 active:scale-[0.985]"
        >
          <CheckIcon size={17} />
          Ver la cava
        </button>
      </div>
    </Sheet>
  )
}

function Opcion({
  activa,
  label,
  detalle,
  onClick,
}: {
  activa: boolean
  label: string
  detalle: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`tarjeta flex w-full items-center gap-[11px] rounded-[9px] border px-[14px] py-[11px] text-left ${
        activa ? 'border-borra-600 bg-borra-600/8' : 'border-borde bg-madera-950/40'
      }`}
    >
      <span
        className={`flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[6px] border ${
          activa ? 'border-borra-600 bg-borra-600 text-madera-700' : 'border-borde-claro'
        }`}
      >
        {activa && <CheckIcon size={11} />}
      </span>
      <span className="flex min-w-0 grow flex-col gap-[1px]">
        <span
          className={`text-[13.5px] font-semibold ${activa ? 'text-oro' : 'text-crema-200'}`}
        >
          {label}
        </span>
        <span className="text-[10.5px] leading-snug text-tenue-600">{detalle}</span>
      </span>
    </button>
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
  const guarda = guardaDe(wine)
  // Una botella agotada ya no se toma: avisar seria ruido.
  const urge = !empty && (guarda?.estado === 'pasando' || guarda?.estado === 'pasado')
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
          {/* Solo lo que urge lleva marca: si todo avisa, nada avisa. */}
          {urge && (
            <span
              className="text-[8px] font-bold text-oro"
              title={guarda?.detalle}
              aria-label={guarda?.detalle}
            >
              ●
            </span>
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
