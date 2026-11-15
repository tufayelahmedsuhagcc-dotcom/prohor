// Refresh the dated public-data snapshots that ship with the app.
//
//   node scripts/snapshot-feeds.mjs
//
// Each snapshot is written to public/data/<feed>.json in the same shape the /api/feeds
// adapter returns, with status "cached" and the real retrieval timestamp. The server falls
// back to these files whenever an upstream is rate-limited, down or offline.
import { writeFile } from "node:fs/promises";

const OUT = new URL("../public/data/", import.meta.url);
const now = new Date();
const iso = (d) => d.toISOString();

async function getJson(url, timeout = 20000) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json();
}

/* ---------------------------------------------------------------- GOES protons */
// Solar energetic particles, >=10 MeV integral proton flux. Context for "the radiation
// environment is disturbed"; never a dose estimate.
export async function fetchProtonFlux() {
  const url =
    "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json";
  const raw = await getJson(url, 30000);
  if (!Array.isArray(raw) || !raw.length) throw new Error("empty proton payload");
  const band = ">=10 MeV";
  const rows = raw
    .filter(
      (r) =>
        r &&
        r.energy === band &&
        Number.isFinite(Number(r.flux)) &&
        Number.isFinite(Date.parse(r.time_tag)),
    )
    .map((r) => ({
      time: r.time_tag,
      flux: Number(r.flux),
      satellite: r.satellite,
    }));
  if (!rows.length) throw new Error(`no ${band} records`);
  // Keep the satellite with the most recent observation; drop the rest so the series is
  // one instrument, not four interleaved ones.
  const latestSatellite = rows[rows.length - 1].satellite;
  const series = rows
    .filter((r) => r.satellite === latestSatellite)
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  // 5-minute cadence: keeps the chart honest and the file small.
  const points = [];
  let lastBucket = -1;
  for (const r of series) {
    const bucket = Math.floor(Date.parse(r.time) / 300000);
    if (bucket === lastBucket) continue;
    lastBucket = bucket;
    points.push({ time: r.time, flux: r.flux });
  }
  const latest = points[points.length - 1];
  const peak = points.reduce((a, b) => (b.flux > a.flux ? b : a), points[0]);
  return {
    status: "cached",
    retrievedAt: iso(now),
    sourceUrl: url,
    data: {
      band,
      satellite: latestSatellite,
      unit: "pfu",
      points,
      latest,
      peak,
    },
    notice:
      "NOAA SWPC GOES integral proton flux, >=10 MeV. Solar energetic particle context only: not absorbed dose, not a dose rate, not an EVA or fitness decision.",
  };
}

/* ------------------------------------------------------------ NASA DONKI events */
// Space-weather notifications (flares, CMEs, geomagnetic storms, solar particle events)
// from NASA's DONKI service. An event log, not a risk forecast.
export async function fetchDonkiEvents(days = 14) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const key = process.env.NASA_API_KEY || "DEMO_KEY";
  const url = `https://api.nasa.gov/DONKI/notifications?startDate=${iso(start).slice(0, 10)}&endDate=${iso(end).slice(0, 10)}&api_key=${key}`;
  const raw = await getJson(url);
  if (!Array.isArray(raw)) throw new Error("unexpected DONKI payload");
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
  const counts = events.reduce((acc, e) => {
    acc[e.type] = (acc[e.type] || 0) + 1;
    return acc;
  }, {});
  return {
    status: "cached",
    retrievedAt: iso(now),
    sourceUrl: "https://api.nasa.gov/DONKI/notifications",
    data: { days, counts, events },
    notice:
      "NASA DONKI space-weather notifications for the last 14 days. An event log for context: not a risk forecast, not a dose estimate, and not NASA guidance for crew operations.",
  };
}

const feeds = {
  "proton-flux": fetchProtonFlux,
  "donki-events": fetchDonkiEvents,
};

const only = process.argv.slice(2);
for (const [name, fn] of Object.entries(feeds)) {
  if (only.length && !only.includes(name)) continue;
  const payload = await fn();
  await writeFile(new URL(`${name}.json`, OUT), JSON.stringify(payload, null, 1));
  const size = JSON.stringify(payload).length;
  console.log(
    `${name}: ${size} bytes, ${payload.data.points?.length ?? payload.data.events?.length} records`,
  );
}
