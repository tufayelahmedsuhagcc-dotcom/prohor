import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const dataDir = new URL("../public/data/", import.meta.url);
const cache = new Map();
// OSD-571 adds related human plasma study metadata only; no values are used
// as personal telemetry or clinical thresholds. OSD-87 is animal metadata.
const studyIds = [575, 569, 571, 87];
/** The complete public feed allowlist. Nothing else is proxied. */
export const FEEDS = [
  "studies",
  "space-weather",
  "proton-flux",
  "donki-events",
];

export async function jsonFetch(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(9000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok)
    throw new Error(`Upstream returned HTTP ${response.status}`);
  const text = await response.text();
  if (text.length > 4_000_000) throw new Error("Upstream payload too large");
  return JSON.parse(text);
}
export function normalizeKp(raw) {
  if (!Array.isArray(raw) || !raw.length) throw new Error("Missing Kp records");
  const records = Array.isArray(raw[0])
    ? raw
        .slice(1)
        .map((r) => Object.fromEntries(raw[0].map((k, i) => [k, r[i]])))
    : raw;
  const points = records
    .filter(
      (r) =>
        r &&
        ["string", "number"].includes(typeof (r.Kp ?? r.kp)) &&
        (r.Kp ?? r.kp) !== null &&
        (r.Kp ?? r.kp) !== undefined &&
        String(r.Kp ?? r.kp).trim() !== "",
    )
    .map((r) => ({ time: String(r.time_tag || ""), kp: Number(r.Kp ?? r.kp) }))
    .filter(
      (r) =>
        r.time &&
        Number.isFinite(r.kp) &&
        r.kp >= 0 &&
        r.kp <= 9 &&
        Number.isFinite(
          Date.parse(/Z$|[+-]\d\d:\d\d$/.test(r.time) ? r.time : r.time + "Z"),
        ),
    )
    .sort(
      (a, b) =>
        Date.parse(/Z$|[+-]\d\d:\d\d$/.test(a.time) ? a.time : a.time + "Z") -
        Date.parse(/Z$|[+-]\d\d:\d\d$/.test(b.time) ? b.time : b.time + "Z"),
    );
  if (!points.length) throw new Error("No valid Kp observations");
  return { points, latest: points[points.length - 1] };
}
/* ---------------------------------------------------------------- GOES protons */
/** NOAA SWPC integral proton flux. Solar energetic particle context, never a dose. */
export function normalizeProtons(raw) {
  if (!Array.isArray(raw) || !raw.length)
    throw new Error("Missing proton records");
  const band = ">=10 MeV";
  const rows = raw
    .filter(
      (r) =>
        r &&
        r.energy === band &&
        r.flux !== null &&
        r.flux !== undefined &&
        String(r.flux).trim() !== "" &&
        Number.isFinite(Number(r.flux)) &&
        Number.isFinite(Date.parse(r.time_tag)),
    )
    .map((r) => ({
      time: r.time_tag,
      flux: Number(r.flux),
      satellite: r.satellite,
    }));
  if (!rows.length) throw new Error(`No ${band} records`);
  // Follow the spacecraft that produced the newest sample rather than
  // whichever record happens to sit last in the payload.
  const satellite = rows.reduce((newest, r) =>
    Date.parse(r.time) >= Date.parse(newest.time) ? r : newest,
  ).satellite;
  const series = rows
    .filter((r) => r.satellite === satellite)
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  const points = [];
  let bucket = -1;
  for (const r of series) {
    const b = Math.floor(Date.parse(r.time) / 300_000);
    if (b === bucket) continue;
    bucket = b;
    points.push({ time: r.time, flux: r.flux });
  }
  const latest = points[points.length - 1];
  const peak = points.reduce((a, b) => (b.flux > a.flux ? b : a), points[0]);
  return { band, satellite, unit: "pfu", points, latest, peak };
}

/* ------------------------------------------------------------ NASA DONKI events */
/** DONKI notifications: an event log for context, not a risk forecast. */
export function normalizeDonki(raw) {
  if (!Array.isArray(raw)) throw new Error("Unexpected DONKI payload");
  const wanted = new Set(["FLR", "CME", "GST", "SEP", "RBE", "IPS"]);
  const events = raw
    .filter((m) => m && wanted.has(String(m.messageType)))
    .map((m) => ({
      id: String(m.messageID || "").slice(0, 64),
      type: String(m.messageType),
      begin: String(m.messageIssueTime || "").slice(0, 40),
      summary: String(m.messageBody || "")
        .split("\n")
        .filter((line) => !line.trim().startsWith("##"))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 320),
      url: String(m.messageURL || "").slice(0, 500),
    }))
    .filter((e) => e.id && e.begin && Number.isFinite(Date.parse(e.begin)))
    .sort((a, b) => Date.parse(b.begin) - Date.parse(a.begin))
    .slice(0, 40);
  if (!events.length) throw new Error("No DONKI events in window");
  const counts = events.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});
  return { days: 14, counts, events };
}

export async function getFeed(
  feed,
  forceOffline = process.env.OFFLINE === "1",
) {
  if (!FEEDS.includes(feed)) throw new Error("Unknown feed");
  const ttl =
    feed === "studies"
      ? 86_400_000
      : feed === "donki-events"
        ? 1_800_000 // 30 min: DONKI's public demo key is rate-limited per hour
        : 600_000;
  const existing = cache.get(feed);
  if (!forceOffline && existing && Date.now() - existing.at < ttl)
    return {
      ...existing.payload,
      status: "cached",
      notice: "Server cache. Observed and retrieved timestamps are preserved.",
    };
  let error = "Offline mode requested";
  if (!forceOffline) {
    try {
      let data, sourceUrl;
      if (feed === "studies") {
        sourceUrl = "https://osdr.nasa.gov/osdr/data/osd/meta/575";
        data = await Promise.all(
          studyIds.map(async (id) => {
            const raw = await jsonFetch(
              `https://osdr.nasa.gov/osdr/data/osd/meta/${id}`,
            );
            const study = raw?.study?.[`OSD-${id}`]?.studies?.[0];
            if (
              typeof study?.title !== "string" ||
              typeof study?.description !== "string"
            )
              throw new Error("NASA metadata schema changed");
            return {
              accession: `OSD-${id}`,
              title: study.title,
              description: study.description,
              organism: id === 87 ? "Mus musculus" : "Homo sapiens",
              url: `https://osdr.nasa.gov/bio/repo/data/studies/OSD-${id}`,
              kind:
                id === 575
                  ? "Human research · analyzed CMP table"
                  : id === 87
                    ? "Animal research · metadata only"
                    : "Human research · metadata only",
            };
          }),
        );
      } else if (feed === "space-weather") {
        sourceUrl =
          "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
        data = normalizeKp(await jsonFetch(sourceUrl));
      } else if (feed === "proton-flux") {
        sourceUrl =
          "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json";
        data = normalizeProtons(await jsonFetch(sourceUrl));
      } else {
        const key = process.env.NASA_API_KEY || "DEMO_KEY";
        const end = new Date();
        const start = new Date(end.getTime() - 14 * 86_400_000);
        sourceUrl = `https://api.nasa.gov/DONKI/notifications?startDate=${start.toISOString().slice(0, 10)}&endDate=${end.toISOString().slice(0, 10)}`;
        data = normalizeDonki(await jsonFetch(`${sourceUrl}&api_key=${key}`));
      }
      const payload = {
        status: "live",
        retrievedAt: new Date().toISOString(),
        sourceUrl,
        data,
        notice:
          "Fetched from the source. A network response is not a guarantee that the underlying observation is current.",
      };
      cache.set(feed, { at: Date.now(), payload });
      return payload;
    } catch (e) {
      error = e.message;
    }
  }
  const fallback =
    existing?.payload ||
    JSON.parse(await readFile(new URL(`${feed}.json`, dataDir), "utf8"));
  return {
    ...fallback,
    status: "cached",
    notice: `${forceOffline ? "Offline mode" : "Source unavailable"} — using a dated research snapshot. ${forceOffline ? "" : error}`,
  };
}
export async function apiHandler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    return res.end(
      JSON.stringify({
        error:
          "Read-only public-data API. Health records remain in your browser.",
      }),
    );
  }
  const url = new URL(req.url, "https://prohor.local"),
    feed = url.searchParams.get("feed");
  if (!FEEDS.includes(feed)) {
    res.statusCode = 400;
    return res.end(
      JSON.stringify({ error: `feed must be one of ${FEEDS.join(", ")}` }),
    );
  }
  try {
    res.end(JSON.stringify(await getFeed(feed)));
  } catch {
    res.statusCode = 503;
    res.end(
      JSON.stringify({
        status: "unavailable",
        error: "Source and snapshot unavailable",
      }),
    );
  }
}
