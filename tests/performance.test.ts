import { describe, it, expect } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { ROUTE_MODULES } from "../src/lib/prefetch";

const root = new URL("../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8");

const vercel = JSON.parse(read("vercel.json")) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
  rewrites: { source: string; destination: string }[];
};

const headerFor = (source: string, key: string) =>
  vercel.headers
    .filter((h) => h.source === source)
    .flatMap((h) => h.headers)
    .find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

describe("delivery caching", () => {
  it("lets a fingerprinted asset stay in the browser for a year", () => {
    // Without this every refresh re-validated ~440 KB of JS and CSS.
    expect(headerFor("/assets/(.*)", "Cache-Control")).toContain("immutable");
    expect(headerFor("/assets/(.*)", "Cache-Control")).toContain(
      "max-age=31536000",
    );
  });

  it("never lets the service worker itself be cached", () => {
    expect(headerFor("/sw.js", "Cache-Control")).toBe("no-cache");
  });

  it("gives content-dated extras a bounded lifetime, not an immutable one", () => {
    for (const source of [
      "/data/(.*)",
      "/docs/(.*)",
      "/media/(.*)",
      "/slides/(.*)",
    ]) {
      const value = headerFor(source, "Cache-Control");
      expect(value, source).toBeDefined();
      expect(value, source).not.toContain("immutable");
    }
  });

  it("keeps HTML revalidating so a deploy is seen", () => {
    const catchAll = vercel.headers.filter((h) => h.source === "/(.*)");
    const cacheControl = catchAll
      .flatMap((h) => h.headers)
      .find((h) => h.key.toLowerCase() === "cache-control");
    expect(cacheControl).toBeUndefined();
    expect(vercel.rewrites.some((r) => r.source.startsWith("/api"))).toBe(
      false,
    );
  });
});

const sw = read("web/sw.js");
// CORE is an alias of FILES in the generated worker, so CORE has no literal of
// its own and FILES is the list to read.
const list = (name: string) => {
  const literal =
    sw.match(new RegExp(`const ${name}=(\\[[^\\]]*\\])`)) ??
    (name === "CORE" ? sw.match(/const FILES=(\[[^\]]*\])/) : null);
  return JSON.parse(literal![1]) as string[];
};
const core = list("CORE");
const warm = list("WARM");

const bytes = (files: string[]) =>
  files.reduce((total, f) => {
    try {
      return total + statSync(new URL(`web${f}`, root)).size;
    } catch {
      return total;
    }
  }, 0);

describe("offline cache tiers", () => {
  it("installs a small shell instead of the whole media library", () => {
    // Previously install pulled 66 files / 5.46 MB before anything rendered.
    expect(bytes(core)).toBeLessThan(1.2 * 1024 * 1024);
    expect(core.length).toBeLessThan(50);
  });

  it("keeps the app, its data and its fonts in the install set", () => {
    const required = [
      "/index.html",
      "/manifest.webmanifest",
      "/data/studies.json",
      "/data/space-weather.json",
      "/data/proton-flux.json",
      "/data/donki-events.json",
    ];
    expect(required.filter((f) => !core.includes(f))).toEqual([]);
    expect(
      core.filter((f) => f.endsWith(".woff2")).length,
    ).toBeGreaterThanOrEqual(4);
  });

  it("defers films, PDFs, posters and slide images to the background warm", () => {
    for (const pattern of [
      /^\/docs\//,
      /^\/slides\//,
      /\.(jpg|png)$/,
      /prohor-30-second\.mp4$/,
    ])
      expect(
        warm.filter((f) => pattern.test(f)).length,
        String(pattern),
      ).toBeGreaterThan(0);
    expect(core.filter((f) => /^\/(docs|slides)\//.test(f))).toEqual([]);
    expect(
      core
        .filter((f) => /\.(jpg|png|mp4)$/.test(f))
        .every((f) => f.startsWith("/icons/")),
    ).toBe(true);
  });

  it("never caches the 3:49.5 film in either tier", () => {
    expect(
      [...core, ...warm].filter((f) => f.includes("prohor-four-minute")),
    ).toEqual([]);
    expect(sw).toContain("the long film streams");
  });

  it("does not fail the whole install when one optional file 404s", () => {
    expect(sw).not.toContain("addAll(");
    expect(sw).toContain("SHELL");
    expect(sw).toContain("'PROHOR shell could not be cached'");
  });

  it("answers a navigation from cache when the network is slower than 3 s", () => {
    expect(sw).toContain("AbortController");
    expect(sw).toContain("3000");
  });

  it("never intercepts the API", () => {
    expect(sw).toContain("startsWith('/api/')");
  });
});

describe("background prefetch coverage", () => {
  it("has a loader for every lazily routed view", () => {
    const context = read("src/lib/context.tsx");
    const block = context.slice(
      context.indexOf("const routes = ["),
      context.indexOf("];", context.indexOf("const routes = [")),
    );
    const routes = [...block.matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);
    const eager = ["overview", "atlas"]; // rendered inside the entry bundle
    const lazyRoutes = routes.filter((r) => !eager.includes(r));
    expect(lazyRoutes.filter((r) => !(r in ROUTE_MODULES))).toEqual([]);
    expect(Object.keys(ROUTE_MODULES)).toHaveLength(lazyRoutes.length);
  });

  it("loads every module the prefetcher names", async () => {
    for (const [name, load] of Object.entries(ROUTE_MODULES)) {
      const mod = await load();
      expect(Object.keys(mod), name).not.toHaveLength(0);
    }
  });
});

describe("generated worker behaviour", () => {
  // The worker is a generated string, so it is executed here under stubs rather
  // than trusted: escaping bugs in the generator have broken it before.
  const load = () => {
    const stub = {
      addEventListener() {},
      skipWaiting: async () => {},
      clients: { claim: async () => {}, matchAll: async () => [] },
    };
    const run = new Function(
      "self",
      "caches",
      "location",
      sw + "\nreturn {FILM,PITCH,PATH_OK,CORE,WARM};",
    ) as (...args: unknown[]) => {
      FILM: RegExp;
      PITCH: RegExp;
      PATH_OK: RegExp;
      CORE: string[];
      WARM: string[];
    };
    return run(stub, {}, { origin: "https://prohor.health" });
  };

  it("lets the long film stream but serves the short pitch from cache", () => {
    const w = load();
    expect(w.FILM.source).toBe("\\.(mp4|webm)$");
    expect(w.FILM.test("/media/prohor-four-minute.mp4")).toBe(true);
    expect(w.PITCH.test("/media/prohor-four-minute.mp4")).toBe(false);
    expect(w.PITCH.test("/media/prohor-30-second.mp4")).toBe(true);
  });

  it("caches only the static namespaces and never the API", () => {
    const w = load();
    for (const p of ["/assets/x.js", "/data/studies.json", "/icons/mark.svg"])
      expect(w.PATH_OK.test(p), p).toBe(true);
    expect(w.PATH_OK.test("/api/feeds")).toBe(false);
  });
});
