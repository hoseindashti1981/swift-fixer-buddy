import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Markdown } from "@/lib/markdown";
import { removeSavedNote, useSavedNotes } from "@/lib/saved-notes";
import { AskAi } from "@/components/AskAi";

export const Route = createFileRoute("/ai")({
  validateSearch: (search: Record<string, unknown>): { q?: string } =>
    typeof search["q"] === "string" ? { q: search["q"].slice(0, 1000) } : {},
  head: () => ({
    meta: [
      { title: "پاسخ‌های هوش مصنوعی | راهنمای پکیج" },
      {
        name: "description",
        content:
          "همه پاسخ‌هایی که از هوش مصنوعی گرفته‌اید و به راهنما اضافه کرده‌اید، یک‌جا در همین پوشه.",
      },
      { property: "og:title", content: "پاسخ‌های هوش مصنوعی" },
      {
        property: "og:description",
        content: "پوشه اختصاصی پاسخ‌های هوش مصنوعی در راهنمای پکیج شوفاژ دیواری.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AiFolder,
});

function AiFolder() {
  const { q } = Route.useSearch();
  const savedNotes = useSavedNotes();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const copyAll = async () => {
    setError("");
    const text = savedNotes.map((n) => `# ${n.title}\n\n${n.body}`).join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setError("کپی انجام نشد؛ دسترسی کلیپ‌بورد را بررسی کنید.");
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-16">
      <header className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            className="h-4 w-4"
          >
            <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          بازگشت به جستجو
        </Link>
      </header>

      <div className="pt-6">
        <AskAi key={q ?? ""} question={q ?? ""} />
        <h2 className="text-xl font-extrabold text-foreground">پوشه پاسخ‌های هوش مصنوعی</h2>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          {savedNotes.length
            ? `${savedNotes.length} پاسخ ذخیره‌شده — جدا از نوت‌های اصلی شما.`
            : "هنوز پاسخی ذخیره نکرده‌اید. بعد از پرسیدن از هوش مصنوعی، جواب را به راهنما اضافه کنید."}
        </p>

        {savedNotes.length > 0 && (
          <button
            onClick={copyAll}
            className="mt-4 h-12 w-full rounded-xl border border-primary text-sm font-bold text-primary"
          >
            {copied ? "کپی شد ✓" : "کپی همه پاسخ‌ها"}
          </button>
        )}

        <ul className="mt-5 space-y-3">
          {savedNotes.map((note) => (
            <li key={note.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <Link
                to="/note/$id"
                params={{ id: note.id }}
                className="text-[15px] font-bold leading-snug text-card-foreground"
              >
                {note.title}
              </Link>
              <div className="mt-3 max-h-40 overflow-hidden text-[13px] text-muted-foreground">
                <Markdown content={note.body.slice(0, 500)} />
              </div>
              <button
                onClick={() => {
                  try {
                    removeSavedNote(note.id);
                    setError("");
                  } catch {
                    setError("حذف انجام نشد؛ دسترسی حافظه را بررسی کنید.");
                  }
                }}
                className="mt-3 h-10 w-full rounded-xl border border-destructive text-[13px] font-bold text-destructive"
              >
                حذف
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
