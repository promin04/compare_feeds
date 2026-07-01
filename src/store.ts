import type { CompareResult } from "./feeds/compare.ts";

/** A stored run: the comparison result plus when it ran. */
export interface StoredRun extends CompareResult {
  runAt: string;
  durationMs: number;
}

/**
 * In-memory store for worker run results.
 * Keeps the last N runs so the API can serve recent history.
 * Swap this out for a real DB (Drizzle/Postgres) later without touching the API.
 */
const MAX_HISTORY = 50;

let history: StoredRun[] = [];

export const store = {
  add(result: StoredRun) {
    history = [result, ...history].slice(0, MAX_HISTORY);
  },

  latest(): StoredRun | null {
    return history[0] ?? null;
  },

  all(): StoredRun[] {
    return history;
  },

  clear() {
    history = [];
  },
};
