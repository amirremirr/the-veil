// UI V3 design tokens for Play mode (docs/UI_V3_SPEC.md U1). One place for the stage's colors, type
// scale, spacing, radii, shadows and durations. Tailwind reads the type scale and shadows from here
// (tailwind.config.ts), the cast and the stage read the rest. Colors that change with the theme stay CSS
// variables (src/index.css); the cast's own colors are fixed, since the Play stage is always dark.

/** The five type sizes (px, line height). Minimum body text is 14 px (U3). */
export const TYPE = {
  small: [14, 1.3],
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

/** Durations (ms). Every reveal is at most REVEAL_MAX and can be skipped with a tap. */
export const DURATION = {
  tap: 120,
  bubbleGap: 300,
  stamp: 260,
  coinFly: 700,
  count: 650,
  hold: 1200,
  wheelMin: 2000,
  wheelMax: 3000,
  revealStep: 700,
  REVEAL_MAX: 4000,
} as const;

/** The cast's fixed colors (contrast-checked on the stage's dark background). */
export const CAST_COLORS = {
  ink: '#120e24',
  white: '#ffffff',
  marigold: { petal: '#ff8a3d', face: '#ffd8a8' },
  chet: { body: '#f5a524' },
  ugo: { body: '#2dd4bf', glasses: '#120e24' },
  dot: { body: '#a5b4fc', dots: '#4338ca' },
  human: ['#38bdf8', '#fb7185', '#4ade80', '#e879f9', '#e2e8f0', '#fdba74'],
  dash: { grille: '#ffd23f', mesh: '#e08a00', handle: '#8b5cf6', band: '#ff3e7f', tie: '#2dd4bf', cheek: '#ff8fb1' },
  sweat: '#7dd3fc',
} as const;
