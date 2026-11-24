import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { articleSchema } from "../../src/data/content-schema";

const extractedSchema = z.object({
  id: z.string(),
  file: z.string(),
  number: z.number().int().positive(),
  line: z.number().int().positive(),
  question: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export const reviewRowSchema = extractedSchema
  .extend({
    decision: z.enum(["rewritten-merged", "needs-evidence"]),
    articleId: z.string().nullable(),
    reason: z.string().min(20),
    reviewedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    checkedSources: z.array(z.string().url()).min(1).optional(),
    neededEvidence: z.string().min(20).nullable().optional(),
  })
  .strict();
export function extractSubjects(directory: string) {
  return readdirSync(directory)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .flatMap((file) => {
      const text = readFileSync(join(directory, file), "utf8");
      const matches = [...text.matchAll(/^###\s+(?:\d+\.\s*)?س:\s*(.+)$/gm)];
      if (!matches.length) throw new Error(`No questions extracted: ${file}`);
      return matches.map((match, index) => {
        const rest = text.slice(match.index! + match[0].length);
        const end = rest.search(/^#{1,3}\s/m);
        const body = rest.slice(0, end < 0 ? undefined : end).trim();
        return {
          id: file.replace(/\.md$/, "") + "-q" + (index + 1),
          file,
          number: index + 1,
          line: text.slice(0, match.index).split("\n").length,
          question: match[1]!.trim(),
          sha256: createHash("sha256")
            .update(match[1]!.trim() + "\n" + body)
            .digest("hex"),
        };
      });
    });
}
export function validateSubjectReview(
  originals: ReturnType<typeof extractSubjects>,
  raw: unknown,
  rawArticles: unknown,
) {
  const ledger = z.array(reviewRowSchema).parse(raw);
  const articles = z.array(articleSchema).parse(rawArticles);
  const entries = new Map(ledger.map((row) => [row.id, row]));
  if (entries.size !== ledger.length || ledger.length !== originals.length)
    throw new Error("Missing or duplicate review rows");
  for (const original of originals) {
    const row = entries.get(original.id);
    if (!row || JSON.stringify(extractedSchema.parse(row)) !== JSON.stringify(original))
      throw new Error(`Review out of date: ${original.id}`);
    if (row.decision === "needs-evidence") {
      if (
        row.articleId !== null ||
        !row.reviewedAt ||
        !row.checkedSources?.length ||
        !row.neededEvidence
      )
        throw new Error(`Unexplained pending evidence: ${row.id}`);
    } else {
      const article = articles.find((item) => item.id === row.articleId);
      if (
        !article ||
        article.content.publication.status !== "verified" ||
        article.content.publication.visibility !== "available"
      )
        throw new Error(`Invalid reviewed destination: ${row.id}`);
      if (
        !article.content.sources.some(
          (source) =>
            source.id === row.id &&
            source.kind === "archive" &&
            source.path === "New Subjects/" + row.file &&
            source.locator === `Q${row.number}; line ${row.line}`,
        )
      )
        throw new Error(`Missing original reference: ${row.id}`);
      if (row.neededEvidence)
        throw new Error(`Mapped row still claims pending evidence: ${row.id}`);
    }
  }
  const mapped = ledger.filter((row) => row.articleId).length;
  return {
    total: ledger.length,
    mapped,
    pending: ledger.length - mapped,
    articles: articles.length,
  };
}
