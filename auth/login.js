/* Sign-in page: email → one-time code → back to the Organizer. No inline scripts (strict Content-Security-Policy). */

const T = {
  en: {
    pageTitle: 'Sign in · Padre Wasson Foundation Organizer',
    signInTitle: 'Sign in',
    signInLead: "Enter your email address and we'll send you a one-time code.",
    emailLabel: 'Email address',
    sendCode: 'Send code',
    codeTitle: 'Check your email',
    codeLeadBefore: 'If',
    codeLeadAfter: 'may use the Organizer, a code is on its way. It is valid for 10 minutes.',
    codeLabel: '8-character code',
    signIn: 'Sign in',
    resend: 'Send a new code',
    resendIn: (s) => `New code in ${s}s`,
    otherEmail: 'Use a different email',
    codeHelp: 'No email? Check your spam folder. Only approved addresses receive a code.',
    safety: 'Protected area. We will never ask for your code by phone, chat or email, and we never send sign-in links.',
    invalidEmail: 'Please enter a valid email address.',
    codeFormat: 'The code has 8 letters and numbers, for example K7PQ-M2XD.',
    wrongCode: (n) => (n === 1 ? 'That code is not right. 1 try left.' : `That code is not right. ${n} tries left.`),
    expired: 'This code has expired or was already used. Please request a new one.',
    tooMany: 'Too many wrong tries. Please request a new code.',
    cooldown: 'Please wait a minute before requesting another code.',
    rateLimited: 'Too many requests. Please try again in a while.',
    notConfigured: 'Sign-in is not set up yet. Please contact the person who manages the Organizer.',
    sendFailed: 'The email could not be sent. Please try again in a few minutes.',
    forbidden: 'This request was blocked. Please reload the page and try again.',
    network: 'No connection. Please check your internet and try again.',
    unknown: 'Something went wrong. Please try again.',
    newCodeSent: 'A new code is on its way.',
    sessionEnded: 'Your session has ended. Please sign in again.',
    signedOut: 'You have been signed out.',
    signingIn: 'Signed in. Opening the Organizer…',
  },
  de: {
    pageTitle: 'Anmelden · Padre Wasson Foundation Organizer',
    signInTitle: 'Anmelden',
    signInLead: 'Geben Sie Ihre E-Mail-Adresse ein. Wir schicken Ihnen einen Einmalcode.',
    emailLabel: 'E-Mail-Adresse',
    sendCode: 'Code senden',
    codeTitle: 'Schauen Sie in Ihr Postfach',
    codeLeadBefore: 'Falls',
    codeLeadAfter: 'den Organizer nutzen darf, ist ein Code unterwegs. Er ist 10 Minuten gültig.',
    codeLabel: '8-stelliger Code',
    signIn: 'Anmelden',
    resend: 'Neuen Code senden',
    resendIn: (s) => `Neuer Code in ${s} s`,
    otherEmail: 'Andere E-Mail-Adresse',
    codeHelp: 'Keine E-Mail? Sehen Sie im Spam-Ordner nach. Nur freigegebene Adressen erhalten einen Code.',
    safety: 'Geschützter Bereich. Wir fragen Sie nie am Telefon, im Chat oder per E-Mail nach Ihrem Code und verschicken nie Anmeldelinks.',
    invalidEmail: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
    codeFormat: 'Der Code hat 8 Buchstaben und Ziffern, zum Beispiel K7PQ-M2XD.',
    wrongCode: (n) => (n === 1 ? 'Der Code stimmt nicht. Noch 1 Versuch.' : `Der Code stimmt nicht. Noch ${n} Versuche.`),
    expired: 'Dieser Code ist abgelaufen oder wurde schon benutzt. Bitte fordern Sie einen neuen an.',
    tooMany: 'Zu viele falsche Versuche. Bitte fordern Sie einen neuen Code an.',
    cooldown: 'Bitte warten Sie eine Minute, bevor Sie einen neuen Code anfordern.',
    rateLimited: 'Zu viele Anfragen. Bitte versuchen Sie es später noch einmal.',
    notConfigured: 'Die Anmeldung ist noch nicht eingerichtet. Bitte wenden Sie sich an die Person, die den Organizer betreut.',
    sendFailed: 'Die E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es in ein paar Minuten noch einmal.',
    forbidden: 'Diese Anfrage wurde blockiert. Bitte laden Sie die Seite neu und versuchen Sie es noch einmal.',
    network: 'Keine Verbindung. Bitte prüfen Sie Ihr Internet und versuchen Sie es noch einmal.',
    unknown: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es noch einmal.',
    newCodeSent: 'Ein neuer Code ist unterwegs.',
    sessionEnded: 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
    signedOut: 'Sie wurden abgemeldet.',
    signingIn: 'Angemeldet. Der Organizer wird geöffnet …',
  },
};

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PENDING_KEY = 'pwo-login-pending';
const CODE_TTL_MS = 10 * 60 * 1000;

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const nextPath = safeNext(params.get('next'));

const readLocal = (key, fallback) => {
  try { const v = localStorage.getItem('pwcp:' + key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
};
const session = {
  get() { try { return JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null'); } catch { return null; } },
  set(v) { try { sessionStorage.setItem(PENDING_KEY, JSON.stringify(v)); } catch { /* private mode */ } },
  clear() { try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ } },
};

let lang = readLocal('uiLang', null) || ((navigator.language || '').toLowerCase().startsWith('de') ? 'de' : 'en');
if (!T[lang]) lang = 'en';
let email = '';
let resendTimer = null;
let resendAt = 0;
let lastError = null; // { el, key, arg } so errors can be re-rendered on language switch
let lastNotice = null;

function safeNext(n) {
  n = String(n || '');
  if (!n.startsWith('/') || n.startsWith('//') || n.startsWith('/\\') || n.length > 512) return '/';
  if (/[\u0000-\u001f\u007f\\]/.test(n) || n.startsWith('/login') || n.startsWith('/api/')) return '/';
  return n;
}

const t = (key, arg) => {
  const v = T[lang][key] ?? T.en[key];
  return typeof v === 'function' ? v(arg) : v;
};

/* ---------- brand: reuse the look chosen in the Organizer on this device ---------- */
function applyBrand() {
  const theme = readLocal('theme', null);
  const hex = /^#[0-9a-f]{6}$/i;
  if (theme && hex.test(theme.brand || '') && hex.test(theme.accent || '')) {
    const root = document.documentElement.style;
    root.setProperty('--brand', theme.brand);
    root.setProperty('--accent', theme.accent);
    root.setProperty('--on-brand', onColor(theme.brand));
    document.querySelector('meta[name="theme-color"]').content = theme.brand;
  }
  if (theme && typeof theme.logo === 'string' && /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(theme.logo)) {
    const img = new Image();
    img.alt = '';
    img.src = theme.logo;
    const mark = $('#mark');
    mark.replaceChildren(img);
    mark.classList.add('has-logo');
  }
  const settings = readLocal('settings', null);
  if (settings && typeof settings.orgName === 'string' && settings.orgName.trim()) {
    $('.org').textContent = settings.orgName.trim().slice(0, 80);
  }
}

function onColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.45 ? '#0f172a' : '#ffffff';
}

/* ---------- language ---------- */
function renderText() {
  document.documentElement.lang = lang;
  document.title = t('pageTitle');
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  updateResend();
  if (lastError) showError(lastError.el, lastError.key, lastError.arg);
  if (lastNotice) showNotice(lastNotice.key, lastNotice.warn);
}

document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
  lang = b.dataset.lang;
  try { localStorage.setItem('pwcp:uiLang', JSON.stringify(lang)); } catch { /* ignore */ }
  renderText();
}));

/* ---------- messages ---------- */
function showNotice(key, warn = false) {
  const n = $('#notice');
  lastNotice = key ? { key, warn } : null;
  n.hidden = !key;
  n.classList.toggle('warn', warn);
  if (key) n.textContent = t(key);
}

function showError(el, key, arg) {
  const box = $(el === 'email' ? '#email-error' : '#code-error');
  const input = $(el === 'email' ? '#email' : '#code');
  lastError = key ? { el, key, arg } : null;
  box.hidden = !key;
  input.setAttribute('aria-invalid', key ? 'true' : 'false');
  if (key) box.textContent = t(key, arg);
}

function clearErrors() { showError('email', null); showError('code', null); }

function setBusy(btn, busy) {
  btn.disabled = busy;
  btn.classList.toggle('busy', busy);
}

/* ---------- API ---------- */
async function api(path, body) {
  let res;
  try {
    res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { status: 0, data: { error: 'network' } };
  }
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON (e.g. firewall page) */ }
  return { status: res.status, data };
}

const ERROR_KEYS = {
  invalid_email: 'invalidEmail',
  cooldown: 'cooldown',
  rate_limited: 'rateLimited',
  not_configured: 'notConfigured',
  send_failed: 'sendFailed',
  forbidden: 'forbidden',
  network: 'network',
  expired: 'expired',
  too_many_attempts: 'tooMany',
};

function errorKey(status, data) {
  if (data && ERROR_KEYS[data.error]) return ERROR_KEYS[data.error];
  if (status === 429) return 'rateLimited';
  if (status === 403) return 'forbidden';
  return 'unknown';
}

/* ---------- step 1: email ---------- */
async function requestCode({ resend = false } = {}) {
  const btn = resend ? $('#resend') : $('#email-submit');
  clearErrors();
  showNotice(null);
  if (resend) btn.disabled = true; else setBusy(btn, true);
  const { status, data } = await api('/api/auth/request', { email, lang });
  if (!resend) setBusy(btn, false);
  if (status === 200) {
    session.set({ email, sentAt: Date.now() });
    startResendCountdown(data.resendIn || 60);
    if (resend) {
      showNotice('newCodeSent');
      $('#code').value = '';
    }
    showCodeStep();
    return;
  }
  if (resend) {
    updateResend();
    showError('code', errorKey(status, data));
    if (data.error === 'cooldown') startResendCountdown(data.retryIn || 60);
  } else {
    showError('email', errorKey(status, data));
    $('#email').focus();
  }
}

$('#email-step').addEventListener('submit', (e) => {
  e.preventDefault();
  const value = $('#email').value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254) {
    showError('email', 'invalidEmail');
    $('#email').focus();
    return;
  }
  email = value;
  requestCode();
});

$('#email').addEventListener('input', () => { if (lastError?.el === 'email') showError('email', null); });

/* ---------- step 2: code ---------- */
function showCodeStep() {
  $('#email-step').hidden = true;
  $('#code-step').hidden = false;
  $('#sent-to').textContent = email;
  $('#code').focus();
}

function showEmailStep() {
  session.clear();
  stopResendCountdown();
  clearErrors();
  showNotice(null);
  $('#code').value = '';
  $('#code-step').hidden = true;
  $('#email-step').hidden = false;
  $('#email').value = email;
  $('#email').focus();
  $('#email').select();
}

function cleanCode(v) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, '').split('').filter((c) => CODE_CHARS.includes(c)).join('').slice(0, 8);
}

$('#code').addEventListener('input', (e) => {
  const input = e.target;
  const raw = cleanCode(input.value);
  const formatted = raw.length > 4 ? raw.slice(0, 4) + '-' + raw.slice(4) : raw;
  if (input.value !== formatted) input.value = formatted;
  if (lastError?.el === 'code') showError('code', null);
  if (raw.length === 8 && e.inputType !== 'deleteContentBackward') $('#code-step').requestSubmit();
});

let verifying = false;
$('#code-step').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (verifying) return;
  const code = cleanCode($('#code').value);
  if (code.length !== 8) {
    showError('code', 'codeFormat');
    $('#code').focus();
    return;
  }
  verifying = true;
  const btn = $('#code-submit');
  setBusy(btn, true);
  showNotice(null);
  const { status, data } = await api('/api/auth/verify', { code, next: nextPath });
  if (status === 200 && data.ok) {
    session.clear();
    showNotice('signingIn');
    location.replace(safeNext(data.redirect));
    return;
  }
  verifying = false;
  setBusy(btn, false);
  if (data.error === 'invalid_code') {
    showError('code', 'wrongCode', data.attemptsLeft);
    $('#code').select();
  } else {
    showError('code', errorKey(status, data));
    if (data.error === 'expired' || data.error === 'too_many_attempts') {
      session.clear();
      stopResendCountdown();
      updateResend();
    }
  }
});

$('#resend').addEventListener('click', () => {
  if (Date.now() < resendAt) return;
  requestCode({ resend: true });
});
$('#change-email').addEventListener('click', showEmailStep);

/* ---------- resend countdown ---------- */
function startResendCountdown(seconds) {
  resendAt = Date.now() + seconds * 1000;
  stopResendCountdown();
  resendTimer = setInterval(updateResend, 1000);
  updateResend();
}
function stopResendCountdown() {
  clearInterval(resendTimer);
  resendTimer = null;
}
function updateResend() {
  const btn = $('#resend');
  const left = Math.ceil((resendAt - Date.now()) / 1000);
  if (left > 0) {
    btn.disabled = true;
    btn.textContent = t('resendIn', left);
  } else {
    stopResendCountdown();
    btn.disabled = false;
    btn.textContent = t('resend');
  }
}

/* ---------- start ---------- */
async function start() {
  applyBrand();
  if (params.get('expired') === '1') showNotice('sessionEnded', true);
  else if (params.get('signedout') === '1') showNotice('signedOut');
  renderText();

  // Already signed in (e.g. opened /login in a second tab)? Go straight to the app.
  try {
    const res = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
    if (res.ok) { location.replace(nextPath); return; }
  } catch { /* offline: stay here */ }

  // Reloaded while waiting for a code? Continue with the code step.
  const pending = session.get();
  if (pending && typeof pending.email === 'string' && Date.now() - pending.sentAt < CODE_TTL_MS) {
    email = pending.email;
    const waited = Math.floor((Date.now() - pending.sentAt) / 1000);
    if (waited < 60) startResendCountdown(60 - waited); else updateResend();
    showCodeStep();
  } else {
    session.clear();
    $('#email').focus();
  }
}

start();
