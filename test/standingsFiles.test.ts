import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { run } from "../src/main";

describe("Markdown file snapshot test", () => {
  beforeAll(() => {
    // trigger the script
    // pnpm start '["Americas", "Europe", "Asia"]' "data/matchdata_sample_20230829.json"

    // purge the output directory
    const outputDir = path.resolve(__dirname, "../output/live/2023");
    fs.rmdirSync(outputDir, { recursive: true });

    const args = [
      JSON.stringify(["Americas", "Europe", "Asia"]),
      "data/matchdata_sample_20230829.json",
    ];

    run(args);
  });

  it("produces expected global standings file", () => {
    const filePath = path.resolve(
      __dirname,
      "../output/live/2023/standings_global_2023_08_29.md",
    );
    const fileContent = fs.readFileSync(filePath, "utf-8");

    expect(fileContent).toMatchSnapshot();
  });

  it("produces expected americas standings file", () => {
    const filePath = path.resolve(
      __dirname,
      "../output/live/2023/standings_americas_2023_08_29.md",
    );
    const fileContent = fs.readFileSync(filePath, "utf-8");

    expect(fileContent).toMatchSnapshot();
  });

  it("produces expected europe standings file", () => {
    const filePath = path.resolve(
      __dirname,
      "../output/live/2023/standings_europe_2023_08_29.md",
    );
    const fileContent = fs.readFileSync(filePath, "utf-8");

    expect(fileContent).toMatchSnapshot();
  });

  it("produces expected asia standings file", () => {
    const filePath = path.resolve(
      __dirname,
      "../output/live/2023/standings_asia_2023_08_29.md",
    );
    const fileContent = fs.readFileSync(filePath, "utf-8");

    expect(fileContent).toMatchSnapshot();
  });
});
