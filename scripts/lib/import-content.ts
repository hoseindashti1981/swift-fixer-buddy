import { z } from "zod";
import {
  articleSchema,
  catalogueSchema,
  legacyNoteSchema,
  type Article,
  type ContentMetadata,
} from "../../src/data/content-schema";

const categoryKinds: Record<string, ContentMetadata["kind"]> = {
  "کدهای خطا": "error-code",
  عیب‌یابی: "symptom",
  قطعات: "component",
  "تست قطعات": "test",
  بردها: "component",
  "برندها و مدل‌ها": "device",
  تجربیات: "experience",
  "ریست دستگاه": "checklist",
};

// Headings inside fenced code are not article sections. Repeated headings get distinct IDs.
export function splitSections(body: string): ContentMetadata["sections"] {
  const sections: ContentMetadata["sections"] = [];
  const counts = new Map<string, number>();
  let title = "متن یادداشت";
  let lines: string[] = [];
  let fence: string | null = null;
  const flush = () => {
    const text = lines.join("\n").trim();
    if (text) {
      const slug =
        title
          .normalize("NFKC")
          .replace(/[^\p{L}\p{N}]+/gu, "-")
          .replace(/^-|-$/g, "") || "text";
      const count = (counts.get(slug) ?? 0) + 1;
      counts.set(slug, count);
      sections.push({
        id: `section-${slug}-${count}`,
        title,
        body: text,
        sourceIds: ["legacy-record"],
      });
    }
    lines = [];
  };
  for (const line of body.split(/\r?\n/)) {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      lines.push(line);
      continue;
    }
    const heading = !fence && line.match(/^#{1,6}\s+(.+?)\s*#*$/);
    if (heading) {
      flush();
      title = heading[1]!.trim();
    } else lines.push(line);
  }
  flush();
  if (!sections.length)
    sections.push({ id: "section-text-1", title, body: body.trim(), sourceIds: ["legacy-record"] });
  return sections;
}

export function importContent(raw: unknown, decisions: unknown, authored: unknown) {
  const legacy = z.array(legacyNoteSchema).parse(raw);
  const quarantine = z
    .array(z.object({ id: z.string().min(1), reason: z.string().min(1) }).strict())
    .parse(decisions);
  const additions = z.array(articleSchema).parse(authored);
  const ids = new Set(legacy.map((note) => note.id));
  if (ids.size !== legacy.length) throw new Error("Duplicate legacy IDs");
  if (new Set(quarantine.map((entry) => entry.id)).size !== quarantine.length)
    throw new Error("Duplicate quarantine decisions");
  if (
    quarantine.some(
      (entry) => !ids.has(entry.id) && !additions.some((article) => article.id === entry.id),
    )
  )
    throw new Error("Quarantine decision has no source article");
  const blocked = new Map(quarantine.map((entry) => [entry.id, entry.reason]));
  const articles: Article[] = legacy.map((note) => {
    const title = /[\p{L}\p{N}]/u.test(note.title)
      ? note.title.trim()
      : note.body.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
        note.id.replace(/^\d+-/, "").replace(/-/g, " ");
    const kind = categoryKinds[note.category];
    if (!kind) throw new Error("Unmapped legacy category: " + note.category);
    return articleSchema.parse({
      ...note,
      title,
      provenance: "legacy-import",
      content: {
        schemaVersion: 2,
        revision: 1,
        kind,
        aliases: [],
        symptoms: [],
        componentIds: [],
        errorCodes: [],
        domains: [],
        scope: {
          applicability: "unknown",
          brandIds: [],
          modelIds: [],
          architectures: [],
          operatingModes: [],
        },
        summary: null,
        sections: splitSections(note.body),
        possibleCauses: [],
        nextSteps: [],
        procedure: null,
        measurements: [],
        safety: {
          assessment: "unknown",
          hazards: [],
          requiredCompetence: "unknown",
          stopConditions: [],
        },
        sources: [
          {
            id: "legacy-record",
            kind: "archive",
            title: "یادداشت واردشده از Obsidian",
            publisher: null,
            url: null,
            path: "src/data/notes.json",
            documentNumber: null,
            revision: null,
            locator: note.id,
            accessedAt: null,
          },
        ],
        publication: {
          status: "needs-review",
          visibility: blocked.has(note.id) ? "quarantined" : "available",
          reason: blocked.get(note.id) ?? null,
          triagedAt: "2026-11-17",
          reviewedAt: null,
          reviewer: null,
          supersedes: null,
          replacedBy: null,
        },
        relatedIds: [],
        observation: null,
      },
    });
  });
  // Authored replacements are explicit; omission cannot remove an original archive record.
  const authoredIds = new Set(additions.map((article) => article.id));
  if (authoredIds.size !== additions.length) throw new Error("Duplicate authored IDs");
  const merged = [...articles.filter((article) => !authoredIds.has(article.id)), ...additions];
  for (const article of merged) {
    if (blocked.has(article.id)) {
      article.content.publication.visibility = "quarantined";
      article.content.publication.reason = blocked.get(article.id)!;
    }
  }
  const archive = catalogueSchema.parse({ schemaVersion: 2, articles: merged });
  // Relationships are checked against the full archive, including withdrawn predecessors.
  const release = {
    schemaVersion: 2 as const,
    articles: archive.articles.filter(
      (article) =>
        article.content.publication.visibility === "available" &&
        ["needs-review", "verified"].includes(article.content.publication.status),
    ),
  };
  const migration = legacy.map((note) => ({ legacyId: note.id, articleId: note.id }));
  const report = archive.articles.map((article) => ({
    id: article.id,
    status: article.content.publication.status,
    released: release.articles.some((item) => item.id === article.id),
    issues: [
      ...(article.content.scope.applicability === "unknown" ? ["unknown-device-scope"] : []),
      ...(article.content.safety.assessment === "unknown" ? ["unreviewed-safety"] : []),
      ...(article.content.sources.every((source) => source.kind === "archive")
        ? ["archive-is-not-technical-evidence"]
        : []),
      ...(/\[reference:\d+\]/.test(article.body) ? ["unresolved-references"] : []),
      ...(/```dataview/.test(article.body) ? ["raw-dataview"] : []),
    ],
  }));
  return { archive, release, migration, report };
}
