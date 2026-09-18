import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { categories, notes } from "@/data/notes";
import { excerpt, highlightParts, searchNotes } from "@/lib/search";
import { useSavedNotes, AI_CATEGORY } from "@/lib/saved-notes";
import { AskAi } from "@/components/AskAi";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "راهنمای سریع پکیج شوفاژ دیواری | عیب‌یابی و کدهای خطا" },
      {
        name: "description",
        content:
          "راهنمای جیبی تعمیرکار پکیج شوفاژ دیواری: جستجوی سریع کدهای خطا، علت و راه‌حل ایرادها، سرویس و نگهداری. مناسب آیفون و موبایل.",
      },
      { property: "og:title", content: "راهنمای سریع پکیج شوفاژ دیواری" },
      {
        property: "og:description",
        content: "کد خطا یا ایراد دستگاه را جستجو کنید و فوراً علت و راه‌حل را ببینید.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Highlighted({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-sm bg-primary/30 px-0.5 text-inherit">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function Index() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const savedNotes = useSavedNotes();

  const results = useMemo(() => searchNotes(query, savedNotes), [query, savedNotes]);
  const isSearching = query.trim().length >= 2;

  const allCategories = useMemo(
    () => (savedNotes.length ? [AI_CATEGORY, ...categories] : categories),
    [savedNotes.length],
  );

  const visible = useMemo(() => {
    const base = isSearching ? results : [...savedNotes, ...notes];
    return activeCategory ? base.filter((n) => n.category === activeCategory) : base;
  }, [isSearching, results, savedNotes, activeCategory]);

  return (
    <div className="mx-auto min-h-screen max-w-xl px-4 pb-16">
      {/* Header */}
      <header className="flex items-center gap-3 pt-8">
        <img
          src="/icons/icon-192.png"
          alt="آیکون راهنمای پکیج"
          width={48}
          height={48}
          className="h-12 w-12 rounded-2xl"
        />
        <div>
          <h1 className="text-xl font-extrabold text-foreground">راهنمای پکیج شوفاژ دیواری</h1>
          <p className="text-xs text-muted-foreground">عیب‌یابی سریع، کد خطا و راه‌حل</p>
        </div>
      </header>

      {/* Search */}
      <div className="sticky top-0 z-10 -mx-4 bg-background/95 px-4 pb-3 pt-4 backdrop-blur">
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="مدل دستگاه، کد خطا یا ایراد… مثل E01"
            className="h-14 w-full rounded-2xl border border-input bg-card pr-12 pl-12 text-base text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="پاک کردن جستجو"
              className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-secondary text-muted-foreground"
            >
              ✕
            </button>
          )}
        </div>

        {/* Category chips */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setActiveCategory(null)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeCategory === null
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}
          >
            همه
          </button>
          {allCategories.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(activeCategory === c ? null : c)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeCategory === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <main className="mt-4">
        {isSearching && (
          <p className="mb-3 text-sm text-muted-foreground">
            {visible.length
              ? `${visible.length} نتیجه برای «${query.trim()}»`
              : `نتیجه‌ای برای «${query.trim()}» پیدا نشد`}
          </p>
        )}

        <ul className="space-y-3">
          {visible.map((note) => (
            <li key={note.id}>
              <Link
                to="/note/$id"
                params={{ id: note.id }}
                className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors active:bg-accent"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                    {note.category}
                  </span>
                </div>
                <h2 className="text-[15px] font-bold leading-snug text-card-foreground">
                  {isSearching ? <Highlighted text={note.title} query={query} /> : note.title}
                </h2>
                <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                  {excerpt(note.body, query)}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        {!visible.length && isSearching && (
          <div className="mt-10 text-center text-muted-foreground">
            <p className="text-4xl">🔍</p>
            <p className="mt-3 text-sm">
              چیزی پیدا نشد. کلمه دیگری امتحان کنید، مثلاً نام قطعه یا علامت ایراد.
            </p>
          </div>
        )}

        {isSearching && <AskAi key={query.trim()} question={query.trim()} />}
      </main>
    </div>
  );
}
