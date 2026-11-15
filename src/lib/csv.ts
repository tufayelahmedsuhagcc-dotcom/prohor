/**
 * CSV import and export.
 *
 * Split out of `storage.ts` on 2026-11-15: nothing on the first screen needs a
 * CSV parser, so it is only downloaded when someone actually imports or
 * exports, instead of on every page load.
 */
import Papa from "papaparse";
import { ReadingSchema, makeReading } from "./storage";
import { SIGNAL_KEYS } from "../data/catalog";
import type { Reading, Signal } from "../types";

export function parseCsv(text: string): { rows: Reading[]; errors: string[] } {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const errors = parsed.errors.map((e) => `CSV: ${e.message}`);
  const rows: Reading[] = [];
  const required = ["day", "signal", "value", "unit"];
  if (required.some((k) => !parsed.meta.fields?.includes(k)))
    return {
      rows: [],
      errors: ["Required columns: day, signal, value, unit. Optional: note."],
    };
  if (parsed.data.length > 10000)
    return { rows: [], errors: ["Maximum 10,000 rows per import."] };
  parsed.data.forEach((r, i) => {
    try {
      const signal = r.signal?.trim() as Signal;
      if (!SIGNAL_KEYS.includes(signal)) throw new Error("Unknown signal key.");
      if (!r.day?.trim() || !r.value?.trim())
        throw new Error("Day and value must not be blank.");
      if (r.mode?.trim() === "demo")
        throw new Error(
          "A simulation export cannot be imported as local measurements. Use the separate demo workspace.",
        );
      if (r.quality?.trim() && r.quality.trim() !== "valid")
        throw new Error(
          "CSV import accepts valid numeric measurements only. Use JSON backup for missing or invalid records.",
        );
      const day = Number(r.day);
      if (!Number.isInteger(day) || day < 1 || day > 5000)
        throw new Error("Day must be an integer from 1 to 5000.");
      const reading = makeReading(
        signal,
        Number(r.value),
        r.unit?.trim(),
        day,
        (r.note || "Imported local data; not independently verified.").slice(
          0,
          500,
        ),
      );
      if (r.recordedAt?.trim()) reading.recordedAt = r.recordedAt.trim();
      rows.push(ReadingSchema.parse(reading));
    } catch (e) {
      errors.push(`Row ${i + 2}: ${(e as Error).message}`);
    }
  });
  return { rows: errors.length ? [] : rows, errors };
}
export function csvExport(rows: Reading[]): string {
  return Papa.unparse(
    rows.map((r) => ({
      day: r.day,
      signal: r.signal,
      value: r.sourceValue,
      unit: r.sourceUnit,
      note: r.note,
      quality: r.quality,
      mode: r.mode,
      recordedAt: r.recordedAt,
    })),
    { escapeFormulae: true },
  );
}
