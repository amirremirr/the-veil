// UI V3 design tokens for Play mode (docs/UI_V3_SPEC.md U1). One place for the stage's colors, type
// scale, spacing, radii, shadows and durations. Tailwind reads the type scale and shadows from here
// (tailwind.config.ts), the cast and the stage read the rest. Colors that change with the theme stay CSS
// variables (src/index.css); the cast's own colors are fixed, since the Play stage is always dark.

/**
 * The five type sizes (px, line height). V5 N2 (D-211): Play is dark, so no text is under 16 px; "small" and
 * "body" are the same size and differ by weight and colour. Headlines are Fredoka, text Nunito (index.css).
 */
export const TYPE = {
  small: [16, 1.3],
  body: [16, 1.4],
  lead: [20, 1.2],
  title: [28, 1.1],
  hero: [40, 1.0],
} as const;

/** Spacing steps (px), Tailwind's 4 px grid: use 1, 2, 3, 4, 6 of it. */
export const SPACE = { xs: 4, s: 8, m: 12, l: 16, xl: 24 } as const;

/** Corner radii (px): chips, cards, tiles, pills. */
export const RADIUS = { chip: 12, card: 16, tile: 16, pill: 999 } as const;

/** Shadows: the podium's lift and a stamp's ink. */
export const SHADOW = {
  podium: '0 6px 0 rgb(0 0 0 / 0.35)',
  stamp: '0 2px 0 rgb(0 0 0 / 0.25)',
  glowGain: '0 0 28px rgb(255 210 63 / 0.55)',
  glowHit: '0 0 28px rgb(255 62 127 / 0.6)',
} as const;

/**
 * Durations (ms). UI V4 (V4): a reveal shows each item for at least revealStep (1.5 s), takes at most
 * REVEAL_MAX (6 s) in all, and a tap skips to the end. With more items than fit, it stages an even pick of
 * them (revealPick) and the end shows them all.
 */
export const DURATION = {
  tap: 120,
  bubbleGap: 300,
  stamp: 260,
  coinFly: 700,
  count: 650,
  hold: 1200,
  wheelMin: 2000,
  wheelMax: 3000,
  revealStep: 1500,
  REVEAL_MAX: 6000,
} as const;

/** UI V4 (V4): which of n items a reveal stages, so each gets 1.5 s and the whole takes at most 6 s. */
export function revealPick(n: number): number[] {
  const most = Math.floor(DURATION.REVEAL_MAX / DURATION.revealStep);
  if (n <= most) return Array.from({ length: n }, (_, i) => i);
  // An even spread that always ends on the last item.
  return Array.from({ length: most }, (_, i) => Math.round(((i + 1) * n) / most) - 1);
}

/** The cast's fixed colors, V5 N2 (D-211): the Retro TV studio palette, checked on the deep teal stage. */
export const CAST_COLORS = {
  ink: '#10242a',
  white: '#ffffff',
  lid: '#e9dcc4',
  cheek: '#ff8f8f',
  marigold: { petal: '#ff6f59', face: '#ffe2b8' },
  chet: { body: '#b9a6ff' },
  ugo: { body: '#f2862e', glasses: '#10242a' },
  dot: { body: '#8fd3c8', dots: '#1f6f66' },
  human: ['#ffc94a', '#ff9ec7', '#9be37a', '#7cc8ff', '#fff4e0', '#ffb067'],
  dash: { grille: '#fff4e0', mesh: '#b9a98a', handle: '#f2862e', band: '#ff6f59', tie: '#8fd3c8', cheek: '#ff8f8f' },
  sweat: '#7dd3fc',
} as const;
