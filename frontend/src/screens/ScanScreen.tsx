import { useEffect, useMemo, useRef, useState } from 'react'
import { adjustStock, createWine, scanLabel, uploadLabelPhoto } from '../lib/api'
import type { WineRecord, WineScanResult } from '../lib/types'
import { candidatoDuplicado, glassTint } from '../lib/wine'
import { PRESET_GUARDAR, PRESET_OCR, prepareLabelPhoto } from '../lib/image'
import {
  BarcodeIcon,
  BottleIcon,
  CameraIcon,
  CheckIcon,
  ChevronLeftIcon,
  ImageIcon,
  MinusIcon,
  PlusIcon,
  RetryIcon,
  SpinnerIcon,
} from '../components/icons'
import { Field, FieldLabel, SectionLabel, Stepper } from '../components/Field'

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
  /** La cava entera, para reconocer una botella que ya esta cargada. */
  wines: WineRecord[]
  onCancel: () => void
  onSaved: (codigoVino: string) => void
}

export function ScanScreen({ wines, onCancel, onSaved }: Props) {
  const [stage, setStage] = useState<Stage>('capture')
  const [photo, setPhoto] = useState<File | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [read, setRead] = useState<ReadFlags>({})
  const [error, setError] = useState<string | null>(null)
  // El de guardar va aparte del de leer: se muestran en extremos opuestos de la
  // pantalla, y el de leer sigue siendo cierto mientras se intenta guardar.
  const [saveError, setSaveError] = useState<string | null>(null)
  const [photoWarning, setPhotoWarning] = useState<string | null>(null)
  // "Es otra": se descarta el aviso hasta que cambien los datos que lo dispararon.
  const [descartado, setDescartado] = useState<string | null>(null)
  const camara = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)

  // La preview sale de la foto, no es un estado aparte: guardarla obligaba a
  // un render extra por cada captura solo para reflejar lo que ya se sabia.
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])

  // Sigue siendo un blob: sin revocarlo queda colgado en memoria.
  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  async function handleFile(file: File) {
    setPhoto(file)
    setError(null)
    setStage('reading')

    try {
      // Al escaneo va la version grande: son los pixeles que Gemini lee.
      const result = await scanLabel(await prepareLabelPhoto(file, PRESET_OCR))
      setForm((actual) => ({
        // Cantidad, estante y precio NO salen de la etiqueta: los escribio el
        // usuario y sacar otra foto se los borraba sin avisar.
        ...actual,
        bodega: result.bodega ?? '',
        nombre_vino: result.nombre_vino ?? '',
        varietal: result.varietal ?? '',
        anada: result.anada != null ? String(result.anada) : '',
        region: result.region ?? '',
        alcohol: result.alcohol ?? '',
      }))
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
      setRead({})
      setStage('form')
    }
  }

  function alElegir(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) void handleFile(file)
    // Se limpia para que elegir la MISMA foto otra vez vuelva a disparar change.
    event.target.value = ''
  }

  async function handleSave() {
    setSaveError(null)
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
          // A la cava va la version de mostrar: ~120 KB en vez de 2,5 MB.
          await uploadLabelPhoto(
            created.codigo_vino,
            await prepareLabelPhoto(photo, PRESET_GUARDAR),
          )
        } catch {
          setPhotoWarning('El vino se guardó, pero la foto no se pudo subir.')
        }
      }

      onSaved(created.codigo_vino)
    } catch (cause) {
      setSaveError(
        cause instanceof Error ? cause.message : 'No se pudo guardar el vino.',
      )
      setStage('form')
    }
  }

  /**
   * Sumar al vino que ya esta en vez de crear una fila nueva.
   *
   * Va por PATCH de stock y no por createWine: dos filas para la misma botella
   * parten el inventario en dos y despues hay que juntarlas a mano en el Sheet.
   */
  async function handleSumar() {
    if (!candidato) return
    setSaveError(null)
    setPhotoWarning(null)
    setStage('saving')

    try {
      await adjustStock(candidato.codigo_vino, form.cantidad)

      // Si el que ya estaba no tenia foto, esta es una mejora gratis. Si ya
      // tenia, no se pisa: la vieja puede ser mejor que la de recien.
      if (photo && !candidato.foto_url) {
        try {
          await uploadLabelPhoto(
            candidato.codigo_vino,
            await prepareLabelPhoto(photo, PRESET_GUARDAR),
          )
        } catch {
          setPhotoWarning('Se sumó el stock, pero la foto no se pudo subir.')
        }
      }

      onSaved(candidato.codigo_vino)
    } catch (cause) {
      setSaveError(
        cause instanceof Error ? cause.message : 'No se pudo sumar al stock.',
      )
      setStage('form')
    }
  }

  const yearNow = new Date().getFullYear()
  const anadaNumber = Number.parseInt(form.anada, 10)

  // Se recalcula con lo que hay en el formulario, no con lo que leyo la IA: si
  // se corrige la añada a mano, el aviso tiene que seguir el dato corregido.
  const candidato = candidatoDuplicado(wines, {
    bodega: form.bodega,
    varietal: form.varietal,
    anada: anadaNumber,
  })
  const avisarDuplicado =
    candidato !== null && descartado !== candidato.codigo_vino && form.cantidad > 0
  const anadaValid =
    Number.isInteger(anadaNumber) && anadaNumber >= 1900 && anadaNumber <= yearNow

  // Los mismos campos que exige el backend, en el orden en que estan en pantalla.
  const OBLIGATORIOS: [keyof FormState, string][] = [
    ['bodega', 'Bodega'],
    ['nombre_vino', 'Vino'],
    ['varietal', 'Varietal'],
    ['region', 'Región'],
    ['alcohol', 'Alcohol'],
  ]

  const faltan = OBLIGATORIOS.filter(
    ([campo]) => String(form[campo]).trim() === '',
  ).map(([, etiqueta]) => etiqueta)
  if (!anadaValid) faltan.push('Añada')

  const complete = faltan.length === 0

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

      {/* Dos inputs y no uno: `capture` es un atributo estatico, y es justo lo
          que decide si el telefono abre la camara o el carrete. Con el puesto
          no hay forma de elegir una etiqueta ya fotografiada; sin el, la camara
          queda a dos toques. Uno de cada, entonces. */}
      <input
        ref={camara}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={alElegir}
      />
      <input
        ref={galeria}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={alElegir}
      />

      {/* La foto que sacó el usuario */}
      <div className="relative mx-5 mb-4 flex h-[190px] items-center justify-center overflow-hidden rounded-xl border border-borde bg-madera-950">
        {preview ? (
          <img src={preview} alt="Etiqueta capturada" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-[14px] px-8 text-center">
            <button
              type="button"
              onClick={() => camara.current?.click()}
              className="flex flex-col items-center gap-3"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-borde-claro text-oro">
                <CameraIcon size={22} />
              </span>
              <span className="text-[13px] leading-relaxed font-medium text-crema-300">
                Tocá para sacar la foto
              </span>
            </button>
            {/* La camara es el camino principal, pero la botella puede estar
                fotografiada de antes: el carrete no puede quedar sin puerta. */}
            <button
              type="button"
              onClick={() => galeria.current?.click()}
              className="flex items-center gap-[6px] text-[11.5px] font-medium text-tenue-400"
            >
              <ImageIcon size={13} />
              Elegir de la galería
            </button>
          </div>
        )}

        {stage === 'reading' && (
          <div className="absolute inset-0 flex items-center justify-center gap-[10px] bg-madera-900/85 backdrop-blur-[1px]">
            <SpinnerIcon className="animate-spin text-oro" />
            <span className="text-[12.5px] text-crema-300">Leyendo la etiqueta…</span>
          </div>
        )}

        {/* Los chips de abajo flotan sobre la foto, que siempre es oscura: se
            quedan en tinta clara aunque el tema sea pergamino. */}
        {preview && stage !== 'reading' && (
          <>
            {Object.values(read).some(Boolean) && (
              <div className="absolute bottom-[10px] left-[10px] z-2 flex items-center gap-[6px] rounded-full bg-[#1a1512]/90 py-[5px] pr-[11px] pl-2">
                <CheckIcon size={11} className="text-[#9dba7c]" />
                <span className="text-[9px] font-bold tracking-[0.1em] text-[#cfe0b8] uppercase">
                  Etiqueta leída
                </span>
              </div>
            )}
            <div className="absolute top-[10px] right-[10px] z-2 flex items-center gap-[6px]">
              <button
                type="button"
                onClick={() => galeria.current?.click()}
                aria-label="Elegir otra de la galería"
                className="flex h-[25px] w-[25px] items-center justify-center rounded-full bg-[#1a1512]/85 text-[#e8c987]"
              >
                <ImageIcon size={13} />
              </button>
              <button
                type="button"
                onClick={() => camara.current?.click()}
                className="flex items-center gap-[6px] rounded-full bg-[#1a1512]/85 py-[5px] pr-[11px] pl-2 text-[#e8c987]"
              >
                <RetryIcon size={12} />
                <span className="text-[9px] font-bold">Otra foto</span>
              </button>
            </div>
          </>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mx-[22px] mb-4 rounded-[9px] border border-borra-600/40 bg-borra-800/20 p-3 text-[12px] leading-relaxed text-crema-300"
        >
          {error}
        </p>
      )}
      {photoWarning && (
        <p
          role="alert"
          className="mx-[22px] mb-4 rounded-[9px] border border-oro/30 bg-oro/5 p-3 text-[12px] leading-relaxed text-oro"
        >
          {photoWarning}
        </p>
      )}

      {(stage === 'form' || stage === 'saving') && (
        // La barra de abajo crece con el aviso de lo que falta y con el error de
        // guardar: el aire de mas es para que no tape la ultima tarjeta.
        <div className="relative flex grow flex-col gap-[15px] px-[22px] pb-40">
          {/* Va antes que el formulario porque es una decision, no un detalle:
              sumar o guardar aparte cambia que boton se toca al final. */}
          {avisarDuplicado && candidato && (
            <div className="flex flex-col gap-[11px] rounded-[11px] border border-oro/35 bg-oro/6 p-[14px]">
              <span className="text-[9px] font-bold tracking-[0.16em] text-oro uppercase">
                Esto ya está en tu cava
              </span>

              {/* La ficha entera del que ya esta: coincidir en bodega, uva y
                  año no prueba que sea la misma etiqueta, asi que la decision
                  la toma quien mira, con los datos a la vista. */}
              <div className="flex items-center gap-[10px] rounded-[7px] border border-borde bg-madera-700 px-[11px] py-2">
                <div className="flex w-[13px] shrink-0 items-center justify-center">
                  <BottleIcon
                    glass={glassTint(candidato.varietal).glass}
                    edge={glassTint(candidato.varietal).edge}
                    width={12}
                    height={30}
                  />
                </div>
                <div className="flex min-w-0 grow flex-col gap-px">
                  <span className="truncate text-[8px] font-bold tracking-[0.12em] text-tenue-500 uppercase">
                    {candidato.bodega}
                  </span>
                  <span className="truncate font-serif text-[15px] leading-[1.15] font-semibold text-crema">
                    {candidato.nombre_vino}
                  </span>
                  <span className="cifra truncate text-[9.5px] text-tenue-500">
                    {candidato.varietal} · {candidato.anada}
                    {candidato.ubicacion ? ` · ${candidato.ubicacion}` : ''}
                  </span>
                </div>
                <span className="cifra shrink-0 font-serif text-[16px] leading-none font-semibold text-oro">
                  {candidato.cantidad}
                </span>
              </div>

              <p className="text-[11px] leading-relaxed text-tenue-500">
                Coinciden la bodega, la uva y la añada. Si es esta misma botella
                conviene sumarla al stock que ya está; si es otra etiqueta,
                guardala aparte.
              </p>

              <div className="flex gap-[8px]">
                <button
                  type="button"
                  onClick={handleSumar}
                  disabled={stage === 'saving'}
                  className="flex h-10 grow items-center justify-center gap-[7px] rounded-[9px] bg-borra-600 text-[12.5px] font-bold text-madera-700 disabled:opacity-60"
                >
                  <PlusIcon size={12} />
                  Sumar {form.cantidad} a esta
                </button>
                <button
                  type="button"
                  onClick={() => setDescartado(candidato.codigo_vino)}
                  disabled={stage === 'saving'}
                  className="h-10 shrink-0 rounded-[9px] border border-borde-claro px-4 text-[12.5px] font-semibold text-tenue-400"
                >
                  Es otra
                </button>
              </div>
            </div>
          )}

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
            {/* Coma o punto: el backend lo guarda con punto igual. */}
            <Field
              label="Alcohol"
              value={form.alcohol}
              read={read.alcohol}
              placeholder="13,5"
              inputMode="decimal"
              onChange={(alcohol) => setForm({ ...form, alcohol })}
            />
            {/* La graduacion casi nunca esta en la cara principal, asi que este
                campo queda vacio de entrada y conviene decir por que. */}
            {!read.alcohol && (
              <span className="-mt-[8px] text-[10.5px] leading-relaxed text-tenue-600">
                La graduación suele estar en la contraetiqueta.
              </span>
            )}
          </div>

          <SectionLabel className="pt-[6px]">En la cava</SectionLabel>

          <div className="flex gap-[11px]">
            <div className="flex grow flex-col gap-[6px]">
              <FieldLabel>Cantidad</FieldLabel>
              <div
                role="group"
                aria-label={`Cantidad: ${form.cantidad}`}
                className="flex h-[46px] items-center justify-between rounded-[9px] border border-borde bg-madera-950/55 pr-[9px] pl-[14px]"
              >
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
              <FieldLabel htmlFor="scan-estante">Estante</FieldLabel>
              <input
                id="scan-estante"
                value={form.ubicacion}
                onChange={(event) => setForm({ ...form, ubicacion: event.target.value })}
                placeholder="A2"
                className="h-[46px] rounded-[9px] border border-borde bg-madera-950/55 px-[14px] text-[15px] font-semibold placeholder:font-normal placeholder:text-tenue-700 focus:border-oro/40 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-[6px]">
            <div className="flex items-center gap-[7px]">
              <FieldLabel htmlFor="scan-precio">Precio</FieldLabel>
              <span className="text-[9.5px] font-medium text-tenue-700">· opcional</span>
            </div>
            <div className="flex h-[46px] items-center gap-2 rounded-[9px] border border-borde bg-madera-950/55 px-[14px] focus-within:border-oro/40">
              <span className="text-[15px] text-tenue-700">$</span>
              <input
                id="scan-precio"
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
        <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-[430px] flex-col gap-[9px] border-t border-borde bg-madera-900/95 px-5 pt-3 pb-[26px] backdrop-blur-sm">
          {/* El error de guardar aparece aca y no arriba: el dedo esta en este
              boton, y el formulario mide mas que la pantalla. */}
          {saveError && (
            <p
              role="alert"
              className="rounded-[9px] border border-borra-600/40 bg-borra-800/20 px-3 py-[9px] text-[11.5px] leading-relaxed text-crema-300"
            >
              {saveError}
            </p>
          )}

          {/* Un boton gris sin motivo deja varado: la alcohol casi nunca la lee
              la IA, asi que el que falta suele ser ese. */}
          {!complete && (
            <p className="text-center text-[11px] leading-relaxed text-tenue-500">
              Falta completar{' '}
              <span className="font-semibold text-oro">{faltan.join(', ')}</span>.
            </p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!complete || stage === 'saving'}
            className="flex h-12 grow items-center justify-center gap-[10px] rounded-xl bg-borra-600 font-bold text-madera-700 shadow-[0_5px_16px_rgba(124,35,56,0.26)] transition-transform duration-150 active:scale-[0.985] disabled:bg-borde disabled:text-tenue-600 disabled:shadow-none"
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
