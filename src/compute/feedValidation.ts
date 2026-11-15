import type { SourceResponse } from "../types";
export type FeedName =
  "studies" | "space-weather" | "proton-flux" | "donki-events";
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, max = 20000): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max;
const date = (v: unknown) => text(v, 100) && Number.isFinite(Date.parse(v));
const point = (v: unknown) =>
  object(v) &&
  date(v.time) &&
  typeof v.kp === "number" &&
  Number.isFinite(v.kp) &&
  v.kp >= 0 &&
  v.kp <= 9;
/** Proton flux: a non-negative finite number per observation, no unit guessing. */
const fluxPoint = (v: unknown) =>
  object(v) &&
  date(v.time) &&
  typeof v.flux === "number" &&
  Number.isFinite(v.flux) &&
  v.flux >= 0;
const protonData = (data: unknown) =>
  object(data) &&
  text(data.band, 40) &&
  text(data.unit, 20) &&
  fluxPoint(data.latest) &&
  fluxPoint(data.peak) &&
  Array.isArray(data.points) &&
  data.points.length > 0 &&
  data.points.length <= 10000 &&
  data.points.every(fluxPoint);
const donkiData = (data: unknown) =>
  object(data) &&
  typeof data.days === "number" &&
  data.days > 0 &&
  data.days <= 90 &&
  object(data.counts) &&
  Object.values(data.counts).every(
    (n) => typeof n === "number" && Number.isFinite(n) && n >= 0,
  ) &&
  Array.isArray(data.events) &&
  data.events.length > 0 &&
  data.events.length <= 100 &&
  data.events.every(
    (e) =>
      object(e) &&
      text(e.id, 64) &&
      text(e.type, 8) &&
      date(e.begin) &&
      text(e.summary, 400) &&
      text(e.url, 500) &&
      e.url.startsWith("https://"),
  );
/** Reject malformed public responses before a chart or array operation can run. */
export function validFeed(
  name: FeedName,
  value: unknown,
): value is SourceResponse<unknown> {
  if (
    !object(value) ||
    !["live", "cached"].includes(String(value.status)) ||
    !date(value.retrievedAt) ||
    !text(value.sourceUrl, 1000) ||
    !value.sourceUrl.startsWith("https://") ||
    typeof value.notice !== "string" ||
    value.notice.length > 2000
  )
    return false;
  const data = value.data;
  if (name === "studies")
    return (
      Array.isArray(data) &&
      data.length > 0 &&
      data.length <= 100 &&
      data.every(
        (s) =>
          object(s) &&
          text(s.accession, 40) &&
          text(s.title, 2000) &&
          text(s.description) &&
          text(s.organism, 200) &&
          text(s.kind, 200) &&
          text(s.url, 1000) &&
          s.url.startsWith("https://"),
      )
    );
  if (name === "proton-flux") return protonData(data);
  if (name === "donki-events") return donkiData(data);
  return (
    object(data) &&
    point(data.latest) &&
    Array.isArray(data.points) &&
    data.points.length > 0 &&
    data.points.length <= 10000 &&
    data.points.every(point)
  );
}
