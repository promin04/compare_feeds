/**
 * Compare two live feeds league-by-league.
 *
 * Rule: for a league present in BOTH feeds, the set of matches (`m`) must be
 * identical (compared by match key `k`). Any mismatch is reported both to the
 * console and in the returned result.
 */

/**
 * A price block: market name → market fields (e.g. { ah: {...}, ou: {...} }).
 * Values are kept as `unknown` since we only compare which markets are present,
 * not their contents.
 */
type PriceBlock = Record<string, unknown>;

/** Minimal shape both feeds satisfy for comparison purposes. */
interface CmpMatch {
  k: number;
  id: string;
  n: { en: { h: string; a: string } };
  bpl?: PriceBlock[];
}
interface CmpLeague {
  k: number;
  nn: { en: string };
  m: CmpMatch[];
}

/** A league present in betradar (A) but missing from sportbookV2 (B). */
export interface LeagueOnlyIn {
  leagueKey: number;
  leagueName: string;
  matchCount: number;
}

/** A shared league that has matches in betradar (A) missing from sportbookV2 (B). */
export interface MatchDiff {
  leagueKey: number;
  leagueName: string;
  countA: number;
  countB: number;
  /** Match labels present in betradar (A) but missing from sportbookV2 (B). */
  onlyInA: string[];
}

/**
 * A shared match (same id in both feeds) whose `bpl` markets differ.
 * Both arrays are aligned by bpl index: entry `i` describes index `i` of the
 * block. A `null` entry means no markets are missing at that index.
 */
export interface MarketDiff {
  leagueKey: number;
  leagueName: string;
  matchId: string;
  matchLabel: string;
  /** Per index: markets present in betradar (A) but missing from sportbookV2 (B) (null = none). */
  missingInB: (PriceBlock | null)[];
  /** SportbookV2's (B) full bpl for this match, for context when inspecting the diff. */
  sportbookV2Bpl: PriceBlock[];
}

/** Structured result of one comparison run. */
export interface CompareResult {
  equal: boolean;
  leaguesOnlyIn: LeagueOnlyIn[];
  matchDiffs: MatchDiff[];
  marketDiffs: MarketDiff[];
}

function indexByKey<T extends { k: number }>(items: T[]): Map<number, T> {
  const map = new Map<number, T>();
  for (const item of items) map.set(item.k, item);
  return map;
}

function matchLabel(m: CmpMatch): string {
  return `${m.id} (${m.n.en.h} vs ${m.n.en.a})`;
}

/**
 * Compares two `bpl` arrays index-by-index and reports, per index, which
 * markets exist in betradar (A) but are missing from sportbookV2 (B). Returns an
 * array aligned by index (null where nothing is missing), e.g. betradar
 * `[{x12},{x12,ou}]` vs sportbookV2 `[{x12},{x12}]` yields `[null, {ou:{...}}]`.
 */
function diffMarketsByIndex(a: PriceBlock[], b: PriceBlock[]) {
  const missingInB: (PriceBlock | null)[] = [];
  let hasDiff = false;

  for (let i = 0; i < a.length; i++) {
    const ai = a[i] ?? {};
    const bi = b[i] ?? {};

    const inB: PriceBlock = {};
    for (const market of Object.keys(ai)) if (!(market in bi)) inB[market] = ai[market]!;

    const bMiss = Object.keys(inB).length ? inB : null;
    if (bMiss) hasDiff = true;
    missingInB.push(bMiss);
  }

  return { missingInB, hasDiff };
}

/** Labels identifying which feed is which in results and logs. */
export interface CompareLabels {
  labelA?: string;
  labelB?: string;
}

/**
 * Compares two feeds and returns discrepancies as structured data.
 * Pure — does no logging. Reports only what betradar (A) has that sportbookV2 (B)
 * lacks: leagues, matches, and per-match markets. `equal` is true when sportbookV2
 * is not missing anything betradar has.
 */
export function compareFeeds(
  betradar: CmpLeague[],
  sportbookV2: CmpLeague[],
): CompareResult {
  const aByLeague = indexByKey(betradar);
  const bByLeague = indexByKey(sportbookV2);

  const leaguesOnlyIn: LeagueOnlyIn[] = [];
  const matchDiffs: MatchDiff[] = [];
  const marketDiffs: MarketDiff[] = [];

  // Collect leagues present in betradar (A) but missing from sportbookV2 (B).
  for (const [leagueKey, league] of aByLeague) {
    if (!bByLeague.has(leagueKey)) {
      leaguesOnlyIn.push({
        leagueKey,
        leagueName: league.nn.en || `league ${leagueKey}`,
        matchCount: league.m.length,
      });
    }
  }

  // For shared leagues, compare match sets and — for shared matches — markets.
  for (const [leagueKey, leagueA] of aByLeague) {
    const leagueB = bByLeague.get(leagueKey);
    if (!leagueB) continue; // already reported as missing above

    const leagueName = leagueA.nn.en || `league ${leagueKey}`;
    const aMatches = indexByKey(leagueA.m);
    const bMatches = indexByKey(leagueB.m);

    // Matches present in betradar (A) but missing from sportbookV2 (B).
    const onlyInA: string[] = [];
    for (const [mk, m] of aMatches) if (!bMatches.has(mk)) onlyInA.push(matchLabel(m));
    if (onlyInA.length > 0) {
      matchDiffs.push({
        leagueKey,
        leagueName,
        countA: aMatches.size,
        countB: bMatches.size,
        onlyInA,
      });
    }

    // For matches present in BOTH feeds, compare their markets index-by-index.
    for (const [mk, ma] of aMatches) {
      const mb = bMatches.get(mk);
      if (!mb) continue;
      const sportbookV2Bpl = mb.bpl ?? [];
      const { missingInB, hasDiff } = diffMarketsByIndex(ma.bpl ?? [], sportbookV2Bpl);
      if (hasDiff) {
        marketDiffs.push({
          leagueKey,
          leagueName,
          matchId: ma.id,
          matchLabel: matchLabel(ma),
          missingInB,
          sportbookV2Bpl,
        });
      }
    }
  }

  const equal =
    leaguesOnlyIn.length === 0 && matchDiffs.length === 0 && marketDiffs.length === 0;
  return { equal, leaguesOnlyIn, matchDiffs, marketDiffs };
}

/**
 * Logs a comparison result to the console — but ONLY when it contains
 * discrepancies. Equal results produce no output. A timestamp header is
 * printed so it's clear when the mismatch was observed.
 */
export function logMismatches(
  result: CompareResult,
  { when = new Date(), labelA = "betradar", labelB = "sportbookV2" }: CompareLabels & { when?: Date } = {},
): void {
  if (result.equal) return;

  const time = `${when.toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })} (${when.toISOString()})`;
  console.log(`\n⚠️  ${labelB} is missing data that ${labelA} has — at ${time}`);

  for (const l of result.leaguesOnlyIn) {
    console.log(
      `   League "${l.leagueName}" (k=${l.leagueKey}) missing in ${labelB} (${l.matchCount} matches)`,
    );
  }

  for (const d of result.matchDiffs) {
    console.log(`   League "${d.leagueName}" (k=${d.leagueKey}): matches missing in ${labelB}`);
    for (const label of d.onlyInA) console.log(`      • ${label}`);
  }

  for (const d of result.marketDiffs) {
    console.log(`   Match ${d.matchLabel}: markets missing in ${labelB}`);
    d.missingInB.forEach((block, i) => {
      if (block) {
        console.log(`      • bpl[${i}] missing: [${Object.keys(block).join(", ")}]`);
        console.log(`        ${labelB} bpl[${i}] = ${JSON.stringify(d.sportbookV2Bpl[i] ?? null)}`);
      }
    });
  }
}
