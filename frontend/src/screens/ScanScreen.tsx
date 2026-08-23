import { useEffect, useRef, useState } from 'react'
import { createWine, scanLabel, uploadLabelPhoto } from '../lib/api'
import type { WineScanResult } from '../lib/types'
import {
  BarcodeIcon,
  CameraIcon,
  CheckIcon,
  ChevronLeftIcon,
  MinusIcon,
  PlusIcon,
  RetryIcon,
  SpinnerIcon,
} from '../components/icons'

type Stage = 'capture' | 'reading' | 'form' | 'saving'

interface FormState {
  bodega: string
  nombre_vino: string
  varietal: string
  anada: string
  region: string
  alcohol: string
  cantidad: number
  ubicacion: string
  precio_estimado: string
}

const EMPTY: FormState = {
  bodega: '',
  nombre_vino: '',
  varietal: '',
  anada: '',
  region: '',
  alcohol: '',
  cantidad: 1,
  ubicacion: '',
  precio_estimado: '',
}

/** Campos que la IA leyó: se marcan con tilde, los vacíos piden completar. */
type ReadFlags = Partial<Record<keyof WineScanResult, boolean>>

interface Props {
  onCancel: () => void
  onSaved: (codigoVino: string) => void
}

export function ScanScreen({ onCancel, onSaved }: Props) {
  const [stage, setStage] = useState<Stage>('capture')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [read, setRead] = useState<ReadFlags>({})
  const [error, setError] = useState<string | null>(null)
  const [photoWarning, setPhotoWarning] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // La preview es un blob: hay que revocarla o queda colgada en memoria.
  useEffect(() => {
    if (!photo) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  async function handleFile(file: File) {
    setPhoto(file)
    setError(null)
    setStage('reading')

    try {
      const result = await scanLabel(file)
      setForm({
        ...EMPTY,
        bodega: result.bodega ?? '',
        nombre_vino: result.nombre_vino ?? '',
        varietal: result.varietal ?? '',
        anada: result.anada != null ? String(result.anada) : '',
        region: result.region ?? '',
        alcohol: result.alcohol ?? '',
      })
      setRead({
        bodega: result.bodega != null,
        nombre_vino: result.nombre_vino != null,
        varietal: result.varietal != null,
        anada: result.anada != null,
        region: result.region != null,
        alcohol: result.alcohol != null,
      })
      setStage('form')
    } catch (cause) {
      // Si la lectura falla se puede cargar a mano: la foto ya está tomada.
      setError(
        cause instanceof Error
          ? `${cause.message} Podés completar los datos a mano.`
          : 'No se pudo leer la etiqueta.',
      )
      setForm(EMPTY)
      setRead({})
      setStage('form')
    }
  }

  async function handleSave() {
    setError(null)
    setPhotoWarning(null)
    setStage('saving')

    const anada = Number.parseInt(form.anada, 10)
    const precio = form.precio_estimado.trim()

    try {
      const created = await createWine({
        bodega: form.bodega.trim(),
        nombre_vino: form.nombre_vino.trim(),
        varietal: form.varietal.trim(),
        anada,
        region: form.region.trim(),
        alcohol: form.alcohol.trim(),
        cantidad: form.cantidad,
        ubicacion: form.ubicacion.trim() || null,
        precio_estimado: precio ? Number(precio) : null,
      })

      // El vino ya está guardado: si la foto falla, no se pierde la carga.
      if (photo) {
        try {
          await uploadLabelPhoto(created.codigo_vino, photo)
        } catch {
          setPhotoWarning('El vino se guardó, pero la foto no se pudo subir.')
        }
      }

      onSaved(created.codigo_vino)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el vino.')
      setStage('form')
    }
  }

  const yearNow = new Date().getFullYear()
  const anadaNumber = Number.parseInt(form.anada, 10)
  const anadaValid =
    Number.isInteger(anadaNumber) && anadaNumber >= 1900 && anadaNumber <= yearNow

  const complete =
    form.bodega.trim() !== '' &&
    form.nombre_vino.trim() !== '' &&
    form.varietal.trim() !== '' &&
    form.region.trim() !== '' &&
    form.alcohol.trim() !== '' &&
    anadaValid

  return (
    <div className="vetas relative flex min-h-full flex-col">
      <header className="relative flex items-center gap-[14px] px-[22px] pt-13 pb-[18px]">
        <button
          type="button"
          onClick={onCancel}
          className="text-tenue-400"
          aria-label="Volver"
        >
          <ChevronLeftIcon />
        </button>
        <div className="flex flex-col gap-[2px]">
          <h1 className="font-serif text-[26px] leading-[1.1] font-semibold text-crema">
            Nueva botella
          </h1>
          <span className="text-[10px] font-semibold tracking-[0.14em] text-tenue-600 uppercase">
            {stage === 'capture'
              ? 'Sacale una foto a la etiqueta'
              : stage === 'reading'
                ? 'Leyendo la etiqueta…'
                : 'Revisá y completá'}
          </span>
        </div>
      </header>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleFile(file)
          event.target.value = ''
        }}
      />

      {/* La foto que sacó el usuario */}
      <div className="relative mx-[22px] mb-[18px] flex h-[210px] items-center justify-center overflow-hidden rounded-[13px] border border-borde bg-gradient-to-br from-madera-600 to-madera-800">
        {preview ? (
          <img src={preview} alt="Etiqueta capturada" className="h-full w-full object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex flex-col items-center gap-3 px-8 text-center"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-borde-claro text-oro">
              <CameraIcon size={22} />
            </span>
            <span className="text-[13px] leading-relaxed text-tenue-400">
              Tocá para sacar la foto
            </span>
          </button>
        )}

        {stage === 'reading' && (
          <div className="absolute inset-0 flex items-center justify-center gap-[10px] bg-madera-950/75">
            <SpinnerIcon className="animate-spin text-oro" />
            <span className="text-[12.5px] text-crema-300">Leyendo la etiqueta…</span>
          </div>
        )}

        {preview && stage !== 'reading' && (
          <>
            {Object.values(read).some(Boolean) && (
              <div className="absolute bottom-[11px] left-[11px] z-2 flex items-center gap-[7px] rounded-full border border-[#4a3a26] bg-madera-950/90 py-[6px] pr-3 pl-[9px]">
                <CheckIcon size={12} className="text-vina" />
                <span className="text-[9.5px] font-bold tracking-[0.1em] text-vina-claro uppercase">
                  Etiqueta leída
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="absolute top-[11px] right-[11px] z-2 flex items-center gap-[7px] rounded-full border border-[#4a3a26] bg-madera-950/85 py-[6px] pr-3 pl-[9px] text-oro"
            >
              <RetryIcon />
              <span className="text-[9.5px] font-bold">Otra foto</span>
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="mx-[22px] mb-4 rounded-[9px] border border-borra-600/40 bg-borra-800/20 p-3 text-[12px] leading-relaxed text-crema-300">
          {error}
        </p>
      )}
      {photoWarning && (
        <p className="mx-[22px] mb-4 rounded-[9px] border border-oro/30 bg-oro/5 p-3 text-[12px] leading-relaxed text-oro">
          {photoWarning}
        </p>
      )}

      {(stage === 'form' || stage === 'saving') && (
        <div className="relative flex grow flex-col gap-[15px] px-[22px] pb-30">
          <SectionLabel>Datos del vino</SectionLabel>

          <div className="flex flex-col gap-[13px]">
            <Field
              label="Bodega"
              value={form.bodega}
              read={read.bodega}
              onChange={(bodega) => setForm({ ...form, bodega })}
            />
            <Field
              label="Vino"
              value={form.nombre_vino}
              read={read.nombre_vino}
              onChange={(nombre_vino) => setForm({ ...form, nombre_vino })}
            />
            <Field
              label="Varietal"
              value={form.varietal}
              read={read.varietal}
              onChange={(varietal) => setForm({ ...form, varietal })}
            />
            <Field
              label="Añada"
              value={form.anada}
              read={read.anada}
              inputMode="numeric"
              invalid={form.anada !== '' && !anadaValid}
              hint={`Entre 1900 y ${yearNow}`}
              onChange={(anada) => setForm({ ...form, anada })}
            />
            <Field
              label="Región"
              value={form.region}
              read={read.region}
              onChange={(region) => setForm({ ...form, region })}
            />
            <Field
              label="Alcohol"
              value={form.alcohol}
              read={read.alcohol}
              placeholder="14%"
              onChange={(alcohol) => setForm({ ...form, alcohol })}
            />
          </div>

          <SectionLabel className="pt-[6px]">En la cava</SectionLabel>

          <div className="flex gap-[11px]">
            <div className="flex grow flex-col gap-[6px]">
              <FieldLabel>Cantidad</FieldLabel>
              <div className="flex h-[46px] items-center justify-between rounded-[9px] border border-borde bg-madera-950/55 pr-[9px] pl-[14px]">
                <span className="text-[15px] font-semibold text-crema">
                  {form.cantidad}
                </span>
                <div className="flex gap-[5px]">
                  <Stepper
                    label="Quitar una"
                    disabled={form.cantidad <= 0}
                    onClick={() =>
                      setForm({ ...form, cantidad: Math.max(0, form.cantidad - 1) })
                    }
                  >
                    <MinusIcon className="text-tenue-400" />
                  </Stepper>
                  <Stepper
                    label="Agregar una"
                    onClick={() => setForm({ ...form, cantidad: form.cantidad + 1 })}
                  >
                    <PlusIcon className="text-oro" />
                  </Stepper>
                </div>
              </div>
            </div>

            <div className="flex w-[118px] flex-col gap-[6px]">
              <FieldLabel>Estante</FieldLabel>
              <input
                value={form.ubicacion}
                onChange={(event) => setForm({ ...form, ubicacion: event.target.value })}
                placeholder="A2"
                className="h-[46px] rounded-[9px] border border-borde bg-madera-950/55 px-[14px] text-[15px] font-semibold placeholder:font-normal placeholder:text-tenue-700 focus:border-oro/40 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-[6px]">
            <div className="flex items-center gap-[7px]">
              <FieldLabel>Precio</FieldLabel>
              <span className="text-[9.5px] font-medium text-tenue-700">· opcional</span>
            </div>
            <div className="flex h-[46px] items-center gap-2 rounded-[9px] border border-borde bg-madera-950/55 px-[14px] focus-within:border-oro/40">
              <span className="text-[15px] text-tenue-700">$</span>
              <input
                value={form.precio_estimado}
                onChange={(event) =>
                  setForm({ ...form, precio_estimado: event.target.value })
                }
                inputMode="decimal"
                placeholder="—"
                className="w-full bg-transparent text-[15px] placeholder:text-tenue-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-1 flex items-center gap-[11px] rounded-[9px] border border-dashed border-[#4a3a26] bg-oro/6 p-[13px]">
            <BarcodeIcon className="shrink-0 text-oro-oscuro" />
            <div className="flex flex-col gap-[2px]">
              <span className="text-[9px] font-bold tracking-[0.14em] text-tenue-500 uppercase">
                Código
              </span>
              <span className="text-[12.5px] leading-snug text-tenue-400">
                Se asigna al guardar, según bodega, varietal y añada.
              </span>
            </div>
          </div>
        </div>
      )}

      {(stage === 'form' || stage === 'saving') && (
        <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-[430px] gap-[10px] bg-gradient-to-t from-madera-950/97 to-transparent px-[22px] pt-4 pb-[30px] backdrop-blur-sm">
          <button
            type="button"
            onClick={handleSave}
            disabled={!complete || stage === 'saving'}
            className="flex h-13 grow items-center justify-center gap-[10px] rounded-xl bg-gradient-to-br from-borra-600 to-borra-800 font-bold text-crema shadow-[0_7px_20px_rgba(138,32,56,0.34)] disabled:from-madera-700 disabled:to-madera-800 disabled:text-tenue-700 disabled:shadow-none"
          >
            {stage === 'saving' ? (
              <>
                <SpinnerIcon className="animate-spin" />
                <span className="text-[14px]">Guardando…</span>
              </>
            ) : (
              <>
                <CheckIcon size={17} />
                <span className="text-[14px]">Guardar en la cava</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

function SectionLabel({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-center gap-[11px] ${className}`}>
      <span className="text-[9.5px] font-bold tracking-[0.2em] text-tenue-500 uppercase">
        {children}
      </span>
      <div className="h-px grow bg-gradient-to-r from-borde to-transparent" />
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold tracking-[0.13em] text-tenue-500 uppercase">
      {children}
    </span>
  )
}

function Field({
  label,
  value,
  read,
  onChange,
  placeholder,
  inputMode,
  invalid,
  hint,
}: {
  label: string
  value: string
  read?: boolean
  onChange: (value: string) => void
  placeholder?: string
  inputMode?: 'numeric' | 'decimal'
  invalid?: boolean
  hint?: string
}) {
  const missing = !read && value.trim() === ''

  return (
    <div className="flex flex-col gap-[6px]">
      <div className="flex items-center gap-[7px]">
        <FieldLabel>{label}</FieldLabel>
        {read && <CheckIcon size={12} className="text-vina" />}
        {missing && (
          <span className="text-[9.5px] font-bold tracking-[0.06em] text-oro">
            · completar
          </span>
        )}
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className={`h-[46px] rounded-[9px] border bg-madera-950/55 px-[14px] text-[15px] font-medium placeholder:font-normal placeholder:text-tenue-700 focus:outline-none ${
          invalid
            ? 'border-borra-600'
            : missing
              ? 'border-oro/34 focus:border-oro/60'
              : 'border-borde focus:border-oro/40'
        }`}
      />
      {invalid && hint && <span className="text-[10.5px] text-borra-600">{hint}</span>}
    </div>
  )
}

function Stepper({
  children,
  onClick,
  label,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border border-borde-claro disabled:opacity-40"
    >
      {children}
    </button>
  )
}
