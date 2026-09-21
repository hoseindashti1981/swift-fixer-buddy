import Fuse from "fuse.js";
import { notes, type Note } from "../data/notes";

export function normalizeSearch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹٠-٩]/g, (digit) => String(digit.charCodeAt(0) - (digit <= "٩" ? 1632 : 1776)))
    .replace(/[\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[\u200c\u200d]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\b([a-z])\s+(\d{1,3})\b/g, "$1$2")
    .trim();
}

const stopWords = new Set(
  "از به با در را و یا که این آن برای چرا چگونه است می شود شده یک من چه کنم دارد هست پکیج".split(
    " ",
  ),
);
export function queryTokens(query: string): string[] {
  return [...new Set(normalizeSearch(query.slice(0, 1000)).split(/\s+/))]
    .filter((token) => token.length >= 2 && !stopWords.has(token))
    .slice(0, 24);
}

function indexNote(note: Note) {
  return {
    note,
    title: normalizeSearch(note.title),
    tags: normalizeSearch(note.tags.join(" ")),
    category: normalizeSearch(note.category),
    body: normalizeSearch(note.body),
  };
}

export function createNoteSearch(collection: Note[]) {
  const index = collection.map(indexNote);
  // ponytail: fuzzy matching stays on short metadata; use a worker if the catalogue grows substantially.
  const fuzzy = new Fuse(index, { keys: ["title", "tags"], threshold: 0.28, ignoreLocation: true });
  return (query: string): Note[] => {
    const normalized = normalizeSearch(query.slice(0, 1000));
    if (normalized.length < 2) return [];
    const tokens = queryTokens(query);
    if (!tokens.length) tokens.push(normalized);
    const codes = tokens.filter((t) => /\d/.test(t));
    const ranked = index.flatMap((entry) => {
      const fields = [entry.title, entry.tags, entry.category, entry.body];
      if (codes.some((code) => !fields.some((field) => ` ${field} `.includes(` ${code} `))))
        return [];
      let matched = 0;
      let score = 0;
      for (const token of tokens) {
        const weight = entry.title.includes(token)
          ? 12
          : entry.tags.includes(token)
            ? 8
            : entry.category.includes(token)
              ? 4
              : entry.body.includes(token)
                ? 1
                : 0;
        if (weight) matched++;
        score += weight;
      }
      if (matched < Math.ceil(tokens.length * 0.6)) return [];
      return [
        {
          note: entry.note,
          score:
            score + (matched / tokens.length) * 30 + (entry.title.includes(normalized) ? 40 : 0),
        },
      ];
    });
    if (ranked.length) return ranked.sort((a, b) => b.score - a.score).map(({ note }) => note);
    if (codes.length || tokens.length > 3) return [];
    return fuzzy.search(tokens.join(" "), { limit: 20 }).map(({ item }) => item.note);
  };
}

const searchBase = createNoteSearch(notes);
let extraNotes: Note[] | undefined;
let searchExtra: ReturnType<typeof createNoteSearch> | undefined;

export function searchNotes(query: string, extra: Note[] = []): Note[] {
  const base = searchBase(query);
  if (!extra.length) return base;
  if (extra !== extraNotes) {
    extraNotes = extra;
    searchExtra = createNoteSearch(extra);
  }
  return [...searchExtra!(query), ...base];
}

export function excerpt(body: string, query: string, length = 140): string {
  const plain = body
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^- /gm, "");
  const token = queryTokens(query).find((t) => plain.toLowerCase().includes(t));
  const index = token ? plain.toLowerCase().indexOf(token) : 0;
  const start = Math.max(0, index - 30);
  return (
    (start ? "…" : "") +
    plain.slice(start, start + length).trim() +
    (plain.length > start + length ? "…" : "")
  );
}

export function highlightParts(text: string, query: string): { text: string; hit: boolean }[] {
  const tokens = queryTokens(query);
  if (!tokens.length) return [{ text, hit: false }];
  const pattern = new RegExp(
    `(${tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );
  return text
    .split(pattern)
    .filter(Boolean)
    .map((part) => ({ text: part, hit: tokens.includes(normalizeSearch(part)) }));
}
