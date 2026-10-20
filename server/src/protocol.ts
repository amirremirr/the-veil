// Room protocol, version 1 (JSON over a WebSocket). Every client message is checked here for shape
// and size before the room looks at it; anything else is rejected. No DOM, no Worker APIs, so the
// root test suite can import it.
import type { Difficulty, LevelId, Mode, RulesVersion, StructuredMessage, ValuesCard, ViewState } from '../../src/engine/types';
import { compareRules } from '../../src/engine/version';

export const PROTOCOL_VERSION = 1;

export const LIMITS = {
  /** Largest client message, in bytes. */
  MESSAGE_BYTES: 4096,
  /** Client messages per second per connection. */
  MESSAGES_PER_SECOND: 5,
  NAME_MIN: 1,
  NAME_MAX: 20,
  MAX_HUMANS: 4,
  /** A room's storage is deleted this long after its last activity. */
  ROOM_TTL_MS: 24 * 60 * 60 * 1000,
} as const;

/** Room codes: four letters, without the easily confused I, L and O (and no digits at all). */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{4}$`);
export const TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;

export interface RoomSettings {
  mode: Mode;
  level?: LevelId;
  difficulty: Difficulty;
  /** Seats at the table, humans plus bots (2 to 4). Default 4. */
  nPlayers: 2 | 3 | 4;
}

export type ClientMessage =
  /** `rules`: the page's engine rules (D-83). The server refuses a JOIN whose rules differ from its own. */
  | { v: 1; type: 'JOIN'; name: string; token?: string; rules?: RulesVersion }
  | { v: 1; type: 'START'; mode: Mode; level?: LevelId; difficulty: Difficulty; nPlayers?: 2 | 3 | 4 }
  | { v: 1; type: 'SEND_MESSAGE'; msg: StructuredMessage }
  | { v: 1; type: 'SUBMIT_DECISION'; decision: unknown }
  | { v: 1; type: 'SUBMIT_GUESSES'; guesses: Record<string, ValuesCard> }
  | { v: 1; type: 'READY' }
  | { v: 1; type: 'LEAVE' };

export interface LobbySeat {
  seat: string;
  name: string;
  connected: boolean;
}

export type ServerMessage =
  /** `rules`: the server's engine rules (D-75), so a client built from other rules can refuse to play. */
  | { v: 1; type: 'WELCOME'; code: string; yourSeat: string; token: string; rules?: RulesVersion }
  | { v: 1; type: 'LOBBY'; code: string; seats: LobbySeat[]; host: string | null; settings: RoomSettings; started: boolean }
  | {
      v: 1;
      type: 'STATE';
      view: ViewState;
      yourSeat: string;
      /** When the current screen's timer runs out (ms since epoch), or null when there is no timer. */
      deadline: number | null;
      /** Seats that have locked in on this screen (never what they chose). */
      lockedIn: string[];
      /** How many humans pressed Ready on this screen. */
      readyCount: number;
      /** The server's clock when this was sent, so clients can correct the countdown for clock skew. */
      serverNow: number;
    }
  | { v: 1; type: 'ERROR'; code: ErrorCode; message: string };

export type ErrorCode =
  | 'BAD_MESSAGE'
  | 'TOO_LARGE'
  | 'RATE_LIMITED'
  | 'NOT_JOINED'
  | 'BAD_TOKEN'
  | 'ROOM_FULL'
  | 'GAME_STARTED'
  | 'NOT_HOST'
  | 'NOT_STARTED'
  | 'INVALID_ACTION'
  | 'ROOM_CLOSED'
  /** The page and the server run different game rules (D-83). */
  | 'VERSION_MISMATCH'
  /** The room was closed because a deploy changed the rules it started under (D-83). */
  | 'CLOSED_BY_UPDATE';

const MODES: Mode[] = ['FULL_RUN', 'SINGLE_LEVEL'];
const DIFFICULTIES: Difficulty[] = ['EASY', 'NORMAL', 'HARD'];
const CARDS: ValuesCard[] = ['EGOIST', 'RAWLSIAN', 'UTILITARIAN', 'MERITOCRAT'];
const SHORT = /^[A-Za-z0-9_]{1,20}$/;

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const HASH = /^[A-Za-z0-9._-]{1,64}$/;

/** A rules version as sent by a client: three short strings, nothing else (D-83). */
function rulesVersion(x: unknown): RulesVersion | null {
  if (!isObj(x) || !Object.keys(x).every((k) => ['rules', 'params', 'commit'].includes(k))) return null;
  const { rules, params, commit } = x;
  return typeof rules === 'string' && HASH.test(rules) && typeof params === 'string' && HASH.test(params) && typeof commit === 'string' && HASH.test(commit)
    ? { rules, params, commit }
    : null;
}

/**
 * The server's answer to a JOIN's rules (D-83): null to let it in, or VERSION_MISMATCH when the page runs
 * other rules or parameters, or sent none (a page built before D-83). A different commit alone is fine.
 */
export function joinRulesError(client: RulesVersion | undefined, server: RulesVersion): 'VERSION_MISMATCH' | null {
  return compareRules(client, server) === 'different' ? 'VERSION_MISMATCH' : null;
}

/** What players see for the version errors (the client shows its own copy of the same text). */
export const VERSION_MESSAGES = {
  VERSION_MISMATCH: 'The game was updated. Reload the page to play.',
  CLOSED_BY_UPDATE: 'This room closed because the game was updated.',
} as const;
const onlyKeys = (o: Record<string, unknown>, keys: string[]) => Object.keys(o).every((k) => keys.includes(k));

/** Strip control characters (C0, DEL, C1, and bidi/format controls), collapse spaces, trim. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 200) return null;
  // eslint-disable-next-line no-control-regex
  const s = raw.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/g, '').replace(/\s+/g, ' ').trim();
  const len = [...s].length;
  return len >= LIMITS.NAME_MIN && len <= LIMITS.NAME_MAX ? s : null;
}

function structuredMessage(m: unknown): StructuredMessage | null {
  if (!isObj(m) || typeof m.type !== 'string') return null;
  switch (m.type) {
    case 'SUPPORT':
    case 'OPPOSE':
      return onlyKeys(m, ['type', 'option']) && typeof m.option === 'string' && SHORT.test(m.option) ? { type: m.type, option: m.option } : null;
    case 'PROMISE':
      return onlyKeys(m, ['type', 'action']) && typeof m.action === 'string' && SHORT.test(m.action) ? { type: 'PROMISE', action: m.action } : null;
    case 'CLAIM_VALUES':
      return onlyKeys(m, ['type', 'card']) && CARDS.includes(m.card as ValuesCard) ? { type: 'CLAIM_VALUES', card: m.card as ValuesCard } : null;
    case 'ACCUSE':
      return onlyKeys(m, ['type', 'target', 'card']) && typeof m.target === 'string' && SHORT.test(m.target) && CARDS.includes(m.card as ValuesCard)
        ? { type: 'ACCUSE', target: m.target, card: m.card as ValuesCard }
        : null;
    case 'FLAVOR':
      return onlyKeys(m, ['type']) ? { type: 'FLAVOR' } : null;
    default:
      return null;
  }
}

/** Plain JSON data of bounded depth (decisions are checked by the engine after this). */
function plainData(x: unknown, depth = 0): boolean {
  if (depth > 4) return false;
  if (x === null || typeof x === 'boolean' || typeof x === 'string') return typeof x !== 'string' || x.length <= 40;
  if (typeof x === 'number') return Number.isFinite(x);
  if (Array.isArray(x)) return x.length <= 8 && x.every((y) => plainData(y, depth + 1));
  if (isObj(x)) return Object.keys(x).length <= 8 && Object.entries(x).every(([k, v]) => k.length <= 20 && plainData(v, depth + 1));
  return false;
}

/** Parse and check one client message. Returns the message, or an error code. */
export function parseClientMessage(raw: string | ArrayBuffer): ClientMessage | { error: ErrorCode } {
  if (typeof raw !== 'string') return { error: 'BAD_MESSAGE' };
  if (raw.length > LIMITS.MESSAGE_BYTES || new TextEncoder().encode(raw).length > LIMITS.MESSAGE_BYTES) return { error: 'TOO_LARGE' };
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return { error: 'BAD_MESSAGE' };
  }
  if (!isObj(m) || m.v !== PROTOCOL_VERSION || typeof m.type !== 'string') return { error: 'BAD_MESSAGE' };
  const bad = { error: 'BAD_MESSAGE' as const };
  switch (m.type) {
    case 'JOIN': {
      if (!onlyKeys(m, ['v', 'type', 'name', 'token', 'rules'])) return bad;
      const name = cleanName(m.name);
      if (!name) return bad;
      if (m.token !== undefined && (typeof m.token !== 'string' || !TOKEN_RE.test(m.token))) return bad;
      const rules = m.rules === undefined ? undefined : rulesVersion(m.rules);
      if (rules === null) return bad;
      return { v: 1, type: 'JOIN', name, ...(m.token ? { token: m.token as string } : {}), ...(rules ? { rules } : {}) };
    }
    case 'START': {
      if (!onlyKeys(m, ['v', 'type', 'mode', 'level', 'difficulty', 'nPlayers'])) return bad;
      if (!MODES.includes(m.mode as Mode) || !DIFFICULTIES.includes(m.difficulty as Difficulty)) return bad;
      if (m.mode === 'SINGLE_LEVEL' && ![1, 2, 3, 4, 5].includes(m.level as number)) return bad;
      if (m.mode === 'FULL_RUN' && m.level !== undefined) return bad;
      if (m.nPlayers !== undefined && ![2, 3, 4].includes(m.nPlayers as number)) return bad;
      return {
        v: 1,
        type: 'START',
        mode: m.mode as Mode,
        difficulty: m.difficulty as Difficulty,
        ...(m.mode === 'SINGLE_LEVEL' ? { level: m.level as LevelId } : {}),
        ...(m.nPlayers !== undefined ? { nPlayers: m.nPlayers as 2 | 3 | 4 } : {}),
      };
    }
    case 'SEND_MESSAGE': {
      if (!onlyKeys(m, ['v', 'type', 'msg'])) return bad;
      const msg = structuredMessage(m.msg);
      return msg ? { v: 1, type: 'SEND_MESSAGE', msg } : bad;
    }
    case 'SUBMIT_DECISION': {
      if (!onlyKeys(m, ['v', 'type', 'decision']) || !('decision' in m) || !plainData(m.decision)) return bad;
      return { v: 1, type: 'SUBMIT_DECISION', decision: m.decision };
    }
    case 'SUBMIT_GUESSES': {
      if (!onlyKeys(m, ['v', 'type', 'guesses']) || !isObj(m.guesses)) return bad;
      const entries = Object.entries(m.guesses);
      if (entries.length > 3 || !entries.every(([k, c]) => SHORT.test(k) && CARDS.includes(c as ValuesCard))) return bad;
      return { v: 1, type: 'SUBMIT_GUESSES', guesses: Object.fromEntries(entries) as Record<string, ValuesCard> };
    }
    case 'READY':
    case 'LEAVE':
      return onlyKeys(m, ['v', 'type']) ? { v: 1, type: m.type } : bad;
    default:
      return bad;
  }
}

/** Allowed browser origins: the production site, this project's Vercel previews, and localhost. */
export function originAllowed(origin: string | null, patterns: string): boolean {
  if (!origin) return false;
  return patterns
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .some((p) => {
      const re = new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+')}$`);
      return re.test(origin);
    });
}

/** A random room code. `rand` returns a uniform integer in [0, n). */
export function makeCode(rand: (n: number) => number): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_ALPHABET[rand(CODE_ALPHABET.length)];
  return s;
}
