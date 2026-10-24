import type { CataRecord } from '../lib/types'
import { formatDate, formatDayMonth, formatYear } from '../lib/wine'
import { formatPuntuacion } from '../lib/puntuacion'
import { PairingIcon, RatingGlassIcon } from './icons'

/**
 * Una cata del historico. Vive en components/ junto a la version compacta que
 * usa la ficha del vino.
 *
 * El layout calca a WineRow: marca a la izquierda, datos al medio, cifra a la
 * derecha. Ahi va una sola copa con el puntaje, en el mismo lugar y peso que el
 * contador de stock; las cinco copas aparecen solo en el detalle.
 *
 * El toque abre el detalle y no el vino: en el historico lo que se vuelve a
 * leer son las notas, y el detalle ya lleva al vino. Antes las notas pedian un
 * boton aparte al costado.
 */
export function CataRow({
  cata,
  onOpen,
}: {
  cata: CataRecord
  onOpen: (cata: CataRecord) => void
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
    <button type="button" onClick={() => onOpen(cata)} className={shell}>
      {body}
    </button>
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
  // Se dice: sin nada a la derecha la fila parece un dato que falta, no una
  // botella que se tomo sin ganas de puntuarla.
  if (cata.puntuacion === null) {
    return <span className="shrink-0 text-[10.5px] text-tenue-600">sin puntuar</span>
  }
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
