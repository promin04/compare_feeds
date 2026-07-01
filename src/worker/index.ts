import { cron } from "@elysiajs/cron";
import { config } from "../config.ts";
import { store } from "../store.ts";
import { compareFeeds } from "./compare.ts";

/** Runs one compare pass and records it in the store. */
export async function runCompareOnce() {
  if (config.feedUrls.length === 0) {
    console.warn("[worker] FEED_URLS is empty — nothing to compare");
    return null;
  }
  const result = await compareFeeds(config.feedUrls);
  store.add(result);
  console.log(
    `[worker] compared ${result.feeds.length} feeds in ${result.durationMs}ms — ` +
      `${result.overlap.length} overlapping items`,
  );
  return result;
}

/**
 * Elysia cron plugin: schedules the compare worker in-process.
 * Mounted onto the main app so API + worker share one process.
 */
export const compareWorker = cron({
  name: "compare-feeds",
  pattern: config.compareCron,
  run() {
    void runCompareOnce();
  },
});
