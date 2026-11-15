/**
 * Type surface for the shared JavaScript feed module. The server code is
 * deliberately plain ESM so Vercel can load it without a build step; these
 * declarations exist only so the TypeScript tests can import it.
 */
export interface FeedPayload<T = unknown> {
  status: "live" | "cached";
  retrievedAt: string;
  sourceUrl: string;
  notice?: string;
  data: T;
}
export interface KpSeries {
  points: { time: string; kp: number }[];
  latest: { time: string; kp: number };
}
export interface ProtonSeries {
  band: string;
  satellite?: number | string;
  unit: string;
  points: { time: string; flux: number }[];
  latest: { time: string; flux: number };
  peak: { time: string; flux: number };
}
export interface DonkiSeries {
  days: number;
  counts: Record<string, number>;
  events: {
    id: string;
    type: string;
    begin: string;
    summary: string;
    url: string;
  }[];
}
export function jsonFetch(url: string): Promise<unknown>;
export function normalizeKp(raw: unknown): KpSeries;
export function normalizeProtons(raw: unknown): ProtonSeries;
export function normalizeDonki(raw: unknown): DonkiSeries;
export function getFeed<T = unknown>(
  feed: string,
  offline?: boolean,
): Promise<FeedPayload<T>>;
export function apiHandler(req: unknown, res: unknown): Promise<void>;
