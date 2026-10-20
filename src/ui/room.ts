// Multiplayer client. Talks to the room server (server/) over one WebSocket and keeps what the
// server sends: the lobby, this seat's view, the screen timer and who has locked in. The server
// holds the only full game state; this client never sees more than its own view (D-65).
import { create } from 'zustand';
import type { Difficulty, LevelId, Mode, StructuredMessage, ValuesCard, ViewState } from '../engine/types';
import type { LobbySeat, RoomSettings, ServerMessage } from '../../server/src/protocol';
import { screenDecisionPhase } from '../shared/flow';
import { compareRules, currentRules } from '../engine/version';
import type { RulesVersion } from '../engine/types';

export const ROOM_SERVER: string | undefined =
  (import.meta.env.VITE_ROOM_SERVER_URL as string | undefined) || (import.meta.env.DEV ? 'http://127.0.0.1:8787' : undefined);

export type Connection = 'idle' | 'connecting' | 'open' | 'lost' | 'closed';

interface RoomStore {
  code: string | null;
  status: Connection;
  /** True once this tab has been connected; a later drop shows the "connection lost" banner. */
  wasOpen: boolean;
  /** Set for a few seconds after a dropped connection comes back. */
  restoredAt: number | null;
  yourSeat: string | null;
  seats: LobbySeat[];
  host: string | null;
  settings: RoomSettings | null;
  started: boolean;
  view: ViewState | null;
  deadline: number | null;
  /** Server clock minus this clock, in ms (for the countdown). */
  skew: number;
  lockedIn: string[];
  readyCount: number;
  /** The screen this tab pressed Ready on. */
  readyOn: string | null;
  /** First message id of the current talk, so the chat strip shows only this talk. */
  talkFrom: number | null;
  error: string | null;
  fatal: string | null;
  /** When this tab sent an action the server has not answered yet (cleared by the next STATE or ERROR). */
  pendingSince: number | null;
  /** A TopBar is on screen, so the "Thinking..." indicator sits there instead of floating. */
  topBar: boolean;
}

const initial: RoomStore = {
  code: null,
  status: 'idle',
  wasOpen: false,
  restoredAt: null,
  yourSeat: null,
  seats: [],
  host: null,
  settings: null,
  started: false,
  view: null,
  deadline: null,
  skew: 0,
  lockedIn: [],
  readyCount: 0,
  readyOn: null,
  talkFrom: null,
  error: null,
  fatal: null,
  pendingSince: null,
  topBar: false,
};

export const useRoom = create<RoomStore>(() => ({ ...initial }));

const tokenKey = (code: string) => `the-veil:room:${code}`;
export function savedToken(code: string): string | undefined {
  try {
    return localStorage.getItem(tokenKey(code)) ?? undefined;
  } catch {
    return undefined;
  }
}
function saveToken(code: string, token: string | null): void {
  try {
    if (token) localStorage.setItem(tokenKey(code), token);
    else localStorage.removeItem(tokenKey(code));
  } catch {
    // Storage unavailable: reconnecting after a reload will not reclaim the seat.
  }
}

export function screenKeyOf(v: ViewState): string {
  return `${v.levelIndex}:${v.phaseIdx}:${v.phase.kind}:${v.phase.step ?? ''}:${v.queue.length}`;
}

let ws: WebSocket | null = null;
let name = '';
let retry = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let leaving = false;
/** Dev and e2e only (see devtools.ts): hold off reconnecting until this time. */
let holdUntil = 0;

function wsUrl(code: string): string {
  return `${ROOM_SERVER!.replace(/^http/, 'ws').replace(/\/$/, '')}/rooms/${code}/ws`;
}

function send(m: object): void {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ v: 1, ...m }));
}

/** Send a game action and mark it as waiting for the server's answer. Returns false if one is already waiting. */
function sendAction(m: object): boolean {
  if (useRoom.getState().pendingSince !== null) return false;
  useRoom.setState({ pendingSince: Date.now() });
  send(m);
  return true;
}

/**
 * Dev and e2e only (D-83): pretend this page runs other rules. `send` replaces the rules sent in JOIN
 * (tests the server's check); `expect` replaces the rules this page compares the server's WELCOME with
 * (tests the page's check). Production builds never call it.
 */
let devRules: { send?: RulesVersion; expect?: RulesVersion } = {};
export function devSetRules(r: { send?: RulesVersion; expect?: RulesVersion }): void {
  devRules = r;
}

/** Dev and e2e only: hold every incoming message this long before handling it (a slow server). */
let devDelayMs = 0;
export function devDelayMessages(ms: number): void {
  devDelayMs = ms;
}

function onMessage(m: ServerMessage): void {
  const r = useRoom.getState();
  switch (m.type) {
    case 'WELCOME':
      // The server runs the engine and this page renders its views: both must use the same rules (D-75, D-83).
      // The server also checks the rules this page sends with JOIN; this covers a server built from other rules.
      if (compareRules(m.rules, devRules.expect ?? currentRules()) === 'different') {
        leaving = true;
        useRoom.setState({ fatal: 'VERSION_MISMATCH', status: 'closed' });
        ws?.close();
        return;
      }
      saveToken(m.code, m.token);
      useRoom.setState({ yourSeat: m.yourSeat, code: m.code, error: null });
      return;
    case 'LOBBY':
      useRoom.setState({ seats: m.seats, host: m.host, settings: m.settings, started: m.started });
      return;
    case 'STATE': {
      const prev = r.view;
      const key = screenKeyOf(m.view);
      let talkFrom = r.talkFrom;
      if (m.view.phase.kind === 'TALK' && (!prev || screenKeyOf(prev) !== key)) {
        // Like solo play: the strip shows messages from the moment this talk opened (bots post on entry).
        talkFrom = prev ? Math.max(0, ...prev.messages.map((x) => x.id)) + 1 : null;
      }
      const sameScreen = prev && screenKeyOf(prev) === key;
      useRoom.setState({
        view: m.view,
        yourSeat: m.yourSeat,
        deadline: m.deadline,
        skew: (m.serverNow ?? Date.now()) - Date.now(),
        lockedIn: m.lockedIn,
        readyCount: m.readyCount,
        readyOn: sameScreen ? r.readyOn : null,
        talkFrom,
        started: true,
        error: null,
        pendingSince: null,
      });
      return;
    }
    case 'ERROR':
      if (
        m.code === 'BAD_TOKEN' ||
        m.code === 'GAME_STARTED' ||
        m.code === 'ROOM_FULL' ||
        m.code === 'ROOM_CLOSED' ||
        m.code === 'VERSION_MISMATCH' ||
        m.code === 'CLOSED_BY_UPDATE'
      ) {
        if (m.code === 'BAD_TOKEN' && r.code) saveToken(r.code, null);
        leaving = true;
        useRoom.setState({ fatal: m.code, status: 'closed' });
        ws?.close();
        return;
      }
      useRoom.setState({ error: m.code, pendingSince: null });
      return;
  }
}

function open(code: string): void {
  clearTimeout(retryTimer);
  leaving = false;
  useRoom.setState({ status: useRoom.getState().wasOpen ? 'lost' : 'connecting', code });
  const sock = new WebSocket(wsUrl(code));
  ws = sock;
  sock.onopen = () => {
    retry = 0;
    const was = useRoom.getState().wasOpen;
    useRoom.setState({ status: 'open', wasOpen: true, restoredAt: was ? Date.now() : null });
    const token = savedToken(code);
    send({ type: 'JOIN', name, ...(token ? { token } : {}), rules: devRules.send ?? currentRules() });
  };
  sock.onmessage = (e) => {
    const handle = () => {
      try {
        onMessage(JSON.parse(e.data as string) as ServerMessage);
      } catch {
        // Ignore anything that is not a protocol message.
      }
    };
    if (devDelayMs > 0) setTimeout(handle, devDelayMs);
    else handle();
  };
  sock.onclose = () => {
    if (ws !== sock) return;
    ws = null;
    if (leaving) {
      useRoom.setState({ status: 'closed' });
      return;
    }
    if (!useRoom.getState().wasOpen && retry >= 3) {
      // Never got in: most likely no room has this code.
      useRoom.setState({ status: 'closed', fatal: 'UNREACHABLE' });
      return;
    }
    useRoom.setState({ status: useRoom.getState().wasOpen ? 'lost' : 'connecting' });
    // Back off: 0.5 s, 1 s, 2 s ... up to 10 s.
    const wait = Math.max(Math.min(10_000, 500 * 2 ** retry++), holdUntil - Date.now());
    retryTimer = setTimeout(() => open(code), wait);
  };
}

/** Create a room on the server and return its code. */
export async function createRoom(settings: { mode: Mode; level?: LevelId; difficulty: Difficulty }): Promise<string> {
  const r = await fetch(`${ROOM_SERVER!.replace(/\/$/, '')}/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (r.status !== 201) throw new Error(`create ${r.status}`);
  return ((await r.json()) as { code: string }).code;
}

export function joinRoom(code: string, playerName: string): void {
  ws?.close();
  ws = null;
  name = playerName;
  useRoom.setState({ ...initial });
  open(code.toUpperCase());
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('room', code.toUpperCase());
    window.history.replaceState(null, '', url);
  } catch {
    // Not in a browser.
  }
}

export function leaveRoom(): void {
  leaving = true;
  clearTimeout(retryTimer);
  const code = useRoom.getState().code;
  send({ type: 'LEAVE' });
  ws?.close();
  ws = null;
  if (code) saveToken(code, null);
  useRoom.setState({ ...initial });
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState(null, '', url);
  } catch {
    // Not in a browser.
  }
}

export function startRoomGame(settings: { mode: Mode; level?: LevelId; difficulty: Difficulty }): void {
  sendAction({ type: 'START', mode: settings.mode, difficulty: settings.difficulty, ...(settings.mode === 'SINGLE_LEVEL' ? { level: settings.level ?? 1 } : {}) });
}

export function sendRoomMessage(msg: StructuredMessage): void {
  sendAction({ type: 'SEND_MESSAGE', msg });
}

/** One tap of the main button, online: a decision, guesses, or Ready, depending on the screen. */
export function roomAct(decision?: unknown, guesses?: Record<string, ValuesCard>): void {
  const r = useRoom.getState();
  const v = r.view;
  if (!v) return;
  // A tap while an earlier action is still waiting for the server is ignored (no double taps).
  if (r.pendingSince !== null) return;
  if (v.phase.kind === 'GUESS') return void sendAction({ type: 'SUBMIT_GUESSES', guesses: guesses ?? {} });
  const dp = screenDecisionPhase(v, v.queue);
  const deciding = v.phase.kind === 'DECIDE' ? v.waitingOn.includes(v.viewer) : !!dp;
  if (dp && deciding) return void sendAction({ type: 'SUBMIT_DECISION', decision });
  if (v.phase.kind === 'DECIDE') return;
  if (sendAction({ type: 'READY' })) useRoom.setState({ readyOn: screenKeyOf(v) });
}

/** Dev and e2e only: drop the connection as a network failure would, and stay away for `ms`. */
export function devDropConnection(ms: number): void {
  holdUntil = Date.now() + ms;
  ws?.close();
}

/** Humans connected right now. */
export function connectedHumans(r: RoomStore = useRoom.getState()): number {
  return r.seats.filter((s) => s.connected).length;
}
