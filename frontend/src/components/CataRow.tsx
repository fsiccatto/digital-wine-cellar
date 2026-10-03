import type { CataRecord } from '../lib/types'
import { formatDate, formatDayMonth, formatYear } from '../lib/wine'
import { formatPuntuacion } from '../lib/puntuacion'
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
          <span className="truncate text-[10px] font-bold tracking-[0.12em] text-tenue-500 uppercase">
            {cata.vino_existe ? cata.bodega : 'Vino eliminado'}
          </span>
          {day && <span className="cifra text-[10.5px] font-medium text-tenue-600">{day}</span>}
        </div>

        <span
          className={`truncate font-serif text-[15px] leading-[1.15] font-semibold ${
            cata.vino_existe ? 'text-crema' : 'cifra text-tenue-400'
          }`}
        >
          {cata.vino_existe ? cata.nombre_vino : (cata.codigo_vino ?? 'Sin datos del vino')}
        </span>

        <div className="flex items-center gap-[6px]">
          {year && <span className="cifra shrink-0 text-[10.5px] text-tenue-400">{year}</span>}
          {cata.maridaje && (
            <>
              {year && (
                <div className="h-[2.5px] w-[2.5px] shrink-0 rounded-full bg-borde-claro" />
              )}
              <PairingIcon size={10} className="shrink-0 text-tenue-600" />
              <span className="truncate text-[10.5px] text-tenue-600">{cata.maridaje}</span>
            </>
          )}
        </div>
      </div>

      <Puntaje cata={cata} />
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
      ) : cata.vino_existe && cata.codigo_vino ? (
        // Por el codigo y no por `vino_id`: desde que la cata guarda el uuid
        // del vino, `vino_id` ya no es lo que aceptan las rutas de la API.
        <button
          type="button"
          onClick={() => onSelect(cata.codigo_vino!)}
          className={shell}
        >
          {body}
        </button>
      ) : (
        // Un vino borrado no se puede abrir, asi que no es un boton.
        <div className={shell}>{body}</div>
      )}

      {/* El hueco queda aunque no haya notas: si no, la columna del puntaje
          se corre fila por fila. */}
      {onNotes &&
        (cata.notas_cata ? (
          <button
            type="button"
            onClick={() => onNotes(cata)}
            aria-label="Ver notas de la cata"
            className="flex w-[34px] shrink-0 items-center justify-center rounded-[7px] border border-borde bg-madera-700 text-tenue-500"
          >
            <InfoIcon size={13} />
          </button>
        ) : (
          <div aria-hidden className="w-[34px] shrink-0" />
        ))}
    </div>
  )
}

/**
 * La cata dentro de la ficha de su vino: bodega, nombre y añada ya estan
 * arriba, asi que la fila cuenta lo propio de esa noche.
 */
export function CataRowCompacta({
  cata,
  onOpen,
}: {
  cata: CataRecord
  onOpen: (cata: CataRecord) => void
}) {
  const fecha = formatDate(cata.fecha_consumo)

  return (
    <button
      type="button"
      onClick={() => onOpen(cata)}
      className="tarjeta flex w-full items-center gap-[12px] rounded-[7px] border border-borde bg-madera-700 px-[13px] py-[10px] text-left"
    >
      <div className="flex min-w-0 grow flex-col gap-[3px]">
        <span className="cifra text-[11px] font-semibold tracking-[0.04em] text-tenue-500">
          {fecha ?? 'Sin fecha'}
        </span>
        {cata.notas_cata && (
          <span className="line-clamp-2 font-serif text-[14.5px] leading-snug text-crema-300 italic">
            {cata.notas_cata}
          </span>
        )}
        {cata.maridaje && (
          <span className="flex min-w-0 items-center gap-[5px] text-[11px] text-tenue-600">
            <PairingIcon size={11} className="shrink-0" />
            <span className="truncate">{cata.maridaje}</span>
          </span>
        )}
      </div>

      <Puntaje cata={cata} />
    </button>
  )
}

function Puntaje({ cata }: { cata: CataRecord }) {
  if (cata.puntuacion === null) return null
  return (
    <span
      className={`cifra flex shrink-0 items-center gap-[4px] font-serif text-[16px] leading-none font-semibold ${
        cata.vino_existe ? 'text-oro' : 'text-tenue-600'
      }`}
    >
      <RatingGlassIcon size={13} filled />
      {formatPuntuacion(cata.puntuacion)}
    </span>
  )
}
