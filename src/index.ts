import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { config } from "./config.ts";
import { api } from "./api/index.ts";
import { compareWorker } from "./worker/index.ts";
import { initRedis } from "./redis.ts";

/**
 * Single-process entry point: Elysia HTTP server + in-process cron worker.
 */
const app = new Elysia()
  .use(cors({ origin: config.corsOrigins.length > 0 ? config.corsOrigins : true }))
  .use(compareWorker)
  .use(api)
  .get("/", () => ({
    name: "compare_feeds",
    endpoints: ["/api/health", "/api/results", "/api/results/latest", "POST /api/compare"],
    worker: { cron: config.compareCron },
  }))
  .listen(config.port);

const startedAt = new Date();
console.log(
  `🦊 compare_feeds started at ` +
    `${startedAt.toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })} ` +
    `(${startedAt.toISOString()})\n` +
    `   listening on http://${app.server?.hostname}:${app.server?.port}\n` +
    `   worker cron: "${config.compareCron}" — logs only on feed mismatch`,
);

// Connect to Redis (logs on success/failure) — no-op when REDIS_URL is unset.
initRedis();

export type App = typeof app;
