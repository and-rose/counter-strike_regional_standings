import * as fs from "fs/promises";
import path from "path";
import { run } from "../src/model/main";

export default async function setup() {
  const outputDir = path.join(__dirname, "../output/live/2023");
  await fs.rm(outputDir, { recursive: true, force: true });

  const args = {
    regions: ["Americas", "Europe", "Asia"],
    filename: "data/matchdata_sample_20230829.json",
  };

  run(args);
}
