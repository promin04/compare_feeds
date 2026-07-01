import type { BetradarLiveFeed } from "./betradar.ts";
import type { ApolloLiveResponse, ApolloLiveFeed } from "./apollo.ts";

const BETRADAR_URL =
  "https://odd-betconstruct-api.secure-restapi.com/betradar/prod/live";
const APOLLO_URL =
  "https://apollo-alert-production.up.railway.app/robot/feeds/live";

/** Fetch the Betradar live feed (top-level League[]). */
export async function fetchBetradar(
  signal?: AbortSignal,
): Promise<BetradarLiveFeed> {
  const res = await fetch(BETRADAR_URL, { signal });
  if (!res.ok) throw new Error(`Betradar feed: HTTP ${res.status}`);
  return (await res.json()) as BetradarLiveFeed;
}

/** Fetch the Apollo live feed and unwrap the League[] from `data`. */
export async function fetchApollo(
  signal?: AbortSignal,
): Promise<ApolloLiveFeed> {
  const res = await fetch(APOLLO_URL, { signal });
  if (!res.ok) throw new Error(`Apollo feed: HTTP ${res.status}`);
  const body = (await res.json()) as ApolloLiveResponse;
  return body.data;
}
