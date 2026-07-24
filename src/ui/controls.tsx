import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { ArrowIcon } from './icons'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost'
  icon?: ReactNode
}

export function Button({ children, variant = 'primary', icon, className = '', ...props }: ButtonProps) {
  return (
    <button className={`button button--${variant} ${className}`} {...props}>
      <span>{children}</span>{icon ?? (variant === 'primary' ? <ArrowIcon /> : null)}
    </button>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T
  options: readonly { value: T; label: string; testId?: string }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" data-testid={option.testId} aria-pressed={value === option.value} className={value === option.value ? 'is-active' : ''} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Meter({ value, label, tone = 'gold' }: { value: number; label: string; tone?: 'gold' | 'green' | 'blue' }) {
  return (
    <div className="meter">
      <div className="meter__label"><span>{label}</span><strong>{value}</strong></div>
      <div className="meter__track"><span className={`meter__fill meter__fill--${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
    </div>
  )
}
