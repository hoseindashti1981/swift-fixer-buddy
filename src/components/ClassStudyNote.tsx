import { useEffect, useState } from "react";
import { saveStudyNote, saveStudyPosition } from "@/lib/library-storage";

export function ClassStudyNote({ id, saved, open }: { id: string; saved: string; open: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const body = draft ?? saved;

  useEffect(() => {
    let frame = 0;
    let last: string | undefined;
    const persist = (section: string) => {
      if (last === section) return;
      last = section;
      try {
        saveStudyPosition({ id, section });
      } catch {
        setMessage("محل مطالعه ذخیره نشد. حافظهٔ مرورگر را بررسی کنید.");
      }
    };
    const getSections = () => document.querySelectorAll<HTMLElement>("[data-study-section]");
    const hash = window.location.hash.slice(1).split("--heading-")[0];
    const initial = [...getSections()].find((section) => section.id === hash);
    persist(initial?.id ?? "");

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const sections = [...getSections()];
        const current = sections.find((section) => section.getBoundingClientRect().bottom > 130);
        if (sections[0] && sections[0].getBoundingClientRect().top <= 130)
          persist((current ?? sections.at(-1))?.id ?? "");
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [id]);

  return (
    <details
      id="study-note"
      open={open || undefined}
      className="mt-4 scroll-mt-24 rounded-xl border border-border px-3"
    >
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">یادداشت شخصی</summary>
      <form
        className="space-y-2 pb-3"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            saveStudyNote(id, body);
            setDraft(null);
            setMessage(body.trim() ? "یادداشت ذخیره شد." : "یادداشت حذف شد.");
          } catch {
            setMessage("یادداشت ذخیره نشد. متن فعلی برای تلاش دوباره در کادر باقی مانده است.");
          }
        }}
      >
        <textarea
          aria-label="متن یادداشت شخصی"
          rows={4}
          maxLength={8000}
          value={body}
          onChange={(event) => {
            setDraft(event.target.value);
            setMessage("");
          }}
          className="w-full rounded-lg border border-input bg-background p-3 text-sm leading-7"
          placeholder="مشاهده یا مثال خودت را بنویس"
        />
        <button
          type="submit"
          disabled={body.trim() === saved}
          className="min-h-11 rounded-lg bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50"
        >
          {body.trim() || !saved ? "ذخیرهٔ یادداشت" : "حذف یادداشت"}
        </button>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </form>
    </details>
  );
}
