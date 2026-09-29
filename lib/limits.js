/*
 * Best-effort server-side memory for the sign-in flow:
 *  - Vercel Runtime Cache: failed-attempt counters, one-time use of codes, resend cooldown, signed-out sessions.
 *  - Vercel Firewall rate-limit rule "auth-code-email": caps codes per address across all visitors.
 * The design stays safe without them (codes are long, short-lived and tied to one browser);
 * these layers make guessing and email flooding even harder. Keys never contain raw addresses.
 */

import { getCache } from '@vercel/functions';
import { checkRateLimit } from '@vercel/firewall';

let cache = null;

function store() {
  try {
    cache ??= getCache({ namespace: 'pwo-auth' });
    return cache;
  } catch {
    return null;
  }
}

export async function remember(key, value, ttlSeconds) {
  try {
    await store()?.set(key, value, { ttl: Math.max(1, Math.ceil(ttlSeconds)), name: '' });
  } catch (err) {
    console.warn('[auth] cache write failed:', err?.message || err);
  }
}

export async function recall(key) {
  try {
    return (await store()?.get(key)) ?? null;
  } catch (err) {
    console.warn('[auth] cache read failed:', err?.message || err);
    return null;
  }
}

/** true when the Vercel Firewall says this key has used up its budget. Only active on Vercel. */
export async function overFirewallLimit(ruleId, request, key) {
  if (process.env.VERCEL !== '1') return false;
  try {
    const { rateLimited } = await checkRateLimit(ruleId, { request, rateLimitKey: key });
    return Boolean(rateLimited);
  } catch (err) {
    console.warn('[auth] firewall rate-limit check failed:', err?.message || err);
    return false;
  }
}
