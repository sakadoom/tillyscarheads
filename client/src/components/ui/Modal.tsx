import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

import { Button, IconButton } from './Button';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}

const SIZE_CLASS = {
  md: 'max-w-lg',
  lg: 'max-w-3xl',
} as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm sm:p-8">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`mt-4 w-full ${SIZE_CLASS[size]} rounded-lg border border-line bg-surface shadow-lg outline-none`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-h3 text-ink">{title}</h2>
            {description ? <p className="mt-1 text-body-sm text-ink-3">{description}</p> : null}
          </div>
          <IconButton label="Tutup dialog" onClick={onClose}>
            <X aria-hidden className="size-5" />
          </IconButton>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Hapus',
  loading = false,
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Batal
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-body text-ink-2">{message}</p>
    </Modal>
  );
}
