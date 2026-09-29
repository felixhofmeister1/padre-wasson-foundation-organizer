/*
 * Build for Vercel: copies only the files meant to be public into public/ and checks the
 * Content-Security-Policy in vercel.json. The page's inline script is allowed by its SHA-256
 * hash, so any edit to it needs a new hash: `npm run csp` updates vercel.json, and the build
 * fails (keeping the previous deployment live) if the two ever disagree.
 *
 *   node scripts/build.mjs               check + copy to public/
 *   node scripts/build.mjs --update-csp  write the current hashes into vercel.json
 */

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public');
const PAGES = ['index.html', 'login.html'];
const PUBLIC_FILES = [...PAGES, 'favicon.svg', 'robots.txt'];
const PUBLIC_DIRS = ['auth', 'vendor'];

function fail(msg) {
  console.error('\n✖ ' + msg + '\n');
  process.exit(1);
}

function inlineScriptHashes(html) {
  const hashes = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/.test(m[1])) continue;
    hashes.push(`'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`);
  }
  return hashes;
}

function checkMarkup(name, html) {
  const withoutScripts = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const handler = withoutScripts.match(/<[^>]+\son[a-z]+\s*=/i);
  if (handler) fail(`${name} has an inline event handler (${handler[0].slice(0, 60)}…). The CSP blocks these; use addEventListener instead.`);
  if (/javascript:/i.test(withoutScripts)) fail(`${name} contains a javascript: URL, which the CSP blocks.`);
  if (/https?:\/\/(cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)/i.test(withoutScripts)) {
    fail(`${name} loads a file from a third-party CDN in its markup. Serve it from vendor/ instead.`);
  }
}

const vercelPath = join(root, 'vercel.json');
const vercel = JSON.parse(readFileSync(vercelPath, 'utf8'));
const cspHeader = vercel.headers?.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy');
if (!cspHeader) fail('vercel.json has no Content-Security-Policy header.');

const expected = [];
for (const page of PAGES) {
  const html = readFileSync(join(root, page), 'utf8');
  checkMarkup(page, html);
  expected.push(...inlineScriptHashes(html));
}

const directives = cspHeader.value.split(';').map((d) => d.trim()).filter(Boolean);
const scriptIdx = directives.findIndex((d) => d.startsWith('script-src '));
if (scriptIdx < 0) fail('The CSP has no script-src directive.');
const scriptParts = directives[scriptIdx].split(/\s+/);
const current = scriptParts.filter((p) => p.startsWith("'sha256-"));
const same = current.length === expected.length && expected.every((h) => current.includes(h));

if (process.argv.includes('--update-csp')) {
  const kept = scriptParts.filter((p) => !p.startsWith("'sha256-"));
  directives[scriptIdx] = [...kept, ...expected].join(' ');
  cspHeader.value = directives.join('; ');
  writeFileSync(vercelPath, JSON.stringify(vercel, null, 2) + '\n');
  console.log(same ? '✓ CSP hashes were already up to date.' : `✓ Updated CSP script hashes in vercel.json: ${expected.join(' ')}`);
  process.exit(0);
}

if (!same) {
  fail(`The inline script hashes in vercel.json do not match the pages.
  expected: ${expected.join(' ')}
  found:    ${current.join(' ') || '(none)'}
Run "npm run csp" and commit vercel.json.`);
}
for (const bad of ["'unsafe-eval'", "'unsafe-inline'", '*', 'https:', 'http:', 'data:']) {
  if (scriptParts.includes(bad)) fail(`script-src must not contain ${bad}.`);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of PUBLIC_FILES) {
  if (!existsSync(join(root, f))) fail(`Missing ${f}`);
  cpSync(join(root, f), join(out, f));
}
for (const d of PUBLIC_DIRS) cpSync(join(root, d), join(out, d), { recursive: true });

console.log(`✓ CSP hashes match (${expected.length} inline script${expected.length === 1 ? '' : 's'}).`);
console.log(`✓ Copied ${PUBLIC_FILES.length} files and ${PUBLIC_DIRS.join(', ')}/ to public/.`);
