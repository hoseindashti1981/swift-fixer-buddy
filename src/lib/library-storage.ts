import { z } from "zod";
import type { Note } from "../data/notes";
export const LIBRARY_KEY = "repair-library-v2";
export const LEGACY_KEY = "ai-saved-notes-v1";
export const RECOVERY_KEY = "repair-library-before-import-v2";
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const text = z.string().min(1);
const noteSchema = z
  .object({
    id: text.max(500),
    title: text.max(1000),
    category: text.max(500),
    body: text.max(200000),
    tags: z.array(z.string().max(1000)).max(500),
  })
  .passthrough();
const studyLocation = z.object({ id: text.max(500), section: z.string().max(500) }).strict();
const studySchema = z
  .object({
    notes: z.array(z.object({ id: text.max(500), body: text.max(8000) }).strict()).max(5000),
    marks: z.array(studyLocation.extend({ section: text.max(500) })).max(10000),
    position: studyLocation.extend({ at: z.string().datetime() }).nullable(),
  })
  .strict();
export type StudyLocation = z.infer<typeof studyLocation>;
export type Study = z.infer<typeof studySchema>;
const emptyStudy = (): Study => ({ notes: [], marks: [], position: null });
const markKey = (mark: StudyLocation) => JSON.stringify([mark.id, mark.section]);
const schema = z
  .object({
    format: z.literal("swift-fixer-library"),
    version: z.literal(2),
    revision: z.number().int().nonnegative(),
    study: studySchema.optional(),
    notes: z.array(noteSchema).max(5000),
    favorites: z.array(text.max(500)).max(10000),
    history: z
      .array(z.object({ query: text.max(1000), at: z.string().datetime() }).strict())
      .max(100),
  })
  .strict()
  .superRefine((library, context) => {
    if (new Set(library.notes.map((note) => note.id)).size !== library.notes.length)
      context.addIssue({ code: "custom", message: "Duplicate note IDs" });
    if (new Set(library.favorites).size !== library.favorites.length)
      context.addIssue({ code: "custom", message: "Duplicate favorites" });
    const study = library.study;
    if (
      study &&
      (new Set(study.notes.map((note) => note.id)).size !== study.notes.length ||
        new Set(study.marks.map(markKey)).size !== study.marks.length)
    )
      context.addIssue({ code: "custom", message: "Duplicate study entries" });
  });
export type Library = z.infer<typeof schema>;
const empty = (): Library => ({
  format: "swift-fixer-library",
  version: 2,
  revision: 0,
  notes: [],
  favorites: [],
  history: [],
});
const listeners = new Set<() => void>();
export const subscribeLibrary = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const announceLibrary = () => listeners.forEach((listener) => listener());
function validate(value: unknown): Library {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error("ساختار داده معتبر نیست؛ نسخه موجود بازنویسی نشد.");
  return result.data;
}
function commit(library: Library) {
  const encoded = JSON.stringify(validate(library));
  if (new TextEncoder().encode(encoded).length > MAX_BACKUP_BYTES)
    throw new Error("حجم کتابخانه بیشتر از ظرفیت فایل پشتیبان است؛ داده فعلی تغییر نکرد.");
  window.localStorage.setItem(LIBRARY_KEY, encoded);
  if (window.localStorage.getItem(LIBRARY_KEY) !== encoded)
    throw new Error("ذخیره تأیید نشد؛ نسخه قبلی یا پشتیبان را بررسی کنید.");
  announceLibrary();
}
export function readLibrary(): Library {
  if (typeof window === "undefined") return empty();
  const current = window.localStorage.getItem(LIBRARY_KEY);
  if (current !== null) return validate(JSON.parse(current));
  const legacy = window.localStorage.getItem(LEGACY_KEY);
  if (legacy === null) return empty();
  // Migration commits only after every record validates. The original key is never removed.
  const migrated = validate({ ...empty(), notes: JSON.parse(legacy) });
  commit(migrated);
  return migrated;
}
export function updateLibrary(change: (library: Library) => Library): void {
  const current = readLibrary();
  commit({ ...change(current), revision: current.revision + 1 });
}
export function storeNote(note: Note) {
  const validated = noteSchema.parse({
    ...note,
    title: note.title.trim(),
    category: note.category.trim(),
  });
  updateLibrary((library) => ({
    ...library,
    notes: [validated, ...library.notes.filter((item) => item.id !== note.id)],
  }));
}
export function exportLibrary(): string {
  return JSON.stringify(readLibrary());
}
export function exportRecovery(): string {
  const raw = window.localStorage.getItem(RECOVERY_KEY);
  if (!raw) throw new Error("نسخه پیش از ورود هنوز موجود نیست.");
  parseBackup(raw);
  return raw;
}
export function parseBackup(raw: string): Library {
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES)
    throw new Error("حجم فایل پشتیبان بیشتر از ۱۰ مگابایت است.");
  try {
    return validate(JSON.parse(raw));
  } catch {
    throw new Error("فایل پشتیبان خراب یا نسخه آن ناسازگار است؛ داده‌ای تغییر نکرد.");
  }
}
export function backupPreview(raw: string) {
  const incoming = parseBackup(raw);
  const local = readLibrary();
  const conflicts = incoming.notes.filter((note) => {
    const existing = local.notes.find((item) => item.id === note.id);
    return existing && JSON.stringify(existing) !== JSON.stringify(note);
  }).length;
  const studyConflicts =
    incoming.study?.notes.filter((note) =>
      local.study?.notes.some((existing) => existing.id === note.id && existing.body !== note.body),
    ).length ?? 0;
  return {
    notes: incoming.notes.length,
    studyNotes: incoming.study?.notes.length ?? 0,
    marks: incoming.study?.marks.length ?? 0,
    favorites: incoming.favorites.length,
    history: incoming.history.length,
    conflicts: conflicts + studyConflicts,
  };
}
export function importLibrary(raw: string, replaceConflicts = false) {
  const incoming = parseBackup(raw);
  const local = readLibrary();
  const notes = new Map(local.notes.map((note) => [note.id, note]));
  let added = 0,
    replaced = 0,
    skipped = 0;
  for (const note of incoming.notes) {
    if (!notes.has(note.id)) {
      notes.set(note.id, note);
      added++;
    } else if (JSON.stringify(notes.get(note.id)) !== JSON.stringify(note)) {
      if (replaceConflicts) {
        notes.set(note.id, note);
        replaced++;
      } else skipped++;
    }
  }
  const queries = new Map(local.history.map((entry) => [entry.query, entry]));
  for (const entry of incoming.history) {
    if (!queries.has(entry.query) || queries.get(entry.query)!.at < entry.at)
      queries.set(entry.query, entry);
  }
  const study = local.study ?? emptyStudy();
  const studyNotes = new Map(study.notes.map((note) => [note.id, note]));
  for (const note of incoming.study?.notes ?? []) {
    const existing = studyNotes.get(note.id);
    if (!existing) {
      studyNotes.set(note.id, note);
      added++;
    } else if (existing.body !== note.body) {
      if (replaceConflicts) {
        studyNotes.set(note.id, note);
        replaced++;
      } else skipped++;
    }
  }
  const incomingPosition = incoming.study?.position;
  const marks = new Map(
    [...study.marks, ...(incoming.study?.marks ?? [])].map((mark) => [markKey(mark), mark]),
  );
  const next = validate({
    ...local,
    revision: local.revision + 1,
    notes: [...notes.values()],
    ...(local.study || incoming.study
      ? {
          study: {
            notes: [...studyNotes.values()],
            marks: [...marks.values()],
            position:
              incomingPosition && (!study.position || study.position.at < incomingPosition.at)
                ? incomingPosition
                : study.position,
          },
        }
      : {}),
    favorites: [...new Set([...local.favorites, ...incoming.favorites])],
    history: [...queries.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 100),
  });
  // Fail before changing the library if the recovery snapshot cannot be written.
  window.localStorage.setItem(RECOVERY_KEY, JSON.stringify(local));
  commit(next);
  return { added, replaced, skipped };
}
export function restoreDamagedLibrary(raw: string) {
  const incoming = parseBackup(raw);
  const current = window.localStorage.getItem(LIBRARY_KEY);
  let healthy = false;
  try {
    healthy = current !== null && schema.safeParse(JSON.parse(current)).success;
  } catch {
    /* The raw snapshot below retains unreadable data. */
  }
  if (healthy) throw new Error("کتابخانه سالم است؛ از ورود معمول پشتیبان استفاده کنید.");
  // Preserve even unreadable bytes before an explicitly requested rebuild.
  if (current !== null) window.localStorage.setItem(RECOVERY_KEY + "-raw", current);
  commit(incoming);
}
export function toggleFavorite(id: string) {
  updateLibrary((library) => ({
    ...library,
    favorites: library.favorites.includes(id)
      ? library.favorites.filter((item) => item !== id)
      : [...library.favorites, id],
  }));
}
export function recordSearch(query: string) {
  const clean = query.trim().slice(0, 1000);
  if (clean.length < 2) return;
  updateLibrary((library) => ({
    ...library,
    history: [
      { query: clean, at: new Date().toISOString() },
      ...library.history.filter((item) => item.query !== clean),
    ].slice(0, 100),
  }));
}
function updateStudy(change: (study: Study) => Study) {
  updateLibrary((library) => ({ ...library, study: change(library.study ?? emptyStudy()) }));
}
export function saveStudyNote(id: string, body: string) {
  updateStudy((study) => ({
    ...study,
    notes: [
      ...(body.trim() ? [{ id, body: body.trim() }] : []),
      ...study.notes.filter((note) => note.id !== id),
    ],
  }));
}
export function toggleStudyMark(mark: StudyLocation) {
  updateStudy((study) => ({
    ...study,
    marks: study.marks.some((item) => markKey(item) === markKey(mark))
      ? study.marks.filter((item) => markKey(item) !== markKey(mark))
      : [mark, ...study.marks],
  }));
}
export function saveStudyPosition(location: StudyLocation) {
  updateStudy((study) => ({
    ...study,
    position: { ...location, at: new Date().toISOString() },
  }));
}
