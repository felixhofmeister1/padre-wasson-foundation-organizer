# Find your retreat: clickable prototype

A mock homepage and **Our Trips** page for Reclaim Yourself that make it quicker to get from landing on the site to a trip that fits. Visitors stay about a minute and currently face around 30 trips at once; this gives them short, clear ways in. It is plain HTML, CSS and JavaScript with no build step and no backend, so it runs on any static host, including Vercel.

- **A homepage button people can see.** The live site's "Explore our retreats" button is grey and see-through over a busy photo. Here it is a solid button ("Find my retreat") beside "See all retreats", on a darkened photo. A **Today / Proposed** switch at the bottom of the hero shows the difference live.
- **Three ways in,** under the homepage hero: answer 4 questions, start with the team's picks, or browse and filter.
- **Our picks:** a short "Start with our three picks" row on the trips page, each with a reason (e.g. "Best first retreat"). Set with `featured` in `trips.json`.
- **Filters:** type, season and budget, with live counts. Options that would show nothing are greyed out, so a filter never leads to an empty page. **More filters** (folded away) adds pace and flight time from the UK, from the 2027 feature matrix.
- **The trip list stays put.** A banner at the top ("Not sure where to go? Find your retreat in one minute.") opens the quiz in place. All trips are still listed below, and every quiz screen has a "Browse all trips" link and a Close button.
- **Four questions, one per screen,** with a progress bar and a Back button: what you're craving, when you can travel (season, month or "I'm flexible"), budget, and who's travelling.
- **Results:** the top 3 trips as cards with an image, destination, dates, teacher, price range, a one-line "Why this matches you", a "Find out more" button, and a "How we scored this" breakdown. The email box "Get your matches + the free retreat guide" sits directly under the cards.
- **The real 2027 retreats.** [`trips.json`](trips.json) is imported from the 2027 retreat feature matrix in [`data/retreats-2027.csv`](data/retreats-2027.csv): 27 retreats with dates, prices, teachers, and estimated tags and 1–5 scores. The trip details show each trip's profile (rest, adventure, culture, remoteness, effort).

The images are illustrated placeholders. The tags, scores, climate and flight bands in the matrix are estimates scraped from the trip pages (only 2 of 27 trips have their activities confirmed), and the three picks are suggestions, so the team should check them before anything goes live.

## Run it locally

Browsers block the quiz when `index.html` is opened straight from disk, so serve the folder:

```bash
cd reclaim-retreat-finder
```

```bash
npx serve .
```

Then open the address it prints (usually http://localhost:3000). `python3 -m http.server` works too.

## Deploy on Vercel

This folder is its own site. Deploy it as a separate Vercel project; the repository root is a different app that sits behind a sign-in.

1. In Vercel, choose **Add New → Project** and import this repository.
2. Set **Root Directory** to `reclaim-retreat-finder`.
3. Leave **Framework Preset** as **Other**, with no build command, then click **Deploy**.

[`vercel.json`](vercel.json) adds security headers and tells search engines not to index the prototype.

## Demo script (about two minutes)

Open the deployed link on a phone and on a laptop.

1. **The button.** On the homepage, tap **Today** in the "Demo: homepage button" switch to show the current grey button, then **Proposed**.
2. **Three ways in.** Scroll down to "Three ways to find your retreat".
3. **The way in.** Tap **Find my retreat**. The quiz opens at the top of the trips page; the list is still underneath.
4. **Four taps.** Each answer moves to the next question. Back and Close are always there, and so is **Browse all trips**.
5. **Results.** Each card says in plain words why it fits. Open **How we scored this** to show the scoring isn't a black box. Tap **Find out more** to see the trip details.
6. **Capture.** Enter an email in the sign-up box. Nothing is sent in the prototype.
7. **Back to browsing.** Close the quiz and scroll: "Start with our three picks", then the filters. Pick **Adventure** and **Autumn**: 27 trips drop to a handful. Open **More filters** for pace and flight time. Your quiz matches are marked in the list.
8. **One trip's profile.** Tap **Find out more** on any trip to see its experience, landscape, climate and 1–5 profile from the matrix.

Page links: `#home` (homepage), `#our-trips` (trips page), `#find-your-retreat` (opens the quiz), `#picks`, `#trips` (the full list).

Links that jump straight to results with the 2027 data (add them to the deployed address):

| Scenario | Link |
| --- | --- |
| Five trips tick every box; the top 3 are shown | `/?craving=adventure&when=nov&budget=over-4000&who=couple` |
| Two match, one close alternative | `/?craving=restorative&when=summer&budget=under-2500&who=solo` |
| Nothing ticks every box, so the closest are shown | `/?craving=sun&when=autumn&budget=under-2500&who=couple` |
| A gap in the data: no winter trip is tagged with sauna | `/?craving=sauna&when=winter&budget=2500-4000&who=friends` |
| No trips left to book | `/?today=2029-01-01&craving=wild&when=flexible&budget=over-4000&who=solo` |

The address bar always holds the current answers, so any results page can be copied and shared. Add `today=YYYY-MM-DD` to any link to view the page as if it were that date; trips that have already started disappear.

## Updating the trip data

**From the feature matrix (the usual way).** Replace [`data/retreats-2027.csv`](data/retreats-2027.csv) with a new export (same columns), then run:

```bash
npm run import
```

That rewrites `trips.json` using the rules at the top of [`tools/import-matrix.mjs`](tools/import-matrix.mjs):

| Quiz answer or filter | Comes from the matrix |
| --- | --- |
| Adventure | `adventure_1_5` of 4 or 5, or an "adventure" or "hiking" tag or activity |
| Restorative | `restoration_1_5` of 5, or a "restoration" tag, or yoga or meditation |
| Cultural discovery | `culture_1_5` of 5, or a "culture" tag or activity |
| Wild places | `remoteness_1_5` of 4 or 5, a "wilderness", "wildlife" or "nature" tag, or a snow, glacier, ice, fjord, steppe or volcanic landscape |
| Sauna & cold plunge | a sauna or thermal-bathing activity or tag (cold-sea swimming alone doesn't count) |
| Sun & salt | a hot, warm-hot or warm climate on the coast |
| Pace | `physical_intensity_1_5`: 1–2 gentle, 3 moderate, 4–5 active |
| Flight from the UK | `uk_travel_band_estimate`: short and short-medium = short (Europe), medium and medium-long = medium, long = long haul |

The matrix doesn't say who each trip suits (solo, couple, friends), so the quiz's last question isn't counted for these trips and their scores are out of 90. Add a `suitable_for` column and mapping to make it count. The three picks are set in `FEATURED` in the same file. `npm test` fails if `trips.json` is out of date with the CSV.

**By hand.** You can also edit or replace [`trips.json`](trips.json) directly (then remove its `note`, or the up-to-date check above applies). It holds a `trips` list; each trip looks like this:

```json
{
  "id": "nepal-himalayan-adventure",
  "title": "Nepal Himalayan Adventure",
  "destination": "Nepal",
  "start_date": "2026-11-14",
  "end_date": "2026-11-22",
  "length_days": 9,
  "teacher": "Sam Okafor",
  "price_min": 5495,
  "price_max": 5995,
  "themes": ["adventure", "wild"],
  "season": ["autumn"],
  "suitable_for": ["solo", "couple", "friends"],
  "status": "available",
  "summary": "One or two sentences for the trip details.",
  "highlights": ["Up to three short bullet points"],
  "image": "https://example.com/photos/nepal.jpg",
  "image_alt": "Snow-capped peaks above green foothills",
  "scene": "peaks",
  "url": "https://www.reclaimyourself.co.uk/..."
}
```

| Field | Required | What it does |
| --- | --- | --- |
| `id` | Yes | Unique, lower-case, no spaces. Used in links. |
| `title`, `destination` | Yes | Shown on every card. |
| `start_date`, `end_date` | Yes | `YYYY-MM-DD`. Used for the "when" question and to hide trips that have already started. |
| `price_min` | Yes | Lowest price per person, in pounds, as a number. |
| `price_max` | No | Highest price per person. Defaults to `price_min`. |
| `themes` | Strongly advised | Any of `adventure`, `restorative`, `cultural`, `wild`, `sauna`, `sun`. These are the "what are you craving" answers. |
| `season` | No | Any of `spring`, `summer`, `autumn`, `winter` (UK seasons: Mar–May, Jun–Aug, Sep–Nov, Dec–Feb). Worked out from the dates if left out. Add a second season where it reads better, e.g. a November trip billed as "winter". |
| `suitable_for` | No | Any of `solo`, `couple`, `friends`. Leave it out when unknown: the "who's travelling" answer then isn't counted for that trip, for or against. |
| `length_days`, `nights` | No | Worked out from the dates if left out. Cards show nights when given. |
| `pace`, `travel` | No | `gentle`/`moderate`/`active` and `short`/`medium`/`long`. Shown under **More filters** when any trip has them. |
| `profile` | No | 1–5 scores for `restoration`, `adventure`, `culture`, `remoteness`, `intensity`, shown as the trip profile. |
| `experiences`, `landscapes`, `climate`, `verified` | No | Shown in the trip details. `verified: true` marks activities confirmed on the trip page. |
| `teacher` | No | Shown as "With …". |
| `status` | No | `available` (default), `few_places` or `sold_out`. Sold-out trips stay in the list with a label but are never suggested by the quiz. |
| `summary`, `highlights` | No | Shown in the trip details. |
| `image`, `image_alt` | No | A real photo URL and its description. Without `image`, an illustrated placeholder is drawn instead. |
| `scene` | No | Which placeholder illustration to draw: `peaks`, `towers`, `arctic`, `islands`, `coast`, `fjord`, `volcano`, `baobab`, `palms`, `desert`, `loch`, `tea`, `steppe` or `aerial`. |
| `url` | No | The real trip page. When set, "Find out more" links there instead of opening the details panel. |
| `featured` | No | Puts the trip in "Start with our picks", with this text as its label (e.g. `"Best first retreat"`). The first three bookable featured trips, soonest first, are shown; leave it out everywhere to hide the section. |

If something in the file is wrong (an unknown theme, a missing date, a duplicate id), the page still loads and leaves that trip out or ignores that tag. Each problem is listed in the browser console (open the developer tools to see it). `npm test` also checks that `trips.json` loads cleanly.

## How matching works

Every bookable trip (not sold out, not yet started) gets points for each answer, out of 100:

| Answer | Full points | Partial points |
| --- | --- | --- |
| What you're craving | **35** if it's one of the trip's `themes` | none |
| When you can travel | **25** if the trip runs in that month or season (or you're flexible) | **10** if it runs a month either side |
| Budget | **30** if the trip's price range overlaps your band | **20** if it's cheaper than your band; **10** if it starts no more than £500 above it |
| Who's travelling | **10** if it's in `suitable_for` | none; not counted at all when the trip has no `suitable_for` (the score is then out of 90) |

A trip **ticks every box** when it fully meets all four answers (a cheaper trip still counts as within budget). Those come first, highest score first, then the closest of the rest, with ties going to the sooner trip. The top three are shown.

- **Fewer than three trips tick every box:** the closest trips fill the gap, and the results say so ("Only two trips match everything you told us, so we've added the closest alternative…"). Each card marks where it falls short ("Worth knowing: it runs in September, not November.").
- **Nothing ticks every box:** the three closest are shown under "Your closest matches", with a note suggesting another month or budget.
- **Fewer than three trips can be booked at all:** as many as exist are shown, and the results say how many have places.
- **Nothing can be booked:** no cards; the email box offers to tell them when new dates are released.

The "Why this matches you" line is built only from the tags that matched, e.g. *"Real adventure: in November, in your £4,000+ price range and great for solo travellers."*

To change how much each answer counts, edit `WEIGHTS` and `PARTIAL_POINTS` at the top of [`js/matching.js`](js/matching.js). The "How we match you" note on the results page updates with them.

## The email sign-up

There is no backend, so nothing is sent. On submit, the page validates the address, shows a thank-you, and logs to the browser console the record a live version would send: email, first name, a separate optional opt-in for news, the four answers and the three trip ids. To go live, post that record to the email platform's sign-up form or API from `handleSignup` in [`js/app.js`](js/app.js).

## Accessibility

- Every control works with a keyboard and a screen reader. Answers are buttons that report their selected state, and focus moves to each new question's heading.
- Text contrast meets WCAG AA, and buttons are at least 44 px tall for touch.
- Movement is reduced when the device asks for it (`prefers-reduced-motion`).
- The phone's Back button closes the quiz instead of leaving the page.
- Checked with axe-core (WCAG 2.2 AA rules) on the page, the questions, the results and the trip details: no violations.

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The homepage and trips page: header, hero with the Today/Proposed switch, three ways in, quiz banner, picks, filters, trip list, footer, trip details panel |
| `trips.json` | All trip data |
| `css/styles.css` | All styling (brand colours are variables at the top) |
| `js/app.js` | The page behaviour: quiz, results, sign-up, list, trip details |
| `js/matching.js` | Scoring, ranking, the "why this matches you" wording, the picks and the filters, with no page code |
| `js/scenes.js` | The illustrated placeholder images |
| `fonts/` | Barlow and Barlow Condensed, self-hosted (SIL Open Font License, see `fonts/OFL.txt`) |
| `data/retreats-2027.csv` | The 2027 retreat feature matrix, as received |
| `tools/import-matrix.mjs` | Turns the matrix into `trips.json` (`npm run import`); all mapping rules are at the top |
| `tests/` | Tests for the matching rules and for `trips.json`: run `npm test` (Node 18 or newer). The ranking scenarios use a frozen copy of the sample trips in `tests/fixtures/`, so replacing `trips.json` doesn't break them. |
