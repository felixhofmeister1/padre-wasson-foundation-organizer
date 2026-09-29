# Security

How the Organizer is protected when it runs on Vercel.

## Who can get in

- **Email one-time codes.** The site sends an 8-character code to the address you enter, but only if it is on `ALLOWED_EMAILS`. There are no passwords to steal, reuse or phish.
- **Codes are hard to guess.** 31⁸ ≈ 850 billion combinations, valid for 10 minutes, usable once, 5 wrong tries and the code is dead.
- **Codes are tied to one browser.** A code only works in the browser that asked for it (a signed, HttpOnly challenge cookie). A code read over someone's shoulder is useless elsewhere.
- **No list leaks.** The sign-in page answers the same way, with the same timing, whether an address is approved or not.
- **Sessions:** a signed, `HttpOnly`, `Secure`, `SameSite=Lax`, `__Host-` cookie that lasts 12 hours (`SESSION_HOURS`). Scripts on the page cannot read it. It stops working as soon as the address is removed from `ALLOWED_EMAILS`, `SESSION_VERSION` changes, or `AUTH_SECRET` changes. Signing out also marks the session as ended on the server.
- **Fails closed.** Without `AUTH_SECRET` nobody gets in.

## What is locked

`middleware.js` runs before every request. Without a valid session, pages redirect to `/login` and everything else returns `401`, including `index.html` itself. Only the sign-in page, its two files, the sign-in API and the open-source libraries and fonts in `vendor/` are public. The build publishes only the files the site needs; source code, tests and configuration are never served.

## Against phishing and page tampering

- **The email** names the real site, shows when, from where (approximate) and in which browser the code was requested, never puts the code in the subject line, and says clearly that nobody will ever ask for the code and that the site never sends sign-in links.
- **Content-Security-Policy:** only scripts from this site run, plus the one inline script identified by its SHA-256 hash. No `eval`, no plugins, no third-party scripts. The page cannot be framed (`frame-ancestors 'none'`, `X-Frame-Options: DENY`), which blocks clickjacking and look-alike overlays.
- **No third-party code or trackers:** Tailwind, pdf.js, mammoth and the fonts are served from `vendor/`, so there is no CDN that could be hijacked and no visitor data sent to Google Fonts.
- **Strict-Transport-Security** (HTTPS only), `nosniff`, `Referrer-Policy: same-origin`, `Cross-Origin-Opener-Policy`, a `Permissions-Policy` that switches off camera, microphone, location and payment, and `noindex` so the site stays out of search engines.
- **Cross-site requests** to the sign-in API are refused (Origin check, JSON only, SameSite cookies).
- **Open redirects** after sign-in are blocked: only paths on this site are accepted.

## Abuse limits

- One code per address per minute. On Vercel, the firewall rule `auth-code-email` can cap codes per address per hour.
- Vercel Firewall rate limits on `/api/auth/*` per IP address (set in the project's Firewall settings).
- Emails are only sent over TLS. SMTP servers without encryption are refused.
- Logs show masked addresses only (`f***x@example.com`); codes are never logged.

## Data

The Organizer keeps notes, files and texts in the browser only (localStorage / IndexedDB). The server stores nothing but short-lived counters (attempts, cooldowns, signed-out sessions). The WordPress application password is never saved.

## Operating it

- **Add or remove a person:** edit `ALLOWED_EMAILS` in Vercel, then redeploy.
- **Sign everyone out:** change `SESSION_VERSION` (or `AUTH_SECRET`), then redeploy.
- **Keep one official address:** switch off GitHub Pages for this repository (Settings → Pages), so there is no second, unprotected copy.
- **Report a problem:** contact the repository owner.
