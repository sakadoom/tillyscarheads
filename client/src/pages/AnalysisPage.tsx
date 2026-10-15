import { Activity, CalendarDays, ChartColumn, CircleDollarSign, Target } from 'lucide-react';
import { useParams } from 'react-router-dom';
import type { CpmTaskResult } from 'shared';

import { AppShell } from '../components/layout/AppShell';
import { PertDiagram } from '../components/pert/PertDiagram';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, Chip, EmptyState, Skeleton, StatTile } from '../components/ui/Card';
import { useProjectAnalysis, useProjectSnapshot } from '../api/hooks';
import { formatCurrency, formatIsoDateShort, formatNumber } from '../lib/format';

export function AnalysisPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const snapshotQuery = useProjectSnapshot(projectId);
  const analysisQuery = useProjectAnalysis(projectId);

  const snapshot = snapshotQuery.data;
  const analysis = analysisQuery.data;
  const nameById = new Map((snapshot?.tasks ?? []).map((task) => [task.id, task.name]));
  const criticalPathNames = (analysis?.criticalPath ?? []).map((id) => nameById.get(id) ?? id);

  const newest = () => {
    void snapshotQuery.refetch();
    void analysisQuery.refetch();
  };

  return (
    <AppShell projectId={projectId}>
      <header className="mb-5">
        <p className="text-caption font-semibold tracking-wide text-ink-3 uppercase">Analisis</p>
        <h1 className="text-h1 text-ink">Jalur kritis dan PERT</h1>
        <p className="mt-1 text-body-sm text-ink-3">
          Perhitungan memakai mesin penjadwalan yang sama dengan halaman Gantt, jadi angkanya selalu
          konsisten.
        </p>
      </header>

      {analysisQuery.isPending || snapshotQuery.isPending ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((key) => (
              <Skeleton key={key} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : analysisQuery.isError || !analysis || !snapshot ? (
        <Card>
          <div className="px-6 py-10 text-center">
            <p className="text-body text-ink-2">Analisis tidak bisa dimuat.</p>
            <Button className="mt-3" onClick={newest}>
              Coba lagi
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              icon={CalendarDays}
              label="Mulai proyek"
              value={formatIsoDateShort(analysis.summary.projectStart)}
              hint={`${snapshot.project.weekendDays.length} hari akhir pekan per minggu`}
            />
            <StatTile
              icon={Activity}
              label="Selesai"
              value={
                analysis.summary.projectEnd
                  ? formatIsoDateShort(analysis.summary.projectEnd)
                  : 'Belum ada tugas'
              }
              hint={`${formatNumber(analysis.summary.totalWorkingDays)} hari kerja`}
              tone="success"
            />
            <StatTile
              icon={Target}
              label="Tugas kritis"
              value={`${analysis.summary.criticalTaskCount} / ${analysis.summary.leafTaskCount}`}
              hint="Tugas daun yang tidak punya float"
              tone="danger"
            />
            <StatTile
              icon={CircleDollarSign}
              label="Total biaya"
              value={formatCurrency(analysis.summary.totalCost)}
              hint={`${analysis.summary.resourceCount} anggota tim`}
              tone="warning"
            />
          </div>

          <Card>
            <CardHeader
              icon={ChartColumn}
              title="Tabel CPM"
              description="ES/EF dari forward pass, LS/LF dari backward pass. Float 0 berarti kritis."
              action={<Chip tone="danger">{analysis.summary.criticalTaskCount} kritis</Chip>}
            />
            {analysis.cpm.length === 0 ? (
              <EmptyState
                icon={ChartColumn}
                title="Belum ada tugas daun"
                description="Tambahkan tugas pada halaman Gantt untuk melihat perhitungan jalur kritis."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <caption className="sr-only">Tabel perhitungan jalur kritis</caption>
                  <thead>
                    <tr className="text-caption font-semibold tracking-wide text-ink-3 uppercase">
                      <th scope="col" className="px-5 py-2">
                        Tugas
                      </th>
                      <th scope="col" className="px-5 py-2 text-right">
                        ES
                      </th>
                      <th scope="col" className="px-5 py-2 text-right">
                        EF
                      </th>
                      <th scope="col" className="px-5 py-2 text-right">
                        LS
                      </th>
                      <th scope="col" className="px-5 py-2 text-right">
                        LF
                      </th>
                      <th scope="col" className="px-5 py-2 text-right">
                        Float
                      </th>
                      <th scope="col" className="px-5 py-2">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.cpm.map((row: CpmTaskResult) => (
                      <tr key={row.id} className="border-t border-line">
                        <td className="px-5 py-2 text-body-sm text-ink">{row.name}</td>
                        <td className="tabular px-5 py-2 text-right text-body-sm text-ink-2">{row.es}</td>
                        <td className="tabular px-5 py-2 text-right text-body-sm text-ink-2">{row.ef}</td>
                        <td className="tabular px-5 py-2 text-right text-body-sm text-ink-2">{row.ls}</td>
                        <td className="tabular px-5 py-2 text-right text-body-sm text-ink-2">{row.lf}</td>
                        <td className="tabular px-5 py-2 text-right text-body-sm text-ink-2">
                          {row.totalFloat}
                        </td>
                        <td className="px-5 py-2">
                          <Chip tone={row.critical ? 'danger' : 'neutral'}>
                            {row.critical ? 'Kritis' : 'Float tersedia'}
                          </Chip>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              icon={Target}
              title="Rangkaian jalur kritis"
              description="Urutan tugas kritis yang saling terhubung, diurutkan menurut waktu mulai paling awal."
            />
            <div className="px-5 py-4">
              {criticalPathNames.length === 0 ? (
                <p className="text-body-sm text-ink-3">
                  Belum ada tugas kritis pada proyek ini. Semua tugas masih punya float.
                </p>
              ) : (
                <ol className="flex flex-wrap items-center gap-2">
                  {criticalPathNames.map((name, index) => (
                    <li key={`${name}-${index}`} className="flex items-center gap-2">
                      <span className="rounded-md border border-danger/30 bg-danger-bg px-3 py-1 text-body-sm font-medium text-danger">
                        {name}
                      </span>
                      {index < criticalPathNames.length - 1 ? (
                        <span aria-hidden className="text-ink-3">
                          →
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              icon={Activity}
              title="Diagram PERT"
              description="Kolom mengikuti kedalaman jalur terpanjang. Node kritis berwarna merah."
            />
            <PertDiagram
              nodes={analysis.pert.nodes}
              dependencies={snapshot.dependencies}
              criticalPath={analysis.criticalPath}
              totalVariance={analysis.pert.totalVariance}
              standardDeviation={analysis.pert.standardDeviation}
            />
          </Card>
        </div>
      )}
    </AppShell>
  );
}
