# Change log

Notes describe the shipped application. Release dates are deliberately omitted; the git history is the timeline.

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
  fails to parse. Both snapshots are in the offline precache (66 files).
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
