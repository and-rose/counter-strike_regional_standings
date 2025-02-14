import { Args } from "../applicationConfig";
import Ranking from "./ranking";
import Report from "./report";

export function run(args: Args) {
  let { regions, filename, date } = args;

  // Parse matches and generate standings
  const { matches, teams } = Ranking.generateRanking(-1, filename);

  // Get date of most recent match if not provided
  if (!date) {
    const mostRecentMatch = Math.max(...matches.map((m) => m.matchStartTime));
    const d = new Date(0);
    d.setUTCSeconds(mostRecentMatch);
    date = d.toLocaleString("fr-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: "America/Los_Angeles",
    });
  }

  // Get the region we are doing standings for
  let standings = "Standings";
  if (regions.length === 1) {
    standings = `Regional Standings for ${regions[0]}`;
  }

  // Print markdown table for results
  Report.generateOutput(teams, date);

  console.log("Standings generated successfully! 🎉");
  console.log(
    `Output(s) saved to 'live/standings_[region]_${date.replace("-", "_")}.md'`,
  );
}
