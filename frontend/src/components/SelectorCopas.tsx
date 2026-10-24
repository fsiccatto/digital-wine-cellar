import { alTocar, formatPuntuacion, rellenoDe } from '../lib/puntuacion'
import { RatingGlassIcon } from './icons'

/** Cinco copas para puntuar: la ficha al catar y el pendiente que se probo. */
export function SelectorCopas({
  valor,
  onChange,
}: {
  valor: number
  onChange: (valor: number) => void
}) {
  return (
    <div className="flex flex-col gap-[9px]">
      <div className="flex items-baseline gap-2">
        <span className="text-[10px] font-bold tracking-[0.13em] text-tenue-500 uppercase">
          Puntuación
        </span>
        <span className="text-[10.5px] text-tenue-600">tocá dos veces para media copa</span>
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((copa) => {
          const relleno = rellenoDe(copa, valor)
          return (
            <button
              key={copa}
              type="button"
              onClick={() => onChange(alTocar(valor, copa))}
              aria-label={`${copa} de 5, tocá de nuevo para ${copa - 0.5}`}
              className={relleno === 'vacia' ? 'text-borde-claro' : 'text-oro'}
            >
              <RatingGlassIcon size={30} filled={relleno === 'llena'} half={relleno === 'media'} />
            </button>
          )
        })}
        <span className="cifra ml-1 self-center font-serif text-[19px] font-semibold text-oro">
          {formatPuntuacion(valor)}
        </span>
      </div>
    </div>
  )
}
