import type { Note } from "../data/notes";
import { excerpt, normalizeSearch, queryTokens, searchNotes } from "./search";

export function relevantPassage(note: Note, question: string, maxLength = 2400): string {
  if (note.body.length <= maxLength) return note.body;
  const tokens = queryTokens(question);
  const paragraphs = note.body.split(/\n\s*\n/);
  const ranked = paragraphs.map((text, index) => ({
    text,
    index,
    score: tokens.reduce((sum, token) => sum + Number(normalizeSearch(text).includes(token)), 0),
  }));
  const selected = new Map<number, string>();
  let length = 0;
  for (const item of ranked.sort((a, b) => b.score - a.score || a.index - b.index)) {
    if (length >= maxLength || (selected.size && item.score === 0)) break;
    const text =
      item.text.length > maxLength - length
        ? excerpt(item.text, question, Math.max(0, maxLength - length - 2))
        : item.text;
    selected.set(item.index, text);
    length += text.length + 2;
  }
  return [...selected]
    .sort(([a], [b]) => a - b)
    .map(([, text]) => text)
    .join("\n\n")
    .slice(0, maxLength);
}

export function getAiSources(question: string): Note[] {
  return searchNotes(question).slice(0, 4);
}

export function buildContext(question: string): string {
  return getAiSources(question)
    .map(
      (note, i) =>
        `[${i + 1}] ${note.title} | ${note.category}\n${relevantPassage(note, question)}`,
    )
    .join("\n\n---\n\n");
}

export function offlineAnswer(question: string, saved: Note[]): { text: string; sources: Note[] } {
  const exact = saved.find((note) => normalizeSearch(note.title) === normalizeSearch(question));
  if (exact)
    return {
      text: `## پاسخ ذخیره‌شده\nاین پاسخ قبلاً ذخیره شده و دوباره بررسی نشده است.\n\n${exact.body}`,
      sources: [exact],
    };
  const sources = searchNotes(question, saved).slice(0, 4);
  return {
    sources,
    text: sources.length
      ? "## راهنمای آفلاین\nاین متن، گزیدهٔ یادداشت‌های موجود است؛ تشخیص قطعی یا پاسخ تازهٔ مدل هوش مصنوعی نیست. تطبیق برند و مدل دستگاه ضروری است.\n\n" +
        sources
          .map(
            (note, i) => `### [${i + 1}] ${note.title}\n${relevantPassage(note, question, 1200)}`,
          )
          .join("\n\n")
      : "## اطلاعات کافی پیدا نشد\nبرند، مدل دقیق، کد خطا و علائم را وارد کنید یا عبارت کوتاه‌تری جستجو کنید. برای پاسخ جدید هوش مصنوعی به اینترنت نیاز است.",
  };
}
