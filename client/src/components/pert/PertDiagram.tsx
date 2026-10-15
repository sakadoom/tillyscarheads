import { Minus, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DependencyDto, PertNode } from 'shared';

import { Button } from '../ui/Button';

export interface PertDiagramProps {
  nodes: PertNode[];
  dependencies: DependencyDto[];
  criticalPath: readonly string[];
  totalVariance: number;
  standardDeviation: number;
}

const NODE_WIDTH = 210;
const NODE_HEIGHT = 104;
const COLUMN_GAP = 90;
const ROW_GAP = 26;
const PADDING = 24;

interface PositionedNode extends PertNode {
  x: number;
  y: number;
}

/** Tata letak: kolom = kedalaman jalur terpanjang dari node awal. */
function layout(nodes: readonly PertNode[], scale: number): PositionedNode[] {
  const byColumn = new Map<number, PertNode[]>();
  for (const node of nodes) {
    byColumn.set(node.column, [...(byColumn.get(node.column) ?? []), node]);
  }
  const positioned: PositionedNode[] = [];
  for (const [column, columnNodes] of [...byColumn.entries()].sort((a, b) => a[0] - b[0])) {
    columnNodes
      .sort((a, b) => a.es - b.es || a.name.localeCompare(b.name))
      .forEach((node, index) => {
        positioned.push({
          ...node,
          x: PADDING + column * (NODE_WIDTH + COLUMN_GAP) * scale,
          y: PADDING + index * (NODE_HEIGHT + ROW_GAP) * scale,
        });
      });
  }
  return positioned;
}

export function PertDiagram({
  nodes,
  dependencies,
  criticalPath,
  totalVariance,
  standardDeviation,
}: PertDiagramProps) {
  const [scale, setScale] = useState(1);

  const positioned = useMemo(() => layout(nodes, scale), [nodes, scale]);
  const positionById = new Map(positioned.map((node) => [node.id, node]));
  const width = useMemo(
    () => Math.max(...positioned.map((node) => node.x + NODE_WIDTH * scale), 320) + PADDING,
    [positioned, scale],
  );
  const height = useMemo(
    () => Math.max(...positioned.map((node) => node.y + NODE_HEIGHT * scale), 160) + PADDING,
    [positioned, scale],
  );
  const criticalIds = new Set(criticalPath);

  if (nodes.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-body-sm text-ink-3">
        Diagram PERT muncul setelah proyek punya tugas daun.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
        <p className="text-body-sm text-ink-3">
          Node kritis berwarna merah. Total variansi jalur kritis{' '}
          <span className="tabular font-semibold text-ink-2">{totalVariance.toFixed(2)}</span>, simpangan
          baku <span className="tabular font-semibold text-ink-2">{standardDeviation.toFixed(2)}</span> hari.
        </p>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="secondary"
            icon={<Minus aria-hidden className="size-4" />}
            onClick={() => setScale((current) => Math.max(0.6, Number((current - 0.2).toFixed(2))))}
            aria-label="Perkecil diagram"
          >
            Perkecil
          </Button>
          <span className="tabular w-12 text-center text-body-sm text-ink-3">
            {Math.round(scale * 100)}%
          </span>
          <Button
            size="sm"
            variant="secondary"
            icon={<Plus aria-hidden className="size-4" />}
            onClick={() => setScale((current) => Math.min(1.8, Number((current + 0.2).toFixed(2))))}
            aria-label="Perbesar diagram"
          >
            Perbesar
          </Button>
        </div>
      </div>

      <div className="max-h-[560px] overflow-auto px-5 pb-5">
        <svg
          width={width}
          height={height}
          role="group"
          aria-label="Diagram jaringan PERT"
          data-testid="pert-diagram"
        >
          <defs>
            <marker
              id="pert-arrow-head"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
              className="text-ink-3"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
            <marker
              id="pert-arrow-head-critical"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
              className="text-danger"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
            </marker>
          </defs>

          {dependencies.map((dependency) => {
            const from = positionById.get(dependency.predecessorId);
            const to = positionById.get(dependency.successorId);
            if (!from || !to) return null;
            const isCritical = criticalIds.has(from.id) && criticalIds.has(to.id);
            const startX = from.x + NODE_WIDTH * scale;
            const startY = from.y + (NODE_HEIGHT / 2) * scale;
            const endX = to.x - 4;
            const endY = to.y + (NODE_HEIGHT / 2) * scale;
            const elbowX = Math.max(startX + 16, endX - 24);
            return (
              <path
                key={dependency.id}
                data-testid="pert-edge"
                data-critical={isCritical ? 'true' : 'false'}
                d={`M ${startX} ${startY} H ${elbowX} V ${endY} H ${endX}`}
                fill="none"
                strokeWidth={isCritical ? 2 : 1.5}
                markerEnd={
                  isCritical ? 'url(#pert-arrow-head-critical)' : 'url(#pert-arrow-head)'
                }
                className={isCritical ? 'stroke-danger' : 'stroke-ink-3'}
                opacity={isCritical ? 1 : 0.8}
              />
            );
          })}

          {positioned.map((node) => {
            const isCritical = node.critical;
            return (
              <g
                key={node.id}
                data-testid="pert-node"
                data-task-id={node.id}
                data-critical={isCritical ? 'true' : 'false'}
                transform={`translate(${node.x} ${node.y})`}
              >
                <rect
                  width={NODE_WIDTH * scale}
                  height={NODE_HEIGHT * scale}
                  rx={8}
                  strokeWidth={isCritical ? 2 : 1}
                  className={
                    isCritical
                      ? 'fill-danger-bg stroke-danger'
                      : 'fill-surface stroke-line-strong'
                  }
                />
                <text
                  x={12 * scale}
                  y={20 * scale}
                  className={`text-body-sm font-semibold ${isCritical ? 'fill-danger' : 'fill-ink'}`}
                >
                  {node.name.length > 24 ? `${node.name.slice(0, 23)}…` : node.name}
                </text>
                <text x={12 * scale} y={40 * scale} className="tabular fill-ink-2 text-caption">
                  Durasi {node.durationDays} hari · ES {node.es} · EF {node.ef}
                </text>
                <text x={12 * scale} y={56 * scale} className="tabular fill-ink-2 text-caption">
                  LS {node.ls} · LF {node.lf} · Slack {node.slack}
                </text>
                {node.expectedDays !== null ? (
                  <text x={12 * scale} y={74 * scale} className="tabular fill-brand-700 text-caption">
                    te {node.expectedDays.toFixed(2)} hari · variansi {node.variance?.toFixed(2)}
                  </text>
                ) : (
                  <text x={12 * scale} y={74 * scale} className="fill-ink-3 text-caption">
                    Tanpa estimasi optimistis/pesimistis
                  </text>
                )}
                {isCritical ? (
                  <text x={12 * scale} y={92 * scale} className="fill-danger text-caption font-semibold">
                    Jalur kritis
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
