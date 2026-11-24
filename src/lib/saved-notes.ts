import { useEffect, useState } from "react";
import { catalogueNoteIds, type Note } from "@/data/notes";
import { isNoteAvailable } from "@/data/content-policy";
import { readLibrary, storeNote, updateLibrary, subscribeLibrary } from "./library-storage";

export const AI_CATEGORY = "پاسخ‌های هوش مصنوعی";

function read(): Note[] {
  return readLibrary().notes as Note[];
}

export function getSavedNotes(): Note[] {
  try {
    return read()
      .map(
        ({ content: _content, ...note }) =>
          ({
            ...note,
            provenance: catalogueNoteIds.has(note.id)
              ? "local-edit"
              : note.id.startsWith("ai-")
                ? "ai"
                : "personal",
          }) as Note,
      )
      .filter(isNoteAvailable);
  } catch {
    return [];
  }
}

export function saveOfflineNote(note: Note): void {
  if (!note.title.trim() || !note.body.trim() || !note.category.trim()) {
    throw new Error("عنوان، دسته‌بندی و متن را وارد کنید.");
  }
  storeNote(note);
}

export function addSavedNote(input: { title: string; body: string; tags?: string[] }): Note {
  const note: Note = {
    id: `ai-${crypto.randomUUID()}`,
    title: input.title.trim().slice(0, 120) || "پاسخ هوش مصنوعی",
    category: AI_CATEGORY,
    tags: ["هوش مصنوعی", ...(input.tags ?? [])],
    body: input.body,
  };
  storeNote(note);
  return note;
}

export function removeSavedNote(id: string) {
  updateLibrary((library) => ({
    ...library,
    notes: library.notes.filter((note) => note.id !== id),
    favorites: catalogueNoteIds.has(id)
      ? library.favorites
      : library.favorites.filter((item) => item !== id),
  }));
}

/** Reactive access to saved notes (client-only; empty during SSR). */
export function useSavedNotes(): Note[] {
  const [saved, setSaved] = useState<Note[]>([]);
  useEffect(() => {
    const sync = () => setSaved(getSavedNotes());
    sync();
    const unsubscribe = subscribeLibrary(sync);
    window.addEventListener("storage", sync);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", sync);
    };
  }, []);
  return saved;
}
