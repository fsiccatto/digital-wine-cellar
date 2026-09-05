import { useEffect, useState } from 'react'
import {
  addCata,
  adjustStock,
  consumeWine,
  deleteCata,
  deleteWine,
  getWine,
  listWineCatas,
  updateCata,
  updateWine,
} from '../lib/api'
import type { CataRecord, WineRecord, WineUpdateInput } from '../lib/types'
import type { Guarda } from '../lib/wine'
import {
  averageScore,
  formatAlcohol,
  formatDate,
  formatYear,
  glassTint,
  guardaDe,
} from '../lib/wine'
import {
  BottleIcon,
  CheckIcon,
  ChevronLeftIcon,
  CorkscrewIcon,
  GlassIcon,
  MinusIcon,
  MoreIcon,
  PairingIcon,
  PlusIcon,
  RatingGlassIcon,
  SpinnerIcon,
  TrashIcon,
} from '../components/icons'
import { alTocar, formatPuntuacion, rellenoDe } from '../lib/puntuacion'
import { CataRow } from '../components/CataRow'
import { PhotoViewer } from '../components/PhotoViewer'
import { Field, Stepper } from '../components/Field'
import { Sheet } from '../components/Sheet'

interface Props {
  codigoVino: string
  onBack: () => void
  onConsumed: () => void
  onChanged: () => void
  onDeleted: () => void
}

/** Un solo estado: dos hojas abiertas a la vez es un bug esperando. */
type OpenSheet = null | 'tasting' | 'nota' | 'edit' | 'stock' | 'delete'

export function WineScreen({
  codigoVino,
  onBack,
  onConsumed,
  onChanged,
  onDeleted,
}: Props) {
  const [wine, setWine] = useState<WineRecord | null>(null)
  const [catas, setCatas] = useState<CataRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<OpenSheet>(null)
  const [editando, setEditando] = useState<CataRecord | null>(null)
  const [menu, setMenu] = useState(false)
  const [verFoto, setVerFoto] = useState(false)

  // Escape cierra el menu, como en el visor de fotos. El velo ya lo cerraba al
  // tocar afuera, pero con teclado no habia forma de salir sin elegir algo.
  useEffect(() => {
    if (!menu) return
    const alTeclear = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(false)
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [menu])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    // Las catas van en paralelo y no rompen la ficha si fallan: el vino es lo
    // que se vino a ver.
    Promise.all([
      getWine(codigoVino),
      listWineCatas(codigoVino).catch(() => [] as CataRecord[]),
    ])
      .then(([result, history]) => {
        if (active) {
          setWine(result)
          setCatas(history)
        }
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

  function openSheet(next: OpenSheet) {
    setMenu(false)
    setSheet(next)
  }

  const guarda = guardaDe(wine)
  const promedio = averageScore(catas)
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
            'radial-gradient(120% 76% at 50% 0%, rgba(124,35,56,0.07) 0%, rgba(242,236,225,0) 70%)',
        }}
      >
        <div className="relative flex items-center justify-between pb-6">
          <button type="button" onClick={onBack} className="text-tenue-400" aria-label="Volver">
            <ChevronLeftIcon />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu((open) => !open)}
              aria-label="Más acciones"
              aria-expanded={menu}
              className="flex h-9 w-9 items-center justify-center text-tenue-400"
            >
              <MoreIcon />
            </button>

            {menu && (
              <>
                {/* Velo invisible: tocar afuera cierra el menú. */}
                <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                <div className="absolute right-0 z-20 mt-1 flex w-[168px] flex-col rounded-xl border border-borde bg-madera-600 py-1 shadow-[0_8px_24px_rgba(70,52,30,0.2)]">
                  <MenuItem onClick={() => openSheet('nota')}>Anotar una cata</MenuItem>
                  <MenuItem onClick={() => openSheet('edit')}>Editar datos</MenuItem>
                  <MenuItem onClick={() => openSheet('stock')}>Ajustar stock</MenuItem>

                  {/* Apartado del resto: el rojo se reserva para el botón de
                      confirmación dentro de la hoja, no para el que la abre. */}
                  <div className="my-1 h-px bg-borde" />
                  <MenuItem onClick={() => openSheet('delete')}>
                    <span className="flex items-center gap-2">
                      <TrashIcon size={13} />
                      Eliminar vino
                    </span>
                  </MenuItem>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="relative flex items-start gap-[18px]">
          <div className="shrink-0">
            {photo ? (
              <button
                type="button"
                onClick={() => setVerFoto(true)}
                aria-label="Ver la etiqueta en grande"
                className="block transition-transform duration-150 active:scale-[0.98]"
              >
                <img
                  src={photo}
                  alt={`Etiqueta de ${wine.nombre_vino}`}
                  // Medidas intrinsecas: sin esto la ficha salta cuando carga.
                  width={92}
                  height={132}
                  className="h-[132px] w-[92px] rounded-md border border-borde object-cover shadow-[0_6px_18px_rgba(70,52,30,0.22)]"
                />
              </button>
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
              <span className="cifra text-[12.5px] text-tenue-400">
                {formatAlcohol(wine.alcohol)}
              </span>
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

      {guarda && <GuardaBand guarda={guarda} />}

      {wine.cantidad > 0 ? (
        <button
          type="button"
          onClick={() => setSheet('tasting')}
          className="relative mx-5 mb-[22px] flex h-[48px] items-center justify-center gap-[10px] rounded-xl bg-borra-600 text-madera-700 shadow-[0_5px_16px_rgba(124,35,56,0.28)] transition-transform duration-150 active:scale-[0.985]"
        >
          <CorkscrewIcon size={17} />
          <span className="text-[14px] font-bold">Descorchar una</span>
        </button>
      ) : (
        <p className="relative mx-[22px] mb-[26px] rounded-xl border border-dashed border-borde-claro py-4 text-center text-[12.5px] text-tenue-600">
          No queda stock de este vino.
        </p>
      )}

      {catas.length > 0 && (
        <section className="relative mx-[22px] mb-8 flex flex-col">
          <div className="flex items-center gap-2 pb-[9px]">
            <span className="text-[9px] font-bold tracking-[0.16em] text-tenue-500 uppercase">
              Catas anteriores
            </span>
            <div className="h-px grow bg-borde" />
            {promedio !== null && (
              <span className="flex items-center gap-[3px] text-oro">
                <RatingGlassIcon size={11} filled />
                <span className="cifra text-[10px] font-semibold">{formatPuntuacion(promedio)}</span>
              </span>
            )}
            <span className="cifra text-[9px] font-medium text-tenue-600">
              {catas.length}
            </span>
          </div>
          <ul className="flex flex-col gap-[5px]">
            {catas.map((cata) => (
              <li key={cata.id_cata}>
                {/* Ya estamos en la ficha de este vino: la fila no navega, y el
                    tap abre la correccion de esa cata. */}
                <CataRow
                  cata={cata}
                  onSelect={() => {}}
                  onOpen={() => setEditando(cata)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {verFoto && photo && (
        <PhotoViewer
          src={photo}
          alt={`Etiqueta de ${wine.nombre_vino}`}
          onClose={() => setVerFoto(false)}
        />
      )}

      {sheet === 'tasting' && (
        <TastingSheet
          wine={wine}
          onClose={() => setSheet(null)}
          onDone={(remaining) => {
            setWine({ ...wine, cantidad: remaining })
            setSheet(null)
            // La cata recien escrita todavia no esta en la lista de la ficha.
            listWineCatas(wine.codigo_vino)
              .then(setCatas)
              .catch(() => {})
            onConsumed()
          }}
        />
      )}

      {sheet === 'nota' && (
        <TastingSheet
          wine={wine}
          modo="nota"
          onClose={() => setSheet(null)}
          onSaved={(cata) => {
            setCatas((actuales) => ordenarCatas([cata, ...actuales]))
            setSheet(null)
            onConsumed()
          }}
        />
      )}

      {editando && (
        <TastingSheet
          wine={wine}
          modo="editar"
          cata={editando}
          onClose={() => setEditando(null)}
          onSaved={(cata) => {
            setCatas((actuales) =>
              ordenarCatas(
                actuales.map((item) => (item.id_cata === cata.id_cata ? cata : item)),
              ),
            )
            setEditando(null)
            onConsumed()
          }}
          onDeleted={(idCata) => {
            setCatas((actuales) => actuales.filter((item) => item.id_cata !== idCata))
            setEditando(null)
            onConsumed()
          }}
        />
      )}

      {sheet === 'edit' && (
        <EditSheet
          wine={wine}
          onClose={() => setSheet(null)}
          onSaved={(updated) => {
            setWine(updated)
            setSheet(null)
            onChanged()
          }}
        />
      )}

      {sheet === 'stock' && (
        <StockSheet
          wine={wine}
          onClose={() => setSheet(null)}
          onSaved={(updated) => {
            setWine(updated)
            setSheet(null)
            onChanged()
          }}
        />
      )}

      {sheet === 'delete' && (
        <DeleteSheet
          wine={wine}
          catas={catas.length}
          onClose={() => setSheet(null)}
          onDeleted={() => {
            onDeleted()
            onBack()
          }}
        />
      )}
    </div>
  )
}

function MenuItem({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-[10px] text-left text-[13px] font-medium text-crema-300"
    >
      {children}
    </button>
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

/**
 * Cuando conviene tomarla. Es una estimacion por uva, no un dato de la botella,
 * asi que se dice: una fecha con aire de dato duro seria mentir.
 */
function GuardaBand({ guarda }: { guarda: Guarda }) {
  const tono = {
    pasado: 'border-borra-600/40 bg-borra-800/15 text-borra-600',
    pasando: 'border-oro/35 bg-oro/8 text-oro',
    listo: 'border-borde bg-madera-700/60 text-vina',
    joven: 'border-borde bg-madera-700/60 text-tenue-500',
  }[guarda.estado]

  return (
    <div
      className={`relative mx-[22px] mb-5 flex items-center gap-[10px] rounded-xl border px-[16px] py-[11px] ${tono}`}
    >
      <GlassIcon size={15} className="shrink-0" />
      <div className="flex min-w-0 grow flex-col gap-[1px]">
        <span className="text-[12.5px] font-semibold">{guarda.detalle}</span>
        <span className="text-[9.5px] text-tenue-600">
          Estimado por varietal · <span className="cifra">{guarda.ventana.desde}</span>–
          <span className="cifra">{guarda.ventana.hasta}</span> años de guarda
        </span>
      </div>
    </div>
  )
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
/** Las mas nuevas primero, igual que las devuelve el backend. */
function ordenarCatas(catas: CataRecord[]): CataRecord[] {
  return [...catas].sort((a, b) => b.fecha_consumo.localeCompare(a.fecha_consumo))
}

type ModoCata = 'descorchar' | 'nota' | 'editar'

/**
 * Un solo formulario para las tres cosas que se hacen con una cata: registrarla
 * al descorchar, anotarla sin tocar el stock, y corregirla despues.
 *
 * Son los mismos tres campos y la misma validacion; lo unico que cambia es a
 * donde va el guardado y que dice el boton. Tres hojas separadas serian tres
 * copias del mismo formulario.
 */
function TastingSheet({
  wine,
  modo = 'descorchar',
  cata,
  onClose,
  onDone,
  onSaved,
  onDeleted,
}: {
  wine: WineRecord
  modo?: ModoCata
  cata?: CataRecord
  onClose: () => void
  onDone?: (remaining: number) => void
  onSaved?: (cata: CataRecord) => void
  onDeleted?: (idCata: string) => void
}) {
  const [score, setScore] = useState(cata?.puntuacion ?? 4)
  const [notes, setNotes] = useState(cata?.notas_cata ?? '')
  const [pairing, setPairing] = useState(cata?.maridaje ?? '')
  const [saving, setSaving] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const textos = {
    descorchar: { rotulo: 'Cata', accion: 'Registrar cata', enCurso: 'Registrando…' },
    nota: { rotulo: 'Anotar cata', accion: 'Guardar cata', enCurso: 'Guardando…' },
    editar: { rotulo: 'Editar cata', accion: 'Guardar cambios', enCurso: 'Guardando…' },
  }[modo]

  async function submit() {
    setSaving(true)
    setError(null)
    const payload = {
      puntuacion: score,
      notas_cata: notes.trim() || null,
      maridaje: pairing.trim() || null,
    }
    try {
      if (modo === 'descorchar') {
        const result = await consumeWine(wine.codigo_vino, payload)
        onDone?.(result.stock_restante)
      } else if (modo === 'nota') {
        onSaved?.(await addCata(wine.codigo_vino, payload))
      } else if (cata) {
        onSaved?.(await updateCata(cata.id_cata, payload))
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la cata.')
      setSaving(false)
    }
  }

  async function borrar() {
    if (!cata) return
    setSaving(true)
    setError(null)
    try {
      await deleteCata(cata.id_cata)
      onDeleted?.(cata.id_cata)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo borrar la cata.')
      setSaving(false)
      setBorrando(false)
    }
  }

  return (
    <Sheet onClose={onClose}>
      <div className="mb-5 flex flex-col gap-1">
        <span className="text-[9.5px] font-bold tracking-[0.2em] text-tenue-500 uppercase">
          {textos.rotulo}
        </span>
        <h2 className="font-serif text-[23px] leading-tight font-semibold text-crema">
          {wine.nombre_vino}
        </h2>
        {modo === 'nota' && (
          // Es la contracara de "Corrige el inventario. No registra una cata."
          <p className="pt-1 text-[12px] leading-relaxed text-tenue-500">
            Anota una cata sin descontar stock.
          </p>
        )}
      </div>

      <div className="mb-5 flex flex-col gap-[9px]">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-bold tracking-[0.13em] text-tenue-500 uppercase">
            Puntuación
          </span>
          <span className="text-[9.5px] text-tenue-600">
            tocá dos veces para media copa
          </span>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((copa) => {
            const relleno = rellenoDe(copa, score)
            return (
              <button
                key={copa}
                type="button"
                onClick={() => setScore(alTocar(score, copa))}
                aria-label={`${copa} de 5, tocá de nuevo para ${copa - 0.5}`}
                className={relleno === 'vacia' ? 'text-borde-claro' : 'text-oro'}
              >
                <RatingGlassIcon
                  size={30}
                  filled={relleno === 'llena'}
                  half={relleno === 'media'}
                />
              </button>
            )
          })}
          <span className="cifra ml-1 self-center font-serif text-[19px] font-semibold text-oro">
            {formatPuntuacion(score)}
          </span>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-[6px]">
        <label
          htmlFor="cata-notas"
          className="text-[10px] font-bold tracking-[0.13em] text-tenue-500 uppercase"
        >
          Notas
        </label>
        <textarea
          id="cata-notas"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          placeholder="Aromas, taninos, cómo se abrió…"
          className="resize-none rounded-[9px] border border-borde bg-madera-950/55 p-[14px] text-[14px] leading-relaxed placeholder:text-tenue-700 focus:border-oro/40 focus:outline-none"
        />
      </div>

      <div className="mb-6 flex flex-col gap-[6px]">
        <label
          htmlFor="cata-maridaje"
          className="text-[10px] font-bold tracking-[0.13em] text-tenue-500 uppercase"
        >
          Maridaje
        </label>
        <div className="flex h-[46px] items-center gap-[10px] rounded-[9px] border border-borde bg-madera-950/55 px-[14px] focus-within:border-oro/40">
          <PairingIcon className="shrink-0 text-vina" />
          <input
            id="cata-maridaje"
            value={pairing}
            onChange={(event) => setPairing(event.target.value)}
            placeholder="Con qué lo tomaste"
            className="w-full bg-transparent text-[14px] placeholder:text-tenue-700 focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-[9px] border border-borra-600/40 bg-borra-800/20 p-3 text-[12px] text-crema-300"
        >
          {error}
        </p>
      )}

      {borrando ? (
        // La confirmacion reemplaza a la botonera en vez de abrir otra hoja
        // encima: dos hojas apiladas sobre el mismo dato se leen mal.
        <div className="flex flex-col gap-3">
          <p className="text-[13px] leading-relaxed text-crema-300">
            Se borra del histórico y no se puede deshacer.{' '}
            <span className="text-tenue-500">
              El stock del vino no cambia: esa botella se tomó igual.
            </span>
          </p>
          <div className="flex gap-[10px]">
            <button
              type="button"
              onClick={borrar}
              disabled={saving}
              className="flex h-13 shrink-0 items-center justify-center gap-2 rounded-xl border border-borra-600 px-5 text-[14px] font-semibold text-borra-600 disabled:opacity-60"
            >
              {saving ? <SpinnerIcon className="animate-spin" /> : <TrashIcon size={15} />}
              Borrar
            </button>
            <button
              type="button"
              onClick={() => setBorrando(false)}
              disabled={saving}
              className="h-13 grow rounded-xl border border-borde-claro text-[14px] font-semibold text-tenue-400"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
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
              className="flex h-13 grow items-center justify-center gap-[10px] rounded-xl bg-borra-600 font-bold text-madera-700 shadow-[0_5px_16px_rgba(124,35,56,0.26)] transition-transform duration-150 active:scale-[0.985] disabled:opacity-60"
            >
              {saving ? (
                <>
                  <SpinnerIcon className="animate-spin" />
                  <span className="text-[14px]">{textos.enCurso}</span>
                </>
              ) : (
                <>
                  <CheckIcon size={17} />
                  <span className="text-[14px]">{textos.accion}</span>
                </>
              )}
            </button>
          </div>

          {modo === 'editar' && (
            <button
              type="button"
              onClick={() => setBorrando(true)}
              disabled={saving}
              className="self-center text-[12px] font-semibold text-tenue-500 underline underline-offset-4"
            >
              Borrar esta cata
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}

/**
 * Ocho campos conocidos, sin cámara ni pasos: alcanza una hoja. Una pantalla
 * exigiría una entrada en `View`, manejar el back y recargar al volver.
 */
function EditSheet({
  wine,
  onClose,
  onSaved,
}: {
  wine: WineRecord
  onClose: () => void
  onSaved: (wine: WineRecord) => void
}) {
  const [form, setForm] = useState({
    bodega: wine.bodega,
    nombre_vino: wine.nombre_vino,
    varietal: wine.varietal,
    anada: String(wine.anada),
    region: wine.region,
    alcohol: wine.alcohol,
    ubicacion: wine.ubicacion ?? '',
    precio_estimado: wine.precio_estimado == null ? '' : String(wine.precio_estimado),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  const yearNow = new Date().getFullYear()
  const year = Number(form.anada)
  const yearInvalid = !Number.isInteger(year) || year < 1900 || year > yearNow

  const price = form.precio_estimado.trim()
  const priceInvalid = price !== '' && Number.isNaN(Number(price))

  const incomplete = [
    form.bodega,
    form.nombre_vino,
    form.varietal,
    form.region,
    form.alcohol,
  ].some((value) => value.trim() === '')

  async function submit() {
    setSaving(true)
    setError(null)
    const payload: WineUpdateInput = {
      bodega: form.bodega.trim(),
      nombre_vino: form.nombre_vino.trim(),
      varietal: form.varietal.trim(),
      anada: year,
      region: form.region.trim(),
      alcohol: form.alcohol.trim(),
      ubicacion: form.ubicacion.trim() || null,
      precio_estimado: price === '' ? null : Number(price),
    }
    try {
      onSaved(await updateWine(wine.codigo_vino, payload))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el vino.')
      setSaving(false)
    }
  }

  return (
    // Ocho campos pasan la altura de pantalla, así que la hoja scrollea.
    <Sheet onClose={onClose} className="sin-barra max-h-[85dvh] overflow-y-auto">
      <div className="mb-5 flex flex-col gap-1">
        <span className="text-[9.5px] font-bold tracking-[0.2em] text-tenue-500 uppercase">
          Editar
        </span>
        <h2 className="font-serif text-[23px] leading-tight font-semibold text-crema">
          {wine.nombre_vino}
        </h2>
      </div>

      <div className="mb-5 flex flex-col gap-[14px]">
        <Field label="Bodega" value={form.bodega} onChange={set('bodega')} />
        <Field label="Vino" value={form.nombre_vino} onChange={set('nombre_vino')} />
        <Field label="Varietal" value={form.varietal} onChange={set('varietal')} />
        <Field
          label="Añada"
          value={form.anada}
          onChange={set('anada')}
          inputMode="numeric"
          invalid={yearInvalid}
          hint={`Entre 1900 y ${yearNow}`}
        />
        <Field label="Región" value={form.region} onChange={set('region')} />
        {/* Coma o punto: el backend lo guarda con punto igual. */}
        <Field
          label="Alcohol"
          value={form.alcohol}
          onChange={set('alcohol')}
          inputMode="decimal"
          placeholder="13,5"
        />
        {/* `read` marca los opcionales: vacíos no piden completarse. */}
        <Field
          label="Estante"
          value={form.ubicacion}
          onChange={set('ubicacion')}
          read
          placeholder="A1"
        />
        <Field
          label="Precio"
          value={form.precio_estimado}
          onChange={set('precio_estimado')}
          read
          inputMode="decimal"
          invalid={priceInvalid}
          hint="Solo números."
        />

        {/* La inmutabilidad del código tiene que verse, no deducirse. */}
        <div className="flex flex-col gap-[6px]">
          <span className="text-[10px] font-bold tracking-[0.13em] text-tenue-500 uppercase">
            Código
          </span>
          <div className="cifra flex h-[46px] items-center rounded-[9px] border border-borde bg-madera-950/30 px-[14px] text-[15px] font-medium text-tenue-600">
            {wine.codigo_vino}
          </div>
          <span className="text-[10.5px] text-tenue-600">
            No cambia aunque edites la bodega, el varietal o la añada.
          </span>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-[9px] border border-borra-600/40 bg-borra-800/20 p-3 text-[12px] text-crema-300"
        >
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
          disabled={saving || incomplete || yearInvalid || priceInvalid}
          className="flex h-13 grow items-center justify-center gap-[10px] rounded-xl bg-borra-600 font-bold text-madera-700 shadow-[0_5px_16px_rgba(124,35,56,0.26)] transition-transform duration-150 active:scale-[0.985] disabled:opacity-60"
        >
          {saving ? (
            <>
              <SpinnerIcon className="animate-spin" />
              <span className="text-[14px]">Guardando…</span>
            </>
          ) : (
            <>
              <CheckIcon size={17} />
              <span className="text-[14px]">Guardar cambios</span>
            </>
          )}
        </button>
      </div>
    </Sheet>
  )
}

/**
 * El delta se acumula local y se manda en un solo request al guardar: evita N
 * llamadas contra el límite del Sheet y hace que "Cancelar" signifique algo.
 */
function StockSheet({
  wine,
  onClose,
  onSaved,
}: {
  wine: WineRecord
  onClose: () => void
  onSaved: (wine: WineRecord) => void
}) {
  const [delta, setDelta] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const result = wine.cantidad + delta

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      onSaved(await adjustStock(wine.codigo_vino, delta))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo ajustar el stock.')
      setSaving(false)
    }
  }

  return (
    <Sheet onClose={onClose}>
      <div className="mb-5 flex flex-col gap-1">
        <span className="text-[9.5px] font-bold tracking-[0.2em] text-tenue-500 uppercase">
          Stock
        </span>
        <h2 className="font-serif text-[23px] leading-tight font-semibold text-crema">
          {wine.nombre_vino}
        </h2>
        {/* Son dos formas distintas de bajar el stock y confundirlas arruina el
            histórico, así que se dice con todas las letras. */}
        <p className="pt-1 text-[12px] leading-relaxed text-tenue-500">
          Corrige el inventario. No registra una cata.
        </p>
      </div>

      <div className="mb-6 flex items-center justify-center gap-6">
        <Stepper
          onClick={() => setDelta(delta - 1)}
          label="Quitar una"
          disabled={result <= 0}
        >
          <MinusIcon />
        </Stepper>
        <div className="flex w-[92px] flex-col items-center gap-[2px]">
          <span className="cifra font-serif text-[40px] leading-none font-semibold text-oro">
            {result}
          </span>
          <span className="cifra text-[11px] text-tenue-600">
            {delta === 0 ? 'sin cambios' : delta > 0 ? `+${delta}` : String(delta)}
          </span>
        </div>
        <Stepper onClick={() => setDelta(delta + 1)} label="Agregar una">
          <PlusIcon />
        </Stepper>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-[9px] border border-borra-600/40 bg-borra-800/20 p-3 text-[12px] text-crema-300"
        >
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
          disabled={saving || delta === 0}
          className="flex h-13 grow items-center justify-center gap-[10px] rounded-xl bg-borra-600 font-bold text-madera-700 shadow-[0_5px_16px_rgba(124,35,56,0.26)] transition-transform duration-150 active:scale-[0.985] disabled:opacity-60"
        >
          {saving ? (
            <>
              <SpinnerIcon className="animate-spin" />
              <span className="text-[14px]">Guardando…</span>
            </>
          ) : (
            <>
              <CheckIcon size={17} />
              <span className="text-[14px]">Guardar stock</span>
            </>
          )}
        </button>
      </div>
    </Sheet>
  )
}

function DeleteSheet({
  wine,
  catas,
  onClose,
  onDeleted,
}: {
  wine: WineRecord
  catas: number
  onClose: () => void
  onDeleted: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      await deleteWine(wine.codigo_vino)
      onDeleted()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo eliminar el vino.')
      setSaving(false)
    }
  }

  return (
    <Sheet onClose={onClose}>
      <div className="mb-4 flex flex-col gap-1">
        <span className="text-[9.5px] font-bold tracking-[0.2em] text-tenue-500 uppercase">
          Eliminar
        </span>
        <h2 className="font-serif text-[23px] leading-tight font-semibold text-crema">
          {wine.nombre_vino}
        </h2>
      </div>

      <p className="mb-5 text-[13px] leading-relaxed text-crema-300">
        {wine.cantidad > 0 && (
          <>
            Todavía {wine.cantidad === 1 ? 'queda' : 'quedan'}{' '}
            <span className="cifra font-semibold text-oro">{wine.cantidad}</span>{' '}
            {wine.cantidad === 1 ? 'botella' : 'botellas'} en cava.{' '}
          </>
        )}
        Sale del inventario y no se puede deshacer.
        {/* La decisión sobre las catas tiene que ser visible al decidir, no una
            sorpresa después. */}
        {catas > 0 && (
          <>
            {' '}
            Sus <span className="cifra font-semibold">{catas}</span>{' '}
            {catas === 1 ? 'cata se conserva' : 'catas se conservan'} en el histórico.
          </>
        )}
      </p>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-[9px] border border-borra-600/40 bg-borra-800/20 p-3 text-[12px] text-crema-300"
        >
          {error}
        </p>
      )}

      {/* Único lugar donde se invierte la botonera: acá lo ancho y cómodo tiene
          que ser salir, no confirmar. */}
      <div className="flex gap-[10px]">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="flex h-13 shrink-0 items-center justify-center gap-2 rounded-xl border border-borra-600 px-5 text-[14px] font-semibold text-borra-600 disabled:opacity-60"
        >
          {saving ? <SpinnerIcon className="animate-spin" /> : <TrashIcon size={15} />}
          Eliminar
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="h-13 grow rounded-xl border border-borde-claro text-[14px] font-semibold text-tenue-400"
        >
          Cancelar
        </button>
      </div>
    </Sheet>
  )
}
