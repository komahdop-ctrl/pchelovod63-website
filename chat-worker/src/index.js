import { DurableObject } from 'cloudflare:workers';

const ROOM = 'samara-beekeepers';
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const MAX_MESSAGE = 500;
const MAX_NAME = 30;

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/health' && request.method === 'GET') return json({ ok: true, service: 'pchelovod63-chat' });

    if (path === '/admin/delete' && request.method === 'POST') {
      if (!env.ADMIN_TOKEN) return json({ error: 'Admin secret is not configured' }, 503);
      if (request.headers.get('Authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
        return json({ error: 'Unauthorized' }, 401);
      }
      let data;
      try { data = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
      if (typeof data?.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(data.id)) {
        return json({ error: 'Invalid message id' }, 400);
      }
      const stub = env.CHAT_ROOM.getByName(ROOM);
      return stub.fetch(new Request('https://internal.invalid/internal/delete', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: data.id })
      }));
    }

    if (path !== '/chat') return json({ error: 'Not found' }, 404);
    if (request.method !== 'GET' || request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('WebSocket upgrade required', { status: 426 });
    }

    // Браузерный Origin проверяется на уровне Worker. Не использовать "*"!
    const origin = request.headers.get('Origin');
    const allowlist = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!origin || !allowlist.includes(origin)) return json({ error: 'Origin is not allowed' }, 403);

    return env.CHAT_ROOM.getByName(ROOM).fetch(request);
  }
};

export class ChatRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, body TEXT NOT NULL,
      sender_id TEXT NOT NULL, created_at INTEGER NOT NULL
    )`);
    this.ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS idx_messages_time ON messages(created_at)');
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  messages() {
    const cutoff = Date.now() - THIRTY_DAYS;
    this.ctx.storage.sql.exec('DELETE FROM messages WHERE created_at < ?', cutoff);
    const rows = this.ctx.storage.sql.exec(
      'SELECT id, name, body, sender_id, created_at FROM messages ORDER BY created_at DESC LIMIT 100'
    ).toArray();
    return rows.reverse().map(r => ({
      id: r.id, name: r.name, text: r.body, senderId: r.sender_id, createdAt: r.created_at
    }));
  }

  state(ws) {
    return ws.deserializeAttachment() || {};
  }

  send(ws, packet) {
    try { ws.send(JSON.stringify(packet)); } catch { /* disconnect races */ }
  }

  broadcast(packet) {
    for (const ws of this.ctx.getWebSockets()) this.send(ws, packet);
  }

  presence() {
    const active = this.ctx.getWebSockets().map(ws => this.state(ws)).filter(s => s.active);
    const unique = new Map();
    for (const session of active) {
      if (!unique.has(session.visitorId)) unique.set(session.visitorId, session);
    }
    const names = [...unique.values()].map(s => s.name).filter(Boolean).slice(0, 30);
    this.broadcast({ type: 'presence', count: unique.size, names });
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/internal/delete' && request.method === 'POST') {
      const { id } = await request.json();
      const found = this.ctx.storage.sql.exec('SELECT id FROM messages WHERE id = ?', id).toArray();
      if (!found.length) return json({ error: 'Message not found' }, 404);
      this.ctx.storage.sql.exec('DELETE FROM messages WHERE id = ?', id);
      this.broadcast({ type: 'delete', id });
      return json({ ok: true, deleted: id });
    }
    if (path !== '/chat') return json({ error: 'Not found' }, 404);

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);

    const socketId = crypto.randomUUID();
    server.serializeAttachment({
      socketId, visitorId: socketId, name: '', active: true,
      lastMessageAt: 0, lastText: ''
    });
    this.send(server, { type: 'hello', socketId, messages: this.messages() });
    this.presence();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    if (raw === 'ping') return;
    if (typeof raw !== 'string' || raw.length > 2048) {
      this.send(ws, { type: 'error', message: 'Слишком длинный запрос' });
      return;
    }
    let data;
    try { data = JSON.parse(raw); } catch { return; }
    if (!data || typeof data.type !== 'string') return;

    const session = this.state(ws);
    if (data.type === 'join') {
      const candidate = typeof data.name === 'string' ? data.name.trim() : '';
      const name = candidate.replace(/[<>\\p{Cc}]/gu, '').slice(0, MAX_NAME);
      const visitorId = typeof data.visitorId === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(data.visitorId)
        ? data.visitorId : session.socketId;
      ws.serializeAttachment({
        ...session, visitorId, name, active: data.active !== false
      });
      this.presence();
    } else if (data.type === 'presence') {
      ws.serializeAttachment({ ...session, active: data.active === true });
      this.presence();
    } else if (data.type === 'message') {
      const text = typeof data.text === 'string' ? data.text.trim().replace(/\r\n/g, '\n') : '';
      if (!text || text.length > MAX_MESSAGE || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
        this.send(ws, { type: 'error', message: 'Введите текст длиной до 500 символов' });
        return;
      }
      if ((text.match(/https?:\/\//gi) || []).length > 2) {
        this.send(ws, { type: 'error', message: 'В одном сообщении не более двух ссылок' });
        return;
      }
      const now = Date.now();
      if (now - (session.lastMessageAt || 0) < 5000) {
        this.send(ws, { type: 'error', message: 'Подождите 5 секунд перед следующим сообщением' });
        return;
      }
      if (text === session.lastText) {
        this.send(ws, { type: 'error', message: 'Не отправляйте одинаковые сообщения подряд' });
        return;
      }
      ws.serializeAttachment({ ...session, lastMessageAt: now, lastText: text });
      const msg = { id: crypto.randomUUID(), name: session.name || 'Гость', text,
        senderId: session.socketId, createdAt: now };
      this.ctx.storage.sql.exec(
        'INSERT INTO messages (id, name, body, sender_id, created_at) VALUES (?, ?, ?, ?, ?)',
        msg.id, msg.name, msg.text, msg.senderId, msg.createdAt
      );
      this.broadcast({ type: 'message', message: msg });
    }
  }

  async webSocketClose(ws, code, reason) {
    try { ws.close(code, reason); } catch { /* already closed */ }
    this.presence();
  }

  async webSocketError(ws) {
    try { ws.close(1011, 'connection error'); } catch { /* already closed */ }
    this.presence();
  }
}
