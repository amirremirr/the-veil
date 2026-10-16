import type { GameState, RngState } from './types';

/** 32-bit string hash (cyrb53 folded to 32 bits). */
export function hashString(str: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

export function initRng(seed: string): RngState {
  return { game: hashString(`${seed}|game`), bots: hashString(`${seed}|bots`) };
}

/** One mulberry32 step. Returns [value in [0,1), next state]. */
function mulberry32(a: number): [number, number] {
  const next = (a + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

export interface Rng {
  next(): number;
  int(n: number): number;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: readonly T[]): T[];
  weighted(weights: readonly number[]): number;
}

function makeRng(read: () => number, write: (s: number) => void): Rng {
  const rng: Rng = {
    next() {
      const [v, s] = mulberry32(read());
      write(s);
      return v;
    },
    int(n) {
      return Math.floor(rng.next() * n);
    },
    pick(arr) {
      return arr[rng.int(arr.length)];
    },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    weighted(weights) {
      const total = weights.reduce((x, y) => x + y, 0);
      let r = rng.next() * total;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r < 0) return i;
      }
      return weights.length - 1;
    },
  };
  return rng;
}

/** A named stream bound to a (mutable, cloned) game state. */
export function stream(state: GameState, name: keyof RngState): Rng {
  return makeRng(
    () => state.rng[name],
    (s) => {
      state.rng[name] = s;
    },
  );
}

/** A standalone generator, used for flavor text and headless tools. */
export function standalone(seed: number): Rng {
  let s = seed >>> 0;
  return makeRng(
    () => s,
    (v) => {
      s = v;
    },
  );
}

/** Deterministic flavor index that consumes no stream. */
export function flavorIndex(seed: string, key: string, n: number): number {
  return n <= 0 ? 0 : hashString(`${seed}|${key}`) % n;
}
