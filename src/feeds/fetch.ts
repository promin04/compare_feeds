import type { BetradarLiveFeed } from "./betradar.ts";
import type { SportbookV2LiveResponse, SportbookV2LiveFeed } from "./sportbookV2.ts";

const BETRADAR_URL =
  "https://odd-betconstruct-api.secure-restapi.com/betradar/prod/live";
const SPORTBOOK_V2_URL =
  "https://apollo-alert-production.up.railway.app/robot/feeds/live";

/** Fetch the Betradar live feed (top-level League[]). */
export async function fetchBetradar(
  signal?: AbortSignal,
): Promise<BetradarLiveFeed> {
  const res = await fetch(BETRADAR_URL, { signal });
  if (!res.ok) throw new Error(`Betradar feed: HTTP ${res.status}`);
  return (await res.json()) as BetradarLiveFeed;
}

/** Fetch the SportbookV2 live feed and unwrap the League[] from `data`. */
export async function fetchSportbookV2(
  signal?: AbortSignal,
): Promise<SportbookV2LiveFeed> {
  const res = await fetch(SPORTBOOK_V2_URL, { signal });
  if (!res.ok) throw new Error(`SportbookV2 feed: HTTP ${res.status}`);
  const body = (await res.json()) as SportbookV2LiveResponse;
  return body.data;
}
