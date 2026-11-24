import entries from "./quarantine.json";
import type { ContentMetadata } from "./content-schema";

export type NoteProvenance = "legacy-import" | "personal" | "local-edit" | "ai" | "source-summary";

export const CONTENT_REVIEW_DATE = "2026-11-17";
export const quarantine = new Map(entries.map((entry) => [entry.id, entry.reason]));

// Explicit editorial decisions, not a keyword classifier or a technical certification.
// The ID restriction also applies to stored overrides of withdrawn articles.
type ReviewedNote = { id: string; provenance?: NoteProvenance; content?: ContentMetadata };

export function isNoteAvailable(note: ReviewedNote): boolean {
  const publication = note.content?.publication;
  return (
    !quarantine.has(note.id) &&
    (!publication ||
      (publication.visibility === "available" &&
        ["needs-review", "verified"].includes(publication.status)))
  );
}

export function contentReview(note: ReviewedNote) {
  return {
    status: note.content?.publication.status ?? "needs-review",
    visibility: quarantine.has(note.id)
      ? ("quarantined" as const)
      : (note.content?.publication.visibility ?? "available"),
    reason: quarantine.get(note.id) ?? note.content?.publication.reason,
    provenance: note.provenance ?? "personal",
    source:
      note.provenance === "legacy-import"
        ? { path: "src/data/notes.json", recordId: note.id }
        : null,
    triagedAt:
      note.provenance === "legacy-import" || quarantine.has(note.id) ? CONTENT_REVIEW_DATE : null,
  };
}

export function contentReviewLabel(note: ReviewedNote): string {
  const labels: Record<NoteProvenance, string> = {
    "legacy-import": "یادداشت واردشده",
    personal: "یادداشت شخصی",
    "local-edit": "ویرایش شخصی",
    ai: "پاسخ ذخیره‌شده هوش مصنوعی",
    "source-summary": "جمع‌بندی منابع",
  };
  const review = contentReview(note);
  const statuses = {
    draft: "پیش‌نویس",
    "needs-review": "نیازمند بازبینی",
    verified: "بررسی‌شده با منبع",
    superseded: "منسوخ",
  };
  return `${labels[review.provenance]} · ${review.visibility === "quarantined" ? "متوقف‌شده برای بازبینی" : statuses[review.status]}`;
}
