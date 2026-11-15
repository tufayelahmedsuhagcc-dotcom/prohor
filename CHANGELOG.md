# Change log

Notes describe the shipped application. Release dates are deliberately omitted; the git history is the timeline.

## Unreleased — team section, video fixes and real captions

- **The team is a section of its own on About.** Five cards — initials, name, role, and what each
  person owns — driven by `src/data/team.ts`, replacing a bulleted list inside a side panel. It is a
  `auto-fit` grid that goes to one column under 560 px, and every pairing that matters clears AA
  contrast in both themes (worst is 4.84:1, the 11 px role line in light mode).
- **Fixed: the 30-second pitch misbehaved on desktop.** The worker answered a video's byte-range
  request with the whole cached file as a `200`. A `<video>` element seeks with ranges, so the player
  stalled or jumped instead of playing. Media now goes straight to the network while it is reachable
  — the CDN answers with real `206`s — and the cached copy is only used offline, sliced to the range
  that was asked for (`Content-Range`, `Accept-Ranges`, `416` when the range is past the end).
- **Fixed: nothing was cached at runtime.** The lazy-cache branch tested a regex that had lost its
  backslashes in the generator, so it never matched. It now uses the same `PATH_OK` the tests cover,
  and range requests are never stored.
- **The player says so when a video will not start**, instead of showing a dead frame: a message with
  a direct link to the file and to the transcript.
- **Captions are real.** The films ship `.srt` only, which a `<track>` cannot load, so the note that
  called them "embedded" was wrong. `npm run captions` converts every `.srt` to `.vtt`, the player
  attaches `<track kind="captions" default>`, and both the captions and the `.srt` are cached in the
  warm tier. A test fails if a `.vtt` drifts from its `.srt`.
- **The four-minute film's transcript and captions are cached**, which the page already promised but
  the exclusion rule had swept up with the film itself. The film is still never cached.
- Judges copy no longer says playback requires a connection; the pitch plays offline once warmed.
- Every one of the twelve routes is now checked at 320, 390 and 1440 px in the push job for a single
  `h1` and for sideways scrolling, not just the hand-run axe sweep. 219 tests total.

## Unreleased — loading and refreshing made faster

- **Repeat visits stop re-downloading the app.** `vercel.json` now sends `public,
max-age=31536000, immutable` for fingerprinted `/assets/` and `/icons/`; before this, every
  refresh re-validated ~440 KB of JS and CSS and the fonts. `/data/` gets an hour with
  `stale-while-revalidate`, `/docs/`, `/media/` and `/slides/` a week, `/sw.js` stays `no-cache`, and
  HTML keeps revalidating so a deploy is still seen.
- **Install caches 0.94 MB instead of 5.46 MB.** The service worker is now two-tiered: install
  stores the shell, data and woff2 fonts (42 files); films, PDFs, the ZIP, posters and slide images
  (28 files, 4.8 MB) are fetched by a background warm the page triggers after `load`. Install is
  per-file, so one 404 no longer fails the whole cache, and it only fails if the shell itself is
  missing. The 3:49.5 film is still never cached.
- **A navigation is answered within 3 seconds** — network first, cached shell after that deadline.
- **Idle prefetch.** The ten lazy views are fetched with `requestIdleCallback` after load, so
  switching views is a cache hit. `src/lib/prefetch.ts` is the single list of route loaders, used by
  both `App.tsx` and the prefetcher.
- **The CSV parser left the first-load path.** `parseCsv`/`csvExport` moved to `src/lib/csv.ts`
  (papaparse, 19 KB raw / 7 KB gzip), imported only by the views that import or export CSV.
- Vendor chunks (`react`, `zod`, `icons`, `papa`) are split so a deploy that only changes app code no
  longer invalidates the React runtime in every visitor's cache.
- 24 tests in `tests/performance.test.ts` enforce the header policy, the two cache tiers and the
  install budget, execute the generated worker under stubs, and fail if a routed view has no
  prefetch loader. 219 tests total.

## Unreleased — dark mode

- **A theme switch.** Light stays the default; the topbar switch and the Settings row toggle
  `<html data-theme="dark">`, and the choice is persisted under its own `prohor.theme.v1` key. The
  reading store, its schema version and its exports are untouched — a theme is not health data.
- The theme is applied before first paint by a small inline script in `index.html` (no white flash),
  `color-scheme` is set so native controls follow, and `@media print` resets the whole palette so
  paper stays light whatever the screen shows.
- **Every colour in `src/styles.css` is now a token.** 101 raw hex/rgb literals in the report,
  judge, dossier, slide and landing sections were mapped onto semantic tokens, and six near
  identical link greens plus four near identical surfaces were collapsed. This also fixed six
  tokens that were referenced with light-only fallbacks but never defined (`--ink`, `--tint`,
  `--accent`, `--watch-bg`, `--watch-line`, `--watch-ink`), which would have stayed light in dark
  mode.
- **Tested, not eyeballed:** `tests/theme.test.ts` (52 tests) covers the preference logic, storage
  that throws, and then parses `src/styles.css` to assert that both themes declare the same token
  set, that every `var(--x)` used is defined, that no raw colour exists outside the three palettes,
  and that 20 real foreground/background pairs clear 4.5:1 in both themes. Worst dark pair 5.35:1.

## Unreleased — two more public data channels, and deep links that resolve

- **NOAA GOES integral proton flux** (`/api/feeds?feed=proton-flux`): the `>=10 MeV` band, one
  sample per five-minute bucket, following the spacecraft that produced the newest sample. Shown
  on Environment as latest value, 24-hour peak, band and observation time in the source's own
  `pfu`. The panel states that particle flux is not dose; no conversion is offered anywhere.
- **NASA DONKI notification log** (`/api/feeds?feed=donki-events`): the last 14 days of public
  notifications, typed and newest-first with source links, labelled as context rather than a
  forecast. `NASA_API_KEY` is used when set; the public `DEMO_KEY` is hourly rate-limited, so a
  30-minute TTL and the bundled snapshot are the normal path.
- `server/feeds.mjs` now exports one `FEEDS` allowlist used by both `getFeed` and the HTTP
  handler — they had drifted, and the new feeds were rejected with 400 until they shared it.
  `normalizeProtons` rejects an empty flux value instead of reading it as zero, and picks the
  current spacecraft by newest timestamp rather than by array position.
- `npm run snapshot:feeds` regenerates both dated snapshots and writes nothing when an upstream
  fails to parse. Both snapshots are in the core offline cache, which installs on its own.
- `server/feeds.d.mts` gives the TypeScript tests real types instead of a `@ts-expect-error`.
- **Deep links now resolve.** The app routed on the URL hash while already falling back to the
  last path segment, but only six paths were rewritten on Vercel, so `prohor.health/environment`
  and five other views returned 404 before the bundle loaded. Each view gets a rewrite, and a test
  reads the route list out of `src/lib/context.tsx` so a new view cannot be added without one.

## Unreleased — media, deck and CI hardening

- Recorded 30-second film and 3:49.5 judging film added under `public/media/` with SRT captions,
  plain-text transcripts and poster frames; both stream in the overview and judges' views and are
  excluded from the offline precache.
- Seven-slide presentation PDF (`public/docs/PROHOR_Seven_Slide_Presentation.pdf`) with a
  keyboard-operable in-app slide deck.
- CI: the "committed build matches a fresh build" step now diffs `web/` instead of checking that
  three files exist; a Playwright browser-smoke job and a manual axe-core job were added.
- Documentation: view counts corrected to eleven routed views (twelve panels with the expanded
  atlas); the personal-baseline / NASA-research boundary restated in README, SUBMISSION and
  ARCHITECTURE; ARCHITECTURE gains four plain-text data pathways; ACCESSIBILITY separates earlier
  runs from unrun checks; ROADMAP.md, two issue templates and a conservative Dependabot config added.

## Judging polish update

- Added a three-step synthetic judging walkthrough on Mission overview, with a guard that keeps
  demo navigation from touching a local workspace whose storage warning is unresolved.
- Added a **Judges' resources** view: guided tour, a four-page project brief as a bundled PDF
  (open or download), and links to provenance, methodology and source.
- Bundled brief is part of the service-worker precache, so it survives an offline reload.
- Fixed a 320 CSS-pixel header overflow and raised several mobile touch targets to 44 px.
- Added real NASA **OSD-571** plasma-study metadata to the curated library, with a refreshed dated
  offline snapshot. Metadata only: no values reach the OSD-575 chart or a personal baseline.
- Linked the public repository from About.
- Added a judges' library alongside the brief: four separate three-page dossiers (mission & demo,
  data & evidence, technology & method, safety/impact/roadmap), each openable and downloadable,
  plus a single ZIP. All five documents and the ZIP are precached for offline use.
- Regression coverage: `tests/feeds.test.ts` asserts the OSD-571 snapshot entry (128 unit tests),
  and `tests/judges_resources.py` / `tests/judging_update.py` exercise the new view, the PDF
  download and 320/375/390 px layouts.

## 3.0.0 — white-build release

### Interface

- White/light surface system across all eleven views, with teal actions and restrained amber
  review states; semantic colour tokens centralised in CSS custom properties.
- Detailed interactive SVG anatomy and skeleton with numbered system hotspots, keyboard
  selection and a contextual evidence panel.
- Consistent navigation, command search, history/hash routing, per-view titles and legacy route
  aliases; mobile navigation, reduced-motion control and print styling.
- Locally bundled Inter and Space Grotesk; installable app manifest and icons.

### Working local workflows

- Validated single-reading entry and optional multi-indicator daily check-in, with unit
  normalisation and original units preserved.
- Local storage schema validation, quota and unreadable-storage handling, explicit recovery
  export and reset.
- CSV template and atomic import, spreadsheet-safe exports, validated JSON backup and restore.
- Cross-tab updates, profile/day/mode isolation, bounded logbook pagination.
- Routine done/deferred events and a structured handover packet (text, JSON, clipboard, print).

### Reproducible science

- Personal prior-day median/IQR engine with documented minimum coverage, direction rules and
  change floors.
- Deterministic 888-record synthetic fixture across two profiles and 37 days.
- Independent in-browser parsing of the original OSD-575 submitted CSV with SHA-256
  verification, four-subject comparison and source row references.
- Read-only NASA OSDR and NOAA SWPC adapters with timeouts, schema validation, allowlisted
  feeds, TTL cache and dated fallbacks.

### Durability

- Editable TypeScript source, production build, same-origin API, Vercel configuration and
  Node/Python hosting instructions.
- Content-hashed service worker that precaches the app, local fonts and research files; API
  responses are never silently cached.
- Unit tests, executable browser workflows, screenshots and a test report in `docs/`.

### Removed by design

- Fake live telemetry, decorative sensor/latency states and a sync queue with no endpoint.
- Simulated role-cookie authentication presented as access control.
- Unverified clinical claims, health scores, prediction probabilities and radiation-dose
  conversion.
- Runtime language-model dependency: explanations are deterministic and source-linked.
- Accounts, trackers, analytics and camera/microphone/location permissions.
