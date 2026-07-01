import { Elysia } from "elysia";
import { config } from "./config.ts";
import { api } from "./api/index.ts";
import { compareWorker } from "./worker/index.ts";

/**
 * Single-process entry point: Elysia HTTP server + in-process cron worker.
 */
const app = new Elysia()
  .use(compareWorker)
  .use(api)
  .get("/", () => ({
    name: "compare_feeds",
    endpoints: ["/api/health", "/api/results", "/api/results/latest", "POST /api/compare"],
    worker: { cron: config.compareCron, feeds: config.feedUrls.length },
  }))
  .listen(config.port);

console.log(
  `🦊 compare_feeds running at http://${app.server?.hostname}:${app.server?.port}\n` +
    `   worker cron: "${config.compareCron}" · feeds: ${config.feedUrls.length}`,
);

export type App = typeof app;
