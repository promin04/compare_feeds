import { Elysia } from "elysia";
import { store } from "../store.ts";
import { runCompareOnce } from "../worker/index.ts";

/**
 * HTTP API for inspecting worker results and triggering a run on demand.
 * Grouped under /api so the root can stay a simple health/landing route.
 */
export const api = new Elysia({ prefix: "/api" })
  .get("/health", () => ({ status: "ok" }))

  .get("/results", () => store.all(), {
    detail: { summary: "All recent compare-run results (newest first)" },
  })

  .get(
    "/results/latest",
    ({ status }) => store.latest() ?? status(404, { error: "no runs yet" }),
    { detail: { summary: "Most recent compare-run result" } },
  )

  .post("/compare", () => runCompareOnce(), {
    detail: { summary: "Trigger a compare run immediately" },
  });
