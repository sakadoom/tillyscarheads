import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-line bg-surface shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export interface CardHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}

export function CardHeader({ title, description, icon: Icon, action }: CardHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-600">
            <Icon aria-hidden className="size-5" />
          </span>
        ) : null}
        <div>
          <h2 className="text-h3 text-ink">{title}</h2>
          {description ? <p className="mt-0.5 text-body-sm text-ink-3">{description}</p> : null}
        </div>
      </div>
      {action}
    </header>
  );
}

export type ChipTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const CHIP_TONES: Record<ChipTone, string> = {
  neutral: 'bg-surface-2 text-ink-2 border-line',
  brand: 'bg-brand-50 text-brand-700 border-brand-200',
  success: 'bg-success-bg text-success border-success/30',
  warning: 'bg-warning-bg text-warning border-warning/30',
  danger: 'bg-danger-bg text-danger border-danger/30',
  info: 'bg-info-bg text-info border-info/30',
};

export function Chip({
  tone = 'neutral',
  icon: Icon,
  children,
}: {
  tone?: ChipTone;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-caption font-semibold ${CHIP_TONES[tone]}`}
    >
      {Icon ? <Icon aria-hidden className="size-3.5" /> : null}
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  label,
  tone = 'brand',
}: {
  value: number;
  label?: string;
  tone?: 'brand' | 'success' | 'danger';
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const fillClass = { brand: 'bg-brand-600', success: 'bg-success', danger: 'bg-danger' }[tone];
  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? `Progres ${clamped}%`}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-3"
      >
        <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="tabular w-9 shrink-0 text-right text-caption font-semibold text-ink-2">
        {clamped}%
      </span>
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-surface-3 ${className}`} />;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-brand-50 text-brand-600">
        <Icon aria-hidden className="size-7" />
      </span>
      <h3 className="text-h3 text-ink">{title}</h3>
      <p className="max-w-md text-body-sm text-ink-3">{description}</p>
      {action}
    </div>
  );
}

const AVATAR_TINTS = [
  'bg-brand-100 text-brand-700',
  'bg-success-bg text-success',
  'bg-warning-bg text-warning',
  'bg-info-bg text-info',
  'bg-surface-3 text-ink-2',
];

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const tint = AVATAR_TINTS[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_TINTS.length];
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className={`grid shrink-0 place-items-center rounded-full text-caption font-semibold ${tint}`}
    >
      {initials(name)}
    </span>
  );
}

export function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'brand',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: 'brand' | 'danger' | 'success' | 'warning';
}) {
  const toneClass = {
    brand: 'bg-brand-50 text-brand-600',
    danger: 'bg-danger-bg text-danger',
    success: 'bg-success-bg text-success',
    warning: 'bg-warning-bg text-warning',
  }[tone];

  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`grid size-8 place-items-center rounded-md ${toneClass}`}>
          <Icon aria-hidden className="size-4" />
        </span>
        <span className="text-caption font-semibold tracking-wide text-ink-3 uppercase">{label}</span>
      </div>
      <p className="tabular mt-3 text-h2 text-ink">{value}</p>
      {hint ? <p className="mt-1 text-body-sm text-ink-3">{hint}</p> : null}
    </div>
  );
}
