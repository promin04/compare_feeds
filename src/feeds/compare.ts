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

/**
 * Compares two feeds, logging discrepancies to the console and returning them
 * as structured data. `equal` is true when every shared league has an
 * identical match set and no league is missing from either side.
 */
export function compareFeeds(
  betradar: CmpLeague[],
  apollo: CmpLeague[],
  { labelA = "betradar", labelB = "apollo" } = {},
): CompareResult {
  const aByLeague = indexByKey(betradar);
  const bByLeague = indexByKey(apollo);

  const leaguesOnlyIn: LeagueOnlyIn[] = [];
  const matchDiffs: MatchDiff[] = [];

  // Report leagues missing from either side.
  for (const [leagueKey, league] of aByLeague) {
    if (!bByLeague.has(leagueKey)) {
      const leagueName = league.nn.en || `league ${leagueKey}`;
      leaguesOnlyIn.push({ side: labelA, leagueKey, leagueName, matchCount: league.m.length });
      console.log(
        `\n⚠️  League "${leagueName}" (k=${leagueKey}) only in ${labelA} ` +
          `(${league.m.length} matches)`,
      );
    }
  }
  for (const [leagueKey, league] of bByLeague) {
    if (!aByLeague.has(leagueKey)) {
      const leagueName = league.nn.en || `league ${leagueKey}`;
      leaguesOnlyIn.push({ side: labelB, leagueKey, leagueName, matchCount: league.m.length });
      console.log(
        `\n⚠️  League "${leagueName}" (k=${leagueKey}) only in ${labelB} ` +
          `(${league.m.length} matches)`,
      );
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

    const leagueName = leagueA.nn.en || `league ${leagueKey}`;
    const onlyInA: string[] = [];
    const onlyInB: string[] = [];
    for (const [mk, m] of aMatches) if (!bMatches.has(mk)) onlyInA.push(matchLabel(m));
    for (const [mk, m] of bMatches) if (!aMatches.has(mk)) onlyInB.push(matchLabel(m));

    matchDiffs.push({
      leagueKey,
      leagueName,
      countA: aMatches.size,
      countB: bMatches.size,
      onlyInA,
      onlyInB,
    });

    console.log(
      `\n⚠️  League "${leagueName}" (k=${leagueKey}): match count differs — ` +
        `${labelA}=${aMatches.size}, ${labelB}=${bMatches.size}`,
    );
    for (const label of onlyInA) console.log(`   • only in ${labelA}: ${label}`);
    for (const label of onlyInB) console.log(`   • only in ${labelB}: ${label}`);
  }

  const equal = leaguesOnlyIn.length === 0 && matchDiffs.length === 0;
  if (equal) {
    console.log("✅ Every shared league has an identical match set");
  }
  return { equal, leaguesOnlyIn, matchDiffs };
}
