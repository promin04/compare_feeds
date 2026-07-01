/**
 * Compare two live feeds league-by-league.
 *
 * Rule: for a league present in BOTH feeds, the set of matches (`m`) must be
 * identical (compared by match key `k`). Any mismatch is reported both to the
 * console and in the returned result.
 */

/** Minimal shape both feeds satisfy for comparison purposes. */
interface CmpMatch {
  k: number;
  id: string;
  n: { en: { h: string; a: string } };
}
interface CmpLeague {
  k: number;
  nn: { en: string };
  m: CmpMatch[];
}

/** A league that exists in only one feed. */
export interface LeagueOnlyIn {
  side: string;
  leagueKey: number;
  leagueName: string;
  matchCount: number;
}

/** A shared league whose match sets differ. */
export interface MatchDiff {
  leagueKey: number;
  leagueName: string;
  countA: number;
  countB: number;
  /** Match labels present only in feed A. */
  onlyInA: string[];
  /** Match labels present only in feed B. */
  onlyInB: string[];
}

/** Structured result of one comparison run. */
export interface CompareResult {
  equal: boolean;
  leaguesOnlyIn: LeagueOnlyIn[];
  matchDiffs: MatchDiff[];
}

function indexByKey<T extends { k: number }>(items: T[]): Map<number, T> {
  const map = new Map<number, T>();
  for (const item of items) map.set(item.k, item);
  return map;
}

function matchLabel(m: CmpMatch): string {
  return `${m.id} (${m.n.en.h} vs ${m.n.en.a})`;
}

/** Labels identifying which feed is which in results and logs. */
export interface CompareLabels {
  labelA?: string;
  labelB?: string;
}

/**
 * Compares two feeds and returns discrepancies as structured data.
 * Pure — does no logging. `equal` is true when every shared league has an
 * identical match set and no league is missing from either side.
 */
export function compareFeeds(
  betradar: CmpLeague[],
  apollo: CmpLeague[],
  { labelA = "betradar", labelB = "apollo" }: CompareLabels = {},
): CompareResult {
  const aByLeague = indexByKey(betradar);
  const bByLeague = indexByKey(apollo);

  const leaguesOnlyIn: LeagueOnlyIn[] = [];
  const matchDiffs: MatchDiff[] = [];

  // Collect leagues missing from either side.
  for (const [leagueKey, league] of aByLeague) {
    if (!bByLeague.has(leagueKey)) {
      leaguesOnlyIn.push({
        side: labelA,
        leagueKey,
        leagueName: league.nn.en || `league ${leagueKey}`,
        matchCount: league.m.length,
      });
    }
  }
  for (const [leagueKey, league] of bByLeague) {
    if (!aByLeague.has(leagueKey)) {
      leaguesOnlyIn.push({
        side: labelB,
        leagueKey,
        leagueName: league.nn.en || `league ${leagueKey}`,
        matchCount: league.m.length,
      });
    }
  }

  // For shared leagues, compare their match sets.
  for (const [leagueKey, leagueA] of aByLeague) {
    const leagueB = bByLeague.get(leagueKey);
    if (!leagueB) continue; // already reported as missing above

    const aMatches = indexByKey(leagueA.m);
    const bMatches = indexByKey(leagueB.m);

    if (aMatches.size === bMatches.size) {
      // Same count — verify the keys line up too (defensive).
      const sameKeys = [...aMatches.keys()].every((k) => bMatches.has(k));
      if (sameKeys) continue;
    }

    const onlyInA: string[] = [];
    const onlyInB: string[] = [];
    for (const [mk, m] of aMatches) if (!bMatches.has(mk)) onlyInA.push(matchLabel(m));
    for (const [mk, m] of bMatches) if (!aMatches.has(mk)) onlyInB.push(matchLabel(m));

    matchDiffs.push({
      leagueKey,
      leagueName: leagueA.nn.en || `league ${leagueKey}`,
      countA: aMatches.size,
      countB: bMatches.size,
      onlyInA,
      onlyInB,
    });
  }

  const equal = leaguesOnlyIn.length === 0 && matchDiffs.length === 0;
  return { equal, leaguesOnlyIn, matchDiffs };
}

/**
 * Logs a comparison result to the console — but ONLY when it contains
 * discrepancies. Equal results produce no output. A timestamp header is
 * printed so it's clear when the mismatch was observed.
 */
export function logMismatches(
  result: CompareResult,
  { when = new Date(), labelA = "betradar", labelB = "apollo" }: CompareLabels & { when?: Date } = {},
): void {
  if (result.equal) return;

  const time = `${when.toLocaleString("en-GB", { timeZone: "Asia/Bangkok" })} (${when.toISOString()})`;
  console.log(`\n⚠️  Feed mismatch at ${time}`);

  for (const l of result.leaguesOnlyIn) {
    console.log(
      `   League "${l.leagueName}" (k=${l.leagueKey}) only in ${l.side} (${l.matchCount} matches)`,
    );
  }

  for (const d of result.matchDiffs) {
    console.log(
      `   League "${d.leagueName}" (k=${d.leagueKey}): match count differs — ` +
        `${labelA}=${d.countA}, ${labelB}=${d.countB}`,
    );
    for (const label of d.onlyInA) console.log(`      • only in ${labelA}: ${label}`);
    for (const label of d.onlyInB) console.log(`      • only in ${labelB}: ${label}`);
  }
}
