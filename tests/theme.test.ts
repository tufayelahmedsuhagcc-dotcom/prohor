import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyTheme,
  otherTheme,
  parseTheme,
  readTheme,
  saveTheme,
} from "../src/lib/theme";

const fakeStorage = (seed?: string) => {
  const map = new Map<string, string>();
  if (seed !== undefined) map.set(THEME_STORAGE_KEY, seed);
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    dump: () => Object.fromEntries(map),
  };
};

describe("theme preference", () => {
  it("defaults to light — the product keeps its normal look", () => {
    expect(DEFAULT_THEME).toBe("light");
    for (const raw of [null, undefined, "", "light", "DARK", "solarized"])
      expect(parseTheme(raw)).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });

  it("toggles both ways and never returns a third value", () => {
    expect(otherTheme("light")).toBe("dark");
    expect(otherTheme("dark")).toBe("light");
    expect(otherTheme(otherTheme("dark"))).toBe("dark");
  });

  it("reads back what it stored, under one key", () => {
    const storage = fakeStorage();
    expect(readTheme(storage)).toBe("light");
    saveTheme(storage, "dark");
    expect(storage.dump()).toEqual({ [THEME_STORAGE_KEY]: "dark" });
    expect(readTheme(storage)).toBe("dark");
  });

  it("survives storage that throws, which is what private mode does", () => {
    const hostile = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readTheme(hostile)).toBe("light");
    expect(() => saveTheme(hostile, "dark")).not.toThrow();
  });

  it("marks the document element, which is what the CSS keys on", () => {
    const el = { dataset: {} as Record<string, string> };
    applyTheme("dark", el as unknown as HTMLElement);
    expect(el.dataset.theme).toBe("dark");
    applyTheme("light", el as unknown as HTMLElement);
    expect(el.dataset.theme).toBe("light");
  });

  it("is a display preference, not part of the health store", () => {
    const storage = fakeStorage();
    saveTheme(storage, "dark");
    const keys = Object.keys(storage.dump());
    expect(keys).toEqual([THEME_STORAGE_KEY]);
    expect(keys.some((k) => /reading|prohor\.v\d|store/i.test(k))).toBe(false);
  });
});

/* ------------------------------------------------------- the stylesheet itself */

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

function blockOf(start: number) {
  const end = css.indexOf("\n}", start);
  return css.slice(start, end);
}

/** Pull `--token: value` pairs out of one selector block. */
function tokensAt(selector: string) {
  const start = css.indexOf(selector);
  expect(start, `${selector} must exist in styles.css`).toBeGreaterThan(-1);
  const tokens: Record<string, string> = {};
  for (const [, k, v] of blockOf(start).matchAll(
    /^\s*--([a-z0-9-]+):\s*([^;]+);/gm,
  ))
    tokens[k] = v.trim();
  return tokens;
}

const LAYOUT_TOKENS = ["sidebar"];
const light = tokensAt(":root {");
const dark = tokensAt('[data-theme="dark"] {');
const printDark = tokensAt('  [data-theme="dark"] {');

describe("dark theme stylesheet", () => {
  it("declares exactly the same colour tokens in both themes", () => {
    const names = (t: Record<string, string>) =>
      Object.keys(t)
        .filter((k) => !LAYOUT_TOKENS.includes(k))
        .sort();
    expect(names(dark)).toEqual(names(light));
  });

  it("defines every token the stylesheet actually uses", () => {
    const used = new Set(
      [...css.matchAll(/var\(--([a-z0-9-]+)/g)].map((m) => m[1]),
    );
    expect([...used].filter((k) => !(k in light))).toEqual([]);
  });

  it("has no raw colours outside the three palettes", () => {
    const cut = (from: number, to: number) => css.slice(from, to);
    const lightStart = css.indexOf(":root {");
    const lightBlock = lightStart + blockOf(lightStart).length;
    const darkStart = css.indexOf('[data-theme="dark"] {');
    const darkBlock = darkStart + blockOf(darkStart).length;
    const printStart = css.indexOf('  [data-theme="dark"] {');
    const printBlock = printStart + blockOf(printStart).length;
    const rest =
      cut(0, lightStart) +
      cut(lightBlock, darkStart) +
      cut(darkBlock, printStart) +
      cut(printBlock, css.length);
    const raw = rest
      .replace(/var\(--[a-z0-9-]+,\s*[^)]*\)/g, "")
      .match(/#[0-9a-fA-F]{3,8}\b|\brgba?\([^)]*\)/g);
    expect(raw).toBeNull();
  });

  it("keeps paper light even when the screen is dark", () => {
    expect(printDark.panel).toBe("#ffffff");
    expect(printDark["color-scheme"]).toBeUndefined();
    expect(
      css.slice(
        css.indexOf("@media print {"),
        css.indexOf("@media print {") + 200,
      ),
    ).toContain("color-scheme: light");
    expect(printDark.text).toBe("#17232d");
  });
});

/* --------------------------------------------------------------- contrast */

const relative = (hex: string) => {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a: string, b: string) => {
  const [hi, lo] = [relative(a), relative(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Real foreground/background pairs the interface actually renders. */
const TEXT_PAIRS: [string, string][] = [
  ["text", "bg"],
  ["text", "panel"],
  ["text", "panel2"],
  ["text", "surface"],
  ["text", "accent-soft"],
  ["text-secondary", "panel"],
  ["body", "panel"],
  ["muted", "panel"],
  ["muted", "bg"],
  ["muted", "accent-soft"],
  ["link", "panel"],
  ["link", "panel2"],
  ["mint", "panel"],
  ["amber", "panel"],
  ["blue", "panel"],
  ["red", "panel"],
  ["on-accent", "accent-solid"],
  ["warning-text", "warning-soft"],
  ["info-text", "info-soft"],
  ["watch-ink", "watch-bg"],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("%s theme contrast (WCAG 2.1 AA)", (_name, palette) => {
  it.each(TEXT_PAIRS)("%s text on %s reaches 4.5:1", (fg, bg) => {
    const ratio = contrast(palette[fg], palette[bg]);
    expect(
      Number(ratio.toFixed(2)),
      `${fg} (${palette[fg]}) on ${bg} (${palette[bg]})`,
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("control outlines reach 3:1 so an input edge is visible", () => {
    expect(
      contrast(palette["control-line"], palette.panel),
    ).toBeGreaterThanOrEqual(3);
  });
});
