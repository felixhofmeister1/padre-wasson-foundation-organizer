/*
 * POST /api/auth/verify  { code, next }
 * Checks the code against the signed challenge cookie from /api/auth/request (so a code only works in the
 * browser that asked for it), allows 5 tries per code, and starts a session.
 */

import {
  readConfig, verifyToken, getCookie, hmac, b64urlDecode, timingSafeEqual, normalizeCode, isAllowed,
  createSession, serializeCookie, clearCookie, safeNext, maskEmail,
  CHALLENGE_COOKIE, SESSION_COOKIE, MAX_CODE_ATTEMPTS,
} from '../../lib/auth-core.js';
import { json, isSameOrigin, readJson, padTo, clientInfo } from '../../lib/http.js';
import { remember, recall } from '../../lib/limits.js';

export async function POST(request) {
  const started = Date.now();
  if (!isSameOrigin(request)) return json(403, { error: 'forbidden' });

  const cfg = readConfig();
  if (!cfg.secretOk || cfg.allowed.size === 0) return json(503, { error: 'not_configured' });

  const body = await readJson(request);
  if (!body) return json(400, { error: 'bad_request' });

  const dropChallenge = clearCookie(CHALLENGE_COOKIE, 'Strict');
  const token = getCookie(request.headers.get('cookie'), CHALLENGE_COOKIE);
  const ch = token ? await verifyToken(cfg.secret, 'challenge', token) : null;
  if (!ch || typeof ch.cid !== 'string' || typeof ch.sub !== 'string' || typeof ch.h !== 'string') {
    return json(410, { error: 'expired' }, token ? [dropChallenge] : []);
  }

  const secondsLeft = ch.exp - Date.now() / 1000;
  const [used, tries] = await Promise.all([recall(`used:${ch.cid}`), recall(`att:${ch.cid}`)]);
  if (used) return json(410, { error: 'expired' }, [dropChallenge]);
  const attempts = Number(tries) || 0;
  if (attempts >= MAX_CODE_ATTEMPTS) return json(429, { error: 'too_many_attempts' }, [dropChallenge]);

  const code = normalizeCode(body.code);
  let ok = false;
  if (code) {
    const actual = await hmac(cfg.secret, 'code', `${ch.cid}|${ch.sub}|${code}`);
    ok = timingSafeEqual(actual, b64urlDecode(ch.h)) && isAllowed(ch.sub, cfg.allowed);
  }

  if (!ok) {
    const left = MAX_CODE_ATTEMPTS - attempts - 1;
    await remember(`att:${ch.cid}`, attempts + 1, secondsLeft);
    await padTo(started, 450);
    if (left <= 0) {
      console.warn(`[auth] too many wrong codes for ${maskEmail(ch.sub)}`);
      return json(429, { error: 'too_many_attempts' }, [dropChallenge]);
    }
    return json(400, { error: 'invalid_code', attemptsLeft: left });
  }

  await remember(`used:${ch.cid}`, 1, secondsLeft);
  const { token: session } = await createSession(cfg, ch.sub);
  console.log(`[auth] signed in: ${maskEmail(ch.sub)} (${clientInfo(request).country || '??'})`);
  return json(200, { ok: true, redirect: safeNext(body.next) }, [
    dropChallenge,
    serializeCookie(SESSION_COOKIE, session, { maxAge: cfg.sessionTtl, sameSite: 'Lax' }),
  ]);
}
