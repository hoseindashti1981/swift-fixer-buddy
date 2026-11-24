import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import legacy from "../src/data/notes.json";
import decisions from "../src/data/quarantine.json";
import { articleSchema, catalogueSchema, type Article } from "../src/data/content-schema";
import { importContent, splitSections } from "../scripts/lib/import-content";
import release from "../src/data/catalogue.generated.json";
import migration from "../src/data/legacy-map.generated.json";
import authored from "../content/articles.json";
import { importAhiClass } from "../scripts/lib/import-ahi-class";

const classContent = importAhiClass(".", authored as Article[]);
const result = importContent(legacy, decisions, classContent.articles);
const sample = () => structuredClone(result.archive.articles[0]!);
function verified(): Article {
  const article = sample();
  Object.assign(article.content.publication, {
    status: "verified",
    reviewedAt: "2026-11-17",
    reviewer: "test-fixture",
    visibility: "available",
    reason: null,
  });
  Object.assign(article.content.scope, {
    applicability: "models",
    brandIds: ["fixture"],
    modelIds: ["fixture-model"],
  });
  article.content.summary = "Synthetic fixture, not published technical content";
  article.content.errorCodes = ["TEST01"];
  Object.assign(article.content.safety, {
    assessment: "reviewed",
    requiredCompetence: "technician",
  });
  article.content.sources.push({
    id: "fixture-source",
    kind: "manufacturer",
    title: "Synthetic test document",
    publisher: "Test fixture",
    documentNumber: "TEST",
    revision: "1",
    url: null,
    path: "test-fixture-only.pdf",
    locator: "p. 1",
    accessedAt: "2026-11-17",
  });
  article.content.sections.forEach((section) => {
    section.sourceIds = ["fixture-source"];
  });
  return article;
}

describe("versioned content import", () => {
  test("preserves every original body and ID without fabricating technical evidence", () => {
    expect(result.archive.articles).toHaveLength(162 + classContent.articles.length);
    expect(result.release.articles).toHaveLength(77 + classContent.articles.length);
    expect(result.release).toEqual(release);
    expect(result.migration).toEqual(migration);
    for (const original of legacy) {
      const article = result.archive.articles.find((item) => item.id === original.id)!;
      expect(article.body).toBe(original.body);
      expect(article.content.scope.applicability).toBe("unknown");
      expect(article.content.publication.reviewedAt).toBeNull();
      expect(article.content.measurements).toEqual([]);
      expect(article.content.sources[0]?.locator).toBe(original.id);
      expect(result.migration.find((item) => item.legacyId === original.id)?.articleId).toBe(
        original.id,
      );
    }
    expect(result.report.some((row) => row.issues.includes("unresolved-references"))).toBe(true);
    expect(importContent(legacy, decisions, classContent.articles)).toEqual(result);
  });

  test("maps all class source lines and preserves the text and links of every section", () => {
    const entries = new Map(result.release.articles.map((article) => [article.id, article]));
    const classEntries = [...entries.values()].filter((article) => article.id.startsWith("ahi-"));
    const sourceFiles = [...new Set(classContent.coverage.map((row) => row.file))];
    const revertLinks = (body: string) =>
      body.replace(/\]\(\/note\/ahi-[\w-]+#([dp]\d{2})\)/g, "](#$1)");
    expect(sourceFiles).toHaveLength(2);
    expect(classEntries).toHaveLength(79);
    for (const file of sourceFiles) {
      const lines = readFileSync(file, "utf8")
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/);
      let nextLine = 1;
      for (const row of classContent.coverage.filter((entry) => entry.file === file)) {
        const [start, end] = row.lines.split("–").map(Number) as [number, number];
        expect(start).toBe(nextLine);
        nextLine = end + 1;
        const [target, sectionId] = row.destination.split("#") as [string, string];
        const article = entries.get(target.replace("/note/", ""))!;
        const section = article.content.sections.find((item) => item.id === sectionId)!;
        const source = lines.slice(start - 1, end);
        const hasAnchor = /^<a id="[dp]\d{2}"><\/a>$/.test(source[0]!);
        const body = source
          .slice(hasAnchor ? 2 : 1)
          .join("\n")
          .trim();
        if (body) expect(revertLinks(section.body)).toBe(body);
        expect(article.content.sources.some((entry) => entry.path === file)).toBe(true);
      }
      expect(nextLine).toBe(lines.length + 1);
    }
    for (const article of classEntries) {
      expect(article.content.publication.status).toBe("needs-review");
      for (const match of article.body.matchAll(/\]\(\/note\/(ahi-[\w-]+)#([\w-]+)\)/g)) {
        expect(
          entries.get(match[1]!)?.content.sections.some((section) => section.id === match[2]),
        ).toBe(true);
      }
    }
  });

  test("rejects malformed, duplicate and orphaned input rather than silently dropping it", () => {
    expect(() => importContent({}, decisions, [])).toThrow();
    expect(() => importContent([...legacy, legacy[0]], decisions, [])).toThrow("Duplicate");
    expect(() => importContent(legacy, [...decisions, decisions[0]], [])).toThrow("Duplicate");
    expect(() => importContent(legacy, [{ id: "orphan", reason: "test" }], [])).toThrow();
    expect(() => importContent([{ ...legacy[0], category: "unmapped" }], [], [])).toThrow(
      "Unmapped",
    );
    expect(() => importContent(legacy, decisions, [{ schemaVersion: 999 }])).toThrow();
  });

  test("extracts sections while preserving fenced headings and repeated titles", () => {
    const sections = splitSections("# Heading\nOne\n```md\n# Code heading\n```\n## Heading\nTwo");
    expect(sections).toHaveLength(2);
    expect(sections[0]?.body).toContain("# Code heading");
    expect(new Set(sections.map((section) => section.id)).size).toBe(2);
    expect(splitSections("plain text")[0]?.body).toBe("plain text");
  });

  test("rejects false verification, dangling citations and invalid domain metadata", () => {
    const incomplete = sample();
    incomplete.content.publication.status = "verified";
    expect(articleSchema.safeParse(incomplete).success).toBe(false);
    expect(articleSchema.safeParse(verified()).success).toBe(true);
    const missingSource = verified();
    missingSource.content.sections[0]!.sourceIds = ["missing"];
    expect(articleSchema.safeParse(missingSource).success).toBe(false);
    const archiveOnly = verified();
    archiveOnly.content.sections[0]!.sourceIds = ["legacy-record"];
    expect(articleSchema.safeParse(archiveOnly).success).toBe(false);
    const badDate = verified();
    badDate.content.publication.reviewedAt = "2026-02-30";
    expect(articleSchema.safeParse(badDate).success).toBe(false);
    const badScope = verified();
    badScope.content.scope.modelIds = [];
    expect(articleSchema.safeParse(badScope).success).toBe(false);
    const duplicateSection = sample();
    duplicateSection.content.sections.push(duplicateSection.content.sections[0]!);
    expect(articleSchema.safeParse(duplicateSection).success).toBe(false);
  });

  test("requires complete test/experience data and sourced measurements for verification", () => {
    const article = verified();
    article.content.kind = "test";
    expect(articleSchema.safeParse(article).success).toBe(false);
    article.content.procedure = {
      prerequisites: ["fixture"],
      tools: ["fixture"],
      steps: ["fixture"],
      expectedResult: "fixture",
      sourceIds: ["fixture-source"],
    };
    expect(articleSchema.safeParse(article).success).toBe(true);
    article.content.measurements = [
      {
        label: "fixture",
        value: null,
        range: { min: 2, max: 1 },
        unit: "fixture",
        conditions: "fixture",
        sourceId: "fixture-source",
      },
    ];
    expect(articleSchema.safeParse(article).success).toBe(false);
    article.content.measurements[0]!.range = { min: 1, max: 2 };
    expect(articleSchema.safeParse(article).success).toBe(true);
    article.content.measurements[0]!.sourceId = "legacy-record";
    expect(articleSchema.safeParse(article).success).toBe(false);
    article.content.measurements = [];
    article.content.kind = "experience";
    expect(articleSchema.safeParse(article).success).toBe(false);
    article.content.observation = { reported: "fixture", outcome: "fixture" };
    expect(articleSchema.safeParse(article).success).toBe(true);
  });

  test("authored replacements respect quarantine and draft/superseded publication rules", () => {
    const replacement = sample();
    replacement.body = "Replacement body, retained only for editorial review";
    replacement.content.publication.visibility = "available";
    const imported = importContent(legacy, decisions, [replacement]);
    expect(imported.archive.articles).toHaveLength(162);
    expect(imported.release.articles.some((article) => article.id === replacement.id)).toBe(false);
    const draft = sample();
    draft.id = "draft-fixture";
    draft.content.publication.status = "draft";
    draft.content.publication.visibility = "available";
    expect(
      importContent(legacy, decisions, [draft]).release.articles.some(
        (article) => article.id === draft.id,
      ),
    ).toBe(false);
    draft.content.relatedIds = ["missing"];
    expect(catalogueSchema.safeParse({ schemaVersion: 2, articles: [draft] }).success).toBe(false);
    draft.content.relatedIds = [];
    draft.content.publication.status = "superseded";
    expect(articleSchema.safeParse(draft).success).toBe(false);
  });
});
