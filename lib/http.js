/* Small helpers shared by the api/auth/* functions. */

export const API_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store, max-age=0',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'same-origin',
};

export function json(status, body, cookies = []) {
  const headers = new Headers(API_HEADERS);
  for (const c of cookies) headers.append('Set-Cookie', c);
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Cross-site request protection: the request must come from a page on this same site.
 * Browsers always send Origin on POST; Sec-Fetch-Site is the fallback for older ones.
 */
export function isSameOrigin(request) {
  const expected = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  if (origin) return origin === expected;
  return request.headers.get('sec-fetch-site') === 'same-origin';
}

/** Parses a small JSON body; returns null for wrong content type, oversize or invalid JSON. */
export async function readJson(request, maxBytes = 2048) {
  const type = (request.headers.get('content-type') || '').toLowerCase();
  if (!type.startsWith('application/json')) return null;
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maxBytes) return null;
  try {
    const text = await request.text();
    if (text.length > maxBytes) return null;
    const data = JSON.parse(text);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/** Common checks for every state-changing auth endpoint. Returns an error Response or null. */
export async function guardPost(request) {
  if (!isSameOrigin(request)) return json(403, { error: 'forbidden' });
  return null;
}

/**
 * Keeps the response time roughly the same whatever happened (address on the list or not, email sent or not),
 * so timing does not reveal which addresses are allowed.
 */
export async function padTo(startedAt, minMs, jitterMs = 250) {
  const target = minMs + Math.floor(Math.random() * jitterMs);
  const wait = target - (Date.now() - startedAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

export function clientInfo(request) {
  const h = request.headers;
  const decode = (v) => { try { return decodeURIComponent(v || ''); } catch { return v || ''; } };
  return {
    ip: (h.get('x-real-ip') || h.get('x-forwarded-for') || '').split(',')[0].trim(),
    city: decode(h.get('x-vercel-ip-city')),
    country: h.get('x-vercel-ip-country') || '',
    userAgent: (h.get('user-agent') || '').slice(0, 300),
  };
}

/** "Chrome on macOS" style label from a user-agent string. */
export function describeAgent(ua) {
  const s = String(ua || '');
  const browser =
    /Edg\//.test(s) ? 'Edge' :
    /OPR\/|Opera/.test(s) ? 'Opera' :
    /Firefox\//.test(s) ? 'Firefox' :
    /Chrome\//.test(s) ? 'Chrome' :
    /Safari\//.test(s) ? 'Safari' : '';
  const os =
    /iPhone|iPad|iPod/.test(s) ? 'iOS' :
    /Android/.test(s) ? 'Android' :
    /Mac OS X|Macintosh/.test(s) ? 'macOS' :
    /Windows/.test(s) ? 'Windows' :
    /CrOS/.test(s) ? 'ChromeOS' :
    /Linux/.test(s) ? 'Linux' : '';
  if (browser && os) return `${browser} · ${os}`;
  return browser || os || '';
}
