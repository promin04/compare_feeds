import { Elysia } from "elysia";
import { store } from "../store.ts";
import { runCompareOnce } from "../worker/index.ts";
import { redisPing } from "../redis.ts";
import {
  getMatchHeatmap,
  getMarketHeatmap,
  getMarketBreakdown,
  queryDay,
  searchByMatch,
} from "../storage/redis-store.ts";

/** Parse a time query param: accepts epoch-ms or an ISO string; undefined if blank/invalid. */
function parseTime(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = /^\d+$/.test(v) ? Number(v) : Date.parse(v);
  return Number.isFinite(n) ? n : undefined;
}

function toInt(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * HTTP API for inspecting worker results and triggering a run on demand.
 * Grouped under /api so the root can stay a simple health/landing route.
 */
export const api = new Elysia({ prefix: "/api" })
  .get("/health", async () => ({ status: "ok", redis: await redisPing() }))

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
  })

  // Heatmap grid (last N days × 24 hours). type=match → distinct problem-matches,
  // type=market → count of markets sportbookV2 is missing.
  .get(
    "/heatmap",
    ({ query }) => {
      const days = toInt(query.days);
      return query.type === "market" ? getMarketHeatmap(days) : getMatchHeatmap(days);
    },
    { detail: { summary: "Heatmap grid (query: type=match|market, days)" } },
  )

  // Per-market-name breakdown for one market-heatmap cell.
  .get(
    "/heatmap/breakdown",
    ({ query, status }) => {
      if (!query.day || !query.hour) return status(400, { error: "day and hour required" });
      return getMarketBreakdown(query.day, query.hour);
    },
    { detail: { summary: "Missing-market breakdown for a cell (query: day, hour)" } },
  )

  // Events for a day, optionally within a [from,to] datetime range, paginated.
  .get(
    "/events",
    ({ query, status }) => {
      if (!query.day) return status(400, { error: "day required (YYYY-MM-DD)" });
      return queryDay(query.day, {
        from: parseTime(query.from),
        to: parseTime(query.to),
        limit: toInt(query.limit),
        offset: toInt(query.offset),
      });
    },
    { detail: { summary: "Events for a day / datetime range (query: day, from, to, limit, offset)" } },
  )

  // All events for a match id, newest first.
  .get(
    "/matches/:id/events",
    ({ params, query }) =>
      searchByMatch(params.id, {
        from: parseTime(query.from),
        to: parseTime(query.to),
        limit: toInt(query.limit),
      }),
    { detail: { summary: "Events for a match id (query: from, to, limit)" } },
  );
