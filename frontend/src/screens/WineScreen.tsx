import { useEffect, useState } from 'react'
import { consumeWine, getWine } from '../lib/api'
import type { WineRecord } from '../lib/types'
import { formatDate, formatYear, glassTint } from '../lib/wine'
import {
  BottleIcon,
  CheckIcon,
  ChevronLeftIcon,
  CorkscrewIcon,
  PairingIcon,
  RatingGlassIcon,
  SpinnerIcon,
} from '../components/icons'

interface Props {
  codigoVino: string
  onBack: () => void
  onConsumed: () => void
}

export function WineScreen({ codigoVino, onBack, onConsumed }: Props) {
  const [wine, setWine] = useState<WineRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tasting, setTasting] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    getWine(codigoVino)
      .then((result) => {
        if (active) setWine(result)
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'No se pudo abrir el vino.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [codigoVino])

  if (loading) {
    return (
      <Frame onBack={onBack}>
        <div className="flex items-center justify-center gap-[10px] py-20 text-tenue-500">
          <SpinnerIcon className="animate-spin" />
          <span className="text-[13px]">Buscando la botella…</span>
        </div>
      </Frame>
    )
  }

  if (error || !wine) {
    return (
      <Frame onBack={onBack}>
        <p className="mx-[22px] rounded-[11px] border border-borra-600/40 bg-borra-800/20 p-4 text-[13px] leading-relaxed text-crema-300">
          {error ?? 'No se encontró el vino.'}
        </p>
      </Frame>
    )
  }

  const tint = glassTint(wine.varietal)
  const year = formatYear(wine.anada)
  const entered = formatDate(wine.fecha_ingreso)
  // Sin bucket, foto_url guarda el nombre del objeto (o basura escrita a mano):
  // solo una URL absoluta es una foto que se puede mostrar.
  const photo = wine.foto_url?.startsWith('http') ? wine.foto_url : null

  return (
    <div className="relative flex min-h-full flex-col">
      <div
        className="vetas relative px-[22px] pt-13 pb-[26px]"
        style={{
          background:
            'radial-gradient(128% 82% at 50% 0%, rgba(109,20,40,0.42) 0%, rgba(23,16,14,0) 68%)',
        }}
      >
        <div className="relative flex items-center justify-between pb-6">
          <button type="button" onClick={onBack} className="text-tenue-400" aria-label="Volver">
            <ChevronLeftIcon />
          </button>
        </div>

        <div className="relative flex items-start gap-[18px]">
          <div className="shrink-0">
            {photo ? (
              <img
                src={photo}
                alt={`Etiqueta de ${wine.nombre_vino}`}
                className="h-[132px] w-[92px] rounded-md border border-borde object-cover shadow-[0_9px_26px_rgba(0,0,0,0.6)]"
              />
            ) : (
              <BottleIcon glass={tint.glass} edge={tint.edge} width={52} height={132} />
            )}
          </div>

          <div className="flex min-w-0 grow flex-col gap-[6px] pt-[5px]">
            <span className="text-[10px] font-bold tracking-[0.2em] text-oro-oscuro uppercase">
              {wine.bodega}
            </span>
            <h1 className="font-serif text-[31px] leading-[1.06] font-semibold tracking-tight text-crema">
              {wine.nombre_vino}
            </h1>
            <div className="flex flex-wrap items-center gap-[9px] pt-[3px]">
              <span className="text-[12.5px] font-semibold text-oro">{wine.varietal}</span>
              {year && (
                <>
                  <Dot />
                  <span className="cifra text-[12.5px] text-tenue-400">{year}</span>
                </>
              )}
              <Dot />
              <span className="text-[12.5px] text-tenue-400">{wine.alcohol}</span>
            </div>
            <span className="pt-[1px] text-[11.5px] text-tenue-600">{wine.region}</span>
          </div>
        </div>
      </div>

      <div className="relative mx-[22px] mb-5 flex items-center gap-[14px] rounded-xl border border-borde bg-gradient-to-br from-madera-700/90 to-madera-800/90 px-[18px] py-4">
        <div className="flex flex-col gap-[2px]">
          <span className="text-[9px] font-bold tracking-[0.16em] text-tenue-500 uppercase">
            En cava
          </span>
          <div className="flex items-baseline gap-[6px]">
            <span className="cifra font-serif text-[34px] leading-none font-semibold text-oro">
              {wine.cantidad}
            </span>
            <span className="text-[12px] text-tenue-600">
              {wine.cantidad === 1 ? 'botella' : 'botellas'}
            </span>
          </div>
        </div>

        <div className="w-px self-stretch bg-borde" />

        <dl className="flex grow flex-col gap-[7px]">
          {wine.ubicacion && <Row label="Estante" value={wine.ubicacion} />}
          {entered && <Row label="Ingreso" value={entered} />}
          {wine.precio_estimado != null && (
            <Row
              label="Precio"
              value={wine.precio_estimado.toLocaleString('es-AR', {
                style: 'currency',
                currency: 'ARS',
                maximumFractionDigits: 0,
              })}
            />
          )}
          <Row label="Código" value={wine.codigo_vino} mono />
        </dl>
      </div>

      {wine.cantidad > 0 ? (
        <button
          type="button"
          onClick={() => setTasting(true)}
          className="relative mx-[22px] mb-[26px] flex h-[54px] items-center justify-center gap-[11px] rounded-xl bg-gradient-to-br from-borra-600 to-borra-800 shadow-[0_8px_22px_rgba(138,32,56,0.36)]"
        >
          <CorkscrewIcon className="text-crema" />
          <span className="text-[15px] font-bold text-crema">Descorchar una</span>
        </button>
      ) : (
        <p className="relative mx-[22px] mb-[26px] rounded-xl border border-dashed border-borde-claro py-4 text-center text-[12.5px] text-tenue-600">
          No queda stock de este vino.
        </p>
      )}

      {tasting && (
        <TastingSheet
          wine={wine}
          onClose={() => setTasting(false)}
          onDone={(remaining) => {
            setWine({ ...wine, cantidad: remaining })
            setTasting(false)
            onConsumed()
          }}
        />
      )}
    </div>
  )
}

function Frame({
  children,
  onBack,
}: {
  children: React.ReactNode
  onBack: () => void
}) {
  return (
    <div className="vetas relative flex min-h-full flex-col">
      <div className="relative flex items-center px-[22px] pt-13 pb-6">
        <button type="button" onClick={onBack} className="text-tenue-400" aria-label="Volver">
          <ChevronLeftIcon />
        </button>
      </div>
      {children}
    </div>
  )
}

function Dot() {
  return <div className="h-[3px] w-[3px] rounded-full bg-borde-claro" />
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[10.5px] text-tenue-500">{label}</dt>
      <dd
        className={
          mono
            ? 'cifra truncate text-[10px] font-bold tracking-wide text-oro-oscuro'
            : 'cifra truncate text-[10.5px] font-semibold text-crema-200'
        }
      >
        {value}
      </dd>
    </div>
  )
}

/** Formulario de cata: puntuación 1-5, notas y maridaje. */
function TastingSheet({
  wine,
  onClose,
  onDone,
}: {
  wine: WineRecord
  onClose: () => void
  onDone: (remaining: number) => void
}) {
  const [score, setScore] = useState(4)
  const [notes, setNotes] = useState('')
  const [pairing, setPairing] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      const result = await consumeWine(wine.codigo_vino, {
        puntuacion: score,
        notas_cata: notes.trim() || null,
        maridaje: pairing.trim() || null,
      })
      onDone(result.stock_restante)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo registrar la cata.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-madera-950/70">
      <div className="w-full max-w-[430px] rounded-t-2xl border-t border-borde bg-madera-800 px-[22px] pt-6 pb-[30px]">
        <div className="mb-5 flex flex-col gap-1">
          <span className="text-[9.5px] font-bold tracking-[0.2em] text-tenue-500 uppercase">
            Cata
          </span>
          <h2 className="font-serif text-[23px] leading-tight font-semibold text-crema">
            {wine.nombre_vino}
          </h2>
        </div>

        <div className="mb-5 flex flex-col gap-[9px]">
          <span className="text-[10px] font-bold tracking-[0.13em] text-tenue-500 uppercase">
            Puntuación
          </span>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setScore(value)}
                aria-label={`${value} de 5`}
                className={value <= score ? 'text-oro' : 'text-borde-claro'}
              >
                <RatingGlassIcon size={30} filled={value <= score} />
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-[6px]">
          <span className="text-[10px] font-bold tracking-[0.13em] text-tenue-500 uppercase">
            Notas
          </span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="Aromas, taninos, cómo se abrió…"
            className="resize-none rounded-[9px] border border-borde bg-madera-950/55 p-[14px] text-[14px] leading-relaxed placeholder:text-tenue-700 focus:border-oro/40 focus:outline-none"
          />
        </div>

        <div className="mb-6 flex flex-col gap-[6px]">
          <span className="text-[10px] font-bold tracking-[0.13em] text-tenue-500 uppercase">
            Maridaje
          </span>
          <div className="flex h-[46px] items-center gap-[10px] rounded-[9px] border border-borde bg-madera-950/55 px-[14px] focus-within:border-oro/40">
            <PairingIcon className="shrink-0 text-vina" />
            <input
              value={pairing}
              onChange={(event) => setPairing(event.target.value)}
              placeholder="Con qué lo tomaste"
              className="w-full bg-transparent text-[14px] placeholder:text-tenue-700 focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-[9px] border border-borra-600/40 bg-borra-800/20 p-3 text-[12px] text-crema-300">
            {error}
          </p>
        )}

        <div className="flex gap-[10px]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-13 shrink-0 rounded-xl border border-borde-claro px-5 text-[14px] font-semibold text-tenue-400"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="flex h-13 grow items-center justify-center gap-[10px] rounded-xl bg-gradient-to-br from-borra-600 to-borra-800 font-bold text-crema shadow-[0_7px_20px_rgba(138,32,56,0.34)] disabled:opacity-60"
          >
            {saving ? (
              <>
                <SpinnerIcon className="animate-spin" />
                <span className="text-[14px]">Registrando…</span>
              </>
            ) : (
              <>
                <CheckIcon size={17} />
                <span className="text-[14px]">Registrar cata</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
