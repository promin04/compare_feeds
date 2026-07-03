import { fetchBetradar, fetchSportbookV2 } from "./fetch.ts";
import { compareFeeds, logMismatches } from "./compare.ts";

/** Fetch both feeds and compare their leagues/matches. */
async function main() {
  const signal = AbortSignal.timeout(20_000);
  const [betradar, sportbookV2] = await Promise.all([
    fetchBetradar(signal),
    fetchSportbookV2(signal),
  ]);

  console.log(
    `Fetched: betradar=${betradar.length} leagues, sportbookV2=${sportbookV2.length} leagues`,
  );
  const result = compareFeeds(betradar, sportbookV2);
  logMismatches(result);
  if (result.equal) console.log("✅ no differences");
}

main().catch((err) => {
  console.error("compare failed:", err);
  process.exit(1);
});
