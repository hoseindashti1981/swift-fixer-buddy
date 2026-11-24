import Fuse from "fuse.js";
import { notes, type Note } from "../data/notes";
import { isNoteAvailable } from "../data/content-policy";
import { classSearchTargets } from "../data/class-search";
import { headingAnchor, markdownLines } from "./markdown-lines";

export function normalizeSearch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹٠-٩]/g, (d) => String(d.charCodeAt(0) - (d <= "٩" ? 1632 : 1776)))
    .replace(/[\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[\u200c\u200d]/g, " ")
    .replace(/\b([a-z])[\s.]+(\d{1,3})\b/g, "$1$2")
    .replace(/\b([a-z]{1,3})\s*(\d{2,3})\s*(ff|cf)\b/g, "$1$2$3")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const stopWords = new Set(
  "از به با در را رو و یا که این آن برای چرا چگونه است می شود شده یک من چه کنم دارد هست پکیج آیا ولی اما هنگام چطور".split(
    " ",
  ),
);
const aliases: Record<string, string> = {
  شوفاژ: "رادیاتور",
  شوفاژها: "رادیاتور",
  رادیاتورها: "رادیاتور",
  حموم: "حمام",
  ارور: "خطا",
  دیورتر: "انحرافی",
  گرمه: "گرم",
  داغه: "داغ",
  سرده: "سرد",
};
function words(text: string): string[] {
  return normalizeSearch(text)
    .replace(/نمی\s*(شه|شود|شن|شوند)/g, "نمی شود")
    .replace(/نمیشه|نمیشن/g, "نمی شود")
    .replace(/نمی\s*(کنه|کند|کنند)/g, "نمی کند")
    .replace(/نمی\s*(زنه|زند)(?=\s|$)/g, "نمی زند")
    .replace(/می\s*(چرخه|چرخد)(?=\s|$)/g, "می چرخد")
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => aliases[token] ?? token);
}
export function queryTokens(query: string): string[] {
  return [...new Set(words(query.slice(0, 1000)))]
    .filter((token) => token.length >= 2 && !stopWords.has(token))
    .slice(0, 24);
}
const field = (text: string) => new Set(words(text));
const classTargets = new Map(
  classSearchTargets.flatMap((target) =>
    target.phrases.map((phrase) => [words(phrase).join(" "), target] as const),
  ),
);
const contains = (haystack: string[], needle: string[]) =>
  needle.length > 0 && haystack.some((_, i) => needle.every((part, j) => haystack[i + j] === part));
const negative = (tokens: Iterable<string>) =>
  [...tokens].some((token) => /^(نمی|نیست|ندارد|نداره|ندارم|نشد)/.test(token));
function oneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0,
    j = 0,
    edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length >= b.length) i++;
    if (b.length >= a.length) j++;
  }
  return edits + Number(i < a.length || j < b.length) <= 1;
}

export function searchableBody(body: string): string {
  return body
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "")
    .replace(/\x60{3}[\s\S]*?\x60{3}/g, "")
    .replace(/\[reference:\d+\]/g, "")
    .split(/\r?\n/)
    .filter((line) => !/^\s*(tags:|aliases:|##?\s*(منابع|لینک‌های مرتبط))/.test(line))
    .filter((line) => !/^\s*[-\d.*|\s]+$/.test(line))
    .join("\n");
}
export type DeviceScope = { modelId?: string; brandId?: string };
export function matchesDevice(note: Note, device: DeviceScope): boolean {
  if (!device.modelId && !device.brandId) return true;
  const scope = note.content?.scope;
  if (scope?.applicability === "general") return true;
  if (scope?.applicability !== "models") return false;
  return (
    (!device.modelId ||
      scope.modelIds.some((id) => normalizeSearch(id) === normalizeSearch(device.modelId!))) &&
    (!device.brandId ||
      scope.brandIds.some((id) => normalizeSearch(id) === normalizeSearch(device.brandId!)))
  );
}
export type SearchHit = {
  note: Note;
  score: number;
  sectionId: string | null;
  sectionTitle: string;
  passage: string;
  confidence: "strong" | "limited";
  match: "exact" | "fuzzy";
  scope: "model" | "general" | "unknown";
  details?: { id: string; title: string }[];
};
function parseQuery(query: string, device: DeviceScope = {}) {
  const tokens = queryTokens(query);
  return {
    tokens,
    phrase: words(query),
    codes: tokens.filter((token) => /\d/.test(token)),
    model: device.modelId ?? tokens.find((token) => /^[a-z]{1,3}\d{2,3}(ff|cf)$/.test(token)),
    brand: device.brandId,
    negative: negative(tokens),
  };
}
function classPassages(section: NonNullable<Note["content"]>["sections"][number]) {
  const lines = markdownLines(section.body);
  const passages = [];
  let start = 0;
  let id = section.id;
  let title = section.title;
  let fence = "";
  for (const [i, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    const marker = line.match(/^(`{3,}|~{3,})/)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (line.startsWith(fence)) fence = "";
      continue;
    }
    const heading = !fence && line.match(/^#{3,6}\s+(.+)$/);
    if (!heading) continue;
    passages.push({ id, title, body: lines.slice(start, i).join("\n") });
    start = i + 1;
    id = headingAnchor(section.id, i);
    title = heading[1]!;
  }
  passages.push({ id, title, body: lines.slice(start).join("\n") });
  return passages;
}
function indexNote(note: Note) {
  const c = note.content;
  const sections = c?.sections ?? [{ id: null, title: "", body: note.body }];
  const passages = (note.id.startsWith("ahi-") && c ? c.sections.flatMap(classPassages) : sections)
    .filter(
      (section) => !/^(منابع|لینک های مرتبط|tags|aliases)/.test(normalizeSearch(section.title)),
    )
    .map((section) => {
      const body = searchableBody(section.body);
      return {
        id: section.id,
        title: section.title,
        body,
        heading: field(section.title),
        words: field(body),
      };
    });
  const title = field(note.title);
  const metadata = field(
    [
      ...(c?.aliases ?? []),
      ...(c?.symptoms ?? []),
      ...(c?.componentIds ?? []),
      ...(c?.errorCodes ?? []),
      ...(c?.scope.modelIds ?? []),
      ...(c?.scope.brandIds ?? []),
      ...note.tags,
    ].join(" "),
  );
  const vocabulary = new Set([
    ...title,
    ...metadata,
    ...passages.flatMap((s) => [...s.words, ...s.heading]),
  ]);
  return {
    note,
    title,
    metadata,
    vocabulary,
    negative: negative(vocabulary),
    phrases: [note.title, ...(c?.aliases ?? []), ...(c?.symptoms ?? []), ...note.tags].map(words),
    category: field(note.category),
    sections: passages,
  };
}
function createHitSearch(collection: Note[]) {
  const index = collection.filter(isNoteAvailable).map(indexNote);
  const fuzzy = new Fuse(index, {
    keys: ["note.title", "note.content.aliases"],
    threshold: 0.25,
    ignoreLocation: true,
  });
  return (query: string, device: DeviceScope = {}): SearchHit[] => {
    const q = parseQuery(query, device);
    if (normalizeSearch(query).length < 2 || !q.tokens.length) return [];
    const phrase = q.phrase.join(" ");
    const target = classTargets.get(
      phrase.replace(/^(?:چرا |علت |دلیل )+/, "").replace(/ (?:چیه|چیست)$/, ""),
    );
    const asksPositiveState =
      !q.negative && /(?:گرم|روشن)\s+می\s+(?:شود|کند)/.test(q.phrase.join(" "));
    const asksGasSmell = normalizeSearch(query).includes("بوی گاز");
    const rank = (entry: (typeof index)[number], fuzzyMatch = false): SearchHit | null => {
      const scope = entry.note.content?.scope;
      if (
        !matchesDevice(entry.note, {
          ...(q.model ? { modelId: q.model } : {}),
          ...(q.brand ? { brandId: q.brand } : {}),
        })
      )
        return null;
      const title = entry.title;
      if (target?.id === entry.note.id && entry.note.content) {
        const section = entry.note.content.sections.find((item) => item.id === target.sectionId);
        const details =
          "details" in target
            ? entry.note.content.sections
                .filter((item) => target.details?.includes(item.id))
                .map(({ id, title }) => ({ id, title }))
            : undefined;
        return {
          note: entry.note,
          score: 180,
          sectionId: section?.id ?? null,
          sectionTitle: section?.title ?? "",
          passage: section?.body ?? entry.note.content.summary ?? "",
          confidence: "strong",
          match: "exact",
          scope: scope?.applicability === "general" ? "general" : "unknown",
          ...(details?.length ? { details } : {}),
        };
      }
      if (
        fuzzyMatch &&
        !q.tokens.every(
          (token) =>
            token.length >= 4 && [...title, ...entry.metadata].some((word) => oneEdit(token, word)),
        )
      )
        return null;
      if (q.codes.some((code) => !entry.vocabulary.has(code))) return null;
      if (q.negative && !entry.negative) return null;
      if (asksPositiveState && entry.phrases.every((phrase) => negative(phrase))) return null;
      const best = entry.sections
        .map((section) => ({
          section,
          score: q.tokens.reduce(
            (sum, token) =>
              sum + (section.heading.has(token) ? 5 : section.words.has(token) ? 1 : 0),
            0,
          ),
        }))
        .sort((a, b) => b.score - a.score)[0];
      if (
        q.negative &&
        !entry.phrases.some((phrase) => negative(phrase)) &&
        !negative(best?.section.words ?? [])
      )
        return null;
      const covered = q.tokens.filter(
        (token) =>
          title.has(token) ||
          entry.metadata.has(token) ||
          best?.section.words.has(token) ||
          best?.section.heading.has(token),
      ).length;
      if (!fuzzyMatch && covered < Math.ceil(q.tokens.length * 0.6)) return null;
      const exact = entry.phrases.some((phrase) => contains(phrase, q.phrase));
      const safetyPriority =
        !q.negative &&
        ((asksGasSmell && entry.note.id === "ns-gas-smell") ||
          (q.tokens.includes("پرشر") &&
            q.tokens.includes("یکسره") &&
            entry.note.id === "ns-safety-bypass"));
      const score =
        (safetyPriority ? 200 : 0) +
        q.tokens.reduce(
          (sum, token) =>
            sum +
            (title.has(token)
              ? 12
              : entry.metadata.has(token)
                ? 8
                : best?.section.heading.has(token)
                  ? 5
                  : entry.category.has(token)
                    ? 2
                    : best?.section.words.has(token)
                      ? 1
                      : 0),
          0,
        ) +
        (exact ? 60 : 0) +
        (covered / q.tokens.length) * 20 +
        (entry.note.content?.publication.status === "verified" ? 8 : 0);
      return {
        note: entry.note,
        score,
        sectionId: best?.section.id ?? null,
        sectionTitle: best?.section.title ?? "",
        passage: best?.section.body ?? "",
        confidence:
          !fuzzyMatch &&
          covered / q.tokens.length >= 0.8 &&
          (exact || q.tokens.some((t) => title.has(t) || entry.metadata.has(t)))
            ? "strong"
            : "limited",
        match: fuzzyMatch ? "fuzzy" : "exact",
        scope:
          scope?.applicability === "models"
            ? "model"
            : scope?.applicability === "general"
              ? "general"
              : "unknown",
      };
    };
    const hits = index.map((entry) => rank(entry)).filter((hit): hit is SearchHit => hit !== null);
    if (hits.length) return hits.sort((a, b) => b.score - a.score);
    if (q.codes.length || q.negative || q.tokens.length > 3 || q.model || q.brand) return [];
    return fuzzy
      .search(query, { limit: 10 })
      .map(({ item }) => rank(item, true))
      .filter((hit): hit is SearchHit => hit !== null);
  };
}
export function createNoteSearch(collection: Note[]) {
  const search = createHitSearch(collection);
  return (query: string, device: DeviceScope = {}): Note[] =>
    search(query, device).map((hit) => hit.note);
}
const searchBase = createHitSearch(notes);
let extraNotes: Note[] | undefined;
let searchExtra: ReturnType<typeof createHitSearch> | undefined;
export function searchKnowledge(query: string, extra: Note[] = [], device: DeviceScope = {}) {
  if (extra !== extraNotes) {
    extraNotes = extra;
    // Local edits must not inherit stale searchable sections or certification.
    searchExtra = createHitSearch(extra.map(({ content: _content, ...note }) => note));
  }
  const overridden = new Set(extra.map((note) => note.id));
  const hits = [
    ...searchExtra!(query, device),
    ...searchBase(query, device).filter((hit) => !overridden.has(hit.note.id)),
  ].sort((a, b) => b.score - a.score);
  const parsed = parseQuery(query, device);
  return {
    hits,
    needsDevice:
      parsed.codes.some(
        (code) =>
          /^[a-z]+\d/.test(code) || parsed.tokens.some((token) => ["خطا", "چراغ"].includes(token)),
      ) && !parsed.model,
    hasReviewedAnswer: hits.some((hit) => hit.note.content?.publication.status === "verified"),
    limited: !hits.length || hits.every((hit) => hit.confidence === "limited"),
  };
}
export function searchNotes(query: string, extra: Note[] = []): Note[] {
  return searchKnowledge(query, extra).hits.map((hit) => hit.note);
}
export function excerpt(body: string, query: string, length = 140): string {
  const plain = searchableBody(body)
    .replace(/^#+\s*/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/^- /gm, "");
  const tokens = queryTokens(query);
  const best = plain
    .split(/\n\s*\n/)
    .map((text, i) => ({ text, i, score: tokens.filter((token) => field(text).has(token)).length }))
    .sort((a, b) => b.score - a.score || a.i - b.i)[0];
  const text = (best?.text ?? plain).trim();
  const parts = highlightParts(text, query);
  const firstMatch = parts.findIndex((part) => part.hit);
  const prefixLength =
    firstMatch < 0
      ? 0
      : parts.slice(0, firstMatch).reduce((sum, part) => sum + part.text.length, 0);
  const start = prefixLength < length / 2 ? 0 : Math.max(0, prefixLength - Math.floor(length / 4));
  return (
    (start ? "…" : "") +
    text.slice(start, start + length) +
    (start + length < text.length ? "…" : "")
  );
}
export function highlightParts(
  text: string,
  query: string | ReadonlySet<string>,
): { text: string; hit: boolean }[] {
  const tokens = typeof query === "string" ? new Set(queryTokens(query)) : query;
  return text
    .split(/([\p{L}\p{N}]+)/gu)
    .filter(Boolean)
    .map((part) => ({
      text: part,
      hit: tokens.has(words(part)[0] ?? ""),
    }));
}
