# Accessibility

Written because a health tool that only works for some crew members is not a health tool. This
page states what was implemented, what was actually measured, and what remains unverified.

## Implemented

- **Keyboard first.** Every interactive control is reachable and operable by keyboard, including
  the anatomy hotspots, which are buttons with visible focus rings and an explicit selected state.
- **Native dialogs.** Entry and reading dialogs use the browser's `<dialog>` element, so focus is
  trapped and restored by the platform rather than by a bespoke script.
- **No colour-only meaning.** Each state (within baseline / review / limited data) carries a text
  label and, in the atlas list, a numeric index. Colour is reinforcement, never the message.
- **Charts have table equivalents.** Every chart is paired with a focusable, labelled data table;
  wide tables scroll inside their own region instead of widening the page.
- **Dark mode is a switch, not a media query.** Light stays the default. The topbar switch and
  the Settings row write the same preference (`prohor.theme.v1`, this device only) and both show
  `aria-pressed`. The theme is applied to `<html data-theme>` before first paint by a small inline
  script, so a dark reader never sees a white flash, and `color-scheme` is set so native controls,
  scrollbars and form fields match. Printing always forces the light palette.
- **Motion is optional.** A reduced-motion preference is persisted and respected by the replay
  and chart animations.
- **Layout survives 320 px.** The narrow-width check is part of the browser suite, not an
  aspiration.
- **Language and semantics.** One `<h1>` per view, landmark regions, `aria-pressed` on toggles,
  `aria-current` in navigation, live regions for save/error confirmations.

## Measured — by run, not merged into one number

Historical and current results are kept apart on purpose, because a number without a date and a
revision is not evidence.

| Run                                    | Build / revision                                            | Engine                                                     | Viewports                   | Result                                                                                                                                                                                                                                                                                               |
| -------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recorded in this document previously   | v3.0 build, pre-`f0a2` docs refresh                         | Chromium (Playwright) + axe-core 4.11.0                    | 1440×1050, 390×844, 320×720 | 0 axe violations across 24 view scans (12 routes × 2 widths) plus 7 dialog/menu states; no page-level overflow                                                                                                                                                                                       |
| 2026-11-12 review branch               | `review/2026-11-12-hardening`                               | **not executed**                                           | —                           | The review sandbox cannot launch Chromium (`libnspr4.so`, no root), so nothing was re-measured. The new CI `browser-smoke` job is the mechanism that will produce this row.                                                                                                                          |
| 2026-11-15 final CI run `b43722130426` | `b22574d` (after dark mode, the two-tier cache and the CSP) | Chromium (Playwright) + axe-core, WCAG 2.0/2.1 A + AA tags | 320×720                     | **0 violations across all 12 routes**, under the shipped Content-Security-Policy, in the same run that executes 172 browser checks. The wide-viewport sweep (`browser_sweep.py`, 1440 px, with screenshots) and `theme_checks.py` remain un-dispatched because that job is `workflow_dispatch`-only. |

The 12 routes are: overview, atlas, logbook, trends, actions, evidence, environment, replay,
handover, judges, settings, about — eleven in the navigation plus About.

- Zero violations under the configured **axe-core** rule set (WCAG 2.0/2.1 A + AA) in the earlier
  run, and zero again in the final run at 320 px on all twelve routes.
- The dark palette has not been scanned by axe at a wide viewport: the last wide run predates it.
  Tokens were chosen to clear AA (worst measured pairing 4.84:1) and the mobile scan covers the same
  components, but that is a computed argument, not a scan of the dark theme at 1440 px.
- Route sweep at 1440×1050, 390×844 and 320×720 with no page-level horizontal overflow in that
  same run.
- **Contrast measured from the shipped CSS tokens** (WCAG 2.1 relative-luminance formula, sRGB,
  `src/styles.css`):

  | Pair                                      | Ratio                       | Result   |
  | ----------------------------------------- | --------------------------- | -------- |
  | Primary text `#20372c` on panel `#ffffff` | 12.77:1                     | AA / AAA |
  | Primary text on page canvas `#f5f8f6`     | 11.94:1                     | AA / AAA |
  | Body text `#4c6355` on panel              | 6.52:1                      | AA       |
  | Muted text `#5c7065` on panel             | 5.30:1                      | AA       |
  | Muted text on tinted panel `#f0f6f2`      | 4.84:1                      | AA       |
  | "Review" amber `#92550f` on panel         | 5.95:1                      | AA       |
  | "Within baseline" mint `#146e53` on panel | 6.20:1                      | AA       |
  | Warning text `#765323` on `#fff6e8`       | 6.46:1                      | AA       |
  | Info text `#385e79` on `#eef5fa`          | 6.26:1                      | AA       |
  | White on accent `#146e53`                 | 6.20:1                      | AA       |
  | Chart series 1–4 on white                 | 6.65 / 6.01 / 6.54 / 6.61:1 | AA       |

  The dark palette was measured the same way, from the same tokens, in both themes:

  | Pair (token, not hex)          | Light                       | Dark                        |
  | ------------------------------ | --------------------------- | --------------------------- |
  | Text on panel                  | 12.77:1                     | 14.75:1                     |
  | Text on page canvas            | 11.94:1                     | 16.06:1                     |
  | Body text on panel             | 6.52:1                      | 9.69:1                      |
  | Muted text on panel            | 5.30:1                      | 8.01:1                      |
  | Link on panel                  | 6.20:1                      | 9.75:1                      |
  | Muted text on tinted accent    | 4.75:1                      | 7.28:1                      |
  | White on primary button        | 6.20:1                      | 5.35:1                      |
  | Warning text on warning fill   | 6.46:1                      | 10.27:1                     |
  | Info text on info fill         | 6.26:1                      | 9.22:1                      |
  | Amber / blue / red status text | 5.95 / 6.21 / 5.98:1        | 8.28 / 7.91 / 6.96:1        |
  | Chart series 1–4 on panel      | 6.65 / 6.01 / 6.54 / 6.61:1 | 9.11 / 8.28 / 7.91 / 7.06:1 |

  These pairs are enforced by `tests/theme.test.ts`, which parses the tokens out of
  `src/styles.css` and fails the build if any pair drops below 4.5:1, if a token the stylesheet
  uses is undefined, if the two themes declare different token sets, or if a raw colour appears
  outside the three palettes. Worst dark pair is 5.35:1; worst light pair is 4.75:1.

  Worst pair in the shipped theme is 4.84:1, above the 4.5:1 AA threshold for normal text. These
  are computed token pairs, not a screenshot-based sample, and they do not cover images or
  non-text graphics (icons, chart bands), which rely on shape and labels as well as hue.

## Media added since that run

The 30-second and 3:49.5 films and the seven-slide deck are new surfaces, and they were built with
accessibility in mind but **not re-scanned** (see the table above):

- `<video controls preload="none" poster=… aria-label=…>` — no autoplay, so nothing moves or
  speaks without a decision; a poster frame stands in before playback.
- **Captions are a real text track.** Each film ships an `.srt`; `npm run captions` converts it to
  the `.vtt` that a `<track>` can load, and the player attaches `<track kind="captions" default>` so
  the CC control works. The `.srt` and a plain-text transcript remain downloadable without playing
  anything. A test fails if a `.vtt` drifts from its `.srt`, and both are cached for offline use.
- The deck is a keyboard-operable region: previous/next buttons, seven labelled dot buttons with
  `aria-current`, and a polite live region announcing the slide change. Each slide image carries
  alt text; the PDF is downloadable and readable outside the app.
- The 30-second pitch is cached in the background right after the first visit (install no longer
  downloads it), so it plays offline from then on; the four-minute film streams, and when the browser
  reports no connection the player says so and links the precached transcript instead of failing
  silently. If a video will not start at all, the player shows a message with direct links to the
  file and the transcript rather than a dead frame.
- **Team cards** (About) are a list of five items, each with initials in a decorative span
  (`aria-hidden`), the name as a heading, the role and one line of responsibility. Measured contrast:
  11.66:1 name, 5.95:1 responsibility and 4.84:1 role line in light mode; 13.65:1, 8.97:1 and 7.42:1
  in dark mode.

## Not verified

- **No testing with assistive-technology users** (VoiceOver, NVDA, TalkBack) and no formal audit.
  Automated scans find a subset of real problems.
- **No exhaustive cross-browser coverage.** Chromium is the tested engine; Safari and Firefox were
  not systematically exercised.
- **Not certified** against WCAG 2.2 AA or any national accessibility standard. Passing axe is
  evidence, not a certificate. This file is a record of what was measured and what was not; it is
  not an accessibility conformance report, and no third party has assessed the project.

If you are reviewing this project and find a barrier, that is a defect worth reporting under
[issues](https://github.com/tufayelahmedsuhagcc-dotcom/prohor/issues) — it will be handled as a
correctness problem, not a polish item.
