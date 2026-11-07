import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MAX_SCORE, THEMES, explainMatch, featuredTrips, filterCounts, filterTrips, formatDateRange, formatPriceRange, loadTrips, normaliseTrip,
  parseAnswers, parseISODate, rankTrips, scoreBreakdown, scoreTrip,
} from '../js/matching.js';
import { SCENE_NAMES, sceneSVG } from '../js/scenes.js';
import { formatTrips, matrixToTrips, parseCSV } from '../tools/import-matrix.mjs';

// The live data file (checked for problems) and a frozen copy of the prototype's sample trips
// (used for the ranking scenarios, so replacing trips.json never breaks them).
const live = JSON.parse(readFileSync(new URL('../trips.json', import.meta.url), 'utf8'));
const sample = JSON.parse(readFileSync(new URL('./fixtures/sample-trips.json', import.meta.url), 'utf8'));
const TODAY = '2026-10-28';

function trip(overrides = {}) {
  const { trip: t, error } = normaliseTrip({
    id: 'test',
    title: 'Test trip',
    destination: 'Somewhere',
    start_date: '2027-06-05',
    end_date: '2027-06-10',
    price_min: 3000,
    price_max: 3500,
    themes: ['adventure'],
    suitable_for: ['solo', 'couple', 'friends'],
    ...overrides,
  });
  assert.equal(error, undefined);
  return t;
}

const answers = (a = {}) => ({ craving: 'adventure', when: 'jun', budget: '2500-4000', who: 'solo', ...a });

test('trips.json loads cleanly', () => {
  const { trips, warnings } = loadTrips(live);
  assert.deepEqual(warnings, []);
  assert.equal(trips.length, live.trips.length, 'no trip was left out');
  for (let i = 1; i < trips.length; i++) assert.ok(trips[i - 1].start <= trips[i].start, 'sorted by start date');
  for (const t of trips) {
    assert.ok(t.themes.length && t.themes.every((th) => THEMES[th]), `${t.id} has at least one known theme`);
    assert.ok(t.image || SCENE_NAMES.includes(t.scene), `${t.id} has a photo or a known placeholder scene`);
  }
});

test('trips that cannot be used are left out with a reason', () => {
  const { trips, warnings } = loadTrips({
    trips: [
      { id: 'a', title: 'A', destination: 'X', start_date: '2027-01-01', end_date: '2027-01-05', price_min: 100 },
      { id: 'a', title: 'Duplicate', destination: 'X', start_date: '2027-01-01', end_date: '2027-01-05', price_min: 100 },
      { id: 'b', title: 'No dates', destination: 'X', price_min: 100 },
      { id: 'c', title: 'Backwards', destination: 'X', start_date: '2027-02-05', end_date: '2027-02-01', price_min: 100 },
      { id: 'd', title: 'Bad date', destination: 'X', start_date: '2027-02-30', end_date: '2027-03-01', price_min: 100 },
    ],
  });
  assert.deepEqual(trips.map((t) => t.id), ['a']);
  assert.equal(warnings.length, 4);
  assert.match(warnings.join('\n'), /appears twice/);
  assert.match(warnings.join('\n'), /missing start_date, end_date/);
  assert.match(warnings.join('\n'), /ends before it starts/);
  assert.match(warnings.join('\n'), /YYYY-MM-DD/);
  assert.deepEqual(loadTrips({ nope: true }).trips, []);
});

test('missing optional fields are filled in from the dates', () => {
  const { trip: t, warnings } = normaliseTrip({
    id: 'x', title: 'X', destination: 'Y', start_date: '2027-02-27', end_date: '2027-03-04',
    price_min: 2000, price_max: 1500, themes: ['sun', 'yoga'],
  });
  assert.deepEqual(t.months, [2, 3]);
  assert.deepEqual(t.season, ['spring', 'winter']);
  assert.equal(t.lengthDays, 6);
  assert.deepEqual(t.suitableFor, ['solo', 'couple', 'friends']);
  assert.equal(t.status, 'available');
  assert.deepEqual([t.priceMin, t.priceMax], [1500, 2000]);
  assert.equal(warnings.length, 2, 'swapped prices and the unknown "yoga" theme are reported');
});

test('answers are read from the URL only when all four are valid', () => {
  assert.deepEqual(
    parseAnswers(new URLSearchParams('craving=sun&when=winter&budget=under-2500&who=couple')),
    { craving: 'sun', when: 'winter', budget: 'under-2500', who: 'couple' },
  );
  assert.equal(parseAnswers(new URLSearchParams('craving=sun&when=winter&budget=under-2500')), null);
  assert.equal(parseAnswers(new URLSearchParams('craving=golf&when=winter&budget=under-2500&who=couple')), null);
  assert.equal(parseAnswers({ craving: 'wild', when: 'nov', budget: 'over-4000', who: 'friends' }).when, 'nov');
});

test('dates and prices read naturally', () => {
  const d = parseISODate;
  assert.equal(formatDateRange(d('2026-11-01'), d('2026-11-11')), '1–11 Nov 2026');
  assert.equal(formatDateRange(d('2027-02-27'), d('2027-03-04')), '27 Feb – 4 Mar 2027');
  assert.equal(formatDateRange(d('2026-12-29'), d('2027-01-04')), '29 Dec 2026 – 4 Jan 2027');
  assert.equal(formatPriceRange(3999, 4999), '£3,999 – £4,999');
  assert.equal(formatPriceRange(1500, 1500), '£1,500');
});

test('a trip that fits every answer scores 100', () => {
  const s = scoreTrip(trip(), answers());
  assert.equal(s.score, MAX_SCORE);
  assert.equal(s.percent, 100);
  assert.ok(s.ticksEveryBox);
});

test('timing: exact month, a month away (across the new year) and season', () => {
  assert.equal(scoreTrip(trip(), answers({ when: 'jul' })).criteria.when.points, 10);
  assert.equal(scoreTrip(trip(), answers({ when: 'sep' })).criteria.when.points, 0);
  const newYear = trip({ start_date: '2027-01-10', end_date: '2027-01-15' });
  assert.equal(scoreTrip(newYear, answers({ when: 'dec' })).criteria.when.status, 'partial');
  assert.equal(scoreTrip(newYear, answers({ when: 'winter' })).criteria.when.status, 'full');
  assert.equal(scoreTrip(trip(), answers({ when: 'spring' })).criteria.when.status, 'partial', 'June is next to May');
  assert.equal(scoreTrip(trip(), answers({ when: 'flexible' })).criteria.when.status, 'full');
  const tagged = trip({ start_date: '2027-11-11', end_date: '2027-11-16', season: ['autumn', 'winter'] });
  assert.equal(scoreTrip(tagged, answers({ when: 'winter' })).criteria.when.status, 'full', 'season tags win over dates');
});

test('budget: overlapping, cheaper, a little over and well over', () => {
  const fit = (min, max, budget) => scoreTrip(trip({ price_min: min, price_max: max }), answers({ budget })).criteria.budget;
  assert.equal(fit(3995, 4995, '2500-4000').fit, 'within');
  assert.equal(fit(3995, 4995, 'over-4000').fit, 'within');
  assert.equal(fit(1595, 2395, 'over-4000').fit, 'under');
  assert.equal(fit(1595, 2395, 'over-4000').points, 20);
  assert.equal(fit(2595, 3295, 'under-2500').fit, 'stretch');
  assert.equal(fit(3000, 3295, 'under-2500').fit, 'stretch', 'exactly £500 over still counts as a stretch');
  assert.equal(fit(3001, 3295, 'under-2500').fit, 'over');
  assert.equal(fit(2500, 2600, 'under-2500').fit, 'within', 'band edges are inclusive');
});

test('who is travelling', () => {
  const s = scoreTrip(trip({ suitable_for: ['solo', 'friends'] }), answers({ who: 'couple' }));
  assert.equal(s.criteria.who.points, 0);
  assert.equal(s.ticksEveryBox, false);
});

test('ranking skips sold-out and departed trips', () => {
  const trips = [
    trip({ id: 'sold', status: 'sold_out' }),
    trip({ id: 'gone', start_date: '2026-10-01', end_date: '2026-10-05' }),
    trip({ id: 'ok' }),
  ];
  const r = rankTrips(trips, answers(), { today: TODAY });
  assert.deepEqual(r.picks.map((p) => p.trip.id), ['ok']);
  assert.equal(r.bookableCount, 1);
  assert.equal(r.outcome, 'matches');
});

test('full matches always come before closer-scoring partial ones', () => {
  const trips = [
    trip({ id: 'cheap-match', price_min: 1000, price_max: 1200 }),
    trip({ id: 'wrong-people', suitable_for: ['friends'] }),
  ];
  const r = rankTrips(trips, answers(), { today: TODAY });
  assert.deepEqual(r.picks.map((p) => p.trip.id), ['cheap-match', 'wrong-people']);
  assert.equal(r.picks[0].score, 90);
  assert.equal(r.picks[1].score, 90);
});

test('outcomes when fewer than three trips tick every box', () => {
  const { trips } = loadTrips(sample);
  const some = rankTrips(trips, answers({ craving: 'adventure', when: 'nov', budget: 'over-4000', who: 'solo' }), { today: TODAY });
  assert.equal(some.outcome, 'some');
  assert.equal(some.matchCount, 2);
  assert.deepEqual(some.picks.map((p) => p.trip.id), ['nepal-himalayan-adventure', 'patagonia-trek-restore', 'madagascar-wild-island']);

  const closest = rankTrips(trips, answers({ craving: 'sun', when: 'winter', budget: 'under-2500', who: 'couple' }), { today: TODAY });
  assert.equal(closest.outcome, 'closest');
  assert.equal(closest.picks.length, 3);
  assert.equal(closest.picks[0].trip.id, 'sri-lanka-slow-coast');

  const all = rankTrips(trips, answers({ craving: 'sauna', when: 'flexible', budget: '2500-4000', who: 'friends' }), { today: TODAY });
  assert.equal(all.outcome, 'matches');

  const none = rankTrips(trips, answers(), { today: '2029-01-01' });
  assert.equal(none.outcome, 'none');
  assert.equal(none.picks.length, 0);
});

test('a sold-out trip is never suggested even when it fits best', () => {
  const { trips } = loadTrips(sample);
  const r = rankTrips(trips, answers({ craving: 'cultural', when: 'mar', budget: 'under-2500', who: 'solo' }), { today: TODAY });
  assert.ok(!r.picks.some((p) => p.trip.id === 'morocco-atlas-desert'));
});

test('the "why" line comes from the tags that matched, the caveat from those that did not', () => {
  const full = scoreTrip(trip(), answers());
  assert.deepEqual(explainMatch(full, answers()), {
    why: 'Real adventure: in June, in your £2,500–£4,000 price range and great for solo travellers.',
    caveat: null,
  });

  const a = answers({ craving: 'sun', when: 'winter', budget: 'under-2500', who: 'couple' });
  const miss = scoreTrip(trip({ themes: ['wild'], price_min: 4995, price_max: 5500, suitable_for: ['solo'] }), a);
  const text = explainMatch(miss, a);
  assert.equal(text.why, 'The closest trip to your answers.');
  assert.equal(text.caveat, "Worth knowing: it runs in June, not winter; it starts at £4,995, above your budget; it's best suited to solo travellers.");

  const flexible = answers({ when: 'flexible', budget: 'over-4000' });
  const cheap = scoreTrip(trip({ price_min: 1500, price_max: 1800, themes: ['wild'] }), flexible);
  assert.equal(explainMatch(cheap, flexible).why, 'Not an adventure trip, but departing 5 Jun 2027, comfortably under your budget and great for solo travellers.');
});

test('the score breakdown adds up to the score', () => {
  const s = scoreTrip(trip({ price_min: 4300, price_max: 4600 }), answers());
  const rows = scoreBreakdown(s, answers());
  assert.equal(rows.length, 4);
  assert.equal(rows.reduce((sum, r) => sum + r.points, 0), s.score);
  assert.equal(rows.find((r) => r.key === 'budget').detail, 'Slightly over your budget');
});

test('every placeholder scene draws an accessible SVG', () => {
  for (const name of SCENE_NAMES) {
    const svg = sceneSVG(name, { label: 'A "quoted" <label>' });
    assert.match(svg, /^<svg [^>]*role="img" aria-label="A &#34;quoted&#34; &#60;label&#62;"/);
    assert.doesNotMatch(svg, /NaN|undefined/);
  }
  assert.match(sceneSVG('unknown'), /aria-hidden="true"/);
});

test('our picks: only featured trips that can still be booked, at most three', () => {
  const trips = [
    trip({ id: 'a', featured: 'Best first retreat', start_date: '2027-03-01', end_date: '2027-03-05' }),
    trip({ id: 'b', featured: true, status: 'sold_out' }),
    trip({ id: 'c', featured: 'Gone', start_date: '2026-10-01', end_date: '2026-10-05' }),
    trip({ id: 'd' }),
    trip({ id: 'e', featured: 'Two', start_date: '2027-04-01', end_date: '2027-04-05' }),
    trip({ id: 'f', featured: 'Three', start_date: '2027-05-01', end_date: '2027-05-05' }),
    trip({ id: 'g', featured: 'Four', start_date: '2027-06-01', end_date: '2027-06-05' }),
  ];
  assert.deepEqual(featuredTrips(trips, TODAY).map((t) => t.id), ['a', 'e', 'f']);
  assert.equal(trips[1].featured, 'Our pick', 'featured: true gets a default label');
  assert.deepEqual(featuredTrips(trips.filter((t) => !t.featured), TODAY), []);
});

test('filters narrow the list and count what each option would show', () => {
  const { trips } = loadTrips(sample);
  const upcoming = trips.filter((t) => t.start >= parseISODate(TODAY));
  assert.equal(filterTrips(upcoming, {}).length, upcoming.length);
  const sauna = filterTrips(upcoming, { theme: 'sauna' });
  assert.deepEqual(sauna.map((t) => t.id), ['arctic-winter-adventure-finland', 'scottish-isles-swim-sauna', 'norway-winter-fjords']);
  assert.deepEqual(filterTrips(upcoming, { theme: 'sauna', season: 'winter' }).map((t) => t.id), ['arctic-winter-adventure-finland', 'norway-winter-fjords']);
  assert.ok(filterTrips(upcoming, { budget: 'under-2500' }).every((t) => t.priceMin <= 2500));
  const seasons = filterCounts(upcoming, { theme: 'sauna', season: 'winter', budget: '' }, 'season');
  assert.deepEqual(seasons, { spring: 0, summer: 0, autumn: 2, winter: 2 }, 'counts ignore the filter being changed');
});

const matrixCSV = readFileSync(new URL('../data/retreats-2027.csv', import.meta.url), 'utf8');

test('the 2027 feature matrix imports cleanly', () => {
  const rows = parseCSV(matrixCSV);
  const raw = matrixToTrips(matrixCSV);
  assert.equal(raw.length, rows.length);
  const { trips, warnings } = loadTrips({ trips: raw });
  assert.deepEqual(warnings, []);
  assert.equal(trips.length, rows.length);
  for (const t of trips) {
    assert.ok(t.themes.length, `${t.id} gets at least one theme`);
    assert.ok(SCENE_NAMES.includes(t.scene), `${t.id} gets a known scene`);
    assert.ok(t.pace && t.travel, `${t.id} gets a pace and a flight band`);
    assert.equal(t.suitableForKnown, false, 'the matrix does not say who a trip suits');
  }
  const byId = Object.fromEntries(raw.map((t) => [t.source_id, t]));
  assert.ok(byId['RY27-013'].themes.includes('sauna'), 'Lakes, Saunas & Summer Days is a sauna trip');
  assert.deepEqual(byId['RY27-006'].themes, ['restorative', 'sun']);
  assert.equal(byId['RY27-006'].featured, 'Best first retreat');
  assert.equal(byId['RY27-022'].scene, 'towers');
  assert.equal(byId['RY27-008'].pace, 'active');
  assert.equal(byId['RY27-002'].travel, 'short');
  assert.equal(byId['RY27-016'].travel, 'medium');
  assert.equal(byId['RY27-013'].verified, true);
});

test('trips.json is the current import of the matrix', { skip: !String(live.note || '').includes('feature matrix') }, () => {
  const fresh = JSON.parse(formatTrips(matrixToTrips(matrixCSV), live.note));
  assert.deepEqual(live, fresh, 'run "npm run import" after changing the CSV');
});

test('a trip that does not record who it suits is scored on the other three answers', () => {
  const unknown = trip({ suitable_for: undefined });
  assert.equal(unknown.suitableForKnown, false);
  const s = scoreTrip(unknown, answers());
  assert.equal(s.criteria.who.status, 'unknown');
  assert.equal(s.max, MAX_SCORE - 10);
  assert.equal(s.score, s.max);
  assert.equal(s.percent, 100);
  assert.ok(s.ticksEveryBox);
  const text = explainMatch(s, answers());
  assert.doesNotMatch(text.why, /solo/, 'no claim about who it suits');
  assert.equal(text.caveat, null);
  assert.equal(scoreBreakdown(s, answers()).find((r) => r.key === 'who').detail, 'Not recorded for this trip yet');
});

test('pace and flight-time filters', () => {
  const trips = [trip({ id: 'a', pace: 'gentle', travel: 'short' }), trip({ id: 'b', pace: 'active', travel: 'long' }), trip({ id: 'c' })];
  assert.deepEqual(filterTrips(trips, { pace: 'gentle' }).map((t) => t.id), ['a']);
  assert.deepEqual(filterTrips(trips, { travel: 'long' }).map((t) => t.id), ['b']);
  assert.deepEqual(filterCounts(trips, {}, 'pace'), { gentle: 1, moderate: 0, active: 1 });
  const { warnings } = normaliseTrip({ id: 'x', title: 'X', destination: 'Y', start_date: '2027-01-01', end_date: '2027-01-02', price_min: 1, pace: 'sprint' });
  assert.match(warnings.join(), /unknown pace/);
});
