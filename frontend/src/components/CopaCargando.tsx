import { useId } from 'react'
import { CALIZ } from './icons'

/** Copa con vino que se mece mientras carga. */
export function CopaCargando() {
  return (
    <div className="brota flex flex-col items-center gap-3 py-6">
      <Copa />
      <p role="status" className="font-serif text-[16px] italic text-tenue-500">
        Abriendo la cava…
      </p>
    </div>
  )
}

// Periodo de 8: la animacion la corre exactamente eso para que no haya costura.
const OLA = `M-8 0${' q2 -0.8 4 0 t4 0'.repeat(5)} V12 H-8 Z`

/** La misma copa que el resto de la app, en su grilla de 24, con vino adentro. */
function Copa() {
  const recorte = useId()

  return (
    <svg viewBox="7 2 10 19" width={30} height={57} fill="none" aria-hidden="true">
      <defs>
        <clipPath id={recorte}>
          <path d={CALIZ} />
        </clipPath>
      </defs>

      <path d={CALIZ} fill="var(--color-madera-600)" />

      <g clipPath={`url(#${recorte})`}>
        <g className="copa-nivel">
          <path className="copa-ola copa-ola-atras" d={OLA} fill="var(--color-vidrio)" opacity={0.35} />
          <path className="copa-ola" d={OLA} fill="var(--color-borra-600)" />
        </g>
      </g>

      <path
        d="M9.6 4.8L10.2 8.8"
        stroke="white"
        strokeOpacity={0.7}
        strokeWidth={0.5}
        strokeLinecap="round"
      />

      <g stroke="var(--color-tenue-500)" strokeWidth={0.5} strokeLinecap="round" strokeLinejoin="round">
        <path d={CALIZ} />
        <path d="M12 14v6M8.5 20h7" />
      </g>
    </svg>
  )
}
