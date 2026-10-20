// One Durable Object per room. It is the only place the full GameState exists: clients send actions
// and receive only visibleState(state, theirSeat). The `from` of every action is the connection's
// seat; a client can never name a seat. Storage holds the setup (in the log's START_RUN), the action
// log, and small room records; the state is rebuilt by replaying the log when the object wakes up.
import { DurableObject } from 'cloudflare:workers';
import { reduce, replay, visibleState } from '../../src/engine/engine';
import { BOT_PROFILES } from '../../src/engine/params';
import { compareRules, currentRules } from '../../src/engine/version';
import type { RulesVersion } from '../../src/engine/types';
import type { GameState, LoggedAction, PlayerId, SetupConfig } from '../../src/engine/types';
import {
  lockedIn,
  newTable,
  pendingHumans,
  screenKey,
  screenKind,
  screenTimeoutMs,
  tableStep,
  type Held,
  type Table,
  type TableAction,
} from '../../src/shared/flow';
import {
  LIMITS,
  VERSION_MESSAGES,
  joinRulesError,
  parseClientMessage,
  type ClientMessage,
  type ErrorCode,
  type LobbySeat,
  type RoomSettings,
  type ServerMessage,
} from './protocol';

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  ALLOWED_ORIGINS: string;
  /** "1" under `wrangler dev`: enables the /stats and /reload measurement routes. */
  DEV?: string;
}

interface Seat {
  id: PlayerId;
  name: string;
  tokenHash: string;
  /** Decisions in a row the timeout rule made for this seat. */
  missed: number;
  /** Pressed Leave during the game: played by the timeout rule straight away until they rejoin. */
  left: boolean;
}

interface Meta {
  code: string;
  createdAt: number;
  lastActivity: number;
  host: PlayerId | null;
  settings: RoomSettings;
  started: boolean;
  /** Rules the game was started under (D-75). A log only replays the same under the same rules. */
  rules?: RulesVersion;
}

interface Flow {
  held: Record<PlayerId, Held>;
  ready: PlayerId[];
  deadline: number | null;
  /** The screen the deadline belongs to. */
  deadlineKey: string | null;
}

interface Attachment {
  seat: PlayerId | null;
}

const SEAT_IDS = ['p1', 'p2', 'p3', 'p4'];
const BOT_NAMES = Object.values(BOT_PROFILES).map((b) => b.name.toLowerCase());
/** After this many decisions in a row decided by the timeout rule, a disconnected seat is played at once. */
const AUTOPLAY_AFTER_MISSES = 2;

export class Room extends DurableObject<Env> {
  private sql: SqlStorage;
  private meta: Meta | null = null;
  private seats: Seat[] = [];
  private flow: Flow = { held: {}, ready: [], deadline: null, deadlineKey: null };
  private table: Table | null = null;
  /** Log entries already in storage. */
  private savedLog = 0;
  /** Recent message times per connection (rate limit). Lost on hibernation, which is harmless. */
  private rate = new Map<WebSocket, number[]>();
  private lastLobby = '';
  /**
   * Set when this room was closed because a deploy changed the rules it started under (D-83). Only this
   * marker is kept (24 hours), so anyone who comes back is told why instead of "no such room".
   */
  private closedByUpdate: number | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    ctx.blockConcurrencyWhile(async () => this.wake());
  }

  /** Load storage; a started room whose rules differ from this deploy's is closed with a marker (D-75, D-83). */
  private async wake(): Promise<void> {
    this.load();
    // A deploy that changed the rules would replay this room's log into a different game: close the room
    // instead of continuing it silently.
    if (this.meta?.started && compareRules(this.meta.rules) === 'different') await this.closeForUpdate();
    else if (this.meta?.started) this.rebuild();
  }

  // --- storage --------------------------------------------------------------------------------

  private load(): void {
    this.sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS log (i INTEGER PRIMARY KEY, a TEXT NOT NULL)');
    const kv = new Map<string, string>();
    for (const row of this.sql.exec<{ k: string; v: string }>('SELECT k, v FROM kv')) kv.set(row.k, row.v);
    this.closedByUpdate = kv.has('closedByUpdate') ? Number(kv.get('closedByUpdate')) : null;
    if (!kv.has('meta')) return;
    this.meta = JSON.parse(kv.get('meta')!);
    this.seats = JSON.parse(kv.get('seats') ?? '[]');
    this.flow = JSON.parse(kv.get('flow') ?? 'null') ?? this.flow;
  }

  /** Rebuild the full state by replaying the stored log (the engine is deterministic, so this is exact). */
  private rebuild(): void {
    const log: LoggedAction[] = [];
    for (const row of this.sql.exec<{ a: string }>('SELECT a FROM log ORDER BY i')) log.push(JSON.parse(row.a));
    this.savedLog = log.length;
    const game = replay(log);
    this.table = { game, held: this.flow.held, ready: this.flow.ready };
  }

  private save(): void {
    const put = (k: string, v: unknown) => this.sql.exec('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', k, JSON.stringify(v));
    put('meta', this.meta);
    put('seats', this.seats);
    if (this.table) {
      this.flow.held = this.table.held;
      this.flow.ready = this.table.ready;
      const log = this.table.game.log;
      for (let i = this.savedLog; i < log.length; i++) this.sql.exec('INSERT INTO log (i, a) VALUES (?, ?)', i, JSON.stringify(log[i]));
      this.savedLog = log.length;
    }
    put('flow', this.flow);
  }

  private async scheduleAlarm(): Promise<void> {
    if (!this.meta) return;
    const cleanup = this.meta.lastActivity + LIMITS.ROOM_TTL_MS;
    const next = Math.min(cleanup, this.flow.deadline ?? Infinity);
    await this.ctx.storage.setAlarm(next);
  }

  // --- HTTP (from the Worker) -----------------------------------------------------------------

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/init' && request.method === 'POST') {
      if (this.meta) return new Response('exists', { status: 409 });
      const { code, settings } = (await request.json()) as { code: string; settings: RoomSettings };
      // A new room under a code whose old room was closed by an update replaces the marker.
      if (this.closedByUpdate !== null) {
        this.sql.exec("DELETE FROM kv WHERE k = 'closedByUpdate'");
        this.closedByUpdate = null;
      }
      const now = Date.now();
      this.meta = { code, createdAt: now, lastActivity: now, host: null, settings, started: false };
      this.save();
      await this.scheduleAlarm();
      return new Response('created', { status: 201 });
    }
    if (url.pathname === '/ws') {
      // A room closed by an update still accepts the socket, so the first message can say why (D-83).
      if (!this.meta && this.closedByUpdate === null) return new Response('No such room', { status: 404 });
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      pair[1].serializeAttachment({ seat: null } satisfies Attachment);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    if (this.env.DEV === '1' && url.pathname === '/stats') return Response.json(this.stats());
    if (this.env.DEV === '1' && url.pathname === '/reload') {
      // Measurement only: rebuild from storage as a wake-up would.
      if (this.meta?.started) this.rebuild();
      return Response.json({ ok: true, logRows: this.savedLog });
    }
    if (this.env.DEV === '1' && url.pathname === '/outdate') {
      // Tests only: pretend this room started under other rules, then wake up as after a deploy (D-83).
      if (!this.meta?.started) return Response.json({ ok: false, reason: 'not started' }, { status: 409 });
      this.meta.rules = { rules: 'outdated', params: 'outdated', commit: 'outdated' };
      this.save();
      await this.wake();
      return Response.json({ ok: true, closedByUpdate: this.closedByUpdate !== null });
    }
    return new Response('Not found', { status: 404 });
  }

  private stats() {
    const one = <T>(q: string) => [...this.sql.exec<T & Record<string, SqlStorageValue>>(q)][0];
    const log = one<{ n: number; bytes: number }>('SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(a)), 0) AS bytes FROM log');
    const kv = one<{ bytes: number }>('SELECT COALESCE(SUM(LENGTH(v)), 0) AS bytes FROM kv');
    return {
      databaseSize: this.ctx.storage.sql.databaseSize,
      logRows: log?.n ?? 0,
      logBytes: log?.bytes ?? 0,
      kvBytes: kv?.bytes ?? 0,
      started: !!this.meta?.started,
      phase: this.table ? `${this.table.game.levelIndex}:${this.table.game.phase.kind}:${this.table.game.phase.step ?? ''}` : null,
    };
  }

  // --- WebSocket events -----------------------------------------------------------------------

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (!this.meta && this.closedByUpdate !== null) {
      this.send(ws, err('CLOSED_BY_UPDATE', VERSION_MESSAGES.CLOSED_BY_UPDATE));
      try {
        ws.close(4002, 'closed by update');
      } catch {
        // Already closed.
      }
      return;
    }
    if (!this.meta) return this.send(ws, err('ROOM_CLOSED', 'This room has closed.'));
    if (!this.allow(ws)) return this.send(ws, err('RATE_LIMITED', 'Too many messages. Slow down a little.'));
    const m = parseClientMessage(raw);
    if ('error' in m) return this.send(ws, err(m.error, m.error === 'TOO_LARGE' ? 'Message too large.' : 'Message not understood.'));
    const att = ws.deserializeAttachment() as Attachment;
    this.meta.lastActivity = Date.now();
    if (m.type === 'JOIN') return this.join(ws, m);
    if (!att.seat || !this.seats.some((s) => s.id === att.seat)) return this.send(ws, err('NOT_JOINED', 'Join the room first.'));
    const seat = att.seat;
    if (m.type === 'LEAVE') return this.leave(ws, seat);
    if (m.type === 'START') return this.start(ws, seat, m);
    if (!this.table) return this.send(ws, err('NOT_STARTED', 'The game has not started yet.'));
    // The server sets `from` from the connection's seat; nothing in the message can name a seat.
    let a: TableAction;
    if (m.type === 'SEND_MESSAGE') a = { type: 'SEND_MESSAGE', from: seat, msg: m.msg };
    else if (m.type === 'SUBMIT_DECISION') a = { type: 'DECIDE', from: seat, decision: m.decision };
    else if (m.type === 'SUBMIT_GUESSES') a = { type: 'GUESSES', from: seat, guesses: m.guesses };
    else a = { type: 'READY', from: seat };
    const next = tableStep(this.table, a, this.connected());
    if (!next) return this.send(ws, err('INVALID_ACTION', 'That move is not possible right now.'));
    if (a.type === 'DECIDE' || a.type === 'GUESSES') this.seatOf(seat)!.missed = 0;
    await this.commit(next);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.dropped(ws);
    try {
      ws.close(1000, 'closed');
    } catch {
      // Already closed.
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.dropped(ws);
  }

  async alarm(): Promise<void> {
    if (!this.meta) {
      // Only a closed-by-update marker is left; drop it after the usual room lifetime.
      if (this.closedByUpdate !== null && Date.now() >= this.closedByUpdate + LIMITS.ROOM_TTL_MS) {
        await this.ctx.storage.deleteAll();
        this.closedByUpdate = null;
      }
      return;
    }
    const now = Date.now();
    if (now >= this.meta.lastActivity + LIMITS.ROOM_TTL_MS) return this.close();
    if (this.table && this.flow.deadline !== null && now >= this.flow.deadline - 25) {
      for (const id of pendingHumans(this.table)) this.seatOf(id)!.missed++;
      const next = tableStep(this.table, { type: 'TIMEOUT' }, this.connected());
      this.flow.deadline = null;
      if (next) await this.commit(next);
      else this.save();
    }
    await this.scheduleAlarm();
  }

  // --- room actions ---------------------------------------------------------------------------

  private async join(ws: WebSocket, m: Extract<ClientMessage, { type: 'JOIN' }>): Promise<void> {
    const meta = this.meta!;
    // The page renders this server's views with its own engine, so both must run the same rules (D-83).
    const mismatch = joinRulesError(m.rules, currentRules());
    if (mismatch) return this.send(ws, err(mismatch, VERSION_MESSAGES[mismatch]));
    let seat: Seat | undefined;
    let token = m.token;
    if (token) {
      const hash = await sha256(token);
      seat = this.seats.find((s) => s.tokenHash === hash);
      if (!seat && meta.started) return this.send(ws, err('BAD_TOKEN', 'That seat could not be found.'));
    }
    if (!seat) {
      if (meta.started) return this.send(ws, err('GAME_STARTED', 'This game has already started.'));
      const free = SEAT_IDS.find((id) => !this.seats.some((s) => s.id === id));
      if (!free || this.seats.length >= LIMITS.MAX_HUMANS) return this.send(ws, err('ROOM_FULL', 'This room is full.'));
      token = randomToken();
      seat = { id: free, name: this.uniqueName(m.name, free), tokenHash: await sha256(token), missed: 0, left: false };
      this.seats.push(seat);
      this.seats.sort((a, b) => a.id.localeCompare(b.id));
    }
    // Reclaiming a seat: an older connection for it is closed, and the timeout rule stops playing it.
    for (const other of this.ctx.getWebSockets()) {
      if (other === ws) continue;
      if ((other.deserializeAttachment() as Attachment).seat === seat.id) {
        other.serializeAttachment({ seat: null } satisfies Attachment);
        try {
          other.close(4001, 'Seat opened in another window');
        } catch {
          // Already closed.
        }
      }
    }
    ws.serializeAttachment({ seat: seat.id } satisfies Attachment);
    seat.missed = 0;
    seat.left = false;
    if (!meta.host || !this.seats.some((s) => s.id === meta.host)) meta.host = seat.id;
    this.send(ws, { v: 1, type: 'WELCOME', code: meta.code, yourSeat: seat.id, token: token!, rules: currentRules() });
    this.armDeadline();
    this.save();
    await this.scheduleAlarm();
    this.broadcast(true);
  }

  private async start(ws: WebSocket, seat: PlayerId, m: Extract<ClientMessage, { type: 'START' }>): Promise<void> {
    const meta = this.meta!;
    if (meta.started) return this.send(ws, err('GAME_STARTED', 'The game has already started.'));
    if (meta.host !== seat) return this.send(ws, err('NOT_HOST', 'Only the host can start the game.'));
    // Seats whose window closed before the start are dropped; everyone at the table now plays.
    const here = this.connected();
    this.seats = this.seats.filter((s) => here.includes(s.id));
    const nPlayers = Math.max(m.nPlayers ?? 4, this.seats.length) as 2 | 3 | 4;
    if (nPlayers < 2) return this.send(ws, err('INVALID_ACTION', 'A game needs at least two seats.'));
    meta.settings = { mode: m.mode, level: m.level, difficulty: m.difficulty, nPlayers };
    const config: SetupConfig = {
      mode: m.mode,
      level: m.level,
      nPlayers,
      difficulty: m.difficulty,
      seed: `room-${meta.code}-${randomToken().slice(0, 12)}`,
      humans: this.seats.map((s) => ({ id: s.id, name: s.name })),
    };
    meta.started = true;
    meta.rules = currentRules();
    await this.commit(newTable(reduce(null as unknown as GameState, { type: 'START_RUN', config })));
  }

  private async leave(ws: WebSocket, seat: PlayerId): Promise<void> {
    const meta = this.meta!;
    ws.serializeAttachment({ seat: null } satisfies Attachment);
    if (!meta.started) this.seats = this.seats.filter((s) => s.id !== seat);
    else this.seatOf(seat)!.left = true;
    this.passHost(seat);
    try {
      ws.close(1000, 'left');
    } catch {
      // Already closed.
    }
    if (this.table) await this.commit(this.table);
    else {
      this.save();
      this.broadcast();
    }
  }

  private async dropped(ws: WebSocket): Promise<void> {
    this.rate.delete(ws);
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att?.seat || !this.meta) return;
    ws.serializeAttachment({ seat: null } satisfies Attachment);
    const seat = att.seat;
    if (this.connected().includes(seat)) return;
    this.passHost(seat);
    // An information screen may have been waiting only for this player.
    if (this.table && screenKind(this.table.game) === 'info') {
      const waiting = this.connected().filter((id) => !this.table!.ready.includes(id));
      if (this.connected().length && !waiting.length) {
        const next = tableStep(this.table, { type: 'TIMEOUT' }, this.connected());
        if (next) return this.commit(next);
      }
    }
    if (this.table) return this.commit(this.table);
    this.save();
    this.broadcast();
  }

  /** The host passes to the next connected human (seat order) when the host leaves or drops. */
  private passHost(gone: PlayerId): void {
    const meta = this.meta!;
    if (meta.host !== gone) return;
    const here = this.connected().filter((id) => id !== gone);
    const order = this.seats.map((s) => s.id);
    meta.host = order.find((id) => here.includes(id) && id > gone) ?? order.find((id) => here.includes(id)) ?? this.seats.find((s) => s.id !== gone)?.id ?? null;
  }

  /** After any change to the table: play seats the timeout rule has taken over, set the timer, store, send. */
  private async commit(t: Table): Promise<void> {
    const here = this.connected();
    for (let i = 0; i < 32; i++) {
      const auto = pendingHumans(t).find((id) => {
        const s = this.seatOf(id)!;
        return !here.includes(id) && (s.left || s.missed >= AUTOPLAY_AFTER_MISSES);
      });
      if (!auto) break;
      const next = tableStep(t, { type: 'AUTO', from: auto }, here);
      if (!next) break;
      t = next;
    }
    this.table = t;
    this.meta!.lastActivity = Date.now();
    this.armDeadline();
    this.save();
    await this.scheduleAlarm();
    this.broadcast();
  }

  /**
   * A new screen gets a fresh timer. With nobody connected the timer stops (a game never plays itself
   * out in an empty room); the first player back gets a fresh timer.
   */
  private armDeadline(): void {
    if (!this.table) return;
    const key = screenKey(this.table.game);
    const ms = screenTimeoutMs(this.table.game);
    if (ms === null || !this.connected().length) {
      this.flow.deadline = null;
      this.flow.deadlineKey = key;
      return;
    }
    if (key !== this.flow.deadlineKey || this.flow.deadline === null) {
      this.flow.deadlineKey = key;
      this.flow.deadline = Date.now() + ms;
    }
  }

  /**
   * Close a started room because this deploy runs other rules (D-83): tell connected players why, delete
   * the room, and keep only a marker so later visitors are told why too. The marker goes after 24 hours.
   */
  private async closeForUpdate(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      this.send(ws, err('CLOSED_BY_UPDATE', VERSION_MESSAGES.CLOSED_BY_UPDATE));
      try {
        ws.close(4002, 'closed by update');
      } catch {
        // Already closed.
      }
    }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.meta = null;
    this.seats = [];
    this.table = null;
    this.savedLog = 0;
    const now = Date.now();
    this.sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    this.sql.exec("INSERT OR REPLACE INTO kv (k, v) VALUES ('closedByUpdate', ?)", String(now));
    this.closedByUpdate = now;
    await this.ctx.storage.setAlarm(now + LIMITS.ROOM_TTL_MS);
  }

  private async close(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      this.send(ws, err('ROOM_CLOSED', 'This room has closed.'));
      try {
        ws.close(4000, 'room closed');
      } catch {
        // Already closed.
      }
    }
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    this.meta = null;
    this.seats = [];
    this.table = null;
    this.savedLog = 0;
  }

  // --- helpers --------------------------------------------------------------------------------

  private seatOf(id: PlayerId): Seat | undefined {
    return this.seats.find((s) => s.id === id);
  }

  /** Seats with an open connection. */
  private connected(): PlayerId[] {
    const out = new Set<PlayerId>();
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (att?.seat && ws.readyState === WebSocket.OPEN) out.add(att.seat);
    }
    return [...out];
  }

  private allow(ws: WebSocket): boolean {
    const now = Date.now();
    const times = (this.rate.get(ws) ?? []).filter((t) => now - t < 1000);
    if (times.length >= LIMITS.MESSAGES_PER_SECOND) return false;
    times.push(now);
    this.rate.set(ws, times);
    return true;
  }

  private uniqueName(name: string, seatId: PlayerId): string {
    let base = name.toLowerCase() === 'you' ? `Player ${seatId.slice(1)}` : name;
    const taken = (n: string) => BOT_NAMES.includes(n.toLowerCase()) || this.seats.some((s) => s.name.toLowerCase() === n.toLowerCase());
    if (!taken(base)) return base;
    for (let k = 2; k < 10; k++) {
      const suffix = ` ${k}`;
      base = [...base].slice(0, LIMITS.NAME_MAX - suffix.length).join('');
      if (!taken(base + suffix)) return base + suffix;
    }
    return `Player ${seatId.slice(1)}`;
  }

  private lobby(): ServerMessage {
    const here = this.connected();
    const seats: LobbySeat[] = this.seats.map((s) => ({ seat: s.id, name: s.name, connected: here.includes(s.id) }));
    const meta = this.meta!;
    return { v: 1, type: 'LOBBY', code: meta.code, seats, host: meta.host, settings: meta.settings, started: meta.started };
  }

  /** Send every joined connection its own view. The lobby is sent when it changed (or to everyone on a join). */
  private broadcast(withLobby = false): void {
    const lobby = this.lobby();
    const lobbyJson = JSON.stringify(lobby);
    const sendLobby = withLobby || lobbyJson !== this.lastLobby;
    this.lastLobby = lobbyJson;
    const t = this.table;
    const locked = t ? lockedIn(t) : [];
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as Attachment | null;
      if (!att?.seat) continue;
      if (sendLobby) this.send(ws, lobby);
      if (!t) continue;
      this.send(ws, {
        v: 1,
        type: 'STATE',
        view: visibleState(t.game, att.seat, { hideSeed: true }),
        yourSeat: att.seat,
        deadline: this.flow.deadline,
        lockedIn: locked,
        readyCount: t.ready.length,
        serverNow: Date.now(),
      });
    }
  }

  private send(ws: WebSocket, m: ServerMessage): void {
    try {
      ws.send(JSON.stringify(m));
    } catch {
      // The socket closed; webSocketClose cleans up.
    }
  }
}

function err(code: ErrorCode, message: string): ServerMessage {
  return { v: 1, type: 'ERROR', code, message };
}

function randomToken(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
