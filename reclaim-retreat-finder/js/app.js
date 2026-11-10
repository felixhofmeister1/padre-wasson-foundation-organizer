/*
 * "Find your retreat" prototype: a homepage and the Our Trips page, with the four-question quiz,
 * the team's picks, filters and the results. Views switch on the URL hash (#home, #our-trips).
 * All trip data comes from trips.json; the scoring and filtering rules live in matching.js.
 */

import {
  ANSWER_KEYS, BUDGETS, BUDGET_STRETCH_GBP, MAX_SCORE, MONTH_IDS, MONTH_NAMES, PACES, PARTIAL_POINTS, PROFILE_KEYS,
  SEASONS, THEMES, TRAVEL, WEIGHTS,
  answerLabel, explainMatch, featuredTrips, filterCounts, filterTrips, formatDateRange, formatPrice, formatPriceRange,
  isUpcoming, loadTrips, parseAnswers, parseISODate, rankTrips, scoreBreakdown, todayStamp,
} from './matching.js';
import { sceneSVG } from './scenes.js';
import { article, personaFromAnswers, personaFromFilters, shareText } from './persona.js';

/* ---------- Icons ---------- */

const ICONS = {
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  pencil: '<path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16v4zM13.5 6.5l4 4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  price: '<path d="M3.5 12.5V4.5h8l9 9-8 8z"/><circle cx="8" cy="9" r="1.5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  adventure: '<path d="M2.5 20l7-12 4 6.5 2.5-3.5 5.5 9z"/><path d="M9.5 8V3.5l4 1.5-4 1.5"/>',
  restorative: '<path d="M12 20c-4.5 0-8-2.5-9-6 3 0 5.5 1 7 3M12 20c4.5 0 8-2.5 9-6-3 0-5.5 1-7 3M12 20c-2.5-2.5-3.5-5.5-3.5-8.5S10 6 12 4c2 2 3.5 4.5 3.5 7.5S14.5 17.5 12 20z"/>',
  cultural: '<path d="M3 20h18M5 20v-8M19 20v-8M3.5 12h17L12 4.5zM9.5 20v-4a2.5 2.5 0 015 0v4"/>',
  wild: '<path d="M12 3l5 7h-3l4 6H6l4-6H7z"/><path d="M12 16v5"/>',
  sauna: '<path d="M8 10.5c-1.4-1.4 1.4-2.8 0-4.2M12 10.5c-1.4-1.4 1.4-2.8 0-4.2M16 10.5c-1.4-1.4 1.4-2.8 0-4.2"/><path d="M3 15.5c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1M3 19.5c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1"/>',
  sun: '<circle cx="12" cy="9" r="3.5"/><path d="M12 2.5V4M5.5 9H4M20 9h-1.5M7.4 4.4l1 1M16.6 4.4l-1 1"/><path d="M3 16c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1M3 20c1.5 0 1.5 1 3 1s1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1"/>',
  spring: '<path d="M12 20v-8M12 12c0-3.5-2.5-6-6.5-6 0 3.5 2.5 6 6.5 6zM12 14.5c0-3 2-5.5 6.5-5.5 0 3-2 5.5-6.5 5.5z"/>',
  summer: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  autumn: '<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14zM5 19l7-7"/>',
  winter: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/>',
  flexible: '<path d="M7 9a3 3 0 100 6c2.5 0 3.5-2 5-3s2.5-3 5-3a3 3 0 110 6c-2.5 0-3.5-2-5-3S9.5 9 7 9z"/>',
  solo: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  couple: '<circle cx="8.5" cy="8.5" r="3"/><circle cx="16" cy="8.5" r="3"/><path d="M2.5 19.5c.6-3 3-4.8 6-4.8s5.4 1.8 6 4.8M15 14.8c3 0 5.4 1.8 6 4.7"/>',
  friends: '<circle cx="12" cy="7.5" r="3"/><circle cx="5.5" cy="10" r="2.3"/><circle cx="18.5" cy="10" r="2.3"/><path d="M6.5 20c.5-3 2.7-4.8 5.5-4.8s5 1.8 5.5 4.8M1.8 18c.3-2 1.7-3.3 3.7-3.4M22.2 18c-.3-2-1.7-3.3-3.7-3.4"/>',
};

function icon(name, extraClass = '') {
  return `<svg class="icon ${extraClass}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];
const word = (n) => WORDS[n] ?? String(n);
const plural = (n, one, many) => (n === 1 ? one : many);
const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- Questions ---------- */

const QUESTIONS = [
  {
    key: 'craving',
    title: 'What are you craving?',
    hint: 'Choose the one that pulls at you most.',
    groups: [{
      layout: 'grid',
      options: [
        { value: 'adventure', icon: 'adventure', hint: 'Treks, big landscapes and a bit of a challenge' },
        { value: 'restorative', icon: 'restorative', hint: 'Yoga, rest and time to slow right down' },
        { value: 'cultural', icon: 'cultural', hint: 'Local life, food and traditions' },
        { value: 'wild', icon: 'wild', hint: 'Remote nature and wildlife' },
        { value: 'sauna', icon: 'sauna', hint: 'Heat, ice and cold-water swims' },
        { value: 'sun', icon: 'sun', hint: 'Warm seas, islands and beaches' },
      ].map((o) => ({ ...o, label: THEMES[o.value].label })),
    }],
  },
  {
    key: 'when',
    title: 'When can you travel?',
    hint: 'Pick a season, or a month if you already know.',
    groups: [
      {
        layout: 'seasons',
        options: [
          ...Object.entries(SEASONS).map(([value, s]) => ({ value, icon: value, label: s.label, hint: s.range })),
          { value: 'flexible', icon: 'flexible', label: "I'm flexible", hint: 'Show me any time of year' },
        ],
      },
      {
        layout: 'months',
        label: 'Or choose a month',
        options: MONTH_IDS.map((value, i) => ({ value, label: MONTH_NAMES[i].slice(0, 3), ariaLabel: MONTH_NAMES[i] })),
      },
    ],
  },
  {
    key: 'budget',
    title: "What's your budget?",
    hint: 'Per person, as shown on each trip.',
    groups: [{
      layout: 'three',
      options: [
        { value: 'under-2500', glyph: '£', hint: 'Shorter escapes, closer to home' },
        { value: '2500-4000', glyph: '££', hint: 'A week or more, further afield' },
        { value: 'over-4000', glyph: '£££', hint: 'Bucket-list journeys' },
      ].map((o) => ({ ...o, label: BUDGETS[o.value].label })),
    }],
  },
  {
    key: 'who',
    title: "Who's travelling?",
    hint: "Every trip is a small group, so you'll have good company whoever you come with.",
    groups: [{
      layout: 'three',
      options: [
        { value: 'solo', icon: 'solo', label: 'Solo', hint: 'Just me, happy to meet new people' },
        { value: 'couple', icon: 'couple', label: 'As a couple', hint: 'The two of us' },
        { value: 'friends', icon: 'friends', label: 'With friends', hint: 'A few of us together' },
      ],
    }],
  },
];

const RESULTS_STEP = QUESTIONS.length;
const CHIP_NAMES = { craving: 'what you’re craving', when: 'when you can travel', budget: 'your budget', who: 'who’s travelling' };

/* ---------- State and elements ---------- */

const state = {
  trips: [],
  loaded: false,
  today: todayStamp(),
  open: false,
  step: 0,
  answers: {},
  editing: false,
  busy: false,
  result: null,
  signup: null,
  lastProgress: 0,
  view: null,
  filters: { theme: '', season: '', budget: '', pace: '', travel: '' },
};

const $ = (id) => document.getElementById(id);
const els = {
  finder: $('find-your-retreat'),
  banner: $('finder-banner'),
  panel: $('finder-panel'),
  openBtn: $('open-quiz'),
  openLabel: $('open-quiz-label'),
  heroArt: $('hero-art'),
  list: $('trip-list'),
  count: $('trips-count'),
  trips: $('trips'),
  pill: $('finder-pill'),
  pillLabel: $('finder-pill-label'),
  dialog: $('trip-dialog'),
  dialogContent: $('dialog-content'),
  navToggle: document.querySelector('.nav-toggle'),
  navList: $('nav-list'),
  navTrips: document.querySelector('[data-nav="trips"]'),
  views: { home: $('home'), trips: $('our-trips') },
  homeTitle: $('home-title'),
  pageTitle: $('page-title'),
  homeHero: document.querySelector('.home-hero'),
  homeArt: $('home-art'),
  ctaProposed: $('cta-proposed'),
  ctaProposedNote: $('cta-proposed-note'),
  ctaToday: $('cta-today'),
  compareBtns: [...document.querySelectorAll('[data-compare]')],
  waysCount: $('ways-count'),
  picks: $('picks'),
  picksList: $('picks-list'),
  picksTitle: $('picks-title'),
  picksLede: document.querySelector('.picks__lede'),
  filters: Object.fromEntries([...document.querySelectorAll('[data-filter]')].map((el) => [el.dataset.filter, el])),
  filtersClear: $('filters-clear'),
  moreFilters: $('more-filters'),
  personaPanel: $('persona-panel'),
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const scrollBehavior = () => (reducedMotion.matches ? 'auto' : 'smooth');

let resolveLoaded;
const tripsLoaded = new Promise((resolve) => { resolveLoaded = resolve; });

/* ---------- Shared bits of markup ---------- */

function media(trip, { decorative = false } = {}) {
  const label = decorative ? '' : trip.imageAlt || `${trip.destination}, illustration`;
  if (trip.image) {
    return `<img src="${esc(trip.image)}" alt="${esc(label)}" loading="lazy" decoding="async">`;
  }
  return sceneSVG(trip.scene, { seed: trip.id, label });
}

function statusBadge(trip) {
  if (trip.status === 'sold_out') return `<span class="badge badge--status badge--sold">Sold out</span>`;
  if (trip.status === 'few_places') return `<span class="badge badge--status">Few places left</span>`;
  return '';
}

function metaList(trip, extraClass = '') {
  return `<ul class="meta ${extraClass}">
    <li>${icon('calendar')}<span>${esc(formatDateRange(trip.start, trip.end))} · ${trip.nights ? `${trip.nights} nights` : `${trip.lengthDays} days`}</span></li>
    ${trip.teacher ? `<li>${icon('user')}<span>With ${esc(trip.teacher)}</span></li>` : ''}
    <li>${icon('price')}<span><strong>${esc(formatPriceRange(trip.priceMin, trip.priceMax))}</strong> per person</span></li>
  </ul>`;
}

function moreButton(trip, style = 'btn--forest') {
  const inner = `Find out more<span class="visually-hidden"> about ${esc(trip.title)}</span>${icon('arrowRight', 'icon--nudge')}`;
  if (trip.url) return `<a class="btn ${style}" href="${esc(trip.url)}">${inner}</a>`;
  return `<button class="btn ${style}" type="button" data-action="trip" data-trip="${esc(trip.id)}">${inner}</button>`;
}

const themeLine = (trip) => trip.themes.filter((t) => THEMES[t]).map((t) => THEMES[t].label).join(' · ');

/* ---------- Traveller type (persona) ---------- */

const MODE_LABEL = {
  quiz: 'Diagnostic mode · from your quiz answers',
  filters: 'Filtering mode · from your filters',
};

function shareUrl() {
  // Only offer the page address where it is a real, shareable one (not inside an embedding frame).
  const framed = window.self !== window.top;
  return !framed && /^https?:$/.test(window.location.protocol) ? window.location.origin + window.location.pathname : '';
}

function personaCard(persona, { headingTag = 'h3', headingId = '', topTrip = null, note = '' } = {}) {
  const id = headingId ? ` id="${headingId}" tabindex="-1"` : '';
  const text = shareText(persona, topTrip, shareUrl());
  return `<div class="persona persona--${persona.key}">
    <div class="persona__emblem" aria-hidden="true">${icon(persona.key)}</div>
    <div class="persona__body">
      <p class="persona__mode">${esc(MODE_LABEL[persona.source])}</p>
      <${headingTag} class="persona__name"${id}>You’re ${article(persona.name)} <span>${esc(persona.name)}</span></${headingTag}>
      ${persona.streak ? `<p class="persona__streak">with ${article(persona.streak)} ${esc(persona.streak)} streak</p>` : ''}
      <p class="persona__tagline">${esc(persona.tagline)}</p>
      <p class="persona__summary">${esc(persona.summary)}</p>
      ${persona.traits.length ? `<ul class="persona__traits" aria-label="Your traits">${persona.traits.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      ${note ? `<p class="persona__note">${esc(note)}</p>` : ''}
      <div class="persona__share">
        <button class="btn btn--outline btn--small" type="button" data-action="share-persona" data-share="${esc(text)}">Copy my traveller type</button>
        <p class="persona__status" role="status"></p>
      </div>
    </div>
  </div>`;
}

/** Next to the trip list: filtering mode while filters are on, else the quiz result, else an invitation. */
function renderPersonaPanel(upcoming, shown) {
  const fromFilters = isFiltered() ? personaFromFilters(state.filters, shown, upcoming) : null;
  state.filterPersona = fromFilters;
  const quizTrips = state.result ? state.result.picks.map((p) => p.trip) : [];
  const fromQuiz = !fromFilters && state.result ? personaFromAnswers(state.answers, quizTrips) : null;
  if (fromFilters) {
    els.personaPanel.innerHTML = personaCard(fromFilters, { topTrip: shown[0] });
  } else if (fromQuiz) {
    els.personaPanel.innerHTML = personaCard(fromQuiz, { topTrip: quizTrips[0], note: 'Your quiz matches are marked in the list.' });
  } else {
    els.personaPanel.innerHTML = `<div class="persona persona--invite">
      <div class="persona__emblem" aria-hidden="true">${icon('compass')}</div>
      <div class="persona__body">
        <p class="persona__mode">Two ways to find out</p>
        <h3 class="persona__name">What kind of traveller are you?</h3>
        <p class="persona__summary"><b>Filtering mode:</b> pick a filter above and we’ll work out your traveller type as you go.</p>
        <p class="persona__summary"><b>Diagnostic mode:</b> answer four quick questions for your type and your three best trips.</p>
        <div class="persona__share"><button class="btn btn--forest btn--small" type="button" data-action="diagnose">Diagnose me ${icon('arrowRight', 'icon--nudge')}</button></div>
      </div>
    </div>`;
  }
}

/* ---------- Trip list ---------- */

function tripCard(trip, { isMatch = false, pick = false } = {}) {
  const classes = ['trip-card', pick && 'trip-card--pick', trip.status === 'sold_out' && 'is-sold-out', isMatch && 'is-match'].filter(Boolean).join(' ');
  const corner = pick && trip.featured
    ? `<span class="badge badge--pick">${esc(trip.featured)}</span>`
    : isMatch ? `<span class="badge">${icon('check')}Your match</span>` : '';
  return `<li class="${classes}"${pick ? '' : ` id="trip-${esc(trip.id)}"`}>
    <div class="media">${media(trip)}${corner}${statusBadge(trip)}</div>
    <p class="eyebrow">${esc(trip.destination)}</p>
    <h3 class="trip-card__title">${esc(trip.title)}</h3>
    ${!pick && themeLine(trip) ? `<p class="trip-card__themes">${esc(themeLine(trip))}</p>` : ''}
    ${metaList(trip)}
    ${moreButton(trip, 'btn--outline btn--small')}
  </li>`;
}

function renderPicks(matches) {
  const picks = featuredTrips(state.trips, state.today, 3);
  els.picks.hidden = picks.length === 0;
  if (!picks.length) return;
  els.picksTitle.textContent = picks.length === 1 ? 'Start with our pick' : `Start with our ${word(picks.length)} picks`;
  els.picksLede.textContent = picks.length === 1
    ? 'If you only look at one trip, make it this one.'
    : `If you only look at ${word(picks.length)} trips, make it these.`;
  els.picksList.innerHTML = picks.map((t) => tripCard(t, { pick: true, isMatch: matches.has(t.id) })).join('');
}

const FILTER_KEYS = ['theme', 'season', 'budget', 'pace', 'travel'];
const EXTRA_FILTERS = ['pace', 'travel']; // only shown when the trip data has them
const FILTER_ANY = { theme: 'Any type', season: 'Any time', budget: 'Any budget', pace: 'Any pace', travel: 'Any distance' };
const FILTER_LABEL = {
  theme: (v) => THEMES[v].label,
  season: (v) => SEASONS[v].label,
  budget: (v) => BUDGETS[v].label,
  pace: (v) => PACES[v].label,
  travel: (v) => TRAVEL[v].label,
};
const isFiltered = () => FILTER_KEYS.some((k) => state.filters[k]);
const emptyFilters = () => Object.fromEntries(FILTER_KEYS.map((k) => [k, '']));

function renderFilters(upcoming) {
  const extras = EXTRA_FILTERS.filter((key) => upcoming.some((t) => t[key]));
  els.moreFilters.hidden = extras.length === 0;
  for (const key of EXTRA_FILTERS) els.filters[key].closest('.filter').hidden = !extras.includes(key);
  for (const key of FILTER_KEYS) {
    const current = state.filters[key];
    const counts = filterCounts(upcoming, state.filters, key);
    const any = filterTrips(upcoming, { ...state.filters, [key]: '' }).length;
    // Options that would show nothing are disabled, so a filter never leads to an empty page.
    els.filters[key].innerHTML = `<option value="">${FILTER_ANY[key]} (${any})</option>` +
      Object.entries(counts).map(([value, n]) => `<option value="${value}"${n === 0 && value !== current ? ' disabled' : ''}>${esc(FILTER_LABEL[key](value))} (${n})</option>`).join('');
    els.filters[key].value = current;
  }
  els.filtersClear.hidden = !isFiltered();
  if (EXTRA_FILTERS.some((k) => state.filters[k])) els.moreFilters.open = true;
}

function renderList() {
  const upcoming = state.trips.filter((t) => isUpcoming(t, state.today));
  const matches = new Set(state.result ? state.result.picks.map((p) => p.trip.id) : []);
  renderPicks(matches);
  renderFilters(upcoming);
  els.waysCount.textContent = upcoming.length ? `all ${upcoming.length} trips` : 'every trip';

  if (!upcoming.length) {
    els.count.textContent = 'No upcoming trips';
    els.list.innerHTML = '<li class="trips__empty">New dates are coming soon.</li>';
    return;
  }

  const shown = filterTrips(upcoming, state.filters);
  renderPersonaPanel(upcoming, shown);
  const marked = matches.size ? ' · your matches are marked' : '';
  const type = state.filterPersona ? ` · you’re ${article(state.filterPersona.name)} ${state.filterPersona.name}` : '';
  els.count.textContent = isFiltered()
    ? `Showing ${shown.length} of ${upcoming.length} trips${type}${marked}`
    : `${upcoming.length} upcoming ${plural(upcoming.length, 'trip', 'trips')}, soonest first${marked}`;
  els.list.innerHTML = shown.length
    ? shown.map((trip) => tripCard(trip, { isMatch: matches.has(trip.id) })).join('')
    : `<li class="trips__empty">No trips match all of those. <button class="text-link" type="button" data-action="clear-filters">Clear filters</button> or <a href="#find-your-retreat">let the quiz find the closest</a>.</li>`;
}

/* ---------- Quiz ---------- */

function quizBar({ backLabel, stepLabel }) {
  return `<div class="quiz__bar">
    ${backLabel ? `<button class="pill-btn" type="button" data-action="back">${icon('arrowLeft')}<span>${esc(backLabel)}</span></button>` : '<span></span>'}
    <p class="quiz__step">${esc(stepLabel)}</p>
    <button class="pill-btn" type="button" data-action="close" aria-label="Close the trip finder">${icon('close')}<span>Close</span></button>
  </div>
  <div class="quiz__progress" aria-hidden="true"><span></span></div>`;
}

function optionButton(question, option) {
  const pressed = state.answers[question.key] === option.value;
  const iconHtml = option.glyph
    ? `<span class="option__icon" aria-hidden="true">${esc(option.glyph)}</span>`
    : option.icon ? `<span class="option__icon">${icon(option.icon)}</span>` : '';
  const text = option.hint
    ? `<span><span class="option__label">${esc(option.label)}</span><span class="option__hint">${esc(option.hint)}</span></span>`
    : `<span class="option__label">${esc(option.label)}</span>`;
  const aria = option.ariaLabel ? ` aria-label="${esc(option.ariaLabel)}"` : '';
  const check = option.hint ? `<span class="option__check">${icon('check')}</span>` : '';
  return `<button class="option" type="button" data-answer="${esc(option.value)}" data-key="${question.key}" aria-pressed="${pressed}"${aria}>${iconHtml}${text}${check}</button>`;
}

function renderQuestion() {
  const index = state.step;
  const q = QUESTIONS[index];
  const answered = Boolean(state.answers[q.key]);
  const isLast = index === QUESTIONS.length - 1;
  const backLabel = state.editing ? 'Back to results' : index > 0 ? 'Back' : '';
  const nextLabel = state.editing || isLast ? 'See my matches' : 'Next';

  const groups = q.groups.map((g, gi) => {
    const labelId = `q-${q.key}-group-${gi}`;
    const label = g.label ? `<p class="group-label" id="${labelId}">${esc(g.label)}</p>` : '';
    const labelledBy = g.label ? `q-title ${labelId}` : 'q-title';
    return `${label}<div class="options options--${g.layout}" role="group" aria-labelledby="${labelledBy}">${g.options.map((o) => optionButton(q, o)).join('')}</div>`;
  }).join('');

  els.panel.innerHTML = `${quizBar({ backLabel, stepLabel: `Question ${index + 1} of ${QUESTIONS.length}` })}
    <div class="quiz__body">
      <h2 class="quiz__question" id="q-title" tabindex="-1">${esc(q.title)}</h2>
      <p class="quiz__hint">${esc(q.hint)}</p>
      ${groups}
      <div class="quiz__footer">
        <p class="finder__note">Not for you right now? <a href="#trips" data-action="browse">Browse all trips</a></p>
        ${answered ? `<button class="btn btn--cream" type="button" data-action="next">${esc(nextLabel)}${icon('arrowRight', 'icon--nudge')}</button>` : ''}
      </div>
    </div>`;
  setProgress((index + 1) / (QUESTIONS.length + 1));
}

function resultsCopy(result) {
  const n = result.picks.length;
  const extra = n - result.matchCount;
  const short = result.bookableCount < 3 && n > 0
    ? ` We only have ${word(result.bookableCount)} ${plural(result.bookableCount, 'trip', 'trips')} with places left right now.`
    : '';
  switch (result.outcome) {
    case 'matches':
      return {
        title: n === 1 ? 'Your top retreat' : `Your top ${n} retreats`,
        intro: n === 1 ? 'It ticks every box. Here’s why it suits you.' : `All ${word(n)} tick every box. Here’s why each one suits you.`,
        notice: short.trim() || null,
      };
    case 'some':
      return {
        title: `${capitalise(word(result.matchCount))} ${plural(result.matchCount, 'trip ticks', 'trips tick')} every box`,
        intro: `Here’s why ${plural(result.matchCount, 'it suits', 'they suit')} you, plus the next best ${plural(extra, 'option', 'options')}.`,
        notice: `Only ${word(result.matchCount)} ${plural(result.matchCount, 'trip matches', 'trips match')} everything you told us, so we’ve added the ${extra === 1 ? 'closest alternative' : `${word(extra)} closest alternatives`} and flagged where ${extra === 1 ? 'it differs' : 'they differ'}.${short}`,
      };
    case 'closest':
      return {
        title: 'Your closest matches',
        intro: '',
        notice: `Nothing ticks every box for those answers, so ${n === 1 ? 'this is the closest trip' : `these are the ${word(n)} closest`}. Each card says where it differs. Try another month or budget, or browse every trip below.${short}`,
      };
    default:
      return {
        title: 'No trips to match right now',
        intro: '',
        notice: 'All our upcoming trips are full or already under way. Leave your email and we’ll tell you first when new dates are released.',
      };
  }
}

function resultCard(scored, index) {
  const { trip } = scored;
  const { why, caveat } = explainMatch(scored, state.answers);
  const badge = scored.ticksEveryBox
    ? `<span class="badge">${icon('check')}${index === 0 ? 'Best match' : 'Great match'}</span>`
    : `<span class="badge badge--close">Close match</span>`;
  const rows = scoreBreakdown(scored, state.answers).map((r) => `<tr class="is-${r.status}">
      <th scope="row">${esc(r.question)}<span>${esc(r.answer)}</span></th>
      <td>${esc(r.detail)}</td>
      <td>${r.max ? `${r.points}/${r.max}` : '–'}</td>
    </tr>`).join('');
  return `<li class="result-card">
    <div class="media">${media(trip)}${badge}${statusBadge(trip)}</div>
    <div class="result-card__body">
      <p class="eyebrow">${esc(trip.destination)}</p>
      <h3 class="result-card__title">${esc(trip.title)}</h3>
      ${metaList(trip)}
      <div class="why">
        <p class="why__label">Why this matches you</p>
        <p class="why__text">${esc(why)}</p>
        ${caveat ? `<p class="why__caveat">${esc(caveat)}</p>` : ''}
      </div>
      <div class="result-card__actions">
        ${moreButton(trip)}
        <details class="score">
          <summary>How we scored this: ${scored.score}/${scored.max} ${icon('chevron')}</summary>
          <table>
            <caption class="visually-hidden">Score breakdown for ${esc(trip.title)}</caption>
            <thead class="visually-hidden"><tr><th scope="col">Question and your answer</th><th scope="col">How this trip fits</th><th scope="col">Points</th></tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><th scope="row">Total</th><td></td><td>${scored.score}/${scored.max}</td></tr></tfoot>
          </table>
        </details>
      </div>
    </div>
  </li>`;
}

function signupBox(result) {
  if (state.signup) {
    const name = state.signup.name ? `, ${esc(state.signup.name)}` : '';
    return `<section class="signup" aria-labelledby="signup-title">
      <div class="signup__done" id="signup-done" tabindex="-1">
        <p class="signup__done-title" id="signup-title">${icon('check')}Thank you${name}</p>
        <p>Your matches and the free retreat guide are on their way to <strong>${esc(state.signup.email)}</strong>.</p>
        <p class="signup__proto">Prototype: nothing has actually been sent.</p>
      </div>
    </section>`;
  }
  const hasPicks = result.picks.length > 0;
  return `<section class="signup" aria-labelledby="signup-title">
    <div class="signup__copy">
      <h3 class="signup__title" id="signup-title">${hasPicks ? 'Get your matches + the free retreat guide' : 'Be first to hear about new dates'}</h3>
      <p>${hasPicks ? `We’ll email you ${result.picks.length === 1 ? 'this trip' : `these ${word(result.picks.length)} trips`} with full details, plus our free guide to choosing the right retreat.` : 'We’ll email you when new trips are released, plus our free guide to choosing the right retreat.'}</p>
      <div class="signup__guide">
        <span class="signup__cover" aria-hidden="true">Retreat guide</span>
        <span>The Reclaim Yourself retreat guide: what to expect, how to choose, and what to pack.</span>
      </div>
    </div>
    <form class="signup__form" novalidate>
      <div class="field">
        <label for="signup-name">First name <span>(optional)</span></label>
        <input id="signup-name" name="name" type="text" autocomplete="given-name" maxlength="60">
      </div>
      <div class="field">
        <label for="signup-email">Email address</label>
        <input id="signup-email" name="email" type="email" autocomplete="email" inputmode="email" required aria-describedby="signup-email-error">
        <p class="field__error" id="signup-email-error" hidden></p>
      </div>
      <label class="check"><input type="checkbox" name="news"><span>Also send me occasional news about new trips (optional)</span></label>
      <button class="btn btn--forest btn--block" type="submit">${hasPicks ? 'Send me my matches' : 'Keep me posted'}</button>
      <p class="signup__fine">One email with your matches and the guide. Unsubscribe any time.</p>
    </form>
  </section>`;
}

function renderResults() {
  const result = rankTrips(state.trips, state.answers, { today: state.today, limit: 3 });
  state.result = result;
  const copy = resultsCopy(result);
  const persona = personaFromAnswers(state.answers, result.picks.map((p) => p.trip));

  const chips = ANSWER_KEYS.map((key) => {
    const label = answerLabel(key, state.answers[key]);
    return `<li><button class="answer-chip" type="button" data-action="edit" data-key="${key}" aria-label="Change ${esc(CHIP_NAMES[key])} (${esc(label)})">${esc(label)}${icon('pencil')}</button></li>`;
  }).join('');

  els.panel.innerHTML = `${quizBar({ backLabel: 'Back', stepLabel: 'Your matches' })}
    <div class="quiz__body">
      ${persona ? personaCard(persona, { headingTag: 'h2', headingId: 'q-title', topTrip: result.picks[0]?.trip }) : ''}
      <div class="results__head">
        <${persona ? 'h3' : 'h2'} class="results__title"${persona ? '' : ' id="q-title" tabindex="-1"'}>${esc(copy.title)}</${persona ? 'h3' : 'h2'}>
        ${copy.intro ? `<p class="results__intro">${esc(copy.intro)}</p>` : ''}
        <ul class="answer-chips" aria-label="Your answers"><li class="answer-chips__label" aria-hidden="true">You chose:</li>${chips}</ul>
        ${copy.notice ? `<p class="results__notice">${icon('info')}<span>${esc(copy.notice)}</span></p>` : ''}
      </div>
      ${result.picks.length ? `<ol class="result-grid" aria-label="Your matches">${result.picks.map(resultCard).join('')}</ol>` : ''}
      ${signupBox(result)}
      <details class="how">
        <summary>How we match you ${icon('chevron')}</summary>
        <div class="how__body">
          <p>Every answer adds points, out of ${MAX_SCORE}:</p>
          <ul>
            <li><strong>What you’re craving: ${WEIGHTS.craving}</strong> if it’s one of the trip’s themes.</li>
            <li><strong>When you can travel: ${WEIGHTS.when}</strong> if the trip runs then (${PARTIAL_POINTS.whenNearby} if it’s a month either side).</li>
            <li><strong>Budget: ${WEIGHTS.budget}</strong> if the price range overlaps yours (${PARTIAL_POINTS.budgetUnder} if it’s cheaper, ${PARTIAL_POINTS.budgetStretch} if it starts within ${formatPrice(BUDGET_STRETCH_GBP)} above).</li>
            <li><strong>Who’s travelling: ${WEIGHTS.who}</strong> if the trip suits solo travellers, couples or friends as you chose. Where a trip doesn’t record this yet, it isn’t counted either way, and the score is out of ${MAX_SCORE - WEIGHTS.who}.</li>
          </ul>
          <p>A trip “ticks every box” when it fully meets all four answers. Those come first, then the closest of the rest. Trips that are sold out or have already started are never suggested.</p>
        </div>
      </details>
      <div class="results__footer">
        <button class="btn btn--ghost" type="button" data-action="restart">Start again</button>
        <a class="text-link" href="#trips" data-action="browse">Browse all ${state.trips.filter((t) => isUpcoming(t, state.today)).length} trips ${icon('arrowDown')}</a>
      </div>
    </div>`;
  setProgress(1);
  syncUrl();
  renderList();
}

function setProgress(fraction) {
  const bar = els.panel.querySelector('.quiz__progress span');
  if (!bar) return;
  // Start from the previous width so the bar animates forward instead of jumping.
  bar.style.width = `${state.lastProgress ?? 0}%`;
  requestAnimationFrame(() => { bar.style.width = `${Math.round(fraction * 100)}%`; });
  state.lastProgress = Math.round(fraction * 100);
}

async function renderPanel({ focus = true } = {}) {
  if (state.step === RESULTS_STEP) {
    if (!state.loaded) {
      els.panel.innerHTML = `${quizBar({ backLabel: 'Back', stepLabel: 'Your matches' })}<p class="quiz__hint" role="status">Finding your matches…</p>`;
      await tripsLoaded;
    }
    renderResults();
  } else {
    renderQuestion();
  }
  els.openLabel.textContent = state.step === RESULTS_STEP ? 'See my matches' : 'Find my retreat';
  updatePill();
  if (focus) {
    const top = els.finder.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.4) els.finder.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    els.panel.querySelector('#q-title')?.focus({ preventScroll: true });
  }
}

function firstUnanswered() {
  return QUESTIONS.findIndex((q) => !state.answers[q.key]);
}

function advance() {
  if (state.step >= RESULTS_STEP || !state.answers[QUESTIONS[state.step].key]) return;
  if (state.editing) {
    const next = firstUnanswered();
    state.step = next === -1 ? RESULTS_STEP : next;
    if (state.step === RESULTS_STEP) state.editing = false;
  } else {
    state.step += 1;
  }
  renderPanel();
}

function choose(key, value) {
  if (state.busy) return;
  state.answers[key] = value;
  els.panel.querySelectorAll(`[data-key="${key}"]`).forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.answer === value));
  });
  // A short pause so the tap visibly lands before the next question appears.
  state.busy = true;
  const step = state.step;
  setTimeout(() => {
    state.busy = false;
    // Skip if Back or Close was pressed during the pause.
    if (state.open && state.step === step) advance();
  }, reducedMotion.matches ? 0 : 260);
}

function goBack() {
  if (state.step === RESULTS_STEP) state.step = QUESTIONS.length - 1;
  else if (state.editing) { state.editing = false; state.step = RESULTS_STEP; }
  else if (state.step > 0) state.step -= 1;
  renderPanel();
}

function editAnswer(key) {
  state.editing = true;
  state.step = QUESTIONS.findIndex((q) => q.key === key);
  renderPanel();
}

function restart() {
  state.answers = {};
  state.step = 0;
  state.editing = false;
  state.result = null;
  state.lastProgress = 0;
  syncUrl();
  renderList();
  renderPanel();
}

function syncUrl() {
  const url = new URL(window.location.href);
  for (const key of ANSWER_KEYS) {
    if (state.step === RESULTS_STEP && state.answers[key]) url.searchParams.set(key, state.answers[key]);
    else url.searchParams.delete(key);
  }
  if (url.href === window.location.href) return;
  try {
    history.replaceState(history.state, '', url);
  } catch {
    // Some embedded or sandboxed frames refuse URL changes; the results still work without them.
  }
}

/* ---------- Opening and closing ---------- */

function showPanel({ focus = true } = {}) {
  state.open = true;
  els.finder.classList.add('is-open');
  els.banner.hidden = true;
  els.panel.hidden = false;
  els.openBtn.setAttribute('aria-expanded', 'true');
  renderPanel({ focus });
}

function hidePanel() {
  state.open = false;
  state.lastProgress = 0;
  els.finder.classList.remove('is-open');
  els.panel.hidden = true;
  els.panel.innerHTML = '';
  els.banner.hidden = false;
  els.openBtn.setAttribute('aria-expanded', 'false');
  updatePill();
  if (window.location.hash === '#find-your-retreat') {
    try {
      history.replaceState(history.state, '', '#our-trips');
    } catch {
      // Keeping the old hash only means a reload reopens the quiz.
    }
  }
  if (state.view !== 'trips') return;
  els.openBtn.focus({ preventScroll: true });
  const top = els.finder.getBoundingClientRect().top;
  if (top < 0) els.finder.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
}

function openQuiz() {
  if (state.open) {
    els.finder.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    els.panel.querySelector('#q-title')?.focus({ preventScroll: true });
    return;
  }
  // One history entry, so the phone's back button closes the quiz instead of leaving the page.
  if (!history.state?.finder) {
    try {
      history.pushState({ finder: true }, '', window.location.href);
    } catch {
      // Without history (e.g. a sandboxed frame) the Close button still works; only the Back button won't close it.
    }
  }
  showPanel();
}

function closeQuiz() {
  if (history.state?.finder) history.back();
  else hidePanel();
}

window.addEventListener('popstate', (event) => {
  if (event.state?.finder && !state.open) showPanel();
  else if (!event.state?.finder && state.open) hidePanel();
});

/* ---------- Floating pill ---------- */

let finderVisible = true;

function updatePill() {
  const show = !finderVisible && state.loaded && state.view === 'trips';
  els.pillLabel.textContent = state.open
    ? state.step === RESULTS_STEP ? 'Back to your matches' : 'Back to the trip finder'
    : state.step === RESULTS_STEP ? 'See your matches' : 'Find your retreat in one minute';
  els.pill.classList.toggle('is-hidden', !show);
  els.pill.setAttribute('aria-hidden', String(!show));
  els.pill.tabIndex = show ? 0 : -1;
}

if ('IntersectionObserver' in window) {
  new IntersectionObserver((entries) => {
    finderVisible = entries[0].isIntersecting;
    updatePill();
  }, { threshold: 0 }).observe(els.finder);
}

/* ---------- Views: homepage and Our trips ---------- */

// Plain #names only, so the same links work on any host, including inside an embedded frame.
const ROUTES = { '': 'home', '#home': 'home', '#our-trips': 'trips', '#trips': 'trips', '#picks': 'trips', '#find-your-retreat': 'trips' };

function viewFor(hash) {
  if (Object.hasOwn(ROUTES, hash)) return ROUTES[hash];
  return hash.startsWith('#trip-') ? 'trips' : null;
}

function showView(view) {
  if (state.view === view) return false;
  state.view = view;
  els.views.home.hidden = view !== 'home';
  els.views.trips.hidden = view !== 'trips';
  if (view === 'trips') els.navTrips.setAttribute('aria-current', 'page');
  else els.navTrips.removeAttribute('aria-current');
  updatePill();
  return true;
}

function route({ initial = false } = {}) {
  const hash = window.location.hash;
  const view = viewFor(hash);
  if (!view) return; // other in-page anchors (e.g. the skip link) keep the current view
  // Jump straight there on load or when the view changes; glide only within the same view.
  const behavior = showView(view) || initial ? 'instant' : scrollBehavior();
  if (hash === '#find-your-retreat') { openQuiz(); return; }
  const target = hash === '#trips' ? els.trips
    : hash === '#picks' ? (els.picks.hidden ? els.trips : els.picks)
    : hash.startsWith('#trip-') ? document.getElementById(hash.slice(1)) : null;
  if (target) {
    target.scrollIntoView({ behavior, block: 'start' });
    if (!initial) target.focus?.({ preventScroll: true });
    return;
  }
  if (initial) return;
  window.scrollTo({ top: 0, behavior: 'instant' });
  (view === 'home' ? els.homeTitle : els.pageTitle).focus({ preventScroll: true });
}

window.addEventListener('hashchange', () => route());

/* The demo switch on the homepage: today's low-contrast button versus the proposed buttons. */
function setCompare(mode) {
  const today = mode === 'today';
  els.ctaToday.hidden = !today;
  els.ctaProposed.hidden = today;
  els.ctaProposedNote.hidden = today;
  els.homeHero.classList.toggle('is-today', today);
  els.compareBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.compare === mode)));
}

els.compareBtns.forEach((b) => b.addEventListener('click', () => setCompare(b.dataset.compare)));

/* ---------- Trip details ---------- */

const sentence = (items) => items.map((v) => v.charAt(0).toUpperCase() + v.slice(1)).join(', ');

/** The feature-matrix facts for a trip: what it's like at a glance and its 1–5 profile. */
function tripFacts(trip) {
  const rows = [
    trip.experiences.length && ['Experience', sentence(trip.experiences)],
    trip.landscapes.length && ['Landscape', sentence(trip.landscapes)],
    trip.climate && ['Climate', sentence([trip.climate])],
    trip.pace && ['Pace', PACES[trip.pace].label],
    trip.travel && ['From the UK', TRAVEL[trip.travel].label],
  ].filter(Boolean);
  const profile = Object.entries(PROFILE_KEYS).filter(([key]) => trip.profile[key]);
  if (!rows.length && !profile.length) return '';
  const dots = (n) => `<span class="profile__dots" aria-hidden="true">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= n ? 'is-on' : ''}"></span>`).join('')}</span>`;
  return `<div class="facts">
    ${rows.length ? `<dl class="facts__list">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    ${profile.length ? `<div class="profile">
      <p class="profile__title">Trip profile</p>
      <ul class="profile__list">${profile.map(([key, label]) => `<li><span class="profile__label">${label}</span>${dots(trip.profile[key])}<span class="visually-hidden">${trip.profile[key]} out of 5</span></li>`).join('')}</ul>
    </div>` : ''}
    <p class="facts__note">${trip.verified ? 'Activities confirmed on the trip page. ' : ''}Profile, climate and flight time are estimates from the trip pages, to be checked by the team.</p>
  </div>`;
}

function openTrip(id) {
  const trip = state.trips.find((t) => t.id === id);
  if (!trip) return;
  const soldOut = trip.status === 'sold_out';
  els.dialogContent.innerHTML = `
    <div class="media dialog__media">${media(trip)}${statusBadge(trip)}</div>
    <div class="dialog__body">
      <p class="eyebrow">${esc(trip.destination)}${themeLine(trip) ? ` · ${esc(themeLine(trip))}` : ''}</p>
      <h2 class="dialog__title" id="dialog-title">${esc(trip.title)}</h2>
      ${metaList(trip, 'meta--columns')}
      ${trip.summary ? `<p class="dialog__summary">${esc(trip.summary)}</p>` : ''}
      ${trip.highlights.length ? `<ul class="dialog__highlights">${trip.highlights.map((h) => `<li>${icon('check')}<span>${esc(h)}</span></li>`).join('')}</ul>` : ''}
      ${tripFacts(trip)}
      <div class="dialog__actions">
        <button class="btn btn--forest" type="button" data-action="enquire">${soldOut ? 'Join the waiting list' : 'Enquire about this trip'}</button>
        <button class="btn btn--outline" type="button" data-action="close-dialog">Close</button>
      </div>
      <p class="dialog__note" role="status" hidden></p>
    </div>`;
  els.dialog.showModal();
  els.dialog.scrollTop = 0;
}

els.dialog.addEventListener('click', (event) => {
  if (event.target === els.dialog) { els.dialog.close(); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'close-dialog') els.dialog.close();
  if (action === 'enquire') {
    const note = els.dialog.querySelector('.dialog__note');
    note.hidden = false;
    note.textContent = 'Prototype: on the live site this opens the enquiry form for this trip.';
  }
});

/* ---------- Sign-up ---------- */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function handleSignup(event) {
  event.preventDefault();
  const form = event.target;
  const email = form.email.value.trim();
  const error = form.querySelector('#signup-email-error');
  if (!EMAIL_PATTERN.test(email)) {
    error.textContent = email ? 'Check your email address, it should look like name@example.com.' : 'Enter your email address so we can send your matches.';
    error.hidden = false;
    form.email.setAttribute('aria-invalid', 'true');
    form.email.focus();
    return;
  }
  const payload = {
    email,
    first_name: form.name.value.trim(),
    marketing_opt_in: form.news.checked,
    answers: { ...state.answers },
    matches: state.result ? state.result.picks.map((p) => p.trip.id) : [],
    source: 'trip-finder',
  };
  // No backend in the prototype: this is the record a live version would send to the email platform.
  console.info('[prototype] Sign-up that would be sent:', payload);
  state.signup = { email, name: payload.first_name };
  const box = form.closest('.signup');
  box.outerHTML = signupBox(state.result);
  els.panel.querySelector('#signup-done')?.focus();
}

/* ---------- Events ---------- */

function browseTrips(event) {
  event?.preventDefault();
  els.trips.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  els.trips.focus({ preventScroll: true });
}

els.openBtn.addEventListener('click', openQuiz);
els.pill.addEventListener('click', openQuiz);

els.panel.addEventListener('click', (event) => {
  const option = event.target.closest('[data-answer]');
  if (option) { choose(option.dataset.key, option.dataset.answer); return; }
  const target = event.target.closest('[data-action]');
  if (!target) return;
  switch (target.dataset.action) {
    case 'back': goBack(); break;
    case 'close': closeQuiz(); break;
    case 'next': advance(); break;
    case 'edit': editAnswer(target.dataset.key); break;
    case 'restart': restart(); break;
    case 'browse': browseTrips(event); break;
    default: break;
  }
});

els.panel.addEventListener('submit', handleSignup);
els.panel.addEventListener('input', (event) => {
  if (event.target.name !== 'email' || event.target.getAttribute('aria-invalid') !== 'true') return;
  if (EMAIL_PATTERN.test(event.target.value.trim())) {
    event.target.removeAttribute('aria-invalid');
    els.panel.querySelector('#signup-email-error').hidden = true;
  }
});

function copyPersona(button) {
  const status = button.parentElement.querySelector('.persona__status');
  const text = button.dataset.share;
  const done = () => { status.textContent = 'Copied. Paste it anywhere.'; };
  const fallback = () => {
    // Clipboard refused (e.g. in an embedded frame): show the text selected, ready to copy by hand.
    status.innerHTML = `<label class="visually-hidden" for="persona-copy">Your traveller type</label><textarea id="persona-copy" class="persona__copy" readonly rows="3">${esc(text)}</textarea>`;
    const area = status.querySelector('textarea');
    area.focus();
    area.select();
  };
  try {
    navigator.clipboard.writeText(text).then(done, fallback);
  } catch {
    fallback();
  }
}

function clearFilters() {
  state.filters = emptyFilters();
  renderList();
  els.filters.theme.focus();
}

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-action="trip"]');
  if (trigger) { openTrip(trigger.dataset.trip); return; }
  if (event.target.closest('[data-action="clear-filters"]')) { clearFilters(); return; }
  const share = event.target.closest('[data-action="share-persona"]');
  if (share) { copyPersona(share); return; }
  if (event.target.closest('[data-action="diagnose"]')) { openQuiz(); return; }
  // A link to the hash we're already on fires no hashchange, so route it here.
  const link = event.target.closest('a[href^="#"]');
  if (link && link.getAttribute('href') === window.location.hash && viewFor(link.getAttribute('href'))) {
    event.preventDefault();
    route();
  }
});

els.trips.addEventListener('change', (event) => {
  const key = event.target.dataset.filter;
  if (!key) return;
  state.filters[key] = event.target.value;
  renderList();
});
els.filtersClear.addEventListener('click', clearFilters);

els.navToggle.addEventListener('click', () => {
  const open = els.navToggle.getAttribute('aria-expanded') !== 'true';
  els.navToggle.setAttribute('aria-expanded', String(open));
  els.navList.classList.toggle('is-open', open);
});
els.navList.addEventListener('click', (event) => {
  if (event.target.closest('a')) {
    els.navToggle.setAttribute('aria-expanded', 'false');
    els.navList.classList.remove('is-open');
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && els.navList.classList.contains('is-open')) {
    els.navToggle.setAttribute('aria-expanded', 'false');
    els.navList.classList.remove('is-open');
    els.navToggle.focus();
  }
});

/* ---------- Start ---------- */

async function init() {
  els.homeArt.innerHTML = sceneSVG('aerial', { seed: 'home-aerial', width: 1600, height: 900 });
  els.heroArt.innerHTML = sceneSVG('peaks', { seed: 'reclaim-hero', width: 1600, height: 640 });

  const params = new URLSearchParams(window.location.search);
  const todayOverride = parseISODate(params.get('today'));
  if (!Number.isNaN(todayOverride)) state.today = todayOverride;

  const deepLink = parseAnswers(params);
  if (deepLink) {
    state.answers = deepLink;
    state.step = RESULTS_STEP;
  }
  showView(deepLink ? 'trips' : viewFor(window.location.hash) || 'home');

  try {
    const response = await fetch('trips.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`trips.json returned ${response.status}`);
    const { trips, warnings } = loadTrips(await response.json());
    warnings.forEach((w) => console.warn('[trips.json]', w));
    state.trips = trips;
  } catch (error) {
    console.error(error);
    els.count.textContent = 'Trips could not be loaded';
    els.list.innerHTML = `<li class="trips__empty">We couldn’t load trips.json. Check that it sits next to index.html and is valid JSON.</li>`;
  }
  state.loaded = true;
  resolveLoaded();
  renderList();
  if (deepLink) showPanel({ focus: false });
  else route({ initial: true });
  updatePill();
}

init();
