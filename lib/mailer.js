/* Sends the sign-in code by email: Resend (RESEND_API_KEY) or any SMTP mailbox (SMTP_HOST/USER/PASS). */

import { formatCode, CODE_TTL_S } from './auth-core.js';
import { describeAgent } from './http.js';

const APP_NAME = 'Padre Wasson Foundation Organizer';

export function mailConfig(env = process.env) {
  const from = String(env.MAIL_FROM || '').trim();
  if (env.RESEND_API_KEY) {
    if (!from) return null; // Resend needs a sender on a verified domain
    return { kind: 'resend', apiKey: env.RESEND_API_KEY, from: withName(from) };
  }
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    const port = Number(env.SMTP_PORT || 465);
    return {
      kind: 'smtp',
      host: env.SMTP_HOST,
      port,
      // 465 = TLS from the first byte; other ports (587) must upgrade with STARTTLS. SMTP_SECURE overrides.
      secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      from: withName(from || env.SMTP_USER),
    };
  }
  return null;
}

/** "someone@x.org" → "Padre Wasson Foundation Organizer <someone@x.org>"; values with a name stay as they are. */
function withName(from) {
  if (/[<>]/.test(from)) return from.replace(/[\r\n]/g, '');
  return `${APP_NAME} <${from.replace(/[\r\n<>"]/g, '')}>`;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TEXT = {
  en: {
    subject: `Your sign-in code for the ${APP_NAME}`,
    intro: `Here is your sign-in code for the ${APP_NAME}:`,
    valid: (min) => `It is valid for ${min} minutes and only works in the browser where you asked for it.`,
    where: 'Only type this code on',
    never: 'Nobody from the foundation will ever ask you for this code, not by phone, chat or email. We never send sign-in links.',
    details: 'Request details',
    time: 'Time',
    place: 'Approximate location',
    device: 'Browser',
    notYou: 'Not you? Just ignore this email. Without the code nobody can sign in, and it expires on its own.',
    tz: 'German time',
  },
  de: {
    subject: `Ihr Anmeldecode für den ${APP_NAME}`,
    intro: `Hier ist Ihr Anmeldecode für den ${APP_NAME}:`,
    valid: (min) => `Er ist ${min} Minuten gültig und funktioniert nur in dem Browser, in dem Sie ihn angefordert haben.`,
    where: 'Geben Sie diesen Code nur hier ein:',
    never: 'Niemand von der Stiftung wird Sie jemals nach diesem Code fragen, weder am Telefon noch per Chat oder E-Mail. Wir verschicken nie Anmeldelinks.',
    details: 'Details zur Anfrage',
    time: 'Zeit',
    place: 'Ungefährer Ort',
    device: 'Browser',
    notYou: 'Das waren nicht Sie? Dann ignorieren Sie diese E-Mail einfach. Ohne den Code kann sich niemand anmelden, und er läuft von selbst ab.',
    tz: 'deutsche Zeit',
  },
};

export function buildEmail({ code, lang = 'en', appUrl, client = {}, now = new Date(), timeZone = 'Europe/Berlin' }) {
  const t = TEXT[lang] || TEXT.en;
  const minutes = Math.round(CODE_TTL_S / 60);
  const pretty = formatCode(code);
  const loginUrl = appUrl.replace(/\/+$/, '') + '/login';
  const host = new URL(appUrl).host;
  let when;
  try {
    when = new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(now) + ` (${t.tz})`;
  } catch {
    when = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  }
  const place = [client.city, client.country].filter(Boolean).join(', ');
  const device = describeAgent(client.userAgent);
  const rows = [[t.time, when], place && [t.place, place], device && [t.device, device]].filter(Boolean);

  const text = [
    t.intro,
    '',
    `    ${pretty}`,
    '',
    t.valid(minutes),
    '',
    `${t.where} ${loginUrl}`,
    t.never,
    '',
    `${t.details}:`,
    ...rows.map(([k, v]) => `  ${k}: ${v}`),
    '',
    t.notYou,
  ].join('\n');

  const html = `<!doctype html>
<html lang="${lang === 'de' ? 'de' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(t.subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
<tr><td style="background:#1e3a8a;padding:18px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;">${esc(APP_NAME)}</td></tr>
<tr><td style="padding:28px 28px 8px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#0f172a;">${esc(t.intro)}</td></tr>
<tr><td align="center" style="padding:12px 28px 4px;">
  <div style="display:inline-block;font-family:'SFMono-Regular',Consolas,'Courier New',monospace;font-size:32px;letter-spacing:6px;font-weight:bold;color:#1e3a8a;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px 22px;">${esc(pretty)}</div>
</td></tr>
<tr><td style="padding:12px 28px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#334155;">${esc(t.valid(minutes))}</td></tr>
<tr><td style="padding:16px 28px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#334155;">${esc(t.where)} <strong style="color:#0f172a;">${esc(host)}</strong></td></tr>
<tr><td style="padding:8px 28px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#b91c1c;">${esc(t.never)}</td></tr>
<tr><td style="padding:20px 28px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
    <tr><td colspan="2" style="padding:10px 14px 4px;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:#475569;text-transform:uppercase;letter-spacing:.5px;">${esc(t.details)}</td></tr>
    ${rows.map(([k, v]) => `<tr><td width="1%" style="padding:3px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#64748b;white-space:nowrap;">${esc(k)}</td><td style="padding:3px 14px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#0f172a;">${esc(v)}</td></tr>`).join('')}
    <tr><td colspan="2" style="height:8px;"></td></tr>
  </table>
</td></tr>
<tr><td style="padding:18px 28px 28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#64748b;">${esc(t.notYou)}</td></tr>
</table>
</td></tr></table>
</body></html>`;

  return { subject: t.subject, text, html };
}

const EXTRA_HEADERS = {
  'Auto-Submitted': 'auto-generated',
  'X-Auto-Response-Suppress': 'All',
};

/** Sends the message. Throws on failure; never logs the code. */
export async function sendMail(cfg, to, message) {
  if (cfg.kind === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: cfg.from, to: [to], subject: message.subject, text: message.text, html: message.html, headers: EXTRA_HEADERS }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new Error(`Resend responded ${res.status}: ${detail}`);
    }
    return;
  }
  const { default: nodemailer } = await import('nodemailer');
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    requireTLS: !cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    tls: { minVersion: 'TLSv1.2' },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  try {
    await transport.sendMail({ from: cfg.from, to, subject: message.subject, text: message.text, html: message.html, headers: EXTRA_HEADERS });
  } finally {
    transport.close();
  }
}
