import type { Config } from 'tailwindcss';

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
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      maxWidth: { page: '72rem' },
    },
  },
  plugins: [],
} satisfies Config;
