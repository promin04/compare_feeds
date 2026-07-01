/**
 * Centralised runtime configuration, read from environment variables.
 * Falls back to sensible defaults so the app boots with zero setup.
 */
export const config = {
  port: Number(Bun.env.PORT ?? 3000),

  /** Cron pattern for the compare worker. Default: every 5 minutes. */
  compareCron: Bun.env.COMPARE_CRON ?? "0 */5 * * * *",

  /** Feed URLs the worker fetches and compares each run. */
  feedUrls: (Bun.env.FEED_URLS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean),
} as const;
