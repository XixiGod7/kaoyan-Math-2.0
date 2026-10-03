import { DurableObject } from 'cloudflare:workers';
import { handleAsNodeRequest } from 'cloudflare:node';
import app from './server.js';
import db from './db.js';

app.listen(3000);

// One SQLite-backed object per anonymous browser. Its database is never shared
// with another visitor, and the existing synchronous data API remains usable.
export class UserStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS documents (name TEXT PRIMARY KEY, value TEXT NOT NULL)');
  }

  async fetch(request) {
    return db.runWithStorage(this.ctx.storage.sql, () => handleAsNodeRequest(3000, request));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const origin = request.headers.get('Origin');
      if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
        return Response.json({ error: '不允许跨站修改个人数据' }, { status: 403 });
      }
    }
    const cookieName = url.protocol === 'https:' ? '__Host-mb_session' : 'mb_session';
    const match = request.headers.get('Cookie')?.match(new RegExp(`(?:^|;\\s*)${cookieName}=([a-f0-9-]{36})(?:;|$)`));
    const sessionId = match?.[1] || crypto.randomUUID();
    try {
      const response = await env.USER_STORE.getByName(sessionId).fetch(request);
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'private, no-store');
      headers.set('X-Content-Type-Options', 'nosniff');
      if (!match) headers.append('Set-Cookie', `${cookieName}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${url.protocol === 'https:' ? '; Secure' : ''}`);
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      console.error(JSON.stringify({ event: 'api_error', path: url.pathname, message: error.message }));
      return Response.json({ error: '服务暂时不可用，请稍后再试' }, { status: 500 });
    }
  }
};
