import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import ledger from "../content/new-subjects-review.json";
import articles from "../content/articles.json";
import { notes } from "../src/data/notes";
import { searchNotes } from "../src/lib/search";
import { articleSchema } from "../src/data/content-schema";
import { extractSubjects, validateSubjectReview } from "../scripts/lib/review-subjects";

test("every original question has an exact, current review entry", () => {
  const extracted = [];
  for (const file of readdirSync("New Subjects").sort()) {
    const text = readFileSync("New Subjects/" + file, "utf8");
    const matches = [...text.matchAll(/^###\s+(?:\d+\.\s*)?س:\s*(.+)$/gm)];
    matches.forEach((match, index) => {
      const rest = text.slice(match.index! + match[0].length);
      const end = rest.search(/^#{1,3}\s/m);
      const body = rest.slice(0, end < 0 ? undefined : end).trim();
      extracted.push({
        id: file.replace(/\.md$/, "") + "-q" + (index + 1),
        file,
        number: index + 1,
        line: text.slice(0, match.index).split("\n").length,
        question: match[1]!.trim(),
        sha256: createHash("sha256")
          .update(match[1]!.trim() + "\n" + body)
          .digest("hex"),
      });
    });
  }
  expect(extracted).toHaveLength(171);
  expect(
    ledger.map(({ id, file, number, line, question, sha256 }) => ({
      id,
      file,
      number,
      line,
      question,
      sha256,
    })),
  ).toEqual(extracted);
  expect(new Set(ledger.map((row) => row.id)).size).toBe(171);
});

test("mapped answers point to sourced articles; unresolved originals are not published", () => {
  expect(
    validateSubjectReview(extractSubjects("New Subjects"), ledger, articles).mapped,
  ).toBeGreaterThan(74);
  for (const row of ledger) {
    expect(row.reason.length).toBeGreaterThan(20);
    if (row.articleId) {
      const article = articles.find((item) => item.id === row.articleId)!;
      expect(article).toBeDefined();
      expect(article.content.sources.some((source) => source.id === row.id)).toBe(true);
    } else {
      expect(row.decision).toBe("needs-evidence");
      expect(notes.some((note) => note.id === row.id)).toBe(false);
    }
  }
});

test("new cards pass publication validation and remain searchable offline", () => {
  expect(articles.length).toBeGreaterThan(17);
  for (const article of articles) {
    expect(articleSchema.safeParse(article).success).toBe(true);
    expect(article.provenance).toBe("source-summary");
    expect(article.content.observation).toBeNull();
    expect(article.content.measurements).toEqual([]);
    expect(article.content.publication.reviewer).toContain("بدون تأیید میدانی");
    expect(searchNotes(article.title).some((note) => note.id === article.id)).toBe(true);
    expect(notes.some((note) => note.id === article.id)).toBe(true);
  }
});

test("review gate rejects stale sources, duplicate rows, missing evidence and detached mappings", () => {
  const originals = extractSubjects("New Subjects");
  const rows = structuredClone(ledger);
  rows[0]!.sha256 = "0".repeat(64);
  expect(() => validateSubjectReview(originals, rows, articles)).toThrow("out of date");
  expect(() => validateSubjectReview(originals, [...ledger, ledger[0]], articles)).toThrow();
  const missing = structuredClone(ledger);
  const pending = missing.find((row) => row.decision === "needs-evidence")!;
  Object.assign(pending, { neededEvidence: null });
  expect(() => validateSubjectReview(originals, missing, articles)).toThrow("Unexplained");
  const detached = structuredClone(ledger);
  detached.find((row) => row.articleId)!.articleId = "not-published";
  expect(() => validateSubjectReview(originals, detached, articles)).toThrow("destination");
});
