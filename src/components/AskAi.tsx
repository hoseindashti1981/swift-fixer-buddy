import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Note } from "@/data/notes";
import { Markdown } from "@/lib/markdown";
import { getAiSources, offlineAnswer } from "@/lib/ai-context";
import { readLines } from "@/lib/ai-stream";
import { addSavedNote, getSavedNotes } from "@/lib/saved-notes";

export function AskAi({ question }: { question: string }) {
  const [draft, setDraft] = useState(question);
  const [submitted, setSubmitted] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [local, setLocal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      abort.current?.abort();
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const ask = async (offline = false) => {
    const currentQuestion = draft.trim();
    if (currentQuestion.length < 2 || loading) return;
    setSubmitted(currentQuestion);
    setError(null);
    setAnswer("");
    setSavedId(null);
    setComplete(false);
    setLocal(offline);
    if (offline) {
      const result = offlineAnswer(currentQuestion, getSavedNotes());
      setAnswer(result.text);
      setSources(result.sources);
      return;
    }
    setSources(getAiSources(currentQuestion));
    setLoading(true);
    const controller = new AbortController();
    abort.current = controller;
    const timeout = setTimeout(() => controller.abort("timeout"), 95_000);
    try {
      const res = await fetch("/api/ai-ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: currentQuestion }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const message = res.headers.get("content-type")?.includes("text/plain")
          ? await res.text()
          : "سرویس در دسترس نیست. از راهنمای آفلاین استفاده کنید.";
        throw new Error(message || "خطا در دریافت پاسخ");
      }
      let text = "";
      let finished = false;
      let lastUpdate = 0;
      for await (const line of readLines(res.body)) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        if (event.error) throw new Error(String(event.error));
        if (event.done) {
          finished = true;
          break;
        }
        if (typeof event.delta === "string") text += event.delta;
        if (text.length > 100_000) throw new Error("پاسخ بیش از حد طولانی است.");
        if (Date.now() - lastUpdate > 80) {
          setAnswer(text);
          lastUpdate = Date.now();
        }
      }
      setAnswer(text);
      if (!finished || !text.trim()) throw new Error("پاسخ کامل دریافت نشد؛ دوباره تلاش کنید.");
      setComplete(true);
    } catch (cause) {
      setError(
        controller.signal.aborted
          ? controller.signal.reason === "timeout"
            ? "زمان دریافت پاسخ تمام شد؛ دوباره تلاش کنید."
            : "دریافت پاسخ متوقف شد؛ متن ناقص است."
          : cause instanceof Error
            ? cause.message
            : "ارتباط برقرار نشد. از راهنمای آفلاین استفاده کنید.",
      );
    } finally {
      clearTimeout(timeout);
      abort.current = null;
      setLoading(false);
    }
  };

  const save = () => {
    try {
      setSavedId(addSavedNote({ title: submitted, body: answer }).id);
    } catch {
      setError("ذخیره نشد؛ فضای دستگاه یا دسترسی حافظه را بررسی کنید. متن را کپی کنید.");
    }
  };

  return (
    <section className="mb-8 rounded-3xl border border-primary/30 bg-card p-5 shadow-lg shadow-black/10">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">دستیار عیب‌یابی</h1>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
          {online ? "آنلاین" : "آفلاین"}
        </span>
      </div>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">
        برند، مدل دقیق، کد خطا و علائم را بنویسید. پاسخ با کمک یادداشت‌های مرتبط آماده می‌شود.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(!online);
        }}
      >
        <label htmlFor="ai-question" className="mt-4 block text-sm font-medium">
          سؤال شما
        </label>
        <textarea
          id="ai-question"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={1000}
          minLength={2}
          required
          rows={4}
          placeholder="مثلاً: پکیج با چه برند و مدلی، چه کدی نشان می‌دهد و مشکل از چه زمانی شروع شده؟"
          className="mt-2 w-full resize-y rounded-2xl border border-input bg-background p-3 text-base leading-7 outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={loading || draft.trim().length < 2}
            className="min-h-12 flex-1 rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-50"
          >
            {loading
              ? "در حال دریافت پاسخ…"
              : online
                ? "پرسیدن از هوش مصنوعی"
                : "جستجوی راهنمای آفلاین"}
          </button>
          {loading ? (
            <button
              type="button"
              onClick={() => abort.current?.abort()}
              className="rounded-xl border border-border px-4"
            >
              توقف
            </button>
          ) : (
            online && (
              <button
                type="button"
                onClick={() => void ask(true)}
                disabled={draft.trim().length < 2}
                className="min-h-12 rounded-xl border border-border px-4 text-sm disabled:opacity-50"
              >
                راهنمای آفلاین
              </button>
            )
          )}
        </div>
      </form>
      <p className="mt-3 text-xs leading-6 text-muted-foreground">
        حالت آفلاین یادداشت‌ها و پاسخ‌های ذخیره‌شده را بازیابی می‌کند؛ مدل مولد روی دستگاه اجرا
        نمی‌شود.
      </p>
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {answer && (
        <div className="mt-5 border-t border-border pt-4">
          <p role="status" className="mb-3 text-xs text-primary">
            {local
              ? "گزیدهٔ محلی"
              : loading
                ? "پاسخ در حال تکمیل است"
                : complete
                  ? "پاسخ هوش مصنوعی؛ نیازمند بررسی"
                  : "پاسخ ناقص"}
          </p>
          <h2 className="mb-4 font-bold">{submitted}</h2>
          <Markdown content={answer} />
          {sources.length > 0 && (
            <nav aria-label="یادداشت‌های مرجع" className="mt-5 rounded-xl bg-background p-3">
              <h3 className="mb-2 text-sm font-bold">یادداشت‌های مرجع</h3>
              {sources.map((note, i) => (
                <Link
                  key={note.id}
                  to="/note/$id"
                  params={{ id: note.id }}
                  className="block py-2 text-sm leading-6 text-primary underline"
                >
                  [{i + 1}] {note.title}
                </Link>
              ))}
            </nav>
          )}
          <p className="mt-4 text-xs leading-6 text-muted-foreground">
            این راهنما جایگزین دفترچهٔ سازنده و بررسی متخصص نیست. برای کار روی گاز و برق از تعمیرکار
            مجاز کمک بگیرید.
          </p>
          {complete && !loading && (
            <div className="mt-4 flex flex-wrap gap-2">
              {savedId ? (
                <Link
                  to="/note/$id"
                  params={{ id: savedId }}
                  className="rounded-xl bg-secondary p-3 text-sm text-primary"
                >
                  ذخیره شد؛ مشاهدهٔ پاسخ
                </Link>
              ) : (
                <button
                  onClick={save}
                  className="min-h-12 flex-1 rounded-xl border border-primary px-3 text-sm font-bold text-primary"
                >
                  ذخیره برای دسترسی آفلاین
                </button>
              )}
              <button
                onClick={() =>
                  void navigator.clipboard
                    .writeText(answer)
                    .catch(() => setError("کپی انجام نشد؛ متن را انتخاب و کپی کنید."))
                }
                className="rounded-xl border border-border px-4 text-sm"
              >
                کپی پاسخ
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
