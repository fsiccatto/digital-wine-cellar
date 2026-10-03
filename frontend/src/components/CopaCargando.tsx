import { useEffect, useId, useState } from 'react'
import { avisoDeCarga, DESPERTANDO_MS, TARDANDO_MS } from '../lib/carga'

/** Copa con vino que se mece mientras carga; el texto cambia si tarda. */
export function CopaCargando({ aviso }: { aviso: string }) {
  const [transcurrido, setTranscurrido] = useState(0)

  useEffect(() => {
    const inicio = Date.now()
    const timers = [DESPERTANDO_MS, TARDANDO_MS].map((ms) =>
      window.setTimeout(() => setTranscurrido(Date.now() - inicio), ms),
    )
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [])

  return (
    <div className="brota flex flex-col items-center gap-3 py-6">
      <Copa />
      <p role="status" className="font-serif text-[16px] italic text-tenue-500">
        {avisoDeCarga(aviso, transcurrido)}
      </p>
    </div>
  )
}

// Periodo de 16: la animacion la corre exactamente eso para que no haya costura.
const OLA = `M-24 0${' q4 -1.6 8 0 t8 0'.repeat(6)} V40 H-24 Z`

const CUENCO = 'M11 7C10.5 20 13 33 24 35.5C35 33 37.5 20 37 7'

function Copa() {
  const recorte = useId()

  return (
    <svg viewBox="0 0 48 60" width={46} height={58} fill="none" aria-hidden="true">
      <defs>
        <clipPath id={recorte}>
          <path d={`${CUENCO}Z`} />
        </clipPath>
      </defs>

      <path d={`${CUENCO}Z`} fill="var(--color-madera-600)" />

      <g clipPath={`url(#${recorte})`}>
        <g className="copa-nivel">
          <path className="copa-ola copa-ola-atras" d={OLA} fill="var(--color-vidrio)" opacity={0.35} />
          <path className="copa-ola" d={OLA} fill="var(--color-borra-600)" />
        </g>
      </g>

      <path
        d="M15 11C14.6 18 15.8 25 18.6 29"
        stroke="white"
        strokeOpacity={0.7}
        strokeWidth={1.3}
        strokeLinecap="round"
      />

      <g stroke="var(--color-tenue-500)" strokeWidth={1.3} strokeLinecap="round">
        <path d={CUENCO} strokeLinejoin="round" />
        <path d="M24 35.5V53" />
        <path d="M15.5 55C19 53.6 29 53.6 32.5 55" />
      </g>
    </svg>
  )
}
