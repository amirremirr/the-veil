/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

/** The build's commit for the rules version (D-75): Vercel's variable, else local git, else 'unknown'. */
function commit(): string {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 12);
  try {
    return execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  base: './',
  plugins: [react()],
  define: { __RULES_COMMIT__: JSON.stringify(commit()) },
  test: {
    include: ['tests/engine/**/*.test.ts', 'tests/server/**/*.test.ts'],
    environment: 'node',
  },
});
