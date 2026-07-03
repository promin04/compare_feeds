/**
 * Types for the SportbookV2 live football feed.
 *
 * Source: GET https://apollo-alert-production.up.railway.app/robot/feeds/live
 * Response: { statusCode, message, data: League[] } — the feed lives in `data`.
 *
 * Structurally close to the Betradar feed but with a few differences:
 *  - wrapped in a { statusCode, message, data } envelope
 *  - League carries `isSpecial` instead of Betradar's `fid`/`cnt`
 *  - Match adds `hasParlay`, `isSpecial`, `md5`, `liveTv2`; drops `pvd`, `msp`
 *  - Match names carry no team ids (just localised names)
 *  - MatchInfo adds `rowID`
 *  - markets have no `spd`/`pd` flags
 *  - date/time fields use a +07:00 offset (not UTC "Z")
 *
 * All odds/score values arrive as strings.
 */

import type { Localized, LocalizedHomeAway } from "./common.ts";

export type { Localized, HomeAway, LocalizedHomeAway } from "./common.ts";

/** Live match info / in-play state. */
export interface MatchInfo {
  /** Live time label, e.g. "1H 16" (first half, minute 16). */
  lt: string;
  /** Match time in minutes (as string), e.g. "15". */
  mt: string;
  /** Period label (empty when not applicable). */
  pl: string;
  /** Home score. */
  h: string;
  /** Away score. */
  a: string;
  /** Extra status text (empty when none). */
  s: string;
  /** Home red cards. */
  hrc: string;
  /** Away red cards. */
  arc: string;
  isHalfTime: boolean;
  /** Row identifier (empty when none). */
  rowID: string;
  /** Penalty shootout in progress. */
  isPE: boolean;
  /** Extra time in progress. */
  isET: boolean;
}

/**
 * Over/Under (totals) market.
 * `o*` fields describe the "over" side, `u*` the "under" side.
 */
export interface OverUnderMarket {
  /** Over line, e.g. "2.5". */
  o: string;
  /** Over key, e.g. "ok". */
  ok: string;
  /** Over price key, e.g. "o2.5". */
  opk: string;
  /** Over price/odds. */
  op: string;
  /** Under line, e.g. "2.5". */
  u: string;
  /** Under key, e.g. "uk". */
  uk: string;
  /** Under price key, e.g. "u2.5". */
  upk: string;
  /** Under price/odds. */
  up: string;
  /** Market id, e.g. "18". */
  mkid: string;
  /** Specifier, e.g. "total=2.5". */
  sp: string;
  /** Over outcome code. */
  oco: string;
  /** Under outcome code. */
  ocu: string;
}

/**
 * Asian Handicap market.
 * `h*` fields describe the home side, `a*` the away side.
 */
export interface AsianHandicapMarket {
  /** Home handicap line, e.g. "0.5". */
  h: string;
  /** Home key, e.g. "hk". */
  hk: string;
  /** Home price key, e.g. "h0.5". */
  hpk: string;
  /** Home price/odds. */
  hp: string;
  /** Away handicap line, e.g. "-0.5". */
  a: string;
  /** Away key, e.g. "ak". */
  ak: string;
  /** Away price key, e.g. "a-0.5". */
  apk: string;
  /** Away price/odds. */
  ap: string;
  /** Market id, e.g. "16". */
  mkid: string;
  /** Specifier, e.g. "hcp=0.5". */
  sp: string;
  /** Home outcome code. */
  och: string;
  /** Away outcome code. */
  oca: string;
}

/**
 * A block of prices/lines for a match, keyed by market name. Any market may be
 * absent (e.g. first-half markets are only present in some blocks). The feed
 * may also carry other markets (e.g. "x12") beyond the documented ones, hence
 * the index signature.
 */
export interface PriceBlock {
  /** Full-time Over/Under. */
  ou?: OverUnderMarket;
  /** First-half Over/Under. */
  ou1st?: OverUnderMarket;
  /** Full-time Asian Handicap. */
  ah?: AsianHandicapMarket;
  /** First-half Asian Handicap. */
  ah1st?: AsianHandicapMarket;
  /** Any other market, keyed by name. */
  [market: string]: OverUnderMarket | AsianHandicapMarket | undefined;
}

/** A single football match within a league. */
export interface Match {
  /** Match key (numeric id). */
  k: number;
  /** Composite id "<leagueKey>:<matchKey>". */
  id: string;
  /** Kick-off date/time (ISO 8601 with +07:00 offset). */
  d: string;
  /** Odds/open date/time (ISO 8601 with +07:00 offset). */
  od: string;
  /** Whether this match is a tip. */
  tip: boolean;
  isChannel: boolean;
  /** Whether parlay betting is available. */
  hasParlay: boolean;
  /** Whether this is a special match. */
  isSpecial: boolean;
  /** Localised team names (no team ids in this feed). */
  n: LocalizedHomeAway;
  /** Content hash (empty when none). */
  md5: string;
  /** Live TV URL (empty when none). */
  liveTv: string;
  /** Secondary live TV URL (empty when none). */
  liveTv2: string;
  /** Statistics widget URL. */
  st: string;
  /** Betradar TV / statistics URL. */
  betRadarTV: string;
  /** Live match info / in-play state. */
  i: MatchInfo;
  /** Betting price blocks. */
  bpl: PriceBlock[];
}

/** A football league with its matches. */
export interface League {
  /** League key (numeric id). */
  k: number;
  /** Whether this is a special league. */
  isSpecial: boolean;
  /** Localised league name. */
  nn: Localized;
  /** Matches in this league. */
  m: Match[];
  /** Market/status flag. */
  ms: number;
}

/** The response envelope wrapping the league list. */
export interface SportbookV2LiveResponse {
  statusCode: number;
  message: string;
  /** The feed itself lives here. */
  data: League[];
}

/** Convenience alias for the league list carried in `data`. */
export type SportbookV2LiveFeed = League[];
