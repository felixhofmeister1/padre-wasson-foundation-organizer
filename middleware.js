/*
 * Vercel Routing Middleware: runs before every request. Without a valid session, page requests
 * are sent to /login and everything else gets 401. Only the sign-in page, its assets, the sign-in
 * API and the open-source libraries/fonts in /vendor are reachable without signing in.
 * If AUTH_SECRET is missing the site stays locked (fails closed).
 */

import { next } from '@vercel/functions/middleware';
import { readConfig, readSession, safeNext, SESSION_COOKIE } from './lib/auth-core.js';

const PUBLIC_PATHS = new Set([
  '/login',
  '/login.html',
  '/favicon.svg',
  '/robots.txt',
  '/api/auth/request',
  '/api/auth/verify',
  '/api/auth/session',
  '/api/auth/logout',
]);
const PUBLIC_PREFIXES = ['/auth/', '/vendor/', '/.well-known/vercel/'];

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex, nofollow',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
};

function isPublicPath(pathname) {
  // Encoded dots/slashes or backslashes never count as public, so "/vendor/%2e%2e/index.html" tricks stay locked.
  if (/%2e|%2f|%5c|\\|\/\.\.?(\/|$)/i.test(pathname)) return false;
  return PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export default async function middleware(request) {
  const url = new URL(request.url);
  if (isPublicPath(url.pathname)) return next();

  const session = await readSession(request, readConfig());
  if (session) return next();

  const method = request.method.toUpperCase();
  const accept = request.headers.get('accept') || '';
  const isPage = (method === 'GET' || method === 'HEAD') &&
    (request.headers.get('sec-fetch-dest') === 'document' || accept.includes('text/html'));

  if (isPage) {
    const params = new URLSearchParams();
    const target = safeNext(url.pathname + url.search);
    if (target !== '/') params.set('next', target);
    if ((request.headers.get('cookie') || '').includes(SESSION_COOKIE + '=')) params.set('expired', '1');
    const qs = params.toString();
    return new Response(null, { status: 302, headers: { ...SECURITY_HEADERS, Location: '/login' + (qs ? '?' + qs : '') } });
  }

  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
