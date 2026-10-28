/*
 * Retreat matching: scores every bookable trip against the four quiz answers and explains,
 * in plain words, why a trip fits and where it falls short.
 *
 * The rules are deliberately simple so anyone can follow them:
 *   craving  35 points if the trip has that theme
 *   when     25 points if it runs in the chosen month or season (10 if only a month away)
 *   budget   30 points if the price range overlaps the chosen band
 *            (20 if it is cheaper, 10 if it starts no more than £500 above the band)
 *   who      10 points if it suits solo travellers / couples / friends as chosen
 * A trip "ticks every box" when it fully meets all four answers. Those come first,
 * then the closest of the rest, so the results always fill up to three where trips exist.
 *
 * Pure functions with no DOM access: they run in the browser and under `node --test`.
 */

export const WEIGHTS = { craving: 35, when: 25, budget: 30, who: 10 };
export const PARTIAL_POINTS = { whenNearby: 10, budgetUnder: 20, budgetStretch: 10 };
export const BUDGET_STRETCH_GBP = 500;
export const MAX_SCORE = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);

export const THEMES = {
  adventure: { label: 'Adventure', lead: 'Real adventure', noun: 'an adventure trip' },
  restorative: { label: 'Restorative', lead: 'Deeply restorative', noun: 'a restorative retreat' },
  cultural: { label: 'Cultural discovery', lead: 'Rich in culture', noun: 'a cultural trip' },
  wild: { label: 'Wild places', lead: 'Truly wild places', noun: 'a wild-places trip' },
  sauna: { label: 'Sauna & cold plunge', lead: 'Sauna and cold water at its heart', noun: 'a sauna trip' },
  sun: { label: 'Sun & salt', lead: 'Sun and salt water', noun: 'a sun-and-sea trip' },
};

export const SEASONS = {
  spring: { label: 'Spring', range: 'Mar–May', months: [3, 4, 5] },
  summer: { label: 'Summer', range: 'Jun–Aug', months: [6, 7, 8] },
  autumn: { label: 'Autumn', range: 'Sep–Nov', months: [9, 10, 11] },
  winter: { label: 'Winter', range: 'Dec–Feb', months: [12, 1, 2] },
};

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTH_IDS = MONTH_NAMES.map((m) => m.slice(0, 3).toLowerCase());

export const BUDGETS = {
  'under-2500': { label: 'Under £2,500', min: 0, max: 2500, fits: 'within your £2,500 budget' },
  '2500-4000': { label: '£2,500–£4,000', min: 2500, max: 4000, fits: 'in your £2,500–£4,000 price range' },
  'over-4000': { label: '£4,000+', min: 4000, max: Infinity, fits: 'in your £4,000+ price range' },
};

export const TRAVELLERS = {
  solo: { label: 'Solo', fits: 'great for solo travellers', who: 'solo travellers' },
  couple: { label: 'As a couple', fits: 'lovely as a couple', who: 'couples' },
  friends: { label: 'With friends', fits: 'great to share with friends', who: 'groups of friends' },
};

export const STATUSES = ['available', 'few_places', 'sold_out'];

const DAY_MS = 86400000;

/* ---------- Answers ---------- */

export function isValidAnswer(key, value) {
  if (typeof value !== 'string') return false;
  switch (key) {
    case 'craving': return Object.hasOwn(THEMES, value);
    case 'when': return value === 'flexible' || Object.hasOwn(SEASONS, value) || MONTH_IDS.includes(value);
    case 'budget': return Object.hasOwn(BUDGETS, value);
    case 'who': return Object.hasOwn(TRAVELLERS, value);
    default: return false;
  }
}

export const ANSWER_KEYS = ['craving', 'when', 'budget', 'who'];

/** Reads answers from URLSearchParams (or a plain object). Returns null unless all four are valid. */
export function parseAnswers(source) {
  const get = (k) => (typeof source?.get === 'function' ? source.get(k) : source?.[k]);
  const answers = {};
  for (const key of ANSWER_KEYS) {
    const value = get(key);
    if (!isValidAnswer(key, value)) return null;
    answers[key] = value;
  }
  return answers;
}

export function whenLabel(when) {
  if (when === 'flexible') return 'Flexible';
  if (SEASONS[when]) return SEASONS[when].label;
  const i = MONTH_IDS.indexOf(when);
  return i >= 0 ? MONTH_NAMES[i] : '';
}

export function answerLabel(key, value) {
  switch (key) {
    case 'craving': return THEMES[value]?.label ?? '';
    case 'when': return whenLabel(value);
    case 'budget': return BUDGETS[value]?.label ?? '';
    case 'who': return TRAVELLERS[value]?.label ?? '';
    default: return '';
  }
}

/* ---------- Dates and prices ---------- */

/** "2027-02-20" -> UTC midnight timestamp, or NaN. */
export function parseISODate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!m) return NaN;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(t);
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? t : NaN;
}

/** Today's local date as a UTC-midnight timestamp, so it compares cleanly with trip dates. */
export function todayStamp(now = new Date()) {
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

function toStamp(today) {
  if (typeof today === 'number') return today;
  if (typeof today === 'string') return parseISODate(today);
  return todayStamp(today);
}

const SHORT_MONTHS = MONTH_NAMES.map((m) => m.slice(0, 3));

export function formatDate(stamp, { year = true } = {}) {
  const d = new Date(stamp);
  return `${d.getUTCDate()} ${SHORT_MONTHS[d.getUTCMonth()]}${year ? ' ' + d.getUTCFullYear() : ''}`;
}

/** "1–11 Nov 2026", "28 Feb – 6 Mar 2027", "29 Dec 2026 – 4 Jan 2027" */
export function formatDateRange(start, end) {
  const a = new Date(start);
  const b = new Date(end);
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `${formatDate(start)} – ${formatDate(end)}`;
  if (a.getUTCMonth() !== b.getUTCMonth()) return `${formatDate(start, { year: false })} – ${formatDate(end)}`;
  if (a.getUTCDate() === b.getUTCDate()) return formatDate(start);
  return `${a.getUTCDate()}–${formatDate(end)}`;
}

const GBP = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });

export function formatPrice(n) {
  return GBP.format(n);
}

export function formatPriceRange(min, max) {
  return max > min ? `${formatPrice(min)} – ${formatPrice(max)}` : formatPrice(min);
}

/* ---------- Trips ---------- */

function monthsBetween(start, end) {
  const months = [];
  const d = new Date(start);
  let y = d.getUTCFullYear();
  let m = d.getUTCMonth();
  const last = new Date(end);
  while (y < last.getUTCFullYear() || (y === last.getUTCFullYear() && m <= last.getUTCMonth())) {
    if (!months.includes(m + 1)) months.push(m + 1);
    m += 1;
    if (m === 12) { m = 0; y += 1; }
    if (months.length === 12) break;
  }
  return months;
}

function seasonsForMonths(months) {
  return Object.keys(SEASONS).filter((s) => SEASONS[s].months.some((m) => months.includes(m)));
}

function stringList(value) {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string').map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim().toLowerCase()];
  return [];
}

/**
 * Checks one raw trip from trips.json and fills in derived fields.
 * Returns { trip, warnings } or { error }.
 */
export function normaliseTrip(raw, index = 0) {
  const where = `Trip ${index + 1}${raw?.id ? ` ("${raw.id}")` : ''}`;
  if (!raw || typeof raw !== 'object') return { error: `${where} is not an object.` };
  const warnings = [];
  const missing = ['id', 'title', 'destination', 'start_date', 'end_date'].filter((k) => typeof raw[k] !== 'string' || !raw[k].trim());
  if (missing.length) return { error: `${where} is missing ${missing.join(', ')}.` };

  const start = parseISODate(raw.start_date);
  const end = parseISODate(raw.end_date);
  if (Number.isNaN(start) || Number.isNaN(end)) return { error: `${where} needs dates written as YYYY-MM-DD.` };
  if (end < start) return { error: `${where} ends before it starts.` };

  let priceMin = Number(raw.price_min);
  let priceMax = raw.price_max == null || raw.price_max === '' ? priceMin : Number(raw.price_max);
  if (!Number.isFinite(priceMin) || priceMin < 0) return { error: `${where} needs a price_min number.` };
  if (!Number.isFinite(priceMax)) priceMax = priceMin;
  if (priceMax < priceMin) {
    warnings.push(`${where}: price_max is below price_min, so they were swapped.`);
    [priceMin, priceMax] = [priceMax, priceMin];
  }

  const themes = stringList(raw.themes);
  for (const t of themes) if (!THEMES[t]) warnings.push(`${where}: unknown theme "${t}" (use ${Object.keys(THEMES).join(', ')}).`);

  const months = monthsBetween(start, end);
  let season = stringList(raw.season);
  for (const s of season) if (!SEASONS[s]) warnings.push(`${where}: unknown season "${s}" (use ${Object.keys(SEASONS).join(', ')}).`);
  season = season.filter((s) => SEASONS[s]);
  if (!season.length) season = seasonsForMonths(months);

  let suitableFor = stringList(raw.suitable_for);
  for (const w of suitableFor) if (!TRAVELLERS[w]) warnings.push(`${where}: unknown suitable_for "${w}" (use ${Object.keys(TRAVELLERS).join(', ')}).`);
  suitableFor = suitableFor.filter((w) => TRAVELLERS[w]);
  if (!suitableFor.length) suitableFor = Object.keys(TRAVELLERS);

  let status = typeof raw.status === 'string' ? raw.status.trim().toLowerCase() : 'available';
  if (!STATUSES.includes(status)) {
    warnings.push(`${where}: unknown status "${raw.status}", treated as available.`);
    status = 'available';
  }

  const derivedLength = Math.round((end - start) / DAY_MS) + 1;
  const lengthDays = Number.isInteger(raw.length_days) && raw.length_days > 0 ? raw.length_days : derivedLength;

  return {
    warnings,
    trip: {
      id: raw.id.trim(),
      title: raw.title.trim(),
      destination: raw.destination.trim(),
      teacher: typeof raw.teacher === 'string' ? raw.teacher.trim() : '',
      start,
      end,
      months,
      lengthDays,
      priceMin,
      priceMax,
      themes,
      season,
      suitableFor,
      status,
      summary: typeof raw.summary === 'string' ? raw.summary : '',
      highlights: Array.isArray(raw.highlights) ? raw.highlights.filter((h) => typeof h === 'string' && h.trim()) : [],
      scene: typeof raw.scene === 'string' ? raw.scene : '',
      image: typeof raw.image === 'string' ? raw.image.trim() : '',
      imageAlt: typeof raw.image_alt === 'string' ? raw.image_alt.trim() : '',
      url: typeof raw.url === 'string' ? raw.url.trim() : '',
    },
  };
}

/** Accepts the parsed trips.json (an object with "trips", or a bare array). */
export function loadTrips(data) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.trips) ? data.trips : null;
  if (!list) return { trips: [], warnings: ['trips.json should contain a "trips" list.'] };
  const trips = [];
  const warnings = [];
  const seen = new Set();
  list.forEach((raw, i) => {
    const { trip, error, warnings: w = [] } = normaliseTrip(raw, i);
    warnings.push(...w);
    if (error) { warnings.push(error + ' It was left out.'); return; }
    if (seen.has(trip.id)) { warnings.push(`Trip id "${trip.id}" appears twice; the second one was left out.`); return; }
    seen.add(trip.id);
    trips.push(trip);
  });
  trips.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
  return { trips, warnings };
}

/** Still to come (it has not started yet). */
export function isUpcoming(trip, today) {
  return trip.start >= toStamp(today);
}

/** Can be recommended: upcoming and not sold out. */
export function isBookable(trip, today) {
  return isUpcoming(trip, today) && trip.status !== 'sold_out';
}

/* ---------- Scoring ---------- */

const isNextTo = (a, b) => (a % 12) + 1 === b || (b % 12) + 1 === a;

function scoreWhen(trip, when) {
  if (when === 'flexible') return { status: 'full', points: WEIGHTS.when };
  const monthIndex = MONTH_IDS.indexOf(when);
  if (monthIndex >= 0) {
    const month = monthIndex + 1;
    if (trip.months.includes(month)) return { status: 'full', points: WEIGHTS.when };
    if (trip.months.some((m) => isNextTo(m, month))) return { status: 'partial', points: PARTIAL_POINTS.whenNearby };
    return { status: 'none', points: 0 };
  }
  const season = SEASONS[when];
  if (trip.season.includes(when)) return { status: 'full', points: WEIGHTS.when };
  if (trip.months.some((m) => season.months.some((s) => isNextTo(m, s)))) return { status: 'partial', points: PARTIAL_POINTS.whenNearby };
  return { status: 'none', points: 0 };
}

function scoreBudget(trip, budget) {
  const band = BUDGETS[budget];
  if (trip.priceMin <= band.max && trip.priceMax >= band.min) return { status: 'full', points: WEIGHTS.budget, fit: 'within' };
  if (trip.priceMax < band.min) return { status: 'full', points: PARTIAL_POINTS.budgetUnder, fit: 'under' };
  if (trip.priceMin <= band.max + BUDGET_STRETCH_GBP) return { status: 'partial', points: PARTIAL_POINTS.budgetStretch, fit: 'stretch' };
  return { status: 'none', points: 0, fit: 'over' };
}

/** Scores one trip. Every criterion carries its points so the breakdown can be shown as-is. */
export function scoreTrip(trip, answers) {
  const craving = trip.themes.includes(answers.craving)
    ? { status: 'full', points: WEIGHTS.craving }
    : { status: 'none', points: 0 };
  const who = trip.suitableFor.includes(answers.who)
    ? { status: 'full', points: WEIGHTS.who }
    : { status: 'none', points: 0 };
  const criteria = {
    craving: { ...craving, max: WEIGHTS.craving },
    when: { ...scoreWhen(trip, answers.when), max: WEIGHTS.when },
    budget: { ...scoreBudget(trip, answers.budget), max: WEIGHTS.budget },
    who: { ...who, max: WEIGHTS.who },
  };
  const score = ANSWER_KEYS.reduce((sum, k) => sum + criteria[k].points, 0);
  const fullCount = ANSWER_KEYS.filter((k) => criteria[k].status === 'full').length;
  return {
    trip,
    score,
    percent: Math.round((score / MAX_SCORE) * 100),
    criteria,
    fullCount,
    ticksEveryBox: fullCount === ANSWER_KEYS.length,
  };
}

function compareScored(a, b) {
  return (
    Number(b.ticksEveryBox) - Number(a.ticksEveryBox) ||
    b.score - a.score ||
    b.fullCount - a.fullCount ||
    a.trip.start - b.trip.start ||
    a.trip.id.localeCompare(b.trip.id)
  );
}

/**
 * Ranks the bookable trips and picks the top `limit`.
 * outcome: "matches"  – at least `limit` trips tick every box
 *          "some"     – a few tick every box; the rest of the picks are the closest
 *          "closest"  – none tick every box; the picks are the closest
 *          "none"     – there are no bookable trips at all
 */
export function rankTrips(trips, answers, { today = new Date(), limit = 3 } = {}) {
  const bookable = trips.filter((t) => isBookable(t, today));
  const scored = bookable.map((t) => scoreTrip(t, answers)).sort(compareScored);
  const picks = scored.slice(0, limit);
  const matchCount = scored.filter((s) => s.ticksEveryBox).length;
  let outcome = 'matches';
  if (!picks.length) outcome = 'none';
  else if (matchCount === 0) outcome = 'closest';
  else if (matchCount < picks.length) outcome = 'some';
  return { picks, matchCount, bookableCount: bookable.length, outcome, ranked: scored };
}

/* ---------- Reasons ---------- */

export function joinAnd(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function tripMonthsText(trip) {
  return joinAnd(trip.months.map((m) => MONTH_NAMES[m - 1]));
}

/**
 * The one-line "why this matches you" and an optional "worth knowing" line,
 * both built only from the tags that did or did not match.
 */
export function explainMatch(scored, answers) {
  const { trip, criteria } = scored;
  const positives = [];

  if (criteria.when.status === 'full') {
    if (answers.when === 'flexible') positives.push(`departing ${formatDate(trip.start)}`);
    else if (SEASONS[answers.when]) positives.push(`in ${SEASONS[answers.when].label.toLowerCase()}`);
    else positives.push(`in ${whenLabel(answers.when)}`);
  }
  if (criteria.budget.fit === 'within') positives.push(BUDGETS[answers.budget].fits);
  if (criteria.budget.fit === 'under') positives.push('comfortably under your budget');
  if (criteria.who.status === 'full') positives.push(TRAVELLERS[answers.who].fits);

  const theme = THEMES[answers.craving];
  let why;
  if (criteria.craving.status === 'full') why = positives.length ? `${theme.lead}: ${joinAnd(positives)}.` : `${theme.lead}.`;
  else why = positives.length ? `Not ${theme.noun}, but ${joinAnd(positives)}.` : 'The closest trip to your answers.';

  const issues = [];
  const chosenWhen = SEASONS[answers.when] ? SEASONS[answers.when].label.toLowerCase() : whenLabel(answers.when);
  if (criteria.when.status === 'partial') issues.push(`it runs in ${tripMonthsText(trip)}, just outside ${chosenWhen}`);
  if (criteria.when.status === 'none') issues.push(`it runs in ${tripMonthsText(trip)}, not ${chosenWhen}`);
  if (criteria.budget.fit === 'stretch') issues.push(`it starts at ${formatPrice(trip.priceMin)}, a little over your budget`);
  if (criteria.budget.fit === 'over') issues.push(`it starts at ${formatPrice(trip.priceMin)}, above your budget`);
  if (criteria.who.status === 'none') issues.push(`it's best suited to ${joinAnd(trip.suitableFor.map((w) => TRAVELLERS[w].who))}`);

  const caveat = issues.length ? `Worth knowing: ${issues.join('; ')}.` : null;
  return { why: why.charAt(0).toUpperCase() + why.slice(1), caveat };
}

/** Rows for the "How we scored this" breakdown. */
export function scoreBreakdown(scored, answers) {
  const { trip, criteria } = scored;
  const whenDetail = {
    full: 'Fits your dates',
    partial: `Runs in ${tripMonthsText(trip)}, a month away`,
    none: `Runs in ${tripMonthsText(trip)}`,
  }[criteria.when.status];
  const budgetDetail = {
    within: 'In your price range',
    under: 'Under your budget',
    stretch: 'Slightly over your budget',
    over: 'Over your budget',
  }[criteria.budget.fit];
  return [
    { key: 'craving', question: 'Craving', answer: answerLabel('craving', answers.craving), detail: criteria.craving.status === 'full' ? 'A main theme of this trip' : 'Not a main theme', ...criteria.craving },
    { key: 'when', question: 'When', answer: answerLabel('when', answers.when), detail: whenDetail, ...criteria.when },
    { key: 'budget', question: 'Budget', answer: answerLabel('budget', answers.budget), detail: budgetDetail, ...criteria.budget },
    { key: 'who', question: 'Travelling', answer: answerLabel('who', answers.who), detail: criteria.who.status === 'full' ? 'Suits you' : 'Better for others', ...criteria.who },
  ];
}
