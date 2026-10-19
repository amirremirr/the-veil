// Scripted clients against a local `wrangler dev` (see README, "Multiplayer"). Each client plays by
// the protocol only: it sees its own STATE views and sends decisions, messages and Ready.
// Usage: node scripts/loadtest.mjs [--humans 4] [--seats 4] [--mode FULL_RUN|SINGLE_LEVEL] [--level 1]
//        [--url http://127.0.0.1:8787] [--timeout-once] [--reconnect-once]
// Reports the time from each client message to the next STATE it receives (with everything local,
// this is the room's processing time for that message plus a little overhead), per screen, and the
// room's stored size at the end.
const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]] : null)).filter(Boolean),
);
const BASE = args.url ?? 'http://127.0.0.1:8787';
const HUMANS = Number(args.humans ?? 4);
const SEATS = Number(args.seats ?? 4);
const MODE = args.mode ?? 'FULL_RUN';
const LEVEL = args.level ? Number(args.level) : undefined;
const ORIGIN = 'http://localhost:5173';

const SCRIPT = {
  VOTE: ['P1', 'P2', 'P3', 'P4'],
  TAX: [0, 0.2, 0.4, 0.6],
  EFFORT: [3, 4, 5, 6],
  POLL: [20, 40, 60, 80],
  BONUS: [30, 50, 70, 40],
  CHOICE: [{ buy: true, gym: false }, { buy: false, gym: true }, { buy: true, gym: true }, { buy: false, gym: false }],
  REGIME: ['VOL', 'M50', 'M100', 'M50'],
  INVEST: [true, false, true, false],
  SCHEDULE: ['GREEDY', 'FLEX', 'GREEDY', 'FLEX'],
  POLICY: ['A', 'B', 'C', 'D'],
  VEIL: [{ t: 0.1, F: 25 }, { t: 0.3, F: 25 }, { t: 0.5, F: 40 }, { t: 0.7, F: 25 }],
  FAIR_1: [0.3, 0.3, 0.4, 0.2],
  FAIR_2: [0.1, 0.2, 0.3, 0.4],
};
const decisionFor = (step, k, v) => {
  if (step.startsWith('AMEND_')) return k % 2 === 0;
  if (step === 'LOBBY') {
    const other = v.players.find((p) => p.id !== v.viewer).id;
    return { donateTo: k % 2 ? other : null, amount: k % 2 ? 5 : 0, proposal: k === 2 ? null : { t: 0.2, F: 25 } };
  }
  return SCRIPT[step][k % 4];
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const samples = []; // { ms, label, type }

class Client {
  constructor(k, code) {
    this.k = k;
    this.code = code;
    this.name = `Tester ${k + 1}`;
    this.token = undefined;
    this.view = null;
    this.lastKey = '';
    this.acted = new Set();
    this.waiting = null; // { t0, label, type }
    this.idleOnce = false;
    this.ended = false;
  }
  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${BASE.replace('http', 'ws')}/rooms/${this.code}/ws`, { headers: { Origin: ORIGIN } });
      this.ws = ws;
      ws.onopen = () => {
        this.send({ v: 1, type: 'JOIN', name: this.name, ...(this.token ? { token: this.token } : {}) });
        resolve();
      };
      ws.onerror = (e) => reject(e);
      ws.onmessage = (e) => this.onMessage(JSON.parse(e.data));
      ws.onclose = () => (this.closed = true);
    });
  }
  send(m) {
    this.ws.send(JSON.stringify(m));
  }
  timed(m, label) {
    // One message in flight at a time, at most 4 a second (the room allows 5).
    this.queue = this.queue ?? [];
    this.queue.push({ m, label });
    this.pump();
  }
  pump() {
    if (this.busy || !this.queue?.length || this.closed) return;
    const { m, label } = this.queue.shift();
    this.busy = true;
    this.last = { m, label };
    this.waiting = { t0: performance.now(), label, type: m.type };
    this.send(m);
    setTimeout(() => {
      this.busy = false;
      this.pump();
    }, 250);
  }
  onMessage(m) {
    if (m.type === 'WELCOME') {
      this.token = m.token;
      this.seat = m.yourSeat;
    }
    if (m.type === 'LOBBY') this.lobby = m;
    if (m.type === 'ERROR') {
      if (this.waiting) this.waiting = null;
      if (m.code === 'RATE_LIMITED' && this.last) {
        this.queue.unshift(this.last);
        return;
      }
      if (m.code !== 'INVALID_ACTION') console.log(`client ${this.k}: ERROR ${m.code} ${m.message}`);
    }
    if (m.type !== 'STATE') return;
    if (this.waiting) {
      samples.push({ ms: performance.now() - this.waiting.t0, label: this.waiting.label, type: this.waiting.type });
      this.waiting = null;
    }
    this.view = m.view;
    this.locked = m.lockedIn;
    this.deadline = m.deadline;
    this.react();
  }
  react() {
    const v = this.view;
    if (!v || this.paused) return;
    if (v.phase.kind === 'END') {
      this.ended = true;
      return;
    }
    const key = `${v.levelIndex}:${v.phaseIdx}:${v.phase.kind}:${v.phase.step ?? ''}:${v.queue.length}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.acted = new Set();
      if (this.k === 0 && process.env.VERBOSE) console.log(`${new Date().toISOString().slice(11, 19)} ${key} waiting=${v.waitingOn} locked=${this.locked} deadline=${this.deadline ? Math.round((this.deadline - Date.now()) / 1000) + 's' : '-'}`);
    }
    const label = `L${v.levelIndex} ${v.phase.kind}${v.phase.step ? ':' + v.phase.step : ''}`;
    const next = v.queue[v.phaseIdx + 1];
    let step = null;
    if (v.phase.kind === 'DECIDE' && v.waitingOn.includes(v.viewer)) step = v.phase.step;
    else if (v.phase.kind === 'TALK') step = next?.step;
    else if (v.phase.kind === 'REVEAL' && next?.kind === 'DECIDE' && next.step === 'POLL') step = 'POLL';
    if (v.phase.kind === 'GUESS') {
      if (!v.waitingOn.includes(v.viewer) || this.acted.has('g')) return;
      this.acted.add('g');
      const guesses = Object.fromEntries(v.players.filter((p) => p.id !== v.viewer).map((p) => [p.id, 'EGOIST']));
      return this.later(() => this.timed({ v: 1, type: 'SUBMIT_GUESSES', guesses }, label));
    }
    if (step) {
      if (this.locked?.includes(v.viewer) || this.acted.has('d')) return;
      if (this.idleOnce && step === 'VOTE' && v.round === 2) {
        // Let the 60-second timer decide for this client once.
        this.idleOnce = false;
        this.acted.add('d');
        console.log(`client ${this.k}: idling on ${label} so the timeout rule decides`);
        return;
      }
      if (v.phase.kind === 'TALK' && !this.acted.has('m') && v.talkSent === 0) {
        this.acted.add('m');
        this.later(() => this.timed({ v: 1, type: 'SEND_MESSAGE', msg: { type: 'CLAIM_VALUES', card: 'RAWLSIAN' } }, label));
        return;
      }
      this.acted.add('d');
      return this.later(() => this.timed({ v: 1, type: 'SUBMIT_DECISION', decision: decisionFor(step, this.k, v) }, label));
    }
    if (v.phase.kind === 'DECIDE') return; // waiting for others
    if (this.acted.has('r')) return;
    this.acted.add('r');
    this.later(() => this.timed({ v: 1, type: 'READY' }, label));
  }
  later(fn) {
    // Stagger clients a little, like people, and stay under 5 messages a second.
    setTimeout(() => !this.closed && fn(), 60 + this.k * 40);
  }
}

async function main() {
  const r = await fetch(`${BASE}/rooms`, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: MODE, difficulty: 'NORMAL', ...(LEVEL ? { level: LEVEL } : {}) }) });
  if (r.status !== 201) throw new Error(`create failed: ${r.status} ${await r.text()}`);
  const { code } = await r.json();
  console.log(`room ${code}: ${HUMANS} humans, ${SEATS} seats, ${MODE}${LEVEL ? ' level ' + LEVEL : ''}`);
  const clients = Array.from({ length: HUMANS }, (_, k) => new Client(k, code));
  for (const c of clients) {
    await c.connect();
    await sleep(150);
  }
  if (args['timeout-once']) clients[HUMANS - 1].idleOnce = true;
  const t0 = performance.now();
  clients[0].timed({ v: 1, type: 'START', mode: MODE, difficulty: 'NORMAL', nPlayers: SEATS, ...(LEVEL ? { level: LEVEL } : {}) }, 'START');
  let reconnected = !args['reconnect-once'];
  while (!clients.every((c) => c.ended)) {
    await sleep(250);
    if (performance.now() - t0 > 30 * 60 * 1000) throw new Error('took too long');
    const v = clients[0].view;
    if (!reconnected && v && v.levelIndex >= 1 && v.phase.kind === 'TALK' && v.round === 3 && HUMANS > 1) {
      reconnected = true;
      const c = clients[1];
      console.log('client 1: disconnecting');
      c.paused = true;
      c.ws.close();
      await sleep(3000);
      c.closed = false;
      c.paused = false;
      await c.connect();
      console.log(`client 1: reconnected to seat ${c.seat} with its token`);
    }
  }
  const total = (performance.now() - t0) / 1000;
  const stats = await (await fetch(`${BASE}/rooms/${code}/stats`, { headers: { Origin: ORIGIN } })).json();
  const r0 = performance.now();
  await fetch(`${BASE}/rooms/${code}/reload`, { headers: { Origin: ORIGIN } });
  const reloadMs = performance.now() - r0;
  for (const c of clients) c.ws.close();

  const by = new Map();
  for (const s of samples) {
    const k = `${s.type} @ ${s.label}`;
    const e = by.get(k) ?? { n: 0, sum: 0, max: 0 };
    e.n++;
    e.sum += s.ms;
    e.max = Math.max(e.max, s.ms);
    by.set(k, e);
  }
  const rows = [...by.entries()].sort((a, b) => b[1].max - a[1].max);
  const all = samples.map((s) => s.ms).sort((a, b) => a - b);
  const pct = (p) => all[Math.min(all.length - 1, Math.floor(p * all.length))].toFixed(0);
  console.log(`\nfinished in ${total.toFixed(0)} s; ${samples.length} timed messages; median ${pct(0.5)} ms, p95 ${pct(0.95)} ms, max ${pct(0.9999)} ms`);
  console.log('slowest message types (max / mean ms, count):');
  for (const [k, e] of rows.slice(0, 12)) console.log(`  ${e.max.toFixed(0).padStart(6)} / ${(e.sum / e.n).toFixed(0).padStart(5)}  x${e.n}  ${k}`);
  console.log(`rebuild by replaying the log (forced reload): ${reloadMs.toFixed(0)} ms`);
  console.log('storage:', JSON.stringify(stats));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
