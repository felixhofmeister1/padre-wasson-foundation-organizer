/* GET /api/auth/session → { email, expiresAt } for a valid session, 401 otherwise. The app checks this regularly. */

import { readConfig, readSession, clearCookie, SESSION_COOKIE } from '../../lib/auth-core.js';
import { json } from '../../lib/http.js';
import { recall } from '../../lib/limits.js';

export async function GET(request) {
  const cfg = readConfig();
  const s = await readSession(request, cfg);
  if (!s || (await recall(`rev:${s.sid}`))) {
    const hadCookie = (request.headers.get('cookie') || '').includes(SESSION_COOKIE + '=');
    return json(401, { error: 'signed_out' }, hadCookie ? [clearCookie(SESSION_COOKIE)] : []);
  }
  return json(200, { email: s.sub, expiresAt: s.exp });
}
