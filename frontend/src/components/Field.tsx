import { useId } from 'react'
import { CheckIcon } from './icons'

export function SectionLabel({
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

/**
 * El rotulo de un campo. Con `htmlFor` sale como <label> de verdad y no como un
 * <span> decorativo: sin eso el input no tiene nombre accesible, y ademas
 * tocar el texto no enfoca el campo.
 */
export function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode
  htmlFor?: string
}) {
  const clases = 'text-[10px] font-bold tracking-[0.13em] text-tenue-500 uppercase'
  return htmlFor ? (
    <label htmlFor={htmlFor} className={clases}>
      {children}
    </label>
  ) : (
    <span className={clases}>{children}</span>
  )
}

export function Field({
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
  // Un id propio por instancia: dos campos con el mismo id rompen la relacion
  // con el rotulo y el foco se va siempre al primero.
  const id = useId()
  const idPista = `${id}-pista`

  return (
    <div className="flex flex-col gap-[6px]">
      <div className="flex items-center gap-[7px]">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        {read && <CheckIcon size={12} className="text-vina" />}
        {missing && (
          <span className="text-[9.5px] font-bold tracking-[0.06em] text-oro">
            · completar
          </span>
        )}
      </div>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid && hint ? idPista : undefined}
        className={`h-[46px] rounded-[9px] border bg-madera-950/55 px-[14px] text-[15px] font-medium placeholder:font-normal placeholder:text-tenue-700 focus:outline-none ${
          invalid
            ? 'border-borra-600'
            : missing
              ? 'border-oro/34 focus:border-oro/60'
              : 'border-borde focus:border-oro/40'
        }`}
      />
      {invalid && hint && (
        <span id={idPista} className="text-[10.5px] text-borra-600">
          {hint}
        </span>
      )}
    </div>
  )
}

export function Stepper({
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
