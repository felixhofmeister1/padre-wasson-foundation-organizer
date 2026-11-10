/*
 * "What kind of traveller are you?" A playful traveller type, built from simple rules:
 *   diagnostic mode  – from the quiz answers (the craving picks the type, the rest add traits)
 *   filtering mode   – from the browse filters (a chosen type, or what stands out in the trips shown)
 * Each type comes with the trips that fit it. It's a hook, not a personality test.
 * Pure functions with no DOM access, so they run in the browser and under `node --test`.
 */

import { MONTH_IDS, MONTH_NAMES, PACES, SEASONS, THEMES, TRAVEL, formatPrice, joinAnd } from './matching.js';

export const PERSONAS = {
  adventure: {
    name: 'Trailblazer',
    tagline: 'You’d rather earn the view than buy the postcard.',
    blurb: 'You like a holiday with a bit of challenge in it: big landscapes, early starts and the good kind of tired.',
    color: '#2D4C3E',
  },
  restorative: {
    name: 'Slow Restorer',
    tagline: 'Your idea of a holiday is finally exhaling.',
    blurb: 'You travel to slow down: unhurried days, good food, yoga and time nobody has scheduled.',
    color: '#55705A',
  },
  cultural: {
    name: 'Curious Explorer',
    tagline: 'You come home with stories, recipes and a new word or two.',
    blurb: 'You want to understand a place: its people, food, markets and traditions.',
    color: '#9A4F35',
  },
  wild: {
    name: 'Wild Wanderer',
    tagline: 'Happiest where the phone signal gives up.',
    blurb: 'You’re drawn to remote, empty places: mountains, ice, open plains and big skies.',
    color: '#1F5A63',
  },
  sauna: {
    name: 'Heat & Ice Seeker',
    tagline: 'Hot sauna, cold water, repeat.',
    blurb: 'You love the contrast: wood-fired heat, a cold plunge and the calm that follows.',
    color: '#5B3A2E',
  },
  sun: {
    name: 'Sun Chaser',
    tagline: 'Salt in your hair and nowhere to be.',
    blurb: 'You’re after warm water, bright light and slow days by the sea.',
    color: '#9A6516',
  },
};

const BUDGET_TRAITS = { 'under-2500': 'Short-escape budget', '2500-4000': 'Mid-range budget', 'over-4000': 'Bucket-list budget' };
const WHO_TRAITS = { solo: 'Happy to go solo', couple: 'Travelling as two', friends: 'Brings the crew' };
const PACE_TRAITS = { gentle: 'Gentle pace', moderate: 'Steady pace', active: 'Likes to keep moving' };
const TRAVEL_TRAITS = { short: 'Short-hop flyer', medium: 'Medium-haul', long: 'Long-haul dreamer' };

const PLACE_WORDS = {
  coast: 'wild coasts', mountain: 'mountains', forest: 'forests', snow: 'snow', fjord: 'fjords', lake: 'lakes',
  glacier: 'glaciers', ice: 'icebergs', steppe: 'open steppe', dunes: 'dunes', volcanic: 'volcanoes', desert: 'desert',
  city: 'old cities', 'tea hills': 'tea hills', wilderness: 'wilderness',
};

function whenTrait(when) {
  if (!when) return '';
  if (when === 'flexible') return 'Flexible on dates';
  if (SEASONS[when]) return `${SEASONS[when].label} traveller`;
  const i = MONTH_IDS.indexOf(when);
  return i >= 0 ? `Travelling in ${MONTH_NAMES[i]}` : '';
}

const shareOf = (trips, theme) => (trips.length ? trips.filter((t) => t.themes.includes(theme)).length / trips.length : 0);

/**
 * Themes ranked by how much they stand out in `shown` compared with `all`.
 * Only themes that at least half the shown trips have are candidates; with none, the most common wins.
 */
export function distinctiveThemes(shown, all) {
  const ranked = Object.keys(THEMES)
    .map((theme) => {
      const share = shareOf(shown, theme);
      const base = shareOf(all, theme);
      return { theme, share, lift: base ? share / base : 0 };
    })
    .filter((x) => x.share > 0);
  const strong = ranked.filter((x) => x.share >= 0.5).sort((a, b) => b.lift - a.lift || b.share - a.share);
  const rest = ranked.filter((x) => x.share < 0.5).sort((a, b) => b.share - a.share || b.lift - a.lift);
  return [...strong, ...rest].map((x) => x.theme);
}

/** The places these trips have most in common, in plain words. */
export function topPlaces(trips, limit = 3) {
  const counts = new Map();
  for (const t of trips) for (const l of t.landscapes || []) if (PLACE_WORDS[l]) counts.set(l, (counts.get(l) || 0) + 1);
  if (counts.size) return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([l]) => PLACE_WORDS[l]);
  return [...new Set(trips.map((t) => t.destination))].slice(0, limit);
}

function build({ theme, streakTheme, traits, trips, source, closing }) {
  const p = PERSONAS[theme];
  if (!p) return null;
  const places = topPlaces(trips);
  const fromPrice = trips.length ? Math.min(...trips.map((t) => t.priceMin)) : 0;
  const lines = [p.blurb];
  if (places.length) lines.push(`Your kind of places: ${joinAnd(places)}.`);
  if (closing) lines.push(closing);
  else if (trips.length) lines.push(`${trips.length} ${trips.length === 1 ? 'trip fits' : 'trips fit'} you, from ${formatPrice(fromPrice)}.`);
  return {
    key: theme,
    name: p.name,
    title: `The ${p.name}`,
    streak: streakTheme && PERSONAS[streakTheme] ? PERSONAS[streakTheme].name : '',
    tagline: p.tagline,
    summary: lines.join(' '),
    traits: traits.filter(Boolean),
    color: p.color,
    count: trips.length,
    source,
  };
}

/** Diagnostic mode: the quiz answers decide the type; `trips` are the recommended ones. */
export function personaFromAnswers(answers, trips = []) {
  if (!answers || !THEMES[answers.craving]) return null;
  const streakTheme = distinctiveThemes(trips, trips).find((t) => t !== answers.craving && shareOf(trips, t) >= 0.5);
  return build({
    theme: answers.craving,
    streakTheme,
    traits: [whenTrait(answers.when), BUDGET_TRAITS[answers.budget], WHO_TRAITS[answers.who]],
    trips,
    source: 'quiz',
    closing: trips.length ? `Your ${trips.length === 1 ? 'best trip is' : `${trips.length === 2 ? 'two' : 'three'} best trips are`} below.` : '',
  });
}

/** Filtering mode: the filters (and the trips they leave) decide the type. No filters, no type. */
export function personaFromFilters(filters, shown, all) {
  const active = Object.values(filters || {}).some(Boolean);
  if (!active || !shown.length) return null;
  const ranked = distinctiveThemes(shown, all);
  const theme = filters.theme && THEMES[filters.theme] ? filters.theme : ranked[0];
  const streakTheme = ranked.find((t) => t !== theme && shareOf(shown, t) >= 0.5);
  return build({
    theme,
    streakTheme,
    traits: [
      filters.season && SEASONS[filters.season] ? `${SEASONS[filters.season].label} traveller` : '',
      BUDGET_TRAITS[filters.budget],
      PACES[filters.pace] ? PACE_TRAITS[filters.pace] : '',
      TRAVEL[filters.travel] ? TRAVEL_TRAITS[filters.travel] : '',
    ],
    trips: shown,
    source: 'filters',
  });
}

/** A line to paste anywhere. */
export function shareText(persona, topTrip, url = '') {
  const streak = persona.streak ? ` with a ${persona.streak} streak` : '';
  const top = topTrip ? `, and my top retreat is ${topTrip.title}` : '';
  return `I’m ${article(persona.name)} ${persona.name}${streak}${top}. What kind of traveller are you?${url ? ` ${url}` : ''}`;
}

export const article = (word) => (/^[aeiou]/i.test(word) ? 'an' : 'a');
