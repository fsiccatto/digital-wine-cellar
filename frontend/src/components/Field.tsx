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

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-bold tracking-[0.13em] text-tenue-500 uppercase">
      {children}
    </span>
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
