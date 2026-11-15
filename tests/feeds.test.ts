import { describe, it, expect } from "vitest";
// The server module is plain ESM shared with Vercel; types live in feeds.d.mts.
import type { FeedPayload } from "../server/feeds.mjs";
import {
  normalizeKp,
  normalizeProtons,
  normalizeDonki,
  getFeed,
} from "../server/feeds.mjs";
interface Study {
  accession: string;
  organism: string;
  kind: string;
  url: string;
}
describe("public data adapters", () => {
  it("accepts NOAA object representation", () =>
    expect(
      normalizeKp([{ time_tag: "2026-11-11T12:00:00", Kp: 2.33 }]).latest.kp,
    ).toBe(2.33));
  it("accepts NOAA array-header representation", () =>
    expect(
      normalizeKp([
        ["time_tag", "Kp"],
        ["2026-11-11 12:00:00", "3"],
      ]).latest.kp,
    ).toBe(3));
  it("orders observations by time", () =>
    expect(
      normalizeKp([
        { time_tag: "2026-11-11T12:00:00", Kp: 3 },
        { time_tag: "2026-11-11T09:00:00", Kp: 2 },
      ]).latest.kp,
    ).toBe(3));
  it("does not coerce an empty measurement to zero", () =>
    expect(() =>
      normalizeKp([{ time_tag: "2026-11-11T12:00:00", Kp: "" }]),
    ).toThrow());
  it("rejects missing measurements", () =>
    expect(() =>
      normalizeKp([{ time_tag: "2026-11-11T12:00:00", kp: null }]),
    ).toThrow());
  it("rejects out-of-range index", () =>
    expect(() =>
      normalizeKp([{ time_tag: "2026-11-11T12:00:00", Kp: 10 }]),
    ).toThrow());
  it("rejects invalid observation dates", () =>
    expect(() => normalizeKp([{ time_tag: "invalid", Kp: 2 }])).toThrow());
  it.each(["studies", "space-weather", "proton-flux", "donki-events"])(
    "serves an explicit dated fallback for %s",
    async (name) => {
      const r = await getFeed(name, true);
      expect(r.status).toBe("cached");
      expect(r.retrievedAt).toBeTruthy();
      expect(r.notice).toContain("Offline");
      expect(r.sourceUrl.startsWith("https://")).toBe(true);
    },
  );
  it("includes real related plasma-study metadata in the offline snapshot", async () => {
    const r = await getFeed<Study[]>("studies", true);
    const plasma = r.data.find(
      (s: { accession: string }) => s.accession === "OSD-571",
    );
    expect(plasma).toBeDefined();
    expect(plasma?.organism).toBe("Homo sapiens");
    expect(plasma?.kind).toContain("metadata only");
    expect(plasma?.url).toBe(
      "https://osdr.nasa.gov/bio/repo/data/studies/OSD-571",
    );
  });
  it("keeps only the >=10 MeV band and the newest satellite series", () => {
    const r = normalizeProtons([
      {
        time_tag: "2026-11-15T11:30:00Z",
        energy: ">=10 MeV",
        flux: 0.2,
        satellite: 19,
      },
      {
        time_tag: "2026-11-15T11:30:00Z",
        energy: ">=100 MeV",
        flux: 9.9,
        satellite: 19,
      },
      {
        time_tag: "2026-11-15T11:35:00Z",
        energy: ">=10 MeV",
        flux: 0.3,
        satellite: 19,
      },
      {
        time_tag: "2026-11-15T11:25:00Z",
        energy: ">=10 MeV",
        flux: 99,
        satellite: 18,
      },
    ]);
    expect(r.band).toBe(">=10 MeV");
    expect(r.unit).toBe("pfu");
    expect(r.latest.flux).toBe(0.3);
    expect(r.peak.flux).toBe(0.3);
    expect(r.points.every((p: { flux: number }) => p.flux < 9)).toBe(true);
  });
  it("does not coerce a missing proton flux to zero", () =>
    expect(() =>
      normalizeProtons([
        { time_tag: "2026-11-15T11:35:00Z", energy: ">=10 MeV", flux: "" },
      ]),
    ).toThrow());
  it("drops unknown DONKI message types and unparseable times", () => {
    const r = normalizeDonki([
      {
        messageID: "2026111501-CME-001",
        messageType: "CME",
        messageIssueTime: "2026-11-15T01:00:00Z",
        messageBody: "## header\nA CME was observed.",
      },
      {
        messageID: "x",
        messageType: "XYZ",
        messageIssueTime: "2026-11-15T01:00:00Z",
        messageBody: "n",
      },
      {
        messageID: "y",
        messageType: "CME",
        messageIssueTime: "not-a-date",
        messageBody: "n",
      },
    ]);
    expect(r.events).toHaveLength(1);
    expect(r.counts.CME).toBe(1);
    expect(r.events[0].summary).toBe("A CME was observed.");
  });
  it("rejects non-allowlisted feed names", async () => {
    await expect(getFeed("https://example.org", true)).rejects.toThrow();
  });
});
