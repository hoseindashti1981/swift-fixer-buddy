import { useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import type { Note } from "@/data/notes";
import { saveOfflineNote } from "@/lib/saved-notes";

export function NoteEditor({ note, onClose }: { note?: Note; onClose: () => void }) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [category, setCategory] = useState(note?.category ?? "آموزش‌های من");
  const [tags, setTags] = useState(note?.tags.join("، ") ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [error, setError] = useState("");
  const dirty =
    title !== (note?.title ?? "") ||
    category !== (note?.category ?? "آموزش‌های من") ||
    tags !== (note?.tags.join("، ") ?? "") ||
    body !== (note?.body ?? "");
  useBlocker({
    shouldBlockFn: () => dirty && !window.confirm("یادداشت ذخیره نشده است. از ویرایش خارج شوید؟"),
    enableBeforeUnload: dirty,
  });
  const field = "mt-1 block w-full rounded-xl border border-input bg-background p-3";
  return (
    <form
      data-note-editor
      className="my-4 space-y-3 rounded-2xl border border-primary/40 bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        try {
          saveOfflineNote({
            id: note?.id ?? `local-${crypto.randomUUID()}`,
            title,
            category,
            body,
            tags: [
              ...new Set(
                tags
                  .split(/[,،]/)
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              ),
            ],
          });
          onClose();
        } catch (cause) {
          setError(
            cause instanceof Error && cause.message.startsWith("عنوان")
              ? cause.message
              : "ذخیره نشد؛ فضای دستگاه یا دسترسی حافظه را بررسی کنید.",
          );
        }
      }}
    >
      <h2 className="font-bold">{note ? "ویرایش مطلب آفلاین" : "افزودن مطلب آموزشی"}</h2>
      <p className="text-xs leading-6 text-muted-foreground">
        تغییرات فقط در همین مرورگر و دستگاه ذخیره می‌شوند؛ با پاک کردن داده‌های سایت از بین می‌روند.
      </p>
      <label className="block">
        عنوان
        <input
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={field}
        />
      </label>
      <label className="block">
        دسته‌بندی
        <input
          required
          maxLength={80}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={field}
        />
      </label>
      <label className="block">
        برچسب‌ها (با ویرگول جدا کنید)
        <input
          maxLength={500}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className={field}
        />
      </label>
      <label className="block">
        متن آموزشی (Markdown)
        <textarea
          required
          rows={12}
          maxLength={200000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={field}
        />
      </label>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button className="min-h-12 rounded-xl bg-primary px-4 font-bold text-primary-foreground">
          ذخیره مطلب
        </button>
        <button type="button" onClick={onClose} className="min-h-12 rounded-xl border px-4">
          انصراف
        </button>
      </div>
    </form>
  );
}
