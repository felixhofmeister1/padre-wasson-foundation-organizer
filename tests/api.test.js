/*
 * End-to-end tests of the sign-in endpoints and the middleware, run in Node with the email
 * provider (Resend) replaced by a stub that records what would have been sent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { POST as requestCode } from '../api/auth/request.js';
import { POST as verifyCode } from '../api/auth/verify.js';
import { GET as getSession } from '../api/auth/session.js';
import { POST as logout } from '../api/auth/logout.js';
import middleware from '../middleware.js';
import { SESSION_COOKIE, CHALLENGE_COOKIE } from '../lib/auth-core.js';

const ORIGIN = 'https://organizer.test';
const ALLOWED = 'felix@example.com';

Object.assign(process.env, {
  AUTH_SECRET: 'unit-test-secret-0123456789-abcdefghijklmnop',
  ALLOWED_EMAILS: `${ALLOWED}, @foundation.test`,
  RESEND_API_KEY: 're_test_key',
  MAIL_FROM: 'login@foundation.test',
  SESSION_HOURS: '12',
  SESSION_VERSION: '1',
});
delete process.env.VERCEL;

const sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (String(url) === 'https://api.resend.com/emails') {
    sent.push(JSON.parse(init.body));
    return new Response('{"id":"x"}', { status: 200 });
  }
  return realFetch(url, init);
};

let ipCounter = 0;
function post(path, body, { cookie = '', origin = ORIGIN, type = 'application/json' } = {}) {
  const headers = { 'content-type': type, 'x-real-ip': `10.0.0.${++ipCounter}`, 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/130.0 Safari/537.36' };
  if (origin) headers.origin = origin;
  if (cookie) headers.cookie = cookie;
  return new Request(ORIGIN + path, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
}

function cookiesOf(res) {
  const out = {};
  for (const c of res.headers.getSetCookie()) {
    const [pair, ...attrs] = c.split('; ');
    const i = pair.indexOf('=');
    out[pair.slice(0, i)] = { value: pair.slice(i + 1), attrs };
  }
  return out;
}

const codeFrom = (mail) => mail.text.match(/\b([A-Z2-9]{4})-([A-Z2-9]{4})\b/).slice(1).join('');

let emailSeq = 0;
const freshAllowed = () => `person${++emailSeq}@foundation.test`;

test('request: same answer for allowed and unknown addresses, email only for allowed', async () => {
  const before = sent.length;
  const t0 = Date.now();
  const a = await requestCode(post('/api/auth/request', { email: ALLOWED, lang: 'de' }));
  const t1 = Date.now();
  const b = await requestCode(post('/api/auth/request', { email: 'stranger@evil.test', lang: 'de' }));
  const t2 = Date.now();

  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.deepEqual(await a.json(), await b.json());
  assert.ok(t1 - t0 >= 1200 && t2 - t1 >= 1200, 'response time is padded for both');

  const ca = cookiesOf(a)[CHALLENGE_COOKIE];
  const cb = cookiesOf(b)[CHALLENGE_COOKIE];
  assert.ok(ca && cb, 'both get a challenge cookie');
  assert.deepEqual(ca.attrs, cb.attrs);
  assert.ok(ca.attrs.includes('HttpOnly') && ca.attrs.includes('Secure') && ca.attrs.includes('SameSite=Strict') && ca.attrs.includes('Path=/'));
  assert.equal(Math.abs(ca.value.length - cb.value.length) < 8, true, 'tokens have similar size');

  assert.equal(sent.length, before + 1, 'exactly one email, to the allowed address');
  const mail = sent.at(-1);
  assert.deepEqual(mail.to, [ALLOWED]);
  assert.equal(mail.from, 'Padre Wasson Foundation Organizer <login@foundation.test>');
  assert.match(mail.subject, /Anmeldecode/);
  assert.doesNotMatch(mail.subject, /[A-Z2-9]{4}-[A-Z2-9]{4}/, 'the code is not in the subject line');
  assert.match(mail.text, /organizer\.test\/login/);
  assert.match(mail.text, /Chrome · macOS/);
  assert.equal(mail.headers['Auto-Submitted'], 'auto-generated');
});

test('request: rejects cross-site calls, bad input, and repeats within a minute', async () => {
  assert.equal((await requestCode(post('/api/auth/request', { email: ALLOWED }, { origin: 'https://evil.test' }))).status, 403);
  assert.equal((await requestCode(post('/api/auth/request', { email: ALLOWED }, { origin: '' }))).status, 403);
  assert.equal((await requestCode(post('/api/auth/request', 'email=x', { type: 'application/x-www-form-urlencoded' }))).status, 400);
  assert.equal((await requestCode(post('/api/auth/request', '{"email": "a@b.org"' ))).status, 400);
  assert.equal((await requestCode(post('/api/auth/request', { email: 'x'.repeat(3000) + '@b.org' }))).status, 400);
  const bad = await requestCode(post('/api/auth/request', { email: 'not an email' }));
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error, 'invalid_email');

  const e = freshAllowed();
  assert.equal((await requestCode(post('/api/auth/request', { email: e }))).status, 200);
  const again = await requestCode(post('/api/auth/request', { email: e }));
  assert.equal(again.status, 429);
  assert.equal((await again.json()).error, 'cooldown');
  const stranger = 'nobody@evil.test';
  await requestCode(post('/api/auth/request', { email: stranger }));
  assert.equal((await requestCode(post('/api/auth/request', { email: stranger }))).status, 429, 'cooldown applies to unknown addresses too');
});

test('request: fails closed when not configured', async () => {
  const saved = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = 'too-short';
  const res = await requestCode(post('/api/auth/request', { email: freshAllowed() }));
  process.env.AUTH_SECRET = saved;
  assert.equal(res.status, 503);
  assert.equal((await res.json()).error, 'not_configured');
});

async function startLogin(email = freshAllowed()) {
  const res = await requestCode(post('/api/auth/request', { email, lang: 'en' }));
  assert.equal(res.status, 200);
  const challenge = cookiesOf(res)[CHALLENGE_COOKIE].value;
  return { email, code: codeFrom(sent.at(-1)), cookie: `${CHALLENGE_COOKIE}=${challenge}` };
}

test('verify: right code signs in once; the same code cannot be used again', async () => {
  const { email, code, cookie } = await startLogin();
  const res = await verifyCode(post('/api/auth/verify', { code: code.toLowerCase().replace(/(....)/, '$1 '), next: '/?tab=blog' }, { cookie }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, redirect: '/?tab=blog' });
  const cookies = cookiesOf(res);
  assert.equal(cookies[CHALLENGE_COOKIE].attrs.includes('Max-Age=0'), true, 'challenge is removed');
  const session = cookies[SESSION_COOKIE];
  assert.ok(session.attrs.includes('HttpOnly') && session.attrs.includes('Secure') && session.attrs.includes('SameSite=Lax') && session.attrs.includes('Max-Age=43200'));

  const who = await getSession(new Request(ORIGIN + '/api/auth/session', { headers: { cookie: `${SESSION_COOKIE}=${session.value}` } }));
  assert.equal(who.status, 200);
  assert.equal((await who.json()).email, email);

  const replay = await verifyCode(post('/api/auth/verify', { code }, { cookie }));
  assert.equal(replay.status, 410, 'a used code is dead');
});

test('verify: open redirects are neutralised', async () => {
  const { code, cookie } = await startLogin();
  const res = await verifyCode(post('/api/auth/verify', { code, next: '//evil.test/phish' }, { cookie }));
  assert.equal((await res.json()).redirect, '/');
});

test('verify: 5 wrong tries end the code, even when the 6th is right', async () => {
  const { code, cookie } = await startLogin();
  const wrong = code.startsWith('A') ? 'BBBBBBBB' : 'AAAAAAAA';
  for (let left = 4; left >= 1; left--) {
    const r = await verifyCode(post('/api/auth/verify', { code: wrong }, { cookie }));
    assert.equal(r.status, 400);
    assert.deepEqual(await r.json(), { error: 'invalid_code', attemptsLeft: left });
  }
  const fifth = await verifyCode(post('/api/auth/verify', { code: wrong }, { cookie }));
  assert.equal(fifth.status, 429);
  const sixth = await verifyCode(post('/api/auth/verify', { code }, { cookie }));
  assert.equal(sixth.status, 429);
  assert.equal(cookiesOf(sixth)[SESSION_COOKIE], undefined);
});

test('verify: a code only works with the challenge from the same browser', async () => {
  const a = await startLogin();
  await new Promise((r) => setTimeout(r, 5));
  const b = await startLogin();
  assert.equal((await verifyCode(post('/api/auth/verify', { code: a.code }, { cookie: b.cookie }))).status, 400);
  assert.equal((await verifyCode(post('/api/auth/verify', { code: a.code }))).status, 410, 'no challenge cookie at all');
  assert.equal((await verifyCode(post('/api/auth/verify', { code: a.code }, { cookie: a.cookie, origin: 'https://evil.test' }))).status, 403);
});

test('verify: removed from the list after requesting → no session', async () => {
  const { code, cookie } = await startLogin();
  const saved = process.env.ALLOWED_EMAILS;
  process.env.ALLOWED_EMAILS = ALLOWED;
  const res = await verifyCode(post('/api/auth/verify', { code }, { cookie }));
  process.env.ALLOWED_EMAILS = saved;
  assert.equal(res.status, 400);
});

async function signIn() {
  const { code, cookie } = await startLogin();
  const res = await verifyCode(post('/api/auth/verify', { code }, { cookie }));
  return `${SESSION_COOKIE}=${cookiesOf(res)[SESSION_COOKIE].value}`;
}

test('logout: clears the cookie and the session stops working on the server', async () => {
  const cookie = await signIn();
  assert.equal((await logout(post('/api/auth/logout', {}, { cookie, origin: 'https://evil.test' }))).status, 403);
  const res = await logout(post('/api/auth/logout', {}, { cookie }));
  assert.equal(res.status, 200);
  assert.ok(cookiesOf(res)[SESSION_COOKIE].attrs.includes('Max-Age=0'));
  const after = await getSession(new Request(ORIGIN + '/api/auth/session', { headers: { cookie } }));
  assert.equal(after.status, 401);
});

function get(path, { cookie = '', html = true } = {}) {
  const headers = html ? { accept: 'text/html,application/xhtml+xml', 'sec-fetch-dest': 'document' } : { accept: '*/*' };
  if (cookie) headers.cookie = cookie;
  return new Request(ORIGIN + path, { headers });
}
const passes = (res) => res.headers.get('x-middleware-next') === '1';

test('middleware: locks every page and file without a session', async () => {
  const toLogin = await middleware(get('/'));
  assert.equal(toLogin.status, 302);
  assert.equal(toLogin.headers.get('location'), '/login');
  assert.equal(toLogin.headers.get('cache-control'), 'no-store, max-age=0');

  const deep = await middleware(get('/index.html?x=1'));
  assert.equal(deep.headers.get('location'), '/login?next=%2Findex.html%3Fx%3D1');

  for (const path of ['/index.html', '/README.md', '/package.json', '/middleware.js', '/api/other', '/vendor/%2e%2e/index.html', '/vendor/..%2Findex.html', '/auth/../index.html', '/loginx', '/login.html.bak']) {
    const res = await middleware(get(path, { html: false }));
    assert.equal(res.status, 401, path);
  }
  const expired = await middleware(get('/', { cookie: `${SESSION_COOKIE}=v1.bad.sig` }));
  assert.equal(expired.headers.get('location'), '/login?expired=1');
});

test('middleware: sign-in page, its files and the libraries stay reachable', async () => {
  for (const path of ['/login', '/login.html', '/auth/login.js', '/auth/login.css', '/favicon.svg', '/robots.txt', '/vendor/fonts/fonts.css', '/api/auth/request', '/api/auth/session']) {
    assert.ok(passes(await middleware(get(path))), path);
  }
});

test('middleware: a valid session opens the app', async () => {
  const cookie = await signIn();
  assert.ok(passes(await middleware(get('/', { cookie }))));
  assert.ok(passes(await middleware(get('/index.html', { cookie, html: false }))));
  const forged = cookie.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A'));
  assert.equal((await middleware(get('/', { cookie: forged }))).status, 302);
});
