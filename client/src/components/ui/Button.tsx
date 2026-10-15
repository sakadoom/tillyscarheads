import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 border border-transparent',
  secondary:
    'bg-surface text-ink-2 border border-line-strong shadow-sm hover:bg-surface-2 hover:text-ink',
  ghost: 'bg-transparent text-ink-2 border border-transparent hover:bg-surface-2 hover:text-ink',
  danger: 'bg-danger text-white shadow-sm hover:brightness-110 border border-transparent',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-body-sm gap-1.5',
  md: 'h-11 px-4 text-body gap-2',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tone?: 'neutral' | 'danger';
}

export function IconButton({
  label,
  tone = 'neutral',
  className = '',
  children,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex size-9 items-center justify-center rounded-md border border-transparent transition-colors duration-150 hover:bg-surface-2 ${
        tone === 'danger' ? 'text-danger hover:bg-danger-bg' : 'text-ink-3 hover:text-ink'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
