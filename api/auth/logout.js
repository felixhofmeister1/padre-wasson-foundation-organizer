/* POST /api/auth/logout: ends the session in this browser and marks it as signed out on the server. */

import { readConfig, readSession, clearCookie, maskEmail, SESSION_COOKIE, CHALLENGE_COOKIE } from '../../lib/auth-core.js';
import { json, isSameOrigin } from '../../lib/http.js';
import { remember } from '../../lib/limits.js';

export async function POST(request) {
  if (!isSameOrigin(request)) return json(403, { error: 'forbidden' });
  const cfg = readConfig();
  const s = await readSession(request, cfg);
  if (s) {
    await remember(`rev:${s.sid}`, 1, s.exp - Date.now() / 1000);
    console.log(`[auth] signed out: ${maskEmail(s.sub)}`);
  }
  return json(200, { ok: true }, [clearCookie(SESSION_COOKIE), clearCookie(CHALLENGE_COOKIE, 'Strict')]);
}
