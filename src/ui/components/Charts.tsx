// Hand-written SVG charts. Each one has a text legend and an accessible summary.
import type { ReactNode } from 'react';

const SERIES_FILL = ['fill-ink', 'fill-teal', 'fill-amber', 'fill-stamp', 'fill-soft'];
const SERIES_STROKE = ['stroke-ink', 'stroke-teal', 'stroke-amber', 'stroke-stamp', 'stroke-soft'];
const SERIES_BG = ['bg-ink', 'bg-teal', 'bg-amber', 'bg-stamp', 'bg-soft'];

function Legend({ names, kinds }: { names: string[]; kinds?: Array<'bar' | 'line' | 'dash'> }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {names.map((n, i) => (
        <li key={n} className="flex items-center gap-1.5">
          {kinds?.[i] === 'dash' ? (
            <span className={`inline-block h-0 w-4 border-t-2 border-dashed ${SERIES_BG[i].replace('bg-', 'border-')}`} />
          ) : kinds?.[i] === 'line' ? (
            <span className={`inline-block h-0.5 w-4 ${SERIES_BG[i]}`} />
          ) : (
            <span className={`inline-block h-3 w-3 rounded-sm ${SERIES_BG[i]}`} />
          )}
          {n}
        </li>
      ))}
    </ul>
  );
}

export function ChartFrame({ title, children, summary }: { title: string; children: ReactNode; summary: string }) {
  return (
    <figure className="w-full">
      <figcaption className="label mb-2">{title}</figcaption>
      <div role="img" aria-label={summary}>
        {children}
      </div>
    </figure>
  );
}

/** Vertical grouped bars. */
export function GroupedBars({
  categories,
  series,
  format = (v) => v.toFixed(0),
}: {
  categories: string[];
  series: Array<{ name: string; values: number[] }>;
  format?: (v: number) => string;
}) {
  const W = 420;
  const H = 240;
  const pad = { l: 30, r: 4, t: 16, b: 56 };
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const gw = (W - pad.l - pad.r) / categories.length;
  const bw = Math.min(28, (gw - 12) / series.length);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const ticks = [0, max / 2, max];
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden>
        {ticks.map((tk) => (
          <g key={tk}>
            <line x1={pad.l} x2={W - pad.r} y1={y(tk)} y2={y(tk)} className="stroke-line" strokeDasharray="3 3" />
            <text x={pad.l - 4} y={y(tk) + 4} textAnchor="end" className="fill-soft font-mono text-[13px]">
              {format(tk)}
            </text>
          </g>
        ))}
        {categories.map((c, ci) => {
          const x0 = pad.l + ci * gw + (gw - bw * series.length) / 2;
          return (
            <g key={c}>
              {series.map((s, si) => {
                const v = s.values[ci];
                return (
                  <g key={s.name}>
                    <rect x={x0 + si * bw} y={y(Math.max(0, v))} width={bw - 2} height={Math.max(0, y(0) - y(Math.max(0, v)))} className={SERIES_FILL[si]} />
                    <text x={x0 + si * bw + (bw - 2) / 2} y={y(Math.max(0, v)) - 3} textAnchor="middle" className="fill-ink font-mono text-[12px]">
                      {format(v)}
                    </text>
                  </g>
                );
              })}
              <foreignObject x={pad.l + ci * gw} y={H - pad.b + 4} width={gw} height={pad.b - 4}>
                <div className="text-center text-[13px] leading-tight text-ink">{c}</div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
      <Legend names={series.map((s) => s.name)} />
    </>
  );
}

/** Horizontal stacked bars in HTML, so labels stay readable at any width. Negative parts extend left of zero. */
export function StackedBars({
  rows,
  partNames,
  format = (v) => v.toFixed(0),
}: {
  rows: Array<{ label: string; parts: number[]; highlight?: boolean }>;
  partNames: string[];
  format?: (v: number) => string;
}) {
  const pos = rows.map((r) => r.parts.filter((p) => p > 0).reduce((a, b) => a + b, 0));
  const neg = rows.map((r) => -r.parts.filter((p) => p < 0).reduce((a, b) => a + b, 0));
  const maxPos = Math.max(1e-9, ...pos);
  const maxNeg = Math.max(0, ...neg);
  const negShare = maxNeg / (maxNeg + maxPos);
  return (
    <>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.label}>
            <div className={`flex justify-between gap-2 text-xs ${r.highlight ? 'font-bold' : ''}`}>
              <span className="truncate">{r.label}</span>
              <span className="num">{format(r.parts.reduce((a, b) => a + b, 0))}</span>
            </div>
            <div className="mt-0.5 flex h-4 w-full">
              <div className="flex h-full justify-end" style={{ width: `${negShare * 100}%` }}>
                {r.parts.map((v, pi) =>
                  v < 0 ? <div key={pi} className={`h-full ${SERIES_BG[pi]}`} style={{ width: `${(-v / (maxNeg || 1)) * 100}%` }} /> : null,
                )}
              </div>
              <div className="h-full w-px bg-ink" />
              <div className="flex h-full" style={{ width: `${(1 - negShare) * 100}%` }}>
                {r.parts.map((v, pi) =>
                  v > 0 ? <div key={pi} className={`h-full ${SERIES_BG[pi]}`} style={{ width: `${(v / maxPos) * 100}%` }} /> : null,
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Legend names={partNames} />
    </>
  );
}

/** Line chart over discrete x positions. Null values break the line. */
export function LineChart({
  xLabels,
  series,
  yMin,
  yMax,
  format = (v) => v.toFixed(2),
  annotations,
  refLine,
  nullLabels,
}: {
  xLabels: string[];
  series: Array<{ name: string; values: Array<number | null>; dashed?: boolean }>;
  yMin?: number;
  yMax?: number;
  format?: (v: number) => string;
  annotations?: string[];
  refLine?: { value: number; label: string };
  /** Text drawn at missing values, per x index (defaults to an x mark). */
  nullLabels?: Array<string | null>;
}) {
  const W = 420;
  const H = 250;
  const pad = { l: 40, r: 12, t: 18, b: annotations ? 60 : 34 };
  const vals = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  if (refLine) vals.push(refLine.value);
  const lo = yMin ?? Math.min(0, ...vals);
  const hi = yMax ?? Math.max(1, ...vals) * 1.1;
  const x = (i: number) => pad.l + ((W - pad.l - pad.r) * i) / Math.max(1, xLabels.length - 1);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo || 1));
  const ticks = [lo, (lo + hi) / 2, hi];
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden>
        {ticks.map((tk) => (
          <g key={tk}>
            <line x1={pad.l} x2={W - pad.r} y1={y(tk)} y2={y(tk)} className="stroke-line" strokeDasharray="3 3" />
            <text x={pad.l - 4} y={y(tk) + 4} textAnchor="end" className="fill-soft font-mono text-[13px]">
              {format(tk)}
            </text>
          </g>
        ))}
        {refLine && (
          <g>
            <line x1={pad.l} x2={W - pad.r} y1={y(refLine.value)} y2={y(refLine.value)} className="stroke-stamp" strokeWidth="1.5" />
            <text x={W - pad.r} y={y(refLine.value) - 4} textAnchor="end" className="fill-stamp font-mono text-[13px]">
              {refLine.label}
            </text>
          </g>
        )}
        {xLabels.map((l, i) => (
          <text key={l + i} x={x(i)} y={H - pad.b + 16} textAnchor="middle" className="fill-ink font-mono text-[13px]">
            {l}
          </text>
        ))}
        {annotations?.map((a, i) => (
          <text key={`a${i}`} x={x(i)} y={H - pad.b + 36} textAnchor="middle" className="fill-soft text-[13px]">
            {a}
          </text>
        ))}
        {series.map((s, si) => {
          const segs: string[] = [];
          let cur = '';
          s.values.forEach((v, i) => {
            if (v === null) {
              if (cur) segs.push(cur);
              cur = '';
            } else cur += `${cur ? 'L' : 'M'}${x(i)},${y(v)}`;
          });
          if (cur) segs.push(cur);
          return (
            <g key={s.name}>
              {segs.map((d, k) => (
                <path key={k} d={d} fill="none" strokeWidth="2.5" className={SERIES_STROKE[si]} strokeDasharray={s.dashed ? '6 4' : undefined} />
              ))}
              {s.values.map((v, i) =>
                v === null ? (
                  <text key={i} x={x(i)} y={y(lo) - 4} textAnchor="middle" className="fill-stamp font-mono text-[13px]">
                    {nullLabels?.[i] ?? '×'}
                  </text>
                ) : (
                  <g key={i}>
                    <circle cx={x(i)} cy={y(v)} r="4" className={SERIES_FILL[si]} />
                    <text x={x(i)} y={y(v) - 8} textAnchor="middle" className="fill-ink font-mono text-[13px]">
                      {format(v)}
                    </text>
                  </g>
                ),
              )}
            </g>
          );
        })}
      </svg>
      <Legend names={series.map((s) => s.name)} kinds={series.map((s) => (s.dashed ? 'dash' : 'line'))} />
    </>
  );
}

/** Scatter with labels and a fitted line. */
export function Scatter({
  points,
  xLabel,
  yLabel,
  slope,
  format = (v) => v.toFixed(1),
}: {
  points: Array<{ x: number; y: number; label: string; highlight?: boolean }>;
  xLabel: string;
  yLabel: string;
  slope?: { m: number; b: number };
  format?: (v: number) => string;
}) {
  const W = 420;
  const H = 260;
  const pad = { l: 40, r: 70, t: 20, b: 44 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x0 = Math.min(...xs) - 0.5;
  const x1 = Math.max(...xs) + 0.5;
  const ext = Math.max(10, ...ys.map(Math.abs)) * 1.25;
  const x = (v: number) => pad.l + ((W - pad.l - pad.r) * (v - x0)) / (x1 - x0);
  const y = (v: number) => pad.t + ((H - pad.t - pad.b) * (ext - v)) / (2 * ext);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden>
      <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} className="stroke-ink" />
      {[-ext / 1.25, ext / 1.25].map((v) => (
        <text key={v} x={pad.l - 4} y={y(v) + 4} textAnchor="end" className="fill-soft font-mono text-[13px]">
          {format(v)}
        </text>
      ))}
      {[...new Set(xs)].map((v) => (
        <text key={v} x={x(v)} y={H - pad.b + 16} textAnchor="middle" className="fill-ink font-mono text-[13px]">
          {v}
        </text>
      ))}
      <text x={(W + pad.l) / 2} y={H - 6} textAnchor="middle" className="fill-soft text-[13px]">
        {xLabel}
      </text>
      <text x={12} y={H / 2} textAnchor="middle" transform={`rotate(-90 12 ${H / 2})`} className="fill-soft text-[13px]">
        {yLabel}
      </text>
      {slope && (
        <line x1={x(x0)} x2={x(x1)} y1={y(slope.m * x0 + slope.b)} y2={y(slope.m * x1 + slope.b)} className="stroke-stamp" strokeWidth="2" strokeDasharray="6 4" />
      )}
      {placeLabels(points.map((p) => ({ px: x(p.x), py: y(p.y) }))).map((ly, k) => {
        const p = points[k];
        return (
          <g key={p.label}>
            <circle cx={x(p.x)} cy={y(p.y)} r={p.highlight ? 7 : 5} className={p.highlight ? 'fill-stamp' : 'fill-ink'} />
            <text x={x(p.x) + 9} y={ly + 4} className={`fill-ink text-[13px] ${p.highlight ? 'font-bold' : ''}`}>
              {p.label} ({format(p.y)})
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Push labels down until they no longer overlap a label placed nearby. */
function placeLabels(pts: Array<{ px: number; py: number }>): number[] {
  const placed: Array<{ px: number; ly: number }> = [];
  return pts.map(({ px, py }) => {
    let ly = py;
    while (placed.some((q) => Math.abs(q.px - px) < 120 && Math.abs(q.ly - ly) < 13)) ly += 13;
    placed.push({ px, ly });
    return ly;
  });
}
