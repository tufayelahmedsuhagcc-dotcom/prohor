import { z } from "zod";
import type { Reading, Signal, Store } from "../types";
import { SIGNAL_KEYS, SIGNALS } from "../data/catalog";
import { normalize } from "../compute/engine";
export const STORE_KEY = "prohor.v3.workspace";
export const ReadingSchema = z.object({
  id: z.string().min(1).max(120),
  crew: z.string().min(1).max(40),
  day: z.number().int().min(1).max(5000),
  signal: z.enum(SIGNAL_KEYS as [Signal, ...Signal[]]),
  value: z.number().finite().nullable(),
  unit: z.string().max(15),
  sourceValue: z.number().finite().nullable(),
  sourceUnit: z.string().max(15),
  quality: z.enum(["valid", "missing", "invalid"]),
  mode: z.enum(["demo", "local"]),
  recordedAt: z.string().datetime(),
  note: z.string().max(500),
});
const StoreSchema = z.object({
  version: z.literal(3),
  readings: z.array(ReadingSchema).max(10000),
  actions: z
    .array(
      z.object({
        id: z.string().max(120),
        crew: z.string().max(40),
        mode: z.enum(["demo", "local"]),
        day: z.number().int().min(1).max(5000),
        action: z.string().max(30),
        status: z.enum(["done", "deferred"]),
        at: z.string().datetime(),
      }),
    )
    .max(10000),
  settings: z.object({
    crew: z.string().max(40),
    day: z.number().int().min(1).max(5000),
    mode: z.enum(["demo", "local"]),
    reducedMotion: z.boolean(),
  }),
});
export const emptyStore = (): Store => ({
  version: 3,
  readings: [],
  actions: [],
  settings: { crew: "CDR-01", day: 146, mode: "demo", reducedMotion: false },
});
export function validateStore(input: unknown): Store {
  const data = StoreSchema.parse(input) as Store;
  for (const r of data.readings) {
    if (r.crew !== "LOCAL-01")
      throw new Error(
        "Local backups must use the LOCAL-01 workspace identifier.",
      );
    if (r.mode !== "local")
      throw new Error(
        "Backups may contain local inputs only, never simulated crew records.",
      );
    if (r.quality === "valid") {
      if (r.value === null || r.sourceValue === null)
        throw new Error("A valid reading needs a value.");
      const expected = normalize(r.signal, r.sourceValue, r.sourceUnit);
      if (
        Math.abs(expected - r.value) > 0.01 ||
        r.unit !== SIGNALS[r.signal].unit
      )
        throw new Error("Inconsistent measurement units in backup.");
    }
  }
  if (
    data.settings.mode === "demo" &&
    (data.settings.day < 142 || data.settings.day > 147)
  )
    throw new Error("Demo flight days are 142–147.");
  if (new Set(data.readings.map((r) => r.id)).size !== data.readings.length)
    throw new Error("Duplicate record identifiers in backup.");
  return data;
}
export function readStore(): { store: Store; error?: string } {
  try {
    const value = localStorage.getItem(STORE_KEY);
    return { store: value ? validateStore(JSON.parse(value)) : emptyStore() };
  } catch {
    return {
      store: emptyStore(),
      error:
        "Saved data could not be read. The original browser value has not been deleted. Export or inspect it before saving new work.",
    };
  }
}
export function writeStore(store: Store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(validateStore(store)));
}
export function makeReading(
  signal: Signal,
  value: number,
  unit: string,
  day: number,
  note = "",
  crew = "LOCAL-01",
): Reading {
  const normalized = normalize(signal, value, unit);
  return ReadingSchema.parse({
    id: crypto.randomUUID(),
    crew,
    day,
    signal,
    value: normalized,
    unit: SIGNALS[signal].unit,
    sourceValue: value,
    sourceUnit: unit,
    quality: "valid",
    mode: "local",
    recordedAt: new Date().toISOString(),
    note,
  });
}
export function download(
  name: string,
  text: string,
  type = "application/json",
) {
  const u = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
