/* =====================================================================
   Sign-in core, shared by middleware.js (Edge) and api/auth/* (Node).
   Web Crypto only, so it runs in both runtimes.

   Tokens are "v1.<payload>.<signature>": base64url JSON signed with
   HMAC-SHA256. Each purpose (session, challenge, code, rate-limit key)
   uses its own key derived from AUTH_SECRET, so a value made for one
   purpose can never be replayed as another.
   ===================================================================== */

export const SESSION_COOKIE = '__Host-pwo-session';
export const CHALLENGE_COOKIE = '__Host-pwo-challenge';
export const CODE_TTL_S = 10 * 60;
export const MAX_CODE_ATTEMPTS = 5;
export const RESEND_COOLDOWN_S = 60;
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
export const CODE_LENGTH = 8; // 31^8 ≈ 8.5 × 10^11 combinations

const enc = new TextEncoder();
const dec = new TextDecoder();

/* ---------- configuration (read on every call so env changes apply without redeploy caches) ---------- */

export function readConfig(env = process.env) {
  const secret = String(env.AUTH_SECRET || '');
  const hours = Number(env.SESSION_HOURS || 12);
  return {
    secret,
    secretOk: secret.length >= 32,
    allowed: parseAllowList(env.ALLOWED_EMAILS || ''),
    sessionTtl: Math.round((Number.isFinite(hours) && hours > 0 ? Math.min(hours, 24 * 7) : 12) * 3600),
    sessionVersion: String(env.SESSION_VERSION || '1'),
  };
}

/* ---------- email addresses ---------- */

const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** Lower-cased, trimmed address, or '' when it is not a plain ASCII address (rules out look-alike Unicode tricks). */
export function normalizeEmail(input) {
  const e = String(input ?? '').trim().toLowerCase();
  if (e.length < 3 || e.length > 254 || !EMAIL_RE.test(e)) return '';
  const [local] = e.split('@');
  if (local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return '';
  return e;
}

/** "a@x.org, b@y.com, @whole-domain.org" → { emails:Set, domains:Set } */
export function parseAllowList(raw) {
  const emails = new Set();
  const domains = new Set();
  for (const part of String(raw).split(/[\s,;]+/)) {
    const p = part.trim().toLowerCase();
    if (!p) continue;
    if (p.startsWith('@')) {
      const d = normalizeEmail('x' + p);
      if (d) domains.add(d.slice(2));
    } else {
      const e = normalizeEmail(p);
      if (e) emails.add(e);
    }
  }
  return { emails, domains, size: emails.size + domains.size };
}

export function isAllowed(email, allowed) {
  const e = normalizeEmail(email);
  if (!e) return false;
  return allowed.emails.has(e) || allowed.domains.has(e.slice(e.lastIndexOf('@') + 1));
}

/** "stefan.graefe@example.org" → "s***e@example.org" (for logs) */
export function maskEmail(email) {
  const [local = '', domain = ''] = String(email).split('@');
  const shown = local.length <= 2 ? local[0] || '' : local[0] + '***' + local[local.length - 1];
  return `${shown}@${domain}`;
}

/* ---------- codes ---------- */

export function randomCode() {
  const out = [];
  const max = 256 - (256 % CODE_ALPHABET.length); // reject-sample so every letter is equally likely
  while (out.length < CODE_LENGTH) {
    for (const b of crypto.getRandomValues(new Uint8Array(16))) {
      if (b < max && out.length < CODE_LENGTH) out.push(CODE_ALPHABET[b % CODE_ALPHABET.length]);
    }
  }
  return out.join('');
}

export const formatCode = (code) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** Accepts "abcd efgh", "ABCD-EFGH", pasted text with spaces; returns '' if it cannot be a code. */
export function normalizeCode(input) {
  const c = String(input ?? '').toUpperCase().replace(/[\s\-–—_.]/g, '');
  if (c.length !== CODE_LENGTH) return '';
  for (const ch of c) if (!CODE_ALPHABET.includes(ch)) return '';
  return c;
}

export function randomId(bytes = 16) {
  return b64urlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
}

/* ---------- base64url ---------- */

export function b64urlEncode(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(str) {
  if (typeof str !== 'string' || !/^[A-Za-z0-9_-]*$/.test(str)) throw new Error('bad base64url');
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/* ---------- keys & HMAC ---------- */

const keyCache = new Map();

async function hmacKey(secret, purpose) {
  const id = purpose + '\u0000' + secret;
  if (keyCache.has(id)) return keyCache.get(id);
  const promise = (async () => {
    const root = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const derived = await crypto.subtle.sign('HMAC', root, enc.encode('pwo-auth/' + purpose));
    return crypto.subtle.importKey('raw', derived, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  })();
  keyCache.set(id, promise);
  if (keyCache.size > 32) keyCache.delete(keyCache.keys().next().value);
  return promise;
}

export async function hmac(secret, purpose, message) {
  const key = await hmacKey(secret, purpose);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

export async function hmacHex(secret, purpose, message) {
  return [...(await hmac(secret, purpose, message))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison of two byte arrays. */
export function timingSafeEqual(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* ---------- signed tokens ---------- */

export async function signToken(secret, purpose, payload) {
  const body = 'v1.' + b64urlEncode(enc.encode(JSON.stringify(payload)));
  const sig = await hmac(secret, 'token:' + purpose, body);
  return body + '.' + b64urlEncode(sig);
}

/** Returns the payload when the signature is valid and the token has not expired; otherwise null. */
export async function verifyToken(secret, purpose, token, now = Date.now()) {
  try {
    if (typeof token !== 'string' || token.length > 4096) return null;
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'v1') return null;
    const body = parts[0] + '.' + parts[1];
    const key = await hmacKey(secret, 'token:' + purpose);
    const ok = await crypto.subtle.verify('HMAC', key, b64urlDecode(parts[2]), enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(b64urlDecode(parts[1])));
    if (!payload || typeof payload !== 'object' || payload.typ !== purpose) return null;
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ---------- sessions ---------- */

export async function createSession(cfg, email, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const payload = { typ: 'session', sub: email, sid: randomId(12), iat, exp: iat + cfg.sessionTtl, ver: cfg.sessionVersion };
  return { token: await signToken(cfg.secret, 'session', payload), payload };
}

/** Valid session payload for this request, or null. Re-checks the allow-list and SESSION_VERSION every time. */
export async function readSession(request, cfg, now = Date.now()) {
  if (!cfg.secretOk) return null;
  const token = getCookie(request.headers.get('cookie'), SESSION_COOKIE);
  if (!token) return null;
  const p = await verifyToken(cfg.secret, 'session', token, now);
  if (!p || typeof p.sub !== 'string' || typeof p.sid !== 'string') return null;
  if (p.ver !== cfg.sessionVersion) return null;
  if (typeof p.iat !== 'number' || p.iat * 1000 > now + 60_000) return null;
  if (p.exp - p.iat > cfg.sessionTtl + 60) return null; // lifetime shortened since it was issued
  if (!isAllowed(p.sub, cfg.allowed)) return null;
  return p;
}

/* ---------- cookies ---------- */

export function getCookie(header, name) {
  if (!header) return '';
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

export function serializeCookie(name, value, { maxAge, sameSite = 'Lax' } = {}) {
  const attrs = [`${name}=${value}`, 'Path=/', 'Secure', 'HttpOnly', `SameSite=${sameSite}`];
  if (maxAge !== undefined) attrs.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  return attrs.join('; ');
}

export const clearCookie = (name, sameSite = 'Lax') => serializeCookie(name, '', { maxAge: 0, sameSite });

/* ---------- redirects ---------- */

/** Only same-site paths like "/" or "/index.html?x=1"; anything else (//evil, /\evil, http:…) becomes "/". */
export function safeNext(next) {
  const n = String(next ?? '');
  if (!n.startsWith('/') || n.startsWith('//') || n.startsWith('/\\') || n.length > 512) return '/';
  if (/[\u0000-\u001f\u007f\\]/.test(n)) return '/';
  if (n === '/login' || n.startsWith('/login?') || n.startsWith('/login.html') || n.startsWith('/api/')) return '/';
  return n;
}
