import { redis } from "../redis.ts";
import { config } from "../config.ts";
import type { CompareResult } from "../feeds/compare.ts";

/**
 * Redis-backed storage for mismatch events, with:
 *  - two heatmaps (last N days × 24 hours): distinct problem-matches, and
 *    count of markets sportbookV2 is missing
 *  - per-day, time-ordered event index for datetime-range queries
 *  - per-match index for search-by-match-id
 *
 * Key schema (prefix `cf:`, all keys TTL = retentionDays):
 *   cf:evt:{id}                 String(JSON)  one event's detail
 *   cf:events:{day}             ZSET          member=id, score=ts  (day time index)
 *   cf:match:{matchId}          ZSET          member=id, score=ts  (per-match index)
 *   cf:heatmap:{day}            Hash          field=hh → distinct problem-match count
 *   cf:hmseen:{day}:{hh}        SET           matchIds seen (dedup helper for heatmap)
 *   cf:heatmap:mkt:{day}        Hash          field=hh → count of missing markets
 *   cf:heatmap:mkt:{day}:{hh}   Hash          field=marketName → count (breakdown)
 */

export type EventType = "league_missing" | "match_missing" | "market_diff";

export interface StoredEvent {
  id: string;
  ts: number;
  time: string;
  type: EventType;
  leagueKey: number;
  leagueName: string;
  matchId?: string;
  matchLabel?: string;
  /** league_missing */
  matchCount?: number;
  /** market_diff: markets sportbookV2 lacks, per bpl index */
  missing?: { index: number; markets: string[] }[];
  /** market_diff: full bpl of each side, aligned by index */
  betradarBpl?: unknown[];
  sportbookV2Bpl?: unknown[];
}

export interface HeatmapDay {
  day: string;
  /** hour ("00".."23") → intensity */
  buckets: Record<string, number>;
}

const retentionSec = config.retentionDays * 86_400;
const retentionMs = retentionSec * 1_000;

/** Whether persistence is active (Redis configured). */
export const storageEnabled = redis !== null;

// --- time bucketing (in the configured timezone) --------------------------

const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: config.timezone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
});

/** Local day ("YYYY-MM-DD") and hour ("00".."23") for a timestamp. */
function localParts(ts: number): { day: string; hour: string } {
  const parts = partsFmt.formatToParts(ts);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = get("hour");
  if (hour === "24") hour = "00"; // some runtimes emit "24" at midnight
  return { day: `${get("year")}-${get("month")}-${get("day")}`, hour };
}

/** The last `n` local day strings, newest first. */
function recentDays(n: number, now: number): string[] {
  const days: string[] = [];
  for (let i = 0; i < n; i++) days.push(localParts(now - i * 86_400_000).day);
  return days;
}

// --- turning a CompareResult into events ----------------------------------

function buildEvents(result: CompareResult, ts: number, time: string): StoredEvent[] {
  const events: StoredEvent[] = [];
  let seq = 0;
  const id = () => `${ts}-${seq++}`;

  for (const l of result.leaguesOnlyIn) {
    events.push({
      id: id(),
      ts,
      time,
      type: "league_missing",
      leagueKey: l.leagueKey,
      leagueName: l.leagueName,
      matchCount: l.matchCount,
    });
  }

  for (const d of result.matchDiffs) {
    for (const m of d.onlyInA) {
      events.push({
        id: id(),
        ts,
        time,
        type: "match_missing",
        leagueKey: d.leagueKey,
        leagueName: d.leagueName,
        matchId: m.matchId,
        matchLabel: m.matchLabel,
      });
    }
  }

  for (const d of result.marketDiffs) {
    const missing = d.missingInB
      .map((block, index) => ({ index, markets: block ? Object.keys(block) : [] }))
      .filter((e) => e.markets.length > 0);
    events.push({
      id: id(),
      ts,
      time,
      type: "market_diff",
      leagueKey: d.leagueKey,
      leagueName: d.leagueName,
      matchId: d.matchId,
      matchLabel: d.matchLabel,
      missing,
      betradarBpl: d.betradarBpl,
      sportbookV2Bpl: d.sportbookV2Bpl,
    });
  }

  return events;
}

// --- write path -----------------------------------------------------------

/**
 * Persists all mismatch events from a compare run and updates both heatmaps.
 * No-op when Redis is not configured or the run had no mismatches.
 */
export async function recordResult(result: CompareResult, ts = Date.now()): Promise<void> {
  const r = redis;
  if (!r || result.equal) return;

  const time = new Date(ts).toISOString();
  const { day, hour } = localParts(ts);
  const events = buildEvents(result, ts, time);
  if (events.length === 0) return;

  for (const evt of events) {
    await r.set(`cf:evt:${evt.id}`, JSON.stringify(evt), "EX", retentionSec);

    await r.zadd(`cf:events:${day}`, evt.ts, evt.id);
    await r.expire(`cf:events:${day}`, retentionSec);

    if (evt.matchId) {
      const mkey = `cf:match:${evt.matchId}`;
      await r.zadd(mkey, evt.ts, evt.id);
      await r.expire(mkey, retentionSec);
      await r.zremrangebyscore(mkey, "-inf", ts - retentionMs);

      // Heatmap #1 — distinct problem-matches per hour (dedup via SET).
      const seenKey = `cf:hmseen:${day}:${hour}`;
      const added = await r.sadd(seenKey, evt.matchId);
      await r.expire(seenKey, retentionSec);
      if (added === 1) {
        await r.hincrby(`cf:heatmap:${day}`, hour, 1);
        await r.expire(`cf:heatmap:${day}`, retentionSec);
      }
    }

    // Heatmap #2 — count of markets sportbookV2 is missing per hour.
    if (evt.type === "market_diff" && evt.missing) {
      const markets = evt.missing.flatMap((m) => m.markets);
      if (markets.length > 0) {
        await r.hincrby(`cf:heatmap:mkt:${day}`, hour, markets.length);
        await r.expire(`cf:heatmap:mkt:${day}`, retentionSec);
        const breakdownKey = `cf:heatmap:mkt:${day}:${hour}`;
        for (const name of markets) await r.hincrby(breakdownKey, name, 1);
        await r.expire(breakdownKey, retentionSec);
      }
    }
  }
}

// --- read paths -----------------------------------------------------------

async function readHeatmap(keyFor: (day: string) => string, days: number): Promise<HeatmapDay[]> {
  const r = redis;
  if (!r) return [];
  const out: HeatmapDay[] = [];
  for (const day of recentDays(days, Date.now())) {
    const raw = await r.hgetall(keyFor(day));
    const buckets: Record<string, number> = {};
    for (const [hour, count] of Object.entries(raw)) buckets[hour] = Number(count);
    out.push({ day, buckets });
  }
  return out;
}

/** Heatmap of distinct problem-matches per hour, newest day first. */
export function getMatchHeatmap(days = config.heatmapDays): Promise<HeatmapDay[]> {
  return readHeatmap((day) => `cf:heatmap:${day}`, days);
}

/** Heatmap of missing-market counts per hour, newest day first. */
export function getMarketHeatmap(days = config.heatmapDays): Promise<HeatmapDay[]> {
  return readHeatmap((day) => `cf:heatmap:mkt:${day}`, days);
}

/** Per-market-name breakdown for one heatmap cell (market heatmap). */
export async function getMarketBreakdown(day: string, hour: string): Promise<Record<string, number>> {
  const r = redis;
  if (!r) return {};
  const raw = await r.hgetall(`cf:heatmap:mkt:${day}:${hour}`);
  const out: Record<string, number> = {};
  for (const [name, count] of Object.entries(raw)) out[name] = Number(count);
  return out;
}

async function loadEvents(ids: string[]): Promise<StoredEvent[]> {
  const r = redis;
  if (!r || ids.length === 0) return [];
  const blobs = await r.mget(...ids.map((id) => `cf:evt:${id}`));
  return blobs
    .filter((b): b is string => b !== null)
    .map((b) => JSON.parse(b) as StoredEvent);
}

/**
 * Events for a local day, optionally filtered to a [from, to] epoch-ms window,
 * ordered oldest→newest. Supports pagination via limit/offset.
 */
export async function queryDay(
  day: string,
  opts: { from?: number; to?: number; limit?: number; offset?: number } = {},
): Promise<StoredEvent[]> {
  const r = redis;
  if (!r) return [];
  const min = opts.from ?? "-inf";
  const max = opts.to ?? "+inf";
  const ids =
    opts.limit != null
      ? await r.zrangebyscore(`cf:events:${day}`, min, max, "LIMIT", opts.offset ?? 0, opts.limit)
      : await r.zrangebyscore(`cf:events:${day}`, min, max);
  return loadEvents(ids);
}

/**
 * Events for a single match id, newest first, optionally within a time window.
 */
export async function searchByMatch(
  matchId: string,
  opts: { from?: number; to?: number; limit?: number } = {},
): Promise<StoredEvent[]> {
  const r = redis;
  if (!r) return [];
  const max = opts.to ?? "+inf";
  const min = opts.from ?? "-inf";
  const ids =
    opts.limit != null
      ? await r.zrevrangebyscore(`cf:match:${matchId}`, max, min, "LIMIT", 0, opts.limit)
      : await r.zrevrangebyscore(`cf:match:${matchId}`, max, min);
  return loadEvents(ids);
}
