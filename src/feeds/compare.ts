/**
 * Compare two live feeds league-by-league.
 *
 * Rule: for a league present in BOTH feeds, the set of matches (`m`) must be
 * identical (compared by match key `k`). Any mismatch is reported.
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

function indexByKey<T extends { k: number }>(items: T[]): Map<number, T> {
  const map = new Map<number, T>();
  for (const item of items) map.set(item.k, item);
  return map;
}

function matchLabel(m: CmpMatch): string {
  return `${m.id} (${m.n.en.h} vs ${m.n.en.a})`;
}

/**
 * Logs, per shared league, any matches that exist in only one feed.
 * Returns true when every shared league has an identical match set.
 */
export function compareFeeds(
  betradar: CmpLeague[],
  apollo: CmpLeague[],
  { labelA = "betradar", labelB = "apollo" } = {},
): boolean {
  const aByLeague = indexByKey(betradar);
  const bByLeague = indexByKey(apollo);

  let allEqual = true;

  // Report leagues missing from either side.
  for (const [leagueKey, league] of aByLeague) {
    if (!bByLeague.has(leagueKey)) {
      allEqual = false;
      console.log(
        `\n⚠️  League "${league.nn.en || `league ${leagueKey}`}" ` +
          `(k=${leagueKey}) only in ${labelA} (${league.m.length} matches)`,
      );
    }
  }
  for (const [leagueKey, league] of bByLeague) {
    if (!aByLeague.has(leagueKey)) {
      allEqual = false;
      console.log(
        `\n⚠️  League "${league.nn.en || `league ${leagueKey}`}" ` +
          `(k=${leagueKey}) only in ${labelB} (${league.m.length} matches)`,
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

    allEqual = false;
    const name = leagueA.nn.en || `league ${leagueKey}`;
    console.log(
      `\n⚠️  League "${name}" (k=${leagueKey}): match count differs — ` +
        `${labelA}=${aMatches.size}, ${labelB}=${bMatches.size}`,
    );

    for (const [mk, m] of aMatches) {
      if (!bMatches.has(mk)) {
        console.log(`   • only in ${labelA}: ${matchLabel(m)}`);
      }
    }
    for (const [mk, m] of bMatches) {
      if (!aMatches.has(mk)) {
        console.log(`   • only in ${labelB}: ${matchLabel(m)}`);
      }
    }
  }

  if (allEqual) {
    console.log("✅ Every shared league has an identical match set");
  }
  return allEqual;
}
