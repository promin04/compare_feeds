import { fetchBetradar, fetchApollo } from "./fetch.ts";
import { compareFeeds, logMismatches } from "./compare.ts";

/** Fetch both feeds and compare their leagues/matches. */
async function main() {
  const signal = AbortSignal.timeout(20_000);
  const [betradar, apollo] = await Promise.all([
    fetchBetradar(signal),
    fetchApollo(signal),
  ]);

  console.log(
    `Fetched: betradar=${betradar.length} leagues, apollo=${apollo.length} leagues`,
  );
  const result = compareFeeds(betradar, apollo);
  logMismatches(result);
  if (result.equal) console.log("✅ no differences");
}

main().catch((err) => {
  console.error("compare failed:", err);
  process.exit(1);
});
