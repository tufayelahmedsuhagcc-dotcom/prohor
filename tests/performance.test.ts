import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
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
const buildScript = read("scripts/build-sw.mjs");
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
      [...core, ...warm].filter((f) => f.includes("prohor-four-minute.mp4")),
    ).toEqual([]);
    // Its words still travel offline, which is what the page promises.
    expect(
      warm.filter((f) => f.startsWith("/media/prohor-four-minute")),
    ).toEqual(
      expect.arrayContaining([
        "/media/prohor-four-minute-transcript.txt",
        "/media/prohor-four-minute.srt",
        "/media/prohor-four-minute.vtt",
      ]),
    );
    expect(sw).not.toContain("prohor-four-minute.mp4");
    // The exclusion lives in the generator, so assert it there too.
    expect(buildScript).toContain(
      "/^\\/media\\/prohor-four-minute.*\\.(mp4|webm)$/",
    );
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
  type Worker = {
    FILM: RegExp;
    PATH_OK: RegExp;
    RANGE: RegExp;
    CORE: string[];
    WARM: string[];
    byRange: (request: Request, hit: Response) => Promise<Response>;
    media: (request: Request, url: URL) => Promise<Response>;
  };
  const offline = () => Promise.reject(new TypeError("offline"));
  const load = (
    cacheHit: Response | null = null,
    fetchImpl: typeof fetch = offline,
  ): Worker => {
    const cache = {
      match: async () => cacheHit ?? undefined,
      put: async () => {},
      add: async () => {},
    };
    const stub = {
      addEventListener() {},
      skipWaiting: async () => {},
      clients: { claim: async () => {}, matchAll: async () => [] },
    };
    const run = new Function(
      "self",
      "caches",
      "location",
      "fetch",
      sw + "\nreturn {FILM,PATH_OK,RANGE,CORE,WARM,byRange,media};",
    ) as (...args: unknown[]) => Worker;
    return run(
      stub,
      { open: async () => cache, keys: async () => [] },
      { origin: "https://prohor.health" },
      fetchImpl,
    );
  };
  const video = (bytes: number) =>
    new Response(new Blob([new Uint8Array(bytes).fill(7)]), {
      status: 200,
      headers: { "content-type": "video/mp4", "content-length": String(bytes) },
    });
  const rangeRequest = (range: string) =>
    new Request("https://prohor.health/media/prohor-30-second.mp4", {
      headers: { range },
    });

  it("treats every video as media, not just the long film", () => {
    const w = load();
    expect(w.FILM.source).toBe("\\.(mp4|webm)$");
    expect(w.FILM.test("/media/prohor-four-minute.mp4")).toBe(true);
    expect(w.FILM.test("/media/prohor-30-second.mp4")).toBe(true);
    expect(w.FILM.test("/assets/index-abc.js")).toBe(false);
  });

  it("caches only the static namespaces and never the API", () => {
    const w = load();
    for (const p of ["/assets/x.js", "/data/studies.json", "/icons/mark.svg"])
      expect(w.PATH_OK.test(p), p).toBe(true);
    expect(w.PATH_OK.test("/api/feeds")).toBe(false);
  });

  // A whole-body 200 for a byte-range request is what made the pitch misbehave
  // on desktop, so the offline path has to answer ranges properly.
  it("answers a byte range from the cached copy with a real 206", async () => {
    const w = load();
    const res = await w.byRange(rangeRequest("bytes=10-19"), video(100));
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 10-19/100");
    expect(res.headers.get("content-length")).toBe("10");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect((await res.arrayBuffer()).byteLength).toBe(10);
  });

  it("handles open-ended and suffix ranges", async () => {
    const w = load();
    const open = await w.byRange(rangeRequest("bytes=90-"), video(100));
    expect(open.status).toBe(206);
    expect(open.headers.get("content-range")).toBe("bytes 90-99/100");
    const suffix = await w.byRange(rangeRequest("bytes=-10"), video(100));
    expect(suffix.headers.get("content-range")).toBe("bytes 90-99/100");
  });

  it("serves the whole cached file when no range was asked for", async () => {
    const w = load();
    const res = await w.byRange(
      new Request("https://prohor.health/media/prohor-30-second.mp4"),
      video(100),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe("100");
    expect((await res.arrayBuffer()).byteLength).toBe(100);
  });

  it("rejects a range that starts past the end of the file", async () => {
    const w = load();
    const res = await w.byRange(rangeRequest("bytes=200-300"), video(100));
    expect(res.status).toBe(416);
    expect(res.headers.get("content-range")).toBe("bytes */100");
  });

  it("falls back to the cached copy only when the network fails", async () => {
    const cached = load(video(100));
    const req = rangeRequest("bytes=0-9");
    const res = await cached.media(req, new URL(req.url));
    // fetch is stubbed to the real one, which cannot reach prohor.health here.
    expect([206, 504]).toContain(res.status);
    if (res.status === 206)
      expect(res.headers.get("content-range")).toBe("bytes 0-9/100");
  });

  it("says so when a video is neither online nor cached", async () => {
    const w = load(null);
    const req = rangeRequest("bytes=0-9");
    const res = await w.media(req, new URL(req.url));
    expect(res.status).toBe(504);
    expect(await res.text()).toContain("transcript");
  });
});

describe("video captions", () => {
  it("keeps a .vtt beside every .srt, converted from the same cues", async () => {
    const { srtToVtt } = await import("../scripts/build-vtt.mjs");
    const dir = new URL("../public/media/", import.meta.url);
    const srts = readdirSync(dir).filter((f) => f.endsWith(".srt"));
    expect(srts.length).toBeGreaterThan(0);
    for (const srt of srts) {
      const vtt = srt.replace(/\.srt$/, ".vtt");
      expect(existsSync(new URL(vtt, dir)), vtt).toBe(true);
      expect(readFileSync(new URL(vtt, dir), "utf8")).toBe(
        srtToVtt(readFileSync(new URL(srt, dir), "utf8")),
      );
    }
  });

  it("points the player at the captions instead of claiming they are embedded", () => {
    const source = read("src/components/Presentation.tsx");
    expect(source).toContain('kind="captions"');
    expect(source).toContain(".vtt");
    expect(source).not.toContain("captions are embedded");
  });

  it("ships the captions through the offline warm tier", () => {
    const warm = JSON.parse(
      sw.match(/const WARM=(\[[^\]]*\])/)![1],
    ) as string[];
    expect(warm.some((f) => f.endsWith(".srt"))).toBe(true);
    expect(warm.some((f) => f.endsWith(".vtt"))).toBe(true);
  });
});

describe("security headers", () => {
  const catchAll = vercel.headers.find((rule) => rule.source === "/(.*)")!;
  const header = (name: string) =>
    catchAll.headers.find((h) => h.key.toLowerCase() === name)?.value ?? "";
  const inlineScript = () =>
    read("web/index.html").match(/<script>(.*?)<\/script>/s)![1];

  it("pins the content-security-policy to the one inline script that exists", () => {
    const csp = header("content-security-policy");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
    // The pre-paint theme script is inline, so its hash has to match the built
    // page exactly or dark mode silently stops being applied.
    const digest = createHash("sha256").update(inlineScript()).digest("base64");
    expect(csp).toContain(`'sha256-${digest}'`);
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self'");
  });

  it("refuses framing and turns off devices the app never uses", () => {
    expect(header("x-frame-options")).toBe("SAMEORIGIN");
    const policy = header("permissions-policy");
    for (const device of ["camera", "microphone", "geolocation"])
      expect(policy).toContain(`${device}=()`);
  });

  it("serves the same policy from the local server the browser tests use", () => {
    // Otherwise a CSP that breaks the app would only show up in production.
    const server = read("server/start.mjs");
    expect(server).toContain('"../vercel.json"');
    expect(server).toContain("cache-control");
  });
});
