/**
 * Centralised runtime configuration, read from environment variables.
 * Falls back to sensible defaults so the app boots with zero setup.
 */
export const config = {
  port: Number(Bun.env.PORT ?? 3000),

  /**
   * Cron pattern for the compare worker (6 fields: sec min hour day month weekday).
   * Default: every 10 seconds.
   */
  compareCron: Bun.env.COMPARE_CRON ?? "*/10 * * * * *",

  /** Timeout for each feed fetch, in milliseconds. */
  fetchTimeoutMs: Number(Bun.env.FETCH_TIMEOUT_MS ?? 20_000),

  /**
   * Redis connection URL. On Railway, set this to `${{Redis.REDIS_URL}}`.
   * Empty string means Redis is not configured (the app still runs).
   */
  redisUrl: Bun.env.REDIS_URL ?? "",
} as const;
