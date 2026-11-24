import { describe, expect, test } from "bun:test";
import data from "../src/data/notes.json";
import { notes, type Note } from "../src/data/notes";
import { contentReview, contentReviewLabel, quarantine } from "../src/data/content-policy";
import { createNoteSearch, searchNotes } from "../src/lib/search";
import { buildContext, getAiSources, offlineAnswer } from "../src/lib/ai-context";
import { getSavedNotes, removeSavedNote, saveOfflineNote } from "../src/lib/saved-notes";
import { LIBRARY_KEY } from "../src/lib/library-storage";
import { Route } from "../src/routes/note.$id";

describe("content publication safety", () => {
  test("every quarantine decision refers to an archived record with a reason", () => {
    const ids = new Set(data.map((note) => note.id));
    expect(quarantine.size).toBe(85);
    for (const [id, reason] of quarantine) {
      expect(ids.has(id)).toBe(true);
      expect(reason.length).toBeGreaterThan(20);
      expect(notes.some((note) => note.id === id)).toBe(false);
    }
    expect(
      notes.filter((note) => note.provenance === "legacy-import").length + quarantine.size,
    ).toBe(data.length);
    expect(data.find((note) => note.id === "151-شیر-کنترلر-گاز")?.body.length).toBeGreaterThan(100);
  });

  test("direct route loaders never return withdrawn bodies", async () => {
    const loader = Route.options.loader;
    if (typeof loader !== "function") throw new Error("Expected note route loader");
    for (const [id] of quarantine) {
      expect(await loader({ params: { id } } as never)).toBeNull();
    }
    expect(await loader({ params: { id: notes[0]!.id } } as never)).toEqual(notes[0]);
    expect(await loader({ params: { id: "nonexistent-id" } } as never)).toBeNull();
  });

  test("raw imports and local overrides cannot restore withdrawn records to any search", () => {
    const archived = data.filter((note) => quarantine.has(note.id));
    const search = createNoteSearch(archived);
    for (const original of archived) {
      expect(search(original.title)).toEqual([]);
      const override = { ...original, title: "آزمونقرنطینه", body: "متنقدیمغیرقابلانتشار" };
      expect(searchNotes("آزمونقرنطینه", [override])).toEqual([]);
      expect(searchNotes(original.title).every((note) => !quarantine.has(note.id))).toBe(true);
      expect(offlineAnswer("آزمونقرنطینه", [override]).text).not.toContain(override.body);
      expect(
        offlineAnswer(original.title, [original]).sources.every((note) => !quarantine.has(note.id)),
      ).toBe(true);
    }
    expect(createNoteSearch(archived)("شیر گاز")).toEqual([]);
  });

  test("shared source retrieval does not bypass publication policy", () => {
    const withdrawn = data.find((note) => note.id === "151-شیر-کنترلر-گاز")!;
    expect(getAiSources(withdrawn.title).every((note) => !quarantine.has(note.id))).toBe(true);
    expect(buildContext(withdrawn.title)).not.toContain(withdrawn.body);
    // Codes may still find model-specific notes, but never the withdrawn generic E01 entry.
    expect(searchNotes("E۰۱").some((note) => note.id === "1-E01")).toBe(false);
  });

  test("available articles are not silently certified and provenance is explicit", () => {
    for (const note of notes.filter((note) => note.provenance === "legacy-import")) {
      const review = contentReview(note);
      expect(review.status).toBe("needs-review");
      expect(review.visibility).toBe("available");
      expect(review.source?.recordId).toBe(note.id);
      expect(review.triagedAt).toBe("2026-11-17");
    }
    expect(contentReviewLabel({ id: "local-test", provenance: "personal" })).toContain(
      "یادداشت شخصی",
    );
    expect(contentReviewLabel({ id: "local-test", provenance: "local-edit" })).toContain(
      "ویرایش شخصی",
    );
    expect(contentReviewLabel({ id: "ai-test", provenance: "ai" })).toContain("هوش مصنوعی");
  });

  test("stored quarantined edits stay intact across reads, saves and unrelated deletions", () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
    const withdrawn = data.find((note) => note.id === "151-شیر-کنترلر-گاز")!;
    const edited = { ...withdrawn, body: "ویرایش شخصی حفظ شود" };
    const visible: Note = {
      id: "local-safety-test",
      title: "یادداشتآزمایشی",
      body: "مشاهده شخصی",
      category: "آموزش‌های من",
      tags: [],
    };
    const values = new Map([["ai-saved-notes-v1", JSON.stringify([edited, visible])]]);
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => values.get(key) ?? null,
          setItem: (key: string, value: string) => values.set(key, value),
        },
      },
    });
    try {
      const before = values.get("ai-saved-notes-v1");
      expect(getSavedNotes().map((note) => note.id)).toEqual([visible.id]);
      expect(values.get("ai-saved-notes-v1")).toBe(before);
      saveOfflineNote({ ...visible, body: "ویرایش جدید" });
      expect(
        JSON.parse(values.get(LIBRARY_KEY)!).notes.find((note: Note) => note.id === edited.id).body,
      ).toBe(edited.body);
      saveOfflineNote({ ...notes[0]!, body: "ویرایش مرجع" });
      expect(getSavedNotes().find((note) => note.id === notes[0]!.id)?.content).toBeUndefined();
      expect(getSavedNotes().find((note) => note.id === notes[0]!.id)?.provenance).toBe(
        "local-edit",
      );
      expect(getSavedNotes().find((note) => note.id === visible.id)?.provenance).toBe("personal");
      removeSavedNote(visible.id);
      expect(
        JSON.parse(values.get(LIBRARY_KEY)!).notes.some(
          (note: Note) => note.id === edited.id && note.body === edited.body,
        ),
      ).toBe(true);
    } finally {
      if (previous) Object.defineProperty(globalThis, "window", previous);
      else Reflect.deleteProperty(globalThis, "window");
    }
  });
});
