/**
 * Types for the BetConstruct / Betradar live football feed.
 *
 * Source: GET https://odd-betconstruct-api.secure-restapi.com/betradar/prod/live
 * Response: League[]
 *
 * Field names in the wire format are terse abbreviations; JSDoc documents the
 * meaning of each. All odds/score values arrive as strings.
 */

import type { Localized, LocalizedHomeAway } from "./common.ts";

export type { Localized, HomeAway, LocalizedHomeAway } from "./common.ts";

/** Live match info / in-play state. */
export interface MatchInfo {
  /** Match time in minutes (as string), e.g. "11". */
  mt: string;
  /** Live time label, e.g. "1H 11" (first half, minute 11). */
  lt: string;
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
  /** Penalty shootout in progress. */
  isPE: boolean;
  /** Extra time in progress. */
  isET: boolean;
}

/** Team identifiers and localised names for a match. */
export interface MatchNames extends LocalizedHomeAway {
  /** Home team id. */
  hid: number;
  /** Away team id. */
  aid: number;
  /** Feed away team id (0 when unmapped). */
  faid: number;
  /** Feed home team id (0 when unmapped). */
  fhid: number;
}

/**
 * Over/Under (totals) market.
 * `o*` fields describe the "over" side, `u*` the "under" side.
 */
export interface OverUnderMarket {
  /** Over line, e.g. "2.5". */
  o: string;
  /** Over price/odds. */
  op: string;
  /** Under line, e.g. "2.5". */
  u: string;
  /** Under price/odds. */
  up: string;
  /** Over price key, e.g. "o2.5". */
  opk: string;
  /** Over key, e.g. "ok". */
  ok: string;
  /** Under price key, e.g. "u2.5". */
  upk: string;
  /** Under key, e.g. "uk". */
  uk: string;
  /** Suspended / price down flag. */
  spd: boolean;
  /** Over outcome code. */
  oco: string;
  /** Under outcome code. */
  ocu: string;
  /** Market id, e.g. "18". */
  mkid: string;
  /** Specifier, e.g. "total=2.5". */
  sp: string;
}

/**
 * Asian Handicap market.
 * `h*` fields describe the home side, `a*` the away side.
 */
export interface AsianHandicapMarket {
  /** Home handicap line, e.g. "0.5/1". */
  h: string;
  /** Home price/odds. */
  hp: string;
  /** Away handicap line, e.g. "-0.5/1". */
  a: string;
  /** Away price/odds. */
  ap: string;
  /** Home price key, e.g. "h0.5/1". */
  hpk: string;
  /** Home key, e.g. "hk". */
  hk: string;
  /** Away price key, e.g. "a-0.5/1". */
  apk: string;
  /** Away key, e.g. "ak". */
  ak: string;
  /** Suspended / price down flag. */
  spd: boolean;
  /** Home outcome code. */
  och: string;
  /** Away outcome code. */
  oca: string;
  /** Market id, e.g. "16". */
  mkid: string;
  /** Specifier, e.g. "hcp=0.75". */
  sp: string;
  /** Price/point delta (present on some entries). */
  pd?: number;
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
  /** Kick-off date/time (ISO 8601, UTC). */
  d: string;
  /** Odds/open date/time (ISO 8601, UTC). */
  od: string;
  /** Provider code, e.g. "ibc". */
  pvd: string;
  /** Whether this match is a tip. */
  tip: boolean;
  isChannel: boolean;
  /** Live match info / in-play state. */
  i: MatchInfo;
  /** Team ids and localised names. */
  n: MatchNames;
  /** Betradar TV / statistics URL. */
  betRadarTV: string;
  /** Statistics widget URL. */
  st: string;
  /** Live TV URL (empty when none). */
  liveTv: string;
  /** Market/status flag. */
  msp: number;
  /** Betting price blocks. */
  bpl: PriceBlock[];
}

/** A football league with its matches. */
export interface League {
  /** League key (numeric id). */
  k: number;
  /** Feed id (0 when unmapped). */
  fid: number;
  /** Localised league name. */
  nn: Localized;
  /** Country code, e.g. "ARG". */
  cnt: string;
  /** Matches in this league. */
  m: Match[];
  /** Market/status flag. */
  ms: number;
}

/** Top-level response: an array of leagues. */
export type BetradarLiveFeed = League[];
