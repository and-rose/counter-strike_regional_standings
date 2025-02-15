import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs/promises";
import path from "path";
import { run } from "../src/model/main";

async function getFiles(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });

  return dirents
    .filter((dirent) => dirent.isFile())
    .map((dirent) => path.join(dir, dirent.name));
}

const teamSummaries = await getFiles(
  path.resolve(__dirname, "../output/live/2023/details/2023_08_29"),
);

describe("Markdown file snapshot test", () => {
  it("produces expected global standings file", async () => {
    const filePath = path.resolve(
      __dirname,
      "../output/live/2023/standings_global_2023_08_29.md",
    );
    const fileContent = await fs.readFile(filePath, "utf-8");

    expect(fileContent).toMatchSnapshot();
  });

  it("produces expected americas standings file", async () => {
    const filePath = path.resolve(
      __dirname,
      "../output/live/2023/standings_americas_2023_08_29.md",
    );
    const fileContent = await fs.readFile(filePath, "utf-8");

    expect(fileContent).toMatchSnapshot();
  });

  it("produces expected europe standings file", async () => {
    const filePath = path.resolve(
      __dirname,
      "../output/live/2023/standings_europe_2023_08_29.md",
    );
    const fileContent = await fs.readFile(filePath, "utf-8");

    expect(fileContent).toMatchSnapshot();
  });

  it("produces expected asia standings file", async () => {
    const filePath = path.resolve(
      __dirname,
      "../output/live/2023/standings_asia_2023_08_29.md",
    );
    const fileContent = await fs.readFile(filePath, "utf-8");

    expect(fileContent).toMatchSnapshot();
  });

  describe("produces expected team summary files", () => {
    it.each(teamSummaries)(
      "produces expected team summary file for %s",
      async (filePath) => {
        console.log(filePath);
        const fileContent = await fs.readFile(filePath, "utf-8");

        expect(fileContent).toMatchSnapshot();
      },
    );
  });
});
