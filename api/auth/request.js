/*
 * POST /api/auth/request  { email, lang }
 * Emails a one-time code if the address is on ALLOWED_EMAILS. The answer is the same either way,
 * so this endpoint cannot be used to find out which addresses are allowed.
 */

import {
  readConfig, normalizeEmail, isAllowed, randomCode, randomId, signToken, hmac, hmacHex, b64urlEncode,
  serializeCookie, maskEmail, CHALLENGE_COOKIE, CODE_TTL_S, RESEND_COOLDOWN_S,
} from '../../lib/auth-core.js';
import { json, isSameOrigin, readJson, padTo, clientInfo } from '../../lib/http.js';
import { mailConfig, buildEmail, sendMail } from '../../lib/mailer.js';
import { remember, recall, overFirewallLimit } from '../../lib/limits.js';

const MIN_RESPONSE_MS = 1200;

export async function POST(request) {
  const started = Date.now();
  if (!isSameOrigin(request)) return json(403, { error: 'forbidden' });

  const cfg = readConfig();
  const mail = mailConfig();
  if (!cfg.secretOk || !mail || cfg.allowed.size === 0) {
    const missing = [!cfg.secretOk && 'AUTH_SECRET (32+ characters)', cfg.allowed.size === 0 && 'ALLOWED_EMAILS', !mail && 'email sending (RESEND_API_KEY + MAIL_FROM, or SMTP_HOST/SMTP_USER/SMTP_PASS)'].filter(Boolean);
    console.error('[auth] sign-in is not configured. Missing: ' + missing.join(', '));
    return json(503, { error: 'not_configured' });
  }

  const body = await readJson(request);
  if (!body) return json(400, { error: 'bad_request' });
  const email = normalizeEmail(body.email);
  if (!email) return json(400, { error: 'invalid_email' });
  const lang = body.lang === 'de' ? 'de' : 'en';

  // Every limit below applies to all addresses alike, so its answers reveal nothing about the list.
  const emailKey = await hmacHex(cfg.secret, 'rate', email);
  if ((await recall(`cool:${emailKey}`)) === 1) {
    await padTo(started, 300);
    return json(429, { error: 'cooldown', retryIn: RESEND_COOLDOWN_S });
  }
  if (await overFirewallLimit('auth-code-email', request, emailKey)) {
    await padTo(started, 300);
    return json(429, { error: 'rate_limited' });
  }
  await remember(`cool:${emailKey}`, 1, RESEND_COOLDOWN_S);

  const allowed = isAllowed(email, cfg.allowed);
  const code = randomCode(); // for addresses not on the list this code is never sent anywhere
  const cid = randomId(16);
  const exp = Math.floor(Date.now() / 1000) + CODE_TTL_S;
  const h = b64urlEncode(await hmac(cfg.secret, 'code', `${cid}|${email}|${code}`));
  const challenge = await signToken(cfg.secret, 'challenge', { typ: 'challenge', cid, sub: email, h, exp });
  const client = clientInfo(request);

  if (allowed) {
    const appUrl = process.env.APP_URL || new URL(request.url).origin;
    try {
      await sendMail(mail, email, buildEmail({ code, lang, appUrl, client, timeZone: process.env.MAIL_TIMEZONE || 'Europe/Berlin' }));
      console.log(`[auth] code sent to ${maskEmail(email)} (${client.country || '??'})`);
    } catch (err) {
      console.error(`[auth] could not send the code to ${maskEmail(email)}:`, err?.message || err);
      await remember(`cool:${emailKey}`, 0, 1); // let the person try again right away
      await padTo(started, MIN_RESPONSE_MS);
      return json(502, { error: 'send_failed' });
    }
  } else {
    console.log(`[auth] code requested for an address not on the list: ${maskEmail(email)} (${client.country || '??'})`);
  }

  await padTo(started, MIN_RESPONSE_MS);
  return json(200, { ok: true, expiresIn: CODE_TTL_S, resendIn: RESEND_COOLDOWN_S }, [
    serializeCookie(CHALLENGE_COOKIE, challenge, { maxAge: CODE_TTL_S, sameSite: 'Strict' }),
  ]);
}
