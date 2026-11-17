// UI V4 (V5): the cast drawn three ways for the style previews. Every character stays an abstract shape (no
// skin, hair, gender or ethnicity cues) with a clear face. Shared geometry, three renderings: hand-cut paper
// (jittered edges, ink outline, soft shadow), a flat studio puppet (big expressive eyes), and a minimal line
// drawing whose personality is in its posture. Preview only: the game does not use this file.
import type { ReactNode } from 'react';

export type Kind = 'hex' | 'ugo' | 'marigold' | 'dot';
export type Expr = 'neutral' | 'pleased' | 'smug' | 'shocked' | 'sad' | 'caught';
export type Style = 'A' | 'B' | 'C';

/** A small seeded random stream, so the paper edges are the same on every render. */
function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A closed outline through points, with hand-cut jitter (A) or clean (B, C). */
function outline(pts: Array<[number, number]>, jitter: number, seed: number): string {
  const r = rand(seed);
  const j = pts.map(([x, y]) => [x + (r() - 0.5) * jitter, y + (r() - 0.5) * jitter] as [number, number]);
  return `M${j.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L')} Z`;
}

/** Points around a circle (many for a hand-cut circle, so the jitter shows as scissor wobble). */
function circlePts(cx: number, cy: number, r: number, n = 28): Array<[number, number]> {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
}

function polyPts(cx: number, cy: number, r: number, sides: number, rot = 0, perSide = 4): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < sides; i++) {
    const a0 = rot + (i / sides) * Math.PI * 2;
    const a1 = rot + ((i + 1) / sides) * Math.PI * 2;
    for (let k = 0; k < perSide; k++) {
      const t = k / perSide;
      out.push([cx + r * ((1 - t) * Math.cos(a0) + t * Math.cos(a1)), cy + r * ((1 - t) * Math.sin(a0) + t * Math.sin(a1))]);
    }
  }
  return out;
}

function roundRectPts(x: number, y: number, w: number, h: number, rr: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let k = 0; k <= 4; k++) {
      const a = a0 + (k / 4) * (Math.PI / 2);
      out.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
  };
  corner(x + w - rr, y + rr, -Math.PI / 2);
  out.push([x + w, y + h / 2]);
  corner(x + w - rr, y + h - rr, 0);
  out.push([x + w / 2, y + h]);
  corner(x + rr, y + h - rr, Math.PI / 2);
  out.push([x, y + h / 2]);
  corner(x + rr, y + rr, Math.PI);
  out.push([x + w / 2, y]);
  return out;
}

export type Palette = { ink: string; fills: Record<Kind | 'dash', string>; center: string; accent: string; cheek: string; white: string };

/** The face: eyes and a mouth for each expression, drawn for each style. */
function Face({ expr, cx, cy, s, style, p }: { expr: Expr; cx: number; cy: number; s: number; style: Style; p: Palette }) {
  const ink = p.ink;
  const ex = 9 * s;
  const ey = cy - 3 * s;
  const my = cy + 9 * s;
  const sw = style === 'C' ? 2 * s : 2.8 * s;
  const big = style === 'B';
  const eye = (x: number, dx = 0, dy = 0, squint = false): ReactNode =>
    big ? (
      <g key={`e${x}`}>
        <ellipse cx={x} cy={ey} rx={7 * s} ry={squint ? 3.4 * s : 8 * s} fill={p.white} stroke={ink} strokeWidth={2 * s} />
        {!squint && <circle cx={x + dx * s} cy={ey + dy * s + 1 * s} r={4.4 * s} fill={ink} />}
        {!squint && <circle cx={x + dx * s - 1.6 * s} cy={ey + dy * s - 1.4 * s} r={1.5 * s} fill={p.white} />}
      </g>
    ) : squint ? (
      <path key={`e${x}`} d={`M${x - 4 * s} ${ey} Q${x} ${ey - 4 * s} ${x + 4 * s} ${ey}`} fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />
    ) : style === 'C' ? (
      <circle key={`e${x}`} cx={x + dx * s} cy={ey + dy * s} r={2.2 * s} fill={ink} />
    ) : (
      <circle key={`e${x}`} cx={x + dx * s} cy={ey + dy * s} r={3 * s} fill={ink} />
    );
  const brow = (x: number, d: string): ReactNode => <path key={`b${x}${d}`} d={d} fill="none" stroke={ink} strokeWidth={sw * 0.8} strokeLinecap="round" />;
  const parts: ReactNode[] = [];
  let mouth: ReactNode;
  switch (expr) {
    case 'pleased':
      parts.push(eye(cx - ex, 0, 0, true), eye(cx + ex, 0, 0, true));
      mouth = <path d={`M${cx - 8 * s} ${my - 1 * s} Q${cx} ${my + 8 * s} ${cx + 8 * s} ${my - 1 * s}`} fill={style === 'B' ? ink : 'none'} stroke={ink} strokeWidth={sw} strokeLinecap="round" />;
      break;
    case 'smug':
      parts.push(eye(cx - ex, 2, 1), eye(cx + ex, 2, 1));
      parts.push(brow(cx - ex, `M${cx - ex - 5 * s} ${ey - 8 * s} L${cx - ex + 5 * s} ${ey - 10 * s}`), brow(cx + ex, `M${cx + ex - 5 * s} ${ey - 11 * s} L${cx + ex + 5 * s} ${ey - 8 * s}`));
      mouth = <path d={`M${cx - 7 * s} ${my + 1 * s} Q${cx + 2 * s} ${my + 5 * s} ${cx + 9 * s} ${my - 4 * s}`} fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />;
      break;
    case 'shocked':
      parts.push(eye(cx - ex, 0, -1), eye(cx + ex, 0, -1));
      parts.push(brow(cx - ex, `M${cx - ex - 5 * s} ${ey - 13 * s} Q${cx - ex} ${ey - 16 * s} ${cx - ex + 5 * s} ${ey - 13 * s}`), brow(cx + ex, `M${cx + ex - 5 * s} ${ey - 13 * s} Q${cx + ex} ${ey - 16 * s} ${cx + ex + 5 * s} ${ey - 13 * s}`));
      mouth = <ellipse cx={cx} cy={my + 2 * s} rx={4 * s} ry={5.5 * s} fill={style === 'C' ? 'none' : ink} stroke={ink} strokeWidth={sw} />;
      break;
    case 'sad':
      parts.push(eye(cx - ex, 0, 2), eye(cx + ex, 0, 2));
      parts.push(brow(cx - ex, `M${cx - ex - 5 * s} ${ey - 7 * s} L${cx - ex + 4 * s} ${ey - 11 * s}`), brow(cx + ex, `M${cx + ex + 5 * s} ${ey - 7 * s} L${cx + ex - 4 * s} ${ey - 11 * s}`));
      mouth = <path d={`M${cx - 7 * s} ${my + 4 * s} Q${cx} ${my - 3 * s} ${cx + 7 * s} ${my + 4 * s}`} fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />;
      break;
    case 'caught':
      parts.push(eye(cx - ex, 3, 0), eye(cx + ex, 3, 0));
      parts.push(<path key="sweat" d={`M${cx + ex + 10 * s} ${ey - 6 * s} q${3 * s} ${5 * s} 0 ${7 * s} q${-3 * s} ${-2 * s} 0 ${-7 * s}Z`} fill={style === 'C' ? 'none' : '#7cc4e8'} stroke={ink} strokeWidth={1.2 * s} />);
      mouth = <path d={`M${cx - 8 * s} ${my + 1 * s} q${2.7 * s} ${-3 * s} ${5.3 * s} 0 t${5.3 * s} 0 t${5.3 * s} 0`} fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />;
      break;
    default:
      parts.push(eye(cx - ex), eye(cx + ex));
      mouth = <path d={`M${cx - 6 * s} ${my} Q${cx} ${my + 3 * s} ${cx + 6 * s} ${my}`} fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />;
  }
  return (
    <g>
      {parts}
      {mouth}
      {style === 'B' && (expr === 'pleased' || expr === 'smug') && (
        <>
          <circle cx={cx - ex - 5 * s} cy={my - 1 * s} r={3 * s} fill={p.cheek} opacity={0.8} />
          <circle cx={cx + ex + 5 * s} cy={my - 1 * s} r={3 * s} fill={p.cheek} opacity={0.8} />
        </>
      )}
    </g>
  );
}

/** C's posture: the whole figure leans, sinks or jumps with the feeling (the line drawing has no detail). */
function posture(expr: Expr): string {
  switch (expr) {
    case 'smug':
      return 'rotate(-7 50 95)';
    case 'shocked':
      return 'translate(0 -6)';
    case 'sad':
      return 'translate(0 6) scale(1 0.94) rotate(4 50 95)';
    case 'caught':
      return 'rotate(9 50 95) translate(4 0)';
    case 'pleased':
      return 'rotate(-3 50 95) translate(0 -2)';
    default:
      return '';
  }
}

/** One body outline per contestant, as points (so each style can cut, fill or trace it). */
function bodyPts(kind: Kind | 'dash'): Array<Array<[number, number]>> {
  switch (kind) {
    case 'hex':
      return [polyPts(50, 52, 34, 6, Math.PI / 6, 5)];
    case 'ugo':
      return [roundRectPts(18, 20, 64, 64, 10)];
    case 'marigold':
      return [
        ...Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return circlePts(50 + 26 * Math.cos(a), 50 + 26 * Math.sin(a), 13, 14);
        }),
        circlePts(50, 50, 25, 30),
      ];
    case 'dot':
      return [roundRectPts(20, 18, 60, 68, 22)];
    case 'dash':
      return [circlePts(50, 36, 26, 30), roundRectPts(42, 60, 16, 30, 6)];
  }
}

/** A contestant (or Dash) in one of the three styles. */
export function Puppet({ kind, expr, size, style, p, label }: { kind: Kind | 'dash'; expr: Expr; size: number; style: Style; p: Palette; label?: string }) {
  const fill = p.fills[kind];
  const shapes = bodyPts(kind);
  const seed = { hex: 3, ugo: 7, marigold: 11, dot: 17, dash: 23 }[kind];
  const faceY = kind === 'dash' ? 36 : kind === 'marigold' ? 50 : 54;
  const faceS = kind === 'dash' ? 0.85 : 1;
  const extras: ReactNode[] = [];
  if (kind === 'ugo')
    extras.push(
      <g key="glasses" fill="none" stroke={p.ink} strokeWidth={style === 'C' ? 1.8 : 2.4}>
        <circle cx={41} cy={51} r={7.5} />
        <circle cx={59} cy={51} r={7.5} />
        <path d="M48.5 51 H51.5" />
      </g>,
    );
  if (kind === 'dot' && style !== 'C')
    extras.push(
      <g key="dots" fill={p.ink} opacity={0.35}>
        {[
          [30, 28],
          [70, 28],
          [26, 74],
          [74, 74],
          [50, 26],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={3} />
        ))}
      </g>,
    );
  if (kind === 'dash')
    extras.push(
      <g key="mic" fill="none" stroke={p.ink} strokeWidth={style === 'C' ? 1.4 : 1.8} opacity={style === 'C' ? 0.5 : 0.35}>
        <path d="M30 26 H70 M27 36 H73 M30 46 H70" />
      </g>,
    );
  const legs = kind !== 'dash' && (
    <g stroke={p.ink} strokeWidth={style === 'C' ? 2 : 3} strokeLinecap="round" fill="none">
      <path d={kind === 'hex' ? 'M40 84 L38 97 M60 84 L62 97' : 'M40 86 L39 97 M60 86 L61 97'} />
    </g>
  );
  const body =
    style === 'A' ? (
      <g>
        {/* Hand-cut paper: a soft shadow under each piece, then the piece with an uneven ink edge. */}
        {shapes.map((pts, i) => (
          <path key={`s${i}`} d={outline(pts, 2.6, seed + i)} fill="rgb(60 40 20 / 0.22)" transform="translate(2.5 3.5)" />
        ))}
        {shapes.map((pts, i) => (
          <path key={`b${i}`} d={outline(pts, 2.6, seed + i)} fill={kind === 'marigold' && i === shapes.length - 1 ? p.center : fill} stroke={p.ink} strokeWidth={2.2} strokeLinejoin="round" />
        ))}
      </g>
    ) : style === 'B' ? (
      <g>
        {shapes.map((pts, i) => (
          <path key={`b${i}`} d={outline(pts, 0, seed)} fill={kind === 'marigold' && i === shapes.length - 1 ? p.center : fill} stroke={p.ink} strokeWidth={3} strokeLinejoin="round" />
        ))}
      </g>
    ) : (
      <g>
        {shapes.map((pts, i) => (
          <path key={`b${i}`} d={outline(pts, 0, seed)} fill={kind === 'marigold' && i === shapes.length - 1 ? p.white : 'none'} stroke={p.ink} strokeWidth={2} strokeLinejoin="round" />
        ))}
        {/* Arms: a line drawing shows its feelings in its posture. */}
        <path d={expr === 'shocked' ? 'M18 52 L6 34 M82 52 L94 34' : expr === 'sad' ? 'M18 56 L10 72 M82 56 L90 72' : expr === 'smug' ? 'M18 56 L28 66 M82 56 L72 66' : 'M18 56 L8 64 M82 56 L92 64'} stroke={p.ink} strokeWidth={2} strokeLinecap="round" fill="none" />
      </g>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ overflow: 'visible', display: 'block' }}>
      <g transform={style === 'C' ? posture(expr) : undefined}>
        {legs}
        {body}
        {extras}
        <Face expr={expr} cx={50} cy={faceY} s={faceS} style={style} p={p} />
      </g>
    </svg>
  );
}
