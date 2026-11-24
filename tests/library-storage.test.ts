import { expect, test } from "bun:test";
import { removeSavedNote } from "../src/lib/saved-notes";
import {
  LIBRARY_KEY,
  LEGACY_KEY,
  RECOVERY_KEY,
  readLibrary,
  storeNote,
  exportLibrary,
  parseBackup,
  importLibrary,
  backupPreview,
  recordSearch,
  toggleFavorite,
  restoreDamagedLibrary,
  exportRecovery,
  saveStudyNote,
  toggleStudyMark,
  saveStudyPosition,
} from "../src/lib/library-storage";
const sample = {
  id: "local-fixture",
  title: "مشاهده",
  body: "متن دقیق\nخط دوم",
  category: "تجربه",
  tags: ["شخصی"],
};
function withStorage(run: (values: Map<string, string>, fail: (key: string) => void) => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map<string, string>();
  let failingKey = "";
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
          if (key === failingKey) throw new Error("quota");
          values.set(key, value);
        },
      },
    },
  });
  try {
    run(values, (key) => {
      failingKey = key;
    });
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
}
test("reverting a local reference edit retains its favorite; deleting a personal note removes it", () =>
  withStorage(() => {
    const reference = { ...sample, id: "ns-water-flow" };
    storeNote(reference);
    storeNote(sample);
    toggleFavorite(reference.id);
    toggleFavorite(sample.id);
    removeSavedNote(reference.id);
    expect(readLibrary().favorites).toContain(reference.id);
    expect(readLibrary().notes.some((note) => note.id === reference.id)).toBe(false);
    removeSavedNote(sample.id);
    expect(readLibrary().favorites).toEqual([reference.id]);
  }));
test("migration preserves original data and refuses incomplete migrations", () =>
  withStorage((values, fail) => {
    const original = JSON.stringify([sample]);
    values.set(LEGACY_KEY, original);
    fail(LIBRARY_KEY);
    expect(() => readLibrary()).toThrow();
    expect(values.get(LEGACY_KEY)).toBe(original);
    expect(values.has(LIBRARY_KEY)).toBe(false);
    fail("");
    expect(readLibrary().notes).toEqual([sample]);
    expect(values.get(LEGACY_KEY)).toBe(original);
    values.delete(LIBRARY_KEY);
    values.set(LEGACY_KEY, JSON.stringify([sample, { id: "broken" }]));
    expect(() => storeNote(sample)).toThrow();
    expect(values.has(LIBRARY_KEY)).toBe(false);
  }));
test("backup round trip keeps IDs, text, favorites and deduplicated history", () =>
  withStorage((values) => {
    storeNote(sample);
    toggleFavorite(sample.id);
    recordSearch("فشار آب");
    recordSearch("فشار آب");
    const exported = exportLibrary();
    const original = parseBackup(exported);
    expect(original.notes[0]?.body).toBe(sample.body);
    expect(original.history).toHaveLength(1);
    expect(original.favorites).toEqual([sample.id]);
    values.delete(LIBRARY_KEY);
    expect(importLibrary(exported)).toEqual({ added: 1, replaced: 0, skipped: 0 });
    expect(readLibrary().notes).toEqual(original.notes);
    expect(readLibrary().history).toEqual(original.history);
    importLibrary(exported);
    expect(readLibrary().notes).toHaveLength(1);
    expect(readLibrary().favorites).toHaveLength(1);
  }));
test("conflicts are previewed and kept by default, with recovery snapshot before replacement", () =>
  withStorage((values) => {
    storeNote(sample);
    const file = exportLibrary();
    storeNote({ ...sample, body: "نسخه محلی جدید" });
    expect(backupPreview(file).conflicts).toBe(1);
    expect(importLibrary(file).skipped).toBe(1);
    expect(readLibrary().notes[0]?.body).toBe("نسخه محلی جدید");
    expect(importLibrary(file, true).replaced).toBe(1);
    expect(readLibrary().notes[0]?.body).toBe(sample.body);
    expect(JSON.parse(values.get(RECOVERY_KEY)!).notes[0].body).toBe("نسخه محلی جدید");
    expect(parseBackup(exportRecovery()).notes[0]?.body).toBe("نسخه محلی جدید");
  }));
test("class notes, bookmarks and reading position survive restore and merge", () =>
  withStorage((values) => {
    const mark = { id: "ahi-pressure-drop", section: "summer" };
    const other = { id: "ahi-pressure-drop", section: "cycle" };
    saveStudyNote(mark.id, "نمونهٔ تعمیرگاه");
    toggleStudyMark(mark);
    saveStudyPosition(mark);
    const file = exportLibrary();
    const original = parseBackup(file).study;
    values.delete(LIBRARY_KEY);
    expect(readLibrary().study).toBeUndefined();
    importLibrary(file);
    expect(readLibrary().study).toEqual(original!);
    saveStudyNote(mark.id, "تجربهٔ جدید");
    toggleStudyMark(other);
    expect(backupPreview(file).conflicts).toBe(1);
    expect(importLibrary(file).skipped).toBe(1);
    expect(readLibrary().study?.notes[0]?.body).toBe("تجربهٔ جدید");
    expect(readLibrary().study?.marks).toEqual([other, mark]);
    toggleStudyMark(mark);
    saveStudyNote(mark.id, "");
    expect(readLibrary().study?.notes).toEqual([]);
    expect(readLibrary().study?.marks).toEqual([other]);
  }));
test("corruption, incompatible files, duplicate IDs and quota do not overwrite valid data", () =>
  withStorage((values, fail) => {
    storeNote(sample);
    const before = values.get(LIBRARY_KEY);
    for (const file of [
      "{",
      JSON.stringify({ ...readLibrary(), version: 99 }),
      JSON.stringify({ ...readLibrary(), notes: [sample, sample] }),
    ]) {
      expect(() => importLibrary(file)).toThrow();
      expect(values.get(LIBRARY_KEY)).toBe(before);
    }
    const valid = exportLibrary();
    fail(RECOVERY_KEY);
    expect(() => importLibrary(valid)).toThrow("quota");
    expect(values.get(LIBRARY_KEY)).toBe(before);
    fail("");
    values.set(LIBRARY_KEY, "{broken");
    expect(() => storeNote(sample)).toThrow();
    expect(values.get(LIBRARY_KEY)).toBe("{broken");
    restoreDamagedLibrary(valid);
    expect(readLibrary().notes[0]?.body).toBe(sample.body);
    expect(values.get(RECOVERY_KEY + "-raw")).toBe("{broken");
    expect(() => restoreDamagedLibrary(valid)).toThrow("سالم");
  }));
