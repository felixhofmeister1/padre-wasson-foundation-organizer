import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeEmail, parseAllowList, isAllowed, maskEmail, randomCode, normalizeCode, formatCode,
  signToken, verifyToken, createSession, readSession, readConfig, safeNext, getCookie, serializeCookie,
  CODE_ALPHABET, CODE_LENGTH, SESSION_COOKIE,
} from '../lib/auth-core.js';

const SECRET = 'test-secret-that-is-long-enough-0123456789';

test('normalizeEmail accepts plain addresses and rejects tricks', () => {
  assert.equal(normalizeEmail('  Stefan.Graefe@Example.ORG '), 'stefan.graefe@example.org');
  assert.equal(normalizeEmail('a+tag@sub.example.co.uk'), 'a+tag@sub.example.co.uk');
  for (const bad of ['', 'no-at', '@x.org', 'a@', 'a@b', 'a@@b.org', 'a b@c.org', 'ä@b.org', 'a@bü.org', 'a@b.org\r\nBcc: x@y.org', '.a@b.org', 'a.@b.org', 'a..b@c.org', 'x'.repeat(65) + '@b.org', 'a@' + 'b'.repeat(250) + '.org', 'a@-b.org']) {
    assert.equal(normalizeEmail(bad), '', `should reject ${JSON.stringify(bad)}`);
  }
});

test('allow-list matches exact addresses and whole domains only', () => {
  const list = parseAllowList(' Felix@Example.com, @padre.org;bad-entry  stefan@other.org ');
  assert.equal(list.size, 3);
  assert.ok(isAllowed('felix@example.com', list));
  assert.ok(isAllowed('FELIX@example.com', list));
  assert.ok(isAllowed('anyone@padre.org', list));
  assert.ok(isAllowed('stefan@other.org', list));
  assert.ok(!isAllowed('felix@example.com.evil.org', list));
  assert.ok(!isAllowed('x@sub.padre.org', list), 'subdomains are not included');
  assert.ok(!isAllowed('x@notpadre.org', list));
  assert.ok(!isAllowed('felix+1@example.com', list), 'no plus-address aliasing');
  assert.equal(parseAllowList('').size, 0);
});

test('maskEmail hides most of the local part', () => {
  assert.equal(maskEmail('stefan@x.org'), 's***n@x.org');
  assert.equal(maskEmail('ab@x.org'), 'a@x.org');
});

test('codes: 8 characters from the unambiguous alphabet, evenly spread', () => {
  const counts = new Map();
  for (let i = 0; i < 4000; i++) {
    const c = randomCode();
    assert.equal(c.length, CODE_LENGTH);
    for (const ch of c) { assert.ok(CODE_ALPHABET.includes(ch)); counts.set(ch, (counts.get(ch) || 0) + 1); }
  }
  assert.equal(counts.size, CODE_ALPHABET.length);
  const avg = (4000 * CODE_LENGTH) / CODE_ALPHABET.length;
  for (const n of counts.values()) assert.ok(Math.abs(n - avg) < avg * 0.15, 'roughly uniform');
  assert.equal(formatCode('ABCDEFGH'), 'ABCD-EFGH');
  assert.equal(normalizeCode(' abcd-efgh '), 'ABCDEFGH');
  assert.equal(normalizeCode('ABCD EFGH'), 'ABCDEFGH');
  assert.equal(normalizeCode('ABCD-EFG0'), '', '0 is not in the alphabet');
  assert.equal(normalizeCode('ABCDEFG'), '');
  assert.equal(normalizeCode(null), '');
});

test('tokens: round trip, tampering, wrong purpose, expiry, wrong secret', async () => {
  const exp = Math.floor(Date.now() / 1000) + 60;
  const tok = await signToken(SECRET, 'challenge', { typ: 'challenge', sub: 'a@b.org', exp });
  assert.equal((await verifyToken(SECRET, 'challenge', tok)).sub, 'a@b.org');

  const [v, body, sig] = tok.split('.');
  const forged = Buffer.from(JSON.stringify({ typ: 'challenge', sub: 'evil@b.org', exp })).toString('base64url');
  assert.equal(await verifyToken(SECRET, 'challenge', `${v}.${forged}.${sig}`), null, 'payload swap');
  assert.equal(await verifyToken(SECRET, 'challenge', `${v}.${body}.${sig.slice(0, -2)}AA`), null, 'bad signature');
  assert.equal(await verifyToken(SECRET, 'challenge', `v2.${body}.${sig}`), null, 'unknown version');
  assert.equal(await verifyToken(SECRET, 'challenge', `${v}.${body}`), null, 'missing signature');
  assert.equal(await verifyToken(SECRET, 'session', tok), null, 'a challenge is never a session');
  assert.equal(await verifyToken(SECRET + 'x', 'challenge', tok), null, 'other secret');
  assert.equal(await verifyToken(SECRET, 'challenge', tok, (exp + 1) * 1000), null, 'expired');
  assert.equal(await verifyToken(SECRET, 'challenge', 'garbage'), null);
  assert.equal(await verifyToken(SECRET, 'challenge', 'v1.%%%.***'), null);

  const wrongTyp = await signToken(SECRET, 'session', { typ: 'challenge', exp });
  assert.equal(await verifyToken(SECRET, 'session', wrongTyp), null, 'typ must match purpose');
});

function reqWithCookie(value) {
  return new Request('https://app.test/', { headers: { cookie: `other=1; ${SESSION_COOKIE}=${value}` } });
}

test('sessions: valid, then invalid after version bump, removal from list, or shorter lifetime', async () => {
  const env = { AUTH_SECRET: SECRET, ALLOWED_EMAILS: 'felix@example.com', SESSION_HOURS: '12', SESSION_VERSION: '1' };
  const cfg = readConfig(env);
  const { token } = await createSession(cfg, 'felix@example.com');
  assert.equal((await readSession(reqWithCookie(token), cfg)).sub, 'felix@example.com');

  assert.equal(await readSession(reqWithCookie(token), readConfig({ ...env, SESSION_VERSION: '2' })), null);
  assert.equal(await readSession(reqWithCookie(token), readConfig({ ...env, ALLOWED_EMAILS: 'other@example.com' })), null);
  assert.equal(await readSession(reqWithCookie(token), readConfig({ ...env, SESSION_HOURS: '1' })), null);
  assert.equal(await readSession(reqWithCookie(token), readConfig({ ...env, AUTH_SECRET: 'short' })), null, 'weak secret = locked');
  assert.equal(await readSession(reqWithCookie(token), cfg, Date.now() + 13 * 3600e3), null, 'expired');
  assert.equal(await readSession(new Request('https://app.test/'), cfg), null, 'no cookie');
});

test('safeNext only allows paths on this site', () => {
  assert.equal(safeNext('/'), '/');
  assert.equal(safeNext('/?x=1'), '/?x=1');
  for (const bad of ['https://evil.org', '//evil.org', '/\\evil.org', 'evil', '', null, '/login', '/login?next=/', '/api/auth/logout', '/a\nb', '/' + 'a'.repeat(600)]) {
    assert.equal(safeNext(bad), '/', `should reject ${JSON.stringify(bad)}`);
  }
});

test('cookies are Secure, HttpOnly, host-only and parsed exactly', () => {
  const c = serializeCookie('__Host-x', 'v', { maxAge: 60, sameSite: 'Strict' });
  assert.equal(c, '__Host-x=v; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=60');
  assert.equal(getCookie('a=1; __Host-x=abc.def; b=2', '__Host-x'), 'abc.def');
  assert.equal(getCookie('x__Host-x=nope', '__Host-x'), '');
});
