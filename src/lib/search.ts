import Fuse from "fuse.js";
import { notes, type Note } from "@/data/notes";

const fuse = new Fuse(notes, {
  keys: [
    { name: "title", weight: 3 },
    { name: "tags", weight: 2.5 },
    { name: "category", weight: 1.5 },
    { name: "body", weight: 1 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2,
});

export function searchNotes(query: string): Note[] {
  const q = query.trim();
  if (q.length < 2) return [];
  return fuse.search(q).map((r) => r.item);
}

export function excerpt(body: string, query: string, length = 140): string {
  const plain = body.replace(/^#+\s*/gm, "").replace(/\*\*/g, "").replace(/- /g, "");
  const idx = plain.indexOf(query.trim());
  if (idx > 20) {
    return "…" + plain.slice(idx - 10, idx - 10 + length).trim() + "…";
  }
  return plain.slice(0, length).trim() + "…";
}

/** Split text around the query for highlighting (simple, whole-string match). */
export function highlightParts(text: string, query: string): { text: string; hit: boolean }[] {
  const q = query.trim();
  if (!q) return [{ text, hit: false }];
  const idx = text.indexOf(q);
  if (idx === -1) return [{ text, hit: false }];
  return [
    { text: text.slice(0, idx), hit: false },
    { text: text.slice(idx, idx + q.length), hit: true },
    { text: text.slice(idx + q.length), hit: false },
  ].filter((p) => p.text);
}
