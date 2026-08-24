import { useState } from 'react'
import { listWines, setToken } from '../lib/api'
import { SpinnerIcon, VineSprigIcon } from '../components/icons'

interface Props {
  onUnlocked: () => void
}

/** Puerta de entrada: pide la clave y la valida contra el backend. */
export function UnlockScreen({ onUnlocked }: Props) {
  const [value, setValue] = useState('')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!value.trim() || checking) return

    setChecking(true)
    setError(null)
    setToken(value)

    try {
      // Un pedido cualquiera alcanza: si la clave no sirve, responde 401.
      await listWines()
      onUnlocked()
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'No se pudo verificar la clave.',
      )
      setChecking(false)
    }
  }

  return (
    <div className="vetas relative flex min-h-dvh flex-col items-center justify-center px-8">
      <form
        onSubmit={submit}
        className="relative flex w-full max-w-[320px] flex-col items-center gap-6"
      >
        <div className="flex flex-col items-center gap-2">
          <VineSprigIcon size={44} />
          <h1 className="font-serif text-[28px] leading-none font-semibold text-crema">
            La Bodega
          </h1>
          <p className="text-center text-[12.5px] leading-relaxed text-tenue-500">
            Poné la clave para entrar a tu cava.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2">
          <input
            type="password"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Clave"
            autoFocus
            autoComplete="current-password"
            className="h-[46px] w-full rounded-[9px] border border-borde bg-madera-700 px-[14px] text-center text-[15px] tracking-wide placeholder:tracking-normal placeholder:text-tenue-600 focus:border-oro/50 focus:outline-none"
          />
          {error && (
            <p className="text-center text-[11.5px] leading-relaxed text-borra-600">
              {error}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!value.trim() || checking}
          className="flex h-[46px] w-full items-center justify-center gap-[10px] rounded-xl bg-borra-600 text-[14px] font-bold text-madera-700 shadow-[0_5px_16px_rgba(124,35,56,0.26)] transition-transform duration-150 active:scale-[0.985] disabled:bg-borde disabled:text-tenue-600 disabled:shadow-none"
        >
          {checking ? (
            <>
              <SpinnerIcon className="animate-spin" />
              <span>Entrando…</span>
            </>
          ) : (
            <span>Entrar</span>
          )}
        </button>
      </form>
    </div>
  )
}
