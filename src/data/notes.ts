import data from "./catalogue.generated.json";
import migration from "./legacy-map.generated.json";
import type { NoteProvenance } from "./content-policy";
import type { ContentMetadata } from "./content-schema";

export interface Note {
  id: string;
  title: string;
  category: string;
  tags: string[];
  body: string;
  provenance?: NoteProvenance;
  content?: ContentMetadata;
}

// Generated and validated before production builds; the source archive stays out of the app.
export const legacyNoteIds = new Set(migration.map((entry) => entry.legacyId));
export const notes: Note[] = data.articles as Note[];
export const catalogueNoteIds = new Set([...legacyNoteIds, ...notes.map((note) => note.id)]);

export const categories = [...new Set(notes.map((n) => n.category))];
