import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 hover:bg-brand-500 text-white',
  secondary: 'bg-surface-raised hover:bg-surface-border text-slate-100 border border-surface-border',
  ghost: 'bg-transparent hover:bg-surface-raised text-slate-300',
  danger: 'bg-rose-600 hover:bg-rose-500 text-white'
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

export function Button({ variant = 'primary', className = '', ...props }: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}
