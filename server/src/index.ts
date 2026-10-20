// Room server entry. POST /rooms creates a room and returns its code; GET /rooms/:code/ws upgrades
// to a WebSocket handled by that room's Durable Object. Only the production site, this project's
// Vercel previews and localhost may call it.
import { CODE_RE, makeCode, originAllowed, parseClientMessage, type RoomSettings } from './protocol';
import type { Env } from './room';

export { Room } from './room';

function randInt(n: number): number {
  // Rejection sampling for a uniform integer in [0, n).
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

async function settingsFrom(req: Request): Promise<RoomSettings | null> {
  const text = await req.text();
  if (text.length > 1024) return null;
  let body: Record<string, unknown> = {};
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      return null;
    }
  }
  const m = parseClientMessage(JSON.stringify({ mode: 'FULL_RUN', difficulty: 'NORMAL', ...body, v: 1, type: 'START' }));
  if ('error' in m || m.type !== 'START') return null;
  return { mode: m.mode, level: m.level, difficulty: m.difficulty, nPlayers: m.nPlayers ?? 4 };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin');
    const allowed = originAllowed(origin, env.ALLOWED_ORIGINS);
    const cors: Record<string, string> = allowed
      ? {
          'Access-Control-Allow-Origin': origin!,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
          Vary: 'Origin',
        }
      : { Vary: 'Origin' };
    if (req.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: cors });
    if (!allowed) return new Response('Forbidden', { status: 403, headers: cors });

    if (url.pathname === '/rooms' && req.method === 'POST') {
      const settings = await settingsFrom(req);
      if (!settings) return new Response('Bad settings', { status: 400, headers: cors });
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = makeCode(randInt);
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const r = await stub.fetch('https://room/init', { method: 'POST', body: JSON.stringify({ code, settings }) });
        if (r.status === 201) return Response.json({ code }, { status: 201, headers: cors });
      }
      return new Response('Could not create a room, try again', { status: 503, headers: cors });
    }

    const m = url.pathname.match(/^\/rooms\/([A-Za-z]{4})\/(ws|stats|reload|outdate)$/);
    if (m) {
      const code = m[1].toUpperCase();
      if (!CODE_RE.test(code)) return new Response('No such room', { status: 404, headers: cors });
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      if (m[2] === 'ws') {
        if (req.method !== 'GET' || req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426, headers: cors });
        return stub.fetch(new Request('https://room/ws', req));
      }
      if (env.DEV === '1') return stub.fetch(`https://room/${m[2]}`);
    }
    return new Response('Not found', { status: 404, headers: cors });
  },
} satisfies ExportedHandler<Env>;
