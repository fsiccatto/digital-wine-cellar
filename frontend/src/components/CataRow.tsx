import type { CataRecord } from '../lib/types'
import { formatDayMonth, formatYear } from '../lib/wine'
import { InfoIcon, PairingIcon, RatingGlassIcon } from './icons'

/**
 * Una cata del historico. Vive en components/ y no dentro de CatasScreen porque
 * la ficha del vino tambien la usa.
 *
 * El layout calca a WineRow: marca a la izquierda, datos al medio, cifra a la
 * derecha. Ahi va una sola copa con el puntaje, en el mismo lugar y peso que el
 * contador de stock; las cinco copas aparecen solo en el detalle.
 */
export function CataRow({
  cata,
  onSelect,
  onNotes,
  onOpen,
}: {
  cata: CataRecord
  onSelect: (codigoVino: string) => void
  onNotes?: (cata: CataRecord) => void
  /** En la ficha del vino el tap corrige la cata en vez de navegar a el. */
  onOpen?: (cata: CataRecord) => void
}) {
  const day = formatDayMonth(cata.fecha_consumo)
  const year = cata.anada === null ? null : formatYear(cata.anada)

  const body = (
    <>
      <div className="flex w-[13px] shrink-0 items-center justify-center">
        <RatingGlassIcon
          size={17}
          filled={cata.vino_existe}
          className={cata.vino_existe ? 'text-oro' : 'text-tenue-600'}
        />
      </div>

      <div className="flex min-w-0 grow flex-col gap-px">
        <div className="flex items-baseline gap-[5px]">
          <span className="truncate text-[8px] font-bold tracking-[0.12em] text-tenue-500 uppercase">
            {cata.vino_existe ? cata.bodega : 'Vino eliminado'}
          </span>
          {day && <span className="cifra text-[8px] font-medium text-tenue-600">{day}</span>}
        </div>

        {cata.vino_existe ? (
          <span className="truncate font-serif text-[15px] leading-[1.15] font-semibold text-crema">
            {cata.nombre_vino}
          </span>
        ) : (
          // Sin vino no hay nombre que mostrar: queda el codigo crudo.
          <span className="cifra truncate font-serif text-[15px] leading-[1.15] font-semibold text-tenue-400">
            {cata.vino_id}
          </span>
        )}

        <div className="flex items-center gap-[6px]">
          {year && <span className="cifra shrink-0 text-[9.5px] text-tenue-400">{year}</span>}
          {cata.maridaje && (
            <>
              {year && (
                <div className="h-[2.5px] w-[2.5px] shrink-0 rounded-full bg-borde-claro" />
              )}
              <PairingIcon size={10} className="shrink-0 text-tenue-600" />
              <span className="truncate text-[9.5px] text-tenue-600">{cata.maridaje}</span>
            </>
          )}
        </div>
      </div>

      {cata.puntuacion !== null && (
        <span
          className={`cifra flex shrink-0 items-center gap-[4px] font-serif text-[16px] leading-none font-semibold ${
            cata.vino_existe ? 'text-oro' : 'text-tenue-600'
          }`}
        >
          <RatingGlassIcon size={13} filled />
          {cata.puntuacion}
        </span>
      )}
    </>
  )

  // Mismas clases que la botella agotada: el precedente visual ya existe y
  // significa lo correcto.
  const shell = `tarjeta flex w-full items-center gap-[10px] rounded-[7px] border px-[11px] py-2 text-left ${
    cata.vino_existe
      ? 'border-borde bg-madera-700'
      : 'border-borde/70 bg-madera-950/45 opacity-65'
  }`

  return (
    <div className="flex items-stretch gap-[5px]">
      {onOpen ? (
        <button type="button" onClick={() => onOpen(cata)} className={shell}>
          {body}
        </button>
      ) : cata.vino_existe ? (
        <button type="button" onClick={() => onSelect(cata.vino_id)} className={shell}>
          {body}
        </button>
      ) : (
        // Un vino borrado no se puede abrir, asi que no es un boton: un boton
        // que no hace nada es justo el bug que estamos arreglando.
        <div className={shell}>{body}</div>
      )}

      {cata.notas_cata && onNotes && (
        <button
          type="button"
          onClick={() => onNotes(cata)}
          aria-label="Ver notas de la cata"
          className="flex w-[34px] shrink-0 items-center justify-center rounded-[7px] border border-borde bg-madera-700 text-tenue-500"
        >
          <InfoIcon size={13} />
        </button>
      )}
    </div>
  )
}
