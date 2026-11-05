// Playtest kit (RUNPLAN F1, D-166): off by default. With ?playtest=1 (or the menu toggle) a silent log is kept in
// memory and in this browser's storage, never sent anywhere. It holds only this player's own timings and
// choices, never another player's private cards. A results code is the log plus the survey, deflated and
// base64url-encoded, for the player to paste back by hand. ?playtest=results opens the results page.

const KEY = 'veil.playtest.on';
const LOG_KEY = 'veil.playtest.log';

export interface ScreenTime {
  /** "ep3:DECIDE:CHOICE" style key. */
  k: string;
  ms: number;
}

export interface PlaytestLog {
  v: 1;
  /** Seats, difficulty, challenge code, mode and episode. */
  cfg: { n: number; d: string; seed: string; mode: string; ep?: number };
  startedAt: number;
  firstDecisionMs: number | null;
  screens: ScreenTime[];
  menuTaps: number;
  backTaps: number;
  /** "Play again" tapped within 10 seconds of the summary appearing. */
  replayFast: boolean;
  summaryAt: number | null;
  /** The player's own choices, counted at the end. */
  acts: { lied: number; barred: number; gave: number; peeked: number };
  survey?: Survey;
}

export interface Survey {
  /** At most two free-text answers. */
  oneSentence?: string;
  why?: string;
  cared?: string;
  surprised?: string;
  changed?: string;
  again?: string;
  withWhom?: string;
  unclear?: string;
  missionChanged?: string;
}

function urlFlag(): string | null {
  try {
    return new URL(window.location.href).searchParams.get('playtest');
  } catch {
    return null;
  }
}

export function playtestOn(): boolean {
  if (urlFlag() === '1') return true;
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export const resultsPage = (): boolean => urlFlag() === 'results';

export function setPlaytest(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked */
  }
}

let log: PlaytestLog | null = null;
let current: { k: string; at: number } | null = null;

function save(): void {
  try {
    if (log) localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {
    /* storage blocked: the in-memory log still works */
  }
}

export function startLog(cfg: PlaytestLog['cfg']): void {
  if (!playtestOn()) return;
  log = { v: 1, cfg, startedAt: Date.now(), firstDecisionMs: null, screens: [], menuTaps: 0, backTaps: 0, replayFast: false, summaryAt: null, acts: { lied: 0, barred: 0, gave: 0, peeked: 0 } };
  current = null;
  save();
}

export function currentLog(): PlaytestLog | null {
  if (log) return log;
  try {
    const x = localStorage.getItem(LOG_KEY);
    return x ? (JSON.parse(x) as PlaytestLog) : null;
  } catch {
    return null;
  }
}

/** A new screen is showing: close the previous one's timer. */
export function onScreen(k: string, isSummary: boolean): void {
  if (!log) return;
  const now = Date.now();
  if (current && current.k !== k) log.screens.push({ k: current.k, ms: now - current.at });
  if (!current || current.k !== k) current = { k, at: now };
  if (isSummary && log.summaryAt === null) log.summaryAt = now;
  save();
}

export function onDecision(): void {
  if (!log || log.firstDecisionMs !== null) return;
  log.firstDecisionMs = Date.now() - log.startedAt;
  save();
}

export function onTap(kind: 'menu' | 'back' | 'again'): void {
  if (!log) return;
  if (kind === 'menu') log.menuTaps++;
  if (kind === 'back') log.backTaps++;
  if (kind === 'again' && log.summaryAt !== null && Date.now() - log.summaryAt <= 10_000) log.replayFast = true;
  save();
}

export function setActs(acts: PlaytestLog['acts']): void {
  if (!log) return;
  log.acts = acts;
  save();
}

export function setSurvey(s: Survey): void {
  if (!log) return;
  log.survey = s;
  save();
}

// ---------------------------------------------------------------------------------------------------------
// The results code: JSON, deflated, base64url. Short keys and capped text keep it near 600 characters.

const cap = (x: string | undefined, n: number) => (x ? x.slice(0, n) : undefined);

/** The compact record sent in a code (screens merged by key, text capped). */
export function compact(l: PlaytestLog): unknown {
  const byKey: Record<string, number> = {};
  for (const s of l.screens) byKey[s.k] = (byKey[s.k] ?? 0) + s.ms;
  const top = Object.entries(byKey)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k, ms]) => [k, Math.round(ms / 100) / 10]);
  const sv = l.survey ?? {};
  return {
    v: 1,
    c: l.cfg,
    f: l.firstDecisionMs === null ? null : Math.round(l.firstDecisionMs / 100) / 10,
    t: Math.round(l.screens.reduce((a, s) => a + s.ms, 0) / 1000),
    s: top,
    m: l.menuTaps,
    b: l.backTaps,
    r: l.replayFast ? 1 : 0,
    a: l.acts,
    q: { ...sv, oneSentence: cap(sv.oneSentence, 120), why: cap(sv.why, 120) },
  };
}

function toB64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes]).stream().pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeResults(record: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(record));
  return toB64url(await pipe(json, new CompressionStream('deflate-raw')));
}

export async function decodeResults(code: string): Promise<unknown> {
  const bytes = await pipe(fromB64url(code.trim()), new DecompressionStream('deflate-raw'));
  return JSON.parse(new TextDecoder().decode(bytes));
}
