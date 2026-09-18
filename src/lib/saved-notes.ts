import { useEffect, useState } from "react";
import type { Note } from "@/data/notes";

const STORAGE_KEY = "ai-saved-notes-v1";
export const AI_CATEGORY = "پاسخ‌های هوش مصنوعی";

const listeners = new Set<() => void>();

function read(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Note[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(next: Note[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export function getSavedNotes(): Note[] {
  return read();
}

export function addSavedNote(input: { title: string; body: string; tags?: string[] }): Note {
  const note: Note = {
    id: `ai-${Date.now()}`,
    title: input.title.trim().slice(0, 120) || "پاسخ هوش مصنوعی",
    category: AI_CATEGORY,
    tags: ["هوش مصنوعی", ...(input.tags ?? [])],
    body: input.body,
  };
  write([note, ...read()]);
  return note;
}

export function removeSavedNote(id: string) {
  write(read().filter((n) => n.id !== id));
}

/** Reactive access to saved notes (client-only; empty during SSR). */
export function useSavedNotes(): Note[] {
  const [saved, setSaved] = useState<Note[]>([]);
  useEffect(() => {
    const sync = () => setSaved(read());
    sync();
    listeners.add(sync);
    window.addEventListener("storage", sync);
    return () => {
      listeners.delete(sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return saved;
}
