import type { Config } from 'tailwindcss';
import { SHADOW, TYPE } from './src/ui/play/tokens';

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        paper: token('paper'),
        card: token('card'),
        ink: token('ink'),
        soft: token('soft'),
        line: token('line'),
        stamp: token('stamp'),
        teal: token('teal'),
        amber: token('amber'),
        good: token('good'),
        spot: token('spot'),
        // Text on spotlight yellow: always stage blue, in light and dark (D-104).
        onspot: token('onspot'),
        // V5 N2: Play's main action colour (studio orange) and the text on it.
        action: token('action'),
        onaction: token('onaction'),
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      maxWidth: { page: '72rem' },
      // UI V3 (U1): Play's five type sizes and its shadows, from src/ui/play/tokens.ts.
      fontSize: Object.fromEntries(Object.entries(TYPE).map(([k, [px, lh]]) => [k, [`${px / 16}rem`, String(lh)]])),
      boxShadow: { podium: SHADOW.podium, stamp: SHADOW.stamp, gain: SHADOW.glowGain, hit: SHADOW.glowHit },
    },
  },
  plugins: [],
} satisfies Config;
