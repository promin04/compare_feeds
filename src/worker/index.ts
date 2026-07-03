import { cron } from "@elysiajs/cron";
import { config } from "../config.ts";
import { store } from "../store.ts";
import { fetchBetradar, fetchSportbookV2 } from "../feeds/fetch.ts";
import { compareFeeds, logMismatches } from "../feeds/compare.ts";

/** Fetches both live feeds, compares them, and records the result. */
export async function runCompareOnce() {
  const start = performance.now();
  const signal = AbortSignal.timeout(config.fetchTimeoutMs);

  const [betradar, sportbookV2] = await Promise.all([
    fetchBetradar(signal),
    fetchSportbookV2(signal),
  ]);

  const result = compareFeeds(betradar, sportbookV2);
  const now = new Date();

  // Only log when there's a discrepancy — quiet on matching runs.
  logMismatches(result, { when: now });

  const run = {
    ...result,
    runAt: now.toISOString(),
    durationMs: Math.round(performance.now() - start),
  };
  store.add(run);
  return run;
}

/**
 * Elysia cron plugin: schedules the compare worker in-process.
 * Mounted onto the main app so API + worker share one process.
 */
export const compareWorker = cron({
  name: "compare-feeds",
  pattern: config.compareCron,
  run() {
    runCompareOnce().catch((err) => console.error("[worker] run failed:", err));
  },
});
