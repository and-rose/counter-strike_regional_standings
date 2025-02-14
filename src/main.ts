import { ArgsSchema } from "./applicationConfig";
import Ranking from "./model/ranking";
import Report from "./model/report";

function run() {
  const rawArgs = {
    regions: process.argv[2],
    filename: process.argv[3],
    date: process.argv[4],
  };

  const parsedArgs = ArgsSchema.safeParse(rawArgs);

  if (!parsedArgs.success) {
    console.error("Invalid arguments:", parsedArgs.error.format());
    process.exit(1);
  }

  let { regions, filename, date } = parsedArgs.data;

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

run();
