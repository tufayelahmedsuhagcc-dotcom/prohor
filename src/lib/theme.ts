/**
 * Interface theme: light by default, dark on request.
 *
 * The choice is a display preference, not health data: it lives in its own
 * localStorage key so the documented reading/export store — and its schema
 * version — are untouched, and it is never part of a CSV or JSON backup.
 */
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "prohor.theme.v1";
export const DEFAULT_THEME: Theme = "light";

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

/** Anything that is not explicitly "dark" reads as the default. */
export function parseTheme(raw: string | null | undefined): Theme {
  return raw === "dark" ? "dark" : DEFAULT_THEME;
}

export function otherTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/**
 * Storage can throw (private mode, disabled cookies, quota). A failed read
 * means "the default theme", never an error the interface has to show.
 */
export function readTheme(storage?: StorageLike | null): Theme {
  if (!storage) return DEFAULT_THEME;
  try {
    return parseTheme(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(
  storage: StorageLike | null | undefined,
  theme: Theme,
) {
  if (!storage) return;
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* A preference that cannot be stored is still applied for this session. */
  }
}

export function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function applyTheme(theme: Theme, root?: HTMLElement | null) {
  const el =
    root ?? (typeof document === "undefined" ? null : document.documentElement);
  if (!el) return;
  el.dataset.theme = theme;
  const meta =
    typeof document === "undefined"
      ? null
      : document.querySelector('meta[name="theme-color"]');
  if (meta)
    meta.setAttribute("content", theme === "dark" ? "#0f1613" : "#ffffff");
}

/** Tiny store so the topbar switch and the Settings row cannot disagree. */
const listeners = new Set<(theme: Theme) => void>();
let current: Theme | null = null;

export function getTheme(): Theme {
  if (current === null) current = readTheme(browserStorage());
  return current;
}

export function setTheme(theme: Theme) {
  current = theme;
  saveTheme(browserStorage(), theme);
  applyTheme(theme);
  listeners.forEach((fn) => fn(theme));
}

export function toggleTheme(): Theme {
  const next = otherTheme(getTheme());
  setTheme(next);
  return next;
}

export function subscribeTheme(fn: (theme: Theme) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
