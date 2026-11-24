import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { notes } from "@/data/notes";
import { Markdown } from "@/lib/markdown";
import { removeSavedNote, useSavedNotes } from "@/lib/saved-notes";
import { useMemo, useState } from "react";
import { NoteEditor } from "@/components/NoteEditor";
import { contentReviewLabel, quarantine } from "@/data/content-policy";
import { parseSearchState } from "@/lib/search-state";
import { useLibraryState } from "@/lib/library-hooks";
import { toggleFavorite, toggleStudyMark } from "@/lib/library-storage";
import { ClassStudyNote } from "@/components/ClassStudyNote";
import { classGuides } from "@/data/class-guide-readings";
import { Bookmark } from "lucide-react";

export const Route = createFileRoute("/note/$id")({
  validateSearch: parseSearchState,
  loader: ({ params }) => notes.find((n) => n.id === params.id) ?? null,
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} | راهنمای پکیج` },
          { name: "description", content: `${loaderData.title} — ${loaderData.category}` },
          { property: "og:title", content: loaderData.title },
          {
            property: "og:description",
            content: `${loaderData.title} — راهنمای پکیج شوفاژ دیواری`,
          },
          { property: "og:type", content: "article" },
          { name: "twitter:card", content: "summary" },
        ]
      : [{ title: "نوت ذخیره‌شده | راهنمای پکیج" }, { name: "robots", content: "noindex" }],
  }),
  component: NotePage,
});

function NotePage() {
  const loaded = Route.useLoaderData();
  const { id } = Route.useParams();
  const searchState = parseSearchState(Route.useSearch());
  const matchedSection = useLocation({
    select: (location) => location.hash.split("--heading-")[0],
  });
  const { data: library } = useLibraryState();
  const savedNotes = useSavedNotes();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const allNotes = useMemo(() => {
    const ids = new Set(savedNotes.map((n) => n.id));
    return [...savedNotes, ...notes.filter((n) => !ids.has(n.id))];
  }, [savedNotes]);

  const saved = savedNotes.find((n) => n.id === id) ?? null;
  const quarantineReason = quarantine.get(id);
  const note = quarantineReason ? null : (saved ?? loaded);
  const isClassNote = loaded?.category === "کلاس استاد آهی";
  const originalSection =
    isClassNote &&
    saved &&
    !note?.content?.sections.some((section) => section.id === matchedSection)
      ? loaded?.content?.sections.find((section) => section.id === matchedSection)
      : undefined;
  const classGuide = classGuides.find((guide) => guide.topic === id);
  const relatedIds = note?.content?.relatedIds ?? [];
  const relatedNotes = relatedIds.length
    ? relatedIds.flatMap((relatedId) => allNotes.filter((item) => item.id === relatedId))
    : allNotes.filter((item) => item.category === note?.category && item.id !== id).slice(0, 4);

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-16">
      <header className="sticky top-[env(safe-area-inset-top)] z-10 -mx-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Link
          to="/"
          search={searchState}
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
        {isClassNote && (
          <Link
            to="/ahi-class"
            className="ms-3 inline-flex min-h-11 items-center text-sm text-primary"
          >
            کلاس استاد آهی
          </Link>
        )}
      </header>

      {!note ? (
        <section className="pt-10 text-sm leading-7 text-muted-foreground">
          {quarantineReason ? (
            <>
              <h1 className="text-lg font-bold text-foreground">
                این مطلب برای بازبینی متوقف شده است
              </h1>
              <p className="mt-3">{quarantineReason}</p>
              <p className="mt-3">
                متن قبلی تا اصلاح و بررسی منبع نمایش داده نمی‌شود. برای ادامه، دفترچه فنی مدل دقیق
                دستگاه را بررسی کنید. ویرایش ذخیره‌شده شما از حافظه حذف نشده است.
              </p>
            </>
          ) : (
            <p className="text-center">این نوت پیدا نشد یا از حافظه دستگاه حذف شده است.</p>
          )}
        </section>
      ) : (
        <>
          <article className="pt-6">
            <button
              aria-pressed={library?.favorites.includes(id) ?? false}
              onClick={() => {
                try {
                  toggleFavorite(id);
                } catch {
                  setError("علاقه‌مندی ذخیره نشد؛ حافظه را بررسی کنید.");
                }
              }}
              className="mb-3 min-h-11 rounded-xl border border-primary px-4 text-sm text-primary"
            >
              {library?.favorites.includes(id) ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها"}
            </button>
            <button
              onClick={() => setEditing(true)}
              className="mb-4 min-h-12 rounded-xl border border-primary px-4 text-sm font-bold text-primary"
            >
              ویرایش متن آفلاین
            </button>
            {editing && (
              <NoteEditor key={`edit-${id}`} note={note} onClose={() => setEditing(false)} />
            )}
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
              {note.category}
            </span>
            <h1 className="mt-3 text-2xl font-extrabold leading-snug text-foreground">
              {note.title}
            </h1>
            {note.content?.summary && (
              <p className="mt-4 rounded-2xl bg-primary/10 p-4 text-base leading-8">
                {note.content.summary}
              </p>
            )}
            {classGuide && (
              <Link
                to="/diagnose"
                search={{ ...searchState, guide: classGuide.id }}
                className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-primary"
              >
                عیب‌یابی مرحله‌ای · {classGuide.title}
              </Link>
            )}
            {isClassNote && (
              <ClassStudyNote
                key={id}
                id={id}
                open={matchedSection === "study-note"}
                saved={library?.study?.notes.find((item) => item.id === id)?.body ?? ""}
              />
            )}
            {note.content && (
              <nav aria-label="بخش‌های مطلب" className="mt-4 flex flex-wrap gap-2">
                {note.content.sections
                  .filter((section) => !/tags:|aliases:/.test(section.title))
                  .map((section) => (
                    <a
                      key={section.id}
                      href={"#" + section.id}
                      className="min-h-11 rounded-lg bg-secondary px-3 py-2 text-xs leading-6"
                    >
                      {section.title}
                    </a>
                  ))}
                {isClassNote && (
                  <>
                    <a
                      href="#note-references"
                      className="min-h-11 rounded-lg bg-secondary px-3 py-2 text-xs leading-6"
                    >
                      متن مرجع
                    </a>
                    <a
                      href="#note-related"
                      className="min-h-11 rounded-lg bg-secondary px-3 py-2 text-xs leading-6"
                    >
                      مطالب مرتبط
                    </a>
                  </>
                )}
              </nav>
            )}

            <aside className="mt-4 rounded-xl border border-border p-3 text-xs leading-6 text-muted-foreground">
              <p className="font-bold">{contentReviewLabel(note)}</p>
              <p>
                {note.content?.publication.status === "verified" ? (
                  <>
                    این جمع‌بندی با منابع ذکرشده تطبیق متنی داده شده است؛ بازبینی انسانی یا آزمون
                    میدانی نیست. دامنه کاربرد را پیش از استفاده بخوانید.
                  </>
                ) : (
                  <>
                    این متن تأیید فنی نشده است. پیش از استفاده از کد خطا، عدد یا روش آزمون، منبع و
                    شرایط همان مدل دستگاه را بررسی کنید. ثبت یا ویرایش شخصی به معنی تأیید محتوای فنی
                    نیست.
                  </>
                )}
              </p>
            </aside>

            {note.tags.length > 0 && (
              <details className="mt-3 text-xs leading-6">
                <summary className="min-h-11 cursor-pointer py-2 text-muted-foreground">
                  عبارت‌ها و برچسب‌های مرتبط
                </summary>
                <div className="mt-2 flex flex-wrap gap-2">
                  {note.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-md bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </details>
            )}

            {originalSection && (
              <section
                id={originalSection.id}
                data-study-section
                className="mt-6 scroll-mt-20 rounded-2xl border border-border p-4"
              >
                <p className="text-xs text-muted-foreground">از متن اصلی کلاس استاد آهی</p>
                <h2 className="my-2 text-lg font-bold">{originalSection.title}</h2>
                <Markdown content={originalSection.body} sectionId={originalSection.id} />
              </section>
            )}
            <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
              {originalSection && <h2 className="mb-2 text-lg font-bold">نسخهٔ ویرایش‌شدهٔ من</h2>}
              {note.content ? (
                note.content.sections.map((section) => (
                  <section
                    id={section.id}
                    key={section.id}
                    data-study-section={isClassNote || undefined}
                    className="scroll-mt-20 py-3"
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <h2 className="text-lg font-bold">{section.title}</h2>
                      {isClassNote && (
                        <button
                          type="button"
                          aria-label={`نشان بخش ${section.title}`}
                          aria-pressed={
                            library?.study?.marks.some(
                              (mark) => mark.id === id && mark.section === section.id,
                            ) ?? false
                          }
                          className="grid size-11 shrink-0 place-items-center rounded-lg border border-border text-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                          onClick={() => {
                            try {
                              toggleStudyMark({ id, section: section.id });
                              setError("");
                            } catch {
                              setError("نشان بخش ذخیره نشد. حافظهٔ مرورگر را بررسی کنید.");
                            }
                          }}
                        >
                          <Bookmark size={18} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <Markdown
                      content={section.body}
                      {...(isClassNote ? { sectionId: section.id } : {})}
                      query={matchedSection === section.id ? (searchState.q ?? "") : ""}
                    />
                  </section>
                ))
              ) : (
                <Markdown content={note.body} query={searchState.q ?? ""} />
              )}
            </div>
            {note.content && (
              <section
                id="note-references"
                className="mt-5 scroll-mt-20 rounded-xl border border-border p-4 text-xs leading-7"
              >
                <h2 className="font-bold">منابع و دامنه بررسی</h2>
                {note.content.sources
                  .filter((source) => source.kind !== "archive")
                  .map((source) => (
                    <p key={source.id} className="mt-2 break-words">
                      {isClassNote && source.path?.startsWith("Mr Ahi Class/") ? (
                        <Link
                          to="/ahi-class/reference/$reference"
                          params={{
                            reference: source.path.includes("مرجع_قطعات") ? "parts" : "faults",
                          }}
                          hash={source.id.startsWith("class-") ? source.id.slice(6) : ""}
                          className="text-primary underline"
                        >
                          {source.title}
                        </Link>
                      ) : source.url ? (
                        <a
                          className="text-primary underline"
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <bdi dir="auto">{source.title}</bdi>
                        </a>
                      ) : (
                        source.title
                      )}
                      {" — "}
                      <bdi dir="auto">{source.publisher}</bdi>
                      {" — "}
                      <bdi dir="auto">{source.locator}</bdi>
                      {source.documentNumber && (
                        <>
                          {" "}
                          — سند <bdi dir="ltr">{source.documentNumber}</bdi>، ویرایش{" "}
                          <bdi dir="ltr">{source.revision}</bdi>
                        </>
                      )}
                    </p>
                  ))}
                {note.content.publication.reviewer && (
                  <p className="mt-3 text-muted-foreground">
                    {note.content.publication.reviewer} —{" "}
                    <bdi dir="ltr">{note.content.publication.reviewedAt}</bdi>
                  </p>
                )}
              </section>
            )}

            {saved && (
              <button
                onClick={() => {
                  if (
                    !window.confirm(
                      loaded
                        ? "تغییرات محلی حذف و متن اصلی بازیابی شود؟"
                        : "این مطلب از دستگاه حذف شود؟",
                    )
                  )
                    return;
                  try {
                    removeSavedNote(saved.id);
                    setEditing(false);
                    if (!loaded) void navigate({ to: "/" });
                  } catch {
                    setError("حذف انجام نشد؛ دسترسی حافظه را بررسی کنید.");
                  }
                }}
                className="mt-4 h-11 w-full rounded-xl border border-destructive text-sm font-bold text-destructive"
              >
                {loaded ? "بازگرداندن متن اصلی" : "حذف این مطلب از راهنما"}
              </button>
            )}
          </article>

          <nav id="note-related" className="mt-8 scroll-mt-20">
            <h2 className="mb-3 text-sm font-bold text-muted-foreground">مطالب مرتبط</h2>
            <ul className="space-y-2">
              {relatedNotes.map((n) => (
                <li key={n.id}>
                  <Link
                    to="/note/$id"
                    params={{ id: n.id }}
                    search={searchState}
                    className="block rounded-xl border border-border bg-card p-3.5 text-sm font-medium text-card-foreground active:bg-accent"
                  >
                    {n.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </div>
  );
}
