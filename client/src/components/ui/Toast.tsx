import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { ApiClientError } from '../../lib/api';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  show: (tone: ToastTone, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  success: 'border-success/30 bg-success-bg text-success',
  error: 'border-danger/30 bg-danger-bg text-danger',
  info: 'border-info/30 bg-info-bg text-info',
};

const TONE_ICONS: Record<ToastTone, ReactNode> = {
  success: <CircleCheck aria-hidden className="size-5 shrink-0" />,
  error: <TriangleAlert aria-hidden className="size-5 shrink-0" />,
  info: <Info aria-hidden className="size-5 shrink-0" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (tone: ToastTone, message: string) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current, { id, tone, message }]);
      window.setTimeout(() => remove(id), tone === 'error' ? 7000 : 4000);
    },
    [remove],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message: string) => show('success', message),
      error: (message: string) => show('error', message),
      info: (message: string) => show('info', message),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border px-4 py-3 shadow-lg ${TONE_STYLES[toast.tone]}`}
          >
            {TONE_ICONS[toast.tone]}
            <p className="flex-1 text-body-sm font-medium">{toast.message}</p>
            <button
              type="button"
              onClick={() => remove(toast.id)}
              className="rounded-sm p-0.5 text-current/80 transition hover:text-current focus-visible:outline-2 focus-visible:outline-offset-2"
              aria-label="Tutup notifikasi"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast harus dipakai di dalam ToastProvider');
  return context;
}

/**
 * Menjalankan aksi API dan menampilkan toast hasilnya. Pesan error diambil dari
 * respons server (sudah berbahasa Indonesia) supaya pengguna tahu penyebabnya.
 */
export function useActionFeedback() {
  const toast = useToast();

  return useMemo(
    () => ({
      async run<T>(action: () => Promise<T>, options: { success?: string } = {}): Promise<T | null> {
        try {
          const result = await action();
          if (options.success) toast.success(options.success);
          return result;
        } catch (error) {
          const message =
            error instanceof ApiClientError
              ? error.message
              : 'Terjadi kesalahan tak terduga. Coba lagi.';
          toast.error(message);
          return null;
        }
      },
    }),
    [toast],
  );
}
