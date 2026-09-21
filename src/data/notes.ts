import data from "./notes.json";

export interface Note {
  id: string;
  title: string;
  category: string;
  tags: string[];
  body: string;
}

// نوت‌های واقعی کاربر که از Obsidian تبدیل شده‌اند (src/data/notes.json)
export const notes: Note[] = data.map((note) => ({
  ...note,
  title: /[\p{L}\p{N}]/u.test(note.title)
    ? note.title
    : note.body.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
      note.id.replace(/^\d+-/, "").replace(/-/g, " "),
}));

export const categories = [...new Set(notes.map((n) => n.category))];
