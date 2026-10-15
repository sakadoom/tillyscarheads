import { ChartGantt, CircleCheckBig, Clock, Users } from 'lucide-react';
import type { ReactNode } from 'react';

const HIGHLIGHTS = [
  { icon: ChartGantt, text: 'Gantt chart dengan dependensi FS/SS dan drag untuk mengubah jadwal' },
  { icon: Clock, text: 'Durasi dihitung hari kerja mengikuti akhir pekan dan hari libur' },
  { icon: Users, text: 'Alokasi anggota tim, biaya, dan peringatan over-alokasi' },
  { icon: CircleCheckBig, text: 'Jalur kritis dan diagram PERT dari mesin penjadwalan yang sama' },
];

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-canvas grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="hidden flex-col justify-between bg-brand-700 px-10 py-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <span className="grid size-10 place-items-center rounded-md bg-white/15">
            <ChartGantt aria-hidden className="size-5" />
          </span>
          <span className="text-body-lg font-semibold">Gantt Chart</span>
        </div>

        <div className="max-w-lg">
          <h1 className="text-display font-bold tracking-tight">
            Kelola jadwal proyek tanpa membuka spreadsheet.
          </h1>
          <p className="mt-4 text-body-lg text-white/85">
            Susun tugas, atur dependensi, alokasikan tim, dan lihat jalur kritis dalam satu tempat.
          </p>
          <ul className="mt-8 flex flex-col gap-4">
            {HIGHLIGHTS.map((highlight) => (
              <li key={highlight.text} className="flex items-start gap-3 text-body text-white/90">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-white/15">
                  <highlight.icon aria-hidden className="size-4" />
                </span>
                {highlight.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-caption text-white/70">
          Aplikasi contoh manajemen proyek · data tersimpan di database melalui REST API
        </p>
      </section>

      <section className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-md sm:p-8">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <span className="grid size-9 place-items-center rounded-md bg-brand-600 text-white">
              <ChartGantt aria-hidden className="size-5" />
            </span>
            <span className="text-body font-semibold text-ink">Gantt Chart</span>
          </div>
          <h1 className="text-h2 text-ink">{title}</h1>
          <p className="mt-1 text-body-sm text-ink-3">{description}</p>
          <div className="mt-6">{children}</div>
        </div>
      </section>
    </div>
  );
}
