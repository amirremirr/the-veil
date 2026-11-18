// UI V3 (U1): the cast as "shape people", drawn in code (no downloaded assets). V5 N2 (D-211): flat studio
// puppets in the Retro TV palette with big expressive eyes. Each contestant is its
// old motif with eyes, a mouth and two short legs: Marigold the flower, Chet the triangle, Ugo the square
// with glasses, Dot the dot grid. The human picks one of six shapes. No feature suggests ethnicity or
// gender. Six expressions each; Dash Fortuna, the microphone-headed host, has four.
import type { BotKey } from '../../engine/types';
import { CAST_COLORS as C } from './tokens';

export type Expr = 'neutral' | 'pleased' | 'smug' | 'shocked' | 'sad' | 'caught';
export const EXPRS: Expr[] = ['neutral', 'pleased', 'smug', 'shocked', 'sad', 'caught'];
export type DashExpr = 'neutral' | 'excited' | 'worried' | 'wink';

export const HUMAN_AVATARS = ['hex', 'round', 'diamond', 'pill', 'cloud', 'star'] as const;
export type HumanAvatar = (typeof HUMAN_AVATARS)[number];
export type CastKind = BotKey | HumanAvatar;

const AVATAR_KEY = 'veil.play.avatar';

/** The human's chosen shape (presentation only, remembered in this browser; defaults to the hexagon). */
export function myAvatar(): HumanAvatar {
  try {
    const x = localStorage.getItem(AVATAR_KEY) as HumanAvatar | null;
    return x && (HUMAN_AVATARS as readonly string[]).includes(x) ? x : 'hex';
  } catch {
    return 'hex';
  }
}
export function setMyAvatar(x: HumanAvatar): void {
  try {
    localStorage.setItem(AVATAR_KEY, x);
  } catch {
    // Storage blocked: the shape resets next time, which is harmless.
  }
}

/**
 * V5 N2 (D-211): the Retro TV studio puppet face. Big expressive eyes (a white eye with a large pupil and a
 * highlight), a thick mouth, brows and lids that carry the feeling, blush when pleased or smug.
 */
function Face({ expr, cx, cy, s = 1, wink = false }: { expr: Expr; cx: number; cy: number; s?: number; wink?: boolean }) {
  const ink = C.ink;
  const ex = 10.5 * s;
  const ey = cy - 4 * s;
  const my = cy + 11 * s;
  const sw = 2.8 * s;
  const parts: JSX.Element[] = [];
  /** One eye: white with an ink rim, a big pupil looking (dx, dy), a highlight; lid covers the top (0 to 1). */
  const eye = (x: number, o: { ry?: number; dx?: number; dy?: number; pr?: number; lid?: number; lidTilt?: number } = {}) => {
    const rx = 6.6 * s;
    const ry = (o.ry ?? 7.8) * s;
    const pr = (o.pr ?? 4.2) * s;
    const px = x + (o.dx ?? 0) * s;
    const py = ey + (o.dy ?? 0) * s + 0.8 * s;
    const lid = o.lid ?? 0;
    const tilt = (o.lidTilt ?? 0) * s;
    const top = ey - ry;
    const lidY = top + lid * 2 * ry;
    return (
      <g key={`e${x}`}>
        <ellipse cx={x} cy={ey} rx={rx} ry={ry} fill={C.white} stroke={ink} strokeWidth={1.8 * s} />
        <circle cx={px} cy={py} r={pr} fill={ink} />
        <circle cx={px - pr * 0.4} cy={py - pr * 0.45} r={pr * 0.36} fill={C.white} />
        {lid > 0 && (
          <path
            d={`M${x - rx - 1.2 * s} ${top - 2 * s} H${x + rx + 1.2 * s} V${lidY + tilt} L${x - rx - 1.2 * s} ${lidY - tilt} Z`}
            fill={C.lid}
            stroke={ink}
            strokeWidth={1.8 * s}
            strokeLinejoin="round"
          />
        )}
      </g>
    );
  };
  const happy = (x: number) => <path key={`h${x}`} d={`M${x - 6 * s} ${ey + 2 * s} Q${x} ${ey - 7 * s} ${x + 6 * s} ${ey + 2 * s}`} fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />;
  const brow = (d: string) => <path key={d} d={d} fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />;
  const blush = () => (
    <g key="blush" opacity={0.85}>
      <ellipse cx={cx - ex - 4 * s} cy={my - 2 * s} rx={4 * s} ry={2.6 * s} fill={C.cheek} />
      <ellipse cx={cx + ex + 4 * s} cy={my - 2 * s} rx={4 * s} ry={2.6 * s} fill={C.cheek} />
    </g>
  );
  let mouth: JSX.Element;
  switch (expr) {
    case 'pleased':
      parts.push(happy(cx - ex), happy(cx + ex), blush());
      mouth = <path d={`M${cx - 9 * s} ${my - 2 * s} Q${cx} ${my + 11 * s} ${cx + 9 * s} ${my - 2 * s} Z`} fill={ink} stroke={ink} strokeWidth={1.5 * s} strokeLinejoin="round" />;
      break;
    case 'smug':
      parts.push(eye(cx - ex, { dx: 2.2, dy: 0.5, lid: 0.45, lidTilt: 1.2 }), eye(cx + ex, { dx: 2.2, dy: 0.5, lid: 0.45, lidTilt: -1.2 }), blush());
      mouth = <path d={`M${cx - 8 * s} ${my + 1 * s} Q${cx + 2 * s} ${my + 6 * s} ${cx + 10 * s} ${my - 4 * s}`} fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />;
      break;
    case 'shocked':
      parts.push(eye(cx - ex, { ry: 9.4, pr: 2.6 }), eye(cx + ex, { ry: 9.4, pr: 2.6 }));
      parts.push(brow(`M${cx - ex - 6 * s} ${ey - 13 * s} Q${cx - ex} ${ey - 17 * s} ${cx - ex + 6 * s} ${ey - 13 * s}`), brow(`M${cx + ex - 6 * s} ${ey - 13 * s} Q${cx + ex} ${ey - 17 * s} ${cx + ex + 6 * s} ${ey - 13 * s}`));
      mouth = <ellipse cx={cx} cy={my + 2 * s} rx={4.6 * s} ry={6 * s} fill={ink} />;
      break;
    case 'sad':
      parts.push(eye(cx - ex, { dy: 2.2, lid: 0.35, lidTilt: -2.2 }), eye(cx + ex, { dy: 2.2, lid: 0.35, lidTilt: 2.2 }));
      parts.push(brow(`M${cx - ex - 6 * s} ${ey - 9 * s} L${cx - ex + 5 * s} ${ey - 13 * s}`), brow(`M${cx + ex + 6 * s} ${ey - 9 * s} L${cx + ex - 5 * s} ${ey - 13 * s}`));
      mouth = <path d={`M${cx - 8 * s} ${my + 5 * s} Q${cx} ${my - 3 * s} ${cx + 8 * s} ${my + 5 * s}`} fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />;
      break;
    case 'caught':
      parts.push(eye(cx - ex, { ry: 8.6, dx: 3.2, pr: 3.4 }), eye(cx + ex, { ry: 8.6, dx: 3.2, pr: 3.4 }));
      parts.push(<path key="sweat" d={`M${cx + ex + 11 * s} ${ey - 7 * s} q${3.5 * s} ${5.5 * s} 0 ${8 * s} q${-3.5 * s} ${-2.5 * s} 0 ${-8 * s}Z`} fill={C.sweat} stroke={ink} strokeWidth={1.2 * s} />);
      mouth = <path d={`M${cx - 9 * s} ${my + 1 * s} q${3 * s} ${-3.4 * s} ${6 * s} 0 t${6 * s} 0 t${6 * s} 0`} fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />;
      break;
    default:
      if (wink) parts.push(eye(cx - ex), happy(cx + ex), blush());
      else parts.push(eye(cx - ex), eye(cx + ex));
      mouth = wink ? (
        <path d={`M${cx - 9 * s} ${my - 1 * s} Q${cx} ${my + 9 * s} ${cx + 9 * s} ${my - 1 * s}`} fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />
      ) : (
        <path d={`M${cx - 6 * s} ${my} Q${cx} ${my + 4 * s} ${cx + 6 * s} ${my}`} fill="none" stroke={ink} strokeWidth={sw} strokeLinecap="round" />
      );
  }
  return (
    <g data-expr={expr}>
      {parts}
      {mouth}
    </g>
  );
}

const legs = (color: string) => (
  <g>
    <rect x="35" y="84" width="10" height="13" rx="5" fill={color} stroke={C.ink} strokeWidth="2" />
    <rect x="55" y="84" width="10" height="13" rx="5" fill={color} stroke={C.ink} strokeWidth="2" />
  </g>
);

function star(cx: number, cy: number, r1: number, r2: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 ? r2 : r1;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** The body of a character, its face on top. viewBox 0 0 100 100, feet on the floor at y 97. */
function Body({ kind, expr }: { kind: CastKind; expr: Expr }) {
  const st = { stroke: C.ink, strokeWidth: 3, strokeLinejoin: 'round' as const };
  switch (kind) {
    case 'marigold':
      return (
        <g>
          {legs(C.marigold.petal)}
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return <ellipse key={i} cx={50 + 27 * Math.cos(a)} cy={48 + 27 * Math.sin(a)} rx="13" ry="13" fill={C.marigold.petal} {...st} />;
          })}
          <circle cx="50" cy="48" r="26" fill={C.marigold.face} {...st} />
          <Face expr={expr} cx={50} cy={48} s={1.05} />
        </g>
      );
    case 'chet':
      return (
        <g>
          {legs(C.chet.body)}
          <path d="M50 6 Q54 6 56 10 L90 80 Q92 86 86 86 H14 Q8 86 10 80 L44 10 Q46 6 50 6Z" fill={C.chet.body} {...st} />
          <Face expr={expr} cx={50} cy={60} s={1.05} />
        </g>
      );
    case 'ugo':
      return (
        <g>
          {legs(C.ugo.body)}
          <rect x="14" y="14" width="72" height="72" rx="10" fill={C.ugo.body} {...st} />
          <Face expr={expr} cx={50} cy={50} s={1.15} />
          <g fill="none" stroke={C.ugo.glasses} strokeWidth="2.6">
            <circle cx="38.5" cy="45.4" r="9.5" />
            <circle cx="61.5" cy="45.4" r="9.5" />
            <path d="M48 45h4" />
          </g>
        </g>
      );
    case 'dot':
      return (
        <g>
          {legs(C.dot.body)}
          <rect x="14" y="14" width="72" height="72" rx="24" fill={C.dot.body} {...st} />
          {[24, 37, 50, 63, 76].map((x) => (
            <circle key={x} cx={x} cy="23" r="3.2" fill={C.dot.dots} />
          ))}
          {[24, 76].flatMap((x) => [36, 49, 62].map((y) => <circle key={`${x}${y}`} cx={x} cy={y} r="3.2" fill={C.dot.dots} />))}
          <Face expr={expr} cx={50} cy={54} s={1.05} />
        </g>
      );
    case 'hex':
      return (
        <g>
          {legs(C.human[0])}
          <path d="M50 8 L86 28 V68 L50 88 L14 68 V28Z" fill={C.human[0]} {...st} />
          <Face expr={expr} cx={50} cy={50} s={1.1} />
        </g>
      );
    case 'round':
      return (
        <g>
          {legs(C.human[1])}
          <circle cx="50" cy="48" r="38" fill={C.human[1]} {...st} />
          <Face expr={expr} cx={50} cy={48} s={1.15} />
        </g>
      );
    case 'diamond':
      return (
        <g>
          {legs(C.human[2])}
          <path d="M50 6 L90 48 L50 90 L10 48Z" fill={C.human[2]} {...st} />
          <Face expr={expr} cx={50} cy={50} s={1.0} />
        </g>
      );
    case 'pill':
      return (
        <g>
          {legs(C.human[3])}
          <rect x="24" y="6" width="52" height="82" rx="26" fill={C.human[3]} {...st} />
          <Face expr={expr} cx={50} cy={44} s={1.0} />
        </g>
      );
    case 'cloud':
      return (
        <g>
          {legs(C.human[4])}
          <path d="M26 84 Q8 84 10 66 Q4 50 20 42 Q20 18 44 20 Q58 6 72 22 Q94 24 88 48 Q98 64 84 76 Q82 86 70 84Z" fill={C.human[4]} {...st} />
          <Face expr={expr} cx={50} cy={52} s={1.1} />
        </g>
      );
    case 'star':
    default:
      return (
        <g>
          {legs(C.human[5])}
          <polygon points={star(50, 50, 44, 24)} fill={C.human[5]} {...st} />
          <Face expr={expr} cx={50} cy={54} s={0.95} />
        </g>
      );
  }
}

/** One character, `size` px tall. */
export function ShapePerson({ kind, expr = 'neutral', size = 72, label }: { kind: CastKind; expr?: Expr; size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} data-cast={kind} data-expr={expr} style={{ overflow: 'visible' }}>
      <Body kind={kind} expr={expr} />
    </svg>
  );
}

/** Dash Fortuna: a microphone for a head, a bow tie, four expressions. */
export function DashHost({ expr = 'neutral', size = 64 }: { expr?: DashExpr; size?: number }) {
  const D = C.dash;
  const face: Expr = expr === 'excited' ? 'pleased' : expr === 'worried' ? 'caught' : 'neutral';
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden data-dash={expr} style={{ overflow: 'visible' }}>
      <path d="M38 62 L62 62 L57 97 H43Z" fill={D.handle} stroke={C.ink} strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="34" y="58" width="32" height="9" rx="3" fill={D.band} stroke={C.ink} strokeWidth="2" />
      <path d="M50 76 L38 70 V84Z M50 76 L62 70 V84Z" fill={D.tie} stroke={C.ink} strokeWidth="2" strokeLinejoin="round" />
      <circle cx="50" cy="32" r="29" fill={D.grille} stroke={C.ink} strokeWidth="2.5" />
      <g stroke={D.mesh} strokeWidth="1.2" opacity="0.7">
        {[14, 22, 30, 38, 46].map((y) => (
          <path key={y} d={`M${50 - Math.sqrt(Math.max(0, 27 * 27 - (y - 32) ** 2))} ${y} H${50 + Math.sqrt(Math.max(0, 27 * 27 - (y - 32) ** 2))}`} />
        ))}
      </g>
      <circle cx="31" cy="40" r="4.5" fill={D.cheek} opacity="0.8" />
      <circle cx="69" cy="40" r="4.5" fill={D.cheek} opacity="0.8" />
      <path d="M36 5 Q50 -4 64 5" fill="none" stroke={D.band} strokeWidth="4" strokeLinecap="round" />
      {expr === 'excited' && <path d="M84 8 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3Z" fill={D.band} stroke={C.ink} strokeWidth="1.2" />}
      <Face expr={face} cx={50} cy={32} s={1.05} wink={expr === 'wink'} />
    </svg>
  );
}
