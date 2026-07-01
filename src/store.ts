import type { CompareResult } from "./worker/compare.ts";

/**
 * In-memory store for worker run results.
 * Keeps the last N runs so the API can serve recent history.
 * Swap this out for a real DB (Drizzle/Postgres) later without touching the API.
 */
const MAX_HISTORY = 50;

let history: CompareResult[] = [];

export const store = {
  add(result: CompareResult) {
    history = [result, ...history].slice(0, MAX_HISTORY);
  },

  latest(): CompareResult | null {
    return history[0] ?? null;
  },

  all(): CompareResult[] {
    return history;
  },

  clear() {
    history = [];
  },
};
