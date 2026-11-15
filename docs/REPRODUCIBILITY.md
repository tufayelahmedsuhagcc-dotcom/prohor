# Reproducibility

One page, exact commands, expected output. If any of this does not reproduce on your machine, that
is a bug worth an issue.

## Environment used for the recorded results

| Tool     | Version                            |
| -------- | ---------------------------------- |
| Node.js  | v20.20.2 locally · 22 in CI        |
| npm      | 10.8.2                             |
| Python   | 3.13.18 (browser/API scripts only) |
| OS       | Linux x86-64                       |
| Chromium | Playwright-managed, CI only        |

Node **≥ 20.19** is required (`package.json` engines). The app itself needs no Python; Python is only
for the optional browser suites and PDF generators.

## Five commands that must pass

```bash
npm ci                 # installs from package-lock.json, no network surprises
npm run typecheck      # tsc -b, strict
npm test               # 128 tests in 5 files
npm run format:check   # Prettier
npm run build          # vite build + service worker
```

Expected numbers, so you can tell a real pass from a partial one:

| Signal               | Expected                                                                    |
| -------------------- | --------------------------------------------------------------------------- |
| Unit tests           | **128 passed** — engine 61, storage 24, hardening 21, research 11, feeds 11 |
| Precache             | `Offline precache: 65 files; cache prohor-v3-<12 hex>`                      |
| Committed build diff | `git status --porcelain -- web/` prints **nothing** after `npm run build`   |
| Initial JS bundle    | ≈ 420 KB raw / ≈ 130 KB gzip, plus per-route chunks (lazy-loaded views)     |

## Run it

```bash
npm start              # http://localhost:3000 — serve the committed build + /api/feeds
OFFLINE=1 npm start    # same, but public feeds come only from the dated snapshots
npm run dev            # http://localhost:5173 — dev server, hot reload
python3 -m http.server 3000 --directory web    # static-only fallback, no API
```

`npm start` needs a moment: wait for the **Offline ready** badge before testing offline behaviour.
Do not open `web/index.html` by double-clicking — the app uses root-relative URLs.

## Verify the NASA data by hand

The evidence view re-verifies on every load, but you can check it without the app:

```bash
sha256sum public/data/osd575-submitted.csv
# compare with the value in public/data/source-manifest.json
python3 -c "import json;print(json.load(open('public/data/source-manifest.json')))"
```

A mismatch is a hard failure in the app: the archive analysis is blocked rather than silently
recomputed. `.gitattributes` pins `*.csv` as binary so a clone cannot rewrite line endings and break
this check.

## Browser and accessibility suites (optional, CI does this)

```bash
python -m pip install -r requirements-test.txt
python -m playwright install chromium
PROHOR_URL=http://127.0.0.1:3000 python tests/e2e.py
PROHOR_URL=http://127.0.0.1:3000 python tests/browser_hardening.py
PROHOR_URL=http://127.0.0.1:3000 python tests/judges_resources.py
PROHOR_URL=http://127.0.0.1:3000 python tests/presentation.py
PROHOR_URL=http://127.0.0.1:3000 python tests/browser_sweep.py     # axe-core sweep
```

Screenshots and JSON reports land in the git-ignored `docs/test-results/`.

## Regenerate the documents

```bash
python -m pip install reportlab
python scripts/generate_presentation.py      # seven-slide deck
python scripts/generate_judges_brief.py      # four-page brief
python scripts/generate_judges_library.py    # four dossiers + ZIP
npm run build                                # copies them into web/docs
```

The scripts expect DejaVu Sans at `/usr/share/fonts/truetype/dejavu/`.

## What "reproducible" does not mean here

Rebuilding the app reproduces the software, not the science. The rule is an unvalidated heuristic,
the NASA archive is four crew on one short flight, and passing tests say nothing about clinical
validity or accessibility conformance. See [METHODOLOGY.md](METHODOLOGY.md) and
[ACCESSIBILITY.md](ACCESSIBILITY.md).
