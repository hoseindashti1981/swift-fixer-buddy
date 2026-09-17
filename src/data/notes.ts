import data from "./notes.json";

export interface Note {
  id: string;
  title: string;
  category: string;
  tags: string[];
  body: string;
}

// نوت‌های واقعی کاربر که از Obsidian تبدیل شده‌اند (src/data/notes.json)
export const notes: Note[] = data as Note[];

export const categories = [...new Set(notes.map((n) => n.category))];
