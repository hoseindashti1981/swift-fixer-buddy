import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { notes, type Note } from "@/data/notes";
import { Markdown } from "@/lib/markdown";
import { searchNotes } from "@/lib/search";
import { addSavedNote } from "@/lib/saved-notes";

function buildContext(question: string): string {
  const related: Note[] = searchNotes(question).slice(0, 4);
  const fallback = related.length ? related : notes.slice(0, 0);
  return fallback
    .map((n) => `### ${n.title} (${n.category})\n${n.body.slice(0, 3000)}`)
    .join("\n\n---\n\n");
}

export function AskAi({ question }: { question: string }) {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const ask = async () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    setLoading(true);
    setError(null);
    setAnswer("");
    setSavedId(null);
    try {
      const res = await fetch("/api/ai-ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context: buildContext(question) }),
      });
      if (!res.ok || !res.body) {
        setError(await res.text().catch(() => "خطا در دریافت پاسخ"));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setAnswer(text);
      }
      if (!text.trim()) setError("پاسخی دریافت نشد، دوباره تلاش کنید.");
    } catch {
      setError("ارتباط با هوش مصنوعی برقرار نشد. اینترنت را بررسی کنید.");
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    const note = addSavedNote({ title: question, body: answer });
    setSavedId(note.id);
  };

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-[15px] font-bold text-card-foreground">
        جوابت را پیدا نکردی؟ از هوش مصنوعی بپرس
      </h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
        سؤال «{question}» همراه با نوت‌های مرتبط خودت برای هوش مصنوعی فرستاده می‌شود.
      </p>

      <button
        onClick={ask}
        disabled={loading}
        className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
      >
        {loading ? "در حال فکر کردن…" : answer ? "پرسیدن دوباره" : "پرسیدن از هوش مصنوعی"}
      </button>

      {error && (
        <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-[13px] text-destructive">{error}</p>
      )}

      {answer && (
        <div className="mt-4 border-t border-border pt-4">
          <Markdown content={answer} />

          {!loading && (
            <div className="mt-4">
              {savedId ? (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary p-3 text-[13px] text-secondary-foreground">
                  <span>در راهنما ذخیره شد ✓</span>
                  <Link
                    to="/note/$id"
                    params={{ id: savedId }}
                    className="font-bold text-primary underline"
                  >
                    دیدن نوت
                  </Link>
                </div>
              ) : (
                <button
                  onClick={save}
                  className="h-12 w-full rounded-xl border border-primary text-sm font-bold text-primary"
                >
                  این جواب درست بود — به راهنما اضافه کن
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
