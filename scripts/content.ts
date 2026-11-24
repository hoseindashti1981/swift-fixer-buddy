import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { importAhiClass } from "./lib/import-ahi-class";
import { importContent } from "./lib/import-content";
import { extractSubjects, validateSubjectReview } from "./lib/review-subjects";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), "utf8"));
const authored = await read("content/articles.json");
const review = validateSubjectReview(
  extractSubjects(resolve(root, "New Subjects")),
  await read("content/new-subjects-review.json"),
  authored,
);
console.log("Subject review:", review);
const classContent = importAhiClass(root, authored);
const result = importContent(
  await read("src/data/notes.json"),
  await read("src/data/quarantine.json"),
  classContent.articles,
);
const outputs = [
  ["content/generated/archive.json", result.archive],
  ["src/data/catalogue.generated.json", result.release],
  ["src/data/legacy-map.generated.json", result.migration],
  ["content/generated/import-report.json", result.report],
  ["content/generated/ahi-class-coverage.json", classContent.coverage],
] as const;
const check = process.argv.includes("--check");
for (const [path, value] of outputs) {
  const expected = JSON.stringify(value, null, 2) + "\n";
  if (check) {
    const actual = await readFile(resolve(root, path), "utf8");
    if (actual.replace(/\r\n/g, "\n") !== expected)
      throw new Error("Stale generated content: " + path);
  } else {
    await mkdir(resolve(root, path, ".."), { recursive: true });
    await writeFile(resolve(root, path), expected, "utf8");
  }
}
console.log(
  `Content ${check ? "validated" : "generated"}: ${result.archive.articles.length} archived, ${result.release.articles.length} released, ${result.migration.length} stable legacy IDs.`,
);
