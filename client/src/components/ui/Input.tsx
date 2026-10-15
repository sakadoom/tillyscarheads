import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}

/** Label di atas kontrol, pesan bantuan, dan pesan error yang terhubung ke input. */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
  className = '',
}: FieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-body-sm font-medium text-ink-2">
        {label}
        {required ? (
          <span className="ml-1 text-danger" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="text-caption text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          role="alert"
          className="text-caption font-medium text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL_CLASS =
  'w-full rounded-md border bg-surface px-3 text-body text-ink transition-colors duration-150 placeholder:text-ink-3/80 disabled:cursor-not-allowed disabled:bg-surface-2';

const CONTROL_TONE = {
  normal: 'border-control-border hover:border-ink-3 focus:border-brand-600',
  error: 'border-danger focus:border-danger',
} as const;

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/** `forwardRef` wajib agar react-hook-form bisa membaca nilai input. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid = false, className = '', type = 'text', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={`h-11 ${CONTROL_CLASS} ${invalid ? CONTROL_TONE.error : CONTROL_TONE.normal} ${className}`}
      {...rest}
    />
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid = false, className = '', rows = 3, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={`py-2 ${CONTROL_CLASS} ${invalid ? CONTROL_TONE.error : CONTROL_TONE.normal} ${className}`}
      {...rest}
    />
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid = false, className = '', children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`h-11 ${CONTROL_CLASS} ${invalid ? CONTROL_TONE.error : CONTROL_TONE.normal} ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
});

/** Id unik untuk menghubungkan label, bantuan, dan error. */
export function useFieldId(prefix: string): string {
  const id = useId();
  return `${prefix}-${id.replace(/:/g, '')}`;
}
