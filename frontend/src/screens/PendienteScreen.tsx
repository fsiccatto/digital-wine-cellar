import { useEffect, useMemo, useRef, useState } from 'react'
import { createPendiente, scanLabel, updatePendiente, uploadPendientePhoto } from '../lib/api'
import type { PendienteInput, PendienteRecord, WineRecord } from '../lib/types'
import { yaEnLaCava } from '../lib/pendientes'
import { diaDe, glassTint } from '../lib/wine'
import { PRESET_GUARDAR, PRESET_OCR, prepareLabelPhoto } from '../lib/image'
import {
  BottleIcon,
  CameraIcon,
  CheckIcon,
  ChevronLeftIcon,
  ImageIcon,
  PairingIcon,
  RetryIcon,
  SpinnerIcon,
} from '../components/icons'
import { Field, FieldLabel, SectionLabel } from '../components/Field'
import { SelectorCopas } from '../components/SelectorCopas'

interface FormState {
  nombre_vino: string
  bodega: string
  varietal: string
  anada: string
  region: string
  alcohol: string
  origen: string
  notas: string
  maridaje: string
}

function formDe(pendiente?: PendienteRecord): FormState {
  return {
    nombre_vino: pendiente?.nombre_vino ?? '',
    bodega: pendiente?.bodega ?? '',
    varietal: pendiente?.varietal ?? '',
    anada: pendiente?.anada != null ? String(pendiente.anada) : '',
    region: pendiente?.region ?? '',
    alcohol: pendiente?.alcohol ?? '',
    origen: pendiente?.origen ?? '',
    notas: pendiente?.notas ?? '',
    maridaje: pendiente?.maridaje ?? '',
  }
}

interface Props {
  /** Sin pendiente es uno nuevo. */
  pendiente?: PendienteRecord
  /** Para avisar si lo que se esta anotando ya esta en la cava. */
  wines: WineRecord[]
  onCancel: () => void
  onSaved: (aviso?: string) => void
  onVerVino: (codigoVino: string) => void
}

/**
 * Anotar un vino que no esta en la cava. Pensado para la mesa: el nombre
 * alcanza, la foto completa el resto, y la cata se agrega si se probo.
 */
export function PendienteScreen({ pendiente, wines, onCancel, onSaved, onVerVino }: Props) {
  const [form, setForm] = useState<FormState>(() => formDe(pendiente))
  const [probado, setProbado] = useState(pendiente?.puntuacion != null)
  const [score, setScore] = useState(pendiente?.puntuacion ?? 4)
  // Igual que en la cata: la fecha solo viaja si se cambio. Asi la de hoy
  // guarda la hora, y la de un pendiente editado no se pierde.
  const [diaOriginal] = useState(() => diaDe(pendiente?.fecha_probado ?? undefined))
  const [dia, setDia] = useState(diaOriginal)
  const [photo, setPhoto] = useState<File | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [yearNow] = useState(() => new Date().getFullYear())
  const camara = useRef<HTMLInputElement>(null)
  const galeria = useRef<HTMLInputElement>(null)

  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo])
  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  const guardada = pendiente?.foto_url?.startsWith('http') ? pendiente.foto_url : null
  const foto = preview ?? guardada

  async function handleFile(file: File) {
    setPhoto(file)
    setScanError(null)
    setLeyendo(true)
    try {
      const result = await scanLabel(await prepareLabelPhoto(file, PRESET_OCR))
      // Lo que no se lee de la etiqueta se queda como estaba: el nombre que se
      // escribio de memoria antes de sacar la foto no se pierde.
      setForm((actual) => ({
        ...actual,
        nombre_vino: result.nombre_vino ?? actual.nombre_vino,
        bodega: result.bodega ?? actual.bodega,
        varietal: result.varietal ?? actual.varietal,
        anada: result.anada != null ? String(result.anada) : actual.anada,
        region: result.region ?? actual.region,
        alcohol: result.alcohol ?? actual.alcohol,
      }))
    } catch (cause) {
      setScanError(
        cause instanceof Error
          ? `${cause.message} Podés completar los datos a mano.`
          : 'No se pudo leer la etiqueta.',
      )
    } finally {
      setLeyendo(false)
    }
  }

  function alElegir(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) void handleFile(file)
    event.target.value = ''
  }

  const anadaNumber = Number.parseInt(form.anada, 10)
  const anadaInvalida =
    form.anada.trim() !== '' &&
    !(Number.isInteger(anadaNumber) && anadaNumber >= 1900 && anadaNumber <= yearNow)
  const completo = form.nombre_vino.trim() !== '' && !anadaInvalida

  // Con lo que hay escrito, no con lo que se guardo: el aviso sigue al dedo.
  const enLaCava = yaEnLaCava(wines, { nombre_vino: form.nombre_vino, bodega: form.bodega })

  async function handleSave() {
    setSaving(true)
    setError(null)

    const texto = (valor: string) => valor.trim() || null
    const payload: PendienteInput = {
      nombre_vino: form.nombre_vino.trim(),
      bodega: texto(form.bodega),
      varietal: texto(form.varietal),
      anada: form.anada.trim() === '' ? null : anadaNumber,
      region: texto(form.region),
      alcohol: texto(form.alcohol),
      origen: texto(form.origen),
      notas: texto(form.notas),
      puntuacion: probado ? score : null,
      maridaje: probado ? texto(form.maridaje) : null,
      ...(probado && dia && dia !== diaOriginal ? { fecha_probado: dia } : {}),
    }

    try {
      const guardado = pendiente
        ? await updatePendiente(pendiente.id, payload)
        : await createPendiente(payload)

      // El pendiente ya esta guardado: si la foto falla, no se pierde la carga.
      let aviso: string | undefined
      if (photo) {
        try {
          await uploadPendientePhoto(guardado.id, await prepareLabelPhoto(photo, PRESET_GUARDAR))
        } catch {
          aviso = 'El pendiente se guardó, pero la foto no se pudo subir.'
        }
      }
      onSaved(aviso)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar.')
      setSaving(false)
    }
  }

  return (
    <div className="vetas relative flex min-h-full flex-col">
      <header className="relative flex items-center gap-[14px] px-[22px] pt-13 pb-[18px]">
        <button type="button" onClick={onCancel} className="text-tenue-400" aria-label="Volver">
          <ChevronLeftIcon />
        </button>
        <div className="flex flex-col gap-[2px]">
          <h1 className="font-serif text-[26px] leading-[1.1] font-semibold text-crema">
            {pendiente ? 'Editar pendiente' : 'Nuevo pendiente'}
          </h1>
          <span className="text-[10px] font-semibold tracking-[0.14em] text-tenue-600 uppercase">
            {leyendo ? 'Leyendo la etiqueta…' : 'Con el nombre alcanza'}
          </span>
        </div>
      </header>

      {/* Camara y carrete por separado, por lo mismo que en la carga de una
          botella: `capture` decide cual abre y no se puede cambiar al vuelo. */}
      <input
        ref={camara}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={alElegir}
      />
      <input ref={galeria} type="file" accept="image/*" className="hidden" onChange={alElegir} />

      <div className="relative mx-5 mb-4 flex h-[150px] items-center justify-center overflow-hidden rounded-xl border border-borde bg-madera-950">
        {foto ? (
          <img src={foto} alt="Etiqueta" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-3 px-8 text-center">
            <button
              type="button"
              onClick={() => camara.current?.click()}
              className="flex flex-col items-center gap-[10px]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-borde-claro text-oro">
                <CameraIcon size={20} />
              </span>
              <span className="text-[12.5px] leading-relaxed font-medium text-crema-300">
                Sacale una foto a la etiqueta
              </span>
            </button>
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

        {leyendo && (
          <div className="absolute inset-0 flex items-center justify-center gap-[10px] bg-madera-900/85 backdrop-blur-[1px]">
            <SpinnerIcon className="animate-spin text-oro" />
            <span className="text-[12.5px] text-crema-300">Leyendo la etiqueta…</span>
          </div>
        )}

        {/* Sobre la foto, que siempre es oscura: tinta clara en los dos temas. */}
        {foto && !leyendo && (
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
              <span className="text-[10.5px] font-bold">Otra foto</span>
            </button>
          </div>
        )}
      </div>

      {scanError && (
        <p
          role="alert"
          className="mx-[22px] mb-4 rounded-[9px] border border-borra-600/40 bg-borra-800/20 p-3 text-[12px] leading-relaxed text-crema-300"
        >
          {scanError}
        </p>
      )}

      <div className="relative flex grow flex-col gap-[15px] px-[22px] pb-36">
        {/* Avisa y no bloquea: puede ser otra añada, o algo que se quiere
            volver a comprar. */}
        {enLaCava && (
          <div className="flex flex-col gap-[10px] rounded-[11px] border border-oro/35 bg-oro/6 p-[14px]">
            <span className="text-[10.5px] font-bold tracking-[0.16em] text-oro uppercase">
              Ya está en tu cava
            </span>
            <button
              type="button"
              onClick={() => onVerVino(enLaCava.codigo_vino)}
              className="flex items-center gap-[10px] rounded-[7px] border border-borde bg-madera-700 px-[11px] py-2 text-left"
            >
              <BottleIcon
                glass={glassTint(enLaCava.varietal).glass}
                edge={glassTint(enLaCava.varietal).edge}
                width={12}
                height={30}
              />
              <span className="flex min-w-0 grow flex-col gap-px">
                <span className="truncate text-[10px] font-bold tracking-[0.12em] text-tenue-500 uppercase">
                  {enLaCava.bodega}
                </span>
                <span className="truncate font-serif text-[15px] leading-[1.15] font-semibold text-crema">
                  {enLaCava.nombre_vino}
                </span>
                <span className="cifra truncate text-[10.5px] text-tenue-500">
                  {enLaCava.varietal} · {enLaCava.anada}
                  {enLaCava.ubicacion ? ` · ${enLaCava.ubicacion}` : ''}
                </span>
              </span>
              <span className="cifra shrink-0 font-serif text-[16px] leading-none font-semibold text-oro">
                {enLaCava.cantidad}
              </span>
            </button>
            <p className="text-[11px] leading-relaxed text-tenue-500">
              Si es otra añada, o querés volver a comprarlo, guardalo igual.
            </p>
          </div>
        )}

        <SectionLabel>El vino</SectionLabel>

        <div className="flex flex-col gap-[13px]">
          <Field
            label="Vino"
            value={form.nombre_vino}
            placeholder="Como te lo nombraron"
            onChange={(nombre_vino) => setForm({ ...form, nombre_vino })}
          />
          <Field
            label="Bodega"
            value={form.bodega}
            opcional
            onChange={(bodega) => setForm({ ...form, bodega })}
          />
          <Field
            label="Varietal"
            value={form.varietal}
            opcional
            onChange={(varietal) => setForm({ ...form, varietal })}
          />
          <div className="flex gap-[11px]">
            <div className="grow">
              <Field
                label="Añada"
                value={form.anada}
                opcional
                inputMode="numeric"
                invalid={anadaInvalida}
                hint={`Entre 1900 y ${yearNow}`}
                onChange={(anada) => setForm({ ...form, anada })}
              />
            </div>
            <div className="w-[118px]">
              <Field
                label="Alcohol"
                value={form.alcohol}
                opcional
                placeholder="13,5"
                inputMode="decimal"
                onChange={(alcohol) => setForm({ ...form, alcohol })}
              />
            </div>
          </div>
          <Field
            label="Región"
            value={form.region}
            opcional
            onChange={(region) => setForm({ ...form, region })}
          />
          <Field
            label="De dónde"
            value={form.origen}
            opcional
            placeholder="Quién te lo recomendó, dónde lo probaste"
            onChange={(origen) => setForm({ ...form, origen })}
          />
        </div>

        <SectionLabel className="pt-[6px]">¿Lo probaste?</SectionLabel>

        {/* Probarlo es lo que lo vuelve una cata al comprarlo: sin esto, las
            notas son lo que conto quien lo recomendo. */}
        <div role="group" aria-label="¿Lo probaste?" className="flex gap-[8px]">
          {[
            { valor: false, texto: 'Me lo recomendaron' },
            { valor: true, texto: 'Lo probé' },
          ].map((opcion) => (
            <button
              key={opcion.texto}
              type="button"
              onClick={() => setProbado(opcion.valor)}
              aria-pressed={probado === opcion.valor}
              className={`h-10 grow rounded-[9px] border text-[12.5px] font-semibold ${
                probado === opcion.valor
                  ? 'border-oro/50 bg-oro/10 text-oro'
                  : 'border-borde text-tenue-500'
              }`}
            >
              {opcion.texto}
            </button>
          ))}
        </div>

        {probado && <SelectorCopas valor={score} onChange={setScore} />}

        <div className="flex flex-col gap-[6px]">
          <div className="flex items-center gap-[7px]">
            <FieldLabel htmlFor="pendiente-notas">Notas</FieldLabel>
            <span className="text-[10.5px] font-medium text-tenue-700">· opcional</span>
          </div>
          <textarea
            id="pendiente-notas"
            value={form.notas}
            onChange={(event) => setForm({ ...form, notas: event.target.value })}
            rows={3}
            placeholder={probado ? 'Aromas, taninos, qué te gustó…' : 'Lo que te contaron de él'}
            className="resize-none rounded-[9px] border border-borde bg-madera-950/55 p-[14px] text-base leading-relaxed placeholder:text-tenue-700 focus:border-oro/40 focus:outline-none"
          />
        </div>

        {probado && (
          <>
            <div className="flex flex-col gap-[6px]">
              <FieldLabel htmlFor="pendiente-maridaje">Maridaje</FieldLabel>
              <div className="flex h-[46px] items-center gap-[10px] rounded-[9px] border border-borde bg-madera-950/55 px-[14px] focus-within:border-oro/40">
                <PairingIcon className="shrink-0 text-vina" />
                <input
                  id="pendiente-maridaje"
                  value={form.maridaje}
                  onChange={(event) => setForm({ ...form, maridaje: event.target.value })}
                  placeholder="Con qué lo tomaste"
                  className="w-full bg-transparent text-[14px] placeholder:text-tenue-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-[6px]">
              <FieldLabel htmlFor="pendiente-fecha">Cuándo lo probaste</FieldLabel>
              <input
                id="pendiente-fecha"
                type="date"
                value={dia}
                max={diaDe()}
                onChange={(event) => setDia(event.target.value)}
                className="cifra h-[46px] rounded-[9px] border border-borde bg-madera-950/55 px-[14px] text-[14px] focus:border-oro/40 focus:outline-none"
              />
            </div>
          </>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto flex max-w-[430px] flex-col gap-[9px] border-t border-borde bg-madera-900/95 px-5 pt-3 pb-seguro backdrop-blur-sm">
        {error && (
          <p
            role="alert"
            className="rounded-[9px] border border-borra-600/40 bg-borra-800/20 px-3 py-[9px] text-[11.5px] leading-relaxed text-crema-300"
          >
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!completo || saving || leyendo}
          className="flex h-12 grow items-center justify-center gap-[10px] rounded-xl bg-borra-600 font-bold text-madera-700 shadow-[0_5px_16px_rgba(124,35,56,0.26)] transition-transform duration-150 active:scale-[0.985] disabled:bg-borde disabled:text-tenue-600 disabled:shadow-none"
        >
          {saving ? (
            <>
              <SpinnerIcon className="animate-spin" />
              <span className="text-[14px]">Guardando…</span>
            </>
          ) : (
            <>
              <CheckIcon size={17} />
              <span className="text-[14px]">
                {pendiente ? 'Guardar cambios' : 'Guardar en pendientes'}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
