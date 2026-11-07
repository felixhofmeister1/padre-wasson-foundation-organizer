/*
 * Turns the retreat feature matrix (a CSV, one row per retreat) into trips.json.
 *
 *   node tools/import-matrix.mjs data/retreats-2027.csv > trips.json
 *   npm run import            (the same, with the file in data/)
 *
 * Every rule that turns the matrix's tags and 1–5 scores into the quiz's answers is below,
 * so they can be checked or changed in one place. Nothing else needs editing.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/* ---------- Rules ---------- */

/** What-are-you-craving themes. A trip gets every theme whose rule matches. */
const THEME_RULES = {
  adventure: (r) => r.score.adventure >= 4 || r.tags.has('adventure') || r.tags.has('hiking') || r.act.hiking,
  restorative: (r) => r.score.restoration >= 5 || r.tags.has('restoration') || r.act.yoga || r.act.meditation,
  cultural: (r) => r.score.culture >= 5 || r.tags.has('culture') || r.act.culture,
  wild: (r) => r.score.remoteness >= 4 || ['wilderness', 'wildlife', 'nature'].some((t) => r.tags.has(t)) ||
    ['snow', 'glacier', 'ice', 'fjord', 'steppe', 'volcanic'].some((l) => r.land.has(l)),
  // Only trips with a sauna or hot springs; cold-sea swimming alone doesn't count.
  sauna: (r) => r.act.sauna || r.act.thermal_bathing || r.tags.has('sauna') || r.tags.has('thermal'),
  sun: (r) => /^(hot|warm-hot|warm)$/.test(r.climate) && r.land.has('coast'),
};

/** physical_intensity_1_5 → pace filter. */
const paceFor = (n) => (n <= 2 ? 'gentle' : n === 3 ? 'moderate' : 'active');

/** uk_travel_band_estimate → flight-time filter. */
const TRAVEL_FOR = { short: 'short', 'short-medium': 'short', medium: 'medium', 'medium-long': 'medium', long: 'long' };

/** Placeholder illustration for each trip, first matching rule wins. */
const SCENE_RULES = [
  [(r) => r.country === 'patagonia', 'towers'],
  [(r) => r.country === 'madagascar', 'baobab'],
  [(r) => r.country === 'greece', 'islands'],
  [(r) => r.land.has('volcanic') || /volcan/i.test(r.title), 'volcano'],
  [(r) => r.land.has('snow'), 'arctic'],
  [(r) => r.land.has('fjord') || (r.land.has('coast') && r.land.has('mountain')), 'fjord'],
  [(r) => r.land.has('tea hills'), 'tea'],
  [(r) => r.land.has('steppe'), 'steppe'],
  [(r) => r.land.has('desert'), 'desert'],
  [(r) => r.land.has('lake'), 'loch'],
  [(r) => r.land.has('coast') && r.climate === 'hot', 'palms'],
  [(r) => r.land.has('coast'), 'coast'],
  [() => true, 'peaks'],
];

const SCENE_ALT = {
  towers: 'Illustration: granite peaks above a glacier lake',
  baobab: 'Illustration: baobab trees at sunset',
  islands: 'Illustration: white islands on a calm sea',
  volcano: 'Illustration: a steaming volcano above green hills',
  arctic: 'Illustration: snowy forest under the northern lights',
  fjord: 'Illustration: steep mountains around a fjord',
  tea: 'Illustration: rolling tea hills',
  steppe: 'Illustration: open grassland below distant mountains',
  desert: 'Illustration: sand dunes under a warm sky',
  loch: 'Illustration: hills around a still lake',
  palms: 'Illustration: palm trees by warm water',
  coast: 'Illustration: cliffs above the sea',
  peaks: 'Illustration: snow-capped mountains',
};

/**
 * "Start with our picks". These are suggestions for the demo, chosen from the matrix
 * (gentle and short-haul; winter; remote and cultural); the team should pick the real ones.
 */
const FEATURED = {
  'RY27-006': 'Best first retreat',
  'RY27-002': 'Best winter escape',
  'RY27-005': 'Trip of a lifetime',
};

/* ---------- CSV ---------- */

export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  const [head = [], ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const list = (value) => value.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
const slug = (value) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const score = (value) => { const n = Number(value); return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 0; };

/* ---------- Conversion ---------- */

export function matrixToTrips(csvText) {
  return parseCSV(csvText).map((row) => {
    const r = {
      title: row.retreat_name,
      country: row.country_region.toLowerCase(),
      climate: row.climate_estimate.toLowerCase(),
      tags: new Set(list(row.experience_tags).flatMap((t) => t.split(/\s+/))),
      land: new Set(list(row.landscape_tags)),
      act: Object.fromEntries(Object.keys(row).filter((k) => k.startsWith('activity_') && k !== 'activity_evidence').map((k) => [k.slice(9), row[k] === '1'])),
      score: {
        restoration: score(row.restoration_1_5),
        adventure: score(row.adventure_1_5),
        culture: score(row.culture_1_5),
        remoteness: score(row.remoteness_1_5),
        intensity: score(row.physical_intensity_1_5),
      },
    };
    const scene = SCENE_RULES.find(([test]) => test(r))[1];
    const trip = {
      id: slug(`${row.retreat_id} ${row.retreat_name}`),
      source_id: row.retreat_id,
      title: row.retreat_name,
      destination: row.country_region,
      start_date: row.start_date,
      end_date: row.end_date,
      nights: Number(row.nights) || undefined,
      teacher: row.teacher,
      price_min: Number(row.price_min_gbp),
      price_max: Number(row.price_max_gbp) || Number(row.price_min_gbp),
      themes: Object.keys(THEME_RULES).filter((t) => THEME_RULES[t](r)),
      pace: r.score.intensity ? paceFor(r.score.intensity) : undefined,
      travel: TRAVEL_FOR[row.uk_travel_band_estimate.toLowerCase()],
      profile: Object.fromEntries(Object.entries(r.score).filter(([, v]) => v)),
      landscapes: list(row.landscape_tags),
      experiences: list(row.experience_tags),
      climate: row.climate_estimate,
      verified: /^confirmed/i.test(row.activity_evidence),
      status: 'available',
      featured: FEATURED[row.retreat_id],
      scene,
      image: '',
      image_alt: SCENE_ALT[scene],
      url: '',
    };
    return Object.fromEntries(Object.entries(trip).filter(([, v]) => v !== undefined));
  });
}

/** JSON with one trip per block and short arrays/objects on one line, so diffs stay readable. */
export function formatTrips(trips, note) {
  const json = JSON.stringify({ note, trips }, null, 2);
  return json
    .replace(/\[\n\s+([^\[\]{}]*?)\n\s+\]/g, (_, inner) => `[${inner.split(/,\n\s+/).join(', ')}]`)
    .replace(/"profile": \{\n\s+([^{}]*?)\n\s+\}/g, (_, inner) => `"profile": { ${inner.split(/,\n\s+/).join(', ')} }`) + '\n';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node tools/import-matrix.mjs <feature-matrix.csv> > trips.json');
    process.exit(1);
  }
  const trips = matrixToTrips(readFileSync(file, 'utf8'));
  const note = 'Imported from the 2027 retreat feature matrix (scraped from each retreat page; scores, climate and flight bands are estimates). Re-run tools/import-matrix.mjs to update.';
  process.stdout.write(formatTrips(trips, note));
  console.error(`Imported ${trips.length} trips.`);
}
